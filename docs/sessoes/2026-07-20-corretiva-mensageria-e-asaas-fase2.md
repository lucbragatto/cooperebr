# Fechamento 2026-07-20 — Corretiva Mensageria WA (finalização) + Asaas Webhook FASE 2 + higiene lateral

## TL;DR

Arco de 4 dias (2026-07-16 pós-fechamento anterior → 2026-07-20) com **18 commits em `main`**, todos pushados. Duas corretivas grandes fechadas + 4 blocos laterais de higiene/segurança.

- **Corretiva Mensageria WhatsApp** — finalizada com **9 achados totais** (não 5-7 como o fechamento anterior indicava). Achados 3 (webhook secret query→header) e 4 (ACL `auth_info`) implementados; achados 8 (Codex ACL no repo inteiro — vetor **cross-repo escrita**) e 9 (drift `COOPERTOKEN_QR_SECRET` triplicado) descobertos e catalogados. Runbook operacional `docs/seguranca/restart-coordenado-achado-3-4-8.md` com provas de identidade (webhook igualdade estrutural entre 2 `.env` + QR round-trip funcional). **Manutenção destrutiva PENDENTE — Luciano roda quando quiser.**
- **Corretiva Asaas Webhook FASE 2** — idempotência via nova tabela `WebhookEvent` (`@@unique([provider, eventId])`) + efeitos essenciais atômicos numa `$transaction` + fire-and-forget→awaited síncrono via `ModuleRef` lazy. **Provada end-to-end**: dedup live via smoke real contra o banco + rollback integration test permanente (regression guard). Débito P1 `A6` **RESOLVIDO**.
- **CooperToken FASE 2** — unique parcial `cooper_token_ledger_ref_origem_uniq` (SQL raw manual — Prisma não expressa) + `debitar` com `isolationLevel: Serializable` + `jti` no JWT do QR pra anti-replay. Revisor financeiro rodado, 4 correções aplicadas.
- **3 blocos laterais**: higiene raiz (logs+tmp órfãos), `whatsapp-service` bind loopback + secret nos `/send-*` (fecha vetor "qualquer host na LAN envia WA em nome da coop"), regressão frontend do bind loopback (proxy `/whatsapp/status` + `/whatsapp/reconnect` pelo backend), drift `emailAliasCampanha` resolvido casando schema com banco (piloto Santi preservado).

**Zero data-loss** em toda a sessão. Regra CLAUDE.md "db push em dev, NUNCA migrate" preservada e reforçada — `migrate dev` foi barrado 1 vez pelo Luciano quando ele detectou que teria proposto reset do banco de prod.

## Commits do arco (18 total, 764298c..71bc6e5)

| Hash | Mensagem | Bloco |
|---|---|---|
| `57e0285` | fix(seg): webhook WA — auth via header x-whatsapp-secret + helper unico (Achado 3) | Mensageria A3 |
| `cb7e7a4` | fix(seg): webhook WA — emissor+scripts pra header + sanitiza URL do log (Achado 3) | Mensageria A3 |
| `a3dac52` | docs(seg): README whatsapp-service + procedimento restart coordenado 3+4 (+ possivel 8) | Mensageria A4 |
| `197f60c` | docs(seg): adiciona Bloco 8 (remocao Codex do repo) + reordena procedimento 8->4->3 | Mensageria A8 |
| `69a349d` | docs(seg): Achado 9 — consolidar COOPERTOKEN_QR_SECRET no Bloco 3.1b (Luciano roda) | Mensageria A9 |
| `7fffb62` | docs(seg): Bloco 3.3 — smoke FUNCIONAL pos-restart (webhook + QR round-trip) | Mensageria runbook |
| `1f5fe01` | docs(seg): Bloco 3.3.2b + 3.3.2c — prova de igualdade e round-trip real WA | Mensageria runbook |
| `2297856` | chore(higiene): remove logs e tmp orfaos da raiz + gitignore | Higiene |
| `d5e547c` | fix(seg): whatsapp-service exige secret nos /send-* + bind loopback | Segurança wa-service |
| `951f455` | fix(seg): frontend usa /whatsapp/status do backend (regressao bind loopback T2) | Regressão wa-service |
| `472f6d7` | fix(fin): CooperToken FASE 2 — idempotencia unique parcial + Serializable debitar + jti anti-replay QR | CooperToken FASE 2 |
| `53e1065` | fix(fin): Asaas webhook FASE 2 — WebhookEvent insert-first + darBaixaTx sync + creditarTx tx-aware | Asaas FASE 2 |
| `26b4d69` | docs(seg): elevar A6 (smoke real webhook) + drift schema pra P1 antes do push | Asaas FASE 2 |
| `23df61a` | docs(seg): corrige D-novo-SCHEMA-DRIFT-EMAILALIASCAMPANHA — NAO dropar (sprint mascara viva) | Drift |
| `c186fc0` | docs(seg): remove `migrate dev` do fix de drift + cataloga migrations abandonadas (P2 separado) | Drift |
| `a2cc4e0` | fix(schema): re-adiciona emailAliasCampanha (piloto Santi) — resolve drift sem data-loss | Drift resolvido |
| `71bc6e5` | test(seg): integration spec rollback webhook + smoke dedup live (A6 P1 resolvido) | Asaas smoke A6 |

## Corretiva Mensageria WA — finalização (9 achados, não 5-7)

### Achado 3 — webhook secret query→header (`57e0285` + `cb7e7a4`)

