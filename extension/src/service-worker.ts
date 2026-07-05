/**
 * Service worker (req 24) — relay autenticado entre o popup e a API do VYD Engage.
 *
 * Centraliza o acesso à API: guarda/lê a API key do chrome.storage e faz as
 * chamadas fetch a partir do contexto do SW (que tem host_permissions), evitando
 * problemas de CORS do popup. NUNCA embute segredos no código — a API key é do
 * usuário e vive apenas no chrome.storage.local dele.
 *
 * Endpoints usados (todos no grupo /contacts — apiKeyAuth, CSRF-exempt):
 *   GET  /api/v1/contacts/resolve?phone=   (X-API-Key; scope contacts:read)
 *   POST /api/v1/contacts/leads            (scope leads:write)
 *   POST /api/v1/contacts/tasks            (scope tasks:write)
 *   POST /api/v1/contacts/notes            (scope leads:write)
 *
 * GATING GRACIOSO: sem API key → erro claro ("configure a API key"), nunca falha
 * silenciosa. Erros HTTP da API são propagados com status + mensagem legível.
 */

import { getConfig, type RuntimeMessage, type ResolvedContact } from './shared';

interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function apiFetch<T>(
  path: string,
  init: RequestInit & { method: string }
): Promise<ApiResult<T>> {
  const { apiKey, baseUrl } = await getConfig();
  if (!apiKey) {
    return { ok: false, status: 0, error: 'Configure sua API Key no popup da extensão.' };
  }
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        ...(init.headers || {}),
      },
    });
  } catch {
    return {
      ok: false,
      status: 0,
      error: 'Não foi possível conectar à API. Verifique a URL e sua conexão.',
    };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* corpo vazio ou não-JSON */
  }

  if (!res.ok) {
    const message =
      (body as { error?: string })?.error ||
      (res.status === 401
        ? 'API Key inválida ou sem permissão (verifique os escopos da chave).'
        : `Erro ${res.status} ao chamar a API.`);
    return { ok: false, status: res.status, error: message };
  }

  // O backend responde ora { status, data }, ora o objeto direto.
  const data = (body as { data?: T })?.data ?? (body as T);
  return { ok: true, status: res.status, data };
}

async function handleMessage(message: RuntimeMessage): Promise<ApiResult<unknown>> {
  switch (message.type) {
    case 'RESOLVE':
      return apiFetch<ResolvedContact>(
        `/api/v1/contacts/resolve?phone=${encodeURIComponent(message.phone)}`,
        { method: 'GET' }
      );
    case 'CREATE_LEAD':
      return apiFetch('/api/v1/contacts/leads', {
        method: 'POST',
        body: JSON.stringify({ name: message.name, phone: message.phone }),
      });
    case 'CREATE_TASK':
      return apiFetch('/api/v1/contacts/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: message.title, leadId: message.leadId }),
      });
    case 'CREATE_NOTE':
      return apiFetch('/api/v1/contacts/notes', {
        method: 'POST',
        body: JSON.stringify({ content: message.content, leadId: message.leadId }),
      });
    default:
      return { ok: false, status: 0, error: 'Mensagem desconhecida.' };
  }
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  // Só tratamos mensagens de API aqui; GET_ACTIVE_PHONE é do content script.
  if (
    message.type === 'RESOLVE' ||
    message.type === 'CREATE_LEAD' ||
    message.type === 'CREATE_TASK' ||
    message.type === 'CREATE_NOTE'
  ) {
    handleMessage(message).then(sendResponse);
    return true; // resposta assíncrona
  }
  return false;
});
