# M40 — Abrir Cadastros SISGD + análise circuito de emissão de token — 16/06/2026

## TL;DR

Sessão Code de dia inteiro entregou 2 eixos paralelos:

1. **Sprint "Abrir Cadastros — Teste SISGD"** — convênio interno `CV-SISGD-TESTE-001` pronto pra receber a turma de teste do próprio SISGD validar onboarding ponta a ponta antes da Santi/Triad. Smoke E2E 10/10 verde (convite OTP → cadastro → empresa aprova → admin aprova → MEMBRO_ATIVO). Convergiu pro convênio pré-existente do banco (não criou duplicata; órfãos da v1 desativados sem deletar). 0 P0/P1 multi-tenant + 4 P3 defense-in-depth aplicados.

2. **Análise read-only do circuito de emissão de token** (4 agentes Cowork/claude.ai em paralelo, 5283L de investigação produziram 3 docs `ANALISE-` + `FLUXO-` + `GAP-MAP-` 15/06). 4 decisões de produto fechadas + **10 débitos novos catalogados** (2 P1 contábeis bloqueadores + 7 P2 do circuito + 1 P3). Próximo grande bloco apontado: **Sprint "Circuito de Emissão Completo" (4 fases)** — entra DEPOIS de Sprint D2 (Saque PIX colaborador) + Sprint Decaimento Qualificação.

## Marco entregue

**M40 — Abrir Cadastros SISGD + análise circuito de emissão**

## Commits do dia (6 + 1 merge + 1 fechamento)

| Hash | Tipo | Mensagem |
|---|---|---|
| `e84eada` | feat(seeds) | seed SISGD Teste Interno v1 (preservado no histórico) |
| `e4cbdcc` | fix(seeds) | seed v2 converge-aware + desativa órfãos da v1 |
| `963a355` | test(smoke) | E2E onboarding SISGD Teste Interno (10/10 PASS) |
| `65aec47` | fix(seeds+smoke) | 4 P3 reviewer multi-tenant aplicados |
| `1634c11` | merge | feature/abrir-cadastros-sisgd-teste → main (Sprint M40) |
| `0371185` | docs | 3 relatórios análise read-only circuito emissão token (Cowork+claude.ai 15/06) |
| _este_ | docs(sessao) | fechamento M40 |

## Entregas técnicas — Eixo 1 (Abrir Cadastros SISGD)

### Seed SISGD Teste Interno v2 — converge-aware

`backend/scripts/seed-sisgd-teste-interno.ts` (330L, idempotente). Garante:

- **Cooperado SISGDSOLAR SISTEMAS LTDA** (`cmq57khne0002vavsis4v9oxk`, cpf `11222333000181`, email `lucbragatto+sisgd@gmail.com`, ATIVO + ambienteTeste=true) — pré-existente desde 08/06, convergido (nome/cpf preservados).
- **Usuario logável** `lucbragatto+sisgd@gmail.com` / **SISGD@2026** — perfil COOPERADO, resolve pro SISGDSOLAR via `PagadorCooperadoGuard` email match.
- **ContratoConvenio CV-SISGD-TESTE-001** (`cmq57khys0005vavshti9gst9`, ATIVO + APROVADO, pagador=EMPRESA).
- **Desativação dos 2 órfãos da v1** (`cmqggn42n...` cooperado + `cmqggn5pj...` convênio CV-SISGD-INTERNO): status=ENCERRADO. **NUNCA DELETA** (salvaguarda `institucional+sisgd@sisgd.invalid` preservada).

P3 reviewer aplicado: updateMany + filtro `cooperativaId=CoopereBR` + assert `count==1` (defense in depth).

### Smoke E2E onboarding

`backend/scripts/smoke-cadastro-sisgd-teste.ts` (561L, 10 passos).

