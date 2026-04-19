# Analise Modulo Convenios/Parcerias - CoopereBR

**Data**: 2026-04-01
**Tipo**: Analise arquitetural (somente leitura)

---

## A. O QUE JA EXISTE E PODE SER REAPROVEITADO

### A.1 Modelos Prisma existentes

| Modelo | Arquivo | Reaproveitavel? | Observacao |
|--------|---------|-----------------|------------|
| `ContratoConvenio` | `schema.prisma:884-902` | **Parcialmente** | Base rudimentar: tem empresa, CNPJ, tipoDesconto, status. Falta: faixas progressivas, tipo de conveniado, config beneficio conveniado, vínculo com indicacoes |
| `ConvenioCooperado` | `schema.prisma:904-914` | **Parcialmente** | Vincula cooperado a convenio. Falta: dataAdesao, descontoOverride, statusMembro, faixaAtual |
| `Condominio` | `schema.prisma` | **Sim** | Ja tem sindicoNome/Cpf/Email/Telefone, administradoraId. Pode ser vinculado como tipo de conveniado |
| `Administradora` | `schema.prisma` | **Sim** | Ja gerencia N condominios. Modelo de "agregador de convenios" ja existe |
| `UnidadeCondominio` | `schema.prisma` | **Sim** | Vincula cooperado a condominio via unidade. Ja tem fracaoIdeal, percentualFixo |
| `ConfiguracaoCobranca` | `schema.prisma:688-703` | **Sim** | Hierarquia contrato→usina→cooperativa. Convenio entraria como novo nivel |
| `ConfigIndicacao` | `schema.prisma` | **Reutilizar logica** | maxNiveis, modalidade, niveisConfig - padrao JSON configuravel reutilizavel |
| `Indicacao` + `BeneficioIndicacao` | `schema.prisma` | **Integrar** | Membros do convenio = indicacoes do conveniado. Nao duplicar, vincular |
| `ProgressaoClube` + `ConfigClubeVantagens` | `schema.prisma` | **Modelo a seguir** | Faixas progressivas com criterio + niveisConfig JSON. Mesmo padrao para faixas do convenio |
| `Plano` | `schema.prisma` | **Referenciar** | descontoBase, descontoPromocional ja existem. Convenio pode ter plano preferencial |

### A.2 Servicos existentes reutilizaveis

| Servico | Arquivo | O que reaproveitar |
|---------|---------|-------------------|
| `ConveniosService` | `backend/src/financeiro/convenios.service.ts` | CRUD basico, vincular/desvincular, relatorio. **Expandir**, nao recriar |
| `ConfiguracaoCobrancaService.resolverDesconto()` | `backend/src/configuracao-cobranca/configuracao-cobranca.service.ts:60-109` | Hierarquia de resolucao. Adicionar nivel "convenio" entre contrato e usina |
| `IndicacoesService.registrarIndicacao()` | `backend/src/indicacoes/indicacoes.service.ts` | Registrar membros do convenio como indicacoes do conveniado |
| `ClubeVantagensService.avaliarProgressao()` | `backend/src/clube-vantagens/clube-vantagens.service.ts` | Logica de avaliacao por faixas. Mesmo padrao para progressao coletiva |
| `CobrancasService.gerarCobranca()` | `backend/src/cobrancas/cobrancas.service.ts:405-479` | Ja resolve desconto via hierarquia. Precisa consumir novo nivel convenio |
| `CondominiosService` | `backend/src/condominios/condominios.service.ts` | Rateio de energia, gestao de unidades. Condominio-convenio herda isso |
| `AdministradorasService` | `backend/src/administradoras/administradoras.service.ts` | CRUD administradoras, vinculo com condominios |

### A.3 Logica que NAO deve ser duplicada

