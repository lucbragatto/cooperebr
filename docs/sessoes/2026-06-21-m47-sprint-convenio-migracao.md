# M47 — Sprint Convênio MIGRAÇÃO — G2 estados + G5 doc + ciclo admin-manual + smoke real

**Data:** 2026-06-21
**Branch:** `feature/convenio-migracao` (PRESERVADA no origin)
**Merge SHA na main:** `f36782b` (--no-ff sobre `5ee0aff`)

## TL;DR

Sprint Fase 3 do design do convênio cooperativizado (19/06) — finaliza o
**convênio COMPLETO**. Mecânica admin-manual de migração de cooperado de
distribuidora/cooperativa CONCORRENTE → SISGD. **Sem roteador A/B/C** (deferido
como Sprint Roteador+Funil própria, aguarda spec do orquestrador + decisão de
produto do Luciano). Schema delta aditivo (2 enum values + 5 campos opcionais
em MigracaoUsina + 2 indexes). 3 endpoints admin (`/migrar`, `/migrar/concluir`,
`/migrar/rejeitar`) com `cooperativaId` SEMPRE do JWT (lição M45). 2 guards
billing MUST-FIX (cobrancas.service.create + convenios-custeio.gerarCobranca
Consolidada filtram cooperados em PENDENTE_MIGRACAO/DESLIGADO). Cron timeout 30d
com AuditLog + WA admin. Seed ModeloDocumento DESLIGAMENTO_CONCORRENTE
**tenant-agnóstico** (`{{provedora.*}}` em branco — princípio multi-tenant
templates 17/05). 30 specs Jest verde + smoke E2E REAL passou (2 WAs reais
ENVIADA pro whitelist 27981341348).

## Marco entregue

**M47 — Sprint Convênio MIGRAÇÃO.** 3ª das 3 sprints do convênio cooperativizado:
- ✅ M44 (slice origem-dado)
- ✅ M46 (fundação E1 + E8)
- ✅ **M47 (migração G2 + G5)** ← esta

**Família (Fase 2 — G1) DEFERIDA** até parecer trabalhista do Luciano (token
paga conta de luz = risco salário in natura agravado CLT 458).

## Commits

| Hash | Tipo | Mensagem |
|---|---|---|
| `5ee0aff` | feat | feat(convenio): M47 Sprint Convênio MIGRAÇÃO — G2 estados + G5 doc + ciclo admin-manual + smoke real |
| `f36782b` | merge | merge(convenio): M47 Sprint Convênio MIGRAÇÃO (--no-ff) |

Padrão preservado: feature branch `feature/convenio-migracao` no origin.

## Entregas técnicas

### Fatia A — Schema delta aditivo

`prisma/schema.prisma`:
- `StatusCooperado` += `PENDENTE_MIGRACAO` + `DESLIGADO` (comentado com
  intent: saldo congela via STATUS_PERMITIDOS_CREDITO; bot WA matcher inclui
  PENDENTE_MIGRACAO, exclui DESLIGADO).
- `MigracaoUsina`:
  - Campos pré-existentes mantidos nullable (compat com `tipo='MUDANCA_USINA'`
    intra-coop).
  - Novos opcionais: `distribuidoraOrigem`, `numeroUcOrigem`, `dataInicioMigracao`,
    `dataDesligamentoEfetivo`, `statusMigracao` (String livre, validado por const
    array `STATUS_MIGRACAO_VALIDOS` — decisão Q6 orquestrador).
  - 2 indexes compostos: `[cooperativaId, statusMigracao]` + `[statusMigracao, dataInicioMigracao]`.
- `prisma db push` aplicado em dev. Auditoria pré-aplicação: 349 cooperados,
  zero em estados que adicionei. Aditivo puro — zero risco de quebra.

### Fatia B — Guards billing MUST-FIX (double-charge)

`backend/src/cobrancas/cobrancas.service.ts:185-198` (POST /cobrancas admin):
- Rejeita create se `cooperado.status IN ('PENDENTE_MIGRACAO','DESLIGADO')`.
- Mensagem clara apontando `/migrar/concluir` como caminho de saída.

`backend/src/convenios/convenios-custeio.service.ts` (fluxo automático mensal):
- Linha 274 (`previewKwhConsolidado.membros`): adicionado filtro
  `cooperado: { status: { notIn: ['PENDENTE_MIGRACAO','DESLIGADO'] } }`.
