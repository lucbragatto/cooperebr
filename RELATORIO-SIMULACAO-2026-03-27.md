# Relatório de Simulação QA — Fluxo de Cobranças CoopereBR

**Data:** 2026-03-27
**Ambiente:** localhost:3000 (backend NestJS)
**Executor:** Agente QA automatizado

---

## Resumo Executivo

| Categoria | Qtd |
|-----------|-----|
| Bugs encontrados | 7 |
| Cobranças testadas (darBaixa) | 5 |
| Lançamentos de caixa criados | 5/5 |
| Multa/juros aplicados corretamente | 0/5 |
| PIX copia-e-cola nas mensagens | Condicional (via Asaas) |
| Boleto linha digitável | Ausente (apenas link PDF) |

---

## PASSO 1 — Autenticação e Cobranças em Aberto

### Autenticação
- `POST /auth/login` com `{ identificador, senha }` (campo correto, NÃO `email/password`)
- Credencial `teste@cooperebr.com / Coopere@123` → ADMIN token OK
- Credencial `superadmin@cooperebr.com.br / SuperAdmin@2026` → SUPER_ADMIN token OK

### Cobranças por Status (45 total)

| Status | Quantidade |
|--------|-----------|
| PAGO | 38 |
| PENDENTE | 6 |
| VENCIDO | 1 |

### Divisão em 3 Grupos

**Grupo 1 — VENCIDO (1 cobrança):**
| Cooperado | Valor | Vencimento | Multa | Juros |
|-----------|-------|------------|-------|-------|
| Fernando Augusto Silva | R$ 1.225,44 | 10/04/2026 (FUTURO!) | null | null |

**Grupo 2 — PENDENTE vencidas (5 cobranças, vencimento 15/03/2026 — 12 dias atrás):**
| Cooperado | Valor | Vencimento |
|-----------|-------|------------|
| Luciana Meireles | R$ 164,00 | 15/03/2026 |
| Luciana Meireles (dup) | R$ 164,00 | 15/03/2026 |
| Luciana Meireles (dup) | R$ 164,00 | 15/03/2026 |
| Beatriz Santos | R$ 121,42 | 15/03/2026 |
| Maria Silva Santos | R$ 96,00 | 15/03/2026 |

**Grupo 3 — PENDENTE futuras (1 cobrança):**
| Cooperado | Valor | Vencimento |
|-----------|-------|------------|
| Roberto Fonseca Alves | R$ 627,07 | 10/04/2026 |

---

## PASSO 2 — Verificação PIX e Boleto

### PIX Copia-e-Cola (EMV/BR Code)
- **Geração:** Delegada ao Asaas via `GET /payments/{id}/pixQrCode`
- **Armazenamento:** `asaasCobranca.pixCopiaECola` (payload EMV) + `asaasCobranca.pixQrCode` (base64 imagem)
- **Inclusão na mensagem:** SIM, se existir no Asaas
  ```
  *Pague via PIX — Copia e Cola:*
  {payload EMV aqui}
  ```
- **Arquivo:** `whatsapp-cobranca.service.ts:144-146`

### Boleto Linha Digitável
- **Geração local:** NAO EXISTE
- **O que existe:** `asaasCobranca.boletoUrl` = link para PDF do boleto no Asaas
- **Linha digitável:** Embutida no PDF hospedado pelo Asaas, NÃO extraída para texto
- **Inclusão na mensagem:** Apenas link genérico `invoiceUrl`, sem linha digitável

### Conteúdo Exato da Mensagem de Cobrança (A_VENCER)
```
💚 *CoopereBR — Fatura MM/AAAA*

Olá, {PRIMEIRO_NOME}! 👋

{TEXTO_STATUS_DINAMICO}
📅 Vencimento: DD/MM/AAAA

*Pague via PIX — Copia e Cola:*
{EMV_PAYLOAD}  ← só se existir no Asaas

🔗 Ou acesse: {INVOICE_URL}  ← só se existir no Asaas

_Dúvidas? Responda esta mensagem._
```

