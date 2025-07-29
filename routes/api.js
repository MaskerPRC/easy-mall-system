const express = require('express');
const emailSender = require('../services/emailSender');
const { getDB } = require('../database/init');

const router = express.Router();

// API文档
router.get('/docs', (req, res) => {
  res.json({
    title: 'Easy Mail System API',
    version: '1.0.0',
    description: '简易邮件系统公开API',
    endpoints: {
      'POST /api/send': {
        description: '发送邮件',
        headers: {
          'Authorization': 'Bearer YOUR_API_TOKEN',
          'Content-Type': 'application/json'
        },
        body: {
          accountId: 'number - 邮件账户ID',
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
      'GET /api/health': {
        description: '健康检查'
      }
    }
  });
});

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

// 发送邮件
router.post('/send', authenticateAPI, async (req, res) => {
  try {
    const {
      accountId,
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      attachments
    } = req.body;

    // 参数验证
    if (!accountId || !to || !subject) {
      return res.status(400).json({
        error: '参数错误',
        message: 'accountId, to, subject 为必填参数'
      });
    }

    if (!text && !html) {
      return res.status(400).json({
        error: '参数错误',
        message: '必须提供 text 或 html 内容之一'
      });
    }

    // 发送邮件
    const result = await emailSender.sendEmail({
      accountId,
      to,
      cc,
      bcc,
      subject,
      text,
      html,
      attachments
    });

    res.json({
      success: true,
      message: '邮件发送成功',
      data: {
        emailId: result.emailId,
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
      if (!email.accountId || !email.to || !email.subject) {
        return res.status(400).json({
          error: '参数错误',
          message: `邮件 ${i + 1}: accountId, to, subject 为必填参数`
        });
      }
      if (!email.text && !email.html) {
        return res.status(400).json({
          error: '参数错误',
          message: `邮件 ${i + 1}: 必须提供 text 或 html 内容之一`
        });
      }
    }

    // 批量发送
    const results = await emailSender.sendBulkEmails(emails);

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

// 获取邮件账户列表（仅返回基本信息）
router.get('/accounts', authenticateAPI, (req, res) => {
  const db = getDB();
  
  db.all(
    'SELECT id, email, smtp_host, is_active FROM mail_accounts WHERE is_active = 1',
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

// 获取发送统计
router.get('/stats', authenticateAPI, async (req, res) => {
  try {
    const { accountId, days = 7 } = req.query;
    
    const stats = await emailSender.getEmailStats(accountId ? parseInt(accountId) : null);
    
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
    service: 'Easy Mail System API',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 