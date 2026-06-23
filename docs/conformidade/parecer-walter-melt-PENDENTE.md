# Parecer Walter — Melt de Voucher Não-Resgatado (CoopereBR)

**Status:** PLACEHOLDER — aguardando entrega do parecer técnico assinado.

**Data prevista:** TBD (catalogado em Sprint M52a — Faxina Contábil C-G, 23/06/2026).

**Autor previsto:** Dr. Walter — contador externo cooperativo de referência da CoopereBR.

---

## Por que este parecer existe

A faxina contábil em curso (M52a → M52b) implementa, no SISGD, o modelo
canônico **voucher CPC 47 + ato cooperativo Lei 5.764/71 Art. 79** pro
CooperToken. Nele:

- Emissão = **D Custo/Despesa / C Passivo 2.3.01 — Tokens a Resgatar**
  (bonificação) ou **D Caixa / C Passivo 2.3.01** (ingresso pago).
- Resgate na fatura / PIX-out / pagamento QR = **D Passivo 2.3.01 / C Caixa
  ou Receita**.
- **Melt** (expiração ou queima por inatividade) = **D Passivo 2.3.01 /
  C Receita 1.2.02 — Tokens Expirados** (face) **+ spread se aplicável**.

O parecer Walter atua **no item 3 (melt)**. Pendências objetivas:

1. **Critério temporal de melt** — Lei 5.764/71 não fixa prazo; CPC 47 cita
   "expectativa razoável" do passivo virar saída. Walter precisa fixar
   janela operacional defensável (12 meses? 24? alinhada à expiração
   técnica do token?).
2. **Documentação de quebra** — ata de assembleia / política da cooperativa /
   comunicação prévia ao cooperado antes da queima (LGPD + boa-fé
   cooperativa).
3. **Natureza tributária da receita de quebra**:
   - PROPRIO (Art. 79): isento PIS/COFINS+IRPJ se token foi bonificado a
     cooperado ATIVO (ato cooperativo típico — nossa hipótese default).
   - AUXILIAR (Art. 88): incide PIS/COFINS sobre o spread quando a quebra
     decorre de operação convênio.
   - NAO_COOPERATIVO (Art. 86-87): tributação plena se origem era
     `SOCIAL` com `naturezaAtoOverride='NAO_COOPERATIVO'`.
4. **Mecânica do lançamento** — confirmar se 1.2.02 é a conta certa ou se
   exige sub-conta segregada por natureza (4 contas se for o caso).
5. **Risco de autuação** — opinião sobre janela conservadora vs. agressiva
   pra fechar M52b (Fase F do split, hoje desligada).

## O que JÁ está pronto no SISGD (não bloqueia o parecer)

- Schema: `CooperTokenLedger.tipo` enum tem `EXPIRACAO` e `OXIDACAO`.
  `LancamentoCaixa.naturezaCooperativa` filia o lançamento ao Art. correto.
- Service: `TokenContabilService.lancarExpiracao` já existe e está usado
  pelo cron mensal `aplicarOxidacaoMensal` (dia 1, 03:00) — gated por
  `OXIDACAO_PRODUCAO_LIBERADA=true` no `.env` (não-default em prod) até
  este parecer chegar.
- Painel: aba "Passivo & Forecast" (M52a Bloco E) mostra forecast
  30/60/90/365 dias — direto pro debate de janela.

## O que está DESLIGADO em prod aguardando o parecer

- **M52b Fase F (melt)** — `lancarMelt` não existe ainda; gate técnico
  `OXIDACAO_PRODUCAO_LIBERADA != true` mantém o cron silencioso (vide
  `cooper-token.job.ts:200-205`).
- Política de comunicação ao cooperado antes da queima (texto + canal +
  prazo de aviso).

## Quando Walter entregar

1. Substituir este arquivo por `parecer-walter-melt-AAAA-MM-DD.md` (data
   real do parecer).
2. Atualizar `CLAUDE.md` se o critério temporal exigir mudança de
   `tokenExpiracaoMeses` default (hoje 12).
3. Abrir sprint M52b dedicada (split aprovado pelo orquestrador 23/06).
4. Catalogar memória persistente
   `~/.claude/projects/.../memory/decisao_modelo_melt_walter.md` com
   resumo executivo (3-5 linhas) pra próximas sessões.

---

## Catalogação

- Sprint: **M52a — Sprint Faxina Contábil do Token Fases C-G** (23/06/2026)
- Débito relacionado: **D-novo-FAXINA-MELT-PARECER** (P1 — bloqueia M52b)
- Reviewer-conformidade que pediu: `cooperebr-analista-conformidade` (split
  aprovado pelo orquestrador na Fase 1)
- Próxima ação: Luciano solicita ao Walter (canal pessoal) usando este
  placeholder como TOR.