| Passo | Ação | Resultado |
|---|---|---|
| 1 | cleanup idempotente do run anterior | ✅ |
| 2 | JWT admin CoopereBR | ✅ |
| 3 | `POST /convenios/{conv}/convites` | ✅ conviteId + wa enviado |
| 4 | `POST /publico/convites/{tk}/solicitar-otp` | ✅ |
| 5 | override `otpCodigoHash = sha256(123456+salt)` | ✅ smoke determinístico |
| 6 | `POST /publico/convites/{tk}/validar-otp` | ✅ |
| 7 | `POST /publico/convenios/auto-inscrever` | ✅ Cooperado + Membro PENDENTE_APROVACAO_EMPRESA |
| 8 | empresa SISGD `POST /portal/meus-convenios/.../decidir { APROVAR }` | ✅ → PENDENTE_APROVACAO_ADMIN |
| 9 | admin `POST /convenios/.../aprovar-admin` | ✅ → MEMBRO_ATIVO |
| 10 | read-only final: MEMBRO_ATIVO + ProgressaoClube criada | ✅ |

Re-runs idempotentes (cleanup do cooperado teste anterior em tx; 1 cooperado per momento, banco não acumula).

P3 reviewer aplicado: removeu `cooperadoId` do payload JWT empresa (PagadorCooperadoGuard depende só de email match — incluir mascara regressão futura) + `cooperativaId` no `deleteMany` dos models que têm campo nativo.

### Whitelist atualizada

`backend/src/common/safety/whitelist-teste.ts` — +1 alias `lucbragatto+sisgd-teste@gmail.com`. 56/56 specs PASS.

### Escopo CANCELADO durante a Fase 1

Bloco (b) — tela `/conveniada/convenio/[id]/membros` e Bloco (c) — tela `/dashboard/convenios/[id]/membros-pendentes` foram **cancelados** após descobrir que o componente `MembrosPendentesSection` (735L, Sprint Convite-Convênio Fatia 5 em 03/06) **já está plugado em ambas as detail pages** — feature funcional em uso há 13 dias. Decisão Luciano: convergir pro existente em vez de duplicar UI (D-novo-ADMIN-FILA-APROVACAO-GLOBAL P2 fica enfileirado pra discoverability sidebar global, sprint futura).

## Entregas técnicas — Eixo 2 (análise circuito de emissão de token)

3 docs Cowork+claude.ai capturados no main (commit `0371185`):

- **`docs/ANALISE-CONVENIO-TOKEN-CLUBE-2026-06-15.md`** (154L) — visão produto vs realidade código, 12 gaps.
- **`docs/FLUXO-EMISSAO-TOKEN-CONVENIO-2026-06-15.md`** (105L) — fluxograma técnico passo 0 (admin emite/empresa compra) → passo 10 (resgate PIX/fatura) + lançamentos contábeis esperados.
- **`docs/GAP-MAP-CONVENIO-MODELO-C-2026-06-15.md`** (111L) — tabela de débitos por passo com severidades.

### 3 decisões de produto fechadas + 1 nova rotulação (correção 16/06 noite)

| # | Decisão | Resolução |
|---|---|---|
| **D1** | Arrendamento empresa→cooperativa→dono usina | **RESOLVIDA** — opção A (empresa paga cooperativa, cooperativa paga aluguel ao dono). Nada a construir. |
| **D2** | Saque do colaborador em PIX | **CONSTRUIR com toggle** (config liga/desliga; reusa F6 ~70% pronto, tira guard `ehEstabelecimento`). Vira Sprint dedicada antes do Circuito de Emissão. **Carona:** fecha D-novo-RESGATE-PIX-SEM-CAIXA implementando `D Passivo / C Caixa` conforme FUNDACAO §2.1. |
| **D3 (oficial)** | **Preço de custo × venda do token** | **CONTINUA ABERTA.** Bloqueia Fase 1 contábil do Sprint Circuito de Emissão Completo (D-novo-EMISSAO-ADMIN-CONTABIL P2 + D-novo-COMPRA-PJ-TEMPLATE-CONTABIL P1 dependem desse preço pra decidir o lançamento F2 correto). |
| **D-QUALIF-DECAY** | Decaimento da qualificação | **CONSTRUIR** — nível cai com inatividade (espelha oxidação do token); métrica = uso + indicações; admin pondera. Resolve "use ou perde" do lado da qualificação. Sprint dedicada. **Rotulado D3 por engano no fechamento inicial M40** — corrigido pra D-QUALIF-DECAY 16/06 noite. |
| **D4** | Oxidação do token | **CONFIRMADA EXISTENTE** — `aplicarOxidacao` em `cooper-token.service.ts:3006` + cron + gate `OXIDACAO_PRODUCAO_LIBERADA`. Resolve D4 como decay, não expiração seca. Nada a construir. |

