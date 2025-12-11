# Configuração do Supabase - FlowCRM

## ✅ Projeto Criado: "FlowCRM"

Agora precisamos obter as credenciais e configurar o banco de dados.

## 📋 Passo 1: Obter Credenciais do Supabase

### 1.1 Acessar o Dashboard

1. Acesse: https://supabase.com/dashboard
2. Selecione o projeto **"FlowCRM"**

### 1.2 Obter Connection String (DATABASE_URL)

1. Vá em **Settings** → **Database**
2. Role até a seção **Connection string**
3. Selecione a aba **URI**
4. **IMPORTANTE**: Use a connection string com **Session mode** (porta 5432) OU **Transaction mode** (porta 6543 - recomendado para Vercel)
5. Copie a connection string completa

**Formato esperado**:
```
postgresql://postgres.xxxxx:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

⚠️ **Substitua `[PASSWORD]` pela senha que você definiu ao criar o projeto!**

### 1.3 Obter API Keys

1. Vá em **Settings** → **API**
2. Copie as seguintes informações:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key: (chave pública - começa com `eyJ...`)
   - **service_role** key: (chave privada - mantenha segura!)

### 1.4 Obter Access Token (para MCP)

1. No canto superior direito, clique no seu avatar
2. Vá em **Account Settings** → **Access Tokens**
3. Clique em **"Generate new token"**
4. Dê um nome: "Cursor MCP"
5. Copie o token gerado (você só verá uma vez!)

## 📋 Passo 2: Executar Migrações

Após obter a connection string, execute:

```bash
cd server
export DATABASE_URL="sua-connection-string-aqui"
npx prisma migrate deploy
```

Ou execute manualmente no **SQL Editor** do Supabase:
1. Vá em **SQL Editor** no dashboard
2. Abra o arquivo `server/prisma/migrations/20251125155304_init/migration.sql`
3. Cole e execute o SQL
4. Execute também `server/prisma/migrations/20251125160521_make_email_required/migration.sql`

## 📋 Passo 3: Configurar MCP do Supabase (Opcional)

Se quiser usar o MCP do Supabase, atualize o arquivo `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "vercel": {
      "url": "https://mcp.vercel.com"
    },
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "SEU_ACCESS_TOKEN_AQUI"
      ]
    }
  }
}
```

Substitua `SEU_ACCESS_TOKEN_AQUI` pelo token obtido no Passo 1.4.

## 📋 Próximos Passos

Após obter todas as informações:
1. ✅ Connection String (DATABASE_URL)
2. ✅ Project URL (SUPABASE_URL)
3. ✅ API Keys (anon e service_role)
4. ✅ Executar migrações

Vamos configurar as variáveis de ambiente na Vercel usando o MCP!




