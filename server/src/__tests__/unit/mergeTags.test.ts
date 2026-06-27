import { describe, it, expect } from 'vitest';
import { interpolateMergeTags } from '../../utils/mergeTags.js';

describe('interpolateMergeTags', () => {
  const ctx = {
    name: 'Maria Silva',
    email: 'maria@acme.com',
    company: 'Acme',
    phone: '+5511999999999',
  };

  it('substitui as tags pt-BR pelos dados do lead', () => {
    expect(interpolateMergeTags('Olá {{nome}}, da {{empresa}}!', ctx)).toBe(
      'Olá Maria Silva, da Acme!'
    );
  });

  it('aceita aliases (name/company/phone) e espaços', () => {
    expect(interpolateMergeTags('{{ name }} / {{telefone}}', ctx)).toBe(
      'Maria Silva / +5511999999999'
    );
  });

  it('mantém tags desconhecidas intactas', () => {
    expect(interpolateMergeTags('{{nome}} {{desconhecido}}', ctx)).toBe(
      'Maria Silva {{desconhecido}}'
    );
  });

  it('campo ausente vira string vazia', () => {
    expect(interpolateMergeTags('[{{empresa}}]', { name: 'X' })).toBe('[]');
  });

  it('lida com template vazio/nulo', () => {
    expect(interpolateMergeTags('', ctx)).toBe('');
    expect(interpolateMergeTags(null, ctx)).toBe('');
  });
});
