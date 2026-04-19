# Relatório QA — CoopereBR
**Data:** 2026-04-18 | **Horário:** 08:02 (America/Sao_Paulo) — ciclo noturno automático
**Score:** 9.0/10 ↑ (+0.5 vs 8.5 em 17/04) — Sprint de correção + 3 features novas; 1 P2 novo em cross-tenant
**Críticos P1:** 0 ✅ | **P2 ativos:** 4 (−4) | **P3 ativos:** 12 (+4)
**Gerado por:** Assis — análise profunda de 19 commits desde 17/04 03:00

---

## 1. Status dos Itens do Ciclo Anterior (17/04/2026)

**19 commits desde 17/04 03:00** — sprint de correção concentrada + novas features de bandeira tarifária e consumo mínimo.

### ✅ Todos os P2 do ciclo anterior RESOLVIDOS

| ID | Bug | Status |
|----|-----|--------|
| BUG-NEW-2026-04-17-001 | confirmar-nova-uc: 300 kWh fallback fictício | ✅ RESOLVIDO (`85cea6c` + `3a4b18c`) |
| BUG-NEW-2026-04-17-002 | novaUcComFatura: UC criada sem rollback | ✅ RESOLVIDO (`9c805d8`) |
| BUG-NEW-2026-04-17-003 | DocumentosAprovacaoJob: aprova sem revisão humana | ✅ RESOLVIDO (`85cea6c`) |
| BUG-NEW-2026-04-17-004 | cadastroWebV2: outlier silencioso — propostaId=null | ✅ RESOLVIDO (`85cea6c`) |
| BUG-NEW-2026-04-15-001 | contas-pagar: sem class-validator DTOs | ✅ RESOLVIDO (`3bfc86a`) |
| BUG-NEW-2026-04-15-002 | contas-pagar: SUPER_ADMIN info leak inter-tenant | ✅ RESOLVIDO (`af13f7c`) |
| BUG-NEW-2026-04-11-003 | BONUS_INDICACAO idempotência sem cooperativaId | ✅ RESOLVIDO (`84bc657` + `aefd1eb`) |
| BUG-CALCULO-001 | Multa/juros: 3 implementações divergentes | ✅ RESOLVIDO (`1670a26`) |

### ✅ P3 do ciclo anterior RESOLVIDOS

| ID | Bug | Status |
|----|-----|--------|
| BUG-NEW-2026-04-17-005 | ModalNovaUc: outlier sem UI de resolução | ✅ RESOLVIDO (`85cea6c`) |
| BUG-NEW-2026-04-17-006 | UcChart: gráfico de consumo sempre vazio | ✅ RESOLVIDO (`3a4b18c`) |

---

## 2. Features Entregues — Ciclo 18/04/2026

### 2.1 Bandeira Tarifária (3 commits: `cf61621`, `a3e8cf0`, `a70e63b`)
- CRUD backend + tela de administração
- Automação ANEEL: job mensal busca bandeira vigente do CSV de dados abertos
- Integração no billing: soma `valorBandeira` à cobrança mensal quando `bandeiraAtiva=true`
- Toggle por cooperativa: `bandeiraAtiva` (aplica na cobrança) e `bandeiraSincronizacaoAuto` (auto-sync ANEEL)
- Exibição na fatura do cooperado (commit `04024af`)

### 2.2 Consumo Mínimo Faturável (`6c30754`, `763faae`, `9f3073d`)
- Novos campos em `ConfiguracaoMotor`: `consumoMinimoFaturavelAtivo`, `consumoMinimoMonofasicoKwh/BifasicoKwh/TrifasicoKwh`
- Deduzido do `kwhCobranca` antes do cálculo do `valorBruto`
- Configurável por tipo de fornecimento (Mono/Bi/Trifásico)
- Tela config motor atualizada

### 2.3 Plano — descontoBase obrigatório (`7520b22`)
- `@Min(1)` em `CreatePlanoDto` e `UpdatePlanoDto`
- Frontend valida antes de enviar
- Refactor: planoId obrigatório no motor; desconto vem exclusivamente do Plano

