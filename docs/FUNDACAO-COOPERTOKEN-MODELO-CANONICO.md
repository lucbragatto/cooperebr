# Fundação CooperToken — Modelo Canônico (4 lentes)

> **Documento-fundação.** Pré-requisito de leitura para **qualquer** sprint que toque token
> (emissão, compra, distribuição, uso, resgate, oxidação, contábil, notificação).
> Fixa o **"como deveria ser"** (modelo canônico) para que a construção se **meça contra ele**,
> em vez de remendar o "que falta".
>
> **Data:** 2026-06-16 · **Base:** 4 leitores profundos sobre o `main` (5283 linhas de
> `cooper-token.service.ts`) + reconciliação com o modelo de voucher esclarecido por Luciano.
> **Validação fiscal de cada perna:** `cooperebr-analista-conformidade` (CPC 47 + ato cooperativo).

---

## 0. Como usar este documento

1. Antes de codar **qualquer** perna do circuito, ache a perna na **Seção 3** (mapa), confirme o
   **lançamento canônico** da Seção 2.1 e implemente medindo-se contra ele.
2. Toda mudança que toque saldo/dinheiro respeita os **invariantes da Seção 4**.
3. A **ordem de construção** (Seção 5) é derivada do modelo, não da pressa.

---

## 1. O que JÁ EXISTE — inventário para NÃO refazer (verificado no `main`)

| Peça | Onde (`arquivo:linha`) | Estado |
|---|---|---|
| Primitivo de crédito | `cooper-token.service.ts:168` `creditar()` (emite `EMITIDO`; PROVISIONAL `:313/:410`) | ✅ |
| Emissão admin em lote (M39) | `:4696` `emitirLoteAdmin` → contábil `token-contabil.service.ts:238` `lancarEmissaoAdminLote` (D 5.1.03 / C 5.1.02) | ✅ destinatário só cooperado; sem custo input |
| Emissão manual single | controller `:90` `creditar-manual` (taxa 2%) | ✅ legado-vivo |
| Compra pelo conveniado (F2) | `:4030` `comprarTokensCooperado` → Asaas (+5d) → `:4179` `processarPagamentoCompraPj` (3 camadas idempotência + `PAGO_CREDITO_PENDENTE`) | ✅ robusto; **contábil errado** (ver §3) |
| Compra do parceiro/tenant (legado) | `:4291` `comprarTokensParceiro` + `confirmarCompraParceiro` (manual; `COMPRA_PARCEIRO_PAGO`) | ✅ |
| Distribuição empresa→funcionário (F3) | `:1323` `distribuirTokens` (PIN + natureza CLT; todos os modos %/valor/alguns) | ✅ função; **sem contábil/segregação** |
| Uso na própria fatura | `:3726` `usarNaFatura` (PROVISIONAL + `RESGATADO`→`lancarResgateFatura`) | ✅ |
| Pagamento QR (cooperado→parceiro/estab) | `~:3380` `processarPagamentoQr` (ledger; emite `transferencia-qr` **sem listener**) | ✅ movimento; ⚠️ notificação morta |
| Resgate PIX do estabelecimento (F6) | `:1986` `solicitarResgate` (guard `ehEstabelecimento` `~:2031`) + `:2226` `aprovarResgate` + `:2434` `processarWebhookResgate` | ✅ fluxo; **sem caixa** (ver §3) |
| Oxidação / decaimento de valor | `:3006` `aplicarOxidacao` + cron `aplicarOxidacaoMensal` + gate `OXIDACAO_PRODUCAO_LIBERADA` | ✅ máquina; **sem contábil** |
| Expiração | `:627` `expirarVencidos` (`EXPIRADO`→`lancarExpiracao` D 5.1.02 / C 1.2.02) | ✅ |
| Config da economia | `ConfigCooperToken`: `valorTokenReais`, taxas, `modeloVida`, `oxidacaoPercMes/PeriodoGraca/Piso/AtivadaEm` | ✅ |
| Motor contábil | `token-contabil.service.ts` (6 templates) + `financeiro-token.listener.ts` (**só 4 eventos ligados**) | ⚠️ parcial |
| Notificações | `token-notificacao.service.ts` (`notificarPagador/recebedor` + OTP email) | ⚠️ **existe e testado, mas órfão** (0 callers em runtime) |

**Conclusão do inventário:** o esqueleto está construído. A maior parte do trabalho restante é
**ligar e corrigir** (contábil + notificação), não criar do zero.

---

## 2. O modelo canônico — 4 lentes

### 2.1 Contador / financista — token É receita diferida (CPC 47, modelo vale-presente)

O token **não é venda** quando emitido; é um **passivo** (obrigação de honrar valor de face).
A receita só nasce na **saída** (resgate com spread) ou na **quebra** (oxidação/expiração).

| Perna do ciclo | Lançamento canônico |
|---|---|
| **Empresa compra (paga R$)** | `D Caixa / C Passivo "Tokens a Resgatar"` — pelo valor de **face**. Zero receita. |
| **Circulação** (cooperado→parceiro→parceiro) | Só **memorando/ledger** — o passivo troca de dono. Sem P&L, sem caixa. |
| **Resgate via abate de energia** (parceiro) | `D Passivo / C (reduz receita de energia)` — a coop fatura menos e baixa o passivo. |
| **Resgate via PIX** (estabelecimento) | `D Passivo / C Caixa`. Se pagar **abaixo do face**, o spread = `C Receita de Resgate`. |
| **Quebra** (oxidação/expiração) | `D Passivo / C Receita de Quebra`. **É a margem estrutural que mantém o clube.** |

