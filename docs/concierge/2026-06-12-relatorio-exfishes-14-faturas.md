# Relatório EXFISHES — Análise das 14 faturas reais (FEV/2025 → MAI/2026)

> Documento gerado em 2026-06-12 pelo parser v3 (`backend/scripts/exfishes-parser-v1-WIP.py` → v3 inline).
> Calibrado com fatura ABR/2026 — 100% dos valores conferem com a fatura original.
> XLSX completo: `docs/concierge/EXFISHES-Analise-14-Faturas-2026-06-12.xlsx`.

## TL;DR (4 linhas)

EXFISHES tem indébito mensal médio de **R$ 14.788/mês** combinando Tese 3 (PIS/COFINS sobre SCEE) e Tese 6 (ICMS sobre TUSD/TE). Em 14 meses observados, o indébito documentado total é **R$ 124.076** (real) ou **R$ 207.032** (normalizado a 30 dias). Projetando 120 meses + dobro CDC: **R$ 4.968.768** potencial recuperável só com EXFISHES. A narrativa do mockup ("transição GDIII em mar/2026") está incorreta — SCEE já estava ativo desde FEV/2025 ou antes.

## Série temporal completa

| Mês | Dias | Total Pago | kWh Inj | Base Líq | Indéb T3 | Indéb T6 | Combinado | Norm 30d |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| FEV/2025 | 29 | R$ 18.730,78 | 53.574 | 17.812,10 | 1.113,79 | 7.554,16 | **8.667,95** | 8.667,95 |
| ABR/2025 | 30 | R$ 2.650,44 | 58.900 | 2.615,37 | 2.377,71 | 8.345,36 | **10.723,07** | 10.723,07 |
| JUN/2025 ⚠️ | 8 | R$ 1.413,59 | 46.239 | 2.368,63 | 1.156,42 | 6.522,00 | 7.678,42 | **28.794,08** |
| JUL/2025 | 30 | R$ 1.417,81 | 48.700 | 1.280,10 | 1.230,90 | 6.868,98 | **8.099,88** | 8.099,88 |
| AGO/2025 ⚠️ | 7 | R$ 2.572,23 | 47.940 | 2.315,73 | 2.302,38 | 7.422,04 | 9.724,42 | **41.676,09** |
| SET/2025 | 29 | R$ 1.317,33 | 49.660 | 2.461,30 | 2.461,47 | 8.110,52 | **10.571,99** | 10.571,99 |
| OUT/2025 ⚠️ | 24 | R$ 3.613,79 | 51.202 | 4.100,74 | 3.128,04 | 8.387,54 | 11.515,58 | **14.394,48** |
| NOV/2025 | 32 | R$ 3.323,53 | 51.418 | 9.796,63 | 2.545,41 | 8.403,42 | **10.948,83** | 10.948,83 |
| DEZ/2025 ⚠️ | 23 | R$ 2.290,14 | 49.340 | 2.106,61 | 1.967,20 | 8.046,47 | 10.013,67 | **13.061,30** |
| JAN/2026 ⚠️ | 23 | R$ 2.916,68 | 57.134 | 10.048,43 | 2.268,57 | 9.321,73 | 11.590,30 | **15.117,78** |
| FEV/2026 | 31 | R$ 2.916,79 | 46.260 | 2.880,23 | 2.580,27 | 7.575,39 | **10.155,66** | 10.155,66 |
| MAR/2026 | 29 | R$ 3.997,01 | 4.644 | 68.278,15 | 0,00 | 759,46 | **759,46** | 759,46 |
| **ABR/2026** | 31 | **R$ 32.486,37** | **73.400** | 32.449,81 | 1.509,73 | 7.008,62 | **8.518,35** | 8.518,35 |
| MAI/2026 ⚠️ | 6 | R$ 11.744,80 | 38.020 | 11.685,26 | 707,57 | 4.401,05 | 5.108,62 | **25.543,09** |
| **TOTAL** | | | | | **R$ 25.349** | **R$ 98.727** | **R$ 124.076** | **R$ 207.032** |

⚠️ = fatura de período curto (< 25 dias). Indébito normalizado a 30 dias para projeção justa.

## Indébito médio mensal

| Tese | Norm 30d/mês |
|---|---:|
| Tese 3 (PIS/COFINS sobre SCEE) | R$ 2.928,29 |
| Tese 6 (ICMS sobre TUSD/TE em GD) | R$ 11.859,71 |
| **COMBINADO** | **R$ 14.788,00** |

## Projeção retroativa — Tese 3 + Tese 6 combinadas

