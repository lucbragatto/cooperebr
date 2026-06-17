# M43 — Sprint C Hardening de Segurança (Throttler + Reconciliação Contábil) — 17/06/2026

## TL;DR

Sprint M43 entrega Sprint C Hardening de Segurança ponta-a-ponta — fecha
2 carry-overs catalogados (`D-novo-THROTTLER-APP-GUARD P1` do M42 +
`D-novo-RECONCILIACAO-CONTABIL-CRON P2` do M41). 2 commits na branch
`feature/hardening-throttler-reconciliacao` + 1 merge `--no-ff` no main
(`beb125c`). 365/365 specs verde (+3 novos), smoke C1 5/5 + smoke C2
12/12 PASS contra `localhost:3000` com 3 papéis reais. 3 reviewers
pesados (security + financeiro-token + multitenant): 0 P0, 5 P1, 17 P2,
11 P3 únicos. 3 P1 + 5 P2 + 4 P3 sensatos APLICADOS. Re-review do
`cooperebr-orquestrador` APROVOU.

Caminho de ativação produção do saque colaborador comum (restrito a
DESCONTO_FATURA) agora tem TODAS as 4 salvaguardas + 2 hardenings
implementadas — falta apenas o parecer escrito do
`cooperebr-analista-conformidade` + flag
`SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true`.

## Marco entregue

**M43 — Sprint C Hardening: Throttler global + Reconciliação Contábil
cron.**

## Commits do dia (2 na feature + 1 merge no main + este fechamento)

| Hash | Mensagem |
|---|---|
| `2b2af66` | feat(hardening): Sprint C — Throttler global + Reconciliação contábil cron + reviewers aplicados |
| `beb125c` | **merge: feature/hardening-throttler-reconciliacao → main (M43 — Sprint C Hardening)** |

Branch `feature/hardening-throttler-reconciliacao` preservada no origin
(`--no-ff`, NÃO deletada — mesmo padrão M39/M41/M42).

## Entregas técnicas

### Bloco 1 — ThrottlerGuard global

**Onde:** `backend/src/app.module.ts`.

- `ThrottlerModule.forRoot([{name:'default', ttl:60s, limit:100},
  {name:'webhook', ttl:60s, limit:600}])` — 2 tiers.
- `{provide: APP_GUARD, useClass: ThrottlerGuard}` registrado **ANTES**
  do `JwtAuthGuard` — ordem importa pra anti-burst em rotas
  não-autenticadas (ex: `/auth/login` brute-force).
- 4 webhooks ganharam `@SkipThrottle({default:true})` +
  `@Throttle({webhook:{limit:600,ttl:60000}})`:
  - `POST /asaas/webhook` (`asaas.controller.ts`).
  - `POST /integracao-bancaria/webhook/bb` + `webhook/sicoob`
    (`integracao-bancaria.controller.ts`).
  - `POST /whatsapp/webhook-incoming` (`whatsapp-fatura.controller.ts`).

**Decisão Luciano (Fase 1 Q1):** teto ALTO (600/min) ao invés de
SkipThrottle total — mantém backstop anti-runaway sem quebrar pagamento;
429 absorvido por retry+backoff do remetente (Asaas + bancos retentam,
Baileys re-fila localmente) + idempotência do consumer.

### Bloco 2 — Reconciliação contábil cron

**Schema delta aditivo** em `ResgateRecibo` + índice composto pra cron
eficiente:

```prisma
reconciliacaoTentativas       Int       @default(0)
reconciliacaoUltimaEm         DateTime?
reconciliacaoProximaEm        DateTime?
reconciliacaoDesistido        Boolean   @default(false)
@@index([status, reconciliacaoDesistido, reconciliacaoProximaEm])
```

`prisma db push` aplicado. Retrocompatível: defaults seguros (`0`,
`null`, `false`); recibos antigos `PAGO_RECIBO_EMITIDO` não pegados pelo
cron (filtro por `status='PAGO_CREDITO_PENDENTE'`).

**Cron `@Cron('*/15 * * * *')`** `reconciliarContabilPendentes()` em
`cooper-token.job.ts`:

