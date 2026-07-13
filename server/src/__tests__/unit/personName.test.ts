import { describe, it, expect } from 'vitest';
import { personNameSchema } from '../../utils/validators.js';

/**
 * Regressão do bug em que o campo "nome" (aceite de convite / registro / perfil)
 * recebia um e-mail — poluindo o nome e mascarando o e-mail de login real.
 */
describe('personNameSchema', () => {
  it('rejeita um e-mail no campo nome', () => {
    const r = personNameSchema.safeParse('leandro.hara@k2mais.com.br');
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/não um endereço de e-mail/i);
    }
  });

  it('rejeita qualquer string contendo @', () => {
    expect(personNameSchema.safeParse('fulano@').success).toBe(false);
  });

  it('rejeita nome muito curto', () => {
    expect(personNameSchema.safeParse('a').success).toBe(false);
  });

  it('aceita um nome de pessoa e faz trim', () => {
    const r = personNameSchema.safeParse('  Leandro Hara  ');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('Leandro Hara');
  });

  it('aceita nome com acento', () => {
    expect(personNameSchema.safeParse('José Antônio').success).toBe(true);
  });
});
