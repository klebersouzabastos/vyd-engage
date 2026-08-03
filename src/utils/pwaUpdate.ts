import { registerSW } from 'virtual:pwa-register';

/**
 * Registro do Service Worker do PWA com auto-atualização.
 *
 * O bug que isto resolve (NÃO PODE VOLTAR): depois de um deploy, uma aba já
 * aberta não descobre sozinha que existe versão nova — ela segue servida pelo
 * cache do Service Worker antigo até ser fechada e reaberta. Foi o que prendeu
 * o app num bundle pré-correção (a aba Contatos não renderizava). O navegador
 * só reavalia o SW em fetch de NAVEGAÇÃO, e numa SPA trocar de rota pelo
 * History API não conta; como o precache do Workbox cobre todos os .js, a aba
 * antiga é servida inteira pelo cache e nunca toma um 404 que denuncie o
 * deploy. Ou seja: tem que existir um caminho ATIVO de descoberta. Não remova
 * a checagem — só a cadência dela é negociável.
 *
 * Por que a cadência mudou (03/08/2026): a versão anterior checava a cada 60s
 * MAIS em 'focus' MAIS em 'visibilitychange', sem nenhum guard — e esses dois
 * disparam juntos no mesmo retorno à aba, então cada volta custava 2
 * requisições. Dava ~100 GET /sw.js por hora por aba, e toda checagem é rede
 * real: o registro usa o updateViaCache padrão ('imports'), que força cache
 * mode 'no-cache' no script, então o edge responde 304 mas a requisição
 * acontece. Mesma URL, período exato, sem interação humana e sem pausar com a
 * aba oculta: é a assinatura que o System Mitigations da Vercel trata como
 * robótica, e engage.vydhub.com passou a devolver desafio 403.
 *
 * Estratégia atual (registerType: 'prompt'): um único check() compartilhado
 * pelos três gatilhos, com throttle por lastCheckAt — é ele que faz 'focus' +
 * 'visibilitychange' custarem 1 requisição por retorno à aba, e não 2. Só vai
 * à rede com a aba visível e online; o timer é apenas o piso, para a aba que
 * ninguém desfoca. Quando a versão nova fica pronta, onNeedRefresh aplica
 * (skipWaiting) e a página recarrega sozinha.
 *
 * Volume: 2 req/h numa aba visível ociosa, 0 numa aba oculta, teto de 12/h para
 * quem alterna de aba sem parar — contra ~100/h antes. Preço: um deploy leva
 * até ~30min (60min no pior caso, quando o tick do timer cai dentro da janela
 * do throttle) para alcançar uma aba que ninguém toca, e ~5min para quem volta
 * à aba. F5 e aba nova continuam instantâneos.
 */

/** Piso de cadência: aba visível e ociosa checa ~2x por hora. */
const CHECK_INTERVAL_MS = 30 * 60_000;

/**
 * Intervalo mínimo entre duas checagens, seja qual for o gatilho. É o que
 * deduplica 'focus' + 'visibilitychange' e limita o pior caso a 12 req/h/aba.
 * DEVE ficar bem abaixo de CHECK_INTERVAL_MS: se chegar perto, o tick do timer
 * passa a ser engolido pelo próprio throttle e a checagem periódica some em
 * silêncio.
 */
const MIN_CHECK_GAP_MS = 5 * 60_000;

export function registerPWAUpdates(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Nova versão disponível → aplica (skipWaiting). O reload em si vem do
      // listener de 'controlling' que o vite-plugin-pwa registra logo antes de
      // chamar este callback — por isso não troque para `onNeedReload`, que
      // substituiria justamente esse reload automático.
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      // O register() acima já rodou o algoritmo de Update; o relógio começa
      // agora para o primeiro foco não gastar uma segunda requisição.
      let lastCheckAt = Date.now();

      const check = () => {
        if (
          document.visibilityState !== 'visible' || // aba oculta: nada a mostrar
          !navigator.onLine || // offline: a requisição só falharia
          registration.installing || // update já baixando
          Date.now() - lastCheckAt < MIN_CHECK_GAP_MS
        ) {
          return;
        }

        // Avança o relógio ANTES de ir à rede e NÃO o rebobina no erro: se o
        // edge estiver em mitigation devolvendo 403, cada gatilho virar uma
        // nova tentativa seria recriar o padrão que causou o problema.
        lastCheckAt = Date.now();
        registration.update().catch(() => {});
      };

      setInterval(check, CHECK_INTERVAL_MS);
      // Os dois gatilhos disparam juntos ao voltar para a aba e o throttle
      // colapsa isso numa checagem só. 'focus' cobre o alt-tab em que a janela
      // nunca chega a ficar hidden; 'visibilitychange' cobre a janela
      // minimizada/ocluída, onde o tick do timer é ignorado.
      document.addEventListener('visibilitychange', check);
      window.addEventListener('focus', check);
    },
  });
}
