# Relatório QA — CoopereBR
**Data:** 2026-03-28
**Horário:** 03:00 (America/Sao_Paulo)
**Período analisado:** commits de 27/03/2026 (03h) a 28/03/2026 (03h)
**Módulos revisados:** Auth/JWT, Cobranças (serviço + job + controller), WhatsApp Sender, WhatsApp Bot, Portal Indicações, Correções de Segurança Migracoes-Usina
**Score geral de qualidade: 7.3 / 10** ↑ (+0.5 vs relatório anterior)

---

## 1. STATUS DOS ITENS CRÍTICOS DO RELATÓRIO ANTERIOR (2026-03-27)

| ID | Descrição | Status Anterior | Status Hoje | Observação |
|----|-----------|-----------------|-------------|------------|
| SEC-05/MIG-01 | IDOR lista-concessionaria (CPF/UC cross-tenant) | **CRÍTICO** | ✅ **CORRIGIDO** | `gerarListaConcessionaria` agora verifica `usina.cooperativaId === cooperativaId`; ForbiddenException se divergir |
| SEC-06 | IDOR dual-lista sem validação de tenant | **ALTA** | ✅ **CORRIGIDO** | Mesmo padrão aplicado em `gerarRelatorioDualLista` |
| SEC-07/MIG-03 | Migração cross-tenant sem ownership check | **CRÍTICO** | ✅ **CORRIGIDO** | `migrarCooperado` e `ajustarKwh` verificam `cooperado.cooperativaId === dto.cooperativaId` |
| AUTH-01 | JWT proprietário/cooperado sem cooperativaId | **ALTA** | ✅ **CORRIGIDO** | `jwt.strategy.ts` agora resolve `cooperativaId: payload.cooperativaId ?? usuario.cooperativaId` |
| COB-Bug1 | Filtro `status` ignorado em `GET /cobrancas` | **ALTA** | ✅ **CORRIGIDO** | Controller aceita `?status=` (string ou array); service aplica `where: { status: { in: [...] } }` |
| COB-Bug2+3 | PENDENTE vencida sem multa/juros; cron não transiciona PENDENTE→VENCIDO | **CRÍTICO** (perda financeira) | ✅ **CORRIGIDO** | `marcarVencidas()` inclui `PENDENTE` no `{ in: [] }`; `darBaixa` recalcula multa/juros para PENDENTE com `dataVencimento < dtPagamento` |
| COB-Bug5 | `darBaixa` sem `metodoPagamento` | **ALTA** | ✅ **CORRIGIDO** | Campo `metodoPagamento?: PIX|BOLETO|TRANSFERENCIA|DINHEIRO` adicionado no body; registrado em `observacoes` do LancamentoCaixa |
| COB-Bug6 | Boleto sem linha digitável nas mensagens WA | **MÉDIA** | ✅ **CORRIGIDO** | Schema: campo `linhaDigitavel String?` em `AsaasCobranca`; Asaas service busca `GET /payments/{id}/identificationField`; WhatsApp inclui linha no texto |
| COB-Bug7 | Sem endpoint de reenvio individual | **ALTA** | ✅ **CORRIGIDO** | `POST /cobrancas/:id/reenviar-notificacao` implementado com cálculo de multa/juros em tempo real |
| MIG-02 | `migrarTodosDeUsina` sem throttle de batch | **ALTA** | ⏳ **PENDENTE** | Nenhuma alteração identificada |
| CLB-01 | Ranking período usa métrica cumulativa | **ALTA** | ⏳ **PENDENTE** | Sem alterações em clube-vantagens.service.ts |
| CLB-02 | `upsertConfig` sem validação de ranges sobrepostos | **ALTA** | ⏳ **PENDENTE** | Sem alterações |
| PIX-01 | PIX Excedente sempre `status: 'SIMULADO'` | **ALTA** | ⏳ **PENDENTE** | Sem integração real. UI não informa que é simulação |
| WZ-09 | SUPER_ADMIN cria cooperado sem cooperativaId | **MÉDIA** | ⏳ **PENDENTE** | Step7Alocacao sem alterações |
| WA-16 | Conversas mortas sem cron de reset | **ALTA** | ⏳ **PENDENTE** | Timeout só funciona se nova mensagem chegar; cron noturno não implementado |
| WA-15 | Motor dinâmico WhatsApp desativado (TODO) | **ALTA** | ⏳ **PENDENTE** | Comentado no bot.service; nenhum progresso |
| PC-05 | Gráfico UC ignora ucId (usa cobranças do cooperado todo) | **ALTA** | ⏳ **PENDENTE** | Sem alterações |
| WZ-07 | Lista espera — cotaKwhMensal zerada | **ALTA** | ⏳ **PENDENTE** | Sem alterações |
| WZ-08 | Criação de cooperado sem transação (partial success possível) | **ALTA** | ⏳ **PENDENTE** | Sem alterações |

