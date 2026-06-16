# Fluxo de emissão de token pelo conveniado — atual × alvo

> **Data:** 2026-06-15 · **Tipo:** diagnóstico read-only (nenhum código alterado, nenhuma migration, nenhum commit)
> **Base:** leitor profundo do circuito `CooperTokenCompra` (F2) ponta a ponta + cruzamento com `docs/ANALISE-CONVENIO-TOKEN-CLUBE-2026-06-15.md` e `docs/GAP-MAP-CONVENIO-MODELO-C-2026-06-15.md`. Toda linha tem evidência `arquivo:linha`.

## Manchete
**O ciclo "empresa pede → cobrança Asaas → paga → libera token → distribui" JÁ EXISTE e é AUTOMÁTICO** (zero passo manual no caminho feliz), com **3 camadas de idempotência** contra liberar token em dobro. O que falta é **fino**: (a) a tela de compra mora no portal do membro, não na área da empresa; (b) o lançamento contábil da **entrada de caixa** está com o template errado (e 2 pernas a jusante não lançam); (c) não há cron de recuperação se o webhook do Asaas não chegar; (d) preço único sem custo×venda.

---

## 1. Fluxo atual desenhado (passo a passo)

| # | Etapa | Módulo / endpoint / tabela | Existe? |
|---|---|---|---|
| 1 | Empresa solicita N tokens | `comprarTokensCooperado()` `cooper-token.service.ts:3998` · `POST /cooper-token/cooperado/comprar` `controller:433` (`@Roles(COOPERADO)`, `compradorCooperadoId` do JWT `:439`) · tela `/portal/comprar-tokens` | ✅ |
| 2 | Guards: PJ cooperada + tenant + status | `isEmpresaCooperada` `:4020`; `findFirst({id, cooperativaId})` `:4011`; status ATIVO `:4027` | ✅ |
| 3 | Cria `CooperTokenCompra` AGUARDANDO_PAGAMENTO | `schema.prisma:3034`; `:4042-4052` (valor = `valorTokenReais` da config `:4038`) | ✅ |
| 4 | Gera cobrança Asaas (+5 dias) + link/PIX/boleto | `asaasService.emitirCobranca()` `:4066-4086`; link bidirecional via CAS `updateMany({id,cooperativaId})` `:4092` | ✅ |
| 5 | Asaas envia webhook (PAYMENT_CONFIRMED/RECEIVED) | `POST /asaas/webhook` → `AsaasService.processarWebhook` `asaas.service.ts:544-565` (match por `asaasId`) | ✅ (automático) |
| 6 | Evento interno → listener | `'cooper-token-compra-pj.paga'` → `CooperTokenCompraPjListener.handlePaga` `listener.ts:29-35` | ✅ |
| 7 | Marca PAGO + **credita token automaticamente** | `processarPagamentoCompraPj` `:4147`; credita em **`saldoDisponivel` do cooperado PJ** via `creditar(forcarDisponivel=true)` `:4217-4226`; tipo `COMPRA_PJ_COOPERADA` | ✅ |
| 8 | Empresa distribui aos colaboradores | F3 `distribuirTokens` `:1291`; debita o **mesmo** `saldoDisponivel` `:1585-1625` | ✅ (loop fechado) |

**Onde caem os tokens:** no `CooperTokenSaldo.saldoDisponivel` do **cooperado PJ** (a empresa) — `:232`/`:4225`. **NÃO** no `CooperTokenSaldoParceiro` (esse é o acúmulo do tenant via resgates de clube). A distribuição (F3) debita exatamente desse saldo → **coerente**.

---

## 2. Tabela alvo × atual

