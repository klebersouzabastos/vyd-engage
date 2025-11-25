import { Task } from "../types";

const STORAGE_KEY = "tasks";

export function getAllTasks(): Task[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Erro ao buscar tarefas:", error);
    return [];
  }
}

export function getTaskById(taskId: string): Task | undefined {
  const allTasks = getAllTasks();
  return allTasks.find((task) => task.id === taskId);
}

export function getLeadTasks(leadId: number): Task[] {
  const allTasks = getAllTasks();
  return allTasks.filter((task) => task.leadId === leadId);
}

export function getTasksByStatus(completed: boolean): Task[] {
  const allTasks = getAllTasks();
  return allTasks.filter((task) => task.completed === completed);
}

export function getOverdueTasks(): Task[] {
  const allTasks = getAllTasks();
  const now = new Date();
  return allTasks.filter(
    (task) => !task.completed && new Date(task.dueDate) < now
  );
}

export function getTasksDueToday(): Task[] {
  const allTasks = getAllTasks();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return allTasks.filter((task) => {
    if (task.completed) return false;
    const dueDate = new Date(task.dueDate);
    return dueDate >= today && dueDate < tomorrow;
  });
}

export function createTask(task: Omit<Task, "id" | "createdAt">): Task {
  const allTasks = getAllTasks();
  
  const newTask: Task = {
    ...task,
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    completed: false,
  };

  allTasks.push(newTask);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allTasks));
  
  return newTask;
}

export function updateTask(taskId: string, updates: Partial<Task>): Task {
  const allTasks = getAllTasks();
  const index = allTasks.findIndex((task) => task.id === taskId);

  if (index === -1) {
    throw new Error("Tarefa não encontrada");
  }

  const updatedTask = {
    ...allTasks[index],
    ...updates,
    ...(updates.completed && !allTasks[index].completed
      ? { completedAt: new Date().toISOString() }
      : {}),
    ...(updates.completed === false ? { completedAt: undefined } : {}),
  };

  allTasks[index] = updatedTask;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allTasks));
  
  return updatedTask;
}

export function deleteTask(taskId: string): void {
  const allTasks = getAllTasks();
  const filtered = allTasks.filter((task) => task.id !== taskId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function completeTask(taskId: string): Task {
  return updateTask(taskId, { completed: true });
}

export function uncompleteTask(taskId: string): Task {
  return updateTask(taskId, { completed: false });
}

