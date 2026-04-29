import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import { SuggestionDialog } from "../components/SuggestionDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  Plus,
  Lightbulb,
  Bug,
  MessageSquare,
  Trash2,
  Loader2,
  Pencil,
} from "lucide-react";
import {
  apiClient,
  type Suggestion,
  type SuggestionStatus,
  type SuggestionType,
} from "../services/api/client";
import { useAuth } from "../contexts/AuthContext";

type StatusFilter = SuggestionStatus | "ALL";
type TypeFilter = SuggestionType | "ALL";
type ScopeFilter = "mine" | "all";

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  PENDING: "Pendente",
  IN_REVIEW: "Em análise",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluída",
  REJECTED: "Recusada",
};

const STATUS_VARIANT: Record<SuggestionStatus, string> = {
  PENDING: "bg-gray-100 text-gray-700 border-gray-300",
  IN_REVIEW: "bg-blue-50 text-blue-700 border-blue-300",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-300",
  DONE: "bg-green-50 text-green-700 border-green-300",
  REJECTED: "bg-red-50 text-red-700 border-red-300",
};

const TYPE_LABEL: Record<SuggestionType, string> = {
  IMPROVEMENT: "Melhoria",
  BUG: "Correção",
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function Suggestions() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [scope, setScope] = useState<ScopeFilter>(isAdmin ? "all" : "mine");
  const [editing, setEditing] = useState<Suggestion | null>(null);
  const [editStatus, setEditStatus] = useState<SuggestionStatus>("PENDING");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState<Suggestion | null>(null);

  const fetchSuggestions = useCallback(async () => {
    try {
      const result = await apiClient.getSuggestions({
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        type: typeFilter !== "ALL" ? typeFilter : undefined,
        scope: isAdmin ? scope : "mine",
      });
      setSuggestions(result.data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao carregar sugestões";
      toast.error(message);
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

  const openEdit = (s: Suggestion) => {
    setEditing(s);
    setEditStatus(s.status);
    setEditNotes(s.adminNotes || "");
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await apiClient.updateSuggestion(editing.id, {
        status: editStatus,
        adminNotes: editNotes.trim() || null,
      });
      toast.success("Sugestão atualizada");
      setEditing(null);
      fetchSuggestions();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao atualizar sugestão";
      toast.error(message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await apiClient.deleteSuggestion(deleting.id);
      toast.success("Sugestão removida");
      setDeleting(null);
      fetchSuggestions();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao remover sugestão";
      toast.error(message);
    }
  };

  const canDelete = (s: Suggestion) => {
    if (isAdmin) return true;
    return s.userId === user?.id && s.status === "PENDING";
  };

  const subtitle = isAdmin
    ? "Gerencie as sugestões enviadas pelos usuários"
    : "Acompanhe as sugestões que você enviou";

  return (
    <div className="min-h-screen">
      <Header title="Sugestões" subtitle={subtitle} />

      <div className="p-4 md:p-8 space-y-6">
        <div className="bg-gray-50 rounded-lg p-4 shadow-sm border border-gray-300">
          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <div className="flex gap-2">
                <Button
                  variant={scope === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScope("all")}
                >
                  Todas
                </Button>
                <Button
                  variant={scope === "mine" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScope("mine")}
                >
                  Minhas
                </Button>
              </div>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
              aria-label="Filtrar por status"
            >
              <option value="ALL">Todos os status</option>
              <option value="PENDING">Pendentes</option>
              <option value="IN_REVIEW">Em análise</option>
              <option value="IN_PROGRESS">Em andamento</option>
              <option value="DONE">Concluídas</option>
              <option value="REJECTED">Recusadas</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
              aria-label="Filtrar por tipo"
            >
              <option value="ALL">Todos os tipos</option>
              <option value="IMPROVEMENT">Melhoria</option>
              <option value="BUG">Correção</option>
            </select>

            <div className="flex-1" />

            <Button onClick={() => setCreateOpen(true)} className="whitespace-nowrap">
              <Plus size={16} className="mr-2" />
              Nova sugestão
            </Button>
          </div>

          {isAdmin && scope === "all" && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              {(Object.keys(STATUS_LABEL) as SuggestionStatus[]).map((s) => (
                <div
                  key={s}
                  className={`rounded border px-3 py-2 ${STATUS_VARIANT[s]} flex items-center justify-between`}
                >
                  <span>{STATUS_LABEL[s]}</span>
                  <strong>{counts[s]}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <PageSkeleton type="cards" />
        ) : suggestions.length === 0 ? (
          <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-300">
            <EmptyState
              icon={MessageSquare}
              title="Nenhuma sugestão encontrada"
              description={
                isAdmin && scope === "all"
                  ? "Ainda não há sugestões nesta organização."
                  : "Você ainda não enviou nenhuma sugestão. Envie uma agora!"
              }
              actionLabel="Nova sugestão"
              onAction={() => setCreateOpen(true)}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="bg-gray-50 rounded-lg p-4 shadow-sm border border-gray-300"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-base font-semibold text-gray-900">{s.title}</h3>
                      <Badge
                        variant="outline"
                        className={
                          s.type === "BUG"
                            ? "bg-red-50 text-red-700 border-red-300"
                            : "bg-amber-50 text-amber-700 border-amber-300"
                        }
                      >
                        {s.type === "BUG" ? (
                          <Bug size={12} className="mr-1" />
                        ) : (
                          <Lightbulb size={12} className="mr-1" />
                        )}
                        {TYPE_LABEL[s.type]}
                      </Badge>
                      <Badge variant="outline" className={STATUS_VARIANT[s.status]}>
                        {STATUS_LABEL[s.status]}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-line break-words">
                      {s.description}
                    </p>
                    {s.route && (
                      <p className="mt-2 text-xs text-gray-500">
                        Rota: <code className="bg-gray-100 px-1 py-0.5 rounded">{s.route}</code>
                      </p>
                    )}
                    {s.adminNotes && (
                      <div className="mt-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                        <strong>Resposta da equipe:</strong>
                        <p className="mt-1 whitespace-pre-line">{s.adminNotes}</p>
                      </div>
                    )}
                    <div className="mt-2 text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                      <span>
                        Enviada por <strong>{s.user?.name || "Usuário"}</strong>
                      </span>
                      <span>·</span>
                      <span>{formatDate(s.createdAt)}</span>
                      {s.resolvedAt && (
                        <>
                          <span>·</span>
                          <span>Resolvida em {formatDate(s.resolvedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    {isAdmin && (
                      <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                        <Pencil size={14} className="mr-1" />
                        Gerenciar
                      </Button>
                    )}
                    {canDelete(s) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleting(s)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SuggestionDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={fetchSuggestions} />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerenciar sugestão</DialogTitle>
            <DialogDescription>
              Atualize o status e adicione uma resposta para o autor.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{editing.title}</p>
                <p className="text-xs text-gray-500">
                  Por {editing.user?.name || "Usuário"} · {formatDate(editing.createdAt)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <select
                  id="edit-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as SuggestionStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                >
                  <option value="PENDING">Pendente</option>
                  <option value="IN_REVIEW">Em análise</option>
                  <option value="IN_PROGRESS">Em andamento</option>
                  <option value="DONE">Concluída</option>
                  <option value="REJECTED">Recusada</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Resposta para o usuário (opcional)</Label>
                <Textarea
                  id="edit-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={4}
                  maxLength={5000}
                  placeholder="Comentário visível ao autor da sugestão"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={savingEdit}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover sugestão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta sugestão? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
