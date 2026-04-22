# Investigacao Sprint 8 — Relatorio de Sondagem

> Data: 2026-04-23 | Autor: Claude Code (read-only investigation)

---

## SECAO 1 — Liberacao diferida de tokens

### 1.1 CooperTokenSaldo: saldoPendente vs saldoDisponivel

**Schema** (`backend/prisma/schema.prisma:1862-1875`):
```
model CooperTokenSaldo {
  saldoDisponivel Decimal @default(0)
  saldoPendente   Decimal @default(0)   // <-- EXISTE no schema
  totalEmitido    Decimal @default(0)
  totalResgatado  Decimal @default(0)
  totalExpirado   Decimal @default(0)
}
```

**INCONSISTENCIA CRITICA:** O campo `saldoPendente` existe no schema Prisma, mas **nunca e utilizado no codigo**. O metodo `creditar()` em `cooper-token.service.ts:110` soma diretamente em `saldoDisponivel`:

```typescript
// cooper-token.service.ts:110
const novoSaldoDisponivel = Number(saldo?.saldoDisponivel ?? 0) + quantidadeLiquida;
```

O `getSaldo()` (`cooper-token.service.ts:230`) retorna `saldoPendente: 0` hardcoded quando nao ha saldo, mas quando ha saldo retorna o valor do banco (que sera sempre 0 pois ninguem escreve nele).

**Resultado:** Tokens vao direto para `saldoDisponivel` — nao ha liberacao diferida implementada.

### 1.2 Evento cobranca.primeira.paga

**Emissao** (`cobrancas.service.ts:418-424`): O evento e emitido em `darBaixa()` quando `totalPagas === 1` (primeira fatura PAGO do cooperado). O payload inclui `{ cooperadoId, cobrancaId, valorFatura }`.

**Handler** (`indicacoes.service.ts:22-29`): `@OnEvent('cobranca.primeira.paga')` chama `processarPrimeiraFaturaPaga()`.

### 1.3 processarPrimeiraFaturaPaga() — O que faz

Arquivo: `indicacoes.service.ts:252-386`

1. Busca todas `Indicacao` com `cooperadoIndicadoId` e `status: 'PENDENTE'`
2. Para cada indicacao:
   - Muda status para `'PRIMEIRA_FATURA_PAGA'` (linha 273)
   - Cria `BeneficioIndicacao` com `status: 'PENDENTE'` (linhas 286-298 e 311-325)
     - Tipo PERCENTUAL_FATURA: `valorCalc = valorFatura * percentual / 100`
     - Tipo REAIS_KWH: `valorKwh = reaisKwh * kwhCooperado`
3. Credita CooperToken BONUS_INDICACAO ao indicador (linhas 330-364):
   - Usa `configCooperToken.bonusIndicacao ?? 50` como quantidade
   - Chama `cooperTokenService.creditar()` — que vai **direto** para `saldoDisponivel`
4. Chama `conviteIndicacao.marcarConvertido()` (linhas 367-373)
5. Recalcula Clube de Vantagens (linhas 376-383)

### 1.4 BeneficioIndicacao — Ciclo de vida

Schema (`schema.prisma:1425-1442`): Tem status `PENDENTE | APLICADO | PARCIAL | CANCELADO`.

**Criacao:** Em `processarPrimeiraFaturaPaga()` com `status: 'PENDENTE'`.

**Aplicacao:** Em `aplicarBeneficiosNoFechamento()` (`indicacoes.service.ts:390-432`), que reduz `saldoRestante` e muda status para `APLICADO` ou `PARCIAL`. Este metodo e chamado durante o fechamento mensal de cobrancas.

**NAO ha conversao de BeneficioIndicacao para tokens.** Sao dois sistemas paralelos e independentes:
- BeneficioIndicacao = desconto em R$ na fatura do indicador
- CooperToken BONUS_INDICACAO = tokens creditados imediatamente ao indicador

