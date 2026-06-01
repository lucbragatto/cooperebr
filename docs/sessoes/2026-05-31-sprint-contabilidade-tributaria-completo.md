# Sprint Contabilidade Tributária + Catalogação Sprint Polimento UX — 31/05/2026

## TL;DR

Sessão entregou a **estrutura completa do Sprint Contabilidade Tributária** (CT.1→CT.6 em 6 commits) — schema segregado por natureza cooperativa (Lei 5.764/71 Arts. 79/86/88), regimes pluggáveis (COOPERATIVO impl + 3 stubs NotImplementedException P0-1), classificação determinística por fonte upstream, hooks fire-and-forget que criam `LancamentoCaixa` já classificado, motor de apuração mensal com `ApuracaoMensalSegregada` imutável após fechamento (gate de validação fiscal), `ConfiguracaoTributaria` por cooperativa (zero hardcoded — Luciano + orquestrador ajustam alíquotas/presunção), DREs em 4 visões com terminologia NBC ITG 2004 (ingressos/dispêndios no ato próprio), 3 PDFs defensáveis com watermark "PENDENTE VALIDAÇÃO FISCAL" e 4 telas Next.js admin completas. Após smoke do Luciano em `/dashboard/repasses`, 2 gaps reais foram identificados (sem estorno + sem visibilidade do ciclo contábil) e backend foi implementado (commit 93f38da: `PUT /repasses/:id/estornar` atômico + `GET /repasses/:id/ciclo`), porém o frontend usou Dialog Tipo C — **padrão antigo**. Luciano definiu novo padrão UX vigente (Dialog/drawer **proibidos**; criar/editar = página própria; ações = inline expansível) e catalogou **Sprint Polimento UX** com 6 fatias (PUX.1-PUX.6) cobrindo componentes reutilizáveis (HelpBox + AcaoInlineExpansivel), banimento de telinhas, help inline em todas as telas, refator do estorno repasse (PUX.4 — frontend inline em vez de Dialog), refator das telas existentes que usam Dialog/drawer (PUX.5) e lint UX (PUX.6). 7 commits, 8 schemas alterados, ~3.000 LOC, **284 specs verdes** (89 novos, 195 anteriores preservados), zero regressão, zero `--accept-data-loss`.

## Marco entregue

**Sprint Contabilidade Tributária Segregada 6/6 ESTRUTURA COMPLETA + Sprint Polimento UX catalogado**

Estrutura técnica 100% pronta. Aguarda:
- **Gate validação interna (Luciano + orquestrador):** validar alíquotas/presunção + classificação repasse + 10 contas seed + 10 lançamentos flag + flag `isencaoPisCofinsAtiva` (STF Tema 536) antes de uso fiscal real.
- **Gate advogado:** acompanhar STF Tema 536 (julgamento mai/jun 2026 — pode reverter isenção PIS/COFINS).
- **Sprint Polimento UX:** próximo Code, 6 fatias PUX.1→PUX.6.

## Commits do dia (7)

| Hash | Mensagem |
|---|---|
| `5ada766` | feat(contabilidade): CT.1 — schema base multi-regime + migracao enum + seed plano contas |
| `f95bbef` | feat(contabilidade): CT.2 — interface RegimeContabil + classificacao automatica + Convenio CRUD |
| `b3cba3c` | feat(contabilidade): CT.3 — hooks automaticos de lancamento classificado |
| `27df9e5` | feat(contabilidade): CT.4 — motor apuracao mensal segregada (numeros pendentes validacao Luciano + orquestrador) |
| `95eb755` | feat(contabilidade): CT.5 — DREs segregadas 4 visoes |
| `6a2324e` | feat(contabilidade): CT.6 — relatorios PDF + UI (Sprint CT estrutura completa) |
| `93f38da` | feat(repasses): estorno do ciclo completo + visibilidade contabil |

## Entregas técnicas

### Schema (Prisma — 8 alterações, todas aditivas, zero `--accept-data-loss`)

**CT.1:**
- `Cooperativa.regimeContabil` (enum `TipoRegimeContabil` default `COOPERATIVO`)
- `Cooperativa.isencaoPisCofinsAtiva` (Boolean default true — P0-4 STF Tema 536)
- 6 enums novos: `TipoRegimeContabil`, `NaturezaCooperativa`, `NaturezaContabil`, `StatusApuracao`, `TipoBeneficioConvenio`, `FluxoConvenio`
- 2 models novos: `Convenio` (Art. 88), `ApuracaoMensalSegregada` (snapshot imutável)
- `PlanoContas + naturezaContabil + naturezaCooperativa + fundamentoLegal` (nullable, preserva 24 contas seed legadas)

