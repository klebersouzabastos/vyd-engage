import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Button, buttonVariants } from "../components/ui/button";
import { LeadSourceBadge } from "../components/LeadSourceBadge";
import { Plus, Phone, Mail, Clock, Edit2, Trash2, X, Check, ChevronDown, Filter, Funnel } from "lucide-react";
import { useTags } from "../contexts/TagsContext";
import { TagBadge } from "../components/TagBadge";
import { useCustomFields } from "../contexts/CustomFieldsContext";
import { CustomFieldDisplay } from "../components/CustomFieldDisplay";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import { addInteraction } from "../utils/interactions";
import { syncAllLeadsToPipeline, syncLeadToPipeline } from "../utils/pipelineSync";
import { LeadModal } from "../components/LeadModal";
import { cn } from "../components/ui/utils";
import { apiClient } from "../services/api/client";
import { useLeads } from "../hooks/useLeads";
import { mapStatusToBackend, mapStatusFromBackend, mapSourceFromBackend } from "../utils/leadEnums";

interface Lead {
  id: number | string; // Aceita number (legado) ou string (UUID da API)
  name: string;
  phone: string;
  email: string;
  source: "meta" | "google" | "organico" | "manual";
  lastActivity: string;
  automationActive: boolean;
  tags?: string[];
}

interface Column {
  id: string;
  title: string;
  leads: Lead[];
  color: string;
  isDefault?: boolean; // true para coluna "novo" que não pode ser deletada
}

interface Funnel {
  id: string;
  name: string;
  columns: Column[];
  isDefault?: boolean; // true para funil de venda obrigatório
}

const STORAGE_KEY = "pipelines";

const DEFAULT_FUNNEL_ID = "funnel-venda";

// Funil inicial padrão (obrigatório)
const createDefaultFunnel = (): Funnel => ({
  id: DEFAULT_FUNNEL_ID,
  name: "Funil de Venda",
  isDefault: true,
  columns: [
    {
      id: "novo",
      title: "Novo",
      color: "bg-blue-500",
      isDefault: true, // Coluna obrigatória que não pode ser deletada
      leads: [],
    },
    {
      id: "contato",
      title: "Em Contato",
      color: "bg-yellow-500",
      leads: [],
    },
    {
      id: "fechado",
      title: "Fechado",
      color: "bg-green-500",
      leads: [],
    },
  ],
});

function getSavedFunnels(): Funnel[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const funnels = JSON.parse(stored);
      // Garantir que sempre existe o funil de venda padrão
      const hasDefaultFunnel = funnels.some((f: Funnel) => f.id === DEFAULT_FUNNEL_ID);
      if (!hasDefaultFunnel) {
        return [createDefaultFunnel(), ...funnels];
      }
      return funnels;
    }
    
    // Migração: tentar converter dados antigos do formato de colunas
    const oldColumnsKey = "pipelineColumns";
    const oldColumns = localStorage.getItem(oldColumnsKey);
    if (oldColumns) {
      try {
        const columns: Column[] = JSON.parse(oldColumns);
        // Garantir que a coluna "novo" tem isDefault
        const columnsWithDefault = columns.map(col => {
          if (col.id === "novo" && !col.isDefault) {
            return { ...col, isDefault: true };
          }
          return col;
        });
        
        // Se não existe coluna "novo", adicionar
        const hasNovoColumn = columnsWithDefault.some(c => c.id === "novo");
        if (!hasNovoColumn) {
          columnsWithDefault.unshift({
            id: "novo",
            title: "Novo",
            color: "bg-blue-500",
            isDefault: true,
            leads: [],
          });
        }
        
        const defaultFunnel: Funnel = {
          id: DEFAULT_FUNNEL_ID,
          name: "Funil de Venda",
          isDefault: true,
          columns: columnsWithDefault,
        };
        
        saveFunnels([defaultFunnel]);
        return [defaultFunnel];
      } catch (error) {
        console.error("Erro ao migrar dados antigos:", error);
      }
    }
  } catch (error) {
    console.error("Erro ao carregar funis:", error);
  }
  return [createDefaultFunnel()];
}

function saveFunnels(funnels: Funnel[]): void {
  try {
    // Garantir que o funil de venda sempre existe
    const hasDefaultFunnel = funnels.some(f => f.id === DEFAULT_FUNNEL_ID);
    if (!hasDefaultFunnel) {
      funnels.unshift(createDefaultFunnel());
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(funnels));
  } catch (error) {
    console.error("Erro ao salvar funis:", error);
  }
}

function getSavedColumns(funnelId: string): Column[] {
  const funnels = getSavedFunnels();
  const funnel = funnels.find(f => f.id === funnelId);
  if (!funnel) {
    return createDefaultFunnel().columns;
  }
  // Garantir que sempre existe a coluna "novo"
  const hasDefaultColumn = funnel.columns.some(c => c.isDefault === true);
  if (!hasDefaultColumn) {
    funnel.columns.unshift({
      id: "novo",
      title: "Novo",
      color: "bg-blue-500",
      isDefault: true,
      leads: [],
    });
    saveFunnels(funnels);
  }
  return funnel.columns;
}

