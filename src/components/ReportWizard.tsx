import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { ArrowLeft, ArrowRight, Check, FileText, Zap, TrendingUp, BarChart3, Users } from "lucide-react";
import { REPORT_TEMPLATES, createReportFromTemplate } from "../utils/reportTemplates";
import { Report, ReportFilter } from "../types";
import { generateId } from "../utils/id";

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

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Últimos 7 dias" },
  { value: "month", label: "Último mês" },
  { value: "quarter", label: "Último trimestre" },
  { value: "year", label: "Último ano" },
  { value: "all", label: "Todo o período" },
];

const getTemplateIcon = (category: string) => {
  switch (category) {
    case "leads":
      return Users;
    case "sales":
      return TrendingUp;
    case "automations":
      return Zap;
    case "tasks":
      return BarChart3;
    default:
      return FileText;
  }
};

interface ReportWizardProps {
  onComplete?: (report: Report) => void;
  onCancel?: () => void;
}

export function ReportWizard({ onComplete, onCancel }: ReportWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [reportName, setReportName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [period, setPeriod] = useState<"today" | "week" | "month" | "quarter" | "year" | "all">("month");
  const [advancedMode, setAdvancedMode] = useState(false);

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleCreate = () => {
    if (!reportName.trim()) {
      return;
    }

    let report: Report;

    if (selectedTemplateId) {
      // Criar relatório a partir do template
      report = createReportFromTemplate(selectedTemplateId, reportName);
    } else {
      // Criar relatório personalizado básico
      report = {
        id: generateId(),
        name: reportName,
        description: "",
        type: "custom",
        widgets: [],
        filters: {
          dateRange: {
            type: period,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "current-user",
      };
    }

    // Aplicar período selecionado
    if (report.filters) {
      report.filters.dateRange = {
        type: period,
      };
    } else {
      report.filters = {
        dateRange: {
          type: period,
        },
      };
    }

    // Salvar relatório
    const reports = getReports();
    reports.push(report);
    saveReports(reports);

    if (onComplete) {
      onComplete(report);
    } else {
      // Se não há template ou é modo rápido, ir para edição
      if (!selectedTemplateId || !advancedMode) {
        navigate(`/app/reports/${report.id}`);
      } else {
        navigate("/app/reports");
      }
    }
  };

  const handleQuickCreate = () => {
    if (!reportName.trim()) {
      setReportName("Relatório Rápido");
    }

    // Usar template padrão (executivo) ou o primeiro disponível
    const defaultTemplate = REPORT_TEMPLATES.find(t => t.id === "executive-dashboard") || REPORT_TEMPLATES[0];
    
    if (defaultTemplate) {
      const report = createReportFromTemplate(defaultTemplate.id, reportName || "Relatório Rápido");
      
      // Aplicar período padrão
      report.filters = {
        dateRange: {
          type: "month",
        },
      };

      const reports = getReports();
      reports.push(report);
      saveReports(reports);

      navigate("/app/reports");
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      navigate("/app/reports");
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return reportName.trim().length > 0;
      case 2:
        return selectedTemplateId !== null || advancedMode;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="bg-[#F9FAFB]">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#1F2937] mb-2">Criar Novo Relatório</h1>
          <p className="text-[#6B7280]">Siga os passos para criar seu relatório personalizado</p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                      step >= s
                        ? "bg-[#2563EB] text-white"
                        : "bg-[#E5E7EB] text-[#6B7280]"
                    }`}
                  >
                    {step > s ? <Check size={20} /> : s}
                  </div>
                  <span className="text-xs mt-2 text-[#6B7280] text-center">
                    {s === 1 && "Nome"}
                    {s === 2 && "Template"}
                    {s === 3 && "Período"}
                    {s === 4 && "Revisão"}
                  </span>
                </div>
                {s < 4 && (
                  <div
                    className={`h-1 flex-1 mx-2 ${
                      step > s ? "bg-[#2563EB]" : "bg-[#E5E7EB]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] p-8 mb-6">
          {/* Step 1: Nome */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-medium text-[#1F2937] mb-2">Nome do Relatório</h2>
                <p className="text-sm text-[#6B7280] mb-4">
                  Dê um nome descritivo para seu relatório
                </p>
                <Label htmlFor="report-name">Nome *</Label>
                <Input
                  id="report-name"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  className="mt-1.5"
                  placeholder="Ex: Relatório Semanal de Vendas"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 2: Template */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-medium text-[#1F2937] mb-2">Escolha um Template</h2>
                <p className="text-sm text-[#6B7280] mb-6">
                  Selecione um template pré-configurado ou crie um relatório personalizado
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {REPORT_TEMPLATES.map((template) => {
                    const Icon = getTemplateIcon(template.category);
                    return (
                      <div
                        key={template.id}
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                          selectedTemplateId === template.id
                            ? "border-[#2563EB] bg-[#EFF6FF]"
                            : "border-[#E5E7EB] hover:border-[#2563EB] hover:shadow-md"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon size={20} className="text-[#2563EB]" />
                            <h3 className="font-medium text-[#1F2937]">{template.name}</h3>
                          </div>
                          {selectedTemplateId === template.id && (
                            <Check size={20} className="text-[#2563EB]" />
                          )}
                        </div>
                        <p className="text-sm text-[#6B7280] mb-3">{template.description}</p>
                        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                          <span>{template.widgets.length} widgets</span>
                          <span>•</span>
                          <span className="capitalize">{template.category}</span>
                        </div>
                      </div>
                    );
                  })}
                  
                  <div
                    onClick={() => setSelectedTemplateId(null)}
                    className={`border-2 border-dashed rounded-lg p-4 cursor-pointer transition-all flex items-center justify-center min-h-[140px] ${
                      selectedTemplateId === null
                        ? "border-[#2563EB] bg-[#EFF6FF]"
                        : "border-[#E5E7EB] hover:border-[#2563EB]"
                    }`}
                  >
                    <div className="text-center">
                      <FileText size={24} className="mx-auto mb-2 text-[#6B7280]" />
                      <p className="text-sm font-medium text-[#1F2937]">Personalizado</p>
                      <p className="text-xs text-[#6B7280] mt-1">Começar do zero</p>
                      {selectedTemplateId === null && (
                        <Check size={20} className="mx-auto mt-2 text-[#2563EB]" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Período */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-medium text-[#1F2937] mb-2">Período de Análise</h2>
                <p className="text-sm text-[#6B7280] mb-4">
                  Selecione o período de dados que deseja analisar (opcional)
                </p>
                <Label htmlFor="period">Período</Label>
                <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-[#6B7280] mt-2">
                  Você pode ajustar isso depois na edição do relatório
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Revisão */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-medium text-[#1F2937] mb-2">Revisão</h2>
                <p className="text-sm text-[#6B7280] mb-6">
                  Revise as configurações antes de criar o relatório
                </p>
                
                <div className="bg-[#F9FAFB] rounded-lg p-6 space-y-4">
                  <div>
                    <span className="text-sm font-medium text-[#6B7280]">Nome:</span>
                    <p className="text-[#1F2937] mt-1">{reportName}</p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-[#6B7280]">Template:</span>
                    <p className="text-[#1F2937] mt-1">
                      {selectedTemplateId
                        ? REPORT_TEMPLATES.find(t => t.id === selectedTemplateId)?.name || "Personalizado"
                        : "Personalizado"}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm font-medium text-[#6B7280]">Período:</span>
                    <p className="text-[#1F2937] mt-1">
                      {PERIOD_OPTIONS.find(p => p.value === period)?.label || "Último mês"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="gap-2"
          >
            <ArrowLeft size={16} />
            Cancelar
          </Button>

          <div className="flex items-center gap-3">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={handlePrevious}
                className="gap-2"
              >
                <ArrowLeft size={16} />
                Anterior
              </Button>
            )}
            
            {step < totalSteps ? (
              <Button
                onClick={handleNext}
                disabled={!canProceed()}
                className="bg-[#2563EB] hover:bg-[#1E40AF] gap-2"
              >
                Próximo
                <ArrowRight size={16} />
              </Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={!canProceed()}
                className="bg-[#2563EB] hover:bg-[#1E40AF] gap-2"
              >
                <Check size={16} />
                Criar Relatório
              </Button>
            )}
          </div>
        </div>

        {/* Quick Create Option */}
        {step === 1 && reportName.trim() && (
          <div className="mt-6 p-4 bg-[#EFF6FF] rounded-lg border border-[#2563EB]/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#1F2937]">Modo Rápido</p>
                <p className="text-xs text-[#6B7280] mt-1">
                  Crie um relatório em 1 clique usando o template padrão
                </p>
              </div>
              <Button
                onClick={handleQuickCreate}
                size="sm"
                className="bg-[#2563EB] hover:bg-[#1E40AF]"
              >
                Criar Rápido
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

