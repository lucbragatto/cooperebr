# Arquitetura de Gateways de Pagamento

> Sprint 7 — Refatoração multi-gateway (22/04/2026)

## Visão geral

O sistema suporta múltiplos gateways de pagamento por parceiro.
Cada parceiro (cooperativa/consórcio/etc) escolhe qual gateway usar.
O dono da plataforma tem gateway separado pra cobrar FaturaSaas.

```
Cobranca.create()
    ↓
GatewayPagamentoService (orquestrador)
    ↓ resolve adapter via ConfigGateway
    ├─ AsaasAdapter     (implementado)
    ├─ SicoobAdapter    (Sprint 9)
    ├─ BBAdapter        (Sprint 9)
    └─ outros futuros
    ↓
CobrancaGateway (registro unificado)
```

## Arquivos

| Arquivo | Papel |
|---|---|
| `src/gateway-pagamento/interfaces/gateway-pagamento-adapter.interface.ts` | Interface com 5 métodos |
| `src/gateway-pagamento/adapters/asaas.adapter.ts` | Adapter Asaas (delega pro AsaasService) |
| `src/gateway-pagamento/gateway-pagamento.service.ts` | Orquestrador — resolve adapter por ConfigGateway |
| `src/gateway-pagamento/gateway-pagamento.module.ts` | Module NestJS |
| `src/gateway-pagamento/errors/gateway-error.ts` | Erro padronizado (6 codes) |

## Interface — 5 métodos

```typescript
criarCustomer(cooperadoId, cooperativaId)     → { gatewayCustomerId }
emitirCobranca(cooperadoId, cooperativaId, dados) → ResultadoEmissao
cancelarCobranca(gatewayId, cooperativaId)    → void
processarWebhook(payload, token)              → WebhookResult
testarConexao(cooperativaId)                  → { ok, erro? }
```

## Schema

- `ConfigGateway` — config por parceiro + gateway (@@unique cooperativaId+gateway)
- `ConfigGatewayPlataforma` — config do dono da plataforma
- `CobrancaGateway` — registro unificado com gateway, gatewayId, link, PIX, boleto

## Como adicionar novo gateway

1. Criar `src/gateway-pagamento/adapters/<nome>.adapter.ts` implementando `GatewayPagamentoAdapter`
2. Registrar no `GatewayPagamentoService.resolverAdapter()` (switch case)
3. Adicionar no `gateway-pagamento.module.ts` como provider
4. Parceiro configura via `ConfigGateway` com `gateway = '<NOME>'`

## Exceção documentada

`pix-excedente.service.ts` usa `AsaasService.getApiClient()` direto — API de
transferência PIX é específica do Asaas. Não abstraída por enquanto.

## GatewayError

Erros padronizados com 6 codes: `CREDENCIAIS_INVALIDAS`, `CONEXAO_FALHOU`,
`GATEWAY_INDISPONIVEL`, `COBRANCA_DUPLICADA`, `COOPERADO_INVALIDO`, `DESCONHECIDO`.
Campo `retryable` indica se vale tentar de novo.
