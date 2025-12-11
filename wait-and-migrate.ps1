# Script para aguardar Docker estar disponível e executar migration
Write-Host "=== Aguardando Docker Desktop ===" -ForegroundColor Cyan
Write-Host ""

$maxAttempts = 60  # 5 minutos (5 segundos x 60)
$attempt = 0
$dockerReady = $false

function Test-Docker {
    try {
        $null = docker --version 2>&1
        return $true
    } catch {
        return $false
    }
}

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

Write-Host "Aguardando Docker Desktop estar disponivel..." -ForegroundColor Yellow
Write-Host "Dica: Certifique-se de que o Docker Desktop esta rodando (icone verde na bandeja)" -ForegroundColor Cyan
Write-Host ""

while ($attempt -lt $maxAttempts -and -not $dockerReady) {
    $attempt++
    
    if (Test-Docker) {
        $composeCmd = Test-DockerCompose
        if ($composeCmd) {
            Write-Host "✅ Docker encontrado!" -ForegroundColor Green
            $dockerReady = $true
            break
        }
    }
    
    if ($attempt % 6 -eq 0) {
        Write-Host "Ainda aguardando... ($attempt/$maxAttempts tentativas)" -ForegroundColor Yellow
    }
    
    Start-Sleep -Seconds 5
}

if (-not $dockerReady) {
    Write-Host ""
    Write-Host "❌ Docker nao foi encontrado apos $maxAttempts tentativas" -ForegroundColor Red
    Write-Host ""
    Write-Host "Por favor:" -ForegroundColor Yellow
    Write-Host "1. Certifique-se de que o Docker Desktop esta instalado" -ForegroundColor Yellow
    Write-Host "2. Inicie o Docker Desktop" -ForegroundColor Yellow
    Write-Host "3. Aguarde o icone ficar verde na bandeja do sistema" -ForegroundColor Yellow
    Write-Host "4. Reinicie este terminal e execute novamente" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=== Executando Migration ===" -ForegroundColor Cyan
Write-Host ""

# Executar o script de migration
& ".\check-and-migrate.ps1"






