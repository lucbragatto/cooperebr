# Revisão multi-tenant "qual cadastro?" + skills Coop + F0 read-only CooperToken — 08/06/2026

## TL;DR

Sessão consolidou 3 frentes: (1) revisão multi-tenant + segurança da feature "qual cadastro?" entregue no M26 — 7 itens P1+P2 corrigidos (filtro de status em 3 pontos pra não autorizar contexto de cooperado inativo, chaves React por id estável, persistência de `contexto_ativo_id` no front, blindagem TROCAR CADASTRO em estado sensível pra Fase 3 de token, higiene de PII em SAIR/INÍCIO, throttle anti-enumeração em `/auth/trocar-contexto`, cookie `secure` em produção); (2) instalação de 2 skills (`skill-cooper-token.md` + `skill-wa-bot.md`) no agente Coop com referência em `.agent/AGENTS.md`; (3) Fase 1 read-only de 2 bugs P0 de conformidade no CooperToken (crédito indevido ao `saldoParceiro` em pagamento QR cooperado→cooperado + dupla TAXA_QR em `processarQrParceiro`) — reportados, **Fase 2 NÃO executada**, aguardando OK Luciano. Limpeza operacional lateral: `cooperebr-edge-agent` parado + `pm2 save`. 5 commits novos (`6f48da7..f980a69`), 297+ specs verde, backend+frontend recompilados e PM2 restartado, portas 3000/3001/3002 LISTENING.

## Marco entregue

**M27 — Revisão multi-tenant "qual cadastro?" + skills Coop + F0 Fase 1 read-only CooperToken**

## Commits do dia (5)

| Hash | Mensagem |
|---|---|
| 6f48da7 | fix(auth): filtra cooperado inativo em obterContextos+matcher+impersonate |
| 9dce791 | feat(coop): skills cooper-token + wa-bot pro agente Coop |
| e1e8c45 | fix(web): persiste contexto_ativo_id + chaves React por id + cookie secure em prod |
| b0e7cd6 | fix(wa-bot): bloqueia TROCAR CADASTRO em estado sensivel + zera dadosTemp em SAIR/INICIO |
| f980a69 | chore(auth): throttle 10/min em POST /auth/trocar-contexto |

## Entregas técnicas

### Revisão multi-tenant "qual cadastro?" (7 itens)

**P1.1 — Filtro de status em 3 pontos (commit `6f48da7`):**
- `backend/src/cooperados/cooperado-matcher.helper.ts:88` (`acharCooperadosPorUsuario`): `where` ganha `status: { in: STATUS_COOPERADO_ATIVOS as unknown as any[] }` (mesmo padrão já usado em `acharCooperadosPorTelefone`).
- `backend/src/auth/auth.service.ts:499` (`obterContextosUsuario.findMany`): mesmo filtro — cooperado DESLIGADO/REMOVIDO/PENDENTE_KYC não gera contexto pro Usuario logado.
- `backend/src/auth/auth.service.ts:757` (`assinarTokenImpersonate.findFirst`): mesmo filtro — endpoint dev/impersonate (já gated por `isAmbienteReal()=false` + SUPER_ADMIN) não resolve `cooperadoId` de cadastro inativo no JWT impersonado.

**P1.2 — Chave React por id estável (commit `e1e8c45`):**
- `web/components/ContextoSwitcher.tsx:118`: `key={ctx.id ?? ctx.tipo}` (era `ctx.tipo`). Com múltiplos cooperados do mesmo Usuario, `tipo` sozinho colidia → React reusava DOM/estado errado.
- `web/app/selecionar-contexto/page.tsx:147`: idem.

**P1.3 — Persistir `contexto_ativo_id` (commit `e1e8c45`):**
- `web/hooks/useContexto.ts`: novo `CONTEXTO_ID_KEY = 'contexto_ativo_id'`. `setContextoAtivo(tipo, id?)` salva o id; `limparContexto` limpa os 2. Novo `getContextoAtivoId`. Hook carrega o id, restaura no boot, expõe `trocarContexto(tipo, id?)`. `contextoObj` resolvido por id quando `tipo='cooperado'` (find por tipo sozinho podia resolver pro cooperado errado).
- `ContextoSwitcher.handleSelect` + `selecionar-contexto.handleSelect`: passam `ctx.id` pro `setContextoAtivo`.

