# M46 — Sprint Convênio FUNDAÇÃO — E1 tokens ficam + E8 notificações wiradas

**Data:** 2026-06-21
**Branch:** `feature/convenio-fundacao-lifecycle` (PRESERVADA no origin)
**Merge SHA na main:** `950d2c1` (--no-ff sobre `79e5f1f`)

## TL;DR

Sprint pequena (~3h Code) que entrega a **fundação do ciclo de vida + notificações**
do convênio cooperativizado (design 19/06). E1 (tokens FICAM com funcionário no
desligamento) confirmado no read-only — `removerMembro` já não tocava saldo — e
ampliado com **notificação inline** ("seus N tokens continuam seus, R$ Y"). E8
(`TokenNotificacaoService` órfão desde Sprint Token-WA Fase 2) wirado via **listener
único** que consome 2 eventos: `RESGATADO` (já existente, fatura abatida) e
`DISTRIBUIDO_CONVENIO` (novo, empresa → funcionário). Smoke E2E REAL validou WA
disparado (não silencioso) pro número whitelist Luciano.

## Marco entregue

M46 — Sprint Convênio FUNDAÇÃO. **Decisão Luciano:** fazer TODAS as 4 sprints
da fila em sequência; #2 (M46 esta sprint) FECHADO.

## Commits

| Hash | Tipo | Mensagem |
|---|---|---|
| `79e5f1f` | feat | feat(convenio): M46 Sprint Convênio FUNDAÇÃO — E1 tokens ficam + E8 notificações wiradas |
| `950d2c1` | merge | merge(convenio): M46 Sprint Convênio FUNDAÇÃO — E1 + E8 + smoke real (--no-ff) |

Padrão preservado: feature branch `feature/convenio-fundacao-lifecycle` no origin.

## Entregas técnicas

### Fatia A — TokenNotificacaoService (2 métodos novos)

`src/cooper-token/token-notificacao.service.ts`:
- `notificarDistribuicaoConvenio(params)` — empresa → funcionário recebeu N tokens.
- `notificarAbateFatura(params)` — cooperado abateu fatura com tokens.
- Best-effort (try/catch + log warn). Reusam `WhatsappSenderService` tenant-aware
  (metadata `tipoDisparo + disparoId + cooperadoId + cooperativaId`).
- `notificarRecebedor` original NÃO tocado (decisão Q2b orquestrador).

### Fatia B — CooperTokenDistribuidoConvenioEvent + emit em distribuirTokens

`src/cooper-token/cooper-token.events.ts`: novo evento `DISTRIBUIDO_CONVENIO`.

`src/cooper-token/cooper-token.service.ts:1947-1973` (após mass-write commit):
- Loop emite 1 evento por linha (destinatário).
- Guard `resultado.modo === 'CONFIRM' && !resultado.idempotente && resultado.resultado.linhas` — não duplica em retry/idempotência hit.
- Sequencial best-effort (cuidado throttle A do orquestrador — sem fila WA ainda).

### Fatia C — CooperTokenNotificacaoListener (listener único)

`src/cooper-token/cooper-token-notificacao.listener.ts` (NOVO):
- `@OnEvent(RESGATADO)` → lookup `TokenTransacao` (pra obter `transacaoId` pro dedup) → `notificarAbateFatura`.
- `@OnEvent(DISTRIBUIDO_CONVENIO)` → direto `notificarDistribuicaoConvenio`.
- **Idempotência** (cuidado B orquestrador): `MensagemWhatsapp.findFirst({tipoDisparo, disparoId, status:'ENVIADA', cooperativaId})` — skip silencioso se já enviada.
  - `cooperativaId` adicionado pra defense-in-depth multi-tenant (P3-A reviewer).
- **Sem telefone** (cooperado sem WA): skip + log warn (D-novo-NOTIF-EMAIL-FALLBACK P3).
- Wirado em `cooper-token.module.ts` providers.

### Fatia D — E1 inline em `removerMembro`

`src/convenios/convenios-membros.service.ts:170-275`:

- Premissa **validada na Fase 1**: `removerMembro` NÃO toca `CooperTokenSaldo`, `CooperTokenLedger`, qualificação Clube, ou `TokenTransacao`. Só atualiza `ConvenioCooperado.{ativo:false, status:'MEMBRO_DESLIGADO', dataDesligamento}` + `recalcularFaixa`.
- Novo método **`private notificarDesligamentoE1`**:
  - Busca `ContratoConvenio` (cooperativaId + empresaNome).
  - Busca `Cooperado(telefone, nomeCompleto)` filtrado por `cooperativaId` (P3-C defense-in-depth).
  - Busca `CooperTokenSaldo` + `ConfigCooperToken.valorTokenReais` em `Promise.all` (P1-A reviewers — não hardcode 0.45).
  - Monta texto: "Você foi desligado do convênio com {empresaNome}. Você ainda tem N CooperTokens (R$ Y). **Eles CONTINUAM SEUS** — use no app pra abater sua própria fatura ou pagar em estabelecimentos do Clube."
  - Saldo 0 ou null → texto alternativo "Caso receba tokens no futuro, eles serão seus."
- Best-effort: erros no WA não derrubam o desligamento (já commitado).
- Sem telefone: skip + log warn (D-novo-NOTIF-EMAIL-FALLBACK).
- Construtor de `ConveniosMembrosService` recebe `WhatsappSenderService` (já no module).

## Testes

### Jest (22/22 verde)

- `cooper-token-notificacao.listener.spec.ts` (10): RESGATADO/DISTRIBUIDO_CONVENIO × happy path + idempotência (com asserção `cooperativaId` no where — P1-B) + sem telefone + cross-tenant + best-effort.
- `convenios-membros-e1-desligamento.spec.ts` (12): commit sem tocar saldo + texto E1 + saldo>0/=0/=null + sem telefone + já desligado + vínculo inexistente + WA falha best-effort + multi-tenant + valorTokenReais por tenant + fallback null.

### Smoke E2E REAL (exigência re-review orquestrador)

`scripts/smoke-e1-desligamento.ts`:

1. **Setup:** cooperado-teste criado com `telefone='27981341348'` (whitelist Luciano) + `cpf='88877766611'` + email `lucbragatto+smoke-e1-desligamento@gmail.com` + `cooperativaId=CoopereBR` + `saldoDisponivel=50` tokens + vínculo `MEMBRO_ATIVO` em Convênio "Condomínio Moradas da Enseada".
2. **Trigger:** `ConveniosMembrosService.removerMembro` real (NÃO mock).
3. **Validação (1.5s pós-trigger):** `MensagemWhatsapp.findFirst` retornou:
   - `status='ENVIADA'` ✅ (D-novo-WA-DEV-FALSE-OK descartado)
   - `telefone='27981341348'` ✅
   - `tipoDisparo='CONVENIO_DESLIGAMENTO_E1'`
   - `disparoId='cmobhnxku0115vax8f1p3zcbu:cmqnyibck0002vao076iqexsy'`
   - Texto: "ℹ️ Desligamento do convênio... 50 CooperTokens (aprox. R$ 22,50). Eles CONTINUAM SEUS..."
4. **Cleanup:** apaga vínculo + saldo + cooperado smoke (idempotente).

**Resultado: 1/1 PASS.** WA enviado de verdade pro Luciano (verificável no celular dele), R$ 22,50 calculado via `ConfigCooperToken.valorTokenReais=0.45` do tenant (fix P1-A funcionando).

## Reviewers (2 paralelos + re-review)

| Reviewer | Veredito |
|---|---|
| `cooperebr-multitenant-reviewer` | APROVADO COM RESSALVAS — P2-A hardcode FIX + P3-A cooperativaId FIX. Débitos IDOR catalogados. |
| `code-reviewer` | WARNING — P1-A hardcode (mesmo achado, FIX) + P1-B asserção spec (FIX). 2 P2 + 3 P3. |
| Re-review orquestrador | **APROVADO** com exigência smoke real. Smoke executado e PASSOU. |

## Decisões catalogadas nesta sessão

1. **D21/06-FUNDAÇÃO-1 — Listener único:** 1 `CooperTokenNotificacaoListener` consome 2 eventos (RESGATADO + DISTRIBUIDO_CONVENIO). Menos sobrecarga, contexto unificado.
2. **D21/06-FUNDAÇÃO-2 — Métodos dedicados (não param contexto):** `notificarDistribuicaoConvenio` + `notificarAbateFatura` como métodos novos, NÃO modificar `notificarRecebedor` original.
3. **D21/06-FUNDAÇÃO-3 — E1 inline:** notificação de desligamento inline em `removerMembro` (único caller, zero efeito contábil). Não evento.
4. **D21/06-FUNDAÇÃO-4 — Sem telefone → skip + log warn:** `D-novo-NOTIF-EMAIL-FALLBACK P3` catalogado pra email fallback futuro.
5. **D21/06-FUNDAÇÃO-5 — Idempotência multi-tenant:** dedup via `MensagemWhatsapp.findFirst({tipoDisparo, disparoId, status, cooperativaId})`. `disparoId` é CUID global (`TokenTransacao.id` ou composto `convenioId:cooperadoId` no E1).
6. **D21/06-FUNDAÇÃO-6 — `valorTokenReais` por tenant:** sempre buscar `ConfigCooperToken` com fallback 0.45 — NUNCA hardcode. P1 reviewers.

