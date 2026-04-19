# Relatório QA — CoopereBR
**Data:** 2026-04-15 | **Horário:** 03:00 (America/Sao_Paulo) — ciclo noturno automático
**Score:** 8.8/10 ↑ (+0.5 vs 8.3 em 14/04) — 9 bugs P2 fechados; 2 novas features; 5 novos bugs (2 P2 + 3 P3)
**Críticos P1:** 0 ✅ | **P2 ativos:** 4 (−6) | **P3:** 7 (+2)
**Gerado por:** Assis — análise profunda com commits desde 14/04 03:00

---

## 1. Status dos Itens do Ciclo Anterior (14/04/2026)

**9 commits entregues desde 14/04 03:00** — sprint de correções extenso, melhor dia histórico de fechamentos P2.

### ✅ Bugs FECHADOS neste ciclo (9 fechamentos!)

| ID | Bug | Commit |
|----|-----|--------|
| BUG-NEW-2026-04-14-001 | kwhInjetado usava kwhCompensado (dado errado relatório) | `879e3f8` |
| BUG-NEW-2026-04-14-002 | IDOR: DELETE /faturas/:id e PATCH /:id/rejeitar sem tenant | `879e3f8` |
| BUG-NEW-2026-04-14-003 | Histórico economia `* 0.15` hardcoded | `980414e` |
| BUG-NEW-2026-04-13-001 | IDOR: GET /faturas/:id/relatorio sem tenant check | `879e3f8` |
| BUG-NEW-2026-04-13-002 | IDOR: DELETE/PUT /motor-proposta/proposta/:id sem tenant | `879e3f8` |
| BUG-NEW-2026-04-13-003 | saldoAnterior = saldoAtual + kwhCompensado (fórmula errada) | `879e3f8` |
| BUG-NEW-2026-04-10-001 | indicadosAtivos sem decremento no churn | `ee06ca1` |
| BUG-WA-AUDIO | audio/video/sticker tipo='texto' corpo=null — silêncio no bot | `1a6d930` |
| SEC-CT-002 | Secret WA hardcoded na query string | `3b50a45` |
| BUG-NEW-002 | Webhook Asaas sem validação (HMAC/timing-safe) | `20c337c` |

### ✅ Features entregues desde 14/04

| Commit | Feature |
|--------|---------|
| `b98727a` | Módulo ContaAPagar: CRUD backend + frontend `/dashboard/contas-pagar` |
| `313fbf4` | Campos `saldoKwhAnterior`, `saldoKwhAtual`, `validadeCreditos`, `valorSemDesconto`, `economiaGerada` em FaturaProcessada + OCR enriquecido |
| `ee06ca1` | HistoricoStatusCooperado: modelo + endpoint `/cooperados/:id/historico-status` |

### 🟡 Bugs P2 do ciclo anterior — AINDA ABERTOS

| ID | Bug | Status |
|----|-----|--------|
| BUG-NEW-2026-04-11-003 | BONUS_INDICACAO idempotência sem cooperativaId | 🟡 Persiste |
| BUG-CALCULO-001 | Arredondamento multa/juros: 3 implementações divergentes | 🟡 Persiste |

---

## 2. Bugs Novos — Ciclo 15/04/2026

---

### 🟡 BUG-NEW-2026-04-15-001 — `contas-pagar`: Sem validação de entrada (DTO sem class-validator)
**Prioridade: P2 | Área: Segurança / Integridade de Dados**
**Arquivo:** `backend/src/contas-pagar/contas-pagar.controller.ts` + `contas-pagar.service.ts`

```typescript
// controller.ts — usa plain interface como DTO
@Post()
create(@Req() req: any, @Body() dto: any) {  // ← "any" sem validação
  return this.contasPagarService.create(req.user.cooperativaId, dto);
}

// service.ts — interface sem decorators class-validator
interface CreateContaAPagarDto {
  descricao: string;
  categoria: CategoriaContaAPagar;
  valor: number;         // ← pode ser negativo, NaN, string
  dataVencimento: string; // ← inválida causa Invalid Date silenciosamente
}
```

O `ValidationPipe` global com `whitelist: true` e `forbidNonWhitelisted: true` **não valida interfaces TypeScript** — ele só valida classes decoradas com `class-validator`. Como o DTO é uma interface, nenhuma validação é aplicada.

**Cenários de impacto:**
- `valor: -1500` → conta a pagar com valor negativo salvo no banco
- `dataVencimento: "not-a-date"` → `new Date("not-a-date")` = `Invalid Date` → Prisma pode salvar `null` ou lançar erro não tratado
- `categoria: "INVALIDA"` → Prisma lança PrismaClientKnownRequestError não capturado (500 não descritivo)
- `descricao: ""` → conta salva sem descrição

