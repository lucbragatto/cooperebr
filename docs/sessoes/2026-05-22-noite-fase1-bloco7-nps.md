# Sessão 2026-05-22 noite (adendo M20.1) — Fase 1 read-only Bloco 7 (NPS)

## TL;DR

Adendo do mesmo dia após fechamento M20. Sessão curta de leitura: executei
Fase 1 read-only do Bloco 7 do Sprint Bot Autoatendimento (NPS no fluxo).
Investigação focada em 4 frentes: model de dados, etapa/modelo de mensagem,
gatilho/disparo, código pré-existente (Decisão 14 grep amplo). **Achado
central:** mais peças prontas do que esperávamos — model `NpsResposta` já
existe no schema (sem `cooperativaId`), modelos de mensagem `nps_recebido`
+ `nps_aguardando_nota` no banco, handler hardcoded `handleNpsNota`
funcional. Mas **nada cabea pra NPS_AGUARDANDO_NOTA hoje** — etapa
dinâmica é órfã (`gatilhos: []`) e `agendarNps()` é dead code (definido
mas sem caller). Relatório entregue em `docs/relatorios/` aguardando 5
decisões produto do Luciano antes da Fase 2. Aproveito o fechamento pra
commitar os 3 relatórios de Fase 1 do dia (Bloco 4 + Bloco 1.b + Bloco 7)
que estavam untracked.

## Marco entregue

**M20.1 — Adendo documental: Fase 1 read-only Bloco 7 (NPS) — relatório
aguardando 5 decisões produto**

Não é marco de implementação. Sessão de investigação + documentação.

## Commits do dia (M20.1: 1 fechamento — sem commits de código)

| Hash | Mensagem |
|---|---|
| (a seguir) | docs(sessao): fechamento M20.1 — Fase 1 Bloco 7 NPS + relatorios Fase 1 dia |

## Entregas técnicas

### Investigação Fase 1 Bloco 7 (NPS no fluxo)

Mapeamento por área:

**1. Model de dados NPS**
- ✅ `NpsResposta` JÁ EXISTE no `schema.prisma:1951-1960` — campos: id,
  cooperadoId opcional, telefone, nota Int, canal default 'WHATSAPP',
  createdAt.
- ❌ **Sem `cooperativaId`** (quebra regra dura multi-tenant).
- ❌ Sem `comentario` (só nota numérica).
- ❌ Sem `@relation` com Cooperado (cooperadoId é string solta).
- Sugestão: delta puramente aditivo `cooperativaId String?` + `comentario
  String?` opcional.

**2. Etapa e modelo de mensagem**
- ⚠️ Etapa `NPS_AGUARDANDO_NOTA` existe no `seed-fluxos-bot.mjs:111`
  (ordem 21) mas com `gatilhos: []` — órfã sem entrada nem saída no fluxo
  dinâmico.
- ✅ Modelo `nps_recebido` (agradecimento) existe (Bloco 2 commit
  `1097f72`). Conteúdo curto com variável `{{parceiro}}`.
- ✅ Modelo `nps_aguardando_nota` (pergunta) existe no banco (referência
  em `scripts/fix-r2-coopereb-para-parceiro.ts:12`) — fonte original não
  localizada nos seeds atuais.
- ⚠️ Modelo `nps_trimestral` (NPS 3 meses) órfão em
  `seed-fluxo-padrao.ts:138-144` — sem caller.
- ❌ Estado `NPS_RECEBIDO` NÃO existe — recomendação: NÃO criar (ir
  direto pra `MENU_COOPERADO`).

**3. Gatilho / onde NPS é disparado hoje**
- ❌ **Nada cabea pra NPS_AGUARDANDO_NOTA hoje.**
- ⚠️ `agendarNps()` em `whatsapp-bot.service.ts:3990-4011` é DEAD CODE
  (setTimeout 1h após CONCLUIDO; texto hardcoded "CoopereBR" não
  multi-tenant; frágil — perde estado em PM2 restart). Zero callers no
  backend.
