# FÓRMULAS DE COBRANÇA — CoopereBR
> Fonte única de verdade para cálculo de cobrança por modelo.
> Decisões fechadas com Luciano em 18/04/2026.
> Este documento vale MAIS que qualquer código divergente que o Claude Code encontrar.

---

## VOCABULÁRIO EDP (crítico)

- **`energiaCompensada`** e **`energiaInjetada`** são o **mesmo valor** na fatura EDP, só muda o quadro onde aparece:
  - No detalhamento de consumo: aparece com sinal negativo (abate)
  - No quadro de mini/micro geração: aparece como entrada positiva
- Código padroniza em `energiaCompensada`. Em comentário inline mencionar que é equivalente a "energia injetada".

- **`consumoBruto`**: consumo total registrado na fatura ANTES da compensação pelos créditos. É o denominador do cálculo do DINAMICO.

- **`valorTotalFatura`**: valor total da fatura da concessionária, já com TUSD + TE + Fio B + bandeira + ICMS + PIS/COFINS + CIP. É o "kWh cheio" do mês.

---

## REGRA UNIVERSAL

**Nenhum acréscimo é aplicado automaticamente pelo sistema.** Bandeira, consumo mínimo e Fio B nunca entram como dedução/soma automática na cobrança mensal. Ou são decisão explícita do admin, ou já estão embutidos em tarifa/valor contratual.

---

## MODELO: FIXO_MENSAL

**Fórmula:**
```
valorCobranca = contrato.valorContrato
                + (bandeira SE admin aplicou explicitamente)
```

**Regras:**
- Usa `contrato.valorContrato` (valor fixo negociado no início). Campo **deve** existir no schema (dívida técnica: não existe hoje).
- **NÃO** aplica `plano.descontoBase` — desconto já embutido no valorContrato.
- **NÃO** deduz consumo mínimo na cobrança mensal.
- **NÃO** soma Fio B — já embutido no valorContrato.
- **Bandeira:** decisão do admin via cascata híbrida (ver seção Bandeira abaixo).

**Exemplo:**
- Contrato: `valorContrato = R$ 250,00/mês`
- Mês com bandeira amarela: R$ 1,50 / 100 kWh (500 kWh consumidos)
- Admin marcou "aplicar bandeira" na cooperativa
- Cobrança = 250 + (500/100 × 1,50) = R$ 257,50

---

## MODELO: CREDITOS_COMPENSADOS

**Fórmula:**
```
valorCobranca = energiaCompensada × contrato.tarifaContratual
                + (bandeira SE admin aplicou explicitamente)
```

**Regras:**
- `energiaCompensada` vem da `FaturaProcessada` vinculada (`Cobranca.faturaProcessadaId` obrigatório).
- `contrato.tarifaContratual` = tarifa negociada no início do contrato, com desconto e bandeira histórica média JÁ embutidos. Campo **deve** existir no schema (dívida técnica: não existe hoje).
- Reajustes anuais (e eventualmente por bandeira) acontecem em `contrato.tarifaContratual`, não na cobrança individual.
- **NÃO** aplica `plano.descontoBase` — já embutido na tarifa contratual.
- **NÃO** deduz consumo mínimo — EDP já excluiu o mínimo da compensação (os kWh do mínimo ficam no saldo de energia injetada do cooperado).
- **NÃO** soma Fio B — já embutido na tarifa contratual.
- **Bandeira:** decisão do admin via cascata híbrida.

**Exemplo:**
- Fatura do cooperado (trifásico): consumo 500 kWh, compensado 450 kWh (EDP excluiu 100 do mínimo, mas gerou 450 = sobra fica em saldo)
- Contrato: `tarifaContratual = R$ 0,65/kWh`
- Sem bandeira aplicada
- Cobrança = 450 × 0,65 = R$ 292,50

**Sobre Fio B pós-Lei 14.300/2022:**
- Usinas com `dataHomologacao >= 2023-01-07` entram no cronograma progressivo (2026 = 60%)
- O cenário Fio B é projetado na negociação da `tarifaContratual` ao longo da vigência do contrato — não vira cálculo mensal.
- Pré-requisito pra implementação futura: `Usina.dataHomologacao` obrigatório.

---

## MODELO: CREDITOS_DINAMICO

