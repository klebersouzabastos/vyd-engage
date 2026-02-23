# VYD Engage — Handoff Final de Projeto

**Data:** 23/02/2026
**Versao:** 1.0.0
**Repositorio:** https://github.com/klebersouzabastos/vyd-engage
**48 commits** no historico

---

## 1. URLs de Producao

| Servico | URL | Status |
|---------|-----|--------|
| **Frontend (Vercel)** | https://engage.vydhub.com | **Ready** |
| Frontend (alias) | https://vyd-engage-klebers-projects-2f5727d9.vercel.app | Ready |
| Frontend (git) | https://vyd-engage-git-main-klebers-projects-2f5727d9.vercel.app | Ready |
| **Backend (Railway)** | *Pendente deploy* | Ver secao 5 |
| **Repositorio** | https://github.com/klebersouzabastos/vyd-engage | Ativo |

---

## 2. Arquitetura do Sistema

```
┌─────────────────────────────┐       ┌──────────────────────────────────┐
│   Frontend (Vercel)         │       │   Backend (Railway)              │
│   React 18 + Vite           │──────▶│   Express + Prisma              │
│   engage.vydhub.com         │       │                                  │
│                             │       │   21 rotas REST                  │
│   26 paginas (lazy-loaded)  │       │   25 servicos de negocio         │
│   47 componentes UI         │       │   7 middlewares                  │
│   9 contexts React          │       │   Socket.IO (real-time)          │
│   7 custom hooks            │       │   BullMQ (background jobs)       │
│   9 tabs de Settings        │       │   5 arquivos de teste            │
└─────────────────────────────┘       └──────────────────────────────────┘
                                               │            │
                                          ┌────┘            └────┐
                                     ┌────▼────┐           ┌────▼────┐
                                     │PostgreSQL│           │  Redis   │
                                     │ 25 models│           │ Cache +  │
                                     │ Prisma   │           │ BullMQ   │
                                     └──────────┘           └──────────┘

Integracoes externas:
  - Mercado Pago (pagamentos)
  - Resend (email transacional — noreply@engage.vydhub.com)
  - WhatsApp (conexao propria via API)
  - Sentry (monitoramento de erros)
  - Socket.IO (notificacoes real-time)
```

---

## 3. Inventario Completo

### 3.1. Frontend — 26 Paginas

| Pagina | Arquivo | Funcionalidade |
|--------|---------|----------------|
| Dashboard | `Dashboard.tsx` | Metricas, graficos, seletor de data, export CSV |
| Leads | `Leads.tsx` | CRUD leads, busca, filtros, paginacao, import CSV |
| Lead Form | `LeadForm.tsx` | Criacao/edicao de lead |
| Pipeline | `Pipeline.tsx` | Kanban drag-and-drop, multi-funil |
| Tasks | `Tasks.tsx` | Lista + calendario de tarefas |
| Task Form | `TaskForm.tsx` | Criacao/edicao de tarefa |
| Inbox | `Inbox.tsx` | Inbox unificado WhatsApp + Email |
| Automations | `Automations.tsx` | Lista de automacoes |
| Automation Detail | `AutomationDetail.tsx` | Builder visual de automacao |
| Automation Logs | `AutomationLogs.tsx` | Logs de execucao |
| Email Campaigns | `EmailCampaigns.tsx` | Envio em massa, templates |
| WhatsApp Templates | `WhatsAppTemplates.tsx` | Templates de mensagem |
| Reports | `Reports.tsx` | Lista de relatorios |
| Report Builder | `ReportBuilder.tsx` | Construtor de relatorios custom |
| Report View | `ReportView.tsx` | Visualizacao de relatorio |
| Billing | `Billing.tsx` | Planos e pagamentos |
| Settings | `Settings.tsx` | 9 abas de configuracao |
| Custom Fields | `CustomFields.tsx` | Campos customizados |
| Profile | `Profile.tsx` | Perfil do usuario |
| Onboarding | `Onboarding.tsx` | Wizard de onboarding |
| Landing Page | `LandingPage.tsx` | Pagina publica |
| Public Form | `PublicForm.tsx` | Formulario publico de captura |
| Login | `Login.tsx` | Autenticacao |
| Register | `Register.tsx` | Registro + criacao de tenant |
| Forgot Password | `ForgotPassword.tsx` | Solicitar reset de senha |
| Reset Password | `ResetPassword.tsx` | Redefinir senha via token |

