// Deteccao e substituicao de placeholders [TEXTO] nos prompts-modelo.
//
// Um placeholder e qualquer [conteudo] de ate 60 caracteres que NAO seja
// seguido de "(" (para nao confundir com links markdown [texto](url)) e que
// contenha ao menos uma letra.

function placeholderRegex(): RegExp {
  return /\[([^\]\n]{1,60})\](?!\()/g;
}

/** Lista, na ordem de aparição e sem repetir, os placeholders do template. */
export function extractPlaceholders(template: string): string[] {
  const re = placeholderRegex();
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(template || '')) !== null) {
    const key = m[1].trim();
    if (!/[a-zA-ZÀ-ÿ]/.test(key)) continue; // precisa ter letra
    if (!seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

/** Substitui os placeholders pelos valores; mantém o original quando vazio. */
export function applyPlaceholders(
  template: string,
  values: Record<string, string>,
): string {
  return (template || '').replace(placeholderRegex(), (full, rawKey: string) => {
    const value = values[rawKey.trim()];
    return value && value.trim() ? value : full;
  });
}

/** Placeholders ainda sem valor preenchido (para sinalizar ao usuário). */
export function unfilledPlaceholders(
  template: string,
  values: Record<string, string>,
): string[] {
  return extractPlaceholders(template).filter((k) => !values[k] || !values[k].trim());
}

/** Rótulo amigável para um placeholder (ex.: "EMPRESA" → "Empresa"). */
export function friendlyLabel(key: string): string {
  const k = (key || '').trim();
  if (!k) return k;
  return k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
}
