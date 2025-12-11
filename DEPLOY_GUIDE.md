# Guia de Deploy - FlowCRM na Vercel com Supabase

Este guia detalha o processo completo de deploy do FlowCRM na Vercel usando Supabase como banco de dados.

## 📋 Pré-requisitos

- Conta na Vercel (já configurada ✅)
- Conta no Supabase
- Node.js 20+ instalado localmente
- Git configurado

## 🗄️ Passo 1: Configurar Supabase

### 1.1 Criar Projeto no Supabase

1. Acesse [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Clique em **"New Project"**
3. Preencha:
   - **Name**: `flowcrm` (ou outro nome de sua escolha)
   - **Database Password**: Crie uma senha forte e **salve em local seguro**
   - **Region**: Escolha a região mais próxima (ex: `South America (São Paulo)`)
4. Clique em **"Create new project"**
5. Aguarde a criação do projeto (pode levar alguns minutos)

### 1.2 Obter Credenciais do Supabase

1. No dashboard do projeto, vá em **Settings** → **Database**
2. Copie as seguintes informações:
   - **Connection string** (URI) - formato: `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres`
   - Ou use as credenciais individuais:
     - **Host**: `db.xxxxx.supabase.co`
     - **Database name**: `postgres`
     - **Port**: `5432`
     - **User**: `postgres`
     - **Password**: (a senha que você criou)

### 1.3 Configurar Banco de Dados

1. No dashboard do Supabase, vá em **SQL Editor**
2. Execute as migrações do Prisma:

```bash
# No terminal, na raiz do projeto
cd server
npx prisma migrate deploy
```

Ou execute manualmente as migrações SQL do diretório `server/prisma/migrations/`

### 1.4 Obter API Keys do Supabase

1. No dashboard, vá em **Settings** → **API**
2. Copie:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: (chave pública)
   - **service_role key**: (chave privada - mantenha segura)

## 🚀 Passo 2: Configurar Vercel

### 2.1 Verificar Projeto Existente

Você já tem um projeto na Vercel chamado `flow-crm-saa-s-application`. Vamos usar este ou criar um novo.

### 2.2 Configurar Variáveis de Ambiente

No dashboard da Vercel:

1. Vá em **Settings** → **Environment Variables**
2. Adicione as seguintes variáveis:

#### Variáveis do Banco de Dados (Supabase)
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?pgbouncer=true&connection_limit=1
```

**Importante**: Use a connection string do Supabase com `?pgbouncer=true&connection_limit=1` para melhor performance na Vercel.

#### Variáveis do Backend
```
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://seu-projeto.vercel.app
JWT_SECRET=seu-jwt-secret-super-seguro-aqui
JWT_REFRESH_SECRET=seu-refresh-secret-super-seguro-aqui
```

#### Variáveis do Supabase (se necessário)
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_KEY=sua-chave-service-role
```

#### Variáveis de Pagamento (Mercado Pago - opcional)
```
MERCADOPAGO_ACCESS_TOKEN=seu-token-do-mercadopago
MERCADOPAGO_PUBLIC_KEY=sua-chave-publica
```

#### Variáveis de Email (opcional)
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-de-app
```

### 2.3 Configurar Build Settings

Na Vercel, vá em **Settings** → **General** → **Build & Development Settings**:

**Root Directory**: Deixe vazio (raiz do projeto)

**Build Command**:
```bash
npm run build
```

**Output Directory**: `build`

**Install Command**:
```bash
npm install
```

## 📦 Passo 3: Preparar Projeto para Deploy

### 3.1 Atualizar package.json

O `package.json` principal já está configurado. Verifique se tem o script de build:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```

### 3.2 Criar arquivo .env.example

Crie um arquivo `.env.example` na raiz com todas as variáveis necessárias (sem valores sensíveis):

```env
# Database
DATABASE_URL=

# Backend
NODE_ENV=production
PORT=3001
FRONTEND_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
```

### 3.3 Atualizar vite.config.ts

O arquivo já está configurado corretamente. O build será gerado em `build/`.

### 3.4 Configurar CORS no Backend

O arquivo `server/src/index.ts` já tem CORS configurado. Certifique-se de que `FRONTEND_URL` está definida corretamente.

## 🔧 Passo 4: Deploy na Vercel

### Opção A: Deploy via CLI da Vercel

1. Instale a CLI da Vercel:
```bash
npm i -g vercel
```

2. Faça login:
```bash
vercel login
```

3. No diretório raiz do projeto:
```bash
vercel
```

4. Siga as instruções:
   - Link to existing project? **Yes**
   - Which project? **flow-crm-saa-s-application**
   - Override settings? **No**

5. Para produção:
```bash
vercel --prod
```

### Opção B: Deploy via Git (Recomendado)

1. Certifique-se de que o código está no GitHub/GitLab/Bitbucket
2. Na Vercel, vá em **Add New Project**
3. Importe o repositório
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `.` (raiz)
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
5. Adicione as variáveis de ambiente
6. Clique em **Deploy**

## ✅ Passo 5: Verificar Deploy

Após o deploy:

1. Acesse a URL fornecida pela Vercel
2. Verifique se o frontend carrega corretamente
3. Teste o login/registro
4. Verifique os logs na Vercel:
   - **Deployments** → Seu deploy → **Functions** → Ver logs

## 🔍 Troubleshooting

### Erro de conexão com banco de dados

- Verifique se `DATABASE_URL` está correta
- Use a connection string com `pgbouncer=true` para Vercel
- Verifique se o IP da Vercel está na allowlist do Supabase (se necessário)

### Erro 404 nas rotas da API

- Verifique o arquivo `vercel.json`
- Certifique-se de que as rotas estão configuradas corretamente
- Verifique se o backend está sendo buildado corretamente

### Erro de build

- Verifique os logs de build na Vercel
- Certifique-se de que todas as dependências estão no `package.json`
- Verifique se o Node.js version está correto (20+)

### CORS errors

- Verifique se `FRONTEND_URL` está configurada corretamente
- Verifique as configurações de CORS no `server/src/index.ts`

## 📝 Próximos Passos

1. Configurar domínio customizado (opcional)
2. Configurar CI/CD para deploys automáticos
3. Configurar monitoramento e logs
4. Configurar backups do banco de dados no Supabase

## 🔗 Links Úteis

- [Documentação Vercel](https://vercel.com/docs)
- [Documentação Supabase](https://supabase.com/docs)
- [Prisma com Supabase](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)




