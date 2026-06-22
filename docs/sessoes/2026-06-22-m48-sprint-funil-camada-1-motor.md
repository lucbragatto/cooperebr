# M48 — Sprint Funil Camada 1 MOTOR — Roteador A/B/C advisory + AliasParceiroSisgd + LeadExpansao.converter

**Data:** 2026-06-22
**Branch:** `feature/funil-roteador-engine` (PRESERVADA no origin)
**Merge SHA na main:** `e9db14b` (--no-ff sobre `26201d8`)

## TL;DR

**Camada 1 (motor backend)** do Funil de Aquisição. `RoteamentoCadastroService.
decidirCaminho` decide entre 4 caminhos (C_NOVO / A_MIGRACAO / B_REDIRECT_PARCEIRO
/ AMBIGUO_ADMIN) baseado em 3 sinais: autodeclaração GD (M44), texto fornecedor +
lista de aliases SISGD (M48 novo), `classificacaoScee` (M48 campo aditivo, hook
deferido). Wiring **PASSIVO** em 2 pontos (`cooperados.create` + `publico.
cadastroWeb`): o motor DECIDE e GRAVA metadata em 4 campos do Cooperado, **sem
bloquear / sem redirecionar / sem disparar migração**. Enforcement vem nas
Camadas 2/3 (vitrines parceiro + SISGD marketplace) — sprints próprias.

Bonus desta sprint: model `AliasParceiroSisgd` tenant-aware (6 aliases CoopereBR
seedados), `LeadExpansao.converter()` endpoint admin (fecha gap M47 — leads
viravam status "CONVERTIDO" no comentário do schema mas nunca eram convertidos
em código). 23 specs Jest verde + smoke E2E REAL 3/3 PASS.

## Marco entregue

**M48 — Sprint Funil Camada 1 MOTOR.** 4ª das 4 sprints do convênio
cooperativizado COMPLETO:
- ✅ M44 (origem-dado)
- ✅ M46 (fundação E1+E8)
- ✅ M47 (migração G2+G5)
- ✅ **M48 (funil motor)** ← esta

**Família (Fase 2 G1+G4) DEFERIDA** até spec do orquestrador + decisão Luciano.

## Commits

| Hash | Tipo | Mensagem |
|---|---|---|
| `26201d8` | feat | feat(funil): M48 Sprint Funil Camada 1 MOTOR — Roteador A/B/C advisory + AliasParceiroSisgd + LeadExpansao.converter |
| `e9db14b` | merge | merge(funil): M48 Sprint Funil Camada 1 MOTOR (--no-ff) |

Padrão preservado: feature branch `feature/funil-roteador-engine` no origin.

## Entregas técnicas

### Fatia A — Schema delta aditivo

**Model novo `AliasParceiroSisgd`** (tenant-aware):
```prisma
model AliasParceiroSisgd {
  id, cooperativaId FK, alias (normalizado), tipo (NOME_CURTO |
  MARCA_COMERCIAL | SLUG_HISTORICO | CNPJ_SECUNDARIO), ativo, createdAt
  @@index([alias, ativo])
  @@index([cooperativaId, ativo])
}
```

**`Cooperado` += 4 campos opcionais** (advisory metadata):
- `roteamentoCaminho String?` — C_NOVO | A_MIGRACAO | B_REDIRECT_PARCEIRO | AMBIGUO_ADMIN.
- `roteamentoTenantAlvo String?` — só preenchido em B (cooperativaId do parceiro vencedor).
- `roteamentoRazao String?` — texto humano-legível pra auditoria + dashboard.
- `roteamentoDecididoEm DateTime?` — timestamp da decisão.

**`FaturaProcessada` += `classificacaoScee String?`** — campo aditivo, hook
diferido (D-novo-M48-HOOK-CLASSIFICACAO-SCEE P2).

`prisma db push` aplicado em dev — auditoria pré-aplicação confirmou 0 conflitos
(aditivo puro).

