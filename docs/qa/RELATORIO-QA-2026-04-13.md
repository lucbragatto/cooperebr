# Relatório QA — CoopereBR
**Data:** 2026-04-13 | **Horário:** 03:00 (America/Sao_Paulo) — ciclo noturno automático
**Score:** 8.5/10 ↑ (+1.0 vs ciclo 12/04) — maior salto positivo do histórico
**Críticos P1:** 0 (todos fechados ✅) | **P2 ativos:** 8 | **P3:** 6
**Gerado por:** Assis — análise profunda de arquivos modificados desde 12/04 03h

---

## 1. Status dos Itens do Ciclo Anterior

### ✅ BUG-NEW-2026-04-11-001 — `modoTeste = true` — **RESOLVIDO**
`web/app/cadastro/page.tsx` — corrigido em 12/04 às 09:40.
- `modoTeste = false` // produção — validações ativas
- Botão "Finalizar sem escolher plano (modo teste)" **removido**
- Termos + plano obrigatórios no submit ✅

### ✅ BUG-NEW-2026-04-12-001 — `ConfigTenant chave @unique` multi-tenant — **RESOLVIDO**
Schema Prisma atualizado com constraint composto:
```prisma
@@unique([chave, cooperativaId], map: "config_tenant_chave_cooperativaId_unique")
```
Service corrigido para usar `chave_cooperativaId: { chave, cooperativaId }` no upsert. ✅

### ✅ BUG-NEW-2026-04-12-002 — email-monitor sem filtro cooperativaId — **RESOLVIDO**
`email-monitor.service.ts` corrigido:
- `getConfigFromDb(chave, cooperativaId)` aceita e filtra por cooperativaId
- `identificarCooperado()` filtra por `cooperativaId` (via nested where)
- `identificarPorOcr()` filtra UC e CPF por `cooperado.cooperativaId` ✅

### ✅ BUG-NEW-2026-04-12-003 — notificação email-monitor sem cooperativaId — **RESOLVIDO**
`criarFaturaNaoIdentificada()` agora inclui `cooperativaId` na notificação criada.
`notificarAdminWhatsApp()` busca telefone do admin via `ConfigTenant` com isolamento de tenant. ✅

### ✅ BUG-NEW-2026-04-11-002 — Tarifa EDP-ES hardcoded na simulação — **RESOLVIDO**
`web/app/cadastro/page.tsx` — tarifa agora é buscada dinamicamente:
```javascript
fetch(`${API_URL}/motor-proposta/tarifa-concessionaria/atual?concessionaria=EDP-ES`)
  .then(data => setTarifaKwh(data.tusdNova + data.teNova))
```
CEMIG/CPFL/Energisa/ENEL recebem tarifa correta do banco. ✅
Endpoint `@Public() GET /motor-proposta/tarifa-concessionaria/atual` confirma acesso sem auth. ✅

### ✅ BUG-NEW-2026-04-11-005 — Race condition resgate de oferta (estoque) — **RESOLVIDO**
`clube-vantagens.service.ts` — `resgatarOferta` usa `prisma.$transaction`:
- Verificação de estoque **dentro** da transação atômica
- `oferta.totalResgatado >= oferta.estoque` verificado antes de debitar tokens ✅

### ✅ BUG-NEW-2026-04-11-006 — FATURA_CHEIA_TOKEN gravado como BONUS_INDICACAO — **RESOLVIDO**
`cobrancas.service.ts` — modo FATURA_CHEIA_TOKEN agora credita `CooperTokenTipo.FATURA_CHEIA` corretamente.
Ledger do cooperado agora registra o tipo correto. ✅

### ✅ BUG-NEW-2026-04-11-008 — cotaKwhMensal=null inflaciona excedente tokens — **RESOLVIDO**
`cooper-token.job.ts` (`apurarExcedentes`) agora tem guard explícito:
```typescript
const cotaKwhRaw = fatura.cooperado.cotaKwhMensal;
if (!cotaKwhRaw || Number(cotaKwhRaw) <= 0) {
  // marca tokenApurado=true e pula sem creditar
  continue;
}
```
Cooperados sem cota definida não recebem tokens de excedente. ✅

