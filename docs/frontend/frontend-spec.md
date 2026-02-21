# VYD Engage - Frontend Specification & UX Audit

**Framework:** React 18.3 + TypeScript + Vite 6.3.5 + TailwindCSS v4.1.3
**Component Library:** shadcn/ui + Radix UI (54 primitives)
**State Management:** React Context (9 providers)
**Routing:** React Router v7 (createBrowserRouter)
**Data:** 2026-02-20
**Fase:** Brownfield Discovery - Fase 3 (Coleta: Frontend/UX)
**Agente:** @ux-design-expert (Uma)
**Escopo:** Frontend architecture, UX patterns, design system, accessibility

---

## Audit Summary

| Categoria | Critico | Alto | Medio | Baixo | Total |
|-----------|---------|------|-------|-------|-------|
| Arquitetura de Componentes | 1 | 4 | 3 | 1 | 9 |
| Design System & Consistencia | 0 | 3 | 4 | 2 | 9 |
| Acessibilidade (a11y) | 1 | 3 | 2 | 0 | 6 |
| Responsividade | 1 | 2 | 1 | 0 | 4 |
| Gerenciamento de Estado | 0 | 3 | 2 | 0 | 5 |
| Type Safety | 0 | 3 | 2 | 0 | 5 |
| Performance | 0 | 2 | 3 | 1 | 6 |
| Seguranca Frontend | 1 | 2 | 1 | 0 | 4 |
| UX Patterns Ausentes | 0 | 3 | 3 | 0 | 6 |
| **TOTAL** | **4** | **25** | **21** | **4** | **54** |

**Veredicto:** NEEDS MAJOR WORK — 4 criticas + 25 altas requerem atencao imediata.

---

## Mapeamento do Frontend

### Metricas Gerais

| Metrica | Valor |
|---------|-------|
| Total de arquivos frontend | 153 |
| Paginas (routes) | 22 |
| Componentes de negocio | 42 |
| Componentes UI (shadcn/ui) | 54 |
| Context Providers | 9 |
| Custom Hooks | 5 |
| Type definitions | 5 arquivos |
| Utility files | 26+ |
| Service/API files | 2 |
| Frontend tests | 0 |

### Estrutura de Diretorios

```
src/
├── components/          # 42 componentes de negocio
│   ├── email/          # 3 componentes (EmailConfigModal, EmailTemplateEditor, SendEmailModal)
│   ├── payment/        # 5 componentes (CreditCardForm, PaymentModal, PixPayment, etc.)
│   ├── register/       # 1 componente (PasswordStrengthIndicator)
│   ├── ui/             # 54 primitivos shadcn/ui + Radix
│   └── whatsapp/       # 4 componentes (ConnectionCard, ConnectWhatsAppModal, etc.)
├── contexts/            # 9 providers
│   ├── AuthContext.tsx
│   ├── CompanyContext.tsx
│   ├── CustomFieldsContext.tsx
│   ├── EmailContext.tsx
│   ├── NotificationContext.tsx
│   ├── PaymentContext.tsx
│   ├── PlanContext.tsx
│   ├── TagsContext.tsx
│   └── WhatsAppContext.tsx
├── hooks/               # 5 hooks customizados
├── pages/               # 22 paginas
├── services/api/        # Cliente HTTP (client.ts 666 linhas)
├── styles/              # globals.css (design tokens), index.css (Tailwind compiled)
├── types/               # Definicoes de tipos compartilhados
└── utils/               # 26+ utilitarios (email, validation, whatsapp, etc.)
```

---

## 1. Arquitetura de Componentes

### FE-01 | CRITICO | Context Hell — 9 Providers Aninhados

**Arquivo:** `src/App.tsx`
**Problema:**
```tsx
<AuthProvider>
  <CompanyProvider>
    <TagsProvider>
      <CustomFieldsProvider>
        <NotificationProvider>
          <PlanProvider>
            <PaymentProvider>
              <WhatsAppProvider>
                <EmailProvider>
                  <RouterProvider router={router} />
                </EmailProvider>
              </WhatsAppProvider>
            </PaymentProvider>
          </PlanProvider>
        </NotificationProvider>
      </CustomFieldsProvider>
    </TagsProvider>
  </CompanyProvider>
</AuthProvider>
```
**Impacto:** Re-renders em cascata, debugging dificil, performance degradada, acoplamento implicito entre providers.
**Recomendacao:**
1. Agrupar providers relacionados (ex: `BillingProvider` = Plan + Payment + Subscription)
2. Usar composicao com `composeProviders()` utility
3. Avaliar migracao para Zustand ou Jotai para estados globais simples
4. Lazy-load providers que nao sao necessarios no boot (WhatsApp, Email)

