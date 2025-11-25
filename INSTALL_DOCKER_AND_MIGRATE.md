# Guia Completo: Instalar Docker Desktop e Executar Migration

## Passo 1: Instalar Docker Desktop

### 1.1 Download
1. Acesse: https://www.docker.com/products/docker-desktop/
2. Clique em "Download for Windows"
3. Baixe o instalador `Docker Desktop Installer.exe`

### 1.2 Instalação
1. Execute o instalador baixado
2. Siga as instruções do assistente de instalação
3. **IMPORTANTE**: Marque a opção "Use WSL 2 instead of Hyper-V" (se disponível)
4. Conclua a instalação e reinicie o computador se solicitado

### 1.3 Iniciar Docker Desktop
1. Após a instalação, inicie o Docker Desktop
2. Aguarde até que o ícone do Docker na bandeja do sistema fique verde/ativo
3. Isso pode levar alguns minutos na primeira inicialização

### 1.4 Verificar Instalação
Abra um novo terminal/PowerShell e execute:
```bash
docker --version
docker-compose --version
```

Se ambos os comandos retornarem versões, a instalação foi bem-sucedida!

## Passo 2: Executar a Migration

Após o Docker Desktop estar rodando:

### 2.1 Iniciar PostgreSQL
```bash
# Na raiz do projeto
docker-compose up -d postgres
```

### 2.2 Aguardar o Banco Inicializar
Aguarde 10-15 segundos para o PostgreSQL inicializar completamente.

### 2.3 Executar a Migration
```bash
cd server
npm run prisma:migrate dev --name make_email_optional
```

### 2.4 Verificar Sucesso
Você deve ver uma mensagem como:
```
✔ Migration `make_email_optional` applied successfully.
```

## Passo 3: Verificar a Migration

### 3.1 Abrir Prisma Studio
```bash
cd server
npm run prisma:studio
```

Isso abrirá o Prisma Studio no navegador onde você pode verificar que o campo `email` na tabela `User` agora é opcional.

### 3.2 Verificar via SQL (Opcional)
Se preferir verificar diretamente no banco:
```bash
docker exec -it flowcrm-postgres psql -U flowcrm -d flowcrm
```

Depois execute:
```sql
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'User' AND column_name = 'email';
```

Deve retornar: `email | YES | character varying`

## Troubleshooting

### Erro: "docker-compose: command not found"
- Use `docker compose` (sem hífen) em vez de `docker-compose`
- Ou reinstale o Docker Desktop

### Erro: "Cannot connect to Docker daemon"
- Certifique-se de que o Docker Desktop está rodando
- Verifique o ícone na bandeja do sistema

### Erro: "Port 5432 is already in use"
- Outro PostgreSQL pode estar rodando na porta 5432
- Pare o serviço ou altere a porta no `docker-compose.yml`

### Erro: "Can't reach database server"
- Aguarde mais alguns segundos para o PostgreSQL inicializar
- Verifique os logs: `docker-compose logs postgres`

## Próximos Passos Após Migration

1. ✅ Migration aplicada com sucesso
2. Teste o cadastro sem email no frontend
3. Verifique que múltiplos usuários podem ter email NULL
4. Verifique que emails não-nulos são únicos

