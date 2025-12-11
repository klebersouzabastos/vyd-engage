import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Button, buttonVariants } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { LeadStatusBadge } from "../components/LeadStatusBadge";
import { LeadSourceBadge } from "../components/LeadSourceBadge";
import { LeadModal } from "../components/LeadModal";
import { EmptyState } from "../components/EmptyState";
import { Plus, Filter, Download, Pencil, Trash2, Users, Mail, MessageSquare, ChevronDown, X } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { useCompany } from "../contexts/CompanyContext";
import { useTags } from "../contexts/TagsContext";
import { TagBadge } from "../components/TagBadge";
import { useCustomFields } from "../contexts/CustomFieldsContext";
import { CustomFieldDisplay } from "../components/CustomFieldDisplay";
import { calculateLeadScore, saveLeadScore } from "../utils/leadScoring";
import { LeadScoreBadge } from "../components/LeadScoreBadge";
import { Lead } from "../types";
import { getLeadInteractions } from "../utils/interactions";
import { generateSampleLeads } from "../utils/generateSampleLeads";
import { cn } from "../components/ui/utils";
import { exportLeadsToExcel } from "../utils/excelExport";
import { removeLeadFromPipeline } from "../utils/pipelineSync";
import { useLeads } from "../hooks/useLeads";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

interface Automation {
  id: number;
  name: string;
  type: "whatsapp" | "email";
  status: "active" | "paused";
}

const availableAutomations: Automation[] = [
  {
    id: 1,
    name: "Boas-vindas WhatsApp",
    type: "whatsapp",
    status: "active",
  },
  {
    id: 2,
    name: "Follow-up E-mail",
    type: "email",
    status: "active",
  },
  {
    id: 3,
    name: "Recuperação de Leads Perdidos",
    type: "whatsapp",
    status: "paused",
  },
];

const getAutomationById = (id: number): Automation | undefined => {
  return availableAutomations.find(automation => automation.id === id);
};

// Função para buscar as colunas do kanban (Pipeline)
function getPipelineColumns(): Array<{ id: string; title: string }> {
  try {
    const stored = localStorage.getItem("pipelineColumns");
    if (stored) {
      const columns = JSON.parse(stored);
      return columns.map((col: any) => ({
        id: col.id,
        title: col.title,
      }));
    }
  } catch (error) {
    console.error("Erro ao carregar colunas do pipeline:", error);
  }
  // Retornar colunas padrão se não houver dados salvos
  return [
    { id: "novo", title: "Novo" },
    { id: "contato", title: "Em Contato" },
    { id: "fechado", title: "Fechado" },
  ];
}

// Hook useLeads agora gerencia os dados via API

const getStatusLabel = (status: string) => {
  const statusMap: Record<string, string> = {
    novo: "Novo",
    contato: "Em Contato",
    fechado: "Fechado",
    perdido: "Perdido",
  };
  return statusMap[status] || status;
};

const getSourceLabel = (source: string) => {
  const sourceMap: Record<string, string> = {
    meta: "Meta Ads",
    google: "Google Ads",
    organico: "Orgânico",
    manual: "Manual",
  };
  return sourceMap[source] || source;
};