**CT.3:**
- `enum OrigemLancamento { COBRANCA CONTA_PAGAR REPASSE MANUAL }`
- `LancamentoCaixa + origemTipo + origemId + @@unique([origemTipo, origemId])` — idempotência forte
- Migration manual SQL (`scripts/ct3-migration.ts`) preservou 58 lançamentos legados sem `--accept-data-loss`

**CT.4:**
- `ApuracaoMensalSegregada + validadoContador + validadoPorUsuarioId + validadoEm + observacaoContador + reabertoEm + reabertoPorUsuarioId + motivoReabertura`
- `ConfiguracaoTributaria` (1:1 Cooperativa) — 10 campos default Lucro Presumido + flag `validadoContador` própria

**Estorno (93f38da):**
- `RepasseProprietario + estornadoEm + estornadoPorUsuarioId + motivoEstorno`

### Backend (NestJS — módulo novo `contabilidade-tributaria/` + extensão `repasses-proprietario/`)

**Módulo contabilidade-tributaria:**
- `regimes/regime-contabil.interface.ts` + `regime.factory.ts` (resolve TipoRegimeContabil → impl)
- `regimes/cooperativo.regime.ts` (Lei 5.764/71 — classificação determinística com tabela aprovada)
- `regimes/{consorcio,associacao,condominio}.regime.stub.ts` (NotImplementedException explícito — P0-1)
- `contabilidade-tributaria.service.ts` — `classificarLancamento` + `criarLancamentoAutomatico` (P2002 idempotente + runAsPlatform) + `criarLancamentoRepasse`
- `convenios-ct.service.ts` + `convenios-ct.controller.ts` — CRUD Convenio multi-tenant
- `apuracao.service.ts` — `apurarMes` (preview) + `fecharApuracao` (snapshot imutável + race guard P2002) + `validarApuracao` (Luciano + orquestrador) + `reabrirApuracao` (SA-only motivo ≥10 chars) + `garantirMesAberto` (bloqueio retroativo CT.3)
- `apuracao.controller.ts` — 4 endpoints (preview, fechar, validar, reabrir)
- `dre.service.ts` — `montarDre` 4 visões (geral/proprio/auxiliar/nao-coop) com terminologia NBC ITG 2004
- `dre.controller.ts` — GET `/dre/:visao`
- `relatorios-ct.service.ts` — 3 PDFs via `PdfGeneratorService` (puppeteer HTML→PDF reusado de motor-proposta)
- `relatorios-ct.controller.ts` — GET `/relatorios/:tipo` (stream PDF inline)

**Hooks CT.3 wirados (fire-and-forget) em 3 services upstream:**
- `cobrancas.service.ts.darBaixa` — COM_UC/SEM_UC/GERADOR→PROPRIO; USUARIO_CARREGADOR/CARREGADOR_VEICULAR→NAO_COOPERATIVO
- `contas-pagar.service.ts.update` (quando status=PAGO) — PROPRIO
- `repasses-proprietario.service.ts.marcarPago` — Usina.formaAquisicao ALUGUEL→NAO_COOPERATIVO; CESSAO/PROPRIA→PROPRIO

**Extensão Estorno em `repasses-proprietario.service.ts`:**
- `estornarRepasse` — transação atômica:
  1. update RepasseProprietario → PENDENTE + limpa pagamento + grava estorno
  2. `deleteMany LancamentoCaixa origemTipo=REPASSE origemId=:id` (libera `@@unique` pra repagar)
  3. `updateMany ContaAPagar repasseAbatidoId=:id → null + statusResolucao=PENDENTE + resolvidoEm=null`
- Gate contábil: `ApuracaoMensalSegregada` do mês de `dataPagamento` FECHADA → ConflictException ("Apuração de MM/AAAA fechada. Reabra primeiro (Super Admin)")
- `obterCicloRepasse` — retorna `{ repasse, lancamentoGerado, despesasAbatidas[] }`
- Endpoints: `PUT /repasses/:id/estornar` + `GET /repasses/:id/ciclo` (ADMIN/SA + @TenantResource + @AuditLog + DTO `EstornarRepasseDto` motivo ≥10 chars)

