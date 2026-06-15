# Sessão 16/06/2026 — M39: Emissão Admin em Lote + Estorno

## TL;DR

Sessão Code maratona fechou a Sprint M39 ponta-a-ponta em **12 commits + 1 merge `--no-ff`** no main (`d1f6a6d`). Substitui o caminho admin single-target de `enviarTokensAdmin` (agora `@deprecated` mas mantido por COMPAT do ramo cooperado→cooperado) por novo endpoint `POST /cooper-token/admin/emitir-lote` em lote via helper `executarMassWrite`. Schema delta aditivo: 2 enums novos (`BONIFICACAO_ADMIN` + `ESTORNO_BONIFICACAO_ADMIN`) + conta contábil `5.1.03 "Despesa de Bonificação CooperToken"`. 2 templates contábeis novos com **bypass intencional do `COOPER_TOKEN_EVENTS.EMITIDO`** pra não disparar o template errado da F1 (decisão crítica: `creditar()` cru chamaria `lancarEmissaoFaturaCheia` "D Custo Desconto / C Passivo" — semanticamente errado pra bonificação admin). Frontend `/dashboard/cooper-token/enviar` REDESENHADO em 2 etapas (seleção + confirmação) com filtro opcional por convênio + tabela editável + prévia COMPLETA antes do OTP. Tela nova `/dashboard/cooper-token/lotes-emitidos` com modal de estorno (confirmação dupla + motivo ≥10 chars + reversão atômica saldo+contábil+ledger ESTORNO). **2 rodadas de reviewers pesados** (`cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer`) acharam 3 P1 + 1 P2 → fixados no commit `09abd5c`. **Re-review do orquestrador pegou 2 P1 RESIDUAIS** (linha `:256` do helper que escapou do replace_all + guard de integridade ausente no estorno) → fixados no commit `e9b5783`. Smoke E2E real PASS 6/6 com gate inegociável respeitado (1 token + estorno imediato, NUNCA emissão real Santi). `D-novo-EMISSAO-ADMIN-CONTABIL P2` catalogado pra sprint contábil dedicada futura (4 problemas pré-existentes: tipo conta 5.1.02 + template F2 + F3/F6/clube sem `LancamentoCaixa`, depende de D3 Modelo C preço custo×venda).

## Marco entregue

**M39 — Emissão Admin em Lote (build) — Blocos 1-9 completos, mergeado em `d1f6a6d`.**

## Commits do dia (12)

| # | Hash | Bloco | Mensagem |
|---|---|---|---|
| 1 | `bf3d658` | 1 | Schema delta (enum `BONIFICACAO_ADMIN` + `ESTORNO_BONIFICACAO_ADMIN`) + conta `5.1.03` + 2 templates contábeis |
| 2 | `b5ab5ae` | 2+3 | Service `emitirLoteAdmin` + `estornarEmissaoLote` + `listarLotesEmitidos` + `getLoteEmitido` (586 linhas) + 4 endpoints REST |
| 3 | `0f553b3` | 4 | 20 specs M39 verde (cap/idempotência/OTP/anti-IDOR/estorno/saldo-guard) |
| 4 | `a700b16` | 5 | Frontend redesign `/dashboard/cooper-token/enviar` (326→690 linhas — 2 etapas, filtro convênio, sem GET saldo, prévia ANTES do OTP) |
| 5 | `7fd58c7` | 6 | Frontend tela nova `/dashboard/cooper-token/lotes-emitidos` (442 linhas — lista paginada + modal estorno + confirmação dupla) |
| 6 | `fe9d9c1` | 7 | `@deprecated` em `enviarTokensAdmin` (JSDoc + nota controller — NÃO removido por COMPAT) |
| 7 | `d86bbf0` | 8 | Cataloga `D-novo-EMISSAO-ADMIN-CONTABIL P2` + atualiza `MAPA-INTEGRIDADE-SISTEMA.md` |
| 8 | `09abd5c` | 9 | 1ª rodada reviewers — fix 3 P1 financeiro + 1 P2 multitenant (valorReais histórico + log.error + usuarioPerfil opcional) |
| 9 | `6ef837c` | 9 | Smoke E2E real PASS 6/6 com cooperado "TESTE E2E CLUBE SPRINT9" |
| 10 | `e9b5783` | 9 | **Re-review orquestrador**: 2 P1 RESIDUAIS fechados (helper `:256` chumbado + guard integridade do estorno) + 5 specs anti-regressão |
| 11 | `d1f6a6d` | merge | merge `--no-ff feature/admin-emitir-lote → main` |
| 12 | `<este>` | fechamento | docs(sessao) fechamento M39 |

