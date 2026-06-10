# M29 — 3 bugs onboarding conveniada Santi (Fase 2 Opção B) + ajustes P3 reviewers + smoke E2E + dois sprints enfileirados

## TL;DR

Sessão Code maratona fechou os 3 bugs de onboarding da conveniada Santi mapeados em Fase 1 read-only no M28 (lote silenciosamente "ENVIADO" / UI não refresh em GestaoConvitesSection / UC não aparece em membros-pendentes), aplicou 2 ajustes P3 convergentes dos reviewers `cooperebr-multitenant-reviewer` + `cooperebr-financeiro-token-reviewer` (where cooperativaId explícito + carregar async admin), catalogou 2 débitos P3 derivados (spec integração `processarFilaWa` + label amigável da distribuidora) e validou o caminho ponta-a-ponta via smoke E2E HTTP real (login Santi → troca contexto empresa_conveniada → POST lote → fila WA → status: 1 ENVIADO whitelist + 1 FALHOU `whitelist-dev`). **8 commits trabalho + 1 fechamento.** Stack rebuildado uma única vez no fim (backend + frontend) + WhatsApp service subido pra smoke do disparo real. Em paralelo, 2 sprints foram enfileirados em memória persistente sem código: **Sprint Clube Unificado + CooperToken P1** (7 fases — hub→F1.5 economia→F2 compra→F4 uso→F3 distribuição→F6 resgate→Fatia A nomenclatura) e **Sprint Hardening Mass-Write SUPER_ADMIN P2** (rebaixado pelo Clube). **Regra de Coerência Sistêmica** (MAPA DE IMPACTO em 5 dimensões em cada Fase 1) catalogada como inegociável global. Específicas conhecidas por fase do Clube já anotadas (caça TAXA chumbada, oxidação só prospectiva com gate jurídico, backfill flag estabelecimento, F5 = mass-write reusa controles do Hardening).

## Marco entregue

**M29 — Fase 2 Opção B Santi completa (Bugs A+B+C) + ajustes P3 reviewers + smoke E2E + 2 sprints enfileirados**

## Commits do dia (8 trabalho)

| Hash | Tipo | Marco |
|---|---|---|
| `ae982e3` | docs | wa-bot-agent.md órfão M26 (carry-over inicial pré-abertura) |
| `56b7666` | fix | **Bug A** — `enviarLinkPorWhatsapp` propaga FALHOU + motivo do sender (helper compartilhado conserta individual + lote + reenvio). 5 specs novos. |
| `747cfbe` | fix | **Bug B** — `refreshKey?: number` em GestaoConvitesSection + MembrosPendentesSection + parents (conveniada + admin) bumpam em `carregarComBump` |
| `2b0e9a0` | fix | **Bug C** — `listarPendentes` expõe `cooperado.ucs[]` + `cotaKwhMensal`; helper UI `UcResumo` trata 4 casos (0/1 NORMAL/1 SINTETICA/N>1 "+N UCs"). 3 specs novos. |
| `78b7a82` | fix | **C-1** (reviewer) — `where: { cooperativaId }` explícito no select aninhado de `ucs` (defense in depth) + spec anti-regressão |
| `3789bed` | fix | **B-1** (reviewer) — `carregar()` async + `await` em `carregarComBump` no admin (espelha conveniada, elimina race) |
| `bdbdeba` | docs | **A-1 + C-2** catalogados como P3 em `debitos-tecnicos.md` (spec integração `processarFilaWa` + label amigável distribuidora) |
| `2d62b09` | test | smoke E2E `backend/scripts/smoke-bug-a-lote-santi.ts` (login Santi → lote 2 dest → status: 1 ENVIADO + 1 FALHOU `whitelist-dev`) |

## Entregas técnicas (resumo)

### Bug A — `enviarLinkPorWhatsapp` propaga FALHOU + motivo (`56b7666`)

