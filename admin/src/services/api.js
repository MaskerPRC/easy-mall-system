import axios from 'axios'
import { ElMessage } from 'element-plus'

// 创建axios实例
export const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    const message = error.response?.data?.error || error.message || '请求失败'
    
    // 401错误跳转到登录页
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

// API方法封装
export const adminApi = {
  // 统计信息
  getStats: () => api.get('/admin/stats'),
  
  // 域名管理
  getDomains: () => api.get('/admin/domains'),
  createDomain: (data) => api.post('/admin/domains', data),
  updateDomain: (id, data) => api.put(`/admin/domains/${id}`, data),
  deleteDomain: (id) => api.delete(`/admin/domains/${id}`),
  
  // 邮箱账户管理
  getAccounts: () => api.get('/admin/accounts'),
  createAccount: (data) => api.post('/admin/accounts', data),
  updateAccount: (id, data) => api.put(`/admin/accounts/${id}`, data),
  deleteAccount: (id) => api.delete(`/admin/accounts/${id}`),
  
  // 邮件管理
  getEmails: (params) => api.get('/admin/emails', { params }),
  getEmail: (id) => api.get(`/admin/emails/${id}`),
  
  // Webhook管理
  getWebhooks: () => api.get('/admin/webhooks'),
  createWebhook: (data) => api.post('/admin/webhooks', data),
  updateWebhook: (id, data) => api.put(`/admin/webhooks/${id}`, data),
  deleteWebhook: (id) => api.delete(`/admin/webhooks/${id}`),
  testWebhook: (id) => api.post(`/admin/webhooks/${id}/test`),
  getWebhookLogs: (id, limit) => api.get(`/admin/webhooks/${id}/logs`, { params: { limit } }),
  
  // 系统日志
  getLogs: (params) => api.get('/admin/logs', { params })
} 