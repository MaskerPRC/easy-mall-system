const { createApp } = Vue;

createApp({
  data() {
    return {
      // 认证状态
      isAuthenticated: false,
      token: '',
      
      // 登录表单
      loginToken: '',
      loginError: '',
      
      // 加载状态
      loading: false,
      
      // 活跃标签页
      activeTab: 'dashboard',
      
      // 标签页配置
      tabs: [
        { id: 'dashboard', name: '仪表板', icon: 'fas fa-tachometer-alt' },
        { id: 'domains', name: '域名管理', icon: 'fas fa-globe' },
        { id: 'accounts', name: '邮箱账户', icon: 'fas fa-user-circle' },
        { id: 'emails', name: '邮件列表', icon: 'fas fa-envelope' },
        { id: 'webhooks', name: 'Webhook', icon: 'fas fa-link' },
        { id: 'settings', name: '系统设置', icon: 'fas fa-cog' }
      ],
      
      // 统计数据
      stats: {},
      
      // 域名数据
      domains: [],
      showDomainForm: false,
      editingDomain: null,
      
      // 账户数据
      accounts: [],
      showAccountForm: false,
      editingAccount: null,
      
      // 邮件数据
      emails: [],
      emailPagination: { current: 1, total: 1, count: 0, limit: 20 },
      emailFilters: { search: '', accountId: '', folder: '' },
      emailSearchTimeout: null,
      
      // Webhook数据
      webhooks: [],
      showWebhookForm: false,
      editingWebhook: null,
      
      // 令牌表单
      tokenForm: { currentToken: '', newToken: '' }
    };
  },
  
  mounted() {
    this.checkAuth();
  },
  
  methods: {
    // ============ 认证相关 ============
    
    checkAuth() {
      const savedToken = localStorage.getItem('mail_admin_token');
      if (savedToken) {
        this.token = savedToken;
        this.isAuthenticated = true;
        this.loadAllData();
      }
    },
    
    async login() {
      if (!this.loginToken.trim()) {
        this.loginError = '请输入访问令牌';
        return;
      }
      
      this.loading = true;
      this.loginError = '';
      
      try {
        const response = await this.apiCall('POST', '/auth/admin/login', {
          token: this.loginToken
        });
        
        if (response.data.success) {
          this.token = this.loginToken;
          this.isAuthenticated = true;
          localStorage.setItem('mail_admin_token', this.token);
          this.loadAllData();
        }
      } catch (error) {
        this.loginError = error.response?.data?.message || '登录失败';
      } finally {
        this.loading = false;
      }
    },
    
    logout() {
      this.isAuthenticated = false;
      this.token = '';
      localStorage.removeItem('mail_admin_token');
      this.loginToken = '';
      this.loginError = '';
    },
    
    // ============ API调用 ============
    
    async apiCall(method, url, data = null) {
      const config = {
        method,
        url,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      };
      
      if (data) {
        config.data = data;
      }
      
      return await axios(config);
    },
    
    // ============ 数据加载 ============
    
    async loadAllData() {
      await Promise.all([
        this.loadStats(),
        this.loadDomains(),
        this.loadAccounts(),
        this.loadEmails(),
        this.loadWebhooks()
      ]);
    },
    
    async loadStats() {
      try {
        const response = await this.apiCall('GET', '/admin/stats');
        this.stats = response.data.data;
      } catch (error) {
        console.error('加载统计数据失败:', error);
      }
    },
    
    async loadDomains() {
      try {
        const response = await this.apiCall('GET', '/admin/domains');
        this.domains = response.data.data;
      } catch (error) {
        console.error('加载域名列表失败:', error);
      }
    },
    
    async loadAccounts() {
      try {
        const response = await this.apiCall('GET', '/admin/accounts');
        this.accounts = response.data.data;
      } catch (error) {
        console.error('加载账户列表失败:', error);
      }
    },
    
    async loadEmails(page = 1) {
      try {
        this.loading = true;
        const params = new URLSearchParams({
          page,
          limit: this.emailPagination.limit,
          ...this.emailFilters
        });
        
        const response = await this.apiCall('GET', `/admin/emails?${params}`);
        const data = response.data.data;
        
        this.emails = data.emails;
        this.emailPagination = data.pagination;
      } catch (error) {
        console.error('加载邮件列表失败:', error);
        this.showNotification('加载邮件列表失败', 'error');
      } finally {
        this.loading = false;
      }
    },
    
    async loadWebhooks() {
      try {
        const response = await this.apiCall('GET', '/admin/webhooks');
        this.webhooks = response.data.data;
      } catch (error) {
        console.error('加载Webhook列表失败:', error);
      }
    },
    
    // ============ 域名管理 ============
    
    editDomain(domain) {
      this.editingDomain = { ...domain };
      this.showDomainForm = true;
    },
    
    async deleteDomain(domain) {
      if (!confirm(`确定要删除域名 ${domain.domain} 吗？`)) {
        return;
      }
      
      try {
        await this.apiCall('DELETE', `/admin/domains/${domain.id}`);
        this.showNotification('域名删除成功', 'success');
        this.loadDomains();
      } catch (error) {
        this.showNotification(error.response?.data?.error || '删除域名失败', 'error');
      }
    },
    
    // ============ 账户管理 ============
    
    editAccount(account) {
      this.editingAccount = { ...account };
      this.showAccountForm = true;
    },
    
    async deleteAccount(account) {
      if (account.is_admin) {
        this.showNotification('无法删除管理员账户', 'error');
        return;
      }
      
      if (!confirm(`确定要删除账户 ${account.email} 吗？此操作将删除该账户的所有邮件。`)) {
        return;
      }
      
      try {
        await this.apiCall('DELETE', `/admin/accounts/${account.id}`);
        this.showNotification('账户删除成功', 'success');
        this.loadAccounts();
      } catch (error) {
        this.showNotification(error.response?.data?.error || '删除账户失败', 'error');
      }
    },
    
    // ============ 邮件管理 ============
    
    refreshEmails() {
      this.loadEmails(1);
    },
    
    changeEmailPage(page) {
      if (page >= 1 && page <= this.emailPagination.total) {
        this.loadEmails(page);
      }
    },
    
    getPageNumbers() {
      const current = this.emailPagination.current;
      const total = this.emailPagination.total;
      const pages = [];
      
      const start = Math.max(1, current - 2);
      const end = Math.min(total, current + 2);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      return pages;
    },
    
    debounceEmailSearch() {
      clearTimeout(this.emailSearchTimeout);
      this.emailSearchTimeout = setTimeout(() => {
        this.refreshEmails();
      }, 500);
    },
    
    viewEmail(email) {
      // 这里可以实现邮件详情查看功能
      alert(`查看邮件: ${email.subject}`);
    },
    
    // ============ Webhook管理 ============
    
    editWebhook(webhook) {
      this.editingWebhook = { ...webhook };
      this.showWebhookForm = true;
    },
    
    async deleteWebhook(webhook) {
      if (!confirm(`确定要删除Webhook ${webhook.name} 吗？`)) {
        return;
      }
      
      try {
        await this.apiCall('DELETE', `/admin/webhooks/${webhook.id}`);
        this.showNotification('Webhook删除成功', 'success');
        this.loadWebhooks();
      } catch (error) {
        this.showNotification('删除Webhook失败', 'error');
      }
    },
    
    async testWebhook(webhook) {
      try {
        this.loading = true;
        const response = await this.apiCall('POST', `/admin/webhooks/${webhook.id}/test`);
        
        if (response.data.success) {
          this.showNotification('Webhook测试成功', 'success');
        } else {
          this.showNotification(`Webhook测试失败: ${response.data.message}`, 'error');
        }
      } catch (error) {
        this.showNotification('Webhook测试失败', 'error');
      } finally {
        this.loading = false;
      }
    },
    
    // ============ 系统配置 ============
    
    async updateToken() {
      if (!this.tokenForm.currentToken || !this.tokenForm.newToken) {
        this.showNotification('请填写所有字段', 'error');
        return;
      }
      
      try {
        this.loading = true;
        const response = await this.apiCall('PUT', '/auth/admin/token', this.tokenForm);
        
        if (response.data.success) {
          this.token = this.tokenForm.newToken;
          localStorage.setItem('mail_admin_token', this.token);
          this.tokenForm = { currentToken: '', newToken: '' };
          this.showNotification('令牌更新成功', 'success');
        }
      } catch (error) {
        this.showNotification(error.response?.data?.message || '更新令牌失败', 'error');
      } finally {
        this.loading = false;
      }
    },
    
    // ============ 工具函数 ============
    
    refreshAll() {
      this.loadAllData();
      this.showNotification('数据刷新完成', 'success');
    },
    
    formatDate(dateString) {
      if (!dateString) return '-';
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN');
    },
    
    formatFileSize(bytes) {
      if (!bytes) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    },
    
    truncateText(text, maxLength) {
      if (!text) return '-';
      return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    },
    
    getFolderClass(folder) {
      const classes = {
        'INBOX': 'inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800',
        'Sent': 'inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800',
        'Drafts': 'inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800',
        'Trash': 'inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800',
        'Spam': 'inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800'
      };
      return classes[folder] || 'inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800';
    },
    
    showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = `fixed top-4 right-4 z-50 p-4 rounded-md shadow-lg max-w-sm ${
        type === 'success' ? 'bg-green-100 border border-green-400 text-green-800' :
        type === 'error' ? 'bg-red-100 border border-red-400 text-red-800' :
        'bg-blue-100 border border-blue-400 text-blue-800'
      }`;
      
      notification.innerHTML = `
        <div class="flex">
          <div class="flex-shrink-0">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
          </div>
          <div class="ml-3">
            <p class="text-sm font-medium">${message}</p>
          </div>
          <div class="ml-auto pl-3">
            <button class="text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.parentElement.remove()">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 5000);
    }
  }
}).mount('#app'); 