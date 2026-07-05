/**
 * Popup (req 24) — UI da extensão VYD Engage no WhatsApp Web.
 *
 * Fluxo:
 *  1. Carrega/salva API key + baseUrl (chrome.storage.local).
 *  2. Pergunta ao content script da aba ativa qual é o número da conversa aberta.
 *  3. Resolve o número na API (via service worker) → lead/empresa/deals/interações.
 *  4. Ações rápidas: criar lead, criar tarefa, registrar nota (via service worker).
 *
 * GATING GRACIOSO: sem API key → mostra só o card de config; erros da API viram
 * mensagem legível, nunca falha silenciosa.
 */

import {
  STORAGE_KEYS,
  DEFAULT_API_BASE_URL,
  getConfig,
  type ResolvedContact,
  type RuntimeMessage,
} from './shared';

interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Envia uma mensagem ao service worker e aguarda a resposta. */
function sendToWorker<T>(message: RuntimeMessage): Promise<ApiResult<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (resp: ApiResult<T>) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, status: 0, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(resp);
    });
  });
}

/** Pergunta ao content script da aba ativa o número da conversa aberta. */
function getActivePhone(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id || !tab.url?.startsWith('https://web.whatsapp.com')) {
        resolve(null);
        return;
      }
      chrome.tabs.sendMessage(
        tab.id,
        { type: 'GET_ACTIVE_PHONE' } as RuntimeMessage,
        (resp: { type: 'ACTIVE_PHONE'; phone: string | null } | undefined) => {
          if (chrome.runtime.lastError || !resp) {
            resolve(null);
            return;
          }
          resolve(resp.phone);
        }
      );
    });
  });
}

let currentPhone: string | null = null;
let currentLeadId: string | undefined;
let currentCompanyId: string | undefined;

// ── Config ──────────────────────────────────────────
async function loadConfig() {
  const { apiKey, baseUrl } = await getConfig();
  ($('base-url') as HTMLInputElement).value = baseUrl || DEFAULT_API_BASE_URL;
  ($('api-key') as HTMLInputElement).value = apiKey || '';
}

/**
 * Deriva o padrão de origin (ex.: "https://api.exemplo.com/*") de uma baseUrl.
 * Usado para pedir host_permission opcional quando o host difere do default —
 * caso contrário o fetch do service worker é bloqueado pelo Chrome (req 19/20).
 */
function originPattern(baseUrl: string): string | null {
  try {
    const { protocol, host } = new URL(baseUrl);
    if (protocol !== 'https:' && protocol !== 'http:') return null;
    return `${protocol}//${host}/*`;
  } catch {
    return null;
  }
}

/** Host do default (api.vydengage.com) — já coberto por host_permissions fixo. */
function isDefaultHost(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).host === new URL(DEFAULT_API_BASE_URL).host;
  } catch {
    return false;
  }
}

/**
 * Hosts do ecossistema VYD que o manifest permite conceder sob demanda
 * (optional_host_permissions). Um baseUrl custom só pode pedir host_permission
 * se casar com um destes sufixos — senão o Chrome rejeitaria a request porque
 * o padrão não está declarado no manifest. Manter em sincronia com
 * `optional_host_permissions` em manifest.json.
 */
const ALLOWED_HOST_SUFFIXES = ['.vydengage.com', '.vydhub.com'] as const;