| # | Item | Status | Evidência `arquivo:linha` | O que falta |
|---|---|---|---|---|
| 1 | Ciclo CooperTokenCompra ponta a ponta | ✅ **EXISTE** | compra `:3998`, webhook `asaas.service.ts:554`, listener `listener.ts:29`, crédito `:4147-4255` | nada no caminho feliz |
| 2 | Self-service do conveniado | ⚠️ **PARCIAL (placement)** | tela `/portal/comprar-tokens` + endpoint `controller:433` (empresa PJ alcança; PF é bloqueado no service `:4020`) | a tela está no **portal do membro**, não na **área da empresa** `/conveniada/*` → só falta um **link/atalho** lá |
| 3 | Vínculo compra ↔ convênio/empresa | ⚠️ **INDIRETO** | `CooperTokenCompra` tem `compradorCooperadoId` + `cooperativaId`, **sem `convenioId`** `schema.prisma:3034-3071` | aceitável (o saldo é da empresa, distribuível a qualquer convênio dela); se quiser rastrear "comprou pra qual convênio", falta `convenioId` |
| 4 | Retroalimentação automática | ✅ **AUTOMÁTICA** (caminho feliz) | 4 elos: `:3998` → Asaas → `asaas.service.ts:554` → `:4147` | quebra só se **webhook falhar** (§3) |
| 5 | Contábil (caixa + token passivo) | ⚠️ **PARCIAL + template errado** | F2 lança via `EMITIDO`→`lancarEmissaoFaturaCheia` `:293`/`token-contabil.service.ts:64`, **mas D Custo/C Passivo (não D Caixa/C Passivo)** e conta tipada **DESPESA** `:25`; F3/F6 **não lançam** | (a) F2 deveria ser **D Caixa / C Passivo** (entrada de R$), não "custo de desconto"; (b) corrigir tipo da conta p/ PASSIVO; (c) F3/F6 sem lançamento |
| 6 | Preço de emissão (custo × venda) | ⚠️ **único** | `valorTokenReais` único `schema.prisma:2992`, usado igual em compra `:4038`/distribuição `:1410`/resgate `:2043` | distinção **custo cooperativo × venda** (decisão D3) |
| 7 | Distribuição F3 coerência de saldo | ✅ **COERENTE** | F2 credita `saldoDisponivel` `:232`; F3 debita o mesmo `:1585-1625` | nada |
| + | Idempotência do webhook | ✅ **3 CAMADAS** | `ultimoWebhookEventId` `:4162` + CAS `updateMany` status-guard `:4191` + ledger `referenciaId`/`referenciaTabela` `:199` | nada — à prova de dobro |

---

## 3. Onde a retroalimentação quebra (pontos manuais)

A cadeia é **100% automática SE o webhook do Asaas chegar.** Dois pontos exigem intervenção:

1. ⚠️ **Webhook não chega** (rede/firewall/timeout): a compra fica em `AGUARDANDO_PAGAMENTO` **para sempre** — **não há cron** que consulte o status na Asaas e reconcilie. A empresa pagou, mas o token não libera. *(É o único furo real do ciclo automático.)*
2. ⚠️ **`creditar()` falha** (status do cooperado inválido, cross-tenant): a compra vira `PAGO_CREDITO_PENDENTE` `:4235` e emite alerta `:4240` → **reprocessamento manual** pelo admin. *(Raro; tem alerta, não perde dinheiro.)*

**Tudo o mais é automático:** solicitar → cobrar → webhook → marcar PAGO → creditar → pronto pra distribuir.

---

## 4. Plano de construção ordenado por dependência

> 🔌 **ligar o que existe** · 🏗️ **construir do zero** · ⛔ **decisão de produto**

### Fase 0 — Decisões
- ⛔ **D3:** preço de **custo cooperativo × venda**, ou preço único? (define o cálculo da compra)
- ⛔ **Contábil:** o lançamento da compra paga deve ser **D Caixa / C Passivo Tokens** (entrada de R$ + obrigação)? *(É o que o item 3 do alvo pede — hoje reusa o template de "custo de desconto", que é outro caso.)*

### Fase 1 — Schema (pequeno)
- 🔌 Corrigir tipo da conta `5.1.02 "Passivo Tokens a Resgatar"`: DESPESA → **PASSIVO** (`token-contabil.service.ts:25`).
- 🏗️ (opcional) `CooperTokenCompra.convenioId` se quiser rastrear a compra por convênio.
- 🏗️ (se D3) campo de preço de venda separado em `ConfigCooperToken`.

