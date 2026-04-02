# Plano de Implementação — Módulo Convênios CoopereBR

**Data**: 2026-04-01
**Tipo**: Plano de implementação (somente leitura — nenhum arquivo do projeto será modificado)
**Base**: ANALISE-CONVENIOS-2026-04-01.md + decisões do dono do sistema

---

## DECISÕES CONSOLIDADAS (input do dono)

| # | Decisão | Valor |
|---|---------|-------|
| 1 | Desconto do convênio | **Independente** — coexiste (soma) com desconto usina/cooperativa |
| 2 | Conveniado e convênios | Pertence a **um único** convênio como conveniado (ou é membro direto) |
| 3 | Conveniado sem UC | Criar **Cooperado SEM_UC** automaticamente |
| 4 | Efeito mudança de faixa | **Configurável** — só próximas OU também pendentes (flag admin) |
| 5 | Migração | **Expandir** tabela ContratoConvenio existente |
| 6 | Faixas do conveniado | Dentro da **mesma config JSON** — `descontoMembros` + `descontoConveniado` por faixa |
| 7 | Sem administradora | **Sim** — condomínio/associação/clube pode ter convênio direto |
| 8 | Portal conveniado | **Extensão** do portal cooperado (role adicional, não módulo novo) |

---

## 1. SCHEMA PRISMA FINAL

### 1.1 Novos Enums

```prisma
enum TipoConvenio {
  CONDOMINIO
  ADMINISTRADORA
  ASSOCIACAO
  SINDICATO
  EMPRESA
  CLUBE
  OUTRO
}

enum StatusConvenio {
  ATIVO
  SUSPENSO
  ENCERRADO
}

enum StatusMembroConvenio {
  ATIVO
  SUSPENSO
  DESLIGADO
}

enum EfeitoMudancaFaixa {
  SOMENTE_PROXIMAS       // Só aplica em cobranças futuras
  INCLUIR_PENDENTES      // Recalcula cobranças PENDENTE/A_VENCER do mês
}
```

### 1.2 Modelo `ContratoConvenio` expandido (evolução in-place)

> **Estratégia**: ALTER TABLE incremental — adicionar colunas novas, renomear campos existentes via Prisma `@map`. Dados existentes preservados.

```prisma
model ContratoConvenio {
  id                    String              @id @default(cuid())
  numero                String              @unique
  cooperativaId         String?

  // ── Identificação (campos existentes renomeados) ──
  nome                  String              @map("empresaNome")     // era empresaNome
  cnpj                  String?             @map("empresaCnpj")     // era empresaCnpj (agora nullable)
  email                 String?             @map("empresaEmail")    // era empresaEmail
  telefone              String?             @map("empresaTelefone") // era empresaTelefone

  // ── NOVOS: Tipo e vínculos ──
  tipo                  TipoConvenio        @default(OUTRO)
  condominioId          String?             @unique
  condominio            Condominio?         @relation(fields: [condominioId], references: [id])
  administradoraId      String?
  administradora        Administradora?     @relation(fields: [administradoraId], references: [id])

  // ── NOVOS: Conveniado (representante) ──
  conveniadoId          String?
  conveniado            Cooperado?          @relation("ConveniadoConvenio", fields: [conveniadoId], references: [id])
  conveniadoNome        String?
  conveniadoCpf         String?
  conveniadoEmail       String?
  conveniadoTelefone    String?

  // ── NOVO: Configuração de benefício progressivo ──
  // JSON Schema:
  // {
  //   "criterio": "MEMBROS_ATIVOS",
  //   "efeitoMudancaFaixa": "SOMENTE_PROXIMAS" | "INCLUIR_PENDENTES",
  //   "maxAcumuloConveniado": 30.0,   // cap % acumulável (null = sem limite)
  //   "faixas": [
  //     {
  //       "minMembros": 1,
  //       "maxMembros": 2,
  //       "descontoMembros": 3.0,      // % desconto para membros
  //       "descontoConveniado": 1.0     // % desconto para o conveniado
  //     },
  //     { "minMembros": 3, "maxMembros": 6, "descontoMembros": 5.0, "descontoConveniado": 2.5 },
  //     { "minMembros": 7, "maxMembros": 11, "descontoMembros": 8.0, "descontoConveniado": 4.0 },
  //     { "minMembros": 12, "maxMembros": null, "descontoMembros": 12.0, "descontoConveniado": 6.0 }
  //   ]
  // }
  configBeneficio       Json                @default("{}")

  // ── NOVO: Cache da faixa atual (evita recalculo em cada cobrança) ──
  faixaAtualIndex       Int                 @default(0)
  membrosAtivosCache    Int                 @default(0)
  descontoMembrosAtual  Decimal             @default(0) @db.Decimal(5, 2)
  descontoConveniadoAtual Decimal           @default(0) @db.Decimal(5, 2)

  // ── NOVO: Indicação automática ──
  registrarComoIndicacao Boolean            @default(true)

  // ── Campos existentes mantidos ──
  tipoDesconto          String              // manter para compatibilidade (legado)
  diaEnvioRelatorio     Int                 @default(5)
  diaDesconto           Int                 @default(1)
  status                String              @default("ATIVO")

  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  // ── Relações existentes mantidas ──
  cooperados            ConvenioCooperado[] // será expandida (ver 1.3)
  lancamentos           LancamentoCaixa[]

  // ── NOVAS relações ──
  historicoFaixas       HistoricoFaixaConvenio[]

  @@index([cooperativaId])
  @@index([conveniadoId])
  @@index([condominioId])
  @@index([status])
  @@map("contratos_convenio")
}
```

### 1.3 Modelo `ConvenioCooperado` expandido (evolução in-place)

```prisma
model ConvenioCooperado {
  id              String              @id @default(cuid())
  convenioId      String
  convenio        ContratoConvenio    @relation(fields: [convenioId], references: [id])
  cooperadoId     String
  cooperado       Cooperado           @relation(fields: [cooperadoId], references: [id])

  // ── Campo existente mantido ──
  matricula       String?
  ativo           Boolean             @default(true)
  createdAt       DateTime            @default(now())

  // ── NOVOS campos ──
  dataAdesao      DateTime            @default(now())
  dataDesligamento DateTime?
  descontoOverride Decimal?           @db.Decimal(5, 2)  // Admin override individual
  faixaAtual      String?                                 // Cache: label da faixa vigente
  status          StatusMembroConvenio @default(ATIVO)

  // ── NOVO: Vínculo com indicação ──
  indicacaoId     String?             @unique
  indicacao       Indicacao?          @relation(fields: [indicacaoId], references: [id])

  @@unique([convenioId, cooperadoId])
  @@index([convenioId, ativo])
  @@index([cooperadoId])
  @@map("convenio_cooperados")
}
```

### 1.4 Novo modelo `HistoricoFaixaConvenio`

```prisma
model HistoricoFaixaConvenio {
  id                String           @id @default(cuid())
  convenioId        String
  convenio          ContratoConvenio @relation(fields: [convenioId], references: [id])

  faixaAnteriorIdx  Int
  faixaNovaIdx      Int
  membrosAtivos     Int
  descontoAnterior  Decimal          @db.Decimal(5, 2)
  descontoNovo      Decimal          @db.Decimal(5, 2)
  descontoConveniadoAnterior Decimal @db.Decimal(5, 2)
  descontoConveniadoNovo     Decimal @db.Decimal(5, 2)
  motivo            String           // NOVO_MEMBRO | MEMBRO_DESLIGADO | RECALCULO_ADMIN | RECALCULO_CRON

  createdAt         DateTime         @default(now())

  @@index([convenioId, createdAt])
  @@map("historico_faixa_convenio")
}
```

