# M31 — Sprint Clube P1 · Fase 2 (F2) · Empresa-PJ-cooperada compra tokens via Asaas SANDBOX

## TL;DR

Sessão Code entregou **F2 — empresa cooperada PJ compra tokens creditando no próprio `CooperTokenSaldo`** em 4 blocos sequenciais + 5º commit de fixes P1 pós-review + UI portal dedicada + smoke E2E real com Santi no Asaas SANDBOX. Bloco 1 adicionou 3 colunas aditivas em `CooperTokenCompra` (`compradorCooperadoId`, `asaasCobrancaId`, `ultimoWebhookEventId`) + enum `COMPRA_PJ_COOPERADA`. Bloco 2 criou `comprarTokensCooperado` (service + DTO + endpoint `POST /cooper-token/cooperado/comprar`) com 4 guards (quantidade>0 / cooperado×tenant / `isEmpresaCooperada` PJ / status ATIVO+ATIVO_RECEBENDO_CREDITOS) + integração `AsaasService.emitirCobranca` (PIX/BOLETO) + compensação `CANCELADO` em falha do Asaas + link bidirecional `CooperTokenCompra.asaasId/asaasCobrancaId`. Bloco 3 extendeu `processarWebhook` em `asaas.service.ts` pra emitir evento `cooper-token-compra-pj.paga` via EventEmitter (evita dep circular Asaas↔CooperToken) + listener `CooperTokenCompraPjListener.handlePaga` chama `processarPagamentoCompraPj` que atualiza compra + chama `creditar()` com tipo `COMPRA_PJ_COOPERADA` (Taxa F1.5 sai de graça via `calcularTaxa('emissao')` no `:113-118`). **2 P1 reais** apontados pelos reviewers no commit 5: **GAP 1** (crédito duplo em corrida CONFIRMED+RECEIVED) fechado por **compare-and-swap atômico** via `updateMany {where:{id, cooperativaId, status:'AGUARDANDO_PAGAMENTO'}}` — só se `count===1` credita; `count===0` = corrida-perdida → skip. **GAP 2** (pago sem token) fechado com novo status `PAGO_CREDITO_PENDENTE` + emit `cooper-token-compra-pj.credito-pendente` + `logger.error` loud + `alertaPendencia:true` — nunca silencioso. Defesa multitenant em 3 pontos: `comprarTokensCooperado` link `updateMany {cooperativaId}`, compare-and-swap `updateMany {cooperativaId}`, e novo guard em `creditar()` que valida `cooperado.cooperativaId === param.cooperativaId` (bloqueia cross-tenant em todos os callers). Schema ganhou `@@unique([asaasId])` + `@@index([asaasId])` em `CooperTokenCompra` (PG aceita múltiplos NULL — 0 rows existentes não conflitam). Bloco 4 entregou UI dedicada `/portal/comprar-tokens` (padrão Tipo B) com guard client `isPJ`, form quantidade+formaPagamento, preview total R$, exibe link Asaas + QR PIX + linha digitável + caixa explicativa do fluxo + botão "Voltar" + link condicional em `/portal/tokens` (card cyan ShoppingCart só pra PJ). **Smoke E2E real** com Santi (`cmq6qo4hi0002va2wti5k1sqw`, PJ, `ambienteTeste=true`) na Asaas SANDBOX: login → POST comprar 100 PIX → cobrança real Asaas (payment `pay_wrh5zqdifbcx33vb`, QR PIX 1144 chars base64) → dual-webhook PAYMENT_CONFIRMED + PAYMENT_RECEIVED → **5/5 asserts PASS**: status PAGO + saldo +98 tokens (taxa 2% F1.5) + **1 ledger entry só** (compare-and-swap funcional) + tipo COMPRA_PJ_COOPERADA + webhook 2 retornou 200 sem erro. **Gancho contábil rio-token automático** via evento `EMITIDO` → `FinanceiroTokenListener.handleEmitido` → 2 `LancamentoCaixa` (DESPESA R$ 44,10 Custo Desconto + RECEITA R$ 44,10 Passivo Tokens a Resgatar). 4 débitos novos catalogados (ASAAS-WEBHOOK-AUTH P2, LEDGER-UNIQUE-CONSTRAINT P3, CREDITO-PENDENTE-REPROCESSAMENTO P2 + reforço da rota MLM-condomínio-agregador). **9 suites / 106 tests cooper-token verde.** TSC web exit 0. PM2 ciclo 3× backend + 2× frontend. **6 commits trabalho push completo no F2** (`826d4f1..d69ebf3`) + 1 commit estrangeiro do Luciano em paralelo (Sprint Concierge C1 `f2545f5`).

