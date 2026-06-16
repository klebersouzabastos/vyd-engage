/**
 * Helpers puros do engine de automação (sem dependência de Prisma/Redis), para
 * serem unit-testáveis: cálculo de atraso (delay) e avaliação de condição.
 */

/**
 * Converte a config de um passo de atraso em milissegundos.
 * Aceita o formato da UI ({ duration, unit }) e o legado ({ minutes, hours }).
 * Unidades: n=minutos, h=horas, d=dias, w=semanas.
 */
export function computeDelayMs(config: Record<string, any> | null | undefined): number {
  if (!config) return 0;
  if (typeof config.minutes === 'number' || typeof config.hours === 'number') {
    return ((config.minutes || 0) * 60 + (config.hours || 0) * 3600) * 1000;
  }
  const duration = Number(config.duration ?? 0);
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const perUnitMinutes: Record<string, number> = { n: 1, h: 60, d: 1440, w: 10080 };
  const minutes = duration * (perUnitMinutes[config.unit as string] ?? 1440);
  return minutes * 60 * 1000;
}

export interface ConditionInput {
  operator: string;
  /** Valor do campo do lead (já resolvido; para `tags` passe o array de nomes/ids). */
  leadValue: unknown;
  /** Valor de comparação configurado no nó. */
  value: unknown;
  /** Lista de tags do lead (ids e/ou nomes) — usada por has_tag e field=tags. */
  tags?: string[];
}

/**
 * Avalia uma condição única. Espelha os operadores oferecidos pela UI
 * (CONDITION_OPERATORS) e inclui has_tag (usado pelo gatilho/condição de tags).
 */
export function evaluateCondition({ operator, leadValue, value, tags }: ConditionInput): boolean {
  const str = (v: unknown) => (v == null ? '' : String(v));

  switch (operator) {
    case 'equals':
      return str(leadValue) === str(value);
    case 'not_equals':
      return str(leadValue) !== str(value);
    case 'contains':
      return str(leadValue).toLowerCase().includes(str(value).toLowerCase());
    case 'greater_than':
      return Number(leadValue) > Number(value);
    case 'less_than':
      return Number(leadValue) < Number(value);
    case 'is_empty':
      return leadValue == null || str(leadValue) === '' || (Array.isArray(leadValue) && leadValue.length === 0);
    case 'is_not_empty':
      return !(leadValue == null || str(leadValue) === '' || (Array.isArray(leadValue) && leadValue.length === 0));
    case 'has_tag':
      return (tags || []).map((t) => String(t)).includes(str(value));
    default:
      return false;
  }
}
