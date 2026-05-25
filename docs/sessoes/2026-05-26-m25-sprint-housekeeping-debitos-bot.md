# M25 — Sprint Housekeeping: 5 débitos limpos + 1 recategorizado — 26/05/2026

## TL;DR

Sprint Housekeeping fechou **6 dos 12 débitos D-novo-U a AF** acumulados no Sprint Bot Autoatendimento (M17→M24). **5 limpezas reais de código** (commits 2aeb4ed + 6945813 + a6c6e5c + 2ec0364) + **1 recategorização documental** (D-novo-Y, modelo `nps_trimestral` reservado pra Sprint NPS Trimestral futuro). Total: **~108 linhas líquido removidas** de `whatsapp-bot.service.ts` (4051 → 3943). 234/234 specs do motor verdes (suite não afetada — handlers hardcoded sem cobertura própria). Decisão Luciano 26/05 PRESERVOU `handleNegociacaoParcelamento` como placeholder enquanto Sprint Regra Parcelamento (D-novo-AD) não define a regra de negócio real. 6 débitos permanecem abertos (V, AA, AB, AD, AE, AF — sprints próprios ou pós-validação produção).

## Marco entregue

**M25 — Sprint Housekeeping (5 limpezas + 1 recategorização)**

## Commits do dia (6)

| Hash | Mensagem |
|---|---|
| `2aeb4ed` | fix(wa): Sprint Housekeeping — D-novo-U + D-novo-W (handler hardcoded ver fatura + NPS) |
| `6945813` | chore(wa): Sprint Housekeeping — D-novo-X (delete agendarNps dead code) |
| `a6c6e5c` | fix(wa): Sprint Housekeeping — D-novo-Z (alinha Cadastro Proxy hardcoded com motor) |
| `2ec0364` | chore(wa): Sprint Housekeeping — D-novo-AC PARCIAL (remove MENU_INADIMPLENTE dead code) |
| `b2808f0` | docs(debitos): Sprint Housekeeping — fecha D-novo-U/W/X/Z/AC + recategoriza D-novo-Y |
| (fechamento) | docs(sessao): fechamento M25 Sprint Housekeeping + atualiza CONTROLE-EXECUCAO |

## Entregas técnicas

### Commit `2aeb4ed` — D-novo-U + D-novo-W (handler hardcoded "Ver próxima fatura" + NPS)

**D-novo-U (5min)** — `whatsapp-bot.service.ts:793`:
- ANTES: `status: { in: ['PENDENTE', 'VENCIDO'] as any[] }` — bot respondia "sem faturas" mesmo com cobranças `A_VENCER` (canônico, 99% dos casos reais)
- DEPOIS: `status: { in: ['A_VENCER', 'PENDENTE', 'VENCIDO'] as any[] }` — defense in depth alinhada com `cobrancas.job.ts:45/130/216`
- Comentário inline preservado referenciando o débito resolvido

**D-novo-W (5min)** — `whatsapp-bot.service.ts:4037`:
- ANTES: `handleNpsNota` chamava `finalizarConversa(conversa.id)` → estado CONCLUIDO
- DEPOIS: `update({ estado: 'MENU_COOPERADO' })` — alinha hardcoded com motor Bloco 7 (M21)
- Comentário inline preservado

### Commit `6945813` — D-novo-X (delete `agendarNps` dead code)

- Método `agendarNps` (22 linhas) removido de `whatsapp-bot.service.ts:3994-4015`
- Zero callers confirmados via `grep -rn "agendarNps" backend/src/`
- Problemas eliminados: setTimeout frágil (PM2 restart perdia timer), texto hardcoded "CoopereBR" não multi-tenant
- Comentário inline (~7 linhas) preservado referenciando D-novo-X resolvido + redirecionando pra Sprint NPS Trimestral futuro

### Commit `a6c6e5c` — D-novo-Z (alinha Cadastro Proxy hardcoded)

- `handleConfirmarProxy` — 2 ocorrências (linhas ~3444 + ~3450) substituídas:
  - ANTES: `await this.resetarConversa(telefone)` (estado INICIAL)
  - DEPOIS: `await this.prisma.conversaWhatsapp.update({ where: { id: conversa.id }, data: { estado: 'MENU_COOPERADO' } })`
- Aplicado em ambos os caminhos: SUCESSO (cooperado cadastra amigo) + RECUSA ("não por enquanto")
- **Divergência 2 (cálculo de proposta) PRESERVADA** como degradação consciente — motor não calcula `economiaMensal`, hardcoded sim
- Comentário inline em cada ocorrência

