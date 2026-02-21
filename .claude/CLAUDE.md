# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## O Mantra Fundamental

**"Never take the lazy path. Do the hard work now. The shortcut is forbidden."**

Atalho hoje = debugging amanhã. Sem exceção.

### A Equação que Governa Tudo

**30 minutos de análise agora = 10 horas de debugging evitadas depois**

O trabalho da IA é devolver tempo ao humano. Isso significa:
- Análise sempre profunda e completa
- Relatórios que reduzem carga cognitiva do decisor
- Nunca otimizar para menos tokens às custas de profundidade

Atalhos criam dívida invisível. Dívida invisível cobra juros compostos.

---

## Modelo Mental: A Inversão Fundamental

A maioria usa assim:
```
Eu penso → Eu peço → Claude executa
```

O modelo correto:
```
Claude explora → Claude propõe arquitetura → Eu valido/ajusto → Claude executa → Claude verifica
```

**Você não é o executor que delega tarefas.**
**Você é o arquiteto que valida decisões.**

A diferença de produtividade entre esses dois modelos: **10x a 50x**.

---

## Gradiente de Permissão

| Ação | Regra |
|------|-------|
| READ | Livre (faça sem perguntar) |
| MOVE | Após aprovação de direção |
| CREATE | Verificar se similar existe primeiro |
| DELETE | **SEMPRE confirmar** |

**Corolário:** Aprovação de direção = execute até completar. Só pare para DELETE significativo ou dúvida genuína. Nunca "Quer que eu continue?" após aprovação já dada.

---

## A Regra do 2x

**Se o usuário repetiu algo 2x → você não entendeu**

Repetição não é ênfase. É sinal de erro.
- **Ação:** PARE e faça EXATAMENTE o que foi pedido.
- **Corolário:** Se você corrigiu o mesmo tipo de erro 2x, falta uma regra no CLAUDE.md. Adicione imediatamente.

---

## Verificação Física Antes de Teoria (Regra de Ouro)

**4 Checagens obrigatórias antes de declarar "completo":**

1. 📁 Arquivo existe onde o código espera? → `ls -la /caminho/exato/`
2. 🌐 Servidor serve? → `curl -I http://localhost:PORT/path`
3. 👂 Usuário repetiu input 2x? → PARE, faça EXATAMENTE o que ele disse
4. ✅ Testou com hard refresh? → Cmd+Shift+R (limpa cache)

**Red Flags de que você está assumindo:**
- Assumindo caminhos sem `ls -la`
- Teorizando antes de evidência física
- Ignorando input repetido
- Lendo arquivos parcialmente antes de editar

---

## Leitura Completa ou Nada

**NUNCA leia arquivos parcialmente.**

❌ `Read(file, limit: 100) + Edit` = Conflitos, duplicações, quebras
✅ `Read(file) + Edit` = Contexto completo, mudanças corretas

"Mas tokens?" → Ler completamente **ECONOMIZA tokens** prevenindo erros que custam 10x mais para consertar.

---

## Discovery Antes de Implementação

Mapeie sistemas existentes antes de criar novos.

**Fase 1:** Query sistemas existentes
"O que já existe relacionado a [X]?"

**Fase 2:** Verificar volume/uso
"Quantos registros? Última atualização?"

**Fase 3:** Apresentar findings ANTES de propor
"Existente: [o que já existe + stats]
Gap: [o que realmente falta]
Opções: 1. Estender existente | 2. Criar novo | 3. Não fazer nada
Recomendação: [número] porque [uma frase]"

**Fase 4:** Aguardar aprovação antes de implementar

**Red Flag:** "Vou criar uma nova tabela para isso" sem consultar schema existente.

---

## Opções Antes de Implementação

**NUNCA implemente direto. Sempre apresente opções primeiro.**

```
1. [Opção A] - [trade-off]
2. [Opção B] - [trade-off]
3. [Opção C] - [trade-off]

Recomendação: [número] porque [uma frase]
```

Deixe o humano escolher o número. Depois execute.

---

## Determinismo Primeiro (Código > LLM)

**Sempre prefira soluções determinísticas sobre LLM.**