### 2.4 Correções acumuladas
- `confirmar-nova-uc`: aceita `consumoKwh`+`valorFatura` no body (vindos do OCR)
- `novaUcComFatura`: motor calculado ANTES de criar UC (sem órfãs)
- `DocumentosAprovacaoJob`: guarda se todos os docs ainda PENDENTE → pula aprovação automática
- `cadastroWebV2`: retorna `ok:false, erro:'OUTLIER_DETECTADO'` com opções
- `ModalNovaUc`: UI de outlier detectado com mensagem clara
- `UcChart`: usa `valorLiquido` como fallback quando não há dados kWh
- Multa/juros unificados em `CalculoMultaJurosService`
- `BONUS_INDICACAO`: unique index parcial + guard cooperativaId em 2 camadas
- `contas-pagar`: DTOs com class-validator + guard SUPER_ADMIN cooperativaId

---

## 3. Bugs Novos — Ciclo 18/04/2026

---

### 🟡 BUG-NEW-2026-04-18-001 — `calcularCobrancaMensal`: ConfiguracaoMotor sem filtro por `cooperativaId`
**Prioridade: P2 | Área: Multi-tenant / Cálculo de Cobrança**
**Arquivo:** `backend/src/cobrancas/cobrancas.service.ts:701`

```typescript
// Passo 9 — Consumo mínimo faturável
const configMotor = await this.prisma.configuracaoMotor.findFirst({
  orderBy: { updatedAt: 'desc' },   // ← sem WHERE cooperativaId !
});
if (configMotor?.consumoMinimoFaturavelAtivo) {
  // usa configMotor.consumoMinimoMonofasicoKwh etc.
}
```

**Problema:** `ConfiguracaoMotor` tem campo `cooperativaId String?`, mas a query busca o registro mais recentemente atualizado de QUALQUER cooperativa. Em ambiente multi-tenant:
- Cooperativa B atualiza sua config de consumo mínimo às 10h
- Cooperativa A gera cobranças às 11h
- `findFirst({ orderBy: { updatedAt: 'desc' } })` retorna o config da **Cooperativa B**
- Cooperativa A tem consumo mínimo deduzido com valores incorretos

**Impacto:** Cobranças com kWh e valor errados para cooperativas que usam o consumo mínimo faturável.

**Fix sugerido:**
```typescript
const configMotor = await this.prisma.configuracaoMotor.findFirst({
  where: {
    OR: [
      { cooperativaId: contrato.cooperativaId },
      { cooperativaId: null },  // fallback global se não há config por tenant
    ],
  },
  orderBy: [
    { cooperativaId: 'desc' },  // prioriza config de tenant sobre global
    { updatedAt: 'desc' },
  ],
});
```

**Status: ABERTO 🟡 P2**

---

### 🟠 BUG-NEW-2026-04-18-002 — `tipoFornecimento = null` → sempre usa mínimo trifásico (default silencioso)
**Prioridade: P3 | Área: Cálculo / Dados**
**Arquivo:** `backend/src/cobrancas/cobrancas.service.ts:713`

```typescript
const tipo = (contrato.uc?.tipoFornecimento ?? '').toUpperCase();
if (tipo === 'MONOFASICO') {
  kwhMinimoFaturavel = configMotor.consumoMinimoMonofasicoKwh;   // 30 kWh
} else if (tipo === 'BIFASICO') {
  kwhMinimoFaturavel = configMotor.consumoMinimoBifasicoKwh;     // 50 kWh
} else {
  kwhMinimoFaturavel = configMotor.consumoMinimoTrifasicoKwh;   // 100 kWh ← default para null
}
```

`tipoFornecimento` é campo nullable na UC. UCs sem esse campo preenchido (a maioria, pois foi adicionado recentemente) caem no default trifásico (100 kWh), que é o maior dos três mínimos. Cooperados residenciais/monofásicos podem ter 70 kWh deduzidos a mais.

**Fix sugerido:** Avisar explicitamente no log e/ou retornar 0 (não aplicar mínimo) quando `tipoFornecimento` é null:
```typescript
if (!tipo) {
  avisos.push('ATENÇÃO: tipoFornecimento não definido na UC — consumo mínimo não aplicado');
  // kwhMinimoFaturavel = 0 (mantém valor inicial)
} else if (tipo === 'MONOFASICO') { ... }
```

**Status: ABERTO 🟠 P3**

---

### 🟠 BUG-NEW-2026-04-18-003 — `BandeiraAneelService`: cron mensal sem retry + sem notificação admin quando CSV offline
**Prioridade: P3 | Área: Infraestrutura / Integridade Financeira**
**Arquivo:** `backend/src/bandeira-tarifaria/bandeira-aneel.service.ts:33`

