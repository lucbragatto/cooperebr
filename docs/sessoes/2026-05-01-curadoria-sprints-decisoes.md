# Curadoria de sprints — Material pra decisão Luciano

**Data:** 01/05/2026
**Total a decidir:** 25 sprints (15 confirmações rápidas + 8 absorções + 6 órfãos + 10 renumerações)
**Formato:** marcar **[X]** na opção escolhida pra cada sprint
**Fontes:** mapeamento `1be9b34` + plano `29bb7aa` + PLANO-ATE-PRODUCAO.md atual

---

## Como usar este documento

1. **Bloco 1** — só confirmar com **[X] OK** que cada sprint concluído está registrado.
2. **Bloco 2** — confirmar absorção proposta OU escolher alternativa.
3. **Bloco 3** — decidir o que fazer com 6 sprints órfãos (sem absorção clara).
4. **Bloco 4** — confirmar renumeração da pilha nova.
5. **Bloco 5** — pilha consolidada gerada por Code com base nas opções recomendadas (pra você ver o resultado).
6. Depois de marcar tudo, próximo prompt aplica em todos os arquivos.

---

# BLOCO 1 — CONFIRMAÇÕES RÁPIDAS (15 sprints concluídos)

Apenas confirmar que estão registrados como **histórico imutável**. Não precisa decidir nada além disso.

| # | Sprint antigo | Tema | Concluído em | Commits-chave | Confirma? |
|---|---|---|---|---|---|
| 1 | Sprint 1 | Bootstrap inicial (T0-T2 derivados) | mar/2026 | `779631c` | [ ] OK |
| 2 | Sprint 2 | Tickets T0-T2 | mar/2026 | `3acb013` | [ ] OK |
| 3 | Sprint 2.5 | T3 (motor proposta inicial) | mar/2026 | `4ff48d2` | [ ] OK |
| 4 | Sprint 3 | T4-PRE + T4 (snapshots Plano→Contrato) | mar/2026 | `0b00d49` | [ ] OK |
| 5 | Sprint 5 | Engine de cobrança refatorada (snapshots, MUC fix, anti-duplicação T1-T8) | abr/2026 | `9174461` + 8 commits | [ ] OK |
| 6 | Sprint 6 | Tickets 6-11 (cron mensal FaturaSaas T10) | abr/2026 | `b5db585` + `fd35c0d` | [ ] OK |
| 7 | Sprint 7 | Gateway multi-tenant Asaas (Etapas 1-5) | abr/2026 | `f1487d3` + `0c435cf`, `b0b231b`, `11a6390` | [ ] OK |
| 8 | Sprint 8a | CooperToken modoRemuneracao + saldo | abr/2026 | `7c2bbca`, `8adf91b`, `cb7b41b` | [ ] OK |
| 9 | Sprint 8b | CooperToken webhook + ativação tokens + WA/email | abr/2026 | `0cc28a7` + `7d34111`, `ec35e06`, `487e940` | [ ] OK |
| 10 | Sprint 9 | Contabilidade Clube + efeitoMudancaFaixa + E2E sandbox | abr/2026 | `244819f`, `5d3bd82`, `f6caeee` | [ ] OK |
| 11 | Sprint 9b | Convênios + tokens + ofertas exclusivas + seed Hangar/Moradas | abr/2026 | `22fe6b1`, `dc33c2e`, `2c5c742`, `f9f23a7` | [ ] OK |
| 12 | Sprint 10 | LGPD + CADASTRO_V2 + lembretes 24h + cópia assinada | abr/2026 | `c075f05` + `c4f6ebf`, `0b9a6ec` | [ ] OK |
| 13 | Sprint 11 | Arquitetura UC consolidada (3 campos + distribuidora enum) | abr/2026 | `ef59162` + `f36496f`, `559a87d`, `4619bf9` | [ ] OK |
| 14 | Sprint 12 | Webhook Asaas sandbox validado + 3 bugs P1 corrigidos | 27/04/2026 | `4d20086`, `16302e9` | [ ] OK |
| 15 | Sprint 13a | Painel SISGD super-admin + lista parceiros + cards saúde + IDOR fix | 28/04/2026 | `7f29bd6`, `8c2f678`, `1569ca8` | [ ] OK |