### 1.5 Alterações em modelos existentes

```prisma
// ── Cooperado: adicionar relações inversas ──
model Cooperado {
  // ... campos existentes ...
  conveniosRepresentados  ContratoConvenio[] @relation("ConveniadoConvenio")  // NOVO
  // conveniosCooperado já existe (ConvenioCooperado[])
}

// ── Condominio: adicionar relação com Convenio ──
model Condominio {
  // ... campos existentes ...
  convenio  ContratoConvenio?  // NOVO (1:1 opcional)
}

// ── Administradora: adicionar relação com Convenios ──
model Administradora {
  // ... campos existentes ...
  convenios  ContratoConvenio[]  // NOVO (1:N)
}

// ── Indicacao: adicionar relação com ConvenioCooperado ──
model Indicacao {
  // ... campos existentes ...
  membroConvenio  ConvenioCooperado?  // NOVO (1:1 opcional)
}

// ── Cooperativa: adicionar relação (se não existir) ──
model Cooperativa {
  // ... campos existentes ...
  // cooperativa já é referenciada via cooperativaId string no ContratoConvenio
  // NÃO adicionar relation explícita pois cooperativaId é String? sem FK constraint
}
```

### 1.6 Migrations necessárias (em ordem)

| # | Migration | Alterações | Risco |
|---|-----------|------------|-------|
| 1 | `add_convenio_fields` | ADD COLUMN tipo, condominioId, administradoraId, conveniadoId, conveniadoNome, conveniadoCpf, conveniadoEmail, conveniadoTelefone, configBeneficio, faixaAtualIndex, membrosAtivosCache, descontoMembrosAtual, descontoConveniadoAtual, registrarComoIndicacao TO `contratos_convenio` | BAIXO — só adiciona colunas nullable/com default |
| 2 | `add_membro_fields` | ADD COLUMN dataAdesao, dataDesligamento, descontoOverride, faixaAtual, status, indicacaoId TO `convenio_cooperados` | BAIXO — só adiciona colunas nullable/com default |
| 3 | `create_historico_faixa` | CREATE TABLE `historico_faixa_convenio` | ZERO — tabela nova |
| 4 | `add_relations` | ADD UNIQUE INDEX condominioId em contratos_convenio; ADD UNIQUE INDEX indicacaoId em convenio_cooperados | BAIXO — constraints em colunas novas vazias |
| 5 | `backfill_defaults` | UPDATE contratos_convenio SET tipo='OUTRO', configBeneficio='{}', faixaAtualIndex=0, membrosAtivosCache=(SELECT COUNT...), descontoMembrosAtual=0, descontoConveniadoAtual=0, registrarComoIndicacao=true; UPDATE convenio_cooperados SET dataAdesao=createdAt, status='ATIVO' | BAIXO — preenche colunas novas com valores sensatos |

**Total: 5 migrations incrementais, nenhuma destrutiva.**

---

## 2. PLANO DE IMPLEMENTAÇÃO POR FASE

### Fase 1: Schema + Migrations (2-3h)

**O que será feito:**
- Adicionar enums `TipoConvenio`, `StatusConvenio`, `StatusMembroConvenio`, `EfeitoMudancaFaixa`
- Expandir `ContratoConvenio` com novos campos
- Expandir `ConvenioCooperado` com novos campos
- Criar `HistoricoFaixaConvenio`
- Adicionar relações inversas em `Cooperado`, `Condominio`, `Administradora`, `Indicacao`
- Executar migrations 1-5

**Arquivos modificados:**
- `backend/prisma/schema.prisma`

**Arquivos criados:**
- `backend/prisma/migrations/YYYYMMDD_add_convenio_fields/migration.sql`
- `backend/prisma/migrations/YYYYMMDD_add_membro_fields/migration.sql`
- `backend/prisma/migrations/YYYYMMDD_create_historico_faixa/migration.sql`
- `backend/prisma/migrations/YYYYMMDD_add_relations/migration.sql`
- `backend/prisma/migrations/YYYYMMDD_backfill_defaults/migration.sql`

**Dependências:** Nenhuma
**Pré-requisito para:** Todas as outras fases

---

### Fase 2: Módulo NestJS — CRUD Convênio (3-4h)

**O que será feito:**
- Criar módulo `convenios/` em `backend/src/`
- Migrar lógica existente de `backend/src/financeiro/convenios.service.ts`
- CRUD completo com DTOs Zod/class-validator
- Listar com contagem de membros e faixa atual
- Busca por tipo, status, cooperativaId
- Criação vinculando condominioId/administradoraId opcionalmente
- Geração automática de número (manter padrão CV-YYYY-NNNN)

**Arquivos criados:**
- `backend/src/convenios/convenios.module.ts`
- `backend/src/convenios/convenios.controller.ts`
- `backend/src/convenios/convenios.service.ts`
- `backend/src/convenios/convenios.dto.ts`

**Arquivos modificados:**
- `backend/src/financeiro/financeiro.module.ts` — remover `ConveniosService` do módulo financeiro
- `backend/src/financeiro/financeiro.controller.ts` — remover endpoints de convênio (migram para novo controller)
- `backend/src/app.module.ts` — importar `ConveniosModule`

**Dependências:** Fase 1

---

### Fase 3: Gestão de Membros + Indicação Automática (3-4h)

**O que será feito:**
- Adicionar/remover membros do convênio
- Override de desconto individual (admin)
- Integração com `IndicacoesService.registrarIndicacao()` quando `registrarComoIndicacao=true`
- Criação automática de Cooperado SEM_UC para conveniado sem UC
- Importação em massa via CSV (parser + batch create + 1 recálculo)

**Arquivos criados:**
- `backend/src/convenios/convenios-membros.service.ts`

**Arquivos modificados:**
- `backend/src/convenios/convenios.controller.ts` — adicionar endpoints de membros
- `backend/src/convenios/convenios.dto.ts` — DTOs de membro
- `backend/src/convenios/convenios.module.ts` — importar IndicacoesModule

**Dependências:** Fase 2

---

### Fase 4: Progressão de Faixas (4-5h)

**O que será feito:**
- Serviço de cálculo de faixa baseado em `configBeneficio.faixas[]`
- Recálculo automático ao adicionar/remover membro
- Registro em `HistoricoFaixaConvenio` quando faixa muda
- Atualização do cache no `ContratoConvenio` (faixaAtualIndex, membrosAtivosCache, descontoMembrosAtual, descontoConveniadoAtual)
- Cron job diário de validação/reconciliação
- Endpoint admin para forçar recálculo

**Arquivos criados:**
- `backend/src/convenios/convenios-progressao.service.ts`
- `backend/src/convenios/convenios.job.ts`

**Arquivos modificados:**
- `backend/src/convenios/convenios.module.ts` — registrar job e progressão service
- `backend/src/convenios/convenios.controller.ts` — endpoints de progressão

