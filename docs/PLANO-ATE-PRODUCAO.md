# PLANO ATÉ PRODUÇÃO REAL — SISGD

**Última atualização:** 11/05/2026 — sessão Code maratona fechada (9 commits, 4 fases técnicas + 4 documentais).

> **Audiência:** Luciano (não-programador, dono do SISGD).
> **Pra que serve:** roteiro de execução até produção real plena (CoopereBR + Sinergia migrando do sistema antigo).
> **Documentos vivos relacionados:**
> - `docs/CONTROLE-EXECUCAO.md` (estado atual, decisões pendentes)
> - `docs/PRODUTO.md` (visão humana e funcional — substitui SISGD-VISAO movido pra `docs/historico/` em 03/05/2026)
> - `docs/REGULATORIO-ANEEL.md` (manual técnico-regulatório)
> - `docs/MAPA-INTEGRIDADE-SISTEMA.md` (estado técnico atual, log cronológico)
> - `docs/debitos-tecnicos.md` (lista consolidada de pendências)

---

## Seção 0 — Estado atual em 1 página (02/05/2026)

### O que está pronto (concluído)

- **Sprints históricos:** 1-13a (133 commits git, abr-mar/2026)
- **Caminho B (cobrança manual + Asaas sandbox):** 31 cobranças PAGAS validadas (commit `16302e9`)
- **Webhook Asaas sandbox:** 3 bugs P1 corrigidos
- **Painel SISGD super-admin:** lista parceiros + cards saúde + IDOR fix
- **Doc-0 Fatia 2:** PRODUTO.md + REGULATORIO-ANEEL.md + CONTROLE-EXECUCAO.md
- **Convênios fluxo público:** D-30P + D-30Q resolvidos (commit `fa9dc72`)
- **D-30O:** mesReferencia OCR resolvido (02/05, commit `7ea6943`)
- **Doc-0 Grupo B:** 7 ajustes factuais aplicados
- **Fase A Planos** ✅ (03/05 manhã): multi-tenant + seed FIXO_MENSAL (4 commits)
- **Fase B Planos** ✅ (03/05 tarde): D-30R RESOLVIDO + duplo desconto eliminado + DINAMICO implementado + Decisão B33 (6 commits)
- **Fase B.5** ✅ (03/05 noite): validação E2E sintética **6/6 cenários ✓** com 8 valores cada (incluindo economia projetada). Cooperativa teste isolada `TESTE-FASE-B5`. FIXO grava `valorBruto`. Schema delta. Decisões B33.5 + B34 + B35 (4 commits).
- **Fase C.1** ✅ (03/05 noite mais tarde): UI plano + simulação tempo real. Helper `web/lib/simular-plano.ts` paridade backend (6/6 ✓). `<PlanoSimulacao>` + `<CombinacaoAtual>`. Campos condicionais por modelo. Layout 2 colunas em `/dashboard/planos/novo` (5 commits).
- **Fase C.1.1** ✅ (04/05 manhã, Code): 4 bugs UX corrigidos em /dashboard/planos/novo e /[id]. Helper ampliado pra 10 cenários ts-node verde (4 commits).
- **Validação manual Fase C.1.1** ✅ (04/05 tarde, claude.ai): 4 bugs validados manualmente por Luciano. Falso bug 0.87960 diagnosticado como confusão de premissa (plano testado tem descontoBase=18, não 15).
- **Housekeeping git** ✅ (04/05 manhã, claude.ai): 3 commits sem impacto funcional (PM2 .env, .gitignore configs locais + backups/, script setar-webhook-token-asaas idempotente).
- **Sprint 5 ponto 3 atualizado** ✅ (04/05 noite, claude.ai): UI v1 desabilita COM_ICMS/CUSTOM no `<select>` + `@IsIn(['KWH_CHEIO','SEM_TRIBUTO'])` em `CreatePlanoDto` e `UpdatePlanoDto` + nota datada na sessão Sprint 5 + débitos D-30U (P2) e D-30V (P3) catalogados (2 commits).
- **Sessão Code maratona 11/05** ✅ (9 commits, 4 fases técnicas + 4 documentais):
  - **UI etapa 11** (cooperado real CoopereBR destravado, MARCIO MACIEL — AGUARDANDO_CONCESSIONARIA → APROVADO via endpoint dedicado + DTO + service + spec + dialog, D-J-1 fechada). Commit `8853d97`.
  - **Fase C.2 reduzida** (5 itens UI plano avançada — promo defaults+validação, simulação 2 fases, vigência+Campanha, lista enriquecida, confirmação salvar; CooperToken expandido fora). Commit `6d2510e`.
  - **Fase C.3** (display economia projetada em 3 telas — proposta+contrato+cobrança via `<EconomiaProjetada>` reusable). Commit `ecf39cd`.
  - **D-30Y validado E2E** (2 propostas teste sintéticas, 2 screenshots de Luciano confirmando renderização dos 4 valores). Commit `fecbe2a`.
  - **Sprint 0 passos iniciais** (relatório auditoria concentração >25% — 62 contratos analisados, 0 casos detectados; achado meta **D-31** catalogado: `percentualUsina` zerado/irrealista no banco). Commit `851a39e`.
  - **Adendo §11 spec CooperToken** (5 achados validados via Decisão 21 + D-30Z catalogado: migração `opcaoToken` → `modoRemuneracao` incompleta com 85 cooperados). Commit `69902f6`.
  - **Débitos novos:** D-30W (P2 — aprovação admin automatizada pós Sprint 5+8), D-30X (P3 — whitelist LGPD bypass NODE_ENV), D-30Z (P3 — 85 cooperados intermediários), **D-31 (P1 provisório — `percentualUsina` zerado)**. D-30Y resolvido.

