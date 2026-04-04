# run-qa.ps1 - Script de execucao do QA Playwright para CoopereBR
# Uso: .\tests\run-qa.ps1 [-OfflineOnly]

param(
    [switch]$OfflineOnly
)

$ErrorActionPreference = "Continue"
$testDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $testDir

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  CoopereBR QA - Playwright Test Runner" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check backend
$backendOnline = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -lt 500) {
        Write-Host "[OK] Backend respondendo (porta 3000)" -ForegroundColor Green
        $backendOnline = $true
    }
} catch {
    Write-Host "[OFFLINE] Backend NAO esta rodando (porta 3000)" -ForegroundColor Yellow
}

# Check frontend
$frontendOnline = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -lt 500) {
        Write-Host "[OK] Frontend respondendo (porta 3001)" -ForegroundColor Green
        $frontendOnline = $true
    }
} catch {
    Write-Host "[OFFLINE] Frontend NAO esta rodando (porta 3001)" -ForegroundColor Yellow
}

Write-Host ""

if ($OfflineOnly -or (-not $backendOnline -and -not $frontendOnline)) {
    if (-not $OfflineOnly) {
        Write-Host "Backend e Frontend offline. Rodando apenas testes offline..." -ForegroundColor Yellow
    }
    Write-Host "Executando: testes de convite publico (07-convite-publico)`n" -ForegroundColor Cyan

    Set-Location $rootDir
    npx playwright test --config tests/playwright.config.ts tests/07-convite-publico.spec.ts

} elseif (-not $backendOnline) {
    Write-Host "Backend offline. Rodando apenas testes de frontend..." -ForegroundColor Yellow
    Write-Host "Executando: sanity frontend + convite publico`n" -ForegroundColor Cyan

    Set-Location $rootDir
    npx playwright test --config tests/playwright.config.ts tests/01-sanity.spec.ts tests/07-convite-publico.spec.ts

} else {
    Write-Host "Ambos online. Rodando suite completa...`n" -ForegroundColor Green

    Set-Location $rootDir
    npx playwright test --config tests/playwright.config.ts
}

$exitCode = $LASTEXITCODE

Write-Host "`n========================================" -ForegroundColor Cyan
if ($exitCode -eq 0) {
    Write-Host "  RESULTADO: TODOS OS TESTES PASSARAM" -ForegroundColor Green
} else {
    Write-Host "  RESULTADO: ALGUNS TESTES FALHARAM" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Relatorio HTML: tests/reports/ultima-execucao/index.html`n"

exit $exitCode
