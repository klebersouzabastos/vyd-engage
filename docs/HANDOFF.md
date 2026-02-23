# VYD Engage — Handoff de Projeto

**Data:** 23/02/2026
**Versao:** 1.0.0
**Repositorio:** https://github.com/klebersouzabastos/vyd-engage

---

## 1. URLs de Producao

| Servico | URL | Status |
|---------|-----|--------|
| **Frontend (Vercel)** | https://engage.vydhub.com | Deployed |
| **Backend (Railway)** | *Pendente deploy* | Ver secao 4 |
| **Repositorio** | https://github.com/klebersouzabastos/vyd-engage | Ativo |

---

## 2. Arquitetura do Sistema

```
┌─────────────────────────┐     ┌──────────────────────────────┐
│   Frontend (Vercel)     │     │   Backend (Railway)          │
│   React 18 + Vite       │────▶│   Express + Prisma           │
│   engage.vydhub.com     │     │   PostgreSQL + Redis         │
│                         │     │                              │
│   - SPA com lazy load   │     │   - REST API (port 3001)     │
│   - shadcn/ui + Tailwind│     │   - Socket.IO (real-time)    │
│   - AuthContext (JWT)    │     │   - BullMQ (background jobs) │
└─────────────────────────┘     │   - Prisma ORM               │
                                └──────────────────────────────┘
                                         │          │
                                    ┌────┘          └────┐
                               ┌────▼────┐         ┌────▼────┐
                               │PostgreSQL│         │  Redis   │
                               │  (DB)    │         │ (Cache + │
                               │          │         │  Jobs)   │
                               └──────────┘         └──────────┘

Integracoes externas:
  - Mercado Pago (pagamentos)
  - Resend (email transacional)
  - WhatsApp (via conexao propria)
  - Sentry (monitoramento)
```

---

## 3. Stack Tecnologica

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Frontend | React + TypeScript + Vite | 18.x |
| UI | TailwindCSS + shadcn/ui + Radix UI | 3.4.x |
| Backend | Node.js + Express + TypeScript | 20.x / 4.x |
| ORM | Prisma | 5.7.x |
| Database | PostgreSQL | 16+ |
| Cache/Queue | Redis + ioredis + BullMQ | — |
| Auth | JWT + Refresh Tokens + 2FA (TOTP) | — |
| Email | Resend SDK | 4.8.x |
| Pagamentos | Mercado Pago SDK | 2.1.x |
| Real-time | Socket.IO | 4.8.x |
| PDF | PDFKit | 0.17.x |
| Monitoramento | Sentry | 7.91.x |

---

## 4. Deploy do Backend no Railway (PENDENTE)

### Passo a passo:

#### 4.1. Criar projeto no Railway

1. Acesse https://railway.com/dashboard
2. Clique **"New Project"**
3. Selecione **"Deploy from GitHub Repo"**
4. Conecte o repositorio `klebersouzabastos/vyd-engage`
5. **IMPORTANTE:** Configure o Root Directory como `server`

#### 4.2. Adicionar PostgreSQL

1. No projeto, clique **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Copie a `DATABASE_URL` gerada (sera usada nas env vars)

#### 4.3. Adicionar Redis

1. Clique **"+ New"** → **"Database"** → **"Redis"**
2. Copie a `REDIS_URL` gerada

#### 4.4. Configurar Variaveis de Ambiente

No servico do backend (nao no banco), adicione estas variaveis:

