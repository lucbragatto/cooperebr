# Sessão 2026-05-21 — Sprint Bot Autoatendimento: blocos preparatórios + correção rodapé

## TL;DR

Sessão Code dedicada que abriu o **Sprint Bot Autoatendimento WhatsApp** (repriorizado por Luciano em 21/05 ao reabrir a sessão — agora vem **ANTES** do M15 Fio B) e entregou todos os blocos preparatórios. **Bloco 1.a (Navegação Universal)** — camada de comandos INÍCIO/SAIR/MENU no motor antes de `avaliarGatilhos`, com rodapé universal automático. **Bloco 0 (quick wins)** — gatilho "5 Indicar amigo" cabeado pra ENVIAR_CONVITE, `{{site}}` corrigido. **Bloco 0 v2** — 3 variáveis órfãs reais resolvidas (`{{historico}}` populado lendo `dadosTemp.historicoConsumo`, `{{valorFatura}}` → `{{valorFaturaMedia}}`, `{{mesesGratis}}` removido por ser variável fantasma). **Bloco 2** — 11 modelos novos inseridos no banco (pros Blocos 4/6/7/8). **Correção retroativa de rodapé** — anexar em toda etapa (não só menu). **2 relatórios criados** — revisão etapa-por-etapa (16 etapas) + revisão das 19 mensagens do fluxo. **89/89 specs verdes** (era 56 ontem). **8 commits empacotados pra push de fechamento.**

## Marco entregue

**M17 — Sprint Bot Autoatendimento WhatsApp: blocos preparatórios completos**

## Commits do dia (8)

| Hash | Mensagem |
|---|---|
| `3ebf41c` | docs(plano+debitos): cataloga Sprint Bot Autoatendimento + Iniciativa Fluxos Customizaveis |
| `480809b` | docs(plano+debitos): repriorizacao Sprint Bot Autoatendimento ANTES do M15 Fio B |
| `9205f0d` | feat(wa): Bloco 1.a — Comandos Universais de Navegacao no motor |
| `3717b51` | fix(wa): rodape anexado em TODA etapa ativa (regressao Bloco 1.a) |
| `5d85d17` | feat(wa): Bloco 0 — quick wins (gatilho 5 cabeado + modelo ajuda corrigido) |
| `95346fc` | feat(wa): Bloco 0 v2 — resolve 3 variaveis orfas reais (motor + modelos) |
| `1097f72` | feat(wa): Bloco 2 — inserir 11 modelos novos pros Blocos 4/6/7/8 |
| `a41495d` | docs(plano): atualiza status Sprint Bot Autoatendimento + fila operacional ate M15 |

## Entregas técnicas

### Backend (`whatsapp-fluxo-motor.service.ts`)

**Bloco 1.a — Camada de comandos universais (antes de `avaliarGatilhos`):**
- `detectarComandoUniversal(corpo)` — palavra exata, case-insensitive, sinônimos INÍCIO/SAIR/MENU
- `resolverEstadoComandoUniversal(comando, conversa)` — INICIO→INICIAL / SAIR→null / MENU→MENU_COOPERADO|INICIAL
- `executarComandoUniversalReal(...)` — bot real (persiste + envia)
- `executarComandoUniversalSimulado(...)` — preview zero side-effect
- Aplicado em **ambos** os caminhos (`processarComFluxoDinamico` + `simular`)
- `SimulacaoOutput` ganha `comandoUniversalAplicado: 'INICIO'|'SAIR'|'MENU'|null`
- Ping sintético `__simulador_ping__` não aciona comando (preserva mount/handleReiniciar do SimuladorCelular)

**Rodapé universal (correção 21/05):**
- `anexarRodapeSeMenu` renomeado pra `anexarRodape` — anexa em TODA etapa (incluindo terminais como AGUARDANDO_ATENDENTE, onde cooperado fica preso e o escape mais importa)
- Heurística "só menu" removida

**Bloco 0 v2 — Variáveis órfãs:**
- `{{historico}}` populado via novo helper `formatarHistoricoConsumo(raw)` — formato "MM/AA: NNN kWh - R$ X,XX" (idêntico ao bot hardcoded `whatsapp-bot.service.ts:1543-1550`). Lê de `dadosTemp.historicoConsumo`
- `{{telefone}}` adicionada ao `extrairVariaveis()` (era órfã do `proxy_confirmar` que seria inserido no Bloco 2)

