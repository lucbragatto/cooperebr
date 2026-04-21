# Tickets abertos em 21/04/2026 — pra Sprint 7

## Ticket 1 — Auditar tela /dashboard/cooperados/[id]

**Origem:** descobertas da sondagem T3 (Sprint 5).

**Contexto:** A tela `/dashboard/cooperados/[id]/page.tsx` tem função de 
"aceitar proposta" (linha 983) mas não exige que admin escolha plano — 
cai em fallback silencioso pro "primeiro plano ativo da cooperativa". 
11+ telas do admin linkam pra ela; é a ficha central do cooperado, não 
pode ser removida diretamente.

T3 refinou o comportamento: quando fallback é usado, sistema cria 
notificação visível pro admin ("Contrato criado com plano padrão — 
revise"). Isso torna o problema visível em vez de silencioso.

**Escopo do ticket:**
- Medir por 4-6 semanas após produção real: quantas notificações 
  `PLANO_FALLBACK_APLICADO` são geradas
- Se volume alto: redesenhar a tela pra obrigar escolha de plano antes 
  do aceite
- Se volume baixo: manter como está, fallback vira comportamento 
  aceitável documentado
- Se volume zero: considerar remover o botão "aceitar proposta" da tela 
  e forçar uso do Wizard

**Métrica de decisão:** número de registros em `notificacoes` com 
`tipo = 'PLANO_FALLBACK_APLICADO'` criados nos primeiros 30 dias de 
produção.

---

## Ticket 2 — Bug em valorMensalEdp × 0.1 no motor

**Origem:** descobertas da sondagem T2 (Sprint 5).

**Localização:** `backend/src/motor-proposta/motor-proposta.service.ts`, 
função `calcularComPlano`, linha ~358 (após patch T3, pode ter deslocado 
algumas linhas).

**Problema:** 
```typescript
const valorMensalEdp = Math.round(
  (comparativoSemGD - valorMensalCooperebr) * 0.1 * 100
) / 100;
```

Calcula "10% da economia" como custo mínimo estimado da distribuidora. 
Isso é nonsense matemático — distribuidora cobra mínimo faturável ANEEL 
(taxa fixa por tipo de fornecimento), não 10% da economia. O `calcular()` 
legado (função irmã) já implementa o cálculo correto via 
`ConfigTenant.minimo_monofasico/bifasico/trifasico`.

**Escopo do ticket:**
- Portar a lógica de mínimo faturável do `calcular()` legado pra 
  `calcularComPlano()`
- Adicionar teste que valide o valor do mínimo faturável é lido da 
  configuração e não hardcoded
- Considerar extrair pra helper compartilhado

**Risco se não corrigido:** quando T7 migrar o Wizard pra usar 
`calcularComPlano()`, propostas passarão a mostrar economia 
ligeiramente errada pra cooperados.

---

## Ticket 3 — Refactor / remoção do calcular() legado

**Origem:** sondagens T2 e T3 (Sprint 5).

**Contexto:** Hoje coexistem duas funções no motor:
- `calcular()` (legado) — usado por todos os 4 callers ativos de aceitar()
- `calcularComPlano()` — implementação canônica com Tipo I/II (T2), não 
  usada em produção hoje

A T7 vai migrar o Wizard pra `calcularComPlano()`. Quando isso acontecer, 
`calcular()` fica sem callers e pode ser removido — mas tem 3 complicações:

1. Função tem comportamento próprio (implementa Tipo II + SEM_TRIBUTO 
   implicitamente). Contratos criados por ela antes da T7 têm snapshots 
   que podem divergir do método real usado.
2. Tem 16 testes no spec existente que precisam ser migrados ou removidos.
3. `cooperados.controller.ts` e `publico.controller.ts` chamam diretamente 
   o service — precisam ser atualizados junto.

**Escopo do ticket:**
- Após T7 e T9 estarem em produção por 30 dias sem regressão
- Marcar `calcular()` como `@deprecated` primeiro, com alerta de console 
  em dev
- Passados 60 dias sem uso, remover função + testes + endpoints
- Atualizar documentação interna

**Decisão pendente:** o ticket pode se transformar em "nunca remover" se 
algum caller externo (integração futura, cliente API) depender da rota 
`/motor-proposta/calcular`. Avaliar na hora.
