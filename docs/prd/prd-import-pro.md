# PRD — Épico: Import Pro (Migração de Dados)

**Epic ID:** EPIC-IMPORT-PRO  
**Prioridade:** P0 (desbloqueio de adoção)  
**Duração estimada:** 3-4 semanas  
**Sequência no Roadmap:** 1 de 4

---

## Contexto

Nenhum cliente migra de CRM sem uma ferramenta de importação confiável. Hoje, entrar no VYD Engage exige digitação manual ou uso de scripts ad-hoc — o que elimina o VYD da avaliação de empresas com > 200 leads já cadastrados em outro sistema.

Esta é a feature de menor glamour e maior impacto em conversão de novos clientes.

---

## Personas

| Persona | Perfil | Dor Principal |
|---------|--------|---------------|
| **Administrador Migrando** | Gestor ou dev que está configurando o VYD para o time | "Tenho 1.500 leads no HubSpot. Preciso importar antes de treinar o time." |
| **Vendedor Iniciando** | Vai usar o VYD como principal CRM mas tem histórico em planilha | "Minha lista de prospectos está num Excel. Não vou digitar 400 contatos." |

---

## Análise de Gaps

| Gap | Impacto |
|-----|---------|
| Sem endpoint de importação em lote | Bloqueio total para migração |
| Sem UI de mapeamento de colunas | Usuário não sabe como formatar o CSV |
| Sem deduplicação | Re-importar cria duplicatas |
| Sem histórico de importações | Impossível reverter erros |
| Sem importação de deals/interações | Migração incompleta (só leads) |

---

## Épico: Import Pro

### Fase 1 — Leads (P0 — 2 semanas)

---

**Story IMP-1.1 — Upload CSV/Excel com Mapeamento de Campos**

Como administrador, quero fazer upload de um arquivo CSV ou Excel e mapear visualmente as colunas para os campos do VYD, para migrar minha base de leads.

*Requisitos funcionais:*
- Página `/app/settings/import` com uploader (drag-and-drop + clique)
- Suporte: `.csv` (UTF-8, separador vírgula ou ponto-e-vírgula), `.xlsx`
- Após upload: tabela de mapeamento de colunas — coluna do arquivo → campo do VYD
- Campos de destino disponíveis: `name`, `email`, `phone`, `company`, `position`, `source`, `notes`, `status`, custom fields
- Preview das primeiras 5 linhas com os valores mapeados
- Limite: 10.000 linhas por importação
- Backend: `POST /api/v1/import/leads` com multipart/form-data + JSON de mapeamento

*Backend:* Nova rota `server/src/routes/import.ts`. Parser CSV via `csv-parse` (já popular, MIT). Parser Excel via `xlsx` (ou `exceljs` já no bundle). Processamento em lote de 100 em 100 para não travar o event loop.

*Frontend:* `src/pages/Import.tsx` + `src/components/import/ColumnMapper.tsx`. Nova rota em `src/utils/routes.tsx` em `/app/settings/import`.

---

**Story IMP-1.2 — Deduplicação e Preview antes de Importar**

Como administrador, quero ver quais registros são duplicatas antes de confirmar a importação, para não poluir minha base.

*Requisitos funcionais:*
- Modo `dry_run=true` no endpoint — processa sem gravar, retorna análise
- Detecção de duplicatas por email (principal) e por telefone (secundário)
- Preview mostra: N novos, N duplicatas detectadas, N com erros de validação
- Para duplicatas: opções "Pular" ou "Atualizar existente"
- Para erros de validação: lista de linhas com problema e campo inválido
- Usuário confirma importação apenas após ver o preview

*Backend:* Parâmetro `dry_run` no endpoint IMP-1.1. Busca paralela de emails/phones existentes via `prisma.lead.findMany({ where: { email: { in: [...] } } })`.

---

### Fase 2 — Deals e Histórico (P1 — 1-2 semanas)