## Marco entregue

**M31 — Sprint Clube P1 Fase 2: Empresa-PJ-cooperada compra tokens via Asaas SANDBOX + idempotência race-free + gancho contábil rio-token + UI portal dedicada + smoke E2E real**

## Commits do dia (6 trabalho — F2)

| Hash | Tipo | Marco |
|---|---|---|
| `826d4f1` | feat | **F2 Bloco 1** — schema delta `CooperTokenCompra` + 3 colunas aditivas (`compradorCooperadoId`, `asaasCobrancaId`, `ultimoWebhookEventId`) + enum `COMPRA_PJ_COOPERADA` |
| `e06c07d` | feat | **F2 Bloco 2** — `comprarTokensCooperado` (service + DTO + endpoint) + integração Asaas SANDBOX + 4 guards + compensação CANCELADO + 10 specs |
| `89bc531` | feat | **F2 Bloco 3** — webhook Asaas extension + listener via EventEmitter + `processarPagamentoCompraPj` + idempotência 2 camadas + 8 specs |
| `7a06595` | fix | **F2 fixes P1 pós-review** — GAP 1 (compare-and-swap atômico) + GAP 2 (alerta loud `PAGO_CREDITO_PENDENTE`) + defesa multitenant 3 pontos + `@@unique([asaasId])` + 4 specs novos |
| `01ff10c` | feat | **F2 Bloco 4** — UI `/portal/comprar-tokens` (padrão Tipo B com guard PJ + form + preview + exibe link Asaas/QR/boleto) + link condicional em `/portal/tokens` + 2 débitos catalogados |
| `d69ebf3` | test | smoke E2E real Santi compra 100 PIX + dual-webhook + assert ledger único + gancho contábil 2 lançamentos |
| `<próximo>` | docs | fechamento M31 (esta sessão) |

## Entregas técnicas

### Bloco 1 — Schema delta (`826d4f1`)

`CooperTokenCompra` ganhou 3 colunas aditivas (todas nullable):
- `compradorCooperadoId String?` — FK Cooperado. Null preserva caminho legado `parceiro/comprar` (credita `saldoParceiro` tenant). Caminho novo F2 grava o ID do cooperado-PJ.
- `asaasCobrancaId String?` — FK `AsaasCobranca` pra rastreio bidirecional entre compra de token e cobrança real Asaas.
- `ultimoWebhookEventId String?` — idempotência camada 1, espelha `AsaasCobranca:496` (`${event}_${payment.id}`).

Enum `CooperTokenTipo` +1 valor aditivo (9 valores):
- `COMPRA_PJ_COOPERADA` — distingue no extrato/relatório/contábil futuro.

Audit pré (`audit-empresas-pj-cooperadas.ts`): **22 PJ ATIVOS** (todos CoopereBR, incluindo Santi). **0 rows em CooperTokenCompra** → backfill trivial.

### Bloco 2 — Service + DTO + endpoint + Asaas (`e06c07d`)

**DTO `ComprarTokensCooperadoDto`:** class-validator (`@IsNumber + @Min(0.0001)` quantidade; `@IsIn(['PIX','BOLETO'])` formaPagamento). `cooperadoId` NUNCA no body — sempre do JWT.

**`comprarTokensCooperado(params)`** com 4 guards sequenciais:
1. `quantidade > 0` → BadRequest.
2. `findFirst({where:{id,cooperativaId}})` — cooperado existe E pertence ao tenant → NotFound.
3. `isEmpresaCooperada(cooperado)` (helper `cooperado-tipo.helper.ts:12`, `tipoPessoa=PJ`) → 403 se PF.
4. `status in ['ATIVO','ATIVO_RECEBENDO_CREDITOS']` → 403 (v1 conservador).

