# BUGFIX: EADDRINUSE no PM2 — Backend CoopereBR

**Data:** 2026-04-05
**Severidade:** Alta — impedia startup do backend e bloqueava jobs noturnos
**Status:** Correções aplicadas, acao manual pendente

---

## Sintoma

Backend falhava ao iniciar via PM2 com `Error: listen EADDRINUSE: address already in use :::3000`.
Acumulou **3.305 restarts** e **9.840 erros** no log de erros.
O loop de restart impediu todos os `@Cron` jobs de executar.

Ocorrencias nos logs:
- 2026-04-01: primeiros erros registrados (09:46)
- 2026-04-05: loop contínuo de 09:20 a 09:28 (~20 tentativas em 8 minutos)

## Impacto nos jobs noturnos

Com o backend em loop, os cron jobs **nao executaram**:

| Horario | Job | Efeito |
|---------|-----|--------|
| 2h | `marcarVencidas()` | Cobranças nao marcadas como VENCIDO |
| 3h | `calcularMultaJuros()` | Multa/juros nao recalculados |
| 3h | `reconciliarFaixas()` | Convênios nao reconciliados |
| 3h | `limparCooperadosProxy*()` | Cooperados proxy nao limpos |
| 3h | `cronExpirarConvites()` | Convites nao expirados |
| 6h | `apurarExcedentes()` | Cooper tokens nao apurados |
| 6h | `pollingLiquidadas()` | Pagamentos liquidados nao sincronizados |
| 6h | `notificarCobrancasVencidas()` | WhatsApp de cobranca nao enviado |
| 7h | `refreshDiario()` | Relatorio de posicao nao atualizado |

---

## Causa raiz (2 problemas)

### 1. Processo manual ocupando porta 3000 (causa imediata)

Um processo `node` (PID 11676) iniciado manualmente em **2026-04-04 14:34:18** (provavelmente `npm run start:dev`) ficou rodando e nunca foi encerrado. Este processo ocupava a porta 3000, impedindo o PM2 de iniciar o backend.

**Situacao atual (ao investigar):**
- PID 11676: `node.exe` (manual, ocupando porta 3000) — VIVO
- PID 16872: PM2 backend (crashando imediatamente com EADDRINUSE) — EM LOOP

### 2. Wrapper pm2-start.js criava child process orfao (causa estrutural — JA CORRIGIDA)

O `pm2-start.js` original usava `spawn()` criando um processo filho. Quando PM2 enviava SIGTERM, matava o wrapper mas o filho (NestJS real) ficava orfao segurando a porta.

### 3. restart_delay fixo permitia restart storm (JA CORRIGIDO nesta sessao)

O `restart_delay: 10000` fixo causava tentativas a cada ~22s. O `max_restarts: 5` nao estava sendo respeitado pelo PM2 no Windows (3.305 restarts acumulados).

---

## Correcoes aplicadas

### `backend/pm2-start.js` (corrigido em sessao anterior)
```js
// ANTES: spawn() criava child process orfao
const child = spawn(process.execPath, ['dist/src/main'], { ... });

// DEPOIS: require() roda no mesmo processo
require('./dist/src/main');
```

### `backend/src/main.ts` (corrigido em sessao anterior)
- `app.enableShutdownHooks()` — libera porta no SIGTERM
- try/catch com `process.exit(1)` no EADDRINUSE
- `process.send('ready')` para PM2 `wait_ready`

### `ecosystem.config.cjs` (corrigido nesta sessao)
```js
// ANTES: restart_delay fixo permitia loop infinito
restart_delay: 10000,

// DEPOIS: backoff exponencial (1s, 2s, 4s, 8s, ..., max 15min)
exp_backoff_restart_delay: 1000,
```

| Config | Antes | Depois | Motivo |
|--------|-------|--------|--------|
| `restart_delay` | 10000 (fixo) | `exp_backoff_restart_delay: 1000` | Backoff exponencial previne storm |
| `kill_timeout` | 5000 | 10000 | Mais tempo para graceful shutdown |
| `listen_timeout` | (ausente) | 30000 | Timeout para 'ready' |
| `shutdown_with_message` | (ausente) | true | IPC shutdown no Windows |
| `NODE_ENV` | development | production | PM2 roda build de prod |

