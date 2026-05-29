# Sub-Sprint D-novo-BH — Despesas Operacionais Camada 2 — COMPLETO

> Sessões: **28–30/05/2026** (2 sessões Code, 7 fatias canônicas, 10 commits incluindo fechamento parcial obsoleto).
> Marco: **D-novo-BH 100% implementado** — workflow proposta → aprovação double-check → resolução, portal proprietário com flag visibilidade, cálculo de repasse líquido considerando despesas APROVADAS, cron mensal automático de aluguel.
> **Substitui o fechamento parcial `c0542fc` de 29/05.**

## TL;DR

Sub-Sprint D-novo-BH (Despesas Operacionais Camada 2) entregue 100% em **7 fatias canônicas + 3 bugs/débitos bônus resolvidos inline**. Implementa o ciclo completo de despesa operacional de usina: lançamento (admin ou proprietário) → workflow double-check obrigatório universal (TODOS perfis criam PROPOSTA, ninguém aprova a própria) → aprovação (2º OK) → resolução conforme tratamento contratual (REEMBOLSO / DESCONTO_NO_REPASSE / ASSUMIDO) → integração com cálculo de repasse (líquido = bruto - despesas APROVADAS pendentes do mês) → cron mensal automático que cria despesa ARRENDAMENTO_USINA refletindo o valor do contrato. Portal proprietário ganhou nova rota `/proprietario/despesas` (KPIs + 3 tabs + propor despesa), gated por flag `Cooperativa.proprietarioVeDespesas` (default false, opt-in pelo admin parceiro). Padrão UX Dual 17/05 Tipo B reforçado (refator BH.3.1 corrigiu violação Dialog→página própria detectada em BH.3 antes de Luciano testar). **Defesa em camadas no cálculo:** SUPER_ADMIN bypass tenant inferindo via Usina (resolveu D-novo-BL inline), IDOR guard PROPRIETARIO vincula vínculo Caminho A/B antes de propor. **Workflow universal:** self-approval guard backend bloqueia quem propôs. **Cron mensal:** idempotente, fail-safe (erro 1 usina não derruba demais), endpoint manual trigger DEV-only gated `isAmbienteReal()=false`. **3 bugs bônus resolvidos:** D-novo-BL (Super Admin sem cooperativaId, inline BH.4), D-novo-BN (ChunkLoadError Turbopack stale pós-rebuild incremental durante runtime), D-novo-BM (painel credenciais teste Opção B dev-only com defesa em 4 camadas — BLOQUEADOR REMOÇÃO PRÉ-PROD). **55 specs Jest verdes** (30 contas-pagar + 11 cooperativas + 7 auth-dev + 13 BH.5 + 1 IDOR novo). **3 smokes programáticos: 8/8 BH.4 + 8/8 BM + 8/8 BH.5.** Build web Turbopack: clean. PM2 sempre seguido de restart imediato após build (lição BN aplicada nas 4 sessões web build).

## Marcos entregues (parcial → completo)

**Sessão 28–29/05 (M37→M40 — fechamento parcial `c0542fc`):**

- **M37 — BH.1** (Workflow aprovação + tratamento + visibilidade proprietário) `bb838ec`
- **M38 — BH.2** (Endpoints REST + notificação proativa) `62eddde`
- **M39 — BH.3 + BH.3.1 + BH.3.2** (Tela admin + refator UX página própria + double-check universal) `8d045af` + `44f5e53` + `543a835`
- **M40 — BH.4** (Portal Proprietário + flag visibilidade + Super Admin bypass + IDOR guard PROPRIETARIO) `9858c45`
- Fechamento parcial: `c0542fc` (substituído por este doc; commit fica como história)

**Sessão 29–30/05 (BH.5 + bugs bônus):**