- Lista até 100 recibos `PAGO_CREDITO_PENDENTE` + `desistido=false` +
  `proximaEm<=now`, ordenados por `proximaEm asc`.
- Re-tenta `tokenContabilService.lancarResgatePix` (idempotente via
  `@@unique([origemTipo,origemId])` do `LancamentoCaixa` — P1 fix
  Sprint C).
- Sucesso → `updateMany pra PAGO_RECIBO_EMITIDO + zera retry state +
  motivoFalha=null`.
- Falha tentativas<5 → `updateMany incrementando + backoff
  [5min, 30min, 2h, 12h, 24h]`.
- 5ª falha → `reconciliacaoDesistido=true` + **AuditLog forense**
  (`acao='cooper-token.reconciliacao.desistido', usuarioId='SYSTEM_CRON',
  usuarioPerfil='SYSTEM', recursoId=recibo.id, cooperativaId`) +
  **emit evento** `cooper-token-resgate.reconciliacao-desistido`.

**Decisão Luciano (Fase 1 Q4):** cron SEMPRE LIGADO em prod (sem gate
`RECONCILIACAO_PRODUCAO_LIBERADO`) — é cron de cura passivo, só age
sobre estado degradado e nunca causa side effect novo (idempotente).

**Caminho do webhook PAGO** (`cooper-token.service.ts:~2945`) agora seta
os 4 campos retry ao virar `PAGO_CREDITO_PENDENTE`
(`reconciliacaoTentativas=0`, `reconciliacaoUltimaEm=now`,
`reconciliacaoProximaEm=now+5min`, `reconciliacaoDesistido=false`) —
arma estado pro cron pegar em até 15min.

**Endpoint admin trigger manual** `POST /cooper-token/admin/
reconciliacao/trigger` (`@Roles(SUPER_ADMIN)` + `@AuditLog` + `@Throttle
(3/min)`) pra ops em emergência + smoke E2E.

**Escopo da Sprint C (decisão Luciano Q2):** APENAS `ResgateRecibo`.
`CooperTokenCompra` (F2 compra PJ) `PAGO_CREDITO_PENDENTE` catalogado
separado como `D-novo-F2-RECONCILIACAO-CRON P2`.

### 3 reviewers pesados (0 P0, 5 P1, 17 P2, 11 P3 únicos)

| Reviewer | P0 | P1 | P2 | P3 |
|---|---|---|---|---|
| `security-reviewer` | 0 | 2 | 9 | 5 |
| `cooperebr-financeiro-token-reviewer` | 0 | 3 | 5 | 2 |
| `cooperebr-multitenant-reviewer` | 0 | 0 | 3 | 4 |

**3 P1 + 5 P2 + 4 P3 APLICADOS:**

