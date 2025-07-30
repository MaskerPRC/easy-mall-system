import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/domains',
    name: 'Domains',
    component: () => import('@/views/Domains.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/accounts',
    name: 'Accounts',
    component: () => import('@/views/Accounts.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/emails',
    name: 'Emails',
    component: () => import('@/views/Emails.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/webhooks',
    name: 'Webhooks',
    component: () => import('@/views/Webhooks.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/Settings.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to) => {
  const authStore = useAuthStore()
  
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'Login' }
  }
  
  if (to.name === 'Login' && authStore.isAuthenticated) {
    return { name: 'Dashboard' }
  }
})

export default router 