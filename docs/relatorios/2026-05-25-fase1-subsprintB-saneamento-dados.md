# Fase 1 read-only — Sub-Sprint B Saneamento de Dados

> 25/05/2026 — Onboarding cooperebr1, em paralelo às decisões regulatórias do Sub-Sprint A.
> Decisão 23 ativa + CLAUDE.md regras de segurança migration. Investigação read-only. Nada foi tocado.

## TL;DR (5 linhas)

A investigação confirma 4 frentes de saneamento + 1 decisão de produto sobre fantasmas. **Achado central inesperado: dos 71 cooperados ATIVOS com contrato vinculado, apenas 1 é REAL — CAROLINA LEMOS CRAVO**, que já é o canário Sub-Fase A FIXO. Os outros 70 são `ambienteTeste=true`. Isso muda o cenário do Sub-Sprint B: **não estamos saneando 71 contratos reais — estamos saneando 1 contrato real + lidando com 233 cadastros incompletos + decidindo se mantém 70 sintéticos como massa de teste**. Estimativa final: **8-14h Code dedicado** + 1-2 idas e vindas com Luciano pra inputs externos (CNPJ real CoopereBR + decisão sobre fantasmas + opcionalmente planilha pré-migration).

---

## Frente 1 — tarifaContratual (D-30R legado)

### Achados quantitativos confirmados

- **71 contratos ATIVOS sem `tarifaContratual`** no tenant CoopereBR (mesmo número do relatório amplo 25/05)
- **2 contratos sem `planoId`** vinculado (a investigar — pode ser dado órfão de migrações antigas)
- **0 contratos com `valorCheioKwhAceite`** preenchido — **o helper canônico `calcularTarifaContratual` PRECISA desse input** (`valorCheioKwh` + `tarifaSemImpostos`) e o banco não tem
- **0 contratos com `valorContrato`** preenchido (snapshot Sprint 5 também ausente)

### Distribuição por plano (71 sem tarifa)

| Plano | id | Modelo | descontoBase | baseCalculo | Contratos |
|---|---|---|---|---|---|
| PLANO OURO | `plano-ouro` | CREDITOS_COMPENSADOS | 20% | KWH_CHEIO | **58** |
| Plano Individual Residencial | `cmn7ru9970004uokcfwydmqjm` | FIXO_MENSAL | 18% | KWH_CHEIO | 7 |
| CONSUMO DE CREDITOS DE KWH | `plano-creditos` | CREDITOS_COMPENSADOS | 18% | KWH_CHEIO | 2 |
| PLANO PRATA | `plano-prata` | CREDITOS_COMPENSADOS | 15% | KWH_CHEIO | 1 |
| Plano Condomínio Básico | `cmn7qymqr001nuoawdqqg34fm` | FIXO_MENSAL | 20% | KWH_CHEIO | 1 |
| (sem plano) | — | — | — | — | 2 |

### Helper canônico — análise de viabilidade

```typescript
calcularTarifaContratual({
  valorCheioKwh: number,        // R$/kWh COM tributos — vem da fatura (OCR snapshot)
  tarifaSemImpostos: number,    // R$/kWh SEM impostos — vem da fatura (OCR snapshot)
  baseCalculo: 'KWH_CHEIO' | 'SEM_TRIBUTO' | 'COM_ICMS' | 'CUSTOM',
  descontoPercentual: number,   // 0-100 — do plano (descontoBase)
})
```

- Pra `baseCalculo=KWH_CHEIO` (TODOS os 71 contratos): `tarifa = valorCheioKwh × (1 - descontoPercentual/100)`
- Pra `baseCalculo=SEM_TRIBUTO`: precisa de `tarifaSemImpostos` também

### Realidade: 0/69 com `valorCheioKwhAceite` — ZERO inferível só do banco

O fato de **ZERO contratos legados terem `valorCheioKwhAceite`** é o achado-chave. Isso significa que **não dá pra rodar o helper canônico só com dados de banco** — precisa de input externo.

### Apenas 5 FaturaProcessada no tenant CoopereBR

| Cooperado | mes | UC.numero | UC.numeroUC | valorCheioKwh | tarifaSemImpostos |
|---|---|---|---|---|---|
| CAROLINA LEMOS CRAVO | 2026-01 | `0.000.897.339.054-90` | null | **1.18877** | 0.78931 |
| DIEGO ALLAN CORREIA PEREIRA | 2026-01 | `0.001.516.624.054-75` | null | **1.11418** | 0.78931 |
| ALMIR JOAO MUNIZ FREITAS | 2025-12 | `0160213718` | null | **1.0815** | 0.78931 |
| THEOMAX COMERCIO ... LTDA | 2025-12 | `0000652942` | null | **1.07903** | 0.78931 |
| AMAGES (Associação Magistrados ES) | 03/2026 | `2399394054` | `239939405` | **0.2385** | 0.46196 |

