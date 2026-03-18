import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Header } from "../components/Header";
import { Input } from "../components/ui/input";
import { CheckCircle, XCircle, Clock, ArrowLeft, Loader2, BarChart3, TrendingUp, AlertTriangle, ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { apiClient } from "../services/api/client";
import { useSocket } from "../hooks/useSocket";
import { toast } from "sonner";

const PAGE_SIZE = 50;

interface LogEntry {
  id: string;
  automationId: string;
  automationName?: string;
  leadId?: string;
  leadName?: string;
  stepOrder?: number;
  stepType?: string;
  status: string;
  message?: string;
  errorMessage?: string;
  executionId?: string;
  executedAt: string;
  automation?: { id: string; name: string };
  lead?: { id: string; name: string; email?: string };
}

interface Stats {
  total: number;
  successCount: number;
  errorCount: number;
  skippedCount: number;
  successRate: number;
  perAutomation: { automationId: string; automationName: string; count: number }[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function normalizeLog(raw: any): LogEntry {
  return {
    id: raw.id,
    automationId: raw.automationId,
    automationName: raw.automation?.name || raw.automationName || "—",
    leadId: raw.leadId,
    leadName: raw.lead?.name || raw.leadName || "—",
    stepOrder: raw.stepOrder ?? 0,
    stepType: raw.stepType || "—",
    status: raw.status,
    message: raw.message,
    errorMessage: raw.error || raw.errorMessage,
    executionId: raw.executionId,
    executedAt: raw.executedAt || raw.createdAt,
    automation: raw.automation,
    lead: raw.lead,
  };
}

export function AutomationLogs() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { on } = useSocket();

  // Pre-apply filters from URL query params (e.g., from notification links)
  const urlAutomationId = searchParams.get("automationId") || "";
  const urlStatus = searchParams.get("status") || "";

  // Data state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
  const [automations, setAutomations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter state (initialized from URL params)
  const [filterStatus, setFilterStatus] = useState(urlStatus);
  const [filterAutomation, setFilterAutomation] = useState(urlAutomationId);
  const [filterLead, setFilterLead] = useState("");
  const [page, setPage] = useState(1);

  // Tab state
  const [activeTab, setActiveTab] = useState<"logs" | "metrics">("logs");

  // Execution view
  const [executionLogs, setExecutionLogs] = useState<LogEntry[] | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [executionLoading, setExecutionLoading] = useState(false);

  // Load automations list for filter dropdown (once)
  useEffect(() => {
    apiClient.getAutomations().then((result: any) => {
      const rawData = result?.data || result;
      const list = Array.isArray(rawData) ? rawData : rawData?.automations || [];
      setAutomations(list.map((a: any) => ({ id: a.id, name: a.name })));
    }).catch(() => {});
  }, []);

  // Load stats (once, lightweight)
  useEffect(() => {
    setStatsLoading(true);
    apiClient.getAutomationLogStats().then((result: any) => {
      setStats(result?.data || result);
    }).catch(() => {}).finally(() => setStatsLoading(false));
  }, []);

  // WebSocket: listen for new automation logs in real-time
  useEffect(() => {
    const cleanup = on("automation:log:new", (raw: any) => {
      const log = normalizeLog(raw);

      // Only prepend if compatible with current filters
      const matchesAutomation = !filterAutomation || log.automationId === filterAutomation;
      const matchesStatus = !filterStatus || log.status === filterStatus;

      if (matchesAutomation && matchesStatus && page === 1) {
        setLogs((prev) => {
          // Deduplicate by id
          if (prev.some((l) => l.id === log.id)) return prev;
          return [log, ...prev];
        });
      }

      toast.info("Nova execução registrada", {
        description: `${log.automationName} — ${log.status === "ERROR" ? "Erro" : "Sucesso"}`,
        duration: 4000,
      });
    });

    return cleanup;
  }, [on, filterAutomation, filterStatus, page]);

  // Load logs with server-side filters and pagination
  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const filters: any = { page, limit: PAGE_SIZE, sort: "desc" };
      if (filterStatus) filters.status = filterStatus;
      if (filterAutomation) filters.automationId = filterAutomation;

      const result = await apiClient.getAutomationLogsAll(filters);
      const data = result?.data || [];
      setLogs(data.map(normalizeLog));
      setPagination(result?.pagination || { page, limit: PAGE_SIZE, total: 0, totalPages: 0 });
    } catch (error) {
      console.error("Erro ao carregar logs:", error);
    } finally {
      setLoading(false);
    }
  }, [page, filterStatus, filterAutomation]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterAutomation]);

  // Client-side lead name filter (applied on already-fetched page)
  const filteredLogs = useMemo(() => {
    if (!filterLead) return logs;
    return logs.filter((log) =>
      log.leadName?.toLowerCase().includes(filterLead.toLowerCase())
    );
  }, [logs, filterLead]);

  // Open execution view
  const openExecution = async (execId: string) => {
    setExecutionLoading(true);
    setExecutionId(execId);
    try {
      const result = await apiClient.getLogsByExecution(execId);
      const data = result?.data || [];
      setExecutionLogs(data.map(normalizeLog));
    } catch {
      setExecutionLogs([]);
    } finally {
      setExecutionLoading(false);
    }
  };

  const closeExecution = () => {
    setExecutionId(null);
    setExecutionLogs(null);
  };

  // Daily execution chart data (last 14 days) — derived from fetched logs
  // Note: for accurate chart, we'd need a dedicated endpoint; using stats perAutomation for metrics tab
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
      const day = days.find((d) => d.date === dateStr);
      if (day) {
        day.total++;
        if (log.status === "SUCCESS") day.success++;
        else if (log.status === "ERROR") day.error++;
      }
    }
    return days;
  }, [logs]);

  const maxDailyTotal = Math.max(1, ...dailyData.map((d) => d.total));

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

  // Per-automation metrics from stats endpoint
  const automationMetrics = useMemo(() => {
    if (!stats?.perAutomation) return [];
    return stats.perAutomation.sort((a, b) => b.count - a.count);
  }, [stats]);

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
            <p className="text-2xl font-semibold text-gray-900">{statsLoading ? "…" : stats?.total ?? 0}</p>
          </div>
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Sucesso</p>
            <p className="text-2xl font-semibold text-success">{statsLoading ? "…" : stats?.successCount ?? 0}</p>
          </div>
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Erros</p>
            <p className="text-2xl font-semibold text-error">{statsLoading ? "…" : stats?.errorCount ?? 0}</p>
          </div>
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Pulados</p>
            <p className="text-2xl font-semibold text-warning">{statsLoading ? "…" : stats?.skippedCount ?? 0}</p>
          </div>
          <div className="bg-white rounded-lg p-5 shadow-sm border border-gray-300">
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp size={14} className="text-gray-500" />
              <p className="text-sm text-gray-600">Taxa de Sucesso</p>
            </div>
            <p className={`text-2xl font-semibold ${(stats?.successRate ?? 0) >= 80 ? "text-success" : (stats?.successRate ?? 0) >= 50 ? "text-warning" : "text-error"}`}>
              {statsLoading ? "…" : `${stats?.successRate ?? 0}%`}
            </p>
          </div>
        </div>

        {/* Execution Detail Modal */}
        {executionId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-300">
                <div>
                  <h3 className="font-medium text-gray-900">Detalhes da Execução</h3>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono">{executionId}</p>
                </div>
                <button onClick={closeExecution} className="p-1 hover:bg-gray-100 rounded">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-6">
                {executionLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : !executionLogs || executionLogs.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Nenhum step encontrado.</p>
                ) : (
                  <div className="space-y-3">
                    {executionLogs.map((log, i) => (
                      <div key={log.id} className="flex gap-3 items-start">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${log.status === "SUCCESS" ? "bg-green-100 text-green-700" : log.status === "ERROR" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"}`}>
                            {i + 1}
                          </div>
                          {i < executionLogs.length - 1 && <div className="w-px h-6 bg-gray-200 mt-1" />}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900">{log.stepType || "Step"}</span>
                            {getStatusBadge(log.status)}
                          </div>
                          {log.message && <p className="text-sm text-gray-600 mt-1">{log.message}</p>}
                          {log.errorMessage && <p className="text-sm text-red-600 mt-1">{log.errorMessage}</p>}
                          <p className="text-xs text-gray-400 mt-1">{new Date(log.executedAt).toLocaleString("pt-BR")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {loading && !stats ? (
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
                    <div className="w-full flex flex-col-reverse h-[120px]">
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
                      {day.total === 0 && <div className="w-full bg-gray-100 rounded-t-sm h-1" />}
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
                  automationMetrics.map((m) => {
                    const rate = stats!.total > 0 ? Math.round((m.count / stats!.total) * 100) : 0;
                    return (
                      <div key={m.automationId} className="px-6 py-4 flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{m.automationName}</p>
                          <p className="text-sm text-gray-500">{m.count} execuções</p>
                        </div>
                        <div className="w-20">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-500"
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700">{rate}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Logs Table */
          <>
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
                            <option value="">Todas</option>
                            {automations.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        </div>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase hidden md:table-cell">Detalhes</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">
                        <div className="flex flex-col gap-2">
                          <span>Status</span>
                          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-8 px-2 text-xs border border-gray-300 rounded-md bg-white w-full">
                            <option value="">Todos</option>
                            <option value="SUCCESS">Sucesso</option>
                            <option value="ERROR">Erro</option>
                            <option value="SKIPPED">Pulado</option>
                            <option value="PENDING">Pendente</option>
                          </select>
                        </div>
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase hidden lg:table-cell">Data/Hora</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase hidden lg:table-cell">Execução</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
                        </td>
                      </tr>
                    ) : filteredLogs.length === 0 ? (
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
                          <td className="px-6 py-4 hidden lg:table-cell">
                            {log.executionId ? (
                              <button
                                onClick={() => openExecution(log.executionId!)}
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                                title="Ver detalhes da execução"
                              >
                                <Eye size={14} />
                                <span className="font-mono">{log.executionId.slice(0, 8)}</span>
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200">
                  <p className="text-sm text-gray-500">
                    Página {pagination.page} de {pagination.totalPages} ({pagination.total} logs)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={14} /> Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima <ChevronRight size={14} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
