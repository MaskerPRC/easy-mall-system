const axios = require('axios');
const { getDB } = require('../database/init');

class WebhookService {
  // 触发所有相关的 webhooks
  async triggerWebhooks(eventType, emailId, emailData) {
    const webhooks = await this.getActiveWebhooks(eventType);
    
    if (webhooks.length === 0) {
      console.log(`没有配置 ${eventType} 事件的 webhook`);
      return;
    }

    console.log(`触发 ${webhooks.length} 个 ${eventType} webhook 回调`);

    // 并行执行所有 webhooks
    const promises = webhooks.map(webhook => 
      this.executeWebhook(webhook, emailId, emailData, eventType)
    );

    await Promise.allSettled(promises);
  }

  // 获取指定事件类型的活跃 webhooks
  async getActiveWebhooks(eventType) {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM webhook_configs 
         WHERE is_active = 1 AND (
           trigger_events = '*' OR 
           trigger_events LIKE '%${eventType}%'
         )`,
        [],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
          db.close();
        }
      );
    });
  }

  // 执行单个 webhook
  async executeWebhook(webhook, emailId, emailData, eventType) {
    const maxRetries = webhook.retry_count || 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      attempt++;
      
      try {
        const response = await this.sendWebhookRequest(webhook, emailData, eventType);
        
        // 记录成功
        await this.logWebhookExecution(webhook.id, emailId, eventType, {
          status: 'success',
          responseCode: response.status,
          responseBody: JSON.stringify(response.data).substring(0, 1000),
          attemptCount: attempt
        });
        
        console.log(`✅ Webhook 执行成功: ${webhook.name} (${response.status})`);
        return;
        
      } catch (error) {
        console.error(`❌ Webhook 执行失败 (尝试 ${attempt}/${maxRetries}): ${webhook.name}`, error.message);
        
        if (attempt >= maxRetries) {
          // 记录最终失败
          await this.logWebhookExecution(webhook.id, emailId, eventType, {
            status: 'failed',
            responseCode: error.response?.status || 0,
            errorMessage: error.message,
            attemptCount: attempt
          });
        } else {
          // 等待后重试
          await this.delay(Math.pow(2, attempt) * 1000); // 指数退避
        }
      }
    }
  }

  // 发送 webhook 请求
  async sendWebhookRequest(webhook, emailData, eventType) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'DomainMailServer/1.0',
      'X-Webhook-Event': eventType
    };

    // 添加自定义头部
    if (webhook.headers) {
      try {
        const customHeaders = JSON.parse(webhook.headers);
        Object.assign(headers, customHeaders);
      } catch (error) {
        console.warn('解析自定义头部失败:', error.message);
      }
    }

    // 构建webhook数据
    const webhookData = {
      event: eventType,
      timestamp: new Date().toISOString(),
      webhook: {
        id: webhook.id,
        name: webhook.name
      },
      email: {
        id: emailData.emailId || emailData.id,
        messageId: emailData.messageId,
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        date: emailData.date || emailData.received_at,
        size: emailData.size || emailData.size_bytes
      }
    };

    // 对于接收邮件事件，添加更多详情
    if (eventType === 'email_received') {
      webhookData.email.text = emailData.text || emailData.content_text;
      webhookData.email.html = emailData.html || emailData.content_html;
      webhookData.email.attachments = emailData.attachments ? 
        (typeof emailData.attachments === 'string' ? 
          JSON.parse(emailData.attachments) : emailData.attachments) : [];
    }

    const config = {
      method: webhook.method || 'POST',
      url: webhook.url,
      headers,
      data: webhookData,
      timeout: (webhook.timeout || 30) * 1000,
      validateStatus: (status) => status >= 200 && status < 300
    };

    return await axios(config);
  }

  // 记录 webhook 执行结果
  async logWebhookExecution(webhookId, emailId, eventType, logData) {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO webhook_logs (
          webhook_id, email_id, event_type, status, response_code, 
          response_body, error_message, attempt_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        webhookId,
        emailId,
        eventType,
        logData.status,
        logData.responseCode || null,
        logData.responseBody || null,
        logData.errorMessage || null,
        logData.attemptCount
      ], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });

      stmt.finalize();
      db.close();
    });
  }

  // 创建或更新 webhook 配置
  async saveWebhookConfig(webhookData) {
    const db = getDB();
    const { 
      id, name, url, method, headers, triggerEvents, 
      isActive, retryCount, timeout 
    } = webhookData;
    
    return new Promise((resolve, reject) => {
      if (id) {
        // 更新现有配置
        const stmt = db.prepare(`
          UPDATE webhook_configs SET 
            name = ?, url = ?, method = ?, headers = ?, trigger_events = ?,
            is_active = ?, retry_count = ?, timeout = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        
        stmt.run([
          name, url, method, headers, triggerEvents,
          isActive, retryCount, timeout, id
        ], function(err) {
          if (err) reject(err);
          else resolve({ id, updated: true });
        });
        
        stmt.finalize();
      } else {
        // 创建新配置
        const stmt = db.prepare(`
          INSERT INTO webhook_configs (
            name, url, method, headers, trigger_events,
            is_active, retry_count, timeout
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run([
          name, url, method, headers, triggerEvents,
          isActive, retryCount, timeout
        ], function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, created: true });
        });
        
        stmt.finalize();
      }
      
      db.close();
    });
  }

  // 获取 webhook 配置列表
  async getWebhookConfigs() {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM webhook_configs ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
        db.close();
      });
    });
  }

  // 删除 webhook 配置
  async deleteWebhookConfig(webhookId) {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM webhook_configs WHERE id = ?', [webhookId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ deleted: this.changes > 0 });
        }
        db.close();
      });
    });
  }

  // 测试 webhook
  async testWebhook(webhookId) {
    const db = getDB();
    
    try {
      // 获取 webhook 配置
      const webhook = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM webhook_configs WHERE id = ?', [webhookId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
        db.close();
      });

      if (!webhook) {
        throw new Error('Webhook 配置不存在');
      }

      // 构造测试数据
      const testData = {
        emailId: 'test',
        messageId: 'test-message-id',
        from: 'test@example.com',
        to: 'recipient@example.com',
        subject: 'Webhook 测试邮件',
        text: '这是一个 webhook 测试',
        date: new Date().toISOString(),
        size: 100
      };

      // 发送测试请求
      const response = await this.sendWebhookRequest(webhook, testData, 'test_event');
      
      return {
        success: true,
        statusCode: response.status,
        response: response.data,
        message: 'Webhook 测试成功'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        statusCode: error.response?.status || 0,
        message: 'Webhook 测试失败'
      };
    }
  }

  // 获取 webhook 执行日志
  async getWebhookLogs(webhookId = null, limit = 100) {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      let query = `
        SELECT wl.*, wc.name as webhook_name
        FROM webhook_logs wl
        LEFT JOIN webhook_configs wc ON wl.webhook_id = wc.id
      `;
      
      const params = [];
      if (webhookId) {
        query += ' WHERE wl.webhook_id = ?';
        params.push(webhookId);
      }
      
      query += ' ORDER BY wl.created_at DESC LIMIT ?';
      params.push(limit);
      
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
        db.close();
      });
    });
  }

  // 工具函数：延迟执行
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 创建单例实例
const webhookService = new WebhookService();

// 便捷函数
async function triggerWebhooks(eventType, emailId, emailData) {
  return await webhookService.triggerWebhooks(eventType, emailId, emailData);
}

module.exports = {
  webhookService,
  triggerWebhooks
}; 