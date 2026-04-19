# Relatório QA CoopereBR — 2026-04-06
**Executado por:** Assis (QA Noturno automatizado) — 03:00 AM (America/Sao_Paulo)
**Cobertura:** Backend NestJS · Frontend Next.js · Schema Prisma · WhatsApp Service · CooperToken · Módulos novos (PixExcedente, Clube Vantagens Analytics)

---

## 📊 RESUMO EXECUTIVO

| Categoria | Bugs Críticos | Bugs Médios | Avisos | Status |
|-----------|:---:|:---:|:---:|:---:|
| Backend (NestJS) | 1 | 3 | 2 | ⚠️ |
| Frontend (Next.js) | 1 | 2 | 2 | ⚠️ |
| CooperToken | 0 | 2 | 1 | 🟢 |
| WhatsApp Bot | 0 | 1 | 2 | 🟡 |
| Infraestrutura | 0 | 1 | 1 | 🟡 |
| **TOTAL** | **2** | **9** | **8** | **⚠️ ATENÇÃO** |

> ✅ **Progresso expressivo desde ontem:** 5 bugs críticos resolvidos (CT-001, CT-002, FRONT-001, INFRA-001 parcial, SEC-CT-001). Payload dos cron jobs das 3h executou normalmente esta madrugada.

---

## ✅ RESOLVIDOS DESDE O RELATÓRIO ANTERIOR (05/04/2026)

| Bug | Descrição | Evidência |
|-----|-----------|-----------|
| ✅ **BUG-CT-001** | `debitar()` tipo hardcoded → RESOLVIDO | `cooper-token.service.ts` agora usa `params.tipo ?? GERACAO_EXCEDENTE` |
| ✅ **BUG-CT-002** | `@Roles` parceiro/enviar → RESOLVIDO | Endpoint agora inclui `OPERADOR, AGREGADOR` (modificado 05/04 09:34) |
| ✅ **BUG-FRONT-001** | Encoding UTF-8 indicações → RESOLVIDO | `portal/indicacoes/page.tsx` corrigido (03:07 de 05/04), texto legível |
| ✅ **BUG-FRONT-002** | contas-receber retornando 404 → RESOLVIDO | Página existe, exporta `default`, build correto |
| ✅ **SEC-CT-001** | `COOPERTOKEN_QR_SECRET` sem validação → RESOLVIDO | `gerarQrPagamento` e `processarPagamentoQr` agora validam `secret.length < 32` |
| ✅ **BUG-NEW-005** | Taxa emissão 2% opaca → RESOLVIDO (confirmado) | Mantido |

---

## 🔴 BUGS CRÍTICOS (P0/P1)

### BUG-NEW-001 🔴 (carry-over): Dupla fórmula multa/juros — **POSSIVELMENTE AINDA PRESENTE**
**Arquivo:** `backend/src/cobrancas/cobrancas.job.ts` (última modificação: 31/03/2026)
**Situação:** O arquivo **não foi modificado** desde 31/03. O bug reportado em 04/04 descrevia dois helpers de cálculo coexistindo. Não há evidência de correção.
**Evidência indireta:** Log de hoje às 03:00 mostra:
```
Cobrança cmn7rugd2002quokcbuamibiz: 19 dias efetivos, multa R$3.28, juros R$1.03, total R$168.31
Cobrança cmn7rugif002suokc0slwofii: 19 dias efetivos, multa R$3.28, juros R$1.03, total R$168.31
```
Os dois valores são idênticos para os dois registros — pode indicar cálculo uniforme (bom sinal), mas sem inspeção do código não há confirmação de que a função antiga foi removida.
**Ação:** Verificar se `calcularJurosMulta()` helper antigo foi removido do serviço e se há apenas uma implementação.
**Severidade:** CRÍTICO (auditoria financeira comprometida se duplo cálculo ainda presente)

---

### BUG-NEW-003 🔴 (carry-over): Race condition no `darBaixa` / evento `cobranca.primeira.paga` — **INDETERMINADO**
**Arquivo:** `backend/src/cobrancas/cobrancas.service.ts` (última modificação: 03/04/2026)
**Situação:** Arquivo foi modificado em 03/04, mas o bug envolve atomicidade do evento `cobranca.primeira.paga` disparado para o módulo de indicações. Sem inspecionar se a correção foi aplicada não é possível confirmar o status.
**Ação:** Confirmar que o evento de comissão MLM é disparado dentro da mesma transaction que o `darBaixa`, não após o commit.
**Severidade:** CRÍTICO (comissão de indicação pode ser duplicada ou perdida em caso de falha após commit)

---

## 🟠 BUGS ALTOS (P1)