- Receptor `backend/whatsapp-fatura.controller.ts`: `x-whatsapp-secret` (preferencial) + query fallback com `logger.warn`. Helper único `secretConfere` (length check antes de `timingSafeEqual`). Spec com 5 cenários canônicos + mutação demonstrada.
- Emissor `whatsapp-service/index.mjs`: fetch com header + defense-in-depth `limparSecretDaUrl` no boot (se `.env` real ainda tiver `?secret=` embutido, remove em memória + WARN loud) + startup log sanitizado.
- Scripts `smoke-c1-throttler-burst` + `test-endpoints` migrados no mesmo commit.
- Estrutura de 2 commits (receptor+spec / emissor+scripts) aprovada pelo Luciano na Fase 1.

### Achado 4 — ACL `auth_info/` + README (`a3dac52`)

- README `whatsapp-service/README.md` "a pasta É a credencial" — 4 regras invioláveis (nunca commitar, nunca copiar fora do host, nunca compartilhar prints, ACL restrita), viabilidade de cifra em repouso (EFS recomendado / BitLocker complementar / app-level rejeitado).
- Runbook `docs/seguranca/restart-coordenado-achado-3-4.md` com 5 blocos operacionais (backup ACL → PM2 stop → icacls atômico → verificação → rollback).
- **Comando destrutivo pendente — Luciano roda** (`icacls /inheritance:r + /grant:r` no `auth_info`).

### Achado 8 — Codex sandbox no ACL do repo (`197f60c`)

**Descoberto na varredura ACL da Fase 1 do Achado 4.** `CodexSandboxUsers` (contas `CodexSandboxOffline` + `CodexSandboxOnline`) + SID órfão `S-1-5-21-...-1805928900` têm **Modify+Delete Children explicitamente aplicado em `C:\Users\Luciano\cooperebr`** — herdado por todo o repo (`.env`, `.git`, `auth_info`, código). **Não é só leitura — é escrita**.

Luciano confirmou: não usa Codex neste repo → grant é resíduo, remoção cirúrgica segura. Runbook renomeado pra `restart-coordenado-achado-3-4-8.md` com ordem canônica **8 → 4 → 3** (remover Codex do repo inteiro primeiro, depois tighten do `auth_info`, depois rotação do secret WA). `/remove:g` cirúrgico (não `/inheritance:r` no root — largo demais). Backup ACL antes de cada `icacls`. **Comando destrutivo pendente — Luciano roda.**

### Achado 9 — drift `COOPERTOKEN_QR_SECRET` triplicado (`69a349d`)

Descoberto na triagem read-only pós-push da Fase 2 do Achado 3. `backend/.env` tinha o mesmo secret repetido em 3 linhas com **3 valores DIFERENTES** (48/0/44 chars). Comportamento dotenv "última vence" → linha 76 (44 chars) ativa em runtime. Auditoria read-only confirmou:
- `.env` last-modified `2026-06-08` (5+ semanas antes do boot atual)
- Simulação `dotenv.config()` no CWD backend + zero override do SO → `length=44` (bate com linha 76)
- Nenhum override em `[System.Environment]::GetEnvironmentVariable`

Consolidação passiva: apagar linhas 73 (órfã) + 75 (vazia), manter 76 (ativa). **Comportamento-zero em runtime** — o backend já usa linha 76. Encaixado no Bloco 3.1b do runbook. **Pendente — Luciano roda.**

### Runbook operacional consolidado (`7fffb62` + `1f5fe01`)

`docs/seguranca/restart-coordenado-achado-3-4-8.md` — o guia canônico dos comandos destrutivos que o Luciano vai rodar quando quiser. Ordem: 8 → 4 → 3.

Provas obrigatórias pós-restart (smoke funcional, não estrutural):
- **3.3.2b — Igualdade WEBHOOK_SECRET entre 2 `.env`** (comparação estrutural sem ecoar valor): se divergem, rotação vazou pela metade, bot fica mudo silenciosamente.
- **3.3.2c — Round-trip real** (opcional ouro): mensagem manual do `27981341348` pro bot → grep log do backend por `"Mensagem recebida"` (não `UnauthorizedException`). Prova cadeia inteira emissor↔receptor em runtime real.
- **3.3.3 — QR round-trip funcional** (Achado 9): login como cooperado → `POST /cooper-token/gerar-qr-pagamento` → `node -e require('dotenv').config(); jwt.verify(token, secret)`. Se valida, runtime e `.env` batem exatamente.
- **3.3.4 — Verificação estrutural** (`.Count=1` nas linhas do `.env`).

Nota empírica registrada: `pm2 env <id>` **não expõe** variáveis carregadas via `ConfigModule`/dotenv (comprovado com `WHATSAPP_WEBHOOK_SECRET` E `COOPERTOKEN_QR_SECRET` — ambos ausentes em `pm2 env 0`). Não usar `pm2 env` pra ler length de secret dotenv-loaded.

## Corretiva Asaas Webhook FASE 2 (6 commits `53e1065..71bc6e5`)

Fecha 4 bugs financeiros graves:
1. Perda silenciosa pós-confirmação (fire-and-forget → sync awaited).
2. Dedup slot-único não-atômico (`AsaasCobranca.ultimoWebhookEventId`) → `WebhookEvent @@unique([provider, eventId])`.
3. PAYMENT_OVERDUE silencioso → dentro da tx (falha vira 500 pra Asaas retry).
4. Efeitos essenciais fora da atomicidade (nested-tx) → novos métodos tx-aware `darBaixaTx` + `creditarTx`; originais `darBaixa`/`creditar` intocados (compat).

### Idempotência via WebhookEvent

Nova tabela `webhook_events` (aplicada via SQL raw one-off — bypass do `db push` bloqueado por drift `emailAliasCampanha`, catalogado como P1 separado). `processarWebhook` insere primeiro dentro da `$transaction`; P2002 no unique = duplicado → 200 `{skipped:'duplicado'}` sem re-aplicar efeitos.