**Decisão global Bloco 1:**
- [ ] (A) Confirmar TODOS os 15 como histórico imutável (recomendado)
- [ ] (B) Quero revisar caso a caso (qual?): ___

---

# BLOCO 2 — ABSORÇÕES PROPOSTAS (8 sprints)

Code propõe absorção. Confirmar ou ajustar.

---

### Sprint 13b — AuditLog ativo + Impersonate

**Escopo original:** ativar interceptor `AuditLog` (tabela já existe desde 13a Dia 1, schema OK, 0 registros) + Impersonate completo pra SUPER_ADMIN entrar como admin parceiro.

**Por que absorver:** AuditLog é pré-requisito regulatório (Sprint 5 novo precisa logar mudanças de flags) E pré-requisito de IDOR (Sprint 6 valida audit). Impersonate é governança financeira.

**Proposta Code:** AuditLog → Sprint 5+6 novos; Impersonate → Sprint 7 novo

**Decisão Luciano:**
- [ ] (A) Aceitar proposta (AuditLog em Sprint 5+6, Impersonate em Sprint 7)
- [ ] (B) Manter como Sprint próprio (renumerado)
- [ ] (C) Descartar Impersonate, manter só AuditLog absorvido
- [ ] (D) Outra: ___

---

### Sprint 13c — Edição plano SaaS + suspensão de parceiro

**Escopo original:** modal alterar plano + botões suspender/reativar parceiro + email automático ao parceiro afetado.

**Por que absorver:** governança financeira do SaaS é parte do Sprint 7 novo (DRE + Conciliação + Fechamento).

**Proposta Code:** absorver em **Sprint 7 novo** (DRE + Conciliação + Fechamento Mensal)

**Decisão Luciano:**
- [ ] (A) Aceitar proposta (absorver em Sprint 7)
- [ ] (B) Manter como Sprint próprio
- [ ] (C) Descartar
- [ ] (D) Outra: ___

---

### Sprint 14 — Cron FaturaSaas pré-produção

**Escopo original:** consolidar fluxo de cobrança SaaS (Luciano cobra parceiros) com Asaas, comunicação e fluxo de pagamento.

**Por que absorver:** cobre exatamente o mesmo escopo que Sprint 1 novo (FaturaSaas Completo).

**Proposta Code:** absorver em **Sprint 1 novo** (FaturaSaas Completo)

**Decisão Luciano:**
- [ ] (A) Aceitar proposta (absorver em Sprint 1)
- [ ] (B) Manter como Sprint próprio
- [ ] (C) Descartar
- [ ] (D) Outra: ___

---

### Sprint 17 — Engine COMPENSADOS

**Escopo original:** desbloquear `BLOQUEIO_MODELOS_NAO_FIXO` + implementar engine COMPENSADOS validada com fatura real (alto risco — afeta cálculo de cobrança real).

**Por que absorver:** Sprint 2 novo (OCR-Integração + DINAMICO atômico) cobre os 2 modelos juntos.

**Proposta Code:** absorver em **Sprint 2 novo**

**Decisão Luciano:**
- [ ] (A) Aceitar proposta (absorver em Sprint 2)
- [ ] (B) Manter como Sprint próprio (mais granularidade)
- [ ] (C) Descartar
- [ ] (D) Outra: ___

---

### Sprint 18 — Engine DINAMICO

**Escopo original:** implementar `CREDITOS_DINAMICO` (hoje `NotImplementedException` em `faturas.service.ts:1878`) com integração `TarifaConcessionaria` + fallback retroativo.