### Frontend (Next.js — 4 telas novas + 2 dialogs estorno)

**Telas /dashboard/contabilidade/:**
- `apuracao/page.tsx` — preview + KPIs + tabela receitas-despesas + cards tributos + cards fundos + Dialog Tipo C "Fechar Apuração" + badge GATE VALIDAÇÃO FISCAL
- `dre/page.tsx` — TabsCustom M34 (4 abas Promise.all) + DreCard com linhas semânticas (header/subtotal/tributo/fundo/sobra) + botão PDF
- `plano-contas/page.tsx` — read-only com badges coloridas (PROPRIO/AUXILIAR/NAO_COOPERATIVO) + 3 KPIs (total/segregadas/pendentes)
- `convenios/page.tsx` — CRUD Convenio CT.2 com Select NATIVO dentro Dialog (regra 19/05) + Dialog Tipo C remover

**Sidebar:** nova seção **Contabilidade Tributária** (ícone Scale) entre Financeiro e Relatórios.

**Dialogs estorno (`components/repasses/`) — implementados com padrão Dialog Tipo C, virarão refator PUX.4 + PUX.5:**
- `DialogEstornar.tsx` — textarea motivo ≥10 chars + aviso "apuração fechada"
- `DialogCiclo.tsx` — lançamento gerado (badge natureza + valor + competência) + tabela despesas abatidas
- Botões "Ciclo" + "Estornar" em `/dashboard/repasses` e `/dashboard/usinas/[id]/repasses` (status PAGO)

### Integração ponta a ponta (cadeia verificada)

```
RepasseProprietario (PAGO)
    │
    ├── (1) hook CT.3 fire-and-forget
    │       └── LancamentoCaixa.create({ origemTipo=REPASSE, origemId, naturezaAto })
    │
    ├── (2) transação atômica marcarPago
    │       └── ContaAPagar.updateMany (despesas DESCONTO_NO_REPASSE → repasseAbatidoId + statusResolucao=RESOLVIDA)
    │
    └── ESTORNO (commit 93f38da)
        │
        ├── LancamentoCaixa.deleteMany (libera @@unique)
        ├── ContaAPagar.updateMany (repasseAbatidoId=null + statusResolucao=PENDENTE)
        └── RepasseProprietario → PENDENTE (idempotente: repagar recria lançamento)
                ↓
        Gate ApuracaoMensalSegregada (mes dataPagamento === FECHADA) → bloqueia
                ↓
        DRE/Apuração leem LancamentoCaixa agregado (snapshot ou preview)
```

### Testes (89 specs novos — 195→284)

| Suíte | Specs | Foco |
|---|---|---|
| `convenios-ct.service.spec.ts` | ~6 | CRUD multi-tenant defesa em profundidade |
| `regimes/cooperativo.regime.spec.ts` | ~10 | Classificação determinística por fonte |
| `regimes/regime.factory.spec.ts` | ~4 | Factory resolve + stubs |
| `contabilidade-tributaria.service.spec.ts` | ~10 | classificarLancamento + idempotência |
| `apuracao.service.spec.ts` | **30** | Preview agregação + isenção P0-4 + IRPJ adicional + fundos + snapshot imutável + validar + reabrir + bloqueio retroativo + 3 regimes stub |
| `dre.service.spec.ts` | **26** | 4 visões + snapshot vs preview + GATE VALIDAÇÃO FISCAL + terminologia NBC ITG 2004 |
| `relatorios-ct.service.spec.ts` | **17** | 3 tipos + watermark/header + snapshot vs preview + agrupamento repasses + 4 leis citadas |
| `repasses-proprietario-estorno.spec.ts` | **16** | Estorno happy path + 5 erros + cross-tenant + gate FECHADA + idempotência + obterCiclo |
| **TOTAL** | **+89** | **284 totais (195 anteriores ✅ zero regressão)** |

### Smoke runtime

- `smoke-ct3.ts` 10/10 OK pré-CT.4 e novamente pós-CT.6 (zero regressão hooks)
- `npm run lint:tenant`: 0 handlers novos sem decorator nos 7 commits

## Bugs resolvidos / catalogados

