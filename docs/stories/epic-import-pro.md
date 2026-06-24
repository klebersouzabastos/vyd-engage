# Épico: Import Pro — Migração de Dados

**Epic ID:** EPIC-IMPORT-PRO  
**PRD:** [docs/prd/prd-import-pro.md](../prd/prd-import-pro.md)  
**Roadmap:** [docs/prd/prd-growth-roadmap.md](../prd/prd-growth-roadmap.md)  
**Prioridade:** P0  
**Status:** Planejado  
**Criado em:** 2026-06-23  
**Sequência:** 1º épico do Growth Roadmap

---

## Contexto

Desbloqueador de adoção: clientes com > 200 leads em outro CRM não migram sem ferramenta de importação. Esta feature é pré-requisito para todo onboarding comercial.

---

## Stories

### Fase 1 — Leads (Sprint 1, P0)

| Story | Título | Pts | Status | Paralelo com |
|-------|--------|-----|--------|-------------|
| [IMP-1.1](imp-1.1-csv-upload-mapping.md) | Upload CSV/Excel com Mapeamento de Campos | 8 | Draft | IMP-1.2 |
| [IMP-1.2](imp-1.2-dedup-preview.md) | Deduplicação e Preview antes de Importar | 5 | Draft | IMP-1.1 |

### Fase 2 — Deals e Histórico (Sprint 2, P1)

| Story | Título | Pts | Status | Dependência |
|-------|--------|-----|--------|------------|
| [IMP-2.1](imp-2.1-deals-interactions-import.md) | Importação de Deals e Histórico de Interações | 5 | Draft | IMP-1.1 completa |
| [IMP-2.2](imp-2.2-import-history-rollback.md) | Histórico e Rollback de Importações | 3 | Draft | IMP-1.1 completa |

---

## Grafo de Dependências

```
IMP-1.1 ─── IMP-1.2 (em paralelo, Sprint 1)
    │
    ├─── IMP-2.1 (Sprint 2, após IMP-1.1)
    └─── IMP-2.2 (Sprint 2, após IMP-1.1)
```

**Sprint 1 paralelo:** IMP-1.1 + IMP-1.2 (13 pts)  
**Sprint 2:** IMP-2.1 + IMP-2.2 (8 pts) — após Fase 1 completa

---

## Novos Arquivos Previstos

| Arquivo | Tipo |
|---------|------|
| `server/src/routes/import.ts` | Backend — rotas de importação |
| `server/src/services/importService.ts` | Backend — lógica de parsing + dedup |
| `server/src/jobs/importProcessor.ts` | Backend — processamento assíncrono BullMQ |
| `src/pages/Import.tsx` | Frontend — página principal |
| `src/components/import/ColumnMapper.tsx` | Frontend — mapeador de colunas |
| `src/components/import/ImportPreview.tsx` | Frontend — preview de dry_run |
| `src/components/import/ImportHistory.tsx` | Frontend — histórico e rollback |

## Migração Prisma necessária

```prisma
model ImportBatch { ... }
enum ImportType { LEADS DEALS INTERACTIONS }
enum ImportBatchStatus { PENDING PROCESSING COMPLETED FAILED ROLLED_BACK }
// Lead.importBatchId String?
// Deal.importBatchId String?
// Interaction.importBatchId String?
```

---

## Total

| Fase | Stories | Pontos |
|------|---------|--------|
| Fase 1 — Leads | 2 | 13 |
| Fase 2 — Deals+Histórico | 2 | 8 |
| **Total** | **4** | **21** |

---

## Próximos Passos

1. **@po (Pax)** — `*validate-story-draft` em IMP-1.1 e IMP-1.2
2. **@dev (Dex)** — Sprint 1: IMP-1.1 + IMP-1.2 em paralelo
3. **@qa (Quinn)** — QA gate por story
4. **@devops (Gage)** — push + PR após Sprint 1 done
5. **@dev (Dex)** — Sprint 2: IMP-2.1 + IMP-2.2