**Fluxo:** lê `ConfigCooperToken.valorTokenReais` (fallback 0.45) → calcula `valorTotal = round(quantidade × valorTokenReais × 100) / 100` → cria `CooperTokenCompra(AGUARDANDO_PAGAMENTO)` → chama `AsaasService.emitirCobranca(cooperadoId, cooperativaId, {valor, vencimento +5d, descricao, formaPagamento})` → falha do Asaas marca `CooperTokenCompra` como `CANCELADO` (compensação) antes de propagar → sucesso linka bidirecional `asaasId` + `asaasCobrancaId`.

**Endpoint:** `@Roles(COOPERADO) @Post('cooperado/comprar')` — `compradorCooperadoId` + `cooperativaId` SEMPRE do JWT.

**Módulo:** `CooperTokenModule.imports` ganhou `AsaasModule`. `CooperTokenService.constructor` aceita `asaasService?: AsaasService` (optional pra preservar specs antigos que instanciam manual).

### Bloco 3 — Webhook + listener + processamento (`89bc531`)

**Asaas webhook extension** em `asaas.service.ts:529-552`: após processar `AsaasCobranca`, busca `CooperTokenCompra.findFirst({where:{asaasId:payment.id}})`. Se match em `PAYMENT_RECEIVED/CONFIRMED`, emite evento `cooper-token-compra-pj.paga` (payload `{compraId, eventId, paymentId}`). Roteamento via EventEmitter EVITA dep circular Asaas↔CooperToken.

**Listener novo** `cooper-token-compra-pj.listener.ts`: `@OnEvent('cooper-token-compra-pj.paga')` chama `cooperTokenService.processarPagamentoCompraPj(compraId, eventId)`. Try/catch loga mas não propaga (Asaas re-tenta).

**`processarPagamentoCompraPj` (original Bloco 3, refinado no fix P1):**
1. Busca `CooperTokenCompra`.
2. Idempotência camada 1: `ultimoWebhookEventId === eventId` → skip.
3. Status guard: só processa `AGUARDANDO_PAGAMENTO`.
4. Caminho legado guard: `compradorCooperadoId` null = compra parceiro/tenant → skip.
5. `updateMany` compare-and-swap (fix GAP 1) → `creditar()` → tipo `COMPRA_PJ_COOPERADA`, `forcarDisponivel: true`, `referenciaId/Tabela` pra idempotência camada 2.

**Interface `CreditarParams`:** formalizou `forcarDisponivel?: boolean` (era lido via `(params as any)` desde sempre — sem mudança de comportamento, só TS limpo).

### Fixes P1 pós-review (`7a06595`)

Reviewers `cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer` aprovaram zero P0/P1 sobre Blocos 2+3 na 1ª rodada, **mas detectaram 2 P1 reais** no review profundo:

#### GAP 1 — Crédito duplo na corrida CONFIRMED + RECEIVED

**Vulnerabilidade:** Asaas emite ambos eventos (CONFIRMED + RECEIVED) pro mesmo pagamento em sequência rápida. Idempotência camada 1 lia compra → atualizava status simples (`update {where:{id}}`) → ambos webhooks poderiam atualizar concorrentemente antes do read detectar `ultimoWebhookEventId`. Resultado: 2× `creditar()` → token DOBRADO.

**Fix:**
- Schema: `@@unique([asaasId])` + `@@index([asaasId])` em `CooperTokenCompra`. PG aceita múltiplos NULL — 0 rows existentes não conflitam (audit pré confirmou 0 duplicatas).
- Service `processarPagamentoCompraPj`: trocou `update` por **`updateMany`** com `where: {id, cooperativaId, status: 'AGUARDANDO_PAGAMENTO'}`. Compare-and-swap atômico no row level lock do PG. Se `count === 1` → vence a corrida, credita. Se `count === 0` → outro evento já venceu, `skipped='corrida-perdida'` sem creditar.

#### GAP 2 — Pago sem token (alerta loud)

**Vulnerabilidade:** Se `creditar()` retorna null (cooperado mudou status pra PENDENTE entre compra e pagamento, cross-tenant attempt, etc), o status virava `PAGO` mas sem tokens creditados — **silenciosamente perdido**.

**Fix:**
- Schema: status agora aceita `PAGO_CREDITO_PENDENTE` (comentário atualizado).
- Service: se `creditar()` retorna null → `updateMany` compensatório `PAGO → PAGO_CREDITO_PENDENTE` (com `cooperativaId` no where) + `logger.error` com contexto operacional completo + `eventEmitter.emit('cooper-token-compra-pj.credito-pendente', payload)` pra reprocessamento manual/cron futuro + retorna `{creditado: false, alertaPendencia: true}`.

