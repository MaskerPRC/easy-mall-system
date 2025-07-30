<template>
  <MainLayout>
    <div class="page-header">
      <div>
        <h1>邮件列表</h1>
        <p>查看所有邮件的收发记录</p>
      </div>
      <el-button type="primary" @click="refreshEmails">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>
    
    <!-- 筛选器 -->
    <el-card class="filter-card">
      <el-row :gutter="16">
        <el-col :span="8">
          <el-input
            v-model="filters.search"
            placeholder="搜索主题、发件人、收件人"
            clearable
            @input="debounceSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-col>
        
        <el-col :span="6">
          <el-select
            v-model="filters.accountId"
            placeholder="选择账户"
            clearable
            @change="loadEmails"
          >
            <el-option label="全部账户" value="" />
            <el-option
              v-for="account in accounts"
              :key="account.id"
              :label="account.email"
              :value="account.id"
            />
          </el-select>
        </el-col>
        
        <el-col :span="6">
          <el-select
            v-model="filters.folder"
            placeholder="选择文件夹"
            clearable
            @change="loadEmails"
          >
            <el-option label="全部文件夹" value="" />
            <el-option label="收件箱" value="INBOX" />
            <el-option label="已发送" value="Sent" />
            <el-option label="草稿" value="Drafts" />
            <el-option label="垃圾箱" value="Trash" />
          </el-select>
        </el-col>
        
        <el-col :span="4">
          <el-button type="primary" @click="loadEmails">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
        </el-col>
      </el-row>
    </el-card>
    
    <!-- 邮件列表 -->
    <el-card>
      <el-table
        :data="emails"
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="received_at" label="时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.received_at) }}
          </template>
        </el-table-column>
        
        <el-table-column prop="folder" label="文件夹" width="100">
          <template #default="{ row }">
            <el-tag :type="getFolderTagType(row.folder)" size="small">
              {{ getFolderDisplayName(row.folder) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="from_address" label="发件人" min-width="180">
          <template #default="{ row }">
            <span class="email-address">{{ truncateText(row.from_address, 30) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="to_addresses" label="收件人" min-width="180">
          <template #default="{ row }">
            <span class="email-address">
              {{ truncateText(Array.isArray(row.to_addresses) ? row.to_addresses.join(', ') : row.to_addresses || '', 30) }}
            </span>
          </template>
        </el-table-column>
        
        <el-table-column prop="subject" label="主题" min-width="200">
          <template #default="{ row }">
            <div class="subject-cell">
              <span class="subject-text">{{ truncateText(row.subject, 40) }}</span>
              <div class="subject-icons">
                <el-icon v-if="hasAttachments(row)" class="attachment-icon">
                  <Paperclip />
                </el-icon>
                <div v-if="!row.is_read" class="unread-dot"></div>
              </div>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="size_bytes" label="大小" width="100">
          <template #default="{ row }">
            {{ formatFileSize(row.size_bytes) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewEmail(row)">
              查看
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 分页 -->
      <div v-if="pagination.total > 1" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.current"
          v-model:page-size="pagination.limit"
          :total="pagination.count"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
      
      <div v-if="emails.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无邮件记录" />
      </div>
    </el-card>
    
    <!-- 邮件详情对话框 -->
    <el-dialog
      v-model="showEmailDetail"
      title="邮件详情"
      width="80%"
      class="email-dialog"
    >
      <div v-if="selectedEmail" class="email-detail">
        <div class="email-header">
          <el-descriptions :column="1" border>
            <el-descriptions-item label="主题">
              {{ selectedEmail.subject }}
            </el-descriptions-item>
            <el-descriptions-item label="发件人">
              {{ selectedEmail.from_address }}
            </el-descriptions-item>
            <el-descriptions-item label="收件人">
              {{ Array.isArray(selectedEmail.to_addresses) ? selectedEmail.to_addresses.join(', ') : selectedEmail.to_addresses }}
            </el-descriptions-item>
            <el-descriptions-item v-if="selectedEmail.cc_addresses?.length" label="抄送">
              {{ selectedEmail.cc_addresses.join(', ') }}
            </el-descriptions-item>
            <el-descriptions-item label="时间">
              {{ formatDate(selectedEmail.received_at) }}
            </el-descriptions-item>
            <el-descriptions-item v-if="hasAttachments(selectedEmail)" label="附件">
              <el-tag v-for="attachment in selectedEmail.attachments" :key="attachment.filename" size="small">
                {{ attachment.filename }} ({{ formatFileSize(attachment.size) }})
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </div>
        
        <div class="email-content">
          <div v-if="selectedEmail.html_content" v-html="selectedEmail.html_content" class="html-content"></div>
          <pre v-else-if="selectedEmail.text_content" class="text-content">{{ selectedEmail.text_content }}</pre>
          <div v-else class="no-content">无邮件内容</div>
        </div>
      </div>
    </el-dialog>
  </MainLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { adminApi } from '@/services/api'
import MainLayout from '@/layouts/MainLayout.vue'
import { Refresh, Search, Paperclip } from '@element-plus/icons-vue'

const emails = ref([])
const accounts = ref([])
const loading = ref(false)
const showEmailDetail = ref(false)
const selectedEmail = ref(null)
const searchTimeout = ref(null)

const filters = reactive({
  search: '',
  accountId: '',
  folder: ''
})

const pagination = reactive({
  current: 1,
  limit: 20,
  total: 1,
  count: 0
})

const loadEmails = async () => {
  try {
    loading.value = true
    const params = {
      page: pagination.current,
      limit: pagination.limit,
      ...filters
    }
    
    const response = await adminApi.getEmails(params)
    if (response.data.success) {
      emails.value = response.data.data.emails
      Object.assign(pagination, response.data.data.pagination)
    }
  } catch (error) {
    console.error('加载邮件列表失败:', error)
  } finally {
    loading.value = false
  }
}

const loadAccounts = async () => {
  try {
    const response = await adminApi.getAccounts()
    if (response.data.success) {
      accounts.value = response.data.data
    }
  } catch (error) {
    console.error('加载账户列表失败:', error)
  }
}

const refreshEmails = () => {
  pagination.current = 1
  loadEmails()
}

const debounceSearch = () => {
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value)
  }
  searchTimeout.value = setTimeout(() => {
    pagination.current = 1
    loadEmails()
  }, 500)
}

const handleSizeChange = (size) => {
  pagination.limit = size
  pagination.current = 1
  loadEmails()
}

const handleCurrentChange = (page) => {
  pagination.current = page
  loadEmails()
}

const viewEmail = async (email) => {
  try {
    const response = await adminApi.getEmail(email.id)
    if (response.data.success) {
      selectedEmail.value = response.data.data
      showEmailDetail.value = true
    }
  } catch (error) {
    console.error('获取邮件详情失败:', error)
  }
}

const getFolderTagType = (folder) => {
  const typeMap = {
    'INBOX': 'primary',
    'Sent': 'success',
    'Drafts': 'warning',
    'Trash': 'danger',
    'Spam': 'info'
  }
  return typeMap[folder] || 'default'
}

const getFolderDisplayName = (folder) => {
  const nameMap = {
    'INBOX': '收件箱',
    'Sent': '已发送',
    'Drafts': '草稿',
    'Trash': '垃圾箱',
    'Spam': '垃圾邮件'
  }
  return nameMap[folder] || folder
}

const hasAttachments = (email) => {
  return email.attachments && email.attachments.length > 0
}

const truncateText = (text, length) => {
  if (!text) return ''
  return text.length > length ? text.substring(0, length) + '...' : text
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

const formatFileSize = (bytes) => {
  if (!bytes) return '-'
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0) return '0 B'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
}

onMounted(() => {
  loadEmails()
  loadAccounts()
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

.filter-card {
  margin-bottom: 16px;
}

.email-address {
  font-family: monospace;
  font-size: 13px;
}

.subject-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.subject-text {
  flex: 1;
  overflow: hidden;
}

.subject-icons {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.attachment-icon {
  color: #6b7280;
  font-size: 14px;
}

.unread-dot {
  width: 8px;
  height: 8px;
  background-color: #3b82f6;
  border-radius: 50%;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.empty-state {
  padding: 40px 0;
  text-align: center;
}

.email-detail {
  max-height: 70vh;
  overflow: auto;
}

.email-header {
  margin-bottom: 20px;
}

.email-content {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  background-color: #f9fafb;
}

.html-content {
  line-height: 1.6;
}

.text-content {
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
}

.no-content {
  color: #6b7280;
  font-style: italic;
  text-align: center;
  padding: 40px;
}

.email-dialog :deep(.el-dialog__body) {
  padding: 20px;
}
</style> 