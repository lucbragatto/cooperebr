# Auditoria IDOR / Multi-Tenant — Módulos Núcleo (30/05/2026)

> Gerada via **Dynamic Workflow** (Claude Code, Opus 4.8) — 28 subagentes, 1.437.072 tokens, 4 min.
> Escopo: 5 grupos núcleo (cobrancas/faturas, cooperados/contratos, usinas/ucs/geracao, financeiro/config/token, indicacoes/propostas/motor).
> Método: mapeamento paralelo de endpoints de mutação + verificação adversarial de cada candidato (distingue IDOR real de verificação prévia de posse).

## Resumo executivo

| Métrica | Valor |
|---|---|
| Endpoints de mutação mapeados | 61 |
| Seguros (filtro ou verificação prévia) | 38 |
| Suspeitos brutos | 23 |
| **IDORs CONFIRMADOS** | **18** |
| CRÍTICOS | 7 |
| ALTOS | 8 |
| MÉDIOS | 3 |

**Padrão da falha:** controller não passa `req.user.cooperativaId` ao service, OU service faz `findUnique({ where: { id } })` sem `cooperativaId`. Resultado: ADMIN/OPERADOR do tenant A modifica/apaga/lê recurso do tenant B passando o UUID.

**Padrão do fix:** verificação prévia de posse (`findFirst({ where: { id, cooperativaId } })` → NotFound se null) + `SUPER_ADMIN` bypass (`cooperativaId = null` ignora o guard). Mecânico e repetível.

**Contexto histórico:** existe um fix anterior `D-48-contratos IDOR fix` aplicado em `remove()`/`ativar()` de contratos — mas `update()` ficou de fora. Confirma que o problema é conhecido e foi corrigido parcialmente.

**Impacto de negócio:** com 1 tenant real hoje (CoopereBR) o risco não está materializado. Mas é **BLOQUEADOR ABSOLUTO do onboarding Sinergia** (2º parceiro) — sem isolamento, um parceiro mexe nos dados do outro.

---

## CRÍTICOS (7)

### C1 — PUT /contratos/:id
- **Service:** `contratos.service.ts:406` — `tx.contrato.update({ where: { id } })` (e linha 410)
- **Problema:** controller passa cooperativaId, mas service nunca verifica posse. ADMIN tenant A altera percentualDesconto, kwhContrato, status, usinaId, planoId de contrato de outro tenant. `remove()`/`ativar()` têm o fix D-48; `update()` ficou de fora.
- **Fix:** `findFirst({ where: { id, cooperativaId } })` no início de `update()` (~linha 352), espelhando remove().

### C2 — PUT /usinas/:id
- **Service:** `usinas.service.ts:315`
- **Problema:** controller (linha 81) não passa req.user; service findUnique sem cooperativaId. DELETE /usinas/:id tem a mesma falha.
- **Fix:** passar req.user.cooperativaId + verificação posse (espelha `verificarListaEspera`).

### C3 — PUT /ucs/:id
- **Service:** `ucs.service.ts:203`
- **Problema:** Uc tem cooperativaId direto mas nunca filtra. ADMIN/OPERADOR edita UC de outro tenant. DELETE /ucs/:id idem.
- **Fix:** verificação posse OU `updateMany({ where: { id, cooperativaId } })`.

### C4 — PUT /geracao-mensal/:id
- **Service:** `geracao-mensal.service.ts:54`
- **Problema:** GeracaoMensal não tem cooperativaId direto (vem via usina), service nunca faz o join. Falsifica kWh que afeta cobrança/créditos. DELETE idem.
- **Fix:** `findFirst({ where: { id, usina: { cooperativaId } } })`.

### C5 — PUT /configuracao-cobranca  ⚠️ pior que IDOR-por-id
- **Service:** `configuracao-cobranca.service.ts:16-31`
- **Problema:** aceita `cooperativaId` do **BODY** (não do JWT). ADMIN tenant A envia `{cooperativaId: "<tenant-B>", descontoPadrao: 0}` e **zera descontos de outro tenant**.
- **Fix:** usar `req.user.cooperativaId`, ignorar body (exceto SUPER_ADMIN).

