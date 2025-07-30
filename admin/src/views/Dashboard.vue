<template>
  <MainLayout>
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon domains">
            <el-icon><Connection /></el-icon>
          </div>
          <div class="stat-details">
            <div class="stat-value">{{ stats.totalDomains || 0 }}</div>
            <div class="stat-label">管理域名</div>
          </div>
        </div>
      </el-card>
      
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon accounts">
            <el-icon><User /></el-icon>
          </div>
          <div class="stat-details">
            <div class="stat-value">{{ stats.activeAccounts || 0 }}/{{ stats.totalAccounts || 0 }}</div>
            <div class="stat-label">邮箱账户</div>
          </div>
        </div>
      </el-card>
      
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon emails">
            <el-icon><Message /></el-icon>
          </div>
          <div class="stat-details">
            <div class="stat-value">{{ stats.totalEmails || 0 }}</div>
            <div class="stat-label">总邮件数</div>
          </div>
        </div>
      </el-card>
      
      <el-card class="stat-card">
        <div class="stat-content">
          <div class="stat-icon webhooks">
            <el-icon><Link /></el-icon>
          </div>
          <div class="stat-details">
            <div class="stat-value">{{ stats.totalWebhooks || 0 }}</div>
            <div class="stat-label">Webhook</div>
          </div>
        </div>
      </el-card>
    </div>
    
    <!-- 系统概览 -->
    <div class="overview-section">
      <el-row :gutter="24">
        <el-col :span="16">
          <el-card>
            <template #header>
              <div class="card-header">
                <span>服务状态</span>
              </div>
            </template>
            <div class="service-status">
              <div class="service-item">
                <el-icon class="service-icon running"><CircleCheck /></el-icon>
                <span>SMTP服务器</span>
              </div>
              <div class="service-item">
                <el-icon class="service-icon running"><CircleCheck /></el-icon>
                <span>IMAP服务器</span>
              </div>
              <div class="service-item">
                <el-icon class="service-icon running"><CircleCheck /></el-icon>
                <span>Web管理</span>
              </div>
            </div>
          </el-card>
        </el-col>
        
        <el-col :span="8">
          <el-card>
            <template #header>
              <div class="card-header">
                <span>快速操作</span>
              </div>
            </template>
            <div class="quick-actions">
              <el-button type="primary" @click="$router.push('/domains')">
                <el-icon><Plus /></el-icon>
                添加域名
              </el-button>
              <el-button type="success" @click="$router.push('/accounts')">
                <el-icon><UserFilled /></el-icon>
                创建邮箱
              </el-button>
              <el-button type="warning" @click="$router.push('/webhooks')">
                <el-icon><Link /></el-icon>
                配置Webhook
              </el-button>
              <el-button @click="refreshStats">
                <el-icon><Refresh /></el-icon>
                刷新数据
              </el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
    
    <!-- DNS配置提示 -->
    <el-alert
      title="重要提醒"
      type="warning"
      show-icon
      :closable="false"
      class="dns-alert"
    >
      <template #default>
        请确保已正确配置域名的DNS记录，包括MX记录、SPF记录等。
        <el-link type="primary" @click="$router.push('/settings')">查看配置指南</el-link>
      </template>
    </el-alert>
  </MainLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminApi } from '@/services/api'
import { ElMessage } from 'element-plus'
import MainLayout from '@/layouts/MainLayout.vue'
import {
  Connection,
  User,
  Message,
  Link,
  CircleCheck,
  Plus,
  UserFilled,
  Refresh
} from '@element-plus/icons-vue'

const stats = ref({
  totalDomains: 0,
  totalAccounts: 0,
  activeAccounts: 0,
  totalEmails: 0,
  todayEmails: 0,
  totalWebhooks: 0
})

const loading = ref(false)

const loadStats = async () => {
  try {
    loading.value = true
    const response = await adminApi.getStats()
    if (response.data.success) {
      stats.value = response.data.data
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  } finally {
    loading.value = false
  }
}

const refreshStats = async () => {
  await loadStats()
  ElMessage.success('数据已刷新')
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.stat-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: white;
}

.stat-icon.domains {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-icon.accounts {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-icon.emails {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-icon.webhooks {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-details {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  line-height: 1;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
  margin-top: 4px;
}

.overview-section {
  margin-bottom: 24px;
}

.card-header {
  font-weight: 600;
  color: #1f2937;
}

.service-status {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.service-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
}

.service-icon.running {
  color: #10b981;
  font-size: 16px;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-actions .el-button {
  justify-content: flex-start;
}

.dns-alert {
  border-radius: 12px;
}
</style> 