- ✅ Handler hardcoded `handleNpsNota` (linhas 4013-4034) funcional: valida
  parseInt 0-10, persiste com cooperadoId opcional, agradece com texto
  hardcoded (NÃO usa modelo do banco), finaliza pra `CONCLUIDO`.

**4. Código NPS pré-existente** (Decisão 14 — grep amplo)
- ❌ Nenhum módulo NestJS dedicado a NPS (`backend/src/**/nps*.ts`
  retornou vazio).
- ❌ Sem service, controller, endpoint REST.
- `prisma.npsResposta.create` invocado direto no handler hardcoded.

### 5 decisões produto pendentes pro Luciano

1. **Quem dispara o NPS no Bloco 7?** — (a) só infra (recomendado) / (b)
   reativar `agendarNps` / (c) listener event-based / (d) cron trimestral /
   (e) comando manual via bot.
2. **`NpsResposta` ganha `cooperativaId`?** — SIM (recomendado) / NÃO.
3. **`NpsResposta` ganha `comentario` opcional?** — SIM agora
   (recomendado) / NÃO.
4. **Estado pós-NPS** — (X) MENU_COOPERADO (recomendado) / (Y) CONCLUIDO.
5. **Wildcard `*` vs 11 gatilhos 0..10?** — wildcard (recomendado por
   unanimidade dos critérios).

### Proposta de desenho do Bloco 7

Assumindo recomendações (1a + 2 SIM + 2.5 SIM + 3X + 5 wildcard):

- **Schema delta aditivo** via `npx prisma db push`: 2 campos opcionais.
- **Motor:** nova ação `REGISTRAR_NPS` (padrão Bloco 4) — valida 0-10,
  persiste, renderiza modelo `nps_recebido` do banco, transiciona pra
  `MENU_COOPERADO`. Retry inline se inválida.
- **Script idempotente:** UPDATE etapa `NPS_AGUARDANDO_NOTA` com
  `modeloMensagemId: nps_aguardando_nota` + 1 gatilho wildcard com
  `acao: REGISTRAR_NPS`.
- **Hardcoded preservado** como fallback (debt latente catalogado:
  divergência CONCLUIDO vs MENU_COOPERADO).
- **Specs TDD** ~10 cenários: nota válida/inválida, multi-tenant, modelo
  ausente, erro Prisma.

### Estimativa revisada

- **2-2.5h** se NÃO incluir `cooperativaId`/`comentario`.
- **3-3.5h** se aceitar todas recomendações (recomendado).
- Disparo (decisão 1) adiciona conforme opção: (a) +0h / (b) +1-1.5h /
  (c) +2-3h / (d) +2-3h / (e) +0.5h.

Detalhamento completo em `docs/relatorios/2026-05-22-fase1-bloco7-nps.md`.

### Aproveitamento: commit dos 3 relatórios de Fase 1 do dia

Untracked desde o início do dia. Catalogados neste fechamento:
- `docs/relatorios/2026-05-22-fase1-bloco4-atualizar-cadastro.md`
- `docs/relatorios/2026-05-22-fase1-bloco1b-me-chame-depois.md`
- `docs/relatorios/2026-05-22-fase1-bloco7-nps.md`

## Bugs resolvidos / catalogados

Nenhum — sessão read-only.

**Catalogações novas (não-bloqueantes, ficam no relatório):**
- `agendarNps()` em `whatsapp-bot.service.ts:3990-4011` é dead code com
  texto hardcoded não multi-tenant e mecanismo frágil (`setTimeout`
  perdido em PM2 restart). Sugestão: remover ou refatorar quando decidir
  disparo do NPS. Não bloqueia Bloco 7 (caminho dinâmico não usa).
- `nps_trimestral` modelo órfão em `seed-fluxo-padrao.ts:138-144` — sem
  caller. Pendente decisão se reaproveita (opção d cron trimestral) ou
  remove em Sprint Housekeeping.
- Divergência de comportamento hardcoded vs dinâmico Bloco 7:
  hardcoded transiciona pra CONCLUIDO, dinâmico (proposto) pra
  MENU_COOPERADO. Debt latente pra Sprint Housekeeping.

