# Restart coordenado — Corretiva Achados 8 + 4 + 3

**Origem:** sessão Achados 3+4 da corretiva 2026-07-16 (fase Code 2026-07-19).
Achado 8 (Codex sandbox no ACL do repo) descoberto na varredura ACL da
mesma sessão.
**Executor:** Luciano (comandos destrutivos — Code não roda).
**Tempo estimado:** 10 min (icacls + backend rebuild + operação).

## Contexto

Três achados de segurança precisam ativar juntos porque compartilham o
processo `cooperebr-whatsapp` e a máquina host:

- **Achado 8** — ACL do repo raiz. `CodexSandboxUsers` (contas
  `CodexSandboxOffline` + `CodexSandboxOnline`) e um SID órfão têm
  Modify+Delete Children **explicitamente aplicado em
  `C:\Users\Luciano\cooperebr`**, herdado por todo o repo (`.env`,
  `.git`, `auth_info`, código, tudo). Luciano confirmou (2026-07-19):
  **não usa Codex neste repo** → grant é resíduo, remoção cirúrgica
  segura. Backend/frontend/whatsapp rodam sob `Luciano` (Full
  preservado), nada quebra.
- **Achado 4** — sessão Baileys em `auth_info/` protegida por ACL
  restrita defense-in-depth (Achado 8 remove o vetor amplo; Achado 4
  quebra herança na pasta que É a credencial pra reduzir raio de
  qualquer futuro grant errado no repo).
- **Achado 3** — webhook secret migrado da query pro header
  `x-whatsapp-secret` (código já commitado, `57e0285..cb7e7a4`).
  Ativação em runtime + **rotação do valor** (fraco, escolhido por
  humano, já vazou em logs de startup).

**Ordem operacional canônica:** 8 (remover Codex do repo) → 4 (tighten
`auth_info`) → 3 (rotacionar secret + rebuild backend + restart
whatsapp). Backup ACL ANTES de cada icacls, verificação DEPOIS de cada.

## Pré-checks (rodar ANTES do bloco destrutivo)

```powershell
pm2 list                                                # 3 processos online
pm2 describe cooperebr-whatsapp | Select-String "user"  # dono = Luciano
whoami                                                  # DESKTOP-89HGOKR\Luciano
icacls C:\Users\Luciano\cooperebr | Select-Object -First 8
icacls C:\Users\Luciano\cooperebr\whatsapp-service\auth_info | Select-Object -First 8
```

Se dono do PM2 ≠ `Luciano` ou `whoami` ≠ `Luciano`, **PARE** — o
`icacls` vai remover ACE errado ou gravar ACL pra usuário errado.

O SID órfão completo (usado nos comandos do Bloco 8):

```
S-1-5-21-3982730439-717413640-2430296156-1805928900
```

## Bloco 8 — Remoção cirúrgica Codex do repo (Rota A confirmada)

### 8.1 — Backup da ACL do repo-root

```powershell
icacls C:\Users\Luciano\cooperebr `
       /save C:\Users\Luciano\cooperebr.acl.pre-corretiva.bak /T
```

Verificar que `C:\Users\Luciano\cooperebr.acl.pre-corretiva.bak` foi
criado (é um arquivo texto grande — inclui ACL de cada arquivo do repo).

### 8.2 — Remover Codex + SID órfão (não usa `/inheritance:r` no root — largo demais)

`/remove:g <principal>` remove APENAS o ACE do principal informado,
preservando SISTEMA / Administradores / Luciano. `/T` propaga a remoção
pra tudo abaixo (inclusive `auth_info`, evitando ACE fantasma herdado).

```powershell
icacls C:\Users\Luciano\cooperebr /remove:g "DESKTOP-89HGOKR\CodexSandboxUsers" /T
icacls C:\Users\Luciano\cooperebr /remove:g "*S-1-5-21-3982730439-717413640-2430296156-1805928900" /T
```

O prefixo `*` no segundo comando força `icacls` a interpretar como SID
literal (a conta não resolve pra `Name`).

### 8.3 — Verificação pós-remoção

```powershell
# Confirmar que os dois ACEs SUMIRAM do root:
icacls C:\Users\Luciano\cooperebr | Select-String "CodexSandbox|1805928900"
# Esperado: nenhum match

# E também sumiram do auth_info (propagação do /T do 8.2):
icacls C:\Users\Luciano\cooperebr\whatsapp-service\auth_info | Select-String "CodexSandbox|1805928900"
# Esperado: nenhum match

