# M51 — Sprint Hardening Lateral — 23/06/2026

## TL;DR

Sprint de blindagem de tenant-spoof / IDOR acumulados. Pré-requisito da
Camada 3 do funil (vitrine pública) + 2º parceiro real. Fechou 4 P1 lateral
M45 + 1 P1 M48 (lead-expansao spoof anônimo) + 4ª ocorrência descoberta
(pre-cadastro-proxy) + 2 P2 M46 convênio + AUDITLOG SA tenant-alvo + asaas
explicit guard. Atestado @Public completo (40 endpoints em 10 controllers)
sem nenhum 🔴 PRECISA-FIX. 3 reviewers + re-review orquestrador (2 condições
extras aplicadas). Smoke E2E REAL 8/8 verde com cleanup.

## Marco entregue

**M51 — Sprint Hardening Lateral** (anti tenant-spoof e IDOR autenticados +
ATESTADO @Public completo + blindagem do túnel pra abrir cadastro público).

## Commits do dia

| Hash | Mensagem |
|---|---|
| `<feat-sha>` | feat(hardening): M51 Sprint Hardening Lateral — anti tenant-spoof + IDOR fix |
| `<docs-sha>` | docs(sessao): fechamento M51 |
| `<merge-sha>` | merge(hardening): M51 — feature/hardening-lateral → main |

## Entregas técnicas

### Bloco 0 — Varredura @Public (steer extra do orquestrador)

40 endpoints @Public em 10 controllers classificados. **Achado novo**:
`cooperados.controller.ts:62 pre-cadastro-proxy` era 4ª ocorrência do spoof
anônimo M45 (aceitava `body.cooperativaId` direto pro DB). Incluído no Bloco A.

### Bloco A — @Public anônimos (descartar body.cooperativaId + ?tenant=)

- **`lead-expansao.controller.ts`** POST `@Public`: body.cooperativaId
  DESCARTADO via destructure (`{cooperativaId: _ignored, ...safeBody}`).
  `?tenant=` opcional, validado `findUnique({id, ativo:true})`. Sem tenant
  → cooperativaId=null (lead órfão; admin/funil roteia depois). Tenant fake
  → 404 anti-enumeração. `@Throttle 10/min`.
- **`cooperados.controller.ts:pre-cadastro-proxy`** POST `@Public` (NOVO descoberto):
  mesmo pattern. `?tenant=` obrigatório (pre-cadastro precisa de tenant
  alvo). Body cooperativaId DESCARTADO. `@Throttle 10/min`.
- **Condição 1 (re-review)**: `preCadastroProxy` service agora valida
  `indicadorId.cooperativaId === cooperativaId` resolvido. NotFoundException
  se mismatch (anti-enumeração).

### Bloco B — autenticados P1

- **`cadastroCompleto`**: antes `dto.cooperativaId || jwtCoopId` permitia
  ADMIN spoofar (dto vencia). Agora:
  - Se body.cooperativaId presente E ≠ JWT → `assertSameTenantOrSuperAdmin`
    (SA livre; ADMIN só própria; outros perfis com guard estrito).
  - Se body.cooperativaId == JWT → preserva role-set (OPERADOR/ADMIN passam
    quando coincide com próprio tenant — fix P2 security re-review).
  - Service recebe `cooperativaIdAlvo: string` obrigatório; todos FK
    (uc/contrato/usina/listaEspera) usam ele.
- **`motor-proposta.service.ts`**: 3 buscas de plano (calcular/calcularComPlano/
  aceitar) agora `findFirst({where: {id, ativo:true, OR: [{cooperativaId},
  {cooperativaId: null}]}})` (plano global + próprio tenant). SA undefined
  → cross-tenant intencional preservado.
- **`novaUcComFatura` + `confirmarNovaUc`** (P2 re-review): COOPERADO chamava
  `motor-proposta.calcular` sem passar cooperativaId. Agora passa
  `cooperado.cooperativaId` + fallback `plano.findFirst` filtrado por tenant.

### Bloco C — AUDITLOG-TENANT-ALVO-SA

- **`audit-log.decorator.ts`** += `cooperativaIdSource?: string` (
  `'param:<key>' | 'body:<key>' | 'query:<key>' | 'response:<key>'`).
- **`audit-log.interceptor.ts`** += função pura exportada
  `resolveCooperativaIdAlvoAudit(meta, jwtCoopId, req, response)`. JWT
  prevalece; só consulta source quando JWT vazio (SA cross-tenant).
- Aplicado em `cadastroCompleto` (`cooperativaIdSource: 'body:cooperativaId'`)
  e `asaas.salvarConfig` idem.

### Bloco D — asaas explicit guard

- `salvarConfig`/`getConfig`/`testarConexao`: agora
  `assertSameTenantOrSuperAdmin(req.user, body.cooperativaId)` quando body/
  query presente. P1 re-review: `testarConexao` ganhou null-guard
  (BadRequestException sem cooperativaId — antes Prisma `undefined` ignorava
  filtro e retornava qualquer AsaasConfig).
- Condominios + convite-indicacao já tinham SA-only — confirmados, sem fix.

