// Detect API URL automatically in production, use env var or localhost in development
const getApiUrl = () => {
  // If VITE_API_URL is set, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In production (when not localhost), use relative URLs
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return window.location.origin;
  }
  
  // Default to localhost for development
  return 'http://localhost:3001';
};

class ApiClient {
  private baseURL: string;

  constructor(baseURL?: string) {
    // Detect URL dynamically at runtime
    this.baseURL = baseURL || getApiUrl();
  }

  // Method to get current API URL (useful for debugging)
  getApiUrl(): string {
    return this.baseURL;
  }

  // Read CSRF token from cookie (non-httpOnly, readable by JS)
  private getCsrfToken(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  private async refreshAccessToken(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }

    return false;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Attach CSRF token for non-GET requests
    const method = (options.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const csrfToken = this.getCsrfToken();
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
    }

    let response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });

    // If unauthorized, try to refresh token via cookie (only once, skip for auth endpoints)
    if (response.status === 401 && !endpoint.startsWith('/api/auth/')) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        // Retry request with new cookie
        response = await fetch(url, {
          ...options,
          headers,
          credentials: 'include',
        });
      }
    }

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        // Se não conseguir fazer parse do JSON, criar um erro genérico
        errorData = {
          error: response.statusText || 'An error occurred',
          statusCode: response.status,
        };
      }
      
      // Extrair mensagem de erro mais específica
      const errorMessage = errorData.error || errorData.message || 'Request failed';
      throw new ApiError(errorMessage, response.status, errorData);
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }

    return {} as T;
  }

  // Auth methods
  async register(data: {
    email: string;
    password: string;
    name: string;
    companyName: string;
  }) {
    try {
      // Cookies are set by the server (httpOnly) — no localStorage needed
      return await this.request<{ user: any }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error: any) {
      // Detectar erros de rede
      if (
        error instanceof TypeError &&
        (error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Network request failed'))
      ) {
        throw new ApiError(
          'Erro de conexão. Verifique sua internet e tente novamente.',
          0,
          { code: 'NETWORK_ERROR', originalError: error }
        );
      }

      // Detectar timeout (se aplicável)
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        throw new ApiError(
          'A requisição demorou muito. Tente novamente.',
          408,
          { code: 'TIMEOUT', originalError: error }
        );
      }

      // Se já é um ApiError, verificar se tem código do backend
      if (error instanceof ApiError && error.details) {
        // Extrair código de erro do backend se disponível
        const backendCode = error.details.code || error.details.error?.code;
        if (backendCode) {
          error.details.code = backendCode;
        }
      }

      // Re-lançar o erro para ser tratado pelo componente
      throw error;
    }
  }

  async login(data: { email: string; password: string; totpCode?: string }) {
    try {
      // Cookies are set by the server (httpOnly) — no localStorage needed
      return await this.request<{ user: any } | { requiresTwoFactor: true; userId: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error: any) {
      // Detectar erros de rede
      if (
        error instanceof TypeError &&
        (error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Network request failed'))
      ) {
        throw new ApiError(
          'Erro de conexão. Verifique se o servidor está rodando e tente novamente.',
          0,
          { code: 'NETWORK_ERROR', originalError: error }
        );
      }

      // Detectar timeout (se aplicável)
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        throw new ApiError(
          'A requisição demorou muito. Tente novamente.',
          408,
          { code: 'TIMEOUT', originalError: error }
        );
      }

      // Se já é um ApiError, verificar se tem código do backend
      if (error instanceof ApiError && error.details) {
        // Extrair código de erro do backend se disponível
        const backendCode = error.details.code || error.details.error?.code;
        if (backendCode) {
          error.details.code = backendCode;
        }
      }

      // Re-lançar o erro para ser tratado pelo componente
      throw error;
    }
  }

  async logout() {
    // Server clears httpOnly cookies
    await this.request('/api/auth/logout', {
      method: 'POST',
    });
  }

  async getCurrentUser() {
    return this.request<any>('/api/auth/me');
  }

  async updateProfile(data: { name?: string; phone?: string; avatar?: string | null }) {
    return this.request<any>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.request<any>('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // 2FA endpoints
  async setup2FA() {
    return this.request<{ secret: string; qrCode: string; otpauthUrl: string }>('/api/auth/2fa/setup', {
      method: 'POST',
    });
  }

  async verify2FA(code: string) {
    return this.request<{ enabled: boolean }>('/api/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async disable2FA(code: string) {
    return this.request<{ disabled: boolean }>('/api/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async get2FAStatus() {
    return this.request<{ enabled: boolean }>('/api/auth/2fa/status');
  }

  async updateTenant(data: { name?: string; logo?: string | null }) {
    return this.request<any>('/api/auth/tenant', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getProfileStats() {
    return this.request<any>('/api/auth/profile/stats');
  }

  async changePlan(data: { planType: string; billingCycle?: string }) {
    return this.request<any>('/api/subscriptions/change-plan', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async cancelSubscription() {
    return this.request<any>('/api/subscriptions/cancel', {
      method: 'POST',
    });
  }

  // Public lead capture (no auth required)
  async publicCaptureLead(formId: string, data: any) {
    return this.request<any>(`/api/leads/capture/${formId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Dashboard stats
  async getDashboardStats() {
    return this.request<any>('/api/dashboard/stats');
  }

  async requestPasswordReset(email: string) {
    try {
      // Ensure email is trimmed and lowercase
      const normalizedEmail = email.trim().toLowerCase();
      
      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        throw new ApiError('Email inválido', 400, { code: 'VALIDATION_ERROR' });
      }
      
      return await this.request<{ message: string }>('/api/auth/password/reset-request', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail }),
      });
    } catch (error: any) {
      // Detectar erros de rede
      if (
        error instanceof TypeError &&
        (error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Network request failed'))
      ) {
        throw new ApiError(
          'Erro de conexão. Verifique se o servidor está rodando e tente novamente.',
          0,
          { code: 'NETWORK_ERROR', originalError: error }
        );
      }

      // Detectar timeout (se aplicável)
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        throw new ApiError(
          'A requisição demorou muito. Tente novamente.',
          408,
          { code: 'TIMEOUT', originalError: error }
        );
      }

      // Re-lançar o erro para ser tratado pelo componente
      throw error;
    }
  }

  async resetPassword(token: string, password: string) {
    try {
      return await this.request<{ message: string }>('/api/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
    } catch (error: any) {
      // Detectar erros de rede
      if (
        error instanceof TypeError &&
        (error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Network request failed'))
      ) {
        throw new ApiError(
          'Erro de conexão. Verifique se o servidor está rodando e tente novamente.',
          0,
          { code: 'NETWORK_ERROR', originalError: error }
        );
      }

      // Detectar timeout (se aplicável)
      if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
        throw new ApiError(
          'A requisição demorou muito. Tente novamente.',
          408,
          { code: 'TIMEOUT', originalError: error }
        );
      }

      // Re-lançar o erro para ser tratado pelo componente
      throw error;
    }
  }

  // Leads
  async getLeads(filters?: any) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.request<any>(`/api/leads${query ? `?${query}` : ''}`);
  }

  async getLead(id: string) {
    return this.request<any>(`/api/leads/${id}`);
  }

  async createLead(data: any) {
    return this.request<any>('/api/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLead(id: string, data: any) {
    return this.request<any>(`/api/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLead(id: string) {
    return this.request(`/api/leads/${id}`, {
      method: 'DELETE',
    });
  }

  async importLeads(data: { leads: any[]; skipDuplicateEmails?: boolean }) {
    return this.request<any>('/api/leads/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Tasks
  async getTasks(filters?: any) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.request<any>(`/api/tasks${query ? `?${query}` : ''}`);
  }

  async getTask(id: string) {
    return this.request<any>(`/api/tasks/${id}`);
  }

  async createTask(data: any) {
    return this.request<any>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: any) {
    return this.request<any>(`/api/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string) {
    return this.request(`/api/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // Tags
  async getTags() {
    return this.request<any[]>('/api/tags');
  }

  async getTag(id: string) {
    return this.request<any>(`/api/tags/${id}`);
  }

  async createTag(data: { name: string; color?: string }) {
    return this.request<any>('/api/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTag(id: string, data: { name?: string; color?: string }) {
    return this.request<any>(`/api/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTag(id: string) {
    return this.request(`/api/tags/${id}`, {
      method: 'DELETE',
    });
  }

  // Subscriptions
  async getCurrentSubscription() {
    return this.request<any>('/api/subscriptions/current');
  }

  async getPlans() {
    return this.request<any[]>('/api/subscriptions/plans');
  }

  // Automations
  async getAutomations(filters?: any) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.request<any>(`/api/automations${query ? `?${query}` : ''}`);
  }

  async getAutomation(id: string) {
    return this.request<any>(`/api/automations/${id}`);
  }

  async createAutomation(data: any) {
    return this.request<any>('/api/automations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAutomation(id: string, data: any) {
    return this.request<any>(`/api/automations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAutomation(id: string) {
    return this.request(`/api/automations/${id}`, {
      method: 'DELETE',
    });
  }

  async getAutomationLogs(id: string, limit?: number) {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<any>(`/api/automations/${id}/logs${query}`);
  }

  async getAutomationStats(id: string) {
    return this.request<any>(`/api/automations/${id}/stats`);
  }

  async executeAutomation(id: string, leadId: string) {
    return this.request<any>(`/api/automations/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ leadId }),
    });
  }

  // WhatsApp Connections
  async getWhatsAppConnections() {
    return this.request<any[]>('/api/whatsapp');
  }

  async getWhatsAppConnection(id: string) {
    return this.request<any>(`/api/whatsapp/${id}`);
  }

  async createWhatsAppConnection(data: any) {
    return this.request<any>('/api/whatsapp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWhatsAppConnection(id: string, data: any) {
    return this.request<any>(`/api/whatsapp/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWhatsAppConnection(id: string) {
    return this.request(`/api/whatsapp/${id}`, {
      method: 'DELETE',
    });
  }

  async sendWhatsAppMessage(data: {
    connectionId: string;
    to: string;
    type?: 'text' | 'template' | 'image' | 'document' | 'audio';
    content: string;
    templateName?: string;
    templateParams?: string[];
    mediaUrl?: string;
    leadId?: string;
  }) {
    return this.request<any>('/api/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWhatsAppTemplates(connectionId: string) {
    return this.request<any>(`/api/whatsapp/${connectionId}/templates`);
  }

  // Email Configs
  async getEmailConfigs() {
    return this.request<any[]>('/api/email/configs');
  }

  async getEmailConfig(id: string) {
    return this.request<any>(`/api/email/configs/${id}`);
  }

  async createEmailConfig(data: any) {
    return this.request<any>('/api/email/configs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmailConfig(id: string, data: any) {
    return this.request<any>(`/api/email/configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmailConfig(id: string) {
    return this.request(`/api/email/configs/${id}`, {
      method: 'DELETE',
    });
  }

  async sendEmail(data: {
    configId: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
    leadId?: string;
  }) {
    return this.request<any>('/api/email/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendBulkEmail(data: {
    configId: string;
    recipients: Array<{ email: string; leadId?: string; variables?: Record<string, string> }>;
    subject: string;
    html: string;
    text?: string;
  }) {
    return this.request<any>('/api/email/send-bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendTestEmail(configId: string, toEmail: string) {
    return this.request<any>(`/api/email/configs/${configId}/test`, {
      method: 'POST',
      body: JSON.stringify({ toEmail }),
    });
  }

  // API Keys
  async getApiKeys() {
    return this.request<any[]>('/api/api-keys');
  }

  async createApiKey(data: { name: string; expiresAt?: string }) {
    return this.request<any>('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Custom Fields
  async getCustomFields(activeOnly?: boolean) {
    const query = activeOnly ? '?active=true' : '';
    return this.request<any[]>(`/api/custom-fields${query}`);
  }

  async getCustomField(id: string) {
    return this.request<any>(`/api/custom-fields/${id}`);
  }

  async createCustomField(data: any) {
    return this.request<any>('/api/custom-fields', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomField(id: string, data: any) {
    return this.request<any>(`/api/custom-fields/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomField(id: string) {
    return this.request(`/api/custom-fields/${id}`, {
      method: 'DELETE',
    });
  }

  // Interactions
  async getInteractions(filters?: any) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.request<any>(`/api/interactions${query ? `?${query}` : ''}`);
  }

  async getLeadInteractions(leadId: string) {
    return this.request<any[]>(`/api/interactions/leads/${leadId}`);
  }

  async createInteraction(data: any) {
    return this.request<any>('/api/interactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteInteraction(id: string) {
    return this.request(`/api/interactions/${id}`, {
      method: 'DELETE',
    });
  }

  async getInboxConversations(filters?: { channel?: string; search?: string; page?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.request<any>(`/api/interactions/inbox${query ? `?${query}` : ''}`);
  }

  // Funnels (Pipeline)
  async getFunnels() {
    return this.request<any>('/api/funnels');
  }

  async getDefaultFunnel() {
    return this.request<any>('/api/funnels/default');
  }

  async getFunnel(id: string) {
    return this.request<any>(`/api/funnels/${id}`);
  }

  async createFunnel(data: { name: string; columns?: Array<{ title: string; color?: string; mappedStatus?: string }> }) {
    return this.request<any>('/api/funnels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFunnel(id: string, data: { name?: string; order?: number }) {
    return this.request<any>(`/api/funnels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFunnel(id: string) {
    return this.request(`/api/funnels/${id}`, {
      method: 'DELETE',
    });
  }

  async addFunnelColumn(funnelId: string, data: { title: string; color?: string; mappedStatus?: string }) {
    return this.request<any>(`/api/funnels/${funnelId}/columns`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFunnelColumn(funnelId: string, columnId: string, data: { title?: string; color?: string; order?: number }) {
    return this.request<any>(`/api/funnels/${funnelId}/columns/${columnId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async reorderFunnelColumns(funnelId: string, columnIds: string[]) {
    return this.request<any>(`/api/funnels/${funnelId}/columns/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ columnIds }),
    });
  }

  async deleteFunnelColumn(funnelId: string, columnId: string) {
    return this.request(`/api/funnels/${funnelId}/columns/${columnId}`, {
      method: 'DELETE',
    });
  }

  async moveLead(data: { leadId: string; targetColumnId: string; position: number }) {
    return this.request<any>('/api/funnels/move-lead', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Notifications
  async getNotifications(filters?: any) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.request<any>(`/api/notifications${query ? `?${query}` : ''}`);
  }

  async getUnreadNotificationsCount() {
    return this.request<{ count: number }>('/api/notifications/unread/count');
  }

  async markNotificationAsRead(id: string) {
    return this.request<any>(`/api/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request<any>('/api/notifications/read-all', {
      method: 'PUT',
    });
  }

  async deleteNotification(id: string) {
    return this.request(`/api/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  // ========================
  // Scoring Rules
  // ========================

  async getScoringRules() {
    return this.request<any>('/api/scoring-rules');
  }

  async getDefaultScoringRules() {
    return this.request<any>('/api/scoring-rules/default');
  }

  async getScoringRule(id: string) {
    return this.request<any>(`/api/scoring-rules/${id}`);
  }

  async createScoringRule(data: { name: string; eventType: string; points: number; description?: string; conditions?: Record<string, any> }) {
    return this.request<any>('/api/scoring-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateScoringRule(id: string, data: { name?: string; eventType?: string; points?: number; description?: string | null; active?: boolean; conditions?: Record<string, any> | null }) {
    return this.request<any>(`/api/scoring-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteScoringRule(id: string) {
    return this.request(`/api/scoring-rules/${id}`, {
      method: 'DELETE',
    });
  }

  async recalculateAllScores() {
    return this.request<any>('/api/scoring-rules/recalculate', {
      method: 'POST',
    });
  }

  async recalculateLeadScore(leadId: string) {
    return this.request<any>(`/api/scoring-rules/recalculate/${leadId}`, {
      method: 'POST',
    });
  }

  // ========================
  // Reports
  // ========================

  async getReports() {
    return this.request<any[]>('/api/reports');
  }

  async getReport(id: string) {
    return this.request<any>(`/api/reports/${id}`);
  }

  async createReport(data: { name: string; description?: string; type?: string; config?: any }) {
    return this.request<any>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateReport(id: string, data: { name?: string; description?: string; type?: string; config?: any }) {
    return this.request<any>(`/api/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteReport(id: string) {
    return this.request(`/api/reports/${id}`, {
      method: 'DELETE',
    });
  }

  async getReportMetrics(params?: { from?: string; to?: string }) {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const qs = query.toString();
    return this.request<any>(`/api/reports/metrics${qs ? `?${qs}` : ''}`);
  }

  // ========================
  // Payments (Backend API)
  // ========================

  async createPaymentIntent(data: { planId: string; planType: string; amount: number; method: string; billingCycle: string }) {
    return this.request<any>('/api/payments/intent', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPaymentHistory() {
    return this.request<any[]>('/api/payments/history');
  }

  async downloadInvoice(paymentId: string): Promise<Blob> {
    const response = await fetch(`${this.baseURL}/api/payments/${paymentId}/invoice`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to download invoice');
    }
    return response.blob();
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = new ApiClient();

