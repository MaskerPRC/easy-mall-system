const { simpleParser } = require('mailparser');

// 解析邮件内容
async function parseEmail(rawEmail) {
  try {
    const parsed = await simpleParser(rawEmail);
    
    return {
      messageId: parsed.messageId || generateMessageId(),
      from: parsed.from?.text || '',
      to: parsed.to?.text || '',
      cc: parsed.cc?.text || '',
      bcc: parsed.bcc?.text || '',
      subject: parsed.subject || '',
      text: parsed.text || '',
      html: parsed.html || '',
      date: parsed.date || new Date(),
      attachments: (parsed.attachments || []).map(att => ({
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        content: att.content ? att.content.toString('base64') : null
      })),
      headers: parsed.headers || new Map()
    };
  } catch (error) {
    console.error('邮件解析失败:', error);
    throw error;
  }
}

// 生成消息ID
function generateMessageId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `<${timestamp}.${random}@localhost>`;
}

// 验证邮件地址格式
function validateEmailAddress(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 提取邮件地址列表
function extractEmailAddresses(addressString) {
  if (!addressString) return [];
  
  const addresses = [];
  const parts = addressString.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    const match = trimmed.match(/<([^>]+)>/);
    if (match) {
      addresses.push(match[1]);
    } else if (validateEmailAddress(trimmed)) {
      addresses.push(trimmed);
    }
  }
  
  return addresses;
}

// 构建邮件原始格式
function buildRawEmail(emailData) {
  const {
    from,
    to,
    cc,
    bcc,
    subject,
    text,
    html,
    messageId,
    date = new Date()
  } = emailData;

  let raw = '';
  
  // 基础头部
  raw += `Message-ID: ${messageId || generateMessageId()}\r\n`;
  raw += `Date: ${date.toUTCString()}\r\n`;
  raw += `From: ${from}\r\n`;
  raw += `To: ${to}\r\n`;
  
  if (cc) raw += `Cc: ${cc}\r\n`;
  if (bcc) raw += `Bcc: ${bcc}\r\n`;
  if (subject) raw += `Subject: ${subject}\r\n`;
  
  raw += `MIME-Version: 1.0\r\n`;
  
  // 如果有HTML内容，使用multipart
  if (html && text) {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    raw += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
    
    // 纯文本部分
    raw += `--${boundary}\r\n`;
    raw += `Content-Type: text/plain; charset=utf-8\r\n`;
    raw += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
    raw += `${text}\r\n\r\n`;
    
    // HTML部分
    raw += `--${boundary}\r\n`;
    raw += `Content-Type: text/html; charset=utf-8\r\n`;
    raw += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
    raw += `${html}\r\n\r\n`;
    
    raw += `--${boundary}--\r\n`;
  } else if (html) {
    raw += `Content-Type: text/html; charset=utf-8\r\n`;
    raw += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
    raw += html;
  } else {
    raw += `Content-Type: text/plain; charset=utf-8\r\n`;
    raw += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
    raw += text || '';
  }
  
  return raw;
}

// 计算邮件大小
function calculateEmailSize(emailData) {
  const raw = buildRawEmail(emailData);
  return Buffer.byteLength(raw, 'utf8');
}

module.exports = {
  parseEmail,
  generateMessageId,
  validateEmailAddress,
  extractEmailAddresses,
  buildRawEmail,
  calculateEmailSize
}; 