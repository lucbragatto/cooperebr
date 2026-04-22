# Instruções permanentes — Claude Code no CoopereBR

## Antes de qualquer tarefa, SEMPRE ler primeiro (nesta ordem)

1. `docs/COOPEREBR-ALINHAMENTO.md` — estado consolidado do projeto
2. `docs/sessoes/` — sessões recentes (os 3 arquivos mais novos)
3. `git log -5 --oneline` — últimos commits

Esses 3 em ordem garantem contexto completo em 5 minutos.

## Sobre o projeto em 5 linhas

CoopereBR é plataforma SaaS multi-tenant de Geração Distribuída.
Dono: Luciano (não programa).
Parceiros (cooperativas/consórcios/associações/condomínios) pagam Luciano pelo uso do sistema via FaturaSaas.
Membros dos parceiros pagam seus parceiros (não pagam Luciano).
**CoopereBR é UM parceiro entre vários possíveis, NÃO o dono do sistema.**

Detalhes em `docs/COOPEREBR-ALINHAMENTO.md`.

## Convenções de código

- Multi-tenant: toda query Prisma filtra por `cooperativaId`
- `npx prisma db push` em dev (nunca migrate)
- PowerShell: `;` em vez de `&&`
- Commits em português, pequenos, descritivos
- Valores monetários: `Math.round(x * 100) / 100`

## Como trabalhar com Luciano

- Luciano NÃO programa
- Explicar decisões em linguagem humana, sem jargão técnico
- Decisões técnicas puras (estrutura, libs, organização): decide você, comunica motivo
- Decisões de produto (regra de negócio, fluxo de usuário): pergunta antes de executar

## Quando Luciano pedir conteúdo de arquivo

- Execute `Get-Content <path>` e cole o output LITERAL
- NÃO resumir, NÃO interpretar
- Se arquivo > 500 linhas, avisar antes e perguntar se quer em partes

## Sprint atual

Sprint 5 fechado (8/9). Sprint 6 fechado (6 tickets, 21/04/2026).

**Próximo: Sprint 7 — Asaas em Produção:**

1. Migrar Asaas de sandbox pra prod na CoopereBR
2. Criar AsaasCustomer pra cada cooperado ATIVO
3. Ao gerar Cobrança, emitir AsaasCobranca automática
4. Webhook processar pagamento → LancamentoCaixa
5. T9 Sprint 5 (desligar BLOQUEIO_MODELOS_NAO_FIXO)

## Gateways de pagamento

Novos gateways sempre via adapter pattern (`src/gateway-pagamento/`).
Nunca chamar AsaasService direto de fora do módulo asaas — usar
GatewayPagamentoService. Ver `docs/arquitetura/gateways.md`.

Exceção: `pix-excedente.service.ts` usa AsaasService direto (transferência PIX específica).

## Dados de teste

Todos os dados atualmente no banco dev são de teste. Quando encontrar
dados suspeitos (CPF/CNPJ fake padrão 1-2-3-4, nomes 'REMOVIDO', emails
@removido.invalid, domínios @test ou @invalid), pode deletar sem perguntar.
Apenas mostra a lista do que vai deletar e executa. Isso vale até o primeiro
parceiro real entrar em produção.

## Regra de atualização

Se estado mudar muito (muitos tickets fechados, novo sprint, schema grande),
re-gerar RAIO-X e atualizar `docs/COOPEREBR-ALINHAMENTO.md`. Avisar Luciano antes.
