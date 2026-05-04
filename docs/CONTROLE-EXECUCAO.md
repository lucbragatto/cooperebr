# Controle de Execução — SISGD

> Arquivo vivo. Atualizar em **toda sessão** (claude.ai e Code).
> Última atualização: **2026-05-04 Fase C.1.1 fechada** — 4 itens de UX corrigidos pós-validação manual de Luciano em 04/05.

---

## ONDE PARAMOS

> **Seção viva atualizada via ritual de fechamento (memória `ritual_abertura_fechamento.md`).**
> Toda sessão Code abre lendo isto. Toda sessão Code fecha atualizando isto.

### Última sessão

- **Quando:** 2026-05-04 (curta, ~1-2h)
- **Tipo:** Code (Fase C.1.1 — correções UX pós-validação)
- **Resultado:**
  - **Bug 1 corrigido:** trocar tipoDesconto na UI agora altera simulação. Helper `web/lib/simular-plano.ts` recebe e respeita tipoDesconto. Paridade matemática com motor-proposta.service.ts:308-360 (4 combinações reais). Spec ts-node ampliado de 6 → 10 cenários, todos verdes.
  - **Bug 2 corrigido:** aviso V4 redundância reescrito em texto educativo ("para KWH_CHEIO os dois modos resultam no mesmo valor; a escolha só importa quando SEM_TRIBUTO").
  - **Bug 3 corrigido:** simulação adicionada na tela `/dashboard/planos/[id]` (visualização e edição). Tipo Plano em `web/types/index.ts` ganha campo tipoDesconto. Modo edição também ganhou radio APLICAR_SOBRE_BASE × ABATER_DA_CHEIA + helper visual `<CombinacaoAtual>` (estavam só no /novo).
  - **Bug 4 corrigido:** dropdown Modelo de Cobrança em /novo e /[id] desbloqueia COMPENSADOS/DINAMICO quando perfil = SUPER_ADMIN. Aviso laranja inline alerta que backend ainda bloqueia aceitar/processar fatura.
- **Achado importante (gate 2):** helper canônico backend (`calcular-tarifa-contratual.ts`, criado na Fase B) está **PARCIAL** — só implementa 2 das 4 combinações baseCalculo × tipoDesconto. A fonte real de uso é `motor-proposta.service.ts:308-360`, que cobre as 4. Frontend foi pareado com o motor (não com o helper canônico). Recomendado catalogar como débito P3 a unificação dos dois caminhos.
- **Commits:** 4 (5062933, 6c452fe, cb1ec43, f68c5c6).
- **Próxima sessão:** Luciano valida manualmente as 4 correções; se OK, segue pra Fase C.2 (UI plano avançada).

### Sessão anterior