# ACL final do root deve ter só SISTEMA, Administradores, Luciano
# (mais SIDs de app capability sem risco):
icacls C:\Users\Luciano\cooperebr
```

### 8.4 — Prova de que nada quebrou

```powershell
pm2 list                                              # 3 apps ainda online
pm2 logs cooperebr-backend --lines 30 --nostream      # nenhum EACCES/EPERM
pm2 logs cooperebr-whatsapp --lines 30 --nostream     # nenhum erro auth_info
```

Login smoke manual no painel:

1. Abrir `http://localhost:3001` no browser.
2. Logar com `superadmin@cooperebr.com.br`.
3. Confirmar que `/dashboard` carrega e a sidebar aparece.

Se algo falhar por permissão, rollback:

```powershell
cd C:\Users\Luciano
icacls . /restore cooperebr.acl.pre-corretiva.bak
```

### 8.5 — Fora de escopo (registrado, não fazer agora)

- **NÃO deletar as contas Windows `CodexSandboxOffline`/`Online`.** É
  decisão de política de máquina, não deste achado. Basta ter tirado
  o acesso ao repo do CoopereBR.
- **Não varrer outros repos em `C:\Users\Luciano\*`** neste
  procedimento. Fazer varredura análoga em cada repo relevante em
  sessão dedicada — tarefa registrada.

## Bloco 4 — Tighten `auth_info/` (defense-in-depth)

Achado 8 já removeu o vetor amplo. Este bloco quebra a herança na pasta
Baileys pra reduzir raio de qualquer futuro grant errado no repo — se
alguém aplicar um ACE em `cooperebr\` no futuro (Codex reinstalado,
sync tool, etc), `auth_info` não herda porque a herança está quebrada.

### 4.1 — Backup ACL antes

```powershell
icacls C:\Users\Luciano\cooperebr\whatsapp-service\auth_info `
       /save C:\Users\Luciano\cooperebr\whatsapp-service\auth_info.acl.pre-corretiva.bak /T
```

### 4.2 — Parar Baileys pra liberar file locks

```powershell
pm2 stop cooperebr-whatsapp
```

### 4.3 — `icacls` atômico (quebra herança + grant no mesmo comando)

`/inheritance:r` sozinho deixaria a pasta sem ACE nenhuma (nem o
próprio Luciano leria) até o grant. Combinar num comando único evita a
janela.

```powershell
icacls C:\Users\Luciano\cooperebr\whatsapp-service\auth_info `
       /inheritance:r `
       /grant:r "Luciano:(OI)(CI)(F)" "SYSTEM:(OI)(CI)(F)" "Administradores:(OI)(CI)(F)" `
       /T
```

### 4.4 — Verificação

```powershell
icacls C:\Users\Luciano\cooperebr\whatsapp-service\auth_info
# Esperado: só Luciano (F), SYSTEM (F), Administradores (F).
# NENHUMA entrada com (I) — herança quebrada.
```

Rollback (mesma janela, se algo quebrar):

```powershell
cd C:\Users\Luciano\cooperebr\whatsapp-service
icacls . /restore auth_info.acl.pre-corretiva.bak
```

## Bloco 3 — Rotação de secret + rebuild backend + restart

Baileys já está parado (Bloco 4.2). Aproveitar a janela pra rotacionar
o secret e trazer os dois processos de volta com os artefatos novos.

### 3.1 — Rotacionar `WHATSAPP_WEBHOOK_SECRET`

```powershell
# Gerar valor aleatório forte (48 bytes → 64 chars base64 sanitizado):
$bytes = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$novo = ([Convert]::ToBase64String($bytes)) -replace '[+/=]', '_'
$novo | Set-Clipboard    # clipboard só, NÃO escrever em disco temporário
Write-Host "Secret novo gerado ($($novo.Length) chars) — no clipboard."

# Editar os DOIS .env manualmente (Notepad, VS Code, etc) na MESMA
# passada. Uma edição só por arquivo:
#
#   1) C:\Users\Luciano\cooperebr\backend\.env
#        a) WHATSAPP_WEBHOOK_SECRET=<colar do clipboard>
#        b) CONSOLIDAR COOPERTOKEN_QR_SECRET (Achado 9, ver adiante):
#           - APAGAR linha 73 (valor de 48 chars, órfão)
#           - APAGAR linha 75 (string vazia)
#           - MANTER linha 76 (44 chars — é o valor que o runtime já usa
#             desde 06/08/2026, provado por simulação dotenv)
#
#   2) C:\Users\Luciano\cooperebr\whatsapp-service\.env
#        a) WHATSAPP_WEBHOOK_SECRET=<colar do clipboard>
#        b) LIMPAR BACKEND_WEBHOOK_URL: remover "?secret=..." se ainda
#           estiver embutido. Deve ficar apenas:
#           BACKEND_WEBHOOK_URL=http://localhost:3000/whatsapp/webhook-incoming
#
# Ao editar: NÃO deixar `.env.bak` ou `.env.old` com valor antigo no
# mesmo diretório (grep de secret continua encontrando).

