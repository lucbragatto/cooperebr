# Sessão 2026-06-04 — Portal Empresa 9.0+9.1 + Sprint Financeiro F1 + Convergência Convite-Custeio (F1+F2) + Circuito CooperToken Fatia A+B

## TL;DR

Sessão maratona Code (10 commits trabalho + 1 fechamento). 4 frentes entregues ponta-a-ponta:
**(1) Sprint Financeiro F1** — emissão consolidada no gateway com retry automático (cap 5 × back-off 30min) + endpoint admin reemitir + UI badges + 13 specs.
**(2) Portal Empresa Conveniada 9.0+9.1** — perfil novo `EMPRESA_CONVENIADA` + guard `@PagadorCooperadoOnly` + `/conveniada/convenio/[id]` dashboard reutilizando GestaoConvitesSection/MembrosPendentesSection com source='empresa' + decidir aprovação in-portal (JWT, sem magic link) + 14 specs.
**(3) HOTFIX** CORS+API_URL LAN (acesso via IP do celular) + fix decidir in-portal sem depender de magic link inexistente + erro detalhado em DEV no /auto-inscrever.
**(4) Convergência convite-custeio (Fatias 1+2)** — backend DTO strict + remoção do fallback UC fake (D-novo-CAD-UC-FALSA fechado) + endpoint upload-doc gated por OTP + helper unificado `isAmbienteReal()` + frontend wizard `/cadastro?conv=` + OTP gate + uploads opcionais + LGPD + redirect slim `/convite-convenio/[token]` → `/cadastro?conv=`.
**(5) Circuito CooperToken Fatia A+B** (aplicado pela orquestradora claude.ai, validado nesta sessão) — portal nomenclatura/help/menu + bonusIndicacao configurável via ConfigCooperToken.
7 débitos novos catalogados (auditoria do /cadastro). 2 débitos fechados estruturalmente (CAD-UC-FALSA P1 + CAD-MODO-MANUAL-NAV P3) + 1 latente resolvido (CONVITE-ROTA-CONSOLIDAR P3).

## Marcos entregues

- **M21 — Sprint Multi-Frente Portal Empresa + Convergência + Cooper Token**

## Commits do dia (11)

