# VYD Engage - System Architecture Document

**Tipo:** Brownfield Analysis (Estado Atual)
**Data:** 2026-02-20
**Fase:** Brownfield Discovery - Fase 1 (Coleta: Sistema)
**Agente:** @architect (Aria)
**Versao:** 1.0

---

## Executive Summary

VYD Engage e um CRM SaaS multi-tenant construido com React 18 + Vite (frontend) e Express + Prisma + PostgreSQL (backend). O projeto esta em estagio inicial (v0.1.0) com funcionalidades core implementadas: autenticacao, gestao de leads, tasks, automacoes, pagamentos (Mercado Pago), integracoes WhatsApp/Email, e sistema de notificacoes.

O codebase apresenta sinais de migracao de uma plataforma no-code/low-code (possivelmente Lovable/v0.dev), evidenciado pelos aliases versionados no Vite config e pela estrutura de componentes UI.

---

## 1. Quick Reference - Arquivos Criticos

### Entry Points
- **Frontend Entry:** `src/main.tsx` → `src/App.tsx`
- **Backend Entry:** `server/src/index.ts`
- **Database Schema:** `server/prisma/schema.prisma`
- **Routing Frontend:** `src/utils/routes.tsx`
- **API Client:** `src/services/api/client.ts`

### Configuracao
- **Vite:** `vite.config.ts`
- **TypeScript Backend:** `server/tsconfig.json`
- **Docker:** `docker-compose.yml`
- **Prisma:** `server/prisma/schema.prisma`

### Business Logic (Backend)
- **Auth:** `server/src/services/authService.ts` + `server/src/routes/auth.ts`
- **Leads:** `server/src/services/leadService.ts` + `server/src/routes/leads.ts`
- **Payments:** `server/src/services/paymentService.ts` + `server/src/services/mercadopagoService.ts`
- **Subscriptions:** `server/src/services/subscriptionService.ts`
- **Plan Limits:** `server/src/services/planLimitsService.ts` + `server/src/middleware/planLimits.ts`

### Middleware Stack
- **Auth:** `server/src/middleware/auth.ts` (JWT verification + user lookup)
- **Tenant:** `server/src/middleware/tenant.ts` (multi-tenancy isolation)
- **Rate Limit:** `server/src/middleware/rateLimit.ts` (3 limiters: api, auth, passwordReset)
- **Error Handler:** `server/src/middleware/errorHandler.ts` (centralized + Sentry)
- **Plan Limits:** `server/src/middleware/planLimits.ts` (resource enforcement)
- **Request Logger:** `server/src/middleware/requestLogger.ts`

---

## 2. Tech Stack (Atual)

### Frontend

| Categoria | Tecnologia | Versao | Notas |
|-----------|-----------|--------|-------|
| Runtime | React | 18.3.1 | SPA, client-side rendering |
| Build Tool | Vite | 6.3.5 | SWC plugin para React |
| Linguagem | TypeScript | (via Vite) | Sem tsconfig.json proprio no root |
| Estilizacao | TailwindCSS | * (latest) | Sem versao pinada |
| UI Components | shadcn/ui + Radix UI | Multiplas | 25+ componentes Radix instalados |
| Forms | react-hook-form | 7.55.0 | Com @hookform/resolvers + Zod |
| Validacao | Zod | 3.22.4 | Compartilhado com backend |
| Roteamento | react-router | * (latest) | createBrowserRouter |
| Charts | Recharts | 2.15.2 | Para dashboards e relatorios |
| Toasts | Sonner | 2.0.3 | Via shadcn/ui integration |
| Export | ExcelJS | 4.4.0 | Exportacao de dados para Excel |
| Icons | Lucide React | 0.487.0 | Icones SVG |

### Backend

| Categoria | Tecnologia | Versao | Notas |
|-----------|-----------|--------|-------|
| Runtime | Node.js | 20+ | ESM modules (`"type": "module"`) |
| Framework | Express | 4.18.2 | REST API |
| Linguagem | TypeScript | 5.3.3 | Target ES2022 |
| ORM | Prisma | 5.7.1 | Client + migrations |
| Database | PostgreSQL | 16+ | Via Docker (alpine) |
| Auth | jsonwebtoken | 9.0.2 | JWT + Refresh Tokens |
| Password | bcryptjs | 2.4.3 | Hashing |
| Job Queue | BullMQ | 5.15.0 | Background billing jobs |
| Cache/Queue | Redis (ioredis) | 5.3.2 | Via Docker (alpine) |
| Payment | mercadopago | 2.1.7 | SDK oficial |
| Email | Resend (4.8.0) + Nodemailer (6.9.7) | Dual | Resend como primario |
| Security | Helmet (7.1.0) + express-rate-limit (7.1.5) | | Headers + rate limiting |
| Monitoring | Sentry | 7.91.0 | Error tracking |
| Logging | Morgan (1.10.0) + custom logger | | HTTP + application logs |
| Compression | compression | 1.7.4 | gzip |
| Dev Server | tsx | 4.7.0 | TypeScript execution + watch |
| Testing | Vitest | 1.1.0 | Com UI mode |
| UUID | uuid | 9.0.1 | Geracao de IDs |

