# Story: Histórico e Rollback de Importações

**Story ID:** IMP-2.2  
**Epic:** EPIC-IMPORT-PRO  
**Tipo:** Feature  
**Prioridade:** P1  
**Pontos:** 3  
**Sprint:** 2  
**Fase:** 2 — Deals e Histórico  
**Dependências:** IMP-1.1 (`ImportBatch` model existente)  
**Status:** Draft

---

## Descrição

Como administrador, quero ver o histórico de todas as importações realizadas no tenant e poder desfazer uma importação específica (rollback), para corrigir erros de importação sem precisar deletar registros um a um.

---

## Acceptance Criteria

### AC-1: Aba de Histórico na Página de Importação
- [ ] Página `/app/settings/import` tem aba "Histórico" além de "Nova Importação"
- [ ] Lista de importações: data | tipo (Leads/Deals/Interações) | total | importados | erros | status | ações
- [ ] Status possíveis: Processando, Concluído, Concluído com erros, Revertido
- [ ] Ordenação: mais recente primeiro
- [ ] Paginação: 20 por página

### AC-2: Detalhe do Batch
- [ ] Clicar em um batch → modal ou drawer com:
  - Resumo (total, importados, erros, skipped)
  - Lista de erros (linhas + motivos)
  - Botão "Reverter esta importação" (só disponível se `status = COMPLETED` e não é `ROLLED_BACK`)

### AC-3: Rollback
- [ ] Botão "Reverter" → confirmação modal: "Esta ação deletará os X registros importados neste lote. Continuar?"
- [ ] Rollback deleta apenas registros com `importBatchId = batchId` (não afeta registros criados manualmente)
- [ ] `DELETE` em cascata: leads → deals vinculados ao lead importado, interações vinculadas
- [ ] Após rollback: `ImportBatch.status = ROLLED_BACK`, `rolledBackAt = now()`
- [ ] Toast: "Importação revertida — X registros removidos"

### AC-4: Backend
- [ ] `GET /api/v1/import/batches` — lista batches do tenant (paginado)
- [ ] `GET /api/v1/import/batches/:id` — detalhe + lista de erros
- [ ] `DELETE /api/v1/import/batches/:id` — executa rollback
- [ ] Rollback só permitido se `status = COMPLETED` (guard no controller)

---

## Dev Notes

### Model ImportBatch (migração Prisma)

```prisma
model ImportBatch {
  id           String             @id @default(cuid())
  tenantId     String
  type         ImportType
  status       ImportBatchStatus  @default(PENDING)
  fileName     String
  totalRows    Int                @default(0)
  imported     Int                @default(0)
  errors       Int                @default(0)
  skipped      Int                @default(0)
  errorDetails Json?
  rolledBackAt DateTime?
  createdAt    DateTime           @default(now())
  createdBy    String

  tenant       Tenant             @relation(fields: [tenantId], references: [id])

  @@index([tenantId, createdAt])
}

enum ImportType { LEADS DEALS INTERACTIONS }
enum ImportBatchStatus { PENDING PROCESSING COMPLETED FAILED ROLLED_BACK }
```

### Lead/Deal models — adicionar campo

```prisma
// Lead
importBatchId String?
importBatch   ImportBatch? @relation(fields: [importBatchId], references: [id])

// Deal
importBatchId String?
// Interaction — idem
```

### Rollback endpoint

```typescript
router.delete('/batches/:id', authenticate, tenantScope, async (req, res) => {
  const batch = await prisma.importBatch.findFirst({
    where: { id: req.params.id, tenantId: req.user.tenantId }
  })
  if (!batch || batch.status !== 'COMPLETED') return res.status(400).json({ error: 'Rollback não permitido' })

  const [leads, deals, interactions] = await Promise.all([
    prisma.lead.deleteMany({ where: { importBatchId: batch.id, tenantId: req.user.tenantId } }),
    prisma.deal.deleteMany({ where: { importBatchId: batch.id, tenantId: req.user.tenantId } }),
    prisma.interaction.deleteMany({ where: { importBatchId: batch.id, tenantId: req.user.tenantId } }),
  ])

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: { status: 'ROLLED_BACK', rolledBackAt: new Date() }
  })

  res.json({ deleted: leads.count + deals.count + interactions.count })
})
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/prisma/schema.prisma` | MODIFICAR — modelo ImportBatch + campos importBatchId |
| `server/src/routes/import.ts` | MODIFICAR — GET /batches, GET /batches/:id, DELETE /batches/:id |
| `src/components/import/ImportHistory.tsx` | CRIAR — lista de batches |
| `src/components/import/BatchDetail.tsx` | CRIAR — modal de detalhe + rollback |
| `src/pages/Import.tsx` | MODIFICAR — adicionar aba Histórico |

---

## Riscos

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Rollback deletando registros que o usuário editou após importar | Média | Alto | Rollback deleta pelo `importBatchId`, não pelo conteúdo — usuário é avisado no modal |
| Cascade delete quebrando FKs | Baixa | Alto | Prisma cuida das FKs; ordem: interactions → deals → leads |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Migração Prisma + campos importBatchId | 1h |
| Backend: endpoints de histórico + rollback | 1h |
| Frontend: ImportHistory + BatchDetail | 1h |
| **Total** | **~3h** |

---

## Verificação E2E

1. Fazer importação de 5 leads → aparece no Histórico com status "Concluído"
2. Clicar no batch → detalhe mostra resumo e erros
3. Clicar "Reverter" → confirmar → toast "5 registros removidos"
4. Leads somem da listagem
5. Batch aparece como "Revertido" no histórico
6. Botão "Reverter" desaparece para batches já revertidos

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
