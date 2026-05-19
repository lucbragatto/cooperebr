# Sub-Fase 1 — Sprint Usinas+Listas Concessionária IMPLEMENTADA (2026-05-18)

## Resumo

Módulo completo de envio de listas de cooperados pra concessionária (EDP-ES inicialmente, multi-distribuidora por design), cobrindo fluxo de 9 estados:
**RASCUNHO → VALIDADA → PRONTA_PARA_ENVIO → ENVIADA → PROTOCOLADA → HOMOLOGADO_PARCIAL → HOMOLOGADO_TOTAL** (+ estados terminais REJEITADA, CANCELADA).

Inclui **trigger automático de ativação de contrato** PENDENTE_ATIVACAO → ATIVO no momento que a concessionária homologa o cooperado individual + **listener de notificação** que envia WhatsApp + Email de boas-vindas com **defense in depth de 3 camadas** (descoberta crítica de bug sistêmico D-novo-N durante smoke, ver §"Bug crítico D-novo-N").

Spec funcional original em memória `spec_modulo_listas_concessionaria_17_05.md`.

## Marcos entregues

| Marco | Sessão | Escopo | Commits |
|---|---|---|---|
| **M10 Fases 1+2** | 17/05 | Schema delta + backend (11 endpoints + 5 DTOs + 11 métodos service) | `56b8fee` |
| **M10 Fase 3** | 17/05 | Frontend (2 abas + página própria criação + tela detalhe + 4 dialogs) | `12faf3f` |
| **M12 Fase 4** | 18/05 tarde/noite | Trigger ativação Contrato + listener WA/email 3 camadas + Bug D-novo-N RESOLVIDO | `4e87874` + `e1bf552` + `acc5168` |
| **M13.A Fase 5** | 18/05 noite | Specs Jest baseline (133 cenários, cobertura 95-100%) | `bf28c16` + `4ae43ca` + `671052f` |
| **M13.B Fase 5** | 18/05 noite | Docs operacionais + smoke regression + fechamento canônico | (este commit) |

## Arquivos Criados/Modificados

### Schema (Prisma)

- `backend/prisma/schema.prisma`:
  - Model **`EnvioListaConcessionaria`** (envio = 1 documento por usina × mês, com campos `numeroInterno` LIST-{apelidoInterno}-YYYYMM-NNN, `status`, `geradaEm`, `validadaEm`, `validadaPorId`, `enviadaEm`, `enviadaPorId`, `canalEnvio`, `protocoloEm`, `numeroProtocoloConcessionaria`, `liberadaEm`, `observacoes`)
  - Model **`EnvioListaCooperado`** (snapshot imutável de cada cooperado no momento da geração — `contratoId`, `cooperadoId`, `ucNumero`, `kwhContratoSnapshot`, `percentualUsinaSnapshot`, `statusIndividual`, `dataHomologacao`, `observacaoIndividual`)
  - Enum **`StatusEnvioConcessionaria`**: `RASCUNHO | VALIDADA | PRONTA_PARA_ENVIO | ENVIADA | PROTOCOLADA | HOMOLOGADO_PARCIAL | HOMOLOGADO_TOTAL | REJEITADA | CANCELADA`
  - Enum **`StatusEnvioCooperado`**: `PENDENTE | HOMOLOGADO | REJEITADO`
  - Campo **`Contrato.dataAtivacao DateTime?`** (M12 — timestamp de ativação automática pós-homologação)
  - Campo **`Usina.classeGdAnotada`** (M10 — anotação de classe GD, sem enum hard pra evitar quebra com dossiê judicial em andamento)

### Backend — Service

