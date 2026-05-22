# Sessão 2026-05-22 — Sprint Bot Autoatendimento / Bloco 4: Atualizar Cadastro (Nome / Email / CEP)

## TL;DR

Bloco 4 do Sprint Bot Autoatendimento WhatsApp ENTREGUE em 5 etapas
sequenciais. A opção "3 Atualizar meu cadastro" do MENU_COOPERADO agora
funciona pelo motor dinâmico para 3 campos: **Nome, Email, Endereço (CEP)**.
Telefone foi REMOVIDO do bot (decisão Luciano por risco operacional —
trocar pelo próprio WhatsApp quebra a próxima sessão do bot e desvia
notificações). A entrega exigiu uma mudança arquitetural fundacional: o
motor passou a processar `Gatilho.acao` (era ignorado desde 20/05) e
`executarAcao()` ganhou 4º parâmetro `corpo` com o texto digitado pelo
cooperado — destrava todos os Blocos 5-8 do sprint (também fluxos de 2
turnos). ViaCEP foi centralizado num CepService backend novo com
degradação graciosa (timeout 3s, fallback salva só o CEP digitado se
ViaCEP fora do ar). Email duplicado (P2002) entra em RETRY no fluxo com
sugestão `+CoopereBR@gmail.com`, ao invés de cancelar. 39 specs novos
verdes (era 109, agora 135 motor + 13 CepService = 148 totais). Script
idempotente aplicado no banco DEV: 3 etapas globais novas criadas
(AGUARDANDO_NOVO_NOME / EMAIL / CEP) + gatilhos do ATUALIZACAO_CADASTRO
realinhados (sem telefone). PM2 restart limpo (pid 37104, 0 restarts).
Sem regressão na suíte (4 falhas pré-existentes em cooperados/usinas
controllers — confirmadas via `git stash`, NÃO causadas pelo Bloco 4).

## Marco entregue

**M19 — Sprint Bot Autoatendimento WhatsApp: Bloco 4 (Atualizar Cadastro) +
mudança arquitetural Gatilho.acao + CepService**

## Commits do dia (6)

| Hash | Mensagem |
|---|---|
| `9a32424` | feat(wa): Bloco 4 Etapa A — motor processa Gatilho.acao + passa corpo no executarAcao |
| `76232e4` | feat(cep): Bloco 4 Etapa B — servico backend ViaCEP com degradacao graciosa |
| `c1dcc8c` | feat(wa): Bloco 4 Etapa C — 3 acoes ATUALIZAR_*_COOPERADO no motor dinamico |
| `4ef82b7` | feat(wa): Bloco 4 Etapa D — telefone removido do menu Atualizar Cadastro |
| `780082d` | feat(wa): Bloco 4 Etapa E — script idempotente cria etapas AGUARDANDO_NOVO_* |
| (a seguir) | docs(sessao): fechamento M19 — Bloco 4 Sprint Bot Autoatendimento |

## Entregas técnicas

### Etapa A — Mudança arquitetural fundacional (commit `9a32424`)

**`whatsapp-fluxo-motor.service.ts`:**

- `Gatilho` interface ganha campo opcional `acao?: string | null`.
- Novo método público `avaliarGatilhoMatch(corpo, gatilhos): Gatilho | null`
  retorna o gatilho match completo (com `acao` resolvida pra null quando
  ausente). `avaliarGatilhos` original refatorado pra reusar
  `avaliarGatilhoMatch` (preserva API pública + testes legacy).
- `executarAcao()` ganha 4º parâmetro `corpo: string` (texto digitado pelo
  cooperado). Ações de Bloco 3 (CONSULTAR_*) ignoram, assinatura compatível.
- `processarComFluxoDinamico`: quando gatilho.acao definido, motor **DELEGA
  controle TOTAL** pra ação — NÃO transiciona estado, NÃO renderiza modelo
  destino, NÃO dispara `acaoAutomatica`. Ação cuida de
  validar/atualizar/responder/transicionar. Comportamento atual preservado
  quando gatilho sem `acao`.
- `executarComandoUniversalReal` atualizado pra passar `corpo: ''` (palavra
  reservada não tem texto livre).

