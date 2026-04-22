# Pendências do Sprint 8B — reabrir amanhã

## Implementado e funcional
- PDF de cobrança com variação CLUBE/DESCONTO (`487e940`)
- Envio automático email+WA de fatura (`ec35e06`)
- Webhook Asaas com liberação de tokens pendentes (`7d34111`)
- Estrutura de dados validada via query (`0cc28a7`)

## Pendente (reabrir no início do Sprint 9)

### PDF: imagens faltando
- Código de barras: hoje é só texto, precisa ser imagem renderizável
- QR PIX: hoje é só copia-e-cola, precisa ser imagem escaneável
- Localização: `backend/src/cobrancas/cobranca-pdf.service.ts`
- Asaas já retorna `pixQrCode` em base64
- Fix estimado: 30-45 min, Sonnet

### Teste ponta-a-ponta: não executado
- O que foi feito: query validando schema de dados
- O que falta: teste real no sandbox
- Passos necessários:
  1. Criar cooperado teste com modoRemuneracao=CLUBE
  2. Admin ativa contrato (ATIVO_RECEBENDO_CREDITOS)
  3. Gerar primeira cobrança
  4. Verificar PDF gerado, email enviado, WA enviado
  5. Ir em sandbox.asaas.com e marcar cobrança como paga
  6. Validar: webhook recebido, Cobranca→PAGO, LancamentoCaixa criado, tokens pendentes→disponíveis, notificação WA
- Fix estimado: 45-60 min, Sonnet + atenção do Luciano

## Por que reabrir no Sprint 9
- Ambos são correções pequenas, não re-arquitetura
- Fazer em Sprint dedicado evita "arrastar" Sprint 8B
- Prioridade A do Sprint 9 antes de qualquer feature nova
