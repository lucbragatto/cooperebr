# M24 — Bloco 8 Sprint Bot Autoatendimento: Menu Fatura + FECHAMENTO DO SPRINT INTEIRO — 24/05/2026

## TL;DR

Sessão Code maratona entregou o **Bloco 8 — Menu Fatura** completo em 8 commits + fechamento, **encerrando o Sprint Bot Autoatendimento INTEIRO**. Cooperado agora consegue ver fatura atual, histórico de pagamentos, avisar "já paguei" (cria `SolicitacaoConfirmacaoPagamento` PENDENTE pra equipe validar via painel admin novo `/dashboard/super-admin/confirmacoes-pagamento`) ou pedir negociação humana (link direto pra equipe via `NotificacoesService`). Tudo via motor dinâmico WhatsApp. **234 specs verdes** no motor (era 221 — +13 Bloco 8). **Cenário (C) MISTO** aprovado pelo Luciano: NÃO portamos `MENU_INADIMPLENTE` (dead code, D-novo-AC) nem `NEGOCIACAO_PARCELAMENTO` (placeholder, D-novo-AD). Doc-sessão inclui mini-relatório do **Sprint Bot Autoatendimento completo** (M17→M24, 8 blocos, capacidades novas do motor catalogadas).

## Marco entregue

**M24 — Bloco 8 do Sprint Bot Autoatendimento: Menu Fatura + FECHAMENTO DO SPRINT**

## Commits do dia (8 commits Bloco 8 + fechamento)

| Hash | Mensagem |
|---|---|
| `1fc34b2` | feat(schema): Bloco 8 Etapa A — SolicitacaoConfirmacaoPagamento + enum |
| `df6c203` | feat(wa): Bloco 8 Etapa B+C+D — 5 acoes do Menu Fatura no motor (ultimo bloco do sprint) |
| `5af7273` | feat(wa): Bloco 8 Etapa E — script idempotente + seed alinhado MENU_FATURA + AGUARDANDO_FORMA_PAGAMENTO |
| `56c6146` | feat(wa): Bloco 8 Etapa F — modulo SolicitacoesConfirmacaoPagamento (REST: list/confirmar/recusar) |
| `e410296` | feat(web): Bloco 8 Etapa G — tela admin /dashboard/super-admin/confirmacoes-pagamento |
| `f6ddc82` | docs(debitos): Bloco 8 Etapa H — cataloga D-novo-AC + AD + AE + AF (4 debitos novos) |
| (fechamento) | docs(sessao): fechamento M24 — Bloco 8 + SPRINT BOT AUTOATENDIMENTO FECHADO |

## Entregas técnicas Bloco 8

### Etapa A — Schema (1fc34b2)

`SolicitacaoConfirmacaoPagamento` model novo:
- `id`, `cooperadoId`, `cooperativaId`, `cobrancaId` (relations + multi-tenant)
- `valorReclamado Decimal?`, `formaPagamentoReclamada String?` (PIX/Transferencia/Deposito/Boleto/Outros — aceita texto livre)
- `status` (enum `StatusSolicitacaoConfirmacaoPagamento`: PENDENTE/CONFIRMADA/RECUSADA)
- `createdAt`, `processadaEm`, `processadaPor`, `observacoesEquipe`
- 3 índices: `(cooperativaId, status)` + `(cooperadoId)` + `(cobrancaId)`
- Back-links em `Cooperativa`, `Cooperado`, `Cobranca`
- Ritual PM2 completo + `prisma db push` + `prisma generate`

### Etapa B+C+D — Motor: 5 ações novas (df6c203)

