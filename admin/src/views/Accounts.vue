<template>
  <MainLayout>
    <div class="page-header">
      <div>
        <h1>邮箱账户</h1>
        <p>管理域名下的邮箱账户</p>
      </div>
      <el-button type="primary" @click="openAccountForm()">
        <el-icon><Plus /></el-icon>
        创建账户
      </el-button>
    </div>
    
    <!-- 账户列表 -->
    <el-card>
      <el-table
        :data="accounts"
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="email" label="邮箱地址" min-width="180">
          <template #default="{ row }">
            <div class="email-cell">
              <span class="email-address">{{ row.email }}</span>
              <el-tag v-if="row.is_admin" type="danger" size="small" class="admin-tag">
                管理员
              </el-tag>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="display_name" label="显示名称" min-width="120">
          <template #default="{ row }">
            <span>{{ row.display_name || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="domain" label="域名" width="150" />
        
        <el-table-column label="配额" width="120">
          <template #default="{ row }">
            <div class="quota-cell">
              <span>{{ row.used_mb || 0 }}MB / {{ row.quota_mb }}MB</span>
              <el-progress
                :percentage="getQuotaPercentage(row)"
                :status="getQuotaStatus(row)"
                :stroke-width="6"
                :show-text="false"
                class="quota-progress"
              />
            </div>
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
            <el-button link type="primary" @click="editAccount(row)">
              编辑
            </el-button>
            <el-button 
              link 
              type="danger" 
              @click="deleteAccount(row)"
              :disabled="!!row.is_admin"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <div v-if="accounts.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无邮箱账户">
          <el-button type="primary" @click="openAccountForm()">创建第一个账户</el-button>
        </el-empty>
      </div>
    </el-card>
    
    <!-- 账户表单对话框 -->
    <el-dialog
      v-model="showAccountForm"
      :title="editingAccount ? '编辑账户' : '创建邮箱账户'"
      width="600px"
    >
      <el-form
        ref="accountFormRef"
        :model="accountForm"
        :rules="accountRules"
        label-width="100px"
      >
        <el-form-item label="邮箱地址" prop="email">
          <el-input
            v-model="accountForm.email"
            placeholder="user@domain.com"
            :disabled="!!editingAccount"
          />
        </el-form-item>
        
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="accountForm.password"
            type="password"
            show-password
            :placeholder="editingAccount ? '留空则不修改密码' : '请输入密码'"
          />
        </el-form-item>
        
        <el-form-item label="显示名称" prop="displayName">
          <el-input
            v-model="accountForm.displayName"
            placeholder="用户显示名称"
          />
        </el-form-item>
        
        <el-form-item label="域名" prop="domainId">
          <el-select
            v-model="accountForm.domainId"
            placeholder="请选择域名"
            style="width: 100%"
            :disabled="!!editingAccount"
          >
            <el-option
              v-for="domain in domains"
              :key="domain.id"
              :label="domain.domain"
              :value="domain.id"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="配额 (MB)" prop="quotaMb">
          <el-input-number
            v-model="accountForm.quotaMb"
            :min="100"
            :step="100"
            style="width: 100%"
          />
        </el-form-item>
        
        <el-form-item label="选项">
          <el-space direction="vertical">
            <el-checkbox v-model="accountForm.isActive">
              账户启用
            </el-checkbox>
            <el-checkbox v-model="accountForm.isAdmin">
              管理员权限
            </el-checkbox>
          </el-space>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="cancelAccountForm">取消</el-button>
        <el-button type="primary" :loading="formLoading" @click="saveAccount">
          {{ editingAccount ? '更新' : '创建' }}
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

const accounts = ref([])
const domains = ref([])
const loading = ref(false)
const showAccountForm = ref(false)
const formLoading = ref(false)
const editingAccount = ref(null)
const accountFormRef = ref(null)

const accountForm = reactive({
  email: '',
  password: '',
  displayName: '',
  domainId: '',
  quotaMb: 1000,
  isActive: true,
  isAdmin: false
})

const accountRules = {
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入有效的邮箱地址', trigger: 'blur' }
  ],
  password: [
    { 
      validator: (rule, value, callback) => {
        if (!editingAccount.value && !value) {
          callback(new Error('请输入密码'))
        } else if (value && value.length < 6) {
          callback(new Error('密码至少6个字符'))
        } else {
          callback()
        }
      }, 
      trigger: 'blur' 
    }
  ],
  domainId: [
    { required: true, message: '请选择域名', trigger: 'change' }
  ]
}

const loadAccounts = async () => {
  try {
    loading.value = true
    const response = await adminApi.getAccounts()
    if (response.data.success) {
      accounts.value = response.data.data
    }
  } catch (error) {
    console.error('加载账户列表失败:', error)
  } finally {
    loading.value = false
  }
}

const loadDomains = async () => {
  try {
    const response = await adminApi.getDomains()
    if (response.data.success) {
      domains.value = response.data.data.filter(domain => domain.is_active)
    }
  } catch (error) {
    console.error('加载域名列表失败:', error)
  }
}

const openAccountForm = (account = null) => {
  editingAccount.value = account
  if (account) {
    Object.assign(accountForm, {
      email: account.email,
      password: '',
      displayName: account.display_name || '',
      domainId: account.domain_id,
      quotaMb: account.quota_mb,
      isActive: !!account.is_active,
      isAdmin: !!account.is_admin
    })
  } else {
    Object.assign(accountForm, {
      email: '',
      password: '',
      displayName: '',
      domainId: '',
      quotaMb: 1000,
      isActive: true,
      isAdmin: false
    })
  }
  showAccountForm.value = true
}

const cancelAccountForm = () => {
  showAccountForm.value = false
  editingAccount.value = null
  accountFormRef.value?.resetFields()
}

const editAccount = (account) => {
  openAccountForm(account)
}

const saveAccount = async () => {
  if (!accountFormRef.value) return
  
  await accountFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        formLoading.value = true
        
        const data = {
          email: accountForm.email,
          password: accountForm.password,
          displayName: accountForm.displayName,
          domainId: accountForm.domainId,
          quotaMb: accountForm.quotaMb,
          isActive: accountForm.isActive,
          isAdmin: accountForm.isAdmin
        }
        
        if (editingAccount.value) {
          await adminApi.updateAccount(editingAccount.value.id, data)
          ElMessage.success('账户更新成功')
        } else {
          await adminApi.createAccount(data)
          ElMessage.success('账户创建成功')
        }
        
        cancelAccountForm()
        loadAccounts()
      } catch (error) {
        console.error('保存账户失败:', error)
      } finally {
        formLoading.value = false
      }
    }
  })
}

const deleteAccount = async (account) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除账户 "${account.email}" 吗？此操作不可恢复，相关邮件数据也会被删除。`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await adminApi.deleteAccount(account.id)
    ElMessage.success('账户删除成功')
    loadAccounts()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除账户失败:', error)
    }
  }
}

const getQuotaPercentage = (account) => {
  if (!account.quota_mb) return 0
  const used = account.used_mb || 0
  return Math.round((used / account.quota_mb) * 100)
}

const getQuotaStatus = (account) => {
  const percentage = getQuotaPercentage(account)
  if (percentage >= 90) return 'exception'
  if (percentage >= 75) return 'warning'
  return 'success'
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

onMounted(() => {
  loadAccounts()
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

.email-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.email-address {
  font-weight: 500;
  color: #1f2937;
}

.admin-tag {
  flex-shrink: 0;
}

.quota-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.quota-progress {
  width: 100%;
}

.empty-state {
  padding: 40px 0;
  text-align: center;
}
</style> 