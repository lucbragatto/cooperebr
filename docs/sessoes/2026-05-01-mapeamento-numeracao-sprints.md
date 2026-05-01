# Mapeamento de numeração de sprints — 01/05/2026

> **Modo:** read-only puro. Cruzou docs + sessões + memória persistente + código + 133 commits git.
> **Aplicou regra de validação prévia obrigatória.**
> **Insumo direto pra:** decisão de Luciano sobre como reconciliar conflito de numeração antes de retomar execução.

---

## 1. Numerações encontradas

**Duas numerações coexistem hoje:**

### Numeração A — ANTIGA (Sprints 1-26)
- **Origem:** ciclo iniciado em mar/2026 + planejamento de mar/abr/2026 em `MAPA-INTEGRIDADE-SISTEMA.md` e `COOPEREBR-ALINHAMENTO-2026-04-23.md`
- **Granularidade:** sprints simples + sub-sprints (8a/8b, 9a/9b, 13a/13b/13c)
- **Cobertura:** Sprints **1 → 26** (1-13 já vivenciados em commits git; 14-26 só planejados)
- **Status atual:** Sprints 1-13a CONCLUÍDOS; 13b/13c, 14-26 NÃO INICIADOS

### Numeração B — NOVA (Sprints 0-9)
- **Origem:** sessão claude.ai 30/04 noite — Doc-0 Fatia 2 (PLANO-ATE-PRODUCAO.md reorganizado)
- **Granularidade:** sprints simples
- **Cobertura:** Sprints **0 → 9**
- **Status atual:** TODOS NÃO INICIADOS

---

## 2. Sprints concluídos com evidência git (Numeração A)

| Sprint | Quando concluído | Commits-chave | Onde está documentado |
|---|---|---|---|
| Sprint 1 | mar/2026 | `779631c` "marcar Sprint 1 como concluído" | refs antigas em `historico/` |
| Sprint 2 | mar/2026 | `3acb013` "marcar T0 concluído — Sprint 2 completo" | idem |
| Sprint 2.5 | mar/2026 | `4ff48d2` "marcar Sprint 2.5 concluído" | idem |
| Sprint 3 | mar/2026 | `0b00d49` "marcar Sprint 3 (T4-PRE + T4) concluídos" | idem |
| Sprint 5 | abr/2026 | `9174461` (congelamento), `b90cf99` (T3), `c5d01cd`, `87b3679`, `ee97bfe`, `7424e1b`, `e5dfb19`, `0e064dc` | `memory/project_sprint5_congelamento.md` |
| Sprint 6 | abr/2026 | `b5db585` "fechamento do Sprint 6 + sessão de trabalho", `fd35c0d` (cron FaturaSaas T10) | refs em `MAPA-INTEGRIDADE-SISTEMA.md` |
| Sprint 7 | abr/2026 | `f1487d3` "fechamento Sprint 7 — gateway multi-tenant" | `docs/sessoes/2026-04-22-sprint7-*` |
| Sprint 8a | abr/2026 | `7c2bbca`, `8adf91b`, `cb7b41b` | `memory/project_sprint8_status.md` |
| Sprint 8b | abr/2026 | `0cc28a7` "validacao ponta-a-ponta + fechamento", `7d34111`, `ec35e06`, `487e940` | `docs/sessoes/2026-04-23-sprint8b-fechamento.md` |
| Sprint 9 | abr/2026 | `244819f` (contabilidade preparatória Clube), `5d3bd82` (efeitoMudancaFaixa), `f6caeee` (E2E sandbox) | `docs/sessoes/2026-04-23-sprint9-teste-e2e.md` |
| Sprint 9b | abr/2026 | `22fe6b1`, `dc33c2e`, `2c5c742`, `f9f23a7` | idem |
| Sprint 10 | abr/2026 | `c075f05` "fecha Sprint 10 com marcos históricos", `c4f6ebf` (CADASTRO_V2_ATIVO), `0b9a6ec` (lembretes 24h) | `docs/sessoes/2026-04-25-sprint10-e2e.md` |
| Sprint 11 | abr/2026 | `ef59162` "fecha Sprint 11 Bloco 2", `f36496f`, `559a87d`, `39b96b8`, `9ba0e81`, `4619bf9` | `memory/project_sprint11_dia3.md` |
| Sprint 12 | 27/04/2026 | `4d20086` "sandbox webhook Asaas validado + 3 bugs", `16302e9` | `memory/project_sprint12_concluido.md` |
| Sprint 13a (3 dias) | 28/04/2026 | `7f29bd6` (Dia 1), `8c2f678` (Dia 2), `1569ca8` (Dia 3 IDOR fix) | `memory/project_sprint13a_concluido_e_proximas_etapas.md` |