/** true se o host do baseUrl pertence ao ecossistema VYD permitido. */
function isAllowedHost(baseUrl: string): boolean {
  try {
    const { host } = new URL(baseUrl);
    return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

async function saveConfig() {
  const apiKey = ($('api-key') as HTMLInputElement).value.trim();
  const baseUrl =
    ($('base-url') as HTMLInputElement).value.trim().replace(/\/+$/, '') || DEFAULT_API_BASE_URL;
  const status = $('config-status');

  // Se o baseUrl aponta para um host diferente do default, o Chrome bloqueia o
  // fetch do service worker sem permissão explícita. Pede a host_permission
  // opcional para esse origin antes de salvar; se negada, aborta com erro claro.
  if (!isDefaultHost(baseUrl)) {
    const pattern = originPattern(baseUrl);
    if (!pattern) {
      status.textContent = 'URL da API inválida. Use uma URL https:// completa.';
      status.className = 'status err';
      return;
    }
    // Só hosts do ecossistema VYD podem receber host_permission sob demanda
    // (o manifest declara apenas *.vydengage.com / *.vydhub.com). Fora disso,
    // erro claro em vez de pedir uma permissão que o manifest não cobre.
    if (!isAllowedHost(baseUrl)) {
      status.textContent =
        'Host não permitido. Use api.vydengage.com ou um domínio *.vydengage.com / *.vydhub.com.';
      status.className = 'status err';
      return;
    }
    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins: [pattern] });
    } catch {
      granted = false;
    }
    if (!granted) {
      status.textContent =
        'Permissão negada para o host informado. Conceda o acesso ou use api.vydengage.com.';
      status.className = 'status err';
      return;
    }
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.apiKey]: apiKey,
    [STORAGE_KEYS.apiBaseUrl]: baseUrl,
  });
  status.textContent = apiKey ? 'Chave salva.' : 'Chave removida.';
  status.className = 'status ok';
  setTimeout(() => (status.textContent = ''), 2500);
  await refresh();
}

// ── Render ──────────────────────────────────────────
function setResolveError(msg: string | null) {
  const el = $('resolve-status');
  if (!msg) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.classList.remove('hidden');
  el.textContent = msg;
}

function renderResult(contact: ResolvedContact) {
  const result = $('result');
  currentLeadId = contact.lead?.id;
  currentCompanyId = contact.company?.id;
  const parts: string[] = [];

  if (contact.lead) {
    parts.push(`
      <div class="card">
        <p class="title">${escapeHtml(contact.lead.name)}</p>
        <p class="muted" style="margin:0;font-size:12px">
          ${escapeHtml(contact.lead.email || 'sem e-mail')} · ${escapeHtml(contact.lead.phone || '')}
        </p>
        ${contact.company ? `<p class="muted" style="margin:4px 0 0;font-size:12px">Empresa: ${escapeHtml(contact.company.name)}</p>` : ''}
      </div>
    `);
  } else if (contact.company) {
    // Sem lead, mas o backend resolveu uma EMPRESA — mostra o card da empresa
    // (nome + telefone) em vez de descartá-la. Deals/interações abaixo continuam.
    parts.push(`
      <div class="card">
        <p class="title">${escapeHtml(contact.company.name)}</p>
        <p class="muted" style="margin:0;font-size:12px">
          ${escapeHtml(contact.company.phone || 'sem telefone')}
        </p>
        <p class="muted" style="margin:4px 0 0;font-size:12px">
          Empresa encontrada — nenhum lead vinculado a este número ainda.
        </p>
      </div>
    `);
  } else {
    parts.push(`
      <div class="card">
        <p class="title">Nenhum lead encontrado</p>
        <p class="muted" style="margin:0;font-size:12px">Este número ainda não está no CRM.</p>
      </div>
    `);
  }

  if (contact.deals.length) {
    const rows = contact.deals
      .map(
        (d) => `<div class="deal"><span>${escapeHtml(d.name)}</span>
          <span class="pill">${escapeHtml(String(d.stage))}</span></div>`
      )
      .join('');
    parts.push(`<div class="card"><p class="title">Negócios (${contact.deals.length})</p>${rows}</div>`);
  }

  if (contact.lastInteractions.length) {
    const rows = contact.lastInteractions
      .map(
        (i) =>
          `<div class="interaction" style="font-size:12px">${escapeHtml(i.type)} · ${escapeHtml(
            (i.content || '').slice(0, 80)
          )}</div>`
      )
      .join('');
    parts.push(`<div class="card"><p class="title">Últimas interações</p>${rows}</div>`);
  }

  // Ações rápidas.
  parts.push(`
    <div class="card">
      <p class="title">Ações rápidas</p>
      <div class="actions">
        ${contact.lead ? '' : '<button id="act-lead" class="primary">Criar lead</button>'}
        <button id="act-task">Criar tarefa</button>
        <button id="act-note">Registrar nota</button>
      </div>
      <div class="status" id="action-status" style="margin-top:6px"></div>
    </div>
  `);

  result.innerHTML = parts.join('');
  result.classList.remove('hidden');
  wireActions();
}

