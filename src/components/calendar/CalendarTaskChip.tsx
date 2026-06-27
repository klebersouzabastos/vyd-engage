import type { Task } from '../../types';
import { PRIORITY_COLORS, COMPLETED_CLASSES, PRIORITY_DOT_COLORS } from './calendarUtils';

interface CalendarTaskChipProps {
  task: Task;
  compact?: boolean;
  onClick?: (task: Task) => void;
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  draggable?: boolean;
}

export function CalendarTaskChip({
  task,
  compact = true,
  onClick,
  onDragStart,
  draggable = true,
}: CalendarTaskChipProps) {
  const isCompleted = task.status === 'COMPLETED';
  const colorClass = isCompleted
    ? COMPLETED_CLASSES
    : PRIORITY_COLORS[task.priority] || 'bg-gray-200 text-gray-700';

  if (compact) {
    return (
      <button
        className={`w-full text-left text-[11px] leading-tight px-1.5 py-0.5 rounded truncate cursor-pointer ${colorClass}`}
        title={task.title}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(task);
        }}
        draggable={draggable}
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStart?.(e, task);
        }}
      >
        {task.title}
      </button>
    );
  }

  return (
    <button
      className={`w-full text-left text-sm px-2 py-1.5 rounded cursor-pointer ${colorClass}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(task);
      }}
      draggable={draggable}
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart?.(e, task);
      }}
    >
      <div className="font-medium truncate">{task.title}</div>
      {task.dueDate && (
        <div className="text-[11px] opacity-80 mt-0.5">
          {new Date(task.dueDate).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}
    </button>
  );
}

export function CalendarTaskDot({ task }: { task: Task }) {
  const isCompleted = task.status === 'COMPLETED';
  const dotColor = isCompleted
    ? 'bg-gray-400'
    : PRIORITY_DOT_COLORS[task.priority] || 'bg-gray-400';

  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`} />;
}