**Dependências:** Fase 3

---

### Fase 5: Integração com Hierarquia de Desconto (3-4h)

**O que será feito:**
- Alterar `resolverDesconto()` em `configuracao-cobranca.service.ts` para incluir nível convênio
- Desconto do convênio é **independente** (coexiste com usina/cooperativa)
- Lógica: desconto_final = desconto_base (usina/cooperativa) + desconto_convenio (faixa ou override)
- Cap configurável via `configBeneficio.maxAcumuloConveniado`
- Desconto do conveniado (representante) resolvido separadamente
- Otimização: pre-carregar mapa de faixas no batch de cobranças
- Efeito de mudança de faixa: respeitar `efeitoMudancaFaixa` do configBeneficio

**Arquivos modificados:**
- `backend/src/configuracao-cobranca/configuracao-cobranca.service.ts` — expandir `resolverDesconto()`
- `backend/src/cobrancas/cobrancas.service.ts` — consumir desconto_convenio adicional, batch optimization

**Dependências:** Fase 4

---

### Fase 6: Portal do Conveniado (3-4h)

**O que será feito:**
- Endpoints `/convenios/meus` e `/convenios/meus/:id/dashboard` para o conveniado
- Dashboard: membros ativos, faixa atual, progresso para próxima faixa, histórico, benefício acumulado
- Listagem de membros do seu convênio
- Relatório mensal (reaproveitar lógica existente de `ConveniosService.relatorio()`)

**Arquivos criados:**
- `backend/src/convenios/convenios-portal.controller.ts` — endpoints do portal (role COOPERADO)

**Arquivos modificados:**
- `backend/src/convenios/convenios.module.ts` — registrar portal controller
- `backend/src/convenios/convenios.service.ts` — métodos `meusConvenios()`, `dashboardConveniado()`

**Dependências:** Fase 4

---

### Fase 7: Frontend Admin — Gestão de Convênios (4-5h)

**O que será feito:**
- Página de listagem `/dashboard/convenios`
- Formulário de criação `/dashboard/convenios/novo`
- Página de detalhe/edição `/dashboard/convenios/[id]`
- Gestão de membros inline (adicionar, remover, override desconto)
- Visualização de progressão (barra de faixas, histórico)
- Import CSV de membros
- Adicionar item "Convênios" na navegação do dashboard (seção Operacional)

**Arquivos criados:**
- `web/app/dashboard/convenios/page.tsx` — listagem
- `web/app/dashboard/convenios/novo/page.tsx` — formulário criação
- `web/app/dashboard/convenios/[id]/page.tsx` — detalhe/edição + membros + progressão

**Arquivos modificados:**
- `web/app/dashboard/layout.tsx` — adicionar "Convênios" à nav (após "Administradoras")

**Dependências:** Fase 2, Fase 4

---

### Fase 8: Frontend Portal — Extensão Conveniado (3-4h)

**O que será feito:**
- Página `/portal/convenio` — dashboard do conveniado
- Exibir: faixa atual, membros, progresso, benefício acumulado
- Relatório mensal visualizável
- Integração com contexto existente: se cooperado é conveniado, exibir item na nav do portal
- Indicador visual de faixa (badge, barra de progresso)

**Arquivos criados:**
- `web/app/portal/convenio/page.tsx` — dashboard conveniado

**Arquivos modificados:**
- `web/app/portal/layout.tsx` — adicionar "Meu Convênio" na nav (condicional: só se for conveniado)
- `web/hooks/useContexto.ts` — expor flag `isConveniado` no contexto (backend retorna via `/auth/me`)

**Dependências:** Fase 6, Fase 7

---

### Fase 9: Notificações + Cron (2-3h)

**O que será feito:**
- WhatsApp ao mudar de faixa (conveniado + membros)
- Email de relatório mensal automático (dia configurável)
- Cron de reconciliação diária (validar cache de faixa vs contagem real)

**Arquivos modificados:**
- `backend/src/convenios/convenios.job.ts` — adicionar crons
- `backend/src/whatsapp/whatsapp-ciclo-vida.service.ts` — templates de faixa convênio
- `backend/src/email/email-templates.ts` — template relatório convênio

**Dependências:** Fase 4, Fase 5

---

### Fase 10: Testes (3-4h)

**O que será feito:**
- Testes unitários: resolverDescontoConvenio, calcularFaixa, adicionarMembro
- Testes de integração: fluxo completo criar convênio → adicionar membro → recalcular faixa → gerar cobrança
- Testes de borda: conveniado sem UC, faixa máxima, cap de acúmulo, mudança de faixa com pendentes

**Arquivos criados:**
- `backend/src/convenios/convenios.service.spec.ts`
- `backend/src/convenios/convenios-progressao.service.spec.ts`
- `backend/src/convenios/convenios-membros.service.spec.ts`
- `backend/src/configuracao-cobranca/configuracao-cobranca.service.spec.ts` — expandir testes existentes

**Dependências:** Todas as fases anteriores

---

### Resumo de Fases

| Fase | Escopo | Estimativa | Depende de |
|------|--------|------------|------------|
| 1 | Schema + Migrations | 2-3h | — |
| 2 | CRUD Convênio (backend) | 3-4h | 1 |
| 3 | Gestão Membros + Indicação | 3-4h | 2 |
| 4 | Progressão de Faixas | 4-5h | 3 |
| 5 | Integração Desconto | 3-4h | 4 |
| 6 | Portal Conveniado (backend) | 3-4h | 4 |
| 7 | Frontend Admin | 4-5h | 2, 4 |
| 8 | Frontend Portal | 3-4h | 6, 7 |
| 9 | Notificações + Cron | 2-3h | 4, 5 |
| 10 | Testes | 3-4h | Todas |
| **TOTAL** | | **30-40h** | |

**Paralelização possível:**
- Fases 5 e 6 podem rodar em paralelo (ambas dependem de 4)
- Fases 7 e 9 podem rodar em paralelo (ambas dependem de 4)
- Fase 8 espera 6+7

---

## 3. ENDPOINTS E CONTRATOS DE API

### 3.1 CRUD Convênio

#### `POST /convenios` — Criar convênio
**Permissões:** SUPER_ADMIN, ADMIN
```typescript
// Request
{
  nome: string;                    // obrigatório, 3-200 chars
  tipo: TipoConvenio;             // obrigatório
  cnpj?: string;                  // validar formato se presente
  email?: string;                 // validar formato se presente
  telefone?: string;
  conveniadoId?: string;          // cooperado existente (ou null)
  conveniadoNome?: string;        // obrigatório se conveniadoId null
  conveniadoCpf?: string;
  conveniadoEmail?: string;
  conveniadoTelefone?: string;
  condominioId?: string;          // se tipo=CONDOMINIO
  administradoraId?: string;      // se tipo=ADMINISTRADORA ou opcionalmente
  configBeneficio?: {
    criterio: "MEMBROS_ATIVOS";
    efeitoMudancaFaixa: "SOMENTE_PROXIMAS" | "INCLUIR_PENDENTES";
    maxAcumuloConveniado?: number; // cap %
    faixas: Array<{
      minMembros: number;
      maxMembros: number | null;
      descontoMembros: number;     // 0-100
      descontoConveniado: number;  // 0-100
    }>;
  };
  registrarComoIndicacao?: boolean; // default true
  diaEnvioRelatorio?: number;      // 1-28, default 5
  criarCooperadoSemUc?: boolean;   // se true e conveniadoId null, cria cooperado SEM_UC
}

// Response 201
{
  id: string;
  numero: string;  // auto-gerado CV-YYYY-NNNN
  nome: string;
  tipo: TipoConvenio;
  status: "ATIVO";
  conveniadoId: string | null;
  membrosAtivosCache: 0;
  faixaAtualIndex: 0;
  descontoMembrosAtual: 0;
  descontoConveniadoAtual: 0;
  createdAt: string;
}
```