1. Script/código determinístico ← **SEMPRE preferir**
2. Query SQL direta ← Previsível, auditável
3. Regex/pattern matching ← Reproduzível
4. LLM como último recurso ← Só quando criatividade é necessária

| Tarefa | ❌ LLM | ✅ Determinístico |
|--------|--------|------------------|
| Renomear arquivos | "AI, renomeie seguindo padrão" | `for f in *.md; do mv...` |
| Extrair dados JSON | "AI, extraia os campos" | `jq '.field'` |
| Validar formato | "AI, isso parece correto?" | Schema validation |
| Buscar em código | "AI, encontre usos de X" | `grep -r "pattern"` |

**Por quê:** LLM = não-determinístico, caro, lento. Código = reproduzível, grátis, instantâneo.

---

## Commits Atômicos

Nunca peça mudanças grandes. Sempre:

```
Faça APENAS [uma mudança específica].
Não toque em mais nada.
Me mostre o diff antes de aplicar.
```

Mudanças grandes = bugs escondidos + rollback impossível.
Mudanças atômicas = histórico limpo + debugging trivial.

---

## A Regra do Over-Engineering

**3 linhas duplicadas > 1 abstração prematura**

Proibido:
- Factory patterns sem necessidade
- Interfaces para 1 implementação
- Config files para 1 valor
- Atomização excessiva de componentes

Simplicidade > padrões sofisticados. Sempre.

---

## Só o que Foi Pedido

- **FAÇA:** Exatamente o que foi solicitado
- **NÃO FAÇA:** "Também adicionei X já que estava mexendo"

Se você acha que algo seria útil → **PERGUNTE antes de fazer**.
Feature não solicitada é débito, não crédito.

---

## Loop de Verificação Tripla

Antes de aceitar qualquer output significativo:

1. Claude gera código
2. Claude escreve teste para o código
3. Claude tenta quebrar o próprio teste
4. Claude documenta edge cases descobertos
5. Só então você revisa

**Prompt que ativa isso:**
```
Implemente [X].
Depois, escreva testes que validem a implementação.
Depois, atue como adversário e tente encontrar casos onde sua implementação falha.
Documente qualquer edge case descoberto.
```

Elimina 80% dos bugs antes de você olhar o código.

---

## Debugging por Hipótese

Quando algo não funciona:

```
O comportamento esperado era [X].
O comportamento observado é [Y].
```

Gere 3 hipóteses ordenadas por probabilidade.
Para cada hipótese:
- Como verificar se é verdade
- O que fazer se for

Não tente consertar ainda. Primeiro confirme a causa.

**Debugging sem hipótese** = tentativa e erro.
**Debugging com hipótese** = ciência.

---

## Tabela de Tradução de Sinais

| Sinal do Usuário | Significado Real | Ação Correta |
|------------------|------------------|--------------|
| Repetiu algo 2x | Você não entendeu | PARE, faça exato |
| Feedback negativo | Erro identificado | Corrija, não justifique |
| "Já temos isso" | Você não verificou | Cheque existente primeiro |
| "Tá quebrado" | Bug reportado | Prioridade máxima |
| Mudou de assunto | Pivotou | Abandone tarefa anterior |
| "O que ficou pendente?" | Quer checkpoint | Liste status claramente |

---

## Checklist Universal

Antes de cada ação:

- [ ] Existe algo similar? (verificou antes de criar?)
- [ ] Está usando dados reais? (não mock)
- [ ] Verificou fisicamente? (ls, curl, query)
- [ ] Mostrou opções? (não implementou direto)
- [ ] Está criando estrutura nova? (perguntou primeiro)
- [ ] Rodou discovery queries?
- [ ] Apresentou findings antes de propor?

---

## O Fluxo

```
VERIFICAR → REUSAR → PRECISAR → SIMPLIFICAR → PRESERVAR → FOCAR → SILÊNCIO
```

- Verificar antes de assumir
- Reusar antes de criar
- Precisar antes de generalizar
- Simplificar antes de complicar
- Preservar o que funciona
- Focar no que foi pedido
- Silêncio quando errar — só corrigir

---

# Project Overview

