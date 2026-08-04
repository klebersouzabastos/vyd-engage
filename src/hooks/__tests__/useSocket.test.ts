import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

/**
 * useSocket — uma conexão por aba, e reconexão limitada.
 *
 * O que esta suite existe para não deixar voltar: a versão anterior recriava o
 * socket sempre que `sharedSocket.disconnected` fosse true, e `disconnected` é
 * só `!connected` — ou seja, true durante TODA a conexão inicial. Como vários
 * consumidores montam no mesmo tick (NotificationContext, useLeads, useTasks,
 * AutomationLogs), isso abria de 2 a 4 sockets por aba e abandonava os
 * anteriores, ainda conectados.
 *
 * Somado à reconexão infinita dos defaults, foi o que transformou um
 * /socket.io que respondia HTML num loop de tráfego forte o bastante para a
 * Vercel passar a desafiar o domínio com 403.
 */

const { io, socketFalso } = vi.hoisted(() => {
  const socketFalso = {
    connected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
  const io = vi.fn((_url: string, _opcoes?: Record<string, unknown>) => socketFalso);
  return { io, socketFalso };
});
vi.mock('socket.io-client', () => ({ io, Socket: class {} }));

import { useSocket } from '../useSocket';

/** Opções passadas ao io() na última criação. */
const opcoes = (): Record<string, unknown> => io.mock.calls.at(-1)?.[1] ?? {};

describe('useSocket', () => {
  beforeEach(() => {
    io.mockClear();
    socketFalso.connected = false;
    socketFalso.connect.mockClear();
    socketFalso.disconnect.mockClear();
  });

  afterEach(() => {
    // Devolve o refCount do módulo a zero entre os testes.
    socketFalso.connected = false;
  });

  it('vários consumidores compartilham UMA conexão', () => {
    const a = renderHook(() => useSocket());
    const b = renderHook(() => useSocket());
    const c = renderHook(() => useSocket());

    expect(io).toHaveBeenCalledTimes(1);

    a.unmount();
    b.unmount();
    c.unmount();
  });

  it('não recria enquanto a conexão inicial ainda não completou', () => {
    // `connected` false é exatamente o estado em que a versão anterior recriava.
    socketFalso.connected = false;
    const a = renderHook(() => useSocket());
    const b = renderHook(() => useSocket());

    expect(io).toHaveBeenCalledTimes(1);

    a.unmount();
    b.unmount();
  });

  it('só desconecta quando o último consumidor sai', () => {
    const a = renderHook(() => useSocket());
    const b = renderHook(() => useSocket());

    a.unmount();
    expect(socketFalso.disconnect).not.toHaveBeenCalled();

    b.unmount();
    expect(socketFalso.disconnect).toHaveBeenCalledTimes(1);
  });

  it('conecta por polling primeiro', () => {
    // Ordem obrigatória: `tryAllTransports` não está nos defaults do
    // engine.io-client, então com websocket primeiro uma falha de websocket
    // nunca cairia para polling — só reconectaria em loop.
    const a = renderHook(() => useSocket());
    expect(opcoes().transports).toEqual(['polling', 'websocket']);
    a.unmount();
  });

  it('limita a reconexão — nada de tentar para sempre', () => {
    const a = renderHook(() => useSocket());
    const o = opcoes();
    expect(o.reconnectionAttempts).toBe(10);
    expect(o.reconnectionDelayMax).toBe(30000);
    a.unmount();
  });

  it('não conecta quando o hook está desabilitado', () => {
    const a = renderHook(() => useSocket(false));
    expect(io).not.toHaveBeenCalled();
    a.unmount();
  });
});