#### Defesa multitenant em 3 pontos

1. **`comprarTokensCooperado` link bidirecional** (`:1842`): trocou `update` por `updateMany {where: {id, cooperativaId}}` + `findUnique`.
2. **`processarPagamentoCompraPj` compare-and-swap**: `cooperativaId` no where do `updateMany`.
3. **`creditar()` cross-tenant guard novo (`:96`):** select inclui `cooperativaId`; valida `cooperado.cooperativaId === cooperativaId` (param). Cross-tenant → log warn + null. Bloqueia TODOS os callers do `creditar()` (não só F2) — defesa em profundidade global.

**Specs:** 4 novos pós-review (compare-and-swap perde corrida; dual-event sequencial → 1 crédito só; creditar null → PAGO_CREDITO_PENDENTE + evento; cross-tenant via creditar). Suite cooper-token: **9 suites / 106 tests verde**. Zero regressão.

### Bloco 4 — UI portal dedicada (`01ff10c`)

**`web/app/portal/comprar-tokens/page.tsx`** (padrão UX Tipo B — entidade inteira = página própria):
- Guard client: `/auth/me` → `tipoPessoa=PJ` libera form; PF vê aviso âmbar amigável.
- Help inline azul explicando fluxo + Taxa de Operação F1.5.
- Form: quantidade (number) + formaPagamento (select PIX/BOLETO). Preview total R$ em tempo real.
- Submit `POST /cooper-token/cooperado/comprar`.
- Resultado renderiza: link Asaas (target=_blank), QR PIX base64 (`img`), copia-e-cola PIX (botão copiar clipboard), linha digitável boleto (botão copiar), caixa explicativa "o que vai acontecer agora" em 4 passos, botões "Nova compra" + "Ver meu saldo".
- Botão "← Voltar aos meus CooperTokens" no topo.

**Link condicional em `/portal/tokens`** (card cyan com `ShoppingCart` + CTA "Comprar"): só renderiza quando `tipoPessoa === 'PJ'` (via `/auth/me`).

### Smoke E2E real (`d69ebf3`)

Validação end-to-end com **Santi PJ no Asaas SANDBOX** (zero dinheiro/disparo real):

```
[3] POST /cooper-token/cooperado/comprar 100 PIX...
    compraId=cmq9lem610000va1gxj7q1gtn
    valorTotal=R$ 45
    asaasId=pay_wrh5zqdifbcx33vb
    linkPagamento=OK
    pixQrCode=OK (1144 chars base64)
    pixCopiaECola=OK (00020101021226820014br.gov.bcb...)
    DB OK: status=AGUARDANDO_PAGAMENTO, compradorCooperadoId=cmq6qo4hi0002va2wti5k1sqw

[4] Webhook 1: PAYMENT_CONFIRMED → response: {"received":true}
[5] Webhook 2: PAYMENT_RECEIVED (mesmo payment, eventId diff) → response: {"received":true}

═══ ASSERTS ═══
  ✅ status = PAGO
  ✅ saldo +98 tokens (taxa 2% F1.5 aplicada corretamente)
  ✅ ledger: 1 entry (compare-and-swap fechou a corrida — sem credito dobrado)
  ✅ ledger entry: tipo=COMPRA_PJ_COOPERADA operacao=CREDITO
  ✅ webhook 2 retornou 200 (sem erro)

🟢 SMOKE PASS — F2 end-to-end OK
```

