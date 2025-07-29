const express = require('express');
const { getDB } = require('../database/init');
const emailSender = require('../services/emailSender');
const webhookService = require('../services/webhookService');

const router = express.Router();

// 简单的管理员身份验证中间件
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: '需要管理员权限',
      message: '请提供管理员令牌'
    });
  }

  // 验证管理员token
  const db = getDB();
  db.get(
    'SELECT config_value FROM system_config WHERE config_key = ?',
    ['admin_token'],
    (err, row) => {
      if (err) {
        console.error('验证管理员token失败:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      if (!row || row.config_value !== token) {
        return res.status(403).json({ 
          error: '无效的管理员令牌'
        });
      }

      next();
    }
  );
  db.close();
}

// 应用身份验证中间件到所有管理端路由
router.use(authenticateAdmin);

// ============ 邮件管理 ============

// 获取所有邮件列表
router.get('/emails', (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    direction = '',
    status = '',
    accountId = '',
    search = ''
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const db = getDB();

  // 构建查询条件
  let whereConditions = [];
  let params = [];

  if (direction) {
    whereConditions.push('e.direction = ?');
    params.push(direction);
  }
  if (status) {
    whereConditions.push('e.status = ?');
    params.push(status);
  }
  if (accountId) {
    whereConditions.push('e.account_id = ?');
    params.push(accountId);
  }
  if (search) {
    whereConditions.push('(e.subject LIKE ? OR e.from_address LIKE ? OR e.to_address LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

  // 获取总数
  const countQuery = `
    SELECT COUNT(*) as total 
    FROM emails e 
    LEFT JOIN mail_accounts ma ON e.account_id = ma.id 
    ${whereClause}
  `;

  db.get(countQuery, params, (err, countResult) => {
    if (err) {
      console.error('获取邮件总数失败:', err);
      return res.status(500).json({ error: '服务器错误' });
    }

    // 获取邮件列表
    const listQuery = `
      SELECT 
        e.*,
        ma.email as account_email
      FROM emails e
      LEFT JOIN mail_accounts ma ON e.account_id = ma.id
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), offset);

    db.all(listQuery, params, (err, rows) => {
      if (err) {
        console.error('获取邮件列表失败:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      // 处理附件信息
      const emails = rows.map(email => ({
        ...email,
        attachments: email.attachments ? JSON.parse(email.attachments) : []
      }));

      res.json({
        success: true,
        data: {
          emails,
          pagination: {
            current: parseInt(page),
            total: Math.ceil(countResult.total / parseInt(limit)),
            count: countResult.total,
            limit: parseInt(limit)
          }
        }
      });
    });
  });

  db.close();
});

// 获取单个邮件详情
router.get('/emails/:id', (req, res) => {
  const { id } = req.params;
  const db = getDB();

  db.get(
    `SELECT 
      e.*,
      ma.email as account_email
    FROM emails e
    LEFT JOIN mail_accounts ma ON e.account_id = ma.id
    WHERE e.id = ?`,
    [id],
    (err, row) => {
      if (err) {
        console.error('获取邮件详情失败:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      if (!row) {
        return res.status(404).json({ error: '邮件不存在' });
      }

      // 处理附件信息
      const email = {
        ...row,
        attachments: row.attachments ? JSON.parse(row.attachments) : []
      };

      res.json({
        success: true,
        data: email
      });
    }
  );
  db.close();
});

// ============ 邮件账户管理 ============

// 获取所有邮件账户
router.get('/accounts', (req, res) => {
  const db = getDB();
  
  db.all('SELECT * FROM mail_accounts ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      console.error('获取账户列表失败:', err);
      return res.status(500).json({ error: '服务器错误' });
    }

    // 隐藏密码信息
    const accounts = rows.map(account => ({
      ...account,
      password: '***'
    }));

    res.json({
      success: true,
      data: accounts
    });
  });
  db.close();
});

// 创建邮件账户
router.post('/accounts', (req, res) => {
  const {
    email,
    password,
    smtpHost,
    smtpPort,
    imapHost,
    imapPort,
    useSsl = true,
    isActive = true
  } = req.body;

  // 参数验证
  if (!email || !password || !smtpHost || !smtpPort || !imapHost || !imapPort) {
    return res.status(400).json({
      error: '参数错误',
      message: '所有字段都是必填的'
    });
  }

  const db = getDB();
  const stmt = db.prepare(`
    INSERT INTO mail_accounts (
      email, password, smtp_host, smtp_port, 
      imap_host, imap_port, use_ssl, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    email, password, smtpHost, parseInt(smtpPort),
    imapHost, parseInt(imapPort), useSsl ? 1 : 0, isActive ? 1 : 0
  ], function(err) {
    if (err) {
      console.error('创建账户失败:', err);
      
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: '邮箱地址已存在' });
      }
      
      return res.status(500).json({ error: '创建账户失败' });
    }

    res.json({
      success: true,
      message: '账户创建成功',
      data: { id: this.lastID }
    });
  });

  stmt.finalize();
  db.close();
});

