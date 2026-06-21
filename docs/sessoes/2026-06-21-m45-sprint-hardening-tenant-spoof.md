# M45 — Sprint Hardening Tenant-Spoof — bloqueia exposição ANÔNIMA do /cadastro

**Data:** 2026-06-21
**Branch:** `feature/hardening-tenant-spoof` (PRESERVADA no origin)
**Merge SHA na main:** `5cd46ba` (--no-ff sobre `9403095`)

## TL;DR

Sprint Hardening que **fecha o bloqueador de exposição ANÔNIMA** do `/cadastro`
público descoberto na investigação read-only do M44. Os 2 débitos P0/P1 anônimos
ficaram fechados: `POST /cooperados` agora descarta `body.cooperativaId` e resolve
tenant do JWT (com `cooperativaIdAlvo` validado pra SUPER_ADMIN cross-tenant);
`/publico/cadastro-web` + `/publico/cadastro-sem-uc` exigem `?tenant=<id>` validado
contra `Cooperativa.ativo` (404 se inexistente/inativo). Path do convite público
(`?conv=<token>`) preservado intacto — modelo canônico. **Importante: NÃO fecha
spoofs AUTENTICADOS** (admin A → tenant B via `cadastroCompleto`, `motor-proposta`,
ou 3 controllers laterais). Esses ficam catalogados como P1 da próxima sprint
Hardening Lateral.

## Marco entregue

M45 — Sprint Hardening Tenant-Spoof.

## Commits

| Hash | Tipo | Mensagem |
|---|---|---|
| `9403095` | feat | feat(security): M45 Sprint Hardening Tenant-Spoof — bloqueia exposição anônima do /cadastro |
| `5cd46ba` | merge | merge(security): M45 Sprint Hardening Tenant-Spoof (--no-ff) |

Padrão M39/M41/M42/M43/M44 mantido: feature branch preservada no origin
(`feature/hardening-tenant-spoof`).

## Entregas técnicas

### Fatia A — POST /cooperados (D-novo-COOPERADOS-CONTROLLER-TENANT-SPOOF P0)

- `cooperados.controller.ts:132-167`: handler async; destructure-discard
  `body.cooperativaId`; `req.user.cooperativaId` é a fonte canônica; SUPER_ADMIN
  escala via `body.cooperativaIdAlvo` validado por:
  - DTO `@Matches(/^c[a-z0-9]{24}$/)` (formato CUID)
  - `Cooperativa.findUnique({where:{id}, select:{id,ativo}})` no controller
  - `BadRequestException` se inexistente ou `ativo=false`
- `create-cooperado.dto.ts`: `cooperativaId` mantido `@IsOptional` com comentário
  "aceito por compat, IGNORADO server-side"; `cooperativaIdAlvo` novo opcional
  com `@Matches` CUID.
- `ForbiddenException` se tenant não pode ser resolvido.
- **AGREGADOR preservado** sem query adicional — JWT já carrega `cooperativaId`
  derivado da Administradora dele (`auth.service.ts:713`, modelo `Administradora`
  N:1 → `Cooperativa`).

### Fatia B — POST /publico/cadastro-web v2 + cadastro-sem-uc (D-novo-CADASTRO-PUBLICO-TENANT-SPOOF P1)

- `publico.controller.ts:240-303` (cadastro-web v2): `?tenant=<id>` obrigatório
  → `Cooperativa.findUnique` valida existência + `ativo=true` → `NotFoundException`
  se falhar. `body.cooperativaId` descartado. Path convite (`?conv=<token>`)
  preservado intacto (tenant resolvido do token, modelo canônico).
- `publico.controller.ts:~1620-1660` (cadastro-sem-uc): mesmo padrão.
- **Frontend:** 4 fetches `/publico/cadastro-web` em `web/app/cadastro/page.tsx`
  agora passam `?tenant=${encodeURIComponent(tenant)}` na URL. 2 links `<Link>`
  internos (`semUcHref` + `/cadastro/sem-uc/page.tsx` linhas 163+175) com
  `encodeURIComponent` (P2-B security).
- **Sem rebuild necessário do banco** — mudança 100% código.

### Fatia C — GET /publico/convenios-pagador-empresa (bônus)

- `publico.controller.ts:90-116`: validação tenant antes da query (evita probe
  silencioso 404), `@Throttle 30/min` explícito (P3-A security).

### Fatia D — Smoke E2E real (`backend/scripts/smoke-tenant-spoof.ts`)

5 cenários ponta-a-ponta contra `localhost:3000` com JWT real:
1. ADMIN cria com `body.cooperativaId='tenant-B-MALICIOSO'` → criado no JWT
   (CoopereBR), body descartado.
