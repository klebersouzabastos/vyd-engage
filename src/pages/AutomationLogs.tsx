import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Input } from "../components/ui/input";
import { CheckCircle, XCircle, Clock, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { apiClient } from "../services/api/client";

interface LogEntry {
  id: string;
  automationId: string;
  automationName: string;
  leadId?: string;
  leadName?: string;
  stepOrder: number;
  stepType: string;
  status: string;
  errorMessage?: string;
  executedAt: string;
}

export function AutomationLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLead, setFilterLead] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [automations, setAutomations] = useState<any[]>([]);
  const [filterAutomation, setFilterAutomation] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load all automations to get their logs
      const automationsResult = await apiClient.getAutomations();
      const automationsList = automationsResult?.data || automationsResult || [];
      setAutomations(automationsList);

      // Load logs for all automations
      const allLogs: LogEntry[] = [];
      for (const automation of automationsList.slice(0, 20)) {
        try {
          const logsResult = await apiClient.getAutomationLogs(automation.id, 50);
          const automationLogs = logsResult?.data || logsResult || [];
          for (const log of automationLogs) {
            allLogs.push({
              id: log.id,
              automationId: automation.id,
              automationName: automation.name,
              leadId: log.leadId,
              leadName: log.lead?.name || log.leadName || "—",
              stepOrder: log.stepOrder ?? 0,
              stepType: log.stepType || "send_whatsapp",
              status: log.status,
              errorMessage: log.errorMessage,
              executedAt: log.executedAt || log.createdAt,
            });
          }
        } catch {
          // Skip individual failures
        }
      }

      // Sort by date descending
      allLogs.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
      setLogs(allLogs);
    } catch (error) {
      console.error("Erro ao carregar logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterLead && !log.leadName?.toLowerCase().includes(filterLead.toLowerCase())) return false;
    if (filterStatus !== "all" && log.status !== filterStatus) return false;
    if (filterAutomation !== "all" && log.automationId !== filterAutomation) return false;
    return true;
  });

  const getStatusIcon = (status: string) => {
    if (status === "SUCCESS") return <CheckCircle size={16} className="text-success" />;
    if (status === "ERROR") return <XCircle size={16} className="text-error" />;
    return <Clock size={16} className="text-warning" />;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      SUCCESS: { label: "Enviado", className: "bg-green-100 text-green-700" },
      ERROR: { label: "Erro", className: "bg-red-100 text-red-700" },
      PENDING: { label: "Pendente", className: "bg-yellow-100 text-yellow-700" },
      RUNNING: { label: "Executando", className: "bg-blue-100 text-blue-700" },
    };
    const c = config[status] || { label: status, className: "bg-gray-100 text-gray-700" };
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
        {getStatusIcon(status)}
        {c.label}
      </span>
    );
  };

  const getChannelLabel = (type: string) => {
    if (type.includes("email")) return "E-mail";
    if (type.includes("whatsapp")) return "WhatsApp";
    return type;
  };

  const stats = {
    total: logs.length,
    success: logs.filter(l => l.status === "SUCCESS").length,
    error: logs.filter(l => l.status === "ERROR").length,
    pending: logs.filter(l => l.status === "PENDING" || l.status === "RUNNING").length,
  };

  return (
    <div className="min-h-screen">
      <Header title="Logs de Automação" subtitle="Histórico de mensagens enviadas" />

      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" className="gap-2" onClick={() => navigate("/app/automations")}>
            <ArrowLeft size={16} /> Voltar para Automações
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Total</p>
            <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Enviados</p>
            <p className="text-2xl font-semibold text-success">{stats.success}</p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Erros</p>
            <p className="text-2xl font-semibold text-error">{stats.error}</p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Pendentes</p>
            <p className="text-2xl font-semibold text-warning">{stats.pending}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Logs de automação">
                <thead className="bg-gray-100 border-b border-gray-300">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                      <div className="flex flex-col gap-2">
                        <span>Lead</span>
                        <Input placeholder="Filtrar lead..." value={filterLead} onChange={(e) => setFilterLead(e.target.value)} className="h-8 text-xs" />
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                      <div className="flex flex-col gap-2">
                        <span>Automação</span>
                        <select value={filterAutomation} onChange={(e) => setFilterAutomation(e.target.value)} className="h-8 px-2 text-xs border border-gray-300 rounded-md bg-white w-full">
                          <option value="all">Todas</option>
                          {automations.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase hidden md:table-cell">Step</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase hidden md:table-cell">Canal</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                      <div className="flex flex-col gap-2">
                        <span>Status</span>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-8 px-2 text-xs border border-gray-300 rounded-md bg-white w-full">
                          <option value="all">Todos</option>
                          <option value="SUCCESS">Enviado</option>
                          <option value="ERROR">Erro</option>
                          <option value="PENDING">Pendente</option>
                        </select>
                      </div>
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase hidden lg:table-cell">Data/Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        Nenhum log encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-100 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{log.leadName}</p>
                          {log.errorMessage && <p className="text-xs text-error mt-1">{log.errorMessage}</p>}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{log.automationName}</td>
                        <td className="px-6 py-4 text-gray-600 hidden md:table-cell">Step {log.stepOrder + 1}</td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${log.stepType.includes("email") ? "bg-blue-50 text-blue-600" : "bg-green-50 text-green-600"}`}>
                            {getChannelLabel(log.stepType)}
                          </span>
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(log.status)}</td>
                        <td className="px-6 py-4 text-gray-600 hidden lg:table-cell">
                          {new Date(log.executedAt).toLocaleString("pt-BR")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
