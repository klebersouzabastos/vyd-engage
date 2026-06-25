# PRD — Épico: Email Campaigns

**Epic ID:** EPIC-EMAIL-CAMPAIGNS  
**Prioridade:** P1 (ecossistema completo)  
**Duração estimada:** 4-5 semanas  
**Sequência no Roadmap:** 3 de 4

---

## Contexto

O VYD Engage tem infraestrutura de email transacional (Resend + SMTP via `emailMessagingService.ts`) e tracking de links/pixels (`tracking.ts`). O que falta é o módulo de campanhas: criar uma mensagem, selecionar a audiência, agendar e medir resultados — tudo dentro do CRM.

Hoje times de vendas usam Mailchimp ou RD Station em paralelo, o que fragmenta o funil: leads do CRM ≠ lista do email marketing. Campanhas integradas eliminam essa dupla gestão.

---

## Personas

| Persona | Perfil | Dor Principal |
|---------|--------|---------------|
| **Gestor de Marketing/Vendas** | Cria campanhas semanais para base de leads | "Exporto para CSV, subo no Mailchimp, depois não sei quais leads abriram e viraram deals." |
| **Vendedor Proativo** | Faz follow-up em lote para leads frios | "Tenho 80 leads parados há 30 dias. Quero mandar um email personalizado para todos de uma vez." |

---

## Análise de Gaps

| Gap | Impacto |
|-----|---------|
| Sem módulo de campanhas | Times usam ferramentas externas, fragmentando o funil |
| Sem editor de template visual | Criar email em HTML bruto é barreira para não-devs |
| Sem segmentação por filtros do CRM | Audiência não reflete estado real dos leads |
| Sem tracking por campanha | Impossível saber ROI da campanha no CRM |
| Tracking existe mas não é por campanha | Pixel/link atuais são transacionais, não de campanha |

---

## Épico: Email Campaigns

### Fase 1 — Criação e Envio (P0 — 2-3 semanas)

---

**Story EC-1.1 — Criação de Campanha com Editor de Blocos**

Como gestor, quero criar uma campanha de email com um editor visual de blocos (texto, imagem, botão, divisor) para enviar mensagens profissionais sem saber HTML.

*Requisitos funcionais:*
- Página `/app/campaigns` — listagem de campanhas com status e métricas básicas
- Botão "Nova Campanha" → wizard: Nome, Remetente, Assunto, Editor, Audiência, Agendar
- Editor de blocos (drag-and-drop simples): Text, Image (URL), Button, Divider, Spacer
- Merge tags no subject/body: `{{lead.name}}`, `{{lead.company}}`, `{{lead.email}}`
- Preview do email renderizado antes de enviar
- Envio de email de teste para email do usuário logado
- Status da campanha: `DRAFT` | `SCHEDULED` | `SENDING` | `SENT` | `PAUSED`

*Backend:* Novo model `Campaign` + `CampaignRecipient` no Prisma. Rotas `CRUD /api/v1/campaigns`. Envio via `emailMessagingService.sendEmail` em loop com rate limiting (max 100/min via BullMQ).

*Frontend:* `src/pages/Campaigns.tsx`, `src/pages/CampaignDetail.tsx`, `src/components/campaigns/BlockEditor.tsx`. Rota em `routes.tsx`.

**Nota sobre o editor de blocos:** Não usar lib de editor pesada (Unlayer, GrapeJS). Implementar editor simples próprio com `@dnd-kit/core` (já instalado para o pipeline) — lista de blocos draggable com preview HTML.

---

**Story EC-1.2 — Segmentação de Audiência e Agendamento**

Como gestor, quero selecionar quem receberá a campanha usando os filtros existentes do CRM, para enviar para a audiência certa.

*Requisitos funcionais:*
- Passo "Audiência" no wizard: escolher via filtros (usa lógica do FilterBuilder UX-2.1)
- Filtros disponíveis: status, tag, responsável, source, score, última interação (antes de / depois de), sem interação há N dias
- Preview da audiência: "X leads selecionados" com amostra de 5 nomes
- Excluir leads com `unsubscribed = true` automaticamente
- Passo "Agendamento": Enviar agora | Agendar para (datetime picker)
- Agendamento via BullMQ delay

*Backend:* `GET /api/v1/campaigns/:id/preview-audience` — aplica filtros e retorna count + sample. `POST /api/v1/campaigns/:id/schedule` — enfileira job de envio.

---

### Fase 2 — Tracking e Relatório (P1 — 1-2 semanas)

---

**Story EC-2.1 — Tracking de Abertura e Clique por Campanha**

