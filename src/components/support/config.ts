/*
 * Config da Central de Suporte VYD (@vydhub/support) no Engage.
 *
 * ⚠️ LEITURAS ESTÁTICAS E LITERAIS: o Vite só inlina o padrão exato
 * `import.meta.env.VITE_FOO`. Leitura dinâmica dentro do SDK recebe {} —
 * classe de bug que já derrubou a área logada do Finance em produção. Por
 * isso a config vai POR PROP ao provider, e o guard `isSupportConfigured`
 * deriva DA MESMA constante passada a ele (não podem divergir).
 */

/** Código deste app no registry do VYD ID (origem dos chamados na Central). */
export const APP_CODE = 'engage';

/** URL do Supabase do motor da Central (vyd-desk). */
export const SUPPORT_URL = import.meta.env.VITE_VYD_SUPPORT_URL as string | undefined;

/** Portal do VYD ID (deep-links "ver na Central"). */
export const PORTAL_URL = import.meta.env.VITE_VYD_PORTAL_URL as string | undefined;

/** true quando a Central está configurada neste ambiente (build time). */
export const isSupportConfigured = Boolean(SUPPORT_URL);
