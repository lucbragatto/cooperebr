# Relatório QA — CoopereBR
**Data:** 2026-04-12 | **Horário:** 03:00 (America/Sao_Paulo) — ciclo noturno automático
**Score:** 7.5/10 ↓ (−0.3 vs ciclo 11/04)
**Críticos:** 1 novo + 1 carry | **P2 ativos:** 13 | **P3:** 3
**Gerado por:** Assis — análise profunda de arquivos modificados + schema + carries

---

## 1. Status dos Itens do Ciclo Anterior

### 🔴 BUG-NEW-2026-04-11-001 — `modoTeste = true` em produção — **PERSISTE (P1)**
Arquivo `web/app/cadastro/page.tsx` modificado em 11/04 às 09:28.
```tsx
async function handleSubmit() {
  const modoTeste = true; // fase de testes - mudar para false antes de produção
  if (!modoTeste) {
    if (!aceitouTermos) { setErro('...'); return; }
    if (!planoSelecionado) { setErro('...'); return; }
  }
```
Bypass total: aceite de termos, seleção de plano. Além disso, há um **botão visível** no UI em produção:
```tsx
<button onClick={handleSubmit} className="...bg-gray-100...">
  Finalizar sem escolher plano (modo teste)
</button>
```
Risco legal imediato — usuários finais conseguem finalizar cadastro sem aceitar termos.
**Status: ABERTO 🔴 P1 — URGENTE**

### 🟡 BUG-NEW-2026-04-11-002..008 — Todos PERSISTEM (P2/P3)
Nenhum dos 7 bugs do ciclo anterior foi corrigido. Ver tabela completa na Seção 8.

### ✅ BUG-NEW-2026-04-10-002 — `darBaixa` race condition — **RESOLVIDO (confirmado)**
`updateMany` atômico com guard `status: { notIn: ['PAGO', 'CANCELADO'] }`. Mantido. Fechado.

---

## 2. Bugs Novos — Ciclo 12/04/2026

---

### 🔴 BUG-NEW-2026-04-12-001 — `ConfigTenant.chave @unique` quebra isolamento multi-tenant
**Prioridade: P1 | Área: Segurança / Multi-tenant / Dados**
**Arquivos:** `backend/prisma/schema.prisma` + `backend/src/config-tenant/config-tenant.service.ts`

**Schema:**
```prisma
model ConfigTenant {
  chave         String   @unique   // ← GLOBALMENTE ÚNICO (não por cooperativa)
  cooperativaId String?
  ...
}
```

**Service:**
```typescript
async set(chave: string, valor: string, cooperativaId: string, descricao?: string) {
  return this.prisma.configTenant.upsert({
    where: { chave },       // ← busca global, ignora cooperativaId
    update: { valor, cooperativaId, ... },   // ← troca o dono do registro!
    create: { chave, valor, cooperativaId, ... },
  });
}
```

**Cenário de ataque:**
1. Cooperativa A configura `email.monitor.user = "admin@A.com"` via `PUT /config-tenant/email.monitor.user`
2. Cooperativa B faz o mesmo com `PUT /config-tenant/email.monitor.user` (valor B)
3. O `upsert` de B **encontra o registro de A** (porque `chave` é globalmente única) e o **atualiza**, trocando o `cooperativaId` para B
4. A configuração de A é **destruída** — sem erro, sem log
5. O email monitor de A para de funcionar silenciosamente (usa a config de B)

**Impacto:**
- Credenciais IMAP, senhas de e-mail, config do monitor: todas compartilham o mesmo namespace
- Em ambiente multi-parceiro, qualquer ADMIN pode sobrescrever configs de outros parceiros
- Dados financeiros processados pelo monitor podem ir para o cooperado errado

**Fix sugerido:**
```prisma
model ConfigTenant {
  chave         String
  cooperativaId String?
  @@unique([chave, cooperativaId])   // compound unique
}
```
```typescript
// No service:
upsert({
  where: { chave_cooperativaId: { chave, cooperativaId: cooperativaId ?? '' } },
  ...
})
```
**Migração necessária:** `prisma migrate dev` para alterar o constraint.
**Status: ABERTO 🔴 P1 — Novo (requer migração)**

