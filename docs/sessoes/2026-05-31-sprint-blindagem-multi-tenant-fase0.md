# Sprint Blindagem Multi-Tenant (D-novo-BR) — Fase 0 — 31/05/2026

## TL;DR

Sessão Code do dia entregou a **Fase 0 do Sprint Blindagem Multi-Tenant** — fix manual em lote de 26 IDORs (19 Onda A + 7 críticos Onda B) usando o padrão consolidado em D-novo-BQ. Auditoria expandida revelou **68 IDORs sistêmicos** (18 já corrigidos em BQ.1-BQ.4, 50 pendentes); Fase 0 elimina **52% dos IDORs restantes** num único dia. Decisão arquitetural híbrida catalogada em `docs/arquitetura/blindagem-multi-tenant-sistemica.md` (5 fases: F0 fix manual ✅, F1 AsyncLocalStorage, F2 Prisma Extension, F3 residuais, F4 testes). **55 specs verdes + 23 cenários runtime cross-tenant validados em smoke programático**. Total IDOR specs do projeto: **111 verdes** (56 BQ + 55 BR F0).

## Marco entregue

**M20 — Sprint Blindagem Multi-Tenant Fase 0** — 26 IDORs corrigidos em 5 sub-fatias atômicas (F0.1 → F0.5).

## Commits do dia

| Hash (esperado) | Mensagem |
|---|---|
| (este) | docs(seguranca): relatórios IDOR Onda A + B + decisão arquitetural blindagem |
| (este) | fix(seguranca): D-novo-BR F0 — 26 IDORs (19 Onda A + 7 críticos Onda B) |
| (este) | docs(fechamento): Sprint Blindagem Multi-Tenant F0 + cataloga D-novo-BR |

## Entregas técnicas

### Auditorias expandidas (D-novo-BR base)

Dois Dynamic Workflows complementares ao núcleo (BQ.1-BQ.4):

- **Onda A** (25 sub-agentes, 1.242.427 tokens, ~3.4 min) — 20 módulos secundários alto risco. Resultado: 19 IDORs (2 críticos + 12 altos + 4 médios + 1 baixo) em administradoras, documentos, ocorrências, prestadores, modelos-cobrança, condomínios, observador. 8 módulos LIMPOS (cooperativas, convenios×3, clube-vantagens, conversao-credito, convite-indicacao, contas-pagar, bandeira-tarifaria, planos, alocacao).
- **Onda B** (45 sub-agentes) — infra/gateways/whatsapp/notificações. 31 IDORs (7 críticos + 16 altos + 8 médios) em notificacoes, asaas, integracao-bancaria, whatsapp, monitoramento-usinas, email, email-monitor.

**Quadro total sistema:** 18 núcleo (BQ.1-BQ.4 ✅) + 19 Onda A + 31 Onda B = **68 IDORs**. 18+26=44 corrigidos após Fase 0. Restam 24 (Onda B altos+médios) → defer pra D-novo-BR Fase 3.

### Decisão arquitetural — Híbrido faseado

`docs/arquitetura/blindagem-multi-tenant-sistemica.md` mapeou 4 opções e escolheu **Híbrido (Extension + fixes pontuais)** em 5 fases. Cobertura final 68/68 IDORs:

| Fase | Cobre | Esforço | Status |
|---|---|---|---|
| F0 — Fix manual 26 críticos | 26/50 | ~2-3h | ✅ |
| F1 — AsyncLocalStorage + escape hatch `runAsPlatform()` | base pra F2 | 3-4 dias | 📋 |
| F2 — Prisma Client Extension auto-injeta cooperativaId nos ~52 models | ~40-45 | 2-3 dias | 📋 |
| F3 — Residuais via-relação (~18) + body-injection (~8) + EmailLog schema | ~26 | 1-2 dias | 📋 |
| F4 — Teste regressão multi-tenant + spec cross-tenant abrangente | — | 1-2 dias | 📋 |

**Armadilhas catalogadas:**
- Crons + webhooks sem request HTTP — Extension cega quebra. `runAsPlatform()` é pré-requisito.
- Não migrar os 18+26 manuais pra Extension — defesa em profundidade.
- Body-injection nenhuma query layer resolve — sempre controller-side.
- Performance — Extension roda em TODA query.

### Fase 0 — 5 sub-fatias

| Sub-fatia | IDORs | Módulos | Specs novas |
|---|---|---|---|
| F0.1 | 6 | administradoras (CA1+CA2+AA1), modelos-cobranca (AA9+AA10+AA11) | 14 |
| F0.2 | 4 | documentos (AA2+AA3+AA4+MA1) | 6 |
| F0.3 | 6 | ocorrencias (AA5+AA6+MA2), prestadores (AA7+AA8+MA3) | 10 |
| F0.4 | 4 | condominios (MA4+BA1), observador (AA12), lead-expansao* | 6 |
| F0.5 | 7 | notificacoes (CRITICO), asaas (CRITICO), integracao-bancaria 3 (CRITICOS), whatsapp 2 (CRITICOS) | 19 |
| **Total** | **26** (lead-expansao OOS) | 10 módulos | **55** |

