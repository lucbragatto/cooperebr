# Fase 1 read-only — Sprint "Abrir Cadastros — Teste SISGD" — 17/06/2026

## TL;DR

Sessão Code curta de planejamento — zero commits, zero código novo. Entregou: (a) Fase 1.5 read-only do Concierge × Rotinas Decisórias Aprendidas (relatório técnico no chat) cruzando 8 detectores + funil WA + schema Prisma + memórias 12.r19a; (b) Fase 1 read-only do Sprint "Abrir Cadastros — Teste SISGD" — confirmou que onboarding está ~85% pronto (wizard /cadastro + convite OTP + state machine aprovação dupla + MembroBuilder + Santi seedada + magic link público da empresa em `/aprovacao-membro/[token]`), identificou 3 gaps reais (seed SISGD interno + tela empresa logada + tela admin) e montou mapa de impacto 5 dimensões + escopo Fase 2 (~9-12h) + 4 perguntas decisórias. Branch `feature/abrir-cadastros-sisgd-teste` criada vazia, aguardando OK Luciano nas 4 perguntas antes de codar.

## Marco entregue

**Sessão de planejamento (read-only)** — não cataloga marco numérico próprio. M39 fica como último marco Code (16/06).

## Commits do dia

Zero commits de trabalho. Apenas commit de fechamento (este).

## Entregas técnicas

### (1) Fase 1.5 read-only — Concierge × Rotinas Decisórias Aprendidas

Relatório técnico produzido no chat (não persistido em arquivo do projeto — território Cowork). Achados centrais:

- **8 detectores em `detectores.registry.ts:48-57`** mapeados pra schema-rotina-candidata (sinais/verificações/provas/cadeia/riscos/exemplos/evals/provenance/status/impacto-orquestrador). 70% extraível direto do código; 30% (riscos multi-tenant + impacto orquestrador + eval por rotina) exige aprendizado reverso humano.
- **`ConciergeWaService` está desplugado em runtime** — existe em `concierge-wa.service.ts:135` mas NÃO está em `concierge.module.ts:32-50` (providers nem exports). Funil WA C8 (9 estados + 3 finais) é skeleton órfão com `TODO: implementar` em todos os métodos (OCR Claude, OTP, Asaas, procuração). Bot WA principal não conhece o Concierge (grep vazio).
- **`cooperebr-orquestrador.md` ainda não foi atualizado** com a proposta de "consultar rotinas relevantes". Diff cirúrgico mínimo descrito (4 blocos), mas não aplicar antes de 12.r19b–c (fila humana de rotinas) existir como skill/script.
- **Schema `DiagnosticoIndebito`** usa `Json @default("[]")` em `padroesDetectados` e `tesesAplicaveis` (`schema.prisma:4057-4063`) — validação só em runtime, sem enforcement de shape.
- **Conflito C7 PlanoSaas × Concierge à la carte** segue aberto: `propagarModulosDoPlano` (`saas.service.ts:111-123`) é mass-write que sobrescreve `modulosAtivos` — vender Concierge à parte sem estratégia de merge `plano ∪ extras` destrói módulo extra ao editar plano.
- **3 rotinas-candidatas priorizadas:** (1) `rotina_tese3_pis_cofins_scee_v1` (ementa cabal pronta, caso Laurentino documentado); (2) `rotina_conformidade_contabilidade_segregada_v1` (rascunho em memória); (3) `rotina_validacao_convenio_token_voucher_v1` (rascunho em memória, aplica ao M39).

Próxima ação dessa frente fica com Luciano + Cowork (não é território Code).

### (2) Fase 1 read-only — Sprint "Abrir Cadastros — Teste SISGD"

Confirmou os 5 pontos mapeados pelo orquestrador:

| # | Ponto | Evidência |
|---|---|---|
| 1 | Wizard `/cadastro` 4 passos + OCR | `web/app/cadastro/page.tsx` + endpoints `POST /publico/iniciar-cadastro` (109), `cadastro-web` (194), `processar-fatura-ocr` (1383), `cadastro-sem-uc` (1578) |
| 2 | Convite individual + OTP WA | `convites-convenio.service.ts`. Públicos: `GET /publico/convites/:token` (388), `solicitar-otp` (420), `validar-otp` (432). Admin: `POST /convenios/:id/convites` (654) |
| 3 | Aprovação dupla state machine | `convenios-aprovacao.service.ts` + enum `StatusMembroConvenio` (`schema.prisma:426-439`). Fluxo: PENDENTE_APROVACAO_EMPRESA → magic link empresa → PENDENTE_APROVACAO_ADMIN → admin aprova → MEMBRO_ATIVO |
| 4 | MembroBuilder constrói contrato+Clube | `cadastroWebV2(origem=CONVITE_PUBLICO)` em `publico.controller.ts:493-495` + `aprovacao.service.ts:215` |
| 5 | Santi seedada (CV-SANTI-001) | `seed-santi-conveniada.ts` cria Cooperado PJ + Usuario Supabase + ContratoConvenio MISTO 20% token, `ambienteTeste=true`, contatos whitelist |

Endpoints de aprovação confirmados todos prontos:

