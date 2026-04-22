# Sessão 22/04/2026 — Sprint 7 Gateway Multi-tenant

## Resumo

Refatoração completa do sistema de pagamentos pra suportar múltiplos gateways
por parceiro. Antes: Asaas acoplado direto em 3 services. Depois: abstração
com adapter pattern, qualquer gateway futuro é 1 arquivo novo.

## Commits

| Etapa | Commit | Descrição |
|---|---|---|
| Fase A | `af8ce25` | Limpeza dados + validação 82 cooperados |
| Fase B | `72d15fd` | 61 AsaasCustomers criados no sandbox |
| Etapa 1 | `f5dd318` | Schema: ConfigGateway, ConfigGatewayPlataforma, CobrancaGateway |
| Etapa 2 | `0c435cf` | Interface + AsaasAdapter + GatewayPagamentoService |
| Etapa 2.5 | `780b648` | GatewayError padronizado (6 codes) |
| Etapa 3 | `b0b231b` | 3 callers migrados (cobrancas, whatsapp, modules) |
| Etapa 4 | `11a6390` | Teste ponta a ponta sandbox (cobrança emitida) |
| Etapa 5 | — | Documentação (este commit) |

## Teste ponta a ponta

- Cooperada: ADRIANA MARIA ALMENARA ZAMBON
- Cobrança R$400 competência 04/2026
- Asaas emitiu `pay_pe0o1c03jwb1tz6o` (PENDING, 611ms)
- PIX copia-e-cola gerado
- CobrancaGateway persistida
- Anti-duplicação @@unique funcionou

## Decisões

1. pix-excedente.service.ts mantido como exceção (API de transferência PIX específica)
2. AsaasCustomer não migrado pra abstração (ficou como está)
3. Sicoob e BB ficam pro Sprint 9 (só abstração + Asaas agora)
4. GatewayError com campo retryable pra retry automático futuro

## Próximo

Sprint 7 fechado. Webhook Asaas precisa ser configurado no painel sandbox.
Sprint 8: CooperToken e Clube de Vantagens.
