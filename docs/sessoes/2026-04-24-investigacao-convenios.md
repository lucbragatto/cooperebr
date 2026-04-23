# Investigacao Modulo Convenios - 2026-04-24

Investigacao read-only dos 6 pontos solicitados.

---

## 1. Schema ContratoConvenio

**Status: FUNCIONAL**

### model ContratoConvenio (schema.prisma:1034-1099)

| Campo | Tipo | Default / Notas |
|---|---|---|
| id | String | @id @default(cuid()) |
| numero | String | @unique |
| empresaNome | String | |
| empresaCnpj | String? | |
| empresaEmail | String? | |
| empresaTelefone | String? | |
| tipoDesconto | String | @default("PERCENTUAL") |
| diaEnvioRelatorio | Int | @default(5) |
| diaDesconto | Int | @default(1) |
| status | String | @default("ATIVO") |
| cooperativaId | String? | |
| tipo | TipoConvenio | @default(OUTRO) |
| condominioId | String? | @unique, relacao Condominio |
| administradoraId | String? | relacao Administradora |
| conveniadoId | String? | relacao Cooperado |
| conveniadoNome | String? | |
| conveniadoCpf | String? | |
| conveniadoEmail | String? | |
| conveniadoTelefone | String? | |
| **configBeneficio** | **Json** | @default("{}") - JSON com faixas progressivas |
| faixaAtualIndex | Int | @default(0) - cache da faixa |
| membrosAtivosCache | Int | @default(0) |
| descontoMembrosAtual | Decimal(5,2) | @default(0) |
| descontoConveniadoAtual | Decimal(5,2) | @default(0) |
| registrarComoIndicacao | Boolean | @default(true) |
| **tierMinimoClube** | **String?** | null = sem requisito; BRONZE/PRATA/OURO/DIAMANTE |
| **modalidade** | **String** | @default("STANDALONE") - STANDALONE ou GLOBAL |
| statusAprovacao | String | @default("APROVADO") - APROVADO/PENDENTE/REJEITADO |
| motivoRejeicao | String? | |
| taxaAprovacaoSisgd | Decimal(10,2)? | |
| taxaAprovacaoPaga | Boolean | @default(false) |
| createdAt | DateTime | |
| updatedAt | DateTime | |

Relacoes: cooperados (ConvenioCooperado[]), lancamentos (LancamentoCaixa[]), historicoFaixas (HistoricoFaixaConvenio[]), condominio, administradora, conveniado (Cooperado).

### model ConvenioCooperado (schema.prisma:1101-1127)

| Campo | Tipo | Notas |
|---|---|---|
| id | String | @id |
| convenioId | String | FK ContratoConvenio |
| cooperadoId | String | FK Cooperado |
| matricula | String? | |
| ativo | Boolean | @default(true) |
| createdAt | DateTime | |
| dataAdesao | DateTime | @default(now()) |
| dataDesligamento | DateTime? | |
| descontoOverride | Decimal(5,2)? | |
| faixaAtual | String? | cache label |
| status | StatusMembroConvenio | @default(MEMBRO_ATIVO) |
| **indicacaoId** | **String?** | **@unique, FK Indicacao** |

Unique constraint: (convenioId, cooperadoId).

### model HistoricoFaixaConvenio (schema.prisma:1129-1145)

| Campo | Tipo |
|---|---|
| id | String |
| convenioId | String |
| faixaAnteriorIdx | Int |
| faixaNovaIdx | Int |
| membrosAtivos | Int |
| descontoAnterior | Decimal(5,2) |
| descontoNovo | Decimal(5,2) |
| descontoConveniadoAnterior | Decimal(5,2) |
| descontoConveniadoNovo | Decimal(5,2) |
| motivo | String |
| createdAt | DateTime |

### Enums relacionados (schema.prisma:264-273)

```
enum StatusMembroConvenio { MEMBRO_ATIVO, MEMBRO_SUSPENSO, MEMBRO_DESLIGADO }
enum EfeitoMudancaFaixa { SOMENTE_PROXIMAS, INCLUIR_PENDENTES }
```

**Nota:** `EfeitoMudancaFaixa` esta definido como enum no schema mas NAO e referenciado por nenhum campo de model. E usado apenas como string dentro do JSON `configBeneficio`.

