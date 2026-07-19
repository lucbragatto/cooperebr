# Restart coordenado — Corretiva Achados 3 + 4 (+ possível 8)

**Origem:** sessão Achados 3+4 da corretiva 2026-07-16 (fase Code 2026-07-19).
**Executor:** Luciano (comandos destrutivos — Code não roda).
**Tempo estimado:** 8 min (backend rebuild ~90s + operação ACL + smoke).

## Contexto

Dois achados de segurança precisam ativar juntos porque compartilham o
processo `cooperebr-whatsapp`:

- **Achado 3** — webhook secret migrado da query pro header
  `x-whatsapp-secret`. Receptor (backend) aceita ambos na janela de
  compat; emissor (`whatsapp-service/index.mjs`) já não usa mais query.
  **Requer rebuild backend + restart PM2 dos dois processos.**
- **Achado 4** — sessão Baileys em `auth_info/` protegida por ACL
  restrita. **Requer parar Baileys pra liberar file locks + `icacls`.**

Sequência única evita reautenticação Baileys dupla.

Um achado **potencial 8** (varredura ACL 2026-07-19) mostrou que o ACE
`CodexSandboxUsers (M,DC)` está aplicado **explicitamente em
`C:\Users\Luciano\cooperebr`** — cobre repo inteiro (`.env`, `.git`,
código, `auth_info`), não só a pasta Baileys. Se optar pela rotação
apenas do escopo `auth_info`, o vazamento cross-repo continua. **A
decisão de escopo do `icacls` está marcada abaixo.**

## Pré-checks (rodar ANTES do bloco destrutivo)

```powershell
pm2 list                                              # confirmar 3 processos online
pm2 describe cooperebr-whatsapp | Select-String "user"   # dono = Luciano
whoami                                                 # DESKTOP-89HGOKR\Luciano
icacls C:\Users\Luciano\cooperebr\whatsapp-service\auth_info
```

Se dono do PM2 ≠ `Luciano` ou `whoami` ≠ `Luciano`, **PARE** — o
`icacls` vai gravar ACL pra usuário errado.

## Bloco 1 — Rotação de secret (fecha Achado 3)

Valor atual do `WHATSAPP_WEBHOOK_SECRET` é fraco (escolhido por humano)
e já vazou em logs de startup + ficou visível em URLs de `.env` de setup
antigo. Migrar pro header protege o futuro; **rotacionar substitui o
valor comprometido**.

```powershell
# Gerar secret novo (não colar valor em log/chat/report — só copiar pro clipboard)
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$novo = ([Convert]::ToBase64String($bytes)) -replace '[+/=]', '_'
$novo | Set-Clipboard    # clipboard só, NÃO escrever em disco temporário
Write-Host "Secret novo gerado ($($novo.Length) chars) — no clipboard."

# Editar os DOIS .env manualmente (Notepad, VS Code, etc):
#   1) C:\Users\Luciano\cooperebr\.env                → WHATSAPP_WEBHOOK_SECRET=<colar>
#   2) C:\Users\Luciano\cooperebr\whatsapp-service\.env → WHATSAPP_WEBHOOK_SECRET=<colar>
#      + LIMPAR BACKEND_WEBHOOK_URL: remover "?secret=xxx" — deve ficar
#        apenas "http://localhost:3000/whatsapp/webhook-incoming"
#
# Ao editar: NÃO deixar o valor antigo em backup .env.bak no mesmo diretório
# (grep de secret continua encontrando).

# Confirmar visualmente antes de sair do editor:
Get-Content C:\Users\Luciano\cooperebr\.env | Select-String "^WHATSAPP_WEBHOOK_SECRET="
Get-Content C:\Users\Luciano\cooperebr\whatsapp-service\.env | Select-String "^WHATSAPP_WEBHOOK_SECRET=|^BACKEND_WEBHOOK_URL="
# BACKEND_WEBHOOK_URL não deve conter "?secret="
```

**Não colar o valor novo em nenhum report, doc-sessão, memória, ou log
do Code.** Só reportar: "rotacionado".

## Bloco 2 — Backup ACL (reversível)

```powershell
# Backup da ACL atual (permite rollback via /restore)
icacls C:\Users\Luciano\cooperebr\whatsapp-service\auth_info `
       /save C:\Users\Luciano\cooperebr\whatsapp-service\auth_info.acl.pre-corretiva.bak /T
```

Verificar que o arquivo `auth_info.acl.pre-corretiva.bak` foi criado.

## Bloco 3 — Parar processos + rebuild backend

```powershell
pm2 stop cooperebr-backend
pm2 stop cooperebr-whatsapp        # libera locks em auth_info

# Confirmar porta 3000 livre antes do build (evita EPERM no Prisma):
netstat -ano | Select-String ":3000.*LISTENING"     # não deve retornar nada