---

### 🟡 BUG-NEW-2026-04-12-002 — `email-monitor.service.ts` lê config sem filtro de cooperativaId
**Prioridade: P2 | Área: Multi-tenant / Email Monitor**
**Arquivo:** `backend/src/email-monitor/email-monitor.service.ts`

```typescript
private async getConfigFromDb(chave: string): Promise<string | null> {
  const config = await this.prisma.configTenant.findFirst({
    where: { chave },   // ← sem cooperativaId — pega qualquer cooperativa
  });
  return config?.valor ?? null;
}
```

Consequência direta do BUG-NEW-2026-04-12-001: o monitor usa a config do `cooperativaId` que aparece primeiro no banco, não necessariamente a cooperativa correta.

Adicionalmente, `identificarCooperado()` busca cooperados globalmente:
```typescript
const cooperado = await this.prisma.cooperado.findFirst({
  where: { email: email.remetente },   // ← sem cooperativaId
});
```
Faturas de email poderiam ser atribuídas a cooperados de outras cooperativas com o mesmo e-mail.

**Status: ABERTO 🟡 P2**

---

### 🟡 BUG-NEW-2026-04-12-003 — `criarNotificacaoPendente` sem cooperativaId
**Prioridade: P2 | Área: Email Monitor / Notificações**
**Arquivo:** `backend/src/email-monitor/email-monitor.service.ts`

```typescript
private async criarNotificacaoPendente(email: EmailProcessado): Promise<void> {
  await this.prisma.notificacao.create({
    data: {
      titulo: 'Fatura por e-mail não identificada',
      mensagem: `E-mail de ${email.remetente}...`,
      tipo: 'ALERTA',
      lida: false,
      // cooperativaId: AUSENTE ← notificação órfã
    },
  });
}
```

Notificações criadas pelo email monitor ficam sem `cooperativaId` — não aparecem no painel de nenhuma cooperativa. Faturas não identificadas passam despercebidas.

**Status: ABERTO 🟡 P2**

---

### 🟡 BUG-NEW-2026-04-12-004 — Admin phone hardcoded em `notificarAdminCreditosInjetados`
**Prioridade: P3 | Área: Segurança / Config**
**Arquivo:** `backend/src/publico/publico.controller.ts`

```typescript
const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER ?? '5527981341348';
```

Se `ADMIN_WHATSAPP_NUMBER` não estiver definido no ENV de produção, notificações de novos leads com créditos injetados vão para um número pessoal hardcoded. Em ambiente multi-tenant, todos os parceiros notificariam o mesmo número.

**Status: ABERTO 🟡 P3**

---

## 3. Análise de Fluxos — Wizards e Bot WhatsApp

### 3.1 Wizard de Cadastro Público (`/cadastro`)
- **OCR Step 0:** Rate limit 5req/60s por IP. OK.
- **Step 1-3 (dados, endereço, instalação):** CEP via ViaCEP, máscaras. OK.
- **Simulação (Step 3):** Tarifa EDP-ES hardcoded `TARIFA_KWH = 0.78931` (BUG-002 persiste). CEMIG/CPFL/Energisa recebem projeção errada.
- **Submit:** `modoTeste=true` — botão visível "Finalizar sem escolher plano" — **risco legal ativo** (BUG-001 P1).
- **Plano default:** `planoSelecionado || 'DESCONTO_DIRETO'` — cooperado pode ser cadastrado sem escolha consciente.
- **Tokens de indicação:** creditados ao criar lead, antes de aprovação (BUG-003 persiste).
- **Novo: Créditos injetados:** fluxo especial funcional. `handleConfirmarContatoCreditos` aceita dados mínimos. Sem validação de telefone — cooperado pode submeter telefone inválido.

### 3.2 Bot WhatsApp — Estados e Fluxos
- Timeout 30 min, graceful degradation CoopereAI: OK
- Fallback 15s: OK
- Audio/Video/Sticker: descartado silenciosamente (BUG-WA-AUDIO persiste)
- NPS via `setTimeout`: sem persistência — reinicialização do backend cancela NPS pendentes (P3 existente)
- Rate limit por cooperativa: OK

