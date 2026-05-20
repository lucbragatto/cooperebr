# Sessão 2026-05-20 — Bloco UX Simulador WhatsApp + Saneamento Fluxo do Bot

## TL;DR

Sessão Code longa (~8h) entregou o **sub-débito UX do simulador WhatsApp** (mensagem da etapa + gatilhos aceitos + atalhos clicáveis), os 6 fixes do **relatório de investigação 20/05 manhã** (R2 hardcodes "CoopereBR" → `{{parceiro}}`, R3 botão ▶ testa etapa exata, R4 aviso na transição órfã, R5 "Convidar amigo" cabeado no fluxo dinâmico, R1 limpeza 4 etapas duplicadas, R6 reativação 5 etapas órfãs), 2 observações de revisão (OBS 1 hardening multi-tenant em `executarEnviarLinkIndicacao`, OBS 2 eliminar mensagem redundante "🎁"), e um **relatório completo do banco de mensagens + fluxo do bot** em linguagem humana pro Luciano. **9 commits locais empacotados num único push de fechamento.** Specs: 56/56 verdes (era 27 no início da sessão de 19/05 noite). Estado pós-saneamento: zero estados-destino órfãos, zero hardcodes, zero modelos duplicados. Decisões pendentes catalogadas pra próxima sprint (sub-débitos R6+).

## Marco entregue

**M16 — Bloco UX Simulador WhatsApp + Saneamento Fluxo do Bot**

## Commits do dia (9)

| Hash | Mensagem |
|---|---|
| `de91302` | feat(wa): simulador mostra mensagem do bot + gatilhos aceitos + atalhos |
| `e9e039c` | fix(wa): R2 — modelos menu_principal e nps_aguardando_nota usam {{parceiro}} |
| `c9ad444` | feat(wa): R4 avisoTransicao + R3 etapaIdForcado no simulador |
| `c51651d` | fix(wa): R3 — etapaIdForcado vale ate a 1a transicao (residuo) |
| `9ed2220` | feat(wa): R5 — acao ENVIAR_LINK_INDICACAO no motor dinamico |
| `fa7ad66` | feat(wa): R5 — gatilho 4 + etapa ENVIAR_CONVITE (dados) |
| `f486efd` | fix(wa): R5 — hardening multi-tenant + eliminar redundancia (OBS 1+2) |
| `db4605c` | chore(wa): R1 Saneamento — deletar 4 etapas inativas duplicadas |
| `0a94aac` | chore(wa): R6 Saneamento — reativar 5 etapas orfas + modelo novo |

## Entregas técnicas

### Backend (`whatsapp-fluxo-motor.service.ts`)

- **`interface Gatilho` exportada** (era privada) — UI passou a tipar gatilhos da etapa.
- **`SimulacaoEtapaResumo`** ganhou `gatilhos: Gatilho[]`.
- **`SimulacaoOutput`** ganhou 3 campos novos:
  - `mensagemEtapaAtual: string | null` — o que o cooperado veria ao entrar na etapa (renderizado).
  - `avisoTransicao: string | null` — alerta quando transiciona pra estado sem etapa ativa (R4).
- **`SimulacaoInput`** ganhou `etapaIdForcado?: string | null` (R3) — frontend força etapa específica em vez do motor escolher por estado.
- **Helper privado novo** `renderizarMensagemDeEtapa()` — usado em `etapaAtual` e `proximaEtapa`, reduz duplicação.
- **Helper privado novo** `buscarEtapaPorIdForcado()` — resolve etapa por id com filtro `OR [tenant|null]` (segurança multi-tenant na 1ª resolução).
- **Case `ENVIAR_LINK_INDICACAO`** no `executarAcao()` (R5) — implementado em `executarEnviarLinkIndicacao()`:
  - Sem `cooperadoId` → mensagem de cadastro
  - Com `cooperadoId` + código existente → envia link
  - Com `cooperadoId` + código null → gera 8 chars A-Z0-9, persiste, envia link
  - **Hardening multi-tenant (OBS 1):** `findFirst({where:{id, cooperativaId}})` em vez de `findUnique({where:{id}})` — defesa em profundidade, cooperado de outro tenant não é encontrado mesmo com dadosTemp poluído
  - **Mensagem enxuta (OBS 2):** envia só `${link}\n\nCompartilhe...` — modelo da etapa já avisou "Vou te enviar 👇", evita redundância
- **Tipo de `conversa`** em `executarAcao` ganhou `cooperativaId?` — agora propagado de `processarComFluxoDinamico`.

### Backend (`whatsapp-simulacao.controller.ts`)

- `SimularBody` ganhou `etapaIdForcado?: string | null` com validação tipo string|null.
- `resolverEscopo()` continua governando `cooperativaId` (sem mudança).