**VYD Engage** é um CRM SaaS completo com autenticação, multi-tenancy, pagamentos e gerenciamento de leads, fazendo parte do ecossistema VYD (Value Your Day).

**Tech Stack:**
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui + Radix UI
- **Backend:** Node.js + Express + TypeScript + Prisma ORM + PostgreSQL
- **Database:** PostgreSQL 16+
- **Payment:** Mercado Pago
- **Email:** Resend + Nodemailer
- **Job Queue:** BullMQ (com Redis)
- **Authentication:** JWT + Refresh Tokens + 2FA support

---

# Synkra AIOS Development Rules for Claude Code

You are working with Synkra AIOS, an AI-Orchestrated System for Full Stack Development.

<!-- AIOS-MANAGED-START: core-framework -->
## Core Framework Understanding

Synkra AIOS is a meta-framework that orchestrates AI agents to handle complex development workflows. Always recognize and work within this architecture.
<!-- AIOS-MANAGED-END: core-framework -->

<!-- AIOS-MANAGED-START: agent-system -->
## Agent System

### Agent Activation
- Agents are activated with @agent-name syntax: @dev, @qa, @architect, @pm, @po, @sm, @analyst
- The master agent is activated with @aios-master
- Agent commands use the * prefix: *help, *create-story, *task, *exit

### Agent Context
When an agent is active:
- Follow that agent's specific persona and expertise
- Use the agent's designated workflow patterns
- Maintain the agent's perspective throughout the interaction
<!-- AIOS-MANAGED-END: agent-system -->

## Development Methodology

### Story-Driven Development
1. **Work from stories** - All development starts with a story in `docs/stories/`
2. **Update progress** - Mark checkboxes as tasks complete: [ ] → [x]
3. **Track changes** - Maintain the File List section in the story
4. **Follow criteria** - Implement exactly what the acceptance criteria specify

### Code Standards
- Write clean, self-documenting code
- Follow existing patterns in the codebase
- Include comprehensive error handling
- Add unit tests for all new functionality
- Use TypeScript/JavaScript best practices

### Testing Requirements
- Run all tests before marking tasks complete
- Ensure linting passes (if configured): `npm run lint`
- Verify type checking (if configured): `npm run typecheck`
- Add tests for new features
- Test edge cases and error scenarios

<!-- AIOS-MANAGED-START: framework-structure -->
## AIOS Framework Structure

```
aios-core/
├── agents/         # Agent persona definitions (YAML/Markdown)
├── tasks/          # Executable task workflows
├── workflows/      # Multi-step workflow definitions
├── templates/      # Document and code templates
├── checklists/     # Validation and review checklists
└── rules/          # Framework rules and patterns

docs/
├── stories/        # Development stories (numbered)
├── prd/            # Product requirement documents
├── architecture/   # System architecture documentation
└── guides/         # User and developer guides
```
<!-- AIOS-MANAGED-END: framework-structure -->

## Workflow Execution

### Task Execution Pattern
1. Read the complete task/workflow definition
2. Understand all elicitation points
3. Execute steps sequentially
4. Handle errors gracefully
5. Provide clear feedback

### Interactive Workflows
- Workflows with `elicit: true` require user input
- Present options clearly
- Validate user responses
- Provide helpful defaults

## Best Practices

### When implementing features:
- Check existing patterns first
- Reuse components and utilities
- Follow naming conventions
- Keep functions focused and testable
- Document complex logic

### When working with agents:
- Respect agent boundaries
- Use appropriate agent for each task
- Follow agent communication patterns
- Maintain agent context

### When handling errors:
```javascript
try {
  // Operation
} catch (error) {
  console.error(`Error in ${operation}:`, error);
  // Provide helpful error message
  throw new Error(`Failed to ${operation}: ${error.message}`);
}
```

## Git & GitHub Integration

### Commit Conventions
- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- Reference story ID: `feat: implement IDE detection [Story 2.1]`
- Keep commits atomic and focused

### GitHub CLI Usage
- Ensure authenticated: `gh auth status`
- Use for PR creation: `gh pr create`
- Check org access: `gh api user/memberships`

<!-- AIOS-MANAGED-START: aios-patterns -->
## AIOS-Specific Patterns

