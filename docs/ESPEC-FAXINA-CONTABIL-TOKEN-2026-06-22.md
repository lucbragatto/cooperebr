# Espec — Faxina Contábil do Token (re-alinhar ao modelo voucher + ato cooperativo)

> **Disciplina aplicada (correção do Luciano 22/06):** modelo canônico PRIMEIRO, código depois.
> Base: `FUNDACAO-COOPERTOKEN-MODELO-CANONICO.md` (04/06) + check-in 22/06
> (`docs/relatorios/checkin-integracao-token-clube-2026-06-22.md`).
> **Pré-requisito da operação com dinheiro real** (saque/resgate em produção). NÃO bloqueia o que já foi construído.

## 1. MODELO CANÔNICO (o "como deveria ser" — 4 lentes)

**O token é um VOUCHER de circuito fechado (CPC 47) emitido por uma COOPERATIVA, e o dinheiro que
o financia é ATO COOPERATIVO (Lei 5.764).** Consequências:

- O token **NÃO é mercadoria vendida.** O dinheiro que entra é **passivo diferido** (a cooperativa
  vai honrar o token), não receita. E, sendo **ingresso de custeio** de cooperado, é **ato cooperativo
  (Próprio Art. 79 / Auxiliar Art. 88 — ISENTO)**. ⚠️ **"Venda / Receita de Venda" é armadilha tributária.**
- **A receita da cooperativa = o "derretimento" (melt)**, nunca a emissão: taxa de circulação + haircut
  de saída + quebra (oxidação/expiração). Velocidade = receita.
