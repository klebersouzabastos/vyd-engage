# Story: Deduplicação e Preview antes de Importar

**Story ID:** IMP-1.2  
**Epic:** EPIC-IMPORT-PRO  
**Tipo:** Feature  
**Prioridade:** P0  
**Pontos:** 5  
**Sprint:** 1  
**Fase:** 1 — Leads (paralelo com IMP-1.1)  
**Dependências:** IMP-1.1 (endpoint `dry_run` deve existir)  
**Desbloqueia:** Adoção segura do Import Pro  
**Status:** Draft

---

## Descrição

Como administrador, quero ver uma prévia do que será importado — incluindo quantos leads serão criados, quais serão ignorados por duplicata e quais têm erros de validação — antes de confirmar a importação, para não poluir minha base com dados duplicados ou incorretos.

---

## Acceptance Criteria

### AC-1: Preview Dry-Run
- [ ] Após mapeamento (etapa final de IMP-1.1), antes do botão "Confirmar Importação", exibir tela de resumo
- [ ] Tela exibe 3 contadores: ✅ Novos (serão criados), ⚠️ Duplicatas (serão ignorados), ❌ Erros (linha inválida)
- [ ] Carregada via `POST /api/v1/import/leads?dry_run=true`
- [ ] Linhas de erro mostradas em tabela: linha # | campo | valor | motivo

### AC-2: Detecção de Duplicatas
- [ ] Duplicata detectada se já existe lead com mesmo `email` no tenant (case-insensitive)
- [ ] Se `email` não foi mapeado: duplicata detectada por `name` + `phone` (ambos devem bater)
- [ ] Lead duplicado não é criado; contado em "Duplicatas ignoradas"
- [ ] Opção "Atualizar duplicatas em vez de ignorar" (checkbox) — se marcado, campos não-nulos do arquivo sobrescrevem o existente

### AC-3: Erros de Validação por Linha
- [ ] `name` vazio → erro "Nome obrigatório"
- [ ] `email` com formato inválido → erro "Email inválido"
- [ ] `phone` com menos de 8 dígitos → erro "Telefone inválido"
- [ ] Linha com todos os campos mapeados vazios → erro "Linha vazia"
- [ ] Erros não impedem a importação — apenas as linhas com erro são puladas

### AC-4: Confirmação Final
- [ ] Botão "Confirmar Importação" visível e habilitado no resumo
- [ ] Texto do botão: "Importar X leads" (apenas novos + duplicatas marcadas para atualizar)
- [ ] Ao confirmar: chama `POST /api/v1/import/leads` sem `dry_run`
- [ ] Progress bar durante importação real

---

## Dev Notes

### Lógica de dedup no backend

```typescript
// importService.ts
async function findDuplicate(tenantId: string, row: MappedRow) {
  if (row.email) {
    return prisma.lead.findFirst({
      where: { tenantId, email: { equals: row.email, mode: 'insensitive' } }
    })
  }
  if (row.name && row.phone) {
    return prisma.lead.findFirst({
      where: { tenantId, name: row.name, phone: row.phone }
    })
  }
  return null
}
```

### Resposta dry_run

```typescript
interface DryRunResponse {
  total: number
  toCreate: number
  duplicates: number
  errors: number
  errorDetails: { line: number; field: string; value: string; reason: string }[]
  duplicateDetails: { line: number; existingId: string; matchedBy: 'email' | 'name+phone' }[]
}
```

### Atualização de duplicatas

```typescript
if (updateDuplicates && duplicate) {
  await prisma.lead.update({
    where: { id: duplicate.id },
    data: pickNonNull(mappedRow) // só campos não-nulos sobrescrevem
  })
  result.updated++
}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/src/services/importService.ts` | MODIFICAR — adicionar dedup + dry_run |
| `src/components/import/ImportSummary.tsx` | CRIAR — tela de resumo dry_run |
| `src/components/import/ErrorTable.tsx` | CRIAR — tabela de erros de validação |

---

## Riscos

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Base com 10k leads e 10k importações → dedup lento | Baixa | Alto | Índice `(tenantId, email)` no Prisma schema |
| Atualização de duplicatas sobrescrevendo dados bons | Média | Médio | Atualização opt-in (checkbox desligado por padrão) |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Backend: dedup + dry_run no importService | 2h |
| Frontend: ImportSummary + ErrorTable | 2h |
| Integração + testes | 1h |
| **Total** | **~5h** |

---

## Verificação E2E

1. Upload CSV com 10 leads (3 já existem no sistema, 1 com email inválido)
2. Tela de resumo mostra: ✅ 6 novos, ⚠️ 3 duplicatas, ❌ 1 erro
3. Erros mostram a linha e o motivo
4. Confirmar sem marcar "atualizar" → 6 criados, 3 ignorados
5. Repetir com "atualizar duplicatas" → 6 criados, 3 atualizados

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
