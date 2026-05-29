# M37–M40 — Sub-Sprint BH (D-novo-BH) Despesas Operacionais Camada 2 — Fechamento PARCIAL

> Sessão: 28–29/05/2026 (consolidada — BH.1 → BH.4, 6 commits).
> Marco: **Workflow Despesas Operacionais funcional ponta-a-ponta** (proposta → aprovação double-check → resolução), com Portal Proprietário + Flag Visibilidade entregues. **BH.5 (integração cálculo repasse + cron aluguel) ainda PENDENTE.**
> **Fechamento PARCIAL** por bug bloqueador D-novo-BN detectado pós-BH.4.

## TL;DR

Sub-Sprint BH entregou 4 fatias canônicas (BH.1→BH.4) implementando o módulo Despesas Operacionais Camada 2 (D-novo-BH). **BH.1**: workflow PROPOSTA→APROVADA→REJEITADA + matriz de tratamento (REEMBOLSO/DESCONTO_NO_REPASSE/ASSUMIDO) + visibilidade do proprietário via `responsavelPagamento`. **BH.2**: endpoints REST `/contas-pagar/{operacionais,proprietario,propor,:id/aprovar,:id/rejeitar,:id/resolver}` + notificação proativa (email + WhatsApp via whitelist LGPD). **BH.3**: tela admin `/dashboard/usinas/[id]/despesas` com 4 KPIs + 3 TabsCustom (Pendentes/Aprovadas/Rejeitadas) + dialog lançar. **BH.3.1**: refator UX página própria `/dashboard/usinas/[id]/despesas/nova` (corrigindo violação Padrão UX Dual Tipo B 17/05) + componente `DespesaForm` reusável + `UploadComprovante` drag-drop 5MB. **BH.3.2**: workflow double-check UNIVERSAL — TODOS perfis criam PROPOSTA (zero auto-aprovação), self-approval guard em backend bloqueia quem propôs. **BH.4**: Portal Proprietário com refator `/proprietario/despesas` consumindo `/contas-pagar/proprietario` + nova rota `/proprietario/despesas/nova` (seletor usina + DespesaForm modo proprietario-propor) + flag `Cooperativa.proprietarioVeDespesas` (default false) controlando visibilidade do menu via `/proprietario/meu-parceiro` + tela admin `/dashboard/configuracoes/portal-proprietario` com toggle Switch. Bônus BH.4: **bug Super Admin sem cooperativaId fixa em `listarDespesasOperacionais/aprovar/rejeitar/resolver`** resolvido (D-novo-BL fechado inline) + **IDOR guard PROPRIETARIO** em `proporDespesa` (PROPRIETARIO precisa estar vinculado à usina via Caminho A ou B). **42 specs Jest verdes** (30 contas-pagar + 11 cooperativas + 1 IDOR PROPRIETARIO novo). Smoke programático BH.4: 11/11 ✅. Build web Turbopack: clean.

**Bug detectado pós-fechamento BH.4 (12:54:04):** ChunkLoadError em `/dashboard/usinas/[id]/despesas` — chunk Turbopack `cooperebr_web_d9a3a872._.js` inexistente no disco, originado em `_global-error/page.js`. Backend sem erro correlato. Hipótese: cache `.next/` corrupto pós rebuild incremental, NÃO regressão de código. Catalogado **D-novo-BN P0 BLOQUEADOR** — prioridade #1 da próxima sessão Code.

## Marco entregue (parcial)

- **M37 — BH.1** (Workflow aprovação + tratamento + visibilidade proprietário)
- **M38 — BH.2** (Endpoints REST + notificação proativa)
- **M39 — BH.3 + BH.3.1 + BH.3.2** (Tela admin + refator UX página própria + double-check universal)
- **M40 — BH.4** (Portal Proprietário + flag visibilidade + Super Admin bypass + IDOR guard)

**Pendente Sub-Sprint BH:**
- **BH.5** (Integração cálculo repasse considerando despesas aprovadas + cron aluguel automático) — ~1.5-2h backend.

## Commits da sessão (6, bb838ec..9858c45)

