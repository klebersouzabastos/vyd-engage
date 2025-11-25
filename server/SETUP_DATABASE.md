# Guia de Configuração do Banco de Dados

## Situação Atual

✅ Arquivo `.env` criado com sucesso!
❌ PostgreSQL não está rodando

## Opções para Iniciar o PostgreSQL

### Opção 1: Usando Docker (Recomendado)

Se você tem Docker instalado:

1. Inicie o PostgreSQL usando Docker Compose:
   ```bash
   # Na raiz do projeto (não dentro de server/)
   docker-compose up -d postgres
   ```

2. Aguarde alguns segundos para o banco inicializar

3. Execute a migration:
   ```bash
   cd server
   npm run prisma:migrate dev --name make_email_optional
   ```

### Opção 2: PostgreSQL Local

Se você tem PostgreSQL instalado localmente:

1. Crie o banco de dados (se ainda não existir):
   ```sql
   CREATE DATABASE flowcrm;
   CREATE USER flowcrm WITH PASSWORD 'flowcrm_dev_password';
   GRANT ALL PRIVILEGES ON DATABASE flowcrm TO flowcrm;
   ```

2. Atualize o arquivo `server/.env` com suas credenciais:
   ```
   DATABASE_URL="postgresql://seu_usuario:sua_senha@localhost:5432/flowcrm"
   ```

3. Execute a migration:
   ```bash
   cd server
   npm run prisma:migrate dev --name make_email_optional
   ```

### Opção 3: PostgreSQL em Servidor Remoto

Se você tem um PostgreSQL em outro servidor:

1. Atualize o arquivo `server/.env`:
   ```
   DATABASE_URL="postgresql://usuario:senha@host:porta/flowcrm"
   ```

2. Execute a migration:
   ```bash
   cd server
   npm run prisma:migrate dev --name make_email_optional
   ```

## Verificação

Após iniciar o PostgreSQL, você pode verificar a conexão:

```bash
cd server
npm run prisma:studio
```

Isso abrirá o Prisma Studio no navegador, permitindo visualizar o banco de dados.

## Próximos Passos Após a Migration

1. ✅ Migration executada com sucesso
2. Gere o cliente Prisma (se necessário):
   ```bash
   npm run prisma:generate
   ```
3. Teste o cadastro sem email no frontend

## Troubleshooting

### Erro: "Can't reach database server"
- Verifique se o PostgreSQL está rodando
- Verifique se a porta 5432 está disponível
- Verifique as credenciais no arquivo `.env`

### Erro: "Database does not exist"
- Crie o banco de dados manualmente ou use `prisma migrate dev` que cria automaticamente

### Erro: "Permission denied"
- Verifique se o usuário tem permissões no banco de dados
- No PostgreSQL local, você pode precisar usar o usuário `postgres`

