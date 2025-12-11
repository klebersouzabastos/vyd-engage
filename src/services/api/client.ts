const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

class ApiClient {
  private baseURL: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor(baseURL: string = API_URL) {
    this.baseURL = baseURL;
    this.loadTokens();
  }

  private loadTokens() {
    if (typeof window !== 'undefined') {
      this.accessToken = localStorage.getItem('accessToken');
      this.refreshToken = localStorage.getItem('refreshToken');
    }
  }

  private saveTokens(accessToken: string, refreshToken: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
    }
  }

  private clearTokens() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      this.accessToken = null;
      this.refreshToken = null;
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.accessToken;
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', data.accessToken);
        }
        return true;
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }

    this.clearTokens();
    return false;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(url, {
      ...options,
      headers,
    });

    // If unauthorized, try to refresh token
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        // Retry request with new token
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        response = await fetch(url, {
          ...options,
          headers,
        });
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: 'An error occurred',
        statusCode: response.status,
      }));
      throw new ApiError(error.error || 'Request failed', response.status, error);
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
      const result = await this.request<{
        user: any;
        accessToken: string;
        refreshToken: string;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      this.saveTokens(result.accessToken, result.refreshToken);
      return result;
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

  async login(data: { email: string; password: string }) {
    const result = await this.request<{
      user: any;
      accessToken: string;
      refreshToken: string;
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    this.saveTokens(result.accessToken, result.refreshToken);
    return result;
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser() {
    return this.request<any>('/api/auth/me');
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