**Validações:**
- Se `tipo=CONDOMINIO` e `condominioId` informado: verificar que condomínio existe e não tem outro convênio
- Se `tipo=ADMINISTRADORA`: `administradoraId` obrigatório
- Faixas devem ser ordenadas por `minMembros` e não ter gaps/sobreposições
- `descontoMembros` e `descontoConveniado` entre 0 e 100
- `conveniadoId` (se informado) deve ser cooperado da mesma cooperativa
- Se `criarCooperadoSemUc=true`: criar Cooperado com tipoCooperado=SEM_UC, status=ATIVO

---

#### `GET /convenios` — Listar convênios
**Permissões:** SUPER_ADMIN, ADMIN, OPERADOR
```typescript
// Query params
{
  tipo?: TipoConvenio;
  status?: StatusConvenio;
  busca?: string;              // nome, cnpj, conveniadoNome
  page?: number;               // default 1
  limit?: number;              // default 20
}

// Response 200
{
  data: Array<{
    id: string;
    numero: string;
    nome: string;
    tipo: TipoConvenio;
    cnpj: string | null;
    status: string;
    conveniadoNome: string | null;
    membrosAtivosCache: number;
    faixaAtualIndex: number;
    descontoMembrosAtual: number;
    descontoConveniadoAtual: number;
    createdAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
}
```

---

#### `GET /convenios/:id` — Detalhe do convênio
**Permissões:** SUPER_ADMIN, ADMIN, OPERADOR
```typescript
// Response 200
{
  id: string;
  numero: string;
  nome: string;
  tipo: TipoConvenio;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  status: string;

  conveniado: {
    id: string | null;
    nome: string;
    cpf: string | null;
    email: string | null;
    telefone: string | null;
  } | null;

  condominio: { id: string; nome: string } | null;
  administradora: { id: string; nome: string } | null;

  configBeneficio: ConfigBeneficioJson;
  faixaAtualIndex: number;
  membrosAtivosCache: number;
  descontoMembrosAtual: number;
  descontoConveniadoAtual: number;
  registrarComoIndicacao: boolean;
  diaEnvioRelatorio: number;

  membros: Array<{
    id: string;
    cooperadoId: string;
    nomeCompleto: string;
    cpf: string;
    matricula: string | null;
    status: StatusMembroConvenio;
    descontoOverride: number | null;
    faixaAtual: string | null;
    dataAdesao: string;
    indicacaoId: string | null;
  }>;

  historicoFaixas: Array<{
    faixaAnteriorIdx: number;
    faixaNovaIdx: number;
    membrosAtivos: number;
    descontoAnterior: number;
    descontoNovo: number;
    motivo: string;
    createdAt: string;
  }>;

  createdAt: string;
  updatedAt: string;
}
```

---

#### `PATCH /convenios/:id` — Atualizar convênio
**Permissões:** SUPER_ADMIN, ADMIN
```typescript
// Request (todos opcionais)
{
  nome?: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
  tipo?: TipoConvenio;
  condominioId?: string | null;
  administradoraId?: string | null;
  conveniadoId?: string | null;
  conveniadoNome?: string;
  conveniadoCpf?: string;
  conveniadoEmail?: string;
  conveniadoTelefone?: string;
  configBeneficio?: ConfigBeneficioJson;
  registrarComoIndicacao?: boolean;
  diaEnvioRelatorio?: number;
  status?: "ATIVO" | "SUSPENSO" | "ENCERRADO";
}

// Response 200 — convênio atualizado (mesmo schema do GET :id)
```

**Validações:**
- Se `configBeneficio` mudou: recalcular faixa imediatamente
- Se `status=ENCERRADO`: desligar todos os membros ativos (soft delete)
- Se `conveniadoId` mudou: verificar que novo conveniado não representa outro convênio ativo

---

#### `DELETE /convenios/:id` — Encerrar convênio (soft)
**Permissões:** SUPER_ADMIN, ADMIN
```typescript
// Response 200
{ message: "Convênio encerrado com sucesso", membrosDesligados: number }
```
**Lógica:** Atualizar status=ENCERRADO, desligar todos os membros.

---

### 3.2 Membros

#### `POST /convenios/:id/membros` — Adicionar membro
**Permissões:** SUPER_ADMIN, ADMIN, OPERADOR
```typescript
// Request
{
  cooperadoId: string;             // obrigatório
  matricula?: string;              // ID interno no convênio
}

// Response 201
{
  id: string;
  convenioId: string;
  cooperadoId: string;
  matricula: string | null;
  status: "ATIVO";
  dataAdesao: string;
  indicacaoId: string | null;      // se registrarComoIndicacao=true
  faixaNova: {                      // resultado do recálculo
    index: number;
    descontoMembros: number;
    descontoConveniado: number;
    membrosAtivos: number;
    mudouFaixa: boolean;
  };
}
```

**Validações:**
- Cooperado deve existir e pertencer à mesma cooperativa
- Cooperado não pode já ser membro ativo deste convênio
- Cooperado não pode ser o próprio conveniado (representante)

**Efeitos colaterais:**
1. Se `registrarComoIndicacao=true` e conveniado é cooperado: registrar indicação via `IndicacoesService`
2. Recalcular faixa do convênio
3. Se faixa mudou + `efeitoMudancaFaixa=INCLUIR_PENDENTES`: recalcular cobranças pendentes

---

#### `POST /convenios/:id/membros/importar` — Importação em massa
**Permissões:** SUPER_ADMIN, ADMIN
```typescript
// Request: multipart/form-data com arquivo CSV
// CSV esperado: cpf;matricula (ou cpf,matricula)

// Response 200
{
  importados: number;
  erros: Array<{ linha: number; cpf: string; erro: string }>;
  faixaNova: { index: number; descontoMembros: number; membrosAtivos: number; mudouFaixa: boolean };
}
```

**Lógica:**
1. Parsear CSV
2. Para cada linha: buscar cooperado por CPF, criar vínculo
3. Indicações em batch (se registrarComoIndicacao=true)
4. Um único recálculo de faixa no final

---

#### `PATCH /convenios/:id/membros/:cooperadoId` — Alterar membro
**Permissões:** SUPER_ADMIN, ADMIN
```typescript
// Request
{
  descontoOverride?: number | null;  // null remove override
  matricula?: string;
  status?: "ATIVO" | "SUSPENSO";
}

// Response 200 — membro atualizado
```

---

#### `DELETE /convenios/:id/membros/:cooperadoId` — Desligar membro
**Permissões:** SUPER_ADMIN, ADMIN, OPERADOR
```typescript
// Response 200
{
  message: "Membro desligado",
  faixaNova: { index: number; descontoMembros: number; membrosAtivos: number; mudouFaixa: boolean };
}
```

