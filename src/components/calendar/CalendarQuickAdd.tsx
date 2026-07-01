import { useState, useEffect } from 'react';
import { format } from './calendarUtils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog';
import { Calendar } from 'lucide-react';

interface CalendarQuickAddProps {
  open: boolean;
  onClose: () => void;
  defaultDate: Date;
  onSave: (data: { title: string; priority: string; dueDate: string }) => void;
}

export function CalendarQuickAdd({ open, onClose, defaultDate, onSave }: CalendarQuickAddProps) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('MEDIUM');

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza estado do formulário a partir da prop `open` (reset ao abrir)
      setTitle('');
      setPriority('MEDIUM');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      priority,
      dueDate: defaultDate.toISOString(),
    });

    setTitle('');
    setPriority('MEDIUM');
    onClose();
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTitle('');
      setPriority('MEDIUM');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
          <DialogDescription className="flex items-center gap-1 text-sm text-gray-500">
            <Calendar size={14} />
            {format(defaultDate, 'dd/MM/yyyy')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              placeholder="Título da tarefa"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- foco inicial intencional no campo principal do diálogo
              autoFocus
              required
            />
          </div>

          <div>
            <label
              htmlFor="calendar-quick-add-priority"
              className="text-sm font-medium text-gray-700 mb-1 block"
            >
              Prioridade
            </label>
            <select
              id="calendar-quick-add-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-card text-sm"
            >
              <option value="LOW">Baixa</option>
              <option value="MEDIUM">Média</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