### Fatia B — RoteamentoCadastroService.decidirCaminho

`backend/src/roteamento-cadastro/roteamento-cadastro.service.ts` (~290 linhas):

**Sinais (em ordem de confiança):**
1. `jaRecebeCreditosGd` (autodeclaração M44).
2. `fornecedorGdAtual` (texto livre M44) cruzado com aliases + CNPJ direto.
3. `classificacaoScee` (opcional — hook deferido).

**Matcher (cascata):**
1. CNPJ direto: extrai 14 dígitos do texto via regex estrutural + **valida DV
   oficial Receita Federal** (`validarCnpjDv` — H2 code-reviewer; evita telefone
   como CNPJ).
2. Alias texto: `aliasParceiroSisgd.findFirst({alias: ILIKE %normalizado%, ativo:true})`
   (forward substring) OU `findMany` + iteração Node (substring inverso —
   "alias do banco contido no texto declarado"; `take: 500` + warn).
3. Filtra `Cooperativa.ativo:true` em ambos matchers (P2 multitenant).

**Cross-tenant lookup INTENCIONAL:**
- Motor varre todos os tenants pra achar qual parceiro tem o alias.
- Retorna SÓ `{caminho, tenantAlvo?, razao}` — nunca vaza `Cooperativa.nome/cnpj/etc`.
- Documentado no JSDoc + confirmado pelos 2 reviewers.

**Helpers estáticos:**
- `normalizarAlias`: lowercase + NFD + `\p{M}/gu` (M3 — robusto contra qualquer
  combining mark) + pontuação→espaço + colapsa espaços.
- `extrairCnpj`: regex estrutural + `validarCnpjDv`.
- `sanitizarTexto`: remove `<>"'\``  + trunca 100 chars (defesa XSS stored Camada 2/3).
- `validarCnpjDv`: algoritmo oficial Receita Federal.

**4 caminhos:**

| Caminho | Quando |
|---|---|
| `C_NOVO` | Sem GD ou GD não bate com SISGD ou MESMO tenant declarado |
| `A_MIGRACAO` | Recebe GD + fornecedor NÃO bate com nenhum parceiro SISGD |
| `B_REDIRECT_PARCEIRO` | Fornecedor BATE com alias/cnpj de outro parceiro SISGD ativo |
| `AMBIGUO_ADMIN` | jaRecebeCreditosGd=true mas fornecedor vazio |

### Fatia C — Wiring PASSIVO em 2 pontos

**`cooperados.controller.ts:create`** (admin autenticado):
- `decidirCaminho` chamado APÓS resolver `cooperativaId` do JWT (lição M45).
- Resultado persistido em 4 campos do Cooperado via `cooperadosService.create`.

**`publico.controller.ts:cadastroWeb`** (público):
- `decidirCaminho` chamado FORA da tx em `cadastroWeb` (linha ~300), depois de
  validar tenant (convite OU `?tenant=` validado contra `Cooperativa.ativo`).
- Passa resultado pra `cadastroWebV2` (param novo opcional `roteamento`).
- `cadastroWebV2` persiste no `tx.cooperado.create` dentro da transação.

**`cooperados.service.ts:findAll/findOne` ganharam `omit: { roteamentoTenantAlvo:
true }`** (P2 multitenant — esconder cooperativaId de outro tenant da API
admin pra evitar enumeração de parceiros).

### Fatia D — Seed AliasParceiroSisgd CoopereBR

`prisma/seed-aliases-parceiros.ts` (importa `RoteamentoCadastroService.
normalizarAlias` — L1 code-reviewer, sem duplicação):

6 aliases CoopereBR seedados (idempotente):
- `cooperebr` (NOME_CURTO)
- `coopere br` (NOME_CURTO)
- `cooperativa cooperebr` (NOME_CURTO)
- `cooperebr energia` (MARCA_COMERCIAL)
- `cooperebr energia solar` (MARCA_COMERCIAL)
- `cooperebr com br` (SLUG_HISTORICO)