function saveColumns(funnelId: string, columns: Column[]): void {
  const funnels = getSavedFunnels();
  const funnelIndex = funnels.findIndex(f => f.id === funnelId);
  if (funnelIndex === -1) {
    // Se o funil não existe, criar um novo
    funnels.push({
      id: funnelId,
      name: "Novo Funil",
      columns,
    });
  } else {
    // Garantir que sempre existe a coluna "novo"
    const hasDefaultColumn = columns.some(c => c.isDefault === true);
    if (!hasDefaultColumn) {
      columns.unshift({
        id: "novo",
        title: "Novo",
        color: "bg-blue-500",
        isDefault: true,
        leads: [],
      });
    }
    funnels[funnelIndex].columns = columns;
  }
  saveFunnels(funnels);
}

// Função para buscar o lead completo (tenta API primeiro, depois localStorage)
async function getLeadById(leadId: number | string): Promise<any | null> {
  try {
    // Tentar buscar da API primeiro
    try {
      const lead = await apiClient.getLead(String(leadId));
      if (lead) {
        // Transformar para o formato esperado
        return {
          ...lead,
          status: mapStatusFromBackend(lead.status),
          source: mapSourceFromBackend(lead.source),
        };
      }
    } catch (apiError) {
      // Se API falhar, tentar localStorage
      console.log("API não disponível, usando localStorage");
    }
    
    // Fallback: buscar do localStorage
    const stored = localStorage.getItem("leads");
    if (stored) {
      const leads = JSON.parse(stored);
      return leads.find((lead: any) => lead.id === leadId || String(lead.id) === String(leadId)) || null;
    }
  } catch (error) {
    console.error("Erro ao buscar lead:", error);
  }
  return null;
}

// Função para verificar se lead tem campos customizados preenchidos
function hasCustomFields(lead: any): boolean {
  return lead?.customFields && Object.keys(lead.customFields).length > 0 && 
         Object.values(lead.customFields).some((v: any) => v !== null && v !== undefined && v !== "");
}