| Hash | Tipo | Marco |
|---|---|---|
| `0d698d4` | feat | **Sprint Financeiro F1** — emissão consolidada com retry + statusEmissao (schema delta enum + 4 campos + índice composto; helper público emitirNoGateway; cron @AsPlatform retry 30min cap 5; POST reemitir admin; UI badges; 13 specs verdes) |
| `695e574` | feat | **Portal Empresa 9.0** — perfil EMPRESA_CONVENIADA + branch obterContextosUsuario + rotaPorContexto /conveniada + guard @PagadorCooperadoOnly (anti-enumeração 404 em mismatch) + 9 endpoints /portal/meus-convenios/* + seed dev-only + box credenciais dev no /login + D-novo-PORTAL-EMPRESA-SEED-TESTE P3 |
| `6eaa7a6` | feat | **Portal Empresa 9.1** — dashboard /conveniada/convenio/[id] (header dados+natureza+forma) + reuso GestaoConvitesSection+MembrosPendentesSection source='empresa' + cobranças filtradas (PENDENTE/A_VENCER/PAGO/VENCIDO + EMITIDO) + decidir aprovação in-portal + HelpBox em cada bloco |
| `bfad278` | chore | **HOTFIX BUG1 CORS+API_URL LAN** — backend.env CORS_ORIGINS+=192.168.3.88 + web/.env.local NEXT_PUBLIC_API_URL=192.168.3.88:3000 + rebuild front (NEXT_PUBLIC_* baked) + D-novo-DEV-LAN-ACCESS P3 |
| `4fb9a0c` | fix | **HOTFIX BUG2 decidir in-portal sem magic link** — decidirAprovacaoEmpresaLogada(membroId, cooperativaId) opera direto sem depender de AprovacaoConvenioMembro existente (magic link só é criado quando admin reenvia) + 9 specs (sem token, com token pendente, com token usedAt, REJEITAR, motivo curto, multi-tenant, status errado, race) |
| `baf7fc1` | fix | **HOTFIX diag /auto-inscrever** — helper erroDetalhe(erro, motivoDev) gated por isAmbienteReal: DEV retorna {erro, mensagem, dev_motivo}; PROD mantém genérico (anti-enumeração). Aplicado em 6 caminhos (kill_switch + 5 dedup/quota) |
| `9f18e13` | docs | **7 débitos /cadastro** — D-novo-CAD-UC-FALSA P1, ESTADOS-TRAVADOS P2, CONSUMO-ZERO P2, CONTRATO-IDEMPOTENCIA P2, FILA-CONGELADA P3, INDICACAO-SILENT P3, MODO-MANUAL-NAV P3 |
| `badeb5f` | feat | **Convergência Fatia 1 backend** — schema delta (TipoUc NORMAL/SINTETICA + TipoDocumento+=SELFIE + Cooperado.consentimentoDocsAceito + ConviteConvenioMembro.permiteSemUc) + helper unificado validarENormalizarCadastro via isAmbienteReal + REMOÇÃO do fallback `UC-`+Date.now() (D-novo-CAD-UC-FALSA fechado estrutural) + range consumo 20-50000 (D-novo-CAD-CONSUMO-ZERO fechado) + POST /publico/cadastro/upload-doc gated por OTP (Supabase Storage tmp) + 35 specs (22+13) verdes |
| `0559660` | feat | **Convergência Fatia 2 wizard** — backend doc-move (moverUploadsConviteParaCooperado: copy tmp→cooperados/<id>/ + cria DocumentoCooperado KYC + delete tmp) + cadastroWebV2 aceita token+consentimentoDocs + frontend `/cadastro?conv=` (banner empresa + OTP gate + uploads opcionais RG/SELFIE + Step 3 LGPD checkbox + modoManual NÃO pula UC + redirect slim 553→38 linhas + badge MODO TESTE) + smoke E2E 9/9 |
| `feda124` | feat | **Circuito CooperToken Fatia A+B** (orquestradora claude.ai + validação Code) — portal nomenclatura "CooperToken(s)" (era "CTK") + separação Crédito de Energia × Token + menu inferior reorganizado + banners help; ConfigCooperToken.bonusIndicacao Int @default(50) aditivo + indicacoes.service lê config (era hardcoded 50) + cooper-token.controller/service expõem no upsert; CLAUDE.md ponteiro pra spec; docs/especificacao-circuito-cooper-token-convenio.md catalogada |
| `<próximo>` | docs | Fechamento desta sessão |

## Entregas técnicas

### Sprint Financeiro F1 (`0d698d4`)
- **Schema**: enum `StatusEmissao { AGUARDANDO_EMISSAO | EMITIDO | FALHA_EMISSAO }` + `Cobranca` ganha 4 campos (statusEmissao? + tentativasEmissao default 0 + ultimoErroEmissao? + ultimaTentativaEmissaoEm?) + `@@index([statusEmissao, tentativasEmissao])`. Aditivo via prisma db push (consolidadas pré-existentes ficam null).
- **Service `convenios-custeio.service.ts`**: `emitirNoGateway` virou público (callable pelo cron); 3 paths (EMITIDO / increment tentativas+erro / skip sem incrementar); `listarConsolidadasDoConvenio` expõe novos campos; **NOVO** `reemitirCobrancaConsolidada({convenioId, cobrancaId, cooperativaId})` reseta tentativas + AGUARDANDO + tenta imediato (multi-tenant via findFirst, rejeita reemissão de EMITIDO).
- **Cron `convenios.job.ts`**: `@Cron('*/30 * * * *') @AsPlatform()` `retryEmissaoConsolidadas` short-circuit !isAmbienteReal + batch 50 + 5ª falha → `FALHA_EMISSAO` + `NotificacoesService.criar` admins do tenant.
- **Endpoint**: `POST /convenios/:id/cobrancas-consolidadas/:cobrancaId/reemitir` @Roles SUPER_ADMIN/ADMIN @TenantResource @AuditLog @HttpCode 200.
- **UI**: badge dupla na coluna Status + tooltip ultimoErroEmissao + botão "Tentar de novo" + HelpBox estendida com 3 estados.
- **Specs**: 13 verdes (8 job retry + 5 reemitir) + suite total `src/convenios` 212/212.
- **Decisões travadas**: (1) campo separado, (2) cap 5+back-off 30min, (3) empresa só vê PENDENTE/A_VENCER, (4) FALHA→notif admin in-app, (5) dev sem retry, (6) estorno→CANCELADO sem retry.

