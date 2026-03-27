# Proposta Técnica: GD1, GD2 e Cobrança do Fio B
**CoopereBR — Adequação Regulatória à Resolução ANEEL 1000/2021 e ao Marco Legal da GD**
**Data:** 26/03/2026 | **Autor:** Assis

---

## 1. Contexto Regulatório

### GD1 (Micro e Minigeração — até 2 MW)
Enquadramento pela **Resolução Normativa ANEEL 1000/2021**, que consolidou a RN 482/2012 e RN 687/2015.
- Funciona por sistema de **compensação de energia** (net metering)
- Cooperado injeta energia → recebe créditos em kWh → abate na próxima fatura
- Isenção de encargos sobre a energia compensada até certo limite

### GD2 (Geração Compartilhada / Autoconsumo Remoto — acima de 2 MW ou empreendimentos compartilhados)
- Cooperativas de GD se enquadram aqui (autoconsumo remoto)
- Créditos distribuídos entre os participantes pela cooperativa
- Mesma lógica de compensação, mas com **rateio entre múltiplos consumidores**

### Fio B (Wire B) — O ponto crítico
A partir da vigência do **Marco Legal da GD (Lei 14.300/2022)** com regras transitórias:

| Período | GD1 (até 75 kW) | GD1 (75 kW – 2 MW) | GD2 |
|---------|----------------|---------------------|-----|
| Até 2022 | 100% isento | 100% isento | 100% isento |
| 2023 | Isento | Paga 15% Fio B | Paga 15% Fio B |
| 2024 | Isento | Paga 30% Fio B | Paga 30% Fio B |
| 2025 | Isento | Paga 45% Fio B | Paga 45% Fio B |
| 2026 | Isento | Paga 60% Fio B | Paga 60% Fio B |
| 2027 | Isento | Paga 75% Fio B | Paga 75% Fio B |
| 2028 | Isento | Paga 90% Fio B | Paga 90% Fio B |
| 2029+ | Isento | Paga 100% Fio B | Paga 100% Fio B |

**O que é o Fio B?**
É a parcela da **TUSD** correspondente ao uso do sistema de distribuição (fios, transformadores, etc.). Representa tipicamente **50-70% do valor da TUSD**.

**Impacto prático para a CoopereBR:**
- As usinas arrendadas provavelmente são > 75 kW → se enquadram na tabela acima
- Em 2026, o cooperado paga 60% do Fio B sobre a energia compensada
- Isso **reduz o benefício líquido** do cooperado (ele não fica mais 100% isento)
- O sistema atual **ignora essa cobrança** — precisa ser corrigido

---

## 2. Como funciona na prática

### Cálculo atual (incorreto para 2026)
```
Economia = kWh compensado × (TUSD + TE) × desconto_cooperativa
```

### Cálculo correto (com Fio B)
```
TUSD_total = TUSD_FioA + TUSD_FioB
Fio_B_vigente = TUSD_FioB × percentual_vigente_ano   // ex: 60% em 2026
Tarifa_efetiva = TUSD_FioA + Fio_B_vigente + TE
Economia_real = kWh compensado × Tarifa_efetiva × desconto_cooperativa
```

### Diferença para o cooperado (exemplo 2026):
- TUSD total: R$ 0,45/kWh
- Fio B: ~60% da TUSD = R$ 0,27/kWh
- Fio B cobrado (60%): R$ 0,162/kWh
- TUSD "livre": R$ 0,45 - R$ 0,162 = R$ 0,288/kWh
- Tarifa efetiva: R$ 0,288 + TE (R$ 0,32) = R$ 0,608/kWh (vs R$ 0,77 sem Fio B)

---

## 3. O que precisa ser implementado

### 3.1 Schema Prisma — Atualização da TarifaConcessionaria