`waSender.enviarMensagem` retorna `WhatsappEnvioResult` que em DEV/whitelist resolve com `{enviado:false, motivo:'whitelist-dev'}` SEM throw. Helper antigo ignorava o retorno e marcava `enviado:true` quando não-throws → lote gravava `loteEnvioWaStatus='ENVIADO'` mentiroso. Fix em `convites-convenio.service.ts:1047-1075` propaga `{enviado:false, erro:motivo}` quando sender retorna `enviado:false`. Reenvio (controllers `:891` admin + `:355` portal-empresa) ganhou captura do retorno e expõe `whatsappEnviado`/`whatsappErro` na response. Indiv (criar) já consumia retorno → propaga automaticamente. Lote (`processarFilaWa:573`) já gravava ENVIADO/FALHOU baseado em `envio.enviado` → reflete realidade agora.

### Bug B — refreshKey externo (`747cfbe`)

Prop nova `refreshKey?: number` em `GestaoConvitesSection` + `MembrosPendentesSection` + dep array do `useEffect` inclui `refreshKey`. Parents (`conveniada/convenio/[id]/page.tsx` + `dashboard/convenios/[id]/page.tsx`) ganham state `refreshKey` + helper `carregarComBump` que re-fetcha dashboard e bumpa `refreshKey` em sequência. Todo `onAcaoConcluida` aponta pro bump em vez de `carregar` direto. Padrão simples (sem forwardRef + imperativeHandle), preserva state interno das seções (paginação/filtros).

### Bug C — `ucs[]` + `cotaKwhMensal` na listagem (`2b0e9a0`)

Backend `convenios-aprovacao.service.ts:listarPendentes` expandiu select de `cooperado` com `cotaKwhMensal` (Decimal → Number na serialização) + `ucs` (id, numero, tipoUc, numeroUC, numeroConcessionariaOriginal, distribuidora). Tenant assertion preservada via `assertConvenioDoTenant` no topo do método. Frontend `MembrosPendentesSection` ganhou tipo `UcDoCooperado[]` + helper componente `UcResumo` que trata 4 casos: 0 UCs (amber "sem UC"), 1 UC NORMAL ("UC <numeroUC|numero> · <distribuidora>"), 1 UC SINTETICA (slate "UC sintética (sem fatura)"), N>1 UCs ("UC <primeira> · +<N-1> UCs · <distribuidora|múltiplas>"). Cota mensal renderizada ao lado.

### C-1 — `where cooperativaId` explícito no select aninhado de `ucs` (`78b7a82`)

Reviewer multitenant + financeiro-token convergiram: `assertConvenioDoTenant` no topo já escopa por tenant e invariante garante `Uc.cooperativaId == Cooperado.cooperativaId == ContratoConvenio.cooperativaId`, mas tornar o filtro explícito no select aninhado torna a regra independente do invariante (resiste a refator/desnormalização futura). Coerência sistêmica aplicada: grep amplo confirmou que `MembrosPendentesSection.tsx` é o único consumidor frontend do shape `MembroPendente.cooperado`; `listarPendentesGlobal` em `convenios.service.ts:592` é função homônima de outro contexto (convênios GLOBAL pendentes, não membros) — zero impacto.

### B-1 — `carregar()` async + `await` admin (`3789bed`)

Admin dashboard tinha `carregar()` com Promise pendurada (`.then().finally()`) e `carregarComBump()` chamava sem `await` → `setRefreshKey` disparava antes do dashboard re-fetchar. Race silenciosa: seções irmãs ainda recarregavam pelo bump, mas o convênio em si podia mostrar dados velhos por alguns ms. Padrão alinhado com a conveniada.

### A-1 + C-2 — débitos P3 catalogados (`bdbdeba`)

