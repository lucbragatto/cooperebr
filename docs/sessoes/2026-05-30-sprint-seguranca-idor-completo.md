# Sprint Segurança IDOR (D-novo-BQ) — COMPLETO — 30/05/2026

## TL;DR

Sessão maratona corrigiu **18 IDORs multi-tenant** (7 críticos + 8 altos + 3 médios) em 4 fatias (BQ.1/BQ.2/BQ.3/BQ.4) num só dia. Auditoria gerada por **Audit Dynamic Workflow** (primeiro uso no projeto — 28 sub-agentes paralelos, Opus 4.8, 4 min, 1.437.072 tokens) em `docs/relatorios/2026-05-30-auditoria-idor-workflow.md`. Padrão de fix mecânico e repetível (posse via `findFirst` + bypass `SUPER_ADMIN`), aplicado em 13 services + 8 controllers. **56 specs isolamento verdes + 35 cenários cross-tenant runtime validados em 3 smokes programáticos**. Pré-requisito principal de onboarding Sinergia (2º parceiro real) destravado nos módulos núcleo.

## Marco entregue

**M19 — Sprint Segurança IDOR (Audit Dynamic Workflow)** — 18 IDORs corrigidos em 4 fatias atômicas.

## Commits do dia (5)

| Hash | Mensagem |
|---|---|
| `3e23f81` | docs(seguranca): relatório auditoria IDOR workflow + cataloga D-novo-BQ |
| `9aca267` | fix(seguranca): BQ.1 — 7 IDORs críticos entidades núcleo (contratos/usinas/ucs/geracao) |
| `7185db2` | fix(seguranca): BQ.2 — 3 críticos config + 1 financeiro (config-cobranca body-injection + motor-proposta + cooper-token) |
| `d17ac3f` | fix(seguranca): BQ.3+BQ.4 — 4 altos + 3 médios IDOR (faturas/cooperados/motor-proposta/indicacoes) |
| (este) | docs(fechamento): Sprint Segurança IDOR COMPLETO (18 IDORs) |

## Entregas técnicas

### Auditoria — primeiro uso de Audit Dynamic Workflow

- 28 sub-agentes paralelos, Opus 4.8 (Claude Code)
- 1.437.072 tokens, ~4 min total
- 61 endpoints de mutação varridos em 5 grupos núcleo (contratos, usinas, ucs, geracao-mensal, configuracao-cobranca + motor-proposta + cooper-token + faturas + cooperados + indicacoes)
- Saída: relatório estruturado por severidade com fix sugerido por achado
- **Catalogado como referência metodológica** — workflow reaproveitável pra próximas auditorias (BQ.5 = ampliar ~50 services restantes)

### BQ.1 — 7 IDORs críticos entidades núcleo (commit `9aca267`)

| ID | Endpoint | Service | Padrão |
|---|---|---|---|
| C1 | `PUT /contratos/:id` | `contratos.service.ts.update` | findFirst id+cooperativaId |
| C2 | `PUT /usinas/:id` | `usinas.service.ts.update` | findFirst id+cooperativaId (condicional preserva specs legados) |
| A3 | `DELETE /usinas/:id` | `usinas.service.ts.remove` | idem |
| C3 | `PUT /ucs/:id` | `ucs.service.ts.update` | findFirst id+cooperativaId |
| A4 | `DELETE /ucs/:id` | `ucs.service.ts.remove` | idem |
| C4 | `PUT /geracao-mensal/:id` | `geracao-mensal.service.ts.update` | helper assertPosseOuFindOne — posse via usina.cooperativaId |
| A5 | `DELETE /geracao-mensal/:id` | `geracao-mensal.service.ts.remove` | idem |

**Specs:** 21 cenários (3+6+6+6) — todos verdes.
**Smoke runtime:** 12/12 cross-tenant validados.

### BQ.2 — 3 críticos config + 1 financeiro (commit `7185db2`)

| ID | Endpoint | Service | Padrão |
|---|---|---|---|
| C5 | `PUT /configuracao-cobranca` | controller | helper `resolverTenant(req, body)` — ADMIN ignora body |
| C6 | `PUT /configuracao-cobranca/usina/:usinaId` | controller | helper + verifica usinaId pertence ao tenant |
| C7 | `POST /motor-proposta/proposta/:id/aprovar-presencial` | `motor-proposta.service.ts.aprovarPresencial` | findFirst id + cooperado.cooperativaId |
| A6 | `POST /cooper-token/admin/confirmar-compra` | `cooper-token.service.ts.confirmarCompraParceiro` | valida `compra.cooperativaId === cooperativaId` ANTES de creditarSaldoParceiro |