### Conteúdo da Mensagem de Cobrança Gerada (ciclo-vida)
```
💡 Olá, {NOME_COMPLETO}! Sua fatura chegou.

📅 Referência: MM/AAAA
💰 Valor: R$ XXX,XX
📆 Vencimento: DD/MM/AAAA

Lembre-se: o valor da sua fatura CoopereBR é bem menor do que você pagaria sem a cooperativa! 😊

💳 Pague agora pelo portal:
🔗 http://localhost:3001/portal/financeiro

Dúvidas? É só chamar!
```

### Conteúdo da Mensagem de Inadimplência (abordar-inadimplentes)
```
💚 *CoopereBR — Aviso de Pendência*

Olá, {PRIMEIRO_NOME}! 👋

⚠️ Fatura em atraso ({DIAS} dias) — valor atualizado: *R$ {VALOR_ATUALIZADO}*
Multa 2%: R$ {MULTA} | Juros: R$ {JUROS}

*Pague via PIX — Copia e Cola:*
{EMV_PAYLOAD}  ← só se existir

🔗 Ou acesse: {INVOICE_URL}  ← só se existir

_Dúvidas? Responda esta mensagem._
```

---

## PASSO 3 — Reenvio de Mensagens

### Endpoint de Reenvio Individual
- **NÃO EXISTE** endpoint `POST /cobrancas/:id/reenviar`

### Alternativas disponíveis:
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `POST /whatsapp/disparar-cobrancas` | Bulk | Envia cobranças A_VENCER do mês (com `whatsappEnviadoEm = null`) |
| `POST /whatsapp/abordar-inadimplentes` | Bulk | Envia aviso para VENCIDO (com `whatsappEnviadoEm != null`) |

### Resultado dos testes:
- `disparar-cobrancas` → **0 enviados** (nenhuma A_VENCER com whatsappEnviadoEm=null)
- `abordar-inadimplentes` → **0 enviados** (nenhuma VENCIDO com whatsappEnviadoEm!=null)

---

## PASSO 4 — Simulação de Pagamentos (darBaixa)

### Endpoint: `PATCH /cobrancas/:id/dar-baixa`
**Body esperado:** `{ dataPagamento: string, valorPago: number }`
**Body NÃO aceita:** `metodoPagamento` — campo inexistente

### Resultados dos 5 darBaixa:

| # | Cooperado | Status Antes | Valor Original | Multa | Juros | Valor Pago | Status Após |
|---|-----------|-------------|----------------|-------|-------|------------|-------------|
| 1 | Fernando Augusto Silva | VENCIDO | R$ 1.225,44 | null | null | R$ 1.225,44 | PAGO |
| 2 | Luciana Meireles | PENDENTE | R$ 164,00 | null | null | R$ 164,00 | PAGO |
| 3 | Beatriz Santos | PENDENTE | R$ 121,42 | null | null | R$ 121,42 | PAGO |
| 4 | Maria Silva Santos | PENDENTE | R$ 96,00 | null | null | R$ 96,00 | PAGO |
| 5 | Roberto Fonseca Alves | PENDENTE | R$ 627,07 | null | null | R$ 627,07 | PAGO |

### Lançamentos de Caixa Criados (5/5 OK):
```
1. Recebimento mensalidade - Roberto Fonseca Alves - 03/2026 | R$ 627,07 | REALIZADO
2. Recebimento mensalidade - Maria Silva Santos - 03/2026 | R$ 96,00 | REALIZADO
3. Recebimento mensalidade - Beatriz Santos - 03/2026 | R$ 121,42 | REALIZADO
4. Recebimento mensalidade - Luciana Meireles - 03/2026 | R$ 164,00 | REALIZADO
5. Recebimento mensalidade - Fernando Augusto Silva - 03/2026 | R$ 1.225,44 | REALIZADO
```

---

## PASSO 5 — Mensagem de Confirmação/Agradecimento

### Chamada confirmada
- `darBaixa()` (linha 238 de `cobrancas.service.ts`) chama `whatsappCicloVida.notificarPagamentoConfirmado()`
- Chamada é assíncrona com `.catch(() => {})` — erros são silenciados

### Texto exato gerado (whatsapp-ciclo-vida.service.ts:119-131):
```
✅ Pagamento confirmado, {NOME_COMPLETO}!

Obrigado pelo pagamento referente a {MES/ANO}.

💰 Valor: R$ {VALOR.toFixed(2)}
🕐 Confirmado em: {DD/MM/AAAA HH:MM}

Seu histórico completo está disponível no portal:
🔗 http://localhost:3001/portal/financeiro

Até o próximo mês! 🌞
```

