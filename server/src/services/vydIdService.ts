// SSO VYD ID (portal id.vydhub.com) — validação do vyd_token emitido pelo IdP
// corporativo (Supabase Auth). O portal redireciona o navegador para
// /sso#vyd_token=<jwt>; o front POSTa o token em /auth/sso/exchange e este
// serviço o valida antes de emitirmos a sessão nativa do Engage.
//
// IMPORTANTE (validação): o claim padrão `aud` do JWT do Supabase é sempre
// "authenticated" — NÃO validar audience pelo parâmetro da lib. Validamos
// assinatura + issuer via JWKS e depois checamos MANUALMENTE que
// payload.vyd.aud (array de códigos de app) contém "engage".
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { createError } from '../middleware/errorHandler.js';

// Código deste app no VYD ID — deve constar em payload.vyd.aud do token.
const APP_CODE = 'engage';

// Claims proprietários do VYD ID (namespace `vyd` dentro do JWT).
interface VydClaims {
  aud?: string[];
  org_id?: string;
  apps?: Record<string, { roles?: string[] }>;
  platform_admin?: boolean;
}

export interface VydIdentity {
  email: string;
  sub: string;
}

// JWKS remoto — a lib jose faz cache/refresh automático das chaves; mantemos a
// instância em módulo para não recriá-la a cada exchange.
let remoteJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let remoteJwksUrl: string | null = null;

function getJwks(jwksUrl: string): ReturnType<typeof createRemoteJWKSet> {
  if (!remoteJwks || remoteJwksUrl !== jwksUrl) {
    remoteJwks = createRemoteJWKSet(new URL(jwksUrl));
    remoteJwksUrl = jwksUrl;
  }
  return remoteJwks;
}

/**
 * Valida o vyd_token (assinatura + issuer via JWKS, app via payload.vyd.aud)
 * e retorna a identidade mínima { email, sub } para casar com o usuário local.
 */
export async function verifyVydToken(token: string): Promise<VydIdentity> {
  const issuer = process.env.VYD_ID_ISSUER;
  const jwksUrl = process.env.VYD_ID_JWKS_URL;

  if (!issuer || !jwksUrl) {
    throw createError(
      'SSO VYD ID não está configurado neste ambiente',
      503,
      'SSO_NOT_CONFIGURED'
    );
  }

  let payload: JWTPayload & { vyd?: VydClaims };
  try {
    // SEM `audience` aqui (ver nota no topo do arquivo).
    ({ payload } = await jwtVerify(token, getJwks(jwksUrl), { issuer }));
  } catch {
    throw createError('Token VYD ID inválido ou expirado', 401, 'SSO_INVALID_TOKEN');
  }

  // Checagem manual do app: payload.vyd.aud é um array de códigos de app.
  const vydAud = payload.vyd?.aud;
  if (!Array.isArray(vydAud) || !vydAud.includes(APP_CODE)) {
    throw createError(
      'Este token VYD ID não concede acesso ao VYD Engage',
      403,
      'SSO_APP_NOT_AUTHORIZED'
    );
  }

  // O e-mail vem top-level no JWT do Supabase (payload.email).
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!email || typeof payload.sub !== 'string' || !payload.sub) {
    throw createError('Token VYD ID sem e-mail ou subject', 401, 'SSO_INVALID_TOKEN');
  }

  return { email, sub: payload.sub };
}

// Export as service object
export const vydIdService = {
  verifyVydToken,
};
