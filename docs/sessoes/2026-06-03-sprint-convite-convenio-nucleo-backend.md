# Sessão 03/06 — Sprint Convite-Convênio: Núcleo Backend Completo (Fatias 1 + 2a + 2b + 2c + 2c.1 + 3)

## TL;DR

Sessão Code maratona que entregou o **núcleo backend completo** do Sprint Convite-Convênio (6 fatias de trabalho + 1 chore higiene). Saímos do schema delta da Fatia 1 (fechada no fim do 02/06) até a aprovação 3 portas operacional ponta-a-ponta na Fatia 3. Convite per-recipient via WhatsApp + OTP de 6 dígitos prova posse do telefone + auto-inscrever atômico em `$transaction Serializable` + empresa confirma via magic link + admin aprova/solicita-doc/rejeita via dashboard. 5 smokes vivos reais (3 com WhatsApp disparado pro Luciano) + 85 specs novos verdes + zero regressão em 187 specs da suite convenios + 8 erros de build atemporais sob exclude permanente.

## Marco entregue

**Sprint Convite-Convênio — Núcleo Backend Seguro**:
- Fatia 1 (já no commit anterior `12bff1e` da sessão 02/06): schema delta
- Fatia 2 (já em `030b22d`): admissão pública inicial PENDENTE (descartada na Fatia 2c.1 — feature flag desliga + endpoint refatorado)
- **Fatia 2a (`d6a4a50`)**: ConviteConvenioMembro per-recipient + envio WA + feature flag CONVITE_OTP_ATIVO
- **Fatia 2b (`29e01c0`)**: OTP 6 dígitos sha256+salt rotativo + envio WA pro telefone DO CONVITE
- **Fatia 2c (`4c3ee0a`)**: /auto-inscrever exige `token`+`otp` validado (30min) + tenant resolvido do convite
- **Fatia 2c.1 (`e4c7348`)**: hardening atomicidade — Cooperado + Membro + magic link + consume-once numa única tx Serializable
- **chore (`7b14287`)**: tsconfig.build + .gitignore ignoram `tmp_*.ts` e `*smoke*.ts` (anti build-poison)
- **Fatia 3 (`c432cb8`)**: aprovação 3 portas — empresa magic link + admin dashboard (aprovar/solicitar-doc/rejeitar/reenviar/cleanup)

## Commits do dia (7)

| Hash | Tipo | Mensagem curta |
|---|---|---|
| `d6a4a50` | feat | Fatia 2a — convite per-recipient (token + WA) + feature flag OTP |
| `29e01c0` | feat | Fatia 2b — OTP solicitar/validar por WhatsApp (prova de posse) |
| `4c3ee0a` | feat | Fatia 2c — auto-inscrever exige convite+OTP, resolve tenant do convite, consume 1x |
| `e4c7348` | fix | Fatia 2c.1 — auto-inscrever atomico (Cooperado+Membro+magic link+consume numa tx) |
| `7b14287` | chore | build — ignorar tmp_*.ts e *smoke*.ts pra prevenir build-poison |
| `c432cb8` | feat | Fatia 3 — aprovação 3 portas (empresa magic link + admin dashboard) |
| _(será gerado)_ | docs | fechamento sessão 03/06 |

## Entregas técnicas

### Schema delta (`prisma db push` aditivo)

**Fatia 2a** (`d6a4a50`):
- Model NOVO `ConviteConvenioMembro` (20 colunas) — convenioId + cooperativaId + nomeConvidado + telefone (E.164 BR) + token + expiresAt + usedAt + 8 campos OTP dormentes + cross-ref opcional `membroId` + audit. `@@unique([convenioId, telefone])` + index `[token]`, `[telefone]`, `[cooperativaId, createdAt]`.
- Back-rels: `ContratoConvenio.convitesMembro[]` + `ConvenioCooperado.convite?`.

**Fatia 3** (`c432cb8`):
- `ConvenioCooperado` +3 campos: `documentacaoSolicitadaEm DateTime?`, `aprovadoPorAdminUserId String?` (rel Usuario), `rejeitadoPorAdminUserId String?` (rel Usuario).
- `Usuario` +2 back-rels (audit).

