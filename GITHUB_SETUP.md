# Guia para Enviar o Código para o GitHub

Seu repositório Git local já está configurado e o commit inicial foi criado! Agora siga estes passos para enviar para o GitHub:

## Opção 1: Usando a Interface Web do GitHub (Recomendado)

### Passo 1: Criar o Repositório no GitHub

1. Acesse [github.com](https://github.com) e faça login
2. Clique no botão **"+"** no canto superior direito
3. Selecione **"New repository"**
4. Preencha:
   - **Repository name**: `FlowCRM-SaaS-Application` (ou o nome que preferir)
   - **Description**: "Sistema completo de CRM SaaS com autenticação, multi-tenancy, pagamentos e gerenciamento de leads"
   - **Visibility**: Escolha **Private** (recomendado) ou **Public**
   - **NÃO marque** "Initialize this repository with a README" (já temos um)
5. Clique em **"Create repository"**

### Passo 2: Conectar e Enviar o Código

Após criar o repositório, o GitHub mostrará instruções. Execute estes comandos no PowerShell:

```powershell
# Navegue até o diretório do projeto (se ainda não estiver)
cd "C:\Users\User\Documents\GitHub\FlowCRM SaaS Application Design"

# Adicione o repositório remoto (substitua SEU_USUARIO pelo seu username do GitHub)
git remote add origin https://github.com/SEU_USUARIO/FlowCRM-SaaS-Application.git

# Renomeie a branch principal para 'main' (se necessário)
git branch -M main

# Envie o código para o GitHub
git push -u origin main
```

**Nota**: Se você criou o repositório com um nome diferente, ajuste a URL acima.

## Opção 2: Usando GitHub CLI (se você tem instalado)

Se você tem o GitHub CLI instalado, pode criar o repositório diretamente:

```powershell
cd "C:\Users\User\Documents\GitHub\FlowCRM SaaS Application Design"
gh repo create FlowCRM-SaaS-Application --private --source=. --remote=origin --push
```

## Autenticação

Se for solicitada autenticação ao fazer o push:

### Usando Token de Acesso Pessoal (Recomendado)

1. Vá em GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Clique em **"Generate new token (classic)"**
3. Dê um nome e selecione os escopos: `repo` (acesso completo a repositórios privados)
4. Clique em **"Generate token"**
5. **Copie o token** (você não poderá vê-lo novamente!)
6. Ao fazer o push, use o token como senha quando solicitado

### Usando GitHub Desktop

Se preferir uma interface gráfica:
1. Instale o [GitHub Desktop](https://desktop.github.com/)
2. Abra o GitHub Desktop
3. File → Add Local Repository
4. Selecione a pasta do projeto
5. Clique em "Publish repository" no GitHub Desktop

## Verificação

Após o push bem-sucedido, você verá uma mensagem como:
```
Enumerating objects: X, done.
Counting objects: 100% (X/X), done.
...
To https://github.com/SEU_USUARIO/FlowCRM-SaaS-Application.git
 * [new branch]      main -> main
```

Acesse seu repositório no GitHub para confirmar que todos os arquivos foram enviados!

## Próximos Passos

Depois de enviar para o GitHub, você pode:
- Configurar GitHub Actions para CI/CD (já existe um arquivo `.github/workflows/deploy.yml`)
- Adicionar colaboradores ao repositório
- Criar branches para novas funcionalidades
- Configurar proteção de branches

## Comandos Úteis

```powershell
# Verificar o status do repositório
git status

# Ver o histórico de commits
git log --oneline

# Verificar repositórios remotos configurados
git remote -v

# Fazer push de futuras alterações
git add .
git commit -m "Descrição das alterações"
git push
```