### FE-02 | ALTO | Componentes Monoliticos (God Components)

**Arquivos afetados:**
| Arquivo | Linhas | useState hooks | Problema |
|---------|--------|---------------|----------|
| `src/pages/Leads.tsx` | 1275 | 15+ | Maior componente, mistura UI + logica + state |
| `src/pages/Settings.tsx` | 1500+ | 40+ | Mega-componente com todas as configuracoes |
| `src/services/api/client.ts` | 666 | N/A | API client monolitico |
| `src/pages/LandingPage.tsx` | 596 | 3 | Conteudo hardcoded, nao componentizado |
| `src/pages/Tasks.tsx` | 554 | 10+ | Logica de filtros duplicada |
| `src/pages/Register.tsx` | 515 | 8+ | Multi-step form em 1 componente |

**Impacto:** Impossivel testar unitariamente, dificil de manter, re-renders desnecessarios.
**Recomendacao:** Decomposicao em sub-componentes com responsabilidade unica. Ex: `Leads.tsx` → `LeadTable`, `LeadFilters`, `LeadDetails`, `LeadScoring`, `LeadBulkActions`.

### FE-03 | ALTO | Logica Duplicada de Logout

**Arquivos:** `src/components/Sidebar.tsx` + `src/components/Header.tsx`
**Problema:** Ambos implementam logout de forma diferente:
- Sidebar: `localStorage.removeItem('token')` + `navigate('/login')`
- Header: `localStorage.removeItem('token')` + `navigate('/login')` (com variacao)
- AuthContext: tem `logout()` que DEVERIA ser a unica fonte

**Impacto:** Se o fluxo de logout mudar (ex: revogar token no servidor), apenas uma implementacao sera atualizada.
**Correcao:** Usar exclusivamente `AuthContext.logout()` em ambos.

### FE-04 | ALTO | Sem Lazy Loading de Rotas

**Arquivo:** `src/utils/routes.tsx`
**Problema:** Todas as 22 rotas sao importadas estaticamente. Nenhum uso de `React.lazy()` ou dynamic imports.
**Impacto:** Bundle unico de ~3.3MB. Usuarios carregam Automations, Settings, WhatsApp mesmo sem usar.
**Correcao:**
```tsx
const Leads = lazy(() => import('../pages/Leads'));
const Settings = lazy(() => import('../pages/Settings'));
```

### FE-05 | ALTO | Sem Error Boundaries

**Problema:** Nenhum `ErrorBoundary` encontrado em nenhum componente ou pagina.
**Impacto:** Qualquer erro em um componente filho derruba a aplicacao inteira (tela branca).
**Correcao:**
1. ErrorBoundary global em `App.tsx`
2. ErrorBoundary por rota/pagina
3. ErrorBoundary especifico para componentes criticos (Leads, Settings)

### FE-06 | ALTO | Navegacao via window.location.href

**Arquivo:** `src/contexts/AuthContext.tsx`
**Problema:** Usa `window.location.href = '/login'` ao inves de React Router navigate.
**Impacto:** Full page reload, perde todo estado da aplicacao, UX ruim.
**Correcao:** Usar `useNavigate()` do React Router em todos os fluxos de redirecionamento.

### FE-07 | MEDIO | Sem Route Guards (Protected Routes)

**Arquivo:** `src/utils/routes.tsx`
**Problema:** Nao ha componente `<ProtectedRoute>` ou similar. A protecao depende inteiramente de cada pagina verificar autenticacao individualmente.
**Impacto:** Se uma pagina esquecer de verificar, acesso nao autorizado e possivel.
**Correcao:** Criar `<RequireAuth>` wrapper que verifica token antes de renderizar children.

### FE-08 | MEDIO | Hardcoded User Profile Defaults

**Arquivo:** `src/components/Sidebar.tsx`
**Problema:** Valores padrao hardcoded: `"Joao Silva"`, `"joao@empresa.com"`. Carrega dados de `localStorage` ao inves de `AuthContext`.
**Impacto:** Se o user mudar email/nome, Sidebar nao atualiza ate reload. Dados inconsistentes entre Header e Sidebar.

### FE-09 | MEDIO | Hardcoded Automations List

**Arquivo:** `src/pages/Leads.tsx`
**Problema:** Lista de automacoes disponivel hardcoded dentro do componente ao inves de buscar da API.
**Impacto:** Automacoes reais do backend nunca aparecem para o usuario.

### FE-10 | BAIXO | Task Counter Badge Sem Real-time