Total schema delta da sessão: 1 model NOVO + 3 colunas em ConvenioCooperado. 100% aditivo. **215 membros + 3 convênios + 0 convites vivos intactos**.

### Backend — 2 services novos, 11 endpoints

**`ConvitesConvenioService`** (Fatia 2a, 350+ linhas):
- `normalizarTelefoneBR(input)` estático (E.164 BR)
- `criarConvite` com reuse-if-alive
- `validarToken` (defesa LGPD)
- `marcarUsado` / `cancelar` / `reenviarConvite`
- `enviarLinkPorWhatsapp` (best-effort)
- **Fatia 2b ampliou** com: `gerarCodigoOtp` / `gerarSaltOtp` / `hashOtp` / `compararOtp` (timingSafeEqual) + `solicitarOtp` / `validarOtp` (cooldown 60s + max 5 tentativas + bloqueio 1h + max 3 reenvios).

**`ConvenioAprovacaoService`** (Fatia 3, 550+ linhas):
- `validarTokenAprovacao` (defesa LGPD sufixos)
- `decidirAprovacaoEmpresa` ($tx Serializable + single-use atômico)
- `aprovarPorAdmin` (GUARD strict: só PENDENTE_APROVACAO_ADMIN)
- `solicitarDocumentacao` (upsert N DocumentoCooperado)
- `rejeitarPorAdmin` (audit userId obrigatório)
- `reenviarAprovacaoEmpresa` (regen token + WA)
- `listarPendentes` (paginado, defesa LGPD)
- `cleanupPendente` (hard delete PENDENTE_*/REJEITADO_*/DESLIGADO)

**11 endpoints novos (5 admin + 6 público):**

Admin (`@Roles @TenantResource @AuditLog`):
```
Fatia 2a:
- POST   /convenios/:id/convites
- GET    /convenios/:id/convites
- DELETE /convenios/:id/convites/:conviteId
- POST   /convenios/:id/convites/:conviteId/reenviar

Fatia 3:
- GET    /convenios/:id/membros-pendentes
- POST   /convenios/:id/membros/:membroId/aprovar-admin
- POST   /convenios/:id/membros/:membroId/solicitar-documentacao
- POST   /convenios/:id/membros/:membroId/rejeitar-admin
- POST   /convenios/:id/membros/:membroId/reenviar-aprovacao-empresa
- DELETE /convenios/:id/membros/:cooperadoId  ← refinado (rota por status)
```

Público (`@Public + @Throttle`):
```
Fatia 2a:
- GET  /publico/convites/:token

Fatia 2b:
- POST /publico/convites/:token/solicitar-otp  (5/min IP)
- POST /publico/convites/:token/validar-otp     (10/min IP)

Fatia 2c.1:
- POST /publico/convenios/auto-inscrever        (30/h IP, $tx Serializable)

Fatia 3:
- GET  /publico/aprovacao-membro/:token         (30/min IP)
- POST /publico/aprovacao-membro/:token         (10/min IP, audit IP+UA)
```

### Atomicidade — `$transaction Serializable` em todos os pontos críticos

**Fatia 2c.1 fix de hardening** — `/auto-inscrever` antes criava Cooperado, depois chamava adicionarMembro SEM tx → janela onde Membro podia nascer sem AprovacaoConvenioMembro (magic link). Solução: única `$transaction Serializable` envolvendo:
1. consume-once `aprovacao.usedAt` via update `where {id, usedAt:null}` (P2025 = race 409)
2. cooperado.create (P2002 = 409 genérico anti-enumeration)
3. `conveniosMembros.adicionarMembro(tx, 'CONVITE_PUBLICO')` que cria Membro PENDENTE + AprovacaoConvenioMembro NO MESMO tx
4. cross-ref convite.membroId

Removidos: `rollbackConviteUsedAt` helper + `cooperado.delete .catch` compensatório. Rollback nativo do Postgres faz o trabalho.

**Fatia 3 replicou padrão** — `decidirAprovacaoEmpresa` + `aprovarPorAdmin` + `solicitarDocumentacao` + `rejeitarPorAdmin` + `cleanupPendente` todos em `$transaction(IsolationLevel.Serializable)`. updateMany com `where status=X` em vez de update — guard adicional contra race entre load e tx.

