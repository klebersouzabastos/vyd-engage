import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Input } from "../components/ui/input";
import { CheckCircle, XCircle, Clock, ArrowLeft, Loader2, BarChart3, TrendingUp, AlertTriangle } from "lucide-react";
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
  message?: string;
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
  const [activeTab, setActiveTab] = useState<"logs" | "metrics">("logs");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const automationsResult = await apiClient.getAutomations();
      const rawData = automationsResult?.data || automationsResult;
      const automationsList = Array.isArray(rawData) ? rawData : rawData?.automations || [];
      setAutomations(automationsList);

      const allLogs: LogEntry[] = [];
      for (const automation of automationsList.slice(0, 20)) {
        try {
          const logsResult = await apiClient.getAutomationLogs(automation.id, 100);
          const automationLogs = logsResult?.data || logsResult || [];
          for (const log of automationLogs) {
            allLogs.push({
              id: log.id,
              automationId: automation.id,
              automationName: automation.name,
              leadId: log.leadId,
              leadName: log.lead?.name || log.leadName || "—",
              stepOrder: log.stepOrder ?? 0,
              stepType: log.stepType || log.data?.stepType || "send_whatsapp",
              status: log.status,
              message: log.message,
              errorMessage: log.error || log.errorMessage,
              executedAt: log.executedAt || log.createdAt,
            });
          }
        } catch {
          // Skip individual failures
        }
      }

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

  const stats = useMemo(() => {
    const total = logs.length;
    const success = logs.filter(l => l.status === "SUCCESS").length;
    const error = logs.filter(l => l.status === "ERROR").length;
    const skipped = logs.filter(l => l.status === "SKIPPED").length;
    const pending = logs.filter(l => l.status === "PENDING" || l.status === "RUNNING").length;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0;
    return { total, success, error, skipped, pending, successRate };
  }, [logs]);

  // Per-automation metrics
  const automationMetrics = useMemo(() => {
    const map = new Map<string, { name: string; total: number; success: number; error: number; skipped: number }>();
    for (const log of logs) {
      if (!map.has(log.automationId)) {
        map.set(log.automationId, { name: log.automationName, total: 0, success: 0, error: 0, skipped: 0 });
      }
      const m = map.get(log.automationId)!;
      m.total++;
      if (log.status === "SUCCESS") m.success++;
      else if (log.status === "ERROR") m.error++;
      else if (log.status === "SKIPPED") m.skipped++;
    }
    return Array.from(map.entries())
      .map(([id, m]) => ({ id, ...m, successRate: m.total > 0 ? Math.round((m.success / m.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [logs]);

  // Daily execution chart data (last 14 days)
  const dailyData = useMemo(() => {
    const days: { date: string; label: string; success: number; error: number; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      days.push({
        date: dateStr,
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        success: 0,
        error: 0,
        total: 0,
      });
    }

    for (const log of logs) {
      const dateStr = new Date(log.executedAt).toISOString().split("T")[0];
      const day = days.find(d => d.date === dateStr);
      if (day) {
        day.total++;
        if (log.status === "SUCCESS") day.success++;
        else if (log.status === "ERROR") day.error++;
      }
    }

    return days;
  }, [logs]);

  const maxDailyTotal = Math.max(1, ...dailyData.map(d => d.total));

  const getStatusIcon = (status: string) => {
    if (status === "SUCCESS") return <CheckCircle size={16} className="text-success" />;
    if (status === "ERROR") return <XCircle size={16} className="text-error" />;
    if (status === "SKIPPED") return <AlertTriangle size={16} className="text-yellow-500" />;
    return <Clock size={16} className="text-warning" />;
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      SUCCESS: { label: "Sucesso", className: "bg-green-100 text-green-700" },
      ERROR: { label: "Erro", className: "bg-red-100 text-red-700" },
      SKIPPED: { label: "Pulado", className: "bg-yellow-100 text-yellow-700" },
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

  return (
    <div className="min-h-screen">
      <Header title="Logs de Automação" subtitle="Histórico de execuções e métricas" />

      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" className="gap-2" onClick={() => navigate("/app/automations")}>
            <ArrowLeft size={16} /> Voltar para Automações
          </Button>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("logs")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "logs" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Logs
            </button>
            <button
              onClick={() => setActiveTab("metrics")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "metrics" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <BarChart3 size={14} className="inline mr-1" />
              Métricas
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Total</p>
            <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Sucesso</p>
            <p className="text-2xl font-semibold text-success">{stats.success}</p>
          </div>
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Erros</p>
            <p className="text-2xl font-semibold text-error">{stats.error}</p>
          </div>
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Pendentes</p>
            <p className="text-2xl font-semibold text-warning">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-300">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp size={14} className="text-gray-500" />
              <p className="text-sm text-gray-600">Taxa de Sucesso</p>
            </div>
            <p className={`text-2xl font-semibold ${stats.successRate >= 80 ? "text-success" : stats.successRate >= 50 ? "text-warning" : "text-error"}`}>
              {stats.successRate}%
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : activeTab === "metrics" ? (
          <div className="space-y-6">
            {/* Daily Chart */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
              <h3 className="text-gray-900 font-medium mb-4">Execuções por Dia (últimos 14 dias)</h3>
              <div className="flex items-end gap-1.5 h-40">
                {dailyData.map((day) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col-reverse" style={{ height: "120px" }}>
                      {day.total > 0 && (
                        <>
                          <div
                            className="w-full bg-green-400 rounded-t-sm"
                            style={{ height: `${(day.success / maxDailyTotal) * 120}px` }}
                            title={`${day.success} sucesso`}
                          />
                          {day.error > 0 && (
                            <div
                              className="w-full bg-red-400"
                              style={{ height: `${(day.error / maxDailyTotal) * 120}px` }}
                              title={`${day.error} erros`}
                            />
                          )}
                        </>
                      )}
                      {day.total === 0 && <div className="w-full bg-gray-100 rounded-t-sm" style={{ height: "4px" }} />}
                    </div>
                    <span className="text-[10px] text-gray-500">{day.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-green-400" />
                  <span className="text-xs text-gray-500">Sucesso</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-sm bg-red-400" />
                  <span className="text-xs text-gray-500">Erro</span>
                </div>
              </div>
            </div>

            {/* Per-automation metrics */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-300">
              <div className="px-6 py-4 border-b border-gray-300">
                <h3 className="text-gray-900 font-medium">Métricas por Automação</h3>
              </div>
              <div className="divide-y divide-gray-200">
                {automationMetrics.length === 0 ? (
                  <div className="px-6 py-8 text-center text-gray-500">Nenhuma automação com logs.</div>
                ) : (
                  automationMetrics.map((m) => (
                    <div key={m.id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{m.name}</p>
                        <p className="text-sm text-gray-500">{m.total} execuções</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-sm font-medium text-green-600">{m.success}</p>
                          <p className="text-xs text-gray-500">Sucesso</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-red-600">{m.error}</p>
                          <p className="text-xs text-gray-500">Erros</p>
                        </div>
                        <div className="w-20">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${m.successRate >= 80 ? "bg-green-500" : m.successRate >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                                style={{ width: `${m.successRate}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700">{m.successRate}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Logs Table */
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
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase hidden md:table-cell">Detalhes</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                      <div className="flex flex-col gap-2">
                        <span>Status</span>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-8 px-2 text-xs border border-gray-300 rounded-md bg-white w-full">
                          <option value="all">Todos</option>
                          <option value="SUCCESS">Sucesso</option>
                          <option value="ERROR">Erro</option>
                          <option value="SKIPPED">Pulado</option>
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
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        Nenhum log encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.slice(0, 200).map((log) => (
                      <tr key={log.id} className="hover:bg-gray-100 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{log.leadName}</p>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{log.automationName}</td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <p className="text-sm text-gray-600 truncate max-w-xs">{log.message || "—"}</p>
                          {log.errorMessage && <p className="text-xs text-error mt-1 truncate max-w-xs">{log.errorMessage}</p>}
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
            {filteredLogs.length > 200 && (
              <div className="px-6 py-3 text-sm text-gray-500 text-center border-t border-gray-200">
                Exibindo 200 de {filteredLogs.length} logs
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