**Arquivo:** `src/components/Sidebar.tsx`
**Problema:** Contagem de tarefas pendentes carrega uma vez e nao atualiza.
**Impacto:** Badge desatualizado apos criar/completar tarefas.

---

## 2. Design System & Consistencia

### FE-11 | ALTO | Naming Legado "FlowCRM"

**Arquivos afetados:**
| Local | Referencia legada |
|-------|-------------------|
| `src/styles/globals.css` | `/* FlowCRM Design System */` |
| `docker-compose.yml` | `flowcrm-*` container names |
| `src/services/api/client.ts` | `https://api.flowcrm.com` fallback URL |

**Impacto:** Confusao de identidade. Inconsistencia entre nome do produto (VYD Engage) e referencias internas.
**Correcao:** Buscar e substituir todas as referencias "FlowCRM" → "VYD Engage".

### FE-12 | ALTO | Cores Hardcoded vs Design Tokens

**Problema:** O design system define tokens em `globals.css` via `@theme {}`, mas componentes usam cores hardcoded extensivamente:

| Cor Hardcoded | Ocorrencias | Token Equivalente |
|---------------|-------------|-------------------|
| `#2563EB` | 50+ | `--color-primary` |
| `#1F2937` | 30+ | `--color-gray-800` |
| `#F9FAFB` | 20+ | `--color-gray-50` |
| `#16A34A` | 15+ | `--color-success` |
| `#DC2626` | 10+ | `--color-error` |
| `#EA580C` | 8+ | `--color-warning` |

**Impacto:** Impossivel implementar dark mode ou theming. Mudanca de marca requer editar 100+ arquivos.
**Correcao:** Migrar para classes Tailwind que referenciam os tokens CSS.

### FE-13 | ALTO | Dark Mode Inexistente (mas CSS preparado)

**Problema:** `index.css` (Tailwind compiled) contem classes `dark:` prefixadas, mas:
1. Nao ha toggle de dark mode na UI
2. Nao ha `prefers-color-scheme` media query
3. Cores hardcoded impossibilitam dark mode funcional

**Impacto:** Feature esperada por usuarios nao esta disponivel apesar do CSS estar parcialmente preparado.

### FE-14 | MEDIO | Imagens Externas (Unsplash) em Producao

**Arquivos:** `Login.tsx`, `Register.tsx`, `LandingPage.tsx`
**Problema:** URLs do Unsplash usadas diretamente para imagens hero, login background, logos de empresas.
**Impacto:** Dependencia de servico terceiro. Se Unsplash cair, paginas publicas ficam sem imagens. Sem controle de cache.
**Correcao:** Baixar e servir imagens localmente ou via CDN proprio.

### FE-15 | MEDIO | Conteudo Hardcoded na Landing Page

**Arquivo:** `src/pages/LandingPage.tsx` (596 linhas)
**Problema:** Todo conteudo hardcoded:
- 6 features com icones e descricoes
- 3 planos de precos (R$97, R$197, R$497)
- 4 depoimentos com fotos Unsplash
- 6 FAQs
- 5 logos de empresas "confiantes"
- Copyright "2024" (desatualizado)

**Impacto:** Qualquer mudanca de conteudo requer deploy. Precos na landing podem divergir dos precos reais no backend.

### FE-16 | MEDIO | Inconsistencia de Feedback ao Usuario

**Problema:** Multiplos patterns de feedback coexistem:
| Pattern | Onde Usado | Consistencia |
|---------|-----------|--------------|
| `alert()` nativo | Leads.tsx, CompanyContext | Ruim - bloqueia UI |
| `window.confirm()` | Automations, Settings, ConnectionCard | Ruim - nao estilizado |
| Toast (sonner) | WhatsAppContext, Register | Bom - consistente |
| Inline error messages | Login, Register | Bom - acessivel |
| `console.log()` | CompanyContext | Ruim - producao |

**Correcao:** Padronizar em Toast (sonner/shadcn) para sucesso/erro + Dialog (Radix) para confirmacoes destrutivas.

### FE-17 | MEDIO | Tabs sem Acessibilidade em Settings

**Arquivo:** `src/pages/Settings.tsx`
**Problema:** Sistema de tabs customizado sem ARIA roles (`role="tablist"`, `role="tab"`, `aria-selected`). Navegacao por teclado nao anunciada.
**Correcao:** Usar `<Tabs>` do Radix UI (ja disponivel nos 54 componentes ui/).

### FE-18 | BAIXO | Spacing Tokens Definidos mas Nao Usados

**Arquivo:** `src/styles/globals.css`
**Problema:** Tokens de spacing definidos (`--spacing-xs: 8px`, etc.) mas componentes usam valores Tailwind diretos (`p-4`, `gap-6`) sem mapear para os tokens.
**Impacto:** Baixo — Tailwind spacing e consistente por si so, mas tokens custom ficam orfaos.

