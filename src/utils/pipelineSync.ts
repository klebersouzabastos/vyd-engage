import { Lead } from "../types";

// Interface do Lead no Pipeline
export interface PipelineLead {
  id: number;
  name: string;
  phone: string;
  email: string;
  source: "meta" | "google" | "organico" | "manual";
  lastActivity: string;
  automationActive: boolean;
  tags?: string[];
}

// Interface da Coluna do Pipeline
export interface PipelineColumn {
  id: string;
  title: string;
  leads: PipelineLead[];
  color: string;
}

const STORAGE_KEY_PIPELINES = "pipelines";
const STORAGE_KEY_COLUMNS = "pipelineColumns"; // Mantido para compatibilidade
const DEFAULT_FUNNEL_ID = "funnel-venda";

// Mapear status do lead para coluna do pipeline
const statusToColumnMap: Record<string, string> = {
  novo: "novo",
  contato: "contato",
  fechado: "fechado",
  perdido: "perdido",
};

interface Funnel {
  id: string;
  name: string;
  columns: PipelineColumn[];
  isDefault?: boolean;
}

// Converter Lead para PipelineLead
function convertLeadToPipelineLead(lead: Lead): PipelineLead {
  // Calcular última atividade baseado na data de criação/atualização
  const lastUpdate = lead.updatedAt ? new Date(lead.updatedAt) : (lead.createdAt ? new Date(lead.createdAt) : new Date());
  const now = new Date();
  const diffMs = now.getTime() - lastUpdate.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  let lastActivity = "Agora";
  if (diffDays > 0) {
    lastActivity = `${diffDays} dia${diffDays > 1 ? "s" : ""} atrás`;
  } else if (diffHours > 0) {
    lastActivity = `${diffHours} hora${diffHours > 1 ? "s" : ""} atrás`;
  } else {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    if (diffMinutes > 0) {
      lastActivity = `${diffMinutes} min atrás`;
    }
  }

  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    source: lead.source,
    lastActivity,
    automationActive: lead.automations && lead.automations.length > 0,
    tags: lead.tags || [],
  };
}

// Obter funis salvos
function getSavedFunnels(): Funnel[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PIPELINES);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Erro ao carregar funis:", error);
  }
  return [];
}

