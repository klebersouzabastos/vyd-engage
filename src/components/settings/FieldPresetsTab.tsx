import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ListChecks, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { apiClient } from '../../services/api/client';
import type { FieldPreset, PresetEntity } from '../../types/sales';

/**
 * Configurações de Negócios → Informações pré-definidas (upgrade-rd-parity
 * req 7): listas de valores para campos padrão de Empresa/Contato; nos
 * formulários o campo vira seleção (com valor livre quando permitido).
 * 100% tokens semânticos (STRICT_SCOPE do check:colors).
 */

const ENTITY_LABELS: Record<PresetEntity, string> = {
  COMPANY: 'Empresa',
  CONTACT: 'Contato',
  DEAL: 'Negociação',
};

// Campos válidos por entidade — espelha PRESET_FIELDS_BY_ENTITY do backend
// (DEAL não tem campos padrão elegíveis por enquanto).
const FIELDS_BY_ENTITY: Record<string, Array<{ value: string; label: string }>> = {
  COMPANY: [{ value: 'industry', label: 'Setor' }],
  CONTACT: [{ value: 'position', label: 'Cargo' }],
};

const fieldLabel = (entity: PresetEntity, field: string) =>
  FIELDS_BY_ENTITY[entity]?.find((f) => f.value === field)?.label ?? field;

interface Draft {
  id: string | null;
  entity: PresetEntity;
  field: string;
  options: string[];
  allowCustom: boolean;
}

const emptyDraft = (): Draft => ({
  id: null,
  entity: 'COMPANY',
  field: 'industry',
  options: [],
  allowCustom: true,
});

export function FieldPresetsTab() {
  const [items, setItems] = useState<FieldPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newOption, setNewOption] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getFieldPresets();
      setItems(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar pré-definidos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addOption = () => {
    const v = newOption.trim();
    if (!v || !draft) return;
    if (draft.options.some((o) => o.toLowerCase() === v.toLowerCase())) {
      toast.error('Esta opção já está na lista');
      return;
    }
    setDraft({ ...draft, options: [...draft.options, v] });
    setNewOption('');
  };

  const save = async () => {
    if (!draft) return;
    if (draft.options.length === 0) {
      toast.error('Adicione ao menos uma opção à lista');
      return;
    }
    try {
      setSaving(true);
      if (draft.id) {
        await apiClient.updateFieldPreset(draft.id, {
          options: draft.options,
          allowCustom: draft.allowCustom,
        });
      } else {
        await apiClient.createFieldPreset({
          entity: draft.entity,
          field: draft.field,
          options: draft.options,
          allowCustom: draft.allowCustom,
        });
      }
      toast.success('Pré-definido salvo!');
      setDraft(null);
      setNewOption('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar pré-definido');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (preset: FieldPreset) => {
    if (
      !confirm(
        `Excluir o pré-definido de ${fieldLabel(preset.entity, preset.field)} (${ENTITY_LABELS[preset.entity]})?`
      )
    )
      return;
    try {
      await apiClient.deleteFieldPreset(preset.id);
      setItems((prev) => prev.filter((p) => p.id !== preset.id));
      toast.success('Pré-definido excluído');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir pré-definido');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        Carregando pré-definidos...
      </div>
    );
  }

  // ── Formulário ─────────────────────────────────────
  if (draft) {
    const fields = FIELDS_BY_ENTITY[draft.entity] || [];
    return (
      <div className="max-w-2xl space-y-5">
        <h3 className="font-semibold text-foreground">
          {draft.id ? 'Editar pré-definido' : 'Novo pré-definido'}
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Entidade</Label>
            <Select
              value={draft.entity}
              onValueChange={(v) => {
                const entity = v as PresetEntity;
                const first = FIELDS_BY_ENTITY[entity]?.[0]?.value ?? '';
                setDraft({ ...draft, entity, field: first });
              }}
              disabled={!!draft.id}
            >
              <SelectTrigger className="mt-1" aria-label="Entidade">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPANY">Empresa</SelectItem>
                <SelectItem value="CONTACT">Contato</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Campo</Label>
            <Select
              value={draft.field}
              onValueChange={(v) => setDraft({ ...draft, field: v })}
              disabled={!!draft.id}
            >
              <SelectTrigger className="mt-1" aria-label="Campo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fields.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="preset-new-option">Opções da lista</Label>
          <div className="mt-1 flex gap-2">
            <Input
              id="preset-new-option"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addOption();
                }
              }}
              placeholder="Nova opção (Enter para adicionar)"
              maxLength={120}
            />
            <Button variant="outline" onClick={addOption} disabled={!newOption.trim()}>
              <Plus size={16} />
            </Button>
          </div>
          {draft.options.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Nenhuma opção adicionada.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {draft.options.map((o) => (
                <Badge key={o} variant="secondary" className="gap-1">
                  {o}
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, options: draft.options.filter((x) => x !== o) })
                    }
                    aria-label={`Remover ${o}`}
                    className="hover:text-destructive"
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <div>
            <Label htmlFor="preset-allow-custom">Permitir valor livre</Label>
            <p className="text-xs text-muted-foreground">
              Além da lista, o usuário pode digitar um novo valor no formulário.
            </p>
          </div>
          <Switch
            id="preset-allow-custom"
            checked={draft.allowCustom}
            onCheckedChange={(v) => setDraft({ ...draft, allowCustom: v })}
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
            Salvar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setDraft(null);
              setNewOption('');
            }}
            disabled={saving}
          >
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
          <h3 className="font-semibold text-foreground">Informações pré-definidas</h3>
          <p className="text-sm text-muted-foreground">
            Listas de valores para campos padrão (ex.: Setor da empresa, Cargo do contato).
            Nos formulários, o campo vira uma seleção.
          </p>
        </div>
        <Button onClick={() => setDraft(emptyDraft())}>
          <Plus size={16} className="mr-2" />
          Novo pré-definido
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-10 text-center">
          <ListChecks size={24} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum pré-definido cadastrado.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {items.map((preset) => (
            <li key={preset.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {fieldLabel(preset.entity, preset.field)}
                  </span>
                  <Badge variant="outline">{ENTITY_LABELS[preset.entity]}</Badge>
                  {preset.allowCustom && <Badge variant="secondary">Valor livre</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {preset.options.length}{' '}
                  {preset.options.length === 1 ? 'opção' : 'opções'}: {preset.options.join(', ')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setDraft({
                      id: preset.id,
                      entity: preset.entity,
                      field: preset.field,
                      options: [...preset.options],
                      allowCustom: preset.allowCustom,
                    })
                  }
                  aria-label="Editar pré-definido"
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => remove(preset)}
                  aria-label="Excluir pré-definido"
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
