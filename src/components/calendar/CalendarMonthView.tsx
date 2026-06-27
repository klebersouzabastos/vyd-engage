import { useMemo } from 'react';
import type { Task } from '../../types';
import { getMonthGridDays, groupTasksByDate, isToday, isSameMonth, format } from './calendarUtils';
import { CalendarTaskChip, CalendarTaskDot } from './CalendarTaskChip';
import { useIsMobile } from '../ui/use-mobile';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface CalendarMonthViewProps {
  currentDate: Date;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDateClick: (date: Date) => void;
  onTaskDrop: (taskId: string, newDate: Date) => void;
}

export function CalendarMonthView({
  currentDate,
  tasks,
  onTaskClick,
  onDateClick,
  onTaskDrop,
}: CalendarMonthViewProps) {
  const isMobile = useIsMobile();
  const days = useMemo(() => getMonthGridDays(currentDate), [currentDate]);
  const tasksByDate = useMemo(() => groupTasksByDate(tasks), [tasks]);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onTaskDrop(taskId, date);
    }
  };

  const MAX_VISIBLE = isMobile ? 0 : 3;

  return (
    <div
      role="grid"
      aria-label="Calendário mensal"
      className="bg-white rounded-lg border border-gray-300 overflow-hidden"
    >
      {/* Header */}
      <div role="row" className="grid grid-cols-7 border-b border-gray-200">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            role="columnheader"
            className="py-2 text-center text-xs font-semibold text-gray-500 uppercase"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div role="row" className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const today = isToday(day);
          const overflow = dayTasks.length - MAX_VISIBLE;

          return (
            <div
              key={idx}
              role="gridcell"
              tabIndex={0}
              aria-label={format(day, "d 'de' MMMM 'de' yyyy")}
              {...(today ? { 'aria-current': 'date' as const } : {})}
              className={`
                min-h-[90px] border-b border-r border-gray-100 p-1 cursor-pointer
                transition-colors hover:bg-gray-50
                ${!isCurrentMonth ? 'bg-gray-50' : ''}
              `}
              onClick={() => onDateClick(day)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if (e.key === ' ') e.preventDefault();
                  onDateClick(day);
                }
              }}
              onDragOver={!isMobile ? handleDragOver : undefined}
              onDrop={!isMobile ? (e) => handleDrop(e, day) : undefined}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`
                    text-sm w-7 h-7 flex items-center justify-center rounded-full
                    ${today ? 'bg-primary text-white font-bold' : ''}
                    ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-700'}
                  `}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {isMobile ? (
                /* Mobile: dots */
                dayTasks.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center">
                    {dayTasks.slice(0, 4).map((task) => (
                      <CalendarTaskDot key={task.id} task={task} />
                    ))}
                    {dayTasks.length > 4 && (
                      <span className="text-[9px] text-gray-400">+{dayTasks.length - 4}</span>
                    )}
                  </div>
                )
              ) : (
                /* Desktop: chips */
                <div className="space-y-0.5">
                  {dayTasks.slice(0, MAX_VISIBLE).map((task) => (
                    <CalendarTaskChip
                      key={task.id}
                      task={task}
                      compact
                      onClick={onTaskClick}
                      onDragStart={handleDragStart}
                    />
                  ))}
                  {overflow > 0 && (
                    <button
                      className="text-[11px] text-gray-500 hover:text-primary px-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDateClick(day);
                      }}
                    >
                      +{overflow} mais
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