1. **Resolucao de desconto** (`configuracao-cobranca.service.ts:60-109`): nao criar resolverDescontoConvenio() separado. Estender o existente.
2. **Registro de indicacao** (`indicacoes.service.ts`): membro do convenio = indicacao normal. Usar campo `origem: 'CONVENIO'` no registro.
3. **Progressao por faixas** (`clube-vantagens.service.ts`): mesmo padrao `niveisConfig` JSON. Criar funcao generica de avaliacao de faixa.
4. **Multi-tenant** (`req.user.cooperativaId`): padrao ja consolidado em todos os controllers.

---

## B. O QUE PRECISA SER CRIADO DO ZERO

### B.1 Alteracoes no Schema Prisma (migrations)

#### Evolucao do modelo `ContratoConvenio` → `Convenio`

```prisma
// RENOMEAR ContratoConvenio para Convenio (ou criar novo e migrar)
model Convenio {
  id                    String   @id @default(cuid())
  cooperativaId         String
  cooperativa           Cooperativa @relation(fields: [cooperativaId], references: [id])

  // Identificacao
  numero                String   @unique
  nome                  String   // "Jazz Residence", "Sindicato Metalurgicos", etc.
  tipo                  TipoConvenio // CONDOMINIO, ADMINISTRADORA, ASSOCIACAO, SINDICATO, EMPRESA, OUTRO

  // Empresa/Entidade
  cnpj                  String?
  email                 String?
  telefone              String?

  // Conveniado (representante)
  conveniadoId          String?
  conveniado            Cooperado? @relation("ConveniadoConvenio", fields: [conveniadoId], references: [id])
  conveniadoNome        String    // Pode ser alguem que nao e cooperado
  conveniadoCpf         String?
  conveniadoEmail       String?
  conveniadoTelefone    String?

  // Vinculo com condominio (se tipo = CONDOMINIO)
  condominioId          String?   @unique
  condominio            Condominio? @relation(fields: [condominioId], references: [id])

  // Vinculo com administradora (se gerencia multiplos condominios)
  administradoraId      String?
  administradora        Administradora? @relation(fields: [administradoraId], references: [id])

  // Configuracao de beneficio
  configBeneficio       Json     // Faixas progressivas (ver B.2)
  descontoConveniado    Decimal? @db.Decimal(5, 2) // Desconto fixo do conveniado (override)
  beneficioConveniado   Json?    // Faixas especificas do conveniado

  // Operacional
  diaEnvioRelatorio     Int      @default(5)
  status                StatusConvenio @default(ATIVO)

  // Indicacao automatica
  registrarComoIndicacao Boolean @default(true) // Cada membro vira indicacao do conveniado

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // Relacoes
  membros               MembroConvenio[]

  @@index([cooperativaId])
  @@index([conveniadoId])
  @@index([condominioId])
  @@map("convenios")
}

enum TipoConvenio {
  CONDOMINIO
  ADMINISTRADORA
  ASSOCIACAO
  SINDICATO
  EMPRESA
  OUTRO
}

enum StatusConvenio {
  ATIVO
  SUSPENSO
  ENCERRADO
}
```

#### Novo modelo `MembroConvenio` (evolucao de ConvenioCooperado)

```prisma
model MembroConvenio {
  id              String   @id @default(cuid())
  convenioId      String
  convenio        Convenio @relation(fields: [convenioId], references: [id])
  cooperadoId     String
  cooperado       Cooperado @relation(fields: [cooperadoId], references: [id])

  // Dados do vinculo
  matricula       String?  // ID interno no convenio (ex: apto, matricula RH)
  dataAdesao      DateTime @default(now())
  dataDesligamento DateTime?

  // Desconto
  descontoOverride Decimal? @db.Decimal(5, 2) // Admin pode sobrescrever individualmente
  faixaAtual       String?  // Cache da faixa vigente

  // Status
  ativo           Boolean  @default(true)
  status          StatusMembroConvenio @default(ATIVO)

  // Rastreio de indicacao
  indicacaoId     String?  @unique
  indicacao       Indicacao? @relation(fields: [indicacaoId], references: [id])

  createdAt       DateTime @default(now())

  @@unique([convenioId, cooperadoId])
  @@index([convenioId, ativo])
  @@index([cooperadoId])
  @@map("membros_convenio")
}

enum StatusMembroConvenio {
  ATIVO
  SUSPENSO
  DESLIGADO
}
```