**Fix sugerido:** Criar classe `CreateContaAPagarDto` com decorators `@IsString()`, `@IsNotEmpty()`, `@IsPositive()`, `@IsEnum(CategoriaContaAPagar)`, `@IsDateString()` via `class-validator`.

**Status: ABERTO 🟡 P2**

---

### 🟡 BUG-NEW-2026-04-15-002 — `contas-pagar`: SUPER_ADMIN sem cooperativaId expõe todos os registros
**Prioridade: P2 | Área: Segurança / Tenant Isolation**
**Arquivo:** `backend/src/contas-pagar/contas-pagar.controller.ts`

```typescript
@Roles(SUPER_ADMIN, ADMIN, OPERADOR)
@Get()
findAll(@Req() req: any, @Query('status') status?: string, @Query('categoria') categoria?: string) {
  return this.contasPagarService.findAll(req.user.cooperativaId, { status, categoria });
  // ↑ SUPER_ADMIN tem cooperativaId = null/undefined
}

// service.ts
async findAll(cooperativaId: string, filtros?: ...) {
  return this.prisma.contaAPagar.findMany({
    where: {
      cooperativaId,  // ← undefined em Prisma = filtro removido = TODOS os registros
      ...
    },
  });
}
```

Para SUPER_ADMIN, `req.user.cooperativaId` é `null` ou `undefined`. Em Prisma, `where: { cooperativaId: undefined }` equivale a `where: {}` — sem filtro. A query retorna **todas as contas a pagar de todas as cooperativas**, vazando dados inter-tenant.

O mesmo padrão afeta `create`: SUPER_ADMIN sem cooperativaId tentaria criar com `cooperativaId: undefined`, causando erro de constraint no Prisma (coluna `cooperativaId String` obrigatória).

**Fix sugerido:** Seguir padrão do resto do sistema:
```typescript
const resolvedCoopId = req.user?.perfil === PerfilUsuario.SUPER_ADMIN
  ? (cooperativaId ?? req.user?.cooperativaId)
  : req.user?.cooperativaId;
if (!resolvedCoopId) throw new BadRequestException('cooperativaId obrigatório para SUPER_ADMIN');
```

**Status: ABERTO 🟡 P2**

---

### 🟠 BUG-NEW-2026-04-15-003 — `contas-pagar`: TOCTOU em update/delete (race condition leve)
**Prioridade: P3 | Área: Segurança / Concorrência**
**Arquivo:** `backend/src/contas-pagar/contas-pagar.service.ts`

```typescript
async update(id: string, cooperativaId: string, dto: UpdateContaAPagarDto) {
  await this.findOne(id, cooperativaId);  // valida tenant
  // ↓ entre findOne e update, outro tenant poderia (em teoria) reassociar o registro
  return this.prisma.contaAPagar.update({
    where: { id },           // ← sem cooperativaId no where da operação
    data,
  });
}

async remove(id: string, cooperativaId: string) {
  await this.findOne(id, cooperativaId);  // valida tenant
  return this.prisma.contaAPagar.delete({ where: { id } });  // ← idem
}
```

Padrão correto: `where: { id, cooperativaId }` no próprio update/delete para atomic check-and-act.

**Status: ABERTO 🟠 P3**

---

### 🟠 BUG-NEW-2026-04-15-004 — `contas-pagar`: Status ATRASADO sem transição automática
**Prioridade: P3 | Área: Usabilidade / Lógica de Negócio**
**Arquivo:** `backend/src/contas-pagar/` (ausência de job)

O enum `StatusContaAPagar` inclui `ATRASADO`, mas **nenhum cron job** faz a transição `PENDENTE → ATRASADO` quando `dataVencimento < now()`. Consequências:

- Filtrar por `status=ATRASADO` no backend sempre retorna zero registros
- O frontend exibe KPI "Atrasados" usando função `isAtrasado()` local (client-side), mas o banco nunca tem esse status
- Inconsistência: o filtro de status na tela não funciona para ATRASADO (filtragem server-side retorna vazio)
- Um futuro relatório financeiro que use `status=ATRASADO` seria sempre zerado

**Fix sugerido:** Adicionar cron job (ex: `'0 2 * * *'` junto com `marcarVencidas`) que atualiza `ContaAPagar` com `status=PENDENTE` e `dataVencimento < hoje` para `status=ATRASADO`.

**Status: ABERTO 🟠 P3**

