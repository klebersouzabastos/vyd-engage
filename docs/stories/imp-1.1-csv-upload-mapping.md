# Story: Upload CSV/Excel com Mapeamento de Campos

**Story ID:** IMP-1.1  
**Epic:** EPIC-IMPORT-PRO  
**Tipo:** Feature  
**Prioridade:** P0  
**Pontos:** 8  
**Sprint:** 1  
**Fase:** 1 — Leads (paralelo com IMP-1.2)  
**Dependências:** Nenhuma  
**Desbloqueia:** IMP-1.2, IMP-2.1, IMP-2.2  
**Status:** Draft

---

## Descrição

Como administrador do VYD Engage, quero fazer upload de um arquivo CSV ou Excel com minha lista de leads e mapear visualmente as colunas do arquivo para os campos do CRM, para migrar minha base de contatos sem precisar formatar manualmente o arquivo.

**Problema:** Hoje não existe ferramenta de importação. Clientes com bases existentes (HubSpot, RD Station, planilha) precisam digitar um a um ou escrever scripts.

---

## Acceptance Criteria

### AC-1: Upload de Arquivo
- [ ] Página `/app/settings/import` acessível via menu Configurações
- [ ] Uploader aceita `.csv` e `.xlsx` por drag-and-drop ou clique
- [ ] Tamanho máximo: 10MB (erro amigável se exceder)
- [ ] Limit de linhas: 10.000 por importação (erro amigável se exceder)
- [ ] CSV: suporta separador vírgula (`,`) e ponto-e-vírgula (`;`) — autodetecção
- [ ] CSV: suporta encoding UTF-8 e Latin-1 (autodetecção via BOM ou fallback)
- [ ] Loading state durante parsing inicial do arquivo

### AC-2: Mapeamento de Colunas
- [ ] Após upload: exibe tabela de mapeamento — cada linha = uma coluna do arquivo
- [ ] Coluna do arquivo (read-only) | seta | dropdown de campo de destino no VYD
- [ ] Campos de destino disponíveis: `name` (obrigatório), `email`, `phone`, `company`, `position`, `source`, `notes`, `status`, custom fields do tenant
- [ ] Auto-mapeamento por nome similar: coluna "nome" → `name`, "e-mail" → `email`, etc.
- [ ] Campo marcado como "Ignorar coluna" para colunas que não devem ser importadas
- [ ] `name` obrigatório — botão "Próximo" desabilitado se não mapeado

### AC-3: Preview
- [ ] Abaixo do mapeamento: tabela com as primeiras 5 linhas mostrando valores com o mapeamento aplicado
- [ ] Colunas ignoradas não aparecem no preview
- [ ] Valores inválidos destacados em vermelho (ex: email sem @)

### AC-4: Backend — Endpoint
- [ ] `POST /api/v1/import/leads` — multipart/form-data com `file` + `mapping` (JSON)
- [ ] Parâmetro `dry_run=true` na query → processa sem gravar (usado em IMP-1.2)
- [ ] Processamento em lotes de 100 linhas (não bloqueia event loop)
- [ ] Resposta com `batchId`, `total`, `imported`, `errors`, `skipped`
- [ ] Rota autenticada (JWT) + registrada na whitelist CSRF de `index.ts`

### AC-5: Feedback pós-importação
- [ ] Toast de sucesso: "X leads importados com sucesso"
- [ ] Se houver erros: "X importados, Y com erro — ver relatório"
- [ ] Link para relatório de erros (lista de linhas + campo + mensagem)

---

## Dev Notes

### Dependências a instalar

```bash
cd server
npm install csv-parse   # MIT, parsing CSV robusto
# xlsx já está no frontend (bundle), importar no backend também:
npm install xlsx        # MIT, parsing Excel
```

### Estrutura do endpoint

```typescript
// server/src/routes/import.ts
router.post('/leads', authenticate, tenantScope, uploadLimiter, upload.single('file'), async (req, res) => {
  const mapping: Record<string, string> = JSON.parse(req.body.mapping)
  const dryRun = req.query.dry_run === 'true'
  // 1. Detectar tipo (csv/xlsx) pelo mimetype ou extensão
  // 2. Parsear linhas
  // 3. Aplicar mapeamento
  // 4. Validar cada linha (Zod)
  // 5. Se dry_run: retornar análise; senão: gravar em lote
})
```

### Multer config

```typescript
import multer from 'multer'
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_, file, cb) => {
    const allowed = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    cb(null, allowed.includes(file.mimetype))
  }
})
```

### Auto-mapeamento (frontend)

```typescript
const AUTO_MAP: Record<string, string> = {
  'nome': 'name', 'name': 'name', 'full name': 'name',
  'email': 'email', 'e-mail': 'email',
  'telefone': 'phone', 'phone': 'phone', 'celular': 'phone', 'whatsapp': 'phone',
  'empresa': 'company', 'company': 'company', 'organização': 'company',
  'cargo': 'position', 'position': 'position',
  'origem': 'source', 'source': 'source',
  'notas': 'notes', 'notes': 'notes', 'observações': 'notes',
}
```

### Processamento em lote (backend)

```typescript
const BATCH_SIZE = 100
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE)
  await prisma.lead.createMany({ data: batch.map(toLeadData), skipDuplicates: false })
  await new Promise(r => setTimeout(r, 0)) // yield event loop
}
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/src/routes/import.ts` | CRIAR |
| `server/src/services/importService.ts` | CRIAR |
| `server/src/index.ts` | MODIFICAR — montar rota + CSRF whitelist |
| `src/pages/Import.tsx` | CRIAR |
| `src/components/import/FileUploader.tsx` | CRIAR |
| `src/components/import/ColumnMapper.tsx` | CRIAR |
| `src/components/import/ImportPreview.tsx` | CRIAR |
| `src/utils/routes.tsx` | MODIFICAR — adicionar rota `/app/settings/import` |
| `package.json` (server) | MODIFICAR — csv-parse, xlsx, multer |

---

## Riscos

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Excel com formatos exóticos (macros, merged cells) | Média | Médio | Extrair só primeira sheet, ignorar cells especiais |
| CSV com encoding não UTF-8 | Alta | Médio | Tentar Latin-1 se UTF-8 falhar; mostrar aviso |
| 10k linhas travando o servidor | Baixa | Alto | Processamento em lotes de 100 + setTimeout yield |
| Campos custom não reconhecidos | Baixa | Baixo | Listar custom fields do tenant no dropdown |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Backend: rota + parser CSV/XLSX + importService | 3h |
| Backend: validação Zod por linha + error log | 1h |
| Frontend: FileUploader + ColumnMapper | 2h |
| Frontend: Preview + feedback pós-importação | 1h |
| Integração + testes manuais | 1h |
| **Total** | **~8h** |

---

## Verificação E2E

1. Acessar `/app/settings/import` → uploader visível
2. Upload de CSV com colunas: nome, email, telefone, empresa → auto-mapeamento correto
3. Alterar mapeamento manualmente → preview atualiza
4. Remover mapeamento de `name` → botão "Próximo" desabilitado
5. Confirmar importação → toast "X leads importados", leads na listagem
6. Upload de Excel (`.xlsx`) → mesmo fluxo funciona
7. Upload com email inválido → linha aparece com erro no relatório

---

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