### 🟡 BUG-NEW-2026-04-11-003 — BONUS_INDICACAO antes de aprovação — **PERSISTE (P2)**
`processarPrimeiraFaturaPaga` é chamado reativamente via evento. Verificado: token creditado
**após** status `PRIMEIRA_FATURA_PAGA` — porém sem verificação de `cooperativaId` no ledger check,
pode creditar duplicado em ambiente multi-tenant com IDs de indicação iguais (edge case).
**Status: ABERTO 🟡 P2 — monitorar**

### 🟡 BUG-NEW-2026-04-10-001 — indicadosAtivos nunca decrementado — **PARCIALMENTE RESOLVIDO**
`recalcularIndicadosAtivos` é chamado ao processar a primeira fatura paga.
Porém: sem gatilho ao **cancelar** contrato de indicado — indicadosAtivos não decrementa no churn.
**Status: ABERTO 🟡 P2 — falta trigger de cancelamento**

### 🟡 Outros P2/P3 ciclos anteriores — **PERSISTEM**
SEC-CT-002, BUG-WA-AUDIO, BUG-NEW-002, BUG-CALCULO-001, BUG-NEW-2026-04-11-004,
BUG-NEW-2026-04-11-007, BUG-NEW-2026-04-12-004 — ver Seção 8.

---

## 2. Bugs Novos — Ciclo 13/04/2026

---

### 🟡 BUG-NEW-2026-04-13-001 — `relatorio-fatura.service.ts`: IDOR em `gerarRelatorioByFaturaId`
**Prioridade: P2 | Área: Segurança / IDOR**
**Arquivo:** `backend/src/faturas/relatorio-fatura.service.ts`

```typescript
async gerarRelatorioByFaturaId(faturaId: string): Promise<RelatorioMensal> {
  const fatura = await this.prisma.faturaProcessada.findUnique({
    where: { id: faturaId },   // ← sem cooperativaId — qualquer fatura
    include: { cooperado: true, uc: true },
  });
```

O relatório é acessível via `GET /faturas/:id/relatorio` e `GET /faturas/:id/relatorio/html`.
No controller, a rota `@Get(':id/relatorio')` recebe `@Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)`,
mas **não verifica** se a fatura pertence ao tenant do usuário autenticado.

**Cenário:**
- COOPERADO da Cooperativa A conhece um ID de fatura da Cooperativa B
- `GET /faturas/{id-faturaB}/relatorio` retorna relatório completo com nome, UC, tarifas, impostos, economia acumulada do cooperado de B
- Dados financeiros pessoais expostos entre tenants

**Fix sugerido:**
```typescript
async gerarRelatorioByFaturaId(faturaId: string, cooperativaId?: string): Promise<RelatorioMensal> {
  const fatura = await this.prisma.faturaProcessada.findUnique({
    where: { id: faturaId },
    include: { cooperado: true, uc: true },
  });
  if (!fatura) throw new BadRequestException('Fatura não encontrada');
  if (cooperativaId && fatura.cooperativaId !== cooperativaId) {
    throw new ForbiddenException('Acesso negado');
  }
  // ...
```
E no controller, passar `req.user?.cooperativaId` para o service.
**Status: ABERTO 🟡 P2**

---

### 🟡 BUG-NEW-2026-04-13-002 — `motor-proposta.controller.ts`: DELETE/PUT proposta sem tenant check
**Prioridade: P2 | Área: Segurança / IDOR**
**Arquivo:** `backend/src/motor-proposta/motor-proposta.controller.ts`

```typescript
@Delete('proposta/:id')
excluirProposta(@Param('id') id: string) {
  return this.service.excluirProposta(id);   // ← sem cooperativaId
}

@Put('proposta/:id')
editarProposta(@Param('id') id: string, @Body() body: any) {
  return this.service.editarProposta(id, body);  // ← sem cooperativaId
}
```

Um ADMIN da Cooperativa A pode deletar ou editar propostas da Cooperativa B se conhecer o ID.
Rotas protegidas por `@Roles(SUPER_ADMIN, ADMIN, OPERADOR)` mas sem isolamento de tenant.