- Linha 916 (`gerarCobrancaConsolidada.membrosCount`): mesmo filtro pra paridade.
- Membro em migração **não entra na consolidada** (evita double-charge:
  cooperado ainda recebe créditos da concorrente E receberia cobrança SISGD na
  mesma janela = dupla alocação SCEE Lei 14.300 Art. 14).

### Fatia C — MigracaoExternaService + 3 endpoints admin

`backend/src/migracoes-usina/migracao-externa.service.ts` (NOVO, ~330 linhas):

| Método | Pré-condição | Pós-condição |
|---|---|---|
| `iniciar(cooperativaId, cooperadoId, distribuidoraOrigem, ...)` | cooperado existe no tenant + status != PENDENTE_MIGRACAO/DESLIGADO | MigracaoUsina(tipo='DISTRIBUIDORA_EXTERNA', statusMigracao='PENDENTE') + Cooperado.status='PENDENTE_MIGRACAO'. WA inicial. |
| `concluir(cooperativaId, cooperadoId)` | cooperado em PENDENTE_MIGRACAO + MigracaoUsina PENDENTE existe | statusMigracao='CONCLUIDA' + dataDesligamentoEfetivo + Cooperado.status='ATIVO'. WA conclusão. |
| `rejeitar(cooperativaId, cooperadoId, motivo)` | idem concluir + motivo ≥ 5 chars | statusMigracao='REJEITADA' + Cooperado.status='DESLIGADO'. WA rejeição. **AuditLog forense se saldo > 0** (passivo travado P2 financeiro-token). |

`backend/src/cooperados/cooperados.controller.ts` (+ 3 endpoints):
- `POST /cooperados/:id/migrar` (iniciar)
- `POST /cooperados/:id/migrar/concluir`
- `POST /cooperados/:id/migrar/rejeitar`
- `cooperativaId` SEMPRE do `req.user.cooperativaId` (lição M45 — sem fallback
  pro body). `ForbiddenException` se ausente (inclusive pra SUPER_ADMIN sem
  contexto de tenant — operação SENSÍVEL exige contexto explícito).
- `realizadoPorId` extraído do JWT pra auditoria.
- `@AuditLog` decorator + roles `SUPER_ADMIN | ADMIN | OPERADOR`.

**Multi-tenant defense-in-depth (P1 multitenant 21/06):** todos os 6
`prisma.cooperado.update` + `prisma.migracaoUsina.update` incluem
`cooperativaId` no where (não confiam apenas no findFirst anterior).

**alterarStatusLote guarded (P1 code-reviewer 21/06):** rejeita
`PENDENTE_MIGRACAO`/`DESLIGADO` via endpoint de lote — único caminho legítimo
de entrada é `/migrar`. Preserva invariante "status PENDENTE_MIGRACAO ↔
MigracaoUsina pendente existir".

### Fatia D — Cron timeout 30d

`backend/src/migracoes-usina/migracao-externa.job.ts` (NOVO, ~180 linhas):
- `@Cron('0 7 * * *')` diário.
- Lista `MigracaoUsina(tipo='DISTRIBUIDORA_EXTERNA', statusMigracao='PENDENTE',
  dataInicioMigracao < 30d atrás)`.
- Por linha: emit `MigracaoPendenteTimeoutEvent` + AuditLog forense
  (`usuarioId='SYSTEM_CRON'`, `usuarioPerfil='SYSTEM'`) + WA admin do tenant.
- WA admin via `findFirst({orderBy:{createdAt:'asc'}})` — **determinístico**
  (P3 financeiro-token: chega pro admin primário/fundador, não arbitrário).
- **SEM rollback automático** — admin decide manual (sensível demais).
- Comentário INTENCIONAL no findMany sem cooperativaId (cron de plataforma —
  P3 multitenant 21/06).

### Fatia E — Seed ModeloDocumento + matcher

`prisma/seed-modelos.ts` — template novo `DESLIGAMENTO_CONCORRENTE`:
- **Tenant-agnóstico** (princípio multi-tenant templates 17/05): variáveis
  `{{provedora.nome}}`, `{{provedora.cnpj}}`, `{{provedora.endereco}}` etc em
  BRANCO — cada parceiro preenche.
- Cláusulas: objeto, responsabilidade pela representação junto à concessionária,
  não-duplicidade Lei 14.300/2022 Art. 14, ausência de pendências, vigência.
- Referencia REN ANEEL 1.000/2021 SCEE + Lei 14.300/2022 MMGD.
- Seed aplicado em dev (idempotente via upsert).

`backend/src/cooperados/cooperado-matcher.helper.ts`:
- `STATUS_COOPERADO_ATIVOS` += `PENDENTE_MIGRACAO` (cooperado em migração
  continua recebendo mensagens do bot).