- **D-novo-LOTE-PROCESSAR-FILA-INTEGRACAO** (P3): spec end-to-end do `processarFilaWa` (background `setImmediate`) confirmando `loteEnvioWaStatus='FALHOU'` no banco em DEV. Hoje cobertura é helper isolado + smoke manual; spec automatizada é redundância (~30min Code).
- **D-novo-LABEL-DISTRIBUIDORA-UI** (P3): `UcResumo` exibe enum cru `EDP_ES`. Centralizar em `web/lib/distribuidora-label.ts` (~1h Code). UX-polishing, não bloqueia.

### Smoke E2E `2d62b09`

Script `backend/scripts/smoke-bug-a-lote-santi.ts` (excluído do build, roda via ts-node) fez login Santi (`lucbragatto+santi@gmail.com` / `Santi@2026`) → trocou contexto empresa_conveniada (convênio `cmq6qo5ly0007va2w6hilvs2a`) → POST `/portal/meus-convenios/:id/convites/lote/enviar` com 2 destinatários (whitelist `5527981341348` + não-whitelist `27999111222`) → aguardou 7s (throttle 2s × 2 + margem) → GET status do lote → assertiva 1 ENVIADO + 1 FALHOU com `erro='whitelist-dev'`. Resultado:

```
[smoke]    resumo: { total: 2, pendente: 0, enviado: 1, falhou: 1 }
[smoke]      • Smoke Whitelist        | ......1348 | ENVIADO  | erro=-
[smoke]      • Smoke Nao Whitelist    | ......1222 | FALHOU   | erro=whitelist-dev
[smoke] 🟢 SMOKE PASS — Bug A end-to-end OK
```

WhatsApp real chegou no número do Luciano; não-whitelist bloqueado em DEV gravou status honesto. Antes do fix, ambos teriam mostrado ENVIADO mentiroso.

## Bugs resolvidos / catalogados

| # | Severidade | Origem | Fix | Status |
|---|---|---|---|---|
| Bug A — lote silenciosamente ENVIADO | P1 | M28 mapeado | helper propaga FALHOU + motivo | RESOLVIDO `56b7666` |
| Bug B — UI não refresh em GestaoConvites | P2 | M28 mapeado | refreshKey externo | RESOLVIDO `747cfbe` |
| Bug C — UC/cota não aparecem em pendentes | P2 | M28 mapeado | select expandido + UcResumo | RESOLVIDO `2b0e9a0` |
| C-1 — where cooperativaId implícito no select de ucs | P3 | reviewer convergente | where explícito + spec | RESOLVIDO `78b7a82` |
| B-1 — race carregar admin sem await | P3 | reviewer | async/await espelha conveniada | RESOLVIDO `3789bed` |
| A-1 — spec integração `processarFilaWa` ausente | P3 | reviewer | catalogado | CATALOGADO `bdbdeba` |
| C-2 — label amigável distribuidora | P3 | reviewer | catalogado | CATALOGADO `bdbdeba` |

## Decisões catalogadas

3 memórias persistentes novas criadas nesta sessão:

1. **`sprint_hardening_mass_write_super_admin_10_06.md`** (catalogada na abertura) — Sprint enfileirado classe "SUPER_ADMIN Mass Write Cross-Tenant por Design" — M1 lead-expansao + M2 motor-proposta reajuste + M3 saas propagarPlano + M4 cooperados bulk + M5 migracoes-usina total + M6? whatsapp-fluxo-motor. Confirm/dryRun/cap-200/log `CROSS_TENANT_MASS_WRITE`. **REBAIXADO a P2** quando Clube enfileirou.

2. **`sprint_clube_unificado_cooper_token_10_06.md`** — Sprint **P1** enfileirado: 7 fases (Hub frontend → F1.5 Taxa de Operação + Oxidação → F2 empresa-PJ-cooperada compra → F4 funcionário usa/transfere → F5 empresa distribui (LOTE/INDIVIDUAL + CLT 458) → F6 estabelecimento resgata (recibo, NÃO recompra; flag `Cooperado.ehEstabelecimento`) → Fatia A nomenclatura CTK→CooperToken + dois rios kWh×token). Token=VOUCHER fechado, PROIBIDO token→sobra. Roda DEPOIS de M29.

