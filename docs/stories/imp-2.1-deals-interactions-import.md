# Story: Importação de Deals e Histórico de Interações

**Story ID:** IMP-2.1  
**Epic:** EPIC-IMPORT-PRO  
**Tipo:** Feature  
**Prioridade:** P1  
**Pontos:** 5  
**Sprint:** 2  
**Fase:** 2 — Deals e Histórico  
**Dependências:** IMP-1.1 (rota `/import` existente, `ImportBatch` model)  
**Status:** Draft

---

## Descrição

Como administrador migrando de outro CRM, quero importar deals (oportunidades) e histórico de interações (emails, ligações, reuniões) associados aos leads, para ter o contexto completo da carteira de clientes no VYD Engage desde o primeiro dia.

---

## Acceptance Criteria

### AC-1: Seletor de Tipo de Importação
- [ ] Na página `/app/settings/import`, dropdown "Tipo de Importação": Leads | Deals | Interações
- [ ] Ao selecionar "Deals": campos de mapeamento disponíveis = `leadEmail` (obrigatório para vincular), `name`, `stage`, `value`, `probability`, `expectedCloseDate`, `funnelName`
- [ ] Ao selecionar "Interações": campos = `leadEmail` (obrigatório), `type` (EMAIL/CALL/MEETING/NOTE), `content`, `occurredAt`, `direction` (INBOUND/OUTBOUND)

### AC-2: Vinculação com Lead Existente
- [ ] Deal importado deve ter `leadId` preenchido — lookup por `leadEmail` no tenant
- [ ] Se `leadEmail` não encontrar lead existente → linha marcada como erro "Lead não encontrado"
- [ ] Interação segue mesma lógica de vinculação via `leadEmail`

### AC-3: Mapeamento de Stage/Funnel
- [ ] `stage` mapeado para valores válidos: NEW, CONTACTED, PROPOSAL, NEGOTIATION, WON, LOST
- [ ] `funnelName`: se informado, vincula ao funil pelo nome (busca case-insensitive no tenant); se não encontrado → usa funil default do tenant
- [ ] Se `stage` não mapeado ou valor inválido → usa `NEW`

### AC-4: Backend — Endpoints
- [ ] `POST /api/v1/import/deals` — multipart com file + mapping + dry_run
- [ ] `POST /api/v1/import/interactions` — multipart com file + mapping + dry_run
- [ ] Mesmo padrão de resposta de IMP-1.1: `{ batchId, total, imported, errors, skipped }`
- [ ] `ImportBatch.type` = `DEALS` ou `INTERACTIONS`

### AC-5: Feedback e Preview
- [ ] Dry-run disponível para ambos os tipos (mesma lógica de IMP-1.2)
- [ ] Toast e link para relatório de erros após importação real

---

## Dev Notes

### Rota de deals

```typescript
// server/src/routes/import.ts (adicionar)
router.post('/deals', authenticate, tenantScope, uploadLimiter, upload.single('file'), async (req, res) => {
  const { mapping, updateDuplicates } = JSON.parse(req.body.options ?? '{}')
  const dryRun = req.query.dry_run === 'true'
  const result = await importService.importDeals(req.user.tenantId, req.file!.buffer, mapping, { dryRun })
  res.json(result)
})
```

### Lookup de lead por email

```typescript
async function resolveLead(tenantId: string, leadEmail: string) {
  return prisma.lead.findFirst({
    where: { tenantId, email: { equals: leadEmail, mode: 'insensitive' } },
    select: { id: true }
  })
}
```

### Mapeamento de stage

```typescript
const STAGE_MAP: Record<string, string> = {
  'novo': 'NEW', 'new': 'NEW', 'lead': 'NEW',
  'contatado': 'CONTACTED', 'contacted': 'CONTACTED',
  'proposta': 'PROPOSAL', 'proposal': 'PROPOSAL',
  'negociação': 'NEGOTIATION', 'negotiation': 'NEGOTIATION',
  'ganho': 'WON', 'won': 'WON', 'fechado': 'WON',
  'perdido': 'LOST', 'lost': 'LOST',
}
const normalizeStage = (v: string) => STAGE_MAP[v.toLowerCase().trim()] ?? 'NEW'
```

### Interações — tipos válidos

```typescript
const INTERACTION_TYPES = ['EMAIL', 'CALL', 'MEETING', 'NOTE', 'WHATSAPP']
const DIRECTIONS = ['INBOUND', 'OUTBOUND']
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/src/routes/import.ts` | MODIFICAR — adicionar endpoints /deals e /interactions |
| `server/src/services/importService.ts` | MODIFICAR — importDeals() e importInteractions() |
| `src/pages/Import.tsx` | MODIFICAR — dropdown de tipo de importação |
| `src/components/import/ColumnMapper.tsx` | MODIFICAR — campos dinâmicos por tipo |

---

## Riscos

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Email não normalizado → lead não encontrado | Alta | Médio | Lookup case-insensitive |
| Stage inválido silencioso | Média | Baixo | Fallback para NEW + aviso no dry_run |
| Funil não encontrado | Baixa | Médio | Usar funil default (primeiro funil do tenant) |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Backend: endpoints + importDeals/Interactions | 2h |
| Backend: lookup de lead, stage, funil | 1h |
| Frontend: dropdown tipo + campos dinâmicos | 1h |
| Testes e integração | 1h |
| **Total** | **~5h** |

---

## Verificação E2E

1. Importar CSV de deals com colunas: email_lead, nome_deal, etapa, valor → deals criados e vinculados aos leads corretos
2. Email de lead inexistente → linha aparece no relatório de erros
3. `stage = "ganho"` → deal criado com `stage = WON`
4. Importar interações (chamadas) → interações visíveis na timeline do lead

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
