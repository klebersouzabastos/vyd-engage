# VYD Engage - Database Audit Report

**Tipo:** Schema Design Quality + Security Audit
**Database:** PostgreSQL 16+ via Prisma 5.7.1
**Schema:** `server/prisma/schema.prisma` (658 linhas, 20 modelos)
**Data:** 2026-02-20
**Fase:** Brownfield Discovery - Fase 2 (Coleta: Database)
**Agente:** @data-engineer (Dara)
**Escopo:** Schema audit (estatico — analise do Prisma schema)

---

## Audit Summary

| Categoria | Critico | Alto | Medio | Baixo | Total |
|-----------|---------|------|-------|-------|-------|
| Integridade Referencial | 0 | 4 | 0 | 0 | 4 |
| Seguranca | 1 | 1 | 1 | 0 | 3 |
| Schema Design | 0 | 2 | 3 | 2 | 7 |
| Performance / Indices | 0 | 1 | 2 | 0 | 3 |
| Migrations | 0 | 2 | 0 | 0 | 2 |
| **TOTAL** | **1** | **10** | **6** | **2** | **19** |

**Veredicto:** NEEDS WORK — 1 issue critica + 10 altas requerem atencao.

---

## 1. Integridade Referencial

### DB-01 | ALTO | `Lead.assignedTo` sem Foreign Key

**Campo:** `Lead.assignedTo: String?`
**Problema:** Referencia um User.id mas sem FK constraint. Permite valores invalidos.
**Impacto:** Dados orfaos, queries com LEFT JOIN necessario, sem CASCADE.
**Correcao:**
```prisma
assignedTo  String?
assignedUser User?   @relation("LeadAssignment", fields: [assignedTo], references: [id], onDelete: SetNull)
```

### DB-02 | ALTO | `Task.assignedTo` sem Foreign Key

**Campo:** `Task.assignedTo: String?`
**Problema:** Mesmo issue que DB-01.
**Correcao:** Adicionar relacao com User.

### DB-03 | ALTO | `Interaction.userId` sem Foreign Key

**Campo:** `Interaction.userId: String?`
**Problema:** Referencia User mas sem constraint. Nao ha como garantir que o userId existe.
**Correcao:**
```prisma
userId  String?
user    User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
```

### DB-04 | ALTO | `Interaction.automationId` sem Foreign Key

**Campo:** `Interaction.automationId: String?`
**Problema:** Referencia Automation mas sem constraint.
**Correcao:**
```prisma
automationId  String?
automation    Automation? @relation(fields: [automationId], references: [id], onDelete: SetNull)
```

### DB-05 | ALTO | `Notification.userId` sem Foreign Key

**Campo:** `Notification.userId: String`
**Problema:** Campo obrigatorio que referencia User sem FK. Diferente dos outros, este e NOT NULL, o que e bom, mas ainda sem integridade referencial.
**Correcao:**
```prisma
userId  String
user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
```

---

## 2. Seguranca

### DB-06 | CRITICO | Dados sensiveis armazenados sem protecao adicional

**Campos afetados:**
| Modelo | Campo | Tipo de dado sensivel |
|--------|-------|-----------------------|
| User | passwordHash | Credential |
| User | passwordResetToken | Auth token |
| User | twoFactorSecret | TOTP secret |
| RefreshToken | token | Session token |
| Invitation | token | Auth token |
| ApiKey | key | API credential |
| WhatsAppConnection | config (Json) | API keys/tokens |
| EmailConfig | config (Json) | SMTP passwords |
| Webhook | secret | Signing secret |
| Payment | paymentData (Json) | Payment info |

**Problema:** Nenhum desses campos tem protecao a nivel de banco (encryption at rest via PostgreSQL). A seguranca depende 100% da camada de aplicacao.
**Risco:** Se o banco for comprometido, todos os segredos estao em plaintext (exceto passwordHash que usa bcrypt).
**Recomendacao:**
1. `passwordResetToken`, `twoFactorSecret`, `ApiKey.key` devem ser armazenados como hash (nao plaintext)
2. Campos `config` (Json) com credenciais devem usar encryption at application level
3. Considerar `pgcrypto` para campos criticos

### DB-07 | ALTO | Sem RLS (Row Level Security)

**Problema:** PostgreSQL com Prisma nao usa RLS nativamente. Toda isolacao de tenants depende da camada de aplicacao (middleware). Se qualquer rota esquecer de filtrar por `tenantId`, dados de outro tenant sao expostos.
**Risco:** Um bug no middleware = data breach cross-tenant.
**Recomendacao:**
1. Adicionar RLS policies no PostgreSQL como defesa em profundidade
2. Ou usar database-level tenant isolation via schemas separados
3. No minimo, criar views filtradas por tenant como camada adicional

### DB-08 | MEDIO | `Payment.status` e `Payment.method` sao String, nao Enum

