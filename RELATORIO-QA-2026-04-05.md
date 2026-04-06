# Relatório QA CoopereBR — 2026-04-05
**Executado por:** Assis (QA Noturno automatizado) — 03:00 AM (America/Sao_Paulo)
**Cobertura:** Backend NestJS · Frontend Next.js · Schema Prisma · WhatsApp Service · CooperToken (módulo novo foco)

---

## 📊 RESUMO EXECUTIVO

| Categoria | Bugs Críticos | Bugs Médios | Avisos | Status |
|-----------|:---:|:---:|:---:|:---:|
| Backend (NestJS) | 3 | 3 | 4 | 🔴 |
| Frontend (Next.js) | 2 | 3 | 3 | ⚠️ |
| CooperToken (novo) | 2 | 4 | 2 | ⚠️ |
| WhatsApp Bot | 0 | 1 | 2 | 🟡 |
| Infraestrutura | 1 | 0 | 1 | ⚠️ |
| **TOTAL** | **8** | **11** | **12** | **🔴 ATENÇÃO** |

> ⚠️ **Módulo CooperToken lançado ontem (04/04). Análise aprofundada revelou bugs críticos no design do módulo.**

---

## 🔴 BUGS CRÍTICOS (P0/P1)

### BUG-INFRA-001 🔴: Backend tentando subir 2x — EADDRINUSE na porta 3000
**Arquivo:** `logs/nest-error.log` (registrado às 03:00:13 e 03:00:34 de hoje)
**Problema:** O PM2 está reiniciando o backend às 3h (horário do cron) enquanto a instância anterior ainda está viva na porta 3000. O segundo processo morre imediatamente com `Error: listen EADDRINUSE: address already in use :::3000`.
**Risco:** O processo morto pode ser o que estava processando o job das 3h (cobrancas, notificações). As cobranças noturnas **podem não ter rodado hoje**.
**Evidência:** 
```
03:00:13 - Error EADDRINUSE port 3000  (primeira tentativa, instância nova)
03:00:34 - Error EADDRINUSE port 3000  (segunda tentativa)
```
Ambas falham, mas o log de `nest-out.log` mostra rotas mapeadas às 03:00:25, sugerindo que uma instância sobreviveu — porém é a instância antiga, não a nova que conteria eventuais hotfixes.
**Ação:** 
1. `pm2 restart cooperebr-backend --update-env` para garantir apenas 1 instância
2. No `ecosystem.config.cjs`, adicionar `kill_timeout: 5000` e `wait_ready: true` para evitar conflito na reinicialização
3. Verificar se o job de cobranças das 3h rodou hoje consultando `LancamentoCaixa` gerados esta madrugada
**Severidade:** CRÍTICO (jobs noturnos potencialmente afetados)

---

### BUG-CT-001 🔴: `debitar()` usa tipo errado — TODOS os débitos ficam como `GERACAO_EXCEDENTE`
**Arquivo:** `backend/src/cooper-token/cooper-token.service.ts` (linha ~115)
**Código com bug:**
```typescript
async debitar(params: DebitarParams) {
  // ...
  const ledger = await tx.cooperTokenLedger.create({
    data: {
      // BUG: tipo hardcoded, não passado como parâmetro
      tipo: CooperTokenTipo.GERACAO_EXCEDENTE,  // ← ERRADO
      operacao: CooperTokenOperacao.DEBITO,
      // ...
```
**Problema:** O método `debitar()` não recebe o parâmetro `tipo` — ele sempre grava `GERACAO_EXCEDENTE` independente do contexto. Um débito de desconto em fatura (que deveria ser `PAGAMENTO_DESCONTO`) ou de convênio vai para o ledger como `GERACAO_EXCEDENTE`. O extrato do cooperado fica semanticamente incorreto.
**Ação:** Adicionar `tipo: CooperTokenTipo` ao `DebitarParams` interface e usar na criação do ledger.
**Severidade:** CRÍTICO (auditoria financeira comprometida, ledger incoerente)

