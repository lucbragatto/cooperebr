# Sprint 8 / Bloco E — Realocação Multi-Usina IMPLEMENTADO (2026-05-18)

## Resumo

Módulo completo de **Engine de Otimização Proativa de Alocação Multi-Usina** —
sugere realocações de cooperados entre usinas pra otimizar conformidade com
políticas de alocação (faixa de consumo × classe GD preferida × usinas elegíveis)
respeitando 4 validações duras: **concentração ≤ 25%**, **distribuidora ANEEL
compatível**, **mudança de classe GD bloqueada**, **estabilidade mínima 90 dias**.

Resolve causa raiz documentada do **caso Exfishes** (R$ 310k/ano por realocação
cega entre classes GD diferentes — Apêndice C do PRODUTO.md) e instrumenta
infra pra Sprint 5a Neutro entregar valor financeiro real.

Spec funcional original em `PLANO-ATE-PRODUCAO.md` linhas 376-399.
Status real pré-Sprint em memória `sprint_8_realocacao_status_real_18_05.md`.

## Marcos entregues

| Marco | Sessão | Escopo | Commits |
|---|---|---|---|
| **M14.A — Backend** | 18/05 noite | Schema delta + engine greedy + 4 validadores + 11 endpoints + 50 specs (cobertura 90.98%) + saneamento 2 usinas ANUAL | `473d0ee` + `39ef190` + `2ffed62` + `6663eb2` |
| **M14.B — Frontend + Cron + Finalização** | 18/05 noite | Painel `/dashboard/parceiro/alocacao` (3 abas) + tela detalhe + cron mensal + seed classeGd + docs operacionais | (commits desta finalização) |

## Arquivos Criados/Modificados

### Schema (Prisma)

- `backend/prisma/schema.prisma`:
  - Enum **`ClasseGdAplicada`** (`GD_I`/`GD_II`/`GD_III`) — Caminho B aprovado 18/05
    (memória `decisao_caminho_b_fio_b_neutro_18_05.md`).
  - Enum **`StatusAlocacaoOtima`** (`SUGERIDA`/`APROVADA_PARCIAL`/`APROVADA_TOTAL`/`DESCARTADA`).
  - Campo **`Contrato.classeGdAplicada`** (nullable — input manual admin até Sprint 5 completo).
  - Model **`PoliticaAlocacao`** — faixas configuráveis por parceiro:
    - `cooperativaId` + `nome` + `faixaMin` + `faixaMax` (null=sem teto) +
      `classeGdPreferida` (null=qualquer) + `usinasElegiveis[]` (vazio=todas) +
      `prioridade` + `ativa`.
  - Model **`AlocacaoOtima`** — snapshot Json da simulação:
    - `cooperativaId` + `calculadaEm` + `snapshot` (Json) + `status` +
      `aprovadasContratoIds[]` + `observacoes` + `geradaPorUserId` +
      `aprovadaPorUserId` + `aplicadaEm`.
  - Relações reversas em **`Cooperativa`** (`politicasAlocacao` + `alocacoesOtimas`).

Aplicado via `npx prisma db push` (aditivo puro, zero `--accept-data-loss`).

### Backend — Service

- `backend/src/alocacao/alocacao-engine.service.ts`
  - **Algoritmo: Greedy + busca local de swap-2** (swap reservado pra Sprint 5a).
  - `simular(cooperativaId)`:
    1. Carrega contratos ATIVO+PENDENTE_ATIVACAO + usinas elegíveis + políticas
    2. Ordena contratos por `kwhContrato` DESC (grandes primeiro)
    3. Pra cada: identifica política via `encontrarPolitica()`, se usina atual já
       satisfaz → pula; senão busca melhor candidata via `buscarMelhorCandidata()`
    4. Aplica 4 validadores em cada candidata (estabilidade + distribuidora +
       concentração + classeGd)
    5. Sort candidatas por % ocupação ASC (menos ocupada primeiro)
    6. Acumula `realocacoes[]` + atualiza `ocupacaoSimulada` Map
    7. Calcula custo proxy antes/depois e retorna `AlocacaoSnapshot`
  - **Custo proxy MVP:** soma de penalidades de violação de política
    (contrato sem usina = 200; classe GD divergente = 100; fora `usinasElegiveis` = 100).
    Sprint 5a Neutro substitui por R$ real (kWh × tarifa × Fio B classe-específico).

