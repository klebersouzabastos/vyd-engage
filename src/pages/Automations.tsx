import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Plus, Mail, MessageSquare, Play, Pause, Eye, Trash2, Users } from "lucide-react";
import { Switch } from "../components/ui/switch";
import { getAllAutomations, toggleAutomationStatus, deleteAutomation, type Automation } from "../utils/automations";
import { getAutomationStats, getOverallStats } from "../utils/automationLogs";

interface AutomationWithStats extends Automation {
  leadsEnrolled: number;
  sentMessages: number;
}

export function Automations() {
  const navigate = useNavigate();
  const [automationsList, setAutomationsList] = useState<AutomationWithStats[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalAutomations: 0,
    activeAutomations: 0,
    totalLeadsEnrolled: 0,
    totalSentMessages: 0,
  });

  // Carregar automações e calcular estatísticas
  useEffect(() => {
    loadAutomations();
  }, []);

  const loadAutomations = () => {
    const automations = getAllAutomations();
    
    // Calcular estatísticas para cada automação
    const automationsWithStats: AutomationWithStats[] = automations.map((auto) => {
      const stats = getAutomationStats(auto.id);
      return {
        ...auto,
        leadsEnrolled: stats.leadsEnrolled,
        sentMessages: stats.sentMessages,
      };
    });

    setAutomationsList(automationsWithStats);
    
    // Calcular estatísticas gerais (passar automações para evitar dependência circular)
    const stats = getOverallStats(automations);
    setOverallStats(stats);
  };

  const toggleStatus = (id: number) => {
    try {
      toggleAutomationStatus(id);
      loadAutomations(); // Recarregar para atualizar a lista
    } catch (error) {
      console.error("Erro ao alterar status da automação:", error);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Tem certeza que deseja deletar esta automação?")) {
      try {
        deleteAutomation(id);
        loadAutomations(); // Recarregar para atualizar a lista
      } catch (error) {
        console.error("Erro ao deletar automação:", error);
        alert("Erro ao deletar automação. Tente novamente.");
      }
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Automações" subtitle="Configure e gerencie seus fluxos automáticos" />
      
      <div className="p-8">
        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => navigate("/app/automations/logs")}
            >
              <Eye size={16} />
              Ver Logs
            </Button>
          </div>

          <Button 
            className="bg-[#2563EB] hover:bg-[#1E40AF] gap-2"
            onClick={() => navigate("/app/automations/new")}
          >
            <Plus size={16} />
            Nova Automação
          </Button>
        </div>

        {/* Automations Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {automationsList.map((automation) => (
            <div
              key={automation.id}
              className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="p-6 border-b border-[#E5E7EB]">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center
                      ${automation.type === "whatsapp" 
                        ? "bg-green-100 text-green-600" 
                        : "bg-blue-100 text-blue-600"
                      }
                    `}>
                      {automation.type === "whatsapp" ? (
                        <MessageSquare size={20} />
                      ) : (
                        <Mail size={20} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-[#1F2937] font-medium">{automation.name}</h3>
                      <p className="text-sm text-[#6B7280]">
                        {automation.steps} etapas
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={automation.status === "active"}
                    onCheckedChange={() => toggleStatus(automation.id)}
                  />
                </div>

                <span className={`
                  inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                  ${automation.status === "active" 
                    ? "bg-green-100 text-green-700" 
                    : "bg-gray-100 text-gray-700"
                  }
                `}>
                  {automation.status === "active" ? (
                    <>
                      <Play size={12} />
                      Ativo
                    </>
                  ) : (
                    <>
                      <Pause size={12} />
                      Pausado
                    </>
                  )}
                </span>
              </div>

              {/* Stats */}
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-[#6B7280] mb-1">Leads Inscritos</p>
                    <p className="text-xl font-semibold text-[#1F2937]">
                      {automation.leadsEnrolled}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-[#6B7280] mb-1">Mensagens Enviadas</p>
                    <p className="text-xl font-semibold text-[#1F2937]">
                      {automation.sentMessages}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-[#E5E7EB]">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => navigate(`/app/automations/${automation.id}`)}
                  >
                    Ver Detalhes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[#DC2626] hover:text-[#DC2626] hover:bg-red-50"
                    onClick={() => handleDelete(automation.id)}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="mt-8 bg-white rounded-lg p-6 shadow-sm border border-[#E5E7EB]">
          <h3 className="text-[#1F2937] mb-4">Visão Geral</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-[#6B7280] mb-1">Total de Automações</p>
              <p className="text-2xl font-semibold text-[#1F2937]">{overallStats.totalAutomations}</p>
            </div>
            <div>
              <p className="text-sm text-[#6B7280] mb-1">Automações Ativas</p>
              <p className="text-2xl font-semibold text-[#16A34A]">
                {overallStats.activeAutomations}
              </p>
            </div>
            <div>
              <p className="text-sm text-[#6B7280] mb-1">Leads Inscritos</p>
              <p className="text-2xl font-semibold text-[#1F2937]">
                {overallStats.totalLeadsEnrolled}
              </p>
            </div>
            <div>
              <p className="text-sm text-[#6B7280] mb-1">Mensagens Enviadas</p>
              <p className="text-2xl font-semibold text-[#2563EB]">
                {overallStats.totalSentMessages}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