> **ATENÇÃO:** AMAGES tem `valorCheioKwh=0.2385` (R$/kWh) e `tarifaSemImpostos=0.46196`. **`valorCheio < tarifaSemImpostos` é fisicamente impossível** — `valorCheio` deveria ser ≥ `tarifaSemImpostos` (com tributos por cima). Esse registro tem dado errado, **não usar como referência**. Provavelmente o OCR confundiu o campo no caso AMAGES (PJ).

Os outros 4 (canários FIXO Sub-Fase A) têm `valorCheio` entre R$ 1,08 e R$ 1,19 — coerente com tarifa B1 residencial EDP-ES atual.

### Intersecção 71 sem tarifa × cooperados com FaturaProcessada

**0/71 contratos sem tarifa têm fatura processada do mesmo cooperado.** Os 5 cooperados com fatura coincidem com os que JÁ TÊM `tarifaContratual` populado (forward-only do D-30R em ação — foram processados após Fase B 03/05). Então o backfill via "fatura existente no banco" não cobre **nenhum** dos 71.

### Estratégia recomendada

**RECOMENDAÇÃO: (a) script de backfill automático INFERINDO via plano + tarifa de referência EDP-ES atual.**

Justificativa:
- 70 dos 71 contratos sem tarifa são `ambienteTeste=true` (sintéticos) — backfill perfeito não é exigido, só "razoável pra teste rodar"
- O 1 contrato real (Carolina) JÁ TEM tarifaContratual (descoberta inesperada — re-conferir, mas se confirmar, NÃO precisa de backfill pra ela)
- Pra cenários FIXO_MENSAL (8 contratos), `tarifaContratual` é informativa — engine FIXO usa snapshots `valorContrato`/`valorCheioKwhAceite` (também null aqui — outro problema)
- Pra cenários COMPENSADOS (61 contratos), `tarifaContratual` É consumida pela engine

**Algoritmo do script:**
```
PARA cada contrato sem tarifaContratual + com planoId:
  tarifaRefAtual = consultar tarifa EDP-ES atual (TUSD+TE+tributos)
    OPÇÕES de fonte:
      (i) TarifaConcessionaria table (se existir e populada)
      (ii) hardcode constante "TARIFA_EDP_ES_2026 = R$ 0,93 / kWh"  ← mais simples
      (iii) media dos 5 valorCheioKwh existentes (R$ 1,09) ← também opção
  baseCalculo = plano.baseCalculo
  desconto = plano.descontoBase

  tarifaContratual = calcularTarifaContratual({
    valorCheioKwh: tarifaRefAtual,
    tarifaSemImpostos: tarifaRefAtual × 0.85,  // aproximação (15% tributos)
    baseCalculo, descontoPercentual: desconto
  })
```

**Trade-off:** valor backfilled NÃO é o "real do aceite original" — é uma tarifa de referência APROXIMADA. Mas pra cooperados sintéticos é suficiente. Pro cooperado real (Carolina, se confirmar que precisa), exige input do Luciano com fatura concreta do mês do aceite.

### Estimativa esforço

- Script idempotente backfill + DRY-RUN: **2-3h Code**
- Constante de tarifa de referência decidida com Luciano: **decisão produto 30 min**
- 2 contratos sem `planoId` — investigar caso a caso: **1h** (ou catalogar débito)

### Input Luciano necessário

1. Confirmar `TARIFA_EDP_ES_2026` (R$/kWh) como valor de referência pra backfill
2. Decidir o que fazer com 2 contratos sem `planoId` (anomalia rara)

---

## Frente 2 — distribuidora=OUTRAS (sequela migration 26/04)

### Achados quantitativos

| Tenant | Total UCs | OUTRAS | % |
|---|---|---|---|
| CoopereBR | 303 | **295** | 97,4% |
| CoopereBR Teste | 0 | 0 | — |
| TESTE-FASE-B5 | 6 | 0 | 0% |
| (sem cooperativaId) | 4 | ? | — (anomalia) |

### Distribuição das 295 OUTRAS por estado

| Estado | UCs |
|---|---|
| ES | **292** |
| Es (typo capitalização) | **3** |
| (outros) | **0** |

**🟢 ACHADO LIMPO:** TODAS as 295 UCs OUTRAS estão em ES. Como CoopereBR opera **só EDP-ES**, backfill pode ser direto:

```sql
UPDATE ucs
SET distribuidora = 'EDP_ES'
WHERE cooperativaId = '<cooperebr>'
  AND distribuidora = 'OUTRAS'
  AND estado IN ('ES', 'Es', 'es')
```

### UCs com distribuidora correta (referência — 8 UCs)

