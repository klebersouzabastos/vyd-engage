# 🚀 Servidores Iniciados

## Status

✅ **Backend** iniciado em `http://localhost:3001`
✅ **Frontend** iniciado em `http://localhost:5173`

## Verificações

### 1. Backend conectado ao Supabase
Verifique nos logs do backend se aparece:
```
Database connected successfully
```

Se aparecer, significa que a conexão com o Supabase está funcionando! ✅

### 2. Frontend conectado ao Backend
- O navegador deve abrir automaticamente em `http://localhost:5173`
- Se não abrir, acesse manualmente: http://localhost:5173

### 3. Teste de Funcionalidade
1. Tente fazer um registro de novo usuário
2. Ou faça login se já tiver uma conta
3. Verifique se os dados estão sendo salvos no Supabase

## Logs

Os logs dos servidores estão sendo exibidos nos terminais. Observe:
- **Backend**: Mensagens sobre conexão com banco, rotas, etc.
- **Frontend**: Mensagens do Vite sobre build e hot reload

## Parar os Servidores

Para parar os servidores:
- Pressione `Ctrl+C` nos terminais onde estão rodando
- Ou feche os terminais

## Próximos Passos

1. ✅ Testar registro/login
2. ✅ Criar alguns leads
3. ✅ Verificar se os dados aparecem no Supabase Dashboard
4. ✅ Testar outras funcionalidades

## Troubleshooting

### Backend não conecta ao Supabase
- Verifique se o `DATABASE_URL` está correto em `server/.env`
- Verifique se a senha está URL-encoded (`%40` para `@`)
- Veja os logs do backend para erros específicos

### Frontend não conecta ao Backend
- Verifique se o backend está rodando em `http://localhost:3001`
- Abra o DevTools do navegador (F12) e veja erros na aba Console
- Verifique erros de CORS na aba Network

### Porta já em uso
- Se a porta 3001 ou 5173 estiver em uso, pare o processo que está usando
- Ou altere a porta no arquivo `.env` correspondente



