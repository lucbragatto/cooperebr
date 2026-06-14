# M35 Sprint Clube P1 — F6 Resgate em R$ via PIX COMPLETO (Bloco C + C.4 + C.5) — 13-14/06/2026

## TL;DR

Sessão maratona Code (13/06 noite + 14/06 manhã) fechou o F6 Estabelecimento resgata tokens em R$ via PIX ponta-a-ponta. Entregou Bloco C completo (C.0 cadastro PIX com PIN + C.1 portal `/portal/resgatar-tokens` + C.2 card condicional em `/portal/tokens` + C.3 UI Admin `/dashboard/cooper-token/resgates-pendentes`), passou por 2 rodadas de reviewers pesados (`cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer`) que pegaram 2 P0 + 4 P1 + 4 P2 → fechou em C.4 (P0-A IDOR chave PIX + P0-B webhook TRANSFER_* órfão + 4 P1 + 4 P2 + 2 débitos catalogados), passou por re-review independente do orquestrador que pegou GAP-1 P1 (tx Serializable não-atômica no caminho FAILED — invisível ao smoke convencional porque não simula crash) → fechou em C.5 (helper `aplicarEstornoEmTx` extraído + webhook FAILED em tx Serializable única espelhando F6-7 do sucesso). Smoke E2E F6 C.4 com 5 cenários obrigatórios (Golden TRANSFER_DONE + Falha TRANSFER_FAILED + Idempotência webhook + Webhook forjado 401 + Limite diário F6-3 burlável fix) PASS 29/29. Suite total 349/349 verdes. **4ª violação documentada da disciplina de push em sessões paralelas** — sessão Cowork pushou meus commits segurados (C.1+C.2+C.3+C.4) sem aprovação explícita do Luciano, junto com commit dela `98dde72 inventario ANEEL`. Decisão Luciano consequente: **a partir da próxima fatia (F7/Fatia A), segurar em `feature/<fatia>` desde o 1º commit** — fim do gate furado. C.5 isolado pushed (`2459245`) fechando a janela do P1 em produção.

## Marco entregue

**M35 — F6 Estabelecimento resgata tokens em R$ via PIX (Bloco C + C.4 + C.5) — ciclo completo backend + frontend + UI admin + 2 rodadas review + smoke real**

## Commits do dia (8 — 6 sessão 13/06 + 2 sessão 14/06)

| Hash | Tipo | Marco |
|---|---|---|
| `27b5e24` | feat | **C.0** cadastro PIX com PIN (REFORÇO ANTI-FRAUDE) + AuditLog mascarado + tela `/portal/seguranca/dados-bancarios` |
| `eb94494` | feat | **C.1** UI portal `/portal/resgatar-tokens` + `GET /cooper-token/empresa/meus-resgates` anti-IDOR |
| `a23cb2f` | feat | **C.2** card condicional "Resgatar em R$ via PIX" em `/portal/tokens` (ehEstabelecimento) |
| `335e7ff` | feat | **C.3** UI Admin `/dashboard/cooper-token/resgates-pendentes` + banner anti-fraude + sidebar |
| `b397b35` | fix | **C.4 P0-A** IDOR chave PIX — `updateMany` + `cooperativaId` (push isolado imediato via branch hotfix) |
| `03c66ba` | feat | **C.4 P0-B** webhook TRANSFER_* + auth cross-tenant + listener `cooper-token-resgate.listener` |
| `5ab05fc` | fix | **C.4 P1+P2** F6-2/F6-3/F6-5/MT + mascarar/CAS tenant/tx Serializable PAGO/fuso SP |
| `9372c89` | fix | **C.4 pós-re-review** saldoApos + janela diária burlável + listener double-check tenant + 2 débitos catalogados |
| `2459245` | fix | **C.5** GAP-1 webhook FAILED em tx Serializable única (re-review orquestrador) + GAP-2 saldoApos estorno total + smoke 29/29 PASS |

## Entregas técnicas

### C.0 — Cadastro PIX com PIN (REFORÇO ANTI-FRAUDE)