#### Novo modelo `FaixaConvenio` (configuracao de progressao)

```prisma
// Nao precisa de modelo separado - usar campo JSON configBeneficio no Convenio
// Estrutura do JSON:
// {
//   "criterio": "MEMBROS_ATIVOS",
//   "faixas": [
//     { "minMembros": 1, "maxMembros": 2, "descontoMembros": 3.0, "descontoConveniado": 1.0 },
//     { "minMembros": 3, "maxMembros": 6, "descontoMembros": 5.0, "descontoConveniado": 2.5 },
//     { "minMembros": 7, "maxMembros": 11, "descontoMembros": 8.0, "descontoConveniado": 4.0 },
//     { "minMembros": 12, "maxMembros": null, "descontoMembros": 12.0, "descontoConveniado": 6.0 }
//   ]
// }
```

#### Novo modelo `HistoricoFaixaConvenio`

```prisma
model HistoricoFaixaConvenio {
  id              String   @id @default(cuid())
  convenioId      String
  convenio        Convenio @relation(fields: [convenioId], references: [id])
  faixaAnterior   String   // "3-6" ou label
  faixaNova       String
  membrosAtivos   Int
  descontoAnterior Decimal @db.Decimal(5, 2)
  descontoNovo    Decimal  @db.Decimal(5, 2)
  motivo          String   // "NOVO_MEMBRO", "MEMBRO_DESLIGADO", "ADMIN_OVERRIDE"
  createdAt       DateTime @default(now())

  @@index([convenioId, createdAt])
  @@map("historico_faixa_convenio")
}
```

### B.2 Alteracoes em modelos existentes

```prisma
// Cooperado - adicionar relacao inversa
model Cooperado {
  // ... campos existentes ...
  conveniosRepresentados Convenio[] @relation("ConveniadoConvenio")
  membrosConvenio        MembroConvenio[]
}

// Condominio - adicionar relacao com Convenio
model Condominio {
  // ... campos existentes ...
  convenio   Convenio?
}

// Administradora - adicionar relacao com Convenios
model Administradora {
  // ... campos existentes ...
  convenios  Convenio[]
}

// Indicacao - adicionar relacao com MembroConvenio
model Indicacao {
  // ... campos existentes ...
  membroConvenio MembroConvenio?
}
```

### B.3 Novos modulos NestJS

| Modulo | Responsabilidade | Dependencias |
|--------|-----------------|--------------|
| `convenios/` | CRUD convenios, gestao membros, progressao faixas | PrismaService, IndicacoesService, ConfiguracaoCobrancaService |
| `convenios/convenios.controller.ts` | Endpoints REST | ConveniosService |
| `convenios/convenios.service.ts` | Logica de negocio principal | PrismaService |
| `convenios/convenios-progressao.service.ts` | Avaliacao de faixas, atualizacao em massa | PrismaService, ConfiguracaoCobrancaService |
| `convenios/convenios.job.ts` | Cron: reavaliacao periodica de faixas | ConveniosProgressaoService |

**NOTA**: O servico existente `backend/src/financeiro/convenios.service.ts` deve ser migrado/refatorado para o novo modulo. O modelo `ContratoConvenio` atual e muito simples (apenas empresa + cooperados).

### B.4 Endpoints necessarios

