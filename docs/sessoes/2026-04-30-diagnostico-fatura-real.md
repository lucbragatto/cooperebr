# Diagnóstico de fatura real — pipeline OCR + 3 modelos de cobrança
> **Data:** 30/04/2026, 12:02:49
> **Modo:** read-only. Nenhuma cobrança simulada foi persistida.
> **Origem do OCR:** `backend\test\fixtures\faturas\edp-luciano-gd-expected.json` (saída validada do pipeline E2E real).
> **PDF original:** `backend\test\fixtures\faturas\edp-luciano-gd.pdf` — 2190475 bytes.

## 1. Fatura real — identificação

- **Titular:** LUCIANO COSTA BRAGATTO
- **CPF (ofuscado):** 890***04 (Luciano)
- **UC (numeroUC):** 000142138005470
- **Distribuidora:** EDP ES DISTRIB DE ENERGIA SA
- **Mês de referência:** 2026-03
- **Vencimento:** 14/04/2026
- **Endereço:** RUA JOAQUIM LIRIO 366 AP 501 ED JAZZ RESIDENCE, PRAIA DO CANTO, VITORIA/ES
- **Classificação:** B1-RESIDENCIAL (CONVENCIONAL)

## 2. Dados de consumo e tarifas (do OCR validado)

| Campo | Valor |
|---|---|
| consumoAtualKwh | 1088 kWh |
| energiaInjetadaKwh | 988 kWh |
| energiaFornecidaKwh | 1088 kWh |
| creditosRecebidosKwh (compensado) | 1832.7441 kWh |
| saldoTotalKwh | 5442.469 kWh |
| saldoKwhAtual | 5442.469 kWh |
| participacaoSaldo | 0.15 (15%) |
| valorCompensadoReais | R$ 596.64 |
| **totalAPagar** | **R$ 184.46** |
| valorSemDesconto | R$ 781.1 |
| **tarifaTUSD (com tributos)** | R$ 0.60321691/kWh |
| **tarifaTE (com tributos)** | R$ 0.41278493/kWh |
| tarifaTUSDSemICMS | R$ 0.46863/kWh |
| tarifaTESemICMS | R$ 0.32068/kWh |
| bandeiraTarifaria | VERDE |
| contribIluminacaoPublica | R$ 29.51 |
| icmsPercentual / icmsValor | 17% / R$ 101.63 |
| pisCofinsPercentual / valor | 6.4% / R$ 58.72 |

## 3. Cooperado, UC, contrato no banco

- **Cooperado:** `cmn0dsc4w005guols56peyc5h` — LUCIANO COSTA BRAGATTO
- **Status:** ATIVO
- **Cooperativa:** CoopereBR (`cmn0ho8bx0000uox8wu96u6fd`, tipo COOPERATIVA)
- **UCs cadastradas:** 2
  - id=`cmod15q1v0001vai0i3ou7sm0` numero=`PENDENTE-GUARAPARI` numeroUC=`—` numeroConcOrig=`—` dist=OUTRAS
  - id=`cmn0dsc83005iuolsxtufdx7v` numero=`0400702214` numeroUC=`160085263` numeroConcOrig=`0.001.421.380.054-70` dist=EDP_ES

- **Match UC pelo numeroUC da fatura (`000142138005470` → dígitos `000142138005470`):** ✅ cmn0dsc83005iuolsxtufdx7v

### Contrato vinculado

- **id:** `cmn0dscba005kuolsec94yrq5`
- **numero:** CTR-324704
- **status:** ATIVO
- **percentualDesconto:** 20%
- **percentualUsina:** 0%
- **kwhContratoAnual / Mensal:** — / —
- **valorContrato (FIXO_MENSAL):** R$ —
- **tarifaContratual:** R$ —/kWh
- **modeloCobrancaOverride (contrato):** null
- **modeloCobrancaOverride (usina):** null
- **plano:** PLANO OURO
- **modeloCobranca (plano):** CREDITOS_COMPENSADOS
- **descontoBase (plano):** 20%

## 4. Modelo de cobrança em vigor

**CREDITOS_COMPENSADOS** (origem: modelo do plano)

> O backend (`faturas.service.ts:resolverModeloCobranca`) também consulta `ConfigTenant.modelo_cobranca_padrao` antes de cair no plano. Não está sendo lido aqui pra manter a simulação 100% local sem hits no banco extras.

## 5. Simulação dos 3 modelos (sem persistir)

> **Parâmetros usados na simulação:**
> - desconto contratual: 20.00%
> - kwhCompensado (do OCR): 1832.7441
> - kwhConsumido (do OCR): 1088
> - valorTotal da fatura: R$ 184.46
> - tarifaTUSD com tributos: R$ 0.60321691
> - tarifaTE com tributos: R$ 0.41278493
> - tarifaTUSD líquida: R$ 0.46863
> - tarifaTE líquida: R$ 0.32068

| Modelo | Rodou? | Bruto | Desconto | Líquido (cooperado paga) | Base |
|---|---|---|---|---|---|
| FIXO_MENSAL | ❌ | — | — | — | sem valorContrato nem (kwhContratoMensal × tarifaContratual) |
| CREDITOS_COMPENSADOS | ✅ | R$ 310.72 | R$ 62.14 | **R$ 248.58** | 1832.7441 kWh × R$ 0.16954 (tarifaApuradaOCR (valorTotal/consumo)) |
| CREDITOS_DINAMICO | ✅ | R$ 1862.07 | R$ 372.41 | **R$ 1489.66** | 1832.7441 kWh × R$ 0.81280 (tarifaCheia 1.01600 × (1 − 20%)) |