// 更新邮件账户
router.put('/accounts/:id', (req, res) => {
  const { id } = req.params;
  const {
    email,
    password,
    smtpHost,
    smtpPort,
    imapHost,
    imapPort,
    useSsl,
    isActive
  } = req.body;

  const db = getDB();
  
  // 构建更新字段
  const updates = [];
  const params = [];
  
  if (email !== undefined) {
    updates.push('email = ?');
    params.push(email);
  }
  if (password !== undefined && password !== '***') {
    updates.push('password = ?');
    params.push(password);
  }
  if (smtpHost !== undefined) {
    updates.push('smtp_host = ?');
    params.push(smtpHost);
  }
  if (smtpPort !== undefined) {
    updates.push('smtp_port = ?');
    params.push(parseInt(smtpPort));
  }
  if (imapHost !== undefined) {
    updates.push('imap_host = ?');
    params.push(imapHost);
  }
  if (imapPort !== undefined) {
    updates.push('imap_port = ?');
    params.push(parseInt(imapPort));
  }
  if (useSsl !== undefined) {
    updates.push('use_ssl = ?');
    params.push(useSsl ? 1 : 0);
  }
  if (isActive !== undefined) {
    updates.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }
  
  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  const query = `UPDATE mail_accounts SET ${updates.join(', ')} WHERE id = ?`;

  db.run(query, params, function(err) {
    if (err) {
      console.error('更新账户失败:', err);
      return res.status(500).json({ error: '更新账户失败' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: '账户不存在' });
    }

    res.json({
      success: true,
      message: '账户更新成功'
    });
  });

  db.close();
});

// 删除邮件账户
router.delete('/accounts/:id', (req, res) => {
  const { id } = req.params;
  const db = getDB();

  db.run('DELETE FROM mail_accounts WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('删除账户失败:', err);
      return res.status(500).json({ error: '删除账户失败' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: '账户不存在' });
    }

    res.json({
      success: true,
      message: '账户删除成功'
    });
  });

  db.close();
});

// ============ Webhook 管理 ============

// 获取 webhook 配置列表
router.get('/webhooks', async (req, res) => {
  try {
    const webhooks = await webhookService.getWebhookConfigs();
    
    res.json({
      success: true,
      data: webhooks
    });
  } catch (error) {
    console.error('获取 webhook 配置失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建 webhook 配置
router.post('/webhooks', async (req, res) => {
  try {
    const {
      name,
      url,
      method = 'POST',
      headers = '',
      isActive = true,
      retryCount = 3,
      timeout = 30
    } = req.body;

    if (!name || !url) {
      return res.status(400).json({
        error: '参数错误',
        message: 'name 和 url 为必填参数'
      });
    }

    const result = await webhookService.saveWebhookConfig({
      name,
      url,
      method,
      headers,
      isActive,
      retryCount,
      timeout
    });

    res.json({
      success: true,
      message: 'Webhook 配置创建成功',
      data: result
    });
  } catch (error) {
    console.error('创建 webhook 配置失败:', error);
    res.status(500).json({ error: '创建失败' });
  }
});

// 更新 webhook 配置
router.put('/webhooks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const webhookData = { id: parseInt(id), ...req.body };

    const result = await webhookService.saveWebhookConfig(webhookData);

    res.json({
      success: true,
      message: 'Webhook 配置更新成功',
      data: result
    });
  } catch (error) {
    console.error('更新 webhook 配置失败:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除 webhook 配置
router.delete('/webhooks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await webhookService.deleteWebhookConfig(parseInt(id));

    if (!result.deleted) {
      return res.status(404).json({ error: 'Webhook 配置不存在' });
    }

    res.json({
      success: true,
      message: 'Webhook 配置删除成功'
    });
  } catch (error) {
    console.error('删除 webhook 配置失败:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

// 测试 webhook
router.post('/webhooks/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await webhookService.testWebhook(parseInt(id));

    res.json({
      success: result.success,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('测试 webhook 失败:', error);
    res.status(500).json({ error: '测试失败' });
  }
});

// 获取 webhook 执行日志
router.get('/webhooks/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;
    
    const logs = await webhookService.getWebhookLogs(parseInt(id), parseInt(limit));

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('获取 webhook 日志失败:', error);
    res.status(500).json({ error: '获取日志失败' });
  }
});

// 获取所有 webhook 日志
router.get('/webhook-logs', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const logs = await webhookService.getWebhookLogs(null, parseInt(limit));

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('获取 webhook 日志失败:', error);
    res.status(500).json({ error: '获取日志失败' });
  }
});

// ============ 统计信息 ============

// 获取系统统计
router.get('/stats', async (req, res) => {
  try {
    const db = getDB();
    
    const stats = await new Promise((resolve, reject) => {
      db.serialize(() => {
        const results = {};
        
        // 邮件总数统计
        db.get('SELECT COUNT(*) as total FROM emails', [], (err, row) => {
          if (err) reject(err);
          else results.totalEmails = row.total;
        });
        
        // 发送邮件统计
        db.get('SELECT COUNT(*) as total FROM emails WHERE direction = "outgoing"', [], (err, row) => {
          if (err) reject(err);
          else results.sentEmails = row.total;
        });
        
        // 接收邮件统计
        db.get('SELECT COUNT(*) as total FROM emails WHERE direction = "incoming"', [], (err, row) => {
          if (err) reject(err);
          else results.receivedEmails = row.total;
        });
        
        // 账户数量
        db.get('SELECT COUNT(*) as total FROM mail_accounts', [], (err, row) => {
          if (err) reject(err);
          else results.totalAccounts = row.total;
        });
        
        // 活跃账户数量
        db.get('SELECT COUNT(*) as total FROM mail_accounts WHERE is_active = 1', [], (err, row) => {
          if (err) reject(err);
          else results.activeAccounts = row.total;
        });
        
        // Webhook 数量
        db.get('SELECT COUNT(*) as total FROM webhook_configs', [], (err, row) => {
          if (err) reject(err);
          else {
            results.totalWebhooks = row.total;
            resolve(results);
          }
        });
      });
    });
    
    db.close();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({ error: '获取统计失败' });
  }
});

module.exports = router; 