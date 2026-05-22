# Sessão 2026-05-22 noite — Sprint Bot Autoatendimento / Bloco 1.b: ME CHAME DEPOIS

## TL;DR

Bloco 1.b do Sprint Bot Autoatendimento WhatsApp ENTREGUE em 2 commits +
fechamento. Completa a família de comandos universais de navegação
(INÍCIO/SAIR/MENU/CHAMAR_DEPOIS) iniciada no Bloco 1.a (M17). O cooperado
agora pode dizer "ME CHAME DEPOIS" em qualquer etapa, e o bot: (a) calcula
retorno em +24h (postergado pra 08:00 se cair fora do horário comercial
08-18h); (b) persiste `retornarEm` no `dadosTemp` da conversa; (c)
transiciona pra estado novo `AGENDADO_RETORNO`; (d) envia confirmação curta.
O retorno em si é processado por método novo `processarRetornosAgendados()`
no `WhatsappConversaJob` (que já roda `@Cron EVERY_HOUR`), filtrando 08-18h
e transicionando pra `MENU_COOPERADO` (cooperado) ou `INICIAL` (lead). 36
specs novos verdes (23 motor + 13 job NOVO). PM2 restart limpo (pid 28984).
A pergunta-chave da Fase 1 ("exige job novo OU reusa job?") foi resolvida
com **reuso**: extendido `WhatsappConversaJob` existente sem criar arquivo
novo de cron nem tabela.

## Marco entregue

**M20 — Sprint Bot Autoatendimento WhatsApp: Bloco 1.b (ME CHAME DEPOIS)**

## Commits do dia (2 + fechamento)

| Hash | Mensagem |
|---|---|
| `99d4d3b` | feat(wa): Bloco 1.b Etapa A — 4o comando universal CHAMAR_DEPOIS no motor |
| `d14876c` | feat(wa): Bloco 1.b Etapa B — processarRetornosAgendados no WhatsappConversaJob |
| (a seguir) | docs(sessao): fechamento M20 — Bloco 1.b Sprint Bot Autoatendimento (ME CHAME DEPOIS) |

## Entregas técnicas

### Etapa A — Motor (commit `99d4d3b`)

**`whatsapp-fluxo-motor.service.ts`:**

- **`detectarComandoUniversal`** ganha 4º retorno `'CHAMAR_DEPOIS'` com 6
  sinônimos: `ME CHAME DEPOIS`, `CHAME DEPOIS`, `ME LIGA DEPOIS`,
  `VOLTAR DEPOIS`, `OUTRA HORA`, `MAIS TARDE`. **NÃO inclui** `DEPOIS`
  sozinho (evita falso positivo dentro de fluxos onde cooperado digita
  "depois" como resposta a outra pergunta).
- **`resolverEstadoComandoUniversal`** ganha branch `'CHAMAR_DEPOIS' → null`
  (caminho próprio em `executarComandoUniversal*`, padrão similar ao SAIR).
