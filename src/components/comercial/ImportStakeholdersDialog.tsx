// Diálogo "Importar da pesquisa": o cap. 7 (Mapa de Stakeholders) da pesquisa
// de Empresa vira decisores do Desdobramento. Presentacional: recebe as linhas
// já cruzadas com os contatos da empresa (backend) e devolve, em onImport, só
// as que o gestor confirmou — os nomes vêm de fontes públicas pesquisadas pelo
// motor e podem estar errados, então nada entra sem confirmação humana.
import { useEffect, useState } from 'react';
import { Info, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  STAKEHOLDER_ROLE_LABELS,
  STAKEHOLDER_POSTURE_LABELS,
  type ImportStakeholderRow,
  type StakeholderPreviewRow,
  type StakeholderRole,
  type StakeholderPosture,
} from '../../types/comercial';

const ROLES = Object.keys(STAKEHOLDER_ROLE_LABELS) as StakeholderRole[];
const POSTURES = Object.keys(STAKEHOLDER_POSTURE_LABELS) as StakeholderPosture[];

interface Escolha {
  selected: boolean;
  role: StakeholderRole;
  posture: StakeholderPosture;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  researchTitle?: string;
  rows: StakeholderPreviewRow[];
  loading?: boolean;
  error?: string | null;
  onImport: (rows: ImportStakeholderRow[]) => Promise<void>;
}

/** Marcado por padrão só quem tem nome + cargo e ainda não está no desdobramento. */
function escolhaInicial(r: StakeholderPreviewRow): Escolha {
  return {
    selected: !!r.position && !r.alreadyStakeholder,
    role: r.suggestedRole,
    posture: 'DESCONHECIDO',
  };
}

export function ImportStakeholdersDialog({
  open,
  onOpenChange,
  researchTitle,
  rows,
  loading = false,
  error = null,
  onImport,
}: Props) {
  const [escolhas, setEscolhas] = useState<Escolha[]>(() => rows.map(escolhaInicial));
  const [saving, setSaving] = useState(false);

  // Nova pré-visualização (outra pesquisa, reabertura) → recomeça as escolhas.
  useEffect(() => {
    setEscolhas(rows.map(escolhaInicial));
  }, [rows]);

  const selecionadas = escolhas.filter((e) => e.selected).length;
  const setEscolha = (i: number, patch: Partial<Escolha>) =>
    setEscolhas((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  const submit = async () => {
    const payload: ImportStakeholderRow[] = rows.flatMap((r, i) =>
      escolhas[i]?.selected
        ? [
            {
              name: r.name,
              position: r.position,
              email: r.email,
              classification: r.classification,
              roleInDecision: escolhas[i].role,
              posture: escolhas[i].posture,
              existingLeadId: r.existingLeadId,
            },
          ]
        : []
    );
    if (payload.length === 0) return;
    setSaving(true);
    try {
      await onImport(payload);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[920px]">
        <DialogHeader>
          <DialogTitle>Importar decisores da pesquisa</DialogTitle>
          <DialogDescription>
            {researchTitle ? `Pesquisa de origem: ${researchTitle}.` : 'Pesquisa de origem do desdobramento.'}{' '}
            Contatos novos entram na empresa como contato; os já cadastrados são apenas vinculados.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Os nomes vêm de fontes públicas pesquisadas pelo motor e podem estar desatualizados ou
            errados. Confira cada linha antes de importar.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Lendo a pesquisa…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-default py-8 text-center text-sm text-secondary">
            A pesquisa não tem um Mapa de Stakeholders reconhecível (capítulo 7 da pesquisa de
            Empresa).
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Na pesquisa</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Postura</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const e = escolhas[i] ?? escolhaInicial(r);
                  return (
                    <TableRow key={`${r.name}-${i}`}>
                      <TableCell>
                        <Checkbox
                          checked={e.selected}
                          onCheckedChange={(v) => setEscolha(i, { selected: v === true })}
                          aria-label={`Importar ${r.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-primary">{r.name}</div>
                        {r.email && <div className="text-xs text-secondary">{r.email}</div>}
                      </TableCell>
                      <TableCell className="text-primary">
                        {r.position ?? <span className="text-secondary">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-secondary">{r.classification ?? '—'}</TableCell>
                      <TableCell>
                        <Select
                          value={e.role}
                          onValueChange={(v) => setEscolha(i, { role: v as StakeholderRole })}
                        >
                          <SelectTrigger className="h-8 w-[150px]" aria-label={`Papel de ${r.name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {STAKEHOLDER_ROLE_LABELS[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={e.posture}
                          onValueChange={(v) => setEscolha(i, { posture: v as StakeholderPosture })}
                        >
                          <SelectTrigger className="h-8 w-[150px]" aria-label={`Postura de ${r.name}`}>
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
                      </TableCell>
                      <TableCell>
                        {r.alreadyStakeholder ? (
                          <Badge variant="outline">já é stakeholder</Badge>
                        ) : r.existingLeadId ? (
                          <Badge variant="secondary">já cadastrado — será vinculado</Badge>
                        ) : (
                          <Badge variant="outline">novo contato</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={selecionadas === 0 || saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {selecionadas > 0 ? `Importar ${selecionadas} selecionado(s)` : 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
