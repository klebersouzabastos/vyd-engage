# Script para verificar Docker e executar migration automaticamente
# Execute este script após instalar o Docker Desktop

$ErrorActionPreference = "Stop"

Write-Host "`n=== Verificação e Execução de Migration ===" -ForegroundColor Cyan
Write-Host ""

# Função para verificar Docker
function Test-Docker {
    try {
        $null = docker --version 2>&1
        return $true
    } catch {
        return $false
    }
}

# Função para verificar Docker Compose
function Test-DockerCompose {
    try {
        $null = docker-compose --version 2>&1
        return "docker-compose"
    } catch {
        try {
            $null = docker compose version 2>&1
            return "docker compose"
        } catch {
            return $null
        }
    }
}

# Verificar Docker
Write-Host "1. Verificando Docker..." -ForegroundColor Yellow
if (-not (Test-Docker)) {
    Write-Host "   ❌ Docker não encontrado!" -ForegroundColor Red
    Write-Host "   Por favor, instale o Docker Desktop primeiro." -ForegroundColor Yellow
    Write-Host "   Acesse: https://www.docker.com/products/docker-desktop/" -ForegroundColor Cyan
    exit 1
}
Write-Host "   ✅ Docker encontrado" -ForegroundColor Green

# Verificar Docker Compose
Write-Host "2. Verificando Docker Compose..." -ForegroundColor Yellow
$composeCmd = Test-DockerCompose
if (-not $composeCmd) {
    Write-Host "   ❌ Docker Compose não encontrado!" -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Docker Compose encontrado ($composeCmd)" -ForegroundColor Green

# Verificar/Iniciar PostgreSQL
Write-Host "3. Verificando PostgreSQL..." -ForegroundColor Yellow
$postgresContainer = docker ps -a --filter "name=flowcrm-postgres" --format "{{.Names}}" 2>&1

if ($postgresContainer -match "flowcrm-postgres") {
    $postgresRunning = docker ps --filter "name=flowcrm-postgres" --format "{{.Names}}" 2>&1
    if ($postgresRunning -match "flowcrm-postgres") {
        Write-Host "   ✅ PostgreSQL já está rodando" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Container existe mas não está rodando. Iniciando..." -ForegroundColor Yellow
        if ($composeCmd -eq "docker-compose") {
            docker-compose up -d postgres
        } else {
            docker compose up -d postgres
        }
        Write-Host "   ✅ PostgreSQL iniciado" -ForegroundColor Green
        Write-Host "   ⏳ Aguardando 15 segundos para inicialização..." -ForegroundColor Yellow
        Start-Sleep -Seconds 15
    }
} else {
    Write-Host "   ⚠️  Container não encontrado. Criando e iniciando..." -ForegroundColor Yellow
    if ($composeCmd -eq "docker-compose") {
        docker-compose up -d postgres
    } else {
        docker compose up -d postgres
    }
    Write-Host "   ✅ PostgreSQL criado e iniciado" -ForegroundColor Green
    Write-Host "   ⏳ Aguardando 15 segundos para inicialização..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
}

# Verificar conexão com banco
Write-Host "4. Verificando conexão com banco de dados..." -ForegroundColor Yellow
$maxRetries = 5
$retryCount = 0
$connected = $false

while ($retryCount -lt $maxRetries -and -not $connected) {
    $dbCheck = docker exec flowcrm-postgres pg_isready -U flowcrm 2>&1
    if ($dbCheck -match "accepting connections") {
        $connected = $true
        Write-Host "   ✅ Banco de dados pronto" -ForegroundColor Green
    } else {
        $retryCount++
        if ($retryCount -lt $maxRetries) {
            Write-Host "   ⏳ Tentativa $retryCount/$maxRetries - Aguardando 5 segundos..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
        }
    }
}

if (-not $connected) {
    Write-Host "   ❌ Não foi possível conectar ao banco de dados" -ForegroundColor Red
    Write-Host "   Verifique os logs: docker-compose logs postgres" -ForegroundColor Yellow
    exit 1
}

# Executar migration
Write-Host "5. Executando migration..." -ForegroundColor Yellow
Set-Location "server"

try {
    npm run prisma:migrate dev --name make_email_optional
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "════════════════════════════════════════" -ForegroundColor Green
        Write-Host "✅ MIGRATION EXECUTADA COM SUCESSO!" -ForegroundColor Green
        Write-Host "════════════════════════════════════════" -ForegroundColor Green
        Write-Host ""
        Write-Host "Próximos passos:" -ForegroundColor Cyan
        Write-Host "  • Teste o cadastro sem email no frontend"
        Write-Host "  • Verifique no Prisma Studio: npm run prisma:studio"
        Write-Host ""
    } else {
        throw "Migration falhou com código de saída $LASTEXITCODE"
    }
} catch {
    Write-Host ""
    Write-Host "❌ Erro ao executar migration:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Set-Location ".."
    exit 1
}

Set-Location ".."
Write-Host ""