Cada parceiro novo deve cadastrar seus aliases na onboarding (D-novo-M48-UI-ADMIN-ALIASES P2 catalogado).

### Fatia E — LeadExpansao.converter() endpoint admin

**`POST /lead-expansao/:id/converter`** (fecha gap M47):
- `cooperativaId` SEMPRE do JWT (lição M45). `ForbiddenException` se ausente.
- Validação body: nomeCompleto + cpf + email obrigatórios.
- Service: `leadExpansao.findFirst({where:{id, cooperativaId}})` + `$transaction`
  que cria Cooperado + atualiza lead.status='CONVERTIDO' atomicamente.
- Multi-tenant defense-in-depth: `leadExpansao.update({where:{id, cooperativaId}})`.
- **Typed errors** (H1 code-reviewer): `LeadNaoEncontradoError` +
  `LeadJaConvertidoError`. Controller usa `instanceof` (NÃO substring match).

### Fatia F — Smoke E2E REAL 3/3 PASS

`backend/scripts/smoke-m48-roteador.ts`:

1. **C_NOVO:** `decidirCaminho({jaRecebeCreditosGd:false, cooperativaIdSugerida:
   CoopereBR})` → grava `roteamentoCaminho='C_NOVO'` no Cooperado.
2. **A_MIGRACAO:** `fornecedorGdAtual='Soluna Energia Solar'` → não bate com
   alias → grava `'A_MIGRACAO'`.
3. **B_REDIRECT_PARCEIRO:** cadastro tentativo na **CoopereBR Teste** com
   `fornecedorGdAtual='CoopereBR'` → alias bate com parceiro CoopereBR → grava
   `'B_REDIRECT_PARCEIRO'` + `tenantAlvo=CoopereBR_ID`.

Cleanup idempotente.

**Motor SILENCIOSO** (sem WA/email/Asaas) — D-novo-WA-DEV-FALSE-OK precedente
NÃO se aplica. Confirmado pelos 2 reviewers.

## Testes

**23/23 Jest verde:**
- `roteamento-cadastro.service.spec.ts` (17): helpers (normalizarAlias +
  extrairCnpj com DV) + 4 caminhos + cooperativa ativo:true + multi-tenant +
  const arrays expostos.
- `lead-expansao-converter.spec.ts` (5): caminho feliz + multi-tenant + idempotência
  + cpf normalizado + body.telefone prioridade.
- +1 spec da Fatia B novo (cooperativa.ativo=false).

**Smoke E2E REAL 1/1 PASS** (executado pós-todos-fixes, com motor silencioso).

## Reviewers (2 paralelos + re-review)

| Reviewer | Veredito | Fixes pré-merge |
|---|---|---|
| `cooperebr-multitenant-reviewer` | APROVADO COM RESSALVAS | P2 #1 omit roteamentoTenantAlvo (enum prevention) FIXED; P2 #2 filtro ativo:true FIXED; P2 #3 cooperativaId no update.where FIXED; P3 sanitizarTexto FIXED |
| `code-reviewer` | WARNING (2 HIGH) → APROVADO COM RESSALVAS | H1 typed errors LeadNaoEncontradoError+LeadJaConvertidoError FIXED; H2 validarCnpjDv FIXED; M2 take:500 FIXED; M3 \p{M} FIXED; L1 seed import service FIXED; L2 spec TIPOS_ALIAS_VALIDOS FIXED |
| Re-review orquestrador | **APROVADO** | "Os fixes estão certos. Pode mergear + fechar." |

## ⚠️ DESTAQUES CRÍTICOS — BLOQUEADORES DE EXPOSIÇÃO da Camada 3 (vitrine pública)

A Camada 3 do Funil é a **vitrine SISGD marketplace + cadastro público**.
Antes de expor publicamente, o **Hardening Lateral** é PRÉ-REQUISITO OBRIGATÓRIO.

**Spoofs anônimos / autenticados acumulados:**