### Refactor tx-aware Opção C

- `CobrancasService.darBaixaTx(tx, params)` — essenciais atômicos: Cobranca.updateMany PAGO (CAS `notIn ['PAGO','CANCELADO']`), LancamentoCaixa PREVISTO→REALIZADO, tokens CLUBE (via `creditarTx`).
- `CobrancasService.executarPosBaixaBestEffort` — extraído da parte pós-essencial do `darBaixa` original: hook CT.3, notificações WA/Email, evento `cobranca.primeira.paga` (MLM cascade), métricas Clube. Chamada FORA da tx com `.catch(warn)` — falha aqui não reverte pagamento.
- `CooperTokenService.creditarTx(tx, params)` — CORE do creditar (saldo + ledger + PROVISIONAL) sem $tx própria, com fast-path idempotente via unique parcial.

### ModuleRef lazy (não forwardRef)

Primeira tentativa com `forwardRef` quebrou o Nest — ciclo triangular `GatewayPagamentoModule → AsaasModule → CobrancasModule → GatewayPagamentoModule` (aresta `Cobrancas→Gateway` já existia; a aresta nova `Asaas→Cobrancas` fechou o triângulo, e `forwardRef` sozinho não resolveu com Whatsapp/Faturas/CooperToken no grafo).

Solução: `ModuleRef.get({ strict: false })` LAZY no runtime + cache privado. `import type { CobrancasService }` (type-only) pra evitar circular no compile-time. **Zero aresta nova no grafo de módulos.**

### Fixes do revisor `cooperebr-financeiro-token-reviewer` (aplicados)

- **A1 P1** — `valorPago` de `payment.value` (JSON externo) sem `Math.round(x*100)/100` → aplicado em `darBaixaTx:537`. Evita drift de float propagando pra Cobranca.valorPago + LancamentoCaixa.valor.
- **A2 P2** — arredondamento token 4 casas (Decimal 10,4) em `descontoNaoAplicado` + `novoValor`/`novoTotalEmitido` do saldo. Evita acúmulo de drift no `saldoDisponivel`.
- **A3 P2** — PAYMENT_OVERDUE fora da tx → MOVIDO pra dentro. Falha vira 500 pra Asaas retry.
- **A4/A5/A6/A7** — catalogados como débitos separados (fora do escopo desta sessão), com uma exceção: **A6 foi elevado a P1 pré-push** pelo próprio Luciano após revisar o código: "idempotência com Prisma mockado é design, não prova". Cumprido no fim da sessão.

### METADE 1 do A6 — smoke dedup live

Script one-off `__smoke-webhook-setup.ts` (deletado após uso) criou cadeia completa (cooperado SMOKE + uc + contrato + cobrança CLUBE + asaasCobranca) via Prisma direto contra o banco Supabase real, disparou POST do mesmo eventId 2× no backend rodando:
```
1ª: status=200 body={"received":true}
2ª: status=200 body={"received":true,"skipped":"duplicado"}
```
SELECTs pós: `webhook_events`=1 linha, `cobranca.status=PAGO valorPago=100`, `cooper_token_ledger`=1 crédito de 19.6 tokens (após taxa emissão default 2%), `cooper_token_saldo=19.6`.

Notif whitelistada: WA foi pro Luciano (`27981341348` whitelist), email SKIPPED (`lucbragatto+smoke@gmail.com` não é whitelist canônica — só `lucbragatto@gmail.com` base). **Zero risco pra cooperado real** — regra 14/05 preservada.

### METADE 2 do A6 — rollback integration test permanente

`backend/src/asaas/asaas-webhook-rollback.integration.spec.ts` (regression guard permanente). 2 testes contra o banco real:

- **Test 1**: mock `CobrancasService.darBaixaTx` throw `SMOKE-ROLLBACK-INJECTION`. Asserts: throw propagou + `darBaixaTx` chamado 1x + `executarPosBaixaBestEffort` NÃO alcançado + `webhook_events` count=0 (rollback do Postgres) + Cobranca ainda `PENDENTE` + AsaasCobranca ainda `PENDING` + ledger count=0.
- **Test 2**: re-entrega após rollback completa fluxo normal — prova que rollback não deixou lock/estado sujo. `webhook_events`=1, `executarPosBaixaBestEffort` alcançado, AsaasCobranca `RECEIVED`.

**Idempotência + rollback do webhook Asaas provados end-to-end.**

## Blocos laterais

### Higiene raiz (`2297856`)

Deletados: 9 `backend*.log` untracked (gitignore `*.log` já pega) + 6 `tmp_*.json` tracked (via `git rm`) + `check-leads.mjs` tracked. `.gitignore` da raiz ganhou `logs/` explícito + `tmp_*.json`. Grep confirmou zero referências em `backend/src`, `scripts`, `whatsapp-service`.

### `whatsapp-service` bind loopback + secret nos `/send-*` (`d5e547c` + `951f455`)

**Achado**: `whatsapp-service` expunha `POST /send-message`, `/send-list`, `/send-buttons`, `/send-interactive`, `/send-document` **SEM auth**, com CORS `*` e bind em `0.0.0.0`. Qualquer host na LAN podia disparar WhatsApp em nome da CoopereBR.

Fix:
- `crypto` + helper `secretConfere` + middleware fail-closed nos `/send-*` exigindo `x-whatsapp-secret` == `WHATSAPP_WEBHOOK_SECRET`.
- `app.listen(PORT, '127.0.0.1', ...)` — bind loopback fecha exposição de rede.
- Middleware CORS removido (loopback torna sem sentido).
- Backend `WhatsappSenderService` ganha `waSecret` + `authHeaders()` — 4 fetch migrados (`send-message`, espelho super-admin, `send-list`, `send-document`).