| numero | numeroUC | Estado/Cidade | distribuidora |
|---|---|---|---|
| `0400702214` | `160085263` | ES/VITORIA | EDP_ES |
| `0.001.516.624.054-75` | null | ES/VILA VELHA | EDP_ES |
| `0.000.897.339.054-90` | null | ES/VILA VELHA | EDP_ES |
| `0160213718` | null | ES/VILA VELHA | EDP_ES |
| `0000652942` | null | ES/VITORIA | EDP_ES |
| `1334421054` | `133442105` | ES/Aracruz | EDP_ES |
| `2399394054` | `239939405` | ES/Vitória | EDP_ES |
| `UC-TESTE-FASE4-001` | null | ES/Linhares | EDP_ES |

### Estratégia recomendada

**RECOMENDAÇÃO: (a) script UPDATE multi-tenant aware, com DRY-RUN obrigatório.**

Script vai mostrar antes/depois das 295 UCs (com identificadores + cidade) pra Luciano confirmar visualmente que tudo é EDP-ES.

**Riscos baixos:**
- TODAS as 295 estão em ES — não há risco de pegar UC de outro estado por erro
- A coluna `estado` no Cooperado é fidedigna (todos `ES` ou `Es`)

**Riscos médios:**
- 4 UCs com `cooperativaId=null` (anomalia — não pertencem a nenhum tenant). Investigar separadamente.
- 3 UCs com `estado='Es'` (typo) — corrigir junto: `UPDATE estado='ES' WHERE estado='Es'`

### Estimativa esforço

- Script idempotente backfill + DRY-RUN: **1-2h Code**
- Investigação das 4 UCs órfãs (sem `cooperativaId`): **30 min**

### Input Luciano necessário

1. Aprovar UPDATE em massa após ver output do DRY-RUN
2. Decidir o que fazer com 4 UCs órfãs (DELETE ou atribuir tenant)

---

## Frente 3 — numeroUC legado (78,5% sem)

### Achados quantitativos

| Tenant | Total | com_numeroUC | sem |
|---|---|---|---|
| CoopereBR | 303 | 65 | **238** |
| CoopereBR Teste | 0 | 0 | 0 |
| TESTE-FASE-B5 | 6 | 0 | 6 |

### Intersecção com FaturaProcessada (fonte OCR existente)

- 238 UCs sem `numeroUC`
- **Apenas 4 dessas têm fatura processada associada** — potencial backfill via OCR cobre **<2%** das UCs

### Análise dos formatos existentes (65 UCs com numeroUC preenchido)

Heterogeneidade preocupante:

| Dígitos no `numeroUC` | Exemplos | Quantidade aprox |
|---|---|---|
| 20 (igual a numero original) | `0.000.892.226.054-40` | ~5 (provavelmente sequela de migration que copiou `numero` em `numeroUC`) |
| 10 (canônico SISGD) | `0160005888`, `0001247613` | ~10 (não é o legado real — é o `numero` canônico copiado) |
| 9 (legado EDP REAL) | `160085263`, `160022301`, `133442105` | ~15 |
| 8 | `16052024` | ~1 |
| 7 | `1161793`, `1814671`, `659823` | ~5 |
| 6 | `914621` | ~2 |

**🔴 CRÍTICO:** Apenas ~15 UCs têm `numeroUC` no formato legado EDP REAL (9 dígitos). O restante são variações de dados sujos copiados de outros campos.

### Análise `numeroConcessionariaOriginal`

- **3/303 UCs** (1%) têm `numeroConcessionariaOriginal` preenchido. Sprint 11 Fase A criou o campo mas backfill nunca rodou.

### Fontes alternativas pra preencher numeroUC

| Fonte | Disponibilidade | Esforço |
|---|---|---|
| (i) Planilha pré-migration backup | **DESCONHECIDO** — Luciano precisa confirmar | Se SIM: import 1-2h; se NÃO: zero |
| (ii) Pipeline OCR via faturas novas | 🟢 disponível, lento (acumula 1-2 UCs/mês por cooperado) | Tempo: meses; código: zero (já existe) |
| (iii) Contato direto cooperado | 🟡 viável pequeno volume | Operacional, fora do escopo Code |
| (iv) Sistema legado da CoopereBR (anterior ao SISGD) | **DESCONHECIDO** — Luciano confirma | Investigar |
| (v) Lista exportada da EDP-ES | 🟡 EDP-ES pode exportar lista de UCs vinculadas a CoopereBR | Operacional Luciano |

### Estratégia recomendada

**RECOMENDAÇÃO: HÍBRIDO**

1. **Imediato (Sub-Sprint B):** script de backfill **VIA OCR EXISTENTE** — pra cada FaturaProcessada com UC sem numeroUC, ler `numeroConcessionariaOriginal` extraído pelo OCR e popular. Cobertura esperada: <2% (insuficiente).
2. **Decisão Luciano paralela:** investigar planilha pré-migration / sistema legado / exportar lista EDP-ES. Se SIM, script de import. Esforço: 4-8h Code + tempo coleta dados.
3. **Médio prazo:** confiar em pipeline OCR de faturas novas pra preencher gradualmente (D-30U + Sprint 11 Bloco 2 Fase D ja garantem guard — `numeroUC` obrigatório antes da ativação).
4. **Aceitar:** pra cooperados sintéticos (ambienteTeste=true), `numeroUC` pode permanecer null indefinidamente — não bloqueia operação.