| Hash | Marco | Mensagem |
|---|---|---|
| `bb838ec` | M37 BH.1 | feat(contas-pagar): BH.1 — workflow aprovação + tratamento despesa + visibilidade proprietário |
| `62eddde` | M38 BH.2 | feat(contas-pagar): BH.2 — endpoints REST + notificação proativa despesa |
| `8d045af` | M39 BH.3 | feat(despesas): BH.3 — tela admin despesas operacionais Camada 2 |
| `44f5e53` | M39 BH.3.1 | feat(despesas): BH.3.1 — refator UX página própria + upload nativo comprovante |
| `543a835` | M39 BH.3.2 | refactor(despesas): BH.3.2 — workflow double-check universal + self-approval guard |
| `9858c45` | M40 BH.4 | feat(BH.4): Portal Proprietário + Flag Visibilidade Despesas (D-novo-BH) |

## Entregas técnicas

### BH.1 — Workflow aprovação + tratamento (`bb838ec`)

- Schema: `ContaAPagar` ganhou `statusAprovacao` (PROPOSTA/APROVADA/REJEITADA), `statusResolucao` (PENDENTE/RESOLVIDO/CANCELADO), `tratamento` (REEMBOLSO/DESCONTO_NO_REPASSE/ASSUMIDO), `responsavelPagamento` (PARCEIRO/PROPRIETARIO/COMPARTILHADO), `dataOcorrencia`, `quemPagouTipo`/`quemPagouNome`, `propostoPorUsuarioId`/`aprovadoPorUsuarioId`/`aprovadoEm`/`motivoRejeicao`, `comprovante`.
- `ContasPagarService.proporDespesa` + `aprovarDespesa` + `rejeitarDespesa` + `resolverDespesa` + race-condition guard via checagem `statusAprovacao === 'PROPOSTA'`.
- Visibilidade do proprietário: query `listarDespesasProprietario` filtra `responsavelPagamento IN ('PROPRIETARIO','COMPARTILHADO')`.

### BH.2 — Endpoints REST + notificação proativa (`62eddde`)

- `POST /contas-pagar/propor` (SA/ADMIN/OPERADOR/PROPRIETARIO).
- `POST /contas-pagar/upload-comprovante` (multer, 5MB).
- `GET /contas-pagar/operacionais` (admin lista) + `GET /contas-pagar/proprietario` (proprietário lista).
- `PUT /contas-pagar/:id/aprovar` + `PUT /contas-pagar/:id/rejeitar` + `PUT /contas-pagar/:id/resolver`.
- `NotificacoesProativasService.notificarDespesaProposta/Aprovada/Rejeitada/Resolvida` — email + WhatsApp (whitelist LGPD em dev).
- Wireup async fire-and-forget com catch → logger.error.

### BH.3 — Tela admin despesas (`8d045af`)

- `web/app/dashboard/usinas/[id]/despesas/page.tsx`: 4 KpiCards (Total mês / Pendentes / Aprovadas / Rejeitadas), 3 TabsCustom, tabela 7 colunas (Data | Categoria+descrição | Valor | Tratamento | Comprovante | Status | Ações), botão "Lançar despesa".
- 15 categorias (`DespesaCategoria` enum) com labels humanizadas.
- Filtros por status implícitos via abas.

### BH.3.1 — Refator UX página própria + upload (`44f5e53`)

- **Violação Padrão UX Dual 17/05 Tipo B corrigida:** lançamento de despesa migrado de `DialogLancarDespesa` (Dialog em cima da tela) para página própria `/dashboard/usinas/[id]/despesas/nova`.
- `web/components/despesas/DespesaForm.tsx` (~320 linhas) — componente reusável com 3 modos (`admin-lancar | proprietario-propor | editar`), prop `matrizCamada1` que sugere responsável contratual baseado em `Usina.responsabilidadeDespesas`.
- `web/components/despesas/UploadComprovante.tsx` — drag-drop nativo + preview + 5MB limit + tipos PDF/JPG/PNG, POST `/contas-pagar/upload-comprovante`.

### BH.3.2 — Double-check universal (`543a835`)