**Lógica:**
1. Atualizar status=DESLIGADO, ativo=false, dataDesligamento=now()
2. Recalcular faixa
3. NÃO cancelar indicação existente (benefícios MLM permanecem)

---

#### `GET /convenios/:id/membros` — Listar membros
**Permissões:** SUPER_ADMIN, ADMIN, OPERADOR
```typescript
// Query params
{
  status?: StatusMembroConvenio;
  busca?: string;
}

// Response 200
{
  data: Array<{
    id: string;
    cooperadoId: string;
    nomeCompleto: string;
    cpf: string;
    email: string;
    matricula: string | null;
    status: StatusMembroConvenio;
    descontoOverride: number | null;
    descontoEfetivo: number;          // override ou faixa do convênio
    dataAdesao: string;
    dataDesligamento: string | null;
  }>;
  total: number;
}
```

---

### 3.3 Progressão

#### `GET /convenios/:id/progressao` — Faixa atual + histórico + projeção
**Permissões:** SUPER_ADMIN, ADMIN, OPERADOR
```typescript
// Response 200
{
  faixaAtual: {
    index: number;
    minMembros: number;
    maxMembros: number | null;
    descontoMembros: number;
    descontoConveniado: number;
  };
  membrosAtivos: number;
  proximaFaixa: {
    minMembros: number;
    descontoMembros: number;
    descontoConveniado: number;
    faltam: number;                    // membros necessários para próxima faixa
  } | null;                            // null se já na faixa máxima
  historico: Array<{
    de: { index: number; desconto: number };
    para: { index: number; desconto: number };
    membrosAtivos: number;
    motivo: string;
    data: string;
  }>;
}
```

---

#### `POST /convenios/:id/recalcular` — Forçar recálculo (admin)
**Permissões:** SUPER_ADMIN, ADMIN
```typescript
// Request (vazio)

// Response 200
{
  faixaAnterior: number;
  faixaNova: number;
  membrosAtivos: number;
  descontoMembrosAtual: number;
  descontoConveniadoAtual: number;
  mudouFaixa: boolean;
}
```

---

### 3.4 Portal do Conveniado

#### `GET /convenios/meus` — Meus convênios como conveniado
**Permissões:** COOPERADO (com flag isConveniado)
```typescript
// Response 200
{
  data: Array<{
    id: string;
    numero: string;
    nome: string;
    tipo: TipoConvenio;
    membrosAtivos: number;
    faixaAtual: {
      index: number;
      descontoMembros: number;
      descontoConveniado: number;
    };
    proximaFaixa: { faltam: number; descontoConveniado: number } | null;
  }>;
}
```

---

#### `GET /convenios/meus/:id/dashboard` — Dashboard do conveniado
**Permissões:** COOPERADO (validar que é conveniado deste convênio)
```typescript
// Response 200
{
  convenio: {
    id: string;
    numero: string;
    nome: string;
    tipo: TipoConvenio;
  };
  resumo: {
    membrosAtivos: number;
    membrosTotal: number;
    faixaAtual: { index: number; label: string; descontoMembros: number; descontoConveniado: number };
    proximaFaixa: { faltam: number; descontoConveniado: number } | null;
    beneficioMensalEstimado: number;     // R$ estimado com base no desconto atual
  };
  membros: Array<{
    nomeCompleto: string;
    matricula: string | null;
    dataAdesao: string;
    status: StatusMembroConvenio;
  }>;
  historico: Array<{
    data: string;
    evento: string;   // "Faixa 1→2", "Novo membro", etc.
  }>;
}
```

---

### 3.5 Relatórios

#### `GET /convenios/:id/relatorio?competencia=YYYY-MM` — Relatório mensal
**Permissões:** SUPER_ADMIN, ADMIN, OPERADOR + COOPERADO (se conveniado)
```typescript
// Response 200 — mesmo formato existente do ConveniosService.relatorio()
{
  empresa: string;
  cnpj: string;
  competencia: string;
  tipoDesconto: string;
  totalCooperados: number;
  totalGeral: number;
  faixaVigente: { index: number; descontoMembros: number };
  itens: Array<{
    cooperadoId: string;
    nomeCompleto: string;
    cpf: string;
    matricula: string;
    valor: number;
    descontoAplicado: number;
  }>;
}
```

#### `GET /convenios/:id/relatorio/csv` — Export CSV
**Permissões:** mesmas do relatório
**Response:** `text/csv` — mesmo formato existente

#### `GET /convenios/analytics` — Analytics agregado
**Permissões:** SUPER_ADMIN, ADMIN
```typescript
// Response 200
{
  totalConvenios: number;
  totalMembros: number;
  porTipo: Record<TipoConvenio, number>;
  porFaixa: Array<{ faixaIndex: number; quantidade: number }>;
  crescimentoMensal: Array<{ mes: string; novosConvenios: number; novosMembros: number }>;
}
```

---

## 4. LÓGICA DE NEGÓCIO CRÍTICA — Pseudocódigo

### 4.1 `resolverDescontoConvenio(contratoId)` — desconto coexistente

```
FUNÇÃO resolverDesconto(contratoId):
  contrato = buscarContrato(contratoId) com usina, cooperado

  // ── Passo 1: Resolver desconto BASE (hierarquia existente) ──
  descontoBase = null
  fonteBase = null

  SE contrato.descontoOverride != null:
    descontoBase = contrato.descontoOverride
    fonteBase = "contrato"

  SENÃO SE contrato.usinaId:
    configUsina = buscarConfigCobranca(usinaId=contrato.usinaId)
    SE configUsina:
      descontoBase = configUsina.descontoPadrao
      fonteBase = "usina"

  SE descontoBase == null:
    configCoop = buscarConfigCobranca(cooperativaId, usinaId=null)
    SE configCoop:
      descontoBase = configCoop.descontoPadrao
      fonteBase = "cooperativa"

  SE descontoBase == null:
    ERRO "Nenhuma configuração de desconto encontrada"

  // ── Passo 2: Resolver desconto CONVÊNIO (independente, soma) ──
  descontoConvenio = 0
  fonteConvenio = null

  membro = buscarMembroConvenioAtivo(cooperadoId=contrato.cooperadoId)

  SE membro != null:
    // 2a. Override individual do membro
    SE membro.descontoOverride != null:
      descontoConvenio = membro.descontoOverride
      fonteConvenio = "convenio_membro_override"

    // 2b. Faixa do convênio (cache)
    SENÃO:
      convenio = membro.convenio
      SE convenio.descontoMembrosAtual > 0:
        descontoConvenio = convenio.descontoMembrosAtual
        fonteConvenio = "convenio_faixa"

  // ── Passo 3: Resolver desconto CONVENIADO (se cooperado é representante) ──
  descontoConveniado = 0

  convenioRepresentado = buscarConvenioAtivo(conveniadoId=contrato.cooperadoId)
  SE convenioRepresentado != null:
    SE convenioRepresentado.descontoConveniadoAtual > 0:
      descontoConveniado = convenioRepresentado.descontoConveniadoAtual
      // Aplicar cap
      config = parsearJson(convenioRepresentado.configBeneficio)
      SE config.maxAcumuloConveniado != null:
        descontoConveniado = MIN(descontoConveniado, config.maxAcumuloConveniado)

  // ── Passo 4: Combinar ──
  descontoTotal = descontoBase + descontoConvenio + descontoConveniado

  // Nunca ultrapassar 100%
  descontoTotal = MIN(descontoTotal, 100)

  RETORNAR {
    desconto: descontoTotal,
    descontoBase: descontoBase,
    descontoConvenio: descontoConvenio,
    descontoConveniado: descontoConveniado,
    baseCalculo: "TUSD_TE",
    fonte: fonteBase,
    fonteConvenio: fonteConvenio
  }
```

