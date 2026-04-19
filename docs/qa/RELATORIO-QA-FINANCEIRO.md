# RELATÓRIO QA — MÓDULO FINANCEIRO (Faturas + Cobranças)

**Data:** 2026-03-20
**Escopo:** Backend (`faturas/`, `cobrancas/`), Frontend (`cobrancas/`, fatura em `cooperados/`), Schema Prisma
**Nota terminológica:** `FaturaProcessada` = conta de luz da concessionária (OCR/upload). `Cobranca` = boleto que a cooperativa emite ao cooperado.

---

## 1. BUGS IDENTIFICADOS

### BUG-01 — CRÍTICO: Frontend não envia campos obrigatórios na criação de cobrança
**Arquivo:** `web/app/dashboard/cobrancas/nova/page.tsx:79-85`
**Severidade:** CRÍTICA

O formulário calcula `percentualDesconto`, `valorDesconto` e `valorLiquido` (linhas 51-53), mas o POST para `/cobrancas` **não envia esses campos**:
```typescript
await api.post('/cobrancas', {
  contratoId: form.contratoId,
  mesReferencia: mes,
  anoReferencia: parseInt(form.anoReferencia),
  valorBruto,
  dataVencimento: form.dataVencimento,
  // FALTAM: percentualDesconto, valorDesconto, valorLiquido
});
```
O backend espera todos esses campos (`cobrancas.controller.ts:34-41`). Resultado: cobrança criada manualmente terá `percentualDesconto`, `valorDesconto` e `valorLiquido` como `null`/`undefined`, causando erros de integridade ou valores zerados no banco.

---

### BUG-02 — ALTO: Fallback silencioso de tarifas com valores hardcoded
**Arquivo:** `backend/src/faturas/faturas.service.ts:275-276`
**Severidade:** ALTA

Se não houver tarifa cadastrada, o sistema usa valores arbitrários sem alertar:
```typescript
const tusdVigente = tarifaVigente ? Number(tarifaVigente.tusdNova) : 0.3;  // R$ 0,30 hardcoded
const teVigente = tarifaVigente ? Number(tarifaVigente.teNova) : 0.2;     // R$ 0,20 hardcoded
```
**Impacto:** Cobranças geradas com tarifas completamente incorretas. O aviso na linha 280 registra no array mas o admin pode não perceber.

---

### BUG-03 — ALTO: Perda de precisão em cálculos financeiros (float vs Decimal)
**Arquivo:** `backend/src/faturas/faturas.service.ts:333-368`
**Severidade:** ALTA

Todos os cálculos monetários usam `Math.round(... * 100) / 100` com aritmética de ponto flutuante:
```typescript
valorBruto = Math.round(kwhCobranca * kwhApuradoBase * 100) / 100;
valorDesconto = Math.round(kwhCobranca * descontoAbsoluto * 100) / 100;
valorLiquido = Math.round(kwhCobranca * valorCooperado * 100) / 100;
```
Os campos Prisma são `Decimal(10,2)`, mas os valores intermediários usam `Number()` (linhas 312-314, 300-301). Erros de arredondamento acumulam ao longo de meses.

Inconsistência adicional: notificação (linha 392) usa `.toFixed(2)` enquanto cálculo usa `Math.round`.

---

### BUG-04 — ALTO: Controller de update aceita `body: any` sem validação
**Arquivo:** `backend/src/cobrancas/cobrancas.controller.ts:51`
**Severidade:** ALTA

```typescript
@Put(':id')
update(@Param('id') id: string, @Body() body: any) {
  return this.cobrancasService.update(id, body);
}
```
`body: any` permite injeção de campos arbitrários no `prisma.update()`. Um atacante pode enviar `{ id: "outro-id", createdAt: "2020-01-01" }` e sobrescrever campos protegidos.

---

### BUG-05 — MÉDIO: Checagem de duplicata ignora status da cobrança existente
**Arquivo:** `backend/src/faturas/faturas.service.ts:292-298`
**Severidade:** MÉDIA