**Reframe importante:** dos 238 sem `numeroUC`, a esmagadora maioria são cooperados `ambienteTeste=true` que NÃO vão pra produção. A Carolina (canário real) já tem fatura processada — verificar se o OCR já populou o `numeroUC` dela. Se sim, o problema é só dos sintéticos.

### Estimativa esforço

- Script backfill via OCR existente + DRY-RUN: **1-2h Code**
- Se planilha pré-migration existir: import + validação: **3-5h Code**
- Investigação operacional Luciano: **1-2 semanas calendário** (sem código)

### Input Luciano necessário (CRÍTICO)

1. **Confirmar se existe planilha pré-migration** com mapeamento numero → numeroUC EDP-ES (backup, exportação antiga, planilha operacional CoopereBR)
2. **Confirmar se sistema legado anterior ao SISGD** tem essa informação acessível
3. **Confirmar se EDP-ES pode exportar lista** das UCs vinculadas à CoopereBR via convênio cooperativa

---

## Frente 4 — CNPJ tenant CoopereBR

### Estado real confirmado

```json
{
  "id": "cmn0ho8bx0000uox8wu96u6fd",
  "nome": "CoopereBR",
  "cnpj": "00.000.000/0001-00",   ← PLACEHOLDER CONFIRMADO
  "planoSaas": { "nome": "OURO" }
}
```

### Onde mais o CNPJ é usado?

Pra dimensionar o esforço de propagação:

1. **Templates de documentos** — `docs/templates-documentos/` (princípio multi-tenant 17/05 — preenchimento contextual, CNPJ em branco nos templates atuais)
2. **Faturas Asaas** — vai aparecer como "Recebedor: CoopereBR — CNPJ XX.XXX..." quando gerar boleto/PIX
3. **Cobrança ao cooperado** — pode aparecer em PDF/email se o template usa `{{cooperativa.cnpj}}`
4. **Integração bancária** — `IntegracaoBancariaService` (BB/Sicoob) usa CNPJ do tenant pro lançamento

### Estratégia recomendada

**RECOMENDAÇÃO: UPDATE direto + auditoria de propagação.**

```typescript
// Script idempotente:
const cnpjReal = "XX.XXX.XXX/0001-XX";  // ← Luciano fornece
await prisma.cooperativa.update({
  where: { id: 'cmn0ho8bx0000uox8wu96u6fd' },
  data: { cnpj: cnpjReal },
});
```

Plus: grep do uso de `cnpj` em templates + PDFs gerados pra confirmar propagação.

### Estimativa esforço

- Script UPDATE + auditoria propagação: **30-60 min Code**
- Coletar CNPJ real CoopereBR: **input Luciano** (provavelmente 5 min — ele tem o CNPJ documentado)

### Input Luciano necessário

1. **CNPJ real da CoopereBR** (cooperativa registrada na Junta Comercial)
2. Confirmar se quer também atualizar `razaoSocial`, `inscricaoEstadual`, etc. (campos extras possíveis)

---

## Frente 5 — Fantasmas (DECISÃO DE PRODUTO LUCIANO)

### Mapeamento exato (304 ATIVOS)

| Categoria | Quantidade | % |
|---|---|---|
| **SEM uc SEM contrato** (fantasma extremo) | **10** | 3,3% |
| SEM uc COM contrato (anomalia rara) | 0 | 0% |
| COM uc SEM contrato (cadastro não ativado) | **223** | 73,4% |
| COM uc COM contrato (saudável) | **71** | 23,4% |

### Cascata se DELETE — Fantasmas extremos (10)

Os 10 fantasmas extremos têm cascata **ZERO**:

```
{
  ucs: 0, contratos: 0, notificacoes: 0, documentos: 0,
  propostas: 0, ocorrencias: 0, listaEspera: 0,
  asaasCobrancas: 0, cobrancasGateway: 0,
  beneficiosIndicacao: 0, indicacoesFeitas: 0, indicacoesRecebidas: 0,
  asaasCustomers: 0
}
```

**DELETE 100% seguro pra essas 10.** Nenhum impacto downstream.

### Os 71 com contrato ATIVO — REAIS vs SINTÉTICOS (achado-chave)

| Tipo | Quantidade |
|---|---|
| `ambienteTeste=true` (sintéticos) | **70** |
| `ambienteTeste=false` (REAIS) | **1** |

**🔴 ACHADO CENTRAL INESPERADO:** **APENAS 1 COOPERADO REAL** com contrato ATIVO na CoopereBR. Identificado:

```
Nome: CAROLINA LEMOS CRAVO
CPF: 08649654789
Email: lucbragatto+carolina@gmail.com  ← contato teste Luciano (regra inegociável 14/05)
AsaasCustomer: SIM (já tem)
```