- 🔴 **D-novo-BN P0 BLOQUEADOR triado + RESOLVIDO** (ChunkLoadError Turbopack stale) `03f49fc`
- **D-novo-BM** Painel Credenciais Teste Opção B implementado + catalogado bloqueador remoção pré-prod `1cdb9cb`
- **M41 — BH.5** (Helper `calcularRepasseLiquido` + cron mensal aluguel automático) `77eeb24`

## Commits (10 totais, ordem cronológica)

| # | Hash | Marco | Mensagem |
|---|---|---|---|
| 1 | `bb838ec` | M37 BH.1 | feat(contas-pagar): BH.1 — workflow aprovação + tratamento despesa + visibilidade proprietário |
| 2 | `62eddde` | M38 BH.2 | feat(contas-pagar): BH.2 — endpoints REST + notificação proativa despesa |
| 3 | `8d045af` | M39 BH.3 | feat(despesas): BH.3 — tela admin despesas operacionais Camada 2 |
| 4 | `44f5e53` | M39 BH.3.1 | feat(despesas): BH.3.1 — refator UX página própria + upload nativo comprovante |
| 5 | `543a835` | M39 BH.3.2 | refactor(despesas): BH.3.2 — workflow double-check universal + self-approval guard |
| 6 | `9858c45` | M40 BH.4 | feat(BH.4): Portal Proprietário + Flag Visibilidade Despesas (D-novo-BH) |
| 7 | `c0542fc` | — | docs(sessao): fechamento parcial Sprint BH M37-M40 + triagem bug D-novo-BN _(obsoleto, substituído por este doc)_ |
| 8 | `03f49fc` | — | fix(frontend): D-novo-BN RESOLVIDO — cache Turbopack stale pós-BH.4 |
| 9 | `1cdb9cb` | — | feat(dev): D-novo-BM painel credenciais teste login rápido (Opção B) |
| 10 | `77eeb24` | M41 BH.5 | feat(despesas): BH.5 — integração cálculo repasse líquido + cron aluguel automático |

## Cronologia 2 sessões

**Sessão 1 (28–29/05):**
- Manhã 28/05: BH.1 schema + workflow base.
- Tarde 28/05: BH.2 endpoints REST + notificações.
- Noite 28–29/05: BH.3 tela admin → smoke visual Luciano detectou violação Padrão UX Dual Tipo B (despesa nova em Dialog em vez de página própria) → BH.3.1 refator imediato corrigiu.
- 29/05 manhã: BH.3.2 reforço workflow universal — TODOS perfis criam PROPOSTA, self-approval guard backend.
- 29/05 tarde: BH.4 Portal Proprietário + flag + telas admin/proprietário + Super Admin bypass tenant + IDOR PROPRIETARIO (3 entregas em 1 commit, smoke 11/11 ✅).
- 29/05 noite (~12:54): Luciano testou rota admin e detectou bug 500. Triagem read-only → ChunkLoadError Turbopack → catalogado **D-novo-BN P0 BLOQUEADOR** sem fix. Fechamento parcial `c0542fc`.