### O que falta — ordem prioritária

**Crítico estratégico (atualizado pós-sessão 11/05):**
1. **Investigação D-31** — `Contrato.percentualUsina` zerado/irrealista no banco (descoberto na auditoria Sprint 0). **Bloqueia Sprint 5 + canário** — sem dado confiável de concentração, flag `concentracaoMaxPorCooperadoUsina` da Sprint 5 vai operar sobre input furado. 2-4h Code dedicado.
2. **Sprint CooperToken Consolidado Etapa 1** — specs Jest do módulo `cooper-token/` (zero hoje). Pré-requisito P0 do refator. 6-8h Code, sessão dedicada.
3. **Asaas conta produção** (operacional, depende Luciano abrir) — primeira receita real CoopereBR em 1-2 semanas.
4. **Backfill 72 contratos legados** (only-if-needed) — pré-condição se canário escolher cooperado existente.
5. **Canário 1 cooperado real CoopereBR** — migra de FIXO pra COMPENSADOS. Pré-condição pra desativar `BLOQUEIO_MODELOS_NAO_FIXO`. Depende D-31 resolvido.
6. **Sprint 0 completo** — cron + dashboard `/dashboard/super-admin/auditoria-regulatoria`. Continuidade dos passos iniciais executados em 11/05.
7. **Sprint CooperToken Consolidado Etapa 2** — refator schema + 4 services + UI nova. 8-10h Code. Pré-requisito: Etapa 1 (specs Jest).

**Sequência sugerida:** Investigação D-31 → (paralelo) Sprint CT Etapa 1 + Asaas produção → backfill → canário → desativar flag → produção real → Sprint CT Etapa 2 → Sprint 0 completo.

**Pré-produção (10 sprints da pilha + 2 sub-sprints):**
- Sprints 0-9 da pilha pré-produção (17-23 semanas Code)
- Sprint 5a (Fio B) + Sprint 3a (RN 482) — sub-sprints regulatórios

**Pendências decisórias com Luciano (Fase 2 claude.ai):**
- 6 descobertas Grupo A (Modo Observador, Hardcode 0.20, FCFS+VPP, etc.)
- 6 decisões estratégicas (Sprint 0 quando começar, advogado regulatório, etc.)
- 16 decisões da curadoria de sprints

### O que NÃO entra na pilha

- Login facial (Sprint 24 antigo) — `sugestoes_pendentes.md`
- Diagramas C4 + ER — `sugestoes_pendentes.md` (reavaliar quando CoopereBR migrar)
- Token dedicado de convênio + landing personalizada — `sugestoes_pendentes.md` (aguarda Sprint 1)

### P1 atual: **0 itens críticos abertos**

(D-30M reclassificado P1→P2 em 02/05 após validação prévia.)

---



Este documento responde uma pergunta simples: **o que falta pro SISGD entrar em produção real, com parceiros pagando, sem o Luciano ter que torcer pra dar certo?**

A resposta NÃO é "implementar mais coisas". O SISGD já tem 80 models, 44 módulos backend, 152 telas. O código existe — falta **cola operacional**:

