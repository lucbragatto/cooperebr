# RELATORIO ORQUESTRADOR v2 — cooperebr

**Data:** 2026-03-20
**Autor:** Arquiteto de Sistemas (analise automatizada)
**Base:** BRIEFING-ARQUITETURA-v2.md + schema.prisma + RELATORIO-QA-FINAL.md
**Metodo:** Analise cruzada — nenhuma alteracao no codigo

---

## 1. ESTADO ATUAL DO SCHEMA

### 1.1 Ciclo de vida do Cooperado

| Item do BRIEFING | Status | Detalhe |
|---|---|---|
| Enum `CADASTRADO, EM_ANALISE, APROVADO, ATIVO` | **NAO EXISTE** | Schema atual tem `PENDENTE, ATIVO, SUSPENSO, ENCERRADO`. Faltam 3 valores novos (CADASTRADO, EM_ANALISE, APROVADO) e sobra 1 legado (PENDENTE) que precisa ser migrado |
| Status `PENDENTE` migrado para novo fluxo | **NAO EXISTE** | Dados existentes com PENDENTE precisam de migration de dados |

### 1.2 Ciclo de vida do Contrato

| Item do BRIEFING | Status | Detalhe |
|---|---|---|
| Enum `PENDENTE_ATIVACAO, ATIVO, SUSPENSO, ENCERRADO, LISTA_ESPERA` | **JA EXISTE** | Schema ja contem todos os 5 valores exatos |
| Default `PENDENTE_ATIVACAO` | **JA EXISTE** | `@default(PENDENTE_ATIVACAO)` presente no schema |
| Cascata: ativar cooperado → contratos PENDENTE_ATIVACAO → ATIVO | **PARCIAL** | Logica parcialmente implementada no service, mas sem transacao Prisma |

### 1.3 kWh do Contrato — Modelo Anual

| Item do BRIEFING | Status | Detalhe |
|---|---|---|
| `kwhContratoAnual` (Float) | **NAO EXISTE** | Schema tem `kwhContrato` (Decimal 10,5) — campo diferente com nome e tipo distintos |
| `kwhContratoMensal` (Float, calculado) | **NAO EXISTE** | Nenhum campo equivalente |
| Renovacao automatica anual | **NAO EXISTE** | Sem logica ou campo para isso |

### 1.4 percentualUsina

| Item do BRIEFING | Status | Detalhe |
|---|---|---|
| `Contrato.percentualUsina` | **JA EXISTE** | `Decimal(8,4)` presente no schema |
| Remover `Cooperado.percentualUsina` | **NAO FEITO** | Campo legado AINDA EXISTE em `Cooperado` (linha 41 do schema). BRIEFING diz que ja foi movido, mas nao foi removido da origem |
| Validacao soma <= 100% com transacao | **PARCIAL** | Validacao existe no service mas SEM `prisma.$transaction` (race condition) |

### 1.5 Regra Geografica ANEEL

| Item do BRIEFING | Status | Detalhe |
|---|---|---|
| UC tem `distribuidora` | **PARCIAL** | `Uc.distribuidora` existe como `String?` (nullable, sem FK, sem normalizacao) |
| Usina tem `distribuidora` | **NAO EXISTE** | Model `Usina` NAO tem campo distribuidora. Impossivel filtrar usinas por distribuidora da UC |
| Filtro de usinas por distribuidora da UC | **NAO EXISTE** | Sem campo na usina, nao ha como implementar |

### 1.6 ModeloCobranca (novo model)

| Item do BRIEFING | Status | Detalhe |
|---|---|---|
| `ModeloCobranca` como model completo | **NAO EXISTE** | Schema tem `ModeloCobranca` como **enum** com 3 valores (FIXO_MENSAL, CREDITOS_COMPENSADOS, CREDITOS_DINAMICO). O BRIEFING quer um **model** com 12+ campos. CONFLITO DIRETO DE NOME |
| Enums `TipoModelo`, `BaseCalculo`, `CalcDesconto` | **NAO EXISTE** | Nenhum desses enums existe |

