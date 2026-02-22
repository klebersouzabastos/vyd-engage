import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Task } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (task: Omit<Task, "id" | "createdAt" | "completedAt" | "updatedAt">) => void;
  task?: Task;
  leadId?: number;
}

export function TaskModal({
  open,
  onClose,
  onSave,
  task,
  leadId,
}: TaskModalProps) {
  const [formData, setFormData] = useState({
    leadId: task?.leadId || leadId || 0,
    title: task?.title || "",
    description: task?.description || "",
    dueDate: task && task.dueDate
      ? new Date(task.dueDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    dueTime: task && task.dueDate
      ? new Date(task.dueDate).toTimeString().slice(0, 5)
      : "09:00",
    priority: task?.priority || "medium" as Task["priority"],
  });

  useEffect(() => {
    if (task) {
      const dueDate = task.dueDate ? new Date(task.dueDate) : new Date();
      setFormData({
        leadId: task.leadId || 0,
        title: task.title,
        description: task.description || "",
        dueDate: dueDate.toISOString().split("T")[0],
        dueTime: dueDate.toTimeString().slice(0, 5),
        priority: task.priority,
      });
    } else if (leadId) {
      setFormData((prev) => ({ ...prev, leadId }));
    }
  }, [task, leadId, open]);

  const handleSave = () => {
    if (!formData.title.trim()) {
      toast.error("O título da tarefa é obrigatório");
      return;
    }

    if (!formData.leadId) {
      toast.error("É necessário vincular a tarefa a um lead");
      return;
    }

    const dueDateTime = new Date(`${formData.dueDate}T${formData.dueTime}`);
    
    onSave({
      leadId: formData.leadId,
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      dueDate: dueDateTime.toISOString(),
      priority: formData.priority,
      status: task?.status || 'PENDING',
    });

    handleClose();
  };

  const handleClose = () => {
    setFormData({
      leadId: leadId || 0,
      title: "",
      description: "",
      dueDate: new Date().toISOString().split("T")[0],
      dueTime: "09:00",
      priority: "medium",
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[75vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{task ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
          <div>
            <Label htmlFor="task-title">Título *</Label>
            <Input
              id="task-title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Ligar para o cliente amanhã"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="task-description">Descrição</Label>
            <Textarea
              id="task-description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Detalhes adicionais sobre a tarefa..."
              rows={3}
              className="mt-1.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="task-date">Data de Vencimento *</Label>
              <Input
                id="task-date"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="task-time">Hora</Label>
              <Input
                id="task-time"
                type="time"
                value={formData.dueTime}
                onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="task-priority">Prioridade</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) =>
                setFormData({ ...formData, priority: value as Task["priority"] })
              }
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 border-t border-gray-300 pt-4 mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary-dark">
            {task ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

