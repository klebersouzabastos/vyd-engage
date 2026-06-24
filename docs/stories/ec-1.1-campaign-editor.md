# Story: Criação de Campanha com Editor de Blocos

**Story ID:** EC-1.1  
**Epic:** EPIC-EMAIL-CAMPAIGNS  
**Tipo:** Feature  
**Prioridade:** P0  
**Pontos:** 13  
**Sprint:** 1  
**Fase:** 1 — Criação e Envio  
**Dependências:** `RESEND_API_KEY` ou `SMTP_*` configurados; nenhuma story anterior  
**Desbloqueia:** EC-1.2, EC-2.1, EC-2.2  
**Status:** Draft

---

## Descrição

Como usuário do VYD Engage, quero criar campanhas de email com um editor visual de blocos (similar ao Mailchimp), salvar como rascunho e enviar para um grupo de leads, para substituir ferramentas externas de email marketing e ter o engajamento ligado diretamente ao meu CRM.

---

## Acceptance Criteria

### AC-1: Listagem de Campanhas
- [ ] Nova página `/app/campaigns` com listagem de campanhas: nome | status | enviados | abertura | data
- [ ] Botão "Nova Campanha" abre formulário/editor
- [ ] Filtros: status (Rascunho / Agendada / Enviada)

### AC-2: Editor de Blocos
- [ ] Editor com blocos disponíveis: Texto, Imagem (URL), Botão (CTA), Divisor, Espaçador
- [ ] Cada bloco: drag para reordenar, botão de editar (abre painel de propriedades), botão de remover
- [ ] Painel de propriedades por bloco:
  - Texto: conteúdo (textarea), tamanho de fonte, alinhamento, cor
  - Imagem: URL, alt text, largura
  - Botão: texto, URL destino, cor de fundo
- [ ] Preview em tempo real ao lado do editor (desktop e mobile preview)
- [ ] Salvar rascunho a qualquer momento (auto-save a cada 30s)

### AC-3: Campos da Campanha
- [ ] Formulário: nome da campanha (obrigatório), assunto do email (obrigatório), nome do remetente, email do remetente (validado)
- [ ] Merge tags disponíveis: `{{lead.name}}`, `{{lead.company}}`, `{{unsubscribe_link}}` (inserção por click)
- [ ] `{{unsubscribe_link}}` obrigatório no rodapé (validação antes de envio)

### AC-4: Backend — Modelos e Rotas
- [ ] Migração Prisma: `Campaign`, `CampaignRecipient`, `CampaignEvent`
- [ ] `POST /api/v1/campaigns` — criar campanha
- [ ] `PUT /api/v1/campaigns/:id` — atualizar rascunho
- [ ] `GET /api/v1/campaigns` — listar (paginado)
- [ ] `GET /api/v1/campaigns/:id` — detalhe
- [ ] `POST /api/v1/campaigns/:id/send` — envio imediato

### AC-5: Envio Real de Email
- [ ] `POST /campaigns/:id/send` valida: assunto preenchido, `{{unsubscribe_link}}` presente no HTML, status = DRAFT
- [ ] Converte blocos em HTML (template responsivo simples)
- [ ] Envia via `emailService.ts` existente (Resend ou SMTP)
- [ ] Replace de merge tags antes do envio por lead
- [ ] Após envio: `Campaign.status = SENT`, `Campaign.sentAt = now()`

---

## Dev Notes

### Modelo Prisma

