# Sessão 2026-05-23 — Sprint Bot Autoatendimento / Bloco 7: NPS no fluxo

## TL;DR

Bloco 7 do Sprint Bot Autoatendimento WhatsApp ENTREGUE em 6 commits +
fechamento. O NPS — que era infraestrutura dormente (model existia,
modelos de mensagem no banco, handler hardcoded funcional, MAS nenhum
gatilho cabeava pra `NPS_AGUARDANDO_NOTA`) — agora está ligado ao motor
dinâmico via ação `REGISTRAR_NPS` e tem comando manual de teste
(`AVALIAR` no MENU_COOPERADO). Schema ganhou `cooperativaId` (multi-tenant)
+ `comentario` (pré-pago) opcionais via delta puramente aditivo. 10 specs
novos verdes (era 158 motor → 168, total nos meus arquivos: 194). PM2
restart limpo. 3 débitos catalogados em `debitos-tecnicos.md`
(divergência hardcoded CONCLUIDO × motor MENU_COOPERADO, `agendarNps`
dead code, modelo `nps_trimestral` órfão). Suíte completa **656/667**
(11 falhas pré-existentes em cooperados/usinas controllers — idênticas
ao M20, confirmadas via `git stash` na sessão anterior; 0 falhas
causadas pelo Bloco 7). Próximo natural na ordem definida pelo Luciano:
**Bloco 6 (Cadastro Proxy, ~6-8h)**.

## Marco entregue

**M21 — Sprint Bot Autoatendimento WhatsApp: Bloco 7 (NPS no fluxo)**

## Commits do dia (6 + fechamento)

| Hash | Mensagem |
|---|---|
| `2cd5663` | feat(schema): Bloco 7 Etapa A — NpsResposta ganha cooperativaId + comentario opcionais |
| `2b207e4` | feat(wa): Bloco 7 Etapa B — acao REGISTRAR_NPS no motor dinamico |
| `088c9c9` | fix(wa): Bloco 7 Etapa B — vars manuais em REGISTRAR_NPS (build TS) |
| `a8fa1db` | feat(wa): Bloco 7 Etapa C — script idempotente liga NPS ao motor + seed alinhado |
| `51c40fa` | feat(wa): Bloco 7 Etapa D — comando manual de teste 'AVALIAR' no MENU_COOPERADO |
| `f2fd0d1` | docs(debitos): Bloco 7 Etapa E — cataloga D-novo-W/X/Y (debt latente NPS) |
| (a seguir) | docs(sessao): fechamento M21 — Bloco 7 Sprint Bot Autoatendimento NPS |

## Entregas técnicas

### Etapa A — Schema delta aditivo (commit `2cd5663`)

`backend/prisma/schema.prisma` model `NpsResposta`:
- `cooperativaId String?` — multi-tenant. Populado pela ação
  `REGISTRAR_NPS` via `conversa.cooperativaId`. Aditivo opcional pra
  preservar registros legados (tabela `nps_respostas` estava vazia no
  DEV, delta zero risco).
- `comentario String?` — texto qualitativo opcional. **NÃO usado neste
  bloco** (ação persiste `null`). Pré-pago pra sprint futuro de NPS
  qualitativo sem custo adicional.

**Ritual PM2 aplicado:** `pm2 stop` → `npx prisma db push` (database in
sync em 1.95s) → `npx prisma generate` (v6.19.2) → `npm run build`
(limpo) → `pm2 restart` (online pid 8716, 0 restarts).

### Etapa B — Ação `REGISTRAR_NPS` no motor (commits `2b207e4` + `088c9c9`)

**`whatsapp-fluxo-motor.service.ts`:** ganha case `REGISTRAR_NPS` no
switch `executarAcao` apontando pra `executarRegistrarNps` (padrão Bloco
4 — método privado dedicado).

Comportamento:
- **Guard `cooperadoId`** — se ausente, envia mensagem amigável de
  cadastro e retorna (não persiste).
