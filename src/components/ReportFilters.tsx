import { useState } from "react";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { X, Calendar as CalendarIcon, Filter } from "lucide-react";
import { ReportFilter } from "../types";
import { useTags } from "../contexts/TagsContext";
import { getAllAutomations } from "../utils/automations";
// Função auxiliar para formatar data
const formatDate = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

interface ReportFiltersProps {
  filters: ReportFilter | undefined;
  onChange: (filters: ReportFilter) => void;
  dataSource?: "leads" | "pipeline" | "automations" | "tasks" | "interactions";
}

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Últimos 7 dias" },
  { value: "month", label: "Último mês" },
  { value: "quarter", label: "Último trimestre" },
  { value: "year", label: "Último ano" },
  { value: "all", label: "Todo o período" },
  { value: "custom", label: "Período customizado" },
];

const STATUS_OPTIONS = [
  { value: "novo", label: "Novo" },
  { value: "contato", label: "Em Contato" },
  { value: "fechado", label: "Fechado" },
  { value: "perdido", label: "Perdido" },
];

const SOURCE_OPTIONS = [
  { value: "meta", label: "Meta Ads" },
  { value: "google", label: "Google Ads" },
  { value: "organico", label: "Orgânico" },
  { value: "manual", label: "Manual" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
];

export function ReportFilters({ filters, onChange, dataSource = "leads" }: ReportFiltersProps) {
  const { tags } = useTags();
  const automations = getAllAutomations();
  
  const [dateRangeType, setDateRangeType] = useState<"today" | "week" | "month" | "quarter" | "year" | "all" | "custom">(
    filters?.dateRange?.type || "month"
  );
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
    filters?.dateRange?.start ? new Date(filters.dateRange.start) : undefined
  );
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(
    filters?.dateRange?.end ? new Date(filters.dateRange.end) : undefined
  );

  const handlePeriodChange = (value: string) => {
    const newType = value as typeof dateRangeType;
    setDateRangeType(newType);
    
    onChange({
      ...filters,
      dateRange: {
        type: newType,
        ...(newType === "custom" && customStartDate && customEndDate
          ? {
              start: customStartDate.toISOString(),
              end: customEndDate.toISOString(),
            }
          : {}),
      },
    });
  };

  const handleCustomDateChange = (start: Date | undefined, end: Date | undefined) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    
    if (start && end && dateRangeType === "custom") {
      onChange({
        ...filters,
        dateRange: {
          type: "custom",
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });
    }
  };

  const handleStatusChange = (status: string, checked: boolean) => {
    const currentStatuses = filters?.status || [];
    const newStatuses = checked
      ? [...currentStatuses, status]
      : currentStatuses.filter(s => s !== status);
    
    onChange({
      ...filters,
      status: newStatuses.length > 0 ? newStatuses : undefined,
    });
  };

  const handleSourceChange = (source: string, checked: boolean) => {
    const currentSources = filters?.source || [];
    const newSources = checked
      ? [...currentSources, source]
      : currentSources.filter(s => s !== source);
    
    onChange({
      ...filters,
      source: newSources.length > 0 ? newSources : undefined,
    });
  };

  const handleTagChange = (tagId: string, checked: boolean) => {
    const currentTags = filters?.tags || [];
    const newTags = checked
      ? [...currentTags, tagId]
      : currentTags.filter(t => t !== tagId);
    
    onChange({
      ...filters,
      tags: newTags.length > 0 ? newTags : undefined,
    });
  };

  const handleAutomationChange = (automationId: number, checked: boolean) => {
    const currentAutomations = filters?.automationIds || [];
    const newAutomations = checked
      ? [...currentAutomations, automationId]
      : currentAutomations.filter(id => id !== automationId);
    
    onChange({
      ...filters,
      automationIds: newAutomations.length > 0 ? newAutomations : undefined,
    });
  };

  const handlePriorityChange = (priority: string, checked: boolean) => {
    const currentPriorities = filters?.priority || [];
    const newPriorities = checked
      ? [...currentPriorities, priority]
      : currentPriorities.filter(p => p !== priority);
    
    onChange({
      ...filters,
      priority: newPriorities.length > 0 ? newPriorities : undefined,
    });
  };

  const clearFilters = () => {
    onChange({});
    setDateRangeType("month");
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
  };

  const hasActiveFilters = 
    (filters?.status && filters.status.length > 0) ||
    (filters?.source && filters.source.length > 0) ||
    (filters?.tags && filters.tags.length > 0) ||
    (filters?.automationIds && filters.automationIds.length > 0) ||
    (filters?.priority && filters.priority.length > 0) ||
    (filters?.dateRange && filters.dateRange.type !== "month");

  return (
    <div className="space-y-6">
      {/* Período */}
      <div>
        <Label>Período</Label>
        <Select value={dateRangeType} onValueChange={handlePeriodChange}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {dateRangeType === "custom" && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full mt-1.5 justify-start text-left font-normal"
                  >
                    <CalendarIcon size={16} className="mr-2" />
                    {customStartDate ? formatDate(customStartDate) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={customStartDate}
                    onSelect={(date) => handleCustomDateChange(date, customEndDate)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full mt-1.5 justify-start text-left font-normal"
                  >
                    <CalendarIcon size={16} className="mr-2" />
                    {customEndDate ? formatDate(customEndDate) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={customEndDate}
                    onSelect={(date) => handleCustomDateChange(customStartDate, date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </div>

      {/* Filtros específicos por fonte de dados */}
      {(dataSource === "leads" || dataSource === "pipeline") && (
        <>
          {/* Status */}
          <div>
            <Label>Status</Label>
            <div className="mt-2 space-y-2">
              {STATUS_OPTIONS.map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${option.value}`}
                    checked={filters?.status?.includes(option.value) || false}
                    onCheckedChange={(checked) => handleStatusChange(option.value, checked as boolean)}
                  />
                  <Label
                    htmlFor={`status-${option.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Origem */}
          <div>
            <Label>Origem</Label>
            <div className="mt-2 space-y-2">
              {SOURCE_OPTIONS.map(option => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`source-${option.value}`}
                    checked={filters?.source?.includes(option.value) || false}
                    onCheckedChange={(checked) => handleSourceChange(option.value, checked as boolean)}
                  />
                  <Label
                    htmlFor={`source-${option.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <Label>Tags</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                {tags.map(tag => (
                  <div key={tag.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={filters?.tags?.includes(tag.id) || false}
                      onCheckedChange={(checked) => handleTagChange(tag.id, checked as boolean)}
                    />
                    <Label
                      htmlFor={`tag-${tag.id}`}
                      className="text-sm font-normal cursor-pointer flex items-center gap-2"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Automações */}
          {automations.length > 0 && (
            <div>
              <Label>Automações</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                {automations.map(auto => (
                  <div key={auto.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`automation-${auto.id}`}
                      checked={filters?.automationIds?.includes(auto.id) || false}
                      onCheckedChange={(checked) => handleAutomationChange(auto.id, checked as boolean)}
                    />
                    <Label
                      htmlFor={`automation-${auto.id}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {auto.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Filtros para tarefas */}
      {dataSource === "tasks" && (
        <div>
          <Label>Prioridade</Label>
          <div className="mt-2 space-y-2">
            {PRIORITY_OPTIONS.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`priority-${option.value}`}
                  checked={filters?.priority?.includes(option.value) || false}
                  onCheckedChange={(checked) => handlePriorityChange(option.value, checked as boolean)}
                />
                <Label
                  htmlFor={`priority-${option.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botão Limpar Filtros */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          onClick={clearFilters}
          className="w-full gap-2"
        >
          <X size={16} />
          Limpar Filtros
        </Button>
      )}
    </div>
  );
}

