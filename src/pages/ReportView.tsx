import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Button } from "../components/ui/button";
import { ArrowLeft, Download, FileText, Calendar, RefreshCw, Filter as FilterIcon, Loader2 } from "lucide-react";
import { Report } from "../types";
import { ReportWidgetRenderer } from "../components/ReportWidgetRenderer";
import { ReportFilters } from "../components/ReportFilters";
import { apiClient } from "../services/api/client";

function apiToReport(apiReport: any): Report {
  const config = apiReport.config || {};
  return {
    id: apiReport.id,
    name: apiReport.name,
    description: apiReport.description || "",
    type: apiReport.type || "custom",
    widgets: config.widgets || [],
    schedule: config.schedule,
    filters: config.filters,
    shareSettings: config.shareSettings,
    templateId: config.templateId,
    createdAt: apiReport.createdAt,
    updatedAt: apiReport.updatedAt,
    createdBy: apiReport.createdBy?.name || apiReport.createdById || "system",
  };
}

export function ReportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (id) {
      apiClient.getReport(id)
        .then((result) => {
          const data = result?.data || result;
          if (data) setReport(apiToReport(data));
        })
        .catch((error) => console.error("Erro ao carregar relatório:", error))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const handleExportPDF = () => {
    if (!report) return;
    import("../utils/reportExport").then(({ exportReportToPDF }) => {
      exportReportToPDF(report);
    });
  };

  const handleExportExcel = () => {
    if (!report) return;
    import("../utils/reportExport").then(({ exportReportToExcel }) => {
      exportReportToExcel(report);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Header title="Carregando relatório..." />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen">
        <Header title="Relatório não encontrado" />
        <div className="p-8">
          <Button onClick={() => navigate("/app/reports")} className="gap-2">
            <ArrowLeft size={16} />
            Voltar para Relatórios
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header title={report.name} subtitle={report.description || "Visualização do relatório"} />

      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => navigate("/app/reports")} variant="outline" className="gap-2">
            <ArrowLeft size={16} />
            Voltar
          </Button>

          <div className="flex items-center gap-2">
            {report.schedule && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mr-4">
                <Calendar size={16} />
                <span>
                  {report.schedule.enabled
                    ? `Agendado: ${report.schedule.frequency === "daily" ? "Diário" : report.schedule.frequency === "weekly" ? "Semanal" : "Mensal"}`
                    : "Não agendado"}
                </span>
              </div>
            )}
            <Button onClick={() => setShowFilters(!showFilters)} variant="outline" className="gap-2">
              <FilterIcon size={16} />
              Filtros
            </Button>
            <Button onClick={() => setRefreshKey(k => k + 1)} variant="outline" className="gap-2">
              <RefreshCw size={16} />
              Atualizar
            </Button>
            <Button onClick={handleExportPDF} variant="outline" className="gap-2">
              <FileText size={16} />
              Exportar PDF
            </Button>
            <Button onClick={handleExportExcel} variant="outline" className="gap-2">
              <Download size={16} />
              Exportar Excel
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Tipo</p>
              <p className="text-gray-900 font-medium capitalize">{report.type}</p>
            </div>
            <div>
              <p className="text-gray-600">Widgets</p>
              <p className="text-gray-900 font-medium">{report.widgets.length}</p>
            </div>
            <div>
              <p className="text-gray-600">Criado em</p>
              <p className="text-gray-900 font-medium">
                {new Date(report.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </div>

        {showFilters && report.filters && (
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-300 mb-6">
            <h3 className="text-gray-900 font-medium mb-4">Filtros Aplicados</h3>
            <ReportFilters
              filters={report.filters}
              onChange={(filters) => {
                setReport({ ...report, filters });
                setRefreshKey(k => k + 1);
              }}
              dataSource={report.type === "custom" ? "leads" : report.type}
            />
          </div>
        )}

        <div className="space-y-6">
          {report.widgets.length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center border border-gray-300">
              <p className="text-gray-600">Este relatório não possui widgets configurados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {report.widgets.map((widget) => (
                <ReportWidgetRenderer
                  key={`${widget.id}-${refreshKey}`}
                  widget={widget}
                  globalFilters={report.filters}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