### Relacoes com Clube, Indicacao, CooperToken

- **Clube de Vantagens:** Relacao indireta via `tierMinimoClube` (string) + lookup em `ProgressaoClube` no metodo `checkTierRequisito()` (`convenios.service.ts:390-396`). Nao ha FK direta.
- **Indicacao:** Relacao direta em ConvenioCooperado (`indicacaoId` FK para Indicacao). Indicacao e criada automaticamente ao adicionar membro se `registrarComoIndicacao=true`.
- **CooperToken:** Nenhuma referencia no modulo de convenios.

### Contagem de registros (banco atual)

| Tabela | Registros |
|---|---|
| ContratoConvenio | **0** |
| ConvenioCooperado | **0** |
| HistoricoFaixaConvenio | **0** |

---

## 2. Usage Flow

**Status: FUNCIONAL**

### Arquivos do modulo (backend/src/convenios/)

| Arquivo | Descricao |
|---|---|
| convenios.module.ts | Modulo NestJS (exports: Service, Membros, Progressao) |
| convenios.controller.ts | Controller principal (CRUD + membros + progressao + relatorio) |
| convenios-portal.controller.ts | Controller portal do conveniado (GET /meus, GET /meus/:id/dashboard) |
| convenios.service.ts | Service principal (CRUD, relatorio, tier check, governanca GLOBAL) |
| convenios-membros.service.ts | Gestao de membros (add, remove, update, importar, indicacao) |
| convenios-progressao.service.ts | Calculo e recalculo de faixas progressivas |
| convenios.job.ts | Cron job reconciliacao diaria (3h) |
| convenios.dto.ts | DTOs com class-validator |
| convenios-progressao.service.spec.ts | Testes unitarios (calcularFaixa, validarFaixas, recalcularFaixa) |

**Duplicata:** Existe `backend/src/financeiro/convenios.service.ts` -- versao legada/simplificada sem progressao, sem tipos, sem indicacoes. Potencial dead code.

### Metodos do ConveniosService

| Metodo | Descricao |
|---|---|
| `create(cooperativaId, dto)` | Cria convenio com retry para numero sequencial. Cria cooperado SEM_UC se solicitado. |
| `findAll(cooperativaId, params)` | Listagem paginada com filtros (tipo, status, busca) |
| `findOne(id, cooperativaId?)` | Detalhe com includes (membros, historico, condominio, administradora, conveniado) |
| `update(id, dto)` | Atualizacao parcial. Se ENCERRADO, desliga todos os membros. Recalcula faixa se configBeneficio mudou. |
| `remove(id)` | Soft delete (status=ENCERRADO, desliga membros) |
| `relatorio(convenioId, competencia)` | Relatorio financeiro por competencia |
| `relatorioCsv(relatorio)` | Exportacao CSV |
| `meusConvenios(cooperadoId)` | Portal: convenios onde o cooperado e conveniado |
| `dashboardConveniado(convenioId, cooperadoId)` | Portal: dashboard com faixas, membros, historico |
| `checkTierRequisito(cooperadoId, convenioId)` | Verifica tier minimo do Clube de Vantagens |
| `listarPendentesGlobal()` | Governanca: lista convenios GLOBAL pendentes |
| `aprovarGlobal(id)` | Governanca: aprova convenio GLOBAL |
| `rejeitarGlobal(id, motivo)` | Governanca: rejeita convenio GLOBAL |

### Endpoints (convenios.controller.ts)

