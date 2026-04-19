# SPEC — CooperToken & Clube de Vantagens
**Versão:** 1.0  
**Data:** 2026-03-31  
**Autor:** Assis (IA assistente CoopereBR)  
**Status:** Rascunho para revisão

---

## 1. Visão Geral

O CooperToken é uma camada econômica interna da CoopereBR que transforma excedente de geração de energia — hoje desperdiçado ao expirar após 60 meses no SCEE — em valor circulante dentro do ecossistema cooperativo.

**Premissa fundamental:** não altera o SCEE nem a relação com a distribuidora (EDP-ES). É 100% intracooperativo, regulatoriamente mais simples, e se apoia na infraestrutura já existente de Planos, Cobranças e Clube de Vantagens.

---

## 2. Conceitos

### 2.1 CooperToken (CT)

Unidade de valor interno da CoopereBR.

| Atributo | Valor padrão | Configurável por Plano |
|---|---|---|
| Equivalência | 1 CT = 1 kWh excedente cedido | Sim (`tokenPorKwhExcedente`) |
| Valor em reais | R$ 0,45 / CT | Sim (`valorTokenReais`) |
| Expiração | 12 meses após emissão | Sim (`tokenExpiracaoMeses`) |
| Natureza jurídica | Crédito interno de fidelidade (não é moeda, não é valor mobiliário) | — |

### 2.2 Tipos de Token

| Tipo | Origem | Uso |
|---|---|---|
| `GERACAO_EXCEDENTE` | kWh gerado acima do contrato, antes de expirar no SCEE | Desconto na mensalidade CoopereBR |
| `FLEX` *(Fase 2)* | Deslocamento de consumo do horário de ponta | Clube de Vantagens (parceiros) |
| `SOCIAL` *(Fase 3)* | Doação voluntária de superavitário | Abatimento para cooperados de baixa geração |

### 2.3 Fluxo macro

```
[Usina gera energia]
       │
       ▼
[Motor de Fatura processa kWh gerado vs. contrato]
       │
       ├─ kWh ≤ contrato → sem token
       │
       └─ kWh > contrato (excedente)
              │
              ▼
       [CooperTokenJob credita tokens ao cooperado]
              │
              ▼
       [Saldo fica no CooperTokenLedger]
              │
       ┌──────┴──────────────────┐
       ▼                         ▼
[Resgate automático          [Resgate manual]
 no próximo ciclo de          no Clube de
 cobrança]                    Vantagens]
```

---

## 3. Arquitetura de Dados

### 3.1 Alterações no model `Plano`

```prisma
model Plano {
  // ── campos existentes (sem alteração) ──
  id                  String         @id @default(cuid())
  nome                String
  descricao           String?
  modeloCobranca      ModeloCobranca
  descontoBase        Decimal        @db.Decimal(5, 2)
  temPromocao         Boolean        @default(false)
  descontoPromocional Decimal?       @db.Decimal(5, 2)
  mesesPromocao       Int?
  publico             Boolean        @default(true)
  ativo               Boolean        @default(true)
  tipoCampanha        TipoCampanha   @default(PADRAO)
  dataInicioVigencia  DateTime?
  dataFimVigencia     DateTime?
  cooperativaId       String?
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt
  contratos           Contrato[]
  propostas           PropostaCooperado[]

  // ── NOVO: configuração CooperToken ──
  cooperTokenAtivo          Boolean   @default(false)
  tokenPorKwhExcedente      Decimal?  @db.Decimal(5, 4)  // tokens/kWh (default: 1.0)
  valorTokenReais           Decimal?  @db.Decimal(10, 2) // R$/token para desconto (default: 0.45)
  tokenExpiracaoMeses       Int?      // meses até expirar (default: 12)
  tokenDescontoMaxPerc      Decimal?  @db.Decimal(5, 2)  // % máximo de desconto via token na cobrança (default: 30%)
  tokenSocialAtivo          Boolean   @default(false)    // Fase 3: permite doação
  tokenFlexAtivo            Boolean   @default(false)    // Fase 2: demand response

  @@map("planos")
}
```

