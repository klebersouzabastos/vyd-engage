# Configuração do MCP do Supabase no Cursor

## Status da Instalação

✅ A configuração do MCP do Supabase foi adicionada ao arquivo `.cursor/mcp.json`

⚠️ **IMPORTANTE**: Você precisa adicionar seu token de acesso pessoal do Supabase antes de usar.

## Passo 1: Obter Token de Acesso do Supabase

1. Acesse o [Dashboard do Supabase](https://supabase.com/dashboard) e faça login
2. No canto superior direito, clique no seu avatar/perfil
3. Selecione **"Settings"** ou **"Configurações"**
4. No menu lateral, clique em **"Access Tokens"** ou **"Tokens de Acesso"**
5. Clique em **"Create New Token"** ou **"Criar Novo Token"**
6. Dê um nome descritivo (ex: "Cursor MCP Server")
7. **Copie o token gerado** (você só poderá vê-lo uma vez!)

## Passo 2: Adicionar o Token ao Arquivo de Configuração

1. Abra o arquivo `.cursor/mcp.json` no seu editor
2. Localize a linha com `"SEU_TOKEN_AQUI"`
3. Substitua `SEU_TOKEN_AQUI` pelo token que você copiou
4. Salve o arquivo

Exemplo de como deve ficar:
```json
{
  "mcpServers": {
    "vercel": {
      "url": "https://mcp.vercel.com"
    },
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      ]
    }
  }
}
```

## Passo 3: Reiniciar o Cursor

1. Feche completamente o Cursor
2. Abra o Cursor novamente
3. Vá em **Configurações** → **Tools & MCP**
4. O servidor "supabase" deve aparecer na lista de "Installed MCP Servers"

## Passo 4: Verificar Conexão

- Após reiniciar, o servidor Supabase deve aparecer na lista
- Se aparecer com status "Loading tools", aguarde alguns segundos
- Se aparecer algum erro, verifique:
  - Se o token foi inserido corretamente
  - Se o token ainda é válido
  - Verifique os logs do MCP: `Ctrl+Shift+U` → "MCP Logs"

## Recursos Disponíveis

Após a configuração, você poderá usar as ferramentas do MCP do Supabase, incluindo:
- Consultar tabelas e dados do banco
- Executar queries SQL
- Gerenciar schema do banco de dados
- Visualizar estrutura de tabelas
- E outras funcionalidades do Supabase

## Localização do Arquivo

- **Workspace**: `.cursor/mcp.json`
- **Caminho completo**: `C:\Users\User\Documents\GitHub\FlowCRM SaaS Application Design\.cursor\mcp.json`

## Troubleshooting

### O servidor não aparece após reiniciar
1. Verifique se o arquivo `.cursor/mcp.json` existe e está no formato JSON válido
2. Verifique se o token foi inserido corretamente (sem espaços extras)
3. Verifique os logs do MCP para erros

### Erro de autenticação
1. Verifique se o token ainda é válido no dashboard do Supabase
2. Gere um novo token se necessário
3. Atualize o arquivo de configuração com o novo token

### Erro ao executar comandos
1. Verifique se você tem as permissões necessárias no projeto Supabase
2. Verifique se o projeto Supabase está ativo
3. Consulte os logs do MCP para mais detalhes

## Referências

- [Documentação Supabase MCP](https://supabase.com/docs/guides/getting-started/mcp)
- [Documentação Cursor MCP](https://docs.cursor.com/tools/mcp)
- [Criar Access Token no Supabase](https://supabase.com/dashboard/account/tokens)