Regressão conhecida documentada no commit: `web/app/dashboard/whatsapp/page.tsx` fazia GET/POST direto em `:3002/status` e `/reconnect` do browser — quebrou. Fix separado no `951f455`: backend ganha `POST /whatsapp/reconnect` (proxy via `sender.reconnect()` com header injetado); frontend migra ambos os callers pra `api.get('/whatsapp/status')` e `api.post('/whatsapp/reconnect')`. Remove `import axios` + constante `WHATSAPP_SERVICE_URL`.

### CooperToken FASE 2 (`472f6d7`)

Sessão dedicada anterior nesta corretiva. Fecha 3 bugs financeiros críticos:
1. `creditar` findFirst fora da `$transaction` + sem unique no ledger → race → duplo-crédito.
2. `debitar` sem `isolationLevel` → check-then-write sem row-lock → duplo-gasto/saldo negativo.
3. QR sem `jti` no payload assinado → helper gerava jti interno a cada chamada → replay do mesmo qrToken dentro dos 5min = duplo débito.

Fixes:
- **Unique parcial SQL manual** `cooper_token_ledger_ref_origem_uniq` — Prisma não expressa `@@unique` parcial com WHERE, criado via `prisma.$executeRawUnsafe` (script `__apply-cooper-token-ledger-uniq.ts` deletado após uso). Escopo: `(cooperativaId, referenciaTabela, referenciaId, operacao)` WHERE `referenciaId IS NOT NULL AND referenciaTabela IS NOT NULL AND referenciaTabela <> 'RECONCILIACAO_HISTORICA'`. Documentado no `schema.prisma` como comentário grande + warning "não perder no reset".
- **Dupla camada de idempotência no `creditar`**: fast-path `findFirst` pré-tx (evita abrir tx no retry óbvio) + try/catch P2002 pós-tx (defesa REAL contra race).
- **`debitar`** ganha `isolationLevel: Serializable` + retry wrapper pra `40001 SerializationFailure` (3 tentativas, backoff 100/200/400ms) + novo param `referenciaTabela` gravado no ledger + try/catch P2002 idempotente.
- **Callers do `debitar` atualizados**: `cobrancas.service.ts:324` → `referenciaTabela: 'Cobranca'`; `clube-vantagens.service.ts:777` → `referenciaTabela: 'OfertaClube'`.
- **QR anti-replay**: `gerarQrPagamento` inclui `jti = gerarTokenHex(16)` no payload assinado; `processarPagamentoQr` extrai + rejeita QR legado sem jti + passa pro helper `criarTokenTransacao` (já aceitava param `jti` opcional). P2002 no `TokenTransacao.jti @unique` → `409 Conflict "QR já utilizado"`.

Revisor `cooperebr-financeiro-token-reviewer` rodou. 3 fixes aplicados: P2 #1 (retry 40001), P2 #2 (`usarNaFatura` inline sem `referenciaTabela` — mesmo bug do double-click), P3 #3 (`findFirst` pós-P2002 sem `cooperadoId` no where). Débito P2 A.2 `D-novo-CT-QR-DIRIGIDO-A2` catalogado (gap P2P mesmo-tenant aceito como modelo atual).

Suite `jest src/cooper-token/`: **421/421 passing** (29 suites).

### Drift `emailAliasCampanha` (`23df61a` + `c186fc0` + `a2cc4e0`)

Descoberto quando `prisma db push` bloqueou aplicação do model `WebhookEvent`. Sequência de correções:
- **1ª iteração** (`23df61a`): auditoria read-only mostrou que o campo é da sprint **PAUSADA e VIVA** `feature/mascara-email-convenio` (branch existe local + `origin`, 1 commit ahead: `7745082 feat(campanha): máscara de e-mail por convênio`). Valor único no banco: `"santi"` — piloto ATIVO da Santi Medicina Diagnostica (CNPJ 12.033.286/0001-90, tenant CoopereBR principal, criado 2026-06-09). Recomendação revertida: **NÃO dropar** — adicionar de volta pra casar com o banco.
- **2ª iteração** (`c186fc0`): Luciano alertou que a recomendação de rodar `prisma migrate dev --name add_webhook_events` estava ERRADA — o projeto usa `db push` desde 2026-05-26 (CLAUDE.md: "db push em dev, NUNCA migrate"); a pasta `migrations/` está congelada e o banco drifou meses à frente. `migrate dev` teria proposto RESET DO BANCO DE PRODUÇÃO (307 cooperados). **Barrado antes de executar.** Novo débito P2 separado `D-novo-MIGRATIONS-ABANDONADAS` catalogado (reconciliação real requer sessão dedicada, jamais casual).
- **3ª iteração — execução (`a2cc4e0`)**: adicionado `emailAliasCampanha String? @unique` byte-a-byte igual ao branch em `ContratoConvenio:1808` do `main:schema.prisma`. `prisma db push --skip-generate` (com PM2 stop + porta 3000 livre) → `"Your database is now in sync with your Prisma schema"`. Re-rodada 2× confirmou idempotência: `"The database is already in sync"`. **Zero DDL executado, zero data-loss.** Backend restartado pós-schema, PID novo, restart-count=0. `--skip-generate` foi certo — o campo NÃO é usado no `backend/src`, client atual funciona igual.

## Débitos técnicos

### Novos catalogados nesta sessão

