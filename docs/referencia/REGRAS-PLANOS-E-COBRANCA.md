# REGRAS DE PLANOS E COBRANÇA — CoopereBR

> **Fonte única de verdade** para cálculo de cobrança, configuração de planos e dimensionamento de contratos.
>
> Substitui `FORMULAS-COBRANCA.md` (desatualizado).
>
> Última revisão: 20/04/2026. Reflete o escopo A2 do Sprint 5 (UI + motor).

---

## 1. Visão do admin

Admin não deve pensar em "base de cálculo" nem "componentes tributários". Deve pensar no **produto que está oferecendo** ao cooperado. Toda terminologia técnica (`baseCalculo`, `tipoDesconto`, `referenciaValor`) mora na implementação, não na UI.

### 1.1. Qual plano admin quer oferecer?

A pergunta que a UI deve fazer ao admin na criação de um plano é: **"o que o cooperado vai ver escrito no material de captação?"** A resposta dele cai em uma de três formas:

| Promessa ao cooperado | Modelo interno |
|---|---|
| "Você paga mensalidade fixa de R$ X" | `FIXO_MENSAL` |
| "Você paga R$ X por kWh compensado" | `CREDITOS_COMPENSADOS` |
| "Você tem desconto de X% na sua fatura" | `CREDITOS_DINAMICO` |

### 1.2. A decisão crítica do plano "com desconto"

Para o terceiro modelo (desconto na fatura), admin precisa decidir **como o desconto é aplicado** — e aqui mora a diferença entre o que se anuncia e o que o cooperado efetivamente economiza:

- **Desconto aplicado sobre o total da conta** — admin honesto. Se anuncia "20% de desconto", cooperado economiza 20% efetivos.
- **Desconto aplicado sobre a parte da energia** — prática padrão do mercado GD brasileiro. Anuncia "20% de desconto", mas o cooperado economiza apenas ~13-15% efetivos porque o desconto é calculado só sobre TUSD+TE (a parcela de energia), não sobre impostos e encargos.

A escolha aqui não é técnica — é de posicionamento comercial. A UI precisa deixar essa escolha explícita e clara, com linguagem que admite a diferença sem julgar.

### 1.3. O que admin configura

Em ordem de importância:

1. **Nome e descrição do plano** (livre)
2. **Se o plano é público** (aparece na captação automática)
3. **Tipo** (Padrão ou Campanha — marca oferta temporária para destaque visual)
4. **Modelo de cobrança** (Mensalidade fixa / Por kWh compensado / Desconto dinâmico)
5. **Percentual de desconto** (e como aplicar, para o terceiro modelo)
6. **Histórico de consumo usado para dimensionar** (última fatura, média 3m ou média 12m)
7. **Promoção nos primeiros meses** (opcional — desconto maior por N meses)
8. **[Avançado]** Fator de incremento, componentes customizados
9. **[Avançado]** CooperToken

Os dois últimos blocos ficam recolhidos por padrão. Admin que não conhece, não precisa ver.

### 1.4. O que admin NÃO decide na UI

Algumas opções existem no schema mas ficam escondidas na UI v1 por serem pouco usadas ou confusas:

- **Base de cálculo "Com ICMS"** — meio-termo raro. Admin que precisar configura via API.
- **Base de cálculo "Personalizado"** — admin escolhe componentes individuais. Nenhum plano no sistema usa hoje. Complexidade sem demanda real.
- **Referência "Média 6 meses"** — redundante com 3 e 12. Removido da UI.

Esses campos permanecem no schema. Admin via API tem acesso. UI v1 esconde.

### 1.5. Princípio geral

Quem configura planos não tem que saber matemática de tarifa de energia. O sistema faz os cálculos certos; o admin toma decisões de produto:

> "Quero oferecer mensalidade fixa ou desconto? Quero ser honesto com a economia ou seguir o padrão do mercado? Quero chamariz promocional nos primeiros meses?"

A UI traduz essas decisões em configuração técnica por baixo.

---

## 2. Os três modelos de cobrança

Os três modelos de cobrança (`FIXO_MENSAL`, `CREDITOS_COMPENSADOS`, `CREDITOS_DINAMICO`) compartilham o **mesmo dimensionamento inicial** na aceitação da proposta. A diferença entre eles é **o que fica congelado** no contrato após o dimensionamento.

### 2.1. Dimensionamento inicial (idêntico nos 3 modelos)

Aplicado **uma única vez**, no momento em que a proposta é aceita e o contrato é criado:

```
kwhBase            = histórico de consumo do cooperado via referenciaValor
                     (última fatura | média 3 meses | média 12 meses)

tarifaBase         = tarifa base R$/kWh, determinada por baseCalculo
                     (ver Seção 3)

tarifaContratada   = tarifaBase × (1 − descontoBase/100)
                     [Tipo I — APLICAR_SOBRE_BASE]

                     OU

                     KWH_CHEIO − (tarifaBase × descontoBase/100)
                     [Tipo II — ABATER_DA_CHEIA]
                     (ver Seção 4)

valorMensalContrato = kwhBase × tarifaContratada
```

### 2.2. O que cada modelo congela

O que distingue os modelos é **quais valores do dimensionamento sobrevivem** como cláusula contratual, e quais são recalculados mês a mês:

| Modelo | Congela no contrato | Recalcula mensalmente |
|---|---|---|
| **FIXO_MENSAL** | `valorContrato` (valor inteiro) | **Nada.** Cobrança = `valorContrato` sempre. |
| **CREDITOS_COMPENSADOS** | `tarifaContratual` (tarifa por kWh) | **kWh compensado** da fatura do mês. Cobrança = `kwhCompensado × tarifaContratual` |
| **CREDITOS_DINAMICO** | Só `percentualDesconto` + `baseCalculo` + `tipoDesconto` | **Tarifa e kWh.** Cobrança reaplica a fórmula de dimensionamento sobre a fatura do mês atual |

### 2.3. Snapshots persistidos no Contrato

Para evitar que mudanças futuras no `Plano` afetem contratos já assinados, o contrato **armazena snapshots** dos valores dimensionados:

| Campo no Contrato | FIXO_MENSAL | CREDITOS_COMPENSADOS | CREDITOS_DINAMICO |
|---|---|---|---|
| `valorContrato` | ✅ obrigatório | — | — |
| `tarifaContratual` | — | ✅ obrigatório | — |
| `kwhContratoMensal` | ✅ | ✅ | ✅ (para alocação de usina) |
| `percentualDesconto` | ✅ | ✅ | ✅ obrigatório |
| `baseCalculo` (snapshot) | ✅ | ✅ | ✅ |
| `tipoDesconto` (snapshot) | ✅ | ✅ | ✅ |
| `descontoPromocionalAplicado` | nullable | nullable | nullable |
| `mesesPromocaoAplicados` | nullable | nullable | nullable |
| `valorContratoPromocional` | nullable (só se FIXO c/ promoção) | — | — |
| `tarifaContratualPromocional` | — | nullable (só se COMPENSADOS c/ promoção) | — |

O plano pode ser alterado depois sem afetar cobranças já estabelecidas — contratos existentes continuam aplicando seus snapshots.

### 2.4. Exemplo numérico — plano com desconto 20%, Tipo I, base KWH_CHEIO

Usando a fatura do **Condomínio Moradas da Enseada** (MAR/2026) como base histórica:

- `kwhBase` = 1.131 kWh (última fatura)
- `KWH_CHEIO` = R$ 1.235,93 / 1.131 = **R$ 1,0928/kWh**
- `tarifaContratada` = 1,0928 × 0,80 = **R$ 0,87424/kWh**
- `valorMensalContrato` = 1.131 × 0,87424 = **R$ 988,77**

O que cada modelo persiste:

- **FIXO_MENSAL**: `valorContrato = R$ 988,77`. Toda cobrança mensal = R$ 988,77, independente de consumo.
- **CREDITOS_COMPENSADOS**: `tarifaContratual = R$ 0,87424/kWh`. Se no mês seguinte compensar 900 kWh, cobrança = 900 × 0,87424 = R$ 786,82. Se compensar 1.200 kWh, cobrança = 1.049,09.
- **CREDITOS_DINAMICO**: só `percentualDesconto = 20%` + `baseCalculo = KWH_CHEIO`. A cada mês, sistema lê nova fatura, calcula novo `KWH_CHEIO_mes`, aplica 20% — cobrança varia conforme tarifa vigente e kWh compensado.

### 2.5. Comportamento do DINAMICO em detalhe

O DINAMICO é o único que **não congela tarifa**. A cada ciclo de cobrança:

```
1. Sistema lê fatura processada do mês (via OCR ou upload manual)
2. Calcula KWH_CHEIO_mes reconstruindo o "valor sem cooperativa"
   (ver Seção 6, Contexto 2)
3. Identifica kwhCompensado_mes (soma das linhas "En. At. Inj.")
4. Aplica tipoDesconto + baseCalculo conforme snapshot do contrato
5. cobrancaMensal = kwhCompensado_mes × tarifaDoMes × (1 − desc)
   ou equivalente segundo fórmula do Tipo II
```

No DINAMICO, o `kwhContratoMensal` só serve para **alocação de percentual de usina** — não entra no cálculo da cobrança mensal, que usa o `kwhCompensado` real extraído da fatura.

### 2.6. Implicações para a geração de cobrança

- **FIXO_MENSAL**: cobrança pode ser gerada sem depender de fatura processada. Basta o contrato estar `ATIVO`.
- **CREDITOS_COMPENSADOS** e **CREDITOS_DINAMICO**: cobrança exige fatura processada do mês. Sem `FaturaProcessada` (aprovada) para aquele cooperado naquela competência, não há `kwhCompensado` para calcular.

Isso afeta diretamente o fluxo email → OCR → cobrança: COMPENSADOS e DINAMICO dependem do pipeline email funcionar; FIXO é mais simples.

### 2.7. Dependências da fatura da concessionária

A fatura mensal da concessionária tem **peso diferente** em cada modelo de cobrança. Isso afeta diretamente a resiliência operacional da cooperativa:

| Modelo | Fatura da concessionária é... | Se a fatura não chega no mês |
|---|---|---|
| **FIXO_MENSAL** | **Informacional** | Cobrança é gerada normalmente pelo `valorContrato` congelado. Fatura alimenta histórico, estatísticas e auditoria ANEEL |
| **CREDITOS_COMPENSADOS** | **Operacional** | Sem fatura não há `kwhCompensado`, logo não há cobrança do mês |
| **CREDITOS_DINAMICO** | **Operacional** | Sem fatura não há `kwhCompensado` nem `KWH_CHEIO_mes`, logo não há cobrança do mês |

**Implicação prática**: cooperativa que opera só com FIXO tem tolerância a falhas no pipeline email — o faturamento segue. Cooperativa com COMPENSADOS ou DINAMICO depende criticamente do pipeline funcionar todo mês.

#### 2.7.1. Gatilhos de geração de cobrança no FIXO_MENSAL

Como o FIXO não depende da fatura, a cobrança pode ser disparada por três gatilhos diferentes, que coexistem no sistema:

1. **Cron mensal** — job automático na data configurada (ex: todo dia 1º ou `Contrato.diaVencimento − N dias`)
2. **Chegada da fatura** — quando uma fatura é processada e aprovada, se já não houver cobrança no mês, sistema gera automaticamente (aproveita o gatilho natural)
3. **Manual pelo admin** — botão "gerar cobranças do mês" na dashboard

Os três convivem sem conflito porque o gerador verifica se já existe cobrança naquela competência pro contrato antes de criar nova (evita duplicação).

#### 2.7.2. Regra transversal — admin como fallback universal

Em **qualquer situação de ambiguidade, conflito ou exceção**, o admin é o ponto de decisão final. Isso vale para:

- Fatura que não pôde ser identificada automaticamente (`statusRevisao = NAO_IDENTIFICADA`)
- Fatura com divergência grande no histórico (`statusRevisao = PENDENTE_REVISAO`)
- Cobrança gerada com valor suspeito (checagem no Asaas antes de emitir)
- Cooperado contestando valor de cobrança
- Rebalanceamento de alocação em usina
- Qualquer outro caso em que o sistema não tem certeza suficiente pra seguir sozinho