```typescript
const existe = await this.prisma.cobranca.findFirst({
  where: { contratoId: contrato.id, mesReferencia, anoReferencia },
});
if (existe) { continue; }
```
Se existir uma cobrança CANCELADA para o mesmo mês/ano/contrato, o sistema **não gera uma nova**. Deveria filtrar apenas `status: { not: 'CANCELADO' }`.

---

### BUG-06 — MÉDIO: Sem tratamento de erro no GET de cobranças
**Arquivo:** `web/app/dashboard/cobrancas/page.tsx:42-46`
**Severidade:** MÉDIA

```typescript
useEffect(() => {
  api.get<Cobranca[]>('/cobrancas')
    .then((r) => setCobrancas(r.data))
    .finally(() => setCarregando(false));  // sem .catch()
}, []);
```
Se a API falhar, o loading some mas nenhum erro é exibido. Usuário vê "Nenhuma cobrança cadastrada" quando na verdade houve erro.

---

### BUG-07 — MÉDIO: Bypass de tipagem com `as any` em múltiplos componentes
**Arquivo:** `web/app/dashboard/cobrancas/page.tsx:102`, `web/app/dashboard/cobrancas/[id]/page.tsx:156`
**Severidade:** MÉDIA

```typescript
{(c as any).contrato?.cooperado?.nomeCompleto ?? '—'}
```
A interface `Cobranca` em `types/index.ts` não modela a relação aninhada `contrato.cooperado`. Se o backend mudar o include, o frontend quebra silenciosamente.

---

### BUG-08 — BAIXO: Mensagem de erro incorreta na fatura
**Arquivo:** `web/app/dashboard/cooperados/[id]/fatura/page.tsx:234`
**Severidade:** BAIXA

```typescript
} catch {
  setErro('Erro ao confirmar proposta.');  // Diz "proposta", deveria dizer "fatura"
}
```

---

### BUG-09 — BAIXO: Link de notificação genérico
**Arquivo:** `backend/src/faturas/faturas.service.ts:398`
**Severidade:** BAIXA

```typescript
link: `/dashboard/cobrancas`,  // Deveria linkar para a cobrança específica
```

---

## 2. DADOS AUSENTES

### DA-01 — Sem vínculo FaturaProcessada → Cobranca
**Arquivo:** `backend/prisma/schema.prisma`

O modelo `Cobranca` não possui campo `faturaProcessadaId`. Quando `aprovarFatura()` gera cobranças, não há rastreabilidade de **qual fatura originou qual cobrança**. Impossível auditar.

### DA-02 — FaturaProcessada sem mesReferencia/anoReferencia como campos indexáveis
**Arquivo:** `backend/prisma/schema.prisma` (modelo FaturaProcessada)

Mês e ano de referência ficam dentro do JSON `dadosExtraidos`. Impossível fazer queries eficientes como "todas as faturas de janeiro/2026".

### DA-03 — Cobranca sem campo `modeloCobrancaUtilizado`
**Arquivo:** `backend/src/faturas/faturas.service.ts:327`

A variável `modeloUsado` é calculada (FIXO_MENSAL, CREDITOS_COMPENSADOS, CREDITOS_DINAMICO) e registrada em `avisos`, mas **não é persistida** na cobrança. Impossível saber depois qual modelo gerou cada cobrança.

### DA-04 — Sem audit trail de quem aprovou/rejeitou fatura
**Arquivo:** `backend/src/faturas/faturas.service.ts:225-407`

Nenhum registro de qual usuário/admin aprovou a fatura que gerou as cobranças.

### DA-05 — Tipo FaturaProcessada ausente no types/index.ts
**Arquivo:** `web/types/index.ts`

`FaturaProcessada` e `DadosExtraidos` não são exportados do arquivo central de tipos. São redefinidos localmente no componente de fatura.

### DA-06 — Sem índices em chaves estrangeiras
**Arquivo:** `backend/prisma/schema.prisma`

- `FaturaProcessada.cooperadoId` — sem índice
- `FaturaProcessada.ucId` — sem índice
- `Cobranca.contratoId` — sem índice
- Sem índice composto em `Cobranca(contratoId, mesReferencia, anoReferencia)`

