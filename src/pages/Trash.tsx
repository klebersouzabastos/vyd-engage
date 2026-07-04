// Upgrade RD parity — P1 · F2 Lixeira (spec upgrade-rd-parity.md, req 16).
//
// Página "Lixeira" (rota /app/trash, gated MANAGER_ROLES): abas por entidade com
// tabela de registros soft-deletados (nome, excluído por/quando), ações Restaurar e
// Excluir definitivo (confirmação). Consome apiClient.{getTrash,restoreTrash,purgeTrash}.
//
// Observação de contrato: o backend responde a lista como
//   { items: [{ id, entity, label, deletedAt, deletedBy: {id,name,email}|null, deletedByAt }],
//     pagination: { page, limit, total, totalPages } }
// (o tipo TrashListResult do client é uma aproximação). Tipamos aqui a forma REAL de
// runtime e a consumimos defensivamente, sem depender do shape aproximado.

import { useState, useEffect, useCallback } from 'react';
import { Trash2, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, ApiError } from '../services/api/client';
import type { TrashEntity } from '../types/governance';

// Forma REAL de runtime devolvida por GET /trash (ver nota no topo do arquivo).
interface TrashRow {
  id: string;
  entity: TrashEntity;
  label: string;
  deletedAt: string;
  deletedBy?: { id: string; name: string | null; email: string } | null;
  deletedByAt?: string | null;
}
interface TrashResponse {
  items: TrashRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const ENTITY_TABS: { value: TrashEntity; label: string }[] = [
  { value: 'leads', label: 'Leads' },
  { value: 'companies', label: 'Empresas' },
  { value: 'deals', label: 'Negociações' },
  { value: 'tasks', label: 'Tarefas' },
  { value: 'empreendimentos', label: 'Empreendimentos' },
  { value: 'roadmaps', label: 'Roadmaps' },
];

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export function Trash() {
  const { user } = useAuth();
  // ADMIN pode expurgar (purge); ADMIN/GESTOR podem restaurar/listar. A rota já é
  // gated MANAGER_ROLES no router; aqui só decidimos exibir o botão de expurgo.
  const isAdmin = user?.role === 'ADMIN' || !!user?.isPlatformAdmin;

  const [entity, setEntity] = useState<TrashEntity>('leads');
  const [rows, setRows] = useState<TrashRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<TrashRow | null>(null);

  const load = useCallback(
    async (ent: TrashEntity, pg: number) => {
      setLoading(true);
      try {
        const res = await apiClient.getTrash(ent, pg);
        const data = res.data as unknown as TrashResponse;
        setRows(data.items ?? []);
        setTotalPages(data.pagination?.totalPages ?? 1);
        setTotal(data.pagination?.total ?? 0);
      } catch (error) {
        const msg = error instanceof ApiError ? error.message : 'Erro ao carregar a lixeira.';
        toast.error(msg);
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(entity, page);
  }, [entity, page, load]);

  const handleTabChange = (value: string) => {
    setEntity(value as TrashEntity);
    setPage(1);
  };

  const handleRestore = async (row: TrashRow) => {
    setBusyId(row.id);
    try {
      await apiClient.restoreTrash(row.entity, row.id);
      toast.success('Registro restaurado com sucesso.');
      await load(entity, page);
    } catch (error) {
      // Restaurar filho de pai excluído → 400 com mensagem clara (req 16).
      const msg =
        error instanceof ApiError ? error.message : 'Não foi possível restaurar o registro.';
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    const row = purgeTarget;
    setBusyId(row.id);
    try {
      await apiClient.purgeTrash(row.entity, row.id);
      toast.success('Registro excluído definitivamente.');
      setPurgeTarget(null);
      await load(entity, page);
    } catch (error) {
      const msg =
        error instanceof ApiError ? error.message : 'Não foi possível excluir definitivamente.';
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Lixeira"
        subtitle="Registros excluídos podem ser restaurados ou removidos definitivamente."
      />

      <div className="px-4 md:px-8 py-6">
        <Tabs value={entity} onValueChange={handleTabChange}>
          <TabsList className="flex-wrap h-auto">
            {ENTITY_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {ENTITY_TABS.map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-4">
              <div className="rounded-md border border-border bg-card">
                {loading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="animate-spin" size={20} />
                    <span className="ml-2 text-sm">Carregando…</span>
                  </div>
                ) : rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <Trash2 className="text-muted-foreground mb-3" size={32} />
                    <p className="text-foreground font-medium">A lixeira está vazia</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      Nenhum registro de {t.label.toLowerCase()} foi excluído.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Excluído por</TableHead>
                        <TableHead>Excluído em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium text-foreground">
                            {row.label || '(sem nome)'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.deletedBy?.name || row.deletedBy?.email || '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDateTime(row.deletedByAt || row.deletedAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                disabled={busyId === row.id}
                                onClick={() => handleRestore(row)}
                              >
                                {busyId === row.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <RotateCcw size={14} />
                                )}
                                Restaurar
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="gap-1"
                                  disabled={busyId === row.id}
                                  onClick={() => setPurgeTarget(row)}
                                >
                                  <Trash2 size={14} />
                                  Excluir definitivo
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {!loading && total > 0 && (
                <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                  <span>
                    {total} registro{total > 1 ? 's' : ''} na lixeira
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <span>
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <AlertDialog open={!!purgeTarget} onOpenChange={(open) => !open && setPurgeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-destructive" size={18} />
              Excluir definitivamente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O registro
              {purgeTarget?.label ? ` "${purgeTarget.label}"` : ''} será removido de forma
              permanente e não poderá mais ser restaurado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busyId === purgeTarget?.id}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handlePurge();
              }}
              disabled={busyId === purgeTarget?.id}
              className="bg-destructive text-primary-foreground hover:bg-destructive/90"
            >
              {busyId === purgeTarget?.id ? 'Excluindo…' : 'Excluir definitivo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