**Justificativa:** decisão de 20/05 (memória
`sprint_bot_autoatendimento_20_05.md`) foi NÃO processar `Gatilho.acao`. Bloco
4 exige porque é fluxo de 2 turnos (cooperado entra na etapa → bot pergunta →
cooperado responde texto → ação precisa do texto pra atualizar entidade).
Decisão revisada e justificada — destrava Blocos 5-8 também (mesma estrutura).

**Specs (9 novos):** `avaliarGatilhoMatch` (5 cenários), `processarComFluxoDinamico`
processa Gatilho.acao (3 cenários), executarAcao aceita corpo (1).

### Etapa B — CepService backend (commit `76232e4`)

**Novo módulo `backend/src/common/cep/`:**

- `cep.service.ts` — `consultar(cep: string): Promise<CepResultado>` retorna
  tagged union: `ENCONTRADO` (com `endereco` populado), `CEP_INVALIDO`
  (sem 8 dígitos — não chama ViaCEP), `NAO_ENCONTRADO` (ViaCEP devolveu
  `{erro: true}`), `FORA_DO_AR` (timeout 3s via AbortController, erro de
  rede, status code não-OK, JSON inválido).
- `cep.module.ts` — NestJS module, importa `CepService` no `WhatsappModule`.
- 13 specs verdes cobrindo validação local, sucesso, não-encontrado, fora
  do ar (4 sub-cenários: erro de rede, 500, JSON inválido, AbortError).

**Justificativa:** frontend usava ViaCEP em 4 lugares via `fetch` direto.
Backend não tinha integração. Centralizar permite bot + admin + portal
reusarem o mesmo service com mesma lógica de timeout/fallback.

### Etapa C — 3 ações no motor dinâmico (commit `c1dcc8c`)

**`whatsapp-fluxo-motor.service.ts`** — switch `executarAcao` ganha 3 cases:

- `ATUALIZAR_NOME_COOPERADO` → `executarAtualizarNomeCooperado`
- `ATUALIZAR_EMAIL_COOPERADO` → `executarAtualizarEmailCooperado`
- `ATUALIZAR_CEP_COOPERADO` → `executarAtualizarCepCooperado`

`CepService` injetado no constructor (4º parâmetro do `WhatsappFluxoMotorService`).

**Padrão dos 3 métodos privados (espelham hardcoded com defense in depth):**

1. **Guard `cooperadoId`** — se ausente, envia mensagem amigável de cadastro
   e retorna (não consulta nem atualiza).
2. **Validar input** — espelha validações do hardcoded:
   - Nome: `trim`, `length >= 3`
   - Email: `trim + toLowerCase`, regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
   - CEP: delega validação pra `CepService.consultar()`
3. **Multi-tenant via `updateMany`** — `where: { id, cooperativaId? }`
   defense in depth em 1 query. Se `count === 0`, cooperado não pertence ao
   tenant → erro genérico (cross-tenant bloqueado).
4. **Mensagens de confirmação hardcoded** (decisão d1 — consistente com
   D-novo-V já catalogado).
5. **Transição de estado pela ação** — sucesso transiciona pra
   `MENU_COOPERADO`; erro de validação NÃO transiciona (retry no fluxo, o
   cooperado tenta outra resposta).

**Especificidades de cada ação:**

- **NOME** — validação simples (length >= 3). Erro genérico Prisma → não
  transiciona.

- **EMAIL** — captura `P2002` (unique violation global) explicitamente. Envia
  mensagem amigável "Esse email já está em uso por outro cadastro. Tente
  outro endereço, ou use o padrão `seunome+CoopereBR@gmail.com` (o Gmail
  entrega na mesma caixa). Digite outro email:" e **mantém no
  AGUARDANDO_NOVO_EMAIL** pra retry (decisão Luciano 22/05).