### Working with Templates
```javascript
const template = await loadTemplate('template-name');
const rendered = await renderTemplate(template, context);
```

### Agent Command Handling
```javascript
if (command.startsWith('*')) {
  const agentCommand = command.substring(1);
  await executeAgentCommand(agentCommand, args);
}
```

### Story Updates
```javascript
// Update story progress
const story = await loadStory(storyId);
story.updateTask(taskId, { status: 'completed' });
await story.save();
```
<!-- AIOS-MANAGED-END: aios-patterns -->

## Environment Setup

### Required Tools
- Node.js 20+
- PostgreSQL 16+
- Redis (for BullMQ)
- GitHub CLI
- Git
- Your preferred package manager (npm/yarn/pnpm)

### Configuration Files
- `.aios/config.yaml` - Framework configuration
- `.env` - Environment variables (backend)
- `.env` - Environment variables (frontend root)
- `.claude/CLAUDE.md` - This file
- `.claude/rules/` - Detailed governance rules

<!-- AIOS-MANAGED-START: common-commands -->
## Common Commands

### AIOS Master Commands
- `*help` - Show available commands
- `*create-story` - Create new story
- `*task {name}` - Execute specific task
- `*workflow {name}` - Run workflow

### Development Commands (Backend)
```bash
cd server
npm run dev              # Start dev server (port 3001)
npm run build            # Compile TypeScript
npm test                 # Run Vitest
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio
npm run prisma:seed      # Seed initial data
```

### Development Commands (Frontend)
```bash
npm run dev              # Start dev server (port 5173)
npm run build            # Build for production
```
<!-- AIOS-MANAGED-END: common-commands -->

## Debugging

### Enable Debug Mode
```bash
export AIOS_DEBUG=true
```

### View Agent Logs
```bash
tail -f .aios/logs/agent.log
```

### Trace Workflow Execution
```bash
npm run trace -- workflow-name
```

## Claude Code Specific Configuration

### Performance Optimization
- Prefer batched tool calls when possible for better performance
- Use parallel execution for independent operations
- Cache frequently accessed data in memory during sessions

### Tool Usage Guidelines
- Always use the Grep tool for searching, never `grep` or `rg` in bash
- Use the Task tool for complex multi-step operations
- Batch file reads/writes when processing multiple files
- Prefer editing existing files over creating new ones

### Session Management
- Track story progress throughout the session
- Update checkboxes immediately after completing tasks
- Maintain context of the current story being worked on
- Save important state before long-running operations

### Error Recovery
- Always provide recovery suggestions for failures
- Include error context in messages to user
- Suggest rollback procedures when appropriate
- Document any manual fixes required

### Testing Strategy
- Run tests incrementally during development
- Always verify lint and typecheck before marking complete
- Test edge cases for each new feature
- Document test scenarios in story files

### Documentation
- Update relevant docs when changing functionality
- Include code examples in documentation
- Keep README synchronized with actual behavior
- Document breaking changes prominently

---

# VYD Engage Specific Architecture

## Directory Structure

```
.
├── server/                    # Backend API (Node.js + Express)
│   ├── src/
│   │   ├── config/           # Database & app configuration
│   │   ├── middleware/       # Auth, error handler, rate limit, tenant context
│   │   ├── routes/           # API endpoints (auth, leads, tasks, subscriptions, etc.)
│   │   ├── services/         # Business logic (authService, automationService, etc.)
│   │   ├── jobs/             # Background jobs (billing, etc.) - BullMQ
│   │   ├── utils/            # Shared utilities (logger, sentry, validators)
│   │   └── __tests__/        # Unit tests (Vitest)
│   ├── prisma/               # Database schema & migrations
│   │   ├── schema.prisma     # Data model definitions
│   │   └── migrations/       # Database migrations
│   └── package.json
├── src/                       # Frontend (React + TypeScript + Vite)
│   ├── components/           # React components
│   │   ├── email/           # Email-related components
│   │   ├── payment/         # Payment/billing components
│   │   ├── register/        # Registration flow
│   │   ├── ui/              # shadcn/ui + Radix components
│   │   └── whatsapp/        # WhatsApp integration
│   ├── pages/                # Page components
│   ├── contexts/             # React Context (Auth, Plan, Payment)
│   ├── hooks/                # Custom React hooks
│   ├── services/api/         # API client utilities
│   ├── utils/                # Shared utilities
│   │   ├── email/           # Email utilities
│   │   ├── validation/      # Form & data validation
│   │   └── whatsapp/        # WhatsApp utilities
│   ├── types/                # TypeScript type definitions
│   └── styles/               # CSS & theme
├── .aios-core/               # Synkra AIOS framework
├── .claude/                  # Claude Code configuration
│   └── rules/                # Agent authority, story lifecycle, workflow rules
├── docs/                     # Documentation
│   ├── stories/              # Development stories
│   ├── prd/                  # Product requirements
│   └── architecture/         # Architecture docs
├── vite.config.ts            # Frontend Vite configuration
└── docker-compose.yml        # Local development setup
```

