# Sprint 11 Fase D — E2E pipeline OCR com fatura real do Luciano

**Data:** 26/04/2026, 12:27:33
**Resultado:** ✅ PASSOU

## Resumo executivo

- PDF: 2139 KB (`backend/test/fixtures/faturas/edp-luciano-gd.pdf`)
- OCR Claude: 20067ms — 50 campos extraídos
- Match resolverUcPorNumero: 196ms

## Validações

| # | Item | Status | Detalhe |
|---|---|---|---|
| 1 | distribuidora normalizada via coerceDistribuidora | ✅ | OCR=EDP_ES → enum=EDP_ES |
| 2 | Pelo menos 1 dos 3 campos de número preenchido | ✅ | numero=false numeroUC=false numeroConcOrig=true |
| 3 | numeroConcessionariaOriginal preserva pontuação | ✅ | valor="0.001.421.380.054-70" |
| 4 | resolverUcPorNumero encontra UC com pelo menos um candidato | ✅ | match em: numeroConcessionariaOriginal |
| 5 | Match aponta pra UC correta do Luciano | ✅ | UC cmn0dsc83005iuolsxtufdx7v confirmada |

## UC esperada (Luciano)

- id: `cmn0dsc83005iuolsxtufdx7v`
- numero: `0400702214`
- numeroUC: `160085263`
- numeroConcessionariaOriginal: `0.001.421.380.054-70`
- cooperativaId: `cmn0ho8bx0000uox8wu96u6fd`

## Match em qual campo

| Origem | Encontrada |
|---|---|
| numero | (sem match) |
| numeroUC | (sem match) |
| numeroConcessionariaOriginal | cmn0dsc83005iuolsxtufdx7v |

## Dados extraídos pelo OCR (4 campos críticos)

```json
{
  "distribuidora": "EDP_ES",
  "numero": "",
  "numeroUC": "",
  "numeroConcessionariaOriginal": "0.001.421.380.054-70"
}
```

## JSON completo

<details><summary>Clique para ver os 50 campos</summary>

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
  "numero": "",
  "numeroUC": "",
  "numeroConcessionariaOriginal": "0.001.421.380.054-70",
  "codigoMedidor": "12792654",
  "distribuidora": "EDP_ES",
  "classificacao": "B1-RESIDENCIAL",
  "modalidadeTarifaria": "CONVENCIONAL",
  "tensaoNominal": "220 / 127 V",
  "tipoFornecimento": "TRIFASICO",
  "mesReferencia": "2026-03",
  "vencimento": "14/04/2026",
  "totalAPagar": 184.46,
  "consumoAtualKwh": 1088,
  "leituraAnterior": 29263,
  "leituraAtual": 30351,
  "tarifaTUSD": 0.60321691,
  "tarifaTE": 0.41278493,
  "tarifaTUSDSemICMS": 0.46863,
  "tarifaTESemICMS": 0.32068,
  "bandeiraTarifaria": "VERDE",
  "valorBandeira": 0,
  "contribIluminacaoPublica": 29.51,
  "icmsPercentual": 17,
  "icmsValor": 58.72,
  "pisCofinsPercentual": 6.4,
  "pisCofinsValor": 58.72,
  "multaJuros": 0,
  "descontos": 0,
  "outrosEncargos": 0,
  "possuiCompensacao": true,
  "creditosRecebidosKwh": 1833,
  "saldoTotalKwh": 5442,
  "participacaoSaldo": 0.15,
  "energiaInjetadaKwh": 988,
  "energiaFornecidaKwh": 1088,
  "valorCompensadoReais": 464.15,
  "temCreditosInjetados": true,
  "saldoKwhAnterior": 0,
  "saldoKwhAtual": 5442,
  "validadeCreditos": "",
  "valorSemDesconto": 648.61,
  "historicoConsumo": [
    {
      "mesAno": "02/2026",
      "consumoKwh": 1139,
      "valorRS": 194.25
    },
    {
      "mesAno": "01/2026",
      "consumoKwh": 949,
      "valorRS": 165.39
    },
    {
      "mesAno": "12/2025",
      "consumoKwh": 1010,
      "valorRS": 169.05
    },
    {
      "mesAno": "11/2025",
      "consumoKwh": 724,
      "valorRS": 168.7
    },
    {
      "mesAno": "10/2025",
      "consumoKwh": 678,
      "valorRS": 242.06
    },
    {
      "mesAno": "09/2025",
      "consumoKwh": 603,
      "valorRS": 696.95
    },
    {
      "mesAno": "08/2025",
      "consumoKwh": 570,
      "valorRS": 627.74
    },
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
    }
  ]
}
```

</details>

## Próximos passos

- Sprint 11 Bloco 2 Fase D entregue. Fechar Sprint 11.
- Próximo: validação E2E real com fatura nova chegando via IMAP (cron diário) — produção/Sprint 12.
