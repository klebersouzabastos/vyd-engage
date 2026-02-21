import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Input } from "../components/ui/input";
import { Filter, Download, CheckCircle, XCircle, Clock, ArrowLeft } from "lucide-react";
import { Button } from "../components/ui/button";
import { useCompany } from "../contexts/CompanyContext";
import { exportAutomationLogsToExcel } from "../utils/excelExport";
import { getAllLogs, type AutomationLog } from "../utils/automationLogs";
import { getAllAutomations } from "../utils/automations";

export function AutomationLogs() {
  const navigate = useNavigate();
  const { logo, companyName } = useCompany();
  const [logsData, setLogsData] = useState<AutomationLog[]>([]);
  const [filterLead, setFilterLead] = useState("");
  const [filterAutomation, setFilterAutomation] = useState("all");
  const [filterStep, setFilterStep] = useState("all");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  // Carregar logs do localStorage
  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = () => {
    const logs = getAllLogs();
    setLogsData(logs);
  };

  // Obter lista única de automações dos logs
  const uniqueAutomations = Array.from(new Set(logsData.map(log => log.automation)));

  const filteredLogs = logsData.filter((log) => {
    const matchesLead = !filterLead || log.lead.toLowerCase().includes(filterLead.toLowerCase());
    const matchesAutomation = filterAutomation === "all" || log.automation === filterAutomation;
    const matchesStep = filterStep === "all" || log.step.toString() === filterStep;
    const matchesChannel = filterChannel === "all" || log.channel === filterChannel;
    const matchesStatus = filterStatus === "all" || log.status === filterStatus;
    const matchesDate = !filterDate || log.datetime.includes(filterDate);
    
    return matchesLead && matchesAutomation && matchesStep && matchesChannel && matchesStatus && matchesDate;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle size={16} className="text-success" />;
      case "error":
        return <XCircle size={16} className="text-error" />;
      case "pending":
        return <Clock size={16} className="text-warning" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      sent: { label: "Enviado", className: "bg-green-100 text-green-700" },
      error: { label: "Erro", className: "bg-red-100 text-red-700" },
      pending: { label: "Pendente", className: "bg-yellow-100 text-yellow-700" },
    };
    
    const statusConfig = config[status as keyof typeof config];
    
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.className}`}>
        {getStatusIcon(status)}
        {statusConfig.label}
      </span>
    );
  };

  const getStatusLabel = (status: string) => {
    const config = {
      sent: "Enviado",
      error: "Erro",
      pending: "Pendente",
    };
    return config[status as keyof typeof config] || status;
  };

  const getChannelLabel = (channel: string) => {
    return channel === "whatsapp" ? "WhatsApp" : "E-mail";
  };

  const handleExport = async () => {
    try {
      // Converter AutomationLog para o formato esperado pelo export
      const logsForExport = filteredLogs.map(log => ({
        id: log.id,
        lead: log.lead,
        automation: log.automation,
        step: log.step,
        channel: log.channel,
        status: log.status,
        datetime: log.datetime,
        errorMessage: log.errorMessage,
      }));
      await exportAutomationLogsToExcel(logsForExport);
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      alert('Erro ao exportar relatório. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Logs de Automação" subtitle="Histórico de mensagens enviadas" />
      
      <div className="p-8">
        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => navigate("/app/automations")}
          >
            <ArrowLeft size={16} />
            Voltar para Automações
          </Button>
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <Download size={16} />
            Exportar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Total</p>
            <p className="text-2xl font-semibold text-gray-900">{logsData.length}</p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Enviados</p>
            <p className="text-2xl font-semibold text-success">
              {logsData.filter(l => l.status === "sent").length}
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Erros</p>
            <p className="text-2xl font-semibold text-error">
              {logsData.filter(l => l.status === "error").length}
            </p>
          </div>
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300">
            <p className="text-sm text-gray-600 mb-1">Pendentes</p>
            <p className="text-2xl font-semibold text-warning">
              {logsData.filter(l => l.status === "pending").length}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Logs de automação">
              <thead className="bg-gray-100 border-b border-gray-300">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    <div className="flex flex-col gap-2">
                      <span>Lead</span>
                      <Input
                        placeholder="Filtrar lead..."
                        value={filterLead}
                        onChange={(e) => setFilterLead(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    <div className="flex flex-col gap-2">
                      <span>Automação</span>
                      <select
                        value={filterAutomation}
                        onChange={(e) => setFilterAutomation(e.target.value)}
                        className="h-8 px-2 text-xs border border-gray-300 rounded-md bg-white w-full"
                      >
                        <option value="all">Todas</option>
                        {uniqueAutomations.map((automation) => (
                          <option key={automation} value={automation}>
                            {automation}
                          </option>
                        ))}
                      </select>
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden md:table-cell">
                    <div className="flex flex-col gap-2">
                      <span>Step</span>
                      <select
                        value={filterStep}
                        onChange={(e) => setFilterStep(e.target.value)}
                        className="h-8 px-2 text-xs border border-gray-300 rounded-md bg-white w-full"
                      >
                        <option value="all">Todos</option>
                        <option value="1">Step 1</option>
                        <option value="2">Step 2</option>
                        <option value="3">Step 3</option>
                      </select>
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden md:table-cell">
                    <div className="flex flex-col gap-2">
                      <span>Canal</span>
                      <select
                        value={filterChannel}
                        onChange={(e) => setFilterChannel(e.target.value)}
                        className="h-8 px-2 text-xs border border-gray-300 rounded-md bg-white w-full"
                      >
                        <option value="all">Todos</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">E-mail</option>
                      </select>
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    <div className="flex flex-col gap-2">
                      <span>Status</span>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="h-8 px-2 text-xs border border-gray-300 rounded-md bg-white w-full"
                      >
                        <option value="all">Todos</option>
                        <option value="sent">Enviado</option>
                        <option value="error">Erro</option>
                        <option value="pending">Pendente</option>
                      </select>
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider hidden lg:table-cell">
                    <div className="flex flex-col gap-2">
                      <span>Data/Hora</span>
                      <Input
                        placeholder="Filtrar data..."
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-100 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{log.lead}</p>
                      {log.errorMessage && (
                        <p className="text-xs text-error mt-1">{log.errorMessage}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{log.automation}</td>
                    <td className="px-6 py-4 text-gray-600 hidden md:table-cell">Step {log.step}</td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <span className={`
                        inline-flex items-center px-2 py-1 rounded text-xs
                        ${log.channel === "whatsapp"
                          ? "bg-green-50 text-green-600"
                          : "bg-blue-50 text-blue-600"
                        }
                      `}>
                        {log.channel === "whatsapp" ? "WhatsApp" : "E-mail"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="px-6 py-4 text-gray-600 hidden lg:table-cell">{log.datetime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
