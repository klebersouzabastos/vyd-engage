import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Bookmark, ChevronDown, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { SavedView } from "../hooks/useSavedViews";

interface SavedViewsDropdownProps {
  views: SavedView[];
  onApply: (filters: Record<string, any>) => void;
  onSave: (name: string, filters: Record<string, any>) => Promise<any> | void;
  onDelete: (id: string) => Promise<any> | void;
  getCurrentFilters: () => Record<string, any>;
}

export function SavedViewsDropdown({
  views,
  onApply,
  onSave,
  onDelete,
  getCurrentFilters,
}: SavedViewsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [viewName, setViewName] = useState("");

  const handleSave = async () => {
    if (!viewName.trim()) {
      toast.error("Digite um nome para a visualização");
      return;
    }
    const filters = getCurrentFilters();
    try {
      await onSave(viewName.trim(), filters);
      setViewName("");
      setSaveModalOpen(false);
    } catch {
      // error toast handled by hook
    }
  };

  const handleApply = (view: SavedView) => {
    onApply(view.filters as Record<string, any>);
    setOpen(false);
    toast.success(`Visualização "${view.name}" aplicada`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await onDelete(id);
    } catch {
      // error toast handled by hook
    }
  };

  return (
    <>
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(!open)}
          className="gap-2 text-sm"
        >
          <Bookmark size={14} />
          Visualizações
          {views.length > 0 && (
            <span className="bg-gray-200 text-gray-700 text-xs px-1.5 rounded-full">{views.length}</span>
          )}
          <ChevronDown size={12} />
        </Button>

        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            {/* Dropdown */}
            <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
              <div className="p-3 border-b border-gray-100">
                <button
                  onClick={() => { setSaveModalOpen(true); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-primary hover:bg-primary/5 rounded-md transition-colors"
                >
                  <Plus size={14} />
                  Salvar visualização atual
                </button>
              </div>

              {views.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-400">
                  Nenhuma visualização salva
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {views.map(view => (
                    <div
                      key={view.id}
                      onClick={() => handleApply(view)}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0 group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{view.name}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(view.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, view.id)}
                        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        title="Remover visualização"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Save Modal */}
      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Salvar Visualização</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Nome da visualização
            </label>
            <Input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Ex: Leads quentes do mês"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-2">
              Os filtros atuais serão salvos nesta visualização
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!viewName.trim()}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
