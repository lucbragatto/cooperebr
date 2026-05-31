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

Não esperar a fundação (7-11 dias) com críticos sangrando. Sequência:

- **FASE 0 (~2-3h):** fix manual em lote dos 7 críticos Onda B + 19 Onda A (mesmo padrão dos 18 já feitos). Resolve o sangramento.
- **FASE 1 (~3-4 dias):** fundação — AsyncLocalStorage + interceptor que abre contexto de tenant por request + helper `runWithTenant()` + **escape hatch `runAsPlatform()`** pra crons/webhooks/SUPER_ADMIN.
- **FASE 2 (~2-3 dias):** Prisma Client Extension injeta `cooperativaId` automático nos ~52 models com campo direto (read+write). Previne reincidência — endpoint novo já nasce protegido.
- **FASE 3 (~1-2 dias):** fixes residuais — ~18 models tenant-via-relação (join) + ~8 body-injection (controller/DTO) que a Extension não cobre.
- **FASE 4:** teste de regressão multi-tenant + spec cross-tenant abrangente.

**Cobertura final:** Extension ~52 models + manual o resto. Total ~7-11 dias, **críticos resolvidos no dia 1**.

## D. Armadilhas específicas do SISGD

1. **Crons + webhooks rodam SEM request HTTP** (cobrança mensal, repasse, monitoramento; webhooks Asaas/WhatsApp) — não têm tenant no ALS. Extension cega QUEBRA eles silenciosamente. **`runAsPlatform()` é pré-requisito, não opcional.**
2. **Não migrar os 18 já corrigidos** pra confiar na Extension — deixar como defesa em profundidade, evita regressão.
3. **Body-injection (~8)** nenhuma camada de query resolve — fix no controller/DTO obrigatório.
4. **Performance** — Extension roda em TODA query; bug aqui afeta o sistema inteiro.

## Veredito

Camada sistêmica VALE A PENA (previne reincidência), mas NÃO é bala de prata — cobre ~52 de 68. Híbrido é o caminho, com fix manual dos críticos PRIMEIRO. Catalogar como **Sprint Blindagem Multi-Tenant** (D-novo-BR), com Fase 0 destacável pra execução imediata.
