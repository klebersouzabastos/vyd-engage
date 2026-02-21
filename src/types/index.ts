// Tipos compartilhados do sistema

// Aligned with Prisma LeadStatus enum
export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";

// Aligned with Prisma LeadSource enum
export type LeadSource = "WEBSITE" | "SOCIAL_MEDIA" | "REFERRAL" | "EMAIL" | "PHONE" | "OTHER";

export interface Lead {
  id: string; // UUID from Prisma
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  position?: string;
  source: LeadSource;
  status: LeadStatus;
  score: number;
  notes?: string;
  assignedTo?: string;
  tags: string[];
  customFields: Record<string, any>;
  interactions?: Interaction[];
  tasks?: Task[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Interaction {
  id: string;
  leadId: string;
  type: "note" | "call" | "email" | "whatsapp" | "meeting" | "status_change" | "automation";
  direction?: "inbound" | "outbound";
  subject?: string;
  content: string;
  userId?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface Task {
  id: string;
  leadId?: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: "low" | "medium" | "high" | "urgent";
  assignedTo?: string;
  userId?: string;
  createdAt: string;
  completedAt?: string;
  updatedAt?: string;
}

export interface CustomField {
  id: string;
  name: string;
  type: "text" | "number" | "date" | "select" | "textarea" | "checkbox";
  options?: string[];
  required: boolean;
  defaultValue?: any;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  type: "task_due" | "task_overdue" | "new_lead" | "interaction" | "automation_failed";
  title: string;
  message: string;
  read: boolean;
  link?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface Report {
  id: string;
  name: string;
  description?: string;
  type: "leads" | "sales" | "automations" | "tasks" | "custom";
  widgets: ReportWidget[];
  schedule?: ReportSchedule;
  filters?: ReportFilter;
  shareSettings?: ReportShareSettings;
  templateId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ReportWidget {
  id: string;
  type: "chart" | "table" | "metric" | "funnel" | "heatmap" | "line" | "comparison" | "topn";
  title: string;
  config: Record<string, any>;
  position: { x: number; y: number; w: number; h: number };
  dataSource?: "leads" | "pipeline" | "automations" | "tasks" | "interactions";
  filters?: ReportFilter;
  dateRange?: {
    type: "today" | "week" | "month" | "quarter" | "year" | "all" | "custom";
    start?: string;
    end?: string;
  };
  aggregation?: "sum" | "avg" | "count" | "min" | "max";
  metric?: string;
  chartType?: "bar" | "line" | "pie" | "area";
  colors?: string[];
  styles?: Record<string, any>;
}

export interface ReportFilter {
  dateRange?: {
    type: "today" | "week" | "month" | "quarter" | "year" | "all" | "custom";
    start?: string;
    end?: string;
  };
  status?: string[];
  source?: string[];
  tags?: string[];
  automationIds?: number[];
  userId?: string;
  priority?: string[];
}

export interface ReportSchedule {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:mm format
  recipients: string[];
  format: "pdf" | "excel" | "both";
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: "leads" | "sales" | "automations" | "tasks" | "executive";
  icon?: string;
  widgets: Omit<ReportWidget, "id" | "position">[];
  defaultFilters?: ReportFilter;
}

export interface ReportShareSettings {
  publicLink?: string;
  publicAccess: boolean;
  permissions: {
    view: string[]; // user IDs or emails
    edit: string[]; // user IDs or emails
  };
  password?: string;
  expiresAt?: string;
}

export interface LeadScore {
  leadId: string;
  score: number;
  factors: ScoreFactor[];
  lastUpdated: string;
}

export interface ScoreFactor {
  type: string;
  description: string;
  points: number;
}

export interface Comment {
  id: string;
  leadId: string;
  userId: string;
  userName: string;
  content: string;
  mentions?: string[]; // User IDs mentioned
  createdAt: string;
  updatedAt?: string;
}