### Bloco E — Convênio defense-in-depth

- `convenios.service.ts:update` aceita `cooperativaIdJwt?` e chama
  `findOne(id, jwt)` interno.
- `convenios-membros.service.ts:listarMembros` filtra
  `where: { convenioId, convenio: { cooperativaId: jwt } }` quando jwt vem.
- **Bonus (re-review P2)**: `convenios.service.ts:remove` agora também aceita
  `cooperativaIdJwt?` e chama `findOne(id, jwt)` (simetria com update).

### Bloco F — Throttle + cobrança média cross-tenant

- `@Throttle({default: {limit: 10, ttl: 60000}})` nos 2 novos @Public.
- `motor-proposta.calcular` cobrança média: `cobranca.findMany` agora filtra
  `contrato.cooperativaId: jwt` (antes misturava tenants, vazando
  estatística na precificação).

## Atestado @Public completo (Condição 2 re-review)

| Categoria | Qtde |
|---|---|
| auth-sem-write-tenant | 7 |
| read-only | 5 |
| token-based (single-use) | 14 |
| webhook-assinado (HMAC/secret) | 5 |
| cadastro-fechado-M45 (sprints anteriores) | 2 |
| **fixado-nesta-sprint** | **2** (lead-expansao + pre-cadastro-proxy) |
| safe (sem cooperativaId no schema) | 5 |
| 🔴 PRECISA-FIX | **0** |

**Total 40 endpoints — todos tenant-safe.** Túnel pronto para abrir
cadastro público + Camada 3 vitrine.

## Reviewers consultados (3 + re-review)

| Reviewer | Veredito | Achados |
|---|---|---|
| `cooperebr-multitenant-reviewer` | APROVADO com 4 P2 + 1 P3 | 4 fixed; 1 deferido (TOCTOU remove) |
| `security-reviewer` | WARNING → APROVADO | 3 P1 + 4 P2 + 3 P3; 6 fixed; 1 catalogado P2 |
| `code-reviewer` | WARNING → APROVADO | 3 P1 + 4 P2 + 5 P3; 5 fixed; resto catalogado |
| **Orquestrador (re-review)** | APROVADO com **2 condições** | C1 indicadorId service-level + C2 atestado @Public — TODAS aplicadas |

### Fixes aplicados pós-reviewers (10)

| # | Achado | Sev | Fix |
|---|---|---|---|
| 1 | testarConexao sem null guard | P1 | BadRequestException + assert |
| 2 | convenios.service.remove sem DiD | P2 | aceita cooperativaIdJwt + findOne(id, jwt) |
| 3 | novaUcComFatura/confirmarNovaUc plano cross-tenant | P2 | passa cooperado.cooperativaId + fallback filtrado |
| 4 | @Throttle ausente nos novos @Public | P2 | 10/min explícito |
| 5 | OPERADOR no cadastroCompleto inconsistente | P2 | guard só dispara se body ≠ jwt |
| 6 | calcularComPlano sem ativo:true | P3 | adicionado |
| 7 | cobranca média cross-tenant motor-proposta | P2 | filtro contrato.cooperativaId |
| 8 | Typos comentários | P3 | corrigidos |
| 9 | **F2 indicadorId service-level (Condição 1)** | P1 | findFirst({id, cooperativaId}) + 404 anti-enumeração |
| 10 | **Atestado @Public completo (Condição 2)** | — | tabela 40/40 — 0 PRECISA-FIX |

## Bugs resolvidos / catalogados

| Débito | Severidade | Status |
|---|---|---|
| `D-novo-LEAD-EXPANSAO-PUBLIC-TENANT-SPOOF` P1 | — | RESOLVIDO (Bloco A) |
| `D-novo-PRE-CADASTRO-PROXY-PUBLIC-TENANT-SPOOF` P1 (descoberto pela varredura) | — | RESOLVIDO (Bloco A + Cond.1) |
| `D-novo-CADASTRO-COMPLETO-TENANT-SPOOF` P1 | — | RESOLVIDO (Bloco B) |
| `D-novo-MOTOR-PROPOSTA-PLANO-CROSS-TENANT` P1 | — | RESOLVIDO (Bloco B) |
| `D-novo-AUDITLOG-TENANT-ALVO-SA` P1 | — | RESOLVIDO (Bloco C) |
| `D-novo-HARDENING-CONTROLLERS-LATERAIS` P1 (asaas) | — | RESOLVIDO (Bloco D) |
| `D-novo-CONVENIO-UPDATE-SEM-COOPID` P2 | — | RESOLVIDO (Bloco E) |
| `D-novo-CONVENIO-LISTAR-MEMBROS-SEM-COOPID` P2 | — | RESOLVIDO (Bloco E) |
| `D-novo-PLANOCONTAS-CODIGO-NAO-MULTITENANT` (M50) | — | RESOLVIDO em M50 |

## Novos débitos catalogados (4 — todos follow-up, não bloqueadores)

