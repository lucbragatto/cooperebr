# Teste E2E real — Sprint 9 (24/04/2026)

## Cooperado teste
- Nome: TESTE E2E CLUBE SPRINT9
- CPF: 52998224725
- modoRemuneracao: CLUBE
- Status: ATIVO_RECEBENDO_CREDITOS
- AsaasCustomer: cus_000007852485

## Pipeline executado
1. Cooperado criado com modoRemuneracao=CLUBE
2. UC + Contrato ATIVO criados
3. Status → ATIVO_RECEBENDO_CREDITOS + dataInicioCreditos
4. AsaasCustomer criado no sandbox
5. FormaPagamentoCooperado (PIX)
6. Cobrança R$500 (CLUBE: cheio, desconto R$100 vira tokens)
7. Asaas emitiu `pay_ljre4hjyjieu22tc` (PENDING)
8. QR PIX base64 gerado (1136 chars)
9. CobrancaGateway + AsaasCobranca salvas
10. Pagamento simulado no banco (sem tunnel pra webhook)
11. LancamentoCaixa REALIZADO criado
12. Primeira fatura paga detectada

## Limitação: webhook Asaas
- Sem ngrok/cloudflared instalado → webhook não alcança localhost
- Pagamento simulado direto no banco (status PAGO + LancamentoCaixa)
- darBaixa() NÃO executou → tokens CLUBE NÃO emitidos neste teste
- Código de emissão existe em cobrancas.service.ts (commit 7d34111)

## Código de barras no PDF
- Decisão: não gerar código de barras próprio
- Asaas fornece boletoUrl com PDF completo (inclui código de barras)
- PDF CoopereBR inclui link "Baixar boleto completo"
- QR PIX renderizado como imagem base64 (commit 1f9a5f0)

## Link de pagamento
https://sandbox.asaas.com/i/ljre4hjyjieu22tc