### Exemplo concreto (Fernando Augusto Silva):
```
✅ Pagamento confirmado, Fernando Augusto Silva!

Obrigado pelo pagamento referente a 03/2026.

💰 Valor: R$ 1225.44
🕐 Confirmado em: 27/03/2026 09:06

Seu histórico completo está disponível no portal:
🔗 http://localhost:3001/portal/financeiro

Até o próximo mês! 🌞
```

---

## PASSO 6 — Relatório de Bugs

### ❌ Bug 1 — Filtro de status ignorado no GET /cobrancas
- **Arquivo:** `backend/src/cobrancas/cobrancas.controller.ts:14-16`
- **Arquivo:** `backend/src/cobrancas/cobrancas.service.ts:36-41`
- **Descrição:** `GET /cobrancas?status=VENCIDO` retorna TODAS as 45 cobranças. O controller não passa query params para o service, e `findAll()` só filtra por `cooperativaId`.
- **Impacto:** Frontend/admin não consegue filtrar cobranças por status via API.
- **Correção:** Aceitar `@Query('status')` no controller e adicionar `where: { status }` no findAll.

### ❌ Bug 2 — Cobranças PENDENTE vencidas não recebem multa/juros no darBaixa
- **Arquivo:** `backend/src/cobrancas/cobrancas.service.ts:157`
- **Descrição:** `darBaixa()` só calcula multa/juros quando `cobranca.status === 'VENCIDO'`. Cobranças com status PENDENTE que já passaram do vencimento (ex: vencidas há 12 dias) são pagas SEM multa/juros.
- **Evidência:** Luciana, Beatriz e Maria tinham vencimento 15/03 (12 dias atrás), mas valorPago = valorLiquido sem multa.
- **Impacto:** Perda de receita. Cooperados com status PENDENTE pagam menos do que deveriam.
- **Correção:** Alterar condição para `if ((cobranca.status === 'VENCIDO' || cobranca.status === 'PENDENTE') && dataVencimento < hoje && !Number(cobranca.valorMulta))`

### ❌ Bug 3 — Cron marcarVencidas não muda PENDENTE para VENCIDO
- **Arquivo:** `backend/src/cobrancas/cobrancas.job.ts:15-31`
- **Descrição:** `marcarVencidas()` só transiciona `A_VENCER → VENCIDO`. Cobranças com status `PENDENTE` permanecem PENDENTE mesmo após vencimento.
- **Evidência:** 5 cobranças PENDENTE com vencimento 15/03 (12 dias atrás) ainda estão PENDENTE.
- **Impacto:** Cobranças PENDENTE nunca são abordadas pelo `abordar-inadimplentes` (que busca status='VENCIDO').
- **Correção:** Incluir `PENDENTE` no cron: `where: { status: { in: ['A_VENCER', 'PENDENTE'] }, dataVencimento: { lt: hoje } }`

### ❌ Bug 4 — Cobrança VENCIDO com vencimento futuro
- **Arquivo:** Dados — cobrança `cmn7rvvow0005uopwym819h53`
- **Descrição:** Fernando Augusto Silva tem status `VENCIDO` mas vencimento em 10/04/2026 (14 dias NO FUTURO). Isso indica que o status foi setado manualmente ou por outro processo incorreto.
- **Impacto:** diasAtraso calculado como negativo → multa/juros corretamente ignorados, mas status inconsistente com a realidade.

### ❌ Bug 5 — Endpoint darBaixa não aceita metodoPagamento
- **Arquivo:** `backend/src/cobrancas/cobrancas.controller.ts:60`
- **Descrição:** `darBaixa` aceita apenas `{ dataPagamento, valorPago }`. Não há campo para registrar se pagamento foi via PIX, boleto, transferência, etc.
- **Impacto:** Impossível rastrear canal de pagamento. Lançamentos de caixa não indicam forma de pagamento (exceto simulações anteriores que adicionaram manualmente na observação).
- **Correção:** Adicionar campo `metodoPagamento?: 'PIX' | 'BOLETO' | 'TRANSFERENCIA' | 'DINHEIRO'` no body e salvar no lançamento.

