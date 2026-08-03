/*
 * Identidade do VYD ID — camada PARALELA à autenticação do Engage.
 *
 * O motor da Central valida o Bearer contra o JWKS do IdP e exige a claim
 * `vyd.aud` com 'engage'. A sessão nativa do Engage é cookie httpOnly do
 * backend próprio (Express/Railway) — não existe token acessível ao JS. O
 * Bearer vem exclusivamente do cookie SSO `vyd-id-auth` de `.vydhub.com`,
 * que engage.vydhub.com enxerga; `getSession()` renova pelo refresh token.
 *
 * ⚠️ CONFIG EXPLÍCITA POR PARÂMETRO: o resolveVydConfig do pacote lê env por
 * acesso dinâmico, que nenhum bundler inlina — receberia {} e falharia em
 * SILÊNCIO (o catch abaixo devolve null e "Meus chamados" ficaria vazio sem
 * erro). Constantes estáticas, sempre.
 *
 * ⚠️ CRIAÇÃO SOB DEMANDA + SÓ NA ÁREA LOGADA: o createVydIdClient força
 * `detectSessionInUrl: true`; numa rota pública com fragmento (/sso com
 * #vyd_token=…) ele engoliria o token DO ENGAGE. O widget só monta no
 * AppShell (área /app/*, atrás de RequireAuth), o que garante isso por
 * estrutura. Não importar/criar este client em rota pública.
 */
import { createVydIdClient } from '@vydhub/id';
import type { SupabaseClient } from '@supabase/supabase-js';

const VYD_CONFIG = {
  idUrl: import.meta.env.VITE_VYD_ID_URL as string,
  idAnonKey: import.meta.env.VITE_VYD_ID_ANON_KEY as string,
  portalUrl: import.meta.env.VITE_VYD_PORTAL_URL as string,
  appCode: 'engage',
  cookieDomain: (import.meta.env.VITE_VYD_COOKIE_DOMAIN as string) ?? '',
};

let client: SupabaseClient | null = null;
let resolved = false;

/** Client do IdP, memoizado (inclusive o resultado negativo). */
function getIdClient(): SupabaseClient | null {
  if (resolved) return client;
  resolved = true;
  try {
    client = createVydIdClient(VYD_CONFIG);
  } catch {
    // VYD ID não configurado neste ambiente — degrada silenciosamente.
    client = null;
  }
  return client;
}

/**
 * Bearer do VYD ID para a Central. `null` = usuário sem sessão no portal —
 * no transporte por token isso indisponibiliza o widget para ele (mensagem
 * do SDK), sem quebrar o app.
 */
export async function getVydToken(): Promise<string | null> {
  const c = getIdClient();
  if (!c) return null;
  try {
    const { data } = await c.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