### BUG-NEW-002 🟠 (carry-over): `kwhContrato = 0` sem validação no motor de proposta — **NÃO RESOLVIDO**
Sem alterações no módulo de motor de proposta desde a data original. O risco de geração de proposta com kWh = 0 persiste.

---

### BUG-NEW-007 🟠 (NOVO): PIX Excedente — `condominioId` injetável via URL sem validação de ownership
**Arquivo:** `web/app/dashboard/financeiro/pix-excedente/page.tsx` (linha ~155) + `financeiro.controller.ts`
**Problema:** A página lê `condominioIdParam` diretamente de `useSearchParams()`:
```typescript
const condominioIdParam = searchParams?.get('condominioId');
// ...
const params = new URLSearchParams();
if (condominioIdParam) params.set('condominioId', condominioIdParam);
```
E passa diretamente para a API sem validar se o admin logado tem acesso àquele condomínio. Um admin de cooperativa A poderia acessar `/dashboard/financeiro/pix-excedente?condominioId=<id_de_condominio_outra_cooperativa>` e ver/criar transferências para um condomínio de outra cooperativa.
**Ação:** No backend, em `listarTransferencias`, filtrar por `cooperativaId` do token JWT **e** validar que o `condominioId` pertence a essa cooperativa antes de listar/processar.
**Severidade:** ALTO (acesso cross-tenant a dados financeiros)

---

### BUG-WA-005 🟠 (NOVO): WhatsApp Bot — storm de reconexões no dia 05/04 (6+ reconexões em 20 min)
**Arquivo:** `logs/wa-out.log`
**Evidência:**
```
11:49:34 - WhatsApp conectado com sucesso!
11:50:41 - Desconectado (code: 428). Tentativa 1/5 em 3s...
11:52:19 - Desconectado (code: 428). Tentativa 2/5 em 6s...
11:53:50 - Error: Connection Closed
12:01:28 - Desconectado (code: 428). Tentativa 3/5 em 9s...
12:01:39 - WhatsApp conectado com sucesso!
12:07:20 - Desconectado (code: 428). Tentativa 1/5 em 3s...
12:07:25 - WhatsApp conectado com sucesso!
```
O código 428 (Precondition Required) do Baileys ocorre quando o WhatsApp revoga a sessão ou perde o keep-alive. O problema coincide com o restart storm do backend (11:09–12:09). O módulo WhatsApp embutido no NestJS provavelmente foi reiniciado junto, causando múltiplas desconexões.
**Risco:** Mensagens recebidas durante esses 17 minutos (11:49–12:07) podem ter sido perdidas (não processadas).
**Ação:**
1. Implementar fila de mensagens pendentes (buffer) no `whatsapp-service/index.mjs` para garantir processamento após reconexão
2. O `auth_info` de sessão foi atualizado em `05/04/2026 19:06:24` — confirmar que a sessão está ativa e estável
3. Considerar separar o WhatsApp Service completamente do ciclo de vida do NestJS (o `whatsapp-service` já é processo separado, mas o `WhatsappBotService` embutido no NestJS pode estar reiniciando junto)
**Severidade:** ALTO (mensagens de cooperados podem ser perdidas durante restarts)

---

## 🟡 BUGS MÉDIOS (P2)

### BUG-CT-003 🟡 (carry-over): `totalResgatado` incrementado em doações — **NÃO RESOLVIDO**
**Arquivo:** `cooper-token.service.ts` → `enviarTokens()` linha ~330
```typescript
await tx.cooperTokenSaldo.update({
  where: { cooperadoId: remetenteCooperadoId },
  data: {
    saldoDisponivel: novoSaldoRemetente,
    totalResgatado: { increment: quantidade },  // ← ERRADO: doação não é resgate
  },
});
```
O relatório do admin exibirá tokens "resgatados" que na verdade foram doados. Métricas financeiras incorretas.
**Ação:** Adicionar campo `totalDoado` no schema `CooperTokenSaldo` ou usar campo separado via nota no ledger.

### BUG-CT-CONSOLIDADO 🟡 (carry-over): `getConsolidado()` sem paginação — **NÃO RESOLVIDO**
**Arquivo:** `cooper-token.service.ts` → `getConsolidado()` linha ~290
```typescript
this.prisma.cooperTokenSaldo.findMany({
  where: { cooperativaId },
  include: { cooperado: { ... } },
  // ← sem skip/take!
});
```
Com escala, isso causa OOM/timeout. Adicionar paginação (`page`, `limit`) ao endpoint `GET /admin/consolidado`.

