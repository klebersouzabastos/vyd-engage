import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Mail, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RichTextEditor } from '../ui/RichTextEditor';
import { apiClient, EmailTemplateListItem } from '../../services/api/client';

/**
 * Configurações de Negócios → Modelos de e-mail 1:1 (upgrade-rd-parity req 10):
 * CRUD de modelos (nome, assunto, corpo rico) usados na ação "Enviar e-mail"
 * do negócio. Variáveis resolvidas no envio: {{nome}} {{empresa}} {{negociacao}}
 * {{valor}} {{responsavel}}. 100% tokens semânticos (STRICT_SCOPE).
 */

const TEMPLATE_VARIABLES: Array<{ token: string; description: string }> = [
  { token: '{{nome}}', description: 'nome do contato' },
  { token: '{{empresa}}', description: 'nome da empresa' },
  { token: '{{negociacao}}', description: 'nome da negociação' },
  { token: '{{valor}}', description: 'valor da negociação (R$)' },
  { token: '{{responsavel}}', description: 'responsável pela negociação' },
];

interface Draft {
  id: string | null;
  name: string;
  subject: string;
  html: string;
}

export function EmailTemplatesTab() {
  const [items, setItems] = useState<EmailTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getEmailTemplates();
      setItems(res || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar modelos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = async (item: EmailTemplateListItem) => {
    setOpeningId(item.id);
    try {
      const detail = await apiClient.getEmailTemplate(item.id);
      setDraft({ id: detail.id, name: detail.name, subject: detail.subject, html: detail.html });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao abrir modelo');
    } finally {
      setOpeningId(null);
    }
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim() || !draft.subject.trim()) {
      toast.error('Informe o nome e o assunto do modelo');
      return;
    }
    const html = draft.html.trim();
    if (!html || html === '<p></p>') {
      toast.error('Escreva o corpo do e-mail');
      return;
    }
    try {
      setSaving(true);
      const payload = { name: draft.name.trim(), subject: draft.subject.trim(), html };
      if (draft.id) {
        await apiClient.updateEmailTemplate(draft.id, payload);
      } else {
        await apiClient.createEmailTemplate(payload);
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

  const remove = async (item: EmailTemplateListItem) => {
    if (!confirm(`Excluir o modelo "${item.name}"?`)) return;
    try {
      await apiClient.deleteEmailTemplate(item.id);
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
            <Label htmlFor="template-name">Nome</Label>
            <Input
              id="template-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Ex.: Apresentação inicial"
              maxLength={100}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="template-subject">Assunto</Label>
            <Input
              id="template-subject"
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              placeholder="Ex.: Proposta para {{empresa}}"
              maxLength={500}
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label>Corpo do e-mail</Label>
          <div className="mt-1">
            <RichTextEditor
              value={draft.html}
              onChange={(html) => setDraft((p) => (p ? { ...p, html } : p))}
              placeholder="Escreva o corpo do e-mail..."
              minHeight={220}
              ariaLabel="Corpo do e-mail"
            />
          </div>
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium text-foreground">Variáveis disponíveis</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use no assunto ou no corpo; são substituídas pelos dados da negociação no envio.
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
          <h3 className="font-semibold text-foreground">Modelos de e-mail</h3>
          <p className="text-sm text-muted-foreground">
            Usados na ação &quot;Enviar e-mail&quot; da negociação, com variáveis substituídas
            automaticamente.
          </p>
        </div>
        <Button onClick={() => setDraft({ id: null, name: '', subject: '', html: '' })}>
          <Plus size={16} className="mr-2" />
          Novo modelo
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
          <Mail size={24} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum modelo de e-mail criado.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">{item.subject}</p>
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