### 3.2 Novo model `CooperTokenLedger`

Livro-razão de todas as movimentações de tokens por cooperado.

```prisma
model CooperTokenLedger {
  id              String              @id @default(cuid())
  cooperadoId     String
  cooperado       Cooperado           @relation(fields: [cooperadoId], references: [id])
  cooperativaId   String
  cooperativa     Cooperativa         @relation(fields: [cooperativaId], references: [id])
  tipo            CooperTokenTipo
  operacao        CooperTokenOperacao // CREDITO | DEBITO | EXPIRACAO | DOACAO
  quantidade      Decimal             @db.Decimal(10, 4)
  saldoApos       Decimal             @db.Decimal(10, 4)
  valorReais      Decimal?            @db.Decimal(10, 2) // valor econômico no momento
  referenciaId    String?             // faturaId, cobrancaId, etc.
  referenciaTabela String?            // "Fatura", "Cobranca", etc.
  expiracaoEm     DateTime?           // quando expira (para CREDITOs)
  descricao       String?
  createdAt       DateTime            @default(now())

  @@index([cooperadoId, createdAt])
  @@index([cooperativaId])
  @@index([expiracaoEm])
  @@map("cooper_token_ledger")
}

model CooperTokenSaldo {
  id              String    @id @default(cuid())
  cooperadoId     String    @unique
  cooperado       Cooperado @relation(fields: [cooperadoId], references: [id])
  cooperativaId   String
  saldoDisponivel Decimal   @db.Decimal(10, 4) @default(0)
  saldoPendente   Decimal   @db.Decimal(10, 4) @default(0) // tokens gerados mas ainda não confirmados
  totalEmitido    Decimal   @db.Decimal(10, 4) @default(0)
  totalResgatado  Decimal   @db.Decimal(10, 4) @default(0)
  totalExpirado   Decimal   @db.Decimal(10, 4) @default(0)
  updatedAt       DateTime  @updatedAt

  @@map("cooper_token_saldo")
}

enum CooperTokenTipo {
  GERACAO_EXCEDENTE
  FLEX
  SOCIAL
  BONUS_INDICACAO   // futuro: token por indicação de novo cooperado
}

enum CooperTokenOperacao {
  CREDITO
  DEBITO
  EXPIRACAO
  DOACAO_ENVIADA
  DOACAO_RECEBIDA
}
```

### 3.3 Alteração no model `Cobranca`

Adicionar campo para registrar desconto via token aplicado:

```prisma
model Cobranca {
  // ... campos existentes ...
  
  // NOVO
  tokenDescontoQt    Decimal?  @db.Decimal(10, 4) // quantidade de tokens usados
  tokenDescontoReais Decimal?  @db.Decimal(10, 2) // valor do desconto em R$
  ledgerDebitoId     String?   // referência ao CooperTokenLedger de débito
}
```

### 3.4 Vinculação com PlanoSaas (SaaS layer)

```prisma
model PlanoSaas {
  // ... campos existentes ...
  
  // NOVO: taxas sobre movimentação de tokens
  taxaTokenPerc      Decimal  @default(0) @db.Decimal(5, 2) // % cobrado sobre volume de tokens movimentados/mês
  limiteTokenMensal  Int?     // max tokens que a cooperativa pode emitir/mês (null = ilimitado)
  cooperTokenHabilitado Boolean @default(false)
}

model FaturaSaas {
  // ... campos existentes ...
  
  // NOVO
  volumeTokensMes    Decimal? @db.Decimal(12, 4) // total de tokens movimentados no mês
  receitaTokens      Decimal? @db.Decimal(10, 2) // receita da CoopereBR sobre tokens
}
```

---

## 4. Serviços e Jobs

### 4.1 `CooperTokenService`

Novo serviço (`backend/src/cooper-token/cooper-token.service.ts`).

**Responsabilidades:**
- Creditar tokens a um cooperado
- Debitar tokens (resgate)
- Consultar saldo
- Expirar tokens vencidos
- Calcular desconto aplicável numa cobrança

**Interface principal:**