**P1.4 — TROCAR CADASTRO seguro em estado sensível (commit `b0e7cd6`):**
- `backend/src/whatsapp/whatsapp-fluxo-motor.service.ts:executarComandoUniversalReal`: se `conversa.estado ∈ [ALTERAR_LIMITE_AGUARDANDO_PIN, ALTERAR_LIMITE_AGUARDANDO_VALOR]`, TROCAR CADASTRO é bloqueado com aviso "Você está no meio de uma operação sensível (CooperToken). Finalize ou digite SAIR antes de trocar de cadastro." Sem isso, cooperado podia digitar PIN/valor do cadastro A e ter aplicado no cadastro B.

**P2.5 — Throttle no POST /auth/trocar-contexto (commit `f980a69`):**
- `backend/src/auth/auth.controller.ts:125`: `@Throttle({ default: { ttl: 60000, limit: 10 } })` — anti-enumeração de `cooperadoIds` contra o anti-IDOR do `trocarContexto`. Alinhado com caps já aplicados em `/esqueci-senha` (5) e `/login` (30).

**P2.6 — Higiene de PII em SAIR e INÍCIO (commit `b0e7cd6`):**
- SAIR: update agora zera `dadosTemp: {}` junto com `estado: 'ENCERRADO'` (era só estado). Candidatos de cadastro do MENU_ESCOLHA_CADASTRO, OCR pendente, códigos de indicação etc não ficam mais no banco até o próximo ciclo reescrever.
- INÍCIO: pre-update zera `dadosTemp` ANTES do reconhecimento automático ou fluxo padrão. Cobre os 2 paths (`tentarReconhecerEEntrarMenu` + `resolverEstadoComandoUniversal`).

**P2.7 — Cookie secure em produção (commit `e1e8c45`):**
- `web/lib/auth.ts:7`: `COOKIE_OPTS` ganha `secure: process.env.NODE_ENV === 'production'`. Dev (`localhost` http) fica `false` pra não bloquear o set; prod fica `true` (JWT não trafega via http).
- `logout` / `logoutPortal` / `aplicarSessaoImpersonate` limpam também `contexto_ativo_id` (par com novo storage do useContexto).

### Specs Jest (297+ verde)

**Adicionados (6):**
- `cooperado-matcher.helper.spec.ts`: `acharCooperadosPorUsuario` aplica `status IN [...]`.
- `trocar-contexto-multi-cadastro.spec.ts`: `obterContextosUsuario` aplica filtro; `assinarTokenImpersonate.findFirst` aplica filtro.
- `whatsapp-fluxo-motor.service.spec.ts`: SAIR zera `dadosTemp` (higiene PII); TROCAR CADASTRO bloqueado em `ALTERAR_LIMITE_AGUARDANDO_PIN`; TROCAR CADASTRO bloqueado em `ALTERAR_LIMITE_AGUARDANDO_VALOR`.

**Ajustados (4):**
- `cooperado-matcher.helper.spec.ts`: 2 specs antigos do `acharCooperadosPorUsuario` flexibilizados de `{ where: { OR } }` estrito pra `expect.objectContaining` (acomoda `status` adicional).
- `whatsapp-fluxo-motor.service.spec.ts`: SAIR persiste/PRECEDENCIA SAIR vence — `data:{estado}` estrito → `expect.objectContaining` (acomoda `dadosTemp` adicional).

### Skills do Coop (commit `9dce791`)

- `.agent/memory/skill-cooper-token.md` (3145B) e `.agent/memory/skill-wa-bot.md` (3123B) copiados de `Downloads/coop-skills/`.
- `.agent/AGENTS.md` seção "Startup — OBRIGATÓRIO ao acordar" estendida com itens 7 e 8 referenciando as 2 skills.
- Coop não tem daemon PM2 (`.agent/.openclaw/workspace-state.json` é CLI manual) — skills entram em vigor no próximo wake.

### F0 — Fase 1 read-only CooperToken (sem commit, sem código tocado)

