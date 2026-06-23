# M50 — Sprint Faxina Contábil do Token (Fase A/B) — 22/06/2026

## TL;DR

Sprint Faxina Contábil do Token: re-alinhamento ao modelo voucher CPC 47 +
ato cooperativo Lei 5.764/71. **Fase A/B fechada** — risco fiscal IMEDIATO
neutralizado (`1.2.01 Receita Venda Tokens` aposentada; ingresso pago vira
**D Caixa / C Passivo Tokens a Resgatar 2.3.01**). 14 tipos de
`CooperTokenTipo` classificados em 5 categorias canônicas, validado pelo
`cooperebr-analista-conformidade`. 4 reviewers paralelos + 7 fixes
aplicados. Smoke E2E REAL no `CoopereBR Teste` com cooperado FRESCO
(lição re-review M49 honrada): asserts D/C corretos + invariante FUNDACAO
§4#1 preservado (delta=0). Próximo: Faxina Fases C-G (melt/painel/
reconciliação — gated no parecer Walter) OU Sprint Hardening Lateral.

## Marco entregue

**M50 — Sprint Faxina Contábil do Token, Fase A/B** (modelo + contas +
re-alinhamento de lançamentos + classificação canônica + smoke real).
Pré-requisito de operação com dinheiro real (saque/resgate em produção).
**Não bloqueia** o que já foi construído.

## Commits do dia (esta sessão)

| Hash | Mensagem |
|---|---|
| `…` | feat(faxina): M50 Sprint Faxina Contábil Fase A/B |
| `…` | docs(faxina): specs + relatorios do orquestrador |
| `…` | docs(sessao): fechamento M50 |
| `…` | merge(faxina): M50 — Fase A/B |

(SHAs preenchidos pós-commit.)

## Entregas técnicas (Fase A/B)

### A) PlanoContas (script `faxina-contabil-fase-a-planocontas.ts` aplicado)

- **NOVA** `5.1.10 Custo Desconto Token` (DESPESA) — bonificação vinculada
  a desconto/crédito de fatura (FATURA_CHEIA, FLEX, GERACAO_EXCEDENTE).
- **NOVA** `2.3.01 Passivo Tokens a Resgatar` (PASSIVO) — recodificada de
  `5.1.02 DESPESA` (tipo errado pré-existente). Série `2.3.x` ficou
  reservada exclusivamente pro passivo token. **13 lançamentos via FK
  preservados** (re-review orquestrador 22/06 — typo "91" corrigido).
- **NOVAS GATED** `1.2.10` Receita Spread Resgate / `1.2.11` Receita Taxa
  Circulação QR / `1.2.12` Receita Quebra Oxidação — criadas mas só
  consumidas com parecer Walter (spec §1.1).
- **APOSENTADA** `1.2.01 Receita Venda Tokens` (ativo=false). 0 lançamentos
  no banco. Armadilha tributária histórica neutralizada.

### B) Migração de dados (script `faxina-contabil-fase-a-migra-lancs.ts`)

- **9 lançamentos `[Token]`** que estavam indo pra `5.1.01-Usina` (colisão
  pré-existente — `garantirContas` antigo dava match no `5.1.01-Usina`
  porque o nome no código era diferente do real do banco) migrados pra
  nova `5.1.10`. **3 lançamentos USINA REAL preservados** (sem
  prefixo `[Token]` na descrição). Re-review orquestrador confirmou
  estado final no banco.

### C) Schema delta

- **`OrigemLancamento`** += `COBRANCA_ABATE_FATURA` (aditivo, sem
  migration de dados) — idempotência do `lancarResgateFatura` via
  `@@unique(origemTipo, origemId)`.
- **`PlanoContas`** — recodifica `codigo @unique` global → `@@unique([
  codigo, cooperativaId])` (fix P1 multitenant-reviewer). **0 duplicatas**
  na auditoria prévia (CLAUDE.md schema rules respeitado).

### D) Refactor `token-contabil.service.ts`

- Constantes exportadas (`CONTA_PASSIVO_TOKEN='2.3.01'`,
  `CONTA_CUSTO_DESCONTO_TOKEN='5.1.10'`, etc.).