- `backend/src/envio-lista-concessionaria/envio-lista-concessionaria.service.ts` (706 linhas)
  - **11 métodos públicos:**
    - `criarRascunho({ usinaId, cooperativaId, cooperadoIds })` — multi-tenant guard + filtro contratos ATIVO/PENDENTE_ATIVACAO + snapshot dos cooperados + transação SERIALIZABLE
    - `listarCooperadosElegiveis(usinaId, cooperativaId)` — retorna cooperados com flag `jaEnviado`/`homologado`/último envio
    - `validar(envioId, validadaPorId, cooperativaId)` — RASCUNHO → VALIDADA
    - `marcarProntoPraEnvio(envioId, cooperativaId)` — VALIDADA → PRONTA_PARA_ENVIO
    - `marcarEnviado(envioId, dto, enviadaPorId, cooperativaId)` — PRONTA_PARA_ENVIO → ENVIADA (canalEnvio email/portal/fisico)
    - `registrarProtocolo(envioId, dto, cooperativaId)` — ENVIADA → PROTOCOLADA (numeroProtocoloConcessionaria + dataProtocolo)
    - `registrarHomologacao(envioId, cooperadoId, dto, cooperativaId)` — ⭐ **trigger ativação** + agregação status envio + emit event pós-commit
    - `cancelar(envioId, motivo, cooperativaId)` — bloqueia estados finais; append motivo em `observacoes`
    - `gerarCsv(envioId, cooperativaId)` — CSV ordenado por nome, usa **snapshot** (não recalcula contrato atual)
    - `listar(cooperativaId, filtros, paginacao)` — paginado (default 25, max 100), filtros status/usinaId/datas/search
    - `obterDetalhe(envioId, cooperativaId)` — relações completas (usina, cooperativa, validadaPor, enviadaPor, cooperados + cooperado + contrato)
  - **3 helpers privados:**
    - `carregarEnvio(envioId, cooperativaId)` — multi-tenant guard centralizado (`cooperativaId=null` = SUPER_ADMIN)
    - `gerarNumeroInterno(tx, usinaId, apelidoInterno, usinaIdFull)` — formato `LIST-{apelido||id.slice(0,6)}-YYYYMM-NNN` sequencial
    - `validarTransicao(atual, proxima)` — máquina de estados explícita (9 estados × transições permitidas)

### Backend — Trigger ativação automática (M12)

Dentro de `registrarHomologacao`, quando cooperado é HOMOLOGADO:
1. Busca contrato relacionado (`tx.contrato.findUnique`)
2. Se `contrato.status === 'PENDENTE_ATIVACAO'`: UPDATE → `status: 'ATIVO'` + `dataAtivacao: new Date()` + flag local `contratoAtivadoAgora=true`
3. Se contrato JÁ ATIVO: log warning, `contratoAtivadoAgora=false` (evita duplicação em reenvios)
4. **Após commit da tx** (evita race condition no listener): `eventEmitter.emit('envio-lista.cooperado-homologado', payload)`

### Backend — Listener WA/Email (M12)

- `backend/src/envio-lista-concessionaria/cooperado-homologado.listener.ts` — NOVO
- `@OnEvent('envio-lista.cooperado-homologado')`
- Guard 1: `contratoAtivadoAgora=false` → SKIPPED (idempotência)
- Guard 2: dados ausentes (cooperado/cooperativa/usina null) → abort com warn
- **3 camadas defense in depth** (ver bloco abaixo)
- Dispatch best-effort independente WhatsApp + Email (falha de um não bloqueia o outro)
- Log auditável EXPLÍCITO com `contatoOriginal vs contatoEnvio` + `motivo` (DEV_AMBIENTE / COOPERADO_TESTE_FLAG / PROD_REAL / BLOQUEADO_FAKE_FINAL)

### Backend — Eventos

- `backend/src/envio-lista-concessionaria/envio-lista-concessionaria.events.ts` — NOVO
- Constante `ENVIO_LISTA_EVENTS.COOPERADO_HOMOLOGADO = 'envio-lista.cooperado-homologado'`
- Interface `CooperadoHomologadoEvent` com campos: cooperativaId, cooperadoId, contratoId, envioListaId, envioListaCooperadoId, usinaId, numeroProtocolo, dataHomologacao, contratoAtivadoAgora

### Backend — Controller

- `backend/src/envio-lista-concessionaria/envio-lista-concessionaria.controller.ts` (181 linhas)
- 11 endpoints **multi-tenant via JWT** (helper `tenantId(req)` — SUPER_ADMIN bypass):
  - `GET /envios-lista/cooperados-elegiveis?usinaId=` — ADMIN/SUPER_ADMIN/OPERADOR
  - `GET /envios-lista` (listar paginado) — idem
  - `GET /envios-lista/:id` (detalhe) — idem
  - `GET /envios-lista/:id/csv` (download CSV) — idem
  - `POST /envios-lista` (criar rascunho) — ADMIN/SUPER_ADMIN
  - `PATCH /envios-lista/:id/validar` — ADMIN/SUPER_ADMIN
  - `PATCH /envios-lista/:id/marcar-pra-envio` — ADMIN/SUPER_ADMIN
  - `PATCH /envios-lista/:id/marcar-enviado` — ADMIN/SUPER_ADMIN
  - `POST /envios-lista/:id/protocolo` — ADMIN/SUPER_ADMIN
  - `POST /envios-lista/:id/homologar/:cooperadoId` — ADMIN/SUPER_ADMIN
  - `PATCH /envios-lista/:id/cancelar` — ADMIN/SUPER_ADMIN
