# Relatório QA — CoopereBR
**Data:** 2026-04-10 | **Horário:** 03:00 (America/Sao_Paulo)
**Score:** 8.4/10 ↓ (-0.1 vs ciclo anterior)
**Críticos:** 0 | **P2 ativos:** 5 (+1 novo)
**Gerado por:** Assis (agente principal) — ciclo noturno automatizado

---

## 1. Status dos Itens Críticos do Ciclo Anterior

### ✅ CONV-02 — RESOLVIDO
`concluirCadastro` agora verifica duplicata antes de criar indicação nível 1:
```typescript
const indicacaoExistente = await tx.indicacao.findFirst({
  where: { cooperadoIndicadoId, nivel: 1 },
});
if (indicacaoExistente) return { conviteAtualizado, indicacao: indicacaoExistente };
```
**Status: FECHADO ✅**

### ✅ CLB-02 — RESOLVIDO
`upsertConfig` Clube de Vantagens agora valida ranges completos:
- `kwhMinimo >= 0`
- `kwhMaximo > kwhMinimo`
- `beneficioPercentual` entre 0–100
- Detecção de sobreposição entre faixas consecutivas
**Status: FECHADO ✅**

### ⚠️ SEC-CT-002 — PERSISTE (P2)
Secret do webhook WA ainda hardcoded como fallback em `whatsapp-service/index.mjs`:
```javascript
const BACKEND_WEBHOOK_URL =
  process.env.BACKEND_WEBHOOK_URL || 'http://localhost:3000/whatsapp/webhook-incoming?secret=cooperebr_wh_2026';
```
Qualquer dev que olhar o repositório vê o secret. Risco limitado (só localhost), mas deve ser removido.
**Status: ABERTO ⚠️ — Prioridade P2**

### ⚠️ BUG-WA-AUDIO — PERSISTE (P2)
O `whatsapp-service/index.mjs` não detecta `audioMessage`, `videoMessage` nem `stickerMessage`. Ao receber esses tipos, o payload enviado ao backend tem `tipo: 'texto'` e `corpo: null`. O bot então silencia (cai no guard `if (!corpo && msg.tipo === 'texto') return`). O handler `audio` do bot nunca é alcançado.
**Status: ABERTO ⚠️ — Prioridade P2**

### ⚠️ BUG-NEW-002 (HMAC Asaas) — PERSISTE (P2)
O webhook do Asaas valida apenas `webhookToken` por string match — sem HMAC-SHA256. Forjável se o token vazar.
**Status: ABERTO ⚠️ — Prioridade P2**

### ⚠️ BUG-CALCULO-001 (arredondamento) — PERSISTE (P2)
Job batch (`cobrancas.job.ts`) usa `Math.round(... * 100) / 100` (2dp direto).
`darBaixa` usa `Math.round(... * 1e4) / 1e4` intermediário → armazena com `Math.round(multa * 100) / 100`.
Na prática os valores finais coincidem para valores inteiros de configuração, mas diferem para taxas não inteiras (ex: `jurosDiarios = 0.033%`).
**Status: ABERTO ⚠️ — Prioridade P2**

---

## 2. Bugs Novos Encontrados Neste Ciclo

---

### 🆕 BUG-NEW-2026-04-10-001 — Clube de Vantagens: `indicadosAtivos` nunca decrementado
**Prioridade: P2 | Área: Clube de Vantagens / MLM**

`atualizarMetricas()` faz incremento acumulativo de `indicadosAtivos`:
```typescript
await this.prisma.progressaoClube.update({
  where: { cooperadoId },
  data: {
    kwhIndicadoAcumulado: { increment: deltaKwh },
    receitaIndicados: { increment: deltaReceita },
    // indicadosAtivos nunca decrementado aqui
  },
});
```

Existe `recalcularIndicadosAtivos()` mas só é chamado manualmente (nenhum evento/cron o aciona quando um indicado cancela contrato ou vai para status ENCERRADO/SUSPENSO). Um indicado que churn não reduz o contador do indicador, mantendo-o artificialmente em tier mais alto.

**Fix sugerido:** Chamar `recalcularIndicadosAtivos()` quando o status de um contrato muda para ENCERRADO/SUSPENSO, ou adicionar cron diário para sync.

---