- TODOS perfis (PROPRIETARIO/ADMIN/SUPER_ADMIN/OPERADOR) criam com `statusAprovacao=PROPOSTA`. Nenhum auto-aprova.
- `aprovarDespesa/rejeitarDespesa`: **self-approval guard** — `propostoPorUsuarioId === usuarioId` → `ForbiddenException`.
- `notificarDespesaProposta` dispara SEMPRE (não só pra PROPRIETARIO).

### BH.4 — Portal Proprietário + flag visibilidade (`9858c45`)

**Backend (8 arquivos):**

- `Cooperativa.proprietarioVeDespesas: Boolean @default(false)` no schema (campo já existia — só wireup).
- `PUT /cooperativas/:id/proprietario-ve-despesas` (`assertSameTenantOrSuperAdmin` + `@AuditLog`) + `CooperativasService.toggleProprietarioVeDespesas`.
- `GET /proprietario/meu-parceiro` → `ProprietarioService.meuParceiro(user)` resolve cooperativa via Caminho A (cooperadoId) ou Caminho B (email) + retorna `{id, nome, proprietarioVeDespesas}`.
- `ContasPagarService.proporDespesa`: aceita PROPRIETARIO/SUPER_ADMIN sem `cooperativaId` no JWT — infere via usina; **IDOR guard PROPRIETARIO** valida vínculo Caminho A/B antes de criar.
- `ContasPagarService.{aprovar,rejeitar,resolver}Despesa`: bypass tenant check para SUPER_ADMIN (cross-tenant). **Resolve D-novo-BL** (Super Admin recebia "cooperativaId obrigatório" no fluxo de aprovação).
- `ContasPagarController` propaga `req.user.{email, cooperadoId, perfil}` para os 4 endpoints.

**Frontend portal proprietário (3 arquivos):**

- `web/app/proprietario/despesas/page.tsx` (refactor) — consome `/contas-pagar/proprietario` + `/proprietario/meu-parceiro`; 3 KPIs clicáveis; 3 TabsCustom; empty state quando flag=false; botão "Propor despesa"; read-only.
- `web/app/proprietario/despesas/nova/page.tsx` (novo) — seletor usina via `/proprietario/dashboard` + `DespesaForm modo="proprietario-propor"` + matrizCamada1.
- `web/app/proprietario/layout.tsx` — item "Despesas" do menu fica condicional via fetch `/proprietario/meu-parceiro`.

**Frontend admin (2 arquivos):**

- `web/app/dashboard/configuracoes/portal-proprietario/page.tsx` (novo) — toggle Switch (Base UI) otimista + rollback em erro + toast + help inline.
- `web/app/dashboard/layout.tsx` — link "Portal Proprietário" adicionado em Configurações.

**Specs/Smoke:**

- `cooperativas.controller.spec.ts`: +3 specs BH.4 (ADMIN própria coop / ADMIN outra coop → Forbidden / SUPER_ADMIN qualquer).
- `contas-pagar.service.spec.ts`: ajuste de mocks pra incluir `proprietarioCooperadoId/proprietarioEmail` + `userOwnership` + 1 spec novo "PROPRIETARIO sem vínculo lança Forbidden".
- **42/42 specs verdes** (30 contas-pagar + 11 cooperativas + 1 IDOR PROPRIETARIO).
- `backend/scripts/smoke-bh4-portal-proprietario.ts` (novo) — 9 cenários (na rodada final: 11 asserts) cobrindo toggle persistência, findOne reflete flag, meuParceiro Caminho A/B, sem usinas → Forbidden, multi-tenant isolation, IDOR guard, proporDespesa cria PROPOSTA. **11/11 ✅.**
- Build web Turbopack: clean, todas rotas BH.4 compiladas.

## Decisões estratégicas catalogadas

