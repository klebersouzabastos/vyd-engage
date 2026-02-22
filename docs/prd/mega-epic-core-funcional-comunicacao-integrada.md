# PRD: Mega Épico — Core Funcional + Comunicação Integrada

**Product:** VYD Engage CRM
**Author:** Morgan (PM Agent)
**Date:** 2026-02-21
**Version:** 1.0
**Status:** Draft

---

## 1. Goals and Background Context

### Product Name
VYD Engage — Mega Épico: Core Funcional + Comunicação Integrada

### Background / Problem Statement
O VYD Engage possui a estrutura de um CRM SaaS completo, porém diversas funcionalidades críticas estão incompletas ou operando apenas no frontend (localStorage). Isso resulta em:

- **Pipeline/Kanban** persistido apenas no navegador — dados perdidos entre sessões e dispositivos
- **Automações** com builder funcional mas sem execução real — triggers não disparam envios
- **WhatsApp** com gestão de conexões mas sem envio/recebimento de mensagens
- **Email** com configuração de providers mas sem envio real
- **Lead Scoring** calculado client-side sem persistência no backend
- **Billing** com backend pronto mas sem frontend de checkout
- **Inbox** inexistente — sem visão unificada das conversas com leads

No mercado brasileiro de CRM SaaS (USD 2.1B, CAGR 13.1%), integração WhatsApp nativa e automações funcionais são **requisitos mínimos** para competir. Sem essas features operacionais, o produto não é viável comercialmente.

### Goals
1. **Tornar o core funcional end-to-end** — Pipeline, automações, scoring e billing completamente operacionais
2. **Habilitar comunicação real** — WhatsApp e Email com envio/recebimento integrado às automações
3. **Criar inbox unificada** — Centralizar todas as conversas com leads em uma interface
4. **Desbloquear monetização** — Checkout completo com Mercado Pago funcional
5. **Garantir persistência de dados** — Migrar toda lógica de localStorage para backend/banco

### Success Metrics
| Métrica | Target |
|---------|--------|
| Pipeline data loss | 0% (backend-persistent) |
| Automações executando com sucesso | > 95% delivery rate |
| WhatsApp mensagens enviadas/recebidas | Funcional end-to-end |
| Email delivery rate | > 98% |
| Checkout conversion | > 60% intent → pagamento |
| Lead scoring accuracy | Persistente + compartilhado entre users |

### Target Users
- **Pequenas/médias empresas brasileiras** que usam WhatsApp como canal primário de vendas
- **Equipes de vendas** (1-20 pessoas) que precisam de automação para escalar atendimento
- **Gestores comerciais** que precisam de visibilidade sobre pipeline e performance

---

## 2. Requirements

### Functional Requirements

#### Bloco A: Core Funcional

**FR-A1: Pipeline Persistente**
- Pipeline/funis salvos no banco de dados (Prisma) por tenant
- CRUD de funis: criar, editar, renomear, deletar colunas
- Drag-and-drop atualiza status do lead no backend via API
- Migração transparente: dados existentes em localStorage migrados na primeira visita
- Múltiplos funis por tenant com funil padrão

**FR-A2: Automações com Execução Real**
- Engine de execução que processa triggers em background (BullMQ)
- Trigger: lead criado, lead mudou de status, lead recebeu tag
- Actions: enviar WhatsApp, enviar Email, aguardar delay, atualizar lead
- Logs de execução com status (sucesso/falha/pendente) por step
- Retry automático em falhas (max 3 tentativas com backoff exponencial)

**FR-A3: Lead Scoring Backend**
- Score calculado e persistido no banco por lead
- Regras de scoring configuráveis por tenant (ações = pontos)
- Score atualizado automaticamente via events (interação, abertura email, resposta WhatsApp)
- Exibição do score no card do lead e no pipeline

**FR-A4: Billing Frontend Completo**
- Página de planos com comparativo visual
- Checkout integrado com Mercado Pago (PIX + Cartão)
- Gestão de assinatura: upgrade, downgrade, cancelamento
- Histórico de pagamentos e faturas
- Enforcement visual dos limites do plano (barra de uso)

#### Bloco B: Comunicação Integrada

**FR-B1: WhatsApp Envio/Recebimento**
- Envio de mensagens de texto via API do provider (Meta/Twilio)
- Recebimento de mensagens via webhook
- Templates de mensagem com variáveis ({{nome}}, {{empresa}})
- Status de entrega (enviado, entregue, lido, falhou)
- Suporte a mídia (imagens, documentos, áudio)

**FR-B2: Email Envio Real**
- Envio via Resend API ou SMTP configurado
- Templates de email com editor visual básico
- Variáveis dinâmicas nos templates
- Tracking de abertura e cliques
- Unsubscribe automático (compliance)

**FR-B3: Automações Conectadas aos Canais**
- Actions de automação disparam envios reais (WhatsApp/Email)
- Condições: if/else baseado em resposta ou status de entrega
- Sequences: cadência multi-step com delays configuráveis
- Métricas por automação: enviados, entregues, respondidos, convertidos

