const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

// Import database initialization
const { initDatabase } = require('./database/init');

// Import route modules
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

// Import mail servers
const { startSMTPServer } = require('./mail-server/smtp-server');
const { startIMAPServer } = require('./mail-server/imap-server');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration - 允许前端访问
app.use(cors({
  origin: [
    'http://localhost:5173', // Vue开发服务器
    'http://localhost:3000', // 同源
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Body parser middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// API Routes
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'mail-server-backend'
  });
});

// API文档简单页面
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'Mail Server API',
    version: '1.0.0',
    description: 'RESTful API for Mail Server Management',
    endpoints: {
      'GET /api/admin/stats': 'Get system statistics',
      'GET /api/admin/domains': 'Get all domains',
      'POST /api/admin/domains': 'Create new domain',
      'GET /api/admin/accounts': 'Get all email accounts',
      'POST /api/admin/accounts': 'Create new email account',
      'GET /api/admin/emails': 'Get email list',
      'GET /api/admin/webhooks': 'Get webhook configurations'
    },
    authentication: 'Bearer Token required in Authorization header'
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something broke!' });
});

// Start the server
async function startServer() {
  try {
    // Initialize database first
    console.log('📊 初始化数据库...');
    await initDatabase();
    console.log('✅ 数据库初始化完成');

    // Start web server
    app.listen(PORT, () => {
      console.log(`✅ Backend server running on port ${PORT}`);
      console.log(`📡 API endpoint: http://localhost:${PORT}/api`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      
      // Start mail servers
      startSMTPServer();
      startIMAPServer();
      
      console.log('🎉 邮件服务器系统启动完成！');
    });
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