**Schema delta aditivo:**
- `Cooperado.pixUltimaAlteracaoEm DateTime?` — usado pelo banner amber do Dialog admin (C.3) se chave alterada <24h ANTES do recibo.

**Backend (src/meu-perfil/):**
- `DadosBancariosService` (273L) — `getStatus`/`atualizar` com PIN obrigatório via `PinCooperadoService.validarPinComLockout` + validação regex por pixTipo (CPF/CNPJ/EMAIL/TELEFONE E.164/ALEATORIA UUID v4) + AuditLog `cooperado.pix.atualizar` com chaves MASCARADAS (`'+55***48'`) — spec dedicado garante `JSON.stringify(metadata)` NUNCA contém chave em claro.
- `UpdateDadosBancariosDto` com enum `PixTipoEnum`.
- `GET/PUT /meu-perfil/dados-bancarios` (perfil COOPERADO, Throttle 5/min/IP).

**Frontend:** `web/app/portal/seguranca/dados-bancarios/page.tsx` Tipo B com select nativo pixTipo + PinInput + HelpBox explicando "Por que pedimos PIN aqui" + tratamento humano dos 5 erros.

**Specs:** 22 novos cenários (mascarar / getStatus / guards / PIN REFORÇO / happy + AuditLog).

### C.1 — Portal Estabelecimento `/portal/resgatar-tokens`

**Backend:** `GET /cooper-token/empresa/meus-resgates` (`listarMeusResgates`) — filtra `cooperadoEstabelecimentoId + cooperativaId` AMBOS do JWT (anti-IDOR estrito).

**Frontend:** Tipo B dedicada. Carrega `/cooperados/meu-perfil` + `/meu-perfil/dados-bancarios` + `/cooper-token/saldo` + `/cooper-token/empresa/meus-resgates`. 2 guards bloqueantes (ehEstabelecimento + pixChave → empty-states amber CTA). Form quantidade + observação → modal PIN com `clientRequestId useRef` padrão F4 C.2. Tratamento humano dos 7 erros. Lista "Meus resgates" com botão "Cancelar" só em PENDENTE_APROVACAO_COOP. HelpBox completo "Como funciona o resgate" + vocabulário Art. 79.

**Specs:** 6 cenários `listarMeusResgates` (anti-IDOR + filtros + paginação).

### C.2 — Card condicional em `/portal/tokens`

Discoverability do C.1. Carrega `ehEstabelecimento`/`pixChave` em paralelo no `carregarDados`. Card dual (verde quando tem PIX → CTA "Resgatar"; amber quando falta → CTA "Cadastrar PIX"). 58 linhas adicionais, puramente aditivo.

### C.3 — UI Admin `/dashboard/cooper-token/resgates-pendentes`

**Backend:** `listarResgatesPendentes` ganhou derivação `alteradaRecentemente` (chave alterada <24h ANTES do recibo) via include `cooperadoEstabelecimento.pixUltimaAlteracaoEm` — single query, sem N+1, sem endpoint extra.

**Frontend:** Tabela paginada com filtros (status default PENDENTE / valor mín-máx / paginação). Dialog Aprovar mostra valor + chave PIX + estabelecimento + **banner amber se `alteradaRecentemente=true`** (REFORÇO ANTI-FRAUDE materializado em UI). Dialog Recusar com `motivoRecusa` obrigatório.

**Sidebar:** novo item "Resgates Pendentes" em grupo Operacional após "Clube" (ADMIN+SUPER_ADMIN apenas).

### C.4 — Reviews pesadas pós-C: 2 P0 + 4 P1 + 4 P2 corrigidos

Os reviewers `cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer` rodados em paralelo após o C.3 acharam 2 P0 convergentes:

