const Imap = require('imap');
const { simpleParser } = require('mailparser');
const { getDB } = require('../database/init');
const webhookService = require('./webhookService');

class EmailReceiver {
  constructor() {
    this.connections = new Map();
    this.isRunning = false;
  }

  // 启动邮件监听服务
  async startEmailListener() {
    if (this.isRunning) {
      console.log('邮件监听服务已在运行');
      return;
    }

    this.isRunning = true;
    console.log('🔄 启动邮件监听服务...');

    try {
      const accounts = await this.getActiveAccounts();
      
      for (const account of accounts) {
        await this.connectToAccount(account);
      }
      
      console.log(`✅ 邮件监听服务启动完成，监听 ${accounts.length} 个账户`);
    } catch (error) {
      console.error('❌ 邮件监听服务启动失败:', error);
      this.isRunning = false;
      throw error;
    }
  }

  // 获取活跃的邮件账户
  async getActiveAccounts() {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM mail_accounts WHERE is_active = 1',
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

  // 连接到邮件账户
  async connectToAccount(account) {
    const imapConfig = {
      user: account.email,
      password: account.password,
      host: account.imap_host,
      port: account.imap_port,
      tls: account.use_ssl,
      tlsOptions: { rejectUnauthorized: false }
    };

    const imap = new Imap(imapConfig);
    
    return new Promise((resolve, reject) => {
      imap.once('ready', () => {
        console.log(`📬 已连接到邮箱: ${account.email}`);
        
        // 监听新邮件
        this.setupEmailListener(imap, account);
        
        this.connections.set(account.id, imap);
        resolve();
      });

      imap.once('error', (err) => {
        console.error(`❌ 连接邮箱失败 ${account.email}:`, err);
        reject(err);
      });

      imap.once('end', () => {
        console.log(`📪 邮箱连接断开: ${account.email}`);
        this.connections.delete(account.id);
      });

      imap.connect();
    });
  }

  // 设置邮件监听器
  setupEmailListener(imap, account) {
    imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error(`打开收件箱失败 ${account.email}:`, err);
        return;
      }

      console.log(`📥 开始监听收件箱: ${account.email}`);

      // 监听新邮件
      imap.on('mail', (numNewMsgs) => {
        console.log(`📩 收到 ${numNewMsgs} 封新邮件 - ${account.email}`);
        this.fetchNewEmails(imap, account, numNewMsgs);
      });

      // 获取最近的未读邮件
      this.fetchRecentEmails(imap, account);
    });
  }

  // 获取最近的邮件
  fetchRecentEmails(imap, account, days = 1) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    imap.search(['UNSEEN', ['SINCE', since]], (err, results) => {
      if (err) {
        console.error('搜索邮件失败:', err);
        return;
      }

      if (results.length > 0) {
        console.log(`发现 ${results.length} 封未读邮件 - ${account.email}`);
        this.processEmails(imap, account, results);
      }
    });
  }

  // 获取新邮件
  fetchNewEmails(imap, account, count) {
    imap.search(['UNSEEN'], (err, results) => {
      if (err) {
        console.error('获取新邮件失败:', err);
        return;
      }

      if (results.length > 0) {
        // 只处理最新的邮件
        const newResults = results.slice(-count);
        this.processEmails(imap, account, newResults);
      }
    });
  }

  // 处理邮件
  processEmails(imap, account, messageIds) {
    if (messageIds.length === 0) return;

    const fetch = imap.fetch(messageIds, { bodies: '', markSeen: true });

    fetch.on('message', (msg, seqno) => {
      let emailData = '';

      msg.on('body', (stream, info) => {
        stream.on('data', (chunk) => {
          emailData += chunk.toString('utf8');
        });

        stream.once('end', async () => {
          try {
            const parsed = await simpleParser(emailData);
            await this.saveEmail(account, parsed);
          } catch (error) {
            console.error('解析邮件失败:', error);
          }
        });
      });

      msg.once('attributes', (attrs) => {
        // 可以获取邮件属性，如日期、标志等
      });

      msg.once('end', () => {
        console.log(`邮件处理完成 #${seqno}`);
      });
    });

    fetch.once('error', (err) => {
      console.error('获取邮件失败:', err);
    });
  }

  // 保存邮件到数据库
  async saveEmail(account, parsed) {
    const db = getDB();
    
    try {
      // 检查邮件是否已存在
      const existing = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM emails WHERE message_id = ?',
          [parsed.messageId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (existing) {
        console.log(`邮件已存在，跳过: ${parsed.messageId}`);
        db.close();
        return;
      }

      // 处理附件
      const attachments = parsed.attachments ? parsed.attachments.map(att => ({
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        content: att.content ? att.content.toString('base64') : null
      })) : [];

      // 保存邮件
      const emailId = await new Promise((resolve, reject) => {
        const stmt = db.prepare(`
          INSERT INTO emails (
            message_id, account_id, direction, from_address, to_address,
            cc_address, bcc_address, subject, content, html_content,
            attachments, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run([
          parsed.messageId,
          account.id,
          'incoming',
          parsed.from?.text || '',
          parsed.to?.text || '',
          parsed.cc?.text || '',
          parsed.bcc?.text || '',
          parsed.subject || '',
          parsed.text || '',
          parsed.html || '',
          JSON.stringify(attachments),
          'received'
        ], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });

        stmt.finalize();
      });

      console.log(`✅ 邮件已保存: ${parsed.subject} (ID: ${emailId})`);

      // 触发 webhook
      await this.triggerWebhooks(emailId, parsed, account);

    } catch (error) {
      console.error('保存邮件失败:', error);
    } finally {
      db.close();
    }
  }

  // 触发 webhooks
  async triggerWebhooks(emailId, emailData, account) {
    try {
      const webhookData = {
        emailId,
        messageId: emailData.messageId,
        account: {
          id: account.id,
          email: account.email
        },
        from: emailData.from,
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
        date: emailData.date,
        attachments: emailData.attachments ? emailData.attachments.map(att => ({
          filename: att.filename,
          contentType: att.contentType,
          size: att.size
        })) : [],
        timestamp: new Date().toISOString()
      };

      await webhookService.executeWebhooks(emailId, webhookData);
    } catch (error) {
      console.error('触发 webhook 失败:', error);
    }
  }

  // 停止邮件监听服务
  async stopEmailListener() {
    console.log('🛑 停止邮件监听服务...');
    
    for (const [accountId, imap] of this.connections) {
      try {
        imap.end();
      } catch (error) {
        console.error(`关闭连接失败 (账户 ${accountId}):`, error);
      }
    }
    
    this.connections.clear();
    this.isRunning = false;
    console.log('✅ 邮件监听服务已停止');
  }

  // 重新加载账户连接
  async reloadConnections() {
    await this.stopEmailListener();
    await this.startEmailListener();
  }
}

// 启动邮件监听服务的便捷函数
async function startEmailListener() {
  const receiver = new EmailReceiver();
  await receiver.startEmailListener();
  return receiver;
}

module.exports = {
  EmailReceiver,
  startEmailListener
}; 