# Configuração do Docker para PostgreSQL

## Situação Atual

O Docker não está disponível no PATH do sistema. Você precisa instalar o Docker Desktop ou adicionar o Docker ao PATH.

## Opção 1: Instalar Docker Desktop (Recomendado)

1. Baixe o Docker Desktop para Windows:
   - Acesse: https://www.docker.com/products/docker-desktop/
   - Baixe e instale o Docker Desktop

2. Após a instalação:
   - Reinicie o terminal/PowerShell
   - Execute: `docker --version` para verificar

3. Inicie o PostgreSQL:
   ```bash
   docker-compose up -d postgres
   ```

4. Execute a migration:
   ```bash
   cd server
   npm run prisma:migrate dev --name make_email_optional
   ```

## Opção 2: Usar PostgreSQL Local (Alternativa)

Se você já tem PostgreSQL instalado localmente:

1. Certifique-se de que o PostgreSQL está rodando na porta 5432

2. Crie o banco de dados (se necessário):
   ```sql
   CREATE DATABASE flowcrm;
   CREATE USER flowcrm WITH PASSWORD 'flowcrm_dev_password';
   GRANT ALL PRIVILEGES ON DATABASE flowcrm TO flowcrm;
   ```

3. Atualize o arquivo `server/.env` se suas credenciais forem diferentes

4. Execute a migration:
   ```bash
   cd server
   npm run prisma:migrate dev --name make_email_optional
   ```

## Opção 3: Usar PostgreSQL em Servidor Remoto

Se você tem acesso a um PostgreSQL remoto:

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

Após iniciar o PostgreSQL e executar a migration:

```bash
cd server
npm run prisma:studio
```

Isso abrirá o Prisma Studio no navegador para visualizar o banco de dados.

## Próximos Passos

Após a migration ser executada com sucesso:

1. ✅ O campo `email` na tabela `User` será opcional (nullable)
2. ✅ A constraint UNIQUE será mantida para emails não-nulos
3. ✅ Você poderá cadastrar usuários sem email no frontend







