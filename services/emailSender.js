const nodemailer = require('nodemailer');
const { getDB } = require('../database/init');

class EmailSender {
  constructor() {
    this.transporters = new Map();
  }

  // 创建或获取邮件传输器
  async getTransporter(accountId) {
    if (this.transporters.has(accountId)) {
      return this.transporters.get(accountId);
    }

    const db = getDB();
    
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM mail_accounts WHERE id = ? AND is_active = 1',
        [accountId],
        (err, account) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (!account) {
            reject(new Error('邮件账户不存在或已禁用'));
            return;
          }

          const transporter = nodemailer.createTransporter({
            host: account.smtp_host,
            port: account.smtp_port,
            secure: account.use_ssl,
            auth: {
              user: account.email,
              pass: account.password
            }
          });

          this.transporters.set(accountId, transporter);
          resolve(transporter);
        }
      );
      db.close();
    });
  }

  // 发送邮件
  async sendEmail(emailData) {
    const {
      accountId,
      to,
      cc = '',
      bcc = '',
      subject,
      text = '',
      html = '',
      attachments = []
    } = emailData;

    const db = getDB();
    let emailId;

    try {
      // 获取传输器
      const transporter = await this.getTransporter(accountId);
      
      // 获取发件人账户信息
      const account = await new Promise((resolve, reject) => {
        db.get(
          'SELECT email FROM mail_accounts WHERE id = ?',
          [accountId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // 记录邮件到数据库
      emailId = await new Promise((resolve, reject) => {
        const stmt = db.prepare(`
          INSERT INTO emails (
            account_id, direction, from_address, to_address, 
            cc_address, bcc_address, subject, content, html_content,
            attachments, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run([
          accountId,
          'outgoing',
          account.email,
          Array.isArray(to) ? to.join(',') : to,
          cc,
          bcc,
          subject,
          text,
          html,
          JSON.stringify(attachments),
          'pending'
        ], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
        
        stmt.finalize();
      });

      // 构造邮件选项
      const mailOptions = {
        from: account.email,
        to: Array.isArray(to) ? to.join(',') : to,
        subject,
        text,
        html
      };

      if (cc) mailOptions.cc = cc;
      if (bcc) mailOptions.bcc = bcc;
      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments;
      }

      // 发送邮件
      const info = await transporter.sendMail(mailOptions);
      
      // 更新邮件状态为已发送
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE emails SET status = ?, message_id = ? WHERE id = ?',
          ['sent', info.messageId, emailId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      console.log(`✅ 邮件发送成功: ${info.messageId}`);
      
      return {
        success: true,
        emailId,
        messageId: info.messageId,
        response: info.response
      };

    } catch (error) {
      console.error('❌ 邮件发送失败:', error);
      
      // 更新邮件状态为失败
      if (emailId) {
        await new Promise((resolve) => {
          db.run(
            'UPDATE emails SET status = ?, error_message = ? WHERE id = ?',
            ['failed', error.message, emailId],
            () => resolve()
          );
        });
      }
      
      throw error;
    } finally {
      db.close();
    }
  }

  // 批量发送邮件
  async sendBulkEmails(emailsData) {
    const results = [];
    
    for (const emailData of emailsData) {
      try {
        const result = await this.sendEmail(emailData);
        results.push({ ...result, index: results.length });
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          index: results.length
        });
      }
    }
    
    return results;
  }

  // 获取邮件发送统计
  async getEmailStats(accountId = null) {
    const db = getDB();
    
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          status,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM emails 
        WHERE direction = 'outgoing'
      `;
      
      const params = [];
      if (accountId) {
        query += ' AND account_id = ?';
        params.push(accountId);
      }
      
      query += ' GROUP BY status, DATE(created_at) ORDER BY date DESC';
      
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
}

module.exports = new EmailSender(); 