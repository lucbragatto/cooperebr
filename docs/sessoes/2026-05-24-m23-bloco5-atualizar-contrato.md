# M23 — Bloco 5 Sprint Bot Autoatendimento: Atualizar Contrato — 24/05/2026

## TL;DR

Sessão Code maratona entregou o **Bloco 5 — Atualizar Contrato** completo (7 etapas A→G em ~6h reais). Cooperado agora pode pedir AUMENTAR/DIMINUIR kWh, SUSPENDER ou ENCERRAR contrato direto pelo WhatsApp **sem** que o bot toque no contrato — toda alteração vira `SolicitacaoAlteracaoContrato` PENDENTE que equipe valida via painel admin novo `/dashboard/super-admin/solicitacoes`. Aprovar aplica imediato no contrato + dispara WhatsApp ao cooperado. **6 commits empacotados** (a26500b schema → c3a764e KWH+SUSP+ENC ações → cb2b80a script idempotente → 2bd38fb módulo REST → 3646d6d tela admin → b8b8025 débito D-novo-AB) + commit fechamento. **221 specs verdes** no motor (era 210 — +11 SUSPENDER/ENCERRAR sobre os 12 do KWH = 23 novos sobre o baseline 198 do M22). Backend + frontend buildam clean. 1 débito catalogado D-novo-AB (handler hardcoded antigo viola decisão B — limpeza pós-validação em produção).

## Marco entregue

**M23 — Bloco 5 do Sprint Bot Autoatendimento: Atualizar Contrato (kWh + Suspender + Encerrar)**

## Commits do dia (7)

| Hash | Mensagem |
|---|---|
| `a26500b` | feat(schema): Bloco 5 Etapa A — SolicitacaoAlteracaoContrato + 2 enums |
| `5cefe03` | feat(wa): Bloco 5 Etapa B1 — acoes KWH do fluxo Atualizar Contrato no motor |
| `c3a764e` | feat(wa): Bloco 5 Etapa B2 — acoes SUSPENDER+ENCERRAR do fluxo Atualizar Contrato |
| `cb2b80a` | feat(wa): Bloco 5 Etapa C — script idempotente + seed alinhado ATUALIZACAO_CONTRATO |
| `2bd38fb` | feat(wa): Bloco 5 Etapa D — modulo SolicitacoesContrato (REST: list/aprovar/recusar) |
| `3646d6d` | feat(web): Bloco 5 Etapa E — tela admin /dashboard/super-admin/solicitacoes |
| `b8b8025` | docs(debitos): cataloga D-novo-AB — handler hardcoded handleAtualizacaoContrato viola decisao (B) do Bloco 5 |

## Entregas técnicas

### Etapa A — Schema (a26500b)

`SolicitacaoAlteracaoContrato` model novo:
- `id`, `cooperadoId`, `cooperativaId`, `contratoId` (com relations)
- `tipoAlteracao` (enum `TipoAlteracaoContrato`: AUMENTAR_KWH/DIMINUIR_KWH/SUSPENDER/ENCERRAR)
- `valorPropostoKwh: Int?` (só faz sentido em alterações de kWh)
- `motivo: String?` (opcional em ENCERRAR, obrigatório em SUSPENDER)
- `status` (enum `StatusSolicitacaoContrato`: PENDENTE/APROVADA/APLICADA/RECUSADA/CANCELADA) — `APROVADA` reservada para fluxo 2-fases futuro, hoje usa-se direto APLICADA (decisão 3)
- `createdAt`, `processadaEm`, `processadaPorId` (auditoria), `observacoesEquipe`, `aplicadaEm`
- 2 índices: `(cooperativaId, status)` + `(cooperadoId)`
- Back-links em `Cooperativa`, `Cooperado`, `Contrato`

### Etapa B — Motor: 4 ações novas (5cefe03 + c3a764e)