- **D-novo-AUDITLOG-FAILURE-PATH** P2 — `tap` do interceptor só dispara em sucesso. SA cross-tenant write que FALHA não deixa trail. Catalogado como follow-up; não é anônimo (acesso já restrito por JWT).
- **D-novo-AUDIT-CooperativaIdSource-TYPE-STRENGTHENING** P3 — tipo `string` permite `'malformado'`. Template literal type union (`\`param:${string}\` | ...`) catcharia ao compile-time. Cosmético.
- **D-novo-CUID-FORMAT-VALIDATION-PUBLIC** P3 — `tenantParam` chega ao Prisma sem format guard (`/^c[a-z0-9]{24}$/`). Defense-in-depth; Prisma já parametriza com segurança.
- **D-novo-CONVENIO-REMOVE-TOCTOU** P3 — `findOne` + 2 updates não-transacionais. Low-prob; relevante com pool externo.
- **D-novo-AUDITLOG-50-ENDPOINTS-RETROATIVO** P3 — aplicar `cooperativaIdSource` retroativo nos 50+ endpoints `@AuditLog` que SA-cross-tenant (deferido pelo orquestrador).

## Verificação técnica

- **Specs novas Hardening (3 suites)**: 21 + 3 (pre-cadastro-proxy.hardening) = **24/24 ✅**
- **Regressão (M50+M49+F4+D2+listener+token-contabil — 11 suites)**: **120/120 ✅**
- **Total**: **123/123 ✅**
- **TS check** arquivos da sprint: **0 erros**
- **Smoke E2E REAL anônimos** (CoopereBR Teste, cooperado FRESCO criado e deletado):
  - LEAD-EXPANSAO 4/4: órfão / 404 fake / real ignora body / órfão sem nada ✅
  - PRE-CADASTRO-PROXY 4/4: 400 sem tenant / 404 fake / **404 indicadorId cross-tenant (Condição 1)** / real usa real ✅
  - Cleanup: 3 leads + 1 cooperado deletados

## Próximo passo

**🟢 TÚNEL PRONTO PRA ABERTURA.** Hardening Lateral fechou todos os
bloqueadores. Próximas opções:

- **Camadas 2/3 do Funil** — vitrines parceiro + SISGD marketplace
  (desbloqueadas; spec do orquestrador).
- **Sprint FAXINA Fases C-G** — melt/painel/reconciliação (gated parecer
  Walter pra ativação receita real).
- **Onboarding 2º parceiro real** — Santi/outros.
- **Sprint Pipeline OCR + Concierge** — hook classificacaoScee (M48
  deferido).

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` — frase comandante M51
- `docs/sessoes/2026-06-23-m51-sprint-hardening-lateral.md` (este doc)
- `docs/debitos-tecnicos.md` — débitos novos M51 + acumulados

## Carry-overs (não-bloqueantes)

- D-novo-AUDITLOG-FAILURE-PATH P2, D-novo-CUID-FORMAT-VALIDATION-PUBLIC P3,
  D-novo-CONVENIO-REMOVE-TOCTOU P3, D-novo-AUDITLOG-50-ENDPOINTS-RETROATIVO P3.
- Faxina Fases C-G aguardam decisão de ordem (vs Camadas 2/3).
- Parecer Walter + tributarista pendente pra ativação melt em produção.
- Itens "antes de empresa-cooperada PJ real" (M47/M49) seguem catalogados.

## Regras aplicadas

- Decisão 23 — Fase 1 read-only obrigatória (mapeamento + classificação +
  perguntas decisórias antes de tocar código).
- Lição M45 inegociável — `cooperativaId` sempre do JWT (ou ?tenant=
  validado), nunca do body.
- Padrão M45 destructure-discard `{cooperativaId: _ignored, ...safeBody}`.
- Cleanup smoke obrigatório com cooperado FRESCO (lição M49).
- Pattern M-canônico fechamento — doc-sessão + débitos + CONTROLE +
  frase comandante + merge `--no-ff`.
- 3 reviewers paralelos + re-review orquestrador + 2 condições extras
  aplicadas antes do merge.

## Frase comandante pra próxima sessão Code

```
HARDENING LATERAL FECHADO ✅ — túnel pronto pra abrir cadastro público.
Atestado @Public 40/40 endpoints classificados, 0 PRECISA-FIX.

Convênio cooperativizado funcional COMPLETO (M44+M46+M47+M48+M49) +
Faxina Contábil Fase A/B (M50) + Hardening Lateral (M51).

PRÓXIMO — escolha do orquestrador entre:

(A) Camadas 2/3 do Funil — vitrines parceiro + SISGD marketplace
    (desbloqueadas pelo Hardening; precisa de spec do orquestrador).
(B) Sprint FAXINA Fases C-G — melt/painel/reconciliação (gated Walter).
(C) Onboarding 2º parceiro real — Santi ou outro.
(D) Sprint Pipeline OCR + Concierge — hook classificacaoScee M48 deferido.

LER PRIMEIRO:
- docs/sessoes/2026-06-23-m51-sprint-hardening-lateral.md (estado pós-M51)
- docs/CONTROLE-EXECUCAO.md
- docs/debitos-tecnicos.md (4 débitos novos M51 catalogados)
```
