# Correções Financeiro & Frontend — 2026-03-25

**Agente:** 3 (Financeiro + Frontend)
**Referência:** RELATORIO-QA-2026-03-25.md

---

## Correções Realizadas

### CRÍTICOS

| ID | Descrição | Arquivo | Correção | Commit |
|----|-----------|---------|----------|--------|
| FIN-01 | `calcularMultaJuros()` não persistia multa/juros | `cobrancas.job.ts` L84-87 | Adicionado `prisma.cobranca.update()` com campos `valorMulta`, `valorJuros`, `valorAtualizado`. Campos adicionados ao schema Prisma. | `11cbeb1` |
| DT-02 | `contratos.ativar()` sem transação | `contratos.service.ts` L285-310 | Envolvido em `prisma.$transaction()` — contrato, cooperado e notificação agora são atômicos. Rollback automático se qualquer step falhar. | `c2c749e` |

### ALTOS FINANCEIRO

| ID | Descrição | Arquivo | Correção | Commit |
|----|-----------|---------|----------|--------|
| FIN-02 | `DIA_FIXO_32` aceito sem validação | `faturas.service.ts` L738-744 | Validação `dia < 1 \|\| dia > 31` com fallback para `diasVencimentoPadrao`. Regex alterado para aceitar 1-2 dígitos. | `37d17e5` |
| FIN-04 | CSV export não escapa aspas/ponto-e-vírgula | `financeiro/page.tsx` L49-52 | Implementado `escapeCsv()` que duplica aspas internas (RFC 4180). Todos os campos passam pelo escape. | `de7c472` |
| FIN-07 | Fila de espera ordenada por `updatedAt` | `cooperados.service.ts` L391 | Alterado para `createdAt: 'asc'` — posição FIFO estável. | `9e0ae96` |

### ALTOS FRONTEND

| ID | Descrição | Arquivo | Correção | Commit |
|----|-----------|---------|----------|--------|
| UX-01 | 15+ catch vazios silenciosos | Múltiplos (6 arquivos) | Adicionado `alert()` nos 6 catch blocks mais críticos: wizard membro (planos), wizard parceiro (documentos), FaturaUploadOCR, cooperado detail (benefícios + faturas reload), fatura detail page. | `b656e4c` |
| UX-03 | Telefone aceitava 10 dígitos | `entrar/page.tsx` L44-46 | Validação exata de 11 dígitos (DDD + 9 dígitos). Mensagens de erro separadas para nome e telefone. | `24cbb91` |
| UX-05 | `Math.max(...[])` retornava `-Infinity` | `financeiro/page.tsx` L76 | Guard `dados?.historico?.length` antes do spread — array vazio retorna `1` como fallback. | `de7c472` |

---

## Pendências / Observações

1. **Prisma migration**: campos `valorMulta`, `valorJuros`, `valorAtualizado` adicionados ao schema mas migration não aplicada (Prisma engine locked pelo dev server). Executar `npx prisma migrate dev` após reiniciar o servidor.
2. **UX-01 parcial**: 6 de 15+ catch blocks corrigidos (os mais críticos). Os restantes (clipboard, cooperativas/nova, meu-convite, usinas) são menos impactantes e podem ser abordados em próxima iteração.
3. **UX-01 padrão**: Usado `alert()` como feedback — o projeto não possui biblioteca de toast. Considerar migrar para `sonner` ou componente toast customizado no futuro.

---

## Resumo de Commits

```
11cbeb1 fix(FIN-01): persistir multa/juros no banco após cálculo
c2c749e fix(DT-02): envolver contratos.ativar() em transação Prisma
37d17e5 fix(FIN-02): validar range 1-31 em preferenciaCobranca DIA_FIXO
de7c472 fix(FIN-04,UX-05): escapar CSV corretamente e guard Math.max vazio
9e0ae96 fix(FIN-07): ordenar fila de espera por createdAt em vez de updatedAt
24cbb91 fix(UX-03): validar 11 dígitos para telefone BR
b656e4c fix(UX-01): adicionar feedback de erro nos catch vazios críticos
```

**Total: 7 commits, 8 bugs corrigidos (2 críticos + 3 altos financeiro + 3 altos frontend)**