**B1 — KWH (5cefe03):**
- `INICIAR_SOLICITACAO_AUMENTAR_KWH` / `INICIAR_SOLICITACAO_DIMINUIR_KWH` (helper `executarIniciarSolicitacaoKwh`): busca contrato ATIVO multi-tenant + persiste dadosTemp + transiciona AGUARDANDO_NOVO_KWH + envia "Seu contrato atual: X kWh/mês. Digite o novo valor (maior/menor que X):"
- `SALVAR_SOLICITACAO_KWH`: valida parseInt + AUMENTAR>kwhAtual / DIMINUIR<kwhAtual + **pré-valida capacidade da usina** (só AUMENTAR) via `usina.findUnique` + `contrato.aggregate({_sum: kwhContratoMensal})` WHERE usinaId+ATIVO + cria `SolicitacaoAlteracaoContrato` + `NotificacoesService.criar` + WA cooperado com modelo `solicitacao_contrato_criada` + transiciona MENU_COOPERADO
- 12 specs novos

**B2 — SUSPENDER+ENCERRAR (c3a764e):**
- `INICIAR_SOLICITACAO_SUSPENDER` / `INICIAR_SOLICITACAO_ENCERRAR` (helper `executarIniciarSolicitacaoBloqueante`): busca contrato + **pré-valida cobrança em aberto** via `cobranca.count({contrato: {cooperadoId}, status: {in: ['A_VENCER', 'VENCIDO']}})` — se > 0, recusa com "Voce tem N faturas em aberto. Quitar antes" e volta MENU + persiste dadosTemp + transiciona `AGUARDANDO_MOTIVO_SUSPENSAO` ou `CONFIRMAR_ENCERRAMENTO`
- `SALVAR_SOLICITACAO_SUSPENDER`: motivo = corpo.trim() || null (decisão 2 — motivo opcional na prática)
- `SALVAR_SOLICITACAO_ENCERRAR`: "PULAR" (case insensitive) → motivo null (decisão 5)
- Ambos compartilham helper `executarSalvarSolicitacaoBloqueante`: cria solicitação + notifica equipe + WA cooperado + MENU
- 11 specs novos

Multi-tenant defense in depth em todas as 5 acoes: cooperativaId no findFirst do contrato + no count de cobranças + no create da solicitação + no notificacoes.criar.

### Etapa C — Script idempotente + seed (cb2b80a)

`backend/scripts/fix-bloco-5-atualizar-contrato-no-fluxo.ts` em 3 partes:
1. **3 modelos GLOBAIS novos** (categoria BOT, cooperativaId=null): `solicitacao_contrato_criada` (vars: tipo) / `solicitacao_contrato_aprovada` (vars: tipo, detalhes) / `solicitacao_contrato_recusada` (vars: tipo, motivo)
2. **Gatilhos do ATUALIZACAO_CONTRATO** repointados pras 4 novas ações INICIAR_*
3. **3 etapas intermediárias novas**: AGUARDANDO_NOVO_KWH (ordem 55) + AGUARDANDO_MOTIVO_SUSPENSAO (56) + CONFIRMAR_ENCERRAMENTO (57), todas com wildcard `*` + ação SALVAR_*

Idempotência: 1ª execução cria tudo; 2ª execução SKIP em tudo. Seed `prisma/seeds/seed-fluxos-bot.mjs` alinhado pra instalações do zero virem com a estrutura nova.

Modelos antigos no enum `acaoBot` (SOLICITAR_AUMENTO_KWH/SUSPENDER_CONTRATO/etc) ficaram órfãos no código mas inalcançáveis no runtime — D-novo-AB cataloga a remoção pós-produção.

### Etapa D — Módulo REST SolicitacoesContrato (2bd38fb)

Novo módulo `backend/src/solicitacoes-contrato/`:
- **Controller** com 3 endpoints gated SUPER_ADMIN/ADMIN/OPERADOR + `@AuditLog`:
  - `GET /solicitacoes-contrato?status=PENDENTE` — lista filtrada + multi-tenant + include cooperado/contrato
  - `POST /solicitacoes-contrato/:id/aprovar` — aprovar=APLICAR imediato (decisão 3)
  - `POST /solicitacoes-contrato/:id/recusar` — body `{ observacoesEquipe }` obrigatório (DTO class-validator min 3 chars)