**Por que absorver:** mesmo Sprint 2 novo (atômico com COMPENSADOS).

**Proposta Code:** absorver em **Sprint 2 novo**

**Decisão Luciano:**
- [ ] (A) Aceitar proposta (absorver em Sprint 2)
- [ ] (B) Manter como Sprint próprio
- [ ] (C) Descartar
- [ ] (D) Outra: ___

---

### Sprint 19 — DRE por parceiro

**Escopo original:** endpoint DRE consolidado com receita/despesas/lucro por parceiro.

**Por que absorver:** Sprint 7 novo (DRE + Conciliação + Fechamento) cobre.

**Proposta Code:** absorver em **Sprint 7 novo**

**Decisão Luciano:**
- [ ] (A) Aceitar proposta (absorver em Sprint 7)
- [ ] (B) Manter como Sprint próprio
- [ ] (C) Descartar
- [ ] (D) Outra: ___

---

### Sprint 20 — Conciliação CNAB (BB/Sicoob)

**Escopo original:** conciliar extrato bancário com `LancamentoCaixa` (BB/Sicoob são integrações de geração de boleto, não conciliação ainda).

**Por que absorver:** Sprint 7 novo já inclui conciliação bancária.

**Proposta Code:** absorver em **Sprint 7 novo**

**Decisão Luciano:**
- [ ] (A) Aceitar proposta (absorver em Sprint 7)
- [ ] (B) Manter como Sprint próprio (CNAB é específico)
- [ ] (C) Descartar (não usar BB/Sicoob — só Asaas)
- [ ] (D) Outra: ___

---

### Sprint 22 — Audit Trail global

**Escopo original:** Audit Trail global cobrindo todas as ações sensíveis do sistema (não só configurações).

**Por que absorver:** AuditLog interceptor instalado em Sprint 6 novo (Auditoria IDOR Geral) já cobre globalmente.

**Proposta Code:** absorver em **Sprint 6 novo**

**Decisão Luciano:**
- [ ] (A) Aceitar proposta (absorver em Sprint 6)
- [ ] (B) Manter como Sprint próprio
- [ ] (C) Descartar
- [ ] (D) Outra: ___

---

### Sprint 23 — Templates por parceiro (absorção parcial)

**Escopo original:** biblioteca de templates por parceiro (documentos, comunicação WA/email, relatórios, faturas).

**Por que cuidado:** Sprint 3 novo (Banco de Documentos Assinafy) cobre templates de **documentos legais** (5 tipos), mas NÃO cobre templates de WA/email/relatório.

**Proposta Code:** absorver **parcialmente** em Sprint 3 novo (parte documentos legais); restante (WA/email/relatório) vira **Sprint independente** ou desmembra em sprints menores.

**Decisão Luciano:**
- [ ] (A) Aceitar absorção parcial (docs em Sprint 3, restante vira Sprint X)
- [ ] (B) Absorver TUDO em Sprint 3 (escopo cresce)
- [ ] (C) Manter como Sprint próprio (todos os templates juntos)
- [ ] (D) Descartar (já existe `ModeloMensagem` parcialmente)
- [ ] (E) Outra: ___

---

# BLOCO 3 — ÓRFÃOS — DECISÃO REAL (6 sprints)

Sprints antigos sem equivalente direto na pilha nova. Decidir.

---

### Sprint 15 — Cadastro Condomínio atomizado

**Escopo original:** cadastro completo de Condomínio em 1 fluxo (síndico cria condomínio → adiciona unidades → vincula condôminos → gera cobranças agregadas).

**Estado atual:** schema existe (`Condominio` + `UnidadeCondominio` = 1 + 10 registros de teste). Tela `/dashboard/condominios/{,novo,[id]}` existe (3 telas). **Fluxo guiado não está pronto.** Persona Helena (síndica do Moradas da Enseada) está em PRODUTO.md (papel 8).

