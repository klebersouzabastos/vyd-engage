import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Lightbulb, Bug, MessageSquare, Trash2, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { PageSkeleton } from '../components/PageSkeleton';
import { EmptyState } from '../components/EmptyState';
import { SuggestionDialog } from '../components/SuggestionDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
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
import { apiClient, Suggestion, SuggestionStatus, SuggestionType } from '../services/api/client';

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  PENDING: 'Pendente',
  IN_REVIEW: 'Em análise',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluída',
  REJECTED: 'Recusada',
};

const STATUS_CLS: Record<SuggestionStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700 border-gray-200',
  IN_REVIEW: 'bg-blue-50 text-blue-600 border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border-amber-200',
  DONE: 'bg-green-50 text-green-600 border-green-200',
  REJECTED: 'bg-red-50 text-red-600 border-red-200',
};

const TYPE_LABEL: Record<SuggestionType, string> = { IMPROVEMENT: 'Melhoria', BUG: 'Correção' };
const TYPE_CLS: Record<SuggestionType, string> = {
  IMPROVEMENT: 'bg-amber-50 text-amber-700 border-amber-200',
  BUG: 'bg-red-50 text-red-600 border-red-200',
};

const STATUS_ORDER: SuggestionStatus[] = [
  'PENDING',
  'IN_REVIEW',
  'IN_PROGRESS',
  'DONE',
  'REJECTED',
];

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${className}`}
    >
      {children}
    </span>
  );
}

export function Suggestions() {
  const { user } = useAuth();
  const isAdmin = !!user?.isPlatformAdmin;

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | SuggestionStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | SuggestionType>('ALL');
  const [scope, setScope] = useState<'all' | 'mine'>(isAdmin ? 'all' : 'mine');

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Suggestion | null>(null);
  const [editStatus, setEditStatus] = useState<SuggestionStatus>('PENDING');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState<Suggestion | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.getSuggestions({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        scope: isAdmin ? scope : 'mine',
      });
      setSuggestions(result.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar sugestões');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, scope, isAdmin]);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const counts = useMemo(() => {
    const acc: Record<SuggestionStatus, number> = {
      PENDING: 0,
      IN_REVIEW: 0,
      IN_PROGRESS: 0,
      DONE: 0,
      REJECTED: 0,
    };
    suggestions.forEach((s) => {
      acc[s.status] += 1;
    });
    return acc;
  }, [suggestions]);

  const canDelete = (s: Suggestion) => isAdmin || (s.userId === user?.id && s.status === 'PENDING');

  const openEdit = (s: Suggestion) => {
    setEditing(s);
    setEditStatus(s.status);
    setEditNotes(s.adminNotes || '');
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await apiClient.updateSuggestion(editing.id, {
        status: editStatus,
        adminNotes: editNotes.trim() || null,
      });
      toast.success('Sugestão atualizada');
      setEditing(null);
      fetchSuggestions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar sugestão');
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await apiClient.deleteSuggestion(deleting.id);
      toast.success('Sugestão removida');
      setDeleting(null);
      fetchSuggestions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover sugestão');
    } finally {
      setDeletingBusy(false);
    }
  };

  const showCounts = isAdmin && scope === 'all';

  return (
    <div className="min-h-screen">
      <Header
        title="Sugestões"
        subtitle={
          isAdmin
            ? 'Gerencie as sugestões enviadas pelos usuários'
            : 'Acompanhe as sugestões que você enviou'
        }
      />

      <div className="p-8">
        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <div className="flex items-center gap-1 rounded-lg border border-gray-300 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    scope === 'all' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setScope('mine')}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    scope === 'mine' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Minhas
                </button>
              </div>
            )}

            <select
              aria-label="Filtrar por status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | SuggestionStatus)}
              className="rounded-lg border border-gray-300 bg-card px-3 py-2 text-sm text-gray-700"
            >
              <option value="ALL">Todos os status</option>
              <option value="PENDING">Pendentes</option>
              <option value="IN_REVIEW">Em análise</option>
              <option value="IN_PROGRESS">Em andamento</option>
              <option value="DONE">Concluídas</option>
              <option value="REJECTED">Recusadas</option>
            </select>

            <select
              aria-label="Filtrar por tipo"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'ALL' | SuggestionType)}
              className="rounded-lg border border-gray-300 bg-card px-3 py-2 text-sm text-gray-700"
            >
              <option value="ALL">Todos os tipos</option>
              <option value="IMPROVEMENT">Melhoria</option>
              <option value="BUG">Correção</option>
            </select>
          </div>

          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus size={16} />
            Nova sugestão
          </Button>
        </div>

        {/* Status counts (admin + scope=all) */}
        {showCounts && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {STATUS_ORDER.map((st) => (
              <div key={st} className="rounded-lg border border-gray-300 bg-card p-4 shadow-sm">
                <p className="text-xs text-gray-500">{STATUS_LABEL[st]}</p>
                <p className="text-2xl font-semibold text-gray-900">{counts[st]}</p>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <PageSkeleton type="cards" />
        ) : suggestions.length === 0 ? (
          <div className="rounded-lg border border-gray-300 bg-card">
            <EmptyState
              icon={MessageSquare}
              title="Nenhuma sugestão encontrada"
              description={
                showCounts
                  ? 'Ainda não há sugestões nesta organização.'
                  : 'Você ainda não enviou nenhuma sugestão. Envie uma agora!'
              }
              actionLabel="Nova sugestão"
              onAction={() => setCreateOpen(true)}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div key={s.id} className="rounded-lg border border-gray-300 bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{s.title}</h3>
                      <Badge className={TYPE_CLS[s.type]}>
                        {s.type === 'BUG' ? <Bug size={12} /> : <Lightbulb size={12} />}
                        {TYPE_LABEL[s.type]}
                      </Badge>
                      <Badge className={STATUS_CLS[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                    </div>

                    <p className="whitespace-pre-line text-sm text-gray-600">{s.description}</p>

                    {s.route && (
                      <p className="mt-2 text-xs text-gray-500">
                        Rota: <code className="rounded bg-gray-100 px-1 py-0.5">{s.route}</code>
                      </p>
                    )}

                    {s.adminNotes && (
                      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-gray-700">
                        <strong>Resposta da equipe:</strong>
                        <p className="whitespace-pre-line">{s.adminNotes}</p>
                      </div>
                    )}

                    <div className="mt-3 text-xs text-gray-500">
                      Enviada por <span className="font-medium">{s.user?.name || 'Usuário'}</span>
                      {' · '}
                      {formatDate(s.createdAt)}
                      {s.resolvedAt && (
                        <>
                          {' '}
                          {' · '}Resolvida em {formatDate(s.resolvedAt)}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-2">
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => openEdit(s)}
                      >
                        <Pencil size={14} />
                        Gerenciar
                      </Button>
                    )}
                    {canDelete(s) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        aria-label="Remover sugestão"
                        onClick={() => setDeleting(s)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Nova sugestão */}
      <SuggestionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchSuggestions}
      />

      {/* Gerenciar (admin) */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar sugestão</DialogTitle>
            <DialogDescription>
              Atualize o status e adicione uma resposta para o autor.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-gray-900">{editing.title}</p>
                <p className="text-xs text-gray-500">
                  Enviada por {editing.user?.name || 'Usuário'} · {formatDate(editing.createdAt)}
                </p>
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <select
                  id="edit-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as SuggestionStatus)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-card px-3 py-2 text-sm text-gray-700"
                >
                  {STATUS_ORDER.map((st) => (
                    <option key={st} value={st}>
                      {STATUS_LABEL[st]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="edit-notes">Resposta para o usuário (opcional)</Label>
                <Textarea
                  id="edit-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  maxLength={5000}
                  rows={4}
                  placeholder="Comentário visível ao autor da sugestão"
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={savingEdit}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit} className="gap-2">
              {savingEdit ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remover (confirmação) */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover sugestão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta sugestão? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deletingBusy}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