### Frontend (`SimuladorCelular.tsx`, `page.tsx`)

**Bloco 1.a no simulador:**
- Bolha amarela `[sistema]` quando `data.avisoTransicao` preenchido
- Frontend não bloqueia comando universal — backend define

### Dados (banco DEV — 6 scripts idempotentes)

| Script | Efeito |
|---|---|
| `fix-bloco-0-quick-wins.ts` | Gatilho 5 MENU_COOPERADO `MENU_COOPERADO → ENVIAR_CONVITE` + modelo `ajuda` sem `{{site}}` |
| `fix-bloco-0-v2-orfas-reais.ts` | `lead_fora_area`: `{{valorFatura}}` → `{{valorFaturaMedia}}`. `simulacao_resultado`: linha `{{mesesGratis}}` removida |
| `fix-bloco-2-modelos-novos.ts` | 11 modelos novos GLOBAIS inseridos (proxy_*, aguardando_novo_*, menu_inadimplente, menu_fatura, nps_recebido) |
| `revisao-etapa-por-etapa.ts` | Read-only — dados das 16 etapas ativas |
| `revisao-mensagens-bot.ts` | Read-only — dados dos 19 modelos do fluxo |
| `diag-completo-banco-mensagens-fluxo.ts` (carry-over 20/05) | Read-only consolidado |

### Specs (`whatsapp-fluxo-motor.service.spec.ts`)

- **89/89 verdes** (era 56 no fim de ontem, 81 no início desta sessão)
- 25 specs novos do Bloco 1.a (detectar / resolver / anexar rodapé / processar / simular)
- 1 spec novo "rodapé sempre anexa" (correção 21/05)
- 5 specs novos do Bloco 0 v2 (`{{historico}}` em 4 cenários + telefone)
- 2 specs novos do Bloco 2 (`{{telefone}}` populado + vazio)
- 6 specs antigos atualizados pra esperar rodapé universal (mensagens renderizadas agora sempre têm rodapé)

### Documentos