**Carolina é o Sub-Fase A canário FIXO** (memória `project_sessao_15_05.md` + sessão 14/05 sub-canário CAROLINA). NÃO é cooperado real do universo CoopereBR — é caso de teste com contatos do Luciano. O que significa que **o tenant CoopereBR no banco hoje tem ZERO cooperados reais com contrato ATIVO**.

### Implicação fortíssima

> **Nenhum dos 71 com contrato ATIVO é um cooperado REAL da CoopereBR no mundo real.** São TODOS dados de teste/migração. O banco precisa receber a **massa real** importada do sistema legado pra produção começar.

### Opções de tratamento — análise

#### Opção (i) DELETE fantasmas extremos (10)

- **Risco:** ZERO (cascata vazia)
- **Benefício:** Banco mais limpo
- **Recomendação:** ✅ APROVAR (single batch, dry-run mostra os 10 ids)

#### Opção (ii) SET status=INATIVO nos 223 "COM uc SEM contrato"

- **Risco:** Baixo — preserva dados mas remove da operação
- **Benefício:** Banco continua usável pra testes / regressão
- **Trade-off:** mantém 223 UCs órfãs (sem contrato) — pode confundir queries
- **Recomendação:** ⚠️ SUSPENDER decisão até Luciano confirmar se serão re-ativados (migração de sistema legado pode aproveitar esses cadastros) OU se vão pra DELETE em sprint dedicado

#### Opção (iii) Cenário híbrido recomendado

| Categoria | Ação | Justificativa |
|---|---|---|
| 10 fantasmas extremos | **DELETE** (cascata vazia) | Limpeza segura |
| 223 cadastros não ativados | **MANTER por enquanto + catalogar débito D-novo-AG** | Migração massa real do sistema legado pode aproveitar/sobrescrever |
| 70 sintéticos com contrato ATIVO | **MANTER + `ambienteTeste=true`** | Massa de regressão essencial pra Sprint Bot Autoatendimento + futuros |
| 1 cooperado real (Carolina, sub-canário) | **MANTER** | Canário oficial Sub-Fase A FIXO |

### Estimativa esforço

- Script DELETE 10 fantasmas extremos + DRY-RUN: **30 min Code**
- Catalogar D-novo-AG (decisão sobre 223 cadastros não ativados): **15 min**
- Decisão Luciano sobre estratégia: **1 reunião 15 min**

### Input Luciano necessário (CRÍTICO)

1. **Aprovar opção (iii) — DELETE 10 fantasmas + manter 223 catalogados como débito**
2. **Confirmar plano de importação dos cooperados reais** — vai vir de planilha? De sistema legado? Quando?
3. **Decidir destino dos 223 cadastros não ativados** após migração real (DELETE all? Mesclar com novos?)

---

## Frente 6 — Validações cruzadas (anomalias adicionais)

### 6.1 Consistência tenant em contratos ATIVOS — 🟢 OK

- 76 contratos ATIVOS no tenant CoopereBR
- **76/76 com `UC.cooperativaId === Contrato.cooperativaId`** — defense in depth multi-tenant funcionando
- 0 contratos cross-tenant (Sprint 13a Dia 3 IDOR fix consolidado)

### 6.2 ANOMALIA — UC.cooperadoId ≠ Contrato.cooperadoId (2 contratos)

🔴 **Anomalia de dados:** 2 contratos têm a UC vinculada a um cooperado DIFERENTE do que assinou o contrato.

Possíveis causas:
- Cooperado "transferiu" UC pra outro mas contrato antigo não foi encerrado
- Bug de cadastro antigo
- Dado sintético de teste

**Recomendação:** investigar manualmente os 2 IDs antes de qualquer ação. Pode ser bug latente em multi-tenant que vale catalogar como débito.

### 6.3 ANOMALIA — 1 contrato ATIVO sem `usinaId`

🔴 1 contrato `usinaId=null` — engine de cobrança não consegue calcular sem usina.

**Recomendação:** investigar individualmente, provavelmente DELETE/encerrar OU atribuir usina manualmente.

### 6.4 ANOMALIA — 5 contratos ATIVOS com `kwhContratoMensal=null`

Soma por usina mostrou:
- Palmeiras (1 contrato): kwhContratoMensal=null
- Guarapari (4 contratos): kwhContratoMensal=null total
- Serra (2 contratos): kwhContratoMensal=null total
- 1 contrato sem usinaId: null

Total: **5+1+2 = 8 contratos sem kwhContratoMensal** (já contado na frente 1).

**Recomendação:** os 8 contratos com `kwhContratoMensal=null` NÃO podem gerar cobrança. Pra cooperebr1 isso não impacta (66 contratos da cooperebr1 estão OK). Pras outras usinas (Palmeiras/Guarapari/Serra), são dados sintéticos antigos — provavelmente encerrar ou manter ambienteTeste.

