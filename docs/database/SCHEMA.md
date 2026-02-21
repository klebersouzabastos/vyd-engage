# VYD Engage - Database Schema Documentation

**ORM:** Prisma 5.7.1
**Database:** PostgreSQL 16+
**Schema File:** `server/prisma/schema.prisma`
**Data:** 2026-02-20
**Fase:** Brownfield Discovery - Fase 2 (Coleta: Database)
**Agente:** @data-engineer (Dara)

---

## Resumo

| Metrica | Valor |
|---------|-------|
| Total de modelos | 20 |
| Total de enums | 14 |
| Total de indices | 37 |
| Foreign keys (explicitas) | 22 |
| Join tables | 1 (LeadTag) |
| Linhas no schema | 658 |

---

## Modelos por Grupo

### 1. Auth & Authorization (3 modelos)

#### User
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| email | String | N | - | unique, [email], [tenantId,email] | - |
| passwordHash | String | N | - | - | - |
| name | String | N | - | - | - |
| avatar | String | S | - | - | - |
| role | UserRole | N | USER | - | - |
| status | UserStatus | N | PENDING | - | - |
| tenantId | String | N | - | [tenantId], [tenantId,email] | Tenant.id (CASCADE) |
| emailVerified | Boolean | N | false | - | - |
| emailVerifiedAt | DateTime | S | - | - | - |
| passwordResetToken | String | S | - | - | - |
| passwordResetExpires | DateTime | S | - | - | - |
| twoFactorEnabled | Boolean | N | false | - | - |
| twoFactorSecret | String | S | - | - | - |
| createdAt | DateTime | N | now() | - | - |
| updatedAt | DateTime | N | @updatedAt | - | - |
| lastLoginAt | DateTime | S | - | - | - |

**Relacoes:** refreshTokens (1:N), invitations via "InvitedBy" (1:N)

#### RefreshToken
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| token | String | N | - | unique, [token] | - |
| userId | String | N | - | [userId] | User.id (CASCADE) |
| expiresAt | DateTime | N | - | - | - |
| createdAt | DateTime | N | now() | - | - |

#### Invitation
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| email | String | N | - | [email] | - |
| role | UserRole | N | USER | - | - |
| token | String | N | - | unique, [token] | - |
| tenantId | String | N | - | [tenantId] | Tenant.id (CASCADE) |
| invitedBy | String | N | - | - | User.id |
| accepted | Boolean | N | false | - | - |
| expiresAt | DateTime | N | - | - | - |
| createdAt | DateTime | N | now() | - | - |

---

### 2. Tenant / Organization (1 modelo)

#### Tenant
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| name | String | N | - | - | - |
| slug | String | N | - | unique, [slug] | - |
| logo | String | S | - | - | - |
| settings | Json | N | "{}" | - | - |
| createdAt | DateTime | N | now() | - | - |
| updatedAt | DateTime | N | @updatedAt | - | - |

**Relacoes:** users, invitations, leads, tasks, automations, tags, customFields, whatsappConnections, emailConfigs, payments, apiKeys, webhooks, notifications, interactions (todas 1:N) + subscription (1:1)

---

### 3. Billing (3 modelos)

#### Plan
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| type | PlanType | N | - | unique | - |
| name | String | N | - | - | - |
| price | Float | N | - | - | - |
| description | String | S | - | - | - |
| features | Json | N | - | - | - |
| limits | Json | N | - | - | - |
| highlighted | Boolean | N | false | - | - |
| active | Boolean | N | true | - | - |
| createdAt | DateTime | N | now() | - | - |
| updatedAt | DateTime | N | @updatedAt | - | - |

#### Subscription
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| tenantId | String | N | - | unique, [tenantId] | Tenant.id (CASCADE) |
| planId | String | N | - | - | Plan.id |
| status | SubscriptionStatus | N | TRIAL | [status] | - |
| billingCycle | String | N | "monthly" | - | - |
| startDate | DateTime | N | now() | - | - |
| renewalDate | DateTime | N | - | - | - |
| cancelledAt | DateTime | S | - | - | - |
| trialEndsAt | DateTime | S | - | - | - |
| paymentMethod | Json | S | - | - | - |
| createdAt | DateTime | N | now() | - | - |
| updatedAt | DateTime | N | @updatedAt | - | - |

