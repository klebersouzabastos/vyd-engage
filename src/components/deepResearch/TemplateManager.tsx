import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { TemplateEditor } from './TemplateEditor';
import { useDeepResearchActions } from '../../hooks/useDeepResearch';
import type { DeepResearchTemplate } from '../../types/deepResearch';

interface TemplateManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: DeepResearchTemplate[];
}

/**
 * Gerência dos modelos de prompt — exclusiva do platform admin. Os prompts não
 * são exibidos aos usuários finais; só o admin os cria/edita aqui.
 */
export function TemplateManager({ open, onOpenChange, templates }: TemplateManagerProps) {
  const { deleteTemplate } = useDeepResearchActions();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<DeepResearchTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeepResearchTemplate | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modelos de prompt</DialogTitle>
            <DialogDescription>
              Gerência exclusiva do admin da plataforma. Estes prompts são a inteligência do
              produto e não são exibidos aos usuários.
            </DialogDescription>
          </DialogHeader>

          <div className="mb-2 flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Novo modelo
            </Button>
          </div>

          <ul className="space-y-2">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-gray-900">{t.name}</span>
                    {t.isBuiltin && (
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                        Padrão
                      </Badge>
                    )}
                  </div>
                  {t.description && (
                    <p className="truncate text-xs text-gray-500">{t.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar"
                    onClick={() => {
                      setEditing(t);
                      setEditorOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!t.isBuiltin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Excluir"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <TemplateEditor open={editorOpen} onOpenChange={setEditorOpen} template={editing} />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `“${deleteTarget.name}” será removido permanentemente.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (deleteTarget) await deleteTemplate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
