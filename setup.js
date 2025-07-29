const { initDatabase } = require('./database/init');
const fs = require('fs');
const path = require('path');

async function setup() {
  console.log('🚀 开始初始化域名邮件服务器系统...\n');
  
  try {
    // 创建必要的目录
    console.log('📁 创建项目目录...');
    const dirs = ['data', 'logs', 'public'];
    
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
    const envExample = `# 域名邮件服务器配置文件
# 复制此文件为 .env 并根据需要修改配置

# 服务端口配置
PORT=3000
SMTP_PORT=25
IMAP_PORT=143

# 服务器主机名（重要：设置为您的域名）
SERVER_HOSTNAME=mail.yourdomain.com

# 数据库路径
DB_PATH=./data/mail_server.db

# 默认管理员令牌（生产环境请修改）
ADMIN_TOKEN=mail-admin-2023

# 邮件相关配置
MAX_MESSAGE_SIZE=26214400
SESSION_TIMEOUT=1800
ENABLE_TLS=1
REQUIRE_AUTH=1

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

# SSL certificates
*.key
*.crt
*.pem
ssl/

# Backup files
*.bak
backup/
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

# 安装必要的系统包
RUN apk add --no-cache curl

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制源代码
COPY . .

# 创建数据和日志目录
RUN mkdir -p data logs

# 初始化数据库
RUN npm run setup

# 暴露端口
EXPOSE 3000 25 143

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:3000/health || exit 1

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV SMTP_PORT=25
ENV IMAP_PORT=143

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
  mail-server:
    build: .
    container_name: domain-mail-server
    ports:
      - "3000:3000"    # Web管理界面
      - "25:25"        # SMTP端口
      - "143:143"      # IMAP端口
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - PORT=3000
      - SMTP_PORT=25
      - IMAP_PORT=143
      - SERVER_HOSTNAME=mail.yourdomain.com
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
  #   container_name: mail-server-nginx
  #   ports:
  #     - "80:80"
  #     - "443:443"
  #   volumes:
  #     - ./nginx.conf:/etc/nginx/nginx.conf
  #     - ./ssl:/etc/nginx/ssl
  #   depends_on:
  #     - mail-server
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
echo Starting Domain Mail Server...
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
if not exist data\\mail_server.db (
    echo Initializing database...
    npm run setup
)

echo.
echo =====================================================
echo   Domain Mail Server Starting...
echo =====================================================
echo   Web Interface: http://localhost:3000/admin
echo   SMTP Server:   localhost:25
echo   IMAP Server:   localhost:143
echo   Default Token: mail-admin-2023
echo =====================================================
echo.

REM Start the application
npm start

pause
`;
    
    fs.writeFileSync('start.bat', startBatContent);
    console.log('  ✅ 创建 Windows 启动脚本: start.bat');
    
    // Linux/Mac启动脚本
    const startShContent = `#!/bin/bash

echo "Starting Domain Mail Server..."
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
if [ ! -f "data/mail_server.db" ]; then
    echo "Initializing database..."
    npm run setup
fi

echo
echo "====================================================="
echo "  Domain Mail Server Starting..."
echo "====================================================="
echo "  Web Interface: http://localhost:3000/admin"
echo "  SMTP Server:   localhost:25"
echo "  IMAP Server:   localhost:143"
echo "  Default Token: mail-admin-2023"
echo "====================================================="
echo

# Check if running as root for port 25
if [ "$EUID" -ne 0 ] && [ "\${PORT:-25}" -eq 25 ]; then
    echo "Warning: SMTP port 25 requires root privileges"
    echo "You may need to run: sudo npm start"
    echo "Or configure a different SMTP port"
    echo
fi

# Start the application
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
    
    // 创建快速配置脚本
    console.log('\n⚡ 创建快速配置脚本...');
    const quickSetupContent = `#!/bin/bash

echo "=== 域名邮件服务器快速配置向导 ==="
echo

# 获取用户输入
read -p "请输入您的域名 (例如: yourdomain.com): " DOMAIN
read -p "请输入服务器IP地址: " SERVER_IP
read -p "请输入管理员邮箱 (例如: admin@$DOMAIN): " ADMIN_EMAIL

# 生成配置文件
cat > .env << EOF
# 域名邮件服务器配置
PORT=3000
SMTP_PORT=25
IMAP_PORT=143
SERVER_HOSTNAME=$DOMAIN
ADMIN_TOKEN=\$(openssl rand -hex 16)
DB_PATH=./data/mail_server.db
NODE_ENV=production
EOF

echo
echo "✅ 配置文件 .env 已创建"
echo
echo "📋 请在您的域名DNS设置中添加以下记录："
echo
echo "MX 记录:"
echo "  @ MX 10 $DOMAIN"
echo
echo "A 记录:"
echo "  @ A $SERVER_IP"
echo "  mail A $SERVER_IP"
echo
echo "SPF 记录 (TXT):"
echo "  @ TXT \"v=spf1 a mx ip4:$SERVER_IP ~all\""
echo
echo "DMARC 记录 (TXT):"
echo "  _dmarc TXT \"v=DMARC1; p=quarantine; rua=mailto:$ADMIN_EMAIL\""
echo
echo "🚀 配置完成！现在可以运行 npm start 启动服务器"
`;
    
    fs.writeFileSync('quick-setup.sh', quickSetupContent);
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync('quick-setup.sh', '755');
      } catch (error) {
        // 忽略权限设置错误
      }
    }
    console.log('  ✅ 创建快速配置脚本: quick-setup.sh');
    
    // 完成信息
    console.log('\n🎉 域名邮件服务器系统初始化完成！');
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 接下来的步骤：');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. 🔧 配置域名DNS记录（MX、A、SPF等）');
    console.log('2. ⚙️  修改 .env.example 为 .env 并设置您的域名');
    console.log('3. 🚀 启动服务器：npm start 或运行 start.bat/start.sh');
    console.log('4. 🌐 访问管理界面：http://localhost:3000/admin');
    console.log('5. 🔑 使用默认令牌登录：mail-admin-2023');
    console.log('6. 👥 在管理界面创建域名和邮箱账户');
    console.log('7. 🔗 配置Webhook（如需要）');
    console.log('8. 📧 测试邮件收发功能');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  重要提醒：');
    console.log('  • 端口25需要root权限，可能需要 sudo npm start');
    console.log('  • 生产环境请立即修改默认管理员令牌');
    console.log('  • 确保服务器防火墙开放 25、143、3000 端口');
    console.log('  • 定期备份 data/ 目录');
    console.log('\n🛠️  快速配置：');
    console.log('  运行 ./quick-setup.sh 进行引导式配置');
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