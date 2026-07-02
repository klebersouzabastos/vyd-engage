import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, Clock, GitBranch, ArrowLeft, Building2 } from 'lucide-react';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { apiClient } from '../services/api/client';
import { useRoadmapPanel } from '../hooks/useComercial';
import { TASK_TYPE_LABELS, type PanelTask, type AtRiskRoadmap } from '../types/comercial';

const ALL = '__all__';

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—';
}

function TaskRow({ t, onOpen, danger }: { t: PanelTask; onOpen: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{t.title}</p>
        <p className="truncate text-xs text-gray-500">
          {t.roadmap?.title ? `${t.roadmap.title} · ` : ''}
          {t.type ? TASK_TYPE_LABELS[t.type] : 'Ação'}
        </p>
      </div>
      <span
        className={`shrink-0 text-xs ${danger ? 'font-medium text-red-600' : 'text-gray-500'}`}
      >
        {fmtDate(t.dueDate)}
      </span>
    </button>
  );
}

export function RoadmapPanelView() {
  const navigate = useNavigate();
  const [assignedTo, setAssignedTo] = useState<string>(ALL);

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => apiClient.getUsers() });
  const users = usersQuery.data ?? [];

  const panelQuery = useRoadmapPanel(assignedTo === ALL ? undefined : { assignedTo });
  const panel = panelQuery.data;

  const openRoadmap = (roadmapId?: string) => {
    if (roadmapId) navigate(`/app/deep-research/desdobramento/${roadmapId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50/60">
      <Header
        title="Não deixar passar"
        subtitle="Próximas ações, atrasadas e desdobramentos em risco"
      />

      <div className="space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={() => navigate('/app/deep-research')}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar
          </Button>
          <div style={{ width: 224 }}>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os vendedores</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {panelQuery.isLoading ? (
          <p className="py-12 text-center text-sm text-gray-500">Carregando…</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Próximas ações */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                <CalendarClock className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-base">Próximas ações</CardTitle>
                <Badge variant="secondary" className="ml-auto">
                  {panel?.upcoming.length ?? 0}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {panel && panel.upcoming.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {panel.upcoming.map((t) => (
                      <TaskRow key={t.id} t={t} onOpen={() => openRoadmap(t.roadmap?.id)} />
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-gray-500">Nada agendado.</p>
                )}
              </CardContent>
            </Card>

            {/* Ações atrasadas */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                <Clock className="h-4 w-4 text-red-600" />
                <CardTitle className="text-base">Atrasadas</CardTitle>
                <Badge variant="destructive" className="ml-auto">
                  {panel?.overdue.length ?? 0}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {panel && panel.overdue.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {panel.overdue.map((t) => (
                      <TaskRow key={t.id} t={t} danger onOpen={() => openRoadmap(t.roadmap?.id)} />
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-gray-500">
                    Nenhuma ação atrasada.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Desdobramentos em risco */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <CardTitle className="text-base">Em risco</CardTitle>
                <Badge variant="secondary" className="ml-auto">
                  {panel?.atRisk.length ?? 0}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {panel && panel.atRisk.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {panel.atRisk.map((r: AtRiskRoadmap) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => openRoadmap(r.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">{r.title}</p>
                          <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                            <Building2 className="h-3 w-3" />
                            {r.company.name}
                            {r.empreendimento ? ` · ${r.empreendimento.name}` : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {r.overdueCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {r.overdueCount} atrasada{r.overdueCount > 1 ? 's' : ''}
                            </Badge>
                          )}
                          <p className="mt-0.5 text-xs text-gray-400">
                            últ. {r.lastActivityAt ? fmtDate(r.lastActivityAt) : 'sem atividade'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    <GitBranch className="mx-auto mb-2 h-6 w-6 text-gray-300" />
                    Nenhum desdobramento em risco.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