| Débito | Severidade | Onde | Origem |
|---|---|---|---|
| `D-novo-LEAD-EXPANSAO-PUBLIC-TENANT-SPOOF` | **P1** | `POST /lead-expansao` `@Public()` aceita body.cooperativaId | **3ª ocorrência mesmo spoof M45.** Descoberto na review M48; pré-existente. |
| `D-novo-CADASTRO-COMPLETO-TENANT-SPOOF` | P1 | `cooperados.service.ts:495` | M45 lateral |
| `D-novo-MOTOR-PROPOSTA-PLANO-CROSS-TENANT` | P1 | `motor-proposta.service.ts:584` | M45 lateral |
| `D-novo-AUDITLOG-TENANT-ALVO-SA` | P1 | `audit-log.interceptor.ts:41-42` | M45 lateral |
| `D-novo-HARDENING-CONTROLLERS-LATERAIS` | P1 | asaas + condominios + convite-indicacao | M45 lateral |
| `D-novo-CONVENIO-UPDATE-SEM-COOPID` | P2 | `convenios-membros.service.ts:182` | M46 carry |
| `D-novo-CONVENIO-LISTAR-MEMBROS-SEM-COOPID` | P2 | `convenios-membros.service.ts:280` | M46 carry |
| `D-novo-M47-DESLIGADO-SALDO-RESIDUAL` | P2 | `migracao-externa.service.ts:rejeitar` | M47 |
| `D-novo-M47-MSG-MULTI-TENANT-PARCEIRO` | P2 | mensagens WA hardcodam "CoopereBR" | M47 |

**Conclusão:** Hardening Lateral fecha 4 P1 + 4 P2 + 1 P1 M48 (pode entrar
junto). Estimativa total ~10-14h. **Vitrine pública (Camada 3) NÃO arranca
sem isso.**

## Débitos novos M48

### ✅ RESOLVIDOS desta sprint

- `D-novo-ROTEADOR-CADASTRO-CENTRAL` P1 → resolvido (Camada 1 motor).
- `D-novo-LEAD-EXPANSAO-CONVERTER` P1 → resolvido (endpoint admin).
- `D-novo-JA-RECEBE-CREDITOS-GD-PASSIVO` P2 → resolvido (agora ATIVO no motor).
- `D-novo-LISTA-ALIASES-PARCEIROS-SISGD` P2 → resolvido (model + seed).

### Catalogados (próximos)

| Débito | Severidade | Para qual sprint |
|---|---|---|
| `D-novo-M48-HOOK-CLASSIFICACAO-SCEE` | P2 | Sprint Pipeline OCR + Concierge Integration |
| `D-novo-M48-UI-ADMIN-ALIASES` | P2 | UI admin pra cadastrar aliases por tenant |
| `D-novo-M48-TIPO-ALIAS-VALIDACAO` | P3 | Validação runtime do const array TIPOS_ALIAS_VALIDOS |
| `D-novo-M48-AUTO-INSCREVER-SEM-ROTEADOR` | P3 | Camada 2 — decisão produto se convite público chama roteador |
| `D-novo-M48-ALIAS-FTS` | P3 | Se aliases > 500 — full-text search ou trigram index |

### Da Sprint Roteador (ainda abertos pra Camadas 2/3)

- `D-novo-ADAPTER-EXTRAI-CNPJ-GERADOR` P2 — extrair CNPJ do gerador GD na fatura concierge.
- `D-novo-FATURA-PROCESSADA-CLASSIFICACAO-SCEE` P2 — campo persistido, hook OCR ausente.
- `D-novo-LEAD-WHATSAPP-VS-EXPANSAO-CONFUSAO` P3 — 2 modelos quase iguais.
- `D-novo-CROSS-TENANT-NOTIFICATION` P3 — caminho B precisa redirect cross-tenant.

## Próximo passo