- Telas que Luciano usa pra acompanhar (governança).
- Automatismos que rodam sozinhos (FaturaSaas, lembretes, validações regulatórias).
- Engines de cálculo que cubram os 3 modelos (FIXO ✅ pronto, COMPENSADOS 🟡 bloqueado + falta snapshot tarifaContratual D-30R, DINAMICO 🔴 falta).
- Estrutura regulatória ANEEL (5 flags + classes GD + Fio B + auditoria).
- Camada de pré-produção real (Asaas em produção, validação local com distribuidoras).

A ordem dos sprints respeita a lógica:

1. **Sprint 0** — Auditoria Regulatória **emergencial** (resolve risco ativo do caso Exfishes antes de qualquer outra coisa).
2. **Sprints 1-4** — Destravar o que já existe + portal proprietário + documentos legais.
3. **Sprint 5** — Estruturar regulação ANEEL completa (5 flags + classes GD + Fio B + concentração).
4. **Sprint 6** — Auditoria IDOR geral (segurança multi-tenant antes de Sinergia migrar).
5. **Sprints 7-9** — Construir engines, política, fechamento financeiro, motor pré-venda.

A regra de ouro: **cada sprint entrega algo testável em isolamento**. Nenhum sprint deixa o sistema pior do que estava. **17-23 semanas de Code dedicado é estimativa, não promessa.**

---

## Seção 2 — Sprints concluídos (histórico curto)

> Detalhamento técnico em commits. Mantido aqui apenas como contexto.

| Sprint | Tema | Status | Commit |
|---|---|---|---|
| 6 (T10) | Cron mensal FaturaSaas automática | ✅ concluído | `fd35c0d` |
| 8 | Clube + CooperToken MVP | ✅ concluído | (vários) |
| 10 | LGPD + email SMTP + WhatsApp pós-reativação | ✅ concluído | (vários, abr/2026) |
| 11 | Arquitetura UC consolidada + pipeline OCR multi-campo | ✅ concluído | `7583659` + 5 commits Bloco 1 |
| 12 | Webhook Asaas validado em sandbox + 3 bugs corrigidos | ✅ concluído (sandbox) | `16302e9` |
| 13a | Painel SISGD + lista parceiros + cards saúde + IDOR fix em 6 endpoints | ✅ concluído | `7f29bd6` + `1569ca8` + outros |

**Sprint 13b (AuditLog ativo + Impersonate)** e **Sprint 13c (edição plano SaaS + suspensão de parceiro)** ainda **não iniciados** — foram **absorvidos** por sprints da nova pilha:
- AuditLog (interceptor + decorator + tela) → escopo do **Sprint 5** (cobertura regulatória precisa de audit) e **Sprint 6** (IDOR geral verifica audit).
- Impersonate → pode ser micro-sprint à parte ou parte do **Sprint 7** (governança financeira).

---

## Seção 3 — PILHA NOVA (10 sprints pré-produção plena)

> Pilha reorganizada na sessão claude.ai 30/04 baseada nas 13 decisões estruturantes (`docs/sessoes/2026-04-30-decisoes-doc-0-fatia2.md`).

Formato fixo pra cada sprint:
- **Tema** — linha curta.
- **Severidade** — P0/P1/P2.
- **Estimativa** — semanas de Code dedicado.
- **Pode rodar quando** — pré-requisito.
- **Bloqueia** — sprints futuros que dependem deste.
- **Escopo** — bullets executáveis.
- **Critério "passou"** — como saber que terminou.

---

### Sprint 0 — Auditoria Regulatória Emergencial

- **Severidade:** P0 (urgente — risco regulatório ATIVO em produção).
- **Estimativa:** 1 semana.
- **Pode rodar quando:** **AGORA** — paralelo a Doc-0 fechar.
- **Bloqueia:** Sprint 5 depende dos achados desta auditoria pra dimensionar escopo.

**Escopo:**
- Listar UCs ativas com classe GD declarada × classe GD real (cruzar `Uc.id → Contrato.usinaId → Usina.dataHomologacao`).
- Listar concentrações > 25% por cooperado-usina (ranking).
- Listar UCs com saldo > 2 meses (proxy: agregar `Cobranca.kwhCompensado` recente vs consumo médio).
- Listar UCs sem data de protocolo (campo `Usina.dataProtocoloDistribuidora` ainda inexistente — criar antes da auditoria).
- Auditoria do snapshot do Motor.aceitar (`tarifaContratual` vazia em contratos COMPENSADOS).
- Relatório executivo (1 PDF + 1 dashboard temporário em `/dashboard/super-admin/auditoria-regulatoria`).
- Plano corretivo caso a caso (Exfishes + FIGATTA + CRIAR + outros descobertos).

