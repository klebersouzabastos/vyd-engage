import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
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
import { Comment } from "../types";
import { getLeadComments, addComment, updateComment, deleteComment, extractMentions } from "../utils/comments";
import { formatRelativeTime } from "../utils/interactions";
import { useNotifications } from "../contexts/NotificationContext";

interface CommentsSectionProps {
  leadId: number;
}

export function CommentsSection({ leadId }: CommentsSectionProps) {
  const { addNotification } = useNotifications();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setComments(getLeadComments(leadId));
  }, [leadId]);

  const handleSubmit = () => {
    if (!newComment.trim()) return;

    const mentions = extractMentions(newComment);
    const userProfile = JSON.parse(localStorage.getItem("userProfile") || '{"name": "Usuário", "id": "current-user"}');

    const comment = addComment(leadId, {
      userId: userProfile.id || "current-user",
      userName: userProfile.name || "Usuário",
      content: newComment,
      mentions,
    });

    setComments([comment, ...comments]);
    setNewComment("");

    // Criar notificações para usuários mencionados
    mentions.forEach((mention) => {
      addNotification({
        type: "interaction",
        title: "Você foi mencionado",
        message: `${userProfile.name} mencionou você em um comentário`,
        link: `/app/leads`,
      });
    });
  };

  const handleStartEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditingText(comment.content);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editingText.trim()) return;

    const updated = updateComment(leadId, editingId, {
      content: editingText,
      mentions: extractMentions(editingText),
    });

    if (updated) {
      setComments(comments.map((c) => (c.id === editingId ? updated : c)));
    }

    setEditingId(null);
    setEditingText("");
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteComment(leadId, deletingId);
    setComments(comments.filter((c) => c.id !== deletingId));
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

  const userProfile = JSON.parse(localStorage.getItem("userProfile") || '{"name": "Usuário", "id": "current-user"}');
  const currentUserId = userProfile.id || "current-user";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[#1F2937] font-medium mb-3">Comentários</h3>
        
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
            <p className="text-xs text-[#6B7280]">
              Pressione Enter para enviar, Shift+Enter para nova linha
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
            <p className="text-sm text-[#6B7280] text-center py-4">
              Nenhum comentário ainda. Seja o primeiro a comentar!
            </p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="bg-[#2563EB] text-white text-xs">
                    {getInitials(comment.userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="text-sm font-medium text-[#1F2937]">
                        {comment.userName}
                      </p>
                      <p className="text-xs text-[#6B7280]">
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
                            className="text-[#DC2626]"
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
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={!editingText.trim()}
                        >
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(null);
                            setEditingText("");
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-[#1F2937] whitespace-pre-wrap">
                      {comment.content.split(/(@\w+)/g).map((part, index) => {
                        if (part.startsWith("@")) {
                          return (
                            <span
                              key={index}
                              className="font-medium text-[#2563EB] bg-blue-50 px-1 rounded"
                            >
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
                        <span
                          key={index}
                          className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded"
                        >
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
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}