### 3.2. Frontend — 9 Tabs de Settings

| Tab | Componente | Funcionalidade |
|-----|-----------|----------------|
| Empresa | `CompanyTab.tsx` | Dados da empresa/tenant |
| Notificacoes | `NotificationsTab.tsx` | Preferencias de notificacao |
| Integracoes | `IntegrationsTab.tsx` | WhatsApp, email, webhook capture |
| Planos | `BillingTab.tsx` | Assinatura, pagamentos, invoices |
| Tags | `TagManager` | CRUD de tags |
| Campos Custom | `CustomFieldsTab.tsx` | CRUD campos customizados |
| Lead Scoring | `LeadScoringTab.tsx` | Regras de pontuacao |
| Webhooks | `WebhooksTab.tsx` | Webhooks de saida (CRUD, teste, logs) |
| API Keys | `ApiKeysTab.tsx` | Chaves de API (criacao, revogacao) |
| Seguranca | `TwoFactorSetup.tsx` | 2FA TOTP setup |

### 3.3. Frontend — 9 React Contexts

| Context | Responsabilidade |
|---------|-----------------|
| `AuthContext` | Login, logout, register, user state, JWT |
| `PlanContext` | Plano atual, limites, uso |
| `PaymentContext` | Processamento Mercado Pago |
| `NotificationContext` | Notificacoes real-time (WebSocket) |
| `CompanyContext` | Dados da empresa/tenant |
| `TagsContext` | Tags disponiveis |
| `CustomFieldsContext` | Campos customizados |
| `EmailContext` | Configuracao de email |
| `WhatsAppContext` | Conexoes WhatsApp |

### 3.4. Frontend — 7 Custom Hooks

| Hook | Funcionalidade |
|------|----------------|
| `useSocket` | Conexao Socket.IO compartilhada com ref counting |
| `useLeads` | CRUD de leads com cache |
| `useTasks` | CRUD de tarefas |
| `useFunnels` | Gestao de funis |
| `useDashboard` | Metricas do dashboard |
| `useWhatsApp` | Conexoes e mensagens WhatsApp |
| `useTaskNotifications` | Alertas de tarefas |

### 3.5. Backend — 21 Rotas

| Rota | Endpoint | Funcionalidade |
|------|----------|----------------|
| `auth.ts` | `/api/auth` | Register, login, refresh, reset, verify, 2FA |
| `leads.ts` | `/api/leads` | CRUD leads, busca, import/export |
| `tasks.ts` | `/api/tasks` | CRUD tarefas |
| `tags.ts` | `/api/tags` | CRUD tags |
| `funnels.ts` | `/api/funnels` | CRUD funis e colunas |
| `customFields.ts` | `/api/custom-fields` | CRUD campos customizados |
| `scoring.ts` | `/api/scoring-rules` | Regras de lead scoring |
| `interactions.ts` | `/api/interactions` | Interacoes/conversas |
| `automations.ts` | `/api/automations` | CRUD automacoes |
| `whatsapp.ts` | `/api/whatsapp` | Conexoes e mensagens WhatsApp |
| `email.ts` | `/api/email` | Config email e campanhas |
| `notifications.ts` | `/api/notifications` | CRUD notificacoes |
| `subscriptions.ts` | `/api/subscriptions` | Planos e assinaturas |
| `payments.ts` | `/api/payments` | Pagamentos + invoice PDF |
| `users.ts` | `/api/users` | Gestao de usuarios |
| `invitations.ts` | `/api/invitations` | Convites por email |
| `apiKeys.ts` | `/api/api-keys` | CRUD chaves de API |
| `webhooks.ts` | `/api/webhooks` | Webhooks de entrada |
| `outgoingWebhooks.ts` | `/api/outgoing-webhooks` | Webhooks de saida |
| `reports.ts` | `/api/reports` | CRUD relatorios |
| `tracking.ts` | `/api/track` | Tracking de email (pixel + click) |

### 3.6. Backend — 25 Servicos

