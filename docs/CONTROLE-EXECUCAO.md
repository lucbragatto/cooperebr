# Controle de Execução — SISGD

> Arquivo vivo. Atualizar em **toda sessão** (claude.ai e Code).
> Última atualização: **2026-05-16** — **Bloco H' (Cadastro Usina expandido modularizado) fechado**. Marco M5 entregue: schema Usina expandido com 11 campos novos + 2 enums (FormaAquisicao/FormaPagamentoDono); AMAGES saneada (`ambienteTeste=true`); Exfishes CTR-000134 saneado e migrado pra Cooperebr2; Cooperebr2 (Linhares 2) cadastrada; Cooperebr1 apelidada; UI cadastro estendida com campos condicionais. `classeGd`/`RegrasFioB`/guards NÃO foram adicionados — ficam em Sprint Módulo Classificação GD separado (litígio CoopereBR×EDP em curso).

---

## ONDE PARAMOS

> **Seção viva atualizada via ritual de fechamento (memória `ritual_abertura_fechamento.md`).**
> Toda sessão Code abre lendo isto. Toda sessão Code fecha atualizando isto.

### Última sessão

- **Quando:** 16/05/2026 (Bloco H' Cadastro Usina expandido modularizado)
- **Tipo:** Code (execução completa com Fase 1 read-only + 4 checkpoints)
- **Resultado:**
  - **Marco M5 entregue:** schema Usina expandido (11 campos + 2 enums) sem `classeGd`/`RegrasFioB`/guards (modularizado pelo litígio judicial)
  - **AMAGES Opção A:** `ambienteTeste: false → true` (referência externa, preserva smoke M4)
  - **Exfishes CTR-000134:** saneado (kwhContratoAnual=720.000, percentualUsina=8) + migrado pra Cooperebr2
  - **Cooperebr2 cadastrada:** `cmp8fkxvt0001valkj8utb8vr` (Linhares 2, 1.000 kWp, 157.000 kWh, EDP_ES, CUSD EDP-ES-04123/2025 + EDP-ES-04124/2025)
  - **Cooperebr1 apelidada:** `apelidoInterno='cooperebr1'` + `formaAquisicao=ALUGUEL`
  - **D-novo-D catalogado** (P3): definir formaPagamentoDono concreto após acordo parceiro↔dono
  - **UI cadastro usina estendida:** campos condicionais FIXO/PERCENTUAL na `/dashboard/usinas/nova`
- **Sub-tarefas concluídas:** H'.1 (schema), H'.2 (migration 2 rounds), H'.3 (AMAGES), H'.4 (Exfishes), H'.5 (Cooperebr2), H'.6 (apelidos), H'.7 (UI), H'.9 (smoke 5/5 PASS), H'.10 (este fechamento). H'.8 (HTML) pendente — claude.ai redige.
- **Detalhe:** `docs/sessoes/2026-05-16-bloco-h-linha-fechado.md`
- **Próximo:** Bloco C — Cadastro SEM_UC UI (4-6h)

### Sessão anterior

- **Quando:** 15/05/2026 (sessão Code dedicada — Bloco A Sub-Fase B AMAGES)
- **Tipo:** Code (execução completa com 2 checkpoints intermediários + Fase 1 read-only obrigatória)
- **Resultado:**
  - **Marco M4 entregue** (redefinido em 15/05): 1ª validação engine COMPENSADOS em ambiente real
  - **AMAGES = 5º cooperado piloto PJ** da CoopereBR (Associação dos Magistrados do Espírito Santo, CNPJ 27.053.685/0001-90), `ambienteTeste=false`, contatos = Luciano (regra inegociável)
  - **2 UCs reais**: PUTIRI (`0.001.334.421.054-40`, A4 VERDE, Aracruz/ES) + SEDE ADM (`0.002.399.394.054-06`, B3 CONVENCIONAL, Vitória/ES) — dados extraídos de PDFs EDP mar/2026 reais
  - **PLANO AMAGES COMPENSADOS** (publico=false, descontoBase 18%, cooperativaId CoopereBR)
  - **Contrato CTR-2026-0008** (Usina Linhares EDP_ES, kWh anual 101.028, kWh mensal 8.419, percentualUsina 5,6127%, tarifaContratual R$ 0,19557)
  - **Cobrança R$ 979,20** gerada via `PATCH /faturas/<id>/aprovar` HTTP real — modeloCobrancaUsado=CREDITOS_COMPENSADOS, 6/6 campos batem com expectativa (kwhCompensado × tarifaContratual)
  - **LancamentoCaixa PREVISTO** R$ 979,20 criado automaticamente (D-54 não ressurgiu)
  - **D-46.SEED RESOLVIDO permanente** — 5 planos globais COMPENSADOS `publico=false` (decisão Luciano: não religar)
  - **Ciclo BLOQUEIO**: pm2 stop → `.env BLOQUEIO=false` → build → restart (passo 2) → engine COMPENSADOS rodou → pm2 stop → `.env BLOQUEIO=true` → build → restart (passo 8). Backend pós-fechamento volta ao default seguro.
- **Commits desta sessão:** `ccde5ec` (D-46.SEED + investigação) + `a09a66e` (AMAGES E2E)
- **Próxima sessão:** **Bloco H — Cadastro Usina expandido** (`classeGd` + `formaAquisicao` + `formaPagamentoDono`). Mitiga risco P0 D-30A/D-30B Exfishes R$ 310k/ano. Destrava Bloco E (realocação multi-usina) + Bloco F (automação concessionária).

### Sessão anterior

- **Quando:** 13-14/05/2026 (sessão maratona ~36h corridas; fechamento 14/05 noite com Fase 2 Hardening completa)
- **Tipo:** claude.ai (coordenação) + Code (execução) + 7 sub-agentes claude.ai paralelos (noite 13/05 inventário)
- **Resultado:**
  - **M2 entregue:** canário FIXO_MENSAL E2E real (4 cooperados-piloto DIEGO/CAROLINA/ALMIR/THEOMAX, total R$ 2.542,26/mês)
  - **M3 entregue:** 1ª receita técnica real — sub-canário CAROLINA Asaas sandbox + ngrok + WhatsApp + email + webhook PAYMENT_RECEIVED → cobrança PAGO + LancamentoCaixa REALIZADO + email confirmação automático (latência webhook→email: 5s)
  - **D-48 P1 SEGURANÇA fechado** (7 patches multi-tenant em motor-proposta, cooperados, migracoes-usina, contratos, usinas) + saneamento 2 contratos divergentes
  - **Fase 2 Hardening A→I completa em 7 commits** (`3106e6d` 2A IDOR cobranças + `fef024a` 2B IDOR contratos + Fase 2C IDOR faturas + 2D IDOR motor-proposta + 2E IDOR financeiro/lancamentos/convenios + `e6ee6e5` 2G Helmet/HSTS/CSP + `8fd28dc` 2H delete legacy /parceiro/membros + redirect 301 + `26836ab` 2F AuditLog interceptor global). **Bonus em 2I:** smoke cross-tenant detectou vulnerabilidade real `PUT /cooperados/:id` aceitando cross-tenant → fix imediato no `cooperados.service.update/remove` (recebem `cooperativaId` opcional).
  - **34+ endpoints com IDOR fix.** 18 endpoints com `@AuditLog`. **Smoke E2E cross-tenant 2/2 PASS** após fix bonus.
  - **D-30N (AuditLog) RESOLVIDO** + **D-48 RESOLVIDO** + **D-50/.2 RESOLVIDOS** + B1 cross-talk RESOLVIDO.
  - **11 débitos resolvidos no canário:** D-30I (Lei 14.300) + D-45 3/4 sub-fixes + D-50 + D-50.2 + D-51 (listagem + detalhe) + D-52 + D-53 + D-54 + D-55 + `/cooperativas/minha` endpoint + saneamento
  - **13 débitos catalogados formalmente** D-35..D-47 (movidos de memória persistente pro `debitos-tecnicos.md`)
  - **3 sugestões em memória persistente** #5 orquestrador, #6 script auto HTML, #7 OBSERVABILIDADE TOTAL
  - **2 regras inegociáveis bilaterais** ativas no CLAUDE.md: fechamento sessão (`83776d8`) + contatos teste sempre Luciano com refinamento Gmail `+suffix` (`62e58d2` + `f13f631`)
  - **HTML jornada-membro v1.0 → v2.0** + **HTML inventário-sisgd v1.0 → v1.1** + **HTML cadastro-usinas v1.0** (via 7 sub-agentes, 96 itens, 20 gaps)
- **Detalhe completo:** `docs/sessoes/2026-05-14-maratona-canario-d48-d50-d55-subcanario-carolina-fase2-parcial.md` + `docs/sessoes/2026-05-14-fase2-hardening-completo.md` (NOVO neste fechamento).
- **Próxima sessão:** Sinergia onboarding (2º parceiro real) destravado — pré-requisito Fase 2 Hardening cumprido.

### Frase de retomada COMANDANTE

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único).

