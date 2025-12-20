# 🔐 Credenciais Necessárias - Supabase FlowCRM

Para continuar com a configuração automática via MCP, preciso das seguintes informações do seu projeto Supabase **"FlowCRM"**:

## 📋 Informações Necessárias

### 1. DATABASE_URL (Connection String)
**Onde encontrar**: Supabase Dashboard → Settings → Database → Connection string → Transaction mode

**Formato**:
```
postgresql://postgres.xxxxx:[SUA_SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
```

⚠️ **IMPORTANTE**: Substitua `[SUA_SENHA]` pela senha que você definiu ao criar o projeto!

### 2. SUPABASE_URL
**Onde encontrar**: Supabase Dashboard → Settings → API → Project URL

**Formato**:
```
https://xxxxx.supabase.co
```

### 3. SUPABASE_ANON_KEY
**Onde encontrar**: Supabase Dashboard → Settings → API → anon public

**Formato**: Começa com `eyJ...`

### 4. SUPABASE_SERVICE_KEY (Opcional mas recomendado)
**Onde encontrar**: Supabase Dashboard → Settings → API → service_role

**Formato**: Começa com `eyJ...`

### 5. SUPABASE_ACCESS_TOKEN (Para usar MCP - Opcional)
**Onde encontrar**: 
1. Clique no seu avatar (canto superior direito)
2. Account Settings → Access Tokens
3. Generate new token
4. Nome: "Cursor MCP"
5. Copie o token (começa com `sbp_...`)

---

## 🤖 O que vou fazer quando você fornecer:

1. ✅ **Aplicar migrações do Prisma no Supabase** via MCP
2. ✅ **Gerar secrets JWT** automaticamente
3. ✅ **Configurar todas as variáveis de ambiente na Vercel** via MCP
4. ✅ **Fazer deploy na Vercel** via MCP

---

## 📝 Como fornecer as informações:

Você pode me fornecer de duas formas:

### Opção 1: Todas de uma vez
```
DATABASE_URL=postgresql://postgres.xxxxx:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_ACCESS_TOKEN=sbp_...
```

### Opção 2: Uma por uma
Me forneça cada informação conforme solicitado.

---

## ⚠️ Segurança

- **NÃO** compartilhe essas informações publicamente
- As chaves são sensíveis - mantenha-as seguras
- O Access Token é opcional, mas facilita muito o processo

---

## 🚀 Próximo Passo

**Forneça as credenciais e eu faço o resto automaticamente!**





