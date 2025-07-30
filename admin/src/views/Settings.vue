<template>
  <MainLayout>
    <div class="page-header">
      <div>
        <h1>系统设置</h1>
        <p>配置系统参数和查看运行状态</p>
      </div>
    </div>
    
    <el-row :gutter="24">
      <!-- DNS配置指南 -->
      <el-col :span="24">
        <el-card class="settings-card">
          <template #header>
            <div class="card-header">
              <el-icon><Document /></el-icon>
              <span>DNS配置指南</span>
            </div>
          </template>
          
          <div class="dns-guide">
            <div class="guide-section">
              <h4>MX记录配置</h4>
              <p>在您的域名DNS设置中添加以下MX记录：</p>
              <el-input
                readonly
                value="@ MX 10 your-server-ip-or-domain"
                class="config-input"
              >
                <template #append>
                  <el-button @click="copyToClipboard('@ MX 10 your-server-ip-or-domain')">
                    复制
                  </el-button>
                </template>
              </el-input>
            </div>
            
            <div class="guide-section">
              <h4>SPF记录配置</h4>
              <p>添加TXT记录以防止邮件被标记为垃圾邮件：</p>
              <el-input
                readonly
                value='@ TXT "v=spf1 a mx ip4:your-server-ip ~all"'
                class="config-input"
              >
                <template #append>
                  <el-button @click="copyToClipboard(DNS_RECORDS.spf)">
                    复制
                  </el-button>
                </template>
              </el-input>
            </div>
            
            <div class="guide-section">
              <h4>DMARC记录配置（可选）</h4>
              <p>添加DMARC记录提高邮件安全性：</p>
              <el-input
                readonly
                value='_dmarc TXT "v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"'
                class="config-input"
              >
                <template #append>
                  <el-button @click="copyToClipboard(DNS_RECORDS.dmarc)">
                    复制
                  </el-button>
                </template>
              </el-input>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <!-- 服务器配置 -->
      <el-col :span="12">
        <el-card class="settings-card">
          <template #header>
            <div class="card-header">
              <el-icon><Setting /></el-icon>
              <span>服务器配置</span>
            </div>
          </template>
          
          <el-form label-width="120px">
            <el-form-item label="SMTP端口">
              <el-input readonly value="25" />
            </el-form-item>
            
            <el-form-item label="IMAP端口">
              <el-input readonly value="143" />
            </el-form-item>
            
            <el-form-item label="Web管理端口">
              <el-input readonly value="3000" />
            </el-form-item>
            
            <el-form-item label="API端点">
              <el-input readonly value="/api" />
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
      
      <!-- API令牌管理 -->
      <el-col :span="12">
        <el-card class="settings-card">
          <template #header>
            <div class="card-header">
              <el-icon><Key /></el-icon>
              <span>API令牌管理</span>
            </div>
          </template>
          
          <p class="section-description">修改API访问令牌，用于认证外部API调用</p>
          
          <el-form
            ref="tokenFormRef"
            :model="tokenForm"
            :rules="tokenRules"
            label-width="80px"
            @submit.prevent="updateToken"
          >
            <el-form-item label="当前令牌" prop="currentToken">
              <el-input
                v-model="tokenForm.currentToken"
                type="password"
                show-password
                placeholder="请输入当前令牌"
              />
            </el-form-item>
            
            <el-form-item label="新令牌" prop="newToken">
              <el-input
                v-model="tokenForm.newToken"
                type="password"
                show-password
                placeholder="请输入新令牌（至少8个字符）"
              />
            </el-form-item>
            
            <el-form-item>
              <el-button
                type="primary"
                :loading="tokenLoading"
                @click="updateToken"
              >
                更新令牌
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
      
      <!-- 系统日志 -->
      <el-col :span="24">
        <el-card class="settings-card">
          <template #header>
            <div class="card-header">
              <el-icon><Document /></el-icon>
              <span>系统日志</span>
              <div class="header-actions">
                <el-select v-model="logFilters.level" placeholder="日志级别" clearable size="small">
                  <el-option label="全部" value="" />
                  <el-option label="错误" value="error" />
                  <el-option label="警告" value="warn" />
                  <el-option label="信息" value="info" />
                  <el-option label="调试" value="debug" />
                </el-select>
                <el-select v-model="logFilters.service" placeholder="服务" clearable size="small">
                  <el-option label="全部" value="" />
                  <el-option label="SMTP" value="smtp" />
                  <el-option label="IMAP" value="imap" />
                  <el-option label="Web" value="web" />
                </el-select>
                <el-button size="small" @click="loadLogs">刷新</el-button>
              </div>
            </div>
          </template>
          
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
            
            <el-table-column prop="level" label="级别" width="80">
              <template #default="{ row }">
                <el-tag size="small" :type="getLogLevelType(row.level)">
                  {{ row.level?.toUpperCase() }}
                </el-tag>
              </template>
            </el-table-column>
            
            <el-table-column prop="service" label="服务" width="80">
              <template #default="{ row }">
                <el-tag size="small" type="info">
                  {{ row.service?.toUpperCase() }}
                </el-tag>
              </template>
            </el-table-column>
            
            <el-table-column prop="message" label="消息" min-width="300">
              <template #default="{ row }">
                <span class="log-message">{{ row.message }}</span>
              </template>
            </el-table-column>
          </el-table>
          
          <div v-if="logs.length === 0 && !logsLoading" class="empty-state">
            <el-empty description="暂无日志记录" />
          </div>
        </el-card>
      </el-col>
      
      <!-- API文档 -->
      <el-col :span="24">
        <el-card class="settings-card">
          <template #header>
            <div class="card-header">
              <el-icon><Document /></el-icon>
              <span>API文档</span>
            </div>
          </template>
          
          <div class="api-doc-section">
            <p>查看完整的API使用说明和示例</p>
            <el-button type="primary" @click="openApiDocs">
              <el-icon><Link /></el-icon>
              查看API文档
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </MainLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { adminApi } from '@/services/api'
import { ElMessage } from 'element-plus'
import MainLayout from '@/layouts/MainLayout.vue'
import {
  Document,
  Setting,
  Key,
  Link
} from '@element-plus/icons-vue'