### 1.5 marcarConvertido()

Arquivo: `convite-indicacao.service.ts:336-371`

Busca `ConviteIndicacao` pelo `indicacaoId`, muda status para `CONVERTIDO`, e envia mensagem WhatsApp ao indicador informando que o amigo pagou a primeira fatura.

### 1.6 ATIVO_RECEBENDO_CREDITOS

Arquivo: `contratos.service.ts:362-368`

Definido em `ativar()` quando admin ativa um contrato:
```typescript
await tx.cooperado.update({
  where: { id: contrato.cooperadoId },
  data: {
    status: 'ATIVO_RECEBENDO_CREDITOS',
    protocoloConcessionaria: data.protocoloConcessionaria,
    dataInicioCreditos: new Date(data.dataInicioCreditos + 'T00:00:00.000Z'),
  },
});
```

### 1.7 dataInicioCreditos

Campo do `Cooperado`. Definido em:
- `contratos.service.ts:368` — ao ativar contrato
- `cooperados.controller.ts:401` — ao atualizar cooperado manualmente

Uso: define a data oficial de inicio de creditos com a concessionaria.

### 1.8 ConfigCooperToken — campos de liberacao diferida

Schema (`schema.prisma:1935-1950`):
```
model ConfigCooperToken {
  modoGeracao       String  @default("AMBOS")
  modeloVida        String  @default("AMBOS")
  limiteTokenMensal Int?
  valorTokenReais   Decimal @default(0.45)
  descontoMaxPerc   Decimal @default(30)
  tetoCoop          Int?
  ativo             Boolean @default(true)
}
```

**NAO existe campo de liberacao diferida** (ex: `carenciaDias`, `ativacaoDiferida`, `liberacaoPendenteDias`).

O campo `bonusIndicacao` e acessado via cast `(configToken as any)?.bonusIndicacao ?? 50` em `indicacoes.service.ts:351`, mas **NAO existe no schema Prisma**. Funciona apenas se tiver sido inserido manualmente no JSON ou adicionado ao banco sem migration.

### RESUMO SECAO 1

#### A) O que EXISTE
- Campo `saldoPendente` no schema Prisma (mas sem uso)
- Evento `cobranca.primeira.paga` emitido em `darBaixa()`
- `processarPrimeiraFaturaPaga()` cria `BeneficioIndicacao` PENDENTE e credita tokens BONUS_INDICACAO
- `BeneficioIndicacao` tem ciclo PENDENTE -> PARCIAL -> APLICADO via `aplicarBeneficiosNoFechamento()`
- `marcarConvertido()` atualiza ConviteIndicacao para CONVERTIDO
- `ATIVO_RECEBENDO_CREDITOS` definido em `contratos.service.ts:ativar()`
- `dataInicioCreditos` definido ao ativar contrato

#### B) O que esta FALTANDO
1. **Logica de liberacao diferida de tokens:** `creditar()` coloca tudo direto em `saldoDisponivel`, ignorando `saldoPendente`
2. **3 condicoes de liberacao** nao implementadas — nao ha verificacao de:
   - Cooperado ATIVO_RECEBENDO_CREDITOS
   - Primeira fatura paga
   - Periodo de carencia cumprido
3. **Campo `bonusIndicacao` ausente** no schema `ConfigCooperToken` — so funciona via cast `as any`
4. **Cron ou trigger para mover PENDENTE -> DISPONIVEL** nao existe
5. **Nenhum campo de configuracao de carencia** em ConfigCooperToken

#### C) O que esta INCONSISTENTE
1. `saldoPendente` existe no schema mas e dead field — valor sempre 0
2. `bonusIndicacao` usado em runtime (`indicacoes.service.ts:351`) mas ausente do schema
3. Tokens BONUS_INDICACAO sao creditados imediatamente ao indicador na primeira fatura paga, sem nenhuma condicao de carencia — contradiz a logica desejada de liberacao diferida