### Portal Empresa 9.0 (`695e574`)
- **Schema**: `PerfilUsuario += EMPRESA_CONVENIADA` (verificado via pg_enum: 7 valores presentes).
- **Backend**:
  - `auth.service.ts:obterContextosUsuario` branch novo: Cooperado matched por email pagadorCooperadoId de convênios ATIVOS → contexto `empresa_conveniada` (label "Empresa — <nome>" ou "N convênios").
  - `auth/pagador-cooperado.guard.ts` NOVO: `@PagadorCooperadoOnly()` opt-in. Bypass SUPER_ADMIN. Match Cooperado.email = user.email; conv.pagadorCooperadoId = cooperado.id (NotFound em mismatch — anti-enumeração). Side-effect: `req.empresa = { cooperadoId, cooperativaId, convenio }`.
  - `convenios/portal-empresa/` módulo novo: `PortalEmpresaService.listarMeusConvenios` + `dashboardConvenio` (filtra cobranças PENDENTE/A_VENCER/PAGO/VENCIDO + EMITIDO).
  - `PortalEmpresaController` @Roles(SUPER_ADMIN, EMPRESA_CONVENIADA) com 9 rotas (lista + dashboard + convites x4 + membros x2 + decidir). Cada handler com @PagadorCooperadoOnly + @AuditLog. Reusa ConvitesConvenioService + ConvenioAprovacaoService.
- **Seed dev**: `backend/scripts/seed-portal-empresa-teste.ts` localiza CV-2026-0001, atualiza Cooperado pagador pra alias gmail+empresa-teste (regra 14/05), cria Usuario EMPRESA_CONVENIADA no Supabase+Postgres, senha `Teste@123`.
- **Frontend**:
  - `types/index.ts`: TipoContexto += `empresa_conveniada`; PerfilUsuario += `PROPRIETARIO + EMPRESA_CONVENIADA`.
  - `hooks/useContexto.ts:rotaPorContexto` case `empresa_conveniada` → `/conveniada`.
  - `selecionar-contexto/page.tsx` ícone Briefcase + cores orange.
  - **`login/page.tsx` BOX DEV-ONLY** com credenciais + botão "Preencher". Discriminado por `NEXT_PUBLIC_AMBIENTE_REAL !== 'true'`. **D-novo-PORTAL-EMPRESA-SEED-TESTE P3** catalogado (remover antes de prod).
- **Specs**: 14/14 verdes (`pagador-cooperado.guard.spec.ts` 9 + `obter-contextos-empresa.spec.ts` 5).

### Portal Empresa 9.1 (`6eaa7a6`)
- **Frontend `/conveniada/convenio/[id]`** (segue mockup `Downloads/mockup-portal-empresa-conveniada.html`):
  - Header dados (razão/CNPJ/responsável) + badge natureza (AUXILIAR/PRÓPRIO) + forma de cobrança.
  - Reuso `<GestaoConvitesSection source='empresa'>` (já estava preparado da Fatia 5).
  - Reuso `<MembrosPendentesSection source='empresa'>` com botões Confirmar/Recusar in-portal (NOVO).
  - Lista cobranças F1 filtradas (server-side: PENDENTE/A_VENCER/PAGO/VENCIDO + EMITIDO) com link PIX/Boleto via asaasCobrancas[0].linkPagamento.
  - 5 HelpBox (overview, natureza AUXILIAR, convites, pendentes banner amber, financeiro).
- **Backend**: `POST /portal/meus-convenios/:id/membros/:membroId/decidir` (wrapper inicial reusava `decidirAprovacaoEmpresa` via token — **HOTFIX BUG2** virou direto `decidirAprovacaoEmpresaLogada` sem dependência de magic link).
- **Specs**: ainda 14/14 (não adiciona; HOTFIX adicionou +9).
- **Smoke E2E**: 7/7 PASSOU (login → contexto → /portal/meus-convenios → dashboard → /convites → /membros-pendentes → multi-tenant 404 anti-enum).

