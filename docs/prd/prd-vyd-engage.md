# PRD — VYD Engage CRM

**Versão:** 1.0
**Data:** 2026-02-23
**Autor:** Morgan (PM Agent — Synkra AIOS)
**Status:** Brownfield — documentando produto existente + gaps

---

## 1. Goals & Background Context

### Goals

1. **Centralizar gestão de leads** — Oferecer às PMEs brasileiras um CRM completo com pipeline visual Kanban, scoring automático e campos customizáveis
2. **Comunicação multicanal integrada** — Unificar WhatsApp Business API e Email Marketing em uma inbox única com automações conectadas
3. **Automação de processos comerciais** — Eliminar tarefas manuais com engine de automação baseada em eventos (lead criado, status alterado, tag adicionada)
4. **Billing self-service** — Monetizar com 3 tiers (Starter/Pro/Enterprise) via Mercado Pago com PIX, cartão e boleto, renovação automática via BullMQ
5. **Multi-tenancy seguro** — Garantir isolamento total de dados entre organizações com CSRF, rate limiting, encryption AES-256-GCM e JWT httpOnly
6. **Onboarding assistido** — Reduzir time-to-value com wizard de 3 etapas + tour guiado de 5 passos nas funcionalidades principais

### Background Context

VYD Engage faz parte do ecossistema VYD (Value Your Day), focado em produtividade e gestão para pequenas e médias empresas brasileiras. O produto é um CRM SaaS completo construído com React 18 + TypeScript + Vite no frontend e Node.js + Express + Prisma + PostgreSQL no backend. A aplicação está em estágio avançado de desenvolvimento com a maioria das funcionalidades core implementadas.

### Changelog

| Data | Versão | Mudança |
|------|--------|---------|
| 2026-02-23 | 1.0 | PRD inicial documentando estado brownfield completo |

---

## 2. Requirements

### Functional Requirements

| ID | Requisito | Epic | Status |
|----|-----------|------|--------|
| FR-01 | Registro de usuário com criação automática de tenant e plano trial | Epic 1 | ✅ |
| FR-02 | Login com JWT (15min) + refresh token rotation em httpOnly cookies | Epic 1 | ✅ |
| FR-03 | Password reset via token temporário enviado por email (Resend) | Epic 1 | ✅ |
| FR-04 | Verificação de email com token único | Epic 1 | ✅ |
| FR-05 | Multi-tenancy com isolamento via middleware tenantScope + requireTenantAccess | Epic 1 | ✅ |
| FR-06 | Role-based access (ADMIN, USER) com convites por email | Epic 1 | ✅ |
| FR-07 | CRUD completo de leads com paginação, busca, filtros por status/source/tags/assignedTo | Epic 2 | ✅ |
| FR-08 | Importação CSV de leads (até 1000) com deduplicação por email | Epic 2 | ✅ |
| FR-09 | Exportação de leads para CSV/Excel com dados filtrados | Epic 2 | ✅ |
| FR-10 | Pipeline visual Kanban com múltiplos funis, colunas customizáveis e drag-and-drop | Epic 2 | ✅ |
| FR-11 | Drag-and-drop de leads entre colunas com atualização otimista e sync backend | Epic 2 | ✅ |
| FR-12 | Sistema de tarefas com lista e calendário, prioridades, bulk operations | Epic 2 | ✅ |
| FR-13 | Tags coloridas com associação many-to-many a leads | Epic 2 | ✅ |
| FR-14 | Campos customizados (TEXT, TEXTAREA, NUMBER, DATE, CHECKBOX, SELECT) com filtro type-aware | Epic 2 | ✅ |
| FR-15 | Lead scoring baseado em 8 tipos de evento com regras configuráveis por tenant | Epic 2 | ✅ |
| FR-16 | Formulário público de captura de leads com detecção UTM source | Epic 2 | ✅ |
| FR-17 | Integração WhatsApp: conexão multi-provider, envio/recebimento via Meta API v18 | Epic 3 | ✅ |
| FR-18 | Templates WhatsApp com status (APPROVED, PENDING, REJECTED) | Epic 3 | ✅ |
| FR-19 | Integração Email: multi-provider (SMTP, SendGrid, Mailgun, SES, Resend), envio single + bulk (500) | Epic 3 | ✅ |
| FR-20 | Editor de templates de email com variáveis dinâmicas e preview | Epic 3 | ✅ |
| FR-21 | Motor de automações com triggers, steps e conditions em JSON; execução via BullMQ | Epic 3 | 85% |
| FR-22 | Inbox unificada com conversas agrupadas por lead, filtro por canal, resposta inline | Epic 3 | ✅ |
| FR-23 | Sistema de notificações com bell icon, badge, mark read, polling 60s | Epic 3 | ✅ |
| FR-24 | Webhooks incoming: Mercado Pago, WhatsApp Meta, SendGrid, Resend, lead capture via API key | Epic 3 | ✅ |
| FR-25 | Dashboard com métricas agregadas, seletor de período (7d/30d/90d/all), export CSV | Epic 4 | ✅ |
| FR-26 | Relatórios customizáveis com templates, widgets e filtros persistidos | Epic 4 | ✅ |
| FR-27 | Planos (Starter R$97, Pro R$197, Enterprise R$497) com limites dinâmicos e enforcement | Epic 4 | ✅ |
| FR-28 | Pagamentos via Mercado Pago (cartão, PIX, boleto) com webhook de confirmação | Epic 4 | ✅ |

