import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let sharedSocket: Socket | null = null;
let refCount = 0;

function getOrCreateSocket(): Socket {
  if (!sharedSocket || sharedSocket.disconnected) {
    sharedSocket = io(SOCKET_URL, {
      withCredentials: true, // Send cookies for auth
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  }
  return sharedSocket;
}

/**
 * Hook to connect to the WebSocket server and listen for events.
 * Uses a shared socket instance across the app. Auth via httpOnly cookie.
 */
export function useSocket(enabled: boolean = true) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const socket = getOrCreateSocket();
    socketRef.current = socket;
    refCount++;

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      refCount--;
      if (refCount <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        refCount = 0;
      }
    };
  }, [enabled]);

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, []);

  return { socket: socketRef.current, on };
}