### 3.3 Email Monitor (novo módulo — 11/04)
- CRON `*/30 * * * *` (a cada 30 min): OK
- Guard `this.processando`: previne reentrada. OK.
- `pareceSerFaturaConcessionaria`: heurística por termos. OK.
- Criação de pastas IMAP `Processados`/`Pendentes`: OK.
- `identificarCooperado` sem tenant isolation: **BUG-002 P2**.
- Notificação de pendência sem cooperativaId: **BUG-003 P2**.
- Config global via `chave @unique`: **BUG-001 P1**.

---

## 4. Inconsistências de Cálculo

### 4.1 Cobrança Mensal — 4 modelos verificados
Todos OK. Guard `kwhContrato > 0` existente.

### 4.2 Multa/Juros — 3 implementações distintas
| Método | Precisão | Arredondamento |
|--------|----------|----------------|
| `cobrancas.job.ts` | 2dp direto | Math.round(*100)/100 |
| `darBaixa` | 4dp (1e4) | Math.round(*100)/100 |
| `reenviarNotificacao` | nenhuma | Math.round(*100)/100 |
Divergência de R$0,01 possível entre notificação e cobrança real. (BUG-CALCULO-001 persiste)

### 4.3 PIX Excedente — arredondamentos independentes
`valorBruto - valorImpostos ≠ valorLiquido` quando arredondamentos ocorrem individualmente. (P3 existente)

### 4.4 CooperToken Excedente
`cotaKwhMensal = null → 0 → excedente = 100% da geração`. (BUG-008 persiste)

### 4.5 FATURA_CHEIA_TOKEN gravado como BONUS_INDICACAO
Ledger corrompido para cooperados no plano Fatura Cheia. (BUG-006 persiste)

### 4.6 indicadosAtivos inflado
`recalcularIndicadosAtivos()` nunca chamado por cron. `ClubeVantagensJob` usa valor velho. (BUG-010 persiste)

---

## 5. Segurança

| Item | Status |
|------|--------|
| JWT + cooperativaId isolamento em controllers | ✅ OK |
| ConfigTenant `chave @unique` — sobreposição multi-tenant | 🔴 P1 NOVO |
| `modoTeste=true` bypassa aceite de termos | 🔴 P1 PERSISTE |
| Email monitor sem tenant isolation | 🟡 P2 NOVO |
| Webhook Asaas sem HMAC-SHA256 | 🟡 P2 |
| WhatsApp secret na query string (SEC-CT-002) | 🟡 P2 |
| `processarIndicacao` credita tokens antes de aprovação | 🟡 P2 |
| `resgatarOferta` race condition no estoque | 🟡 P2 |
| `cotaKwhMensal=null` → tokens indevidos | 🟡 P2 |
| FATURA_CHEIA_TOKEN→BONUS_INDICACAO ledger | 🟡 P2 |
| Admin phone hardcoded no fallback | 🟡 P3 |
| `/reconnect` sem auth no whatsapp-service | 🟡 P3 |
| CORS `*` em whatsapp-service (porta 3002) | 🟡 P3 |
| Central de Faturas IDOR | ✅ CORRIGIDO |
| `darBaixa` race condition | ✅ CORRIGIDO |

---

## 6. Infraestrutura e Crons

| Cron | Horário | Status |
|------|---------|--------|
| `marcarVencidas` | 2h AM | ✅ OK |
| `calcularMultaJuros` | 3h AM | ✅ OK |
| `CooperTokenJob.expirarTokensVencidos` | Dia 1 às 2h | ✅ OK |
| `CooperTokenJob.apurarExcedentes` | 6h AM | 🟡 Conflito + BUG-008 |
| `notificarCobrancasVencidas` | 6h AM | 🟡 Conflito horário |
| `verificarEmailsFaturas` (NOVO) | */30min | 🟡 BUG-002/003 |
| `ClubeVantagensJob.enviarResumosMensais` | Dia 1 às 9h | 🟡 indicadosAtivos inflado |
| `recalcularIndicadosAtivos` | **AUSENTE** | ❌ Nenhum cron aciona |

