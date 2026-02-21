import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { TaskCard } from "../components/TaskCard";
import { Calendar } from "../components/ui/calendar";
import { PageSkeleton } from "../components/PageSkeleton";
import { useTasks } from "../hooks/useTasks";
import { Task } from "../types";
import { Plus, Filter, Calendar as CalendarIcon, AlertCircle, List, Grid } from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

export function Tasks() {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const { tasks, loading, createTask, updateTask, deleteTask, completeTask, uncompleteTask, refetch } = useTasks();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [filter, setFilter] = useState<
    "all" | "overdue" | "today" | "pending" | "completed"
  >("all");
  const [priorityFilter, setPriorityFilter] = useState<
    "all" | "high" | "medium" | "low"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingTask, setDeletingTask] = useState<Task | undefined>();
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Helper functions for filtering
  const getTasksDueToday = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tasks.filter((task) => {
      if (task.status === 'COMPLETED' || !task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      return dueDate >= today && dueDate < tomorrow;
    });
  }, [tasks]);

  const getOverdueTasks = useCallback(() => {
    const now = new Date();
    return tasks.filter(
      (task) => task.status !== 'COMPLETED' && task.dueDate && new Date(task.dueDate) < now
    );
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
    // Filtro por status
    if (filter === "overdue") {
        const isOverdue = task.status !== 'COMPLETED' && task.dueDate && new Date(task.dueDate) < new Date();
      if (!isOverdue) return false;
    } else if (filter === "today") {
      const today = getTasksDueToday();
      if (!today.find((t) => t.id === task.id)) return false;
    } else if (filter === "pending" && task.status === 'COMPLETED') return false;
    else if (filter === "completed" && task.status !== 'COMPLETED') return false;

    // Filtro por prioridade
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;

    // Busca
    if (
      searchQuery &&
      !task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !task.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    return true;
  });
  }, [tasks, filter, priorityFilter, searchQuery, getTasksDueToday]);

  const groupedTasks = useMemo(() => {
    const overdue = getOverdueTasks();
      const today = getTasksDueToday();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
    
    return {
      overdue: filteredTasks.filter(
        (t) => t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < new Date()
      ),
      today: filteredTasks.filter((t) => today.find((task) => task.id === t.id) !== undefined),
      upcoming: filteredTasks.filter((t) => {
        if (t.status === 'COMPLETED' || !t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
      return dueDate >= tomorrow;
    }),
    completed: filteredTasks.filter((t) => t.status === 'COMPLETED'),
  };
  }, [filteredTasks, getOverdueTasks, getTasksDueToday]);

  const handleToggle = async (task: Task) => {
    try {
    if (task.status === 'COMPLETED') {
        await uncompleteTask(task.id);
    } else {
        await completeTask(task.id);
    }
      await refetch();
    } catch (error) {
      // Error already handled by hook
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
    setDeletingTask(undefined);
    } catch (error) {
      // Error already handled by hook
    }
  };

  const handleSelectTask = (taskId: string, selected: boolean) => {
    setSelectedTasks((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(taskId);
      } else {
        newSet.delete(taskId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const pendingTasks = filteredTasks.filter((t) => t.status !== 'COMPLETED');
    const allSelected = pendingTasks.every((t) => selectedTasks.has(t.id));
    
    if (allSelected) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(pendingTasks.map((t) => t.id)));
    }
  };

  const handleCompleteSelected = async () => {
    try {
      await Promise.all(Array.from(selectedTasks).map(taskId => completeTask(taskId)));
    setSelectedTasks(new Set());
    setIsSelectMode(false);
      await refetch();
    } catch (error) {
      // Error already handled by hook
    }
  };

  const handleUncompleteSelected = async () => {
    try {
      await Promise.all(Array.from(selectedTasks).map(taskId => uncompleteTask(taskId)));
    setSelectedTasks(new Set());
    setIsSelectMode(false);
      await refetch();
    } catch (error) {
      // Error already handled by hook
    }
  };

  // Agrupar tarefas por data para o calendário (incluindo concluídas)
  const tasksByDate = useMemo(() => {
    return filteredTasks.reduce((acc, task) => {
      if (!task.dueDate) return acc;
      try {
    const date = new Date(task.dueDate);
        if (isNaN(date.getTime())) return acc;
    const dateKey = date.toISOString().split("T")[0];
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(task);
      } catch (error) {
        // Skip invalid dates
      }
    return acc;
  }, {} as Record<string, Task[]>);
  }, [filteredTasks]);

  // Obter tarefas do dia selecionado
  const selectedDateTasks = selectedDate
    ? tasksByDate[selectedDate.toISOString().split("T")[0]] || []
    : [];

  // Obter datas com tarefas para marcar no calendário
  const datesWithTasks = Object.keys(tasksByDate).map((dateStr) => new Date(dateStr));


  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Tarefas" subtitle="Gerencie todas as suas tarefas e lembretes" />
        <PageSkeleton type="cards" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Tarefas" subtitle="Gerencie todas as suas tarefas e lembretes" />

      <div className="p-8 overflow-visible">
        {/* Filters */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-300 mb-6 overflow-visible relative z-10">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar tarefas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
                className="whitespace-nowrap"
              >
                Todas
              </Button>
              <Button
                variant={filter === "overdue" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("overdue")}
                className={`whitespace-nowrap ${filter === "overdue" ? "bg-red-600 hover:bg-red-700" : ""}`}
              >
                <AlertCircle size={14} className="mr-1" />
                Vencidas ({getOverdueTasks().length})
              </Button>
              <Button
                variant={filter === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("today")}
                className="whitespace-nowrap"
              >
                <CalendarIcon size={14} className="mr-1" />
                Hoje ({getTasksDueToday().length})
              </Button>
              <Button
                variant={filter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("pending")}
                className="whitespace-nowrap"
              >
                Pendentes
              </Button>
              <Button
                variant={filter === "completed" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("completed")}
                className="whitespace-nowrap"
              >
                Concluídas
              </Button>
            </div>

            <select
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(e.target.value as typeof priorityFilter)
              }
              className="px-3 py-2 border border-gray-300 rounded-md bg-white whitespace-nowrap"
            >
              <option value="all">Todas as prioridades</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>

            <div className="flex gap-2">
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="whitespace-nowrap"
              >
                <List size={14} className="mr-1" />
                Lista
              </Button>
              <Button
                variant={viewMode === "calendar" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("calendar")}
                className="whitespace-nowrap"
              >
                <Grid size={14} className="mr-1" />
                Calendário
              </Button>
              {isSelectMode && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="whitespace-nowrap"
                  >
                    Selecionar Todas
                  </Button>
                  {selectedTasks.size > 0 && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleCompleteSelected}
                        className="whitespace-nowrap bg-green-600 hover:bg-green-700"
                      >
                        Concluir ({selectedTasks.size})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTasks(new Set());
                          setIsSelectMode(false);
                        }}
                        className="whitespace-nowrap"
                      >
                        Cancelar
                      </Button>
                    </>
                  )}
                </>
              )}
              {!isSelectMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSelectMode(true)}
                  className="whitespace-nowrap"
                >
                  Selecionar
                </Button>
              )}
            </div>

            <Button
              onClick={() => navigate("/app/tasks/new")}
              className="bg-primary hover:bg-primary-dark whitespace-nowrap"
            >
              <Plus size={16} className="mr-2" />
              Nova Tarefa
            </Button>
          </div>
        </div>

        {/* Tasks View */}
        {viewMode === "list" ? (
          <div className="space-y-6">
            {groupedTasks.overdue.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
                  <AlertCircle size={20} />
                  Tarefas Vencidas ({groupedTasks.overdue.length})
                </h3>
                <div className="space-y-3">
                  {groupedTasks.overdue.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggle(task)}
                      onEdit={() => handleEdit(task)}
                      onDelete={() => setDeletingTask(task)}
                      selected={selectedTasks.has(task.id)}
                      onSelect={(selected) => handleSelectTask(task.id, selected)}
                      showCheckbox={isSelectMode}
                    />
                  ))}
                </div>
              </div>
            )}

            {groupedTasks.today.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <CalendarIcon size={20} />
                  Vencem Hoje ({groupedTasks.today.length})
                </h3>
                <div className="space-y-3">
                  {groupedTasks.today.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggle(task)}
                      onEdit={() => handleEdit(task)}
                      onDelete={() => setDeletingTask(task)}
                      selected={selectedTasks.has(task.id)}
                      onSelect={(selected) => handleSelectTask(task.id, selected)}
                      showCheckbox={isSelectMode}
                    />
                  ))}
                </div>
              </div>
            )}

            {groupedTasks.upcoming.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Próximas ({groupedTasks.upcoming.length})
                </h3>
                <div className="space-y-3">
                  {groupedTasks.upcoming.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggle(task)}
                      onEdit={() => handleEdit(task)}
                      onDelete={() => setDeletingTask(task)}
                      selected={selectedTasks.has(task.id)}
                      onSelect={(selected) => handleSelectTask(task.id, selected)}
                      showCheckbox={isSelectMode}
                    />
                  ))}
                </div>
              </div>
            )}

            {groupedTasks.completed.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Concluídas ({groupedTasks.completed.length})
                </h3>
                <div className="space-y-3">
                  {groupedTasks.completed.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggle(task)}
                      onEdit={() => handleEdit(task)}
                      onDelete={() => setDeletingTask(task)}
                      selected={selectedTasks.has(task.id)}
                      onSelect={(selected) => handleSelectTask(task.id, selected)}
                      showCheckbox={isSelectMode}
                    />
                  ))}
                </div>
              </div>
            )}

            {filteredTasks.length === 0 && (
              <div className="text-center py-12 border border-gray-300 rounded-lg bg-gray-100">
                <p className="text-gray-600">Nenhuma tarefa encontrada</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white rounded-lg p-8 shadow-sm border border-gray-300">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="w-full"
                modifiers={{
                  hasTasks: datesWithTasks,
                }}
                modifiersClassNames={{
                  hasTasks: "bg-blue-100 text-blue-700 font-semibold",
                }}
                classNames={{
                  months: "flex flex-col sm:flex-row gap-6",
                  month: "flex flex-col gap-6 w-full",
                  caption: "flex justify-center pt-2 relative items-center w-full mb-4",
                  caption_label: "text-xl font-semibold",
                  nav: "flex items-center gap-2",
                  nav_button: "h-8 w-8",
                  table: "w-full border-collapse",
                  head_row: "flex mb-2",
                  head_cell: "text-muted-foreground rounded-md flex-1 font-semibold text-sm py-2",
                  row: "flex w-full mt-1",
                  cell: "relative flex-1 p-1 text-center focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent",
                  day: "h-16 w-full p-2 font-normal aria-selected:opacity-100 text-base rounded-md flex items-center justify-center",
                }}
              />
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {selectedDate
                  ? `Tarefas para ${selectedDate.toLocaleDateString("pt-BR", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}`
                  : "Selecione uma data"}
              </h3>
              {selectedDateTasks.length > 0 ? (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {selectedDateTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggle(task)}
                      onEdit={() => handleEdit(task)}
                      onDelete={() => setDeletingTask(task)}
                      selected={selectedTasks.has(task.id)}
                      onSelect={(selected) => handleSelectTask(task.id, selected)}
                      showCheckbox={isSelectMode}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 border border-gray-300 rounded-lg bg-gray-100">
                  <p className="text-gray-600">
                    {selectedDate
                      ? "Nenhuma tarefa para esta data"
                      : "Selecione uma data no calendário para ver as tarefas"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