### 6.5 ANOMALIA — 2 UCs no tenant CoopereBR com cooperado em OUTRO tenant

🔴 **Vazamento multi-tenant raro:** 2 UCs do tenant CoopereBR pertencem a cooperado de outro tenant (provavelmente TESTE-FASE-B5 ou CoopereBR Teste).

**Investigação read-only:** essas 2 UCs provavelmente entraram em algum teste que vinculou UC do tenant A a cooperado do tenant B. Não é crítico (cobranças usam `cooperativaId` do Contrato, não da UC), mas é dado sujo.

**Recomendação:** identificar os IDs + decidir se DELETE ou re-atribuir.

### 6.6 ANOMALIA — 4 UCs sem `cooperativaId`

🔴 4 UCs órfãs (sem tenant). Pode ser sequela da migration UC schema antiga.

**Recomendação:** identificar os IDs + atribuir tenant correto ou DELETE.

### 6.7 0 cobranças órfãs — 🟢 OK

- 0 cobranças sem `contratoId` válido
- 0 cobranças sem `cooperativaId` (todas as 39 CoopereBR têm tenant)
- 0 UCs sem `cooperadoId` (FK obrigatória do schema)

### Estimativa esforço (validações cruzadas)

- Identificar IDs específicos de cada anomalia + investigar individualmente: **2-3h Code**
- Script de remediação caso a caso (DELETE seletivo / UPDATE manual): **1-2h Code**

---

## Plano de execução do Sub-Sprint B — ordem segura

### STEP 1 — AUDITORIA (read-only, antes de qualquer UPDATE) [4-6h]

Scripts de SELECT que CONFIRMAM os números diagnósticados nesta Fase 1:
- `audit-tarifa-contratual-faltante.ts` → lista 71 contratos + plano + cooperado
- `audit-distribuidora-outras.ts` → lista 295 UCs OUTRAS + estado + cidade
- `audit-numero-uc-ausente.ts` → lista 238 UCs sem `numeroUC` + UCs com fatura processada
- `audit-fantasmas.ts` → lista 10 fantasmas extremos + cascata zero + 223 sem-contrato + 70 sintéticos + 1 real
- `audit-anomalias-cruzadas.ts` → lista 2 UC-cooperado divergente + 1 sem usina + 8 sem kwh + 2 cross-tenant + 4 sem tenant

Cada script roda em <30s, output salvo em `audit-output/`.

### STEP 2 — DRY-RUN dos scripts de saneamento [3-4h Code]

Scripts idempotentes que MOSTRAM o ANTES/DEPOIS de cada registro afetado, **sem alterar nada** (flag `--apply` desativada por default).

| Script | Afeta | Output esperado |
|---|---|---|
| `fix-tarifa-contratual-backfill.ts --dry-run` | 71 contratos | 71 antes/depois com nova `tarifaContratual` calculada |
| `fix-distribuidora-edp-es.ts --dry-run` | 295 UCs + 3 typos | 295 + 3 antes/depois |
| `fix-numero-uc-via-ocr.ts --dry-run` | 4 UCs (intersecção FaturaProcessada) | 4 antes/depois |
| `fix-cnpj-tenant-cooperebr.ts --dry-run` | 1 cooperativa | CNPJ antes (placeholder) / depois (real) |
| `fix-delete-fantasmas-extremos.ts --dry-run` | 10 cooperados | 10 IDs a serem deletados |
| `fix-anomalias-cruzadas.ts --dry-run` | ~9 registros | Caso a caso |

### STEP 3 — Execução real (somente após Luciano aprovar cada output) [2-3h Code]

Re-rodar com `--apply`. Cada script registra log de auditoria.

**Ordem de execução segura:**
1. CNPJ tenant CoopereBR (mais simples, sem cascata)
2. distribuidora=OUTRAS → EDP_ES (295 UCs, dry-run claro)
3. DELETE 10 fantasmas extremos (cascata zero)
4. tarifaContratual backfill (71 contratos)
5. numeroUC via OCR existente (4 UCs)
6. Anomalias cruzadas caso a caso

### STEP 4 — Validação pós-saneamento [1-2h Code]

Scripts de SELECT que confirmam o estado pós-saneamento:
- 0 contratos ATIVOS CoopereBR sem `tarifaContratual` (era 71)
- 0 UCs CoopereBR com `distribuidora=OUTRAS` (era 295)
- 1 cooperativa CoopereBR com CNPJ real (era placeholder)
- 0 fantasmas extremos (era 10)
- 4 UCs com `numeroUC` novo via OCR (era 0 backfilled)

---

## Decisões de produto pendentes pro Luciano (consolidadas)

