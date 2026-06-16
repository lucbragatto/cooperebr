# M41 — Saque PIX Colaborador Comum + D-RESGATE-PIX-SEM-CAIXA P1 fechado — 16/06/2026

## TL;DR

Sprint D2 entregue ponta-a-ponta em 7 commits + 1 merge `--no-ff` no main (`b622a87`). Cooperado COMUM (não-Estabelecimento) agora pode solicitar resgate de tokens em R$ via PIX quando a flag tenant `Cooperativa.saqueColaboradorAtivo` está ON + env `SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true` (em prod). Espelha o gate da oxidação. **De carona, fechou D-novo-RESGATE-PIX-SEM-CAIXA P1** (catalogado M40): agora todo resgate PIX (estab E colaborador) emite `LancamentoCaixa D Passivo (5.1.02) / C Caixa` pós-tx Serializable conforme FUNDACAO §2.1. Falha contábil rara → status `PAGO_CREDITO_PENDENTE` + evento `cooper-token-resgate.credito-pendente` (espelha F2 — princípio "nenhuma saída de caixa silenciosa"). 3 reviewers (financeiro-token + multitenant + security) → 0 P0/P1 abertos. Re-review orquestrador fechado em 1 ajuste (alerta evento). 60/60 specs verde + smoke E2E 16/16 PASS.

## Marco entregue

**M41 — Sprint D2 Saque PIX Colaborador Comum (+ carona D-RESGATE-PIX-SEM-CAIXA P1)**

## Commits do dia (7 + 1 merge + 1 fechamento)

| Hash | Tipo | Bloco/escopo |
|---|---|---|
| `e12ff29` | feat(schema) | (a) `Cooperativa.saqueColaboradorAtivo Boolean @default(false)` + `saqueColaboradorAtivadoEm DateTime?` |
| `d97cc49` | feat(cooper-token+saas) | (b) gate dual em `solicitarResgate` + endpoints SUPER_ADMIN `/saas/cooperativas/:id/saque-colaborador` + 15 specs |
| `88cd233` | feat(cooper-token+financeiro) | (c) `lancarResgatePix` + chamada obrigatória pós-tx Serializable + degradação `PAGO_CREDITO_PENDENTE` + 4 specs · **D-RESGATE-PIX-SEM-CAIXA P1 fechado** |
| `6453bc2` | feat(web+backend) | (d) UI super-admin toggle + portal cards condicionais + `/cooperados/meu-perfil` estendido |
| `fdfff9e` | test(smoke) | (e) E2E real `smoke-d2-saque-pix-colaborador.ts` PASS 16/16 |
| `ae14f83` | fix(d2) | 4 P1 + 5 P2 dos 3 reviewers (DTO, refId, tx, schema doc, assertHelper, coopIdEsperada obrigatório, arredondamento, .env.example) |
| `40a8c6e` | fix(d2) | re-review orquestrador: alerta `credito-pendente` espelha F2 + cataloga `D-novo-RECONCILIACAO-CONTABIL-CRON P2` |
| `b622a87` | merge | `feature/saque-pix-colaborador` → main `--no-ff` |
| _este_ | docs(sessao) | fechamento M41 |

## Entregas técnicas

### Backend gate dual + endpoint SUPER_ADMIN

- `backend/src/cooper-token/cooper-token.service.ts:solicitarResgate:2031`:
  - Cooperado ehEstabelecimento=true → SEMPRE autorizado (legado preservado).
  - Cooperado NÃO-Estab → autorizado SE `flag tenant` E (`!isAmbienteReal() || env LIBERADO`).
  - Mensagem genérica anti-enumeração (idêntica pra flag OFF e env OFF).
- `backend/src/saas/saas.controller.ts`:
  - `@Roles(SUPER_ADMIN) GET /saas/cooperativas/:id/saque-colaborador` — retorna `gateProducaoEfetivo` computed pro front decidir banner âmbar.
  - `@Roles(SUPER_ADMIN) PATCH /saas/cooperativas/:id/saque-colaborador` — toggle idempotente com `AuditLog 'saas.saque-colaborador.toggle'` + `ToggleSaqueColaboradorDto` (`@IsBoolean()` estrito — fecha P1 security DTO inline).
  - Ambos com `assertSameTenantOrSuperAdmin(req.user, id)` (defesa em profundidade P2 multitenant).

### Backend contábil pós-tx + alerta pendência

- `backend/src/financeiro/token-contabil.service.ts:lancarResgatePix(params)`:
  - Cria `LancamentoCaixa tipo='DESPESA' planoContasId=5.1.02` (Passivo Tokens — FUNDACAO §2.1 "D Passivo / C Caixa").
  - **Idempotente**: `findFirst` guard por `descricao` ANTES de criar (P1 financeiro: cron de reconciliação pode chamar 2× pro mesmo recibo).
  - `referenciaId` + `referenciaTabela` obrigatórios na assinatura.
  - Sem parâmetro `tx` enganoso (P1 financeiro: usa `this.prisma` direto pois é fora da tx Serializable por design).