**Fórmula:**
```
tarifaApurada = valorTotalFatura / consumoBruto
valorCobranca = energiaCompensada × tarifaApurada × (1 − plano.descontoBase)
```

**Regras:**
- Todos os dados vêm da `FaturaProcessada` vinculada (`Cobranca.faturaProcessadaId` **obrigatório**).
- `plano.descontoBase` aplicado UMA ÚNICA VEZ, no final, como multiplicador.
- **NÃO** deduz consumo mínimo — EDP já excluiu o mínimo da compensação.
- **NÃO** soma bandeira — já embutida em `valorTotalFatura`, portanto já dentro da `tarifaApurada`. Aplicar bandeira aqui é DUPLA CONTAGEM — proibido.
- **NÃO** soma Fio B — idem, já embutido em `valorTotalFatura`.
- A cascata híbrida de bandeira **ignora este modelo**, mesmo se configurado como "aplicar".

**Campos de auditabilidade — obrigatórios em `Cobranca` para DINAMICO:**
- `cobranca.valorTotalFatura: Decimal` — numerador da tarifa apurada
- `cobranca.consumoBruto: Float` — denominador
- `cobranca.tarifaApurada: Decimal` — derivada, persistida para reconciliação
- `cobranca.energiaCompensada: Float`
- `cobranca.descontoAplicado: Decimal` — `plano.descontoBase` no momento da cobrança

Sem esses campos persistidos, a cobrança não pode ser auditada depois. Dívida técnica: nenhum deles existe no schema atual.

**Exemplo:**
- Fatura: `valorTotalFatura = R$ 380,00`, `consumoBruto = 500 kWh`, `energiaCompensada = 450 kWh`
- Plano com `descontoBase = 20%` (ou seja, 0.20)
- `tarifaApurada = 380 / 500 = R$ 0,76/kWh`
- Cobrança = 450 × 0,76 × (1 − 0,20) = R$ 273,60

---

## CONSUMO MÍNIMO FATURÁVEL — papel correto

**O consumo mínimo entra APENAS no motor de proposta, no dimensionamento inicial do contrato.**

```
kwhContratoMensal = mediaConsumoMensalHistorica − consumoMinimoTipoFornecimento
```

Valores default (configuráveis por cooperativa):
- Monofásico: 30 kWh
- Bifásico: 50 kWh
- Trifásico: 100 kWh

**Por quê:** EDP cobra o mínimo do cooperado independentemente de quantos créditos ele tenha. Alocar crédito que a EDP não vai compensar é desperdício de capacidade de usina e ilusão de economia. O cooperado deve receber só o kWh que efetivamente vai reduzir fatura dele.

**O que o Sprint 4 fez errado:**
- Implementou dedução de consumo mínimo na **cobrança mensal** (em `cobrancas.service.calcularCobrancaMensal`). Essa lógica não existe no fluxo real e precisa ser removida.
- A engine que efetivamente roda (`faturas.service.gerarCobrancaPosFatura`) não aplica mínimo — coincidentemente correto.

---

## BANDEIRA TARIFÁRIA — cascata híbrida

**Política por cooperativa (default):**
```
Cooperativa.politicaBandeira: APLICAR | NAO_APLICAR | DECIDIR_MENSAL
```

**Override por usina (parceiros com usinas em contextos diferentes):**
```
Usina.politicaBandeira: HERDAR | APLICAR | NAO_APLICAR | DECIDIR_MENSAL
```

**Override pontual por cobrança (ajuste de última hora antes de envio):**
```
Cobranca.bandeiraAplicada: Boolean?
```

**Resolução:**
```
bandeiraAplicada = cobranca.bandeiraAplicada
                   ?? (usina.politicaBandeira resolvida)
                   ?? cooperativa.politicaBandeira
                   
DECIDIR_MENSAL: exige input explícito do admin no mês, senão NAO_APLICAR por segurança.
```

**Exceção absoluta:** no modelo `CREDITOS_DINAMICO`, bandeira **nunca** é aplicada, mesmo que toda a cascata diga "aplicar". É dupla contagem garantida porque bandeira já entra em `valorTotalFatura`.

**Schema atual (Sprint 4) é insuficiente:**
- Tem `Cooperativa.bandeiraAtiva: Boolean` (toggle global) — precisa virar enum de política
- Não tem override por usina
- Não tem override por cobrança
- Redesign é parte do Sprint 5