2. SUPER_ADMIN cria via `cooperativaIdAlvo` → cross-tenant em CoopereBR Teste.
3. Público `cadastro-sem-uc?tenant=<fake>` → 404.
4. `convenios-pagador-empresa?tenant=<fake>` → 404 (não vaza silencioso).
5. `convenios-pagador-empresa?tenant=<real>` → 200 + lista (3 convênios).

**Resultado: 5/5 PASS.**

### Testes Jest (32/32 verde)

- `cooperados-controller-tenant-spoof.spec.ts` (9): ADMIN/OPERADOR/SA/AGREGADOR
  + 2 novos `cooperativaIdAlvo` inexistente/inativa (P1 reviewers).
- `publico-tenant-spoof.spec.ts` (9): cadastroWebV2 + cadastroSemUc +
  convenios-pagador-empresa × cenários positivos/negativos.
- `publico.controller.cadastro-web-conv.spec.ts` (14, ATUALIZADO): mock
  `Cooperativa.findUnique` adicionado + mensagem de erro atualizada.

## Reviewers (2 paralelos + re-review)

| Reviewer | Veredito | Achados aplicados |
|---|---|---|
| `cooperebr-multitenant-reviewer` | APROVADO COM RESSALVAS | P0 `cooperativaIdAlvo` sem validar existência: **FIX aplicado** |
| `security-reviewer` | APROVADO COM RESSALVAS (sem P0) | P1-A formato/existência: **FIX**; P2-B `encodeURIComponent` em links: **FIX**; P3-A `@Throttle`: **FIX** |
| Re-review orquestrador | **APROVADO** | "Fecha exposição ANÔNIMA do /cadastro. Merge honesto." |

## O QUE FECHOU vs O QUE NÃO FECHOU (HONESTO)

### ✅ FECHADO nesta sprint

| Débito | Severidade | Onde |
|---|---|---|
| **D-novo-COOPERADOS-CONTROLLER-TENANT-SPOOF** | **P0** | `cooperados.controller.ts:132-167` POST /cooperados — fechado |
| **D-novo-CADASTRO-PUBLICO-TENANT-SPOOF** | **P1** | `publico.controller.ts` cadastro-web v2 + cadastro-sem-uc — fechado |
| (bônus) convenios-pagador-empresa enumeração silenciosa | — | `publico.controller.ts:90-116` — fechado |

### ⚠️ NÃO FECHADO — explicitamente fora do escopo (não dá impressão de "tenant-spoof 100% resolvido")

Sprint cobre **apenas a superfície ANÔNIMA**. Spoofs por **rotas autenticadas**
permanecem abertos:

| Débito | Severidade | Onde | Por que importa |
|---|---|---|---|
| **D-novo-CADASTRO-COMPLETO-TENANT-SPOOF** | **P1** | `cooperados.service.ts:495` (`POST /cooperados/cadastro-completo` + 4 outros pontos `dto.cooperativaId \|\| cooperativaId`) | Admin autenticado A pode criar no tenant B via body |
| **D-novo-MOTOR-PROPOSTA-PLANO-CROSS-TENANT** | **P1** | `motor-proposta.service.ts:584,598-610` | `planoId` do body sem validar ownership cross-tenant |
| **D-novo-AUDITLOG-TENANT-ALVO-SA** | **P1** | `audit-log.interceptor.ts:41-42` | AuditLog não captura `cooperativaIdAlvo` quando SA escala — auditoria por tenant fica cega |
| **D-novo-HARDENING-CONTROLLERS-LATERAIS** | **P1** | `asaas.controller.ts:37`, `condominios.controller.ts:26`, `convite-indicacao.controller.ts:62` | Mesmo padrão de spoof em 3 controllers laterais (autenticados, SA-only) |
| **D-novo-USINA-PROPRIA-CROSS-TENANT** | P2 | `cooperados.service.ts:443` `create` | `usinaPropriaId` no body sem validar cross-tenant |
| **D-novo-SERVICE-LAYER-UPDATE-DELETE-AUDIT** | P2 | 6 controllers × UPDATE/DELETE | Conecta com **IDOR sistêmico** catalogado no inventário SISGD (`~20 endpoints`) |
| **D-novo-USINAS-CREATE-TENANT-IMPLICITO** | P2 | `usinas.controller.ts:74-77` | POST /usinas sem tenant explícito (service decide) |
| **D-novo-COOPERADO-OWNERSHIP-SEM-COOPID** | P3 | `cooperados.controller.ts:37-49` | `assertCooperadoOwnership` sem filtro `cooperativaId` no lookup |
| **D-novo-TERNARIO-COOPID-FALSY** | P3 | `cooperados.service.ts:1031, 736` | `? { id, cooperativaId } : { id }` ternário falsy frágil (string vazia some o filtro) |
| **D-novo-PUBLICO-400-404-ORACULO** | P3 | `publico.controller.ts` cadastros | 400 vs 404 distinguíveis por probe (rebaixado — CUID-25 enum infactível) |