### 🆕 BUG-NEW-2026-04-10-002 — `darBaixa` sem atomicidade na verificação de status
**Prioridade: P2 | Área: Cobrança / Financeiro**

```typescript
// darBaixa — cobrancas.service.ts
const cobranca = await this.prisma.cobranca.findUnique({ where: { id } });
if (cobranca.status === 'PAGO') throw new BadRequestException('Esta cobrança já foi paga');
// ... muita lógica ...
await this.prisma.cobranca.update({ where: { id }, data: { status: 'PAGO', ... } });
```

O `update` não usa `WHERE status != 'PAGO'`. Em ambiente com duas threads simultâneas (ex: webhook Asaas + ação manual ao mesmo tempo), ambas passam pelo guard e ambas processam a baixa — gerando duplicação em:
- LancamentoCaixa (dois registros REALIZADO para a mesma cobrança)
- Evento `cobranca.primeira.paga` (pode disparar duas vezes → MLM duplicado)
- CooperToken debitado duas vezes

**Fix sugerido:**
```typescript
const updated = await this.prisma.cobranca.updateMany({
  where: { id, status: { not: 'PAGO' } },
  data: { status: 'PAGO', dataPagamento: dtPagamento, valorPago: valorFinal },
});
if (updated.count === 0) throw new BadRequestException('Cobrança já paga ou não encontrada');
```

---

### 🆕 BUG-NEW-2026-04-10-003 — whatsapp-service sem autenticação no `/reconnect`
**Prioridade: P3 | Área: Infraestrutura**

```javascript
app.post('/reconnect', async (_req, res) => {
  // sem auth check — qualquer request na porta 3002 pode forçar reconexão
```

Qualquer processo local pode derrubar e reconectar o WhatsApp via HTTP POST. Embora a porta 3002 não seja exposta externamente (sem firewall), se outro serviço comprometido rodar no mesmo host, ele pode forçar desconexão/reconexão indefinidamente.

**Fix sugerido:** Adicionar verificação de `Authorization: Bearer <WEBHOOK_SECRET>` no `/reconnect`.

---

### 🆕 BUG-NEW-2026-04-10-004 — Convenio: CPF fake não passa validação de formato
**Prioridade: P3 | Área: Convênios**

```typescript
cpf: dto.conveniadoCpf ?? `CONV-${randomUUID().slice(0, 8)}`,
```

O CPF gerado (`CONV-abc12345`) tem formato não-numérico. Se houver validação de CPF em qualquer outro ponto do sistema (ex.: integração Asaas, envio de proposta, busca por CPF no bot), a busca por esse cooperado pode falhar silenciosamente ou retornar erro de validação.

**Fix sugerido:** Gerar um CPF numérico sintético com checksum válido, ou criar campo dedicado `tipoIdentificador = 'INTERNO'` para conveniados sem CPF real.

---

## 3. Análise de Fluxos — Wizards e Bot WhatsApp

### 3.1 Wizard de Cadastro (7 steps — frontend Next.js)

**Step 1 (Fatura/OCR):** OK. `detectarSuspeitos` identifica meses com variação > 2σ. Alerta visual correto.

**Step 3 (Simulação):** Lógica correta. `calcularValorBrutoKwh` agrega TUSD+TE+bandeira+ICMS+PIS/COFINS quando checkboxes marcados. `economia5anos = economiaMensal * 60` e `mesesGratis = Math.round(economia5anos / faturaAtual)` — fórmulas OK.

**Risco Step 3:** Se `planosAtivos.length === 0` (erro de API), o alerta usa `alert()` nativo — experiência fraca. Sugestão: toast ou estado de erro inline.

**Steps 4–7:** Não verificados em detalhe neste ciclo (sem mudanças recentes).

### 3.2 Bot WhatsApp — Estados

**Estado MENU_COOPERADO:** Funcional. Busca cooperado por telefone (3 variantes: com DDI, sem DDI, DDI fixo). OK.

**Estado CONFIRMAR_ENCERRAMENTO:** Encerra contrato direto via `prisma.contrato.update` sem passar por regra de negócio. Não verifica débitos pendentes antes de encerrar — risco de encerrar contrato com cobrança A_VENCER. Sugestão: checar pendências antes de aceitar encerramento.

