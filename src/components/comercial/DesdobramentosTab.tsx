import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Plus, GitBranch, Building2, AlertTriangle, BookOpen, Trash2 } from 'lucide-react';
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
import { useAuth } from '../../contexts/AuthContext';
import { useRoadmaps, useRoadmapActions } from '../../hooks/useComercial';
import { ROADMAP_STATUS_LABELS, type CommercialRoadmapStatus } from '../../types/comercial';
import { RoadmapCreateDialog } from './RoadmapCreateDialog';
import { PlaybooksManager } from './PlaybooksManager';

const STATUS_VARIANT: Record<
  CommercialRoadmapStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  PLANEJAMENTO: 'secondary',
  EM_ANDAMENTO: 'default',
  PROPOSTA: 'default',
  GANHO: 'default',
  PERDIDO: 'destructive',
  ARQUIVADO: 'outline',
};

export function DesdobramentosTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const listQuery = useRoadmaps();
  const { deleteRoadmap } = useRoadmapActions();
  const roadmaps = listQuery.data?.items ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [playbooksOpen, setPlaybooksOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">
          Desdobramentos
          {roadmaps.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-400">{roadmaps.length}</span>
          )}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/app/deep-research/painel')}>
            <AlertTriangle className="mr-1 h-4 w-4" />
            Painel
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setPlaybooksOpen(true)}>
              <BookOpen className="mr-1 h-4 w-4" />
              Playbooks
            </Button>
          )}
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Novo desdobramento
          </Button>
        </div>
      </div>

      {listQuery.isLoading ? (
        <p className="py-12 text-center text-sm text-slate-500">Carregando…</p>
      ) : roadmaps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <GitBranch className="h-10 w-10 text-slate-300" />
          <p className="mt-3 font-medium text-slate-900">Nenhum desdobramento ainda</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Transforme uma empresa ou empreendimento em uma rota de ações comerciais até a proposta.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Novo desdobramento
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {roadmaps.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
            >
              <button
                type="button"
                onClick={() => navigate(`/app/deep-research/desdobramento/${r.id}`)}
                className="group flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <GitBranch className="h-5 w-5 shrink-0 text-slate-400" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900 group-hover:text-primary">
                    {r.title}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Building2 className="h-3 w-3" />
                    {r.company.name}
                    {r.empreendimento ? ` · ${r.empreendimento.name}` : ''}
                    {` · ${r._count.tasks} ações · ${r._count.stakeholders} contatos`}
                  </p>
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant={STATUS_VARIANT[r.status]}>{ROADMAP_STATUS_LABELS[r.status]}</Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir"
                  onClick={() => setDeleteTarget({ id: r.id, title: r.title })}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <RoadmapCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(rm) => navigate(`/app/deep-research/desdobramento/${rm.id}`)}
      />

      {isAdmin && <PlaybooksManager open={playbooksOpen} onOpenChange={setPlaybooksOpen} />}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir desdobramento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `“${deleteTarget.title}” será removido. As ações (tarefas) permanecem na agenda.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (deleteTarget) await deleteRoadmap(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