O princípio é: **sistema nunca progride em estado duvidoso.** Ou processa com certeza, ou apresenta pro admin revisar, editar, salvar e seguir.

Essa regra se aplica a todo subsistema do CoopereBR, não só ao pipeline de fatura. Documentada aqui por ser um princípio arquitetural que influencia decisões de implementação em vários módulos.

---

## 3. Base de cálculo (baseCalculo)

A `baseCalculo` determina **qual tarifa R$/kWh serve como referência** para o cálculo do desconto no plano. É a resposta à pergunta técnica: "sobre qual valor o desconto é aplicado?"

### 3.1. Os quatro valores possíveis

| Valor técnico | Rótulo UI pro admin | Fórmula |
|---|---|---|
| `KWH_CHEIO` | "Valor total da conta de luz" | `valorSemCooperativa / consumoBruto` |
| `SEM_TRIBUTO` | "Tarifa base ANEEL (TUSD + TE)" | `tarifaUnitTUSD + tarifaUnitTE` |
| `COM_ICMS` | "Tarifa + ICMS" (escondido na UI v1) | TUSD + TE + ICMS proporcional |
| `CUSTOM` | "Personalizado" (escondido na UI v1) | Soma dos componentes em `componentesCustom[]` |

**Exemplo numérico (fatura Condomínio, MAR/2026):**
- `KWH_CHEIO` = 1.235,93 / 1.131 = **R$ 1,0928/kWh**
- `SEM_TRIBUTO` = 0,46863 + 0,32068 = **R$ 0,78931/kWh**
- Diferença: R$ 0,30349/kWh — corresponde aos impostos (ICMS + PIS/COFINS) e CIP rateada

### 3.2. Quando cada valor faz sentido

**`KWH_CHEIO` — recomendado quando:**
- Admin quer ser honesto com o cooperado ("20% de desconto real")
- Plano de marketing explícito de economia plena
- Combina naturalmente com `tipoDesconto = APLICAR_SOBRE_BASE`

**`SEM_TRIBUTO` — recomendado quando:**
- Admin segue a prática padrão do mercado GD (anuncia "20% de desconto" sobre tarifa ANEEL)
- Permite margem maior pra cooperativa
- Combina naturalmente com `tipoDesconto = ABATER_DA_CHEIA`

**`COM_ICMS` — meio-termo:**
- Desconto cobre tarifa ANEEL + ICMS, mas não PIS/COFINS nem CIP
- Uso raro. Admin via API se precisar.

**`CUSTOM` — flexibilidade total:**
- Admin escolhe quais componentes tributários entram na base: `componentesCustom[]`
- Nenhum plano no sistema usa hoje. Complexidade sem demanda real.
- Mantido no schema para casos futuros, escondido na UI v1.

### 3.3. Ocultação na UI v1

A UI de criação de plano (`/dashboard/planos/novo`) em Sprint 5 expõe apenas:
- `KWH_CHEIO` (via rótulo "sobre o total da conta")
- `SEM_TRIBUTO` (via rótulo "sobre a parte da energia")

`COM_ICMS` e `CUSTOM` permanecem no schema e no DTO, mas **não aparecem** nos dropdowns. Admin que precisa desses valores configura via API/Prisma direto.

Racional: dos 9 planos no banco hoje, 100% usam `KWH_CHEIO`. Expor 4 opções quando 2 resolvem 99% dos casos só aumenta carga cognitiva do admin.

### 3.4. Interação com tipoDesconto

`baseCalculo` e `tipoDesconto` são **ortogonais** — qualquer combinação é válida:

|  | APLICAR_SOBRE_BASE | ABATER_DA_CHEIA |
|---|---|---|
| KWH_CHEIO | Desconto sobre tarifa cheia | Matematicamente igual ao anterior |
| SEM_TRIBUTO | Cobra só TUSD+TE × (1−desc) | **Padrão mercado GD** |
| COM_ICMS | Desconto sobre TUSD+TE+ICMS | Abate TUSD+TE+ICMS × desc do cheio |
| CUSTOM | Desconto sobre soma escolhida | Abate soma × desc do cheio |

A combinação operacionalmente dominante no mercado é `SEM_TRIBUTO` + `ABATER_DA_CHEIA`. Ver Seção 4 para a matemática do Tipo II.

### 3.5. Papel da baseCalculo em cada modelo de cobrança

Papel diferente conforme o modelo:

- **FIXO_MENSAL**: usado **uma vez** no dimensionamento. Depois disso, o `valorContrato` está congelado; `baseCalculo` nunca mais é lida.
- **CREDITOS_COMPENSADOS**: usado **uma vez** no dimensionamento para calcular `tarifaContratual`. Depois disso, não é lida.
- **CREDITOS_DINAMICO**: lida **todo mês** na geração da cobrança, porque a tarifa é reapurada a partir da fatura do mês.

Isso significa que alterar `baseCalculo` no plano afeta só **contratos novos** (criados depois da alteração). Contratos existentes mantêm o snapshot dimensionado no momento da aceitação.

### 3.6. Relação com a fatura da concessionária

A `baseCalculo` define quais colunas da fatura são extraídas pelo OCR:

- `KWH_CHEIO` → precisa do total da fatura ou reconstrução via linhas "Fornecida"
- `SEM_TRIBUTO` → precisa das colunas "Tarifa Unit (R$)" das linhas TUSD e TE
- `COM_ICMS` → precisa de TUSD, TE e ICMS separadamente
- `CUSTOM` → precisa de cada componente escolhido

O prompt do OCR atualmente extrai todos esses valores, independentemente do `baseCalculo` do plano. A seleção acontece no motor de cálculo. Isso permite mudar `baseCalculo` de um plano sem reprocessar faturas — os dados já estão extraídos.

---

## 4. Tipo de desconto (tipoDesconto)

`tipoDesconto` define **como o desconto é aplicado** sobre a base escolhida. É ortogonal a `baseCalculo` e afeta diretamente o valor final cobrado do cooperado.

### 4.1. Os dois valores possíveis

| Valor técnico | Rótulo UI pro admin | Fórmula |
|---|---|---|
| `APLICAR_SOBRE_BASE` | "Desconto sobre o total da conta" | `tarifaContratada = tarifaBase × (1 − desc/100)` |
| `ABATER_DA_CHEIA` | "Desconto sobre a parte da energia" | `tarifaContratada = KWH_CHEIO − (tarifaBase × desc/100)` |

### 4.2. Tipo I — APLICAR_SOBRE_BASE

**O que significa:** desconto é aplicado diretamente sobre a base do plano. Se admin escolhe `baseCalculo = KWH_CHEIO` e `descontoBase = 20`, cooperado paga 80% da tarifa cheia.

**Quando faz sentido:**
- Plano honesto, orientado a transparência
- Desconto anunciado = economia efetiva
- Combina naturalmente com `baseCalculo = KWH_CHEIO`

**Fórmula detalhada:**
```
tarifaContratada = tarifaBase × (1 − desc/100)
```

**Exemplo (fatura Condomínio, plano 20%, base KWH_CHEIO):**
- `tarifaBase` = 1,0928 (KWH_CHEIO)
- `tarifaContratada` = 1,0928 × 0,80 = **R$ 0,87424/kWh**
- Cooperado paga 80% do que pagaria sem cooperativa
- Economia efetiva: **20%** (idêntica ao anunciado)

### 4.3. Tipo II — ABATER_DA_CHEIA

**O que significa:** o desconto é calculado sobre a base escolhida, mas o resultado é **subtraído do KWH_CHEIO**. O cooperado continua pagando a parcela de impostos e encargos; só a parte da energia sofre desconto.

**Quando faz sentido:**
- Padrão do mercado GD brasileiro
- Permite anunciar "20% de desconto" com impacto menor no faturamento da cooperativa
- Combina tipicamente com `baseCalculo = SEM_TRIBUTO`

**Fórmula detalhada:**
```
abatimentoPorKwh   = tarifaBase × (desc/100)
tarifaContratada   = KWH_CHEIO − abatimentoPorKwh
```

**Exemplo (fatura Condomínio, plano 20%, base SEM_TRIBUTO):**
- `tarifaBase` = 0,78931 (SEM_TRIBUTO — TUSD + TE ANEEL)
- `abatimentoPorKwh` = 0,78931 × 0,20 = R$ 0,15786
- `KWH_CHEIO` = 1,0928
- `tarifaContratada` = 1,0928 − 0,15786 = **R$ 0,93494/kWh**
- Cooperado paga **85,6%** do que pagaria sem cooperativa
- Economia efetiva: **14,4%** (abaixo dos 20% anunciados)

### 4.4. Comparação direta dos dois tipos

Mesmo desconto (20%), mesma fatura (Condomínio 1.131 kWh), resultados diferentes:

| Configuração | `tarifaContratada` | `valorMensalContrato` | Economia efetiva |
|---|---|---|---|
| Tipo I + KWH_CHEIO | R$ 0,87424 | R$ 988,77 | 20,0% |
| Tipo I + SEM_TRIBUTO | R$ 0,63145 | R$ 714,17 | 42,2% ⚠️ |
| Tipo II + KWH_CHEIO | R$ 0,87424 | R$ 988,77 | 20,0% |
| Tipo II + SEM_TRIBUTO | R$ 0,93494 | R$ 1.057,42 | 14,4% |

### 4.5. Combinações válidas

Nem todas as combinações fazem sentido de negócio. Orientação:

| tipoDesconto | baseCalculo | Sentido de negócio |
|---|---|---|
| APLICAR_SOBRE_BASE | KWH_CHEIO | ✅ Admin honesto, 20% = 20% economia |
| APLICAR_SOBRE_BASE | SEM_TRIBUTO | ⚠️ Cooperado paga só TUSD+TE × (1−desc) — economia muito alta, faz sentido apenas em acordos específicos |
| APLICAR_SOBRE_BASE | COM_ICMS / CUSTOM | ✅ Possível, admin avançado |
| ABATER_DA_CHEIA | KWH_CHEIO | ⚠️ Matematicamente idêntico ao Tipo I + KWH_CHEIO — redundante |
| ABATER_DA_CHEIA | SEM_TRIBUTO | ✅ **Padrão do mercado GD brasileiro** |
| ABATER_DA_CHEIA | COM_ICMS / CUSTOM | ✅ Possível, admin avançado |

### 4.6. Equivalência matemática Tipo II + KWH_CHEIO = Tipo I + KWH_CHEIO

Quando `baseCalculo = KWH_CHEIO`, os dois tipos produzem o mesmo resultado:

```
Tipo I:  tarifaContratada = KWH_CHEIO × (1 − desc)
                         = KWH_CHEIO − KWH_CHEIO × desc

Tipo II: tarifaContratada = KWH_CHEIO − (KWH_CHEIO × desc)
                         = KWH_CHEIO − KWH_CHEIO × desc
```

São idênticos. A distinção entre Tipo I e Tipo II só importa quando `baseCalculo ≠ KWH_CHEIO`.

Isso significa que na UI v1, quando admin escolhe "desconto sobre o total da conta", **tanto faz** se o backend persiste `KWH_CHEIO + APLICAR_SOBRE_BASE` ou `KWH_CHEIO + ABATER_DA_CHEIA` — resultado igual. Recomendação: persistir `APLICAR_SOBRE_BASE` nesses casos por clareza semântica.

### 4.7. Aplicabilidade nos três modelos

Tipo I e Tipo II funcionam em todos os três modelos de cobrança:

- **FIXO_MENSAL**: aplicado uma vez no dimensionamento. `valorContrato` congelado resulta do cálculo.
- **CREDITOS_COMPENSADOS**: aplicado uma vez no dimensionamento. `tarifaContratual` congelada.
- **CREDITOS_DINAMICO**: aplicado a cada mês, com tarifas apuradas da fatura atual.