**Estimativa:** 5-7 dias de Code.
**Severidade:** P1 se Luciano quer atender condomínios; P3 se foco é cooperativa pura.

**Por que importa:** descartar significa Helena fica como "persona aspiracional" — Moradas da Enseada não consegue migrar pro SISGD.

**Recomendação Code:** **(A) Adicionar como Sprint novo**, prioridade P2 (depois de Sprints 14-23 da pilha renumerada).

**Decisão Luciano:**
- [ ] (A) Adicionar como Sprint novo — qual prioridade? P1 / P2 / **P3**
- [ ] (B) Adiar indefinidamente (marcar como pendente sem prazo)
- [ ] (C) Descartar (Helena = persona aspiracional)
- [ ] (D) Fundir com qual sprint? ___
- [ ] (E) Outra: ___

---

### Sprint 16 — Painel Agregador (Hangar/Moradas)

**Escopo original:** painel dedicado pra Carlos (dono Hangar Academia) gerenciar rede MLM dele — listar professores indicados, alunos da rede, bônus em cascata.

**Estado atual:** `/agregador/page.tsx` + `/agregador/membros/page.tsx` (2 telas existem como esqueleto). Persona Carlos está em PRODUTO.md (papel 6). **Cruzamento de dados real não está pronto.** SISGD-VISAO 5.4 marca como "PARCIAL".

**Estimativa:** 5-7 dias.
**Severidade:** P2 (rede MLM cooperativa é diferencial mas não crítico).

**Recomendação Code:** **(A) Adicionar como Sprint novo**, prioridade P2.

**Decisão Luciano:**
- [ ] (A) Adicionar como Sprint novo — qual prioridade? P1 / **P2** / P3
- [ ] (B) Adiar indefinidamente
- [ ] (C) Descartar (Carlos = persona aspiracional)
- [ ] (D) Fundir com qual? ___
- [ ] (E) Outra: ___

---

### Sprint 21 — Painel Síndico detalhado

**Escopo original:** continuação do Sprint 15 — após cadastro do condomínio, síndico tem painel próprio com visão consolidada (consumo das unidades, áreas comuns, cobrança rateada).

**Estado atual:** **0 implementado.** Helena hoje seria criada como cooperada com vínculo a `Condominio` mas não tem login dedicado de síndico.

**Estimativa:** 7-10 dias.
**Severidade:** depende de Sprint 15 — se descartar 15, descartar 21 junto.

**Recomendação Code:** **(A) Manter como Sprint novo SE Sprint 15 for mantido**. Se Sprint 15 descartado, descartar Sprint 21 também.

**Decisão Luciano:**
- [ ] (A) Manter atrelado ao Sprint 15 (decisão idêntica)
- [ ] (B) Adiar indefinidamente (mesmo se Sprint 15 entrar)
- [ ] (C) Descartar
- [ ] (D) Outra: ___

---

### Sprint 24 — Login facial (FaceMatch)

**Escopo original:** validação automática facial do cooperado contra documento de identidade (KYC mais robusto).

**Estado atual:** `Cooperado.fotoFacialUrl` existe no schema, upload OK. **FaceMatch contra documento NÃO roda.**

**Estimativa:** 3-5 dias (depende de provedor escolhido — AWS Rekognition, Stripe Identity, etc.).
**Severidade:** P3 — atender SISGD sem login facial é viável. Cadastro funciona com upload manual.

**Recomendação Code:** **(B) Adiar indefinidamente** — fora da pilha pré-produção. Adicionar como sugestão pendente em `sugestoes_pendentes.md`.

**Decisão Luciano:**
- [ ] (A) Adicionar como Sprint novo — qual prioridade? P1 / P2 / P3
- [ ] (B) **Adiar indefinidamente** (sugestão pendente)
- [ ] (C) Descartar
- [ ] (D) Outra: ___

---

### Sprint 25 — Suite E2E Playwright

