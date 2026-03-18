# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Princípios Operacionais

**"Never take the lazy path. Do the hard work now."**

- **Explore → Proponha → Valide → Execute → Verifique** (não seja apenas executor de tarefas)
- **Discovery antes de implementação:** mapeie o que já existe antes de criar algo novo
- **Opções antes de implementação:** sempre apresente alternativas com trade-offs
- **Determinismo primeiro:** código/SQL/regex > LLM para tarefas previsíveis
- **Commits atômicos:** uma mudança específica por commit, diff antes de aplicar
- **Só o que foi pedido:** feature não solicitada é débito, não crédito
- **3 linhas duplicadas > 1 abstração prematura**

### Gradiente de Permissão

| Ação | Regra |
|------|-------|
| READ | Livre |
| MOVE | Após aprovação de direção |
| CREATE | Verificar se similar existe primeiro |
| DELETE | **SEMPRE confirmar** |

Aprovação de direção = execute até completar. Não pergunte "Quer que eu continue?" após aprovação já dada.

### Regras Críticas

- **Regra do 2x:** Se o usuário repetiu algo 2x → você não entendeu. PARE e faça EXATAMENTE o pedido.
- **Leitura completa:** NUNCA leia arquivos parcialmente antes de editar. `Read(file)` completo, depois `Edit`.
- **Verificação física:** `ls -la`, `curl -I`, hard refresh antes de declarar "completo".
- **Debugging por hipótese:** 3 hipóteses ordenadas por probabilidade antes de tentar consertar.

---

## Project Overview

**VYD Engage** — CRM SaaS multi-tenant com auth, pagamentos e gerenciamento de leads. Parte do ecossistema VYD (Value Your Day).

| Camada | Stack |
|--------|-------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui + Radix UI |
| Backend | Node.js + Express + TypeScript + Prisma ORM |
| Database | PostgreSQL 16+ |
| Real-time | Socket.IO |
| Auth | JWT + Refresh Tokens + 2FA (TOTP) |
| Payments | Mercado Pago |
| Email | Resend + Nodemailer |
| Jobs | BullMQ + Redis |
| Testing | Vitest (frontend e backend) |

---

## Commands

### Backend (`cd server`)

```bash
npm run dev              # Dev server (port 3001, tsx watch)
npm run build            # Compile TypeScript → dist/
npm start                # Run dist/index.js (production)
npm test                 # Run Vitest (single run)
npm run test:watch       # Vitest watch mode
npm run test:ui          # Vitest UI dashboard
npm run test:coverage    # Coverage report
npm run lint             # ESLint
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier format
npm run format:check     # Prettier check
npm run prisma:generate  # Regenerate Prisma client
npm run prisma:migrate   # Create/apply migration (dev)
npm run prisma:studio    # Visual DB browser
npm run prisma:seed      # Seed initial data
```

### Frontend (root)

```bash
npm run dev              # Dev server (port 5173)
npm run build            # Production build → build/
npm test                 # Run Vitest (single run)
npm run test:watch       # Vitest watch mode
npm run test:ui          # Vitest UI dashboard
npm run lint             # ESLint
npm run lint:fix         # ESLint auto-fix
npm run format           # Prettier format
npm run format:check     # Prettier check
```

### Pre-commit Verification

```bash
cd server && npm test && npm run build   # Backend tests + typecheck
cd .. && npm run build                    # Frontend build check
```

---

## Architecture

### Directory Structure

```
server/                        # Backend API
  src/
    config/                    # DB & app config
    middleware/                 # auth, tenant, rateLimit, errorHandler, planLimits, csrf
    routes/                    # 23 route modules (auth, leads, deals, tasks, etc.)
    services/                  # Business logic (authService, automationService, etc.)
    jobs/                      # BullMQ background jobs (billing, automation)
    utils/                     # logger, sentry, validators
    __tests__/                 # Vitest tests
  prisma/
    schema.prisma              # All model definitions
    migrations/                # DB migrations
    seed.ts                    # Seed script

src/                           # Frontend (React)
  components/
    ui/                        # shadcn/ui + Radix primitives
    email/, payment/, register/, whatsapp/
  pages/                       # Page components (lazy-loaded)
  contexts/                    # AuthContext, PlanContext, PaymentContext
  hooks/                       # Custom React hooks
  services/api/                # API client utilities
  utils/                       # Shared utilities (email, validation, whatsapp)
  types/                       # TypeScript type definitions
```

### Multi-Tenancy (Foundational Pattern)

Todo request passa por `tenantMiddleware` que seta `req.tenantId`. **Todas as queries Prisma devem filtrar por `tenantId`:**

```typescript
const leads = await prisma.lead.findMany({ where: { tenantId } });
```

### Authentication Flow

1. Login → JWT + Refresh Token emitidos
2. JWT no Authorization header de cada request
3. Refresh tokens no DB com expiração
4. Password reset via tokens temporários por email
5. 2FA opcional (TOTP)

Key files: `server/src/services/authService.ts`, `server/src/routes/auth.ts`, `server/src/middleware/auth.ts`

### Rate Limiting

