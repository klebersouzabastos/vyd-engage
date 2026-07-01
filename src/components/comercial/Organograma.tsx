import './organograma.css';
import { Trash2, UserRound } from 'lucide-react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  STAKEHOLDER_ROLE_LABELS,
  STAKEHOLDER_POSTURE_LABELS,
  type RoadmapStakeholder,
  type StakeholderRole,
  type StakeholderPosture,
} from '../../types/comercial';

const ROLES = Object.keys(STAKEHOLDER_ROLE_LABELS) as StakeholderRole[];
const POSTURES = Object.keys(STAKEHOLDER_POSTURE_LABELS) as StakeholderPosture[];

const POSTURE_DOT: Record<StakeholderPosture, string> = {
  FAVORAVEL: 'bg-green-500',
  NEUTRO: 'bg-slate-400',
  CONTRARIO: 'bg-red-500',
  DESCONHECIDO: 'bg-slate-300',
};

interface Props {
  stakeholders: RoadmapStakeholder[];
  onUpdate: (
    leadId: string,
    patch: { roleInDecision?: StakeholderRole; posture?: StakeholderPosture }
  ) => void;
  onRemove: (leadId: string) => void;
}

/** Constrói a árvore por `lead.reportsToId` restrita ao conjunto de stakeholders. */
function buildChildrenMap(stakeholders: RoadmapStakeholder[]) {
  const present = new Set(stakeholders.map((s) => s.leadId));
  const childrenOf = new Map<string | null, RoadmapStakeholder[]>();
  for (const s of stakeholders) {
    const parent =
      s.lead.reportsToId && present.has(s.lead.reportsToId) ? s.lead.reportsToId : null;
    const arr = childrenOf.get(parent) ?? [];
    arr.push(s);
    childrenOf.set(parent, arr);
  }
  return childrenOf;
}

export function Organograma({ stakeholders, onUpdate, onRemove }: Props) {
  if (stakeholders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
        Nenhum contato no desdobramento ainda. Adicione decisores e influenciadores para montar a
        hierarquia.
      </div>
    );
  }

  const childrenOf = buildChildrenMap(stakeholders);

  const renderNodes = (parent: string | null) => {
    const nodes = childrenOf.get(parent) ?? [];
    if (nodes.length === 0) return null;
    return (
      <ul>
        {nodes.map((s) => (
          <li key={s.id} className="org-node">
            <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-card p-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <UserRound className="h-4 w-4 text-slate-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-slate-900">{s.lead.name}</p>
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${POSTURE_DOT[s.posture]}`}
                    title={STAKEHOLDER_POSTURE_LABELS[s.posture]}
                  />
                </div>
                {s.lead.position && (
                  <p className="truncate text-xs text-slate-500">{s.lead.position}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Select
                    value={s.roleInDecision}
                    onValueChange={(v) =>
                      onUpdate(s.leadId, { roleInDecision: v as StakeholderRole })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs" style={{ width: 140 }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {STAKEHOLDER_ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={s.posture}
                    onValueChange={(v) => onUpdate(s.leadId, { posture: v as StakeholderPosture })}
                  >
                    <SelectTrigger className="h-7 text-xs" style={{ width: 130 }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSTURES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {STAKEHOLDER_POSTURE_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover contato"
                className="h-7 w-7 shrink-0"
                onClick={() => onRemove(s.leadId)}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
            <div className="org-children">{renderNodes(s.leadId)}</div>
          </li>
        ))}
      </ul>
    );
  };

  return <div className="organograma">{renderNodes(null)}</div>;
}