**Escopo original:** suite completa de testes E2E em Playwright cobrindo fluxos críticos (cadastro público, cobrança, login, portal cooperado, etc.).

**Estado atual:** **0 specs E2E** no projeto. Sprint 13a Dia 3 já provou risco — 3 bugs P1 corrigidos porque caminho manual nunca tinha sido testado E2E.

**Estimativa:** 7-10 dias.
**Severidade:** **P2 alto** — sistema com 0 specs E2E ir pra produção real é arriscado.

**Recomendação Code:** **(A) Manter como Sprint novo** — DEPOIS dos sprints estruturais (não junto). Confiança em ir pra produção depende disso.

**Decisão Luciano:**
- [ ] (A) Manter como Sprint novo — última posição da pilha (P2)
- [ ] (B) Adiar indefinidamente
- [ ] (C) Descartar (testes manuais bastam)
- [ ] (D) Outra: ___

---

### Sprint 26 — Pré-produção (load test + runbook)

**Escopo original:** load test, runbook operacional, configuração de infra de produção, validação de backup/restore, monitoramento em produção.

**Estado atual:** **0 implementado.** Snapshots Supabase rodam mas restore nunca foi testado. Sem monitor de crash loop (Sprint 12 expôs PM2 com 298 restarts não detectados).

**Estimativa:** 5-7 dias.
**Severidade:** **P1** — última etapa antes de go-live real.

**Recomendação Code:** **(A) Manter como Sprint novo** — última posição absoluta da pilha.

**Decisão Luciano:**
- [ ] (A) Manter como Sprint novo — última posição da pilha (P1)
- [ ] (B) Adiar
- [ ] (C) Descartar
- [ ] (D) Outra: ___

---

# BLOCO 4 — RENUMERAÇÃO PILHA NOVA (10 sprints)

Confirmar renumeração proposta.

**Proposta Code:** renumerar Sprints 0-9 atuais como Sprints 14-23 (continuidade git, sem ambiguidade com sprints concluídos 1-13a).

| Sprint atual (nova) | Tema | Sprint proposto (renumerado) | Confirma? |
|---|---|---|---|
| Sprint 0 | Auditoria Regulatória Emergencial | **Sprint 14** | [ ] OK |
| Sprint 1 | FaturaSaas Completo | **Sprint 15** | [ ] OK |
| Sprint 2 | OCR-Integração + DINAMICO atômico | **Sprint 16** | [ ] OK |
| Sprint 3 | Banco de Documentos (Assinafy) | **Sprint 17** | [ ] OK |
| Sprint 4 | Portal Proprietário | **Sprint 18** | [ ] OK |
| Sprint 5 | Módulo Regulatório ANEEL | **Sprint 19** | [ ] OK |
| Sprint 6 | Auditoria IDOR Geral | **Sprint 20** | [ ] OK |
| Sprint 7 | DRE + Conciliação + Fechamento | **Sprint 21** | [ ] OK |
| Sprint 8 | Política + Engine de Otimização | **Sprint 22** | [ ] OK |
| Sprint 9 | Motor de Diagnóstico Pré-Venda | **Sprint 23** | [ ] OK |

**Decisão Luciano global:**
- [ ] (A) Aceitar TODA renumeração 14-23 (recomendado)
- [ ] (B) Aceitar com ajustes — quais? ___
- [ ] (C) Manter numeração atual (0-9) e descartar continuidade git
- [ ] (D) Numeração temática (Sprint A1, A2... ou Sprint Reg1, Reg2...) — qual?

---

# BLOCO 5 — PILHA CONSOLIDADA (preview com opções recomendadas)

> **Esta é a pilha que ficaria SE você aceitar todas as recomendações Code (opção A em tudo).** Pra preview — não precisa decidir aqui.

### Sprints concluídos (15 — históricos imutáveis)

Sprints 1, 2, 2.5, 3, 5, 6, 7, 8a, 8b, 9, 9b, 10, 11, 12, 13a — **133 commits git preservados**.

