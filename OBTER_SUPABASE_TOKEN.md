# Como Obter o Supabase Access Token

## Status Atual

⚠️ Não foi possível localizar automaticamente o botão para criar um novo token na página do Supabase via automação do browser.

## Instruções Manuais

Para obter o Access Token do Supabase manualmente:

1. **Acesse a página de tokens:**
   - URL: https://supabase.com/dashboard/account/tokens

2. **Procure por um botão "Generate New Token" ou "Create Token"** na página
   - Geralmente está localizado no canto superior direito ou próximo ao campo de filtro

3. **Clique no botão para criar um novo token:**
   - Dê um nome descritivo (ex: "Cursor MCP Server")
   - Clique em "Generate" ou "Create"

4. **Copie o token gerado:**
   - ⚠️ **IMPORTANTE**: Copie o token imediatamente, pois ele só será mostrado uma vez!

5. **Após obter o token, informe-me para que eu possa:**
   - Configurar o token no arquivo `.cursor/mcp.json`
   - Executar as migrações do Prisma no Supabase
   - Continuar com o deploy

## Alternativa: Criar Token via API

Se preferir, também é possível criar um token via API do Supabase usando as credenciais de autenticação.

## Próximos Passos

Após obter o token:
1. Informe-me o token
2. Eu configuro no MCP
3. Executo as migrações do banco de dados
4. Fazemos o deploy na Vercel





