// Tipos compartilhados do sistema

// Aligned with Prisma UserRole enum
export type UserRole = "ADMIN" | "USER" | "VIEWER";

// Aligned with Prisma LeadStatus enum
export type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";

// Aligned with Prisma LeadSource enum
export type LeadSource = "WEBSITE" | "SOCIAL_MEDIA" | "REFERRAL" | "EMAIL" | "PHONE" | "OTHER";

// Aligned with Prisma TaskPriority enum
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

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
  isContact?: boolean;
  convertedAt?: string | null;
  notes?: string;
  assignedTo?: string;
  tags: string[];
  customFields: Record<string, string | number | boolean | null>;
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
  metadata?: Record<string, string | number | boolean | null>;
}

export interface Task {
  id: string;
  leadId?: string;
  title: string;
  description?: string;
  dueDate?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: TaskPriority;
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
  defaultValue?: string | number | boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export type NotificationType =
  | "task_due"
  | "task_overdue"
  | "lead_assigned"
  | "automation_error"
  | "payment_failed"
  | "subscription_expiring"
  | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean | null>;
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
  config: Record<string, string | number | boolean | null>;
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
  styles?: Record<string, string | number>;
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

// ========================
// Companies
// ========================

export type CompanySize = "MICRO" | "SMALL" | "MEDIUM" | "LARGE" | "ENTERPRISE";

export interface Company {
  id: string;
  tenantId: string;
  name: string;
  domain?: string | null;
  industry?: string | null;
  size?: CompanySize | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { leads: number; deals: number; interactions?: number };
  leads?: Array<{ id: string; name: string; email?: string; phone?: string; status: string; source: string; score: number; createdAt: string }>;
  deals?: Array<{ id: string; name: string; value: number; stage: string; probability: number; expectedCloseDate?: string | null; createdAt: string }>;
  interactions?: Array<{ id: string; type: string; direction: string; subject?: string; content: string; createdAt: string }>;
}

// ========================
// Deals
// ========================

export type DealStage = "QUALIFICATION" | "PROPOSAL" | "NEGOTIATION" | "CLOSING" | "WON" | "LOST";

export interface Deal {
  id: string;
  tenantId: string;
  name: string;
  value: number;
  stage: DealStage;
  probability: number;
  expectedCloseDate?: string | null;
  leadId?: string | null;
  lead?: { id: string; name: string; email?: string; phone?: string; company?: string } | null;
  assignedTo?: string | null;
  assignedUser?: { id: string; name: string; email: string } | null;
  notes?: string | null;
  customFields: Record<string, string | number | boolean | null>;
  lostReason?: string | null;
  funnelId?: string | null;
  funnelColumnId?: string | null;
  positionInColumn?: number;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealStats {
  totalPipelineValue: number;
  weightedValue: number;
  wonValue: number;
  lostValue: number;
  winRate: number;
  avgDealSize: number;
  avgCycleTime: number;
  byStage: Array<{
    stage: string;
    count: number;
    totalValue: number;
    weightedValue: number;
  }>;
  totalDeals: number;
  activeDeals: number;
  wonDeals: number;
  lostDeals: number;
}

// ========================
// Forecast
// ========================

export interface MonthlyForecast {
  month: string; // 'YYYY-MM'
  totalValue: number;
  weightedValue: number;
  dealCount: number;
}

export interface WonLostMonth {
  month: string;
  won: { count: number; value: number };
  lost: { count: number; value: number };
}

export interface ForecastSummary {
  totalPipelineValue: number;
  totalWeightedForecast: number;
  avgDealSize: number;
  avgCloseTimeDays: number;
  winRate: number;
}

export interface ForecastData {
  monthly: MonthlyForecast[];
  noDateBucket: { totalValue: number; weightedValue: number; dealCount: number };
  summary: ForecastSummary;
}

export interface TrendData {
  months: WonLostMonth[];
}

export interface FunnelConversionStage {
  stage: string;
  count: number;
  conversionToNext: number | null;
  dropOffRate: number | null;
}

export interface FunnelConversionData {
  stages: FunnelConversionStage[];
  total: number;
}

