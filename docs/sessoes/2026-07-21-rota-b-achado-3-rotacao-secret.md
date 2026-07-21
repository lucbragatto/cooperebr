# ROTA B concluída — Achado 3 fechado e provado — 21/07/2026 manhã

## TL;DR

Sessão operacional de 1h30 (~06:45-08:15 BRT) conduzida por orquestrador passo a passo com Luciano no shell. Executou o Bloco 3 do runbook `restart-coordenado-achado-3-4-8.md` (último achado de segurança aberto da corretiva Mensageria WA) + smoke completo Bloco 5. Resultado: **rotação end-to-end provada, inclusive com round-trip inbound real** — mensagem do celular do Luciano → bot respondeu com menu completo (comprova cadeia inteira `celular → Meta → Baileys → webhook → processarMensagem → resposta`, não só "PM2 online"). **Corretiva Mensageria WA totalmente fechada em 9/9 achados** (arco 16/07 → 21/07). Único achado tardio: **20 min de falso-negativo por clipboard contaminado** (`Get-Clipboard` retornava lixo de texto PT-BR em vez do secret) — vira débito P3 pro runbook.

## Marco entregue

**Corretiva Mensageria WhatsApp — 9/9 ACHADOS FECHADOS** (Achado 3 fechado nesta sessão; 1+2+5+6+7 no fechamento 16/07; 4+8+9 no DELTA 20/07 noite). Bônus: bot WA ressuscitado (mudo 3 dias por versão vencida + zumbi PID 16048).

## Commits do dia (1)

| Hash | Mensagem |
|---|---|
| _(este)_ | `docs(sessao): fechamento 21/07 — Achado 3 fechado, mensageria 9/9 provada + atualizacao do runbook (clipboard)` |

Nenhum commit de código — só documentação + runbook. A rotação em si é operacional (`.env` não vai pro repo por regra).

## Entregas técnicas

### 1. Rotação do `WHATSAPP_WEBHOOK_SECRET`

- **Novo secret**: 64 chars, 48 bytes de `System.Security.Cryptography.RandomNumberGenerator` (não pseudo-random do PS), base64 URL-safe (substituição `+/=` → `_`).
- **Persistência**: script one-shot com travas — só escreve o `.env` se `waOk=$true` (padrão `^WHATSAPP_WEBHOOK_SECRET=` encontrado) E `qrOk=$true` (linha `COOPERTOKEN_QR_SECRET` de 44 chars localizada e consolidada). Aborta sem escrita se qualquer trava falhar. Elimina o passo mais propenso a erro (edição manual `.env`).
- **Backup**: `%TEMP%\cooperebr-env-bkp-750686477\` — cópias dos 2 `.env` antes da escrita. Rollback trivial se necessário (não foi).
- **Igualdade estrutural dos 2 `.env`** verificada: length=64 idêntica em `backend/.env` e `whatsapp-service/.env` (comparação sem ecoar valor no output).

### 2. Consolidação `COOPERTOKEN_QR_SECRET` (Achado 9)

- Estado anterior: 3 linhas no `backend/.env` com valores DIFERENTES (48/0/44 chars). Ordem dotenv "última vence" → linha 76 (44 chars) ativa em runtime.
- Estado atual: **1 linha**, mantida a de 44 chars. **Comportamento-zero em runtime** (backend já usava essa).

### 3. Strip do `?secret=` embutido no `BACKEND_WEBHOOK_URL` (defense-in-depth Achado 3)

- Antes: `BACKEND_WEBHOOK_URL=http://.../whatsapp/webhook-incoming?secret=...` no `wa-service/.env`. `limparSecretDaUrl` do boot removia em memória com WARN loud a cada startup. Vazamento potencial em log se WARN silenciasse.
- Agora: `BACKEND_WEBHOOK_URL=http://.../whatsapp/webhook-incoming` — URL limpa. Secret vai só no header `x-whatsapp-secret` (Corretiva Achado 3 concluída).
- **WARN sumiu do boot novo** (Smoke 4 confirmou — zero ocorrências após timestamp `2026-07-21 07:06:48`).

### 4. Restart coordenado com ordem corrigida

Corretiva pequena do runbook: **parar bot ANTES do backend**, não depois. Razão: se backend restart primeiro (com secret novo) enquanto bot ainda roda (secret velho), há janela onde o backend rejeita 401 as tentativas de forward do wa-service — mensagens de cooperado se perdem no espaço morto. Com bot parado primeiro, Meta enfileira mensagens do lado dele e entrega tudo na reconexão do Baileys. Zero mensagem perdida.

