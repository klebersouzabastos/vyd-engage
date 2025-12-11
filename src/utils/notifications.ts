import { Notification } from "../types";

const STORAGE_KEY = "notifications";
const MAX_NOTIFICATIONS = 1000;
const CLEANUP_DAYS = 30;

export function getAllNotifications(): Notification[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const notifications = stored ? JSON.parse(stored) : [];
    
    // Limpar notificações antigas
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_DAYS);
    
    const filtered = notifications.filter((n: Notification) => {
      const notificationDate = new Date(n.timestamp);
      return notificationDate >= cutoffDate;
    });

    // Se houve limpeza, salvar de volta
    if (filtered.length !== notifications.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }

    return filtered;
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
    return [];
  }
}

export function getUnreadNotifications(): Notification[] {
  return getAllNotifications().filter((n) => !n.read);
}

export function getUnreadCount(): number {
  return getUnreadNotifications().length;
}

export function createNotification(
  notification: Omit<Notification, "id" | "timestamp" | "read">
): Notification {
  const allNotifications = getAllNotifications();

  const newNotification: Notification = {
    ...notification,
    id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    read: false,
  };

  allNotifications.unshift(newNotification);

  // Manter apenas as últimas MAX_NOTIFICATIONS
  const limited = allNotifications.slice(0, MAX_NOTIFICATIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));

  return newNotification;
}

export function markAsRead(id: string): void {
  const allNotifications = getAllNotifications();
  const index = allNotifications.findIndex((n) => n.id === id);

  if (index !== -1) {
    allNotifications[index].read = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allNotifications));
  }
}

export function markAllAsRead(): void {
  const allNotifications = getAllNotifications();
  const updated = allNotifications.map((n) => ({ ...n, read: true }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function deleteNotification(id: string): void {
  const allNotifications = getAllNotifications();
  const filtered = allNotifications.filter((n) => n.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function deleteAllNotifications(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
}

export function formatNotificationTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "agora";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `há ${diffInMinutes} min`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `há ${diffInHours}h`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `há ${diffInDays}d`;
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}