- `docs/relatorios/2026-05-21-revisao-etapa-por-etapa-bot.md` (~400 linhas) — revisão das 16 etapas ATIVAS + revisão de 19 mensagens (PARTE 4 anexada). Inclui correção retroativa de contradição interna (item 2 da PARTE 3).
- `docs/PLANO-ATE-PRODUCAO.md` — Sprint Bot Autoatendimento (Seção 3b) com **status detalhado dos 8 blocos** (4 ✅ + 4 🔴). Nova **Seção 3d "Fila operacional próxima"** com 4 itens em sequência: Sprint Bot Autoatendimento → M15 Fio B → cooperebr2 → Sinergia, mostrando dependência crítica do módulo Fio B.
- `docs/debitos-tecnicos.md` — D-novo-S + D-novo-T com status atualizado.

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| Rodapé só em menu | UX (regressão Bloco 1.a) | `anexarRodapeSeMenu` filtrava por `gatilhos.length > 0` — etapas terminais (AGUARDANDO_ATENDENTE, FOTO_FATURA) ficavam SEM escape | Renomeado pra `anexarRodape`, anexa em TODA etapa | ✅ RESOLVIDO (`3717b51`) |
| Gatilho "5 Indicar amigo" loop | Funcional | `MENU_COOPERADO → MENU_COOPERADO` (loop puro). Caminho `ENVIAR_CONVITE` criado no R5 (20/05) não estava cabeado nessa entrada | UPDATE gatilho → ENVIAR_CONVITE | ✅ RESOLVIDO (`5d85d17`) |
| Modelo `ajuda` com `{{site}}` vazio | UX | Cooperativa não tem campo `site/website/url` no schema | Trocar por `{{parceiro}}` + `{{telefone_suporte}}` (existentes) | ✅ RESOLVIDO (`5d85d17`) |
| `{{historico}}` órfã real | Bug latente | Variável usada em `confirmacao_dados` mas motor NUNCA populava | Helper `formatarHistoricoConsumo()` lendo `dadosTemp.historicoConsumo` | ✅ RESOLVIDO (`95346fc`) |
| `{{valorFatura}}` órfã real | Bug latente | Motor popula `valorFaturaMedia` (sufixo "Media"). Modelo `lead_fora_area` usava nome sem sufixo | Alinhar modelo (1 fonte de verdade) | ✅ RESOLVIDO (`95346fc`) |
| `{{mesesGratis}}` órfã real | Bug latente | Variável fantasma — zero matches no backend inteiro | Remover linha do modelo (não inventar fonte) | ✅ RESOLVIDO (`95346fc`) |
| `{{telefone}}` órfã (preventiva) | Bug latente que viria com Bloco 2 | `proxy_confirmar` usa `{{telefone}}` mas não estava no `extrairVariaveis()` | Adicionada ANTES de inserir o modelo (lição Bloco 0 v2 — não inserir com órfã) | ✅ RESOLVIDO (`1097f72`) |
| 3 etapas ATIVAS duplicadas no INICIAL | Dado | 2 globais + 1 tenant ativas no mesmo estado | **Decisão produto Luciano** — qual desativar? | 🟡 CATALOGADO |
| Menu Cooperado opções 1/2 viram loop | Funcional | Campo `acao` em gatilho não é processado pelo motor | Bloco 3 do sprint (~12-18h, próximo) | 🟡 CATALOGADO |
| Atualizar Contrato (4 opções) volta ao menu | Funcional | Sem ação real implementada | Bloco 5 do sprint, **decisão produto** (ação automática vs humano) | 🟡 CATALOGADO |
| `{{distribuidora}}` vazia em AGUARDANDO_DISPOSITIVO_EMAIL | UX | Caminho `MENU_SEM_FATURA→2` chega antes de Escolher Distribuidora | **Decisão produto** (reescrever modelo ou ajustar caminho) | 🟡 CATALOGADO |
| Horário hardcoded "Seg–Sex 8h–18h" em `aguardando_atendente` | UX pré-Sinergia | Não parametrizado por tenant | **Decisão produto** (parametrizar via `{{horario_atendimento}}`) | 🟡 CATALOGADO |
| Variáveis-fantasma na UI ModalMensagem | UX admin | UI sugere `{{kwh}}`, `{{cpf}}`, etc — não populadas pelo motor | Sub-débito UX admin (~30min, limpar lista ou popular) | 🟡 CATALOGADO |

## Decisões estratégicas catalogadas

Nenhuma memória persistente nova criada nesta sessão. Aplicadas memórias existentes:

- `sprint_bot_autoatendimento_20_05.md` — escopo do sprint, blocos seguidos à risca
- `iniciativa_fluxos_customizaveis_20_05.md` — visão longo prazo, referenciada na Seção 3d
- `regra_validacao_previa_e_retomada.md` Decisão 23 (Fase 1 read-only antes de cada bloco — aplicada 5 vezes hoje)
- `regra_help_automatico_paginas_19_05.md` (micro-help nos atalhos do simulador)
- `decisao_24_frase_retomada_unica.md` (frase única no CONTROLE-EXECUCAO)
- `regra_contato_teste_impreterivel.md` + diretriz `isAmbienteReal` (não tocadas — código novo do Bloco 1.a não dispara em simulador)

**Decisão de produto** importante registrada no PLANO Seção 3d (21/05): o módulo Fio B (M15) **destrava simultaneamente** cooperebr2 (cálculo correto de cobrança) e Onboarding Sinergia (2º tenant precisa de cobrança regulatória correta desde o dia 1). Visibilidade da fila.

## Próximo passo