No DINAMICO, a fórmula do Tipo II exige reconstruir `KWH_CHEIO` mensalmente (ver Seção 6, Contexto 2).

### 4.8. Migração de contratos existentes

Nenhum contrato ativo hoje tem `tipoDesconto` preenchido (campo a ser criado em Sprint 5). Durante a migração:

- Contratos criados antes do Sprint 5 receberão `tipoDesconto = APLICAR_SOBRE_BASE` por default (comportamento atual do motor, que não distinguia tipos)
- Contratos criados após o Sprint 5 recebem o `tipoDesconto` do snapshot do plano no momento da aceitação
- Alterar `tipoDesconto` no plano **não retroage** em contratos existentes

---

## 5. Referência de valor (referenciaValor)

`referenciaValor` determina **qual consumo histórico** serve de base para o cálculo do `kwhBase` no dimensionamento inicial do contrato.

### 5.1. Os valores possíveis

| Valor técnico | Rótulo UI pro admin | O que faz |
|---|---|---|
| `ULTIMA_FATURA` | "Última fatura" | `kwhBase = consumoBruto da fatura mais recente` |
| `MEDIA_3M` | "Média dos últimos 3 meses" | `kwhBase = média(3 faturas mais recentes)` |
| `MEDIA_6M` | (escondido na UI v1) | `kwhBase = média(6 faturas mais recentes)` |
| `MEDIA_12M` | "Média dos últimos 12 meses" | `kwhBase = média(12 faturas mais recentes)` |

### 5.2. Quando cada valor faz sentido

**`ULTIMA_FATURA` — mais conservador:**
- Contrato ajustado ao consumo atual
- Bom para cooperados com padrão estável de consumo
- Risco: uma fatura atípica (mês de viagem, mês de alto consumo) distorce o dimensionamento

**`MEDIA_3M` — padrão:**
- Absorve variação sazonal curta
- Equilibra estabilidade e representatividade
- **Default recomendado na UI**

**`MEDIA_12M` — mais estável:**
- Absorve sazonalidade anual inteira (verão vs inverno)
- Bom para cooperados com variação grande entre estações
- Exige 12 meses de histórico disponível no OCR

**`MEDIA_6M` — escondido na UI v1:**
- Meio-termo entre 3 e 12 meses
- Nenhum plano no sistema usa hoje
- Redundante com as outras opções; mantido no schema para flexibilidade via API

### 5.3. Onde o histórico vem

O OCR extrai o **histórico de consumo dos 12 meses anteriores** a partir da seção "Histórico de Consumo (kWh)" da fatura EDP. Esses valores são armazenados em `FaturaProcessada.historicoConsumo` e consumidos pelo motor de proposta no dimensionamento.

Se o cooperado tem menos de N meses de histórico disponível (ex: conta nova, imóvel recém-ocupado), o sistema:
- `ULTIMA_FATURA`: sempre funciona (basta 1 fatura)
- `MEDIA_3M`: requer 3 meses; com menos, pode usar o máximo disponível ou falhar
- `MEDIA_12M`: requer 12 meses; com menos, pode usar o máximo disponível ou falhar

**Decisão de produto**: quando histórico é insuficiente, o motor **usa o máximo disponível** e registra essa decisão em `PropostaCooperado.mesesUtilizados` + `mesesDescartados` para auditoria.

### 5.4. Tratamento de outliers

O motor de proposta identifica consumos atípicos no histórico via `thresholdOutlier` (configurado em `ConfiguracaoMotor`, default 1,50). Valores acima desse threshold em relação à mediana são classificados como outliers.

Comportamento atual:
- Se `acaoOutlier = OFERECER_OPCAO`: motor mostra ao admin as duas bases possíveis (com e sem outlier) e deixa a decisão manual
- Se `acaoOutlier = USAR_FATURA`: motor ignora histórico e usa só a última fatura
- Se `acaoOutlier = AUMENTAR_DESCONTO`: motor aumenta o desconto proporcionalmente ao desvio

Essa lógica é **pré-existente** e fica fora do escopo do Sprint 5. Documentada aqui para completude.

### 5.5. Papel da referenciaValor em cada modelo de cobrança

Papel exclusivamente no **dimensionamento inicial**:

- **FIXO_MENSAL**: define `kwhBase`, que multiplica `tarifaContratada` para chegar em `valorContrato` congelado.
- **CREDITOS_COMPENSADOS**: define `kwhBase` para dimensionamento, mas a cobrança mensal usa `kwhCompensado` real da fatura. `kwhBase` vira `kwhContratoMensal` e serve para alocação de percentual de usina.
- **CREDITOS_DINAMICO**: mesma coisa. `kwhBase` vira `kwhContratoMensal` só para alocação de usina; cobrança mensal usa `kwhCompensado` real.

**Depois do dimensionamento, `referenciaValor` nunca mais é lida.** Alterações no plano afetam só contratos novos.

### 5.6. Ocultação de MEDIA_6M na UI v1

A UI de criação de plano expõe apenas 3 opções:
- Última fatura
- Média de 3 meses (padrão)
- Média de 12 meses

`MEDIA_6M` permanece no schema para flexibilidade via API, mas não aparece no dropdown. Racional: `MEDIA_3M` captura variação de curto prazo e `MEDIA_12M` captura sazonalidade anual — `MEDIA_6M` é um meio-termo que confunde sem agregar.

---

## 6. KWH_CHEIO — fórmulas, contextos e armadilhas

Esta é a seção mais crítica do documento. A matemática do KWH_CHEIO foi errada três vezes em sessão anterior antes de chegar à forma correta. Atenção redobrada ao ponto 6.4 (⚠️ ICMS não duplica).

### 6.1. O que é KWH_CHEIO

`KWH_CHEIO` é a **tarifa efetiva em R$/kWh que o cooperado pagaria sem cooperativa**, com todos os tributos e encargos incluídos. É o valor de referência contra o qual todos os descontos do plano são comparados.

Valores típicos em EDP-ES, 2026: entre R$ 1,00 e R$ 1,30 por kWh, variando por fatura.

### 6.2. Dois contextos, duas fórmulas

A fatura que o sistema processa cai em um de dois contextos mutuamente exclusivos:

| Contexto | Situação | Aplicação no sistema |
|---|---|---|
| **1 — Fatura limpa** | Cooperado não tem (nem teve) cooperativa. Fatura sem linhas "Energia Injetada". | Dimensionamento inicial (aceitação de proposta) |
| **2 — Fatura com créditos** | Cooperado já é membro. Fatura tem linhas "En. At. Inj." representando compensação. | Cálculo mensal de cobrança no modelo DINAMICO |

Cada contexto exige uma fórmula diferente. Usar a fórmula errada produz valores errados.

### 6.3. Contexto 1 — fatura limpa

**Quando ocorre:** cooperado novo, sem histórico GD. Admin pede a fatura mais recente da concessionária durante a captação.

**Requisito de produto:** admin **deve exigir fatura limpa** (sem créditos injetados) no processo de captação. Se cooperado vinha de outra GD, admin pede a fatura original da concessionária **e** a da concorrente, calculando o KWH_CHEIO individualmente conforme o caso.

**Fórmula:**
```
KWH_CHEIO = totalFatura / consumoBruto
```

Direto. O total da fatura já é o valor cheio porque não há compensação a descontar.

**Exemplo — Fatura Condomínio Moradas da Enseada, MAR/2026:**
- Identificação: UC 0.000.944.225.054-57
- Consumo bruto: 1.131 kWh
- Valor total da fatura: R$ 1.235,93
- **KWH_CHEIO = 1.235,93 / 1.131 = R$ 1,0928/kWh**

**Validação bottom-up** (soma dos componentes tem que fechar com o total):

| Linha na tabela "Detalhes do faturamento" | Valor (R$) |
|---|---|
| TUSD — Consumo | 682,25 |
| TE — Consumo | 466,85 |
| Contribuição de Iluminação Pública (CIP) | 86,83 |
| **TOTAL** | **1.235,93** |

A soma bate exatamente com o total da fatura. Isso confirma que os valores das linhas TUSD e TE na coluna "Valor Total R$" **já incluem todos os tributos indiretos** que entram na fatura (ICMS, PIS, COFINS) — exceto a CIP, que é somada separadamente.

### 6.4. ⚠️ ARMADILHA CRÍTICA — ICMS não duplica

Esta é a pegadinha. Dedique um momento pra entender antes de escrever qualquer código que lide com faturas.

A tabela "Detalhes do faturamento" da EDP tem várias colunas que **parecem** redundantes ou conflitantes:

| Coluna na fatura | O que é | Já embutido em "Valor Total R$"? |
|---|---|---|
| "Preço Unit. (R$) com Tributos" | Tarifa base + ICMS embutido por dentro | — (é a própria fonte do Valor Total) |
| "Valor Total R$" | kWh × "com Tributos" | (é o resultado, contém ICMS) |
| "PIS/COFINS" | Valor informativo | **NÃO.** PIS/COFINS é somado por fora no total final |
| "Base Calc. ICMS (R$)" | Base usada para calcular ICMS | — (informativa) |
| "Alíquota ICMS (%)" | Tipicamente 17% | — (informativa) |
| "ICMS (R$)" | Valor do ICMS aplicado | **SIM** — já embutido no Valor Total |
| "Tarifa Unit (R$)" | Tarifa ANEEL pura | — (tarifa base, sem imposto algum) |

**O erro recorrente** é somar "ICMS (R$)" ou "PIS/COFINS" como se fossem adicionais ao "Valor Total R$". **Não são.**

**Como verificar:** a soma dos "Valor Total R$" das linhas + CIP **tem que fechar com o TOTAL da fatura**. Se não fecha, a fórmula está errada.

Exemplo concreto da fatura Condomínio (que é limpa, fácil de validar):
- TUSD: 682,25
- TE: 466,85
- CIP: 86,83
- Soma: **1.235,93** = TOTAL da fatura ✅

Se alguém somar ICMS (115,98 + 79,36 = 195,34) ou PIS/COFINS (informativos) em cima disso, o resultado infla indevidamente e distorce o `KWH_CHEIO`.

**Consequência prática:** o OCR precisa extrair só o `valorTotalFatura` (ou somar `TUSD + TE + CIP`). Não somar colunas de tributos separadamente.

### 6.5. Contexto 2 — fatura com créditos

**Quando ocorre:** cooperado já está na cooperativa. Toda fatura mensal que chega traz linhas "En. At. Inj." (energia injetada, créditos compensados) que **abatem** o valor total.

**Por que contexto diferente:** o TOTAL da fatura nesse caso **não é o KWH_CHEIO**. É o valor que o cooperado paga **depois** de descontar os créditos. Usar `totalFatura / consumoBruto` aqui daria uma tarifa artificialmente baixa que mistura "quanto ele pagou do consumo não-compensado + impostos" num único número sem significado.

**Fórmula:**
```
valorSemCooperativa = soma das linhas "Fornecida" (coluna Valor Total R$)
                    + CIP
                    + bandeira (se houver)

KWH_CHEIO = valorSemCooperativa / consumoBruto
```

**O que pegar e o que ignorar:**
- ✅ Linhas "TUSD — Energia Ativa Fornecida" (valor em "Valor Total R$")
- ✅ Linhas "TE — Energia Ativa Fornecida" (valor em "Valor Total R$")
- ✅ Contribuição de Iluminação Pública (CIP)
- ✅ Adicional de bandeira (quando bandeira amarela ou vermelha)
- ❌ **Ignorar todas as linhas "En. At. Inj."** (são créditos, valores negativos; descontariam duas vezes)
- ❌ **Não somar coluna ICMS** (já embutido nas linhas "Fornecida")
- ❌ **Não somar coluna PIS/COFINS** (informativa, já no total)

**Exemplo — Fatura Luciano, MAR/2026:**
- Identificação: UC 0.001.421.380.054-70
- Consumo bruto: 1.088 kWh
- kWh compensados pelos créditos: 988 (soma das linhas "En. At. Inj.")
- Total pago pelo cooperado: R$ 184,46 (após compensação)

