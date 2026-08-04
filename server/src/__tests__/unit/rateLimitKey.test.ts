import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { ipDoCliente } from '../../middleware/rateLimit.js';

/**
 * Chave do apiLimiter.
 *
 * O frontend fala com engage.vydhub.com e a Vercel proxia /api até aqui, então
 * o `req.ip` do Express é o IP da INFRAESTRUTURA — e `trust proxy` não resolve,
 * porque a Vercel não coloca o cliente no X-Forwarded-For. Sem esta função, o
 * balde de 100 req/15min é UM SÓ para o app inteiro.
 */
function reqFalso(headers: Record<string, string>, ip = '10.0.0.1'): Request {
  return {
    ip,
    get: (nome: string) => headers[nome.toLowerCase()],
  } as unknown as Request;
}

describe('ipDoCliente', () => {
  it('usa o IP real do usuário que a Vercel repassa', () => {
    const req = reqFalso({ 'x-vercel-forwarded-for': '186.248.207.190' }, '56.125.190.173');
    expect(ipDoCliente(req)).toBe('186.248.207.190');
  });

  it('NÃO usa o req.ip quando o header da Vercel existe — era esse o bug', () => {
    // 56.125.190.173 é um IP de edge: todos os usuários chegariam com ele e
    // dividiriam o mesmo balde.
    const req = reqFalso({ 'x-vercel-forwarded-for': '186.248.207.190' }, '56.125.190.173');
    expect(ipDoCliente(req)).not.toBe('56.125.190.173');
  });

  it('pega só o primeiro quando vem uma lista', () => {
    const req = reqFalso({ 'x-vercel-forwarded-for': '186.248.207.190, 10.1.1.1' });
    expect(ipDoCliente(req)).toBe('186.248.207.190');
  });

  it('cai no req.ip sem o header (dev local, chamada direta ao Railway)', () => {
    expect(ipDoCliente(reqFalso({}, '203.0.113.7'))).toBe('203.0.113.7');
  });

  it('nunca devolve vazio', () => {
    const req = { ip: undefined, get: () => undefined } as unknown as Request;
    expect(ipDoCliente(req)).toBe('anonymous');
  });
});