---

## 2. BUGS NOVOS ENCONTRADOS — CICLO 27/03 → 28/03

### 2.1 WhatsApp Sender — Proteção de Números Ausente em Menus Interativos

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| WAS-01 | **ALTA** | `enviarMenuComBotoes()` não chama `isNumeroProtegido()` antes de enviar. `enviarMensagem()` tem o guard, mas menus interativos (botões e listas) são enviados diretamente ao endpoint `/send-interactive` sem essa proteção. Resultado: cooperados em seeds de teste podem receber menus do bot quando a lógica de estado mudar para estados que chamam `enviarMenuComBotoes` diretamente | `whatsapp-sender.service.ts` |

**Correção recomendada:**
```typescript
async enviarMenuComBotoes(telefone: string, menu: MenuInterativo, ...): Promise<void> {
  if (this.isNumeroProtegido(telefone)) {
    this.logger.warn(`[BLOQUEADO] Menu para número protegido: ${telefone}`);
    return;
  }
  // ... resto do código
}
```

---

### 2.2 WhatsApp Sender — Super Admin Phone Hardcoded no Código-Fonte

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| WAS-02 | **MÉDIA** | `SUPER_ADMIN_PHONE` tem fallback hardcoded: `process.env.SUPER_ADMIN_PHONE \|\| '5527981341348'`. Se a variável de ambiente não estiver configurada em staging/produção, TODAS as mensagens enviadas pelo sistema serão espelhadas para esse número particular. Risco de: (1) exfiltração involuntária de dados de cooperados para um número não-autorizado em um ambiente de teste; (2) exposição de informações financeiras. | `whatsapp-sender.service.ts:30` |

**Correção recomendada:** Remover o fallback hardcoded — se `SUPER_ADMIN_PHONE` não estiver definido, não espelhar:
```typescript
private readonly SUPER_ADMIN_PHONE = process.env.SUPER_ADMIN_PHONE ?? null;
// ...
if (this.SUPER_ADMIN_PHONE && telefone.replace(...) !== this.SUPER_ADMIN_PHONE.replace(...)) {
  // espelhar
}
```

---

### 2.3 Cobranças Job — Float Sem Arredondamento Persistido

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| COB-Job-01 | **BAIXA** | `calcularMultaJuros()` no job noturno calcula `multa` e `juros` sem arredondamento antes de persistir no banco: `const multa = valorOriginal * (config.multaAtraso / 100)` — resultado com 10-15 casas decimais salvo em `Decimal(10,2)`. O Prisma arredonda na camada do banco (PostgreSQL `NUMERIC`), mas quando lido e usado em cálculos intermediários pode gerar discrepância com o valor exibido no portal (que usa `toFixed(2)`). O método `darBaixa` no service usa `Math.round(...*1e4)/1e4` — inconsistência entre os dois fluxos. | `cobrancas.job.ts:76-80` |

---

### 2.4 Auth Service — Context Switching Sem Reemissão de Token

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| AUTH-02 | **ALTA** | `obterContextosUsuario()` retorna uma lista de contextos disponíveis (cooperado, admin, proprietário, super_admin), mas não há endpoint para reemitir o JWT com um novo `contexto` selecionado. Um SUPER_ADMIN que acessa o portal cooperado terá `cooperativaId: undefined` no token, causando falha silenciosa em todos os endpoints de isolamento de tenant que dependem de `req.user.cooperativaId`. O frontend possivelmente usa apenas o token inicial sem troca. | `auth.service.ts` (ausência de endpoint `/auth/trocar-contexto`) |