### Política OTP

| Const | Valor |
|---|---|
| `OTP_TTL_MIN` | 10 min |
| `OTP_MAX_TENTATIVAS` | 5 (bloqueio 1h) |
| `OTP_MAX_REENVIOS` | 3 |
| `OTP_COOLDOWN_SEG` | 60 |
| `OTP_BLOQUEIO_HORAS` | 1 |

Hash sha256(codigo+salt) com salt rotativo + `crypto.timingSafeEqual` constant-time.

### State machine ConvenioCooperado (Fatia 3 cravou)

```
PENDENTE_APROVACAO_EMPRESA (criado pelo auto-inscrever)
    ├─ empresa magic link APROVAR → PENDENTE_APROVACAO_ADMIN
    ├─ empresa magic link REJEITAR → MEMBRO_REJEITADO_EMPRESA + motivo
    ├─ admin DELETE → cleanupPendente (hard delete + AprovacaoConvenioMembro + clear cross-ref)
    └─ admin REENVIA → regen token + WA

PENDENTE_APROVACAO_ADMIN
    ├─ admin APROVA → MEMBRO_ATIVO + ativo=true (ENTRA na consolidada)
    ├─ admin SOLICITA DOC → mantém status + documentacaoSolicitadaEm + N DocumentoCooperado PENDENTE
    └─ admin REJEITA → MEMBRO_REJEITADO_ADMIN + audit userId

MEMBRO_ATIVO
    └─ admin DESLIGAR (legado removerMembro) → MEMBRO_DESLIGADO + ativo=false

MEMBRO_REJEITADO_* / MEMBRO_DESLIGADO → terminais (DELETE = cleanupPendente)
```

**GUARD strict (decisão Luciano): admin NÃO PULA empresa.** Em PENDENTE_APROVACAO_EMPRESA admin só DELETE/REENVIAR.

### UI HELP textos (regra 19/05, pra Fatias 4-5 implementar)

| Tela | Texto |
|---|---|
| **Magic link empresa** | *"Você está confirmando que **[nome]** é seu funcionário/médico. Ao **CONFIRMAR**, ele entra no convênio e a energia dele passa a ser custeada pela sua empresa. Ao **RECUSAR**, ele não é incluído. Ex: confirme só quem realmente trabalha na sua empresa."* |
| **Admin aprovar** | *"Ativa o membro custeado — a partir daqui ele entra na cobrança consolidada da empresa."* |
| **Admin solicitar doc** | *"Pede documentos ao cooperado antes de aprovar (ex: RG + contrato social)."* |
| **Admin rejeitar** | *"Recusa o cadastro (ex: dados não conferem). O cooperado é avisado com o motivo."* |

### Higiene build (chore `7b14287`)

`tsconfig.build.json` ganhou exclude `tmp_*.ts`, `**/tmp_*.ts`, `**/*smoke*.ts`. `.gitignore` bloqueia commits acidentais. Limpou 5+5 arquivos órfãos no root do backend. Causa raiz da incidência repetida de "build passou mas dist velho" durante a sessão.

## Bugs resolvidos / catalogados

| ID | Problema | Solução |
|---|---|---|
| **HOTFIX inline** | tmp_smoke*.ts órfãos com erros TS quebravam o build inteiro | `tsconfig.build.json` + `.gitignore` excluem `tmp_*` e `*smoke*` |
| **HOTFIX Fatia 2c** | motor.aceitar rejeitava `valorCooperado<0` quando `consumoMedioKwh=0` no caminho CONVITE_PUBLICO → Membro nunca era criado | Mudou: auto-inscrever NÃO delega mais pra cadastroWebV2; cria Cooperado direto (`tipoCooperado=SEM_UC`) + chama `adicionarMembro` (que cria PENDENTE + magic link) — UC/Contrato vêm na aprovação |
| **HARDENING Fatia 2c.1** | adicionarMembro SEM tx fazia 2 statements separados (Membro + AprovacaoConvenioMembro) → janela de Membro órfão sem magic link | $transaction Serializable única envolvendo consume-once + cooperado + adicionarMembro(tx) + cross-ref. Removido helper compensatório `rollbackConviteUsedAt`. |
| **HOTFIX Fatia 3** | Endpoint integrado spec batia 429 throttle entre runs jest | Removido spec integrado HTTP; substituído por smoke vivo ts-node + 26 specs unit do service |