- `DESLIGADO` NÃO incluído (terminal — decisão Q1 orquestrador).

### Fatia F — Smoke E2E REAL (exigência re-review)

`backend/scripts/smoke-m47-migracao.ts`:

1. **Setup:** cooperado-teste whitelist `27981341348` + CPF sintético
   `88877766622` + email `lucbragatto+smoke-m47-migracao@gmail.com` + status=ATIVO.
2. **Etapa 1 — POST /migrar:** confirma resp `status='PENDENTE'`, banco
   `Cooperado.status='PENDENTE_MIGRACAO'`, **MensagemWhatsapp gravada
   tipoDisparo='MIGRACAO_EXTERNA_INICIADA' status='ENVIADA' real** (sleep 4s
   pra dar tempo do registrar async).
3. **Etapa 2 — POST /migrar/concluir:** confirma resp `status='CONCLUIDA'`,
   banco `Cooperado.status='ATIVO'`, `MigracaoUsina.statusMigracao='CONCLUIDA' +
   dataDesligamentoEfetivo` setada, **MensagemWhatsapp 'MIGRACAO_EXTERNA_CONCLUIDA'
   status='ENVIADA'**.
4. **Cleanup:** apaga MigracaoUsina + Cooperado smoke (idempotente).

**Resultado: 1/1 PASS.** WAs reais pro Luciano (verificável no celular).
D-novo-WA-DEV-FALSE-OK descartado.

## Testes

**30/30 Jest verde:**
- `cobrancas-m47-billing-guard.spec.ts` (4)
- `convenios-custeio-m47-billing-guard.spec.ts` (3)
- `migracao-externa.service.spec.ts` (18 — caminho feliz + multi-tenant +
  AuditLog forense saldo residual + cooperativaId no WA metadata + best-effort)
- `migracao-externa.job.spec.ts` (5 — detecção + sem telefone + falha WA +
  múltiplos tenants + orderBy determinístico)

**Smoke E2E real 1/1 PASS** (`scripts/smoke-m47-migracao.ts`).

## Reviewers (3 paralelos + re-review orquestrador)

| Reviewer | Veredito | Fixes pré-merge |
|---|---|---|
| `cooperebr-multitenant-reviewer` | APROVADO COM RESSALVAS | P1 6 updates sem cooperativaId → FIXED; P2 cooperativaId no WA metadata → FIXED; P3 comentário INTENCIONAL no cron → FIXED |
| `cooperebr-financeiro-token-reviewer` | APROVADO COM RESSALVAS | FUNDACAO §4#1 preservada; E3 confirmado em 7 pontos do circuito; P3 orderBy determinístico → FIXED; P2 AuditLog saldo residual → FIXED |
| `code-reviewer` | WARNING → APROVADO COM RESSALVAS | P1 STATUS_MIGRACAO_VALIDOS comentário → FIXED; P1 alterarStatusLote guard → FIXED; P1 spec assert cooperativaId → FIXED; P1 DTOs class-validator → CATALOGADO |
| **Re-review orquestrador** | **APROVADO** | "Smoke real cumpriu exigência. Pode mergear + fechar." |

## O QUE FECHOU (✅) vs CATALOGADO

### ✅ DÉBITOS RESOLVIDOS nesta sprint

| Débito | Origem | Como resolvido |
|---|---|---|
| `D-novo-CONVENIO-G2-ESTADOS-MIGRACAO` P2 | Design 19/06 §7 | StatusCooperado += PENDENTE_MIGRACAO/DESLIGADO + MigracaoUsina externa + 3 endpoints |
| `D-novo-CONVENIO-G5-DOC-DESLIGAMENTO` P3 | Design 19/06 §7 | Seed ModeloDocumento DESLIGAMENTO_CONCORRENTE tenant-agnóstico |
| `D-novo-CONVENIO-E2-MIGRACAO-FALHA-SEM-ROLLBACK` P2 | Design 19/06 §7 | **MITIGADO** — cron timeout 30d + AuditLog + WA admin. Rollback fica MANUAL por design (sensível demais) |

### ⚠️ DESTAQUES — "OK pro piloto Santi, FECHAR ANTES de escalar"

Conforme re-review orquestrador, **2 débitos** precisam atenção antes de
escalar pra 2º+ parceiro real:

#### **D-novo-M47-DESLIGADO-SALDO-RESIDUAL** P2