- **Service** com lógica de aprovação por tipo:
  - AUMENTAR/DIMINUIR_KWH → `contratosService.update({ kwhContrato: valorPropostoKwh })` (reusa toda regra de validação capacidade usina + race condition SERIALIZABLE + recalculo percentualUsina)
  - SUSPENDER → `contratosService.update({ status: 'SUSPENSO' })`
  - ENCERRAR → `contratosService.update({ status: 'ENCERRADO' })`
  - Atualiza solicitação: status APLICADA + processadaEm + processadaPorId + aplicadaEm
  - Notifica cooperado com modelo `solicitacao_contrato_aprovada` (vars tipo + detalhes) + fallback hardcoded
- Recusar: status RECUSADA + processadaEm + processadaPorId + observacoesEquipe + WA cooperado com modelo `solicitacao_contrato_recusada` (vars tipo + motivo)
- DTO `RecusarSolicitacaoDto` com `@MinLength(3)` (evita recusa silenciosa)
- Backend reiniciado: `SolicitacoesContratoController` 3 rotas mapeadas no NestApplication.

### Etapa E — Tela admin frontend (3646d6d)

`web/app/dashboard/super-admin/solicitacoes/page.tsx`:
- Header com contador pendentes em badge amarelo
- Banner azul explicando "bot nunca altera direto"
- Filtros por status (PENDENTE/APLICADA/RECUSADA/TODOS)
- Cards por solicitação com tipo (cor por categoria) + cooperado + telefone + contrato atual → valor proposto + motivo + observações
- **Aprovar**: window.confirm explícito + POST aprovar
- **Recusar**: Dialog Shadcn com Textarea + validação min 3 chars + POST recusar
- Sidebar `web/app/dashboard/layout.tsx` ganha 3º link em "Gestão Global" (ícone ClipboardList)

### Etapa F — Débito catalogado (b8b8025)

**D-novo-AB** P2 — handler hardcoded `handleAtualizacaoContrato` em `whatsapp-bot.service.ts` ainda existe mas é inalcançável (motor dinâmico tem precedência via gatilho `acao` + etapa ATIVA + GLOBAL). Risco: regressão se etapa for desativada. Fix ~30min pós-produção 1-2 sprints.

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| Bot altera contrato direto sem aprovação humana | Risco arquitetural | Decisão produto antiga (modelo A automático) | Modelo B SolicitacaoAlteracaoContrato + painel admin (esta sessão completa) | ✅ RESOLVIDO |
| D-novo-AB | P2 limpeza | Handler hardcoded antigo não foi removido após motor dinâmico convertido | Remover ~30min após validação em produção 1-2 sprints | 📋 CATALOGADO |

## Decisões estratégicas catalogadas

5 sub-decisões Luciano locked no prompt Fase 2 do Bloco 5:

1. **Tela admin mínima** `/dashboard/super-admin/solicitacoes` — sem detalhes de capacidade usina, sem timeline, só o essencial pra decidir aprovar/recusar
2. **SUSPENDER INDEFINIDO** + motivo obrigatório (na prática motivo opcional via trim, vira null se vazio)
3. **APROVAR = APLICAR IMEDIATO** — sem fase intermediária APROVADA. Status `APROVADA` no enum fica reservada para um eventual fluxo 2-fases futuro
4. **Bot pré-valida capacidade da usina** (só AUMENTAR) + **cobrança em aberto** (SUSPENDER/ENCERRAR) — defense in depth contra solicitações que a equipe certamente recusaria
5. **ENCERRAR motivo opcional** ("PULAR" case insensitive → null) — não força justificativa em decisão definitiva

Nenhuma memória persistente nova catalogada — todas as decisões ficam no doc-sessão + commit messages.

## Próximo passo