**P0-A IDOR chave PIX** (`b397b35` — push isolado imediato via branch hotfix):
- `dados-bancarios.service.ts:182` usava `cooperado.update({where:{id}})` sem `cooperativaId` — vetor de gravação cross-tenant numa coluna que é ÂNCORA FINANCEIRA do F6 (atacante com race poderia gravar chave PIX em cooperado de outro tenant).
- Fix: `updateMany({where:{id, cooperativaId}, data:{...}})` + `count===1 ou NotFound` (mesmo padrão `PinCooperadoService`).
- 3 specs novos cobrindo race cross-tenant.
- **Push imediato isolado via cirurgia git** (cherry-pick em branch `hotfix/f6-c4-p0-a` → push como main → rebase main local) pra fechar janela em produção sem levar C.1+C.2+C.3 (que ainda estavam segurados).

**P0-B webhook TRANSFER_* órfão** (`03c66ba`):
- Sem este, em modo real Asaas o resgate trava pra sempre em APROVADO_PIX_DISPARADO — PIX-out dispara, Asaas envia TRANSFER_DONE/FAILED, mas o handler só trata PAYMENT_*.
- Fix: branch TRANSFER_* em `asaas.service.ts` ANTES do PAYMENT_* + novo `processarWebhookTransfer` privado:
  * Resolve recibo via `ResgateRecibo.findFirst({asaasTransferId})`.
  * Auth cruzada: `configCooperativaId === recibo.cooperativaId` — token de tenant X bloqueado de processar TRANSFER de Y (UnauthorizedException + log error). **Fecha de carona D-novo-ASAAS-WEBHOOK-AUTH P2.**
  * Mapeamento: DONE/CONFIRMED → sucesso=true; FAILED/CANCELLED → sucesso=false + motivoFalha; CREATED/PENDING/outros → skipped='evento-intermediario'.
  * Emit `'cooper-token-resgate.transfer'` → novo `CooperTokenResgateListener` chama `processarWebhookResgate`.
- 13 specs verdes cobrindo auth, roteamento, cross-tenant, mapeamento, edge cases.

**4 P1 + 4 P2** (`5ab05fc`):
- F6-2 (status não pode mentir): `aprovarResgate` caso Asaas ERROR agora faz CAS APROVADO→FALHA_PIX ANTES do estorno (com motivoFalha + falhaEm).
- F6-3 (limite burlável): `LimiteTokenService.somarGastoHoje` agora soma `ResgateRecibo` do dia (PENDENTE+APROVADO+PAGO) — antes estabelecimento podia gastar R$1.999 em token + R$1.999 em resgate no mesmo dia (limite R$2.000) porque resgate não criava TokenTransacao.
- F6-5 (rate-limit): `@Throttle 5/min/IP` no POST `/cooper-token/empresa/resgatar`.
- MT asaasTransferId: `update` → `updateMany` com cooperativaId.
- P2 mascarar `pixChave` em `listarResgatesPendentes` + `listarMeusResgates` (PII; admin valida por outro canal).
- P2 `cooperTokenSaldo.update` → `updateMany` com tenant em 3 pontos.
- F6-7 webhook PAGO unindo CAS + queima + ledger numa tx Serializable única.
- F6-8 `numeroRecibo` deriva ano em fuso SP, não UTC.

**Pós-re-review** (`9372c89`): saldoApos correto, janela diária dupla (PENDENTE/APROVADO sem data + PAGO do dia), listener double-check tenant, 2 débitos catalogados (D-novo-F6-RECONCILIACAO-CRON P2 + D-novo-MT-F2-F3-F4-LEGADO-UPDATE-COOPERADO P2).

### C.5 — GAP-1 webhook FAILED em tx Serializable única (re-review orquestrador)

A re-review independente do orquestrador (após o C.4 aprovado pelas 2 rodadas pesadas) achou **GAP-1 P1** invisível ao smoke convencional porque smoke não simula crash:

- **Antes (C.4):** caminho FAILED tinha CAS `APROVADO→FALHA_PIX` FORA de tx + `estornarResgateInterno` abrindo tx Serializable PRÓPRIA. Crash entre os 2 deixava recibo em FALHA_PIX com tokens ainda BLOQUEADOS (saldoBloqueadoResgate preso) — contabilidade desencontrada sem caminho de cura (Asaas não re-envia evento já recebido).
- **Fix (C.5):** UMA única tx Serializable engloba CAS + estorno (saldo + ledger) + gravação `ultimoWebhookEventId`. Crash em qualquer ponto → rollback total → recibo VOLTA pra APROVADO_PIX_DISPARADO, Asaas re-envia webhook em backoff, fluxo retoma consistente. Espelha exatamente o padrão F6-7 do caminho sucesso.
- **Refator:** extraído helper privado `aplicarEstornoEmTx(tx, params)` que faz só o trabalho dentro de uma tx existente. Wrapper `estornarResgateInterno` (usado por `recusarResgate` + `cancelarResgate`) abre tx própria + chama o helper. Webhook FAILED chama o helper DIRETAMENTE dentro da tx do CAS — atomicidade garantida.

**GAP-2 (P3) corrigido junto:** `saldoApos` do ledger ESTORNO_RESGATE_PIX = `novoSaldoDisp + novoSaldoBloq` (total pós-operação) em vez de só `saldoDisponivel`. Consistente com F6-7 sucesso.

### Smoke E2E F6 C.4 (29/29 PASS)

Script novo `backend/scripts/smoke-f6-c4.ts` (~600 linhas) com setup idempotente AMAGES + 5 cenários obrigatórios + cleanup:

| Cenário | Resultado |
|---|---|
| 1 — Golden TRANSFER_DONE | ✅ PAGO_RECIBO_EMITIDO + queima 10 tokens + ledger RESGATE_PIX + invariante conservada |
| 2 — Falha TRANSFER_FAILED | ✅ FALHA_PIX + estorno + ledger ESTORNO_RESGATE_PIX + invariante conservada |
| 3 — Idempotência webhook | ✅ Mesmo eventId reenviado: skipped, sem duplicar ledger nem mexer saldo (REFORÇO 2) |
| 4 — Webhook forjado | ✅ 401 sem token + 401 com token errado |
| 5 — Limite diário | ✅ 1º passa (R$ 6,75 ≤ 8), 2º bloqueado (R$ 9 > 8) — F6-3 inclui resgates no gasto |

Script reusável pra QA + futura automação CI. Mantido PASS após o refator C.5 (sem regressão).

## Bugs resolvidos / catalogados nesta sessão

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| P0-A IDOR chave PIX | P0 | `update({where:{id}})` sem tenant na coluna ÂNCORA do F6 | `updateMany` + tenant + `count===1` | RESOLVIDO `b397b35` |
| P0-B webhook TRANSFER_* órfão | P0 | `processarWebhook` só tratava PAYMENT_* | Branch TRANSFER_* + listener + auth cruzada | RESOLVIDO `03c66ba` |
| F6-2 status mente em Asaas ERROR | P1 | `aprovarResgate` chamava estorno sem trocar status antes | CAS APROVADO→FALHA_PIX antes do estorno | RESOLVIDO `5ab05fc` |
| F6-3 limite diário burlável | P1 | `gastoHoje` só somava TokenTransacao, não ResgateRecibo | `somarGastoHoje` soma resgates do dia (janela dupla) | RESOLVIDO `5ab05fc`+`9372c89` |
| F6-5 sem rate-limit no resgatar | P1 | Endpoint público sem `@Throttle` | `@Throttle 5/min/IP` | RESOLVIDO `5ab05fc` |
| MT asaasTransferId update sem tenant | P1 | `update({where:{id}})` em escrita do F6 | `updateMany + cooperativaId` | RESOLVIDO `5ab05fc` |
| P2 pixChave PII em listas admin | P2 | Chave PIX em claro em retorno de tabela | `DadosBancariosService.mascarar` em ambas listas | RESOLVIDO `5ab05fc` |
| P2 cooperTokenSaldo sem tenant (3 pontos) | P2 | `update({where:{cooperadoId}})` único | `updateMany` com cooperativaId | RESOLVIDO `5ab05fc` |
| F6-7 atomicidade webhook PAGO | P2 | CAS fora da tx + queima em tx separada | Tudo numa tx Serializable única | RESOLVIDO `5ab05fc` |
| F6-8 numeroRecibo ano UTC | P2 | `new Date().getFullYear()` virava ano antes 21h-00h BR | `inicioDoDiaEmSaoPaulo` derivação | RESOLVIDO `5ab05fc` |
| Post-review saldoApos enganoso | P2 | Ledger RESGATE_PIX gravava saldoDisponivel pré-queima | `saldoTotalApos = disp + bloq` pós | RESOLVIDO `9372c89` |
| Post-review janela diária burlada 23h55→00h05 | P2 | `createdAt gte inicioHoje` exclui pendentes de ontem | Janela dupla: PENDENTE/APROVADO sem data + PAGO do dia | RESOLVIDO `9372c89` |
| Post-review listener payload cooperativaId morto | P3 | Campo emitido mas service não recebia | `processarWebhookResgate` recebe `cooperativaIdEsperada` + double-check | RESOLVIDO `9372c89` |
| GAP-1 webhook FAILED não-atômico | P1 (orquestrador) | CAS fora da tx + estorno em tx separada | Helper `aplicarEstornoEmTx` + tx única espelhando F6-7 | RESOLVIDO `2459245` |
| GAP-2 saldoApos estorno só disp | P3 (orquestrador) | `saldoApos: novoSaldoDisp` no estorno | `saldoApos: novoSaldoDisp + novoSaldoBloq` total | RESOLVIDO `2459245` |