---

### BUG-CT-002 🔴: Endpoint `POST /cooper-token/parceiro/enviar` inacessível para parceiros reais
**Arquivo:** `backend/src/cooper-token/cooper-token.controller.ts` (linha ~180) + `web/app/parceiro/enviar-tokens/page.tsx`
**Problema:** O endpoint está decorado com `@Roles(ADMIN, SUPER_ADMIN)` mas o frontend na rota `/parceiro/enviar-tokens` é acessível para usuários com papel PARCEIRO. Resultado: qualquer parceiro que tente enviar tokens recebe **403 Forbidden** silencioso — o frontend não explica o erro, apenas mostra a mensagem genérica da API.
```typescript
// Controller:
@Roles(ADMIN, SUPER_ADMIN)  // ← parceiro não incluído!
@Post('parceiro/enviar')
```
**Ação:** Adicionar `PARCEIRO` (ou o perfil equivalente no enum) ao decorator `@Roles`, OU mover o endpoint para `/cooper-token/admin/enviar` e remover a rota do menu de parceiro.
**Severidade:** CRÍTICO (funcionalidade completamente quebrada para o público-alvo)

---

### BUG-NEW-001 ⏳ (carry-over): Inconsistência no cálculo de multa/juros — **NÃO RESOLVIDO**
Ver relatório 2026-04-04. Nenhuma alteração em `cobrancas.job.ts` ou `cobrancas.service.ts` desde 03/04.

### BUG-NEW-003 ⏳ (carry-over): Race condition no `darBaixa` / evento `cobranca.primeira.paga` — **NÃO RESOLVIDO**
Ver relatório 2026-04-04.

### BUG-NEW-002 ⏳ (carry-over): `kwhContrato = 0` sem validação no motor — **NÃO RESOLVIDO**
Ver relatório 2026-04-04.

---

## 🟠 BUGS ALTOS (P1)

### BUG-CT-003: `enviarTokens()` — `totalResgatado` incrementado semanticamente errado para doações
**Arquivo:** `cooper-token.service.ts` (linha ~280)
**Problema:** Quando um parceiro envia tokens para um cooperado (operação `DOACAO_ENVIADA`), o campo `totalResgatado` do remetente é incrementado. Mas `totalResgatado` representa resgates (uso em desconto/pagamento), não doações. Isso distorce o relatório de circulação de tokens — o admin vai ver tokens "resgatados" que na verdade foram doados.
**Ação:** Adicionar campo `totalDoado: Decimal` no schema `CooperTokenSaldo` para rastrear doações separadamente. O `totalResgatado` deve ser incrementado apenas em DEBITO com operação `DEBITO` ou `PAGAMENTO_QR`.
**Severidade:** ALTO (métricas financeiras incorretas)

---

### BUG-FRONT-001: Encoding UTF-8 duplo na página `/portal/indicacoes`
**Arquivo:** `web/app/portal/indicacoes/page.tsx`
**Problema:** O arquivo tem BOM (byte order mark) e os textos em português aparecem com encoding duplo no código-fonte:
- `'IndicaÃ§Ãµes'` → deveria ser `'Indicações'`
- `'IndicaÃ§Ã£o'` → deveria ser `'Indicação'`
- `'BenefÃ­cios'` → deveria ser `'Benefícios'`
- `'OlÃ¡'` → deveria ser `'Olá'`

O arquivo está salvo em UTF-8 mas sendo interpretado como latin-1 em algum ponto, criando double-encoding. **Isso causa texto garbled visível para o usuário final**.
**Ação:** Reabrir o arquivo no editor com encoding UTF-8 explícito e corrigir todos os textos afetados. Verificar configuração do editor (.editorconfig).
**Severidade:** ALTO (UX completamente quebrada na página de indicações)

---

