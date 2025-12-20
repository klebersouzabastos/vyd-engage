# Script para instalar WSL (deve ser executado como Administrador)
# Botão direito -> Executar com PowerShell como Administrador

Write-Host "=== Instalacao do WSL ===" -ForegroundColor Cyan
Write-Host ""

# Verificar se está rodando como administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERRO: Este script precisa ser executado como Administrador!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Como executar:" -ForegroundColor Yellow
    Write-Host "1. Botao direito no arquivo install-wsl.ps1" -ForegroundColor Yellow
    Write-Host "2. Selecione 'Executar com PowerShell'" -ForegroundColor Yellow
    Write-Host "3. OU abra PowerShell como Administrador e execute:" -ForegroundColor Yellow
    Write-Host "   .\install-wsl.ps1" -ForegroundColor Green
    Write-Host ""
    pause
    exit 1
}

Write-Host "Instalando WSL..." -ForegroundColor Yellow
Write-Host "Isso pode levar alguns minutos..." -ForegroundColor Yellow
Write-Host ""

try {
    wsl --install
    
    Write-Host ""
    Write-Host "✅ WSL instalado com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANTE:" -ForegroundColor Yellow
    Write-Host "1. REINICIE o computador se solicitado" -ForegroundColor Yellow
    Write-Host "2. Apos reiniciar, inicie o Docker Desktop" -ForegroundColor Yellow
    Write-Host "3. Aguarde o Docker Desktop inicializar completamente" -ForegroundColor Yellow
    Write-Host "4. Execute: .\check-and-migrate.ps1" -ForegroundColor Green
    
} catch {
    Write-Host ""
    Write-Host "❌ Erro ao instalar WSL:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Tente instalar manualmente:" -ForegroundColor Yellow
    Write-Host "1. Abra 'Ativar ou desativar recursos do Windows'" -ForegroundColor Yellow
    Write-Host "2. Marque 'Subsistema do Windows para Linux'" -ForegroundColor Yellow
    Write-Host "3. Marque 'Plataforma do Hyper-V' (se disponivel)" -ForegroundColor Yellow
    Write-Host "4. Reinicie o computador" -ForegroundColor Yellow
}

Write-Host ""
pause