- `backend/src/alocacao/alocacao-validador.service.ts` — 4 validadores:
  - `validarConcentracao25` — soma kwh do cooperado na usina alvo (excluindo contrato
    em realocação) + proposto ≤ 25% da capacidade
  - `validarDistribuidora` — UC × Usina mesma distribuidora; permissivo se null (legado)
  - `validarClasseGd` — `contrato.classeGdAplicada === usina.classeGdAnotada`; retorna
    `warn` (não bloqueia) se algum dos dois é null — pendente Sprint 5a Neutro
  - `validarEstabilidade` — `dataInicio >= 90 dias atrás`

- `backend/src/alocacao/alocacao.service.ts` — orchestration:
  - `simular()` — engine wrap + grava `AlocacaoOtima` com status SUGERIDA
  - `listar()` / `obter()` — multi-tenant; SUPER_ADMIN bypass com cooperativaId=null
  - `aplicar(contratoIds[])` — transação que faz UPDATE Contrato.usinaId em cada;
    define status APROVADA_PARCIAL ou APROVADA_TOTAL baseado em count acumulado
  - `descartar(motivo?)` — marca status DESCARTADA (idempotente)

- `backend/src/alocacao/politica-alocacao.service.ts` — CRUD básico com
  `validarFaixa(faixaMin, faixaMax)` (faixaMin≥0 + faixaMax>faixaMin se não null).

- `backend/src/alocacao/alocacao.job.ts` — cron **dia 5 mês às 03:00** (Decisão C.3):
  - `@Cron('0 3 5 * *')` itera cooperativas ativas
  - Pra cada: `simular()` + cria `Notificacao(tipo='ALOCACAO_SUGERIDA', adminId)`
    se economia proxy ≥ threshold (100) + realocações > 0
  - Método `executarCiclo({ origem })` exposto pra smoke manual

### Backend — Controller (11 endpoints multi-tenant + @AuditLog)

- `backend/src/alocacao/alocacao.controller.ts`:
  - `POST /alocacao/simular`
  - `GET /alocacao` + `?status=`
  - `GET /alocacao/:id`
  - `POST /alocacao/:id/aplicar` + `{ contratoIds[] }`
  - `POST /alocacao/:id/descartar` + `{ motivo? }`
  - `GET /politicas-alocacao` (+ `:id`)
  - `POST /politicas-alocacao`
  - `PATCH /politicas-alocacao/:id`
  - `DELETE /politicas-alocacao/:id`
- Roles: `ADMIN`/`SUPER_ADMIN` em mutações; `+ OPERADOR` em GETs.
- Helper `tenantId(req)` reusado do padrão Sub-Fase 1.
- `@AuditLog` nas 6 rotas de mutação.

### Backend — DTOs (class-validator)

- `dto/aplicar-alocacao.dto.ts` — `contratoIds[]` obrigatório, min 1
- `dto/descartar-alocacao.dto.ts` — `motivo?` opcional MaxLength 500
- `dto/create-politica-alocacao.dto.ts` — `nome`, `faixaMin≥0`, `faixaMax?`,
  `classeGdPreferida?`, `usinasElegiveis?`, `prioridade?`, `ativa?`
- `dto/update-politica-alocacao.dto.ts` — todos opcionais
- `backend/src/usinas/dto/update-usina.dto.ts` (EDIT): adicionado
  `classeGdAnotada` (string nullable) pra UI inline editor

### Frontend — Painel