#### Payment
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| tenantId | String | N | - | [tenantId] | Tenant.id (CASCADE) |
| subscriptionId | String | S | - | [subscriptionId] | Subscription.id |
| amount | Float | N | - | - | - |
| currency | String | N | "BRL" | - | - |
| method | String | N | - | - | - |
| status | String | N | - | [status] | - |
| mercadoPagoId | String | S | - | [mercadoPagoId] | - |
| mercadoPagoPreferenceId | String | S | - | - | - |
| mercadoPagoStatus | String | S | - | - | - |
| paymentData | Json | S | - | - | - |
| invoiceUrl | String | S | - | - | - |
| invoiceNumber | String | S | - | - | - |
| createdAt | DateTime | N | now() | - | - |
| updatedAt | DateTime | N | @updatedAt | - | - |
| paidAt | DateTime | S | - | - | - |

---

### 4. CRM Core (6 modelos)

#### Lead
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| tenantId | String | N | - | [tenantId], [tenantId,status], [tenantId,email], [tenantId,createdAt] | Tenant.id (CASCADE) |
| name | String | N | - | - | - |
| email | String | S | - | - | - |
| phone | String | S | - | - | - |
| company | String | S | - | - | - |
| position | String | S | - | - | - |
| status | LeadStatus | N | NEW | - | - |
| source | LeadSource | N | WEBSITE | - | - |
| score | Int | N | 0 | - | - |
| customFields | Json | N | "{}" | - | - |
| notes | String | S | - | - | - |
| assignedTo | String | S | - | - | **SEM FK** |
| createdAt | DateTime | N | now() | - | - |
| updatedAt | DateTime | N | @updatedAt | - | - |

#### Tag
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| tenantId | String | N | - | [tenantId] | Tenant.id (CASCADE) |
| name | String | N | - | unique[tenantId,name] | - |
| color | String | N | "#2563EB" | - | - |
| createdAt | DateTime | N | now() | - | - |
| updatedAt | DateTime | N | @updatedAt | - | - |

#### LeadTag (Join Table)
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| leadId | String | N | - | unique[leadId,tagId], [leadId] | Lead.id (CASCADE) |
| tagId | String | N | - | unique[leadId,tagId], [tagId] | Tag.id (CASCADE) |
| createdAt | DateTime | N | now() | - | - |

#### CustomField
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| tenantId | String | N | - | [tenantId] | Tenant.id (CASCADE) |
| name | String | N | - | unique[tenantId,name] | - |
| type | String | N | - | - | - |
| options | Json | S | - | - | - |
| required | Boolean | N | false | - | - |
| order | Int | N | 0 | - | - |
| active | Boolean | N | true | - | - |
| createdAt | DateTime | N | now() | - | - |
| updatedAt | DateTime | N | @updatedAt | - | - |

#### Task
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| tenantId | String | N | - | [tenantId], [tenantId,status], [tenantId,assignedTo], [tenantId,dueDate] | Tenant.id (CASCADE) |
| title | String | N | - | - | - |
| description | String | S | - | - | - |
| status | TaskStatus | N | PENDING | - | - |
| priority | TaskPriority | N | MEDIUM | - | - |
| assignedTo | String | S | - | - | **SEM FK** |
| leadId | String | S | - | - | Lead.id (SetNull) |
| dueDate | DateTime | S | - | - | - |
| completedAt | DateTime | S | - | - | - |
| createdAt | DateTime | N | now() | - | - |
| updatedAt | DateTime | N | @updatedAt | - | - |

#### Interaction
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| tenantId | String | N | - | [tenantId], [tenantId,leadId], [tenantId,createdAt], [tenantId,type] | Tenant.id (CASCADE) |
| leadId | String | S | - | - | Lead.id (SetNull) |
| type | String | N | - | - | - |
| direction | String | N | - | - | - |
| subject | String | S | - | - | - |
| content | String | N | - | - | - |
| metadata | Json | S | - | - | - |
| automationId | String | S | - | - | **SEM FK** |
| userId | String | S | - | - | **SEM FK** |
| createdAt | DateTime | N | now() | - | - |

**Nota:** Interaction nao tem `updatedAt` — somente `createdAt` (append-only pattern).

---

### 5. Automations (2 modelos)

#### Automation
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| tenantId | String | N | - | [tenantId], [tenantId,status] | Tenant.id (CASCADE) |
| name | String | N | - | - | - |
| description | String | S | - | - | - |
| status | AutomationStatus | N | DRAFT | - | - |
| trigger | Json | N | - | - | - |
| steps | Json | N | - | - | - |
| conditions | Json | S | - | - | - |
| runsCount | Int | N | 0 | - | - |
| successCount | Int | N | 0 | - | - |
| errorCount | Int | N | 0 | - | - |
| createdAt | DateTime | N | now() | - | - |
| updatedAt | DateTime | N | @updatedAt | - | - |
| lastRunAt | DateTime | S | - | - | - |

