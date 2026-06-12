# Sessão Cowork 12/06/2026 — Tese 6 (ICMS sobre TUSD/TE em GD) + Dossiê EXFISHES 14 faturas reais

## TL;DR (4 linhas)

Sessão Cowork em paralelo ao Code (M32 Sprint Clube). Pesquisa estratégica solicitada pelo Luciano sobre ICMS em GD nos tribunais/estados revelou a **Tese 6** — análoga à Tese 3 mas com ICMS (alíquota 17%, vs PIS+COFINS ~5%), gerando **indébito 4× maior**. Detector implementado no backend (20/20 specs verdes). Parser EXFISHES refinado, calibrado e rodado nas 14 faturas reais: **indébito mensal médio R$ 14.788** (T3+T6), cenário máximo **R$ 4.968.768** (EXFISHES sozinha, 120m × dobro CDC). Achado crítico: narrativa "transição GDIII mar/2026" da Tela 4 do mockup estava incorreta — SCEE ativo desde out/2024+, a transição foi mudança de regime de injeção. Tela 4 corrigida nesta sessão.

## Entregas — Pesquisa estratégica Tese 6

- `docs/concierge/2026-06-12-tese-6-icms-tusd-te-gd-scee.md` (17KB) — fundamento jurídico em camadas:
  - **Primário (cooperativa)**: Art. 79 Lei 5.764/71 — ato cooperativo, não implica operação de mercado
  - Secundários: Lei 14.300/2022 (SCEE = empréstimo gratuito), Convênio CONFAZ 16/2015, Lei GERAR-ES (renovada vigente 2026), STJ Tema 986 (ressalva GD), TJ-MT abr/2026 (afastou ICMS sobre TUSD em GD), TJ-RJ (linha consolidada), STF ADIs 7.077/7.634/7.716 mar/2026 (energia = bem essencial), Súmula 391/STJ (demanda utilizada)
- Mapa de risco por UF — ES como ALTO p/ cooperativa (Lei GERAR garante GD comum até 5 MW mas não afeta tese cooperativa por Art. 79)

## Entregas — Detector backend Tese 6

- `backend/src/concierge/detectores/detector-tese6-icms-scee.ts` (NOVO, 130 linhas)
- `backend/src/concierge/detectores/detectores.types.ts` — `TESE_6_ICMS_TUSD_TE_SOBRE_SCEE` adicionado ao CodigoPadrao
- `backend/src/concierge/detectores/detectores.registry.ts` — DetectoresRegistry consome 4 detectores
- `backend/src/concierge/detectores/detectores.spec.ts` — **4 testes novos** Tese 6 + ajuste do Registry consolidação
- `backend/src/concierge/concierge.module.ts` — provider registrado

**Suite Concierge**: 69/69 tests passing (Detectores 20/20 verdes, incluindo Tese 6).
**TSC**: zero erros nos arquivos modificados (apenas erro pré-existente Prisma generated).

## Entregas — Análise EXFISHES (14 faturas reais)

### Parser v3 refinado

- `backend/scripts/exfishes-parser-v1-WIP.py` (mantido do dia anterior)
- Estratégia: `pdfplumber.extract_words(use_text_flow=True, keep_blank_chars=False)` ao invés de `extract_text` → palavras limpas com posição x0/top
- 3 bugs do v1 resolvidos: TOTAL com decimais ✓, TUSD/TE injetada sem confundir com R$ 200 ilum pública ✓, indébito sempre ≥ 0 ✓
- Calibrado contra ABR/2026: 100% dos valores conferem com fatura original

### Relatório standalone

- `docs/concierge/2026-06-12-relatorio-exfishes-14-faturas.md` (7KB) — análise mensal completa + projeções + ressalvas
- `docs/concierge/EXFISHES-Analise-14-Faturas-2026-06-12.xlsx` (11KB) — 3 abas:
  1. **Série Temporal** — 14 faturas com 18 colunas (período, TUSD/TE forn+inj, bases, indébitos T3/T6, normalizado 30d)
  2. **Projeções** — cenários 12m → 120m + dobro CDC
  3. **Ressalvas & Metodologia** — 10 itens
