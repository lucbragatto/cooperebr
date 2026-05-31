# Auditoria 53 LancamentoCaixa legados — pré-migration enum NaturezaCooperativa (31/05/2026)

> Gerada pelo script `backend/scripts/audit-lancamentos-legados-ct.ts` (read-only, NÃO alterou nenhum dado).
> **Destino:** Walter (contador externo) — validação antes de promover `naturezaAto String → enum NaturezaCooperativa` (Sprint Contabilidade Tributária CT.1).
> **Regra CLAUDE.md:** auditoria obrigatória antes de qualquer migration de mudança de tipo (String → Enum). Item A do checklist de segurança de migrations.

---

## 1. Resumo executivo

| Métrica | Valor |
|---|---|
| Total de lançamentos | 58 |
| Distribuição **atual** `naturezaAto` (String livre) | COOPERADO_PROPRIO=58 |
| Distribuição **inferida** (parecer conformidade) | INDETERMINADO=3 / PROPRIO=55 |
| Confiança da inferência | INSPECIONAR=3 / ALTA=55 |
| Linhas que **precisam validação Walter** | 3/58 |
| **Divergências REAIS** (atual normalizado ≠ inferida, fora de INDETERMINADO) | 0 |

> **Nota sobre divergência:** `COOPERADO_PROPRIO` (String legado) → `PROPRIO` (enum) é renomeação esperada na migration, NÃO divergência. Só conta como divergência real quando a inferência aponta classificação diferente de PROPRIO (ex: AUXILIAR ou NAO_COOPERATIVO).

## 2. Critérios de inferência aplicados

Baseados no parecer do subagent `cooperebr-analista-conformidade` (Sprint CT Fase 1):

1. **PROPRIO** — Cooperado-associado ativo (tipo `COM_UC` / `SEM_UC` / `COM_USINA_PROPRIA`) ou despesa operacional de usina (Art. 79 + STF Tema 536). Confiança ALTA.
2. **NAO_COOPERATIVO** — Cooperado tipo `USUARIO_CARREGADOR` (sem vínculo cooperativo formal). Confiança ALTA.
3. **AUXILIAR** — Repasse/arrendamento a proprietário externo OU vínculo com ContratoConvenio (Art. 88 Lei 5.764/71). Confiança MEDIA — Walter valida se contrato cumpre requisitos.
4. **INDETERMINADO** — PIX Excedente, ContratoUso (carregador EV), ou sem fonte rastreável. Confiança INSPECIONAR — Walter analisa caso-a-caso.

**Riscos endereçados pelo parecer:**
- Risco 1 (CRÍTICO): perda total isenção PIS/COFINS por falta de segregação — esta auditoria estabelece a baseline.
- Risco 5 (MÉDIO): 53 lançamentos com default `COOPERADO_PROPRIO` sem validação — esta auditoria identifica os divergentes.

## 3. Inventário completo (58 linhas)