**Nota sobre coexistência**: O desconto do convênio é ADITIVO ao desconto base. Exemplo:
- Usina define desconto base 15%
- Convênio na faixa 3 define desconto 5% para membros
- Membro recebe 15% + 5% = 20% de desconto
- Se o membro é também conveniado de outro convênio com 3%: 15% + 5% + 3% = 23%

---

### 4.2 `recalcularFaixaConvenio(convenioId)` — trigger + contagem + cache + histórico

```
FUNÇÃO recalcularFaixa(convenioId):
  convenio = buscarConvenio(convenioId)
  config = parsearJson(convenio.configBeneficio)

  SE config.faixas == null OU config.faixas.length == 0:
    RETORNAR { mudouFaixa: false }

  // 1. Contar membros ativos
  membrosAtivos = COUNT(convenio_cooperados WHERE convenioId=convenioId AND ativo=true)

  // 2. Determinar faixa correspondente
  novaFaixaIdx = 0
  novaFaixa = config.faixas[0]

  PARA CADA (i, faixa) EM config.faixas:
    SE membrosAtivos >= faixa.minMembros:
      SE faixa.maxMembros == null OU membrosAtivos <= faixa.maxMembros:
        novaFaixaIdx = i
        novaFaixa = faixa

  // 3. Verificar se mudou
  mudou = (novaFaixaIdx != convenio.faixaAtualIndex)
         OU (membrosAtivos != convenio.membrosAtivosCache)

  SE mudou:
    // 4. Registrar histórico (só se faixa mudou de verdade)
    SE novaFaixaIdx != convenio.faixaAtualIndex:
      CRIAR HistoricoFaixaConvenio {
        convenioId,
        faixaAnteriorIdx: convenio.faixaAtualIndex,
        faixaNovaIdx: novaFaixaIdx,
        membrosAtivos,
        descontoAnterior: convenio.descontoMembrosAtual,
        descontoNovo: novaFaixa.descontoMembros,
        descontoConveniadoAnterior: convenio.descontoConveniadoAtual,
        descontoConveniadoNovo: novaFaixa.descontoConveniado,
        motivo: contexto  // "NOVO_MEMBRO" | "MEMBRO_DESLIGADO" | "RECALCULO_ADMIN"
      }

    // 5. Atualizar cache no convênio
    ATUALIZAR ContratoConvenio SET
      faixaAtualIndex = novaFaixaIdx,
      membrosAtivosCache = membrosAtivos,
      descontoMembrosAtual = novaFaixa.descontoMembros,
      descontoConveniadoAtual = novaFaixa.descontoConveniado

    // 6. Se configurado, recalcular cobranças pendentes
    SE novaFaixaIdx != convenio.faixaAtualIndex
       E config.efeitoMudancaFaixa == "INCLUIR_PENDENTES":
      recalcularCobrancasPendentes(convenioId)

  RETORNAR {
    mudouFaixa: novaFaixaIdx != convenio.faixaAtualIndex,
    faixaAnterior: convenio.faixaAtualIndex,
    faixaNova: novaFaixaIdx,
    membrosAtivos,
    descontoMembrosAtual: novaFaixa.descontoMembros,
    descontoConveniadoAtual: novaFaixa.descontoConveniado
  }
```

```
FUNÇÃO recalcularCobrancasPendentes(convenioId):
  // Buscar todos os membros ativos do convênio
  membros = buscarMembrosAtivos(convenioId)
  cooperadoIds = membros.map(m => m.cooperadoId)

  // Buscar cobranças PENDENTE ou A_VENCER desses cooperados
  cobrancas = buscarCobrancas(
    WHERE contrato.cooperadoId IN cooperadoIds
    AND status IN ('PENDENTE', 'A_VENCER')
    AND mesReferencia = mesAtual
  )

  // Recalcular cada cobrança com o novo desconto
  PARA CADA cobranca EM cobrancas:
    novoCalculo = calcularCobranca(cobranca.contratoId, cobranca.competencia)
    ATUALIZAR cobranca SET
      percentualDesconto = novoCalculo.descontoAplicado,
      valorDesconto = novoCalculo.valorDesconto,
      valorLiquido = novoCalculo.valorLiquido,
      fonteDesconto = novoCalculo.fonteDesconto
```

---

### 4.3 `adicionarMembroConvenio()` — criar vínculo + SEM_UC + indicação

```
FUNÇÃO adicionarMembro(convenioId, cooperadoId, matricula?):
  convenio = buscarConvenio(convenioId)

  // 1. Validações
  SE convenio.status != "ATIVO":
    ERRO "Convênio não está ativo"

  cooperado = buscarCooperado(cooperadoId)
  SE cooperado == null:
    ERRO "Cooperado não encontrado"

  SE cooperado.cooperativaId != convenio.cooperativaId:
    ERRO "Cooperado não pertence à mesma cooperativa"

  SE cooperadoId == convenio.conveniadoId:
    ERRO "Conveniado não pode ser membro do próprio convênio"

  vinculoExistente = buscarVinculo(convenioId, cooperadoId)
  SE vinculoExistente != null E vinculoExistente.ativo:
    ERRO "Cooperado já é membro deste convênio"

  // 2. Reativar se estava desligado
  SE vinculoExistente != null E !vinculoExistente.ativo:
    ATUALIZAR vinculoExistente SET ativo=true, status=ATIVO, dataDesligamento=null
    membro = vinculoExistente
  SENÃO:
    // 3. Criar vínculo
    membro = CRIAR ConvenioCooperado {
      convenioId, cooperadoId, matricula,
      ativo: true, status: ATIVO, dataAdesao: now()
    }

  // 4. Registrar indicação (se configurado)
  SE convenio.registrarComoIndicacao E convenio.conveniadoId != null:
    TENTAR:
      indicacao = indicacoesService.registrarIndicacao({
        cooperadoIndicadorId: convenio.conveniadoId,
        cooperadoIndicadoId: cooperadoId,
        cooperativaId: convenio.cooperativaId
      })
      ATUALIZAR membro SET indicacaoId = indicacao.id
    CAPTURAR erro:
      // Indicação pode falhar (já existe, etc.) — log mas não bloqueia
      logger.warn("Falha ao registrar indicação: " + erro.message)

  // 5. Recalcular faixa
  resultado = recalcularFaixa(convenioId, motivo="NOVO_MEMBRO")

  RETORNAR { membro, faixaNova: resultado }
```