### Sessão anterior — 2026-05-13 manhã (Fatia H.2 + D-33 reframe)

- **Quando:** 2026-05-13 (claude.ai + Code, dia inteiro: Fase B + Fatia H.2 + Sub-fatia D-33 Caminho B)
- **Tipo:** Code (execução documental + investigação read-only) + claude.ai (revisão + decisões)
- **Resultado:**
  - **Fase B** (4 commits): `94bf9dc` INDEX+SISTEMA esqueleto (B.0) + `049db42` débitos (B.1+B.2) + `cbce0aa` Sprint Consolidado (B.3) + `e5eb360` controle+frase (B.4+B.5+B.6).
  - **Decisão 24 cleanup** (commit `b0663c9`): consolidar frase de retomada local único + grep amplo antes de atualizar.
  - **Fatia H.2 SISTEMA.md base** (3 commits — **M1 do Plano Mestre entregue**): `382f40e` Dia 1 (backend 45 módulos + 80 models + correção retroativa AsaasCobranca=5) + `0528cd8` Dia 2 (frontend 152 telas + 10 fluxos críticos) + `464e4d3` Dia 3 (integrações + crons + auth + observabilidade + decisões + env vars). SISTEMA.md cresceu de 24 → 1.542 linhas. Pessoa nova lê em ~45 min.
  - **Sub-fatia D-33 Caminho B** (1 commit pendente neste prompt): Fase 1 investigação read-only revelou que **D-33 era LATENTE, não ATIVO** (UI + service + webhook usam `AsaasConfig` consistente). Reframe P1→P2 latente em 4 docs (SISTEMA.md + debitos + plano + controle). **Zero código tocado.** Fatia A liberada (não depende mais D-33).
  - **2 aplicações Decisão 23 em 24h:** (1) 12/05 noite — desfeita memória "31 PAGAS = 100% baixa manual / AsaasCobranca=0" (real: 5 via Asaas sandbox + 26 manual). (2) 13/05 noite — desfeita premissa "UI escreve em ConfigGateway / dual-path ATIVO" (real: UI escreve em AsaasConfig consistente / D-33 LATENTE).