### Non-Functional Requirements

| ID | Requisito | Status |
|----|-----------|--------|
| NFR-01 | Performance: lazy loading em todas as 20+ páginas via React.lazy + Suspense | ✅ |
| NFR-02 | Multi-tenancy: isolamento total via middleware + indexes compostos (25+) | ✅ |
| NFR-03 | Segurança: CSRF double-submit, rate limiting 3 camadas, AES-256-GCM encryption | ✅ |
| NFR-04 | Rate limiting: 100 req/15min API, 10/15min auth, 10/hora password reset | ✅ |
| NFR-05 | Webhooks: validação HMAC-SHA256, processamento assíncrono | ✅ |
| NFR-06 | Responsive: mobile-first com TailwindCSS breakpoints | ✅ |
| NFR-07 | i18n: interface em português brasileiro (pt-BR) | ✅ |
| NFR-08 | Logging: structured logging 4 níveis + Sentry integration + request logging | ✅ |
| NFR-09 | Deployment: health check endpoint com status de services (DB, API) | ✅ |
| NFR-10 | Migrations: Prisma ORM com versionamento de schema | ✅ |
| NFR-11 | Background jobs: BullMQ + Redis para billing e automações (concurrency 5) | ✅ |
| NFR-12 | Code splitting: vendor chunks (react, radix, recharts, exceljs) via Vite manual chunks | ✅ |

---

## 3. UI Design Goals

### UX Vision

- **Simplicidade:** Interface limpa e intuitiva para PMEs sem experiência com CRMs complexos
- **Eficiência:** Ações principais acessíveis em no máximo 2 cliques
- **Confiança:** Feedback visual imediato para todas as ações (toasts, loading states, badges)
- **Modernidade:** Design system consistente com shadcn/ui + Radix UI + TailwindCSS

### Key Interaction Paradigms

| Paradigma | Implementação |
|-----------|--------------|
| Navegação sidebar | Sidebar fixa à esquerda com ícones + labels, collapsible em mobile |
| Kanban drag-and-drop | Colunas de 320px com scroll horizontal, cards arrastáveis, drop targets visuais |
| Inline editing | Edição de nome de funil direto no header, toggle de status de tarefas |
| Toast notifications | Sonner toasts para feedback de ações (sucesso, erro, warning) |
| Multi-step forms | Register (3 steps), Onboarding (3 steps) com progress indicators |
| Modal dialogs | Radix Dialog para ações secundárias (criar lead, config WhatsApp, QR code) |
| Filter popovers | Dropdowns multi-select para filtros combinados |
| Skeleton loading | PageSkeleton component para loading states consistentes |
| Contextual tour | 5-step guided tour com overlay highlighting e auto-navigation |
| Scroll animations | IntersectionObserver para animações lazy na landing page |