- **Validação** — `parseInt((corpo ?? '').trim(), 10)` espelhando
  hardcoded `handleNpsNota:4018`. Inválido (NaN, < 0, > 10) → erro inline
  "⚠️ Nota inválida. Digite um número de 0 a 10:" e NÃO transiciona
  (retry no fluxo, mantém em `NPS_AGUARDANDO_NOTA`).
- **Persistência** — `prisma.npsResposta.create` com `cooperadoId`,
  `cooperativaId: conversa.cooperativaId ?? null`, `telefone`, `nota`,
  `comentario: null`, `canal: 'WHATSAPP'`. Try/catch defensivo —
  erro Prisma → mensagem genérica + NÃO transiciona (retry).
- **Renderização** — busca modelo `nps_recebido` no banco com
  `filtroTenantSomenteLeitura(cooperativaId)`. Se modelo existe:
  renderiza com `vars: { parceiro: cooperativa?.nome ?? 'CoopereBR' }` +
  `anexarRodape` + `incrementarUso`. Se modelo ausente: fallback
  hardcoded curto "Obrigado pelo feedback! 💚".
- **Transição** — `prisma.conversaWhatsapp.update` pra `MENU_COOPERADO`
  (decisão Luciano #4 X — consistente com Blocos 4 e 1.b).

**Fix `088c9c9`** — `extrairVariaveis()` exige `dadosTemp` na assinatura
que `executarRegistrarNps` não passa. Substituído por construção manual
de vars (padrão consistente com Bloco 3 `CONSULTAR_*` e Bloco 4
`ATUALIZAR_*`). Modelo `nps_recebido` usa apenas `{{parceiro}}`.

**10 specs novos** em `whatsapp-fluxo-motor.service.spec.ts`:
- Sem cooperadoId → mensagem cadastro + não persiste
- Nota inválida texto / negativa / > 10 → erro + retry (3 testes)
- Nota 0 limite inferior / 10 limite superior → persiste + transiciona (2)
- Nota intermediária com trim + multi-tenant → renderiza modelo com vars
- Sem cooperativaId → persiste `cooperativaId: null` (lead)
- Modelo `nps_recebido` ausente → fallback hardcoded + transiciona
- Erro Prisma → mensagem genérica + não transiciona

### Etapa C — Script idempotente liga NPS ao motor (commit `a8fa1db`)

**`backend/scripts/fix-bloco-7-nps-no-fluxo.ts`** (padrão Blocos 3/4):

1. **Read-only check** — confirma modelo `nps_aguardando_nota` existe no
   banco (pergunta de nota, inserido em script histórico não localizado
   nos seeds atuais — referência em `scripts/fix-r2-coopereb-para-parceiro.ts:12`).
   Confirma modelo `nps_recebido` (Bloco 2) com warning suave se faltar.
2. **UPDATE `FluxoEtapa`** `NPS_AGUARDANDO_NOTA` (id `f-nps`, global):
   - `modeloMensagemId`: aponta pro `nps_aguardando_nota` (era cabeado
     mas com `gatilhos: []`).
   - `gatilhos: [{ resposta: '*', proximoEstado: 'MENU_COOPERADO',
     acao: 'REGISTRAR_NPS' }]` (gatilho wildcard que delega ao motor via
     `Gatilho.acao` — pattern do Bloco 4).
   - `acaoAutomatica: null` (ação dispara via gatilho, não via entrada).

**Aplicado no banco DEV:**
- 1ª execução: ATUALIZADA (gatilhos vazio → wildcard + ação)
- 2ª execução: SKIP total (idempotência confirmada)

**Seed `seed-fluxos-bot.mjs:111`** atualizado pra manter fonte de
verdade — novos parceiros já são criados com NPS cabeado.

**Ritual PM2 aplicado.**

### Etapa D — Comando manual de teste `AVALIAR` (commit `51c40fa`)

**Decisão Luciano #1 (a+e):** só infra + comando manual de teste.
Implementação escolhida: **Opção 1b — gatilho no banco (caminho mais
leve)**.

Justificativa da escolha (no commit):
- Opção 1 (comando bot) vs Opção 2 (endpoint admin POST `/admin/nps/...`):
  comando bot vence em peso (zero auth/JWT/role/controller).
- Sub-opção 1b (gatilho no banco) vs 1a (universal) vs 1c (detecção
  no motor): 1b vence porque é apenas dado, sem código.
- Universais (Bloco 1.a/1.b) são navegação
  (INICIO/SAIR/MENU/CHAMAR_DEPOIS) — `AVALIAR` é ação especial, não
  encaixa.
- Worst case: cooperado real dispara auto-NPS sem dano (Luciano OK).

**Implementação:** gatilho `{ resposta: 'AVALIAR', proximoEstado:
'NPS_AGUARDANDO_NOTA' }` adicionado ao `MENU_COOPERADO` (id
`f-menu-cooperado`, global). Match exato uppercase. NÃO conflita com
comandos universais (que têm precedência + lista própria de sinônimos).

**Script `fix-bloco-7-nps-no-fluxo.ts`** ganha Parte 3 (idempotente —
pula se já tem gatilho `AVALIAR`).

**Aplicado no banco DEV:**
- 1ª execução Parte 3: ATUALIZADA (7 → 8 gatilhos em MENU_COOPERADO)
- 2ª execução: SKIP (idempotência confirmada)

**Seed `seed-fluxos-bot.mjs:21-32`** atualizado.

Sem specs novos pra esta etapa — gatilho é apenas dado, já coberto pelo
padrão genérico de `avaliarGatilhos`/`avaliarGatilhoMatch`.

### Etapa E — 3 débitos catalogados (commit `f2fd0d1`)

`docs/debitos-tecnicos.md` ganha 3 entradas P3 (Decisão 14 aplicada —
grep confirmou D-novo-W/X/Y livres):

- **D-novo-W** — Divergência comportamento NPS hardcoded
  (`finalizarConversa` → CONCLUIDO) vs motor dinâmico
  (`REGISTRAR_NPS` → MENU_COOPERADO). Cooperado pode ter UX diferente
  conforme caminho. Fix proposto: 1 linha no hardcoded pra alinhar.
- **D-novo-X** — `agendarNps()` em
  `whatsapp-bot.service.ts:3990-4011` é dead code (zero callers no grep
  amplo). Tem texto hardcoded "CoopereBR" não multi-tenant + setTimeout
  frágil. Fix proposto: delete.
- **D-novo-Y** — Modelo `nps_trimestral` órfão em
  `seed-fluxo-padrao.ts:138-144` (sem caller). 2 opções: reusar pro
  cron trimestral futuro OU remover. Depende decisão Luciano sobre
  disparo automático.

Todos slotados pra Sprint Housekeeping.

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| Etapa `NPS_AGUARDANDO_NOTA` órfã (`gatilhos: []`) — NPS infraestrutura dormente | UX produto (latente) | Bloco 2 (21/05) inseriu modelos de mensagem; etapa estava no seed (ordem 21) mas nunca foi cabeada com gatilhos no banco; `agendarNps` dead code | Gatilho wildcard `*` com ação `REGISTRAR_NPS` cabeado via script idempotente + ação implementada no motor | ✅ RESOLVIDO (`a8fa1db` + `2b207e4`) |
| `NpsResposta` sem `cooperativaId` — não multi-tenant (regra dura do projeto) | hardening | Model criado historicamente sem campo, hardcoded `handleNpsNota` cria sem cooperativaId | Delta schema aditivo `cooperativaId String?` + ação `REGISTRAR_NPS` popula via `conversa.cooperativaId` | ✅ RESOLVIDO (`2cd5663` + `2b207e4`) |
| Sem caminho de teste pro NPS (sem trigger automático no Bloco 7) | UX dev | Disparo automático é decisão maior — fica pra sprint futuro | Gatilho `AVALIAR` em MENU_COOPERADO (Opção 1b — só dado) permite admin/cooperado testar imediatamente | ✅ RESOLVIDO (`51c40fa`) |
| Divergência comportamento NPS hardcoded × motor | P3 polimento | Hardcoded transiciona pra CONCLUIDO, motor pra MENU_COOPERADO (decisão Luciano #4 X) | 1 linha de fix no hardcoded — agendado pra Sprint Housekeeping | 📋 CATALOGADO D-novo-W |
| `agendarNps()` dead code | P3 limpeza | Função criada mas nunca chamada; texto hardcoded "CoopereBR" não multi-tenant; setTimeout frágil | Remover em Sprint Housekeeping | 📋 CATALOGADO D-novo-X |
| Modelo `nps_trimestral` órfão | P3 limpeza | Seedado mas sem caller — intenção de cron trimestral nunca implementada | Reusar (se opção (d) Luciano) OU remover em Sprint Housekeeping | 📋 CATALOGADO D-novo-Y |

## Decisões estratégicas catalogadas

Nenhuma memória persistente nova criada nesta sessão. Decisões de produto
aplicadas vieram do prompt do Luciano (Fase 2 Bloco 7) e ficam
registradas neste doc-sessão:

- **Disparo NPS (decisão #1 = a+e)** — só infra + comando manual.
  Trigger automático (event-based / cron) fica pra sprint futuro.
- **cooperativaId (decisão #2 = SIM)** — multi-tenant ativado.
- **comentario opcional (decisão #3 = SIM)** — pré-pago pra futuro.
- **Estado pós-NPS (decisão #4 = X)** — MENU_COOPERADO (consistente
  Blocos 4 e 1.b).
- **Gatilho (decisão #5 = wildcard)** — 1 gatilho `*` validando 0-10
  inline (vs 11 gatilhos numéricos).

## Próximo passo

**Bloco 6 do Sprint Bot Autoatendimento — Cadastro Proxy (~6-8h).**

Ordem definida pelo Luciano: 1.b ✅ → 7 ✅ → **6** (próximo).

Escopo prévio (memória `sprint_bot_autoatendimento_20_05.md`): ativar 4
etapas inativas (`CADASTRO_PROXY_NOME`, `CADASTRO_PROXY_TELEFONE`,
`AGUARDANDO_FATURA_PROXY`, `CONFIRMAR_PROXY`) + criar 4 modelos
(`proxy_pedindo_nome`, `proxy_pedindo_telefone`,
`proxy_pedindo_fatura`, `proxy_confirmar` — **já inseridos no banco**
via Bloco 2 commit `1097f72`) + ação `CADASTRAR_AMIGO_POR_PROXY` no
motor (portar lógica do bot hardcoded existente).

Restantes do sprint após Bloco 6:
- 🟡 Bloco 5 — Atualizar Contrato (~4-6h) — **decisão produto pendente**
- 🟡 Bloco 8 — Menu Fatura/Inadimplente (~4-6h) — **decisão produto pendente**

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` (estado atualizado + FRASE DE RETOMADA)
- `docs/sessoes/2026-05-23-bloco7-nps-no-fluxo.md` (esta sessão)
- `docs/sessoes/2026-05-22-bloco4-atualizar-cadastro.md` (M19 — padrão
  ação de 2 turnos referência direta pra `CADASTRAR_AMIGO_POR_PROXY`)
- Memória `sprint_bot_autoatendimento_20_05.md` (escopo Bloco 6)
- Antes de Fase 2 Bloco 6: confirmar via Fase 1 read-only:
  - Existe handler hardcoded `handleCadastroProxy*` no `whatsapp-bot.service.ts`?
  - As 4 etapas `CADASTRO_PROXY_*` estão como `FluxoEtapa` no banco?
  - Quais validações o hardcoded faz (telefone, nome, etc) — reusar
    padrão Bloco 4.
  - Estrutura de dados — provavelmente cria `LeadWhatsapp` ou
    `Cooperado` PENDENTE_VINCULO; mapear pra ação.

## Carry-overs (não-bloqueantes)

**Decisões produto pendentes pro Luciano (M17/M18/M19/M20/M21):**
- Bloco 5 (Atualizar Contrato): ação automática vs solicitação humana
- Bloco 8 (Menu Fatura / Menu Inadimplente): dinâmico vs hardcoded
- Disparo automático do NPS pós-Bloco 7 (Sprint futuro): (b) reativar
  agendarNps / (c) listener event / (d) cron trimestral
- Desativar 1 das 2 etapas globais ATIVAS duplicadas no INICIAL
- `{{distribuidora}}` vazia em `AGUARDANDO_DISPOSITIVO_EMAIL`
- Horário hardcoded em `aguardando_atendente`
- Variáveis-fantasma na UI ModalMensagem
- 4 falhas pré-existentes na suíte Jest (cooperados/usinas controllers)

**Fila operacional pós-Sprint Bot Autoatendimento:**
- M15 Sprint 5a Neutro Fio B (3-5 dias)
- Cadastrar usina cooperebr2 (depende M15)
- Onboarding Sinergia (depende M15 + Sprint 6 IDOR + D-novo-Q)

**Débitos catalogados (incluindo 3 novos do Bloco 7):**
- D-novo-Q Contatos Teste persistentes (6-8h)
- D-novo-U fix handler hardcoded ver fatura (1-2h, Sprint Housekeeping)
- D-novo-V engine de template `{{#if}}/{{#unless}}` (~8-12h)
- **D-novo-W divergência NPS CONCLUIDO×MENU_COOPERADO (5 min, Sprint Housekeeping)**
- **D-novo-X agendarNps dead code (5 min, Sprint Housekeeping)**
- **D-novo-Y modelo nps_trimestral órfão (5 min OU reuso)**
- Sprint Housekeeping geral (~3-5h)
- HTML jornada Sugestão #6
- D-novo-H refator técnico (~6-8h)
- Iniciativa Fluxos Customizáveis D-novo-T (~100-200h+)
- Sugestão #9 Monitoramento de Proteção (Relé) Opção A — feature futura

## Regras aplicadas na sessão

- ✅ **TDD em cada etapa** — Etapa B teve 10 specs novos primeiro (red),
  implementação depois (green), commit. Etapa C/D só dado (sem specs
  dedicados — comportamento genérico já testado).
- ✅ **Decisão 23** — Fase 1 read-only fechada anteriormente (M20.1); 5
  decisões produto travadas no prompt da Fase 2 antes da execução.
- ✅ **Decisão 14** — grep amplo confirmou D-novo-W/X/Y livres antes de
  catalogar.
- ✅ **Multi-tenant** — `cooperativaId` vem de `conversa.cooperativaId`
  (não de corpo/parâmetro externo). `filtroTenantSomenteLeitura(cooperativaId)`
  na busca do modelo `nps_recebido`.
- ✅ **Reuse** — desenho aproveitou model `NpsResposta` existente
  (delta aditivo) + modelos de mensagem do banco + padrão Bloco 4 (ação
  privada, guard cooperadoId, validação inline, retry, transição).
- ✅ **Sem suposições** — Fase 1 mapeou estado real (model existia sem
  cooperativaId, modelos no banco, `agendarNps` dead code) antes de
  propor desenho.
- ✅ **Padrão Bloco 4** — `executarRegistrarNps` espelha
  `executarAtualizar*Cooperado` (estrutura idêntica).
- ✅ **Ritual PM2** (CLAUDE.md) — aplicado em A (schema delta) e C+D
  (script). Backend sempre voltou limpo (0 restarts).
- ✅ **Commits pequenos e em português** — 6 commits de trabalho + 1
  fechamento. Mensagens com escopo claro.
- ✅ **NUNCA force push, sem --no-verify** — push normal.
- ✅ **Contatos teste** — não houve disparo real (só specs com mocks +
  scripts de banco). Regra preservada.
- ✅ **NÃO trabalhar paralelo com claude.ai** — Code 100% direto.
- ✅ **`git status --short` ANTES de cada commit** — confirmado.
- ✅ **Decisão 24** — frase de retomada em local único no
  `CONTROLE-EXECUCAO.md`.

## Frase comandante

Frase canônica única em `docs/CONTROLE-EXECUCAO.md` seção
`## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único,
atualizada 23/05 no fechamento M21 Bloco 7).
