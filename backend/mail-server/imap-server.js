const net = require('net');
const { getDB } = require('../database/init');
const bcrypt = require('bcryptjs');

class DomainIMAPServer {
  constructor() {
    this.server = null;
    this.connections = new Map();
  }

  // 验证用户认证
  async authenticateUser(username, password) {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT ma.*, d.domain 
         FROM mail_accounts ma
         JOIN domains d ON ma.domain_id = d.id
         WHERE ma.email = ? AND ma.is_active = 1 AND d.is_active = 1`,
        [username],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (!row) {
            resolve(false);
            return;
          }
          
          // 验证密码
          const isValid = bcrypt.compareSync(password, row.password_hash);
          if (isValid) {
            // 更新最后登录时间
            db.run(
              'UPDATE mail_accounts SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
              [row.id]
            );
          }
          resolve(isValid ? row : false);
        }
      );
      db.close();
    });
  }

  // 获取用户邮件文件夹
  async getUserFolders(accountId) {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM mail_folders WHERE account_id = ? ORDER BY type, name',
        [accountId],
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

  // 获取文件夹中的邮件
  async getFolderEmails(accountId, folder = 'INBOX', limit = 50, offset = 0) {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM emails 
         WHERE account_id = ? AND folder = ? AND is_deleted = 0 
         ORDER BY received_at DESC 
         LIMIT ? OFFSET ?`,
        [accountId, folder, limit, offset],
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

  // 获取单个邮件
  async getEmail(emailId, accountId) {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM emails WHERE id = ? AND account_id = ?',
        [emailId, accountId],
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

  // 标记邮件为已读
  async markEmailAsRead(emailId, accountId) {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE emails SET is_read = 1 WHERE id = ? AND account_id = ?',
        [emailId, accountId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
          db.close();
        }
      );
    });
  }

  // 删除邮件
  async deleteEmail(emailId, accountId) {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE emails SET is_deleted = 1 WHERE id = ? AND account_id = ?',
        [emailId, accountId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
          db.close();
        }
      );
    });
  }

  // 移动邮件到文件夹
  async moveEmail(emailId, accountId, targetFolder) {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE emails SET folder = ? WHERE id = ? AND account_id = ?',
        [targetFolder, emailId, accountId],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
          db.close();
        }
      );
    });
  }

  // 处理IMAP客户端连接
  handleConnection(socket) {
    const connectionId = Date.now() + Math.random();
    let currentUser = null;
    let selectedFolder = null;
    let tagCounter = 1;

    console.log(`IMAP新连接: ${socket.remoteAddress}`);
    
    // 发送欢迎消息
    socket.write('* OK Domain Mail Server IMAP4rev1 Ready\r\n');

    // 存储连接
    this.connections.set(connectionId, {
      socket,
      user: null,
      folder: null
    });

    socket.on('data', async (data) => {
      try {
        const lines = data.toString().trim().split('\r\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          console.log(`IMAP收到: ${line}`);
          await this.processIMAPCommand(socket, line, {
            currentUser,
            selectedFolder,
            setUser: (user) => { currentUser = user; },
            setFolder: (folder) => { selectedFolder = folder; }
          });
        }
      } catch (error) {
        console.error('IMAP命令处理错误:', error);
        socket.write(`* BAD Server error\r\n`);
      }
    });

    socket.on('close', () => {
      console.log(`IMAP连接关闭: ${socket.remoteAddress}`);
      this.connections.delete(connectionId);
    });

    socket.on('error', (error) => {
      console.error('IMAP连接错误:', error);
      this.connections.delete(connectionId);
    });
  }

  // 处理IMAP命令
  async processIMAPCommand(socket, command, context) {
    const parts = command.split(' ');
    const tag = parts[0];
    const cmd = parts[1]?.toUpperCase();
    const args = parts.slice(2);

    try {
      switch (cmd) {
        case 'LOGIN':
          await this.handleLogin(socket, tag, args, context);
          break;
          
        case 'LIST':
          await this.handleList(socket, tag, args, context);
          break;
          
        case 'SELECT':
          await this.handleSelect(socket, tag, args, context);
          break;
          
        case 'FETCH':
          await this.handleFetch(socket, tag, args, context);
          break;
          
        case 'STORE':
          await this.handleStore(socket, tag, args, context);
          break;
          
        case 'SEARCH':
          await this.handleSearch(socket, tag, args, context);
          break;
          
        case 'LOGOUT':
          socket.write(`* BYE Domain Mail Server IMAP4rev1 logging out\r\n`);
          socket.write(`${tag} OK LOGOUT completed\r\n`);
          socket.end();
          break;
          
        case 'CAPABILITY':
          socket.write('* CAPABILITY IMAP4rev1 AUTH=PLAIN AUTH=LOGIN\r\n');
          socket.write(`${tag} OK CAPABILITY completed\r\n`);
          break;
          
        default:
          socket.write(`${tag} BAD Unknown command\r\n`);
      }
    } catch (error) {
      console.error(`IMAP命令 ${cmd} 错误:`, error);
      socket.write(`${tag} NO Server error\r\n`);
    }
  }

  // 处理登录
  async handleLogin(socket, tag, args, context) {
    if (args.length < 2) {
      socket.write(`${tag} NO LOGIN Invalid arguments\r\n`);
      return;
    }

    const username = args[0].replace(/"/g, '');
    const password = args[1].replace(/"/g, '');

    const user = await this.authenticateUser(username, password);
    if (user) {
      context.setUser(user);
      console.log(`✅ IMAP认证成功: ${username}`);
      socket.write(`${tag} OK LOGIN completed\r\n`);
    } else {
      console.log(`❌ IMAP认证失败: ${username}`);
      socket.write(`${tag} NO LOGIN Invalid credentials\r\n`);
    }
  }

  // 处理文件夹列表
  async handleList(socket, tag, args, context) {
    if (!context.currentUser) {
      socket.write(`${tag} NO Not authenticated\r\n`);
      return;
    }

    try {
      const folders = await this.getUserFolders(context.currentUser.id);
      
      for (const folder of folders) {
        socket.write(`* LIST () "/" "${folder.name}"\r\n`);
      }
      
      socket.write(`${tag} OK LIST completed\r\n`);
    } catch (error) {
      socket.write(`${tag} NO LIST failed\r\n`);
    }
  }

  // 处理选择文件夹
  async handleSelect(socket, tag, args, context) {
    if (!context.currentUser) {
      socket.write(`${tag} NO Not authenticated\r\n`);
      return;
    }

    if (args.length < 1) {
      socket.write(`${tag} NO SELECT Invalid arguments\r\n`);
      return;
    }

    const folderName = args[0].replace(/"/g, '');
    
    try {
      const emails = await this.getFolderEmails(context.currentUser.id, folderName);
      const unreadCount = emails.filter(e => !e.is_read).length;
      
      context.setFolder(folderName);
      
      socket.write(`* ${emails.length} EXISTS\r\n`);
      socket.write(`* ${unreadCount} RECENT\r\n`);
      socket.write(`* OK [UNSEEN ${unreadCount}] Message ${unreadCount} is first unseen\r\n`);
      socket.write(`* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)\r\n`);
      socket.write(`${tag} OK [READ-WRITE] SELECT completed\r\n`);
    } catch (error) {
      socket.write(`${tag} NO SELECT failed\r\n`);
    }
  }

  // 处理获取邮件
  async handleFetch(socket, tag, args, context) {
    if (!context.currentUser || !context.selectedFolder) {
      socket.write(`${tag} NO Not authenticated or no folder selected\r\n`);
      return;
    }

    try {
      const emails = await this.getFolderEmails(context.currentUser.id, context.selectedFolder);
      
      // 简化的FETCH实现，只返回基本信息
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        const seqNum = i + 1;
        
        socket.write(`* ${seqNum} FETCH (`);
        socket.write(`UID ${email.id} `);
        socket.write(`FLAGS (${email.is_read ? '\\Seen' : ''}) `);
        socket.write(`ENVELOPE ("${email.received_at}" "${email.subject}" `);
        socket.write(`"${email.from_address}" "${email.to_addresses}" ) `);
        socket.write(`RFC822.SIZE ${email.size_bytes})\r\n`);
      }
      
      socket.write(`${tag} OK FETCH completed\r\n`);
    } catch (error) {
      socket.write(`${tag} NO FETCH failed\r\n`);
    }
  }

  // 处理存储命令（标记邮件）
  async handleStore(socket, tag, args, context) {
    if (!context.currentUser || !context.selectedFolder) {
      socket.write(`${tag} NO Not authenticated or no folder selected\r\n`);
      return;
    }

    // 简化的STORE实现
    socket.write(`${tag} OK STORE completed\r\n`);
  }

  // 处理搜索命令
  async handleSearch(socket, tag, args, context) {
    if (!context.currentUser || !context.selectedFolder) {
      socket.write(`${tag} NO Not authenticated or no folder selected\r\n`);
      return;
    }

    try {
      const emails = await this.getFolderEmails(context.currentUser.id, context.selectedFolder);
      const results = emails.map((_, index) => index + 1).join(' ');
      
      socket.write(`* SEARCH ${results}\r\n`);
      socket.write(`${tag} OK SEARCH completed\r\n`);
    } catch (error) {
      socket.write(`${tag} NO SEARCH failed\r\n`);
    }
  }

  // 启动IMAP服务器
  async start(port = 143) {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.listen(port, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`IMAP服务器监听端口: ${port}`);
          resolve();
        }
      });

      this.server.on('error', (error) => {
        console.error('IMAP服务器错误:', error);
      });
    });
  }

  // 停止服务器
  stop() {
    if (this.server) {
      // 关闭所有连接
      for (const [id, connection] of this.connections) {
        connection.socket.destroy();
      }
      this.connections.clear();
      
      this.server.close();
      console.log('IMAP服务器已关闭');
    }
  }
}

let imapServerInstance = null;

async function startIMAPServer(port = 143) {
  imapServerInstance = new DomainIMAPServer();
  await imapServerInstance.start(port);
  return imapServerInstance;
}

function stopIMAPServer() {
  if (imapServerInstance) {
    imapServerInstance.stop();
    imapServerInstance = null;
  }
}

module.exports = {
  DomainIMAPServer,
  startIMAPServer,
  stopIMAPServer
}; 