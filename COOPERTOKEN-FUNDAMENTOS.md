# CooperToken — Fundamentos, Modelo Econômico e Natureza Jurídica

**Data:** 02/04/2026 | **Autor:** Assis + Luciano
**Status:** Aprovado — aguardando implementação técnica

---

## 1. Natureza Jurídica

### 1.1 O CooperToken é um Ato Cooperativo

O CooperToken **não é**:
- Compra e venda (não há transferência de propriedade de bem)
- Prestação de serviço (não há contrato de serviço, não incide ISS)
- Moeda eletrônica (não é instrumento de pagamento financeiro)
- Título ou valor mobiliário

O CooperToken **é**:
- A representação digital escritural de um crédito de energia distribuído pela cooperativa aos seus cooperados
- Um **ato cooperativo** amparado pela Lei 5.764/71 (Lei das Cooperativas)
- A extensão natural do objeto social da cooperativa (distribuição de créditos de energia)

### 1.2 Fundamento Legal

A Lei 5.764/71 define que o ato cooperativo é praticado entre:
- Cooperativa e seus associados
- Entre cooperativas
- Para consecução dos objetivos sociais

**O ato cooperativo não gera fato gerador de tributos:**
- Não incide PIS/COFINS
- Não incide ICMS
- Não incide ISS

### 1.3 Condição essencial: parceiro precisa ser cooperado

Para que a circulação de tokens entre cooperado e parceiro (ex: restaurante) mantenha a natureza de ato cooperativo, **o parceiro precisa ser associado da cooperativa** (cooperado empresarial).

Se o parceiro for externo (não cooperado), o ato passa a ser mercantil e incide ISS/ICMS.

**Consequência estratégica:** o clube cria incentivo natural para empresas se tornarem cooperadas — acesso à rede de tokens e clientes cooperados.

---

## 2. Premissa Correta — Quem Gera os Tokens

### 2.1 A usina gera energia, não o cooperado

- Quem gera energia é a **usina** (arrendada pela cooperativa)
- A cooperativa recebe os créditos de energia e os distribui aos cooperados
- O cooperado **não gera** energia — ele recebe créditos que a cooperativa indica à concessionária

### 2.2 Origem do token — duas fontes

**Fonte 1 — Conversão da mensalidade (Opção B):**
O cooperado paga o valor integral (sem desconto) e recebe tokens equivalentes ao desconto que abriria mão.
```
Cooperado paga R$ 1.000 (cheio)
  → Recebe 800 kWh compensados na fatura
  → Recebe 200 tokens (equivalente ao desconto de 20%)
```

**Fonte 2 — Saldo escritural da cooperativa:**
Os 200 tokens vêm contabilmente do saldo de kWh que a cooperativa possui mas não consegue transferir diretamente (saldo acumulado, hoje ~600.000 kWh na CoopereBR).
```
600.000 kWh parados no saldo escritural
  → Cooperativa não pode transferir em dinheiro nem em crédito
  → Convertidos em tokens conforme demanda da Opção B
  → Saldo que expiraria a R$ 0 passa a ter valor
```

---

## 3. Modelo Econômico

### 3.1 O ciclo completo

```
USINA gera energia
  └── CoopereBR distribui créditos
       └── Cooperado ESCOLHE:
            ├── Opção A: desconto 20% → paga R$ 800 (cooperativa desembolsa R$ 200)
            └── Opção B: paga R$ 1.000 e recebe 200 tokens
                         └── Tokens circulam no Clube
```

### 3.2 Ganho real para a cooperativa

| | Sem clube | Com clube (Opção B) |
|---|---|---|
| Recebe do cooperado | R$ 800 | R$ 1.000 |
| kWh do saldo usados | 0 | 200 kWh |
| **Diferença de caixa** | — | **+R$ 200** |

A cooperativa captura R$ 200 que antes "dava" de desconto. Esses R$ 200 são o valor real dos kWh do saldo que antes expirariam a R$ 0.

### 3.3 Remuneração do saldo para o dono da usina

Os kWh do saldo escritural que viram tokens representam energia que o dono da usina não recebeu. Com o clube, esse saldo passa a ter valor — parte deve ser repassada ao dono da usina conforme contrato de arrendamento.

**Split proposto da captura de R$ 200:**
- 50% → dono da usina (R$ 100) — pelos kWh do saldo que antes expirariam
- 30% → cooperativa (R$ 60) — operação e clube
- 20% → SISGD + Fundo Clube (R$ 40)

