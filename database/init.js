const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'mail_system.db');

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
      // 邮件账户表
      db.run(`
        CREATE TABLE IF NOT EXISTS mail_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          smtp_host VARCHAR(255) NOT NULL,
          smtp_port INTEGER NOT NULL,
          imap_host VARCHAR(255) NOT NULL,
          imap_port INTEGER NOT NULL,
          use_ssl BOOLEAN DEFAULT 1,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 邮件记录表
      db.run(`
        CREATE TABLE IF NOT EXISTS emails (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id VARCHAR(255) UNIQUE,
          account_id INTEGER,
          direction ENUM('incoming', 'outgoing') NOT NULL,
          from_address VARCHAR(255) NOT NULL,
          to_address TEXT NOT NULL,
          cc_address TEXT,
          bcc_address TEXT,
          subject TEXT,
          content TEXT,
          html_content TEXT,
          attachments TEXT,
          status ENUM('pending', 'sent', 'failed', 'received') DEFAULT 'pending',
          error_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES mail_accounts (id)
        )
      `);

      // Hook配置表
      db.run(`
        CREATE TABLE IF NOT EXISTS webhook_configs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name VARCHAR(255) NOT NULL,
          url VARCHAR(500) NOT NULL,
          method ENUM('POST', 'PUT') DEFAULT 'POST',
          headers TEXT,
          is_active BOOLEAN DEFAULT 1,
          retry_count INTEGER DEFAULT 3,
          timeout INTEGER DEFAULT 30,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Hook调用记录表
      db.run(`
        CREATE TABLE IF NOT EXISTS webhook_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          webhook_id INTEGER,
          email_id INTEGER,
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

      // 插入默认配置
      db.run(`
        INSERT OR IGNORE INTO system_config (config_key, config_value, description) 
        VALUES 
        ('admin_token', 'admin123456', '管理员API令牌'),
        ('max_attachment_size', '10485760', '最大附件大小(字节)'),
        ('webhook_timeout', '30', 'Webhook超时时间(秒)')
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