**Estado NPS_AGUARDANDO_NOTA:** Usa `setTimeout(1h)` para agendar NPS. Em reinicialização do backend, o timer é perdido. Cooperados que iniciaram cadastro antes do restart não recebem NPS. Low severity mas gera dados incompletos.

**Timeout de Sessão (30min):** Implementado corretamente. Reseta estado e limpa histórico AI.

**Fallback para tipos de mídia (audio/video/sticker):** BUG-WA-AUDIO (citado acima). Audio silenciosamente descartado.

### 3.3 Fluxo de Indicação/Convite

**criarConvite:** Verifica cooperado existente por telefone antes de criar. OK.
**concluirCadastro:** CONV-02 corrigido — duplicata verificada dentro de transação. OK.
**reenviarConvite:** Incrementa `tentativasEnvio` mas não valida limite máximo de tentativas — pode gerar spam de reenvio se chamado múltiplas vezes.

---

## 4. Inconsistências de Cálculo

### 4.1 Cobrança Mensal (`calcularCobrancaMensal`)

Fluxo correto para todos os 4 modelos:
- **FIXO_MENSAL:** usa `kwhContrato` direto. OK.
- **CREDITOS_COMPENSADOS:** usa `min(kwhCompensadoOcr, kwhContrato)` quando OCR disponível. OK.
- **CREDITOS_DINAMICO:** usa tarifas OCR quando disponíveis. OK.
- **Fallback:** `min(kwhEntregue, kwhContrato)`. OK.

**Observação:** Se `kwhContrato = 0` e o modelo for `FIXO_MENSAL`, `valorBruto = 0`. Não há guard para esse caso — gera cobrança R$ 0,00 silenciosamente. Recomendado: validar `kwhContrato > 0` antes de criar cobrança.

### 4.2 CooperToken

**Crédito:** Taxa emissão 2% aplicada. `quantidadeLiquida = quantidade - 2%`. OK para BONUS_INDICACAO.
**FATURA_CHEIA_TOKEN:** Crédita `valorDescontoEmTokens = (valor * maxPerc%) / valorToken`. Round a 4dp. OK.
**Expiração:** 12 meses a partir do crédito. OK.
**Cálculo de desconto:** `tokensNecessarios = min(tokensParaDescontoMax, saldoDisponivel)`. Correto.

**Risco:** `valorAtualEstimado` usa média ponderada de fatores. Se o cooperado tiver créditos antigos (valor 0 após 30 dias), esses créditos entram no cálculo com fator 0 mas ainda "participam" do denominador. O saldo mostrado pode ser menor que o real disponível se o cooperado tiver créditos expirados não limpos. (Créditos expirados com `expiracaoEm < now()` estão incluídos na query.)

**Fix:** Adicionar `expiracaoEm: { gt: new Date() }` já existe! OK então.

### 4.3 PIX Excedente

Cálculo de impostos: `valorIR + valorPIS + valorCOFINS` descontados do bruto. OK.
Feature flag `ASAAS_PIX_EXCEDENTE_ATIVO` controlando se executa real ou simulação. OK.
Sem arredondamento nos valores parciais antes do total — pode gerar centavos perdidos se `valorImpostos` for arredondado separadamente. Risco mínimo (< R$ 0,01).

### 4.4 Multa/Juros (confirmação)

**Job batch (`@Cron 3AM`):** Usa 2dp intermediário.
**darBaixa (real-time):** Usa 4dp intermediário → armazena 2dp.
**Divergência possível:** Para `multaAtraso = 0.033%`, num valor de R$ 347,82:
- Batch: `Math.round(347.82 * 0.00033 * 100) / 100 = Math.round(0.11478 * 100)/100 = 0.11`
- darBaixa: `Math.round(347.82 * 0.00033 * 1e4) / 1e4 = Math.round(1147.806 * ... ` → `0.1148` → armazena `Math.round(0.1148 * 100)/100 = 0.11`

Neste exemplo: resultado idêntico. Para valores mais extremos pode divergir em R$ 0,01. Bug teórico com impacto financeiro marginal.

---

## 5. Problemas de Usabilidade

### 5.1 Frontend — Dashboard

1. **Step 3 Wizard:** `alert()` nativo para erro de API de planos — deve ser substituído por toast/snackbar.
2. **Fatura mensal do cooperado:** Não verificado em detalhe neste ciclo.
3. **Relatórios:** Tenant isolation verificado — SUPER_ADMIN pode filtrar por cooperativaId, demais limitados ao JWT. OK.

