# Easy Mail System

简易邮件系统 - 包含管理端和后端API，支持邮件发送、接收和Webhook回调功能。

## ✨ 功能特性

- 📧 **邮件管理** - 查看所有邮件收发记录
- 👥 **账户管理** - 添加和管理多个邮件账户
- 🚀 **API支持** - 提供RESTful API用于发送邮件
- 🔗 **Webhook回调** - 接收邮件后自动调用配置的回调地址
- 🎨 **现代化界面** - 基于Vue.js和Tailwind CSS的管理界面
- 🔒 **安全认证** - API令牌认证保护
- 📊 **统计报表** - 邮件发送接收统计

## 🏗 系统架构

```
├── 后端 (Node.js + Express)
│   ├── 邮件发送服务 (Nodemailer)
│   ├── 邮件接收服务 (IMAP)
│   ├── Webhook服务
│   └── 数据存储 (SQLite)
├── 前端 (Vue.js + Tailwind CSS)
│   ├── 管理界面
│   ├── 邮件列表
│   ├── 账户管理
│   └── Webhook配置
└── API (RESTful)
    ├── 发送邮件
    ├── 批量发送
    └── 统计查询
```

## 📋 系统要求

- Node.js 16+ 
- npm 或 yarn
- 支持的操作系统：Windows、Linux、macOS
- 邮件服务器账户（支持SMTP/IMAP）

## 🚀 快速开始

### 1. 下载和安装

```bash
# 克隆项目
git clone <your-repo-url>
cd easy-mail-system

# 安装依赖
npm install
```

### 2. 初始化数据库

```bash
# 运行数据库初始化
npm run setup
```

### 3. 启动服务

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

### 4. 访问管理界面

打开浏览器访问：`http://localhost:3000/admin`

默认管理员令牌：`admin123456`（生产环境请立即修改）

## ⚙️ 配置说明

### 邮件账户配置

在管理界面中添加邮件账户，需要提供：

- **邮箱地址** - 完整的邮箱地址
- **密码** - 邮箱密码或应用专用密码
- **SMTP服务器** - 发送邮件服务器地址和端口
- **IMAP服务器** - 接收邮件服务器地址和端口
- **SSL** - 是否启用SSL/TLS加密

#### 常见邮件服务商配置示例

**Gmail**
- SMTP: smtp.gmail.com:587
- IMAP: imap.gmail.com:993
- SSL: 启用

**Outlook/Hotmail**
- SMTP: smtp-mail.outlook.com:587
- IMAP: outlook.office365.com:993
- SSL: 启用

**163邮箱**
- SMTP: smtp.163.com:465
- IMAP: imap.163.com:993
- SSL: 启用

### Webhook配置

配置邮件接收后的回调：

- **名称** - Webhook名称（便于管理）
- **URL** - 回调地址
- **方法** - HTTP方法（POST/PUT）
- **头部** - 自定义HTTP头部（JSON格式）
- **重试次数** - 失败重试次数
- **超时时间** - 请求超时时间（秒）

## 📡 API使用

### 认证

所有API请求需要在请求头中添加认证令牌：

```
Authorization: Bearer YOUR_API_TOKEN
```

### 发送邮件

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": 1,
    "to": "recipient@example.com",
    "subject": "测试邮件",
    "text": "这是一封测试邮件",
    "html": "<h1>这是一封测试邮件</h1>"
  }'
```

### 批量发送邮件

```bash
curl -X POST http://localhost:3000/api/send/bulk \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "emails": [
      {
        "accountId": 1,
        "to": "user1@example.com",
        "subject": "邮件1",
        "text": "内容1"
      },
      {
        "accountId": 1,
        "to": "user2@example.com", 
        "subject": "邮件2",
        "text": "内容2"
      }
    ]
  }'
```

### 获取账户列表

```bash
curl -X GET http://localhost:3000/api/accounts \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

### API文档

启动服务后访问：`http://localhost:3000/api/docs`

## 🔗 Webhook数据格式

当接收到邮件时，系统会向配置的Webhook URL发送POST请求，数据格式如下：

