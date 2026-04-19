# Relatório QA — CoopereBR
**Data:** 2026-04-14 | **Horário:** 03:00 (America/Sao_Paulo) — ciclo noturno automático
**Score:** 8.3/10 ↓ (−0.2 vs 8.5 ciclo 13/04) — sem commits novos; 3 novos bugs encontrados
**Críticos P1:** 0 (todos fechados ✅) | **P2 ativos:** 10 (+2) | **P3:** 8 (+1)
**Gerado por:** Assis — análise profunda sem commits novos desde 2026-04-13 03:00

---

## 1. Status dos Itens do Ciclo Anterior (13/04/2026)

**Sem novos commits desde 13/04 03:00** — todos os itens do último ciclo mantêm status inalterado.

### ✅ Bugs resolvidos anteriores — MANTIDOS
- BUG-NEW-2026-04-11-001 — modoTeste=false + botão debug: ✅ FECHADO
- BUG-NEW-2026-04-12-001 — ConfigTenant @unique multi-tenant: ✅ FECHADO
- BUG-NEW-2026-04-12-002/003 — email-monitor tenant isolation: ✅ FECHADO
- BUG-NEW-2026-04-11-002 — Tarifa dinâmica por distribuidora: ✅ FECHADO
- BUG-NEW-2026-04-11-005/006/008 — race condition resgate, ledger FATURA_CHEIA, cotaKwh null: ✅ FECHADOS

### 🟡 Bugs P2 do ciclo anterior — TODOS PERSISTEM (sem correção aplicada)

| ID | Bug | Prioridade |
|----|-----|------------|
| BUG-NEW-2026-04-13-001 | IDOR: GET /faturas/:id/relatorio sem tenant check | P2 |
| BUG-NEW-2026-04-13-002 | IDOR: DELETE/PUT /motor-proposta/proposta/:id sem tenant | P2 |
| BUG-NEW-2026-04-13-003 | saldoAnterior = saldoAtual + kwhCompensado (ignora injetado) | P2 |
| BUG-NEW-2026-04-11-003 | BONUS_INDICACAO idempotência sem cooperativaId | P2 |
| BUG-NEW-2026-04-10-001 | indicadosAtivos sem decremento no churn | P2 |
| SEC-CT-002 | Secret WA hardcoded na query string | P2 |
| BUG-WA-AUDIO | audio/video/sticker corpo=null no whatsapp-service | P2 |
| BUG-NEW-002 | Webhook Asaas sem HMAC-SHA256 | P2 |

---

## 2. Bugs Novos — Ciclo 14/04/2026

---

### 🟡 BUG-NEW-2026-04-14-001 — `relatorio-fatura.service.ts`: `kwhInjetado` recebe valor de `kwhCompensado`
**Prioridade: P2 | Área: Cálculo / Dado exibido ao cooperado**
**Arquivo:** `backend/src/faturas/relatorio-fatura.service.ts`

```typescript
const kwhCompensado = Number(dados?.creditosRecebidosKwh ?? 0);
// ...
faturaConcessionaria: {
  kwhCompensado,
  kwhInjetado: kwhCompensado,   // ← ERRADO: usa creditosRecebidos como injetado
  // deveria ser: Number(dados?.energiaInjetadaKwh ?? 0)
```

**Conceito correto:**
- `kwhCompensado` = `creditosRecebidosKwh` = energia que a concessionária usou para abater o consumo
- `kwhInjetado` = `energiaInjetadaKwh` = energia enviada pela usina para a rede este mês (pode ser maior ou menor que o compensado, pois o saldo transita entre meses)

Os dois valores são distintos e frequentemente divergem. A fatura da concessionária os apresenta separadamente. O relatório exibe o mesmo número nos dois campos, confundindo o cooperado sobre sua geração vs. compensação.

**Fix sugerido:**
```typescript
kwhInjetado: Number(dados?.energiaInjetadaKwh ?? 0),
```
**Status: ABERTO 🟡 P2**

---

### 🟡 BUG-NEW-2026-04-14-002 — `faturas.service.ts`: `deletarFatura` e `rejeitarFatura` sem verificação de cooperativaId (IDOR)
**Prioridade: P2 | Área: Segurança / IDOR**
**Arquivo:** `backend/src/faturas/faturas.service.ts` + `faturas.controller.ts`