- `web/app/dashboard/parceiro/alocacao/page.tsx` — painel principal com 3 abas:
  - **Estado atual** — tabela usinas + `classeGdAnotada` inline editável
    (padrão UX Tipo A — clique célula → Select GD_I/II/III → blur salva,
    otimistic UI + revert em caso de 4xx/5xx). Filtro "só sem classeGdAnotada"
    pra backfill rápido. Botão "Simular realocação" → POST /alocacao/simular →
    redireciona pra tela detalhe.
  - **Sugestões** — tabela paginada de `AlocacaoOtima` com filtro status,
    linha → detalhe.
  - **Políticas** — CRUD de `PoliticaAlocacao` (dialog Tipo C pra criar nova,
    toggle ativa, remover com confirmação).
  - Sincroniza tab via URL `?tab=estado|sugestoes|politicas`.

- `web/app/dashboard/parceiro/alocacao/[id]/page.tsx` — tela detalhe (padrão UX
  Tipo B — página própria):
  - Header com status badge + 4 métricas (avaliados / sugeridas / custo antes /
    economia)
  - Tabela de realocações com checkbox + linha verde quando já aprovada
  - Botões "Aplicar selecionadas (N)" + "Descartar"
  - 2 AlertDialogs de confirmação antes de mutar

### Seeds

- `backend/scripts/seed-politica-alocacao-padrao.ts` — 3 políticas padrão SISGD
  (Pequenos ≤500 GD_II / Médios 500-2000 sem preferência / Grandes >2000 GD_I)
  em todas as cooperativas ativas. Idempotente.
- `backend/scripts/seed-classegd-usinas-coopereBR.ts` — backfill `classeGdAnotada`
  pras 3 usinas principais da CoopereBR (cooperebr1, cooperebr2, Solar Norte =
  GD_II). Idempotente (não sobrescreve quando já tem valor diferente).

### Saneamento

- `backend/scripts/sanear-usinas-anual-sprint8.ts` — corrige convenção ANUAL
  → MENSAL nas 2 usinas legado (Solar Guarapari 600.000 → 50.000;
  Solar Serra 480.000 → 40.000). Dry-run default + `--apply`. Aborta se
  cooperados ativos > 0 na usina. Validado: ambas com 0 cooperados pré-fix.

### Testes (M14.A — 50 cenários)

- `backend/src/alocacao/alocacao-validador.service.spec.ts` — 13 cenários
  (concentração com soma cooperado-usina + edge cases; distribuidora ANEEL +
  permissivo legado; classeGd 4 ramos warn/bloqueio/aceite; estabilidade <90d)
- `backend/src/alocacao/alocacao-engine.service.spec.ts` — 7 cenários
  (sem realocações; classe GD divergente; estabilidade bloqueia; concentração
  bloqueia; capacidade filtra; sem usina inicial; etc)
- `backend/src/alocacao/alocacao.service.spec.ts` — 16 cenários (orchestration:
  simular wrap, listar com filtros, obter NotFound/Forbidden, aplicar
  parcial/total, descartar idempotente)
- `backend/src/alocacao/politica-alocacao.service.spec.ts` — 14 cenários (CRUD
  + validações faixa + multi-tenant)

**Cobertura final:**

| Arquivo | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| `alocacao-validador.service.ts` | **97.77%** | 89.47% | **100%** | **97.67%** |
| `alocacao.service.ts` | **100%** | 87.8% | **100%** | **100%** |
| `politica-alocacao.service.ts` | **100%** | 79.24% | **100%** | **100%** |
| `alocacao-engine.service.ts` | 83.94% | 65.41% | 89.28% | 89.9% |
| **All files** | **90.98%** | 75.09% | **93.87%** | **94.52%** |

50/50 specs passing. Zero regressão no baseline (mesmas 11 falhas pré-existentes
em `cooperados/*.spec.ts` + `usinas/usinas.controller.spec.ts`).

## Decisões catalogadas durante Sprint 8