- **`VER_FATURA_ATUAL`**: cobrança A_VENCER/VENCIDO mais antiga + `asaasCobranca` cache local (PIX copia-e-cola + boleto + link). Sem chamada síncrona ao gateway. Multi-tenant via `cooperativaId`.
- **`VER_HISTORICO_PAGAMENTOS`**: últimas 6 cobranças (qualquer status), lista compacta `MM/AAAA — R$ X — status (Pago/A vencer/Vencido/Cancelado/Pendente)`.
- **`SOLICITAR_CONFIRMACAO_PAGAMENTO`** (entry "já paguei"): valida cooperado + busca cobrança em aberto + persiste `cobrancaId` em `dadosTemp` + transiciona `AGUARDANDO_FORMA_PAGAMENTO` + pergunta dinâmica "como você fez o pagamento?".
- **`SALVAR_CONFIRMACAO_PAGAMENTO`** (wildcard em AGUARDANDO_FORMA_PAGAMENTO): cria `SolicitacaoConfirmacaoPagamento` PENDENTE + `NotificacoesService.criar` tipo `SOLICITACAO_CONFIRMACAO_PAGAMENTO` + WA confirmação + `MENU_COOPERADO`. Aceita texto livre como forma de pagamento. Multi-tenant defense in depth.
- **`SOLICITAR_NEGOCIACAO_HUMANA`** (fallback negociar): "vou te conectar com a equipe" + `NotificacoesService.criar` tipo `NEGOCIACAO_HUMANA` + `MENU_COOPERADO`. Usado pra evitar portar `NEGOCIACAO_PARCELAMENTO` placeholder (D-novo-AD).

13 specs novos. Padrão Blocos 4/5/6/7 preservado.

### Etapa E — Script idempotente + seed (5af7273)

`backend/scripts/fix-bloco-8-menu-fatura-no-fluxo.ts` em 4 partes idempotentes:
1. **Alinha modelo `menu_fatura` BD** com 4 opções do motor (era 4 opções diferentes do modelo Bloco 2)
2. **MENU_COOPERADO**: gatilho '2' agora → `MENU_FATURA` (era `VER_PROXIMA_FATURA` órfão — D-novo-AF cataloga remoção futura)
3. **MENU_FATURA**: ativado (`ativo: true`), modelo cabeado, 4 gatilhos com `acao` (motor delega controle)
4. **AGUARDANDO_FORMA_PAGAMENTO**: etapa nova (ordem 58) com wildcard `*` + `SALVAR_CONFIRMACAO_PAGAMENTO`

Idempotência confirmada: 2ª execução SKIP em todas as 4 partes. Seed alinhado.

### Etapa F — Módulo REST (56c6146)

`backend/src/solicitacoes-confirmacao-pagamento/`:
- 3 endpoints gated SUPER_ADMIN/ADMIN/OPERADOR + `@AuditLog`:
  - `GET /solicitacoes-confirmacao-pagamento?status=PENDENTE` — lista filtrada por tenant + include cooperado + cobranca
  - `POST /solicitacoes-confirmacao-pagamento/:id/confirmar` — body `{ marcarPago?: boolean }` opcional. Se true, marca Cobranca como PAGO + `dataPagamento: now`
  - `POST /solicitacoes-confirmacao-pagamento/:id/recusar` — body `{ observacoesEquipe }` obrigatório (DTO `@MinLength(3)`)
- WA cooperado em ambos os fluxos com mensagem contextual (PAGO vs registrado)
- Multi-tenant defense in depth

### Etapa G — Tela admin (e410296)

`web/app/dashboard/super-admin/confirmacoes-pagamento/page.tsx` — página separada (decisão arquitetural justificada no commit: schemas diferentes, status diferentes, ações diferentes — generalizar com `/solicitacoes` viraria render condicional pesado). Padrão Shadcn (Card + Badge + Dialog):
- Header + banner explicativo
- Filtros por status (PENDENTE/CONFIRMADA/RECUSADA/TODOS)
- Cards por solicitação com cooperado + fatura + forma pagamento + observações
- **Confirmar**: Dialog com **checkbox `marcarPago`** (default false) + textinho explicando trade-off
- **Recusar**: Dialog com Textarea + validação min 3 chars
- Sidebar `web/app/dashboard/layout.tsx` ganha 4º link em "Gestão Global"
- tsc --noEmit clean

### Etapa H — Débitos catalogados (f6ddc82)