### Core Screens

| Tela | Layout | Funcionalidade Principal |
|------|--------|------------------------|
| Dashboard | Grid 4 cols (stat cards) + 2 cols (charts) + 2 cols (tables) | Métricas consolidadas com período |
| Leads | Table com filtros + search + pagination + bulk actions | Gestão completa de contatos |
| Pipeline | Kanban horizontal com colunas de 320px | Visualização de funil de vendas |
| Tasks | Lista agrupada + calendário com sidebar | Gestão de follow-ups e tarefas |
| Inbox | Split view: conversas (left) + detalhe (right) | Comunicação centralizada |
| Automations | Lista com toggle + detail page | Configuração de automações |
| Email Campaigns | Editor + recipient selector + preview | Envio de campanhas |
| Settings | Tab-based (7 tabs) | Configurações centralizadas |
| Reports | Grid/List com search + filter + sort | Relatórios customizados |
| Landing Page | Full-page sections com scroll animations | Apresentação do produto |

### Accessibility & Branding

- **Accessibility target:** WCAG AA
- **Primary color:** Blue #2563eb (VYD ecosystem)
- **Font:** System UI stack (sem dependência de web fonts)
- **Platform:** Web Responsive (desktop-first com suporte mobile)

---

## 4. Technical Assumptions

### Repository Structure

**Monorepo** com frontend na raiz (`/src`) e backend em `/server`:

```
/                    → Frontend (React 18 + TypeScript + Vite)
/server              → Backend (Node.js + Express + TypeScript)
/server/prisma       → Database schema & migrations
```

### Frontend Dependencies

| Categoria | Tecnologia |
|-----------|------------|
| Framework | React 18 + TypeScript |
| Bundler | Vite (esnext target, manual chunks) |
| Styling | TailwindCSS |
| Components | shadcn/ui + Radix UI (Dialog, Dropdown, Tooltip, etc.) |
| Icons | Lucide React |
| Charts | Recharts |
| Forms | react-hook-form + Zod |
| HTTP | Axios (via apiClient wrapper) |
| Toasts | Sonner |
| Excel | exceljs |

### Backend Dependencies

| Categoria | Tecnologia |
|-----------|------------|
| Runtime | Node.js 20+ |
| Framework | Express |
| ORM | Prisma |
| Database | PostgreSQL 16+ |
| Auth | jsonwebtoken + bcryptjs |
| Validation | Zod |
| Email | Resend SDK + Nodemailer |
| Payment | Mercado Pago SDK |
| Jobs | BullMQ + Redis |
| Security | helmet + cors + express-rate-limit + crypto (AES-256-GCM) |
| Monitoring | Sentry (@sentry/node) |
| Testing | Vitest |

### Service Architecture

**Monolith modular** com separação clara de responsabilidades:

| Layer | Pattern | Localização |
|-------|---------|-------------|
| Routes | Express Router + middleware chain | `server/src/routes/` |
| Services | Business logic encapsulada | `server/src/services/` |
| Middleware | Auth, CSRF, tenant, rate limit, error handler | `server/src/middleware/` |
| Jobs | BullMQ workers | `server/src/jobs/` |
| Utils | Helpers compartilhados | `server/src/utils/` |

### Testing

- **Backend:** Vitest com 2 test files (auth, leads) — cobertura básica ~20%
- **Frontend:** Nenhum test suite configurado
- **E2E:** Não implementado

---

## 5. Epic List

| # | Epic | Status | Stories |
|---|------|--------|---------|
| 1 | Foundation, Auth & Multi-Tenancy | ✅ COMPLETE | 6 stories |
| 2 | CRM Core & Pipeline Visual | ✅ COMPLETE | 7 stories |
| 3 | Comunicação Multicanal & Automações | 🔄 90% | 6 stories |
| 4 | Analytics, Relatórios & Billing | 🔄 85% | 7 stories |
| 5 | Hardening, Quality & Feature Completion | 🔄 75% | 7 stories |

**Total:** 5 epics, 33 stories, 180+ critérios de aceitação