---

## ACAO MANUAL NECESSARIA

### 1. Matar o processo zombie e reiniciar o PM2
```bash
# Matar o processo manual que ocupa a porta
taskkill /PID 11676 /F

# Recarregar PM2 com a nova config
pm2 reload ecosystem.config.cjs --only cooperebr-backend

# Resetar o contador de restarts (3305 -> 0)
pm2 reset cooperebr-backend

# Verificar
pm2 list
pm2 logs cooperebr-backend --lines 20
```

### 2. Re-executar jobs noturnos perdidos
Os `@Cron` jobs nao tem re-execucao automatica. Verificar manualmente:

1. **`marcarVencidas`** — cobranças com `dataVencimento < hoje` em `A_VENCER`/`PENDENTE` devem ser atualizadas para `VENCIDO`
2. **`calcularMultaJuros`** — recalcular multa/juros de cobranças VENCIDO
3. **`pollingLiquidadas`** — verificar liquidações no Asaas que nao foram importadas

---

## Prevencao

1. **Nunca rodar `npm run start:dev` no mesmo servidor que o PM2** — usar portas diferentes ou parar o PM2 primeiro
2. **`exp_backoff_restart_delay`** limita o impacto: apos 5 falhas o intervalo sobe para 32s; apos 10, ~17 minutos
3. **`require()` no pm2-start.js** garante que PM2 controla o PID real
4. **`enableShutdownHooks()`** garante liberacao da porta no SIGTERM
5. **Recomendacao futura:** Endpoint `POST /admin/jobs/run/:jobName` para re-executar jobs perdidos

---

## Todos os jobs @Cron do backend (referencia)

| Horario | Job | Modulo | Gate |
|---------|-----|--------|------|
| `* * * * *` | `handleCron()` | monitoramento-usinas | - |
| `*/5 * * * *` | `verificarEmailsRecebidos()` | email | - |
| `*/5 * * * *` | `expirarAutomaticas()` | observador | - |
| `0 */30 * * * *` | `verificarEmailsFaturas()` | email-monitor | - |
| `0 * * * *` | `resetarConversasInativas()` | whatsapp | - |
| `0 2 * * *` | `marcarVencidas()` | cobrancas | - |
| `0 2 1 * *` | `expirarTokensVencidos()` | cooper-token | - |
| `0 3 * * *` | `calcularMultaJuros()` | cobrancas | - |
| `0 3 * * *` | `reconciliarFaixas()` | convenios | - |
| `0 3 * * *` | `limparCooperadosProxy*()` | cooperados | - |
| `0 3 * * *` | `cronExpirarConvites()` | convite-indicacao | - |
| `0 6 * * *` | `apurarExcedentes()` | cooper-token | - |
| `0 6 * * *` | `pollingLiquidadas()` | integracao-bancaria | - |
| `0 6 * * *` | `notificarCobrancasVencidas()` | cobrancas | - |
| `0 7 * * *` | `refreshDiario()` | relatorios | - |
| `0 8 5 * *` | `cronEnviarCobrancas()` | whatsapp | `WA_COBRANCA_HABILITADO` |
| `0 9 * * *` | `cronAbordarInadimplentes()` | whatsapp | `WA_INADIMPLENTES_HABILITADO` |
| `30 9 * * *` | `cronAlertarVencimentoProximo()` | whatsapp | `WA_ALERTA_VENCIMENTO_HABILITADO` |
| `0 9 1 * *` | `enviarResumosMensais()` | clube-vantagens | `CLUBE_RESUMO_MENSAL_HABILITADO` |
| `0 10 * * *` | `cronLembreteConvites()` | convite-indicacao | - |
| `0 10 1 * *` | `cronEnviarConvites()` | whatsapp-mlm | `WA_MLM_CONVITES_HABILITADO` |
