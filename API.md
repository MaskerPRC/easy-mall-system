# Easy Mail System API 文档

## 概述

Easy Mail System 提供完整的RESTful API，支持邮件发送、账户管理等功能。所有API都需要通过Bearer Token进行认证。

## 认证

### 获取访问令牌

访问管理界面获取或修改API访问令牌，默认令牌为 `admin123456`。

### 认证方式

在所有API请求的Header中添加：

```
Authorization: Bearer YOUR_API_TOKEN
Content-Type: application/json
```

## 公开API

### 邮件发送

#### 发送单个邮件

**POST** `/api/send`

发送一封邮件到指定收件人。

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| accountId | number | 是 | 邮件账户ID |
| to | string/array | 是 | 收件人邮箱地址 |
| cc | string | 否 | 抄送邮箱地址 |
| bcc | string | 否 | 密送邮箱地址 |
| subject | string | 是 | 邮件主题 |
| text | string | 否 | 纯文本内容 |
| html | string | 否 | HTML内容 |
| attachments | array | 否 | 附件列表 |

**注意：** `text` 和 `html` 至少需要提供一个。

**请求示例：**

```json
{
  "accountId": 1,
  "to": "recipient@example.com",
  "cc": "cc@example.com",
  "subject": "测试邮件",
  "text": "这是邮件的纯文本内容",
  "html": "<h1>这是邮件的HTML内容</h1>",
  "attachments": [
    {
      "filename": "document.pdf",
      "path": "/path/to/file.pdf"
    }
  ]
}
```

**响应示例：**

```json
{
  "success": true,
  "message": "邮件发送成功",
  "data": {
    "emailId": 123,
    "messageId": "unique-message-id"
  }
}
```

#### 批量发送邮件

**POST** `/api/send/bulk`

批量发送多封邮件。

**请求参数：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| emails | array | 是 | 邮件列表，每个元素包含单个邮件的所有字段 |

**请求示例：**

```json
{
  "emails": [
    {
      "accountId": 1,
      "to": "user1@example.com",
      "subject": "邮件标题1",
      "text": "邮件内容1"
    },
    {
      "accountId": 1,
      "to": "user2@example.com",
      "subject": "邮件标题2",
      "text": "邮件内容2"
    }
  ]
}
```

**响应示例：**

```json
{
  "success": true,
  "message": "批量发送完成: 2 成功, 0 失败",
  "data": {
    "total": 2,
    "success": 2,
    "failed": 0,
    "results": [
      {
        "success": true,
        "emailId": 123,
        "messageId": "message-id-1",
        "index": 0
      },
      {
        "success": true,
        "emailId": 124,
        "messageId": "message-id-2",
        "index": 1
      }
    ]
  }
}
```

### 账户查询

#### 获取可用账户列表

**GET** `/api/accounts`

获取所有启用的邮件账户基本信息。