**Total: 15 sprints concluídos com 133 commits git relacionados.**

**Sprints concluídos NÃO existem na Numeração B** (Numeração B começa em Sprint 0 e cobre apenas roadmap futuro).

---

## 3. Sprints planejados (não iniciados)

### Numeração A antiga — Sprints 13b/13c + 14-26 ainda no `MAPA-INTEGRIDADE-SISTEMA.md`

| Sprint | Tema | Estimativa antiga | Status |
|---|---|---|---|
| 13b | AuditLog ativo + Impersonate | 3-4 dias | NÃO INICIADO |
| 13c | Edição de plano SaaS + suspensão de parceiro | — | NÃO INICIADO |
| 14 | Cron FaturaSaas pré-produção | 5-7 dias | NÃO INICIADO |
| 15 | Cadastro Condomínio atomizado | — | NÃO INICIADO |
| 16 | Painel Agregador (Hangar/Moradas) | — | NÃO INICIADO |
| 17 | **Engine COMPENSADOS** ⚠️ alto risco | — | NÃO INICIADO |
| 18 | Engine DINAMICO | — | NÃO INICIADO |
| 19 | DRE por parceiro | — | NÃO INICIADO |
| 20 | Conciliação CNAB | — | NÃO INICIADO |
| 21 | Painel Síndico detalhado | — | NÃO INICIADO |
| 22 | Audit Trail global | — | NÃO INICIADO |
| 23 | Templates por parceiro | — | NÃO INICIADO |
| 24 | Login facial | — | NÃO INICIADO |
| 25 | Suite E2E Playwright | — | NÃO INICIADO |
| 26 | Pré-produção (load test + runbook) | — | NÃO INICIADO |

**Total: 15 sprints da numeração antiga ainda planejados (mas em parte ABSORVIDOS pela nova — ver Seção 5).**

### Numeração B nova — Sprints 0-9 em `PLANO-ATE-PRODUCAO.md`

| Sprint | Tema | Estimativa | Status |
|---|---|---|---|
| 0 | Auditoria Regulatória Emergencial | 1 sem | NÃO INICIADO (P0 urgente) |
| 1 | FaturaSaas Completo | 1-2 sem | NÃO INICIADO (P1) |
| 2 | OCR-Integração + Engine COMPENSADOS/DINAMICO atômico | 2-3 sem | NÃO INICIADO (P1) |
| 3 | Banco de Documentos (Assinafy) + termo Lei 14.300 | 1-2 sem | NÃO INICIADO (P1) |
| 4 | Portal Proprietário com ContratoUso 3 modalidades | 1-2 sem | NÃO INICIADO (P1) |
| 5 | Módulo Regulatório ANEEL completo (5 flags + classes GD + Fio B) | 3-4 sem | NÃO INICIADO (P0 estruturante) |
| 6 | Auditoria IDOR Geral | 1 sem | NÃO INICIADO (P2) |
| 7 | DRE + Conciliação + Fechamento Mensal | 2-3 sem | NÃO INICIADO (P2) |
| 8 | Política de Alocação + Engine de Otimização com Split | 2-3 sem | NÃO INICIADO (P1) |
| 9 | Motor de Diagnóstico Pré-Venda | 3-4 sem | NÃO INICIADO (P1) |

**Total: 10 sprints da numeração nova, todos não iniciados, 17-23 semanas de estimativa.**

---

## 4. Sprints fantasma (mencionados sem definição clara)

- **Sprint 4** (numeração antiga) — apareceu em 0 commits, 0 sessões. Possivelmente pulado.
- **Sprint 8** (sem sub-sprint) — só 8a/8b documentados; "Sprint 8" puro não existe.
- **Sprint 13** (sem sub-sprint) — só 13a/13b/13c; "Sprint 13" puro não existe.
- **Sprint 9a** — mencionado em commit `288a635` ("finalizacao pendencias sprint 9a") mas sem entradas explícitas; absorvido implícito pelo Sprint 9.
- Refs a "T0", "T3", "T4" em commits do Sprint 5/6 — são **tickets** internos, não sprints.

---

## 5. Conflitos de numeração (5 colisões diretas)

