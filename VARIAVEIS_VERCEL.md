# Variáveis de Ambiente para Vercel

## Variáveis que serão adicionadas:

```env
NODE_ENV=production
FRONTEND_URL=https://flow-crm-saa-s-application-klebers-projects-2f5727d9.vercel.app
JWT_SECRET=f3a7d81b80927eacba83c9873e9fbc9a78c6f1be9afa1703c4afa04493aa576c2fbd4075ed15336b8e97ac352548e67245872bdd165ce87403bd23b5434a988d
JWT_REFRESH_SECRET=4058a55a582050f919fb0d09e00adc64e6178b5fbc16d2c6394b6b85314cef69fae81e43cf52ce20d6b82332299f67da054de2bc3813a2270c7adb026e276274
SUPABASE_URL=https://zymcfjbzyfuevsuhjcnl.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5bWNmamJ6eWZ1ZXZzdWhqY25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODg3NTMsImV4cCI6MjA3OTY2NDc1M30.PHGDDpMqSbS8FB48zgR3qi1kDec3fh2WozxR3BbN9IM
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5bWNmamJ6eWZ1ZXZzdWhqY25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODg7NTMsImV4cCI6MjA3OTY2NDc1M30.PHGDDpMqSbS8FB48zgR3qi1kDec3fh2WozxR3BbN9IM
```

## ⚠️ VARIÁVEL FALTANDO:

**DATABASE_URL** - Você precisa fornecer a connection string do Supabase:
- Vá em: Supabase Dashboard → Settings → Database → Connection string
- Selecione **Transaction mode** (porta 6543)
- Formato: `postgresql://postgres.zymcfjbzyfuevsuhjcnl:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`

## Como adicionar na Vercel:

1. Acesse: https://vercel.com/klebers-projects-2f5727d9/flow-crm-saa-s-application/settings/environment-variables
2. Para cada variável:
   - Clique no campo de nome (primeiro campo)
   - Digite o nome da variável (ex: `NODE_ENV`)
   - Clique no campo de valor (segundo campo)
   - Digite o valor (ex: `production`)
   - Selecione "All Environments" ou apenas "Production"
3. Clique em "Save"
4. Repita para cada variável

Ou use o botão "Import .env" e cole todo o conteúdo acima (incluindo DATABASE_URL quando tiver).