### C6 — PUT /configuracao-cobranca/usina/:usinaId
- **Problema:** mesmo de C5 — cooperativaId do body + usinaId não verificado. Zera descontos de usinas de outro tenant.
- **Fix:** cooperativaId do JWT + verificar usinaId pertence ao tenant.

### C7 — POST /motor-proposta/proposta/:id/aprovar-presencial
- **Service:** `motor-proposta.service.ts:1299-1314`
- **Problema:** aprova proposta de outro tenant (status ACEITA), pode ativar cooperados alheios.
- **Fix:** `findFirst({ where: { id, cooperado: { cooperativaId } } })`.

---

## ALTOS (8)

### A1 — PATCH /faturas/:id/vincular (`faturas.service.ts:2233`)
Valida o cooperadoId do body mas não a fatura. Cruza dados entre tenants. Fix: filtrar fatura por cooperativaId.

### A2 — POST /cooperados/:id/fatura-mensal (`cooperados.service.ts:1358`)
Sobrescreve cotaKwhMensal de cooperado de outro tenant + cria FaturaProcessada no tenant B. Fix: verificação posse.

### A3 — DELETE /usinas/:id (`usinas.service.ts:327`)
Exclui usina de outro tenant (se sem contratos ativos). Fix: posse antes do delete.

### A4 — DELETE /ucs/:id (`ucs.service.ts:215`)
Deleta UC de outro tenant. Fix: posse via `cooperado: { cooperativaId }`.

### A5 — DELETE /geracao-mensal/:id (`geracao-mensal.service.ts:59`)
Apaga histórico kWh de outro tenant (afeta cobrança retroativa). Fix: posse via usina.

### A6 — POST /cooper-token/admin/confirmar-compra (`cooper-token.service.ts:1509-1548`)  ⚠️ impacto financeiro
Credita tokens no tenant B **sem pagamento real** + evento contábil. Fix: verificar `compra.cooperativaId === req.user.cooperativaId`.

### A7 — POST /motor-proposta/proposta/:id/enviar-aprovacao (`motor-proposta.service.ts:1234`)
Sobrescreve tokenAprovacao de proposta alheia, sequestra link de aprovação. Fix: findFirst com cooperativaId.

### A8 — POST /motor-proposta/upload-modelo (`motor-proposta.service.ts:1676`)
Aceita cooperativaId do body, associa modelo a outro tenant. Fix: cooperativaId do JWT.

---

## MÉDIOS (3)

### M1 — POST /cooperados/:id/alocar-usina (`cooperados.service.ts:1277`)
Vaza nome/UC/consumo de cooperado de outro tenant (leitura cross-tenant). Fix: verificação posse.

### M2 — POST /indicacoes/registrar (`indicacoes.service.ts:132-248`)
COOPERADO sobrescreve cooperadoIndicadorId de cooperado de outro tenant. Fix: filtrar por cooperativaId do JWT, remover derivação `indicador.cooperativaId || indicado.cooperativaId`.

### M3 — POST /indicacoes/processar-pagamento (`indicacoes.service.ts:252-386`)
Marca indicações de outro tenant como pagas + cria benefícios/tokens no tenant B. Fix: cooperativaId no findMany.

---

## Plano de correção sugerido (Sprint Segurança IDOR — D-novo-BQ)

Fix é padronizado. Fatiar por grupo (mesmos grupos da auditoria):
- **BQ.1** CRÍTICOS contratos + usinas + ucs + geracao (C1-C4 + A3-A5 DELETEs) — entidades núcleo
- **BQ.2** CRÍTICOS configuracao-cobranca body-injection (C5-C6) + cooper-token financeiro (A6)
- **BQ.3** motor-proposta (C7 + A7 + A8) + faturas (A1) + cooperados (A2 + M1)
- **BQ.4** indicacoes (M2 + M3)
- Cada fatia: fix + spec de isolamento multi-tenant (tenant A não acessa recurso de tenant B → 403/404) + build + smoke

**Pré-requisito:** Fase 1 read-only confirma cada fix contra o código atual antes de aplicar (Decisão 23). Vários fixes já vêm detalhados neste relatório.

**Verificação:** após cada fatia, rodar spec que tenta acesso cross-tenant e espera 403/404.