**Obs. novo cron:** O `email-monitor.service.ts` roda a cada 30 minutos. Com o BUG-001 (ConfigTenant global), se outra cooperativa configurar `email.monitor.ativo = false`, desligará o monitor para **todas** as cooperativas simultaneamente.

---

## 7. Resumo Executivo

### Score: 7.5/10 ↓ (vs 7.8 em 11/04)

**Positivos:**
- ✅ `darBaixa` race condition: FECHADO e mantido
- ✅ Email Monitor: novo módulo bem estruturado (arquitetura sólida)
- ✅ Controller auth email-monitor: `@Roles(SUPER_ADMIN, ADMIN)` correto
- ✅ Teste IMAP manual via API: funcional e seguro (senha não retornada)
- ✅ ConfigTenant controller passa cooperativaId corretamente em todas as rotas

**Preocupante:**
- 🔴 **BUG-NEW-2026-04-12-001 (P1):** `chave @unique` no schema — multi-tenant isolation completamente quebrado para ConfigTenant. Requer migração urgente antes de ter múltiplos parceiros ativos.
- 🔴 **BUG-NEW-2026-04-11-001 (P1 CARRY):** `modoTeste=true` com botão visível no cadastro público. **Já são 2 dias sem correção.**
- 🟡 Email Monitor (novo): 3 bugs novos associados ao módulo entregue ontem
- 🟡 Stack de P2 aumentando: 13 bugs P2 abertos sem sprint definido

---

## 8. Bugs Ativos Pós-Ciclo 12/04/2026

| ID | Bug | Prioridade | Sprint |
|----|-----|------------|--------|
| BUG-NEW-2026-04-12-001 | ConfigTenant chave @unique — multi-tenant isolation quebrado | **P1** | **MIGRAÇÃO URGENTE** |
| BUG-NEW-2026-04-11-001 | `modoTeste=true` — bypassa termos e plano (botão visível) | **P1** | **URGENTE** |
| BUG-NEW-2026-04-12-002 | email-monitor sem filtro cooperativaId | P2 | Próximo |
| BUG-NEW-2026-04-12-003 | notificação email-monitor sem cooperativaId | P2 | Próximo |
| BUG-NEW-2026-04-11-005 | Race condition resgate de oferta (estoque) | P2 | Próximo |
| BUG-NEW-2026-04-11-006 | FATURA_CHEIA_TOKEN → BONUS_INDICACAO no ledger | P2 | Próximo |
| BUG-NEW-2026-04-11-008 | cotaKwhMensal null inflaciona excedente tokens | P2 | Próximo |
| BUG-NEW-2026-04-11-002 | Tarifa hardcoded EDP-ES na simulação | P2 | Próximo |
| BUG-NEW-2026-04-11-003 | Tokens BONUS_INDICACAO creditados antes de aprovação | P2 | Próximo |
| SEC-CT-002 | Secret WA hardcoded no fallback da URL | P2 | Próximo |
| BUG-WA-AUDIO | audio/video/sticker sem tipo correto no whatsapp-service | P2 | Próximo |
| BUG-NEW-002 | Webhook Asaas sem HMAC validation | P2 | Próximo |
| BUG-NEW-2026-04-10-001 | indicadosAtivos nunca decrementado (Clube/MLM) | P2 | Próximo |
| BUG-NEW-2026-04-12-004 | Admin phone hardcoded no fallback env | P3 | Backlog |
| BUG-NEW-2026-04-11-004 | Multa inconsistente em reenviarNotificacao | P3 | Backlog |
| BUG-NEW-2026-04-11-007 | Conflito crons às 6h (tokens + cobrança) | P3 | Backlog |
| BUG-CALCULO-001 | Arredondamento multa/juros 2dp vs 4dp | P2 | Backlog |

---

*Próxima análise automática: 13/04/2026 às 03h*
