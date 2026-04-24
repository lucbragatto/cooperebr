# Mascaramento LGPD + Whitelist de envios (24/04/2026)

## Motivação
Antes de ligar `NOTIFICACOES_ATIVAS=true` pro teste E2E do Sprint 10,
era necessário proteger o ambiente dev contra envio de WA/email pra
contatos reais que ficaram na base de cooperados importados entre
12/03 e 02/04/2026 (pré-SaaS).

## Auditoria (script: `backend/scripts/auditoria-contatos.js`)

| Origem | Qtd |
|---|---|
| Total cooperados | 337 |
| Seed Hangar/Moradas + sprint | 219 |
| Já mascarado anteriormente | 5 |
| Preservado (Luciano admin) | 1 |
| **Mascarado nesta sessão** | **112** |

## Operação de mascaramento

Script: `backend/scripts/mascarar-dados-lgpd.js`

Regra:
- Preserva `cpf=89089324704` (Luciano admin) intacto
- Pula cooperados com CPF de seed (`7000000*`, `8000000*`, `9000000*`, etc.)
  ou email em `.teste.coopere.br`
- Pula cooperados já mascarados (email `@removido.invalid` ou tel `INATIVO-`)
- Pros demais:
  - `telefone` → `+5511000000000`
  - `email` → `<local>-<id6>-removido@removido.invalid` (sufixo ID
    garante unicidade vs constraint unique)

Idempotente: rodar múltiplas vezes produz o mesmo estado.

## Validação pós-execução
- Luciano preservado: tel `(27)98134-1348`, email `lucbragatto@gmail.com`
- 112 cooperados com `telefone=+5511000000000`
- 116 cooperados com email `@removido.invalid` (4 pré-existentes + 112 novos)

## Segunda camada de proteção: flag `ambienteTeste`

- Adicionado `Cooperado.ambienteTeste Boolean @default(false)`
- `npx prisma db push` aplicado
- `UPDATE cooperado SET ambienteTeste = true` em 337 registros
- Novos cadastros via `/publico/cadastro-web` nascem com default `false`

## Terceira camada: whitelist em dev

Arquivo: `backend/src/common/safety/whitelist-teste.ts`

- `podeEnviarEmDev(destino, tipo)` retorna `true` sempre em prod
- Em dev: só retorna `true` se destino está nas listas
- Integrado em:
  - `email.service.ts:enviarEmail()` → skip + log + retorna `true`
  - `whatsapp-sender.service.ts:enviarMensagem/enviarListaMensagem/enviarPdfWhatsApp`

## Quarta camada: filtro nos crons de lembrete

- `motor-proposta.job.ts:lembretePropostasPendentes()`
- `cobrancas.job.ts:enviarLembretePreVencimento(1|3)`

Em dev (`NODE_ENV !== 'production'`), filtram por
`cooperado.ambienteTeste = false`. Combinado com whitelist isso produz
**dupla trava**: cooperado precisa estar fora do seed E na whitelist.

## .env
- Adicionado `NODE_ENV=development` em `backend/.env`
- `NOTIFICACOES_ATIVAS` continua OFF até confirmação final de teste
