# Migração do Banco de Dados - Supabase

## Status

⚠️ **O MCP do Supabase requer um access token configurado**

Para aplicar as migrações, você precisa:

1. Obter o Supabase Access Token:
   - Acesse: https://supabase.com/dashboard/account/tokens
   - Crie um novo token
   - Adicione ao arquivo `.cursor/mcp.json` na seção do Supabase MCP

2. Após configurar o token, execute a migração via MCP ou manualmente via SQL Editor do Supabase.

## SQL da Migração Completa

A migração completa está pronta e inclui:
- Todos os ENUMs necessários
- Todas as tabelas do schema Prisma
- Todos os índices
- Todas as foreign keys

A migração SQL está disponível em: `server/prisma/migrations/20251125155304_init/migration.sql`

## Próximos Passos

1. Configure o Supabase Access Token no MCP
2. Execute a migração via MCP ou SQL Editor
3. Verifique se todas as tabelas foram criadas corretamente