```typescript
// faturas.service.ts
async deletarFatura(id: string): Promise<{ sucesso: boolean }> {
  await this.prisma.faturaProcessada.delete({ where: { id } });  // ← sem cooperativaId
  return { sucesso: true };
}

async rejeitarFatura(id: string, motivo?: string) {
  return this.prisma.faturaProcessada.update({
    where: { id },                   // ← sem cooperativaId
    data: { status: 'REJEITADA', statusRevisao: 'REJEITADO' },
  });
}

// faturas.controller.ts
@Delete(':id')
@Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
deletar(@Param('id') id: string): Promise<unknown> {
  return this.faturasService.deletarFatura(id);   // ← req.user.cooperativaId não passado
}

@Patch(':id/rejeitar')
@Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
rejeitar(@Param('id') id: string, @Body() body?: { motivo?: string }): Promise<unknown> {
  return this.faturasService.rejeitarFatura(id, body?.motivo);  // ← sem cooperativaId
}
```

**Cenário de impacto:**
- ADMIN da Cooperativa A conhece o ID de uma fatura da Cooperativa B
- `DELETE /faturas/{idFaturaB}` → deleta fatura de outro tenant sem restrição
- `PATCH /faturas/{idFaturaB}/rejeitar` → rejeita fatura de outro tenant

**Fix sugerido:**
```typescript
// service
async deletarFatura(id: string, cooperativaId?: string): Promise<{ sucesso: boolean }> {
  if (cooperativaId) {
    const fatura = await this.prisma.faturaProcessada.findFirst({
      where: { id, cooperado: { cooperativaId } },
    });
    if (!fatura) throw new ForbiddenException('Fatura não encontrada nesta cooperativa');
  }
  await this.prisma.faturaProcessada.delete({ where: { id } });
  return { sucesso: true };
}
// controller: passar req.user?.cooperativaId
```
**Status: ABERTO 🟡 P2**

---

### 🟠 BUG-NEW-2026-04-14-003 — `relatorio-fatura.service.ts`: histórico usa multiplicador `* 0.15` hardcoded para economia
**Prioridade: P3 | Área: Cálculo / Histórico**
**Arquivo:** `backend/src/faturas/relatorio-fatura.service.ts`

```typescript
historico.push({
  mes: f.mesReferencia ?? d?.mesReferencia ?? '',
  kwhCompensado: Number(d?.creditosRecebidosKwh ?? 0),
  valorCobrado: cobValor,
  economia: Number(d?.creditosRecebidosKwh ?? 0) * tarifaUnit * 0.15,  // ← 0.15 hardcoded
});
```

O valor de economia no histórico é calculado como `kwhCompensado × tarifaUnit × 0.15`. O fator `0.15` é arbitrário — assume 15% de desconto independente do percentualDesconto real do contrato do cooperado (que pode ser 10%, 18%, 25%, etc.).

A economia real seria: `kwhCompensado × tarifaUnit × (percentualDesconto / 100)` — ou, se disponível, `cobranca.valorDesconto` direto.

O campo `valorCobrado` está sendo buscado corretamente da cobrança via `cob.valorLiquido`. Mas `economia` diverge da realidade para cooperados com desconto diferente de 15%.

**Fix sugerido:** Usar o `cob.valorDesconto` quando disponível, ou fallback com o percentual real do contrato.
**Status: ABERTO 🟠 P3**

---

## 3. Análise de Fluxos — Wizards e Bot WhatsApp

### 3.1 Wizard de Cadastro Público (`/cadastro`) — OK com ressalvas
- ✅ `modoTeste=false`: validações ativas, botão debug removido
- ✅ Tarifa dinâmica por distribuidora via API
- ⚠️ Validações básicas (`nome`, `cpf`, `telefone`) comentadas em `cadastroWeb`:
  ```typescript
  // if (!body.nome || !body.cpf || !body.email || !body.telefone) {
  //   throw new BadRequestException('Nome, CPF, email e telefone são obrigatórios');
  // }
  // if (cpfLimpo.length !== 11) { throw new BadRequestException('CPF inválido'); }
  ```
  Em produção, isso permite criar leads com CPF vazio ou inválido — risco de dados sujos no banco.
  **Status: P3 (dados de qualidade)**