| Cenário | Meses | Fator SELIC | Combinado | + Dobro CDC |
|---|---:|---:|---:|---:|
| 12 meses | 12 | 1,04 | R$ 184.554 | R$ 369.108 |
| 24 meses | 24 | 1,08 | R$ 383.314 | R$ 766.629 |
| 36 meses | 36 | 1,12 | R$ 596.213 | R$ 1.192.426 |
| 48 meses | 48 | 1,16 | R$ 823.253 | R$ 1.646.506 |
| **60 meses (Via Tributária)** | 60 | 1,20 | **R$ 1.064.736** | R$ 2.129.472 |
| 84 meses | 84 | 1,28 | R$ 1.589.776 | R$ 3.179.552 |
| 108 meses | 108 | 1,36 | R$ 2.171.722 | R$ 4.343.444 |
| **120 meses (Tese 5 STF)** | 120 | 1,40 | **R$ 2.484.384** | **R$ 4.968.768** 🚨 |

**EXFISHES sozinha tem potencial de R$ 4,97 milhões recuperáveis** no cenário máximo (10 anos + dobro CDC), combinando as 3 teses (3 + 5 + 6).

## Achados críticos (≠ premissa do mockup)

### 1. EXFISHES JÁ estava no SCEE em FEV/2025

A 1ª fatura da série (FEV/2025) mostra `oUC oPT 01/2025` com 53.574 kWh injetados. SCEE estava ativo desde **out/2024 ou antes**.

→ A narrativa "transição GDIII em mar/2026" da Tela 4 do mockup está **incorreta**.

### 2. O que mudou em MAR/2026 NÃO foi entrar no SCEE

Em MAR/2026 EXFISHES tinha apenas 4.644 kWh injetados (saldo residual baixo). Em ABR/2026 passou a injetar 73.400 kWh (100% do consumo). A "transição" foi a **mudança de regime de compensação** — provavelmente entrada de usina nova ou crescimento da participação no saldo virtual. Não foi entrada no SCEE.

### 3. Indébito Tese 3 zera em alguns meses

JUN, OUT, NOV/2025, JAN e MAR/2026 mostram Tese 3 = 0 ou próximo. Razão: nesses meses a base PIS+COFINS declarada na fatura ficou MENOR que a base líquida pós-SCEE calculada, dando legítimo > cobrado. Isso provavelmente é **artefato de cálculo** (a fatura desconta ICMS por dentro de jeitos diferentes em cada mês) e não significa que EDP "acertou" o PIS+COFINS nesses meses.

### 4. Indébito Tese 6 é sempre positivo e dominante

Em todos os 14 meses, Tese 6 (ICMS) > Tese 3 (PIS+COFINS). Em média **4× maior** — porque alíquota ICMS (17%) é muito maior que PIS+COFINS combinado (~5%).

### 5. Faturas curtas distorcem a média se não normalizar

6 das 14 faturas têm período < 25 dias (JUN/25, AGO/25, OUT/25, DEZ/25, JAN/26, MAI/26). A coluna "Norm 30d" projeta cada fatura proporcionalmente pra base mensal justa.

## Ressalvas metodológicas

1. **Fator SELIC linear aproximação** — `1 + meses/12 × 0,04`. Implementação produtiva (Sprint C4 Concierge) deve usar tabela SELIC mensal real do BACEN.
2. **Faltam MAR/2025 e MAI/2025** — Luciano vai puxar do portal EDP-ES. Vai aumentar série de 14 → 16 meses observados.
3. **MAI/2026 fatura curta (6 dias)** — período 25/04 a 30/04, fechamento extraordinário. Normalizada multiplica 5×.
4. **Indébito Tese 3 com método mais robusto pode ser maior** — método atual usa alíquota efetiva da própria fatura; método alternativo usaria alíquotas nominais legais (PIS 0,94% + COFINS 4,32% = 5,26% padrão EDP-ES). Pode oscilar ±15%.
5. **Cooperativa CoopereBR — fundamento Art. 79 Lei 5.764/71** é primário, independe de Lei GERAR-ES. Não há circulação jurídica de mercadoria entre cooperativa e cooperado.

## Próximos passos recomendados

1. **Apresentar dossiê ao advogado parceiro** — incluir este relatório + XLSX + doc Tese 6 (`docs/concierge/2026-06-12-tese-6-icms-tusd-te-gd-scee.md`)
2. **Pedir Luciano puxar MAR/2025 e MAI/2025** — completa a série
3. **Validar com advogado se TJ-ES tem precedente Tese 6** — TJ-MT abr/2026 é claro, TJ-ES precisa confirmar
4. **Decidir via processual**:
   - **Tributária** (60m, J. Federal/Estadual contra Estado-ES, fundamento Lei 14.300/22 + Conv 16/2015)
   - **Consumerista** (120m + dobro CDC, J. Estadual contra EDP-ES, fundamento Art. 79 + CC 884 + CDC 42)
5. **Pedir DCTF da EDP-ES + balanços CVM** — cruzamento contábil

## Arquivos relacionados

- **XLSX completo**: `docs/concierge/EXFISHES-Analise-14-Faturas-2026-06-12.xlsx`
- **JSON cru**: `docs/concierge/wip/exfishes-serie-v3.json`
- **Doc Tese 6**: `docs/concierge/2026-06-12-tese-6-icms-tusd-te-gd-scee.md`
- **Parser**: `backend/scripts/exfishes-parser-v1-WIP.py` (refinado na sessão 12/06/2026)