**Gancho contábil rio-token** confirmado:
```
DESPESA R$ 44,10 [Token] D: Custo Desconto Concedido — Emissão 98 tokens (COMPRA_PJ_COOPERADA)
RECEITA R$ 44,10 [Token] C: Passivo Tokens a Resgatar — Emissão 98 tokens (COMPRA_PJ_COOPERADA)
```
98 tokens × R$ 0,45 = R$ 44,10 ✓ (líquido após taxa). Lançamentos criados automaticamente pelo `FinanceiroTokenListener.handleEmitido` em resposta ao `CooperTokenEmitidoEvent` emitido pelo `creditar():193`. **F2 não precisou tocar contábil** — gancho já estava ativo desde Sprint 31/05 (Contabilidade Tributária Segregada).

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| Empresa PJ não conseguia comprar tokens próprios (só tenant via `parceiro/comprar`) | P1 (sprint principal) | Caminho cooperado nunca existiu | F2 inteiro (Blocos 1-4) | RESOLVIDO `826d4f1..01ff10c` |
| Crédito duplo em corrida CONFIRMED + RECEIVED do mesmo payment | **P1** | `update` simples sem where condicional, idempotência camada 1 ler-then-write | Compare-and-swap atômico via `updateMany {where:{status:AGUARDANDO_PAGAMENTO}}` | RESOLVIDO `7a06595` |
| Pago sem token (silencioso) | **P1** | `creditar()` retorna null não tratado | Status `PAGO_CREDITO_PENDENTE` + evento + logger.error + `alertaPendencia` | RESOLVIDO `7a06595` |
| Cross-tenant em `creditar()` (vetor IDOR financeiro global) | P2 | Trust no `cooperadoId` externo sem validar `cooperativaId` | Guard `cooperado.cooperativaId === param.cooperativaId` em `creditar:96` | RESOLVIDO `7a06595` |
| `updateMany`/`update` em `CooperTokenCompra` sem `cooperativaId` no where | P2 | Defesa em profundidade ausente | `cooperativaId` adicionado em 2 updates (link bidirecional + compare-and-swap) | RESOLVIDO `7a06595` |

## Decisões estratégicas catalogadas

Nenhuma memória persistente nova criada nesta sessão — todas decisões couberam nos commits, doc-sessão e débitos. **Decisões importantes registradas narrativamente:**

1. **Compare-and-swap atômico** preferido sobre lock pessimista ou `$transaction Serializable` — `updateMany {where:{status:'AGUARDANDO_PAGAMENTO'}}` é race-free no row level lock do PG sem custo de lock explícito. Padrão idiomático Prisma.
2. **Status `PAGO_CREDITO_PENDENTE` separado de `CANCELADO`** — semântica distinta: CANCELADO = falha Asaas (compra abortada); PAGO_CREDITO_PENDENTE = pagamento OK mas crédito falhou (operacional, pendente reprocessar).
3. **Cross-tenant guard em `creditar()`** (não só F2) — defesa em profundidade global. Bloqueia TODOS os callers do método que confiarem em `cooperadoId` externo.
4. **EventEmitter como mecanismo de inversão de dependência** — Asaas emite `cooper-token-compra-pj.paga`; CooperToken listener consome. Evita import circular `CooperTokenModule ↔ AsaasModule`.
5. **UI Tipo B (página dedicada)** preferida sobre extensão de `/portal/tokens` — compra é entidade com consequência financeira; padrão UX consolidado (`/dashboard/cooper-token/config`, etc).
6. **Guard PJ no client e backend** — backend `@Roles(COOPERADO) + isEmpresaCooperada` é a defesa real; client `/auth/me + tipoPessoa` evita ruído pra PF mas não é controle de acesso.

## Pendências abertas pra próxima sessão

**Próximo passo único e claro:** **Sprint Clube P1 — FASE 3 (F4 — Funcionário usa/transfere tokens)**. Escopo: bot WA + portal cooperado existente já têm `usar-na-fatura` e `transferir` no nível cooperado. F4 amarra ao fluxo conveniado→funcionário com **PIN/OTP + `$transaction Serializable` + idempotência via jti**. Aplicar Taxa de Operação F1.5 (`taxaTransferenciaPerc`/`taxaTransferenciaFixa` já preparados, default 0). Specs cobrindo bypass de saldo + idempotência. Reviewers dinheiro+tenant ao fim.

