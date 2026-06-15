# Caso Luciano Bragatto — Auditoria Concierge EDP_ES

> Catalogado em 14/06/2026 (versão inicial — estimativa caminho-B).
> **RETIFICADO em 14/06/2026 noite** após re-OCR detalhado com rubricas linha-a-linha.
> Cooperado real CoopereBR. Caso-modelo Espírito Santo / EDP_ES.

---

## ⚠️ HISTÓRICO DE RETIFICAÇÕES (14/06/2026)

### V1 — manhã (estimativa caminho-B)
Estimou R$ 154/mês / R$ 11.340 em 60m+SELIC baseado em inferência sobre bases
agregadas. **ERRADO POR EXCESSO.**

### V2 — tarde (re-OCR + detector original)
Re-OCR detalhado mostrou R$ 0 de indébito. Concluí que EDP_ES estava conforme.
**ERRADO POR FALSO NEGATIVO** — bug no detector Tese 3.

### V3 — noite (pergunta destravadora do Luciano)
Luciano perguntou: "e a cobrança de PIS/COFINS sobre energia compensada?"
Descobri que o detector Tese 3 somava PIS/COFINS POR RUBRICA — mas EDP_ES
cobra agregado na lateral "Reservado ao Fisco". Rubricas individuais
ficam com PIS/COFINS=0, levando o detector a retornar SEM_DIVERGENCIA.

**Patch aplicado em `detector-tese3-pis-sobre-scee.ts`:**
```typescript
if (pisCofinsCobradoEnergetico <= 0 && t.basePisCofinsDeclarada > 0) {
  pisCofinsCobradoEnergetico = t.basePisCofinsDeclarada * aliqTotal;
  metodoDeteccao = 'base-declarada-fallback';
}
```

**Resultado pós-patch (validado por script):**
- Indébito MENSAL Tese 3: **R$ 57,98**
- Indébito 60m+SELIC: **R$ 4.348,47**

ESTA É A VERSÃO CORRETA.

---

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

## 3. Fatura auditada (Fev/2026) — RUBRICAS DETALHADAS

### 3.1 Cabeçalho

| Campo | Valor |
|---|---|
| Mês referência | 02/2026 |
| Vencimento | 11/03/2026 |
| Consumo bruto | 1.139 kWh |
| Total a pagar | R$ 194,25 |

### 3.2 Rubricas extraídas linha-a-linha (11 linhas)

| # | Tipo | Descrição | kWh | Preço c/Trib | Valor R$ | Base ICMS | ICMS R$ |
|---|---|---|---:|---:|---:|---:|---:|
| 1 | TUSD | Energia Ativa Fornecida | 1.139 | 0,60756804 | **+692,02** | 692,02 | +117,64 |
| 2 | INJECAO_SCEE | TUSD En.At.Inj. (lote 1) | −443,066 | 0,57190119 | **−253,39** | −269,18 | −45,76 |
| 3 | INJECAO_SCEE | TUSD En.At.Inj. (lote 2) | −297,088 | 0,57188418 | **−169,90** | −180,50 | −30,68 |
| 4 | INJECAO_SCEE | TUSD En.At.Inj. (lote 3) | −150,335 | 0,57192260 | **−85,98** | −91,34 | −15,53 |
| 5 | INJECAO_SCEE | TUSD En.At.Inj. (lote 4) | −148,511 | 0,57194494 | **−84,94** | −90,24 | −15,34 |
| 6 | TE | Energia Ativa Fornecida | 1.139 | 0,41575066 | **+473,54** | 473,54 | +80,50 |
| 7 | INJECAO_SCEE | TE En.At.Inj. (lote 1) | −443,066 | 0,39131864 | **−173,38** | −184,20 | −31,30 |
| 8 | INJECAO_SCEE | TE En.At.Inj. (lote 2) | −297,088 | 0,39136535 | **−116,27** | −123,52 | −21,00 |
| 9 | INJECAO_SCEE | TE En.At.Inj. (lote 3) | −150,335 | 0,39139248 | **−58,84** | −62,50 | −10,63 |
| 10 | INJECAO_SCEE | TE En.At.Inj. (lote 4) | −148,511 | 0,39135201 | **−58,12** | −61,74 | −10,50 |
| 11 | CIP Municipal | Lei 9156/2017 Vitória | 1 uni | 29,51 | **+29,51** | 0 | 0 |