| Servico | Responsabilidade |
|---------|-----------------|
| `authService` | Registro, login, tokens, reset, verificacao |
| `twoFactorService` | 2FA TOTP (setup, verificacao, backup codes) |
| `leadService` | Logica de negocios de leads |
| `taskService` | Logica de tarefas |
| `tagService` | Logica de tags |
| `funnelService` | Logica de funis |
| `customFieldService` | Logica de campos customizados |
| `scoringService` | Calculo de lead scoring |
| `interactionService` | Interacoes/mensagens |
| `automationService` | CRUD + execucao de automacoes |
| `whatsappService` | Conexoes WhatsApp |
| `whatsappMessagingService` | Envio de mensagens WhatsApp |
| `emailService` | Email transacional (Resend) |
| `emailConfigService` | Configuracao SMTP/Resend |
| `emailMessagingService` | Envio de campanhas |
| `emailTrackingService` | Open pixel + click wrapper |
| `notificationService` | Criacao + emit WebSocket |
| `socketService` | Socket.IO server (real-time) |
| `subscriptionService` | Gestao de assinaturas |
| `paymentService` | Processamento de pagamentos |
| `mercadopagoService` | Integracao Mercado Pago |
| `invoiceService` | Geracao de PDF (PDFKit) |
| `planLimitsService` | Limites de plano + cache Redis |
| `invitationService` | Convites por email |
| `webhookService` | Webhooks de saida (HMAC, delivery, logs) |

### 3.7. Backend — 7 Middlewares

| Middleware | Funcionalidade |
|-----------|----------------|
| `auth.ts` | Verificacao JWT + extracão de user |
| `tenant.ts` | Isolamento multi-tenant (tenantId) |
| `csrf.ts` | Protecao CSRF em rotas autenticadas |
| `rateLimit.ts` | 3 limiters: API, auth, password reset |
| `planLimits.ts` | Enforcement de limites do plano |
| `errorHandler.ts` | Tratamento centralizado de erros |
| `requestLogger.ts` | Log estruturado de requests |

### 3.8. Banco de Dados — 25 Modelos Prisma

| Grupo | Modelos |
|-------|---------|
| Auth/Users | User, RefreshToken, Invitation |
| Tenant/Billing | Tenant, Plan, Subscription, Payment |
| CRM Core | Lead, Tag, LeadTag, CustomField, Task |
| Pipeline | Funnel, FunnelColumn |
| Scoring | ScoreRule |
| Comunicacao | Interaction, WhatsAppConnection, EmailConfig |
| Automacao | Automation, AutomationLog |
| API/Webhooks | ApiKey, Webhook, WebhookLog |
| Outros | Notification, Report |

### 3.9. Testes

| Tipo | Arquivos | Cobertura |
|------|----------|-----------|
| Backend (Vitest) | `auth.test.ts`, `leads.test.ts`, `tasks.test.ts`, `funnels.test.ts`, `automations.test.ts` | Core flows |
| Frontend (Vitest + RTL) | `LeadSourceBadge.test.tsx`, `LeadStatusBadge.test.tsx` | Componentes UI |

---

## 4. Stack Tecnologica

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Frontend | React + TypeScript + Vite | 18.x |
| UI Library | shadcn/ui + Radix UI (47 componentes) | — |
| Styling | TailwindCSS | 3.4.x |
| State | React Context (9 contexts) | — |
| Backend | Node.js + Express + TypeScript | 20.x / 4.x |
| ORM | Prisma | 5.7.x |
| Database | PostgreSQL | 16+ |
| Cache | Redis + ioredis | 5.3.x |
| Queue | BullMQ | 5.15.x |
| Auth | JWT + Refresh Tokens + 2FA TOTP | — |
| Real-time | Socket.IO | 4.8.x |
| Email | Resend SDK | 4.8.x |
| Pagamentos | Mercado Pago SDK | 2.1.x |
| PDF | PDFKit | 0.17.x |
| Monitoramento | Sentry | 7.91.x |
| Validacao | Zod | 3.22.x |

---

## 5. Deploy do Backend no Railway (PENDENTE)

### 5.1. Criar projeto no Railway

1. Acesse **https://railway.com/dashboard**
2. Clique **"New Project"**
3. Selecione **"Deploy from GitHub Repo"**
4. Conecte o repositorio `klebersouzabastos/vyd-engage`
5. **IMPORTANTE:** Configure o **Root Directory** como `server`