*lead-expansao POST `@Public` (cadastro pelo bot WA sem JWT) — não é IDOR clássico, requer guard diferente. Anotado pra F3.

### Padrões consolidados (4 categorias)

1. **Posse direta** (`findFirst({where: {id, cooperativaId}})` + null bypass via `findUnique`) — F0.1 admins, F0.3 ocorrencias/prestadores, F0.5 integracao-bancaria.
2. **Posse via relação** (`findFirst({where: {id, <rel>: {cooperativaId}}})`) — F0.2 documentos (cooperado), F0.5 asaas (cooperado).
3. **Body-injection → JWT** (helper `resolverTenant`, ADMIN sempre JWT, SA pode body) — F0.1 administradoras.create, F0.4 condominios.create, F0.5 integracao-bancaria.criarConfig.
4. **Global-only-SA** (cooperativaId null = recurso compartilhado entre tenants, só SUPER_ADMIN pode alterar) — F0.1 modelos-cobranca.ativar/desativar (impacto sistêmico), F0.5 whatsapp DELETE modelos.

### Detalhamento crítico F0.5

**A6+A7 patrão (asaas + integracao-bancaria) — bloquear ANTES de side-effect externo:**
- `asaas.cancelarCobranca` — valida `cobranca.cooperado.cooperativaId === user.cooperativaId` antes de `client.delete()`. SA bypass descobre tenant da cobrança pra `getApiClient(cooperativaIdEfetiva)`.
- `integracao-bancaria.cancelarCobranca` — `findOne(id, cooperativaId)` joga `NotFoundException` antes de `bbService.cancelarBoleto`/`sicoobService.cancelarBoleto`. Boleto bancário é IRREVERSÍVEL — bloqueio antes da API banco é essencial.
- `integracao-bancaria.criarConfig` — DTO removeu `cooperativaId`; controller passa do JWT (config armazena clientId/secret/PFX — body-injection equivalia a admin A criar credenciais bancárias apontando pra tenant B).

**Notificacoes (CRITICO buildWhere)** — `marcarComoLida(id, user)` chama `buildWhere(user)` (existente pra `findAll`/`countNaoLidas`), faz `findFirst` com `id` + filtro de tenant, e em caso de posse negada faz NO-OP SILENCIOSO (não diferencia "não existe" de "não é seu" → evita leak de existência).

**Whatsapp DELETE modelos (CRITICO regra global)** — modelo com `cooperativaId=null` é template compartilhado entre todos tenants. ADMIN A não pode deletar (Forbidden), só SUPER_ADMIN. Modelo tenant-scoped: só o dono ou SA.

**Whatsapp disparar-cobrancas (CRITICO body.parceiroId)** — ADMIN A passava `body.parceiroId=<tenant-B>` e o sistema disparava WhatsApp de cobrança com valores/PIX/links Asaas pra TODOS cooperados do tenant B. Fix: `body.parceiroId !== JWT.cooperativaId` exige perfil SUPER_ADMIN.

## Bugs/regressões observadas

- Nenhuma regressão. Specs antigos continuam verdes (BQ.1-BQ.4: 56 verdes mantidos).
- 10 erros TS pré-existentes em `backend/src/agents/` (módulo experimental untracked, sequer está no git) — não relacionados; build do NestJS emite `dist/` mesmo assim, backend roda OK na porta 3000.

## Decisões estratégicas catalogadas

Memórias atualizadas: nenhuma nova; decisão arquitetural já catalogada em `docs/arquitetura/blindagem-multi-tenant-sistemica.md` (vai pra leitura prévia da próxima sessão).

## Validação

- **55/55 specs F0** verdes (11 arquivos `*-idor-br.spec.ts`).
- **111/111 specs IDOR total** verdes (56 D-novo-BQ + 55 D-novo-BR F0).
- **23/23 cenários runtime** cross-tenant validados em smoke programático (`scripts/smoke-br-f0-idor.ts`) contra Postgres real. Cleanup automático.
- Asserções runtime críticas: administradora B intacta após ataque; cobrança bancária B continua PENDENTE; modelo whatsapp B/global NÃO deletados por ADMIN; notificação B NÃO marcada como lida cross-tenant; config bancária B clientId NÃO substituído; criarConfig usa cooperativaId injetado (não body); ocorrência B intacta; prestador B intacto; observação B ainda ativa.

## Próximo passo

**Opções a decidir com Luciano** (em ordem natural):

