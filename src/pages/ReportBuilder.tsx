import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Header } from '../components/Header';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Save, ArrowLeft, Plus, X, FileText, Settings, Loader2 } from 'lucide-react';
import { Report, ReportWidget, ReportSchedule, ReportFilter } from '../types';
import { generateId } from '../utils/id';
import { REPORT_TEMPLATES, createReportFromTemplate } from '../utils/reportTemplates';
import { ReportFilters } from '../components/ReportFilters';
import { ReportWidgetConfig } from '../components/ReportWidgetConfig';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import { apiClient } from '../services/api/client';

function apiToReport(apiReport: any): Report {
  const config = apiReport.config || {};
  return {
    id: apiReport.id,
    name: apiReport.name,
    description: apiReport.description || '',
    type: apiReport.type || 'custom',
    widgets: config.widgets || [],
    schedule: config.schedule,
    filters: config.filters,
    shareSettings: config.shareSettings,
    templateId: config.templateId,
    createdAt: apiReport.createdAt,
    updatedAt: apiReport.updatedAt,
    createdBy: apiReport.createdBy?.name || apiReport.createdById || 'system',
  };
}

function reportToApi(report: Report, schedule?: ReportSchedule) {
  return {
    name: report.name,
    description: report.description || undefined,
    type: report.type,
    config: {
      widgets: report.widgets,
      schedule: schedule?.enabled ? schedule : undefined,
      filters: report.filters,
      shareSettings: report.shareSettings,
      templateId: report.templateId,
    },
  };
}

const widgetTypes = [
  { value: 'metric', label: 'Métrica' },
  { value: 'chart', label: 'Gráfico' },
  { value: 'table', label: 'Tabela' },
  { value: 'funnel', label: 'Funil' },
];

