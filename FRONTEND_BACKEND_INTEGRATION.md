# 前后端联动逻辑说明

## 🏗️ 架构概览

```
┌─────────────────┐    HTTP/AJAX     ┌─────────────────┐
│                 │ ────────────────>│                 │
│   Vue 3 前端    │                  │  Node.js 后端   │
│  (localhost:5173)│<──────────────── │ (localhost:3000)│
│                 │   JSON Response  │                 │
└─────────────────┘                  └─────────────────┘
        │                                     │
        │                                     │
        ▼                                     ▼
┌─────────────────┐                  ┌─────────────────┐
│  Element Plus   │                  │ Express Router  │
│  Components     │                  │ + SQLite DB     │
└─────────────────┘                  └─────────────────┘
```

## 🔄 数据流向

### 1. 前端发起请求
```javascript
// admin/src/services/api.js
const response = await adminApi.getDomains()
```

### 2. Axios拦截器处理
```javascript
// 请求拦截器 - 自动添加认证头
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin-token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

### 3. 后端接收并处理
```javascript
// backend/routes/admin.js
router.get('/domains', authenticateAdmin, (req, res) => {
  // 查询数据库
  db.all('SELECT * FROM domains', (err, rows) => {
    res.json({ success: true, data: rows })
  })
})
```

### 4. 前端接收响应
```javascript
// 响应拦截器 - 错误处理
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 自动跳转登录
      window.location.href = '/login'
    }
    ElMessage.error(error.response?.data?.error)
  }
)
```

## 🔐 认证流程

### 登录验证
```mermaid
sequenceDiagram
    participant F as 前端 (Vue)
    participant B as 后端 (Express)
    participant D as 数据库 (SQLite)
    
    F->>B: POST /api/admin/stats (with token)
    B->>D: SELECT config_value FROM system_config
    D->>B: 返回存储的token
    B->>B: 验证token是否匹配
    B->>F: 返回验证结果
    
    alt 验证成功
        F->>F: 存储token到localStorage
        F->>F: 设置API默认头部
        F->>F: 跳转到Dashboard
    else 验证失败
        F->>F: 显示错误消息
        F->>F: 停留在登录页
    end
```

### 认证中间件
```javascript
// backend/routes/admin.js
function authenticateAdmin(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: '需要管理员权限' })
  }
  
  // 验证token
  db.get('SELECT config_value FROM system_config WHERE config_key = ?', 
    ['admin_token'], (err, row) => {
      if (!row || row.config_value !== token) {
        return res.status(403).json({ error: '无效的管理员令牌' })
      }
      next()
    })
}
```

## 📡 API接口设计

### 统一响应格式
```javascript
// 成功响应
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}

// 错误响应  
{
  "success": false,
  "error": "错误信息",
  "code": "ERROR_CODE"
}
```

### 主要接口映射

#### 1. 系统统计
```javascript
// 前端调用
const stats = await adminApi.getStats()

// 后端实现
GET /api/admin/stats
→ 查询domains、accounts、emails等表的统计数据
→ 返回聚合统计信息
```

#### 2. 域名管理
```javascript
// 获取域名列表
GET /api/admin/domains
→ SELECT * FROM domains ORDER BY created_at DESC

// 创建域名
POST /api/admin/domains
Body: { domain, mxRecord, spfRecord }
→ INSERT INTO domains (domain, mx_record, spf_record) VALUES (...)

// 更新域名
PUT /api/admin/domains/:id
Body: { domain, mxRecord, spfRecord, isActive }
→ UPDATE domains SET ... WHERE id = ?

// 删除域名
DELETE /api/admin/domains/:id
→ 检查是否有关联账户 → DELETE FROM domains WHERE id = ?
```

#### 3. 邮箱账户管理
```javascript
// 获取账户列表
GET /api/admin/accounts
→ SELECT ma.*, d.domain FROM mail_accounts ma LEFT JOIN domains d

// 创建账户
POST /api/admin/accounts
Body: { email, password, displayName, domainId, quotaMb, isActive, isAdmin }
→ 密码加密 → INSERT INTO mail_accounts → 创建默认文件夹