### FE-19 | BAIXO | Footer Copyright Desatualizado

**Arquivo:** `src/pages/LandingPage.tsx`
**Problema:** `"2024 VYD Engage"` — deveria ser 2026 ou dinamico.

---

## 3. Acessibilidade (a11y)

### FE-20 | CRITICO | Sem ARIA Labels em Componentes Interativos

**Arquivos afetados:** GlobalSearch, Tasks, Settings, Leads
**Problema:**
- `<input>` de busca global sem `aria-label`
- `<select>` de filtros sem labels ARIA
- Dropdowns customizados sem `role="listbox"`
- Popovers de filtro sem `aria-expanded`

**Impacto:** Aplicacao inacessivel para usuarios de screen readers. Violacao WCAG 2.1 Level A.

### FE-21 | ALTO | Feedback Apenas por Cor

**Arquivos:** Tasks.tsx, Leads.tsx, Dashboard.tsx
**Problema:**
- Tarefas atrasadas marcadas em vermelho sem texto alternativo ou icone
- Status de lead diferenciado apenas por cor do badge
- Graficos de dashboard sem texto alternativo

**Impacto:** Usuarios daltonicos nao conseguem distinguir estados. Violacao WCAG 1.4.1.
**Correcao:** Adicionar icones, texto, ou patterns alem de cor.

### FE-22 | ALTO | Keyboard Navigation Incompleta

**Problema:**
- Bulk select em Leads nao funciona via teclado
- GlobalSearch sem focus trap (Tab sai do dropdown)
- Sidebar links nao tem `aria-current="page"`
- Modal de payment nao prende foco

**Impacto:** Usuarios que navegam por teclado perdem contexto.

### FE-23 | ALTO | Sem Skip Navigation

**Problema:** Nao ha link "Skip to main content" para pular sidebar/header.
**Impacto:** Usuarios de screen reader precisam navegar 20+ links de sidebar em cada pagina.

### FE-24 | MEDIO | Emojis Sem Texto Alternativo

**Arquivo:** `src/components/Sidebar.tsx` (keyboard shortcut hint)
**Problema:** `Ctrl+K` mostrado como icone sem `aria-label`. Simbolo `(Ctrl+K)` visivel mas nao semantico.

### FE-25 | MEDIO | Formularios Sem Mensagens de Erro Acessiveis

**Arquivos:** Login.tsx, Settings.tsx
**Problema:** Erros exibidos como texto vermelho abaixo do campo, mas sem `aria-describedby` conectando input ao erro (exceto Register.tsx que faz corretamente).

---

## 4. Responsividade

### FE-26 | CRITICO | Layout Fixo — Sem Suporte Mobile

**Arquivo:** `src/components/AppLayout.tsx`
```tsx
<div className="flex min-h-screen bg-[#F9FAFB]">
  <Sidebar />  {/* w-64 fixo */}
  <main className="flex-1 ml-64">  {/* ml-64 fixo */}
    <Outlet />
  </main>
</div>
```
**Problema:** Sidebar fixa `w-64` (256px) + `ml-64` no conteudo principal. Nenhum breakpoint responsive. Nenhum menu hamburger. Nenhum `@media` query no layout.
**Impacto:** Aplicacao INUTILIZAVEL em telas < 768px. CRM mobile e requisito essencial para vendedores em campo.
**Correcao:**
1. Sidebar colapsavel com hamburger menu em mobile
2. Sidebar overlay em telas pequenas
3. Breakpoints: `<md` = sidebar hidden, `md-lg` = sidebar colapsada (icons only), `>lg` = sidebar expandida

### FE-27 | ALTO | Tabelas Nao Responsivas

**Arquivos:** Leads.tsx, Tasks.tsx
**Problema:** Tabelas HTML nativas com colunas fixas. Sem scroll horizontal, sem card-view em mobile, sem colunas escondidas.
**Impacto:** Dados cortados em telas menores. Leads e a tela mais usada do CRM.

### FE-28 | ALTO | Breakpoints Limitados

**Arquivo:** `src/index.css` (Tailwind compiled)
**Breakpoints disponiveis:** `sm: 40rem`, `md: 48rem`, `lg: 64rem`, `xl: 80rem`
**Problema:** Breakpoints definidos mas quase nao usados nos componentes de negocio. Apenas componentes shadcn/ui tem responsividade interna.

### FE-29 | MEDIO | Popovers de Filtro em Leads