**Decisão Luciano fila completa:**
- ✅ M48 (funil motor) — fechado nesta sessão.
- **Próximo: Sprint Convênio FAMÍLIA (Fase 2 — G1 vínculo familiar + G4 consumo
  declarado → token).** Com a **conversibilidade do token CONFIGURÁVEL** (decisão
  Luciano):
  - Default: **abate-fatura não-conversível** (saldo só usa em fatura própria
    ou familiar).
  - Opcional: **saque gated** (reusa infra D2 saque colaborador M41 + flag
    `.env` por tenant).
- **DEPENDE de:** orquestrador formalizar **spec da família** primeiro (G1 amarra
  empresa↔familiar; G4 mecânica de conversão consumo declarado kWh → tokens; flag
  configurável por tenant; parecer trabalhista pra liberar produção).

**Camadas 2/3 do Funil (vitrines):** BLOQUEADAS pelo **Hardening Lateral**
(pré-exposição obrigatória — ver destaques acima).

**Outras alternativas catalogadas:**
- Sprint Hardening Lateral (~10-14h) — fast-follow recomendado.
- Sprint Pipeline OCR + Concierge Integration (hook classificacaoScee).
- D-QUALIF-DECAY + Notificações Proativas seguem catalogadas.

## Decisões catalogadas nesta sessão

1. **D22/06-FUNIL-1 — Roteador é PASSIVO/ADVISORY only.** Decide + grava
   metadata em 4 campos do Cooperado. NÃO bloqueia, NÃO redireciona, NÃO
   dispara migração. Enforcement vem nas Camadas 2/3.
2. **D22/06-FUNIL-2 — Model novo AliasParceiroSisgd tenant-aware** (em vez de
   campo array em Cooperativa ou lista global hardcoded). Permite auditoria +
   UI admin futura.
3. **D22/06-FUNIL-3 — `classificacaoScee` aditivo agora, hook deferido.** Sprint
   Pipeline OCR+Concierge bridge mapeará DadosExtraidos (Claude OCR) →
   FaturaRawInput (concierge adapter).
4. **D22/06-FUNIL-4 — DV oficial do CNPJ** (`validarCnpjDv`) evita telefone como
   CNPJ. Algoritmo Receita Federal.
5. **D22/06-FUNIL-5 — Cross-tenant lookup INTENCIONAL no roteador.** Documentado;
   retorno opaco (só tenantAlvo+razao sem dados sensíveis).
6. **D22/06-FUNIL-6 — `omit` no findAll/findOne** esconde `roteamentoTenantAlvo`
   da API admin (anti-enumeração de parceiros SISGD).
7. **D22/06-FUNIL-7 — Typed errors em LeadExpansao.converter** — instanceof no
   controller, sem substring match frágil.
8. **D22/06-FUNIL-8 — Hardening Lateral é PRE-REQUISITO da Camada 3** (vitrine
   pública). 4 P1 + 4 P2 + 1 P1 M48 acumulados.
9. **D22/06-FUNIL-9 — `auto-inscrever` (convite público) NÃO chama roteador**
   nesta sprint. TODO inline + débito P3 catalogado pra decisão produto Camada 2.

## Regras aplicadas

- ✅ Decisão 23 — Fase 1 read-only focada nos 4 pontos f-j confirmados.
- ✅ Lição M45 inegociável — `cooperativaId` SEMPRE do JWT (3 endpoints novos +
  LeadExpansao.converter).
- ✅ Padrão M39-M47 — branch dedicada → reviewers pesados → re-review
  orquestrador → smoke real → merge --no-ff → branch preservada.
- ✅ Princípio multi-tenant 17/05 — aliases tenant-aware (não hardcoded).
- ✅ CLAUDE.md regra schema — auditoria prévia (0 conflitos esperados, aditivo).
- ✅ Motor silencioso — sem WA/email/Asaas, sem dinheiro → financeiro-token-
  reviewer NÃO obrigatório.

## Frase comandante

Ver `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code`
(M48 atualizada, M47 arquivada).