| # | Severidade | Origem | Status |
|---|---|---|---|
| Estorno-Gap-1 | **P1** | Smoke Luciano pós-CT.6 | **CÓDIGO RESOLVIDO** (93f38da) — backend pronto; frontend Dialog vira refator PUX.4 |
| Estorno-Gap-2 | **P2** | Mesmo smoke ("não vi pra onde foi o dinheiro") | **CÓDIGO RESOLVIDO** — DialogCiclo; frontend vira refator PUX.4 |
| Premissa-UX-Violada | **P1** | QA Luciano 31/05 | **CATALOGADO** — Sprint Polimento UX (PUX.1-PUX.6). 4 telas CT.6 usam Dialog/drawer + zero help em algumas telas existentes |
| D-novo-BR-CT-ESTORNO | **P2** | Análise pós-Gap-1 | **CATALOGADO** — estorno Cobranca/ContaAPagar (mesmo padrão de RepasseProprietario, ~4-6h, fatia futura) |
| CT.4-build TS1272 | Trivial | `import type Response` esquecido | RESOLVIDO inline |
| CT.5-build TS1272 | Trivial | `import type VisaoDre` em decorator | RESOLVIDO inline |
| CT.6-build query repasses | Trivial | Schema usa `periodoInicio/Fim`, não `competencia` String | RESOLVIDO (query refeita) |
| CT.6-build categoria enum | Trivial | `categoria` enum vs `string \| null` | RESOLVIDO (`String(d.categoria)` cast) |
| Estorno-build dataOcorrencia | Trivial | `dataOcorrencia: Date` vs `Date \| null` Prisma | RESOLVIDO |
| Schema discovery CT.1→CT.3 | Catalogado | CT.1 normalizou valores mas não ALTER TYPE | Documentado no schema — promoção formal pra enum deferida pra migration SQL com USING cast |

## Decisões catalogadas / aplicadas

**Pré-existentes (todas usadas):**
- `decisao_modulo_contabilidade_tributaria_17_05.md`
- `regra_validacao_previa_e_retomada.md` (Decisões 14+15+20+23)
- `regra_fechamento_sessao_inegociavel.md` (13/05)
- `regra_contato_teste_impreterivel.md` (14/05)
- `feedback_fase1_readonly_obrigatoria.md` (13/05)
- `regra_nao_trabalhar_paralelo_com_code_17_05.md`
- `padrao_ux_edicao_inline_vs_pagina_propria_17_05.md` (parcialmente — Dialog Tipo C ainda usado, banido em 31/05)
- `solucao_select_nativo_dentro_dialog_19_05.md`
- `regra_help_automatico_paginas_19_05.md` (parcialmente violada — Sprint Polimento UX corrige)

**Princípios desta sessão (merecem destaque):**

1. **Gate de validação fiscal** — todo snapshot nasce `validadoContador=false`. Luciano + orquestrador é quem valida antes de virar valor fiscal real. Zero hardcoded — alíquotas/presunção em `ConfiguracaoTributaria` ajustáveis por cooperativa.
2. **P0-1 Não-implementação explícita** — regimes não-coop lançam `NotImplementedException` em vez de cair silenciosamente pro cooperativo (evita aproveitamento indevido).
3. **P0-4 Flag isenção configurável** — STF Tema 536 está em julgamento mai/jun 2026. `isencaoPisCofinsAtiva` per-cooperativa permite reverter sem migration.
4. **Idempotência via `@@unique`** — `LancamentoCaixa(origemTipo, origemId)` + try/catch P2002 retornando lançamento existente.
5. **Fire-and-forget contábil** — hooks CT.3 NUNCA revertem pagamento original. Falha contábil só loga.
6. **runAsPlatform interno** — hooks rodam em `runAsPlatform` pra extension F1.3 (TENANT-LEAK detector) não logar falsos positivos.

**Decisão UX vigente 31/05 (nova):**

| Cenário | Padrão CORRETO |
|---|---|
| Criar/editar entidade | **Página própria** (`/dashboard/X/[id]/editar`) |
| Ação contextual (fechar, estornar, aprovar) | **Inline expansível** (linha expande revelando formulário/confirmação) |
| Visualização de dados auxiliares (ciclo, histórico) | **Inline expansível** ou seção da página própria |
| Edição célula-a-célula (relação Membro×Usina) | **Inline célula** (hover lápis, Enter/blur salva) |

**Banido:**
- Dialog modal
- Sheet/drawer