# Confirmar visualmente antes de sair do editor:
Get-Content C:\Users\Luciano\cooperebr\backend\.env          | Select-String "^WHATSAPP_WEBHOOK_SECRET=|^COOPERTOKEN_QR_SECRET="
# Esperado: 1 linha WHATSAPP + 1 linha COOPERTOKEN (SÓ UMA — não 3)
Get-Content C:\Users\Luciano\cooperebr\whatsapp-service\.env | Select-String "^WHATSAPP_WEBHOOK_SECRET=|^BACKEND_WEBHOOK_URL="
# BACKEND_WEBHOOK_URL não deve conter "?secret="
# Ambos WHATSAPP_WEBHOOK_SECRET devem ter o MESMO valor novo.
```

### 3.1b — Consolidação `COOPERTOKEN_QR_SECRET` (Achado 9)

**Comportamento-zero, incluído aqui só pra aproveitar a mesma edição
cuidadosa do `.env` do backend.** Não rotaciona — só remove
duplicações inconsistentes.

**Estado hoje (`backend/.env`):**

| Linha | Tamanho | Ação |
|---|---|---|
| 73 | 48 chars | APAGAR (valor órfão — provável rotação anterior; se estava em backup, é uma segunda cadeia de assinatura não intencional) |
| 75 | 0 chars | APAGAR (string vazia — bomba silenciosa se virasse a última via reorder) |
| 76 | 44 chars | **MANTER** (o runtime usa este) |

**Prova de qual valor está ativo** (executada 2026-07-19, read-only):

- `.env` last modified `06/08/2026` (5+ semanas antes do boot atual do backend, uptime 3h).
- Simulação `require('dotenv').config()` no CWD `C:\Users\Luciano\cooperebr\backend` (mesmo path que `ConfigModule` do NestJS resolve) → `process.env.COOPERTOKEN_QR_SECRET.length = 44`.
- `[System.Environment]::GetEnvironmentVariable("COOPERTOKEN_QR_SECRET", "User"|"Machine")` = ambos `null` → sem override do SO.
- 44 chars bate exatamente com linha 76 do `.env`.

**Não restart necessário.** O backend já roda com o valor da linha 76. A
edição só limpa o arquivo. Ainda assim, a edição acontece no meio da
janela de restart de qualquer modo (rebuild + `pm2 restart` do Bloco 3.2),
então o processo vai recarregar o `.env` — reconfirmação passiva de que a
linha 76 continua sendo a fonte.

**Verificação pós-edit (dentro do Bloco 3.3):**

```powershell
(Get-Content C:\Users\Luciano\cooperebr\backend\.env | Select-String "^COOPERTOKEN_QR_SECRET=" | Measure-Object).Count
# Esperado: 1 (não 3)
```

**Se algum código já tinha assinado tokens com o valor da linha 73** (48
chars), esses tokens deixam de validar assim que a linha 73 for apagada.
Como o runtime NUNCA usou linha 73 (dotenv "última vence" desde jun/08),
nenhum token ativo foi assinado com ela — a remoção é segura.

**Não colar o valor novo em nenhum report, doc-sessão, memória, ou log
do Code.** Só reportar: "rotacionado".

### 3.2 — Rebuild backend + restart

```powershell
pm2 stop cooperebr-backend

# Confirmar porta 3000 livre (evita EPERM no Prisma engine):
netstat -ano | Select-String ":3000.*LISTENING"     # não deve retornar nada

cd C:\Users\Luciano\cooperebr\backend
npm run build                                        # gera dist/ com receptor novo

pm2 restart cooperebr-backend                        # receptor novo entra
pm2 start   cooperebr-whatsapp                       # emissor novo entra + creds Baileys preservadas
```

### 3.3 — Smoke tests

```powershell
# 1. WA-service conectado:
Invoke-RestMethod http://localhost:3002/status
# Esperado: status=connected. Se disconnected, ver logs.

# 2. Backend rejeita webhook sem secret:
$body = @{ telefone='5527981341348'; tipo='texto'; corpo='smoke' } | ConvertTo-Json
try {
  Invoke-RestMethod -Method Post -Uri http://localhost:3000/whatsapp/webhook-incoming `
                    -Body $body -ContentType 'application/json' -ErrorAction Stop
  Write-Host "FALHA: esperava 401, não obteve exceção"
} catch {
  Write-Host "OK esperado 401: $($_.Exception.Response.StatusCode)"
}

# 3. Backend aceita header novo (usa o secret novo do clipboard):
$novo = Get-Clipboard
$r = Invoke-RestMethod -Method Post -Uri http://localhost:3000/whatsapp/webhook-incoming `
     -Headers @{ 'x-whatsapp-secret' = $novo } `
     -Body $body -ContentType 'application/json'
Write-Host "OK 200: $($r | ConvertTo-Json)"

# 4. Limpar clipboard:
Set-Clipboard -Value ''
```