## Smokes vivos rodados (5 totais)

1. **Fatia 2b** — `5527981341348` recebeu WhatsApp com código OTP REAL (commit `29e01c0`).
2. **Fatia 2c smoke E2E** — `/auto-inscrever` cria Cooperado + Membro PENDENTE + AprovacaoConvenioMembro + convite.usedAt em uma chamada.
3. **Fatia 2c.1 atomicidade** — spec integrado 3/3 verde (sucesso atômico + rollback total + consume-once race).
4. **Fatia 2c.1 smoke** — Promise.all não simula race (Prisma serializa driver-level — limitação registrada).
5. **Fatia 3 aprovação empresa** — magic link → POST APROVAR → status muda + IP/UA capturados + 2º POST 409 single-use.

## Specs novos (85 totais + zero regressão)

| Spec | Cenários | Status |
|---|---|---|
| `convenios-membros-origem.spec.ts` (Fatia 1) | 11 | ✅ |
| `convites-convenio.service.spec.ts` (Fatia 2a) | 25 | ✅ |
| `convites-convenio-otp.spec.ts` (Fatia 2b) | 23 | ✅ |
| `publico-auto-inscrever-atomico.spec.ts` (Fatia 2c.1) | 3 | ✅ |
| `convenios-aprovacao.service.spec.ts` (Fatia 3) | 26 | ✅ |
| **Suite convenios completa** | **187** | ✅ |

## Estado atual

- **Backend do Sprint Convite-Convênio = 100% funcional.** Núcleo seguro atômico fechado.
- **Convênio médico continua usável** (Caso 1 D-FISCAL-2.4 intacto).
- **CV-2026-0001 ainda aguardando smoke E2E real Luciano** (carry-over da sessão anterior).
- **Frontend ZERO** — todos os endpoints estão sem UI ainda.
- **Notificações WA/email ricas pendentes** (Fatia 6 — atual só dispara gatilhos in-app via `NotificacoesService.criar`).
- **Portal self-service da empresa** = Fatia 9 futura (depende de provisionar Usuário PJ pra pagadorCooperado).

## Decisões catalogadas

| # | Decisão | Tipo |
|---|---|---|
| Auth empresa | HÍBRIDO magic link no núcleo + portal login futuro (Fatia 9) | arquitetural |
| Admin não pula empresa | Strict — só age em PENDENTE_APROVACAO_ADMIN | produto |
| SEM_UC rejeitado | Fica PENDENTE pro admin (não cancela cadastro) | produto |
| Invite link | NÃO STATELESS — model ConviteConvenioMembro per-recipient phone-bound | arquitetural (mudou da Fase 1 anterior depois do refinamento WA+OTP) |
| Rate-limit | 30/h IP + manual count manual (3-60/h por contexto) | segurança |
| Quota | `limiteMembros` + `kwhAlocadoMaxMensal` opcionais | produto |
| Documentação | Reusar enum `TipoDocumento` existente (admin escolhe lista) | produto |
| Magic link single-use TTL 7d | espelho `ConviteProprietarioService` M31 | arquitetural |
| Consume-once atômico | `update where {usedAt:null}` + P2025 race; tudo em $tx Serializable | segurança |
| Build hygiene | `tmp_*.ts` + `*smoke*.ts` no exclude+.gitignore | operacional |

## Pré-requisitos leitura próxima sessão

