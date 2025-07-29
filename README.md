# 域名邮件服务器 (Domain Mail Server)

## 🎯 项目简介

域名邮件服务器是一个完整的自建邮件解决方案，允许您在自己的域名下搭建和管理邮件服务。该系统包含完整的SMTP和IMAP服务器，并提供现代化的Web管理界面。

## ✨ 核心特性

### 📧 完整邮件服务器
- **SMTP服务器** - 处理邮件发送，支持认证和TLS加密
- **IMAP服务器** - 提供邮件客户端访问，支持文件夹管理
- **邮件解析** - 完整的邮件内容解析，支持附件和HTML内容

### 🎨 现代化管理界面
- **Vue.js前端** - 响应式设计，支持移动端访问
- **域名管理** - 添加和配置多个域名，设置DNS记录
- **账户管理** - 创建和管理域名下的邮箱账户
- **邮件列表** - 查看所有邮件收发记录，支持搜索和筛选
- **实时统计** - 邮件数量、账户状态等统计信息

### 🔗 Webhook集成
- **事件回调** - 邮件接收时自动触发Webhook
- **重试机制** - 失败重试和指数退避
- **执行日志** - 详细的Webhook执行记录

### 🛡️ 安全特性
- **API认证** - Bearer Token认证保护
- **速率限制** - 防止API滥用
- **密码加密** - bcrypt密码哈希
- **权限控制** - 管理员和普通用户分离

### 🚀 部署友好
- **Docker支持** - 完整的容器化部署
- **SQLite数据库** - 轻量级，无需外部数据库
- **环境配置** - 灵活的环境变量配置
- **自动初始化** - 一键数据库和目录初始化

## 🚀 快速开始

### 系统要求

- **Node.js** >= 16.0.0
- **npm** >= 7.0.0
- **操作系统**: Linux, macOS, Windows
- **网络**: 公网IP，开放端口25、143、3000

### 1. 下载和安装

```bash
# 克隆项目
git clone <your-repo-url>
cd domain-mail-server

# 安装依赖
npm install
```

### 2. 初始化系统

```bash
# 运行初始化脚本
npm run setup
```

初始化脚本会：
- 创建必要的目录（data、logs、public）
- 初始化SQLite数据库和表结构
- 生成配置文件模板
- 创建Docker配置文件
- 设置启动脚本

### 3. 配置环境

复制环境变量模板并修改配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 服务端口配置
PORT=3000
SMTP_PORT=25
IMAP_PORT=143

# 重要：设置为您的域名
SERVER_HOSTNAME=mail.yourdomain.com

# 数据库路径
DB_PATH=./data/mail_server.db

# 管理员令牌（生产环境请修改）
ADMIN_TOKEN=your-secure-token-here

# 邮件相关配置
MAX_MESSAGE_SIZE=26214400
SESSION_TIMEOUT=1800
ENABLE_TLS=1
REQUIRE_AUTH=1

# 环境标识
NODE_ENV=production
```

### 4. 配置DNS记录

在您的域名DNS设置中添加以下记录：

#### MX记录
```
@ MX 10 mail.yourdomain.com
```

#### A记录
```
mail A YOUR_SERVER_IP
@ A YOUR_SERVER_IP
```

#### SPF记录（TXT）
```
@ TXT "v=spf1 a mx ip4:YOUR_SERVER_IP ~all"
```

#### DMARC记录（TXT，可选）
```
_dmarc TXT "v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"
```

### 5. 启动服务器

```bash
# 开发环境
npm run dev

# 生产环境（需要root权限用于端口25）
sudo npm start

# 或使用启动脚本
./start.sh  # Linux/Mac
start.bat   # Windows
```

### 6. 访问管理界面

打开浏览器访问：`http://your-server-ip:3000/admin`

- **默认管理员令牌**: `mail-admin-2023`
- **⚠️ 重要**: 生产环境请立即修改默认令牌

## 📋 配置指南

### 域名配置

1. **添加域名**
   - 在管理界面中添加您的域名
   - 配置MX记录和SPF记录
   - 确保域名状态为"启用"

2. **DNS验证**
   ```bash
   # 验证MX记录
   nslookup -type=MX yourdomain.com
   
   # 验证SPF记录
   nslookup -type=TXT yourdomain.com
   ```

### 邮箱账户管理

1. **创建邮箱账户**
   - 邮箱地址：必须使用已配置的域名
   - 密码：设置强密码
   - 配额：设置邮箱存储限制
   - 权限：普通用户或管理员

