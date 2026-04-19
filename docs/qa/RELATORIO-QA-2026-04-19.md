# Relatório QA Noturno — CoopereBR
**Data:** 2026-04-19 | **Horário:** 03:00 BRT (automático)
**Score:** 8.8/10 ↓ (−0.2 vs 18/04) | **Gerado por:** Assis

---

## Resumo Executivo

**1 commit desde 18/04 08:00** — feat(sprint5): congelar criação de contratos em COMPENSADOS/DINAMICO

Sprint 5 bem executado: múltiplas camadas de defesa (DTO, service, motor-proposta), feature flag BLOQUEIO_MODELOS_NAO_FIXO, filtro no cadastro público. Arquitetura correta. Score cai levemente por:
- P2 de 18/04 ainda aberto (ConfiguracaoMotor cross-tenant)
- 2 novos P3 detectados na análise do Sprint 5

---

## Status dos Bugs Anteriores

| Bug | Status |
|-----|--------|
| BUG-NEW-2026-04-18-001 — ConfiguracaoMotor cross-tenant | 🔴 **ABERTO** — não corrigido |
| BUG-NEW-2026-04-18-002 — tipoFornecimento null → trifásico default | 🟡 Backlog (P3) |
| BUG-NEW-2026-04-18-003 — BandeiraANEEL sem retry | 🟡 Backlog (P3) |
| BUG-NEW-2026-04-18-004 — Crons às 6h dia 1 conflito | 🟡 Backlog (P3) |
| BUG-NEW-2026-04-18-005 — descontoBase @Min(1) bloqueia 0% | 🟡 Backlog (P3) |
| BUG-NEW-2026-04-15-003 — TOCTOU contas-pagar | 🟡 Backlog (P3) |
| BUG-NEW-2026-04-15-004 — Status ATRASADO sem cron | 🟡 Backlog (P3) |

---

## Análise do Commit: Sprint 5 — Congelar COMPENSADOS/DINAMICO

### ✅ O que foi bem feito

**Defesa em profundidade (3 camadas):**
1. `@IsModeloNaoBloqueado()` decorator nos DTOs — validação antes de chegar ao service
2. `validarModeloNaoBloqueado()` no `ContratosService.create/update` — segunda linha
3. Guard em `MotorPropostaService.aceitar()` antes da transação — terceira linha

**Feature flag elegante:**
- `BLOQUEIO_MODELOS_NAO_FIXO` env var com default `true` — fácil rollback sem redeploy
- Filtro `notIn` em `findAtivos(publico=true)` — cadastro público só mostra FIXO_MENSAL ✅
- Opções `disabled` no frontend com texto explicativo — UX clara para admin ✅
- Campos `@IsOptional` corrigidos nos PlanosDTOs — bugfix complementar válido ✅

**Consistência frontend/backend:**
- `planos/novo/page.tsx` usa `FIXO_MENSAL`, `CREDITOS_COMPENSADOS`, `CREDITOS_DINAMICO` ✅ (correto)
- Planos `[id]/page.tsx` idem ✅

---

## Bugs Novos Encontrados Neste Ciclo

### 🟡 BUG-19-001 (P3) — PlanosService.onModuleInit cria plano COMPENSADOS bloqueado

**Arquivo:** `backend/src/planos/planos.service.ts:25`

```typescript
// PROBLEMA:
await this.prisma.plano.create({
  data: {
    nome: 'Plano Básico',
    modeloCobranca: ModeloCobranca.CREDITOS_COMPENSADOS, // ← BLOQUEADO no Sprint 5!
    ...
  },
});
```

**Impacto:** Em instalação nova ou reset de DB:
1. O "Plano Básico" padrão é criado com `CREDITOS_COMPENSADOS`
2. Admin vê o plano em listagens não-públicas
3. Se tentar criar contrato com esse plano → `BadRequestException` do Sprint 5
4. Confusão: sistema cria plano inválido automaticamente

**Fix (2 linhas):**
```typescript
modeloCobranca: ModeloCobranca.FIXO_MENSAL, // Sprint 5: usar FIXO_MENSAL como default
```

---

### 🟡 BUG-19-002 (P3) — getConfiguracao() no motor-proposta sem cooperativaId

