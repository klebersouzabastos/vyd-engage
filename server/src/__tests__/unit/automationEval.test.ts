import { describe, it, expect } from 'vitest';
import { computeDelayMs, evaluateCondition } from '../../utils/automationEval.js';

describe('computeDelayMs', () => {
  it('converte duration/unit (UI) para ms', () => {
    expect(computeDelayMs({ duration: 1, unit: 'n' })).toBe(60_000); // 1 min
    expect(computeDelayMs({ duration: 2, unit: 'h' })).toBe(2 * 3600_000);
    expect(computeDelayMs({ duration: 3, unit: 'd' })).toBe(3 * 86_400_000);
    expect(computeDelayMs({ duration: 1, unit: 'w' })).toBe(7 * 86_400_000);
  });

  it('default de unidade é dias', () => {
    expect(computeDelayMs({ duration: 1 })).toBe(86_400_000);
  });

  it('aceita formato legado minutes/hours', () => {
    expect(computeDelayMs({ minutes: 30, hours: 1 })).toBe((30 * 60 + 3600) * 1000);
  });

  it('retorna 0 para config vazia/inválida', () => {
    expect(computeDelayMs(null)).toBe(0);
    expect(computeDelayMs({})).toBe(0);
    expect(computeDelayMs({ duration: 0, unit: 'd' })).toBe(0);
    expect(computeDelayMs({ duration: -5, unit: 'd' })).toBe(0);
  });
});

describe('evaluateCondition', () => {
  it('equals / not_equals comparam como string', () => {
    expect(evaluateCondition({ operator: 'equals', leadValue: 'WON', value: 'WON' })).toBe(true);
    expect(evaluateCondition({ operator: 'equals', leadValue: 100, value: '100' })).toBe(true);
    expect(evaluateCondition({ operator: 'not_equals', leadValue: 'NEW', value: 'WON' })).toBe(true);
  });

  it('contains é case-insensitive', () => {
    expect(evaluateCondition({ operator: 'contains', leadValue: 'Acme Corp', value: 'acme' })).toBe(true);
    expect(evaluateCondition({ operator: 'contains', leadValue: 'Acme', value: 'xyz' })).toBe(false);
  });

  it('greater_than / less_than comparam numericamente', () => {
    expect(evaluateCondition({ operator: 'greater_than', leadValue: 80, value: '50' })).toBe(true);
    expect(evaluateCondition({ operator: 'less_than', leadValue: 30, value: '50' })).toBe(true);
    expect(evaluateCondition({ operator: 'greater_than', leadValue: 10, value: '50' })).toBe(false);
  });

  it('is_empty / is_not_empty cobrem null, string vazia e array vazio', () => {
    expect(evaluateCondition({ operator: 'is_empty', leadValue: null, value: '' })).toBe(true);
    expect(evaluateCondition({ operator: 'is_empty', leadValue: '', value: '' })).toBe(true);
    expect(evaluateCondition({ operator: 'is_empty', leadValue: [], value: '' })).toBe(true);
    expect(evaluateCondition({ operator: 'is_not_empty', leadValue: 'x', value: '' })).toBe(true);
    expect(evaluateCondition({ operator: 'is_not_empty', leadValue: null, value: '' })).toBe(false);
  });

  it('has_tag verifica presença na lista de tags', () => {
    expect(evaluateCondition({ operator: 'has_tag', leadValue: null, value: 'vip', tags: ['vip', 'lead-quente'] })).toBe(true);
    expect(evaluateCondition({ operator: 'has_tag', leadValue: null, value: 'frio', tags: ['vip'] })).toBe(false);
  });

  it('operador desconhecido retorna false', () => {
    expect(evaluateCondition({ operator: 'regex', leadValue: 'x', value: 'x' })).toBe(false);
  });
});