- Novo método **`lancarIngressoEmissaoPaga(params)`** → **D Caixa
  (planoContasId=null) / C Passivo 2.3.01** — ingresso pago canônico.
- `lancarEmissaoFaturaCheia` → D **5.1.10** / C 2.3.01 (era 5.1.01).
- `lancarResgateFatura` agora aceita `origemId` opcional + idempotência
  via `@@unique` no schema.
- `lancarCompraParceiroPago` **DELETADO** (armadilha tributária).
- Métodos legados (`lancarExpiracao`, `lancarEmissaoAdminLote`,
  `lancarEstornoEmissaoAdminLote`, `lancarResgatePix`) repointados para
  códigos canônicos.
- Convenção uniforme **D=DESPESA / C=RECEITA** nos pares dupla-partida.
- `naturezaAto` parametrizado em todos os métodos (default `'PROPRIO'`).
- `garantirContas` — `cooperativaId` agora **obrigatório** (era `?`); fix
  P1 multitenant + fallback estrito (nunca retorna conta de outro tenant).

### E) `classificacao-contabil.helper.ts` (NOVO)

14 tipos de `CooperTokenTipo` classificados em 5 categorias canônicas:

| Categoria | Tipos | Lançamento |
|---|---|---|
| **INGRESSO_PAGO** | BENEFICIO_CONVENIO (AUXILIAR), COMPRA_PJ_COOPERADA (PROPRIO) | D Caixa / C Passivo |
| **BONIFICACAO_DESCONTO** | GERACAO_EXCEDENTE, FATURA_CHEIA, FLEX (PROPRIO) | D 5.1.10 / C Passivo |
| **BONIFICACAO_ADMIN** | BONUS_INDICACAO, SOCIAL, BONIFICACAO_ADMIN (PROPRIO) | D 5.1.03 / C Passivo |
| **TRANSFERENCIA_INTERNA** | DISTRIBUICAO_CONVENIO | nenhum (só muda titular) |
| **USO** | DESCONTO_FATURA, PAGAMENTO_QR, RESGATE_PIX, ESTORNO_RESGATE_PIX, ESTORNO_BONIFICACAO_ADMIN | handlers próprios |

**Validação pelo `cooperebr-analista-conformidade` (22/06)**: classificação
APROVADA com 2 ressalvas (P1 + P2) que ficaram catalogadas como débitos
para Fase C — não bloqueiam Fase A/B:
- **P1**: `BENEFICIO_CONVENIO` hardcoda `AUXILIAR` quando o pagador é
  cooperado (deveria ser `PROPRIO Art. 79`). Consulta a
  `Convenio.naturezaAtoCooperativo` será feita na Fase C.
- **P2**: `SOCIAL` sem validação se destinatário é cooperado (risco
  fiscal se aplicado a não-cooperado vira `NAO_COOPERATIVO Art. 86-87`,
  tributação plena). Restrição operacional documentada.

O analista confirmou: **Fase A/B desativa o risco fiscal IMEDIATO**
(neutralizar `Receita Venda`); receita de melt/oxidação fica gated pelo
parecer Walter (CPC 47 item 56 breakage + STF Tema 536 confirmado 2017).

### F) Eventos + listener

- **NOVO evento** `COOPER_TOKEN_EVENTS.INGRESSO_EMISSAO_PAGA` + classe
  `CooperTokenIngressoEmissaoPagaEvent` (cooperativaId, cooperadoId,
  tipo, quantidade, valorReais, naturezaAto).
- `cooper-token.service.ts:creditar()` agora consulta `classificarTipo`
  e roteia:
  - INGRESSO_PAGO → emite `INGRESSO_EMISSAO_PAGA`
  - BONIFICACAO_DESCONTO + BONIFICACAO_ADMIN → emite `EMITIDO` (handler
    decide a conta — `lancarEmissaoFaturaCheia` ou `lancarEmissaoAdminLote`)
  - TRANSFERENCIA_INTERNA → **não emite** (só ledger)
- `financeiro-token.listener.ts` — `handleEmitido` ROTEIA por categoria
  (fix P1 financeiro-token-reviewer: tipos D+C iguais corrigidos pra
  convenção D=DESPESA/C=RECEITA). Novo `handleIngressoEmissaoPaga` + novo
  **`handleResgatadoFamiliar`** (fix P1 — M49 gap fechado, passivo agora
  baixa no abate familiar). `handleCompraParceiroPago` (legado tenant)
  agora chama `lancarIngressoEmissaoPaga` (AUXILIAR).