**Problema:** `status` (pending, paid, failed, refunded) e `method` (credit_card, pix, boleto) sao strings livres em vez de enums do Prisma.
**Risco:** Typos, valores inconsistentes, sem validacao a nivel de banco.
**Correcao:**
```prisma
enum PaymentStatus { PENDING PAID FAILED REFUNDED }
enum PaymentMethod { CREDIT_CARD PIX BOLETO }
```

---

## 3. Schema Design

### DB-09 | ALTO | `Interaction` sem `updatedAt`

**Problema:** Unico modelo de negocio sem `updatedAt`. Se uma interacao for editada, nao ha registro de quando.
**Pattern:** Todos os outros 19 modelos seguem o padrao `createdAt + updatedAt`.
**Nota:** Se Interaction e intencionalmente append-only (imutavel), documentar essa decisao. Caso contrario, adicionar `updatedAt`.

### DB-10 | ALTO | Uso excessivo de Json para dados estruturados

**Campos Json:**
| Modelo | Campo | Conteudo |
|--------|-------|----------|
| Tenant | settings | Config do tenant |
| Plan | features | Lista de features |
| Plan | limits | Limites do plano |
| Lead | customFields | Campos customizaveis |
| Subscription | paymentMethod | Metodo de pagamento |
| Payment | paymentData | Dados do pagamento |
| Automation | trigger | Config do trigger |
| Automation | steps | Steps da automacao |
| Automation | conditions | Condicoes |
| WhatsAppConnection | config | Config do provider |
| EmailConfig | config | Config SMTP/API |
| Interaction | metadata | Metadados |
| Notification | metadata | Metadados |

**Total: 13 campos Json em 20 modelos (65%)**
**Problema:** Json nao tem validacao a nivel de banco. Schema drift silencioso. Queries em campos Json sao mais lentas. Sem type safety.
**Recomendacao:** Campos como `Plan.features`, `Plan.limits`, `Automation.trigger/steps` sao candidatos a normalizacao em tabelas dedicadas se crescerem em complexidade.

### DB-11 | MEDIO | `Interaction.type` e `Interaction.direction` sao String, nao Enum

**Valores esperados:** type (email, whatsapp, call, meeting, note), direction (inbound, outbound)
**Correcao:** Criar enums `InteractionType` e `InteractionDirection`.

### DB-12 | MEDIO | `AutomationLog.status` e String, nao Enum

**Valores esperados:** success, error, skipped
**Correcao:** Criar enum `AutomationLogStatus`.

### DB-13 | MEDIO | `WebhookLog.status` e String, nao Enum

**Valores esperados:** success, failed, pending
**Correcao:** Criar enum `WebhookLogStatus`.

### DB-14 | BAIXO | Naming inconsistency em campos booleanos

- `emailVerified` (User) vs `verified` (EmailConfig) vs `active` (Plan, CustomField, ApiKey, Webhook)
- Padrao inconsistente: alguns usam `isX`, nenhum usa prefixo, mas nomes variam.
**Risco:** Baixo — cosmetic.

### DB-15 | BAIXO | `Plan.price` usa Float

**Problema:** Float para valores monetarios pode causar problemas de arredondamento (ex: 0.1 + 0.2 != 0.3).
**Recomendacao:** Usar `Decimal` do Prisma ou armazenar em centavos (Int).
```prisma
price  Decimal  @db.Decimal(10, 2)
```
Mesmo para `Payment.amount`.

---

## 4. Performance / Indices

### DB-16 | ALTO | `Subscription.planId` sem indice

**Problema:** FK para Plan mas sem indice dedicado. Queries por plano (ex: "quantos tenants no plano PRO?") fazem full scan.
**Correcao:** `@@index([planId])`

### DB-17 | MEDIO | `Invitation.invitedBy` sem indice

**Problema:** FK para User mas sem indice. Queries "listar convites que eu enviei" sao lentas.
**Correcao:** `@@index([invitedBy])`

### DB-18 | MEDIO | Indices compostos bem projetados (ponto positivo)

**Observacao positiva:** Os indices compostos existentes sao bem pensados:
- `[tenantId, email]` em User — busca por email dentro do tenant
- `[tenantId, status]` em Lead, Task — filtros mais comuns
- `[tenantId, createdAt]` em Lead — listagem cronologica
- `[tenantId, userId, status]` em Notification — inbox do usuario
- `[tenantId, assignedTo]` em Task — tarefas atribuidas
- `[leadId, tagId]` unique em LeadTag — previne duplicatas

Estes cobrem os access patterns mais comuns do CRM.

---

## 5. Migrations

### DB-19 | ALTO | Apenas 1 arquivo de migration (SQL manual)

**Situacao atual:**
```
server/prisma/migrations/
├── migration_lock.toml
└── make_email_optional.sql
```