- ⚠️ Plano default: `planoSelecionado || 'DESCONTO_DIRETO'` — silencioso (P3)

### 3.2 Bot WhatsApp — Estados e Fluxos
- ✅ Timeout 30min, graceful degradation CoopereAI, backoff exponencial: OK
- ✅ `respostaEfetiva()` em todos os handlers de menu
- ✅ Buffer de mensagens durante reconexão (BUG-WA-005): OK
- 🟡 **BUG-WA-AUDIO PERSISTE** — `audioMessage`, `videoMessage`, `stickerMessage`, `reactionMessage` caem no `else`:
  ```javascript
  } else {
    corpo = msg.message.conversation || msg.message.extendedTextMessage?.text || null;
  }
  // resultado: tipo='texto', corpo=null → bot silencioso para o cooperado
  ```
- ⚠️ Secret WA ainda hardcoded na URL do webhook: `?secret=cooperebr_wh_2026` (SEC-CT-002)
- ⚠️ CORS `*` no whatsapp-service (porta 3002) — qualquer origem pode acessar `/reconnect` sem auth

### 3.3 Email Monitor
- ✅ Isolamento multi-tenant: completo
- ✅ OCR fallback UC/CPF, notificação admin via ConfigTenant: OK
- ⚠️ Cron 6h AM conflita com CooperTokenJob (`0 6 * * *`) — risco de contenção DB

### 3.4 Relatório Mensal Cooperado — NOVO BUG HOJE
- ⚠️ `kwhInjetado: kwhCompensado` — dado errado (BUG-NEW-2026-04-14-001)
- ⚠️ `saldoAnterior = saldoAtual + kwhCompensado` — ignora energia injetada (BUG-NEW-2026-04-13-003, persiste)
- ⚠️ Histórico: economia calculada com `* 0.15` hardcoded (BUG-NEW-2026-04-14-003)
- ✅ Paginação, filtros, vinculação manual: OK

### 3.5 Central de Faturas
- ✅ Isolamento tenant para listagem e resumo: OK
- ✅ Aprovação, vinculação manual: OK com `req.user.cooperativaId`
- 🟡 Deleção e rejeição sem tenant check: IDOR (BUG-NEW-2026-04-14-002)
- 🟡 `GET :id/relatorio` sem tenant check: IDOR (BUG-NEW-2026-04-13-001, persiste)

---

## 4. Inconsistências de Cálculo

### 4.1 Cobrança Mensal (`calcularCobrancaMensal` e `aprovarFatura`)
- ✅ Guards `kwhContrato > 0` e fallback via GeracaoMensal: OK
- ✅ Hierarquia de modelo de cobrança (override contrato → usina → config → plano): OK
- ✅ Tarifa por distribuidora (TUSD+TE, match fuzzy): OK

### 4.2 Multa/Juros — 3 implementações divergentes (BUG-CALCULO-001, PERSISTE P2)
| Local | Precisão intermediária | Arredondamento final |
|-------|----------------------|----------------------|
| `cobrancas.job.ts` (`calcularMultaJuros`) | `Math.round(... * 100) / 100` (2dp) | 2dp |
| `darBaixa` | `Math.round(... * 1e4) / 1e4` (4dp) | 2dp |
| `reenviarNotificacao` | sem arredondamento intermediário | 2dp |

Divergência de R$0,01–R$0,02 possível dependendo do caminho de execução. Fatura cobrada via job vs. via darBaixa pode apresentar valor diferente.

### 4.3 saldoAnterior — PERSISTE (P2)
`saldoAtual + kwhCompensado` ignora energia injetada. Ver BUG-NEW-2026-04-13-003.

### 4.4 kwhInjetado errado — NOVO (P2)
`kwhInjetado: kwhCompensado` em vez de `dados.energiaInjetadaKwh`. Ver BUG-NEW-2026-04-14-001.

### 4.5 Histórico economia hardcoded `* 0.15` — NOVO (P3)
Ver BUG-NEW-2026-04-14-003.