```
# CRUD Convenio
POST   /convenios                          - Criar convenio
GET    /convenios                          - Listar convenios (com contagem membros, faixa atual)
GET    /convenios/:id                      - Detalhe convenio com membros
PATCH  /convenios/:id                      - Atualizar convenio
DELETE /convenios/:id                      - Desativar convenio (soft delete)

# Membros
POST   /convenios/:id/membros              - Adicionar membro (+ registrar indicacao)
DELETE /convenios/:id/membros/:cooperadoId - Desligar membro
PATCH  /convenios/:id/membros/:cooperadoId - Override desconto individual
GET    /convenios/:id/membros              - Listar membros com desconto vigente

# Progressao
GET    /convenios/:id/progressao           - Faixa atual, historico, projecao
POST   /convenios/:id/recalcular           - Forcar recalculo de faixa (admin)

# Conveniado
GET    /convenios/meus                     - Convenios onde sou conveniado (portal)
GET    /convenios/meus/:id/dashboard       - Dashboard do conveniado

# Relatorios
GET    /convenios/:id/relatorio            - Relatorio mensal (reaproveitar existente)
GET    /convenios/:id/relatorio/csv        - Export CSV (reaproveitar existente)
GET    /convenios/analytics                - Analytics agregado (admin)

# Importacao em massa
POST   /convenios/:id/importar             - Importar membros via CSV/planilha
```

---

## C. PONTOS DE INTEGRACAO CRITICOS

### C.1 Integracao com hierarquia de desconto

**Estado atual** (`configuracao-cobranca.service.ts:60-109`):
```
contrato.descontoOverride → configUsina → configCooperativa → ERRO
```

**Estado proposto** (novo nivel):
```
contrato.descontoOverride → membroConvenio.descontoOverride → faixaConvenio → configUsina → configCooperativa → ERRO
```

**Implementacao**: Alterar `resolverDesconto()` em `configuracao-cobranca.service.ts`:
```typescript
// Apos verificar contrato override (linha ~70), antes de verificar usina:
// 2. CONVENIO OVERRIDE (membro individual)
const membroConvenio = await this.prisma.membroConvenio.findFirst({
  where: { cooperadoId: contrato.cooperadoId, ativo: true },
  include: { convenio: true },
});

if (membroConvenio?.descontoOverride) {
  return { desconto: membroConvenio.descontoOverride, baseCalculo: 'TUSD_TE', fonte: 'convenio_membro' };
}

// 3. FAIXA DO CONVENIO
if (membroConvenio?.convenio) {
  const faixa = this.resolverFaixaConvenio(membroConvenio.convenio);
  if (faixa) {
    return { desconto: faixa.descontoMembros, baseCalculo: 'TUSD_TE', fonte: 'convenio_faixa' };
  }
}
// 4. Usina...
// 5. Cooperativa...
```

**DECISAO NECESSARIA**: O desconto do convenio **soma** ou **substitui** o desconto da usina/cooperativa?
- Opcao A: **Substitui** (mais simples, hierarquia pura) - recomendado
- Opcao B: **Soma** (convenio da desconto adicional sobre o da usina) - mais complexo, risco de ultrapassar 100%

### C.2 Conveniado com multiplos convenios

**Cenario**: Sindico do Jazz Residence (convenio 1, sem UC) + sindico do Ed. Solar (convenio 2, com UC).

**Solucao**: O conveniado so recebe beneficio na propria UC/contrato. Os beneficios se acumulam:

```
Para cada convenio onde e conveniado:
  beneficioConveniado = resolverFaixaConveniado(convenio)
  totalBeneficio += beneficioConveniado
```

**Implementacao em `resolverDesconto()`**:
```typescript
// Se cooperado e conveniado de algum convenio:
const conveniosRepresentados = await this.prisma.convenio.findMany({
  where: { conveniadoId: contrato.cooperadoId, status: 'ATIVO' },
});

let descontoConveniado = 0;
for (const conv of conveniosRepresentados) {
  const faixa = this.resolverFaixaConvenio(conv);
  descontoConveniado += faixa?.descontoConveniado ?? 0;
}
// Aplicar descontoConveniado como beneficio adicional
```

**DECISAO NECESSARIA**: Limite maximo de acumulo de beneficios do conveniado? (ex: cap de 30%)

### C.3 Progressao coletiva - atualizacao em massa

**Trigger**: Quando membro entra ou sai do convenio, a faixa pode mudar.

