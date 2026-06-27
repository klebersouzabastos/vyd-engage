import { useMemo } from 'react';
import type { Task } from '../../types';
import { getWeekDays, groupTasksByDate, isToday, format } from './calendarUtils';
import { ptBR } from 'date-fns/locale';
import { CalendarTaskChip } from './CalendarTaskChip';
import { useIsMobile } from '../ui/use-mobile';

interface CalendarWeekViewProps {
  weekStart: Date;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDateClick: (date: Date) => void;
  onTaskDrop: (taskId: string, newDate: Date) => void;
}

export function CalendarWeekView({
  weekStart,
  tasks,
  onTaskClick,
  onDateClick,
  onTaskDrop,
}: CalendarWeekViewProps) {
  const isMobile = useIsMobile();
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);
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

  return (
    <div
      role="grid"
      aria-label="Calendário semanal"
      className={`
        bg-white rounded-lg border border-gray-300 overflow-hidden
        ${isMobile ? 'flex flex-col' : 'grid grid-cols-7'}
      `}
    >
      {days.map((day, idx) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayTasks = tasksByDate.get(dateKey) || [];
        const today = isToday(day);

        return (
          <div
            key={idx}
            role="gridcell"
            tabIndex={isMobile ? -1 : 0}
            aria-label={format(day, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            {...(today ? { 'aria-current': 'date' as const } : {})}
            className={`
              border-r border-gray-100 last:border-r-0
              ${isMobile ? 'border-b last:border-b-0' : ''}
            `}
            onDragOver={!isMobile ? handleDragOver : undefined}
            onDrop={!isMobile ? (e) => handleDrop(e, day) : undefined}
          >
            {/* Day header */}
            <div
              role="button"
              tabIndex={0}
              className={`
                px-2 py-2 text-center border-b border-gray-100 cursor-pointer
                hover:bg-gray-50 transition-colors
                ${today ? 'bg-primary/5' : ''}
              `}
              onClick={() => onDateClick(day)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onDateClick(day);
                }
              }}
            >
              <div className="text-xs font-medium text-gray-500 uppercase">
                {format(day, 'EEE', { locale: ptBR })}
              </div>
              <div
                className={`
                  text-lg font-semibold mt-0.5
                  ${
                    today
                      ? 'w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center mx-auto'
                      : 'text-gray-700'
                  }
                `}
              >
                {format(day, 'd')}
              </div>
            </div>

            {/* Tasks */}
            <div
              className={`
                p-1.5 space-y-1
                ${isMobile ? 'min-h-[60px]' : 'min-h-[200px] max-h-[400px] overflow-y-auto'}
              `}
            >
              {dayTasks.length === 0 ? (
                <div
                  role="button"
                  tabIndex={0}
                  className="h-full min-h-[40px] flex items-center justify-center cursor-pointer"
                  onClick={() => onDateClick(day)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onDateClick(day);
                    }
                  }}
                >
                  <span className="text-[11px] text-gray-300">+</span>
                </div>
              ) : (
                dayTasks.map((task) => (
                  <CalendarTaskChip
                    key={task.id}
                    task={task}
                    compact={false}
                    onClick={onTaskClick}
                    onDragStart={!isMobile ? handleDragStart : undefined}
                    draggable={!isMobile}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