### 4.6 indicadosAtivos sem decremento no churn — PERSISTE (P2)
Incrementa via `cobranca.primeira.paga` event, mas sem listener em `contrato.cancelado`.

### 4.7 BONUS_INDICACAO sem cooperativaId no ledger check — PERSISTE (P2)
`processarPrimeiraFaturaPaga` não filtra por `cooperativaId` ao verificar duplicata no ledger.

---

## 5. Segurança

| Item | Status |
|------|--------|
| modoTeste=false + botão debug removido | ✅ RESOLVIDO |
| ConfigTenant compound unique + tenant isolation | ✅ RESOLVIDO |
| Email-monitor tenant isolation | ✅ RESOLVIDO |
| Central de Faturas IDOR listagem/resumo | ✅ RESOLVIDO |
| `GET /faturas/:id/relatorio` — IDOR sem cooperativaId | 🟡 P2 PERSISTE |
| `DELETE/PUT /motor-proposta/proposta/:id` — IDOR | 🟡 P2 PERSISTE |
| **`DELETE /faturas/:id` — IDOR sem tenant check (NOVO)** | 🟡 **P2 NOVO** |
| **`PATCH /faturas/:id/rejeitar` — IDOR sem tenant check (NOVO)** | 🟡 **P2 NOVO** |
| Webhook Asaas sem HMAC-SHA256 | 🟡 P2 PERSISTE |
| Secret WA hardcoded na query string | 🟡 P2 PERSISTE |
| BONUS_INDICACAO idempotência sem cooperativaId | 🟡 P2 PERSISTE |
| Validações básicas comentadas em `cadastroWeb` | 🟠 P3 |
| `/reconnect` sem auth no whatsapp-service | 🟠 P3 |
| CORS `*` em whatsapp-service | 🟠 P3 |
| Admin phone hardcoded (`publico.controller.ts`) | 🟠 P3 |

**Observação:** Os dois novos IDOR (deletar/rejeitar fatura) são de menor impacto que os anteriores (apenas admins autenticados podem explorar), mas em ambiente multi-cooperativa com clientes distintos, a separação de tenant é mandatória.

---

## 6. Infraestrutura e Crons

| Cron | Horário | Status |
|------|---------|--------|
| `marcarVencidas` | 2h AM | ✅ OK |
| `calcularMultaJuros` | 3h AM | ✅ OK |
| `CooperTokenJob.expirarTokensVencidos` | Dia 1 às 2h | ✅ OK |
| `CooperTokenJob.apurarExcedentes` | 6h AM | ✅ cotaKwh guard OK |
| `verificarEmailsFaturas` | 6h AM | 🟡 Conflito horário (3 crons às 6h) |
| `notificarCobrancasVencidas` | 6h AM | 🟡 Conflito horário |
| `ClubeVantagensJob.enviarResumosMensais` | Dia 1 às 9h | 🟡 indicadosAtivos churn |

**3 crons concorrentes às 6h AM:** `CooperTokenJob.apurarExcedentes` + `email-monitor.verificarEmails` + notificações de cobrança. Com base de dados em crescimento, risco de lock contention aumenta. Recomendação: escalonar para 6h00, 6h05, 6h10.

---

## 7. Usabilidade

| Área | Observação |
|------|-----------|
| Cadastro público | ✅ Muito melhorado — tarifa correta, validações ativas |
| Validações básicas lead web | ⚠️ CPF/telefone/nome validações comentadas (leads inválidos possíveis) |
| Portal cooperado — relatório mensal | ⚠️ kwhInjetado errado (NOVO), saldoAnterior incorreto (PERSISTE) |
| Portal cooperado — faturas concessionária | ✅ Interface clara, indicador de recebimento automático |
| Central de faturas | ✅ Paginação, filtros, vinculação manual |
| Bot WhatsApp | ⚠️ Silêncio para áudio/vídeo/sticker (frustração do usuário) |
| Histórico economia (relatório mensal) | ⚠️ Valor de economia calculado com fator arbitrário |

---

## 8. Resumo Executivo

### Score: 8.3/10 ↓ (−0.2 vs 8.5 em 13/04)