---

## 6. Epic Details

### Epic 1: Foundation, Auth & Multi-Tenancy `[COMPLETE]`

#### Story 1.1: Project Setup & Infrastructure `[COMPLETE]`

**Como** desenvolvedor, **quero** um projeto configurado com todas as dependências e ferramentas, **para** iniciar o desenvolvimento rapidamente.

**ACs:**
1. Monorepo com React 18 + Vite no frontend e Express + TypeScript no backend
2. PostgreSQL 16+ com Prisma ORM configurado e migrations rodando
3. TailwindCSS + shadcn/ui + Radix UI instalados e funcionando
4. Variáveis de ambiente separadas (`.env` frontend e `server/.env` backend)
5. Scripts de dev (`npm run dev`), build (`npm run build`) e test (`npm test`) funcionando
6. Docker Compose para desenvolvimento local (PostgreSQL + Redis)
7. ESLint + TypeScript strict mode configurados

#### Story 1.2: User Registration & Tenant Creation `[COMPLETE]`

**Como** novo usuário, **quero** me registrar e ter minha organização criada automaticamente, **para** começar a usar o CRM.

**ACs:**
1. Endpoint `POST /api/auth/register` cria User + Tenant + Subscription (trial) atomicamente
2. Senha hashada com bcryptjs (12 rounds); email validado com Zod
3. Token de verificação de email gerado e enviado via Resend
4. Plano trial com limites default aplicado automaticamente
5. Regras de scoring default criadas para o novo tenant
6. Funil default criado com 7 colunas padrão
7. Frontend Register page com 3 etapas progressivas

#### Story 1.3: Login, Logout & Token Refresh `[COMPLETE]`

**Como** usuário registrado, **quero** fazer login de forma segura e manter minha sessão, **para** acessar meus dados.

**ACs:**
1. `POST /api/auth/login` valida credenciais e retorna JWT (15min) + refresh token (7 dias)
2. Tokens enviados em httpOnly cookies (secure em prod, sameSite strict)
3. `POST /api/auth/refresh` rotaciona refresh token (invalida o anterior)
4. `POST /api/auth/logout` invalida refresh token; `POST /api/auth/logout-all` invalida todos
5. AuthContext no frontend gerencia estado de autenticação e auto-refresh
6. Redirect automático para `/login` quando token expira

#### Story 1.4: Password Reset & Email Verification `[COMPLETE]`

**Como** usuário, **quero** recuperar minha senha e verificar meu email, **para** manter acesso seguro à minha conta.

**ACs:**
1. `POST /api/auth/request-password-reset` gera token temporário e envia email via Resend
2. `POST /api/auth/reset-password` valida token e atualiza senha
3. `GET /api/auth/verify-email/:token` marca email como verificado
4. Rate limiting: 10 requests/hora para password reset
5. Frontend ForgotPassword page com feedback de envio
6. Frontend ResetPassword page com validação de força de senha
7. Emails enviados com template profissional via Resend SDK

#### Story 1.5: Multi-Tenancy Middleware & Data Isolation `[COMPLETE]`

**Como** plataforma SaaS, **quero** isolamento total entre organizações, **para** garantir privacidade de dados.

**ACs:**
1. Middleware `tenantScope` injeta tenantId em todas as queries automaticamente
2. Middleware `requireTenantAccess` bloqueia acesso cross-tenant
3. Todos os models possuem campo tenantId com indexes compostos
4. Unique constraints incluem tenantId (tags, convites, etc.)
5. Cascade deletes configurados para integridade referencial

#### Story 1.6: Role-Based Access & Team Invitations `[COMPLETE]`

**Como** admin, **quero** convidar membros e controlar permissões, **para** gerenciar meu time.

**ACs:**
1. Roles: ADMIN (full access) e USER (restricted)
2. Middleware `requireRole()` bloqueia endpoints por role
3. `POST /api/invitations` cria convite com email e role (Admin only)
4. `GET /api/invitations/token/:token` valida token de convite (rate limited)
5. `POST /api/invitations/accept` aceita convite com nome e senha
6. `GET /api/invitations` lista convites pendentes (Admin only)
7. `DELETE /api/invitations/:id` cancela convite (Admin only)
8. Convite cria User vinculado ao tenant do admin que convidou

