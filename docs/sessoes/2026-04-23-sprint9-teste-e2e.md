# Teste E2E real no sandbox — Sprint 9 (23/04/2026)

## Cooperado testado
- AGOSTINHO SOBRAL SAMPAIO
- modoRemuneracao: CLUBE (alterado pra teste)
- Contrato: CTR-596753 (desconto 20%)
- AsaasCustomer: cus_000007845705

## Pipeline executado
1. FormaPagamentoCooperado criada (PIX)
2. Cobrança R$600 criada (cheio, desconto R$120 viraria tokens)
3. Asaas emitiu: `pay_ascxccqiwsnyi4c4` (PENDING)
4. QR PIX base64 gerado (1140 chars)
5. PIX copia-e-cola gerado
6. CobrancaGateway salva com todos os campos
7. Link pagamento: `https://sandbox.asaas.com/i/ascxccqiwsnyi4c4`
8. Pagamento simulado no banco (status PAGO)
9. LancamentoCaixa REALIZADO criado
10. Primeira fatura paga detectada (totalPagas = 1)

## O que ficou parcial
- Tokens CLUBE não foram emitidos neste teste porque pagamento
  foi simulado direto no banco (sem NestJS rodando + darBaixa).
- O código de emissão existe em cobrancas.service.ts (commit 7d34111)
  e será ativado quando webhook real processar via darBaixa().

## Validação completa requer
- Backend rodando (npm run start:dev)
- Webhook Asaas configurado apontando pra URL do backend
- Pagar pelo sandbox.asaas.com → webhook dispara → darBaixa() → tokens
