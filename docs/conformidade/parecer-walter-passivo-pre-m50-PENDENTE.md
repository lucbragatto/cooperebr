# Parecer Walter — Passivo Histórico Pré-M50 (CoopereBR)

**Status:** PLACEHOLDER — aguardando entrega do parecer técnico assinado.

**Data prevista:** TBD (catalogado em Sprint M52b — Faxina Contábil Bloco F + Resíduo, 23/06/2026).

**Autor previsto:** Dr. Walter — contador externo cooperativo de referência da CoopereBR.

---

## Por que este parecer existe

A faxina contábil M52a v2 alinhou o invariante **LEDGER↔SALDO** (Σ saldoTotal = Σ ledger = 0) via reconciliação APPEND-ONLY (LUCIANO +49 + AMAGES +210 tokens = R$ 116,55).

Pós-merge, a medição do invariante **CONTÁBIL↔SALDO** (FUNDACAO §4#1 — Passivo 2.3.01 == Σ saldo × face) revelou um resíduo total de **R$ 858,34** no tenant CoopereBR:

| Item | Valor |
|---|---|
| Σ saldoTotal face | 2.114,32 tokens |
| valorTokenReais | R$ 0,45 |
| **Passivo ESPERADO** | **R$ 951,44** |
| Passivo CONTÁBIL atual | R$ 93,10 (13 lançamentos 2.3.01) |
| **RESÍDUO total** | **R$ 858,34** (≈ 90% do esperado) |

A Fatia 2 do M52b escritura **R$ 116,55** (espelho contábil dos +259 da reconciliação v2 — `lancarAjusteReconciliacao`). Sobra **~R$ 741,79** de passivo histórico pré-M50 não-escriturado.

## Causa-raiz do passivo pré-M50

Histórico de emissões de tokens via `cooper-token.service.ts:creditar()` **antes da Sprint M50 (22/06/2026)** que NÃO disparavam o listener contábil:

1. Cooperados ativos receberam tokens via `GERACAO_EXCEDENTE`, `BONUS_INDICACAO`, `FATURA_CHEIA`, `FLEX` em meses/anos anteriores
2. O ledger (`CooperTokenLedger`) foi gravado corretamente, atualizando saldo
3. **NENHUM `LancamentoCaixa` foi criado** (pre-modelo voucher CPC 47 — a faxina M50 introduziu `lancarEmissao*`)

Hoje, esses cooperados têm saldo "real" mas o passivo contábil 2.3.01 **subestima a obrigação** da cooperativa em ~R$ 741.

## Pendências objetivas pro Walter

1. **Reconhecimento retrospectivo de erro vs lançamento de abertura de balanço:**
   - NBC TG 1000 item 10.6: erro de período anterior → reapresentar comparativos retrospectivamente.
   - Alternativa: lançamento único "abertura de balanço M50" debitando uma conta de patrimônio/lucros acumulados anteriores E creditando 2.3.01 pelo passivo histórico líquido.
   - Qual abordagem é mais defensável pra cooperativa em DRE atual + auditoria?

2. **Natureza tributária do ajuste:**
   - Se reconhecido como erro retrospectivo de exercícios encerrados (já tributados), o ajuste não gera novo fato gerador.
   - Se lançado como "abertura de balanço M50", precisa documentar que NÃO é receita.
   - Cooperativa é isenta PIS/COFINS no ato cooperativo (STF Tema 536), mas o lançamento contábil precisa ser correto pra defesa em fiscalização.

3. **Critério temporal:**
   - Os tokens pré-M50 expiram em janelas de 12 meses (default `tokenExpiracaoMeses`). Parte do passivo pode "evaporar" via `lancarExpiracao` (M52a já wirada) antes do ajuste retrospectivo ser feito — Walter precisa decidir se vale a pena escriturar tudo agora ou esperar o decay natural.

4. **Cooperados inativos:**
   - Tokens em saldo de cooperados DESLIGADOS/SUSPENSOS/INATIVOS estão dentro dos R$ 741? Esses não voltam pra circulação — devem ir pra receita de quebra ou ficar como passivo até decisão de baixa?

5. **Documentação interna:**
   - Ata de assembleia ou política da cooperativa registrando a regularização contábil retrospectiva (boa-fé cooperativa + transparência com cooperados).

## O que JÁ está pronto no SISGD (não bloqueia o parecer)

- **Cron `reconciliarInvariantesContabil`** (M52b Fatia 2) já mede e reporta o resíduo diário, **descontando o baseline pré-M50** documentado em `BASELINES_CONTABIL_PRE_M50` (`backend/src/cooper-token/cooper-token.ledger-utils.ts`). Quando Walter responder, o baseline cai pra zero (ou valor de transição) — ajuste no código + commit + reviewer.
- **Script `aplicar-ajuste-reconciliacao-v2.ts`** (M52b Fatia 2) — modelo de aplicação de ajuste contábil idempotente. Pode ser estendido pra escriturar o pré-M50 quando Walter aprovar (provavelmente exige novo `origemTipo` no enum + novo método em `token-contabil.service.ts`).
- **Painel "Passivo & Forecast"** (M52a Bloco E) — admin já vê o passivo contábil atual e o forecast. Após decisão Walter, mostrar também o ajuste retrospectivo.

## O que está DESLIGADO em prod aguardando o parecer

- Escrituração dos ~R$ 741 pré-M50 — **NÃO escriturar sem parecer**. O baseline no `BASELINES_CONTABIL_PRE_M50` é a salvaguarda técnica: cron alerta só divergência NOVA além dele.

## Quando Walter entregar

1. Substituir este arquivo por `parecer-walter-passivo-pre-m50-AAAA-MM-DD.md` (data do parecer).
2. Decidir: (i) lançamento único de saneamento; OU (ii) escrituração mês-a-mês retrospectiva; OU (iii) outra abordagem.
3. Implementar em `token-contabil.service.ts` (provavelmente novo método `lancarAjusteRetrospectivoPreM50`) + script de aplicação espelhado ao `aplicar-ajuste-reconciliacao-v2.ts`.
4. Atualizar `BASELINES_CONTABIL_PRE_M50` pra zero (ou valor remanescente se a abordagem for parcial).
5. Catalogar memória persistente `~/.claude/projects/.../memory/decisao_passivo_pre_m50_walter.md` com resumo executivo (3-5 linhas).
6. Atualizar `CLAUDE.md` se a decisão exigir mudança de pipeline de emissão (provavelmente não — M50 já fixou).

---

## Catalogação

- Sprint: **M52b — Faxina Contábil Bloco F + Resíduo** (23/06/2026)
- Débito relacionado: **D-novo-FAXINA-PASSIVO-PRE-M50** (P1 — bloqueia escrituração completa)
- Reviewer-conformidade que pediu: `cooperebr-analista-conformidade` (apontou pós-M52a v2 na medição do invariante CONTÁBIL↔SALDO)
- Próxima ação: Luciano solicita ao Walter (canal pessoal) usando este placeholder como TOR — pode ser entregue junto com o parecer Walter Melt (`parecer-walter-melt-PENDENTE.md`) por economia de canal.