---

### Epic 2: CRM Core & Pipeline Visual `[COMPLETE]`

#### Story 2.1: Lead CRUD & Gestão Completa `[COMPLETE]`

**ACs:**
1. API CRUD completa com todos os leads filtrados por tenantId
2. Campos: name, email, phone, company, position, score (0-100), status (7 valores), source (6 valores)
3. Listagem com paginação (20/página), busca, filtros combinados
4. Importação CSV (até 1000 leads) com deduplicação por email
5. Exportação CSV/Excel com dados filtrados
6. Operações bulk (delete) até 100 leads por requisição
7. Criação respeita limites do plano e dispara eventos de scoring/automação

#### Story 2.2: Pipeline Visual Kanban & Múltiplos Funis `[COMPLETE]`

**ACs:**
1. CRUD de funis com múltiplos funis por tenant, um default
2. Funil default com 7 colunas (Novo→Perdido) com cor e mappedStatus
3. CRUD de colunas (add, update, reorder, delete) com proteções
4. Drag-and-drop com atualização otimista e sync backend; revert em falha
5. Mover lead atualiza status e cria interação STATUS_CHANGE
6. Seletor de funis + dialog de configurações com reordenação
7. Filtro por source multi-select
8. Cards com nome, email, score, tags, source — 320px por coluna

#### Story 2.3: Sistema de Tarefas com Lista e Calendário `[COMPLETE]`

**ACs:**
1. CRUD: title, description, status (4 valores), priority (4 valores), dueDate, assignedTo, leadId
2. Vista lista com agrupamento: Vencidas, Hoje, Próximas, Concluídas
3. Vista calendário com indicadores por data e sidebar
4. Filtros combinados por status e prioridade com busca
5. Bulk: seleção múltipla, marcar completo/incompleto em massa
6. Completar define completedAt; descompletar limpa
7. Ordenação: priority DESC, dueDate ASC, createdAt DESC

#### Story 2.4: Tags & Categorização de Leads `[COMPLETE]`

**ACs:**
1. CRUD de tags com nome e cor (hex validado)
2. Unique por tenant (tenantId + name)
3. Associação many-to-many via LeadTag
4. TagBadge com tamanhos sm/md/lg
5. Filtro por tags em leads e pipeline
6. Tag trigger scoring TAG_ADDED e automação tag_added

#### Story 2.5: Campos Customizados `[COMPLETE]`

**ACs:**
1. CRUD com tipos: TEXT, TEXTAREA, NUMBER, DATE, CHECKBOX, SELECT
2. SELECT requer options array; suporte a required e ordering
3. Toggle ativo/inativo (soft delete)
4. Valores em JSON no Lead.customFields
5. Filtro type-aware na listagem
6. Exibição em linha expansível com formatação por tipo
7. Limite de 100 campos por tenant

#### Story 2.6: Lead Scoring Baseado em Eventos `[COMPLETE]`

**ACs:**
1. 8 eventos: LEAD_CREATED (+10), STATUS_CHANGED (+5), TAG_ADDED (+3), INTERACTION_CREATED (+5), EMAIL_OPENED (+8), EMAIL_CLICKED (+15), WHATSAPP_REPLIED (+20), FORM_SUBMITTED (+25)
2. Regras configuráveis por tenant via ScoreRule model
3. Score no Lead, atualizado incrementalmente
4. Regras default criadas na criação do tenant
5. Recalculação manual (individual ou bulk)
6. LeadScoreBadge: vermelho (0-30), amarelo (30-70), verde (70+)

#### Story 2.7: Formulário Público de Captura de Leads `[COMPLETE]`

**ACs:**
1. Página pública em `/app/public/:formId` sem autenticação
2. Campos: nome (obrigatório), email, phone (10+ dígitos), company, message
3. Detecção utm_source ou ref, fallback "WEBSITE"
4. Validação client-side em tempo real em português
5. Submit com loading state e error handling
6. Tela de sucesso com confirmação
7. VYD Ecosystem Banner