| Sprint # | Significado ANTIGO (concluído) | Significado NOVO (planejado) |
|---|---|---|
| **Sprint 5** | Engine de cobrança refatorada (T1-T8 com snapshots, MUC fix, etc.) — abr/2026 | Módulo Regulatório ANEEL completo (5 flags + classes GD + Fio B) |
| **Sprint 6** | Cron mensal FaturaSaas + Tickets 6-11 (T10 entregou cron) — abr/2026 | Auditoria IDOR Geral |
| **Sprint 7** | Gateway multi-tenant Asaas (Etapas 1-5) — abr/2026 | DRE + Conciliação + Fechamento Mensal |
| **Sprint 8** | CooperToken/Clube (8a unificação modoRemuneracao + 8b webhook tokens) — abr/2026 | Política de Alocação + Engine de Otimização com Split |
| **Sprint 9** | Contabilidade preparatória Clube + ofertas exclusivas (9 + 9b) — abr/2026 | Motor de Diagnóstico Pré-Venda |

**Sprints 0, 1, 2, 3, 4 da nova pilha** NÃO colidem com a antiga (Sprints 1, 2, 2.5, 3 antigos eram ciclo de tickets pré-Sprint 5 e estão concluídos; Sprint 4 antigo foi pulado).

---

## 6. Onde cada numeração está documentada

### Numeração A (antiga)

| Arquivo | Última atualização | Conteúdo sprint |
|---|---|---|
| `docs/MAPA-INTEGRIDADE-SISTEMA.md` (linhas 814-836) | 2026-04-28 | Lista 15 sprints (12-26) em 3 fases |
| `docs/historico/COOPEREBR-ALINHAMENTO-2026-04-23.md` (linhas 440-470) | 2026-04-23 | Lista Sprints 12-14 |
| `docs/historico/recebidos-2026-04-28-claude-ai/README.md` | 2026-04-28 | Refs Sprint 13 |
| `docs/sessoes/` (60+ arquivos) | mar-abr/2026 | Histórico operacional sprint a sprint |
| `~/.claude/.../memory/` (10 arquivos com `sprint5/8/11/12/13a` no nome) | 2026-04-28 | Captura de estado por sprint |
| Mensagens git (133 commits com `[Ss]print` no grep) | 2026-03 a 2026-04-28 | Trilha cronológica completa |
| `backend/src/**/*.ts` (25 arquivos, 83 ocorrências) | abr/2026 | Comentários "Sprint 5", "Sprint 11", "Sprint 12" |
| `web/app/**/*.tsx` (5 arquivos, 12 ocorrências) | abr/2026 | Comentários "Sprint 7", "Sprint 9" |

### Numeração B (nova)

| Arquivo | Última atualização | Conteúdo sprint |
|---|---|---|
| `docs/PLANO-ATE-PRODUCAO.md` (linhas 31-360) | 2026-04-30 | **Fonte canônica** da nova pilha 10 sprints |
| `docs/CONTROLE-EXECUCAO.md` | 2026-04-30 noite | Tabela de status + decisões |
| `docs/PRODUTO.md` (Apêndice B) | 2026-04-30 | Lista resumida 10 sprints |
| `docs/REGULATORIO-ANEEL.md` (Seção 14) | 2026-04-30 | Sprints 0/5/8/9 com escopo regulatório |
| `docs/sessoes/2026-04-30-decisoes-doc-0-fatia2.md` | 2026-04-30 | Decisão 13 cria Sprint 0 |
| `docs/sessoes/2026-04-30-estado-cobranca-e2e.md` | 2026-04-30 noite | Recomendação executiva por sprint novo |
| `~/.claude/.../memory/project_doc0_fatia2_concluida.md` | 2026-04-30 noite | Memória persistente da pilha nova |

**Nenhum commit git ainda menciona numeração nova** (Sprint 0-9 não rodou).

---

## 7. Mapeamento implícito antigo → novo (segundo PLANO-ATE-PRODUCAO.md)

PLANO-ATE-PRODUCAO.md atual indica **mapeamento parcial** das absorções:

| Antigo | → | Novo |
|---|---|---|
| Sprint 13b (AuditLog) | → | absorvido pelo Sprint 5 + Sprint 6 |
| Sprint 13c (edição plano SaaS / suspensão) | → | absorvido pelo Sprint 7 (governança financeira) |
| Sprint 14 (Cron FaturaSaas) | → | absorvido pelo Sprint 1 (FaturaSaas Completo) |
| Sprint 17 (Engine COMPENSADOS) | → | absorvido pelo Sprint 2 (OCR-Integração + DINAMICO atômico) |
| Sprint 18 (Engine DINAMICO) | → | absorvido pelo Sprint 2 |
| Sprint 19 (DRE por parceiro) | → | absorvido pelo Sprint 7 |
| Sprint 20 (Conciliação CNAB) | → | absorvido pelo Sprint 7 |
| Sprint 22 (Audit Trail global) | → | absorvido pelo Sprint 6 |