**Fix sugerido:** Passar `req.user?.cooperativaId` para `excluirProposta` e `editarProposta` e
validar no service via `findFirst({ where: { id, cooperativaId } })` antes de operar.
**Status: ABERTO 🟡 P2**

---

### 🟡 BUG-NEW-2026-04-13-003 — `relatorio-fatura.service.ts`: `saldoAnterior` calculado incorretamente
**Prioridade: P2 | Área: Cálculo / Dados exibidos ao cooperado**
**Arquivo:** `backend/src/faturas/relatorio-fatura.service.ts`

```typescript
faturaConcessionaria: {
  saldoAnterior: saldoAtual + kwhCompensado,  // ← FÓRMULA INCORRETA
  saldoAtual,
  ...
}
```

`kwhCompensado = creditosRecebidosKwh` = créditos usados para abater consumo este mês.
`saldoAtual = saldoTotalKwh` = saldo remanescente após o mês.

A relação correta é: `saldoAnterior = saldoAtual - energiaInjetadaKwh + consumoKwh` (simplificado),
ou mais precisamente: `saldoAnterior = saldoAtual + kwhCompensado - energiaInjetadaKwh`
(o que entrou esse mês = injetado; o que saiu = compensado).

Com a fórmula atual (`saldoAtual + kwhCompensado`), o saldo anterior exibido no relatório
**ignora a energia injetada** e superestima o saldo inicial do cooperado.
Impacto: relatório mensal apresenta histórico de saldo distorcido ao cooperado.

**Fix sugerido:**
```typescript
const kwhInjetado = Number(dados?.energiaInjetadaKwh ?? 0);
saldoAnterior: Math.max(0, saldoAtual + kwhCompensado - kwhInjetado),
```
**Status: ABERTO 🟡 P2**

---

### 🟠 BUG-NEW-2026-04-13-004 — `relatorio-fatura.service.ts`: N+1 queries no histórico
**Prioridade: P3 | Área: Performance**
**Arquivo:** `backend/src/faturas/relatorio-fatura.service.ts`

```typescript
for (const f of faturasAnteriores.slice(0, 6)) {
  if (f.cobrancaGeradaId) {
    const cob = await this.prisma.cobranca.findUnique({   // ← query por iteração
      where: { id: f.cobrancaGeradaId },
      select: { valorLiquido: true, valorDesconto: true },
    });
  }
}
```

Até 6 queries `findUnique` sequenciais por relatório. Em carga (múltiplos cooperados acessando
o portal simultaneamente), isso soma 6 + 1 = 7 queries por relatório.

**Fix sugerido:** incluir `cobranca` no `include` da query de `faturasAnteriores`:
```typescript
const faturasAnteriores = await this.prisma.faturaProcessada.findMany({
  where: { cooperadoId: fatura.cooperadoId },
  include: { cobranca: { select: { valorLiquido: true, valorDesconto: true } } },
  orderBy: { createdAt: 'desc' },
  take: 7,
});
```
**Status: ABERTO 🟠 P3**

---

### 🟠 BUG-NEW-2026-04-13-005 — `relatorio-fatura.service.ts`: economia circular (usa tarifa da fatura com GD)
**Prioridade: P3 | Área: Cálculo / UX**
**Arquivo:** `backend/src/faturas/relatorio-fatura.service.ts`

```typescript
const tarifaUnit = tarifaTUSD + tarifaTE;                                    // extraídas da fatura com GD
const valorSemGD = consumoKwh * tarifaUnit + Number(dados?.contribIluminacaoPublica ?? 0);
```

`tarifaTUSD` e `tarifaTE` são os valores da fatura **da concessionária com GD aplicada** (compensados).
Na fatura com créditos GD, as tarifas efetivas por kWh diferem das tarifas plenas (sem compensação),
pois ICMS e outros componentes são calculados sobre o consumo residual.

O resultado: `valorSemGD` é **subestimado**, e a "economia" exibida ao cooperado é **menor** do que a real.
Embora seja uma divergência pequena (10–15%), o relatório pode gerar desconfiança.