- `docs/concierge/wip/exfishes-serie-v3.json` (24KB) — saída crua do parser pra retomadas

### Achados centrais EXFISHES

| Métrica | Valor |
|---|---|
| Indébito Tese 3 médio (norm 30d) | R$ 2.928/mês |
| Indébito Tese 6 médio (norm 30d) | **R$ 11.860/mês** |
| **COMBINADO médio** | **R$ 14.788/mês** |
| Total documentado 14 meses observado | R$ 124.076 |
| Total normalizado 30 dias | R$ 207.032 |
| Projeção 60m + SELIC (Via Trib) | R$ 1.064.736 |
| Projeção 120m + SELIC (Via Cons) | R$ 2.484.384 |
| **Cenário máximo 120m × dobro CDC** | **R$ 4.968.768** 🚨 |

## Entregas — Mockup atualizado

- `docs/concierge/mockups/2026-06-11-mockup-telas-concierge.html`
  - **Tela 11 NOVA** — Tese 6 + Dossiê real EXFISHES (organograma, tabela 14 faturas, projeções, fundamento em camadas)
  - **Tela 4 CORRIGIDA** — narrativa GDIII reescrita: SCEE ativo desde out/2024+, mudança de regime em abr/2026 (não entrada SCEE), números atualizados com R$ 14.788/mês + Tese 6 + Tese 5 STF decenal
  - Tamanho final: 1475 linhas, 118KB

## Achados críticos descobertos durante a análise

### 1. Narrativa "transição GDIII mar/2026" estava INCORRETA

A 1ª fatura da série (FEV/2025) já mostra `oUC oPT 01/2025` com 53.574 kWh injetados. SCEE estava ativo desde **out/2024 ou antes**.

A "transição" em mar→abr/2026 foi **mudança de regime de injeção**: saldo SCEE virtual passou de cobrir parcial (4.644 kWh em MAR/2026) para 100% do consumo (73.400 kWh em ABR/2026). Provável entrada de usina nova ou expansão da participação.

→ Tela 4 corrigida nesta sessão.

### 2. R$ 2.515,24 do mockup anterior estava errado tributariamente

O valor R$ 2.515,24 foi calculado como "valor pago - valor correto" da fatura inteira, não como indébito Tese 3 stricto sensu. O valor REAL Tese 3 da fatura ABR/2026 é **R$ 1.509,73**.

E o que falta NÃO é PIS+COFINS adicional — é **ICMS Tese 6**, que dá R$ 7.008,62 só nessa fatura.

### 3. MAI/2026 é fatura de período curto + PDF tem 2 vias

O PDF `EXFISHES _ 16 _ MAI2026.pdf` contém DUAS faturas: pg 1 = MAI/2026 real (6 dias, período 25/04 → 30/04, total R$ 11.744,80), pg 3 = 2ª via de ABR/2026. Parser v3 corrige isso lendo só primeira ocorrência por tipo de rubrica.

### 4. Lei GERAR-ES está RENOVADA e vigente em 2026

Luciano confirmou. Mas isso não interfere na tese cooperativa — Art. 79 Lei 5.764/71 é primário e independente: cooperativa não comercializa, não há circulação jurídica de mercadoria. Tese hígida mesmo se Lei GERAR perdesse vigência.

### 5. Faltam MAR/2025 e MAI/2025 da série

Confirmado por MD5: `#2 MAR2026 = #14 MAR2026 = MARÇO COOPEREBR 1` são triplicatas idênticas. `#15 ABR2026 = ABRIL COOPEREBR 2 = exfishes gdIII` também. Série real = 14 faturas. Luciano vai puxar MAR/2025 e MAI/2025 do portal EDP-ES.

## Débitos novos catalogados