**Fluxo**:
1. Membro adicionado/removido → `recalcularFaixa(convenioId)`
2. Contar membros ativos: `SELECT COUNT(*) FROM membros_convenio WHERE convenioId = ? AND ativo = true`
3. Comparar com faixas em `configBeneficio.faixas`
4. Se faixa mudou:
   a. Registrar em `HistoricoFaixaConvenio`
   b. **Atualizar TODOS os contratos dos membros** ← ponto critico de performance

**Atualizacao em massa dos contratos**:
```typescript
// NAO atualizar contrato.percentualDesconto (esse e historico da proposta)
// O desconto do convenio e resolvido em runtime pelo resolverDesconto()
// Entao: nao precisa atualizar N contratos!
// Basta que resolverDesconto() consulte a faixa atual do convenio.
```

**Otimizacao**: Como o desconto e resolvido em runtime (nao cached no contrato), a mudanca de faixa tem efeito imediato na proxima cobranca sem precisar de batch update. **Nao ha problema de N+1 na progressao**.

**Porem**: Para cobranças ja geradas (PENDENTE, A_VENCER), pode ser necessario recalcular se a faixa mudou no meio do ciclo. **DECISAO**: Recalcular cobranças pendentes ou so aplicar na proxima?

### C.4 Integracao com Indicacoes

Quando membro e adicionado ao convenio com `registrarComoIndicacao = true`:

```typescript
async adicionarMembro(convenioId: string, cooperadoId: string) {
  const convenio = await this.findOne(convenioId);

  // 1. Criar vinculo no convenio
  const membro = await this.prisma.membroConvenio.create({ ... });

  // 2. Se conveniado e cooperado, registrar como indicacao
  if (convenio.conveniadoId && convenio.registrarComoIndicacao) {
    const indicacao = await this.indicacoesService.registrarIndicacao({
      cooperadoIndicadorId: convenio.conveniadoId,
      cooperadoIndicadoId: cooperadoId,
      cooperativaId: convenio.cooperativaId,
    });
    // 3. Vincular indicacao ao membro
    await this.prisma.membroConvenio.update({
      where: { id: membro.id },
      data: { indicacaoId: indicacao.id },
    });
  }

  // 4. Recalcular faixa do convenio
  await this.recalcularFaixa(convenioId);
}
```

**RISCO**: Se conveniado nao e cooperado (ex: sindico sem UC), nao pode ser indicador no sistema atual (indicador precisa ser Cooperado). **Solucao**: Permitir `conveniadoId = null` para indicacoes ou criar Cooperado tipo SEM_UC para o conveniado.

### C.5 Integracao com Clube de Vantagens

O conveniado acumula kWh dos membros trazidos (via indicacoes). Como indicacoes ja alimentam o Clube de Vantagens automaticamente (`recalcularIndicadosAtivos()`), **nao precisa de integracao adicional**. O fluxo existente ja cobre:

```
Membro adicionado ao convenio
  → Indicacao registrada (conveniado como indicador)
    → Primeira fatura paga
      → BeneficioIndicacao criado
        → ProgressaoClube.kwhIndicadoAcumulado atualizado
          → Tier promotion avaliada
```

### C.6 Riscos de performance

| Cenario | Risco | Mitigacao |
|---------|-------|-----------|
| Convenio com 500+ membros | `resolverDesconto()` faz query extra por cobranca | Cache faixa no `MembroConvenio.faixaAtual` + atualizar no recalculo |
| Conveniado com 10+ convenios | Loop de consultas na resolucao | Eager load convenios do cooperado, calcular em memoria |
| Recalculo de faixa com 1000 membros | COUNT + update historico | Query unica, sem N+1. Historico e 1 insert |
| Geracao de cobranças mensais | resolverDesconto() chamado N vezes | Batch: pre-carregar faixas de todos os convenios antes do loop |
| Importacao em massa (CSV com 200 membros) | 200 creates + 200 indicacoes + 200 recalculos | Usar `createMany` + registrar indicacoes em batch + 1 recalculo final |

