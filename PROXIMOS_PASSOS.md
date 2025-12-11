# 🚀 Próximos Passos - Deploy FlowCRM

## ✅ Status Atual

- ✅ Projeto Supabase criado: **"FlowCRM"**
- ✅ Projeto Vercel existente: **"flow-crm-saa-s-application"**
- ✅ Arquivos de configuração criados
- ⏳ Aguardando credenciais do Supabase

## 📋 O que você precisa fazer AGORA:

### 1. Obter Credenciais do Supabase

Acesse: https://supabase.com/dashboard → Projeto "FlowCRM"

#### 1.1 Connection String (DATABASE_URL)

1. Vá em **Settings** → **Database**
2. Role até **Connection string**
3. Selecione **Transaction mode** (porta 6543 - recomendado para Vercel)
4. Copie a connection string completa
5. **Substitua `[YOUR-PASSWORD]` pela senha que você definiu**

**Formato esperado**:
```
postgresql://postgres.xxxxx:[SUA_SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

#### 1.2 API Keys

1. Vá em **Settings** → **API**
2. Copie:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key
   - **service_role** key

#### 1.3 Access Token (para MCP)

1. Clique no seu avatar (canto superior direito)
2. **Account Settings** → **Access Tokens**
3. **Generate new token**
4. Nome: "Cursor MCP"
5. Copie o token (só aparece uma vez!)

---

## 🤖 O que EU vou fazer (via MCP):

Assim que você fornecer as informações acima, vou:

1. ✅ **Aplicar migrações no Supabase** usando o MCP
2. ✅ **Configurar variáveis de ambiente na Vercel** usando o MCP
3. ✅ **Fazer deploy na Vercel** usando o MCP

---

## 📝 Informações que preciso de você:

Por favor, forneça:

1. **DATABASE_URL**: A connection string completa (com senha substituída)
2. **SUPABASE_URL**: A URL do projeto (ex: `https://xxxxx.supabase.co`)
3. **SUPABASE_ANON_KEY**: A chave anon public
4. **SUPABASE_SERVICE_KEY**: A chave service_role (opcional, mas recomendado)
5. **SUPABASE_ACCESS_TOKEN**: O token para o MCP (opcional, mas facilita muito!)

---

## 🎯 Depois que você fornecer:

Vou executar automaticamente:

```bash
# 1. Aplicar migrações via MCP Supabase
mcp_supabase_apply_migration(
  project_id: "seu-project-id",
  name: "init",
  query: "SQL das migrações"
)

# 2. Configurar variáveis na Vercel via MCP
# (configuração automática das env vars)

# 3. Fazer deploy via MCP Vercel
mcp_vercel_deploy_to_vercel()
```

---

## 💡 Alternativa Manual:

Se preferir fazer manualmente:

### Aplicar Migrações Manualmente:

1. No Supabase Dashboard → **SQL Editor**
2. Cole o conteúdo de `server/prisma/migrations/20251125155304_init/migration.sql`
3. Execute
4. Cole o conteúdo de `server/prisma/migrations/20251125160521_make_email_required/migration.sql`
5. Execute

### Configurar Variáveis na Vercel:

1. Acesse: https://vercel.com/klebers-projects-2f5727d9/flow-crm-saa-s-application/settings/environment-variables
2. Adicione todas as variáveis necessárias

---

## ⚡ Próximo Passo:

**Forneça as credenciais do Supabase e eu faço o resto automaticamente via MCP!**

Formato sugerido:
```
DATABASE_URL=postgresql://postgres.xxxxx:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ACCESS_TOKEN=sbp_... (opcional)
```




