# Variáveis de Ambiente para Vercel - Adicionar Manualmente

## ⚠️ Problema Identificado

A automação do browser não está funcionando corretamente - os campos ficam vazios ao digitar. 

## Solução: Adicionar Manualmente

Por favor, adicione as seguintes variáveis de ambiente manualmente na Vercel:

### URL da Página:
https://vercel.com/klebers-projects-2f5727d9/flow-crm-saa-s-application/settings/environment-variables

### Variáveis para Adicionar:

1. **DATABASE_URL**
   ```
   postgresql://postgres:Ksb%40266338@db.zymcfjbzyfuevsuhjcnl.supabase.co:6543/postgres
   ```

2. **NODE_ENV**
   ```
   production
   ```

3. **FRONTEND_URL**
   ```
   https://flow-crm-saa-s-application-klebers-projects-2f5727d9.vercel.app
   ```

4. **JWT_SECRET**
   ```
   f3a7d81b80927eacba83c9873e9fbc9a78c6f1be9afa1703c4afa04493aa576c2fbd4075ed15336b8e97ac352548e67245872bdd165ce87403bd23b5434a988d
   ```

5. **JWT_REFRESH_SECRET**
   ```
   4058a55a582050f919fb0d09e00adc64e6178b5fbc16d2c6394b6b85314cef69fae81e43cf52ce20d6b82332299f67da054de2bc3813a2270c7adb026e276274
   ```

6. **SUPABASE_URL**
   ```
   https://zymcfjbzyfuevsuhjcnl.supabase.co
   ```

7. **SUPABASE_ANON_KEY**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5bWNmamJ6eWZ1ZXZzdWhqY25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODg3NTMsImV4cCI6MjA3OTY2NDc1M30.PHGDDpMqSbS8FB48zgR3qi1kDec3fh2WozxR3BbN9IM
   ```

8. **SUPABASE_SERVICE_KEY**
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5bWNmamJ6eWZ1ZXZzdWhqY25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwODg3NTMsImV4cCI6MjA3OTY2NDc1M30.PHGDDpMqSbS8FB48zgR3qi1kDec3fh2WozxR3BbN9IM
   ```

## Instruções:

1. Acesse a URL acima
2. Para cada variável:
   - Clique em "Add Another" se necessário
   - Digite o nome da variável no campo "Name"
   - Digite o valor no campo "Value"
   - Selecione "All Environments" no dropdown de ambiente
3. Após adicionar todas, clique em "Save"
4. Aguarde a confirmação de salvamento

## Alternativa: Usar Import .env

Você também pode:
1. Criar um arquivo `.env` local com todas as variáveis acima
2. Clicar em "Import .env" na página
3. Selecionar o arquivo ou colar o conteúdo

## Após Adicionar:

Após adicionar todas as variáveis, me avise para que eu possa:
- Verificar se foram salvas corretamente
- Executar as migrações do Prisma no Supabase
- Fazer o deploy na Vercel