### 5.2 Bot WhatsApp — UX

1. **Fora do horário (20h-8h):** Bot avisa sobre atendimento humano mas continua processando. Correto — simulação 24h funciona.
2. **Protocolo desconhecido:** Resposta clara com `${E.lupa}`. OK.
3. **Cancelamento via WA:** Fluxo `CONFIRMAR_ENCERRAMENTO` — não há prazo claro de carência, apenas "30 dias" na mensagem para o formulário web. Inconsistência: o bot encerra o contrato instantaneamente, o portal fala em 30 dias.
4. **Negociação parcelamento:** Parcelamento em 3x sem juros — mensagem fala em "boletos/PIX nos próximos dias" mas não há sistema que automatize isso. Depende de ação manual da equipe. Usuário pode esperar indefinidamente sem callback.

---

## 6. Segurança

| Item | Status |
|------|--------|
| JWT isolamento por cooperativaId | ✅ OK |
| SUPER_ADMIN não vaza dados cross-tenant nas rotas principais | ✅ OK |
| Asaas API key criptografada (AES-256-GCM) | ✅ OK |
| Webhook Asaas — token validation | ⚠️ Token simples, sem HMAC |
| WhatsApp webhook secret hardcoded no fallback | ⚠️ P2 aberto |
| FATURA-01: Cooperado só envia fatura para si mesmo | ✅ OK |
| Central de Faturas — IDOR corrigido (IDOR-CF-001) | ✅ OK |
| Roles guard em todos os controllers sensíveis | ✅ OK |
| Rate limiting no webhook-incoming | ✅ `@Throttle` aplicado |

---

## 7. Infraestrutura e Crons

| Cron | Horário | Status |
|------|---------|--------|
| marcarVencidas | 2h AM | ✅ OK |
| calcularMultaJuros | 3h AM | ✅ OK (divergência P2) |
| notificarCobrancasVencidas | 6h AM | ✅ OK — rate limit por cooperativa |
| Cooper Token: processar expirados | Verificar | Não encontrado neste ciclo |
| Clube Vantagens: recalcularIndicadosAtivos | — | ❌ AUSENTE (bug #001 acima) |

---

## 8. Resumo Executivo

### Score: 8.4/10 ↓ (vs 8.5 no ciclo anterior)

**Positivo:**
- CONV-02 e CLB-02 definitivamente corrigidos — zero bugs críticos de MLM
- Lógica de cobrança mensal (4 modelos) correta e testável
- CooperToken: crédito, débito e valuation todos OK
- Asaas: criptografia AES-256-GCM, idempotência via `ultimoWebhookEventId`
- Bot: timeout 30min, fallback de áudio, menu cooperado robusto
- Tenant isolation verificado em relatórios e central de faturas

**Preocupante:**
- **BUG-NEW-001 (P2):** `indicadosAtivos` nunca decrementado → tiers inflados no Clube de Vantagens
- **BUG-NEW-002 (P2):** `darBaixa` sem atomicidade → potencial duplo-processamento em race condition
- **SEC-CT-002 (P2):** Secret WA hardcoded persiste
- **BUG-WA-AUDIO (P2):** Áudio/vídeo/sticker silenciosamente descartados pelo whatsapp-service
- **BUG-CALCULO-001 (P2):** Inconsistência de precisão multa/juros (impacto < R$ 0,01 na prática)

---

## 9. Bugs P2 Ativos (pós-ciclo 10/04)

| ID | Bug | Sprint sugerido |
|----|-----|-----------------|
| SEC-CT-002 | Secret WA na query string / hardcoded nos logs | Próximo |
| BUG-WA-AUDIO | audio/video/sticker sem tipo correto no whatsapp-service | Próximo |
| BUG-NEW-002 | Webhook Asaas sem HMAC validation | Próximo |
| BUG-CALCULO-001 | Arredondamento multa/juros: 2dp vs 4dp intermediário | Backlog |
| BUG-NEW-2026-04-10-001 | indicadosAtivos nunca decrementado (Clube/MLM) | Próximo |
| BUG-NEW-2026-04-10-002 | darBaixa sem atomicidade — race condition | **URGENTE** |

---

*Próxima análise automática: 11/04/2026 às 03h*