- `backend/src/cooper-token/cooper-token.service.ts:processarWebhookResgate`:
  - Fail-fast: `tokenContabilService` ausente → throw ANTES da tx Serializable (Asaas re-envia).
  - Tx Serializable INALTERADA: CAS + queima saldo + ledger RESGATE_PIX + `ultimoWebhookEventId`.
  - Pós-tx: chama `lancarResgatePix` com `referenciaId, referenciaTabela='ResgateRecibo'`, `valor` arredondado (P2 financeiro).
  - **Caminho de falha contábil**: status degrada pra `PAGO_CREDITO_PENDENTE` + emite `cooper-token-resgate.credito-pendente` (espelha F2 `compra-pj.credito-pendente` — princípio "nenhuma saída de caixa silenciosa", re-review orquestrador).
  - `cooperativaIdEsperada` agora obrigatório no payload (P2 multitenant — fecha janela `findFirst` cross-tenant).

### Frontend portal + super-admin

- `web/app/portal/tokens/page.tsx`: card "Resgatar em R$ via PIX" agora aparece pra cooperado comum quando `saqueColaboradorAtivo=true` (carregado via `/cooperados/meu-perfil` estendido).
- `web/app/portal/resgatar-tokens/page.tsx`: guard relaxado pra aceitar `ehEstabelecimento OR saqueColaboradorAtivo`.
- `web/app/dashboard/super-admin/saque-colaborador/page.tsx` (NOVA, ~220L): toggle por cooperativa, banner âmbar quando env produção bloqueado.
- `web/app/dashboard/layout.tsx`: link "Saque PIX Colaborador" no sidebar SUPER_ADMIN.
- `backend/src/cooperados/cooperados.service.ts:meuPerfil`: include `cooperativa.saqueColaboradorAtivo` + expõe no root (espelha padrão `ehEstabelecimento`).

### Schema

`backend/prisma/schema.prisma`:
- `Cooperativa.saqueColaboradorAtivo Boolean @default(false)` + `saqueColaboradorAtivadoEm DateTime?` (aditivo).
- `ResgateRecibo.status` comment ampliado documentando `PAGO_CREDITO_PENDENTE` (P1 security — schema doc).

`backend/.env.example`:
- Bloco `SAQUE_COLABORADOR_PRODUCAO_LIBERADO=false` documentado (espelha `OXIDACAO_PRODUCAO_LIBERADA`), com aviso de parecer conformidade.

### Specs

**60/60 verde:**
- `cooper-token-f6-bloco-b.spec.ts` (34 — F6 existente + 5 atualizados pra `cooperativaIdEsperada=COOP`).
- `cooper-token-d2-saque-colaborador.spec.ts` (6 NOVO — gate dual em 4 quadrantes + estab legado + anti-enumeração).
- `cooper-token-d2-resgate-pix-contabil.spec.ts` (5 NOVO — happy path + tokenContabilService ausente + falha contábil + emite evento alerta + CAS perde).
- `saas-saque-colaborador.spec.ts` (9 NOVO — getStatus 5 casos + toggle 4 casos).
- `saas.service.spec.ts` (6 existentes preservados — gerarFaturasMensal).

### Smoke E2E

`backend/scripts/smoke-d2-saque-pix-colaborador.ts` (NOVO, ~390L):

| Passo | Ação | Resultado |
|---|---|---|
| Setup | SISGDSOLAR + flag tenant ON + PIN + chave PIX + saldo 10 tokens | ✅ idempotente |
| 1 | `POST /cooper-token/empresa/resgatar` (cooperado comum, 1 token) | ✅ recibo PENDENTE — **gate D2 funcionou** |
| 2 | `POST /cooper-token/admin/resgates/:id/aprovar` | ✅ SIMULATED PIX-out |
| 3 | `POST /asaas/webhook { event: TRANSFER_DONE }` | ✅ listener processa |
| 4 | Status final | ✅ PAGO_RECIBO_EMITIDO |
| 5 | Saldo queimado | ✅ disp -1, bloq=0 |
| 6 | Ledger RESGATE_PIX | ✅ 1 entry DEBITO qty=1 |
| 7 | **★ LancamentoCaixa D Passivo / C Caixa** | ✅ planoContas 5.1.02, tipo=DESPESA, valor R$ 0.45 |
| Cleanup | Restaura saldo + desliga flag + deleta artefatos | ✅ |

**16/16 PASS**.

## Bugs resolvidos / catalogados

| # | Severidade | Status |
|---|---|---|
| **D-novo-RESGATE-PIX-SEM-CAIXA** | 🔴 P1 (catalogado M40) | **RESOLVIDO** — `lancarResgatePix` cria LancamentoCaixa D Passivo/C Caixa pós-tx Serializable |