Range completo: `db3c545..d1f6a6d` (12 commits + 1 merge), push completo em `origin/main`.

## Entregas técnicas resumidas

### Backend (Blocos 1-3)

**Schema delta aditivo:**
- `enum CooperTokenTipo += BONIFICACAO_ADMIN` (admin emite, distinto de `BONUS_INDICACAO` MLM — classificação fiscal diferente)
- `enum CooperTokenTipo += ESTORNO_BONIFICACAO_ADMIN` (contrapartida — NUNCA apaga registro original, trilha auditável)
- Conta `5.1.03 "Despesa de Bonificação CooperToken"` (DESPESA, grupo TOKENS) — aditiva, `garantirContas` cria automaticamente

**Service `cooper-token.service.ts`** — 4 métodos novos:
- `emitirLoteAdmin` (PREVIEW/CONFIRM via `executarMassWrite`, ~250 linhas)
- `estornarEmissaoLote` (BLOQUEANTE — confirmação explícita + motivo ≥10 chars + atomicidade Serializable, ~160 linhas)
- `listarLotesEmitidos` (`groupBy` ledger pra UI estorno)
- `getLoteEmitido` (detalhe pra UI confirmação)

**Service `token-contabil.service.ts`** — 2 templates novos:
- `lancarEmissaoAdminLote` (`D 5.1.03 / C 5.1.02`) — bonificação admin
- `lancarEstornoEmissaoAdminLote` (`D 5.1.02 / C 5.1.03`) — reversão

**Decisão arquitetural CRÍTICA — bypass do `COOPER_TOKEN_EVENTS.EMITIDO`:**

Não reusar `creditar()` cru porque dispararia `handleEmitido` → `lancarEmissaoFaturaCheia` (template `D Custo Desconto Concedido / C Passivo Tokens` — semanticamente errado pra bonificação admin que cria passivo SEM entrada de caixa). Em vez disso, write self-contained (saldo + ledger) dentro da tx Serializable + chama `tokenContabilService.lancarEmissaoAdminLote` 1× agregado APÓS commit.

**Anti-IDOR multi-tenant** (revalidação server-side):

Servidor REVALIDA cada `cooperadoId.cooperativaId` no DB (`findMany` filtrando por `cooperativaId` + `STATUS_PERMITIDOS_CREDITO`). Cooperados cross-tenant ou inativos NÃO entram em `cooperadosValidos`; entram em `idsInvalidos` → preview retorna alerta `DESTINATARIOS_INVALIDOS` severidade `bloqueante` → helper barra CONFIRM.

**Idempotência por lote:** `clientRequestId` → `referenciaTabela='EMISSAO_ADMIN_LOTE'` + `referenciaId=clientRequestId`. Helper `verificarIdempotencia` callback faz `ledger.findFirst` tenant-bound. Hit retorna `{idempotente: true}` SEM entrar na tx + SEM chamar contábil 2×.

**Tier ALTO sobre TOTAL do lote** (não per-linha): `valorTotalReais > R$50` → 1 OTP único antes do CONFIRM (não N OTPs).

**4 endpoints REST** (`ADMIN/SUPER_ADMIN/OPERADOR`):
```
POST   /cooper-token/admin/emitir-lote                — PREVIEW/CONFIRM
POST   /cooper-token/admin/emitir-lote/:loteId/estornar — BLOQUEANTE
GET    /cooper-token/admin/lotes-emitidos             — Lista paginada
GET    /cooper-token/admin/lotes-emitidos/:loteId     — Detalhe (UI confirmação)
```

### Frontend (Blocos 5-6)

**`/dashboard/cooper-token/enviar` REDESENHADO (326 → 690 linhas):**

Problemas resolvidos:
- ANTES: GET `/cooper-token/saldo` → HTTP 400 pro admin (sem `cooperadoId` no JWT) → card "Seu Saldo: 0" semanticamente errado.
- ANTES: 1 destinatário por confirm → "1 por 1" inviável pra emissão real.
- ANTES: Não dizia "quem→quem".

DEPOIS:
- Banner HelpBox educativo: "Diferente do portal do membro, aqui você EMITE CooperTokens NOVOS — não transfere saldo próprio".
- 2 etapas: `selecao` → `confirmacao` (espelhando padrão F3 `distribuir-tokens`).
- Filtro opcional por convênio (dropdown) — reusa `GET /cooper-token/empresa/convenio/:id/membros-disponiveis`.
- Busca universal por nome/email quando sem convênio.
- "Adicionar todos" + tabela editável + "Quantidade igual a todos" + ajuste individual.
- Cabeçalho concreto na confirmação: "A cooperativa vai EMITIR [X] CooperTokens pra [N] cooperados".
- PRÉVIA mostra LISTA COMPLETA + total ANTES do OTP (BLOQUEANTE).
- `<PinInput>` só pra tier ALTO; BAIXO confirma direto.
- `clientRequestId` estável via `useRef` (padrão F4 C.2).

