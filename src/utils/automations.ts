export interface Automation {
  id: number;
  name: string;
  type: "whatsapp" | "email";
  status: "active" | "paused";
  steps: number;
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY = "automations";

// Dados padrão de automações
const DEFAULT_AUTOMATIONS: Automation[] = [
  {
    id: 1,
    name: "Boas-vindas WhatsApp",
    type: "whatsapp",
    status: "active",
    steps: 4,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: "Follow-up E-mail",
    type: "email",
    status: "active",
    steps: 3,
    createdAt: new Date().toISOString(),
  },
  {
    id: 3,
    name: "Recuperação de Leads Perdidos",
    type: "whatsapp",
    status: "paused",
    steps: 5,
    createdAt: new Date().toISOString(),
  },
];

// Obter todas as automações
export function getAllAutomations(): Automation[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    // Se não houver dados salvos, inicializar com dados padrão
    saveAutomations(DEFAULT_AUTOMATIONS);
    return DEFAULT_AUTOMATIONS;
  } catch (error) {
    console.error("Erro ao buscar automações:", error);
    return DEFAULT_AUTOMATIONS;
  }
}

// Obter automação por ID
export function getAutomationById(id: number): Automation | undefined {
  const automations = getAllAutomations();
  return automations.find((auto) => auto.id === id);
}

// Salvar automações
function saveAutomations(automations: Automation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(automations));
  } catch (error) {
    console.error("Erro ao salvar automações:", error);
  }
}

// Criar nova automação
export function createAutomation(automation: Omit<Automation, "id" | "createdAt" | "updatedAt">): Automation {
  const automations = getAllAutomations();
  const maxId = automations.length > 0 ? Math.max(...automations.map(a => a.id)) : 0;
  
  const newAutomation: Automation = {
    ...automation,
    id: maxId + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  automations.push(newAutomation);
  saveAutomations(automations);
  
  return newAutomation;
}

// Atualizar automação
export function updateAutomation(id: number, updates: Partial<Automation>): Automation {
  const automations = getAllAutomations();
  const index = automations.findIndex((auto) => auto.id === id);

  if (index === -1) {
    throw new Error("Automação não encontrada");
  }

  const updatedAutomation = {
    ...automations[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  automations[index] = updatedAutomation;
  saveAutomations(automations);
  
  return updatedAutomation;
}

// Deletar automação
export function deleteAutomation(id: number): void {
  const automations = getAllAutomations();
  const filtered = automations.filter((auto) => auto.id !== id);
  saveAutomations(filtered);
}

// Alternar status da automação
export function toggleAutomationStatus(id: number): Automation {
  const automation = getAutomationById(id);
  if (!automation) {
    throw new Error("Automação não encontrada");
  }
  
  const newStatus = automation.status === "active" ? "paused" : "active";
  return updateAutomation(id, { status: newStatus });
}

// Obter automações ativas
export function getActiveAutomations(): Automation[] {
  const automations = getAllAutomations();
  return automations.filter((auto) => auto.status === "active");
}

// Obter automações pausadas
export function getPausedAutomations(): Automation[] {
  const automations = getAllAutomations();
  return automations.filter((auto) => auto.status === "paused");
}







