# Instruções para Executar a Migration

## Opção 1: Usando Prisma Migrate (Recomendado)

Se você tem o banco de dados configurado:

1. Certifique-se de que o arquivo `.env` existe no diretório `server/` com a variável `DATABASE_URL`:
   ```
   DATABASE_URL="postgresql://usuario:senha@localhost:5432/nome_do_banco"
   ```

2. Execute a migration:
   ```bash
   cd server
   npm run prisma:migrate dev --name make_email_optional
   ```

## Opção 2: Migration Manual (SQL)

Se preferir executar manualmente ou se não tiver o Prisma configurado:

1. Execute o SQL no seu banco de dados PostgreSQL:
   ```sql
   -- Drop the existing unique constraint on email
   ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key";
   
   -- Alter the email column to be nullable
   ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
   
   -- Recreate the unique constraint (PostgreSQL allows NULL values in unique constraints)
   ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email");
   ```

2. Depois, gere o cliente Prisma:
   ```bash
   cd server
   npm run prisma:generate
   ```

## Verificação

Após executar a migration, você pode verificar se funcionou:

```sql
-- Verificar a estrutura da tabela User
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'User' AND column_name = 'email';

-- Deve retornar: email | YES | character varying
```

## Notas Importantes

- PostgreSQL permite múltiplos valores NULL em colunas com constraint UNIQUE
- Isso significa que vários usuários podem ter email NULL
- Mas cada email não-nulo deve ser único
- A migration é reversível se necessário







