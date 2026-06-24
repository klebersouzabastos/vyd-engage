# Story: Tracking de Abertura e Clique por Campanha

**Story ID:** EC-2.1  
**Epic:** EPIC-EMAIL-CAMPAIGNS  
**Tipo:** Feature  
**Prioridade:** P1  
**Pontos:** 5  
**Sprint:** 2  
**Fase:** 2 — Tracking e Resultados  
**Dependências:** EC-1.1 completa (`Campaign`, `CampaignEvent` models)  
**Desbloqueia:** EC-2.2  
**Status:** Draft

---

## Descrição

Como usuário, quero saber quais leads abriram meu email e quais clicaram em links, para avaliar o engajamento da campanha e identificar leads com interesse mais alto para follow-up prioritário.

---

## Acceptance Criteria

### AC-1: Pixel de Abertura
- [ ] Ao gerar o HTML final do email, inserir `<img src="{EXTERNAL_BASE_URL}/track/open/{recipientId}" width="1" height="1">` no rodapé
- [ ] `GET /track/open/:recipientId` — rota pública (sem auth, sem CSRF)
- [ ] Retorna 1x1 GIF transparente (base64 inline ou arquivo estático)
- [ ] Cria `CampaignEvent { type: OPENED, campaignId, leadId }` — apenas o primeiro clique conta (idempotente)
- [ ] Atualiza `CampaignRecipient.openedAt = now()` na primeira abertura

### AC-2: Tracking de Cliques
- [ ] Botões/links no email com URL configurada pelo usuário são reescritos para `{EXTERNAL_BASE_URL}/track/click/{recipientId}/{encodedUrl}`
- [ ] `GET /track/click/:recipientId/:encodedUrl` — rota pública
- [ ] Cria `CampaignEvent { type: CLICKED, campaignId, leadId, metadata: { url } }`
- [ ] Faz redirect 302 para a URL original
- [ ] Mesmo link clicado N vezes → N eventos (contagem de cliques real)

### AC-3: Dados por Recipient
- [ ] `GET /api/v1/campaigns/:id/recipients` — lista recipients com `openedAt`, `clickedAt`, `status`
- [ ] Ordenaável por abertura, clique, status

### AC-4: Webhook de Bounce (Resend)
- [ ] Resend envia webhook quando email é rejeitado/bounceado
- [ ] `POST /webhooks/resend` (existente) → caso type = `email.bounced`: setar `CampaignRecipient.status = BOUNCED`
- [ ] Criar `CampaignEvent { type: BOUNCED }`

---

## Dev Notes

### Pixel de abertura (1x1 GIF)

```typescript
// server/src/routes/tracking.ts (ou index.ts public routes)
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

app.get('/track/open/:recipientId', async (req, res) => {
  const { recipientId } = req.params
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: recipientId },
    select: { id: true, campaignId: true, leadId: true, openedAt: true }
  })

  if (recipient && !recipient.openedAt) {
    await Promise.all([
      prisma.campaignRecipient.update({ where: { id: recipientId }, data: { openedAt: new Date() } }),
      prisma.campaignEvent.create({ data: { campaignId: recipient.campaignId, leadId: recipient.leadId, type: 'OPENED' } })
    ])
  }

  res.writeHead(200, { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' })
  res.end(TRANSPARENT_GIF)
})
```

### Redirect de clique

```typescript
app.get('/track/click/:recipientId/:encodedUrl', async (req, res) => {
  const url = Buffer.from(req.params.encodedUrl, 'base64url').toString()
  const recipient = await prisma.campaignRecipient.findUnique({ where: { id: req.params.recipientId } })

  if (recipient) {
    await prisma.campaignEvent.create({
      data: {
        campaignId: recipient.campaignId,
        leadId: recipient.leadId,
        type: 'CLICKED',
        metadata: { url }
      }
    })
  }

  res.redirect(302, url)
})
```

### Reescrita de links ao enviar

```typescript
// campaignService.ts
function rewriteLinksForTracking(html: string, recipientId: string): string {
  return html.replace(/href="([^"]+)"/g, (_, url) => {
    if (url.startsWith('mailto:') || url.includes('/unsubscribe/')) return `href="${url}"`
    const encoded = Buffer.from(url).toString('base64url')
    return `href="${process.env.EXTERNAL_BASE_URL}/track/click/${recipientId}/${encoded}"`
  })
}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/src/index.ts` | MODIFICAR — rotas públicas /track/open, /track/click |
| `server/src/services/campaignService.ts` | MODIFICAR — rewriteLinksForTracking() + injetar pixel |
| `server/src/routes/campaigns.ts` | MODIFICAR — GET /campaigns/:id/recipients |
| `server/src/routes/webhooks.ts` | MODIFICAR — lidar com email.bounced do Resend |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Backend: pixel open + redirect click | 2h |
| Backend: reescrita de links no envio | 1h |
| Backend: endpoint recipients + webhook bounce | 1h |
| Testes de integração | 1h |
| **Total** | **~5h** |

---

## Verificação E2E

1. Enviar campanha de teste para email real → abrir email → evento OPENED criado no banco
2. Clicar em link do email → redirect para URL correta → evento CLICKED criado
3. Mesmo email aberto 2x → só 1 evento OPENED (idempotente)
4. Mesmo link clicado 2x → 2 eventos CLICKED (counting correto)
5. `GET /api/v1/campaigns/:id/recipients` retorna `openedAt` preenchido

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
