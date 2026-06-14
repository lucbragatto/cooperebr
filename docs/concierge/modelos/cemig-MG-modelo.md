# Modelo Auditoria CEMIG — Minas Gerais

> Catalogado em 14/06/2026 a partir da fatura **Marco Aurelio Almeida de Oliveira**,
> UC 1.364.690.018-71, Aimorés/MG, mês ref MAI/2026, vencimento 04/06/2026.

Este documento serve de **referência canônica** pra como ler faturas CEMIG e
aplicar os detectores tributários Concierge no estado de Minas Gerais.

## 1. Layout da fatura CEMIG (Grupo B convencional)

### 1.1 Cabeçalho
- "Documento Auxiliar da Nota Fiscal de Energia Elétrica Eletrônica"
- CNPJ CEMIG Distribuição: 06.981.180/0001-16
- Inscrição Estadual: 062.323.594.0087
- Av. Barbacena 1200, 1º andar, Ala 1, Barrio Santo Agostinho, Belo Horizonte/MG

### 1.2 Identificação
- Titular nome
- Endereço da instalação
- CPF/CNPJ
- **Nº da UC**: padrão "X.XXX.XXX.XXX-XX" (15 dígitos com pontuação) — **diferente do EDP_ES** (10 dígitos)
- Mês ref / Vencimento / Valor a pagar / Nota fiscal / Data emissão

### 1.3 Classe / Subclasse / Modalidade
- Classe: Residencial, Comercial, Industrial, Rural, Poder Público, Iluminação Pública
- Subclasse: detalha (ex: "Comercial Trifásico" pra GD)
- Modalidade Tarifária: Convencional B1/B2/B3 (Grupo B) ou Verde/Azul/Branca (A)

### 1.4 Período de leitura
- Anterior / Atual / Nº de dias / Próxima

### 1.5 Tabela "Valores Faturados"

Colunas: **Itens da fatura | Unid | Quant | Preço Unit R$ | Valor R$ | PIS/COFINS | Base Calc ICMS | Alíq ICMS | ICMS | Tarifa Unit**

Rubricas típicas em UC com SCEE:
1. **Energia Elétrica** — kWh efetivamente consumidos (descontada compensação)
2. **Energia SCEE Isenta** — kWh fornecidos via SCEE (sem PIS/COFINS, sem ICMS)
3. **Energia compensada GD I/II/III** — **valor NEGATIVO** mesma quantidade da Isenta
4. **Contrib Ilum Pública Municipal** — CIP (não tributada)
5. **Bandeira Amarela/Vermelha** — pode estar "já incluída" (verificar)
6. **Multa** / **Juros** — quando há atraso

### 1.6 "Reservado ao Fisco" (lateral direita)
- ICMS: Base × Alíquota = Valor
- PASEP: Base × Alíquota = Valor
- COFINS: Base × Alíquota = Valor

### 1.7 "Histórico do Consumo" (últimos 13 meses)
Mês/Ano | Consumo kWh | Média kWh/dia | Dias

### 1.8 "Informações Gerais"
- **SALDO ATUAL DE GERAÇÃO**: total kWh em crédito
- Resolução ANEEL aplicada (atualmente Res 3.459 de 20/05/2025)
- Bandeira do mês atual e dos últimos meses

## 2. Aplicação dos detectores Concierge em MG

### 2.1 Tema 69 STF (ICMS na base PIS/COFINS) — VERIFICAÇÃO RÁPIDA

```
base_pis_cofins = R$ X
base_icms = R$ Y
valor_icms = R$ Z

Se (Y - Z == X):
  CONFORME — CEMIG já aplica Tema 69
Se (Y == X):
  INDÉBITO — CEMIG não exclui ICMS da base PIS/COFINS
```

**Caso Marco Aurelio:**
- Base ICMS = R$ 113,77
- ICMS = R$ 20,48
- Base PIS/COFINS = R$ 93,29
- R$ 113,77 − R$ 20,48 = R$ 93,29 ✓ → **CONFORME**

### 2.2 Tese 3 (PIS/COFINS sobre SCEE) — VERIFICAÇÃO

```
Se "Energia SCEE Isenta" tem PIS/COFINS = 0
  E "Energia compensada GD" tem PIS/COFINS = 0
  → CONFORME
Caso contrário → INDÉBITO sobre os kWh compensados
```

**Caso Marco Aurelio:** ambas linhas SCEE têm PIS/COFINS = 0 → **CONFORME**

### 2.3 Tese 6 (ICMS sobre TUSD/TE em SCEE) — VERIFICAÇÃO

```
Se "Energia SCEE Isenta" tem ICMS = 0
  E "Energia compensada GD" tem Base ICMS = 0
  → CONFORME
Caso contrário → INDÉBITO sobre kWh compensados × ICMS_unit
```

**Caso Marco Aurelio:** ambas linhas SCEE têm ICMS = 0 → **CONFORME**