**Critério "passou":** Luciano lê o relatório, identifica em 5 minutos quais cooperados precisam de ação, e tem plano corretivo com prazo definido. Caso Exfishes regularizado.

**Dependências:** nenhuma. **Pode começar enquanto Doc-0 ainda está sendo escrito.**

---

### Sprint 1 — FaturaSaas Completo

- **Severidade:** P1 (bloqueia receita real do SaaS — Luciano não cobra parceiros automaticamente).
- **Estimativa:** 1-2 semanas.
- **Pode rodar quando:** independente — paralelo ao Sprint 0.
- **Bloqueia:** entrada do primeiro parceiro real que pague Luciano.

**Escopo:**
- Integração FaturaSaas → Asaas (boleto/PIX/QR Code automático separado de cobranças cooperado).
- Cron de comunicação D-7, D-3, D-1 + vencimento (email + WhatsApp pro parceiro).
- Endpoint `PATCH /saas/faturas/:id/pagar` (manual + automático via webhook Asaas dedicado).
- Decisão de produto: outros componentes do `PlanoSaas` (taxaSetup, taxaTokenPerc, etc.) viram itens da fatura ou são governança? Hoje o cálculo lê apenas `mensalidadeBase + percentualReceita`.
- Reconciliação automática quando webhook Asaas chega.

**Critério "passou":** parceiro recebe email/WA D-3 antes do vencimento, paga via PIX, sistema marca PAGA automaticamente, Luciano vê em painel SISGD.

**Dependências:** Asaas em produção (Luciano abre conta).

---

### Sprint 2 — OCR-Integração + Engine COMPENSADOS/DINAMICO (atômico)

- **Severidade:** P1 (sem isso, nenhum parceiro vai pra produção com modelo COMPENSADOS ou DINAMICO).
- **Estimativa:** 2-3 semanas.
- **Pode rodar quando:** após Sprint 0 (premissas regulatórias validadas).
- **Bloqueia:** parceiros que querem COMPENSADOS ou DINAMICO em produção.

**Escopo:**
- Implementar `CREDITOS_DINAMICO` (`NotImplementedException` atual em `faturas.service.ts:1882`) com fórmula revisada (normalização por consumo, não cobrar mais que valor sem desconto).
- Validar `CREDITOS_COMPENSADOS` com dados reais (ver D-30 derivado: `tarifaContratual` vazia em contratos com plano COMPENSADOS — bug do snapshot do Motor.aceitar).
- Detecção automática EDP via `kwhCompensado>0` na fatura aprovada → dispara `gerarCobrancaPosFatura` (já existe).
- Decisão de produto **resolvida**: pipeline OCR alimenta `Cobranca`, **não** o Motor de Proposta. Motor é só pro cadastro inicial.
- Destravar `BLOQUEIO_MODELOS_NAO_FIXO` quando QA passar.

**Critério "passou":** 5 cooperados de teste com plano COMPENSADOS recebem cobrança real calculada da fatura EDP do mês. Discrepância vs valor sem cooperativa < 1%. Diagnóstico de fatura real (commit `5ae9dfd`) é o ponto de partida da validação.

**Dependências:** Sprint 0 (cooperados regularizados antes de cobrar pelo modelo COMPENSADOS).

---

### Sprint 3 — Banco de Documentos (Assinafy)

- **Severidade:** P1 (resolve débitos D-30H + D-30I + D-30J — risco regulatório ativo).
- **Estimativa:** 1-2 semanas.
- **Pode rodar quando:** independente.
- **Bloqueia:** entrada de parceiro real que exija conformidade jurídica.

**Escopo:**
- Integração Assinafy (provedor de assinatura digital com validade jurídica).
- 5 templates iniciais SISGD: Proposta + Termo de Adesão + Termo de Responsabilidade + Procuração ANEEL + Contrato.
- Biblioteca de documentos por parceiro (parceiro customiza templates).
- Agrupamento de docs em 1 assinatura (uma única jornada de assinatura cobrindo múltiplos documentos).
- **Atualizar termo + bot** pra remover RN 482/2012 (D-30H, D-30I) e citar Lei 14.300/2022 + RN 1.000/2021.
- Adicionar cláusula de alocação dinâmica no Termo (D-30J).
- Schema: novos tipos `TERMO_ADESAO`, `TERMO_RESPONSABILIDADE`, `PROCURACAO_ANEEL` em `ModeloDocumento` (P0-03 do débito atual).

**Critério "passou":** novo cooperado se cadastra, assina os 5 documentos numa única jornada, recebe PDFs assinados por email com validade jurídica via Assinafy.

