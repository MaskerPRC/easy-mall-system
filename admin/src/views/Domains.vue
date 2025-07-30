<template>
  <MainLayout>
    <div class="page-header">
      <div>
        <h1>域名管理</h1>
        <p>管理邮件服务器的域名配置</p>
      </div>
      <el-button type="primary" @click="openDomainForm()">
        <el-icon><Plus /></el-icon>
        添加域名
      </el-button>
    </div>
    
    <!-- 域名列表 -->
    <el-card>
      <el-table
        :data="domains"
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="domain" label="域名" min-width="120">
          <template #default="{ row }">
            <div class="domain-cell">
              <span class="domain-name">{{ row.domain }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="mx_record" label="MX记录" min-width="120">
          <template #default="{ row }">
            <span>{{ row.mx_record || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="spf_record" label="SPF记录" min-width="200">
          <template #default="{ row }">
            <el-tooltip v-if="row.spf_record" :content="row.spf_record" placement="top">
              <span class="spf-record">{{ truncateText(row.spf_record, 50) }}</span>
            </el-tooltip>
            <span v-else>-</span>
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
        
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button link type="primary" @click="editDomain(row)">
              编辑
            </el-button>
            <el-button link type="danger" @click="deleteDomain(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <div v-if="domains.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无域名配置">
          <el-button type="primary" @click="openDomainForm()">添加第一个域名</el-button>
        </el-empty>
      </div>
    </el-card>
    
    <!-- 域名表单对话框 -->
    <el-dialog
      v-model="showDomainForm"
      :title="editingDomain ? '编辑域名' : '添加域名'"
      width="500px"
    >
      <el-form
        ref="domainFormRef"
        :model="domainForm"
        :rules="domainRules"
        label-width="100px"
      >
        <el-form-item label="域名" prop="domain">
          <el-input
            v-model="domainForm.domain"
            placeholder="example.com"
            :disabled="!!editingDomain"
          />
        </el-form-item>
        
        <el-form-item label="MX记录" prop="mxRecord">
          <el-input
            v-model="domainForm.mxRecord"
            placeholder="mail.example.com 或 IP地址"
          />
        </el-form-item>
        
        <el-form-item label="SPF记录" prop="spfRecord">
          <el-input
            v-model="domainForm.spfRecord"
            type="textarea"
            :rows="3"
            placeholder="v=spf1 mx a ip4:your-server-ip ~all"
          />
        </el-form-item>
        
        <el-form-item label="状态" prop="isActive">
          <el-switch
            v-model="domainForm.isActive"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="cancelDomainForm">取消</el-button>
        <el-button type="primary" :loading="formLoading" @click="saveDomain">
          {{ editingDomain ? '更新' : '创建' }}
        </el-button>
      </template>
    </el-dialog>
  </MainLayout>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { adminApi } from '@/services/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import MainLayout from '@/layouts/MainLayout.vue'
import { Plus } from '@element-plus/icons-vue'

const domains = ref([])
const loading = ref(false)
const showDomainForm = ref(false)
const formLoading = ref(false)
const editingDomain = ref(null)
const domainFormRef = ref(null)

const domainForm = reactive({
  domain: '',
  mxRecord: '',
  spfRecord: '',
  isActive: true
})

const domainRules = {
  domain: [
    { required: true, message: '请输入域名', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/, message: '请输入有效的域名', trigger: 'blur' }
  ]
}

const loadDomains = async () => {
  try {
    loading.value = true
    const response = await adminApi.getDomains()
    if (response.data.success) {
      domains.value = response.data.data
    }
  } catch (error) {
    console.error('加载域名列表失败:', error)
  } finally {
    loading.value = false
  }
}

const openDomainForm = (domain = null) => {
  editingDomain.value = domain
  if (domain) {
    Object.assign(domainForm, {
      domain: domain.domain,
      mxRecord: domain.mx_record || '',
      spfRecord: domain.spf_record || '',
      isActive: !!domain.is_active
    })
  } else {
    Object.assign(domainForm, {
      domain: '',
      mxRecord: '',
      spfRecord: '',
      isActive: true
    })
  }
  showDomainForm.value = true
}

const cancelDomainForm = () => {
  showDomainForm.value = false
  editingDomain.value = null
  domainFormRef.value?.resetFields()
}

const editDomain = (domain) => {
  openDomainForm(domain)
}

const saveDomain = async () => {
  if (!domainFormRef.value) return
  
  await domainFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        formLoading.value = true
        
        const data = {
          domain: domainForm.domain,
          mxRecord: domainForm.mxRecord,
          spfRecord: domainForm.spfRecord,
          isActive: domainForm.isActive
        }
        
        if (editingDomain.value) {
          await adminApi.updateDomain(editingDomain.value.id, data)
          ElMessage.success('域名更新成功')
        } else {
          await adminApi.createDomain(data)
          ElMessage.success('域名添加成功')
        }
        
        cancelDomainForm()
        loadDomains()
      } catch (error) {
        console.error('保存域名失败:', error)
      } finally {
        formLoading.value = false
      }
    }
  })
}

const deleteDomain = async (domain) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除域名 "${domain.domain}" 吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await adminApi.deleteDomain(domain.id)
    ElMessage.success('域名删除成功')
    loadDomains()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除域名失败:', error)
    }
  }
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
  loadDomains()
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

.domain-cell {
  display: flex;
  align-items: center;
}

.domain-name {
  font-weight: 500;
  color: #1f2937;
}

.spf-record {
  font-family: monospace;
  font-size: 12px;
  color: #6b7280;
}

.empty-state {
  padding: 40px 0;
  text-align: center;
}
</style> 