| Metodo | Rota | Roles | Acao |
|---|---|---|---|
| POST | /convenios | SUPER_ADMIN, ADMIN | Criar convenio |
| GET | /convenios | SUPER_ADMIN, ADMIN, OPERADOR | Listar |
| GET | /convenios/global/pendentes | SUPER_ADMIN | Listar pendentes GLOBAL |
| GET | /convenios/:id | SUPER_ADMIN, ADMIN, OPERADOR | Detalhe |
| PATCH | /convenios/:id | SUPER_ADMIN, ADMIN | Atualizar |
| DELETE | /convenios/:id | SUPER_ADMIN, ADMIN | Encerrar |
| PATCH | /convenios/:id/aprovar | SUPER_ADMIN | Aprovar GLOBAL |
| PATCH | /convenios/:id/rejeitar | SUPER_ADMIN | Rejeitar GLOBAL |
| GET | /convenios/:id/membros | SUPER_ADMIN, ADMIN, OPERADOR | Listar membros |
| POST | /convenios/:id/membros | SUPER_ADMIN, ADMIN, OPERADOR | Adicionar membro |
| PATCH | /convenios/:id/membros/:cooperadoId | SUPER_ADMIN, ADMIN, OPERADOR | Atualizar membro |
| DELETE | /convenios/:id/membros/:cooperadoId | SUPER_ADMIN, ADMIN, OPERADOR | Remover membro |
| POST | /convenios/:id/importar | SUPER_ADMIN, ADMIN | Importar membros em massa |
| GET | /convenios/:id/progressao | SUPER_ADMIN, ADMIN, OPERADOR | Ver progressao |
| POST | /convenios/:id/recalcular | SUPER_ADMIN, ADMIN | Recalcular faixa |
| GET | /convenios/:id/relatorio | SUPER_ADMIN, ADMIN, OPERADOR | Relatorio (JSON ou CSV) |

Portal (convenios-portal.controller.ts):

| Metodo | Rota | Roles | Acao |
|---|---|---|---|
| GET | /convenios/meus | COOPERADO, ADMIN, SUPER_ADMIN | Meus convenios |
| GET | /convenios/meus/:id/dashboard | COOPERADO, ADMIN, SUPER_ADMIN | Dashboard do conveniado |

### Frontend (web/app/dashboard/convenios/)

| Pagina | Descricao |
|---|---|
| page.tsx | Listagem com busca, tabela com numero, nome, tipo, conveniado, membros, descontos, status |
| novo/page.tsx | Formulario completo: dados, conveniado, faixas progressivas, modalidade, tierMinimo |
| [id]/page.tsx | Detalhe: cards resumo, conveniado, faixas visuais, membros (add/remove), historico progressao |

---

## 3. Conexoes Implementadas

### Clube de Vantagens (tierMinimoClube)

**Status: FUNCIONAL**

- `ContratoConvenio.tierMinimoClube` (schema.prisma:1076) -- campo String opcional
- `checkTierRequisito()` (convenios.service.ts:390-396) -- consulta `progressaoClube.findUnique({where: {cooperadoId}})` e compara `nivelAtual` com `tierMinimoClube` usando `TIER_ORDEM`
- Chamado no controller ao adicionar membro (convenios.controller.ts:102-105) -- retorna ForbiddenException se tier insuficiente
- Frontend: select no formulario de criacao (novo/page.tsx:168-176) com opcoes Bronze/Prata/Ouro/Diamante

**Nota:** Nao ha relacao com `ofertaClube` ou `OfertaClube` -- NAO_EXISTE.

### Indicacao

**Status: FUNCIONAL**

- `ConvenioCooperado.indicacaoId` (schema.prisma:1119) -- FK unica para Indicacao
- `registrarIndicacaoConvenio()` (convenios-membros.service.ts:204-236) -- cria Indicacao nivel 1 com status PENDENTE e vincula ao membro
- Chamado automaticamente em `adicionarMembro()` se `convenio.registrarComoIndicacao=true && convenio.conveniadoId != null`
- Tambem chamado em `importarMembros()` via `adicionarMembroSemRecalculo()`
- Nao duplica se cooperado ja tem indicacao nivel 1

### CooperToken

**Status: NAO_EXISTE**

Nenhuma referencia a CooperToken, token, ledger ou similar no modulo de convenios.

---

## 4. ConvenioCooperado

**Status: FUNCIONAL**

### Como membros sao adicionados

Metodo `adicionarMembro()` em convenios-membros.service.ts:14-84:

1. Valida que convenio existe e esta ATIVO
2. Valida que cooperado existe
3. Valida que cooperado pertence a mesma cooperativa (multi-tenant)
4. Verifica que cooperado NAO e membro de outro convenio ativo
5. Se ja existe vinculo inativo: reativa (status=MEMBRO_ATIVO, nova dataAdesao)
6. Se nao existe: cria novo ConvenioCooperado
7. Se `registrarComoIndicacao=true` e tem conveniado: registra indicacao
8. Recalcula faixa progressiva