| ID | Severidade | Descrição |
|---|---|---|
| **D-novo-AC** | P2 limpeza | `MENU_INADIMPLENTE` + `iniciarFluxoInadimplente` + `handleMenuInadimplente` dead code (zero chamadores). Cron real `cronAbordarInadimplentes` manda mensagem direta sem transicionar estado. |
| **D-novo-AD** | P1 lacuna produto | `NEGOCIACAO_PARCELAMENTO` placeholder hackish (só persiste string em `Cobranca.observacoesNegociacao`, não gera parcelas reais). Workaround: `SOLICITAR_NEGOCIACAO_HUMANA` (link humano). Sprint dedicado futuro: Asaas parcelable OU geração manual de cobranças filhas. |
| **D-novo-AE** | P2 limpeza | Handler hardcoded `handleMenuFatura` + `handleRespostaMenuFatura` + `handleComprovantePagamento` violam decisão C — atalho palavra-chave bypassa motor, `SUPER_ADMIN_PHONE` global em vez de `NotificacoesService`. |
| **D-novo-AF** | P3 limpeza | Etapa `VER_PROXIMA_FATURA` + ação `CONSULTAR_PROXIMA_FATURA` órfãs após gatilho '2' apontar pra `MENU_FATURA`. Mantido como rollback de emergência por 1-2 sprints. |

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| Bot dá baixa direto na Cobranca via "já paguei" | Risco arquitetural | Decisão produto antiga | Modelo (C) MISTO: `SolicitacaoConfirmacaoPagamento` PENDENTE + painel admin com checkbox `marcarPago` opcional | ✅ RESOLVIDO |
| `MENU_FATURA` hardcoded sem `cooperativaId` (multi-tenant violation latente) | Vazamento tenant em produção | Bot busca cooperado só por telefone | Resolvido por design — motor sempre filtra por `cooperativaId` em `VER_FATURA_ATUAL`, `VER_HISTORICO_PAGAMENTOS`, `SALVAR_CONFIRMACAO_PAGAMENTO` | ✅ RESOLVIDO |
| 4 débitos catalogados (D-novo-AC/AD/AE/AF) | Pós-portabilidade | Padrão consistente com Blocos 4/5/6 | Sprint Housekeeping pós-validação produção 1-2 sprints | 📋 CATALOGADO |

## Decisões estratégicas catalogadas

6 sub-decisões Luciano locked no prompt Fase 2 do Bloco 8:

1. **Escopo (C) MISTO** — porta MENU_FATURA + "já paguei", NÃO porta MENU_INADIMPLENTE/NEGOCIACAO_PARCELAMENTO
2. **Histórico de pagamentos SIM** — `VER_HISTORICO_PAGAMENTOS` mostra últimas 6 cobranças (qualquer status)
3. **"Já paguei" padrão Bloco 5** — `SolicitacaoConfirmacaoPagamento` PENDENTE + painel admin
4. **MENU_INADIMPLENTE D-novo-AC** — catalogar como dead code, Housekeeping limpa
5. **NEGOCIACAO_PARCELAMENTO D-novo-AD** — link humano via `NotificacoesService` (já implementado), regra real fica pra sprint futuro
6. **SUPER_ADMIN_PHONE → NotificacoesService** — consistência arquitetural com Blocos 4/5/6

Decisões adicionais técnicas (próprias do orquestrador):
- **Página admin SEPARADA** (não generalizar `/solicitacoes`) — schemas/status/ações divergentes
- **Checkbox `marcarPago`** opcional na confirmação — equipe escolhe se dá baixa ou só registra
- **Gatilho '2' do MENU_COOPERADO trocado** de `VER_PROXIMA_FATURA` pra `MENU_FATURA` — VER_PROXIMA_FATURA fica órfão (rollback de 1-2 sprints, D-novo-AF cataloga limpeza)

## Validação

