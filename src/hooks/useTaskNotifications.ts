import { useEffect } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { useTasks } from './useTasks';

export function useTaskNotifications() {
  const { addNotification, notifications } = useNotifications();
  const { tasks } = useTasks();

  useEffect(() => {
    const checkTasks = () => {
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const overdue = tasks.filter((task) => {
        if (task.status === 'COMPLETED' || !task.dueDate) return false;
        return new Date(task.dueDate) < now;
      });

      const todayTasks = tasks.filter((task) => {
        if (task.status === 'COMPLETED' || !task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return dueDate >= today && dueDate < tomorrow;
      });

      // Verificar tarefas vencidas que ainda não foram notificadas
      overdue.forEach((task: { id: string; title: string; status: string; dueDate?: string }) => {
        const alreadyNotified = notifications.some(
          (n) =>
            n.type === 'task_overdue' &&
            n.metadata?.taskId === task.id &&
            new Date(n.timestamp).toDateString() === new Date().toDateString()
        );

        if (!alreadyNotified) {
          addNotification({
            type: 'task_overdue',
            title: 'Tarefa Vencida',
            message: `A tarefa "${task.title}" está vencida`,
            link: `/app/tasks`,
            metadata: { taskId: task.id },
          });
        }
      });

      // Verificar tarefas que vencem hoje
      todayTasks.forEach(
        (task: { id: string; title: string; status: string; dueDate?: string }) => {
          const alreadyNotified = notifications.some(
            (n) =>
              n.type === 'task_due' &&
              n.metadata?.taskId === task.id &&
              new Date(n.timestamp).toDateString() === new Date().toDateString()
          );

          if (!alreadyNotified) {
            addNotification({
              type: 'task_due',
              title: 'Tarefa Vence Hoje',
              message: `A tarefa "${task.title}" vence hoje`,
              link: `/app/tasks`,
              metadata: { taskId: task.id },
            });
          }
        }
      );
    };

    // Verificar imediatamente
    checkTasks();

    // Verificar a cada hora
    const interval = setInterval(checkTasks, 3600000);

    return () => clearInterval(interval);
  }, [addNotification, notifications, tasks]);
}