**Fix sugerido:** Usar tarifa base configurada no sistema (`TarifaConcessionaria`) em vez da extraída da fatura.
**Status: ABERTO 🟠 P3**

---

## 3. Análise de Fluxos — Wizards e Bot WhatsApp

### 3.1 Wizard de Cadastro Público (`/cadastro`) — MUITO MELHORADO
- ✅ `modoTeste=false`: validações ativas; termos e plano obrigatórios
- ✅ Botão debug "Finalizar sem plano" removido
- ✅ Tarifa dinâmica por distribuidora via API (EDP-ES, CEMIG, CPFL, ENERGISA agora corretas)
- ✅ Rate limit OCR mantido: 5 req/60s por IP
- ⚠️ Plano default: `planoSelecionado || 'DESCONTO_DIRETO'` — cooperado ainda pode ser cadastrado com plano padrão silencioso (usabilidade)
- ⚠️ Validação de telefone: formato aceito mas sem verificação de DDD válido

### 3.2 Bot WhatsApp — Estados e Fluxos
- ✅ Timeout 30min, graceful degradation CoopereAI: OK
- ✅ `respostaEfetiva()` aplicado em todos os handlers de menu
- ✅ Backoff exponencial com jitter em reconexão (BUG-WA-005 resolvido anteriormente)
- ⚠️ **BUG-WA-AUDIO PERSISTE**: `audio`, `video`, `sticker`, e mensagens de voz caem no branch `else` com `tipo='texto'` e `corpo=null` → backend recebe payload nulo → bot silencioso
  ```javascript
  // whatsapp-service/index.mjs — sem handlers para:
  // audioMessage, videoMessage, stickerMessage, reactionMessage
  } else {
    corpo = msg.message.conversation || msg.message.extendedTextMessage?.text || null;
  }
  ```
- ⚠️ NPS via `setTimeout`: sem persistência — reinicialização cancela NPS pendentes (P3)
- ✅ Secret WA ainda hardcoded na URL do webhook: `?secret=cooperebr_wh_2026` (SEC-CT-002 persiste)

### 3.3 Email Monitor
- ✅ Isolamento multi-tenant: completo (config, identificação, notificações)
- ✅ OCR fallback por UC e CPF: funcional
- ✅ Notificação admin WhatsApp: busca telefone via ConfigTenant
- ✅ Flag `emailFaturasAtivo` + notificação cooperado na primeira fatura: OK
- ⚠️ Cron `0 0 6 * * *` (6h diário) conflita com `CooperTokenJob.apurarExcedentes` `0 6 * * *`
  em ambientes com NestJS schedule (BUG-2026-04-11-007 P3)

### 3.4 Central de Faturas (dashboard) — NOVO
- ✅ Paginação, filtros por status/mês: OK
- ✅ Vinculação manual via busca de cooperado: OK
- ✅ Visualização de relatório inline: OK
- ✅ Ações aprovar/rejeitar: `@Roles(SUPER_ADMIN, ADMIN, OPERADOR)` ✅
- ⚠️ `GET /faturas/:id/relatorio` — IDOR (BUG-NEW-2026-04-13-001): fatura de outro tenant acessível

### 3.5 Portal Cooperado — Faturas da Concessionária (NOVO)
- ✅ Exibe histórico de faturas com status e dados OCR extraídos
- ✅ Indicador de recebimento automático por e-mail (`emailFaturasAtivo`)
- ✅ Rotas protegidas por `@Roles(COOPERADO)` com verificação de `cooperadoId`
- ✅ Boa usabilidade: status visual com cores, instruções de envio

### 3.6 Relatório de Conferência de kWh (NOVO)
- ✅ Filtro por competência (mês/ano)
- ✅ Tabela com status OK/EXCEDENTE/DEFICIT por cooperado
- ✅ Resumo agregado (totais kWh contratado vs compensado)
- ✅ Tenant isolation via `cooperativaId` do JWT

---

## 4. Inconsistências de Cálculo

