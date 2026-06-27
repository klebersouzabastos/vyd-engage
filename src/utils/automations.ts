// Stub — automations now come from API (localStorage removed)
// ReportFilters still references getAllAutomations for backwards compat

export interface Automation {
  id: number;
  name: string;
  type: 'whatsapp' | 'email';
  status: 'active' | 'paused';
  steps: number;
  createdAt?: string;
  updatedAt?: string;
}

/** @deprecated Use apiClient.getAutomations() instead */
export function getAllAutomations(): Automation[] {
  return [];
}
