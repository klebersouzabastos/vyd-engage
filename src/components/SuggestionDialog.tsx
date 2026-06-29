import { useState, useEffect } from 'react';
import { useLocation } from 'react-router';
import { toast } from 'sonner';
import { Lightbulb, Bug, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { apiClient, SuggestionType } from '../services/api/client';

interface SuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function SuggestionDialog({ open, onOpenChange, onCreated }: SuggestionDialogProps) {
  const location = useLocation();
  const [type, setType] = useState<SuggestionType>('IMPROVEMENT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [route, setRoute] = useState('');
  const [saving, setSaving] = useState(false);

  // Pré-preenche a rota atual ao abrir (snapshot, não reativo).
  useEffect(() => {
    if (open) setRoute(location.pathname + location.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = () => {
    setType('IMPROVEMENT');
    setTitle('');
    setDescription('');
    setRoute('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    const t = title.trim();
    const d = description.trim();
    const r = route.trim();
    if (t.length < 3) {
      toast.error('O título precisa ter pelo menos 3 caracteres');
      return;
    }
    if (d.length < 5) {
      toast.error('A descrição precisa ter pelo menos 5 caracteres');
      return;
    }
    setSaving(true);
    try {
      await apiClient.createSuggestion({ title: t, description: d, route: r || null, type });
      toast.success('Sugestão enviada — obrigado pelo feedback!');
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar sugestão');
    } finally {
      setSaving(false);
    }
  };

  const typeButton = (value: SuggestionType, label: string, Icon: typeof Lightbulb) => (
    <button
      type="button"
      onClick={() => setType(value)}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
        type === value
          ? 'bg-primary text-white'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar sugestão</DialogTitle>
          <DialogDescription>
            Descreva uma melhoria ou problema. A equipe revisa todas as sugestões enviadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <div className="mt-1 flex gap-2">
              {typeButton('IMPROVEMENT', 'Melhoria', Lightbulb)}
              {typeButton('BUG', 'Correção', Bug)}
            </div>
          </div>

          <div>
            <Label htmlFor="sg-title">Título</Label>
            <Input
              id="sg-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Resumo da sugestão"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="sg-route">Rota afetada</Label>
            <Input
              id="sg-route"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              maxLength={500}
              placeholder="/app/leads"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-gray-500">
              Pré-preenchida com a página atual. Edite se a sugestão for para outra área.
            </p>
          </div>

          <div>
            <Label htmlFor="sg-desc">Descrição</Label>
            <Textarea
              id="sg-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={5}
              placeholder="Detalhe o que gostaria de ver melhorado ou o problema encontrado"
              className="mt-1"
            />
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar sugestão'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