| ID | Sev | Descrição |
|---|---|---|
| `D-novo-CT-QR-DIRIGIDO-A2` | P2 | QR mesmo-tenant não amarra `recebedorId` no payload — cessão P2P inadvertida. Fix futuro: modo "dirigido" opcional. |
| `D-novo-WEBHOOK-PJ-SLOT-UNICO` | P2 | Listener `cooper-token-compra-pj.paga` mantém slot único `CooperTokenCompra.ultimoWebhookEventId` (não migrou pro `WebhookEvent`). Race extrema pode gerar creditação dupla PJ. |
| `D-novo-CT3-CRON-RECONCILIACAO` | P2 | Hook CT.3 fiscal roda em `executarPosBaixaBestEffort` (`.catch(logger.error)`); se falha, `Cobranca` PAGO mas `LancamentoContabil` ausente. Sem cron de reconciliação, gaps silenciosos na segregação Art. 87. |
| `D-novo-CT-MLM-ATOMICO` | P2 | `processarPrimeiraFaturaPaga` não atômico — flip status ANTES do create `BeneficioIndicacao`. Crash no meio perde bônus do indicador silenciosamente. |
| `D-novo-ASAAS-FINDFIRST-FORA-TX` | P3 | `asaasCobranca.findFirst` em `asaas.service.ts:520-539` roda ANTES da `$transaction`. Sem risco (CAS cobre) — débito de design. |
| `D-novo-MIGRATIONS-ABANDONADAS` | P2 | Pasta `backend/prisma/migrations/` congelada em 2026-05-26 (5 migrations reais + 14 `.sql` soltos mistos). Reconciliação requer sessão dedicada, JAMAIS `migrate dev` casual. |
| `D-novo-DRIFT-EMAILALIASCAMPANHA` (RESOLVIDO) | ~P1~ ✅ | Drift `contratos_convenio.emailAliasCampanha` — resolvido casando schema com banco. |
| `D-novo-WEBHOOK-ROLLBACK-INTEGRATION-TEST` (RESOLVIDO) | ~P1~ ✅ | Smoke A6 provado end-to-end (dedup live + rollback integration). |

### Resolvidos

- ✅ `D-novo-DRIFT-EMAILALIASCAMPANHA` — commit `a2cc4e0`, casando schema com banco (piloto Santi preservado).
- ✅ `D-novo-WEBHOOK-ROLLBACK-INTEGRATION-TEST` (A6) — commit `71bc6e5`, 2 metades provadas.

## Lição de método (registrar, não é anedota)

### Varredura de propagação — "onde mais esse dado vai parar?"

Os **3 achados mais graves da corretiva Mensageria (5, 6, 7 no fechamento anterior; 8, 9 nesta sessão) NÃO vieram da auditoria original**. Vieram de perguntar, depois de cada correção:

> **"Onde mais esse dado vai parar?"**

Sessão anterior (16/07):
- Após A1 (redigir OTP no espelho) → V2 → **A5** (OTP também em `mensagens_whatsapp.conteudo`).
- Após A5 → V3 → **A6** (inbound do PIN também em `mensagens_whatsapp.conteudo`).
- Após A6 → V4 → **A7** (PIN também em `ConversaWhatsapp.dadosTemp`).

Esta sessão (20/07):
- Após A3 (secret query→header + defense-in-depth `.env` sanitize) → varredura ACL → **A8** (Codex sandbox no ACL do repo INTEIRO — não só `auth_info`).
- Após triagem pós-push do Asaas Fase 2 → grep `.env` → **A9** (`COOPERTOKEN_QR_SECRET` triplicado com 3 valores diferentes).

**Regra derivada e reforçada**: todo achado de vazamento aciona varredura de propagação. Achado individual sem varredura é meia correção. Nesta sessão, foi ampliada pra: **varredura ACL** (achado 8), **varredura de configuração** (achado 9), **varredura de branch pausada** (recomendação salva pra drift).

### "Olhar antes de executar" — barrou 2 comandos que teriam causado incidentes

1. **Drift `emailAliasCampanha`**: primeira recomendação foi "drop coluna morta" (Fase 1 read-only). Luciano alertou que o campo é de sprint VIVA (branch `feature/mascara-email-convenio` com piloto Santi ATIVO). Auditoria confirmou: 1 valor `"santi"` em `ContratoConvenio` da Santi Medicina, tenant CoopereBR principal. **Se tivesse dropado, perderia configuração de campanha ativa + churn na retomada do sprint.**
2. **`prisma migrate dev --name add_webhook_events`**: segunda recomendação foi rodar `migrate dev` pra selar migration formal da nova tabela `webhook_events`. Luciano alertou que o projeto usa `db push` desde 2026-05-26 (CLAUDE.md: "db push em dev, NUNCA migrate"); a pasta `migrations/` está congelada e o banco drifou meses à frente. **`migrate dev` teria detectado o drift e proposto reset do banco de produção com 307 cooperados.**

**Padrão observado**: recomendações plausíveis mas destrutivas passam despercebidas em Fase 1 read-only se a auditoria não cruza com estado do banco + branches vivas + política canônica do projeto. **Regra reforçada**: antes de qualquer schema change ou drop, cruzar 3 fontes: (a) auditoria do dado no banco, (b) branches vivas que podem re-adicionar, (c) política CLAUDE.md do projeto (db push vs migrate). Foi o que barrou os 2 incidentes.

### `pm2 env` não expõe dotenv-loaded (nota empírica)

Descoberto na Fase 1 do Achado 9. `pm2 env <id>` só mostra vars que o PM2 propaga — NestJS `ConfigModule` sobe as vars do `.env` fora do registro do PM2. Confirmado com `WHATSAPP_WEBHOOK_SECRET` E `COOPERTOKEN_QR_SECRET` ambos ausentes. **Não usar `pm2 env` pra ler length de secret dotenv-loaded — usar simulação `dotenv.config()` no CWD do processo OU round-trip funcional (mais forte).** Registrado no runbook `restart-coordenado-achado-3-4-8.md`.