Como gestor, quero saber quais leads abriram meu email e clicaram em links, para medir engajamento.

*Requisitos funcionais:*
- Pixel de abertura: imagem 1×1 em cada email com URL única por `(campaignId, leadId)`
- Link tracking: cada URL no corpo substituída por link de redirecionamento `GET /api/v1/track/campaign-click/:token`
- Registro em `CampaignEvent`: `OPENED` | `CLICKED` | `BOUNCED` | `UNSUBSCRIBED`
- Unsubscribe: link no rodapé de todo email → `GET /api/v1/track/unsubscribe/:token` → seta `lead.unsubscribed = true`
- `BOUNCED`: webhook Resend/SendGrid via `webhooks.ts` existente mapeia bounce → `CampaignEvent`

*Backend:* `GET /api/v1/track/campaign-open/:token` (pixel), `GET /api/v1/track/campaign-click/:token` (redirect). Novo model `CampaignEvent`. Rota `track/campaign-*` adicionada à lista pública (sem auth, sem CSRF).

---

**Story EC-2.2 — Dashboard de Resultados de Campanha**

Como gestor, quero ver open rate, CTR e conversões de cada campanha para medir o ROI.

*Requisitos funcionais:*
- Aba "Resultados" em `CampaignDetail` — disponível após campanha enviada
- Métricas: Enviados, Entregues, Abertos (unique), Cliques (unique), Descadastros, Bounces
- Taxa de abertura (%), CTR (%), Taxa de descadastro (%)
- Tabela de destinatários: nome, email, status (enviado/aberto/clicado/descadastrado), data de abertura
- Gráfico de aberturas por hora nas primeiras 48h (Recharts — já instalado)
- Botão "Exportar CSV" — lista de destinatários + eventos

*Backend:* `GET /api/v1/campaigns/:id/stats` — agrega `CampaignEvent` por tipo.

*Frontend:* `src/components/campaigns/CampaignStats.tsx` — cards de métricas + tabela + gráfico.

---

## Modelo de Dados

```prisma
model Campaign {
  id          String         @id @default(uuid())
  tenantId    String
  tenant      Tenant         @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  subject     String
  fromName    String
  fromEmail   String
  bodyBlocks  Json           // Array de blocos do editor
  bodyHtml    String?        // HTML compilado (cache)
  status      CampaignStatus @default(DRAFT)
  scheduledAt DateTime?
  sentAt      DateTime?
  createdBy   String
  user        User           @relation(fields: [createdBy], references: [id])
  recipients  CampaignRecipient[]
  events      CampaignEvent[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@index([tenantId, status])
  @@index([tenantId, createdAt])
}

model CampaignRecipient {
  id         String          @id @default(uuid())
  campaignId String
  campaign   Campaign        @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  leadId     String
  lead       Lead            @relation(fields: [leadId], references: [id], onDelete: Cascade)
  token      String          @unique @default(uuid())
  status     RecipientStatus @default(PENDING)
  sentAt     DateTime?

  @@index([campaignId])
  @@index([leadId])
}

model CampaignEvent {
  id         String        @id @default(uuid())
  campaignId String
  campaign   Campaign      @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  leadId     String
  lead       Lead          @relation(fields: [leadId], references: [id], onDelete: Cascade)
  type       CampaignEventType
  url        String?       // para CLICKED
  createdAt  DateTime      @default(now())

  @@index([campaignId, type])
}

enum CampaignStatus    { DRAFT SCHEDULED SENDING SENT PAUSED CANCELLED }
enum RecipientStatus   { PENDING SENT BOUNCED UNSUBSCRIBED }
enum CampaignEventType { OPENED CLICKED BOUNCED UNSUBSCRIBED }
```

Campos a adicionar em `Lead`:
```prisma
unsubscribed     Boolean   @default(false)
unsubscribedAt   DateTime?
```

---

## Requisitos Não-Funcionais

- Envio em lote: máximo 100 emails/min por tenant (BullMQ + rate limiting)
- Pixel de abertura: rota pública sem auth, sem CSRF (`/api/v1/track/campaign-*`)
- Merge tags: sanitizar HTML antes de enviar (evitar XSS em conteúdo do template)
- Unsubscribe: deve funcionar sem autenticação (link público com token único)
- LGPD: unsubscribe remove o lead de todas as futuras campanhas automaticamente

---

## Métricas de Sucesso

| Métrica | Meta |
|---------|------|
| Campanhas criadas / tenant / mês (após 30 dias de uso) | > 2 |
| Open rate médio das campanhas | > 20% |
| % de tenants que usam agendamento | > 40% |
| Taxa de erro de envio | < 2% |
