# Teste OCR com fatura real do Luciano (UID 2032)

**Fatura de referência:**
- Email UID: 2032
- Filename: ESCEFATELBT07_0160085263_0000000581A.pdf
- Tamanho: 1355KB
- Data email: 2025-08-31

## Dados extraídos pelo OCR

| Campo | Valor |
|---|---|
| Titular | LUCIANO COSTA BRAGATTO |
| Documento | 89089324704 (CPF) |
| Endereço | RUA JOAQUIM LIRIO 366 AP 501 ED JAZZ RESIDENCE |
| Cidade/Estado | VITORIA / ES |
| UC (canônica) | 0160085263 |
| Distribuidora | EDP ES DISTRIB DE ENERGIA SA |
| Classificação | B1-RESIDENCIAL |
| Modalidade | CONVENCIONAL |
| Mês referência | 2025-08 |
| Vencimento | 11/09/2025 |
| Valor total EDP | R$ - |
| Consumo atual | 570 kWh |
| Leitura ant/atual | 23590 / 24160 |
| Tarifa TUSD | R$ 0.56792982 |
| Tarifa TE | R$ 0.40294737 |
| Bandeira | VERMELHA_2 |
| ICMS (%) | 17 |
| ICMS (R$) | 103.44 |
| Possui compensação | false |
| Créditos recebidos | 0 kWh |
| Saldo total | 0 kWh |
| Valor sem desconto | R$ 627.74 |
| Valor compensado | R$ 0 |

## Simulação dos 3 modelos de cobrança

| Modelo | Parâmetro | Valor cooperado | Economia vs EDP sem GD |
|---|---|---|---|
| FIXO_MENSAL | R$ 500 fixo | R$ 500.00 | R$ 127.74 |
| CREDITOS_COMPENSADOS | R$ 0,80/kWh × créditos compensados | R$ 0.00 | R$ 627.74 |
| CREDITOS_DINAMICO | 20% off × 0 kWh × R$ 0.7767/kWh | R$ 0.00 | R$ 627.74 |

**Referência de cálculos:**
- kWh consumido: 570
- kWh compensado (créditos): 0
- Valor sem desconto (EDP sem GD): R$ 627.74
- Valor faturado real pelo EDP: R$ 0
- Tarifa cheia (TUSD+TE): R$ 0.9708771900000001

## Conclusões

- **OCR funcional:** SIM — 48 campos extraídos
- **Estrutura de dados compatível:** PARCIAL
- **Tem créditos compensados:** NÃO — cenário B1 (cooperado sem homologação ativa)
- **Pronto pra Sprint 14 (engines COMPENSADOS/DINAMICO):** precisa fatura COM créditos pra teste completo

## JSON bruto retornado pelo OCR

```json
{
  "titular": "LUCIANO COSTA BRAGATTO",
  "documento": "89089324704",
  "tipoDocumento": "CPF",
  "enderecoInstalacao": "RUA JOAQUIM LIRIO 366 AP 501 ED JAZZ RESIDENCE",
  "bairro": "PRAIA DO CANTO",
  "cidade": "VITORIA",
  "estado": "ES",
  "cep": "29055460",
  "numeroUC": "0160085263",
  "codigoMedidor": "0012792654",
  "distribuidora": "EDP ES DISTRIB DE ENERGIA SA",
  "classificacao": "B1-RESIDENCIAL",
  "modalidadeTarifaria": "CONVENCIONAL",
  "tensaoNominal": "220/127V",
  "tipoFornecimento": "TRIFASICO",
  "mesReferencia": "2025-08",
  "vencimento": "11/09/2025",
  "totalAPagar": 627.74,
  "consumoAtualKwh": 570,
  "leituraAnterior": 23590,
  "leituraAtual": 24160,
  "tarifaTUSD": 0.56792982,
  "tarifaTE": 0.40294737,
  "tarifaTUSDSemICMS": 0.44391774,
  "tarifaTESemICMS": 0.31495484,
  "bandeiraTarifaria": "VERMELHA_2",
  "valorBandeira": 0.10076943,
  "contribIluminacaoPublica": 28.31,
  "icmsPercentual": 17,
  "icmsValor": 103.44,
  "pisCofinsPercentual": 5.83,
  "pisCofinsValor": 29.43,
  "multaJuros": 0,
  "descontos": 9,
  "outrosEncargos": 0,
  "possuiCompensacao": false,
  "creditosRecebidosKwh": 0,
  "saldoTotalKwh": 0,
  "participacaoSaldo": 0,
  "energiaInjetadaKwh": 0,
  "energiaFornecidaKwh": 570,
  "valorCompensadoReais": 0,
  "temCreditosInjetados": false,
  "saldoKwhAnterior": 0,
  "saldoKwhAtual": 0,
  "validadeCreditos": "",
  "valorSemDesconto": 627.74,
  "historicoConsumo": [
    {
      "mesAno": "07/2025",
      "consumoKwh": 541,
      "valorRS": 520.57
    },
    {
      "mesAno": "06/2025",
      "consumoKwh": 570,
      "valorRS": 544.56
    },
    {
      "mesAno": "05/2025",
      "consumoKwh": 666,
      "valorRS": 613.83
    },
    {
      "mesAno": "04/2025",
      "consumoKwh": 1011,
      "valorRS": 886.35
    },
    {
      "mesAno": "03/2025",
      "consumoKwh": 1123,
      "valorRS": 976.78
    },
    {
      "mesAno": "02/2025",
      "consumoKwh": 1118,
      "valorRS": 958.85
    },
    {
      "mesAno": "01/2025",
      "consumoKwh": 957,
      "valorRS": 160.93
    },
    {
      "mesAno": "12/2024",
      "consumoKwh": 1054,
      "valorRS": 146.39
    },
    {
      "mesAno": "11/2024",
      "consumoKwh": 767,
      "valorRS": 133.55
    },
    {
      "mesAno": "10/2024",
      "consumoKwh": 852,
      "valorRS": 157.65
    },
    {
      "mesAno": "09/2024",
      "consumoKwh": 767,
      "valorRS": 152.44
    },
    {
      "mesAno": "08/2024",
      "consumoKwh": 811,
      "valorRS": 135.35
    }
  ]
}
```