**Bloco 3 do Sprint Bot Autoatendimento WhatsApp** — Consultas Menu Cooperado (Ver saldo de créditos + Ver próxima fatura) implementadas como ações reais no motor lendo `cooper-token` + `cobrancas` (~12-18h Code).

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` (estado atualizado + FRASE DE RETOMADA)
- `docs/sessoes/2026-05-21-sprint-bot-autoatendimento-blocos-preparatorios.md` (esta sessão)
- `docs/PLANO-ATE-PRODUCAO.md` Seção 3b (status Sprint Bot Autoatendimento) + Seção 3d (fila operacional)
- `docs/relatorios/2026-05-21-revisao-etapa-por-etapa-bot.md` (16 etapas + 19 mensagens)
- Memória `sprint_bot_autoatendimento_20_05.md` (escopo dos 8 blocos)
- Código a inspecionar para Bloco 3:
  - `backend/src/cooper-token/` (ledger + service)
  - `backend/src/cobrancas/cobrancas.service.ts` (próxima fatura)
  - `backend/src/whatsapp/whatsapp-fluxo-motor.service.ts:executarAcao()` (onde adicionar `VER_SALDO_CREDITOS` e `VER_PROXIMA_FATURA`)

## Carry-overs (não-bloqueantes)

**Decisões produto pendentes pro Luciano:**
- Desativar 1 das 2 etapas globais ATIVAS duplicadas no INICIAL (recomendação técnica: `Receber fatura` ordem=1)
- Atualizar Contrato (Bloco 5): ação automática vs solicitação + atendente humano
- Menu Fatura / Menu Inadimplente (Bloco 8): dinâmico vs hardcoded
- `{{distribuidora}}` vazia em AGUARDANDO_DISPOSITIVO_EMAIL (reescrever ou ajustar caminho)
- Horário hardcoded em `aguardando_atendente` (parametrizar via variável pré-Sinergia)
- Variáveis-fantasma na UI `ModalMensagem` (~30min)

**Blocos pendentes do Sprint Bot Autoatendimento (~25-43h restantes):**
- 🔴 Bloco 1.b — ME CHAME DEPOIS (~3-5h, exige job de reagendamento)
- 🔴 **Bloco 3 — Ver saldo + Ver fatura (PRÓXIMO, ~12-18h)**
- 🔴 Bloco 4 — Atualizar Cadastro (~6-8h, modelos prontos)
- 🔴 Bloco 5 — Atualizar Contrato (~4-6h, decisão produto)
- 🔴 Bloco 6 — Cadastro Proxy (~6-8h, modelos prontos)
- 🔴 Bloco 7 — NPS no fluxo (~2-3h, modelo pronto)
- 🔴 Bloco 8 — Menu Fatura/Inadimplente (~4-6h, decisão produto)

**Após Sprint Bot Autoatendimento (fila operacional 3d):**
- M15 Sprint 5a Neutro Fio B (3-5 dias, cria módulo Fio B)
- Cadastrar usina cooperebr2 (depende M15)
- Onboarding Sinergia (depende M15 + Sprint 6 IDOR + D-novo-Q Contatos Teste)

**Outros carry-overs catalogados:**
- D-novo-Q Contatos Teste persistentes (6-8h)
- Sprint Housekeeping (~3-5h)
- HTML jornada Sugestão #6
- D-novo-H refator técnico (~6-8h)
- Iniciativa Fluxos Customizáveis (futuro, ~100-200h+)

## Regras aplicadas na sessão

- ✅ **Decisão 23** — Fase 1 read-only antes de cada bloco (aplicada em Bloco 1.a, Bloco 0, Bloco 0 v2, Bloco 2, e na PARTE 3/4 da revisão)
- ✅ **Decisão 24** — frase de retomada em local único
- ✅ **Decisão 14** — grep amplo antes de catalogar D-novo-S/T (zero colisão)
- ✅ **`git status --short` antes de cada commit** (8 commits separados por natureza)
- ✅ **Protocolo PM2** — restart após cada mudança backend (5 restarts limpos)
- ✅ **Multi-tenant** — `{{telefone}}` novo no `extrairVariaveis()` lê só de `dadosTemp` (sem cross-tenant)
- ✅ **Padrão UX dual Tipo A/B/C** — nenhum bloco misturou
- ✅ **Commits separados por natureza** — docs (3ebf41c, 480809b, a41495d), código (9205f0d, 3717b51, 5d85d17, 95346fc), código+dados (1097f72)
- ✅ **Smoke programático com dados reais** — todos os scripts mostraram ANTES/DEPOIS
- ✅ **Não inserir modelo com variável órfã** (lição Bloco 0 v2 → aplicada preventivamente no Bloco 2 com `{{telefone}}`)
- ✅ **Não-paralelo com claude.ai** — sessão Code 100% pelo Luciano direto

## Frase comandante

Frase canônica única em `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único, atualizada 21/05 fechamento M17).