## 6. Comparação — fatura EDP × cooperativa

### O que a EDP cobra hoje (fatura real)

- **Total a pagar:** R$ 184.46
- **Valor sem desconto (referência):** R$ 781.1
- **Valor compensado em reais (já abatido):** R$ 596.64
- **Crédito recebido (kWh):** 1832.7441
- **Saldo total acumulado (kWh):** 5442.469
- **Participação no saldo:** 15%

### Quanto o cooperado paga em CADA modelo

- **CREDITOS_COMPENSADOS:** EDP R$ 184.46 + cooperativa R$ 248.58 = **R$ 433.04** → economia vs sem cooperativa (R$ 781.1): R$ 348.06
- **CREDITOS_DINAMICO:** EDP R$ 184.46 + cooperativa R$ 1489.66 = **R$ 1674.12** → economia vs sem cooperativa (R$ 781.1): R$ -893.02

## 7. Cobranças no banco vinculadas a esta UC

Nenhuma cobrança vinculada à UC.

## 8. Diagnóstico em prosa

1. **Modelo em vigor hoje pra esta UC:** CREDITOS_COMPENSADOS (modelo do plano).
2. **Contrato encontrado** (`CTR-324704`, status ATIVO, desconto 20%).
3. **Cobrança real para 2026-03 encontrada?** ❌ Nenhuma.
4. **COMPENSADOS vs DINAMICO:** diferença = R$ -1241.08. DINAMICO é mais caro — tarifa EDP atual está maior que a contratual.
5. **Campos OCR críticos faltantes:** nenhum (OCR completo).
6. **Saldo de créditos da UC (declarado pela fatura):** 5442.469 kWh acumulados — equivale a ~5529.56 R$ se compensados à tarifa atual.
7. **Bandeira tarifária neste mês:** VERDE — sem cobrança adicional de bandeira (R$ 0).

### ⚠️ Inconsistências detectadas

- **Contrato `CTR-324704` está com `tarifaContratual` e `valorContrato` em branco.** Como o modelo do plano é COMPENSADOS, o backend cai no fallback `tarifaApurada = totalAPagar / consumoAtual` = 0.16954. **Isso é conceitualmente errado:** `totalAPagar` da fatura JÁ tem a compensação descontada (R$ 184 vs R$ 781 sem desconto). A tarifa apurada vira ~R$ 0.17/kWh, muito abaixo da realidade de mercado (~R$ 1.02). A cooperativa cobraria absurdamente pouco (R$ 248) por kWh que vale ~R$ 1.02.
- **`creditosRecebidosKwh = 1832.74` > `consumoAtualKwh = 1088`.** A fatura aparentemente compensa em uma janela maior que o mês corrente (saldo acumulado de 5442 kWh + injeção mensal de 988 kWh). Resolver de produto: a cobrança da cooperativa deveria ser sobre `kwhCompensado` cheio, sobre `min(kwhCompensado, consumo)`, ou sobre `min(kwhCompensado, consumoNaoIsento)`? Hoje o código usa `kwhCompensado` cheio.
- **DINAMICO com tarifa cheia e kWh compensado cheio cobraria R$ 1489**, MAIS QUE O DOBRO da fatura sem desconto (R$ 781). Sinaliza que a fórmula DINAMICO precisa multiplicar por uma fração consumida (`min(kwhCompensado, consumoAtualKwh)` ou `participacaoSaldo`) — ou que a especificação do modelo não fecha matematicamente quando o cooperado tem saldo acumulado grande.

### Implicações pro PRODUTO.md (Camada 5 — Cobrança)

- **Pipeline OCR está produzindo OCR rico:** 50+ campos, incluindo tarifas com e sem tributos, saldo acumulado, valor compensado em reais e kWh, históricos de consumo. ✅
- **Os 3 modelos podem ser calculados a partir do OCR** — basta ter `kwhCompensado`, `tarifaTUSD/TE`, `consumoAtual`, `totalAPagar`. Esses 4 campos estão na fixture.
- **CREDITOS_DINAMICO está bloqueado por código** (`NotImplementedException` em `faturas.service.ts:1882`) mas a fórmula é trivial e foi reproduzida aqui — embora o resultado bruto sugira que a fórmula está incompleta sem normalização por consumo.
- **Nenhuma cobrança no banco tem `modeloCobrancaUsado` preenchido** — confirma que `gerarCobrancaPosFatura` nunca foi exercitada em produção. As 34 cobranças existentes são manuais/seed.
- **Saldo agregado por cooperado/UC não é persistido** — só dá pra reconstruir somando snapshots `kwhCompensado` das Cobranças. Para portal mostrar "você acumulou X kWh", precisa de campo dedicado ou agregação on-demand.
- **Bug pré-existente:** mesmo com plano COMPENSADOS atribuído, o contrato CTR-324704 não tem `tarifaContratual` setada — o aceite no Motor de Proposta deveria ter feito o snapshot. Vale auditar `motorProposta.aceitar()` para confirmar se está populando os 3 snapshots (valorContrato/tarifaContratual/percentualDesconto) em todos os planos.
