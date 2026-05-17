# Especificação — Módulo Contabilidade Tributária Segregada (SISGD)

**Status:** 🟢 APROVADO em 17/05/2026 (Luciano) — aguarda execução na posição #8 do roadmap
**Estimativa:** 61h Code em 4 fases
**Origem:** memória persistente `sprint_contabilidade_cooperativa_segregada_16_05.md` (catalogada 16/05/2026 noite)
**Audiência:** Luciano (não-programador), Code (executor), contador externo (Walter — validação Fase 1)

---

## Resumo executivo

O SISGD precisa de um **módulo dedicado** para tratamento contábil-tributário diferenciado de **cooperativas e associações sem fins lucrativos**, conforme exige a Lei 5.764/71 (Art. 79 — ato cooperativo), o STF Tema 536 (PIS/COFINS não incide sobre ato cooperativo típico) e o STJ Tema 986 com sua ressalva para SCEE.

Este módulo é **complementar** (não substituto) do Sprint 7 (DRE+Conciliação+Fechamento Mensal genérico já catalogado no `PLANO-ATE-PRODUCAO.md`).

O **benefício inicial aprovado** é **APENAS ENERGIA_SCEE** — outros tipos (SAÚDE, ALIMENTAÇÃO, REFEIÇÃO, CONSIGNADO, MOBILIDADE_ELETRICA, OUTROS) ficam no schema mas habilitam por demanda real.

---

## 1. Justificativa jurídica (não inventada — fontes consagradas)

### 1.1 Lei 5.764/71 — Art. 79 (ato cooperativo)

> "Denominam-se atos cooperativos os praticados entre as cooperativas e seus associados, entre estes e aquelas e pelas cooperativas entre si quando associadas, para a consecução dos objetivos sociais.
>
> **Parágrafo único.** O ato cooperativo não implica operação de mercado, nem contrato de compra e venda de produto ou mercadoria."

### 1.2 Categorização jurídica em 3 naturezas

| Categoria | Definição | Tratamento tributário |
|---|---|---|
| **Ato Cooperativo Próprio** | Operações entre cooperativa e cooperados para consecução do objeto social | Sem fato gerador — isento PIS/COFINS/IRPJ/CSLL/ICMS |
| **Ato Cooperativo Auxiliar** | Operações com terceiros NECESSÁRIAS pra viabilizar atos próprios (convênios de custeio, recomposição de custos) | Trânsito não-tributado se cumprir requisitos formais (transparência + zero retenção indevida) |
| **Atos NÃO Cooperativos** | Operações com não-cooperados (recarga eletropostos público geral, venda direta) | Tributação plena (PIS, COFINS, IRPJ, CSLL, ICMS) |

### 1.3 Jurisprudência consagradora

- **STF Tema 536** (RE 599.362/RJ) — PIS/COFINS não incidem sobre ato cooperativo típico
- **STJ Tema 986 ressalva** (REsp 1.692.023/MT) — SCEE é empréstimo gratuito (não é operação de mercado)
- TJMT/TJPR consolidaram *distinguishing* para SCEE

### 1.4 Fundamento estatutário

Estatuto Reformado v3 da CoopereBR (AGE 17/06/2026) — Art. 11 §§ 1º-3º **exige segregação contábil**. Este módulo é a **infraestrutura de execução** dessa exigência estatutária.

### 1.5 Fundamento constitucional

- **CRFB Art. 5º, XVIII** — liberdade de cooperativas
- **CRFB Art. 146, III, "c"** — adequado tratamento ao ato cooperativo
- **CRFB Art. 174, § 2º** — apoio constitucional ao cooperativismo

---

## 2. Estado anterior à decisão (17/05/2026) — o que existia

Investigação exaustiva concluída em 17/05/2026. Mapa:

### 2.1 Financeiro genérico: ~50% pronto

- `PlanoContas` (24 contas seed) — `plano-contas.service.ts` 116 linhas
- `LancamentoCaixa` (53 lançamentos prod CoopereBR) — `lancamentos.service.ts` 285 linhas
- `ContaAPagar` — modelo + service mínimo, 0 registros prod
- Livro caixa — operacional
- DRE básica (RECEITAS−DESPESAS único) — endpoint `GET /financeiro/lancamentos/dre`
- Hooks contábeis CooperToken — `token-contabil.service.ts` 205 linhas (4 hooks)
- Asaas gateway — 462 linhas, em uso ativo
- BB/Sicoob — geração boleto, sem conciliação

### 2.2 Tributário: ~5% pronto

