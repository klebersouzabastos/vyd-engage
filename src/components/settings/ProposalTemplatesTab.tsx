import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Loader2, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { RichTextEditor } from '../ui/RichTextEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { apiClient } from '../../services/api/client';
import type { ProposalTemplate, ProposalTemplateStatus } from '../../types/documents';

/**
 * Configurações de Negócios → Modelos de proposta (upgrade-rd-parity req 17):
 * CRUD de modelos (nome, corpo rico, isDefault, status DRAFT/PUBLISHED) usados
 * na geração de propostas do negócio (req 18). Variáveis resolvidas na geração.
 * 100% tokens semânticos (STRICT_SCOPE).
 */

const TEMPLATE_VARIABLES: Array<{ token: string; description: string }> = [
  { token: '{{dealName}}', description: 'nome da negociação' },
  { token: '{{dealValue}}', description: 'valor da negociação (R$)' },
  { token: '{{clientName}}', description: 'nome do contato' },
  { token: '{{clientCompany}}', description: 'empresa do cliente' },
  { token: '{{clientEmail}}', description: 'e-mail do contato' },
  { token: '{{salesRepName}}', description: 'responsável pela negociação' },
  { token: '{{dealProducts}}', description: 'tabela de produtos/itens do negócio' },
];

const STATUS_OPTIONS: Array<{ value: ProposalTemplateStatus; label: string }> = [
  { value: 'PUBLISHED', label: 'Publicado' },
  { value: 'DRAFT', label: 'Rascunho' },
];

interface Draft {
  id: string | null;
  name: string;
  bodyHtml: string;
  isDefault: boolean;
  status: ProposalTemplateStatus;
}

export function ProposalTemplatesTab() {
  const [items, setItems] = useState<ProposalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getProposalTemplates();
      setItems(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar modelos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = async (item: ProposalTemplate) => {
    setOpeningId(item.id);
    try {
      const res = await apiClient.getProposalTemplate(item.id);
      const detail = res.data;
      setDraft({
        id: detail.id,
        name: detail.name,
        bodyHtml: detail.bodyHtml,
        isDefault: detail.isDefault,
        status: detail.status,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao abrir modelo');
    } finally {
      setOpeningId(null);
    }
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error('Informe o nome do modelo');
      return;
    }
    const bodyHtml = draft.bodyHtml.trim();
    if (!bodyHtml || bodyHtml === '<p></p>') {
      toast.error('Escreva o corpo da proposta');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        name: draft.name.trim(),
        bodyHtml,
        isDefault: draft.isDefault,
        status: draft.status,
      };
      if (draft.id) {
        await apiClient.updateProposalTemplate(draft.id, payload);
      } else {
        await apiClient.createProposalTemplate(payload);
      }
      toast.success('Modelo salvo!');
      setDraft(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar modelo');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: ProposalTemplate) => {
    if (!confirm(`Excluir o modelo "${item.name}"?`)) return;
    try {
      await apiClient.deleteProposalTemplate(item.id);
      setItems((prev) => prev.filter((p) => p.id !== item.id));
      toast.success('Modelo excluído');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir modelo');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        Carregando modelos...
      </div>
    );
  }

  // ── Editor ─────────────────────────────────────────
  if (draft) {
    return (
      <div className="max-w-3xl space-y-5">
        <h3 className="font-semibold text-foreground">
          {draft.id ? 'Editar modelo' : 'Novo modelo'}
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="proposal-template-name">Nome</Label>
            <Input
              id="proposal-template-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ex.: Proposta padrão"
              maxLength={100}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="proposal-template-status">Status</Label>
            <Select
              value={draft.status}
              onValueChange={(v) => setDraft({ ...draft, status: v as ProposalTemplateStatus })}
            >
              <SelectTrigger id="proposal-template-status" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <Label htmlFor="proposal-template-default" className="text-sm text-foreground">
              Modelo padrão
            </Label>
            <p className="text-xs text-muted-foreground">
              Usado automaticamente ao gerar uma proposta sem escolher modelo. Só um pode ser
              padrão.
            </p>
          </div>
          <Switch
            id="proposal-template-default"
            checked={draft.isDefault}
            onCheckedChange={(checked) => setDraft({ ...draft, isDefault: checked })}
          />
        </div>

        <div>
          <Label>Corpo da proposta</Label>
          <div className="mt-1">
            <RichTextEditor
              value={draft.bodyHtml}
              onChange={(html) => setDraft((p) => (p ? { ...p, bodyHtml: html } : p))}
              placeholder="Escreva o corpo da proposta..."
              minHeight={260}
              ariaLabel="Corpo da proposta"
            />
          </div>
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium text-foreground">Variáveis disponíveis</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use no corpo; são substituídas pelos dados da negociação na geração da proposta.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {TEMPLATE_VARIABLES.map((v) => (
              <span key={v.token} className="text-xs text-muted-foreground">
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">{v.token}</code>{' '}
                {v.description}
              </span>
            ))}
          </div>
        </div>

        <div className="flex gap-2 border-t border-border pt-4">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
            Salvar modelo
          </Button>
          <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  // ── Lista ──────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-foreground">Modelos de proposta</h3>
          <p className="text-sm text-muted-foreground">
            Usados na geração de propostas da negociação, com variáveis substituídas
            automaticamente.
          </p>
        </div>
        <Button
          onClick={() =>
            setDraft({ id: null, name: '', bodyHtml: '', isDefault: false, status: 'PUBLISHED' })
          }
        >
          <Plus size={16} className="mr-2" />
          Novo modelo
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
          <FileText size={24} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum modelo de proposta criado.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    {item.isDefault && (
                      <Badge variant="secondary" className="gap-1">
                        <Star size={11} />
                        Padrão
                      </Badge>
                    )}
                    <Badge variant={item.status === 'PUBLISHED' ? 'default' : 'outline'}>
                      {item.status === 'PUBLISHED' ? 'Publicado' : 'Rascunho'}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="mr-2 text-xs text-muted-foreground">
                  {new Date(item.updatedAt).toLocaleDateString('pt-BR')}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit(item)}
                  disabled={openingId === item.id}
                  aria-label={`Editar ${item.name}`}
                >
                  {openingId === item.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Pencil size={16} />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => remove(item)}
                  aria-label={`Excluir ${item.name}`}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