**Pré-requisitos leitura próxima sessão (ordem fixa Decisão 23):**
1. `docs/CONTROLE-EXECUCAO.md` (## ONDE PARAMOS topo — M31).
2. `docs/sessoes/2026-06-11-f2-compra-pj-cooperada.md` (esta sessão).
3. `docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md` (FASE 4 = F4 da fila).
4. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/regra_coerencia_sistemica_mapa_impacto_10_06.md` (MAPA DE IMPACTO inegociável).
5. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md` (modelo fundacional).
6. `backend/src/cooper-token/cooper-token.service.ts:usarNaFatura` + `:enviarTokens` (entry points F4).
7. `backend/src/cooper-token/pin-cooperado.service.ts` (PIN/lockout — já preparado em M26 F2.3).
8. `backend/src/common/security/otp-desafio.service.ts` (OTP genérico — já preparado em F2.4).

**Carry-overs desta sessão (não-bloqueantes):**
- 4 débitos novos: D-novo-ASAAS-WEBHOOK-AUTH P2, D-novo-LEDGER-UNIQUE-CONSTRAINT P3, D-novo-CREDITO-PENDENTE-REPROCESSAMENTO P2, D-novo-LEDGER-UNIQUE-CONSTRAINT P3.
- 1 `CooperTokenCompra` smoke do F2 (`cmq9lem610000va1gxj7q1gtn`) status PAGO + Santi com saldo 98 tokens — `ambienteTeste=true`, sem impacto em relatórios reais. Limpa na Sprint Housekeeping.
- 1 `AsaasCobranca` SANDBOX do smoke (payment `pay_wrh5zqdifbcx33vb`) — restara no banco como histórico.

**Carry-overs M28/M29/M30 ainda vivos:**
- D-novo-WA-PHONE-NORMALIZE P2; 3 ações WA declaradas sem implementação; 17 modelos BOT órfãos.
- `empresa_conveniada` / `proprietario_usina` iterando só `cooperados[0]`.
- Fase 3 Token-WA pausa explícita; untracked acumulados pra Housekeeping; 218 membros parciais.
- 2 convites de smoke no convênio Santi (loteId `6a84832d13679547071f6964`) — `ambienteTeste=true`.
- 3 débitos M30 oxidação (LEDGER-TIPO P2, PRESERVADOS-DUPLA-CONTAGEM P3, SPECS P3).

## Estado de fila pós-M31

| Ordem | Bloco | Status |
|---|---|---|
| 1 | **F4 — Funcionário usa/transfere** (PIN/OTP + Serializable + jti + Taxa F1.5) | **PRÓXIMO** |
| 2 | F3 — Empresa distribui em LOTE/INDIVIDUAL (mass-write reusa controles Hardening; CLT 458) | Aguarda |
| 3 | F6 — Estabelecimento resgata token→R$/PIX (recibo, NÃO recompra; flag `Cooperado.ehEstabelecimento`) | Aguarda |
| 4 | Fatia A — Nomenclatura (CTK→CooperToken; dois rios kWh×token) | Aguarda |
| 5 | Sprint Hardening Mass-Write SUPER_ADMIN P2 | Aguarda fim do Clube |
| 6 | Sprint Housekeeping (cleanup smokes Santi + scripts órfãos + worktrees + CooperTokenCompra teste) | Slot oportunístico |

## Regras aplicadas na sessão

- **Decisão 23 + Regra de Coerência Sistêmica**: Fase 1 read-only MAPA DE IMPACTO em 5 dimensões + 5 pontos extras (espelhar `parceiro/comprar`, idempotência webhook, Taxa F1.5, teto 25%, rio token) apresentado ANTES de qualquer Edit/Write. Audit pré-schema confirmou 0 rows. Pausa pro OK antes de implementar.
- **Multi-tenant**: `cooperativaId` SEMPRE do JWT em todos os endpoints novos. Cross-tenant guard novo em `creditar()` blinda TODOS os callers. 3 updates com `cooperativaId` no where pra defesa em profundidade.
- **Idempotência 2 camadas**: `CooperTokenCompra.ultimoWebhookEventId` (compare-and-swap atômico via `updateMany {where:status}`) + `ledger.findFirst by referenciaId/Tabela` no `creditar:100-107`.
- **`isAmbienteReal()`**: smoke E2E SANDBOX sem disparo real (Santi `ambienteTeste=true`).
- **Arredondamento monetário**: `Math.round(x*100)/100` em R$ + `Math.round(x*10000)/10000` em tokens (via `calcularTaxa`).
- **Specs verdes obrigatórias**: 9 suites / 106 tests verde + TSC web exit 0. Zero regressão verificada após cada bloco e fix.
- **Rebuild PM2 backend** aplicado 4× durante a sessão (Bloco 1 schema, Bloco 2, Bloco 3, fix P1). Frontend 2× (Bloco 4, fim).
- **Decisão 24** (frase de retomada em local único): CONTROLE-EXECUCAO + esta doc.
- **Regra não-paralelo com Code**: orquestrador rodou reviewers em 2 rodadas; commits do Code intercalaram com 1 commit estrangeiro do Luciano (Sprint Concierge C1 `f2545f5`) — git resolveu via fast-forward sem conflito.
- **Cadência de review combinada**: Bloco 1 inline; Blocos 2+3 reviewers UMA vez no fim → acharam 2 P1 → 5º commit fixes → re-review APROVADO; Bloco 4 inline; smoke real depois.

## Doc-sessão M31

`docs/sessoes/2026-06-11-f2-compra-pj-cooperada.md`

## FRASE COMANDANTE — próxima sessão Code (Sprint Clube P1, FASE 3 — F4 funcionário usa/transfere)

PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior). Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents. Se não aparecer, parar e avisar.

