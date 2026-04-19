# Relatório QA — CoopereBR
**Data:** 2026-04-11 | **Horário:** 07:46 (America/Sao_Paulo) — ciclo noturno/matinal unificado
**Score:** 7.8/10 ↓ (-0.6 vs ciclo 10/04 | -0.2 vs ciclo matinal 07:36)
**Críticos:** 1 | **P2 ativos:** 10 | **P3:** 2
**Gerado por:** Assis — análise profunda (segundo ciclo do dia, descobertas adicionais)

---

## 1. Status dos Itens do Ciclo Anterior

### ✅ BUG-NEW-2026-04-10-002 — RESOLVIDO
`darBaixa` agora usa `updateMany` com guard atômico:
```typescript
const updated = await this.prisma.cobranca.updateMany({
  where: { id, status: { notIn: ['PAGO', 'CANCELADO'] } },
  data: { status: 'PAGO', dataPagamento: dtPagamento, valorPago: valorFinal },
});
if (updated.count === 0) {
  throw new BadRequestException('Cobrança já foi paga ou cancelada (processamento concorrente)');
}
```
Race condition eliminada. Evento `cobranca.primeira.paga` também tem verificação dupla.
**Status: FECHADO ✅**

---

### 🔴 BUG-NEW-2026-04-11-001 — `modoTeste = true` em produção — PERSISTE (P1)
**Arquivo:** `web/app/cadastro/page.tsx` — modificado hoje às 07:32.
```tsx
const modoTeste = true; // TODO: remover quando for para produção
if (!modoTeste) {
  if (!aceitouTermos) { setErro('...'); return; }
  if (!planoSelecionado) { setErro('...'); return; }
}
```
Bypass total de: aceite de termos, seleção de plano. Risco legal imediato.
**Status: ABERTO 🔴 P1 — URGENTE HOJE**

---

### ⚠️ SEC-CT-002 — PERSISTE (P2)
Secret WA visível na URL de fallback do `whatsapp-service/index.mjs`.
**Status: ABERTO ⚠️ — P2**

### ⚠️ BUG-WA-AUDIO — PERSISTE (P2)
`audioMessage`, `videoMessage`, `stickerMessage` caem no `else` genérico → tipo permanece 'texto', corpo = null. Backend descarta silenciosamente.
**Status: ABERTO ⚠️ — P2**

### ⚠️ BUG-NEW-002 (HMAC Asaas) — PERSISTE (P2)
Webhook Asaas valida token simples, sem HMAC-SHA256. Forjamento de evento possível.
**Status: ABERTO ⚠️ — P2**

### ⚠️ BUG-CALCULO-001 — PERSISTE (P2 Backlog)
Precisão 2dp vs 4dp entre job/darBaixa/reenviarNotificacao.
**Status: ABERTO ⚠️ — P2 Backlog**

### ⚠️ BUG-NEW-2026-04-10-001 — PERSISTE (P2)
`indicadosAtivos` nunca decrementado. `recalcularIndicadosAtivos()` existe mas nenhum evento do ciclo de vida do contrato a aciona.
**Status: ABERTO ⚠️ — P2**

---

## 2. Bugs Novos — Ciclo 11/04/2026 (ciclo noturno/complementar)

---

### 🆕 BUG-NEW-2026-04-11-002 — Tarifa e desconto hardcoded EDP-ES na simulação
**Prioridade: P2 | Área: Frontend / UX**
`web/app/cadastro/page.tsx`:
```tsx
const TARIFA_KWH = 0.78931;  // Tarifa EDP-ES Fev/2026
const DESCONTO_PERCENTUAL = 0.15;
```
Simulação usa tarifa fixa EDP-ES independente da distribuidora. Cooperados de CEMIG/CPFL/Energisa recebem projeção incorreta.
**Status: ABERTO ⚠️ — P2**

---