```
FUNÇÃO criarConveniadoSemUc(dados, cooperativaId):
  // Verificar se já existe cooperado com mesmo CPF
  existente = buscarCooperadoPorCpf(dados.cpf)
  SE existente:
    RETORNAR existente.id

  // Criar cooperado SEM_UC
  cooperado = CRIAR Cooperado {
    nomeCompleto: dados.nome,
    cpf: dados.cpf,
    email: dados.email,
    telefone: dados.telefone,
    tipoCooperado: SEM_UC,
    status: ATIVO,
    cooperativaId: cooperativaId,
    codigoIndicacao: gerarCuid()
  }

  // Criar usuário vinculado
  CRIAR Usuario {
    nome: dados.nome,
    email: dados.email,
    cpf: dados.cpf,
    telefone: dados.telefone,
    perfil: COOPERADO,
    cooperativaId: cooperativaId
  }

  RETORNAR cooperado.id
```

---

### 4.4 `aplicarEfeitoFaixa()` — lógica configurável

```
FUNÇÃO aplicarEfeitoFaixa(convenioId, faixaAnteriorIdx, faixaNovaIdx):
  convenio = buscarConvenio(convenioId)
  config = parsearJson(convenio.configBeneficio)

  // Efeito 1: Sempre — atualizar cache (já feito em recalcularFaixa)
  // Nada adicional aqui

  // Efeito 2: Se INCLUIR_PENDENTES — recalcular cobranças do mês corrente
  SE config.efeitoMudancaFaixa == "INCLUIR_PENDENTES":
    membros = buscarMembrosAtivos(convenioId)
    cooperadoIds = membros.map(m => m.cooperadoId)

    // Buscar contratos ativos desses cooperados
    contratos = buscarContratos(
      WHERE cooperadoId IN cooperadoIds AND status = "ATIVO"
    )

    // Para cada contrato, buscar cobrança pendente do mês
    mesAtual = formatarCompetencia(now())  // "2026-04"

    PARA CADA contrato EM contratos:
      cobranca = buscarCobranca(
        WHERE contratoId = contrato.id
        AND competencia = mesAtual
        AND status IN ('PENDENTE', 'A_VENCER')
      )

      SE cobranca:
        // Recalcular valor da cobrança com novo desconto
        novoCalculo = cobrancasService.calcularCobranca(contrato.id, mesAtual)
        ATUALIZAR cobranca SET
          percentualDesconto = novoCalculo.descontoAplicado,
          valorDesconto = novoCalculo.valorDesconto,
          valorLiquido = novoCalculo.valorLiquido,
          fonteDesconto = novoCalculo.fonteDesconto

        // Se já tem boleto emitido no Asaas, atualizar valor
        SE cobranca.asaasCobrancas.length > 0:
          asaasService.atualizarValor(cobranca.asaasCobrancas[0].id, novoCalculo.valorLiquido)

  // Efeito 3: Notificações
  SE faixaAnteriorIdx != faixaNovaIdx:
    faixaNova = config.faixas[faixaNovaIdx]
    direcao = SE faixaNovaIdx > faixaAnteriorIdx ENTÃO "subiu" SENÃO "desceu"

    // Notificar conveniado
    SE convenio.conveniadoId:
      whatsappService.enviarMudancaFaixa({
        cooperadoId: convenio.conveniadoId,
        convenioNome: convenio.nome,
        faixaAnterior: faixaAnteriorIdx + 1,
        faixaNova: faixaNovaIdx + 1,
        descontoNovo: faixaNova.descontoConveniado,
        direcao
      })

    // Notificar membros (opcional — só se subiu)
    SE direcao == "subiu":
      membros = buscarMembrosAtivos(convenioId)
      PARA CADA membro EM membros:
        whatsappService.enviarMudancaFaixaMembro({
          cooperadoId: membro.cooperadoId,
          convenioNome: convenio.nome,
          descontoNovo: faixaNova.descontoMembros,
        })
```

---

## 5. TELAS FRONTEND NECESSÁRIAS

### 5.1 Dashboard Admin (`/dashboard/convenios/`)

#### Página: Listagem de Convênios
**Rota:** `/dashboard/convenios`
**Componente:** `page.tsx`
**Dados:** `GET /convenios` com filtros
**UI:**
- Tabela com colunas: Número, Nome, Tipo, CNPJ, Membros, Faixa, Desconto Membros, Desconto Conveniado, Status
- Filtros: tipo, status, busca
- Badges coloridos por faixa (bronze/prata/ouro/diamante ou customizado)
- Botão "Novo Convênio"
- Ação: clicar na linha abre detalhe

#### Página: Novo Convênio
**Rota:** `/dashboard/convenios/novo`
**Componente:** `novo/page.tsx`
**Dados:** `POST /convenios`
**UI:**
- Formulário em etapas (stepper):
  1. **Dados básicos**: nome, tipo, cnpj, email, telefone
  2. **Vínculos**: condominioId (dropdown), administradoraId (dropdown) — condicionais por tipo
  3. **Conveniado**: buscar cooperado existente OU preencher dados para criar SEM_UC
  4. **Faixas**: editor visual de faixas (min, max, descontoMembros, descontoConveniado), efeitoMudancaFaixa, maxAcumuloConveniado
  5. **Configurações**: registrarComoIndicacao, diaEnvioRelatorio
- Preview de faixas como tabela/gráfico
- Validação em tempo real

#### Página: Detalhe/Edição + Membros + Progressão
**Rota:** `/dashboard/convenios/[id]`
**Componente:** `[id]/page.tsx`
**Dados:** `GET /convenios/:id`, `GET /convenios/:id/progressao`
**UI:**
- **Aba "Dados"**: formulário editável (PATCH)
- **Aba "Membros"**:
  - Tabela de membros com busca
  - Botão "Adicionar membro" (modal com busca de cooperado)
  - Botão "Importar CSV" (upload + preview + confirmação)
  - Ação por linha: override desconto, suspender, desligar
- **Aba "Progressão"**:
  - Barra de progresso visual mostrando faixa atual
  - Indicador "faltam X membros para próxima faixa"
  - Timeline de histórico de faixas
  - Botão "Recalcular" (admin)
- **Aba "Relatório"**:
  - Seletor de competência
  - Tabela de lançamentos por membro
  - Botão "Exportar CSV"
  - Botão "Enviar por email"

### 5.2 Portal Cooperado (`/portal/convenio`)

#### Página: Dashboard do Conveniado
**Rota:** `/portal/convenio`
**Componente:** `convenio/page.tsx`
**Dados:** `GET /convenios/meus`, `GET /convenios/meus/:id/dashboard`
**UI:**
- **Cards resumo**: membros ativos, faixa atual, desconto atual, benefício mensal estimado
- **Barra de progresso**: visual da faixa (ex: "Faixa 2 de 4 — faltam 3 membros para Faixa 3")
- **Lista de membros**: nome, data adesão, status (read-only)
- **Gráfico de evolução**: membros ao longo do tempo (line chart simples)
- **Histórico de faixas**: timeline compacta
- **Link para relatório mensal**: download CSV ou visualização

### 5.3 Integrações com telas existentes

| Tela existente | Integração |
|---------------|------------|
| `/dashboard/layout.tsx` | Adicionar "Convênios" na nav (seção Operacional, após "Administradoras") com ícone `FileCheck` ou `Handshake` |
| `/portal/layout.tsx` | Adicionar "Meu Convênio" na nav **condicionalmente** (só se cooperado é conveniado). Dados vêm de `/auth/me` |
| `/dashboard/cooperados/[id]` | Exibir seção "Convênios" no detalhe do cooperado: listar convênios dos quais é membro/conveniado |
| `/dashboard/condominios/[id]` | Exibir link para convênio vinculado (se existir) |
| `/dashboard/administradoras/[id]` | Listar convênios gerenciados pela administradora |
| `/portal/indicacoes` | Mostrar indicações originadas de convênio com badge "via Convênio" |