---

### Epic 3: Comunicação Multicanal & Automações `[90%]`

#### Story 3.1: Integração WhatsApp — Conexão & Mensagens `[COMPLETE]`

**ACs:**
1. CRUD de conexões com 5 providers (OFFICIAL_API, EVOLUTION_API, BAILEYS, WPPCONNECT, CHATAPI)
2. QR Code com modal e expiração 5min; status tracking com badge visual
3. Envio via Meta Graph API v18.0 com mídia (imagens, docs, áudio)
4. Recebimento via webhook Meta com HMAC-SHA256; status updates (sent, delivered, read, failed)
5. Templates com status APPROVED/PENDING/REJECTED
6. Toda mensagem cria Interaction; resposta dispara scoring WHATSAPP_REPLIED (+20)
7. 7 componentes frontend (ConnectionCard, QRCodeModal, TestMessageModal, etc.)

#### Story 3.2: Integração Email — Configuração & Campanhas `[COMPLETE]`

**ACs:**
1. CRUD de configs com 5 providers (SMTP, SendGrid, Mailgun, SES, Resend)
2. Verificação e envio de teste por config
3. Envio individual com HTML + texto + variáveis + Interaction automático
4. Bulk até 500 destinatários com limites de plano
5. Editor de templates com toolbar, variáveis, preview, localStorage
6. Transport factory por provider via nodemailer
7. Scoring: EMAIL_OPENED (+8), EMAIL_CLICKED (+15)

#### Story 3.3: Motor de Automações `[85%]`

**ACs:**
1. CRUD com name, description, status (DRAFT, ACTIVE, PAUSED), trigger/steps/conditions JSON
2. Execução manual com leadId opcional
3. Engine BullMQ com triggers: lead_created, status_changed, tag_added
4. Logs com status SUCCESS/ERROR/SKIPPED; estatísticas (runs, success, error)
5. Frontend: lista com toggle, execução manual, logs e stats
6. Página de detalhe/edição para trigger, steps, condições

**Gaps:** UI builder visual, step delay/wait, retry automático, condicionais if/else

#### Story 3.4: Inbox Unificada `[COMPLETE]`

**ACs:**
1. Conversas agrupadas por lead com filtro por canal e busca
2. 7 tipos de interação com direction INBOUND/OUTBOUND
3. Timeline por lead com paginação e metadados JSON
4. Layout inbox: sidebar conversas + detalhe conversa + card lead
5. Envio inline de WhatsApp e Email com status indicators
6. Contagem não lidas, badge, refresh

#### Story 3.5: Sistema de Notificações `[COMPLETE]`

**ACs:**
1. CRUD com isolamento userId + tenantId
2. Contagem não lidas com filtro por status e tipo
3. NotificationCenter: bell icon + badge + popover
4. NotificationContext com polling 60s
5. TaskNotificationChecker para tarefas vencidas/próximas
6. Cada notificação: title, message, type, link, metadata, timestamps

#### Story 3.6: Webhooks — Recebimento & Captura `[80%]`

**ACs:**
1. Mercado Pago: HMAC-SHA256, status de pagamento
2. WhatsApp Meta: verification challenge, incoming + status updates
3. Email: SendGrid e Resend eventos (delivery, open, click, bounce)
4. Lead capture via API key com parsing flexível e bcrypt validation
5. Models Webhook + WebhookLog para tracking outgoing

**Gaps:** UI de gerenciamento, retry com backoff, dead letter queue, webhooks outgoing

---

### Epic 4: Analytics, Relatórios & Billing `[85%]`

#### Story 4.1: Dashboard Interativo com Métricas `[COMPLETE]`

**ACs:**
1. Endpoint metrics com filtro por período (from/to ISO)
2. Seletor: 7d, 30d, 90d, Tudo
3. Grid responsivo: stat cards + charts + tables
4. Widgets removíveis com persistência local
5. Export CSV com BOM UTF-8 para Excel
6. Skeleton loading, error com retry, tempo atrás em pt-BR