| Fix | Origem | Onde |
|---|---|---|
| **P1.1 Backoff off-by-one** | financeiro-token | `cooper-token.job.ts:419` — `BACKOFF_MINUTOS[novaTentativa-1]`. 1ª falha agora 5min (era 30min — divergia da decisão Luciano aprovada). |
| **P1.2 Idempotência via `@@unique([origemTipo,origemId])`** | security + financeiro + multitenant convergem | `token-contabil.service.ts:215+` — `findFirst` soft removido; `create` agora preenche `origemTipo='TOKEN_TRANSACAO' + origemId=referenciaId`. Catch `P2002` → busca existente. Fecha race window cron×webhook replay sem precisar de tx Serializable. |
| **P1.3 `reconciliacaoUltimaEm` setado no webhook** | financeiro-token | `cooper-token.service.ts:~2945` — set no updateMany que vira `PAGO_CREDITO_PENDENTE` (trilha auditável da 1ª tentativa oficial). |
| P2 Token webhook só por header (Asaas) | security | `asaas.controller.ts` — removido fallback `@Body('token')`. |
| P2 `timingSafeEqual` constant-time | security | `integracao-bancaria.controller.ts` (`validateWebhookToken`) + `whatsapp-fatura.controller.ts` (`webhookIncoming`). Anti timing-attack. |
| P2 `valor` arredondado no AuditLog metadata | financeiro | `cooper-token.job.ts` — `Math.round(...×100)/100` (anti drift Decimal→Number). |
| P2 `asaasTransferId` truncado em logs/observacoes | security | `cooper-token.job.ts` — 8 chars + `…` (LGPD — superfície reduzida em exports contábeis). |
| P2 Env guard prod no smoke C2 | security | `scripts/smoke-c2-reconciliacao-contabil.ts` — abort se `NODE_ENV=production` sem `SMOKE_FORCE_PROD=true`. |
| P3 Emoji ✓/⚠/✗ → `[OK]/[WARN]/[ERR]` nos logs do cron | security | `cooper-token.job.ts` (Datadog/grep-parseável). |
| P3 Log warning `TokenContabilService` faltando em PROD | multitenant | `cooper-token.job.ts:~272` — warn explícito se `NODE_ENV=production` (cron silenciosamente desativado vira visível). |
| P3 Log warning `updateMany count=0` pós-sucesso | security | `cooper-token.job.ts` — race detectável (outra instância PM2 mudou estado). |
| P3 +3 specs novos | multitenant + security | `cooper-token-c-reconciliacao.spec.ts` — `10b` (`updateMany` falha defense in depth), `10c` (`updateMany` desistido defense in depth), `12` (AuditLog metadata sanitização LGPD). |

**Re-review do `cooperebr-orquestrador` APROVOU**: confirmou P1.2
`@@unique` + Throttler em APP_GUARD com webhooks tier 600 no código;
smoke C1+C2 verde.

**Skips explícitos** (catalogados como sugestões P3):
- Circuit breaker per-userId SUPER_ADMIN no trigger (P2 security —
  defere; AuditLog + @Throttle por IP é suficiente v1).
- Spec race condition unit do `lancarResgatePix` concorrente (P2 —
  cobertos pelos 11 specs unit + smoke C2 idempotência via @@unique).
- Validação token no controller asaas antes do service (P2 — service
  valida cedo, custo mínimo).
- Doc JWT no smoke C2 (P3 — já no header).
- Fairness inter-tenant docs (P3 — first-come-first-served por data
  é intencional v1).

### 3 débitos novos catalogados em `docs/debitos-tecnicos.md`

1. **`D-novo-F2-RECONCILIACAO-CRON P2`** — análogo da reconciliação pro
   caminho F2 (compra PJ). `CooperTokenCompra.status='PAGO_CREDITO_
   PENDENTE'` precisa do mesmo cron + schema delta. Quando atacar: se
   F2 começar a falhar com frequência observável OU em sprint
   contábil dedicada.
2. **`D-novo-RECONCILIACAO-DESISTIDO-LISTENER P2`** — listener do
   evento `cooper-token-resgate.reconciliacao-desistido` (security P1
   no review original, rebaixado pra P2 catalogado). Sem listener,
   alerta admin depende do AuditLog forense (admin precisa abrir
   tela de auditoria). v1 cobre via AuditLog + log error PM2;
   listener entra com sprint Notificações Proativas. **OBRIGATÓRIO**
   ao implementar: usar `payload.cooperativaId` (NUNCA
   `req.user.cooperativaId` — cron não tem req).
3. **`D-novo-RECONCILIACAO-RESETAR-ADMIN P2`** — endpoint admin pra
   resetar `reconciliacaoDesistido=false` em recibo curado pelo
   admin. ~30min Code futuro (endpoint + spec + smoke). Hoje admin
   pode usar SQL direto via Prisma Studio.

### Smoke E2E (5/5 + 12/12 PASS)

**`smoke-c1-throttler-burst.ts`** (5/5):
1. Default tier 100/min ATIVO no #101 (endpoint sem `@Throttle` cai
   em 429 após o 100º request).
2. `/asaas/webhook` absorve 200 burst sem 429 (tier `webhook` 600/min).
3. `/integracao-bancaria/webhook/bb` absorve 200.
4. `/integracao-bancaria/webhook/sicoob` absorve 200.
5. `/whatsapp/webhook-incoming` absorve 200.