### Sprints da antiga SEM equivalente claro na nova

| Antigo | Tema | Status na nova |
|---|---|---|
| Sprint 15 | Cadastro Condomínio atomizado | ❓ NÃO ABSORVIDO |
| Sprint 16 | Painel Agregador (Hangar/Moradas) | ❓ NÃO ABSORVIDO |
| Sprint 21 | Painel Síndico detalhado | ❓ NÃO ABSORVIDO |
| Sprint 23 | Templates por parceiro | parcialmente em Sprint 3 (Assinafy templates) |
| Sprint 24 | Login facial | ❓ NÃO ABSORVIDO |
| Sprint 25 | Suite E2E Playwright | ❓ NÃO ABSORVIDO |
| Sprint 26 | Pré-produção (load test + runbook) | ❓ NÃO ABSORVIDO |

**6 sprints antigos importantes (15, 16, 21, 24, 25, 26) NÃO têm equivalente na nova pilha.** Isso é **lacuna real** da nova numeração — Doc-0 Fatia 2 não cobriu condomínio/agregador/síndico/login facial/E2E/pré-produção.

---

## 8. Recomendação técnica

### Opção 1 — Adotar numeração nova (Sprint 0-9), aposentar antiga
- **Prós:** alinha com Doc-0 Fatia 2 + visão consolidada de 30/04 noite. Já mais simples (10 sprints vs 26).
- **Contras:** quebra continuidade com 133 commits git e 60+ sessões antigas. Conflitos diretos em 5 sprints (5/6/7/8/9 têm significados diferentes — confunde leitura de histórico). 6 sprints antigos importantes (15/16/21/24/25/26) ficam órfãos.
- **Mitigação:** preservar histórico antigo em `docs/historico/`; mapear absorções explícitas para os 6 órfãos (criar Sprint 10+ na nova pilha pra cobrir Condomínio/Agregador/Síndico/Login facial/E2E/pré-produção).

### Opção 2 — Continuar numeração antiga (Sprint 13b → 27+)
- **Prós:** preserva continuidade git e narrativa histórica completa. Não tem conflitos.
- **Contras:** 26 sprints é muito; perde-se a visão consolidada do Doc-0 Fatia 2; PLANO-ATE-PRODUCAO.md atual já reorganizado precisa ser desfeito.

### Opção 3 — Híbrida (RECOMENDADA pelo Code)
- **Adotar numeração nova como pilha de execução** (10 sprints estruturados).
- **Renumerar** os Sprints 0-9 da pilha nova como **Sprints 14-23** (continuando da antiga, evitando colisões com sprints concluídos 5-13a).
- **Adicionar Sprints 24-29** na pilha pra cobrir os 6 órfãos (Condomínio/Agregador/Síndico/Login facial/E2E/pré-produção).
- **Resultado:** 16 sprints futuros (14-29), continuidade preservada, zero conflitos, 0 órfãos.

**Ou opção 3-alternativa:** manter Sprint 0 (P0 emergencial é distinto da pilha) e renumerar Sprints 1-9 como Sprints 14-22.

---

## 9. Síntese executiva (5-10 linhas pra Luciano decidir)

**Estado atual.** Existem **DUAS numerações coexistindo**:
- **Antiga:** Sprints 1-26 (15 concluídos, 11 pendentes incluindo 13b-13c, 14-26).
- **Nova:** Sprints 0-9 (todos pendentes, criada em 30/04 noite no Doc-0 Fatia 2).

**Conflito direto.** Sprints 5/6/7/8/9 têm significados diferentes nas duas numerações (todos os 5 antigos foram concluídos em abril; todos os 5 novos estão pendentes). Ler "Sprint 5" hoje é ambíguo.

**Lacuna real.** A pilha nova **NÃO cobre** 6 temas importantes da pilha antiga: Condomínio atomizado (15), Painel Agregador (16), Painel Síndico (21), Login facial (24), Suite E2E (25), Pré-produção (26).

**Recomendação Code.** Renumerar a pilha nova como **Sprints 14-23** (continuando a antiga, evitando colisões) e **adicionar Sprints 24-29** pra cobrir os 6 órfãos. Resultado: 16 sprints futuros sem conflitos, continuidade git preservada.

**Decisão Luciano pendente.** Adotar Opção 1 (descontinuidade), Opção 2 (sem reorganização), Opção 3 (híbrida — recomendada Code) ou outra abordagem.

---

*Mapeamento read-only. Conduzido por Claude Code (Opus 4.7) em 2026-05-01. Aplica regra de validação prévia obrigatória.*