### HOTFIX BUG1 CORS+API_URL LAN (`bfad278`)
- **Causa**: convite por WA gera link em `FRONTEND_URL=http://192.168.3.88:3001` (IP LAN do Luciano pra celular). Backend CORS só liberava localhost → bloqueio. Frontend `NEXT_PUBLIC_API_URL=http://localhost:3000` → browser do celular falhava ANTES do CORS.
- **Fix** (`.env` gitignored + `.env.example` + docs):
  - `backend/.env: CORS_ORIGINS=...,http://192.168.3.88:3001,http://192.168.3.88:3000`
  - `web/.env.local: NEXT_PUBLIC_API_URL=http://192.168.3.88:3000` + `NEXT_PUBLIC_WHATSAPP_URL=http://192.168.3.88:3002` (⚠ REBUILD obrigatório — NEXT_PUBLIC_* é baked)
  - `D-novo-DEV-LAN-ACCESS P3` catalogado em `docs/debitos-tecnicos.md` (trocar pra domínio público + rebuild antes de produção)
- **Smoke**: `POST /auth/login Origin=http://192.168.3.88:3001` → 200 com `Access-Control-Allow-Origin=http://192.168.3.88:3001` ✓

### HOTFIX BUG2 decidir in-portal sem magic link (`4fb9a0c`)
- **Causa**: o endpoint `POST /portal/meus-convenios/:id/membros/:membroId/decidir` resolvia o token consultando `AprovacaoConvenioMembro.membroId` — e quando esse registro não existia (membro nasceu PENDENTE_APROVACAO_EMPRESA via `/auto-inscrever` SEM admin ter clicado "Reenviar"), retornava ForbiddenException 403. Zerava o portal da empresa no caso comum.
- **Fix**:
  - `ConvenioAprovacaoService.decidirAprovacaoEmpresaLogada({membroId, cooperativaId, decisao, motivo?, ip?, userAgent?})`: opera direto no membroId via `$transaction Serializable`. Updatemany WHERE status=PENDENTE_APROVACAO_EMPRESA (anti-race). Se AprovacaoConvenioMembro existir pendente, consome (usedAt + decisao + ip + UA) — não exige.
  - `portal-empresa.controller.ts:decidirAprovacao` chama o método novo passando `cooperativaId + ip + UA` do `req.empresa`.
- **Specs**: 9 verdes (sem token, com token pendente, com token usedAt, REJEITAR, sem motivo, motivo curto, multi-tenant, status errado, race).
- **Smoke live**: Dr. Race 1 aprovado in-portal → `{ok: true, status: 'PENDENTE_APROVACAO_ADMIN'}` ✓.
- **Suite total impactada**: 274/274 verdes (23 suites).

### HOTFIX diag /auto-inscrever (`baf7fc1`)
- **Causa**: cadastro do Luciano falhou via celular com mensagem genérica "Não foi possível concluir...". Causa raiz: dedup CPF 11111111111 (já ocupado por Cooperado teste B5 "TESTE-B5-FIXO-CHEIO" com 5 FKs vivas).
- **Fix Parte B**: REMAP do CPF 11111111111 → 11111111110 + email pra alias (DELETE descartado por FKs vivas).
- **Fix Parte C (commit)**: helper `erroDetalhe(erro, motivoDev)` gated por `isAmbienteReal()`:
  - DEV → `{erro, mensagem (genérico), dev_motivo}`
  - PROD → string genérica (anti-enumeração)
  - Aplicado em 6 caminhos: `kill_switch`, `convite_inexistente`, `convite_ja_usado`, `convite_expirado`, `convenio_invalido`, `cpf_ja_cadastrado`, `rate_limit_convenio`. Erros já estruturados (OTP, quotas) inalterados.

### Auditoria /cadastro + 7 débitos (`9f18e13`)
- **P1**: `D-novo-CAD-UC-FALSA` — `publico.controller:864` `UC-${Date.now()}` → SCEE não compensa em UC fake.
- **P2**: `CAD-ESTADOS-TRAVADOS` (sem cron lembrete) + `CAD-CONSUMO-ZERO` (`Number()||0`) + `CAD-CONTRATO-IDEMPOTENCIA` (sem @@unique propostaId).
- **P3**: `CAD-FILA-CONGELADA` (posição snapshot) + `CAD-INDICACAO-SILENT` (catch engole erro) + `CAD-MODO-MANUAL-NAV` (pula etapa UC).
- 151 linhas em `docs/debitos-tecnicos.md`.