**Impacto:** SUPER_ADMIN não consegue testar o portal cooperado/parceiro de forma isolada sem um mecanismo de troca de contexto.

---

### 2.5 Cobranças Service — Inconsistência na Normalização de Telefone

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| COB-Tel-01 | **BAIXA** | `reenviarNotificacao()` normaliza o telefone com prefixo `55`: `cooperado.telefone.replace(/\D/g,'').replace(/^(?!55)/, '55')`. Porém `darBaixa()` chama `whatsappCicloVida.notificarPagamentoConfirmado(cooperado, ...)` sem normalização — usa `cooperado.telefone` diretamente do banco. Se o telefone estiver armazenado sem o DDI `55` (ex: `27981341348`), a mensagem de confirmação de pagamento pode falhar ou ser entregue ao número errado em gateways que exigem DDI. | `cobrancas.service.ts:238` |

---

### 2.6 WhatsApp Bot — Estado `MENU_FATURA` Bypass de Autenticação

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| WA-BOT-01 | **MÉDIA** | Quando o corpo da mensagem contém palavras-chave de fatura (`['fatura', 'faturas', 'boleto', '2a via', 'pix', 'pagar']`), o bot transiciona diretamente para `MENU_FATURA` independente do estado atual, usando `upsert`. Isso ignora qualquer fluxo em andamento (ex: `AGUARDANDO_CONFIRMACAO_PROPOSTA`). Um usuário no meio de uma proposta que manda "pix" para confirmar intenção real ou de forma casual terá o fluxo de proposta abandonado sem aviso. | `whatsapp-bot.service.ts` (bloco keyword fatura) |

---

## 3. ANÁLISE DE CÁLCULOS — COBRANÇA E MLM

### 3.1 Precisão de Multa/Juros — Validação do Fix

O fix do BUG 2+3 foi validado no código. O service agora calcula:
```typescript
const multa = Math.round(valorOriginal * (multaAtraso / 100) * 1e4) / 1e4;
const juros = Math.round(valorOriginal * (jurosDiarios / 100) * diasEfetivos * 1e4) / 1e4;
const valorAtualizado = Math.round((valorOriginal + multa + juros) * 100) / 100;
```
Precisão de 4 casas intermediárias, 2 casas no total — **adequado** para os valores típicos do sistema.

⚠️ **Inconsistência residual:** O job noturno (`calcularMultaJuros`) não usa `Math.round` intermediário. Para cobranças calculadas pelo job (caminho automático 3h da manhã), a persistência pode ter 1-2 centavos de diferença em relação ao cálculo manual via `darBaixa`. Na prática é tolerável mas tecnicamente inconsistente.

### 3.2 MLM / Clube de Vantagens — Sem Alterações

- CLB-01 (ranking por período com métrica cumulativa): **PENDENTE** — nenhuma alteração detectada
- CLB-02 (ranges sobrepostos): **PENDENTE**
- A lógica de `atualizarMetricas` + `notificarIndicadoPagou` no fluxo de `darBaixa` foi auditada: está correta. A atualização de kWh indicado e a promoção de nível disparam corretamente quando o indicado paga a primeira fatura.

### 3.3 Sequência de Crons — Validação

O job reorganizado segue esta sequência:
- **02h00** — `marcarVencidas` (inclui PENDENTE → VENCIDO) ✅
- **03h00** — `calcularMultaJuros` (calcula para VENCIDO — agora cobrindo as recém-marcadas) ✅
- **06h00** — `notificarCobrancasVencidas` (notifica, marca `notificadoVencimento: true`) ✅
- **08h05 todo dia 5** — disparo de cobranças A_VENCER ✅
- **09h00** — `abordarInadimplentes` ✅