export function ReportBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = id !== undefined && id !== 'new';

  const [report, setReport] = useState<Report>({
    id: generateId(),
    name: '',
    description: '',
    type: 'custom',
    widgets: [],
    filters: { dateRange: { type: 'month' } },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'current-user',
  });

  const [schedule, setSchedule] = useState<ReportSchedule>({
    enabled: false,
    frequency: 'daily',
    time: '09:00',
    recipients: [],
    format: 'pdf',
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);

  useEffect(() => {
    if (isEditing && id) {
      setLoading(true);
      apiClient
        .getReport(id)
        .then((result) => {
          const data = result?.data || result;
          if (data) {
            const parsed = apiToReport(data);
            setReport(parsed);
            if (parsed.schedule) setSchedule(parsed.schedule);
          }
        })
        .catch((error) => console.error('Erro ao carregar relatório:', error))
        .finally(() => setLoading(false));
    } else if (!isEditing && id === 'new') {
      setShowTemplateDialog(true);
    }
  }, [id, isEditing]);

  const handleTemplateSelect = (templateId: string) => {
    try {
      const templateReport = createReportFromTemplate(templateId);
      setReport(templateReport);
      setShowTemplateDialog(false);
    } catch (error) {
      console.error('Erro ao criar relatório do template:', error);
    }
  };

  const handleSkipTemplate = () => {
    setShowTemplateDialog(false);
  };

  const handleFilterChange = (filters: ReportFilter) => {
    setReport({ ...report, filters });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = reportToApi(report, schedule);

      if (isEditing) {
        await apiClient.updateReport(report.id, payload);
        toast.success('Relatório atualizado com sucesso');
      } else {
        await apiClient.createReport(payload);
        toast.success('Relatório criado com sucesso');
      }
      navigate('/app/reports');
    } catch (error) {
      console.error('Erro ao salvar relatório:', error);
      toast.error('Erro ao salvar relatório. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleRecipientAdd = () => {
    const email = prompt('Digite o e-mail do destinatário:');
    if (email && email.includes('@')) {
      setSchedule({
        ...schedule,
        recipients: [...schedule.recipients, email],
      });
    }
  };

  const addWidget = () => {
    let defaultDataSource: ReportWidget['dataSource'] = 'leads';
    if (report.type !== 'custom') {
      defaultDataSource =
        report.type === 'tasks'
          ? 'tasks'
          : report.type === 'automations'
            ? 'automations'
            : report.type === 'sales'
              ? 'pipeline'
              : 'leads';
    }

    const newWidget: ReportWidget = {
      id: generateId(),
      type: 'metric',
      title: 'Nova Métrica',
      dataSource: defaultDataSource,
      config: {},
      position: { x: 0, y: 0, w: 4, h: 2 },
      dateRange: report.filters?.dateRange || { type: 'month' },
    };
    setReport({
      ...report,
      widgets: [...report.widgets, newWidget],
    });
  };

  const removeWidget = (widgetId: string) => {
    setReport({
      ...report,
      widgets: report.widgets.filter((w) => w.id !== widgetId),
    });
  };

  const updateWidget = (widgetId: string, updates: Partial<ReportWidget>) => {
    setReport({
      ...report,
      widgets: report.widgets.map((w) => (w.id === widgetId ? { ...w, ...updates } : w)),
    });
  };

  const removeRecipient = (email: string) => {
    setSchedule({
      ...schedule,
      recipients: schedule.recipients.filter((e) => e !== email),
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

  return (
    <div className="min-h-screen">
      <Header
        title={isEditing ? 'Editar Relatório' : 'Novo Relatório'}
        subtitle={
          isEditing ? 'Modifique seu relatório personalizado' : 'Crie um relatório personalizado'
        }
      />

      {/* Dialog de Templates */}
      <Dialog open={showTemplateDialog && !isEditing} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Escolha um Template</DialogTitle>
            <DialogDescription>
              Selecione um template pré-configurado ou comece do zero
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {REPORT_TEMPLATES.map((template) => (
              <div
                key={template.id}
                role="button"
                tabIndex={0}
                onClick={() => handleTemplateSelect(template.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    if (e.key === ' ') e.preventDefault();
                    handleTemplateSelect(template.id);
                  }
                }}
                className="border border-gray-300 rounded-lg p-4 hover:border-primary hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{template.name}</h3>
                  <FileText size={20} className="text-gray-600" />
                </div>
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>{template.widgets.length} widgets</span>
                  <span>•</span>
                  <span className="capitalize">{template.category}</span>
                </div>
              </div>
            ))}
            <div
              role="button"
              tabIndex={0}
              onClick={handleSkipTemplate}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if (e.key === ' ') e.preventDefault();
                  handleSkipTemplate();
                }
              }}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-primary cursor-pointer transition-all flex items-center justify-center min-h-[120px]"
            >
              <div className="text-center">
                <Plus size={24} className="mx-auto mb-2 text-gray-600" />
                <p className="text-sm text-gray-600">Começar do zero</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="p-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-300">
          <Tabs defaultValue="general" className="w-full">
            <div className="border-b border-gray-300 px-6">
              <div className="flex items-center justify-between">
                <TabsList className="bg-transparent h-auto p-0 gap-8">
                  <TabsTrigger
                    value="general"
                    className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 px-0"
                  >
                    Geral
                  </TabsTrigger>
                  <TabsTrigger
                    value="widgets"
                    className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 px-0"
                  >
                    Widgets
                  </TabsTrigger>
                  {(advancedMode || isEditing) && (
                    <>
                      <TabsTrigger
                        value="filters"
                        className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 px-0"
                      >
                        Filtros
                      </TabsTrigger>
                      <TabsTrigger
                        value="schedule"
                        className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-4 px-0"
                      >
                        Agendamento
                      </TabsTrigger>
                    </>
                  )}
                </TabsList>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAdvancedMode(!advancedMode)}
                  className="gap-2"
                >
                  <Settings size={14} />
                  {advancedMode ? 'Modo Simples' : 'Modo Avançado'}
                </Button>
              </div>
            </div>

            <TabsContent value="general" className="p-6">
              <div className="max-w-2xl space-y-6">
                <div>
                  <Label htmlFor="name">Nome do Relatório</Label>
                  <Input
                    id="name"
                    value={report.name}
                    onChange={(e) => setReport({ ...report, name: e.target.value })}
                    className="mt-1.5"
                    placeholder="Ex: Relatório Semanal de Vendas"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={report.description}
                    onChange={(e) => setReport({ ...report, description: e.target.value })}
                    className="mt-1.5"
                    placeholder="Descreva o propósito deste relatório..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="type">Tipo de Relatório</Label>
                  <Select
                    value={report.type}
                    onValueChange={(value: any) => setReport({ ...report, type: value })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leads">Leads</SelectItem>
                      <SelectItem value="sales">Vendas</SelectItem>
                      <SelectItem value="automations">Automações</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {(advancedMode || isEditing) && (
              <TabsContent value="filters" className="p-6">
                <div className="max-w-2xl space-y-6">
                  <div>
                    <h3 className="text-gray-900 font-medium mb-1">Filtros Globais</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Configure filtros que serão aplicados a todos os widgets do relatório
                    </p>
                    <ReportFilters
                      filters={report.filters}
                      onChange={handleFilterChange}
                      dataSource={report.type === 'custom' ? 'leads' : report.type}
                    />
                  </div>
                </div>
              </TabsContent>
            )}

            <TabsContent value="widgets" className="p-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-gray-900 font-medium mb-1">Widgets do Relatório</h3>
                    <p className="text-sm text-gray-600">
                      Adicione widgets para visualizar seus dados
                    </p>
                  </div>
                  <Button onClick={addWidget} className="gap-2">
                    <Plus size={16} />
                    Adicionar Widget
                  </Button>
                </div>

                {report.widgets.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <p className="text-gray-600 mb-4">Nenhum widget adicionado</p>
                    <Button variant="outline" onClick={addWidget} className="gap-2">
                      <Plus size={16} />
                      Adicionar Primeiro Widget
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {report.widgets.map((widget) => (
                      <div key={widget.id} className="border border-gray-300 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <ReportWidgetConfig
                              widget={widget}
                              onChange={(updates) => updateWidget(widget.id, updates)}
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-error hover:text-error hover:bg-red-50 ml-4"
                            onClick={() => removeWidget(widget.id)}
                          >
                            <X size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {(advancedMode || isEditing) && (
              <TabsContent value="schedule" className="p-6">
                <div className="max-w-2xl space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-gray-900 font-medium mb-1">Agendamento</h3>
                      <p className="text-sm text-gray-600">
                        Configure o envio automático deste relatório
                      </p>
                    </div>
                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={(checked) => setSchedule({ ...schedule, enabled: checked })}
                    />
                  </div>

                  {schedule.enabled && (
                    <div className="space-y-6 pt-4 border-t border-gray-300">
                      <div>
                        <Label>Frequência</Label>
                        <Select
                          value={schedule.frequency}
                          onValueChange={(value: any) =>
                            setSchedule({ ...schedule, frequency: value })
                          }
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">Diário</SelectItem>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="monthly">Mensal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {schedule.frequency === 'weekly' && (
                        <div>
                          <Label>Dia da Semana</Label>
                          <Select
                            value={schedule.dayOfWeek?.toString() || '0'}
                            onValueChange={(value) =>
                              setSchedule({ ...schedule, dayOfWeek: parseInt(value) })
                            }
                          >
                            <SelectTrigger className="mt-1.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Domingo</SelectItem>
                              <SelectItem value="1">Segunda-feira</SelectItem>
                              <SelectItem value="2">Terça-feira</SelectItem>
                              <SelectItem value="3">Quarta-feira</SelectItem>
                              <SelectItem value="4">Quinta-feira</SelectItem>
                              <SelectItem value="5">Sexta-feira</SelectItem>
                              <SelectItem value="6">Sábado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {schedule.frequency === 'monthly' && (
                        <div>
                          <Label>Dia do Mês</Label>
                          <Input
                            type="number"
                            min="1"
                            max="31"
                            value={schedule.dayOfMonth || 1}
                            onChange={(e) =>
                              setSchedule({
                                ...schedule,
                                dayOfMonth: parseInt(e.target.value) || 1,
                              })
                            }
                            className="mt-1.5"
                          />
                        </div>
                      )}

                      <div>
                        <Label>Horário</Label>
                        <Input
                          type="time"
                          value={schedule.time}
                          onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label>Formato</Label>
                        <Select
                          value={schedule.format}
                          onValueChange={(value: any) =>
                            setSchedule({ ...schedule, format: value })
                          }
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pdf">PDF</SelectItem>
                            <SelectItem value="excel">Excel</SelectItem>
                            <SelectItem value="both">Ambos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Destinatários</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRecipientAdd}
                            className="gap-2"
                          >
                            <Plus size={14} />
                            Adicionar
                          </Button>
                        </div>
                        {schedule.recipients.length === 0 ? (
                          <p className="text-sm text-gray-600 mt-2">
                            Nenhum destinatário adicionado
                          </p>
                        ) : (
                          <div className="space-y-2 mt-2">
                            {schedule.recipients.map((email) => (
                              <div
                                key={email}
                                className="flex items-center justify-between p-2 bg-gray-100 rounded"
                              >
                                <span className="text-sm">{email}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeRecipient(email)}
                                  className="text-error hover:text-error"
                                >
                                  <X size={14} />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>

          <div className="border-t border-gray-300 p-6 flex items-center justify-between">
            <Button variant="outline" onClick={() => navigate('/app/reports')} className="gap-2">
              <ArrowLeft size={16} />
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-primary hover:bg-primary-dark gap-2"
              disabled={!report.name.trim() || saving}
            >
              <Save size={16} />
              {saving ? 'Salvando...' : 'Salvar Relatório'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