**`smoke-c2-reconciliacao-contabil.ts`** (12/12):
1. CASO 1: Recibo `PAGO_CREDITO_PENDENTE` + cooperativa válida +
   `proximaEm` passada → trigger → status volta `PAGO_RECIBO_EMITIDO`
   + LancamentoCaixa D Passivo/C Caixa criado + retry state limpo.
2. CASO 2: Idempotência — 2º trigger no mesmo recibo NÃO duplica
   LancamentoCaixa (constraint `@@unique([origemTipo,origemId])`
   ATIVO).
3. CASO 3: Recibo com `proximaEm` futura → cron NÃO processa.
4. CASO 4: Recibo `desistido=true` → cron NÃO processa.
5. CASO 5: AuditLog do endpoint trigger gravado (3 entries — 4º
   request cai em `@Throttle(3/min)` do endpoint, comportamento
   defensivo).

Cleanup idempotente em ambos.

## Bugs descobertos / catalogados

- **Backoff off-by-one** (financeiro P1) — `BACKOFF_MINUTOS[novaTentativa]`
  pulava o primeiro item (1ª falha era 30min ao invés de 5min). Fix
  aplicado. Spec 3 + 11 ajustadas.
- **Race window webhook×cron em `lancarResgatePix`** (security + financeiro
  + multitenant P1 convergente) — `findFirst` soft sem unicidade de
  banco. Fix aplicado via `@@unique([origemTipo,origemId])`.
- **`reconciliacaoUltimaEm` não setado no webhook PAGO_CREDITO_PENDENTE**
  (financeiro P1) — trilha auditável incompleta (admin via
  `tentativas=0 + ultimaEm=null` não sabia se webhook já rodou). Fix
  aplicado.

## Decisões estratégicas catalogadas

1. **Throttler com tier `webhook` 600/min** (não SkipThrottle total) —
   backstop anti-runaway sem quebrar pagamento.
2. **Cron de cura SEMPRE LIGADO em prod** (sem gate `RECONCILIACAO_
   PRODUCAO_LIBERADO`) — passivo, idempotente, só age sobre estado
   degradado.
3. **Backoff `[5min, 30min, 2h, 12h, 24h]`** = 39h cobertura worst case
   antes de desistir.
4. **Idempotência por constraint de banco** > soft guard via findFirst.
   Padrão a estender pros outros lançamentos contábeis
   (`lancarCompraParceiroPago`, `lancarEmissaoAdminLote` etc — sprint
   contábil dedicada).
5. **Endpoint admin trigger manual** (com `@AuditLog` + `@Throttle 3/min`)
   é prática operacional saudável — admin tem ferramenta antes de
   recorrer ao SQL.
6. **AuditLog metadata sanitizado** (`valor` arredondado +
   `asaasTransferId` truncado) reduz superfície LGPD em exports.

## Próximo passo único e claro

**Próxima sprint:** Luciano decide entre:

- **Sprint D-QUALIF-DECAY** (Decaimento da Qualificação — próxima por
  padrão da fila desde M40, ~6-10h). Espelha `aplicarOxidacao` do
  token; rebaixa qualificação por inatividade.
- **Sprint Notificações Proativas** (closes
  `D-novo-RECONCILIACAO-DESISTIDO-LISTENER` + outros débitos antigos
  catalogados).
- **Sprint Circuito de Emissão Completo** (4 fases — contábil →
  notificações → emissão unificada → compra conveniado +
  auto-distribuição). Resolve 2 P1 + 7 P2 catalogados M40.
- **Ativação produção do saque colaborador comum** (DESCONTO_FATURA
  apenas): solicitar parecer escrito do
  `cooperebr-analista-conformidade` confirmando as 4 salvaguardas (S1
  M42, S4 M41, S5 M42, S1-hardening M43) + flag
  `SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true` em `.env` prod.

## Pré-requisitos leitura próxima sessão