### 3.4 O restaurante no clube

```
Restaurante = cooperado empresarial
  └── Recebe créditos de energia (ex: 500 kWh/mês)
       └── Pode converter parte em tokens (Opção B)
            └── Oferece tokens como cashback para clientes cooperados

Cooperado João almoça (R$ 100) — duas opções:
  ├── Usa 10 tokens que tem → paga R$ 90 em dinheiro
  │     └── Restaurante recebe 10 tokens → abate na conta de energia
  └── Paga R$ 100 + recebe 10 tokens de cashback do restaurante
        └── Restaurante emite tokens do próprio saldo
             └── João usa em outro parceiro/próxima refeição
```

**O restaurante não desembolsa dinheiro** — os tokens emitidos como cashback vêm do saldo de tokens que ele mesmo acumulou (via Opção B dos próprios créditos de energia).

### 3.5 Regra anti-inflação

O restaurante **só pode emitir tokens se tiver saldo**. A cooperativa é a única fonte de emissão primária — via Opção B do cooperado/parceiro. Ninguém cria token do nada.

```
Emissão primária: SOMENTE pela cooperativa via Opção B
Circulação: entre cooperados (ato cooperativo)
Liquidação: parceiro abate tokens na conta de energia
```

### 3.6 Receita em 3 momentos

| Evento | Taxa | SISGD | Cooperativa | Clube |
|---|---|---|---|---|
| Emissão (Opção B) | 2% dos tokens | 1% | — | 1% |
| Circulação entre cooperados | 1% da transação | 0,4% | 0,4% | 0,2% |
| Expiração (tokens não usados) | 100% do saldo | 30% | 40% | 30% |

---

## 4. Validade e Desvalorização

### 4.1 Ciclo de 29 dias

Alinhado ao ciclo de faturamento da energia. Cada emissão tem sua própria data de expiração (FIFO na liquidação).

### 4.2 Desvalorização progressiva

Configurável pelo SISGD e admin do parceiro:

```
Dia  1-10:  100% (1 token = 1 kWh)
Dia 11-20:   90% (1 token = 0,9 kWh)
Dia 21-26:   75% (1 token = 0,75 kWh)
Dia 27-29:   50% (1 token = 0,5 kWh)
Dia 30:      expira → vira receita do Fundo Clube
```

**Por que isso é inteligente:**
- Cria urgência de circulação → mais transações
- Tokens que expiram viram receita pura
- Não acumula passivo indefinido para a cooperativa
- Incentiva usar rápido → mais circulação → mais rede

---

## 5. Potencial do Saldo CoopereBR

| Cenário | kWh convertidos | Caixa capturado | Para dono usinas (50%) |
|---|---|---|---|
| Gradual (20k/mês) | 20.000/mês | R$ 20.000/mês | R$ 10.000/mês |
| 6 meses | 120.000 | R$ 120.000 | R$ 60.000 |
| Total (30 meses) | 600.000 | R$ 600.000 | R$ 300.000 |

Saldo de 600k kWh que expiraria a R$ 0 → gera R$ 300k para donos de usinas + R$ 300k para cooperativa/SISGD/clube.

---

## 6. Escalabilidade

Com 100 cooperados fazendo Opção B (média 200 tokens/mês):

| | Por mês | Com expiração (50%) |
|---|---|---|
| SISGD | R$ 192 | R$ 1.344 |
| Cooperativa | R$ 12.112 | R$ 13.648 |
| Clube | R$ 176 | R$ 1.328 |

Com 500 cooperados:

| | Por mês |
|---|---|
| SISGD | R$ 960 → R$ 6.720 |
| Cooperativa | R$ 60.560 → R$ 68.240 |
| Clube | R$ 880 → R$ 6.640 |

---

## 7. Diferencial Competitivo

> **"Não é um cashback. Não é um programa de pontos. É um benefício cooperativo — você circula energia entre cooperados."**

- Cooperado residencial: paga menos na conta de energia
- Cooperado empresarial: fideliza clientes cooperados sem desembolso de caixa
- Parceiro do clube: atrai cliente cooperado sem custo de marketing
- Cooperativa: melhora fluxo de caixa + fideliza cooperados + monetiza saldo parado
- SISGD: monetiza cada transação do ecossistema
- Dono da usina: recebe por kWh que antes expirariam sem valor
- Investidor futuro: compra tokens para financiar usinas e recebe rendimento em tokens