**Impacto operacional:**
- ✅ **Piloto Santi (1ª conveniada) NÃO bloqueado** — só admins confiáveis logam,
  e o caminho dela é via convênio (modelo canônico já blindado).
- ⚠️ **Antes de escalar pra MÚLTIPLOS parceiros-admin reais**, fechar pelo menos
  os 4 P1 da próxima sprint Hardening Lateral.

### Reescopo

- `D-novo-CONVENIO-ORIGEM-LEDGER` reescopado **P1 → P2** em M44 — mantido (a sprint
  M45 não tocou).

## Próximo passo

**Luciano definiu fazer TODAS as 4 sprints da fila em sequência. #1 (M45 Sprint
Hardening Tenant-Spoof) FECHADO.** Próximo na ordem:

**#2 — Sprint Convênio Fase 2 (família + migração + ciclo-de-vida)** — depende
de decisão de escopo do Luciano (piloto inclui família? migração? Fase 0 jurídica
antes?). Bloqueia até essa resposta.

**Decision-independent recomendado enquanto a decisão de #2 não vem:** Sprint
**Hardening Lateral** (fast-follow autenticado) — fecha os 4 débitos P1
autenticados (`cadastroCompleto`, `motor-proposta`, AuditLog tenant alvo,
controllers laterais). Mesmo padrão já aplicado nesta sprint, mesma intuição,
estimativa ~6-8h. Encerra o tema tenant-spoof completo antes de escalar pra
múltiplos parceiros-admin.

## Carry-overs (não-bloqueantes)

- **#3 Sprint OPÇÃO A D-QUALIF-DECAY** (~6-10h) — segue catalogado.
- **#4 Sprint OPÇÃO C Notificações Proativas** (D-novo-RECONCILIACAO-DESISTIDO-LISTENER) — segue.
- 7 débitos `D-novo-CONVENIO-*` ainda abertos do design 19/06.
- Caminho ativação produção saque colaborador DESCONTO_FATURA — inalterado:
  ✅ parecer + ✅ Salvaguardas 1/4/5 + ✅ Throttler+Reconciliação +
  ⏳ parecer escrito + ⏳ flag `.env` prod.
- 21 specs Jest pré-existentes quebrados em outros módulos (mocks desatualizados
  com providers faltando) — não-regressão, anterior à M45.

## Decisões catalogadas nesta sessão

1. **D21/06-1 — Padrão canônico de fix tenant-spoof:**
   - Autenticado: descartar `body.cooperativaId` via destructure; tenant do JWT;
     SA escala via campo explícito `cooperativaIdAlvo` validado (DTO + Prisma).
   - Público: `?tenant=<id>` obrigatório; `Cooperativa.findUnique` valida +
     `Cooperativa.ativo=true`; `NotFoundException` se falhar.
   - Path convite (tokens) é modelo canônico — preservar intacto.

2. **D21/06-2 — Campo `cooperativaIdAlvo` (não `comoCooperativa`):** alinha com
   vocabulário do helper `assertSameTenantOrSuperAdmin`.

3. **D21/06-3 — Compat-ignore vs reject estrito:** manter `body.cooperativaId`
   no DTO `@IsOptional` + descartar server-side (não retornar 400) — segurança
   vem de IGNORAR o body, não de rejeitá-lo. Não-quebrante pro frontend M44.

4. **D21/06-4 — Sprint Hardening LATERAL como fast-follow autenticado:**
   próximo decision-independent enquanto Luciano decide escopo de Sprint Convênio
   Fase 2.

5. **D21/06-5 — Reviewers pesados ANTES do smoke:** ordem invertida em relação
   ao padrão M39/M41/M42/M43 — multitenant + security em paralelo, fixes
   aplicados pré-smoke, re-review orquestrador antes do merge. Funcionou bem.

## Regras aplicadas

- ✅ Decisão 23 (validação prévia) — Fase 1 read-only ampla antes da Fase 2.
- ✅ Padrão M39/M41/M42/M43/M44 — branch dedicada → reviewers pesados →
  re-review orquestrador → merge --no-ff → feature branch preservada no origin.
- ✅ Regra contatos teste 14/05 — smoke E2E não dispara comunicação real.
- ✅ PM2 rebuild backend + frontend após mudança de código.
- ✅ Disciplina de análise modelo canônico primeiro — padrão de fix derivado do
  helper canônico `assertSameTenantOrSuperAdmin` antes de propor solução.
- ✅ **Honestidade no escopo** (re-review orquestrador): NÃO dar impressão de
  "tenant-spoof 100% resolvido" quando spoofs autenticados ainda abertos.

## Frase comandante

Ver `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code`
(M45 atualizada, M44 arquivada).