Pedido Luciano: confirmar 2 bugs P0 de conformidade antes de qualquer trânsito real com empresa/estabelecimento.

**Bug P0 #1 — Crédito indevido ao `saldoParceiro` em QR cooperado→cooperado:**
- Local: `backend/src/cooper-token/cooper-token.service.ts:1062-1065` (callback `tx` de `processarPagamentoQr`).
- Trecho: `if (recebedorCooperativaId) { await this.creditarSaldoParceiroTx(tx, recebedorCooperativaId, quantidadeLiquida); }`.
- Por que é bug: cessão peer-to-peer entre cooperados não emite saldo novo pra cooperativa (tokens circulam, não nascem). Esse trecho infla `CooperTokenSaldoParceiro.saldoDisponivel` toda vez que A paga B.
- Efeito colateral: `processarQrParceiro` (1322-1371) chama `processarPagamentoQr` + faz seu próprio crédito → saldo parceiro é creditado **2×** pro QR parceiro (1× dentro + 1× fora).

**Bug P0 #2 — Dupla TAXA_QR em `processarQrParceiro`:**
- Local: `backend/src/cooper-token/cooper-token.service.ts:1335-1336`.
- Trecho: `const taxa1Pct = Math.round(resultado.quantidadeLiquida * TAXA_QR * 10000) / 10000;` + `const liquidoParceiro = Math.round((resultado.quantidadeLiquida - taxa1Pct) * 10000) / 10000;`.
- Por que é bug: comentário diz "Taxa de 1% já foi aplicada" mas o código aplica de novo sobre o líquido. Resultado: parceiro recebe 98,01 quando deveria receber 99 (taxa efetiva ≈ 1,99%).
- Correção pretendida (na Fase 2 a ser autorizada): `liquidoParceiro = resultado.quantidadeLiquida; taxa1Pct = resultado.taxa;` (reusar o que já saiu).

**Fase 2 NÃO executada** — aguardando OK explícito Luciano (Decisão 23).

### Operacional

- Backend recompilado (`npm run build` → `dist/src/main.js` atualizado) + `pm2 restart cooperebr-backend`.
- Frontend `npm run build` (web) + `pm2 restart cooperebr-frontend`.
- Portas 3000/3001/3002 LISTENING confirmadas.
- `cooperebr-edge-agent` (id 4, projeto vizinho `cooperebr-monitoramento`) parado via `pm2 stop` + `pm2 save` — estava em crash loop 82×.
- Início da sessão: PM2 vazio → `pm2 resurrect` restaurou 5 processos do `~/.pm2/dump.pm2`.

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| Cooperado inativo virava contexto de login | P1 | `obterContextosUsuario.findMany` sem filtro de status | `where` ganha `status IN STATUS_COOPERADO_ATIVOS` | RESOLVIDO |
| Cooperado inativo aparecia em `acharCooperadosPorUsuario` | P1 | helper sem filtro de status | `where` ganha mesmo filtro | RESOLVIDO |
| `assinarTokenImpersonate` resolvia `cooperadoId` de inativo | P1 | `findFirst` sem filtro de status | mesmo filtro | RESOLVIDO |
| Chave React duplicada em múltiplos cooperados do mesmo Usuario | P1 | `key={ctx.tipo}` colide em "cooperado" × 2 | `key={ctx.id ?? ctx.tipo}` | RESOLVIDO |
| `contextoObj` resolvia pro cooperado errado | P1 | front só persistia `tipo`, não `id` | `contexto_ativo_id` no storage + find por id quando `cooperado` | RESOLVIDO |
| TROCAR CADASTRO podia trocar contexto no meio de PIN/limite | P1 | sem bloqueio de estado sensível | bloqueio em `ALTERAR_LIMITE_AGUARDANDO_*` | RESOLVIDO |
| Higiene PII vazada em SAIR/INÍCIO | P2 | `dadosTemp` persistido entre ciclos | `dadosTemp: {}` em SAIR e pre-update INÍCIO | RESOLVIDO |
| Cookie sem `secure` em produção | P2 | `COOKIE_OPTS` só com `sameSite: lax` | `secure: NODE_ENV === 'production'` | RESOLVIDO |
| `/auth/trocar-contexto` sem cap de rate | P2 | falta `@Throttle` | `@Throttle({ ttl: 60s, limit: 10 })` | RESOLVIDO |
| QR cooperado→cooperado credita saldo da cooperativa (token nasce do nada) | P0 | trecho `creditarSaldoParceiroTx` dentro de `processarPagamentoQr:1062-1065` | Remover bloco (Fase 2 pendente) | CATALOGADO — F0 Fase 1 |
| QR parceiro aplica TAXA_QR 2× | P0 | reaplica `TAXA_QR * resultado.quantidadeLiquida` em `processarQrParceiro:1335-1336` | Reusar `resultado.taxa` + `resultado.quantidadeLiquida` (Fase 2 pendente) | CATALOGADO — F0 Fase 1 |