### 1.7 ConfiguracaoCobranca

| Item do BRIEFING | Status | Detalhe |
|---|---|---|
| Model `ConfiguracaoCobranca` | **NAO EXISTE** | Nenhum equivalente no schema |
| Hierarquia de desconto (contrato → usina → cooperativa) | **NAO EXISTE** | Desconto atual vem de `ConfiguracaoMotor.descontoPadrao` (unico valor global) |

### 1.8 Campos Novos no Contrato

| Campo do BRIEFING | Status | Detalhe |
|---|---|---|
| `kwhContratoAnual` | **NAO EXISTE** | Tem `kwhContrato` mas com semantica diferente |
| `kwhContratoMensal` | **NAO EXISTE** | — |
| `percentualUsina` | **JA EXISTE** | Decimal(8,4) |
| `descontoOverride` | **NAO EXISTE** | — |
| `baseCalculoOverride` | **NAO EXISTE** | — |
| `regrasAplicadas` (Json) | **NAO EXISTE** | — |
| `propostaId` (FK) | **JA EXISTE** | FK para PropostaCooperado presente |
| `modeloCobrancaOverride` | **PARCIAL** | Existe mas como enum, nao como FK para o futuro model |

### 1.9 GeracaoMensal

| Item do BRIEFING | Status | Detalhe |
|---|---|---|
| Model `GeracaoMensal` | **NAO EXISTE** | Nenhum equivalente. Geracao real da usina nao e rastreada |

### 1.10 Campos Novos na Cobranca (CobrancaMensal)

| Campo do BRIEFING | Status | Detalhe |
|---|---|---|
| `mesReferencia` (DateTime) | **PARCIAL** | Existe como `mesReferencia Int` + `anoReferencia Int` — tipo diferente do proposto |
| `kwhEntregue` | **NAO EXISTE** | — |
| `kwhConsumido` | **NAO EXISTE** | — |
| `kwhCompensado` | **NAO EXISTE** | — |
| `kwhSaldoAnterior` | **NAO EXISTE** | — |
| `kwhSaldoFinal` | **NAO EXISTE** | — |
| `precoKwh` | **NAO EXISTE** | — |
| `baseCalculoUsada` (snapshot) | **NAO EXISTE** | — |
| `modeloUsado` (snapshot) | **NAO EXISTE** | — |

### 1.11 Resumo Quantitativo

| Status | Quantidade |
|---|---|
| JA EXISTE | 5 itens (StatusContrato completo, default PENDENTE_ATIVACAO, Contrato.percentualUsina, Contrato.propostaId, cascata parcial) |
| PARCIAL | 5 itens (Cooperado.percentualUsina nao removido, validacao sem transacao, UC.distribuidora como string, Contrato.modeloCobrancaOverride como enum, Cobranca.mesReferencia como Int) |
| NAO EXISTE | 20+ itens (novo ciclo cooperado, kWh anual, Usina.distribuidora, ModeloCobranca model, ConfiguracaoCobranca, GeracaoMensal, 9 campos da Cobranca, 3 campos do Contrato, 3 enums novos) |

---

## 2. CONFLITOS E RISCOS

### RISCO CRITICO — Conflito de nome `ModeloCobranca`

**O que acontece:** O schema atual define `ModeloCobranca` como **enum** (usado em `Plano.modeloCobranca`, `Usina.modeloCobrancaOverride`, `Contrato.modeloCobrancaOverride`). O BRIEFING quer `ModeloCobranca` como **model** (tabela). Prisma NAO permite enum e model com o mesmo nome.

**Impacto:** Migration vai falhar. Precisa renomear o enum existente (ex: `TipoModeloCobrancaLegado`) ANTES de criar o model, e atualizar todos os campos que referenciam o enum.

**Campos afetados:**
- `Plano.modeloCobranca` (enum → precisa mudar tipo ou campo)
- `Usina.modeloCobrancaOverride` (enum → precisa mudar tipo)
- `Contrato.modeloCobrancaOverride` (enum → precisa mudar tipo)

