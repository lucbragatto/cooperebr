# Decisões Sprint 5 — Regras de Plano e Cobrança
> Resumo para continuidade. Gerado em 20/04/2026 ao fim da sessão.
> Objetivo da próxima sessão: produzir `docs/referencia/REGRAS-PLANOS-E-COBRANCA.md` definitivo.

## Contexto

Sessão de 20/04 foi dedicada a levantar regras corretas de plano/cobrança antes de refatorar UI
e motor. Documentação antiga (`FORMULAS-COBRANCA.md`) está desatualizada e com erros
conceituais. Houve 3 iterações errando matemática de ICMS antes de chegar à fórmula correta,
então atenção redobrada com o ponto 6 abaixo.

## Escopo decidido: A2 (UI + Motor)

- Sprint 5 inclui: refactor UI em linguagem de produto + motor cobrança Tipo I e Tipo II +
  promoção temporal + hotfixes do pipeline email
- Sprint 6: CooperToken completo (UI de ConfigCooperToken, redesign plano-Token, Clube
  redesign, MLM benefício por nível)
- Sprint 7: polish (ConfigTenant UI, XML EDP, assinatura digital, unique constraint fatura,
  UI bandeiras)
- Execução sequencial: Sprint 5 fecha antes de começar Sprint 6

## Decisões fechadas

### 1. Modelo mental unificado dos três modelos

Os 3 modelos (FIXO_MENSAL, CREDITOS_COMPENSADOS, CREDITOS_DINAMICO) fazem o **mesmo dimensionamento
inicial**. A diferença é **o que fica congelado** após o dimensionamento.

| Modelo | Congela | Recalcula mensalmente |
|---|---|---|
| FIXO_MENSAL | `valorContrato` inteiro | Nada |
| CREDITOS_COMPENSADOS | `tarifaContratual` | `kwhCompensado` da fatura |
| CREDITOS_DINAMICO | Só `percentualDesconto` (+ baseCalculo + tipoDesconto) | Tarifa e kWh reapurados |

### 2. Tipos de desconto (tipoDesconto)

Ortogonal a `baseCalculo`. Admin escolhe:

- **APLICAR_SOBRE_BASE** — desconto sobre a base escolhida. `tarifaContratada = base × (1 − desc)`
- **ABATER_DA_CHEIA** — desconto calcula sobre a base, mas abate da KWH_CHEIO. `tarifaContratada = KWH_CHEIO − (base × desc)`

Tipo I (APLICAR_SOBRE_BASE) = admin honesto, desconto % = economia % efetiva.
Tipo II (ABATER_DA_CHEIA) = **padrão do mercado GD brasileiro**. Anuncia "20% de desconto" mas
cooperado economiza 13-15% efetivo.

Aplicável aos 3 modelos. Sempre abate de KWH_CHEIO (não de meio-termo).

### 3. Base de cálculo (baseCalculo)

Quatro valores possíveis:

| Valor | Cálculo da tarifa base |
|---|---|
| KWH_CHEIO | `valorSemCooperativa / consumoBruto` |
| SEM_TRIBUTO | Tarifa ANEEL: `tarifaUnitTUSD + tarifaUnitTE` |
| COM_ICMS | TUSD + TE + ICMS proporcional |
| CUSTOM | Soma de componentes em `componentesCustom[]` |

UI v1 esconde `COM_ICMS` e `CUSTOM` (pouco uso, complicariam a interface). Admin que precisar
configura via API. Ficam no schema e DTO.

### 4. Fórmula KWH_CHEIO nos dois contextos

**Contexto 1 — fatura limpa (dimensionamento de novo cooperado sem GD):**
```
KWH_CHEIO = totalFatura / consumoBruto
```
Exemplo: fatura Condomínio Moradas da Enseada MAR/2026 → 1.235,93 / 1.131 = **R$ 1,0928/kWh**

Admin deve exigir fatura limpa na captação (sem créditos injetados).
Se cooperado vinha de outra GD, admin pede fatura da concessionária E da concorrente para
calcular individualmente.

**Contexto 2 — fatura com créditos (cálculo DINAMICO mensal):**
```
valorSemCooperativa = soma das linhas "Fornecida" (coluna Valor Total R$)
                    + CIP
                    + bandeira (se houver)

KWH_CHEIO = valorSemCooperativa / consumoBruto
```
Exemplo: fatura Luciano MAR/2026 → 1.134,92 / 1.088 = **R$ 1,0431/kWh**

Ignora linhas "En. At. Inj." (créditos injetados).

### 5. Referência de valor (referenciaValor)

Define `kwhBase` no dimensionamento inicial:

- `ULTIMA_FATURA` → consumo bruto da fatura mais recente
- `MEDIA_3M` → média dos 3 últimos meses
- `MEDIA_12M` → média dos 12 últimos meses

