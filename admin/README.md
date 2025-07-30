# 邮件服务器管理端 (Vue+Vite)

这是一个基于 Vue 3 + Vite + Element Plus 的现代化邮件服务器管理界面，用于替代原有的HTML+Vue CDN实现。

## 功能特性

- 🚀 **现代化技术栈**: Vue 3 + Vite + Pinia + Element Plus
- 📱 **响应式设计**: 适配桌面和移动设备
- 🎨 **美观的UI**: 基于Element Plus的现代化界面设计
- 🔧 **完整功能**: 域名管理、邮箱账户、邮件列表、Webhook配置、系统设置
- 🔒 **安全认证**: 基于Token的身份认证
- ⚡ **高性能**: Vite构建工具，开发和构建速度快

## 功能模块

### 1. 仪表板
- 系统概览和统计信息
- 服务状态监控
- 快速操作入口

### 2. 域名管理
- 添加/编辑/删除域名
- MX记录和SPF记录配置
- 域名状态管理

### 3. 邮箱账户管理
- 创建/编辑/删除邮箱账户
- 配额管理和使用情况
- 管理员权限控制

### 4. 邮件列表
- 查看所有邮件记录
- 邮件搜索和筛选
- 邮件详情查看

### 5. Webhook配置
- 创建和管理Webhook
- 事件触发配置
- 执行日志查看

### 6. 系统设置
- DNS配置指南
- 服务器配置信息
- API令牌管理
- 系统日志查看

## 技术栈

- **框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **UI组件库**: Element Plus
- **状态管理**: Pinia
- **路由**: Vue Router 4
- **HTTP客户端**: Axios
- **语言**: JavaScript

## 开发环境要求

- Node.js >= 16.0.0
- npm >= 8.0.0

## 安装和启动

### 1. 安装依赖

```bash
cd admin
npm install
```

### 2. 开发模式启动

```bash
npm run dev
```

应用将在 http://localhost:5173 启动，并自动代理API请求到后端服务器 (http://localhost:3000)。

### 3. 构建生产版本

```bash
npm run build
```

构建产物将生成在 `dist` 目录中。

### 4. 预览生产版本

```bash
npm run preview
```

## 项目结构

```
admin/
├── public/                 # 静态资源
├── src/
│   ├── components/        # 通用组件
│   ├── layouts/          # 布局组件
│   │   └── MainLayout.vue
│   ├── router/           # 路由配置
│   │   └── index.js
│   ├── services/         # API服务
│   │   └── api.js
│   ├── stores/           # 状态管理
│   │   └── auth.js
│   ├── views/            # 页面组件
│   │   ├── Login.vue
│   │   ├── Dashboard.vue
│   │   ├── Domains.vue
│   │   ├── Accounts.vue
│   │   ├── Emails.vue
│   │   ├── Webhooks.vue
│   │   └── Settings.vue
│   ├── App.vue           # 根组件
│   └── main.js           # 入口文件
├── index.html            # HTML模板
├── package.json          # 项目配置
├── vite.config.js        # Vite配置
└── README.md            # 说明文档
```

## 配置说明

### Vite配置 (vite.config.js)

- **端口**: 5173 (开发模式)
- **API代理**: `/api` 代理到 `http://localhost:3000`
- **别名**: `@` 指向 `src` 目录
- **自动导入**: Element Plus组件和Vue API

### 路由配置

所有管理页面都需要认证，只有登录页面无需认证。路由守卫会自动处理身份验证。

### API服务

API服务封装了所有后端接口调用，支持：
- 自动添加认证头
- 错误处理和消息提示
- 401错误自动跳转登录

## 与后端集成

### API接口

确保后端服务器在 `http://localhost:3000` 运行，并提供以下API端点：

- `GET /api/admin/stats` - 获取统计信息
- `GET /api/admin/domains` - 获取域名列表
- `POST /api/admin/domains` - 创建域名
- `PUT /api/admin/domains/:id` - 更新域名
- `DELETE /api/admin/domains/:id` - 删除域名
- 其他邮箱、邮件、Webhook相关接口...

### 认证方式

使用Bearer Token认证：
```
Authorization: Bearer <admin-token>
```

## 部署

### 1. 构建项目

```bash
npm run build
```

### 2. 部署静态文件

将 `dist` 目录中的文件部署到Web服务器，确保：
- 配置单页应用路由支持
- API请求代理到后端服务器

### 3. Nginx配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 前端静态文件
    location / {
        root /path/to/admin/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # API代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 开发指南

### 添加新页面

1. 在 `src/views/` 创建新的Vue组件
2. 在 `src/router/index.js` 添加路由配置
3. 在 `src/layouts/MainLayout.vue` 添加菜单项

### 添加新API

1. 在 `src/services/api.js` 的 `adminApi` 对象中添加新方法
2. 在页面组件中调用相应的API方法

### 状态管理

使用Pinia进行状态管理，当前已实现：
- `useAuthStore` - 身份认证状态

## 浏览器兼容性

- Chrome >= 87
- Firefox >= 78
- Safari >= 14
- Edge >= 88

## 许可证

MIT License 