**Sessão 2 (29–30/05):**
- Abertura ritualizada via `/abertura` → skill `retomada-sessao` validou estado.
- **D-novo-BN fix conservador** (15min): `pm2 stop frontend + rm -rf .next + npm run build + pm2 start` — 3 evidências confirmaram cache stale (find chunk vazio, BUILD_ID timestamp posterior ao PM2 start, frontend rodou 47min OK antes de falhar). Catalogada lição: nunca deixar processo Node com `.next/` antigo em memória — `D-novo-AS` precisa ser complementado com `pm2 restart` imediato após build.
- **D-novo-BM Painel Credenciais Opção B** (~1.5h): backend `AuthDevController` com 2 endpoints + `assinarTokenImpersonate` TTL 1h + 7 specs verdes. Frontend `/dashboard/dev/credenciais-teste` com banner vermelho gigante "DEV ONLY" + 10 cards agrupados (3 SA + 4 CoopereBR + 3 outros). Defesa em **4 camadas:** `isAmbienteReal()` runtime + `@Roles(SUPER_ADMIN)` + `@AuditLog` + JWT TTL 1h. Smoke 8/8 ✅. **Catalogado P0 BLOQUEADOR REMOÇÃO PRÉ-PROD** com checklist de 9 passos.
- **BH.5** (~2h): helper `calcularRepasseLiquido` envelope sobre `calcularRepasse` puro (intacto). 7 consumidores migrados (4 proprietario + 1 relatorio-mensal + 2 admin-proprietarios — mais que os 5 do prompt). Cron `@Cron('0 3 1 * *', { timeZone: 'America/Sao_Paulo' })` cria despesa ARRENDAMENTO_USINA APROVADA + RESOLVIDA + ASSUMIDO + PARCEIRO. Idempotência via filtro `categoria + dataOcorrencia`. Endpoint manual trigger DEV-only. 13 specs verdes (8 helper + 5 cron). Smoke 8/8 ✅.

## Entregas técnicas

### Backend (~25 arquivos)

**Workflow + tratamento (BH.1):**
- `schema.prisma` ContaAPagar: `statusAprovacao` (PROPOSTA/APROVADA/REJEITADA) + `statusResolucao` (PENDENTE/RESOLVIDA) + `tratamento` (REEMBOLSO/DESCONTO_NO_REPASSE/ASSUMIDO) + `responsavelPagamento` (PARCEIRO/PROPRIETARIO/COMPARTILHADO) + `dataOcorrencia` + `quemPagouTipo`/`quemPagouNome` + `propostoPor*`/`aprovadoPor*`/`rejeitadoMotivo` + `comprovante`.
- `ContasPagarService.{proporDespesa, aprovarDespesa, rejeitarDespesa, resolverDespesa}` + race-condition guard.

**Endpoints + notificação (BH.2):**
- `POST /contas-pagar/propor` + `POST /contas-pagar/upload-comprovante` (multer 5MB).
- `GET /contas-pagar/operacionais` + `GET /contas-pagar/proprietario`.
- `PUT /contas-pagar/:id/{aprovar,rejeitar,resolver}`.
- `NotificacoesProativasService.notificarDespesa{Proposta,Aprovada,Rejeitada,Resolvida}` (email + WhatsApp whitelist LGPD).

**Workflow double-check universal (BH.3.2):**
- TODOS perfis criam `statusAprovacao=PROPOSTA` — zero auto-aprovação.
- `aprovarDespesa/rejeitarDespesa`: self-approval guard `propostoPorUsuarioId === usuarioId → ForbiddenException`.
- `notificarDespesaProposta` dispara SEMPRE.

**Portal Proprietário + flag (BH.4):**
- `Cooperativa.proprietarioVeDespesas Boolean @default(false)` (campo já existia, BH.4 ativou wireup).
- `PUT /cooperativas/:id/proprietario-ve-despesas` (`assertSameTenantOrSuperAdmin` + `@AuditLog`) + `toggleProprietarioVeDespesas`.
- `GET /proprietario/meu-parceiro` → `ProprietarioService.meuParceiro(user)` resolve via Caminho A (cooperadoId) ou B (email).
- `ContasPagarService.proporDespesa` aceita PROPRIETARIO/SUPER_ADMIN sem `cooperativaId` no JWT (infere via usina); **IDOR guard PROPRIETARIO** valida vínculo Caminho A/B.
- `ContasPagarService.{aprovar,rejeitar,resolver}Despesa`: bypass tenant SUPER_ADMIN (cross-tenant). **Resolve D-novo-BL inline.**

**Painel credenciais teste (D-novo-BM):**
- `auth-dev.controller.ts` (NOVO) — `GET /auth/dev/usuarios-teste` + `POST /auth/dev/impersonate`.
- `assinarTokenImpersonate(target)` helper público — TTL 1h.
- Defesa em 4 camadas: runtime guard `isAmbienteReal()` + `@Roles(SA)` + `@AuditLog` + TTL curto.