**Inovação BQ.2:** helper `resolverTenant` (controller-side) é primeira ocorrência do padrão JWT-vs-body no projeto. SUPER_ADMIN pode cross-tenant via body intencional; ADMIN sempre preso ao próprio tenant.

**A6 é IMPACTO FINANCEIRO** — credit indevido de tokens + emit de evento contábil cross-tenant prevenido.

**Specs:** 17 cenários. A6 valida explicitamente que `creditarSaldoParceiro` NÃO é chamado + `eventEmitter.emit` NÃO dispara.
**Smoke runtime:** 12/12 cross-tenant; asserção financeira: saldo B 0→0 após ataque A; 0→1000 após SA legítimo.

### BQ.3 — 4 altos + 1 médio (commit `d17ac3f`)

| ID | Endpoint | Service | Padrão |
|---|---|---|---|
| A1 | `PATCH /faturas/:id/vincular` | `faturas.service.ts.vincularFaturaManual` | findFirst id+cooperativaId; controller SUPER_ADMIN→null |
| A2 | `POST /cooperados/:id/fatura-mensal` | `cooperados.service.ts.registrarFaturaMensal` | findFirst id+cooperativaId |
| A7 | `POST /motor-proposta/proposta/:id/enviar-aprovacao` | `motor-proposta.service.ts.enviarAprovacao` | posse via cooperado (previne sequestro de tokenAprovacao) |
| A8 | `POST /motor-proposta/upload-modelo` | controller | body→JWT (padrão C5/C6) |
| M1 | `POST /cooperados/:id/alocar-usina` | `cooperados.service.ts.alocarUsina` | findFirst id+cooperativaId (vazava nome/UC/consumo) |

### BQ.4 — 2 médios indicações (commit `d17ac3f`)

| ID | Endpoint | Service | Padrão |
|---|---|---|---|
| M2 | `POST /indicacoes/registrar` | `indicacoes.service.ts.registrarIndicacao` | indicador + indicado filtrados por cooperativaIdJwt; defesa em profundidade rejeita se cross-tenant mesmo sem JWT |
| M3 | `POST /indicacoes/processar-pagamento` | `indicacoes.service.ts.processarPrimeiraFaturaPaga` | findMany aplica cooperativaIdJwt quando informado; OnEvent legado preservado com null |

**Specs BQ.3+BQ.4:** 18 cenários (3+4+3+3+5).
**Smoke runtime:** 11/11 cross-tenant. A7: tokenAprovacao NÃO sequestrado; M3: indicação B continua PENDENTE; A1: cooperadoId/ucId da fatura B intactos.

### Totais finais

- **18 IDORs corrigidos** (7 críticos + 8 altos + 3 médios)
- **13 services + 8 controllers** modificados
- **56 specs isolamento verdes** (21 BQ.1 + 17 BQ.2 + 18 BQ.3+BQ.4)
- **35 cenários runtime cross-tenant validados** (12+12+11) — 3 smokes programáticos com cleanup automático
- **Backwards-compat preservada** em todos os specs antigos via condicional `cooperativaId ? findFirst : findUnique`

## Padrões consolidados

### 1. Padrão posse (BQ.1, BQ.2 C7, BQ.3 A1/A2/M1, BQ.3 A7, BQ.4 M2)

```typescript
async metodo(id: string, ..., cooperativaId?: string | null) {
  const recurso = cooperativaId
    ? await this.prisma.X.findFirst({ where: { id, cooperativaId } })  // ou via join
    : await this.prisma.X.findUnique({ where: { id } });               // SA bypass
  if (!recurso) throw new NotFoundException('Recurso não encontrado');
  // ... resto
}
```

### 2. Padrão body→JWT (BQ.2 C5/C6, BQ.3 A8)

```typescript
// Controller helper
private resolverTenant(req: any, body?: { cooperativaId?: string }): string {
  if (req.user?.perfil === 'SUPER_ADMIN') {
    return body?.cooperativaId ?? req.user?.cooperativaId;  // SA pode body
  }
  return req.user?.cooperativaId;                            // ADMIN sempre JWT
}
```

### 3. Padrão posse financeira (BQ.2 A6) — guard ANTES de side-effect

```typescript
const compra = await prisma.findUnique({ where: { id } });
if (!compra) throw new NotFoundException();
if (cooperativaId && compra.cooperativaId !== cooperativaId) {
  throw new ForbiddenException();  // ANTES de qualquer crédito ou emit
}
// ... crédito + emit aqui
```

### 4. Padrão derivação removida (BQ.4 M2/M3)

- Antes: `const cooperativaId = indicador.cooperativaId || indicado.cooperativaId` (atacável)
- Depois: `cooperativaIdJwt` é authoritative quando informado; defesa em profundidade rejeita inconsistências cross-tenant mesmo no path legacy.

## Bugs/regressões observadas

