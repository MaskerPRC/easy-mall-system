const { initDatabase } = require('./database/init');
const fs = require('fs');
const path = require('path');

async function setup() {
  console.log('🚀 开始初始化 Easy Mail System...\n');
  
  try {
    // 创建必要的目录
    console.log('📁 创建项目目录...');
    const dirs = ['data', 'logs'];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`  ✅ 创建目录: ${dir}`);
      } else {
        console.log(`  ✓ 目录已存在: ${dir}`);
      }
    }
    
    // 初始化数据库
    console.log('\n📊 初始化数据库...');
    await initDatabase();
    console.log('  ✅ 数据库初始化完成');
    
    // 创建环境变量文件示例
    console.log('\n⚙️  创建配置文件...');
    const envExample = `# Easy Mail System 配置文件
# 复制此文件为 .env 并根据需要修改配置

# 服务端口
PORT=3000

# 数据库路径
DB_PATH=./data/mail_system.db

# 默认管理员令牌（生产环境请修改）
ADMIN_TOKEN=admin123456

# 最大附件大小（字节，默认10MB）
MAX_ATTACHMENT_SIZE=10485760

# Webhook超时时间（秒）
WEBHOOK_TIMEOUT=30

# 日志级别
LOG_LEVEL=info

# 开发环境标识
NODE_ENV=development
`;
    
    const envPath = '.env.example';
    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, envExample);
      console.log(`  ✅ 创建配置示例: ${envPath}`);
    } else {
      console.log(`  ✓ 配置示例已存在: ${envPath}`);
    }
    
    // 创建Git忽略文件
    console.log('\n📝 创建 .gitignore...');
    const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Database files
data/
*.db
*.sqlite
*.sqlite3

# Log files
logs/
*.log

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE files
.vscode/
.idea/
*.swp
*.swo
*~

# Temporary files
tmp/
temp/
`;
    
    const gitignorePath = '.gitignore';
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, gitignoreContent);
      console.log(`  ✅ 创建 Git 忽略文件: ${gitignorePath}`);
    } else {
      console.log(`  ✓ Git 忽略文件已存在: ${gitignorePath}`);
    }
    
    // 创建Docker文件
    console.log('\n🐳 创建 Docker 配置...');
    const dockerfileContent = `FROM node:16-alpine

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制源代码
COPY . .

# 创建数据目录
RUN mkdir -p data logs

# 初始化数据库
RUN npm run setup

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

# 启动应用
CMD ["npm", "start"]
`;
    
    const dockerfilePath = 'Dockerfile';
    if (!fs.existsSync(dockerfilePath)) {
      fs.writeFileSync(dockerfilePath, dockerfileContent);
      console.log(`  ✅ 创建 Docker 文件: ${dockerfilePath}`);
    } else {
      console.log(`  ✓ Docker 文件已存在: ${dockerfilePath}`);
    }
    
    // 创建Docker Compose文件
    const dockerComposePath = 'docker-compose.yml';
    const dockerComposeContent = `version: '3.8'

services:
  mail-system:
    build: .
    container_name: easy-mail-system
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # 可选：添加 Nginx 反向代理
  # nginx:
  #   image: nginx:alpine
  #   container_name: mail-system-nginx
  #   ports:
  #     - "80:80"
  #     - "443:443"
  #   volumes:
  #     - ./nginx.conf:/etc/nginx/nginx.conf
  #     - ./ssl:/etc/nginx/ssl
  #   depends_on:
  #     - mail-system
  #   restart: unless-stopped
`;
    
    if (!fs.existsSync(dockerComposePath)) {
      fs.writeFileSync(dockerComposePath, dockerComposeContent);
      console.log(`  ✅ 创建 Docker Compose 文件: ${dockerComposePath}`);
    } else {
      console.log(`  ✓ Docker Compose 文件已存在: ${dockerComposePath}`);
    }
    
    // 创建启动脚本
    console.log('\n🚀 创建启动脚本...');
    
    // Windows启动脚本
    const startBatContent = `@echo off
echo Starting Easy Mail System...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist node_modules (
    echo Installing dependencies...
    npm install
    if errorlevel 1 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Initialize database if needed
if not exist data\\mail_system.db (
    echo Initializing database...
    npm run setup
)

REM Start the application
echo Starting server...
npm start

pause
`;
    
    fs.writeFileSync('start.bat', startBatContent);
    console.log('  ✅ 创建 Windows 启动脚本: start.bat');
    
    // Linux/Mac启动脚本
    const startShContent = `#!/bin/bash

echo "Starting Easy Mail System..."
echo

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install dependencies"
        exit 1
    fi
fi

# Initialize database if needed
if [ ! -f "data/mail_system.db" ]; then
    echo "Initializing database..."
    npm run setup
fi

# Start the application
echo "Starting server..."
npm start
`;
    
    fs.writeFileSync('start.sh', startShContent);
    
    // 设置执行权限（仅在Unix系统上）
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync('start.sh', '755');
        console.log('  ✅ 创建 Linux/Mac 启动脚本: start.sh');
      } catch (error) {
        console.log('  ⚠️  创建启动脚本但无法设置执行权限: start.sh');
      }
    } else {
      console.log('  ✅ 创建 Linux/Mac 启动脚本: start.sh');
    }
    
    // 完成信息
    console.log('\n🎉 Easy Mail System 初始化完成！');
    console.log('\n📋 接下来的步骤：');
    console.log('  1. 启动服务：npm start 或运行 start.bat/start.sh');
    console.log('  2. 访问管理界面：http://localhost:3000/admin');
    console.log('  3. 使用默认令牌登录：admin123456');
    console.log('  4. 在管理界面中添加邮件账户');
    console.log('  5. 配置Webhook（如需要）');
    console.log('\n⚠️  重要提醒：');
    console.log('  • 生产环境请立即修改默认管理员令牌');
    console.log('  • 建议配置SSL证书和域名');
    console.log('  • 定期备份 data/ 目录');
    console.log('\n📖 详细文档请查看：README.md');
    console.log('\n✨ 祝您使用愉快！');
    
  } catch (error) {
    console.error('\n❌ 初始化失败:', error.message);
    console.error('\n请检查错误信息并重试。');
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  setup();
}

module.exports = { setup }; 