### 🆕 BUG-NEW-2026-04-11-003 — Tokens BONUS_INDICACAO creditados antes da aprovação
**Prioridade: P2 | Área: CooperToken / MLM**
`processarIndicacao()` em `publico.controller.ts` credita 50 tokens ao criar o lead, antes de qualquer aprovação ou contrato. Mensagem ao indicador diz "quando for aprovado" — mas o código já creditou.
**Cenário de abuso:** Leads falsos para acumular tokens.
**Status: ABERTO ⚠️ — P2**

---

### 🆕 BUG-NEW-2026-04-11-004 — Inconsistência de cálculo multa em `reenviarNotificacao()`
**Prioridade: P3 | Área: Cobrança / UX**
```typescript
const multa = base * (Number(config.multaAtraso) / 100);   // sem precisão intermediária
const juros = base * (Number(config.jurosDiarios) / 100) * diasEfetivos;
valor = Math.round((base + multa + juros) * 100) / 100;
```
Divergência de até R$ 0,01 vs `darBaixa` (4dp). UX: valor notificado ≠ valor cobrado.
**Status: ABERTO ⚠️ — P3**

---

### 🆕 BUG-NEW-2026-04-11-005 — Race condition no resgate de ofertas do Clube
**Prioridade: P2 | Área: Clube de Vantagens / Negócio**
**Arquivo:** `backend/src/clube-vantagens/clube-vantagens.service.ts` — `resgatarOferta()`

```typescript
// Validar estoque — lido ANTES da transação
if (oferta.estoque != null && oferta.totalResgatado >= oferta.estoque) {
  throw new BadRequestException('Estoque esgotado para esta oferta');
}
// ... (qualquer código entre check e tx)
// Criar resgate e incrementar totalResgatado na transação
const [resgate] = await this.prisma.$transaction([
  this.prisma.resgateClubeVantagens.create({ ... }),
  this.prisma.ofertaClube.update({ data: { totalResgatado: { increment: 1 } } }),
]);
```

**Problema:** O check de estoque acontece fora da transação. Dois requests concorrentes passam ambos no `if`, depois ambos criam resgate, ultrapassando o estoque configurado. Tokens debitados corretamente, mas mais resgates do que o permitido.

**Fix sugerido:**
```typescript
// Usar updateMany com condição de estoque dentro da transação
const ofertaUpdate = await this.prisma.ofertaClube.updateMany({
  where: {
    id: ofertaId,
    cooperativaId,
    ativo: true,
    OR: [
      { estoque: null },
      { totalResgatado: { lt: this.prisma.ofertaClube.fields.estoque } }, // pseudo-código
    ],
  },
  data: { totalResgatado: { increment: 1 } },
});
if (ofertaUpdate.count === 0) throw new BadRequestException('Estoque esgotado');
```
Ou usar `SELECT FOR UPDATE` explícito via Prisma `$queryRaw`.
**Status: ABERTO ⚠️ — P2**

---

### 🆕 BUG-NEW-2026-04-11-006 — FATURA_CHEIA_TOKEN creditado como BONUS_INDICACAO no ledger
**Prioridade: P2 | Área: CooperToken / Contabilidade / Auditoria**
**Arquivo:** `backend/src/cobrancas/cobrancas.service.ts` — método `create()`

```typescript
// Modo Fatura Cheia: credita tokens equivalentes
await this.cooperTokenService.creditar({
  cooperadoId: contrato.cooperadoId,
  cooperativaId: resolvedCoopId,
  tipo: CooperTokenTipo.BONUS_INDICACAO,  // ← ERRADO — deveria ser tipo relacionado a FATURA_CHEIA
  quantidade: valorDescontoEmTokens,
  ...
});
```

**Impacto:** Todos os tokens creditados pelo plano FATURA_CHEIA_TOKEN ficam registrados no ledger com tipo `BONUS_INDICACAO`. Isso:
1. **Corrompe relatórios** de emissão — "bônus de indicação" inflado artificialmente
2. **Dificulta auditoria** — impossível distinguir tokens de fatura de tokens de indicação
3. **Afeta dashboards** que filtram por tipo para análise de MLM vs fidelidade