2. Rodar `git status --short` (diretriz inegociável 18/05). Esperado pós-fechamento M31: working tree limpo (untracked carry-overs catalogados pra Sprint Housekeeping futuro); último commit é o de fechamento M31.

3. Rodar `pm2 list`. Esperado: `cooperebr-backend` + `cooperebr-frontend` + `cooperebr-whatsapp` online (3000/3001/3002 LISTENING) — M31 deixou stack em runtime após F2 + smoke. Toda mudança em `web/` exige rebuild (`next start` sob PM2, sem HMR).

PASSO 1 — Frase comandante (arrancar Sprint Clube P1, FASE 3 — F4 funcionário usa/transfere):

Sessão 11/06 entregou M31 em 6 commits (`826d4f1..d69ebf3`): Sprint Clube P1 FASE 2 (F2 empresa-PJ-cooperada compra tokens). Estrutura completa: ConfigCooperToken + CooperTokenCompra ampliados com campos aditivos (compradorCooperadoId, asaasCobrancaId, ultimoWebhookEventId, @@unique[asaasId]) + enum COMPRA_PJ_COOPERADA + endpoint `POST /cooper-token/cooperado/comprar` reusando AsaasService.emitirCobranca pra emitir cobrança SANDBOX real (PIX/BOLETO) + webhook Asaas extension emite evento `cooper-token-compra-pj.paga` via EventEmitter (evita dep circular) → listener processa via `processarPagamentoCompraPj` que faz compare-and-swap atômico (fix GAP 1) + chama creditar() com tipo COMPRA_PJ_COOPERADA (Taxa F1.5 sai de graça via calcularTaxa('emissao')) + status PAGO_CREDITO_PENDENTE com alerta loud se creditar falhar (fix GAP 2) + cross-tenant guard novo em creditar() (defesa em todos callers) + UI dedicada /portal/comprar-tokens com guard PJ + link condicional em /portal/tokens. **Reviewers cooperebr-financeiro-token-reviewer + cooperebr-multitenant-reviewer aprovaram zero P0/P1 em 2 rodadas** (acharam e fecharam 2 P1 reais no 5º commit). Smoke E2E real com Santi PJ no Asaas SANDBOX validou ponta-a-ponta: compra 100 PIX → cobrança real (payment pay_wrh5zqdifbcx33vb, QR 1144 chars) → dual-webhook CONFIRMED+RECEIVED → 5/5 asserts PASS (status PAGO + saldo +98 tokens taxa 2% + ledger 1 entry só compare-and-swap funcional + tipo COMPRA_PJ_COOPERADA + webhook 2 ok). **Gancho contábil rio-token automático** (2 LancamentoCaixa R$ 44,10 D Custo + C Passivo). 9 suites / 106 tests verde. 4 débitos novos catalogados.

ARRANCAR: **Sprint Clube P1 — FASE 3 (F4 funcionário usa/transfere tokens)** conforme prompt empacotado em `docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md` FASE 4 (= F4 da fila).

Escopo F4: bot WA + portal cooperado já têm `usar-na-fatura` e `transferir`/`enviar` no nível cooperado (legado). F4 amarra ao fluxo **conveniado → funcionário** com **PIN/OTP + `$transaction Serializable` + idempotência via jti**. Aplicar Taxa de Operação F1.5 (`taxaTransferenciaPerc`/`taxaTransferenciaFixa` já preparados, default 0). Specs cobrindo bypass de saldo (não pode usar mais que saldoDisponivel), idempotência jti (mesma chamada não credita 2× o destino), PIN lockout aproveitando `pin-cooperado.service.ts` do M26 F2.3.

