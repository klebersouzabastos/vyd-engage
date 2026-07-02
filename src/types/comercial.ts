// Tipos do Desdobramento Comercial (Empreendimentos, Playbooks, Roadmaps, Painel).
// Espelham as respostas dos serviços do backend (empreendimento/playbook/roadmap).

export type TaskType =
  | 'VISITA'
  | 'APRESENTACAO'
  | 'LIGACAO'
  | 'REUNIAO'
  | 'EMAIL'
  | 'PROPOSTA'
  | 'OUTRO';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type CommercialRoadmapStatus =
  | 'PLANEJAMENTO'
  | 'EM_ANDAMENTO'
  | 'PROPOSTA'
  | 'GANHO'
  | 'PERDIDO'
  | 'ARQUIVADO';

export type StakeholderRole = 'DECISOR' | 'INFLUENCIADOR' | 'TECNICO' | 'APROVADOR' | 'USUARIO';

export type StakeholderPosture = 'FAVORAVEL' | 'NEUTRO' | 'CONTRARIO' | 'DESCONHECIDO';

export interface CompanyRef {
  id: string;
  name: string;
}

// ---- Empreendimento ----
export interface Empreendimento {
  id: string;
  companyId: string;
  name: string;
  type?: string | null;
  location?: string | null;
  estimatedValue?: number | string | null;
  phase?: string | null;
  expectedDecisionDate?: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  company?: CompanyRef;
  _count?: { contacts: number; roadmaps: number; deals: number };
}

export interface CreateEmpreendimentoInput {
  companyId: string;
  name: string;
  type?: string;
  location?: string;
  estimatedValue?: number;
  phase?: string;
  expectedDecisionDate?: string;
  status?: string;
  notes?: string;
}

export type UpdateEmpreendimentoInput = Partial<Omit<CreateEmpreendimentoInput, 'companyId'>>;

// ---- Função comercial (função responsável por um passo do playbook) ----
export type CommercialFunction = 'SDR' | 'CLOSER' | 'PRE_VENDAS' | 'GESTOR' | 'OUTRO';

export const COMMERCIAL_FUNCTIONS: CommercialFunction[] = [
  'SDR',
  'CLOSER',
  'PRE_VENDAS',
  'GESTOR',
  'OUTRO',
];

export const COMMERCIAL_FUNCTION_LABELS: Record<CommercialFunction, string> = {
  SDR: 'SDR',
  CLOSER: 'Closer',
  PRE_VENDAS: 'Pré-vendas',
  GESTOR: 'Gestor',
  OUTRO: 'Outro',
};

// ---- Playbook ----
export interface PlaybookStep {
  id?: string;
  order: number;
  title: string;
  actionType: TaskType;
  targetRole?: StakeholderRole | null;
  responsibleFunction?: CommercialFunction | null;
  offsetDays: number;
  priority: TaskPriority;
  description?: string | null;
}

export interface PlaybookTemplate {
  id: string;
  name: string;
  description?: string | null;
  isBuiltin: boolean;
  steps: PlaybookStep[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePlaybookInput {
  name: string;
  description?: string;
  steps: PlaybookStep[];
}

export type UpdatePlaybookInput = Partial<CreatePlaybookInput>;

// ---- Roadmap (desdobramento) ----
export interface LeadRef {
  id: string;
  name: string;
  email?: string | null;
  position?: string | null;
  reportsToId?: string | null;
}

export interface RoadmapStakeholder {
  id: string;
  leadId: string;
  roleInDecision: StakeholderRole;
  posture: StakeholderPosture;
  notes?: string | null;
  lead: LeadRef;
}

export interface RoadmapTask {
  id: string;
  title: string;
  type?: TaskType | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  completedAt?: string | null;
  assignedTo?: string | null;
  lead?: { id: string; name: string } | null;
}

export interface CommercialRoadmapListItem {
  id: string;
  title: string;
  status: CommercialRoadmapStatus;
  createdAt: string;
  updatedAt: string;
  company: CompanyRef;
  empreendimento?: CompanyRef | null;
  _count: { tasks: number; stakeholders: number };
}

export interface CommercialRoadmap {
  id: string;
  title: string;
  status: CommercialRoadmapStatus;
  companyId: string;
  empreendimentoId?: string | null;
  dealId?: string | null;
  deepResearchId?: string | null;
  playbookTemplateId?: string | null;
  targetProposalDate?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  company: CompanyRef;
  empreendimento?: CompanyRef | null;
  deal?: { id: string; name: string; stage: string } | null;
  deepResearch?: { id: string; title: string } | null;
  playbookTemplate?: { id: string; name: string } | null;
  stakeholders: RoadmapStakeholder[];
  tasks: RoadmapTask[];
}

export interface RoleAssignment {
  function: CommercialFunction;
  userId: string;
}

export interface CreateRoadmapInput {
  title: string;
  companyId: string;
  empreendimentoId?: string;
  deepResearchId?: string;
  playbookTemplateId?: string;
  status?: CommercialRoadmapStatus;
  targetProposalDate?: string;
  notes?: string;
  roleAssignments?: RoleAssignment[];
}

export interface UpdateRoadmapInput {
  title?: string;
  empreendimentoId?: string | null;
  dealId?: string | null;
  status?: CommercialRoadmapStatus;
  targetProposalDate?: string | null;
  notes?: string;
}

export interface UpsertStakeholderInput {
  leadId: string;
  roleInDecision?: StakeholderRole;
  posture?: StakeholderPosture;
  notes?: string;
}

// ---- Painel "não deixar passar" ----
export interface PanelTask {
  id: string;
  title: string;
  type?: TaskType | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  assignedTo?: string | null;
  lead?: { id: string; name: string } | null;
  roadmap?: { id: string; title: string } | null;
}

export interface AtRiskRoadmap {
  id: string;
  title: string;
  status: CommercialRoadmapStatus;
  company: CompanyRef;
  empreendimento?: CompanyRef | null;
  lastActivityAt: string | null;
  overdueCount: number;
}

export interface RoadmapPanel {
  upcoming: PanelTask[];
  overdue: PanelTask[];
  atRisk: AtRiskRoadmap[];
  riskDays: number;
}

// ---- Rótulos PT-BR ----
export const ROADMAP_STATUS_LABELS: Record<CommercialRoadmapStatus, string> = {
  PLANEJAMENTO: 'Planejamento',
  EM_ANDAMENTO: 'Em andamento',
  PROPOSTA: 'Proposta',
  GANHO: 'Ganho',
  PERDIDO: 'Perdido',
  ARQUIVADO: 'Arquivado',
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  VISITA: 'Visita',
  APRESENTACAO: 'Apresentação',
  LIGACAO: 'Ligação',
  REUNIAO: 'Reunião',
  EMAIL: 'E-mail',
  PROPOSTA: 'Proposta',
  OUTRO: 'Outro',
};

export const STAKEHOLDER_ROLE_LABELS: Record<StakeholderRole, string> = {
  DECISOR: 'Decisor',
  INFLUENCIADOR: 'Influenciador',
  TECNICO: 'Técnico',
  APROVADOR: 'Aprovador',
  USUARIO: 'Usuário',
};

export const STAKEHOLDER_POSTURE_LABELS: Record<StakeholderPosture, string> = {
  FAVORAVEL: 'Favorável',
  NEUTRO: 'Neutro',
  CONTRARIO: 'Contrário',
  DESCONHECIDO: 'Desconhecido',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};