1. `docs/CONTROLE-EXECUCAO.md` (ONDE PARAMOS + FRASE DE RETOMADA)
2. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md`
3. Este doc (`2026-06-03-sprint-convite-convenio-nucleo-backend.md`)
4. `docs/sessoes/2026-06-02-convenio-medico-finalizacao-e-convite-fase1.md` (Fatia 1 schema)
5. `backend/src/convenios/convites-convenio.service.ts` (Fatias 2a+2b — convite + OTP)
6. `backend/src/convenios/convenios-aprovacao.service.ts` (Fatia 3 — fluxo aprovação)
7. `backend/src/publico/publico.controller.ts` (6 endpoints @Public da sprint)
8. `backend/src/convenios/convenios.controller.ts:451-636` (5 endpoints admin Fatia 3)
9. `backend/prisma/schema.prisma:1490-1530` (ConvenioCooperado campos Fatia 1+3) + `:1565-1620` (ConviteConvenioMembro + AprovacaoConvenioMembro)
10. `docs/debitos-tecnicos.md` (3 débitos novos catalogados ontem)

## Carry-overs (não-bloqueantes)

- **Smoke E2E real CV-2026-0001 Caso 1 custeio** — Luciano manual.
- **Fatia 4 frontend** — `/convite/[token]` 3 etapas (validar token → solicitar OTP → preencher dados → auto-inscrever).
- **Fatia 4 frontend** — `/aprovacao-membro/[token]` página da empresa decidir.
- **Fatia 5 dashboard** — Tela admin "Membros pendentes" do convênio (lista + botões aprovar/solicitar-doc/rejeitar/reenviar).
- **Fatia 6 notificações** — WA + email ricos (templates). Hoje só in-app via `NotificacoesService.criar`.
- **Fatia 7 portal UX custeado** — banner "você é custeado pela empresa X" + empty states (D-novo-PORTAL-CUSTEADO P2).
- **Fatia 8 specs amplos + smoke E2E manual final**.
- **Fatia 9 futura** — Portal self-service da empresa conveniada (depende de provisionar Usuário PJ).
- **D-novo-CONVITE-F3-CRON-LIMPEZA-PENDENTE P2** — cron diário que expira pendentes > 7d.
- **D-novo-AGENTS-ORPHAN P3** — pasta `src/agents` órfã com 15 erros TS (excluída do build mas ainda no repo).
- **D-novo-UX-Dialog-Backdrop P3 + D-novo-CT-TARIFA-ALOCACAO P3 + D-novo-CT-PDF-AUXILIAR P2 + D-novo-CT-VALIDACAO-FISCAL P0 + D-novo-BM P0 + D-novo-BP P3** — débitos catalogados pré-existentes.
- 256 legados allowlist lint:tenant.
- Convenção MENSAL (Mini-Bloco H'.9 17/05) ainda não aplicada — 2 usinas em ANUAL.

## Regras aplicadas na sessão

- Decisão 23 (Fase 1 read-only obrigatória) — aplicada 4 vezes (Fatia 2 inicial + reframe OTP + Fatia 2c + Fatia 3).
- Decisão 24 (frase de retomada local único) — preservada.
- Regra rebuild backend + verificar dist (post-hotfix das sessões anteriores) — aplicada em cada commit (grep no dist após `npm run build`).
- Regra `isAmbienteReal()` em endpoints dev.
- Regra contatos teste 14/05 (`27981341348` + `lucbragatto@gmail.com`) — usado nos 5 smokes vivos.
- Regra HELP obrigatório 19/05 — textos de help cravados pra Fatias 4-5 implementarem.
- Padrão ConviteProprietarioService M31 (token stateless 64 hex + TTL 7d + idempotência reuso) — espelhado em 2 services.
- Schema aditivo sem `--accept-data-loss` em todas as migrations.
- `$transaction Serializable` em todas as transições críticas (5 services novos).
- `@TenantResource + @AuditLog` em todos os handlers admin novos.

## Frase comandante (próxima sessão)

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](../CONTROLE-EXECUCAO.md#frase-de-retomada--próxima-sessão-code) do `CONTROLE-EXECUCAO.md` (Decisão 24 — local único, atualizada 03/06 noite no fechamento desta sessão).

## Próximo passo

**Fatia 4 — frontend** das 2 páginas públicas do fluxo:
- `/convite/[token]` (3 etapas: validar token → solicitar OTP → preencher dados → auto-inscrever)
- `/aprovacao-membro/[token]` (página empresa decidir APROVAR/REJEITAR)

Pré-requisito: Fase 1 read-only mapear UI/UX existente do projeto (padrões shadcn + selects nativos + HelpBox + 3 banners feedback regra 19/05).