```prisma
model Campaign {
  id          String         @id @default(cuid())
  tenantId    String
  name        String
  subject     String
  fromName    String?
  fromEmail   String?
  content     Json           // Array de blocos
  status      CampaignStatus @default(DRAFT)
  sentAt      DateTime?
  scheduledAt DateTime?
  createdById String
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  recipients  CampaignRecipient[]
  events      CampaignEvent[]
  tenant      Tenant         @relation(fields: [tenantId], references: [id])

  @@index([tenantId, status])
}

model CampaignRecipient {
  id         String          @id @default(cuid())
  campaignId String
  leadId     String
  status     RecipientStatus @default(PENDING)
  sentAt     DateTime?

  campaign   Campaign        @relation(fields: [campaignId], references: [id])
  lead       Lead            @relation(fields: [leadId], references: [id])
}

model CampaignEvent {
  id         String            @id @default(cuid())
  campaignId String
  leadId     String?
  type       CampaignEventType
  metadata   Json?
  occurredAt DateTime          @default(now())

  campaign   Campaign          @relation(fields: [campaignId], references: [id])
}

enum CampaignStatus { DRAFT SCHEDULED SENDING SENT PAUSED CANCELLED }
enum RecipientStatus { PENDING SENT BOUNCED UNSUBSCRIBED }
enum CampaignEventType { OPENED CLICKED BOUNCED UNSUBSCRIBED }
```

### Conversão de blocos para HTML

```typescript
// server/src/services/campaignService.ts
function blocksToHtml(blocks: Block[]): string {
  const body = blocks.map(block => {
    switch (block.type) {
      case 'text': return `<p style="font-size:${block.fontSize}px;text-align:${block.align}">${block.content}</p>`
      case 'image': return `<img src="${block.url}" alt="${block.alt}" style="max-width:${block.width ?? '100%'}">`
      case 'button': return `<a href="${block.url}" style="background:${block.bg};color:#fff;padding:12px 24px;text-decoration:none">${block.text}</a>`
      case 'divider': return `<hr style="border:1px solid #eee">`
      case 'spacer': return `<div style="height:${block.height ?? 20}px"></div>`
      default: return ''
    }
  }).join('\n')
  return `<div style="max-width:600px;margin:0 auto;font-family:sans-serif">${body}</div>`
}
```

### Unsubscribe link

```typescript
// Replace antes de envio por lead
const html = template.replace('{{unsubscribe_link}}',
  `${process.env.EXTERNAL_BASE_URL}/unsubscribe/${campaignRecipient.id}`)
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/prisma/schema.prisma` | MODIFICAR — Campaign, CampaignRecipient, CampaignEvent |
| `server/src/routes/campaigns.ts` | CRIAR |
| `server/src/services/campaignService.ts` | CRIAR |
| `server/src/index.ts` | MODIFICAR — montar /campaigns + CSRF whitelist |
| `src/pages/Campaigns.tsx` | CRIAR — listagem |
| `src/pages/CampaignEditor.tsx` | CRIAR — editor de blocos |
| `src/components/campaigns/BlockEditor.tsx` | CRIAR — editor drag-and-drop |
| `src/components/campaigns/BlockProperties.tsx` | CRIAR — painel de propriedades |
| `src/utils/routes.tsx` | MODIFICAR — rotas /app/campaigns |

---

## Riscos

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Editor drag-and-drop complexo | Alta | Médio | Usar `@dnd-kit/core` (já pode estar no projeto) ou implementar com mouse events básicos |
| HTML de email não compatível com clientes de email | Média | Médio | Usar inline CSS; testar no Litmus ou similar |
| Rate limit Resend em envios grandes | Baixa | Alto | Envio em lotes de 50/min via BullMQ (EC-1.2) |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Migração Prisma + rotas backend | 3h |
| campaignService (envio + HTML) | 2h |
| Frontend: Campaigns page + editor | 5h |
| Frontend: preview + drag-and-drop | 2h |
| Integração + testes | 1h |
| **Total** | **~13h** |

---

## Verificação E2E

1. Criar campanha → editor abre com bloco de texto inicial
2. Adicionar bloco Botão → painel de propriedades aparece → CTA configurado
3. Preview mostra layout correto em desktop e mobile
4. Salvar rascunho → campanha aparece na listagem com status "Rascunho"
5. Enviar para 1 lead de teste → email chega com merge tags substituídas e link de unsubscribe

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