**Decisao necessaria:** O model `Plano` atual sera descontinuado em favor de `ModeloCobranca` + `ConfiguracaoCobranca`? Se sim, pode remover o enum junto com o model `Plano` na FASE 2.

### RISCO ALTO — Migration do enum StatusCooperado

**O que acontece:** Dados existentes usam `PENDENTE`. O BRIEFING quer substituir por `CADASTRADO, EM_ANALISE, APROVADO`. PostgreSQL nao permite remover valores de um enum facilmente.

**Sequencia segura:**
1. Adicionar novos valores ao enum (CADASTRADO, EM_ANALISE, APROVADO)
2. Migrar dados: `UPDATE cooperados SET status = 'CADASTRADO' WHERE status = 'PENDENTE'`
3. Remover PENDENTE do enum (requer recriacao do tipo — Prisma faz automaticamente com `db push`, mas pode falhar se houver registros remanescentes)

**Risco:** Se `db push` tentar remover PENDENTE antes de migrar os dados → falha. Se o app rodar com schema novo mas dados antigos → cooperados ficam com status invalido.

### RISCO ALTO — `Cooperado.percentualUsina` ainda existe

**O que acontece:** BRIEFING diz "remover campo legado". Se houver codigo que LEIA `Cooperado.percentualUsina` (frontend, services, relatorios), a remocao quebra em runtime.

**Verificacao necessaria:** Grep por `cooperado.percentualUsina` e `percentualUsina` nos services e frontend antes de remover.

### RISCO MEDIO — Campos obrigatorios sem valor padrao

Os novos campos do Contrato (`kwhContratoAnual`, `kwhContratoMensal`, `descontoOverride`, `baseCalculoOverride`, `regrasAplicadas`) sao todos `nullable` no BRIEFING (Float?, Json?), entao podem ser adicionados sem migrar dados existentes. **OK.**

Porem, se futuramente esses campos virarem obrigatorios, contratos existentes precisarao de dados retroativos.

### RISCO MEDIO — `Cobranca.mesReferencia` tipo divergente

**O que acontece:** Schema atual tem `mesReferencia Int` + `anoReferencia Int`. BRIEFING quer `mesReferencia DateTime`. Mudar o tipo requer:
1. Criar coluna nova `mesReferenciaDate DateTime?`
2. Migrar dados: combinar mes+ano em DateTime
3. Remover colunas antigas
4. Renomear coluna nova

**Alternativa:** Manter `mesReferencia Int` + `anoReferencia Int` (ja funciona) e NAO seguir o BRIEFING nesse ponto. Decisao pragmatica.

### RISCO MEDIO — `Usina.distribuidora` nao existe

**O que acontece:** O filtro geografico ANEEL depende de Usina ter `distribuidora`. Adicionar como String? e simples, mas usinas existentes terao valor null — admin precisa preencher antes de ativar o filtro.

### RISCO BAIXO — Campos novos na Cobranca

Todos os 9 campos novos sao nullable (Float?, String?). Podem ser adicionados sem impacto nos dados existentes. Cobrancas antigas simplesmente terao esses campos como null.

---

## 3. SEQUENCIA DE IMPLEMENTACAO SEGURA

### FASE 1A — Correcoes imediatas (sem mudanca de schema)

Podem ser feitas em PARALELO:

| # | Acao | Depende de | Migra dados? |
|---|------|------------|-------------|
| 1A.1 | JWT: lancar erro se JWT_SECRET undefined | Nada | Nao |
| 1A.2 | Register: forcar perfil=COOPERADO | Nada | Nao |
| 1A.3 | ValidationPipe global + DTOs basicos | Nada | Nao |
| 1A.4 | Envolver `aceitar()` em `prisma.$transaction` | Nada | Nao |
| 1A.5 | Race condition percentualUsina: usar `$transaction` com `SELECT FOR UPDATE` | Nada | Nao |
| 1A.6 | Delete com verificacao de dependencias (cooperado, contrato, UC, plano) | Nada | Nao |
| 1A.7 | `findOne()` retornar 404 em vez de null | Nada | Nao |