### 10 débitos novos catalogados em `debitos-tecnicos.md`

**P1 (bloqueadores DRE Modelo C):**

- 🔴 **D-novo-COMPRA-PJ-TEMPLATE-CONTABIL** — Compra paga pelo conveniado lançada como "desconto concedido" em vez de receita. Método `lancarCompraParceiroPago` existe mas não é chamado. Receita some, passivo infla.
- 🔴 **D-novo-RESGATE-PIX-SEM-CAIXA** — F6 PIX-out real do resgate sem `LancamentoCaixa`. Passivo permanente.

**P2 (circuito de emissão — bloco consolidado):**

- D-novo-DISTRIBUICAO-SEM-CONTABIL — F3 sem `LancamentoCaixa` (taxa transferência travada).
- D-novo-OXIDACAO-SEM-CONTABIL — quebra sem reconhecer receita.
- D-novo-TOKEN-NOTIFICACOES-ORFAS — 0/8 passos disparam email/WA (`TokenNotificacaoService` desconectado, evento QR sem listener).
- D-novo-CONVENIADO-COMPRA-UI-AUSENTE — `/portal/comprar-tokens` 404 (3 links quebrados, backend pronto).
- D-novo-PERMISSAO-CONVENIADO-EMISSAO — sem portão admin visual na UI emitir-lote.
- D-novo-EMISSAO-SELETOR-QUEM-CUSTO — tela emite sem perguntar fonte do custeio (admin bonifica vs empresa paga vs auto-distribuir).
- D-novo-PRE-CONFIG-DISTRIBUICAO — sem auto-distribuir tokens no pagamento da empresa.

**P3:**

- D-novo-COMPRA-SEM-CONVENIOID — `CooperTokenLedger.convenioId` ausente em compras pagas.

### Conta 5.1.02 DESPESA→PASSIVO

**Já catalogada** em `D-novo-EMISSAO-ADMIN-CONTABIL` (Sprint M39, 16/06 madrugada — debitos-tecnicos:382). Não duplicada.

## Correções de percepção registradas

A análise paralela detectou que diversos achados "ausentes" na Fase 1 da sessão estavam, na verdade, presentes:

- **Telas de aprovação** EXISTEM (`MembrosPendentesSection` em ambas detail pages desde 03/06).
- **Tier do convênio valida** corretamente (não há gap aqui).
- **Reavaliação de qualificação** EXISTE — só não rebaixava (motivo da D-QUALIF-DECAY ser sprint nova: implementar rebaixamento).

## Próximo passo

**Sprint D2 — Saque PIX colaborador comum** (extensão F6 sem `ehEstabelecimento`, com toggle config liga/desliga). ~6-10h. Reusa F6 do M34/M35 (~70% pronto).

Em paralelo / depois: **Sprint Decaimento Qualificação** (D-QUALIF-DECAY, ~6-10h).

DEPOIS dos 2: **Sprint "Circuito de Emissão Completo"** (4 fases — contábil → notificações → emissão unificada quem/custo → compra conveniado + auto-distribuição). Resolve os 2 P1 + 7 P2 do bloco catalogado hoje. **Bloqueada por D3 oficial (preço custo×venda do token)** — decisão produto pendente.

## Correção pós-fechamento (16/06 noite)

3 ajustes catalogados em commit único após fechamento original M40:

1. **Disciplina de análise** adicionada ao CLAUDE.md — modelo canônico (4 lentes) primeiro, antes de propor qualquer mudança que toque dinheiro/contabilidade/regra econômica.
2. **`docs/FUNDACAO-COOPERTOKEN-MODELO-CANONICO.md`** commitado no main (artefato vivo do orquestrador, 4 leitores profundos sobre 5283L do `cooper-token.service.ts`). Pré-requisito de leitura pra qualquer sprint que toque token.
3. **Correção D3:** Sprint Decaimento Qualificação rotulada D3 por engano. **D3 oficial = preço custo×venda do token (continua ABERTA, bloqueia Fase 1 contábil)**. Decaimento da qualificação renomeado pra **D-QUALIF-DECAY**.
4. **Escopo Sprint D2 ampliado:** fecha D-novo-RESGATE-PIX-SEM-CAIXA de carona (mexe nos mesmos arquivos: solicitarResgate + listener). Implementa `D Passivo / C Caixa` conforme FUNDACAO §2.1.

## Pré-requisitos leitura próxima sessão

- `docs/sessoes/2026-06-16-m40-abrir-cadastros-sisgd-teste.md` (esta)
- `docs/ANALISE-CONVENIO-TOKEN-CLUBE-2026-06-15.md` + `docs/FLUXO-EMISSAO-TOKEN-CONVENIO-2026-06-15.md` + `docs/GAP-MAP-CONVENIO-MODELO-C-2026-06-15.md`
- `backend/src/cooper-token/cooper-token.service.ts:3006` (`aplicarOxidacao` — D4 confirmada existente)
- Para Sprint D2: arquivos F6 do M34/M35 — `cooper-token-resgate.listener.ts`, AsaasPixOutService, telas `/portal/resgatar-tokens` e `/dashboard/cooper-token/resgates-pendentes` (sprint reusa ~70%)

## Carry-overs (não-bloqueantes)

- 8 M selados Cowork em `backend/src/concierge/*` + `package.json/lock` — território Cowork, intocados.
- 3 opções pós-M39 (Sprint Contábil dedicada / Decisões D1-D4 Modelo C / Sprint Hardening Mass-Write) — Modelo C fechado HOJE (4 decisões); Sprint Contábil entra como Fase 1 do Circuito de Emissão futuro; Hardening Mass-Write segue enfileirado.
- D-novo-ADMIN-FILA-APROVACAO-GLOBAL P2 — sidebar admin "Aprovações pendentes" global agregada (discoverability operacional). Sprint futura.
- Branch `feature/abrir-cadastros-sisgd-teste` permanece no remote pra histórico (mesmo após merge).

## Regras aplicadas na sessão

- **Decisão 23** — Fase 1 read-only obrigatória + pausas pra OK Luciano antes de cada toque destrutivo (4× nesta sessão: criação branch, ajuste seed após descoberta órfãos, aplicação P3, push/merge).
- **`feedback_fase1_readonly_obrigatoria.md`** — Fase 1 detectou que `MembrosPendentesSection` já existia → Blocos (b)/(c) cancelados ANTES de codar.
- **CLAUDE.md "Cooperados institucionais — SALVAGUARDA"** — órfãos da v1 desativados (ENCERRADO), nunca deletados.
- **Regra contatos teste impreterível (14/05)** — smoke usa `27981341348` + `lucbragatto+sisgd-teste@gmail.com`. Nenhum disparo real fora whitelist.
- **Regra Cowork-território (19/05)** — 8 M de `backend/src/concierge/*` intocados durante toda a sessão.
- **NUNCA `git add .`** — todos os adds explícitos arquivo-a-arquivo (3 docs análise commitados com `git add` separado por nome).
- **Decisão 24** — frase de retomada em local único (CONTROLE-EXECUCAO § FRASE DE RETOMADA).
- **Reviewer multi-tenant pesado ANTES de merge** — `cooperebr-multitenant-reviewer` rodou; 0 P0/P1, 4 P3 aplicados antes do push.

## Frase comandante

Ver `## FRASE DE RETOMADA — próxima sessão Code` em `docs/CONTROLE-EXECUCAO.md` (Decisão 24 — local único).