### Commit `2ec0364` — D-novo-AC PARCIAL (remove MENU_INADIMPLENTE dead code)

**Removidos:**
- `case 'MENU_INADIMPLENTE'` do switch principal (linha 537)
- `async iniciarFluxoInadimplente` (53 linhas, 2674-2720) — zero callers confirmados
- `private handleMenuInadimplente` (75 linhas, 2722-2796) — sem caller, inalcançável

**PRESERVADO (decisão Luciano 26/05):**
- `case 'NEGOCIACAO_PARCELAMENTO'` no switch
- `handleNegociacaoParcelamento` método intacto
- `'NEGOCIACAO_PARCELAMENTO'` no `ESTADOS_FLUXO_ATIVO` whitelist
- Comentário inline (~20 linhas) referenciando D-novo-AC + D-novo-AD pendente

**Justificativa da preservação:** Luciano decidiu aguardar Sprint Regra Parcelamento (D-novo-AD, P1) pra definir a regra de negócio real. Workaround atual via motor `SOLICITAR_NEGOCIACAO_HUMANA` (Bloco 8 M24) cobre o fluxo conversacional.

**Síntese:** 128 linhas dead code removidas + 20 linhas comentário adicionadas = ~108 linhas líquido. Total `bot.service.ts`: 4051 → 3943 linhas.

### Commit `b2808f0` — Documentação `debitos-tecnicos.md`

Atualização dos status dos 6 débitos endereçados:

| Débito | Status novo | Observação |
|---|---|---|
| D-novo-U | ✅ RESOLVIDO | Commit `2aeb4ed` |
| D-novo-W | ✅ RESOLVIDO | Commit `2aeb4ed` |
| D-novo-X | ✅ RESOLVIDO | Commit `6945813` |
| D-novo-Y | ✅ RECATEGORIZADO | Reservado pra Sprint NPS Trimestral futuro |
| D-novo-Z | ✅ PARCIAL RESOLVIDO | Divergência 1 fechada; Divergência 2 preservada |
| D-novo-AC | ✅ PARCIAL RESOLVIDO | Dead code removido; `handleNegociacaoParcelamento` preservado |

## Validação

- **234/234 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts` (mesmo número de M24)
- `nest build` limpo após cada etapa (4 builds consecutivos OK)
- Working tree limpo entre etapas (commits pequenos sequenciais)
- Backend não foi reiniciado (sem necessidade — só código TypeScript, sem schema mudou)
- `whatsapp-bot.service.ts`: 4051 → 3943 linhas (-108)

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| D-novo-U | P2 UX | Handler hardcoded usava status PENDENTE inexistente em queries Cobranca | Defense in depth `['A_VENCER','PENDENTE','VENCIDO']` | ✅ RESOLVIDO |
| D-novo-W | P3 polimento | Divergência semântica hardcoded × motor pós-NPS | Hardcoded alinhado com motor (MENU_COOPERADO) | ✅ RESOLVIDO |
| D-novo-X | P3 limpeza | Dead code `agendarNps` (setTimeout frágil, zero callers) | Método removido | ✅ RESOLVIDO |
| D-novo-Z | P3 polimento | Cadastro Proxy hardcoded → INICIAL vs motor → MENU_COOPERADO | Hardcoded alinhado (ambos os caminhos) | ✅ PARCIAL (Divergência 1) |
| D-novo-AC | P2 limpeza | Dead code MENU_INADIMPLENTE (zero callers do iniciarFluxoInadimplente) | 128 linhas removidas, handleNegociacaoParcelamento preservado | ✅ PARCIAL (sem AD) |
| D-novo-Y | - | Modelo nps_trimestral órfão | Recategorizado como reuso futuro | ✅ RECATEGORIZADO |

## Decisões estratégicas catalogadas

### Decisão Luciano 26/05 #1 — D-novo-Y RECATEGORIZAÇÃO

Modelo `nps_trimestral` no seed **PERMANECE** (não delete). Reservado pra **Sprint NPS Trimestral futuro** (~2-4h estimado), reusa pattern Bloco 1.b (cron `@nestjs/schedule` + reuso WhatsappSenderService + decoração com `cooperativaId`). Sprint catalogado em memória orquestrador (claude.ai).

### Decisão Luciano 26/05 #2 — Preservar `handleNegociacaoParcelamento`

Em vez de remover junto com D-novo-AC (opção (i) do relatório Fase 1), Luciano decidiu **PRESERVAR** o handler placeholder. Justificativa: aguardar Sprint Regra Parcelamento (D-novo-AD P1) que vai definir a regra de negócio real e reaproveitar/reescrever o handler. Workaround atual via motor `SOLICITAR_NEGOCIACAO_HUMANA` cobre o fluxo enquanto isso.

**Sub-débito catalogado:** `handleNegociacaoParcelamento` ainda referencia internamente o estado `MENU_INADIMPLENTE` (linha ~2832), mas a transição é sobrescrita imediatamente por `finalizarConversa` → CONCLUIDO. Sem bug em produção.

## Próximo passo

Sprint Housekeeping fechado. **Próximo: Luciano escolhe entre 3 frentes paralelas restantes** (enquanto `script.sql` do hb06a não chega pro Sub-Sprint B ETL legado→novo):

1. **PAUSA TOTAL** — só retomar quando script.sql chegar
2. **Sprint Bot Proativo — Fase 1 read-only ampla** — mapeia infra de bot proativo (lembrete pré-vencimento, webhook pagamento, escalonação inadimplência)
3. **Análise profunda código Banestes do legado** — mapeia o que vai portar pro adapter `src/gateway-pagamento/banestes/`

A frente **Sprint Housekeeping** está concluída — não retorna ao menu de escolhas.

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` — ONDE PARAMOS + FRASE DE RETOMADA atualizada
- `docs/sessoes/2026-05-26-m25-sprint-housekeeping-debitos-bot.md` — esta sessão
- `docs/sessoes/2026-05-25-descoberta-legado-sisgdsolar-pivot-onboarding.md` — sessão claude.ai 24-25/05 (contexto Sub-Sprint B bloqueado)
- `docs/relatorios/2026-05-26-fase1-sprint-housekeeping-12-debitos.md` — Fase 1 read-only do Housekeeping
- `docs/debitos-tecnicos.md` — 6 débitos restantes (V, AA, AB, AD, AE, AF)
- `CLAUDE.md` raiz + `.claude/CLAUDE.md`

