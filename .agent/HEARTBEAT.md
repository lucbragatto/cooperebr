# HEARTBEAT.md — Coop

A cada heartbeat, verificar em silêncio e só alertar Luciano se houver algo real.

## Checklist (rodar a cada heartbeat)

### 1. Saúde dos serviços (sempre)
- `pm2 list` — todos os serviços online? Se algum caiu, alertar imediatamente.
- Backend respondendo? `GET http://localhost:3000/health` (se existir)

### 2. Logs de erro (se houver erros novos desde o último check)
- `C:\Users\Luciano\cooperebr\logs\nest-error.log` — erros críticos?
- `C:\Users\Luciano\cooperebr\logs\wa-error.log` — falhas no WhatsApp?

### 3. Pagamentos pendentes (1x por dia, verificar se há anomalias)
- Cobranças com status PAGO no Asaas mas sem LancamentoCaixa correspondente?
- Webhooks com falha recente?

### 4. Cooperados presos (1x por dia)
- Cooperados em PENDENTE_VALIDACAO há mais de 7 dias sem movimentação?

## Quando alertar Luciano
- Serviço caído → imediato
- Erro crítico em loop no log → imediato
- Pagamento sem baixa → alertar uma vez por dia
- Cooperado preso → alertar uma vez por dia

## Quando ficar quieto (HEARTBEAT_OK)
- Tudo funcionando normalmente
- Já alertei sobre o problema e estou aguardando resposta
- Madrugada (23h–7h) exceto emergência
