import { useState, useEffect, type FormEvent } from "react";
import { useLocation } from "react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Lightbulb, Bug, Loader2 } from "lucide-react";
import { apiClient, type SuggestionType } from "../services/api/client";

interface SuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function SuggestionDialog({ open, onOpenChange, onCreated }: SuggestionDialogProps) {
  const location = useLocation();
  const [type, setType] = useState<SuggestionType>("IMPROVEMENT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [route, setRoute] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setRoute(`${location.pathname}${location.search}`);
    }
  }, [open, location.pathname, location.search]);

  const reset = () => {
    setType("IMPROVEMENT");
    setTitle("");
    setDescription("");
    setRoute("");
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) {
      toast.error("O título precisa ter pelo menos 3 caracteres");
      return;
    }
    if (description.trim().length < 5) {
      toast.error("A descrição precisa ter pelo menos 5 caracteres");
      return;
    }

    setSaving(true);
    try {
      await apiClient.createSuggestion({
        title: title.trim(),
        description: description.trim(),
        route: route.trim() || null,
        type,
      });
      toast.success("Sugestão enviada — obrigado pelo feedback!");
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao enviar sugestão";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar sugestão</DialogTitle>
          <DialogDescription>
            Descreva uma melhoria ou problema. A equipe revisa todas as sugestões enviadas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("IMPROVEMENT")}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  type === "IMPROVEMENT"
                    ? "border-primary bg-primary text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Lightbulb size={16} />
                Melhoria
              </button>
              <button
                type="button"
                onClick={() => setType("BUG")}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  type === "BUG"
                    ? "border-red-600 bg-red-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Bug size={16} />
                Correção
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="suggestion-title">Título</Label>
            <Input
              id="suggestion-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Resumo da sugestão"
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="suggestion-route">Rota afetada</Label>
            <Input
              id="suggestion-route"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              placeholder="/app/leads"
              maxLength={500}
            />
            <p className="text-xs text-gray-500">
              Pré-preenchida com a página atual. Edite se a sugestão for para outra área.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="suggestion-description">Descrição</Label>
            <Textarea
              id="suggestion-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhe o que gostaria de ver melhorado ou o problema encontrado"
              rows={5}
              maxLength={5000}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar sugestão"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
