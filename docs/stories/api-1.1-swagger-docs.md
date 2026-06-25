# Story: Documentação Interativa da API (Swagger/Redoc)

**Story ID:** API-1.1  
**Epic:** EPIC-API-HUB  
**Tipo:** Feature  
**Prioridade:** P0  
**Pontos:** 5  
**Sprint:** 1  
**Fase:** 1 — Documentação e Webhooks (paralelo com API-1.2)  
**Dependências:** Nenhuma  
**Desbloqueia:** API-2.2 (Zapier usa docs para spec)  
**Status:** Draft

---

## Descrição

Como desenvolvedor que usa a API do VYD Engage, quero ter uma documentação interativa acessível em `/api/docs`, onde posso ver todos os endpoints disponíveis, seus parâmetros, exemplos de request/response e testar chamadas diretamente no browser, para integrar sem precisar ler código-fonte.

---

## Acceptance Criteria

### AC-1: Documentação Acessível
- [ ] `GET /api/docs` — redireciona para `/api/docs/` (Swagger UI ou Redoc)
- [ ] `GET /api/docs/openapi.json` — spec OpenAPI 3.0 em JSON
- [ ] Documentação acessível sem autenticação (pública)
- [ ] Navegação lateral por grupos de recursos

### AC-2: Spec OpenAPI Cobrindo Endpoints Principais
- [ ] Documentados: `/leads`, `/deals`, `/tasks`, `/companies`, `/tags`, `/funnels`, `/automations`, `/api-keys`, `/webhooks`
- [ ] Cada endpoint: método, path, parâmetros (path/query/body), schema de resposta, códigos de erro
- [ ] Esquema de autenticação: Bearer token (JWT) documentado como Security Scheme
- [ ] Exemplos de request body em cada POST/PUT

### AC-3: Swagger UI Interativo
- [ ] Botão "Authorize" → campo para inserir JWT → autenticado para testar endpoints diretamente
- [ ] "Try it out" funcional para todos os endpoints documentados
- [ ] Resposta do servidor exibida inline com syntax highlight

### AC-4: Versionamento e Info
- [ ] `info.version` sincronizado com `package.json` version do backend
- [ ] `info.contact` com email de suporte
- [ ] Tags de agrupamento: CRM, Automations, Integrations, Settings, Webhooks

---

## Dev Notes

### Pacotes a instalar

```bash
cd server
npm install swagger-ui-express @types/swagger-ui-express
npm install swagger-jsdoc @types/swagger-jsdoc
```

### Setup do spec OpenAPI

```typescript
// server/src/utils/openapi.ts
import swaggerJSDoc from 'swagger-jsdoc'

export const openapiSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'VYD Engage API',
      version: process.env.npm_package_version ?? '1.0.0',
      description: 'CRM API para o VYD Engage',
      contact: { email: 'suporte@vydengage.com' }
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'], // JSDoc nas rotas
})
```

### Montagem no index.ts

```typescript
// server/src/index.ts
import swaggerUi from 'swagger-ui-express'
import { openapiSpec } from './utils/openapi.js'

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec))
app.get('/api/docs/openapi.json', (_, res) => res.json(openapiSpec))
```

### Anotação JSDoc em rota (exemplo)

```typescript
// server/src/routes/leads.ts
/**
 * @openapi
 * /leads:
 *   get:
 *     tags: [CRM]
 *     summary: Listar leads
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de leads paginada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { type: array, items: { $ref: '#/components/schemas/Lead' } }
 *                 total: { type: integer }
 */
router.get('/', authMiddleware, tenantMiddleware, apiLimiter, async (req, res) => { ... })
```

---

## Arquivos a Criar/Modificar

| Arquivo | Operação |
|---------|----------|
| `server/src/utils/openapi.ts` | CRIAR |
| `server/src/index.ts` | MODIFICAR — montar swagger-ui + endpoint JSON |
| `server/src/routes/leads.ts` | MODIFICAR — JSDoc OpenAPI em 5+ endpoints |
| `server/src/routes/deals.ts` | MODIFICAR — JSDoc OpenAPI |
| `server/src/routes/tasks.ts` | MODIFICAR — JSDoc OpenAPI |
| `server/src/routes/auth.ts` | MODIFICAR — JSDoc (login, register, refresh) |
| `package.json` (server) | MODIFICAR — swagger-ui-express, swagger-jsdoc |

---

## Riscos

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Manter JSDoc sincronizado com código | Alta | Baixo | Documentar só endpoints principais; CI pode validar spec via swagger-parser |
| Swagger UI expondo rotas internas | Baixa | Médio | Não incluir rotas de admin/internal na spec |

---

## Estimativa de Esforço

| Tarefa | Estimativa |
|--------|-----------|
| Setup openapi.ts + index.ts | 1h |
| JSDoc nos 4 principais arquivos de rotas | 3h |
| Testes e ajuste de spec | 1h |
| **Total** | **~5h** |

---

## Verificação E2E

1. Acessar `/api/docs` → Swagger UI renderiza
2. Clicar em `GET /leads` → "Try it out" → inserir JWT → executar → resposta 200 com lista
3. `GET /api/docs/openapi.json` → JSON válido com todos os grupos documentados
4. Spec válida segundo swagger-parser (`npx swagger-parser validate /api/docs/openapi.json`)

*— River, removendo obstáculos 🌊*  
*— Data: 2026-06-23*