Valores das linhas "Fornecida":
| Linha | Valor Total R$ |
|---|---|
| TUSD — Energia Ativa Fornecida | 656,30 |
| TE — Energia Ativa Fornecida | 449,11 |
| CIP | 29,51 |
| Bandeira verde | 0,00 |
| **Reconstrução valorSemCooperativa** | **1.134,92** |

- **KWH_CHEIO = 1.134,92 / 1.088 = R$ 1,0431/kWh**

Esse é o número que o motor do DINAMICO usa para calcular a cobrança do mês:
- Com desconto de 20% (Tipo I + KWH_CHEIO):
- `cobrança = kwhCompensado × KWH_CHEIO × (1 − 0,20)`
- `cobrança = 988 × 1,0431 × 0,80 = R$ 824,48`

### 6.6. SEM_TRIBUTO — fórmula em qualquer contexto

Diferente do KWH_CHEIO, o valor do `SEM_TRIBUTO` é sempre direto, em qualquer contexto:

```
SEM_TRIBUTO = tarifaUnitTUSD + tarifaUnitTE
```

Onde `tarifaUnitTUSD` e `tarifaUnitTE` vêm da coluna **"Tarifa Unit (R$)"** do lado direito da tabela "Detalhes do faturamento" — a tarifa ANEEL pura, sem impostos, sem PIS/COFINS.

**Exemplo — ambas as faturas (Condomínio e Luciano), EDP-ES, MAR/2026:**
- `tarifaUnitTUSD` = 0,46863
- `tarifaUnitTE` = 0,32068
- **SEM_TRIBUTO = 0,78931 R$/kWh**

O valor é o mesmo nas duas faturas porque ambas são da mesma distribuidora, mesma classe (B - residencial/comercial) e mesma modalidade (convencional) no mesmo mês. `SEM_TRIBUTO` só muda quando a ANEEL homologa nova tarifa (reajuste anual, geralmente em agosto no caso da EDP).

### 6.7. COM_ICMS e CUSTOM (escondidos na UI v1)

**`COM_ICMS`**: TUSD + TE + ICMS. Dois caminhos:
```
Caminho A (tarifa unitária):
COM_ICMS = tarifaUnitTUSD + tarifaUnitTE + ICMS_unit
         = tarifaUnitTUSD × (1 + aliquotaICMS)
           + tarifaUnitTE × (1 + aliquotaICMS)

Caminho B (reconstrução do valor):
valorComIcms = (TUSD_valor + TE_valor)  [já tem ICMS embutido]
COM_ICMS = valorComIcms / consumoBruto
```

Os dois caminhos dão resultados ligeiramente diferentes por causa de arredondamento. O motor usa o **Caminho B** (reconstrução) por consistência com `KWH_CHEIO`.

**Exemplo — Fatura Condomínio:**
- TUSD valor: 682,25 | TE valor: 466,85 | soma: 1.149,10
- COM_ICMS = 1.149,10 / 1.131 = **R$ 1,0160/kWh**

**`CUSTOM`**: admin escolhe componentes individuais em `componentesCustom[]`. Motor soma o que foi escolhido. Fora do escopo da UI v1; usado por admin avançado via API.

### 6.8. Tabela resumo das fórmulas

| baseCalculo | Contexto 1 (fatura limpa) | Contexto 2 (com créditos) |
|---|---|---|
| KWH_CHEIO | `totalFatura / consumoBruto` | `valorSemCooperativa / consumoBruto` (reconstrução) |
| SEM_TRIBUTO | `tarifaUnitTUSD + tarifaUnitTE` | Idem |
| COM_ICMS | `(TUSD_valor + TE_valor) / consumoBruto` | Idem (usar só linhas "Fornecida") |
| CUSTOM | Soma dos componentes escolhidos | Idem (usar só linhas "Fornecida") |

### 6.9. Exemplos cruzados dos dois exemplos de fatura

| Grandeza | Condomínio (limpa) | Luciano (c/ créditos) |
|---|---|---|
| Consumo bruto (kWh) | 1.131 | 1.088 |
| kWh compensado | 0 | 988 |
| Total pago (R$) | 1.235,93 | 184,46 |
| Valor reconstruído sem cooperativa | 1.235,93 | 1.134,92 |
| **KWH_CHEIO (R$/kWh)** | **1,0928** | **1,0431** |
| **SEM_TRIBUTO (R$/kWh)** | **0,78931** | **0,78931** |
| Diferença entre os dois | 0,30349 | 0,25379 |

A diferença entre `KWH_CHEIO` e `SEM_TRIBUTO` varia por fatura porque:
- CIP é valor fixo rateado em kWhs diferentes (consumo varia)
- Bandeira tarifária muda mês a mês
- Pequenas variações de arredondamento entre meses

### 6.10. Responsabilidade do OCR

Para calcular corretamente o KWH_CHEIO em qualquer contexto, o OCR precisa extrair da fatura:

**Sempre:**
- `consumoBruto` (kWh medido)
- `valorTotalFatura` (total a pagar)
- Linhas "Fornecida" separadas: `TUSD_valor`, `TE_valor`
- Tarifas unitárias ANEEL: `tarifaUnitTUSD`, `tarifaUnitTE`
- CIP
- Bandeira tarifária (cor + valor de acréscimo)

**Quando presentes (Contexto 2):**
- Linhas "En. At. Inj." — identificar como créditos, somar em valor absoluto para obter `kwhCompensado`
- Ignorar linhas negativas na reconstrução do `valorSemCooperativa`

O prompt atual do OCR extrai todos esses campos (validado no Sprint 5). Alterações futuras no prompt devem preservar esses campos.

---

## 7. Fator de incremento (fatorIncremento)

Campo opcional em `Plano.fatorIncremento`. Aplica percentual adicional sobre `kwhBase` no dimensionamento inicial, para dar folga no contrato contra crescimento futuro de consumo.

### 7.1. O que faz

```
kwhContrato = kwhBase × (1 + fatorIncremento/100)
```

Se admin configurou `fatorIncremento = 5`, o contrato é dimensionado para **105% do consumo histórico** do cooperado. Se `fatorIncremento = 10`, para 110%. Vazio ou zero = sem incremento.

### 7.2. Quando faz sentido

**Casos típicos:**
- Cooperado informa que vai adquirir equipamento novo (ar-condicionado, piscina aquecida, carro elétrico)
- Família vai crescer (filho novo, agregado mudando pra casa)
- Empresa em expansão (mais funcionários, mais equipamentos)
- Margem de segurança padrão da cooperativa ("todo contrato com 5% de folga")

**Efeito prático:** contrato absorve crescimento futuro sem precisar renegociar. Se cooperado passa a consumir 5-10% a mais, continua dentro do contrato. Acima disso, precisa ajustar.

### 7.3. Limites operacionais

- Valor aceito: 0 a 100 (percentual)
- Default: vazio/zero
- Impacto no `percentualUsina`: incremento de 10% no `kwhContrato` significa 10% a mais de alocação na usina. Admin precisa considerar isso no rateio da capacidade.

### 7.4. Posição na UI v1

Fica **recolhido em "Configurações avançadas"** na UI de criação de plano. Admin que conhece, abre; admin que não conhece, nunca precisa tocar. Default vazio funciona pra 95% dos casos.

### 7.5. Papel em cada modelo de cobrança

Igual em todos — aplicado **uma vez** no dimensionamento:

- **FIXO_MENSAL**: `valorContrato = kwhContrato × tarifaContratada`. Valor congelado inclui a folga.
- **CREDITOS_COMPENSADOS**: `kwhContratoMensal = kwhContrato`. Alocação de usina inclui folga. Tarifa congelada não é afetada.
- **CREDITOS_DINAMICO**: `kwhContratoMensal = kwhContrato` só para alocação. Cobrança mensal usa `kwhCompensado` real, não `kwhContrato` — então `fatorIncremento` afeta só a alocação na usina, não a cobrança mensal.

---

## 8. Promoção temporal (descontoPromocional + mesesPromocao)

Recurso que permite plano oferecer **desconto maior nos primeiros meses** e depois cair para o desconto base. Típico em campanhas de lançamento ou aquisição ("30% nos 3 primeiros meses, depois 20% vitalício").

### 8.1. Como funciona

Plano tem dois percentuais de desconto:

- `descontoBase` — vitalício, obrigatório. Aplicado a partir do mês `mesesPromocao + 1` em diante.
- `descontoPromocional` — opcional. Aplicado **nos primeiros `mesesPromocao` meses** após adesão.

```
mesesDesdeAdesao = (dataCobranca − contrato.dataInicio) em meses
descontoAtivo = mesesDesdeAdesao < mesesPromocaoAplicados
              ? descontoPromocionalAplicado
              : percentualDesconto
```

### 8.2. Exemplo prático

Plano: "Campanha Lançamento" — 30% nos 3 primeiros meses, depois 20%.

Cooperado assina em 15/04/2026:

| Competência | Meses desde adesão | Desconto aplicado |
|---|---|---|
| MAI/2026 | 1 | 30% (promocional) |
| JUN/2026 | 2 | 30% (promocional) |
| JUL/2026 | 3 | 30% (promocional) |
| AGO/2026 | 4 | 20% (base — promoção expirou) |
| SET/2026 | 5 | 20% (base) |

### 8.3. Snapshots obrigatórios no Contrato

Para evitar que alterações no plano retroajam, o contrato **armazena snapshots** dos valores promocionais no momento da aceitação:

| Campo no Contrato | Tipo | Semântica |
|---|---|---|
| `descontoPromocionalAplicado` | Decimal, nullable | % do desconto promocional. NULL = plano sem promoção |
| `mesesPromocaoAplicados` | Int, nullable | Quantos meses dura a promoção. NULL = plano sem promoção |

O núcleo de cobrança lê **esses snapshots**, nunca o `Plano.descontoPromocional` atual. Se admin alterar o plano depois, contratos existentes preservam seus termos originais.

### 8.4. Caso especial — FIXO_MENSAL com promoção

Nos modelos `CREDITOS_COMPENSADOS` e `CREDITOS_DINAMICO`, promoção é simples: aplica-se um desconto ou outro conforme o mês.

No `FIXO_MENSAL`, o comportamento é diferente porque o valor cobrado **não depende de desconto no momento da cobrança** — o valor já foi dimensionado e congelado. Para que a promoção funcione no FIXO, o contrato precisa armazenar **dois valores congelados**:

| Campo no Contrato | Semântica |
|---|---|
| `valorContrato` | Valor mensal vitalício (após promoção) |
| `valorContratoPromocional` | Valor mensal nos primeiros `mesesPromocaoAplicados` meses |

Lógica de cobrança no FIXO com promoção:

```
mesesDesdeAdesao = (dataCobranca − contrato.dataInicio) em meses
valorCobranca = mesesDesdeAdesao < mesesPromocaoAplicados
              ? valorContratoPromocional
              : valorContrato
```

### 8.5. Caso especial — CREDITOS_COMPENSADOS com promoção

Similar ao FIXO, mas com tarifa em vez de valor:

| Campo no Contrato | Semântica |
|---|---|
| `tarifaContratual` | Tarifa vitalícia (após promoção) |
| `tarifaContratualPromocional` | Tarifa nos primeiros `mesesPromocaoAplicados` meses |

Lógica de cobrança:

```
mesesDesdeAdesao = (dataCobranca − contrato.dataInicio) em meses
tarifaAtiva = mesesDesdeAdesao < mesesPromocaoAplicados
            ? tarifaContratualPromocional
            : tarifaContratual

cobrança = kwhCompensado × tarifaAtiva
```

### 8.6. Caso especial — CREDITOS_DINAMICO com promoção

Mais simples — nada é congelado, só o percentual de desconto muda. Basta o `descontoAtivo` da seção 8.1:

```
descontoAtivo = mesesDesdeAdesao < mesesPromocaoAplicados
              ? descontoPromocionalAplicado
              : percentualDesconto

cobrança = kwhCompensado × KWH_CHEIO_mes × (1 − descontoAtivo/100)
(ou fórmula equivalente do Tipo II)
```

### 8.7. Resumo dos campos novos no Contrato

Todos adicionados na tarefa 1 do Sprint 5:

| Campo | FIXO | COMPENSADOS | DINAMICO |
|---|---|---|---|
| `descontoPromocionalAplicado` | nullable | nullable | nullable |
| `mesesPromocaoAplicados` | nullable | nullable | nullable |
| `valorContrato` | ✅ obrigatório | — | — |
| `valorContratoPromocional` | nullable (só se promoção) | — | — |
| `tarifaContratual` | — | ✅ obrigatório | — |
| `tarifaContratualPromocional` | — | nullable (só se promoção) | — |

### 8.8. Estado atual da implementação

⚠️ **Dead code antes do Sprint 5.** Os campos `descontoPromocional` e `mesesPromocao` existem no schema, UI e CRUD do `Plano`, mas o núcleo de cobrança nunca trocava entre promocional e base. Todos os meses aplicavam `descontoBase`.

Um plano configurado no banco hoje ("Campanha Lançamento 20%") tem promoção definida (`descontoBase = 15`, `descontoPromocional = 20`, `mesesPromocao = 3`) mas o comportamento está quebrado — sistema aplica 15% desde o mês 1.

**Sprint 5 implementa a lógica no núcleo** conforme seções 8.1 a 8.6 acima. Testes unitários cobrem:
- Cobrança no mês 1, 2, 3, 4 (transição promocional → base)
- FIXO com promoção (dois valores congelados)
- COMPENSADOS com promoção (duas tarifas congeladas)
- DINAMICO com promoção (troca de percentual)
- Plano sem promoção (snapshots nullable)

### 8.9. Limitações da promoção temporal

- **Só um período promocional por contrato**. Não há suporte a "30% no mês 1, 25% nos meses 2-3, 20% vitalício". Se precisar, admin cria outro plano.
- **Unidade é mês inteiro**, não dia. Cooperado que assina em 15/04 paga promocional em abril inteiro e transiciona em 15/07 (apenas se o mês for de 31 dias — a implementação usa `date-fns.differenceInMonths` que trata parcialmente isso).
- **Promoção é contada a partir de `contrato.dataInicio`**, não de `contrato.ativadoEm`. Contrato em `PENDENTE_ATIVACAO` que fica parado 2 meses pode "queimar" a promoção antes de começar a cobrar. Avaliar se isso precisa virar regra (`primeiroCobranca` como marcador) em sprint futuro.

---

## 9. Mapeamento UI ↔ backend

Esta seção mostra como cada escolha do admin na UI de `/dashboard/planos/novo` se traduz em campos do schema Prisma. Serve de referência tanto para implementação quanto para debugging de comportamento inesperado.

### 9.1. Estrutura da UI v1

Sprint 5 refatora o formulário em linguagem de produto. Layout final previsto:

```
┌─ 1. Identificação ────────────────────────────────────┐
│  Nome *                                               │
│  Descrição                                            │
│  Plano público? (toggle — visível na captação)        │
│  Tipo: Padrão | Campanha                              │
└───────────────────────────────────────────────────────┘

┌─ 2. Modelo de cobrança ───────────────────────────────┐
│  Como funciona o pagamento:                           │
│    ○ Mensalidade fixa                                 │
│       "Cooperado paga valor fixo por mês, congelado"  │
│    ○ Por kWh compensado                               │
│       "Cooperado paga por cada kWh compensado"        │
│    ○ Desconto dinâmico na fatura                      │
│       "Cooperado tem desconto % na fatura da concess." │
└───────────────────────────────────────────────────────┘

┌─ 3. Dimensionamento inicial ──────────────────────────┐
│  Qual consumo histórico usar pra dimensionar:         │
│    Última fatura | Média 3 meses | Média 12 meses     │
│  [i] "Define o contrato na assinatura. Fica congelado."│
└───────────────────────────────────────────────────────┘

┌─ 4. Desconto ─────────────────────────────────────────┐
│  Percentual de desconto *: [input %]                  │
│                                                       │
│  Aplicar o desconto:                                  │
│    ○ Sobre o total da conta (cooperado economiza X%)  │
│    ○ Sobre a parte da energia (prática do mercado)    │
│                                                       │
│  [ ] Desconto promocional nos primeiros meses         │
│      Se marcado:                                      │
│        Desconto promocional *: [input %]              │
│        Quantidade de meses *: [input]                 │
└───────────────────────────────────────────────────────┘

┌─ 5. Configurações avançadas (recolhido) ──────────────┐
│  Fator de incremento: [input %]                       │
│  Base de cálculo personalizada: [dropdown COM_ICMS/...]│
└───────────────────────────────────────────────────────┘

┌─ 6. CooperToken (recolhido) ──────────────────────────┐
│  [toggle] Ativar CooperToken                          │
│  (mantém UI atual — redesign em Sprint 6)             │
└───────────────────────────────────────────────────────┘
```

### 9.2. Mapeamento direto campo-a-campo

| Campo UI | Campo schema | Observações |
|---|---|---|
| Nome | `Plano.nome` | String |
| Descrição | `Plano.descricao` | String nullable |
| Plano público? | `Plano.publico` | Boolean, default true |
| Tipo (Padrão/Campanha) | `Plano.tipoCampanha` | Enum `TipoCampanha` |
| **Modelo "Mensalidade fixa"** | `Plano.modeloCobranca = FIXO_MENSAL` | |
| **Modelo "Por kWh compensado"** | `Plano.modeloCobranca = CREDITOS_COMPENSADOS` | |
| **Modelo "Desconto dinâmico"** | `Plano.modeloCobranca = CREDITOS_DINAMICO` | |
| Última fatura | `Plano.referenciaValor = ULTIMA_FATURA` | |
| Média 3 meses | `Plano.referenciaValor = MEDIA_3M` | |
| Média 12 meses | `Plano.referenciaValor = MEDIA_12M` | |
| Percentual de desconto | `Plano.descontoBase` | Decimal(5,2) |
| **"Sobre o total da conta"** | `tipoDesconto = APLICAR_SOBRE_BASE` + `baseCalculo = KWH_CHEIO` | Combinação salva junto |
| **"Sobre a parte da energia"** | `tipoDesconto = ABATER_DA_CHEIA` + `baseCalculo = SEM_TRIBUTO` | Combinação salva junto |
| Toggle promocional | `Plano.temPromocao` | Boolean |
| Desconto promocional | `Plano.descontoPromocional` | Decimal(5,2) nullable |
| Quantidade de meses | `Plano.mesesPromocao` | Int nullable |
| Fator de incremento | `Plano.fatorIncremento` | Decimal(5,2) nullable |
| Base customizada | `Plano.baseCalculo = COM_ICMS / CUSTOM` | Dropdown avançado |
| Ativar CooperToken | `Plano.cooperTokenAtivo` | Boolean |

### 9.3. A decisão de desconto — dois campos do backend, uma escolha na UI

A UI apresenta duas opções simples:
- "Sobre o total da conta"
- "Sobre a parte da energia"

Por baixo, isso corresponde a **duas combinações** de `baseCalculo` + `tipoDesconto`:

| Escolha na UI | baseCalculo | tipoDesconto |
|---|---|---|
| "Sobre o total da conta" | `KWH_CHEIO` | `APLICAR_SOBRE_BASE` |
| "Sobre a parte da energia" | `SEM_TRIBUTO` | `ABATER_DA_CHEIA` |

A UI nunca mostra esses campos separadamente (exceto no bloco avançado). Admin pensa em produto; backend pensa em matemática.

### 9.4. O que fica escondido na UI v1

Campos que existem no schema mas não aparecem na UI padrão:

| Campo schema | Valor disponível | Por que está escondido |
|---|---|---|
| `Plano.baseCalculo = COM_ICMS` | Tarifa + ICMS | Meio-termo raro, pouco uso |
| `Plano.baseCalculo = CUSTOM` | Componentes customizados | Nenhum plano usa; complexidade sem demanda |
| `Plano.componentesCustom[]` | Array de componentes | Só faz sentido com `CUSTOM` |
| `Plano.referenciaValor = MEDIA_6M` | Média 6 meses | Redundante com 3 e 12 |
| `Plano.mostrarDiscriminado` | Boolean | Opção de renderização, pouco crítica |

Admin que precisa de `COM_ICMS` ou `CUSTOM` configura via:
- Bloco "Configurações avançadas" da UI (dropdown adicional)
- API direta (POST `/planos`)
- Prisma direto (migração ou ajuste manual)

### 9.5. Campos que migram do Plano para o Contrato (snapshots)

Na criação do contrato via `aceitar()`, o motor copia valores do plano para o contrato. Isso garante que alterações futuras no plano não afetam contratos existentes.

| Campo Plano | Campo Contrato (snapshot) | Quando é preenchido |
|---|---|---|
| `descontoBase` | `percentualDesconto` | Sempre |
| `baseCalculo` | `baseCalculoAplicado` (novo) | Sempre |
| `tipoDesconto` | `tipoDescontoAplicado` (novo) | Sempre |
| `descontoPromocional` | `descontoPromocionalAplicado` (novo) | Se `temPromocao = true` |
| `mesesPromocao` | `mesesPromocaoAplicados` (novo) | Se `temPromocao = true` |
| calculado: `valorMensalContrato` | `valorContrato` | Se modelo = FIXO_MENSAL |
| calculado: `tarifaContratada` | `tarifaContratual` | Se modelo = CREDITOS_COMPENSADOS |
| calculado: `valorMensalPromocional` | `valorContratoPromocional` | Se FIXO_MENSAL + promoção |
| calculado: `tarifaContratadaPromocional` | `tarifaContratualPromocional` | Se COMPENSADOS + promoção |
| sempre: `kwhBase × (1 + fatorIncremento/100)` | `kwhContratoMensal` | Sempre |

### 9.6. Validações na criação do plano

Regras de consistência que o backend deve validar antes de salvar:

1. **Percentual de desconto em faixa válida**: `descontoBase` entre 0 e 100.
2. **Promoção coerente**: se `temPromocao = true`, então `descontoPromocional` e `mesesPromocao` são obrigatórios. Se `temPromocao = false`, os dois campos devem ser NULL (ou ignorados).
3. **Promoção maior que base**: `descontoPromocional > descontoBase`. Promoção que piora não faz sentido.
4. **CooperToken coerente**: se `cooperTokenAtivo = true`, a cooperativa precisa ter `ConfigCooperToken` (Sprint 6 adiciona validação; Sprint 5 deixa passar).
5. **CUSTOM precisa de componentesCustom**: se `baseCalculo = CUSTOM`, o array `componentesCustom` não pode estar vazio.
6. **Tipo e base compatíveis**: validar combinações conforme tabela da Seção 4.5. Combinações marcadas como "⚠️" geram aviso, não erro.

### 9.7. Payload esperado — exemplos

**Plano honesto com promoção temporal, FIXO:**
```json
{
  "nome": "Plano Residencial Transparente",
  "descricao": "20% de desconto real. 30% nos 3 primeiros meses.",
  "publico": true,
  "tipoCampanha": "CAMPANHA",
  "modeloCobranca": "FIXO_MENSAL",
  "referenciaValor": "MEDIA_3M",
  "descontoBase": 20.00,
  "baseCalculo": "KWH_CHEIO",
  "tipoDesconto": "APLICAR_SOBRE_BASE",
  "temPromocao": true,
  "descontoPromocional": 30.00,
  "mesesPromocao": 3,
  "fatorIncremento": null,
  "cooperTokenAtivo": false
}
```

**Plano padrão mercado, DINAMICO:**
```json
{
  "nome": "Plano Padrão GD 20%",
  "modeloCobranca": "CREDITOS_DINAMICO",
  "referenciaValor": "MEDIA_3M",
  "descontoBase": 20.00,
  "baseCalculo": "SEM_TRIBUTO",
  "tipoDesconto": "ABATER_DA_CHEIA",
  "temPromocao": false,
  "publico": true,
  "tipoCampanha": "PADRAO"
}
```