---

## TABELA RESUMO

| Campo / Operação | FIXO_MENSAL | CREDITOS_COMPENSADOS | CREDITOS_DINAMICO |
|---|---|---|---|
| Base de cálculo | `valorContrato` | `energiaCompensada × tarifaContratual` | `energiaCompensada × tarifaApurada` |
| `plano.descontoBase` aplicado? | **Não** (embutido) | **Não** (embutido) | **Sim**, no final |
| Consumo mínimo deduzido? | **Não** | **Não** | **Não** |
| Bandeira somada automaticamente? | Só se admin aplicou | Só se admin aplicou | **Nunca** (já embutida) |
| Fio B somado? | **Não** (embutido) | **Não** (embutido) | **Não** (já embutido) |
| `faturaProcessadaId` obrigatório? | Não (mas recomendado) | **Sim** | **Sim** |
| `geracaoMensalId` obrigatório? | Não | Não | Só se usar projeção pra validar |
| Campos auditoria persistidos? | `valorContrato` aplicado | `tarifaContratual` aplicada | `valorTotalFatura`, `consumoBruto`, `tarifaApurada`, `descontoAplicado` |

---

## ESTADO DAS DUAS ENGINES (diagnóstico 18/04/2026)

- **`cobrancas.service.calcularCobrancaMensal`** — engine ÓRFÃ. Nunca é chamada. Contém lógica do Sprint 4 (cascata desconto, bandeira auto, consumo mínimo deduzido). Decisão: **eliminar** no Sprint 5.

- **`faturas.service.gerarCobrancaPosFatura`** — engine VIVA. Chamada ao aprovar FaturaProcessada. Aplica `contrato.percentualDesconto` em todos os modelos (bug: deveria aplicar só em DINAMICO). Não persiste `geracaoMensalId`. Matching de FaturaProcessada por `(cooperadoId, mesReferencia)` sem `ucId` — risco em cooperado multi-UC. Decisão: **refatorar** no Sprint 5 pra ramificar por modelo.

---

## REFERÊNCIA DE AUDITORIA (cada cobrança gerada)

Pra toda Cobranca criada, estes campos devem estar populados para garantir reconciliação futura:

**Universais:**
- `contratoId`
- `faturaProcessadaId` (se modelo != FIXO_MENSAL)
- `mesReferencia`, `anoReferencia`
- `modeloCobrancaUsado` (snapshot do modelo no momento do cálculo — proteção contra mudança de plano depois)
- `valorLiquido`, `valorBruto`, `valorDesconto`

**Específicos DINAMICO:**
- `valorTotalFatura`, `consumoBruto`, `tarifaApurada`, `energiaCompensada`, `descontoAplicado`

**Específicos COMPENSADOS:**
- `energiaCompensada`, `tarifaContratualAplicada` (snapshot — contrato pode ter reajuste depois)

**Bandeira (em qualquer modelo onde aplicou):**
- `bandeiraAplicada: true`, `tipoBandeira`, `valorPor100Kwh`, `kwhUsadoBase`, `valorBandeira`

---

## DÍVIDA TÉCNICA DE SCHEMA (pré-requisito do Sprint 5)

Campos faltantes que precisam entrar via migration:

- `Contrato.valorContrato: Decimal?` (FIXO_MENSAL)
- `Contrato.tarifaContratual: Decimal?` (COMPENSADOS)
- `Contrato.dataUltimoReajusteTarifa: DateTime?` + histórico
- `Cobranca.valorTotalFatura: Decimal?` (DINAMICO auditoria)
- `Cobranca.consumoBruto: Float?` (DINAMICO auditoria)
- `Cobranca.tarifaApurada: Decimal?` (DINAMICO auditoria)
- `Cobranca.tarifaContratualAplicada: Decimal?` (COMPENSADOS snapshot)
- `Cobranca.modeloCobrancaUsado: enum` (snapshot do modelo)
- `Cobranca.bandeiraAplicada: Boolean?` (override pontual)
- `Cooperativa.politicaBandeira: enum` (substitui `bandeiraAtiva` boolean)
- `Usina.politicaBandeira: enum` (novo)
- `Usina.dataHomologacao: DateTime?` (pré-requisito Fio B futuro)

---

_Última revisão: 18/04/2026. Atualizar ao final do Sprint 5._