**响应示例：**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "sender@example.com",
      "smtp_host": "smtp.example.com",
      "is_active": true
    }
  ]
}
```

### 统计信息

#### 获取发送统计

**GET** `/api/stats`

获取邮件发送统计信息。

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| accountId | number | 可选，指定账户ID |
| days | number | 可选，统计天数，默认7天 |

**响应示例：**

```json
{
  "success": true,
  "data": [
    {
      "status": "sent",
      "count": 156,
      "date": "2023-12-01"
    },
    {
      "status": "failed",
      "count": 3,
      "date": "2023-12-01"
    }
  ]
}
```

### 健康检查

#### 服务状态检查

**GET** `/api/health`

检查API服务状态。

**响应示例：**

```json
{
  "status": "ok",
  "service": "Easy Mail System API",
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

## 管理端API

### 认证管理

#### 管理员登录

**POST** `/auth/admin/login`

验证管理员令牌。

**请求参数：**

```json
{
  "token": "admin123456"
}
```

**响应示例：**

```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "admin123456",
    "role": "admin"
  }
}
```

#### 修改管理员令牌

**PUT** `/auth/admin/token`

修改API访问令牌。

**请求参数：**

```json
{
  "currentToken": "admin123456",
  "newToken": "new-secure-token"
}
```

### 邮件管理

#### 获取邮件列表

**GET** `/admin/emails`

获取所有邮件记录。

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码，默认1 |
| limit | number | 每页数量，默认20 |
| direction | string | 方向筛选：incoming/outgoing |
| status | string | 状态筛选：pending/sent/failed/received |
| accountId | number | 账户筛选 |
| search | string | 搜索关键词 |

**响应示例：**

```json
{
  "success": true,
  "data": {
    "emails": [
      {
        "id": 1,
        "message_id": "unique-id",
        "direction": "outgoing",
        "from_address": "sender@example.com",
        "to_address": "recipient@example.com",
        "subject": "测试邮件",
        "status": "sent",
        "created_at": "2023-12-01T10:00:00.000Z",
        "account_email": "sender@example.com"
      }
    ],
    "pagination": {
      "current": 1,
      "total": 10,
      "count": 100,
      "limit": 20
    }
  }
}
```

#### 获取邮件详情

**GET** `/admin/emails/:id`

获取单个邮件的详细信息。

**响应示例：**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "message_id": "unique-id",
    "direction": "incoming",
    "from_address": "sender@example.com",
    "to_address": "recipient@example.com",
    "subject": "邮件主题",
    "content": "纯文本内容",
    "html_content": "<p>HTML内容</p>",
    "attachments": [
      {
        "filename": "attachment.pdf",
        "contentType": "application/pdf",
        "size": 12345
      }
    ],
    "status": "received",
    "created_at": "2023-12-01T10:00:00.000Z"
  }
}
```

### 账户管理

#### 获取所有账户

**GET** `/admin/accounts`

获取所有邮件账户信息。

**响应示例：**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "email": "test@example.com",
      "password": "***",
      "smtp_host": "smtp.example.com",
      "smtp_port": 587,
      "imap_host": "imap.example.com",
      "imap_port": 993,
      "use_ssl": true,
      "is_active": true,
      "created_at": "2023-12-01T10:00:00.000Z"
    }
  ]
}
```

#### 创建邮件账户

**POST** `/admin/accounts`

添加新的邮件账户。

**请求参数：**

```json
{
  "email": "new@example.com",
  "password": "password123",
  "smtpHost": "smtp.example.com",
  "smtpPort": 587,
  "imapHost": "imap.example.com",
  "imapPort": 993,
  "useSsl": true,
  "isActive": true
}
```

#### 更新邮件账户

**PUT** `/admin/accounts/:id`

更新现有邮件账户信息。

#### 删除邮件账户

**DELETE** `/admin/accounts/:id`

删除指定的邮件账户。

### Webhook管理

#### 获取Webhook配置

**GET** `/admin/webhooks`

获取所有Webhook配置。

