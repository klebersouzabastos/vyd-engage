import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import type { CalendarViewMode } from './calendarUtils';

interface CalendarHeaderProps {
  title: string;
  viewMode: CalendarViewMode;
  onNavigate: (direction: 'prev' | 'next' | 'today') => void;
}

export function CalendarHeader({ title, viewMode, onNavigate }: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('prev')}
          className="h-8 w-8"
        >
          <ChevronLeft size={16} />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate('today')}>
          Hoje
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('next')}
          className="h-8 w-8"
        >
          <ChevronRight size={16} />
        </Button>
      </div>

      <h2 className="text-lg font-semibold capitalize">{title}</h2>

      <div className="w-[140px]" />
    </div>
  );
}
