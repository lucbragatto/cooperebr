# Teste OCR faturas Hangar + validação fixtures (24/04/2026)

## Resultado OCR

### edp-hangar-loja1.pdf
| Campo | Valor extraído | Esperado | Status |
|---|---|---|---|
| Titular | ACADEMIA DE GINASTICA HANGAR LTDA | ✓ | OK |
| CNPJ | 36324580000110 | ✓ | OK |
| UC | 0000051282805491 | 0.000.512.828.054-91 normalizado | OK |
| Consumo | 12191 kWh | ✓ | OK |
| Total | R$ 654,75 | ✓ | OK |
| Distribuidora | EDP ES DISTRIB DE ENERGIA SA | ✓ | OK |
| Classificação | B3-COMERCIAL | ✓ | OK |
| Mês referência | 2026-01 | ✓ normalizado | OK |
| Compensação | true (GD ativa) | ✓ | OK |
| Créditos | 11490.998 kWh | ✓ | OK |
| Histórico | 12 meses | ✓ | OK |

### edp-hangar-loja2.pdf
| Campo | Valor extraído | Esperado | Status |
|---|---|---|---|
| Titular | ACADEMIA DE GINASTICA HANGAR LTDA | ✓ | OK |
| CNPJ | 36324580000110 | ✓ | OK |
| UC | 000051282905487 | 0.000.512.829.054-87 normalizado | OK |
| Consumo | 9005 kWh | ✓ | OK |
| Total | R$ 517,99 | ✓ | OK |
| Mês referência | 2026-01 | ✓ | OK |
| Compensação | true | ✓ | OK |
| Créditos | 8787 kWh | ✓ | OK |
| Histórico | 12 meses | ✓ | OK |

## Status: OCR_FUNCIONAL

Ambas as faturas extraídas com 100% de precisão nos campos críticos.
Normalização de UC e mesReferencia funcionando (Sprint 6 Tickets 6-8).

## Nota sobre créditos EDP
Hangar já tem GD ativa com EDP (creditosRecebidosKwh > 0). Para fins
do CoopereBR, IGNORAR créditos existentes e usar consumoBruto como
base de dimensionamento. Desconto CoopereBR se aplica sobre o consumo
total, como se o cooperado entrasse do zero.
