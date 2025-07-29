const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDatabase } = require('./database/init');
const { startEmailListener } = require('./services/emailReceiver');

// 导入路由
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet());

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 限制每个IP 15分钟内最多100个请求
});
app.use('/api', limiter);

// 基础中间件
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务 - 提供管理端页面
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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    console.log('✅ 数据库初始化完成');
    
    // 启动邮件监听服务
    await startEmailListener();
    console.log('✅ 邮件监听服务启动');
    
    // 启动HTTP服务器
    app.listen(PORT, () => {
      console.log(`🚀 邮件系统服务器启动成功`);
      console.log(`🌐 服务地址: http://localhost:${PORT}`);
      console.log(`⚙️  管理界面: http://localhost:${PORT}/admin`);
      console.log(`📧 API文档: http://localhost:${PORT}/api/docs`);
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app; 