### 5.2. Adicionar PostgreSQL

1. No projeto, clique **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Copie a `DATABASE_URL` gerada

### 5.3. Adicionar Redis

1. Clique **"+ New"** → **"Database"** → **"Redis"**
2. Copie a `REDIS_URL` gerada

### 5.4. Configurar Variaveis de Ambiente

No servico do backend, adicione:

```env
# Database (copiar do PostgreSQL Railway)
DATABASE_URL=<URL_DO_POSTGRESQL_RAILWAY>

# Server
PORT=3001
NODE_ENV=production

# Auth (GERAR NOVOS PARA PRODUCAO: openssl rand -hex 64)
JWT_SECRET=<GERAR_NOVO>
JWT_REFRESH_SECRET=<GERAR_NOVO>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend
FRONTEND_URL=https://engage.vydhub.com
ALLOWED_ORIGINS=https://engage.vydhub.com

# Redis (copiar do Redis Railway)
REDIS_URL=<URL_DO_REDIS_RAILWAY>

# Email
RESEND_API_KEY=re_LWtUVNCy_6YJTWzvupfgBqJ2MzyG7FDYG
RESEND_FROM_EMAIL=VYD Engage <noreply@engage.vydhub.com>

# Features (ativar quando necessario)
ENABLE_BILLING_JOBS=false
ENABLE_AUTOMATION_ENGINE=false
```

### 5.5. Build & Start

O `railway.toml` ja esta no repo com:
- **Build:** `npm ci && npx prisma generate && npm run build`
- **Start:** `npx prisma migrate deploy && node dist/index.js`
- **Health Check:** `/health`

### 5.6. Apos Deploy do Backend

Atualizar a env var na Vercel com a URL do Railway:

```bash
npx vercel env add VITE_API_URL production
# Cole: https://<seu-servico>.railway.app

# Redeploy
npx vercel build --prod && npx vercel deploy --prebuilt --prod
```

---

## 6. Seguranca

| Mecanismo | Implementacao |
|-----------|--------------|
| Autenticacao | JWT (15min) + Refresh Token (7d) rotation |
| 2FA | TOTP com Google Authenticator + backup codes |
| CSRF | Token-based em todas as rotas autenticadas |
| Rate Limiting | 3 limiters: API geral, auth, password reset |
| Headers | Helmet (CSP, HSTS, X-Frame-Options, etc.) |
| Criptografia | AES-256-GCM para dados sensiveis (WhatsApp tokens) |
| Senhas | bcrypt com salt rounds |
| API Keys | bcrypt hash, exibicao mascarada |
| Webhooks | HMAC-SHA256 signature verification |
| Multi-tenant | Middleware + composite indexes em todas as queries |
| Input validation | Zod schemas em todas as rotas |

---

## 7. Comandos de Desenvolvimento

```bash
# ===== Frontend =====
npm install                   # Instalar dependencias
npm run dev                   # Dev server → http://localhost:5173
npm run build                 # Build producao → build/
npm test                      # Testes (Vitest + RTL)

# ===== Backend =====
cd server
npm install                   # Instalar dependencias
npm run dev                   # Dev server → http://localhost:3001
npm run build                 # TypeScript → dist/
npm test                      # Testes (Vitest)
npm run prisma:migrate        # Rodar migrations
npm run prisma:generate       # Regenerar Prisma Client
npm run prisma:studio         # UI visual do banco
npm run prisma:seed           # Dados iniciais

# ===== Deploy =====
npx vercel --prod             # Deploy frontend (Vercel)
npx vercel env ls             # Listar env vars Vercel
```

---

## 8. Variaveis de Ambiente

### Frontend (.env na raiz)
```
VITE_API_URL=http://localhost:3001
```

### Backend (server/.env)
```
DATABASE_URL=postgresql://user:pass@host:5432/db
PORT=3001
NODE_ENV=development
JWT_SECRET=<hex 64 chars>
JWT_REFRESH_SECRET=<hex 64 chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=VYD Engage <noreply@engage.vydhub.com>
ENABLE_BILLING_JOBS=false
ENABLE_AUTOMATION_ENGINE=false
MERCADOPAGO_ACCESS_TOKEN=<token>
SENTRY_DSN=<dsn>
```