---

## SECAO 2 — Infra de boleto/PIX via Asaas

### 2.1 Geracao de PDF de cobranca

Buscando por `gerarPdf`, `generatePdf`, `PDFDocument` no backend:
- `motor-proposta/pdf-generator.service.ts` — gera PDF de **proposta** (nao de cobranca)
- `faturas/faturas.service.ts` — referencia a PDF de fatura da concessionaria (OCR input), nao de cobranca
- `whatsapp-fatura.service.ts` — nao gera PDF

**NAO existe template de PDF de cobranca/boleto gerado pelo sistema.** O cooperado recebe link do Asaas (`invoiceUrl`) que abre pagina de pagamento do gateway.

### 2.2 Pipeline de notificacao ao cooperado

Quando uma `Cobranca` e criada (`cobrancas.service.ts:create()`):

1. **Gateway automatico** (linha 212-227): Se cooperativa tem `ConfigGateway` ativo e cooperado tem `FormaPagamentoCooperado`, emite cobranca no gateway (Asaas) automaticamente
2. **WhatsApp** (linha 229-243): Notifica via `whatsappCicloVida.notificarCobrancaGerada()` — mensagem simples (mes, valor, vencimento)
3. **Email** — **NAO e enviado na criacao da cobranca**. So e enviado na confirmacao de pagamento (`darBaixa()` linha 398: `emailService.enviarConfirmacaoPagamento`)

O metodo `emailService.enviarFatura()` EXISTE (`email.service.ts:83-101`) — aceita `pixCopiaECola`, `boletoUrl`, `linhaDigitavel` como extras — mas **NAO e chamado em nenhum lugar do fluxo de criacao de cobranca**.

### 2.3 WhatsApp de cobranca

Arquivo: `whatsapp-cobranca.service.ts`

- **Cron mensal** (`cronEnviarCobrancas`, linha 27): dia 5 de cada mes as 8h, envia cobranças A_VENCER. Bloqueado por `WA_COBRANCA_HABILITADO`.
- **Conteudo da mensagem** (linhas 156-174): inclui valor, vencimento, PIX copia-e-cola, linha digitavel e link de pagamento (invoiceUrl)
- **NAO envia PDF** — envia apenas texto com dados de pagamento
- **Cron inadimplentes** (`cronAbordarInadimplentes`, linha 217): diario as 9h, cobranças VENCIDO
- **Cron alerta vencimento** (`cronAlertarVencimentoProximo`, linha 441): diario as 9h30, cobranças vencendo em 3 dias

### 2.4 Webhook Asaas — processarWebhook()

Arquivo: `asaas.service.ts:342-449`

Fluxo quando pagamento confirmado (PAYMENT_RECEIVED ou PAYMENT_CONFIRMED):

1. **Validacao HMAC** (linhas 349-365): Busca configs com webhookToken, compara com timing-safe
2. **Idempotencia** (linhas 401-406): Verifica `ultimoWebhookEventId` para ignorar duplicatas
3. **Atualiza AsaasCobranca** (linhas 408-417): status, linkPagamento, boletoUrl, nossoNumero
4. **Emite evento** (linhas 419-432):
   ```typescript
   this.eventEmitter.emit('pagamento.confirmado', {
     cobrancaId: asaasCobranca.cobrancaId,
     dataPagamento, valorPago, metodoPagamento: 'ASAAS',
   });
   ```
5. **Handler** (`cobrancas.service.ts:32-44`): `@OnEvent('pagamento.confirmado')` chama `darBaixa()`

Em `darBaixa()` (`cobrancas.service.ts:290-489`):
- **SIM** — Atualiza Cobranca.status para PAGO (linha 336-343)
- **SIM** — Cria/atualiza LancamentoCaixa PREVISTO -> REALIZADO (linhas 349-387)
- **NAO** — Nao dispara ativacao de tokens diretamente. Dispara `cobranca.primeira.paga` (linha 419) que credita tokens BONUS_INDICACAO via indicacoes.service
- **SIM** — Notifica cooperado via WhatsApp e email (linhas 392-402)

