import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { Notification } from "../types";
import {
  getAllNotifications,
  getUnreadCount,
  createNotification as createNotificationUtil,
  markAsRead as markAsReadUtil,
  markAllAsRead as markAllAsReadUtil,
  deleteNotification as deleteNotificationUtil,
  formatNotificationTime,
} from "../utils/notifications";

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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshNotifications = useCallback(() => {
    const all = getAllNotifications();
    setNotifications(all);
    setUnreadCount(getUnreadCount());
  }, []);

  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 60000);
    return () => clearInterval(interval);
  }, [refreshNotifications]);

  const addNotification = useCallback((
    notification: Omit<Notification, "id" | "timestamp" | "read">
  ) => {
    const newNotification = createNotificationUtil(notification);
    refreshNotifications();
    return newNotification;
  }, [refreshNotifications]);

  const markAsRead = useCallback((id: string) => {
    markAsReadUtil(id);
    refreshNotifications();
  }, [refreshNotifications]);

  const markAllAsRead = useCallback(() => {
    markAllAsReadUtil();
    refreshNotifications();
  }, [refreshNotifications]);

  const deleteNotification = useCallback((id: string) => {
    deleteNotificationUtil(id);
    refreshNotifications();
  }, [refreshNotifications]);

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