- `D-novo-CONCIERGE-INTEGRAR-TESE6-SERVICE` **P0** — integrar Tese 6 no `concierge.service.ts` (orquestrador) pra aparecer automaticamente em qualquer diagnóstico futuro
- `D-novo-CONCIERGE-MAPA-RISCO-UF-DETECTOR` **P1** — implementar mapa de risco por UF como input do detector Tese 6 (ES/MT/RJ/GO MÉDIO, SP/MG/RN BAIXO, demais ALTO)
- `D-novo-EXFISHES-MAR-MAI-2025-FATURAS` **P1** — Luciano puxar do portal EDP-ES
- `D-novo-CONCIERGE-SELIC-MENSAL-BCB` **P3** — substituir fator linear `1 + meses/12 × 0,04` por tabela SELIC mensal real do BACEN

## Débitos resolvidos

- `D-novo-EXFISHES-PARSER-BUGS` **P0 → RESOLVIDO** — parser v3 calibrado 100% contra ABR/2026
- `D-novo-EXFISHES-NARRATIVA-GDIII-INCORRETA` **P0 → RESOLVIDO** — Tela 4 corrigida
- `D-novo-LEI-GERAR-VIGENCIA-ATUAL` **CONFIRMADO PELO LUCIANO** — vigente, mas não interfere na tese cooperativa

## Decisões catalogadas

- **DEC-001 (12/06/2026):** Tese 6 ataca a cobrança de ICMS sobre TUSD/TE da parcela não compensada via SCEE, fundamento PRIMÁRIO Art. 79 Lei 5.764/71 (cooperativa não comercializa). Lei GERAR e Lei 14.300/22 são reforços secundários.
- **DEC-002:** Parser EXFISHES usa `pdfplumber.extract_words` em vez de `extract_text` — palavras vêm limpas, sem espaços internos nos números.
- **DEC-003:** Faturas de período < 25 dias são normalizadas a 30 dias na projeção retroativa, mas mantidas em valores reais na coluna "observado".
- **DEC-004:** Detector Tese 6 retorna `null` quando concessionária já aplica ICMS negativo na injeção (caso ELFSM-style) — não há indébito a apurar.
- **DEC-005:** Mockup Tela 4 mantém referência "GDIII (compensação SCEE)" como rótulo de UC, mas remove narrativa "transição GDIII em mar/2026" e adiciona banner de correção.

## Pendências abertas pra próxima sessão

1. **Integrar Tese 6 no `concierge.service.ts`** (orquestrador) pra que apareça automaticamente
2. **Implementar mapa de risco por UF** no detector (input adicional)
3. **Pedir Luciano puxar MAR/2025 e MAI/2025** do portal EDP-ES → série 14 → 16 meses
4. **Recalcular outros 3 casos do mockup com Tese 6**: Laurentino, Christiane, Sinergia (Sinergia provavelmente terá Tese 6 também por ser A4 com SCEE)
5. **Validar com advogado parceiro**: TJ-ES tem precedente Tese 6? (TJ-MT abr/2026 é claro)
6. **Decidir via processual** Tese 6: MS coletivo CoopereBR contra Estado-ES vs ação ordinária EDP-ES (com dobro CDC)

## Próximo passo único e claro

**Integrar `DetectorTese6IcmsTusdTeSobreScee` no orquestrador `ConciergeService.previewDiagnostico` pra que apareça automaticamente em qualquer fatura processada pelo MVP SaaS, e adicionar campo `mapaRiscoUf` no input do detector pra refinar a classificação de risco por estado.**

## Commits da sessão

| Hash | Tipo | Marco |
|---|---|---|
| `92483e1` | docs | Fechamento da noite 11/06 (mockup 10 telas + Tese 5 + WIP parser) |
| `e85723d` | **feat** | **Tese 6 backend + dossiê EXFISHES 14 faturas + Tela 11 mockup** |

Ainda pendente commit: correção Tela 4 + este doc-sessão + atualização CONTROLE-EXECUCAO.

## Frase de retomada Cowork (próxima sessão)

```
Continuar Tese 6 — integrar DetectorTese6IcmsTusdTeSobreScee no orquestrador
ConciergeService.previewDiagnostico (Sprint C4 acelerado). Adicionar campo
mapaRiscoUf como input do detector. Recalcular Laurentino + Christiane +
Sinergia no mockup com Tese 6. Pedir Luciano puxar MAR/2025 + MAI/2025
do portal EDP-ES pra completar série.
```
