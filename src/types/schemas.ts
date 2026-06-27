import { z } from 'zod';

// ========================
// Enum Schemas
// ========================

export const LeadStatusSchema = z.enum([
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
]);

export const LeadSourceSchema = z.enum([
  'WEBSITE',
  'SOCIAL_MEDIA',
  'REFERRAL',
  'EMAIL',
  'PHONE',
  'OTHER',
]);

export const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const TaskStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

export const DealStageSchema = z.enum([
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSING',
  'WON',
  'LOST',
]);

export const UserRoleSchema = z.enum(['ADMIN', 'USER', 'VIEWER']);

// ========================
// Pagination Schema
// ========================

export const PaginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export type PaginationResponse = z.infer<typeof PaginationSchema>;

// ========================
// User Schema
// ========================

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  avatar: z.string().nullable().optional(),
  role: UserRoleSchema,
  tenantId: z.string(),
  phone: z.string().nullable().optional(),
  tenant: z
    .object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      logo: z.string().nullable().optional(),
    })
    .optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type UserResponse = z.infer<typeof UserSchema>;

// ========================
// Lead Schema
// ========================

export const LeadTagSchema = z.object({
  tag: z
    .object({
      id: z.string(),
      name: z.string(),
      color: z.string(),
    })
    .optional(),
  tagId: z.string().optional(),
});

export const LeadSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  source: z.string(),
  status: z.string(),
  score: z.number().default(0),
  notes: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  tags: z.array(z.union([LeadTagSchema, z.string()])).default([]),
  customFields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  interactions: z.array(z.unknown()).optional(),
  tasks: z.array(z.unknown()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type LeadResponse = z.infer<typeof LeadSchema>;

export const LeadsListResponseSchema = z.object({
  leads: z.array(LeadSchema),
  pagination: PaginationSchema.optional(),
});

export type LeadsListResponse = z.infer<typeof LeadsListResponseSchema>;

// ========================
// Task Schema
// ========================

export const TaskSchema = z.object({
  id: z.string(),
  leadId: z.string().nullable().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  assignedTo: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  createdAt: z.string(),
  completedAt: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
});

export type TaskResponse = z.infer<typeof TaskSchema>;

export const TasksListResponseSchema = z.object({
  tasks: z.array(TaskSchema),
  pagination: PaginationSchema.optional(),
});

export type TasksListResponse = z.infer<typeof TasksListResponseSchema>;

// ========================
// Deal Schema
// ========================

export const DealSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  value: z.union([z.number(), z.string()]).transform(Number),
  stage: DealStageSchema,
  probability: z.number(),
  expectedCloseDate: z.string().nullable().optional(),
  leadId: z.string().nullable().optional(),
  lead: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
    })
    .nullable()
    .optional(),
  assignedTo: z.string().nullable().optional(),
  assignedUser: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    })
    .nullable()
    .optional(),
  notes: z.string().nullable().optional(),
  customFields: z.record(z.unknown()).default({}),
  lostReason: z.string().nullable().optional(),
  closedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type DealResponse = z.infer<typeof DealSchema>;

export const DealsListResponseSchema = z.object({
  deals: z.array(DealSchema),
  pagination: PaginationSchema.optional(),
});

export type DealsListResponse = z.infer<typeof DealsListResponseSchema>;

// ========================
// Deal Stats Schema
// ========================

export const DealStatsSchema = z.object({
  totalPipelineValue: z.number(),
  weightedValue: z.number(),
  wonValue: z.number(),
  lostValue: z.number(),
  winRate: z.number(),
  avgDealSize: z.number(),
  avgCycleTime: z.number(),
  byStage: z.array(
    z.object({
      stage: z.string(),
      count: z.number(),
      totalValue: z.number(),
      weightedValue: z.number(),
    })
  ),
  totalDeals: z.number(),
  activeDeals: z.number(),
  wonDeals: z.number(),
  lostDeals: z.number(),
});

export type DealStatsResponse = z.infer<typeof DealStatsSchema>;

// ========================
// Auth Response Schemas
// ========================

export const LoginResponseSchema = z.union([
  z.object({ user: UserSchema }),
  z.object({ requiresTwoFactor: z.literal(true), userId: z.string() }),
]);

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const RegisterResponseSchema = z.object({
  user: UserSchema,
});

export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;

// ========================
// Subscription Schema
// ========================

export const SubscriptionResponseSchema = z.object({
  subscription: z
    .object({
      plan: z
        .object({
          type: z.string(),
          name: z.string().optional(),
        })
        .optional(),
      status: z.string().optional(),
      startDate: z.string().optional(),
      createdAt: z.string().optional(),
      renewalDate: z.string().optional(),
      billingCycle: z.string().optional(),
      payments: z
        .array(
          z.object({
            id: z.string(),
            amount: z.union([z.number(), z.string()]),
            status: z.string().optional(),
            createdAt: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),
  usage: z.unknown().optional(),
});

export type SubscriptionResponse = z.infer<typeof SubscriptionResponseSchema>;

// ========================
// Notification Schema
// ========================

export const NotificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  status: z.string().optional(),
  read: z.boolean().optional(),
  link: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  timestamp: z.string().optional(),
  metadata: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .nullable()
    .optional(),
});

export type NotificationResponse = z.infer<typeof NotificationSchema>;

// ========================
// Payment Schema
// ========================

export const PaymentSchema = z.object({
  id: z.string(),
  amount: z.union([z.number(), z.string()]),
  status: z.string(),
  method: z.string().optional(),
  planType: z.string().optional(),
  planId: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type PaymentResponse = z.infer<typeof PaymentSchema>;
