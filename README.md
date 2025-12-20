# VYD Engage

Sistema completo de CRM SaaS com autenticação, multi-tenancy, pagamentos e gerenciamento de leads.

**VYD Engage** faz parte do ecossistema **VYD (Value Your Day)**, uma plataforma modular composta por múltiplas soluções independentes, todas integradas sob um único hub central.

👉 [Acesse o VYD Hub](https://www.vydhub.com)

## Estrutura do Projeto

```
.
├── server/          # Backend API (Node.js + Express + Prisma)
├── src/            # Frontend (React + TypeScript + Vite)
└── docker-compose.yml
```

## Pré-requisitos

- Node.js 20+
- PostgreSQL 16+
- Docker (opcional, para desenvolvimento)

## Configuração

### Backend

1. Entre no diretório do servidor:
```bash
cd server
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. Inicie o PostgreSQL (usando Docker):
```bash
docker-compose up -d postgres
```

5. Execute as migrações do banco de dados:
```bash
npm run prisma:migrate
```

6. Popule o banco com dados iniciais:
```bash
npm run prisma:seed
```

7. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

O servidor estará rodando em `http://localhost:3001`

### Frontend

1. Instale as dependências:
```bash
npm install
```

2. Configure as variáveis de ambiente:
Crie um arquivo `.env` na raiz do projeto:
```
VITE_API_URL=http://localhost:3001
```

3. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

O frontend estará rodando em `http://localhost:5173`

## Funcionalidades Implementadas

### ✅ Backend
- [x] Estrutura completa do servidor Express + TypeScript
- [x] Banco de dados PostgreSQL com Prisma ORM
- [x] Sistema de autenticação (JWT + Refresh Tokens)
- [x] Multi-tenancy (isolamento de dados por tenant)
- [x] Rate limiting e segurança básica
- [x] Rotas de API para Leads, Tasks, Tags, Subscriptions
- [x] Integração com Mercado Pago (estrutura)
- [x] Sistema de planos e limites
- [x] Webhooks para pagamentos

### ✅ Frontend
- [x] Cliente de API configurado
- [x] Context de autenticação
- [x] Integração de login com backend

### 🚧 Em Desenvolvimento
- [ ] Rotas completas de automações
- [ ] Gerenciamento de usuários
- [ ] API Keys e Webhooks no frontend
- [ ] Migração de dados do localStorage
- [ ] Documentação completa da API

## Estrutura do Banco de Dados

O banco de dados inclui as seguintes tabelas principais:

- `users` - Usuários do sistema
- `tenants` - Organizações/Empresas
- `subscriptions` - Assinaturas e planos
- `plans` - Planos disponíveis
- `leads` - Leads do CRM
- `tasks` - Tarefas
- `tags` - Tags para organização
- `automations` - Automações
- `payments` - Histórico de pagamentos
- `whatsapp_connections` - Conexões WhatsApp
- `email_configs` - Configurações de email
- E mais...

## API Endpoints

### Autenticação
- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Atualizar token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Obter usuário atual

### Leads
- `GET /api/leads` - Listar leads
- `GET /api/leads/:id` - Obter lead específico
- `POST /api/leads` - Criar lead
- `PUT /api/leads/:id` - Atualizar lead
- `DELETE /api/leads/:id` - Deletar lead

### Tasks
- `GET /api/tasks` - Listar tarefas
- `GET /api/tasks/:id` - Obter tarefa específica
- `POST /api/tasks` - Criar tarefa
- `PUT /api/tasks/:id` - Atualizar tarefa
- `DELETE /api/tasks/:id` - Deletar tarefa

### Tags
- `GET /api/tags` - Listar tags
- `POST /api/tags` - Criar tag
- `PUT /api/tags/:id` - Atualizar tag
- `DELETE /api/tags/:id` - Deletar tag

### Subscriptions
- `GET /api/subscriptions/current` - Obter assinatura atual
- `GET /api/subscriptions/plans` - Listar planos disponíveis
- `PUT /api/subscriptions/change-plan` - Alterar plano
- `POST /api/subscriptions/cancel` - Cancelar assinatura

### Payments
- `POST /api/payments/intent` - Criar intenção de pagamento
- `GET /api/payments/history` - Histórico de pagamentos

## Desenvolvimento

### Executar testes
```bash
cd server
npm test
```

### Gerar Prisma Client
```bash
cd server
npm run prisma:generate
```

### Abrir Prisma Studio
```bash
cd server
npm run prisma:studio
```

## Produção

### Build do Backend
```bash
cd server
npm run build
npm start
```

### Build do Frontend
```bash
npm run build
```

## Licença

Este projeto é privado e proprietário.