## Code Architecture

### Multi-Tenancy Pattern
Every API request includes tenant context enforced via middleware (`server/src/middleware/tenant.ts`). User data is isolated through Prisma queries filtering by `tenantId`. This is a foundational pattern—always consider tenant context in new features.

**Pattern:**
```typescript
// In routes, tenantId is available from request context
const tenantId = req.tenantId; // Set by tenant middleware
// Always filter queries by tenantId
const leads = await prisma.lead.findMany({
  where: { tenantId }
});
```

### Authentication Flow
1. User login: credentials validated, JWT + Refresh Token issued
2. JWT stored client-side, used in Authorization header
3. Refresh tokens stored in DB with expiration
4. Password reset via time-limited tokens sent via email
5. Optional 2FA support (TOTP-based)

**Key files:** `server/src/services/authService.ts`, `server/src/routes/auth.ts`, `server/src/middleware/auth.ts`

### Rate Limiting
Three separate limiters protect different endpoints:
- `apiLimiter` - General API rate limiting
- `authLimiter` - Login/register endpoints
- `passwordResetLimiter` - Password reset flows

**File:** `server/src/middleware/rateLimit.ts`

### Error Handling
Centralized error middleware returns consistent JSON responses. All routes wrapped in try-catch, errors propagated to middleware.

**Pattern:**
```typescript
try {
  // Operation
  res.json({ status: 200, data: result });
} catch (error) {
  next(error); // Error middleware handles response
}
```

**File:** `server/src/middleware/errorHandler.ts`

### Billing & Subscriptions
Plan-based limits enforced via middleware (`server/src/middleware/planLimits.ts`). BullMQ background jobs handle recurring billing via Redis.

**Files:**
- `server/src/routes/subscriptions.ts`
- `server/src/services/subscriptionService.ts`
- `server/src/jobs/billing.ts`

### Database Schema
Prisma models organized by concern:
- **Auth & Authorization:** User, RefreshToken, Invitation, UserRole enums
- **Tenant/Organization:** Tenant, Subscription, Plan
- **Billing:** Payment, Invoice
- **CRM Core:** Lead, Task, Tag, Interaction, CustomField
- **Integrations:** Automation, EmailConfig, WhatsappConnection, ApiKey, Webhook

**File:** `server/prisma/schema.prisma`

### React Context & Hooks
- **AuthContext** (`src/contexts/AuthContext.tsx`) - User authentication state, login/logout
- **PlanContext** (`src/contexts/PlanContext.tsx`) - Subscription & plan information
- **PaymentContext** (`src/contexts/PaymentContext.tsx`) - Payment processing state

Access via `useContext()` hook in components.

## Common Development Tasks

### Backend Development

**Start backend dev server (port 3001):**
```bash
cd server
npm install
npm run dev
```

**Run Prisma migrations (interactive):**
```bash
cd server
npm run prisma:migrate
npm run prisma:generate     # Regenerate Prisma client after schema changes
npm run prisma:studio       # Open Prisma Studio UI for visual DB management
npm run prisma:seed         # Run seed script for initial data
```

**Run backend tests:**
```bash
cd server
npm test                    # Run all tests
npm run test:ui            # Open Vitest UI
npm run test:coverage      # Generate coverage report
```