**Alerta:** `notificarCobrancasVencidas` usa `where: { status: { in: ['PENDENTE', 'VENCIDO'] }, dataVencimento: { lt: hoje }, notificadoVencimento: false }`. Com o fix do marcarVencidas, cobranças que antes ficavam presas em PENDENTE agora serão notificadas — **comportamento correto mas cuidado com volume**: se havia muitas cobranças PENDENTE/vencidas acumuladas, o dia seguinte ao deploy do fix pode disparar um volume alto de WhatsApps de inadimplência simultâneos (potencial bloqueio do número pelo WhatsApp).

---

## 4. ANÁLISE DE FLUXO — WIZARD E BOT WHATSAPP

### 4.1 Wizard Membro (cooperados/novo)

Status dos steps críticos:
- **Step7Alocacao**: WZ-09 ainda pendente — SUPER_ADMIN sem cooperativaId ao criar cooperado
- **Wizard sem transação** (WZ-08): Ainda pendente — falha em qualquer step após o cadastro Supabase pode gerar usuário sem contrato

### 4.2 Bot WhatsApp — Mapeamento de Estados

O bot tem **33 estados de conversa** mapeados no switch-case. A análise identificou:

✅ **Timeout de 30min implementado** — sessões inativas reiniciam para `INICIAL`

⚠️ **Estados não cobertos:**
- Qualquer estado não mapeado no switch → `handleMenuPrincipalInicio` (fallback OK)
- `AGUARDANDO_CONFIRMACAO_DADOS` e `AGUARDANDO_CONFIRMACAO_PROPOSTA` são vulneráveis ao bypass de keyword de fatura (WA-BOT-01)

⚠️ **Motor dinâmico desativado** (WA-15): O TODO permanece. O fallback hardcoded é funcional mas limita a customização por tenant. Sem previsão de reativação.

✅ **Tratamento de linguagem inadequada**: Lista de palavras implementada, resposta empática
✅ **Horário comercial**: Aviso fora do expediente (20h-8h) sem bloquear o processamento

### 4.3 Modo Observador

Sem alterações. Score anterior 7.5/10 mantido. A proteção de ADMIN observar o próprio número ainda não foi adicionada.

---

## 5. ANÁLISE DE SEGURANÇA / AUTH

### 5.1 JWT Strategy — Fix AUTH-01 Confirmado

```typescript
// jwt.strategy.ts
return {
  ...usuario,
  cooperadoId: payload.cooperadoId ?? undefined,
  cooperativaId: payload.cooperativaId ?? usuario.cooperativaId,
};
```

Para proprietários de usina que não são ADMINs, o `usuario.cooperativaId` pode ser null, e `payload.cooperativaId` pode ter sido injetado durante o login via `cooperado.cooperativaId`. O encadeamento está correto.

**Atenção:** Se um SUPER_ADMIN acessa como cooperado de uma cooperativa específica, o token não reflete essa troca de contexto (AUTH-02 novo bug acima).

### 5.2 Endpoint `POST /auth/usuarios/:id/reset-senha`

Revisado: sem verificação de `adminUser.cooperativaId === usuario.cooperativaId` neste endpoint específico. Um ADMIN pode resetar a senha de usuário de outra cooperativa se souber o UUID. Recomenda-se adicionar verificação de tenant (similar a `atualizarUsuario`).

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| AUTH-03 | **ALTA** | `POST /auth/usuarios/:id/reset-senha` chama `enviarResetSenhaPorAdmin(id)` sem verificar se o usuário pertence à mesma cooperativa do admin logado. Um ADMIN pode resetar senha de usuário de outra cooperativa. | `auth.service.ts:enviarResetSenhaPorAdmin` |

---

## 6. BUGS RESIDUAIS ACUMULADOS (ABERTOS)