```typescript
class CooperTokenService {
  // Creditar tokens após apuração de excedente
  async creditar(params: {
    cooperadoId: string;
    cooperativaId: string;
    tipo: CooperTokenTipo;
    quantidade: number;
    referenciaId?: string;      // ex: faturaId
    referenciaTabela?: string;
    expiracaoMeses?: number;
  }): Promise<CooperTokenLedger>

  // Debitar tokens (resgate em cobrança ou clube)
  async debitar(params: {
    cooperadoId: string;
    cooperativaId: string;
    quantidade: number;
    referenciaId?: string;
    descricao?: string;
  }): Promise<CooperTokenLedger>

  // Saldo disponível (FIFO: consome os que expiram primeiro)
  async getSaldo(cooperadoId: string): Promise<CooperTokenSaldo>

  // Calcular desconto máximo aplicável numa cobrança
  async calcularDesconto(params: {
    cooperadoId: string;
    valorCobranca: number;
    plano: Plano;
  }): Promise<{
    tokensNecessarios: number;
    descontoReais: number;
    saldoSuficiente: boolean;
  }>

  // Expirar tokens vencidos (chamado pelo job)
  async expirarVencidos(cooperativaId: string): Promise<number>
  
  // Doação (Fase 3)
  async doar(params: {
    cooperadoOrigemId: string;
    cooperadoDestinoId: string;
    quantidade: number;
  }): Promise<void>
}
```

### 4.2 `CooperTokenJob`

Novo job (`backend/src/cooper-token/cooper-token.job.ts`).

```typescript
@Injectable()
export class CooperTokenJob {
  // Roda após processamento de faturas (pode ser chamado pelo FaturasJob)
  // OU cron diário às 6h
  @Cron('0 6 * * *')
  async apurarExcedentes() {
    // Para cada cooperado ativo com plano cooperTokenAtivo=true:
    // 1. Buscar faturas processadas no mês anterior não apuradas (flag tokenApurado)
    // 2. Calcular excedente: kWhGerado - kWhContrato
    // 3. Se excedente > 0: creditar tokens
    // 4. Marcar fatura como tokenApurado=true
  }

  // Roda todo dia 1º às 2h — expira tokens vencidos
  @Cron('0 2 1 * *')
  async expirarTokensVencidos() {
    // Para cada CooperTokenLedger CREDITO não expirado com expiracaoEm < hoje:
    // 1. Calcular quantidade ainda disponível (emitida - usada)
    // 2. Criar lançamento EXPIRACAO no ledger
    // 3. Atualizar CooperTokenSaldo
  }
}
```

### 4.3 Alteração no `CobrancasService` — aplicar desconto token

No método que gera cobranças (antes de criar o registro Asaas):

```typescript
// Em CobrancasService.gerarCobranca() — pseudocódigo
async gerarCobranca(contratoId: string) {
  const contrato = await this.prisma.contrato.findUnique(...)
  const plano = contrato.plano
  
  let valorFinal = calcularValorBase(contrato)
  let tokenDebitoQt = 0
  let tokenDebitoReais = 0

  // ── NOVO: aplicar desconto CooperToken ──
  if (plano.cooperTokenAtivo) {
    const desconto = await this.cooperTokenService.calcularDesconto({
      cooperadoId: contrato.cooperadoId,
      valorCobranca: valorFinal,
      plano,
    })
    
    if (desconto.saldoSuficiente && desconto.descontoReais > 0) {
      // Debitar tokens (FIFO — consome os que expiram primeiro)
      await this.cooperTokenService.debitar({
        cooperadoId: contrato.cooperadoId,
        cooperativaId: contrato.cooperado.cooperativaId,
        quantidade: desconto.tokensNecessarios,
        referenciaId: cobrancaId,
        descricao: `Desconto CooperToken aplicado na cobrança`,
      })
      
      valorFinal -= desconto.descontoReais
      tokenDebitoQt = desconto.tokensNecessarios
      tokenDebitoReais = desconto.descontoReais
    }
  }

  // Criar cobrança com valorFinal já descontado
  const cobranca = await this.prisma.cobranca.create({
    data: {
      ...dadosCobranca,
      valorLiquido: valorFinal,
      tokenDescontoQt: tokenDebitoQt,
      tokenDescontoReais: tokenDebitoReais,
    }
  })
  
  // Criar cobrança no Asaas com valorFinal
  await this.asaasService.criarCobranca({ valor: valorFinal, ... })
}
```