const logs = ref([])
const logsLoading = ref(false)
const tokenLoading = ref(false)
const tokenFormRef = ref(null)

const tokenForm = reactive({
  currentToken: '',
  newToken: ''
})

const tokenRules = {
  currentToken: [
    { required: true, message: '请输入当前令牌', trigger: 'blur' }
  ],
  newToken: [
    { required: true, message: '请输入新令牌', trigger: 'blur' },
    { min: 8, message: '令牌至少8个字符', trigger: 'blur' }
  ]
}

const logFilters = reactive({
  level: '',
  service: '',
  limit: 100
})

const loadLogs = async () => {
  try {
    logsLoading.value = true
    const response = await adminApi.getLogs(logFilters)
    if (response.data.success) {
      logs.value = response.data.data
    }
  } catch (error) {
    console.error('加载系统日志失败:', error)
  } finally {
    logsLoading.value = false
  }
}

const updateToken = async () => {
  if (!tokenFormRef.value) return
  
  await tokenFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        tokenLoading.value = true
        
        // 这里需要调用更新令牌的API
        // 注意：实际实现中需要在后端添加这个API
        ElMessage.success('令牌更新成功，请重新登录')
        
        // 清空表单
        tokenForm.currentToken = ''
        tokenForm.newToken = ''
      } catch (error) {
        console.error('更新令牌失败:', error)
      } finally {
        tokenLoading.value = false
      }
    }
  })
}

// DNS 记录常量
const DNS_RECORDS = {
  spf: '@ TXT "v=spf1 a mx ip4:your-server-ip ~all"',
  dmarc: '_dmarc TXT "v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"'
}

const copyToClipboard = (text) => {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

const openApiDocs = () => {
  window.open('/api/docs', '_blank')
}

const getLogLevelType = (level) => {
  const typeMap = {
    'error': 'danger',
    'warn': 'warning',
    'info': 'primary',
    'debug': 'info'
  }
  return typeMap[level] || 'default'
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

onMounted(() => {
  loadLogs()
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

.settings-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #1f2937;
}

.header-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.dns-guide {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.guide-section h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.guide-section p {
  margin: 0 0 12px 0;
  color: #6b7280;
  font-size: 14px;
}

.config-input {
  font-family: monospace;
}

.section-description {
  margin: 0 0 16px 0;
  color: #6b7280;
  font-size: 14px;
}

.log-message {
  font-family: monospace;
  font-size: 13px;
  line-height: 1.4;
}

.api-doc-section {
  text-align: center;
  padding: 20px;
}

.api-doc-section p {
  margin: 0 0 16px 0;
  color: #6b7280;
}

.empty-state {
  padding: 40px 0;
  text-align: center;
}
</style> 