export function Pipeline() {
  const navigate = useNavigate();
  const { getTagById } = useTags();
  const { fields: customFields } = useCustomFields();
  const { updateLead, refetch } = useLeads();
  const [funnels, setFunnels] = useState<Funnel[]>(getSavedFunnels);
  const [currentFunnelId, setCurrentFunnelId] = useState<string>(DEFAULT_FUNNEL_ID);
  const [columns, setColumns] = useState<Column[]>(() => {
    const currentFunnel = getSavedFunnels().find(f => f.id === DEFAULT_FUNNEL_ID);
    return currentFunnel?.columns || createDefaultFunnel().columns;
  });
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [draggedFromColumn, setDraggedFromColumn] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState("");
  const [deleteColumnId, setDeleteColumnId] = useState<string | null>(null);
  const [createColumnOpen, setCreateColumnOpen] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [createFunnelOpen, setCreateFunnelOpen] = useState(false);
  const [newFunnelName, setNewFunnelName] = useState("");
  const [deleteFunnelId, setDeleteFunnelId] = useState<string | null>(null);
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);
  const [editingFunnelName, setEditingFunnelName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [filterSources, setFilterSources] = useState<string[]>(["meta", "google", "organico", "manual"]);
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartTime = useRef<number>(0);
  const dragStartPosition = useRef<{ x: number; y: number } | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  const isInitialMount = useRef(true);

  // Carregar funis e colunas ao montar e sincronizar leads
  useEffect(() => {
    // Carregar leads da API e sincronizar com o pipeline
    const loadAndSyncLeads = async () => {
      try {
        const result = await apiClient.getLeads();
        if (result && result.leads) {
          // Transformar leads da API para o formato esperado
          const transformedLeads = result.leads.map((lead: any) => ({
            id: lead.id,
            name: lead.name,
            email: lead.email || '',
            phone: lead.phone || '',
            company: lead.company || '',
            position: lead.position || '',
            status: mapStatusFromBackend(lead.status) as any,
            source: mapSourceFromBackend(lead.source) as any,
            score: lead.score || 0,
            customFields: lead.customFields || {},
            notes: lead.notes || '',
            assignedTo: lead.assignedTo || '',
            tags: lead.tags?.map((lt: any) => lt.tag) || [],
            createdAt: lead.createdAt,
            updatedAt: lead.updatedAt,
            automations: [],
          }));
          
          // Sincronizar leads da API com o pipeline
          syncAllLeadsToPipeline(transformedLeads);
        }
      } catch (error) {
        console.error("Erro ao carregar leads da API:", error);
        // Fallback: usar localStorage se API falhar
        syncAllLeadsToPipeline();
      }
    };
    
    loadAndSyncLeads();
    
    // Depois, carregar os funis atualizados (após sincronização)
    let savedFunnels = getSavedFunnels();
    
    // Garantir que sempre existe o funil de venda padrão
    const hasDefaultFunnel = savedFunnels.some(f => f.id === DEFAULT_FUNNEL_ID);
    if (!hasDefaultFunnel) {
      const defaultFunnel = createDefaultFunnel();
      savedFunnels = [defaultFunnel, ...savedFunnels];
      saveFunnels(savedFunnels);
    } else {
      // Garantir que o funil padrão tem a coluna "novo"
      const defaultFunnelIndex = savedFunnels.findIndex(f => f.id === DEFAULT_FUNNEL_ID);
      if (defaultFunnelIndex >= 0) {
        const defaultFunnel = savedFunnels[defaultFunnelIndex];
        const hasDefaultColumn = defaultFunnel.columns.some(c => c.isDefault === true);
        if (!hasDefaultColumn) {
          defaultFunnel.columns.unshift({
            id: "novo",
            title: "Novo",
            color: "bg-blue-500",
            isDefault: true,
            leads: [],
          });
          saveFunnels(savedFunnels);
        }
      }
    }
    
    // Recarregar funis após sincronização (para pegar os leads sincronizados)
    savedFunnels = getSavedFunnels();
    setFunnels(savedFunnels);
    
    // Se não houver funil selecionado ou o funil selecionado não existir mais, usar o padrão
    const currentFunnel = savedFunnels.find(f => f.id === currentFunnelId);
    if (!currentFunnel) {
      const defaultFunnel = savedFunnels.find(f => f.id === DEFAULT_FUNNEL_ID) || savedFunnels[0];
      if (defaultFunnel) {
        setCurrentFunnelId(defaultFunnel.id);
        setColumns(defaultFunnel.columns);
      }
    } else {
      setColumns(currentFunnel.columns);
    }
  }, []);

  // Atualizar colunas quando o funil atual mudar
  useEffect(() => {
    const currentFunnel = funnels.find(f => f.id === currentFunnelId);
    if (currentFunnel) {
      setColumns(currentFunnel.columns);
    }
  }, [currentFunnelId, funnels]);

  // Fechar popover ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(event.target as Node)) {
        const button = (event.target as HTMLElement).closest('button[aria-haspopup="true"]');
        if (!button) {
          setFilterPopoverOpen(false);
        }
      }
    };

    if (filterPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filterPopoverOpen]);

  // Opções de origem disponíveis
  const sourceOptions = [
    { value: "meta", label: "Meta Ads" },
    { value: "google", label: "Google Ads" },
    { value: "organico", label: "Orgânico" },
    { value: "manual", label: "Manual" },
  ];

  // Filtrar colunas baseado nas origens selecionadas
  const filteredColumns = columns.map((column) => ({
    ...column,
    leads: filterSources.length === 0
      ? [] // Se nenhuma origem selecionada, não mostrar leads
      : filterSources.length === sourceOptions.length
      ? column.leads // Se todas selecionadas, mostrar todos
      : column.leads.filter((lead) => filterSources.includes(lead.source)),
  }));

  const handleSourceToggle = (source: string) => {
    setFilterSources((prev) => {
      if (prev.includes(source)) {
        return prev.filter((s) => s !== source);
      } else {
        return [...prev, source];
      }
    });
  };

  const handleSelectAll = () => {
    if (filterSources.length === sourceOptions.length) {
      setFilterSources([]);
    } else {
      setFilterSources(sourceOptions.map((opt) => opt.value));
    }
  };

  // Salvar colunas sempre que houver mudanças
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Salvar sempre que columns mudar
    saveColumns(currentFunnelId, columns);
    
    // Atualizar funis no estado
    const updatedFunnels = funnels.map(f => 
      f.id === currentFunnelId ? { ...f, columns } : f
    );
    setFunnels(updatedFunnels);
  }, [columns]);

  const handleDragStart = (e: React.DragEvent, lead: Lead, columnId: string) => {
    setDraggedLead(lead);
    setDraggedFromColumn(columnId);
    setIsDragging(true);
    dragStartTime.current = Date.now();
    dragStartPosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetColumnId: string) => {
    if (!draggedLead || !draggedFromColumn) return;

    const newColumns = columns.map((col) => {
      if (col.id === draggedFromColumn) {
        return {
          ...col,
          leads: col.leads.filter((l) => l.id !== draggedLead.id),
        };
      }
      if (col.id === targetColumnId) {
        return {
          ...col,
          leads: [...col.leads, draggedLead],
        };
      }
      return col;
    });

    setColumns(newColumns);
    
    // Buscar o lead completo da API para atualizar
    try {
      const targetColumnTitle = newColumns.find(col => col.id === targetColumnId)?.title || targetColumnId;
      
      // Buscar lead completo da API
      const fullLead = await apiClient.getLead(String(draggedLead.id));
      
      if (fullLead) {
        // Atualizar lead na API com novo status
        const updatedLead = await updateLead(String(draggedLead.id), {
          ...fullLead,
          status: targetColumnId as any,
        });
        
        // Sincronizar com o pipeline
        syncLeadToPipeline(updatedLead);
        
        // Adicionar interação de mudança de status na API
        try {
          await apiClient.createInteraction({
            leadId: String(draggedLead.id),
            type: "status_change",
            content: `Status alterado de "${columns.find(col => col.id === draggedFromColumn)?.title || draggedFromColumn}" para "${targetColumnTitle}"`,
            metadata: {
              oldStatus: draggedFromColumn,
              newStatus: targetColumnId,
            },
          });
        } catch (interactionError) {
          console.error("Erro ao criar interação:", interactionError);
          // Continuar mesmo se falhar ao criar interação
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar status do lead na API:", error);
      
      // Fallback: atualizar localStorage se API falhar
      try {
        const stored = localStorage.getItem("leads");
        if (stored) {
          const leads = JSON.parse(stored);
          const leadIndex = leads.findIndex((l: any) => l.id === draggedLead.id);
          if (leadIndex !== -1) {
            leads[leadIndex] = {
              ...leads[leadIndex],
              status: targetColumnId,
              updatedAt: new Date().toISOString(),
            };
            localStorage.setItem("leads", JSON.stringify(leads));
            
            // Adicionar interação de mudança de status no localStorage
            addInteraction(draggedLead.id, {
              type: "status_change",
              content: `Status alterado para "${newColumns.find(col => col.id === targetColumnId)?.title || targetColumnId}"`,
              metadata: {
                oldStatus: draggedFromColumn,
                newStatus: targetColumnId,
              },
            });
          }
        }
      } catch (localError) {
        console.error("Erro ao atualizar status do lead no localStorage:", localError);
      }
    }
    
    setDraggedLead(null);
    setDraggedFromColumn(null);
    setIsDragging(false);
    dragStartTime.current = 0;
    dragStartPosition.current = null;
  };

  const handleCardClick = async (e: React.MouseEvent, lead: Lead) => {
    // Não abrir modal se estiver arrastando
    if (isDragging) {
      return;
    }
    
    // Verificar se houve movimento significativo durante o drag
    // Só verificar se realmente houve um drag start recente
    if (dragStartTime.current > 0 && dragStartPosition.current) {
      const timeSinceDragStart = Date.now() - dragStartTime.current;
      if (timeSinceDragStart < 300) {
        const distance = Math.sqrt(
          Math.pow(e.clientX - dragStartPosition.current.x, 2) +
          Math.pow(e.clientY - dragStartPosition.current.y, 2)
        );
        // Se moveu mais de 5 pixels, foi um drag, não um clique
        if (distance > 5) {
          return;
        }
      }
    }
    
    // Buscar o lead completo (da API ou localStorage)
    const fullLead = await getLeadById(lead.id);
    if (fullLead) {
      setSelectedLead(fullLead);
      setModalOpen(true);
    } else {
      // Se não encontrar, usar os dados básicos do card
      setSelectedLead({
        ...lead,
        status: columns.find(col => col.leads.some(l => l.id === lead.id))?.id || "novo",
      });
      setModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedLead(null);
    // Recarregar colunas após fechar o modal para refletir possíveis mudanças
    const currentFunnel = funnels.find(f => f.id === currentFunnelId);
    if (currentFunnel) {
      setColumns(currentFunnel.columns);
    }
  };

  const handleStartEdit = (columnId: string, currentTitle: string) => {
    setEditingColumnId(columnId);
    setEditingColumnTitle(currentTitle);
  };

  const handleSaveEdit = () => {
    if (!editingColumnId || !editingColumnTitle.trim()) return;

    const trimmedTitle = editingColumnTitle.trim();
    
    // Verificar se já existe uma coluna com o mesmo nome (ignorando a coluna atual)
    const duplicateColumn = columns.find(
      (col) => col.id !== editingColumnId && col.title.toLowerCase() === trimmedTitle.toLowerCase()
    );

    if (duplicateColumn) {
      setErrorMessage(`Já existe uma coluna com o nome "${duplicateColumn.title}". Por favor, escolha um nome diferente.`);
      return;
    }

    setErrorMessage("");
    const updatedColumns = columns.map((col) =>
      col.id === editingColumnId
        ? { ...col, title: trimmedTitle }
        : col
    );
    setColumns(updatedColumns);
    setEditingColumnId(null);
    setEditingColumnTitle("");
  };

  const handleCancelEdit = () => {
    setEditingColumnId(null);
    setEditingColumnTitle("");
    setErrorMessage("");
  };

  const handleCreateColumn = () => {
    if (!newColumnTitle.trim()) return;

    const trimmedTitle = newColumnTitle.trim();
    
    // Verificar se já existe uma coluna com o mesmo nome
    const duplicateColumn = columns.find(
      (col) => col.title.toLowerCase() === trimmedTitle.toLowerCase()
    );

    if (duplicateColumn) {
      setErrorMessage(`Já existe uma coluna com o nome "${duplicateColumn.title}". Por favor, escolha um nome diferente.`);
      return;
    }

    setErrorMessage("");
    const colors = ["bg-blue-500", "bg-yellow-500", "bg-green-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const newId = `col-${Date.now()}`;

    const newColumn: Column = {
      id: newId,
      title: trimmedTitle,
      color: randomColor,
      leads: [],
      isDefault: false, // Novas colunas não são padrão
    };

    const updatedColumns = [...columns, newColumn];
    setColumns(updatedColumns);
    setNewColumnTitle("");
    setCreateColumnOpen(false);
  };

  const handleDeleteColumn = () => {
    if (!deleteColumnId) return;

    const column = columns.find((col) => col.id === deleteColumnId);
    if (!column) return;

    // Não permitir deletar a coluna padrão (novo)
    if (column.isDefault) {
      setErrorMessage("Não é possível deletar a coluna padrão. Ela pode ser renomeada, mas não deletada.");
      setDeleteColumnId(null);
      return;
    }

    if (column.leads.length > 0) {
      return; // Não deve acontecer devido à validação no botão
    }

    const updatedColumns = columns.filter((col) => col.id !== deleteColumnId);
    setColumns(updatedColumns);
    setDeleteColumnId(null);
  };

  const handleCreateFunnel = () => {
    if (!newFunnelName.trim()) return;

    const trimmedName = newFunnelName.trim();
    
    // Verificar se já existe um funil com o mesmo nome
    const duplicateFunnel = funnels.find(
      (f) => f.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicateFunnel) {
      setErrorMessage(`Já existe um funil com o nome "${duplicateFunnel.name}". Por favor, escolha um nome diferente.`);
      return;
    }

    setErrorMessage("");
    const newFunnelId = `funnel-${Date.now()}`;
    const newFunnel: Funnel = {
      id: newFunnelId,
      name: trimmedName,
      columns: [
        {
          id: "novo",
          title: "Novo",
          color: "bg-blue-500",
          isDefault: true, // Coluna obrigatória
          leads: [],
        },
      ],
    };

    const updatedFunnels = [...funnels, newFunnel];
    setFunnels(updatedFunnels);
    saveFunnels(updatedFunnels);
    setNewFunnelName("");
    setCreateFunnelOpen(false);
    
    // Trocar para o novo funil
    setCurrentFunnelId(newFunnelId);
    setColumns(newFunnel.columns);
  };

  const handleDeleteFunnel = () => {
    if (!deleteFunnelId) return;

    const funnel = funnels.find((f) => f.id === deleteFunnelId);
    if (!funnel) return;

    // Não permitir deletar o funil de venda padrão
    if (funnel.isDefault) {
      setErrorMessage("Não é possível deletar o Funil de Venda. Ele é obrigatório no sistema.");
      setDeleteFunnelId(null);
      return;
    }

    const updatedFunnels = funnels.filter((f) => f.id !== deleteFunnelId);
    setFunnels(updatedFunnels);
    saveFunnels(updatedFunnels);
    
    // Se o funil deletado era o atual, trocar para o funil de venda
    if (deleteFunnelId === currentFunnelId) {
      const defaultFunnel = updatedFunnels.find(f => f.id === DEFAULT_FUNNEL_ID) || updatedFunnels[0];
      setCurrentFunnelId(defaultFunnel.id);
      setColumns(defaultFunnel.columns);
    }
    
    setDeleteFunnelId(null);
  };

  const handleStartEditFunnel = (funnelId: string, currentName: string) => {
    setEditingFunnelId(funnelId);
    setEditingFunnelName(currentName);
  };

  const handleSaveEditFunnel = () => {
    if (!editingFunnelId || !editingFunnelName.trim()) return;

    const trimmedName = editingFunnelName.trim();
    
    // Verificar se já existe um funil com o mesmo nome (ignorando o atual)
    const duplicateFunnel = funnels.find(
      (f) => f.id !== editingFunnelId && f.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicateFunnel) {
      setErrorMessage(`Já existe um funil com o nome "${duplicateFunnel.name}". Por favor, escolha um nome diferente.`);
      return;
    }

    setErrorMessage("");
    const updatedFunnels = funnels.map((f) =>
      f.id === editingFunnelId ? { ...f, name: trimmedName } : f
    );
    setFunnels(updatedFunnels);
    saveFunnels(updatedFunnels);
    setEditingFunnelId(null);
    setEditingFunnelName("");
  };

  const handleCancelEditFunnel = () => {
    setEditingFunnelId(null);
    setEditingFunnelName("");
    setErrorMessage("");
  };

  const handleFunnelChange = (funnelId: string) => {
    const selectedFunnel = funnels.find(f => f.id === funnelId);
    if (selectedFunnel) {
      setCurrentFunnelId(funnelId);
      setColumns(selectedFunnel.columns);
    }
  };

  return (
    <div className="min-h-screen">
      <Header title="Funil de Vendas" subtitle="Visualize e gerencie seu pipeline" />
      
      <div className="p-8">
        {/* Funnel Selector */}
        <div className="mb-6 bg-white rounded-lg p-4 shadow-sm border border-gray-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <Funnel size={20} className="text-gray-600" />
              <div className="flex items-center gap-2 flex-1">
                {editingFunnelId === currentFunnelId ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editingFunnelName}
                      onChange={(e) => {
                        setEditingFunnelName(e.target.value);
                        setErrorMessage("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEditFunnel();
                        if (e.key === "Escape") handleCancelEditFunnel();
                      }}
                      className={`h-8 text-sm flex-1 ${errorMessage ? "border-red-500" : ""}`}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleSaveEditFunnel}
                      className="h-8 w-8 p-0"
                    >
                      <Check size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEditFunnel}
                      className="h-8 w-8 p-0"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ) : (
                  <>
                    <select
                      value={currentFunnelId}
                      onChange={(e) => handleFunnelChange(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      {funnels.map((funnel) => (
                        <option key={funnel.id} value={funnel.id}>
                          {funnel.name} {funnel.isDefault ? "(Padrão)" : ""}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartEditFunnel(currentFunnelId, funnels.find(f => f.id === currentFunnelId)?.name || "")}
                      className="h-8 w-8 p-0 hover:bg-gray-200"
                      title="Renomear funil"
                    >
                      <Edit2 size={14} className="text-gray-600" />
                    </Button>
                    {!funnels.find(f => f.id === currentFunnelId)?.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteFunnelId(currentFunnelId)}
                        className="h-8 w-8 p-0 hover:bg-gray-200"
                        title="Deletar funil"
                      >
                        <Trash2 size={14} className="text-gray-600" />
                      </Button>
                    )}
                  </>
                )}
              </div>
              {errorMessage && editingFunnelId && (
                <p className="text-xs text-red-600">{errorMessage}</p>
              )}
            </div>
            <Button
              variant="outline"
              className="border-2 border-primary text-primary hover:bg-primary hover:text-white gap-2"
              onClick={() => setCreateFunnelOpen(true)}
            >
              <Plus size={16} />
              Novo Funil
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4 relative" ref={filterPopoverRef}>
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "gap-2 border border-gray-300 bg-white hover:bg-gray-50 cursor-pointer"
              )}
              aria-expanded={filterPopoverOpen}
              aria-haspopup="true"
              onClick={(e) => {
                e.stopPropagation();
                setFilterPopoverOpen(!filterPopoverOpen);
              }}
            >
              <Filter size={16} />
              <span>
                {filterSources.length === 0
                  ? "Nenhuma origem"
                  : filterSources.length === sourceOptions.length
                  ? "Todas as origens"
                  : `${filterSources.length} origem${filterSources.length > 1 ? "s" : ""} selecionada${filterSources.length > 1 ? "s" : ""}`}
              </span>
              <ChevronDown size={16} className={filterPopoverOpen ? "rotate-180 transition-transform duration-200" : "transition-transform duration-200"} />
            </button>
            {filterPopoverOpen && (
              <div className="absolute top-full left-0 mt-2 z-50 w-56 bg-white rounded-md border border-gray-300 shadow-lg p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-300">
                    <span className="text-sm font-medium text-gray-900">Filtrar por Origem</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="h-6 px-2 text-xs"
                    >
                      {filterSources.length === sourceOptions.length ? "Desmarcar" : "Selecionar todas"}
                    </Button>
                  </div>
                  {sourceOptions.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded-md -mx-2"
                      onClick={() => handleSourceToggle(option.value)}
                    >
                      <Checkbox
                        id={`source-${option.value}`}
                        checked={filterSources.includes(option.value)}
                        onCheckedChange={() => handleSourceToggle(option.value)}
                      />
                      <label
                        htmlFor={`source-${option.value}`}
                        className="text-sm text-gray-900 cursor-pointer flex-1"
                      >
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              className="border-2 border-primary text-primary hover:bg-primary hover:text-white gap-2"
              onClick={() => setCreateColumnOpen(true)}
            >
              <Plus size={16} />
              Nova Coluna
            </Button>
            <Button 
              className="bg-primary hover:bg-primary-dark gap-2"
              onClick={() => navigate("/app/leads/new")}
            >
              <Plus size={16} />
              Novo Lead
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="overflow-x-auto pb-4 -mx-2 px-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <div className="flex gap-6 min-w-max">
            {filteredColumns.map((column) => (
              <div
                key={column.id}
                className="bg-gray-100 rounded-lg p-4 min-w-[320px] max-w-[320px] flex-shrink-0"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(column.id)}
              >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 flex-1">
                  <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                  {editingColumnId === column.id ? (
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingColumnTitle}
                          onChange={(e) => {
                            setEditingColumnTitle(e.target.value);
                            setErrorMessage(""); // Limpar erro ao digitar
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          className={`h-8 text-sm ${errorMessage ? "border-red-500" : ""}`}
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleSaveEdit}
                          className="h-8 w-8 p-0"
                        >
                          <Check size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEdit}
                          className="h-8 w-8 p-0"
                        >
                          <X size={14} />
                        </Button>
                      </div>
                      {errorMessage && (
                        <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
                      )}
                    </div>
                  ) : (
                    <>
                      <h3 className="text-gray-900">{column.title}</h3>
                      <span className="text-sm text-gray-600 bg-white px-2 py-0.5 rounded">
                        {column.leads.length}
                      </span>
                    </>
                  )}
                </div>
                {editingColumnId !== column.id && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartEdit(column.id, column.title)}
                      className="h-7 w-7 p-0 hover:bg-gray-200"
                      title="Renomear coluna"
                    >
                      <Edit2 size={14} className="text-gray-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteColumnId(column.id)}
                      disabled={column.leads.length > 0 || column.isDefault}
                      className="h-7 w-7 p-0 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={
                        column.isDefault 
                          ? "Não é possível deletar a coluna padrão" 
                          : column.leads.length > 0 
                          ? "Não é possível deletar coluna com leads" 
                          : "Deletar coluna"
                      }
                    >
                      <Trash2 size={14} className="text-gray-600" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {column.leads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead, column.id)}
                    onDragEnd={() => {
                      setIsDragging(false);
                      dragStartTime.current = 0;
                      dragStartPosition.current = null;
                    }}
                    onClick={(e) => handleCardClick(e, lead)}
                    className="bg-white rounded-lg p-4 shadow-sm border border-gray-300 cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900 mb-1">{lead.name}</h4>
                        <LeadSourceBadge source={lead.source} />
                      </div>
                      {lead.automationActive && (
                        <div className="w-2 h-2 bg-success rounded-full" title="Automação ativa"></div>
                      )}
                    </div>

                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone size={14} />
                        <span>{lead.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail size={14} />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    </div>

                    {lead.tags && lead.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {lead.tags.slice(0, 2).map((tagId: string) => {
                          const tag = getTagById(tagId);
                          if (!tag) return null;
                          return <TagBadge key={tagId} tag={tag} size="sm" />;
                        })}
                        {lead.tags.length > 2 && (
                          <span className="text-xs text-gray-600 px-1.5 py-0.5 bg-gray-100 rounded">
                            +{lead.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Campos Customizados - Removido pois getLeadById é async e PipelineLead não inclui customFields */}
                    {/* Para ver campos customizados, abra o lead clicando nele */}
                    {false && (() => {
                      // Código removido - campos customizados não estão disponíveis no card do pipeline
                      const fullLead = null;
                      const hasCustomFieldsData = false;
                      if (!hasCustomFieldsData || customFields.length === 0) return null;
                      
                      const customFieldsWithValues = customFields.filter(f => {
                        const value = fullLead.customFields?.[f.id];
                        return value !== null && value !== undefined && value !== "";
                      }).slice(0, 2);
                      
                      if (customFieldsWithValues.length === 0) return null;
                      
                      return (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="mb-3 space-y-1.5">
                                {customFieldsWithValues.map((field) => {
                                  const value = fullLead.customFields?.[field.id];
                                  return (
                                    <CustomFieldDisplay
                                      key={field.id}
                                      field={field}
                                      value={value}
                                      mode="compact"
                                      showLabel={true}
                                    />
                                  );
                                })}
                                {customFields.filter(f => {
                                  const value = fullLead.customFields?.[f.id];
                                  return value !== null && value !== undefined && value !== "";
                                }).length > 2 && (
                                  <div className="text-xs text-gray-600 pt-1">
                                    +{customFields.filter(f => {
                                      const value = fullLead.customFields?.[f.id];
                                      return value !== null && value !== undefined && value !== "";
                                    }).length - 2} mais
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <div className="space-y-2">
                                <div className="font-medium text-sm mb-2">Campos Customizados</div>
                                {customFields.map((field) => {
                                  const value = fullLead.customFields?.[field.id];
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
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}

                    <div className="flex items-center gap-2 text-xs text-gray-600 pt-3 border-t border-gray-300">
                      <Clock size={12} />
                      <span>{lead.lastActivity}</span>
                    </div>
                  </div>
                ))}

                {column.leads.length === 0 && (
                  <div className="text-center py-8 text-gray-600">
                    <p className="text-sm">Nenhum lead nesta etapa</p>
                  </div>
                )}
              </div>
            </div>
            ))}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="mt-8 bg-white rounded-lg p-6 shadow-sm border border-gray-300">
          <h3 className="text-gray-900 mb-4">Resumo do Funil</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total de Leads</p>
              <p className="text-2xl font-semibold text-gray-900">
                {filteredColumns.reduce((acc, col) => acc + col.leads.length, 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Taxa de Conversão</p>
              <p className="text-2xl font-semibold text-success">14.3%</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Tempo Médio no Funil</p>
              <p className="text-2xl font-semibold text-gray-900">4.2 dias</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Automações Ativas</p>
              <p className="text-2xl font-semibold text-primary">
                {filteredColumns.reduce((acc, col) => 
                  acc + col.leads.filter(l => l.automationActive).length, 0
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Column Dialog */}
      <Dialog open={createColumnOpen} onOpenChange={setCreateColumnOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader className="text-left space-y-0 pb-4">
            <DialogTitle className="text-lg font-semibold text-gray-900">Criar Nova Coluna</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">
                Nome da Coluna
              </label>
              <Input
                value={newColumnTitle}
                onChange={(e) => {
                  setNewColumnTitle(e.target.value);
                  setErrorMessage(""); // Limpar erro ao digitar
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateColumn();
                }}
                placeholder="Ex: Proposta Enviada"
                className={errorMessage ? "border-red-500" : ""}
                autoFocus
              />
              {errorMessage && (
                <p className="text-xs text-red-600 mt-2">{errorMessage}</p>
              )}
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setCreateColumnOpen(false);
                setNewColumnTitle("");
                setErrorMessage("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateColumn}
              disabled={!newColumnTitle.trim()}
              className="bg-primary hover:bg-primary-dark"
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Column Alert Dialog */}
      <AlertDialog open={deleteColumnId !== null} onOpenChange={(open) => !open && setDeleteColumnId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Coluna</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteColumnId && (() => {
                const column = columns.find((col) => col.id === deleteColumnId);
                if (column?.isDefault) {
                  return (
                    <span className="text-red-600">
                      Não é possível deletar a coluna padrão "{column.title}". Ela pode ser renomeada, mas não deletada.
                    </span>
                  );
                }
                if (column?.leads.length > 0) {
                  return (
                    <span className="text-red-600">
                      Não é possível deletar esta coluna pois ela contém {column.leads.length} lead(s).
                      Por favor, mova ou remova os leads antes de deletar a coluna.
                    </span>
                  );
                }
                return `Tem certeza que deseja deletar a coluna "${column?.title}"? Esta ação não pode ser desfeita.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteColumnId(null)}>
              Cancelar
            </AlertDialogCancel>
            {deleteColumnId && (() => {
              const column = columns.find((col) => col.id === deleteColumnId);
              return column && !column.isDefault && column.leads.length === 0 && (
                <AlertDialogAction
                  onClick={handleDeleteColumn}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Deletar
                </AlertDialogAction>
              );
            })()}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Funnel Dialog */}
      <Dialog open={createFunnelOpen} onOpenChange={setCreateFunnelOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader className="text-left space-y-0 pb-4">
            <DialogTitle className="text-lg font-semibold text-gray-900">Criar Novo Funil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-900 mb-2 block">
                Nome do Funil
              </label>
              <Input
                value={newFunnelName}
                onChange={(e) => {
                  setNewFunnelName(e.target.value);
                  setErrorMessage("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateFunnel();
                }}
                placeholder="Ex: Funil de Marketing"
                className={errorMessage ? "border-red-500" : ""}
                autoFocus
              />
              {errorMessage && (
                <p className="text-xs text-red-600 mt-2">{errorMessage}</p>
              )}
              <p className="text-xs text-gray-600 mt-2">
                O funil será criado com uma coluna padrão chamada "Novo" que não pode ser deletada.
              </p>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setCreateFunnelOpen(false);
                setNewFunnelName("");
                setErrorMessage("");
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateFunnel}
              disabled={!newFunnelName.trim()}
              className="bg-primary hover:bg-primary-dark"
            >
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Funnel Alert Dialog */}
      <AlertDialog open={deleteFunnelId !== null} onOpenChange={(open) => !open && setDeleteFunnelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Funil</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFunnelId && (() => {
                const funnel = funnels.find((f) => f.id === deleteFunnelId);
                if (funnel?.isDefault) {
                  return (
                    <span className="text-red-600">
                      Não é possível deletar o Funil de Venda. Ele é obrigatório no sistema.
                    </span>
                  );
                }
                return `Tem certeza que deseja deletar o funil "${funnel?.name}"? Esta ação não pode ser desfeita.`;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteFunnelId(null)}>
              Cancelar
            </AlertDialogCancel>
            {deleteFunnelId && (() => {
              const funnel = funnels.find((f) => f.id === deleteFunnelId);
              return funnel && !funnel.isDefault && (
                <AlertDialogAction
                  onClick={handleDeleteFunnel}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Deletar
                </AlertDialogAction>
              );
            })()}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lead Modal */}
      <LeadModal
        open={modalOpen}
        onClose={handleCloseModal}
        lead={selectedLead}
      />
    </div>
  );
}