- `GET /convenios/:id/membros-pendentes` (`convenios.controller.ts:483`) + filtro `?status=`
- `POST .../aprovar-admin` (`:519`)
- `POST .../solicitar-documentacao` (`:552`)
- `POST .../rejeitar-admin` (`:586`)
- `POST .../reenviar-aprovacao-empresa` (`:619`)
- `GET /publico/aprovacao-membro/:token` (`publico.controller.ts:453`) + `POST` (`:462`) — magic link público com throttle + audit ip/UA

**Descoberta:** `web/app/aprovacao-membro/[token]/` JÁ EXISTE — UI pública magic link da empresa pronta. Esse caminho não precisa ser refeito.

**3 gaps reais identificados:**

1. `web/app/conveniada/convenio/[id]/membros/` — empresa logada não vê pendentes hoje (existe só dashboard + distribuir-tokens).
2. `web/app/dashboard/convenios/[id]/membros-pendentes/` — admin não vê pendentes hoje.
3. Seed do convênio interno SISGD — não existe (Santi é parceira; SISGD interno precisa do próprio molde).

### (3) Branch criada

```
feature/abrir-cadastros-sisgd-teste — vazia, sem commits, aguardando Fase 2
```

## Bugs resolvidos / catalogados

Nenhum. Sessão read-only.

## Decisões estratégicas catalogadas

Nenhuma decisão nova de produto. Confirmadas premissas do orquestrador.

Recordatório (não-novo):

- **Território Cowork selado:** 8 arquivos `M` em `backend/src/concierge/*` + `package.json/lock` + `concierge.service.spec.ts` (timestamps 14/06 15:24 — bump dependência + spec — e 15/06 08:38-08:39 — wiring do `DetectorDemandaNaoUtilizada`). Code NÃO toca. NUNCA `git add .` — só arquivos explícitos do escopo Code (Luciano confirmou na abertura desta sessão).

## Próximo passo

Responder as 4 perguntas decisórias na frase de retomada e executar Fase 2 do Sprint "Abrir Cadastros — Teste SISGD": (a) seed `scripts/seed-sisgd-teste-interno.ts`, (b) tela `/conveniada/convenio/[id]/membros`, (c) tela `/dashboard/convenios/[id]/membros-pendentes`, (d) smoke E2E. ~9-12h.

## Pré-requisitos leitura próxima sessão

- `backend/scripts/seed-santi-conveniada.ts` — molde do seed (253 linhas, idempotente)
- `backend/src/convenios/convenios.controller.ts:478-631` — endpoints de aprovação admin
- `backend/src/convenios/convenios-aprovacao.service.ts` — state machine completo + decidirAprovacaoEmpresa
- `backend/src/publico/publico.controller.ts:440-481` — magic link empresa
- `web/app/aprovacao-membro/[token]/` — UI pública já existente (não refazer)
- `web/app/conveniada/convenio/[id]/page.tsx` — onde encaixar card de pendentes
- CLAUDE.md regra "Cooperados institucionais — SALVAGUARDA" — formato email `institucional+<id>@sisgd.invalid` (RFC 2606)
- Regra contatos teste 14/05: `27981341348` + `lucbragatto+sisgd@gmail.com`

## Carry-overs (não-bloqueantes)

- **Concierge × Rotinas Decisórias** — território Cowork. Trabalho continua lá quando Luciano retomar.
- **8 M working tree do Cowork** — selados, não tocar. Próximo fechamento Cowork limpa.
- **Branch `feature/abrir-cadastros-sisgd-teste`** existe vazia. Próxima sessão arranca nela.
- **3 opções pós-M39 segue em aberto** (Sprint Contábil / Decisões D1-D4 Modelo C / Sprint Hardening Mass-Write) — este sprint atual (Abrir Cadastros) entra como prioridade ANTES dessas opções.

## Regras aplicadas na sessão

- **Decisão 23** (validação prévia rigorosa) — não tocou código antes do OK explícito do Luciano.
- **`feedback_fase1_readonly_obrigatoria.md`** — Fase 1 read-only completa antes de propor Fase 2.
- **Regra Cowork-território** (19/05) — não tocou nem leu/inspeciona como agente os 8 arquivos M em `backend/src/concierge/*`. Inspeção apenas via `git status/log/diff --stat` pra entender origem.
- **`regra_nao_trabalhar_paralelo_com_code_17_05.md`** — sessão sequencial, sem paralelo.
- **CLAUDE.md "Cooperados institucionais — SALVAGUARDA"** — escopo Fase 2 prevê `institucional+sisgd@sisgd.invalid` (RFC 2606, nunca deletar).
- **Regra contatos teste impreterível (14/05)** — escopo Fase 2 usa `27981341348` + `lucbragatto+sisgd@gmail.com`, nunca contato real.
- **Decisão 24** — esta frase de retomada vive em local único (`CONTROLE-EXECUCAO.md` § FRASE DE RETOMADA + esta doc-sessão). Substitui a frase M39 anterior.

## Frase comandante

Ver `## FRASE DE RETOMADA — próxima sessão Code` em `docs/CONTROLE-EXECUCAO.md` (Decisão 24 — local único).