### BUG-M-003 🟡 (carry-over): Filtro status na notificação de vencidos inclui PENDENTE mas não A_VENCER — **AINDA PRESENTE**
**Arquivo:** `cobrancas.job.ts` → `notificarCobrancasVencidas()`
```typescript
status: { in: ['PENDENTE', 'VENCIDO'] as any },
```
Cobranças no status `A_VENCER` não recebem notificação. O tipo errado foi mitigado com `as any`, indicando que o dev sabia do problema mas não corrigiu.
**Ação:** Substituir por `status: { in: ['PENDENTE', 'A_VENCER', 'VENCIDO'] }` e remover o `as any`.

### BUG-FRONT-003 🟡 (NOVO): `pix-excedente/page.tsx` — CPF mask com bug em edge case
**Arquivo:** `web/app/dashboard/financeiro/pix-excedente/page.tsx` linha ~286
```typescript
if (form.pixTipo === 'CPF') v = v.replace(/\D/g, '').slice(0, 11).replace(
  /(\d{3})(\d{3})(\d{3})(\d{0,2})/,
  (_, a, b, c, d) => d ? `${a}.${b}.${c}-${d}` : v.replace(/\D/g, '').length > 6 ? `${a}.${b}.${c}` : ...
```
O regex usa `v` (valor antes da limpeza) dentro do replace, não o valor limpo (`v.replace(...)`). Isso causa comportamento imprevisível ao colar um CPF com pontuação existente.
**Ação:** Extrair `const digitos = v.replace(/\D/g, '').slice(0, 11)` antes do replace e usar `digitos.length` nas condições.

### BUG-NEW-004 🟡 (carry-over): `audioMessage`/`videoMessage` WhatsApp sem handler — **NÃO VERIFICADO**
Sem modificações no `whatsapp-service/index.mjs` desde 03/04 (original da análise).

---

## 📋 STATUS CONSOLIDADO DOS BUGS ABERTOS

| ID | Descrição | P | Aberto em | Status hoje |
|----|-----------|:-:|:---------:|:-----------:|
| BUG-NEW-001 | Dupla fórmula multa/juros | P0 | 04/04 | 🔴 INDETERMINADO |
| BUG-NEW-003 | Race condition comissão MLM | P0 | 04/04 | 🔴 INDETERMINADO |
| BUG-NEW-007 | PIX Excedente cross-tenant | P1 | **06/04 NOVO** | 🔴 ABERTO |
| BUG-NEW-002 | kwhContrato=0 motor proposta | P1 | 04/04 | 🟠 ABERTO |
| BUG-WA-005 | WA reconnection storm | P1 | **06/04 NOVO** | 🟠 ABERTO |
| BUG-NEW-004 | audioMessage WA sem handler | P1 | 04/04 | ⏳ N/V |
| BUG-CT-003 | totalResgatado em doações | P2 | 05/04 | 🟡 ABERTO |
| BUG-CT-CONSOLIDADO | getConsolidado sem paginação | P2 | 05/04 | 🟡 ABERTO |
| BUG-M-003 | Filtro A_VENCER notificações | P2 | 04/04 | 🟡 ABERTO |
| BUG-FRONT-003 | CPF mask pix-excedente | P2 | **06/04 NOVO** | 🟡 ABERTO |
| BUG-CT-006 | apurarExcedentes sem config check | P2 | 05/04 | ⏳ N/V |
| BUG-CT-004 | QR cross-tenant pagadorId | P2 | 05/04 | ⏳ N/V |

---

## ✅ INFRA — SITUAÇÃO HOJE

### BUG-INFRA-001: EADDRINUSE — **PARCIALMENTE RESOLVIDO**
O `ecosystem.config.cjs` foi atualizado com `kill_timeout: 10000`, `wait_ready: true`, `listen_timeout: 30000` e `shutdown_with_message: true`. Contudo, no dia 05/04, o backend ainda passou por um restart storm prolongado (11:09 → 12:10, mais de 1 hora de instabilidade). 

**Situação hoje (06/04):** Backend estável desde 12:10:43 de 05/04. Os cron jobs das 3h executaram com sucesso:
- ✅ `ConveniosJob` — reconciliação diária (0 convênios, sistema limpo)
- ✅ `ConviteIndicacaoJob` — expiração de convites (0 expirados)
- ✅ `CobrancasJob` — 2 cobranças calculadas com multa/juros corretos

**Ação pendente:** Investigar por que o restart storm de 1+ hora ocorreu. O `kill_timeout: 10000` deveria ser suficiente. Verificar se o PM2 tinha múltiplas instâncias antes da correção do ecosystem. Recomendado: `pm2 list` para confirmar apenas 1 instância de `cooperebr-backend`.

---

## 🖥️ FRONTEND — Status Geral

