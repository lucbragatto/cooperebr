# Correções da Auditoria — 2026-04-01

**Build**: OK (nest build + tsc --noEmit sem erros)

---

## BUGS CRITICOS

### BUG-ASAAS-1 — Webhook PAYMENT_RECEIVED/CONFIRMED sem darBaixa
- **Arquivo**: `backend/src/asaas/asaas.service.ts` (linhas 1-16, 405-424)
- **Correção**: Injetado `CobrancasService` via `forwardRef` no `AsaasService`. Webhook agora chama `cobrancasService.darBaixa()` em vez de apenas atualizar status direto no Prisma. Toda a cascade (LancamentoCaixa, notificações, Clube de Vantagens, MLM) agora dispara automaticamente.
- **Arquivo auxiliar**: `backend/src/asaas/asaas.module.ts` — adicionado `forwardRef(() => CobrancasModule)` nos imports.

### BUG-IND-3 — processarPrimeiraFaturaPaga nunca chamado de darBaixa
- **Arquivo**: `backend/src/cobrancas/cobrancas.service.ts` (após linha 253)
- **Correção**: Injetado `IndicacoesService` via `forwardRef`. No final de `darBaixa`, após registrar pagamento, verifica se é a primeira fatura paga (`count === 1`) e chama `indicacoesService.processarPrimeiraFaturaPaga()`. Toda a cascade MLM (benefícios, clube, convite convertido) agora dispara automaticamente.
- **Arquivo auxiliar**: `backend/src/cobrancas/cobrancas.module.ts` — adicionado `forwardRef(() => IndicacoesModule)` e `forwardRef(() => AsaasModule)` nos imports.

### BUG-PLANO-2 — FIXO_MENSAL e CREDITOS_DINAMICO eram dead code
- **Arquivo**: `backend/src/cobrancas/cobrancas.service.ts` (método `calcularCobrancaMensal`)
- **Correção**: Implementados os 3 modelos:
  - **FIXO_MENSAL**: usa `kwhContrato` como base, independente da geração real
  - **CREDITOS_DINAMICO**: usa `min(kwhEntregue, kwhContrato)` com tarifa vigente atual
  - **CREDITOS_COMPENSADOS**: mantém lógica existente `min(kwhEntregue, kwhContrato)`
- Modelo resolvido via hierarquia: contrato override → usina override → plano → fallback CREDITOS_COMPENSADOS.

### BUG-CONV-1 — cronLembreteConvites sem cooperativaId
- **Arquivo**: `backend/src/convite-indicacao/convite-indicacao.job.ts` (linhas 27-43)
- **Correção**: Adicionado `cooperativaId: true` ao `select` do `findMany`. Chamada alterada para `reenviarConvite(convite.id, convite.cooperativaId)`.

### BUG-IND-1 — REAIS_KWH armazenava taxa sem multiplicar por kWh
- **Arquivo**: `backend/src/indicacoes/indicacoes.service.ts` (linhas 272-289)
- **Correção**: Antes de calcular o benefício, busca o contrato ativo do cooperado indicado para obter `kwhContrato`. O `valorCalculado` agora é `reaisKwh * kwhCooperado` em vez de apenas `reaisKwh`.

### WA-1 — Rota /send-interactive inexistente no whatsapp-service
- **Arquivo**: `whatsapp-service/index.mjs` (nova rota antes de `/send-document`)
- **Correção**: Implementada rota `POST /send-interactive` que aceita `{ to, type, message }`:
  - `type: "buttons"` → converte para lista interativa (mais confiável no Baileys)
  - `type: "list"` → envia lista interativa nativa
  - Fallback automático para texto numerado em caso de erro

---

## BUGS ALTOS

### SEC-2 — Webhook banco aceita tudo se token não configurado
- **Arquivo**: `backend/src/integracao-bancaria/integracao-bancaria.controller.ts` (linhas 15-24)
- **Correção**: Se `WEBHOOK_BANCO_TOKEN` não está configurado, agora rejeita com 401 (`throw new UnauthorizedException`) em vez de aceitar sem validação.

### SEC-3 — GET /configuracao-cobranca hardcoded 'default'
- **Arquivo**: `backend/src/configuracao-cobranca/configuracao-cobranca.controller.ts` (linhas 1, 13-17)
- **Correção**: Adicionado `@Req() req` ao método `findCooperativa`. Agora usa `req.user?.cooperativaId` com fallback para `'default'`. Importado `Req` do `@nestjs/common`.

### SEC-6 — POST /whatsapp/entrada-indicado sem rate limiting
- **Arquivo**: `backend/src/whatsapp/whatsapp-fatura.controller.ts` (linhas 1, 411-412)
- **Correção**: Adicionado `@Throttle({ default: { ttl: 60000, limit: 5 } })` no endpoint público `entrada-indicado`. Limite: 5 requests por minuto por IP. Importado `Throttle` do `@nestjs/throttler`.

### BUG-COBR-4 — Distribuidora match por texto livre sem normalização
- **Arquivo**: `backend/src/cobrancas/cobrancas.service.ts` (método `calcularCobrancaMensal`, busca de tarifa)
- **Correção**: Normaliza distribuidora e concessionária (lowercase + remove acentos + trim) e usa `includes` bidirecional para match flexível ('CEMIG' matches 'CEMIG Distribuição S.A.' e vice-versa).

### BUG-PLANO-3 — motor-proposta busca tarifa global sem filtro de distribuidora
- **Arquivo**: `backend/src/motor-proposta/motor-proposta.service.ts` (linhas 81-97)
- **Correção**: Antes de buscar tarifa global, busca a UC do cooperado (`prisma.uc.findFirst`) para obter distribuidora. Se encontrada, filtra tarifa por distribuidora normalizada. Fallback para tarifa mais recente se distribuidora não encontrada.

### BUG-COOP-1 — Cascade ativação cooperado fora de transação
- **Arquivo**: `backend/src/cooperados/cooperados.service.ts` (linhas 637-660)
- **Correção**: Envolvidas as operações de `contrato.updateMany` + `contrato.findMany` + `contrato.update` (percentualUsina) dentro de `prisma.$transaction()`. Crash entre queries não deixa mais estado inconsistente.

### REL-1 — producaoVsCobranca hardcoda geracaoUsina=0
- **Arquivo**: `backend/src/relatorios/relatorios-query.service.ts` (método `producaoVsCobranca`)
- **Correção**: Busca geração real via `prisma.geracaoMensal.findMany` para todas as usinas da competência. Cria mapa `geracaoPorUsina` e usa o valor real em vez de `0`.

### REL-2 — Projeção receita com tarifa hardcoded R$0.80
- **Arquivo**: `backend/src/relatorios/relatorios.service.ts` (método `projecaoReceita`, linhas 147-191)
- **Correção**: Busca todas as tarifas vigentes e cria mapa por distribuidora (normalizada). Cada contrato agora usa a tarifa da distribuidora da sua usina, com fallback para tarifa mais recente do banco (ou 0.80 se nenhuma cadastrada).

### FE-1 — Rota / é boilerplate Next.js
- **Arquivo**: `web/app/page.tsx`
- **Correção**: Substituído template Vercel por redirect para `/entrar`. Preserva lógica de salvar `ref` (código indicação) no localStorage antes do redirect.

---

## Resumo

| Severidade | Total | Corrigidos |
|-----------|-------|------------|
| CRITICO   | 6     | 6          |
| ALTO      | 9     | 9          |
| **Total** | **15**| **15**     |

Todos os 15 bugs foram corrigidos. Build e type-check passam sem erros.
