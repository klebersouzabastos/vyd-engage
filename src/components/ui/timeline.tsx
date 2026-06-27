import { cn } from './utils';
import { ReactNode } from 'react';

interface TimelineItemProps {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  date: string;
  icon: ReactNode;
  iconClassName?: string;
}

export function TimelineItem({
  id,
  title,
  subtitle,
  description,
  date,
  icon,
  iconClassName = 'bg-gray-100 text-gray-600',
}: TimelineItemProps) {
  return (
    <div className="relative flex gap-4 py-3 group" key={id}>
      <div
        className={cn(
          'relative z-10 flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0',
          iconClassName
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0 pb-3">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-sm font-medium text-gray-900">{title}</span>
          {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
          <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{date}</span>
        </div>
        {description && (
          <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">{description}</p>
        )}
      </div>
    </div>
  );
}

interface TimelineProps {
  children: ReactNode;
  className?: string;
}

export function Timeline({ children, className }: TimelineProps) {
  return (
    <div className={cn('relative', className)}>
      <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200 z-0" />
      <div className="space-y-1">{children}</div>
    </div>
  );
}