- **Todas as rotas de mutação têm `@AuditLog`** (acao + recurso + recursoIdParam) — Bug #4 do M11 saneou 7 rotas que faltavam

### Backend — DTOs

- `backend/src/envio-lista-concessionaria/dto/`:
  - `create-rascunho.dto.ts` — usinaId, cooperadoIds[]
  - `marcar-enviado.dto.ts` — `CanalEnvio = email | portal | fisico` + observacoes
  - `registrar-protocolo.dto.ts` — numeroProtocoloConcessionaria + dataProtocolo?
  - `registrar-homologacao.dto.ts` — `StatusHomologacaoInput = HOMOLOGADO | REJEITADO` + dataHomologacao? + observacao?
  - `cancelar.dto.ts` — motivo?

Todos validados via `class-validator` (`@IsEnum`, `@IsDateString`, `@IsString`, `@MaxLength`, `@IsOptional`).

### Backend — Módulo

- `backend/src/envio-lista-concessionaria/envio-lista-concessionaria.module.ts`
- Importa `EmailModule` + `WhatsappModule` (pra listener)
- Providers: `EnvioListaConcessionariaService`, `CooperadoHomologadoListener`, `PrismaService`
- Registrado em `app.module.ts`
- `EventEmitterModule` já estava global

### Backend — Templates email

- `backend/src/email/email-templates.ts` — adicionado `templateCooperadoHomologado` (9º template do projeto): cumprimento + confirmação visual + resumo (cooperativa/usina/data/protocolo) + próximos passos SCEE + link portal
- `backend/src/email/email.service.ts` — adicionado método `enviarCooperadoHomologado(destinatario, dados, cooperativaId)` — recebe `destinatario` separado de `cooperado.email` pra permitir override do listener (defesa Camada 1+2)

### Backend — Safety helpers (descoberta D-novo-N)

- `backend/src/common/safety/ambiente.ts` — **NOVO**. Função `isAmbienteReal()` lê `process.env.AMBIENTE_REAL === 'true'` (opt-in produção, default ausente = dev fail-safe). **NUNCA usar `NODE_ENV` pra discriminar dev/prod** (PM2 força production em dev local).
- `backend/src/common/safety/whitelist-teste.ts` — edição. Adicionou `ehEmailFake()` + `ehTelefoneFake()` (Camada 3 pattern detection) + reescrita de `podeEnviarEmDev()` (whitelist dev + salvaguarda fake em prod).
- `ecosystem.config.cjs` — propaga `AMBIENTE_REAL: process.env.AMBIENTE_REAL || 'false'`
- `backend/.env.example` — documenta `AMBIENTE_REAL=true` com warning sobre PM2 forçando NODE_ENV

### Frontend — Listas Concessionária

- `web/app/dashboard/usinas/listas/page.tsx` — refatorado pra **2 abas** (Tabs Shadcn/UI):
  - **Visão geral** — tabela original de usinas com capacidade/alocação/% uso + botão "+ Novo envio" → navega pra página própria
  - **Envios em curso** — tabela de `EnvioListaConcessionaria` paginada com filtros (status, usina, datas, search) + chips de counts (pendente/homologado/rejeitado) + ação detalhe
- `web/app/dashboard/listas-concessionaria/novo/page.tsx` — **NOVO**. Página própria de criação de envio (padrão UX Tipo B — memória `padrao_ux_edicao_inline_vs_pagina_propria_17_05.md`). Lista cooperados elegíveis da usina com checkbox múltiplo + indicação visual de quem já foi enviado/homologado. Substituiu dialog apertado que era inviável pra usinas com 50-100 cooperados.
- `web/app/dashboard/listas-concessionaria/[id]/page.tsx` — **NOVO**. Tela de detalhe com timeline de estados + tabela de cooperados + 4 dialogs:
  - `DialogValidar` — confirma RASCUNHO → VALIDADA
  - `DialogMarcarEnviado` — formulário canal envio + observações
  - `DialogRegistrarProtocolo` — número protocolo concessionária + data
  - `DialogRegistrarHomologacao` — homologar/rejeitar cooperado individual com data + observação