**Dependências:** validação jurídica das cláusulas com advogado especializado em ANEEL (recomendado).

---

### Sprint 4 — Portal Proprietário

- **Severidade:** P1 (Solares e outros proprietários dependem).
- **Estimativa:** 1-2 semanas.
- **Pode rodar quando:** após Sprint 1 (FaturaSaas) ou paralelo.
- **Bloqueia:** entrada de proprietários institucionais (Solares).

**Escopo:**
- ContratoUso 3 modalidades (`valorFixoMensal` + `valorPorUnidade` + `percentualRepasse` × tarifa SCEE sem ICMS).
- Cron mensal de geração de lançamento (`gerarLancamentoMensal` hoje só roda no `create()` do contrato).
- UI no `/proprietario` mostrando cálculo discriminado das 3 parcelas.
- Remover hardcode `R$ 0,50/kWh` em `usinas.service.ts:503,525`.
- Notificação de repasse via WhatsApp/email.

**Critério "passou":** proprietário Solares vê dashboard com receita do mês decomposta em 3 parcelas, recebe email no D+5 confirmando lançamento, Luciano consegue acompanhar repasses no painel SISGD.

**Dependências:** ContratoUso real cadastrado (hoje 0 registros).

---

### Sprint 5 — Módulo Regulatório ANEEL (estruturante)

- **Severidade:** P0 estruturante (resolve sintomas detectados em Sprint 0).
- **Estimativa:** 3-4 semanas.
- **Pode rodar quando:** após Sprint 0 (insumo de auditoria).
- **Bloqueia:** Sprint 8 (Política + Engine de Otimização).

**Escopo:**
- **Schema novo:**
  - `Usina.classeGd` (enum GD_I/GD_II/GD_III).
  - `Usina.dataProtocoloDistribuidora` (DateTime).
  - `Uc.dataProtocoloDistribuidora` (DateTime).
  - `RegrasFioB` (model dedicado: `ano: Int`, `classeGd: ClasseGd`, `percentualFioB: Decimal`).
  - `ConfigRegulatoriaParceiro` (1:1 com `Cooperativa`) com 5 flags.
- **5 flags configuráveis** (cada parceiro):
  - `multipleUsinasPerUc` (default false)
  - `multipleClassesGdPerUc` (default false)
  - `concentracaoMaxPorCooperadoUsina` (default 25)
  - `misturaClassesMesmaUsina` (default false)
  - `transferenciaSaldoEntreUcs` (default false — saldo intransferível)
- **Audit trail obrigatório** — mudança de flag gera `AuditLog`.
- **Schema N:M Contrato↔Usina** (controlado por flag `multipleUsinasPerUc`):
  - Modelo de junção `UcUsinaRateio` (`ucId` + `usinaId` + `percentualRateio`, soma=100% por UC).
- **Cálculo mix de origens** (Fio B ponderado quando UC tem múltiplas usinas).
- **Validações no Motor.aceitar() + alocarListaEspera + gerarCobrancaPosFatura** consultam as flags.
- **UI de configuração** `/parceiro/configuracoes/regulatorio` (toggle de cada flag + campo numérico do `concentracaoMax`).
- **Cron diário** de auditoria de concentração (D-30F).
- **Seed inicial de RegrasFioB** com tabela 2022-2029 (compatível com decisão claude.ai 30/04).

**Critério "passou":** parceiro abre `/parceiro/configuracoes/regulatorio`, ativa flag `multipleUsinasPerUc=true` (gera audit log), cadastra contrato com 2 usinas, soma de rateio é forçada a 100%, cobrança mensal calcula Fio B ponderado por classe GD.

**Dependências:** Sprint 0 (achados de auditoria orientam migração de UCs existentes).

---

### Sprint 6 — Auditoria IDOR Geral

- **Severidade:** P2 (segurança multi-tenant antes de Sinergia migrar).
- **Estimativa:** 1 semana.
- **Pode rodar quando:** independente.
- **Bloqueia:** onboarding Sinergia.

**Escopo:**
- Replicar helper `assertSameTenantOrSuperAdmin` em todos os módulos backend que recebem `cooperativaId` via parâmetro:
  - `cooperados`, `contratos`, `cobrancas`, `usinas`, `ucs`, `faturas`, `convenios`, `clube-vantagens`, `cooper-token`, `indicacoes`, `motor-proposta`, etc.