**Arquivo:** `src/pages/Leads.tsx`
**Problema:** 5 popovers de filtro abertos via refs manuais (`useRef` + boolean state x5). Em telas pequenas, popovers cobrem conteudo importante. Sem scroll interno, sem posicionamento responsivo.
**Correcao:** Usar `<Popover>` do Radix UI (ja disponivel) com auto-positioning.

---

## 5. Gerenciamento de Estado

### FE-30 | ALTO | PlanContext Excessivamente Complexo (444 linhas)

**Arquivo:** `src/contexts/PlanContext.tsx`
**Problema:**
- 444 linhas de logica em um unico context
- Dados mockados (usuarios count = `2`, historico de pagamento fake)
- `window.location.reload()` ao trocar de plano (UX agressiva)
- `AVAILABLE_PLANS` array recriado a cada render (sem useMemo)
- `skipPaymentValidation` flag sugere bypass de billing
- Default plan hardcoded como "pro"

**Impacto:** Context que deveria consumir API esta simulando dados localmente. Billing incorreto.

### FE-31 | ALTO | localStorage como "Database" Frontend

**Problema:** Multiplos contextos usam localStorage como fonte primaria de dados ao inves de API:
| Context/Component | Dados em localStorage | Deveria ser |
|-------------------|----------------------|-------------|
| CompanyContext | Logo, company name | API /tenant |
| PlanContext | Plano atual, limites | API /subscription |
| Sidebar | User name, email, avatar | AuthContext |
| Settings | Webhook config, tokens | API /settings |
| Dashboard | Widget layout | API /user-preferences |

**Impacto:** Dados nao sincronizados entre dispositivos. Limpar localStorage = perder configuracoes.

### FE-32 | ALTO | Polling Agressivo em Multiplos Contexts

**Problema:**
| Context | Intervalo | Proposito |
|---------|-----------|-----------|
| NotificationContext | 60s | Buscar notificacoes |
| WhatsAppContext | 1s (!) | `setInterval(handleStorageChange, 1000)` |

**Impacto:** WhatsApp polling a cada 1 segundo e extremamente agressivo. Cada interval = re-render potencial.
**Correcao:** WebSocket ou SSE para notificacoes real-time. Storage event listener nativo ao inves de polling.

### FE-33 | MEDIO | useState Excessivo (Should be useReducer)

**Arquivos:** Settings.tsx (40+ useState), Leads.tsx (15+ useState)
**Problema:** Estado complexo e interdependente gerenciado com useState individual.
**Correcao:** Migrar para `useReducer` quando ha 5+ estados relacionados.

### FE-34 | MEDIO | Sem Cache de API Responses

**Arquivo:** `src/services/api/client.ts`
**Problema:** Nenhum mecanismo de cache. Cada navegacao de pagina re-fetcha todos os dados.
**Correcao:** Considerar React Query (TanStack Query) para cache, deduplicacao, e stale-while-revalidate.

---

## 6. Type Safety

### FE-35 | ALTO | Mismatch de Tipos Frontend vs Backend

**Arquivo:** `src/types/index.ts`
**Problema critico:** Tipos do frontend divergem dos enums Prisma do backend:

| Campo | Frontend (`types/index.ts`) | Backend (Prisma enum) |
|-------|---------------------------|----------------------|
| `Lead.id` | `number` | `String` (UUID) |
| `Lead.status` | `"novo"\|"contato"\|"fechado"\|"perdido"` | `NEW\|CONTACTED\|QUALIFIED\|PROPOSAL\|NEGOTIATION\|WON\|LOST` |
| `Lead.source` | `"meta"\|"google"\|"organico"\|"manual"` | `WEBSITE\|SOCIAL_MEDIA\|REFERRAL\|EMAIL\|PHONE\|OTHER` |

**Impacto:** Dados enviados ao backend serao REJEITADOS ou armazenados incorretamente. 4 status no frontend vs 7 no backend — 3 status invisiveis.

### FE-36 | ALTO | Uso de `any` Generalizado

**Arquivos afetados:**
| Arquivo | Ocorrencias de `any` | Exemplo |
|---------|---------------------|---------|
| `client.ts` | 10+ | `filters?: any`, `response: any` |
| `types/index.ts` | 5+ | `Record<string, any>` |
| `Login.tsx` | 2 | `error: any` |
| `PlanContext.tsx` | 3+ | Payment history `as any` |
| `WhatsAppContext.tsx` | 2 | `as any` cast |

**Impacto:** TypeScript perde efetividade. Erros de runtime que deveriam ser pegos em compile time.

### FE-37 | ALTO | Sem Validacao de API Responses

