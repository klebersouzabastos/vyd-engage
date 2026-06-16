import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Plus, Mail, MessageSquare, Play, Pause, Eye, Trash2, Loader2, Zap, Pencil } from "lucide-react";
import { Switch } from "../components/ui/switch";
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
import { apiClient } from "../services/api/client";
import { toast } from "sonner";

interface AutomationItem {
  id: string;
  name: string;
  description?: string;
  status: "ACTIVE" | "PAUSED" | "DRAFT";
  trigger: any;
  steps: any[];
  runsCount: number;
  successCount: number;
  errorCount: number;
  lastRunAt?: string;
  createdAt: string;
}

export function Automations() {
  const navigate = useNavigate();
  const [automationsList, setAutomationsList] = useState<AutomationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [automationToDelete, setAutomationToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadAutomations();
  }, []);

  const loadAutomations = async () => {
    try {
      const result = await apiClient.getAutomations();
      const rawData = result?.data || result;
      // API returns { automations, pagination } or flat array
      const list = Array.isArray(rawData) ? rawData : rawData?.automations || [];
      setAutomationsList(list);
    } catch (error) {
      console.error("Erro ao carregar automações:", error);
      toast.error("Erro ao carregar automações");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (automation: AutomationItem) => {
    const newStatus = automation.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      await apiClient.updateAutomation(automation.id, { status: newStatus });
      setAutomationsList((prev) =>
        prev.map((a) => (a.id === automation.id ? { ...a, status: newStatus } : a))
      );
      toast.success(`Automação ${newStatus === "ACTIVE" ? "ativada" : "pausada"}`);
    } catch (error) {
      toast.error("Erro ao alterar status");
    }
  };

  const confirmDelete = (id: string) => {
    setAutomationToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!automationToDelete) return;
    try {
      await apiClient.deleteAutomation(automationToDelete);
      setAutomationsList((prev) => prev.filter((a) => a.id !== automationToDelete));
      toast.success("Automação deletada");
    } catch (error) {
      toast.error("Erro ao deletar automação");
    } finally {
      setDeleteDialogOpen(false);
      setAutomationToDelete(null);
    }
  };

  const getStepType = (automation: AutomationItem): "whatsapp" | "email" | "mixed" => {
    const types = new Set((automation.steps || []).map((s: any) => s.type));
    if (types.has("send_whatsapp") && !types.has("send_email")) return "whatsapp";
    if (types.has("send_email") && !types.has("send_whatsapp")) return "email";
    return "mixed";
  };

  const activeCount = automationsList.filter((a) => a.status === "ACTIVE").length;
  const totalRuns = automationsList.reduce((sum, a) => sum + (a.runsCount || 0), 0);
  const totalSuccess = automationsList.reduce((sum, a) => sum + (a.successCount || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Automações" subtitle="Configure e gerencie seus fluxos automáticos" />
        <div className="flex items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title="Automações" subtitle="Configure e gerencie seus fluxos automáticos" />

      <div className="p-8">
        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" className="gap-2" onClick={() => navigate("/app/automations/logs")}>
            <Eye size={16} /> Ver Logs
          </Button>
          <div className="flex items-center gap-2">
            <Button
              className="bg-primary hover:bg-primary-dark gap-2"
              onClick={() => navigate("/app/automations/new/builder")}
            >
              <Plus size={16} />
              Nova automação
            </Button>
          </div>
        </div>

        {/* Empty State */}
        {automationsList.length === 0 ? (
          <div className="text-center py-16">
            <Zap className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma automação criada</h3>
            <p className="text-gray-500 mb-4">Crie sua primeira automação para automatizar tarefas</p>
            <div className="flex items-center gap-3 justify-center">
              <Button onClick={() => navigate("/app/automations/new/builder")}>
                <Plus size={16} className="mr-1" />
                Nova automação
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Automations Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {automationsList.map((automation) => {
                const type = getStepType(automation);
                const successRate = automation.runsCount > 0
                  ? Math.round((automation.successCount / automation.runsCount) * 100)
                  : 0;

                return (
                  <div
                    key={automation.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="p-6 border-b border-gray-300">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`
                            w-10 h-10 rounded-lg flex items-center justify-center
                            ${type === "whatsapp"
                              ? "bg-green-100 text-green-600"
                              : type === "email"
                              ? "bg-blue-100 text-blue-600"
                              : "bg-purple-100 text-purple-600"
                            }
                          `}>
                            {type === "whatsapp" ? (
                              <MessageSquare size={20} />
                            ) : type === "email" ? (
                              <Mail size={20} />
                            ) : (
                              <Zap size={20} />
                            )}
                          </div>
                          <div>
                            <h3 className="text-gray-900 font-medium">{automation.name}</h3>
                            <p className="text-sm text-gray-600">
                              {(automation.steps || []).length} etapa(s)
                              {automation.trigger?.type && ` | ${automation.trigger.type}`}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={automation.status === "ACTIVE"}
                          onCheckedChange={() => toggleStatus(automation)}
                        />
                      </div>

                      <span className={`
                        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                        ${automation.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                        }
                      `}>
                        {automation.status === "ACTIVE" ? (
                          <>
                            <Play size={12} />
                            Ativo
                          </>
                        ) : (
                          <>
                            <Pause size={12} />
                            {automation.status === "DRAFT" ? "Rascunho" : "Pausado"}
                          </>
                        )}
                      </span>
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Execuções</p>
                          <p className="text-xl font-semibold text-gray-900">
                            {automation.runsCount || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Sucesso</p>
                          <p className="text-xl font-semibold text-green-600">
                            {successRate}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Erros</p>
                          <p className="text-xl font-semibold text-red-600">
                            {automation.errorCount || 0}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-4 border-t border-gray-300">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-1"
                          onClick={() => navigate(`/app/automations/${automation.id}/builder`)}
                        >
                          <Pencil size={14} />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => confirmDelete(automation.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary Stats */}
            <div className="mt-8 bg-white rounded-lg p-6 shadow-sm border border-gray-300">
              <h3 className="text-gray-900 mb-4">Visão Geral</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total de Automações</p>
                  <p className="text-2xl font-semibold text-gray-900">{automationsList.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Automações Ativas</p>
                  <p className="text-2xl font-semibold text-green-600">{activeCount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total de Execuções</p>
                  <p className="text-2xl font-semibold text-gray-900">{totalRuns}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Execuções com Sucesso</p>
                  <p className="text-2xl font-semibold text-blue-600">{totalSuccess}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Automação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta automação? Esta ação não pode ser desfeita.
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
