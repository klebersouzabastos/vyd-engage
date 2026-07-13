import { z } from 'zod';

/**
 * Nome de pessoa: `trim` + mínimo 2 caracteres + NÃO pode ser um endereço de
 * e-mail.
 *
 * Motivação: houve um caso em que o campo "nome" (no aceite de convite) recebeu
 * o e-mail do próprio usuário. O nome ficou poluído com um e-mail e, pior,
 * mascarou qual era o e-mail de LOGIN real — o usuário tentava logar com o
 * e-mail que via como "nome" e recebia "credenciais inválidas". Um nome de
 * pessoa nunca contém `@`, então rejeitamos isso na origem.
 */
export const personNameSchema = z
  .string()
  .trim()
  .min(2, 'Informe seu nome (mínimo 2 caracteres).')
  .refine((v) => !v.includes('@'), 'Informe seu nome completo, não um endereço de e-mail.');
