const { SMTPServer } = require('smtp-server');
const { getDB } = require('../database/init');
const bcrypt = require('bcryptjs');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { parseEmail } = require('../utils/email-parser');
const { triggerWebhooks } = require('../services/webhookService');

class DomainSMTPServer {
  constructor() {
    this.server = null;
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
          resolve(isValid ? row : false);
        }
      );
      db.close();
    });
  }

  // 验证收件人地址
  async validateRecipient(email) {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      // 检查是否是本地邮箱或别名
      db.get(
        `SELECT ma.id as account_id, ma.email, 'account' as type
         FROM mail_accounts ma
         JOIN domains d ON ma.domain_id = d.id
         WHERE ma.email = ? AND ma.is_active = 1 AND d.is_active = 1
         
         UNION
         
         SELECT ma.id as account_id, mal.alias_email as email, 'alias' as type
         FROM mail_aliases mal
         JOIN mail_accounts ma ON mal.target_account_id = ma.id
         WHERE mal.alias_email = ? AND mal.is_active = 1`,
        [email, email],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          resolve(row || false);
        }
      );
      db.close();
    });
  }

  // 保存邮件
  async saveEmail(emailData) {
    const db = getDB();
    const messageId = emailData.messageId || `<${uuidv4()}@${emailData.hostname}>`;
    
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO emails (
          message_id, account_id, folder, from_address, to_addresses,
          cc_addresses, bcc_addresses, subject, content_text, content_html,
          attachments, size_bytes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        messageId,
        emailData.accountId,
        'INBOX',
        emailData.from,
        JSON.stringify(emailData.to),
        JSON.stringify(emailData.cc || []),
        JSON.stringify(emailData.bcc || []),
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

  // 记录服务器日志
  async logEvent(level, message, details = null, ipAddress = null) {
    const db = getDB();
    
    db.run(
      'INSERT INTO server_logs (service, level, message, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      ['SMTP', level, message, details, ipAddress],
      (err) => {
        if (err) {
          console.error('记录日志失败:', err);
        }
      }
    );
    db.close();
  }

  // 启动SMTP服务器
  async start(port = 25) {
    return new Promise((resolve, reject) => {
      this.server = new SMTPServer({
        // 基础配置
        banner: 'Domain Mail Server SMTP Ready',
        hostname: process.env.SERVER_HOSTNAME || 'localhost',
        
        // 认证配置
        secure: false, // 如果需要SSL，设置为true并提供证书
        authOptional: false,
        
        // 验证发件人
        onAuth: async (auth, session, callback) => {
          try {
            console.log(`SMTP认证尝试: ${auth.username}`);
            
            const user = await this.authenticateUser(auth.username, auth.password);
            if (user) {
              console.log(`✅ SMTP认证成功: ${auth.username}`);
              session.user = user;
              await this.logEvent('info', `SMTP认证成功: ${auth.username}`, null, session.remoteAddress);
              callback();
            } else {
              console.log(`❌ SMTP认证失败: ${auth.username}`);
              await this.logEvent('warn', `SMTP认证失败: ${auth.username}`, null, session.remoteAddress);
              callback(new Error('Invalid username or password'));
            }
          } catch (error) {
            console.error('SMTP认证错误:', error);
            await this.logEvent('error', 'SMTP认证错误', error.message, session.remoteAddress);
            callback(error);
          }
        },

        // 验证发件人地址
        onMailFrom: async (address, session, callback) => {
          try {
            const fromEmail = address.address.toLowerCase();
            
            // 检查是否是认证用户的邮箱
            if (session.user && session.user.email !== fromEmail) {
              console.log(`❌ 发件人地址不匹配: ${fromEmail} vs ${session.user.email}`);
              await this.logEvent('warn', '发件人地址不匹配', `${fromEmail} vs ${session.user.email}`, session.remoteAddress);
              return callback(new Error('From address does not match authenticated user'));
            }
            
            session.envelope.mailFrom = address;
            console.log(`✅ 验证发件人: ${fromEmail}`);
            callback();
          } catch (error) {
            console.error('验证发件人错误:', error);
            callback(error);
          }
        },

        // 验证收件人地址
        onRcptTo: async (address, session, callback) => {
          try {
            const toEmail = address.address.toLowerCase();
            
            // 验证收件人
            const recipient = await this.validateRecipient(toEmail);
            if (recipient) {
              if (!session.envelope.rcptTo) {
                session.envelope.rcptTo = [];
              }
              session.envelope.rcptTo.push({
                address: address,
                accountId: recipient.account_id,
                type: recipient.type
              });
              console.log(`✅ 验证收件人: ${toEmail}`);
              callback();
            } else {
              console.log(`❌ 收件人不存在: ${toEmail}`);
              await this.logEvent('warn', '收件人不存在', toEmail, session.remoteAddress);
              callback(new Error('Mailbox does not exist'));
            }
          } catch (error) {
            console.error('验证收件人错误:', error);
            callback(error);
          }
        },

        // 处理邮件数据
        onData: async (stream, session, callback) => {
          try {
            let emailData = '';
            
            stream.on('data', (chunk) => {
              emailData += chunk;
            });
            
            stream.on('end', async () => {
              try {
                console.log('📧 处理邮件数据...');
                
                // 解析邮件内容
                const parsed = await parseEmail(emailData);
                
                // 为每个收件人保存邮件
                for (const recipient of session.envelope.rcptTo) {
                  const mailData = {
                    messageId: parsed.messageId,
                    accountId: recipient.accountId,
                    from: session.envelope.mailFrom.address,
                    to: [recipient.address.address],
                    subject: parsed.subject,
                    text: parsed.text,
                    html: parsed.html,
                    attachments: parsed.attachments,
                    size: emailData.length,
                    hostname: session.hostname
                  };
                  
                  const emailId = await this.saveEmail(mailData);
                  console.log(`✅ 邮件已保存 (ID: ${emailId}) 给 ${recipient.address.address}`);
                  
                  // 触发Webhook
                  try {
                    await triggerWebhooks('email_received', emailId, mailData);
                  } catch (webhookError) {
                    console.error('Webhook触发失败:', webhookError);
                  }
                }
                
                await this.logEvent('info', '邮件发送成功', 
                  `From: ${session.envelope.mailFrom.address}, To: ${session.envelope.rcptTo.map(r => r.address.address).join(', ')}`, 
                  session.remoteAddress);
                
                console.log('✅ 邮件处理完成');
                callback();
                
              } catch (error) {
                console.error('处理邮件数据错误:', error);
                await this.logEvent('error', '处理邮件数据错误', error.message, session.remoteAddress);
                callback(error);
              }
            });
            
          } catch (error) {
            console.error('邮件数据流错误:', error);
            callback(error);
          }
        },

        // 连接关闭
        onClose: (session) => {
          console.log(`SMTP连接关闭: ${session.remoteAddress}`);
        },

        // 错误处理
        onError: (error) => {
          console.error('SMTP服务器错误:', error);
        }
      });

      this.server.listen(port, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`SMTP服务器监听端口: ${port}`);
          resolve();
        }
      });
    });
  }

  // 停止服务器
  stop() {
    if (this.server) {
      this.server.close();
      console.log('SMTP服务器已关闭');
    }
  }
}

let smtpServerInstance = null;

async function startSMTPServer(port = 25) {
  smtpServerInstance = new DomainSMTPServer();
  await smtpServerInstance.start(port);
  return smtpServerInstance;
}

function stopSMTPServer() {
  if (smtpServerInstance) {
    smtpServerInstance.stop();
    smtpServerInstance = null;
  }
}

module.exports = {
  DomainSMTPServer,
  startSMTPServer,
  stopSMTPServer
}; 