### Convergência Convite-Custeio Fatia 1 backend (`badeb5f`)
- **Audit prévio Q6**: `SELECT propostaId, COUNT(*) FROM contratos GROUP BY HAVING qt>1` → **0 duplicatas**. Banco safe pra `@@unique([propostaId])` futuro.
- **Storage provider confirmado**: Supabase Storage, bucket `documentos-cooperados` (mesmo `DocumentosService.uploadAdmin`). Path tmp: `documentos-cooperados/tmp/convite-uploads/<conviteId>/`.
- **Schema delta** (aditivo): `TipoDocumento += SELFIE` + `enum TipoUc { NORMAL, SINTETICA }` + `Uc.tipoUc @default(NORMAL)` + `Cooperado.consentimentoDocsAceito Boolean?` + `consentimentoDocsAceitoEm DateTime?` + `ConviteConvenioMembro.permiteSemUc Boolean @default(false)`.
- **Helper unificado `validarENormalizarCadastro`** (`common/safety/cadastro-validacao.ts`): centraliza validações via `isAmbienteReal()`. STRICT em REAL; RELAXED em DEV com auto-placeholder `${cpf}@teste.invalid` (decisão D).
- **`cadastroWebV2` refatorado**: usa o helper. **REMOÇÃO** do fallback `'UC-' + Date.now()` (grep `dist/src/publico/publico.controller.js` confirma 0 ocorrências). Quando `numeroUC=null` (só com `permiteSemUc=true`), cria `Uc.tipoUc=SINTETICA` + `tipoCooperado=SEM_UC`.
- **POST /publico/cadastro/upload-doc**: gated por `token + otpValidadoEm < 30min`. Multipart `arquivo` + `tipo` ∈ {FATURA, RG_FRENTE, RG_VERSO, CNH_FRENTE, CNH_VERSO, SELFIE}. < 5MB, mime jpeg/png/pdf. Throttle 30/h IP.
- **Débitos FECHADOS estruturalmente**: `D-novo-CAD-UC-FALSA P1` + `D-novo-CAD-CONSUMO-ZERO P2`.
- **Specs**: 35 novos (22 helper + 13 upload). Suite total: 374/374 verdes (23 suites).

### Convergência Fatia 2 wizard (`0559660`)
- **Backend doc-move** (`moverUploadsConviteParaCooperado`): lista blobs tmp → copy pra `cooperados/<id>/<tipo>_<ts>.<ext>` + delete tmp + cria `DocumentoCooperado` PENDENTE pra KYC (RG/CNH/SELFIE). FATURA só move. Best-effort.
- **`cadastroWebV2` estendido**: aceita `token + consentimentoDocs`. Grava `consentimentoDocsAceito + Em`. Invoca doc-move ao final.
- **Frontend wizard `/cadastro?conv=`**:
  - useEffect carrega `GET /publico/convites/:token` + banner laranja "🏢 Você foi convidado pela <empresaNome>" + trava `tipoCobranca=CUSTEADA` + `convenioCusteioId` do convite.
  - OTP gate antes do Step 0 (`solicitar-otp` + `validar-otp`). Wizard escondido até `otpEtapa==='validado'`.
  - Step 3 com seção "📎 Documentos (opcional)" — uploads RG_FRENTE/RG_VERSO/SELFIE via novo endpoint Fatia 1. Mobile-friendly (`capture='environment'` / `'user'`).
  - Step 2 `numeroUC` obrig + modoManual NÃO pula mais a etapa UC. **D-novo-CAD-MODO-MANUAL-NAV fechado**.
  - Step 3 checkbox LGPD docs (visível só no fluxo `?conv=`). handleSubmit envia `token + origem='CONVITE_PUBLICO' + permiteSemUc + consentimentoDocs`. `codigoRef` MLM IGNORADO quando `?conv=` ativo.
  - Badge âmbar "⚠ MODO TESTE — validações relaxadas (não use em produção)" no header (regra 19/05).
- **Slim redirect**: `/convite-convenio/[token]` → `router.replace('/cadastro?conv=<token>')`. **553 → 38 linhas**. **D-novo-CONVITE-ROTA-CONSOLIDAR resolvido**.
- **Smoke E2E 9/9 PASSOU**: login → criar convite → token integral → validar → solicitar-otp → validar (atalho DB) → upload-doc SELFIE → cadastro-web 201 com `docs={movidos:1, documentos:1, falhas:0}` → Cooperado.consentimentoDocsAceito=true + DocumentoCooperado SELFIE PENDENTE.

