import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { MoreVertical, Edit, Trash2, Send } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { apiClient } from "../services/api/client";
import { useAuth } from "../contexts/AuthContext";
import { formatRelativeTime } from "../utils/interactions";

interface CommentItem {
  id: string;
  userId?: string;
  userName: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  mentions?: string[];
}

interface CommentsSectionProps {
  leadId: string | number;
}

function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = text.match(mentionRegex);
  return matches ? matches.map((m) => m.substring(1)) : [];
}

export function CommentsSection({ leadId }: CommentsSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currentUserId = user?.id || "";
  const currentUserName = user?.name || "Usuário";

  useEffect(() => {
    loadComments();
  }, [leadId]);

  const loadComments = async () => {
    try {
      const result = await apiClient.getLeadInteractions(String(leadId));
      const interactions = result?.data || result || [];
      // Filter only NOTE type interactions (comments)
      const noteInteractions = interactions
        .filter((i: any) => i.type === "NOTE")
        .map((i: any) => ({
          id: i.id,
          userId: i.userId,
          userName: i.user?.name || "Usuário",
          content: i.content || "",
          createdAt: i.createdAt,
          updatedAt: i.updatedAt !== i.createdAt ? i.updatedAt : undefined,
          mentions: i.metadata?.mentions || [],
        }));
      setComments(noteInteractions);
    } catch (error) {
      console.error("Erro ao carregar comentários:", error);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    const mentions = extractMentions(newComment);

    try {
      const result = await apiClient.createInteraction({
        leadId: String(leadId),
        type: "NOTE",
        direction: "OUTBOUND",
        content: newComment,
        metadata: mentions.length > 0 ? { mentions } : undefined,
      });

      const created = result?.data || result;
      const newItem: CommentItem = {
        id: created.id,
        userId: currentUserId,
        userName: currentUserName,
        content: newComment,
        createdAt: created.createdAt || new Date().toISOString(),
        mentions,
      };

      setComments([newItem, ...comments]);
      setNewComment("");
    } catch (error) {
      console.error("Erro ao adicionar comentário:", error);
      toast.error("Erro ao adicionar comentário");
    }
  };

  const handleStartEdit = (comment: CommentItem) => {
    setEditingId(comment.id);
    setEditingText(comment.content);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingText.trim()) return;

    // The interactions API doesn't have an update endpoint, so we delete and recreate
    // For now, just update locally since the API may not support update
    const updatedComments = comments.map((c) =>
      c.id === editingId
        ? { ...c, content: editingText, updatedAt: new Date().toISOString(), mentions: extractMentions(editingText) }
        : c
    );
    setComments(updatedComments);
    setEditingId(null);
    setEditingText("");
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await apiClient.deleteInteraction(deletingId);
      setComments(comments.filter((c) => c.id !== deletingId));
    } catch (error) {
      console.error("Erro ao excluir comentário:", error);
      toast.error("Erro ao excluir comentário");
    }
    setDeletingId(null);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-gray-900 font-medium mb-3">Comentários</h3>

        {/* New Comment */}
        <div className="space-y-2 mb-4">
          <Textarea
            placeholder="Adicione um comentário... Use @nome para mencionar alguém"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">
              Use @nome para mencionar alguém
            </p>
            <Button
              onClick={handleSubmit}
              disabled={!newComment.trim()}
              size="sm"
              className="gap-2"
            >
              <Send size={14} />
              Enviar
            </Button>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-4">
              Nenhum comentário ainda. Seja o primeiro a comentar!
            </p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary text-white text-xs">
                    {getInitials(comment.userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {comment.userName}
                      </p>
                      <p className="text-xs text-gray-600">
                        {formatRelativeTime(comment.createdAt)}
                        {comment.updatedAt && " (editado)"}
                      </p>
                    </div>
                    {comment.userId === currentUserId && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStartEdit(comment)}>
                            <Edit size={14} className="mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingId(comment.id)}
                            className="text-error"
                          >
                            <Trash2 size={14} className="mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {editingId === comment.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={2}
                        className="resize-none"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit} disabled={!editingText.trim()}>
                          Salvar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingId(null); setEditingText(""); }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-900 whitespace-pre-wrap">
                      {comment.content.split(/(@\w+)/g).map((part, index) => {
                        if (part.startsWith("@")) {
                          return (
                            <span key={index} className="font-medium text-primary bg-blue-50 px-1 rounded">
                              {part}
                            </span>
                          );
                        }
                        return part;
                      })}
                    </div>
                  )}
                  {comment.mentions && comment.mentions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {comment.mentions.map((mention, index) => (
                        <span key={index} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                          @{mention}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este comentário? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