**`/dashboard/cooper-token/lotes-emitidos` (tela NOVA, 442 linhas):**

- Lista paginada com badges `Ativo` (verde) ou `Estornado em DD/MM/YYYY` (vermelho).
- Modal de estorno (BLOQUEANTE):
  - Resumo amber: N destinatários · X CooperTokens · R$ Y.
  - **LISTA COMPLETA** dos destinatários (scrollable max-h-60).
  - Textarea motivo (mín 10 chars).
  - Checkbox confirmação explícita em **box vermelho**.
  - Botão `variant="destructive"` só habilita com `motivo ≥ 10 chars + checkbox`.
- Pós-sucesso: green card "Estorno concluído!" + recarrega lista.

### Specs (Bloco 4 + commits posteriores)

**21 specs M39** (`cooper-token-m39-emitir-lote.spec.ts`):
- Guards universais (5): cooperativaId, distribuicoes vazias, quantidade ≤ 0, clientRequestId, cap 200.
- Anti-IDOR (2): cross-tenant + INATIVO → alerta MEMBROS_INVALIDOS.
- PREVIEW (2): happy path + PREVIEW NÃO exige OTP mesmo tier ALTO.
- Tier ALTO (3): sem OTP → BadRequest; com OTP válido segue; BAIXO sem OTP.
- CONFIRM (2): happy path com N entries + contábil 1× + idempotência hit.
- Estorno (5): guards motivo/confirmado/inexistente/idempotência + happy path com NEGATIVA + saldo guard non-negativo.
- **P1-B guard integridade (1, novo)**: entries sem `valorReais` → BadRequest ANTES da tx (nem entra na tx nem chama contábil).
- **P1 fix valor histórico (1, novo)**: preço mudou entre emissão e estorno → contábil usa valor HISTÓRICO (simetria D/C).

**5 specs P3 anti-regressão `usuarioPerfil`** (`mass-write.helper.spec.ts`):
- CONFIRM com `usuarioPerfil=ADMIN/SUPER_ADMIN/OPERADOR/undefined` → AuditLog grava o perfil correto.
- Idempotência-hit com `usuarioPerfil=ADMIN` → `*.IDEMPOTENT_RETRY` também grava ADMIN.

**Suite cooper-token + mass-write completa:** 311/311 verde (cooper-token 286 + mass-write 25, zero regressão das 264 anteriores).

### Smoke E2E real (Bloco 9)

PASS 6/6 com **gate inegociável respeitado**: 1 token apenas + estorno imediato, NUNCA emissão real Santi.

Cenário (`backend/scripts/smoke-m39-emitir-lote.ts`):
1. PREVIEW → tier=BAIXO, sem alertas ✅
2. CONFIRM → loteId gerado, 1 destinatário ✅
3. GET detalhe → 1 token, não estornado ✅
4. Estorno → totalEstornado=1, R$0.45 ✅
5. **Saldo final: 1.96 → 1.96 (diferença 0)** — emissão e estorno se anularam EXATAMENTE ✅
6. Idempotência: 2ª chamada do estorno → `idempotente: true` ✅

JWT manual ADMIN `admin@cooperebr.com.br` no tenant CoopereBR. Destinatário: cooperado "TESTE E2E CLUBE SPRINT9" (saldo inicial 1.96 CooperTokens).

## Reviewers — 2 rodadas pesados + re-review do orquestrador

### Rodada 1 (commit `09abd5c`)

**`cooperebr-financeiro-token-reviewer` — BLOQUEOU com 3 P1:**

| # | Severidade | Achado | Fix |
|---|---|---|---|
| P1#1 | P1 | `LancamentoCaixa.cooperadoId` null em lote agregado | Confirmado: schema é `String?` nullable. Documentado como decisão arquitetural (lote AGREGADO 1× por design; rastreabilidade preservada via ledger + `observacoes`). |
| P1#2 | P1 | Estorno usava `valorTokenReais` ATUAL em vez do HISTÓRICO | **Fixado:** `valorTotalReais = soma(entries[i].valorReais)` imutável do ledger original. Spec novo cobre o caso "preço mudou entre emissão e estorno". |
| P1#3 | P1 | Catch silencioso (`logger.warn`) do contábil pode criar divergência ledger↔contábil em falha | **Fixado:** `logger.error` com mensagem "DIVERGÊNCIA LEDGER↔CONTÁBIL — necessário reprocessamento manual". |

