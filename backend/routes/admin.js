const express = require('express');
const { getDB } = require('../database/init');
const bcrypt = require('bcryptjs');
const { webhookService } = require('../services/webhookService');

const router = express.Router();

// 管理员身份验证中间件
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

// ============ 域名管理 ============

// 获取所有域名
router.get('/domains', (req, res) => {
  const db = getDB();
  
  db.all('SELECT * FROM domains ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      console.error('获取域名列表失败:', err);
      return res.status(500).json({ error: '服务器错误' });
    }

    res.json({
      success: true,
      data: rows
    });
  });
  db.close();
});

// 添加域名
router.post('/domains', (req, res) => {
  const { domain, mxRecord, spfRecord } = req.body;

  if (!domain) {
    return res.status(400).json({
      error: '参数错误',
      message: '域名为必填项'
    });
  }

  const db = getDB();
  const stmt = db.prepare(`
    INSERT INTO domains (domain, mx_record, spf_record) 
    VALUES (?, ?, ?)
  `);

  stmt.run([domain, mxRecord || domain, spfRecord], function(err) {
    if (err) {
      console.error('添加域名失败:', err);
      
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(400).json({ error: '域名已存在' });
      }
      
      return res.status(500).json({ error: '添加域名失败' });
    }

    res.json({
      success: true,
      message: '域名添加成功',
      data: { id: this.lastID }
    });
  });

  stmt.finalize();
  db.close();
});

// 更新域名
router.put('/domains/:id', (req, res) => {
  const { id } = req.params;
  const { domain, mxRecord, spfRecord, isActive } = req.body;

  const db = getDB();
  
  db.run(
    `UPDATE domains SET 
     domain = ?, mx_record = ?, spf_record = ?, is_active = ?,
     updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [domain, mxRecord, spfRecord, isActive ? 1 : 0, id],
    function(err) {
      if (err) {
        console.error('更新域名失败:', err);
        return res.status(500).json({ error: '更新域名失败' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '域名不存在' });
      }

      res.json({
        success: true,
        message: '域名更新成功'
      });
    }
  );

  db.close();
});

// 删除域名
router.delete('/domains/:id', (req, res) => {
  const { id } = req.params;
  const db = getDB();

  // 检查是否有邮箱账户使用此域名
  db.get('SELECT COUNT(*) as count FROM mail_accounts WHERE domain_id = ?', [id], (err, row) => {
    if (err) {
      console.error('检查域名使用情况失败:', err);
      return res.status(500).json({ error: '服务器错误' });
    }

    if (row.count > 0) {
      return res.status(400).json({ error: '该域名下还有邮箱账户，无法删除' });
    }

    db.run('DELETE FROM domains WHERE id = ?', [id], function(err) {
      if (err) {
        console.error('删除域名失败:', err);
        return res.status(500).json({ error: '删除域名失败' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: '域名不存在' });
      }

      res.json({
        success: true,
        message: '域名删除成功'
      });
    });
  });

  db.close();
});

// ============ 邮箱账户管理 ============

// 获取所有邮箱账户
router.get('/accounts', (req, res) => {
  const db = getDB();
  
  db.all(
    `SELECT ma.*, d.domain 
     FROM mail_accounts ma
     LEFT JOIN domains d ON ma.domain_id = d.id
     ORDER BY ma.created_at DESC`, 
    [], 
    (err, rows) => {
      if (err) {
        console.error('获取账户列表失败:', err);
        return res.status(500).json({ error: '服务器错误' });
      }

      // 隐藏密码信息
      const accounts = rows.map(account => ({
        ...account,
        password_hash: '***'
      }));

      res.json({
        success: true,
        data: accounts
      });
    }
  );
  db.close();
});

// 创建邮箱账户
router.post('/accounts', (req, res) => {
  const {
    email,
    password,
    displayName,
    domainId,
    quotaMb = 1000,
    isActive = true,
    isAdmin = false
  } = req.body;

  // 参数验证
  if (!email || !password || !domainId) {
    return res.status(400).json({
      error: '参数错误',
      message: 'email, password, domainId 为必填参数'
    });
  }

  // 提取用户名
  const username = email.split('@')[0];
  
  // 密码加密
  const passwordHash = bcrypt.hashSync(password, 10);

  const db = getDB();
  
  db.serialize(() => {
    // 创建账户
    const stmt = db.prepare(`
      INSERT INTO mail_accounts (
        email, username, domain_id, password_hash, display_name,
        quota_mb, is_active, is_admin
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      email, username, domainId, passwordHash, displayName,
      quotaMb, isActive ? 1 : 0, isAdmin ? 1 : 0
    ], function(err) {
      if (err) {
        console.error('创建账户失败:', err);
        
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ error: '邮箱地址已存在' });
        }
        
        return res.status(500).json({ error: '创建账户失败' });
      }

      const accountId = this.lastID;

      // 创建默认文件夹
      const folderStmt = db.prepare(`
        INSERT INTO mail_folders (account_id, name, type) VALUES (?, ?, ?)
      `);

      const defaultFolders = [
        ['INBOX', 'inbox'],
        ['Sent', 'sent'],
        ['Drafts', 'drafts'],
        ['Trash', 'trash'],
        ['Spam', 'spam']
      ];

      for (const [name, type] of defaultFolders) {
        folderStmt.run([accountId, name, type]);
      }

      folderStmt.finalize();

      res.json({
        success: true,
        message: '邮箱账户创建成功',
        data: { id: accountId }
      });
    });

    stmt.finalize();
  });

  db.close();
});