### FASE 1B — Correcoes de schema menores (baixo risco)

Sequencial, nesta ordem:

| # | Acao | Depende de | Migra dados? |
|---|------|------------|-------------|
| 1B.1 | Adicionar `Usina.distribuidora String?` | Nada | Nao (null para existentes) |
| 1B.2 | Remover `Cooperado.percentualUsina` | Grep para verificar usos residuais | Nao (campo ja movido para Contrato) |
| 1B.3 | Adicionar campos ao Contrato: `kwhContratoAnual Float?`, `kwhContratoMensal Float?`, `descontoOverride Float?`, `baseCalculoOverride String?`, `regrasAplicadas Json?` | Nada | Nao |
| 1B.4 | Rodar `prisma generate` + `prisma db push` | 1B.1-1B.3 | Sim (DDL) |

### FASE 1C — Logica de negocio

Sequencial:

| # | Acao | Depende de | Migra dados? |
|---|------|------------|-------------|
| 1C.1 | Filtro geografico: ao criar contrato, filtrar usinas por distribuidora da UC | 1B.1 (campo existe) | Nao |
| 1C.2 | Unificar geracao de numero de contrato (metodo unico + transacao) | 1A.4 | Nao |
| 1C.3 | Cascata bidirecional: reativar cooperado → reativar contratos SUSPENSO | 1A.4 | Nao |
| 1C.4 | Validar capacidade usina na criacao manual de contrato (mesma regra do motor) | 1A.5 | Nao |
| 1C.5 | Frontend: exibir cobrancas de TODOS os contratos | Nada | Nao |
| 1C.6 | Frontend: exibir mensagens de erro do backend (substituir catch generico) | Nada | Nao |

### FASE 2A — Novo ciclo do cooperado (requer migration de dados)

**ATENCAO: Fase mais delicada. Fazer com servidor parado.**

| # | Acao | Depende de | Migra dados? |
|---|------|------------|-------------|
| 2A.1 | Adicionar CADASTRADO, EM_ANALISE, APROVADO ao enum StatusCooperado | Nada | DDL |
| 2A.2 | Migrar dados: `PENDENTE → CADASTRADO` | 2A.1 | **SIM** |
| 2A.3 | Remover PENDENTE do enum (ou manter como alias temporario) | 2A.2 | DDL |
| 2A.4 | Implementar maquina de estados no service | 2A.1 | Nao |
| 2A.5 | Atualizar frontend para novo fluxo de status | 2A.4 | Nao |

### FASE 2B — Nova modelagem de cobranca (BRIEFING FASE 2)

**NAO iniciar antes da FASE 1 estar estavel e testada.**

| # | Acao | Depende de | Migra dados? |
|---|------|------------|-------------|
| 2B.1 | Renomear enum `ModeloCobranca` → `TipoModeloCobrancaLegado` | Nada | DDL |
| 2B.2 | Criar model `ModeloCobranca` + enums `TipoModelo`, `BaseCalculo`, `CalcDesconto` | 2B.1 | DDL |
| 2B.3 | Criar model `ConfiguracaoCobranca` | 2B.2 | DDL |
| 2B.4 | Criar model `GeracaoMensal` | Nada | DDL |
| 2B.5 | Adicionar campos kWh/saldo na `Cobranca` | Nada | DDL |
| 2B.6 | Migrar dados do model `Plano` → `ModeloCobranca` + `ConfiguracaoCobranca` | 2B.2, 2B.3 | **SIM** |
| 2B.7 | Implementar logica de cascata de desconto | 2B.3 | Nao |
| 2B.8 | Tela de configuracao de planos (super admin) | 2B.2, 2B.3 | Nao |

### Diagrama de dependencias

