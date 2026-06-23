# Sessão 2026-06-23 — M52a: Faxina Contábil do Token (Fases C-G — integridade)

> **Fechamento feito pelo orquestrador** (Code teve API Error 500 persistente no passo de merge;
> orquestrador landou via git pra não perder a sprint inteira não-commitada). Código 100% re-revisado +
> 4 reviewers aprovados antes do merge.

## TL;DR (pra leigo)
Arrumamos a contabilidade do token pra os livros baterem. O "furo de ~730 tokens" que assustou era
**95% falso-positivo** de um bug de cálculo (ignorava tokens pendentes/bloqueados) — o furo real era só
**+259** (2 cadastros antigos com crédito faltando: LUCIANO +49 e AMAGES +210), e foi corrigido. Também
entregamos o **painel de passivo** (o admin agora vê quanto a cooperativa deve em token e pra quem), a
**classificação fiscal** (Próprio/Auxiliar/Não-Coop) no contábil, e a **atomicidade** dos lançamentos.

## Entregas + SHAs
- `b57246a` feat M52a (16 arquivos) → `83a507c` merge --no-ff na main. Branch `feature/faxina-contabil-fase-c-g`
  preservada.
- **Bloco G** — pares D+C contábeis em `prisma.$transaction` (atomicidade; sem half-entry).
- **Bloco D** — reconciliação histórica + cron diário + endpoint admin de trigger.
- **Bloco C** — classificação ato-cooperativo (Próprio/Auxiliar) wirada no contábil (lê `ContratoConvenio.
  naturezaAtoCooperativo`); SOCIAL guard (cooperado-only por default).
- **Bloco E** — painel "Passivo & Forecast" (endpoint `passivo-detalhado` + aba no `cooper-token-financeiro`).
- **Fix estrutural** — `quantidade` sempre positiva no ledger (direção via DEBITO/CREDITO).

## A saga da reconciliação (lição importante)
1. **v1 estava CORROMPIDA** — comparava `Σ ledger` contra `saldoDisponivel` só, mas o ledger reflete o
   TOTAL (disp+pend+bloqueado). Tratou AGOSTINHO (6,86 pendente) e LEONARDO (980 pendente) como anômalos e
   aplicou DEBITOS errados; sub-corrigiu AMAGES (ignorou 10 bloqueado). Reviewers (financeiro-token + code)
   pegaram pós-apply.
2. **v1 REVERTIDA** — 4 lançamentos deletados (orquestrador verificou: 0 RECONCILIACAO no banco).
3. **3 bugs de cálculo corrigidos:** (a) ancorar no saldo TOTAL; (b) switch exaustivo `sinalDaOperacao`
   (sem `else` cego que subtraía créditos); (c) perna C Passivo vira `MUTACAO_PASSIVO` (fora da DRE —
   não é receita).
4. **v2 CORRETA aplicada** — só LUCIANO +49 + AMAGES +210 (orquestrador derivou de primeiros princípios e
   bateu 100%). Invariante ledger↔saldo = 0, anômalos = 0.

## Reviewers (4, todos aprovaram v2)
- code-reviewer APPROVED (4 HIGH resolvidos). financeiro-token OK (2 P1 + 1 P1-novo do DRE resolvidos).
  conformidade OK+2 parcial. multitenant APPROVED.

## Débitos novos / follow-ups (M52b ou Walter)
- **D-novo-FAXINA-MELT-F** P1 — Bloco F (melt: oxidação→quebra, QR→taxa, resgate→spread) é o M52b.
- **D-novo-FAXINA-BENEFICIO-CONVENIO-ART79-88** P1 — default AUXILIAR vs PRÓPRIO precisa parecer Walter.
- **D-novo-FAXINA-CONTABIL-LEDGER-ALIGN** P1 (levantado pelo orquestrador) — a reconciliação foi LEDGER-only;
  confirmar se o Passivo contábil 2.3.01 alinha com o saldo (FUNDACAO §4#1 é contábil↔saldo) ou se há resíduo;
  o cron deve monitorar AMBOS (ledger↔saldo E contábil↔saldo).
- **D-novo-FAXINA-SOFT-DELETE** P1 mod — reversão usou DELETE físico; contábil deveria ser soft-delete
  (auditoria) → M52b (exige schema).
- P2/P3: N+1 no cron (307 findMany); PROVISIONAL fora da $transaction; arredondamento Decimal(10,4);
  override NAO_COOPERATIVO sem AuditLog persistido; creditar-manual SA sem @AuditLog (pré-existente).

## Pendências / próximo passo
- **M52b** — Bloco F (melt) + os follow-ups acima. O melt agora CONSTRÓI + fica pronto (contábil favorável
  per Luciano 23/06); a % da taxa é config que o Luciano liga. **Parecer escrito do Walter** vai em
  `docs/conformidade/parecer-walter-melt-*.md` (placeholder criado).
- Itens "antes de expor": as **3 portas de config** (AMBIENTE_REAL/segredo/senha) seguem o único bloqueador
  de exposição (tenant-spoof fechado em M51).
- **Próximo passo único:** Luciano escolhe entre M52b (melt), vitrines do funil, ou as 3 portas de config
  pra expor. Code voltando da 500, re-rodar `pm2 list` + sanity (M52a JÁ mergeado, não re-aplicar).
