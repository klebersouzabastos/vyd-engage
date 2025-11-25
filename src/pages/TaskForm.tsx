import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Task } from "../types";
import { useTasks } from "../hooks/useTasks";
import { useLeads } from "../hooks/useLeads";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export function TaskForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const leadIdParam = searchParams.get("leadId");
  const { tasks, createTask, updateTask, fetchTasks } = useTasks();
  const { leads } = useLeads();
  
  const [task, setTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState({
    leadId: leadIdParam || "",
    title: "",
    description: "",
    dueDate: new Date().toISOString().split("T")[0],
    dueTime: "09:00",
    priority: "medium" as Task["priority"],
  });

  useEffect(() => {
    if (id) {
      const foundTask = tasks.find(t => t.id === id);
      if (foundTask) {
        setTask(foundTask);
        const dueDate = foundTask.dueDate ? new Date(foundTask.dueDate) : new Date();
        setFormData({
          leadId: foundTask.leadId?.toString() || "",
          title: foundTask.title,
          description: foundTask.description || "",
          dueDate: dueDate.toISOString().split("T")[0],
          dueTime: dueDate.toTimeString().slice(0, 5),
          priority: foundTask.priority,
        });
      }
    } else if (leadIdParam) {
      setFormData((prev) => ({ ...prev, leadId: leadIdParam }));
    }
  }, [id, leadIdParam, tasks]);

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error("O título da tarefa é obrigatório");
      return;
    }

    if (!formData.leadId) {
      toast.error("É necessário vincular a tarefa a um lead");
      return;
    }

    const dueDateTime = new Date(`${formData.dueDate}T${formData.dueTime}`);
    
    try {
      if (task) {
        await updateTask(task.id, {
          leadId: formData.leadId,
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          dueDate: dueDateTime.toISOString(),
          priority: formData.priority,
          status: task.status,
        });
      } else {
        await createTask({
          leadId: formData.leadId,
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          dueDate: dueDateTime.toISOString(),
          priority: formData.priority,
          status: 'PENDING',
        });
      }
      navigate("/app/tasks");
    } catch (error) {
      console.error("Erro ao salvar tarefa:", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <Header 
        title={task ? "Editar Tarefa" : "Nova Tarefa"} 
        subtitle={task ? `Editando: ${task.title}` : "Preencha os dados da nova tarefa"}
      />
      
      <div className="p-8 overflow-visible">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate("/app/tasks")}
            className="gap-2"
          >
            <ArrowLeft size={16} />
            Voltar para Tarefas
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] max-w-2xl relative overflow-visible">
          <div className="p-6 border-b border-[#E5E7EB]">
            <h2 className="text-xl font-semibold text-[#1F2937]">
              {task ? "Editar Tarefa" : "Nova Tarefa"}
            </h2>
          </div>

          <div className="p-6 space-y-6 overflow-visible">
            <div className="relative overflow-visible">
              <Label htmlFor="task-lead">Lead *</Label>
              <Select
                value={formData.leadId || undefined}
                onValueChange={(value) =>
                  setFormData({ ...formData, leadId: value })
                }
              >
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValue placeholder="Selecione um lead" />
                </SelectTrigger>
                <SelectContent className="z-[9999] bg-white border-2 border-[#2563EB] shadow-lg max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-gray-400">
                  {leads.length > 0 ? (
                    leads.map((lead: any) => (
                      <SelectItem key={lead.id} value={lead.id.toString()}>
                        {lead.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-leads" disabled>
                      Nenhum lead disponível
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

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

            <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB] mt-6">
              <Button variant="outline" type="button" onClick={() => navigate("/app/tasks")}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="bg-[#2563EB] hover:bg-[#1E40AF]">
                {task ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