---

**Story IMP-2.1 — Importação de Deals e Histórico de Interações**

Como administrador, quero importar deals associados a leads para ter o pipeline completo após a migração.

*Requisitos funcionais:*
- Aba "Deals" na página de importação — CSV com: `lead_email`, `deal_name`, `value`, `stage`, `expected_close_date`
- Associação automática de deal ao lead pelo email
- Aba "Interações" — CSV com: `lead_email`, `type` (CALL/EMAIL/MEETING/NOTE), `date`, `notes`
- Validação: lead deve existir antes de importar deals/interações
- Erros de "lead não encontrado" listados no preview

*Backend:* `POST /api/v1/import/deals` e `POST /api/v1/import/interactions`.

---

**Story IMP-2.2 — Histórico e Rollback de Importações**

Como administrador, quero ver todas as importações realizadas e poder desfazer a última, para corrigir erros.

*Requisitos funcionais:*
- Seção "Histórico de Importações" na página — lista com: data, tipo, usuário, N registros, status
- Cada importação grava `importBatchId` (UUID) nos registros criados
- Rollback: botão "Desfazer" nas últimas 24h — deleta (soft delete) todos os registros do lote
- Status: `PENDING` → `PROCESSING` → `COMPLETED` | `FAILED` | `ROLLED_BACK`
- Limite: rollback disponível apenas para lotes das últimas 24h

*Backend:* Novo model `ImportBatch` no Prisma. Campo `importBatchId String?` em `Lead`, `Deal`, `Interaction`. Endpoint `DELETE /api/v1/import/batches/:batchId`.

---

## Requisitos Não-Funcionais

- Rate limit dedicado: 5 importações por hora por tenant
- Tamanho máximo do arquivo: 10MB
- Processamento assíncrono para arquivos > 500 linhas (resposta imediata com `batchId`, polling de status)
- Multi-tenancy: `tenantId` em `ImportBatch` e em todos os campos `importBatchId` linkados
- CSRF: rota autenticada → adicionar à whitelist em `index.ts`

---

## Modelo de Dados

```prisma
model ImportBatch {
  id          String            @id @default(uuid())
  tenantId    String
  tenant      Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userId      String
  user        User              @relation(fields: [userId], references: [id])
  type        ImportType        // LEADS | DEALS | INTERACTIONS
  status      ImportBatchStatus // PENDING | PROCESSING | COMPLETED | FAILED | ROLLED_BACK
  totalRows   Int               @default(0)
  importedRows Int              @default(0)
  errorRows   Int               @default(0)
  skippedRows Int               @default(0)
  errorLog    Json?             // Array de { row, field, message }
  rolledBackAt DateTime?
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@index([tenantId, createdAt])
}

enum ImportType        { LEADS DEALS INTERACTIONS }
enum ImportBatchStatus { PENDING PROCESSING COMPLETED FAILED ROLLED_BACK }
```

Campos a adicionar nos modelos existentes:
```prisma
// Lead, Deal, Interaction — adicionar:
importBatchId String?
```

---

## Métricas de Sucesso

| Métrica | Meta |
|---------|------|
| % de novos tenants que fazem importação nos primeiros 7 dias | > 60% |
| Tempo médio para importar 500 leads | < 60s |
| Taxa de erro de importação (linhas rejeitadas) | < 5% |
| NPS da feature de importação | > 4.0/5 |

---

## Verificação E2E

1. Fazer upload de CSV com 100 leads → dry_run mostra preview → confirmar → leads aparecem na lista
2. Re-importar o mesmo CSV → dry_run detecta 100 duplicatas → opção "Pular" → 0 duplicatas gravadas
3. Importar deals via CSV → deals aparecem no pipeline associados aos leads corretos
4. Ver histórico de importações → clicar "Desfazer" → leads do lote desaparecem (soft delete)
5. Arquivo com email inválido → preview lista erros de validação por linha
