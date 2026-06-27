/**
 * Substituição de variáveis de merge (`{{nome}}`, `{{email}}`, ...) usadas nos
 * passos de automação (e-mail / WhatsApp / tarefa). Espelha os chips do builder
 * (MergeTagField). Tags desconhecidas são mantidas como estão.
 */
export interface MergeContext {
  name?: string | null;
  email?: string | null;
  company?: string | null;
  phone?: string | null;
}

const ALIASES: Record<string, keyof MergeContext> = {
  nome: 'name',
  name: 'name',
  email: 'email',
  'e-mail': 'email',
  empresa: 'company',
  company: 'company',
  telefone: 'phone',
  phone: 'phone',
};

export function interpolateMergeTags(
  template: string | null | undefined,
  ctx: MergeContext
): string {
  if (!template) return '';
  return template.replace(/\{\{\s*([a-zA-Z_-]+)\s*\}\}/g, (match, rawKey: string) => {
    const field = ALIASES[rawKey.toLowerCase()];
    if (!field) return match; // tag desconhecida: preserva
    const value = ctx[field];
    return value != null && value !== '' ? String(value) : '';
  });
}