### 2.4 Tese 2 (ICMS sobre TUSD-G) — NÃO APLICA em Grupo B

Grupo B não tem rubrica "Demanda Geração" / "TUSD-G". Pular detector.

### 2.5 Tema 176 STF (ICMS Demanda Contratada) — NÃO APLICA em Grupo B

Mesma justificativa: Grupo B não tem demanda contratada.

### 2.6 Tese 4 (Lei GERAR rubricas excluídas) — NÃO APLICA em Grupo B

Sem DRE/ERE em Grupo B.

## 3. Estado das teses tributárias em CEMIG/MG (jun/2026)

**CEMIG aparenta estar conforme com as 3 principais teses majoritárias modernas:**
- ✅ Tema 69 — exclui ICMS da base PIS/COFINS
- ✅ Tese 3 — não tributa federal sobre energia compensada SCEE
- ✅ Tese 6 — não cobra ICMS sobre TUSD/TE na compensação SCEE

**Comparação com EDP_ES** (caso Concierge CoopereBR):
- EDP_ES aparentemente cobra → indébito alto
- CEMIG não cobra → indébito baixo

## 4. Onde olhar pra achar indébito em CEMIG

Como as teses básicas estão conformes, foco em:

### 4.1 Bandeira tarifária embutida
A fatura informa "Bandeira Amarela — Já incluído no valor a pagar".
Verificar **onde** está incluída. Se está dentro do R$ 113,77, pode ter
incidência tributária sobre adicional que deveria ser isento.

### 4.2 CIP Municipal alta
Caso Marco Aurelio: R$ 58,92 em conta de R$ 174,94 (34% do total).
CIP é definida por lei municipal e pode estar fora da faixa permitida.
Verificar **lei municipal de Aimorés/MG**.

### 4.3 Tarifa unitária × tarifa base
Preço Unit R$ 1,13781926 sobre base R$ 0,8677005 = **gross-up 31%**.
Isso embute ICMS 18% + PIS 1,25% + COFINS 5,75% por dentro.
Cálculo "por dentro" pode ter assimetria — **investigar Tese ICMS gross-up**.

### 4.4 Saldo SCEE prestes a expirar
Saldo de geração: 30.403,33 kWh. Consumo médio: ~2.500 kWh/mês.
**Cobertura: 12 meses de consumo**. Se gerado em 2021, **expira em 2026** (Lei 14.300, 60 meses).
Verificar idade dos créditos individualmente.

## 5. Modelo de adapter CEMIG (esqueleto)

Diferente do `edp-es.adapter.ts`. Padrões de classificação:

| Descrição na fatura | Tipo canônico |
|---|---|
| "Energia Elétrica" (sem qualificador) | TUSD + TE consolidado |
| "Energia SCEE Isenta" | INJECAO_SCEE (positivo) |
| "Energia compensada GD I/II/III" | INJECAO_SCEE (negativo) |
| "Adicional Bandeira (Amarela/Vermelha/Verde)" | ADICIONAL_BANDEIRA |
| "Contrib Ilum Pública" | CONTRIB_ILUM_PUBLICA |
| "Multa X%" | OUTROS |
| "Juros de mora" | OUTROS |
| "Demanda Contratada" (Grupo A) | DEMANDA_CONTRATADA |
| "Demanda Geração" (Grupo A com GD) | TUSD_G |

**Próximo passo arquitetural** quando virar sprint Concierge MG:
- Criar `backend/src/concierge/fatura-canonica/cemig.adapter.ts`
- Adicionar `CEMIG` no `DistribuidoraEnum` (já existe ✓)
- Atualizar `DetectoresRegistry` pra usar adapter por distribuidora

## 6. Catalogação dossiê CoopereBR (CemigMG)

| Tese | Caso Marco Aurelio | Aplicabilidade MG |
|---|---|---|
| Tema 69 stricto | Conforme | Geralmente conforme em MG |
| Tese 2 ICMS-TUSD-G | N/A (Grupo B) | Aplicar em UCs Grupo A com GD |
| Tese 3 PIS/COFINS SCEE | Conforme | Geralmente conforme em MG |
| Tese 4 GERAR | N/A (Grupo B) | Aplicar em UCs Grupo A |
| Tese 6 ICMS SCEE | Conforme | Geralmente conforme em MG |
| **Investigação adicional** | Bandeira embutida + CIP + gross-up | Pendente catalogar |

## 7. Próximos passos

1. **Auditar outras faturas CEMIG** pra confirmar padrão "conforme"
2. **Buscar fatura CEMIG Grupo A** com GD pra testar Tema 176 + Tese 2
3. **Investigar gross-up "por dentro"** — pode haver assimetria de ~3-5% sobre tarifa
4. **Criar adapter CEMIG** (sprint Concierge MG futura)
5. **Atualizar dossiê comercial** — distribuidoras MG têm potencial Concierge MENOR que ES