**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:~87`

```typescript
// PROBLEMA:
async getConfiguracao() {
  let config = await this.prisma.configuracaoMotor.findFirst(); // ← sem filtro cooperativaId!
  if (!config) {
    config = await this.prisma.configuracaoMotor.create({ data: {} });
  }
  return config;
}
```

**Impacto:** Mesma família de BUG-NEW-2026-04-18-001. O `calcular()` do motor usa `getConfiguracao()` para `thresholdOutlier` e `acaoOutlier`. Em ambiente multi-tenant, uma cooperativa pode herdar configurações de motor de outra cooperativa (outlier threshold errado → proposta calculada diferente do esperado).

**Fix:**
```typescript
async getConfiguracao(cooperativaId?: string) {
  let config = await this.prisma.configuracaoMotor.findFirst({
    where: cooperativaId ? { cooperativaId } : {},
    orderBy: { updatedAt: 'desc' },
  });
  if (!config) {
    config = await this.prisma.configuracaoMotor.create({ 
      data: cooperativaId ? { cooperativaId } : {} 
    });
  }
  return config;
}
```
Propagar `cooperativaId` nos callers.

---

### 🟡 BUG-19-003 (P3) — Step5Cobranca.tsx é código morto (orphaned component)

**Arquivo:** `web/app/dashboard/parceiros/novo/steps/Step5Cobranca.tsx`

O componente existe mas não é importado em nenhum `page.tsx`. O wizard `parceiros/novo` foi refatorado para usar `Step4PlanoSaas` em vez de `Step5Cobranca`. O arquivo continua no repo gerando confusão.

**Impacto:** Confusão para desenvolvedores. Sem impacto funcional.

**Fix:** Remover o arquivo ou mover para `_archive/`.

---

### 🟡 BUG-19-004 (P3) — Step3Configuracoes.tsx usa 'FIXO'/'DINAMICO' em vez de 'FIXO_MENSAL'/'CREDITOS_DINAMICO'

**Arquivo:** `web/app/dashboard/parceiros/configurar/steps/Step3Configuracoes.tsx:21`

```typescript
const MODELOS_COBRANCA = [
  { value: 'FIXO', ... },        // deveria ser 'FIXO_MENSAL'?
  { value: 'CREDITOS_COMPENSADOS', ... },  // correto
  { value: 'DINAMICO', ... },    // deveria ser 'CREDITOS_DINAMICO'?
];
```

Esse valor é submetido a `/cooperativas/minha` como `modeloCobranca`. O model `Cooperativa` no schema não tem campo `modeloCobranca` diretamente — pode ser silenciosamente ignorado pela API, ou ser armazenado como string incorreta em campo configurável.

**Severidade:** P3 — depende de como `/cooperativas/minha` trata o campo. Se for ignorado, nenhum impacto. Se armazenado, dados incoerentes.

**Fix:** Verificar o handler de `/cooperativas/minha` e alinhar valores com o enum `ModeloCobranca` do Prisma.

---

## Status dos Bugs P2 Abertos (carry-forward)

### 🔴 BUG-NEW-2026-04-18-001 (P2) — ConfiguracaoMotor cross-tenant no calcularCobrancaMensal

**Arquivo:** `backend/src/cobrancas/cobrancas.service.ts:701`

```typescript
// AINDA ABERTO:
const configMotor = await this.prisma.configuracaoMotor.findFirst({
  orderBy: { updatedAt: 'desc' },
  // FALTA: where: { cooperativaId: contrato.cooperativaId }
});
```

**Impacto:** Cobrança mensal pode usar consumo mínimo faturável da cooperativa errada.
**Estimativa de fix:** 30 min (1 linha de código).
**Prioridade:** URGENTE — próximo sprint.

---

## P3 Backlog (carry-forward)

| ID | Bug | Prioridade |
|----|-----|-----------|
| BUG-NEW-2026-04-18-002 | tipoFornecimento null → trifásico default (70kWh a mais) | Alta |
| BUG-NEW-2026-04-18-005 | descontoBase @Min(1) bloqueia planos FATURA_CHEIA_TOKEN (0%) | Alta |
| BUG-NEW-2026-04-18-003 | BandeiraANEEL sem retry quando CSV offline | Média |
| BUG-NEW-2026-04-18-004 | Cron ANEEL `0 6 1 * *` conflito com CooperToken+email dia 1 | Média |
| BUG-NEW-2026-04-15-003 | TOCTOU em contas-pagar update/delete | Backlog |
| BUG-NEW-2026-04-15-004 | Status ATRASADO sem cron automático ContaAPagar | Backlog |
| BUG-NEW-2026-04-15-005 | 5 crons simultâneos às 3h AM | Backlog |
| BUG-NEW-2026-04-13-004 | N+1 queries no histórico mensal | Backlog |
| BUG-NEW-2026-04-13-005 | valorSemGD usa tarifa circular | Backlog |
| BUG-NEW-2026-04-11-007 | Conflito 3 crons às 6h | Backlog |
| BUG-NEW-2026-04-12-004 | Admin phone hardcoded no fallback env | Backlog |
| BUG-NEW-2026-04-11-004 | Multa inconsistente em reenviarNotificacao | Backlog |

---

## Análise de Fluxo: Wizards e Bot WhatsApp

### Wizard Parceiros/Configurar
- **Fluxo OK:** Step1 → Step2 → Step3 → Step4 (revisão)
- **Problema:** Step3 envia `modeloCobranca: 'FIXO'` ao backend → BUG-19-004
- **Não tem validação de campos obrigatórios antes de avançar** — usuário pode pular Cobrança em branco

### Wizard Parceiros/Novo  
- **Fluxo OK:** Step1 (Dados) → Step2 (Usina) → Step3 (PlanoSaaS) → Step4 (Confirmação)
- Step5Cobranca.tsx é arquivo morto — não está no fluxo ✅ (mas confunde devs)

### Wizard Planos
- **Fluxo OK:** Formulário único em `/planos/novo/page.tsx`
- `modeloCobranca` corretamente usa `FIXO_MENSAL` como default ✅
- `descontoBase` tem validação frontend (mín 1%, máx 100%) alinhada com backend ✅

### Bot WhatsApp
- Sem novos commits relacionados ao `whatsapp-service/` neste ciclo
- WhatsAppCicloVida: `notificarContratoGerado` e `notificarCreditosIniciados` chamados corretamente fora da transação em `contratos.service.ts` ✅
- Padrão `.catch(() => {})` mantém resiliência ✅

---

## Análise de Cálculo

### calcularCobrancaMensal — Resumo da cadeia de cálculo
```
kwhEntregue = geração - fatura OCR
kwhCobranca = min(kwhEntregue, kwhContrato)
kwhCobranca -= kwhMinimoFaturavel  [BUG: configMotor sem cooperativaId]
valorBruto = kwhCobranca × tarifaKwh
valorDesconto = valorBruto × (descontoAplicado / 100)
valorBandeira = kwhCobranca × bandeira.valorPor100Kwh / 100  [correto, por cooperativa]
valorLiquido = valorBruto - valorDesconto + valorBandeira  ✅
```

**Lógica de bandeira:** Agora corretamente filtrada por `cooperativaId` e intervalo de datas ✅  
**Consumo mínimo faturável:** Corretamente deduzido ANTES do cálculo valorBruto ✅  
**Problema ativo:** `configMotor` sem filtro cooperativaId → consumo mínimo pode ser de tenant errado

### Motor de Proposta — calcular()
- Tarifa: busca por distribuidora normalizada → fallback sem tenant ✅ (design intencional)
- Média cooperativa: `cobrancasAtivas` sem filtro cooperativaId → calcula média global (não por tenant). **Comportamento suspeito** — pode ser intencional para benchmark, mas distorce valor para cooperativas com perfis muito diferentes.
- Mínimo faturável: corretamente lido via `configTenant.get()` com `cooperativaId` ✅
- `getConfiguracao()` sem cooperativaId → BUG-19-002

### Cálculo MLM / Indicação
- `BONUS_INDICACAO` idempotência: ✅ corrigido ciclo anterior
- Sem novos commits nesta área

### Cálculo Sobras / CooperToken
- Sem commits nesta área neste ciclo
- Status: conforme última análise

---

## Análise de Segurança

### Sprint 5 — Pontos positivos
- DTO `@IsModeloNaoBloqueado`: implementado como custom validator, não bloqueia `undefined/null` ✅
- Feature flag via env var: sem exposição de dados sensíveis ✅
- SERIALIZABLE em `contratos.update` quando altera capacidade ✅

### Pontos de atenção
- `validarModeloNaoBloqueado()` no service faz `findUnique` de plano sem verificar `cooperativaId` — um admin poderia especificar um `planoId` de outra cooperativa. Não é bloqueante (plano inválido causa erro de FK ao criar contrato), mas vale o registro.
- `gerarNumeroContrato()` dentro de transação SERIALIZABLE: correto. Sem retry explícito no caller, mas o erro de serialização seria propagado para o cliente como 500. P4 — backlog de observabilidade.

---

## Score QA

| Critério | Nota |
|----------|------|
| Segurança | 9.0 — sem novos P1/P2 de segurança; P2 cross-tenant aberto |
| Cálculos | 8.5 — cadeia correta, mas 2 findFirst sem cooperativaId |
| Fluxo/UX | 8.5 — Sprint 5 bem comunicado; Step5 morto; valores FIXO/DINAMICO |
| Código | 9.0 — defesa em profundidade, feature flag, SERIALIZABLE |
| Bugs Abertos | 8.5 — 1 P2 aberto + 4 P3 novos acumulados |

**Score Final: 8.8/10** ↓ (−0.2 vs 18/04)

---

## Prioridades para Próximo Sprint

1. **[URGENTE P2]** Fix ConfiguracaoMotor sem cooperativaId — cobrancas.service.ts:701 + motor-proposta.getConfiguracao() (30-60 min)
2. **[Alta P3]** tipoFornecimento null → usar `TRIFASICO` como fallback explícito documentado
3. **[Alta P3]** descontoBase @Min(0) para suportar planos FATURA_CHEIA_TOKEN
4. **[Média P3]** BUG-19-001: onModuleInit → `FIXO_MENSAL` como default
5. **[Média P3]** BUG-19-004: alinhar valores de modeloCobranca no wizard configurar

---

*Próximo QA: 2026-04-20 às 03h | Sprint 5 → em andamento*