---

## 10. CooperToken — subsistema econômico paralelo

Esta seção documenta o sistema CooperToken na integralidade. Sistema é **maduro no código** (~1641 linhas em `cooperados-token.service.ts`, 25 métodos, 5 tabelas dedicadas, UI em admin e portal do cooperado) mas **zerado nos dados** (0 planos ativos, 0 cooperativas configuradas, 6 registros no ledger total).

No **Sprint 5**, Token não sofre mudança — toggle `cooperTokenAtivo` no plano mantém comportamento atual. Esta seção existe pra evitar que o próximo sprint tenha que redescobrir tudo.

O **redesign completo é Sprint 6**.

### 10.1. Conceito

CooperToken é uma **moeda interna da cooperativa**. Funciona como uma unidade de valor que:

- Pode ser emitida pela cooperativa (desconto convertido em token, bônus, indicação)
- Pode ser comprada pela cooperativa com PIX/boleto (via Asaas)
- Pode ser gasta pelo cooperado de três formas: abater a própria fatura, usar com parceiros do Clube de Vantagens, transferir pra outros cooperados (futuro)
- Tem valor em reais definido pela cooperativa (`ConfigCooperToken.valorTokenReais`)
- Tem prazo de expiração configurável

### 10.2. Três fluxos de valor

**Fluxo 1 — Conversão do desconto em token (opt-in do cooperado)**

Cooperado em plano com `cooperTokenAtivo = true` escolhe individualmente como receber o desconto, via `Cooperado.opcaoToken`:

- **Opção A (`opcaoToken = "A"`)** — desconto direto na fatura. Comportamento tradicional.
- **Opção B (`opcaoToken = "B"`)** — cooperado paga **valor cheio** na cobrança e recebe tokens **equivalentes ao desconto** no saldo. Tokens gastam-se depois em qualquer canal.

O plano define a opção default via `Plano.modoToken`:
- `DESCONTO_DIRETO` — todos os aderentes nascem Opção A
- `FATURA_CHEIA_TOKEN` — todos nascem Opção B
- `AMBAS` — cada cooperado escolhe individualmente

**Fluxo 2 — Gasto do token**

Três canais de gasto disponíveis hoje:

1. **Abater fatura** (`usarNaFatura`) — cooperado aplica tokens em uma `Cobranca` pendente, reduzindo o valor a pagar. Conversão token→reais usa `ConfigCooperToken.valorTokenReais`.

2. **Resgatar no Clube de Vantagens** — cooperativa cadastra ofertas (`OfertaClube`) com custo em tokens (ex: "desconto 30% na academia X — 500 tokens"). Cooperado resgata, gera `ResgateClubeVantagens` com `codigoResgate`. Parceiro valida o código no momento do uso.

3. **PIX/QR com parceiros** (`PAGAMENTO_QR`) — cooperado paga parceiro em tokens via QR code; infraestrutura existe mas sem uso em produção.

**Fluxo 3 — MLM (indicação multinível)**

Ortogonal aos dois anteriores. Funciona mesmo em planos sem Token ativado.

- Cooperado A indica cooperado B via link `/cadastro?ref=CODIGO_A`
- B adere, ativa contrato, paga primeira cobrança
- Sistema credita `BONUS_INDICACAO` pro cooperado A no ledger
- Cascata até `ConfigIndicacao.maxNiveis` — se A foi indicado por X, X também recebe benefício menor
- Duas modalidades de cálculo (`ConfigIndicacao.modalidade`):
  - `PERCENTUAL_PRIMEIRA_FATURA` — % sobre o valor da primeira cobrança do indicado
  - `REAIS_KWH_RECORRENTE` — R$/kWh toda vez que o indicado paga (recorrente)

Indicador usa esses tokens livremente nos canais do Fluxo 2.

### 10.3. Estrutura de dados

Cinco tabelas dedicadas:

**`CooperTokenLedger`** — evento contábil imutável
- Toda movimentação (crédito ou débito) gera uma linha
- Campos: `cooperadoId`, `cooperativaId`, `tipo` (enum de 7), `operacao` (enum de 9), `quantidade`, `saldoApos`, `valorReais`, `referenciaId`, `referenciaTabela`, `expiracaoEm`
- Imutável — correções se fazem com novas linhas de ajuste, não edição

**`CooperTokenSaldo`** — saldo materializado por cooperado
- Atualizado a cada crédito/débito
- Campos: `saldoDisponivel`, `saldoPendente`, `totalEmitido`, `totalResgatado`, `totalExpirado`
- Pode ser reconstruído somando o ledger se necessário

**`ConfigCooperToken`** — configuração da cooperativa
- Um por cooperativa (`@@unique cooperativaId`)
- Campos: `modoGeracao` (PRE_COMPRA | COTA_MENSAL | AMBOS), `modeloVida` (EXPIRACAO_29D | DECAY_CONTINUO | AMBOS), `valorTokenReais`, `descontoMaxPerc`, `limiteTokenMensal`, `tetoCoop`
- **Nenhuma cooperativa tem config hoje** — Sprint 6 cria UI admin

**`CooperTokenSaldoParceiro`** — saldo da cooperativa como "parceiro" (pool geral)
- Um por cooperativa
- Campos: `saldoDisponivel`, `totalRecebido`, `totalUsadoEnergia`, `totalTransferido`, `totalComprado`

**`CooperTokenCompra`** — compras de tokens via Asaas
- Cooperativa compra pacotes de token com PIX/boleto
- Status: AGUARDANDO_PAGAMENTO | PAGO | CANCELADO

### 10.4. Enums

**`CooperTokenTipo`** — classifica a origem/natureza do token:
- `GERACAO_EXCEDENTE` — sobra de geração da usina
- `FATURA_CHEIA` — cooperado optou por pagar cheio e receber tokens (Fluxo 1 Opção B)
- `FLEX` — token flexível (uso livre)
- `SOCIAL` — token de programa social/doação
- `BONUS_INDICACAO` — MLM (Fluxo 3)
- `PAGAMENTO_QR` — recebido via QR code de parceiro
- `DESCONTO_FATURA` — usado para abater fatura (saída)

**`CooperTokenOperacao`** — direção do movimento:
- `CREDITO` | `DEBITO` | `EXPIRACAO` | `DOACAO_ENVIADA` | `DOACAO_RECEBIDA` | `COMPRA_PARCEIRO` | `ABATIMENTO_ENERGIA` | `TRANSFERENCIA_PARCEIRO` | `RESGATE_CLUBE`

### 10.5. Regra de negócio fundamental

**Uso de token é SEMPRE manual, nunca automático.**

Sistema nunca aplica tokens sem ação explícita do cooperado. Mesmo que o cooperado tenha saldo suficiente pra zerar a fatura, o sistema gera a cobrança normal. O abatimento só acontece quando o cooperado aciona manualmente via portal ou bot WhatsApp.

**Exceção única**: Fluxo 1 Opção B (cooperado com `opcaoToken = "B"` em plano com `modoToken = FATURA_CHEIA_TOKEN`) — nesse caso, a emissão do token acontece **automaticamente** no momento em que a cobrança é criada, porque é parte do contrato. Mas o **gasto** desse token continua sendo manual.

### 10.6. Interação com a cobrança

No fluxo Opção A (tradicional), cobrança é gerada conforme seções anteriores desse documento. Sem tokens envolvidos.

No fluxo Opção B, a cobrança é gerada **pelo valor cheio** (sem desconto aplicado) e, simultaneamente, tokens equivalentes ao desconto são creditados no saldo do cooperado. Isso é controlado pela lógica atual em `CobrancasService.create` (linhas 103-172).

Se cooperado decide depois abater tokens na própria fatura (`usarNaFatura`), os campos da cobrança são atualizados:
- `Cobranca.tokenDescontoQt` — quantidade de tokens aplicada
- `Cobranca.tokenDescontoReais` — valor em reais do abatimento
- `Cobranca.ledgerDebitoId` — FK pra linha no ledger que registrou o débito

A cobrança não é recriada — é atualizada no lugar.

### 10.7. UI do token em cada interface

**Admin (`/dashboard/cooper-token/`):**
- Gestão de saldo da cooperativa
- Extrato consolidado do ledger
- Configuração de `ConfigCooperToken` (⚠️ UI parcial hoje — Sprint 6 completa)
- Compra de tokens via Asaas (`/cooper-token-financeiro`)

**Admin (`/dashboard/clube-vantagens/`):**
- CRUD de ofertas (`OfertaClube`)
- Aprovação de resgates
- Ranking de cooperados por tier

**Admin (`/dashboard/cooper-token-parceiro/`):**
- Gestão de parceiros autorizados a receber tokens

**Cooperado (`/portal/tokens`):**
- Saldo disponível
- Extrato de movimentações
- Botão "usar na fatura" (abatimento manual)

**Cooperado (`/portal/clube`):**
- Ofertas disponíveis filtradas por tier
- Histórico de resgates

**Parceiro (`/parceiro/validar`):**
- Interface pra validar código de resgate apresentado pelo cooperado

### 10.8. Expiração de tokens

Dois modelos configuráveis (`ConfigCooperToken.modeloVida`):

- **`EXPIRACAO_29D`** — tokens expiram 29 dias após emissão (alinha com ciclo da concessionária)
- **`DECAY_CONTINUO`** — tokens perdem valor progressivamente, não expiram subitamente
- **`AMBOS`** — ambos os modelos convivem, admin escolhe por tipo de token

Job diário processa expirações e gera operações `EXPIRACAO` no ledger.

### 10.9. Papel do Token em cada modelo de cobrança

Em teoria, Token funciona em todos os 3 modelos. Na prática:

- **FIXO_MENSAL** + Opção A: sem interação com Token
- **FIXO_MENSAL** + Opção B: cobrança emitida com `valorContrato` cheio; tokens calculados sobre o desconto hipotético (`valorContrato × descontoBase/100`)
- **COMPENSADOS** + Opção A: sem interação com Token
- **COMPENSADOS** + Opção B: cobrança com tarifa cheia (sem `tarifaContratual`); tokens sobre o desconto
- **DINAMICO** + Opção A: sem interação
- **DINAMICO** + Opção B: cobrança com KWH_CHEIO mensal sem desconto; tokens sobre o desconto que teria sido aplicado

Esse comportamento está implementado mas **não testado em produção** (0 aderentes hoje).

### 10.10. Estado no banco

| Tabela | Registros | Observação |
|---|---|---|
| `cooper_token_ledger` | 6 | Movimentações de teste |
| `cooper_token_saldo` | 3 | Cooperados com saldo |
| `config_cooper_token` | 0 | **Nenhuma cooperativa configurou** |
| `cooper_token_compras` | 0 | Nenhuma compra feita |
| `ofertas_clube` | 0 | Nenhum parceiro cadastrado |
| `resgates_clube_vantagens` | 0 | Nenhum resgate |
| `planos.cooperTokenAtivo = true` | 0 | Nenhum plano ativou |
| `cooperados.opcaoToken = "B"` | 0 | Nenhum cooperado optou |

Sistema está **inerte operacionalmente**. Toda infra pronta, aguardando primeira cooperativa configurar.

### 10.11. Gaps conhecidos (Sprint 6)

| Gap | Descrição | Impacto |
|---|---|---|
| UI `ConfigCooperToken` | Admin não tem tela completa pra configurar Token na cooperativa | Bloqueia adoção — primeiro passo pra ativar é ter config |
| Validação de coerência | Plano pode ter `cooperTokenAtivo=true` sem cooperativa ter config | Erro silencioso ao criar cobrança pra cooperado Opção B sem config |
| Redesign UI plano | Seção "Ativar CooperToken" no formulário de plano é um toggle genérico; admin não sabe o que está ativando | Confunde admin, fomenta configuração errada |
| Redesign Clube de Vantagens | CRUD atual é funcional mas sem UX clara de "cadastrar parceiro" vs "criar oferta" | Barreira operacional |
| MLM por papel | Hangar Academia precisa de benefício diferenciado por papel (Hangar → Professor ≠ Professor → Aluno) | Hoje sistema só diferencia por nível numérico |
| Painel Agregador | `TipoCooperado.AGREGADOR` existe no enum mas não tem painel próprio de gestão da rede | Necessário pra Hangar Academia |
| Relatório rede por origem | Cooperativa não consegue ver "todos os cooperados que vieram da Hangar" | Necessário pra MLM corporativo |

