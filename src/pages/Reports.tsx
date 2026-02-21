import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Plus, FileText, Calendar, Mail, Download, Trash2, Edit, Search, Grid3x3, List, X, Zap } from "lucide-react";
import { Report, ReportSchedule } from "../types";
import { ReportWizard } from "../components/ReportWizard";
import { createReportFromTemplate } from "../utils/reportTemplates";

const getReports = (): Report[] => {
  try {
    const stored = localStorage.getItem("reports");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Erro ao carregar relatórios:", error);
  }
  return [];
};

const saveReports = (reports: Report[]) => {
  localStorage.setItem("reports", JSON.stringify(reports));
};

type ViewMode = "grid" | "list";
type SortOption = "name" | "date" | "type" | "updated";

export function Reports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>(getReports());
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("updated");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    const loadedReports = getReports();
    
    // Se não houver relatórios, criar alguns de exemplo (apenas para demonstração)
    if (loadedReports.length === 0) {
      // Opcional: descomente a linha abaixo para criar relatórios de exemplo automaticamente
      // import { createSampleReports } from "../utils/sampleReports";
      // createSampleReports();
      // setReports(getReports());
    } else {
      setReports(loadedReports);
    }
  }, []);

  const handleDelete = (id: string) => {
    if (window.confirm("Tem certeza que deseja excluir este relatório?")) {
      const updated = reports.filter((r) => r.id !== id);
      setReports(updated);
      saveReports(updated);
    }
  };

  const handleRun = (report: Report) => {
    // Abrir visualização do relatório
    navigate(`/app/reports/view/${report.id}`);
  };

  const handleQuickCreate = () => {
    // Criar relatório rápido usando template padrão
    const defaultTemplate = "executive-dashboard";
    const report = createReportFromTemplate(defaultTemplate, `Relatório Rápido ${new Date().toLocaleDateString()}`);
    
    // Aplicar período padrão
    report.filters = {
      dateRange: {
        type: "month",
      },
    };

    const updated = [...reports, report];
    setReports(updated);
    saveReports(updated);
    
    // Ir para visualização do relatório criado
    navigate(`/app/reports/view/${report.id}`);
  };

  const handleWizardComplete = (report: Report) => {
    setShowWizard(false);
    const updated = [...reports, report];
    setReports(updated);
    saveReports(updated);
    navigate(`/app/reports/${report.id}`);
  };

  const handleExportPDF = (report: Report, e: React.MouseEvent) => {
    e.stopPropagation();
    import("../utils/reportExport").then(({ exportReportToPDF }) => {
      exportReportToPDF(report);
    });
  };

  const handleExportExcel = async (report: Report, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { exportReportToExcel } = await import("../utils/reportExport");
      await exportReportToExcel(report);
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      alert('Erro ao exportar relatório. Tente novamente.');
    }
  };

  const getScheduleLabel = (schedule?: ReportSchedule) => {
    if (!schedule || !schedule.enabled) return "Não agendado";
    
    const time = schedule.time || "09:00";
    if (schedule.frequency === "daily") return `Diário às ${time}`;
    if (schedule.frequency === "weekly") {
      const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      return `Semanal (${days[schedule.dayOfWeek || 0]}) às ${time}`;
    }
    if (schedule.frequency === "monthly") {
      return `Mensal (dia ${schedule.dayOfMonth || 1}) às ${time}`;
    }
    return "Agendado";
  };

  // Filtrar e ordenar relatórios
  const filteredAndSortedReports = reports
    .filter((report) => {
      // Busca por nome ou descrição
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = report.name.toLowerCase().includes(query);
        const matchesDescription = report.description?.toLowerCase().includes(query) || false;
        if (!matchesName && !matchesDescription) return false;
      }
      
      // Filtro por tipo
      if (typeFilter !== "all" && report.type !== typeFilter) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "date":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "type":
          return a.type.localeCompare(b.type);
        case "updated":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });

  const clearFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
  };

  const hasActiveFilters = searchQuery || typeFilter !== "all";

  return (
    <div className="min-h-screen">
      <Header title="Relatórios" subtitle="Crie e gerencie relatórios personalizados" />
      
      <div className="p-8">
        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleQuickCreate}
            >
              <Zap size={16} />
              Criar Rápido
            </Button>
            {reports.length === 0 && (
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => {
                  // Criar relatório de exemplo para teste
                  const exampleReport: Report = {
                    id: `example-${Date.now()}`,
                    name: "Relatório de Exemplo",
                    description: "Este é um relatório de exemplo criado automaticamente para demonstração",
                    type: "custom",
                    widgets: [
                      {
                        id: `widget-${Date.now()}`,
                        type: "metric",
                        title: "Total de Leads",
                        config: { metric: "totalLeads" },
                        position: { x: 0, y: 0, w: 4, h: 2 },
                      },
                      {
                        id: `widget-${Date.now() + 1}`,
                        type: "chart",
                        title: "Gráfico de Vendas",
                        config: { chartType: "bar" },
                        position: { x: 4, y: 0, w: 8, h: 4 },
                      },
                    ],
                    schedule: {
                      enabled: true,
                      frequency: "weekly",
                      dayOfWeek: 1,
                      time: "09:00",
                      recipients: ["exemplo@empresa.com"],
                      format: "pdf",
                    },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    createdBy: "system",
                  };
                  const updated = [...reports, exampleReport];
                  setReports(updated);
                  saveReports(updated);
                }}
              >
                Criar Exemplo
              </Button>
            )}
          </div>

          <Button 
            className="bg-primary hover:bg-primary-dark gap-2"
            onClick={() => setShowWizard(true)}
          >
            <Plus size={16} />
            Novo Relatório
          </Button>
        </div>

        {/* Wizard Dialog */}
        {showWizard && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <ReportWizard
                onComplete={handleWizardComplete}
                onCancel={() => setShowWizard(false)}
              />
            </div>
          </div>
        )}

        {/* Search and Filters */}
        {reports.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600" size={16} />
                <Input
                  placeholder="Buscar relatórios..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Type Filter */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="leads">Leads</SelectItem>
                  <SelectItem value="sales">Vendas</SelectItem>
                  <SelectItem value="automations">Automações</SelectItem>
                  <SelectItem value="tasks">Tarefas</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated">Mais recentes</SelectItem>
                  <SelectItem value="date">Data de criação</SelectItem>
                  <SelectItem value="name">Nome (A-Z)</SelectItem>
                  <SelectItem value="type">Tipo</SelectItem>
                </SelectContent>
              </Select>

              {/* View Mode */}
              <div className="flex items-center gap-2 border border-gray-300 rounded-md p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="h-8"
                >
                  <Grid3x3 size={16} />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-8"
                >
                  <List size={16} />
                </Button>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="gap-2"
                >
                  <X size={16} />
                  Limpar
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Reports Grid/List */}
        {filteredAndSortedReports.length > 0 ? (
          <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
            {filteredAndSortedReports.map((report) => (
              <div
                key={report.id}
                className={`bg-white rounded-lg shadow-sm border border-gray-300 overflow-hidden hover:shadow-md transition-shadow ${
                  viewMode === "list" ? "flex items-center p-4" : ""
                }`}
              >
                <div className={viewMode === "list" ? "flex-1 flex items-center justify-between" : "p-6"}>
                  {viewMode === "list" ? (
                    <>
                      <div className="flex-1">
                        <h3 className="text-gray-900 font-medium mb-1">{report.name}</h3>
                        {report.description && (
                          <p className="text-sm text-gray-600">{report.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          <span className="capitalize">{report.type}</span>
                          <span>•</span>
                          <span>{report.widgets.length} widgets</span>
                          <span>•</span>
                          <span>{getScheduleLabel(report.schedule)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/app/reports/view/${report.id}`)}
                        >
                          <FileText size={14} className="mr-1" />
                          Visualizar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/app/reports/${report.id}`)}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-error hover:text-error hover:bg-red-50"
                          onClick={() => handleDelete(report.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-gray-900 font-medium mb-1">{report.name}</h3>
                          {report.description && (
                            <p className="text-sm text-gray-600 line-clamp-2">{report.description}</p>
                          )}
                        </div>
                      </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText size={14} />
                      <span>{report.widgets.length} widget{report.widgets.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar size={14} />
                      <span>{getScheduleLabel(report.schedule)}</span>
                    </div>
                    {report.schedule?.enabled && report.schedule.recipients.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail size={14} />
                        <span>{report.schedule.recipients.length} destinatário{report.schedule.recipients.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                      <div className="flex items-center gap-2 pt-4 border-t border-gray-300">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate(`/app/reports/view/${report.id}`)}
                        >
                          <FileText size={14} className="mr-1" />
                          Visualizar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/app/reports/${report.id}`)}
                        >
                          <Edit size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-error hover:text-error hover:bg-red-50"
                          onClick={() => handleDelete(report.id)}
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={(e) => handleExportPDF(report, e)}
                        >
                          <FileText size={12} className="mr-1" />
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={(e) => handleExportExcel(report, e)}
                        >
                          <Download size={12} className="mr-1" />
                          Excel
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-12 text-center">
            <FileText size={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum relatório criado
            </h3>
            <p className="text-gray-600 mb-6">
              Comece criando seu primeiro relatório personalizado
            </p>
            <Button 
              className="bg-primary hover:bg-primary-dark gap-2"
              onClick={() => navigate("/app/reports/new")}
            >
              <Plus size={16} />
              Criar Relatório
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-300 p-12 text-center">
            <Search size={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum relatório encontrado
            </h3>
            <p className="text-gray-600 mb-6">
              Tente ajustar seus filtros de busca
            </p>
            <Button 
              variant="outline"
              onClick={clearFilters}
              className="gap-2"
            >
              <X size={16} />
              Limpar Filtros
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

