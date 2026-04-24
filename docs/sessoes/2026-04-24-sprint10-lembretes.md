# Sprint 10 — Lembretes e cópia assinada (24/04/2026)

## Contexto
Retomada de trabalho que caiu sem commit. Alterações pendentes (schema +
fixtures) completadas com as 3 pendências do Sprint 10.

## Schema (já aplicado no banco)
- `Cobranca.lembreteD3EnviadoEm` DateTime?
- `Cobranca.lembreteD1EnviadoEm` DateTime?
- `PropostaCooperado.lembreteEnviadoEm` DateTime?
- `PropostaCooperado.copiaAssinadaEnviadaEm` DateTime?

## Implementações

### 1. Cron lembrete 24h proposta pendente
**Arquivo novo:** `backend/src/motor-proposta/motor-proposta.job.ts`
- `@Cron(EVERY_DAY_AT_9AM)`
- Busca `PropostaCooperado` com `tokenAssinatura != null`, criada há > 24h,
  sem termo assinado, `lembreteEnviadoEm = null`
- Envia WA + email e marca `lembreteEnviadoEm`
- Registrado em `motor-proposta.module.ts`

### 2. Envio cópia assinada pós-assinatura
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts`
- Em `assinarDocumento()`, quando `ambosAssinados=true` e
  `copiaAssinadaEnviadaEm=null`, chama `enviarCopiaAssinada(propostaId)`
- Método novo gera PDF via `propostaPdf + pdfGenerator`, envia email e
  marca `copiaAssinadaEnviadaEm`

### 3. Email/WA D-3 e D-1 antes do vencimento
**Arquivo:** `backend/src/cobrancas/cobrancas.job.ts`
- `@Cron('0 8 * * *')` chama `enviarLembretePreVencimento(3)` + `(1)`
- Busca cobranças A_VENCER/PENDENTE que vencem em N dias com flag null
- Envia WA (novo método `notificarCobrancaProximaVencer` em
  `whatsapp-ciclo-vida.service.ts`) + email e marca `lembreteD3/D1EnviadoEm`
- Injetado `EmailService` no `CobrancasJob`

## Validações
- `npx prisma db push` → already in sync
- `npx prisma generate` → OK
- `npx tsc --noEmit` → 0 erros

## Guardrails
Todas as ações respeitam `NOTIFICACOES_ATIVAS === 'true'`. Sem essa flag,
crons não disparam.

## Pendências Sprint 10 restantes
- [ ] Teste E2E automatizado (Playwright)
- [ ] Ajuste fixtures OCR (edp-carol, edp-luciano-gd, edp-moradas-enseada
      já tinham valores corrigidos no diff — commit conjunto)