```typescript
const response = await fetch(CSV_ACIONAMENTO);
if (!response.ok) {
  this.logger.error(`Falha ao buscar CSV ANEEL: HTTP ${response.status}`);
  return null;  // ← silencioso: bandeira do mês não criada
}
// Sem retry, sem notificação admin, sem agendamento de fallback
```

O job roda no **dia 1 de cada mês às 6h**. Se o servidor ANEEL estiver offline nesse momento:
- Bandeira do mês não é criada
- Cooperativas com `bandeiraAtiva=true` não cobram a tarifa adicional em todo o mês
- Nenhum admin é notificado
- A próxima tentativa só ocorre no mês seguinte

**Fix sugerido:** Implementar retry com backoff, e/ou notificar admin via WhatsApp/e-mail em caso de falha persistente.

**Status: ABERTO 🟠 P3**

---

### 🟠 BUG-NEW-2026-04-18-004 — Novo cron `BandeiraSincronizacaoAuto` não documentado + conflito 6h dia 1
**Prioridade: P3 | Área: Infraestrutura / Inventário de Crons**
**Arquivo:** `backend/src/bandeira-tarifaria/bandeira-aneel.service.ts`

```typescript
@Cron('0 6 1 * *')  // Dia 1 de cada mês às 6h
async sincronizarAutomatico() { ... }
```

Inventário de crons atualizado:

| Cron | Horário | Conflito |
|------|---------|---------|
| `BandeiraAneelService.sincronizarAutomatico` | **6h AM dia 1** | ⚠️ **NOVO** |
| `CooperTokenJob.apurarExcedentes` | 6h AM | ⚠️ Conflito (todo mês dia 1) |
| `email-monitor.verificarEmails` | 6h AM | ⚠️ Conflito (todo mês dia 1) |

No dia 1 de cada mês às 6h, 3 jobs rodam simultaneamente, incluindo o novo de bandeira ANEEL.

**Status: ABERTO 🟠 P3**

---

### 🟠 BUG-NEW-2026-04-18-005 — `descontoBase @Min(1)` bloqueia planos de 0% (testes/campanhas internas)
**Prioridade: P3 | Área: Validação / Business Logic**
**Arquivo:** `backend/src/planos/dto/create-plano.dto.ts`

```typescript
@IsNotEmpty() @IsNumber()
@Min(1, { message: 'Desconto base deve ser pelo menos 1%' })
@Max(100)
descontoBase!: number;
```

Planos de 0% desconto (cooperados em período de carência, promoção "fatura cheia sem desconto", planos internos de teste) são bloqueados pela validação. Não há como criar um plano FATURA_CHEIA_TOKEN onde o cooperado não recebe desconto financeiro direto — apenas tokens.

**Fix sugerido:** `@Min(0)` com comentário explicativo, ou `@Min(0)` e validação contextual que verifique o `modeloCobranca`.

**Status: ABERTO 🟠 P3**

---

## 4. Análise de Fluxos — Wizards e Bot WhatsApp

### 4.1 Wizard Admin T0 (7 etapas) ✅ Estável
Sem mudanças no ciclo. Todos os steps funcionando conforme entregue em 17/04.

### 4.2 Portal Cooperado — Nova UC (ModalNovaUc)

| Etapa | Status |
|-------|--------|
| Etapa 1 — Upload + OCR | ✅ OK |
| Etapa 1 (outlier) | ✅ Exibe aviso + informa que equipe entrará em contato |
| Etapa 2 — Simulação | ✅ OK |
| Etapa 3 — Confirmar | ✅ OK — envia `consumoKwh`+`valorFatura` do OCR |
| UcChart | ✅ Exibe cobranças em R$ quando sem kWh; BarChart funcional |

### 4.3 Cadastro Público v2

| Fluxo | Status |
|-------|--------|
| Cooperado + UC + Proposta | ✅ OK |
| Outlier detectado | ✅ Retorna `ok:false, erro:'OUTLIER_DETECTADO'` com opções |
| Motor motor falhou | ✅ Cooperado/UC criados, proposta=null logado, sem crash |

### 4.4 Documentos — Aprovação Automática

| Item | Status |
|------|--------|
| Feature toggle por tenant | ✅ OK |
| Prazo configurável | ✅ OK |
| REPROVADO → pula | ✅ OK |
| Todos PENDENTE → pula agora | ✅ CORRIGIDO |
| Proposta ACEITA obrigatória | ✅ OK |

