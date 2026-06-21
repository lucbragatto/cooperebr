# M44 — Slice "Convênio: recebe-créditos-GD como DADO + convenioId no CooperTokenCompra"

**Data:** 2026-06-20
**Branch:** `feature/convenio-origem-dado` (PRESERVADA no origin)
**Merge SHA na main:** `6847e5a` (--no-ff sobre `2af634a`)
**Commit fechamento:** _este_

## TL;DR

Slice decision-independent do design do convênio cooperativizado (19/06) entregue:
o cadastro V2 (público com/sem UC + wizard admin com/sem UC) agora **registra como
DADO** se o cooperado já recebe créditos GD de outro fornecedor + nome do fornecedor.
Em paralelo, `CooperTokenCompra` ganhou FK opcional `convenioId` com **guard
multi-tenant** (cooperativaId do JWT, nunca do body) — rastreabilidade indireta da
origem de convênio no ledger via `Ledger.referenciaId → CooperTokenCompra.convenioId`.
Zero bloqueio: cooperado que recebe GD continua sendo cadastrado (sinaliza, não
barra). Invariante `FUNDACAO §4#1` (Passivo == Σ saldos × face) preservada.

## Marco entregue

M44 — slice "convenio-origem-dado" do roadmap M44+ (design 19/06).

## Commits

| Hash | Tipo | Mensagem |
|---|---|---|
| `2af634a` | feat | feat(convenio): M44 slice origem-dado — campo recebe-créditos-GD (dado) + convenioId no CooperTokenCompra + guard multi-tenant |
| `6847e5a` | merge | merge(convenio): M44 slice origem-dado — campo recebe-créditos-GD + convenioId no CooperTokenCompra (--no-ff) |

Padrão M39/M41/M42/M43 mantido: feature branch preservada no origin (`feature/convenio-origem-dado`).

## Entregas técnicas

### Schema delta (aditivo, `prisma db push` aplicado em dev)

- `Cooperado.jaRecebeCreditosGd Boolean @default(false)`
- `Cooperado.fornecedorGdAtual String?`
- `CooperTokenCompra.convenioId String?` + FK `onDelete: SetNull` → `ContratoConvenio`
- `ContratoConvenio.cooperTokenCompras CooperTokenCompra[]` (back-relation)
- 3 índices novos:
  - `CooperTokenCompra @@index([convenioId])`
  - `CooperTokenCompra @@index([cooperativaId, convenioId])`
  - `CooperTokenLedger @@index([referenciaTabela, referenciaId])` (acelera lookup de origem)

### Backend

- `cooper-token.service.ts comprarTokensCooperado()`: param novo `convenioId?: string`
  com guard ANTES do create:
  ```ts
  if (convenioId) {
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: { id: true },
    });
    if (!convenio) throw new NotFoundException(
      'Convênio não encontrado ou não pertence ao seu tenant.',
    );
  }
  ```
- `processarPagamentoCompraPj()`: removido `(compra as any)`; usa `compra.convenioId` direto (Prisma client regenerado).
- `cooper-token.controller.ts:577`: propaga `body.convenioId` pro service.
- `comprar-tokens-cooperado.dto.ts`: `@IsOptional` + `@IsString` + `@IsNotEmpty` + `@Matches(/^c[a-z0-9]{24}$/, { message: 'convenioId deve ser um CUID válido' })`.
- `cooperados.service.ts:create` (~428): typing do `data` extendido com 2 campos GD.
- `create-cooperado.dto.ts`: `jaRecebeCreditosGd?: boolean` + `fornecedorGdAtual?: string` (`@MaxLength(200)`).
- `publico.controller.ts cadastroWebV2` (~879) + `cadastroSemUc` (~1599): aceitam e propagam os 2 campos GD.

### Frontend (4 cadastros)

- `web/app/cadastro/page.tsx` (público com UC) — checkbox amber + input opcional + payload.
- `web/app/cadastro/sem-uc/page.tsx` (público sem UC) — idem.
- `web/app/dashboard/cooperados/novo/steps/Step2Dados.tsx` (wizard admin com UC) — interface extendida + render.
- `web/app/dashboard/cooperados/novo-sem-uc/page.tsx` (wizard admin sem UC) — form state + payload.

Rebuild Next.js production + `pm2 restart cooperebr-frontend` confirmado (sem HMR; bundle novo servido).

### Testes

**6 specs Jest** (`backend/src/cooper-token/cooper-token-convenio-origem-dado.spec.ts`):
1. Compra sem `convenioId` → grava `null`.
2. Compra com `convenioId` mesmo tenant → grava.
3. `convenioId` inexistente → `NotFoundException`.
4. `convenioId` outro tenant → `NotFoundException` (anti cross-tenant spoof).
5. Validação **antes** do create (guard falha, `compra.create` nunca chamado).
6. Cooperado PF → `ForbiddenException` **antes** do guard convênio (ordem preservada).

**Smoke E2E** (`backend/scripts/smoke-convenio-origem-dado.ts`): 5 casos com janela
`SMOKE_INICIO` pra cleanup das compras criadas durante o teste.

## Reviewers

| Reviewer | Veredito |
|---|---|
| `cooperebr-multitenant-reviewer` | OK — `cooperativaId` sempre do JWT, nunca do body; guard via `findFirst { id, cooperativaId }` |
| `cooperebr-financeiro-token-reviewer` | OK — invariante `FUNDACAO §4#1` preservada; idempotência `@@unique([asaasId])` preservada; race window do create solucionada (guard ANTES) |
| Re-review orquestrador | APROVADO — schema delta + guard linha 1550 + back-relation linha 1678 + `onDelete: SetNull` linha 3221 verificados |