- **234/234 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts` (era 221, +13 Bloco 8)
- `nest build` limpo
- `tsc --noEmit` frontend limpo
- Ritual PM2 sem incidentes (Etapa A schema + Etapa F restart pra rotas REST)
- Backend online pid 38736 (após ritual A) e 37084 (após restart Etapa F), 0 restarts pós-fechamento
- 3 rotas REST mapeadas: `/solicitacoes-confirmacao-pagamento` GET + `/confirmar` POST + `/recusar` POST
- Script Bloco 8 idempotente (2ª execução: 4 SKIP)

---

# 📊 MINI-RELATÓRIO DO SPRINT BOT AUTOATENDIMENTO COMPLETO

> Sprint aprovado por Luciano em 20/05/2026. Encerrado em 24/05/2026.
> Objetivo: completar a metade "autoatendimento" do bot WhatsApp (Menu Cooperado).
> Estado inicial: 2 de 7 opções do MENU_COOPERADO funcionavam (Bloco 3 — VER_SALDO_CREDITOS + VER_PROXIMA_FATURA).

## Blocos entregues (8 blocos, 8 marcos M17→M24)

| Bloco | Marco | Data | Tema | Capacidade nova |
|---|---|---|---|---|
| **1.a** | M17 | 20/05 | Comandos universais INICIO/SAIR/MENU | Motor reconhece comandos universais de qualquer estado |
| **2** | M18 | 21/05 | 11 modelos novos no banco (Bloco 2 — biblioteca) | Modelos templates pré-criados pros próximos blocos |
| **3** | M19 (parcial) | 21/05 | Ver saldo + Ver fatura no motor dinâmico | 2 primeiras ações no motor (CONSULTAR_SALDO_CREDITOS + CONSULTAR_PROXIMA_FATURA) — motor cobre opções 1+2 |
| **4** | M19 | 22/05 | Atualizar Cadastro (nome / email / CEP) | **Padrão Gatilho.acao estabelecido** — gatilho com `acao` faz motor DELEGAR controle total |
| **1.b** | M20 | 22/05 | Comando "ME CHAME DEPOIS" + cron horário comercial | Estado quase-terminal + cron @EVERY_HOUR com filtro 08-18h |
| **7** | M21 | 23/05 | NPS no fluxo | Schema delta (NpsResposta + cooperativaId + comentario) + ação REGISTRAR_NPS + comando manual AVALIAR |
| **6** | M22 | 23/05 | Cadastro Proxy (cooperado cadastra amigo) | **Motor recebe mídia** (5º param `media` em `executarAcao` + `temMidia` em `avaliarGatilhoMatch`) — pré-paga fluxos futuros |
| **5** | M23 | 24/05 | Atualizar Contrato (kWh / Suspender / Encerrar) | **Padrão "solicitação PENDENTE + aprovação humana"** estabelecido (modelo B Luciano) — schema novo, módulo REST, tela admin |
| **8** | M24 | 24/05 | Menu Fatura (Ver / Histórico / Já paguei / Negociar) | **Padrão "confirmação operacional"** + 2ª tela admin separada + 2º módulo REST |

## Marcos por dia

- **20/05** (M17): Bloco 1.a — comandos universais
- **21/05** (M18+M19 parcial): Blocos 2 + 3 — 11 modelos + 2 ações (saldo + fatura) no motor
- **22/05** (M19+M20): Blocos 4 + 1.b — atualizar cadastro + chamar depois
- **23/05** (M21+M22): Blocos 7 + 6 — NPS + Cadastro Proxy
- **24/05** (M23+M24): Blocos 5 + 8 — Atualizar Contrato + Menu Fatura — **SPRINT FECHADO**

## Capacidades novas do motor (estabelecidas durante o sprint)

1. **`Gatilho.acao`** (Bloco 4 M19) — gatilho pode ter ação além de `proximoEstado`. Quando presente, motor DELEGA controle total à ação (não transiciona, não renderiza modelo). Ação cuida de validar + persistir + enviar mensagem + transicionar. Fundacional pros Blocos 4-8.
2. **Parâmetro `corpo`** em `executarAcao` (Bloco 4 M19) — 4º parâmetro com texto digitado pelo cooperado. Ações de cadastro/contrato/comprovante leem esse param.
3. **Parâmetro `media`** em `executarAcao` + `temMidia` em `avaliarGatilhoMatch` (Bloco 6 M22) — 5º parâmetro com `{ base64, mimeType, nomeArquivo? }`. Wildcard `*` casa com mídia mesmo corpo vazio. Pré-paga fluxos futuros com foto/PDF.
4. **Comandos universais** (Bloco 1.a M17 + 1.b M20) — `INICIO`, `SAIR`, `MENU`, `ME CHAME DEPOIS` interceptados em qualquer estado via `executarComandoUniversalReal/Simulado`. Cron `WhatsappConversaJob @EVERY_HOUR` faz retomada em horário comercial.
5. **Padrão "solicitação PENDENTE + aprovação humana"** (Bloco 5 M23) — bot NUNCA aplica decisão sensível direto. Cria `Solicitacao<X>` PENDENTE + `NotificacoesService.criar` + WA + MENU. Equipe valida via painel admin gated SUPER_ADMIN com Dialog Shadcn pra recusar (DTO observacoesEquipe min 3 chars obrigatório).

## Evolução de specs (Jest)

| Marco | Specs no motor `whatsapp-fluxo-motor.service.spec.ts` | Delta |
|---|---|---|
| M16 (pré-sprint) | 109 | baseline |
| M17 (Bloco 1.a) | ~133 | +24 |
| M19 (Bloco 4) | 148 | +15 |
| M20 (Bloco 1.b) | 158 | +10 |
| M21 (Bloco 7) | 168 | +10 |
| M22 (Bloco 6) | 198 | +30 |
| M23 (Bloco 5) | 221 | +23 |
| **M24 (Bloco 8)** | **234** | **+13** |
| **Total sprint** | **+125 specs** | **(+115% vs baseline)** |

## Schemas / models novos do sprint

| Bloco | Model | Propósito |
|---|---|---|
| 7 (M21) | `NpsResposta` (já existia, ganhou `cooperativaId` + `comentario`) | Multi-tenant + qualitativo |
| 6 (M22) | `Indicacao` (já existia, agora criada formalmente no fluxo) | Defense in depth pro cadastro proxy |
| 5 (M23) | `SolicitacaoAlteracaoContrato` + 2 enums (`TipoAlteracaoContrato` + `StatusSolicitacaoContrato`) | Bot pede alteração contrato sem aplicar direto |
| 8 (M24) | `SolicitacaoConfirmacaoPagamento` + 1 enum (`StatusSolicitacaoConfirmacaoPagamento`) | Bot avisa pagamento sem dar baixa direto |

## Módulos REST novos

| Bloco | Módulo | Endpoints |
|---|---|---|
| 5 (M23) | `SolicitacoesContratoModule` | GET / POST aprovar / POST recusar |
| 8 (M24) | `SolicitacoesConfirmacaoPagamentoModule` | GET / POST confirmar (com flag `marcarPago`) / POST recusar |

## Telas admin novas

| Bloco | Tela | Funcionalidade |
|---|---|---|
| 5 (M23) | `/dashboard/super-admin/solicitacoes` | Listar + aprovar (aplica imediato) + recusar (Dialog observação) |
| 8 (M24) | `/dashboard/super-admin/confirmacoes-pagamento` | Listar + confirmar (Dialog checkbox `marcarPago` opcional) + recusar (Dialog observação) |

## Débitos catalogados ao longo do sprint

| ID | Bloco/Marco | Severidade | Descrição |
|---|---|---|---|
| D-novo-U | 3/M19 | P2 | Handler hardcoded ver fatura usa status `PENDENTE` inexistente |
| D-novo-V | 3/M19 | P3 melhoria | Modelos com lógica condicional no código (não no template) |
| D-novo-W | 7/M21 | P3 | Divergência hardcoded CONCLUIDO × motor MENU_COOPERADO pós-NPS |
| D-novo-X | 7/M21 | P3 | `agendarNps` dead code |
| D-novo-Y | 7/M21 | P3 | Modelo `nps_trimestral` órfão |
| D-novo-Z | 6/M22 | P3 | Divergência Cadastro Proxy hardcoded × motor |
| D-novo-AA | 6/M22 | P3 | Cooperado proxy fica com placeholders eternos cpf/email |
| D-novo-AB | 5/M23 | P2 | Handler hardcoded `handleAtualizacaoContrato` viola decisão B |
| **D-novo-AC** | 8/M24 | P2 | `MENU_INADIMPLENTE` dead code |
| **D-novo-AD** | 8/M24 | P1 lacuna produto | `NEGOCIACAO_PARCELAMENTO` placeholder — regra de negócio não definida |
| **D-novo-AE** | 8/M24 | P2 | Handler hardcoded `handleMenuFatura` viola decisão C |
| **D-novo-AF** | 8/M24 | P3 | Etapa `VER_PROXIMA_FATURA` + ação `CONSULTAR_PROXIMA_FATURA` órfãs |

**Total catalogado durante o sprint: 12 débitos (D-novo-U a AF).** Praticamente todos no escopo de Sprint Housekeeping pós-validação produção. Único P1: D-novo-AD (NEGOCIACAO_PARCELAMENTO) — depende de decisão de produto Luciano.

## Arquivos chaves criados

### Backend (NestJS)
- `src/whatsapp/whatsapp-fluxo-motor.service.ts` — motor dinâmico, ~2780 linhas (era ~1400 pré-sprint), 22 ações novas
- `src/solicitacoes-contrato/` (M23) — módulo REST + service + DTO + controller
- `src/solicitacoes-confirmacao-pagamento/` (M24) — módulo REST + service + DTO + controller
- `scripts/fix-bloco-1a-comandos-universais-no-fluxo.ts`
- `scripts/fix-bloco-2-modelos-novos.ts`
- `scripts/fix-bloco-3-menu-cooperado-saldo-fatura.ts`
- `scripts/fix-bloco-4-atualizar-cadastro.ts`
- `scripts/fix-bloco-6-cadastro-proxy-no-fluxo.ts`
- `scripts/fix-bloco-7-nps-no-fluxo.ts`
- `scripts/fix-bloco-5-atualizar-contrato-no-fluxo.ts`
- `scripts/fix-bloco-8-menu-fatura-no-fluxo.ts`

### Frontend (Next.js)
- `web/app/dashboard/super-admin/solicitacoes/page.tsx` (M23)
- `web/app/dashboard/super-admin/confirmacoes-pagamento/page.tsx` (M24)
- `web/app/dashboard/layout.tsx` — sidebar com 2 novos links em Gestão Global

### Documentação
- `docs/sessoes/2026-05-20-bloco-1a-comandos-universais.md`
- `docs/sessoes/2026-05-21-bloco2-bloco3.md`
- `docs/sessoes/2026-05-22-bloco4-atualizar-cadastro.md`
- `docs/sessoes/2026-05-22-bloco-1b-chamar-depois.md`
- `docs/sessoes/2026-05-23-bloco7-nps.md`
- `docs/sessoes/2026-05-23-bloco6-cadastro-proxy.md`
- `docs/sessoes/2026-05-24-m23-bloco5-atualizar-contrato.md`
- `docs/sessoes/2026-05-24-m24-bloco8-menu-fatura-sprint-fechado.md` (este arquivo)
- 8 relatórios Fase 1 read-only em `docs/relatorios/`

## Próximo passo

**Sprint Bot Autoatendimento FECHADO. Próximo:**

### Onboarding parceiros reais

1. **cooperebr1 (E-Solares / CoopereBR)** — primeira cooperativa real do dono. Vai testar o bot WhatsApp em produção com cooperados reais.
2. **Consórcio Sinergia** — segundo parceiro real, depende de:
   - Vocabulário multi-tipo finalizado (CLAUDE.md menciona débito P2 — 73 exceptions backend + ~50 telas com termo "Cooperado" hardcoded)
   - Sprint 6 IDOR (auditoria multi-tenant sistêmica)
   - D-novo-Q (contatos teste persistentes) resolvido

### Validação em produção

Antes de Sprint Housekeeping limpar débitos D-novo-AB a AF, **deixar 1-2 sprints com o motor rodando em produção** pra confirmar estabilidade. Risco: regressão silenciosa se desativar handler hardcoded sem confirmação real.

### Sprint Housekeeping (após validação)

12 débitos D-novo-U a AF + reformat órfão 18/05 + scripts auxiliares + limpeza dos handlers hardcoded substituídos pelo motor dinâmico. Estimativa: 8-12h Code.

### Decisão produto pendente (D-novo-AD)

`NEGOCIACAO_PARCELAMENTO` real precisa de:
- Regra: 2x/3x/Nx? Sem juros? Com juros?
- Caminho: Asaas parcelable (`installmentCount` no API) OU geração manual de cobranças filhas
- Quando Luciano definir → sprint dedicado (~12-20h Code)

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` — ONDE PARAMOS + FRASE DE RETOMADA (Decisão 24 local único)
- `docs/sessoes/2026-05-24-m24-bloco8-menu-fatura-sprint-fechado.md` — esta sessão (mini-relatório completo do sprint)
- `~/.claude/projects/C--Users-Luciano-cooperebr/memory/sprint_bot_autoatendimento_20_05.md` — sprint mãe (aprovada agora ENTREGUE)
- `docs/PLANO-ATE-PRODUCAO.md` — próximas frentes (onboarding cooperebr1 / Sinergia)
- `docs/debitos-tecnicos.md` — 12 débitos do sprint (D-novo-U a AF) pra Sprint Housekeeping
- `CLAUDE.md` — regras do projeto + vocabulário multi-tipo (débito P2 para Consórcio Sinergia)
- `backend/src/whatsapp/whatsapp-fluxo-motor.service.ts` — motor dinâmico (~2780 linhas, 22 ações)

