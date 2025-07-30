const express = require('express');
const { getDB } = require('../database/init');
const { buildRawEmail, calculateEmailSize } = require('../utils/email-parser');
const nodemailer = require('nodemailer');

const router = express.Router();

// API身份验证中间件
function authenticateAPI(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: '缺少访问令牌',
      message: '请在请求头中添加 Authorization: Bearer YOUR_TOKEN'
    });
  }

  // 验证token
  const db = getDB();
  db.get(
    'SELECT config_value FROM system_config WHERE config_key = ?',
    ['admin_token'],
    (err, row) => {
      if (err) {
        console.error('验证token失败:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      if (!row || row.config_value !== token) {
        return res.status(403).json({ 
          error: '无效的访问令牌',
          message: '请检查您的API令牌是否正确'
        });
      }

      next();
    }
  );
  db.close();
}

// API文档
router.get('/docs', (req, res) => {
  res.json({
    title: 'Domain Mail Server API',
    version: '1.0.0',
    description: '自建域名邮件服务器API',
    endpoints: {
      'POST /api/send': {
        description: '发送邮件',
        headers: {
          'Authorization': 'Bearer YOUR_API_TOKEN',
          'Content-Type': 'application/json'
        },
        body: {
          from: 'string - 发件人邮箱（必须是本域名下的邮箱）',
          to: 'string|array - 收件人邮箱',
          cc: 'string - 抄送邮箱 (可选)',
          bcc: 'string - 密送邮箱 (可选)',
          subject: 'string - 邮件主题',
          text: 'string - 纯文本内容 (可选)',
          html: 'string - HTML内容 (可选)',
          attachments: 'array - 附件列表 (可选)'
        }
      },
      'POST /api/send/bulk': {
        description: '批量发送邮件',
        headers: {
          'Authorization': 'Bearer YOUR_API_TOKEN',
          'Content-Type': 'application/json'
        },
        body: {
          emails: 'array - 邮件列表，每个元素包含上述邮件字段'
        }
      },
      'GET /api/accounts': {
        description: '获取可用邮箱账户列表'
      },
      'GET /api/health': {
        description: '健康检查'
      }
    }
  });
});

