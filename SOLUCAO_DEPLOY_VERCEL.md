# ✅ Solução para o Erro na Vercel

## Problema Identificado

O frontend na Vercel está tentando acessar `http://localhost:3001/api/auth/me`, que **não existe em produção**.

## Causa

Falta a variável de ambiente `VITE_API_URL` na Vercel apontando para a própria aplicação.

## Solução

Adicionar a seguinte variável de ambiente na Vercel:

### Variável a adicionar:

```env
VITE_API_URL=https://flow-crm-saa-s-application.vercel.app
```

### Passos:

1. Acesse: https://vercel.com/klebers-projects-2f5727d9/flow-crm-saa-s-application/settings/environment-variables

2. Clique em "Add New"

3. Preencha:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://flow-crm-saa-s-application.vercel.app`
   - **Environment**: Selecione "Production", "Preview" e "Development"

4. Clique em "Save"

5. Faça um novo deploy ou **Redeploy** o último deployment:
   - Vá em: https://vercel.com/klebers-projects-2f5727d9/flow-crm-saa-s-application
   - Clique nos 3 pontinhos (...) no último deployment
   - Clique em "Redeploy"

## Como funciona

O arquivo `src/services/api/client.ts` está configurado assim:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

- **Local**: usa `localhost:3001` (seu servidor backend local)
- **Vercel**: usará `https://flow-crm-saa-s-application.vercel.app` (a própria URL da aplicação)

O backend na Vercel está configurado como serverless function em `api/[...route].ts`, que redireciona todas as requisições `/api/*` para o Express.

## Após o redeploy

O login deve funcionar normalmente em:
https://flow-crm-saa-s-application.vercel.app/login

Com as credenciais:
- Email: `kleber.bastos.1984@gmail.com`
- Senha: `123456`