UI v1 esconde `MEDIA_6M` (redundante com 3 e 12).

### 6. ⚠️ CUIDADO CRÍTICO — ICMS não duplica

Na fatura EDP:

- Coluna **"Preço Unit. (R$) com Tributos"** → já tem ICMS embutido por dentro
- Coluna **"Valor Total R$"** = `kWh × "com Tributos"` — já inclui ICMS (NÃO inclui PIS/COFINS)
- Coluna **"ICMS (R$)"** → valor do ICMS, mas já dentro do "Valor Total R$"
- Coluna **"Tarifa Unit (R$)"** → tarifa ANEEL pura, SEM ICMS, SEM PIS/COFINS
- Colunas **"PIS/COFINS"** (no bloco direito) → informativas, mostram valores mas **não somam**
  ao "Valor Total R$"

**Na validação prática** (fatura condomínio limpa):
```
TUSD (682,25) + TE (466,85) + CIP (86,83) = 1.235,93 = TOTAL
```
Bate exato. Confirma: "Valor Total R$" das linhas já tem tudo que vai pro total, exceto CIP
que é somada separada.

**Erro comum (cometido 3x nesta sessão):** somar "ICMS (R$)" ou "PIS/COFINS" como se fossem
adicionais ao "Valor Total R$". Isso duplica tributos. Fórmula correta **não soma esses campos
separadamente**.

### 7. Promoção temporal (descontoPromocional + mesesPromocao)

Implementar no Sprint 5. Núcleo de cobrança lê `Contrato.dataInicio` + `mesesPromocao`, escolhe
desconto:

```
mesesDesdeAdesao = (dataCobranca − contrato.dataInicio) em meses
descontoAtivo = mesesDesdeAdesao < mesesPromocaoAplicados
              ? descontoPromocionalAplicado
              : percentualDesconto
```

Snapshots novos no `Contrato` pra não depender do plano (plano pode mudar):
- `Contrato.descontoPromocionalAplicado` (Decimal, nullable)
- `Contrato.mesesPromocaoAplicados` (Int, nullable)

**FIXO_MENSAL com promoção**: persistir DOIS valores (`valorContrato` + `valorContratoPromocional`),
trocar após N meses. Alternativa (FIXO não suporta promoção) foi rejeitada por limitar UX.

### 8. DINAMICO: regras específicas

- Usa **sempre KWH_CHEIO reconstruído (Contexto 2)** todo mês, ignorando o que admin configurou
  em `baseCalculo` do plano
- Mas admin pode **configurar baseCalculo e tipoDesconto** no plano (não travados na UI):
  diferentes combinações produzem resultados diferentes
- Combinações válidas e sentido de negócio:

| tipoDesconto | baseCalculo | Sentido |
|---|---|---|
| APLICAR_SOBRE_BASE | KWH_CHEIO | ✅ honesto, 20% = 20% economia |
| ABATER_DA_CHEIA | SEM_TRIBUTO | ✅ padrão do mercado GD |
| APLICAR_SOBRE_BASE | SEM_TRIBUTO | Estranho, cooperado pagaria só TUSD+TE |
| ABATER_DA_CHEIA | KWH_CHEIO | Matematicamente igual a APLICAR_SOBRE_BASE+KWH_CHEIO |

No DINAMICO, dimensionamento inicial só calcula `kwhContrato` (pra alocar % da usina). Não
congela tarifa nem valor.

### 9. Hotfix de `cooperativaId` no aceitar() — JÁ APLICADO

Commit `2c745e9` (20/04/2026). Motor de proposta agora preenche `cooperativaId` no contrato
criado via `aceitar()`. Resolve bomba latente que detonaria ao desligar flag.

### 10. CooperToken — subsistema econômico paralelo

Sistema maduro no código (1641 linhas, 25 métodos, 5 tabelas), zerado nos dados (0 planos
ativos, 0 cooperativas configuradas). Três fluxos de valor:

- **Conversão**: cooperado com plano Token-ativo escolhe "desconto direto (A)" ou
  "pagar cheio + receber tokens (B)"
- **Gasto**: abater na própria fatura OU usar com parceiros do Clube
- **MLM**: indicações multinível creditam tokens ao indicador

No Sprint 5, Token não sofre mudança — toggle `cooperTokenAtivo` no plano mantém comportamento
atual. Redesign completo é Sprint 6.

No documento canônico, incluir seção explicativa sobre Token (conceito + 3 fluxos + estrutura
+ estado + gaps + interação com cobrança) para servir de base ao Sprint 6.

### 11. Pipeline Email → OCR → Cobrança

Estado: 85% pronto.

