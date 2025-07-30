<template>
  <MainLayout>
    <div class="page-header">
      <div>
        <h1>Webhook配置</h1>
        <p>配置邮件事件的回调地址</p>
      </div>
      <el-button type="primary" @click="openWebhookForm()">
        <el-icon><Plus /></el-icon>
        添加Webhook
      </el-button>
    </div>
    
    <!-- Webhook列表 -->
    <el-card>
      <el-table
        :data="webhooks"
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="name" label="名称" min-width="120">
          <template #default="{ row }">
            <span class="webhook-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="url" label="URL" min-width="200">
          <template #default="{ row }">
            <el-tooltip :content="row.url" placement="top">
              <span class="webhook-url">{{ truncateText(row.url, 50) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        
        <el-table-column prop="method" label="方法" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="getMethodTagType(row.method)">
              {{ row.method }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="trigger_events" label="触发事件" width="120">
          <template #default="{ row }">
            <el-tag size="small" type="info">
              {{ getEventDisplayName(row.trigger_events) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="is_active" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'danger'" size="small">
              {{ row.is_active ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button link type="success" @click="testWebhook(row)" size="small">
              测试
            </el-button>
            <el-button link type="primary" @click="editWebhook(row)" size="small">
              编辑
            </el-button>
            <el-button link type="info" @click="viewLogs(row)" size="small">
              日志
            </el-button>
            <el-button link type="danger" @click="deleteWebhook(row)" size="small">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <div v-if="webhooks.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无Webhook配置">
          <el-button type="primary" @click="openWebhookForm()">添加第一个Webhook</el-button>
        </el-empty>
      </div>
    </el-card>
    
    <!-- Webhook表单对话框 -->
    <el-dialog
      v-model="showWebhookForm"
      :title="editingWebhook ? '编辑Webhook' : '添加Webhook'"
      width="600px"
    >
      <el-form
        ref="webhookFormRef"
        :model="webhookForm"
        :rules="webhookRules"
        label-width="120px"
      >
        <el-form-item label="名称" prop="name">
          <el-input
            v-model="webhookForm.name"
            placeholder="为这个Webhook起个名字"
          />
        </el-form-item>
        
        <el-form-item label="URL地址" prop="url">
          <el-input
            v-model="webhookForm.url"
            placeholder="https://your-api.com/webhook"
          />
        </el-form-item>
        
        <el-form-item label="请求方法" prop="method">
          <el-select v-model="webhookForm.method" style="width: 100%">
            <el-option label="POST" value="POST" />
            <el-option label="PUT" value="PUT" />
            <el-option label="PATCH" value="PATCH" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="触发事件" prop="triggerEvents">
          <el-select v-model="webhookForm.triggerEvents" style="width: 100%">
            <el-option label="邮件接收" value="email_received" />
            <el-option label="邮件发送" value="email_sent" />
            <el-option label="所有事件" value="all" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="请求头" prop="headers">
          <el-input
            v-model="webhookForm.headers"
            type="textarea"
            :rows="3"
            placeholder='{"Authorization": "Bearer token", "Content-Type": "application/json"}'
          />
        </el-form-item>
        
        <el-form-item label="重试次数" prop="retryCount">
          <el-input-number
            v-model="webhookForm.retryCount"
            :min="0"
            :max="10"
            style="width: 100%"
          />
        </el-form-item>
        
        <el-form-item label="超时时间(秒)" prop="timeout">
          <el-input-number
            v-model="webhookForm.timeout"
            :min="5"
            :max="300"
            style="width: 100%"
          />
        </el-form-item>
        
        <el-form-item label="状态" prop="isActive">
          <el-switch
            v-model="webhookForm.isActive"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="cancelWebhookForm">取消</el-button>
        <el-button type="primary" :loading="formLoading" @click="saveWebhook">
          {{ editingWebhook ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
    
    <!-- 日志查看对话框 -->
    <el-dialog
      v-model="showLogsDialog"
      title="Webhook执行日志"
      width="80%"
    >
      <el-table
        :data="logs"
        v-loading="logsLoading"
        stripe
        style="width: 100%"
        max-height="400"
      >
        <el-table-column prop="created_at" label="时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="event_type" label="事件" width="120">
          <template #default="{ row }">
            <el-tag size="small" type="info">
              {{ getEventDisplayName(row.event_type) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="status_code" label="状态码" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="getStatusTagType(row.status_code)">
              {{ row.status_code || 'N/A' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="response_time" label="响应时间" width="120">
          <template #default="{ row }">
            {{ row.response_time ? `${row.response_time}ms` : '-' }}
          </template>
        </el-table-column>
        
        <el-table-column prop="error_message" label="错误信息" min-width="200">
          <template #default="{ row }">
            <span v-if="row.error_message" class="error-message">
              {{ truncateText(row.error_message, 60) }}
            </span>
            <span v-else class="success-message">成功</span>
          </template>
        </el-table-column>
      </el-table>
      
      <div v-if="logs.length === 0 && !logsLoading" class="empty-state">
        <el-empty description="暂无执行日志" />
      </div>
    </el-dialog>
  </MainLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { adminApi } from '@/services/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import MainLayout from '@/layouts/MainLayout.vue'
import { Plus } from '@element-plus/icons-vue'

const webhooks = ref([])
const logs = ref([])
const loading = ref(false)
const logsLoading = ref(false)
const showWebhookForm = ref(false)
const showLogsDialog = ref(false)
const formLoading = ref(false)
const editingWebhook = ref(null)
const webhookFormRef = ref(null)

const webhookForm = reactive({
  name: '',
  url: '',
  method: 'POST',
  headers: '',
  triggerEvents: 'email_received',
  isActive: true,
  retryCount: 3,
  timeout: 30
})

const webhookRules = {
  name: [
    { required: true, message: '请输入Webhook名称', trigger: 'blur' }
  ],
  url: [
    { required: true, message: '请输入URL地址', trigger: 'blur' },
    { type: 'url', message: '请输入有效的URL地址', trigger: 'blur' }
  ]
}

const loadWebhooks = async () => {
  try {
    loading.value = true
    const response = await adminApi.getWebhooks()
    if (response.data.success) {
      webhooks.value = response.data.data
    }
  } catch (error) {
    console.error('加载Webhook列表失败:', error)
  } finally {
    loading.value = false
  }
}

const openWebhookForm = (webhook = null) => {
  editingWebhook.value = webhook
  if (webhook) {
    Object.assign(webhookForm, {
      name: webhook.name,
      url: webhook.url,
      method: webhook.method || 'POST',
      headers: webhook.headers || '',
      triggerEvents: webhook.trigger_events || 'email_received',
      isActive: !!webhook.is_active,
      retryCount: webhook.retry_count || 3,
      timeout: webhook.timeout || 30
    })
  } else {
    Object.assign(webhookForm, {
      name: '',
      url: '',
      method: 'POST',
      headers: '',
      triggerEvents: 'email_received',
      isActive: true,
      retryCount: 3,
      timeout: 30
    })
  }
  showWebhookForm.value = true
}

const cancelWebhookForm = () => {
  showWebhookForm.value = false
  editingWebhook.value = null
  webhookFormRef.value?.resetFields()
}

const editWebhook = (webhook) => {
  openWebhookForm(webhook)
}

const saveWebhook = async () => {
  if (!webhookFormRef.value) return
  
  await webhookFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        formLoading.value = true
        
        const data = {
          name: webhookForm.name,
          url: webhookForm.url,
          method: webhookForm.method,
          headers: webhookForm.headers,
          triggerEvents: webhookForm.triggerEvents,
          isActive: webhookForm.isActive,
          retryCount: webhookForm.retryCount,
          timeout: webhookForm.timeout
        }
        
        if (editingWebhook.value) {
          await adminApi.updateWebhook(editingWebhook.value.id, data)
          ElMessage.success('Webhook更新成功')
        } else {
          await adminApi.createWebhook(data)
          ElMessage.success('Webhook创建成功')
        }
        
        cancelWebhookForm()
        loadWebhooks()
      } catch (error) {
        console.error('保存Webhook失败:', error)
      } finally {
        formLoading.value = false
      }
    }
  })
}

const deleteWebhook = async (webhook) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除Webhook "${webhook.name}" 吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await adminApi.deleteWebhook(webhook.id)
    ElMessage.success('Webhook删除成功')
    loadWebhooks()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除Webhook失败:', error)
    }
  }
}

const testWebhook = async (webhook) => {
  try {
    const response = await adminApi.testWebhook(webhook.id)
    if (response.data.success) {
      ElMessage.success('Webhook测试成功')
    } else {
      ElMessage.error(`Webhook测试失败: ${response.data.message}`)
    }
  } catch (error) {
    console.error('测试Webhook失败:', error)
  }
}

const viewLogs = async (webhook) => {
  try {
    logsLoading.value = true
    showLogsDialog.value = true
    
    const response = await adminApi.getWebhookLogs(webhook.id, 50)
    if (response.data.success) {
      logs.value = response.data.data
    }
  } catch (error) {
    console.error('获取Webhook日志失败:', error)
  } finally {
    logsLoading.value = false
  }
}

const getMethodTagType = (method) => {
  const typeMap = {
    'POST': 'success',
    'PUT': 'warning',
    'PATCH': 'info'
  }
  return typeMap[method] || 'default'
}

const getEventDisplayName = (event) => {
  const nameMap = {
    'email_received': '邮件接收',
    'email_sent': '邮件发送',
    'all': '所有事件'
  }
  return nameMap[event] || event
}

const getStatusTagType = (statusCode) => {
  if (!statusCode) return 'info'
  if (statusCode >= 200 && statusCode < 300) return 'success'
  if (statusCode >= 400 && statusCode < 500) return 'warning'
  if (statusCode >= 500) return 'danger'
  return 'info'
}

const truncateText = (text, length) => {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

onMounted(() => {
  loadWebhooks()
})
</script>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #1f2937;
}

.page-header p {
  margin: 4px 0 0 0;
  color: #6b7280;
  font-size: 14px;
}

.webhook-name {
  font-weight: 500;
  color: #1f2937;
}

.webhook-url {
  font-family: monospace;
  font-size: 13px;
  color: #6b7280;
}

.error-message {
  color: #ef4444;
  font-size: 12px;
}

.success-message {
  color: #10b981;
  font-size: 12px;
}

.empty-state {
  padding: 40px 0;
  text-align: center;
}
</style> 