| # | Decisão | Bloqueia? |
|---|---|---|
| 1 | **Valor de referência `TARIFA_EDP_ES_2026`** pro backfill `tarifaContratual` (sugestão: R$ 0,93/kWh com tributos) | SIM (frente 1) |
| 2 | **CNPJ real da CoopereBR** (Junta Comercial) | SIM (frente 4) |
| 3 | **Existe planilha pré-migration** `numero → numeroUC`? | SIM (frente 3 — define se script OU OCR-only OU debt) |
| 4 | Estratégia fantasmas: **APROVAR opção (iii) MISTA** — DELETE 10 + manter 223 catalogados + manter 70 sintéticos + manter Carolina | SIM (frente 5) |
| 5 | Investigação operacional EDP-ES: pode exportar **lista de UCs vinculadas a CoopereBR**? | NÃO (alternativa pra Luciano explorar paralelo) |
| 6 | Decidir destino dos **2 contratos sem `planoId`** | NÃO (caso a caso, pode catalogar débito) |
| 7 | Decidir destino dos **8 contratos com `kwhContratoMensal=null`** (não-cooperebr1) | NÃO (cooperebr1 não impacta) |
| 8 | Decidir destino das **2 UCs cross-tenant** + **4 UCs sem tenant** | NÃO (raro, baixo risco) |

### Decisões prontas pra executar sem aprovação adicional

- Backfill `distribuidora=EDP_ES` em 295 UCs (todas em ES, tenant CoopereBR opera só EDP-ES — risco zero)
- DELETE 10 fantasmas extremos (cascata zero comprovada)
- Backfill `numeroUC` via OCR existente em 4 UCs (dado já no banco via OCR)

---

## Estimativa Sub-Sprint B consolidada

### Esforço Code

| Componente | Horas |
|---|---|
| Step 1 — Auditoria (scripts read-only) | 4-6h |
| Step 2 — DRY-RUN dos 6 scripts saneamento | 3-4h |
| Step 3 — Execução real após aprovações | 2-3h |
| Step 4 — Validação pós-saneamento | 1-2h |
| Catalogar débitos novos (D-novo-AG, etc.) | 30 min |
| **TOTAL Code** | **10-15h** |

### Esforço operacional Luciano

| Item | Tempo |
|---|---|
| Fornecer CNPJ real CoopereBR | 5 min |
| Decidir TARIFA_EDP_ES_2026 referência | 15 min |
| Confirmar opção (iii) fantasmas | 15 min |
| Investigar planilha pré-migration (frente 3) | 1-2 dias calendário |
| Aprovar 6 DRY-RUNs sequencialmente | 1-2h (concentradas em 1 sessão) |
| Investigar EDP-ES exportação lista UCs (opcional) | 1-2 semanas calendário |

### Duração calendário realista

- **Pista rápida** (sem planilha pré-migration): **3-5 dias** (1 sessão Code + 1 sessão decisões + aprovações + 1 sessão execução)
- **Pista completa** (com planilha pré-migration ou EDP-ES): **2-3 semanas** (espera input operacional)

### Sequência sugerida (pista rápida)

```
Dia 1 — Sub-Sprint B Fase 2 manhã:
  • Code roda Step 1 (auditoria — 6 scripts read-only)
  • Code apresenta outputs consolidados pra Luciano
  • Luciano fornece: CNPJ + TARIFA_EDP_ES + OK opção iii fantasmas

Dia 1 — Sub-Sprint B Fase 2 tarde:
  • Code escreve Step 2 (6 scripts DRY-RUN)
  • Code roda DRY-RUNs sequencialmente
  • Luciano aprova cada output

Dia 1 noite OU Dia 2 manhã:
  • Code executa Step 3 (--apply) na ordem segura
  • Code roda Step 4 (validação pós)
  • Fechamento Sub-Sprint B + commit

Dia 2+ (em paralelo):
  • Luciano investiga planilha pré-migration (frente 3)
  • Se encontrar: agenda Sub-Sprint B.2 pra import
```

---

## Achados extras pertinentes ao onboarding cooperebr1

### Achado 1: AMAGES tem dado OCR errado

Fatura processada AMAGES mostra `valorCheioKwh=0.2385` < `tarifaSemImpostos=0.46196` — fisicamente impossível. **Não usar como referência pra cálculos** de planos AMAGES até OCR ser revisado. Catalogar débito separado se relevante.

### Achado 2: Carolina já tem tarifaContratual (re-conferir)

A frente 1.1 conta 71 contratos sem `tarifaContratual`. A frente 5.4 confirma que Carolina é o ÚNICO cooperado real com contrato ATIVO. Se Carolina já está NOS 71 sem tarifa, o canário Sub-Fase A pode quebrar — precisa backfill imediato pra ela. Se Carolina está nos 5 COM tarifa, está tudo certo. **Verificar especificamente** no Step 1 da execução.

### Achado 3: 70 sintéticos com contrato ATIVO são massa de regressão valiosa

Esses 70 são exatamente o que o Sprint Bot Autoatendimento usou pra validar o motor dinâmico (234 specs verdes). Apagar destruiria capacidade de regression testing — opção (iii) preserva.