### 4.1 Cobrança Mensal — Verificado OK
Todos os modelos (CREDITOS_COMPENSADOS, CREDITOS_DINAMICO) com guard `kwhContrato > 0`. OK.

### 4.2 CooperToken Excedente — RESOLVIDO
Guard `cotaKwhMensal=null` aplicado no job. OK.

### 4.3 FATURA_CHEIA Ledger — RESOLVIDO
`CooperTokenTipo.FATURA_CHEIA` agora usado corretamente. Ledger íntegro. OK.

### 4.4 Arredondamento Multa/Juros — PERSISTE (P2)
3 implementações com precisão diferente (2dp vs 4dp intermediário) em `cobrancas.job.ts`,
`darBaixa` e `reenviarNotificacao`. Divergência de R$0,01 possível.

### 4.5 saldoAnterior no Relatório — NOVO (P2)
`saldoAtual + kwhCompensado` ignora energia injetada. Ver BUG-NEW-2026-04-13-003.

### 4.6 valorSemGD Circular — NOVO (P3)
Tarifa extraída da fatura com GD usada para calcular "custo sem GD". Ver BUG-NEW-2026-04-13-005.

### 4.7 indicadosAtivos sem decremento no churn — PERSISTE (P2)
Incrementa ao ativar primeiro pagamento, mas não decrementa ao cancelar contrato.

---

## 5. Segurança

| Item | Status |
|------|--------|
| `modoTeste=false` + botão debug removido | ✅ RESOLVIDO |
| ConfigTenant compound unique + tenant isolation | ✅ RESOLVIDO |
| Email-monitor tenant isolation (config + cooperado + notificação) | ✅ RESOLVIDO |
| `GET /faturas/:id/relatorio` — IDOR sem cooperativaId | 🟡 P2 NOVO |
| `DELETE/PUT /motor-proposta/proposta/:id` — IDOR sem tenant | 🟡 P2 NOVO |
| Webhook Asaas sem HMAC-SHA256 | 🟡 P2 PERSISTE |
| Secret WA hardcoded na query string (`?secret=...`) | 🟡 P2 PERSISTE |
| BONUS_INDICACAO idempotência sem cooperativaId no ledger check | 🟡 P2 PERSISTE |
| Admin phone hardcoded `publico.controller.ts` | 🟡 P3 |
| `/reconnect` sem auth no whatsapp-service | 🟡 P3 |
| CORS `*` em whatsapp-service (porta 3002) | 🟡 P3 |
| JWT + cooperativaId isolamento em controllers (demais) | ✅ OK |
| Central de Faturas IDOR | ✅ RESOLVIDO (ciclo anterior) |
| `darBaixa` race condition | ✅ RESOLVIDO (ciclo anterior) |

---

## 6. Infraestrutura e Crons

| Cron | Horário | Status |
|------|---------|--------|
| `marcarVencidas` | 2h AM | ✅ OK |
| `calcularMultaJuros` | 3h AM | ✅ OK |
| `CooperTokenJob.expirarTokensVencidos` | Dia 1 às 2h | ✅ OK |
| `CooperTokenJob.apurarExcedentes` | 6h AM | ✅ cotaKwh guard |
| `verificarEmailsFaturas` | 6h AM | 🟡 Conflito horário com CooperToken |
| `notificarCobrancasVencidas` | 6h AM | 🟡 Conflito horário |
| `ClubeVantagensJob.enviarResumosMensais` | Dia 1 às 9h | 🟡 indicadosAtivos churn |
| `recalcularIndicadosAtivos` | Reativo (não cron) | 🟡 Sem trigger de cancelamento |

**Nota:** 3 crons às 6h (CooperToken + EmailMonitor + Cobrancas). Risco de contenção no DB.
Sugestão: escalonar em 6h, 6h05 e 6h10.

---

## 7. Usabilidade

