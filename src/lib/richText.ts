import DOMPurify from 'dompurify';

/**
 * Sanitização de HTML rico (req 13). Whitelist mínima alinhada ao editor
 * (negrito/itálico/listas/link) — remove scripts, handlers on*, iframes, etc.
 * Aplicada no cliente ANTES de persistir e ao renderizar (timeline).
 */
const RICH_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'ul', 'ol', 'li', 'a'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

/** Sanitiza HTML rico para persistência/exibição segura. */
export function sanitizeRichHtml(html: string | null | undefined): string {
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