cd C:\Users\Luciano\cooperebr\backend
npm run build                                        # gera dist/ com receptor novo
```

## Bloco 4 — icacls (ESCOPO PENDE DECISÃO)

⚠️ **Escolher A OU B abaixo** conforme decisão sobre o Achado 8.
Comando único (`/inheritance:r` + `/grant:r` na mesma invocação) evita
janela sem ACE.

### Opção A — Escopo original (só `auth_info`)

Escolhe se for tratar o Codex-no-repo como Achado 8 dedicado depois.

```powershell
icacls C:\Users\Luciano\cooperebr\whatsapp-service\auth_info `
       /inheritance:r `
       /grant:r "Luciano:(OI)(CI)(F)" "SYSTEM:(OI)(CI)(F)" "Administradores:(OI)(CI)(F)" `
       /T
```

### Opção B — Escopo estendido (`C:\Users\Luciano\cooperebr` inteiro — absorve Achado 4)

Escolhe se for consolidar aqui e pular Achado 8 dedicado.

```powershell
icacls C:\Users\Luciano\cooperebr `
       /inheritance:r `
       /grant:r "Luciano:(OI)(CI)(F)" "SYSTEM:(OI)(CI)(F)" "Administradores:(OI)(CI)(F)" `
       /T
```

**Nota da Opção B:** `/T` recursivo em ~1500+ arquivos + `.git/` gigante
pode demorar alguns minutos. Backup análogo do Bloco 2 recomendado
antes:

```powershell
icacls C:\Users\Luciano\cooperebr /save C:\Users\Luciano\cooperebr.acl.pre-corretiva.bak /T
```

Se qualquer variante de A ou B rejeitar arquivos ("acesso negado" em
arquivo bloqueado por processo ativo), rode Bloco 3 primeiro — o
processo dono do lock precisa estar parado.

## Bloco 5 — Restart + smoke

```powershell
pm2 restart cooperebr-backend      # receptor novo entra
pm2 start   cooperebr-whatsapp     # emissor novo entra + creds Baileys preservadas

# Smoke — checar conectividade (não precisa auth):
Invoke-RestMethod http://localhost:3002/status
# Esperado: status=connected (senão, ver logs abaixo)

# Smoke — checar receptor rejeita sem secret:
$body = @{ telefone='5527981341348'; tipo='texto'; corpo='smoke' } | ConvertTo-Json
try { Invoke-RestMethod -Method Post -Uri http://localhost:3000/whatsapp/webhook-incoming -Body $body -ContentType 'application/json' }
catch { Write-Host "Esperado 401: $($_.Exception.Response.StatusCode)" }

# Smoke — checar receptor aceita header novo (usa o secret novo do clipboard):
$novo = Get-Clipboard
Invoke-RestMethod -Method Post -Uri http://localhost:3000/whatsapp/webhook-incoming `
  -Headers @{ 'x-whatsapp-secret' = $novo } `
  -Body $body -ContentType 'application/json'
# Esperado: { ok = true }

# Limpar clipboard depois:
Set-Clipboard -Value ''
```

## Bloco 6 — Critério de aceite (monitor de migração)

Deixar rodando por 1 ciclo (1 dia de uso normal do bot):

```powershell
# Depois de tráfego real ter passado pelo webhook (mensagens de cooperado,
# convites, PIN, etc), o warn de deprecação NÃO deve aparecer:
pm2 logs cooperebr-backend --lines 500 --nostream | Select-String "WA-WEBHOOK.*deprecated"
```

- **0 matches** → emissor migrou 100%. Agendar cleanup (remover fallback
  query + warn no receptor — tarefa #10).
- **1+ matches** → algum caller ainda manda query. Investigar o
  `telefone` do warn contexto, achar o script/rota, migrar pro header.

## Rollback (se algo quebrar)

```powershell
# ACL — restaurar do backup:
icacls C:\Users\Luciano\cooperebr\whatsapp-service /restore auth_info.acl.pre-corretiva.bak
# (ou C:\Users\Luciano\cooperebr /restore cooperebr.acl.pre-corretiva.bak se usou Opção B)

# Backend — rebuild backend com git checkout dos commits do Achado 3:
git log --oneline | Select-String "Achado 3" | Select-Object -First 2
# git revert <hash-commit-2> <hash-commit-1>  (só se realmente necessário)
# npm run build ; pm2 restart cooperebr-backend

# Secret — se o rotacionado não passou pros dois .env sincronizados:
#   Restaurar o valor anterior manualmente (você tem no histórico do editor / clipboard antigo);
#   ou gerar novo e refazer o processo. NÃO deixar backend e whatsapp-service com secrets
#   diferentes — 100% dos webhooks caem em 401.
```

## Checklist pós-execução (marcar antes de arquivar)

- [ ] Bloco 1 — secret rotacionado nos DOIS `.env` (backend + wa-service)
- [ ] Bloco 1 — `BACKEND_WEBHOOK_URL` do wa-service SEM query string
- [ ] Bloco 2 — backup ACL criado
- [ ] Bloco 3 — backend rebuildado, porta 3000 livre antes
- [ ] Bloco 4 — `icacls` aplicado (registrar A ou B)
- [ ] Bloco 5 — smoke: 401 sem secret, 200 com header novo
- [ ] Bloco 6 — monitor warn=0 rodando (registrar data pra checar em 24h)
- [ ] Clipboard limpo (`Set-Clipboard -Value ''`)
- [ ] Nenhum `.env.bak` com valor antigo esquecido em disco