### Transicoes de status

```
MEMBRO_ATIVO  (default ao criar/reativar)
    |
    v
MEMBRO_DESLIGADO  (ao remover membro ou encerrar convenio)
```

- `MEMBRO_ATIVO` -> `MEMBRO_DESLIGADO`: em `removerMembro()` (convenios-membros.service.ts:86-106), em `update(status=ENCERRADO)` (convenios.service.ts:214-223), em `remove()` (convenios.service.ts:233-247)
- `MEMBRO_DESLIGADO` -> `MEMBRO_ATIVO`: reativacao ao adicionar membro que ja tinha vinculo inativo (convenios-membros.service.ts:48-57)
- **MEMBRO_SUSPENSO**: definido no enum mas NAO usado em nenhum codigo do modulo

### Indicacao vinculada automaticamente

Sim. Ao adicionar membro, se `convenio.registrarComoIndicacao=true` e `convenio.conveniadoId` existe, cria Indicacao automaticamente (convenios-membros.service.ts:72-78). A indicacao e criada com `nivel: 1, status: 'PENDENTE'` e vinculada via `indicacaoId` no ConvenioCooperado.

---

## 5. HistoricoFaixaConvenio

**Status: FUNCIONAL**

### Funcao recalcularFaixa

Localizada em convenios-progressao.service.ts:24-101.

Fluxo:
1. Busca convenio e extrai `configBeneficio.faixas`
2. Se nao tem faixas: zera cache (faixaAtualIndex=0, membrosAtivosCache=0, descontos=0)
3. Conta membros ativos via `convenioCooperado.count({where: {convenioId, ativo: true}})`
4. Chama `calcularFaixa(faixas, membrosAtivos)` -- ordena faixas por minMembros, encontra ultima faixa onde membros >= minMembros
5. Atualiza cache no ContratoConvenio (faixaAtualIndex, membrosAtivosCache, descontos)
6. Se faixa mudou: cria registro em HistoricoFaixaConvenio
7. Atualiza label `faixaAtual` em todos os membros ativos

### Trigger vs Cron

**Ambos:**

- **Trigger (evento):** recalcularFaixa() e chamado em:
  - `adicionarMembro()` -- motivo 'NOVO_MEMBRO' (convenios-membros.service.ts:81)
  - `removerMembro()` -- motivo 'MEMBRO_DESLIGADO' (convenios-membros.service.ts:103)
  - `importarMembros()` -- motivo 'IMPORTACAO_MASSA' (convenios-membros.service.ts:156)
  - `update(configBeneficio)` -- motivo 'CONFIG_ALTERADA' (convenios.service.ts:227)
  - Endpoint POST /:id/recalcular -- motivo 'RECALCULO_ADMIN' (convenios.controller.ts:158)

- **Cron (reconciliacao):** `recalcularTodos()` em convenios.job.ts:13-21. Roda diariamente as 3h ('0 3 * * *'), motivo 'RECALCULO_CRON'. Percorre todos convenios ATIVO.

### SOMENTE_PROXIMAS / INCLUIR_PENDENTES

**Status: PARCIAL**

- O enum `EfeitoMudancaFaixa` existe no schema (schema.prisma:270-273) mas NAO e referenciado por nenhum campo de model
- `efeitoMudancaFaixa` e definido como `string?` na interface ConfigBeneficio (convenios-progressao.service.ts:13) e no DTO (convenios.dto.ts:41)
- O frontend envia `efeitoMudancaFaixa: 'SOMENTE_PROXIMAS'` no payload de criacao (novo/page.tsx:106)
- **MAS**: o metodo `recalcularFaixa()` NAO usa o campo `efeitoMudancaFaixa` -- ele simplesmente recalcula e aplica. Nao ha logica que diferencie SOMENTE_PROXIMAS de INCLUIR_PENDENTES

---

## 6. Modalidade Global

**Status: FUNCIONAL**

### Campos no schema