2. **邮箱配置示例**
   - 邮箱：`user@yourdomain.com`
   - SMTP服务器：`mail.yourdomain.com:25`
   - IMAP服务器：`mail.yourdomain.com:143`
   - 认证：用户名和密码

### Webhook配置

1. **创建Webhook**
   ```json
   {
     "name": "邮件通知",
     "url": "https://your-api.com/webhook",
     "method": "POST",
     "triggerEvents": "email_received",
     "isActive": true,
     "retryCount": 3,
     "timeout": 30
   }
   ```

2. **Webhook数据格式**
   ```json
   {
     "event": "email_received",
     "timestamp": "2023-12-01T10:00:00.000Z",
     "webhook": {
       "id": 1,
       "name": "邮件通知"
     },
     "email": {
       "id": 123,
       "messageId": "unique-message-id",
       "from": "sender@example.com",
       "to": "recipient@yourdomain.com",
       "subject": "邮件主题",
       "text": "邮件纯文本内容",
       "html": "<p>邮件HTML内容</p>",
       "date": "2023-12-01T10:00:00.000Z",
       "size": 12345,
       "attachments": [
         {
           "filename": "document.pdf",
           "contentType": "application/pdf",
           "size": 54321
         }
       ]
     }
   }
   ```

## 📡 API使用

### 认证

所有API请求需要在Header中添加认证令牌：

```bash
Authorization: Bearer YOUR_API_TOKEN
Content-Type: application/json
```

### 发送邮件

```bash
curl -X POST http://your-server:3000/api/send \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "sender@yourdomain.com",
    "to": "recipient@example.com",
    "subject": "测试邮件",
    "text": "这是一封测试邮件",
    "html": "<p>这是一封<strong>测试邮件</strong></p>"
  }'
```

### 批量发送邮件

```bash
curl -X POST http://your-server:3000/api/send/bulk \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "emails": [
      {
        "from": "sender@yourdomain.com",
        "to": "user1@example.com",
        "subject": "邮件1",
        "text": "内容1"
      },
      {
        "from": "sender@yourdomain.com",
        "to": "user2@example.com",
        "subject": "邮件2",
        "text": "内容2"
      }
    ]
  }'
```

### 获取可用邮箱账户

```bash
curl -X GET http://your-server:3000/api/accounts \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### API文档

访问 `http://your-server:3000/api/docs` 查看完整的API文档。

## 🐳 Docker部署

### 使用Docker Compose（推荐）

```bash
# 构建并启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 手动Docker部署

```bash
# 构建镜像
docker build -t domain-mail-server .

# 运行容器
docker run -d \
  --name mail-server \
  -p 3000:3000 \
  -p 25:25 \
  -p 143:143 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -e SERVER_HOSTNAME=mail.yourdomain.com \
  domain-mail-server