### PM2 zombie após `stop`

Descoberto na Fase 2 do drift. `pm2 stop cooperebr-backend` marcou stopped mas node.exe zombie (PID 5088) continuou segurando a porta 3000. `taskkill //F //PID` necessário — CLAUDE.md já alertava sobre isso ("PM2 pode ressuscitar processos, criando zombies"). Confirmação empírica.

## Pendências pra próxima sessão

### Manutenção destrutiva Mensageria WA (Luciano roda)

`docs/seguranca/restart-coordenado-achado-3-4-8.md` — sequência canônica em 3 blocos (8 → 4 → 3):
- **Bloco 8**: `icacls /remove:g "CodexSandboxUsers"` + `/remove:g "*SID-orfão"` em `C:\Users\Luciano\cooperebr` com `/T`. Backup ACL antes. Verificação pós (ACL sem esses dois principals).
- **Bloco 4**: parar Baileys pra liberar file locks + `icacls /inheritance:r /grant:r "Luciano:(OI)(CI)(F)" "SYSTEM:..." "Administradores:..."` no `auth_info` /T (atômico).
- **Bloco 3**: gerar `WHATSAPP_WEBHOOK_SECRET` novo (`RandomNumberGenerator` no PowerShell, clipboard-only, NÃO colar valor em report) + editar os DOIS `.env` (backend + wa-service) + limpar `?secret=` do `BACKEND_WEBHOOK_URL` + consolidar `COOPERTOKEN_QR_SECRET` (Achado 9: apagar linhas 73 e 75, manter 76) + rebuild backend + `pm2 restart cooperebr-whatsapp` (Baileys reconecta sem QR novo).
- **Bloco 5** (smoke pós-restart): 4 sub-testes obrigatórios — WA-service `/status connected` + webhook 401 sem secret / 200 com header novo + warn ausente + **igualdade dos 2 `.env`** + **round-trip real com `27981341348`** + **QR round-trip funcional**.
- **Bloco 6**: monitor `warn=0` no tráfego real por 1 ciclo (24h) — se o warn `[WA-WEBHOOK] Secret via query string (deprecated)` NÃO aparece, agendar cleanup do fallback query no receptor (`D-novo-CT-MLM-ATOMICO` catalogado).

### Tarefa 4 — Asaas emissão (sessão dedicada + revisor obrigatório)

Fixes 3 defeitos:
1. `cobrancas.service.ts:362-376` e `:887-890` engolem exceção da emissão 2× com `logger.warn` + retornam a cobrança normalmente → cobrança sem boleto/PIX + cooperado notificado mesmo assim + nada reprocessa. Retry por `statusEmissao=AGUARDANDO_EMISSAO` só no caminho de convênio (`convenios.job.ts`) — regular não seta.
2. `AsaasService.emitirCobranca` (`asaas.service.ts:260`) faz POST `/payments` SEM `externalReference` SEM idempotency key + `AsaasCobranca` sem unique em `cobrancaId`/`asaasId` → double-click/retry = cobrança dupla REAL. **Auditoria confirmou 0 duplicatas hoje** — fix-forward puro.
3. POST e `asaasCobranca.create` sequenciais não-transacionais (`:260/:269`) → órfã possível.

Fix aprovado da Fase 1 (documento futuro):
- `externalReference = cobrancaId` no POST + `@@unique` em `AsaasCobranca(cobrancaId)`. Look-before-emit → retorna existente se já postou.
- Unificar retry: caminho regular seta `statusEmissao=AGUARDANDO_EMISSAO` + estender cron do convênio pra varrer regulares também. **NÃO notificar cooperado enquanto não houver instrumento de pagamento emitido.**
- Reconciliação de órfã: se POST OK mas `create` local falha, persistir `asaasId` retornado (ou reconciliar via `externalReference`).

### Outros débitos catalogados

- `D-novo-WEBHOOK-PJ-SLOT-UNICO` (P2) — migrar listener PJ pro WebhookEvent.
- `D-novo-CT3-CRON-RECONCILIACAO` (P2) — cron reconciliador CT.3 fiscal.
- `D-novo-CT-MLM-ATOMICO` (P2) — `processarPrimeiraFaturaPaga` atômico + cron.
- `D-novo-MIGRATIONS-ABANDONADAS` (P2) — reconciliação sessão dedicada.
- `D-novo-ASAAS-FINDFIRST-FORA-TX` (P3) — `findFirst` pré-tx (CAS cobre).
- Tarefas 6/7/8 do arquivo original — email OCR move seletivo, sender WA/email status, fatura OCR schema zod.

## Regras aplicadas na sessão

- **regra_fechamento_sessao_inegociavel** (13/05) — este doc é o registro consolidado do arco.
- **regra_contato_teste_impreterivel** (14/05) — smoke live METADE 1 usou `27981341348` + `lucbragatto+smoke@gmail.com` (alias `+suffix` não canônico, SKIPPED). Zero cooperado real tocado.
- **regra_validacao_previa_e_retomada** (Decisões 15/20/23) — Fase 1 read-only rigorosa antes de qualquer edit financeiro (CooperToken, Asaas Webhook, drift). 2 recomendações destrutivas barradas por essa disciplina.
- **regra_nao_trabalhar_paralelo_com_code** (17/05) — Luciano manteve controle bloco a bloco em toda a sessão; Code aguardou aprovação em cada PARA/OK.
- **regra_coerencia_sistemica_mapa_impacto** (10/06) — mapa de impacto entregue na Fase 1 antes de qualquer edit em Asaas + CooperToken.
- **CLAUDE.md "db push em dev, NUNCA migrate"** — preservada e reforçada. Débito P2 registrado pra reconciliação futura de `migrations/`.
- **feedback_analise_modelo_canonico_primeiro** — aplicada nos 2 revisores financeiros (7 achados totais entre os 2).