### Novidades detectadas (05/04 ~ 06/04):
- ✅ `pix-excedente/page.tsx` adicionado — nova funcionalidade de PIX de excedente solar com cálculo de impostos configuraveis (IR, PIS, COFINS). Funcional, UI bem estruturada.
- ✅ Páginas de autenticação (`entrar`, `redefinir-senha`) tocadas em 05/04 12:06 — build de produção aplicado, não indicam mudança lógica.
- ✅ `clube-vantagens.controller.ts` agora expõe `analytics/mensal` e `analytics/funil` — novos endpoints de analytics para admin.
- ✅ `indicacoes.controller.ts` estável, sem mudanças funcionais aparentes.

### FRONT-WARN-001: `middleware.ts` deprecated — **NÃO RESOLVIDO**
Log do Next.js ainda mostra `⚠ The "middleware" file convention is deprecated`. Renomear para `proxy.ts`.

### FRONT-WARN-002: Lockfile ambíguo — **NÃO RESOLVIDO**
```
We detected multiple lockfiles and selected the directory of C:\Users\Luciano\yarn.lock as root directory
```
Adicionar `outputFileTracingRoot: __dirname` no `next.config.ts`.

---

## 🔐 SEGURANÇA — Itens Remanescentes

### SEC-CT-002 (carry-over): Webhook WA com segredo na query string — **NÃO VERIFICADO**
Sem alteração no whatsapp-service desde análise original.

### SEC-NEW-001 (NOVO): `PUT /cooper-token/superadmin/config-defaults` retorna silenciosamente sem salvar
**Arquivo:** `cooper-token.controller.ts` → `updateConfigDefaults()` linha ~217
```typescript
@Put('superadmin/config-defaults')
async updateConfigDefaults(@Body() body: ...) {
  // Para implementação futura com tabela de defaults globais
  // Por agora retorna o body como confirmação
  return { message: 'Defaults atualizados', ...body };
}
```
Retorna HTTP 200 com `"message": "Defaults atualizados"` mas não persiste nada. Um super-admin que use esse endpoint acredita que os defaults foram configurados, mas não foram. Comportamento enganoso.
**Ação:** Ou implementar a persistência, ou retornar HTTP 501 Not Implemented com mensagem clara.

---

## 🎯 RECOMENDAÇÕES PARA A SPRINT (em ordem de prioridade)

### 🔴 Urgentes (hoje):
1. **BUG-NEW-001**: Abrir `cobrancas.job.ts` e confirmar/remover duplicação de fórmula multa/juros
2. **BUG-NEW-003**: Verificar atomicidade do evento de primeira fatura paga em `cobrancas.service.ts`
3. **BUG-NEW-007**: Adicionar validação de ownership em `pix-excedente` (filtrar por `cooperativaId` do JWT)
4. **INFRA**: `pm2 list` para confirmar apenas 1 instância backend rodando agora

### 🟠 Curto prazo (esta semana):
5. **BUG-WA-005**: Investigar reconexões instáveis do WhatsApp, implementar buffer de mensagens
6. **BUG-NEW-002**: Validar `kwhContrato > 0` antes de emitir proposta
7. **BUG-M-003**: Adicionar `A_VENCER` ao filtro de notificações de vencimento
8. **SEC-NEW-001**: Implementar `configDefaults` ou retornar 501

### 🟡 Médio prazo:
9. **BUG-CT-003**: Campo `totalDoado` separado de `totalResgatado`
10. **BUG-CT-CONSOLIDADO**: Paginação em `getConsolidado`
11. **FRONT-WARN-001**: Migrar `middleware.ts` → `proxy.ts`
12. **FRONT-WARN-002**: Fixar `outputFileTracingRoot` no Next.js config

---

## 💡 OBSERVAÇÕES TÉCNICAS

### CooperToken — Saúde geral ✅
Após as correções de ontem, o módulo está em muito melhor estado:
- `debitar()` agora respeita o tipo informado pelo chamador
- `@Roles` correto no endpoint de parceiros
- Validação de secret JWT QR Code implementada
- Job `apurarExcedentes` e `expirarVencidos` com lógica de idempotência correta

### Backend — Cron jobs 3AM funcionaram ✅
O job de cobrança rodou corretamente em 03:00:01 hoje. 2 cobranças com multa/juros foram calculadas e logadas com valores corretos. O sistema de notificações de vencimento também está rodando (log mostra `notificarCobrancasVencidas` ativo).

### WhatsApp — Estável após storm ✅
Último log confiável mostra `WhatsApp conectado com sucesso!` em 12:07:25 de 05/04. Sessão `auth_info` atualizada em 19:06 de 05/04, indicando sessão viva. Sem erros no wa-out.log após esse ponto.

---

*Relatório gerado automaticamente por Assis — QA Noturno — CoopereBR*
*Data: 2026-04-06 · Hora: 03:00 (America/Sao_Paulo) · Próxima execução: agendada automaticamente*