### Frontend (`web/components/whatsapp-config/SimuladorCelular.tsx`)

- Tipos `EtapaResumo` + `RespostaSimular` alinhados com novos campos backend.
- Props ganhou `etapaIdForcado?: string | null`.
- Ref `idForcadoRef` consome o id na 1ª chamada (mount/ping) e **mantém vivo até a 1ª TRANSIÇÃO bem-sucedida** (resíduo R3 — admin testa gatilhos da etapa forçada sem perder a forçagem se digitar texto inválido).
- **Bolha inicial do bot** (useEffect mount + handleReiniciar): adiciona role:'bot' com `data.mensagemEtapaAtual` após o ping — elimina "digitei e não sei o que aconteceu".
- **Bolha amarela `[sistema]`** quando `data.avisoTransicao` preenchido (R4).
- **Painel "Respostas que o bot aceita"** lista `etapaAtualResumo.gatilhos` no Card lateral direito. Wildcard `*` exibido como "qualquer texto". Lista vazia → aviso amarelo.
- **Atalhos clicáveis** abaixo do input — 1 botão por gatilho não-wildcard + micro-help "Clique numa resposta abaixo ou digite a sua no campo" (regra `regra_help_automatico_paginas_19_05`).

### Frontend (`web/app/dashboard/whatsapp-config/page.tsx`)

- Novo state `etapaIdForcadoSim: string | null` (R3).
- Botão ▶ da lista de etapas passa `etapa.id` agora (era só `etapa.estado`).
- Botão "Testar fluxo" do topo continua passando `null` (motor decide normal).

### Specs (`whatsapp-fluxo-motor.service.spec.ts`)

- **56/56 verdes** (era 27 no início da sessão 19/05, 39 no commit `de91302` da manhã de hoje).
- Specs novos por marco:
  - Sub-débito UX (`de91302`): 3 specs (mensagemEtapaAtual com modelo / sem modelo / sem etapaAtual)
  - R4 (`c9ad444`): 3 specs (transição órfã → aviso / transição OK → null / não-transição → null)
  - R3 (`c9ad444`): 4 specs (resolve por id / isolamento outro tenant / transições seguintes não forçam / null = comportamento atual)
  - R5 (`9ed2220`): 5 specs (sem cooperadoId / com código existente / sem código→gera+persiste / cooperado zumbi / ZERO SIDE EFFECT em simular)
  - OBS 1 (`f486efd`): 2 specs (findFirst filtra por id+cooperativaId / ISOLAMENTO outro tenant)
- `prismaMock` ganhou `cooperado: { findUnique, update }`. `cooperadoFindFirst` injetado via `beforeEach` no describe R5.

### Dados (banco DEV, scripts idempotentes)

| Script | Efeito | ANTES → DEPOIS |
|---|---|---|
| `fix-r2-coopereb-para-parceiro.ts` | 2 modelos | `menu_principal`: "*CoopereBR*" → "*{{parceiro}}*". `nps_aguardando_nota`: "a CoopereBR" → "a {{parceiro}}" |
| `prisma/seed-mensagens.ts` | 4 linhas (alinhamento futuro seed) | L11 boas_vindas, L34 simulacao_resultado (2×), L42 proposta_pdf, L66 ajuda |
| `fix-r5-convite-fluxo-dinamico.ts` | 1 modelo + 1 etapa + 2 gatilhos | Criou modelo `convite_indicacao` GLOBAL + etapa `ENVIAR_CONVITE` ordem=23 com `acaoAutomatica=ENVIAR_LINK_INDICACAO`. Gatilho `"4" → ENVIAR_CONVITE` adicionado em "Entrada Dinâmica" TENANT + "Menu Principal" GLOBAL |
| `fix-r5-convite-fluxo-dinamico.ts` (rodada 2 — OBS 2) | 1 modelo atualizado | `convite_indicacao` conteúdo: "🎁 Pronto! Te enviei seu link..." → "🎁 Beleza! Vou te enviar seu link de indicação 👇" |
| `fix-r1-deletar-etapas-duplicadas.ts` | 4 etapas DELETADAS | `f-confirmacao-dados` ordem=8 / `f-confirmacao-proposta` ordem=9 / `f-confirmacao-cadastro` ordem=10 / `f-concluido` ordem=11 (dump preservado no log) |
| `fix-r6-reativar-etapas-orfas.ts` | 5 etapas ATIVADAS + 1 modelo novo | Ativadas: AGUARDANDO_ATENDENTE, AGUARDANDO_FOTO_FATURA, ATUALIZACAO_CONTRATO, AGUARDANDO_DISTRIBUIDORA, AGUARDANDO_DISPOSITIVO_EMAIL. Modelo novo `aguardando_dispositivo_email` GLOBAL (id=`cmpe9043v0000va60jrf8ecq0`) com `{{distribuidora}}` |