## Carry-overs (não-bloqueantes)

### Débitos NOVOS catalogados

| Débito | Severidade | Origem | Status |
|---|---|---|---|
| **D-novo-NOTIF-EMAIL-FALLBACK** | P3 | Decisão orquestrador Q4 + reviewers | Catalogado |
| **D-novo-E1-DISPARO-READMISSAO** | P3 | code-reviewer P2-B | `disparoId='convenioId:cooperadoId'` colidiria no 2º desligamento APÓS readmissão. waSender NÃO tem dedup interno (só log MensagemWhatsapp), então 2º envio funciona. Risco só se algum dia adicionarmos dedup no sender. |
| **D-novo-CONVENIO-UPDATE-SEM-COOPID** | P2 | multitenant P2-B | `removerMembro`/`updateMembro` UPDATE sem `cooperativaId` no where. Pré-existente IDOR sistêmico. |
| **D-novo-CONVENIO-LISTAR-MEMBROS-SEM-COOPID** | P2 | multitenant P2-C + code P2-D | `listarMembros({convenioId})` sem filtro `cooperativaId`. Pré-existente. |
| **D-novo-UPDATEMEMBRO-ANY** | P3 | code P2-C | `updateData: any` em `updateMembro`. Pré-existente. |
| **D-novo-WA-FILA-DEDICADA** | P3 | cuidado A orquestrador | Sem fila WA pra burst grande de distribuição (mass-write N funcionários). Sequencial best-effort. Catalogar pra escalar se Santi mostrar problema. |

### Observação: IDOR sistêmico ACUMULANDO

3 débitos `D-novo-CONVENIO-*-SEM-COOPID` desta sprint + débitos M45 lateral
(`asaas/condominios/convite-indicacao`) + inventário SISGD (~20 endpoints sem
multi-tenant em UPDATE/DELETE). **Candidato a sprint de segurança próximo**
(Sprint Hardening Lateral M45 já existia; agora ganha mais 3 entradas).

### Sprints fila Luciano

- **#1 Sprint Hardening Tenant-Spoof (M45)** — ✅ FECHADO
- **#2 Sprint Convênio FUNDAÇÃO (M46)** — ✅ FECHADO NESTA SESSÃO
- **#3 — Sprint Convênio MIGRAÇÃO (Fase 3 — G2 + G5 + rollback)** — próximo na fila (legalmente seguro; não exige parecer trabalhista)
- **Sprint Convênio FAMÍLIA (Fase 2 — G1)** — AGUARDA parecer trabalhista do Luciano (token paga conta de luz = risco salário in natura agravado)
- **#3 Sprint OPÇÃO A D-QUALIF-DECAY** — segue catalogado
- **#4 Sprint OPÇÃO C Notificações Proativas** — segue catalogado

### Outros carry-overs

- Caminho ativação produção saque colaborador DESCONTO_FATURA — inalterado.
- 7 débitos `D-novo-CONVENIO-*` abertos do design 19/06 (E1 RESOLVIDO nesta sprint; outros 6 pendentes).
- D-novo-CONVENIO-FASE0-JURIDICO P0 — bloqueia ativação real (parecer trabalhista + estatuto + isenção PIS/COFINS).

## Regras aplicadas

- ✅ Decisão 23 (validação prévia) — Fase 1 read-only ampla antes Fase 2.
- ✅ Regra contatos teste 14/05 — smoke E2E usou `27981341348` whitelist; CPF mantém.
- ✅ FUNDACAO §4#1 invariante — E1 não toca saldo, ledger preservado intacto.
- ✅ Padrão M39/M41/M42/M43/M44/M45 — branch dedicada → reviewers pesados → re-review orquestrador → smoke real → merge --no-ff → feature branch preservada.
- ✅ PM2 rebuild backend após mudanças.
- ✅ Disciplina de análise modelo canônico primeiro — listener-based event pattern já existia no projeto (FinanceiroTokenListener, compra-pj, resgate) — reusado em vez de criar pattern novo.

## Frase comandante

Ver `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code`
(M46 atualizada, M45 arquivada).