```
FASE 1A (paralelo) ──────────────────────────┐
  1A.1 JWT                                    │
  1A.2 Register                               │
  1A.3 DTOs                                   │
  1A.4 Transaction aceitar()                  │
  1A.5 Transaction percentualUsina            │
  1A.6 Delete com verificacao                 │
  1A.7 findOne 404                            │
                                              ▼
FASE 1B (sequencial) ───── prisma db push ───┐
  1B.1 Usina.distribuidora                    │
  1B.2 Remover Cooperado.percentualUsina      │
  1B.3 Novos campos Contrato                  │
                                              ▼
FASE 1C (parcialmente paralelo) ─────────────┐
  1C.1 Filtro geografico (depende 1B.1)       │
  1C.2 Numero contrato unico (depende 1A.4)  │
  1C.3 Cascata bidirecional                   │
  1C.4 Validacao capacidade usina             │
  1C.5 Frontend cobrancas                     │
  1C.6 Frontend erros                         │
                                              ▼
══════════════ MARCO: SISTEMA ESTAVEL ═══════════
                                              ▼
FASE 2A (servidor parado) ───────────────────┐
  2A.1-2A.5 Novo ciclo cooperado              │
                                              ▼
FASE 2B (nova modelagem cobranca) ───────────┘
  2B.1-2B.8 ModeloCobranca + ConfiguracaoCobranca
```

---

## 4. O QUE O CLAUDE CODE DEVE FAZER PRIMEIRO

O prompt abaixo cobre a **FASE 1A completa** (correcoes sem mudanca de schema) e a **FASE 1B** (mudancas de schema de baixo risco).

---

### PROMPT PARA CLAUDE CODE — FASE 1 (Estabilizacao)

```
Voce vai executar a FASE 1 de estabilizacao do sistema cooperebr.
Sao correcoes criticas de seguranca, integridade e schema.
NAO altere nada da FASE 2 (ModeloCobranca, ConfiguracaoCobranca, GeracaoMensal).
NAO altere o frontend nesta fase (exceto item 9).

Execute os itens na ordem abaixo. Apos cada item, confirme o que foi feito.

---

## ITEM 1 — JWT seguro (SEC-01)

Arquivos: `backend/src/auth/auth.module.ts`, `backend/src/auth/jwt.strategy.ts`

Remover TODO fallback `?? 'changeme'` ou qualquer valor default para JWT_SECRET.
Se JWT_SECRET nao estiver definido em process.env, lancar erro na inicializacao:

```typescript
// jwt.strategy.ts — no constructor
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

Fazer o mesmo no auth.module.ts onde o secret e passado para JwtModule.register().

Verificar se `backend/.env` ou `backend/.env.example` tem JWT_SECRET definido.
Se .env.example existir, garantir que contem `JWT_SECRET=` (sem valor, para forcar preenchimento).

---

## ITEM 2 — Registro publico seguro (SEC-02)

Arquivo: `backend/src/auth/auth.controller.ts`

No endpoint POST /auth/register (decorado com @Public()):
- IGNORAR qualquer `perfil` enviado no body
- Forcar `perfil = PerfilUsuario.COOPERADO` antes de salvar
- Exemplo: `const { perfil, ...rest } = body; // descarta perfil`

---

## ITEM 3 — ValidationPipe global (SEC-03)

Arquivo: `backend/src/main.ts`