---

## D. RISCOS E DECISOES NECESSARIAS

### D.1 Decisoes que Luciano precisa tomar ANTES de implementar

| # | Decisao | Opcoes | Recomendacao |
|---|---------|--------|--------------|
| 1 | **Desconto do convenio substitui ou soma com usina/cooperativa?** | A) Substitui (hierarquia) B) Soma (acumula) | **A) Substitui** - mais simples, previsivel, sem risco de ultrapassar 100% |
| 2 | **Limite de acumulo de beneficio do conveniado?** | A) Sem limite B) Cap fixo (ex: 30%) C) Configuravel por cooperativa | **C) Configuravel** - cada cooperativa define seu limite |
| 3 | **Conveniado que nao e cooperado pode ser indicador?** | A) Criar cooperado SEM_UC automaticamente B) Indicacao so se for cooperado C) Campo indicadorGenerico | **A) Criar cooperado SEM_UC** - ja existe TipoCooperado.SEM_UC |
| 4 | **Mudanca de faixa recalcula cobranças pendentes?** | A) So proxima cobrança B) Recalcula pendentes | **A) So proxima** - mais seguro, menos complexo |
| 5 | **Migrar `ContratoConvenio` existente ou criar modelo novo?** | A) Evolucao (ALTER TABLE) B) Modelo novo + migracao de dados | **A) Evolucao** - menos disruptivo, dados preservados |
| 6 | **Faixas do conveniado sao independentes ou derivadas das faixas de membros?** | A) Config separada B) Mesma config, percentual diferente por faixa | **B) Mesma config** - `configBeneficio.faixas[].descontoConveniado` ao lado de `descontoMembros` |
| 7 | **Condominio sem administradora pode ter convenio?** | A) Sim B) Obrigatorio via administradora | **A) Sim** - condominioId e opcional no Convenio |
| 8 | **Portal do conveniado: modulo novo ou extensao do portal existente?** | A) Novo role CONVENIADO B) Extensao do portal cooperado | **B) Extensao** - cooperado ja tem portal, conveniado e um cooperado com papel adicional |

### D.2 Riscos tecnicos

| Risco | Severidade | Mitigacao |
|-------|------------|-----------|
| **Desconto duplicado**: convenio + clube de vantagens + indicacao aplicados simultaneamente | ALTA | Definir regra clara: convenio e **alternativo** ao desconto base, nao cumulativo. Ou definir teto |
| **Consistencia de faixa**: membro desligado mas faixa nao recalculada | MEDIA | Cron job diario de validacao + recalculo no evento de desligamento |
| **Migration pesada**: renomear ContratoConvenio com dados existentes | MEDIA | Usar `@@map("convenios")` para renomear tabela sem perder dados. Adicionar colunas incrementalmente |
| **Conveniado fantasma**: cooperado SEM_UC criado automaticamente mas sem UC, sem contrato | BAIXA | Filtrar conveniados SEM_UC de relatorios de inadimplencia. Status PENDENTE ate ter beneficio |
| **Multi-tenant leak**: convenio de cooperativa A visivel por cooperativa B | ALTA | Todas as queries filtradas por cooperativaId. Middleware de tenant ja existe no padrao do sistema |
| **Performance em geracao de cobranças**: N queries extras por convenio | MEDIA | Pre-carregar mapa convenioId→faixa antes do batch de cobranças |

### D.3 Estimativa de complexidade