| # | id | data | tipo | valor | Natureza ATUAL | Natureza INFERIDA | Confiança | Walter? | Fonte da inferência | Descrição |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `cmn7rvxai000…` | 2026-03-26 | RECEITA | 1531.8 | COOPERADO_PROPRIO | **INDETERMINADO** | INSPECIONAR | ⚠️ SIM | nenhuma | Recebimento mensalidade - Carlos Eduardo Pereira - 03/2026 |
| 2 | `cmn7rvxvx000…` | 2026-03-26 | RECEITA | 1021.2 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Beatriz Santos Lima - 03/2026 |
| 3 | `cmn7rvygd000…` | 2026-03-26 | RECEITA | 2042.4 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Luciana Meireles Costa - 03/2026 |
| 4 | `cmn8pghnh000…` | 2026-03-27 | RECEITA | 262.79 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Maria Silva - 02/2025 |
| 5 | `cmn8pghvz000…` | 2026-03-27 | RECEITA | 322.86 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - João Santos da Silva - 04/2025 |
| 6 | `cmn8pgi40000…` | 2026-03-27 | RECEITA | 290.27 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Paula Costa - 05/2025 |
| 7 | `cmn8pgiby000…` | 2026-03-27 | RECEITA | 181.47 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Carlos Pereira - 05/2025 |
| 8 | `cmn8pgijw000…` | 2026-03-27 | RECEITA | 347.27 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Ana Oliveira - 05/2025 |
| 9 | `cmn8pgirs000…` | 2026-03-27 | RECEITA | 273.77 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Paula Costa - 06/2025 |
| 10 | `cmn8pgizn000…` | 2026-03-27 | RECEITA | 162.11 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Carlos Eduardo Prata - 10/2025 |
| 11 | `cmn8pgj7j000…` | 2026-03-27 | RECEITA | 170.19 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Carlos Eduardo Prata - 11/2025 |
| 12 | `cmn8pgjfh000…` | 2026-03-27 | RECEITA | 160.12 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Carlos Eduardo Prata - 12/2025 |
| 13 | `cmn8pgkz4000…` | 2026-03-27 | RECEITA | 1265.18 | COOPERADO_PROPRIO | **INDETERMINADO** | INSPECIONAR | ⚠️ SIM | nenhuma | Recebimento mensalidade (PIX) - Residencial Solar das Palmei… |
| 14 | `cmn8pgl70000…` | 2026-03-27 | RECEITA | 175.92 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade (BOLETO) - Carlos Eduardo Prata - 01… |
| 15 | `cmn8pglev000…` | 2026-03-27 | RECEITA | 136.98 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade (PIX) - Fernando Augusto - 01/2026 |
| 16 | `cmn8pglmr000…` | 2026-03-27 | RECEITA | 135.64 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade (BOLETO) - Fernando Augusto - 02/202… |
| 17 | `cmn8pglun000…` | 2026-03-27 | RECEITA | 152.14 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade (PIX) - Carlos Eduardo Prata - 02/20… |
| 18 | `cmn8pgm2j000…` | 2026-03-27 | RECEITA | 108.8 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade (BOLETO) - Beatriz Santos - 02/2026 |
| 19 | `cmn8pgmae000…` | 2026-03-27 | RECEITA | 158.54 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade (PIX) - Carlos Eduardo Prata - 03/20… |
| 20 | `cmn8pgmi8000…` | 2026-03-27 | RECEITA | 1200 | COOPERADO_PROPRIO | **INDETERMINADO** | INSPECIONAR | ⚠️ SIM | nenhuma | Recebimento mensalidade (BOLETO) - Residencial Solar das Pal… |
| 21 | `cmn8pgmq3000…` | 2026-03-27 | RECEITA | 131.2 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade (PIX) - Fernando Augusto - 03/2026 |
| 22 | `cmn8uvev1000…` | 2026-03-27 | RECEITA | 1225.44 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Fernando Augusto Silva - 03/2026 |
| 23 | `cmn8uvhu2000…` | 2026-03-27 | RECEITA | 164 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Luciana Meireles - 03/2026 |
| 24 | `cmn8uvks4000…` | 2026-03-27 | RECEITA | 121.42 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Beatriz Santos - 03/2026 |
| 25 | `cmn8uvnbo000…` | 2026-03-27 | RECEITA | 96 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Maria Silva Santos - 03/2026 |
| 26 | `cmn8uvqcs000…` | 2026-03-27 | RECEITA | 627.07 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Roberto Fonseca Alves - 03/2026 |
| 27 | `cmnhw5aq3000…` | 2026-04-14 | DESPESA | 19000 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | tipo=DESPESA + categoria operacional | EDP |
| 28 | `cmnubju7e000…` | 2026-04-11 | DESPESA | 0 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | [Token] D: Custo Desconto Concedido — Emissão 49 tokens (BON… |
| 29 | `cmnubjuei000…` | 2026-04-11 | RECEITA | 0 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | [Token] C: Passivo Tokens a Resgatar — Emissão 49 tokens (BO… |
| 30 | `cmnubsyka000…` | 2026-04-11 | DESPESA | 0 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | [Token] D: Custo Desconto Concedido — Emissão 49 tokens (BON… |
| 31 | `cmnubsysg000…` | 2026-04-11 | RECEITA | 0 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | [Token] C: Passivo Tokens a Resgatar — Emissão 49 tokens (BO… |
| 32 | `cmnubwgmw000…` | 2026-04-11 | DESPESA | 0 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | [Token] D: Custo Desconto Concedido — Emissão 49 tokens (BON… |
| 33 | `cmnubwgsk000…` | 2026-04-11 | RECEITA | 0 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | [Token] C: Passivo Tokens a Resgatar — Emissão 49 tokens (BO… |
| 34 | `cmo35gumk000…` | 2026-04-17 | RECEITA | 153.35 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - Luciana Meireles - 03/2026 |
| 35 | `cmo35jsd6000…` | 2026-05-10 | RECEITA | 326 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Mensalidade - Luciana Meireles - 04/2026 |
| 36 | `cmobdm08n000…` | 2026-04-23 | RECEITA | 600 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento E2E teste CLUBE - AGOSTINHO - 05/2026 |
| 37 | `cmobfaqbc000…` | 2026-04-23 | RECEITA | 500 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | E2E Sprint 9 CLUBE pagamento |
| 38 | `cmofsh4q9000…` | 2026-04-10 | DESPESA | 60000 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | tipo=DESPESA + categoria operacional | Usina e-solares |
| 39 | `cmofsh4ym000…` | 2026-05-10 | DESPESA | 60000 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | tipo=DESPESA + categoria operacional | Usina e-solares |
| 40 | `cmofsh53a000…` | 2026-06-10 | DESPESA | 60000 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | tipo=DESPESA + categoria operacional | Usina e-solares |
| 41 | `cmofshooa000…` | 2026-04-10 | DESPESA | 60000 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | tipo=DESPESA + categoria operacional | esolares |
| 42 | `cmofshot5000…` | 2026-05-10 | DESPESA | 60000 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | tipo=DESPESA + categoria operacional | esolares |
| 43 | `cmofshoy3000…` | 2026-06-10 | DESPESA | 60000 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | tipo=DESPESA + categoria operacional | esolares |
| 44 | `cmoh8zely000…` | 2026-04-27 | RECEITA | 8 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - TESTE E2E CLUBE SPRINT9 - 04/2026 |
| 45 | `cmoh95aoc000…` | 2026-04-27 | DESPESA | 0 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | [Token] D: Custo Desconto Concedido — Emissão 1.96 tokens (F… |
| 46 | `cmoh95ajt000…` | 2026-04-27 | RECEITA | 0 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | [Token] C: Passivo Tokens a Resgatar — Emissão 1.96 tokens (… |
| 47 | `cmoh9o3b8000…` | 2026-04-27 | RECEITA | 12 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - AGOSTINHO SOBRAL SAMPAIO - 04/2026 |
| 48 | `cmoh9p2hb000…` | 2026-04-27 | DESPESA | 0 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | [Token] D: Custo Desconto Concedido — Emissão 2.94 tokens (F… |
| 49 | `cmoh9p2nx000…` | 2026-04-27 | RECEITA | 0 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | [Token] C: Passivo Tokens a Resgatar — Emissão 2.94 tokens (… |
| 50 | `cmohbfqvk000…` | 2026-04-27 | RECEITA | 20 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - AGOSTINHO SOBRAL SAMPAIO - 07/2026 |
| 51 | `cmohbgqs8000…` | 2026-04-27 | RECEITA | 0 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | [Token] C: Passivo Tokens a Resgatar — Emissão 3.92 tokens (… |
| 52 | `cmohbgqxi000…` | 2026-04-27 | DESPESA | 0 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | [Token] D: Custo Desconto Concedido — Emissão 3.92 tokens (F… |
| 53 | `cmohbkyzx000…` | 2026-04-27 | RECEITA | 40 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - ADRIANA MARIA ALMENARA ZAMBON - 07… |
| 54 | `cmp5i9alm000…` | 2026-06-12 | RECEITA | 447.68 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Mensalidade - DIEGO ALLAN CORREIA PEREIRA - 01/2026 |
| 55 | `cmp5i9ayk000…` | 2026-05-14 | RECEITA | 142.32 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Recebimento mensalidade - CAROLINA LEMOS CRAVO - 01/2026 |
| 56 | `cmp5i9bb5000…` | 2026-06-12 | RECEITA | 940.93 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Mensalidade - ALMIR JOAO MUNIZ FREITAS - 12/2025 |
| 57 | `cmp5i9bnn000…` | 2026-06-12 | RECEITA | 1011.33 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Mensalidade - THEOMAX COMERCIO DE CALCADOS E ACESSORIOS LTDA… |
| 58 | `cmp704sk3000…` | 2026-06-14 | RECEITA | 979.2 | COOPERADO_PROPRIO | **PROPRIO** | ALTA | não | cooperado.tipoCooperado | Mensalidade - Associação dos Magistrados do Espírito Santo -… |

## 4. Linhas que PRECISAM validação Walter (3)

| # | id | data | valor | Inferida | Motivo |
|---|---|---|---|---|---|
| 1 | `cmn7rvxai000…` | 2026-03-26 | 1531.8 | INDETERMINADO | Sem fonte rastreável (sem cooperado, contratoUso, convenio, padrão de descrição). Inspecionar individualmente. |
| 2 | `cmn8pgkz4000…` | 2026-03-27 | 1265.18 | INDETERMINADO | Sem fonte rastreável (sem cooperado, contratoUso, convenio, padrão de descrição). Inspecionar individualmente. |
| 3 | `cmn8pgmi8000…` | 2026-03-27 | 1200 | INDETERMINADO | Sem fonte rastreável (sem cooperado, contratoUso, convenio, padrão de descrição). Inspecionar individualmente. |

## 5. Divergências REAIS (atual normalizado ≠ inferida, fora de INDETERMINADO) — 0

_**Nenhuma divergência real.** Todos os lançamentos com inferência ALTA confiança batem com o valor atual (`COOPERADO_PROPRIO` → `PROPRIO` é renomeação enum esperada). Apenas as 3 linhas marcadas Walter precisam validação manual._

## 6. Plano de promoção String → enum (proposto)

**Passo 1 — UPDATE de normalização (após validação Walter):**

1. Para cada linha de confiança **ALTA**, aplicar a inferência automaticamente.
2. Para cada linha **MEDIA**, conferir com Walter antes de aplicar.
3. Para cada linha **INSPECIONAR** (INDETERMINADO), Walter define caso-a-caso.

**Passo 2 — ALTER TYPE (após 100% das linhas terem valor válido do enum):**

```prisma
model LancamentoCaixa {
  naturezaAto NaturezaCooperativa @default(PROPRIO)
}

enum NaturezaCooperativa { PROPRIO AUXILIAR NAO_COOPERATIVO }
```

**Validação pós-migration:** `SELECT naturezaAto, COUNT(*) FROM lancamentos_caixa GROUP BY naturezaAto;` deve mostrar 3 buckets.

## 7. Apêndice — CSV completo

Tabela machine-readable em `docs/relatorios/2026-05-31-auditoria-53-lancamentos-legados.csv`.
