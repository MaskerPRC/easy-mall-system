const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDatabase } = require('./database/init');
const { startSMTPServer } = require('./mail-server/smtp-server');
const { startIMAPServer } = require('./mail-server/imap-server');

// 导入路由
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const SMTP_PORT = process.env.SMTP_PORT || 25;
const IMAP_PORT = process.env.IMAP_PORT || 143;

// 安全中间件
app.use(helmet());

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100
});
app.use('/api', limiter);

// 基础中间件
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// API路由
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

// 管理端前端路由
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      web: 'running',
      smtp: process.env.SMTP_STATUS || 'unknown',
      imap: process.env.IMAP_STATUS || 'unknown'
    }
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '请联系管理员'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

// 启动所有服务
async function startAllServices() {
  try {
    console.log('🚀 启动域名邮件服务器系统...\n');
    
    // 初始化数据库
    console.log('📊 初始化数据库...');
    await initDatabase();
    console.log('✅ 数据库初始化完成\n');
    
    // 启动SMTP服务器
    console.log('📧 启动SMTP服务器...');
    await startSMTPServer(SMTP_PORT);
    process.env.SMTP_STATUS = 'running';
    console.log(`✅ SMTP服务器启动成功 (端口: ${SMTP_PORT})\n`);
    
    // 启动IMAP服务器
    console.log('📥 启动IMAP服务器...');
    await startIMAPServer(IMAP_PORT);
    process.env.IMAP_STATUS = 'running';
    console.log(`✅ IMAP服务器启动成功 (端口: ${IMAP_PORT})\n`);
    
    // 启动Web管理服务器
    console.log('🌐 启动Web管理服务器...');
    app.listen(PORT, () => {
      console.log(`✅ Web管理服务器启动成功 (端口: ${PORT})\n`);
      
      console.log('🎉 域名邮件服务器系统启动完成！');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📧 SMTP服务器: localhost:${SMTP_PORT}`);
      console.log(`📥 IMAP服务器: localhost:${IMAP_PORT}`);
      console.log(`🌐 管理界面:   http://localhost:${PORT}/admin`);
      console.log(`📡 API地址:    http://localhost:${PORT}/api`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\n⚠️  下一步配置：');
      console.log('1. 配置域名DNS记录');
      console.log('2. 在管理界面创建邮箱账户');
      console.log('3. 测试邮件收发功能');
      console.log('\n📖 详细配置请查看 README.md');
    });
    
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭邮件服务器...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 正在关闭邮件服务器...');
  process.exit(0);
});

startAllServices();

module.exports = app; 