## Carry-overs (não-bloqueantes)

- 12 débitos D-novo-U a AF — Sprint Housekeeping
- Decisão produto D-novo-AD (NEGOCIACAO_PARCELAMENTO regra real) — sprint dedicado
- Vocabulário multi-tipo hardcoded (CLAUDE.md P2) — bloqueia Sinergia/Consórcio
- D-novo-Q (contatos teste persistentes) — 6-8h, bloqueia Sinergia
- Demais carry-overs anteriores (HTML jornada, Iniciativa Fluxos Customizáveis, etc)
- 11 falhas pré-existentes na suíte Jest (cooperados/usinas — não-minhas, idênticas M19..M23)

## Regras aplicadas na sessão

- ✅ Ritual de abertura: skill `retomada-sessao` invocada via /abertura
- ✅ Decisão 23 (Fase 1 read-only): aplicada antes da Etapa A — relatório em `docs/relatorios/2026-05-24-fase1-bloco8-menu-fatura.md`
- ✅ Decisão 14 (validação prévia): grep amplo antes de catalogar D-novo-AC..AF
- ✅ Multi-tenant defense in depth (`cooperativaId` em todas as 5 ações + módulo REST + service)
- ✅ TDD (specs first, red→implement→green verificado)
- ✅ Ritual PM2 (parar/rodar/restart) — script Etapa E executado sem conflito
- ✅ Commits pequenos em português (7 separados — schema/motor/script/REST/UI/débitos/fechamento)
- ✅ Bot não toca contatos reais — Bloco 8 só notifica equipe (NotificacoesService) e cooperado próprio (WhatsappSenderService)
- ✅ Gateway adapter pattern preservado — Bloco 8 lê `asaasCobranca` cache local, não chama Asaas síncrono
- ✅ NEVER force push / NEVER --no-verify
- ✅ Fechamento canônico em curso (skill `fechamento-sessao`)

## Frase comandante

> Frase canônica única em `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único, atualizada 24/05 fechamento M24 Bloco 8 + SPRINT FECHADO).
