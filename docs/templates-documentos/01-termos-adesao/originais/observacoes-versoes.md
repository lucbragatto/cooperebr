# Observações sobre as versões dos termos de adesão

**Comparação técnica e jurídica entre os 2 modelos atualmente em uso.**

---

## Quadro comparativo

| Item | Jucielly (v1) | Pandini (v2) | Status |
|---|---|---|---|
| **Estrutura geral** | 3 páginas | 4 páginas | ✅ v2 mais detalhada |
| **CNPJ SISGDSOLAR (corpo)** | 49.950.705/0001-69 | **58.103.611/0001-45** | 🔴 DIVERGENTE |
| **CNPJ SISGDSOLAR (assinatura)** | 49.950.705/0001-69 | 49.950.705/0001-69 | 🔴 INCONSISTÊNCIA interna no v2 |
| **Endereço SISGDSOLAR** | Av. Fernando Ferrari 500, Jardim da Penha, CEP 29.060-220 | Av. Nossa Senhora da Penha 2598, Santa Luiza, CEP 29.045-402 | 🔴 DIVERGENTE |
| **Instalações Cooperebr** | (não explicitadas) | 0161073905 + 0161200002 | ✅ v2 explicita as 2 usinas |
| **Instalação Sinergia** | (não explicitada) | 0160951347 | ✅ v2 explicita |
| **Termo "Geração Distribuída Compartilhada"** | (não mencionado) | ✅ Mencionado | ✅ v2 alinhado a Lei 14.300 |
| **Permite escolha Cooperativa OU Consórcio** | Implícito | ✅ Explícito | ✅ v2 melhorado |
| **Cláusulas 1.2 a 6.3** | Idênticas | Idênticas | ⚠️ Estrutura igual |
| **Cláusula 4.1 mobilidade** | Texto idêntico | Texto idêntico | 🔴 Risco Exfishes não corrigido |
| **Qualificação cooperativa** | ❌ Ausente | ❌ Ausente | 🔴 Risco persiste |
| **Cláusula sobre Fio B** | ❌ Ausente | ❌ Ausente | 🔴 Risco persiste |
| **Isenção responsabilidade CoopereBR** | ❌ Ausente | ❌ Ausente | 🔴 Risco persiste |

---

## 🔴 Achados críticos que requerem esclarecimento de Luciano

### 1. CNPJ SISGDSOLAR — qual é o correto?

| Versão | CNPJ citado no corpo | CNPJ citado na assinatura |
|---|---|---|
| Jucielly v1 | 49.950.705/0001-69 | 49.950.705/0001-69 |
| Pandini v2 | **58.103.611/0001-45** | **49.950.705/0001-69** ⚠️ |

**Hipóteses:**
- (a) SISGDSOLAR mudou de CNPJ entre as versões (sucessão empresarial / nova razão social)
- (b) São duas empresas distintas do mesmo grupo
- (c) Erro de redação na v2 (corpo cita CNPJ novo, esqueceram de atualizar a assinatura — ou vice-versa)
- (d) O CNPJ antigo está em processo de baixa e o novo é o ativo

**Implicação jurídica:** se o cooperado assinou o termo v2 com inconsistência interna, **qual pessoa jurídica é a parte real do contrato?** Em caso de litígio, qualquer das duas pode alegar não ser parte legítima. **Esse é um vício formal grave.**

**Ação recomendada:**
- Consultar Receita Federal sobre status dos dois CNPJs
- Esclarecer com SISGDSOLAR qual é a pessoa jurídica vigente
- Determinar se cooperados que assinaram v2 precisam reassinar com CNPJ correto
- Atualizar SISGD com CNPJ correto no campo de operador técnico

### 2. Mudança de endereço SISGDSOLAR

- **v1 (Jucielly):** Av. Fernando Ferrari, 500, Jardim da Penha — **mesmo endereço da CoopereBR**
- **v2 (Pandini):** Av. Nossa Senhora da Penha, 2598, Santa Luiza — **endereço distinto**

**Hipótese:** SISGDSOLAR separou-se fisicamente da CoopereBR. Isso é positivo para definição clara de pessoas jurídicas, mas:
- Afeta cláusula 6.3 (foro = sede SISGDSOLAR) — qual sede vale?
- Cria ambiguidade sobre subordinação operacional

### 3. Foro do contrato — Cláusula 6.3

Ambas as versões: "foro da comarca do local da sede do SISGDSOLAR".

**Problema:** o foro fica determinado pelo endereço do SISGDSOLAR no momento da assinatura, mas pode mudar (como mudou entre v1 e v2). Para litígios envolvendo a **CoopereBR**, esse foro é INADEQUADO:
- CoopereBR tem sede em Vitória/ES
- CUSD da CoopereBR com EDP-ES elege Vitória/ES
- Petição judicial preparada no dossiê elege Vitória/ES

**Recomendação:** modelo blindado v2 da CoopereBR deve eleger Comarca de Vitória/ES como foro, independente do endereço SISGDSOLAR.

### 4. Cláusula 4.1 — Risco Exfishes NÃO CORRIGIDO

Tanto v1 quanto v2 mantêm o texto:

> "O Aderente confere autonomia plena ao SISGDSOLAR, enquanto administrador geral dos créditos, para alocá-lo, a qualquer tempo, em quaisquer das usinas parceiras, **sem que isso acarrete prejuízo aos seus direitos** ou à compensação regular de sua unidade consumidora."

**Problema gravíssimo:** o termo afirma que a mudança "não acarreta prejuízo" — mas o caso Exfishes provou EXATAMENTE o contrário:
- Realocação de Cooperebr1 (GD I) → Cooperebr2 (GD III) gerou salto de R$ 3.997 → R$ 32.486 (8,1×)
- Esse é o tipo de "prejuízo" que a cláusula 4.1 nega que possa ocorrer

**Implicação jurídica:** essa cláusula pode ser **NULA por vício de informação** (CDC Art. 6º III) e por **afirmação falsa** (CC Art. 145-148 — vícios do consentimento). Cooperado que sofreu salto tarifário pode invocar essa falsidade para ANULAR o termo OU exigir reparação.

**Recomendação:** modelo blindado v2 da CoopereBR substitui completamente essa cláusula por redação honesta sobre o risco regulatório.

### 5. Cooperebr1 e Cooperebr2 no mesmo termo

A v2 (Pandini) lista as duas instalações: 0161073905 e 0161200002.

Isso significa que o cooperado Pandini PODE estar recebendo créditos de qualquer uma das duas usinas, conforme decisão do SISGDSOLAR — exatamente a operação que pegou Exfishes.

**Verificar:** Pandini está atualmente vinculado a Cooperebr1 (GD I) ou Cooperebr2 (GD III)? Se Cooperebr2, ele também sofre o salto tarifário. Pode haver dezenas de cooperados na mesma situação.

---

## Recomendação consolidada

1. **Esclarecer CNPJ SISGDSOLAR** com a operadora antes de qualquer nova adesão
2. **Suspender uso dos termos v1 e v2** para novas adesões até modelo blindado v2 ser aprovado
3. **Migrar cooperados existentes** para o modelo blindado, com comunicação formal de upgrade
4. **Auditar quais cooperados** estão vinculados a Cooperebr2 sob risco do Fio B GD III
5. **Considerar oferecer assinatura conjunta** do modelo blindado v2 + termo de mitigação retroativa para cooperados afetados (proteção contra ações coletivas)
6. **Arquivar PDFs originais** assinados em sistema cofre digital seguro (Drive corporativo + backup)
