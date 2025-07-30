<template>
  <el-container class="layout">
    <!-- 侧边栏 -->
    <el-aside width="250px" class="sidebar">
      <div class="logo">
        <el-icon class="logo-icon"><Service /></el-icon>
        <span class="logo-text">邮件服务器</span>
      </div>
      
      <el-menu
        :default-active="$route.name"
        class="sidebar-menu"
        @select="handleMenuSelect"
        background-color="#1f2937"
        text-color="#e5e7eb"
        active-text-color="#60a5fa"
      >
        <el-menu-item index="Dashboard">
          <el-icon><Odometer /></el-icon>
          <span>仪表板</span>
        </el-menu-item>
        
        <el-menu-item index="Domains">
          <el-icon><Connection /></el-icon>
          <span>域名管理</span>
        </el-menu-item>
        
        <el-menu-item index="Accounts">
          <el-icon><User /></el-icon>
          <span>邮箱账户</span>
        </el-menu-item>
        
        <el-menu-item index="Emails">
          <el-icon><Message /></el-icon>
          <span>邮件列表</span>
        </el-menu-item>
        
        <el-menu-item index="Webhooks">
          <el-icon><Link /></el-icon>
          <span>Webhook</span>
        </el-menu-item>
        
        <el-menu-item index="Settings">
          <el-icon><Setting /></el-icon>
          <span>系统设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    
    <!-- 主内容区 -->
    <el-container>
      <!-- 顶部导航 -->
      <el-header class="header">
        <div class="header-left">
          <h2 class="page-title">{{ pageTitle }}</h2>
        </div>
        
        <div class="header-right">
          <el-tag type="success" size="small" class="status-tag">
            <el-icon><CircleCheck /></el-icon>
            运行中
          </el-tag>
          
          <el-dropdown @command="handleCommand">
            <el-button circle>
              <el-icon><UserFilled /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      
      <!-- 主体内容 -->
      <el-main class="main-content">
        <slot />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  Service,
  Odometer,
  Connection,
  User,
  Message,
  Link,
  Setting,
  CircleCheck,
  UserFilled,
  SwitchButton
} from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()

const pageTitle = computed(() => {
  const titleMap = {
    'Dashboard': '仪表板',
    'Domains': '域名管理',
    'Accounts': '邮箱账户',
    'Emails': '邮件列表',
    'Webhooks': 'Webhook',
    'Settings': '系统设置'
  }
  return titleMap[router.currentRoute.value.name] || '管理端'
})

const handleMenuSelect = (index) => {
  router.push({ name: index })
}

const handleCommand = (command) => {
  if (command === 'logout') {
    authStore.logout()
    router.push('/login')
  }
}
</script>

<style scoped>
.layout {
  height: 100vh;
}

.sidebar {
  background-color: #1f2937;
  border-right: 1px solid #374151;
}

.logo {
  display: flex;
  align-items: center;
  padding: 20px;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
}

.logo-icon {
  font-size: 24px;
  margin-right: 10px;
  color: #60a5fa;
}

.logo-text {
  white-space: nowrap;
}

.sidebar-menu {
  border: none;
}

.header {
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.header-left {
  display: flex;
  align-items: center;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.main-content {
  background-color: #f9fafb;
  padding: 24px;
}
</style> 