---

## DELTA pós-fechamento `f93f365` — ROTA B executada (Luciano rodou 2026-07-20 ~21:00-21:50)

Fechamento anterior (`f93f365`) marcou ROTA B como "manutenção destrutiva pendente — Luciano roda quando quiser". Esta seção documenta a **execução** do runbook + descoberta lateral que ressuscitou o bot WA (mudo desde 17/07).

### Achado 8 — Codex removido do ACL do repo inteiro

- `icacls C:\Users\Luciano\cooperebr /remove:g "DESKTOP-89HGOKR\CodexSandboxUsers" /T` → OK.
- SID órfão `S-1-5-21-3982730439-717413640-2430296156-1805928900`: `icacls /remove:g "*<SID>" /T` retornou **exit 52** (SID não resolve pra Name, `icacls` recusa remover mesmo com prefixo `*`). **Fallback:** PowerShell nativo `Get-Acl` → `RemoveAccessRule` (matching por `IdentityReference SID`) → `Set-Acl`. Remove o ACE direto do security descriptor sem depender de resolução de nome.
- Verificação pós: `icacls` no root do repo E em `auth_info` (herança propagou) mostra apenas os 3 principals canônicos (`Luciano` / `SYSTEM` / `Administradores`). **Zero resíduo Codex, zero SID órfão. Cross-repo write vector fechado.**

### Achado 4 — `auth_info` tightened

- Backup `whatsapp-service/auth_info.acl.pre-corretiva.bak` via `icacls /save /T` — 1534 arquivos, zero falhas. Rede de rollback local (untracked, fora do repo — arquivo grande com ACL de cada file).
- `pm2 stop cooperebr-whatsapp` (libera locks Baileys nos `.json` de sessão).
- Atômico: `icacls auth_info /inheritance:r /grant:r "Luciano:(OI)(CI)(F)" "SYSTEM:(OI)(CI)(F)" "Administradores:(OI)(CI)(F)" /T` — 1534/1534 processados.
- Verificação pós: **zero linha `(I)` herdada**, só as 3 ACEs explícitas. Intacto num `pm2 restart` subsequente (Baileys lê `auth_info` sem `EPERM`).

### Bot WhatsApp ressuscitado — 3 dias mudo (17/07 → 20/07) destravado

Depois do Achado 4 aplicado, `/status` continuava `failed`. **Diagnóstico revelou 2 causas raiz independentes, ambas necessárias pro fix** (nenhuma sozinha resolvia):

1. **Hardcode `version: [2, 3000, 1034195523]` aposentado pelo Meta.** Handshake sempre `code: 405 Method Not Allowed`, fluxo de auto-reconexão esgotava 5 tentativas, caía em `failed`. Fix: `fetchLatestBaileysVersion()` dinâmico com fallback pro hardcode antigo em caso de falha de rede (commit `82c9ebc`). Log confirma: `📌 WhatsApp Web version: 2.3000.1035194821 (isLatest=true)` — **~1M versões à frente** do hardcode; a diferença explica o kick.
2. **Processo órfão PID 16048** (iniciado `2026-07-17 14:54:46` — data EXATA em que o bot ficou mudo) segurando `0.0.0.0:3002` + `[::]:3002` (IPv6) enquanto o PM2 novo bindava em `127.0.0.1:3002`. Ambas as instâncias liam o mesmo `auth_info` → Meta via 2 conexões com as mesmas credenciais Signal → rejeitava ambas. `pm2 restart` **não mata órfão** (PM2 só controla o processo que ele mesmo spawnou). Cleanup obrigatório: `pm2 delete` + `Stop-Process -Id 16048 -Force` + start limpo pelo `ecosystem.config.cjs` + `pm2 save`.

Runbook (validado 2× consecutivas — com e sem zumbi presente):

```powershell
pm2 delete cooperebr-whatsapp
$zpid = (Get-NetTCPConnection -LocalPort 3002 -State Listen -EA SilentlyContinue | Select-Object -First 1).OwningProcess
if ($zpid) { Stop-Process -Id $zpid -Force }
pm2 start C:\Users\Luciano\cooperebr\ecosystem.config.cjs --only cooperebr-whatsapp
pm2 save
```

Resultado ambas as vezes: `/status = "connected"`, PID único, restart count 0, log `✅ WhatsApp conectado com sucesso!` ~2s pós-boot.

### Débitos catalogados (commit `ad3415c`)

- **P2 `D-novo-WA-ZUMBI-PORTA-3002`** — `pm2 stop/restart` deixa processo órfão em Windows segurando `:3002`. **Raiz do "status failed mascarado"**: sem cleanup do órfão, novo boot sempre falha silenciosamente porque as 2 instâncias competem por `auth_info`. Fix futuro: (a) guard de startup no `whatsapp-service/index.mjs` que aborta com mensagem clara se `:3002` já ocupado por processo não-controlado por PM2; (b) investigar SIGKILL vs SIGTERM handling / child-process desanexado / especificidade Windows; (c) documentar procedimento de cleanup no CLAUDE.md junto à seção PM2 (regenerate Prisma).
- **P2 `D-novo-WA-LOG-CHAVES-SESSAO`** — `logs/wa-out.log` dumpa material criptográfico Signal Protocol da sessão Baileys (`privKey`, `rootKey`, `remoteIdentityKey`, `baseKey` do `pendingPreKey` com `signedKeyId`) via pino verboso. Local + gitignored + ACL-restrito pós-Achado 8, **mas** leak alternativo (backup automatizado, screen share, agente com acesso ao FS, tarball de suporte, sync na nuvem) vaza a identidade completa da sessão WA — atacante pode impersonar o número. Fix: (a) subir logger pino level de `trace`/`debug` pra `info` no `index.mjs`; (b) localizar callsite que dumpa objeto de estado inteiro (`logger.trace(state)` ou similar) e reduzir pra metadata sem chaves; (c) auditar outros callsites (`state.keys`, `state.creds.noiseKey`, `state.creds.signedIdentityKey`).