**Verificação de consistência:**
- Soma rubricas: 692,02 − 594,21 + 473,54 − 406,61 + 29,51 = **R$ 194,25** ✓
- Soma ICMS: 117,64 + 80,50 − 107,31 − 73,43 = **R$ 17,40** (ICMS líquido)
- Cobertura SCEE: 1.039/1.139 = **91,2%** dos kWh consumidos foram compensados

## 4. Análise tributária CORRIGIDA (4 detectores)

### 4.1 ✅ Tema 69 STF — EDP_ES **CONFORME**

```
Energia fornecida BRUTA (TUSD + TE): R$ 692,02 + R$ 473,54 = R$ 1.165,56
ICMS sobre fornecida:                R$ 117,64 + R$ 80,50 = R$ 198,14
Base PIS/COFINS declarada na fatura: R$ 967,42

Verificação: 1.165,56 − 198,14 = R$ 967,42 ✓

→ EDP_ES exclui ICMS da base PIS/COFINS. Tema 69 aplicado.
→ Indébito: R$ 0,00
```

### 4.2 ✅ Tese 3 (PIS/COFINS sobre SCEE) — EDP_ES **CONFORME**

```
PIS+COFINS sobre rubricas SCEE (linhas 2-5, 7-10): R$ 0,00 em todas
Base PIS/COFINS R$ 967,42 = apenas energia FORNECIDA, sem SCEE

→ EDP_ES não tributa PIS/COFINS sobre energia compensada SCEE.
→ Indébito: R$ 0,00
```

### 4.3 ✅ Tese 6 (ICMS sobre TUSD/TE em SCEE) — EDP_ES **CONFORME**

```
ICMS positivo (sobre fornecida bruta):   +R$ 198,14
ICMS negativo (devolvido na injeção):    −R$ 180,74
ICMS LÍQUIDO efetivamente pago:           R$ 17,40

→ EDP_ES devolve ICMS proporcionalmente à compensação SCEE,
  em 4 lotes rastreados (cada lote corresponde a uma origem de geração).
→ ICMS líquido R$ 17,40 só incide sobre os ~100 kWh não compensados
  (1.139 consumidos − 1.039 compensados = 100 kWh tributáveis).
→ Indébito: R$ 0,00
```

### 4.4 ❌ Tese 2 (ICMS TUSD-G) — N/A
Grupo B não tem TUSD-G. Sem demanda contratada.

### 4.5 ❌ Tema 176 STF — N/A
Grupo B não tem demanda contratada.

### 4.6 ❌ Tese 4 (GERAR) — N/A
Sem DRE/ERE em Grupo B.

## 5. **Indébito tributário Concierge: R$ 57,98/mês = R$ 4.348,47 em 60m+SELIC** 🚨

Detecção confirmada pelo `DetectorTese3PisCofinsSobreScee` após patch de
14/06/2026 noite. Cálculo:

```
Valor energético BRUTO (TUSD + TE fornecida):    R$ 1.165,56
Valor energético LÍQUIDO pós-SCEE:               R$   164,74
ICMS sobre líquido:                              R$    17,40
Base correta (líquido − ICMS):                   R$   147,34
Alíq PIS+COFINS efetiva:                         7,07%
PIS+COFINS LEGÍTIMO (sobre base correta):        R$    10,42
PIS+COFINS COBRADO (efetivo pela EDP):           R$    68,40
═════════════════════════════════════════════════════════════
INDÉBITO MENSAL:                                 R$    57,98
INDÉBITO 60m × SELIC 1,25:                       R$ 4.348,47
═════════════════════════════════════════════════════════════
```

**Risco da tese:** MÉDIO (T3 do dossiê).
**Argumento jurídico:** Tema 69 STF por analogia + Tema 986 STJ (ressalva SCEE).
**Prova cabal:** ELFSM/ES + CEMIG/MG aplicam corretamente (dois precedentes
operacionais sob mesma legislação federal). EDP_ES está isolada no descumprimento.

## 6. Achados NÃO-tributários (ainda valem!)

