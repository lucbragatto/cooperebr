# Teste End-to-End CoopereBR — 2026-03-23

## 1. Wizard Novo Membro (web/app/dashboard/cooperados/novo/)

| Item | Status |
|------|--------|
| page.tsx existe e importa todos os 7 steps | ✅ OK |
| Step1Fatura.tsx | ✅ OK |
| Step2Dados.tsx | ✅ OK |
| Step3Simulacao.tsx | ✅ OK |
| Step4Proposta.tsx | ✅ OK |
| Step5Documentos.tsx | ✅ OK |
| Step6Contrato.tsx | ✅ OK |
| Step7Alocacao.tsx | ✅ OK |
| Hook useTipoParceiro.ts | ✅ OK |
| Imports cruzados entre steps | ✅ OK |

## 2. Módulo MLM (Indicações)

| Item | Status |
|------|--------|
| IndicacoesModule no AppModule | ✅ OK |
| IndicacoesController (10 endpoints) | ✅ OK |
| IndicacoesService (10 métodos) | ✅ OK |
| Cooperado.codigoIndicacao no schema | ✅ OK (String @unique @default(cuid())) |
| GET /indicacoes/config com auth | ✅ Retorna null (sem config ainda — esperado) |
| GET /indicacoes/config sem auth | ✅ Retorna 401 (guard funcionando) |

## 3. Teste Asaas Sandbox (direto na API)

| Item | Status |
|------|--------|
| Criar customer | ✅ `cus_000007703603` — Teste CoopereBR, CPF 89089324704 |
| Criar cobrança PIX | ✅ `pay_1idp5qtxpso4grhx` — R$ 150,00, venc. 2026-04-01 |
| pixQrCode retornado | ✅ Base64 PNG do QR code recebido |
| pixCopiaECola | ✅ Payload: `00020101021226820014br.gov.bcb.pix2560qrpix-h.bradesco.com.br/9d36b84f-c70b-478f-b95c-12729b90ca25...` |
| Invoice URL | ✅ https://sandbox.asaas.com/i/1idp5qtxpso4grhx |

## 4. Teste Asaas via Backend

| Item | Status |
|------|--------|
| GET /asaas/testar-conexao | ✅ `{"ok":true,"totalCustomers":1}` |
| GET /asaas/config | ✅ Retorna config com apiKey mascarada |

## 5. Fluxo Completo via API

| Passo | Endpoint | Status |
|-------|----------|--------|
| Login | POST /auth/login | ✅ Token JWT retornado, perfil ADMIN |
| Buscar cooperado | GET /cooperados?search=maciel | ✅ Márcio Maciel encontrado (cmn1xnxo70000uof4ih6qac20) |
| Criar cobrança | POST /cobrancas | ✅ Cobrança cmn3ifob80003uoi4uus3649z criada (R$ 510 líquido) |
| Dar baixa | PATCH /cobrancas/:id/dar-baixa | ✅ Status mudou para PAGO, dataPagamento e valorPago preenchidos |
| Listar lancamentos | GET /financeiro/lancamentos | ✅ Endpoint responde (0 lancamentos — dar-baixa não cria automaticamente) |

## 6. Problemas Encontrados e Corrigidos

### ❌ → ✅ Usuario.cooperativaId nulo
- **Problema:** O usuário teste@cooperebr.com tinha `cooperativaId: null`, causando 500 em endpoints que dependem de `req.user.cooperativaId` (indicacoes/config, cobrancas com Asaas, etc.)
- **Correção:** Vinculado o usuário à cooperativa `cmn0ho8bx0000uox8wu96u6fd` via update direto no banco.

## 7. Observações

### ⚠️ Ações manuais / melhorias futuras
- **LancamentoCaixa automático:** O `darBaixa` não cria automaticamente um LancamentoCaixa. Se desejado, implementar no CobrancasService.
- **Cobranca.cooperativaId:** A cobrança criada ficou com `cooperativaId: null`. O `create` do CobrancasService não seta `cooperativaId` no `data` — apenas usa para integração Asaas. Considerar setar.
- **Asaas auto-emissão:** O contrato usado (CTR-2025-001) não tem `cooperativaId`, então a emissão automática no Asaas não foi acionada. Para testar: vincular cooperativaId no contrato.
- **API Key em plaintext:** A apiKey do Asaas está armazenada sem criptografia (há TODO no schema).

## 8. Dados da Cobrança PIX (Asaas Sandbox)

```
Payment ID:     pay_1idp5qtxpso4grhx
Customer ID:    cus_000007703603
Valor:          R$ 150,00
Vencimento:     2026-04-01
Status:         PENDING
Invoice URL:    https://sandbox.asaas.com/i/1idp5qtxpso4grhx
PIX Copia-Cola: 00020101021226820014br.gov.bcb.pix2560qrpix-h.bradesco.com.br/9d36b84f-c70b-478f-b95c-12729b90ca255204000053039865406150.005802BR5905ASAAS6009JOINVILLE62070503***6304364C
```

Para testar pagamento manual: acesse o invoice URL acima no browser.
