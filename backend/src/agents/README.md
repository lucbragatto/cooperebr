# Módulo Agents / IAG — CoopereBR/SISGD

Módulo **isolado e plugável** de agentes inteligentes com governança forte (Policy Engine).

## Princípios Fundamentais

- **Dependência unidirecional**: `agents/` usa o core. O core **nunca** depende de `agents/`.
- **Zero autonomia sem governança**: Toda ação passa pelo PolicyEngine (níveis L0-L4).
- **Rastreabilidade nativa**: Reaproveita `@AuditLog` + `AuditLog` table + EventEmitter2 existente.
- **TDD + Qualidade**: Cobertura mínima 80% nas partes críticas (Policy, Registry, Tools).

## Níveis de Risco (Policy)

| Nível | Significado                        | Aprovação Humana | Modo Padrão |
|-------|------------------------------------|------------------|-------------|
| L0    | Leitura pura                       | Não              | real        |
| L1    | Simulação / Recomendação           | Não              | dry-run     |
| L2    | Baixo risco com efeito             | Não (com limites)| dry-run     |
| L3    | Financeiro / Regulatório crítico   | **Sim**          | dry-run     |
| L4    | Bloqueado por arquitetura          | —                | —           |

## Estrutura Atual (Fase 2 - Infra)

```
agents/
├── agents.module.ts
├── agents.service.ts
├── common/
│   ├── policy/
│   │   ├── policy-engine.service.ts
│   │   └── policy-engine.service.spec.ts
│   ├── tools/
│   │   ├── tool.interface.ts
│   │   ├── tool-registry.service.ts
│   │   └── index.ts
│   └── types/
│       └── policy.types.ts
├── sentinela/               ← Prioridade A
├── repasses-despesas/       ← Prioridade B
├── cobranca/                ← Prioridade E
└── README.md
```

## Ordem de Implementação Aprovada

1. Infra + PolicyEngine + Tool contract + Registry (concluído)
2. Primeiras Tools L0 Sentinela (concentração 25% + classe GD)
3. Tools L0/L1 de Repasses + Despesas
4. Tools de diagnóstico de Cobrança
5. Fluxo de aprovação humana (L3)
6. (Posterior) Integração WhatsApp + dashboard

## Como Adicionar uma Nova Tool

```ts
// dentro de sentinela/tools/verificar-concentracao.tool.ts
import { defineTool } from '../../common/tools/tool.interface';
import { z } from 'zod';

export const verificarConcentracaoTool = defineTool({
  id: 'sentinela.verificarConcentracao25',
  name: 'Verificar Concentração > 25%',
  description: 'Audita alocações por usina/cooperado quanto ao limite regulatório de 25%.',
  declaredRiskLevel: 'L0',
  inputSchema: z.object({ usinaId: z.string().optional() }),
  async execute(input, ctx) {
    // implementação usando PrismaService injetado ou via contexto
    return { ... };
  },
});
```

Depois registre no submódulo correspondente e exporte para o ToolRegistry.

## Status

- **Data início**: 2026-05-30 (após aprovação explícita "pode seguir conforme sugerido")
- **Fase atual**: Infraestrutura + primeiras Tools reais do Sentinela (Prioridade A)

### Tools já entregues (Sentinela)

| ID | Nome | Nível | Status |
|----|------|-------|--------|
| `sentinela.mapearUsinasSemEnquadramento` | Mapear Usinas sem Enquadramento Regulatório (GD/Fio B) | L0 | ✅ Implementada + testada |
| `sentinela.analisarRiscoMovimentacaoEntreEnquadramentos` | Analisar Risco de Movimentação entre Enquadramentos (Fio B) | **L1** | ✅ Implementada + testada |

A Tool L1 é o primeiro passo real de **inteligência** do IAG:
- Detecta quando origem ou destino estão sem classificação → CRITICAL
- Alerta forte quando as classes GD são diferentes (risco real de aumento brutal na fatura do cooperado)
- Quando recebe `contratoId`, carrega dados reais do contrato (percentualUsina, kwh, classe aplicada) para contexto mais rico
- Fornece recomendação clara + gaps de dados identificados

Isso permite ao sistema ser útil e protetor **mesmo enquanto o core ainda não tem o módulo completo de Classificação Regulatória GD**.

**Progresso atual (31/05/2026):**

- Sentinela (A) → 2 Tools L0/L1 consolidadas e fortalecidas (foco em gap regulatório Fio B/GD)
- Repasses/Despesas (B) → **Iniciado**
  - Primeira Tool L0: `repasses.listarPendentesComAlertas` (com detecção automática de atrasos e alto abatimento de despesas)

**Próximo na sequência:**
- Fortalecer Tools de B (adicionar mais alertas + primeira Tool L1 de simulação de impacto em repasses)
- Depois avançar para Prioridade E (Cobranca)

**Módulo projetado para ser acoplado sem travar o desenvolvimento do SISGD principal.**