### Documentos

- `docs/relatorios/2026-05-20-banco-mensagens-fluxo-bot.md` (320 linhas, linguagem humana) — 6 seções + síntese. Lista TODOS os 29 modelos + 25 etapas + mapa do fluxo + becos + duplicações + sugestões. Estado pós-saneamento documentado.

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| **Sub-débito UX simulador** | UX (carry-over) | Frontend não exibia mensagem da etapa nem listava gatilhos quando admin clicava ▶ | Backend retorna `mensagemEtapaAtual` + `gatilhos` no resumo; frontend renderiza bolha bot + painel + atalhos | ✅ RESOLVIDO (`de91302`) |
| **R2 — Hardcode "CoopereBR" em 2 modelos** | UX | Migração parcial seed→banco deixou 2 modelos com string literal | UPDATE banco + alinhar seed | ✅ RESOLVIDO (`e9e039c`) |
| **R3 — Botão ▶ abre etapa errada quando 2+ etapas no mesmo estado** | Funcional | Frontend passava só `etapa.estado`; motor escolhia pela regra tenant>global+ordem | `etapaIdForcado` no SimulacaoInput; helper `buscarEtapaPorIdForcado` com OR tenant\|null | ✅ RESOLVIDO (`c9ad444` + resíduo `c51651d`) |
| **R4 — Bot mudo na transição pra estado órfão** | UX | `proximaEtapa:null` retornava `mensagensEnviadas:[]` sem feedback no front | `avisoTransicao: string\|null` na output + bolha sistema | ✅ RESOLVIDO (`c9ad444`) |
| **R5 — "Convidar amigo" não funciona no fluxo dinâmico** | Funcional | (a) Modelo cita "4 Convidar" mas sem gatilho 4; (b) `executarAcao` placeholder; (c) sem etapa ENVIAR_CONVITE | Ação `ENVIAR_LINK_INDICACAO` no motor + etapa GLOBAL nova + gatilho 4 cabeado | ✅ RESOLVIDO (`9ed2220` + `fa7ad66`) |
| **OBS 1 — `findUnique` sem cooperativaId em `executarEnviarLinkIndicacao`** | Segurança multi-tenant | Violava regra dura "toda query filtra por cooperativaId" | `findFirst({where:{id, cooperativaId}})` + tipo de conversa ampliado | ✅ RESOLVIDO (`f486efd`) |
| **OBS 2 — 2 mensagens "🎁" redundantes (modelo + ação)** | UX | Modelo dizia "Te enviei seu link..." E ação dizia "Seu link: ..." — repetição | Modelo enxuto "Beleza! Vou te enviar 👇" + ação envia só link+CTA | ✅ RESOLVIDO (`f486efd`) |
| **R1 — 4 etapas inativas duplicadas** | Dado | Seed antigo deixou pares (ativa+inativa) no mesmo estado | DELETE 4 etapas inativas (ordens 8/9/10/11) | ✅ RESOLVIDO (`db4605c`) |
| **R6 — 5 estados-destino órfãos no fluxo** | Funcional | Etapas inativas pra estados que gatilhos ativos apontavam (bot ficava mudo) | Ativadas 5 etapas + criado modelo `aguardando_dispositivo_email` | ✅ RESOLVIDO (`0a94aac`) |

### Catalogados pra próxima sprint (sub-débitos)

| Item | Tipo | Tamanho estimado |
|---|---|---|
| **Menu Cooperado opções 1, 2, 5 viram loop** (Ver créditos / Ver fatura / Indicar amigo) — campo `acao` no gatilho não é processado pelo motor | código | 4-6h por opção implementada |
| **Atualizar Contrato — 4 opções voltam ao menu** sem ação real | código + decisão Luciano | 6-10h |
| **Atualizar Cadastro — 4 estados-destino não existem** (AGUARDANDO_NOVO_NOME/EMAIL/TELEFONE/CEP) | dado + código | 4-6h |
| **Cadastro por Proxy — 4 etapas inativas sem modelo** | dado + código + decisão Luciano | 6-8h |
| **NPS — gatilhos 0-10 ausentes** na etapa inativa | dado + código | 2-3h |
| **MENU_FATURA / MENU_INADIMPLENTE — etapas inativas sem modelo** | decisão Luciano | 4-6h cada |
| **Variável `{{site}}` retorna vazio** — modelo `ajuda` usa "acesse: {{site}}" | código (mínimo) | 30min |
| **2 etapas ATIVAS duplicadas em INICIAL** ("Receber fatura" + "Boas-vindas / Menu Principal") — mortas pro CoopereBR mas perigosas pra parceiro novo | decisão Luciano | 5min (UPDATE ativo=false) |