- **CEP** — delega validação pro `CepService`. 4 caminhos:
  - `CEP_INVALIDO` → mensagem + retry no AGUARDANDO_NOVO_CEP.
  - `NAO_ENCONTRADO` → mensagem + retry.
  - `ENCONTRADO` → autopopula `cep + logradouro + bairro + cidade + estado`.
    `numero` / `complemento` NÃO mexem (preserva o que já tinha). Trata CEPs
    de cidade (logradouro/bairro vazios) montando mensagem só com
    `cidade-UF`.
  - `FORA_DO_AR` → degradação graciosa: salva só o CEP digitado normalizado,
    preserva logradouro/bairro/cidade/estado anteriores, mensagem
    explicando, transiciona pra `MENU_COOPERADO`. Não trava o cooperado
    (decisão Luciano).

**Specs (17 novos):** 5 NOME + 5 EMAIL + 7 CEP.

### Etapa D — Telefone removido (commit `4ef82b7`)

**Decisão Luciano 22/05:** trocar telefone pelo próprio WhatsApp tem risco
operacional real — quebra a próxima sessão do bot (match `Cooperado.telefone
== conversa.telefone` falha) e desvia notificações automáticas pro número
novo enquanto o cooperado continua usando o WhatsApp atual. Operação
consciente fica no portal web ou com a equipe.

**Seed (`prisma/seeds/seed-fluxos-bot.mjs`):**
- ATUALIZACAO_CADASTRO: gatilho `'3' → AGUARDANDO_NOVO_TELEFONE` removido.
- Gatilho `'4' → AGUARDANDO_NOVO_CEP` renumerado pra `'3'`.

**Bot hardcoded (`whatsapp-bot.service.ts`):**
- Lista `ESTADOS_FLUXO_ATIVO`: `AGUARDANDO_NOVO_TELEFONE` removido.
- Switch principal: `case AGUARDANDO_NOVO_TELEFONE` removido.
- `enviarMenuComBotoes`: 3 opções (sem telefone) + linha "Para trocar
  telefone, fale com nossa equipe." no corpo da mensagem.
- `handleAtualizacaoCadastro`: bloco da opção `'3'` agora detecta palavra
  "telefone" e orienta a falar com equipe, mantendo no menu. Bloco `'4 CEP'`
  renumerado pra `'3 CEP'`.
- `handleAguardandoNovoTelefone`: handler DELETADO. Comentário marca a
  remoção pra rastreabilidade.

### Etapa E — Script idempotente + PM2 (commit `780082d`)

**`backend/scripts/fix-bloco-4-atualizar-cadastro.ts`** (padrão Bloco 3):

1. **Read-only check** — confirma os 3 modelos `aguardando_novo_nome`,
   `_email`, `_cep` existem no banco (Bloco 2, commit `1097f72`).
2. **INSERT 3 etapas globais** novas (ordens 52-54):
   - `AGUARDANDO_NOVO_NOME` — modeloId apontando pro `aguardando_novo_nome`,
     gatilho `*` → `MENU_COOPERADO` + `acao: ATUALIZAR_NOME_COOPERADO`.
   - `AGUARDANDO_NOVO_EMAIL` — idem com `ATUALIZAR_EMAIL_COOPERADO`.
   - `AGUARDANDO_NOVO_CEP` — idem com `ATUALIZAR_CEP_COOPERADO`.
   - `acaoAutomatica: null` — quem dispara é Gatilho.acao via Etapa A.
3. **REPOINT gatilhos do ATUALIZACAO_CADASTRO** (sem telefone):
   `'1' → AGUARDANDO_NOVO_NOME`, `'2' → AGUARDANDO_NOVO_EMAIL`,
   `'3' → AGUARDANDO_NOVO_CEP` (era CEP em '4' antes, agora em '3'
   — gatilho `'4'` antigo deletado).

**Idempotência confirmada** — 2ª execução skip total.

