# Growth Roadmap — Relatório de Build & Review

**Data:** 2026-06-24
**Branch:** `feat/growth-roadmap-build`
**Ciclo:** `/spec` → `/build` → `/review` → correção → re-review → aprovação, por épico; depois auto-avaliação iterativa.

---

## Resumo

Os 4 épicos do Growth Roadmap foram implementados a partir das specs, revisados contra elas, corrigidos até `/review` **APROVADO**, e commitados atomicamente. Em seguida, o trabalho foi auto-avaliado por uma rubrica de 7 dimensões em 3 iterações (87 → 91 → 92), parando ao atingir o platô.

| Épico | Reqs | Veredicto final | Commit |
|-------|-----:|-----------------|--------|
| Import Pro | 32 | ✅ Aprovado (após 7 correções de contrato) | `5866d30` |
| AI Sales Assistant | 36 | ✅ Aprovado (após 1 lacuna + stampede do kanban) | `58d3fe0` |
| Email Campaigns | 34 | ✅ Aprovado (após 5 correções de contrato) | `0097727` |
| API Hub | 26 | ✅ Aprovado (após try-it-out via Swagger UI) | `9f5e4ef` |

**Builds:** backend `tsc` exit 0; frontend `vite build` exit 0; **71 testes unitários** (mockados) passando.

---

## Regras de segurança honradas

- `server/.env` aponta para o **banco de produção (Railway)**. Por isso: **nenhum** `prisma migrate`/`db push`/`studio`, **nenhum** `vitest run` completo (os testes de integração criam/apagam dados reais), `.env` nunca editado.
- Verificação feita apenas com comandos seguros: `tsc` (backend), `vite build`/`tsc --noEmit` (frontend), `prisma generate` (sem conexão) e testes **unitários mockados** (`__tests__/unit`).
- **Migrations criadas, não aplicadas** — ficam para o deploy autorizado:
  - `20260624000000_import_pro` — `ImportBatch` + `importBatchId` em Lead/Deal/Interaction + `Interaction.deletedAt`
  - `20260624000100_ai_sales` — `Deal.aiScore/aiScoreUpdatedAt/aiScoreFactors`
  - `20260624000200_email_campaigns` — `Campaign`/`CampaignRecipient`/`CampaignEvent` + `Lead.unsubscribed/unsubscribedAt`
  - `20260624000300_api_hub` — `ApiKey.scopes` + extensões de `Webhook`/`WebhookLog`

---

## O que o `/review` pegou (e o build não)

O ciclo provou seu valor: todos os mismatches abaixo passam pelo `tsc` (o cliente faz cast da resposta sem validar) e só foram detectados pela auditoria adversarial requisito-a-requisito.

- **Import Pro:** 7 lacunas — nomes de campo do resumo (`newRows` vs `newCount`), shape de duplicata, resposta síncrona, `duplicateActions` por linha ignorado, custom fields `cf_<id>` descartados, envelope `{status,data}` não desembrulhado.
- **AI Sales:** "tendência" do score nunca computada; stampede de chamadas de IA no kanban (risco de 429/p95).
- **Email Campaigns:** path de tracking errado (`/public/track` vs `/track`), filtro de score (`minScore` vs `scoreMin`), agendamento (`sendAt` vs `scheduledAt`), métricas da lista não exibidas.
- **API Hub:** try-it-out (Redoc é read-only) — resolvido adicionando Swagger UI em `/api/docs/try` ao lado do Redoc.

---

## Rubrica e trajetória de pontuação

| # | Dimensão | Peso | It.1 | It.2 | It.3 |
|---|----------|-----:|-----:|-----:|-----:|
| 1 | Conformidade funcional | 30 | 27 | 27 | 28 |
| 2 | Corretude / build | 20 | 15 | 18 | 18 |
| 3 | Segurança e multi-tenancy | 15 | 14 | 14.5 | 14.5 |
| 4 | Casos extremos | 10 | 9 | 9 | 9 |
| 5 | Aderência a padrões | 10 | 8.5 | 8.5 | 8.5 |
| 6 | Disciplina de escopo | 10 | 9 | 9 | 9 |
| 7 | Verificabilidade | 5 | 4.5 | 5 | 5 |
| | **Total** | **100** | **87** | **91** | **92** |

- **It.1 → It.2 (+4):** adicionados 47 testes unitários para a lógica crítica nova (XSS, HMAC, merge tags, base64url, dedup) → dim 2 de 15 para 18.
- **It.2 → It.3 (+1):** paridade do webhook `lead.created` na captação pública → dim 1 de 27 para 28.
- **Platô:** +1 está abaixo do limiar significativo. Ganhos restantes têm ROI ruim / risco alto (consistência de envelope = risco de regressão; verificação runtime = bloqueada pela regra do banco).

---

## Limitações conhecidas / pendências de deploy

1. **Migrations não aplicadas** — aplicar as 4 acima no deploy autorizado (afeta prod).
2. **Verificação runtime pendente** — DoD que exigem execução real (ex.: "email recebido exibe nome do lead", "p95 < 3s em staging", entrega de webhook) estão implementados mas não verificados contra prod.
3. **Jobs gated** — `scoreDeals`, `campaignSender` e o dispatch de webhooks exigem `ENABLE_AUTOMATION_ENGINE=true` + Redis.
4. **IA gated** — features de IA exigem `AI_PROVIDER`/`AI_API_KEY`; ocultam-se sem configuração.
5. **Inconsistência de envelope** — métodos de import/campaign desembrulham `.data`; apikey/webhook retornam objeto cru (espelha o padrão pré-existente de cada módulo). Não corrigido por risco de regressão.
6. **Não há testes de integração novos** — a lógica nova de rotas não tem teste de integração (exigiria banco de teste; o `.env` é prod).

---

## Como verificar (sem tocar em produção)

```bash
# Backend typecheck
npm run build --prefix server                          # exit 0

# Frontend typecheck + bundle
npm run typecheck && npm run build                     # exit 0

# Testes unitários (mockados, seguros)
npm --prefix server run test -- run src/__tests__/unit # 71 passando
```