### 4.4 Alteração no `FaturasService` — sinalizar apuração de token pendente

Ao processar uma fatura, se o plano tem `cooperTokenAtivo=true`, adicionar flag para o job apurar:

```typescript
// Adicionar ao model Fatura:
// tokenApurado Boolean @default(false)

// Em FaturasService.processarFatura():
if (plano.cooperTokenAtivo) {
  const excedente = kwhGerado - contrato.kwhContrato
  if (excedente > 0) {
    // Pode creditar direto aqui OU setar flag para o job
    await this.cooperTokenService.creditar({
      cooperadoId,
      cooperativaId,
      tipo: 'GERACAO_EXCEDENTE',
      quantidade: excedente * Number(plano.tokenPorKwhExcedente ?? 1),
      referenciaId: fatura.id,
      referenciaTabela: 'Fatura',
      expiracaoMeses: plano.tokenExpiracaoMeses ?? 12,
    })
  }
  await this.prisma.fatura.update({ where: { id: fatura.id }, data: { tokenApurado: true } })
}
```

---

## 5. Integração com Clube de Vantagens

### 5.1 Novo tipo de benefício no Clube: `TOKEN_DESCONTO`

O Clube já tem a infraestrutura de saldo e resgate. Adicionar:

```prisma
// Novo enum ou campo no model de BenefícioClube
enum TipoBeneficioClube {
  DESCONTO_PARCEIRO   // existente
  CASHBACK            // existente
  TOKEN_DESCONTO      // NOVO: resgate de CooperToken por benefício externo
  TOKEN_SOCIAL        // Fase 3: pool social
}
```

### 5.2 Fluxo de resgate no Clube

```
Cooperado acessa Clube de Vantagens
       │
       ▼
[Vê saldo de CooperTokens no header do Clube]
       │
       ▼
[Escolhe benefício com custo em tokens]
       │
       ├─ Tipo DESCONTO_PARCEIRO: tokens → voucher de desconto no parceiro
       │
       └─ Tipo TOKEN_DESCONTO: tokens → abatimento direto na próxima cobrança
              │
              ▼
       [CooperTokenService.debitar()]
              │
              ▼
       [Atualiza CooperTokenSaldo]
              │
              ▼
       [Gera evento para CobrancasService usar no próximo ciclo]
```

### 5.3 API endpoints novos

```
GET  /cooper-token/saldo                    → saldo do cooperado autenticado
GET  /cooper-token/extrato                  → histórico do ledger (paginado)
POST /cooper-token/resgatar                 → resgate manual para próxima cobrança
GET  /cooper-token/admin/consolidado        → visão admin por cooperativa
POST /cooper-token/admin/creditar-manual    → crédito manual (correções)
GET  /cooper-token/admin/expirando          → tokens a expirar nos próximos 30 dias
```

---

## 6. Vinculação Inteligente com PlanoSaas

### 6.1 Modelo de monetização

A CoopereBR (como plataforma SaaS B2B) pode cobrar das cooperativas pelo volume de tokens movimentados:

```
PlanoSaas Starter:
  cooperTokenHabilitado: false (não inclui o módulo)

PlanoSaas Growth:
  cooperTokenHabilitado: true
  taxaTokenPerc: 2.0%        // 2% do volume financeiro dos tokens/mês
  limiteTokenMensal: null    // ilimitado

PlanoSaas Enterprise:
  cooperTokenHabilitado: true
  taxaTokenPerc: 1.0%        // desconto por volume
  limiteTokenMensal: null
  tokenFlexAtivo: true       // demand response habilitado
  tokenSocialAtivo: true     // pool social habilitado
```

### 6.2 Cálculo da FaturaSaas