### Achado 3 — PENDENTE (único aberto da corretiva mensageria)

Rotação de `WHATSAPP_WEBHOOK_SECRET` + limpeza do `?secret=` embutido no `BACKEND_WEBHOOK_URL` do `.env` do wa-service + consolidação de `COOPERTOKEN_QR_SECRET` (Achado 9 — apagar linhas 73 + 75, manter 76). **Deferido**: passo manual de `.env` mais delicado + Code errou 401 2× hoje. Ordem: Bloco 3 do `docs/seguranca/restart-coordenado-achado-3-4-8.md`, seguido dos smokes obrigatórios do Bloco 5 (WA `/status`, webhook 401/200, igualdade estrutural dos 2 `.env`, round-trip real com `27981341348`, QR round-trip funcional).

### Commits desta rodada (2, ambos pushados em `origin/main`)

| SHA | Mensagem | Escopo |
|---|---|---|
| `82c9ebc` | `fix(wa): versao WhatsApp Web dinamica via fetchLatestBaileysVersion - corrige 405 que deixou o bot mudo desde 17/07` | `whatsapp-service/index.mjs` |
| `ad3415c` | `docs(debitos): catalogo D-novo-WA-ZUMBI-PORTA-3002 e D-novo-WA-LOG-CHAVES-SESSAO (corretiva WA 20/07)` | `docs/debitos-tecnicos.md` |

`git log origin/main..HEAD` conferido vazio antes de cada push (regra sessões paralelas `regra_push_disciplina_sessoes_paralelas_06_11`).

### Lição de método (registrar, não é anedota)

**PM2 `online` ≠ bot conectado.** O status do PM2 reflete vida do processo (bind de porta, uptime, restart count); handshake WA é rejeitado silenciosamente e volta pra reconnect loop, esgota tentativas, cai em `failed` no `/status` do próprio wa-service — **mas PM2 continua `online` porque o processo Node não morre**. Mascarou 3 dias de outage entre 17/07 e 20/07. Nenhum alerta operacional disparou.

**Diagnóstico foi log → código → processos, NÃO re-pareamento às cegas.** A intuição inicial (sessão morta do lado Meta, requer QR novo) teria falhado — o problema era competição local por `auth_info` + hardcode de versão. Só ler `Get-NetTCPConnection`/`netstat` no ângulo certo (múltiplos `OwningProcess` no mesmo porto :3002) revelou o zumbi de 3 dias atrás.

**Runbook `restart-coordenado-achado-3-4-8` + cleanup de zumbi validado 2× consecutivas → candidato a canônico no CLAUDE.md seção PM2** (fazer junto do tratamento futuro do `D-novo-WA-ZUMBI-PORTA-3002`).

### Smoke pós-fechamento — round-trip emissor validado ao vivo (22:28 BRT)

Após o commit `78ab9bc` (fechamento canônico), Luciano pediu smoke real de envio pro número whitelist `27981341348` (regra `regra_contato_teste_impreterivel` 14/05). Executado via `node -e` dentro de `whatsapp-service/` (secret carregado do `.env` sem eco no shell — regra `regra_secrets_nao_memorizar` 26/05):

```
POST http://127.0.0.1:3002/send-message
Header: x-whatsapp-secret: <redacted>
Body: { "to": "27981341348", "text": "Round-trip test — corretiva WA 20/07 ..." }

Response: HTTP 200 { "ok": true }
```

Luciano confirmou recebimento no celular. **Metade emissor da cadeia round-trip validada em produção real** (Bloco 5 sub-teste do runbook — smoke emissor, não a metade inbound que ainda depende de resposta manual do celular).

O que o `200` prova concretamente:
- Header `x-whatsapp-secret` autenticou no middleware (senão 401 — Achado 3 no wa-service `d5e547c` funcionando).
- `connectionStatus === 'connected'` no boot atual (senão 503 ou `{ok:true, buffered:true}`).
- `sock.sendMessage()` não threw — Baileys aceitou o payload e enviou ao Meta com a versão nova (`2.3000.1035194821`) do commit `82c9ebc`.
- Recebimento físico no aparelho fecha a cadeia emissor → Meta → celular.

Metade inbound (celular → Meta → wa-service → `POST /whatsapp/webhook-incoming` no backend) fica pendente pra próxima sessão — basta Luciano responder qualquer texto no WA que o log do backend loga `[WhatsappController] Mensagem recebida`. Não bloqueia o fechamento (o problema era emissor mudo, não receptor).

Observação lateral registrada: o dump do `wa-out.log` durante o boot (22:26:51 BRT, imediatamente antes do smoke) mostra material Signal Protocol em texto claro (`privKey`, `rootKey`, `remoteIdentityKey`, `chainKey`, `ephemeralKeyPair`, `pendingPreKey`) — **evidência empírica ao vivo do débito `D-novo-WA-LOG-CHAVES-SESSAO`**. Não é hipótese; foi observado nos logs desta sessão. Reforça a prioridade P2 do débito.