### 4.5 Bot WhatsApp
Sem mudanças desde 15/04. Estável.

### 4.6 Cobrança Mensal — Bandeira + Consumo Mínimo (NOVO)

| Item | Status |
|------|--------|
| bandeiraAtiva toggle | ✅ OK |
| bandeiraSincronizacaoAuto toggle | ✅ OK |
| Bandeira aplicada na cobrança | ✅ OK (VERDE → não cobra) |
| ConfiguracaoMotor por cooperativa | 🟡 AUSENTE — bug P2 (BUG-018-001) |
| tipoFornecimento null → trifásico default | 🟠 P3 silencioso |
| Cron ANEEL dia 1 às 6h | 🟠 Sem retry/notificação |

---

## 5. Inconsistências de Cálculo

### 5.1 Multa/Juros — RESOLVIDO ✅
`CalculoMultaJurosService` unificado. Fórmula canônica: `multa = base × multaAtraso%`, `juros = base × jurosDiarios% × diasEfetivos`, arredondamento 2dp.

### 5.2 Consumo Mínimo Faturável — NOVO P2
`ConfiguracaoMotor` sem filtro cooperativaId. Cross-tenant contamination.

### 5.3 Bandeira Tarifária — OK (com ressalvas P3)
Cálculo: `(kwhCobranca / 100) × valorPor100Kwh` com arredondamento 2dp. Correto.
CSV ANEEL: `R$/MWh ÷ 10 = R$/100kWh`. Correto.

### 5.4 Proposta — RESOLVIDO ✅
`confirmar-nova-uc` usa dados OCR reais enviados pelo frontend.

### 5.5 BONUS_INDICACAO — RESOLVIDO ✅
Unique index parcial + guard cooperativaId em 2 camadas.

---

## 6. Segurança

| Item | Status |
|------|--------|
| DocumentosAprovacaoJob: docs PENDENTE sem análise | ✅ CORRIGIDO |
| contas-pagar: SUPER_ADMIN info leak | ✅ CORRIGIDO |
| contas-pagar: DTOs sem validação | ✅ CORRIGIDO |
| BONUS_INDICACAO idempotência | ✅ CORRIGIDO |
| **ConfiguracaoMotor cross-tenant** | 🟡 **P2 — dados de cobrança de um tenant usam config de outro** |
| aceitar() aceita resultado direto sem proposta PENDENTE prévia | 🟠 P3 (dívida documentada) |
| CORS `*` em whatsapp-service (porta 3002) | 🟠 P3 PERSISTE |
| TOCTOU em contas-pagar update/delete | 🟠 P3 PERSISTE |
| Admin phone hardcoded no fallback env | 🟠 P3 PERSISTE |

---

## 7. Infraestrutura e Crons — Inventário Atualizado

| Cron | Horário | Status |
|------|---------|--------|
| `marcarVencidas` | 2h AM | ✅ OK |
| `CooperTokenJob.expirarTokensVencidos` | Dia 1 às 2h | ✅ OK |
| `calcularMultaJuros` | 3h AM | 🟠 Cluster de 5 (persiste) |
| `convenios.job` | 3h AM | 🟠 Cluster |
| `convite-indicacao.job:lembretes` | 3h AM | 🟠 Cluster |
| `cooperados.job:limparProxyExpirados` | 3h AM | 🟠 Cluster |
| `cooperados.job:limparProxyZumbi` | 3h AM | 🟠 Cluster |
| `documentos-aprovacao.job` | Toda hora (min 0) | 🟠 P3 |
| `CooperTokenJob.apurarExcedentes` | 6h AM | 🟠 Conflito |
| `email-monitor.verificarEmails` | 6h AM | 🟠 Conflito |
| **`BandeiraAneelService.sincronizarAutomatico`** | **6h AM dia 1** | **🟠 NOVO — sem retry** |
| `cobrancas:notificarVencidas` | 6h15m AM | ✅ OK |
| `posicaoCooperado.job` | 7h AM | ✅ OK |
| `ClubeVantagensJob.enviarResumos` | Dia 1 às 9h | ✅ OK |
| `convite-indicacao.job:vencidos` | 10h AM | ✅ OK |
| `whatsapp-conversa.job:limpar` | A cada hora | ✅ OK |

---

## 8. Usabilidade