```typescript
// Em FaturaSaasJob (mensal):
const volumeTokens = await this.prisma.cooperTokenLedger.aggregate({
  where: {
    cooperativaId,
    operacao: 'DEBITO',
    createdAt: { gte: inicioMes, lte: fimMes },
  },
  _sum: { valorReais: true },
})

const receitaTokens = Number(volumeTokens._sum.valorReais ?? 0) 
                      * (Number(planoSaas.taxaTokenPerc) / 100)

// Adicionar à FaturaSaas do mês
await this.prisma.faturaSaas.update({
  where: { id: faturaSaasId },
  data: {
    volumeTokensMes: volumeTokens._sum.valorReais,
    receitaTokens,
    valorTotal: { increment: receitaTokens },
  }
})
```

### 6.3 Dashboard SaaS

Métricas novas para o painel de administração da plataforma:

| Métrica | Descrição |
|---|---|
| `tokensEmitidosMes` | Total de tokens emitidos por cooperativa/mês |
| `tokensResgatatadosMes` | Total resgatados (efetivamente usados) |
| `taxaConversao` | resgatados / emitidos (%) — indica engajamento |
| `valorCirculanteTotal` | saldo total de tokens × valorTokenReais (passivo latente) |
| `receitaTokensMes` | receita gerada pela CoopereBR sobre tokens |
| `tokensExpirandos30d` | alerta para ação proativa |

---

## 7. Fase 2 — Tarifa Branca (design antecipado)

Quando a CP 46/2025 for aprovada e smart meters instalados:

### 7.1 Novo campo na Fatura: `kwhPorPeriodo`

```prisma
model Fatura {
  // ... existente ...
  
  // NOVO (Fase 2)
  kwhPonta           Decimal?  @db.Decimal(10, 2)
  kwhIntermediario   Decimal?  @db.Decimal(10, 2)
  kwhForaPonta       Decimal?  @db.Decimal(10, 2)
  tokenFlexApurado   Boolean   @default(false)
}
```

### 7.2 Token Horário

O valor do CooperToken passa a considerar o período de geração:

```typescript
const fatorToken = {
  PONTA: 1.5,           // gerou na ponta → token vale mais
  INTERMEDIARIO: 1.0,
  FORA_PONTA: 0.7,      // gerou fora de ponta → token vale menos
}

const tokensGerados = excedentePonta * fatorToken.PONTA
                    + excedenteIntermediario * fatorToken.INTERMEDIARIO
                    + excedenteForaPonta * fatorToken.FORA_PONTA
```

### 7.3 Demand Response via WhatsApp Bot

```
17:00 → Job detecta pico previsto
       │
       ▼
[Notificação WA para cooperados do plano tokenFlexAtivo]
"⚡ Pico em 30 min (17h30-20h30).
 Desloque consumo pesado e ganhe 10 CooperTokens.
 Responda SIM para confirmar."
       │
       ▼
[Cooperado responde SIM]
       │
       ▼
[Após 3h: verifica via smart meter se houve redução]
       │
       ▼
[Se confirmado: CooperTokenService.creditar(tipo: FLEX, quantidade: 10)]
```

---

## 8. Fase 3 — Pool Social (design antecipado)

### 8.1 Configuração no perfil do cooperado

```prisma
model Cooperado {
  // ... existente ...
  
  // Fase 3
  tokenDoacaoAtiva   Boolean  @default(false)
  tokenDoacaoPerc    Int?     // % do excedente que vai para pool social (default: 10%)
}
```

### 8.2 Regras do Pool Social

- Tokens doados entram num pool da cooperativa
- Distribuídos mensalmente para cooperados `DEFICITARIO` (geração < 80% do contrato)
- Prioridade: cooperados com maior déficit relativo
- Limite: máximo de 30% de desconto na mensalidade via pool social

---

## 9. Segurança e Compliance

### 9.1 Natureza jurídica

O CooperToken é classificado como **programa de fidelidade interno**, não como:
- Moeda ou criptoativo (não circula fora da cooperativa)
- Valor mobiliário (não representa participação nem direito a lucros)
- Crédito financeiro (não resgatável em dinheiro — apenas em descontos e benefícios)