### G) `cobrancas.service.ts:312`

- **Removida** chamada direta a `lancarEmissaoFaturaCheia` que
  duplicava o passivo (creditar() já emite EMITIDO → listener chama). Fix
  P1 financeiro-token-reviewer.

## Reviewers consultados (4)

| Reviewer | Veredito | Achados aplicados |
|---|---|---|
| `cooperebr-analista-conformidade` | APROVADO com 2 ressalvas catalogadas | Classificação validada; BENEFICIO_CONVENIO/SOCIAL pendentes Fase C |
| `cooperebr-financeiro-token-reviewer` | APROVADO com 9 achados | 5 P1 + 2 P2 aplicados; 2 P2 catalogados |
| `cooperebr-multitenant-reviewer` | APROVADO com 4 achados | P1 garantirContas + P2 idempotência + P2 cooperativaId obrigatório aplicados; P3 RESGATADO_FAMILIAR fixado |
| `code-reviewer` | APROVADO com 2 P1 + 4 P2 + 4 P3 | P1 estornos + P1 garantirContas aplicados; P2/P3 cosméticos catalogados |
| **Orquestrador (re-review)** | **APROVADO** | 3 ajustes no fechamento (typo 91→13, elevar P3→P2 do Promise.all, confirmar analista validou) |

## Bugs resolvidos / catalogados

| Bug | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| `1.2.01 Receita Venda Tokens` armadilha tributária | P0 fiscal | Modelo voucher violado | APOSENTADA + caminho de ingresso vai pra Passivo | RESOLVIDO |
| `5.1.02` tipo DESPESA (deveria PASSIVO) | P0 balanço | Schema legado | Recodificada `2.3.01 PASSIVO` | RESOLVIDO |
| Colisão `5.1.01` Usina × Custo Desconto Token | P0 dado | `garantirContas` dava match no Usina | Nova `5.1.10` + 9 lançamentos `[Token]` migrados | RESOLVIDO |
| `confirmarCompraParceiro` half-entry C Receita Venda | P0 fiscal | Modelo voucher violado | Listener roteia pra `lancarIngressoEmissaoPaga` (AUXILIAR) | RESOLVIDO |
| `processarPagamentoCompraPj` debita Custo (era Caixa) | P0 fiscal | Template emissão errado | `creditar` com COMPRA_PJ → INGRESSO_EMISSAO_PAGA | RESOLVIDO |
| Double-call FATURA_CHEIA_TOKEN (cobrancas + listener) | P1 financeiro | Caller já dispara via evento | Chamada direta removida | RESOLVIDO |
| RESGATADO_FAMILIAR sem handler contábil (M49 gap) | P1 financeiro/multitenant | Listener faltava | `handleResgatadoFamiliar` adicionado | RESOLVIDO |
| `garantirContas` fallback cross-tenant | P1 multitenant | findFirst no catch sem cooperativaId | Schema `@@unique([codigo,cooperativaId])` + fallback estrito | RESOLVIDO |
| Tipos D+C iguais em pares dupla-partida | P1 financeiro | Convenção ambígua | D=DESPESA / C=RECEITA uniforme | RESOLVIDO |
| ESTORNO_* caem no default BONIFICACAO_ADMIN | P1 code | Switch incompleto | Cases USO explícitos | RESOLVIDO |
| `lancarResgateFatura` sem idempotência | P2 financeiro | Sem `origemId` | `origemId` opcional + `@@unique(origemTipo,origemId)` | RESOLVIDO |
| `garantirContas` `cooperativaId?` opcional | P2 multitenant | Armadilha futura | Obrigatório | RESOLVIDO |

## Novos débitos catalogados

- **D-novo-FAXINA-BENEFICIO-CONVENIO-NATUREZA** P1 — `BENEFICIO_CONVENIO`
  hardcoda `AUXILIAR` quando pagador pode ser cooperado (deveria
  `PROPRIO Art. 79`). Consulta a `Convenio.naturezaAtoCooperativo`
  pendente. **Status:** ABERTO. **Fecha em:** Faxina Fase C (ligar
  classificação ato-cooperativo ao contábil).