#### Story 4.2: Relatórios Customizáveis `[COMPLETE]`

**ACs:**
1. CRUD com name, description, type, config (widgets, schedule, filters, shareSettings)
2. Templates pré-definidos com wizard guiado
3. Grid/lista, busca, filtro por tipo, ordenação múltipla
4. Config persistida para personalização
5. Atribuição de criador para auditoria

#### Story 4.3: Planos, Assinaturas & Limites `[COMPLETE]`

**ACs:**
1. STARTER R$97, PRO R$197 (destacado), ENTERPRISE R$497
2. MONTHLY/YEARLY com 20% desconto anual
3. Subscription current + usage; change plan; cancel; reactivate
4. PlanContext global com limits, usage, canUpgrade/canDowngrade
5. planLimitsService: getLimits, getUsage, checkLimit, enforceLimit
6. Tab Billing: plano atual, comparação, barras de uso, payment history
7. Status: ACTIVE, TRIAL, CANCELLED, EXPIRED, PAST_DUE

#### Story 4.4: Pagamentos com Mercado Pago `[COMPLETE]`

**ACs:**
1. Preferência MP com items, payer, back URLs, webhook
2. 3 métodos: Credit Card, PIX, Boleto com componentes dedicados
3. PaymentModal + PaymentContext orquestra fluxo completo
4. Webhook HMAC-SHA256; mapeamento status; ativação automática em PAID
5. Payment model com amount BRL, mercadoPagoId, idempotência
6. Histórico na tab Billing

#### Story 4.5: Jobs de Billing Automáticos `[COMPLETE]`

**ACs:**
1. BullMQ queue billing com retry exponencial (3 tentativas, 2s)
2. scheduleBillingJob agenda para data de renovação
3. Worker calcula amount (monthly/yearly), cria payment intent
4. initializeBillingJobs re-agenda no startup
5. processOverdueSubscriptions para vencidas
6. Controlado via ENABLE_BILLING_JOBS

#### Story 4.6: API Keys para Integradores `[COMPLETE]`

**ACs:**
1. CRUD de API keys com múltiplas por tenant
2. Formato fcrm_{uuid}; banco armazena hash bcrypt + masked
3. Expiração opcional, lastUsedAt, soft delete via active
4. Capture endpoint valida via bcrypt e cria lead

**Gap:** UI frontend para gerenciamento (backend completo)

#### Story 4.7: Página de Configurações Unificada `[COMPLETE]`

**ACs:**
1. `/app/settings?tab=` com 7 tabs via query param
2. Company, Notifications, Integrations, Billing, Tags, Custom Fields, Lead Scoring
3. Tab Billing integra PlanContext + PaymentContext + PaymentModal

---

### Epic 5: Hardening, Quality & Feature Completion `[75%]`

#### Story 5.1: Security Hardening `[COMPLETE]`

**ACs:**
1. JWT access (15min) + refresh (7d) em httpOnly cookies
2. bcryptjs 12 rounds; validação de senha atual em alteração
3. CSRF double-submit cookie com timing-safe comparison
4. Rate limiting 3 camadas (API, auth, password reset)
5. Helmet + CORS estrito com allowlist por ambiente
6. AES-256-GCM para dados sensíveis
7. Error handler sem info leak em produção + Sentry

#### Story 5.2: Multi-Tenancy & Isolamento `[COMPLETE]`

**ACs:**
1. requireTenantAccess verifica pertencimento
2. tenantScope injeta tenantId automaticamente
3. 25+ indexes compostos no Prisma
4. Unique constraints com tenantId
5. Cascade deletes + soft deletes onde necessário

#### Story 5.3: Performance `[COMPLETE]`

**ACs:**
1. React.lazy + Suspense em 20+ páginas
2. Vite manual chunks (react, radix, recharts, exceljs)
3. 25+ indexes para queries frequentes
4. BullMQ com 5 workers concorrentes
5. Bundle ~3.3MB (gzipped 808KB)

#### Story 5.4: Páginas de Auth `[COMPLETE]`