### Fase 2 — Backend "ligar o que existe"
- 🏗️ **Lançamento contábil correto da compra paga (F2):** novo método `lancarCompraPaga` (D Caixa / C Passivo) disparado no `processarPagamentoCompraPj`, em vez de reusar `lancarEmissaoFaturaCheia`.
- 🔌 **Cron de recuperação de webhook:** job que varre `CooperTokenCompra` em `AGUARDANDO_PAGAMENTO` vencidas e consulta o status na Asaas (a infra de polling pode reusar o `AsaasService`). Cataloga `D-novo-WEBHOOK-RECOVERY-CRON`.
- 🔌 **Lançamentos das pernas a jusante:** F3 (distribuição) e F6 (resgate PIX) emitirem evento contábil reusando o padrão de `token-contabil` (mesmo gap do GAP-MAP).

### Fase 3 — Frontend
- 🔌 **Link de compra na área da empresa** `/conveniada/*` apontando pra `/portal/comprar-tokens` (ou mover a tela pra lá). Tira a confusão de "comprar pelo portal do membro".
- *(a tela de distribuição F3 já existe na área da empresa.)*

### Fase 4 — Contábil (obrigatório)
- 🔌 Garantir que **toda perna** (compra, distribuição, resgate) gera `LancamentoCaixa` com `naturezaAto` correto.
- 🏗️ Transição `PROVISIONAL` → `CONFIRMADO` (hoje órfão).

---

## 5. Riscos

| Risco | Severidade | Evidência | Nota |
|---|---|---|---|
| **Token-passivo mal escriturado** | 🔴 ALTA | F2 reusa template "D Custo" em vez de "D Caixa"; conta tipo DESPESA `token-contabil.service.ts:25`; F3/F6 não lançam | o passivo do token e a entrada de R$ **não aparecem certos no balanço** — fura o item 3 do alvo (contábil) |
| **Webhook não chega → token preso** | 🟡 MÉDIA | sem cron de recovery (`:4147` depende do webhook) | empresa paga e não recebe automaticamente — exige reprocesso manual |
| **Multi-tenant** | 🟢 BAIXA (mitigado) | `cooperativaId` em todos os guards (`:4011`, `:4191`, `:184`); compra do JWT, nunca do body (`:439`) | compra **não** se atrela à empresa errada — isolamento OK |
| **Liberar token em dobro (webhook duplo)** | 🟢 BAIXA (resolvido) | 3 camadas: `ultimoWebhookEventId` `:4162` + CAS `:4191` + ledger `referenciaId` `:199` | à prova de dobro — validado |
| **Vínculo indireto compra↔convênio** | 🟢 BAIXA | sem `convenioId` na compra | só rastreabilidade; não quebra o fluxo |

---

## Síntese pro Luciano
**Você não precisa construir esse fluxo — ele existe e roda sozinho.** O que falta é **acabamento**:
1. **Contábil (o mais importante):** o lançamento da compra paga está com o "carimbo" errado (registra como custo de desconto em vez de **entrada de caixa + token como passivo**), a conta de passivo está marcada como despesa, e duas pernas a jusante (distribuição e resgate) não lançam. **Isso é o item 3 do seu alvo e é o gap real.**
2. **Um link** pra empresa comprar pela área dela (`/conveniada`) em vez do portal do membro.
3. **Um cron** que reconcilie se o aviso do Asaas falhar (pra empresa que pagou não ficar sem o token).
4. **Decisão D3:** preço de custo × venda.

Nada disso é "do zero" — é ligar e corrigir o que já está montado.

---

*Relatório read-only. Nenhum arquivo de código alterado. Débitos relacionados: D-novo-TOKEN-CONTA-TIPO, D-novo-F3-LANCAMENTO-AUSENTE, D-novo-F6-LANCAMENTO-AUSENTE, D-novo-WEBHOOK-RECOVERY-CRON (novo), D-novo-COMPRA-LANCAMENTO-CAIXA-TEMPLATE (novo — F2 reusa template de desconto em vez de entrada de caixa), D3 (preço custo×venda).*