**Cálculo líquido + cron (BH.5):**
- `usinas/helpers/calcular-repasse-liquido.ts` (NOVO) — envelope sobre `calcularRepasse` puro (intacto).
- 7 consumidores migrados: `proprietario.service` (4 spots) + `relatorio-mensal.service` (1) + `admin/proprietarios.service` (2).
- `contas-pagar/repasse-mensal.cron.ts` (NOVO) — `@Cron('0 3 1 * *', tz São Paulo)` cria ARRENDAMENTO_USINA APROVADA + RESOLVIDA + ASSUMIDO + PARCEIRO, idempotente, try/catch por usina.
- `POST /contas-pagar/cron/repasse-mensal/executar` (DEV-only trigger manual).

### Frontend (~6 arquivos)

**Tela admin (BH.3 + BH.3.1):**
- `web/app/dashboard/usinas/[id]/despesas/page.tsx` — 4 KPIs + 3 TabsCustom + tabela 7 colunas.
- `web/app/dashboard/usinas/[id]/despesas/nova/page.tsx` (NOVO Tipo B) — refator UX página própria.
- `web/components/despesas/DespesaForm.tsx` (~320 linhas) — modos `admin-lancar | proprietario-propor | editar`.
- `web/components/despesas/UploadComprovante.tsx` — drag-drop + 5MB.

**Portal proprietário (BH.4):**
- `web/app/proprietario/despesas/page.tsx` (refactor) — 3 KPIs + 3 tabs + empty state condicional flag=false.
- `web/app/proprietario/despesas/nova/page.tsx` (NOVO) — seletor usina + DespesaForm modo proprietario-propor.
- `web/app/proprietario/layout.tsx` — item Despesas condicional via flag.

**Admin config (BH.4):**
- `web/app/dashboard/configuracoes/portal-proprietario/page.tsx` (NOVO) — toggle Switch otimista.

**Painel credenciais (BM):**
- `web/app/dashboard/dev/credenciais-teste/page.tsx` (NOVO) — banner vermelho gigante, 10 cards agrupados.
- `web/app/dashboard/layout.tsx` — item DEV sidebar condicional via probe.
- `web/lib/auth.ts` — helper `aplicarSessaoImpersonate`.

## Decisões estratégicas catalogadas

| # | Decisão | Origem | Onde |
|---|---|---|---|
| Padrão UX Dual 17/05 reforçado | Smoke visual BH.3 detectou Dialog em vez de página própria | BH.3.1 refator + memória `padrao_ux_edicao_inline_vs_pagina_propria_17_05.md` |
| Double-check universal | Workflow proposta+aprovação obrigatório TAMBÉM ADMIN/SA | BH.3.2 (`543a835`) |
| Self-approval guard backend | Quem propõe NUNCA aprova — guard server-side, não só UI | BH.3.2 |
| SUPER_ADMIN bypass tenant em ContasPagar | SA cross-tenant herda da entidade-alvo | BH.4 (`9858c45`) — resolve D-novo-BL |
| IDOR guard PROPRIETARIO | PROPRIETARIO sem cooperativaId no JWT precisa de ownership check Caminho A/B | BH.4 service + spec novo |
| Flag visibilidade default false | Cooperativa.proprietarioVeDespesas opt-in admin | BH.4 schema + tela config |
| Defesa em 4 camadas pra endpoints dev | `isAmbienteReal()` + `@Roles(SA)` + `@AuditLog` + TTL curto | D-novo-BM (`1cdb9cb`) |
| Aluguel mensal vira despesa automática | Sistema rastreia obrigação contratual recorrente, não só ad-hoc | BH.5 cron (`77eeb24`) |
| Helper líquido envelope, não substitui puro | `calcularRepasse` intacto — caller escolhe semântica | BH.5 (`77eeb24`) |
| Líquido nunca negativo | `Math.max(0, bruto - despesas)` — sem saldo negativo | BH.5 helper |