```json
{
  "emailId": 123,
  "messageId": "unique-message-id",
  "account": {
    "id": 1,
    "email": "your@example.com"
  },
  "from": {
    "text": "sender@example.com"
  },
  "to": {
    "text": "recipient@example.com"
  },
  "subject": "邮件主题",
  "text": "邮件纯文本内容",
  "html": "邮件HTML内容",
  "date": "2023-12-01T10:00:00.000Z",
  "attachments": [
    {
      "filename": "attachment.pdf",
      "contentType": "application/pdf",
      "size": 12345
    }
  ],
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

## 🐳 Docker部署

```dockerfile
# Dockerfile
FROM node:16-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .
RUN npm run setup

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# 构建镜像
docker build -t easy-mail-system .

# 运行容器
docker run -d -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --name mail-system \
  easy-mail-system
```

## 🔧 高级配置

### 环境变量

创建 `.env` 文件：

```env
# 服务端口
PORT=3000

# 数据库路径
DB_PATH=./data/mail_system.db

# 默认管理员令牌
ADMIN_TOKEN=your-secure-token

# 最大附件大小（字节）
MAX_ATTACHMENT_SIZE=10485760

# Webhook超时时间（秒）
WEBHOOK_TIMEOUT=30

# 日志级别
LOG_LEVEL=info
```

### 反向代理配置

#### Nginx配置示例

```nginx
server {
    listen 80;
    server_name mail.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL证书配置

使用Let's Encrypt免费SSL证书：

```bash
# 安装certbot
sudo apt install certbot

# 获取证书
sudo certbot --nginx -d mail.yourdomain.com
```

## 📊 监控和日志

### 系统监控

- 访问 `/health` 端点检查服务状态
- 管理界面显示实时统计信息
- Webhook执行日志记录

### 日志文件

- 应用日志：控制台输出
- 邮件发送日志：数据库记录
- Webhook调用日志：数据库记录

## 🚨 故障排除

### 常见问题

1. **邮件发送失败**
   - 检查SMTP服务器配置
   - 确认邮箱密码正确
   - 检查防火墙设置

2. **邮件接收不到**
   - 检查IMAP服务器配置
   - 确认邮箱开启IMAP服务
   - 查看系统日志

3. **Webhook不执行**
   - 检查URL地址是否正确
   - 确认目标服务器可访问
   - 查看Webhook日志

4. **管理界面无法访问**
   - 检查服务是否启动
   - 确认端口没有被占用
   - 检查防火墙设置

## 🔒 安全建议

1. **修改默认令牌** - 立即修改默认的管理员令牌
2. **使用HTTPS** - 生产环境建议使用SSL证书
3. **限制访问** - 通过防火墙限制管理界面访问
4. **定期备份** - 定期备份数据库文件
5. **更新依赖** - 定期更新Node.js依赖包

## 📖 开发指南

### 项目结构

```
easy-mail-system/
├── server.js              # 主服务器文件
├── package.json           # 项目配置
├── database/              # 数据库相关
│   └── init.js           # 数据库初始化
├── services/              # 服务层
│   ├── emailSender.js    # 邮件发送服务
│   ├── emailReceiver.js  # 邮件接收服务
│   └── webhookService.js # Webhook服务
├── routes/                # 路由层
│   ├── api.js            # 公开API路由
│   ├── admin.js          # 管理API路由
│   └── auth.js           # 认证路由
├── public/                # 前端文件
│   ├── index.html        # 管理界面
│   └── app.js            # 前端逻辑
└── data/                  # 数据目录
    └── mail_system.db    # SQLite数据库
```

### 扩展开发

- 添加新的邮件服务商支持
- 实现邮件模板功能
- 添加邮件调度功能
- 集成其他数据库（MySQL、PostgreSQL）

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📞 支持

如有问题，请：

1. 查看本文档的故障排除部分
2. 检查项目Issues
3. 提交新的Issue描述问题

---

**Easy Mail System** - 让邮件管理变得简单高效！ 