export function Leads() {
  const navigate = useNavigate();
  const { logo, companyName } = useCompany();
  const { tags, getTagById } = useTags();
  const { fields: customFields } = useCustomFields();
  const { leads: leadsData, loading: leadsLoading, createLead, updateLead, deleteLead: deleteLeadAPI, refetch } = useLeads();
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterSource, setFilterSource] = useState<string[]>([]);
  const [filterAutomation, setFilterAutomation] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState<string[]>([]);
  const [filterCustomFields, setFilterCustomFields] = useState<Record<string, any>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [sourcePopoverOpen, setSourcePopoverOpen] = useState(false);
  const [automationPopoverOpen, setAutomationPopoverOpen] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [customFieldsPopoverOpen, setCustomFieldsPopoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [pipelineColumns, setPipelineColumns] = useState(getPipelineColumns());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteSingleLeadId, setDeleteSingleLeadId] = useState<string | null>(null);
  const [expandedLeads, setExpandedLeads] = useState<Set<string>>(new Set());
  
  const statusPopoverRef = useRef<HTMLDivElement>(null);
  const sourcePopoverRef = useRef<HTMLDivElement>(null);
  const automationPopoverRef = useRef<HTMLDivElement>(null);
  const tagPopoverRef = useRef<HTMLDivElement>(null);
  const customFieldsPopoverRef = useRef<HTMLDivElement>(null);

  const toggleLeadExpansion = (leadId: string) => {
    setExpandedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  const hasCustomFields = (lead: Lead): boolean => {
    return lead.customFields && Object.keys(lead.customFields).length > 0 && 
           Object.values(lead.customFields).some(v => v !== null && v !== undefined && v !== "");
  };

  useEffect(() => {
    // Atualizar colunas do pipeline sempre que o componente for montado
    setPipelineColumns(getPipelineColumns());
    // Leads são carregados automaticamente pelo hook useLeads
  }, []);

  // Fechar popovers ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (statusPopoverRef.current && !statusPopoverRef.current.contains(target)) {
        const button = target.closest('button[data-filter="status"]');
        if (!button) setStatusPopoverOpen(false);
      }
      
      if (sourcePopoverRef.current && !sourcePopoverRef.current.contains(target)) {
        const button = target.closest('button[data-filter="source"]');
        if (!button) setSourcePopoverOpen(false);
      }
      
      if (automationPopoverRef.current && !automationPopoverRef.current.contains(target)) {
        const button = target.closest('button[data-filter="automation"]');
        if (!button) setAutomationPopoverOpen(false);
      }
      
      if (tagPopoverRef.current && !tagPopoverRef.current.contains(target)) {
        const button = target.closest('button[data-filter="tag"]');
        if (!button) setTagPopoverOpen(false);
      }
      
      if (customFieldsPopoverRef.current && !customFieldsPopoverRef.current.contains(target)) {
        const button = target.closest('button[data-filter="customFields"]');
        if (!button) setCustomFieldsPopoverOpen(false);
      }
    };

    if (statusPopoverOpen || sourcePopoverOpen || automationPopoverOpen || tagPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [statusPopoverOpen, sourcePopoverOpen, automationPopoverOpen, tagPopoverOpen]);

  const filteredLeads = leadsData.filter((lead: any) => {
    const matchesStatus = filterStatus.length === 0 || filterStatus.includes(lead.status);
    const matchesSource = filterSource.length === 0 || filterSource.includes(lead.source);
    const matchesAutomation = filterAutomation.length === 0 || 
      filterAutomation.some(filter => {
        if (filter === "with") return lead.automations && lead.automations.length > 0;
        if (filter === "without") return !lead.automations || lead.automations.length === 0;
        return lead.automations && lead.automations.includes(Number(filter));
      });
    const matchesTag = filterTag.length === 0 || 
      (lead.tags && lead.tags.some((tagId: string) => filterTag.includes(tagId)));
    const matchesCustomFields = Object.keys(filterCustomFields).length === 0 ||
      Object.entries(filterCustomFields).every(([fieldId, filterValue]) => {
        if (filterValue === null || filterValue === undefined || filterValue === "") return true;
        const leadValue = lead.customFields?.[fieldId];
        if (leadValue === null || leadValue === undefined || leadValue === "") return false;
        
        const field = customFields.find(f => f.id === fieldId);
        if (!field) return true;
        
        // Filtro por tipo
        switch (field.type) {
          case "text":
          case "textarea":
            return String(leadValue).toLowerCase().includes(String(filterValue).toLowerCase());
          case "number":
            return Number(leadValue) === Number(filterValue);
          case "date":
            return String(leadValue) === String(filterValue);
          case "checkbox":
            return Boolean(leadValue) === Boolean(filterValue);
          case "select":
            return String(leadValue) === String(filterValue);
          default:
            return String(leadValue) === String(filterValue);
        }
      });
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSource && matchesAutomation && matchesTag && matchesCustomFields && matchesSearch;
  });

  const handleSelectAll = () => {
    const filteredLeadIds = filteredLeads.map(l => l.id);
    const allFilteredSelected = filteredLeadIds.every(id => selectedLeads.includes(id));
    
    if (allFilteredSelected && filteredLeadIds.length > 0) {
      // Desmarcar apenas os leads filtrados
      setSelectedLeads(selectedLeads.filter(id => !filteredLeadIds.includes(id)));
    } else {
      // Marcar todos os leads filtrados (mantendo os que já estavam selecionados fora do filtro)
      const newSelected = [...new Set([...selectedLeads, ...filteredLeadIds])];
      setSelectedLeads(newSelected);
    }
  };

  const handleSelectLead = (id: number) => {
    if (selectedLeads.includes(id)) {
      setSelectedLeads(selectedLeads.filter(l => l !== id));
    } else {
      setSelectedLeads([...selectedLeads, id]);
    }
  };

  const handleExportLeads = async () => {
    try {
      await exportLeadsToExcel(
        filteredLeads,
        {
          status: filterStatus,
          source: filterSource,
          automation: filterAutomation,
          tag: filterTag,
          searchQuery: searchQuery,
        },
        getStatusLabel,
        getSourceLabel,
        getAutomationById,
        getTagById,
      );
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      alert('Erro ao exportar relatório. Tente novamente.');
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      await deleteLeadAPI(leadId);
      
      // Remover lead do pipeline
      removeLeadFromPipeline(leadId);
      
      // Remover da seleção se estiver selecionado
      setSelectedLeads(prev => prev.filter(id => id !== leadId));
      
      // Fechar modal se o lead deletado estava aberto
      if (selectedLead?.id === leadId) {
        setModalOpen(false);
        setSelectedLead(null);
      }
      
      setDeleteSingleLeadId(null);
    } catch (error) {
      console.error("Erro ao deletar lead:", error);
    }
  };

  const handleDeleteSelectedLeads = async () => {
    if (selectedLeads.length === 0) return;

    const leadsToDelete = [...selectedLeads]; // Guardar cópia antes de limpar
    const leadToDeleteCount = leadsToDelete.length;

    try {
      // Deletar todos os leads selecionados
      await Promise.all(leadsToDelete.map(id => deleteLeadAPI(id)));
      
      // Remover leads do pipeline
      leadsToDelete.forEach(id => removeLeadFromPipeline(id));
      
      // Remover leads do pipeline
      leadsToDelete.forEach(leadId => {
        removeLeadFromPipeline(leadId);
      });
      
      // Fechar modal se algum lead deletado estava aberto
      if (selectedLead && leadsToDelete.includes(selectedLead.id)) {
        setModalOpen(false);
        setSelectedLead(null);
      }
      
      // Limpar seleção
      setSelectedLeads([]);
      setDeleteDialogOpen(false);
      // Recarregar leads da API
      refetch();
      
      // Mostrar mensagem de sucesso
      alert(`✅ ${leadToDeleteCount} lead(s) deletado(s) com sucesso!`);
    } catch (error) {
      console.error("Erro ao deletar leads:", error);
      alert("Erro ao deletar leads. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Leads" subtitle="Gerencie todos os seus leads em um só lugar" />
      
      <div className="p-8">
        {/* Bulk Actions Bar */}
        {selectedLeads.length > 0 && (
          <div className="bg-[#2563EB] text-white rounded-lg p-4 shadow-sm border border-[#2563EB] mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-medium">
                  {selectedLeads.length} lead{selectedLeads.length > 1 ? "s" : ""} selecionado{selectedLeads.length > 1 ? "s" : ""}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedLeads([])}
                  className="text-white hover:bg-white/20 h-8 px-2"
                >
                  <X size={14} />
                </Button>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
                className="bg-red-600 hover:bg-red-700 gap-2"
              >
                <Trash2 size={16} />
                Deletar Selecionados
              </Button>
            </div>
          </div>
        )}

        {/* Actions Bar */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-[#E5E7EB] mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Buscar por nome, telefone ou e-mail..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div className="relative" ref={statusPopoverRef}>
              <button
                type="button"
                data-filter="status"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "gap-2 border border-[#E5E7EB] bg-white hover:bg-gray-50 cursor-pointer"
                )}
                onClick={() => setStatusPopoverOpen(!statusPopoverOpen)}
              >
                <Filter size={16} />
                <span>
                  {filterStatus.length === 0
                    ? "Todos os status"
                    : filterStatus.length === pipelineColumns.length
                    ? "Todos os status"
                    : `${filterStatus.length} status`}
                </span>
                <ChevronDown size={16} className={statusPopoverOpen ? "rotate-180 transition-transform duration-200" : "transition-transform duration-200"} />
              </button>
              {statusPopoverOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 w-56 bg-white rounded-md border border-[#E5E7EB] shadow-lg p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#E5E7EB]">
                      <span className="text-sm font-medium text-[#1F2937]">Filtrar por Status</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFilterStatus((prev) => {
                            if (prev.length === pipelineColumns.length) {
                              return [];
                            } else {
                              return pipelineColumns.map(col => col.id);
                            }
                          });
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        {filterStatus.length === pipelineColumns.length ? "Desmarcar" : "Selecionar todos"}
                      </Button>
                    </div>
                    {pipelineColumns.map((column) => {
                      const isChecked = filterStatus.includes(column.id);
                      const handleToggle = () => {
                        setFilterStatus((prev) => {
                          if (prev.includes(column.id)) {
                            return prev.filter(s => s !== column.id);
                          } else {
                            return [...prev, column.id];
                          }
                        });
                      };
                      return (
                        <div
                          key={column.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded-md -mx-2"
                          onClick={(e) => {
                            e.preventDefault();
                            handleToggle();
                          }}
                        >
                          <Checkbox
                            id={`status-${column.id}`}
                            checked={isChecked}
                            onCheckedChange={handleToggle}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <label
                            htmlFor={`status-${column.id}`}
                            className="text-sm text-[#1F2937] cursor-pointer flex-1"
                            onClick={(e) => {
                              e.preventDefault();
                              handleToggle();
                            }}
                          >
                            {column.title}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Source Filter */}
            <div className="relative" ref={sourcePopoverRef}>
              <button
                type="button"
                data-filter="source"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "gap-2 border border-[#E5E7EB] bg-white hover:bg-gray-50 cursor-pointer"
                )}
                onClick={() => setSourcePopoverOpen(!sourcePopoverOpen)}
              >
                <Filter size={16} />
                <span>
                  {filterSource.length === 0
                    ? "Todas as origens"
                    : filterSource.length === 4
                    ? "Todas as origens"
                    : `${filterSource.length} origem${filterSource.length > 1 ? "s" : ""}`}
                </span>
                <ChevronDown size={16} className={sourcePopoverOpen ? "rotate-180 transition-transform duration-200" : "transition-transform duration-200"} />
              </button>
              {sourcePopoverOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 w-56 bg-white rounded-md border border-[#E5E7EB] shadow-lg p-3">
                  <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#E5E7EB]">
                    <span className="text-sm font-medium text-[#1F2937]">Filtrar por Origem</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFilterSource((prev) => {
                          if (prev.length === 4) {
                            return [];
                          } else {
                            return ["meta", "google", "organico", "manual"];
                          }
                        });
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      {filterSource.length === 4 ? "Desmarcar" : "Selecionar todas"}
                    </Button>
                  </div>
                  {[
                    { value: "meta", label: "Meta Ads" },
                    { value: "google", label: "Google Ads" },
                    { value: "organico", label: "Orgânico" },
                    { value: "manual", label: "Manual" },
                  ].map((option) => {
                    const isChecked = filterSource.includes(option.value);
                    const handleToggle = () => {
                      setFilterSource((prev) => {
                        if (prev.includes(option.value)) {
                          return prev.filter(s => s !== option.value);
                        } else {
                          return [...prev, option.value];
                        }
                      });
                    };
                    return (
                      <div
                        key={option.value}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded-md -mx-2"
                        onClick={(e) => {
                          e.preventDefault();
                          handleToggle();
                        }}
                      >
                        <Checkbox
                          id={`source-${option.value}`}
                          checked={isChecked}
                          onCheckedChange={handleToggle}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <label
                          htmlFor={`source-${option.value}`}
                          className="text-sm text-[#1F2937] cursor-pointer flex-1"
                          onClick={(e) => {
                            e.preventDefault();
                            handleToggle();
                          }}
                        >
                          {option.label}
                        </label>
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>

            {/* Automation Filter */}
            <div className="relative" ref={automationPopoverRef}>
              <button
                type="button"
                data-filter="automation"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "gap-2 border border-[#E5E7EB] bg-white hover:bg-gray-50 cursor-pointer"
                )}
                onClick={() => setAutomationPopoverOpen(!automationPopoverOpen)}
              >
                <Filter size={16} />
                <span>
                  {filterAutomation.length === 0
                    ? "Todas as automações"
                    : `${filterAutomation.length} automação${filterAutomation.length > 1 ? "ões" : ""}`}
                </span>
                <ChevronDown size={16} className={automationPopoverOpen ? "rotate-180 transition-transform duration-200" : "transition-transform duration-200"} />
              </button>
              {automationPopoverOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 w-56 bg-white rounded-md border border-[#E5E7EB] shadow-lg p-3">
                  <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#E5E7EB]">
                    <span className="text-sm font-medium text-[#1F2937]">Filtrar por Automação</span>
                  </div>
                  {[
                    { value: "with", label: "Com automações" },
                    { value: "without", label: "Sem automações" },
                    ...availableAutomations.map(a => ({ value: a.id.toString(), label: a.name }))
                  ].map((option) => {
                    const isChecked = filterAutomation.includes(option.value);
                    const handleToggle = () => {
                      setFilterAutomation((prev) => {
                        if (prev.includes(option.value)) {
                          return prev.filter(a => a !== option.value);
                        } else {
                          return [...prev, option.value];
                        }
                      });
                    };
                    return (
                      <div
                        key={option.value}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded-md -mx-2"
                        onClick={(e) => {
                          e.preventDefault();
                          handleToggle();
                        }}
                      >
                        <Checkbox
                          id={`automation-${option.value}`}
                          checked={isChecked}
                          onCheckedChange={handleToggle}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <label
                          htmlFor={`automation-${option.value}`}
                          className="text-sm text-[#1F2937] cursor-pointer flex-1"
                          onClick={(e) => {
                            e.preventDefault();
                            handleToggle();
                          }}
                        >
                          {option.label}
                        </label>
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>

            {/* Tag Filter */}
            <div className="relative" ref={tagPopoverRef}>
              <button
                type="button"
                data-filter="tag"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "gap-2 border border-[#E5E7EB] bg-white hover:bg-gray-50 cursor-pointer"
                )}
                onClick={() => setTagPopoverOpen(!tagPopoverOpen)}
              >
                <Filter size={16} />
                <span>
                  {filterTag.length === 0
                    ? "Todas as tags"
                    : filterTag.length === tags.length
                    ? "Todas as tags"
                    : `${filterTag.length} tag${filterTag.length > 1 ? "s" : ""}`}
                </span>
                <ChevronDown size={16} className={tagPopoverOpen ? "rotate-180 transition-transform duration-200" : "transition-transform duration-200"} />
              </button>
              {tagPopoverOpen && (
                <div className="absolute top-full left-0 mt-2 z-50 w-56 bg-white rounded-md border border-[#E5E7EB] shadow-lg p-3">
                  <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#E5E7EB]">
                    <span className="text-sm font-medium text-[#1F2937]">Filtrar por Tag</span>
                    {tags.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFilterTag((prev) => {
                            if (prev.length === tags.length) {
                              return [];
                            } else {
                              return tags.map(t => t.id);
                            }
                          });
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        {filterTag.length === tags.length ? "Desmarcar" : "Selecionar todas"}
                      </Button>
                    )}
                  </div>
                  {tags.length > 0 ? (
                    tags.map((tag) => {
                      const isChecked = filterTag.includes(tag.id);
                      const handleToggle = () => {
                        setFilterTag((prev) => {
                          if (prev.includes(tag.id)) {
                            return prev.filter(t => t !== tag.id);
                          } else {
                            return [...prev, tag.id];
                          }
                        });
                      };
                      return (
                        <div
                          key={tag.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded-md -mx-2"
                          onClick={(e) => {
                            e.preventDefault();
                            handleToggle();
                          }}
                        >
                          <Checkbox
                            id={`tag-${tag.id}`}
                            checked={isChecked}
                            onCheckedChange={handleToggle}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <label
                            htmlFor={`tag-${tag.id}`}
                            className="text-sm text-[#1F2937] cursor-pointer flex-1"
                            onClick={(e) => {
                              e.preventDefault();
                              handleToggle();
                            }}
                          >
                            {tag.name}
                          </label>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-[#6B7280] p-2">Nenhuma tag disponível</p>
                  )}
                  </div>
                </div>
              )}
            </div>

            {/* Custom Fields Filter */}
            {customFields.length > 0 && (
              <div className="relative" ref={customFieldsPopoverRef}>
                <button
                  type="button"
                  data-filter="customFields"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "gap-2 border border-[#E5E7EB] bg-white hover:bg-gray-50 cursor-pointer"
                  )}
                  onClick={() => setCustomFieldsPopoverOpen(!customFieldsPopoverOpen)}
                >
                  <Filter size={16} />
                  <span>
                    {Object.keys(filterCustomFields).filter(k => filterCustomFields[k] !== null && filterCustomFields[k] !== undefined && filterCustomFields[k] !== "").length === 0
                      ? "Campos Customizados"
                      : `${Object.keys(filterCustomFields).filter(k => filterCustomFields[k] !== null && filterCustomFields[k] !== undefined && filterCustomFields[k] !== "").length} campo(s)`}
                  </span>
                  <ChevronDown size={16} className={customFieldsPopoverOpen ? "rotate-180 transition-transform duration-200" : "transition-transform duration-200"} />
                </button>
                {customFieldsPopoverOpen && (
                  <div className="absolute top-full left-0 mt-2 z-50 w-80 bg-white rounded-md border border-[#E5E7EB] shadow-lg p-4 max-h-96 overflow-y-auto">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#E5E7EB]">
                        <span className="text-sm font-medium text-[#1F2937]">Filtrar por Campos Customizados</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFilterCustomFields({});
                          }}
                          className="h-6 px-2 text-xs"
                        >
                          Limpar
                        </Button>
                      </div>
                      {customFields.map((field) => {
                        const currentValue = filterCustomFields[field.id] || "";
                        return (
                          <div key={field.id} className="space-y-2">
                            <Label className="text-xs font-medium text-[#6B7280]">{field.name}</Label>
                            {field.type === "text" || field.type === "textarea" ? (
                              <Input
                                value={currentValue}
                                onChange={(e) => {
                                  setFilterCustomFields({
                                    ...filterCustomFields,
                                    [field.id]: e.target.value || null,
                                  });
                                }}
                                placeholder={`Filtrar por ${field.name.toLowerCase()}...`}
                                className="h-8 text-sm"
                              />
                            ) : field.type === "number" ? (
                              <Input
                                type="number"
                                value={currentValue}
                                onChange={(e) => {
                                  setFilterCustomFields({
                                    ...filterCustomFields,
                                    [field.id]: e.target.value ? Number(e.target.value) : null,
                                  });
                                }}
                                placeholder={`Filtrar por ${field.name.toLowerCase()}...`}
                                className="h-8 text-sm"
                              />
                            ) : field.type === "date" ? (
                              <Input
                                type="date"
                                value={currentValue}
                                onChange={(e) => {
                                  setFilterCustomFields({
                                    ...filterCustomFields,
                                    [field.id]: e.target.value || null,
                                  });
                                }}
                                className="h-8 text-sm"
                              />
                            ) : field.type === "select" && field.options ? (
                              <select
                                value={currentValue}
                                onChange={(e) => {
                                  setFilterCustomFields({
                                    ...filterCustomFields,
                                    [field.id]: e.target.value || null,
                                  });
                                }}
                                className="w-full h-8 text-sm border border-[#E5E7EB] rounded-md px-2"
                              >
                                <option value="">Todos</option>
                                {field.options.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : field.type === "checkbox" ? (
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  checked={currentValue === true}
                                  onCheckedChange={(checked) => {
                                    setFilterCustomFields({
                                      ...filterCustomFields,
                                      [field.id]: checked ? true : null,
                                    });
                                  }}
                                />
                                <Label className="text-sm">Sim</Label>
                                <Checkbox
                                  checked={currentValue === false}
                                  onCheckedChange={(checked) => {
                                    setFilterCustomFields({
                                      ...filterCustomFields,
                                      [field.id]: checked ? false : null,
                                    });
                                  }}
                                />
                                <Label className="text-sm">Não</Label>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button 
              variant="outline" 
              className="gap-2"
              onClick={handleExportLeads}
            >
              <Download size={16} />
              Exportar
            </Button>

            <Button 
              variant="outline"
              className="gap-2"
              onClick={async () => {
                try {
                  // Gerar leads de exemplo via API
                  const sampleLeads = generateSampleLeads();
                  let createdCount = 0;
                  let failedCount = 0;
                  
                  for (const lead of sampleLeads) {
                    try {
                      // Remover campos que não são necessários para criação via API
                      const { id, date, automations, tags, ...leadData } = lead;
                      // Garantir que tags seja um array vazio (o createLead espera objetos com id)
                      await createLead({
                        ...leadData,
                        tags: [],
                      });
                      createdCount++;
                    } catch (error: any) {
                      console.error(`Erro ao criar lead ${lead.name}:`, error);
                      console.error('Detalhes do erro:', {
                        message: error.message,
                        statusCode: error.statusCode,
                        details: error.details,
                        leadData: lead
                      });
                      failedCount++;
                      // Continua criando os outros leads mesmo se um falhar
                    }
                  }
                  
                  if (createdCount > 0) {
                    const message = failedCount > 0 
                      ? `✅ ${createdCount} leads de exemplo foram criados com sucesso! ${failedCount} falharam.`
                      : `✅ ${createdCount} leads de exemplo foram criados com sucesso!`;
                    alert(message);
                    refetch();
                  } else {
                    alert("❌ Não foi possível criar nenhum lead de exemplo. Verifique o console para mais detalhes.");
                  }
                } catch (error) {
                  console.error("Erro ao gerar leads de exemplo:", error);
                  alert("Erro ao gerar leads de exemplo");
                }
              }}
            >
              <Users size={16} />
              Gerar Leads de Exemplo
            </Button>

            <Button 
              className="bg-[#2563EB] hover:bg-[#1E40AF] gap-2"
              onClick={() => navigate("/app/leads/new")}
            >
              <Plus size={16} />
              Novo Lead
            </Button>
          </div>
        </div>

        {/* Table */}
        {filteredLeads.length > 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <Checkbox
                        checked={
                          filteredLeads.length > 0 &&
                          filteredLeads.every(lead => selectedLeads.includes(lead.id))
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                      Telefone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                      E-mail
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                      Origem
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                      Tags
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                      Automações
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                      Data
                    </th>
                    {customFields.length > 0 && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                        Campos Customizados
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {filteredLeads.map((lead) => (
                    <React.Fragment key={lead.id}>
                      <tr className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-6 py-4">
                        <Checkbox
                          checked={selectedLeads.includes(lead.id)}
                          onCheckedChange={() => handleSelectLead(lead.id)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-[#1F2937]">{lead.name}</p>
                      </td>
                      <td className="px-6 py-4 text-[#6B7280]">{lead.phone}</td>
                      <td className="px-6 py-4 text-[#6B7280]">{lead.email}</td>
                      <td className="px-6 py-4">
                        {(() => {
                          const leadWithInteractions: Lead = {
                            ...lead,
                            interactions: getLeadInteractions(lead.id),
                          };
                          const score = calculateLeadScore(leadWithInteractions);
                          saveLeadScore(score);
                          return <LeadScoreBadge score={score.score} />;
                        })()}
                      </td>
                      <td className="px-6 py-4">
                        <LeadStatusBadge status={lead.status} />
                      </td>
                      <td className="px-6 py-4">
                        <LeadSourceBadge source={lead.source} />
                      </td>
                      <td className="px-6 py-4">
                        {lead.tags && lead.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {lead.tags.slice(0, 3).map((tagId: string) => {
                              const tag = getTagById(tagId);
                              if (!tag) return null;
                              return <TagBadge key={tagId} tag={tag} size="sm" />;
                            })}
                            {lead.tags.length > 3 && (
                              <span className="text-xs text-[#6B7280]">+{lead.tags.length - 3}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-[#9CA3AF]">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {lead.automations && lead.automations.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {lead.automations.slice(0, 2).map((automationId: number) => {
                              const automation = getAutomationById(automationId);
                              if (!automation) return null;
                              
                              return (
                                <div
                                  key={automationId}
                                  className={`
                                    inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium
                                    ${automation.type === "whatsapp"
                                      ? "bg-green-50 text-green-700 border border-green-200"
                                      : "bg-blue-50 text-blue-700 border border-blue-200"
                                    }
                                  `}
                                  title={automation.name}
                                >
                                  {automation.type === "whatsapp" ? (
                                    <MessageSquare size={12} className="flex-shrink-0" />
                                  ) : (
                                    <Mail size={12} className="flex-shrink-0" />
                                  )}
                                  <span className="whitespace-nowrap">
                                    {automation.name.length > 15 
                                      ? automation.name.substring(0, 15) + "..." 
                                      : automation.name
                                    }
                                  </span>
                                </div>
                              );
                            })}
                            {lead.automations.length > 2 && (
                              <div
                                className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200"
                                title={`Mais ${lead.automations.length - 2} automação(ões)`}
                              >
                                +{lead.automations.length - 2}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-[#9CA3AF]">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-[#6B7280]">{lead.date}</td>
                      {customFields.length > 0 && (
                        <td className="px-6 py-4">
                          {hasCustomFields(lead) ? (
                            <div className="flex items-center gap-2">
                              <div className="flex flex-wrap gap-1.5 max-w-xs">
                                {customFields.slice(0, 2).map((field) => {
                                  const value = lead.customFields?.[field.id];
                                  if (!value || value === "" || value === null || value === undefined) return null;
                                  return (
                                    <div
                                      key={field.id}
                                      className="text-xs px-2 py-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded text-[#6B7280]"
                                      title={`${field.name}: ${value}`}
                                    >
                                      <span className="font-medium">{field.name}:</span>{" "}
                                      <span className="text-[#1F2937]">
                                        {typeof value === "boolean" ? (value ? "Sim" : "Não") : String(value).substring(0, 15)}
                                        {String(value).length > 15 ? "..." : ""}
                                      </span>
                                    </div>
                                  );
                                })}
                                {customFields.filter(f => {
                                  const value = lead.customFields?.[f.id];
                                  return value && value !== "" && value !== null && value !== undefined;
                                }).length > 2 && (
                                  <button
                                    onClick={() => toggleLeadExpansion(lead.id)}
                                    className="text-xs px-2 py-1 bg-[#2563EB] text-white rounded hover:bg-[#1E40AF] transition-colors"
                                  >
                                    {expandedLeads.has(lead.id) ? "Ocultar" : "Ver mais"}
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-[#9CA3AF]">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              navigate(`/app/leads/${lead.id}/edit`);
                            }}
                            className="p-1.5 hover:bg-[#E5E7EB] rounded transition-colors"
                            type="button"
                          >
                            <Pencil size={16} className="text-[#6B7280]" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteSingleLeadId(lead.id);
                            }}
                            className="p-1.5 hover:bg-red-50 rounded transition-colors"
                            type="button"
                          >
                            <Trash2 size={16} className="text-[#DC2626]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedLeads.has(lead.id) && hasCustomFields(lead) && (
                      <tr className="bg-[#F9FAFB]">
                        <td colSpan={customFields.length > 0 ? 11 : 10} className="px-6 py-4">
                          <div className="space-y-3">
                            <h4 className="text-sm font-medium text-[#1F2937] mb-2">Campos Customizados</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {customFields.map((field) => {
                                const value = lead.customFields?.[field.id];
                                if (!value && value !== false && value !== 0) return null;
                                return (
                                  <CustomFieldDisplay
                                    key={field.id}
                                    field={field}
                                    value={value}
                                    mode="full"
                                    showLabel={true}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB]">
            <EmptyState
              icon={Users}
              title="Nenhum lead encontrado"
              description="Comece adicionando seu primeiro lead ou ajuste os filtros de busca"
              actionLabel="Adicionar Lead"
              onAction={() => navigate("/app/leads/new")}
            />
          </div>
        )}
      </div>
      
      <LeadModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedLead(null);
          // Recarregar dados após fechar o modal
          refetch();
        }}
        lead={selectedLead || undefined}
      />

      {/* Delete Multiple Leads Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Leads Selecionados</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar {selectedLeads.length} lead{selectedLeads.length > 1 ? "s" : ""}? 
              Esta ação não pode ser desfeita e os leads serão removidos permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelectedLeads}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Single Lead Confirmation Dialog */}
      <AlertDialog open={deleteSingleLeadId !== null} onOpenChange={(open) => !open && setDeleteSingleLeadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este lead? 
              Esta ação não pode ser desfeita e o lead será removido permanentemente do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteSingleLeadId(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSingleLeadId !== null) {
                  handleDeleteLead(deleteSingleLeadId);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
