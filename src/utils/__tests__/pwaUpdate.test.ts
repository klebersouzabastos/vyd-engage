import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 'virtual:pwa-register' é um módulo virtual do vite-plugin-pwa. Sob vitest o
// plugin roda em modo serve e serve o stub no-op de dev — que nunca chama
// onRegisteredSW. Sem este mock o teste passaria verde sem exercitar nada.
const { registerSW, updateSW } = vi.hoisted(() => {
  const updateSW = vi.fn();
  return { registerSW: vi.fn(() => updateSW), updateSW };
});
vi.mock('virtual:pwa-register', () => ({ registerSW }));

import { registerPWAUpdates } from '../pwaUpdate';

const CINCO_MIN = 5 * 60_000;
const TRINTA_MIN = 30 * 60_000;

/** Sobrescreve um getter nativo (jsdom não deixa atribuir direto). */
const forjar = (alvo: object, prop: string, valor: unknown) =>
  Object.defineProperty(alvo, prop, { configurable: true, get: () => valor });

/**
 * Registra o SW e devolve o `registration` falso, já com o update espionado.
 * O código real só monta os gatilhos dentro de onRegisteredSW.
 */
function registrar() {
  registerPWAUpdates();
  const opcoes = registerSW.mock.calls.at(-1)?.[0] as {
    onRegisteredSW: (url: string, reg: unknown) => void;
    onNeedRefresh: () => void;
  };
  const registration = {
    update: vi.fn().mockResolvedValue(undefined),
    installing: null as unknown,
  };
  opcoes.onRegisteredSW('/sw.js', registration);
  return { opcoes, registration };
}

const voltarParaAba = () => {
  window.dispatchEvent(new Event('focus'));
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('registerPWAUpdates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    registerSW.mockClear();
    updateSW.mockClear();
    // jsdom não implementa serviceWorker; sem isto a função sai na guarda.
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {} });
    forjar(document, 'visibilityState', 'visible');
    forjar(navigator, 'onLine', true);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('colapsa focus + visibilitychange numa única checagem', () => {
    // Este é o coração da correção: os dois eventos disparam juntos no mesmo
    // alt-tab e antes custavam 2 requisições a /sw.js.
    const { registration } = registrar();

    vi.advanceTimersByTime(CINCO_MIN);
    voltarParaAba();

    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('não checa duas vezes dentro da janela mínima', () => {
    const { registration } = registrar();

    vi.advanceTimersByTime(CINCO_MIN);
    voltarParaAba();
    vi.advanceTimersByTime(CINCO_MIN - 1);
    voltarParaAba();

    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('não vai à rede com a aba oculta', () => {
    const { registration } = registrar();
    forjar(document, 'visibilityState', 'hidden');

    vi.advanceTimersByTime(TRINTA_MIN * 4);
    voltarParaAba();

    expect(registration.update).not.toHaveBeenCalled();
  });

  it('não vai à rede offline', () => {
    const { registration } = registrar();
    forjar(navigator, 'onLine', false);

    vi.advanceTimersByTime(TRINTA_MIN * 4);
    voltarParaAba();

    expect(registration.update).not.toHaveBeenCalled();
  });

  it('mantém a descoberta periódica de deploy numa aba que ninguém toca', () => {
    // O bug original (aba presa em bundle antigo) volta se isto parar.
    const { registration } = registrar();

    vi.advanceTimersByTime(TRINTA_MIN + 1);

    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('gasta no máximo 12 checagens por hora, mesmo sob alt-tab contínuo', () => {
    // Guarda de volume: a versão anterior fazia ~100/h por aba e foi o que
    // atraiu o System Mitigations da Vercel. Se alguém reduzir as constantes,
    // este teste cai.
    const { registration } = registrar();

    for (let minuto = 0; minuto < 60; minuto++) {
      vi.advanceTimersByTime(60_000);
      voltarParaAba();
    }

    expect(registration.update.mock.calls.length).toBeLessThanOrEqual(12);
  });

  it('aplica a nova versão quando ela fica pronta', () => {
    // Invariante do auto-update: onNeedRefresh tem que disparar o skipWaiting,
    // senão a aba nunca sai do bundle antigo.
    const { opcoes } = registrar();

    opcoes.onNeedRefresh();

    expect(updateSW).toHaveBeenCalled();
  });
});