- **D-novo-FAXINA-SOCIAL-DESTINATARIO** P2 — `SOCIAL` sem validação
  cooperado-only. Risco fiscal se aplicado a não-cooperado
  (NAO_COOPERATIVO Art. 86-87 — tributação plena PIS/COFINS+IRPJ).
  **Status:** ABERTO. **Fecha em:** Faxina Fase C ou controller guard.
- **D-novo-FAXINA-PARTIDAS-NAO-ATOMICAS** **P2 ELEVADO** (re-review
  orquestrador: era P3 — elevado pra P2 porque half-entry contábil = livro
  desbalanceado se uma perna falha) — `Promise.all` sem `$transaction`
  nos pares D+C do `token-contabil.service`. **Status:** ABERTO. **Fecha
  em:** Faxina Fase G (reconciliação detecta + tx envolvendo os 2 creates).
- **D-novo-FAXINA-PROVISIONAL-VS-REALIZADO** P2 — `creditar()` cria
  `LancamentoCaixa PROVISIONAL` inline + listener cria `REALIZADO`
  canônico depois. 2 lançamentos coexistem; relatórios que somam
  `2.3.01` sem filtrar `status != PROVISIONAL` contam em dobro.
  **Status:** ABERTO. **Fecha em:** Faxina Fase E (painel) ou filtro nos
  relatórios.
- **D-novo-FAXINA-MELT-GATED** P1 estratégico — receita de melt
  (`1.2.10/11/12`) tem estrutura mas **OFF até parecer Walter +
  tributarista**. Spread (taxa resgate), Taxa Circulação QR, Quebra
  Oxidação. Confirmado pelo analista-conformidade. **Status:**
  CATALOGADO COMO BLOQUEADOR PRÉ-PRODUÇÃO.
- **D-novo-FAXINA-DELTA-COOPEREBR** P2 (renomeação do
  `D-novo-FUNDACAO-DELTA-COOPEREBR`) — delta −729.86 no tenant CoopereBR
  pré-existente. **Fecha em:** Faxina Fase G (reconciliação + investigar
  fonte).

## Decisões estratégicas catalogadas

- **Convenção D=DESPESA / C=RECEITA** uniforme nos pares dupla-partida do
  `token-contabil` (era ambígua; relatórios contavam em dobro).
- **Receita de melt sempre gated** por config tenant + env + parecer Walter
  (estrutura pronta + flag OFF).
- **Cleanup smoke obrigatório** — cooperado FRESCO criado e deletado
  (lição re-review M49: nunca usar cooperado pré-existente em smoke).
- **Classificação default conservadora**: `PROPRIO` quando indeterminado.
  Promoção `AUXILIAR → PROPRIO` é documental (matrícula/joia/voto — Q4
  orquestrador).

## Verificação técnica

- **Specs Faxina (3 suites)**: 33/33 ✅
- **Regressão legados (6 suites M49+F4+D2+listener+F2+M39)**: 91/91 ✅
- **Sweep total (9 suites)**: **124/124 ✅**
- **TS check**: 0 erros novos nos arquivos M50 (pré-existentes em
  `cooper-token-qr-conformidade.spec.ts` não tocados).
- **Smoke E2E REAL CoopereBR Teste** (cooperado FRESCO criado+deletado):
  - INGRESSO_PAGO → D Caixa(null/RECEITA) + C 2.3.01(RECEITA) PROPRIO ✅
  - BONIFICACAO_DESCONTO → D 5.1.10(DESPESA) + C 2.3.01(RECEITA) ✅
  - BONIFICACAO_ADMIN → D 5.1.03 + C 2.3.01 ✅
  - ABATE idempotência (2 chamadas mesmo origemId → 1 lançamento) ✅
  - **Invariante FUNDACAO §4#1**: saldo=166.6 == ledger=166.6, delta=0 ✅

## Próximo passo