- **`executarComandoUniversalReal`** ganha case `'CHAMAR_DEPOIS'` análogo ao
  SAIR: persiste `dadosTemp.retornarEm` (ISO string), atualiza estado pra
  `'AGENDADO_RETORNO'`, envia mensagem curta de confirmação ("Beleza! Volto
  a te chamar amanhã neste horário. 👋"), log com tenant.
- **`executarComandoUniversalSimulado`** ganha case análogo: retorna
  `SimulacaoOutput` com `estadoFinal: 'AGENDADO_RETORNO'` +
  `comandoUniversalAplicado: 'CHAMAR_DEPOIS'` + `avisoTransicao` explicativo.
  Zero side-effect (não persiste, não envia).
- **Novo helper privado `calcularRetornarEm()`**:
  - +24h a partir de agora.
  - Se `getHours() < 8` (madrugada): `setHours(8, 0, 0, 0)` (mesmo dia).
  - Se `getHours() >= 18` (noite): posterga +1 dia + `setHours(8, 0, 0, 0)`.
  - Sábado/domingo aceitos (decisão Luciano: filtro 08-18h cobre hora do
    dia, NÃO dia da semana).
- **`SimulacaoOutput.comandoUniversalAplicado`** ganha `'CHAMAR_DEPOIS'` no
  tipo (`'INICIO' | 'SAIR' | 'MENU' | 'CHAMAR_DEPOIS' | null`).

**Decisão arquitetural importante:** `AGENDADO_RETORNO` é estado String livre
— **sem schema delta**, **sem `FluxoEtapa` correspondente no banco**. Conversa
fica parada nesse estado até o cron processar. Se cooperado mandar mensagem
no meio (caso raro — acabou de pedir pra ser chamado depois), cai no
fallback hardcoded que reseta pra INICIAL — comportamento aceitável.

### Etapa B — Job (commit `d14876c`)

**`whatsapp-conversa.job.ts`:**

- **Constructor** ganha `WhatsappSenderService` (DI resolvido pelo
  `WhatsappModule` — ambos no mesmo módulo, sem mudança no module).
- **Novo `@Cron(CronExpression.EVERY_HOUR) processarRetornosAgendados()`**:
  1. Early return se hora atual `< 8` ou `>= 18` (decisão Luciano:
     horário comercial 08-18h).
  2. `findMany` em `ConversaWhatsapp` filtrando `estado: 'AGENDADO_RETORNO'`
     (cross-tenant por natureza — cron varre todas; cada envio é pra uma
     conversa específica com `telefone` próprio).
  3. Pra cada conversa: lê `dadosTemp.retornarEm`, pula se inválido/ausente,
     pula se `> agora` (futuro), processa se `<= agora`.
  4. Próximo estado: `MENU_COOPERADO` se `cooperadoId` presente; senão
     `INICIAL` (lead).
  5. `dadosTemp.retornarEm` removido; demais campos preservados (spread +
     `delete`).
  6. `enviarMensagem(telefone, 'Voltei como combinado. 👋 Em que posso ajudar?')`
     via `WhatsappSenderService` (camadas de proteção `isAmbienteReal()`
     preservadas).
  7. Try/catch por conversa: erro em uma não interrompe o loop.
  8. Log resumido (`X processadas, Y pendentes futuro, Z puladas invalidas`).
- **`resetarConversasInativas`** ganha guard defensivo:
  ```typescript
  where: {
    AND: [
      { estado: { startsWith: 'AGUARDANDO_' } },
      { estado: { notIn: ['AGENDADO_RETORNO', 'ENCERRADO'] } },
    ],
    updatedAt: { lt: limite },
  }
  ```
  `AGENDADO_RETORNO` já não casava o `startsWith` por prefixo distinto, mas
  o guard explícito documenta intenção e previne regressão futura.

### Specs

**`whatsapp-fluxo-motor.service.spec.ts`** — 23 cenários novos:
- 8 em `detectarComandoUniversal`: 6 sinônimos casam + 1 negativo
  "DEPOIS sozinho não casa" + 1 negativo "frase com palavras extras".
- 2 em `resolverEstadoComandoUniversal`: CHAMAR_DEPOIS → null com/sem
  cooperadoId.
- 6 em `calcularRetornarEm`: caso base (14:00), madrugada (02:00),
  noite (19:00), limite 18:00, limite 08:00, sábado/domingo aceito.
- 5 em `executarComandoUniversalReal`: estado persistido + dadosTemp +
  mensagem + sem estadoAnterior (decisão Luciano) + dadosTemp ausente
  + return true.
- 2 em `executarComandoUniversalSimulado`: output esperado + zero
  side-effect.

**`whatsapp-conversa.job.spec.ts` (NOVO)** — 13 cenários:
- 4 cenários horário comercial: hora < 8 / hora >= 18 / limite 08:00
  dentro / limite 17:59 dentro.
- 1 cenário sem conversas → no-op.
- 1 cenário retornarEm no futuro → não processa.
- 2 cenários retornarEm no passado: cooperadoId → MENU_COOPERADO; sem
  cooperadoId → INICIAL.
- 1 cenário preserva outros campos do dadosTemp.
- 1 cenário dadosTemp sem retornarEm pula defensivo.
- 1 cenário múltiplas conversas vencidas processadas independentemente.
- 2 cenários regressão `resetarConversasInativas`: guard explícito de
  AGENDADO_RETORNO + comportamento original preservado.

**Total acumulado de specs verdes nos meus arquivos:** 184 (158 motor +
13 job + 13 CEP). Era 158 no fim do M19.

### Etapa C — Ritual PM2 + suíte completa

- `pm2 stop cooperebr-backend` → `npm run build` (limpo) →
  `pm2 restart cooperebr-backend` → online pid 28984, 0 restarts.
- Backend logs: `Nest application successfully started` +
  `Backend rodando na porta 3000`.
- Suíte Jest completa: **646/657** (11 falhas pré-existentes em
  cooperados/usinas controllers — confirmadas idênticas às do M19 que
  já foram confirmadas via `git stash`. **0 falhas causadas pelo Bloco
  1.b.**)

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| Comando "ME CHAME DEPOIS" não existia (família universal incompleta) | UX produto | Bloco 1.a entregou só 3 dos 4 comandos universais | 4º comando completo (motor + job + estado) | ✅ RESOLVIDO (`99d4d3b`, `d14876c`) |
| `WhatsappConversaJob.resetarConversasInativas` sem guard explícito de estados quase-terminais | hardening | `startsWith: 'AGUARDANDO_'` proteção implícita por prefixo; vulnerável a regressão futura (renomeação) | Guard explícito `notIn: ['AGENDADO_RETORNO', 'ENCERRADO']` via AND-array | ✅ RESOLVIDO (`d14876c`) |
| Contradição na frase comandante do M19 ("exige job" vs "reusa job") | documentação | Frase ambígua não esclarecia se "exige" era arquivo novo ou só código novo | Resolvida na Fase 1: reuso do `WhatsappConversaJob` (sem arquivo novo de cron, sem tabela). Detalhe em `docs/relatorios/2026-05-22-fase1-bloco1b-me-chame-depois.md` | ✅ RESOLVIDO (Fase 1 read-only) |

## Decisões estratégicas catalogadas

Nenhuma memória persistente nova criada nesta sessão. Decisões de produto
aplicadas vieram do prompt do Luciano (Fase 2 Bloco 1.b) e ficam registradas
neste doc-sessão:

- **+24h FIXO** — sem sub-menu de prazos. Simples + cron horário já existe.
- **Volta pro MENU_COOPERADO** (ou INICIAL pra lead) — contexto de 24h+
  esfriou. NÃO persiste `estadoAnterior`.
- **Respeitar horário comercial 08-18h** — `calcularRetornarEm` posterga
  pra 08:00 quando cair fora; cron filtra a hora também antes de
  processar retornos vencidos.
- **Sábado/domingo aceitos** — filtro 08-18h cobre hora do dia, não dia
  da semana. Decisão explícita do Luciano.
- **Sinônimos: NÃO incluir "DEPOIS" sozinho** — evita falso positivo
  dentro de fluxos.
- **Reuso do `WhatsappConversaJob`** — sem criar arquivo novo nem tabela.
  Resolve a contradição da frase do M19.

## Próximo passo

**Bloco 7 do Sprint Bot Autoatendimento — NPS no fluxo (~2-3h).**

Ordem definida pelo Luciano: 1.b → 7 → 6. Bloco 7 é o mais leve (~2-3h),
modelo `nps_recebido` já existe no banco (Bloco 2, commit `1097f72`).
Escopo: ativar etapa `NPS_AGUARDANDO_NOTA` + gatilhos "0".."10" → estado
`NPS_RECEBIDO` (etapa nova) + persistir nota. Verificar se existe model
NPS no schema; se não, pode usar `Notificacao` genérica ou criar model
simples.

Restantes do sprint após Bloco 7 (~10-19h):
- 🟡 Bloco 6 — Cadastro Proxy (~6-8h, 4 modelos prontos no Bloco 2)
- 🟡 Bloco 5 — Atualizar Contrato (~4-6h, **decisão produto pendente:**
  ação automática vs solicitação humana)
- 🟡 Bloco 8 — Menu Fatura / Menu Inadimplente (~4-6h, **decisão produto
  pendente:** dinâmico vs hardcoded)

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` (estado atualizado + FRASE DE RETOMADA)
- `docs/sessoes/2026-05-22-bloco1b-me-chame-depois.md` (esta sessão)
- `docs/sessoes/2026-05-22-bloco4-atualizar-cadastro.md` (M19 — padrão
  Bloco 4 referência pra ações de 2 turnos)
- Memória `sprint_bot_autoatendimento_20_05.md` (escopo Bloco 7)
- Investigar antes da Fase 2:
  - Existe model `Nps` ou similar no `schema.prisma`? Se não, definir
    estrutura mínima (ex: tabela `WhatsappNps { id, cooperadoId, nota,
    cooperativaId, createdAt }`) OU usar `Notificacao` genérica.
  - Estado `NPS_AGUARDANDO_NOTA` já existe como `FluxoEtapa` no banco?
    (Bloco 2 inseriu modelo `nps_recebido` em 21/05 commit `1097f72` mas
    a etapa-pai precisa estar ativa).

## Carry-overs (não-bloqueantes)

**Decisões produto pendentes pro Luciano (M17/M18/M19/M20):**
- Desativar 1 das 2 etapas globais ATIVAS duplicadas no INICIAL
- Atualizar Contrato (Bloco 5): ação automática vs solicitação humana
- Menu Fatura / Menu Inadimplente (Bloco 8): dinâmico vs hardcoded
- `{{distribuidora}}` vazia em `AGUARDANDO_DISPOSITIVO_EMAIL`
- Horário hardcoded em `aguardando_atendente`
- Variáveis-fantasma na UI ModalMensagem (~30min UX admin)
- 4 falhas pré-existentes na suíte Jest (cooperados/usinas controllers) —
  investigar em sprint separado (provavelmente fixtures TestingModule
  desatualizadas)

**Fila operacional pós-Sprint Bot Autoatendimento:**
- M15 Sprint 5a Neutro Fio B (3-5 dias)
- Cadastrar usina cooperebr2 (depende M15)
- Onboarding Sinergia (depende M15 + Sprint 6 IDOR + D-novo-Q)

**Débitos catalogados:**
- D-novo-Q Contatos Teste persistentes (6-8h Code)
- D-novo-U fix handler hardcoded ver fatura (1-2h, Sprint Housekeeping)
- D-novo-V engine de template `{{#if}}/{{#unless}}` (~8-12h)
- Sprint Housekeeping (~3-5h)
- HTML jornada Sugestão #6
- D-novo-H refator técnico (~6-8h)
- Iniciativa Fluxos Customizáveis D-novo-T (~100-200h+)
- Sugestão #9 Monitoramento de Proteção (Relé) Opção A — feature futura,
  aguarda vistoria de campo + arquitetura documentada

## Regras aplicadas na sessão

- ✅ **TDD em cada etapa** — specs novos primeiro (red), implementação
  depois (green), commit. Aplicado nas Etapas A (23 specs) e B (13 specs).
- ✅ **Decisão 23** — Fase 1 read-only fechada antes de Fase 2; 3 decisões
  produto travadas no prompt antes da execução. Investigação resolveu a
  contradição da frase do M19 ("exige job" vs "reusa job") com evidência
  (grep dos jobs + schema).
- ✅ **Multi-tenant** — cron varre cross-tenant por natureza (escopo
  global). Cada envio é pra `telefone` específico da conversa. Não
  vaza tenant.
- ✅ **Reuse** — extendeu `WhatsappConversaJob` existente sem criar arquivo
  novo. Reusou `WhatsappSenderService` (camadas de proteção
  `isAmbienteReal()` preservadas — não burla com NODE_ENV).
- ✅ **Padrão Bloco 1.a** — sinônimos por palavra exata isolada, helpers
  privados (`detectar`/`resolver`/`executar`), branch `CHAMAR_DEPOIS`
  segue padrão do SAIR (estado quase-terminal + msg curta).
- ✅ **Ritual PM2** (CLAUDE.md): pm2 stop → build → restart. Backend
  voltou limpo (0 restarts).
- ✅ **Commits pequenos e em português** — 2 commits de trabalho + 1
  fechamento. Mensagens com escopo claro.
- ✅ **NUNCA force push, sem --no-verify** — push normal ao final.
- ✅ **Contatos teste** — não disparou comunicação real (só specs com
  mocks). Regra inegociável preservada.
- ✅ **NÃO trabalhar paralelo com claude.ai** — sessão Code 100% direto.
- ✅ **git status --short ANTES de cada commit** — confirmado.
- ✅ **Decisão 14** — grep amplo na Fase 1 confirmou que `AGENDADO_RETORNO`
  era estado livre (não existia antes).
- ✅ **Decisão 24** — frase de retomada em local único no
  `CONTROLE-EXECUCAO.md`.

## Frase comandante

Frase canônica única em `docs/CONTROLE-EXECUCAO.md` seção
`## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único,
atualizada 22/05 noite fechamento M20 Bloco 1.b).