Sequência exata rodada:
```
pm2 stop cooperebr-whatsapp   # bot fora primeiro
pm2 stop cooperebr-backend    # backend depois
netstat -ano | findstr :3000  # confirma :3000 livre
cd backend ; npm run build    # dist/ = fonte
pm2 restart cooperebr-backend # sobe backend com secret novo
Start-Sleep 8
pm2 restart cooperebr-whatsapp # sobe bot com secret novo (Meta entrega enfileiradas)
```

## Smokes (Bloco 5) — todos passaram

| # | Smoke | Resultado |
|---|---|---|
| 1 | `curl /status` → `{"status":"connected","qrCode":null}` | ✅ |
| 2 | `POST /whatsapp/webhook-incoming` SEM header → HTTP 401 | ✅ |
| 3 | `POST /whatsapp/webhook-incoming` COM header novo → HTTP 201 `{"ok":true}` | ✅ (após diagnóstico do clipboard) |
| 4 | Warn `[WA-WEBHOOK] BACKEND_WEBHOOK_URL do .env tinha ?secret=` ausente no boot novo | ✅ zero após `07:06:48` |
| 5a | Round-trip emissor: `POST /send-message → 27981341348` HTTP 200 + celular recebeu | ✅ |
| **5b** | **Round-trip inbound REAL**: Luciano mandou msg → **bot respondeu com menu completo** | ✅ **prova ouro** |
| — | Igualdade estrutural dos 2 `.env` — length=64 idêntica | ✅ |

**Smoke 5b é a prova conclusiva.** Pro bot ter respondido, o webhook autenticou com o secret novo (401 mataria em silêncio). Cadeia inteira de produção provada: `celular → Meta → Baileys → wa-service → POST /whatsapp/webhook-incoming (auth OK) → processarMensagem → resposta de volta`. Bot não está só "connected" no `/status` — está **servindo cooperado em produção**.

## Bugs / débitos catalogados

### Novo — `D-novo-RUNBOOK-CLIPBOARD-CONTAMINACAO` (P3)

**Descoberto:** durante Smoke 3, todos os testes deram 401 mesmo com rotação correta aplicada. 20min de investigação (checagem BOM, `pm2 env`, grep de `dotenv|ConfigModule`, `pm2 delete + start`, análise do `pm2-start.js`) apontava pra suposto cache de env vars do PM2 daemon. **Causa raiz real revelada por debug do próprio `$secret`**: `Get-Clipboard` retornava **array de 10 linhas** (1704 bytes UTF-8) contendo texto PT-BR com em-dashes (`U+2014`), `ç` (`U+00E7`), `õ` (`U+00F5`) — resíduo do próprio output da conversa que o VS Code / clipboard-monitor sobrescreveu. Cada request enviava 1704 bytes de lixo textual como header `x-whatsapp-secret` — legitimamente 401.

**Fix no runbook** (`docs/seguranca/restart-coordenado-achado-3-4-8.md` Bloco 5): trocar `$secret = Get-Clipboard` por leitura direta do `.env` (fonte-de-verdade):

```powershell
$secret = (Select-String -Path 'C:\Users\Luciano\cooperebr\backend\.env' `
  -Pattern '^WHATSAPP_WEBHOOK_SECRET=(.+)$' | Select-Object -First 1).Matches.Groups[1].Value
```

**Zero dependência de clipboard vivo** entre passos operacionais. O clipboard permanece útil pra colar o secret em UIs (KeePass, browser), mas runbooks automatizados devem ler da fonte imutável.

**Aplicado nesta sessão**: runbook atualizado no mesmo commit deste fechamento.

### Observação lateral (não catalogado como débito formal — funciona)

Backend NÃO tem `require('dotenv').config()` explícito no `main.ts` nem `ConfigModule.forRoot()` de `@nestjs/config` em nenhum lugar de `backend/src`. O `pm2-start.js` só faz `require('./dist/src/main')`. O `.env` acaba carregando via **efeito colateral do Prisma** (`new PrismaClient()` chama `dotenv.config()` internamente pra pegar `DATABASE_URL` — mas propaga TODAS as vars do `.env` pro `process.env`). Funcionou nesta sessão (Smoke 3 verde), mas é **frágil**: depende da ordem de import (algum módulo do Nest tem que instanciar Prisma antes de qualquer código que use `process.env.WHATSAPP_WEBHOOK_SECRET`). Simetria com wa-service (que usa `node_args: '--env-file=.env'` explícito no `ecosystem.config.cjs`) seria mais robusto — considerar futura melhoria (não urgente, sem sintoma ativo).

## Decisões estratégicas catalogadas

Nenhuma decisão nova nesta sessão — execução pura do runbook aprovado no arco anterior.

## Próximo passo

**ROTA A — Tarefa 4**: Asaas emissão idempotência + retry unificado. Sessão dedicada (4-8h) tipo "Fase 1 read-only → aprovação do desenho → Fase 2 execução → revisor obrigatório".

**Confirmação prévia obrigatória**: verificar em `/dashboard/configuracoes/asaas` se o gateway está em **SANDBOX** ou **PRODUÇÃO**. Muda a urgência:
- Em SANDBOX: bug de emissão dupla é fix-forward puro (auditoria já confirmou 0 duplicatas hoje). Prioridade média, agenda quando der.
- Em PRODUÇÃO: mesmo defeito passa a cobrar dinheiro real de cooperado a cada double-click. Prioridade alta, agendar próximas 48h.

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` seção `## ONDE PARAMOS — 2026-07-21` (atualizada neste fechamento)
- `docs/sessoes/2026-07-20-corretiva-mensageria-e-asaas-fase2.md` (contexto completo da corretiva Asaas Webhook FASE 2 + fase 1 da Tarefa 4 já esboçada)
- `docs/sessoes/2026-07-21-rota-b-achado-3-rotacao-secret.md` (este arquivo — contexto operacional recente)
- `docs/debitos-tecnicos.md` — 3 defeitos ativos Tarefa 4 detalhados
- `backend/src/cobrancas/cobrancas.service.ts` linhas 362-376 e 887-890 (exceções engolidas)
- `backend/src/asaas/asaas.service.ts` linha 260 (POST /payments sem externalReference)