**Sprint HARDENING LATERAL** (~10-14h) — pré-requisito Camada 3 funil +
2º parceiro real. OU **Sprint Faxina Fases C-G** (melt/painel/
reconciliação) **gated no parecer Walter**:
- C: ligar classificação ato-cooperativo (`Convenio.naturezaAtoCooperativo`
  → `LancamentoCaixa.naturezaAto`).
- D: reconciliação + investigação do delta −729.86.
- E: painel admin de Passivo/Forecast.
- F: receita de melt (taxa QR + spread + quebra) — ATIVAÇÃO REAL só com
  parecer Walter (Mantém OFF até lá).

Decisão de ordem fica com orquestrador (frase comandante aponta as 2
opções).

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` — frase comandante M50.
- `docs/sessoes/2026-06-22-m50-sprint-faxina-contabil-token.md` (este doc).
- `docs/ESPEC-FAXINA-CONTABIL-TOKEN-2026-06-22.md` (spec do orquestrador).
- `docs/relatorios/checkin-integracao-token-clube-2026-06-22.md`.
- `docs/debitos-tecnicos.md` — débitos novos M50 + P1 lateral M45/M48.

## Carry-overs (não-bloqueantes)

- Faxina Fases C-G aguardam decisão de ordem (vs Hardening Lateral).
- **Parecer Walter + tributarista** pendentes antes de ativar receita de
  melt em produção.
- 4 P1 lateral M45 + 2 P2 M46 + 2 P2 M47 + 1 P1 M48 (acumulados em
  "Hardening Lateral").
- Cosméticos catalogados (JSDoc órfão em `cooper-token.events.ts`, logs
  inconsistentes em `[token-contabil]`).

## Regras aplicadas nesta sessão

- Disciplina de modelo canônico PRIMEIRO (correção orquestrador 16/06):
  modelo voucher CPC 47 + ato cooperativo derivado antes do código.
- Decisão 23 (Fase 1 read-only obrigatória) — mapeamento completo antes
  de tocar código.
- Regra schema CLAUDE.md — DRY-RUN + ANTES/DEPOIS nas 2 migrações de
  dados (PlanoContas + lançamentos).
- Lição re-review M49: cooperado FRESCO no smoke + cleanup obrigatório.
- Lição M45 inegociável (`cooperativaId` sempre do JWT/payload, nunca do
  body) preservada em todos os fixes multi-tenant.
- Pattern M-canônico de fechamento (doc-sessão + débitos + CONTROLE +
  frase comandante + merge `--no-ff`).
- 4 reviewers paralelos pós-implementação + re-review orquestrador.

## Frase comandante pra próxima sessão Code

```
FAXINA CONTÁBIL DO TOKEN — Fase A/B FECHADA (risco fiscal IMEDIATO
resolvido). Convênio cooperativizado FUNCIONALMENTE COMPLETO + faxina
contábil neutralizando armadilha tributária.

PRÓXIMO — escolha do orquestrador entre:

(A) Sprint HARDENING LATERAL (~10-14h) — pré-requisito Camada 3 funil +
2º parceiro real. Fecha 4 P1 M45 + 2 P2 M46 + 2 P2 M47 + 1 P1 M48
(lead-expansao spoof anônimo 3ª ocorrência) + IDORs do inventário.
Decisão pré-existente do M49.

(B) Sprint Faxina Fases C-G (~12-18h) — melt/painel/reconciliação.
   C: ligar classificação ato-cooperativo (Convenio.naturezaAtoCooperativo)
   D: reconciliação + investigar delta -729.86 (D-novo-FUNDACAO-DELTA)
   E: painel admin de Passivo/Forecast
   F: receita de melt (taxa QR + spread + quebra) — gated parecer Walter
   G: $transaction nos pares D+C (fix D-novo-FAXINA-PARTIDAS-NAO-ATOMICAS)

GATED inegociável: receita real de melt OFF até parecer Walter +
tributarista (estrutura pronta + flag OFF). Confirmado pelo
cooperebr-analista-conformidade na M50.

LER PRIMEIRO:
- docs/sessoes/2026-06-22-m50-sprint-faxina-contabil-token.md (estado pós-M50)
- docs/ESPEC-FAXINA-CONTABIL-TOKEN-2026-06-22.md (modelo canônico)
- docs/debitos-tecnicos.md (débitos M50 + lateral M45/M46/M47/M48)
```