// Obter colunas do pipeline (funil de venda padrão)
export function getPipelineColumns(): PipelineColumn[] {
  try {
    // Tentar obter do novo sistema de funis
    const funnels = getSavedFunnels();
    const defaultFunnel = funnels.find(f => f.id === DEFAULT_FUNNEL_ID);
    if (defaultFunnel) {
      return defaultFunnel.columns;
    }

    // Fallback: tentar obter do sistema antigo
    const stored = localStorage.getItem(STORAGE_KEY_COLUMNS);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Erro ao carregar colunas do pipeline:", error);
  }
  
  // Retornar colunas padrão
  return [
    {
      id: "novo",
      title: "Novo",
      color: "bg-blue-500",
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
    {
      id: "perdido",
      title: "Perdido",
      color: "bg-red-500",
      leads: [],
    },
  ];
}

// Salvar colunas do pipeline (funil de venda padrão)
export function savePipelineColumns(columns: PipelineColumn[]): void {
  try {
    const funnels = getSavedFunnels();
    const defaultFunnelIndex = funnels.findIndex(f => f.id === DEFAULT_FUNNEL_ID);
    
    if (defaultFunnelIndex >= 0) {
      funnels[defaultFunnelIndex].columns = columns;
      localStorage.setItem(STORAGE_KEY_PIPELINES, JSON.stringify(funnels));
    } else {
      // Se não existe o funil padrão, criar
      funnels.push({
        id: DEFAULT_FUNNEL_ID,
        name: "Funil de Venda",
        isDefault: true,
        columns,
      });
      localStorage.setItem(STORAGE_KEY_PIPELINES, JSON.stringify(funnels));
    }
    
    // Manter compatibilidade com sistema antigo
    localStorage.setItem(STORAGE_KEY_COLUMNS, JSON.stringify(columns));
  } catch (error) {
    console.error("Erro ao salvar colunas do pipeline:", error);
  }
}

// Sincronizar um lead com o pipeline (funil de venda padrão)
export function syncLeadToPipeline(lead: Lead): void {
  // Obter ou criar o funil de venda padrão
  let funnels = getSavedFunnels();
  let defaultFunnel = funnels.find(f => f.id === DEFAULT_FUNNEL_ID);
  
  if (!defaultFunnel) {
    // Criar funil de venda padrão se não existir
    defaultFunnel = {
      id: DEFAULT_FUNNEL_ID,
      name: "Funil de Venda",
      isDefault: true,
      columns: [
        {
          id: "novo",
          title: "Novo",
          color: "bg-blue-500",
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
        {
          id: "perdido",
          title: "Perdido",
          color: "bg-red-500",
          leads: [],
        },
      ],
    };
    funnels.push(defaultFunnel);
  }

  // Garantir que existe a coluna "novo" padrão
  const hasNovoColumn = defaultFunnel.columns.some(col => col.id === "novo");
  if (!hasNovoColumn) {
    defaultFunnel.columns.unshift({
      id: "novo",
      title: "Novo",
      color: "bg-blue-500",
      leads: [],
    });
  }

  const leadStatus = lead.status || "novo";
  const targetColumnId = statusToColumnMap[leadStatus] || "novo";
  
  // Encontrar ou criar a coluna correspondente
  let targetColumn = defaultFunnel.columns.find(col => col.id === targetColumnId);
  if (!targetColumn) {
    // Se a coluna não existir, criar uma nova
    targetColumn = {
      id: targetColumnId,
      title: leadStatus.charAt(0).toUpperCase() + leadStatus.slice(1),
      color: "bg-gray-500",
      leads: [],
    };
    defaultFunnel.columns.push(targetColumn);
  }

  // Converter lead para formato do pipeline
  const pipelineLead = convertLeadToPipelineLead(lead);

  // Remover o lead de todas as colunas do funil de venda (caso já exista)
  defaultFunnel.columns.forEach(col => {
    col.leads = col.leads.filter(l => l.id !== lead.id);
  });

  // Adicionar o lead na coluna correta
  const existingIndex = targetColumn.leads.findIndex(l => l.id === lead.id);
  if (existingIndex >= 0) {
    // Atualizar lead existente
    targetColumn.leads[existingIndex] = pipelineLead;
  } else {
    // Adicionar novo lead
    targetColumn.leads.push(pipelineLead);
  }

  // Atualizar funis salvos
  const defaultFunnelIndex = funnels.findIndex(f => f.id === DEFAULT_FUNNEL_ID);
  if (defaultFunnelIndex >= 0) {
    funnels[defaultFunnelIndex] = defaultFunnel;
  } else {
    funnels.push(defaultFunnel);
  }

  // Salvar funis atualizados
  localStorage.setItem(STORAGE_KEY_PIPELINES, JSON.stringify(funnels));
  
  // Manter compatibilidade com sistema antigo
  savePipelineColumns(defaultFunnel.columns);
}

// Remover lead do pipeline (funil de venda padrão)
export function removeLeadFromPipeline(leadId: number): void {
  // Obter ou criar o funil de venda padrão
  let funnels = getSavedFunnels();
  let defaultFunnel = funnels.find(f => f.id === DEFAULT_FUNNEL_ID);
  
  if (!defaultFunnel) {
    return; // Se não existe o funil padrão, não há nada para remover
  }

  // Remover lead de todas as colunas do funil de venda
  defaultFunnel.columns.forEach(col => {
    col.leads = col.leads.filter(l => l.id !== leadId);
  });

  // Atualizar funis salvos
  const defaultFunnelIndex = funnels.findIndex(f => f.id === DEFAULT_FUNNEL_ID);
  if (defaultFunnelIndex >= 0) {
    funnels[defaultFunnelIndex] = defaultFunnel;
  } else {
    funnels.push(defaultFunnel);
  }

  // Salvar funis atualizados
  localStorage.setItem(STORAGE_KEY_PIPELINES, JSON.stringify(funnels));
  
  // Manter compatibilidade com sistema antigo
  savePipelineColumns(defaultFunnel.columns);
}

// Sincronizar todos os leads com o pipeline (funil de venda padrão)
export function syncAllLeadsToPipeline(): void {
  try {
    const stored = localStorage.getItem("leads");
    if (!stored) return;

    const leads: Lead[] = JSON.parse(stored);
    
    // Obter ou criar o funil de venda padrão
    let funnels = getSavedFunnels();
    let defaultFunnel = funnels.find(f => f.id === DEFAULT_FUNNEL_ID);
    
    if (!defaultFunnel) {
      // Criar funil de venda padrão se não existir
      defaultFunnel = {
        id: DEFAULT_FUNNEL_ID,
        name: "Funil de Venda",
        isDefault: true,
        columns: [
          {
            id: "novo",
            title: "Novo",
            color: "bg-blue-500",
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
          {
            id: "perdido",
            title: "Perdido",
            color: "bg-red-500",
            leads: [],
          },
        ],
      };
      funnels.push(defaultFunnel);
    }

    // Garantir que existe a coluna "novo" padrão
    const hasNovoColumn = defaultFunnel.columns.some(col => col.id === "novo");
    if (!hasNovoColumn) {
      defaultFunnel.columns.unshift({
        id: "novo",
        title: "Novo",
        color: "bg-blue-500",
        leads: [],
      });
    }

    // Limpar todas as colunas do funil de venda
    defaultFunnel.columns.forEach(col => {
      col.leads = [];
    });

    // Adicionar cada lead na coluna correspondente do funil de venda
    leads.forEach(lead => {
      const leadStatus = lead.status || "novo";
      const targetColumnId = statusToColumnMap[leadStatus] || "novo";
      
      let targetColumn = defaultFunnel!.columns.find(col => col.id === targetColumnId);
      if (!targetColumn) {
        // Criar coluna se não existir
        targetColumn = {
          id: targetColumnId,
          title: leadStatus.charAt(0).toUpperCase() + leadStatus.slice(1),
          color: "bg-gray-500",
          leads: [],
        };
        defaultFunnel!.columns.push(targetColumn);
      }

      const pipelineLead = convertLeadToPipelineLead(lead);
      targetColumn.leads.push(pipelineLead);
    });

    // Atualizar funis salvos
    const defaultFunnelIndex = funnels.findIndex(f => f.id === DEFAULT_FUNNEL_ID);
    if (defaultFunnelIndex >= 0) {
      funnels[defaultFunnelIndex] = defaultFunnel;
    } else {
      funnels.push(defaultFunnel);
    }

    // Salvar funis atualizados
    localStorage.setItem(STORAGE_KEY_PIPELINES, JSON.stringify(funnels));
    
    // Manter compatibilidade com sistema antigo
    savePipelineColumns(defaultFunnel.columns);
  } catch (error) {
    console.error("Erro ao sincronizar leads com o pipeline:", error);
  }
}

// Garantir que um lead tenha um status válido
export function ensureValidStatus(lead: Lead, columns: PipelineColumn[]): string {
  if (lead.status && columns.some(col => col.id === lead.status)) {
    return lead.status;
  }
  
  // Se o status não for válido, usar o primeiro status disponível (geralmente "novo")
  return columns.length > 0 ? columns[0].id : "novo";
}