### BUG-FRONT-002: `/dashboard/financeiro/contas-receber` retorna 404
**Evidência:** `logs/frontend.log` linha: `GET /dashboard/financeiro/contas-receber 404 in 3.3s`
**Problema:** A página existe no filesystem (`web/app/dashboard/financeiro/contas-receber/page.tsx` — modificada em 03/04) mas está retornando 404. Possível causa: o arquivo não exporta `default` corretamente, ou há erro de compilação.
**Ação:** Verificar o arquivo `contas-receber/page.tsx` — procurar por export default ausente ou erro TypeScript que impeça compilação.
**Severidade:** ALTO (página de contas a receber inacessível)

---

## 🟡 BUGS MÉDIOS (P2)

### BUG-CT-004: QR Payment — validação cross-tenant incompleta
**Arquivo:** `cooper-token.service.ts` → `processarPagamentoQr()`
**Problema:** O código valida que `decoded.cooperativaId === recebedorCooperativaId` (correto), mas **não valida** que o `pagadorId` (extraído do JWT assinado) pertence à `decoded.cooperativaId`. Um pagador de cooperativa A poderia tecnicamente pagar um recebedor de cooperativa A usando um token gerado quando estava em cooperativa B (se existir migração de cooperado).
**Ação:** Adicionar query para confirmar que `pagadorId` está associado a `decoded.cooperativaId` antes de processar.
**Severidade:** MÉDIO (segurança cross-tenant)

### BUG-CT-005: `getSaldo()` — `valorAtualEstimado` pode divergir de `saldoDisponivel`
**Arquivo:** `cooper-token.service.ts` → `getSaldo()`
**Problema:** O cálculo de `valorAtualEstimado` usa `avgFator` baseado na média ponderada dos lotes de crédito. Um cooperado com tokens expirados hoje (fator=0) ainda vê `saldoDisponivel > 0` até o job do dia 1 rodar. O `valorAtualEstimado` seria 0 mas o saldo mostra tokens disponíveis — confuso para o cooperado.
**Ação:** Informar ao usuário que tokens próximos da expiração podem ter valor reduzido. Adicionar flag `alertaExpiracao` no retorno de `getSaldo()` se há tokens expirando nos próximos 7 dias.

### BUG-CT-006: Job `apurarExcedentes` não verifica `cooperTokenAtivo` na `ConfigCooperToken`
**Arquivo:** `cooper-token.job.ts` linha ~20
**Problema:** O filtro usa `plano: { cooperTokenAtivo: true }` que consulta o campo no modelo `Plano`, mas existe também uma `ConfigCooperToken` por cooperativa com campo `ativo`. Se o admin desabilitar CooperToken globalmente via `ConfigCooperToken.ativo = false`, os tokens continuarão sendo apurados porque o job não verifica essa configuração.
**Ação:** Adicionar join com `ConfigCooperToken` e filtrar `config.ativo = true` antes de processar excedentes.

### BUG-M-003 ⏳ (carry-over): Filtro `status: 'PENDENTE'` no job de notificação — **NÃO RESOLVIDO**
Ver relatório 2026-04-04.

### BUG-WA-004: WhatsApp — sessão conectada mas boot às 3h pode ter causado split
**Evidência:** `nest-error.log` mostra dois processos tentando subir às 3h. O WhatsApp Service (porta diferente) parece não ter sido afetado (não há erros em `wa-error.log`), mas o módulo `WhatsappBotService` dentro do NestJS pode ter sido reiniciado durante o conflito de porta.
**Ação:** Confirmar em `wa-out.log` se houve reconexão do Baileys às 3h. Mensagens recebidas nesse intervalo podem ter sido perdidas.

---

## 📋 STATUS DOS P0/P1 DO RELATÓRIO ANTERIOR (04/04/2026)