**ACs:**
1. Register 3 etapas com indicador de força de senha
2. ForgotPassword com normalização e feedback
3. ResetPassword com token da URL e auto-redirect
4. Login com show/hide, toast notifications
5. Backend completo para todos os fluxos

#### Story 5.5: Monitoramento `[COMPLETE]`

**ACs:**
1. Logger 4 níveis com timestamp + metadata
2. Sentry com Http/Express/Prisma integrations
3. Health check /health com DB + API status
4. Request logging com duração e breadcrumbs

#### Story 5.6: Onboarding & Tour `[COMPLETE]`

**ACs:**
1. Wizard 3 etapas: empresa, WhatsApp, confirmação
2. Tour 5 passos com overlay highlighting
3. Data attributes nos targets
4. Persistência localStorage

#### Story 5.7: Landing Page & Testes `[70%]`

**ACs:**
1. ✅ Landing page completa com navbar, hero, features, testimonials, pricing, FAQ
2. ✅ Scroll animations via IntersectionObserver
3. ⚠️ Backend tests: 2 arquivos, cobertura ~20% — expandir
4. ❌ Frontend tests: não configurado
5. ❌ 2FA: schema existe, implementação ausente

---

## 7. Checklist Results Report

| # | Critério | Status | Observação |
|---|----------|--------|------------|
| 1 | Goals claros e mensuráveis | ✅ | 6 goals com escopo definido |
| 2 | Requirements rastreáveis | ✅ | 28 FRs + 12 NFRs com status |
| 3 | UI goals com target de plataforma | ✅ | Web responsive, WCAG AA, 10 core screens |
| 4 | Tech stack definido | ✅ | Monorepo React+Express+Prisma+PostgreSQL |
| 5 | Epics com escopo claro | ✅ | 5 epics com boundaries e completion % |
| 6 | Stories com ACs testáveis | ✅ | 33 stories, 180+ ACs específicos |
| 7 | Dependências mapeadas | ✅ | Ordering implícito + cross-references |
| 8 | Riscos documentados | ⚠️ | Gaps por story, falta seção dedicada |
| 9 | Métricas de sucesso | ⚠️ | Implícitas nos ACs, sem KPIs explícitos |
| 10 | Alinhamento PRD↔Codebase | ✅ | Documenta estado real verificado |

---

## 8. Next Steps

### Para UX Expert (@ux-design-expert):

> Analise o PRD do VYD Engage CRM e projete melhorias de UX para: (1) Tour de onboarding gamificado com progress tracking, (2) Inbox unificada com real-time via WebSocket, (3) Automation builder visual drag-and-drop, (4) Mobile-responsive dashboard com widgets reordenáveis via touch. Design system: shadcn/ui + Radix UI + TailwindCSS, primary blue #2563eb.

### Para Architect (@architect):

> Com base no PRD do VYD Engage, projete a arquitetura para: (1) WebSocket layer para notificações e inbox real-time, (2) Redis caching strategy para planos/configs/sessions, (3) 2FA implementation com TOTP (speakeasy/otplib), (4) Email tracking pipeline (open pixel + click wrapper + webhook processing), (5) Invoice PDF generation service. Stack: Express + Prisma + PostgreSQL + BullMQ/Redis.

### Prioridades Imediatas

| Prioridade | Item | Epic |
|------------|------|------|
| P0 | Expandir cobertura de testes backend (tasks, funnels, automations) | 5 |
| P0 | Configurar test suite frontend (Vitest + React Testing Library) | 5 |
| P1 | Implementar 2FA com TOTP | 5 |
| P1 | Automation builder visual (UI para triggers/steps/conditions) | 3 |
| P1 | Email tracking (open pixel + click wrapper) | 3 |
| P2 | WebSocket para inbox e notificações real-time | 3 |
| P2 | Redis caching para planos e configs | 5 |
| P2 | Invoice PDF generation | 4 |
| P3 | Webhook management UI | 3 |
| P3 | API Keys management UI | 4 |

---

*Gerado por Morgan (PM Agent) via Synkra AIOS — 2026-02-23*
*VYD Engage v0.1.0 — Brownfield PRD v1.0*
