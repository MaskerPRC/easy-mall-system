# 邮件服务器系统 - 前后端分离版

这是一个完整的自建邮件服务器系统，采用前后端分离架构，支持SMTP发送、IMAP接收以及现代化Web管理界面。

## 🚀 系统架构

### 前后端分离设计
```
easy-mail-system/
├── backend/                # 后端API服务 (Node.js + Express)
│   ├── server.js          # 主服务器
│   ├── database/          # 数据库初始化
│   ├── mail-server/       # SMTP/IMAP服务器
│   ├── routes/            # API路由
│   ├── services/          # 业务服务
│   └── utils/             # 工具函数
├── admin/                 # 前端管理界面 (Vue 3 + Vite)
│   ├── src/              # Vue源码
│   ├── public/           # 静态资源
│   └── dist/             # 构建产物
├── data/                 # 数据库文件
└── logs/                 # 日志文件
```

## 🌟 技术栈

### 后端 (Backend)
- **框架**: Node.js + Express
- **数据库**: SQLite
- **邮件服务**: smtp-server + mailparser
- **认证**: Bearer Token
- **API**: RESTful风格

### 前端 (Frontend)
- **框架**: Vue 3 + Composition API
- **构建工具**: Vite
- **UI组件**: Element Plus
- **状态管理**: Pinia
- **路由**: Vue Router 4

## 🚀 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0

### 1. 克隆项目
```bash
git clone <your-repo-url>
cd easy-mail-system
```

### 2. 安装依赖
```bash
# 安装项目依赖和前后端依赖
npm install
```

### 3. 初始化数据库
```bash
npm run setup
```

### 4. 启动服务

**开发模式 (推荐)**
```bash
# 同时启动前后端开发服务器
npm run dev
```
- 后端API: http://localhost:3000
- 前端界面: http://localhost:5173

**生产模式**
```bash
# 构建前端
npm run build

# 启动后端服务
npm start
```

### 5. 访问管理界面
打开浏览器访问: http://localhost:5173

默认管理员令牌: `your-secret-admin-token`

## 📋 可用脚本

### 项目级脚本
```bash
npm run dev              # 同时启动前后端开发服务器
npm start               # 启动后端生产服务器
npm run build           # 构建前端
npm run setup           # 初始化数据库
npm run install:all     # 安装前后端所有依赖
```

### 后端脚本
```bash
npm run backend:dev     # 启动后端开发服务器
npm run backend:start   # 启动后端生产服务器
npm run backend:setup   # 初始化数据库
```

### 前端脚本
```bash
npm run frontend:dev    # 启动前端开发服务器
npm run frontend:build  # 构建前端
npm run frontend:preview # 预览构建产物
```

## 🔗 前后端通信

### API接口规范
- **Base URL**: `http://localhost:3000/api`
- **认证方式**: `Authorization: Bearer <token>`
- **数据格式**: JSON

### 主要API端点
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/admin/stats` | 系统统计 |
| GET | `/api/admin/domains` | 域名列表 |
| POST | `/api/admin/domains` | 创建域名 |
| GET | `/api/admin/accounts` | 邮箱账户 |
| POST | `/api/admin/accounts` | 创建账户 |
| GET | `/api/admin/emails` | 邮件列表 |
| GET | `/api/admin/webhooks` | Webhook配置 |

### 跨域配置
后端已配置CORS允许前端访问:
```javascript
// 允许的来源
origins: [
  'http://localhost:5173', // Vue开发服务器
  'http://localhost:3000'  // 同源请求
]
```

## 🌐 功能模块

### 1. 仪表板 📊
- 系统概览和统计信息
- 服务状态监控
- 快速操作入口

### 2. 域名管理 🌍
- 添加/编辑/删除域名
- MX记录和SPF记录配置
- DNS配置指南

### 3. 邮箱账户管理 👤
- 创建/编辑/删除邮箱账户
- 密码管理和配额设置
- 管理员权限控制

### 4. 邮件管理 📧
- 查看邮件收发记录
- 邮件搜索和筛选
- 邮件详情查看

### 5. Webhook配置 🔗
- 创建和管理Webhook
- 事件触发配置
- 执行日志监控

### 6. 系统设置 ⚙️
- DNS配置指南
- 服务器状态查看
- API令牌管理

## 🔧 部署

### 开发环境
1. 启动后端: `npm run backend:dev`
2. 启动前端: `npm run frontend:dev`
3. 访问: http://localhost:5173

### 生产环境
1. 构建前端: `npm run build`
2. 启动后端: `npm start`
3. 配置Nginx代理前端静态文件

### Nginx配置示例
```nginx
server {
    listen 80;
    server_name mail.yourdomain.com;
    
    # 前端静态文件
    location / {
        root /path/to/easy-mail-system/admin/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # 后端API代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🛡️ 安全配置

### 认证机制
- 使用Bearer Token认证
- 所有管理API需要认证
- 前端自动处理token存储和刷新

### CORS策略
- 严格限制允许的来源
- 支持凭据传递
- 预检请求处理

### 速率限制
- API请求频率限制
- 防止暴力攻击
- 可配置的限制策略

## 📖 开发指南

### 后端开发
1. 进入backend目录: `cd backend`
2. 修改代码后自动重启: `npm run dev`
3. 添加新API路由: `routes/` 目录
4. 数据库操作: `database/` 目录

### 前端开发
1. 进入admin目录: `cd admin`
2. 启动开发服务器: `npm run dev`
3. 添加新页面: `src/views/` 目录
4. API调用: `src/services/api.js`

### 添加新功能
1. **后端**: 在 `backend/routes/` 添加API路由
2. **前端**: 在 `admin/src/` 添加对应页面和逻辑
3. **API**: 更新 `admin/src/services/api.js`
4. **路由**: 更新 `admin/src/router/index.js`

## 🔍 故障排除

### 常见问题

**端口冲突**
- 后端端口: 3000
- 前端端口: 5173
- SMTP端口: 25
- IMAP端口: 143

**API连接失败**
1. 检查后端服务是否启动
2. 检查CORS配置
3. 检查防火墙设置

**前端构建失败**
1. 检查Node.js版本 (>=16.0.0)
2. 清除node_modules重新安装
3. 检查依赖版本兼容性

### 日志查看
```bash
# 后端日志
tail -f logs/server.log

# 前端开发日志
# 在浏览器开发者工具中查看
```

## 📝 更新日志

### v2.0.0 (前后端分离版)
- ✨ 全新前后端分离架构
- 🎨 Vue 3 + Vite现代化前端
- ⚡ 大幅提升开发体验
- 🔧 完善的API接口设计
- 📱 响应式移动端适配

### v1.0.0
- 🎉 初始版本
- ✅ 基础邮件服务器功能
- 📧 集成式Web管理界面

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！

---

**🔥 推荐使用方式**: 开发时使用 `npm run dev` 同时启动前后端，生产环境使用Nginx代理前端并反向代理后端API。 