### ❌ Bug 6 — Boleto sem linha digitável nas mensagens WhatsApp
- **Arquivo:** `backend/src/whatsapp/whatsapp-cobranca.service.ts:148-150`
- **Descrição:** Mensagem de cobrança inclui PIX copia-e-cola (quando disponível), mas para boleto apenas mostra link genérico `invoiceUrl`. A linha digitável (código de barras numérico) NÃO é extraída nem exibida no texto da mensagem.
- **Impacto:** Cooperado que recebe boleto precisa abrir o link para copiar a linha digitável, em vez de ter direto na mensagem.
- **Correção:** Buscar linha digitável via API Asaas `GET /payments/{id}/identificationField` e incluir no texto.

### ❌ Bug 7 — Não existe endpoint de reenvio individual de cobrança
- **Arquivo:** `backend/src/cobrancas/cobrancas.controller.ts` (ausência)
- **Descrição:** Não há `POST /cobrancas/:id/reenviar` para reenviar mensagem de cobrança individual. Apenas disparo em massa via `/whatsapp/disparar-cobrancas`.
- **Impacto:** Admin não consegue reenviar notificação para um cooperado específico. O bulk só envia para cobranças com `whatsappEnviadoEm = null`.

---

## 💰 Valores Simulados

### Cenário: Luciana Meireles (R$ 164,00, vencida 15/03, paga 27/03)
| Item | Valor |
|------|-------|
| Valor original (líquido) | R$ 164,00 |
| Dias de atraso | 12 |
| Dias de carência | 3 |
| Dias efetivos | 9 |
| **Multa esperada (2%)** | **R$ 3,28** |
| **Juros esperados (0,033%/dia × 9)** | **R$ 0,49** |
| **Valor atualizado esperado** | **R$ 167,77** |
| Valor efetivamente cobrado | R$ 164,00 |
| **Diferença (perda)** | **R$ 3,77** |

### Cenário: Beatriz Santos (R$ 121,42, vencida 15/03, paga 27/03)
| Item | Valor |
|------|-------|
| Valor original (líquido) | R$ 121,42 |
| Dias de atraso | 12 |
| Dias efetivos | 9 |
| **Multa esperada (2%)** | **R$ 2,43** |
| **Juros esperados (0,033%/dia × 9)** | **R$ 0,36** |
| **Valor atualizado esperado** | **R$ 124,21** |
| Valor efetivamente cobrado | R$ 121,42 |
| **Diferença (perda)** | **R$ 2,79** |

### Cenário: Maria Silva Santos (R$ 96,00, vencida 15/03, paga 27/03)
| Item | Valor |
|------|-------|
| Valor original (líquido) | R$ 96,00 |
| Dias de atraso | 12 |
| Dias efetivos | 9 |
| **Multa esperada (2%)** | **R$ 1,92** |
| **Juros esperados (0,033%/dia × 9)** | **R$ 0,29** |
| **Valor atualizado esperado** | **R$ 98,21** |
| Valor efetivamente cobrado | R$ 96,00 |
| **Diferença (perda)** | **R$ 2,21** |

### Perda total nas 3 cobranças testadas: **R$ 8,77**

---

## 💡 Correções Necessárias (Prioridade)

### P0 — Crítico (perda financeira)
1. **Bug 2+3:** Cobranças PENDENTE vencidas precisam transicionar para VENCIDO (cron) E recalcular multa/juros no darBaixa.
   - `cobrancas.job.ts`: incluir PENDENTE no `marcarVencidas()`
   - `cobrancas.service.ts:157`: alargar condição para incluir PENDENTE vencido

### P1 — Alto (funcionalidade quebrada)
2. **Bug 1:** Adicionar filtro `status` no endpoint `GET /cobrancas`
3. **Bug 5:** Adicionar `metodoPagamento` no darBaixa e salvar no lançamento
4. **Bug 7:** Criar endpoint `POST /cobrancas/:id/reenviar` para reenvio individual

### P2 — Médio (experiência do cooperado)
5. **Bug 6:** Incluir linha digitável do boleto nas mensagens WhatsApp (via Asaas API)

### P3 — Baixo (dados inconsistentes)
6. **Bug 4:** Investigar como cobrança com vencimento futuro ficou VENCIDO

---

## 📋 Templates de Mensagem Completos