3. **`regra_coerencia_sistemica_mapa_impacto_10_06.md`** — INEGOCIÁVEL global. Cada Fase 1 read-only de TODO sprint entrega **MAPA DE IMPACTO** em 5 dimensões (Consumidores grep / Dados Existentes SELECT / Propagação DTO+types+queries+telas+relatórios+jobs+extrato / Navegação sem deep-link órfão / Re-Teste fluxos listados) antes de implementar. Pausa pro OK explícito. Anota consequências específicas conhecidas por fase do Clube (hub mantém rotas antigas; F1.5 ripple TAXA chumbada + oxidação só prospectiva + gate jurídico; F3/F4/F6 todos relatórios + dois rios; F5 = SUPER_ADMIN MASS WRITE reusa controles do Hardening; F-D backfill `ehEstabelecimento=false` em todos cooperados).

**Cross-references estabelecidas:**
- Fase 5 do Sprint Clube (distribuição lote) = mass-write → consome controles do Sprint Hardening; quem rodar primeiro cria o helper `assertMassWriteConfirmation`, o outro reusa.
- Fase 2 (F1.5) tem **gate jurídico explícito** antes de ligar oxidação em dados reais (política de quebra escrita+aprovada + auditoria do que seria oxidado).

## Pendências abertas pra próxima sessão

**Próximo passo único e claro:** **Arrancar Sprint Clube Unificado P1 — Fase 1 (HUB).** Prompt empacotado pelo orquestrador em `docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md` (pronto pra colar no Code; já contém PASSO 0 + regras inegociáveis dinheiro/token + regra de coerência sistêmica + 7 fases + consequências conhecidas).

**Carry-overs desta sessão:**
- 2 convites de smoke no banco do convênio Santi (loteId `6a84832d13679547071f6964`): "Smoke Whitelist" + "Smoke Nao Whitelist". **Artefatos de smoke, mantidos** — convênio tem `ambienteTeste=true`, sem impacto em relatório. Limpa na **Sprint Housekeeping**.
- Sprint Clube Unificado P1 enfileirado (memória + prompt em `docs/relatorios/`).
- Sprint Hardening Mass-Write P2 rebaixado, aguarda fim do Clube.
- Regra de Coerência Sistêmica inegociável global (aplicar em TODOS sprints daqui pra frente, retroativa em adendos M29 se reviewer apontar).

**Carry-overs M27/M26/M28 ainda vivos** (não-bloqueantes):
- D-novo-WA-PHONE-NORMALIZE P2 (matcher telefone amplo).
- 3 ações WA declaradas sem implementação (`PROCESSAR_OCR`, `MOSTRAR_MENU_PRINCIPAL`).
- 17 modelos BOT órfãos.
- `empresa_conveniada` / `proprietario_usina` iterando só `cooperados[0]`.
- Fase 3 Token-WA (TokenTransacao + QR pagamento real) — pausa explícita, retomada DEPOIS do Clube.
- Untracked acumulados em `backend/scripts/`, `backend/src/agents/`, `docs/RECOMENDACAO-ARQUITETURA-FINAL.md`, `docs/arquitetura-agentes-pkm-cooperebr.md`, `tmp_smoke_check.mjs` — **Sprint Housekeeping** futuro.
- 218 membros parciais (segmentação pendente — carry-over M24/M25).

## Regras aplicadas na sessão