// 更新账户
PUT /api/admin/accounts/:id
→ 动态构建UPDATE语句 → 可选密码更新

// 删除账户
DELETE /api/admin/accounts/:id
→ 删除关联数据 → 删除账户记录
```

## 🔄 状态管理

### Pinia Store结构
```javascript
// admin/src/stores/auth.js
export const useAuthStore = defineStore('auth', () => {
  // 状态
  const token = ref(localStorage.getItem('admin-token') || '')
  const loading = ref(false)
  
  // 计算属性
  const isAuthenticated = computed(() => !!token.value)
  
  // 方法
  const login = async (loginToken) => { ... }
  const logout = () => { ... }
  const initAuth = () => { ... }
  
  return { token, loading, isAuthenticated, login, logout, initAuth }
})
```

### 组件中使用
```vue
<script setup>
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

// 检查认证状态
if (!authStore.isAuthenticated) {
  router.push('/login')
}

// 登录
const handleLogin = async () => {
  const result = await authStore.login(loginForm.token)
  if (result.success) {
    router.push('/')
  }
}
</script>
```

## 🛣️ 路由保护

### 路由守卫
```javascript
// admin/src/router/index.js
router.beforeEach((to) => {
  const authStore = useAuthStore()
  
  // 需要认证的路由
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'Login' }
  }
  
  // 已登录用户访问登录页，重定向到首页
  if (to.name === 'Login' && authStore.isAuthenticated) {
    return { name: 'Dashboard' }
  }
})
```

### 路由配置
```javascript
const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Dashboard', 
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true }
  }
  // ...其他路由
]
```

## 🔧 开发环境配置

### Vite代理配置
```javascript
// admin/vite.config.js
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
```

### 后端CORS配置
```javascript
// backend/server.js
app.use(cors({
  origin: [
    'http://localhost:5173', // Vue开发服务器
    'http://localhost:3000', // 同源
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000'
  ],
  credentials: true
}))
```

## 📊 错误处理机制

### 前端错误处理
```javascript
// 全局错误处理
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || '请求失败'
    
    // 401错误 - 自动跳转登录
    if (error.response?.status === 401) {
      localStorage.removeItem('admin-token')
      window.location.href = '/login'
      return Promise.reject(error)
    }
    
    // 显示错误消息
    ElMessage.error(message)
    return Promise.reject(error)
  }
)
```

### 后端错误处理
```javascript
// 统一错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ 
    success: false,
    error: 'Something broke!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
})
```

## 🚀 性能优化

### 前端优化
- **路由懒加载**: `() => import('@/views/Dashboard.vue')`
- **组件按需引入**: Element Plus自动导入
- **API缓存**: 合理使用缓存避免重复请求
- **分页加载**: 大数据列表分页处理

### 后端优化
- **数据库连接池**: SQLite连接复用
- **速率限制**: 防止API滥用
- **压缩中间件**: gzip压缩响应
- **缓存策略**: 静态数据缓存

## 🔍 调试技巧

### 前端调试
```javascript
// 开启API请求日志
api.interceptors.request.use((config) => {
  console.log('API Request:', config)
  return config
})

api.interceptors.response.use((response) => {
  console.log('API Response:', response.data)
  return response
})
```

### 后端调试
```javascript
// 请求日志中间件
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body)
  next()
})
```

## 🧪 测试方式

### API测试
```bash
# 健康检查
curl http://localhost:3000/health

# 认证测试
curl -H "Authorization: Bearer your-secret-admin-token" \
     http://localhost:3000/api/admin/stats
```

### 前端测试
1. 打开 http://localhost:5173
2. 使用管理员令牌登录
3. 检查各功能模块是否正常工作
4. 查看浏览器网络面板确认API调用

## 📋 部署检查清单

- [ ] 后端API服务正常启动 (端口3000)
- [ ] 前端构建成功 (npm run build)
- [ ] CORS配置正确
- [ ] 数据库初始化完成
- [ ] 管理员令牌配置正确
- [ ] Nginx代理配置 (生产环境)
- [ ] 防火墙端口开放
- [ ] SSL证书配置 (生产环境)

通过以上设计，前后端实现了完全分离，各自独立开发和部署，同时保持良好的通信和协作。 