- `modalidade`: String @default("STANDALONE") -- valores STANDALONE ou GLOBAL (schema.prisma:1079)
- `statusAprovacao`: String @default("APROVADO") -- APROVADO/PENDENTE/REJEITADO (schema.prisma:1080)
- `motivoRejeicao`: String? (schema.prisma:1081)
- `taxaAprovacaoSisgd`: Decimal? (schema.prisma:1082)
- `taxaAprovacaoPaga`: Boolean @default(false) (schema.prisma:1083)

### Fluxo de aprovacao SUPER_ADMIN

1. Ao criar convenio com `modalidade='GLOBAL'`, `statusAprovacao` e setado como `'PENDENTE'` automaticamente (convenios.service.ts:107)
2. SUPER_ADMIN lista pendentes: `GET /convenios/global/pendentes` (convenios.controller.ts:52-55) -- role SUPER_ADMIN
3. SUPER_ADMIN aprova: `PATCH /convenios/:id/aprovar` (convenios.controller.ts:64-66) -- role SUPER_ADMIN. Valida que modalidade e GLOBAL.
4. SUPER_ADMIN rejeita: `PATCH /convenios/:id/rejeitar` com `{motivoRejeicao}` (convenios.controller.ts:69-72) -- role SUPER_ADMIN. Valida que modalidade e GLOBAL.

### Frontend

- Formulario de criacao tem radio buttons STANDALONE/GLOBAL (novo/page.tsx:178-189)
- Se GLOBAL selecionado: mostra aviso amarelo sobre aprovacao SISGD + campo taxa (novo/page.tsx:190-199)

### Lacunas observadas

- Nao ha verificacao de `statusAprovacao` ao operar sobre o convenio (ex: adicionar membros a convenio PENDENTE e permitido)
- `taxaAprovacaoPaga` nao e utilizada em nenhuma logica -- campo sem uso
- Nao ha UI no dashboard para SUPER_ADMIN ver/aprovar convenios globais pendentes (apenas endpoint)

---

## Resumo Consolidado

| Ponto | Status | Observacao |
|---|---|---|
| 1. Schema ContratoConvenio | **FUNCIONAL** | 3 models completos, 0 registros no banco |
| 2. Usage flow | **FUNCIONAL** | Backend completo (8 arquivos), frontend completo (3 paginas), duplicata em financeiro/ |
| 3. Conexao Clube | **FUNCIONAL** | tierMinimoClube + checkTierRequisito via ProgressaoClube |
| 3. Conexao Indicacao | **FUNCIONAL** | indicacaoId em ConvenioCooperado, criacao automatica |
| 3. Conexao CooperToken | **NAO_EXISTE** | Nenhuma referencia |
| 3. Conexao ofertaClube | **NAO_EXISTE** | Nenhuma referencia |
| 4. ConvenioCooperado | **FUNCIONAL** | Add/remove/import membros, status ATIVO/DESLIGADO, indicacao auto |
| 4. Status SUSPENSO | **PARCIAL** | Definido no enum mas nao usado em codigo |
| 5. HistoricoFaixaConvenio | **FUNCIONAL** | Trigger (5 pontos) + cron diario |
| 5. efeitoMudancaFaixa | **PARCIAL** | Campo armazenado mas logica nao implementada |
| 6. Modalidade GLOBAL | **FUNCIONAL** | Fluxo SUPER_ADMIN: listar/aprovar/rejeitar |
| 6. taxaAprovacaoPaga | **PARCIAL** | Campo existe mas sem logica associada |

### Alertas

1. **Duplicata de service:** `backend/src/financeiro/convenios.service.ts` e uma versao legada simplificada. Potencial confusao ou dead code.
2. **efeitoMudancaFaixa nao implementado:** O frontend envia SOMENTE_PROXIMAS mas o backend ignora -- recalcula e aplica imediatamente sem distinção.
3. **MEMBRO_SUSPENSO nao usado:** Enum definido mas nenhum fluxo de código transiciona para esse status.
4. **taxaAprovacaoPaga sem logica:** Campo booleano existe mas nao e verificado em nenhum fluxo.
5. **statusAprovacao sem guard:** Convenios GLOBAL com statusAprovacao=PENDENTE permitem operacoes normais (adicionar membros, etc).
6. **0 registros:** Nenhum convenio foi criado ate o momento -- modulo inteiro sem uso em producao.
