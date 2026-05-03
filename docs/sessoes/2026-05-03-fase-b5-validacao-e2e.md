# Fase B.5 — Validação E2E dos 3 modelos com cooperados teste novos

**Data:** 2026-05-03 (sessão Code, ~2h após Fase B).
**Modo:** seed isolado em cooperativa teste, dados produtivos da CoopereBR intocados.
**Resultado:** ✅ **6/6 cenários batem precisão de centavo nos 8 valores cada.**

---

## 1. Decisão B33 + Fase B.5 em uma frase

> `tarifaContratual` é **pós-desconto**. A engine consumidora **não aplica desconto novamente**. Toda cobrança gerada (FIXO/COMPENSADOS/DINAMICO) grava `valorBruto`, `valorDesconto`, `valorLiquido` e os **4 valores de economia projetada** (mês, ano, 5 anos, 15 anos).

## 2. Regra "FIXO lê fatura no aceite, depois trava"

| Modelo | O que olha pra calcular | Quando |
|---|---|---|
| **FIXO_MENSAL** | Fatura do **aceite** (uma vez) — congela `valorContrato` + `valorCheioKwhAceite` no contrato. Cobrança mensal usa o snapshot do aceite. | Só no aceite. |
| **CREDITOS_COMPENSADOS** | Fatura do **aceite** (congela `tarifaContratual`) + fatura **do mês** (lê `kwhCompensado` + `valorCheioKwh` pra calcular `valorBruto` do mês). | Aceite + cada mês. |
| **CREDITOS_DINAMICO** | Apenas fatura **do mês** (recalcula tarifa via helper). | Cada mês (snapshot do aceite só pra histórico). |

