# Caso Luciano Bragatto — Auditoria Concierge EDP_ES

> Catalogado em 14/06/2026.
> Cooperado real CoopereBR. Caso-modelo Espírito Santo / EDP_ES.

## 1. Identificação

| Campo | Valor |
|---|---|
| Cooperado ID | `cmn0dsc4w005guols56peyc5h` |
| Nome | LUCIANO COSTA BRAGATTO |
| CPF | 89089324704 |
| Email | lucbragatto@gmail.com |
| Cooperativa | CoopereBR |
| Cota contratada | 796,92 kWh/mês |
| UCs vinculadas | 2 (uma EDP_ES real + uma placeholder Guarapari) |

## 2. UC analisada

| Campo | Valor |
|---|---|
| Numero canônico | 0400702214 (10 dígitos) |
| numeroUC legado | 160085263 (9 dígitos) |
| numeroConcessionariaOriginal | 0.001.421.380.054-70 |
| Distribuidora | EDP_ES |
| Endereço | Rua Joaquim Lírio 366 AP 501 Ed Jazz Residence |
| Bairro / Cidade / UF | Praia do Canto / Vitória / ES |
| CEP | 29055-460 |
| Classe / Subclasse | B1-Residencial / Trifásico |
| Tensão | 220/127V |
| Modalidade | Convencional |

## 3. Fatura auditada (02/2026)

| Campo | Valor |
|---|---:|
| Mês referência | 02/2026 |
| Vencimento | 11/03/2026 |
| Consumo | 1.139 kWh |
| Leitura ant / atual | 28.124 / 29.263 |
| Bandeira | Verde (R$ 0) |
| TUSD | R$ 0,60756804/kWh |
| TE | R$ 0,41575066/kWh |
| ICMS valor | R$ 102,34 |
| ICMS alíquota | 17% |
| PIS+COFINS valor | R$ 68,40 |
| PIS+COFINS alíq efetiva | 7,07% |
| CIP municipal | R$ 29,51 |
| Desconto cooperativa | R$ 631,77 |
| **TOTAL A PAGAR** | **R$ 194,25** |

## 4. Compensação SCEE

| Campo | Valor |
|---|---:|
| `possuiCompensacao` | ✅ true |
| Créditos recebidos no mês | 1.883,946 kWh |
| Saldo total acumulado | 4.597,725 kWh |
| Participação no saldo coletivo | 15% |
| Cobertura consumo / créditos | 60,4% |

## 5. Análise tributária (6 teses)

### 5.1 ✅ Tema 69 STF — **INDÉBITO DETECTADO**

```
Base ICMS inferida: R$ 102,34 / 17% = R$ 602
Base PIS/COFINS inferida: R$ 68,40 / 7,07% = R$ 967

Se Tema 69 aplicado: base PIS/COFINS = R$ 602 - R$ 102 = R$ 500
Diferença cobrada a mais: R$ 967 - R$ 500 = R$ 467
Indébito PIS/COFINS: R$ 467 × 9,25% ≈ R$ 43/mês
```

### 5.2 ✅ Tese 3 (PIS/COFINS sobre SCEE) — **INDÉBITO PROVÁVEL**

```
EDP_ES cobra PIS/COFINS sobre Fio B (60% TUSD em 2026) da energia compensada
1.139 kWh × Fio B (60% × R$ 0,60756804) × 9,25%
≈ 1.139 × 0,3645 × 0,0925 ≈ R$ 38/mês
```

### 5.3 ✅ Tese 6 (ICMS sobre TUSD/TE em SCEE) — **INDÉBITO DETECTADO**

```
ICMS 17% sobre Fio B da energia compensada
1.139 kWh × R$ 0,3645 (Fio B 60% TUSD) × 17%
≈ R$ 70/mês
```

### 5.4 ❌ Tese 2 (ICMS TUSD-G) — N/A
Grupo B não tem TUSD-G nem demanda contratada.

### 5.5 ❌ Tema 176 STF (Demanda Contratada) — N/A
Grupo B não tem demanda.

### 5.6 ❌ Tese 4 (GERAR rubricas excluídas) — N/A
Grupo B sem DRE/ERE.

## 6. Resumo indébito

| Tese | Mensal | 60 meses × SELIC 1,25 |
|---|---:|---:|
| Tema 69 (ICMS na base PIS/COFINS) | ~R$ 43 | ~R$ 3.240 |
| Tese 3 (PIS/COFINS sobre SCEE) | ~R$ 38 | ~R$ 2.850 |
| **Tese 6 (ICMS sobre TUSD/TE SCEE)** | **~R$ 70** | **~R$ 5.250** |
| **TOTAL** | **~R$ 151/mês** | **~R$ 11.340** |

## 7. Disclaimers

- Cálculos baseados em **inferências sobre bases agregadas** do OCR atual
- Pra valor exato: re-OCR com prompt detalhado extraindo rubricas linha-a-linha
- Tese 6 assume que EDP_ES cobra Fio B integralmente sobre energia compensada
- Não considera honorários (15-20% típicos) nem deságio por compensação
- **Margem de erro estimada: ±30%**

## 8. Achados não-tributários

### 8.1 ⚠️ Cota cadastrada subestimada
- Cota: 796,92 kWh/mês
- Consumo médio (12m): ~865 kWh
- Consumo Fev/26: 1.139 kWh
- **Revisar cota contratada — está 30% abaixo do real**

### 8.2 🎉 SCEE gerou economia massiva
Histórico de R$ pagos:

| Período | Faixa R$ | Característica |
|---|---:|---|
| Fev/25 - Mai/25 | R$ 600 - 980 | Sem SCEE / cobertura mínima |
| Jun/25 - Out/25 | R$ 240 - 700 | Transição |
| Nov/25 - Fev/26 | R$ 165 - 242 | SCEE ativo |

**Economia média estimada após adesão ao Clube: ~R$ 750/mês = ~R$ 9.000/ano**

### 8.3 🚨 UC fantasma "PENDENTE-GUARAPARI"
UC com `numero = PENDENTE-GUARAPARI` em Guarapari, sem fatura processada. Pendência cadastral.

## 9. Valor total ao Luciano (10 anos)

```
Economia SCEE / Clube: R$ 9.000/ano × 10 = R$ 90.000
Indébito Concierge (60m + SELIC): R$ 11.340
─────────────────────────────────────────────
TOTAL ESTIMADO: ~R$ 100.000 em 10 anos
```

## 10. Próximos passos pra o caso Luciano

1. ✅ Análise tributária preliminar (este documento)
2. ⏳ Re-OCR detalhado da fatura pra valor exato (~R$ 0,30 + 5min)
3. ⏳ Buscar e processar faturas históricas (últimos 60 meses) pra dossiê de prescrição
4. ⏳ Encaminhar a parecer jurídico parceiro (próximo passo Concierge)
5. ⏳ Resolver pendência cadastral UC Guarapari
6. ⏳ Atualizar cota Cooperado pra 1.000 kWh/mês (conforme consumo real)