Verificar se o ValidationPipe global ja esta habilitado. Se nao:

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,        // strip campos nao decorados
  forbidNonWhitelisted: true,  // rejeitar campos extras
  transform: true,        // transformar tipos automaticamente
}));
```

Instalar dependencias se necessario: `class-validator` e `class-transformer`.

Criar DTOs com class-validator para os 3 endpoints mais criticos:
1. `backend/src/cooperados/dto/create-cooperado.dto.ts`
2. `backend/src/contratos/dto/create-contrato.dto.ts`
3. `backend/src/auth/dto/register.dto.ts`

Para cada DTO:
- Decorar campos obrigatorios com @IsString(), @IsEmail(), @IsOptional(), etc.
- Campos como `id`, `createdAt`, `updatedAt` NAO devem estar no DTO (whitelist remove)
- Usar o DTO no controller: `@Body() dto: CreateCooperadoDto`

Se DTOs ja existirem em `backend/src/*/dto/`, verificar se estao com decorators e sendo usados nos controllers.

---

## ITEM 4 — Transacao no aceitar() do motor-proposta (DT-02)

Arquivo: `backend/src/motor-proposta/motor-proposta.service.ts`

Localizar o metodo `aceitar()` (ou equivalente que aceita proposta e cria contrato).
Envolver TODA a logica em `this.prisma.$transaction(async (tx) => { ... })`.
Dentro da transacao, usar `tx` em vez de `this.prisma` para todas as operacoes.

Operacoes que devem estar DENTRO da transacao:
- Atualizar status da proposta
- Criar contrato
- Atualizar percentualUsina da usina
- Criar entrada na ListaEspera (se aplicavel)
- Criar notificacao

---

## ITEM 5 — Race condition percentualUsina (INC-02 + BRIEFING 4)

Arquivo: `backend/src/contratos/contratos.service.ts`

Na criacao de contrato (create) e no aceitar() do motor-proposta:
1. Usar `prisma.$transaction` com isolation level SERIALIZABLE (ou ao menos usar `SELECT ... FOR UPDATE` via raw query)
2. Dentro da transacao: buscar SOMA de percentualUsina de todos os contratos ATIVO + PENDENTE_ATIVACAO da usina
3. Somar o percentual do novo contrato
4. Se soma > 100, rejeitar com erro descritivo
5. Se soma <= 100, criar o contrato

Verificar tambem: ao ATIVAR cooperado, o loop que atualiza percentualUsina dos contratos deve SOMAR todos os percentuais e validar contra 100% da usina — nao sobrescrever em loop.

---

## ITEM 6 — Delete com verificacao de dependencias (DT-03)

Arquivos:
- `backend/src/cooperados/cooperados.service.ts` (metodo remove/delete)
- `backend/src/contratos/contratos.service.ts` (metodo remove/delete)

Para cooperado.delete():
- Verificar se tem contratos ATIVO ou PENDENTE_ATIVACAO → rejeitar com mensagem
- Verificar se tem cobrancas PENDENTE → rejeitar com mensagem

Para contrato.delete():
- Verificar se tem cobrancas vinculadas (qualquer status) → rejeitar com mensagem
- Se ja estiver implementado (BUG-06 do commit history), apenas validar

Para UC, Plano, Usina — verificar se delete ja checa dependencias. Se nao, adicionar.

---

## ITEM 7 — findOne retornar 404 (DT-07)

Arquivos: TODOS os services que tem metodo findOne().

Verificar se o padrao e:
```typescript
async findOne(id: string) {
  const entity = await this.prisma.xxx.findUnique({ where: { id } });
  if (!entity) throw new NotFoundException(`Xxx com id ${id} nao encontrado`);
  return entity;
}
```

Se algum findOne() retornar null sem lancar excecao, corrigir.
Importar NotFoundException de @nestjs/common.

---

## ITEM 8 — Schema Prisma: adicionar campo distribuidora na Usina

Arquivo: `backend/prisma/schema.prisma`

Adicionar ao model Usina:
```prisma
distribuidora String?
```

NAO remover nenhum campo existente da Usina nesta fase.

---

## ITEM 9 — Schema Prisma: remover percentualUsina do Cooperado

Arquivo: `backend/prisma/schema.prisma`

ANTES de remover, executar busca por `cooperado.percentualUsina` e `cooperado?.percentualUsina` em TODOS os arquivos .ts e .tsx.

Se houver referencias:
- No backend: substituir pela soma de `contrato.percentualUsina` dos contratos do cooperado
- No frontend: substituir pela soma dos contratos ou remover exibicao

Apos limpar todas as referencias, remover o campo do schema:
- Remover linha: `percentualUsina   Decimal?          @db.Decimal(8, 4)`

---

## ITEM 10 — Schema Prisma: adicionar campos ao Contrato

Arquivo: `backend/prisma/schema.prisma`

Adicionar ao model Contrato (todos nullable para nao quebrar dados existentes):
```prisma
kwhContratoAnual        Decimal?  @db.Decimal(15, 2)
kwhContratoMensal       Decimal?  @db.Decimal(15, 2)
descontoOverride        Decimal?  @db.Decimal(5, 2)
baseCalculoOverride     String?
regrasAplicadas         Json?
```

NOTA: `percentualUsina` e `propostaId` JA EXISTEM no schema — nao duplicar.

---

## ITEM 11 — Prisma generate + db push

Apos itens 8-10, rodar:
```bash
cd backend
npx prisma generate
npx prisma db push
```

Se houver erro, reportar a mensagem exata.
Se Prisma pedir confirmacao de perda de dados, NAO confirmar — reportar ao usuario.

---

## ITEM 12 — Geracao de numero de contrato unica (INC-03)

Arquivos:
- `backend/src/contratos/contratos.service.ts`
- `backend/src/motor-proposta/motor-proposta.service.ts`

Existe codigo duplicado de geracao de numero `CTR-YYYY-NNNN` nos dois arquivos.

1. Criar metodo unico em `contratos.service.ts`:
```typescript
async gerarNumeroContrato(): Promise<string> {
  return this.prisma.$transaction(async (tx) => {
    const ano = new Date().getFullYear();
    const ultimo = await tx.contrato.findFirst({
      where: { numero: { startsWith: `CTR-${ano}` } },
      orderBy: { createdAt: 'desc' },
    });
    const seq = ultimo
      ? parseInt(ultimo.numero.split('-')[2]) + 1
      : 1;
    return `CTR-${ano}-${String(seq).padStart(4, '0')}`;
  });
}
```

2. No motor-proposta.service.ts, injetar ContratosService e chamar `this.contratosService.gerarNumeroContrato()` em vez de duplicar a logica.

---

## VALIDACAO FINAL

Apos todos os itens, verificar:
1. `npx prisma generate` roda sem erro
2. `npx prisma db push` roda sem erro
3. O servidor NestJS inicia sem erro (`npm run start:dev`)
4. Listar cooperados, contratos e usinas funciona (GET /cooperados, GET /contratos, GET /usinas)

Reportar qualquer erro encontrado.
```

---

## NOTAS FINAIS

### O que NAO esta neste prompt (fica para FASE 2+)

| Item | Motivo de adiar |
|---|---|
| Novo ciclo cooperado (CADASTRADO/EM_ANALISE/APROVADO) | Requer migration de dados existentes — fazer com servidor parado e backup |
| Model `ModeloCobranca` (substituir enum) | Conflito de nome com enum existente — requer planejamento de migration |
| Model `ConfiguracaoCobranca` | Depende de ModeloCobranca model |
| Model `GeracaoMensal` | Sem urgencia — nao bloqueia operacao atual |
| Campos kWh/saldo na Cobranca | Depende de GeracaoMensal para ter sentido |
| Maquina de estados completa | Complexidade alta — fazer apos estabilizacao basica |
| Ownership validation (SEC-04) | Requer mapeamento usuario→cooperado que ainda nao existe |
| Cookie httpOnly (SEC-06) | Requer mudanca no fluxo de auth backend+frontend |

### Estimativa de impacto da FASE 1

- **12 itens** de implementacao
- **3 arquivos de schema** alterados (schema.prisma: 3 mudancas)
- **~8 arquivos de service** modificados
- **0 migrations destrutivas** (todos os novos campos sao nullable)
- **0 dados perdidos** (nenhum campo obrigatorio removido sem substituicao)

---

*Relatorio gerado em 2026-03-20. Nenhuma alteracao foi realizada no codigo.*