| Fase | Escopo | Estimativa |
|------|--------|------------|
| **Fase 1: Schema + Migration** | Evolucao ContratoConvenio, novo MembroConvenio, HistoricoFaixaConvenio, relacoes | 2-3 horas |
| **Fase 2: CRUD Convenio** | Controller, Service, DTOs, validacao | 3-4 horas |
| **Fase 3: Progressao de faixas** | Servico de progressao, recalculo, historico | 4-5 horas |
| **Fase 4: Integracao desconto** | Alterar resolverDesconto(), beneficio conveniado, testes | 3-4 horas |
| **Fase 5: Integracao indicacoes** | Auto-registro de indicacao ao adicionar membro, vinculo bidirecional | 2-3 horas |
| **Fase 6: Portal conveniado** | Endpoints /meus, dashboard, listagem membros | 3-4 horas |
| **Fase 7: Importacao em massa** | Parser CSV, validacao, batch create | 2-3 horas |
| **Fase 8: Cron + notificacoes** | Reavaliacao periodica, WhatsApp ao mudar faixa | 2-3 horas |
| **Fase 9: Testes** | Unit + integration testes | 3-4 horas |
| **TOTAL** | | **24-33 horas de desenvolvimento** |

---

## E. PROPOSTA DE SCHEMA PRISMA COMPLETA

### E.1 Novos enums

```prisma
enum TipoConvenio {
  CONDOMINIO
  ADMINISTRADORA
  ASSOCIACAO
  SINDICATO
  EMPRESA
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
```

### E.2 Modelo Convenio (evolucao de ContratoConvenio)

```prisma
model Convenio {
  id                    String          @id @default(cuid())
  cooperativaId         String
  cooperativa           Cooperativa     @relation(fields: [cooperativaId], references: [id])

  // Identificacao
  numero                String          @unique
  nome                  String
  tipo                  TipoConvenio    @default(OUTRO)

  // Entidade
  cnpj                  String?
  email                 String?
  telefone              String?

  // Conveniado (representante/responsavel)
  conveniadoId          String?
  conveniado            Cooperado?      @relation("ConveniadoConvenio", fields: [conveniadoId], references: [id])
  conveniadoNome        String
  conveniadoCpf         String?
  conveniadoEmail       String?
  conveniadoTelefone    String?

  // Vinculos opcionais
  condominioId          String?         @unique
  condominio            Condominio?     @relation(fields: [condominioId], references: [id])
  administradoraId      String?
  administradora        Administradora? @relation(fields: [administradoraId], references: [id])

  // Configuracao de beneficio progressivo
  // JSON: { criterio: "MEMBROS_ATIVOS", faixas: [{ min, max, descontoMembros, descontoConveniado }] }
  configBeneficio       Json            @default("{}")

  // Override do conveniado
  descontoConveniado    Decimal?        @db.Decimal(5, 2)
  maxAcumuloConveniado  Decimal?        @db.Decimal(5, 2) // Cap de beneficio acumulado

  // Cache da faixa atual (evita recalculo em cada cobranca)
  faixaAtualIndex       Int             @default(0)
  membrosAtivos         Int             @default(0)
  descontoFaixaAtual    Decimal         @default(0) @db.Decimal(5, 2)

  // Indicacao automatica
  registrarComoIndicacao Boolean        @default(true)

  // Operacional
  diaEnvioRelatorio     Int             @default(5)
  status                StatusConvenio  @default(ATIVO)

  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt

  // Relacoes
  membros               MembroConvenio[]
  historico             HistoricoFaixaConvenio[]
  lancamentos           LancamentoCaixa[]

  @@index([cooperativaId])
  @@index([conveniadoId])
  @@index([status])
  @@map("convenios")
}
```

### E.3 Modelo MembroConvenio

```prisma
model MembroConvenio {
  id                String              @id @default(cuid())
  convenioId        String
  convenio          Convenio            @relation(fields: [convenioId], references: [id])
  cooperadoId       String
  cooperado         Cooperado           @relation(fields: [cooperadoId], references: [id])

  matricula         String?
  dataAdesao        DateTime            @default(now())
  dataDesligamento  DateTime?

  // Desconto individual (admin override)
  descontoOverride  Decimal?            @db.Decimal(5, 2)

  // Cache
  faixaAtual        String?

  // Vinculo com indicacao
  indicacaoId       String?             @unique
  indicacao         Indicacao?          @relation(fields: [indicacaoId], references: [id])

  status            StatusMembroConvenio @default(ATIVO)
  ativo             Boolean             @default(true)

  createdAt         DateTime            @default(now())

  @@unique([convenioId, cooperadoId])
  @@index([convenioId, ativo])
  @@index([cooperadoId])
  @@map("membros_convenio")
}
```

