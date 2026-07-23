# 22/07/2026 — Bloco 6 fechado + AgentsModule preservado + Tarefa 4 em WIP + WA mudo

## TL;DR

Dia longo com 4 frentes independentes. **3 pushadas em `main`** (Bloco 6/fallback query removido, script teste-fluxo-convite migrado pra header, AgentsModule preservado em branch `wip/agents-subsistema-1106`) + **1 em branch WIP** (Tarefa 4 correções #1+#4+#2+#3 pendentes review em `wip/tarefa4-emissao-idempotencia`). **WA re-pareado tecnicamente iniciado**: `auth_info` renomeada pra `auth_info.pre-repareamento-2207` (rollback preservado), QR novo gerado, mas Luciano NÃO escaneou — bot fica mudo até re-pareamento manual + re-aplicação da ACL do Achado 4 (D-novo-WA-REPAREAMENTO-PERDE-ACL). **Corretiva Mensageria WA 9/9 fechada em runtime hoje** com a compat window do Achado 3 encerrada em definitivo (0 usos de fallback no log real após 24h).

## Marco entregue

**Bloco 6 ROTA B em definitivo + AgentsModule sprint pausado preservado + Tarefa 4 correções sem-schema completas (branch WIP, aguardando review).**

## Commits do dia (7)

| Hash | Branch | Mensagem |
|---|---|---|
| `2d08aeb` | main | `fix(seg): fecha compat window Achado 3 — remove fallback ?secret= do webhook-incoming + spec 5/5 + 2 debitos WA catalogados` |
| `06c5add` | main | `fix(seg): migra teste-fluxo-convite.ts pra header + separa checagem parcial/final no debito` |
| `46255c2` | wip/agents-subsistema-1106 | `wip(agents): preserva Modulo IAG (AgentsModule + PolicyEngine + 3 subsistemas) fora do main` |
| `ad2ad10` | main | `docs(seg): cataloga D-novo-AGENTS-SUBSISTEMA-ORFAO + wip preservado em branch` |
| `4c929cf` | wip/tarefa4-emissao-idempotencia | `wip(asaas): Tarefa 4 correcoes #1-#4 emissao (retorno discriminado + gate notif + marca-antes-de-tentar + cron regular) — AGUARDA review #2+#3 + resposta convenio` |
| `9ffd8ab` | main (fechamento anterior 09:00) | `docs(controle): corrige diagnostico WA + comando smoke na frase de retomada` |
| `f55b57f` | main (fechamento anterior 09:00) | `docs(sessao): fechamento 22/07 — adenda correcoes frase retomada + D-novo-WA-DIAGNOSTICO-REPAREAR-PRECIPITADO` |

Este fechamento adicionará `docs(sessao): fechamento 22/07 tarde — WA re-pareamento iniciado + agents wip + Tarefa 4 wip`.

## Entregas técnicas

### 1. Bloco 6 ROTA B fechado em definitivo (`2d08aeb`)

Verificação final no **log real** `logs/nest-out.log` (2.162.585 linhas até 14:00 22/07):
- **0** ocorrências hoje de query fallback deprecated
- **0** ocorrências hoje de `Unauthorized` no webhook-incoming
- **0** warns deprecated pós-rotação 21/07 07:46
- Sinal limpo, janela 24h fechou

Removidos:
- `whatsapp-fatura.controller.ts:100-112` — bloco fallback query
- Parâmetro `@Query('secret') secretQuery`
- Comentário atualizado com contexto 22/07

Spec `whatsapp-fatura.controller.achado3.spec.ts` refatorado:
- C2 (só query), C3 (header+query), Cbonus (header vazio + query) — REMOVIDOS
- C1, C4, C5, Csem-env — mantidos com assinatura ajustada
- **Cregression novo** — header VAZIO → 401 (antes caía no fallback query)
- 5/5 PASS

### 2. Fix teste-fluxo-convite (`06c5add`)

`scripts/teste-fluxo-convite.ts:212` ainda usava `POST /whatsapp/webhook-incoming?secret=...` — quebrava silenciosamente com a remoção do fallback query no `2d08aeb`. Não é produção mas o sintoma pareceria "fluxo de convite quebrado" em vez de "script com auth antiga". Helper `http()` não aceita headers custom, então chamada direta via `fetch` com `x-whatsapp-secret`.

Cobertura de callers `?secret=` no repo (grep total):
- backend receptor: removido em `2d08aeb`.
- wa-service emissor: `index.mjs:55` já limpo (usa header) desde Achado 3 16/07 + defense-in-depth `limparSecretDaUrl` no boot.
- `.env.example`: já limpo.
- `scripts/teste-fluxo-convite.ts:212` — migrado no `06c5add`.
- Demais ocorrências: documentação histórica (runbooks e sessões) — intocáveis por design.

`docs/debitos-tecnicos.md` — separadas as 2 checagens do Bloco 6:
- **Checagem PARCIAL 21/07 ~09:00** (~1h pós-rotação 07:46): 2 inbounds legítimos (07:51 e 08:05), 0 fallback, 0 Unauthorized.
- **Checagem FINAL 22/07 14:00** (log real completo): 0 warns pós-rotação, 0 fallback, 0 Unauthorized. **É essa checagem que justifica a remoção do fallback** no commit `2d08aeb`.

### 3. AgentsModule preservado em branch WIP (`46255c2` + `ad2ad10`)

Descoberto durante verificação pré-Tarefa 4: `backend/src/agents/` tinha 19 arquivos untracked desde 11/06/2026 (sprint pausado, 2.573 linhas). Não importado em `app.module.ts` (código morto em runtime, zero risco de segurança), MAS dentro de `src/` o `tsc` compila em todo build — erro de tipo futuro quebraria o build sem causa aparente. Também estava a um `git clean` de sumir e NÃO constava na frase de retomada, arriscando limpeza sem contexto.

**Escolha: Opção A** (Luciano ofereceu 2, escolhi essa por precedente): commit em branch WIP + push, sem merge no main. Mesmo padrão da `feature/mascara-email-convenio` de 14/07.

Sequência executada:
```
git checkout -b wip/agents-subsistema-1106
git add backend/src/agents/
git commit -m "wip(agents): preserva Modulo IAG..."
git push -u origin wip/agents-subsistema-1106
git checkout main  → git removeu os arquivos automaticamente (main não tinha)
```

Estrutura preservada (README.md preservado no commit):
- `agents.module.ts` + `agents.service.ts` (infra base)
- `common/policy/` — PolicyEngine com níveis L0-L4 (L0 leitura, L1 simulação, L2 baixo risco, L3 financeiro/regulatório com aprovação humana, L4 bloqueado)
- `common/tools/` (ToolRegistry) + `common/types/` (policy.types)
- `sentinela/` (prio A), `repasses-despesas/` (prio B), `cobranca/` (prio E) — 3 subsistemas em estágio inicial

Princípios do módulo: dependência unidirecional (agents/ usa core, core NUNCA depende de agents/), zero autonomia sem governança (toda ação passa pelo PolicyEngine), rastreabilidade nativa via `@AuditLog` + `EventEmitter2`, TDD com cobertura mínima 80% nas partes críticas.

Retomada futura: `git checkout wip/agents-subsistema-1106` + continuar.

### 4. WA re-pareamento iniciado (bot mudo até scan manual)

Diagnóstico executado (escada `D-novo-WA-DIAGNOSTICO-REPAREAR-PRECIPITADO` — 5º cenário) — **primeira vez esta semana em que re-parear É a resposta certa**:
- `/status = failed` no boot da manhã
- Zumbi checado: só 1 PID (PM2), zero conflito
- `auth_info/creds.json` INTACTO (2550 bytes, 21/07 12:46) — não é `fs.rmSync` do próprio código
- Restart → subiu com `awaiting_qr` (Meta invalidou sessão de fato)
- Log: `⚠️ Desconectado (code: 408)` tentativas 4/5 e 5/5 desde ontem 09:00 → 18h+ de retry loop → Meta perdeu contexto do dispositivo
- Rede confirmada OK pelo Luciano: `g.whatsapp.net:443` OK, `web.whatsapp.com:443` OK, IP `.11`/gw `.1` sãos
- **Impressão digital distinta das 4 recusas anteriores** — sobra desassociação silenciosa do lado Meta (é o único cenário em que re-parear é a resposta certa)

Precauções aplicadas ANTES do QR (Luciano orientou):
- `pm2 stop cooperebr-whatsapp` → `Rename-Item auth_info auth_info.pre-repareamento-2207` (rollback preservado, 1.578 arquivos) → `pm2 start`
- QR novo gerado (mudando a cada 20s no log)
- **Luciano NÃO escaneou** no dia — bot fica mudo até re-pareamento manual + re-aplicação ACL

**Ação obrigatória pós-scan** (`D-novo-WA-REPAREAMENTO-PERDE-ACL` P2): o Baileys recria `auth_info/` com permissão herdada padrão do Windows — desfaz em SILÊNCIO a corretiva do Achado 4 aplicada 21/07. Runbook:
1. Backup: `icacls C:\Users\Luciano\cooperebr\whatsapp-service\auth_info /save auth_info.acl.pos-repareamento-<data>.bak /T`
2. Re-aplicar: `icacls /inheritance:r /grant:r "Luciano:(OI)(CI)(F)" "SYSTEM:(OI)(CI)(F)" "Administradores:(OI)(CI)(F)" /T`
3. Verificar: `icacls .../auth_info` retorna apenas as 3 ACEs canônicas, zero `(I)` herdada

**Enquanto bot não é re-pareado + ACL re-aplicada**, o Achado 4 fica meio-aberto.

### 5. Tarefa 4 correções #1+#4+#2+#3 em branch WIP (`4c929cf`)

**NÃO commitado no main** por decisão do Luciano: #2+#3 mexem no `convenios.job.ts` (que agora serve convênio E regular), ainda não foram revisados, e a pergunta do caminho convênio segue aberta.

Estado no branch `wip/tarefa4-emissao-idempotencia`:

**#1 (retorno discriminado):**
- Tipo `EmissaoGatewayResult` exportado (`SEM_GATEWAY` × 3 motivos | `EMITIDO` com dados | `FALHOU` com erro).
- `emitirNoGatewaySeConfigurado` refatorado — nunca lança, retorna discriminado + faz update interno de `statusEmissao`/`tentativasEmissao`/`ultimoErroEmissao`/`ultimaTentativaEmissaoEm` via helper `marcarStatus`.
- try/catch morto do chamador (`:366-379` original) removido.

**#4 (gate de notificação):**
- `criar()`: `const podeNotificarCooperado = emissaoResult.tipo !== 'FALHOU'`.
- Gate no WA (linha 409) + email (linha 425).
- Default de `emissaoResult` é `SEM_GATEWAY` (não `FALHOU`) — preserva os 307 faturados manualmente quando o `if (resolvedCoopId && contrato?.cooperadoId)` não entra.

**#2 (marca-antes-de-tentar):**
- `criar()`: `vaiTentarEmitir = !!(resolvedCoopId && contrato?.cooperadoId)`. Cobrança nasce com `statusEmissao: 'AGUARDANDO_EMISSAO'` só se vai tentar emitir. Fatura manual nasce com `statusEmissao: null` (não bate no cron).
- `marcarStatus` (helper interno de `emitirNoGatewaySeConfigurado`) atualiza baseado no resultado — método continua reutilizável pelo cron.

**#3 (relaxar filtro do cron):**
- `convenios.job.ts:108` — removido `convenioContabilCobrancaId: { not: null }`. Só filtra `statusEmissao='AGUARDANDO_EMISSAO'` + `tentativasEmissao<5` + back-off.
- Select ganhou `contrato: { select: { cooperadoId: true } }` — fallback pro path regular.
- Resolução tolerante: `cooperadoAlvo = conv?.pagadorCooperadoId ?? c.contrato?.cooperadoId`.
- Descrição: `conv ? "Cobrança consolidada — ${empresaNome} — ${mesRef}" : "Cobrança ${mesRef}"`.
- `marcarFalhaEmissao` ganha fallback `nomeReferencia = conv?.empresaNome ?? "Cobrança regular ${mesRef}"`.
- Chamada permanece com `custeioService.emitirNoGateway` (aceita cooperadoId genérico).

**Testes 21/21 PASS**:
- `emitir-no-gateway.spec.ts` (novo) — 12 tests (5 discriminações + prova estrutural que método nunca lança + 5 gate #4 cobrindo os 3 sub-motivos SEM_GATEWAY notificando + EMITIDO notifica + FALHOU não notifica).
- `convenios-job-retry.spec.ts` (atualizado) — 8 tests (7 antigos + 1 novo pra path regular: cobrança sem `convenioContabilCobrancaId` + `contrato.cooperadoId` → `emitirNoGateway` chamado com cooperado do contrato).

**REVISADO pelo orquestrador**: só #1+#4 (Luciano conferiu linha a linha, corretos — default `SEM_GATEWAY` preserva os 307). **PENDENTE review**: #2+#3 (cron financeiro serve agora 2 caminhos) ANTES de merge no main.

**Pergunta aberta pendente**: o caminho de CONVÊNIO (`convenios-custeio`) notifica o cooperado ANTES de confirmar a emissão? Se sim, tem o mesmo bug e o gate #4 não alcança. Grep desta sessão em `convenios/` mostra **zero callers** de `notificarCobrancaGerada`/`enviarFatura` — indicativo forte de que o convênio NÃO notifica na criação (delega ao cron via `statusEmissao='AGUARDANDO_EMISSAO'`). Confirmação formal pendente pra próxima sessão.

**#5+#6 NÃO iniciadas**: exigem `prisma db push` com PM2 parado (`@@unique(cobrancaId)` em `AsaasCobranca` + reconciliação de órfã). **TRAVADAS** até WA estabilizar (o daemon PM2 já perdeu tabela de processos uma vez esta semana; mexer no meio do re-pareamento pode custar o QR).

## Bugs resolvidos / catalogados

### Resolvidos

- Fallback query `?secret=` do webhook-incoming (compat window Achado 3) — 5/5 spec verde.
- teste-fluxo-convite migrado pra header — script de diagnóstico não quebra silenciosamente.

### Débitos catalogados hoje

- **P3 `D-novo-WA-DIAGNOSTICO-REPAREAR-PRECIPITADO`** (manhã) — escada de diagnóstico WA com 5 cenários.
- **P2 `D-novo-WA-REPAREAMENTO-PERDE-ACL`** (tarde) — todo re-pareamento restaura ACL padrão herdada do Windows; runbook precisa passo obrigatório pós-scan pra re-aplicar Achado 4.
- **P3 `D-novo-AGENTS-SUBSISTEMA-ORFAO`** (tarde) — sprint AgentsModule pausado preservado em branch WIP, contexto documentado.

### Débitos ainda abertos (não fecharam hoje)

- **P3 `D-novo-BJ /uploads/` estático sem auth** — única task da lista original de deferidos que não fechou. Segue pendente pra sessão futura de segurança.

## Decisões estratégicas catalogadas

- **Ordem de sequenciamento na Tarefa 4** (decisão Luciano): as 4 correções sem-schema (#1-#4) formam um bloco coeso — commit único. #5+#6 são schema change e só rodam com WA estabilizado. Trava operacional catalogada.
- **Não pushar #1+#4 isolados** (decisão Luciano): sem #2+#3, uma FALHOU fica em limbo (sem notificação E sem retry) — pior que o bug original. Fechar o conjunto #1→#4 antes do push.
- **Padrão WIP branch pra sprint pausado**: agents/ + tarefa4 seguem padrão da `feature/mascara-email-convenio`. Preserva contexto recuperável, mantém `main` limpo.

## Próximo passo (único e claro)

**Revisar #2+#3 + responder pergunta convênio → merge `wip/tarefa4-emissao-idempotencia` → main + push → então #5+#6 (schema change, exige WA estabilizado).**

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA` (recém-atualizada com este fechamento)
- `docs/sessoes/2026-07-22-wa-repareamento-tarefa4-wip.md` (este)
- `docs/debitos-tecnicos.md` — 3 débitos novos catalogados hoje + `D-novo-BJ /uploads/` ainda aberto
- **Branch `wip/tarefa4-emissao-idempotencia` commit `4c929cf`** — 4 arquivos (cobrancas.service.ts, emitir-no-gateway.spec.ts, convenios.job.ts, convenios-job-retry.spec.ts). Para reviewar: `git checkout wip/tarefa4-emissao-idempotencia` + `git diff main..HEAD` mostra o delta completo.
- **Branch `wip/agents-subsistema-1106` commit `46255c2`** — só pra retomada futura do sprint AgentsModule (não relacionado à Tarefa 4).

## Carry-overs (não-bloqueantes)

- **WA em `awaiting_qr`** — não bloqueia review da Tarefa 4 (#2+#3 são código puro + testes unit). Bloqueia apenas #5+#6 (schema change).
- **`whatsapp-service/auth_info.pre-repareamento-2207/`** — rollback preservado, remover após bot re-pareado + validado.
- **`docs/diagramas/cadastro-usinas.html` M** pré-existente — line-ending flip desde 17/05, NÃO commitar.
- **Untrackeds catalogados**: `.agent/`, `.claude/agents/*` não-meus, `.e2e-tmp/`, scripts experimentais, backups.

## Regras aplicadas na sessão

- **regra_fechamento_sessao_inegociavel** (13/05) — este doc + CONTROLE-EXECUCAO + push (só docs — código está em WIP branches).
- **regra_contato_teste_impreterivel** (14/05) — spec da Tarefa 4 usa mocks puros, zero envio real.
- **regra_secrets_nao_memorizar_26_05** — spec HS256 (rodado em fechamento anterior) segue lendo `.env` sem ecoar; nada de secret hoje.
- **regra_validacao_previa_e_retomada** (Decisão 23) — pré-validações operacionais no início; escada de diagnóstico WA aplicada; pergunta convênio validada em Fase 1 (zero callers no grep — não assumido).
- **regra_nao_trabalhar_paralelo_com_code_17_05** — Luciano orquestrou cada onda (Bloco 6 → agents → Tarefa 4 #1+#4 → review → #2+#3 → decisão de WIP).
- **CLAUDE.md — NUNCA `git add .`** — todos os commits com paths explícitos.
- **CLAUDE.md — SEM push sem OK** — respeitada; Tarefa 4 fica em WIP branch aguardando review.
- **Padrão WIP branch pra sprint pausado** — replicado do `feature/mascara-email-convenio` 14/07.

## Nota de método (registrar)

**"Não pushar estado intermediário que piora o caso de falha"** — a decisão do Luciano de segurar #1+#4 até fechar #2+#3 (e não pushar sozinhos) captura um princípio genérico de refactors de recuperação de erros: **cada meia-correção pode ser pior que o bug original**. #1+#4 sozinhos: FALHOU não notifica mas também não recupera → cooperado nunca sabe que teve cobrança. Bug original: FALHOU notifica cobrança sem instrumento → cooperado sabe que tem cobrança mas fica sem pagar. O segundo é ruim; o primeiro é invisível. **Fechar o conjunto antes de subir.** Padrão a lembrar em refactors futuros de handlers de erro.