- `pix-excedente.service.ts` (294 linhas) — ÚNICO caso real, calcula PIX líquido após IR/PIS/COFINS
- Alíquotas configuráveis em `Condominio` — Float opcionais (`aliquotaIR`/`aliquotaPIS`/`aliquotaCOFINS`)
- OCR Claude AI extrai 50+ campos da fatura concessionária (ICMS/PIS/COFINS/TUSD/TE/Fio B) — `faturas.service.ts` 2253 linhas
- Snapshot `tarifaSemImpostos` em FaturaProcessada — usado em `motor-proposta.service.ts` 1763 linhas

### 2.3 Segregação cooperativa: 0% pronto

Campo `naturezaAto` é String livre default `"COOPERADO_PROPRIO"` em `LancamentoCaixa` (linha 1084 do schema), **nunca filtrado em queries de relatórios**. Plano de contas genérico tem apenas 4 contas tributárias (INSS/FGTS/IRRF/ISS) — falta PIS/COFINS/IRPJ/CSLL/ICMS. DRE consolidada simples sem segregação. Citações STF Tema 536 / STJ Tema 986 / Lei 5.764/71 aparecem apenas no glossário `REGULATORIO-ANEEL.md` linhas 943-945, sem implementação.

---

## 3. Arquitetura aprovada do módulo

### 3.1 Estrutura de pastas

```
backend/src/contabilidade-tributaria/    # 🆕 módulo dedicado
├── plano-contas-template/               # 4 templates por tipoParceiro
│   ├── cooperativa.template.ts          # com PROPRIO/AUXILIAR/NAO_COOPERATIVO
│   ├── consorcio.template.ts
│   ├── associacao.template.ts
│   └── condominio.template.ts
├── apuracao-fiscal/                     # motor de apuração mensal
│   ├── pis-cofins.service.ts            # com isenção STF Tema 536 quando ato próprio
│   ├── irpj-csll.service.ts             # com isenção quando ato próprio
│   ├── icms.service.ts                  # com ressalva STJ Tema 986 quando SCEE
│   └── iss.service.ts
├── dre-segregada/                       # 3 DREs paralelas + consolidada
│   ├── dre-ato-proprio.service.ts
│   ├── dre-ato-auxiliar.service.ts
│   ├── dre-ato-nao-cooperativo.service.ts
│   └── dre-consolidada.service.ts
├── demonstrativos-fiscais/              # defensabilidade Receita Federal
│   ├── demonstrativo-nao-lucratividade.service.ts
│   ├── demonstrativo-repasses.service.ts
│   └── memorial-calculo-fiscal.service.ts
├── convenios-segregados/                # convênios institucionais com classificação
├── fechamento-mensal/                   # bloqueio retroativo (compartilhado Sprint 7)
└── relatorios-fiscais.controller.ts
```

### 3.2 Módulo `financeiro/` atual permanece intocado

Continua cuidando de PlanoContas/LancamentoCaixa/PIX Excedente/ContaAPagar — cama-base. Novo módulo `contabilidade-tributaria/` consome o `financeiro/` por composição, não por substituição.

---

## 4. Fases de implementação (61h Code total)

### Fase 1 — Schema + Núcleo Contábil (12h)

#### Migrations Prisma

```prisma
// NOVO enum
enum NaturezaContabil {
  ATIVO
  PASSIVO
  PATRIMONIO_LIQUIDO
  RECEITA_ATO_COOPERATIVO_PROPRIO
  RECEITA_ATO_COOPERATIVO_AUXILIAR
  RECEITA_ATO_NAO_COOPERATIVO
  DESPESA_ATO_COOPERATIVO_PROPRIO
  DESPESA_ATO_COOPERATIVO_AUXILIAR
  DESPESA_ATO_NAO_COOPERATIVO
  FUNDOS_OBRIGATORIOS
}

// NOVO enum
enum NaturezaCooperativa {
  PROPRIO       // Art. 79 Lei 5.764/71
  AUXILIAR      // Convênios de custeio
  NAO_COOPERATIVO  // Operações com terceiros
}

// PROMOÇÃO campo String → enum (migração 2 passos)
model LancamentoCaixa {
  // ... campos existentes
  naturezaAto NaturezaCooperativa @default(PROPRIO)
}

// EXPANSÃO PlanoContas
model PlanoContas {
  // ... campos existentes
  naturezaContabil     NaturezaContabil
  naturezaCooperativa  NaturezaCooperativa?
  fundamentoLegal      String?  // ex: "Art. 79 Lei 5.764/71"
}
```