### E.4 Modelo HistoricoFaixaConvenio

```prisma
model HistoricoFaixaConvenio {
  id                String   @id @default(cuid())
  convenioId        String
  convenio          Convenio @relation(fields: [convenioId], references: [id])

  faixaAnteriorIdx  Int
  faixaNovaIdx      Int
  membrosAtivos     Int
  descontoAnterior  Decimal  @db.Decimal(5, 2)
  descontoNovo      Decimal  @db.Decimal(5, 2)
  motivo            String   // NOVO_MEMBRO, MEMBRO_DESLIGADO, RECALCULO_ADMIN

  createdAt         DateTime @default(now())

  @@index([convenioId, createdAt])
  @@map("historico_faixa_convenio")
}
```

### E.5 Alteracoes em modelos existentes

```prisma
// Cooperado - adicionar:
conveniosRepresentados  Convenio[]       @relation("ConveniadoConvenio")
membrosConvenio         MembroConvenio[]

// Condominio - adicionar:
convenio                Convenio?

// Administradora - adicionar:
convenios               Convenio[]

// Indicacao - adicionar:
membroConvenio          MembroConvenio?

// Cooperativa - adicionar (se nao existir):
convenios               Convenio[]
```

### E.6 Indices recomendados

```prisma
// No Convenio:
@@index([cooperativaId])           // Multi-tenant queries
@@index([conveniadoId])            // Busca convenios do conveniado
@@index([status])                  // Filtro por status

// No MembroConvenio:
@@unique([convenioId, cooperadoId]) // Impede duplicata
@@index([convenioId, ativo])        // Contagem de membros ativos (faixa)
@@index([cooperadoId])              // Busca convenios do cooperado

// No HistoricoFaixaConvenio:
@@index([convenioId, createdAt])   // Timeline de progressao
```

### E.7 Diagrama de relacoes

```
Cooperativa (tenant)
  └── Convenio (N)
        ├── conveniadoId → Cooperado (representante, 0..1)
        ├── condominioId → Condominio (opcional, 0..1)
        ├── administradoraId → Administradora (opcional, 0..1)
        ├── MembroConvenio (N)
        │     ├── cooperadoId → Cooperado
        │     └── indicacaoId → Indicacao (rastreio)
        └── HistoricoFaixaConvenio (N)

Fluxo de desconto:
  Cobranca.resolverDesconto(contratoId)
    → contrato.descontoOverride?                    (1o - contrato)
    → membroConvenio.descontoOverride?               (2o - membro convenio)
    → convenio.descontoFaixaAtual?                   (3o - faixa coletiva)
    → configCobranca(usinaId)?                       (4o - usina)
    → configCobranca(cooperativaId, usinaId=null)?   (5o - cooperativa)
```

---

## RESUMO EXECUTIVO

O sistema ja possui **70% da infraestrutura** necessaria:
- Hierarquia de desconto extensivel (`ConfiguracaoCobranca`)
- Sistema de indicacoes com niveis (`Indicacao` + `BeneficioIndicacao`)
- Progressao por faixas (`ClubeVantagens` com `niveisConfig` JSON)
- Gestao de condominios e administradoras
- Modelo basico de convenio (`ContratoConvenio`)

O trabalho principal e:
1. **Evoluir** o `ContratoConvenio` para `Convenio` (com faixas progressivas e conveniado)
2. **Inserir** o convenio na hierarquia de desconto existente (2 niveis novos)
3. **Conectar** membros do convenio com indicacoes automaticamente
4. **Implementar** progressao coletiva (similar ao ClubeVantagens mas por membros ativos)

As 8 decisoes da secao D.1 devem ser tomadas antes de iniciar a implementacao.