## Decisões estratégicas catalogadas

Nenhuma memória persistente nova criada nesta sessão. Aplicadas memórias existentes:

- `regra_help_automatico_paginas_19_05.md` (micro-help nos atalhos do simulador)
- `regra_fechamento_sessao_inegociavel.md` (todo o ritual desta doc)
- `regra_validacao_previa_e_retomada.md` Decisão 23 (Fase 1 read-only antes de cada bloco — aplicada 4 vezes hoje)
- `decisao_24_frase_retomada_unica.md` (frase única no CONTROLE-EXECUCAO)
- `regra_contato_teste_impreterivel.md` + diretriz `isAmbienteReal` (não tocadas — código novo do R5 nem dispara em simulador)

## Próximo passo

**M15 — Sprint 5a Neutro Fio B** (3-5 dias Code dedicado). Mantido como próximo marco prioritário desde 18/05. Pré-requisitos foram cumpridos hoje (sub-débito UX simulador + saneamento do fluxo do bot — ambos eram bloqueadores enumerados).

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` (estado atualizado + FRASE DE RETOMADA)
- `docs/sessoes/2026-05-20-bloco-ux-simulador-saneamento-fluxo-wa.md` (esta sessão)
- `docs/sessoes/2026-05-18-m13-m14-sub-fase-1-mais-sprint-8.md` (M14.B + Engine Otimização)
- `docs/relatorios/2026-05-20-banco-mensagens-fluxo-bot.md` (estado completo do bot pós-saneamento)
- `docs/specs/PROPOSTA-GD1-GD2-FIOB-2026-03-26.md` (spec base M15)
- Memória `decisao_caminho_b_fio_b_neutro_18_05.md`

## Carry-overs (não-bloqueantes)

- **Sub-débitos do bot dinâmico** (lista completa na seção "Bugs resolvidos / catalogados") — todos catalogados como pendências de sprint dedicada futura
- **D-novo-Q Contatos Teste persistentes** (6-8h Code, escopo completo em memória + débitos) — slot natural Sprint Housekeeping
- **Sprint Housekeeping** ~3-5h (stash reformat Prettier + .gitattributes CRLF + scripts órfãos)
- **HTML jornada Sugestão #6**
- **D-novo-H refator técnico** ~6-8h
- **Etapas duplicadas ATIVAS no INICIAL** — desativar uma das 2 globais (5min UPDATE)
- **Variável `{{site}}` vazia** no modelo `ajuda` (30min decidir + popular)

## Regras aplicadas na sessão

- ✅ **Decisão 23** — Fase 1 read-only antes de cada bloco de escrita (aplicada em sub-débito UX, R5, e Sprint Saneamento)
- ✅ **Decisão 24** — frase de retomada em local único (atualizada apenas em `## FRASE DE RETOMADA`, sem duplicação)
- ✅ **`git status --short` antes de cada commit** (diretriz 18/05) — confirmou só `M` esperados + untracked catalogados
- ✅ **Protocolo PM2** — `pm2 stop/restart` sempre que tocou código backend; sem locks do Prisma engine
- ✅ **Multi-tenant** — `findFirst({where:{id, cooperativaId}})` no R5 OBS 1; spec ISOLAMENTO validando cooperado de outro tenant não é encontrado
- ✅ **`isAmbienteReal()`** — código novo do R5 não introduz check `NODE_ENV` (não dispara em simulador automaticamente porque `simular()` não chama `executarAcao()`)
- ✅ **Decisão 14** — grep amplo antes de catalogar débito novo (sem conflitos de numeração neste fechamento)
- ✅ **Padrão UX dual Tipo A/B/C** — nenhum bloco misturou (Sub-débito UX foi modificação inline de componente existente, R5 dialog foi reuso de PhoneFrame existente)
- ✅ **Commits separados por natureza** — dado vs código vs OBS num único arquivo, mas commits separados (R2 dado isolado, R4+R3 código junto, R5 backend separado de dados, R1 separado de R6)
- ✅ **Help inline obrigatório** (regra `regra_help_automatico_paginas_19_05`) — micro-texto "Clique numa resposta abaixo ou digite a sua no campo"
- ✅ **Smoke programático com dados reais** — scripts `fix-r2`, `fix-r5`, `fix-r1`, `fix-r6` rodaram contra banco real, mostraram ANTES/DEPOIS, idempotentes
- ✅ **Não-paralelo com claude.ai** — sessão Code 100% pelo Luciano direto, sem orquestração paralela