| Item | Status Ontem | Status Hoje | Observação |
|------|:---:|:---:|-----------|
| BUG-NEW-001: Dupla fórmula multa/juros | 🔴 CRÍTICO | 🔴 ABERTO | Sem mudanças em cobrancas.* desde 03/04 |
| BUG-NEW-002: kwhContrato=0 | 🔴 CRÍTICO | 🔴 ABERTO | Sem mudanças em motor-proposta.* |
| BUG-NEW-003: Race condition primeira fatura | 🔴 CRÍTICO | 🔴 ABERTO | Sem mudanças em cobrancas.service.ts |
| BUG-NEW-004: audioMessage/videoMessage WA | 🟠 ALTO | 🔴 ABERTO | Sem mudanças em whatsapp-service |
| BUG-NEW-005: Taxa emissão 2% opaca | 🟠 ALTO | ✅ RESOLVIDO | Admin UI e portal mostram 2% explicitamente |
| BUG-NEW-006: Auth sem normalização | 🟡 MÉDIO | ⏳ ABERTO | Sem mudanças em auth.service.ts |
| BUG-M-003: Filtro PENDENTE → A_VENCER | 🟡 MÉDIO | 🔴 ABERTO | Confirmado sem alteração |
| BUG-M-004: @@unique DocumentoCooperado | 🟡 MÉDIO | ⏳ ABERTO | Schema não alterado |
| MEL-001: Preferência data pagamento | ⏳ PENDENTE | ⏳ PENDENTE | Idem |
| Motor WhatsApp dinâmico | ⏳ PENDENTE | ⏳ PENDENTE | Idem |

**Resumo carry-over:** 1 resolvido ✅ | 5 críticos ainda abertos 🔴 | 4 pendentes ⏳

---

## 🪙 COOPERTOKEN — Análise do Módulo (lançado 04/04)

### O que foi implementado (positivo):
- ✅ `creditar()` com taxa de emissão 2% documentada no ledger e na UI do admin
- ✅ Expirabilidade de tokens com job mensal (`expirarTokensVencidos` às 2h do dia 1)
- ✅ QR Code com JWT de 5 minutos (seguro, expiração curta)
- ✅ Paginação correta no ledger admin e extrato do cooperado
- ✅ `enviarTokens()` sem taxa (correto para doação parceiro→cooperado)
- ✅ Admin pode emitir manualmente com confirmação e breakdown de taxa

### Problemas encontrados (além dos críticos acima):
- ⚠️ `PAGAMENTO_QR` tipo no ledger do pagador aparece como `DEBITO` com tipo `GERACAO_EXCEDENTE` (BUG-CT-001 afeta aqui também)
- ⚠️ Endpoint `GET /cooper-token/admin/consolidado` não paginado — retorna TODOS os saldos de cooperados em uma única query. Com muitos cooperados, isso pode causar timeout/OOM.
- ⚠️ `superadmin/config-defaults` PUT apenas retorna o body sem salvar (comentado no código: "Para implementação futura"). Se um super-admin usar esse endpoint esperando configurar defaults globais, nada acontece silenciosamente.

---

## 🖥️ FRONTEND — Avisos Adicionais

### FRONT-WARN-001: Next.js 16 — `middleware.ts` deprecado
**Log:** `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.`
**Arquivo:** `web/middleware.ts`
**Ação:** Renomear para `proxy.ts` conforme documentação Next.js 16.