Obs.: As doações de tokens (envio/recebimento) em `cooper-token.service.ts` também usam `BONUS_INDICACAO` como tipo de operação no ledger (linhas 578 e 617), mesmo quando o operacao é `DOACAO_ENVIADA`/`DOACAO_RECEBIDA`. Mesma raiz.

**Fix sugerido:** Usar `CooperTokenTipo.FATURA_CHEIA_TOKEN` (se existir no enum) ou criar novo tipo. Verificar enum `CooperTokenTipo` no Prisma schema.
**Status: ABERTO ⚠️ — P2**

---

### 🆕 BUG-NEW-2026-04-11-007 — Conflito de horário: dois crons às 6h AM
**Prioridade: P3 | Área: Infraestrutura / Performance**

Dois jobs rodando exatamente ao mesmo tempo:
- `CooperTokenJob.apurarExcedentes()`: `@Cron('0 6 * * *')`
- `CobrancasJob.notificarCobrancasVencidas()`: `@Cron('0 6 * * *')`

Ambos fazem múltiplas queries no banco e loops com delay (`setTimeout(r, 3000)`). Risco de lock contention, timeouts em conexões Prisma e aumento de latência para usuários acessando o sistema às 6h.

**Fix sugerido:** Escalonar um deles para 6h05 ou 6h30.
**Status: ABERTO ⚠️ — P3**

---

### 🆕 BUG-NEW-2026-04-11-008 — `cotaKwhMensal` nula inflaciona tokens de excedente
**Prioridade: P2 | Área: CooperToken / Cálculo**
**Arquivo:** `backend/src/cooper-token/cooper-token.job.ts` — `apurarExcedentes()`

```typescript
const cotaKwh = Number(fatura.cooperado.cotaKwhMensal ?? 0);  // null → 0
const kwhGerado = Number(fatura.mediaKwhCalculada ?? 0);
const excedente = Math.round((kwhGerado - cotaKwh) * 100) / 100;

if (excedente <= 0) {
  // marca como apurado e pula
  continue;
}
// → credita tokens = kwhGerado * tokenPorKwhExcedente
```

**Problema:** Se `cotaKwhMensal` é nulo (não configurado), o `?? 0` torna-o zero. Qualquer `mediaKwhCalculada > 0` gera tokens de "excedente" — mas o excedente real seria `kwhGerado - cotaContrato`, não `kwhGerado - 0`.

**Cenário:** Cooperado com `cotaKwhMensal = null` e `mediaKwhCalculada = 200 kWh` recebe 200 tokens de excedente quando na verdade sua cota é 150 kWh e o excedente real seria só 50.

**Fix sugerido:** Adicionar guard antes do cálculo:
```typescript
if (!fatura.cooperado.cotaKwhMensal || fatura.cooperado.cotaKwhMensal <= 0) {
  this.logger.warn(`Cooperado ${fatura.cooperadoId} sem cotaKwhMensal configurada — pulando apuração`);
  // Não marcar como apurado → vai retentar quando a cota for configurada
  continue;
}
```
**Status: ABERTO ⚠️ — P2**

---

## 3. Análise de Fluxos — Wizards e Bot WhatsApp

### 3.1 Wizard de Cadastro Público
- **Step 0 (OCR):** Funcional. Rate limit 5req/60s. OK.
- **Step 1-2 (Dados pessoais/Endereço):** CEP via ViaCEP, masks corretas. OK.
- **Step 3 (Simulação):** Tarifa EDP-ES hardcoded para TODOS (BUG-002).
- **Submit:** `modoTeste=true` bypassa validações críticas (BUG-001). Plano default `DESCONTO_DIRETO` se não selecionado.
- **Processamento de indicação:** Tokens creditados antes de aprovação (BUG-003).

