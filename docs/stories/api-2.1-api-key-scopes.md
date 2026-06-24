# Story: Scopes e Permissões por API Key

**Story ID:** API-2.1  
**Epic:** EPIC-API-HUB  
**Tipo:** Feature  
**Prioridade:** P1  
**Pontos:** 5  
**Sprint:** 2  
**Fase:** 2 — Scopes e Zapier  
**Dependências:** API-1.2 (padrão de auth estabelecido)  
**Desbloqueia:** API-2.2 (Zapier usa scopes)  
**Status:** Draft

---

## Descrição

Como administrador, quero poder criar API keys com escopos limitados (ex: apenas leitura de leads, ou apenas criação de interações), para integrar sistemas terceiros com acesso mínimo necessário, seguindo o princípio de menor privilégio.

---

## Acceptance Criteria

### AC-1: Scopes Disponíveis
- [ ] Scopes definidos: `leads:read`, `leads:write`, `deals:read`, `deals:write`, `tasks:read`, `tasks:write`, `interactions:write`, `contacts:read`, `webhooks:read`, `reports:read`
- [ ] Uma API key sem scopes explícitos = acesso total (backward compat)

### AC-2: UI de Criação de API Key (Atualizar)
- [ ] Na página existente de API Keys, ao criar key: checkboxes de scopes por recurso
- [ ] Agrupados: Leads (ler/escrever) | Deals (ler/escrever) | Tarefas (ler/escrever) | Interações | Webhooks | Relatórios
- [ ] "Acesso total" checkbox = marca todos
- [ ] Key exibida UMA vez após criação (mesmo comportamento atual)

### AC-3: Backend — Armazenamento e Validação
- [ ] `ApiKey.scopes String[] @default([])` — campo adicionado via migração
- [ ] Middleware `apiKeyScope.ts` — valida se a key tem o scope necessário para a rota
- [ ] Scope vazio = acesso total (backward compat)
- [ ] Erro 403 com body `{ error: "Scope insuficiente", required: "leads:write" }` quando scope ausente

### AC-4: Documentação de Scopes no Swagger (Extensão de API-1.1)
- [ ] Cada endpoint documentado com `security: [{ apiKey: ['leads:read'] }]` no JSDoc
- [ ] Swagger UI mostra "Scope necessário: leads:read" na descrição

---

## Dev Notes

### Migração Prisma

```prisma
// ApiKey — adicionar campo (já existe o model)
scopes String[] @default([])
```

### Middleware de scope

```typescript
// server/src/middleware/apiKeyScope.ts
export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.apiKey // setado pelo middleware de auth da API key
    if (!apiKey) return res.status(401).json({ error: 'API key necessária' })

    // Sem scopes = acesso total (backward compat)
    if (apiKey.scopes.length === 0) return next()

    if (!apiKey.scopes.includes(scope)) {
      return res.status(403).json({ error: 'Scope insuficiente', required: scope })
    }
    next()
  }
}
```

### Uso nas rotas

```typescript
// server/src/routes/leads.ts
router.get('/', apiKeyAuth, requireScope('leads:read'), tenantMiddleware, async (req, res) => { ... })
router.post('/', apiKeyAuth, requireScope('leads:write'), tenantMiddleware, async (req, res) => { ... })
```

### Constantes de scope

```typescript
// server/src/utils/scopes.ts
export const SCOPES = {
  LEADS_READ: 'leads:read',
  LEADS_WRITE: 'leads:write',
  DEALS_READ: 'deals:read',
  DEALS_WRITE: 'deals:write',
  TASKS_READ: 'tasks:read',
  TASKS_WRITE: 'tasks:write',
  INTERACTIONS_WRITE: 'interactions:write',
  CONTACTS_READ: 'contacts:read',
  WEBHOOKS_READ: 'webhooks:read',
  REPORTS_READ: 'reports:read',
} as const
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/prisma/schema.prisma` | MODIFICAR — ApiKey.scopes |
| `server/src/middleware/apiKeyScope.ts` | CRIAR |
| `server/src/utils/scopes.ts` | CRIAR — constantes de scope |
| `server/src/routes/apiKeys.ts` | MODIFICAR — incluir scopes no CRUD |
| `server/src/routes/leads.ts` | MODIFICAR — requireScope() nas rotas |
| `server/src/routes/deals.ts` | MODIFICAR — requireScope() |
| `src/pages/ApiKeysSettings.tsx` | MODIFICAR — checkboxes de scope |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Migração Prisma + scopes.ts | 0.5h |
| Middleware apiKeyScope | 1h |
| Aplicar requireScope em rotas principais | 1.5h |
| Frontend: checkboxes de scope | 1h |
| Testes de integração | 1h |
| **Total** | **~5h** |

---

## Verificação E2E

1. Criar API key com scope `leads:read`
2. `GET /api/v1/leads` com essa key → 200 OK
3. `POST /api/v1/leads` com essa key → 403 "Scope insuficiente: leads:write"
4. Criar API key sem scopes → acesso total (backward compat)
5. `GET /api/v1/deals` com key `leads:read` → 403

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