### 1. Notificação de Cobrança Gerada
```
💡 Olá, {nomeCompleto}! Sua fatura chegou.

📅 Referência: {mesRef}
💰 Valor: R$ {valor}
📆 Vencimento: {vencimento}

Lembre-se: o valor da sua fatura CoopereBR é bem menor do que você pagaria sem a cooperativa! 😊

💳 Pague agora pelo portal:
🔗 {FRONTEND_URL}/portal/financeiro

Dúvidas? É só chamar!
```

### 2. Disparo WhatsApp (com PIX)
```
💚 *CoopereBR — Fatura {MM}/{AAAA}*

Olá, {primeiroNome}! 👋

{textoStatusDinamico}
📅 Vencimento: {DD/MM/AAAA}

*Pague via PIX — Copia e Cola:*
{emvPayload}

🔗 Ou acesse: {invoiceUrl}

_Dúvidas? Responda esta mensagem._
```

### 3. Texto Status Dinâmico (configuracao-notificacao.service.ts)
| Situação | Texto |
|----------|-------|
| +5 dias | `Sua fatura vence em *{dias} dias* — R$ {valor}` |
| 2-4 dias | `⏰ Sua fatura vence em *{dias} dias*. Não deixe para a última hora! R$ {valor}` |
| Amanhã | `⚠️ Sua fatura vence *amanhã* — R$ {valor}` |
| Hoje | `🔔 Sua fatura vence *hoje*! Evite multas. R$ {valor}` |
| Carência | `Sua fatura venceu há *{dias} dias* — ainda no prazo de carência, sem multa. R$ {valor}` |
| Com multa | `⚠️ Fatura em atraso ({dias} dias) — valor atualizado: *R$ {valorAtualizado}*\nMulta 2%: R$ {multa} \| Juros: R$ {juros}` |

### 4. Confirmação de Pagamento
```
✅ Pagamento confirmado, {nomeCompleto}!

Obrigado pelo pagamento referente a {mesRef}.

💰 Valor: R$ {valor}
🕐 Confirmado em: {dataHora}

Seu histórico completo está disponível no portal:
🔗 {FRONTEND_URL}/portal/financeiro

Até o próximo mês! 🌞
```

### 5. Cobrança Vencida
```
⚠️ {nomeCompleto}, sua fatura está em aberto!

Identificamos que há {diasAtraso} dia(s) de atraso no pagamento de R$ {valor}.

Para evitar juros e manter seus benefícios ativos, regularize o quanto antes:
🔗 {FRONTEND_URL}/portal/financeiro

Se tiver alguma dificuldade, podemos conversar sobre opções! É só responder esta mensagem. 🤝
```

### 6. Abordagem Inadimplente (com PIX)
```
💚 *CoopereBR — Aviso de Pendência*

Olá, {primeiroNome}! 👋

⚠️ Fatura em atraso ({dias} dias) — valor atualizado: *R$ {valorAtualizado}*
Multa 2%: R$ {multa} | Juros: R$ {juros}

*Pague via PIX — Copia e Cola:*
{emvPayload}

🔗 Ou acesse: {invoiceUrl}

_Dúvidas? Responda esta mensagem._
```

---

## ✅ O que funcionou

1. **Autenticação** — Login funciona com credenciais corretas (campo `identificador`, não `email`)
2. **darBaixa** — Transiciona status para PAGO corretamente
3. **LancamentoCaixa** — Criado automaticamente em 5/5 baixas, com descrição, valor, competência e cooperadoId corretos
4. **Notificação WhatsApp** — `notificarPagamentoConfirmado` é chamado após darBaixa
5. **Templates dinâmicos** — ConfiguracaoNotificacaoService com fallback correto (cooperativa → global → hardcoded)
6. **PIX Copia-e-Cola** — Integração Asaas funciona: gera EMV payload e inclui na mensagem
7. **Crons configurados** — marcarVencidas (2h), calcularMultaJuros (3h), notificarVencidas (6h), enviarCobrancas (8h dia 5), abordarInadimplentes (9h)
8. **Abordagem inadimplente** — Mensagem inclui valor atualizado com multa/juros calculados
9. **buscarCobrancasPorTelefone** — Normaliza telefone, busca por múltiplas variações, retorna com Asaas data
