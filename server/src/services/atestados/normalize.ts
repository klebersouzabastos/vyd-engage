// Helpers de normalização compartilhados pelo módulo de Gestão de Atestados Técnicos.

/**
 * Normaliza um nome/rótulo para deduplicação e chave de taxonomia:
 * remove acentos, apara, minúsculas e colapsa espaços múltiplos em um só.
 * Ex.: "Projeto Metrô    Projeto Edificação" → "projeto metro projeto edificacao".
 */
export function normalizeName(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Colapsa espaços múltiplos preservando acentuação e caixa (limpeza leve de texto livre). */
export function collapseSpaces(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Só dígitos (CNPJ, telefone). */
export function onlyDigits(v: string | null | undefined): string {
  return (v ?? '').replace(/\D/g, '');
}

/**
 * Parse de número BR tolerante: o separador decimal é o que aparece por ÚLTIMO.
 * Tolera as duas formas ("25.350,29" e a forma dot-decimal "25350.29" do SheetJS).
 */
export function parseBrNumber(value?: string | number | null): number | undefined {
  if (typeof value === 'number') return isNaN(value) ? undefined : value;
  let v = (value || '').trim().replace(/[^\d.,-]/g, '');
  if (v === '' || v === '-') return undefined;
  const lastComma = v.lastIndexOf(',');
  const lastDot = v.lastIndexOf('.');
  if (lastComma > lastDot) v = v.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma) v = v.replace(/,/g, '');
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}

/** Parse de data BR (DD/MM/AAAA ou MM/AAAA). Retorna undefined se não reconhecer. */
export function parseBrDate(value?: string | null): Date | undefined {
  const s = (value || '').trim();
  if (!s) return undefined;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const dt = new Date(year, Number(mo) - 1, Number(d));
    return isNaN(dt.getTime()) ? undefined : dt;
  }
  m = s.match(/^(\d{1,2})\/(\d{4})$/); // MM/AAAA
  if (m) {
    const [, mo, y] = m;
    const dt = new Date(Number(y), Number(mo) - 1, 1);
    return isNaN(dt.getTime()) ? undefined : dt;
  }
  return undefined;
}