#### Migração em 2 passos (regra de segurança schema do CLAUDE.md)

**Passo 1 — UPDATE para normalizar:**
- Auditar valores existentes de `naturezaAto` (String livre) em LancamentoCaixa
- Mapear: `"COOPERADO_PROPRIO"` → `PROPRIO`, demais valores → análise caso-a-caso
- Reportar a Luciano antes de aplicar

**Passo 2 — ALTER TYPE:**
- Converter coluna para enum
- Validar com SELECT pós-migração

#### Tarefas

- Migration schema (Prisma) — `prisma migrate dev` com review do SQL gerado, NÃO `db push` cego
- Service contábil base (validação que natureza herda da conta)
- Seed inicial de contas típicas cooperativas (4 templates por tipoParceiro — só cooperativa.template.ts populado na Fase 1; outros como stubs)
- Smoke E2E migration

### Fase 2 — Módulo Convênios Segregados (16h)

#### Schema

```prisma
model Convenio {
  id                  String   @id @default(cuid())
  nome                String
  tipoBeneficio       TipoBeneficio
  cooperativaId       String
  cooperativa         Cooperativa @relation(fields: [cooperativaId], references: [id])
  cooperadoPagadorId  String?
  cooperadoPagador    Cooperado?  @relation("ConvenioPagador", fields: [cooperadoPagadorId], references: [id])
  beneficiarios       Cooperado[] @relation("ConvenioBeneficiarios")
  fluxoFinanceiro     FluxoConvenio
  classificacaoFiscal String   // ex: "Ato Auxiliar Art. 79 + STF Tema 536"
  valorMensalAporte   Decimal?
  vigenciaInicio      DateTime
  vigenciaFim         DateTime?
  ativo               Boolean  @default(true)
  // ...
}

// 🟢 INICIAL APROVADO 17/05/2026: somente ENERGIA_SCEE habilitado em produção
enum TipoBeneficio {
  ENERGIA_SCEE          // ✅ INICIAL — único habilitado em produção
  SAUDE                 // 🟡 schema OK, habilitar por demanda
  ALIMENTACAO           // 🟡 schema OK, habilitar por demanda
  REFEICAO              // 🟡 schema OK, habilitar por demanda
  CONSIGNADO            // 🟡 schema OK, habilitar por demanda
  MOBILIDADE_ELETRICA   // 🟡 schema OK, habilitar por demanda (depende Eletropostos)
  OUTROS                // 🟡 fallback
}

enum FluxoConvenio {
  INGRESSO_CUSTEIO_ATO_AUXILIAR
  REPASSE_PROVEDOR_EXTERNO
  CUSTO_OPERACIONAL_INTERNO
}
```

#### Validação no service

Ao criar Convenio, se `tipoBeneficio !== 'ENERGIA_SCEE'` e flag `feature_convenios_outros_tipos` (em ConfigTenant) for `false` (default `false` em produção), retornar:

```typescript
throw new BadRequestException(
  'Tipo de benefício não habilitado em produção — apenas ENERGIA_SCEE liberado nesta fase. ' +
  'Para habilitar outros tipos, contate o administrador SaaS.'
)
```

#### Lógica de negócio

- Aporte do cooperado-pagador → conta `INGRESSO_CUSTEIO_ATO_AUXILIAR` (natureza AUXILIAR)
- Repasse a provedor externo → conta `DESPESA_REPASSE_CONVENIO` (natureza AUXILIAR)
- Custo operacional interno → conta `DESPESA_OPERACIONAL_CONVENIO` (natureza AUXILIAR)
- Validação: soma de repasse + custo operacional = valor recebido (zero retenção indevida)
- Sistema NÃO calcula PIS/COFINS/IRPJ sobre fluxo AUXILIAR
- Audit trail completo via AuditLog (depende D-30N — interceptor ainda não ativo)

### Fase 3 — DRE Segregada (14h)

#### 3 DREs paralelas + 1 consolidada

**DRE Ato Cooperativo Próprio:**
- Receitas: mensalidades cooperativas, contribuições de custeio próprio
- Despesas: operação cooperativa direta
- Resultado: sobras líquidas (sem tributos)

**DRE Ato Cooperativo Auxiliar:**
- Ingressos: aportes de convênios
- Dispêndios: repasses a provedores + custos operacionais
- Resultado: zero (mera recomposição de custos)

**DRE Atos NÃO Cooperativos:**
- Receitas: recarga eletropostos público geral, vendas a terceiros
- Despesas: custos operacionais, manutenção, etc.
- Resultado: tributação plena (PIS + COFINS + IRPJ + CSLL + ICMS aplicáveis)