- `docs/sessoes/2026-06-17-m43-sprint-c-hardening.md` (este doc).
- `docs/sessoes/2026-06-17-m42-d2.1-filtro-origem-disclaimer-versionado.md` (M42).
- `docs/sessoes/2026-06-16-m41-saque-pix-colaborador.md` (M41 base).
- `docs/relatorios/analise-conformidade-2026-06-16-saque-colaborador-d2.md`
  (parecer fonte das 5 salvaguardas).
- `docs/debitos-tecnicos.md` — 3 débitos novos do Sprint C:
  - `D-novo-F2-RECONCILIACAO-CRON P2`
  - `D-novo-RECONCILIACAO-DESISTIDO-LISTENER P2`
  - `D-novo-RECONCILIACAO-RESETAR-ADMIN P2`
- `docs/FUNDACAO-COOPERTOKEN-MODELO-CANONICO.md` (§2.1 contábil, §4#1
  invariante).
- `CLAUDE.md` (regras + disclaimer versionado + disciplina de análise).

## Carry-overs (não-bloqueantes)

- **8 do Cowork** (`backend/src/concierge/*` + `package.json/lock`)
  seguem intocados na working tree de main — território Cowork,
  próximo fechamento Cowork limpa.
- **Branch `feature/hardening-throttler-reconciliacao`** viva no
  origin (preservada pra histórico — não deletar, padrão M39/M41/M42).
- **3 débitos novos catalogados** (acima) — todos P2 não-bloqueantes.

## Caminho de ativação produção do saque colaborador comum (restrito a DESCONTO_FATURA)

- ✅ parecer (M40, 16/06) — 5 salvaguardas mapeadas.
- ✅ Salvaguarda 1 (M42 — filtro origem).
- ✅ Salvaguarda 4 (M41 — `PENDENTE_APROVACAO_COOP` obrigatório).
- ✅ Salvaguarda 5 (M42 — disclaimer versionado).
- ✅ D-novo-THROTTLER-APP-GUARD P1 (M43 — Sprint C Bloco 1).
- ✅ D-novo-RECONCILIACAO-CONTABIL-CRON P2 (M43 — Sprint C Bloco 2).
- ⏳ Parecer escrito do `cooperebr-analista-conformidade` confirmando.
- ⏳ Flag `SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true` em `.env` prod.

S2 (ata assembleia) + S3 (parecer trabalhista) são **ações legais do
Luciano** fora do path da ativação restrita — só viram código futuro se
Luciano expandir whitelist do filtro pra incluir `BONIFICACAO_ADMIN`
(após ata) ou tokens de empresa conveniada (após parecer trabalhista).

## Regras aplicadas na sessão

- **Decisão 23** — Fase 1 read-only obrigatória antes de tocar código.
  Mapeei Throttler + 4 webhooks + lancarResgatePix + caminho
  PAGO_CREDITO_PENDENTE + apresenttei MAPA DE IMPACTO + perguntas
  decisórias (Q1-Q5) — só prossegui pra Fase 2 após OK Luciano.
- **`feedback_fase1_readonly_obrigatoria.md`** — grep amplo +
  invariantes asseridas antes de Fase 2.
- **Disciplina de análise — modelo canônico primeiro** (16/06) — o
  cron foi derivado do invariante FUNDACAO §4#1 (Passivo == Σ saldos
  × face), com janela de degradação aceita explicitamente.
- **Defense in depth** — 3 reviewers consolidaram a mesma race
  condition (cron×webhook) por ângulos diferentes (idempotência soft
  / @@unique / race write) → fix único via constraint de banco.
- **`git add` arquivo por arquivo** — separa estritamente meus
  arquivos Sprint C dos 8 do Cowork.
- **Reviewers pesados ANTES de smoke** (padrão M39/M41/M42).
- **Re-review do orquestrador após fixes** — confirmou P1 fixes no
  código + smoke verde.
- **Merge `--no-ff`** preservando feature branch no origin.

## Frase comandante

Ver `## FRASE DE RETOMADA — próxima sessão Code` em
`docs/CONTROLE-EXECUCAO.md` (formato copy-paste).