## Decisões estratégicas catalogadas

(Nenhuma memória persistente nova criada nesta sessão — todas as decisões couberam nos commits e no doc-sessão.)

## Próximo passo

**F0 Fase 2 CooperToken** — implementar as 2 correções já confirmadas em Fase 1 read-only:

1. Remover crédito ao `saldoParceiro` dentro de `processarPagamentoQr` (linhas 1062-1065).
2. Corrigir dupla taxa em `processarQrParceiro` (linhas 1335-1336): reusar `resultado.taxa` + `resultado.quantidadeLiquida`.
3. Specs Jest novos: (a) QR cooperado→cooperado NÃO altera `CooperTokenSaldoParceiro`; (b) taxa QR aplicada exatamente 1×; (c) arredondamento `Math.round(x*100)/100`.
4. Rebuild backend (stop → build → restart).
5. Commit em PT: `fix(cooper-token): F0 remove duplo credito saldoParceiro + dupla taxa QR`.

## Pré-requisitos leitura próxima sessão

- `docs/sessoes/2026-06-08-revisao-multi-tenant-qual-cadastro-skills-coop-f0-readonly.md` (esta sessão — seções "F0 — Fase 1 read-only CooperToken" + "Próximo passo").
- `backend/src/cooper-token/cooper-token.service.ts` linhas 939-1090 (`processarPagamentoQr`) + 1320-1371 (`processarQrParceiro`).
- `docs/CONTROLE-EXECUCAO.md` (estado + frase comandante).

## Carry-overs (não-bloqueantes)

- **F0 Fase 2 CooperToken** — 2 correções P0 confirmadas em Fase 1, implementação pendente OK Luciano (próximo passo).
- **`.claude/agents/wa-bot-agent.md`** modificado não-commitado — carry-over órfão do M26 (adição da seção "Integração com Stack de Agentes OpenClaw/Hermes + ECC + Obsidian"). Decidir em Sprint Housekeeping se vira commit ou descarte.
- **`cooperebr-edge-agent`** stopped (projeto vizinho `cooperebr-monitoramento`) — crash loop não investigado, fora do escopo desta sessão.
- **Untracked acumulados** em `backend/scripts/`, `.claude/agents/`, `docs/RECOMENDACAO-ARQUITETURA-FINAL.md`, `docs/arquitetura-agentes-pkm-cooperebr.md`, `backend/src/agents/`, `tmp_smoke_check.mjs` — Sprint Housekeeping futuro.
- **Carry-overs M26 ainda vivos:** D-novo-WA-PHONE-NORMALIZE P2, 3 ações WA declaradas sem implementação, 17 modelos BOT órfãos, `empresa_conveniada`+`proprietario_usina` iterando só `cooperados[0]`, Fase 3 Token-WA (TokenTransacao + QR + pagamento) — pausa explícita.

## Regras aplicadas na sessão