```env
# Database (copiar do PostgreSQL provisionado)
DATABASE_URL=<URL do PostgreSQL Railway>

# Server
PORT=3001
NODE_ENV=production

# Auth
JWT_SECRET=f3a7d81b80927eacba83c9873e9fbc9a78c6f1be9afa1703c4afa04493aa576c2fbd4075ed15336b8e97ac352548e67245872bdd165ce87403bd23b5434a988d
JWT_REFRESH_SECRET=4058a55a582050f919fb0d09e00adc64e6178b5fbc16d2c6394b6b85314cef69fae81e43cf52ce20d6b82332299f67da054de2bc3813a2270c7adb026e276274
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend URL (Vercel)
FRONTEND_URL=https://engage.vydhub.com

# Redis (copiar do Redis provisionado)
REDIS_URL=<URL do Redis Railway>

# Email
RESEND_API_KEY=re_LWtUVNCy_6YJTWzvupfgBqJ2MzyG7FDYG
RESEND_FROM_EMAIL=VYD Engage <noreply@engage.vydhub.com>

# Billing (ativar quando necessario)
ENABLE_BILLING_JOBS=false
ENABLE_AUTOMATION_ENGINE=false
```

> **SEGURANCA:** Em producao, gere novos JWT_SECRET e JWT_REFRESH_SECRET com:
> `openssl rand -hex 64`

#### 4.5. Configurar Build

No Railway, nas settings do servico:
- **Build Command:** `npm ci && npx prisma generate && npm run build`
- **Start Command:** `npx prisma migrate deploy && node dist/index.js`
- **Health Check Path:** `/health`

Ou, se o Railway detectar o `railway.toml`, esses valores serao usados automaticamente.

#### 4.6. Deploy

1. O Railway fara o deploy automaticamente ao detectar o repo
2. Verifique os logs para confirmar que o servidor iniciou
3. Teste o health check: `curl https://<url-railway>/health`

#### 4.7. Atualizar Frontend

Apos obter a URL do backend no Railway, atualize a env var na Vercel:

```bash
npx vercel env add VITE_API_URL production
# Cole a URL: https://<seu-servico>.railway.app
```

Depois faca um redeploy:
```bash
npx vercel --prod
```

---

## 5. Funcionalidades Implementadas

### Epic 1: Foundation, Auth & Multi-Tenancy (100%)
- Registro com criacao de tenant
- Login/Logout com JWT + Refresh Token
- Reset de senha via email (Resend)
- Multi-tenancy com isolamento por tenant
- Convites por email com roles (ADMIN/USER/VIEWER)
- 2FA com TOTP (Google Authenticator)

### Epic 2: CRM Core & Pipeline Visual (100%)
- CRUD de leads com busca, filtros, paginacao
- Import/export CSV de leads
- Pipeline Kanban com drag-and-drop
- Multi-funil configuravel
- Tarefas (lista + calendario)
- Tags e campos customizados
- Lead scoring com 8 tipos de evento
- Formulario publico de captura com UTM

### Epic 3: Comunicacao Multicanal & Automacoes (90%)
- Conexao WhatsApp + envio de mensagens
- Configuracao de email + campanhas em massa
- Motor de automacoes (BullMQ) com logs
- Builder visual de automacoes (triggers, steps, condicoes)
- Inbox unificado
- Notificacoes real-time (WebSocket)
- Email tracking (open pixel + click wrapper)
- Webhooks de entrada (MercadoPago, WhatsApp, Email, Capture)
- Webhooks de saida (CRUD, teste HMAC, logs)

### Epic 4: Analytics, Relatorios & Billing (92%)
- Dashboard com metricas e seletor de data range
- Relatorios customizaveis (ReportBuilder)
- Planos e assinaturas
- Pagamentos via Mercado Pago
- Jobs de billing em background
- Geracao de PDF de invoices
- Gerenciamento de API Keys
- Redis caching para limites de plano

### Epic 5: Hardening & Quality (80%)
- Security hardening (CSRF, rate limiting, helmet, AES-256-GCM)
- Isolamento multi-tenant com indexes compostos
- Performance (lazy loading, code splitting, manual chunks)
- Paginas de auth (Register, ForgotPassword, ResetPassword)
- Monitoramento (Sentry, structured logging, /health)
- Onboarding wizard + guided tour
- Landing page
- Testes backend (auth, leads, tasks, funnels, automations)
- Testes frontend configurados (Vitest + RTL)

---

## 6. Estrutura do Projeto