## Débitos catalogados (pré-existentes, NÃO bloqueiam o merge)

Investigação ampla descobriu 4 débitos pré-existentes em `cooperados.controller.ts` +
`publico.controller.ts` que **não foram introduzidos por M44** mas devem ser
fechados antes de tunelar `/cadastro` público:

| Débito | Severidade | Onde | O que fazer |
|---|---|---|---|
| `D-novo-COOPERADOS-CONTROLLER-TENANT-SPOOF` | **P0** | endpoints do controller aceitam `cooperativaId` do body em alguns paths | Forçar `req.user.cooperativaId` em 100%; rejeitar `cooperativaId` no body via `whitelist: true, forbidNonWhitelisted: true` |
| `D-novo-CADASTRO-PUBLICO-TENANT-SPOOF` | **P1** | `publico.controller.ts` aceita `cooperativaId` no body sem validação rígida (deveria vir do contexto do convite/slug público) | Resolver origem do tenant por `slugPublico` ou `conviteId`, **NÃO body** |
| `D-novo-COOPERADO-UPDATE-SEM-COOPID` | P2 | `update` no service não revalida tenant do registro alvo | Adicionar `findFirst { id, cooperativaId }` no início |
| `D-novo-UPDATE-COOPERADO-DTO-GD-FIELDS` | P3 | falta DTO de update pros 2 campos GD novos | Criar `UpdateCooperadoDto` com `@IsOptional` nos 2 campos |

**Reescopo:** `D-novo-CONVENIO-ORIGEM-LEDGER` rebaixado **P1 → P2** — a rastreabilidade
da origem já fica garantida indiretamente pela FK `CooperTokenCompra.convenioId` +
índice `[referenciaTabela, referenciaId]` no Ledger. `origemConvenioId` explícito no
Ledger vira **polimento** (não fundacional).

## Próximo passo

**Sprint Hardening Tenant-Spoof** (`feature/hardening-tenant-spoof`).

- Resolve `D-novo-COOPERADOS-CONTROLLER-TENANT-SPOOF` (P0) +
  `D-novo-CADASTRO-PUBLICO-TENANT-SPOOF` (P1) como **bloqueadores de exposição**
  antes de tunelar `/cadastro` público (ngrok / Cloudflare Tunnel pra teste real
  com Asaas sandbox).
- Fase 1 read-only **obrigatória** (Decisão 23): mapear **todas** as fontes de
  `cooperativaId` na request (body, query, params, headers, JWT) por endpoint
  em `cooperados.controller.ts`, `publico.controller.ts`, `convenios.controller.ts`,
  `cooper-token.controller.ts` — preservar o path legítimo de `SUPER_ADMIN` que
  pode operar cross-tenant via `impersonate`/`comoTenant`.
- Reviewers pesados antes do smoke (multitenant-reviewer obrigatório + security-reviewer).

## Carry-overs (não-bloqueantes)

- 6 decisões de produto pendentes do design 19/06 (família/migração/ciclo-de-vida).
- 7 débitos `D-novo-CONVENIO-*` ainda abertos do design (E1 P1 + ORIGEM-LEDGER P2
  rebaixado + FASE0-JURIDICO P0 + ...).
- Caminho de ativação produção saque colaborador comum (DESCONTO_FATURA) inalterado:
  ✅ parecer M42 + ✅ Salvaguarda 1+5 (M42) + ✅ Salvaguarda 4 (M41) +
  ✅ Throttler+Reconciliação (M43) + ⏳ parecer escrito + ⏳ flag .env prod.
- OPÇÃO A Sprint D-QUALIF-DECAY (~6-10h) — segue catalogado.
- OPÇÃO C Notificações Proativas (D-novo-RECONCILIACAO-DESISTIDO-LISTENER) — segue.

## Decisões catalogadas nesta sessão

1. **D20/06-1 — Slice decision-independent escolhido primeiro:** Luciano priorizou
   marcar recebe-créditos-GD como DADO (não bloqueia) sobre os outros caminhos
   do design 19/06 (família G1 / migração G2 / parecer Fase 0). Razão: zero
   dependência de decisão de escopo do piloto.
2. **D20/06-2 — Guard multi-tenant obrigatório, NÃO deferido:** orquestrador
   explicitou "VALIDADO agora, NÃO deferido" sobre `findFirst { id, cooperativaId }`
   antes do create. Aplicado desde a 1ª linha de código.
3. **D20/06-3 — Reescopo D-novo-CONVENIO-ORIGEM-LEDGER P1 → P2:** rastreabilidade
   indireta via FK suficiente; ledger explícito vira polimento.
4. **D20/06-4 — Sprint Hardening Tenant-Spoof como bloqueador de tunelamento:**
   antes de expor `/cadastro` público via ngrok/Cloudflare Tunnel, fechar P0 + P1
   pré-existentes descobertos pela investigação M44.

## Regras aplicadas

- ✅ Decisão 23 (validação prévia) — Fase 1 read-only ampla antes da Fase 2.
- ✅ Regra contatos teste 14/05 — smoke E2E preparado com `27981341348` + `lucbragatto+*@gmail.com`.
- ✅ FUNDACAO §4#1 invariante — Passivo == Σ saldos × face preservada (mudanças puramente aditivas).
- ✅ Padrão M39/M41/M42/M43 — branch dedicada → reviewers pesados → re-review orquestrador → merge --no-ff → feature branch preservada no origin.
- ✅ PM2 rebuild backend + frontend após mudança de código.
- ✅ Disciplina de análise modelo canônico primeiro — `D-novo-CONVENIO-*` cruzados com FUNDACAO antes de propor reescopo P1→P2.

## Frase comandante

Ver `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code`
(M44 atualizada, M43 arquivada).
