import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../ui/button';
import { LoadingButton } from '../../ui/loading-button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Textarea } from '../../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { apiClient } from '../../../services/api/client';
import type {
  PermissionProfile,
  Capability,
  Capabilities,
  VisibilityLevel,
  VisibilityMap,
  RequireApprovalFor,
  BaseRole,
  CreatePermissionProfileInput,
  UpdatePermissionProfileInput,
} from '../../../types/governance';
import {
  CAPABILITY_LABELS,
  VISIBILITY_ENTITIES,
  VISIBILITY_LABELS,
  APPROVAL_LABELS,
  BASE_ROLE_LABELS,
} from './permissionLabels';
import { CAPABILITY_DEFAULTS, VISIBILITY_DEFAULTS } from './permissionDefaults';

const VISIBILITY_ORDER: VisibilityLevel[] = ['PROPRIA', 'EQUIPE', 'GERAL'];
const BASE_ROLE_ORDER: BaseRole[] = ['ADMIN', 'GESTOR', 'USER', 'VIEWER'];

interface PermissionProfileEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = criar novo; caso contrário edita o custom existente. */
  profile: PermissionProfile | null;
  onSaved: () => void;
}

export function PermissionProfileEditor({
  open,
  onOpenChange,
  profile,
  onSaved,
}: PermissionProfileEditorProps) {
  const isEditing = !!profile;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [baseRole, setBaseRole] = useState<BaseRole>('USER');
  const [capabilities, setCapabilities] = useState<Capabilities>(CAPABILITY_DEFAULTS.USER);
  const [visibility, setVisibility] = useState<VisibilityMap>(VISIBILITY_DEFAULTS.USER);
  const [requireApprovalFor, setRequireApprovalFor] = useState<RequireApprovalFor>({
    export: false,
    bulk: false,
    delete: false,
  });
  const [saving, setSaving] = useState(false);

  // Ao (re)abrir, semeia o formulário: edição parte do perfil; criação parte
  // dos defaults do baseRole selecionado.
  useEffect(() => {
    if (!open) return;
    if (profile) {
      const role = profile.baseRole;
      setName(profile.name);
      setDescription(profile.description || '');
      setBaseRole(role);
      setCapabilities({ ...CAPABILITY_DEFAULTS[role], ...profile.capabilities });
      setVisibility({ ...VISIBILITY_DEFAULTS[role], ...profile.visibility });
      setRequireApprovalFor({
        export: profile.requireApprovalFor.export ?? false,
        bulk: profile.requireApprovalFor.bulk ?? false,
        delete: profile.requireApprovalFor.delete ?? false,
      });
    } else {
      setName('');
      setDescription('');
      setBaseRole('USER');
      setCapabilities(CAPABILITY_DEFAULTS.USER);
      setVisibility(VISIBILITY_DEFAULTS.USER);
      setRequireApprovalFor({ export: false, bulk: false, delete: false });
    }
  }, [open, profile]);

  // Trocar o papel-base ao CRIAR reinicia os defaults (não aplica na edição,
  // onde o baseRole é imutável).
  const handleBaseRoleChange = (value: string) => {
    const role = value as BaseRole;
    setBaseRole(role);
    setCapabilities(CAPABILITY_DEFAULTS[role]);
    setVisibility(VISIBILITY_DEFAULTS[role]);
  };

  const toggleCapability = (key: Capability) => {
    setCapabilities((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setVisibilityFor = (key: 'deals' | 'companies' | 'contacts', level: VisibilityLevel) => {
    setVisibility((prev) => ({ ...prev, [key]: level }));
  };

  const toggleApproval = (key: 'export' | 'bulk' | 'delete') => {
    setRequireApprovalFor((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Informe o nome do perfil');
      return;
    }
    setSaving(true);
    try {
      if (isEditing && profile) {
        const payload: UpdatePermissionProfileInput = {
          name: trimmed,
          description: description.trim() || null,
          capabilities,
          visibility,
          requireApprovalFor,
        };
        await apiClient.updatePermissionProfile(profile.id, payload);
        toast.success('Perfil atualizado com sucesso');
      } else {
        const payload: CreatePermissionProfileInput = {
          name: trimmed,
          description: description.trim() || null,
          baseRole,
          capabilities,
          visibility,
          requireApprovalFor,
        };
        await apiClient.createPermissionProfile(payload);
        toast.success('Perfil criado com sucesso');
      }
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar perfil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Perfil' : 'Novo Perfil'}</DialogTitle>
          <DialogDescription>
            Ajuste as capacidades, a visibilidade e as aprovações deste perfil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Identificação */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Nome</Label>
              <Input
                id="profile-name"
                placeholder="Ex.: Vendedor Sênior"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-desc">Descrição</Label>
              <Textarea
                id="profile-desc"
                placeholder="Para que serve este perfil (opcional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Papel-base</Label>
              <Select
                value={baseRole}
                onValueChange={handleBaseRoleChange}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o papel-base" />
                </SelectTrigger>
                <SelectContent>
                  {BASE_ROLE_ORDER.map((role) => (
                    <SelectItem key={role} value={role}>
                      {BASE_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Herda os padrões deste papel. {isEditing ? 'Não pode ser alterado.' : ''}
              </p>
            </div>
          </div>

          {/* Capacidades */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Capacidades</h4>
            <div className="rounded-md border border-border divide-y divide-border">
              {CAPABILITY_LABELS.map(({ key, label, hint }) => (
                <div key={key} className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-sm text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                  <Switch
                    checked={capabilities[key]}
                    onCheckedChange={() => toggleCapability(key)}
                    aria-label={label}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Visibilidade */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Visibilidade</h4>
            <p className="text-xs text-muted-foreground">
              O que este perfil enxerga em cada área.
            </p>
            <div className="space-y-3">
              {VISIBILITY_ENTITIES.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <Label className="text-sm font-normal text-foreground">{label}</Label>
                  <Select
                    value={visibility[key]}
                    onValueChange={(v) => setVisibilityFor(key, v as VisibilityLevel)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIBILITY_ORDER.map((level) => (
                        <SelectItem key={level} value={level}>
                          {VISIBILITY_LABELS[level]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {/* Exigir aprovação */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Exigir aprovação</h4>
            <div className="rounded-md border border-border divide-y divide-border">
              {APPROVAL_LABELS.map(({ key, label, hint }) => (
                <div key={key} className="flex items-center justify-between px-3 py-2.5">
                  <div>
                    <p className="text-sm text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                  <Switch
                    checked={requireApprovalFor[key]}
                    onCheckedChange={() => toggleApproval(key)}
                    aria-label={`Exigir aprovação para ${label}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <LoadingButton
            loading={saving}
            loadingText="Salvando..."
            onClick={handleSave}
            className="bg-primary hover:bg-primary-dark"
          >
            Salvar
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