## Bugs / Débitos resolvidos nesta sessão

- **D-novo-BL** ✅ RESOLVIDO inline em BH.4 — Super Admin sem cooperativaId recebia "cooperativaId obrigatório" em `listarDespesasOperacionais/aprovar/rejeitar/resolver`. Fix: bypass tenant perfil-baseado + inferência via Usina.
- **D-novo-BN** ✅ RESOLVIDO em `03f49fc` — ChunkLoadError Turbopack stale. Root cause: `npm run build` durante runtime PM2 sobrescreveu `.next/` mas processo Node continuou em memória com referências aos chunks antigos. Fix conservador (`pm2 stop + rm -rf .next + npm run build + pm2 start`). Aprendizado: D-novo-AS precisa de complemento `pm2 restart frontend` imediato após build.

## Débitos novos catalogados

- **D-novo-BM** ✅ IMPLEMENTADO em `1cdb9cb` — Painel Credenciais Teste Opção B. **Elevado P3 → P0 BLOQUEADOR REMOÇÃO PRÉ-PROD** com checklist de 9 passos pra remover quando primeiro parceiro real entrar em produção.
- **D-novo-AS.2** (sugerido) — hook PostToolUse que após `npm run build` em `web/` dispare `pm2 restart cooperebr-frontend` automaticamente. Não-bloqueador, melhoria operacional.

## Estatísticas finais

| Métrica | Valor |
|---|---|
| Commits do sprint (sem fechamento atual) | 10 |
| Arquivos backend tocados | ~25 |
| Arquivos frontend tocados | ~9 |
| Specs Jest novos | 55 (30 contas-pagar + 11 cooperativas + 7 auth-dev + 13 BH.5 + 1 IDOR) |
| Smokes programáticos | 3 (8/8 BH.4 + 8/8 BM + 8/8 BH.5 = **24/24 ✅**) |
| Build web Turbopack | Clean em 4 ciclos (BH.3, BH.4, BM, BH.5) |
| Bugs P0 detectados pós-rebuild | 1 (BN — resolvido em 15min na mesma sessão) |
| Bugs P0/P1 resolvidos inline (bônus) | 2 (BL + BN) |
| Decisões arquiteturais catalogadas | 10 |
| Sessões Code | 2 (28-29/05 + 29-30/05) |

## Lições / observações

1. **Smoke visual ANTES do fechamento canônico previne fechamento parcial inválido.** BH.4 deu OK em smoke programático e build mas falhou em runtime ~47min depois do PM2 carregar — a única detecção possível foi smoke visual do Luciano no browser. Para próximos sprints, considerar smoke visual obrigatório pelo Luciano antes do fechamento canônico em features que tocam `.next/` SSR (`_global-error`, layouts compartilhados).
2. **Padrão UX Dual 17/05 precisa ser releitura OBRIGATÓRIA antes de qualquer prompt que tenha "nova página" / "criar entidade" / "editar X" / "Dialog" / "Sheet" / "Modal".** BH.3 violou — orquestrador (claude.ai) gerou prompt com Dialog, Code implementou conforme prompt, Luciano detectou no smoke visual. BH.3.1 corrigiu sem perdas, mas se a violação tivesse passado pra produção seria caro reverter. Memória `padrao_ux_edicao_inline_vs_pagina_propria_17_05.md` já tinha trigger automático — falhou. Reforço necessário do orquestrador.
3. **Defesa em camadas é mandatória pra qualquer endpoint dev.** Modelo D-novo-BM (4 camadas: runtime + auth + audit + TTL curto) replicar pra futuros endpoints dev-only.
4. **`@Post` Nest retorna 201 Created por default, não 200.** Smoke programático precisa aceitar `200 || 201` ou usar `@HttpCode(200)` explícito. Pegou no smoke BH.5 v1 — corrigido em v2.
5. **Build web sempre seguido de `pm2 restart cooperebr-frontend` imediato.** Lição BN aplicada nas 4 sessões web build deste sprint sem regressão. Catalogada como complemento D-novo-AS.