Nenhum. Todos os specs antigos (incluindo D-48-faturas, D-48 contratos) continuaram verdes. `usinas.controller.spec.ts` tinha falha pré-existente (TestingModule deps), confirmada via `git stash` antes do BQ.1 — não relacionada ao sprint.

## Decisões estratégicas catalogadas (memórias)

Nenhuma memória nova nesta sessão — sprint inteiramente mecânico, padrões D-48/analisarDocumentos pré-existentes apenas replicados em escala.

**Validar pós-sessão:** considerar catalogar memória de "padrão IDOR fix posse+bypass" como referência canônica pra próximas auditorias (BQ.5 + auditorias futuras de novos endpoints).

## Próximo passo

**Opções a decidir com Luciano** (em ordem de impacto descendente):

1. **BQ.5 — Ampliar auditoria IDOR pros ~50 services restantes** (Audit Dynamic Workflow reaproveitável). Estimativa: 1 sessão maratona similar a esta. Resolve isolamento total do sistema.
2. **F.4 — Sub-Sprint Smoke E2E pós-IDOR** — rodar smoke regression em 10 fluxos para garantir que nenhum dos fixes BQ quebrou caminho feliz (cobranças, ativações, vincular fatura, alocar usina, etc).
3. **Sprint Contabilidade Tributária Segregada** — prioridade #8 no roadmap pré-IDOR.
4. **Convergência portal `/parceiro` vs `/dashboard`** (D-novo-BP P3).

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` — frase de retomada atualizada
- `docs/debitos-tecnicos.md` — seção D-novo-BQ (BQ.1-BQ.4 ✅; BQ.5 aberto)
- `docs/relatorios/2026-05-30-auditoria-idor-workflow.md` (se for BQ.5 ou auditoria adicional)

## Carry-overs (não-bloqueantes)

- `usinas.controller.spec.ts` falha pré-existente (TestingModule deps) — não foi tocada nesta sessão. Mantém anotada para sub-sprint futuro de saúde de testes.
- 6 erros TS em `scripts/` (excluídos do build) — debt antigo, não-bloqueante.

## Regras aplicadas na sessão

- **Decisão 23 — Fase 1 read-only obrigatória antes de tocar código** — aplicada em cada fatia antes de qualquer modificação
- **Padrão D-48 (precedente)** — `contratos.service.ts.remove()` replicado mecanicamente em 4 módulos
- **Backwards-compat de specs legados** — preservada via condicional, sem reescrever specs antigos
- **SUPER_ADMIN bypass via `null`** — protegido em todos os 18 fixes
- **Smoke programático obrigatório** — runtime validation contra Postgres real após cada fatia
- **Contatos de teste** — não aplicado (sprint não disparou comunicação real)

## Frase comandante

```
PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior).
   Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents disponíveis.
   Se não aparecer, parar e avisar (sessão não indexou subagent project-specific).

2. Rodar `git status --short` (diretriz inegociável catalogada 18/05).
   Esperado pós-fechamento: working tree limpo, último commit é o de fechamento.

PASSO 1 — Frase de retomada principal:

Sessão 30/05 entregou M19 Sprint Segurança IDOR COMPLETO em 5 commits
(3e23f81..[hash fechamento]). 18 IDORs corrigidos em 4 fatias atômicas
(BQ.1+BQ.2+BQ.3+BQ.4) — 7 críticos + 8 altos + 3 médios. 56 specs
isolamento verdes + 35 cenários runtime cross-tenant validados em 3
smokes programáticos. Pré-requisito Sinergia destravado nos módulos
núcleo. Audit Dynamic Workflow estreou no projeto (28 subagentes, 4min,
relatório em docs/relatorios/2026-05-30-auditoria-idor-workflow.md).

Próxima sessão Code: decidir entre (1) BQ.5 ampliar auditoria ~50
services restantes, (2) F.4 smoke E2E pós-IDOR pra garantir caminho
feliz, (3) Sprint Contabilidade Tributária Segregada (#8 roadmap), (4)
convergência portal /parceiro vs /dashboard (D-novo-BP).

Pré-requisitos leitura: docs/CONTROLE-EXECUCAO.md + docs/debitos-tecnicos.md
seção D-novo-BQ + (se BQ.5) docs/relatorios/2026-05-30-auditoria-idor-workflow.md.

Carry-overs: usinas.controller.spec.ts falha pré-existente (TestingModule
deps, não relacionada ao IDOR); 6 erros TS em scripts/ (debt antigo).

Diretrizes aplicáveis: Decisão 23 Fase 1 read-only sempre antes de
tocar código; ritual fechamento bilateral catalogado; contatos teste
27981341348 + lucbragatto@gmail.com pra qualquer disparo real.
```