| # | Decisão | Onde |
|---|---|---|
| Padrão UX Dual 17/05 reforçado | Despesas migradas de Dialog → página própria (Tipo B). BH.3.1 corrigiu violação detectada em BH.3. | Memória `padrao_ux_edicao_inline_vs_pagina_propria_17_05.md` |
| Double-check universal | Workflow proposta+aprovação obrigatório TAMBÉM pra ADMIN/SUPER_ADMIN (não só PROPRIETARIO). Substitui design original BH.1. | BH.3.2 (`543a835`) |
| Self-approval guard | Quem propõe NUNCA aprova — guard no backend, não só na UI. | BH.3.2 |
| Super Admin bypass tenant em ContasPagar | SA é cross-tenant; herda cooperativaId da entidade-alvo (usina/despesa). Não cabe `cooperativaId obrigatório`. | BH.4 (`9858c45`) |
| IDOR guard PROPRIETARIO | PROPRIETARIO sem cooperativaId no JWT precisa de ownership check Caminho A/B antes de propor despesa em qualquer usina. | BH.4 service + spec novo |
| Flag visibilidade default false | `Cooperativa.proprietarioVeDespesas` opt-in pelo admin parceiro — protege parceiro que não quer compartilhar com dono. | BH.4 schema + tela config |

## Débitos novos catalogados

- **D-novo-BG** P3 — Anomalia classificação GD Linhares cooperebr1 (já existia, mantido).
- **D-novo-BH** P1 — Módulo Despesas Operacionais Camada 2 (PARCIALMENTE RESOLVIDO via BH.1→BH.4; **BH.5 pendente**).
- **D-novo-BJ** P2 LGPD — URL assinada com expiração pra comprovantes (mantido, fix futuro).
- **D-novo-BK** P3 — Migrar storage uploads pra Supabase Storage / S3 (mantido).
- **D-novo-BM** P3 — Painel credenciais teste na homepage (Opção B, dev-only) — **catalogado nesta sessão** (pedido Luciano durante BH.4).
- **D-novo-BN** P0 BLOQUEADOR — Bug 500 `/dashboard/usinas/[id]/despesas` pós-BH.4 (ChunkLoadError Turbopack) — **catalogado nesta sessão pós-fechamento BH.4**.

## Débito resolvido nesta sessão (bônus BH.4)

- **D-novo-BL** ✅ RESOLVIDO inline em BH.4 — Super Admin sem cooperativaId fixa no JWT recebia "cooperativaId obrigatório" ao acessar `/contas-pagar/operacionais` (e aprovar/rejeitar/resolver). Fix: bypass tenant check perfil-baseado + inferência via Usina quando `filtros.usinaId` presente em listar.

## Triagem D-novo-BN (sem fix aplicado)

**Sintoma:** `GET /dashboard/usinas/usina-linhares/despesas` → 500. ChunkLoadError no console + 3 chunks `/next/static/chunks/*.js` → 500/ERR_ABORTED.

**Stack capturado (PM2 logs frontend, 12:54:04):**

```
Error [ChunkLoadError]: Failed to load chunk
  server/chunks/ssr/cooperebr_web_d9a3a872._.js from module 674823
  digest: '2760986192'
  [cause]: Error: Cannot find module
    'C:\Users\Luciano\cooperebr\web\.next\server\chunks\ssr\cooperebr_web_d9a3a872._.js'
  Require stack:
    - C:\Users\Luciano\cooperebr\web\.next\server\chunks\ssr\[turbopack]_runtime.js
    - C:\Users\Luciano\cooperebr\web\.next\server\app\_global-error\page.js
    ...
  code: 'MODULE_NOT_FOUND'
```

**Backend correlato:** **nenhum** erro 500 em `cooperebr-backend` no horário do bug. Backend subiu OK em 12:47:04 e mapeou TODAS rotas BH.4 (`/proprietario/meu-parceiro`, `PUT /cooperativas/:id/proprietario-ve-despesas`, etc.). Erros pré-existentes (`EmailMonitorService self-signed certificate`, cron diário 06:00) não relacionados.

**Hipótese principal:** **cache Turbopack `.next/` corrupto**, NÃO regressão de código BH.4. Frontend rodou OK por ~47min após `pm2 restart cooperebr-frontend` (12:07:15) → começou a falhar em 12:54:04. Padrão consistente com rebuild incremental Turbopack que limpou um chunk físico mantendo a referência stale em runtime do `_global-error`. Reprodução em Chrome anônimo + Edge confirma que NÃO é cache de browser.

**Arquivos suspeitos:**