```

### Nginx反向代理配置

```nginx
server {
    listen 80;
    server_name mail.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTPS配置（推荐）
server {
    listen 443 ssl;
    server_name mail.yourdomain.com;
    
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔧 高级配置

### 环境变量说明

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | 3000 | Web管理界面端口 |
| `SMTP_PORT` | 25 | SMTP服务器端口 |
| `IMAP_PORT` | 143 | IMAP服务器端口 |
| `SERVER_HOSTNAME` | localhost | 服务器主机名 |
| `ADMIN_TOKEN` | mail-admin-2023 | 管理员API令牌 |
| `MAX_MESSAGE_SIZE` | 26214400 | 最大邮件大小(25MB) |
| `SESSION_TIMEOUT` | 1800 | 会话超时时间(秒) |
| `ENABLE_TLS` | 1 | 是否启用TLS |
| `REQUIRE_AUTH` | 1 | 是否要求SMTP认证 |
| `NODE_ENV` | development | 运行环境 |

### SSL/TLS配置

1. **生成SSL证书**
   ```bash
   # 使用Let's Encrypt
   certbot certonly --standalone -d mail.yourdomain.com
   
   # 或使用自签名证书（仅测试）
   openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
   ```

2. **配置TLS**
   - 将证书文件放在 `ssl/` 目录
   - 修改服务器配置启用TLS

### 防火墙配置

```bash
# Ubuntu/Debian
sudo ufw allow 25/tcp    # SMTP
sudo ufw allow 143/tcp   # IMAP
sudo ufw allow 3000/tcp  # Web管理

# CentOS/RHEL
sudo firewall-cmd --add-port=25/tcp --permanent
sudo firewall-cmd --add-port=143/tcp --permanent
sudo firewall-cmd --add-port=3000/tcp --permanent
sudo firewall-cmd --reload
```

## 📊 监控和维护

### 日志查看

```bash
# 应用日志
tail -f logs/app.log

# SMTP服务器日志
tail -f logs/smtp.log

# IMAP服务器日志
tail -f logs/imap.log

# 使用Docker查看日志
docker-compose logs -f mail-server
```

### 数据库维护

```bash
# 备份数据库
cp data/mail_server.db backup/mail_server_$(date +%Y%m%d_%H%M%S).db

# 查看数据库大小
ls -lh data/mail_server.db

# 清理旧邮件（90天前）
sqlite3 data/mail_server.db "DELETE FROM emails WHERE created_at < datetime('now', '-90 days');"
```

### 性能监控

1. **系统资源**
   ```bash
   # CPU和内存使用
   htop
   
   # 磁盘使用
   df -h
   
   # 网络连接
   netstat -tulnp | grep -E ':(25|143|3000)'
   ```

2. **邮件统计**
   - 访问管理界面查看详细统计
   - 通过API获取统计数据

## 🔍 故障排除

### 常见问题

1. **端口25被占用**
   ```bash
   # 检查端口占用
   sudo netstat -tulnp | grep :25
   
   # 停止现有邮件服务
   sudo systemctl stop postfix
   sudo systemctl disable postfix
   ```

2. **权限问题**
   ```bash
   # 设置正确的文件权限
   chown -R $USER:$USER data/ logs/
   chmod -R 755 data/ logs/
   ```

3. **DNS解析问题**
   ```bash
   # 测试DNS解析
   dig MX yourdomain.com
   dig TXT yourdomain.com
   ```

4. **邮件被标记为垃圾邮件**
   - 确保正确配置SPF记录
   - 配置DKIM签名
   - 设置DMARC策略
   - 检查IP地址是否在黑名单中

### 错误日志分析

常见错误代码和解决方案：

- **SMTP 550**: 邮箱不存在 → 检查收件人地址
- **SMTP 535**: 认证失败 → 检查用户名密码
- **IMAP连接超时**: 检查防火墙和端口配置
- **数据库锁定**: 检查数据库文件权限

## 🛡️ 安全建议

### 基础安全

1. **修改默认令牌**
   - 立即修改默认的管理员令牌
   - 使用强密码策略

2. **网络安全**
   - 配置防火墙规则
   - 使用VPN或IP白名单限制管理访问
   - 启用HTTPS访问

3. **定期更新**
   - 保持系统和依赖包更新
   - 定期备份数据
   - 监控安全漏洞

### 高级安全

1. **Rate Limiting**
   - API请求速率限制已内置
   - 可根据需要调整限制策略

2. **日志审计**
   - 启用详细日志记录
   - 定期检查异常访问

3. **SSL/TLS**
   - 强制使用HTTPS
   - 配置强加密套件

## 🤝 开发指南

### 项目结构

```
domain-mail-server/
├── server.js              # 主服务器入口
├── package.json           # 项目依赖和配置
├── setup.js               # 初始化脚本
├── database/
│   └── init.js            # 数据库初始化
├── mail-server/
│   ├── smtp-server.js     # SMTP服务器
│   └── imap-server.js     # IMAP服务器
├── services/
│   └── webhookService.js  # Webhook服务
├── utils/
│   └── email-parser.js    # 邮件解析工具
├── routes/
│   ├── api.js             # 公开API路由
│   ├── admin.js           # 管理API路由
│   └── auth.js            # 认证路由
├── public/
│   ├── index.html         # 管理界面
│   └── app.js             # 前端逻辑
├── data/                  # 数据库和存储
├── logs/                  # 日志文件
└── ssl/                   # SSL证书（可选）
```

### 开发环境设置

```bash
# 安装开发依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test
```

### 贡献代码

1. Fork项目
2. 创建功能分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature`
5. 创建Pull Request

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 🙋 支持与反馈

如果您在使用过程中遇到问题或有改进建议，请：

1. 查看 [FAQ](#故障排除) 部分
2. 搜索现有 [Issues](../../issues)
3. 创建新的 [Issue](../../issues/new)

## 🎉 致谢

感谢所有为这个项目做出贡献的开发者和用户！

---

**⚠️ 重要提醒**: 运行邮件服务器需要专业的网络和安全知识。请确保：
- 遵守当地法律法规
- 配置适当的安全措施
- 定期更新和维护系统
- 监控服务器性能和安全 