### 10.12. Relação com outros subsistemas

**Clube de Vantagens** é um **consumidor** do Token: ofertas são vendidas em tokens, resgates debitam do saldo. Não faz sentido ter Clube sem Token ativo.

**Indicações (MLM)** é um **produtor** do Token via `BONUS_INDICACAO`. Funciona mesmo em planos sem `cooperTokenAtivo`, porque o token gerado pela indicação é uma ponta solta: entra no saldo do indicador. Esse saldo só tem uso se tem Clube com ofertas, ou se plano do indicador permite abater fatura.

**Cobrança** é a **interface principal** do Token: é onde a maioria das emissões (Opção B) e dos gastos (abater fatura) acontece.

### 10.13. O que Sprint 5 preserva intacto

- Toggle "Ativar CooperToken" no formulário de plano — mantém UI atual
- Lógica de `CobrancasService.create` quando plano tem Token — mantém comportamento
- Ledger, Saldo, Config, Compra — schemas intactos
- UI admin e portal do cooperado — intactos

Sprint 5 **não mexe em Token**. Nem um arquivo do módulo `cooperados-token/` é tocado. O que muda é só o contexto ao redor (UI de plano, engine de cobrança) — Token continua funcionando igual antes e depois.

O redesign é responsabilidade do Sprint 6.

---

## 11. Pipeline Email → OCR → Cobrança

Esta seção documenta o pipeline que transforma faturas da concessionária (recebidas por email) em cobranças automáticas na cooperativa. É o caminho quente do modelo `CREDITOS_DINAMICO` e `CREDITOS_COMPENSADOS`, e bloqueio crítico da operação em produção.

Sistema é **funcional mas inerte** nos dados: código completo, cron ativo, 1 email processado em todo o histórico. Sprint 5 aplica hotfixes pequenos e ativa o fluxo.

### 11.1. Visão geral do pipeline

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  EDP envia PDF   │───▶│  IMAP monitora   │───▶│  Claude extrai   │
│ contato@coop...  │    │  caixa de email  │    │  dados do PDF    │
└──────────────────┘    └──────────────────┘    └──────────────────┘
                                                         │
                                                         ▼
                        ┌──────────────────┐    ┌──────────────────┐
                        │  Admin revisa    │◀───│  FaturaProcessada│
                        │  e aprova        │    │  criada no banco │
                        └──────────────────┘    └──────────────────┘
                                 │                       │
                                 │                   [auto-aprova?]
                                 ▼                       │
                        ┌──────────────────┐             ▼
                        │  Cobrança gerada │◀─────── Sim/Não
                        │  conforme modelo │
                        └──────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  Asaas emite     │
                        │  PIX/boleto      │
                        └──────────────────┘
