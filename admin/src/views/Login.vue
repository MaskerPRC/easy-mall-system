<template>
  <div class="login-container">
    <div class="login-card">
      <div class="logo-section">
        <el-icon class="logo-icon"><Service /></el-icon>
        <h1 class="logo-title">域名邮件服务器</h1>
        <p class="logo-subtitle">管理员登录</p>
      </div>
      
      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="rules"
        class="login-form"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="token">
          <el-input
            v-model="loginForm.token"
            type="password"
            placeholder="请输入管理员令牌"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          >
            <template #prefix>
              <el-icon><Key /></el-icon>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="authStore.loading"
            @click="handleLogin"
            class="login-button"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessage } from 'element-plus'
import { Service, Key } from '@element-plus/icons-vue'

const router = useRouter()
const authStore = useAuthStore()
const loginFormRef = ref(null)

const loginForm = reactive({
  token: ''
})

const rules = {
  token: [
    { required: true, message: '请输入管理员令牌', trigger: 'blur' },
    { min: 1, message: '令牌不能为空', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      const result = await authStore.login(loginForm.token)
      
      if (result.success) {
        ElMessage.success('登录成功')
        router.push('/')
      } else {
        ElMessage.error(result.message)
      }
    }
  })
}

// 初始化认证
authStore.initAuth()
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  padding: 40px;
  width: 100%;
  max-width: 400px;
}

.logo-section {
  text-align: center;
  margin-bottom: 40px;
}

.logo-icon {
  font-size: 48px;
  color: #667eea;
  margin-bottom: 16px;
}

.logo-title {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px 0;
}

.logo-subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.login-form {
  margin-top: 20px;
}

.login-button {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
}
</style> 