Funcional hoje:
- IMAP fetch (ImapFlow, multi-tenant via ConfigTenant, cron diário 6h)
- Match cooperado por email remetente + match CPF no OCR
- OCR via Claude API (claude-sonnet-4-20250514)
- Factory FaturaProcessada (Sprint 5)
- Auto-aprovação com guard (Sprint 5)
- Notificação admin via WhatsApp

Broken (hotfix no Sprint 5):
- `identificarPorOcr` (linha 265) busca `uc.numeroUC` em vez de `uc.numero`
- `identificarCooperado` (linha 469) mesmo bug

Bloqueado:
- Geração de cobrança (flag BLOQUEIO_MODELOS_NAO_FIXO + FIXO sem valorContrato)

Não implementado (Sprint 7):
- XML da EDP (hoje só PDF+OCR)
- UI de ConfigTenant IMAP (hoje requer SQL direto)
- Retry/backoff em falha IMAP

## Tarefas Sprint 5 (em ordem de execução)

| # | Tarefa | Tamanho | Status |
|---|---|---|---|
| 0 | Criar documento canônico `docs/referencia/REGRAS-PLANOS-E-COBRANCA.md` | M | **PRIMEIRO** |
| 1 | Schema: `tipoDesconto` enum + campo em `Plano` + snapshots em `Contrato` | M | |
| 2 | Motor de proposta: calcular Tipo II no dimensionamento | M | |
| 3 | `aceitar()` persiste snapshots por modelo (valorContrato/tarifaContratual/kwhContratoMensal) | M | |
| 4 | Núcleo cobrança: promoção temporal via dataInicio + mesesPromocaoAplicados | M | |
| 5 | Hotfix pipeline email: `uc.numeroUC` → `uc.numero` (linhas 265 e 469) | XS | |
| 6 | UI `/dashboard/planos/novo` em linguagem de produto | M | |
| 7 | Testes Tipo II, promoção temporal, aceitar() com snapshots | M | |
| 8 | Desligar BLOQUEIO_MODELOS_NAO_FIXO + smoke test end-to-end | S | |

## Fatura de referência para exemplos numéricos

**Fatura Condomínio Moradas da Enseada MAR/2026 (contexto 1 — fatura limpa):**
- UC: 0.000.944.225.054-57
- 1.131 kWh, 29 dias, bandeira verde
- TUSD Consumo: R$ 682,25
- TE Consumo: R$ 466,85
- CIP: R$ 86,83
- Total: R$ 1.235,93
- KWH_CHEIO = 1.235,93 / 1.131 = **R$ 1,0928/kWh**
- SEM_TRIBUTO = 0,46863 + 0,32068 = **R$ 0,78931/kWh**

**Fatura Luciano MAR/2026 (contexto 2 — com créditos):**
- UC: 0.001.421.380.054-70
- 1.088 kWh consumidos, 988 kWh compensados, 29 dias, verde
- TUSD Fornecida: R$ 656,30
- TE Fornecida: R$ 449,11
- CIP: R$ 29,51
- Total líquido: R$ 184,46 (após compensação)
- valorSemCooperativa reconstruído: 656,30 + 449,11 + 29,51 = R$ 1.134,92
- KWH_CHEIO = 1.134,92 / 1.088 = **R$ 1,0431/kWh**
- SEM_TRIBUTO = 0,46863 + 0,32068 = **R$ 0,78931/kWh**

Usar essas duas faturas nos exemplos do documento canônico. Validam a matemática sem ambiguidade.

## Objetivo da próxima sessão

1. Ler `CONTEXTO-CLAUDEAI.md`, `ARQUITETURA-RESUMO.md` e este arquivo
2. Escrever `docs/referencia/REGRAS-PLANOS-E-COBRANCA.md` **seção por seção** (10 seções
   planejadas), aguardando revisão do Luciano entre cada uma
3. Só após documento aprovado, disparar primeiro prompt pro Code (salvar o documento + commit)
4. Prosseguir com Sprint 5 na ordem acima

## Estrutura proposta do documento canônico

1. Visão do admin (linguagem de produto — "qual plano você está oferecendo?")
2. Três modelos de cobrança (dimensionamento único + congelamento diferenciado)
3. Base de cálculo (4 valores, 2 escondidos na UI v1)
4. Tipo de desconto (APLICAR_SOBRE_BASE vs ABATER_DA_CHEIA)
5. Referência de valor (ULTIMA_FATURA, MEDIA_3M, MEDIA_12M)
6. Fórmula KWH_CHEIO nos dois contextos + exemplos numéricos + ⚠️ ICMS
7. Fator de incremento
8. Promoção temporal (estrutura + FIXO com dois valores)
9. Mapeamento UI ↔ backend
10. CooperToken (conceito + 3 fluxos + estado)
11. Pipeline email (estado + gaps)
12. Estado atual e divisão Sprint 5/6/7