**Por quê FIXO precisa do snapshot da fatura do aceite (Fase B.5):** sem ele, FIXO não conseguia calcular `valorBruto` (era setado igual ao `valorLiquido` → `valorDesconto=0` sempre, dashboards de economia zerados — bug Sprint 7 #4 conhecido).

## 3. Os 4 valores de economia (uniformes nos 3 modelos)

```
valorEconomiaMes    = valorBruto - valorLiquido
valorEconomiaAno    = valorEconomiaMes × 12
valorEconomia5anos  = valorEconomiaMes × 60
valorEconomia15anos = valorEconomiaMes × 180
```

**Cálculo simples, sem IPCA, sem reajuste.** Frontend exibe pra cooperado como projeção transparente.

## 4. Tabela GATE 1 — 6 cenários, 8 colunas

Cenário base (mesmo nos 6):
- `valorCheioKwh` = R$ 1,02000
- `tarifaSemImpostos` = R$ 0,78000
- `descontoBase` = 15%
- `kwhCompensado` = `kwhContratoMensal` = 500 kWh

| # | Modelo | base | tarifaContrat | valorBruto | valorLiquido | valorDesconto | EconMes | EconAno | Econ5a | Econ15a | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | FIXO_MENSAL | KWH_CHEIO | 0.86700 | 510.00 | 433.50 | 76.50 | 76.50 | 918.00 | 4590.00 | 13770.00 | ✓ |
| 2 | FIXO_MENSAL | SEM_TRIBUTO | 0.90300 | 510.00 | 451.50 | 58.50 | 58.50 | 702.00 | 3510.00 | 10530.00 | ✓ |
| 3 | CREDITOS_COMPENSADOS | KWH_CHEIO | 0.86700 | 510.00 | 433.50 | 76.50 | 76.50 | 918.00 | 4590.00 | 13770.00 | ✓ |
| 4 | CREDITOS_COMPENSADOS | SEM_TRIBUTO | 0.90300 | 510.00 | 451.50 | 58.50 | 58.50 | 702.00 | 3510.00 | 10530.00 | ✓ |
| 5 | CREDITOS_DINAMICO | KWH_CHEIO | 0.86700 | 510.00 | 433.50 | 76.50 | 76.50 | 918.00 | 4590.00 | 13770.00 | ✓ |
| 6 | CREDITOS_DINAMICO | SEM_TRIBUTO | 0.90300 | 510.00 | 451.50 | 58.50 | 58.50 | 702.00 | 3510.00 | 10530.00 | ✓ |

**Todos os 8 valores em todos os 6 cenários conferem com precisão de centavo.**

## 5. IDs criados no banco (pra Luciano validar manualmente)

```
Cooperativa TESTE-FASE-B5: cmopx8oft0000va1sre1vqwik
Usina TESTE-USINA-B5:      cmopx8p2k0008va1sjg9z3ix0
```

| # | Cooperado | ID | Contrato | Cobrança | Modelo + base |
|---|---|---|---|---|---|
| 1 | TESTE-B5-FIXO-CHEIO | `cmopx8pbu000bva1si7o0flg1` | `cmopx8pn0000iva1sm41f5vm1` | `cmopx8pv2000mva1szlcaib7u` | FIXO_MENSAL + KWH_CHEIO |
| 2 | TESTE-B5-FIXO-SEMTRIB | `cmopx8pyt000pva1s8feygfc0` | `cmopx8q8u000wva1sflyez8sz` | `cmopx8qf90010va1sce151nc0` | FIXO_MENSAL + SEM_TRIBUTO |
| 3 | TESTE-B5-COMP-CHEIO | `cmopx8qj00013va1sqzapi1e7` | `cmopx8qtp001ava1sak4t0wu7` | `cmopx8r0e001eva1ses9x2b9s` | COMPENSADOS + KWH_CHEIO |
| 4 | TESTE-B5-COMP-SEMTRIB | `cmopx8r3l001hva1smfhw9l4m` | `cmopx8rdd001ova1sspl1d5nu` | `cmopx8rjy001sva1soshz90tr` | COMPENSADOS + SEM_TRIBUTO |
| 5 | TESTE-B5-DIN-CHEIO | `cmopx8rna001vva1s6q5835j0` | `cmopx8rx70022va1so2866e3j` | `cmopx8s580026va1s4rglk4ge` | DINAMICO + KWH_CHEIO |
| 6 | TESTE-B5-DIN-SEMTRIB | `cmopx8s8x0029va1s6hbpz6uo` | `cmopx8sin002gva1svo6sbj9l` | `cmopx8sp5002kva1sstrv5xi4` | DINAMICO + SEM_TRIBUTO |

## 6. Como Luciano valida manualmente

### Via UI (logado como SUPER_ADMIN)

1. Login `/login` → `dashboard/`
2. Lista de planos: `dashboard/planos` — devem aparecer os 6 planos `B5-*-15` com escopo "Específico de TESTE-FASE-B5"
3. Lista de cooperados: `dashboard/cooperados` — filtrar por nome `TESTE-B5-*`
4. Clicar em cada cooperado → conferir contrato com snapshots (`tarifaContratual`, `valorContrato`, `valorCheioKwhAceite`)
5. Lista de cobranças: `dashboard/cobrancas` — filtrar pelos `cooperativaId` da TESTE-FASE-B5

### Via SQL direto

```sql
SELECT
  co."nomeCompleto",
  p."nome" AS plano,
  p."modeloCobranca",
  p."baseCalculo",
  ct."tarifaContratual",
  c."valorBruto",
  c."valorLiquido",
  c."valorDesconto",
  c."valorEconomiaMes",
  c."valorEconomiaAno",
  c."valorEconomia5anos",
  c."valorEconomia15anos"
FROM cobrancas c
JOIN contratos ct ON ct.id = c."contratoId"
JOIN cooperados co ON co.id = ct."cooperadoId"
JOIN planos p ON p.id = ct."planoId"
WHERE co."nomeCompleto" LIKE 'TESTE-B5-%'
ORDER BY p."modeloCobranca", p."baseCalculo";
```

## 7. Técnica de bypass usada

`process.env.BLOQUEIO_MODELOS_NAO_FIXO = 'false'` setada **na primeira linha** do script `backend/scripts/seed-fase-b5.ts`. Isso libera os 7 enforcement points apenas no **processo do script**.

**Por que é segura:**
- Backend PM2 (PID 21020) **não foi reiniciado** — flag em runtime de produção continua `true` (default do código).
- `.env` do projeto **não contém** `BLOQUEIO_MODELOS_NAO_FIXO`. Verificado: `grep BLOQUEIO backend/.env` retorna vazio.
- Script ts-node morre ao terminar — env temporária morre junto.

## 8. Como deletar tudo (cleanup completo)

```sql
DELETE FROM cobrancas WHERE "contratoId" IN (
  SELECT id FROM contratos WHERE "cooperativaId" = 'cmopx8oft0000va1sre1vqwik'
);
DELETE FROM contratos WHERE "cooperativaId" = 'cmopx8oft0000va1sre1vqwik';
DELETE FROM faturas_processadas WHERE "cooperativaId" = 'cmopx8oft0000va1sre1vqwik';
DELETE FROM ucs WHERE "cooperativaId" = 'cmopx8oft0000va1sre1vqwik';
DELETE FROM cooperados WHERE "cooperativaId" = 'cmopx8oft0000va1sre1vqwik';
DELETE FROM usinas WHERE "cooperativaId" = 'cmopx8oft0000va1sre1vqwik';
DELETE FROM planos WHERE "cooperativaId" = 'cmopx8oft0000va1sre1vqwik';
DELETE FROM cooperativas WHERE id = 'cmopx8oft0000va1sre1vqwik';
```

Alternativa: rodar `npx ts-node scripts/seed-fase-b5.ts` de novo — script é **idempotente**, limpa execução anterior pelo CNPJ `11.111.111/0001-11` e recria.

## 9. Recomendação técnica de próximo passo

### Opção A — Canário em 1 cooperado real (recomendado)

1. Identificar 1 cooperado real CoopereBR com plano FIXO funcional hoje.
2. Trocar `modeloCobrancaOverride` desse contrato pra `CREDITOS_COMPENSADOS`.
3. Rodar 1 ciclo mensal de cobrança (próxima fatura). Conferir cobrança gerada bate com expectativa.
4. Após 1 mês estável → desativar `BLOQUEIO_MODELOS_NAO_FIXO` global.

**Pré-requisito:** popular `tarifaContratual` + `valorCheioKwhAceite` retroativamente nesse contrato (atualmente null em todos os 72 legados).

### Opção B — Fase C (UI) primeiro

UI de listar/criar plano com `baseCalculo` selecionável + UI de simulação por cooperado. Evita canário até admin ter ferramenta visual.

**Recomendação Code:** **A com cuidado.** Validação E2E sintética já está completa. Canário real testa o pipeline OCR + fatura real EDP, que o seed mockou. Se algo quebra em produção, é nessa fronteira (OCR ↔ engine).

Esperar Luciano decidir.

---

*Validação E2E concluída em 2026-05-03. Backend produção intocado. Cooperativa teste isolada com 6 cenários verde. Pronto para Fase C ou canário.*