### 3.2 Bot WhatsApp — Estados e Fluxos
- Timeout 30min: OK
- Fallback CoopereAI 15s com graceful degradation: OK
- Cancelamento → redireciona portal (não encerra diretamente): OK comportamental
- Audio/Video/Sticker: descartado silenciosamente (BUG-WA-AUDIO persiste)
- NPS via setTimeout: sem persistência — reinicialização do backend cancela NPS pendentes
- Rate limit cobrança por cooperativa (`intervaloMinCobrancaHoras`): OK

### 3.3 Fluxo de Resgate (Clube de Vantagens)
- Validação de validade da oferta: OK
- Validação de estoque: **Race condition** (BUG-005)
- Débito de tokens: transacional com criação do resgate. OK estruturalmente.
- Código de resgate único via `randomUUID()`: OK

---

## 4. Inconsistências de Cálculo

### 4.1 Cobrança Mensal — OK
Todos os 4 modelos verificados. Guard `kwhContrato > 0` existente.

### 4.2 Multa/Juros — 3 métodos diferentes

| Método | Precisão intermediária | Arredondamento final |
|--------|----------------------|---------------------|
| `cobrancas.job.ts` | 2dp direto | `Math.round(*100)/100` |
| `darBaixa` | 4dp (1e4) | `Math.round(*100)/100` |
| `reenviarNotificacao` | nenhuma | `Math.round(*100)/100` |

### 4.3 PIX Excedente — Inconsistência menor (P3)
Em `pix-excedente.service.ts`:
```typescript
const valorBruto = dto.kwhExcedente * dto.tarifaKwh;  // sem arredondamento
const valorImpostos = valorIR + valorPIS + valorCOFINS;
const valorLiquido = Math.max(0, valorBruto - valorImpostos);  // sem arredondamento

// Depois arredonda independentemente:
const valorBrutoArredondado = Math.round(valorBruto * 100) / 100;
const valorImpostosArredondado = Math.round(valorImpostos * 100) / 100;
const valorLiquidoArredondado = Math.round(valorLiquido * 100) / 100;
```
`valorBrutoArredondado - valorImpostosArredondado ≠ valorLiquidoArredondado` potencialmente. Cada valor é arredondado de forma independente antes de ser persistido.

### 4.4 CooperToken Excedente — Potencial inflacionamento
`cotaKwhMensal = null` → excedente calculado como 100% da geração (BUG-008).

### 4.5 Clube de Vantagens / indicadosAtivos
`atualizarMetricas()` NÃO incrementa `indicadosAtivos`. Campo só atualizado por `recalcularIndicadosAtivos()` que nunca é chamado automaticamente. ClubeVantagensJob usa `indicadosAtivos` inflado nos resumos mensais.

---

## 5. Segurança

| Item | Status |
|------|--------|
| JWT + cooperativaId isolamento | ✅ OK |
| Webhook Asaas token validation | ⚠️ Token simples, sem HMAC |
| WhatsApp webhook secret hardcoded no fallback | ⚠️ P2 |
| `/reconnect` sem autenticação no whatsapp-service | ⚠️ P3 |
| CORS `*` em whatsapp-service (porta 3002) | ⚠️ P3 |
| `modoTeste=true` bypassa aceite de termos | 🔴 P1 — risco legal |
| `processarIndicacao` credita tokens sem aprovação | ⚠️ P2 |
| `resgatarOferta` race condition no estoque | ⚠️ P2 |
| `cotaKwhMensal=null` → tokens indevidos | ⚠️ P2 |
| FATURA_CHEIA_TOKEN→BONUS_INDICACAO no ledger | ⚠️ P2 — integridade dados |
| Central de Faturas IDOR | ✅ CORRIGIDO |
| Roles guard em controllers sensíveis | ✅ OK |
| TransferênciaPix tenant isolation | ✅ OK |

---

## 6. Infraestrutura e Crons