**Problema:** Apenas 1 migration manual (SQL puro). Nao ha historico de migrations do Prisma (`prisma migrate dev` gera pastas com timestamp). Isso indica que o schema foi criado de forma ad-hoc ou via `prisma db push` (nao versionado).
**Risco:** Schema drift entre ambientes. Impossivel reproduzir o banco de forma deterministica.
**Correcao:**
1. Gerar baseline migration: `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > baseline.sql`
2. Ou `npx prisma migrate dev --name baseline` para criar migration proper

### DB-20 | ALTO | Sem seed.ts ou seed data verificavel

**Arquivo referenciado:** `server/prisma/seed.ts` (no package.json: `"prisma:seed": "tsx prisma/seed.ts"`)
**Status:** Nao verificado se existe e esta funcional.
**Risco:** Sem seed data, novos devs nao conseguem testar com dados realistas. Plans precisam existir no banco para o sistema funcionar.

---

## Matriz de Priorizacao

| ID | Debito | Severidade | Esforco | Prioridade | Dependencia |
|----|--------|-----------|---------|------------|-------------|
| DB-06 | Dados sensiveis sem protecao | CRITICO | Alto | 1 | Nenhuma |
| DB-07 | Sem RLS | ALTO | Alto | 2 | Nenhuma |
| DB-19 | Migrations ad-hoc | ALTO | Baixo | 3 | Nenhuma |
| DB-01 | Lead.assignedTo sem FK | ALTO | Baixo | 4 | DB-19 |
| DB-02 | Task.assignedTo sem FK | ALTO | Baixo | 4 | DB-19 |
| DB-03 | Interaction.userId sem FK | ALTO | Baixo | 4 | DB-19 |
| DB-04 | Interaction.automationId sem FK | ALTO | Baixo | 4 | DB-19 |
| DB-05 | Notification.userId sem FK | ALTO | Baixo | 4 | DB-19 |
| DB-16 | Subscription.planId sem indice | ALTO | Baixo | 5 | DB-19 |
| DB-09 | Interaction sem updatedAt | ALTO | Baixo | 6 | DB-19 |
| DB-10 | Uso excessivo de Json | ALTO | Alto | 7 | Avaliacao caso a caso |
| DB-15 | Float para valores monetarios | BAIXO | Medio | 8 | DB-19 |
| DB-08 | Payment status/method String | MEDIO | Baixo | 9 | DB-19 |
| DB-11 | Interaction type/direction String | MEDIO | Baixo | 9 | DB-19 |
| DB-12 | AutomationLog.status String | MEDIO | Baixo | 9 | DB-19 |
| DB-13 | WebhookLog.status String | MEDIO | Baixo | 9 | DB-19 |
| DB-17 | Invitation.invitedBy sem indice | MEDIO | Baixo | 10 | Nenhuma |
| DB-14 | Naming inconsistency | BAIXO | Baixo | 11 | Nenhuma |
| DB-20 | Seed data nao verificado | ALTO | Medio | 12 | DB-19 |

---

## Recomendacoes por Ordem de Execucao

### Sprint 1: Fundacao (Quick Wins)
1. **Criar baseline migration** (DB-19) — `prisma migrate dev --name baseline`
2. **Adicionar FKs faltantes** (DB-01 a DB-05) — 5 campos, 1 migration
3. **Adicionar indice em Subscription.planId** (DB-16) — 1 linha
4. **Adicionar indice em Invitation.invitedBy** (DB-17) — 1 linha

### Sprint 2: Seguranca
5. **Audit de dados sensiveis** (DB-06) — revisar quais campos precisam de encryption
6. **Avaliar RLS** (DB-07) — decidir estrategia (RLS, views, ou aceitar risco)

### Sprint 3: Qualidade
7. **Converter strings em enums** (DB-08, DB-11, DB-12, DB-13) — 1 migration
8. **Converter Float para Decimal** (DB-15) — Payment + Plan
9. **Avaliar normalizacao de campos Json** (DB-10) — caso a caso

---

## Perguntas para @architect

1. `Interaction` e intencionalmente append-only (sem updatedAt)? Ou foi esquecido?
2. `Lead.assignedTo` e `Task.assignedTo` — ha planos para suportar multiple assignees? Isso afetaria se usamos FK direta ou join table.
3. Os campos Json (trigger, steps, conditions em Automation) — ha planos para um editor visual de automacoes? Se sim, normalizar cedo e mais barato.
4. Qual a estrategia de isolamento de tenants preferida? RLS no PostgreSQL ou confiar na camada de aplicacao?
5. `Payment.paymentData` (Json) — que dados sao armazenados? Ha dados de cartao? PCI compliance?

---

## Change Log

| Data | Versao | Descricao | Autor |
|------|--------|-----------|-------|
| 2026-02-20 | 1.0 | Schema audit inicial — Fase 2 Discovery | @data-engineer (Dara) |

---

*— Dara, arquitetando dados*
