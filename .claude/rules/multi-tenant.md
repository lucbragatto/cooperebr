# Regra: Multi-Tenant

## Princípio fundamental

**Nunca expor dados cross-tenant.** Toda query ao banco deve filtrar por `cooperativaId`.

## Padrão obrigatório em queries Prisma

```typescript
// ✅ Correto
prisma.cooperado.findMany({
  where: {
    cooperativaId: req.user.cooperativaId,
    // ... outros filtros
  }
})

// ❌ Errado — expõe dados de todas as cooperativas
prisma.cooperado.findMany({
  where: { status: 'ATIVO' }
})
```

## Guards de auth

- Usar `@UseGuards(JwtAuthGuard, RolesGuard)` em todos os endpoints
- `cooperativaId` vem sempre do JWT, nunca do body/query da requisição
- SUPER_ADMIN pode ver todas as cooperativas — usar com cuidado

## Isolamento no WhatsApp Service

- Bot identifica tenant pelo número de telefone do cooperado
- Nunca misturar contexto de sessões de cooperados de cooperativas diferentes

## Checklist ao criar novo endpoint

- [ ] Filtro `cooperativaId` presente na query principal
- [ ] Relações aninhadas também filtradas (ex: `contrato.cooperativaId`)
- [ ] Teste de isolamento: usuário de tenant A não consegue ver dados do tenant B
