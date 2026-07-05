/**
 * Tipos e utilidades compartilhados entre content script, service worker e popup
 * da extensão VYD Engage (req 24). Standalone — não depende do app principal.
 */

/** Chaves usadas em chrome.storage.local. */
export const STORAGE_KEYS = {
  apiKey: 'vyd_api_key',
  apiBaseUrl: 'vyd_api_base_url',
} as const;

/** Base padrão da API (o usuário pode sobrescrever no popup). */
export const DEFAULT_API_BASE_URL = 'https://api.vydengage.com';

/** Mensagens trocadas entre popup ⇄ service worker ⇄ content script. */
export type RuntimeMessage =
  | { type: 'GET_ACTIVE_PHONE' }
  | { type: 'ACTIVE_PHONE'; phone: string | null }
  | { type: 'RESOLVE'; phone: string }
  | { type: 'CREATE_LEAD'; name: string; phone: string }
  | { type: 'CREATE_TASK'; title: string; leadId?: string }
  | { type: 'CREATE_NOTE'; content: string; leadId?: string };

/** Contrato de GET /contacts/resolve?phone= (espelha o backend). */
export interface ResolvedContactLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
}
export interface ResolvedContactCompany {
  id: string;
  name: string;
  phone: string | null;
}
export interface ResolvedContactDeal {
  id: string;
  name: string;
  stage: string;
  status: string;
  value: string | number;
}
export interface ResolvedContactInteraction {
  id: string;
  type: string;
  direction: string;
  content: string;
  createdAt: string;
}
export interface ResolvedContact {
  lead: ResolvedContactLead | null;
  company: ResolvedContactCompany | null;
  deals: ResolvedContactDeal[];
  lastInteractions: ResolvedContactInteraction[];
}

/** Lê apiKey + baseUrl do storage. */
export async function getConfig(): Promise<{ apiKey: string | null; baseUrl: string }> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.apiKey, STORAGE_KEYS.apiBaseUrl]);
  return {
    apiKey: (data[STORAGE_KEYS.apiKey] as string) || null,
    baseUrl: (data[STORAGE_KEYS.apiBaseUrl] as string) || DEFAULT_API_BASE_URL,
  };
}

/** Só dígitos — para casar com a normalização do backend. */
export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D+/g, '');
}
