/**
 * Content script (req 24) — roda em https://web.whatsapp.com/*.
 *
 * Detecta o número de telefone da conversa aberta no WhatsApp Web e responde a
 * mensagens `GET_ACTIVE_PHONE` vindas do popup (via service worker / runtime).
 *
 * O WhatsApp Web não expõe o número de forma estável na UI: usamos várias
 * heurísticas em ordem de confiabilidade, tolerando mudanças de layout. Se nada
 * casar, retorna null e o popup pede para o usuário abrir uma conversa.
 */

import { normalizePhoneDigits, type RuntimeMessage } from './shared';

/**
 * Extrai um telefone de uma string livre (cabeçalho, título, etc.).
 * Aceita formatos com +, DDI, DDD e máscara. Exige ao menos 8 dígitos para
 * evitar falso-positivo com horas/contadores.
 */
function extractPhone(text: string | null | undefined): string | null {
  if (!text) return null;
  // Casa "+55 11 99999-9999", "55 11 9999 9999", "(11) 99999-9999" etc.
  const match = text.match(/\+?\d[\d\s().-]{7,}\d/);
  if (!match) return null;
  const digits = normalizePhoneDigits(match[0]);
  return digits.length >= 8 ? digits : null;
}

/**
 * Tenta descobrir o número da conversa aberta. Heurísticas:
 *  1. Cabeçalho da conversa (título/subtítulo) — quando o contato NÃO tem nome
 *     salvo, o WhatsApp exibe o próprio número ali.
 *  2. `aria-label` de elementos do cabeçalho.
 *  3. Atributos de dados que às vezes contêm o JID (ex.: 5511...@c.us).
 */
function detectActivePhone(): string | null {
  // 1) Cabeçalho principal da conversa.
  const headerSelectors = [
    'header [data-testid="conversation-info-header-chat-title"]',
    'header span[dir="auto"][title]',
    'header ._amig span[dir="auto"]',
    '[data-testid="conversation-header"] span[title]',
  ];
  for (const sel of headerSelectors) {
    const el = document.querySelector(sel);
    const fromTitle = extractPhone(el?.getAttribute('title'));
    if (fromTitle) return fromTitle;
    const fromText = extractPhone(el?.textContent);
    if (fromText) return fromText;
  }

  // 2) aria-labels do cabeçalho.
  const header = document.querySelector('header');
  if (header) {
    const labelled = header.querySelectorAll('[aria-label]');
    for (const node of Array.from(labelled)) {
      const fromAria = extractPhone(node.getAttribute('aria-label'));
      if (fromAria) return fromAria;
    }
  }

  // 3) JID em atributos de dados (formato 5511999999999@c.us).
  const jidNode = document.querySelector('[data-id*="@c.us"], [data-jid*="@c.us"]');
  const rawJid =
    jidNode?.getAttribute('data-id') || jidNode?.getAttribute('data-jid') || '';
  const jidMatch = rawJid.match(/(\d{8,15})@c\.us/);
  if (jidMatch) return jidMatch[1];

  return null;
}

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === 'GET_ACTIVE_PHONE') {
      sendResponse({ type: 'ACTIVE_PHONE', phone: detectActivePhone() });
    }
    // Resposta síncrona — não retornar true.
    return false;
  }
);