`migracao-externa.service.ts:rejeitar` deixa cooperado DESLIGADO com saldo de
token positivo congelado. AuditLog forense **mitiga** (rastreabilidade), mas
**não resolve**: tokens ficam permanentemente inacessíveis.

**Inconsistência com a promessa E1 do M46** ("seus tokens continuam seus" no
desligamento de convênio): aqui, `DESLIGADO` via rejeição de migração trava
tudo. Precisa rota de uso/devolução **antes** de confiar em DESLIGADO com
saldo > 0.

Opções pra próxima sprint:
- (a) Endpoint admin `POST /cooperados/:id/resgatar-saldo-residual` (PIX out).
- (b) Migrar saldo pra indicador (MLM).
- (c) Liquidação contábil via voucher cooperativa (FUNDACAO §4#1 ajuste).

#### **D-novo-M47-MSG-MULTI-TENANT-PARCEIRO** P2

3 textos WA (`notificarInicio`, `notificarConclusao`, `notificarRejeicao`) +
WA admin do cron hardcodam **"CoopereBR"**. Correto pro piloto (Santi é
conveniada da CoopereBR), MAS:

**Viola regra de vocabulário multi-tipo CLAUDE.md** + **BLOQUEIA onboarding
Consórcio/Associação/Condomínio**. Fix obrigatório antes de qualquer 2º
parceiro real do SISGD.

Fix: trocar "CoopereBR" por `cooperativa.nome` dinâmico (busca prévia ou
parameterizar nos métodos).

### Outros débitos novos catalogados

| Débito | Severidade | Origem |
|---|---|---|
| `D-novo-M47-RACE-CONSOLIDADA` | P2 | Financeiro-token — janela estreita admin-driven |
| `D-novo-M47-DTOS-INICIAR-REJEITAR` | P2 | Code-reviewer — class-validator faltando (service cobre validação) |
| `D-novo-M47-CRON-IDEMPOTENCIA` | P2 | Code-reviewer — single-node hoje |
| `D-novo-M47-HELPER-TENANT-CTX` | P3 | Code-reviewer — duplicação 3 endpoints |
| `D-novo-M47-CONCLUIDO-REJEITADO-POR-ID` | P3 | Code-reviewer — schema delta futuro |
| `D-novo-M47-CRON-TIMEZONE` | P3 | Code-reviewer — explicitar BRT vs UTC |
| `D-novo-M47-STATUS-NULLABLE-CONSTRAINT` | P3 | Code-reviewer — design intencional retro-compat |
| `D-novo-M47-TOM-MSG-DESLIGADO` | P3 | Code-reviewer — UX product decisão |
| `D-novo-M47-SPECS-FRAGEIS` | P3 | Code-reviewer — testes 1/2 do convenios-custeio-m47 |
| `D-novo-M47-SMOKE-POLLING` | P3 | Code-reviewer — setTimeout em vez de polling |
| `D-novo-M47-NOTIF-FAIL-LOG-MIGRACAO-ID` | P3 | Financeiro-token — log fail sem migracaoId |

## Próximo passo

**Convênio cooperativizado COMPLETO** (M44 + M46 + M47). Próximas opções
estratégicas, todas DEPENDENTES de decisão externa:

### **Sprint ROTEADOR + FUNIL DE AQUISIÇÃO** (mais próxima)

Conforme adendo Luciano + Fase 1 ampliada M47:
- Detector A/B/C central (`RoteamentoCadastroService`).
- Vitrine SISGD marketplace multi-tenant.
- Funil do parceiro ("Venha pra X e melhore sua economia").
- Funil da plataforma ("Consulte os parceiros do SISGD").
- LeadExpansao.converter() (gap M47).

**BLOQUEIA** até:
- Orquestrador formalizar a **spec completa**.
- Luciano decidir critério de **atribuição lead→parceiro** (região /
  escolha do usuário / capacidade do parceiro / placement-pago).

8 débitos pré-catalogados na Fase 1 ampliada M47:
- `D-novo-ROTEADOR-CADASTRO-CENTRAL` P1
- `D-novo-LEAD-EXPANSAO-CONVERTER` P1
- `D-novo-JA-RECEBE-CREDITOS-GD-PASSIVO` P2
- `D-novo-ADAPTER-EXTRAI-CNPJ-GERADOR` P2
- `D-novo-FATURA-PROCESSADA-CLASSIFICACAO-SCEE` P2
- `D-novo-LISTA-ALIASES-PARCEIROS-SISGD` P2
- `D-novo-LEAD-WHATSAPP-VS-EXPANSAO-CONFUSAO` P3
- `D-novo-CROSS-TENANT-NOTIFICATION` P3

### **Sprint Convênio FAMÍLIA (Fase 2 — G1)** — DEFERIDA

Aguarda **parecer trabalhista** do Luciano. Token paga conta de luz → risco
salário in natura agravado CLT 458 quando expandido pra família (esposa SEM
UC abate fatura do marido COM UC). Cooperativa pode ser questionada sobre
"benefício indireto a familiares".

### **Sprint Hardening Lateral** — segue catalogado

IDOR sistêmico (M45 lateral + 3 D-novo-CONVENIO-*-SEM-COOPID M46 + débitos
M47 inventário SISGD ~20 endpoints) ainda ACUMULANDO.

### **Outros** (catálogo)

- `D-QUALIF-DECAY` (~6-10h) — decaimento qualificação Clube.
- `D-novo-RECONCILIACAO-DESISTIDO-LISTENER` — sprint Notificações Proativas.
- 2 destaques M47 acima (`DESLIGADO-SALDO-RESIDUAL` + `MSG-MULTI-TENANT-PARCEIRO`)
  antes de escalar pra 2º parceiro real.

### Caminho ativação produção saque colaborador DESCONTO_FATURA

Inalterado: ✅ parecer + ✅ Salvaguardas + ✅ Throttler+Reconciliação + ⏳
parecer escrito + ⏳ flag `.env` prod.

## Decisões catalogadas nesta sessão

1. **D21/06-MIGRACAO-1 — Roteador A/B/C FORA do M47** (Q7): sprint própria.
   Migração admin-manual desbloqueia piloto sem precisar do roteador. 8 débitos
   do roteador pré-catalogados.
2. **D21/06-MIGRACAO-2 — Visão Funil de Aquisição registrada**: caso C vira
   captador de cliente nas telas de cadastro público+admin ao subir fatura com
   crédito + tela dedicada técnica + publicidade em 2 vozes — "Venha pra X e
   melhore sua economia" (parceiro) E "Consulte os parceiros do SISGD e melhore
   sua economia" (plataforma/marketplace multi-tenant). **Alimenta a Sprint
   Roteador+Funil quando o Luciano formalizar a spec.**
3. **D21/06-MIGRACAO-3 — Reusar MigracaoUsina (opção A)** em vez de criar
   modelo MigracaoExterna novo. Campos opcionais aditivos retro-compat com
   MUDANCA_USINA intra-coop.
4. **D21/06-MIGRACAO-4 — Cron timeout SEM rollback automático**: admin decide
   manual via `/migrar/concluir` ou `/migrar/rejeitar`. Sensível demais.
5. **D21/06-MIGRACAO-5 — `DESLIGADO` é terminal**: matcher bot WA exclui,
   STATUS_PERMITIDOS_CREDITO bloqueia, saldo congela. **Inconsistência E1
   destacada como débito P2** pra resolver antes de escalar.
6. **D21/06-MIGRACAO-6 — Template DESLIGAMENTO_CONCORRENTE tenant-agnóstico**
   (princípio multi-tenant 17/05). Cada parceiro preenche `{{provedora.*}}`.
7. **D21/06-MIGRACAO-7 — SUPER_ADMIN sem contexto tenant é rejeitado nos 3
   endpoints**: operação SENSÍVEL exige contexto explícito (mais restritivo
   que `POST /cooperados` que tem `cooperativaIdAlvo`).

## Regras aplicadas

- ✅ Decisão 23 (validação prévia) — Fase 1 read-only ampla (auditoria do enum
  + Fase 1 ampliada com 5 frentes f-j antes da Fase 2).
- ✅ Regra contatos teste 14/05 — smoke E2E usou whitelist 27981341348.
- ✅ FUNDACAO §4#1 — preservada (financeiro-token confirmou; saldo congela
  sem alterar ledger).
- ✅ Padrão M39/M41/M42/M43/M44/M45/M46 — branch dedicada → reviewers pesados
  (multitenant + financeiro-token + code-reviewer) → re-review orquestrador →
  smoke real → merge --no-ff → feature branch preservada.
- ✅ Princípio multi-tenant templates 17/05 — ModeloDocumento tenant-agnóstico.
- ✅ CLAUDE.md regra schema delta — auditoria prévia dos consumidores do enum
  (15 pontos mapeados; 0 quebras).
- ✅ Lição M45 inegociável — `cooperativaId` SEMPRE do JWT nos 3 endpoints.

## Frase comandante

Ver `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code`
(M47 atualizada, M46 arquivada).