- **Decisão 23** (validação prévia rigorosa): Fase 1 read-only ampla antes de aplicar P1.1-P2.7; F0 Fase 1 read-only completa antes de qualquer toque em `cooper-token.service.ts` — Fase 2 NÃO executada sem OK explícito.
- **Multi-tenant** (`cooperativaId` do JWT): preservado em todos os pontos tocados; `STATUS_COOPERADO_ATIVOS` é constante única importada.
- **Anti-IDOR**: filtro de status fecha vetor "cadastro inativo vira contexto/JWT/impersonate".
- **Specs verdes obrigatórias**: cada bloco de fix acompanhado de specs Jest; nenhum commit com vermelho (297+ verde no fim).
- **Rebuild PM2 backend** (stop → build → restart) aplicado conforme regra do CLAUDE.md.
- **Rebuild web** + `pm2 restart cooperebr-frontend` aplicado.
- **Commits pequenos em português** — 5 commits temáticos (`fix(auth)` + `feat(coop)` + `fix(web)` + `fix(wa-bot)` + `chore(auth)`).
- **Decisão 24** — frase de retomada em local único (`CONTROLE-EXECUCAO.md` + doc-sessão).
- **Regra contato de teste** — não acionada (sessão não disparou comunicação real).
- **Regra não-paralelo com Code** — claude.ai ausente nesta sessão.

## Frase comandante

PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior). Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents disponíveis. Se não aparecer, parar e avisar (sessão não indexou subagent project-specific).

2. Rodar `git status --short` (diretriz inegociável catalogada 18/05). Se houver arquivos modificados que NÃO sou eu desta sessão, PAUSAR + Decisão 23. Esperado pós-fechamento: último commit `docs(sessao): fechamento M27 — revisao multi-tenant qual cadastro + skills Coop + F0 readonly CooperToken`; `.claude/agents/wa-bot-agent.md` modificado é carry-over M26 conhecido.

PASSO 1 — Frase de retomada principal:

Sessão 08/06 entregou M27 (revisão multi-tenant + segurança da feature "qual cadastro?" do M26 + skills Coop + F0 Fase 1 read-only CooperToken). 5 commits `6f48da7..f980a69`: filtro de status em 3 pontos (cadastro inativo não vira contexto/JWT/impersonate), chaves React por id + `contexto_ativo_id` no front, blindagem TROCAR CADASTRO em estado sensível (Fase 3 token), higiene PII em SAIR/INÍCIO, throttle 10/min em `/auth/trocar-contexto`, cookie `secure` em prod. 297+ specs verde. PM2 rebuild+restart, portas 3000/3001/3002 LISTENING. F0 Fase 1 read-only confirmou 2 bugs P0 CooperToken: (a) `processarPagamentoQr:1062-1065` credita `saldoParceiro` em QR cooperado→cooperado (token nasce do nada); (b) `processarQrParceiro:1335-1336` aplica TAXA_QR 2× (parceiro recebe 98,01 em vez de 99). **Próxima sessão Code arranca F0 Fase 2: remover bloco `creditarSaldoParceiroTx` em `processarPagamentoQr` + corrigir dupla taxa em `processarQrParceiro` reusando `resultado.taxa` e `resultado.quantidadeLiquida` + 3 specs Jest novos (saldoParceiro intocado em QR P2P, taxa 1× exato, arredondamento monetário) + rebuild PM2 backend + commit PT `fix(cooper-token): F0 remove duplo credito saldoParceiro + dupla taxa QR`.** Pré-requisitos leitura: este doc-sessão (seções F0 + Próximo passo) + `cooper-token.service.ts:939-1090` (`processarPagamentoQr`) + `cooper-token.service.ts:1320-1371` (`processarQrParceiro`) + `docs/CONTROLE-EXECUCAO.md`. Diretrizes: multi-tenant (`cooperativaId` do JWT), arredondamento monetário `Math.round(x*100)/100`, specs verdes obrigatórias, rebuild PM2 backend (stop→build→restart), commit pequeno em PT. Carry-overs não-bloqueantes do M26 ainda vivos (matcher telefone amplo D-novo-WA-PHONE-NORMALIZE, 3 ações WA declaradas sem implementação, 17 modelos BOT órfãos, `empresa_conveniada`/`proprietario_usina` iterando só `cooperados[0]`, Fase 3 Token-WA em pausa explícita) + carry-overs novos desta sessão (`.claude/agents/wa-bot-agent.md` modificado órfão M26, `cooperebr-edge-agent` stopped do projeto vizinho, untracked acumulados pra Sprint Housekeeping).
