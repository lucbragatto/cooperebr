# Check-in de Integração — CooperToken / Clube / PIX / Caixa / Contábil / Asaas (22/06/2026)

> Auditoria READ-ONLY pedida pelo Luciano. 3 frentes investigadas em paralelo no MAIN
> (`cooper-token.service.ts` = 5923 linhas, confirmado). Nada alterado.

## 1. Wiring token → Caixa / Contábil / Asaas

**Dois mecanismos de lançamento (raiz da confusão "não acho onde dá baixa"):**
- **`LancamentoCaixa` PROVISIONAL inline** — criado dentro do próprio método do token (`naturezaClube='PROVISIONAL_TOKEN_*'`, ligado ao ledger). Espelho de caixa.
- **Lançamento contábil definitivo (dupla-partida)** — feito pelo `TokenContabilService` (`financeiro/token-contabil.service.ts`), disparado por **evento** consumido pelo `FinanceiroTokenListener` (`financeiro/financeiro-token.listener.ts`). Eventos com listener contábil: **EMITIDO, RESGATADO, EXPIRADO, COMPRA_PARCEIRO_PAGO**.

| Operação | file:line | LancamentoCaixa | Contábil | Asaas | Veredito |
|---|---|---|---|---|---|
| Emissão genérica `creditar` | `cooper-token.service.ts:322` | ✅ inline :464 | ✅ EMITIDO→`lancarEmissaoFaturaCheia` D5.1.01/C5.1.02 | — | ✅ |
| Emissão admin lote `emitirLoteAdmin` | `:5336` | — | ✅ direto `lancarEmissaoAdminLote` D5.1.03/C5.1.02 :5599 | — | ✅ |
| **Abate na fatura** `usarNaFatura` | `:4197` | ✅ inline :4451 | ✅ RESGATADO→`lancarResgateFatura` D5.1.02 (baixa passivo) `token-contabil:152` | — | ✅ |
| Resgate PIX `solicitarResgate`/webhook | `:2169`/`:2793` | ✅ `lancarResgatePix` :2974 (fora da tx, idempotente) | ✅ idem | ✅ `AsaasPixOutService.transferir` :2623 + webhook | ✅ |
| **Transferência QR** `processarPagamentoQr` | `:3651` | ❌ | ❌ | — | 🔴 |
| Compra PJ inicia `comprarTokensCooperado` | `:4635` | só `CooperTokenCompra` | — | ✅ `emitirCobranca` :4729 | ✅ entrada |
| **Compra PJ confirma** `processarPagamentoCompraPj` | `:4810` | ✅ via `creditar` | ⚠️ template ERRADO (emissão, não venda) | ✅ webhook | 🟡 |
| Compra parceiro `confirmarCompraParceiro` | `:~5016` | — | ✅ `lancarCompraParceiroPago` D Caixa/C Receita 1.2.01 | — | ✅ |
| **Oxidação** `aplicarOxidacao` | `:3477` | ❌ | ❌ (passivo nunca baixado) | — | 🔴 (gate off) |
| Expiração | `:~820` | — | ✅ EXPIRADO→`lancarExpiracao` D5.1.02/C Receita 1.2.02 | — | ✅ |

### GAPS confirmados
- **🔴 GAP 1 — Oxidação sem lançamento de quebra.** `aplicarOxidacao:3477` decrementa saldo + grava ledger, mas NÃO emite evento / cria caixa / chama contábil. O passivo "Tokens a Resgatar" (5.1.02) infla na emissão e **nunca é baixado pela oxidação** → divergência ledger↔contábil permanente. Hoje contido pelo gate `OXIDACAO_PRODUCAO_LIBERADA != 'true'`.
- **🔴 GAP 2 — Transferência QR não registra nada + taxa evapora.** `processarPagamentoQr:3651` move saldo entre cooperados sem LancamentoCaixa nem contábil. Evento `cooper-token.transferencia-qr:3869` **sem nenhum listener**. A **taxa ~1%** (`:3733`) é debitada do pagador mas **não creditada/registrada em lugar nenhum** — some do supply sem virar receita.
- **🔴 GAP 3 (REVISADO 22/06 — correção do Luciano) — Compra de token viola o modelo voucher + ato cooperativo.** ⚠️ **Minha 1ª versão errou dizendo "deveria ser venda/receita". ERRADO.** O dinheiro do conveniado (cooperado PJ) é **Ingresso de custeio = ato cooperativo (Próprio Art.79 / Auxiliar Art.88 — ISENTO)**, e pelo modelo voucher (FUNDACAO) é **deferido em Passivo, NUNCA receita imediata**. Mas o código já trata como VENDA: `confirmarCompraParceiro`→`lancarCompraParceiroPago` credita **`1.2.01 Receita Venda Tokens`** (`token-contabil.service.ts:41,124`) — receita TRIBUTÁVEL, o oposto do ato cooperativo isento. E `processarPagamentoCompraPj`→`lancarEmissaoFaturaCheia` debita **Custo** em vez de Caixa. **Correto (ambos os caminhos):** D Caixa / C Passivo Tokens a Resgatar, classificado como ato cooperativo. **Receita só materializa na QUEIMA/derretimento** (spread do resgate + quebra da expiração) — nunca na entrada. **A conta `1.2.01 Receita Venda Tokens` é uma armadilha tributária a remover.** **Naming:** a operação é **emissão** de tokens financiada por **ingresso de custeio** — evitar "venda/compra/receita".
- **🔴 GAP 5 (novo) — A classificação ato-cooperativo NÃO está ligada ao contábil de token.** O módulo `contabilidade-tributaria`/convênio já tem `Natureza (Próprio/Auxiliar/Não-Coop)` + `Fluxo (Ingresso/Repasse/Custo)` (tela de criar convênio), mas o `token-contabil.service` lança em contas fixas (Receita Venda / Custo) **sem consultar essa classificação**. Os dois mundos estão desconectados → o token não respeita o enquadramento fiscal do convênio.
- **🔴 GAP 6 (novo) — Falta painel admin de PASSIVO/CONTROLE de token.** O admin não consegue ver o **passivo "Tokens a Resgatar"** (quantos tokens vivos = quanto a cooperativa terá de honrar), **por quem** (holder), nem prever a exposição de resgate. Há dashboards de fluxo + economia, mas não a visão de **passivo/forecast de resgate**. Requisito do Luciano (22/06): "imagine o admin ter previsão de resgatar X tokens e não saber onde, a quem, como".
- **🟡 GAP 4 (já catalogado) — conta 5.1.02 tipada `DESPESA` (deveria PASSIVO)** `token-contabil.service.ts:36` — distorce balanço (D-novo-EMISSAO-ADMIN-CONTABIL).
- **⚠️ Resiliência:** lançamentos contábeis fora da tx com `catch`+log; só o resgate-PIX tem idempotência forte (`@@unique`) + cron de reconciliação. Os demais: falha contábil = divergência silenciosa. **Conecta com o delta ~-730 tokens (D-novo-FUNDACAO-DELTA-COOPEREBR) achado em 22/06** — os GAPs 1/2 + falhas silenciosas são fonte plausível.