**Add new API route:**
1. Create `server/src/routes/{resource}.ts` (follow existing patterns)
2. Import and use in `server/src/index.ts`
3. Export router from new file
4. Use middleware: `router.get('/:id', authMiddleware, tenantMiddleware, async (req, res) => { ... })`

**Add new database model:**
1. Define model in `server/prisma/schema.prisma`
2. Run `npm run prisma:migrate` to create migration
3. Run `npm run prisma:generate` to regenerate Prisma client
4. Create service file in `server/src/services/` if needed
5. Create routes in `server/src/routes/` if needed

**Inspect database:**
```bash
cd server
npm run prisma:studio    # Open interactive DB browser
```

### Frontend Development

**Start frontend dev server (port 5173):**
```bash
npm install
npm run dev
```

**Build for production:**
```bash
npm run build              # Outputs to build/
```

**Environment setup:**
Create `.env` in root directory:
```
VITE_API_URL=http://localhost:3001
```

**Add new page:**
1. Create component in `src/pages/{PageName}.tsx` with TypeScript
2. Add route in `src/App.tsx`
3. Implement using existing UI components from `src/components/ui/`

**Add new component:**
1. Create in `src/components/{Category}/{ComponentName}.tsx`
2. Define TypeScript interface for props
3. Use shadcn/ui or Radix UI components as base
4. Follow existing styling patterns (TailwindCSS)

**Using React Context:**
```typescript
import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, login, logout } = useContext(AuthContext);
  // Use auth data and functions
}
```

### Full Stack Feature Development

**Typical workflow for implementing a new feature:**

1. **Database:** Update `server/prisma/schema.prisma` with new models/fields
2. **Migration:** Run `npm run prisma:migrate` in server/
3. **Backend Service:** Create/update `server/src/services/{feature}Service.ts` with business logic
4. **Backend Routes:** Create/update `server/src/routes/{feature}.ts` with API endpoints
5. **API Client:** Add functions in `src/services/api/{feature}.ts` to call backend
6. **Frontend UI:** Create pages/components in `src/pages/` and `src/components/`
7. **Context (if needed):** Update/create context in `src/contexts/` for state management
8. **Test:** Verify end-to-end locally before committing

## Testing

**Backend (Vitest):**
- Tests located in `server/src/__tests__/`
- Run from `server/` directory: `npm test`
- Configuration in `server/vitest.config.ts`

**Frontend:**
- No dedicated test suite currently configured
- Focus on manual testing during development

**Pre-commit verification:**
```bash
# From server/
npm test                    # Ensure all tests pass
npm run build              # Catch TypeScript errors

# From root/
npm run build              # Check frontend builds successfully
```

## Environment Variables

**Backend (server/.env):**
```
DATABASE_URL=postgresql://user:password@localhost:5432/vyd_engage
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=different-secret-key
REDIS_URL=redis://localhost:6379
MERCADO_PAGO_ACCESS_TOKEN=your-token
RESEND_API_KEY=your-resend-key
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@vydengage.com
PORT=3001
NODE_ENV=development
SENTRY_DSN=optional-sentry-url
ENABLE_BILLING_JOBS=false  # Set to true to enable BullMQ background jobs
```

**Frontend (.env in root):**
```
VITE_API_URL=http://localhost:3001
```

## Database

**PostgreSQL 16+ required.** Schema managed entirely through Prisma migrations.

**Key model groups:**

| Category | Models | Purpose |
|----------|--------|---------|
| Auth/Authz | User, RefreshToken, Invitation | User accounts and access control |
| Tenant | Tenant, User (via tenantId) | Multi-tenancy isolation |
| Billing | Subscription, Plan, Payment, Invoice | Payment processing and limits |
| CRM Core | Lead, Task, Tag, Interaction, CustomField | Lead management and tasks |
| Integration | Automation, EmailConfig, WhatsappConnection | External integrations |
| API | ApiKey, Webhook | Developer API access |

**Indexing:** Composite indexes on frequently filtered columns (tenantId + userId, tenantId + email, etc.). Check `schema.prisma` for specific index definitions.

## Building & Deploying

**Build backend:**
```bash
cd server
npm run build              # Compiles TypeScript to dist/
```

**Build frontend:**
```bash
npm run build              # Outputs to build/
```