- **Commits:** 8 (`94bf9dc` + `049db42` + `cbce0aa` + `e5eb360` + `b0663c9` + `382f40e` + `0528cd8` + `464e4d3`).

### Sessão anterior

- **Quando:** 2026-05-11 (Code maratona, manhã → tarde)
- **Tipo:** Code (4 fases técnicas + 4 documentais — execução pós-sessão claude.ai prévia que validou 5 D-J)
- **Resultado completo:**
  - **5 D-J fechadas** (D-J-1=a / D-J-2=intencional+D-30W / D-J-3=fora+sugestão #4 / D-J-4=juntos urgência / D-J-5=playbook escrito)
  - **UI etapa 11:** cooperado real CoopereBR **MARCIO MACIEL destravado** via endpoint dedicado POST /cooperados/:id/aprovar-concessionaria + DTO `@MinLength(3)` + service multi-tenant (SUPER_ADMIN bypass) + 6 specs + Dialog admin (Commit `8853d97`)
  - **Fase C.2 reduzida:** 5 itens UI plano avançada — `validacoes-plano.ts` (20 specs ts-node) + Item 5 snapshot+confirmação salvar via `_count.contratos` filtrado por tenant em `findAll`/`findOne` (Commit `6d2510e`)
  - **Fase C.3:** `<EconomiaProjetada>` reusável (29 specs ts-node) em cobrança + contrato (recálculo via `simular-plano`) + proposta (backend retorna `economia5Anos`/`15Anos` on-the-fly). Backwards-compat preservada. (Commit `ecf39cd`)
  - **D-30Y resolvido:** validação E2E manual /aprovar-proposta com 2 propostas teste sintéticas (CoopereBR Teste) + 2 screenshots Luciano confirmou os 4 valores (Commit `fecbe2a`)
  - **Adendo §11 spec CooperToken:** 5 achados validados via Decisão 21 (sem `head -N` truncando) + D-30Z catalogado (85 cooperados em estado intermediário `opcaoToken → modoRemuneracao`) (Commit `69902f6`)
  - **Sprint 0 passos iniciais:** relatório auditoria concentração >25% gerado (62 contratos analisados, 0 casos detectados) — **achado meta crítico D-31 descoberto:** `Contrato.percentualUsina` zerado/irrealista no banco, EXFISHES histórico aparece a 0% (Commit `851a39e`)
  - **Decisão 22 catalogada:** aprovação admin do plano permanece manual até Sprint 5+8 fecharem
- **Débitos:** D-30W (P2), D-30X (P3), **D-30Y ✅ RESOLVIDO**, D-30Z (P3), **D-31 (P1 provisório CRÍTICO — reframed em 13/05 pra P2 só guard)** + D-30A status 11/05 atualizado
- **Commits da sessão (9):** `5cde3e0`, `8853d97`, `f30be3c`, `6d2510e`, `ecf39cd`, `fecbe2a`, `69902f6`, `851a39e`, (commit 9 fechamento)
- **Detalhe completo:** `docs/sessoes/2026-05-11-execucao-maratona.md`

### Sessão anterior anterior

- **Quando:** 2026-05-05 tarde (~2h investigação read-only)
- **Tipo:** claude.ai (sem código)
- **Resultado:**
  - 2 investigações read-only: escopo real Fase C.3 + reframe etapa 11 (aprovação concessionária)
  - **Reframe etapa 11:** 80% implementada (não inexistente como manhã afirmou) — schema TEM `Cooperado.protocoloConcessionaria` + enum `StatusCooperado.AGUARDANDO_CONCESSIONARIA`; backend TEM 9 callers + `enviarCadastroAprovado()`. Falta APENAS UI admin.
  - **C.3 confirmada como hipótese (b):** 1 frase repetida em 4 docs, sem decomposição.
  - **D-J-1 reformulada:** de "construir aprovação concessionária 2-4h" pra "fechar UI admin de transição ~1-2h, absorvível em C.2/C.3"
  - **D-J-5 nova catalogada:** Fase C.3 precisa playbook antes de virar Code
  - **Decisão 21 catalogada:** investigação schema/código deve cobrir 3 frentes
- **Commits:** 1 (fechamento docs — c0f9b70)
- **Detalhe completo:** `docs/sessoes/2026-05-05-tarde-investigacao-c3-etapa11.md`

### Sessão 2026-05-05 manhã (mantida pra contexto)

- **Quando:** 2026-05-05 manhã (~2h investigação read-only)
- **Tipo:** Code + claude.ai (sem código)
- **Resultado:**
  - 3 investigações read-only: validação opções claude.ai + escopo literal C.2 + **mapeamento jornada ponta-a-ponta em 14 etapas**
  - 4 gaps detectados (etapas 5, 9, 11, 12-A) — etapa 11 corrigida em 05/05 tarde
  - 4 decisões pendentes (D-J-1 a D-J-4) catalogadas
  - Caveat C.2 item 4 (CooperToken expandido = condenado pelo Sprint CT Consolidado)
  - Estimativa primeira receita: 12-20h Code + 1-2 sem operacional (otimista)
- **Commits:** 0 código (1 commit de docs)
- **Detalhe completo:** `docs/sessoes/2026-05-05-investigacao-jornada-e2e.md`

### Sessão 04/05 noite (mantida pra contexto)

- **Quando:** 2026-05-04 noite (claude.ai, ~1.5h investigação + decisão)
- **Tipo:** claude.ai (investigação read-only + decisão estruturante)
- **Resultado:**
  - 2 investigações read-only no Code (mapeamento amplo + 5 lacunas) sobre arquitetura CooperToken
  - **Decisão estruturante:** promover ao status de sprint próprio formal — "Sprint CooperToken Consolidado" (14-18h)
  - Escopo definitivo: schema delta (10 campos saem do Plano, 1 fica) + estender `ConfigCooperToken` + refator 4 services + UI nova + remover campos UI Plano + **pré-requisito P0: escrever specs Jest do módulo (~6-8h, hoje 0 specs)**
  - Migração de dados será trivial (banco vazio nos campos relevantes — investigação confirmou)
  - Sequência aprovada: Fase C.2 → Fase C.3 → Sprint CooperToken Consolidado
- **Commits:** 0 código (só investigação + atualização memória)
- **Detalhe completo:** `docs/sessoes/2026-05-04-noite-investigacao-coopertoken.md`

### Sessão 04/05 tarde (mantida pra contexto)

- **Quando:** 2026-05-04 tarde (claude.ai, ~3-4h)
- **Tipo:** claude.ai (housekeeping git + Sprint 5 ponto 3 atualizado + validação manual Fase C.1.1)
- **Resultado:**
  - **Housekeeping git:** 3 commits sem impacto funcional (df0de86 PM2 .env, 722914f .gitignore configs locais + backups/, 71ec415 script setar-webhook-token-asaas idempotente)
  - **Sprint 5 ponto 3 atualizado:** decisão original (UI v1 esconde COM_ICMS/CUSTOM, configura via API) ficou obsoleta desde Fase B porque helper canônico lança NotImplementedException no aceite. Aplicado: `<option disabled>` na UI + `@IsIn(['KWH_CHEIO','SEM_TRIBUTO'])` no DTO + nota datada na sessão Sprint 5 + 2 débitos catalogados (D-30U fórmula órfã motor.dimensionar, D-30V unificação 3 fontes). 2 commits (ca0c0af UI, e097b0a backend+docs).
  - **Validação manual Fase C.1.1: PASSOU.** 4 bugs UX corrigidos no Code de manhã foram validados. Falso bug detectado durante validação (0.87960 vs 0.90300) descoberto como confusão de premissa: plano testado tem descontoBase=18, helper correto.
- **Commits:** 5 (df0de86, 722914f, 71ec415, ca0c0af, e097b0a) — todos pushados pra origin/main.
- **Detalhe completo:** `docs/sessoes/2026-05-04-resumo-sessao-claude-ai.md`

### Sessão 04/05 manhã (mantida pra contexto)

- **Quando:** 2026-05-04 manhã (Code, ~1-2h)
- **Tipo:** Code (Fase C.1.1 — correções UX pós-validação)
- **Resultado:** 4 bugs UX corrigidos em /dashboard/planos/novo e /[id]. Helper simular-plano ampliado pra 10 cenários ts-node verde. **Validada manualmente em 04/05 tarde (sessão claude.ai).**
- **Commits:** 4 (5062933, 6c452fe, cb1ec43, f68c5c6).

### Sessão 03/05 (mantida pra contexto curto)

- **Quando:** 2026-05-03 (maratona ~10-12h, 4 fases sequenciais)
- **Tipo:** Code (Fase A + B + B.5 + C.1)
- **Resultado consolidado:**
  - **Fase A** (manhã): multi-tenant em Planos. 4 bugs cross-tenant resolvidos + lacuna B13 (seed `CREDITOS_COMPENSADOS` → `FIXO_MENSAL`). 20 specs Jest verde. UI condicional por perfil. **4 commits.**
  - **Fase B** (tarde): D-30R RESOLVIDO + duplo desconto eliminado + DINAMICO implementado + Decisão B33 aplicada. Helper canônico `calcularTarifaContratual` em 5 caminhos. 72 specs Jest verde. **6 commits.**
  - **Fase B.5** (noite): validação E2E sintética **6/6 ✓** com 8 valores cada (incluindo 4 valores de economia projetada). Cooperativa teste isolada (CNPJ 11.111.111/0001-11). Schema delta `Contrato.valorCheioKwhAceite` + 4 campos `Cobranca`. FIXO grava `valorBruto` (resolve Sprint 7 #4). Decisões B33.5 + B34 + B35 cristalizadas. **4 commits.**
  - **Fase C.1** (noite mais tarde): UI plano + simulação tempo real. Helper `web/lib/simular-plano.ts` com paridade matemática backend (6/6 ts-node ✓). Componentes `<PlanoSimulacao>` + `<CombinacaoAtual>`. Campos condicionais por modelo. Layout 2 colunas em `/dashboard/planos/novo`. **5 commits.**
  - **Total:** 19 commits + 1 commit de investigação inicial = **20 commits**. Validação matemática **48/48** (6 cenários × 8 valores ✓).
- **Detalhe completo:** `docs/sessoes/2026-05-03-resumo-sessao-completa.md`.

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
- **Decisão 23 aplicada 2× em 24h** (12/05 noite + 13/05 noite): (1) desfeita memória "AsaasCobranca=0 / 31 PAGAS = 100% baixa manual" → real é 5 via Asaas sandbox + 26 manual (Sprint 12 validation); (2) desfeita premissa "UI escreve em ConfigGateway / dual-path D-33 ATIVO" → real é UI escreve em AsaasConfig consistentemente / D-33 LATENTE só. Padrão: afirmação categórica de memória catalogada vira hipótese a re-validar via SQL/grep antes de planejar refator.
- **Decisão 24** (13/05 noite): frase de retomada vive em UM SÓ LUGAR + grep amplo (`voltei|frase de retomada|como retomar`) antes de atualizar (memória `ritual_abertura_fechamento.md`).
- **Sprint 5 ponto 3 atualizado** (04/05 noite — sessão claude.ai): UI v1 e API v1 só aceitam KWH_CHEIO/SEM_TRIBUTO. Decisão original "configura via API" virou letra morta desde Fase B (helper canônico throw NotImplementedException). Aplicado via `<option disabled>` + `@IsIn` no DTO + nota datada na sessão Sprint 5.
- **Adendo §11 spec CooperToken** (11/05 sessão Code, Commit 7): não retroatualiza §1-§10. 5 achados validados antes (Decisão 20): identidade SISGD vs CoopereBR, numeração de sprints (8/9/10), ConfigCooperToken vs ConfigDesvalorizacao, estado real do MVP, pré-requisitos P0 do refator. **D-30Z** catalogado (P3 documental, 85 cooperados intermediários `opcaoToken→modoRemuneracao`).
- **Reclassificações:** D-30M P1→P2, D-30N escopo expandido, D-30R catalogado novo
- **Resolvido:** D-30O (commit `7ea6943`)
- **Catalogados como sprints formais (Decisão 18):** Sprint 5a (Fio B), Sprint 3a (RN 482→Lei 14.300)
- **Catalogados como débitos:** D-30R (Motor.aceitar), D-30S (extrair Jornadas), D-30T (extrair Painéis), **D-30U (P2 — fórmula órfã motor.dimensionar, 04/05)**, **D-30V (P3 — unificação 3 fontes de verdade, 04/05)**
- **Catalogada como sugestão:** #3 Cron Análise Diária Sessões
- **Movido pra histórico:** SISGD-VISAO-COMPLETA.md (substituído por PRODUTO.md)

### Pendências consolidadas

→ Ver seção [PENDÊNCIAS PARA PRÓXIMA SESSÃO](#pendências-para-próxima-sessão) abaixo.

**Total restante:** ~32 decisões pendentes (B1-B32) + ~8 sprints potenciais (C1-C8).
**P1 = 0**. Pendências resolvidas hoje: 12.

### Próximos passos imediatos (priorizado P0 → P1 → P2 → P3)

**Fase B ✅ CONCLUÍDA em 13/05** (B.0 INDEX+SISTEMA esqueleto + B.1+B.2 débitos + B.3 Sprint Consolidado + B.4/B.5/B.6 fechamento). 11 fatias do Sprint Cadastros+Financeiro Consolidado catalogadas em `PLANO-ATE-PRODUCAO.md` Seção 3c.

**Sequência operacional Opção 4 (Plano Mestre, confirmada 12/05):**

A. ✅ **ETAPA 1 — H.2 SISTEMA.md base** [P0 — 2-3d Code] — **CONCLUÍDA 13/05** (Marco M1 entregue, 4 commits, 1.542 linhas).
B. ~~**Sub-fatia D-33 dual-path Asaas**~~ [P1 — 1-2d Code] — **REFRAMED 13/05 noite via Caminho B** (docs only, sem código). D-33 P1→P2 latente. **Não bloqueia mais Fatia A.**
C. **Fatia A canário Caminho A real** [P0 — 2-4d Code] — 1 cooperado real fim a fim Asaas sandbox CoopereBR. Marco M2. **Liberada** (D-33 não é mais pré-req).
D. **Fatia H.3 + D3 em paralelo** [Marco M3] — ligações cross-módulo + FaturaSaas completo Luciano→Parceiro (D-29F.1+.2+.3 decompostos).
E. **Fatia H.4 + B em paralelo** [Marco M4] — fluxos end-to-end + multa/juros mínimo.
F. **Fatia C** [Marco M6 — janela disponível] — specs Jest módulo CooperToken (6-8h, autônomo).
G. **Médio prazo** — D1 (conciliação BB/Sicoob) + D2 (DRE/fechamento) + G (débitos cumulativos).
H. **Longo prazo** — E (polish cadastros) + F (painel super-admin) + L (UI auto-config Asaas parceiro).

### Frase de retomada

> Ver seção canônica [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo. Frase DIRETA pronta pra colar no Claude Code (VS Code) — comanda ação imediata em vez de descrever plano (feedback `feedback_frase_retomada_direta.md` 12/05 noite).

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

## FRASE DE RETOMADA — próxima sessão Code

Cola direto no Claude Code (VS Code) quando voltar:

```
Continuando plano A→H ordem otimizada. Bloco H' (Cadastro Usina modularizado) fechado 16/05 — schema expandido 11 campos + 2 enums sem classeGd/RegrasFioB/guards (litígio judicial). Próximo: BLOCO C — Cadastro SEM_UC UI (4-6h Code). Banco já suporta `tipoCooperado.SEM_UC`; falta UI visível em /dashboard/cooperados/novo. Destrava MLM/D-44 MST (indicador puro sem UC). Ler primeiro ~/.claude/projects/C--Users-Luciano-cooperebr/memory/plano_h_linha_modular_16_05.md (sequência consolidada). Fase 1 read-only obrigatória. Mini-fechamento obrigatório ao terminar (commits + push + CONTROLE-EXECUCAO + MAPA-INTEGRIDADE + sessões/2026-05-XX-bloco-c-sem-uc.md).
```

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
| CT | CooperToken Consolidado | 🔴 não iniciado, **catalogado 04/05 noite** | P1 | 14-18h Code (Etapa 1 specs ~6-8h, Etapa 2 refator ~8-10h) |

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

- [x] ✅ **Validação manual da Fase C.1 + C.1.1 por Luciano** — VALIDADA em 04/05 tarde (sessão claude.ai). 4 bugs UX corrigidos pelo Code de manhã passaram. Falso bug 0.87960 diagnosticado como premissa errada do operador (plano com descontoBase=18, não 15).
- [x] ✅ **5 decisões D-J-1 a D-J-5 RESOLVIDAS** (sessão claude.ai 11/05/2026):
  - **D-J-1 ✅:** (a) Fazer agora. UI etapa 11 entra nesta sessão Code (~1-2h).
  - **D-J-2 ✅:** Intencional **com revisão temporária**. Catalogado D-30W (P2 processual). Admin revisa cada aceite na fase de testes; automatizar quando Sprint 5 (flags ANEEL) + Sprint 8 (Engine Otimização) fecharem. **Decisão 22 catalogada.**
  - **D-J-3 ✅:** (b) Fica fora. Item "CooperToken expandido" NÃO entra na C.2 reduzida. Sugestão pendente #4 catalogada na memória persistente (polir UX pós Sprint CT Consolidado).
  - **D-J-4 ✅:** (a) C.2 + C.3 juntos com urgência. Meta da sessão Code: finalizar o quanto antes.
  - **D-J-5 ✅:** (a) Playbook escrito em sessão claude.ai 11/05 — `docs/playbooks/playbook-fase-c3.md` (6 decisões D-P-1..D-P-6 + sequência de implementação).
- [ ] **Fase C.2 reduzida** (5 itens, D-J-3=fora): promo defaults + validação visual, simulação 2 fases, vigência + validação Campanha, lista enriquecida (escopo + indicadores), confirmação antes de salvar mudanças críticas. **~3-4h Code — em execução nesta sessão.**
- [ ] **Fase C.3** (3 telas com 4 valores de economia projetada). Backend já preenche; é só frontend + 1 endpoint backend ampliado. **~1.5-2h Code — em execução nesta sessão (seguir playbook D-P-1..D-P-6).**
- [ ] **UI etapa 11 (aprovação concessionária)** — D-J-1=a, fechando UI admin de transição AGUARDANDO_CONCESSIONARIA → APROVADO. Cooperado real travado: MARCIO MACIEL (CoopereBR). **~1-2h Code — em execução nesta sessão.**
- [x] ✅ **Gap jornada — etapa 5 (aprovação admin do plano)** — D-J-2 respondida: intencional com revisão temporária. Catalogado como D-30W pra revisitar pós Sprint 5+8.
- [ ] **Gap jornada — etapa 12-A (Caminho A OCR→cobrança)** — nunca rodou em produção. Pré-requisito Sprint 2 OCR-Integração.
- [ ] **Gap jornada — etapa 9 (lista de espera sem rota dedicada)** — funciona via Step7+cooperados, mas sem tela própria. P3.
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
- ~~C3 CooperToken Configurável~~ → **PROMOVIDO a Sprint CooperToken Consolidado em 04/05 noite** — escopo expandido (consolidação arquitetural completa, não só campos extras). Ver `docs/sessoes/2026-05-04-noite-investigacao-coopertoken.md`.
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

- [x] ✅ **D-30Y — Validação E2E manual /aprovar-proposta (4 valores Fase C.3)** — RESOLVIDO em 11/05 (esta sessão). 2 propostas teste geradas via `backend/scripts/criar-proposta-teste-c3.ts` (CoopereBR Teste), 2 screenshots confirmados por Luciano em janela anônima mostrando `<EconomiaProjetada>` renderizando R$ 76,50 / 918 / 4.590 / 13.770. Cleanup feito (cooperados teste deletados). Detalhe completo em `docs/debitos-tecnicos.md` (D-30Y).
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

### Decisão 21 — Investigação de schema/código deve cobrir 3 frentes (sessão 05/05 tarde)

Antes de afirmar "X não existe no código":
- (a) Buscar campo/identificador literal
- (b) Verificar enum / state machine alternativo (sistema pode usar status em vez de campo dedicado)
- (c) Inspecionar comentários e docs adjacentes

Output sem `head -N` truncando — se passar de 100 linhas, refinar busca, não truncar.

**Origem:** sessão 05/05 manhã marcou etapa 11 (aprovação concessionária) como `🔴 inexistente` baseado em busca incompleta — `head -20` truncou matches do schema (linhas 125 e 232 ficaram fora do output) + busca por campo literal `aprovadoConcessionaria` ignorou enum `StatusCooperado.AGUARDANDO_CONCESSIONARIA` que é o mecanismo real. Investigação corrigida em 05/05 tarde revelou implementação 80% pronta.

**Complementa:** Decisão 14 (validação prévia em geral), Decisão 15 (regra estendida), Decisão 20 (validação em cada resposta).

**Aplica retroativamente:** revisar afirmações "X não existe" feitas em sessões anteriores quando houver dúvida.

### Decisão 22 — Aprovação admin do plano permanece manual até Sprint 5+8 (sessão claude.ai 2026-05-11)

D-J-2 da sessão 05/05 manhã perguntou: etapa 5 (aprovação admin do plano antes de virar contrato) é intencional ou gap?

**Resposta de Luciano (11/05/2026):** Intencional **com revisão temporária**. Na fase de testes/amadurecimento, admin revisa cada aceite de proposta manualmente antes de virar contrato. Não é gap.

**Quando automatizar:** transição admin → automática só faz sentido quando:
- **Sprint 5** (5 flags ANEEL — limite 25%, mix de classes, concentração por cooperado, transferência saldo, mistura classes mesma usina) estiver pronto;
- **Sprint 8** (Engine de Otimização com Split + Sugestão default + guard-rails) estiver pronto.

Aí a transição vira automática com validação por flags + sugestão da engine.

**Catalogado como débito processual:** `D-30W` (P2) em `docs/debitos-tecnicos.md` — pra revisitar quando os 2 sprints fecharem.

**Origem:** Luciano em sessão claude.ai 11/05/2026 respondendo D-J-2.

**Complementa:** decisão 30/04 sobre 5 flags regulatórias por parceiro (REGULATORIO-ANEEL.md).

### Decisão 23 — Memória de catálogo pode inflar números — validar via SQL antes de planejar (catalogada 12/05, formalizada 13/05)

**Regra inegociável:** memória de catálogo (incluindo a do Luciano e a de catálogo histórico do projeto) pode inflar números — **sempre validar via SQL antes de transformar afirmação em premissa de planejamento.**

**Origem:** "31 cobranças PAGAS via Asaas sandbox" era **ficção da memória**. Sprint 12 validou apenas payload sintético (webhook conferido com fixture). `AsaasCobranca` tabela = **0 registros**. 31 PAGAS = **100% baixa manual**, zero Asaas real. Investigação Code 12/05 desfez a hipótese.

**Aplica retroativamente a:**
- **Memória do Luciano** — esqueceu config Asaas sandbox criada Sprint 7/8 (achado-chave 1 do dia 13/05: `AsaasConfig` CoopereBR existe desde 23/03).
- **Memória de sessões anteriores** — catálogo desatualizado (ex.: dual-path Asaas só virou explícito em 13/05).
- **Análises externas de outras IAs** — quando outra IA afirmar estado do sistema, exigir validação SQL antes de assumir.

**Operacionalização:** qualquer afirmação categórica ("zero", "nunca", "não existe", "X cobranças PAGAS") merece validação SQL antes de virar premissa. Code respeitou Decisão 23 em **12/05 tarde** (desfez 31 PAGAS via SQL) e **13/05 manhã** (validou os 5 achados-chave via `SELECT` direto antes de propor decomposição D-29F).

**Complementa:** Decisão 14 (validação prévia em geral), Decisão 15 (regra estendida), Decisão 20 (validação em cada resposta), Decisão 21 (3 frentes na investigação schema/código).

**Origem:** Luciano em sessão Code 12/05 noite revelou que dados que tinham sido tratados como reais nas sessões anteriores (61 contratos zerados em D-31, 31 PAGAS Asaas sandbox) eram fictícios/baixa-manual. Decisão formalizada em sessão Fase B de 13/05.

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

- **Quando começar Sprint CooperToken Consolidado** — pode rodar em paralelo com canário (independente do subsistema FIXO/COMPENSADOS/DINAMICO).
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

**Fase B ✅ CONCLUÍDA em 13/05** — B.0 INDEX+SISTEMA esqueleto + B.1+B.2 débitos + B.3 Sprint Consolidado catalogado (11 fatias). 4 commits: `94bf9dc` + `049db42` + `cbce0aa` + (B.4-B.6 fechamento).

**Sequência Plano Mestre Opção 4 (decidida 12/05 noite, confirmada 13/05):**

1. **ETAPA 1 — H.2 SISTEMA.md base** (2-3d Code) — 45 módulos + 80 models + 152 telas. **Marco M1.**
2. ~~**Sub-fatia D-33 dual-path Asaas** (1-2d Code) — pré-req Fatia A.~~ **REFRAMED Caminho B 13/05 noite — D-33 P2 latente, não bloqueia mais.**
3. **Fatia A canário Caminho A real** (2-4d Code) — 1 cooperado real fim a fim. **Marco M2.**
4. **Fatia H.3 + D3** em paralelo (2d + 5-8d) — **Marco M3.**
5. **Fatia H.4 + B** em paralelo (1-2d + 3-5d) — **Marco M4.**
6. **Fatia C** (6-8h autônomo em janela disponível) — **Marco M6.**
7. **Médio prazo (45-90d):** D1 + D2 + G.
8. **Longo prazo (90+d):** E + F + L.

**Referências detalhadas:** `docs/PLANO-ATE-PRODUCAO.md` Seção 3c (11 fatias com tema/persona/critério/estimativa/dependências por fatia, cumprindo Decisão 18).

---

## COMO RETOMAR

### Frase única canônica

Frase de retomada vive em **um só lugar** — seção [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) acima.

Aplica-se a Code e claude.ai. **Decisão 24** (13/05 noite): grep amplo (`voltei|frase de retomada|como retomar`) antes de atualizar — frase única no `CONTROLE-EXECUCAO` evita versões divergentes que confundem retomada.

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
