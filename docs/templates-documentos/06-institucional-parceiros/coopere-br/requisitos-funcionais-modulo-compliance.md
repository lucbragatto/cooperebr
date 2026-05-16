# Requisitos Funcionais — Módulo Compliance CoopereBR

**Status:** 📋 Especificação de requisitos para sprint FUTURO (não código pronto)
**Origem:** Material conceitual recebido de outra IA (Gemini). Conteúdo jurídico válido, mas implementação descrita é fictícia.
**Implementação real estimada:** ~108h Code, distribuído em múltiplos sprints

⚠️ **AVISO IMPORTANTE:** Este documento descreve **REQUISITOS** de um módulo Compliance que ainda **NÃO existe** no SISGD. NÃO é descrição do sistema atual. Será implementado em sprints específicos após:
- Bloco G — Sprint Assinafy (assinatura digital ICP-Brasil)
- Sprint Módulo Documentos Multi-Tenant (templates editáveis)
- AGE 17/06/2026 (aprovação da reforma estatutária)

---

## Visão geral

Após a reforma estatutária prevista para 17/06/2026, a CoopereBR adotará novas exigências de governança que requerem reflexos no SISGD. O **Módulo Compliance** será o componente do sistema responsável por **automatizar a verificação dessas exigências**.

## 4 áreas de compliance previstas

### 1. Onboarding de Cooperados com restrição de voto

**Requisito jurídico (Estatuto Reformado v3, Arts. 7º e 8º Par. Único):**
- Toda admissão de cooperado deve ter Ficha de Matrícula assinada arquivada (PDF físico ou digital)
- Apenas Cooperados Fundadores têm direito a voto em assembleia
- Beneficiários e Investidores/Provedores NÃO têm direito a voto

**Estado atual SISGD:**
- ❌ Schema Cooperado **NÃO** tem campo de direito a voto
- ❌ Upload de PDF da Ficha de Matrícula **NÃO** implementado
- ❌ Categorias `BENEFICIARIO` / `INVESTIDOR_PROVEDOR` / `FUNDADOR` **NÃO** existem como enum
- ✅ Schema tem `TipoCooperado.SEM_UC` (parcialmente alinhado, Bloco C atual destrava)

**Requisitos de implementação:**

| Item | Esforço |
|---|---|
| Adicionar enum `CategoriaCooperado` (FUNDADOR \| BENEFICIARIO \| INVESTIDOR_PROVEDOR) | 1h |
| Adicionar campo `direitoVoto Boolean @default(false)` no Cooperado | 1h |
| Adicionar campo `fichaMatriculaPdfUrl String?` | 1h |
| UI upload PDF Ficha de Matrícula no cadastro | 3h |
| Validação backend: SEM_UC → BENEFICIARIO ou INVESTIDOR_PROVEDOR; só FUNDADOR → direitoVoto=true | 2h |
| Smoke E2E + migration | 2h |
| Reflexo em relatórios de assembleia (quem pode votar) | 2h |

**Total: ~12h Code**

### 2. Segregação de Contas Bancárias por tipo de Convênio

**Requisito jurídico (Estatuto Reformado v3, Art. 11 §§ 1º e 2º):**
- Aportes financeiros oriundos de "Convênios de Custeio" devem ser tratados como **Ingressos de Custeio para Ato Cooperativo Auxiliar**
- NÃO integram faturamento comercial nem base de cálculo tributária mercantil
- Devem ter classificação contábil segregada (`INGRESSO_CUSTEIO_ATO_AUXILIAR`)

**Estado atual SISGD:**
- ✅ Módulo `financeiro` existe (planoContas, lancamentos, convenios)
- ❌ Conta contábil específica `INGRESSO_CUSTEIO_ATO_AUXILIAR` **NÃO** existe
- ❌ Webhook bancário pra classificação automática **NÃO** existe
- ❌ DRE segregada por natureza (operacional vs ato cooperativo auxiliar) **NÃO** existe
- ⚠️ Conciliação BB/Sicoob é meio-nome (D-49 catalogado)

**Requisitos de implementação:**

| Item | Esforço |
|---|---|
| Seed conta contábil `INGRESSO_CUSTEIO_ATO_AUXILIAR` no PlanoContas | 1h |
| Adicionar tipo `CONVENIO_CUSTEIO` em Lancamentos | 2h |
| Webhook bancário classificação automática (BB/Sicoob/Asaas) | 8h |
| DRE segregada (ato cooperativo principal × auxiliar) | 6h |
| Relatório fiscal segregado para auditorias Receita Federal | 4h |
| Validação: aportes de convênio NÃO calculam PIS/COFINS/IRPJ | 3h |

**Total: ~24h Code**

### 3. Telemetria e Bilhetagem de Eletropostos (REN ANEEL 819/2018)

**Requisito jurídico (Estatuto Reformado v3, Art. 11 § 3º):**
- Estações de recarga em vias públicas geram receita não-operacional
- Excedentes financeiros de "PUBLICO_GERAL" devem ser revertidos ao Fundo de Reserva para expansão da rede
- Tratamento como serviço de recarga (não venda de energia) — REN ANEEL 819/2018