**Cláusula contratual recomendada:**
> "Os CooperTokens constituem benefício interno da cooperativa, sem valor de face, não resgatáveis em moeda corrente, não transferíveis a terceiros fora do ecossistema CoopereBR, e sujeitos a expiração conforme regras do plano."

### 9.2 LGPD

- Dados de consumo horário (Fase 2) são dados pessoais sensíveis
- Requere consentimento explícito para uso no demand response
- Política de retenção: logs de tokens por 5 anos (prazo fiscal)
- Anonimização dos dados de consumo para relatórios agregados

### 9.3 Auditoria

O ledger (`CooperTokenLedger`) é append-only — nenhum registro é deletado.
Todas as operações têm `referenciaId` + `referenciaTabela` para rastreabilidade completa.

---

## ATUALIZAÇÃO — 2026-03-31: Implementação Fase 1 Concluída

### Status de implementação

✅ **Schema Prisma atualizado** — todos os campos e models da spec implementados:
- Enums `CooperTokenTipo` e `CooperTokenOperacao`
- Models `CooperTokenLedger` e `CooperTokenSaldo` com índices
- Campos em `Plano`, `Cobranca`, `PlanoSaas`, `FaturaSaas`
- Campo `tokenApurado` em `FaturaProcessada`
- Migration SQL: `prisma/migrations/add_cooper_token.sql`

✅ **CooperTokenService** (`src/cooper-token/cooper-token.service.ts`)
- `creditar()` — transacional, FIFO por expiração
- `debitar()` — valida saldo, cria ledger DEBITO
- `getSaldo()` — saldo consolidado por cooperado
- `calcularDesconto()` — calcula desconto aplicável respeitando `tokenDescontoMaxPerc`
- `expirarVencidos()` — cria lançamentos EXPIRACAO, atualiza saldo
- `getExtrato()` — histórico paginado
- `getConsolidado()` — visão admin por cooperativa

✅ **CooperTokenJob** (`src/cooper-token/cooper-token.job.ts`)
- `@Cron('0 6 * * *') apurarExcedentes()` — apura excedentes de faturas não processadas
- `@Cron('0 2 1 * *') expirarTokensVencidos()` — expira tokens de todas cooperativas

✅ **CooperTokenController** (`src/cooper-token/cooper-token.controller.ts`)
- `GET /cooper-token/saldo`
- `GET /cooper-token/extrato`
- `GET /cooper-token/admin/consolidado`
- `POST /cooper-token/admin/creditar-manual`

✅ **CooperTokenModule** registrado no AppModule

### Interações com outros módulos implementadas

**Análise de posição superavitário/deficitário** (`vw_posicao_cooperado`):
- View materializada SQL com JOIN contratos/cooperados/usinas/geracao_mensal
- Campos: `kwh_entregue`, `excedente_kwh`, `status_geracao` (SUPERAVITARIO/ADEQUADO/DEFICITARIO)
- `PosicaoCooperadoService`: `getByCooperativa()`, `getSuperavitarios()`, `getDeficitarios()`, `refreshView()`
- `PosicaoCooperadoJob`: refresh diário às 7h

**Relatórios com tenant isolation** (`RelatoriosQueryService`):
- `inadimplencia(filtros)` — `cooperativaId` obrigatório, filtros tipados
- `producaoVsCobranca(cooperativaId, competencia)` — retorna `ProducaoVsCobrancaRow[]` com status
- `geracaoPorUsina(usinaId, ano, cooperativaId)` — tenant isolation via join

### Pendências pós-implementação

1. **Integração CobrancasService** — aplicar `calcularDesconto()` antes de gerar boleto Asaas (não implementado — requer ajuste no `cobrancas.service.ts`)
2. **Integração FaturasService** — chamar `creditar()` ao processar fatura com excedente (não implementado — requer ajuste no `faturas.service.ts`)
3. **Frontend** — tela de saldo e extrato de tokens no portal do cooperado
4. **Prisma migrate deploy** — migration `add_cooper_token.sql` ainda precisa ser aplicada no banco

---

## 10. Roadmap de Implementação

### Fase 1 — Sprint estimado: 2 semanas