**`cooperebr-multitenant-reviewer` — APROVADO com 1 P2 + 1 P3:**

| # | Severidade | Achado | Fix |
|---|---|---|---|
| P2 | P2 | Helper `executarMassWrite` chumbado `usuarioPerfil: 'COOPERADO'` (operação ADMIN gravava perfil errado no AuditLog) | **Fixado:** `MassWriteOptions.usuarioPerfil?: string` opcional + helper usa `options.usuarioPerfil ?? 'COOPERADO'` (compat F3 distribuir). Service emitirLoteAdmin recebe novo param + controller passa `req.user?.perfil`. |
| P3 | P3 | `OPERADOR` em `@Roles(ADMIN, SUPER_ADMIN, OPERADOR)` — questionar | Padrão F3 distribuir. Decisão arquitetural mantida. |

### Re-review do orquestrador (commit `e9b5783`)

**2 P1 RESIDUAIS travavam push:**

| # | Severidade | Achado | Fix |
|---|---|---|---|
| P1-A | P1 | `mass-write.helper.ts:256` ainda chumbado `'COOPERADO'` (commit anterior usou `replace_all: true` mas as duas ocorrências tinham indentação diferente — só `:190` foi capturada) | Fixado individualmente — AMBOS spots agora usam `options.usuarioPerfil ?? 'COOPERADO'`. |
| P1-B | P1 | Estorno PULAVA o contábil silenciosamente quando `entries.valorReais` era null em todos (guard `if (valorTotalReais > 0)` antes do bloco contábil) → divergência ledger↔contábil sem alerta | **Fixado:** guard de integridade ANTES da tx Serializable: `if (somaQuantidade > 0 && valorTotalReais === 0) throw BadRequestException('Entries originais sem valorReais — integridade comprometida, estorno bloqueado')`. Spec dedicado confirma `transactionFn` E `lancarEstornoEmissaoAdminLote` NÃO foram chamados (falha LOUD sem efeitos colaterais). |
| P3 | P3 | Specs anti-regressão `usuarioPerfil` | 5 specs novos em `mass-write.helper.spec.ts` cobrindo ADMIN/SUPER_ADMIN/OPERADOR/undefined no CONFIRM + ADMIN no idempotência-hit. |

## Bugs/débitos resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| `enviarTokensAdmin` single-target inviável | UX (não-bloqueante) | "1 por 1" → 50 colabs = 50 confirmações | Novo endpoint `emitirLoteAdmin` via mass-write helper | RESOLVIDO M39 |
| GET `/cooper-token/saldo` HTTP 400 pro admin | UX | Admin sem `cooperadoId` no JWT, mas UI chamava endpoint cooperado | Frontend redesenhado SEM GET saldo (banner explica "admin emite, não debita") | RESOLVIDO M39 |
| Template contábil errado pra bonificação admin | Arquitetural (latente) | `creditar()` cru emite `EMITIDO` → `lancarEmissaoFaturaCheia` ("D Custo Desconto") | Bypass do evento + template novo `lancarEmissaoAdminLote` (D Despesa Bonif / C Passivo) | RESOLVIDO M39 (parcial — só admin emit) |
| Specs F3 helper sem cobertura `usuarioPerfil` | Bug latente | Hardcoded 'COOPERADO' em 2 spots | 5 specs anti-regressão + `MassWriteOptions.usuarioPerfil?` | RESOLVIDO M39 |
| **D-novo-EMISSAO-ADMIN-CONTABIL** | P2 | 4 problemas pré-existentes no token-contábil: tipo conta `5.1.02` DESPESA→PASSIVO + template F2 errado + F3/F6/clube sem `LancamentoCaixa` | Catalogado pra sprint contábil dedicada futura (depende de D3 Modelo C preço custo×venda) | CATALOGADO |

## Decisões catalogadas