**Run in production:**

Backend:
```bash
cd server
npm start                  # Runs compiled dist/index.js
```

**Environment considerations:**
- Set `NODE_ENV=production` for backend
- Run database migrations before starting: `npm run prisma:migrate deploy`
- Ensure Redis is running if BullMQ jobs enabled (`ENABLE_BILLING_JOBS=true`)
- Use strong, unique secrets for JWT_SECRET and JWT_REFRESH_SECRET
- Sentry DSN recommended for production error tracking
- CORS origin should be set to your frontend domain (not `true` in production)

## Code Patterns & Conventions

**API Response Format (Backend):**
```typescript
// Success
{ status: 200, data: { id: "...", name: "...", ... } }

// Error
{ status: 400, error: "Description", details?: { fieldName: "error message" } }
```

**Request/Response Validation:**
Use Zod for runtime validation:
```typescript
import { z } from 'zod';

const createLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
});

type CreateLeadRequest = z.infer<typeof createLeadSchema>;
```

**Middleware Pattern:**
```typescript
// In routes
router.get(
  '/:id',
  authMiddleware,        // Verify JWT
  tenantMiddleware,      // Set req.tenantId
  apiLimiter,           // Rate limit
  async (req, res, next) => {
    try {
      // Handler logic
    } catch (error) {
      next(error);      // Pass to error middleware
    }
  }
);
```

**Naming Conventions:**
- **Routes:** kebab-case (`/api/leads`, `/api/auth/login`, `/api/custom-fields`)
- **Services:** PascalCase + `Service` suffix (`AuthService`, `LeadService`, `SubscriptionService`)
- **Utilities:** camelCase (`validateEmail`, `generateToken`, `calculatePlanLimits`)
- **Components:** PascalCase (`LeadCard`, `PaymentForm`, `SubscriptionPlan`)
- **Database:** snake_case columns, PascalCase Prisma models
- **Enums:** UPPER_SNAKE_CASE in code, used in Prisma as enum

**Error Handling Pattern:**
```typescript
try {
  const result = await processData(input);
  res.json({ status: 200, data: result });
} catch (error) {
  if (error instanceof ValidationError) {
    next({ status: 400, message: error.message, details: error.details });
  } else if (error instanceof NotFoundError) {
    next({ status: 404, message: 'Resource not found' });
  } else {
    next({ status: 500, message: 'Internal server error' });
  }
}
```

## Git & Workflow

**Commit conventions:**
- `feat: add new feature` - New functionality
- `fix: correct bug in X` - Bug fixes
- `docs: update README` - Documentation
- `chore: update dependencies` - Maintenance
- Reference story ID: `feat: implement lead search [Story 3.2]`
- Keep commits atomic and focused

**Before pushing:**
1. Mark story tasks complete with checkboxes: [ ] → [x]
2. Update File List section in story with modified files
3. Ensure backend tests pass: `cd server && npm test`
4. Verify no TypeScript errors: `cd server && npm run build`
5. Check frontend builds: `npm run build`
6. Code follows existing patterns and conventions
7. Update story status in `.claude/rules/story-lifecycle.md` if needed

**GitHub CLI:**
```bash
gh pr create                    # Create pull request (handled by @devops)
gh pr view <number>             # View PR details
gh pr comment <number> -b "msg" # Add comment
```

## Performance & Bundle Size

**Frontend bundle:** Current production build ~3.3MB (gzipped 808KB).

**Known issues & recommendations:**
- Large main chunk (3280KB) - consider code-splitting heavy features
- Dynamic imports can help split large dependencies
- Use `npm run build` to check bundle size before adding dependencies