**Arquivo:** `src/services/api/client.ts`
**Problema:** Respostas da API sao aceitas sem validacao. Nenhum schema Zod no client.
```typescript
// Atual — aceita qualquer coisa
const data = await response.json();
return data;

// Deveria — validar com Zod
const data = LeadResponseSchema.parse(await response.json());
```
**Impacto:** Se a API mudar response shape, frontend quebra silenciosamente.

### FE-38 | MEDIO | Tipos de Report Nao Usados

**Arquivo:** `src/types/index.ts`
**Problema:** Tipos `ReportWidget`, `ReportFilter`, `ReportSchedule`, `ReportShareSettings` definidos mas nao usados em nenhum componente.
**Impacto:** Dead code. Confusao sobre features disponiveis.

### FE-39 | MEDIO | Sem Tipos Gerados do Prisma

**Problema:** Tipos frontend sao escritos manualmente em `types/index.ts` ao inves de gerados a partir do schema Prisma.
**Correcao:** Usar `prisma generate` com generator de tipos compartilhados, ou manter contrato via OpenAPI/tRPC.

---

## 7. Performance

### FE-40 | ALTO | Bundle Monolitico 3.3MB

**Problema:** Build de producao gera um unico chunk de ~3.3MB (808KB gzipped).
**Causa:** Zero code-splitting. Todas as 22 paginas + 54 componentes UI + 9 contexts em 1 arquivo.
**Correcao:**
1. `React.lazy()` para paginas
2. Dynamic import para componentes pesados (Editor, Charts)
3. Vendor chunk splitting no Vite config

### FE-41 | ALTO | Sem Paginacao em Leads

**Arquivo:** `src/pages/Leads.tsx`
**Problema:** Busca TODOS os leads da API e renderiza sem paginacao.
**Impacto:** Com 1000+ leads, pagina trava. Memory leak potencial.
**Correcao:** Server-side pagination com `?page=1&limit=20`.

### FE-42 | MEDIO | Recalculos em Cada Render

**Arquivos:**
- `Leads.tsx`: Lead scoring calculado no render, `saveLeadScore()` chamado como side effect
- `Tasks.tsx`: `tasksByDate` recalculado sem memoizacao
- `PlanContext.tsx`: `AVAILABLE_PLANS` array recriado a cada render

**Correcao:** `useMemo` para calculos derivados, `useCallback` para handlers.

### FE-43 | MEDIO | GlobalSearch Sem Debounce

**Arquivo:** `src/components/GlobalSearch.tsx`
**Problema:** Cada keystroke dispara busca na API (`limit: 100`). Depois filtra no client.
**Correcao:** Debounce de 300ms + server-side search + limitar a 20 resultados.

### FE-44 | MEDIO | Sem Skeleton Loading

**Arquivo:** `src/pages/Dashboard.tsx`
**Problema:** Mostra "Carregando..." como texto durante fetch. Nenhuma pagina usa skeleton loading.
**Impacto:** Layout shift quando dados carregam. UX percebida como lenta.
**Correcao:** Implementar `<Skeleton>` do shadcn/ui (ja disponivel em `ui/skeleton.tsx`).

### FE-45 | BAIXO | Inline Utility Functions

**Arquivo:** `src/pages/Dashboard.tsx`
**Problema:** `formatTimeAgo()` definida inline no componente ao inves de extraida para utils.
**Impacto:** Nao reutilizavel. Duplicacao se outro componente precisar.

---

## 8. Seguranca Frontend

### FE-46 | CRITICO | Dados de Cartao em Component State

**Arquivo:** `src/components/payment/CreditCardForm.tsx`
**Problema:** Numero do cartao, CVV e validade armazenados em `useState`. Nenhuma tokenizacao via SDK de pagamento (Mercado Pago SDK / Stripe Elements).
**Mensagem enganosa:** `"Nao armazenamos seus dados de pagamento"` — mas os dados passam pelo frontend em plaintext.
**Impacto:** Violacao PCI DSS. Dados de cartao NUNCA devem tocar o frontend sem SDK certificado.
**Correcao:** Usar Mercado Pago JS SDK (CardForm) que tokeniza dados no iframe seguro.

### FE-47 | ALTO | Tokens em localStorage

**Problema:** JWT e dados sensiveis armazenados em `localStorage`:
- `token` (JWT)
- `refreshToken`
- `currentPlan`
- API tokens de integracoes (Meta, Google)

**Impacto:** Vulneravel a XSS. Qualquer script injetado pode roubar tokens.
**Correcao:** Migrar JWT para `httpOnly` cookie (set pelo backend). Dados sensiveis nunca em localStorage.

### FE-48 | ALTO | Sem CSRF Protection Headers

