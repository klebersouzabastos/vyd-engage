# Conectando o VYD Engage ao Zapier

Este guia explica como conectar o VYD Engage ao [Zapier](https://zapier.com) para
automatizar fluxos entre o CRM e outras ferramentas (planilhas, e-mail, Slack,
formulários, etc.) sem escrever código.

> O app Zapier do VYD Engage usa **API Key** para autenticação (sem OAuth no MVP).
> Os triggers e actions abaixo mapeiam diretamente para a API REST existente
> (`/api/v1/*`). A definição do app Zapier (triggers/actions) vive no projeto
> separado do Zapier CLI; este documento é a referência de integração.

---

## 1. Pré-requisitos

- Uma conta no VYD Engage com permissão para gerenciar **API Keys**.
- Uma conta no Zapier.

## 2. Gerar uma API Key

1. No VYD Engage, acesse **Configurações → API Keys** (`/app/settings/api-keys`).
2. Clique em **Nova API Key**, dê um nome (ex.: `Zapier`) e selecione os **scopes**
   necessários para o seu fluxo (veja a tabela de scopes abaixo).
   - Para apenas ler leads (trigger *New Lead*), `leads:read` é suficiente.
   - Para criar/atualizar registros (actions), inclua os scopes de escrita
     correspondentes (`leads:write`, `deals:write`, `tasks:write`).
   - Uma key **sem nenhum scope** tem acesso total (compatibilidade retroativa).
3. **Copie a key completa** exibida no momento da criação — ela só aparece uma vez.

## 3. Autenticação no Zapier

Ao conectar a conta do VYD Engage no Zapier, informe a API Key. O Zapier a envia
em **todas** as requisições no header:

```
X-API-Key: fcrm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

A URL base da API é o seu backend do VYD Engage, por exemplo:

```
https://engage.vydhub.com/api/v1
```

---

## 4. Triggers (eventos que iniciam um Zap)

Os triggers usam **polling** (o Zapier consulta periodicamente o endpoint) e/ou os
**webhooks de saída** configuráveis em `/app/settings/webhooks`.

| Trigger no Zapier | Como funciona | Endpoint / Evento |
|-------------------|---------------|-------------------|
| **New Lead**      | Polling dos leads mais recentes | `GET /api/v1/zapier/triggers/lead-created` (suporta `?since=ISO`) |
| **Lead Updated**  | Webhook de saída | evento `lead.updated` |
| **Deal Won**      | Webhook de saída | evento `deal.won` |
| **Deal Lost**     | Webhook de saída | evento `deal.lost` |
| **Task Completed**| Webhook de saída | evento `task.completed` |

### Trigger de polling — New Lead

```
GET /api/v1/zapier/triggers/lead-created?since=2026-06-01T00:00:00.000Z
X-API-Key: <sua-key>
```

Retorna um array de leads (mais recentes primeiro), cada um no formato achatado
(flat) esperado pelo Zapier:

```json
[
  {
    "id": "lead_abc123",
    "name": "Maria Silva",
    "email": "maria.silva@example.com",
    "phone": "+5511999990000",
    "company": "Acme Corp",
    "status": "NEW",
    "source": "WEBSITE",
    "score": 45,
    "tags": ["inbound"],
    "created_at": "2026-06-20T12:00:00.000Z",
    "updated_at": "2026-06-20T12:00:00.000Z"
  }
]
```

Requer o scope `leads:read` (ou uma key legada sem scopes).

### Triggers via webhook de saída

Para `Lead Updated`, `Deal Won`, `Deal Lost` e `Task Completed`, crie um webhook
de saída em **Configurações → Webhooks** (`/app/settings/webhooks`) apontando para
a URL do *Catch Hook* do Zapier e selecionando o(s) evento(s) desejado(s).

Cada disparo é um `POST` com o corpo:

```json
{
  "event": "deal.won",
  "tenantId": "tenant_123",
  "timestamp": "2026-06-20T12:34:56.000Z",
  "data": { "...": "campos do registro" }
}
```

e o header de assinatura HMAC-SHA256:

```
X-VYD-Signature: <hmac_sha256(body, secret)>
```

Use o `secret` informado na criação do webhook para validar a assinatura.

---

## 5. Actions (o que um Zap pode fazer no VYD Engage)

| Action no Zapier   | Método e endpoint | Scope necessário |
|--------------------|-------------------|------------------|
| **Create Lead**    | `POST /api/v1/leads` | `leads:write` |
| **Update Lead**    | `PUT /api/v1/leads/{id}` | `leads:write` |
| **Create Deal**    | `POST /api/v1/deals` | `deals:write` |
| **Create Task**    | `POST /api/v1/tasks` | `tasks:write` |
| **Add Tag to Lead**| `POST /api/v1/leads/{id}/tags` | `leads:write` |

Todas as actions enviam o header `X-API-Key` e `Content-Type: application/json`.

### Exemplo — Create Lead

```
POST /api/v1/leads
X-API-Key: <sua-key>
Content-Type: application/json

{
  "name": "João Souza",
  "email": "joao@example.com",
  "phone": "+5511988887777",
  "source": "WEBSITE"
}
```

---

## 6. Scopes disponíveis

| Scope             | Permite |
|-------------------|---------|
| `leads:read`      | Ler leads (trigger New Lead) |
| `leads:write`     | Criar/atualizar leads, adicionar tags |
| `deals:read`      | Ler deals |
| `deals:write`     | Criar/atualizar deals |
| `tasks:read`      | Ler tarefas |
| `tasks:write`     | Criar/atualizar tarefas |
| `contacts:read`   | Ler contatos/empresas |
| `reports:read`    | Ler relatórios |
| `webhooks:manage` | Gerenciar webhooks de saída |

> Uma API Key **sem scopes** mantém acesso total (compatibilidade retroativa).
> Uma requisição feita com uma key que possui scopes mas **não** o scope exigido
> pela rota recebe **HTTP 403**.

---

## 7. Passos de conexão (resumo)

1. Gere a API Key no VYD Engage com os scopes adequados.
2. No Zapier, crie um Zap e escolha **VYD Engage** como app.
3. Conecte sua conta colando a API Key (enviada como `X-API-Key`).
4. Escolha um **trigger** (ex.: *New Lead*) e teste — o Zapier buscará leads
   recentes via polling.
5. Adicione **actions** (ex.: criar uma linha numa planilha) ou use o VYD Engage
   como action (ex.: *Create Deal*).
6. Ative o Zap.

---

## 8. Solução de problemas

- **401 Unauthorized:** API Key ausente, inválida ou expirada. Gere uma nova key.
- **403 Forbidden:** a key não possui o scope exigido pela operação. Edite os
  scopes ou crie uma nova key com os scopes corretos.
- **429 Too Many Requests:** limite de 1000 requisições/minuto por key atingido.
- **Webhook não dispara:** confirme que o webhook está **ativo**, que o evento
  está selecionado e verifique os **últimos disparos** (logs) na página de
  webhooks para ver o código HTTP e o erro de cada tentativa.