## Descobertas operacionais

**4ª violação documentada de disciplina de push em sessões paralelas:** Cowork rodou `git push` durante esta sessão sem checar `git log origin/main..HEAD`, levando junto **TODOS os meus commits segurados** (C.1+C.2+C.3+P0-B+P1+P2+post-re-review) embarcados no push do commit dela `98dde72 inventario ANEEL usinas solar+hidraulica ES`. Mesmo padrão da 1ª violação (Tese 6 levou A+B+M34+C.0). Memória `regra_push_disciplina_sessoes_paralelas_06_11.md` continua válida mas inegavelmente furada. **Decisão Luciano consequente:** a partir da próxima fatia (F7/Fatia A), segurar em `feature/<fatia>` desde o 1º commit — merge→main só após review OK. Fim do gate furado.

**Diretriz operacional reforçada (não-nova, mas vale registro):** `pm2 restart cooperebr-backend` é obrigatório após CADA build de backend que mexer em código de runtime. Builds sequenciais sem restart NÃO acumulam — só o último restart pega. Esta sessão teve 1 iteração do smoke onde o webhook TRANSFER_* veio 200 mas listener não processou — diagnóstico: uptime 23h, restart só pegou C.0; restart correto resolveu. Regra já está no CLAUDE.md ("REBUILD obrigatório quando muda código backend"), só seguir.

## Decisões estratégicas catalogadas

Nenhuma memória persistente nova criada nesta sessão. A decisão "fim do gate furado / feature/<fatia> a partir da próxima sprint" foi tomada nesta sessão, será catalogada na próxima retomada (claude.ai) — não cabe Code escrever memória nova sobre processo de governança de push.

## Próximo passo

**Sprint Clube P1 — Fatia A (CTK → CooperToken nomenclatura)** em **branch feature/fatia-a** desde o 1º commit (decisão 13/06 — fim do gate furado).

Escopo Fatia A:
- Refator nomenclatura `CTK` → `CooperToken` em todas as superfícies UI (cards saldo, badges, tooltips, mensagens de erro).
- Dois rios kWh×token visivelmente separados na UI (energia ≠ benefício).
- Sem mudança de schema — puro de UI/labels.

## Pré-requisitos leitura próxima sessão