### Infraestrutura

| Componente | Tecnologia | Config |
|-----------|-----------|--------|
| Database | PostgreSQL 16 Alpine | Docker, porta 5432 |
| Cache/Queue | Redis 7 Alpine | Docker, porta 6379 |
| Container Mgmt | Docker Compose | v3.8 |

---

## 3. Arquitetura do Sistema

### 3.1 Visao Geral

```
                    ┌─────────────────────┐
                    │   Browser (SPA)     │
                    │  React 18 + Vite    │
                    │  Port: 5173 (dev)   │
                    └─────────┬───────────┘
                              │ HTTP/REST
                              │ Bearer JWT
                    ┌─────────▼───────────┐
                    │  Express API Server │
                    │    Port: 3001       │
                    │                     │
                    │  Middleware Chain:   │
                    │  CORS → Helmet →    │
                    │  Compression →      │
                    │  JSON → Morgan →    │
                    │  RateLimit → Auth → │
                    │  Tenant → Handler   │
                    └──┬──────────┬───────┘
                       │          │
              ┌────────▼──┐  ┌───▼────────┐
              │ PostgreSQL│  │   Redis     │
              │ (Prisma)  │  │ (BullMQ)   │
              │ Port:5432 │  │ Port:6379  │
              └───────────┘  └────────────┘
```

### 3.2 Monorepo Layout

```
VYD Engage/
├── src/                          # Frontend (React SPA)
│   ├── components/               # 80+ componentes
│   │   ├── ui/                   # 45+ shadcn/ui components
│   │   ├── email/                # Email config components (4)
│   │   ├── payment/              # Payment components (5)
│   │   ├── register/             # Registration components (3)
│   │   ├── whatsapp/             # WhatsApp components (5)
│   │   └── figma/                # ImageWithFallback (1)
│   ├── pages/                    # 22 pages
│   ├── contexts/                 # 9 React Contexts
│   ├── services/api/             # API client (single file)
│   ├── utils/                    # Routing + utilities
│   ├── types/                    # TypeScript types
│   └── styles/                   # CSS
├── server/                       # Backend (Express API)
│   ├── src/
│   │   ├── routes/               # 16 route files
│   │   ├── services/             # 16 service files
│   │   ├── middleware/           # 6 middleware files
│   │   ├── config/               # Database config
│   │   ├── jobs/                 # 1 billing job
│   │   ├── utils/                # 5 utility files
│   │   └── __tests__/            # 2 test files
│   ├── prisma/
│   │   ├── schema.prisma         # 20+ models
│   │   └── migrations/           # 1 migration file
│   └── package.json
├── docker-compose.yml            # PostgreSQL + Redis
├── vite.config.ts                # Frontend build config
└── package.json                  # Frontend dependencies
```

### 3.3 Multi-Tenancy Pattern

O isolamento de dados e feito via `tenantId` em todas as tabelas de negocio. O fluxo:

1. **authenticate** middleware: extrai JWT, valida user, injeta `req.user` com `{ userId, tenantId, email, role }`
2. **tenantScope** middleware: injeta `tenantId` em `req.query` e `req.body`
3. **requireTenantAccess** middleware: valida que user pertence ao tenant solicitado
4. **Queries Prisma**: filtram por `tenantId` em todas as operacoes

**Ponto de atencao:** O `tenantId` vem do JWT payload, nao de um header separado. Isso significa que um usuario so acessa dados do tenant ao qual pertence.

### 3.4 Authentication Flow

```
Login Request → authLimiter → authService.login()
  → Validate credentials (bcrypt)
  → Generate JWT (accessToken) + UUID (refreshToken)
  → Store refreshToken in DB (RefreshToken model)
  → Return { user, accessToken, refreshToken }

Authenticated Request → authenticate middleware
  → Extract Bearer token
  → verifyAccessToken (jwt.verify)
  → Lookup user in DB (verify exists + ACTIVE)
  → Inject req.user
  → Next middleware

Token Refresh → POST /api/auth/refresh
  → Validate refreshToken exists in DB
  → Generate new accessToken
  → Return { accessToken }
```