// 更新邮箱账户
router.put('/accounts/:id', (req, res) => {
  const { id } = req.params;
  const {
    email,
    password,
    displayName,
    quotaMb,
    isActive,
    isAdmin
  } = req.body;

  const db = getDB();
  
  // 构建更新字段
  const updates = [];
  const params = [];
  
  if (email !== undefined) {
    updates.push('email = ?');
    params.push(email);
    
    // 同时更新用户名
    updates.push('username = ?');
    params.push(email.split('@')[0]);
  }
  
  if (password !== undefined && password !== '***' && password.length >= 6) {
    updates.push('password_hash = ?');
    params.push(bcrypt.hashSync(password, 10));
  }
  
  if (displayName !== undefined) {
    updates.push('display_name = ?');
    params.push(displayName);
  }
  
  if (quotaMb !== undefined) {
    updates.push('quota_mb = ?');
    params.push(parseInt(quotaMb));
  }
  
  if (isActive !== undefined) {
    updates.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }
  
  if (isAdmin !== undefined) {
    updates.push('is_admin = ?');
    params.push(isAdmin ? 1 : 0);
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

// 删除邮箱账户
router.delete('/accounts/:id', (req, res) => {
  const { id } = req.params;
  const db = getDB();

  db.serialize(() => {
    // 删除相关数据
    db.run('DELETE FROM mail_folders WHERE account_id = ?', [id]);
    db.run('DELETE FROM mail_aliases WHERE target_account_id = ?', [id]);
    db.run('DELETE FROM mail_forwarding WHERE account_id = ?', [id]);
    db.run('UPDATE emails SET is_deleted = 1 WHERE account_id = ?', [id]);
    
    // 删除账户
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
  });

  db.close();
});

// ============ 邮件管理 ============

// 获取邮件列表
router.get('/emails', (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    accountId = '',
    folder = '',
    search = ''
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const db = getDB();

  // 构建查询条件
  let whereConditions = ['e.is_deleted = 0'];
  let params = [];

  if (accountId) {
    whereConditions.push('e.account_id = ?');
    params.push(accountId);
  }
  
  if (folder) {
    whereConditions.push('e.folder = ?');
    params.push(folder);
  }
  
  if (search) {
    whereConditions.push('(e.subject LIKE ? OR e.from_address LIKE ? OR e.to_addresses LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = 'WHERE ' + whereConditions.join(' AND ');

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
      ORDER BY e.received_at DESC
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
        to_addresses: JSON.parse(email.to_addresses || '[]'),
        cc_addresses: JSON.parse(email.cc_addresses || '[]'),
        bcc_addresses: JSON.parse(email.bcc_addresses || '[]'),
        attachments: JSON.parse(email.attachments || '[]')
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

      // 处理JSON字段
      const email = {
        ...row,
        to_addresses: JSON.parse(row.to_addresses || '[]'),
        cc_addresses: JSON.parse(row.cc_addresses || '[]'),
        bcc_addresses: JSON.parse(row.bcc_addresses || '[]'),
        attachments: JSON.parse(row.attachments || '[]')
      };

      res.json({
        success: true,
        data: email
      });
    }
  );
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
      triggerEvents = 'email_received',
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
      triggerEvents,
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

// ============ 系统统计 ============

// 获取系统统计
router.get('/stats', async (req, res) => {
  try {
    const db = getDB();
    
    const stats = await new Promise((resolve, reject) => {
      db.serialize(() => {
        const results = {};
        
        // 域名统计
        db.get('SELECT COUNT(*) as total FROM domains', [], (err, row) => {
          if (err) reject(err);
          else results.totalDomains = row.total;
        });
        
        // 邮箱账户统计
        db.get('SELECT COUNT(*) as total FROM mail_accounts', [], (err, row) => {
          if (err) reject(err);
          else results.totalAccounts = row.total;
        });
        
        // 活跃账户统计
        db.get('SELECT COUNT(*) as total FROM mail_accounts WHERE is_active = 1', [], (err, row) => {
          if (err) reject(err);
          else results.activeAccounts = row.total;
        });
        
        // 邮件总数统计
        db.get('SELECT COUNT(*) as total FROM emails WHERE is_deleted = 0', [], (err, row) => {
          if (err) reject(err);
          else results.totalEmails = row.total;
        });
        
        // 今日邮件统计
        db.get(`SELECT COUNT(*) as total FROM emails 
                WHERE DATE(received_at) = DATE('now') AND is_deleted = 0`, [], (err, row) => {
          if (err) reject(err);
          else results.todayEmails = row.total;
        });
        
        // Webhook数量
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

// 获取服务器日志
router.get('/logs', (req, res) => {
  const { limit = 100, level = '', service = '' } = req.query;
  const db = getDB();
  
  let whereConditions = [];
  let params = [];

  if (level) {
    whereConditions.push('level = ?');
    params.push(level);
  }
  
  if (service) {
    whereConditions.push('service = ?');
    params.push(service);
  }

  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  
  db.all(
    `SELECT * FROM server_logs ${whereClause} ORDER BY created_at DESC LIMIT ?`,
    [...params, parseInt(limit)],
    (err, rows) => {
      if (err) {
        console.error('获取服务器日志失败:', err);
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

module.exports = router; 