1. `docs/CONTROLE-EXECUCAO.md` topo (## ONDE PARAMOS + ## FRASE DE RETOMADA)
2. `docs/sessoes/2026-06-13-f6-resgate-pix-completo.md` (este doc)
3. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/sprint_clube_unificado_cooper_token_10_06.md` (Fatia A escopo)
4. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md` (vocabulário inegociável: voucher / liquidação / recibo — NUNCA recompra/venda)
5. Grep amplo `\bCTK\b` em `web/app/**/*.tsx` pra mapear superfícies a refatorar
6. CLAUDE.md + .claude/CLAUDE.md

## Carry-overs (não-bloqueantes)

- **D-novo-F6-RECONCILIACAO-CRON P2** (catalogado em `docs/debitos-tecnicos.md`) — cron varrendo `ResgateRecibo` parados em APROVADO_PIX_DISPARADO >30min com asaasTransferId setado mas sem evento terminal; consulta status no Asaas e simula webhook. Implementar antes de volume real.
- **D-novo-MT-F2-F3-F4-LEGADO-UPDATE-COOPERADO P2** (catalogado) — F2/F3/F4 + expiração + oxidação + QR ainda usam `cooperTokenSaldo.update({where:{cooperadoId}})` sem cooperativaId. Não é IDOR ativo (cooperadoId é @unique + controller pega do JWT), mas "protegido por acidente do schema". Migrar progressivamente no Sprint Hardening Mass-Write SUPER_ADMIN (já enfileirado).
- **D-novo-F6-ADMIN-FLAG-ESTAB P2** (descoberto no smoke C.4) — não há UI admin pra ativar `Cooperado.ehEstabelecimento`. Hoje setado via script de smoke; precisa de tela `/dashboard/cooperados/[id]/editar` com toggle "É Estabelecimento do Clube".
- **D-novo-ASAAS-WEBHOOK-AUTH** ✅ RESOLVIDO de carona no C.4 P0-B (auth cruzada `configCooperativaId === recibo.cooperativaId`).
- Sessão paralela Cowork: 5 commits embarcados em origin/main (`1405da5` C8 esqueleto + `f94a05b` landing 2 funis + `1f6fdb0` Tese 6 orquestrador + `e85723d` dossiê EXFISHES + `98dde72` inventario ANEEL). Sem conflito com F6.
- Working tree: `concierge.service.spec.ts` M unstaged (território Cowork). `CONTROLE-EXECUCAO.md` tinha 51 linhas dela preservadas integralmente neste fechamento.
- Carry-overs históricos vivos (M28→M34) seguem abertos.

## Regras aplicadas na sessão

- **Regra de Coerência Sistêmica** — MAPA DE IMPACTO 5 dimensões no início do Bloco C (Fase 1 read-only) antes de codar
- **Decisão 23** — Fase 1 read-only + perguntas decisórias antes do OK Luciano
- **REFORÇO ANTI-FRAUDE Luciano** — PIN obrigatório pra trocar chave PIX + banner amber se alteradaRecentemente
- **3 REFORÇOS F6 Bloco B** preservados — compare-and-swap em TODAS transições + estorno auditável NUNCA apaga + webhook idempotente via ultimoWebhookEventId
- **Vocabulário inegociável** "resgate"/"liquidação"/"recibo" em TODAS as strings (zero "recompra"/"venda" — `grep` pré-commit confirmou)
- **Multi-tenant** `cooperativaId` SEMPRE do JWT — anti-IDOR em todos os 5 endpoints + 2 reviews pesadas pegaram o que escapou
- **PIN/OTP NUNCA logados** + PIN validado FORA da tx
- **Tx Serializable única** no webhook PAGO (F6-7) e webhook FAILED (C.5 GAP-1) — espelha padrão
- **Rebuild PM2 obrigatório** após mudança backend (stop libera locks → build → restart) — diretriz CLAUDE.md
- **Regra contatos de teste**: AMAGES + `+5527981341348` + `lucbragatto+amages@gmail.com` no smoke
- **Cirurgia git pra push isolado** (P0-A imediato) via branch `hotfix/<id>` + cherry-pick + push como main + rebase main local — preserva commits segurados
- **Push segurado** quebrado 2× por sessão paralela Cowork (1ª no Tese 6, 2ª no inventario ANEEL) — decisão Luciano consequente: `feature/<fatia>` desde o 1º commit a partir da próxima sprint

## Frase comandante

Versão única em `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — frase em local único por arquivo).