### Circuito CooperToken Fatia A+B (`feda124`)
- **Aplicada pela orquestradora claude.ai**, validada nesta sessão.
- **Fatia A — portal cooperado** (frontend):
  - `web/app/portal/{page,layout,tokens,clube,creditos}.tsx`: padroniza "CooperToken(s)" (era "CTK") + separa "Crédito de Energia (R$)" de "CooperToken" + Tokens/Clube no menu inferior + banners help.
  - Confirmado pós-rebuild: `Select-String "Meus CooperTokens"` em `web/app/portal/tokens/page.tsx:171` ✓ + `.next/server/chunks/ssr/` contém a string.
- **Fatia B — bonusIndicacao configurável** (backend):
  - Schema: `ConfigCooperToken.bonusIndicacao Int @default(50)` (aditivo, sem perda).
  - `indicacoes.service.ts`: lê `config.bonusIndicacao ?? 50` (era hardcoded `50`).
  - `cooper-token.controller.ts + service.ts`: expõem no upsert/defaults.
- **CLAUDE.md**: ponteiro pra `docs/especificacao-circuito-cooper-token-convenio.md` (spec catalogada).
- **Descoberta operacional crítica**: o frontend NÃO está em `next dev` — está em `next start` sob PM2. Por isso a Fatia A não apareceu sem rebuild. **HMR não rola.** `cd web && npm run build && pm2 restart cooperebr-frontend` é OBRIGATÓRIO pra toda mudança de frontend. Documentado em `CLAUDE.md`.

## Bugs resolvidos / catalogados

| # | Severidade | Causa | Fix | Status |
|---|---|---|---|---|
| BUG1 convite IP | P0 acesso | CORS só localhost + NEXT_PUBLIC_API_URL=localhost | `.env` LAN + REBUILD front | RESOLVIDO (`bfad278`) |
| BUG2 decidir 403 | P0 portal empresa | wrapper exigia magic link inexistente | `decidirAprovacaoEmpresaLogada` opera direto no membroId | RESOLVIDO (`4fb9a0c`) |
| auto-inscrever genérico | P2 diag | erro genérico esconde motivo do dev | helper dev-gated `erroDetalhe` | RESOLVIDO (`baf7fc1`) |
| Cooperado teste B5 ocupava CPF 11111111111 | bloqueio teste | DELETE descartado por 5 FKs vivas | REMAP CPF→11111111110 (não-commitado, banco vivo) | RESOLVIDO Parte B |
| D-novo-CAD-UC-FALSA | P1 SCEE silencioso | `UC-${Date.now()}` fallback | helper + remove fallback + SINTETICA | RESOLVIDO ESTRUTURAL (`badeb5f`) |
| D-novo-CAD-CONSUMO-ZERO | P2 produto silencioso | `Number()||0` sem range | range 20-50000 + DTO | RESOLVIDO ESTRUTURAL (`badeb5f`) |
| D-novo-CAD-MODO-MANUAL-NAV | P3 pula UC | step 0 → 3 direto em modoManual | linear 0→1→2→3 | RESOLVIDO (`0559660`) |
| D-novo-CONVITE-ROTA-CONSOLIDAR | P3 latente | rota slim separada de /cadastro | redirect 553→38 linhas | RESOLVIDO (`0559660`) |

## Decisões estratégicas catalogadas

- **Sprint F1**: 6 decisões travadas pelo Luciano sobre statusEmissao separado, cap 5+30min, empresa só vê 3 status, FALHA→notif in-app, dev sem retry, estorno→CANCELADO sem retry.
- **Portal Empresa Decisão E**: admin decide COM/SEM_UC no convite (Fatia 3 da convergência); slim mantido como fallback SEM_UC (Opção B, `permiteSemUc` default false).
- **Convergência Decisões A-F**: slim = fallback SEM_UC; validação online UC catalogar separado; selfie opcional; email real obrig+formato/teste auto-placeholder; admin decide COM/SEM_UC; upload Supabase tmp→move.
- **Q2-Q4 convergência**: telefone do convite pré-preenchido+editável; uploads opcionais (numeroUC é o obrig real); manter `/cadastro/sem-uc`.
- **Auditoria propostaId duplicados**: 0 duplicatas (banco safe pra `@@unique` futuro).
- **Storage provider Supabase confirmado** (reuso `documentos-cooperados` bucket).
- **Descoberta `next start` (sem HMR)**: regra catalogada em CLAUDE.md — frontend mudou → rebuild + pm2 restart obrigatórios.

