# Correções de Segurança e MLM — 2026-03-25

**Agente:** Agente 1 (Segurança + MLM)
**Data:** 2026-03-25
**Base:** RELATORIO-QA-2026-03-25.md

---

## Itens Corrigidos

### MLM-01 (CRÍTICO/SEGURANÇA) — CORRIGIDO
**Bug:** `getMeuLink()` aceitava `cooperadoId` via query param, permitindo qualquer autenticado consultar dados de outro membro (IDOR).
**Correção:** Removido fallback `req.query.cooperadoId` em todos os endpoints cooperado (`meu-codigo`, `meu-link`, `minhas`, `beneficios`). Agora usam exclusivamente `req.user.cooperadoId`. Adicionado `@Roles(COOPERADO, ADMIN, SUPER_ADMIN)` e `ForbiddenException` quando cooperadoId ausente.
**Commit:** `f83ea57`

### MLM-02 (CRÍTICO/SEGURANÇA) — CORRIGIDO
**Bug:** `registrar()` sem `@Roles` guard — qualquer usuário autenticado podia registrar indicações.
**Correção:** Adicionado `@Roles(COOPERADO, ADMIN, SUPER_ADMIN)` ao endpoint `POST /indicacoes/registrar`.
**Commit:** `f83ea57` (mesmo commit que MLM-01)

### MLM-03 (CRÍTICO/SEGURANÇA) — CORRIGIDO
**Bug:** Travessia de árvore MLM (subir na cadeia de indicadores) sem detecção de referência circular — loop infinito possível se A→B→A.
**Correção:** Adicionado `Set<string>` de IDs visitados (inclui indicado e indicador direto). Se ciclo detectado, loga warning e interrompe traversal. Adicionado `Logger` ao service.
**Commit:** `1b0d958`

### WA-10 (ALTA/SEGURANÇA) — CORRIGIDO
**Bug:** Endpoint `POST /whatsapp/entrada-indicado` era `@Public()` sem validação de payload — qualquer dado arbitrário aceito.
**Correção:** Criado `EntradaIndicadoDto` com class-validator: `telefone` (10-13 dígitos numéricos, obrigatório), `codigoRef` (3-20 chars, obrigatório). O ValidationPipe global já existente no `main.ts` aplica as validações automaticamente.
**Commit:** `6931700`

### MLM-04 (ALTA/MLM) — CORRIGIDO
**Bug:** Benefício percentual sem validação de teto — percentual > 100 resultava em benefício maior que o valor da fatura.
**Correção:** Duas camadas de proteção:
1. Input: `upsertConfig()` agora rejeita `percentual < 0 || > 100` e `reaisKwh < 0` com `BadRequestException`
2. Cálculo: `Math.min(percentual, 100)` no `processarPrimeiraFaturaPaga` (defense in depth)
**Commit:** `c62d733`

### MLM-05 (ALTA/MLM) — CORRIGIDO
**Bug:** `aplicarBeneficiosNoFechamento` sem transação — chamadas paralelas para mesmo cooperadoId causavam race condition no saldo.
**Correção:** Todo o método agora roda dentro de `prisma.$transaction()`. Queries usam `tx` (transaction client) em vez de `this.prisma`.
**Commit:** `a1d64d4`

### MLM-06 (ALTA/MLM) — CORRIGIDO
**Bug:** Precisão financeira com `.toFixed(2)` em `Number` causa erros de arredondamento em valores financeiros.
**Correção:** Substituído aritmética de ponto flutuante por operações `Decimal` do Prisma (`mul`, `div`, `minus`, `plus`, `toDecimalPlaces(2)`) em:
- `processarPrimeiraFaturaPaga`: cálculo de valorCalc e valorKwh
- `aplicarBeneficiosNoFechamento`: saldoDisponivel, totalDesconto, novoSaldo, novoAplicado
**Commit:** `a1d64d4` (mesmo commit que MLM-05)

---

## Resumo

| ID | Severidade | Status | Commit |
|----|-----------|--------|--------|
| MLM-01 | CRÍTICO | CORRIGIDO | f83ea57 |
| MLM-02 | CRÍTICO | CORRIGIDO | f83ea57 |
| MLM-03 | CRÍTICO | CORRIGIDO | 1b0d958 |
| WA-10 | ALTA | CORRIGIDO | 6931700 |
| MLM-04 | ALTA | CORRIGIDO | c62d733 |
| MLM-05 | ALTA | CORRIGIDO | a1d64d4 |
| MLM-06 | ALTA | CORRIGIDO | a1d64d4 |

**7/7 itens corrigidos com sucesso.**

### Observações
- O endpoint `entrada-indicado` permanece `@Public()` (necessário para landing page de indicação), mas agora com validação de payload via DTO.
- O `webhookIncoming` também é `@Public()` e foi modificado por outro agente/linter (await do processarMensagem + try/catch) — não tocado neste escopo.
- Recomenda-se testar os fluxos de indicação end-to-end após estas correções, especialmente o comportamento dos endpoints cooperado com o novo guard de roles.