- **C.1 — Modo padrão Sugestão** (Automático OFF default) — aprovado
- **C.2 — Greedy + busca local** (sem LP solver) — aprovado
- **C.3 — Cron dia 5 às 03:00 BRT** + endpoint manual — aprovado
- **C.4 — `Contrato.classeGdAplicada` agora** — aprovado (antecipa Sprint 5a Neutro)
- **C.5 — Split fora do MVP** (Fase 2 futura) — aprovado
- **C.6 — Tabela política padrão** (Pequenos GD_II / Médios qualquer / Grandes GD_I)
  — aprovada
- **C.7 — Mini-saneamento usinas ANUAL dentro do Sprint** com dry-run — aprovado
- **C.8 — Manter Cooperebr2 com 2 cooperados teste** — aprovado

## Como rodar manualmente o cron (sem esperar dia 5)

```ts
// No backend, via ts-node:
import { AppModule } from './src/app.module';
import { NestFactory } from '@nestjs/core';
import { AlocacaoJob } from './src/alocacao/alocacao.job';

const app = await NestFactory.createApplicationContext(AppModule);
const job = app.get(AlocacaoJob);
await job.executarCiclo({ origem: 'manual-cli' });
await app.close();
```

Ou via endpoint admin futuro (não criado no MVP).

## Limitações conhecidas (carry-over)

- **Engine custo proxy** = soma de violações × 100. Sprint 5a Neutro vai
  substituir por R$ real (kWh × tarifa × Fio B classe-específico).
- **Busca local de swap-2** = placeholder vazio. Greedy sozinho atende MVP.
  Sprint 5a Neutro implementa swap quando custo financeiro real existir.
- **`validarClasseGd`** retorna `warn` (não bloqueia) quando contrato ou usina
  têm classeGd null. Bloqueio total aguarda backfill completo + Sprint 5a.
- **Split** (1 UC dividida entre N usinas) NÃO suportado no MVP. Fase 2 futura.
- **Convenção MENSAL refator de código**: D-novo-H continua aberto (saneamento
  de dados aplicado, refator `contratos.service.ts:60-63` + `migracoes-usina.service.ts`
  + UI labels pendente).

## Validação

- ✅ `npx prisma db push` — schema sync aditivo
- ✅ `npx tsc --noEmit -p tsconfig.build.json` — 0 erros
- ✅ `npm run build` — silencioso clean
- ✅ PM2 restart: 11 rotas `/alocacao` + `/politicas-alocacao` mapeadas
- ✅ Smoke engine direto: 9 contratos avaliados, snapshot persistido em
  `AlocacaoOtima`, custo proxy cai 600→400 pós-seed classeGd (3 usinas saem
  da penalidade)
- ✅ 50/50 specs passing
- ✅ Saneamento 2 usinas ANUAL validado via SELECT pós-update
- ✅ Seed políticas padrão idempotente (9 entries = 3 × 3 cooperativas)
- ✅ Seed classeGdAnotada idempotente (3 usinas CoopereBR atualizadas)

## Roadmap pós Sprint 8

- **Sprint 5a Neutro — Fio B completo** (~3-5 dias Code) — Caminho B aprovado:
  schema `Cobranca.fioB`/`percentualFioBAplicado`/`classeGdSnapshot` + model
  `RegrasFioB` (2024-2029) + UI input `classeGdAplicada` no Contrato + cron
  progressão anual. Substitui custo proxy do Engine de Otimização por R$ real.
- **Sprint Housekeeping** (~3-5h) — reformat órfão stashed + LF/CRLF +
  15 scripts untracked + 13 branches órfãs + 5 worktrees + 11 specs failing
  baseline
- **HTML jornada Sugestão #6** — regenerar `docs/diagramas/jornada-membro.html`
- **Sprint 5 Completo (futuro pós-dossiê)** — adiciona `Usina.classeGd` no schema,
  migra dados, lógica do listener Cobrança herda da usina automaticamente
  com fallback pro `Contrato.classeGdAplicada` em exceções
- **D-novo-H refator técnico convenção MENSAL** — `contratos.service.ts:60-63` +
  `migracoes-usina.service.ts` + UI labels (~6-8h)
