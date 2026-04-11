# Script de inicialização do Agente P (CoopereBR)
# Usa instalação LOCAL do OpenClaw — independente do gateway principal (Assis)
# Porta: 18790 (diferente do Assis que usa 18789)

$env:OPENCLAW_CONFIG = "C:\Users\Luciano\cooperebr\.openclaw\openclaw.json"
$env:OPENCLAW_STATE_DIR = "C:\Users\Luciano\cooperebr\.openclaw"

Write-Host "Iniciando Agente P (CoopereBR) na porta 18790..." -ForegroundColor Green
Write-Host "Config: $env:OPENCLAW_CONFIG" -ForegroundColor Cyan
Write-Host "Instalação local: C:\Users\Luciano\cooperebr\node_modules\.bin\openclaw" -ForegroundColor Cyan

Set-Location "C:\Users\Luciano\cooperebr"
node "C:\Users\Luciano\cooperebr\node_modules\openclaw\openclaw.mjs" gateway run