**Ritual PM2 aplicado:** `pm2 stop cooperebr-backend` → `npm run build`
(limpo) → `npx ts-node scripts/fix-bloco-4-atualizar-cadastro.ts` →
`pm2 restart cooperebr-backend` → online pid 37104, 0 restarts. Logs
confirmam `Nest application successfully started + Backend rodando na porta 3000`.

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| Opção "3 Atualizar cadastro" no MENU_COOPERADO transicionava pra estado sem etapa dinâmica ativa | UX produção | `AGUARDANDO_NOVO_*` não existiam no banco como FluxoEtapa | 3 etapas globais novas via script + ações ATUALIZAR_*_COOPERADO no motor | ✅ RESOLVIDO (`c1dcc8c`, `780082d`) |
| Telefone editável pelo bot — risco operacional | P0 latente | Hardcoded permitia trocar `Cooperado.telefone` sem confirmação, quebrando próxima sessão + desviando notificações | Opção removida do menu, handler deletado, mensagem orienta a falar com equipe | ✅ RESOLVIDO (`4ef82b7`) |
| Email duplicado quebrava UX (P2002 genérico) | P2 latente | Hardcoded chamava `prisma.cooperado.update` sem try/catch → P2002 caía no catch genérico do `processarMensagem` com mensagem técnica | Captura `P2002` no motor + mensagem amigável com sugestão `+CoopereBR@gmail.com` + retry no estado AGUARDANDO_NOVO_EMAIL | ✅ RESOLVIDO (`c1dcc8c`) |
| ViaCEP só no frontend (4 lugares duplicados) | refator | Backend sem integração de CEP — bot hardcoded salvava só o número | `CepService` backend centralizado com degradação graciosa | ✅ RESOLVIDO (`76232e4`) |
| Hardcoded sem defense in depth multi-tenant em `prisma.cooperado.update` | hardening | `update` filtrava só por `id` — defense in depth ausente | Motor usa `updateMany` com `{id, cooperativaId?}` — bloqueia cross-tenant | ✅ RESOLVIDO (`c1dcc8c`) |

## Decisões estratégicas catalogadas

Nenhuma memória persistente nova criada nesta sessão. Decisões de produto
aplicadas vieram do prompt do Luciano (Fase 2 Bloco 4) e ficam registradas
neste doc-sessão:

- **Mudança arquitetural Gatilho.acao + corpo no executarAcao** — fundacional
  pros Blocos 4-8. Retoma capacidade adiada em 20/05.
- **Email duplicado** — retry no fluxo com sugestão `+CoopereBR@gmail.com`
  (decisão a1 do relatório Fase 1).
- **CEP/ViaCEP** — backend com degradação graciosa (decisão b2).
- **Telefone** — REMOVIDO do bot (decisão c1 — risco operacional confirmado).
- **Mensagens de confirmação** — hardcoded na ação (decisão d1, consistente
  com D-novo-V).
- **Placeholders do Bloco 5** — deixar como estão (warn default do switch
  cobre).

## Próximo passo

**Próximo bloco do Sprint Bot Autoatendimento — a definir com Luciano:**

Restantes do sprint (~13-25h):
- 🟡 Bloco 1.b — ME CHAME DEPOIS (~3-5h, exige job de reagendamento)
- 🟡 Bloco 5 — Atualizar Contrato (~4-6h, **decisão produto pendente**:
  ação automática vs solicitação humana)
- 🟡 Bloco 6 — Cadastro Proxy (~6-8h, modelos do Bloco 2 prontos)
- 🟡 Bloco 7 — NPS no fluxo (~2-3h, modelo pronto)
- 🟡 Bloco 8 — Menu Fatura/Inadimplente (~4-6h, **decisão produto pendente**:
  dinâmico vs hardcoded)