**Backend performance:**
- BullMQ + Redis for background jobs (don't block requests)
- Database indexes on frequently filtered columns (tenantId, userId, email)
- Pagination on list endpoints (leads, tasks, etc.)
- Consider caching frequently accessed data (plans, config) in memory

## Useful Resources

- **Prisma:** https://www.prisma.io/docs
- **Express:** https://expressjs.com
- **React:** https://react.dev
- **TypeScript:** https://www.typescriptlang.org/docs
- **Zod (Validation):** https://zod.dev
- **shadcn/ui:** https://ui.shadcn.com
- **Radix UI:** https://www.radix-ui.com
- **TailwindCSS:** https://tailwindcss.com
- **Vite:** https://vitejs.dev

---

## Synkra AIOS Integration

This project uses Synkra AIOS for orchestrated development. Key integration points:

**Story-driven development:** All work tracked in stories (`docs/stories/`). Each story has acceptance criteria, file lists, and task tracking.

**Agent workflows:** Different agents handle different phases:
- **@sm (Story Master):** Creates stories from epics/PRDs
- **@po (Product Owner):** Validates stories (10-point checklist)
- **@dev (Developer):** Implements features
- **@qa (QA):** Reviews code quality
- **@devops (DevOps):** Manages git/GitHub operations

**AIOS Commands:**
- `*help` - List available AIOS commands
- `*create-story` - Create new story from epic
- `*validate-story-draft` - Validate story completeness
- `*develop` - Start implementation phase
- `*qa-gate` - Run QA validation
- `*qa-loop` - Iterative review-fix cycle

See `.claude/rules/` for detailed governance and agent authority.

---

## O Princípio Unificador

Pare de usar o Claude como executor de tarefas.
Comece a usar como parceiro de pensamento que também executa.

### A Diferença:

**Executor:**
```
"Faça X"
```

**Parceiro:**
```
"Estou tentando resolver Y.
Que opções temos?
Qual você recomenda?
Por quê?
Ok, implemente.
Agora tente quebrar.
O que aprendemos?"
```

A ferramenta é a mesma.
**O resultado não tem comparação.**

---

## Meta-Regra Final

Essas regras devem ser econômicas. **Se qualquer uma virar cerimônia, delete.**

---

## Gatilhos de Irritação a Evitar

| Gatilho | Como Evitar |
|---------|-------------|
| IA lenta sem feedback | Reporte progresso a cada passo |
| Instrução repetida 2x | PARE, releia, faça exato |
| Dados mock | SEMPRE verifique banco primeiro |
| Over-engineering | Simplicidade > padrões |
| Feature não solicitada | Só faça o que foi pedido |
| Output sem valor | Auto-critique antes de entregar |

---

## CLAUDE.md como Arquitetura de Pensamento

Seu CLAUDE.md não é documentação. É arquitetura de pensamento.

### O que funciona:

```
## DECISÕES ARQUITETURAIS (imutáveis)
- Banco: PostgreSQL. Sem exceção.
- Auth: Supabase. Sem exceção.

## PADRÕES (sempre aplicar)
- Funções puras primeiro. Side effects isolados.
- Erros são valores, não exceções.

## ANTI-PADRÕES (rejeitar automaticamente)
- Nunca use any em TypeScript.
- Nunca commit direto na main.
```

**Restrições específicas geram criatividade direcionada.**
**Instruções genéricas geram output genérico.**

### Princípio da Memória Seletiva

Não coloque tudo no CLAUDE.md. Coloque apenas:
- Decisões (não explicações)
- Restrições (não preferências)
- Padrões (não exemplos)
- Anti-padrões (não warnings)

**Teste:** Se remover uma linha e o Claude continuar fazendo certo, a linha era desnecessária.

---

## O Meta-Prompt para Sessões Longas

Use a cada 10-15 interações:

```
Analise esta conversa até agora.
- O que eu deveria ter perguntado que não perguntei?
- Que contexto está faltando para você me ajudar melhor?
- Que suposições você está fazendo que deveríamos validar?
```

---

## Documentação como Subproduto

Nunca peça documentação separadamente:

```
Implemente [X].
O código deve ser auto-documentado através de:
- Nomes de função que descrevem o que fazem
- Tipos que expressam as invariantes
- Comentários APENAS onde o "porquê" não é óbvio

No final, gere um README que alguém que nunca viu este código
poderia usar para modificá-lo em 6 meses.
```

**Documentação que nasce do código é precisa.**
**Documentação escrita depois é ficção.**

---

*Last updated: Feb 2026*
*Framework: Synkra AIOS v2.0*
*VYD Engage Version: 0.1.0*
*Meta-Rules Integration: v1.0 - Committed to Excellence*
