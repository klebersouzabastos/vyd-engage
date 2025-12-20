# DATABASE_URL - Connection String do Supabase

## ✅ Connection String Obtida

Formato base (Transaction Pooler - porta 6543):
```
postgres://postgres:[YOUR-PASSWORD]@db.zymcfjbzyfuevsuhjcnl.supabase.co:6543/postgres
```

## ⚠️ IMPORTANTE

Você precisa substituir `[YOUR-PASSWORD]` pela senha que você definiu ao criar o projeto Supabase "FlowCRM".

## Formato Final para Vercel

Após substituir a senha, a connection string deve ficar assim:
```
postgresql://postgres:SUA_SENHA_AQUI@db.zymcfjbzyfuevsuhjcnl.supabase.co:6543/postgres
```

**Nota**: O Supabase usa `postgres://` mas o Prisma/Vercel geralmente funciona melhor com `postgresql://` (ambos funcionam).

## Próximo Passo

Forneça a senha do banco de dados para eu completar a configuração!





