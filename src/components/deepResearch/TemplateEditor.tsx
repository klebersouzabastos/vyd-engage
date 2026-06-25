import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Button } from '../ui/button';
import { useDeepResearchActions } from '../../hooks/useDeepResearch';
import type { DeepResearchTemplate } from '../../types/deepResearch';

interface TemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: DeepResearchTemplate | null;
  onSaved?: () => void;
}

/** Dialog para criar ou editar um template-modelo de prompt. */
export function TemplateEditor({ open, onOpenChange, template, onSaved }: TemplateEditorProps) {
  const { createTemplate, updateTemplate } = useDeepResearchActions();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [promptBody, setPromptBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? '');
    setDescription(template?.description ?? '');
    setPromptBody(template?.promptBody ?? '');
    setSaving(false);
  }, [open, template?.id]);

  const canSave = name.trim().length > 0 && promptBody.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (template) {
        await updateTemplate(template.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          promptBody,
        });
      } else {
        await createTemplate({
          name: name.trim(),
          description: description.trim() || undefined,
          promptBody,
        });
      }
      onSaved?.();
      onOpenChange(false);
    } catch {
      // toast já exibido no hook
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Editar template' : 'Novo template'}</DialogTitle>
          <DialogDescription>
            Use colchetes para campos preenchíveis, ex.: <code>[EMPRESA]</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="tpl-name">Nome</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Empresa, Segmento"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tpl-desc">Descrição</Label>
            <Input
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição do que este modelo pesquisa"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tpl-body">Prompt</Label>
            <Textarea
              id="tpl-body"
              value={promptBody}
              onChange={(e) => setPromptBody(e.target.value)}
              rows={14}
              className="font-mono text-xs"
              placeholder="Corpo do prompt com placeholders [EMPRESA]…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSave}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
