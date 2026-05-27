# Auditoria Classe GD — 2026-05-27

> Script: `backend/scripts/auditoria-classe-gd.ts` (READ-ONLY).
> Sub-Sprint F.7a (M35) — D-novo-BA.

## Critério de sugestão (REN ANEEL 1.000/2021)

| Faixa potenciaKwp | Classe sugerida |
|---|---|
| ≤ 75 kW | GD_I (microgeração) |
| 75 < kWp ≤ 1.000 | GD_II (minigeração I) |
| 1.000 < kWp ≤ 5.000 | GD_III (minigeração II) |
| > 5.000 | FORA_SCEE — verificar |

## Resumo

- ✅ OK: **0**
- 📋 PENDENTE: **7**
- ⚠️ DIVERGÊNCIA: **3**
- 🚫 FORA_SCEE: **0**
- **Total:** 10 usinas

## Detalhamento por usina

| # | Cooperativa | Apelido | Nome | kWp | kWh/mês | Atual | Sugestão | Status |
|---|-------------|---------|------|----:|--------:|-------|----------|--------|
| 1 | CoopereBR | cooperebr2 | COOPERE - BR Usina 2 Linhares | 1370 | 167000 | GD_II | GD_III | DIVERGÊNCIA |
| 2 | CoopereBR | cooperebr1 | COOPERE BR - Usina Linhares | 1250 | 150000 | GD_I | GD_III | DIVERGÊNCIA |
| 3 | CoopereBR | — | Usina Solar Guarapari | 250 | 37500 | — | GD_II | PENDENTE |
| 4 | CoopereBR | — | Usina Solar Norte | 1250 | 150000 | GD_II | GD_III | DIVERGÊNCIA |
| 5 | CoopereBR | — | Usina Solar Palmeiras | 100 | — | — | GD_II | PENDENTE |
| 6 | CoopereBR | — | Usina Solar Serra | 180 | 27000 | — | GD_II | PENDENTE |
| 7 | CoopereBR | — | Usina Solar Sul | 1350 | 165000 | — | GD_III | PENDENTE |
| 8 | CoopereBR Teste | — | Solar Guarapari | 500 | 50000 | — | GD_II | PENDENTE |
| 9 | CoopereBR Teste | — | Solar Serra | 400 | 40000 | — | GD_II | PENDENTE |
| 10 | TESTE-FASE-B5 — Validação Engines | — | TESTE-USINA-B5 | 100 | 12000 | — | GD_II | PENDENTE |

## Próximos passos

1. **Luciano revisar tabela acima**: confirmar cada `PENDENTE` + decidir se aceita sugestão automática OU manual
2. **DIVERGÊNCIA**: caso a caso — pode ser intencional (ex: GD_I tributário em usina >75kW). Documentar decisão.
3. **D-novo-BG (cooperebr1 Linhares GD_I com 1.250 kWp)**: confirmado intencional (28/05) — não corrigir, decidir antes de implementar Fio B.
4. **Quando planilha definitiva pronta**: rodar `npx ts-node backend/scripts/corrigir-classe-gd.ts <planilha.csv>` (script futuro, dry-run primeiro).
