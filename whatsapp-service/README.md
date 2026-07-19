# whatsapp-service

Bridge Baileys ↔ backend CoopereBR (Node `.mjs`, rodando via PM2 como
`cooperebr-whatsapp`). Recebe eventos do WhatsApp Business, encaminha
pro backend Nest, expõe `POST /send-message` (+ variantes) pra o backend
disparar mensagens.

Porta: **3002** (LAN interna).

## ⚠️ A pasta `auth_info/` É a credencial

Baileys persiste a sessão WhatsApp **em texto claro** em `auth_info/`:

- `creds.json` — chaves de identidade da conta
- `app-state-sync-key-*.json` — chaves de sincronização de estado
- `app-state-sync-version-*.json` — versões de sync
- `device-list-*.json` — mapping de LID ↔ telefone

**Qualquer processo que consegue ler `auth_info/creds.json` pode
restaurar a sessão em outro dispositivo sem QR code novo.** É
equivalente a roubar a conta WhatsApp da CoopereBR.

### Regras invioláveis

1. **NUNCA commitar `auth_info/`** — `whatsapp-service/.gitignore:2`
   já cobre, mas confira antes de qualquer `git add` amplo.
2. **NUNCA copiar `auth_info/` pra fora do servidor** (backup, dump,
   scp, `zip -r` do repo, etc). Se precisar migrar de máquina, planeje
   reautenticar do zero na máquina nova.
3. **NUNCA compartilhar prints/paths dessa pasta** em canal externo,
   ticket, chat com IA fora do host, screenshots.
4. **ACL restrita:** só `Luciano` (owner do PM2), `SYSTEM` (SO) e
   `Administradores` (takeownership de emergência). Qualquer outro
   grupo com Modify na pasta é um vazamento em potencial — auditar
   com `icacls whatsapp-service\auth_info` periodicamente. Ver
   `docs/seguranca/restart-coordenado-achado-3-4.md` pra o hardening
   canônico.

### Cifra em repouso — viabilidade

Avaliado durante a Corretiva 2026-07-16 Achado 4, **não implementado**:

- **EFS (Windows Encrypting File System):** cifra por usuário no NTFS.
  Ativação `cipher /e auth_info /A /I`. O processo Node (rodando como
  `Luciano`) leria transparente; qualquer outro usuário (mesmo com
  ACL de leitura) veria payload cifrado. Trade-off: se a conta do
  Windows corromper, EFS bloqueia recuperação sem chave exportada.
  **Recomendação:** exportar o certificado EFS (`certmgr.msc` →
  Personal → Exportar com chave privada, guardar offline) ANTES de
  cifrar, ou usar recovery agent do domínio.
- **BitLocker (volume full-disk):** protege contra roubo físico da
  máquina, **não protege contra outro usuário logado no mesmo host**
  (todo processo autorizado vê arquivos decifrados). Complementar ao
  EFS, não substitui.
- **App-level (Baileys plugin de cifra):** existem forks, nenhum
  auditado pelo mantenedor oficial. **Não recomendado.**

Escolha padrão hoje: ACL restrita (barata, imediata, cobre 99% dos
vetores relevantes num dev/prod-lite Windows). EFS entra se um dia
outro usuário legítimo compartilhar a máquina.

## Variáveis de ambiente (`.env`)

```env
PORT=3002
WHATSAPP_WEBHOOK_SECRET=<secret aleatório forte — rotacionável>
BACKEND_WEBHOOK_URL=http://localhost:3000/whatsapp/webhook-incoming
COOPERE_AI_URL=http://localhost:18789/api/sessions/send
```

**`BACKEND_WEBHOOK_URL` deve ser só a URL, SEM query string.** A
Corretiva Achado 3 (2026-07-16) migrou a auth do webhook de
`?secret=xxx` (query) pra header `x-whatsapp-secret`. Se por algum
motivo o `.env` de setup antigo ainda tem `?secret=xxx` embutido:

- `index.mjs` sanitiza em memória e emite warn no boot pedindo pra
  limpar (`limparSecretDaUrl`).
- O startup log também redige o secret (`replace /secret=[^&]*/`).
- **Ainda assim, limpe o `.env` real** — enquanto ele tiver query,
  o warn de deprecação do receptor não dispara (header vence
  primeiro) e o secret continua vazando pra qualquer processo com
  visibilidade sobre a URL.

## Startup

Gerenciado por PM2 — **nunca subir `node index.mjs` direto** (colide
com o process manager, gera zumbis).

```powershell
pm2 list                          # ver status
pm2 restart cooperebr-whatsapp    # reconectar (creds preservadas)
pm2 stop    cooperebr-whatsapp    # parar (necessário antes de mexer em auth_info)
pm2 logs    cooperebr-whatsapp --lines 50
```

`pm2 restart` mantém a sessão Baileys (não pede QR novo, creds.json
continua válido). `pm2 stop` sozinho libera locks dos arquivos de
`auth_info/` pra operações destrutivas (ACL, backup, cifra).

## Reautenticação (QR code novo)

Só necessária se `creds.json` for corrompido/deletado, se a sessão
for encerrada do lado do WhatsApp mobile (logout), ou se migrar pra
máquina nova. Comando:

```powershell
pm2 stop cooperebr-whatsapp
Remove-Item -Recurse -Force whatsapp-service\auth_info
pm2 start cooperebr-whatsapp
pm2 logs  cooperebr-whatsapp --lines 100    # QR no console
```

O QR aparece no `out.log`. Escanear com o app oficial. **Toda a
sessão anterior é invalidada** (número entra "conectado em novo
dispositivo").
