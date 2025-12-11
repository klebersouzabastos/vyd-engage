# Script PowerShell para executar a migration após Docker estar instalado
# Execute este script após instalar o Docker Desktop

Write-Host "=== Script de Migration do FlowCRM ===" -ForegroundColor Cyan
Write-Host ""

# Verificar se Docker está disponível
Write-Host "Verificando Docker..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "✅ Docker encontrado: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker não encontrado!" -ForegroundColor Red
    Write-Host "Por favor, instale o Docker Desktop primeiro." -ForegroundColor Yellow
    Write-Host "Acesse: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}

# Verificar se docker-compose está disponível
Write-Host "Verificando Docker Compose..." -ForegroundColor Yellow
try {
    $composeVersion = docker-compose --version 2>&1
    Write-Host "✅ Docker Compose encontrado: $composeVersion" -ForegroundColor Green
    $useCompose = $true
} catch {
    try {
        $composeVersion = docker compose version 2>&1
        Write-Host "✅ Docker Compose encontrado (nova sintaxe): $composeVersion" -ForegroundColor Green
        $useCompose = $false
    } catch {
        Write-Host "❌ Docker Compose não encontrado!" -ForegroundColor Red
        exit 1
    }
}

# Verificar se PostgreSQL está rodando
Write-Host "Verificando container PostgreSQL..." -ForegroundColor Yellow
$postgresRunning = docker ps --filter "name=flowcrm-postgres" --format "{{.Names}}" 2>&1
if ($postgresRunning -match "flowcrm-postgres") {
    Write-Host "✅ PostgreSQL já está rodando" -ForegroundColor Green
} else {
    Write-Host "Iniciando PostgreSQL..." -ForegroundColor Yellow
    if ($useCompose) {
        docker-compose up -d postgres
    } else {
        docker compose up -d postgres
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao iniciar PostgreSQL" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ PostgreSQL iniciado" -ForegroundColor Green
    Write-Host "Aguardando 15 segundos para inicialização..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
}

# Verificar conexão com o banco
Write-Host "Verificando conexão com o banco de dados..." -ForegroundColor Yellow
$dbCheck = docker exec flowcrm-postgres pg_isready -U flowcrm 2>&1
if ($dbCheck -match "accepting connections") {
    Write-Host "✅ Banco de dados pronto" -ForegroundColor Green
} else {
    Write-Host "⚠️  Banco ainda inicializando, aguardando mais 10 segundos..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# Executar migration
Write-Host ""
Write-Host "Executando migration..." -ForegroundColor Yellow
Set-Location "server"
npm run prisma:migrate dev --name make_email_optional

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Migration executada com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Próximos passos:" -ForegroundColor Cyan
    Write-Host "1. Teste o cadastro sem email no frontend"
    Write-Host "2. Verifique no Prisma Studio: npm run prisma:studio"
} else {
    Write-Host ""
    Write-Host "❌ Erro ao executar migration" -ForegroundColor Red
    Write-Host "Verifique os erros acima" -ForegroundColor Yellow
    exit 1
}

Set-Location ".."