**Ciclo sem commits** — todos os bugs P2 do ciclo anterior permanecem abertos; 3 novos bugs identificados na análise de código estático.

**Positivos ✅:**
- Stack de tecnologia estável — sem regressões nem novos P1
- Módulos recentes (Central de Faturas, Relatório Mensal, Conferência kWh) funcionais
- Fluxo de cobrança e CooperToken: sólido após sprint de correções de 12/04
- Email Monitor: totalmente isolado por tenant

**Preocupações ⚠️:**
- 🟡 `kwhInjetado` exibe `kwhCompensado` (valor errado no relatório cooperado)
- 🟡 `DELETE /faturas/:id` e `PATCH /faturas/:id/rejeitar` sem tenant check (2 novos IDOR)
- 🟡 Stack de 10 bugs P2 abertos — sem sprint de correção agendado
- 🟡 3 crons conflitando às 6h (risco de contenção crescente)
- 🟡 BUG-WA-AUDIO: cooperados que enviam áudio/vídeo recebem silêncio (UX ruim)
- 🟠 Validações básicas (`nome`, `cpf`) comentadas no `cadastroWeb` (dados sujos em produção)

**Prioridade sugerida para próximo sprint:**
1. BUG-NEW-2026-04-14-002 — IDOR deletar/rejeitar fatura (rápido de corrigir)
2. BUG-NEW-2026-04-14-001 — kwhInjetado errado (1 linha de fix)
3. BUG-NEW-2026-04-13-001 — IDOR relatorio fatura (+ BUG-NEW-2026-04-13-002 proposta)
4. BUG-NEW-2026-04-13-003 — saldoAnterior fórmula incorreta
5. BUG-WA-AUDIO — handlers áudio/vídeo no whatsapp-service

---

## 9. Bugs Ativos Pós-Ciclo 14/04/2026

| ID | Bug | Prioridade | Sprint |
|----|-----|------------|--------|
| **BUG-NEW-2026-04-14-001** | **kwhInjetado usa kwhCompensado (valor errado no relatório)** | **P2** | **Próximo** |
| **BUG-NEW-2026-04-14-002** | **IDOR: DELETE /faturas/:id e PATCH /:id/rejeitar sem tenant** | **P2** | **Próximo** |
| BUG-NEW-2026-04-13-001 | IDOR: GET /faturas/:id/relatorio sem tenant check | P2 | Próximo |
| BUG-NEW-2026-04-13-002 | IDOR: DELETE/PUT /motor-proposta/proposta/:id sem tenant | P2 | Próximo |
| BUG-NEW-2026-04-13-003 | saldoAnterior = saldoAtual + kwhCompensado (ignora injetado) | P2 | Próximo |
| BUG-NEW-2026-04-11-003 | BONUS_INDICACAO idempotência sem cooperativaId | P2 | Próximo |
| BUG-NEW-2026-04-10-001 | indicadosAtivos sem decremento no churn | P2 | Próximo |
| SEC-CT-002 | Secret WA na query string / hardcoded nos logs | P2 | Próximo |
| BUG-WA-AUDIO | audio/video/sticker tipo='texto' corpo=null no whatsapp-service | P2 | Próximo |
| BUG-NEW-002 | Webhook Asaas sem HMAC validation | P2 | Backlog |
| BUG-CALCULO-001 | Arredondamento multa/juros: 3 implementações divergentes | P2 | Backlog |
| **BUG-NEW-2026-04-14-003** | **Histórico economia usa * 0.15 hardcoded** | P3 | Backlog |
| BUG-NEW-2026-04-13-004 | N+1 queries no histórico do relatório mensal | P3 | Backlog |
| BUG-NEW-2026-04-13-005 | valorSemGD usa tarifa circular (da fatura com GD) | P3 | Backlog |
| BUG-NEW-2026-04-11-007 | 3 crons conflitando às 6h | P3 | Backlog |
| BUG-NEW-2026-04-12-004 | Admin phone hardcoded no fallback env | P3 | Backlog |
| BUG-NEW-2026-04-11-004 | Multa inconsistente em reenviarNotificacao | P3 | Backlog |

---

*Próxima análise automática: 15/04/2026 às 03h*