**Reconhecimento de receita:** diferido na venda; reconhecido no resgate (spread) + na quebra.
**Onde o clube ganha:** float (passivo em aberto = giro sem juros) + spread + quebra. O valor de
face é **trânsito**.

### 2.2 Engenheiro de sistemas / DBA sênior — a arquitetura que GARANTE o modelo

- **Invariante mestre:** `Passivo "Tokens a Resgatar" == Σ(saldos em circulação × face)`, **sempre**.
  Um job de reconciliação diário deve afirmar a igualdade e alertar no desvio. Isso detecta
  **automaticamente** qualquer perna não-lançada (em vez de descobrir num audit meses depois).
- **Mapeamento exaustivo evento→lançamento:** todo método que mexe saldo emite um **evento tipado**;
  um enum fechado `TokenEconomicEvent` + função **total** evento→lançamento faz o compilador
  **obrigar** regra contábil pra cada evento. Hoje o listener cobre 4 de N → os buracos são
  estruturais, não pontuais.
- **Ledger = fonte da verdade** (append-only, imutável); **contábil = projeção determinística** do
  ledger. Nunca podem divergir.
- **Plano de contas tipado** no domínio (PASSIVO/RECEITA/DESPESA) — impede o bug "conta 5.1.02
  tipada DESPESA".

### 2.3 Negócios / comércio — é um negócio de FLOAT

- A cooperativa é uma **câmara de compensação** rodando uma moeda de circuito fechado. Receita =
  **quebra + spread**; o float é capital de giro grátis (modelo gift-card: Starbucks ganha ~US$150M/ano
  só de breakage).
- **Oxidação = alavanca dupla:** financia o clube (breakage) **e** acelera o uso (gasta antes de
  desvalorizar → mais transações nos estabelecimentos → clube mais pegajoso).
- **Tensão da taxa de decaimento:** alta demais → membro se sente roubado → churn + risco
  reputacional/regulatório; baixa demais → clube subfinanciado. Período de graça + piso + prospectivo
  (**já no código**) são a trava de justiça que segura essa tensão.
- **Mercado de dois lados:** membros (demanda) × estabelecimentos (oferta); a quebra alimenta as
  recompensas dos membros.

### 2.4 Fiscal — tributa só spread + quebra

- Valor de face = **trânsito** (não tributável). Margem tributável = **spread de resgate + quebra**.
- **Ato cooperativo** (Lei 5.764/71 Art. 79) protege a parcela cooperativa; **STF Tema 536** (isenção
  ato cooperativo) em julgamento — monitorar. Cada perna precisa de **parecer do
  `cooperebr-analista-conformidade`** antes de ir a produção real.

---

## 3. Mapa: existente → canônico → desvio (os débitos com carimbo certo)

| Evento | Hoje | Canônico | Desvio | Sev |
|---|---|---|---|---|
| Empresa compra (paga R$) | lança "desconto concedido" (D 5.1.01) | `D Caixa / C Passivo` | receita some, passivo infla | 🔴 P1 |
| Resgate PIX estabelecimento | **nenhum** lançamento | `D Passivo / C Caixa` (+spread=receita) | saída de caixa invisível | 🔴 P1 |
| Parceiro abate energia | a confirmar | `D Passivo / C (reduz receita energia)` | provável sem baixa | 🔴 P2 |
| Oxidação / quebra | **nenhum** lançamento | `D Passivo / C Receita de Quebra` | **a receita do clube some** | 🔴 P2 |
| Distribuição empresa→funcionário | só ledger | movimento + **segregação Art. 87** | falta na contabilidade de controle | 🟡 P2 |
| Cooperado gasta no parceiro (QR) | ledger DEBITO/CREDITO | só movimento (sem caixa) | **correto** (não é gap) | ✅ |
| conta 5.1.02 | tipada DESPESA | tipo PASSIVO | tipo errado | 🟡 P2 |
| Notificações (8 passos) | 0/8 disparam | email+WA em cada perna | `TokenNotificacaoService` órfão | 🟡 P2 |

---

## 4. Invariantes inegociáveis (o sistema DEVE garantir)

1. `Passivo "Tokens a Resgatar" == Σ saldos em circulação × face` — reconciliação diária + alerta.
2. Todo método que altera saldo **emite evento tipado**; mapeamento evento→lançamento é **total**.
3. **Ledger imutável = fonte**; contábil = projeção determinística (nunca divergem).
4. Valor de **face é trânsito**; só **spread + quebra** são margem/tributável.
5. Oxidação só em produção com `OXIDACAO_PRODUCAO_LIBERADA=true` **após política de quebra escrita +
   auditada** + comunicação transparente (curva no portal + WhatsApp avisa antes).

---

## 5. Ordem de construção derivada do modelo (Sprint Circuito de Emissão Completo)

1. **Contábil canônico** — corrigir os 4 lançamentos (compra=D Caixa/C Passivo · resgate PIX=D
   Passivo/C Caixa · abate energia · oxidação=quebra) + tipar a 5.1.02 + o job de reconciliação do
   invariante #1. **Passa pelo `analista-conformidade` ANTES de codar.**
2. **Notificações** — ligar o `TokenNotificacaoService` (já pronto) nos 8 passos via listener.
3. **Emissão unificada** — seletor de destinatário (cooperado/conveniado-PJ/coopere/parceiro) +
   custo por emissão + página única (config+emitir+histórico) + portão de permissão + `convenioId`.
4. **Compra do conveniado + auto-distribuição** — tela `/portal/comprar-tokens` (hoje 404) + plano de
   distribuição pré-configurado no pedido (PIN no pedido) que dispara no pagamento.

> **Regra de ouro do método:** cada perna nasce medindo-se contra a Seção 2.1, não remendando depois.