**Recomendação:** Bloco 5 (sequência natural — segue numérica). Mas exige
decisão produto antes (ação automática vs solicitação humana). Alternativa
mais leve: Bloco 7 (NPS, ~2-3h) ou Bloco 1.b (ME CHAME DEPOIS, ~3-5h).

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` (estado atualizado + FRASE DE RETOMADA)
- `docs/sessoes/2026-05-22-bloco4-atualizar-cadastro.md` (esta sessão)
- `docs/PLANO-ATE-PRODUCAO.md` Seção 3b (status Sprint Bot Autoatendimento)
- Memória `sprint_bot_autoatendimento_20_05.md` (escopo de cada bloco)
- Padrão de implementação Bloco 4: `whatsapp-fluxo-motor.service.ts`
  cases `ATUALIZAR_*_COOPERADO` (linhas ~358-380) + métodos privados
  `executarAtualizar*Cooperado` (linhas ~760-1000) — usar como referência
  pros próximos blocos com fluxo de 2 turnos.

## Carry-overs (não-bloqueantes)

**Decisões produto pendentes pro Luciano (M17/M18/M19):**
- Desativar 1 das 2 etapas globais ATIVAS duplicadas no INICIAL
- Atualizar Contrato (Bloco 5): ação automática vs solicitação + humano
- Menu Fatura / Menu Inadimplente (Bloco 8): dinâmico vs hardcoded
- `{{distribuidora}}` vazia em AGUARDANDO_DISPOSITIVO_EMAIL
- Horário hardcoded em `aguardando_atendente`
- Variáveis-fantasma na UI ModalMensagem (~30min UX admin)

**Fila operacional pós-Sprint Bot Autoatendimento:**
- M15 Sprint 5a Neutro Fio B (3-5 dias)
- Cadastrar usina cooperebr2 (depende M15)
- Onboarding Sinergia (depende M15 + Sprint 6 IDOR + D-novo-Q Contatos Teste)

**Débitos catalogados:**
- D-novo-Q Contatos Teste persistentes (6-8h Code)
- D-novo-U fix handler hardcoded ver fatura (1-2h, Sprint Housekeeping)
- D-novo-V engine de template `{{#if}}/{{#unless}}` (~8-12h, sub-tarefa D-novo-T)
- Sprint Housekeeping (~3-5h — incluindo stash reformat 18/05 + scripts órfãos)
- HTML jornada Sugestão #6
- D-novo-H refator técnico ~6-8h
- Iniciativa Fluxos Customizáveis D-novo-T (~100-200h+)
- Sugestão #9 — Monitoramento de Proteção (Relé) Opção A (catalogada 22/05)

**Pré-existentes na suíte Jest** (NÃO causados por esta sessão, confirmado
via `git stash`):
- 4 test suites falhando: `cooperados/cooperados.controller.spec.ts`,
  `cooperados/cooperados.service.spec.ts`,
  `cooperados/cooperados.service.guard-ativacao.spec.ts`,
  `usinas/usinas.controller.spec.ts`. Provavelmente fixtures de
  `TestingModule` desatualizadas (DI). Investigar em sprint separado.

## Regras aplicadas na sessão

- ✅ **TDD em cada etapa** — specs novos primeiro (red), implementação
  depois (green), commit. Aplicado nas Etapas A (9 specs) e C (17 specs).
- ✅ **Decisão 23** — Fase 1 read-only (sessão anterior) aprovada antes de
  qualquer escrita. Decisões produto travadas no prompt.
- ✅ **Multi-tenant defense in depth** — todas as 3 ações novas usam
  `updateMany` com `{id, cooperativaId?}` no where.
- ✅ **Reuse de validações** — Nome (length 3) e Email (regex) espelham
  hardcoded `whatsapp-bot.service.ts:3793-3852`. CEP delega pra
  `CepService` central.
- ✅ **Padrão Bloco 3** — assinatura `(conversa, corpo)`, guard cooperadoId,
  leitura de cooperativaId opcional, logger detalhado com tenant.
- ✅ **Ritual PM2** (CLAUDE.md): pm2 stop → build → script ts-node →
  pm2 restart. Backend voltou limpo (0 restarts).
- ✅ **Commits pequenos e em português** — 5 commits de trabalho + 1 commit
  de fechamento, mensagens descritivas com escopo claro.
- ✅ **NUNCA force push, sem --no-verify** — push normal ao final.
- ✅ **Contatos teste** — não disparou comunicação real nesta sessão (só
  banco DEV + specs). Regra inegociável preservada.
- ✅ **NÃO trabalhar paralelo com claude.ai** — sessão Code 100% direto.
- ✅ **git status --short ANTES de cada commit** — confirmado em todas
  as 5 etapas.
- ✅ **Decisão 14** — grep amplo confirmou que tema "monitoramento de
  proteção" estava livre no fechamento da sessão anterior (não diretamente
  aplicado nesta).
- ✅ **Decisão 24** — frase de retomada em local único no
  `CONTROLE-EXECUCAO.md`.

## Frase comandante

Frase canônica única em `docs/CONTROLE-EXECUCAO.md` seção
`## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único,
atualizada 22/05 fechamento M19 Bloco 4).