### Achado 4: usina-linhares (cooperebr1) tem ocupação 8,2% somente com sintéticos

Os 66 contratos ATIVOS da cooperebr1 que dão 12.259 kWh/mês são **todos sintéticos** (exceto Carolina). Quando importar massa real, a ocupação pode mudar drasticamente. Capacidade 150k kWh/mês oferece muita folga.

### Achado 5: A migração real precisará alocar cooperados-PJ E-Solares como proprietário

Não é parte do Sub-Sprint B (é Sub-Sprint F), mas a usina cooperebr1 hoje tem `proprietarioNome="ESOLARES"` como string solta. Quando E-Solares virar Cooperado PJ + ContratoUso, é importante que essas 295 UCs corretamente populadas após backfill **não criem conflito**.

---

## Apêndice — Dados quantitativos consolidados Sub-Sprint B

### Tabela executiva 6 frentes × esforço × bloqueador

| # | Frente | Strategy | Code | Input Luciano | Bloqueia? |
|---|---|---|---|---|---|
| 1 | tarifaContratual (71) | Script híbrido + tarifa referência | 2-3h | Tarifa referência + decisão 2 sem-plano | SIM |
| 2 | distribuidora=OUTRAS (295) | Script UPDATE EDP_ES | 1-2h | OK DRY-RUN | NÃO (zero risco) |
| 3 | numeroUC (238) | OCR existente + planilha | 1-2h imediato + 3-5h se planilha | Planilha sim/não | NÃO (debt aceito) |
| 4 | CNPJ tenant | UPDATE simples | 30-60 min | CNPJ real | SIM (cobrança Asaas) |
| 5 | Fantasmas (10 + 223 + 70) | DELETE 10 + manter resto | 30 min + 15 min debt | OK opção iii | NÃO |
| 6 | Validações cruzadas (~9 anomalias) | Caso a caso | 2-3h | Decisão caso a caso | NÃO |
| **TOTAL** | | | **10-15h Code** | **1 sessão Luciano + paralelos** | |

### Resumo numérico

| Dado | Antes | Depois (cenário otimista) |
|---|---|---|
| Cooperados ATIVO `ambienteTeste=true` | 303/304 | 303/304 (mantém — base regressão) |
| Cooperados reais com contrato | 1 (Carolina) | 1 + N (universo importado) |
| Fantasmas extremos | 10 | 0 (DELETE) |
| Cadastros sem contrato | 223 | 223 (catalogado D-novo-AG) |
| Contratos ATIVOS sem `tarifaContratual` | 71 | 0 (backfill) |
| UCs `distribuidora=OUTRAS` | 295 | 0 (UPDATE EDP_ES) |
| UCs sem `numeroUC` | 238 | 234 (4 backfill OCR) ou ≤ 65 se planilha aparecer |
| UCs `numeroConcessionariaOriginal` | 3/303 | 3/303 (sem ação adicional) |
| CNPJ CoopereBR | placeholder | real Luciano |
| Contratos com UC-cooperado divergente | 2 | 0 (UPDATE/DELETE) |
| Contratos sem `usinaId` | 1 | 0 (UPDATE/DELETE) |
| UCs cross-tenant | 2 | 0 (UPDATE/DELETE) |
| UCs sem tenant | 4 | 0 (UPDATE/DELETE) |

### Riscos catalogados

- **Risco baixo:** todas as alterações são reversíveis via rollback git + snapshot pg_dump prévio
- **Risco médio:** Carolina pode estar nos 71 sem tarifa — verificar individualmente antes do canário
- **Risco zero:** DELETE 10 fantasmas (cascata vazia comprovada)

### Pré-requisitos antes de Step 3 (--apply)

1. `pg_dump` do banco completo (backup obrigatório CLAUDE.md migration safety)
2. Confirmação Luciano via DRY-RUN de cada script
3. Working tree limpo + commit Sub-Sprint B Step 1+2 antes de --apply
4. PM2 estável (script não exige ritual PM2 — não mexe em código runtime)

---

## Conclusão e próximo passo

Sub-Sprint B é **executável em 1-2 sessões Code** (10-15h) + 1 sessão Luciano (decisões + aprovações). Sem dependências externas exceto **inputs simples do Luciano** (CNPJ, tarifa referência, decisão fantasmas).

**Próximo passo (após aprovação deste relatório):**

Sub-Sprint B Fase 2 EXECUÇÃO — 4 steps em ordem (auditoria → DRY-RUN → execução real → validação pós), com aprovação Luciano em cada DRY-RUN.

**Aguardo OK** do Luciano + respostas das **4 decisões críticas:**
1. TARIFA_EDP_ES_2026 referência
2. CNPJ real CoopereBR
3. Planilha pré-migration `numero → numeroUC` existe?
4. Opção (iii) MISTA pra fantasmas aprovada?