**FR-B4: Inbox Unificada**
- Timeline unificada de todas as interações com cada lead
- Filtro por canal (WhatsApp, Email, Nota manual)
- Resposta direta pela inbox (enviar WhatsApp/Email inline)
- Notificação de novas mensagens recebidas
- Atribuição de conversa a membro da equipe

### Non-Functional Requirements

| ID | Requisito | Target |
|----|-----------|--------|
| NFR-1 | Latência API | < 200ms p95 para CRUD, < 500ms para envios |
| NFR-2 | Uptime automações | 99.5% (BullMQ com Redis persistent) |
| NFR-3 | Escala WhatsApp | 1000 mensagens/hora por tenant |
| NFR-4 | Escala Email | 5000 emails/hora por tenant |
| NFR-5 | Segurança | Tokens/API keys encriptados at-rest, HTTPS only |
| NFR-6 | Multi-tenancy | Isolamento total de dados entre tenants |
| NFR-7 | Observabilidade | Logs estruturados, métricas de filas, alertas de falha |
| NFR-8 | Compatibilidade | Chrome, Firefox, Safari, Edge (últimas 2 versões) |
| NFR-9 | Mobile | Responsive em todas as novas telas |
| NFR-10 | Migração | Zero data loss na migração localStorage → backend |

---

## 3. UI Design Goals

| Princípio | Aplicação |
|-----------|-----------|
| **Consistência** | Novas telas seguem design system existente (shadcn/ui + Tailwind) |
| **Progressive Disclosure** | Features avançadas reveladas gradualmente, não sobrecarregar |
| **Real-time Feedback** | Status de envio WhatsApp/Email visível em tempo real |
| **Mobile-First Inbox** | Inbox unificada projetada para funcionar bem em telas pequenas |
| **Zero-Config Start** | Pipeline padrão funciona sem configuração extra |
| **Visual Pipeline** | Kanban com cores de status, badges de score, indicadores de atividade |
| **Notification Center** | Badge de notificação para novas mensagens recebidas |

### Novas Telas
1. **Inbox** (`/app/inbox`) — Timeline de conversas unificada
2. **Checkout** (`/app/checkout`) — Fluxo de pagamento Mercado Pago
3. **Automation Logs** (expandir existente) — Dashboard de execução com métricas
4. **Email Template Editor** — Editor visual de templates
5. **Pipeline Settings** — Configuração de funis e colunas

### Telas Modificadas
- Pipeline — Migrar para backend, adicionar score badge
- Leads — Adicionar score visual, link para inbox
- Dashboard — Adicionar métricas de automação e comunicação
- Settings/Billing — Checkout completo com planos

---

## 4. Technical Assumptions

| Assumption | Justificativa |
|------------|---------------|
| PostgreSQL continua como único DB | Schema Prisma existente, sem necessidade de NoSQL |
| BullMQ + Redis para filas de automação | Já configurado no projeto, pattern comprovado |
| Meta Business API para WhatsApp | API oficial, suporta templates e webhooks |
| Resend como provider primário de email | Já referenciado no projeto, API moderna |
| SMTP como fallback de email | Configuração existente no projeto |
| Mercado Pago para pagamentos | Já integrado no backend, dominante no BR |
| Prisma ORM para novos models | Consistência com codebase existente |
| shadcn/ui + Radix para novas UIs | Design system já estabelecido |
| Vite + React 18 (sem SSR) | Arquitetura frontend existente mantida |
| WebSocket para inbox real-time | Necessário para mensagens em tempo real |

### Riscos Técnicos
| Risco | Mitigação |
|-------|-----------|
| Rate limits WhatsApp API | Queue com throttling por tenant |
| Webhooks falharem | Dead letter queue + retry com exponential backoff |
| Migração localStorage corromper dados | Validação + dry-run + rollback automático |
| Redis down = automações paradas | Redis Sentinel/cluster em produção |
| Custos de WhatsApp API | Limites por plano, billing proporcional |

---

## 5. Epic List

| Epic | Nome | Scope | Estimativa |
|------|------|-------|------------|
| **Epic 1** | Pipeline Persistente | FR-A1 | 2 sprints |
| **Epic 2** | Engine de Automações | FR-A2, FR-A3 (parcial) | 3 sprints |
| **Epic 3** | WhatsApp Integration | FR-B1 | 2 sprints |
| **Epic 4** | Email Integration | FR-B2 | 1-2 sprints |
| **Epic 5** | Automações + Canais | FR-B3 (conecta Epic 2+3+4) | 2 sprints |
| **Epic 6** | Inbox Unificada | FR-B4 | 2 sprints |
| **Epic 7** | Lead Scoring Backend | FR-A3 | 1 sprint |
| **Epic 8** | Billing Frontend | FR-A4 | 1-2 sprints |

### Ordem de Execução Recomendada
```
Epic 1 (Pipeline) → Epic 7 (Scoring) → Epic 2 (Engine Automações)
    → Epic 3 (WhatsApp) → Epic 4 (Email) → Epic 5 (Canais + Automações)
        → Epic 6 (Inbox) → Epic 8 (Billing)
```

### Dependências
- Epic 5 depende de Epic 2, 3, 4
- Epic 6 depende de Epic 3, 4
- Epics 1, 7, 8 são independentes