| Task | Arquivo(s) | Esforço |
|---|---|---|
| Migration: campos novos em `Plano` | `schema.prisma` + migration | 1h |
| Criar models `CooperTokenLedger` e `CooperTokenSaldo` | `schema.prisma` + migration | 2h |
| Criar `CooperTokenModule` + `CooperTokenService` | `src/cooper-token/` | 1 dia |
| Criar `CooperTokenJob` (apuração + expiração) | `src/cooper-token/` | 4h |
| Alterar `FaturasService` para creditar tokens | `faturas.service.ts` | 3h |
| Alterar `CobrancasService` para aplicar desconto | `cobrancas.service.ts` | 4h |
| Endpoints REST `/cooper-token/*` | `cooper-token.controller.ts` | 4h |
| Integration com Clube de Vantagens | `clube-vantagens.service.ts` | 3h |
| Campos novos em `FaturaSaas` + cálculo | `financeiro/` | 3h |
| Testes unitários | `*.spec.ts` | 1 dia |
| Frontend: saldo no portal do cooperado | `web/app/portal/` | 1 dia |
| Frontend: extrato de tokens | `web/app/portal/tokens/` | 4h |

### Fase 2 — Sprint estimado: 1 semana (após Tarifa Branca)

- Migration: campos horários na Fatura
- Token Horário com fatorização por período
- Demand response via WhatsApp Bot

### Fase 3 — Sprint estimado: 1 semana

- Pool Social: modelo de doação e distribuição

---

## 11. Exemplo de Jornada Completa (Fase 1)

```
Mês de referência: Março/2026

Cooperado A (superavitário):
  - Cota contratada: 200 kWh
  - Geração real: 280 kWh
  - Excedente: 80 kWh
  - Plano: cooperTokenAtivo=true, tokenPorKwhExcedente=1.0, valorTokenReais=0.45
  → FaturasJob credita: 80 CooperTokens
  → Saldo A: 80 CT (expiram em março/2027)

Cooperado B (deficitário):
  - Cota contratada: 200 kWh
  - Geração real: 140 kWh
  - Plano: FIXO_MENSAL, mensalidade base: R$ 90,00
  - Saldo tokens: 50 CT (recebidos no mês anterior)
  - tokenDescontoMaxPerc: 30% → máximo de desconto: R$ 27,00
  - Tokens necessários para R$ 27,00 = 27/0.45 = 60 CT
  - Saldo disponível: 50 CT → desconto máximo aplicável: 50 × 0.45 = R$ 22,50
  → CobrancasJob: valorFinal = R$ 90,00 - R$ 22,50 = R$ 67,50
  → Boleto Asaas gerado: R$ 67,50
  → Ledger: DÉBITO de 50 CT para cooperado B

Cooperativa (CoopereBR como plataforma):
  - Volume financeiro tokens no mês: R$ 22,50
  - taxaTokenPerc do PlanoSaas: 2%
  - Receita tokens: R$ 0,45
  → FaturaSaas atualizada com receitaTokens: R$ 0,45
```

---

## 12. Perguntas em Aberto

1. **Confirmação jurídica:** precisa validar com advogado da cooperativa a classificação do token como "benefício de fidelidade" antes de implementar.

2. **Potência das usinas:** confirmar com João Luiz se as 3 usinas são GD1 (<75 kW) ou GD2 (>75 kW) — impacta o cálculo do Fio B que interagirá com o excedente real calculado.

3. **Integração com medidores:** a distribuidora EDP-ES disponibiliza API de leitura de medição? Ou o dado de geração vem apenas pela fatura mensal? (Impacta Fase 2)

4. **Curtailment:** se a usina sofrer corte físico (CP 045 ANEEL), o cooperado que teve geração reduzida deve receber tokens de compensação? Definir política.

5. **PlanoSaas:** o módulo CooperToken será cobrado extra ou incluído a partir de um plano? Definir pricing antes de comunicar às cooperativas.

---

*Documento gerado por Assis — assistente IA da CoopereBR*  
*Revisão técnica pendente antes de iniciar implementação*