**Tokens armazenados no frontend:** `localStorage` (accessToken + refreshToken)
**Auto-refresh:** ApiClient intercepta 401, tenta refresh automaticamente, retenta request

### 3.5 API Routes Map

| Prefixo | Rate Limiter | Arquivo | Recursos |
|---------|-------------|---------|----------|
| `/api/auth` | authLimiter | `auth.ts` | login, register, refresh, logout, me, password reset |
| `/api/auth/password` | passwordResetLimiter | `auth.ts` | reset-request, reset |
| `/api/leads` | apiLimiter | `leads.ts` | CRUD leads |
| `/api/tasks` | apiLimiter | `tasks.ts` | CRUD tasks |
| `/api/tags` | apiLimiter | `tags.ts` | CRUD tags |
| `/api/subscriptions` | apiLimiter | `subscriptions.ts` | current, plans |
| `/api/payments` | apiLimiter | `payments.ts` | payment processing |
| `/api/users` | apiLimiter | `users.ts` | user management |
| `/api/api-keys` | apiLimiter | `apiKeys.ts` | API key management |
| `/api/automations` | apiLimiter | `automations.ts` | CRUD automations |
| `/api/whatsapp` | apiLimiter | `whatsapp.ts` | WhatsApp connections |
| `/api/email` | apiLimiter | `email.ts` | Email configs |
| `/api/custom-fields` | apiLimiter | `customFields.ts` | Custom field definitions |
| `/api/interactions` | apiLimiter | `interactions.ts` | Lead interactions |
| `/api/notifications` | apiLimiter | `notifications.ts` | User notifications |
| `/api/invitations` | apiLimiter | `invitations.ts` | Team invitations |
| `/api/webhooks` | (nenhum) | `webhooks.ts` | Webhook management |
| `/health` | (nenhum) | `index.ts` | Health check |

**Nota:** O `apiLimiter` esta aplicado APOS as rotas (`app.use('/api', apiLimiter)` na linha 112), o que significa que ele NAO protege as rotas acima dele. Isso e um **bug de ordenacao** — o limiter so se aplica a rotas registradas depois dele.

### 3.6 Frontend Architecture