---

## 3. REGRAS DE NEGÓCIO AUSENTES

### RN-01 — Sem máquina de estados para status de cobrança
**Arquivo:** `backend/src/cobrancas/cobrancas.service.ts:43-55`

O `update()` permite **qualquer transição** de status: PAGO→PENDENTE, CANCELADO→PAGO, etc. Faltam regras:
- PAGO é terminal (ou permite estorno com justificativa)
- CANCELADO é terminal
- PAGO requer `dataPagamento`
- VENCIDO→PAGO é ok (pagamento atrasado)

### RN-02 — Sem constraint de unicidade para cobrança por contrato/mês/ano
**Arquivo:** `backend/prisma/schema.prisma` (modelo Cobranca)

A verificação é feita apenas em código (faturas.service.ts:292-294), não no banco. Requests concorrentes podem gerar cobranças duplicadas.

### RN-03 — Sem validação de contrato ativo na criação manual de cobrança
**Arquivo:** `backend/src/cobrancas/cobrancas.service.ts:29-41`

Nenhuma verificação se `contratoId` existe ou se o contrato está ATIVO. Permite criar cobrança para contrato ENCERRADO ou SUSPENSO.

### RN-04 — Sem job de atualização automática de status VENCIDO
**Nenhum arquivo implementa isso.**

Cobranças PENDENTE passadas do vencimento nunca mudam para VENCIDO automaticamente. Não existe cron/scheduler.

### RN-05 — Sem limite ou alerta para valores atípicos
**Arquivo:** `backend/src/cobrancas/cobrancas.service.ts:29-41`

Nenhuma validação de que valores fazem sentido (ex: cobrança de R$ 0,01 ou R$ 500.000). Sem alertas para valores fora da faixa esperada.

### RN-06 — Sem política de cascade delete definida
**Arquivo:** `backend/prisma/schema.prisma`

Deletar um `Contrato` falha se houver `Cobranca` vinculada (RESTRICT padrão). Deletar `Cooperado` falha se houver `FaturaProcessada`. Sem tratamento explícito.

### RN-07 — Sem validação da resposta OCR (Claude)
**Arquivo:** `backend/src/faturas/faturas.service.ts:524-624`

O JSON retornado pela Claude é parseado mas **não validado**:
- `mesReferencia` pode ter formato incorreto
- `tarifaTUSD` pode ser negativa
- `totalAPagar` pode ser string
- `tipoDocumento` pode ser valor não reconhecido

---

## 4. REGRAS DE NEGÓCIO DEFEITUOSAS

### RD-01 — CREDITOS_DINAMICO recalcula desconto com tarifa diferente da proposta
**Arquivo:** `backend/src/faturas/faturas.service.ts:345-361`

```typescript
const descontoDinamico = tarifaUnitVigente * (percentualDesconto / 100);
const valorCooperadoDinamico = kwhApuradoBase - descontoDinamico;
```
O modelo CREDITOS_DINAMICO usa a tarifa **vigente atual** para recalcular o desconto, mas o `kwhApuradoBase` vem da **proposta original** (que usou tarifa anterior). Isso mistura duas bases de cálculo diferentes, podendo gerar valores incoerentes.

### RD-02 — CREDITOS_COMPENSADOS com fallback inconsistente
**Arquivo:** `backend/src/faturas/faturas.service.ts:329-343`

Quando `creditosRecebidosKwh = 0`, o fallback cobra `kwhContrato * kwhApuradoBase` (modelo FIXO_MENSAL), mas rotula como "CREDITOS_COMPENSADOS fallback". O cooperado espera pagar por créditos recebidos e recebe cobrança fixa sem explicação.

### RD-03 — valorLiquido calculado independente de valorBruto - valorDesconto
**Arquivo:** `backend/src/faturas/faturas.service.ts:333-335`