**DRE Consolidada:**
- Soma das 3 com identificação clara por natureza

#### Endpoints

- `GET /contabilidade/dre/proprio?ano=2026&mes=05`
- `GET /contabilidade/dre/auxiliar?ano=2026&mes=05`
- `GET /contabilidade/dre/nao-cooperativo?ano=2026&mes=05`
- `GET /contabilidade/dre/consolidada?ano=2026&mes=05`

### Fase 4 — Relatórios Fiscais + UI (19h)

#### Relatórios

- **Demonstrativo de Não-Lucratividade** (Ato Próprio = R$ 0 tributos)
- **Demonstrativo de Repasses** (fluxo INTEGRAL pra provedor — evidencia não-retenção)
- **Memorial de Cálculo Fiscal Segregado** (defesa pra Receita Federal em auditoria)
- **Apuração tributária por natureza** (mensal)
- **Relatório de Convênios** (todos os convênios + tipo + natureza + fluxos)

#### UIs

- `/dashboard/contabilidade-tributaria/plano-contas` — gestão plano de contas com naturezas visíveis
- `/dashboard/contabilidade-tributaria/convenios` — gestão convênios com classificação automática (UI só mostra ENERGIA_SCEE em produção)
- `/dashboard/contabilidade-tributaria/dre-segregada` — visualização DRE por natureza (4 abas)
- `/dashboard/contabilidade-tributaria/relatorios-fiscais` — exportação para auditoria (PDF + CSV)
- `/dashboard/contabilidade-tributaria/apuracao` — apuração tributária mensal

---

## 5. Distinção com Sprint 7 (genérico)