### 2.5 Payment link / invoiceUrl

**SIM** — O Asaas retorna `invoiceUrl` ao criar cobranca (`asaas.service.ts:220`: `payment.invoiceUrl`). Este URL e uma pagina hospedada no Asaas onde o cooperado pode pagar via PIX, boleto ou cartao.

### 2.6 Campos AsaasCobranca

Schema (`schema.prisma:1304-1328`):
```
model AsaasCobranca {
  pixCopiaECola   String?   // Preenchido para PIX (asaas.service.ts:235)
  linkPagamento   String?   // invoiceUrl (asaas.service.ts:221)
  boletoUrl       String?   // bankSlipUrl (asaas.service.ts:222)
  linhaDigitavel  String?   // identificationField para BOLETO (asaas.service.ts:254)
  pixQrCode       String?   // encodedImage do QR Code (asaas.service.ts:234)
}
```

Todos sao preenchidos no `emitirCobranca()`:
- `linkPagamento` e `boletoUrl`: na criacao (`asaas.service.ts:221-222`)
- `pixCopiaECola` e `pixQrCode`: apos criar, via GET `/payments/{id}/pixQrCode` (linhas 229-246)
- `linhaDigitavel`: apos criar, via GET `/payments/{id}/identificationField` (linhas 249-261)

### RESUMO SECAO 2

#### A) O que EXISTE
- Gateway Asaas completo: emissao, webhook, idempotencia, HMAC
- Campos PIX/boleto no AsaasCobranca todos preenchidos
- WhatsApp com PIX copia-e-cola, link, linha digitavel
- Email de confirmacao de pagamento (enviarConfirmacaoPagamento)
- Email de envio de fatura (enviarFatura) com template pronto
- LancamentoCaixa (contas a receber) criado em create() e atualizado em darBaixa()
- invoiceUrl do Asaas que cooperado pode abrir no celular

#### B) O que esta FALTANDO
1. **PDF de cobranca/boleto** — nao existe template; depende do link Asaas (invoiceUrl)
2. **Email de fatura na criacao** — `emailService.enviarFatura()` existe mas NAO e chamado em `cobrancas.service.ts:create()`
3. **Emissao automatica no gateway na criacao** depende de `ConfigGateway` + `FormaPagamentoCooperado` — se nao configurados, cooperado nao recebe link PIX

#### C) Ordem de implementacao proposta (4-6 passos pequenos)

1. **Chamar `emailService.enviarFatura()` ao criar cobranca** — em `cobrancas.service.ts:create()`, apos emitir no gateway. Passar extras (pixCopiaECola, boletoUrl, linhaDigitavel) se disponiveis. (~10 linhas)

2. **Garantir ConfigGateway e FormaPagamentoCooperado** para todos cooperados ativos — criar migration ou seed que configura defaults. Sem isso o fluxo automatico nao funciona.

3. **Gerar PDF de cobranca simples** — criar `cobranca-pdf.service.ts` usando pdfkit ou @react-pdf/renderer. Template com: logo, dados cooperado, valor, vencimento, PIX copia-e-cola, QR code base64, linha digitavel.

4. **Anexar PDF ao email de fatura** — alterar `enviarFatura()` para aceitar attachment buffer.

5. **Enviar PDF via WhatsApp** — usar `sender.enviarDocumento()` (se suportado) no cron de cobranças.

6. **Dashboard do cooperado** — exibir invoiceUrl e pixCopiaECola no portal /portal/financeiro para pagamento self-service.

---

## SECAO 3 — Bug SUPER_ADMIN em /convites

### 3.1 Pagina frontend

Arquivo: `web/app/dashboard/convites/page.tsx`