## Decisões estratégicas catalogadas

Nenhuma memória persistente nova criada nesta sessão. As decisões produto
ficam pendentes pro Luciano (não foram travadas — aguardando OK no
relatório).

## Próximo passo

**Bloco 7 Fase 2 (execução)** após Luciano bater martelo nas 5 decisões
produto.

Ordem do sprint (definida pelo Luciano): 1.b ✅ → 7 (próximo) → 6.

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` (estado + FRASE DE RETOMADA atualizada)
- `docs/sessoes/2026-05-22-noite-fase1-bloco7-nps.md` (este adendo)
- `docs/sessoes/2026-05-22-bloco1b-me-chame-depois.md` (M20 — padrão
  comando universal de referência se Bloco 7 entrar via comando)
- `docs/sessoes/2026-05-22-bloco4-atualizar-cadastro.md` (M19 — padrão
  ação de 2 turnos referência direta pra REGISTRAR_NPS)
- **`docs/relatorios/2026-05-22-fase1-bloco7-nps.md`** (relatório
  completo Fase 1 com 5 decisões pendentes + desenho proposto)
- Memória `sprint_bot_autoatendimento_20_05.md` (escopo Bloco 7)

## Carry-overs (não-bloqueantes)

**Bloqueia Fase 2 Bloco 7:**
- 5 decisões produto pendentes (detalhe em
  `docs/relatorios/2026-05-22-fase1-bloco7-nps.md` §8).

**Carry-overs gerais (não relacionados ao Bloco 7):**
- Bloco 5 Atualizar Contrato: ação automática vs solicitação humana
- Bloco 8 Menu Fatura / Menu Inadimplente: dinâmico vs hardcoded
- Desativar 1 das 2 etapas globais ATIVAS duplicadas no INICIAL
- `{{distribuidora}}` vazia em `AGUARDANDO_DISPOSITIVO_EMAIL`
- Horário hardcoded em `aguardando_atendente`
- Variáveis-fantasma na UI ModalMensagem
- 4 falhas pré-existentes na suíte Jest (cooperados/usinas controllers)

**Fila operacional pós-Sprint Bot Autoatendimento:**
- M15 Sprint 5a Neutro Fio B (3-5 dias)
- Cadastrar usina cooperebr2 (depende M15)
- Onboarding Sinergia (depende M15 + Sprint 6 IDOR + D-novo-Q)

**Débitos catalogados:**
- D-novo-Q Contatos Teste persistentes (6-8h)
- D-novo-U fix handler hardcoded ver fatura (1-2h, Sprint Housekeeping)
- D-novo-V engine de template `{{#if}}/{{#unless}}` (~8-12h)
- Sprint Housekeeping (~3-5h)
- HTML jornada Sugestão #6
- D-novo-H refator técnico (~6-8h)
- Iniciativa Fluxos Customizáveis D-novo-T (~100-200h+)
- Sugestão #9 Monitoramento de Proteção (Relé) Opção A — feature futura

## Regras aplicadas na sessão

- ✅ **Decisão 23** — Fase 1 read-only OBRIGATÓRIA. Zero edits, zero
  builds, zero schema. Apenas leitura + relatório.
- ✅ **Decisão 14** — grep amplo antes de propor solução. Confirmou
  estado real do NPS no projeto (model existe sem cooperativaId, modelos
  banco existem mas fonte fragmentada, agendarNps dead code, modelo
  trimestral órfão).
- ✅ **Reuse** — desenho proposto aproveita ao máximo o que já existe.
  Schema delta puramente aditivo.
- ✅ **Sem suposições** — caveats sobre `agendarNps` dead code e
  divergência hardcoded/dinâmico vieram da investigação real.
- ✅ **NÃO trabalhar paralelo com claude.ai** — Code 100% direto.
- ✅ **Toda sessão merece registro** (regra inegociável fechamento bilateral
  13/05) — adendo M20.1 atende mesmo sem implementação.

## Frase comandante

Frase canônica única em `docs/CONTROLE-EXECUCAO.md` seção
`## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único,
atualizada 22/05 noite no fechamento M20.1).
