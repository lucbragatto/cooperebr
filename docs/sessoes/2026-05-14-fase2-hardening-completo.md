# Sessão 2026-05-14 noite — Fase 2 Hardening A→I completa

## Contexto

Continuação da maratona 13-14/05. Sessão anterior fechou Fase 2A IDOR cobranças + 2B IDOR contratos. Estado restante: 2C, 2D, 2E, 2F, 2G, 2H, 2I (~28-42h Code).

Esta sessão fechou **as 9 sub-fases** em ordem definida pela memória `fase2_hardening_estado_14_05.md`: **2G → 2H → 2F → 2I** (após as 2A-2E já entregues).

## Entregas

### Fase 2G — Helmet + HSTS + CSP + .env.example
**Commit:** `e6ee6e5`

- `backend/src/main.ts`: helmet middleware com CSP (reportOnly em dev, enforce em prod), HSTS 180d, frame-ancestors none, object-src none.
- Whitelist CSP: Asaas (api.asaas.com + api-sandbox.asaas.com), Anthropic (api.anthropic.com), cdn.jsdelivr.net (Mermaid).
- `.env.example` rewrite completo: SUPER_ADMIN_SECRET_KEY, ASAAS_ENCRYPT_KEY, CORS_ORIGINS, NODE_ENV, BLOQUEIO_MODELOS_NAO_FIXO, ANTHROPIC_API_KEY, COOPEREAI_MODEL, WHATSAPP_SERVICE_URL.
- **Smoke:** `curl -I http://localhost:3000/` retorna 6 headers Helmet (CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, X-DNS-Prefetch-Control).

### Fase 2H — Cross-talk legacy /parceiro/membros
**Commit:** `8fd28dc`

- `web/next.config.ts`: redirect 301 permanente `/parceiro/membros/:path*` → `/dashboard/cooperados/:path*`.
- `web/app/parceiro/layout.tsx`: nav 'Membros' aponta direto pra `/dashboard/cooperados`.
- `web/app/parceiro/page.tsx`: quick-action card 'Gerenciar Membros' redirecionado.
- **Deletados:** `web/app/parceiro/membros/page.tsx` + `web/app/parceiro/membros/[id]/page.tsx` (5 files changed, 20 insertions, 335 deletions).
- B1 cross-talk (13/05) já mitigado server-side via Fase 2A-2E IDOR fixes (34 endpoints). Esta fase elimina a UI legacy.

### Fase 2F — AuditLog D-30N interceptor
**Commit:** `26836ab`

Novo módulo `backend/src/audit/`:
- `audit.service.ts`: persiste entradas em `AuditLog`, falha silenciosa por design.
- `audit-log.decorator.ts`: `@AuditLog({ acao, recurso, recursoIdParam? })`.
- `audit-log.interceptor.ts`: `APP_INTERCEPTOR` global, dispara em `tap` após sucesso.
- `audit.module.ts`: `@Global`, registrado em `app.module.ts`.

18 endpoints decorados:
- **Cooperados:** criar, cadastro-completo, atualizar, modo-remuneracao, aprovar-concessionaria, deletar, lote-status
- **Contratos:** criar, atualizar, ativar, deletar
- **Cobrancas:** criar, atualizar, dar-baixa, cancelar, deletar
- **Asaas:** config.salvar, cobranca.cancelar
- **Cooperativas:** criar, atualizar, plano.vincular, deletar
- **SaaS:** plano.criar, plano.atualizar, plano.vincular, plano.deletar, fatura.gerar

**Captura impersonate** (`impersonating`, `cooperativaImpersonadaId`) preparada pra Sprint 13b.

**Smoke validado:** PUT /cooperados/:id → HTTP 200 → AuditLog +1 entrada com `usuarioId`, `perfil=ADMIN`, `acao='cooperado.atualizar'`, `recursoId`, `cooperativaId`, IP `::1`, UA `node`, metadata (method+url+params+query).

### Fase 2I — Smoke E2E cross-tenant + bonus IDOR fix
**Sem commit isolado** (incluído no fechamento desta sessão)

Criado `backend/scripts/smoke-fase2-cross-tenant.ts`: admin do tenant A com JWT válido tenta acessar/mutar recursos do tenant B (CoopereBR Teste). Espera 403/404 em todos.

**Primeira execução detectou vulnerabilidade real:**
```
[PASS] GET cooperado cross-tenant -> HTTP 404
[FAIL] PUT cooperado cross-tenant -> HTTP 200  ← IDOR
```

`cooperados.service.update(id, dto)` não recebia `cooperativaId` — Fase 2A-2E não cobriu esse caller. Fix imediato:
- `cooperados.service.ts:668`: assinatura `update(id, data, cooperativaId?)` com `findFirst({ where: cooperativaId ? { id, cooperativaId } : { id } })` + `NotFoundException` se cross-tenant.
- `cooperados.service.ts:997`: assinatura `remove(id, cooperativaId?)` idem.
- `cooperados.controller.ts`: 3 callers (`@Put(':id')`, `@Put(':id/modo-remuneracao')`, `@Delete(':id')`) passam `req.user?.cooperativaId`.

**Smoke após fix:** 2/2 PASS.

## Validações finais

| Item | Status |
|---|---|
| Helmet headers no `curl -I` | 6 headers ativos ✅ |
| Redirect 301 `/parceiro/membros` → `/dashboard/cooperados` | configurado em `next.config.ts` ✅ |
| AuditLog entradas após PUT real | 1 entrada gerada com todos os campos populados ✅ |
| Smoke cross-tenant cooperados | 2/2 PASS ✅ |
| Build backend (`nest build`) | sem erros ✅ |
| TypeScript check web | erro pré-existente em `dashboard/cooperados/[id]/page.tsx:691` (não introduzido) |
| PM2 cooperebr-backend | online ✅ |

## Débitos atualizados em `docs/debitos-tecnicos.md`

- **D-30N** ✅ RESOLVIDO (Fase 2F)
- **D-48** ✅ RESOLVIDO (Fase 2 Hardening A-I completa)
- Header atualizado pra refletir 2026-05-14 noite

## Próximo passo

Sinergia onboarding (2º parceiro real) destravado — pré-requisito Hardening atendido. Alternativa: retomar Plano Mestre por outra fatia. Decisão de produto fica com Luciano.

## Scripts úteis criados

- `backend/scripts/smoke-audit-log.ts` — lista entradas recentes do AuditLog.
- `backend/scripts/smoke-audit-trigger.ts` — gera JWT admin e dispara PUT cooperado pra validar interceptor.
- `backend/scripts/smoke-fase2-cross-tenant.ts` — admin tenant A vs recursos tenant B.

## Commits da sessão (Fase 2 fechamento)

```
e6ee6e5 feat(seguranca): Fase 2G — Helmet + HSTS + CSP + .env.example
8fd28dc feat(seguranca): Fase 2H — remover legacy /parceiro/membros + redirect 301
26836ab feat(seguranca): Fase 2F — AuditLog D-30N ativo via interceptor global
<this>  docs(fase2): fechamento Fase 2 Hardening A-I + bonus IDOR fix cooperados
```
