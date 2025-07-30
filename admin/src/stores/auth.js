import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/services/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('admin-token') || '')
  const loading = ref(false)
  
  const isAuthenticated = computed(() => !!token.value)
  
  const login = async (loginToken) => {
    try {
      loading.value = true
      
      // 验证token
      const response = await api.get('/admin/stats', {
        headers: {
          'Authorization': `Bearer ${loginToken}`
        }
      })
      
      if (response.data.success) {
        token.value = loginToken
        localStorage.setItem('admin-token', loginToken)
        api.defaults.headers.common['Authorization'] = `Bearer ${loginToken}`
        return { success: true }
      }
    } catch (error) {
      console.error('登录失败:', error)
      return { success: false, message: error.response?.data?.error || '登录失败' }
    } finally {
      loading.value = false
    }
  }
  
  const logout = () => {
    token.value = ''
    localStorage.removeItem('admin-token')
    delete api.defaults.headers.common['Authorization']
  }
  
  const initAuth = () => {
    if (token.value) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
    }
  }
  
  return {
    token,
    loading,
    isAuthenticated,
    login,
    logout,
    initAuth
  }
}) 