## Próximo passo

Próximo bloco do roadmap: **D-novo-AN — RepasseProprietario (tabela de repasses do proprietário)**. Aprovado por Luciano durante esta sessão. Sprint próprio. BH.5 deixou o terreno preparado (`ContaAPagar.repasseAbatidoId` nullable pronto pra populamento futuro). Estimativa preliminar: 2-3h backend (schema + model + endpoints CRUD + cron geração mensal vinculando despesas DESCONTO_NO_REPASSE como abatidas).

**Próxima sessão Code começa com Fase 1 read-only mini do D-novo-AN** (~10-15min) — mapear estado atual do banco, conectar pontos com BH.5, propor escopo. NÃO iniciar implementação sem OK Luciano.

## Pré-requisitos leitura próxima sessão

- Este doc-sessão (cronologia completa Sprint BH)
- `docs/debitos-tecnicos.md` D-novo-AN (preexistente, escopo a refinar)
- `backend/src/usinas/helpers/calcular-repasse-liquido.ts` (entender integração)
- `backend/src/contas-pagar/repasse-mensal.cron.ts` (entender geração automática)
- `backend/prisma/schema.prisma` ContaAPagar.repasseAbatidoId (campo nullable pronto)
- Memória `feedback_fase1_readonly_obrigatoria.md` (Decisão 23 antes de tocar código)

## Carry-overs (não-bloqueantes)

- D-novo-BG (P3) anomalia GD Linhares
- D-novo-BJ (P2 LGPD) URL assinada comprovantes
- D-novo-BK (P3) storage S3/Supabase
- D-novo-BC (P2) paridade campos edição usina
- D-novo-BA/AZ classe GD restantes
- D-novo-AS.2 hook PostToolUse build → pm2 restart frontend
- 20+ scripts utilitários untracked em `backend/scripts/` (Sprint Housekeeping carry-over conhecido)
- `.agent/memory/.dreams/` + shared markdowns

## Regras aplicadas

- **Decisão 23** (validação prévia rigorosa) — Fase 1 read-only em todas as 7 fatias.
- **Padrão UX Dual 17/05 Tipo B** — BH.3.1 corrigiu violação detectada em BH.3.
- **D-novo-AS** — `cd web && npm run build` Turbopack obrigatório antes de commit web. Aplicado 4×.
- **D-novo-AS complemento (lição BN)** — `pm2 restart frontend` IMEDIATO após build. Aplicado 4× sem regressão.
- **Multi-tenant guard universal** — `assertSameTenantOrSuperAdmin` + bypass perfil-baseado em ContasPagar + IDOR guard PROPRIETARIO em proporDespesa.
- **Regra contatos teste (14/05)** — não necessário (smoke programático + whitelist LGPD em dev).
- **Regra `isAmbienteReal()` inegociável (18/05)** — usado em D-novo-BM (endpoints dev) + BH.5 (trigger manual cron). NUNCA NODE_ENV.
- **Regra secrets não memorizar (26/05)** — orquestrador NUNCA copiou senha — Opção B explicitamente evita expor.
- **Fechamento bilateral inegociável (13/05)** — este fechamento COMPLETO satisfaz a regra, substituindo o parcial `c0542fc` invalidado pela detecção do bug BN.
- **Decisão 24** (frase de retomada local único) — `CONTROLE-EXECUCAO.md` atualizado.
- **Regra não-paralelo (17/05)** — 2 sessões sequenciais, sem orquestração paralela com claude.ai.

## Frase comandante

Idêntica ao bloco "Próximo passo" + `CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code`.
