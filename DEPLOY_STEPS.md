# 🚀 Passos para Deploy - FlowCRM na Vercel

## Estratégia de Deploy

Para este projeto, recomendamos **dois deploys separados**:
1. **Frontend** → Vercel (Static Site)
2. **Backend** → Vercel (Serverless Functions) OU Vercel (separado como API)

## 📋 Checklist Pré-Deploy

- [ ] Projeto Supabase criado
- [ ] Banco de dados configurado
- [ ] Migrações executadas
- [ ] Variáveis de ambiente preparadas
- [ ] Código commitado no Git

---

## 🗄️ PARTE 1: Configurar Supabase

### 1. Criar Projeto Supabase

1. Acesse: https://supabase.com/dashboard
2. Clique em **"New Project"**
3. Preencha:
   - **Name**: `flowcrm-production`
   - **Database Password**: ⚠️ **SALVE ESTA SENHA**
   - **Region**: Escolha a mais próxima
4. Aguarde a criação (2-3 minutos)

### 2. Obter Connection String

1. Vá em **Settings** → **Database**
2. Role até **Connection string**
3. Selecione **URI** e copie
4. Formato: `postgresql://postgres.xxxxx:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`

**⚠️ IMPORTANTE**: Use a connection string com **pooler** (porta 6543) para Vercel!

### 3. Executar Migrações

```bash
# No terminal
cd server

# Instalar dependências (se ainda não instalou)
npm install

# Configurar DATABASE_URL temporariamente
export DATABASE_URL="sua-connection-string-aqui"

# Executar migrações
npx prisma migrate deploy

# Ou executar manualmente no SQL Editor do Supabase
# Copie o conteúdo de server/prisma/migrations/*/migration.sql
```

### 4. Obter API Keys

1. Vá em **Settings** → **API**
2. Copie:
   - **Project URL**
   - **anon public** key
   - **service_role** key (mantenha segura!)

---

## ⚙️ PARTE 2: Preparar Projeto

### 1. Criar arquivo .env.example

Crie `.env.example` na raiz:

```env
# Database (Supabase)
DATABASE_URL=postgresql://postgres.xxxxx:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres

# Backend
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://seu-projeto-frontend.vercel.app
JWT_SECRET=gerar-um-secret-aleatorio-aqui
JWT_REFRESH_SECRET=gerar-outro-secret-aleatorio-aqui

# Supabase (opcional)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
```

### 2. Gerar Secrets JWT

```bash
# No terminal
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Execute duas vezes para gerar `JWT_SECRET` e `JWT_REFRESH_SECRET`.

---

## 🚀 PARTE 3: Deploy na Vercel

### Opção A: Deploy Manual via Dashboard (Recomendado)

#### 3.1 Preparar Repositório Git

```bash
# Certifique-se de que está tudo commitado
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

#### 3.2 Criar Projeto na Vercel

1. Acesse: https://vercel.com/dashboard
2. Clique em **"Add New Project"**
3. Importe seu repositório Git
4. Configure:

   **Framework Preset**: `Vite`
   
   **Root Directory**: `.` (raiz)
   
   **Build Command**: `npm run build`
   
   **Output Directory**: `build`
   
   **Install Command**: `npm install`

#### 3.3 Configurar Variáveis de Ambiente

Na Vercel, vá em **Settings** → **Environment Variables** e adicione:

```
DATABASE_URL = postgresql://postgres.xxxxx:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
NODE_ENV = production
FRONTEND_URL = https://seu-projeto.vercel.app
JWT_SECRET = seu-jwt-secret-aqui
JWT_REFRESH_SECRET = seu-refresh-secret-aqui
```

**⚠️ IMPORTANTE**: 
- Marque todas como **Production**
- Use a connection string com **pooler** (porta 6543)
- Após o primeiro deploy, atualize `FRONTEND_URL` com a URL real

#### 3.4 Fazer Deploy

1. Clique em **"Deploy"**
2. Aguarde o build completar
3. Anote a URL gerada (ex: `https://flowcrm.vercel.app`)

#### 3.5 Atualizar FRONTEND_URL

1. Após o primeiro deploy, copie a URL
2. Vá em **Settings** → **Environment Variables**
3. Atualize `FRONTEND_URL` com a URL real
4. Faça um novo deploy

### Opção B: Deploy via CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# No diretório raiz do projeto
vercel

# Siga as instruções:
# - Link to existing project? No (primeira vez)
# - Project name: flowcrm
# - Directory: ./
# - Override settings? No

# Para produção
vercel --prod
```

---

## 🔧 PARTE 4: Configurar Backend como Serverless Function

O arquivo `api/[...route].ts` já está criado para converter o Express em serverless function.

**Nota**: Se preferir manter o backend separado, você pode:
1. Criar um projeto separado na Vercel apenas para o backend
2. Ou usar outra plataforma (Railway, Render, etc.)

---

## ✅ PARTE 5: Verificar Deploy

### 1. Testar Frontend

1. Acesse a URL do deploy
2. Verifique se a página carrega
3. Teste navegação básica

### 2. Testar API

1. Acesse: `https://seu-projeto.vercel.app/api/health`
2. Deve retornar status 200

### 3. Testar Autenticação

1. Tente fazer registro/login
2. Verifique os logs na Vercel se houver erro

### 4. Verificar Logs

1. Na Vercel: **Deployments** → Seu deploy → **Functions**
2. Verifique logs de erro
3. Verifique conexão com banco de dados

---

## 🐛 Troubleshooting Comum

### Erro: "Cannot connect to database"

**Solução**:
- Verifique se `DATABASE_URL` está correta
- Use connection string com **pooler** (porta 6543)
- Verifique se o banco está ativo no Supabase

### Erro: "CORS policy"

**Solução**:
- Verifique se `FRONTEND_URL` está configurada corretamente
- Certifique-se de que a URL não tem barra no final

### Erro: "Module not found"

**Solução**:
- Verifique se todas as dependências estão no `package.json`
- Execute `npm install` localmente para verificar

### Build falha

**Solução**:
- Verifique os logs de build na Vercel
- Certifique-se de que o Node.js version está correto (20+)
- Verifique se há erros de TypeScript

---

## 📝 Próximos Passos Após Deploy

1. ✅ Configurar domínio customizado
2. ✅ Configurar CI/CD (deploy automático)
3. ✅ Configurar monitoramento
4. ✅ Configurar backups do Supabase
5. ✅ Configurar SSL/HTTPS (automático na Vercel)

---

## 🔗 Links Úteis

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Documentação Vercel**: https://vercel.com/docs
- **Documentação Supabase**: https://supabase.com/docs

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs na Vercel
2. Verifique os logs no Supabase
3. Consulte a documentação oficial
4. Verifique o arquivo `DEPLOY_GUIDE.md` para mais detalhes