**Estado atual SISGD:**
- ❌ Módulo Eletropostos **NÃO** existe
- ❌ Schema Eletroposto **NÃO** existe
- ❌ Telemetria de carregadores **NÃO** existe
- ❌ Bilhetagem **NÃO** existe
- ❌ Sistema de "fundo restrito carimbado" **NÃO** existe

**Pré-requisito:** aprovação reforma estatutária 17/06/2026 (expansão de objeto social pra mobilidade elétrica).

**Requisitos de implementação:**

| Item | Esforço |
|---|---|
| Schema `Eletroposto` + `SessaoRecarga` + `FundoRestrito` | 4h |
| Módulo backend `eletropostos` (CRUD + telemetria) | 8h |
| Integração com firmware OCPP 1.6/2.0 dos carregadores | 12h |
| API bilhetagem (cobrança usuário) + gateway pagamento | 6h |
| Classificação automática usuário (COOPERADO × PUBLICO_GERAL) | 3h |
| Rotina destinação automática excedente → Fundo Reserva | 3h |
| UI gestão eletropostos | 4h |

**Total: ~40h Code** (sprint dedicado)

### 4. Trava de Operações de Crédito Bancário (Alçadas Estatutárias)

**Requisito jurídico (Estatuto Reformado v3, Art. 16 § 2º):**
- Empréstimos, financiamentos, oneração de bens exigem:
  - Aprovação prévia em Assembleia Geral
  - Assinatura conjunta Diretor-Presidente + Presidente Conselho Fiscal
- Para o dia a dia: assinatura isolada do Diretor-Presidente

**Estado atual SISGD:**
- ⚠️ Integração bancária BB/Sicoob existe mas SEM trava de alçada estatutária
- ❌ Workflow de aprovação multi-step **NÃO** existe
- ❌ Integração ICP-Brasil **NÃO** existe (Assinafy é Sprint G pendente)
- ❌ Vinculação automática Ata AGE → Operação Financeira **NÃO** existe
- ✅ AuditLog disponível (Sprint Fase 2F, 15/05/2026)

**Requisitos de implementação:**

| Item | Esforço |
|---|---|
| Schema `OperacaoCredito` com estados (PENDENTE_ASSEMBLEIA, AGUARDANDO_2_ASSINATURAS, APROVADO, REJEITADO) | 3h |
| Workflow de aprovação multi-step | 6h |
| Vinculação obrigatória de PDF da Ata AGE | 3h |
| Integração Assinafy/DocuSign para coleta de 2 assinaturas ICP | 8h |
| Validação: empréstimo bloqueado se Ata AGE ausente ou sem aprovação assemblear | 4h |
| Trava na API bancária: status APROVADO_TOTAL apenas após 2 assinaturas + Ata | 4h |
| UI gestão operações de crédito | 4h |

**Total: ~32h Code** (depende Sprint G Assinafy)

---

## Sequenciamento sugerido

```
1. Aprovação Reforma Estatutária 17/06/2026 (AGE)
   ↓
2. Bloco C — Cadastro SEM_UC UI (4-6h) — ATUAL
   ↓
3. Bloco D — 3 crons proativos (8-12h)
   ↓
4. Bloco B — Sprint CT Consolidado (21-26h)
   ↓
5. Bloco E — Realocação Multi-Usina (16-24h)
   ↓
6. Bloco F — Automação Concessionária (24-32h)
   ↓
7. Bloco G — Sprint Assinafy (12-16h) → habilita ICP-Brasil
   ↓
8. Sprint Módulo Documentos (46h)
   ↓
9. Sprint Módulo Compliance Parte 1 — Onboarding + Voto (12h)
   ↓
10. Sprint Módulo Compliance Parte 2 — Segregação Contas + DRE (24h)
   ↓
11. Sprint Módulo Compliance Parte 3 — Trava Crédito + ICP-Brasil (32h)
   ↓
12. Sprint Módulo Eletropostos (40h) — depende aprovação reforma estatutária mobilidade
```

**Esforço total Módulo Compliance:** ~108h Code (12 + 24 + 32 + 40)

---

## Origem deste documento

Material conceitual recebido em 16/05/2026 do Luciano, originado de conversa anterior dele com IA externa (Gemini). Os arquivos `gemini-code-1778942992577.md` e `gemini-code-1778942987938.py` foram analisados e:

- **Conteúdo jurídico-conceitual:** preservado neste documento como requisitos funcionais
- **Implementação Python proposta:** descartada (linguagem incorreta — SISGD é Node.js/TypeScript; testes eram tautológicos; conceitos fictícios)

Detalhes da análise: ver memória persistente `analise_arquivos_gemini_compliance_16_05.md`.

---

## Próxima ação

Este documento é **referência futura**. Não bloqueia o caminho crítico atual (Bloco C → D → B → E → F → G). Os sprints de Compliance entram após Bloco G + Sprint Módulo Documentos.

**Reflexo no plano A→H:** ver `plano_h_linha_modular_16_05.md` na memória persistente.