## Próximo passo

**Fatia F-G1 do Circuito CooperToken**: cooperativa cria/envia convite de indicação pela web (atribuição C salvo decisão contrária) + mover acesso do "Crédito de Energia" pra dentro do Financeiro → Meus Créditos + investigar erro `/portal/indicacoes` (provável perfil `EMPRESA_CONVENIADA` em endpoint de membro).

## Pré-requisitos leitura próxima sessão

- `docs/especificacao-circuito-cooper-token-convenio.md` (spec do circuito)
- Memória `decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md` (modelo voucher/sobra/resgate)
- `docs/sessoes/2026-06-04-portal-empresa-convergencia-cooper-token.md` (este arquivo)
- `git log --oneline -15` (último ciclo)

## Carry-overs (não-bloqueantes)

- 7 débitos novos /cadastro: 1 P1 (CAD-UC-FALSA ✅ resolvido estrutural na convergência) + 3 P2 (CAD-ESTADOS-TRAVADOS, CAD-CONSUMO-ZERO ✅ resolvido, CAD-CONTRATO-IDEMPOTENCIA) + 3 P3 (CAD-FILA-CONGELADA, CAD-INDICACAO-SILENT, CAD-MODO-MANUAL-NAV ✅ resolvido).
- D-novo-PORTAL-EMPRESA-SEED-TESTE P3: remover seed dev + box credenciais antes de produção.
- D-novo-DEV-LAN-ACCESS P3: trocar CORS_ORIGINS + NEXT_PUBLIC_API_URL pro domínio público + rebuild antes de produção.
- Slim deprecation 1 sprint pra remover `/convite-convenio/[token]` redirect quando confirmar zero tráfego nos links velhos.
- Erro `/portal/indicacoes` — investigar na Fatia F-G1 (provável perfil EMPRESA_CONVENIADA em endpoint de membro).
- Convênio teste tem 1 membro "Smoke Convergência" + Dr. Race 1 já em PENDENTE_APROVACAO_ADMIN (admin pode aprovar pra completar fluxo).

## Regras aplicadas na sessão

- Decisão 23 + Fase 1 read-only obrigatória (3× nesta sessão: F1, Portal Empresa, Convergência).
- isAmbienteReal() em vez de NODE_ENV (regra inegociável 18/05).
- Contatos teste 27981341348 + lucbragatto+*@gmail.com (regra 14/05).
- Rebuild front + pm2 restart obrigatório (lição BN — `next start` sem HMR, descoberta hoje + catalogada em CLAUDE.md).
- Build sempre verificar dist via grep (lição HOTFIX 02/06 reforçada hoje).
- Commit scoped via `git add <arquivo>` (NUNCA `add .` ou `-A` — carry-overs `.agent`/`backend/src/agents`/`tmp_*` ficam fora).
- Multi-tenant 404 (não 403) em mismatch — anti-enumeração.
- Help inline obrigatório em UI nova (regra 19/05).

## Frase comandante

```
Retomar Circuito CooperToken — Fatia F-G1. PASSO 0: estar no main repo
C:\Users\Luciano\cooperebr, rodar `git status --short` + `pm2 list`
(confirmar cooperebr-backend e cooperebr-frontend online). Fatia A
(portal nomenclatura/help/menu/rios) e Fatia B (bonusIndicacao
configurável) JÁ ESTÃO NO AR e validadas. AÇÃO IMEDIATA: implementar a
Fatia F-G1 (cooperativa cria/envia convite de indicação pela web —
atribuição C salvo decisão contrária) + mover acesso do "Crédito de
Energia" pra dentro do Financeiro → Meus Créditos + investigar o erro
/portal/indicacoes (provável perfil EMPRESA_CONVENIADA em endpoint de
membro). Empacotar com `cd web ; npm run build ; pm2 restart
cooperebr-frontend`. Toda mudança de frontend = rebuild (next start,
sem HMR). Spec: docs/especificacao-circuito-cooper-token-convenio.md.
Memória: decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md.
```