Três limiters separados em `server/src/middleware/rateLimit.ts`:
- `apiLimiter` — API geral
- `authLimiter` — login/register
- `passwordResetLimiter` — reset de senha

### Frontend Routing

Routes definidas em `src/utils/routes.tsx` com React Router v6 + lazy loading:
- **Públicas:** `/login`, `/register`, `/forgot-password`, `/reset-password`, `/onboarding`, `/capture/:formId`
- **Protegidas** (`/app/*`): dashboard, leads, deals, pipeline, tasks, automations, settings, billing, reports, inbox, whatsapp, email campaigns

Lazy loading via `lazyNamed()` wrapper + Suspense. Protected routes via `RequireAuth` component.

### Frontend Code Splitting

Configurado em `vite.config.ts` com manual chunks:
- `vendor-react` — React, React Router
- `vendor-radix` — Radix UI components
- `vendor-recharts` — Charts
- `vendor-exceljs` — Excel exports

Path alias: `@` → `./src`

### Backend Entry Point

`server/src/index.ts` configura: Express + Socket.IO + CORS + Helmet + Compression + Morgan + Rate Limiting + CSRF + Sentry (opcional) + BullMQ jobs (opcional).

### Middleware Stack (route pattern)

```typescript
router.get('/:id', authMiddleware, tenantMiddleware, apiLimiter, async (req, res, next) => {
  try { /* ... */ } catch (error) { next(error); }
});
```

### Database Models (Prisma)

| Grupo | Models |
|-------|--------|
| Auth | User, RefreshToken, Invitation |
| Tenant | Tenant |
| Billing | Plan, Subscription, Payment |
| CRM Core | Lead, Deal, Task, LeadTag, Tag, CustomField, Interaction |
| Sales | Funnel, FunnelColumn, ScoreRule |
| Integrations | WhatsAppConnection, EmailConfig, Automation, AutomationLog |
| Developer | ApiKey, Webhook, WebhookLog |
| Notifications | Notification |
| Reports | Report |

### API Response Format

```typescript
// Success
{ status: 200, data: { ... } }
// Error
{ status: 400, error: "Description", details?: { fieldName: "message" } }
```

### Validation

Zod para runtime validation em requests:
```typescript
const schema = z.object({ name: z.string().min(1), email: z.string().email() });
```

---

## Naming Conventions

| Contexto | Convenção | Exemplo |
|----------|-----------|---------|
| Routes | kebab-case | `/api/custom-fields` |
| Services | PascalCase + Service | `AuthService` |
| Utilities | camelCase | `validateEmail` |
| Components | PascalCase | `LeadCard` |
| DB columns | snake_case | Prisma models |
| Enums | UPPER_SNAKE_CASE | `UserRole.ADMIN` |

---

## Environment Variables

**Backend** (`server/.env`): DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, REDIS_URL, MERCADO_PAGO_ACCESS_TOKEN, RESEND_API_KEY, SMTP_*, PORT, NODE_ENV, SENTRY_DSN, ENABLE_BILLING_JOBS

**Frontend** (`.env` na raiz): VITE_API_URL=http://localhost:3001

---

## Synkra AIOX Integration

Sistema de agentes para orquestração de desenvolvimento. Detalhes completos em `.claude/rules/`.

### Agent Activation

`@agent-name` ou `/AIOX:agents:agent-name`. Comandos com prefixo `*`: `*help`, `*create-story`, `*task`, `*exit`.

| Agente | Persona | Escopo |
|--------|---------|--------|
| @dev (Dex) | Implementação | git add/commit/branch (NÃO push) |
| @qa (Quinn) | Testes e qualidade | QA gate, qa-loop |
| @architect (Aria) | Arquitetura | Decisões técnicas |
| @pm (Morgan) | Product Management | Epics, specs |
| @po (Pax) | Product Owner | Validação de stories |
| @sm (River) | Scrum Master | Criação de stories |
| @analyst (Alex) | Pesquisa | Análise e research |
| @data-engineer (Dara) | Database | Schema, migrations, RLS |
| @ux-design-expert (Uma) | UX/UI | Design |
| @devops (Gage) | CI/CD | **EXCLUSIVO:** git push, gh pr, MCP management |

### Story Flow

```
@sm *draft → @po *validate → @dev *develop → @qa *qa-gate → @devops *push
```

### Rules (auto-loaded from `.claude/rules/`)

- `agent-authority.md` — Delegation matrix, exclusive operations
- `agent-handoff.md` — Context compaction on agent switch
- `story-lifecycle.md` — Story status transitions, QA gates
- `workflow-execution.md` — SDC, QA Loop, Spec Pipeline, Brownfield
- `ids-principles.md` — Incremental Development System
- `mcp-usage.md` — MCP tool selection priority
- `coderabbit-integration.md` — Automated code review

---

## Git Conventions

- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
- Reference story ID: `feat: implement lead search [Story 3.2]`
- Atomic, focused commits
- **@dev** pode: `git add`, `commit`, `branch`, `checkout`, `merge` (local), `stash`, `diff`, `log`
- **@dev** NÃO pode: `git push`, `gh pr create/merge` → delegar para **@devops**
