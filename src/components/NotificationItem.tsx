import { Notification } from "../types";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { Link } from "react-router";
import { useNotifications } from "../contexts/NotificationContext";

interface NotificationItemProps {
  notification: Notification;
}

const getNotificationIcon = (type: Notification["type"]) => {
  switch (type) {
    case "task_due":
    case "task_overdue":
      return "📅";
    case "new_lead":
      return "👤";
    case "interaction":
      return "💬";
    case "automation_failed":
      return "⚠️";
    default:
      return "🔔";
  }
};

export function NotificationItem({ notification }: NotificationItemProps) {
  const { markAsRead, deleteNotification, formatTime } = useNotifications();

  const handleClick = () => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNotification(notification.id);
  };

  const content = notification.link ? (
    <Link
      to={notification.link}
      onClick={handleClick}
      className="block flex-1"
    >
      <div
        className={`
          p-3 rounded-lg transition-colors
          ${notification.read
            ? "bg-white hover:bg-gray-100"
            : "bg-blue-50 hover:bg-blue-100"
          }
        `}
      >
        <div className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0">
            {getNotificationIcon(notification.type)}
          </span>
          <div className="flex-1 min-w-0">
            <p
              className={`
                text-sm font-medium mb-1
                ${notification.read ? "text-gray-600" : "text-gray-900"}
              `}
            >
              {notification.title}
            </p>
            <p className="text-xs text-gray-600 line-clamp-2">
              {notification.message}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {formatTime(notification.timestamp)}
            </p>
          </div>
          {!notification.read && (
            <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2" />
          )}
        </div>
      </div>
    </Link>
  ) : (
    <div
      onClick={handleClick}
      className={`
        p-3 rounded-lg transition-colors cursor-pointer
        ${notification.read
          ? "bg-white hover:bg-gray-100"
          : "bg-blue-50 hover:bg-blue-100"
        }
      `}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">
          {getNotificationIcon(notification.type)}
        </span>
        <div className="flex-1 min-w-0">
          <p
            className={`
              text-sm font-medium mb-1
              ${notification.read ? "text-gray-600" : "text-gray-900"}
            `}
          >
            {notification.title}
          </p>
          <p className="text-xs text-gray-600 line-clamp-2">
            {notification.message}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatTime(notification.timestamp)}
          </p>
        </div>
        {!notification.read && (
          <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2" />
        )}
      </div>
    </div>
  );

  return (
    <div className="relative group">
      {content}
      <button
        onClick={handleDelete}
        className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-50 rounded transition-all"
        aria-label="Fechar notificação"
      >
        <X size={14} className="text-red-600" />
      </button>
    </div>
  );
}








