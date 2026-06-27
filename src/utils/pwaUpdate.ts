import { registerSW } from 'virtual:pwa-register';

/**
 * Registro do Service Worker do PWA com auto-atualização robusta.
 *
 * Problema que isto resolve: com o registro padrão, uma aba já aberta NÃO
 * re-checa se há uma versão nova depois de um deploy — ela fica servindo o
 * bundle antigo do cache do Service Worker até ser fechada/reaberta. Foi o que
 * prendeu o app num bundle pré-correção (a aba Contatos não renderizava).
 *
 * Estratégia (registerType: 'prompt'):
 *  - checa atualização periodicamente e ao focar/revisitar a aba;
 *  - quando uma versão nova fica pronta, aplica (skipWaiting) e recarrega
 *    automaticamente — sem o usuário precisar limpar cache.
 */
const UPDATE_INTERVAL_MS = 60_000;

export function registerPWAUpdates(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Nova versão disponível → aplica e recarrega a página automaticamente.
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const check = () => {
        // Offline / falha de rede: ignora e tenta de novo no próximo ciclo.
        registration.update().catch(() => {});
      };
      setInterval(check, UPDATE_INTERVAL_MS);
      window.addEventListener('focus', check);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });
}