- **Decisão 23** (validação prévia rigorosa): PASSO 0 detectou anomalias logo na abertura (arquivo modificado órfão + PM2 vazio), pausou e reportou.
- **Fase 1 read-only confirmatória** antes de cada commit (`feedback_fase1_readonly_obrigatoria`).
- **Multi-tenant**: `cooperativaId` do JWT preservado em todos os pontos; `assertConvenioDoTenant` no `listarPendentes`; controllers via `req.user.cooperativaId` (admin) / `req.empresa.cooperativaId` (portal); C-1 reforça com `where: { cooperativaId }` no select aninhado.
- **Contatos de teste impreteríveis**: smoke usou `5527981341348` (whitelisted Luciano) + `27999111222` (não-whitelist legítimo, fora dos prefixos fake) — zero disparo real pra contato não-autorizado.
- **`isAmbienteReal()`** (não `NODE_ENV`) — guards de whitelist funcionando como esperado em DEV.
- **Arredondamento monetário**: N/A nesta sessão (Bug C expôs `cotaKwhMensal` Decimal → Number, sem mutação).
- **Specs verdes obrigatórias**: 29/29 + 27/27 verde; TSC --noEmit web exit 0.
- **Rebuild PM2 único no fim** (não entre commits): backend stop → build → restart; frontend build → restart; WhatsApp start via ecosystem.
- **Decisão 24**: frase de retomada em local único (CONTROLE-EXECUCAO + este doc).
- **Regra não-paralelo com Code**: 2 sprints enfileirados via catalogação em memória + relatório, **sem código** — Code só executa o sprint atual, próximos sprints esperam fila.
- **Regra de Coerência Sistêmica** catalogada como inegociável durante a própria sessão — Code aplicou retroativamente em C-1 (grep amplo de consumidores do shape `MembroPendente.cooperado` antes de mexer no select).

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` (## ONDE PARAMOS topo — M29 + ## FRASE COMANDANTE).
- `docs/sessoes/2026-06-10-bugs-onboarding-santi-fase-2-opcao-b.md` (esta sessão).
- `docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md` (prompt empacotado pra colar).
- `~/.claude/projects/C--Users-Luciano-cooperebr/memory/regra_coerencia_sistemica_mapa_impacto_10_06.md` (regra inegociável aplicar em CADA Fase 1).
- `~/.claude/projects/C--Users-Luciano-cooperebr/memory/sprint_clube_unificado_cooper_token_10_06.md` (detalhamento das 7 fases).
- `~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md` (modelo fundacional — voucher/sobra/resgate, dois rios kWh×token).

## Doc-sessão M29

`docs/sessoes/2026-06-10-bugs-onboarding-santi-fase-2-opcao-b.md`

## FRASE COMANDANTE — próxima sessão Code (Sprint Clube Unificado P1, Fase 1 HUB)

PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior). Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents. Se não aparecer, parar e avisar.

2. Rodar `git status --short` (diretriz inegociável 18/05). Esperado pós-fechamento M29: working tree limpo (untracked carry-overs catalogados pra Sprint Housekeeping futuro); último commit é o de fechamento M29.

3. Rodar `pm2 list`. Esperado: `cooperebr-backend` + `cooperebr-frontend` + `cooperebr-whatsapp` online (3000/3001/3002 LISTENING) — orquestrador subiu stack após Fase 2 Opção B. Toda mudança em `web/` exige rebuild (`next start` sob PM2, sem HMR). M29 deixou em runtime os fixes M29.

PASSO 1 — Frase comandante (arrancar Sprint Clube Unificado P1, Fase 1 HUB):

Sessão 10/06 entregou M29 em 8 commits (`56b7666..2d62b09` + ajustes P3 + smoke + catálogo débitos): 3 bugs onboarding conveniada Santi (Bug A helper `enviarLinkPorWhatsapp` propaga FALHOU+motivo / Bug B `refreshKey?: number` externo em GestaoConvitesSection+MembrosPendentesSection / Bug C `listarPendentes` expõe `cooperado.ucs[]`+`cotaKwhMensal` com helper `UcResumo` tratando N>1) + 2 ajustes P3 reviewers convergentes (C-1 `where: { cooperativaId }` explícito no select aninhado de ucs + B-1 `carregar()` async/await admin) + 2 débitos P3 catalogados (D-novo-LOTE-PROCESSAR-FILA-INTEGRACAO + D-novo-LABEL-DISTRIBUIDORA-UI) + smoke E2E HTTP real (login Santi → POST lote → 1 ENVIADO whitelist + 1 FALHOU `whitelist-dev`). 56/56 specs verde + TSC web exit 0. Rebuild PM2 único no fim (backend+frontend+WhatsApp). Reviewers `cooperebr-multitenant-reviewer` + `cooperebr-financeiro-token-reviewer` aprovaram zero P0/P1/P2. **2 sprints enfileirados em memória sem código** — **Sprint Clube Unificado + CooperToken P1** (próxima sessão) e Sprint Hardening Mass-Write SUPER_ADMIN P2 (rebaixado, aguarda Clube). **Regra de Coerência Sistêmica** catalogada como inegociável global (MAPA DE IMPACTO em 5 dimensões em CADA Fase 1).

ARRANCAR: **Sprint Clube Unificado P1 — Fase 1 HUB** conforme prompt empacotado pelo orquestrador em `docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md`. Sequência: F1 hub frontend (baixo risco, sem backend) → F1.5 config economia (Taxa Operação + Oxidação, ripple alto: gate jurídico antes de oxidação real) → F2 empresa-PJ-cooperada compra → F4 funcionário usa/transfere → F3 empresa distribui (mass-write reusa controles do Hardening) → F6 estabelecimento resgata (recibo, NÃO recompra; flag `Cooperado.ehEstabelecimento`) → Fatia A nomenclatura. Cada fase começa com Fase 1 read-only + MAPA DE IMPACTO 5 dimensões → PAUSAR pro OK → implementar → specs verdes.

DIRETRIZES INEGOCIÁVEIS preservar (área dinheiro/token):
- Token = VOUCHER de circuito fechado; cooperativa = emissora única.
- Saída de valor: estabelecimento = **RESGATE/liquidação** (recibo, SEM NF) — NUNCA "recompra". Cooperado = SOBRA. **PROIBIDO token→sobra**.
- Multi-tenant: `cooperativaId` SEMPRE do JWT; toda query Prisma filtra `cooperativaId`.
- Transferência/uso de token: PIN/OTP + `$transaction Serializable` + idempotência (jti).
- Monetário: `Math.round(x*100)/100`.
- Disparo real (WA/email): SÓ whitelisted (`5527981341348` / `lucbragatto+sufixo@gmail.com`) + `ambienteTeste=true`.
- Reportar ao orquestrador ao fim de CADA fase que toca dinheiro/token → reviewers `cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer` antes do push.

PRÉ-REQUISITOS LEITURA (mapear, NÃO codar):
1. `docs/CONTROLE-EXECUCAO.md` (## ONDE PARAMOS topo — M29).
2. `docs/sessoes/2026-06-10-bugs-onboarding-santi-fase-2-opcao-b.md` (M29 — esta sessão).
3. `docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md` (PROMPT EMPACOTADO — colar verbatim ou seguir as 7 fases).
4. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/regra_coerencia_sistemica_mapa_impacto_10_06.md`.
5. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/sprint_clube_unificado_cooper_token_10_06.md`.
6. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md`.
7. `web/app/dashboard/layout.tsx` linhas 111-150 (6 itens espalhados do menu — escopo da Fase 1 HUB).
8. CLAUDE.md + .claude/CLAUDE.md.

ESTADO DE FILA (Decisão 24):
- M29 ✅ entregue.
- **PRÓXIMO: Sprint Clube Unificado P1** (Fase 1 HUB → ... → Fatia A nomenclatura).
- Sprint Hardening Mass-Write SUPER_ADMIN P2 (rebaixado, aguarda fim do Clube).
- Sprint Housekeeping (cleanup smokes Santi + scripts órfãos + .claude/agents/ + worktrees) — slot oportunístico futuro.