---

## 8. Pendências para Implementação Técnica

- [ ] Adicionar campo `desvalorizacao` (JSON com tabela dia→percentual) ao schema
- [ ] Lógica de cálculo de valor do token no momento da transação (considerando dia de emissão)
- [ ] Mecanismo de split automático na emissão (2%) e circulação (1%)
- [ ] Contrato de arrendamento: cláusula de receita de saldo (50% para dono)
- [ ] Regra: parceiro do clube obrigatoriamente cooperado
- [ ] Tela de configuração de desvalorização (SISGD e admin parceiro)
- [ ] Relatório de saldo escritural convertido vs expirado

---

## 9. Fundo Cooperativo de Fomento Solar (FCFS)

### 9.1 Nome e natureza jurídica

**Nome oficial:** Fundo Cooperativo de Fomento Solar (FCFS)

- Fundo interno da cooperativa, regido pela **Lei 5.764/71**
- **NÃO** é fundo de investimento regulado pela CVM
- É uma conta de destinação de sobras/contribuições para fins específicos do objeto social
- **Finalidade:** financiamento de novas usinas, aquisição de carregadores veiculares elétricos, expansão da infraestrutura de GD
- Prestação de contas anual em assembleia (obrigação legal das cooperativas)

### 9.2 Como funciona

O cooperado contribui voluntariamente ao FCFS além da Opção B e recebe tokens proporcionais:

```
Cooperado contribui R$ X ao FCFS
  → Recebe tokens com desconto configurável (vêm do saldo escritural)
  → Dinheiro vai para conta segregada do FCFS
  → FCFS financia: novas usinas, carregadores veiculares, infraestrutura GD
  → Cooperado usa tokens no clube em 29 dias
```

### 9.3 Diferença da Opção B

| | Opção B | Contribuição ao FCFS |
|---|---|---|
| Origem | Desconto que o cooperado já tinha direito | Dinheiro novo voluntário |
| Natureza | Compensação de ato cooperativo | Contribuição ao fundo cooperativo |
| Destino do dinheiro | Caixa da cooperativa | FCFS (segregado contabilmente) |
| Tokens recebidos | Equivalente ao desconto | Equivalente à contribuição + desconto |

### 9.4 Tudo configurável pelo admin da cooperativa

**Desconto por faixa:** admin define livremente
- Ex: até 500 tokens = 10%, 501-2.000 = 20%, 2.001+ = 30%

**Teto mensal por cooperado:** configurável
- Evita que um cooperado esvazie o saldo de uma vez

**Split de receita:** 100% configurável pelo admin
- Admin define % para: SISGD / Cooperativa / FCFS / Dono da usina
- Sugestão padrão (editável pelo admin):
  - FCFS: 50%
  - Cooperativa (operação): 20%
  - Dono da usina: 20%
  - SISGD: 10%

### 9.5 Exemplo prático

```
João contribui R$ 500 ao FCFS
Admin configurou: desconto 20%, split padrão

→ João recebe 625 tokens (R$0,80/kWh com 20% de desconto = R$0,64/token → 500/0,64 = 781 tokens)
→ R$500 entram no FCFS contabilmente
→ Split: R$250 FCFS / R$100 cooperativa / R$100 dono usina / R$50 SISGD
→ João usa 625 tokens no clube em 29 dias
→ Cada circulação gera mais 1% de receita
```

### 9.6 Porta para investidores — fase futura

O FCFS cria o caminho natural para captação de investidores dentro do marco cooperativo:
- Cooperados contribuem ao fundo e recebem tokens + participação nas usinas financiadas
- Modelo: contribuição → tokens → usina construída → mais créditos → mais tokens para todos
- Tudo dentro da Lei 5.764/71 — sem necessidade de registro na CVM

### 9.7 Pendências adicionais para implementação

- [ ] Conta FCFS no Plano de Contas (tipo: Fundo de Destinação Específica)
- [ ] Tela de configuração: desconto por faixa, teto mensal, split customizável
- [ ] Relatório do FCFS: entradas, saídas, saldo, destino dos recursos
- [ ] Integração com módulo de Usinas: vincular aporte do FCFS a usinas financiadas
- [ ] Fluxo de contribuição no portal do cooperado

---

*Documento gerado em sessão de 02/04/2026 — Luciano + Assis*