- **Bypass do `COOPER_TOKEN_EVENTS.EMITIDO` no caminho admin emit** — emissão admin é semanticamente diferente da F1 emissão fatura-cheia (cria passivo SEM entrada de caixa).
- **`enviarTokensAdmin` `@deprecated` mas NÃO REMOVIDO** — endpoint `/parceiro/enviar` serve também ramo cooperado→cooperado com PIN. Avaliar remoção após 30 dias de logs `ENVIO_ADMIN` zerados.
- **Tier ALTO sobre TOTAL do lote, não per-linha** — 1 OTP único pra evitar UX inviável com 50 destinatários.
- **Estorno BLOQUEANTE com confirmação dupla** — operação reverte passivo de N pessoas; UI mostra LISTA COMPLETA + total + motivo (≥10 chars) + checkbox confirmação ANTES do botão habilitar.
- **Cap 200 por lote** (default do helper) + extensível por opção; cobre cenários típicos sem permitir batch insano.
- **Falha contábil = `log.error` "DIVERGÊNCIA LEDGER↔CONTÁBIL"** — em vez de catch silencioso, sinaliza ops pra reprocessamento manual; futura sprint adiciona fila de reprocessamento.

## Próximo passo

**(a definir pelo Luciano)** — opções consideradas:

1. **Sprint contábil dedicada** (resolve `D-novo-EMISSAO-ADMIN-CONTABIL P2`): corrige tipo conta `5.1.02` + template F2 + F3/F6/clube sem `LancamentoCaixa` + cron `PROVISIONAL→CONFIRMADO`. Depende de D3 Modelo C.
2. **Decisões D1-D4 do Modelo C** (relatórios 15/06): D1 arrendamento proporcional / D2 cash-out colaborador / D3 preço custo×venda / D4 validade token.
3. **Reforço Hardening Mass-Write SUPER_ADMIN** (P2 enfileirado M35): reusa helper `executarMassWrite` (M39 é precedente arquitetural).

## Pré-requisitos leitura próxima sessão

1. `docs/sessoes/2026-06-16-m39-emissao-admin-em-lote.md` (este arquivo).
2. `docs/CONTROLE-EXECUCAO.md` (frase de retomada).
3. **Os 3 relatórios da sessão paralela 15/06** (`ANALISE-CONVENIO-TOKEN-CLUBE`, `GAP-MAP-CONVENIO-MODELO-C`, `FLUXO-EMISSAO-TOKEN-CONVENIO`) — pré-requisito pra discussão das D1-D4.
4. `docs/debitos-tecnicos.md` seção P2 (`D-novo-EMISSAO-ADMIN-CONTABIL` detalhado).
5. `CLAUDE.md` + `.claude/CLAUDE.md`.

## Carry-overs (não-bloqueantes)

- **D-novo-EMISSAO-ADMIN-CONTABIL P2** (NOVO 16/06) — sprint contábil dedicada futura (4 problemas + depende de D3 Modelo C).
- **D-novo-EMAIL-IMAP-SSL-VERIFY P2** — gate `tls.rejectUnauthorized:false` por env ANTES de deploy prod (responsabilidade Cowork).
- **D-novo-CONVENIO-ADMIN-IDOR-UPDATE-REMOVE P2** — corrigir antes do onboarding 2ª cooperativa real.
- **D-novo-CONVENIO-CONVENIADO-LEGADO P3** — audit + renomear campo (sprint housekeeping schema).
- **D-novo-CONVENIOS-PORTAL-SPECS P3** — cobertura unitária `meusConvenios + dashboardConveniado`.
- **D-novo-CTK-VALOR-HARDCODE-EXTRATO P3** — hardcode `* 0.20` em `estabelecimento/recebimentos:92`.
- **D1-D4 do Modelo C** (relatórios 15/06) — sprints próprios.
- **Sessão Cowork em curso**: 3 M (`backend/package.json`, `package-lock.json`, `concierge.service.spec.ts`) + 8+ untracked + 3 relatórios `*-2026-06-15.md` — NÃO TOCAR.

## Regras aplicadas na sessão

- **Branch dedicada** `feature/admin-emitir-lote` desde 1º commit (decisão Luciano 13/06).
- **Boundary Cowork respeitada** — 3 M + untracked dela intactos.
- **2 reviewers pesados ANTES de smoke** — financeiro-token bloqueou com 3 P1, multitenant aprovou com 1 P2; ambos fixados pré-smoke.
- **Re-review do orquestrador depois dos fixes** — pegou 2 P1 residuais (replace_all incompleto + guard de integridade) → fixados antes de push.
- **Smoke E2E REAL no backend** com gate inegociável respeitado (1 token + estorno imediato, NUNCA emissão real Santi).
- **PM2 cycle obrigatório** em schema delta (`stop → db push → generate → build → restart`).
- **Bypass do evento contábil errado** explicitado no JSDoc + comentários de código pra futuras manutenções não voltarem ao padrão errado.
- **Falha contábil escalada `warn → error`** com mensagem operacional clara.
- **Mergear LOGO após OK final** (lição M37) — Luciano autorizou push após re-verificação do orquestrador.