- `web/.next/server/chunks/ssr/cooperebr_web_d9a3a872._.js` — inexistente no disco
- `web/.next/server/app/_global-error/page.js` — referencia chunk faltante
- `web/.next/server/chunks/ssr/[turbopack]_runtime.js:683` — linha que lança ChunkLoadError

**Fix sugerido (a aplicar na próxima sessão):**

1. `pm2 stop cooperebr-frontend`
2. `rm -rf web/.next`
3. `cd web && npm run build`
4. `pm2 start cooperebr-frontend`
5. Repro Chrome anônimo + Edge — esperar 200.

Se não resolver, hipótese B é regressão real BH.4 — investigar `web/app/proprietario/layout.tsx` (refator navItems condicional) e qualquer componente compartilhado com `/dashboard/usinas/[id]/despesas`. Se fix custar >1h, **rollback `9858c45`** é alternativa aceitável (preservando D-novo-BL inline).

**Anti-tentação:** nesta sessão NÃO foi aplicado fix, rebuild, restart, ou rollback — apenas triagem read-only conforme prompt.

## Próximo passo

**Fila prioritária próxima sessão Code:**

1. **URGENTE D-novo-BN** — fix bug 500 `/dashboard/usinas/[id]/despesas` pós-BH.4. Ler triagem nesta doc-sessão. Considerar rollback `9858c45` se fix >1h.
2. **D-novo-BM** Painel Credenciais Teste Opção B (~2-3h) — rota/homepage dev-only.
3. **BH.5** — integração cálculo repasse + cron aluguel automático (~1.5-2h backend).
4. **Fechamento canônico COMPLETO** Sprint D-novo-BH consolidado (substitui este fechamento parcial).

## Pré-requisitos leitura próxima sessão

- Esta doc-sessão (triagem completa D-novo-BN)
- `docs/debitos-tecnicos.md` itens D-novo-BN + D-novo-BM + D-novo-BH (BH.5 escopo)
- Memória `padrao_ux_edicao_inline_vs_pagina_propria_17_05.md`
- Memória `feedback_fase1_readonly_obrigatoria.md` (Fase 1 read-only antes de fix BN)
- Memória `regra_validacao_previa_e_retomada.md` (Decisões 14/15/20/23)
- Commit `9858c45` (BH.4) — entender o que mudou pra avaliar rollback

## Carry-overs (não-bloqueantes)

- D-novo-BG (P3) anomalia GD Linhares — fora de escopo BH.
- D-novo-BJ (P2 LGPD) URL assinada comprovantes — endurecimento futuro.
- D-novo-BK (P3) storage S3/Supabase — quando volume crescer.
- D-novo-BC (P2) paridade campos edição usina — fora de escopo BH.
- 30+ scripts utilitários untracked em `backend/scripts/` (Sprint Housekeeping carry-over conhecido).
- `.agent/memory/.dreams/` + 3 markdowns shared (carry-over conhecido).

## Regras aplicadas nesta sessão

- **Decisão 23** (validação prévia rigorosa) — triagem D-novo-BN feita read-only sem fix.
- **Padrão UX Dual 17/05** Tipo B — BH.3.1 corrigiu violação detectada pós-BH.3.
- **D-novo-AS** — `cd web && npm run build` Turbopack obrigatório antes de commit web (executado em todas as fatias).
- **Multi-tenant guard** universal — `assertSameTenantOrSuperAdmin` em toggle + bypass perfil-baseado em ContasPagar.
- **Regra contatos teste** (14/05) — não foi necessário disparo real nesta sessão (smoke programático local + whitelist LGPD ativa).
- **Regra fechamento bilateral** (13/05) — este fechamento PARCIAL satisfaz a regra; fechamento COMPLETO depois de BH.5.
- **Decisão 24** (frase de retomada local único) — `CONTROLE-EXECUCAO.md` atualizado nesta sessão.
- **Regra Code: não trabalhar paralelo** (17/05) — sessão sequencial, sem orquestração paralela com claude.ai.

## Frase comandante (próxima sessão)

Idêntica ao bloco "Próximo passo" desta doc + `CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA`.
