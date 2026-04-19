# Correções Backend QA — 2026-03-26

## Resumo

6 correções aplicadas com base no relatório `QA-BACKEND-2026-03-26.md`. Todos os bugs críticos e altos foram resolvidos. `tsc --noEmit` passa sem erros.

---

## 1. COB-001 — Motor de cobrança: valorBruto corrigido (CRÍTICO)
**Arquivo:** `cobrancas/cobrancas.service.ts` (método `calcularCobrancaMensal`)

**Problema:** `valorBruto = kwhEntregue` — usava kWh como valor em R$, sem multiplicar pela tarifa.

**Correção:** Agora busca a tarifa vigente da distribuidora (via UC ou Usina) na tabela `TarifaConcessionaria`, calcula `valorBruto = kwhEntregue × (TUSD + TE)`. Erros claros se distribuidora ou tarifa não existirem.

---

## 2. COND-001 / COND-002 — Isolamento de tenant em condominios (CRÍTICO)
**Arquivos:** `condominios/condominios.controller.ts`, `condominios/condominios.service.ts`

**Problema:** `update`, `remove`, `adicionarUnidade` e `removerUnidade` não verificavam se o condomínio pertencia à cooperativa do admin autenticado.

**Correção:**
- Controller agora passa `req.user?.cooperativaId` para todos os métodos mutáveis.
- Service valida ownership via `assertOwnership()` antes de qualquer alteração.
- `removerUnidade` faz join com condomínio para verificar `cooperativaId`.

---

## 3. COOP-001 / COOP-002 — Cooperado acessa dados de outros (CRÍTICO)
**Arquivo:** `cooperados/cooperados.controller.ts`

**Problema:** `GET /cooperados/:id` e `GET /cooperados/:id/checklist` aceitavam role `COOPERADO` sem verificar se o cooperado logado era o dono do `:id`.

**Correção:** Método `assertCooperadoOwnership()` verifica se o email/cpf do usuário logado corresponde ao cooperado solicitado. Admins e operadores passam direto. Retorna `403 Forbidden` se não for o próprio cooperado.

---

## 4. WA-001 — Webhook WhatsApp público (ALTO)
**Arquivo:** `whatsapp/whatsapp-fatura.controller.ts`

**Problema:** Endpoint `@Public() POST /whatsapp/webhook-incoming` sem nenhuma verificação de origem.

**Correção:** Agora exige `?secret=<token>` na query string, validado contra `process.env.WHATSAPP_WEBHOOK_SECRET`. Retorna `401 Unauthorized` se ausente ou incorreto.

**Ação necessária:** Definir `WHATSAPP_WEBHOOK_SECRET` no `.env` e configurar o mesmo secret no serviço Baileys.

---

## 5. Typo VENCIDA → VENCIDO (BAIXO)
**Arquivo:** `whatsapp/whatsapp-bot.service.ts:274`

**Problema:** Query usava `'VENCIDA'` mas o enum/status correto é `'VENCIDO'`.

**Correção:** Alterado para `'VENCIDO'`.

---

## 6. Número de suporte hardcoded (BAIXO)
**Arquivo:** `whatsapp/whatsapp-bot.service.ts` (método `handleAguardandoAtendente`)

**Problema:** Texto `(27) 9XXXX-XXXX` hardcoded na mensagem de suporte.

**Correção:** Agora busca de `configTenant.get('suporte_telefone')` com fallback para `process.env.SUPORTE_TELEFONE`. Se nenhum estiver definido, omite o trecho do telefone.

---

## Validação

```
npx tsc --noEmit → 0 erros
```