- 1 dialog deletado em 17/05 (DialogNovoEnvio.tsx — substituído por página própria)

### Testes (M13.A — 133 cenários)

- `backend/src/common/safety/whitelist-teste.spec.ts` — **56 cenários** (isAmbienteReal + ehEmailFake + ehTelefoneFake + podeEnviarEmDev nos modos dev/prod)
- `backend/src/envio-lista-concessionaria/envio-lista-concessionaria.service.spec.ts` — **58 cenários** cobrindo 11 métodos públicos + helpers; **12 cenários no `registrarHomologacao`** (trigger ativação + agregação + emit pós-commit)
- `backend/src/envio-lista-concessionaria/cooperado-homologado.listener.spec.ts` — **19 cenários** cobrindo 3 camadas defense in depth + dispatch independente + log auditável

**Cobertura final dos 5 arquivos críticos:**

| Arquivo | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| `common/safety/ambiente.ts` | **100%** | **100%** | **100%** | **100%** |
| `common/safety/whitelist-teste.ts` | **100%** | **100%** | **100%** | **100%** |
| `envio-lista-concessionaria.service.ts` | **95.69%** | 82.89% | **100%** | **97.02%** |
| `cooperado-homologado.listener.ts` | **100%** | 92.98% | **100%** | **100%** |
| `envio-lista-concessionaria.events.ts` | **100%** | **100%** | **100%** | **100%** |

## Bug crítico D-novo-N (P0 RESOLVIDO durante M12 smoke)

**Sintoma:** smoke da Fase 4 disparou email REAL pra contato do banco do cooperado teste (`lucbragatto+fase4banco@gmail.com`) em vez do override de teste configurado.

**Causa raiz:** `ecosystem.config.cjs:36` define `env: { NODE_ENV: 'production' }` no PM2 (intencional — Nest precisa rodar `dist/` compilado com otimizações Node). Isso significa **NODE_ENV='production' SEMPRE**, em dev local E prod real. TODO check `process.env.NODE_ENV !== 'production'` estruturalmente quebrado:

- `whitelist-teste.ts:podeEnviarEmDev` retornava `true` sempre (whitelist LGPD bypassed)
- `whatsapp-sender.service.ts:80` guard nativo WA não funcionava em dev
- `email.service.ts:65` guard nativo Email não funcionava (**por isso email disparou**)
- `cooperado-homologado.listener.ts:80` (Fase 4) override sempre `PRODUCAO_REAL`

**Fix — Defense in depth 3 camadas:**

**Camada 1** — `isAmbienteReal()` lê `AMBIENTE_REAL === 'true'` (opt-in produção, default ausente = dev fail-safe). Discriminador correto que **substitui completamente** `NODE_ENV` no projeto.

**Camada 2** — `cooperado.ambienteTeste` (campo já existia no schema, agora respeitado pelo listener) força override mesmo em prod real (proteção de dados teste que vazaram pra base de produção).

**Camada 3** — `ehEmailFake()`/`ehTelefoneFake()` pattern detection final pré-dispatch:
- Email: `.invalid$`, `@removido.`, `-removido@`, `@test.`, `@example.`, `^test@`, `^fake@`, `^noreply@`, `^no-reply@`
- Telefone: < 10 dígitos, 6+ zeros, 6+ noves, padrão `9{4,}\d{0,4}0{4,}$`, prefixos fake conhecidos (`551199988`, `551199900`, `551172620`, `551175410`, `551178110`), `INATIVO-`

**Diretriz nova INEGOCIÁVEL (18/05/2026):**
- NUNCA usar `NODE_ENV` pra discriminar dev/prod no projeto. Sempre `isAmbienteReal()`.
- TODO listener/service de comunicação real DEVE ter as 3 camadas implementadas.
- Smoke validation pattern obrigatório: cooperado teste com email/telefone OBVIAMENTE FAKE no banco + confirmar logs `contatoOriginal ≠ contatoEnvio`.

Detalhe completo em memória `falha_regra_contatos_teste_18_05.md` e doc-sessão `docs/sessoes/2026-05-18-sub-fase-1-fase-4-trigger-ativacao.md`.