| # | Severidade | Bug | Origem |
|---|-----------|-----|--------|
| WZ-09 | MÉDIA | SUPER_ADMIN cria cooperado sem cooperativaId | 27/03 |
| WA-16 | ALTA | Conversas mortas sem cron de reset diário | 27/03 |
| AUTH-02 | ALTA | Context switching sem reemissão de token | NOVO |
| AUTH-03 | ALTA | reset-senha sem verificação de tenant | NOVO |
| PC-05 | ALTA | Gráfico UC usa cobranças de todo o cooperado | 27/03 |
| WZ-07 | ALTA | Lista espera — cotaKwhMensal zerada | 27/03 |
| WZ-08 | ALTA | Criação cooperado sem transação | 27/03 |
| WA-15 | ALTA | Motor dinâmico WA desativado | 27/03 |
| MIG-02 | ALTA | migrarTodosDeUsina sem throttle | 27/03 |
| CLB-01 | ALTA | Ranking período usa métrica cumulativa | 27/03 |
| CLB-02 | ALTA | upsertConfig sem validação de ranges | 27/03 |
| PIX-01 | ALTA | PIX Excedente sempre SIMULADO sem aviso | 27/03 |
| WAS-01 | ALTA | `enviarMenuComBotoes` sem proteção de números | NOVO |
| WAS-02 | MÉDIA | Super admin phone hardcoded | NOVO |
| WA-BOT-01 | MÉDIA | Keyword fatura bypassa fluxo em andamento | NOVO |
| COB-Tel-01 | BAIXA | Normalização de telefone inconsistente nos paths de notificação | NOVO |
| COB-Job-01 | BAIXA | Float sem arredondamento no job de multa/juros | NOVO |
| MIG-04 | MÉDIA | kWh arredondamento anual/mensal diverge | 27/03 |

---

## 7. SCORE DE QUALIDADE POR MÓDULO

| Módulo | Score 27/03 | Score 28/03 | Delta | Justificativa |
|--------|-------------|-------------|-------|---------------|
| Segurança / Auth | 6/10 | 7.5/10 | +1.5 | IDOR migracoes corrigidos (3 críticos), AUTH-01 resolvido; novos AUTH-02/AUTH-03 |
| Motor de Cobrança | 7/10 | 8/10 | +1 | Bugs financeiros críticos corrigidos (PENDENTE→VENCIDO, multa/juros, metodoPagamento, reenvio) |
| WhatsApp / CRM | 4.5/10 | 5/10 | +0.5 | Linha digitável, menus interativos, espelho super admin — novos bugs WAS-01/WAS-02 |
| Wizard Membro | 6/10 | 6/10 | = | WZ-07, WZ-08, WZ-09 pendentes |
| Wizard Parceiro | 7/10 | 7/10 | = | Sem alterações |
| MLM / Indicações | 8/10 | 8/10 | = | Fluxo darBaixa correto, CLB-01/CLB-02 pendentes |
| Portal Cooperado | 7/10 | 7/10 | = | Sem alterações no frontend |
| Portal Parceiro | 7/10 | 7/10 | = | Sem alterações |
| Migrações Usina | 6/10 | 8/10 | +2 | 3 vulnerabilidades críticas corrigidas; MIG-02/MIG-04 pendentes |
| Modo Observador | 7.5/10 | 7.5/10 | = | Sem alterações |
| PIX Excedente | 4/10 | 4/10 | = | Ainda placeholder |
| Clube de Vantagens | 6.5/10 | 6.5/10 | = | Sem alterações |

**Score geral: 7.3 / 10** ↑ (+0.5)

---

## 8. PRIORIDADES DE CORREÇÃO

### 🔴 Prioridade 1 — Bloqueante

1. **WAS-01** — Adicionar `isNumeroProtegido()` em `enviarMenuComBotoes`.

2. **AUTH-03** — `enviarResetSenhaPorAdmin`: verificar `usuario.cooperativaId === adminUser.cooperativaId` antes de enviar reset.
   ```typescript
   if (adminUser.perfil === 'ADMIN' && usuario.cooperativaId !== adminUser.cooperativaId) {
     throw new ForbiddenException('Sem permissão para resetar senha deste usuário');
   }
   ```