**Arquivo:** `src/services/api/client.ts`
**Problema:** Requests feitas sem CSRF token. Se JWT migrar para cookies, CSRF se torna critico.

### FE-49 | MEDIO | Hardcoded API URL Fallback

**Arquivo:** `src/services/api/client.ts`
**Problema:** `"https://api.flowcrm.com"` como fallback URL.
**Impacto:** Se `VITE_API_URL` nao for configurado, requests vao para dominio inexistente (ou pior, dominio controlado por terceiros).

---

## 9. UX Patterns Ausentes

### FE-50 | ALTO | Sem Sistema de Confirmacao para Acoes Destrutivas

**Problema:** Acoes destrutivas usam `window.confirm()` nativo:
- Deletar automacao (`Automations.tsx`)
- Remover conexao WhatsApp (`ConnectionCard.tsx`)
- Reset de configuracoes (`Settings.tsx`)

**Correcao:** Usar `<AlertDialog>` do Radix UI (ja disponivel em `ui/alert-dialog.tsx`).

### FE-51 | ALTO | "Lembrar de Mim" Nao Funcional

**Arquivo:** `src/pages/Login.tsx`
**Problema:** Checkbox "Lembrar de mim" renderizado mas sem implementacao. Estado nunca usado.
**Impacto:** Feature visivel mas enganosa. Quebra confianca do usuario.

### FE-52 | ALTO | Sem Feedback de Progresso em Operacoes Longas

**Problema:** Nenhuma operacao mostra progresso real:
- Upload de CSV de leads: sem progress bar
- Envio de email em massa: sem contagem
- Conexao WhatsApp: QR code sem timer de expiracao visivel

### FE-53 | MEDIO | Sem Empty States Contextuais

**Problema:** Maioria das listas mostra apenas texto generico quando vazia. Nao ha call-to-action ou orientacao para o proximo passo.
**Excecao positiva:** `EmptyState.tsx` existe como componente reutilizavel, mas nao e usado em todas as paginas.

### FE-54 | MEDIO | Sem Onboarding/Tour

**Problema:** Novos usuarios caem direto no dashboard sem orientacao. Nao ha walkthrough, tooltips guiados, ou checklist de setup.

### FE-55 | MEDIO | Funcionalidades Simuladas (Mock)

**Problema:** Varias funcionalidades aparentam funcionar mas sao simuladas:
| Feature | Arquivo | Status |
|---------|---------|--------|
| Meta Lead Ads integration | Settings.tsx | Simulado (fake token validation) |
| Google Lead Form | Settings.tsx | Simulado (fake validation) |
| Webhook configuration | Settings.tsx | Salvo em localStorage |
| Lead scoring | Leads.tsx | Calculado localmente, nao persistido |
| Payment history | PlanContext.tsx | Dados mock hardcoded |

**Impacto:** Usuario acredita que integracoes funcionam, mas dados nao sao reais.

---

## Matriz de Priorizacao

| ID | Debito | Severidade | Esforco | Prioridade | Sprint |
|----|--------|-----------|---------|------------|--------|
| FE-26 | Layout fixo sem mobile | CRITICO | Alto | 1 | 1 |
| FE-46 | Dados de cartao inseguros | CRITICO | Medio | 1 | 1 |
| FE-01 | Context Hell (9 providers) | CRITICO | Alto | 2 | 1 |
| FE-20 | Sem ARIA labels | CRITICO | Medio | 2 | 1 |
| FE-35 | Type mismatch frontend/backend | ALTO | Baixo | 3 | 1 |
| FE-47 | Tokens em localStorage | ALTO | Medio | 3 | 1 |
| FE-05 | Sem Error Boundaries | ALTO | Baixo | 4 | 1 |
| FE-04 | Sem lazy loading | ALTO | Baixo | 4 | 1 |
| FE-02 | Componentes monoliticos | ALTO | Alto | 5 | 2 |
| FE-41 | Sem paginacao (Leads) | ALTO | Medio | 5 | 2 |
| FE-12 | Cores hardcoded | ALTO | Medio | 6 | 2 |
| FE-30 | PlanContext complexo | ALTO | Medio | 6 | 2 |
| FE-31 | localStorage como DB | ALTO | Alto | 7 | 2 |
| FE-32 | Polling agressivo | ALTO | Medio | 7 | 2 |
| FE-03 | Logout duplicado | ALTO | Baixo | 8 | 2 |
| FE-06 | window.location.href | ALTO | Baixo | 8 | 2 |
| FE-11 | Naming legado FlowCRM | ALTO | Baixo | 8 | 2 |
| FE-21 | Feedback apenas por cor | ALTO | Medio | 9 | 2 |
| FE-22 | Keyboard navigation | ALTO | Medio | 9 | 2 |
| FE-23 | Sem skip navigation | ALTO | Baixo | 9 | 2 |
| FE-27 | Tabelas nao responsivas | ALTO | Medio | 9 | 2 |
| FE-36 | Uso de `any` | ALTO | Medio | 10 | 3 |
| FE-37 | Sem validacao de API | ALTO | Medio | 10 | 3 |
| FE-40 | Bundle 3.3MB | ALTO | Medio | 10 | 3 |
| FE-50 | window.confirm() | ALTO | Baixo | 10 | 3 |
| FE-51 | Lembrar de mim fake | ALTO | Baixo | 10 | 3 |
| FE-52 | Sem feedback de progresso | ALTO | Medio | 10 | 3 |
| FE-48 | Sem CSRF headers | ALTO | Baixo | 10 | 3 |
| FE-28 | Breakpoints nao usados | ALTO | Medio | 11 | 3 |