### Pilha pré-produção reconciliada (16 sprints, 14-29)

| # | Tema | Severidade | Estimativa |
|---|---|---|---|
| **14** | Auditoria Regulatória Emergencial | P0 urgente | 1 sem |
| **15** | FaturaSaas Completo (absorve Sprint 14 antigo) | P1 | 1-2 sem |
| **16** | OCR-Integração + Engine COMPENSADOS/DINAMICO atômico (absorve 17+18 antigos) | P1 | 2-3 sem |
| **17** | Banco de Documentos Assinafy + termo Lei 14.300 (absorve parte do 23 antigo) | P1 | 1-2 sem |
| **18** | Portal Proprietário com ContratoUso 3 modalidades | P1 | 1-2 sem |
| **19** | Módulo Regulatório ANEEL (absorve AuditLog do 13b antigo) | P0 estruturante | 3-4 sem |
| **20** | Auditoria IDOR Geral (absorve AuditLog do 13b + 22 antigo) | P2 | 1 sem |
| **21** | DRE + Conciliação + Fechamento (absorve 13c + 19 + 20 antigos) | P2 | 2-3 sem |
| **22** | Política de Alocação + Engine de Otimização com Split | P1 | 2-3 sem |
| **23** | Motor de Diagnóstico Pré-Venda | P1 estratégico | 3-4 sem |
| **24** | Cadastro Condomínio atomizado (órfão 15) | P2 | 5-7 dias |
| **25** | Painel Agregador rede MLM (órfão 16) | P2 | 5-7 dias |
| **26** | Painel Síndico detalhado (órfão 21) — depende Sprint 24 | P2 | 7-10 dias |
| **27** | Templates de comunicação (parte restante do 23 antigo) | P2 | 3-5 dias |
| **28** | Suite E2E Playwright (órfão 25) | P2 | 7-10 dias |
| **29** | Pré-produção: load test + runbook + backup (órfão 26) | P1 | 5-7 dias |

**Não entram na pilha (adiados pra `sugestoes_pendentes.md`):**
- Sprint 24 antigo — Login facial (P3, adiável)

**Total estimado:** 17-23 sem nos Sprints 14-23 + ~5-7 sem nos Sprints 24-29 = **22-30 semanas de Code dedicado** (5-7 meses úteis).

---

# INSTRUÇÕES PRA LUCIANO

1. **Marcar [X]** em cada decisão dos Blocos 2-4
2. **Bloco 1** só confirmar com [X] OK (pode ser global na decisão "(A)")
3. **Salvar arquivo** quando terminar (ou colar de volta no chat)
4. **Próximo prompt** aplicará as decisões em todos os arquivos:
   - `docs/PLANO-ATE-PRODUCAO.md` (renumera + adiciona órfãos)
   - `docs/CONTROLE-EXECUCAO.md` (atualiza tabela de sprints + Decisão 17)
   - `docs/PRODUTO.md` Apêndice B (renumera lista)
   - `docs/REGULATORIO-ANEEL.md` Seção 14 (atualiza Sprints 0/5/8/9 → novos números)
   - `docs/MAPA-INTEGRIDADE-SISTEMA.md` (atualiza plano consolidado)
   - Memória persistente (`project_pilha_reconciliada_2026_05_01.md` novo)

5. **Comentários em código** (`backend/src/`, `web/app/`) **NÃO serão tocados** — referências históricas a "Sprint 5", "Sprint 11" etc. são arqueologia válida (sprints antigos concluídos).

---

*Material gerado em 01/05/2026 por Code. Aplica regra de validação prévia + retomada (memória `regra_validacao_previa_e_retomada.md`).*
*Insumos: mapeamento `1be9b34` + plano `29bb7aa` + PLANO-ATE-PRODUCAO.md atual.*
*NÃO aplica reconciliação — apenas oferece formulário de decisão.*