## Bloco 6 — Critério de aceite (monitor de migração)

Deixar rodar por 1 ciclo (1 dia de uso normal do bot):

```powershell
# Depois de tráfego real ter passado pelo webhook (mensagens de
# cooperado, convites, PIN, etc), o warn de deprecação NÃO deve aparecer:
pm2 logs cooperebr-backend --lines 500 --nostream | Select-String "WA-WEBHOOK.*deprecated"
```

- **0 matches** → emissor migrou 100%. Agendar cleanup (remover
  fallback query + warn no receptor — tarefa #10).
- **1+ matches** → algum caller ainda manda query. Investigar o
  `telefone` do warn contexto, achar o script/rota, migrar pro header.

## Rollback (se algo quebrar)

```powershell
# Achado 8 — restaurar ACL do repo raiz:
cd C:\Users\Luciano
icacls . /restore cooperebr.acl.pre-corretiva.bak

# Achado 4 — restaurar ACL do auth_info:
cd C:\Users\Luciano\cooperebr\whatsapp-service
icacls . /restore auth_info.acl.pre-corretiva.bak

# Achado 3 — reverter código (só se estritamente necessário):
git log --oneline | Select-String "Achado 3" | Select-Object -First 2
# git revert <hash-commit-2>
# git revert <hash-commit-1>
# cd backend ; npm run build ; pm2 restart cooperebr-backend

# Secret — se o rotacionado não passou pros dois .env sincronizados,
# 100% dos webhooks caem em 401. Refazer o Bloco 3.1 (novo valor, ou
# recuperar o novo do editor onde ficou pré-save).
```

## Secrets fora do escopo desta rotação

Luciano decidiu (2026-07-19) **NÃO rotacionar** os outros secrets
agora — baixa urgência, contas dormentes, sem evidência de acesso
externo indevido. Só o `WHATSAPP_WEBHOOK_SECRET` rotaciona no Bloco 3
(fecha Achado 3 — valor fraco + já vazou em logs de startup).

Lista pra referência futura (arquivo `backend/.env` — nomes de var só,
zero valores):

- `DATABASE_URL`, `DIRECT_URL` (Postgres/Supabase)
- `JWT_SECRET` (auth)
- `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_URL`
- `ASAAS_ENCRYPT_KEY` (gateway pagamento)
- `GATEWAY_ENCRYPT_KEY` (gateway pattern)
- `SUPER_ADMIN_SECRET_KEY` (impersonate — ver débito
  `onboarding_exposicao_bloqueador_seguranca_17_06.md` na memória
  global)
- `EMAIL_PASS`, `EMAIL_IMAP_PASS` (SMTP + IMAP)
- `ANTHROPIC_API_KEY` (OCR + CoopereAI)
- `COOPERTOKEN_QR_SECRET` (aparece 3× no arquivo — provável
  duplicação, revisar)
- `WHATSAPP_WEBHOOK_SECRET` (**rotacionado** no Bloco 3 desta corretiva)
- `COOPERTOKEN_QR_SECRET` (**consolidado** no Bloco 3.1b — Achado 9,
  não rotacionado, só remove as 2 linhas órfãs)

Tarefa registrada pra ciclo dedicado quando for prioritário.

## Checklist pós-execução

- [ ] **Achado 8** — backup ACL `cooperebr.acl.pre-corretiva.bak` criado
- [ ] **Achado 8** — Codex + SID órfão removidos do root e do auth_info
- [ ] **Achado 8** — `pm2 list` mostra 3 apps online, login painel OK
- [ ] **Achado 4** — backup ACL `auth_info.acl.pre-corretiva.bak` criado
- [ ] **Achado 4** — `auth_info` só com Luciano/SYSTEM/Administradores,
      sem `(I)` herdado
- [ ] **Achado 3** — secret rotacionado nos DOIS `.env`, mesmo valor
- [ ] **Achado 3** — `BACKEND_WEBHOOK_URL` sem query string
- [ ] **Achado 3** — backend rebuildado, porta 3000 livre antes
- [ ] **Achado 3** — smoke: 401 sem secret, 200 com header novo
- [ ] **Achado 9** — `backend/.env` tem SÓ 1 linha `COOPERTOKEN_QR_SECRET=`
      (não 3), valor de 44 chars mantido
- [ ] Clipboard limpo (`Set-Clipboard -Value ''`)
- [ ] Nenhum `.env.bak` / `.env.old` com valor antigo esquecido em disco
- [ ] Monitor warn=0 rodando (registrar data pra checar em 24h)