## Bugs adicionais resolvidos no caminho da Sub-Fase 1

| ID | Descoberto | Sev | Fix |
|---|---|---|---|
| Bug #1 | M11 (18/05 manhã via QA) | P1 BLOQUEADOR | `protocoloConcessionaria` ausente em `CooperadoCompleto` — build web travado 7 dias. Fix 1 linha. |
| Bug #1B | M11 (durante #1) | P1 | `useSearchParams` sem Suspense (Next.js 16). Fix wrapper Suspense. |
| Bug #4 | M11 (QA) | P2 | 7 rotas de mutação do envio-lista sem `@AuditLog`. Fix 7 decoradores. |
| D-novo-N | M12 smoke | P0 | NODE_ENV inútil como discriminador — fix 3 camadas (acima). |

## Decisões catalogadas durante Sub-Fase 1

- **Padrão UX dual Tipo A/B/C** (memória `padrao_ux_edicao_inline_vs_pagina_propria_17_05.md`) — Tipo B (página própria) aplicado em "Novo envio" pra suportar usinas com 50-100 cooperados
- **Regra contatos teste impreterível REFORÇADA** com 3 camadas obrigatórias (memória `regra_contato_teste_impreterivel.md` + `falha_regra_contatos_teste_18_05.md`)
- **Regra não-paralelo claude.ai × Code** (memória `regra_nao_trabalhar_paralelo_com_code_17_05.md`)
- **Snapshot imutável de cooperados** no momento da geração do envio (preserva kwhContrato/percentualUsina mesmo se contrato mudar depois)
- **`numeroInterno` formato `LIST-{apelidoInterno}-YYYYMM-NNN`** sequencial por usina × mês

## Validação

- ✅ `npx prisma db push` — schema sincronizado (aditivo puro, zero `--accept-data-loss`)
- ✅ `npx tsc --noEmit -p tsconfig.build.json` — 0 erros
- ✅ `npm run build` — silencioso clean
- ✅ PM2 restart com `AMBIENTE_REAL: false` confirmado em `pm2 env 0`
- ✅ 11 rotas `/envios-lista` mapeadas + listener `EnvioListaConcessionariaModule dependencies initialized`
- ✅ **Smoke M12 pós-fix:** Luciano confirmou WhatsApp em `27981341348` + email em `lucbragatto+homologado@gmail.com` (overrides aplicados corretamente)
- ✅ **Smoke regression M13.B:** Luciano re-validou fluxo completo via UI (criarRascunho → validar → marcarEnviado → registrarProtocolo → registrarHomologacao). Contrato virou ATIVO + dataAtivacao gravada. Logs confirmam override por Camada 1 (DEV_AMBIENTE).
- ✅ **Specs Jest M13.A:** 133/133 passing. Zero regressão no baseline (mesmas 11 falhas pré-existentes).
- ✅ `git push origin main` — todos os commits sincronizados

## Roadmap pós-Sub-Fase 1

- **Sprint 8 / Bloco E — Realocação Multi-Usina** (~16-24h Code) — prioridade subida em 18/05 (próximo marco)
- **Sprint 5a Neutro — Fio B** (calc engine FIO_B 60% 2026) — posterior
- **Sprint CT Consolidado** — Etapa 1 em pausa, Fase 1 read-only concluída
- **Sprint Módulo Documentos (Assinafy)** — Sprint Documentos catalogado
- **Sprint Módulo Compliance Fiscal** (SPED/NF3e/eSocial — D-55, ~40-60h) — separado
- **Sprint Módulo Classificação GD** — depende dossiê judicial pós AGE 17/06/2026

## Carry-over

- **Sprint Housekeeping** (~3-5h): reformat órfão stashed + LF/CRLF via `.gitattributes` + 15 scripts untracked + 13 branches órfãs + 5 worktrees + 11 specs pré-existentes failing (`cooperados/*.spec.ts` + `usinas/usinas.controller.spec.ts`)
- **HTML jornada Sugestão #6**: regenerar `docs/diagramas/jornada-membro.html` v1.X refletindo Sub-Fase 1 100%
- **D-novo-H**: refator técnico convenção MENSAL (~6-8h Code, decisão produto pré-aprovada)
- **D-novo-I**: timezone bug exibição datas (P3 UX)