**Próximo passo único: BLOCO 8 — Menu Fatura/Inadimplente.** Único bloco restante do Sprint Bot Autoatendimento.

Antes da Fase 1 read-only, decisão produto pendente pro Luciano:
- (A) PORTAR PRO MOTOR DINÂMICO: 2 etapas novas (MENU_FATURA, MENU_INADIMPLENTE) + N ações pra cada sub-opção. Modelos `menu_fatura` + `menu_inadimplente` já existem (Bloco 2 commit `1097f72`)
- (B) MANTER HARDCODED: handlers `handleMenuFatura`/`handleMenuInadimplente` provavelmente já existem (confirmar Fase 1). Menos trabalho, fora do padrão dinâmico

Recomendação: depende da complexidade do hardcoded existente. Se for simples (lista cobranças + link Asaas), porta. Se acopla parcelamento/negociação, mantém.

Estimativa: 4-6h Code (1 sessão se decisão B; 2 sessões se A).

Após Bloco 8, o **Sprint Bot Autoatendimento estará INTEIRAMENTE FECHADO** (todos os 7+1 blocos 1.a, 1.b, 3, 4, 5, 6, 7, 8 entregues).

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` — ONDE PARAMOS + FRASE DE RETOMADA (Decisão 24 local único)
- `docs/sessoes/2026-05-24-m23-bloco5-atualizar-contrato.md` — esta sessão
- `~/.claude/projects/C--Users-Luciano-cooperebr/memory/sprint_bot_autoatendimento_20_05.md` — sprint mãe
- `backend/src/whatsapp/whatsapp-fluxo-motor.service.ts` — padrão de ações Blocos 4/5/6/7
- `backend/src/whatsapp/whatsapp-bot.service.ts` — handlers hardcoded `handleMenuFatura` + `handleMenuInadimplente` (mapear Fase 1)
- `prisma/seeds/seed-fluxos-bot.mjs` — etapas MENU_FATURA + MENU_INADIMPLENTE
- `docs/debitos-tecnicos.md` — D-novo-AB catalogado nesta sessão

## Carry-overs (não-bloqueantes)

- D-novo-AB (P2) — remover hardcoded `handleAtualizacaoContrato` pós-produção
- Demais débitos D-novo-W..AA catalogados M21/M22 (Sprint Housekeeping)
- Decisão produto Bloco 8 (apresentar antes da Fase 1)
- Decisão disparo automático NPS (Sprint futuro)
- 11 falhas pré-existentes na suíte Jest (cooperados/usinas — idênticas M19..M22, 0 minhas)
- Desativar 1 das 2 etapas globais ATIVAS duplicadas no INICIAL
- `{{distribuidora}}` vazia em AGUARDANDO_DISPOSITIVO_EMAIL
- Horário hardcoded em `aguardando_atendente`
- Variáveis-fantasma na UI ModalMensagem

## Regras aplicadas na sessão

- ✅ Ritual de abertura: skill `retomada-sessao` invocada via /abertura
- ✅ Decisão 23 (Fase 1 read-only): aplicada antes da Etapa A (mapeamento estado motor + schema atual + hardcoded existente + débitos relacionados)
- ✅ Decisão 14 (validação prévia): grep amplo antes de criar D-novo-AB confirmou letra livre
- ✅ Multi-tenant defense in depth (`cooperativaId` em todas as queries Prisma)
- ✅ TDD (specs first em B1 e B2; red→implement→green verificado)
- ✅ Ritual PM2 (parar/rodar/restart) — script Etapa C executado sem conflito de processo
- ✅ Commits pequenos em português (7 separados em vez de 1 grande)
- ✅ Bot não toca contatos reais — neste bloco bot só cria solicitação, não envia nada externo ao próprio cooperado
- ✅ NEVER force push / NEVER --no-verify
- ✅ Fechamento canônico em curso (skill `fechamento-sessao`)

## Frase comandante

> Frase canônica única em `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único, atualizada 24/05 fechamento M23 Bloco 5).