| Aspecto | Sprint 7 (genérico) | Sprint Contabilidade Cooperativa Segregada (#8) |
|---|---|---|
| Foco | Qualquer parceiro | COOPERATIVA + ASSOCIAÇÃO sem fins lucrativos |
| Cobre | DRE consolidada simples + conciliação BB/Sicoob + fechamento mensal | NaturezaContabil + Convênios segregados + 3 DREs paralelas + relatórios fiscais defensáveis |
| Estimativa | 2-3 semanas | 61h Code (4 fases) |
| Pré-requisito | Walter (contador externo) precisa fechar abr/2026 | Reforma Estatutária CoopereBR 17/06/2026 (Art. 11 §§ 1º-3º exige segregação) |
| Cobre tributário? | Não diretamente | Sim — isenções STF Tema 536 + ressalva STJ Tema 986 |
| Cobre SPED/NF3e? | Não | Não — vai pra Sprint Compliance Fiscal separado (futuro) |

**São complementares, não substitutos.**

---

## 6. Conexão com outros sprints e módulos

- **Bloco B (Sprint CT Consolidado)** — CooperToken como ato cooperativo próprio (vocabulário unificado)
- **Sprint G Assinafy** — assinatura digital de relatórios fiscais segregados
- **Sprint Módulo Documentos** — templates de declarações cooperativas (variáveis `{{natureza.proprio}}`, etc)
- **Sprint Módulo Compliance** (108h em 3 partes) — segregação contábil ERA originalmente parte deste sprint maior; foi extraída pra este sprint dedicado em 16/05/2026
- **Sprint Compliance Fiscal** (SPED/NF3e/eSocial) — sprint futuro separado, posição #11+ (40-60h estimadas)
- **Reforma Estatutária 17/06/2026** — Art. 11 §§ 1º-3º do Estatuto v3 requer essa segregação
- **Dossiê Judicial CoopereBR × EDP** — Tese G transversal usa segregação contábil como prova material

---

## 7. Posicionamento no Plano A→H consolidado

| Pos | Bloco/Sprint | Estado | h |
|---|---|---|---|
| 1 | ✅ A — Sub-Fase B AMAGES | Concluído (M4) | — |
| 2 | ✅ H' — Cadastro Usina expandido | Concluído (M5) | — |
| 3 | ✅ C — Cadastro SEM_UC UI | Concluído (M6) | — |
| 4 | 🎯 D — 3 crons proativos | **EM ANDAMENTO** | 8-12 |
| 5 | B — Sprint CT Consolidado | ⏸️ | 21-26 |
| 6 | E — Realocação Multi-Usina | ⏸️ Depende H' (✅) | 16-24 |
| 7 | F — Automação Concessionária | ⏸️ Depende E | 24-32 |
| **8** | **🆕 Sprint Contabilidade Tributária Segregada** | ⏸️ **APROVADO 17/05/2026** | **61** |
| 9 | G — Sprint Assinafy | ⏸️ Pré-req Documentos | 12-16 |
| 10 | Sprint Módulo Documentos | ⏸️ Depende G | 46 |
| 11 | Sprint Módulo Compliance (Onboarding+Voto, Trava Crédito, Eletropostos) | ⏸️ Pós-Documentos | 84 |
| 12 | Sprint Módulo Compliance Fiscal (SPED/NF3e/eSocial) | ⏸️ Pós-Contabilidade Segregada | 40-60 |
| 13 | Sprint Módulo Classificação GD | ⏸️ Pós-dossiê | 8-12 |
| 14 | D-novo-E Reflexos reforma estatutária | ⏸️ Pós-AGE 17/06/2026 | 8-12 |

**Restante estimado:** 254-292h (anterior) + 61h = **315-353h Code** = 13-15 sessões dedicadas em série.

---

## 8. Decisões pendentes

| # | Decisão | Status | Responsável |
|---|---|---|---|
| 1 | Validação plano de contas modelo cooperativo | 🟡 Pendente — ocorre na Fase 1 antes da migration | Walter (contador) + Luciano |
| 2 | Tipos de benefício suportados inicialmente | ✅ **APROVADO 17/05/2026: APENAS ENERGIA_SCEE** | Luciano |
| 3 | Integração com sistemas contábeis externos | ✅ **APROVADO 17/05/2026: separado em Sprint Compliance Fiscal próprio** | Luciano |
| 4 | Posição no roadmap | ✅ **APROVADO 17/05/2026: #8 mantida** | Luciano |

---

## 9. Não confundir com outros sprints/conceitos

- **NÃO substitui Sprint 7** — Sprint 7 cobre DRE consolidada simples + conciliação bancária + fechamento mensal **genérico**. Este sprint cobre segregação cooperativa **específica**. Complementares.
- **NÃO é o Sprint Módulo Compliance** — aquele tem 108h em 3 partes (Onboarding+Voto, Trava Crédito ICP, Eletropostos). Segregação contábil saiu de lá em 16/05/2026 e ganhou sprint próprio.
- **NÃO inclui SPED/NF3e/eSocial** — vai pra Sprint Compliance Fiscal separado (40-60h estimadas, ainda não detalhado).
- **NÃO mexe no módulo `financeiro/` atual** — cama-base permanece intocada. Novo módulo `contabilidade-tributaria/` consome por composição.
- **NÃO é exclusivo da CoopereBR** — vai beneficiar todos os parceiros cooperativos/associativos do SaaS multi-tenant. CoopereBR é o primeiro caso de uso.

---

## 10. Aprendizado preservado

Esta spec nasceu da **análise crítica de materiais Gemini compliance** (16/05/2026 noite):
- Gemini hallucinou: scripts Python tautológicos, caminho `sys/sisgdsolar/helpcontent/...` inexistente, conceitos como "fundo carimbado no banco" sem fundamento técnico, comportamentos automatizados não implementados.
- Gemini acertou: a **questão jurídica** de segregação contábil cooperativa (Lei 5.764/71 Art. 79 + STF Tema 536 + STJ Tema 986 ressalva).

Padrão de hallucination IAs externas: conteúdo jurídico VÁLIDO + implementação técnica INVENTADA + tom "já existe" FALSO. Procedimento: preservar conceito jurídico, descartar código fictício, validar com filesystem real.

Esta spec é tecnicamente válida porque:
- Schema Prisma real (compatível com SISGD atual)
- Stack correto (Node.js/TypeScript/NestJS)
- Conceitos baseados em Lei 5.764/71 + STF + STJ (não inventados)
- Esforço realista (61h Code distribuído em 4 fases)
- Integração com módulos existentes (PlanoContas, Lancamentos, Convenios já parcialmente no schema)

---

## 11. Status atualizado

- **Catalogado em memória:** 16/05/2026 (`sprint_contabilidade_cooperativa_segregada_16_05.md`)
- **Aprovado por Luciano:** 17/05/2026 (`decisao_modulo_contabilidade_tributaria_17_05.md`)
- **Especificação oficial em docs/:** 17/05/2026 (este arquivo)
- **Adicionado ao `PLANO-ATE-PRODUCAO.md`:** 17/05/2026 (posição #8)
- **Execução estimada:** após Bloco F (Automação Concessionária) — não antes
- **Versão deste documento:** v1.0
