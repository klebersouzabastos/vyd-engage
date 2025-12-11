# Configuração do MCP da Vercel no Cursor

## Status da Instalação

✅ O arquivo de configuração do MCP da Vercel foi criado em:
- **Workspace**: `.cursor/mcp.json` (arquivo principal)
- **Global**: `C:\Users\User\AppData\Roaming\Cursor\User\globalStorage\mcp.json` (backup)

## Como Habilitar no Cursor

### Passo 1: Abrir Configurações do Cursor
1. Abra o Cursor
2. Pressione `Ctrl + ,` (ou vá em **File > Preferences > Settings**)
3. Ou use o comando `Ctrl + Shift + P` e digite "Preferences: Open Settings"

### Passo 2: Navegar até a Seção MCP
1. Na barra de pesquisa das configurações, digite "MCP"
2. Procure pela seção **"MCP Servers"** ou **"Model Context Protocol"**
3. Você deve ver a opção para gerenciar servidores MCP

### Passo 3: Verificar/Adicionar o Servidor Vercel
1. O arquivo `.cursor/mcp.json` já foi criado no workspace com a configuração do Vercel
2. Após reiniciar o Cursor, o servidor Vercel deve aparecer na lista de "Installed MCP Servers"
3. Se não aparecer automaticamente:
   - Clique em **"New MCP Server"** ou **"+ Adicionar novo servidor MCP"**
   - O servidor Vercel deve aparecer automaticamente com a configuração:
     ```json
     {
       "vercel": {
         "url": "https://mcp.vercel.com"
       }
     }
     ```

### Passo 4: Autenticar-se na Vercel
1. Após adicionar o servidor, você verá um aviso indicando **"Needs login"** ou **"Precisa de login"**
2. Clique nesse aviso
3. Uma janela do navegador será aberta para autorizar o Cursor a acessar sua conta Vercel
4. Siga as instruções para concluir a autenticação

### Passo 5: Verificar Conexão
- Após a autenticação, o Cursor tentará conectar-se ao servidor MCP da Vercel
- Se a conexão for bem-sucedida, o servidor estará disponível para uso

## Arquivo de Configuração Criado

O arquivo `mcp.json` foi criado com o seguinte conteúdo:

```json
{
  "mcpServers": {
    "vercel": {
      "url": "https://mcp.vercel.com"
    }
  }
}
```

## Localização do Arquivo

O arquivo de configuração foi criado em dois locais:

1. **Workspace (Principal)**: `.cursor/mcp.json` no diretório do projeto
   - Este é o arquivo que o Cursor verifica primeiro
   - Caminho completo: `C:\Users\User\Documents\GitHub\FlowCRM SaaS Application Design\.cursor\mcp.json`

2. **Global (Backup)**: `%APPDATA%\Cursor\User\globalStorage\mcp.json`
   - Caminho completo: `C:\Users\User\AppData\Roaming\Cursor\User\globalStorage\mcp.json`

## Recursos Disponíveis

Após a configuração, você poderá usar as ferramentas do MCP da Vercel, incluindo:
- Gerenciamento de projetos Vercel
- Deploy de aplicações
- Visualização de logs e métricas
- Gerenciamento de domínios
- E outras funcionalidades da plataforma Vercel

## Troubleshooting

Se o servidor não aparecer nas configurações:
1. Reinicie o Cursor completamente
2. Verifique se o arquivo `mcp.json` existe no caminho mencionado acima
3. Verifique se você está usando a versão mais recente do Cursor
4. Consulte a [documentação oficial do Cursor sobre MCP](https://docs.cursor.com/tools/mcp)

## Referências

- [Documentação Vercel MCP](https://vercel.com/docs/mcp/vercel-mcp)
- [Documentação Cursor MCP](https://docs.cursor.com/tools/mcp)