#### AutomationLog
| Campo | Tipo | Nullable | Default | Index | FK |
|-------|------|----------|---------|-------|----|
| id | String | N | uuid() | PK | - |
| automationId | String | N | - | [automationId] | Automation.id (CASCADE) |
| status | String | N | - | - | - |
| message | String | S | - | - | - |
| data | Json | S | - | - | - |
| error | String | S | - | - | - |
| createdAt | DateTime | N | now() | [createdAt] | - |

---

### 6. Communications (2 modelos)

#### WhatsAppConnection
Campos: id, tenantId (FK Tenant CASCADE), name, provider (enum), status (enum), config (Json), qrCode, qrCodeExpiresAt, messagesSent, messagesReceived, createdAt, updatedAt, lastConnectedAt.
Indices: [tenantId], [tenantId,status]

#### EmailConfig
Campos: id, tenantId (FK Tenant CASCADE), name, provider (enum), fromEmail, fromName, config (Json), verified, verifiedAt, emailsSent, createdAt, updatedAt.
Indice: [tenantId]

---

### 7. API & Webhooks (3 modelos)

#### ApiKey
Campos: id, tenantId (FK Tenant CASCADE), name, key (unique), keyHash, lastUsedAt, expiresAt, active, createdAt, updatedAt.
Indices: [tenantId], [keyHash]

#### Webhook
Campos: id, tenantId (FK Tenant CASCADE), url, events (String[]), secret, active, successCount, failureCount, lastTriggeredAt, createdAt, updatedAt.
Indices: [tenantId], [tenantId,active]

#### WebhookLog
Campos: id, webhookId (FK Webhook CASCADE), event, status, statusCode, response, error, attempts, createdAt.
Indices: [webhookId], [createdAt]

---

### 8. Notifications (1 modelo)

#### Notification
Campos: id, tenantId (FK Tenant CASCADE), userId (String SEM FK), type (enum), title, message, status (enum), link, metadata (Json), createdAt, readAt.
Indices: [tenantId,userId], [tenantId,userId,status], [createdAt]

---

## Enums

| Enum | Valores |
|------|---------|
| UserRole | ADMIN, USER, VIEWER |
| UserStatus | ACTIVE, INACTIVE, PENDING |
| PlanType | STARTER, PRO, ENTERPRISE |
| SubscriptionStatus | ACTIVE, TRIAL, CANCELLED, EXPIRED, PAST_DUE |
| LeadStatus | NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST |
| LeadSource | WEBSITE, SOCIAL_MEDIA, REFERRAL, EMAIL, PHONE, OTHER |
| TaskStatus | PENDING, IN_PROGRESS, COMPLETED, CANCELLED |
| TaskPriority | LOW, MEDIUM, HIGH, URGENT |
| AutomationStatus | ACTIVE, PAUSED, DRAFT |
| WhatsAppProvider | OFFICIAL_API, EVOLUTION_API, BAILEYS, WPPCONNECT, CHATAPI |
| WhatsAppConnectionStatus | CONNECTED, DISCONNECTED, CONNECTING, ERROR |
| EmailProvider | SMTP, SENDGRID, MAILGUN, SES, RESEND |
| NotificationType | TASK_DUE, TASK_OVERDUE, LEAD_ASSIGNED, AUTOMATION_ERROR, PAYMENT_FAILED, SUBSCRIPTION_EXPIRING, SYSTEM |
| NotificationStatus | UNREAD, READ, ARCHIVED |

---

## Diagrama ER (Simplificado)

```
Tenant (hub) ─┬── 1:N ── User ── 1:N ── RefreshToken
              ├── 1:1 ── Subscription ── N:1 ── Plan
              ├── 1:N ── Payment
              ├── 1:N ── Lead ──┬── N:M ── Tag (via LeadTag)
              │                 ├── 1:N ── Interaction
              │                 └── 1:N ── Task
              ├── 1:N ── Automation ── 1:N ── AutomationLog
              ├── 1:N ── WhatsAppConnection
              ├── 1:N ── EmailConfig
              ├── 1:N ── ApiKey
              ├── 1:N ── Webhook ── 1:N ── WebhookLog
              ├── 1:N ── Notification
              ├── 1:N ── CustomField
              └── 1:N ── Invitation
```

---

*— Dara, arquitetando dados*