### FRONT-WARN-002: Workspace root ambíguo (yarn.lock na raiz do usuário)
**Log:** `We detected multiple lockfiles and selected the directory of C:\Users\Luciano\yarn.lock as the root directory`
O Next.js está detectando o `yarn.lock` em `C:\Users\Luciano\` como workspace root em vez de `cooperebr/web/`. Isso pode causar problemas de importação de módulos no futuro.
**Ação:** Adicionar `turbopack.root` no `next.config.ts` apontando para `./`.

### FRONT-WARN-003: Portal Tokens — saldo exibido sem mostrar expiração próxima
A página `/portal/tokens` mostra apenas `saldoDisponivel` em CTK sem alertar sobre tokens que expiram em breve. Cooperados podem perder tokens sem saber.

---

## 🔐 SEGURANÇA — Itens Novos

### SEC-CT-001: JWT do QR Code usa `process.env.COOPERTOKEN_QR_SECRET` sem fallback
**Arquivo:** `cooper-token.service.ts` → `gerarQrPagamento()` e `processarPagamentoQr()`
**Problema:** Se `COOPERTOKEN_QR_SECRET` não estiver configurado no `.env`, o sistema lança `BadRequestException` ao tentar gerar QR. Porém, se o secret for uma string vazia `""` (configuração incorreta), o JWT será assinado com chave vazia — tecnicamente válido mas totalmente inseguro.
**Ação:** Adicionar validação: `if (!secret || secret.length < 32) throw new Error('COOPERTOKEN_QR_SECRET inválido')`.

### SEC-CT-002 (carry-over): Webhook WA com segredo na query string — **NÃO RESOLVIDO**
Ver relatório 2026-04-04.

---

## ✅ CONFIRMADOS OK HOJE

- CooperToken: lógica de expiração em lote correta e idempotente (verifica `setJaExpirados` antes de reexpirar)
- CooperToken: `processarPagamentoQr` usa `$transaction` para atomicidade
- Job `apurarExcedentes` às 6h: lógica de cálculo de excedente (`kwhGerado - cotaKwh`) correta e com `tokenApurado: true` para evitar dupla apuração
- Portal `/portal/indicacoes`: progressão de nível e barra de progresso implementadas corretamente (exceto encoding)
- Página de convite público `/convite/[codigo]`: landing page bem estruturada, calculadora de economia funcional, link compartilhar via WhatsApp correto

---

## 🗺️ PENDÊNCIAS ACUMULADAS (top 10 prioritários)

| # | Item | Prioridade | Data abertura |
|---|------|:---:|:---:|
| 1 | BUG-INFRA-001: EADDRINUSE / PM2 conflito | P0 | 05/04 |
| 2 | BUG-NEW-001: Dupla fórmula multa/juros | P0 | 04/04 |
| 3 | BUG-NEW-003: Race condition comissão MLM | P0 | 04/04 |
| 4 | BUG-CT-001: `debitar()` tipo errado | P0 | 05/04 |
| 5 | BUG-CT-002: Endpoint parceiro/enviar 403 | P0 | 05/04 |
| 6 | BUG-FRONT-001: Encoding UTF-8 indicações | P1 | 05/04 |
| 7 | BUG-FRONT-002: contas-receber 404 | P1 | 05/04 |
| 8 | BUG-NEW-002: kwhContrato=0 motor proposta | P1 | 04/04 |
| 9 | BUG-NEW-004: audioMessage WA não tratado | P1 | 04/04 |
| 10 | BUG-CT-003: totalResgatado em doações | P1 | 05/04 |

---

## 🎯 RECOMENDAÇÕES PARA PRÓXIMA SPRINT

### 🔴 Urgentes (hoje/amanhã):
1. **PM2 conflict**: `pm2 delete cooperebr-backend && pm2 start ecosystem.config.cjs` para limpar instâncias duplicadas
2. **BUG-CT-002**: Corrigir `@Roles` do endpoint parceiro/enviar — parceiros não conseguem enviar tokens
3. **BUG-FRONT-001**: Corrigir encoding UTF-8 na página de indicações — texto garbled visível para usuário
4. **BUG-FRONT-002**: Investigar `/dashboard/financeiro/contas-receber` retornando 404
5. **BUG-CT-001**: Adicionar parâmetro `tipo` ao método `debitar()` no CooperToken

### 🟠 Curto prazo (esta semana):
6. **BUG-NEW-001**: Unificar helper de cálculo multa/juros
7. **BUG-NEW-003**: Atomizar evento `cobranca.primeira.paga`
8. **CooperToken consolidado**: Paginar `GET /admin/consolidado`
9. **SEC-CT-001**: Validar comprimento do `COOPERTOKEN_QR_SECRET`
10. **FRONT-WARN-001**: Migrar `middleware.ts` → `proxy.ts`

---

*Relatório gerado automaticamente por Assis — QA Noturno — CoopereBR*
*Data: 2026-04-05 · Próxima execução: agendada automaticamente*