**响应示例：**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "测试Webhook",
      "url": "https://api.example.com/webhook",
      "method": "POST",
      "headers": "{\"Content-Type\":\"application/json\"}",
      "is_active": true,
      "retry_count": 3,
      "timeout": 30,
      "created_at": "2023-12-01T10:00:00.000Z"
    }
  ]
}
```

#### 创建Webhook配置

**POST** `/admin/webhooks`

创建新的Webhook配置。

**请求参数：**

```json
{
  "name": "我的Webhook",
  "url": "https://api.example.com/webhook",
  "method": "POST",
  "headers": "{\"Authorization\":\"Bearer token\"}",
  "isActive": true,
  "retryCount": 3,
  "timeout": 30
}
```

#### 测试Webhook

**POST** `/admin/webhooks/:id/test`

测试指定的Webhook配置。

**响应示例：**

```json
{
  "success": true,
  "message": "Webhook测试成功",
  "data": {
    "success": true,
    "statusCode": 200,
    "response": {"received": true}
  }
}
```

#### 获取Webhook日志

**GET** `/admin/webhooks/:id/logs`

获取指定Webhook的执行日志。

**查询参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| limit | number | 返回记录数，默认50 |

### 系统统计

#### 获取系统统计

**GET** `/admin/stats`

获取系统整体统计信息。

**响应示例：**

```json
{
  "success": true,
  "data": {
    "totalEmails": 1250,
    "sentEmails": 800,
    "receivedEmails": 450,
    "totalAccounts": 3,
    "activeAccounts": 2,
    "totalWebhooks": 2
  }
}
```

## 错误响应

所有API在出错时都会返回标准的错误响应格式：

```json
{
  "error": "错误类型",
  "message": "详细错误信息"
}
```

### 常见错误码

| HTTP状态码 | 错误类型 | 说明 |
|------------|----------|------|
| 400 | 参数错误 | 请求参数不正确或缺失 |
| 401 | 认证失败 | 缺少或无效的访问令牌 |
| 403 | 权限不足 | 令牌无效或已过期 |
| 404 | 资源不存在 | 请求的资源不存在 |
| 500 | 服务器错误 | 内部服务器错误 |

## Webhook数据格式

当系统接收到邮件时，会向配置的Webhook URL发送POST请求：

```json
{
  "emailId": 123,
  "messageId": "unique-message-id",
  "account": {
    "id": 1,
    "email": "receiver@example.com"
  },
  "from": {
    "text": "sender@example.com",
    "value": [
      {
        "address": "sender@example.com",
        "name": "发件人姓名"
      }
    ]
  },
  "to": {
    "text": "receiver@example.com",
    "value": [
      {
        "address": "receiver@example.com",
        "name": "收件人姓名"
      }
    ]
  },
  "cc": {
    "text": "cc@example.com"
  },
  "bcc": {
    "text": "bcc@example.com"
  },
  "subject": "邮件主题",
  "text": "邮件纯文本内容",
  "html": "<p>邮件HTML内容</p>",
  "date": "2023-12-01T10:00:00.000Z",
  "attachments": [
    {
      "filename": "document.pdf",
      "contentType": "application/pdf",
      "size": 12345
    }
  ],
  "timestamp": "2023-12-01T10:00:00.000Z"
}
```

## 使用示例

### Node.js 示例

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3000';
const API_TOKEN = 'your-api-token';

// 发送邮件
async function sendEmail() {
  try {
    const response = await axios.post(`${API_BASE}/api/send`, {
      accountId: 1,
      to: 'recipient@example.com',
      subject: '测试邮件',
      text: '这是一封测试邮件'
    }, {
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('邮件发送成功:', response.data);
  } catch (error) {
    console.error('发送失败:', error.response?.data || error.message);
  }
}
```

### Python 示例

```python
import requests

API_BASE = 'http://localhost:3000'
API_TOKEN = 'your-api-token'

headers = {
    'Authorization': f'Bearer {API_TOKEN}',
    'Content-Type': 'application/json'
}

# 发送邮件
def send_email():
    data = {
        'accountId': 1,
        'to': 'recipient@example.com',
        'subject': '测试邮件',
        'text': '这是一封测试邮件'
    }
    
    try:
        response = requests.post(f'{API_BASE}/api/send', json=data, headers=headers)
        response.raise_for_status()
        print('邮件发送成功:', response.json())
    except requests.exceptions.RequestException as e:
        print('发送失败:', e)
```

### cURL 示例

```bash
# 发送邮件
curl -X POST http://localhost:3000/api/send \
  -H "Authorization: Bearer your-api-token" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": 1,
    "to": "recipient@example.com",
    "subject": "测试邮件",
    "text": "这是一封测试邮件"
  }'

# 获取统计信息
curl -X GET http://localhost:3000/api/stats \
  -H "Authorization: Bearer your-api-token"
```

## 速率限制

为了保护系统资源，API实施了速率限制：

- **限制规则：** 每个IP地址每15分钟最多100个请求
- **超限响应：** HTTP 429 Too Many Requests
- **重置时间：** 15分钟后自动重置

## 版本信息

- **当前版本：** v1.0.0
- **API版本：** v1
- **最后更新：** 2023-12-01

如有问题或建议，请查看项目文档或提交Issue。 