## Carry-overs (não-bloqueantes)

### 6 débitos D-novo-* restantes (de 12 originais)

| Débito | Severidade | Posicionamento | Motivo de não-execução |
|---|---|---|---|
| D-novo-V | P3 | Iniciativa Fluxos Customizáveis Fase 1 (~8-12h) | Scope maior, sprint próprio |
| D-novo-AA | P3 | Sprint próprio pós-Sinergia (~2-3h cron+UI ou 6-8h refator) | Volume baixo hoje |
| D-novo-AB | P2 | Pós-validação produção 1-2 sprints | Rollback de emergência |
| D-novo-AD | P1 | Sprint Regra Parcelamento (~12-20h, aguarda decisão produto) | Regra de negócio não definida |
| D-novo-AE | P2 | Pós-validação produção 1-2 sprints | Rollback de emergência |
| D-novo-AF | P3 | Pós-validação produção 1-2 sprints + ajuste 4 specs | Rollback fácil pro Bloco 3 |

### 2 sprints futuros catalogados nesta sessão

- **Sprint NPS Trimestral** (~2-4h) — modelo `nps_trimestral` reservado (D-novo-Y), pós-onboarding cooperebr1
- **Sprint Regra Parcelamento** (~12-20h) — D-novo-AD P1, aguarda decisão produto Luciano (regra Asaas parcelable / manual N cobranças / link humano)

### Sub-Sprint B (ETL legado→novo)

Aguardando script.sql do hb06a. Pré-requisitos verificados (Docker ✅, sqlcmd ❌ instalar quando for usar, porta 1433 ✅). Quando arquivo chegar, 8 etapas planejadas (~16-25h Code).

## Regras aplicadas na sessão

- ✅ Ritual de abertura: skill `retomada-sessao` invocada via /abertura
- ✅ Decisão 23 (Fase 1 read-only): aplicada antes da Etapa A — relatório `docs/relatorios/2026-05-26-fase1-sprint-housekeeping-12-debitos.md`
- ✅ Decisão 14 (validação prévia): grep amplo antes de cada delete (`agendarNps`, `iniciarFluxoInadimplente`) — zero callers confirmados
- ✅ Commits pequenos em português (5 commits de código + 1 commit doc + 1 commit fechamento = 7 total)
- ✅ Build limpo verificado após cada commit (4 builds Nest sequenciais OK)
- ✅ Suite Jest 234/234 verde antes do fechamento
- ✅ Bot não toca contatos reais — sessão só removeu/alinhou dead code, nada disparou
- ✅ NEVER force push / NEVER --no-verify
- ✅ Fechamento canônico em curso (skill `fechamento-sessao`)

## Frase comandante

> Frase canônica única em `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único, atualizada 26/05 fechamento M25 Sprint Housekeeping).
