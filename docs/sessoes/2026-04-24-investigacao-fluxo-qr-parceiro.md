# Investigação — Fluxo QR Token cooperado ↔ parceiro (24/04/2026)

## 1) Botão "Gerar QR Code pra Usar Tokens" (lado cooperado)

**Estado: EXISTE_FUNCIONAL**

- Tela: `web/app/portal/tokens/page.tsx:312`
- Chama: `POST /cooper-token/gerar-qr-pagamento` (`cooper-token.controller.ts:218`)
- Cooperado informa quantidade de tokens a gastar
- Backend (`cooper-token.service.ts:816`):
  - Valida saldo disponível
  - Gera JWT com payload `{ pagadorId, cooperativaId, quantidade, tipo: 'COOPER_TOKEN_QR' }`
  - Assina com `COOPERTOKEN_QR_SECRET` (env var, mínimo 32 chars)
  - Expiração: **5 minutos**
  - Retorna `{ qrToken, expiresIn: 300 }`
- Frontend renderiza QR Code via `qrcode.react` (`QRCodeSVG`, 256px)
- Timer visual de countdown (5 min → 0)
- Ao expirar: QR some, cooperado precisa gerar novo

## 2) Endpoint de "receber tokens" (lado parceiro)

**Estado: EXISTE_FUNCIONAL**

- Endpoint: `POST /cooper-token/processar-pagamento-qr` (`cooper-token.controller.ts:243`)
- Aceita `{ qrToken }` no body
- Backend (`cooper-token.service.ts:851`):
  - Verifica JWT (validade + expiração)
  - Valida que pagador ≠ recebedor
  - Valida que ambos são da mesma cooperativa
  - **Transação atômica Prisma:**
    - Debita pagador: `saldoDisponivel -= quantidade`, registra `DEBITO` no ledger
    - Credita recebedor: `saldoDisponivel += quantidadeLiquida`, registra `CREDITO` no ledger
    - Taxa QR: 1% (`TAXA_QR`), retida na transação
  - Credita `CooperTokenSaldoParceiro` da cooperativa do recebedor
  - Registra 2 entradas no `CooperTokenLedger` (débito + crédito, tipo `PAGAMENTO_QR`)

## 3) App/tela do parceiro pra escanear

**Estado: EXISTE_FUNCIONAL**

- Tela: `web/app/parceiro/receber-tokens/page.tsx` (176 linhas)
- Menu sidebar: `/parceiro/receber-tokens` (label "Receber Tokens")
- Usa `@zxing/browser` (BrowserQRCodeReader) pra acessar câmera e ler QR
- Mostra resultado: sucesso (bruto/taxa/líquido) ou falha (mensagem)
- **NÃO tem campo pra digitar código manual.** Só câmera.

## 4) Fluxo inverso: parceiro usa tokens acumulados

### Parceiro abate própria fatura de energia
**Estado: EXISTE_FUNCIONAL**
- Função: `usarTokensEnergia()` (`cooper-token.service.ts:1035`)
- Debita de `CooperTokenSaldoParceiro.saldoDisponivel`
- Registra no ledger com cooperadoId do primeiro cooperado da cooperativa (workaround)
- Endpoint: `POST /cooper-token/admin/usar-tokens-energia` (`cooper-token.controller.ts:435`)

### Parceiro transfere pra outro parceiro
**Estado: NÃO_EXISTE**

### Parceiro pede resgate em R$ (PIX)
**Estado: NÃO_EXISTE**
- Não há endpoint nem lógica implementada
- Fora do escopo MVP (requer consulta jurídica — Lei 12.865/2013)

## 5) Confirmações

- **Asaas NÃO está envolvido** em nenhuma parte deste fluxo. Confirmado.
- **Tudo via CooperTokenLedger interno.** Confirmado.
  - Débito do cooperado: `CooperTokenLedger` tipo `PAGAMENTO_QR`, operação `DEBITO`
  - Crédito do parceiro: `CooperTokenLedger` tipo `PAGAMENTO_QR`, operação `CREDITO`
  - Saldo parceiro: `CooperTokenSaldoParceiro`
- **PIX só se parceiro pedisse resgate.** Fora do escopo MVP.

## O que falta implementar

| Item | Estado | Prioridade |
|---|---|---|
| Campo manual pra digitar código (fallback câmera) | NÃO_EXISTE | Baixa — câmera funciona no celular |
| Transferência parceiro → parceiro | NÃO_EXISTE | Sprint 10+ |
| Resgate em R$ (PIX) | NÃO_EXISTE | Sprint 10+ (requer advogado) |
| Notificação WA ao cooperado quando tokens são usados | NÃO_EXISTE | Sprint 9 |
| Histórico de transações QR no portal do parceiro | NÃO_EXISTE | Sprint 9 |