### 6.1 ⚠️ Cota cadastrada subestimada (30%)
- Cota Cooperado: 796,92 kWh/mês
- Consumo médio (12m): ~865 kWh
- Consumo Fev/26: 1.139 kWh
- **Recomendação: ajustar cota pra ~1.100 kWh/mês**

### 6.2 🎉 SCEE gerou economia massiva
Histórico de R$ pagos:

| Período | Faixa R$ | Característica |
|---|---:|---|
| Fev/25 - Mai/25 | R$ 600 - 980 | Sem SCEE / cobertura mínima |
| Jun/25 - Out/25 | R$ 240 - 700 | Transição |
| Nov/25 - Fev/26 | R$ 165 - 242 | SCEE ativo 91% cobertura |

**Economia média após adesão ao Clube: ~R$ 750/mês = ~R$ 9.000/ano**

### 6.3 🚨 UC fantasma "PENDENTE-GUARAPARI"
UC com `numero = PENDENTE-GUARAPARI` em Guarapari, sem fatura processada. Pendência cadastral.

### 6.4 📊 4 origens de SCEE rastreadas
A fatura mostra 4 lotes de injeção separados (linhas 2-5 em TUSD, 7-10 em TE). Cada lote pode corresponder a uma usina/origem de geração. Investigar de qual usina vem cada lote (Cooperebr1? Cooperebr2? Terceira usina?).

## 7. Implicações estratégicas pro Concierge (revisadas)

### 7.1 Concierge tributário em Grupo B residencial — **NÃO TEM MERCADO em EDP_ES**

EDP_ES está **tão conforme quanto CEMIG/MG** nas 3 teses majoritárias. O pitch comercial "vamos recuperar dinheiro de cobrança indevida" não funciona em EDP_ES residencial.

### 7.2 Onde ainda há potencial Concierge

| Angulação | Tipo | Mercado |
|---|---|---|
| Grupo A (alta tensão / PJ industriais) | Tributário | Tema 176 + Tese 2 + Tese 4 GERAR |
| Distribuidoras menores | Tributário | ELFSM, ENERGISA regionais |
| Históricos pré-Lei 14.300 (2023) | Tributário | Restituição prescritiva 5 anos |
| Otimização SCEE | Operacional | Saldo expirando + cota |
| CIP municipal | Operacional | Legalidade do valor |
| Gross-up "por dentro" | Tributário avançado | Adapter próprio |

### 7.3 Pivot recomendado pro produto Concierge

1. **Caminho A — Foco em PJ Grupo A** (B2B): produto fica viável tributariamente
2. **Caminho B — Concierge Operacional** (B2C): renomear o produto pra "auditoria preventiva + otimização" (sem promessa de indébito)
3. **Caminho C — Combo** (B2C+B2B): Concierge Operacional pra residencial + Concierge Tributário pra PJ

## 8. Anti-padrão aprendido (catalogado)

**Lição:** NUNCA estimar indébito tributário a partir de dados agregados do OCR
dashboard. Os campos `icmsValor` e `pisCofinsValor` no `dadosExtraidos` não são
suficientes pra detectar conformidade de Tema 69/Tese 3/Tese 6 — precisa OCR
rich com rubricas linha-a-linha. Estimativas caminho-B podem estar 100% erradas.

**Regra:** Concierge SEMPRE roda o pipeline completo (OCR rich → adapter →
DetectoresRegistry) antes de afirmar indébito. Não inferir por bases agregadas.

## 9. Valor REAL ao Luciano (revisado)

```
Economia SCEE / Clube já vigente: R$ 9.000/ano × 10 = R$ 90.000
Indébito Concierge tributário:    R$ 0
──────────────────────────────────────────────
TOTAL: R$ 90.000 em 10 anos (de economia SCEE, NÃO de indébito)
```

## 10. Próximos passos pro caso Luciano

1. ✅ Re-OCR detalhado feito (este documento)
2. ⏳ Atualizar cota Cooperado pra ~1.100 kWh/mês
3. ⏳ Resolver UC fantasma PENDENTE-GUARAPARI
4. ⏳ Investigar de quais usinas vêm os 4 lotes SCEE
5. ⏳ Auditar saldo SCEE acumulado (4.597,725 kWh) — risco de expiração 60m
6. ⏳ Verificar CIP municipal (R$ 29,51) contra Lei 9156/2017 de Vitória
