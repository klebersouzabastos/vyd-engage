import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Plus, MoreHorizontal, Pencil, Trash2, Star, Users, Bookmark } from 'lucide-react';
import type { SavedView } from '../../hooks/useSavedViews';

interface SavedViewsBarProps {
  views: SavedView[];
  activeViewId: string | null;
  onSelectView: (id: string | null) => void;
  onSaveView: (
    name: string,
    options?: { isDefault?: boolean; isShared?: boolean }
  ) => Promise<void>;
  onUpdateView: (
    id: string,
    data: { name?: string; isDefault?: boolean; isShared?: boolean }
  ) => Promise<void>;
  onDeleteView: (id: string) => Promise<void>;
  currentFiltersEmpty?: boolean;
}

export function SavedViewsBar({
  views,
  activeViewId,
  onSelectView,
  onSaveView,
  onUpdateView,
  onDeleteView,
  currentFiltersEmpty = true,
}: SavedViewsBarProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [renameViewId, setRenameViewId] = useState<string | null>(null);
  const [renameViewName, setRenameViewName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newViewName.trim()) return;
    setSaving(true);
    try {
      await onSaveView(newViewName.trim());
      setNewViewName('');
      setSaveDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async () => {
    if (!renameViewId || !renameViewName.trim()) return;
    setSaving(true);
    try {
      await onUpdateView(renameViewId, { name: renameViewName.trim() });
      setRenameDialogOpen(false);
      setRenameViewId(null);
      setRenameViewName('');
    } finally {
      setSaving(false);
    }
  };

  const openRename = (view: SavedView) => {
    setRenameViewId(view.id);
    setRenameViewName(view.name);
    setRenameDialogOpen(true);
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        {/* "All" pill - clears active view */}
        <button
          onClick={() => onSelectView(null)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
            activeViewId === null
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
          }`}
        >
          Todos
        </button>

        {/* Saved view pills */}
        {views.map((view) => (
          <div key={view.id} className="inline-flex items-center group">
            <button
              onClick={() => onSelectView(view.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-full text-sm font-medium transition-colors border border-r-0 ${
                activeViewId === view.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
            >
              <Bookmark size={12} />
              {view.name}
              {view.isDefault && <Star size={10} className="fill-current" />}
              {view.isShared && <Users size={10} />}
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`inline-flex items-center px-1.5 py-1.5 rounded-r-full text-sm transition-colors border border-l-0 ${
                    activeViewId === view.id
                      ? 'bg-primary text-white border-primary hover:bg-primary/90'
                      : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => openRename(view)}>
                  <Pencil size={14} className="mr-2" />
                  Renomear
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onUpdateView(view.id, { isDefault: !view.isDefault })}
                >
                  <Star size={14} className="mr-2" />
                  {view.isDefault ? 'Remover padrao' : 'Definir como padrao'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onUpdateView(view.id, { isShared: !view.isShared })}
                >
                  <Users size={14} className="mr-2" />
                  {view.isShared ? 'Tornar privada' : 'Compartilhar com time'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDeleteView(view.id)}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 size={14} className="mr-2" />
                  Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}

        {/* Save current filters button */}
        <Popover open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <PopoverTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border border-dashed border-gray-300 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              title="Salvar filtros atuais como visualizacao"
            >
              <Plus size={14} />
              Salvar vista
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4" align="start">
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-900">Salvar visualizacao</p>
              <Input
                placeholder="Nome da visualizacao..."
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- foco inicial intencional ao abrir o popover
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSaveDialogOpen(false);
                    setNewViewName('');
                  }}
                >
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!newViewName.trim() || saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Renomear visualizacao</DialogTitle>
          </DialogHeader>
          <Input
            value={renameViewName}
            onChange={(e) => setRenameViewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
            }}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- foco inicial intencional ao abrir o dialog
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenameDialogOpen(false);
                setRenameViewId(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleRename} disabled={!renameViewName.trim() || saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