## 2. Bug — `/dashboard/configuracoes/disclaimer-saque` quebrada
Página + backend EXISTEM e estão corretos. Bug = **descasamento de shape** front↔back → TypeError → tela branca:
- `/ativo`: controller retorna **achatado** `{...disclaimer, origem}` (`disclaimer-saque.controller.ts:184`); frontend espera **aninhado** `{disclaimer:{...}, origem}` e lê `ativo.disclaimer.texto` (`page.tsx:78,225,235`) → `undefined.texto`.
- `/historico`: controller retorna `{items,total}` (`:170`); frontend faz `setHistorico(histR.data ?? [])` + `.map` (`page.tsx:74,306`) → `.map is not a function`.
- **Fix (frontend):** `page.tsx:73-74` montar `{disclaimer, origem}` + `histR.data?.items ?? []`.

## 3. Bug — selector de empresa no convênio mostra PF+PJ
Filtro "só PJ" **não existe nem no front nem no back**:
- Componente `web/components/convenios/ConvenioCusteioBloco.tsx:103,108` — chama `GET /cooperados`, filtra só `status==='ATIVO'` (sem `tipoPessoa==='PJ'`; e exclui `ATIVO_RECEBENDO_CREDITOS`).
- Backend `cooperados.service.ts:290-330,377-399` — `findAll` não filtra por tipo NEM retorna `tipoPessoa`.
- **Fix (2 partes):** backend devolve `tipoPessoa` + aceita `?tipoPessoa=PJ&status=ATIVO,ATIVO_RECEBENDO_CREDITOS`; frontend filtra PJ + os 2 status ativos.

## 4. Tipos de token (UI não explica — confirmado)
`CooperTokenLedger` tem 2 enums: `tipo` (origem) + `operacao` (movimento). A tela de emissão `web/app/dashboard/cooper-token/page.tsx:342-350` é um `<select>` cru com 3 opções e ZERO explicação.

| Tipo (enviado) | Label UI | Significado |
|---|---|---|
| `GERACAO_EXCEDENTE` | Excedente | Default — kWh excedente/crédito padrão. Saque permitido. |
| `BONUS_INDICACAO` | Bonus Indicacao | Recompensa MLM de indicação. Saque BLOQUEADO (fiscal). |
| `SOCIAL` | Social | **Só rótulo** — sem lógica de negócio própria (grep confirma: nenhum `if tipo===SOCIAL`). Credita igual a qualquer outro. |
| `BONIFICACAO_ADMIN` | (lote /enviar) | Emissão admin em lote (M39). D Despesa Bonif./C Passivo. |
| `RESGATE_PIX` | — | Estabelecimento resgata voucher em R$ (liquidação, não venda). |
| `DISTRIBUICAO_CONVENIO` | — | Empresa PJ distribui tokens aos funcionários (F3). |
| `DESCONTO_FATURA` | — | Débito do abate na fatura (o "uso na fatura"). |
| `PAGAMENTO_QR` | — | Débito ao pagar parceiro do Clube via QR. |
| `BENEFICIO_CONVENIO` | — | Crédito de benefício de convênio. |

## 5. Onde fica o abate na fatura (UI)
- **Execução:** SÓ no **portal do cooperado** — `web/app/portal/tokens/page.tsx:375` ("Abater minha fatura com CooperTokens", POST `/cooper-token/usar-na-fatura`). **NÃO existe tela de admin** pra fazer/forçar o abate (grep em `web/app/dashboard/` = nada).
- **Baixa caixa+contábil:** acontece no `FinanceiroTokenListener.handleResgatado` (módulo `financeiro/`), por evento pós-commit — **NÃO dentro do `usarNaFatura`**. Por isso o Luciano "não achava": o abate está no portal, a baixa está no listener do financeiro.

## Recomendações (itens de trabalho)
- **Sprint Faxina Contábil do Token** (P1, antes de dinheiro real): GAP 1 (lançamento de quebra) + GAP 2 (QR caixa/contábil + taxa→receita) + GAP 3 (compra PJ template venda) + GAP 4 (tipo 5.1.02) + investigar o delta -730 (D-novo-FUNDACAO-DELTA-COOPEREBR) junto.
- **Bug fixes rápidos:** disclaimer-saque (shape frontend) + filtro PJ no convênio (back+front).
- **UX:** explicar os tipos de token na tela de emissão (HelpBox); decidir se precisa tela admin de abate.