---

## Recomendacoes por Ordem de Execucao

### Sprint 1: Fundacao Critica
1. **Seguranca de Pagamento** (FE-46) — Migrar para Mercado Pago SDK
2. **Layout Responsivo** (FE-26) — Sidebar colapsavel + mobile-first layout
3. **Error Boundaries** (FE-05) — Global + per-route error boundaries
4. **Lazy Loading** (FE-04) — Code splitting das rotas
5. **Type Alignment** (FE-35) — Alinhar tipos frontend com enums Prisma
6. **Token Security** (FE-47) — Migrar JWT para httpOnly cookies
7. **ARIA Basico** (FE-20) — Labels em inputs, selects, e componentes interativos

### Sprint 2: Qualidade & Consistencia
8. **Decomposicao de Componentes** (FE-02) — Leads.tsx, Settings.tsx
9. **Paginacao** (FE-41) — Server-side pagination em Leads
10. **Design Tokens** (FE-12) — Migrar cores hardcoded para tokens
11. **Estado Centralizado** (FE-30, FE-31) — Migrar localStorage para API
12. **Feedback Consistente** (FE-16) — Toast + AlertDialog padronizados
13. **Acessibilidade** (FE-21, FE-22, FE-23) — Cor + texto, keyboard nav, skip links

### Sprint 3: Polish & Performance
14. **Type Safety** (FE-36, FE-37) — Eliminar `any`, adicionar Zod nos responses
15. **Bundle Optimization** (FE-40) — Vendor splitting, tree shaking
16. **Real-time** (FE-32) — WebSocket/SSE para notificacoes
17. **Dark Mode** (FE-13) — Implementar com design tokens
18. **Onboarding** (FE-54) — Tour guiado para novos usuarios

---

## Perguntas para @architect

1. Qual a estrategia de autenticacao preferida? httpOnly cookies (requer mudanca no backend) ou manter JWT em localStorage com medidas de mitigacao XSS?
2. Existe plano para migrar Context para state management library (Zustand/Jotai/Redux Toolkit)?
3. O suporte mobile e requisito P0 (blocker para lancamento) ou P1 (can launch without)?
4. Dark mode esta no roadmap do produto?
5. As integracoes simuladas (Meta Lead Ads, Google Lead Form) devem ser removidas da UI ou mantidas como "coming soon"?
6. Considerando 54 componentes shadcn/ui ja instalados, por que muitos componentes usam implementacoes manuais ao inves dos primitivos disponiveis (ex: `window.confirm()` ao inves de `AlertDialog`)?

---

## Pontos Positivos Identificados

Para equilibrio, o frontend tem fundamentos solidos em varios aspectos:

1. **Component Library Rico:** 54 componentes shadcn/ui + Radix UI prontos para uso
2. **Design Tokens Definidos:** Sistema de design em `globals.css` bem estruturado (precisa ser usado)
3. **Register.tsx:** Excelente exemplo de form multi-step com Zod validation e acessibilidade
4. **PasswordStrengthIndicator:** Componente acessivel com ARIA correto
5. **EmptyState Component:** Reutilizavel e bem projetado (precisa ser mais usado)
6. **Tailwind CSS v4:** Versao mais recente, CSS-based config moderno
7. **Toaster (sonner):** Ja integrado para notifications
8. **Zod no Backend:** Validacao no servidor ja existe (falta espelhar no frontend)
9. **API Client Robusto:** Token refresh, error handling, network detection

---

## Change Log

| Data | Versao | Descricao | Autor |
|------|--------|-----------|-------|
| 2026-02-20 | 1.0 | Frontend spec & UX audit — Fase 3 Discovery | @ux-design-expert (Uma) |

---

*— Uma, desenhando experiencias*
