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

Sprint 5 em 8/9 tarefas fechadas. T9 pendente (pode ser adiada).

**Próxima prioridade (Sprint 6), detalhes na Parte 7 do alinhamento:**

1. Ticket 10 — FaturaSaas automática (receita da plataforma — 0 hoje)
2. Ticket 11 — Limpeza multi-tenant (5 órfãos, lixo "aaaaaaa")
3. Tickets 6, 7, 8 — Correções OCR
4. Ticket 9 — Campo numeroInstalacao EDP
5. Ticket 12 — Audit trail HistoricoStatusCooperado

## Regra de atualização

Se estado mudar muito (muitos tickets fechados, novo sprint, schema grande),
re-gerar RAIO-X e atualizar `docs/COOPEREBR-ALINHAMENTO.md`. Avisar Luciano antes.