## Carry-overs (não-bloqueantes)

- **QR round-trip funcional (Achado 9)**: estrutural OK (1 linha, 44 chars, comportamento-zero garantido). Funcional pendente — rodar quando Luciano tiver login cooperado ativo:
  ```
  # após login como cooperado
  # POST /cooper-token/gerar-qr-pagamento
  # node -e "require('dotenv').config(); const jwt = require('jsonwebtoken'); jwt.verify(TOKEN, process.env.COOPERTOKEN_QR_SECRET)"
  ```
  Risco baixo (o secret ativo em runtime foi preservado — a consolidação só removeu linhas mortas).

- **Bloco 6 — monitor 24h**: amanhã (22/07) rodar:
  ```
  pm2 logs cooperebr-backend --lines 500 --nostream | Select-String "WA-WEBHOOK.*deprecated"
  ```
  Se **ZERO ocorrências**, agendar cleanup do fallback query no receptor (tarefa #10 — retirar suporte `?secret=` + warn de `whatsapp-fatura.controller.ts:100-111`). Se >0, emissor legado ainda mandando query — investigar quem antes de remover.

- **Backup `.env`** em `%TEMP%\cooperebr-env-bkp-750686477\` — janela de rollback aberta. Pode ser apagado após 24h de operação estável (após Bloco 6 verde).

- **Clipboard limpo**: `Set-Clipboard -Value ""` após a sessão (higiene — o secret nunca esteve no clipboard nesta conversa, mas resíduo de secret velho pode ter ficado).

- **Carry-over pré-existente** `docs/diagramas/cadastro-usinas.html` `M` — não-relacionado, aberto desde antes desta sessão.

- **Untracked novo**: `whatsapp-service/auth_info.acl.pre-corretiva.bak` (do DELTA de 20/07) permanece — rollback local do Achado 4, por design fora do repo.

## Regras aplicadas na sessão

- **regra_fechamento_sessao_inegociavel** (13/05) — este doc + `CONTROLE-EXECUCAO` + commit/push.
- **regra_contato_teste_impreterivel** (14/05) — Smoke 5a usou `27981341348` (whitelist canônica); Smoke 5b foi Luciano no próprio celular real (mesmo número).
- **regra_secrets_nao_memorizar_26_05** — secret gerado só na memória PS + clipboard efêmero + `.env` no disco. **Nunca ecoado no output** (só length=64 nos verifications; body do smoke usa `.text` do fetch sem imprimir header). Ler do `.env` direto no Smoke 3 (fonte-de-verdade) também respeita a regra.
- **regra_validacao_previa_e_retomada** (Decisões 15/20/23) — pré-validações operacionais executadas no PASSO 0 do ritual de abertura desta sessão (subagent indexado, working tree limpo, PM2 online, `/status` connected).
- **regra_nao_trabalhar_paralelo_com_code_17_05** — Luciano executou passo a passo no shell, orquestrador conduziu.
- **CLAUDE.md — PM2 obrigatório stop antes de rebuild** — respeitado (`:3000` confirmado livre antes de `npm run build`).
- **CLAUDE.md — rebuild backend obrigatório após mudança em `backend/src`** — não aplicável nesta sessão (nenhuma mudança de código do backend), mas rebuild rodado por segurança dado que o secret estava no runtime.