```prisma
model TarifaConcessionaria {
  // campos existentes...
  tusdNova        Decimal?  // TUSD total (atual)
  teNova          Decimal?  // TE (atual)
  
  // NOVOS CAMPOS:
  tusdFioA        Decimal?  @db.Decimal(10, 6)  // parcela Fio A da TUSD
  tusdFioB        Decimal?  @db.Decimal(10, 6)  // parcela Fio B da TUSD
  
  modalidadeGD    ModalidadeGD  @default(GD1_ATE_75KW)
  // Percentual do Fio B cobrado calculado automaticamente pelo ano de vigência
}

enum ModalidadeGD {
  GD1_ATE_75KW      // isento do Fio B para sempre
  GD1_ACIMA_75KW    // tabela progressiva
  GD2_COMPARTILHADO // tabela progressiva (cooperativas)
}
```

### 3.2 Tabela de percentuais do Fio B por ano (seed fixo)

```typescript
const PERCENTUAL_FIO_B = {
  2022: 0,
  2023: 15,
  2024: 30,
  2025: 45,
  2026: 60,
  2027: 75,
  2028: 90,
  2029: 100, // e anos posteriores
};
```

### 3.3 Motor de cobrança — refatorar calcularCobrancaMensal()

```typescript
// Lógica nova:
const anoCompetencia = competencia.getFullYear();
const percentualFioB = obterPercentualFioB(anoCompetencia, modalidadeGD);

const tusdFioB = Number(tarifa.tusdFioB ?? 0);
const tusdFioA = Number(tarifa.tusdFioA ?? tarifa.tusdNova ?? 0) - tusdFioB;
const fioB_cobrado = tusdFioB * (percentualFioB / 100);
const tarifaEfetiva = tusdFioA + fioB_cobrado + Number(tarifa.teNova);

const valorBruto = kwhEntregue * tarifaEfetiva;
// ...resto igual
```

### 3.4 Breakdown na cobrança (para transparência)

Cada cobrança deve mostrar:
- kWh entregue
- Tarifa total (TUSD + TE)
- Fio B cobrado (R$/kWh e %)
- Valor bruto antes do Fio B
- Desconto da cooperativa
- **Valor líquido final**
- Comparativo: "Sem a CoopereBR você pagaria R$ X. Com a CoopereBR, paga R$ Y."

### 3.5 Frontend — tela de configuração de tarifa

Adicionar campos na tela de configuração de tarifas:
- TUSD Fio A (R$/kWh)
- TUSD Fio B (R$/kWh)
- Modalidade GD (GD1 ≤75kW / GD1 >75kW / GD2)
- Campo read-only: "% Fio B cobrado em [ano atual]: X%"
- Campo read-only: "Tarifa efetiva hoje: R$ X,XX/kWh"

### 3.6 Relatório de impacto

Para cada cooperativa, gerar relatório mostrando:
- Qual a modalidade de cada usina (GD1/GD2)
- Quanto o cooperado economiza mesmo com o Fio B
- Projeção de economia para os próximos anos (2026-2029)
- Alerta se a cooperativa está enquadrando usinas na modalidade errada

---

## 4. Impacto nas usinas da CoopereBR

Considerando que as 3 usinas arrendadas provavelmente têm > 75 kW:
- Todas se enquadram na tabela progressiva do Fio B
- Em 2026: cooperado paga 60% do Fio B sobre a energia compensada
- Em 2029: pagará 100% do Fio B → benefício menor, mas ainda vale a pena

**A cooperativa ainda tem vantagem** porque:
1. O desconto oferecido (ex: 20%) ainda supera o custo do Fio B em muitos casos
2. O cooperado continua pagando menos que sem a cooperativa
3. A transparência sobre o Fio B na fatura aumenta a confiança do cooperado

---

## 5. Cronograma estimado

| Fase | Escopo | Estimativa |
|------|--------|-----------|
| A | Schema + seed percentuais Fio B + refatorar motor de cálculo | 1 dia |
| B | Breakdown na fatura + tela de configuração de tarifa | 1 dia |
| C | Relatório de impacto + projeção futura | 1 dia |

**Total: 3 dias**

---

## 6. Ação imediata recomendada

1. Verificar com o contador/jurídico qual a modalidade exata de cada usina (GD1 >75kW ou GD2)
2. Obter da distribuidora (EDP-ES) os valores separados de Fio A e Fio B na TUSD
3. Aprovar este relatório e executar as 3 fases

---
*Documento gerado por Assis — aguardando aprovação para execução*