```

### 11.2. Componentes e status atual

**Cron de monitoramento** — `EmailMonitorService.verificarEmailsFaturas()`
- Executa diariamente às 6h (`@Cron('0 0 6 * * *')`)
- Trigger manual também disponível via `POST /email-monitor/processar`
- Multi-tenant: busca config IMAP de cada cooperativa via `ConfigTenant`
- Status: ✅ funcional

**Fetch IMAP** — biblioteca `ImapFlow`
- Conecta em `contato@cooperebr.com.br` (ou email configurado por cooperativa)
- Lê mensagens não-lidas, detecta PDFs anexados
- Move mensagens processadas pra pasta "Processados"; mensagens com erro pra "Pendentes"
- Lock por mensagem pra evitar processamento duplicado em execuções concorrentes
- Status: ✅ funcional

**Identificação do cooperado** — 3 estratégias em cascata:
1. Match por email do remetente (EDP → cooperativa → cooperado por email do remetente) — ✅ funcional
2. Match por `uc.numeroUC` no corpo do email — ❌ BROKEN (campo NULL em todas as 108 UCs)
3. Match por CPF + UC extraídos pelo OCR — ✅ funcional (CPF) + ❌ BROKEN (UC, mesmo bug)

**Hotfix do Sprint 5** (tarefa 5): trocar `uc.numeroUC` por `uc.numero` em 2 pontos (`email-monitor.service.ts` linhas 265 e 469). Mesmo bug que foi corrigido na engine de cobrança.

**OCR** — Claude API direto via `FaturasService.extrairOcr()`
- Modelo: `claude-sonnet-4-20250514`
- Extrai: titular, UC, consumo bruto, total da fatura, histórico 12 meses, linhas TUSD/TE (fornecida + injetada), CIP, bandeira, tarifas unitárias
- Status: ✅ funcional, usado também em uploads manuais via dashboard

**FaturaProcessada.create** — via factory `criarFaturaProcessada`
- Resolve `ucId` e `cooperativaId` via normalização do número da UC
- Status: ✅ funcional (melhoria do Sprint 5, commit `e30dc0f` + `8305397` + `a03d06a`)

**Auto-aprovação** — guard automático
- Condições: `divergenciaPerc < 5` (histórico vs média) **E** `ucId` resolvido
- Se atende: `statusRevisao = AUTO_APROVADO`
- Senão: `statusRevisao = PENDENTE_REVISAO` (admin revisa manualmente na Central de Faturas)
- Status: ✅ funcional

**Notificação admin** — WhatsApp
- Bot envia mensagem no número configurado em `ADMIN_WHATSAPP_NUMBER` ou `ConfigTenant`
- Admin recebe link direto pra Central de Faturas
- Status: ✅ funcional

**Geração de cobrança** — depende do modelo do contrato
- FIXO_MENSAL: não depende de fatura; cobrança sai do `valorContrato` congelado
- COMPENSADOS e DINAMICO: dependem da fatura aprovada pra extrair `kwhCompensado`
- Status: ⚠️ BLOQUEADA hoje pela flag `BLOQUEIO_MODELOS_NAO_FIXO`. Sprint 5 desliga (tarefa 9) após FIXO ter `valorContrato` preenchido.

### 11.3. Fluxo end-to-end passo a passo

**Passo 1 — EDP envia fatura**
A concessionária envia PDF no email configurado. Em 2026, EDP-ES envia PDFs e, em alguns casos, XML ANEEL na mesma mensagem. Sprint 5 processa só PDFs; XML fica pra Sprint 7.

**Passo 2 — Cron às 6h (ou trigger manual)**
`verificarEmailsFaturas()` itera sobre as cooperativas com email configurado em `ConfigTenant.email.monitor.ativo = true`. Pra cada uma, conecta IMAP e busca mensagens novas.

**Passo 3 — Por mensagem: extração**
Pra cada mensagem com PDF anexo:
- Baixa o anexo
- Converte pra base64
- Chama `FaturasService.extrairOcr(base64)` — retorna objeto `dadosExtraidos`

**Passo 4 — Identificação do cooperado**
Tenta as 3 estratégias em ordem. Se nenhuma funciona, cria `FaturaProcessada` com `statusRevisao = NAO_IDENTIFICADA` (admin resolve manualmente).

**Passo 5 — FaturaProcessada.create**
Via factory `criarFaturaProcessada`. Resolve `ucId` + `cooperativaId`. Guard de auto-aprovação decide `AUTO_APROVADO` vs `PENDENTE_REVISAO`.

**Passo 6 — Notificação**
WhatsApp ao admin. Email movido pra pasta "Processados".

**Passo 7 — Revisão (se necessário)**
Admin abre Central de Faturas, revisa a fatura, aprova manualmente. Status vira `APROVADO`.

**Passo 8 — Geração de cobrança**
Ao aprovar, sistema verifica o contrato do cooperado:
- Se FIXO_MENSAL: cobrança gerada pelo `valorContrato` congelado
- Se COMPENSADOS: cobrança = `kwhCompensado × tarifaContratual` (ou promocional se dentro do período)
- Se DINAMICO: cobrança = `kwhCompensado × KWH_CHEIO_mes × (1 − desc)` via fórmula do snapshot

**Passo 9 — Asaas**
Via `AsaasService`, cobrança vira PIX + boleto. Link enviado pro cooperado por WhatsApp.

### 11.4. ConfigTenant — chaves necessárias

Pra uma cooperativa ativar o pipeline, precisa ter registros em `ConfigTenant`:

| Chave | Valor | Exemplo |
|---|---|---|
| `email.monitor.ativo` | `true` / `false` | `true` |
| `email.monitor.host` | Servidor IMAP | `imap.gmail.com` |
| `email.monitor.port` | Porta (geralmente 993) | `993` |
| `email.monitor.user` | Email completo | `contato@cooperebr.com.br` |
| `email.monitor.pass` | Senha de app (NÃO a senha principal) | `abcd efgh ijkl mnop` |
| `email.monitor.mailbox` | Caixa a monitorar (opcional) | `INBOX` |
| `admin.whatsapp` | Número pra notificações | `5527999999999` |

**Nenhuma cooperativa tem essas chaves configuradas hoje.** Setup é manual via SQL ou Prisma direto. Sprint 7 cria UI admin pra configurar pela dashboard.

### 11.5. Email → Cobrança em cada modelo

Ver também Seção 2.7 pra visão consolidada das dependências de fatura.

**FIXO_MENSAL**: pipeline email é **útil para registro, não obrigatório para cobrança**.
- Cobrança é gerada diretamente do `valorContrato` congelado — **desacoplada** da fatura
- Três gatilhos possíveis de geração (ver Seção 2.7.1):
  - Cron mensal automático
  - Chegada da fatura processada (gatilho oportunista)
  - Acionamento manual pelo admin
- Quando a fatura chega, alimenta: histórico de consumo, estatísticas energia compensada × contratada, dashboards, auditoria ANEEL
- Queda do pipeline IMAP **não bloqueia** faturamento

**CREDITOS_COMPENSADOS**: pipeline é **obrigatório para cobrança**.
- Cobrança depende de `kwhCompensado` que vem da fatura processada
- Sem fatura processada no mês → sem cobrança
- Fallback: admin faz upload manual da fatura (ver Seção 2.7.2)

**CREDITOS_DINAMICO**: pipeline é **obrigatório para cobrança**.
- Cobrança depende de `kwhCompensado` **e** de `KWH_CHEIO_mes` reconstruído
- Sem fatura processada no mês → sem cobrança
- Fallback: admin faz upload manual da fatura

### 11.6. Unique constraint — proteção contra duplicatas

⚠️ **Gap conhecido, Sprint 7** (tarefa 4 do backlog).

Hoje não há constraint única em `FaturaProcessada (ucId, mesReferencia, cooperativaId)`. Se o mesmo email chega duas vezes (por qualquer razão — reenvio, retry manual, bug), sistema cria duas `FaturaProcessada`. A segunda pode virar uma segunda cobrança, duplicando o valor cobrado do cooperado.

Mitigação atual (parcial):
- Match por `messageId` do IMAP antes de processar (previne mesma mensagem duas vezes)
- Lock por pasta IMAP durante execução do cron (previne duas execuções concorrentes)

Protege contra o caso comum, mas não contra todos. Sprint 7 adiciona constraint dura no schema.

### 11.7. Gaps conhecidos e divisão em sprints

| Gap | Descrição | Sprint |
|---|---|---|
| `uc.numeroUC → uc.numero` | 2 linhas em email-monitor.service.ts (265 e 469) | 5 (tarefa 5) |
| Config IMAP via SQL | Admin precisa de dev pra ativar pipeline numa cooperativa | 7 |
| UI admin de `ConfigTenant` | Interface web pra configurar IMAP/email/admin.whatsapp | 7 |
| Retry/backoff em falha IMAP | Hoje só loga e sai; retenta no próximo cron | 7 |
| Extração de XML ANEEL | Email pode ter XML além de PDF; XML é mais preciso que OCR | 7 |
| Unique constraint fatura | Prevenir duplicatas por `(ucId, mesReferencia, cooperativaId)` | 7 (tarefa 4) |
| Dead-letter queue | Mensagens que falham ficam em "Pendentes" sem processo de retry gerenciado | 7 |
| Rate limit Claude API | Sem controle de quantas chamadas OCR por minuto | 7 |

### 11.8. Hotfixes do Sprint 5

Apenas **um hotfix** no pipeline email no Sprint 5 — os outros gaps são Sprint 7:

**Tarefa 5 (tamanho XS)**: trocar `uc.numeroUC` por `uc.numero` em:
- `email-monitor.service.ts:265` — função `identificarPorOcr`
- `email-monitor.service.ts:469` — função `identificarCooperado`

**Depois do hotfix, pipeline está 100% funcional.** Só falta admin configurar `ConfigTenant` em alguma cooperativa pra começar a rodar em produção.

### 11.9. Smoke test end-to-end (Sprint 5, tarefa 9)

Antes de desligar a flag `BLOQUEIO_MODELOS_NAO_FIXO`, rodar smoke test manual:

1. Configurar `ConfigTenant` de cooperativa de teste com email válido
2. Enviar fatura teste para o email
3. Disparar cron manualmente via `POST /email-monitor/processar`
4. Verificar que `FaturaProcessada` foi criada com `statusRevisao = AUTO_APROVADO`
5. Verificar que cobrança foi gerada no contrato correto
6. Verificar que Asaas emitiu PIX/boleto
7. Verificar que cooperado recebeu WhatsApp com link

Se os 7 passos executam limpo, desligar a flag.

### 11.10. Observabilidade

`EmailLog` registra tentativas de envio/recebimento de email (genérico, não só fatura). Hoje a tabela tem 1 registro histórico — indicação de que pipeline nunca rodou em ambiente real.

Sprint 7 adiciona métricas mais ricas:
- Tempo médio de OCR
- Taxa de auto-aprovação vs revisão manual
- Falhas de identificação (3 estratégias todas sem match)
- Duplicatas detectadas

---

## 12. Estado atual e divisão em sprints

Esta seção consolida o que está implementado, o que falta, e como o trabalho foi dividido nos próximos sprints. Referência pra qualquer dúvida de escopo.

### 12.1. Linha do tempo

- **Sprint 5 (em execução — 20/04/2026):** regras de plano e cobrança corretas, motor honesto, UI em linguagem de produto, hotfixes do pipeline email
- **Sprint 6:** CooperToken completo (UI `ConfigCooperToken`, redesign plano-Token, Clube redesign, MLM por papel)
- **Sprint 7:** polish operacional (ConfigTenant UI, XML ANEEL, assinatura digital real, constraints, UI bandeiras)

Execução **sequencial**: Sprint 5 fecha antes de começar Sprint 6.

### 12.2. Escopo Sprint 5 (em execução)

**Objetivo**: sistema dimensionando contratos corretamente, cobrando conforme regras deste documento, com UI do plano em linguagem de produto e pipeline email desbloqueado.

Tarefas em ordem de execução:

| # | Tarefa | Tamanho | Camada |
|---|---|---|---|
| 0 | Criar este documento (`REGRAS-PLANOS-E-COBRANCA.md`) | M | docs |
| 1 | Schema: enum `TipoDesconto` + campo em `Plano` + snapshots no `Contrato` (`valorContrato`, `tarifaContratual`, `valorContratoPromocional`, `tarifaContratualPromocional`, `descontoPromocionalAplicado`, `mesesPromocaoAplicados`, `baseCalculoAplicado`, `tipoDescontoAplicado`) | M | backend |
| 2 | Motor de proposta: calcular Tipo II (ABATER_DA_CHEIA) no dimensionamento | M | backend |
| 3 | `aceitar()` persiste snapshots conforme modelo (FIXO→valorContrato; COMPENSADOS→tarifaContratual; todos→kwhContratoMensal, baseCalculoAplicado, tipoDescontoAplicado) | M | backend |
| 4 | Núcleo de cobrança: promoção temporal via `dataInicio` + `mesesPromocaoAplicados` + snapshots promocionais | M | backend |
| 5 | Hotfix pipeline email: `uc.numeroUC` → `uc.numero` em 2 pontos | XS | backend |
| 6 | ⚠️ Validar que gerador FIXO tem anti-duplicação por `(contratoId, competencia)` — se não tiver, adicionar | S | backend |
| 7 | UI `/dashboard/planos/novo` refatorada em linguagem de produto | M | frontend |
| 8 | Testes: Tipo II, promoção temporal, aceitar() com snapshots, FIXO com 2 valores | M | testes |
| 9 | Desligar `BLOQUEIO_MODELOS_NAO_FIXO` + smoke test end-to-end | S | sistema |

**Hotfix já aplicado antes do sprint começar:**
- Commit `2c745e9` (20/04/2026): `cooperativaId` passa a ser preenchido no `aceitar()` do motor de proposta

### 12.3. Escopo Sprint 6 (próximo)

**Objetivo**: CooperToken operacional — cooperativas conseguem configurar e ativar Token pela UI sem intervenção manual.

Tarefas previstas:

| # | Tarefa | Tamanho |
|---|---|---|
| 1 | UI `/dashboard/cooperativa/configuracao-token` — cria/edita `ConfigCooperToken` | M |
| 2 | UI do plano: seção Token redesenhada (toggle + subcampos condicionais com linguagem clara) | M |
| 3 | Validação de coerência: plano com Token ativo exige `ConfigCooperToken` da cooperativa | S |
| 4 | Redesign Clube de Vantagens: cadastrar parceiro vs criar oferta | M |
| 5 | MLM por papel: `Hangar → Professor ≠ Professor → Aluno` (diferenciação além do nível numérico) | M |
| 6 | Painel Agregador: `TipoCooperado.AGREGADOR` ganha interface de gestão da rede MLM | M |
| 7 | Relatório de rede por origem (todos os cooperados que vieram de X agregador) | S |
| 8 | Testes Token end-to-end: adesão → emissão Opção B → gasto no Clube + abater fatura → ledger consistente | M |

Total estimado: 1-2 semanas.

### 12.4. Escopo Sprint 7 (depois)

**Objetivo**: fechar débitos operacionais e blindagens finais.

Tarefas previstas:

| # | Tarefa | Tamanho |
|---|---|---|
| 1 | UI admin de `ConfigTenant` (IMAP, email, admin.whatsapp) | M |
| 2 | Pipeline email: retry/backoff em falhas IMAP, rate limit Claude API | S |
| 3 | Pipeline email: extração de XML ANEEL quando presente (além do PDF) | M |
| 4 | Unique constraint `FaturaProcessada (ucId, mesReferencia, cooperativaId)` | S |
| 5 | Assinatura digital real (D4Sign ou ClickSign) — hoje é só timestamp + nome | L |
| 6 | UI admin de bandeiras (política `DECIDIR_MENSAL`) | M |
| 7 | Remoção de campos @deprecated do schema (`bandeiraAtiva`, `bandeiraSincronizacaoAuto`) | S |
| 8 | Fixar 3 specs quebrados pré-existentes em `UsinasService` | S |
| 9 | Dead-letter queue para mensagens IMAP que falham | S |

Total estimado: 2 semanas.

### 12.5. Tarefas que NÃO entram em nenhum sprint

Lista de débitos conhecidos mas intencionalmente não priorizados:

- **Rebalanceamento de usinas** (backlog P2) — algoritmo que combina sobras de 2-3 usinas pra encaixar cooperado. Exige aprovação explícita do admin (nunca automático).
- **Lista por usina pra concessionária** (backlog P2) — gerar lista atualizada por usina quando houver alocação/rebalanceamento aprovado.
- **Desconto maior por indicação** (backlog P2) — quando cadastro vem com `?ref=CODIGO`, aplicar desconto maior pro indicador em CooperToken.
- **Idempotência `BONUS_INDICACAO` sem cooperativaId** (backlog P2) — hoje pode creditar token cross-tenant em caso raro.
- **`BUG-CALCULO-001`** — três implementações divergentes de multa/juros no sistema. Precisa consolidação.
- **3 crons competindo às 6h** — `apurarExcedentes`, `verificarEmails`, `notificarCobrancas` disputam recursos.
- **CORS whatsapp-service** — porta 3002 sem autenticação no endpoint `/reconnect`.

Esses entram em sprint futuro conforme priorização.

### 12.6. Estado consolidado por subsistema

**Regras de plano e cobrança:**
- ✅ Modelo mental dos 3 modelos correto e documentado
- ✅ Fórmula KWH_CHEIO validada nos 2 contextos
- ✅ ICMS não duplica (pegadinha documentada)
- ⚠️ Motor atual não implementa Tipo II — **Sprint 5 corrige**
- ⚠️ Promoção temporal é dead code — **Sprint 5 corrige**
- ⚠️ Snapshots no Contrato incompletos — **Sprint 5 corrige**
- ⚠️ UI do plano em jargão técnico — **Sprint 5 corrige**

**CooperToken:**
- ✅ Infra completa: 5 tabelas, 1641 linhas de service, 25 métodos
- ✅ Enums e modelos sólidos
- ✅ UIs de admin, parceiro e portal cooperado existem
- ⚠️ Inerte nos dados: 0 cooperativas configuraram, 6 registros no ledger
- ⚠️ Sem UI clara de `ConfigCooperToken` — **Sprint 6 cria**
- ⚠️ Sem validação de coerência plano ↔ config — **Sprint 6 adiciona**

**Pipeline Email → OCR → Cobrança:**
- ✅ IMAP fetch funcional
- ✅ OCR via Claude API funcional
- ✅ Factory `FaturaProcessada` com guard auto-aprovação
- ✅ Notificação WhatsApp admin
- ⚠️ 2 bugs de `uc.numeroUC` → `uc.numero` — **Sprint 5 corrige**
- ⚠️ Geração de cobrança bloqueada por flag — **Sprint 5 desliga**
- ⚠️ Nenhuma cooperativa tem ConfigTenant IMAP configurado — **setup operacional, Sprint 7 cria UI**

**Motor de Proposta:**
- ✅ Cálculo de proposta com dimensionamento funcional
- ✅ PDF gerado, link de aprovação por token
- ✅ `aceitar()` preenche `cooperativaId` (hotfix Sprint 5)
- ⚠️ `aceitar()` não persiste snapshots por modelo — **Sprint 5 corrige**
- ⚠️ Assinatura digital é placeholder — **Sprint 7 integra D4Sign/ClickSign**

### 12.7. Metas operacionais pós Sprint 5

Após Sprint 5 fechar, cooperativa deve conseguir:

1. Criar plano pela UI sem pedir ajuda do dev (linguagem de produto)
2. Oferecer planos FIXO, COMPENSADOS e DINAMICO sem bloqueio
3. Anunciar "desconto sobre total" ou "desconto sobre energia" honesto
4. Oferecer promoção temporal real ("30% nos 3 primeiros meses")
5. Receber fatura por email, OCR automaticamente, cobrança gerada
6. Admin revisar casos ambíguos na Central de Faturas

Se essas 6 capacidades estão operacionais ao fim do Sprint 5, missão cumprida.

### 12.8. Revisão deste documento

Este documento é **vivo**. Atualizar sempre que:
- Sprint termina com mudança estrutural
- Regra de negócio é ajustada
- Novo modelo de cobrança ou novo tipo de desconto é introduzido
- Pipeline ganha nova integração

Próxima revisão agendada: **fim do Sprint 5** (atualizar estado consolidado e mover tarefas de "em execução" pra "concluídas").

---

_Documento produzido em sessão de 20/04/2026. Referência: `docs/sessoes/2026-04-20-decisoes-sprint5.md`._
