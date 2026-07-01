import { apiClient } from '../services/api/client';
import { toast } from 'sonner';

interface MigrationData {
  leads?: any[];
  tasks?: any[];
  tags?: any[];
  automations?: any[];
  whatsappConnections?: any[];
  emailConfigs?: any[];
  customFields?: any[];
}

/**
 * Detecta dados no localStorage que podem ser migrados
 */
export function detectLocalStorageData(): MigrationData {
  const data: MigrationData = {};

  try {
    // Leads
    const leads = localStorage.getItem('leads');
    if (leads) {
      const parsed = JSON.parse(leads);
      if (Array.isArray(parsed) && parsed.length > 0) {
        data.leads = parsed;
      }
    }

    // Tasks
    const tasks = localStorage.getItem('tasks');
    if (tasks) {
      const parsed = JSON.parse(tasks);
      if (Array.isArray(parsed) && parsed.length > 0) {
        data.tasks = parsed;
      }
    }

    // Tags
    const tags = localStorage.getItem('tags');
    if (tags) {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed) && parsed.length > 0) {
        data.tags = parsed;
      }
    }

    // Automations
    const automations = localStorage.getItem('automations');
    if (automations) {
      const parsed = JSON.parse(automations);
      if (Array.isArray(parsed) && parsed.length > 0) {
        data.automations = parsed;
      }
    }

    // WhatsApp Connections
    const whatsappConnections = localStorage.getItem('whatsappConnections');
    if (whatsappConnections) {
      const parsed = JSON.parse(whatsappConnections);
      if (Array.isArray(parsed) && parsed.length > 0) {
        data.whatsappConnections = parsed;
      }
    }

    // Email Configs
    const emailConfigs = localStorage.getItem('emailConfigs');
    if (emailConfigs) {
      const parsed = JSON.parse(emailConfigs);
      if (Array.isArray(parsed) && parsed.length > 0) {
        data.emailConfigs = parsed;
      }
    }

    // Custom Fields
    const customFields = localStorage.getItem('customFields');
    if (customFields) {
      const parsed = JSON.parse(customFields);
      if (Array.isArray(parsed) && parsed.length > 0) {
        data.customFields = parsed;
      }
    }
  } catch (error) {
    console.error('Error detecting localStorage data:', error);
  }

  return data;
}

/**
 * Verifica se há dados para migrar
 */
export function hasDataToMigrate(): boolean {
  const data = detectLocalStorageData();
  return !!(
    data.leads?.length ||
    data.tasks?.length ||
    data.tags?.length ||
    data.automations?.length ||
    data.whatsappConnections?.length ||
    data.emailConfigs?.length ||
    data.customFields?.length
  );
}

/**
 * Migra dados do localStorage para a API
 */
export async function migrateDataToAPI(
  onProgress?: (progress: { current: number; total: number; type: string }) => void
): Promise<{ success: boolean; errors: string[] }> {
  const data = detectLocalStorageData();
  const errors: string[] = [];
  let totalItems = 0;
  let currentItem = 0;

  // Count total items
  totalItems += data.leads?.length || 0;
  totalItems += data.tasks?.length || 0;
  totalItems += data.tags?.length || 0;
  totalItems += data.automations?.length || 0;
  totalItems += data.whatsappConnections?.length || 0;
  totalItems += data.emailConfigs?.length || 0;
  totalItems += data.customFields?.length || 0;

  // Migrate Tags first (they might be referenced by leads)
  if (data.tags && data.tags.length > 0) {
    for (const tag of data.tags) {
      try {
        currentItem++;
        onProgress?.({
          current: currentItem,
          total: totalItems,
          type: 'tags',
        });

        await apiClient.createTag({
          name: tag.name || tag.label,
          color: tag.color || 'var(--vyd-action-primary)',
        });
      } catch (error: any) {
        console.error('Error migrating tag:', error);
        errors.push(`Tag "${tag.name || tag.label}": ${error.message}`);
      }
    }
  }

  // Migrate Leads
  if (data.leads && data.leads.length > 0) {
    // Get tags mapping
    const tagsMap = new Map<string, string>();
    try {
      const apiTags = await apiClient.getTags();
      const localTags = data.tags || [];
      localTags.forEach((localTag: any, index: number) => {
        const apiTag = apiTags.find(
          (t: any) => t.name === localTag.name || t.name === localTag.label
        );
        if (apiTag) {
          tagsMap.set(localTag.id || index.toString(), apiTag.id);
        }
      });
    } catch (error) {
      console.warn('Could not map tags:', error);
    }

    for (const lead of data.leads) {
      try {
        currentItem++;
        onProgress?.({
          current: currentItem,
          total: totalItems,
          type: 'leads',
        });

        const tagIds = lead.tags
          ? lead.tags
              .map((tagId: string) => tagsMap.get(tagId))
              .filter((id: string | undefined) => id !== undefined)
          : undefined;

        await apiClient.createLead({
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          position: lead.position,
          status: lead.status,
          source: lead.source,
          score: lead.score || 0,
          customFields: lead.customFields || {},
          notes: lead.notes,
          tagIds,
        });
      } catch (error: any) {
        console.error('Error migrating lead:', error);
        errors.push(`Lead "${lead.name}": ${error.message}`);
      }
    }
  }

  // Migrate Tasks
  if (data.tasks && data.tasks.length > 0) {
    for (const task of data.tasks) {
      try {
        currentItem++;
        onProgress?.({
          current: currentItem,
          total: totalItems,
          type: 'tasks',
        });

        await apiClient.createTask({
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
        });
      } catch (error: any) {
        console.error('Error migrating task:', error);
        errors.push(`Task "${task.title}": ${error.message}`);
      }
    }
  }

  // Note: Automations, WhatsApp Connections, Email Configs, and Custom Fields
  // would need their respective API endpoints to be fully implemented
  // For now, we'll skip them or log a warning

  if (data.automations?.length) {
    console.warn('Automations migration not yet implemented');
  }

  if (data.whatsappConnections?.length) {
    console.warn('WhatsApp connections migration not yet implemented');
  }

  if (data.emailConfigs?.length) {
    console.warn('Email configs migration not yet implemented');
  }

  if (data.customFields?.length) {
    console.warn('Custom fields migration not yet implemented');
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

/**
 * Cria backup dos dados do localStorage antes da migração
 */
export function backupLocalStorageData(): string {
  const backup: any = {};

  const keys = [
    'leads',
    'tasks',
    'tags',
    'automations',
    'whatsappConnections',
    'emailConfigs',
    'customFields',
    'companyName',
    'companyLogo',
  ];

  keys.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        backup[key] = JSON.parse(value);
      } catch {
        backup[key] = value;
      }
    }
  });

  const backupJson = JSON.stringify(backup, null, 2);
  const blob = new Blob([backupJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vyd-engage-backup-${new Date().toISOString()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return backupJson;
}

/**
 * Limpa dados migrados do localStorage (opcional)
 */
export function clearMigratedData(): void {
  const keys = [
    'leads',
    'tasks',
    'tags',
    'automations',
    'whatsappConnections',
    'emailConfigs',
    'customFields',
  ];

  keys.forEach((key) => {
    localStorage.removeItem(key);
  });
}