function wireActions() {
  const status = document.getElementById('action-status');
  const setStatus = (msg: string, ok: boolean) => {
    if (!status) return;
    status.textContent = msg;
    status.className = ok ? 'status ok' : 'status err';
  };

  document.getElementById('act-lead')?.addEventListener('click', async () => {
    if (!currentPhone) return;
    const name = prompt('Nome do novo lead:', 'Contato WhatsApp');
    if (!name) return;
    const r = await sendToWorker({ type: 'CREATE_LEAD', name, phone: currentPhone });
    if (r.ok) {
      setStatus('Lead criado.', true);
      await refresh();
    } else setStatus(r.error || 'Erro ao criar lead.', false);
  });

  document.getElementById('act-task')?.addEventListener('click', async () => {
    const title = prompt('Título da tarefa:', 'Retornar contato do WhatsApp');
    if (!title) return;
    // Contato resolvido só por empresa (sem lead): envia companyId para a tarefa
    // não ficar órfã. Havendo lead, mantém o vínculo pelo leadId.
    const r = currentLeadId
      ? await sendToWorker({ type: 'CREATE_TASK', title, leadId: currentLeadId })
      : await sendToWorker({ type: 'CREATE_TASK', title, companyId: currentCompanyId });
    setStatus(r.ok ? 'Tarefa criada.' : r.error || 'Erro ao criar tarefa.', r.ok);
  });

  document.getElementById('act-note')?.addEventListener('click', async () => {
    const content = prompt('Nota:', '');
    if (!content) return;
    // Contato resolvido só por empresa (sem lead): envia companyId para a nota
    // não ficar órfã. Havendo lead, mantém o vínculo pelo leadId.
    const r = currentLeadId
      ? await sendToWorker({ type: 'CREATE_NOTE', content, leadId: currentLeadId })
      : await sendToWorker({ type: 'CREATE_NOTE', content, companyId: currentCompanyId });
    setStatus(r.ok ? 'Nota registrada.' : r.error || 'Erro ao registrar nota.', r.ok);
  });
}

// ── Fluxo principal ─────────────────────────────────
async function refresh() {
  const result = $('result');
  result.classList.add('hidden');
  setResolveError(null);

  const { apiKey } = await getConfig();
  currentPhone = await getActivePhone();

  const phoneLabel = $('phone-label');
  const phoneValue = $('phone-value');
  if (!currentPhone) {
    phoneLabel.textContent = 'Abra uma conversa no WhatsApp Web';
    phoneValue.textContent = 'Não foi possível detectar o número da conversa aberta.';
    return;
  }
  phoneLabel.textContent = 'Contato detectado';
  phoneValue.textContent = currentPhone;

  if (!apiKey) {
    setResolveError('Configure sua API Key acima para resolver o contato.');
    return;
  }

  const r = await sendToWorker<ResolvedContact>({ type: 'RESOLVE', phone: currentPhone });
  if (!r.ok || !r.data) {
    setResolveError(r.error || 'Não foi possível resolver o contato.');
    return;
  }
  renderResult(r.data);
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  $('save-config').addEventListener('click', saveConfig);
  $('refresh').addEventListener('click', refresh);
  await refresh();
});
