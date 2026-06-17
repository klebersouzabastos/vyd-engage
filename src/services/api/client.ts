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
      const response = await fetch(`${this.baseURL}/api/v1/auth/refresh`, {
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
    if (response.status === 401 && !endpoint.startsWith('/api/v1/auth/') && !endpoint.startsWith('/api/auth/')) {
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

  /**
   * Wraps network/timeout errors into ApiError with proper codes.
   * Centralizes the duplicated try/catch pattern from auth methods.
   */
  private normalizeError(error: unknown): never {
    // Network errors (fetch failures)
    if (
      error instanceof TypeError &&
      (error.message.includes('Failed to fetch') ||
        error.message.includes('NetworkError') ||
        error.message.includes('Network request failed'))
    ) {
      throw new ApiError(
        'Erro de conexão. Verifique sua internet e tente novamente.',
        0,
        { originalError: String(error) },
        'NETWORK_ERROR'
      );
    }

    // Timeout errors
    if (error instanceof Error && (error.name === 'TimeoutError' || error.message.includes('timeout'))) {
      throw new ApiError(
        'A requisição demorou muito. Tente novamente.',
        408,
        { originalError: String(error) },
        'TIMEOUT'
      );
    }

    // Already an ApiError — ensure code is populated from details
    if (error instanceof ApiError) {
      if (!error.code && error.details) {
        const errorDetails = error.details.error as Record<string, unknown> | undefined;
        error.code = (error.details.code || errorDetails?.code) as string | undefined;
      }
    }

    throw error;
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
      return await this.request<{ user: { id: string; email: string; name: string; role: string; tenantId: string } }>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error: unknown) {
      this.normalizeError(error);
    }
  }

  async login(data: { email: string; password: string; totpCode?: string }) {
    try {
      // Cookies are set by the server (httpOnly) — no localStorage needed
      return await this.request<{ user: { id: string; email: string; name: string; role: string; tenantId: string } } | { requiresTwoFactor: true; userId: string }>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error: unknown) {
      this.normalizeError(error);
    }
  }

  async logout() {
    // Server clears httpOnly cookies
    await this.request('/api/v1/auth/logout', {
      method: 'POST',
    });
  }

  async getCurrentUser() {
    return this.request<{ user: { id: string; email: string; name: string; avatar?: string | null; role: string; isPlatformAdmin?: boolean; tenantId: string; tenant?: { id: string; name: string; slug: string; logo?: string | null } } }>('/api/v1/auth/me');
  }

  // ---- Platform admin (super-admin / cross-tenant) ----
  async getPlatformOverview() {
    return this.request<{ status: number; data: { tenants: number; users: number; leads: number; deals: number; activeSubscriptions: number; mrr: number } }>('/api/v1/admin/overview');
  }

  async getPlatformTenants() {
    return this.request<{ status: number; data: Array<{ id: string; name: string; slug: string; createdAt: string; _count: { users: number; leads: number }; subscription?: { status: string; plan: { type: string; name: string } } | null }> }>('/api/v1/admin/tenants');
  }

  async createPlatformTenant(data: {
    tenantName: string;
    slug: string;
    planType: 'STARTER' | 'PRO' | 'ENTERPRISE';
    subscriptionStatus?: 'ACTIVE' | 'TRIAL';
    adminEmail: string;
    adminName: string;
    adminPassword?: string;
  }) {
    return this.request<{ status: number; data: { tenant: { id: string; name: string; slug: string }; admin: { id: string; email: string }; generatedPassword?: string } }>('/api/v1/admin/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProfile(data: { name?: string; phone?: string; avatar?: string | null }) {
    return this.request<{ id: string; name: string; email: string; phone?: string; avatar?: string | null }>('/api/v1/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: { currentPassword: string; newPassword: string }) {
    return this.request<{ message: string }>('/api/v1/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // 2FA endpoints
  async setup2FA() {
    return this.request<{ secret: string; qrCode: string; otpauthUrl: string }>('/api/v1/auth/2fa/setup', {
      method: 'POST',
    });
  }

  async verify2FA(code: string) {
    return this.request<{ enabled: boolean }>('/api/v1/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async disable2FA(code: string) {
    return this.request<{ disabled: boolean }>('/api/v1/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async get2FAStatus() {
    return this.request<{ enabled: boolean }>('/api/v1/auth/2fa/status');
  }

  async updateTenant(data: { name?: string; logo?: string | null; settings?: { slackWebhookUrl?: string | null; teamsWebhookUrl?: string | null } }) {
    return this.request<{ id: string; name: string; slug: string; logo?: string | null; settings?: Record<string, unknown> }>('/api/v1/auth/tenant', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getTenant() {
    return this.request<{ tenant: { id: string; name: string; slug: string; logo?: string | null; settings: Record<string, unknown> } }>('/api/v1/auth/tenant');
  }

  async getProfileStats() {
    return this.request<Record<string, unknown>>('/api/v1/auth/profile/stats');
  }

  async changePlan(data: { planType: string; billingCycle?: string }) {
    return this.request<{ message: string }>('/api/v1/subscriptions/change-plan', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async cancelSubscription() {
    return this.request<{ message: string }>('/api/v1/subscriptions/cancel', {
      method: 'POST',
    });
  }

  // Public lead capture (no auth required)
  async publicCaptureLead(formId: string, data: Record<string, unknown>) {
    return this.request<{ id: string }>(`/api/v1/public/capture/${formId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Dashboard stats
  async getDashboardStats() {
    return this.request<Record<string, unknown>>('/api/v1/dashboard/stats');
  }

  async requestPasswordReset(email: string) {
    try {
      // Ensure email is trimmed and lowercase
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedEmail || !normalizedEmail.includes('@')) {
        throw new ApiError('Email inválido', 400, { code: 'VALIDATION_ERROR' }, 'VALIDATION_ERROR');
      }

      return await this.request<{ message: string }>('/api/v1/auth/password/reset-request', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail }),
      });
    } catch (error: unknown) {
      this.normalizeError(error);
    }
  }

  async resetPassword(token: string, password: string) {
    try {
      return await this.request<{ message: string }>('/api/v1/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
    } catch (error: unknown) {
      this.normalizeError(error);
    }
  }

  // Leads
  async getLeads(filters?: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.request<{ leads: Record<string, unknown>[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(`/api/v1/leads${query ? `?${query}` : ''}`);
  }

  async getLead(id: string) {
    return this.request<Record<string, unknown>>(`/api/v1/leads/${id}`);
  }

  async createLead(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>('/api/v1/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLead(id: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLead(id: string) {
    return this.request(`/api/v1/leads/${id}`, {
      method: 'DELETE',
    });
  }

  async importLeads(data: { leads: Record<string, unknown>[]; skipDuplicateEmails?: boolean }) {
    return this.request<{ imported: number; skipped: number }>('/api/v1/leads/import', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async exportLeads(filters?: { status?: string; source?: string; search?: string; tagId?: string }) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ leads: Record<string, unknown>[] }>(`/api/v1/leads/export${query}`);
  }

  async getLeadDuplicates() {
    return this.request<{ duplicates: Record<string, unknown>[] }>('/api/v1/leads/duplicates');
  }

  async mergeLeads(primaryId: string, duplicateIds: string[]) {
    return this.request<{ id: string }>('/api/v1/leads/merge', {
      method: 'POST',
      body: JSON.stringify({ primaryId, duplicateIds }),
    });
  }

  async convertToContact(id: string) {
    return this.request<{ status: number; data: Record<string, unknown> }>(`/api/v1/leads/${id}/convert`, {
      method: 'POST',
    });
  }

  async revertToLead(id: string) {
    return this.request<{ status: number; data: Record<string, unknown> }>(`/api/v1/leads/${id}/revert`, {
      method: 'POST',
    });
  }

  async bulkUpdateLeads(ids: string[], action: string, payload?: Record<string, unknown>) {
    return this.request<{ status: number; data: { affected: number; action: string } }>('/api/v1/leads/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ ids, action, payload }),
    });
  }

  // Tasks
  async getTasks(filters?: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.request<{ tasks: Record<string, unknown>[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(`/api/v1/tasks${query ? `?${query}` : ''}`);
  }

  async getTask(id: string) {
    return this.request<Record<string, unknown>>(`/api/v1/tasks/${id}`);
  }

  async createTask(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string) {
    return this.request(`/api/v1/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  // Tags
  async getTags() {
    return this.request<Array<{ id: string; name: string; color: string; createdAt: string }>>('/api/v1/tags');
  }

  async getTag(id: string) {
    return this.request<{ id: string; name: string; color: string; createdAt: string }>(`/api/v1/tags/${id}`);
  }

  async createTag(data: { name: string; color?: string }) {
    return this.request<{ id: string; name: string; color: string; createdAt: string }>('/api/v1/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTag(id: string, data: { name?: string; color?: string }) {
    return this.request<{ id: string; name: string; color: string; createdAt: string }>(`/api/v1/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTag(id: string) {
    return this.request(`/api/v1/tags/${id}`, {
      method: 'DELETE',
    });
  }

  // Subscriptions
  async getCurrentSubscription() {
    return this.request<Record<string, unknown>>('/api/v1/subscriptions/current');
  }

  async getPlans() {
    return this.request<Array<Record<string, unknown>>>('/api/v1/subscriptions/plans');
  }

  // Automations
  async getAutomations(filters?: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.request<Record<string, unknown>>(`/api/v1/automations${query ? `?${query}` : ''}`);
  }

  async getAutomation(id: string) {
    return this.request<Record<string, unknown>>(`/api/v1/automations/${id}`);
  }

  async createAutomation(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>('/api/v1/automations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAutomation(id: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/automations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAutomation(id: string) {
    return this.request(`/api/v1/automations/${id}`, {
      method: 'DELETE',
    });
  }

  async getAutomationLogs(id: string, limit?: number) {
    const query = limit ? `?limit=${limit}` : '';
    return this.request<Record<string, unknown>>(`/api/v1/automations/${id}/logs${query}`);
  }

  async getAutomationStats(id: string) {
    return this.request<Record<string, unknown>>(`/api/v1/automations/${id}/stats`);
  }

  // Tenant-wide automation logs with full filtering
  async getAutomationLogsAll(filters?: {
    status?: string;
    leadId?: string;
    stepType?: string;
    automationId?: string;
    executionId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    sort?: 'asc' | 'desc';
  }) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.set(key, String(value));
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Record<string, unknown>>(`/api/v1/automation-logs${query}`);
  }

  async getLogsByExecution(executionId: string) {
    return this.request<Record<string, unknown>>(`/api/v1/automation-logs/execution/${executionId}`);
  }

  async getAutomationLogStats(filters?: { from?: string; to?: string }) {
    const params = new URLSearchParams();
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Record<string, unknown>>(`/api/v1/automation-logs/stats${query}`);
  }

  async executeAutomation(id: string, leadId: string) {
    return this.request<Record<string, unknown>>(`/api/v1/automations/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ leadId }),
    });
  }

  // WhatsApp Connections
  async getWhatsAppConnections() {
    return this.request<Array<Record<string, unknown>>>('/api/v1/whatsapp');
  }

  async getWhatsAppConnection(id: string) {
    return this.request<Record<string, unknown>>(`/api/v1/whatsapp/${id}`);
  }

  async createWhatsAppConnection(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>('/api/v1/whatsapp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWhatsAppConnection(id: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/whatsapp/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWhatsAppConnection(id: string) {
    return this.request(`/api/v1/whatsapp/${id}`, {
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
    return this.request<{ messageId?: string; success: boolean }>('/api/v1/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getWhatsAppTemplates(connectionId: string) {
    return this.request<Array<Record<string, unknown>>>(`/api/v1/whatsapp/${connectionId}/templates`);
  }

  // Email Configs
  async getEmailConfigs() {
    return this.request<Array<Record<string, unknown>>>('/api/v1/email/configs');
  }

  async getEmailConfig(id: string) {
    return this.request<Record<string, unknown>>(`/api/v1/email/configs/${id}`);
  }

  async createEmailConfig(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>('/api/v1/email/configs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmailConfig(id: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/email/configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmailConfig(id: string) {
    return this.request(`/api/v1/email/configs/${id}`, {
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
    return this.request<{ messageId?: string; success: boolean }>('/api/v1/email/send', {
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
    return this.request<{ sent: number; failed: number }>('/api/v1/email/send-bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async scheduleBulkEmail(data: {
    configId: string;
    recipients: Array<{ email: string; leadId?: string; variables?: Record<string, string> }>;
    subject: string;
    html: string;
    text?: string;
    scheduledAt: string;
  }) {
    return this.request<{ campaignId: string; scheduledAt: string; recipientCount: number; status: string }>('/api/v1/email/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelScheduledCampaign(campaignId: string) {
    return this.request<{ campaignId: string; status: string }>(`/api/v1/email/schedule/${campaignId}`, {
      method: 'DELETE',
    });
  }

  async getScheduledCampaignStatus(campaignId: string) {
    return this.request<{ campaignId: string; state: string }>(`/api/v1/email/schedule/${campaignId}`);
  }

  async sendTestEmail(configId: string, toEmail: string) {
    return this.request<{ success: boolean; message?: string }>(`/api/v1/email/configs/${configId}/test`, {
      method: 'POST',
      body: JSON.stringify({ toEmail }),
    });
  }

  // API Keys
  async getApiKeys() {
    return this.request<Array<{ id: string; name: string; key?: string; lastUsedAt?: string; expiresAt?: string; createdAt: string }>>('/api/v1/api-keys');
  }

  async createApiKey(data: { name: string; expiresAt?: string }) {
    return this.request<{ id: string; name: string; key: string; expiresAt?: string; createdAt: string }>('/api/v1/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteApiKey(id: string) {
    return this.request<void>(`/api/v1/api-keys/${id}`, { method: 'DELETE' });
  }

  // Outgoing Webhooks
  async getWebhookEvents() {
    return this.request<string[]>('/api/v1/outgoing-webhooks/events');
  }

  async getOutgoingWebhooks() {
    return this.request<Array<Record<string, unknown>>>('/api/v1/outgoing-webhooks');
  }

  async createOutgoingWebhook(data: { url: string; events: string[] }) {
    return this.request<Record<string, unknown>>('/api/v1/outgoing-webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOutgoingWebhook(id: string, data: { url?: string; events?: string[]; active?: boolean }) {
    return this.request<Record<string, unknown>>(`/api/v1/outgoing-webhooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteOutgoingWebhook(id: string) {
    return this.request<void>(`/api/v1/outgoing-webhooks/${id}`, { method: 'DELETE' });
  }

  async getWebhookLogs(webhookId: string) {
    return this.request<Array<Record<string, unknown>>>(`/api/v1/outgoing-webhooks/${webhookId}/logs`);
  }

  async testOutgoingWebhook(id: string, event?: string) {
    return this.request<{ success: boolean; statusCode?: number; responseTime?: number; payload?: Record<string, unknown> }>(`/api/v1/outgoing-webhooks/${id}/test`, {
      method: 'POST',
      body: JSON.stringify(event ? { event } : {}),
    });
  }

  // Custom Fields
  async getCustomFields(activeOnly?: boolean) {
    const query = activeOnly ? '?active=true' : '';
    return this.request<Array<Record<string, unknown>>>(`/api/v1/custom-fields${query}`);
  }

  async getCustomField(id: string) {
    return this.request<Record<string, unknown>>(`/api/v1/custom-fields/${id}`);
  }

  async createCustomField(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>('/api/v1/custom-fields', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomField(id: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/custom-fields/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomField(id: string) {
    return this.request(`/api/v1/custom-fields/${id}`, {
      method: 'DELETE',
    });
  }

  // Interactions
  async getInteractions(filters?: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.request<Record<string, unknown>>(`/api/v1/interactions${query ? `?${query}` : ''}`);
  }

  async getLeadInteractions(leadId: string) {
    return this.request<Array<Record<string, unknown>>>(`/api/v1/interactions/leads/${leadId}`);
  }

  async createInteraction(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>('/api/v1/interactions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteInteraction(id: string) {
    return this.request(`/api/v1/interactions/${id}`, {
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
    return this.request<Record<string, unknown>>(`/api/v1/interactions/inbox${query ? `?${query}` : ''}`);
  }

  // Funnels (Pipeline)
  async getFunnels(type?: 'LEAD' | 'DEAL') {
    const query = type ? `?type=${type}` : '';
    return this.request<Record<string, unknown>>(`/api/v1/funnels${query}`);
  }

  async getDefaultFunnel(type?: 'LEAD' | 'DEAL') {
    const query = type ? `?type=${type}` : '';
    return this.request<Record<string, unknown>>(`/api/v1/funnels/default${query}`);
  }

  async getFunnel(id: string) {
    return this.request<Record<string, unknown>>(`/api/v1/funnels/${id}`);
  }

  async createFunnel(data: { name: string; type?: 'LEAD' | 'DEAL'; columns?: Array<{ title: string; color?: string; mappedStatus?: string }> }) {
    return this.request<Record<string, unknown>>('/api/v1/funnels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFunnel(id: string, data: { name?: string; order?: number }) {
    return this.request<Record<string, unknown>>(`/api/v1/funnels/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFunnel(id: string) {
    return this.request(`/api/v1/funnels/${id}`, {
      method: 'DELETE',
    });
  }

  async addFunnelColumn(funnelId: string, data: { title: string; color?: string; mappedStatus?: string }) {
    return this.request<Record<string, unknown>>(`/api/v1/funnels/${funnelId}/columns`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFunnelColumn(funnelId: string, columnId: string, data: { title?: string; color?: string; order?: number }) {
    return this.request<Record<string, unknown>>(`/api/v1/funnels/${funnelId}/columns/${columnId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async reorderFunnelColumns(funnelId: string, columnIds: string[]) {
    return this.request<Record<string, unknown>>(`/api/v1/funnels/${funnelId}/columns/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ columnIds }),
    });
  }

  async deleteFunnelColumn(funnelId: string, columnId: string) {
    return this.request(`/api/v1/funnels/${funnelId}/columns/${columnId}`, {
      method: 'DELETE',
    });
  }

  async moveLead(data: { leadId: string; targetColumnId: string; position: number }) {
    return this.request<Record<string, unknown>>('/api/v1/funnels/move-lead', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async moveDeal(data: { dealId: string; targetColumnId: string; position: number }) {
    return this.request<Record<string, unknown>>('/api/v1/funnels/move-deal', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Notifications
  async getNotifications(filters?: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.request<Record<string, unknown>>(`/api/v1/notifications${query ? `?${query}` : ''}`);
  }

  async getUnreadNotificationsCount() {
    return this.request<{ count: number }>('/api/v1/notifications/unread/count');
  }

  async markNotificationAsRead(id: string) {
    return this.request<{ success: boolean }>(`/api/v1/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request<{ success: boolean }>('/api/v1/notifications/read-all', {
      method: 'PUT',
    });
  }

  async deleteNotification(id: string) {
    return this.request(`/api/v1/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  // ========================
  // Scoring Rules
  // ========================

  async getScoringRules() {
    return this.request<Record<string, unknown>>('/api/v1/scoring-rules');
  }

  async getDefaultScoringRules() {
    return this.request<Record<string, unknown>>('/api/v1/scoring-rules/default');
  }

  async getScoringRule(id: string) {
    return this.request<Record<string, unknown>>(`/api/v1/scoring-rules/${id}`);
  }

  async createScoringRule(data: { name: string; eventType: string; points: number; description?: string; conditions?: Record<string, unknown> }) {
    return this.request<Record<string, unknown>>('/api/v1/scoring-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateScoringRule(id: string, data: { name?: string; eventType?: string; points?: number; description?: string | null; active?: boolean; conditions?: Record<string, unknown> | null }) {
    return this.request<Record<string, unknown>>(`/api/v1/scoring-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteScoringRule(id: string) {
    return this.request(`/api/v1/scoring-rules/${id}`, {
      method: 'DELETE',
    });
  }

  async recalculateAllScores() {
    return this.request<{ updated: number }>('/api/v1/scoring-rules/recalculate', {
      method: 'POST',
    });
  }

  async recalculateLeadScore(leadId: string) {
    return this.request<{ score: number }>(`/api/v1/scoring-rules/recalculate/${leadId}`, {
      method: 'POST',
    });
  }

  async getScoreBreakdown(leadId: string) {
    return this.request<Record<string, unknown>>(`/api/v1/scoring-rules/breakdown/${leadId}`);
  }

  // ========================
  // Reports
  // ========================

  async getReports() {
    return this.request<Array<Record<string, unknown>>>('/api/v1/reports');
  }

  async getReport(id: string) {
    return this.request<Record<string, unknown>>(`/api/v1/reports/${id}`);
  }

  async createReport(data: { name: string; description?: string; type?: string; config?: Record<string, unknown> }) {
    return this.request<Record<string, unknown>>('/api/v1/reports', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateReport(id: string, data: { name?: string; description?: string; type?: string; config?: Record<string, unknown> }) {
    return this.request<Record<string, unknown>>(`/api/v1/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteReport(id: string) {
    return this.request(`/api/v1/reports/${id}`, {
      method: 'DELETE',
    });
  }

  async getReportMetrics(params?: { from?: string; to?: string }) {
    const query = new URLSearchParams();
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const qs = query.toString();
    return this.request<Record<string, unknown>>(`/api/v1/reports/metrics${qs ? `?${qs}` : ''}`);
  }

  // ========================
  // Users (Team Management)
  // ========================

  async getUsers() {
    return this.request<Array<{ id: string; name: string; email: string; role: string; status?: string; createdAt?: string }>>('/api/v1/users');
  }

  async updateUser(id: string, data: { role?: string; status?: string }) {
    return this.request<{ id: string; name: string; email: string; role: string }>(`/api/v1/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ========================
  // Invitations (Team Management)
  // ========================

  async getInvitations() {
    return this.request<Array<{ id: string; email: string; role: string; status: string; createdAt: string }>>('/api/v1/invitations');
  }

  async createInvitation(data: { email: string; role: string }) {
    return this.request<{ id: string; email: string; role: string; status: string; emailSent: boolean; invitationLink?: string }>('/api/v1/invitations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resendInvitation(id: string) {
    return this.request<{ emailSent: boolean; invitationLink?: string }>(`/api/v1/invitations/${id}/resend`, {
      method: 'POST',
    });
  }

  async cancelInvitation(id: string) {
    return this.request<void>(`/api/v1/invitations/${id}`, {
      method: 'DELETE',
    });
  }

  // ========================
  // Payments (Backend API)
  // ========================

  async createPaymentIntent(data: { planId: string; planType: string; amount: number; method: string; billingCycle: string }) {
    return this.request<Record<string, unknown>>('/api/v1/payments/intent', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async processCardPayment(data: {
    paymentId: string;
    token: string;
    paymentMethodId: string;
    issuerId?: string;
    installments: number;
  }) {
    return this.request<Record<string, unknown>>('/api/v1/payments/process-card', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPaymentHistory() {
    return this.request<Array<Record<string, unknown>>>('/api/v1/payments/history');
  }

  // ========================
  // Deals
  // ========================

  async getDeals(filters?: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.request<{ deals: Record<string, unknown>[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(`/api/v1/deals${query ? `?${query}` : ''}`);
  }

  async getDeal(id: string) {
    return this.request<Record<string, unknown>>(`/api/v1/deals/${id}`);
  }

  async createDeal(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>('/api/v1/deals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDeal(id: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/deals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDeal(id: string) {
    return this.request(`/api/v1/deals/${id}`, {
      method: 'DELETE',
    });
  }

  async getDealStats() {
    return this.request<{ data: Record<string, unknown> }>('/api/v1/deals/stats');
  }

  async getDealForecast(filters?: { months?: number; assignedTo?: string; stage?: string }) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, String(value));
      });
    }
    const qs = params.toString();
    return this.request<{ status: number; data: import('../../types').ForecastData }>(`/api/v1/deals/forecast${qs ? `?${qs}` : ''}`);
  }

  async getDealTrend(months?: number) {
    const qs = months ? `?months=${months}` : '';
    return this.request<{ status: number; data: import('../../types').TrendData }>(`/api/v1/deals/trend${qs}`);
  }

  async getFunnelConversion(filters?: { from?: string; to?: string; source?: string; assignedTo?: string }) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) params.set(key, String(value));
      });
    }
    const qs = params.toString();
    return this.request<{ status: number; data: import('../../types').FunnelConversionData }>(`/api/v1/reports/funnel-conversion${qs ? `?${qs}` : ''}`);
  }

  async getDealInteractions(dealId: string) {
    return this.request<Array<Record<string, unknown>>>(`/api/v1/interactions?dealId=${dealId}`);
  }

  // ========================
  // Next Action (AI Assistant)
  // ========================

  async getLeadNextAction(leadId: string) {
    return this.request<{ status: number; data: import('../../types').NextAction }>(`/api/v1/leads/${leadId}/next-action`);
  }

  async getDealNextAction(dealId: string) {
    return this.request<{ status: number; data: import('../../types').NextAction }>(`/api/v1/deals/${dealId}/next-action`);
  }

  async getActionSummary(limit = 5) {
    return this.request<{ status: number; data: import('../../types').ActionSummaryItem[] }>(`/api/v1/deals/action-summary?limit=${limit}`);
  }

  // ========================
  // Companies
  // ========================

  async getCompanies(filters?: Record<string, string | number | undefined>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString();
    return this.request<{ companies: Record<string, unknown>[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }>(`/api/v1/companies${query ? `?${query}` : ''}`);
  }

  async getCompany(id: string) {
    return this.request<Record<string, unknown>>(`/api/v1/companies/${id}`);
  }

  async createCompany(data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>('/api/v1/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCompany(id: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/companies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCompany(id: string) {
    return this.request(`/api/v1/companies/${id}`, {
      method: 'DELETE',
    });
  }

  async getCompanyCount() {
    return this.request<{ data: { count: number } }>('/api/v1/companies/stats/count');
  }

  // ========================
  // Google Calendar Integration
  // ========================

  async getGoogleCalendarAuthUrl() {
    return this.request<{ url: string }>('/api/v1/integrations/google/auth-url');
  }

  async getGoogleCalendarStatus() {
    return this.request<{ connected: boolean; email?: string; syncEnabled?: boolean; lastSyncAt?: string | null; connectedAt?: string }>('/api/v1/integrations/google/status');
  }

  async toggleGoogleCalendarSync(syncEnabled: boolean) {
    return this.request<{ syncEnabled: boolean }>('/api/v1/integrations/google/sync-toggle', {
      method: 'PUT',
      body: JSON.stringify({ syncEnabled }),
    });
  }

  async syncGoogleCalendar() {
    return this.request<{ synced: number; total: number }>('/api/v1/integrations/google/sync', {
      method: 'POST',
    });
  }

  async disconnectGoogleCalendar() {
    return this.request<{ disconnected: boolean }>('/api/v1/integrations/google/disconnect', {
      method: 'DELETE',
    });
  }

  // ========================
  // Export (CSV/XLSX/JSON downloads)
  // ========================

  private async downloadExport(
    entity: 'leads' | 'deals' | 'tasks',
    format: 'json' | 'csv' | 'xlsx',
    filters?: Record<string, string | number | undefined>,
  ): Promise<Blob> {
    const params = new URLSearchParams();
    params.set('format', format);
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, String(value));
        }
      });
    }
    const url = `${this.baseURL}/api/v1/exports/${entity}?${params.toString()}`;
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Export failed' }));
      throw new ApiError(errorData.error || 'Export failed', response.status, errorData);
    }
    return response.blob();
  }

  async exportLeadsDownload(
    format: 'json' | 'csv' | 'xlsx',
    filters?: { status?: string; source?: string; search?: string; tagId?: string; assignedTo?: string },
  ): Promise<Blob> {
    return this.downloadExport('leads', format, filters);
  }

  async exportDealsDownload(
    format: 'json' | 'csv' | 'xlsx',
    filters?: { stage?: string; search?: string; assignedTo?: string; leadId?: string; minValue?: number; maxValue?: number },
  ): Promise<Blob> {
    return this.downloadExport('deals', format, filters);
  }

  async exportTasksDownload(
    format: 'json' | 'csv' | 'xlsx',
    filters?: { status?: string; priority?: string; search?: string; assignedTo?: string; leadId?: string; startDate?: string; endDate?: string },
  ): Promise<Blob> {
    return this.downloadExport('tasks', format, filters);
  }

  async downloadInvoice(paymentId: string): Promise<Blob> {
    const response = await fetch(`${this.baseURL}/api/v1/payments/${paymentId}/invoice`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to download invoice');
    }
    return response.blob();
  }

  // ========================
  // AI Email Draft
  // ========================

  async generateEmailDraft(data: {
    leadId?: string;
    dealId?: string;
    templateType: import('../../types').DraftTemplateType;
    customInstructions?: string;
  }) {
    return this.request<{ status: number; data: import('../../types').EmailDraft }>('/api/v1/ai/email-draft', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAITemplates() {
    return this.request<{ status: number; data: import('../../types').DraftTemplate[] }>('/api/v1/ai/templates');
  }

  async getAIConfig() {
    return this.request<{ status: number; data: import('../../types').AIConfig }>('/api/v1/ai/config');
  }

  async testAIConnection() {
    return this.request<{ status: number; data: import('../../types').AIConnectionTest }>('/api/v1/ai/test-connection', {
      method: 'POST',
    });
  }

  // ========================
  // Saved Views
  // ========================

  async getSavedViews(page?: string) {
    const query = page ? `?page=${encodeURIComponent(page)}` : '';
    return this.request<{ status: number; data: SavedView[] }>(`/api/v1/saved-views${query}`);
  }

  async createSavedView(data: {
    name: string;
    page: string;
    filters: Record<string, unknown>;
    columns?: Record<string, unknown> | null;
    isDefault?: boolean;
    isShared?: boolean;
    sortBy?: string | null;
    sortOrder?: string | null;
  }) {
    return this.request<{ status: number; data: SavedView }>('/api/v1/saved-views', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSavedView(id: string, data: {
    name?: string;
    filters?: Record<string, unknown>;
    columns?: Record<string, unknown> | null;
    isDefault?: boolean;
    isShared?: boolean;
    sortBy?: string | null;
    sortOrder?: string | null;
  }) {
    return this.request<{ status: number; data: SavedView }>(`/api/v1/saved-views/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSavedView(id: string) {
    return this.request<{ status: number; data: { deleted: boolean } }>(`/api/v1/saved-views/${id}`, {
      method: 'DELETE',
    });
  }

  // ── Email Templates ────────────────────────────────
  async getEmailTemplates() {
    return this.request<EmailTemplateListItem[]>('/api/v1/email-templates');
  }

  async getEmailTemplate(id: string) {
    return this.request<EmailTemplateDetail>(`/api/v1/email-templates/${id}`);
  }

  async createEmailTemplate(data: { name: string; subject: string; html: string }) {
    return this.request<EmailTemplateDetail>('/api/v1/email-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmailTemplate(id: string, data: Partial<{ name: string; subject: string; html: string }>) {
    return this.request<EmailTemplateDetail>(`/api/v1/email-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmailTemplate(id: string) {
    return this.request<void>(`/api/v1/email-templates/${id}`, { method: 'DELETE' });
  }
}

export interface SavedView {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  page: string;
  filters: Record<string, unknown>;
  columns?: Record<string, unknown> | null;
  isDefault: boolean;
  isShared: boolean;
  sortBy?: string | null;
  sortOrder?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string };
}

/**
 * Unified API error type used across all frontend API calls.
 * Thrown by ApiClient on non-2xx responses and network failures.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
    // Extract code from details if not provided directly
    if (!this.code && this.details?.code) {
      this.code = this.details.code as string;
    }
  }

  /** True for 5xx errors */
  get isServerError(): boolean {
    return this.statusCode >= 500;
  }

  /** True for network failures (statusCode 0) */
  get isNetworkError(): boolean {
    return this.statusCode === 0;
  }

  /** True for 401 Unauthorized */
  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  /** True for 403 Forbidden */
  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  /** True for 404 Not Found */
  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  /** True for 422 or 400 validation errors */
  get isValidationError(): boolean {
    return this.statusCode === 400 || this.statusCode === 422;
  }
}

/** API error response shape returned by the backend */
export interface ApiErrorResponse {
  error: string;
  statusCode: number;
  code?: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export const apiClient = new ApiClient();

export interface EmailTemplateListItem {
  id: string;
  name: string;
  subject: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplateDetail extends EmailTemplateListItem {
  html: string;
}

