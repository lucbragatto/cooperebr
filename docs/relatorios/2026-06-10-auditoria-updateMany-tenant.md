# Auditoria multi-tenant — 10 `updateMany` no backend

**Data:** 2026-06-10
**Método:** análise estática (leitura do código + 12 linhas de contexto + verificação do controller upstream em cada caso)
**Motivação:** doc CLAUDE.md exige `cooperativaId` em **toda** query Prisma. `updateMany` sem filtro de tenant pode atualizar registros de outras cooperativas em massa.

---

## Resumo

| Risco | Quantos | Itens |
|---|---|---|
| 🔴 **P1 — exposto** | 5 | #1, #2, #6, #7, #10 |
| 🟢 OK — globalmente único | 3 | #5, #8, #9 |
| 🟢 OK — cron sistêmico | 2 | #3, #4 |

---

## 🔴 P1 — Precisa correção antes de qualquer parceiro real adicional

### #1 `cobrancas.service.ts:436` — `darBaixa(id, ...)`

```ts
const updated = await this.prisma.cobranca.updateMany({
  where: { id, status: { notIn: ['PAGO', 'CANCELADO'] } },
  data: { status: 'PAGO', dataPagamento, valorPago },
});
```

**Problema:** controller (`@Patch(':id/dar-baixa'` linha 66) só protege com `@Roles(SUPER_ADMIN, ADMIN, OPERADOR)`. Service carrega a cobrança por `id` sem filtrar `cooperativaId` antes do `updateMany`. Um ADMIN da cooperativa A que descubra o `id` (cuid) de uma cobrança da cooperativa B consegue marcar como PAGO.

**Correção sugerida:**
```ts
where: { id, cooperativaId: user.cooperativaId, status: { ... } }
```
Adicionar `user: { id; cooperativaId }` como parâmetro vindo do controller. SUPER_ADMIN bypass via `cooperativaId: user.perfil === 'SUPER_ADMIN' ? undefined : user.cooperativaId`.

### #2 `cobrancas.service.ts:634` — `cancelar(id, motivo)`

Mesmo padrão da #1. Mesma correção.

### #6 `motor-proposta.service.ts:1080` — `aplicarReajuste(dto)`

```ts
await this.prisma.contrato.updateMany({
  where: { cooperadoId: { in: cooperadoIds }, status: 'ATIVO' },
  data: { ultimoReajusteEm, ultimoReajusteIndice },
});
```

**Problema duplo:**
1. Controller (`@Post('aplicar-reajuste')` linha 178) **NÃO tem `@Roles` nem `@UseGuards` próprio** — pega só o guard global. Se `cooperativaId` não está implicitamente filtrado, qualquer usuário autenticado dispara reajuste em qualquer tenant.
2. `aplicarReajuste(dto)` não recebe `req.user`. `simularReajuste(dto)` filtra por `dto.cooperativaId` (vindo do body) — **`cooperativaId` do body é exatamente o anti-padrão proibido em `.claude/rules/multi-tenant.md`**.

**Correção sugerida:** adicionar `@Roles(SUPER_ADMIN, ADMIN)`, receber `req.user`, ignorar `dto.cooperativaId` e usar `user.cooperativaId`.

### #7 `lead-expansao.service.ts:147` — `notificarLeadsPorDistribuidora(distribuidora, cooperativaId?)`

```ts
async notificarLeadsPorDistribuidora(distribuidora: string, cooperativaId?: string) {
  const where: any = { distribuidora: { ... }, intencaoConfirmada: true, status: 'AGUARDANDO' };
  if (cooperativaId) where.cooperativaId = cooperativaId;
  const leads = await this.prisma.leadExpansao.findMany({ where });
  await this.prisma.leadExpansao.updateMany({ where: { id: { in: leads.map((l) => l.id) } }, ... });
}
```

**Problema:** `cooperativaId` é **opcional**. Se controller chamar sem ele, função notifica leads de **todas** cooperativas com aquela distribuidora. WhatsApp envia em massa cross-tenant. Vazamento de base comercial.

**Correção sugerida:** tornar `cooperativaId` obrigatório (`string`, não `string?`) e exigir no controller via `req.user.cooperativaId`. SUPER_ADMIN bypass via flag explícita do controller, não como omissão.

### #10 `cooperados.service.ts:737` — ativação em cascata

```ts
const result = await tx.contrato.updateMany({
  where: { cooperadoId: id, status: { in: ['PENDENTE_ATIVACAO', 'SUSPENSO'] } },
  data: { status: 'ATIVO' },
});
```

**Problema:** o método que envolve esse `updateMany` (`update` do cooperado) provavelmente carrega o cooperado por `id` sem filtrar tenant antes. Se sim, ADMIN da cooperativa A consegue ativar cooperado da B (e cascatear ATIVO nos contratos dele).

**Correção:** validar `cooperado.cooperativaId === user.cooperativaId` no início do método, antes da transação. Caminho mais simples: passar `where: { id, cooperativaId: user.cooperativaId }` no `update` inicial — se o cooperado não pertence ao tenant, o update já falha.

---

## 🟢 OK — não precisam correção

### #3 `cobrancas.job.ts:128` — cron diário marca cobranças vencidas
Sistema todo, sem contexto de usuário. Bulk status flip, dado não vaza cross-tenant.

### #4 `convite-indicacao.job.ts:71` — cron expira convites antigos
Idem.

### #5 `gateway-pagamento.service.ts:129` — cancela por `gatewayId`
`gatewayId` é o ID atribuído pelo Asaas — único na conta. **Pressuposto:** cada cooperativa tem sua própria conta Asaas (AsaasConfig por tenant). Se essa premissa um dia mudar (conta master compartilhada), vira P1.

### #8 #9 `asaas.service.ts:278/292` — by `asaasId`
Mesma lógica de #5. OK enquanto AsaasConfig for 1:1 com cooperativa.

---

## Plano de correção sugerido (estimativa)

| Item | Risco real | Esforço | Ordem |
|---|---|---|---|
| #7 lead-expansao | Maior (notifica WhatsApp em massa cross-tenant) | 30 min | 1º |
| #6 motor-proposta aplicarReajuste | Alto (escreve em contratos de qualquer tenant) | 1h (precisa testar com fixtures multi-tenant) | 2º |
| #1 #2 cobranças darBaixa/cancelar | Médio (depende de adivinhar cuid) | 30 min cada | 3º |
| #10 cooperados ativar | Médio (ADMIN só ativa quem aparece na UI dele) | 20 min + auditar `update()` upstream | 4º |

**Total estimado:** 2-3h Code, com specs adicionados nos 5 pontos.

**Recomendação:** rodar essa correção em sessão própria, antes de Sprint 5 / canário / qualquer parceiro novo, e adicionar specs Jest que tentem cross-tenant access (`expect(...).toThrow()` ou `expect(updated.count).toBe(0)`).