## Decisões estratégicas catalogadas

Nenhuma decisão de produto nova. Sprint estritamente técnico.

## Débitos novos catalogados em `debitos-tecnicos.md`

- **D-novo-RECONCILIACAO-CONTABIL-CRON P2** — cron de reconciliação re-tenta resgates em `PAGO_CREDITO_PENDENTE`. **Obrigatório antes do primeiro `SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true` em produção real.** Convive com D-novo-F6-RECONCILIACAO-CRON P2 (M35, mais amplo). Endpoint admin `GET /cooper-token/admin/resgates-pendentes-contabil` recomendado como fix paralelo.

## Invariante FUNDACAO §4#1 (`Passivo == Σ saldos × face`) — estado real

- ✅ **Caminho feliz** (smoke confirmou): saldo cai na tx Serializable; passivo cai via LancamentoCaixa pós-tx confiável. Atômico do ponto de vista observável (sem janela onde admin enxergue desbalanço).
- ⚠️ **Caminho de falha contábil** (raro — BD indisponível, plano contas migrado): degradado e **CONSULTÁVEL** via status `PAGO_CREDITO_PENDENTE` + evento alerta `cooper-token-resgate.credito-pendente` emitido pra admin/cron. Auto-heal pendente do **D-novo-RECONCILIACAO-CONTABIL-CRON P2** (catalogado hoje). **NÃO é "atômico" no pior caso** — é "observável e re-tentável", princípio "nenhuma saída de caixa silenciosa".

## Próximo passo

**Sprint D-QUALIF-DECAY** — Decaimento da qualificação (espelha oxidação do token; rebaixamento por inatividade; métrica uso+indicações, admin pondera). Catalogado em `debitos-tecnicos.md` como entrada de sprint nova ~6-10h. Entra antes do Sprint "Circuito de Emissão Completo" (4 fases).

Carry-over crítico para ativar Sprint D2 em produção real:
1. Implementar D-novo-RECONCILIACAO-CONTABIL-CRON P2.
2. Solicitar parecer escrito ao `cooperebr-analista-conformidade` (saque do membro comum é juridicamente sensível).
3. Setar `SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true` no `.env` de produção APÓS parecer.

## Pré-requisitos leitura próxima sessão

- `docs/sessoes/2026-06-16-m41-saque-pix-colaborador.md` (esta)
- `docs/FUNDACAO-COOPERTOKEN-MODELO-CANONICO.md` §2.1 + §4 (continua pré-req pra qualquer sprint que toque token)
- `docs/sessoes/2026-06-16-m40-abrir-cadastros-sisgd-teste.md` (correção D3 → D-QUALIF-DECAY)
- `backend/src/cooper-token/cooper-token.service.ts:3006` (`aplicarOxidacao` — molde do decaimento)
- `backend/src/clube-vantagens/` (qualificação atual — reavaliação existe, só não rebaixava)

## Carry-overs (não-bloqueantes)

- 8 M selados Cowork em `backend/src/concierge/*` + `package.json/lock` + `concierge.service.spec.ts` — território Cowork, intocados durante toda a sprint.
- **D-novo-RECONCILIACAO-CONTABIL-CRON P2** (catalogado hoje) — pré-req pra ativação produção.
- 3 P3 não aplicados (defer): comentário redundante linha 2622, spec eventId-novo+recibo-já-PAGO (caminho coberto pelo CAS perdedor), TOCTOU comment no gate.
- Branch `feature/saque-pix-colaborador` permanece no remote pra histórico (mergeada `--no-ff`).

## Regras aplicadas na sessão

- **Decisão 23**: Fase 1 read-only obrigatória + pausas pra OK Luciano antes de cada bloco.
- **`feedback_fase1_readonly_obrigatoria.md`**: Fase 1 mapeou ponto-a-ponto antes de codar.
- **CLAUDE.md "Disciplina de análise — modelo canônico primeiro" (16/06)**: FUNDACAO §2.1 norteou design contábil (`D Passivo / C Caixa`).
- **Gate dual espelha OXIDACAO_PRODUCAO_LIBERADA** (FUNDACAO §4#5).
- **Regra contatos teste (14/05)**: smoke usa whitelist `27981341348` + `lucbragatto+sisgd-teste@gmail.com`, ambienteTeste=true, 1 token + estorno via cleanup automático.
- **Regra Cowork-território (19/05)**: 8 M intocados durante toda a sprint.
- **NUNCA `git add .`** — todos os adds explícitos arquivo-a-arquivo.
- **Reviewers pesados ANTES do merge** (padrão M35/M39): 3 reviewers paralelo + re-review orquestrador.
- **Decisão 24**: frase de retomada em local único (CONTROLE-EXECUCAO § FRASE DE RETOMADA).

## Frase comandante

Ver `## FRASE DE RETOMADA — próxima sessão Code` em `docs/CONTROLE-EXECUCAO.md`.
