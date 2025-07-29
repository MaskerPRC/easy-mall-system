const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'mail_server.db');

// 确保数据目录存在
function ensureDataDir() {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// 创建数据库连接
function createConnection() {
  ensureDataDir();
  return new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('数据库连接失败:', err.message);
      throw err;
    }
  });
}

// 初始化数据库表
async function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = createConnection();
    
    db.serialize(() => {
      // 域名配置表
      db.run(`
        CREATE TABLE IF NOT EXISTS domains (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          domain VARCHAR(255) UNIQUE NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          mx_record VARCHAR(255),
          spf_record TEXT,
          dkim_enabled BOOLEAN DEFAULT 0,
          dkim_selector VARCHAR(100),
          dkim_private_key TEXT,
          dkim_public_key TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 邮箱账户表
      db.run(`
        CREATE TABLE IF NOT EXISTS mail_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email VARCHAR(255) UNIQUE NOT NULL,
          username VARCHAR(255) NOT NULL,
          domain_id INTEGER NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          display_name VARCHAR(255),
          quota_mb INTEGER DEFAULT 1000,
          used_mb INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT 1,
          is_admin BOOLEAN DEFAULT 0,
          last_login DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (domain_id) REFERENCES domains (id)
        )
      `);

      // 邮件存储表
      db.run(`
        CREATE TABLE IF NOT EXISTS emails (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id VARCHAR(255) UNIQUE NOT NULL,
          account_id INTEGER,
          folder VARCHAR(100) DEFAULT 'INBOX',
          from_address VARCHAR(255) NOT NULL,
          to_addresses TEXT NOT NULL,
          cc_addresses TEXT,
          bcc_addresses TEXT,
          subject TEXT,
          content_text TEXT,
          content_html TEXT,
          attachments TEXT,
          size_bytes INTEGER DEFAULT 0,
          is_read BOOLEAN DEFAULT 0,
          is_deleted BOOLEAN DEFAULT 0,
          is_flagged BOOLEAN DEFAULT 0,
          received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES mail_accounts (id)
        )
      `);

      // 邮件文件夹表
      db.run(`
        CREATE TABLE IF NOT EXISTS mail_folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          name VARCHAR(255) NOT NULL,
          type ENUM('inbox', 'sent', 'drafts', 'trash', 'spam', 'custom') DEFAULT 'custom',
          parent_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES mail_accounts (id),
          FOREIGN KEY (parent_id) REFERENCES mail_folders (id),
          UNIQUE(account_id, name)
        )
      `);

      // 邮件别名表
      db.run(`
        CREATE TABLE IF NOT EXISTS mail_aliases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alias_email VARCHAR(255) UNIQUE NOT NULL,
          target_account_id INTEGER NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (target_account_id) REFERENCES mail_accounts (id)
        )
      `);

      // 邮件转发规则表
      db.run(`
        CREATE TABLE IF NOT EXISTS mail_forwarding (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          account_id INTEGER NOT NULL,
          condition_type ENUM('from', 'to', 'subject', 'content') NOT NULL,
          condition_value TEXT NOT NULL,
          action_type ENUM('forward', 'copy', 'delete', 'move') NOT NULL,
          action_value TEXT,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES mail_accounts (id)
        )
      `);

      // Webhook配置表
      db.run(`
        CREATE TABLE IF NOT EXISTS webhook_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(255) NOT NULL,
          url VARCHAR(500) NOT NULL,
          method ENUM('POST', 'PUT') DEFAULT 'POST',
          headers TEXT,
          trigger_events TEXT NOT NULL,
          is_active BOOLEAN DEFAULT 1,
          retry_count INTEGER DEFAULT 3,
          timeout INTEGER DEFAULT 30,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Webhook日志表
      db.run(`
        CREATE TABLE IF NOT EXISTS webhook_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          webhook_id INTEGER,
          email_id INTEGER,
          event_type VARCHAR(100),
          status ENUM('success', 'failed') NOT NULL,
          response_code INTEGER,
          response_body TEXT,
          error_message TEXT,
          attempt_count INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (webhook_id) REFERENCES webhook_configs (id),
          FOREIGN KEY (email_id) REFERENCES emails (id)
        )
      `);

      // 系统配置表
      db.run(`
        CREATE TABLE IF NOT EXISTS system_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_key VARCHAR(255) UNIQUE NOT NULL,
          config_value TEXT,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 邮件服务器日志表
      db.run(`
        CREATE TABLE IF NOT EXISTS server_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          service VARCHAR(50) NOT NULL,
          level ENUM('info', 'warn', 'error', 'debug') NOT NULL,
          message TEXT NOT NULL,
          details TEXT,
          ip_address VARCHAR(45),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 插入默认配置
      const adminPassword = bcrypt.hashSync('admin123456', 10);
      
      db.run(`
        INSERT OR IGNORE INTO system_config (config_key, config_value, description) 
        VALUES 
        ('admin_token', 'mail-admin-2023', '管理员API令牌'),
        ('server_name', 'localhost', '邮件服务器名称'),
        ('max_message_size', '26214400', '最大邮件大小(25MB)'),
        ('session_timeout', '1800', '会话超时时间(秒)'),
        ('enable_tls', '1', '启用TLS加密'),
        ('require_auth', '1', '要求SMTP认证')
      `);

      // 插入默认域名
      db.run(`
        INSERT OR IGNORE INTO domains (domain, is_active, mx_record) 
        VALUES ('localhost', 1, 'localhost')
      `);

      // 插入默认管理员账户
      db.run(`
        INSERT OR IGNORE INTO mail_accounts 
        (email, username, domain_id, password_hash, display_name, is_admin, quota_mb) 
        VALUES 
        ('admin@localhost', 'admin', 1, ?, 'System Administrator', 1, 10000)
      `, [adminPassword]);

      // 为默认账户创建文件夹
      db.run(`
        INSERT OR IGNORE INTO mail_folders (account_id, name, type) 
        SELECT id, 'INBOX', 'inbox' FROM mail_accounts WHERE email = 'admin@localhost'
      `);
      
      db.run(`
        INSERT OR IGNORE INTO mail_folders (account_id, name, type) 
        SELECT id, 'Sent', 'sent' FROM mail_accounts WHERE email = 'admin@localhost'
      `);
      
      db.run(`
        INSERT OR IGNORE INTO mail_folders (account_id, name, type) 
        SELECT id, 'Drafts', 'drafts' FROM mail_accounts WHERE email = 'admin@localhost'
      `);
      
      db.run(`
        INSERT OR IGNORE INTO mail_folders (account_id, name, type) 
        SELECT id, 'Trash', 'trash' FROM mail_accounts WHERE email = 'admin@localhost'
      `);
    });

    db.close((err) => {
      if (err) {
        console.error('关闭数据库连接失败:', err.message);
        reject(err);
      } else {
        console.log('数据库表创建完成');
        resolve();
      }
    });
  });
}

// 获取数据库连接的辅助函数
function getDB() {
  return createConnection();
}

module.exports = {
  initDatabase,
  getDB,
  DB_PATH
}; 