---

## 9. Funcionalidades por Epic

### Epic 1: Foundation, Auth & Multi-Tenancy — 100%
- Registro com criacao automatica de tenant
- Login/Logout com JWT + Refresh Token rotation
- Reset de senha via email (Resend)
- Verificacao de email
- Multi-tenancy com isolamento completo
- Convites por email com roles (ADMIN/USER/VIEWER)
- 2FA com TOTP (Google Authenticator) + backup codes

### Epic 2: CRM Core & Pipeline Visual — 100%
- CRUD de leads com busca, filtros, paginacao
- Import/export CSV de leads com mapeamento de colunas
- Pipeline Kanban com drag-and-drop
- Multi-funil configuravel com colunas e cores
- Tarefas em lista + calendario
- Tags coloridas
- Campos customizados (text, number, date, select, textarea, checkbox)
- Lead scoring com 8 tipos de evento e regras configuraveis
- Formulario publico de captura com UTM tracking

### Epic 3: Comunicacao Multicanal & Automacoes — ~92%
- Conexao WhatsApp + envio de mensagens + templates
- Configuracao de email (SMTP/Resend) + campanhas em massa
- Motor de automacoes (BullMQ) com triggers, steps e logs
- Builder visual de automacoes (triggers, condicoes, acoes)
- Inbox unificado (WhatsApp + Email) com split-panel
- Notificacoes real-time via WebSocket (Socket.IO)
- Email tracking (open pixel + click wrapper)
- Webhooks de entrada (MercadoPago, WhatsApp, Email, Capture)
- Webhooks de saida (CRUD, teste HMAC-SHA256, delivery logs)

### Epic 4: Analytics, Relatorios & Billing — ~95%
- Dashboard com metricas e seletor de data range + export CSV
- Relatorios customizaveis (ReportBuilder) com graficos
- Planos e assinaturas com limites enforced
- Pagamentos via Mercado Pago (checkout + webhook)
- Jobs de billing em background (BullMQ)
- Geracao de PDF de invoices (PDFKit)
- Gerenciamento de API Keys (criacao, revogacao, mascaramento)
- Redis caching para limites de plano (1h) e uso (5min)

### Epic 5: Hardening & Quality — ~82%
- Security hardening (CSRF, rate limiting, helmet, AES-256-GCM)
- Isolamento multi-tenant com 25+ composite indexes
- Performance (lazy loading, code splitting, Vite manual chunks)
- Paginas de auth (Register, ForgotPassword, ResetPassword)
- Monitoramento (Sentry, structured logging, /health endpoint)
- Onboarding wizard + guided tour
- Landing page
- Testes backend: auth, leads, tasks, funnels, automations
- Testes frontend: componentes UI (Vitest + RTL)

---

## 10. Melhorias Futuras Sugeridas

| Prioridade | Melhoria | Impacto |
|-----------|----------|---------|
| Alta | CI/CD Pipeline (GitHub Actions) | Automacao de deploy |
| Alta | Cobertura de testes > 80% | Confiabilidade |
| Media | Automacao avancada (delays, retry, if/else) | Feature completeness |
| Media | Dead-letter queue para webhooks | Resiliencia |
| Media | E2E tests (Playwright) | Validacao end-to-end |
| Baixa | CDN para assets estaticos | Performance |
| Baixa | Monitoring dashboard (Grafana) | Observabilidade |
| Baixa | Backup automatizado (pg_dump) | Disaster recovery |

---

## 11. Contatos e Credenciais

| Servico | Credencial | Onde encontrar |
|---------|-----------|----------------|
| Vercel | `klebersouzabastos` | Logado via CLI |
| GitHub | `klebersouzabastos` | https://github.com/klebersouzabastos |
| Resend | API Key em `server/.env` | Dashboard Resend |
| Dominio email | `noreply@engage.vydhub.com` | Verificado no Resend |
| Dominio web | `engage.vydhub.com` | Configurado na Vercel |
| Railway | Pendente setup | https://railway.com |

---

*Handoff gerado em 23/02/2026 — VYD Engage v1.0.0*
*48 commits | 26 paginas | 21 rotas | 25 servicos | 25 modelos DB*