### 5.4 Componentes reutilizáveis a criar

| Componente | Uso |
|-----------|-----|
| `FaixaProgressBar` | Barra visual de faixas (admin + portal). Props: faixas[], faixaAtual, membrosAtivos |
| `FaixaEditor` | Editor CRUD de faixas para formulário de convênio. Props: faixas[], onChange |
| `MembroConvenioTable` | Tabela de membros reutilizada em detalhe admin e dashboard portal |
| `ConvenioStatusBadge` | Badge colorido por status (ATIVO=verde, SUSPENSO=amarelo, ENCERRADO=vermelho) |
| `FaixaBadge` | Badge com a faixa atual e desconto (ex: "Faixa 3 — 8%") |

---

## 6. RISCOS REMANESCENTES

### 6.1 Riscos técnicos

| # | Risco | Severidade | Mitigação |
|---|-------|------------|-----------|
| 1 | **Desconto total > 100%**: desconto_base (usina) + desconto_convenio (faixa) + desconto_conveniado pode somar > 100% | ALTA | Cap fixo em `resolverDesconto()`: `MIN(total, 100)`. Adicionalmente, validar na criação de faixas que `descontoMembros ≤ maxAcumuloConveniado` |
| 2 | **Race condition no recálculo**: dois membros adicionados simultaneamente podem calcular faixa errada | MÉDIA | Usar transação Prisma com `SELECT ... FOR UPDATE` no registro do convênio durante recálculo. Serializar via mutex simples (pg advisory lock) |
| 3 | **Recálculo de cobranças pendentes com boleto já emitido**: se `efeitoMudancaFaixa=INCLUIR_PENDENTES`, o boleto no Asaas precisa ser atualizado | MÉDIA | Verificar se cobrança tem Asaas ID, e chamar `asaasService.atualizarValor()`. Se boleto já pago, não recalcular |
| 4 | **Cooperado membro de N convênios**: o schema não impede (@@unique é por par convenio+cooperado). Um cooperado pode pertencer a múltiplos convênios | MÉDIA | Decisão: **permitir** — `resolverDesconto()` pega o PRIMEIRO convênio ativo encontrado. Alternativamente, somar descontos de todos os convênios (mais complexo). **Recomendação**: limitar a 1 convênio por cooperado via constraint ou validação |
| 5 | **Migration de `empresaNome` → `nome` via @map**: Prisma gera ALTER COLUMN RENAME que pode falhar em views/triggers dependentes | BAIXA | Testar migration em ambiente staging antes de produção. Se falhar, manter nome original da coluna e usar alias no código |
| 6 | **Performance: pre-load de faixas no batch de cobranças**: `resolverDesconto()` faz 2 queries extras (membro + convênio) por contrato | MÉDIA | Pre-carregar mapa `cooperadoId → { descontoConvenio, descontoConveniado }` antes do loop de cobranças. Cache em memória durante o batch |
| 7 | **Conveniado sem UC acumula tokens/benefícios MLM sem gastar**: cooperado SEM_UC não tem cobrança, então benefícios de indicação nunca são aplicados | BAIXA | Opção A: converter benefícios em valor monetário (crédito no LancamentoCaixa). Opção B: acumular e converter quando conveniado tiver UC. **Documentar decisão** |
| 8 | **Importação CSV com CPFs inválidos ou duplicados**: pode criar membros fantasma | BAIXA | Validação rigorosa no parser: formato CPF, existência do cooperado, duplicata no convênio. Relatório de erros detalhado |

### 6.2 Riscos de negócio

| # | Risco | Mitigação |
|---|-------|-----------|
| 1 | **Conveniado troca de convênio**: se o conveniado sair de um convênio e ir para outro, as indicações já registradas ficam vinculadas ao antigo | Manter histórico. Indicações são do cooperado (indicador), não do convênio. Não reprocessar |
| 2 | **Faixa cai quando membro sai**: pode causar insatisfação nos membros restantes que perdem desconto | Comunicação clara: notificar WhatsApp quando faixa muda (já previsto). Considerar flag `naoRebaixar` (grace period) |
| 3 | **Auditorabilidade**: desconto do convênio é resolvido em runtime, não fica salvo no contrato | Já resolvido: `cobranca.fonteDesconto` e `cobranca.descontoAplicado` registram a fonte. Adicionar campo `fonteConvenio` na cobrança para rastreabilidade completa |
| 4 | **Multi-tenant**: convênio de cooperativa A expõe dados para cooperativa B | Já mitigado: todos os endpoints filtram por `cooperativaId` via `req.user.cooperativaId`. Convênio herda cooperativaId |

### 6.3 Decisões menores pendentes

| # | Decisão | Opções | Impacto se adiada |
|---|---------|--------|-------------------|
| 1 | Cooperado pode ser membro de múltiplos convênios? | A) Sim, soma descontos B) Sim, pega maior C) Não, limite 1 | BAIXO — começar com C (limite 1), expandir depois |
| 2 | Grace period antes de rebaixar faixa? | A) Imediato B) 30 dias C) Configurável | BAIXO — começar com A (imediato) |
| 3 | Notificar membros quando faixa cai? | A) Sim B) Só conveniado C) Configurável | BAIXO — começar com B |
| 4 | Relatório automático por email inclui membros novos do mês? | A) Sim B) Não | ZERO — implementar sim |

---

## DIAGRAMA DE DEPENDÊNCIAS

```
Fase 1 (Schema)
  ├── Fase 2 (CRUD)
  │     ├── Fase 3 (Membros)
  │     │     └── Fase 4 (Progressão)
  │     │           ├── Fase 5 (Desconto) ─── Fase 9 (Cron/Notif)
  │     │           ├── Fase 6 (Portal API)
  │     │           └── Fase 7 (Frontend Admin)
  │     │                 └── Fase 8 (Frontend Portal) ← Fase 6
  │     └────────────────── Fase 7 (Frontend Admin)
  └── Fase 10 (Testes) ← Todas
```

---

## CHECKLIST DE ENTREGA

- [ ] Fase 1: Schema expandido, migrations executadas, Prisma client regenerado
- [ ] Fase 2: CRUD convênio funcional (criar, listar, editar, encerrar)
- [ ] Fase 3: Adicionar/remover membros, indicação automática, import CSV
- [ ] Fase 4: Recálculo de faixa, histórico, cron de reconciliação
- [ ] Fase 5: `resolverDesconto()` retorna desconto base + convênio + conveniado
- [ ] Fase 6: Endpoints portal conveniado (/meus, /dashboard)
- [ ] Fase 7: Telas admin (listagem, criação, detalhe com abas)
- [ ] Fase 8: Tela portal conveniado (dashboard com progressão)
- [ ] Fase 9: Notificações WhatsApp/email, cron jobs
- [ ] Fase 10: Testes unitários + integração (80%+ cobertura)

---

*Documento gerado em 2026-04-01. Nenhum arquivo do projeto foi modificado.*
