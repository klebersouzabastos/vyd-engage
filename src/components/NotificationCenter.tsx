import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { Button } from "./ui/button";
import { useNotifications } from "../contexts/NotificationContext";
import { NotificationItem } from "./NotificationItem";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import { Link } from "react-router";

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    refreshNotifications,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  // Agrupar notificações por data
  const groupedNotifications = notifications.reduce((groups, notification) => {
    const date = new Date(notification.timestamp);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    let groupKey: string;
    if (date >= today) {
      groupKey = "Hoje";
    } else if (date >= yesterday) {
      groupKey = "Ontem";
    } else if (date >= thisWeek) {
      groupKey = "Esta Semana";
    } else {
      groupKey = date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(notification);
    return groups;
  }, {} as Record<string, typeof notifications>);

  useEffect(() => {
    if (isOpen) {
      refreshNotifications();
    }
  }, [isOpen, refreshNotifications]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Bell size={20} className="text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full min-w-[18px] text-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b border-gray-300">
          <h3 className="font-semibold text-gray-900">Notificações</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-300">
              {Object.entries(groupedNotifications).map(([groupKey, groupNotifications]) => (
                <div key={groupKey}>
                  <div className="px-4 py-2 bg-gray-100 border-b border-gray-300">
                    <p className="text-xs font-medium text-gray-600">{groupKey}</p>
                  </div>
                  <div className="divide-y divide-gray-300">
                    {groupNotifications.map((notification) => (
                      <NotificationItem key={notification.id} notification={notification} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-3 border-t border-gray-300">
            <Link to="/app/tasks">
              <Button variant="outline" className="w-full" onClick={() => setIsOpen(false)}>
                Ver todas as tarefas
              </Button>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}