1. **D-novo-BR F1 — Fundação AsyncLocalStorage** (~3-4 dias) — Interceptor abre contexto de tenant por request; helper `runWithTenant()` + escape hatch `runAsPlatform()` pra crons/webhooks. Base obrigatória pra F2.
2. **D-novo-BR F2 — Prisma Client Extension** (~2-3 dias) — Injeta `cooperativaId` automático nos ~52 models com campo direto. Previne reincidência (endpoint novo já nasce protegido).
3. **F.4 — Smoke E2E pós-BR F0** (~1-2h) — 10 fluxos críticos pra garantir caminho feliz após os 26 patches (cobranças, ativações, vincular fatura, alocar usina, aprovar proposta, cancelar boleto, etc).
4. **Sprint Contabilidade Tributária Segregada** (#8 roadmap, ~40-60h).
5. **Convergência portal `/parceiro` vs `/dashboard`** (D-novo-BP P3, ~20-30h).

**Recomendação implícita:** F1 (próxima fase natural da arquitetura blindagem) ou F.4 (validar caminho feliz antes de mais cirurgia).

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` — frase de retomada atualizada
- `docs/sessoes/2026-05-31-sprint-blindagem-multi-tenant-fase0.md` (este)
- `docs/debitos-tecnicos.md` — seção D-novo-BR (F0 ✅, F1-F4 abertos)
- `docs/arquitetura/blindagem-multi-tenant-sistemica.md` (se F1)

## Carry-overs (não-bloqueantes)

- 10 erros TS pré-existentes em `backend/src/agents/` (untracked) — out-of-scope deste sprint.
- lead-expansao POST `@Public` — guard diferente (rate-limit), Fase 3 D-novo-BR.
- EmailLog schema sem `cooperativaId` — adicionar campo + migration na F3.
- 24 IDORs altos+médios Onda B (monitoramento-usinas, email, asaas listar, whatsapp listas/fluxos/etc) — defer F3 ou após F2 Extension.
- usinas.controller.spec.ts pré-existente (carry-over Sprint IDOR D-novo-BQ).

## Regras aplicadas na sessão

- **Decisão 23 — Fase 1 read-only obrigatória** antes de cada sub-fatia (4 leituras: admin/modCob, documentos, ocorrencias/prestadores, observador).
- **Padrão D-novo-BQ replicado** mecanicamente; novos sub-padrões (Global-only-SA) emergiram pra modelo-cobranca/whatsapp.
- **Backwards-compat preservada** via condicional `cooperativaId ? findFirst : findUnique`.
- **SUPER_ADMIN bypass** protegido em todos os 26 fixes.
- **Smoke runtime obrigatório** ao final, sem chamada externa real (BB/Sicoob/Asaas mockados).
- **Contatos teste 27981341348 + lucbragatto@gmail.com** — não aplicado (sprint não disparou comunicação real).

## Frase comandante

```
PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior).
   Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents disponíveis.

2. Rodar `git status --short`. Esperado pós-fechamento: working tree limpo
   (untracked carry-overs catalogados), último commit é o de fechamento BR F0.

3. Rodar `pm2 list`. Esperado: cooperebr-backend + frontend online.

PASSO 1 — Frase de retomada principal:

Sessão 31/05 entregou M20 — Sprint Blindagem Multi-Tenant Fase 0
(D-novo-BR F0) em 3 commits. 26 IDORs corrigidos em 5 sub-fatias
atômicas (F0.1+F0.2+F0.3+F0.4+F0.5): 19 da Onda A (administradoras,
documentos, ocorrencias, prestadores, modelos-cobranca, condominios,
observador) + 7 críticos da Onda B (notificacoes, asaas, integracao-
bancaria 3, whatsapp 2). 4 padrões consolidados: posse direta, posse
via relação, body→JWT (helper resolverTenant), global-only-SA.
55 specs F0 verdes; 111 specs IDOR total verdes (56 BQ + 55 BR F0).
23 cenários runtime cross-tenant validados em smoke programático
(scripts/smoke-br-f0-idor.ts). Auditorias completas (Onda A 19 +
Onda B 31) catalogadas. Decisão arquitetural híbrida em 5 fases
(F0 ✅, F1 AsyncLocalStorage, F2 Prisma Extension, F3 residuais,
F4 testes) em docs/arquitetura/blindagem-multi-tenant-sistemica.md.

Próxima sessão Code: Luciano escolhe entre (1) D-novo-BR F1 fundação
AsyncLocalStorage + escape hatch runAsPlatform (~3-4d), (2) F2
Prisma Client Extension auto-inject (~2-3d, requer F1), (3) F.4
smoke E2E pós-BR F0 (~1-2h), (4) Sprint Contabilidade Tributária
(#8 roadmap), (5) convergência /parceiro vs /dashboard (D-novo-BP).

Pré-requisitos leitura: docs/CONTROLE-EXECUCAO.md + docs/sessoes/
2026-05-31-sprint-blindagem-multi-tenant-fase0.md + docs/debitos-
tecnicos.md seção D-novo-BR + (se F1) docs/arquitetura/blindagem-
multi-tenant-sistemica.md.

Carry-overs: 10 erros TS pré-existentes em backend/src/agents/
(untracked); lead-expansao POST Public requer guard diferente F3;
EmailLog schema sem cooperativaId F3; 24 IDORs Onda B altos+médios
defer F3.

Diretrizes aplicáveis: Decisão 23 Fase 1 read-only antes de tocar
código; ritual fechamento bilateral; contatos teste 27981341348
+ lucbragatto@gmail.com pra qualquer disparo real; F1+F2 obrigam
revisão da implementação (escape hatch é pré-requisito não opcional).
```