- Auditoria de cada endpoint que aceita `:id` ou query `cooperativaId` (lista atual: ~50 endpoints suspeitos).
- Specs Jest cobrindo cenários de cross-tenant access (ADMIN da Cooperativa A tentando acessar dados da Cooperativa B → 403).
- Atualização do `CLAUDE.md` raiz com regra: **audit de segurança como etapa padrão** quando entrega tela ou endpoint que receba `cooperativaId` via parâmetro.

**Critério "passou":** suite de specs IDOR rodando verde em CI (16+ cenários cobrindo todos os módulos), zero regressões.

**Dependências:** Sprint 13a já entregou 6 endpoints — restantes seguem o mesmo padrão.

---

### Sprint 7 — DRE + Conciliação + Fechamento Mensal

- **Severidade:** P2 (governança financeira antes de Walter, contador externo).
- **Estimativa:** 2-3 semanas.
- **Pode rodar quando:** independente.
- **Bloqueia:** auditoria contábil oficial.

**Escopo:**
- Endpoint `GET /financeiro/dre` consolidado (Demonstrativo de Resultado do Exercício).
- Conciliação BB/Sicoob (extrato bancário vs `LancamentoCaixa`):
  - Webhook ou polling do banco.
  - Match automático por valor + data + descrição.
  - Conciliação manual de não-matches.
- Fechamento mensal:
  - Endpoint `POST /financeiro/fechamento/:ano-:mes` (bloqueia lançamentos retroativos).
  - Reabertura controlada por SUPER_ADMIN com audit log.
- Tela `/dashboard/financeiro/dre` + `/dashboard/financeiro/conciliacao` + `/dashboard/financeiro/fechamento`.

**Critério "passou":** Walter (contador externo) gera DRE de abr/2026, concilia 100% das transações BB, fecha o mês com 1 clique. Reabertura exige aprovação SUPER_ADMIN.

**Dependências:** nenhuma técnica. **Asaas em produção** ajuda mas não bloqueia.

---

### Sprint 8 — Política de Alocação + Engine de Otimização

- **Severidade:** P1 (resolve causa raiz do caso Exfishes).
- **Estimativa:** 2-3 semanas.
- **Pode rodar quando:** após Sprint 5 (estrutura regulatória).
- **Bloqueia:** Sprint 9 (Motor de Diagnóstico depende de Engine pra projetar economia).

**Escopo:**
- **Modelo `PoliticaAlocacao`** — faixas configuráveis por parceiro:
  - `parceiroId` + `faixaMin` + `faixaMax` (consumo kWh) + `classeGdPreferida` + `usinasElegiveis[]`.
- **Política padrão SISGD** seedada (pequenos→GD II, médios→GD I/II, grandes→GD I) + customização por parceiro.
- **Modelo `AlocacaoOtima`** — snapshot do estado calculado com timestamp.
- **Algoritmo de otimização** (programação linear ou heurística greedy + busca local):
  - Minimiza custo total respeitando: concentração ≤ flag, política de alocação, capacidade da usina, compatibilidade ANEEL, **estabilidade mínima** (cooperado alocado < 3 meses não migra).
  - Suporta **Split** (uma UC dividida entre múltiplas usinas, controlado por `multipleUsinasPerUc`).
- **Modos:**
  - **Sugestão (default)** — engine sugere realocações; admin aprova caso a caso.
  - **Automático com guard-rails** — engine executa realocações pequenas (até X% por mês); grandes precisam aprovação. **Default OFF.**
- **Recálculo** periódico (mensal) + sob demanda (trigger admin).
- **Painel `/parceiro/alocacao`** com sugestões + simulação prévia obrigatória.

**Critério "passou":** admin abre painel de alocação, vê 5 sugestões da engine (cada uma com simulação "antes/depois"), aprova 3 que reduzem custo total em 8% sem violar nenhuma regra. Caso Exfishes não acontece mais (engine bloqueia mudança de classe sem alerta).

**Dependências:** Sprint 5 (estrutura regulatória pronta).

---

### Sprint 9 — Motor de Diagnóstico Pré-Venda

- **Severidade:** P1 estratégico (gancho de vendas concreto).
- **Estimativa:** 3-4 semanas.
- **Pode rodar quando:** após Sprints 5 + 8.
- **Bloqueia:** —

**Escopo:**
- **Funil público** `/diagnostico` (rota nova).
- **Pipeline ingestão** (reutiliza `faturas.service.ts:extrairOcr` — pipeline OCR já validado).
- **Motor de análise** (regras + LLM híbrido — Claude AI):
  - Detecta classe GD da fatura.
  - Calcula economia projetada com plano FIXO/COMPENSADOS/DINAMICO.
  - Sugere usina compatível.
  - Projeta 2026-2029 (Fio B progressivo).
