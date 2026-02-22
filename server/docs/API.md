# VYD Engage API Documentation

## Base URL
```
http://localhost:3001/api
```

## Autenticação

A maioria dos endpoints requer autenticação via Bearer Token no header:

```
Authorization: Bearer <access_token>
```

## Endpoints

### Autenticação

#### POST /auth/register
Registrar novo usuário e criar tenant.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "companyName": "My Company"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "ADMIN",
    "tenantId": "uuid"
  },
  "accessToken": "jwt_token",
  "refreshToken": "refresh_token"
}
```

#### POST /auth/login
Fazer login.

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### POST /auth/refresh
Atualizar access token usando refresh token.

**Body:**
```json
{
  "refreshToken": "refresh_token"
}
```

#### GET /auth/me
Obter informações do usuário atual.

**Headers:** `Authorization: Bearer <token>`

### Leads

#### GET /leads
Listar leads com filtros opcionais.

**Query Parameters:**
- `status` - Status do lead (NEW, CONTACTED, QUALIFIED, etc)
- `source` - Fonte do lead (WEBSITE, SOCIAL_MEDIA, etc)
- `search` - Busca por nome, email, telefone ou empresa
- `tagId` - Filtrar por tag
- `assignedTo` - Filtrar por usuário atribuído
- `page` - Número da página (padrão: 1)
- `limit` - Itens por página (padrão: 50, máximo: 100)

**Response:**
```json
{
  "leads": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

#### GET /leads/:id
Obter lead específico.

#### POST /leads
Criar novo lead.

**Body:**
```json
{
  "name": "Lead Name",
  "email": "lead@example.com",
  "phone": "+5511999999999",
  "company": "Company Name",
  "status": "NEW",
  "source": "WEBSITE",
  "tagIds": ["tag-uuid-1", "tag-uuid-2"]
}
```

#### PUT /leads/:id
Atualizar lead.

#### DELETE /leads/:id
Deletar lead.

### Tasks

#### GET /tasks
Listar tarefas.

**Query Parameters:**
- `status` - Status (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)
- `priority` - Prioridade (LOW, MEDIUM, HIGH, URGENT)
- `assignedTo` - Usuário atribuído
- `leadId` - Lead relacionado
- `overdue` - Tarefas atrasadas (boolean)
- `dueToday` - Tarefas vencendo hoje (boolean)

#### POST /tasks
Criar nova tarefa.

**Body:**
```json
{
  "title": "Task Title",
  "description": "Task description",
  "status": "PENDING",
  "priority": "MEDIUM",
  "assignedTo": "user-uuid",
  "leadId": "lead-uuid",
  "dueDate": "2024-12-31T23:59:59Z"
}
```

### Tags

#### GET /tags
Listar todas as tags do tenant.

#### POST /tags
Criar nova tag.

**Body:**
```json
{
  "name": "Tag Name",
  "color": "#2563EB"
}
```

### Subscriptions

#### GET /subscriptions/current
Obter assinatura atual com uso.

**Response:**
```json
{
  "subscription": {
    "id": "uuid",
    "status": "ACTIVE",
    "plan": {...},
    "renewalDate": "2024-12-31T23:59:59Z"
  },
  "usage": {
    "leads": {
      "current": 50,
      "limit": 250,
      "percentage": 20
    },
    ...
  }
}
```

#### GET /subscriptions/plans
Listar todos os planos disponíveis.

#### PUT /subscriptions/change-plan
Alterar plano da assinatura.

**Body:**
```json
{
  "planType": "PRO",
  "billingCycle": "monthly"
}
```

### Payments

#### POST /payments/intent
Criar intenção de pagamento.

**Body:**
```json
{
  "planId": "plan-uuid",
  "planType": "PRO",
  "amount": 197.00,
  "method": "credit_card",
  "billingCycle": "monthly"
}
```

**Response:**
```json
{
  "payment": {...},
  "preference": {
    "id": "mercadopago-preference-id",
    "initPoint": "https://www.mercadopago.com.br/checkout/v1/redirect..."
  }
}
```

#### GET /payments/history
Obter histórico de pagamentos.

## Códigos de Erro

- `400` - Bad Request (validação falhou)
- `401` - Unauthorized (token inválido ou ausente)
- `403` - Forbidden (sem permissão ou limite de plano atingido)
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

- Autenticação: 5 requisições por 15 minutos por IP
- API geral: 100 requisições por 15 minutos por IP

## Autenticação Avançada

### POST /api/auth/password/reset-request
Solicitar recuperação de senha.

**Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "If the email exists, a password reset link has been sent."
}
```

### POST /api/auth/password/reset
Redefinir senha usando token.

**Body:**
```json
{
  "token": "uuid-token",
  "password": "newpassword123"
}
```

**Response:**
```json
{
  "message": "Password reset successfully"
}
```

### POST /api/auth/email/verify-request
Solicitar reenvio de email de verificação (requer autenticação).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "Verification email sent"
}
```

### POST /api/auth/email/verify
Verificar email usando token.

**Body:**
```json
{
  "token": "uuid-token"
}
```

**Response:**
```json
{
  "message": "Email verified successfully"
}
```

## Webhooks

### Mercado Pago

**URL:** `POST /api/webhooks/mercadopago`

O webhook recebe notificações do Mercado Pago sobre mudanças no status de pagamentos.