---

### 🟠 BUG-NEW-2026-04-15-005 — Cluster de 5 crons simultâneos às 3h AM
**Prioridade: P3 | Área: Infraestrutura / Crons**

Inventário completo de crons às 3h AM (todos `'0 3 * * *'` ou `EVERY_DAY_AT_3AM`):

| Job | Cron | Peso DB |
|-----|------|---------|
| `cobrancas.job:calcularMultaJuros` | `EVERY_DAY_AT_3AM` | ALTO (read+write cobrancas) |
| `convenios.job:verificarConvenios` | `'0 3 * * *'` | MÉDIO |
| `convite-indicacao.job:enviarLembretes` | `'0 3 * * *'` | MÉDIO (WhatsApp) |
| `cooperados.job:limparProxyExpirados` | `'0 3 * * *'` | BAIXO |
| `cooperados.job:limparProxyZumbi` | `'0 3 * * *'` | BAIXO |

5 crons às 3h AM, incluindo o `calcularMultaJuros` que é o job financeiro mais pesado do sistema. O relatório de 11/04 já apontava 3 às 6h; agora o cluster às 3h é maior.

O cron de cobrancas às 6h15m (`'15 6 * * *'`) está corretamente escalonado. Email-monitor e CooperToken ainda conflitam às 6h00m.

**Fix sugerido:** Escalonar os jobs menos críticos:
- `convenios.job` → `'10 3 * * *'`
- `convite-indicacao.job lembretes` → `'20 3 * * *'`
- `email-monitor` → `'5 6 * * *'`

**Status: ABERTO 🟠 P3**

---

## 3. Análise de Fluxos — Wizards e Bot WhatsApp

### 3.1 Bot WhatsApp — Estados e Fluxos ✅ Melhorado
- ✅ **BUG-WA-AUDIO FECHADO**: `audioMessage` → `tipo='audio'`, bot responde graciosamente pedindo texto
- ✅ `videoMessage`, `stickerMessage` → `tipo='video'/'sticker'`, bot informa que mídia não é suportada
- ✅ Secret WA agora lido de `WHATSAPP_WEBHOOK_SECRET` env var
- ✅ Webhook backend valida o secret recebido contra `process.env.WHATSAPP_WEBHOOK_SECRET`
- ⚠️ `stickerMessage` não é detectado no Baileys (whatsapp-service) — cairia no `else` → tipo='texto', corpo=null → bot ignora silenciosamente (não envia resposta de mídia não suportada)
  - Único tipo de mídia ainda sem handler explícito no Baileys

### 3.2 Wizard de Cadastro Público — Status Quo (sem mudanças)
- ⚠️ Validações CPF/nome comentadas em `cadastroWeb` (P3 persiste)
- ✅ Tarifa dinâmica por distribuidora: OK
- ✅ modoTeste agora usa `NEXT_PUBLIC_MODO_TESTE` env var (fix `5904c0d`)

### 3.3 Relatório Mensal Cooperado — MELHORADO
- ✅ `kwhInjetado: Number(dados?.energiaInjetadaKwh ?? 0)` — dado correto
- ✅ `saldoAnterior: saldoAtual - injetado + compensado` — fórmula correta
- ✅ Histórico economia usa `cob.valorDesconto` — desconto real do contrato

### 3.4 Central de Faturas — TOTALMENTE SEGURA
- ✅ IDOR em listagem, resumo, relatório, deletar, rejeitar: todos resolvidos
- ✅ Motor-proposta: excluirProposta e editarProposta com cooperativaId

### 3.5 ContaAPagar — NOVO MÓDULO (com bugs)
- ✅ Frontend funcional: KPIs, filtros, tabela, modal de criação, marcar pago, excluir
- ⚠️ SUPER_ADMIN sem cooperativaId expõe dados inter-tenant (BUG-NEW-2026-04-15-002)
- ⚠️ Sem validação de entrada via class-validator (BUG-NEW-2026-04-15-001)
- ⚠️ Status ATRASADO sem transição automática (BUG-NEW-2026-04-15-004)
- Usabilidade do frontend: sólida — KPIs bem definidos, isAtrasado() client-side compensa ausência do job

---

## 4. Inconsistências de Cálculo

### 4.1 Cobrança Mensal — OK ✅
- Hierarquia de modelo: override contrato → usina → config → plano
- Guards kwhContrato > 0, fallback GeracaoMensal
- Tarifa por distribuidora (TUSD+TE, match fuzzy): OK