| Cron | Horário | Status |
|------|---------|--------|
| `marcarVencidas` | 2h AM | ✅ OK |
| `calcularMultaJuros` | 3h AM | ✅ OK (precisão P2 backlog) |
| `CooperTokenJob.expirarTokensVencidos` | Dia 1 às 2h | ✅ OK |
| `CooperTokenJob.apurarExcedentes` | 6h AM | ⚠️ Conflito de horário + BUG-008 |
| `notificarCobrancasVencidas` | 6h AM | ⚠️ Conflito de horário |
| `ClubeVantagensJob.enviarResumosMensais` | Dia 1 às 9h | ⚠️ `indicadosAtivos` inflado |
| `recalcularIndicadosAtivos` | **AUSENTE** | ❌ Nenhum cron aciona |
| `convite-indicacao.job` | A verificar | Não revisado neste ciclo |

---

## 7. Resumo Executivo

### Score: 7.8/10 ↓ (vs 8.4 em 10/04)

**Positivo:**
- ✅ BUG-NEW-2026-04-10-002 **RESOLVIDO** — `darBaixa` atômico via `updateMany`
- CooperToken: expiração, cálculo de desconto, contabilidade — estruturalmente OK
- Contratos: transação SERIALIZABLE para capacidade de usina — OK
- Bot WhatsApp: handlers de keyword, timeout, graceful degradation — robustos
- Tenant isolation: sem regressões de segurança

**Preocupante:**
- 🔴 **BUG-001 (P1 CRÍTICO):** `modoTeste=true` modif. HOJE 07:32 — bypassa aceite de termos e plano. **Verificar se chegou a prod.**
- ⚠️ **BUG-005 (P2 NOVO):** Race condition em resgate de ofertas — estoque pode ser ultrapassado sob concorrência
- ⚠️ **BUG-006 (P2 NOVO):** FATURA_CHEIA_TOKEN registrado como BONUS_INDICACAO — corrompe ledger e relatórios
- ⚠️ **BUG-008 (P2 NOVO):** `cotaKwhMensal=null` → tokens de excedente indevidos para cooperados sem cota configurada
- ⚠️ Carries P2: BUG-003 (tokens prematuros), BUG-002 (tarifa hardcoded), SEC-CT-002, BUG-WA-AUDIO, HMAC Asaas, indicadosAtivos

---

## 8. Bugs Ativos Pós-Ciclo 11/04/2026

| ID | Bug | Prioridade | Sprint |
|----|-----|------------|--------|
| BUG-NEW-2026-04-11-001 | `modoTeste=true` — bypassa termos e plano | **P1** | **URGENTE HOJE** |
| BUG-NEW-2026-04-11-005 | Race condition resgate de oferta (estoque) | P2 | Próximo |
| BUG-NEW-2026-04-11-006 | FATURA_CHEIA_TOKEN → BONUS_INDICACAO no ledger | P2 | Próximo |
| BUG-NEW-2026-04-11-008 | cotaKwhMensal null inflaciona excedente tokens | P2 | Próximo |
| BUG-NEW-2026-04-11-002 | Tarifa hardcoded EDP-ES na simulação | P2 | Próximo |
| BUG-NEW-2026-04-11-003 | Tokens BONUS_INDICACAO creditados antes de aprovação | P2 | Próximo |
| SEC-CT-002 | Secret WA hardcoded no fallback da URL | P2 | Próximo |
| BUG-WA-AUDIO | audio/video/sticker sem tipo correto no whatsapp-service | P2 | Próximo |
| BUG-NEW-002 | Webhook Asaas sem HMAC validation | P2 | Próximo |
| BUG-NEW-2026-04-10-001 | indicadosAtivos nunca decrementado (Clube/MLM) | P2 | Próximo |
| BUG-NEW-2026-04-11-004 | Multa inconsistente em reenviarNotificacao | P3 | Backlog |
| BUG-NEW-2026-04-11-007 | Conflito crons às 6h (tokens + cobrança) | P3 | Backlog |
| BUG-CALCULO-001 | Arredondamento multa/juros 2dp vs 4dp | P2 | Backlog |
| BUG-NEW-2026-04-10-003 | /reconnect sem auth no whatsapp-service | P3 | Backlog |

---

*Próxima análise automática: 12/04/2026 às 03h*