// 验证邮箱账户
async function validateAccount(email) {
  const db = getDB();
  
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT ma.*, d.domain 
       FROM mail_accounts ma
       JOIN domains d ON ma.domain_id = d.id
       WHERE ma.email = ? AND ma.is_active = 1 AND d.is_active = 1`,
      [email],
      (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
        db.close();
      }
    );
  });
}

// 保存发送的邮件
async function saveOutgoingEmail(emailData) {
  const db = getDB();
  
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO emails (
        message_id, account_id, folder, from_address, to_addresses,
        cc_addresses, bcc_addresses, subject, content_text, content_html,
        attachments, size_bytes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      emailData.messageId,
      emailData.accountId,
      'Sent',
      emailData.from,
      JSON.stringify(Array.isArray(emailData.to) ? emailData.to : [emailData.to]),
      JSON.stringify(emailData.cc ? [emailData.cc] : []),
      JSON.stringify(emailData.bcc ? [emailData.bcc] : []),
      emailData.subject,
      emailData.text,
      emailData.html,
      JSON.stringify(emailData.attachments || []),
      emailData.size || 0
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
    
    stmt.finalize();
    db.close();
  });
}

// 通过本地SMTP发送邮件
async function sendEmailViaSMTP(emailData) {
  // 创建到本地SMTP服务器的连接
  const transporter = nodemailer.createTransporter({
    host: 'localhost',
    port: process.env.SMTP_PORT || 25,
    secure: false,
    auth: {
      user: emailData.from,
      pass: 'smtp-api-key' // 这里需要实现API密钥认证
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: emailData.from,
    to: Array.isArray(emailData.to) ? emailData.to.join(',') : emailData.to,
    subject: emailData.subject,
    text: emailData.text,
    html: emailData.html
  };

  if (emailData.cc) mailOptions.cc = emailData.cc;
  if (emailData.bcc) mailOptions.bcc = emailData.bcc;
  if (emailData.attachments && emailData.attachments.length > 0) {
    mailOptions.attachments = emailData.attachments;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    throw new Error(`SMTP发送失败: ${error.message}`);
  }
}

// 发送邮件
router.post('/send', authenticateAPI, async (req, res) => {
  try {
    const {
      from,
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      attachments
    } = req.body;

    // 参数验证
    if (!from || !to || !subject) {
      return res.status(400).json({
        error: '参数错误',
        message: 'from, to, subject 为必填参数'
      });
    }

    if (!text && !html) {
      return res.status(400).json({
        error: '参数错误',
        message: '必须提供 text 或 html 内容之一'
      });
    }

    // 验证发件人账户
    const account = await validateAccount(from);
    if (!account) {
      return res.status(400).json({
        error: '发件人验证失败',
        message: '发件人邮箱不存在或未激活'
      });
    }

    // 构建邮件数据
    const emailData = {
      from,
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      attachments,
      accountId: account.id,
      messageId: `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@${account.domain}>`
    };

    // 计算邮件大小
    emailData.size = calculateEmailSize(emailData);

    // 发送邮件
    const result = await sendEmailViaSMTP(emailData);
    
    // 保存到数据库
    const emailId = await saveOutgoingEmail(emailData);

    console.log(`✅ API邮件发送成功: ${result.messageId}`);

    res.json({
      success: true,
      message: '邮件发送成功',
      data: {
        emailId,
        messageId: result.messageId
      }
    });

  } catch (error) {
    console.error('API发送邮件失败:', error);
    res.status(500).json({
      error: '邮件发送失败',
      message: error.message
    });
  }
});

// 批量发送邮件
router.post('/send/bulk', authenticateAPI, async (req, res) => {
  try {
    const { emails } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        error: '参数错误',
        message: 'emails 必须是非空数组'
      });
    }

    // 验证每个邮件的参数
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      if (!email.from || !email.to || !email.subject) {
        return res.status(400).json({
          error: '参数错误',
          message: `邮件 ${i + 1}: from, to, subject 为必填参数`
        });
      }
      if (!email.text && !email.html) {
        return res.status(400).json({
          error: '参数错误',
          message: `邮件 ${i + 1}: 必须提供 text 或 html 内容之一`
        });
      }
    }

    const results = [];
    
    for (let i = 0; i < emails.length; i++) {
      try {
        const emailData = emails[i];
        
        // 验证发件人账户
        const account = await validateAccount(emailData.from);
        if (!account) {
          results.push({
            success: false,
            error: '发件人验证失败',
            index: i
          });
          continue;
        }

        // 构建邮件数据
        emailData.accountId = account.id;
        emailData.messageId = `<${Date.now()}.${Math.random().toString(36).substr(2, 9)}@${account.domain}>`;
        emailData.size = calculateEmailSize(emailData);

        // 发送邮件
        const result = await sendEmailViaSMTP(emailData);
        
        // 保存到数据库
        const emailId = await saveOutgoingEmail(emailData);

        results.push({
          success: true,
          emailId,
          messageId: result.messageId,
          index: i
        });
        
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          index: i
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    res.json({
      success: true,
      message: `批量发送完成: ${successCount} 成功, ${failCount} 失败`,
      data: {
        total: results.length,
        success: successCount,
        failed: failCount,
        results: results
      }
    });

  } catch (error) {
    console.error('API批量发送邮件失败:', error);
    res.status(500).json({
      error: '批量邮件发送失败',
      message: error.message
    });
  }
});

// 获取可用邮箱账户列表
router.get('/accounts', authenticateAPI, (req, res) => {
  const db = getDB();
  
  db.all(
    `SELECT ma.id, ma.email, d.domain, ma.is_active
     FROM mail_accounts ma
     JOIN domains d ON ma.domain_id = d.id
     WHERE ma.is_active = 1 AND d.is_active = 1
     ORDER BY ma.email`,
    [],
    (err, rows) => {
      if (err) {
        console.error('获取账户列表失败:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      res.json({
        success: true,
        data: rows
      });
    }
  );
  db.close();
});

// 获取域名列表
router.get('/domains', authenticateAPI, (req, res) => {
  const db = getDB();
  
  db.all(
    'SELECT domain, mx_record, is_active FROM domains WHERE is_active = 1',
    [],
    (err, rows) => {
      if (err) {
        console.error('获取域名列表失败:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      res.json({
        success: true,
        data: rows
      });
    }
  );
  db.close();
});

// 获取邮件发送统计
router.get('/stats', authenticateAPI, async (req, res) => {
  try {
    const { from = '', days = 7 } = req.query;
    const db = getDB();
    
    const stats = await new Promise((resolve, reject) => {
      let query = `
        SELECT 
          DATE(received_at) as date,
          COUNT(*) as count
        FROM emails 
        WHERE folder = 'Sent' AND received_at >= datetime('now', '-${parseInt(days)} days')
      `;
      
      const params = [];
      if (from) {
        query += ' AND from_address = ?';
        params.push(from);
      }
      
      query += ' GROUP BY DATE(received_at) ORDER BY date DESC';
      
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
        db.close();
      });
    });
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({
      error: '获取统计失败',
      message: error.message
    });
  }
});

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Domain Mail Server API',
    timestamp: new Date().toISOString(),
    services: {
      smtp: process.env.SMTP_STATUS || 'unknown',
      imap: process.env.IMAP_STATUS || 'unknown'
    }
  });
});

module.exports = router; 