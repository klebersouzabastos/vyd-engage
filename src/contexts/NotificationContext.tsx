import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { Notification } from "../types";
import { apiClient } from "../services/api/client";
import { formatNotificationTime } from "../utils/notifications";
import { useAuth } from "./AuthContext";
import { useSocket } from "../hooks/useSocket";

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => Notification;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  refreshNotifications: () => void;
  formatTime: (timestamp: string) => string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshNotifications = useCallback(async () => {
    try {
      const [notifResult, countResult] = await Promise.all([
        apiClient.getNotifications(),
        apiClient.getUnreadNotificationsCount(),
      ]);
      const notifs = notifResult?.notifications || notifResult || [];
      setNotifications(notifs);
      setUnreadCount(countResult?.count ?? notifs.filter((n: any) => !n.read).length);
    } catch (error) {
      // API pode não estar disponível, manter estado atual
      console.error("Erro ao carregar notificações:", error);
    }
  }, []);

  // WebSocket for real-time notifications
  const { on } = useSocket(!!user);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    refreshNotifications();
    // Fallback polling (longer interval since we have WebSocket)
    const interval = setInterval(refreshNotifications, 300000);
    return () => clearInterval(interval);
  }, [user, refreshNotifications]);

  // Listen for real-time notification events
  useEffect(() => {
    if (!user) return;
    const cleanup = on('notification:new', (data: any) => {
      const notif: Notification = {
        id: data.id,
        type: data.type?.toLowerCase() || 'system',
        title: data.title,
        message: data.message,
        read: false,
        link: data.link,
        timestamp: data.createdAt || new Date().toISOString(),
        metadata: data.metadata,
      };
      setNotifications(prev => [notif, ...prev]);
      setUnreadCount(prev => prev + 1);
    });
    return cleanup;
  }, [user, on]);

  // Notificações criadas pelo frontend ficam em memória (transientes)
  const addNotification = useCallback((
    notification: Omit<Notification, "id" | "timestamp" | "read">
  ) => {
    const newNotification: Notification = {
      ...notification,
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);
    return newNotification;
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      if (!id.startsWith("local_")) {
        await apiClient.markNotificationAsRead(id);
      }
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Erro ao marcar notificação como lida:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      if (!id.startsWith("local_")) {
        await apiClient.deleteNotification(id);
      }
      setNotifications(prev => {
        const removed = prev.find(n => n.id === id);
        if (removed && !removed.read) {
          setUnreadCount(c => Math.max(0, c - 1));
        }
        return prev.filter(n => n.id !== id);
      });
    } catch (error) {
      console.error("Erro ao deletar notificação:", error);
    }
  }, []);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
    formatTime: formatNotificationTime,
  }), [notifications, unreadCount, addNotification, markAsRead, markAllAsRead, deleteNotification, refreshNotifications]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}




