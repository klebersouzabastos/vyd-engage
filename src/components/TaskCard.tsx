import { Task } from "../types";
import { Checkbox } from "./ui/checkbox";
import { Edit2, Trash2, Calendar, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { formatRelativeTime } from "../utils/interactions";

interface TaskCardProps {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  showCheckbox?: boolean;
}

const getPriorityColor = (priority: Task["priority"]) => {
  switch (priority) {
    case "URGENT":
      return "bg-red-200 text-red-800 border-red-300";
    case "HIGH":
      return "bg-red-100 text-red-700 border-red-200";
    case "MEDIUM":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "LOW":
      return "bg-blue-100 text-blue-700 border-blue-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

const getPriorityLabel = (priority: Task["priority"]) => {
  switch (priority) {
    case "URGENT":
      return "Urgente";
    case "HIGH":
      return "Alta";
    case "MEDIUM":
      return "Média";
    case "LOW":
      return "Baixa";
    default:
      return priority;
  }
};

export function TaskCard({ 
  task, 
  onToggle, 
  onEdit, 
  onDelete, 
  selected = false,
  onSelect,
  showCheckbox = false
}: TaskCardProps) {
  const now = new Date();
  const isCompleted = task.status === 'COMPLETED';
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = !isCompleted && dueDate && dueDate < now;
  const isDueToday = !isCompleted && dueDate && dueDate.toDateString() === now.toDateString();

  return (
    <div
      className={`
        p-4 border rounded-lg transition-all
        ${selected ? "bg-blue-50 border-blue-300" : ""}
        ${isCompleted
          ? "bg-gray-100 border-gray-300 opacity-60"
          : isOverdue
          ? "bg-red-50 border-red-200"
          : isDueToday
          ? "bg-yellow-50 border-yellow-200"
          : "bg-white border-gray-300 hover:shadow-md"
        }
      `}
    >
      <div className="flex items-start gap-3">
        {showCheckbox && onSelect ? (
          <Checkbox
            checked={selected}
            onCheckedChange={onSelect}
            className="mt-1"
            onClick={(e) => e.stopPropagation()}
          />
        ) : null}
        <Checkbox
          checked={isCompleted}
          onCheckedChange={onToggle}
          className="mt-1"
        />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4
              className={`
                font-medium
                ${isCompleted
                  ? "text-gray-400 line-through"
                  : "text-gray-900"
                }
              `}
            >
              {task.title}
            </h4>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={onEdit}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                aria-label="Editar tarefa"
              >
                <Edit2 size={14} className="text-gray-600" />
              </button>
              <button
                onClick={onDelete}
                className="p-1 hover:bg-red-50 rounded transition-colors"
                aria-label="Deletar tarefa"
              >
                <Trash2 size={14} className="text-red-600" />
              </button>
            </div>
          </div>

          {task.description && (
            <p
              className={`
                text-sm mb-2
                ${isCompleted
                  ? "text-gray-400"
                  : "text-gray-600"
                }
              `}
            >
              {task.description}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Calendar
                size={14}
                className={
                  isOverdue
                    ? "text-red-600"
                    : isDueToday
                    ? "text-yellow-600"
                    : "text-gray-600"
                }
              />
              <span
                className={`
                  text-xs
                  ${isOverdue
                    ? "text-red-600 font-medium"
                    : isDueToday
                    ? "text-yellow-600 font-medium"
                    : "text-gray-600"
                  }
                `}
              >
                {isOverdue && dueDate ? (
                  <>
                    <AlertCircle size={12} className="inline mr-1" />
                    Vencida: {dueDate.toLocaleDateString("pt-BR")}
                  </>
                ) : isDueToday ? (
                  "Vence hoje"
                ) : dueDate ? (
                  `Vence em ${formatRelativeTime(task.dueDate!)}`
                ) : (
                  "Sem data de vencimento"
                )}
              </span>
            </div>

            <span
              className={`
                text-xs px-2 py-0.5 rounded border
                ${getPriorityColor(task.priority)}
              `}
            >
              {getPriorityLabel(task.priority)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

