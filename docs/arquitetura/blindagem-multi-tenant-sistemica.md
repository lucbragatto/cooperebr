# Blindagem Multi-Tenant Sistêmica — Decisão Arquitetural (30/05/2026)

> Análise via agente architect (read-only). Resposta ao achado de **68 IDORs** (3 relatórios em `docs/relatorios/2026-05-30-auditoria-idor-*`).
> 18 corrigidos (BQ.1-BQ.4) + 50 pendentes (Onda A 19 + Onda B 31).

## Por que isto é FUNDAÇÃO COMERCIAL, não correção de bug

O SISGD **nasceu single-tenant** (só CoopereBR — daí o nome do repo) e foi **transformado em SaaS multi-parceiro**. Os 68 IDORs são **dívida da migração single→multi-tenant**: o código foi escrito quando só havia 1 dono e ninguém precisava filtrar `cooperativaId`.

**Modelo de negócio:** cada parceiro (cooperativa / consórcio / associação / condomínio) **paga** (assinatura e/ou % do faturamento via FaturaSaas) e é **independente/concorrente** dos demais. O isolamento multi-tenant é literalmente **o que o produto vende** — "seus dados isolados dos outros parceiros".

**Implicações:**
1. IDOR cross-tenant = quebra de contrato SaaS + risco jurídico (LGPD/sigilo) + perda de confiança comercial.
2. A blindagem é **pré-requisito de onboarding** de cada novo parceiro pagante (Sinergia e próximos) — não é opcional.
3. Como o SISGD vai **escalar com muitos parceiros + muitos endpoints novos**, prevenir o "69º endpoint vulnerável" (Guard `@TenantResource` + lint de CI) é investimento em fundação, não em remendo. Sem isso, a dívida se recria a cada feature.

Por isso o Sprint Blindagem (D-novo-BR) é **prioridade de produto**, não débito técnico comum.

## A. Mapa do terreno (confirmado no código)

- **Prisma 6.16.2** — suporta Client Extensions (`$extends`). Hoje: `PrismaService extends PrismaClient`, instância única, **zero extensions, zero `$use`, zero AsyncLocalStorage**. Nenhuma camada de tenant existe.
- **Schema (~95 models):** ~52 com `cooperativaId` direto · ~18 tenant-via-relação (GeracaoMensal→Usina, DocumentoCooperado→Cooperado, AsaasCobranca→Cooperado) · ~25 globais (Cooperativa, Plano, configs de plataforma).
- **Auth:** `JwtStrategy` retorna `{ id, email, perfil, cooperativaId }` → `req.user`. Guards globais (`JwtAuthGuard`, `RolesGuard`, `ModuloGuard`, `ThrottlerGuard`) — **nenhum faz isolamento de tenant**. SUPER_ADMIN = perfil + cooperativaId null (bypass intencional).

## B. Opções avaliadas

| Opção | Cobre dos 68 | Risco | Esforço |
|---|---|---|---|
| Prisma Client Extension + AsyncLocalStorage | ~40-45 | ALTO | 5-8 dias |
| NestJS Interceptor/Guard global | ~10-15 | MÉDIO | 3-5 dias |
| Fix endpoint-por-endpoint (status quo) | 50 | BAIXO | 6-10 dias |
| **Híbrido (Extension + fixes pontuais)** | **68** | MÉDIO | 7-11 dias |

## C. Recomendação: HÍBRIDO FASEADO, críticos PRIMEIRO

> **STATUS 31/05/2026: F0+F1 COMPLETOS em 1 sessão Code maratona. 68/68 IDORs corrigidos.**

Não esperar a fundação (7-11 dias) com críticos sangrando. Sequência:

- **FASE 0 (~2-3h):** ✅ COMPLETO — fix manual 26 IDORs (commits 063e01c..8a40b81).
- **FASE 1.1+1.2:** ✅ COMPLETO — Guard sistêmico `@TenantResource` + 15 endpoints anotados (commits 4d933c4, 0c81afd).
- **FASE 1.3:** ✅ COMPLETO — AsyncLocalStorage nativo + `runWithTenant`/`runAsPlatform`/`@AsPlatform()` em 45 métodos cron/listener + Extension Prisma LOG-ONLY `tenantLeakDetector` (commit 7fa60b3).
- **FASE 1.4:** ✅ COMPLETO — Lint anti-reincidência baseline+ratchet (commit 1b1971f).
- **FASE 1.5:** ✅ COMPLETO — 9 residuais cat 3 + EmailLog schema `cooperativaId` (migration via ritual PM2) + M8 fallback ENV removido.
- **FASE 2 (~2-3 dias):** 📋 **OPCIONAL** — Prisma Client Extension de INJEÇÃO automática. Com Guard+lint+log ativos, F2 vira *opcional*: reavaliar SE volume de novos endpoints em sprints futuros justificar overhead (Extension de injeção tem armadilhas: crons, upsert, raw queries, performance, mock em testes).
- **FASE 4 (~1-2 dias):** 📋 Catalogado futuro — regressão E2E abrangente.

**Cobertura final REAL:** 68/68 corrigidos por F0+F1, com 4 camadas defensivas (manual + Guard + log + lint).

## D. Armadilhas específicas do SISGD

1. **Crons + webhooks rodam SEM request HTTP** (cobrança mensal, repasse, monitoramento; webhooks Asaas/WhatsApp) — não têm tenant no ALS. Extension cega QUEBRA eles silenciosamente. **`runAsPlatform()` é pré-requisito, não opcional.**
2. **Não migrar os 18 já corrigidos** pra confiar na Extension — deixar como defesa em profundidade, evita regressão.
3. **Body-injection (~8)** nenhuma camada de query resolve — fix no controller/DTO obrigatório.
4. **Performance** — Extension roda em TODA query; bug aqui afeta o sistema inteiro.

## Veredito

Camada sistêmica VALE A PENA (previne reincidência), mas NÃO é bala de prata — cobre ~52 de 68. Híbrido é o caminho, com fix manual dos críticos PRIMEIRO. Catalogar como **Sprint Blindagem Multi-Tenant** (D-novo-BR), com Fase 0 destacável pra execução imediata.

## Anti-reincidência — Lint (F1.4, 31/05/2026)

**O 69º endpoint vulnerável** é o problema real: sem disciplina de anotação, todo PR novo pode reintroduzir IDOR. Solução implementada:

- **Script:** `backend/scripts/lint-tenant-decorators.ts` (TS AST nativo, sem dep nova).
- **Comando:** `npm run lint:tenant` (cwd: `backend/`).
- **Regra:** todo handler HTTP de mutação (`@Post/@Put/@Patch/@Delete`) DEVE declarar UM destes:
  - `@TenantResource({...})` — protegido pelo Guard sistêmico (cobertura padrão)
  - `@TenantExempt()` — endpoint sabidamente sem recurso por id (dev/health)
  - `@Public()` — endpoint público (webhook, cadastro, login)
- **Baseline (`scripts/tenant-lint-allowlist.json`):** snapshot dos 256 handlers legados de mutação que NÃO declaram decorator no fechamento da F1.3. Eles ficam como WARNING (não falham); novos handlers sem decorator são erro hard (exit 1).
- **Esvaziamento incremental:** quando um handler legado for anotado, removê-lo da allowlist (o lint avisa: `⚠ entradas que já receberam decorator — pode REMOVER`).
- **Ratchet:** dívida só diminui, nunca cresce. Re-gerar baseline (`gen-tenant-lint-allowlist.ts`) só em casos extremos — esconde regressões.

### Integração

- Sem CI/husky hoje no projeto. **Rodar manual antes de cada PR** (recomendado).
- **Futura integração:** quando GitHub Actions for ligado, adicionar step `cd backend && npm run lint:tenant` ao workflow de CI; quando husky for adotado, adicionar ao `pre-push` hook.

### Por que essa peça importa

- F1.1 deu o Guard. F1.2 anotou 15. F1.3 deu o smoke detector log-only. Sem o lint da F1.4, o próximo PR pode introduzir um handler sem decorator e ninguém percebe até virar incidente.
- O Guard só roda em rotas anotadas (opt-in). Esquecer de anotar = vulnerabilidade silenciosa.
- O log-only F1.3 detecta em runtime, mas é defesa em profundidade — o lint pega na pre-merge.