- **Versão Express grátis** (análise resumida em <30s, captcha + rate limit).
- **Versão Completo paga** (relatório aprofundado, sugestão R$ 199-499 — validar com mercado).
- **Anti-abuso:** captcha + rate limit (X requests/IP/dia) + cookie de sessão.
- **Renomear `/faturas/diagnostico` → `/faturas/healthcheck`** (D-30K).

**Critério "passou":** lead acessa `/diagnostico`, sobe fatura PDF, recebe em 30s relatório Express com economia projetada. Se quiser detalhe, paga R$ X e recebe relatório Completo. Conversão Express→Completo > 5%.

**Dependências:** Sprints 5 + 8.

---

## Seção 3b — Sub-sprints especializados (Decisão 18 — definição mínima)

Sprints 3 e 5 da pilha são abrangentes. A **Decisão 18** (sessão 01/05) exige
definição mínima por sprint: tema, persona, critério, estimativa, dependências.
Esta seção detalha 2 sub-sprints regulatórios críticos que se encaixam dentro
desses pais e já têm spec/análise pronta.

---

### Sprint 5a — Fio B (Implementação completa)

**Pai:** Sprint 5 (Módulo Regulatório ANEEL).

- **Tema:** Implementar cobrança progressiva de Fio B conforme Lei 14.300/2022 (60% em 2026, 75% 2027, 90% 2028, 100% 2029+) por classe GD.
- **Persona/caso de uso:** Cooperado em usina GD II ou GD III. Em 2026, Fio B cobrado a 60%. Sem implementação, sistema cobra valor errado e cooperado paga ~21% mais que devido (ou cooperativa absorve prejuízo). Caso A (Apêndice C de PRODUTO.md) ilustra impacto da mudança de classe.
- **Critério de pronto:**
  - Schema `Cobranca.fioB` populado em todas cobranças geradas pós-fix
  - Fórmula aplica progressão correta por ano e classe GD
  - UI mostra Fio B como linha separada na fatura
  - Spec do OpenClaw 188 linhas portada integralmente (com adaptação à taxonomia GD I/II/III decidida em 30/04)
  - Specs Jest cobrindo cenários 2026/2027/2028/2029
  - Validação E2E: 1 cooperado teste GD II com cobrança gerada e Fio B correto
- **Estimativa:** 3-5 dias Code.
- **Dependências:**
  - Sprint 0 (Auditoria Regulatória) confirmar interpretação correta
  - Schema `Usina.classeGd` + `RegrasFioB` (parte do Sprint 5)
  - Validação jurídica (advogado regulatório ANEEL)
- **Risco:** alto regulatório se não implementado antes de Caminho B (produção real). Cooperativa pode ser autuada por cobrança incorreta.
- **Origem:** spec em `docs/specs/PROPOSTA-GD1-GD2-FIOB-2026-03-26.md` (188 linhas, 26/03/2026, autor OpenClaw — assistente IA usado em iteração anterior). Marcada como "spec existe mas nunca implementada" desde 30/04 (D-30L).

---

### Sprint 3a — Atualizar referências regulatórias (RN 482/2012 → Lei 14.300/2022)

**Pai:** Sprint 3 (Banco de Documentos / Assinafy).

- **Tema:** Substituir todas referências à RN 482/2012 (revogada) pela Lei 14.300/2022 (vigente desde 07/01/2023) em termo de adesão, mensagens do bot e documentação pública.
- **Persona/caso de uso:** qualquer parceiro do SISGD em operação (CoopereBR, Sinergia). Termo de adesão atual cita regulamentação revogada — risco jurídico ativo. Bot WhatsApp educa cooperados com referência errada.
- **Critério de pronto:**
  - Termo de adesão revisado por advogado regulatório
  - Todas mensagens do bot atualizadas (verificar `whatsapp-*.service.ts`)
  - PRODUTO.md + REGULATORIO-ANEEL.md atualizados (parcialmente feito 02/05)
  - Specs Jest verificam que "RN 482" não aparece em strings de produção
  - Validação manual: gerar termo + revisão visual
- **Estimativa:** 1-2 dias Code + revisão jurídica externa (1 semana calendário).
- **Dependências:**
  - Decisão Luciano sobre advogado regulatório (pendência ativa em CONTROLE-EXECUCAO)
  - Sprint 0 (Auditoria Regulatória) idealmente roda primeiro