```
VYD Engage/
├── src/                    # Frontend React
│   ├── components/         # Componentes (ui/, settings/, email/, etc.)
│   ├── pages/              # 26 paginas lazy-loaded
│   ├── contexts/           # AuthContext, PlanContext, PaymentContext
│   ├── hooks/              # useSocket, useDebounce, etc.
│   ├── services/api/       # API client centralizado
│   └── utils/              # Routes, validation, helpers
├── server/                 # Backend Express
│   ├── src/
│   │   ├── routes/         # 18 arquivos de rotas
│   │   ├── services/       # 20+ servicos de negocio
│   │   ├── middleware/      # Auth, tenant, CSRF, rate limit, etc.
│   │   ├── config/         # Database, Redis
│   │   ├── jobs/           # BullMQ (billing, automation)
│   │   └── utils/          # Logger, Sentry, healthcheck
│   └── prisma/             # Schema + migrations
├── docs/                   # PRD, stories, architecture
├── vercel.json             # Config Vercel
└── .npmrc                  # legacy-peer-deps
```

---

## 7. Comandos de Desenvolvimento

```bash
# Frontend
npm install
npm run dev              # http://localhost:5173
npm run build            # Build producao → build/
npm test                 # Vitest

# Backend
cd server
npm install
npm run dev              # http://localhost:3001
npm run build            # TypeScript → dist/
npm test                 # Vitest
npm run prisma:migrate   # Migrations
npm run prisma:studio    # UI visual do banco
npm run prisma:seed      # Dados iniciais
```

---

## 8. Variaveis de Ambiente

### Frontend (.env na raiz)
```
VITE_API_URL=http://localhost:3001    # Dev
VITE_API_URL=https://<backend>.railway.app  # Prod (Vercel env)
```

### Backend (server/.env)
```
DATABASE_URL=postgresql://...
PORT=3001
NODE_ENV=development|production
JWT_SECRET=<hex 64 chars>
JWT_REFRESH_SECRET=<hex 64 chars>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:5173|https://engage.vydhub.com
REDIS_URL=redis://localhost:6379
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=VYD Engage <noreply@engage.vydhub.com>
ENABLE_BILLING_JOBS=false
ENABLE_AUTOMATION_ENGINE=false
MERCADOPAGO_ACCESS_TOKEN=<token>
SENTRY_DSN=<dsn>
```

---

## 9. Banco de Dados

**16 modelos Prisma:**

| Grupo | Modelos |
|-------|---------|
| Auth | User, RefreshToken, Invitation |
| Tenant | Tenant, Plan, Subscription |
| Billing | Payment |
| CRM | Lead, Tag, LeadTag, CustomField, Task |
| Scoring | ScoreRule |
| Comunicacao | Interaction, WhatsAppConnection, EmailConfig, Automation, AutomationLog |
| API | ApiKey, Webhook, WebhookLog |
| Outros | Notification, Report, Funnel, FunnelColumn |

---

## 10. Seguranca

- JWT com refresh token rotation
- 2FA TOTP com backup codes
- CSRF protection em todas as rotas autenticadas
- Rate limiting (auth, API geral, password reset)
- Helmet headers
- AES-256-GCM para dados sensiveis (WhatsApp tokens)
- bcrypt para senhas e API keys
- HMAC-SHA256 para webhooks
- Multi-tenant isolation via middleware + composite indexes

---

## 11. Melhorias Futuras Sugeridas

1. **CI/CD Pipeline** — GitHub Actions para lint + test + deploy automatico
2. **Cobertura de testes > 80%** — Expandir testes unitarios e adicionar E2E
3. **Automacao avancada** — Delays entre steps, retry automatico, if/else
4. **Dead-letter queue** — Para webhooks que falham repetidamente
5. **CDN para assets** — Otimizar entrega de imagens/fontes
6. **Monitoring dashboard** — Grafana/Datadog para metricas operacionais
7. **Backup automatizado** — pg_dump agendado para o PostgreSQL

---

*Documento gerado automaticamente durante handoff do VYD Engage.*
