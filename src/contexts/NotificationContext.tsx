import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { Notification, NotificationType } from "../types";
import { apiClient } from "../services/api/client";
import { formatNotificationTime } from "../utils/notifications";
import { useAuth } from "./AuthContext";
import { useSocket } from "../hooks/useSocket";

/**
 * Maps backend UPPER_SNAKE notification types to frontend lowercase types.
 * Backend sends: TASK_DUE, TASK_OVERDUE, LEAD_ASSIGNED, AUTOMATION_ERROR, etc.
 * Frontend uses: task_due, task_overdue, lead_assigned, automation_error, etc.
 */
const BACKEND_TYPE_MAP: Record<string, NotificationType> = {
  TASK_DUE: "task_due",
  TASK_OVERDUE: "task_overdue",
  LEAD_ASSIGNED: "lead_assigned",
  AUTOMATION_ERROR: "automation_error",
  PAYMENT_FAILED: "payment_failed",
  SUBSCRIPTION_EXPIRING: "subscription_expiring",
  SYSTEM: "system",
};

function normalizeNotificationType(backendType: string): NotificationType {
  return BACKEND_TYPE_MAP[backendType] || (backendType?.toLowerCase() as NotificationType) || "system";
}

interface RawNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  status?: string;
  read?: boolean;
  link?: string;
  createdAt?: string;
  timestamp?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

function mapBackendNotification(raw: RawNotification): Notification {
  return {
    id: raw.id,
    type: normalizeNotificationType(raw.type),
    title: raw.title,
    message: raw.message,
    read: raw.status === "READ" || raw.read === true,
    link: raw.link || undefined,
    timestamp: raw.createdAt || raw.timestamp || new Date().toISOString(),
    metadata: raw.metadata,
  };
}

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
      const raw = notifResult?.notifications || notifResult || [];
      const notifs = raw.map(mapBackendNotification);
      setNotifications(notifs);
      setUnreadCount(countResult?.count ?? notifs.filter((n) => !n.read).length);
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
    const cleanup = on('notification:new', (data: unknown) => {
      const notif = mapBackendNotification({ ...(data as RawNotification), read: false });
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