```typescript
valorBruto    = Math.round(kwhCobranca * kwhApuradoBase * 100) / 100;
valorDesconto = Math.round(kwhCobranca * descontoAbsoluto * 100) / 100;
valorLiquido  = Math.round(kwhCobranca * valorCooperado * 100) / 100;
```
Cada valor é arredondado independentemente. Pode ocorrer: `valorBruto - valorDesconto != valorLiquido` (diferença de 1 centavo). Deveria calcular `valorLiquido = valorBruto - valorDesconto`.

### RD-04 — motor-proposta calcula média de preços de períodos diferentes
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:79-86`

```typescript
const taxas = cobrancasAtivas
  .filter(c => Number(c.contrato.kwhContrato ?? 0) > 0)
  .map(c => Number(c.valorLiquido) / Number(c.contrato.kwhContrato));
```
Calcula média de `valorLiquido/kwhContrato` de cobranças de meses diferentes (com tarifas diferentes). Inclui cobranças VENCIDO (não pagas). A média resultante é questionável como referência.

---

## 5. MELHORIAS

### ML-01 — Paginação e filtros nas listagens
**Arquivo:** `web/app/dashboard/cobrancas/page.tsx`, `backend/src/cobrancas/cobrancas.service.ts:8-13`

`findAll()` retorna TODAS as cobranças sem limite. Com centenas de cooperados e meses de operação, a tabela ficará inutilizável. Implementar:
- Paginação no backend (offset/limit)
- Filtros por status, mês/ano, cooperado
- Busca por nome/contrato

### ML-02 — Operações em lote para cobranças
Falta: marcar múltiplas como PAGO, exportar CSV/PDF, envio em lote de boletos.

### ML-03 — Histórico de faturas processadas
**Arquivo:** `web/app/dashboard/cooperados/[id]/fatura/page.tsx`

Exibe apenas a última fatura aprovada. Deveria mostrar histórico completo com todas as faturas (PENDENTE, APROVADA, REJEITADA).

### ML-04 — Transação Prisma na aprovação de fatura
**Arquivo:** `backend/src/faturas/faturas.service.ts:225-407`

O fluxo `aprovarFatura` faz múltiplos writes (update fatura + N creates cobrança + N notificações) sem `prisma.$transaction()`. Se falhar no meio, fica em estado inconsistente.

### ML-05 — Dashboard financeiro com KPIs
Não existe visão consolidada: total a receber, inadimplência, receita mensal, cobranças vencidas.

### ML-06 — Notificação de cobrança vencida
Sem notificação automática quando cobrança ultrapassa data de vencimento.

### ML-07 — Validação class-validator nos DTOs de cobrança
**Arquivo:** `backend/src/cobrancas/cobrancas.controller.ts:34-44`

Usar `@Body() body: { ... }` inline não aplica validação. Deveria ter DTOs com decorators `class-validator` (`@IsString()`, `@IsPositive()`, `@Min(1)`, `@Max(12)`, etc.).

---

## 6. RESUMO EXECUTIVO — TOP 5 PRIORIDADES

| # | Prioridade | ID | Descrição | Impacto |
|---|------------|-----|-----------|---------|
| 1 | **URGENTE** | BUG-01 | Frontend não envia `percentualDesconto`, `valorDesconto`, `valorLiquido` na criação manual de cobrança | **Cobranças manuais salvas com valores nulos/zerados no banco** |
| 2 | **URGENTE** | BUG-04 + RN-01 | Controller aceita `body: any` e não valida transições de status | **Vulnerabilidade de segurança + estados inválidos (PAGO→PENDENTE)** |
| 3 | **ALTA** | BUG-03 + RD-03 | Cálculos financeiros com float + arredondamento independente | **Centavos de diferença acumulados; valorBruto - valorDesconto ≠ valorLiquido** |
| 4 | **ALTA** | BUG-02 + RD-01 | Fallback de tarifa hardcoded + CREDITOS_DINAMICO mistura bases de cálculo | **Cobranças geradas com valores incorretos sem alerta claro** |
| 5 | **MÉDIA** | RN-02 + DA-06 | Sem unique constraint no banco + sem índices em FKs | **Cobranças duplicadas possíveis em concorrência + degradação de performance** |

---

*Relatório gerado automaticamente — análise estática sem execução de código.*
