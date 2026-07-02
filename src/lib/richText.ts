import DOMPurify from 'dompurify';

/**
 * Sanitização de HTML rico (req 13 + editor "Word-like"). Whitelist alinhada ao
 * editor: títulos, negrito/itálico/sublinhado/tachado, realce, alinhamento,
 * cor (só via token do DS), listas, citação, código, link. Remove scripts,
 * handlers on*, iframes, url()/javascript: em style, etc. Aplicada no cliente
 * ANTES de persistir e ao renderizar (timeline).
 */
const RICH_CONFIG = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'b',
    'i',
    'u',
    's',
    'mark',
    'span',
    'ul',
    'ol',
    'li',
    'a',
    'h1',
    'h2',
    'h3',
    'blockquote',
    'pre',
    'code',
    'hr',
  ],
  // Sem 'class': o conteúdo não deve carregar classes arbitrárias (evita overlays/
  // estilos maliciosos); o estilo visual vem de RICH_CONTENT_CLASS no wrapper.
  ALLOWED_ATTR: ['href', 'target', 'rel', 'style', 'data-color'],
  ALLOW_DATA_ATTR: false,
};

// Propriedades de style permitidas no conteúdo (alinhamento + cor/realce). Só
// valores seguros: nada de url()/expression()/javascript:. var(--vyd-*) é OK.
const SAFE_STYLE_PROPS = new Set(['text-align', 'color', 'background-color']);
let hookInstalled = false;
function ensureStyleHook() {
  if (hookInstalled) return;
  hookInstalled = true;
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    // href: só protocolos seguros (defense-in-depth além do default do DOMPurify).
    if (data.attrName === 'href') {
      if (!/^(?:https?:|mailto:|\/|#)/i.test((data.attrValue || '').trim())) {
        data.attrValue = '';
      }
      return;
    }
    if (data.attrName !== 'style') return;
    const safe = (data.attrValue || '')
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .filter((decl) => {
        const idx = decl.indexOf(':');
        if (idx < 0) return false;
        const prop = decl.slice(0, idx).trim().toLowerCase();
        const value = decl.slice(idx + 1).trim();
        if (!SAFE_STYLE_PROPS.has(prop)) return false;
        if (/url\(|expression|javascript:|@import/i.test(value)) return false;
        return true;
      })
      .join('; ');
    data.attrValue = safe;
  });
}

/** Sanitiza HTML rico para persistência/exibição segura. */
export function sanitizeRichHtml(html: string | null | undefined): string {
  ensureStyleHook();
  return DOMPurify.sanitize(html ?? '', RICH_CONFIG) as unknown as string;
}

/** Reduz HTML rico a texto puro (strip de tags) — para previews/resumos (ex.: Inbox). */
export function stripHtml(html: string | null | undefined): string {
  const clean = DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  }) as unknown as string;
  if (typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.innerHTML = clean;
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }
  return clean.replace(/\s+/g, ' ').trim();
}

/** true se a string parece conter marcação HTML. */
export function isRichHtml(s: string | null | undefined): boolean {
  return !!s && /<[a-z][\s\S]*>/i.test(s);
}