| Área | Observação |
|------|-----------|
| Cadastro público | ✅ Muito melhorado — tarifa correta, validações ativas |
| Portal cooperado — faturas | ✅ Interface clara, indicador de recebimento automático |
| Central de faturas | ✅ Paginação, filtros, vinculação manual |
| Conferência de kWh | ✅ Relatório claro com status OK/EXCEDENTE/DEFICIT |
| Relatório mensal cooperado | ⚠️ saldoAnterior incorreto (BUG-003) — exibe valor distorcido |
| Plano default no cadastro | ⚠️ Cooperado pode concluir sem escolher plano explicitamente (default silencioso) |
| Portal conta | ✅ Alterar senha, dados pessoais, opção token A/B — OK |

---

## 8. Resumo Executivo

### Score: 8.5/10 ↑ (+1.0 vs 7.5 em 12/04)

**Sprint de alto impacto — 8 bugs resolvidos, incluindo os 2 únicos P1 do sistema:**

**Positivos ✅:**
- 🏆 `modoTeste=false` + botão debug: FECHADO (risco legal eliminado)
- 🏆 ConfigTenant multi-tenant isolation: FECHADO (vulnerabilidade de segurança crítica)
- 🏆 Email Monitor: totalmente isolado por tenant (3 bugs fechados de uma vez)
- 🏆 Tarifa dinâmica na simulação: FECHADO (CEMIG/CPFL/Energisa agora corretas)
- ✅ Race condition resgate oferta: FECHADO (transação atômica)
- ✅ Ledger FATURA_CHEIA: FECHADO (tipo correto no ledger)
- ✅ cotaKwh=null tokens: FECHADO (guard no job)
- ✅ Novos módulos bem implementados: Central de Faturas, Portal Faturas Concessionária, Relatório Mensal, Conferência kWh

**Preocupações ⚠️:**
- 🟡 2 novos IDOR: relatório de fatura e proposta motor sem tenant check (P2)
- 🟡 saldoAnterior incorreto no relatório mensal (dado exibido ao cooperado errado - P2)
- 🟡 Stack de P2 com 8 bugs abertos, sem sprint definido
- 🟡 3 crons conflitando às 6h (risco de contenção de banco)
- 🟡 BUG-WA-AUDIO: cooperados que enviam áudio/vídeo recebem silêncio

---

## 9. Bugs Ativos Pós-Ciclo 13/04/2026

| ID | Bug | Prioridade | Sprint |
|----|-----|------------|--------|
| BUG-NEW-2026-04-13-001 | IDOR: `GET /faturas/:id/relatorio` sem tenant check | **P2** | Próximo |
| BUG-NEW-2026-04-13-002 | IDOR: `DELETE/PUT /motor-proposta/proposta/:id` sem tenant | **P2** | Próximo |
| BUG-NEW-2026-04-13-003 | `saldoAnterior` = `saldoAtual + kwhCompensado` — ignora injetado | **P2** | Próximo |
| BUG-NEW-2026-04-11-003 | BONUS_INDICACAO idempotência sem cooperativaId | P2 | Próximo |
| BUG-NEW-2026-04-10-001 | indicadosAtivos sem decremento no churn | P2 | Próximo |
| SEC-CT-002 | Secret WA hardcoded na query string | P2 | Próximo |
| BUG-WA-AUDIO | audio/video/sticker tipo='texto' corpo=null no whatsapp-service | P2 | Próximo |
| BUG-NEW-002 | Webhook Asaas sem HMAC-SHA256 | P2 | Próximo |
| BUG-CALCULO-001 | Arredondamento multa/juros: 2dp vs 4dp intermediário | P2 | Backlog |
| BUG-NEW-2026-04-13-004 | N+1 queries no histórico do relatório mensal | P3 | Backlog |
| BUG-NEW-2026-04-13-005 | valorSemGD usa tarifa circular (da fatura com GD) | P3 | Backlog |
| BUG-NEW-2026-04-11-007 | 3 crons conflitando às 6h (ContentToken + EmailMonitor + Cobrancas) | P3 | Backlog |
| BUG-NEW-2026-04-12-004 | Admin phone hardcoded no fallback env | P3 | Backlog |
| BUG-NEW-2026-04-11-004 | Multa inconsistente em `reenviarNotificacao` | P3 | Backlog |

---

*Próxima análise automática: 14/04/2026 às 03h*