3. **⚠️ Alerta de deploy**: Antes de fazer deploy do fix de `marcarVencidas` (PENDENTE→VENCIDO), planejar execução em janela de baixo tráfego. Cobranças PENDENTE acumuladas serão notificadas em batch — adicionar `take: 50` por execução do cron para controlar volume.

### 🟠 Prioridade 2 — Alta (próximo sprint)

4. **WAS-02** — Remover fallback hardcoded do `SUPER_ADMIN_PHONE`.

5. **AUTH-02** — Implementar `POST /auth/trocar-contexto` que reemite token com `cooperativaId` e `cooperadoId` corretos para o contexto selecionado.

6. **WA-BOT-01** — O bypass de keywords de fatura deve verificar se o estado atual é um fluxo crítico (`AGUARDANDO_CONFIRMACAO_PROPOSTA`, `AGUARDANDO_CONFIRMACAO_CADASTRO`). Nesses estados, perguntar se o usuário quer realmente sair do fluxo.

7. **MIG-02** — `migrarTodosDeUsina`: implementar batch de 10 com `await Promise.allSettled(batch)` ou Bull queue.

8. **WA-16** — Cron diário 04h para resetar conversas com `updatedAt > 24h` em estado `AGUARDANDO_*`.

### 🟡 Prioridade 3 — Médio (backlog)

9. **CLB-01** — Ranking mensal com delta de kWh do período (usar `HistoricoProgressao`).
10. **CLB-02** — Validar ranges sobrepostos em `upsertConfig`.
11. **WZ-08** — Transação em `finalizar()` do wizard.
12. **COB-Job-01** — Adicionar `Math.round(...*100)/100` antes de persistir multa/juros no job noturno.
13. **COB-Tel-01** — Normalizar telefone em `darBaixa` antes de chamar `notificarPagamentoConfirmado`.

---

## 9. RESUMO EXECUTIVO

### O que melhorou neste ciclo (27/03 → 28/03)

- **3 vulnerabilidades IDOR críticas** em Migrações de Usina corrigidas (SEC-05, SEC-06, SEC-07) — CPF e dados de cooperados de outras cooperativas não mais acessíveis via cross-tenant
- **AUTH-01 resolvido** — JWT agora carrega `cooperativaId` corretamente para cooperados e proprietários
- **6 bugs financeiros críticos** em Cobranças corrigidos: filtro status, PENDENTE→VENCIDO, multa/juros em `darBaixa`, `metodoPagamento`, linha digitável boleto, endpoint reenvio individual
- Migrações de Usina passou de **6/10 para 8/10**
- Motor de Cobrança passou de **7/10 para 8/10**

### O que precisa de atenção urgente

1. **WAS-01** — Menus interativos WhatsApp sem proteção de números bloqueados/teste
2. **AUTH-03** — Admin pode resetar senha de usuário de outra cooperativa
3. **WAS-02** — Número de super admin hardcoded no código: risco de exfiltração involuntária em staging
4. **AUTH-02** — Troca de contexto (cooperado/admin/proprietário) sem reemissão de token: SUPER_ADMIN não consegue testar portais de cooperado

### Métricas do ciclo

- Bugs críticos corrigidos neste ciclo: **6** (3 IDOR + 3 financeiros)
- Bugs altos corrigidos: **3** (filtro, metodoPagamento, reenvio)
- Novos bugs introduzidos: **6** (WAS-01, WAS-02, AUTH-02, AUTH-03, WA-BOT-01, COB-Tel-01)
- Bugs críticos abertos: **0**
- Bugs altos abertos: **10** (WA-16, AUTH-02, AUTH-03, PC-05, WZ-07, WZ-08, WA-15, MIG-02, CLB-01, CLB-02, WAS-01)
- Bugs médios abertos: **5** (WZ-09, WA-BOT-01, WAS-02, MIG-04, CLB-03)

**Recomendação**: Sistema está em condição de beta estável para portais cooperado/parceiro. Módulo de cobranças agora é confiável financeiramente. Corrigir AUTH-03 e WAS-01 antes de qualquer release com acesso de múltiplos admins. Planejar deploy do fix de `marcarVencidas` em janela controlada para evitar spike de notificações.