Endpoints chamados (linhas 81-102):
1. `GET /convite-indicacao/stats` (linha 81)
2. `GET /convite-indicacao/dashboard?status=&periodo=&page=` (linha 88)
3. `GET /convite-indicacao/config-lembretes` (linha 98)
4. `PUT /convite-indicacao/config-lembretes` (linha 114)
5. `POST /convite-indicacao/:id/reenviar` (linha 122)

### 3.2 Controller backend

Arquivo: `convite-indicacao.controller.ts`

Todos os endpoints tem `@Roles(SUPER_ADMIN, ADMIN)` (linhas 13, 31, 47, 54, 61, 69, 83, 91).

**O problema esta em cada handler:** Todos fazem:
```typescript
if (!req.user?.cooperativaId) throw new UnauthorizedException();
```

- Linha 22: `listar()` — `if (!req.user?.cooperativaId) throw new UnauthorizedException();`
- Linha 39: `dashboard()` — idem
- Linha 50: `stats()` — idem
- Linha 57: `estatisticas()` — idem
- Linha 64: `getConfigLembretes()` — idem
- Linha 74: `salvarConfigLembretes()` — idem
- Linha 86: `reenviar()` — idem
- Linha 93: `cancelar()` — idem

**SUPER_ADMIN nao tem `cooperativaId` no JWT** (e multi-tenant, ve todas). Logo, `req.user.cooperativaId` e `undefined`, e **todos os endpoints lancam UnauthorizedException** para SUPER_ADMIN.

### 3.3 Causa raiz

O decorator `@Roles(SUPER_ADMIN, ADMIN)` permite SUPER_ADMIN passar pelo guard de roles, mas a logica interna do controller exige `cooperativaId` — que SUPER_ADMIN nao possui.

### 3.4 Proposta de correcao (2 linhas por endpoint)

Para cada handler, substituir o guard por logica que aceita SUPER_ADMIN sem cooperativaId, passando `undefined` ou um cooperativaId de query param:

**Opcao A — Minima (2 linhas, em cada handler):**
```typescript
// ANTES:
if (!req.user?.cooperativaId) throw new UnauthorizedException();

// DEPOIS:
const cooperativaId = req.user?.cooperativaId ?? req.query?.cooperativaId;
if (!cooperativaId && req.user?.perfil !== 'SUPER_ADMIN') throw new UnauthorizedException();
```

E no service, ja aceita `cooperativaId` como parametro — quando `undefined`, deve retornar dados de todas as cooperativas (como ja faz `cooper-token.service.ts` com `whereCoopId`).

**Opcao B — Mais segura (centralizada):**
Criar helper `resolveCooperativaId(req)` que:
1. Retorna `req.user.cooperativaId` se ADMIN
2. Retorna `req.query.cooperativaId` se SUPER_ADMIN e query param presente
3. Retorna `undefined` se SUPER_ADMIN sem query param (ver todos)
4. Lanca UnauthorizedException se nao tem cooperativaId e nao e SUPER_ADMIN

**Arquivos a alterar:**
- `backend/src/convite-indicacao/convite-indicacao.controller.ts` — 8 handlers (linhas 22, 39, 50, 57, 64, 74, 86, 93)
- `backend/src/convite-indicacao/convite-indicacao.service.ts` — metodos `getDashboard`, `getStats`, `getConfigLembretes`, etc. — ja aceitam cooperativaId como parametro, mas nao tratam `undefined` (todos filtram `where: { cooperativaId }`)

**Nota:** O service `getEstatisticas()` (linha 266) e `getDashboard()` (linha 375) fazem `where: { cooperativaId }` diretamente. Se `cooperativaId` for `undefined`, o Prisma ignora o filtro e retorna tudo — comportamento correto para SUPER_ADMIN. Entao a correcao no controller e suficiente: basta nao bloquear quando SUPER_ADMIN.