- **Invariante (FUNDACAO §4#1):** `Passivo "Tokens a Resgatar" == Σ saldos × valorFace`, sempre.

### Lançamento canônico por operação

| Operação | Lançamento CORRETO | Natureza fiscal |
|---|---|---|
| **Ingresso/Emissão paga** (empresa/conveniado paga por tokens) | **D Caixa / C Passivo "Tokens a Resgatar"** | Ato cooperativo (Ingresso de custeio, Próprio/Auxiliar — ISENTO). **NÃO receita.** |
| **Emissão bonificação** (admin dá token sem dinheiro) | D Despesa Bonificação / C Passivo | Despesa da coop (doação de benefício); ato cooperativo |
| **Distribuição** (empresa → funcionários) | sem caixa/receita; o passivo só **muda de titular** (sub-razão por holder) | Ato cooperativo |
| **Abate na fatura** (uso) | **D Passivo / C** (abate da fatura) `+` haircut→Receita (se >0) | Queima — baixa passivo |
| **Resgate PIX** (estabelecimento/colaborador) | **D Passivo / C Caixa** `+` (face − líquido)→**Receita Spread** | Saída — baixa passivo; o haircut é melt=receita |
| **Transferência QR** (entre cooperados) | passivo muda titular; **taxa circulação → D Passivo / C Receita** | Melt (taxa = receita) |
| **Oxidação** (quebra do parado) | **D Passivo / C Receita "Quebra Oxidação"** | Melt (breakage = receita) |
| **Expiração** (quebra total) | **D Passivo / C Receita "Tokens Expirados"** | Melt (breakage = receita) |

**Receita total da coop = Σ (taxas de circulação + spreads de saída + quebras).** A entrada de dinheiro
do token é SEMPRE trânsito/passivo, nunca receita.

### Naming canônico
- A operação da tela = **emissão** de tokens, financiada por **ingresso de custeio**. Evitar "venda/compra/receita de venda".
- Conta de saída em R$ pro parceiro = **resgate/liquidação de voucher** (recibo), não "recompra/venda".

## 1.1 Validação de conformidade (22/06 — `cooperebr-analista-conformidade`)
**Veredito: modelo CORRETO, sem erro material de direito.** Refinamentos:
- ✅ **Ingresso = Passivo (não Receita Venda) — CONFIRMADO P0.** Lei 5.764/71 Art. 79 **parágrafo único** ("o ato cooperativo NÃO implica operação de mercado nem contrato de compra e venda") + CPC 47 itens 22-38. A conta `1.2.01 Receita Venda Tokens` é armadilha tributária **a remover**.
- ✅ **Receita só no melt — CORRETO na estrutura** (CPC 47 item 56 breakage). **⚠️ Qualificação fiscal:** o tratamento do melt depende de QUEM é o contraparte — cooperado associado = ato cooperativo isento; não-cooperado = receita tributável. Cada perna (spread, quebra, taxa QR) precisa de parecer externo.
- ✅ **Classificação ato-cooperativo governa o contábil — CONFIRMADO (gap real).** Segregação por natureza:

  | Perna | Natureza | naturezaAto |
  |---|---|---|
  | Ingresso custeio (empresa paga) | Próprio se cooperado / Auxiliar se convênio custeio | PROPRIO ou AUXILIAR |
  | Abate na fatura | Próprio (uso do ato) | PROPRIO |
  | Resgate PIX estabelecimento COOPERADO | Próprio | PROPRIO |
  | Resgate PIX estabelecimento NÃO-cooperado | Não-cooperativo | NAO_COOPERATIVO (tributar spread) |
  | Taxa QR / quebra | Próprio (provisório — confirmar tributarista) | PROPRIO |

- **Correção de fundamentação (importante):** o **STF Tema 536 foi JULGADO em 2017** (tese consolidada de isenção PIS/COFINS sobre ato cooperativo TÍPICO). O que está aberto é a **extensão a modalidades novas (tokens)** — sem precedente específico → exige documentação robusta da natureza cooperativa de cada perna. **NÃO citar STJ Tema 986 (TUSD/ICMS energia) como base do token — é argumento equivocado** (corrigir na FUNDACAO).
- **Auxiliar→Próprio:** a promoção deve ser **DOCUMENTAL** (o pagador é associado formal — ficha/joia/voto), não discricionária do admin.
- 🔴 **Validação externa OBRIGATÓRIA antes de dinheiro real:** **contador Walter** (tratamento do melt por perna + critério Auxiliar/Próprio + parecer Tema 536 aplicado a tokens) + **tributarista cooperativo** (quebra por oxidação = sobra isenta ou ganho tributável?). **As Fases A/B desativam o risco fiscal IMEDIATO** (tirar a Receita Venda); o **melt/oxidação aguardam o parecer externo** antes de ligar em produção.

## 2. CÓDIGO × CANÔNICO (os desvios = a faxina)

| # | Desvio hoje | file:line | Correção |
|---|---|---|---|
| A | Compra de token credita **`1.2.01 Receita Venda Tokens`** (receita tributável) | `token-contabil.service.ts:41,124` | Trocar p/ **C Passivo**; remover/aposentar a conta "Receita Venda" |
| B | `processarPagamentoCompraPj` debita **Custo** em vez de Caixa | `cooper-token.service.ts:4810` → `lancarEmissaoFaturaCheia` | **D Caixa / C Passivo** |
| C | **Oxidação** sem lançamento de quebra | `cooper-token.service.ts:3477` | emitir evento + **D Passivo / C Receita Quebra** |
| D | **Transferência QR** sem caixa/contábil; **taxa evapora** | `cooper-token.service.ts:3651,3733` | passivo muda titular + **taxa → D Passivo / C Receita** |
| E | Conta **5.1.02 tipada `DESPESA`** (deveria PASSIVO) | `token-contabil.service.ts:36` | corrigir tipo (auditar balanço) |
| F | Classificação **ato-cooperativo (Próprio/Auxiliar/Ingresso)** do convênio NÃO chega ao contábil de token | `contabilidade-tributaria/` ↔ `token-contabil` desconectados | ligar: o lançamento de token lê a `Natureza`/`Fluxo` do convênio |
| G | **Delta ~-730 tokens** (Σ saldos ≠ Σ ledger no tenant CoopereBR) | `D-novo-FUNDACAO-DELTA-COOPEREBR` | investigar a fonte (seed/migração antiga) + reconciliar |

## 3. PAINEL ADMIN — Passivo / Controle de Resgate (requisito Luciano 22/06)
O admin precisa **ver e prever o que a cooperativa deve em token**:
- **Passivo total** "Tokens a Resgatar" (= Σ saldos vivos × face = quanto a coop terá de honrar).
- **Por holder** (a quem): cooperados PF, PJ, estabelecimentos — quem segura quanto.
- **Forecast de resgate / exposição:** quanto pode virar saque PIX (sacável) vs só-abate; tokens perto de expirar.
- **Reconciliação:** alerta quando `Σ saldos ≠ Σ ledger ≠ Passivo contábil` (teria pego o delta -730 antes).
- Base: já existe dashboard `cooper-token-financeiro` (fluxo + economia) — ESTENDER com a visão de passivo/forecast.

## 4. Fasing / escopo (Fase 1 read-only do Code vai refinar)
- **Fase A — Modelo + contas:** corrigir tipo 5.1.02; aposentar "Receita Venda"; criar contas de Receita de
  melt (Quebra, Spread, Taxa Circulação). Validar com `cooperebr-analista-conformidade`.
- **Fase B — Re-alinhar lançamentos:** A/B (ingresso→Passivo), C (oxidação), D (QR+taxa).
- **Fase C — Ligar classificação ato-cooperativo** (F): o token consulta `Natureza/Fluxo` do convênio.
- **Fase D — Reconciliação + delta -730** (G): cron/relatório de reconciliação + investigar a fonte.
- **Fase E — Painel admin** de Passivo/Resgate (estender `cooper-token-financeiro`).
- **Reviewers OBRIGATÓRIOS:** `cooperebr-analista-conformidade` (ato cooperativo/STF536/CPC47) +
  `cooperebr-financeiro-token-reviewer` (invariante) + multitenant + code. Re-review orquestrador. Smoke real.

## 5. Decisões pendentes (Luciano)
1. **Reconhecimento de receita do melt:** ligar haircut/spread no resgate agora (`taxaResgate>0`), ou só
   estruturar o lançamento e manter taxa=0 até decisão comercial (D3 preço custo×venda)?
2. **Delta -730:** corrigir agora (reconciliação cirúrgica) ou investigar a fonte primeiro?
3. **Painel de passivo:** estender o `cooper-token-financeiro` existente, ou tela nova dedicada?
4. **Classificação default:** todo convênio nasce "Auxiliar" (neutro) e o admin promove p/ "Próprio" caso a caso?

---
*Spec de design — modelo canônico derivado primeiro (disciplina 16/06 + correção 22/06). Conformidade valida o
modelo antes do build.*
