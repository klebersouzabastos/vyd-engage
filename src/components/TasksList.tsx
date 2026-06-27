import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Task } from '../types';
import { TaskCard } from './TaskCard';
import { Button } from './ui/button';
import { Plus } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useTasks } from '../hooks/useTasks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface TasksListProps {
  leadId: number | string;
  onTaskUpdate?: () => void;
}

export function TasksList({ leadId, onTaskUpdate }: TasksListProps) {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const { tasks: allTasks, completeTask, uncompleteTask, deleteTask, refetch } = useTasks();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [deletingTask, setDeletingTask] = useState<Task | undefined>();

  // Filtrar tarefas do lead específico
  const tasks = allTasks.filter((task) => {
    if (!task.leadId) return false;
    return String(task.leadId) === String(leadId);
  });

  useEffect(() => {
    refetch();
  }, [leadId]);

  const filteredTasks = tasks.filter((task) => {
    if (filter === 'pending') return task.status !== 'COMPLETED';
    if (filter === 'completed') return task.status === 'COMPLETED';
    return true;
  });

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Tarefas vencidas primeiro
    const aOverdue = a.status !== 'COMPLETED' && a.dueDate && new Date(a.dueDate) < new Date();
    const bOverdue = b.status !== 'COMPLETED' && b.dueDate && new Date(b.dueDate) < new Date();
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    // Por data de vencimento
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const handleToggle = async (task: Task) => {
    try {
      if (task.status === 'COMPLETED') {
        await uncompleteTask(task.id);
      } else {
        await completeTask(task.id);
      }
      await refetch();
      onTaskUpdate?.();
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
    }
  };

  const handleEdit = (task: Task) => {
    navigate(`/app/tasks/${task.id}/edit`);
  };

  const handleDelete = async () => {
    if (!deletingTask) return;
    try {
      await deleteTask(deletingTask.id);
      await refetch();
      onTaskUpdate?.();
      setDeletingTask(undefined);
    } catch (error) {
      console.error('Erro ao deletar tarefa:', error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Todas ({tasks.length})
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
          >
            Pendentes ({tasks.filter((t) => t.status !== 'COMPLETED').length})
          </Button>
          <Button
            variant={filter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('completed')}
          >
            Concluídas ({tasks.filter((t) => t.status === 'COMPLETED').length})
          </Button>
        </div>
        <Button
          onClick={() => navigate(`/app/tasks/new?leadId=${leadId}`)}
          size="sm"
          className="bg-primary hover:bg-primary-dark"
        >
          <Plus size={16} className="mr-2" />
          Nova Tarefa
        </Button>
      </div>

      {sortedTasks.length === 0 ? (
        <div className="text-center py-12 border border-gray-300 rounded-lg bg-gray-100">
          <p className="text-gray-600">
            {filter === 'completed'
              ? 'Nenhuma tarefa concluída'
              : filter === 'pending'
                ? 'Nenhuma tarefa pendente'
                : 'Nenhuma tarefa criada'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={() => handleToggle(task)}
              onEdit={() => handleEdit(task)}
              onDelete={() => setDeletingTask(task)}
            />
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar a tarefa "{deletingTask?.title}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
