import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../ui/dialog';
import type { PermissionProfile } from '../../../types/governance';
import {
  CAPABILITY_LABELS,
  VISIBILITY_ENTITIES,
  VISIBILITY_LABELS,
  APPROVAL_LABELS,
} from './permissionLabels';
import { CAPABILITY_DEFAULTS, VISIBILITY_DEFAULTS } from './permissionDefaults';

/** Visualizador somente-leitura de um perfil padrão (builtin). Mostra os padrões
 *  efetivos do papel-base mesclados a eventuais overrides do backend. */
export function BuiltinProfileViewer({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: PermissionProfile;
}) {
  const role = profile.baseRole;
  const caps = { ...CAPABILITY_DEFAULTS[role], ...profile.capabilities };
  const vis = { ...VISIBILITY_DEFAULTS[role], ...profile.visibility };
  const approvals = {
    export: profile.requireApprovalFor.export ?? false,
    bulk: profile.requireApprovalFor.bulk ?? false,
    delete: profile.requireApprovalFor.delete ?? false,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{profile.name}</DialogTitle>
          <DialogDescription>Perfil padrão (somente leitura).</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Capacidades</h4>
            <div className="rounded-md border border-border divide-y divide-border">
              {CAPABILITY_LABELS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-foreground">{label}</span>
                  <Badge variant={caps[key] ? 'secondary' : 'outline'}>
                    {caps[key] ? 'Permitido' : 'Bloqueado'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Visibilidade</h4>
            <div className="rounded-md border border-border divide-y divide-border">
              {VISIBILITY_ENTITIES.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-foreground">{label}</span>
                  <span className="text-sm text-muted-foreground">
                    {VISIBILITY_LABELS[vis[key]]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Exigir aprovação</h4>
            <div className="rounded-md border border-border divide-y divide-border">
              {APPROVAL_LABELS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-foreground">{label}</span>
                  <Badge variant={approvals[key] ? 'secondary' : 'outline'}>
                    {approvals[key] ? 'Sim' : 'Não'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
