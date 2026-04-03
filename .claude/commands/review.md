# /review

Review de código com foco nos padrões do CoopereBR.

## Uso
```
/review <arquivo ou módulo>
```

## Checklist de review

### Segurança / Multi-tenant
- [ ] Todo query Prisma tem `cooperativaId` no where
- [ ] Dados do JWT usados como source of truth (não body)
- [ ] Sem exposição de dados cross-tenant

### Financeiro
- [ ] `Math.round()` em todos os cálculos monetários
- [ ] Fio B considerado nos cálculos de economia
- [ ] PIX Excedente só ativo com flag explícita

### Código
- [ ] Sem `any` injustificado
- [ ] DTOs com validação (`class-validator`)
- [ ] Transações Prisma onde necessário (race conditions)
- [ ] Sem SQL raw em prod

### Testes
- [ ] Novo código tem testes unitários?
- [ ] Casos de borda cobertos?
- [ ] Isolamento de tenant testado?

### Frontend
- [ ] `'use client'` só onde realmente necessário
- [ ] Shadcn/UI usado (não componente custom desnecessário)