### 4.2 Multa/Juros — BUG-CALCULO-001 PERSISTE (P2)
Três implementações com precisão intermediária divergente:
| Local | Precisão | Arredondamento |
|-------|----------|----------------|
| `cobrancas.job:calcularMultaJuros` | `Math.round(… * 100) / 100` (2dp) | 2dp |
| `darBaixa` | `Math.round(… * 1e4) / 1e4` (4dp) | 2dp |
| `reenviarNotificacao` | sem arredondamento | 2dp |

Divergência possível de R$0,01–R$0,02 entre caminhos de execução.

### 4.3 saldoAnterior — CORRIGIDO ✅
`saldoAtual - energiaInjetada + kwhCompensado` — fórmula correta.

### 4.4 kwhInjetado — CORRIGIDO ✅
`Number(dados?.energiaInjetadaKwh ?? 0)` — campo correto.

### 4.5 economiaGerada (novo campo FaturaProcessada) — OK com ressalvas 🟠
```typescript
const economiaGerada = dadosExtraidos.valorSemDesconto > 0
  ? Math.round((dadosExtraidos.valorSemDesconto - dadosExtraidos.totalAPagar) * 100) / 100
  : null;
```
Não inclui `valorCobradoCoopereBR` no cálculo — economia inflada (mas é best-effort via OCR).
Mesmo padrão de BUG-NEW-2026-04-13-005 (persiste P3).

### 4.6 BONUS_INDICACAO sem cooperativaId — PERSISTE (P2)
Idempotência usa apenas `referenciaId: indicacao.id, referenciaTabela: 'Indicacao'` sem filtrar cooperativaId.
Risco baixo (UUIDs são globalmente únicos), mas viola o padrão multi-tenant do projeto.

### 4.7 indicadosAtivos no churn — CORRIGIDO ✅
`decrementarIndicadosAtivosNoChurn` implementado + `reativarIndicacoesNoRetorno` para reativação.
Ambos acionados em `update` individual e `alterarStatusLote`.

---

## 5. Segurança

| Item | Status |
|------|--------|
| IDOR Central de Faturas (todos) | ✅ RESOLVIDO |
| IDOR motor-proposta (excluir/editar) | ✅ RESOLVIDO |
| Secret WA na query string | ✅ RESOLVIDO |
| Webhook Asaas validação timing-safe | ✅ RESOLVIDO |
| modoTeste hardcoded | ✅ RESOLVIDO |
| **`contas-pagar`: SUPER_ADMIN vaza dados inter-tenant** | 🟡 **P2 NOVO** |
| **`contas-pagar`: Sem validação de entrada** | 🟡 **P2 NOVO** |
| BONUS_INDICACAO idempotência sem cooperativaId | 🟡 P2 PERSISTE |
| Validações CPF/nome comentadas em `cadastroWeb` | 🟠 P3 |
| CORS `*` em whatsapp-service (porta 3002) | 🟠 P3 |
| Admin phone hardcoded no fallback env | 🟠 P3 |
| `stickerMessage` sem handler no Baileys | 🟠 P3 |
| TOCTOU em contas-pagar update/delete | 🟠 P3 |

---

## 6. Infraestrutura e Crons

| Cron | Horário | Status |
|------|---------|--------|
| `marcarVencidas` | 2h AM | ✅ OK |
| `CooperTokenJob.expirarTokensVencidos` | Dia 1 às 2h | ✅ OK |
| `calcularMultaJuros` | 3h AM | ✅ OK (mas cluster com 4 outros) |
| `convenios.job:verificarConvenios` | 3h AM | 🟠 Conflito com calcularMultaJuros |
| `convite-indicacao.job:enviarLembretes` | 3h AM | 🟠 Conflito (envia WhatsApp) |
| `cooperados.job:limparProxyExpirados` | 3h AM | ⚠️ Conflito (leve) |
| `cooperados.job:limparProxyZumbi` | 3h AM | ⚠️ Conflito (leve) |
| `CooperTokenJob.apurarExcedentes` | 6h AM | 🟠 Conflito email-monitor |
| `email-monitor.verificarEmails` | 6h AM | 🟠 Conflito CooperToken |
| `cobrancas:notificarVencidas` | 6h15m AM | ✅ OK (bem escalonado) |
| `posicaoCooperado.job` | 7h AM | ✅ OK |
| `ClubeVantagensJob.enviarResumos` | Dia 1 às 9h | ✅ OK |
| `convite-indicacao.job:vencidos` | 10h AM | ✅ OK |
| `whatsapp-conversa.job:limpar` | A cada hora | ✅ OK |

**5 crons às 3h AM** (era 3 às 6h no relatório anterior). Risco crescente com base de dados.