---

## 6. Epic Details

### Epic 1: Pipeline Persistente (2 sprints)
| Story | Título | Complexidade |
|-------|--------|-------------|
| 1.1 | Modelo Prisma para Pipeline/Funnel/Column | S |
| 1.2 | API CRUD de Funis e Colunas | M |
| 1.3 | Migração localStorage → backend (com rollback) | M |
| 1.4 | Drag-and-drop com sync backend | M |
| 1.5 | Múltiplos funis por tenant | S |
| 1.6 | Pipeline settings UI (rename, reorder, delete columns) | M |

### Epic 2: Engine de Automações (3 sprints)
| Story | Título | Complexidade |
|-------|--------|-------------|
| 2.1 | Worker BullMQ para processamento de automações | L |
| 2.2 | Trigger system (lead created, status changed, tag added) | M |
| 2.3 | Step executor (delay, update lead, conditions) | L |
| 2.4 | Retry + dead letter queue + error handling | M |
| 2.5 | Execution logs dashboard com métricas | M |
| 2.6 | Automation scheduling (horários permitidos) | S |

### Epic 3: WhatsApp Integration (2 sprints)
| Story | Título | Complexidade |
|-------|--------|-------------|
| 3.1 | Meta Business API client service | L |
| 3.2 | Envio de mensagens de texto + mídia | M |
| 3.3 | Webhook para recebimento de mensagens | M |
| 3.4 | Template management (criar, editar, aprovar) | M |
| 3.5 | Status tracking (enviado, entregue, lido) | S |
| 3.6 | Rate limiting + queue por tenant | S |

### Epic 4: Email Integration (1-2 sprints)
| Story | Título | Complexidade |
|-------|--------|-------------|
| 4.1 | Resend API client + SMTP fallback | M |
| 4.2 | Template editor visual básico | M |
| 4.3 | Envio com variáveis dinâmicas | S |
| 4.4 | Tracking pixel (opens) + link tracking (clicks) | M |
| 4.5 | Unsubscribe + bounce handling | S |

### Epic 5: Automações + Canais (2 sprints)
| Story | Título | Complexidade |
|-------|--------|-------------|
| 5.1 | Action: Enviar WhatsApp no step executor | M |
| 5.2 | Action: Enviar Email no step executor | M |
| 5.3 | Condições if/else baseado em resposta/delivery | M |
| 5.4 | Sequences multi-step com cadência | L |
| 5.5 | Métricas por automação (enviados, respondidos, convertidos) | M |

### Epic 6: Inbox Unificada (2 sprints)
| Story | Título | Complexidade |
|-------|--------|-------------|
| 6.1 | Modelo de Conversation + Message no Prisma | M |
| 6.2 | API de conversas com paginação e filtros | M |
| 6.3 | UI Inbox com timeline por lead | L |
| 6.4 | Resposta inline (WhatsApp/Email pela inbox) | L |
| 6.5 | WebSocket para mensagens em tempo real | M |
| 6.6 | Notificações de novas mensagens | S |

### Epic 7: Lead Scoring Backend (1 sprint)
| Story | Título | Complexidade |
|-------|--------|-------------|
| 7.1 | Modelo de ScoreRule + campo score no Lead | S |
| 7.2 | API de regras de scoring por tenant | S |
| 7.3 | Event-driven scoring (update automático) | M |
| 7.4 | UI de configuração de regras | M |
| 7.5 | Score badge no pipeline e lista de leads | S |

### Epic 8: Billing Frontend (1-2 sprints)
| Story | Título | Complexidade |
|-------|--------|-------------|
| 8.1 | Página de planos comparativo | M |
| 8.2 | Checkout Mercado Pago (PIX + Cartão) | L |
| 8.3 | Gestão de assinatura (upgrade/downgrade/cancel) | M |
| 8.4 | Histórico de pagamentos + faturas | S |
| 8.5 | Barra de uso dos limites do plano | S |

---

## 7. Checklist de Validação

| # | Critério | Status |
|---|----------|--------|
| 1 | Problema claramente definido | ✅ |
| 2 | Goals mensuráveis com métricas | ✅ |
| 3 | Target users identificados | ✅ |
| 4 | Requisitos funcionais completos | ✅ |
| 5 | Requisitos não-funcionais definidos | ✅ |
| 6 | UI goals e telas mapeadas | ✅ |
| 7 | Assumptions e riscos documentados | ✅ |
| 8 | Épicos com stories e estimativas | ✅ |
| 9 | Dependências entre épicos mapeadas | ✅ |
| 10 | Ordem de execução definida | ✅ |

---

## 8. Next Steps

1. **Validação** → Submeter PRD ao @po para validação
2. **Architecture** → @architect para definir decisões técnicas (WebSocket lib, queue patterns)
3. **Story Detailing** → @sm para detalhar cada story com AC (Given/When/Then)
4. **Sprint Planning** → Organizar épicos em sprints de 2 semanas
5. **Implementação** → Começar pelo Epic 1 (Pipeline Persistente) — baixo risco, alto impacto

---

*— Morgan, planejando o futuro 📊*