Razão: Luciano não programa, precisa fluir naturalmente na página sem janelinhas obstruindo. O foco perdido + a quebra de contexto + a impossibilidade de comparar dados lado-a-lado pesam mais que a "limpeza visual" da modal.

Detalhamento em `docs/arquitetura/padrao-ux-vigente.md` (criado nesta sessão).

## Próximo passo

**Sprint Polimento UX — começar por PUX.1 (componentes reutilizáveis)**

Ordem das fatias:
1. **PUX.1** — `<HelpBox>` + `<AcaoInlineExpansivel>` (componentes base reutilizáveis)
2. **PUX.2** — Banir Dialog/drawer: refator Convênio CT.6 (criar/editar Dialog → página própria)
3. **PUX.3** — Help inline em TODAS as telas (plano-contas, convenios, /dashboard/repasses sem help → aplicar HelpBox + passo-a-passo)
4. **PUX.4** — Estorno repasse: refator frontend (DialogEstornar + DialogCiclo → AcaoInlineExpansivel). Backend já pronto (93f38da).
5. **PUX.5** — Refator telas existentes que usam Dialog/drawer (DialogMarcarPago + DialogCancelar de repasses; despesas aprovar/rejeitar/resolver; apuração Dialog Tipo C "Fechar")
6. **PUX.6** — Lint UX (análogo ao `lint:tenant`): força help + proíbe Dialog em código novo

Estimativa total Polimento UX: 25-40h Code (3-5 sessões).

**Alternativas futuras (após Polimento UX):**
- Convergência /parceiro → /dashboard seletiva (D-novo-BP P3)
- Esvaziar `lint:tenant` allowlist (256 handlers legados)
- D-novo-BR-CT-ESTORNO (estorno Cobranca/ContaAPagar)
- Regimes não-coop por demanda real (consórcio/assoc/condomínio)
- Validação Validação fiscal interna (gate produção contábil — externo Code)

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` (estado atual + frase comandante)
- `~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md` (índice)
- `docs/sessoes/2026-05-31-sprint-contabilidade-tributaria-completo.md` (esta sessão)
- `docs/debitos-tecnicos.md` — seção **Sprint Polimento UX (D-novo-PUX)** P1 + **D-novo-BR-CT-ESTORNO** P2 + **Gate de validação fiscal** P0 bloqueador
- `docs/arquitetura/padrao-ux-vigente.md` (criado nesta sessão — Dialog/drawer proibidos)
- `docs/relatorios/2026-05-31-conformidade-contabil-multi-regime.md` (parecer multi-regime — base Sprint CT)
- `docs/especificacao-contabilidade-cooperativa-segregada.md`

## Carry-overs (não-bloqueantes)

- 10 erros TS pré-existentes em `src/agents/sentinela/*` continuam (4 tool-registry + 6 sentinela.service). Não afetam runtime — `agents/` untracked work-in-progress.
- 43 arquivos untracked em `backend/scripts/*` (relatórios + scripts diagnósticos das últimas sessões) — Sprint Housekeeping futuro.
- Frontend estorno usando Dialog (DialogEstornar + DialogCiclo) — vira refator PUX.4 (sai do roadmap "código quebrado", entra "código a alinhar padrão").

## Regras aplicadas na sessão

- Decisão 23 (validação prévia + leitura antes de tocar código) — todas as 7 fatias começaram com Fase 1 read-only
- Ritual PM2 (stop → port livre → generate → push → restart) — 7 alterações de schema
- Regra fechamento bilateral 13/05 — esta doc-sessão + CONTROLE-EXECUCAO + frase comandante + standby
- Regra não-paralelo claude.ai 17/05 — Code exclusivo nas 7 fatias
- Select nativo dentro Dialog 19/05 — CRUD Convenio
- Lint tenant baseline+ratchet F1.4 — 7 commits sem novos handlers sem decorator
- TenantContext F1.3 + runAsPlatform — hooks contábeis sem TENANT-LEAK
- Build incremental BN (`cd web && npm run build` + `pm2 restart cooperebr-frontend`) — pós-CT.6 e pós-Estorno
- Zero `--accept-data-loss` — migration manual SQL CT.3 preservou 58 lançamentos
- **Decisão UX vigente 31/05 (nova)** — Dialog/drawer proibidos; o que foi feito com Dialog vira refator PUX (catalogado, não revertido)

## Frase comandante

Ver `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA` (local único — Decisão 24).