Fase 1 read-only + MAPA DE IMPACTO 5 dimensões + 5 pontos extras (espelhar `usar-na-fatura`/`enviarTokens` existentes, jti gerado vs aceito do body, PIN guard já existente, Taxa F1.5 transferência via calcularTaxa('transferencia'), fluxo conveniado→funcionário no UX) → PAUSAR pro OK → implementar → specs verdes.

DIRETRIZES INEGOCIÁVEIS preservar (área dinheiro/token):
- Token = VOUCHER de circuito fechado; cooperativa = emissora única.
- Saída de valor: estabelecimento = RESGATE/liquidação (recibo, SEM NF); cooperado = SOBRA. PROIBIDO token→sobra.
- Multi-tenant: `cooperativaId` SEMPRE do JWT; toda query Prisma filtra `cooperativaId`.
- Transferência/uso de token: PIN/OTP + `$transaction Serializable` + idempotência (jti).
- Monetário: `Math.round(x*100)/100` em R$ + `Math.round(x*10000)/10000` em tokens.
- Disparo real (WA/email): SÓ whitelisted (`5527981341348` / `lucbragatto+sufixo@gmail.com`) + `ambienteTeste=true`.
- Reportar ao orquestrador ao fim de F4 → reviewers `cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer` antes do push.

PRÉ-REQUISITOS LEITURA (mapear, NÃO codar):
1. docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo — M31).
2. docs/sessoes/2026-06-11-f2-compra-pj-cooperada.md (M31 — esta sessão).
3. docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md (FASE 4 = F4).
4. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/regra_coerencia_sistemica_mapa_impacto_10_06.md.
5. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md.
6. backend/src/cooper-token/cooper-token.service.ts:usarNaFatura + :enviarTokens (entry points F4).
7. backend/src/cooper-token/pin-cooperado.service.ts (PIN/lockout M26 F2.3).
8. backend/src/common/security/otp-desafio.service.ts (OTP F2.4).
9. CLAUDE.md + .claude/CLAUDE.md.

ESTADO DE FILA (Decisão 24):
- M31 ✅ entregue.
- PRÓXIMO: F4 Funcionário usa/transfere (PIN/OTP + Serializable + jti).
- F3 Empresa distribui em LOTE/INDIVIDUAL (mass-write reusa Hardening; CLT 458).
- F6 Estabelecimento resgata (recibo, NÃO recompra; flag Cooperado.ehEstabelecimento).
- Fatia A Nomenclatura (CTK→CooperToken, dois rios kWh×token).
- Sprint Hardening Mass-Write SUPER_ADMIN P2 (rebaixado, aguarda fim do Clube).
- Sprint Housekeeping (cleanup smokes Santi + CooperTokenCompra F2 + scripts órfãos + worktrees) — slot oportunístico.

CARRY-OVERS M28/M29/M30/M31 AINDA VIVOS (não-bloqueantes):
- D-novo-ASAAS-WEBHOOK-AUTH P2 (token estático vs HMAC-SHA256 — F2 sessão).
- D-novo-LEDGER-UNIQUE-CONSTRAINT P3 (endurecer idempotência no banco do ledger).
- D-novo-CREDITO-PENDENTE-REPROCESSAMENTO P2 (listener+cron pra PAGO_CREDITO_PENDENTE).
- D-novo-OXIDACAO-LEDGER-TIPO P2 (M30 — pre-requisito ligar oxidação em prod).
- D-novo-OXIDACAO-PRESERVADOS-DUPLA-CONTAGEM P3.
- D-novo-OXIDACAO-SPECS P3.
- D-novo-WA-PHONE-NORMALIZE P2.
- 3 ações WA declaradas sem implementação (PROCESSAR_OCR, MOSTRAR_MENU_PRINCIPAL).
- 17 modelos BOT órfãos.
- `empresa_conveniada`/`proprietario_usina` iterando só `cooperados[0]`.
- Fase 3 Token-WA — pausa explícita.
- Untracked acumulados pra Sprint Housekeeping.
- 218 membros parciais.
- 2 convites de smoke convênio Santi (loteId 6a84832d…) + 1 CooperTokenCompra smoke F2 — `ambienteTeste=true`.

DOC-SESSÃO 11/06 M31:
docs/sessoes/2026-06-11-f2-compra-pj-cooperada.md