- **Quando:** 2026-05-03 (maratona ~10-12h, 4 fases sequenciais)
- **Tipo:** Code (Fase A + B + B.5 + C.1)
- **Resultado consolidado:**
  - **Fase A** (manhã): multi-tenant em Planos. 4 bugs cross-tenant resolvidos + lacuna B13 (seed `CREDITOS_COMPENSADOS` → `FIXO_MENSAL`). 20 specs Jest verde. UI condicional por perfil. **4 commits.**
  - **Fase B** (tarde): D-30R RESOLVIDO + duplo desconto eliminado + DINAMICO implementado + Decisão B33 aplicada. Helper canônico `calcularTarifaContratual` em 5 caminhos. 72 specs Jest verde. **6 commits.**
  - **Fase B.5** (noite): validação E2E sintética **6/6 ✓** com 8 valores cada (incluindo 4 valores de economia projetada). Cooperativa teste isolada (CNPJ 11.111.111/0001-11). Schema delta `Contrato.valorCheioKwhAceite` + 4 campos `Cobranca`. FIXO grava `valorBruto` (resolve Sprint 7 #4). Decisões B33.5 + B34 + B35 cristalizadas. **4 commits.**
  - **Fase C.1** (noite mais tarde): UI plano + simulação tempo real. Helper `web/lib/simular-plano.ts` com paridade matemática backend (6/6 ts-node ✓). Componentes `<PlanoSimulacao>` + `<CombinacaoAtual>`. Campos condicionais por modelo. Layout 2 colunas em `/dashboard/planos/novo`. **5 commits.**
  - **Total:** 19 commits + 1 commit de investigação inicial = **20 commits**. Validação matemática **48/48** (6 cenários × 8 valores ✓).
- **Próxima sessão:** Fase C.2 (UI plano avançada) ou validação manual da Fase C.1 — decisão Luciano após retomada.

### Sessão anterior (mantida pra contexto curto)

> 4 fases dentro do dia 03/05 condensadas no resumo único acima. Detalhe completo em `docs/sessoes/2026-05-03-resumo-sessao-completa.md`.

### Sessão 02/05 (mantida pra contexto longo)

- **Quando:** 2026-05-02 (manhã + tarde, ~7-8h com pausas)
- **Tipo:** Code (Fase 1 técnica + Fase 2.5 investigações + Fase 2.6 fechamento consolidado)
- **Resultado:** 12 pendências resolvidas (D-30O fix + 7 ajustes B + 2 sprints catalogados + D-30R catalogado + 6 áreas investigadas + revisão specs CooperToken + Área 1 expandida + SISGD-VISAO movido pra histórico). 2 decisões processuais novas (19 ritual, 20 validação por resposta). 4 débitos catalogados (D-30R, D-30S, D-30T) + 1 sugestão pendente (#3 cron sessões).

### Commits da sessão 2026-05-03 (cronologia, 20 commits)

**Investigação inicial (manhã):**
- `4caebe9` docs(investigacao): mapear engine CREDITOS_COMPENSADOS — D-30R + duplo desconto

**Fase A — Multi-tenant em Planos (manhã, 4 commits):**
- `69e2d6c` fix(planos): multi-tenant em CRUD + seed FIXO_MENSAL (Fase A)
- `5f70ce2` test(planos): cobrir multi-tenant Fase A — 20 cenarios
- `7722ce3` feat(planos-ui): UI condicional por perfil — escopo do plano
- `78d2d7b` docs(fase-a-planos): registra resolucao bugs cross-tenant + B13

**Fase B — Engine + snapshots + DINAMICO (tarde, 6 commits):**
- `eb7f0ce` feat(motor): helper calcularTarifaContratual + schema FaturaProcessada (Fase B)
- `070c1ab` fix(motor): aceitar() + 4 caminhos populam snapshots completos (D-30R)
- `f5453b7` fix(faturas): COMPENSADOS sem duplo desconto + DINAMICO implementado
- `00f64df` feat(planos): validacoes DTO V1-V3 + warnings V4 (Fase B)
- `4c8e946` test(faturas+motor): atualizar specs antigos sem duplo desconto (Fase B)
- `1319140` docs(fase-b-planos): D-30R resolvido + Decisao B33 aplicada

**Fase B.5 — Validação E2E + economia projetada (noite, 4 commits):**
- `a4ebf90` feat(schema): valorCheioKwhAceite (Contrato) + 4 economia (Cobranca)
- `b0e0345` feat(faturas+motor): FIXO grava valorBruto + 4 economia nos 3 modelos
- `718ca46` test(fase-b5): seed E2E 6 cenarios validados (cooperativa teste isolada)
- `840b10f` docs(fase-b5): playbook validacao E2E + tabela 8 colunas + IDs

**Fase C.1 — UI plano + simulação (noite mais tarde, 5 commits):**
- `8ffeb69` feat(web-lib): helper simular-plano + 6 specs paridade backend (Fase C.1)
- `cdb1eda` feat(planos-ui): componente <PlanoSimulacao> com painel em tempo real
- `eb82c0a` feat(planos-ui): campos condicionais por modelo + simulacao integrada
- `e0c1e7a` feat(planos-ui): helper visual baseCalculo + tipoDesconto + avisos V4
- `c550ff3` docs(fase-c1): registra conclusao Fase C.1 + 4 commits

**Fechamento (este grupo, 5 commits novos):**
- (a serem criados) docs(sessao+controle+produto+plano+debitos): consolidacao final 03/05

### Commits da sessão 2026-05-02

**Fase 1 (manhã):**
- `1301bb2` docs(ritual): cria ritual abertura/fechamento sessao
- `18845b0` docs(ritual): aprimora Decisao 19 + reorganiza pendencias P1/P2/P3
- `509002d` docs(processo): reclassifica D-30M + investiga D-30N/D-30O
- `7ea6943` feat(fase1): trabalho tecnico consolidado sessao 02/05
- `6eca970` docs(plano): atualiza PLANO-ATE-PRODUCAO com Fase 1 02/05

**Fase 2.5 (tarde):**
- `06b933f` docs(investigacao): 6 areas de produto read-only — 02/05 tarde
- `8cb8328` docs(investigacao): adiciona analise de specs CooperToken — gap completo
- `8e380aa` docs(investigacao): completa Area 1 — documentacao + Planos

**Fase 2.6 (fechamento):**
- `<este>` docs(sessao): consolidacao final 02/05 + Decisao 20 + SISGD-VISAO movido

### Arquivos tocados (sessão 02/05 + 03/05 fechamento)

- `~/.claude/.../memory/ritual_abertura_fechamento.md`
- `~/.claude/.../memory/regra_validacao_previa_e_retomada.md` (Decisão 20 adicionada)
- `~/.claude/.../memory/sugestoes_pendentes.md` (sugestão #3 adicionada)
- `~/.claude/.../memory/MEMORY.md`
- `CLAUDE.md` (raiz — disciplina validação Decisões 14/15/20 consolidadas)
- `backend/src/faturas/faturas.service.ts` (D-30O fix)
- `backend/src/faturas/faturas.service.d30o.spec.ts` (4 specs)
- `docs/PRODUTO.md` (7 ajustes Grupo B)
- `docs/REGULATORIO-ANEEL.md` (Assis→OpenClaw, limite 25% por classe, Caso A reescrito)
- `docs/PLANO-ATE-PRODUCAO.md` (Sprints 5a + 3a, Seção 0)
- `docs/debitos-tecnicos.md` (D-30M, D-30N, D-30O, D-30R + D-30S + D-30T)
- `docs/MAPA-INTEGRIDADE-SISTEMA.md` (referências SISGD-VISAO contextualizadas histórico)
- `docs/CONTROLE-EXECUCAO.md` (este arquivo)
- `docs/historico/SISGD-VISAO-COMPLETA-2026-04-26.md` (movido)
- `docs/sessoes/2026-05-02-investigacao-d30m-d30n-d30o.md`
- `docs/sessoes/2026-05-02-fase1-trabalho-tecnico-consolidado.md`
- `docs/sessoes/2026-05-02-investigacao-6-areas-produto.md`
- `docs/sessoes/2026-05-02-resumo-sessao-completa.md` (Bloco 9)

### Decisões registradas (cronológicas — completar lista total no fim do arquivo)

- **Decisão 19** (02/05 manhã): ritual abertura/fechamento de sessão
- **Decisão 20** (03/05 fechamento): validação prévia em CADA resposta + verificação de conflito antes de propor sprint
- **Reclassificações:** D-30M P1→P2, D-30N escopo expandido, D-30R catalogado novo
- **Resolvido:** D-30O (commit `7ea6943`)
- **Catalogados como sprints formais (Decisão 18):** Sprint 5a (Fio B), Sprint 3a (RN 482→Lei 14.300)
- **Catalogados como débitos:** D-30R (Motor.aceitar), D-30S (extrair Jornadas), D-30T (extrair Painéis)
- **Catalogada como sugestão:** #3 Cron Análise Diária Sessões
- **Movido pra histórico:** SISGD-VISAO-COMPLETA.md (substituído por PRODUTO.md)

### Pendências consolidadas

→ Ver seção [PENDÊNCIAS PARA PRÓXIMA SESSÃO](#pendências-para-próxima-sessão) abaixo.

**Total restante:** ~32 decisões pendentes (B1-B32) + ~8 sprints potenciais (C1-C8).
**P1 = 0**. Pendências resolvidas hoje: 12.

### Próximos passos imediatos (priorizado P0 → P1 → P2 → P3)

A. **Decisões batch B1-B32** [Processual urgente] — sessão dedicada só a decisões (~2-3h). Sem decisões, sprints potenciais ficam parados.
B. **D-30R fix** [P0/P2 — 30-45 min] — Motor.aceitar() popular tarifaContratual + script backfill (72 contratos).
C. **Caminho B Asaas produção** [Estratégica] — primeira receita real em 1-2 semanas.
D. **Doc-0 Fatia 3** (SISTEMA.md) — pré-condição pra Fatias 4 + 5 + débitos D-30S/D-30T.
E. **Definir escopo Sugestão #3** (cron análise diária) — decidir hipótese A/B/C/D/E.

### Frase de retomada

> Voltei. Lê `docs/CONTROLE-EXECUCAO.md`.

Anexos opcionais:
- `docs/CONTROLE-EXECUCAO.md`
- `docs/sessoes/2026-05-03-resumo-sessao-completa.md` (resumo da maratona 03/05)
- `docs/sessoes/2026-05-02-resumo-sessao-completa.md` (resumo da sessão 02/05)

---

## ARQUIVOS PRA LER NA RETOMADA (sessão 04/05/2026)

Ordem recomendada (15 min de leitura total):

1. `docs/CONTROLE-EXECUCAO.md` (este arquivo) — visão geral do estado
2. `docs/sessoes/2026-05-03-resumo-sessao-completa.md` — o que foi feito em 03/05 (4 fases)
3. `docs/sessoes/2026-05-03-fase-b5-validacao-e2e.md` — playbook validação (referência matemática dos 6 cenários)
4. `docs/PLANO-ATE-PRODUCAO.md` — onde estamos no roadmap

Opcional (se for atacar Fase C.2 direto):
5. `web/app/dashboard/planos/novo/page.tsx` — tela atual (referência pra estender)
6. `web/components/PlanoSimulacao.tsx` — componente reusável (Fase C.1)
7. `web/components/CombinacaoAtual.tsx` — componente helper visual baseCalculo + tipoDesconto
8. `web/lib/simular-plano.ts` — helper canônico frontend

---

## FRASE DE RETOMADA — sessão 04/05/2026

Pra colar amanhã ao abrir nova sessão Code OU claude.ai:

> Voltei. Sessão de 03/05 fechou Fases A + B + B.5 + C.1 (20 commits, validação 48/48). Lê `docs/CONTROLE-EXECUCAO.md` + `docs/sessoes/2026-05-03-resumo-sessao-completa.md`.
>
> Próximo passo provável: Fase C.2 (UI plano avançada — promo, vigência, CooperToken expandido, lista enriquecida, confirmação). Mas valida UX da C.1 antes comigo (logar em `/dashboard/planos/novo`).

---

## ESTADO ATUAL

### Doc-0 (documentação base)

| Fatia | Status | Commit | Conteúdo |
|---|---|---|---|
| 1/5 — Limpeza estrutural | ✅ CONCLUÍDA | `3a193de` (28/04) | 4 docs movidos pra `historico/`, 7 prompts antigos, `memory/` raiz renomeada, stubs PRODUTO/SISTEMA |
| 2/5 — PRODUTO + REGULATORIO | ✅ **CONCLUÍDA** | (commits desta sessão) | PRODUTO.md, REGULATORIO-ANEEL.md, CONTROLE-EXECUCAO.md, sessão decisões, +12 débitos, plano atualizado |
| 3/5 — SISTEMA.md | 🔴 pendente | — | Mapa técnico (44 módulos, 152 telas, 80 models, schema completo) |
| 4/5 — CLAUDE.md refator | 🔴 pendente | — | Reformatação operacional do CLAUDE.md raiz |
| 5/5 — Movimentação final | 🟡 parcial | (03/05) | ✅ SISGD-VISAO movido pra `docs/historico/SISGD-VISAO-COMPLETA-2026-04-26.md`. Pendente: MAPA-INTEGRIDADE → histórico, README docs |

### Sprints pré-produção (10 totais — pilha reorganizada 30/04)

| Sprint | Tema | Status | Severidade | Estimativa |
|---|---|---|---|---|
| 0 | Auditoria Regulatória Emergencial | 🔴 não iniciado | P0 urgente | 1 semana |
| 1 | FaturaSaas Completo | 🔴 não iniciado | P1 | 1-2 semanas |
| 2 | OCR-Integração + Engine DINAMICO | 🔴 não iniciado | P1 | 2-3 semanas |
| 3 | Banco de Documentos (Assinafy) | 🔴 não iniciado | P1 | 1-2 semanas |
| 4 | Portal Proprietário | 🔴 não iniciado | P1 | 1-2 semanas |
| 5 | Módulo Regulatório ANEEL | 🔴 não iniciado | P0 estruturante | 3-4 semanas |
| 6 | Auditoria IDOR Geral | 🔴 não iniciado | P2 | 1 semana |
| 7 | DRE + Conciliação + Fechamento | 🔴 não iniciado | P2 | 2-3 semanas |
| 8 | Política + Engine de Otimização | 🔴 não iniciado | P1 | 2-3 semanas |
| 9 | Motor de Diagnóstico Pré-Venda | 🔴 não iniciado | P1 estratégico | 3-4 semanas |

**Total estimado**: 17-23 semanas de Code dedicado.

---

## SESSÃO 2026-04-30 NOITE — Investigações realizadas (sem aplicar correções)

**3 investigações concluídas, todas commitadas localmente:**

### 1. Validação de specs históricos (commit `2617d08`)
- Lidos 7 specs em `docs/specs/` que ficaram fora do mapeamento anterior
- Relatório: `docs/sessoes/2026-04-30-validacao-specs-historicos.md` (711 linhas)
- **6 descobertas estruturantes identificadas** (decisões pendentes)
- **7 ajustes factuais confirmados** (correções pendentes)

### 2. Regra de validação prévia obrigatória (commit `e0d4daa`)
- Salva em `~/.claude/.../memory/regra_validacao_previa_e_retomada.md`
- Atualizada em `CLAUDE.md` (raiz)
- Decisão 14 registrada
- **Aplicada em todas as sessões Code futuras automaticamente**

### 3. Estado real de cobrança E2E (commit `f3a0434`)
- Mapeamento de 16 etapas do pipeline de cobrança
- Relatório: `docs/sessoes/2026-04-30-estado-cobranca-e2e.md` (282 linhas)
- **Achado central:** Caminho A (OCR→Cobrança automática) NUNCA rodou em produção
- **Achado central:** Caminho B (cobrança manual UI + Asaas) maduro, pode ir pra produção em 1-2 semanas
- **4 achados novos identificados** (catalogação pendente)

---

## PENDÊNCIAS PARA PRÓXIMA SESSÃO

> **Reorganizado 03/05 fechamento** após 4 fases concluídas (A + B + B.5 + C.1).
> Agente apresenta P0 → P1 → P2 → P3 em toda abertura de sessão (Decisão 19).
> Pendências marcadas com 🔍 foram **revisadas com leitura de código**.

### P0 — Crítico

- [ ] **Validação manual da Fase C.1 por Luciano** — logar como SUPER_ADMIN em `/dashboard/planos/novo`, conferir UX (painel sticky, campos condicionais por modelo, avisos V4, simulação tempo real). Pré-requisito antes de Fase C.2.
- [ ] **Fase C.2 — UI plano avançada** (recomendado próximo): promo defaults + validação visual, simulação 2 fases, vigência + validação Campanha, CooperToken expandido (6 campos), lista enriquecida (escopo + indicadores), confirmação antes de salvar mudanças críticas. **6 itens (4-10), ~3-4h Code.**
- [x] ✅ **D-30R RESOLVIDO em 03/05 (Fase B)** — commits `eb7f0ce`, `070c1ab`, `f5453b7`, `4c8e946`.
- [ ] 🔍 **`BLOQUEIO_MODELOS_NAO_FIXO=true`** ainda ativo nos 7 enforcement points. **Validação E2E sintética 48/48 ✓ na Fase B.5.** Pré-requisitos pra desativar: Fase C.2 + C.3 + canário em 1 cooperado real (Opção A do playbook `docs/sessoes/2026-05-03-fase-b5-validacao-e2e.md`).

### P1 — Decisões esperadas Luciano (status atualizado pós sessão 03/05)

- **Decisões resolvidas durante a sessão 03/05** (4 novas):
  - ~~B33 Semântica `tarifaContratual`~~ ✅ **RESOLVIDA** — pós-desconto, helper canônico aplicado em 5 caminhos
  - ~~B33.5 Reset 72 contratos legados~~ ✅ **RESOLVIDA** — não resetar (forward-only)
  - ~~B34 FIXO lê fatura no aceite~~ ✅ **RESOLVIDA** — `valorCheioKwhAceite` no Contrato
  - ~~B35 Economia uniforme nos 3 modelos~~ ✅ **RESOLVIDA** — 4 valores em toda Cobrança

- **Decisões já resolvidas em fases anteriores:**
  - ~~B1 D-30R timing~~ ✅ **RESOLVIDA via Fase B**
  - ~~B2 DINAMICO sprint dedicado~~ ✅ **RESOLVIDA via Fase B** (implementado dentro do mesmo escopo)
  - ~~B13 Seed `CREDITOS_COMPENSADOS`~~ ✅ **RESOLVIDA via Fase A** (seed muda pra `FIXO_MENSAL`)

- **6 decisões Fase 2.5 ainda pendentes:**
  - B3 CooperToken desvalorização configurável vs hard-coded 29 dias
  - B4 Modo Observador consolidar admin-spy + cooperado-leitura, ou separar
  - B5 Convênios link-específico now or later
  - B6 Planos modulares `@RequireModulo` retroativo (~50 endpoints) ou só novos

- **6 decisões estratégicas originais** (Doc-0):
  - B7 Hardcode 0.20 CooperToken
  - B8 Modo Observador no PRODUTO.md (Camada 12)
  - B9 3 specs CooperToken contraditórios na expiração
  - B10 Convênios subdocumentado (Camada 8 expansão)
  - B11 600.000 kWh represados (marcar como ciente)
  - B12 FCFS + VPP no roadmap?

- **4 lacunas Área 1** (revisão 02/05 tarde):
  - ~~B13 Seed `onModuleInit` cria Plano `CREDITOS_COMPENSADOS`~~ ✅ **RESOLVIDA via Fase A** (commit `69e2d6c`)
  - B14 UI override Usina/Contrato inexistente (só via API) — **parcialmente endereçada via UI escopo Fase A**
  - B15 `FORMULAS-COBRANCA.md` órfão em historico/ vs CLAUDE.md ainda referencia — **parcialmente endereçada via aviso obsolescência em RETOMADA-SESSAO.md (Fase B)**
  - B16 `RegrasFioB` model + `Usina.classeGd` enum documentados mas não codificados — pendente, depende Sprint 5 regulatório

- **16 decisões curadoria sprints** (`docs/sessoes/2026-05-01-curadoria-sprints-decisoes.md` commit `6c8cb7d`):
  - B17-B32 (16 itens — material já consolidado, aguardando passada de batch)

### P1 — Sprints potenciais a catalogar (status pós sessão 03/05)

- ~~C1 COMPENSADOS~~ ✅ **EXECUTADO via Fase B** (D-30R + duplo desconto + helper canônico)
- ~~C2 DINAMICO~~ ✅ **EXECUTADO via Fase B** (NotImplementedException → implementação real)
- ~~C7 D-30R sub-sprint~~ ✅ **ABSORVIDO em Fase B**
- C3 CooperToken Configurável (3 campos schema + cron desvalorização + cron expiração + UI admin + specs) — **pendente**
- C4 Convênios link-específico + landing personalizada — **pendente**
- C5 Relatório Mensal Membro/Usuário (consumo modular) — **pendente**
- C6 Planos SaaS Modulares — ativação `@RequireModulo` retroativa — **pendente**
- C8 Funções Venda Fio B (contexto a recuperar — pendente desde 02/05) — **pendente**

### P2 — Validação E2E pendente

- [ ] **Canário 1 cooperado real** — depende Fase C.2 + Fase C.3 + (se necessário) backfill 72 contratos legados. Pré-requisito pra desativar `BLOQUEIO_MODELOS_NAO_FIXO` em produção.
- [ ] 🔍 **D-30M** — Bônus MLM cascata: pipeline OK, validar quando primeiro indicado pagar via Caminho B Asaas.

### P2 — Bugs/lacunas confirmadas

- [ ] 🔍 **D-30N** — AuditLog interceptor **não existe**. Absorvido por Sprint 5/6.
- [x] 🔍 **D-30O** — ✅ **RESOLVIDO em 02/05** (commit `7ea6943`)
- [x] 🔍 **D-30R** — ✅ **RESOLVIDO em 03/05** (Fase B, commits `eb7f0ce`, `070c1ab`, `f5453b7`, `4c8e946`)
- [ ] **Backfill 72 contratos legados** (only-if-needed) — `tarifaContratual=null` em todos. Necessário SE Luciano quiser ativar COMPENSADOS num cooperado existente sem recriar contrato. Forward-only mantido em Fase B; backfill é decisão futura.

### P3 — Débitos catalogados durante sessão 03/05

- [ ] **3 specs DI pré-existentes falhando** — `cooperados.controller.spec.ts`, `cooperados.service.spec.ts`, `usinas.controller.spec.ts`. Erro DI (UsinasService não resolvido em RootTestModule). Confirmado pré-existente via `git stash`. Não impacta runtime.
- [ ] **Snapshots na atribuição tardia de plano** (caso `usinas.service.ts:306`) — promoção da lista de espera cria contrato sem plano. Função `atribuirPlanoAoContrato()` deve popular snapshot via helper canônico. Catalogado como exceção #5.
- [ ] **Whitelist `/cadastro` no interceptor `web/lib/api.ts`** — observação latente da Fase A. Se algum dia alguém chamar `api.get('/planos')` em rota pública (não via `fetch`), visitante anônimo seria redirecionado pra `/login`. Hoje `/cadastro` usa `fetch` direto, então não acontece.

### P3 — Documentação pendente

- [ ] **Doc-0 Fatia 3** — SISTEMA.md (mapa técnico completo)
- [ ] **Doc-0 Fatia 4** — CLAUDE.md refator operacional
- [ ] **Doc-0 Fatia 5** — Movimentação final. Parcialmente executado em 03/05 (SISGD-VISAO movido).
- [ ] **D-30S** — Extrair "Jornadas Usuário" do SISGD-VISAO histórico (1-1.5h)
- [ ] **D-30T** — Extrair "Painéis por Papel" do SISGD-VISAO histórico (1-2h)

### P3 — Ajustes factuais Doc-0 (Grupo B)

- [x] ✅ **TODOS RESOLVIDOS em 02/05** (commit `7ea6943`):
  - juiz TJES removido, Sinergia/CoopereBR aguardando migração, sem cliente em produção
  - Assis → OpenClaw (7 ocorrências)
  - Limite 25% por classe GD (não aplica GD I, direitos adquiridos 2045)
  - Caso A reescrito (sistema legado, GD I direitos adquiridos)
  - Express→Cooperado marcado como hipótese

### Estratégica

- [ ] **Caminho B** (cobrança manual UI + Asaas produção real) — primeira receita real em 1-2 semanas
- [ ] Quando atacar Sprint 0 (Auditoria Regulatória)
- [ ] Conta Asaas produção (criar/migrar)

### Sugestões pendentes (sem prazo)

- #1 Diagramas C4 + ER (reavaliar quando CoopereBR migrar)
- #2 Token dedicado convênio + landing personalizada (depende Sprint 1 trazer comunicação)
- #3 Cron Análise Diária Sessões (escopo a definir — hipóteses A/B/C/D/E)

### Processual

- [ ] **Aplicar Decisão 20 retroativamente** — revisar sprints catalogados (5a, 3a) pra checar se passariam pelo gate "verificação de conflito"

---

## ESTADO REAL DO PRODUTO (descoberto 30/04 noite)

| Componente | Estado |
|---|---|
| Caminho A — OCR automático | 🔴 nunca rodou em produção |
| Caminho B — Cobrança manual + Asaas | 🟢 31 cobranças sandbox PAGAS, pronto pra produção |
| FaturaSaas | 🟡 cron cria, mas sem Asaas/comunicação/pagamento |
| MLM cascata | 🔴 quebrado (D-30M) |
| AuditLog | 🔴 inativo (D-30N) |
| Doc-0 Fatia 2 | 🟡 escrito mas com pendências A + B + C acima |

---

## DECISÕES CONSOLIDADAS (cronológicas)

### Sessão claude.ai 2026-04-30 (Doc-0 Fatia 2 — 13 decisões estruturantes)

> Captura completa em `docs/sessoes/2026-04-30-decisoes-doc-0-fatia2.md`.

1. **3 entidades fundamentais** (SISGD, Parceiro, Membro). Tudo demais é atributo sobreposto.
2. **Sprint OCR-Integração + Sprint 14 atômico** (opção C mista). Pipeline OCR×Motor + DINAMICO + COMPENSADOS validado juntos.
3. **ContratoUso 3 modalidades** (fixa mensal + valor por kWh + percentual sobre tarifa SCEE sem tributos). NÃO é "% lucro líquido".
4. **Assinafy + 5 documentos do sistema** (Proposta, Adesão, Responsabilidade, Procuração, Contrato). Templates SISGD; parceiro customiza.
5. **Caso Exfishes (anonimizado)** — concentração 39,55% violando limite ANEEL não detectada; realocação cega causou salto de R$ 6.600 → R$ 32.486/mês (R$ 310k/ano).
6. **Classe GD vem da usina, não da UC.** UC herda da usina vinculada.
7. **5 flags regulatórias** configuráveis por parceiro: `multipleUsinasPerUc`, `multipleClassesGdPerUc`, `concentracaoMaxPorCooperadoUsina` (default 25%), `misturaClassesMesmaUsina`, `transferenciaSaldoEntreUcs` (saldo intransferível).
8. **Política de Alocação por Faixas** com simulação prévia, padrão SISGD vs custom.
9. **Engine de Otimização com Split** — modo Sugestão default, Automático com guard-rails (estabilidade mínima, anti-rebalanceamento).
10. **Motor de Diagnóstico Pré-Venda** — funil público, Express grátis + Completo R$ 199-499 (sugestão), anti-abuso.
11. **REGULATORIO-ANEEL.md como 4º documento do Doc-0** (CLAUDE / PRODUTO / SISTEMA / REGULATORIO-ANEEL).
12. **CONTROLE-EXECUCAO.md como arquivo vivo** atualizado em toda sessão.
13. **Sprint 0 Auditoria Regulatória Emergencial** — P0 urgente, pode rodar antes de Doc-0 fechar.

### Decisão 14 — Regra permanente: validação prévia obrigatória (sessão 30/04 noite)

Todo trabalho novo (claude.ai ou Code) deve começar verificando o que já existe.
Salva em memória persistente (`regra_validacao_previa_e_retomada.md`) + `CLAUDE.md`.

Aplica retroativamente a sessões futuras independente de o prompt mencionar.

Origem: Luciano observou em 30/04 que sessões anteriores propunham trabalho sem
verificação prévia, gerando retrabalho e perda de coerência. Sprint 13 funcionou
exatamente porque seguiu essa disciplina.

### Decisão 15 — Regra de validação prévia generalizada + preventiva (sessão 01/05 manhã)

Estende Decisão 14:
- Vale pra **TODAS as ferramentas** (Code, claude.ai, futuras)
- Vale pra **TODA retomada** (não só "trabalho novo")
- Cruza **3 fontes** (doc + código + git) antes de prosseguir

Origem: claude.ai mesmo violou Decisão 14 em 30/04 noite ao propor nova numeração
de sprints sem cruzar com a antiga. Detectado em 01/05 manhã quando Luciano disse
"estávamos no 13" — Code descobriu 5 colisões + 6 órfãos (commit `1be9b34`,
`docs/sessoes/2026-05-01-mapeamento-numeracao-sprints.md`).

Memória renomeada: `regra_validacao_previa_obrigatoria.md` →
`regra_validacao_previa_e_retomada.md`.

### Decisão 16 — Diagramas C4 + ER salvos como sugestão futura (sessão 01/05 manhã)

Parceiro externo sugeriu gerar diagramas C4 Model + ER Diagram. Análise de
prioridades concluiu: **não é urgente agora** (priorizar Caminho B, reconciliação
sprints, pendências), mas é boa ideia pra futuro próximo.

Salvo em memória persistente: `~/.claude/.../memory/sugestoes_pendentes.md`
(novo arquivo de "sugestões úteis ainda não viradas em sprint").

Reavaliar quando:
- CoopereBR migrar pro SISGD em produção real (1-2 meses)
- Houver decisão de procurar investidor / sócio externo
- Entrar 3º parceiro além CoopereBR + Sinergia

### Decisão 17 — Sprint 15 + 21 descartados (sessão 01/05 manhã)

Investigação (commits `8151381` + `5ee9351`) confirmou:

**Sprint 15 (Cadastro Condomínio atomizado):** descartado.
- Definição original era 1 linha solta em `MAPA-INTEGRIDADE-SISTEMA.md:822`.
- 3 caminhos de Condomínio já cobertos:
  - **Parceiro** (Solar das Palmeiras): SUPER_ADMIN cadastra como qualquer parceiro.
  - **Membro PJ** (Churchill, Costa Atlantico, Isla Bonita, Juan Les Pins): cooperado PJ normal.
  - **Convênio** (Moradas da Enseada): mecânica de Convênio existente.
- Não há demanda concreta pra fluxo dedicado.

**Sprint 21 (Painel Síndico):** descartado.
- Helena (síndica do Moradas) é cooperada normal + conveniada do CV-MORADAS.
- Página de cooperado + tela `/dashboard/convenios/[id]/membros` (admin) atendem.
- Quando D-30P + D-30Q resolvidos (01/05, commit `fa9dc72`), conveniada gera link e vê quem entrou imediatamente (faixa recalculada na hora).

Não viram `sugestoes_pendentes.md` — função operacional já distribuída em
telas existentes.

### Decisão 18 — Compromisso processual: definição mínima de sprint (sessão 01/05 manhã)

Sprint precisa, antes de entrar na pilha:
- **Tema** (1 linha)
- **Persona/caso de uso real** (quem vai usar)
- **Critério de pronto** (o que prova que terminou)
- **Estimativa de tempo** (dias Code)
- **Dependências** (quais sprints precisam estar prontos)

Sprints com 1 linha solta **não viram sprint** — viram entrada em
`~/.claude/.../memory/sugestoes_pendentes.md` pra reavaliar quando demanda
aparecer.

**Origem:** Sprint 15 + 21 tinham 1 linha cada em `MAPA-INTEGRIDADE-SISTEMA.md`.
Causou investigação cara pra descobrir que não eram sprints viáveis (commits
`8151381` + `5ee9351`).

**Aplica retroativamente:** revisão futura de `PLANO-ATE-PRODUCAO.md` precisa
checar que cada sprint tem os 5 itens acima.

### Decisão 19 — Ritual de abertura/fechamento de sessão (sessão 02/05 manhã)

Toda sessão Code (Claude Code CLI) **abre** apresentando "Onde paramos +
Pendências priorizadas P1/P2/P3" antes de iniciar trabalho e **fecha**
atualizando o mesmo registro.

Mesmo se sessão for "continuação" no mesmo dia. Mesmo se Luciano disser
"vamos continuar de onde paramos".

**Onde fica salvo:**
- Ritual: `~/.claude/.../memory/ritual_abertura_fechamento.md` (formato fixo)
- Estado vivo: seção **"ONDE PARAMOS"** no topo deste arquivo

**Aplica-se a:**
- Code (automático, via memória persistente)
- claude.ai web (Luciano cola `CONTROLE-EXECUCAO.md` ao abrir)

**Regra inegociável dentro do ritual:** agente NÃO escolhe próxima pendência
sozinho. Apresenta P1 → P2 → P3 e espera escolha. Exceção única: quando
Luciano disser literal "tu decide" ou "ataca o que for mais urgente".

**Origem específica:** em 01/05 tarde (commit `029bb7aa`-area), Code começou
a operar autonomamente após "voltei" e escolheu pendência **P2** (hardcode
0.20 sem origem) ignorando **P1** (D-30M MLM cascata quebrado). Roteiro
existe pra evitar essa armadilha.

**Complementa:** Decisão 14 (validação prévia) + Decisão 15 (regra estendida).

### Decisão 20 — Validação prévia em CADA resposta + verificação de conflito antes de propor sprint (sessão 02/05 + 03/05 fechamento)

Estende Decisões 14 e 15 com granularidade fina:

**Em cada pergunta:** Code/claude.ai verifica documentação + funções + sessões anteriores sobre o tema **antes de responder**. Não responde "de cabeça".

**Antes de propor sprint:** verifica conflito com pilha existente, sub-sprints (Decisão 18), débitos, sugestões pendentes. Se conflito detectado: **reporta + pergunta** antes de propor.

**Origem:** sessão 02/05 violou múltiplas vezes a regra dentro da mesma sessão:
- Investigação 6 áreas omitiu specs Jest no CooperToken (Luciano cobrou)
- Investigação Área 1 omitiu documentação dedicada + funcionalidade Planos completa (Luciano cobrou)
- Code respondia "de cabeça" sem verificar docs/sessões antes de cada resposta individual

**Memória persistente atualizada:** `regra_validacao_previa_e_retomada.md` ganhou seção "EXTENSÃO 02/05/2026 — VALIDAÇÃO PRÉVIA EM CADA RESPOSTA".

**CLAUDE.md raiz atualizado:** seção "Disciplina de validação prévia (Decisões 14, 15, 20)" consolidada.

**Aplica retroativamente:** sprints catalogados em sessões anteriores precisam revisão pra checar se passariam pelo gate de conflito.

### Sessão claude.ai 2026-04-29 (Validação INVs 4-8)
- 20 de 23 afirmações claude.ai confirmadas (3 divergências corrigidas).
- 5 mecanismos de fidelidade são paralelos puros (sem regras de exclusão).
- DRE/conciliação/fechamento não existem.
- ContratoUso só implementa aluguel fixo.
- Captura em `docs/sessoes/2026-04-29-validacao-invs-4-8.md`.

### Sessão claude.ai 2026-04-28 (Leitura Total)
- 152 telas em 5 super-rotas (87 dashboard, 28 parceiro, 16 portal, 5 proprietario, 2 agregador, 14 públicas).
- 49 telas (33%) invisíveis nos docs principais.
- 5 itens 🔴 do SISGD-VISAO (hoje em `docs/historico/`) já estavam ✅.
- Listas EDP existem (drift do doc).
- Captura em `docs/sessoes/2026-04-28-leitura-total-parte1.md` + `parte2.md`.

---

## DECISÕES PENDENTES (aguardando Luciano)

- Quando começar **Sprint 0** (Auditoria Regulatória Emergencial) — pode rodar antes de Doc-0 fechar (paralelo).
- Quando começar **Sprint 1** (FaturaSaas Completo) — pode rodar em paralelo.
- **Modo Sugestão sempre vs Modo Automático com guard-rails** (Engine de Otimização) — decisão de produto.
- **Cobrança do diagnóstico pré-venda**: Express grátis + Completo R$ 199-499 (sugestão claude.ai 30/04 — validar no mercado).
- **Consultoria regulatória** — advogado especializado em ANEEL pra validar premissas regulatórias críticas (limite 25%, mix de classes, transferência de saldo, etc.).
- **Hierarquia entre os 4 docs do Doc-0** — confirmar: CLAUDE.md operacional + PRODUTO.md visão humana + SISTEMA.md técnico + REGULATORIO-ANEEL.md regulatório.

---

## ARQUIVOS-CHAVE (estado)

| Arquivo | Estado |
|---|---|
| `CLAUDE.md` (raiz) | Estado atual — não atualizado nesta sessão. Será refatorado na Fatia 4. |
| `docs/CONTROLE-EXECUCAO.md` | ✅ **criado nesta sessão** (este arquivo) |
| `docs/PRODUTO.md` | ✅ **escrito nesta sessão** |
| `docs/REGULATORIO-ANEEL.md` | ✅ **escrito nesta sessão** |
| `docs/SISTEMA.md` | Stub — Fatia 3 |
| `docs/debitos-tecnicos.md` | ✅ atualizado nesta sessão (+12 débitos D-30A a D-30L) |
| `docs/PLANO-ATE-PRODUCAO.md` | ✅ atualizado nesta sessão (Sprint 0 + 9 sprints reorganizados) |
| `docs/sessoes/2026-04-30-decisoes-doc-0-fatia2.md` | ✅ criado nesta sessão |
| `docs/sessoes/2026-04-30-mapeamento-regulatorio-existente.md` | ✅ criado nesta sessão (commit `71dce8b`) |
| `docs/sessoes/2026-04-30-diagnostico-fatura-real.md` | ✅ criado nesta sessão (commit `5ae9dfd`) |
| `docs/historico/SISGD-VISAO-COMPLETA-2026-04-26.md` | ✅ **movido em 03/05** — substituído por PRODUTO.md. 2 seções únicas catalogadas como D-30S + D-30T |
| `docs/MAPA-INTEGRIDADE-SISTEMA.md` | Intacto — atualizar a cada sprint |

---

## DESCOBERTAS DE PRODUTO (estruturantes — sessão 30/04)

- **Caso Exfishes** — concentração 39,55% violando limite ANEEL não detectada pelo sistema.
- **Realocação cega** causando salto de R$ 6.600 → R$ 32.486/mês (R$ 310k/ano de prejuízo).
- **5 mecanismos de fidelidade são paralelos puros** (sem regras de exclusão entre eles).
- **CoopereAI funcional** via Anthropic SDK direto (não é apenas conceito).
- **Pipeline OCR rico** (50+ campos extraídos) mas nunca exercitado em produção: 0 cobranças com `modeloCobrancaUsado` preenchido, 0 cobranças com `faturaProcessadaId`.
- **Spec Fio B do Assis** (26/03/2026, 188 linhas) existia mas nunca implementada — schema/fórmulas/tabela 2022-2029 prontos.
- **Termo de adesão e bot citam RN 482/2012** (defasada desde Lei 14.300/2022) — risco regulatório ativo.
- **Concentrações suspeitas reais hoje** — FIGATTA 35% Usina GD II, CRIAR 16% mesma usina, agregado 51% em 2 cooperados.

---

## PRÓXIMOS PASSOS IMEDIATOS

1. **Luciano valida** PRODUTO.md + REGULATORIO-ANEEL.md (próxima sessão claude.ai).
2. **Decidir início de Sprint 0** (Auditoria Regulatória Emergencial) — pode começar imediatamente.
3. **Decidir início de Sprint 1** (FaturaSaas Completo) — pode rodar em paralelo.
4. **Considerar consulta a advogado** especializado em ANEEL pra validar premissas regulatórias.
5. **Fatia 3** do Doc-0 — começar SISTEMA.md (mapa técnico completo).

---

## COMO RETOMAR

### Próxima sessão claude.ai

> Voltei. Doc-0 Fatia 2 fechada. Lê `docs/CONTROLE-EXECUCAO.md`.

### Próxima sessão Code

> Lê `docs/CONTROLE-EXECUCAO.md` + memória persistente. Aguarda instrução.

### Comandos pra subir ambiente local

```bash
# Backend (PM2)
pm2 list                                 # ver estado
pm2 start ecosystem.config.cjs --only cooperebr-backend
pm2 logs cooperebr-backend --lines 30

# Frontend Next.js (terminal interativo)
cd web ; npm run dev                     # porta 3001

# WhatsApp Service (PM2)
pm2 start ecosystem.config.cjs --only cooperebr-whatsapp
```

**Atenção:** o frontend NÃO é gerenciado por PM2 (terminal vivo). Backend SIM (gerenciado por PM2). Antes de `prisma generate` ou `db push`, sempre `pm2 stop cooperebr-backend` (engine Prisma fica lockado se backend rodando).

---

*Arquivo vivo. Atualizar em TODA sessão (claude.ai ou Code).*