**Routing:** 22 rotas usando `createBrowserRouter` (react-router)
- Rotas publicas: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/onboarding`, `/capture/:formId`
- Rotas protegidas: `/app/*` (wrappedpor `AppLayout`)

**Context Providers (9 niveis de nesting):**
```
AuthProvider
  └── CompanyProvider
      └── TagsProvider
          └── CustomFieldsProvider
              └── NotificationProvider
                  └── PlanProvider
                      └── PaymentProvider
                          └── WhatsAppProvider
                              └── EmailProvider
```

**API Client:** Classe unica `ApiClient` em `src/services/api/client.ts`
- Gerencia tokens (localStorage)
- Auto-refresh de JWT em 401
- Metodos para todos os recursos (leads, tasks, tags, etc.)
- Tipagem: usa `any` extensivamente

---

## 4. Database Schema

### 4.1 Modelos (20 modelos, 658 linhas)

| Grupo | Modelos | Quantidade |
|-------|---------|------------|
| Auth & Authz | User, RefreshToken, Invitation | 3 |
| Tenant | Tenant | 1 |
| Billing | Plan, Subscription, Payment | 3 |
| CRM Core | Lead, Tag, LeadTag, CustomField, Task, Interaction | 6 |
| Automations | Automation, AutomationLog | 2 |
| Communications | WhatsAppConnection, EmailConfig | 2 |
| API & Webhooks | ApiKey, Webhook, WebhookLog | 3 |
| Notifications | Notification | 1 |

### 4.2 Enums (14)

UserRole, UserStatus, PlanType, SubscriptionStatus, LeadStatus, LeadSource, TaskStatus, TaskPriority, AutomationStatus, WhatsAppProvider, WhatsAppConnectionStatus, EmailProvider, NotificationType, NotificationStatus

### 4.3 Indices

Indices compostos bem definidos nas tabelas principais:
- `User`: `[email]`, `[tenantId]`, `[tenantId, email]`
- `Lead`: `[tenantId]`, `[tenantId, status]`, `[tenantId, email]`, `[tenantId, createdAt]`
- `Task`: `[tenantId]`, `[tenantId, status]`, `[tenantId, assignedTo]`, `[tenantId, dueDate]`
- `Notification`: `[tenantId, userId]`, `[tenantId, userId, status]`, `[createdAt]`

### 4.4 Relacionamentos Chave

- `Tenant` → 1:N → `User`, `Lead`, `Task`, `Tag`, `Automation`, etc. (hub central)
- `Tenant` → 1:1 → `Subscription`
- `Lead` → N:M → `Tag` (via `LeadTag` join table)
- `Lead` → 1:N → `Interaction`, `Task`
- `Subscription` → N:1 → `Plan`
- `Automation` → 1:N → `AutomationLog`
- `Webhook` → 1:N → `WebhookLog`

---

## 5. Debitos Tecnicos Identificados

### 5.1 CRITICOS

| ID | Debito | Area | Impacto |
|----|--------|------|---------|
| TD-01 | **apiLimiter posicionado APOS rotas** — rate limiting nao funciona para nenhuma rota de negocio | Backend/Security | ALTO - DoS possivel |
| TD-02 | **CORS `origin: true`** — permite qualquer origem em qualquer ambiente | Backend/Security | ALTO - CSRF possivel em producao |
| TD-03 | **Tokens em localStorage** — vulneravel a XSS | Frontend/Security | ALTO - token theft |
| TD-04 | **Campos `assignedTo` sao String sem FK** — `Task.assignedTo` e `Lead.assignedTo` nao tem foreign key para User | Database | MEDIO - integridade referencial |

### 5.2 ALTOS

| ID | Debito | Area | Impacto |
|----|--------|------|---------|
| TD-05 | **Apenas 2 arquivos de teste** (auth.test.ts, leads.test.ts) — cobertura minima | Backend/Testing | ALTO - regressoes |
| TD-06 | **Zero testes no frontend** | Frontend/Testing | ALTO - regressoes |
| TD-07 | **9 Context Providers aninhados** — "Context Hell", re-renders desnecessarios, performance | Frontend/Architecture | ALTO - performance |
| TD-08 | **ApiClient usa `any` em 95% dos metodos** — sem type safety no frontend | Frontend/TypeScript | ALTO - bugs silenciosos |
| TD-09 | **Sem migration proper** — apenas 1 arquivo SQL manual, sem historico de migrations | Database | ALTO - schema drift |
| TD-10 | **Docker compose usa nomes "flowcrm"** — nome do projeto legado, confuso | Infrastructure | BAIXO - cosmetic |

### 5.3 MEDIOS

| ID | Debito | Area | Impacto |
|----|--------|------|---------|
| TD-11 | **Vite aliases versionados** — 25+ aliases com versao pinada (ex: `vaul@1.1.2`) | Frontend/Build | MEDIO - manutencao |
| TD-12 | **Duplicacao massiva no ApiClient** — error handling identico em register, login, requestPasswordReset, resetPassword | Frontend/Code Quality | MEDIO - manutencao |
| TD-13 | **Sem CI/CD pipeline** — nenhum GitHub Actions ou similar configurado | DevOps | MEDIO - qualidade |
| TD-14 | **Sem linting/formatting frontend** — nenhum ESLint ou Prettier configurado | Frontend/Code Quality | MEDIO - consistencia |
| TD-15 | **Sem tsconfig.json no root** — frontend sem type-checking dedicado | Frontend/TypeScript | MEDIO - tipo safety |
| TD-16 | **PrismaClient instanciado no module scope** — `prisma.$connect()` chamado ao importar | Backend/Architecture | BAIXO - cold start |
| TD-17 | **Sem paginacao padronizada** — cada rota implementa filtros de forma diferente | Backend/API | MEDIO - inconsistencia |
| TD-18 | **webhookRoutes sem rate limiting NEM auth** — endpoint exposto sem protecao | Backend/Security | MEDIO - abuso possivel |

---

## 6. Padroes Existentes

### 6.1 Backend Patterns

**Route Pattern:**
```typescript
// Arquivo: server/src/routes/{resource}.ts
const router = express.Router();
router.get('/', authenticate, tenantScope, async (req, res, next) => {
  try {
    // logica
    res.json({ status: 200, data: result });
  } catch (error) {
    next(error);
  }
});
export default router;
```

**Service Pattern:**
```typescript
// Arquivo: server/src/services/{resource}Service.ts
// Funcoes exportadas (nao classe)
export async function getLeads(tenantId: string, filters: any) {
  return prisma.lead.findMany({ where: { tenantId, ...filters } });
}
```

**Error Pattern:**
```typescript
import { createError } from './errorHandler.js';
throw createError('Message', 400, 'ERROR_CODE');
```

### 6.2 Frontend Patterns

**Page Pattern:**
```tsx
export function PageName() {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState([]);
  useEffect(() => { apiClient.getData().then(setData); }, []);
  return <div>...</div>;
}
```

**Context Pattern:**
```tsx
const Context = createContext<ContextType>({} as ContextType);
export function Provider({ children }) {
  // state + effects
  return <Context.Provider value={...}>{children}</Context.Provider>;
}
```

### 6.3 Naming Conventions

| Tipo | Convencao | Exemplo |
|------|-----------|---------|
| Routes (backend) | kebab-case | `/api/custom-fields` |
| Services | camelCase functions | `getLeads()`, `createLead()` |
| Components | PascalCase | `LeadModal.tsx`, `TaskCard.tsx` |
| Pages | PascalCase | `Dashboard.tsx`, `Leads.tsx` |
| Contexts | PascalCase + Provider | `AuthContext.tsx`, `AuthProvider` |
| DB Models | PascalCase | `Lead`, `RefreshToken` |
| DB Enums | UPPER_SNAKE_CASE | `LEAD_STATUS`, `USER_ROLE` |

---

## 7. Integracao com Servicos Externos

| Servico | Proposito | Tipo | Arquivos Chave |
|---------|-----------|------|----------------|
| Mercado Pago | Pagamentos (PIX, cartao, boleto) | SDK | `server/src/services/mercadopagoService.ts`, `server/src/services/paymentService.ts` |
| Resend | Envio de emails (primario) | API | `server/src/services/emailService.ts` |
| Nodemailer | Envio de emails (SMTP fallback) | SMTP | `server/src/services/emailService.ts` |
| Sentry | Error tracking | SDK | `server/src/utils/sentry.ts` |
| Redis | Queue para BullMQ jobs | TCP | `server/src/jobs/billing.ts` |
| WhatsApp (multiplos providers) | Mensageria | API | `server/src/services/whatsappService.ts` |

---

## 8. Desenvolvimento Local

### Setup

```bash
# 1. Infraestrutura
docker-compose up -d  # PostgreSQL + Redis

# 2. Backend
cd server
cp .env.example .env  # Configurar variaveis
npm install
npm run prisma:migrate
npm run prisma:generate
npm run prisma:seed    # Dados iniciais
npm run dev            # Port 3001

# 3. Frontend
cd ..
npm install
npm run dev            # Port 5173
```

### Variaveis de Ambiente

**Backend (server/.env):**
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — Segredos JWT
- `REDIS_URL` — Redis connection (para BullMQ)
- `MERCADO_PAGO_ACCESS_TOKEN` — Pagamentos
- `RESEND_API_KEY` — Envio de emails
- `SMTP_*` — Configuracao SMTP fallback
- `PORT` — Porta do servidor (default: 3001)
- `SENTRY_DSN` — Error tracking (opcional)
- `ENABLE_BILLING_JOBS` — Ativar jobs BullMQ (default: false)

**Frontend (.env no root):**
- `VITE_API_URL` — URL do backend (default: http://localhost:3001)

### Comandos Uteis

```bash
# Backend
cd server
npm run dev              # Dev server com hot reload
npm test                 # Vitest
npm run prisma:studio    # Visual DB browser
npm run build            # Compilar TypeScript

# Frontend
npm run dev              # Vite dev server
npm run build            # Build producao → build/
```

---

## 9. Build & Deploy

### Frontend Bundle

- **Output:** `build/`
- **Target:** ESNext
- **Tamanho estimado:** ~3.3MB (808KB gzipped)
- **Problema conhecido:** Bundle grande, sem code-splitting

### Backend Build

- **Compilacao:** `tsc` → `dist/`
- **Target:** ES2022
- **Execucao:** `node dist/index.js`

### Producao Checklist

- [ ] Configurar CORS origin para dominio especifico (NAO `true`)
- [ ] Configurar JWT secrets fortes e unicos
- [ ] Rodar migrations: `npx prisma migrate deploy`
- [ ] Redis running para BullMQ
- [ ] Sentry DSN configurado
- [ ] `NODE_ENV=production`

---

## 10. Pontos de Atencao para Novas Features

1. **Sempre incluir `tenantId`** em novas queries Prisma
2. **Seguir pattern** de route → service → prisma
3. **Auth middleware** deve ser primeiro em rotas protegidas
4. **Rate limiting** precisa ser corrigido (TD-01) antes de produção
5. **Testes** devem ser adicionados para qualquer nova funcionalidade
6. **Tipagem** — evitar `any`, definir interfaces proprias
7. **Migrations** — usar `prisma migrate dev` para criar migrations proprias (nao SQL manual)

---

## Change Log

| Data | Versao | Descricao | Autor |
|------|--------|-----------|-------|
| 2026-02-20 | 1.0 | Analise brownfield inicial — Fase 1 Discovery | @architect (Aria) |

---

*-- Aria, arquitetando o futuro*