- **Risco:** alto jurídico. Cooperado pode contestar contrato baseado em regulamentação revogada.
- **Origem:** descoberta em sessão claude.ai 30/04 — "Termo de adesão e bot citam RN 482/2012 (defasada desde Lei 14.300/2022) — risco regulatório ativo".

---

## Seção 4 — Ordem sugerida de execução

```
[paralelo, podem começar AGORA]
  Sprint 0 (Auditoria Reg.) ──┐
  Sprint 1 (FaturaSaas)    ──┤
                              │
[após Sprint 0 + 1]           │
  Sprint 2 (OCR + DINAMICO)←──┤
  Sprint 5 (Mod. Regulatório)←┤
  Sprint 6 (IDOR Geral)    ──┤
  Sprint 3 (Assinafy)      ──┤  (pode rodar paralelo)
  Sprint 4 (Portal Proprietário) ──┤
                              │
[após Sprint 5]               │
  Sprint 8 (Política+Engine)←─┤
                              │
[após Sprints 5 + 8]          │
  Sprint 9 (Diagnóstico)   ←──┤
                              │
[após todos os anteriores]    │
  Sprint 7 (DRE+Conciliação)←─┘
```

**Total estimado:** 17-23 semanas de Code dedicado.

**Marcos críticos:**
- Sprint 0 + Sprint 5 + Sprint 6 = **base regulatória + segurança** completa (8-9 semanas).
- Sprints 1 + 2 + 3 + 4 = **destrava produção real** (5-9 semanas).
- Sprints 8 + 9 = **diferencial de produto** (5-7 semanas).
- Sprint 7 = **governança financeira** (2-3 semanas).

---

## Seção 5 — Decisões pendentes (aguardando Luciano)

- [ ] **Quando começar Sprint 0** (Auditoria Regulatória Emergencial) — pode começar imediatamente.
- [ ] **Quando começar Sprint 1** (FaturaSaas) — pode rodar em paralelo.
- [ ] **Modo Sugestão sempre vs Modo Automático com guard-rails** (Engine de Otimização Sprint 8) — decisão de produto.
- [ ] **Cobrança do diagnóstico pré-venda Completo** (Sprint 9) — Express grátis + Completo R$ 199-499 (sugestão claude.ai 30/04 — validar com mercado).
- [ ] **Consultoria regulatória** — advogado especializado em ANEEL pra validar premissas (limite 25%, mix de classes, transferência de saldo, etc.).
- [ ] **Asaas em produção** (Luciano abre conta) — pré-requisito Sprint 1.

---

## Seção 6 — Critérios pra ligar produção real

CoopereBR + Sinergia migrando do sistema antigo:

- [x] Sprint 13a concluído (Painel SISGD + lista parceiros + IDOR fix em 6 endpoints).
- [x] **Doc-0 Fatia 2 concluída** (PRODUTO + REGULATORIO + CONTROLE-EXECUCAO — 30/04 noite).
- [x] **D-30O resolvido** (mesReferencia OCR — 02/05 manhã, commit `7ea6943`).
- [x] **7 ajustes factuais Doc-0 aplicados** (Grupo B completo — 02/05 manhã).
- [x] **Sprints 5a (Fio B) + 3a (RN 482) catalogados** com Decisão 18 (definição mínima).
- [ ] Doc-0 Fatias 3-5 concluídas (SISTEMA.md + CLAUDE.md refator + movimentação final).
- [ ] **D-30R fix** — Motor.aceitar() popular `Contrato.tarifaContratual` + script backfill (afeta 100% dos 72 contratos). 30-45 min Code.
- [ ] **D-30N implementação completa** — `AuditLogInterceptor` + `@Auditavel` + módulo (absorvido por Sprint 5/6).
- [ ] Sprint 0 concluído (auditoria regulatória regularizou casos Exfishes/FIGATTA/CRIAR).
- [ ] Sprint 1 concluído (FaturaSaas cobrando parceiros automaticamente).
- [ ] Sprint 2 concluído (DINAMICO + COMPENSADOS validados — depende de D-30R fix antes).
- [ ] Sprint 3 + 3a concluídos (Assinafy + termo Lei 14.300).
- [ ] Sprint 5 + 5a concluídos (Módulo Regulatório ANEEL com 5 flags + Fio B implementado).
- [ ] Sprint 6 concluído (Auditoria IDOR geral).
- [ ] Conta Asaas produção configurada (Luciano abre).
- [ ] Cron FaturaSaas validado em produção real (1 parceiro paga 1 ciclo completo).

---

*Plano vivo. Atualizar conforme sprints fecham ou novas descobertas exigem reorganização.*