---

## 7. Usabilidade

| Área | Observação |
|------|-----------|
| **ContaAPagar (NOVO)** | ✅ Frontend funcional; KPIs claros; porém status ATRASADO não sincroniza com DB |
| Bot WhatsApp | ✅ Áudio/vídeo: bot responde graciosamente; sticker ainda sem handler no Baileys |
| Histórico status cooperado | ✅ Endpoint funcionando; útil para auditoria |
| Relatório mensal cooperado | ✅ Dados corretos: kwhInjetado, saldoAnterior, economia |
| FaturaProcessada nova | ✅ Campos de saldo e economia enriquecem o contexto para cooperado |
| Cadastro público | ⚠️ Validações CPF/nome comentadas (leads inválidos possíveis) |
| Filtro ATRASADO em ContaAPagar | ⚠️ Retorna sempre vazio (sem job automático) |

---

## 8. Resumo Executivo

### Score: 8.8/10 ↑ (+0.5 vs 8.3 em 14/04)

**Sprint histórico de correções** — 9 bugs P2 fechados, incluindo os 6 IDORs pendentes, o BUG-WA-AUDIO, o secret WA e a validação do webhook Asaas. 3 novas features entregues.

**Positivos ✅:**
- Todos os IDORs conhecidos: **FECHADOS** (6 de uma vez)
- Bot WhatsApp: áudio/vídeo/sticker → resposta graciosamente
- indicadosAtivos no churn: **CORRIGIDO** com reativação bidirecional
- Webhook Asaas: timing-safe comparison implementada
- ContaAPagar: módulo novo funcional com frontend completo
- Histórico status cooperado: auditoria agora possível

**Preocupações ⚠️:**
- 🟡 `contas-pagar`: SUPER_ADMIN expõe dados inter-tenant (info leak grave, fácil de corrigir)
- 🟡 `contas-pagar`: Sem class-validator DTOs (dados inválidos podem ser salvos)
- 🟡 BUG-CALCULO-001: 3 implementações de multa/juros divergentes (persiste)
- 🟠 Status ATRASADO morto em ContaAPagar (filtro inoperante)
- 🟠 Cluster de 5 crons às 3h AM (risco de contenção crescente)
- 🟠 `stickerMessage` sem handler no Baileys (silêncio para stickers)

**Prioridade sugerida para próximo sprint:**
1. BUG-NEW-2026-04-15-002 — SUPER_ADMIN contas-pagar info leak (1 hora de fix)
2. BUG-NEW-2026-04-15-001 — class-validator DTOs para contas-pagar (2 horas)
3. BUG-CALCULO-001 — unificar arredondamento multa/juros (refactor cirúrgico)
4. BUG-NEW-2026-04-15-004 — cron marcar ATRASADO em contas-pagar
5. BUG-NEW-2026-04-15-005 — escalonar crons às 3h AM

---

## 9. Bugs Ativos Pós-Ciclo 15/04/2026

| ID | Bug | Prioridade | Sprint |
|----|-----|------------|--------|
| **BUG-NEW-2026-04-15-001** | **contas-pagar: sem class-validator DTOs, entrada não validada** | **P2** | **Próximo** |
| **BUG-NEW-2026-04-15-002** | **contas-pagar: SUPER_ADMIN expõe dados inter-tenant (info leak)** | **P2** | **Próximo** |
| BUG-NEW-2026-04-11-003 | BONUS_INDICACAO idempotência sem cooperativaId | P2 | Próximo |
| BUG-CALCULO-001 | Arredondamento multa/juros: 3 implementações divergentes | P2 | Próximo |
| BUG-NEW-2026-04-15-003 | TOCTOU em contas-pagar update/delete | P3 | Backlog |
| BUG-NEW-2026-04-15-004 | Status ATRASADO sem transição automática (cron faltando) | P3 | Próximo |
| BUG-NEW-2026-04-15-005 | 5 crons simultâneos às 3h AM (contenção crescente) | P3 | Backlog |
| BUG-NEW-2026-04-13-004 | N+1 queries no histórico do relatório mensal | P3 | Backlog |
| BUG-NEW-2026-04-13-005 | valorSemGD / economiaGerada usa tarifa circular (inflada) | P3 | Backlog |
| BUG-NEW-2026-04-12-004 | Admin phone hardcoded no fallback env | P3 | Backlog |
| BUG-NEW-2026-04-11-004 | Multa inconsistente em reenviarNotificacao | P3 | Backlog |

---

*Próxima análise automática: 16/04/2026 às 03h*