| Área | Observação |
|------|-----------|
| **Wizard Admin T0** | ✅ Estável |
| **Portal UCs** | ✅ Outlier com UI; UcChart funcional; confirmar usa dados reais |
| **Cadastro público v2** | ✅ Outlier explícito; fallback gracioso |
| **Bandeiras tarifárias** | ✅ Tela CRUD completa; badge na fatura do cooperado |
| **Config motor** | ✅ Tela atualizada; consumo mínimo faturável configurável |
| **Bot WhatsApp** | ✅ Estável |
| **ContaAPagar** | ✅ P2s fechados; P3s TOCTOU/ATRASADO persistem |

---

## 9. Resumo Executivo

### Score: 9.0/10 ↑ (+0.5 — maior score desde 02/04/2026)

**Sprint cirúrgico e eficiente** — 8 P2 + 2 P3 fechados; 3 features novas de valor; 1 P2 residual e 4 P3 novos.

**Positivos ✅:**
- Todos os 8 P2 do ciclo anterior fechados em um único dia — execução rara
- Multa/juros finalmente unificados: código consolidado, regra clara, auditável
- BandeiraTarifaria: feature de negócio relevante com CRUD + automação ANEEL
- Consumo mínimo faturável: compliance com regulação ANEEL
- ModalNovaUc + cadastro v2: fluxos de outlier agora comunicam corretamente

**Preocupações ⚠️:**
- 🟡 `ConfiguracaoMotor` sem cooperativaId: cross-tenant contamination no consumo mínimo
- 🟠 `tipoFornecimento` null → trifásico padrão silencioso (UCs sem campo preenchido)
- 🟠 BandeiraANEEL cron sem retry: dia 1 offline = mês sem bandeira
- 🟠 Cluster de crons às 3h (5 jobs) persiste; novo conflito às 6h dia 1

**Prioridade sugerida para próximo sprint:**
1. BUG-NEW-2026-04-18-001 — ConfiguracaoMotor: add `cooperativaId` no `findFirst` (30 min)
2. BUG-NEW-2026-04-18-002 — tipoFornecimento null: não aplicar mínimo sem tipoFornecimento (15 min)
3. BUG-NEW-2026-04-18-005 — descontoBase @Min(0) para planos FATURA_CHEIA_TOKEN (15 min)
4. BUG-NEW-2026-04-15-003 — TOCTOU contas-pagar (backlog)
5. BUG-NEW-2026-04-15-004 — Status ATRASADO cron automático (backlog)

---

## 10. Bugs Ativos Pós-Ciclo 18/04/2026

### P2 Abertos

| ID | Bug | Prioridade | Sprint |
|----|-----|------------|--------|
| **BUG-NEW-2026-04-18-001** | **ConfiguracaoMotor sem cooperativaId no findFirst — cross-tenant billing** | **P2** | **Urgente** |

### P3 Abertos

| ID | Bug | Prioridade | Sprint |
|----|-----|------------|--------|
| BUG-NEW-2026-04-18-002 | tipoFornecimento null → trifásico default silencioso no consumo mínimo | P3 | Próximo |
| BUG-NEW-2026-04-18-003 | BandeiraANEEL: sem retry/notificação quando CSV offline | P3 | Próximo |
| BUG-NEW-2026-04-18-004 | BandeiraANEEL cron não documentado; conflito às 6h dia 1 | P3 | Backlog |
| BUG-NEW-2026-04-18-005 | descontoBase @Min(1) bloqueia planos 0% (FATURA_CHEIA_TOKEN) | P3 | Próximo |
| BUG-NEW-2026-04-17-007 | DocumentosAprovacaoJob: cron horário não documentado | P3 | Backlog |
| BUG-NEW-2026-04-17-008 | Step1Fatura: encargosKwh pode ter double-counting de ICMS | P3 | Backlog |
| BUG-NEW-2026-04-15-003 | TOCTOU em contas-pagar update/delete | P3 | Backlog |
| BUG-NEW-2026-04-15-004 | Status ATRASADO sem cron automático em ContaAPagar | P3 | Próximo |
| BUG-NEW-2026-04-15-005 | 5 crons simultâneos às 3h AM (cluster) | P3 | Backlog |
| BUG-NEW-2026-04-13-004 | N+1 queries no histórico do relatório mensal | P3 | Backlog |
| BUG-NEW-2026-04-13-005 | valorSemGD usa tarifa circular (inflada) | P3 | Backlog |
| BUG-NEW-2026-04-12-004 | Admin phone hardcoded no fallback env | P3 | Backlog |

---

*Próxima análise automática: 19/04/2026 às 03h*
