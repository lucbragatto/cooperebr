# Controle de Execução — SISGD

> Arquivo vivo. Atualizar em **toda sessão** (claude.ai e Code).
> Última atualização: **2026-05-31 — Sprint Blindagem Multi-Tenant Fase 0 (D-novo-BR F0)** — 3 commits em 1 sessão Code. **26 IDORs corrigidos** em 5 sub-fatias atômicas (F0.1-F0.5) — 19 Onda A + 7 críticos Onda B usando padrão D-novo-BQ. Auditorias expandidas (Dynamic Workflow Ondas A+B = 50 IDORs adicionais) catalogadas. Decisão arquitetural híbrida em 5 fases (F0 ✅ esta / F1 AsyncLocalStorage / F2 Prisma Extension / F3 residuais / F4 testes) em `docs/arquitetura/blindagem-multi-tenant-sistemica.md`. **55 specs F0 verdes + 111 IDOR total verdes** (56 BQ + 55 BR F0). **23 cenários runtime cross-tenant** validados em smoke programático. 4 padrões consolidados (posse direta, via-relação, body→JWT, global-only-SA). Detalhe: `docs/sessoes/2026-05-31-sprint-blindagem-multi-tenant-fase0.md`.

> Histórico: **2026-05-30 — Sprint Segurança IDOR (D-novo-BQ) COMPLETO** (5 commits `3e23f81..d17ac3f` em 1 sessão Code maratona). **18 IDORs corrigidos** (7 críticos + 8 altos + 3 médios) em 4 fatias atômicas (BQ.1+BQ.2+BQ.3+BQ.4). Padrão de fix mecânico (posse `findFirst` + SUPER_ADMIN bypass). Auditoria gerada por **Audit Dynamic Workflow** — primeiro uso no projeto (28 sub-agentes paralelos Opus 4.8, 4 min, 1.437.072 tokens, relatório `docs/relatorios/2026-05-30-auditoria-idor-workflow.md`). **56 specs isolamento verdes** + **35 cenários runtime cross-tenant validados em 3 smokes programáticos**. Pré-requisito Sinergia (2º parceiro real) destravado nos módulos núcleo. Detalhe: `docs/sessoes/2026-05-30-sprint-seguranca-idor-completo.md`.

> Histórico: **2026-05-30 — Sprint D-novo-AN (RepasseProprietario) COMPLETO** (5 commits `37f7af0..2f6fb29` em 1 sessão Code dia inteiro). 5 fatias canônicas (AN.1 schema + service workflow / AN.2 endpoints REST + cron transação atômica / AN.3 telas admin + portal refator + sidebar + cards cruzados / AN.3.1 fix painel credenciais + trigger + investigação parceiro / AN.4 fix cards parceiro + backfill + notificação + PDF). **36/36 specs verdes** (21 service + 10 controller + 5 notificação) + 3 smokes programáticos. 4 RepasseProprietario PENDENTE no banco (1 trigger + 3 backfill). **D-novo-BM reparo funcional** inline AN.3.1 (TTL 1h→8h + interceptor allowlist). **D-novo-BP catalogado** (convergência `/parceiro` vs `/dashboard`, P3 sprint refator UX futuro). Sprint AN substitui+complementa BH.5 — workflow PENDENTE→PAGO/CANCELADO com transação atômica vinculando despesas DESCONTO_NO_REPASSE. Detalhe: `docs/sessoes/2026-05-30-sub-sprint-an-repasse-proprietario-completo.md`.

> Histórico: **2026-05-30 — Sprint D-novo-BH (Despesas Operacionais Camada 2) COMPLETO** (10 commits bb838ec..77eeb24 em 2 sessões 28-29/05 + 29-30/05, M37→M41 + 3 bugs/débitos bônus). 7 fatias canônicas (BH.1 workflow + BH.2 endpoints + BH.3 tela admin + BH.3.1 refator UX página própria + BH.3.2 double-check universal + BH.4 portal proprietário + flag + BH.5 cálculo líquido + cron aluguel) + **D-novo-BL ✅ RESOLVIDO inline** (Super Admin bypass) + **D-novo-BN ✅ RESOLVIDO** (ChunkLoadError Turbopack `03f49fc`) + **D-novo-BM ✅ IMPLEMENTADO P0 BLOQUEADOR REMOÇÃO PRÉ-PROD** (painel credenciais teste Opção B `1cdb9cb`). **55 specs Jest verdes** + 3 smokes programáticos **24/24 ✅** + build web Turbopack clean 4 ciclos. Substitui o fechamento parcial `c0542fc` de 29/05. Lição arquitetural catalogada (`D-novo-AS` complemento): `npm run build` web SEMPRE seguido de `pm2 restart frontend` IMEDIATO. Próximo bloco aprovado: **D-novo-AN RepasseProprietario tabela** (terreno preparado por BH.5 — campo `ContaAPagar.repasseAbatidoId` nullable pronto). Detalhe: `docs/sessoes/2026-05-30-sub-sprint-bh-despesas-camada-2-completo.md`.

> Histórico: **2026-05-29 noite — Sub-Sprint BH FECHAMENTO PARCIAL (`c0542fc`, obsoleto)** — substituído pelo fechamento completo de 30/05.

> Histórico: **2026-05-26 noite — M31 Sub-Sprint F Sessão 2 (F.3 Onboarding magic link + cadastro manual)**. 5 commits incrementais (`34719bd` Etapa A ConviteProprietarioService + 31 specs → `6a845f1` Etapas B+C+D endpoints admin + público + email template → `2eb822b` Etapa E frontend admin Card "Acesso do Proprietário" com 2 dialogs Shadcn → `3ba6655` Etapa F frontend público /proprietario/aceitar-convite/[token] com indicador força senha → commit fechamento). **Backend completo + Frontend admin + Frontend público funcionando.** 2 caminhos coexistem: cadastro manual (admin cria Usuario direto, copia senhaTemp pra clipboard) + magic link (admin envia email, proprietário define própria senha). Token crypto.randomBytes 64 hex TTL 7d single-use. Multi-tenant em 100% queries. LGPD: token nunca retornado integral em listagem (tokenSufixo). Senha forte 8+ chars + letra + número. Email template inline (sem Handlebars) reusa EmailService.enviarEmail tenant-aware + whitelist dev. **Suite completa: 917/928 passing** (+31 specs M31 vs M30). nest build + tsc limpos. **F.4 PENDE Luciano operacional**: preencher cooperebr1 (proprietarioEmail GATILHO + formaPagamentoDono + valor + matriz responsabilidade + statusOperacional + valorKwhPadrao OU TarifaConcessionaria EDP_ES) + cadastrar Usuario E-Solares via UI admin OU magic link. Quando feito, F.4 vira sessão curta ~1-2h. Detalhe: `docs/sessoes/2026-05-26-m31-sub-sprint-f-onboarding-magic-link.md`.

---

## ONDE PARAMOS — 2026-05-30 noite (Code — Sprint D-novo-AN RepasseProprietario COMPLETO)

**5 commits** `37f7af0..2f6fb29` em **1 sessão Code dia inteiro** entregaram **Sprint D-novo-AN (RepasseProprietario) 100%** em 5 fatias canônicas:

| Fatia | Commit | Marco |
|---|---|---|
| AN.1 | `37f7af0` | Schema delta aditivo (RepasseProprietario + 2 enums + `@@unique` idempotência + back-ref ContaAPagar.repasseAbatido) + service workflow (transação atômica marcarPago vincula despesas DESCONTO_NO_REPASSE) + 4 DTOs + 19 specs + migração via ritual PM2 |
| AN.2 | `2f36470` | Controller REST 6 endpoints + integração nativa cron BH.5 (`$transaction([createRepasse, createArrendamento])`) + resolução Caminho A/B proprietarioUsuarioId + refator endpoint /proprietario/repasses com fallback PREVISTO_FALLBACK + 13 specs + smoke E2E HTTP 12/12 |
| AN.3 | `a3b351a` | 2 telas admin (por usina + global cross-usinas) + componentes compartilhados (DialogMarcarPago + DialogCancelar Tipo C) + refator portal proprietário (3 KPIs + tipo REAL/FALLBACK) + sidebar item "Repasses" Operacional + card cruzado em /usinas/[id] + UploadComprovante parametrizado |
| AN.3.1 | `3a8a90e` | **Fix D-novo-BM** painel credenciais voltava pro /login em uso real (TTL impersonate 1h→8h + interceptor allowlist self-recovery) + trigger manual cron (1 RepasseProprietario PENDENTE 04/2026 R$1k pro smoke visual) + investigação read-only `/parceiro` vs `/dashboard` (30 páginas vivas, recomendação opção b: convergir Usinas) |
| AN.4 | `2f6fb29` | Fix cards parceiro (sidebar href + redirect página) + backfill idempotente (3 PENDENTE históricos preservando 04/2026) + notificarRepassePago wireup fire-and-forget (email+WA whitelist LGPD Caminho A/B) + PDF mensal status real (remove heurística fake "mês passado = PAGO") |

**Bugs/Débitos bônus resolvidos:**
- ✅ **D-novo-BM** funcionalmente reparado em AN.3.1 (mantém status P0 BLOQUEADOR REMOÇÃO PRÉ-PROD — reparo só ajustou usabilidade DEV).
- ✅ **Cards parceiro display-only** resolvido em AN.4 (Usinas redireciona pra /dashboard/usinas).

**Débitos novos catalogados:**
- 📋 **D-novo-BP** P3 (NOVO) — Convergência portal `/parceiro` vs `/dashboard` (sprint refator UX futuro). 30 páginas `/parceiro` ativas mas sidebar já encaminha entidades complexas pra `/dashboard/*`. Recomendação preliminar: convergência seletiva.

**Validação:**
- **36/36 specs Jest verdes** (21 service AN.1+AN.4 + 10 controller AN.2 + 5 notificação AN.4).
- **3 smokes programáticos:** 8/8 service AN.1 + 12/12 endpoints AN.2 + script backfill (3 criados + 2ª execução idempotente).
- Smoke HTTP AN.3: 4/4 rotas → 307.
- Build web Turbopack clean em 4 ciclos.
- PM2 backend + frontend online estáveis.

**Estado banco pós-sprint:**
- 4 RepasseProprietario PENDENTE (02/03/04/05 2026) — 1 trigger AN.3.1 + 3 backfill AN.4 — todos R$ 1.000 líquido (exceto 05/2026 com R$ 0 devido a despesas DESCONTO_NO_REPASSE acumuladas no banco).
- `ContaAPagar.repasseAbatidoId` populado em produção quando admin marca PAGO (transação atômica).

**Lições catalogadas:**
- Fase 1 read-only mini funciona como cobrança de qualidade (8 perguntas decisórias antes de AN.1 → zero retrabalho).
- Investigação read-only não é "perda de tempo" — virou D-novo-BP catalogado + decisão arquitetural acatada em AN.4.
- Cache JwtStrategy 60s é feature de performance mas afeta como smokes testam guards (limitação operacional, não bug).
- Interceptor global 401 redirect precisa de allowlist pra rotas self-recovery (regra catalogada em AN.3.1).
- **D-novo-AS complemento (lição BN)** aplicado 8× sem regressão neste sprint.

**Próximo bloco — Luciano escolhe** entre 6 opções (ver frase comandante).

**Detalhe:** `docs/sessoes/2026-05-30-sub-sprint-an-repasse-proprietario-completo.md`.

---

## ONDE PARAMOS — 2026-05-30 (Code — Sprint D-novo-BH COMPLETO + 3 bugs/débitos bônus)

**10 commits** `bb838ec..77eeb24` em **2 sessões Code** (28-29/05 + 29-30/05) entregaram **Sprint D-novo-BH (Despesas Operacionais Camada 2) 100%** em 7 fatias canônicas:

| Fatia | Commit | Marco |
|---|---|---|
| BH.1 | `bb838ec` | M37 — Workflow PROPOSTA→APROVADA→REJEITADA + tratamento (REEMBOLSO/DESCONTO_NO_REPASSE/ASSUMIDO) + visibilidade proprietário |
| BH.2 | `62eddde` | M38 — Endpoints REST `/contas-pagar/*` + notificação proativa (email+WA whitelist LGPD) |
| BH.3 | `8d045af` | M39 — Tela admin `/dashboard/usinas/[id]/despesas` (4 KPIs + 3 TabsCustom) |
| BH.3.1 | `44f5e53` | M39 — Refator UX página própria `/nova` corrigindo violação Padrão Dual Tipo B + DespesaForm + UploadComprovante |
| BH.3.2 | `543a835` | M39 — Workflow double-check UNIVERSAL + self-approval guard backend |
| BH.4 | `9858c45` | M40 — Portal Proprietário + flag `proprietarioVeDespesas` + Super Admin bypass tenant + IDOR guard PROPRIETARIO |
| BH.5 | `77eeb24` | M41 — Helper `calcularRepasseLiquido` (7 consumidores migrados) + cron mensal aluguel automático |

**Bugs/Débitos bônus resolvidos inline:**
- ✅ **D-novo-BL** RESOLVIDO em BH.4 — Super Admin sem cooperativaId fixa (bypass tenant perfil-baseado).
- 🔴→✅ **D-novo-BN P0 BLOQUEADOR** detectado pós-BH.4, triado em `c0542fc`, RESOLVIDO em `03f49fc` (15min). Root cause: cache Turbopack `.next/` stale após rebuild incremental durante runtime PM2.
- ✅ **D-novo-BM** IMPLEMENTADO em `1cdb9cb` — Painel Credenciais Teste Opção B. **Elevado a P0 BLOQUEADOR REMOÇÃO PRÉ-PROD** com checklist de 9 passos.

**Validação:**
- 55 specs Jest verdes (30 contas-pagar + 11 cooperativas + 7 auth-dev + 13 BH.5 + 1 IDOR PROPRIETARIO).
- 3 smokes programáticos: 8/8 BH.4 + 8/8 BM + 8/8 BH.5 = **24/24 ✅**.
- Build web Turbopack clean em 4 ciclos sem regressão.

**Lições catalogadas:**
- Padrão UX Dual 17/05 Tipo B reforçado (BH.3.1 corrigiu violação Dialog detectada em BH.3 antes do smoke visual).
- **D-novo-AS complemento (lição BN):** `npm run build` web SEMPRE seguido de `pm2 restart cooperebr-frontend` IMEDIATO. Aplicado nas 4 sessões web build do sprint sem regressão.
- Defesa em 4 camadas pra endpoints dev-only (`isAmbienteReal()` + `@Roles(SA)` + `@AuditLog` + JWT TTL curto).

**Próximo bloco aprovado:** D-novo-AN — RepasseProprietario (tabela de repasses do proprietário). Terreno preparado por BH.5 — campo `ContaAPagar.repasseAbatidoId` ficou nullable pronto pra popular quando AN entregar. Próxima sessão Code começa com **Fase 1 read-only mini do AN** (~10-15min) antes de propor escopo.

**Detalhe:** `docs/sessoes/2026-05-30-sub-sprint-bh-despesas-camada-2-completo.md`.

---

## ONDE PARAMOS — 2026-05-29 noite (Code — Sub-Sprint BH M37→M40 + Triagem D-novo-BN — FECHAMENTO PARCIAL OBSOLETO)

> ⚠️ Esta seção é histórica. O fechamento foi substituído pelo fechamento COMPLETO de 30/05 acima. Mantida pra rastreabilidade do incidente D-novo-BN.

**6 commits** bb838ec..9858c45 entregaram **Despesas Operacionais Camada 2 (D-novo-BH)** em 4 fatias canônicas — BH.1 workflow PROPOSTA→APROVADA→REJEITADA + tratamento (REEMBOLSO/DESCONTO_NO_REPASSE/ASSUMIDO) + visibilidade proprietário via `responsavelPagamento`; BH.2 endpoints REST `/contas-pagar/{operacionais,proprietario,propor,:id/{aprovar,rejeitar,resolver}}` + notificação proativa (email + WA whitelist LGPD); BH.3 tela admin `/dashboard/usinas/[id]/despesas` + BH.3.1 refator UX página própria `/nova` (corrigindo violação Padrão UX Dual Tipo B detectada em BH.3) + componente reusável `DespesaForm` + `UploadComprovante` drag-drop 5MB; BH.3.2 workflow double-check UNIVERSAL (TODOS perfis criam PROPOSTA) + self-approval guard backend; BH.4 Portal Proprietário com `/proprietario/despesas` refatorado + `/proprietario/despesas/nova` + flag `Cooperativa.proprietarioVeDespesas` (default false) + `/proprietario/meu-parceiro` + tela admin `/dashboard/configuracoes/portal-proprietario` com toggle Switch + bypass tenant SUPER_ADMIN em `listarDespesasOperacionais/aprovar/rejeitar/resolver` + IDOR guard PROPRIETARIO em `proporDespesa`. **42/42 specs verdes** + smoke BH.4 **11/11 ✅** + build web Turbopack clean. **D-novo-BL ✅ RESOLVIDO** inline (Super Admin sem cooperativaId).

**Bug bloqueador detectado pós-fechamento BH.4 (12:54:04):** `GET /dashboard/usinas/[id]/despesas` → 500. ChunkLoadError frontend `cooperebr_web_d9a3a872._.js` (chunk inexistente no disco) originado em `_global-error/page.js`. Backend sem erro correlato (subiu OK 12:47:04, mapeou todas rotas BH.4). Frontend rodou ~47min OK após `pm2 restart` antes de falhar — hipótese **cache Turbopack `.next/` corrupto**, NÃO regressão BH.4. Repro Chrome anônimo + Edge confirma não é cache browser. **Triagem aplicada, ZERO fix.** Catalogado **D-novo-BN P0 BLOQUEADOR** em `docs/debitos-tecnicos.md`. **Prioridade #1 próxima sessão Code.**

**Pendente Sub-Sprint BH:** BH.5 (integração cálculo repasse considerando despesas APROVADAS + cron aluguel automático) ~1.5-2h backend — segue PENDENTE até fix D-novo-BN.

**Detalhe:** `docs/sessoes/2026-05-29-m37-m40-sub-sprint-bh-despesas-camada-2.md`.

---

## ONDE PARAMOS — 2026-05-26 noite (Code — M30 Sub-Sprint F MVP+ Sessão 1 Portal Proprietário)

9 commits incrementais (fc2f048..084db48). Backend 100% funcional + frontend portal 6 páginas (Dashboard + Lista + Drill-down Recharts + Repasses + Despesas + Contratos) + frontend UI admin (statusOperacional + valorKwhPadrao + matriz responsabilidade). Helper calcularRepasse SUBSTITUI R$ 0,50/kWh hardcoded. Multi-tenant + LGPD anonimização. Suite 886/897. Detalhe: `docs/sessoes/2026-05-26-m30-sub-sprint-f-portal-proprietario-mvp-plus.md`.

---

## ONDE PARAMOS — 2026-05-26 noite (Code — M29 Sub-Sprint Gateways de Pagamento Fatia F2 EXPANDIDA)

3 commits + fechamento (dc325af → 9c1b5bc → a71cbb1 → 631022c) entregaram schema migration aditiva + dual-write Asaas + rotação ASAAS_ENCRYPT_KEY (D-novo-AJ.1 ✅ RESOLVIDO). 2 papeis offline em locais DIFERENTES dos da GATEWAY_ENCRYPT_KEY. PM2 restart limpo. 860/871 specs verdes. Detalhe: `docs/sessoes/2026-05-26-m29-sub-sprint-gateways-pagamento-f2-expandida.md`.

 3 commits codigo + fechamento (`0db2673` Etapa B schema migration aditiva + colunas credenciaisCriptografadas/metadados → `f1aa803` Etapa C dual-write Asaas + 7 specs → `ff64c5c` Etapa D script idempotente migracao + apply pos-OK Luciano → commit fechamento). Etapas E (rotacao ASAAS_ENCRYPT_KEY) e F (smoke E2E) executadas sem commit (banco + .env apenas; scripts temp `__rotate-*` + `__smoke-*` removidos pos-uso). **Backup pg_dump** completo via Docker postgres:17-alpine pre-execucao (`~/backups/sisgd-pre-f2-20260525-163223.sql.gz`, 220KB, 347 objetos). **Migration aditiva** ConfigGateway: 2 colunas novas `credenciaisCriptografadas Json` + `metadados Json`; coluna legada `credenciais` mantida com `@deprecated F2` (drop pra sprint proprio futuro pos-30 dias coexistencia). **Dual-write Asaas** atomico via `prisma.$transaction`: AsaasService.salvarConfig grava em AsaasConfig (legado) + ConfigGateway (novo, encrypted via CredentialsEncryptor + GATEWAY_ENCRYPT_KEY chave forte). **Migration de dados** aplicada apos DRY-RUN + OK explicito Luciano: 1 UPDATE (CoopereBR ASAAS sandbox, cipher 266 chars base64 forte + apiKeyMasked=****MzY5). **D-novo-AJ.1 RESOLVIDO** — ASAAS_ENCRYPT_KEY rotacionada: chave anterior 31 chars textuais `_key` (entropia senha curta) substituida por chave nova 44 chars base64 real. 1 registro AsaasConfig re-encrypted via script atomico (decrypt antiga -> encrypt nova -> UPDATE transacao -> .env substituido). 2 papeis offline pelo Luciano em locais DIFERENTES dos papeis da GATEWAY_ENCRYPT_KEY (defesa em profundidade). PM2 restartado pid 40264 sem erro decryption. **Smoke E2E pos-rotacao OK**: AsaasService.decrypt produz apiKey real ****MzY5 (consistente); ConfigGateway ASAAS espelho com cipher 266 chars + decrypt CredentialsEncryptor mesmo valor. **Suite completa: 860/871** (mesmas 11 falhas pre-existentes cooperados/usinas; +7 dual-write specs verdes vs M28). Inventario de secrets atualizado: ASAAS_ENCRYPT_KEY 🟡->🟢. **2 pontos de pausa respeitados** (OK Luciano explicito antes do apply Etapa D + antes do restart Etapa E). Detalhe: `docs/sessoes/2026-05-26-m29-sub-sprint-gateways-pagamento-f2-expandida.md`. (`dc325af` Etapas A+B config service multi-tenant + adapter callsites → `9c1b5bc` Etapa C controller sem fallback plataforma → `a71cbb1` Etapa D deprecation BANESTES_* no .env.example → commit fechamento). `BanestesConfigService` agora le **ConfigGateway BANESTES por tenant** (em vez de `process.env.BANESTES_*` globais). Decryption via `CredentialsEncryptor` (M27). **Cache segregado por tenant** (`Map<cooperativaId, ...>`): https.Agent + OAuth token cada um isolado por tenant. **EncryptionModule novo** (`backend/src/gateways-pagamento-config/encryption.module.ts`) extraido pra quebrar ciclo de dependencia entre GatewaysPagamentoConfigModule, GatewayPagamentoModule e BanestesModule. **`POST /gateway-pagamento/banestes/testar-conexao`** refatorado: remove fallback `'plataforma'`, exige cooperativaId real (JWT pra ADMIN ou query pra SUPER_ADMIN). **6 variaveis BANESTES_* marcadas @deprecated** no `.env.example` (PFX_PATH, PFX_SENHA, CLIENT_ID, CLIENT_SECRET, AMBIENTE, BASE_URL). Mantidas globais nao-secretas: BANESTES_TIMEOUT_MS + BANESTES_TEMPO_COBRANCA_EXPIRA_SEGUNDOS. **48/48 specs verdes no modulo Banestes** (18 config service novo + 23 adapter mantidos + 7 controller refatorado). Suite completa: **853/864** (11 falhas PRE-EXISTENTES em cooperados/usinas). nest build + tsc limpos. **F2 PERMANECE BLOQUEADA por Luciano operacional** (gerar GATEWAY_ENCRYPT_KEY real + 2 backups OFFLINE — R2 mitigacao). Detalhe: `docs/sessoes/2026-05-26-m28-sub-sprint-gateways-pagamento-f3-banestes-multitenant.md`.

---

## ONDE PARAMOS — 2026-05-26 noite (Code — M28 Sub-Sprint Gateways de Pagamento Fatia F3 BanestesConfigService Multi-Tenant)

4 commits + fechamento (`dc325af` Etapas A+B config service multi-tenant + adapter callsites → `9c1b5bc` Etapa C controller sem fallback plataforma → `a71cbb1` Etapa D deprecation BANESTES_* no .env.example → commit fechamento `acd2828`). `BanestesConfigService` agora le **ConfigGateway BANESTES por tenant** (em vez de `process.env.BANESTES_*` globais). Decryption via `CredentialsEncryptor` (M27). **Cache segregado por tenant** (`Map<cooperativaId, ...>`): https.Agent + OAuth token cada um isolado. **EncryptionModule novo** extraido pra quebrar ciclo de dependencia. `POST /gateway-pagamento/banestes/testar-conexao` refatorado: remove fallback `'plataforma'`. 6 variaveis BANESTES_* `@deprecated`. **48/48 specs verdes no modulo Banestes**. Detalhe: `docs/sessoes/2026-05-26-m28-sub-sprint-gateways-pagamento-f3-banestes-multitenant.md`.

---

## ONDE PARAMOS — 2026-05-26 noite (Code — M27 Sub-Sprint Gateways de Pagamento Fatia F1 Backend)

6 commits (`42119f6` Etapa A módulo+zod+GATEWAY_ENCRYPT_KEY → `b7e8b42` Etapa B CredentialsEncryptor AES-256-GCM 12 specs → `eaa1942` Etapa C GatewayRegistry Zod + 2 DTOs + 24 specs → `95e04c1` Etapas D+E Service CRUD multi-tenant + testarConexao 29 specs → `bf441b1` Etapa F Controller 8 endpoints 18 specs → commit fechamento). **Módulo novo `backend/src/gateways-pagamento-config/`** standalone (sem efeito colateral em AsaasService legado ou BanestesAdapter — F2+F3 farão o refator com dual-write durante coexistência 30 dias). **83 specs novos verdes** (12 encryptor + 24 registry + 29 service + 18 controller). 8 endpoints REST expostos: `/suportados`, `/`, `/me/ativo?tipo=X`, `/:id`, POST `/`, PATCH `/:id`, DELETE `/:id`, POST `/:id/testar`. Multi-tenant `cooperativaId` em 100% das queries Prisma (defesa IDOR). AES-256-GCM com chave master `GATEWAY_ENCRYPT_KEY` placeholder no `.env.example` com aviso R2. **Schema Prisma NÃO alterado nesta fatia** (rename `credenciais → credenciaisCriptografadas` + add `metadados Json` ficam pra F2 com migration dry-run obrigatório CLAUDE.md regra 6). Detalhe: `docs/sessoes/2026-05-26-m27-sub-sprint-gateways-pagamento-f1-backend.md`.

---

## ONDE PARAMOS — 2026-05-26 noite (Code — M26 Adapter Banestes Cenário Mínimo)

5 commits (`e4e0f77` Etapa A BanestesConfigService → `903fce9` Etapa B BanestesAdapter PIX + factory → `692406e` Etapa C endpoint admin testar-conexao → `0041da6` Etapa D docs+débitos+.env.example → commit fechamento). Adapter PIX-only (igual legado), 4 arquivos novos em `backend/src/gateway-pagamento/banestes/`. Encaixa direto na interface `GatewayPagamentoAdapter` (Asaas pattern). **Operações vivas:** emitirCobranca PIX (POST /cob com devedor inline + validação CPF/CNPJ + chave PIX do tenant) + criarCustomer no-op + testarConexao + `POST /gateway-pagamento/banestes/testar-conexao` (JWT SUPER_ADMIN/ADMIN). **Stubs deliberados:** cancelarCobranca + processarWebhook (Cenário Completo — D-novo-AH catalogado, baixa manual via painel admin Bloco 8). **46 specs novos verdes** no módulo Banestes. Suite tocada: 288/288. mTLS via `https.Agent({ pfx, passphrase })` nativo Node — sem lib terceiro. OAuth Client Credentials + cache memory respeitando expires_in (margem 5min). 2 débitos catalogados: **D-novo-AG** (`.pfx` em disco → migrar pra Azure Key Vault quando Sinergia entrar) + **D-novo-AH** (webhook Banestes pendente, baixa manual via Bloco 8). 7 env vars BANESTES_* documentadas no `.env.example` com alertas operacionais. **Próximo passo Luciano:** obter `.pfx` sandbox Banestes + configurar `.env BANESTES_*` + smoke `testar-conexao`. **BLOQUEADOR EXTERNO PERSISTE:** Sub-Sprint B (ETL legado→novo) aguarda `script.sql` do hb06a. Detalhe: `docs/sessoes/2026-05-26-m26-adapter-banestes-cenario-minimo.md`.

---

## ONDE PARAMOS — 2026-05-24 (Code — M24 Sprint Bot Autoatendimento: Bloco 8 Menu Fatura + SPRINT FECHADO)

### Marcos entregues nesta sessão (7 commits + fechamento)

Bloco 8 do Sprint Bot Autoatendimento ENTREGUE. Sprint INTEIRAMENTE FECHADO. Cooperado agora consegue: ver fatura atual (valor + venc + PIX + boleto + link), histórico de pagamentos (últimas 6), avisar "já paguei" (cria `SolicitacaoConfirmacaoPagamento` PENDENTE pra equipe validar com checkbox `marcarPago` opcional), ou pedir negociação humana (link direto via `NotificacoesService`).

- **Etapa A — Schema** (`1fc34b2`) — `SolicitacaoConfirmacaoPagamento` model + enum `StatusSolicitacaoConfirmacaoPagamento` (PENDENTE/CONFIRMADA/RECUSADA). 3 índices. Back-links em Cooperativa/Cooperado/Cobranca. Ritual PM2 completo.
- **Etapa B+C+D — 5 ações motor** (`df6c203`) — `VER_FATURA_ATUAL` (cache local AsaasCobranca, sem chamar gateway) + `VER_HISTORICO_PAGAMENTOS` (últimas 6) + `SOLICITAR/SALVAR_CONFIRMACAO_PAGAMENTO` (padrão Bloco 5, multi-tenant) + `SOLICITAR_NEGOCIACAO_HUMANA` (link humano via Notificacoes — workaround D-novo-AD). 13 specs novos. **234/234 verdes**.
- **Etapa E — Script idempotente** (`5af7273`) — `fix-bloco-8-menu-fatura-no-fluxo.ts` em 4 partes: alinha modelo `menu_fatura` BD + troca gatilho '2' do MENU_COOPERADO (VER_PROXIMA_FATURA → MENU_FATURA) + ativa MENU_FATURA com 4 gatilhos + cria etapa AGUARDANDO_FORMA_PAGAMENTO. Idempotência confirmada.
- **Etapa F — Módulo REST** (`56c6146`) — `backend/src/solicitacoes-confirmacao-pagamento/` com 3 endpoints gated SUPER_ADMIN/ADMIN/OPERADOR + `@AuditLog` + DTO `RecusarConfirmacaoDto` (min 3 chars). Backend restart limpo (3 rotas mapeadas).
- **Etapa G — Tela admin** (`e410296`) — `web/app/dashboard/super-admin/confirmacoes-pagamento/page.tsx` PÁGINA SEPARADA (justificativa: schemas/status/ações divergentes — generalizar com /solicitacoes viraria render condicional pesado). Checkbox `marcarPago` opcional na confirmação. Sidebar layout ganha 4º link em Gestão Global.
- **Etapa H — Débitos** (`f6ddc82`) — D-novo-AC (MENU_INADIMPLENTE dead code), D-novo-AD (NEGOCIACAO_PARCELAMENTO placeholder, regra produto), D-novo-AE (handler hardcoded handleMenuFatura viola decisão C), D-novo-AF (VER_PROXIMA_FATURA órfã pós Bloco 8).

### Decisões produto Luciano (24/05 — Bloco 8)

1. **Escopo (C) MISTO** — porta MENU_FATURA + "já paguei", não porta MENU_INADIMPLENTE/NEGOCIACAO_PARCELAMENTO
2. **Histórico de pagamentos SIM** (`VER_HISTORICO_PAGAMENTOS` mostra últimas 6 — qualquer status)
3. **"Já paguei" padrão Bloco 5** — `SolicitacaoConfirmacaoPagamento` PENDENTE + painel admin
4. **MENU_INADIMPLENTE D-novo-AC** — catalogar como dead code, Housekeeping limpa
5. **NEGOCIACAO_PARCELAMENTO D-novo-AD** — link humano via `NotificacoesService` (já implementado), regra real fica pra sprint futuro
6. **SUPER_ADMIN_PHONE → NotificacoesService** — consistência arquitetural Blocos 4/5/6

### Validação

- **234/234 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts` (era 221, +13 Bloco 8)
- `nest build` limpo
- `tsc --noEmit` frontend limpo
- Ritual PM2 sem incidentes (Etapa A schema + Etapa F restart pra rotas REST)
- Backend online, 0 restarts pós-fechamento
- 3 rotas REST mapeadas: `/solicitacoes-confirmacao-pagamento` GET + `/confirmar` POST + `/recusar` POST

### Pendências carry-over

- **PRÓXIMO: ONBOARDING cooperebr1 (E-Solares / CoopereBR) + Consórcio Sinergia** — primeira cooperativa real do Luciano + segundo parceiro. Bot WhatsApp finalmente vai operar em produção com cooperados reais.
- Sprint Bot Autoatendimento **INTEIRAMENTE FECHADO** (8 blocos M17→M24)
- 12 débitos D-novo-U a AF catalogados → Sprint Housekeeping pós-validação produção 1-2 sprints
- D-novo-AD (NEGOCIACAO_PARCELAMENTO regra real) → sprint dedicado quando Luciano definir política
- Vocabulário multi-tipo hardcoded (CLAUDE.md P2) — bloqueia Sinergia
- D-novo-Q (contatos teste persistentes) → bloqueia Sinergia
- M15 Sprint 5a Neutro Fio B (carry-over antigo, 3-5 dias)
- Demais carry-overs (HTML jornada, Iniciativa Fluxos Customizáveis, etc)
- 11 falhas pré-existentes na suíte Jest (cooperados/usinas — não-minhas, idênticas M19..M23)

### Frase comandante (próxima sessão)

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 24/05 fechamento M24 Bloco 8 + SPRINT FECHADO).

---

## ONDE PARAMOS — 2026-05-24 manhã (Code — M23 Sprint Bot Autoatendimento: Bloco 5 Atualizar Contrato)

### Marcos entregues nesta sessão (7 commits + fechamento)

Bloco 5 do Sprint Bot Autoatendimento ENTREGUE. Fluxo "cooperado pede alteração no contrato" sai de hardcoded direto pra fluxo seguro de solicitação validada por humano. Modelo arquitetural B locked: bot NUNCA toca no Contrato direto.

- **Etapa A — Schema** (`a26500b`) — `SolicitacaoAlteracaoContrato` model + 2 enums (`TipoAlteracaoContrato` AUMENTAR_KWH/DIMINUIR_KWH/SUSPENDER/ENCERRAR + `StatusSolicitacaoContrato` PENDENTE/APROVADA/APLICADA/RECUSADA/CANCELADA). Back-links em Cooperativa/Cooperado/Contrato. 2 índices `(cooperativaId, status)` + `(cooperadoId)`. Ritual PM2 completo + `prisma db push` + `prisma generate`.
- **Etapa B1 — Motor ações KWH** (`5cefe03`) — `INICIAR_SOLICITACAO_AUMENTAR_KWH` / `INICIAR_SOLICITACAO_DIMINUIR_KWH` / `SALVAR_SOLICITACAO_KWH`. Helper `executarIniciarSolicitacaoKwh` parametriza tipo. SALVAR valida parseInt + AUMENTAR>kwhAtual / DIMINUIR<kwhAtual + **pré-valida capacidade usina** via aggregate _sum kwhContratoMensal WHERE usinaId+ATIVO. 12 specs novos.
- **Etapa B2 — Motor ações SUSPENDER+ENCERRAR** (`c3a764e`) — 4 ações novas com 2 helpers (`executarIniciarSolicitacaoBloqueante` + `executarSalvarSolicitacaoBloqueante`). **Pré-valida cobrança em aberto** via `cobranca.count({status: in [A_VENCER, VENCIDO]})` — bloqueia se > 0. SUSPENDER motivo trim() || null. ENCERRAR "PULAR" case insensitive → null. Multi-tenant defense in depth completo. 11 specs novos. **Total motor: 221/221 verdes** (era 210).
- **Etapa C — Script idempotente** (`cb2b80a`) — `fix-bloco-5-atualizar-contrato-no-fluxo.ts` em 3 partes: 3 modelos novos (`solicitacao_contrato_criada/aprovada/recusada`) + repointa gatilhos ATUALIZACAO_CONTRATO + cria 3 etapas (AGUARDANDO_NOVO_KWH/AGUARDANDO_MOTIVO_SUSPENSAO/CONFIRMAR_ENCERRAMENTO) com wildcard SALVAR_*. Seed alinhado. Idempotência confirmada (2ª execução: 0 criado, 6 SKIP).
- **Etapa D — Módulo REST** (`2bd38fb`) — `backend/src/solicitacoes-contrato/`: controller com 3 endpoints gated SUPER_ADMIN/ADMIN/OPERADOR + `@AuditLog` + DTO `RecusarSolicitacaoDto` (min 3 chars). Service `aprovar()` chama `contratosService.update` reusando toda regra de capacidade usina + race condition SERIALIZABLE + recalculo percentualUsina. `recusar()` persiste observacoesEquipe + WA cooperado. Backend restart limpo, 3 rotas mapeadas.
- **Etapa E — Tela admin** (`3646d6d`) — `web/app/dashboard/super-admin/solicitacoes/page.tsx`: header com pendentes + banner explicativo + filtros + cards por solicitação com Aprovar (confirm explícito) e Recusar (Dialog com Textarea obrigatória). Sidebar `layout.tsx` ganha 3º link em Gestão Global (icone ClipboardList). tsc --noEmit clean.
- **Etapa F — Débito catalogado** (`b8b8025`) — D-novo-AB P2: handler hardcoded `handleAtualizacaoContrato` em `whatsapp-bot.service.ts` viola decisão B mas é inalcançável hoje (motor tem precedência via gatilho `acao` + etapa ATIVA + GLOBAL). Limpeza ~30min pós-produção 1-2 sprints.

### Decisões produto Luciano (24/05 — todas no prompt Fase 2 do Bloco 5)

1. **Tela admin mínima** — sem detalhes de capacidade usina, sem timeline
2. **SUSPENDER INDEFINIDO** + motivo obrigatório (na prática opcional via trim → null)
3. **APROVAR = APLICAR IMEDIATO** — sem fase intermediária; `APROVADA` no enum reservada pra fluxo 2-fases futuro
4. **Bot pré-valida** capacidade usina (AUMENTAR) + cobrança em aberto (SUSPENDER/ENCERRAR)
5. **ENCERRAR motivo opcional** — "PULAR" case insensitive → null

### Validação

- **221/221 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts` (era 198, +23 nesta sessão)
- `nest build` limpo
- `tsc --noEmit` frontend limpo
- Ritual PM2 sem incidentes (Etapa A schema + Etapa D restart pra rotas REST)
- Backend online pid 27424, 0 restarts pós-fechamento
- 3 rotas REST mapeadas: `/solicitacoes-contrato` GET + `/aprovar` POST + `/recusar` POST

### Pendências carry-over

- **Próximo bloco (único restante):** Bloco 8 — Menu Fatura/Inadimplente, ~4-6h, decisão produto pendente (portar dinâmico vs hardcoded)
- Após Bloco 8: Sprint Bot Autoatendimento INTEIRAMENTE FECHADO (todos 8 blocos)
- D-novo-AB (P2): handler hardcoded `handleAtualizacaoContrato` — remover pós-produção
- Demais débitos D-novo-W..AA catalogados M21/M22 (Sprint Housekeeping)
- Decisão disparo automático NPS (sprint futuro)
- 11 falhas pré-existentes na suíte Jest (cooperados/usinas — idênticas M19..M22, 0 minhas)
- Carry-overs UX/dados restantes (preservados)

### Frase comandante (próxima sessão)

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 24/05 fechamento M23 Bloco 5).

---

## ONDE PARAMOS — 23/05/2026 noite (Code — M22 Sprint Bot Autoatendimento: Bloco 6 Cadastro Proxy)

### Marcos entregues nesta sessão (4 commits + fechamento)

Bloco 6 do Sprint Bot Autoatendimento ENTREGUE. O fluxo "cooperado existente cadastra um amigo via WhatsApp" sai de hardcoded-only pra totalmente integrado no motor dinâmico. CAVEAT arquitetural da Fase 1 (motor era text-only) resolvido — motor agora aceita mídia.

- **Etapa A — Schema** (sem commit) — `Indicacao` model + `StatusCooperado.PENDENTE_ASSINATURA` já existiam. Decisão técnica orquestrador: aceitaMidia por heurística (sem campo novo em FluxoEtapa).
- **Etapa B — Motor estendido pra mídia** (`4e91c80`) — `avaliarGatilhoMatch` ganha 3º param `temMidia` (wildcard casa com mídia + corpo vazio). `executarAcao` ganha 5º param `media: { base64, mimeType, nomeArquivo? }`. `processarComFluxoDinamico` detecta `tipo in [imagem, documento]` + propaga. Backward compatible (5º param opcional). 11 specs novos.
- **Etapa C — 4 ações novas** (`7f7d3e7`) — `FaturasService` injetado + `jsonwebtoken` importado. 4 cases novos no switch + 4 métodos privados padrão Bloco 4/7: `SALVAR_PROXY_NOME` (trim + length 3+), `SALVAR_PROXY_TELEFONE` (10-13 dígitos + prefixa 55), `PROCESSAR_OCR_PROXY` (valida mimeType + UX "Analisando..." + `extrairOcr` síncrono + valida consumoAtualKwh + renderiza modelo `proxy_confirmar` mapeando `{{titular}}/{{telefone}}` na ação), `CRIAR_COOPERADO_PROXY` (Cooperado PENDENTE_ASSINATURA + Indicacao formal status PENDENTE + JWT 7d + WA pro amigo + notifica indicador + transiciona MENU_COOPERADO). 19 specs novos.
- **Etapa D — Script idempotente** (`278e44d`) — `fix-bloco-6-cadastro-proxy-no-fluxo.ts` cabea 4 etapas com gatilhos wildcard + ações + seed alinhado. CONFIRMAR_PROXY antes apontava `CONCLUIDO`; agora `MENU_COOPERADO` (consistência sprint). 4 atualizadas; 2ª execução skip. Ritual PM2 (pid 27616).
- **Etapa E — Débitos** (`5093d75`) — D-novo-Z (divergência hardcoded resetarConversa×motor MENU_COOPERADO + falta proposta calculada no motor) + D-novo-AA (Cooperado proxy fica com placeholders eternos cpf/email se amigo nunca assina).

### Decisões produto Luciano + decisão técnica orquestrador (23/05)

1. **(1A)** Estender motor pra receber mídia (vs deixar OCR hardcoded)
2. **(2b)** Criar Indicacao formal status PENDENTE (defense in depth com cooperadoIndicadorId)
3. **(3i)** Mapear vars `{{titular}}/{{telefone}}` na ação (sem renomear modelo)
4. **Orquestrador (técnica):** aceitaMidia por heurística (sem campo novo em FluxoEtapa)

### Validação

- **198/198 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts` (era 168, +30)
- **13/13 specs verdes** em `whatsapp-conversa.job.spec.ts` (sem mudança)
- **13/13 specs verdes** em `cep.service.spec.ts` (sem mudança)
- **224 specs totais** nos meus arquivos (era 194)
- `nest build` limpo
- Ritual PM2 sem incidentes
- Backend online pid 27616, 0 restarts
- Suíte Jest completa: **686/697** (11 falhas pré-existentes em cooperados/usinas, idênticas M19/M20/M21, 0 minhas)

### Pendências carry-over

- **Próximos blocos do sprint (decisões pendentes):**
  - Bloco 5 (Atualizar Contrato): ação automática vs solicitação humana
  - Bloco 8 (Menu Fatura/Inadimplente): dinâmico vs hardcoded
- Orquestrador apresenta as 2 decisões na próxima abertura
- 2 débitos novos D-novo-Z e D-novo-AA — Sprint Housekeeping
- Demais carry-overs M17-M21 preservados

### Frase comandante (próxima sessão)

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 23/05 noite fechamento M22 Bloco 6).

---

## ONDE PARAMOS — 23/05/2026 (Code — M21 Sprint Bot Autoatendimento: Bloco 7 NPS no fluxo)

### Marcos entregues nesta sessão (6 commits + fechamento)

Bloco 7 do Sprint Bot Autoatendimento ENTREGUE. NPS sai de "infra dormente" pra ativo no motor dinâmico. Comando manual de teste cabeado pra Luciano testar imediatamente sem esperar trigger automático.

- **Etapa A — Schema delta** (`2cd5663`) — `NpsResposta` ganha `cooperativaId String?` + `comentario String?` opcionais via `npx prisma db push`. Multi-tenant ativado. `comentario` pré-pago pra NPS qualitativo futuro. Ritual PM2 completo (stop → push → generate → build → restart limpo pid 8716).
- **Etapa B — Ação `REGISTRAR_NPS` no motor** (`2b207e4` + fix `088c9c9`) — Switch executarAcao ganha case REGISTRAR_NPS apontando pra método privado `executarRegistrarNps` (padrão Bloco 4). Guard cooperadoId + parseInt 0-10 + persiste com `cooperativaId` + renderiza modelo `nps_recebido` do banco com `{{parceiro}}` + transiciona MENU_COOPERADO. Retry inline se nota inválida. Try/catch defensivo Prisma. Fallback hardcoded se modelo ausente. 10 specs novos (era 158 motor → 168).
- **Etapa C — Script idempotente liga NPS ao motor** (`a8fa1db`) — `fix-bloco-7-nps-no-fluxo.ts` (padrão Bloco 4). Confirma modelos `nps_aguardando_nota` + `nps_recebido` no banco. UPDATE etapa NPS_AGUARDANDO_NOTA (gatilho wildcard + acao REGISTRAR_NPS, modeloMensagemId cabeado). Seed alinhado. Idempotência confirmada. Ritual PM2 (pid 37820).
- **Etapa D — Comando manual `AVALIAR`** (`51c40fa`) — Decisão #1 = a+e (só infra + comando manual). Implementação: opção 1b (gatilho no banco — caminho mais leve, só dado). Gatilho `AVALIAR → NPS_AGUARDANDO_NOTA` adicionado ao MENU_COOPERADO via script idempotente Parte 3. Worst case = auto-NPS sem dano (Luciano OK). Seed alinhado.
- **Etapa E — 3 débitos catalogados** (`f2fd0d1`) — D-novo-W (divergência hardcoded CONCLUIDO × motor MENU_COOPERADO, fix 1 linha), D-novo-X (`agendarNps` dead code com texto não multi-tenant, fix delete), D-novo-Y (modelo `nps_trimestral` órfão — reuso futuro ou delete). Todos slotados pra Sprint Housekeeping. Decisão 14 confirmou letras livres.

### Decisões de produto Luciano (23/05 — todas no prompt Fase 2)

1. **Disparo NPS (a+e)** — só infra + comando manual; trigger automático (b/c/d) fica pra sprint futuro
2. **`cooperativaId` no `NpsResposta` (SIM)** — multi-tenant ativado
3. **`comentario` opcional (SIM)** — pré-pago pra futuro
4. **Estado pós-NPS (X)** — MENU_COOPERADO, consistente Blocos 4 e 1.b
5. **Gatilho (wildcard)** — 1 gatilho `*` validando 0-10 inline (vs 11 numéricos)

### Validação

- **168/168 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts` (era 158, +10)
- **13/13 specs verdes** em `whatsapp-conversa.job.spec.ts` (sem mudança)
- **13/13 specs verdes** em `cep.service.spec.ts` (sem mudança)
- **194 specs totais** nos meus arquivos (era 184)
- `nest build` limpo após fix `088c9c9`
- 2 ciclos ritual PM2 sem incidentes (Etapa A schema + Etapa C/D script)
- Backend online pid 33368, 0 restarts
- Suíte Jest completa: **656/667** (11 falhas pré-existentes em cooperados/usinas — idênticas ao M19/M20, confirmadas via `git stash` nas sessões anteriores)

### Pendências carry-over

- **Próximo bloco (Luciano definiu):** Bloco 6 (Cadastro Proxy, ~6-8h)
- Bloco 5 (Atualizar Contrato): decisão produto pendente — ação automática vs solicitação humana
- Bloco 8 (Menu Fatura/Inadimplente): decisão produto pendente — dinâmico vs hardcoded
- Disparo automático NPS (Sprint futuro): (b)/(c)/(d) das opções da Fase 1
- 3 débitos novos D-novo-W/X/Y catalogados — Sprint Housekeeping
- Demais carry-overs M17-M20 preservados

### Frase comandante (próxima sessão)

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 23/05 fechamento M21 Bloco 7).

---

## ONDE PARAMOS — 22/05/2026 noite (Code — M20.1 adendo: Fase 1 read-only Bloco 7 NPS)

### Resumo

Sessão curta de investigação após o fechamento M20. Executei Fase 1
read-only do Bloco 7 (NPS) — sem código, só relatório. Bloco 7 tem mais
peças prontas do que esperávamos:

- ✅ Model `NpsResposta` existe (`schema.prisma:1951-1960`) — falta
  `cooperativaId` + `comentario` (delta aditivo proposto).
- ✅ Modelos `nps_recebido` (Bloco 2) + `nps_aguardando_nota` (banco) ok.
- ⚠️ Etapa `NPS_AGUARDANDO_NOTA` existe no seed (ordem 21) mas **órfã**
  (`gatilhos: []`).
- ⚠️ `agendarNps()` em `whatsapp-bot.service.ts:3990` é **dead code**
  (definido nunca chamado).
- ✅ Handler hardcoded `handleNpsNota` (linhas 4013-4034) funcional.
- ❌ Estado `NPS_RECEBIDO` não existe — recomendo NÃO criar (ir direto
  pra MENU_COOPERADO).
- ❌ Nenhum gatilho cabea pra NPS_AGUARDANDO_NOTA hoje.

### 5 decisões produto pendentes pro Luciano

1. **Disparo NPS no Bloco 7:** (a) só infra (recomendado) / (b) reativar
   `agendarNps` / (c) listener event / (d) cron trimestral / (e) comando
   manual.
2. **`NpsResposta.cooperativaId`** delta aditivo: SIM (recomendado) / NÃO.
3. **`NpsResposta.comentario` opcional** delta aditivo: SIM agora
   (recomendado) / NÃO.
4. **Estado pós-NPS:** (X) MENU_COOPERADO (recomendado) / (Y) CONCLUIDO.
5. **Gatilho:** wildcard `*` (recomendado por unanimidade) / 11 gatilhos
   0..10.

### Proposta de desenho (assumindo recomendações)

- Schema delta aditivo: `cooperativaId String?` + `comentario String?`.
- Motor: ação `REGISTRAR_NPS` padrão Bloco 4 (guard + valida 0-10 +
  persiste com cooperativaId + renderiza modelo `nps_recebido` do banco +
  transiciona MENU_COOPERADO; retry inline se inválido).
- Script idempotente: UPDATE etapa NPS_AGUARDANDO_NOTA com
  `modeloMensagemId: nps_aguardando_nota` + gatilho wildcard + acao.
- Hardcoded preservado como fallback (debt latente catalogado).
- Specs TDD ~10 cenários.

### Estimativa

- 2-2.5h se NÃO adicionar cooperativaId/comentario
- 3-3.5h se aceitar todas as recomendações
- Disparo opcional adiciona conforme escolha: (a) +0h / (e) +0.5h / (b)
  +1-1.5h / (c) ou (d) +2-3h

### Catalogações novas (não-bloqueantes, no relatório)

- `agendarNps()` dead code com texto não multi-tenant + setTimeout
  frágil — sugerir remover quando decidir disparo
- Modelo `nps_trimestral` órfão em `seed-fluxo-padrao.ts:138-144` — sem
  caller; reaproveita (opção d) ou remove em Sprint Housekeeping
- Divergência comportamento hardcoded (CONCLUIDO) vs dinâmico proposto
  (MENU_COOPERADO) — debt latente Sprint Housekeeping

### Validação

- Decisão 23 ATIVA — zero edits, zero builds, zero schema/banco. Apenas
  leitura + relatório. Pré-validações OK.
- Decisão 14 — grep amplo confirmou estado real do NPS no projeto.
- 184 specs verdes nos meus arquivos mantidos do M20 (sem regressão).

### Aproveitamento do fechamento M20.1

Commitando junto os 3 relatórios de Fase 1 do dia que estavam untracked:
- `docs/relatorios/2026-05-22-fase1-bloco4-atualizar-cadastro.md`
- `docs/relatorios/2026-05-22-fase1-bloco1b-me-chame-depois.md`
- `docs/relatorios/2026-05-22-fase1-bloco7-nps.md` (atual)

### Frase comandante (próxima sessão)

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 22/05 noite no fechamento M20.1).

---

## ONDE PARAMOS — 22/05/2026 noite (Code — M20 Sprint Bot Autoatendimento: Bloco 1.b ME CHAME DEPOIS)

### Marcos entregues nesta sessão (2 commits + fechamento)

Bloco 1.b do Sprint Bot Autoatendimento ENTREGUE. Completa a família de comandos universais de navegação iniciada no M17 (Bloco 1.a: INÍCIO/SAIR/MENU). O cooperado agora pode pausar a conversa em qualquer etapa dizendo "ME CHAME DEPOIS" — o bot agenda retorno em +24h dentro do horário comercial 08-18h.

- **Etapa A — Motor** (`99d4d3b`) — `detectarComandoUniversal` ganha 4º retorno `'CHAMAR_DEPOIS'` com 6 sinônimos (`ME CHAME DEPOIS`, `CHAME DEPOIS`, `ME LIGA DEPOIS`, `VOLTAR DEPOIS`, `OUTRA HORA`, `MAIS TARDE`). `DEPOIS` sozinho NÃO casa (evita falso positivo). `executarComandoUniversalReal` ganha case análogo ao SAIR: persiste `dadosTemp.retornarEm` + transiciona pra `AGENDADO_RETORNO` + envia "Beleza! Volto a te chamar amanhã neste horário. 👋". Helper privado `calcularRetornarEm()`: +24h, posterga pra 08:00 se cair fora de 08-18h, sábado/domingo aceitos. Simulador ganha case CHAMAR_DEPOIS com `avisoTransicao` explicativo. 23 specs novos.
- **Etapa B — Job** (`d14876c`) — `WhatsappConversaJob` ganha `WhatsappSenderService` no constructor + novo `@Cron(EVERY_HOUR) processarRetornosAgendados()`: filtra horário comercial 08-18h (early return se fora), varre conversas `AGENDADO_RETORNO`, pula se `retornarEm` ausente/inválido/futuro, processa se passado — transiciona pra `MENU_COOPERADO` (cooperado) ou `INICIAL` (lead) + envia "Voltei como combinado. 👋 Em que posso ajudar?". Try/catch por conversa (erro em uma não interrompe loop). `resetarConversasInativas` ganha guard defensivo `AND: [{ startsWith: 'AGUARDANDO_' }, { notIn: ['AGENDADO_RETORNO', 'ENCERRADO'] }]`. Spec NOVO `whatsapp-conversa.job.spec.ts` com 13 cenários.

### Decisões de produto Luciano (22/05 noite — todas no prompt da Fase 2)

1. **+24h FIXO** (sem sub-menu de prazos)
2. **Volta pro MENU_COOPERADO** ou INICIAL ao retornar — NÃO persiste `estadoAnterior` (contexto de 24h+ esfriou)
3. **Respeitar horário comercial 08-18h** (motor posterga + cron filtra)
4. **Sábado/domingo aceitos** (filtro 08-18h cobre hora do dia, não dia da semana)
5. **NÃO incluir "DEPOIS" sozinho** nos sinônimos (evita falso positivo)
6. **Reuso do `WhatsappConversaJob`** existente (sem arquivo de cron novo, sem tabela)

### Validação

- **158/158 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts` (era 135, +23)
- **13/13 specs verdes** em `whatsapp-conversa.job.spec.ts` (arquivo NOVO)
- **13/13 specs verdes** em `cep.service.spec.ts` (sem mudança)
- **184 specs totais** nos arquivos tocados
- `nest build` limpo
- PM2 restart limpo (pid 28984, 0 restarts)
- Backend logs: `Nest application successfully started + Backend rodando na porta 3000`
- Suíte Jest completa: **646/657** (11 falhas pré-existentes em cooperados/usinas — idênticas às do M19, confirmadas via `git stash`. 0 falhas causadas por esta sessão)

### Pendências carry-over (decisões produto pro Luciano)

- Próximo bloco: **Bloco 7 NPS** (ordem definida pelo Luciano: 1.b → 7 → 6)
- Bloco 5 Atualizar Contrato: ação automática vs solicitação humana (decisão pendente)
- Bloco 8 Menu Fatura / Menu Inadimplente: dinâmico vs hardcoded (decisão pendente)
- Desativar 1 das 2 etapas globais ATIVAS duplicadas no INICIAL (carry-over M16/M17)
- `{{distribuidora}}` vazia em `AGUARDANDO_DISPOSITIVO_EMAIL`
- Horário hardcoded em `aguardando_atendente`
- Variáveis-fantasma na UI ModalMensagem
- 4 falhas pré-existentes na suíte Jest (cooperados/usinas controllers) — investigar em sprint separado

### Frase comandante (próxima sessão)

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 22/05 noite fechamento M20 Bloco 1.b).

---

## ONDE PARAMOS — 22/05/2026 noite (Code — M19 Sprint Bot Autoatendimento: Bloco 4 Atualizar Cadastro)

### Marcos entregues nesta sessão (5 commits + fechamento)

Bloco 4 do Sprint Bot Autoatendimento ENTREGUE em 5 etapas sequenciais. A opção "3 Atualizar meu cadastro" do MENU_COOPERADO agora funciona pelo motor dinâmico para 3 campos: **Nome, Email, Endereço (CEP)**. Telefone REMOVIDO do bot (risco operacional confirmado).

- **Etapa A — Mudança arquitetural fundacional** (`9a32424`) — Motor passa a processar `Gatilho.acao` (era ignorado desde 20/05) + `executarAcao()` ganha 4º parâmetro `corpo` (texto digitado). Novo método `avaliarGatilhoMatch` retorna gatilho completo. Quando gatilho.acao definido, motor DELEGA controle TOTAL pra ação (não transiciona, não renderiza modelo destino, não dispara acaoAutomatica). 9 specs novos.
- **Etapa B — CepService backend** (`76232e4`) — Novo módulo `backend/src/common/cep/` com `consultar(cep)` retornando tagged union: `ENCONTRADO` / `CEP_INVALIDO` / `NAO_ENCONTRADO` / `FORA_DO_AR`. Timeout 3s via AbortController, degradação graciosa. 13 specs.
- **Etapa C — 3 ações ATUALIZAR_*_COOPERADO** (`c1dcc8c`) — Switch executarAcao ganha 3 cases. Padrão Bloco 3 com adaptações: guard cooperadoId + validação espelhando hardcoded + `updateMany` defense in depth multi-tenant + transição pra MENU_COOPERADO ou retry no fluxo. P2002 do email capturado com mensagem `+CoopereBR@gmail.com`. CEP delega pra CepService. 17 specs novos.
- **Etapa D — Telefone removido** (`4ef82b7`) — Seed sem gatilho '3 telefone' (renumerado pra CEP). Hardcoded: lista ESTADOS sem AGUARDANDO_NOVO_TELEFONE, switch sem case, menu com 3 opções + linha "Para trocar telefone, fale com nossa equipe.", handleAguardandoNovoTelefone deletado.
- **Etapa E — Script idempotente + PM2** (`780082d`) — `fix-bloco-4-atualizar-cadastro.ts` criou 3 etapas globais (AGUARDANDO_NOVO_NOME/EMAIL/CEP, ordens 52-54) com gatilho wildcard + acao + realinhou gatilhos do ATUALIZACAO_CADASTRO (sem telefone). 1ª execução 3 criadas + 1 atualizado; 2ª execução skip total (idempotência confirmada). Ritual PM2: stop → build → script → restart. Backend online pid 37104.

### Decisões de produto Luciano (22/05 — todas no prompt da Fase 2)

1. **SIM** mudança arquitetural Gatilho.acao + corpo (fundacional Blocos 4-8)
2. **a1 (RETRY)** — Email duplicado: erro+sugestão `+CoopereBR@gmail.com` + mantém em AGUARDANDO_NOVO_EMAIL
3. **b2** — CEP/ViaCEP backend com degradação graciosa (FORA_DO_AR salva só o CEP digitado)
4. **c1** — Telefone REMOVIDO do bot
5. **d1** — Mensagens de confirmação hardcoded na ação
6. **Placeholders Bloco 5** — deixar (warn default cobre)

### Validação

- **135/135 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts` (era 109)
- **13/13 specs verdes** em `cep.service.spec.ts` (módulo novo)
- **148 specs totais** nos arquivos tocados
- `nest build` limpo em todas as rodadas
- Script idempotente confirmado em 2 execuções
- PM2 restart limpo (0 restarts, pid 37104)
- Backend logs: `Nest application successfully started + Backend rodando na porta 3000`
- 4 falhas pré-existentes em cooperados/usinas controllers — NÃO causadas por esta sessão (confirmado via `git stash`)

### Pendências carry-over (decisões produto pro Luciano)

- Escolher próximo bloco do sprint: Bloco 5 (Atualizar Contrato, 4-6h, decisão produto) / Bloco 1.b (ME CHAME DEPOIS, 3-5h) / Bloco 7 (NPS, 2-3h) / Bloco 6 (Cadastro Proxy, 6-8h) / Bloco 8 (Menu Fatura, 4-6h, decisão produto)
- Desativar 1 das 2 etapas globais ATIVAS duplicadas no INICIAL (carry-over M16/M17)
- `{{distribuidora}}` vazia em AGUARDANDO_DISPOSITIVO_EMAIL
- Horário hardcoded em `aguardando_atendente`
- Variáveis-fantasma na UI ModalMensagem (~30min UX admin)
- 4 falhas pré-existentes na suíte Jest (cooperados/usinas controllers) — investigar em sprint separado (provavelmente fixtures TestingModule)

### Frase comandante (próxima sessão)

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 22/05 noite fechamento M19 Bloco 4).

---

## ONDE PARAMOS — 22/05/2026 (Code — sessão curta de catalogação)

### Resumo

Sessão de decisão + catalogação, sem código. Abertura via `/abertura` (ritual de retomada canônica completo). Luciano pediu preparação de branch `feature/monitoramento-protecao` pra trabalho novo de monitoramento de proteção (relé). Code mapeou estado (main limpo, 27 untracked esperados carry-over) e alertou sobre pivot fora do roadmap. Luciano pausou o pivot — vai documentar arquitetura primeiro + aguardar vistoria de campo do relé. Tema catalogado como feature futura, **Bloco 4 do Sprint Bot Autoatendimento permanece como próximo passo**.

### Catalogamentos

- Memória persistente nova: `feature_futura_monitoramento_protecao_22_05.md`
- Sugestão #9 em `sugestoes_pendentes.md` (Monitoramento de Proteção Relé — Opção A)
- MEMORY.md atualizado
- Doc-sessão: `docs/sessoes/2026-05-22-pivot-cancelado-rele-catalogado.md`

### Decisão Luciano 22/05

1. NÃO criar branch `feature/monitoramento-protecao`
2. Documentar arquitetura da integração primeiro (sessão futura)
3. Aguardar vistoria de campo do relé antes de mexer em schema
4. Modelo arquitetural (quando retomar): Opção A — tabelas novas dedicadas, schema delta aditivo
5. Feature futura fora do roadmap atual

### Frase comandante (próxima sessão)

**FRASE DE RETOMADA do M18 permanece intacta** (Decisão 24 — local único, pivot cancelado não alterou rumo).

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo.

---

## ONDE PARAMOS — 21/05/2026 noite (Code — M18 Sprint Bot Autoatendimento: Bloco 3 Ver saldo + Ver fatura)

### Marcos entregues nesta sessão (5 commits)

Bloco 3 do Sprint Bot Autoatendimento completou as 2 opções do MENU_COOPERADO que ainda viravam loop ("1 Ver saldo de créditos" e "2 Ver próxima fatura"). Premissa corrigida na abertura: "saldo de créditos" = créditos de ENERGIA (kWh) da distribuidora extraídos via OCR, NÃO tokens CooperToken.

- **Bloco 3 — Ações no motor dinâmico** (`3d3e8c4`) — `executarAcao()` ganhou 2 cases novos. `executarConsultarSaldoCreditos()`: guard cooperadoId + Contrato.findMany ATIVO (soma kwhContratoMensal) + FaturaProcessada.findFirst APROVADA (saldoKwhAtual + validadeCreditos + mesReferencia) + busca modelo `saldo_creditos_resultado` + monta linhas com fallback (linha some quando dado null) + render + rodapé + envia. `executarConsultarProximaFatura()`: guard cooperadoId + Cobranca.findFirst com `where.contrato.{cooperadoId,cooperativaId}` + status `['A_VENCER','VENCIDO']` (NÃO PENDENTE — corrige D-novo-U) + AsaasCobranca pra link só quando existe + bloco_fatura + link_pagamento condicional. 5 helpers de formatação privados. Multi-tenant defense in depth em todas as 3 queries. 109/109 specs (era 89, +20 novos).
- **Bloco 3 — Script idempotente + seed** (`6fb2571`) — `fix-bloco-3-menu-cooperado-saldo-fatura.ts`: INSERT 2 etapas globais (VER_SALDO_CREDITOS ordem 50 + VER_PROXIMA_FATURA ordem 51) + INSERT 2 modelos globais (saldo_creditos_resultado + proxima_fatura_resultado, categoria BOT) + REPOINT gatilhos "1" e "2" do MENU_COOPERADO (campo `acao` órfão removido). ANTES/DEPOIS visível, 2ª execução skip. Seed `seed-fluxos-bot.mjs` alinhado (gatilho "5" tb corrigido — estava com loop+acao órfã GERAR_LINK_INDICACAO, banco já cabeia ENVIAR_CONVITE desde Bloco 0 v2 R5).
- **D-novo-U catalogado** (`7f1f885`) — bug latente P2 do handler hardcoded `whatsapp-bot.service.ts:791-794`: usa `status: 'PENDENTE'` mas distribuição real é A_VENCER=7, VENCIDO=3, PAGO=35, PENDENTE=0. Bot mente sobre faturas em fallback. Fix 1-2h pra Sprint Housekeeping. Caminho dinâmico do Bloco 3 já corrige.
- **D-novo-V catalogado** (`8fd1dd1`) — melhoria P3 pós-Bloco 3: modelos `saldo_creditos_resultado` e `proxima_fatura_resultado` são esqueleto com placeholders ({{linha_saldo}}, {{bloco_fatura}}) e os textos das linhas condicionais + bloco de fatura + frase do link + mensagem "sem cobrança" + CTA estão HARDCODED nas ações do motor. Admin não consegue editar pelo painel. Solução futura (~8-12h): mini-engine de template com `{{#if}}/{{#unless}}/{{#case}}`. Vinculado a D-novo-T (Iniciativa Fluxos Customizáveis).

### Decisões de produto Luciano (21/05 noite)
- **Opção C aprovada** para "Ver saldo de créditos": plano + saldo distribuidora com rótulos separados
- Link Asaas quando existe `AsaasCobranca.linkPagamento` (não inventa)
- `validadeCreditos=null` → linha some
- Cooperado sem cooperadoId → mensagem amigável de cadastro (mesma linha ENVIAR_LINK_INDICACAO)

### Validação
- **109/109 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts` (era 89 no início da sessão). 20 specs novos (10 + 10 para as 2 ações). 1 falha de timezone (`new Date('2026-06-05')` → 04/06 em BRT) corrigida usando `new Date(2026, 5, 5)` mês 0-indexed.
- `nest build` limpo, PM2 restartado limpo (pid 29516)
- Script idempotente confirmado em 2 execuções (skip total na 2ª)
- Banco DEV: 2 etapas + 2 modelos + 2 gatilhos confirmados via SELECT pós-update

### Pendências carry-over (decisões produto pro Luciano)
- Desativar 1 das 2 etapas globais ATIVAS duplicadas no INICIAL (carry-over M17)
- Atualizar Contrato (Bloco 5): ação automática vs solicitação + atendente humano
- Menu Fatura / Menu Inadimplente (Bloco 8): dinâmico vs hardcoded
- `{{distribuidora}}` vazia em AGUARDANDO_DISPOSITIVO_EMAIL
- Horário hardcoded em `aguardando_atendente`
- Variáveis-fantasma na UI ModalMensagem (~30min UX admin)
- Bloco 4: como tratar email conflitando com OUTRO cooperado (unique constraint)? Como tratar CEP inválido / ViaCEP fora?

### Frase comandante (próxima sessão)

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 21/05 noite fechamento M18 Bloco 3).

---

## ONDE PARAMOS — 21/05/2026 (Code — M17 Sprint Bot Autoatendimento: blocos preparatórios)

### Marcos entregues nesta sessão (8 commits)

**Sprint Bot Autoatendimento WhatsApp** repriorizado em 21/05 — agora vem ANTES do M15 Fio B (justificativa: bot oco em produção corrói confiança hoje; Fio B tem cobertura de fallback hardcoded por curto prazo).

- **Catalogação Sprint + Iniciativa Fluxos** (`3ebf41c`) — D-novo-S + D-novo-T em débitos; Sprint Bot Autoatendimento + Iniciativa Fluxos Customizáveis na Seção 3b do PLANO. Pendência das memórias `sprint_bot_autoatendimento_20_05.md` + `iniciativa_fluxos_customizaveis_20_05.md` zerada.
- **Repriorização registrada** (`480809b`) — Sprint Bot Autoatendimento marcado pra antes do M15 nas 2 fontes (PLANO + débitos).
- **Bloco 1.a Navegação Universal** (`9205f0d`) — comandos INÍCIO/SAIR/MENU no motor antes de `avaliarGatilhos`, em ambos os caminhos (`processarComFluxoDinamico` + `simular`). Palavra exata case-insensitive. `SimulacaoOutput` ganha `comandoUniversalAplicado`. Helpers: `detectarComandoUniversal`, `resolverEstadoComandoUniversal`, `executarComandoUniversalReal`, `executarComandoUniversalSimulado`, `anexarRodape`.
- **Correção retroativa rodapé** (`3717b51`) — `anexarRodapeSeMenu` → `anexarRodape`. Anexa em TODA etapa (terminal inclusive), não só menu. Justo onde o cooperado fica preso (AGUARDANDO_ATENDENTE).
- **Bloco 0 quick wins** (`5d85d17`) — Gatilho "5 Indicar amigo" no MENU_COOPERADO cabeado pra ENVIAR_CONVITE (era loop). Modelo `ajuda` sem `{{site}}` (Cooperativa não tem campo `site` no schema — trocado por `{{parceiro}}` + `{{telefone_suporte}}`).
- **Bloco 0 v2 — 3 órfãs reais** (`95346fc`) — `{{historico}}` populado em `extrairVariaveis()` via `formatarHistoricoConsumo()` lendo `dadosTemp.historicoConsumo`. `{{valorFatura}}` → `{{valorFaturaMedia}}` em `lead_fora_area` (naming divergente). `{{mesesGratis}}` removido de `simulacao_resultado` (variável fantasma, zero matches no backend).
- **Bloco 2 — 11 modelos novos** (`1097f72`) — proxy_pedindo_nome/telefone/fatura/confirmar, aguardando_novo_nome/email/telefone/cep, menu_inadimplente, menu_fatura, nps_recebido. Categoria BOT, GLOBAIS, ativo=true. `{{telefone}}` adicionado preventivamente ao `extrairVariaveis()` (era órfã do `proxy_confirmar`).
- **Roadmap organizado** (`a41495d`) — Seção 3b do PLANO com status detalhado dos 8 blocos (4 ✅ + 4 🔴). Nova Seção 3d "Fila operacional próxima" com 4 itens: Sprint Bot Autoatendimento → M15 Fio B → cooperebr2 → Sinergia. Dependência crítica: módulo Fio B (M15) destrava cooperebr2 + Sinergia.

### Validação
- **89/89 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts` (era 56 ontem, 81 no início desta sessão). 25 specs novos Bloco 1.a + 1 spec rodapé universal + 5 specs Bloco 0 v2 + 2 specs Bloco 2.
- `nest build` limpo em todas as rodadas, `tsc --noEmit` limpo
- PM2 restartado 5x sem erros
- 6 scripts de dados rodaram com ANTES/DEPOIS visível e idempotentes
- Banco: gatilho 5 confirmado, modelo `ajuda` sem `{{site}}`, 11 modelos novos confirmados, órfãs erradicadas

### Pendências carry-over (decisões produto pro Luciano)
- Desativar 1 das 2 etapas globais ATIVAS duplicadas no INICIAL
- Atualizar Contrato (Bloco 5): ação automática vs solicitação + atendente humano
- Menu Fatura / Menu Inadimplente (Bloco 8): dinâmico vs hardcoded
- `{{distribuidora}}` vazia em AGUARDANDO_DISPOSITIVO_EMAIL (caminho ou modelo)
- Horário hardcoded em `aguardando_atendente` (parametrizar pré-Sinergia)
- Variáveis-fantasma na UI ModalMensagem (~30min UX admin)

### Frase comandante (próxima sessão)

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 21/05 fechamento M17).

---

## ONDE PARAMOS — 20/05/2026 (Code — M16 UX Simulador + Saneamento Fluxo do Bot)

### Marcos entregues nesta sessão (9 commits)
- **Sub-débito UX simulador RESOLVIDO** (`de91302`) — bolha bot inicial com mensagem da etapa + painel "Respostas que o bot aceita" + atalhos clicáveis abaixo do input. Elimina "digitei e não sei o que aconteceu".
- **R2 RESOLVIDO** (`e9e039c`) — 2 modelos com hardcode "CoopereBR" trocados por `{{parceiro}}` no banco + seed alinhado.
- **R3 RESOLVIDO** (`c9ad444` + resíduo `c51651d`) — botão ▶ da lista de etapas passa `etapa.id` agora; backend `etapaIdForcado` com `findFirst {id, OR tenant|null}`. Resolve "3 menus iguais". Resíduo: id vale até a 1ª transição (não consome no ping).
- **R4 RESOLVIDO** (`c9ad444`) — simulador avisa explicitamente ao transicionar pra estado sem etapa ativa ("no WhatsApp real cairia no fluxo hardcoded").
- **R5 RESOLVIDO** (`9ed2220` + `fa7ad66` + `f486efd`) — "Convidar amigo" no fluxo dinâmico. Ação `ENVIAR_LINK_INDICACAO` no motor + etapa GLOBAL nova + gatilho 4 cabeado em Entrada Dinâmica TENANT e Menu Principal GLOBAL. **Hardening OBS 1:** findFirst com cooperativaId (multi-tenant). **OBS 2:** modelo curto "Beleza! Vou te enviar 👇" + ação envia só link+CTA (sem redundância).
- **R1 Saneamento RESOLVIDO** (`db4605c`) — 4 etapas inativas duplicadas DELETADAS (ordens 8/9/10/11, dump preservado). Confirmado ZERO modelos duplicados no banco (falso positivo do relatório anterior).
- **R6 Saneamento RESOLVIDO** (`0a94aac`) — 5 etapas órfãs REATIVADAS + 1 modelo novo (`aguardando_dispositivo_email`). ZERO estados-destino órfãos pós-saneamento.
- **Relatório completo** `docs/relatorios/2026-05-20-banco-mensagens-fluxo-bot.md` — 320 linhas em linguagem humana, 6 seções (Banco / Fluxo / Mapa / Faltando / Repetido / Sugestões) + síntese. Untracked → empacotado no commit fechamento.

### Validação
- **56/56 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts` (era 27 no início ontem)
- Backend `nest build` limpo em todas as rodadas, frontend `tsc --noEmit` limpo
- PM2 restartado 4x sem erros
- Scripts de dados rodaram com ANTES/DEPOIS visível e idempotentes
- `diag-fluxo-bot.ts` confirma: 25 etapas, 13 ATIVAS, ZERO estados-destino órfãos

### Pendências carry-over (sub-débitos catalogados pra sprint dedicada futura)
- Menu Cooperado opções 1/2/5 viram loop (Ver créditos / Ver fatura / Indicar amigo) — campo `acao` em gatilho não é processado pelo motor
- Atualizar Contrato — 4 opções voltam ao menu sem ação real
- Atualizar Cadastro — 4 estados-destino não existem
- Cadastro por Proxy — 4 etapas inativas sem modelo
- NPS — gatilhos 0-10 ausentes
- MENU_FATURA / MENU_INADIMPLENTE — decisão produto
- Variável `{{site}}` retorna vazio (modelo `ajuda`)
- 2 etapas ATIVAS duplicadas em INICIAL (mortas pro CoopereBR, perigosas pra parceiro novo)
- **D-novo-Q Contatos Teste persistentes** (6-8h Code)
- **Sprint Housekeeping** (~3-5h)

### Frase comandante (próxima sessão)

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 20/05 fechamento M16).

---

## ONDE PARAMOS — 19/05/2026 noite (Code — D-novo-R fix motor + Simulador UX Fases A/B/C)

### Marcos entregues nesta sessão
- **D-novo-R RESOLVIDO (P1 produção)** — `buscarEtapa()` priorizava etapa global sobre tenant via `OR + orderBy ordem asc`. Em produção: "Receber fatura" (global, ordem 1, 0 gatilhos) vencia "Entrada Dinâmica" (CoopereBR, ordem 28, 3 gatilhos). **Cooperado real nunca usou personalização do tenant desde implementação do motor dinâmico.** Fix: 2 queries explícitas (tenant exato primeiro, fallback global).
- **Fase A** — `SimulacaoOutput` expõe `etapaAtual {id, nome, escopo: TENANT|GLOBAL}` + `etapaProxima`. Painel do simulador mostra "Etapa em uso: <nome> [do parceiro/global]" + "Transicionou para: <nome>" após transição. Resolve a pergunta "como saber qual fluxo está sendo testado". Bonus: corrigidos 2 bugs latentes (mismatch `conteudo`/`texto` em bolhas + gambiarra `simular('início')` substituída por bolha sistema + ping).
- **Fase B** — Botão ▶ verde em cada linha de etapa ativa no Fluxo do Bot. Abre simulador com `estadoInicial = etapa.estado`. Permite testar etapas no meio do fluxo (MENU_COOPERADO, AGUARDANDO_OCR) sem percorrer todo o caminho do INICIAL.
- **Fase C** — Endpoint novo `POST /whatsapp/preview-modelo` + componente `PreviewModelo.tsx`. Botão ▶ verde em cada linha de modelo no Banco de Mensagens. Mostra mensagem renderizada com vars do tenant no PhoneFrame + painel lateral com nome, categoria, escopo e variáveis substituídas.
- **Falha catalogada Decisão 14** — Inicialmente catalogei meu fix como D-novo-Q no commit `a0e0f06`, conflitando com D-novo-Q ORIGINAL reservado 19/05 tarde (Contatos Teste persistentes, memória `debito_d_novo_q_contatos_teste_persistentes_19_05.md`). Não fiz grep amplo antes de catalogar. Corrigido: meu fix vira D-novo-R nos débitos + script smoke renomeado. **Lição reforçada:** Decisão 14 vale também pra numeração de débitos, não só sprints.
- **D-novo-Q ORIGINAL (Contatos Teste persistentes) catalogado formalmente em débitos** pela primeira vez — antes só vivia em memória. Escopo completo, decisões aprovadas, 6-8h Code, slot sugerido Sprint Housekeeping ou pré-Sinergia.

### Validação
- 39/39 specs verdes em `whatsapp-fluxo-motor.service.spec.ts` (era 27 no início da sessão)
- Backend `nest build` limpo, frontend `tsc --noEmit` limpo
- PM2 restartado 3x sem erros, endpoints novos confirmados no RouterExplorer
- Smoke programático `backend/scripts/smoke-d-novo-r-buscar-etapa.ts` confirma divergência entre lógica antiga (escolhia global) e nova (escolhe tenant) com dados reais do CoopereBR
- Luciano confirmou print: painel mostrando "Etapa em uso: Entrada Dinâmica [do parceiro]" ✅

### Pendências carry-over
- **Validação visual Luciano amanhã** dos 3 botões ▶ no `/dashboard/whatsapp-config` (etapa, modelo + painel atualizado)
- **Sub-débito UX simulador** (~30-45 min Code): bolha inicial mostrar mensagem da etapa + lista de gatilhos esperados no painel + botões de atalho clicáveis. Resolve confusão "digitei e não respondeu" quando gatilho não casa (caso "ola" → "Nenhum gatilho bateu" sem dizer quais existem).
- **D-novo-Q Contatos Teste persistentes** (6-8h): aprovado, escopo completo, escolher slot
- **M15 Sprint 5a Neutro Fio B** (3-5 dias): próximo marco prioritário, carry-over de 18/05

### Frase comandante (próxima sessão)

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 19/05 noite fechamento D-novo-R + Simulador UX).

---

## ONDE PARAMOS — 16/05/2026 (sessão maratona fechada)

### Marcos entregues hoje
- **M5 — Bloco H' Cadastro Usina expandido** FECHADO (smoke 5/5 PASS, commits `2024b13` + `15db027` + `9dada58`)
- **M6 — Bloco C Cadastro SEM_UC UI** FECHADO (smoke E2E 6/6 PASS, commits `ae708e3` + `22345ce`)
- **Dossiê judicial CoopereBR × EDP v1.1** consolidado em 4 documentos `docs/juridico/` (commit `5274920`)
- **Repositório templates documentos** refatorado em 3 camadas multi-tenant — `docs/templates-documentos/` com 27 arquivos (commit `b09acb2`)
- **Reforma estatutária CoopereBR** preservada (AGE 17/06/2026 prevista — edital + ata + estatuto v3 + spec compliance)
- **2 sprints novos catalogados:** Módulo Documentos (46h), Módulo Compliance (108h)

### Frase comandante (próxima sessão)

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 18/05 fechamento M11).

### Pendências abertas
- HTML cadastro-usinas v1.1 (Luciano cola, claude.ai entregou conteúdo)
- Dossiê judicial — documentos pendentes (acórdão Tema 986 STJ, despachos ANEEL Cooperebr1/2, contrato adesão Exfishes)
- Aguarda AGE 17/06/2026 — reforma estatutária
- Confirmação CNPJ SISGDSOLAR (49.950.705 vs 58.103.611)
- Confirmação regime jurídico Sinergia (Lei 6.404/76 vs 11.795/2008)

### Plano A→H restante (262-310h Code = 11-14 sessões)
4. **D — 3 crons proativos** (8-12h) — PRÓXIMO
5. B — Sprint CT Consolidado (21-26h)
6. E — Realocação Multi-Usina (16-24h)
7. F — Automação Concessionária (24-32h)
8. G — Sprint Assinafy (12-16h)
9. Sprint Módulo Documentos (46h)
10. Sprint Módulo Compliance (108h)
11. Sprint Módulo Classificação GD (8-12h) — depende dossiê judicial
12. D-novo-E reflexos reforma estatutária (8-12h) — depende AGE 17/06

---

---

## ONDE PARAMOS

> **Seção viva atualizada via ritual de fechamento (memória `ritual_abertura_fechamento.md`).**
> Toda sessão Code abre lendo isto. Toda sessão Code fecha atualizando isto.

### Última sessão

- **Quando:** 22/05/2026 noite (Code — M19 Sprint Bot Autoatendimento: Bloco 4 Atualizar Cadastro)
- **Tipo:** Code (Fase 1 read-only fechada → Fase 2 execução em 5 etapas TDD + mudança arquitetural fundacional + módulo novo CepService + 3 ações no motor + telefone removido + script idempotente no banco DEV + PM2 restart)
- **Resultado:**
  - **Bloco 4 ENTREGUE** — opção "3 Atualizar meu cadastro" do MENU_COOPERADO funciona pelo motor dinâmico para 3 campos (Nome, Email, CEP). Telefone REMOVIDO do bot (decisão Luciano por risco operacional confirmado na Fase 1).
  - **Mudança arquitetural fundacional (Etapa A):** motor passa a processar `Gatilho.acao` (era ignorado desde 20/05) e `executarAcao()` ganha 4º parâmetro `corpo`. Quando gatilho.acao definido, motor DELEGA controle TOTAL pra ação. Destrava Blocos 5-8 do sprint (também 2 turnos).
  - **CepService backend novo (Etapa B):** `backend/src/common/cep/` com `consultar()` retornando tagged union ENCONTRADO / CEP_INVALIDO / NAO_ENCONTRADO / FORA_DO_AR. Timeout 3s, degradação graciosa. 13 specs verdes.
  - **3 ações ATUALIZAR_*_COOPERADO (Etapa C):** padrão Bloco 3 com adaptações — guard cooperadoId + validação espelhando hardcoded + `updateMany` defense in depth multi-tenant + transição pra MENU_COOPERADO ou retry no fluxo. P2002 do email capturado com mensagem `+CoopereBR@gmail.com`. CEP delega pra CepService com 4 caminhos (ENCONTRADO autopopula endereço; FORA_DO_AR salva só o CEP).
  - **Telefone removido (Etapa D):** seed sem gatilho '3 telefone' (CEP renumerado pra '3'), hardcoded com 3 opções + linha "Para trocar telefone, fale com nossa equipe.", handler deletado.
  - **Script idempotente + PM2 (Etapa E):** `fix-bloco-4-atualizar-cadastro.ts` criou 3 etapas globais (ordens 52-54) + realinhou gatilhos do ATUALIZACAO_CADASTRO. 2 execuções confirmam idempotência. Backend online pid 37104, 0 restarts.
  - **148 specs verdes** (era 109): 135 motor (+26 novos: 9 Etapa A + 17 Etapa C) + 13 CepService.
  - 4 falhas pré-existentes em cooperados/usinas controllers — NÃO causadas pelo Bloco 4 (confirmado via `git stash`).
- **Commits da sessão (5 + fechamento):**
  - `9a32424` Etapa A — mudança arquitetural Gatilho.acao + corpo
  - `76232e4` Etapa B — CepService backend ViaCEP
  - `c1dcc8c` Etapa C — 3 ações ATUALIZAR_*_COOPERADO no motor
  - `4ef82b7` Etapa D — telefone removido (seed + hardcoded)
  - `780082d` Etapa E — script idempotente + PM2 restart
  - (a seguir) commit fechamento
- **Próximo:** A definir entre Bloco 5 (Atualizar Contrato, 4-6h, decisão produto) / Bloco 1.b (ME CHAME DEPOIS, 3-5h) / Bloco 7 (NPS, 2-3h, mais leve) / Bloco 6 (Cadastro Proxy, 6-8h) / Bloco 8 (Menu Fatura, 4-6h, decisão produto). Restantes do Sprint Bot Autoatendimento ~13-25h.
- **Detalhe:** `docs/sessoes/2026-05-22-bloco4-atualizar-cadastro.md`

### Sessão anterior

- **Quando:** 22/05/2026 (Code — sessão curta de catalogação, sem código)
- **Tipo:** Code (abertura via `/abertura` + pivot iniciado pra relé + pivot CANCELADO pelo Luciano + catalogação como feature futura)
- **Resultado:**
  - Sessão SEM código. Luciano abriu pedindo branch `feature/monitoramento-protecao` pra trabalho novo de monitoramento de proteção (relé). Code mapeou estado e alertou sobre pivot fora do roadmap.
  - Luciano PAUSOU o pivot — vai documentar arquitetura primeiro + aguardar vistoria de campo do relé.
  - **Decisão Luciano:** Opção A (alimentar SISGD com tabelas novas dedicadas) como modelo arquitetural quando retomar. Feature futura fora do roadmap.
  - Catalogação: memória `feature_futura_monitoramento_protecao_22_05.md` + Sugestão #9 + MEMORY.md atualizado + doc-sessão.
- **Commits da sessão (1):** `2a312ca` fechamento da catalogação.
- **Detalhe:** `docs/sessoes/2026-05-22-pivot-cancelado-rele-catalogado.md`

### Sessão anterior

- **Quando:** 21/05/2026 noite (Code — M18 Sprint Bot Autoatendimento: Bloco 3 Ver saldo + Ver fatura)
- **Tipo:** Code (Fase 1 read-only + decisões produto + Fase 2 implementação 2 ações no motor + script idempotente + seed alinhado + 2 débitos catalogados)
- **Resultado:**
  - Bloco 3 ENTREGUE — 2 ações novas no motor (`CONSULTAR_SALDO_CREDITOS` + `CONSULTAR_PROXIMA_FATURA`), 2 estados/etapas globais (`VER_SALDO_CREDITOS` ordem 50 + `VER_PROXIMA_FATURA` ordem 51), 2 modelos globais (`saldo_creditos_resultado` + `proxima_fatura_resultado`), gatilhos "1" e "2" do `MENU_COOPERADO` repointados (campo `acao` órfão removido).
  - **Premissa corrigida na abertura:** "saldo de créditos" = créditos de ENERGIA (kWh) da distribuidora via OCR, NÃO tokens CooperToken. Vivem em `FaturaProcessada.saldoKwhAtual`.
  - **Opção C aprovada por Luciano:** plano contratado + saldo distribuidora com rótulos separados. Link Asaas só quando `AsaasCobranca.linkPagamento` existir. `validadeCreditos=null` → linha some. Cooperado sem `cooperadoId` → mensagem amigável.
  - **D-novo-U catalogado** (P2) — handler hardcoded `whatsapp-bot.service.ts:791-794` usa `status: 'PENDENTE'` mas distribuição real é A_VENCER/VENCIDO/PAGO (PENDENTE=0). Caminho dinâmico do Bloco 3 já corrige.
  - **D-novo-V catalogado** (P3) — modelos do Bloco 3 com lógica condicional hardcoded nas ações. Solução futura: mini-engine de template `{{#if}}/{{#unless}}` (vinculado a D-novo-T).
  - **109/109 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts` (era 89; +20 novos)
- **Commits da sessão (5):** `3d3e8c4` motor + `6fb2571` script+seed + `7f1f885` D-novo-U + `8fd1dd1` D-novo-V + `c2dba28` fechamento M18.
- **Próximo:** **Bloco 4 do Sprint Bot Autoatendimento** — Atualizar Cadastro (~6-8h).
- **Detalhe:** `docs/sessoes/2026-05-21-bloco3-ver-saldo-ver-fatura.md`

### Sessão anterior 2

- **Quando:** 21/05/2026 (Code — M17 Sprint Bot Autoatendimento: blocos preparatórios)
- **Tipo:** Code (abertura do Sprint Bot Autoatendimento repriorizado + 4 blocos preparatórios entregues + correção rodapé + 2 relatórios)
- **Resultado:**
  - Sprint Bot Autoatendimento ABERTO + repriorizado pra ANTES do M15 Fio B (justificativa: bot oco corrói confiança hoje; Fio B tem fallback hardcoded por curto prazo)
  - **Bloco 1.a Navegação Universal** — comandos INÍCIO/SAIR/MENU no motor antes de `avaliarGatilhos`, com precedência sobre gatilhos. Aplicado em ambos os caminhos (real + simulador). Rodapé universal em TODA etapa (correção 21/05 — antes era só menu).
  - **Bloco 0 quick wins** — gatilho 5 cabeado pra ENVIAR_CONVITE, modelo `ajuda` sem `{{site}}`.
  - **Bloco 0 v2 (3 órfãs reais)** — `{{historico}}` populado via `formatarHistoricoConsumo()` lendo `dadosTemp.historicoConsumo`; `{{valorFatura}}` → `{{valorFaturaMedia}}`; `{{mesesGratis}}` removido (variável fantasma).
  - **Bloco 2** — 11 modelos novos inseridos (proxy_*, aguardando_novo_*, menu_inadimplente, menu_fatura, nps_recebido) + `{{telefone}}` adicionado preventivamente ao `extrairVariaveis()`.
  - **2 relatórios criados** — revisão etapa-por-etapa (16 etapas) + revisão das 19 mensagens (PARTE 4 anexada) com tabela completa de órfãs, promessas quebradas, decisões pendentes.
  - **Roadmap organizado** (Seção 3d nova) — fila operacional próxima: Sprint Bot Autoatendimento → M15 Fio B → cooperebr2 → Sinergia, com dependência crítica do módulo Fio B explicitada.
  - **89/89 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts` (era 56 ontem)
- **Commits da sessão (8):** `3ebf41c` cataloga sprint + `480809b` repriorização + `9205f0d` Bloco 1.a + `3717b51` fix rodapé + `5d85d17` Bloco 0 + `95346fc` Bloco 0 v2 + `1097f72` Bloco 2 + `a41495d` organização roadmap + commit deste fechamento.
- **Próximo:** **Bloco 3 do Sprint Bot Autoatendimento** — Ver saldo de créditos + Ver próxima fatura como ações reais no motor (`cooper-token` + `cobrancas`), ~12-18h.
- **Detalhe:** `docs/sessoes/2026-05-21-sprint-bot-autoatendimento-blocos-preparatorios.md`

### Sessão anterior

- **Quando:** 20/05/2026 (Code — M16 UX Simulador + Saneamento Fluxo do Bot)
- **Tipo:** Code (sub-débito UX simulador + investigação ampla 4 problemas relatados + 6 fixes R1-R6 + 2 OBS revisão + relatório completo banco mensagens/fluxo)
- **Resultado:**
  - **Sub-débito UX simulador RESOLVIDO** — bolha bot inicial + painel "Respostas que o bot aceita" + atalhos clicáveis. Backend renderiza `mensagemEtapaAtual`; resumo da etapa expõe `gatilhos`.
  - **R2 — hardcode "CoopereBR" eliminado** em 2 modelos (`menu_principal`, `nps_aguardando_nota`) + seed alinhado em 4 pontos.
  - **R3 — botão ▶ testa etapa exata** via `etapaIdForcado` no SimulacaoInput. Resolve "3 menus iguais". Backend `findFirst {id, OR tenant|null}` (seguro). Resíduo: id vale até a 1ª transição, não consome no ping.
  - **R4 — `avisoTransicao`** quando bot transiciona pra estado sem etapa ativa. Elimina "bot mudo".
  - **R5 — "Convidar amigo" cabeado no dinâmico:** ação `ENVIAR_LINK_INDICACAO` no motor + etapa GLOBAL nova `ENVIAR_CONVITE` + gatilho 4 em Entrada Dinâmica e Menu Principal. **OBS 1:** hardening multi-tenant `findFirst({id, cooperativaId})`. **OBS 2:** modelo curto "Beleza! Vou te enviar 👇" + ação envia só link+CTA (sem redundância).
  - **R1 Saneamento:** 4 etapas inativas duplicadas DELETADAS (ordens 8/9/10/11). Confirmado ZERO modelos duplicados (relatório anterior tinha falso positivo).
  - **R6 Saneamento:** 5 etapas órfãs REATIVADAS + 1 modelo novo (`aguardando_dispositivo_email`). Pós-saneamento: ZERO estados-destino órfãos.
  - **Relatório completo** `docs/relatorios/2026-05-20-banco-mensagens-fluxo-bot.md` (320 linhas, 6 seções) — banco + fluxo + mapa + faltando + repetido + sugestões em linguagem humana.
  - **56/56 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts` (era 27 ontem): +3 sub-débito UX + 3 R4 + 4 R3 + 5 R5 + 2 OBS 1.
- **Commits da sessão (9):** `de91302` sub-débito UX + `e9e039c` R2 + `c9ad444` R3+R4 + `c51651d` R3 resíduo + `9ed2220` R5 backend + `fa7ad66` R5 dados + `f486efd` OBS 1+2 + `db4605c` R1 limpeza + `0a94aac` R6 reativação + commit deste fechamento.
- **Próximo:** **M15 Sprint 5a Neutro Fio B** (3-5 dias Code) — todos os pré-requisitos cumpridos (sub-débito UX + saneamento do bot).
- **Detalhe:** `docs/sessoes/2026-05-20-bloco-ux-simulador-saneamento-fluxo-wa.md`

### Sessão anterior

- **Quando:** 19/05/2026 noite (Code — D-novo-R fix motor dinâmico + Simulador UX Fases A/B/C)
- **Tipo:** Code (investigação read-only buscarEtapa → fix P1 produção → 3 fases UX simulador → correção retroativa Decisão 14)
- **Resultado:**
  - **D-novo-R P1 produção RESOLVIDO** — `buscarEtapa()` priorizava global sobre tenant. Em produção CoopereBR: "Receber fatura" global (ordem 1, 0 gatilhos) vencia "Entrada Dinâmica" tenant (ordem 28, 3 gatilhos). Cooperado real nunca usou personalização do tenant. Fix: 2 queries explícitas tenant-primeiro.
  - **Fase A simulador** — `etapaAtual` + `etapaProxima` no `SimulacaoOutput` + painel mostra "Etapa em uso: <nome> [do parceiro/global]".
  - **Fase B simulador** — Botão ▶ verde em cada linha de etapa abre simulador no estado dela.
  - **Fase C simulador** — Endpoint POST /whatsapp/preview-modelo + componente PreviewModelo.
  - **39/39 specs verdes** em `whatsapp-fluxo-motor.service.spec.ts`.
- **Commits (4):** `a0e0f06` + `b0a92c8` + `483fb2b` + fechamento.
- **Detalhe:** `docs/sessoes/2026-05-19-noite-d-novo-r-fix-motor-e-simulador-uxabc.md`

### Sessão anterior 2

- **Quando:** 18/05/2026 (Marcos M11 + M12 entregues em janela única — mesma sessão Code)
- **Tipo:** Code (subagent QA + Bug Fix Sprint + Sub-Fase 1 Fase 4 + bug crítico investigado + fechamentos canônicos M11 + M12)

**M11 — QA Completo + Bug Fix Sprint pós-QA (manhã/tarde, 5 commits)**
- Primeira ronda QA completa via subagent project-specific (45min). 6 bugs detectados — 3 fixados + 4 catalogados.
- Bug #1 (P1 BLOQUEADOR) — `protocoloConcessionaria` ausente em `CooperadoCompleto`, build web travado 7 dias. Fix 1 linha.
- Bug #1B (P1 descoberto durante #1) — `useSearchParams` sem Suspense (Next.js 16). Fix wrapper Suspense.
- Bug #4 (P2) — 7 rotas mutação Sub-Fase 1 sem `@AuditLog`. Fix 7 decoradores.
- D-novo-J/K/L/M catalogados (specs + IMAP + docs minor).
- Descoberta operacional: 207 arquivos reformat Prettier órfão preservados em stash named.
- Doc órfão recuperado (CooperToken 14/05, 716 linhas).
- Diretriz nova: `git status --short` ANTES de qualquer commit.
- Commits M11 (5): `c10f153` QA + `de8683e` #1+#1B + `098f0be` #4 + `a7e2b7f` D-J/K/L/M + `9444f50` doc + `e59a8f4` fechamento.
- Detalhe: `docs/sessoes/2026-05-18-bug-fix-sprint-pos-qa.md`

**M12 — Sub-Fase 1 Fase 4 + Fix Crítico D-novo-N (tarde/noite, 3 commits + 1 fechamento)**
- Schema delta: `Contrato.dataAtivacao DateTime?` (aditivo puro, `npx prisma db push`).
- Trigger no `registrarHomologacao`: cooperado HOMOLOGADO + contrato PENDENTE_ATIVACAO → ATIVO + `dataAtivacao=now()` + EventEmitter.
- Listener `cooperado-homologado.listener.ts` NOVO — WhatsApp + Email com defense in depth 3 camadas.
- Template `cooperadoHomologadoEmail` (9º Bloco D) + método `enviarCooperadoHomologado`.
- **Bug crítico D-novo-N P0 descoberto no smoke:** `ecosystem.config.cjs` força `NODE_ENV=production` no PM2 (intencional pra rodar dist/), invalidando TODO check `NODE_ENV !== 'production'` (whitelist LGPD, guards WA/Email, override do listener). Email DISPAROU pra contato banco em vez de override.
- **Fix 3 camadas:** (1) `isAmbienteReal()` lê `AMBIENTE_REAL=true` opt-in, (2) respeito `cooperado.ambienteTeste`, (3) `ehEmailFake`/`ehTelefoneFake` pattern detection final.
- Reescrita `podeEnviarEmDev` em `whitelist-teste.ts` conserta automaticamente WA + Email services.
- Smoke re-executado ✅ Luciano confirmou WhatsApp em `27981341348` + email em `lucbragatto+homologado@gmail.com`.
- Commits M12 (3): `4e87874` AMBIENTE_REAL + safety helpers + `e1bf552` feature trigger 3 camadas + `acc5168` débito D-novo-N + scripts smoke.
- Memórias: `falha_regra_contatos_teste_18_05.md` NOVO + `regra_contato_teste_impreterivel.md` EDIT (seção falha sistêmica + 3 camadas obrigatórias).
- **Diretriz nova INEGOCIÁVEL:** NUNCA usar `NODE_ENV` pra discriminar dev/prod. Sempre `isAmbienteReal()`. Todo listener/service de comunicação DEVE ter as 3 camadas.
- Detalhe: `docs/sessoes/2026-05-18-sub-fase-1-fase-4-trigger-ativacao.md`

- **Próximo:** Sub-Fase 1 Fase 5 (M13) — tests Jest + docs (3-5h) — sessão FUTURA. Sub-Fase 1 fecha totalmente após M13.

### Sessão anterior

- **Quando:** 17/05/2026 (Bloco D — 3 crons proativos)
- **Tipo:** Code (Fase 1 read-only + Fase 2 mutação + smoke + fechamento)
- **Resultado:**
  - **Marco M7 entregue:** Quadro 3 txt Luciano implementado (3 crons proativos operacionais)
  - **Novo módulo** `backend/src/notificacoes-proativas/` (service + job + module) — registrado em `app.module.ts`
  - **3 templates email novos** + **3 métodos** `EmailService` (multi-tenant via cooperativaId)
  - **9 ConfigTenant chaves** seedadas em 2 cooperativas (CoopereBR + CoopereBR Teste)
  - **Bug crítico whitelist guard:** primeiro smoke gravou 72 markers `lembrete_edp:1` false-positive em dev (whitelist barrou envio silenciosamente). Fix aplicado (`podeEnviarEmDev` pre-check), 72 markers revertidos, segundo smoke 9/9 PASS
  - **Anti-spam:** CRON A max 5 tentativas/cooperado; CRON B 1 email/tenant agregado; CRON C 2 lembretes (primário + reforço se admin marcar EDP-PENDENTE)
- **Detalhe:** `docs/sessoes/2026-05-17-bloco-d-3-crons-proativos.md`
- **Próximo:** Bloco B — Sprint CT Consolidado (21-26h)

### Sessão anterior anterior

- **Quando:** 16/05/2026 (Bloco C — Cadastro SEM_UC UI)
- **Tipo:** Code (execução completa Fase 1 read-only + Fase 2 mutação + smoke + fechamento)
- **Resultado:**
  - **Marco M6 entregue:** SEM_UC acessível pela UI sem refactor de wizard
  - **2 páginas novas:** `/dashboard/cooperados/novo-sem-uc` (admin) + `/cadastro/sem-uc` (público)
  - **1 endpoint novo:** `POST /publico/cadastro-sem-uc` no `publico.controller.ts` (com Throttle, sem auth, exige `?tenant=`)
  - **Banners de redirect** em ambos wizards COM_UC (admin step 0 + público step 0)
  - **Badge SEM_UC** dourado na listagem `/dashboard/cooperados`
  - **Smoke 6/6 PASS** — admin (HTTP 201, status=ATIVO, modoRemuneracao=DESCONTO) + público (HTTP 201, status=PENDENTE, modoRemuneracao=CLUBE), ambos com 0 UCs + 0 contratos
  - **Zero alteração schema** — `enum TipoCooperado` já tinha `SEM_UC`
- **Detalhe:** `docs/sessoes/2026-05-16-bloco-c-sem-uc-ui-fechado.md`
- **Próximo:** Bloco D — 3 crons proativos (8-12h)

### Sessão anterior

- **Quando:** 16/05/2026 (Bloco H' Cadastro Usina expandido modularizado)
- **Tipo:** Code (execução completa com Fase 1 read-only + 4 checkpoints)
- **Resultado:**
  - **Marco M5 entregue:** schema Usina expandido (11 campos + 2 enums) sem `classeGd`/`RegrasFioB`/guards (modularizado pelo litígio judicial)
  - **AMAGES Opção A:** `ambienteTeste: false → true` (referência externa, preserva smoke M4)
  - **Exfishes CTR-000134:** saneado (kwhContratoAnual=720.000, percentualUsina=8) + migrado pra Cooperebr2
  - **Cooperebr2 cadastrada:** `cmp8fkxvt0001valkj8utb8vr` (Linhares 2, 1.000 kWp, 157.000 kWh, EDP_ES, CUSD EDP-ES-04123/2025 + EDP-ES-04124/2025)
  - **Cooperebr1 apelidada:** `apelidoInterno='cooperebr1'` + `formaAquisicao=ALUGUEL`
  - **D-novo-D catalogado** (P3): definir formaPagamentoDono concreto após acordo parceiro↔dono. Mini-Bloco H'.9 (17/05) ampliou enum com `HIBRIDO` (FIXO + PERCENTUAL juntos) — UI + DTO class-validator com `@ValidateIf` cruzado entregues.
  - **UI cadastro usina estendida:** campos condicionais FIXO/PERCENTUAL na `/dashboard/usinas/nova`
- **Sub-tarefas concluídas:** H'.1 (schema), H'.2 (migration 2 rounds), H'.3 (AMAGES), H'.4 (Exfishes), H'.5 (Cooperebr2), H'.6 (apelidos), H'.7 (UI), H'.9 (smoke 5/5 PASS), H'.10 (este fechamento). H'.8 (HTML) pendente — claude.ai redige.
- **Detalhe:** `docs/sessoes/2026-05-16-bloco-h-linha-fechado.md`
- **Próximo:** Bloco C — Cadastro SEM_UC UI (4-6h)

### Sessão anterior

- **Quando:** 15/05/2026 (sessão Code dedicada — Bloco A Sub-Fase B AMAGES)
- **Tipo:** Code (execução completa com 2 checkpoints intermediários + Fase 1 read-only obrigatória)
- **Resultado:**
  - **Marco M4 entregue** (redefinido em 15/05): 1ª validação engine COMPENSADOS em ambiente real
  - **AMAGES = 5º cooperado piloto PJ** da CoopereBR (Associação dos Magistrados do Espírito Santo, CNPJ 27.053.685/0001-90), `ambienteTeste=false`, contatos = Luciano (regra inegociável)
  - **2 UCs reais**: PUTIRI (`0.001.334.421.054-40`, A4 VERDE, Aracruz/ES) + SEDE ADM (`0.002.399.394.054-06`, B3 CONVENCIONAL, Vitória/ES) — dados extraídos de PDFs EDP mar/2026 reais
  - **PLANO AMAGES COMPENSADOS** (publico=false, descontoBase 18%, cooperativaId CoopereBR)
  - **Contrato CTR-2026-0008** (Usina Linhares EDP_ES, kWh anual 101.028, kWh mensal 8.419, percentualUsina 5,6127%, tarifaContratual R$ 0,19557)
  - **Cobrança R$ 979,20** gerada via `PATCH /faturas/<id>/aprovar` HTTP real — modeloCobrancaUsado=CREDITOS_COMPENSADOS, 6/6 campos batem com expectativa (kwhCompensado × tarifaContratual)
  - **LancamentoCaixa PREVISTO** R$ 979,20 criado automaticamente (D-54 não ressurgiu)
  - **D-46.SEED RESOLVIDO permanente** — 5 planos globais COMPENSADOS `publico=false` (decisão Luciano: não religar)
  - **Ciclo BLOQUEIO**: pm2 stop → `.env BLOQUEIO=false` → build → restart (passo 2) → engine COMPENSADOS rodou → pm2 stop → `.env BLOQUEIO=true` → build → restart (passo 8). Backend pós-fechamento volta ao default seguro.
- **Commits desta sessão:** `ccde5ec` (D-46.SEED + investigação) + `a09a66e` (AMAGES E2E)
- **Próxima sessão:** **Bloco H — Cadastro Usina expandido** (`classeGd` + `formaAquisicao` + `formaPagamentoDono`). Mitiga risco P0 D-30A/D-30B Exfishes R$ 310k/ano. Destrava Bloco E (realocação multi-usina) + Bloco F (automação concessionária).

### Sessão anterior

- **Quando:** 13-14/05/2026 (sessão maratona ~36h corridas; fechamento 14/05 noite com Fase 2 Hardening completa)
- **Tipo:** claude.ai (coordenação) + Code (execução) + 7 sub-agentes claude.ai paralelos (noite 13/05 inventário)
- **Resultado:**
  - **M2 entregue:** canário FIXO_MENSAL E2E real (4 cooperados-piloto DIEGO/CAROLINA/ALMIR/THEOMAX, total R$ 2.542,26/mês)
  - **M3 entregue:** 1ª receita técnica real — sub-canário CAROLINA Asaas sandbox + ngrok + WhatsApp + email + webhook PAYMENT_RECEIVED → cobrança PAGO + LancamentoCaixa REALIZADO + email confirmação automático (latência webhook→email: 5s)
  - **D-48 P1 SEGURANÇA fechado** (7 patches multi-tenant em motor-proposta, cooperados, migracoes-usina, contratos, usinas) + saneamento 2 contratos divergentes
  - **Fase 2 Hardening A→I completa em 7 commits** (`3106e6d` 2A IDOR cobranças + `fef024a` 2B IDOR contratos + Fase 2C IDOR faturas + 2D IDOR motor-proposta + 2E IDOR financeiro/lancamentos/convenios + `e6ee6e5` 2G Helmet/HSTS/CSP + `8fd28dc` 2H delete legacy /parceiro/membros + redirect 301 + `26836ab` 2F AuditLog interceptor global). **Bonus em 2I:** smoke cross-tenant detectou vulnerabilidade real `PUT /cooperados/:id` aceitando cross-tenant → fix imediato no `cooperados.service.update/remove` (recebem `cooperativaId` opcional).
  - **34+ endpoints com IDOR fix.** 18 endpoints com `@AuditLog`. **Smoke E2E cross-tenant 2/2 PASS** após fix bonus.
  - **D-30N (AuditLog) RESOLVIDO** + **D-48 RESOLVIDO** + **D-50/.2 RESOLVIDOS** + B1 cross-talk RESOLVIDO.
  - **11 débitos resolvidos no canário:** D-30I (Lei 14.300) + D-45 3/4 sub-fixes + D-50 + D-50.2 + D-51 (listagem + detalhe) + D-52 + D-53 + D-54 + D-55 + `/cooperativas/minha` endpoint + saneamento
  - **13 débitos catalogados formalmente** D-35..D-47 (movidos de memória persistente pro `debitos-tecnicos.md`)
  - **3 sugestões em memória persistente** #5 orquestrador, #6 script auto HTML, #7 OBSERVABILIDADE TOTAL
  - **2 regras inegociáveis bilaterais** ativas no CLAUDE.md: fechamento sessão (`83776d8`) + contatos teste sempre Luciano com refinamento Gmail `+suffix` (`62e58d2` + `f13f631`)
  - **HTML jornada-membro v1.0 → v2.0** + **HTML inventário-sisgd v1.0 → v1.1** + **HTML cadastro-usinas v1.0** (via 7 sub-agentes, 96 itens, 20 gaps)
- **Detalhe completo:** `docs/sessoes/2026-05-14-maratona-canario-d48-d50-d55-subcanario-carolina-fase2-parcial.md` + `docs/sessoes/2026-05-14-fase2-hardening-completo.md` (NOVO neste fechamento).
- **Próxima sessão:** Sinergia onboarding (2º parceiro real) destravado — pré-requisito Fase 2 Hardening cumprido.

### Frase de retomada COMANDANTE

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único).

### Sessão anterior — 2026-05-13 manhã (Fatia H.2 + D-33 reframe)

- **Quando:** 2026-05-13 (claude.ai + Code, dia inteiro: Fase B + Fatia H.2 + Sub-fatia D-33 Caminho B)
- **Tipo:** Code (execução documental + investigação read-only) + claude.ai (revisão + decisões)
- **Resultado:**
  - **Fase B** (4 commits): `94bf9dc` INDEX+SISTEMA esqueleto (B.0) + `049db42` débitos (B.1+B.2) + `cbce0aa` Sprint Consolidado (B.3) + `e5eb360` controle+frase (B.4+B.5+B.6).
  - **Decisão 24 cleanup** (commit `b0663c9`): consolidar frase de retomada local único + grep amplo antes de atualizar.
  - **Fatia H.2 SISTEMA.md base** (3 commits — **M1 do Plano Mestre entregue**): `382f40e` Dia 1 (backend 45 módulos + 80 models + correção retroativa AsaasCobranca=5) + `0528cd8` Dia 2 (frontend 152 telas + 10 fluxos críticos) + `464e4d3` Dia 3 (integrações + crons + auth + observabilidade + decisões + env vars). SISTEMA.md cresceu de 24 → 1.542 linhas. Pessoa nova lê em ~45 min.
  - **Sub-fatia D-33 Caminho B** (1 commit pendente neste prompt): Fase 1 investigação read-only revelou que **D-33 era LATENTE, não ATIVO** (UI + service + webhook usam `AsaasConfig` consistente). Reframe P1→P2 latente em 4 docs (SISTEMA.md + debitos + plano + controle). **Zero código tocado.** Fatia A liberada (não depende mais D-33).
  - **2 aplicações Decisão 23 em 24h:** (1) 12/05 noite — desfeita memória "31 PAGAS = 100% baixa manual / AsaasCobranca=0" (real: 5 via Asaas sandbox + 26 manual). (2) 13/05 noite — desfeita premissa "UI escreve em ConfigGateway / dual-path ATIVO" (real: UI escreve em AsaasConfig consistente / D-33 LATENTE).
- **Commits:** 8 (`94bf9dc` + `049db42` + `cbce0aa` + `e5eb360` + `b0663c9` + `382f40e` + `0528cd8` + `464e4d3`).

### Sessão anterior

- **Quando:** 2026-05-11 (Code maratona, manhã → tarde)
- **Tipo:** Code (4 fases técnicas + 4 documentais — execução pós-sessão claude.ai prévia que validou 5 D-J)
- **Resultado completo:**
  - **5 D-J fechadas** (D-J-1=a / D-J-2=intencional+D-30W / D-J-3=fora+sugestão #4 / D-J-4=juntos urgência / D-J-5=playbook escrito)
  - **UI etapa 11:** cooperado real CoopereBR **MARCIO MACIEL destravado** via endpoint dedicado POST /cooperados/:id/aprovar-concessionaria + DTO `@MinLength(3)` + service multi-tenant (SUPER_ADMIN bypass) + 6 specs + Dialog admin (Commit `8853d97`)
  - **Fase C.2 reduzida:** 5 itens UI plano avançada — `validacoes-plano.ts` (20 specs ts-node) + Item 5 snapshot+confirmação salvar via `_count.contratos` filtrado por tenant em `findAll`/`findOne` (Commit `6d2510e`)
  - **Fase C.3:** `<EconomiaProjetada>` reusável (29 specs ts-node) em cobrança + contrato (recálculo via `simular-plano`) + proposta (backend retorna `economia5Anos`/`15Anos` on-the-fly). Backwards-compat preservada. (Commit `ecf39cd`)
  - **D-30Y resolvido:** validação E2E manual /aprovar-proposta com 2 propostas teste sintéticas (CoopereBR Teste) + 2 screenshots Luciano confirmou os 4 valores (Commit `fecbe2a`)
  - **Adendo §11 spec CooperToken:** 5 achados validados via Decisão 21 (sem `head -N` truncando) + D-30Z catalogado (85 cooperados em estado intermediário `opcaoToken → modoRemuneracao`) (Commit `69902f6`)
  - **Sprint 0 passos iniciais:** relatório auditoria concentração >25% gerado (62 contratos analisados, 0 casos detectados) — **achado meta crítico D-31 descoberto:** `Contrato.percentualUsina` zerado/irrealista no banco, EXFISHES histórico aparece a 0% (Commit `851a39e`)
  - **Decisão 22 catalogada:** aprovação admin do plano permanece manual até Sprint 5+8 fecharem
- **Débitos:** D-30W (P2), D-30X (P3), **D-30Y ✅ RESOLVIDO**, D-30Z (P3), **D-31 (P1 provisório CRÍTICO — reframed em 13/05 pra P2 só guard)** + D-30A status 11/05 atualizado
- **Commits da sessão (9):** `5cde3e0`, `8853d97`, `f30be3c`, `6d2510e`, `ecf39cd`, `fecbe2a`, `69902f6`, `851a39e`, (commit 9 fechamento)
- **Detalhe completo:** `docs/sessoes/2026-05-11-execucao-maratona.md`

### Sessão anterior anterior

- **Quando:** 2026-05-05 tarde (~2h investigação read-only)
- **Tipo:** claude.ai (sem código)
- **Resultado:**
  - 2 investigações read-only: escopo real Fase C.3 + reframe etapa 11 (aprovação concessionária)
  - **Reframe etapa 11:** 80% implementada (não inexistente como manhã afirmou) — schema TEM `Cooperado.protocoloConcessionaria` + enum `StatusCooperado.AGUARDANDO_CONCESSIONARIA`; backend TEM 9 callers + `enviarCadastroAprovado()`. Falta APENAS UI admin.
  - **C.3 confirmada como hipótese (b):** 1 frase repetida em 4 docs, sem decomposição.
  - **D-J-1 reformulada:** de "construir aprovação concessionária 2-4h" pra "fechar UI admin de transição ~1-2h, absorvível em C.2/C.3"
  - **D-J-5 nova catalogada:** Fase C.3 precisa playbook antes de virar Code
  - **Decisão 21 catalogada:** investigação schema/código deve cobrir 3 frentes
- **Commits:** 1 (fechamento docs — c0f9b70)
- **Detalhe completo:** `docs/sessoes/2026-05-05-tarde-investigacao-c3-etapa11.md`

### Sessão 2026-05-05 manhã (mantida pra contexto)

- **Quando:** 2026-05-05 manhã (~2h investigação read-only)
- **Tipo:** Code + claude.ai (sem código)
- **Resultado:**
  - 3 investigações read-only: validação opções claude.ai + escopo literal C.2 + **mapeamento jornada ponta-a-ponta em 14 etapas**
  - 4 gaps detectados (etapas 5, 9, 11, 12-A) — etapa 11 corrigida em 05/05 tarde
  - 4 decisões pendentes (D-J-1 a D-J-4) catalogadas
  - Caveat C.2 item 4 (CooperToken expandido = condenado pelo Sprint CT Consolidado)
  - Estimativa primeira receita: 12-20h Code + 1-2 sem operacional (otimista)
- **Commits:** 0 código (1 commit de docs)
- **Detalhe completo:** `docs/sessoes/2026-05-05-investigacao-jornada-e2e.md`

### Sessão 04/05 noite (mantida pra contexto)

- **Quando:** 2026-05-04 noite (claude.ai, ~1.5h investigação + decisão)
- **Tipo:** claude.ai (investigação read-only + decisão estruturante)
- **Resultado:**
  - 2 investigações read-only no Code (mapeamento amplo + 5 lacunas) sobre arquitetura CooperToken
  - **Decisão estruturante:** promover ao status de sprint próprio formal — "Sprint CooperToken Consolidado" (14-18h)
  - Escopo definitivo: schema delta (10 campos saem do Plano, 1 fica) + estender `ConfigCooperToken` + refator 4 services + UI nova + remover campos UI Plano + **pré-requisito P0: escrever specs Jest do módulo (~6-8h, hoje 0 specs)**
  - Migração de dados será trivial (banco vazio nos campos relevantes — investigação confirmou)
  - Sequência aprovada: Fase C.2 → Fase C.3 → Sprint CooperToken Consolidado
- **Commits:** 0 código (só investigação + atualização memória)
- **Detalhe completo:** `docs/sessoes/2026-05-04-noite-investigacao-coopertoken.md`

### Sessão 04/05 tarde (mantida pra contexto)

- **Quando:** 2026-05-04 tarde (claude.ai, ~3-4h)
- **Tipo:** claude.ai (housekeeping git + Sprint 5 ponto 3 atualizado + validação manual Fase C.1.1)
- **Resultado:**
  - **Housekeeping git:** 3 commits sem impacto funcional (df0de86 PM2 .env, 722914f .gitignore configs locais + backups/, 71ec415 script setar-webhook-token-asaas idempotente)
  - **Sprint 5 ponto 3 atualizado:** decisão original (UI v1 esconde COM_ICMS/CUSTOM, configura via API) ficou obsoleta desde Fase B porque helper canônico lança NotImplementedException no aceite. Aplicado: `<option disabled>` na UI + `@IsIn(['KWH_CHEIO','SEM_TRIBUTO'])` no DTO + nota datada na sessão Sprint 5 + 2 débitos catalogados (D-30U fórmula órfã motor.dimensionar, D-30V unificação 3 fontes). 2 commits (ca0c0af UI, e097b0a backend+docs).
  - **Validação manual Fase C.1.1: PASSOU.** 4 bugs UX corrigidos no Code de manhã foram validados. Falso bug detectado durante validação (0.87960 vs 0.90300) descoberto como confusão de premissa: plano testado tem descontoBase=18, helper correto.
- **Commits:** 5 (df0de86, 722914f, 71ec415, ca0c0af, e097b0a) — todos pushados pra origin/main.
- **Detalhe completo:** `docs/sessoes/2026-05-04-resumo-sessao-claude-ai.md`

### Sessão 04/05 manhã (mantida pra contexto)

- **Quando:** 2026-05-04 manhã (Code, ~1-2h)
- **Tipo:** Code (Fase C.1.1 — correções UX pós-validação)
- **Resultado:** 4 bugs UX corrigidos em /dashboard/planos/novo e /[id]. Helper simular-plano ampliado pra 10 cenários ts-node verde. **Validada manualmente em 04/05 tarde (sessão claude.ai).**
- **Commits:** 4 (5062933, 6c452fe, cb1ec43, f68c5c6).

### Sessão 03/05 (mantida pra contexto curto)

- **Quando:** 2026-05-03 (maratona ~10-12h, 4 fases sequenciais)
- **Tipo:** Code (Fase A + B + B.5 + C.1)
- **Resultado consolidado:**
  - **Fase A** (manhã): multi-tenant em Planos. 4 bugs cross-tenant resolvidos + lacuna B13 (seed `CREDITOS_COMPENSADOS` → `FIXO_MENSAL`). 20 specs Jest verde. UI condicional por perfil. **4 commits.**
  - **Fase B** (tarde): D-30R RESOLVIDO + duplo desconto eliminado + DINAMICO implementado + Decisão B33 aplicada. Helper canônico `calcularTarifaContratual` em 5 caminhos. 72 specs Jest verde. **6 commits.**
  - **Fase B.5** (noite): validação E2E sintética **6/6 ✓** com 8 valores cada (incluindo 4 valores de economia projetada). Cooperativa teste isolada (CNPJ 11.111.111/0001-11). Schema delta `Contrato.valorCheioKwhAceite` + 4 campos `Cobranca`. FIXO grava `valorBruto` (resolve Sprint 7 #4). Decisões B33.5 + B34 + B35 cristalizadas. **4 commits.**
  - **Fase C.1** (noite mais tarde): UI plano + simulação tempo real. Helper `web/lib/simular-plano.ts` com paridade matemática backend (6/6 ts-node ✓). Componentes `<PlanoSimulacao>` + `<CombinacaoAtual>`. Campos condicionais por modelo. Layout 2 colunas em `/dashboard/planos/novo`. **5 commits.**
  - **Total:** 19 commits + 1 commit de investigação inicial = **20 commits**. Validação matemática **48/48** (6 cenários × 8 valores ✓).
- **Detalhe completo:** `docs/sessoes/2026-05-03-resumo-sessao-completa.md`.

### Sessão 02/05 (mantida pra contexto longo)

- **Quando:** 2026-05-02 (manhã + tarde, ~7-8h com pausas)
- **Tipo:** Code (Fase 1 técnica + Fase 2.5 investigações + Fase 2.6 fechamento consolidado)
- **Resultado:** 12 pendências resolvidas (D-30O fix + 7 ajustes B + 2 sprints catalogados + D-30R catalogado + 6 áreas investigadas + revisão specs CooperToken + Área 1 expandida + SISGD-VISAO movido pra histórico). 2 decisões processuais novas (19 ritual, 20 validação por resposta). 4 débitos catalogados (D-30R, D-30S, D-30T) + 1 sugestão pendente (#3 cron sessões).

### Commits da sessão 2026-05-03 (cronologia, 20 commits)

**Investigação inicial (manhã):**
- `4caebe9` docs(investigacao): mapear engine CREDITOS_COMPENSADOS — D-30R + duplo desconto

**Fase A — Multi-tenant em Planos (manhã, 4 commits):**
- `69e2d6c` fix(planos): multi-tenant em CRUD + seed FIXO_MENSAL (Fase A)
- `5f70ce2` test(planos): cobrir multi-tenant Fase A — 20 cenarios
- `7722ce3` feat(planos-ui): UI condicional por perfil — escopo do plano
- `78d2d7b` docs(fase-a-planos): registra resolucao bugs cross-tenant + B13

**Fase B — Engine + snapshots + DINAMICO (tarde, 6 commits):**
- `eb7f0ce` feat(motor): helper calcularTarifaContratual + schema FaturaProcessada (Fase B)
- `070c1ab` fix(motor): aceitar() + 4 caminhos populam snapshots completos (D-30R)
- `f5453b7` fix(faturas): COMPENSADOS sem duplo desconto + DINAMICO implementado
- `00f64df` feat(planos): validacoes DTO V1-V3 + warnings V4 (Fase B)
- `4c8e946` test(faturas+motor): atualizar specs antigos sem duplo desconto (Fase B)
- `1319140` docs(fase-b-planos): D-30R resolvido + Decisao B33 aplicada

**Fase B.5 — Validação E2E + economia projetada (noite, 4 commits):**
- `a4ebf90` feat(schema): valorCheioKwhAceite (Contrato) + 4 economia (Cobranca)
- `b0e0345` feat(faturas+motor): FIXO grava valorBruto + 4 economia nos 3 modelos
- `718ca46` test(fase-b5): seed E2E 6 cenarios validados (cooperativa teste isolada)
- `840b10f` docs(fase-b5): playbook validacao E2E + tabela 8 colunas + IDs

**Fase C.1 — UI plano + simulação (noite mais tarde, 5 commits):**
- `8ffeb69` feat(web-lib): helper simular-plano + 6 specs paridade backend (Fase C.1)
- `cdb1eda` feat(planos-ui): componente <PlanoSimulacao> com painel em tempo real
- `eb82c0a` feat(planos-ui): campos condicionais por modelo + simulacao integrada
- `e0c1e7a` feat(planos-ui): helper visual baseCalculo + tipoDesconto + avisos V4
- `c550ff3` docs(fase-c1): registra conclusao Fase C.1 + 4 commits

**Fechamento (este grupo, 5 commits novos):**
- (a serem criados) docs(sessao+controle+produto+plano+debitos): consolidacao final 03/05

### Commits da sessão 2026-05-02

**Fase 1 (manhã):**
- `1301bb2` docs(ritual): cria ritual abertura/fechamento sessao
- `18845b0` docs(ritual): aprimora Decisao 19 + reorganiza pendencias P1/P2/P3
- `509002d` docs(processo): reclassifica D-30M + investiga D-30N/D-30O
- `7ea6943` feat(fase1): trabalho tecnico consolidado sessao 02/05
- `6eca970` docs(plano): atualiza PLANO-ATE-PRODUCAO com Fase 1 02/05

**Fase 2.5 (tarde):**
- `06b933f` docs(investigacao): 6 areas de produto read-only — 02/05 tarde
- `8cb8328` docs(investigacao): adiciona analise de specs CooperToken — gap completo
- `8e380aa` docs(investigacao): completa Area 1 — documentacao + Planos

**Fase 2.6 (fechamento):**
- `<este>` docs(sessao): consolidacao final 02/05 + Decisao 20 + SISGD-VISAO movido

### Arquivos tocados (sessão 02/05 + 03/05 fechamento)

- `~/.claude/.../memory/ritual_abertura_fechamento.md`
- `~/.claude/.../memory/regra_validacao_previa_e_retomada.md` (Decisão 20 adicionada)
- `~/.claude/.../memory/sugestoes_pendentes.md` (sugestão #3 adicionada)
- `~/.claude/.../memory/MEMORY.md`
- `CLAUDE.md` (raiz — disciplina validação Decisões 14/15/20 consolidadas)
- `backend/src/faturas/faturas.service.ts` (D-30O fix)
- `backend/src/faturas/faturas.service.d30o.spec.ts` (4 specs)
- `docs/PRODUTO.md` (7 ajustes Grupo B)
- `docs/REGULATORIO-ANEEL.md` (Assis→OpenClaw, limite 25% por classe, Caso A reescrito)
- `docs/PLANO-ATE-PRODUCAO.md` (Sprints 5a + 3a, Seção 0)
- `docs/debitos-tecnicos.md` (D-30M, D-30N, D-30O, D-30R + D-30S + D-30T)
- `docs/MAPA-INTEGRIDADE-SISTEMA.md` (referências SISGD-VISAO contextualizadas histórico)
- `docs/CONTROLE-EXECUCAO.md` (este arquivo)
- `docs/historico/SISGD-VISAO-COMPLETA-2026-04-26.md` (movido)
- `docs/sessoes/2026-05-02-investigacao-d30m-d30n-d30o.md`
- `docs/sessoes/2026-05-02-fase1-trabalho-tecnico-consolidado.md`
- `docs/sessoes/2026-05-02-investigacao-6-areas-produto.md`
- `docs/sessoes/2026-05-02-resumo-sessao-completa.md` (Bloco 9)

### Decisões registradas (cronológicas — completar lista total no fim do arquivo)

- **Decisão 19** (02/05 manhã): ritual abertura/fechamento de sessão
- **Decisão 20** (03/05 fechamento): validação prévia em CADA resposta + verificação de conflito antes de propor sprint
- **Decisão 23 aplicada 2× em 24h** (12/05 noite + 13/05 noite): (1) desfeita memória "AsaasCobranca=0 / 31 PAGAS = 100% baixa manual" → real é 5 via Asaas sandbox + 26 manual (Sprint 12 validation); (2) desfeita premissa "UI escreve em ConfigGateway / dual-path D-33 ATIVO" → real é UI escreve em AsaasConfig consistentemente / D-33 LATENTE só. Padrão: afirmação categórica de memória catalogada vira hipótese a re-validar via SQL/grep antes de planejar refator.
- **Decisão 24** (13/05 noite): frase de retomada vive em UM SÓ LUGAR + grep amplo (`voltei|frase de retomada|como retomar`) antes de atualizar (memória `ritual_abertura_fechamento.md`).
- **Sprint 5 ponto 3 atualizado** (04/05 noite — sessão claude.ai): UI v1 e API v1 só aceitam KWH_CHEIO/SEM_TRIBUTO. Decisão original "configura via API" virou letra morta desde Fase B (helper canônico throw NotImplementedException). Aplicado via `<option disabled>` + `@IsIn` no DTO + nota datada na sessão Sprint 5.
- **Adendo §11 spec CooperToken** (11/05 sessão Code, Commit 7): não retroatualiza §1-§10. 5 achados validados antes (Decisão 20): identidade SISGD vs CoopereBR, numeração de sprints (8/9/10), ConfigCooperToken vs ConfigDesvalorizacao, estado real do MVP, pré-requisitos P0 do refator. **D-30Z** catalogado (P3 documental, 85 cooperados intermediários `opcaoToken→modoRemuneracao`).
- **Reclassificações:** D-30M P1→P2, D-30N escopo expandido, D-30R catalogado novo
- **Resolvido:** D-30O (commit `7ea6943`)
- **Catalogados como sprints formais (Decisão 18):** Sprint 5a (Fio B), Sprint 3a (RN 482→Lei 14.300)
- **Catalogados como débitos:** D-30R (Motor.aceitar), D-30S (extrair Jornadas), D-30T (extrair Painéis), **D-30U (P2 — fórmula órfã motor.dimensionar, 04/05)**, **D-30V (P3 — unificação 3 fontes de verdade, 04/05)**
- **Catalogada como sugestão:** #3 Cron Análise Diária Sessões
- **Movido pra histórico:** SISGD-VISAO-COMPLETA.md (substituído por PRODUTO.md)

### Pendências consolidadas

→ Ver seção [PENDÊNCIAS PARA PRÓXIMA SESSÃO](#pendências-para-próxima-sessão) abaixo.

**Total restante:** ~32 decisões pendentes (B1-B32) + ~8 sprints potenciais (C1-C8).
**P1 = 0**. Pendências resolvidas hoje: 12.

### Próximos passos imediatos (priorizado P0 → P1 → P2 → P3)

**Fase B ✅ CONCLUÍDA em 13/05** (B.0 INDEX+SISTEMA esqueleto + B.1+B.2 débitos + B.3 Sprint Consolidado + B.4/B.5/B.6 fechamento). 11 fatias do Sprint Cadastros+Financeiro Consolidado catalogadas em `PLANO-ATE-PRODUCAO.md` Seção 3c.

**Sequência operacional Opção 4 (Plano Mestre, confirmada 12/05):**

A. ✅ **ETAPA 1 — H.2 SISTEMA.md base** [P0 — 2-3d Code] — **CONCLUÍDA 13/05** (Marco M1 entregue, 4 commits, 1.542 linhas).
B. ~~**Sub-fatia D-33 dual-path Asaas**~~ [P1 — 1-2d Code] — **REFRAMED 13/05 noite via Caminho B** (docs only, sem código). D-33 P1→P2 latente. **Não bloqueia mais Fatia A.**
C. **Fatia A canário Caminho A real** [P0 — 2-4d Code] — 1 cooperado real fim a fim Asaas sandbox CoopereBR. Marco M2. **Liberada** (D-33 não é mais pré-req).
D. **Fatia H.3 + D3 em paralelo** [Marco M3] — ligações cross-módulo + FaturaSaas completo Luciano→Parceiro (D-29F.1+.2+.3 decompostos).
E. **Fatia H.4 + B em paralelo** [Marco M4] — fluxos end-to-end + multa/juros mínimo.
F. **Fatia C** [Marco M6 — janela disponível] — specs Jest módulo CooperToken (6-8h, autônomo).
G. **Médio prazo** — D1 (conciliação BB/Sicoob) + D2 (DRE/fechamento) + G (débitos cumulativos).
H. **Longo prazo** — E (polish cadastros) + F (painel super-admin) + L (UI auto-config Asaas parceiro).

### Frase de retomada

> Ver seção canônica [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo. Frase DIRETA pronta pra colar no Claude Code (VS Code) — comanda ação imediata em vez de descrever plano (feedback `feedback_frase_retomada_direta.md` 12/05 noite).

---

## ARQUIVOS PRA LER NA RETOMADA (sessão 04/05/2026)

Ordem recomendada (15 min de leitura total):

1. `docs/CONTROLE-EXECUCAO.md` (este arquivo) — visão geral do estado
2. `docs/sessoes/2026-05-03-resumo-sessao-completa.md` — o que foi feito em 03/05 (4 fases)
3. `docs/sessoes/2026-05-03-fase-b5-validacao-e2e.md` — playbook validação (referência matemática dos 6 cenários)
4. `docs/PLANO-ATE-PRODUCAO.md` — onde estamos no roadmap

Opcional (se for atacar Fase C.2 direto):
5. `web/app/dashboard/planos/novo/page.tsx` — tela atual (referência pra estender)
6. `web/components/PlanoSimulacao.tsx` — componente reusável (Fase C.1)
7. `web/components/CombinacaoAtual.tsx` — componente helper visual baseCalculo + tipoDesconto
8. `web/lib/simular-plano.ts` — helper canônico frontend

---

## FRASE DE RETOMADA — próxima sessão Code

Cola direto no Claude Code (VS Code) quando voltar:

```
PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior).
   Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents.

2. Rodar `git status --short`. Esperado: working tree limpo (untracked
   carry-overs catalogados). Último commit eh o de fechamento Sprint
   Blindagem Multi-Tenant Fase 0 (D-novo-BR F0).

3. Rodar `pm2 list`. Esperado: cooperebr-backend + cooperebr-frontend online.

PASSO 1 — Onde paramos + Próximo bloco:

Sprint Blindagem Multi-Tenant Fase 0 (D-novo-BR F0) entregue 100%
em 1 sessão Code (31/05), 3 commits, 5 sub-fatias atômicas.
**26 IDORs corrigidos** (19 Onda A + 7 críticos Onda B) usando
padrão consolidado em D-novo-BQ:

F0.1 — administradoras (CA1+CA2+AA1) + modelos-cobranca (AA9+AA10+
AA11). Modelos GLOBAL (cooperativaId=null) agora SOMENTE SUPER_ADMIN
pode alterar (impacto sistêmico — modelo usado por todos tenants).

F0.2 — documentos (AA2+AA3+AA4+MA1). Posse via cooperado.cooperativaId
(helper carregarComPosse). Não dispara WhatsApp cross-tenant.

F0.3 — ocorrencias (AA5+AA6+MA2) + prestadores (AA7+AA8+MA3). DTOs
sanitizados (cooperativaId REMOVIDO de CreatePrestadorDto/Update).
MA2 ocorrencias.create valida cooperadoId pertence ao tenant.

F0.4 — condominios (MA4+BA1) + observador (AA12). body-injection
bloqueado em condominios.create. calcularRateio filtrado por tenant.
lead-expansao @Public OUT-OF-SCOPE (sem JWT, requer guard diferente).

F0.5 — 7 CRÍTICOS Onda B: notificacoes.marcarComoLida (buildWhere
existente, no-op silencioso); asaas.cancelarCobranca (posse via
cooperado, SA descobre tenant pro getApiClient); integracao-bancaria
3 (cancelarCobranca posse ANTES da API banco BB/Sicoob IRREVERSIVEL,
criarConfig body→JWT, atualizarConfig posse); whatsapp 2 (DELETE
modelos global-only-SA + tenant-scoped dono-only, POST disparar-
cobrancas bloqueia parceiroId≠JWT pra ADMIN).

VALIDAÇÃO SPRINT COMPLETO:
- 55/55 specs F0 verdes (11 arquivos *-idor-br.spec.ts).
- 111/111 specs IDOR total verdes (56 D-novo-BQ + 55 D-novo-BR F0).
- 23/23 cenários runtime cross-tenant validados em smoke programático
  (scripts/smoke-br-f0-idor.ts) contra Postgres real.
- Asserções runtime: cobrança bancária B PENDENTE; modelo whatsapp B
  + global NÃO deletados; notificação B NÃO marcada como lida; config
  bancária clientId NÃO substituído; criarConfig usa cooperativaId
  injetado (não body); ocorrência + prestador + observação B intactos.

PADRÕES CONSOLIDADOS (4 categorias):
1. Posse direta: findFirst({id, cooperativaId}) + null bypass
2. Posse via relação: findFirst({id, <rel>: {cooperativaId}})
3. Body→JWT: helper resolverTenant (ADMIN sempre JWT, SA pode body)
4. Global-only-SA: cooperativaId=null = recurso compartilhado, só SA

DÉBITOS:
- D-novo-BR F0 ✅ IMPLEMENTADO (26 IDORs)
- D-novo-BR F1-F4 📋 ABERTOS (AsyncLocalStorage + Prisma Extension
  + residuais + testes)
- BQ.6/BQ.7 ✅ inclusos em F0; BQ.8 (24 altos+médios Onda B) defer F3

PRÓXIMO BLOCO — LUCIANO ESCOLHE (5 opções):

(1) D-novo-BR F1 — Fundação AsyncLocalStorage + interceptor +
   runWithTenant + escape hatch runAsPlatform (~3-4 dias). BASE
   obrigatória pra F2 Extension. Crons/webhooks pré-requisito.

(2) D-novo-BR F2 — Prisma Client Extension auto-inject cooperativaId
   nos ~52 models (~2-3 dias). REQUER F1. Previne reincidência
   (endpoint novo já nasce protegido).

(3) F.4 — Smoke E2E pós-BR F0 (~1-2h). 10 fluxos críticos pra
   garantir caminho feliz após 26 patches (cobranças, ativações,
   vincular fatura, alocar usina, aprovar proposta, cancelar boleto).

(4) Sprint Contabilidade Tributária Segregada (#8 roadmap, ~40-60h).

(5) Convergência portal /parceiro vs /dashboard (D-novo-BP P3, ~20-30h).

REGRA INEGOCIÁVEL: antes de propor qualquer bloco aprovado, aplicar
Fase 1 read-only mini (~10-15min) — feedback_fase1_readonly_obrigatoria
catalogado. Não tocar código antes de OK Luciano explícito.

CONSTRAINTS FUNDAMENTAIS APLICÁVEIS:
- Decisão 23: Fase 1 read-only OBRIGATÓRIA antes de tocar código.
- Padrão fix IDOR (4 categorias) catalogado em D-novo-BR — aplicar
  em qualquer endpoint novo de mutação.
- Escape hatch runAsPlatform() PRÉ-REQUISITO pra F2 (crons/webhooks
  rodam sem request — Extension cega quebra silenciosamente).
- Multi-tenant: TODA query Prisma filtra por cooperativaId.
- isAmbienteReal() em endpoints dev (NUNCA NODE_ENV).
- Regra contatos teste: 27981341348 + lucbragatto@gmail.com.
- Decisão 24: frase de retomada local único.
- Regra Code não-paralelo: claude.ai aguarda Code reportar.

PRE-REQUISITOS LEITURA (ordem fixa):
1. docs/CONTROLE-EXECUCAO.md (este arquivo, seção ## ONDE PARAMOS topo)
2. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md
3. docs/sessoes/2026-05-31-sprint-blindagem-multi-tenant-fase0.md
4. docs/debitos-tecnicos.md (D-novo-BR F0 ✅; F1-F4 abertos)
5. (se F1/F2) docs/arquitetura/blindagem-multi-tenant-sistemica.md
6. docs/MAPA-INTEGRIDADE-SISTEMA.md
7. CLAUDE.md + .claude/CLAUDE.md
8. git log --oneline -15

CARRY-OVERS (nao-bloqueantes, mantidos):
- 10 erros TS pré-existentes em backend/src/agents/ (untracked, módulo
  experimental local, sequer está no git — backend roda OK porta 3000)
- lead-expansao POST @Public requer guard diferente (rate-limit) → F3
- EmailLog schema sem cooperativaId → F3
- 24 IDORs altos+médios Onda B (monitoramento-usinas, email, asaas
  listar, whatsapp listas/fluxos/etc) → defer F3 ou após F2
- usinas.controller.spec.ts pré-existente (TestingModule deps)
- D-novo-BM (P0 BLOQUEADOR REMOÇÃO PRÉ-PROD)
- D-novo-BP (P3 convergência portal — sprint refator UX futuro)
- D-novo-BJ (P2 LGPD URL assinada comprovantes)
- D-novo-BK (P3 storage S3/Supabase)
- D-novo-BG (P3 anomalia GD Linhares)
- D-novo-BC (P2 paridade campos edição usina)
- D-novo-BA/AZ classe GD restantes
- D-novo-AS.2 (P2 hook PostToolUse build → pm2 restart)
- 30+ scripts utilitários untracked em backend/scripts/

FRENTES OPERACIONAIS LUCIANO (acumulado, inalterado):
⏳ PRIORITARIO: Preencher cooperebr1 (gatilho F.4 smoke produção)
⏳ Cadastrar Usuario E-Solares real
⏳ Revisar relatório auditoria classe GD + decidir corrigir DIVERGÊNCIAS
⏳ Definir matriz responsabilidadeDespesas
⏳ Definir valorKwhPadrao OU TarifaConcessionaria EDP_ES
⏳ Obter credenciais Sungrow/iSolar Cloud com E-Solares
⏳ Obter script.sql do hb06a (libera Sub-Sprint B ETL)
⏳ Obter .pfx sandbox Banestes
⏳ Decisões regulatórias Sub-Sprint A (advogado)

DOC-SESSAO SPRINT BR F0 COMPLETO: docs/sessoes/2026-05-31-sprint-
blindagem-multi-tenant-fase0.md
```

---

### Frase Sprint IDOR D-novo-BQ (anterior, arquivada)

```
[FRASE DO SPRINT D-novo-BQ — substituída acima pelo Sprint Blindagem F0 31/05]

Sprint Segurança IDOR (D-novo-BQ) entregue 100% em 1 sessão Code
maratona (30/05), 5 commits 3e23f81..5470280, 4 fatias atômicas +
auditoria automatizada:

AUDITORIA — Audit Dynamic Workflow (1º uso no projeto): 28 sub-agentes
paralelos, Opus 4.8, 4 min, 1.437.072 tokens. Varreu 61 endpoints de
mutação em 5 grupos núcleo. 18 IDORs confirmados (7 críticos + 8 altos
+ 3 médios). Relatório: docs/relatorios/2026-05-30-auditoria-idor-workflow.md.

BQ.1 (9aca267) — 7 críticos entidades núcleo: contratos.update + usinas
update/remove + ucs update/remove + geracao-mensal update/remove.
Padrão findFirst({id, cooperativaId}) + SUPER_ADMIN bypass via findUnique.
21 specs + smoke 12/12 cross-tenant runtime.

BQ.2 (7185db2) — 3 críticos config + 1 financeiro: config-cobranca
body-injection (helper resolverTenant ADMIN-JWT vs SUPER_ADMIN-body) +
motor-proposta aprovar-presencial (posse via cooperado) +
cooper-token confirmar-compra (guard ANTES de creditarSaldoParceiro
+ eventEmitter.emit). 17 specs (A6 valida saldo NÃO creditado +
evento NÃO disparado) + smoke 12/12 (saldo B 0→0 ataque; 0→1000 SA).

BQ.3 (d17ac3f) — 4 altos + 1 médio: faturas.vincularFaturaManual +
cooperados.registrarFaturaMensal + cooperados.alocarUsina +
motor-proposta.enviarAprovacao + motor-proposta.uploadModelo (body→JWT).

BQ.4 (d17ac3f) — 2 médios indicações: registrarIndicacao (posse
indicador+indicado, defesa em profundidade BadRequest se cross-tenant)
+ processarPrimeiraFaturaPaga (findMany filtra cooperativaIdJwt).

BQ.3+BQ.4: 18 specs + smoke 11/11 (A1: cooperadoId/ucId fatura B
intactos; A7: tokenAprovacao NÃO sequestrado; M3: indicação B continua
PENDENTE).

VALIDAÇÃO SPRINT COMPLETO:
- 56 specs isolamento verdes (21 BQ.1 + 17 BQ.2 + 18 BQ.3+BQ.4).
- 35 cenários runtime cross-tenant validados em 3 smokes programáticos
  (12+12+11) com cleanup automático.
- 13 services + 8 controllers modificados.
- Backwards-compat 100% preservada (specs antigos verdes via condicional).
- Build limpo + pm2 backend online estável.

PADRÕES CONSOLIDADOS:
1. Posse: findFirst({id, cooperativaId}) + SUPER_ADMIN null→findUnique
2. body→JWT: helper resolverTenant (ADMIN sempre JWT, SA pode body)
3. Posse financeira: guard ANTES de side-effect (cooperToken A6)
4. Derivação removida: cooperativaIdJwt authoritative; defesa em
   profundidade rejeita inconsistências mesmo no caminho legacy

DÉBITOS:
- D-novo-BQ: BQ.1-BQ.4 ✅ IMPLEMENTADO
- BQ.5 📋 ABERTO — ampliar auditoria pros ~50 services restantes
  (Audit Dynamic Workflow reaproveitável; pré-req desejável antes de
  onboarding Sinergia em escala)

PRÓXIMO BLOCO — LUCIANO ESCOLHE (4 opções):

(1) BQ.5 — Ampliar auditoria IDOR pros ~50 services restantes
   (Workflow Opus 4.8 reaproveitável; ~1 sessão maratona similar)
   Resolve isolamento total. Recomendado antes de Sinergia em escala.

(2) F.4 — Smoke E2E pós-IDOR (~1-2h) — rodar 10 fluxos críticos
   pra garantir caminho feliz após os 21 patches (cobranças,
   ativações, vincular fatura, alocar usina, aprovar proposta).

(3) Sprint Contabilidade Tributária Segregada (#8 roadmap, ~40-60h)
   Lê despesas BH + repasses AN como base contábil segregada
   (Lei 5.764/71 Art. 79 + STF Tema 536).

(4) Convergência portal /parceiro vs /dashboard (D-novo-BP P3,
   ~20-30h sprint refator UX). 30 páginas em /parceiro vs evolução
   funcional em /dashboard.

REGRA INEGOCIÁVEL: antes de propor qualquer bloco aprovado, aplicar
Fase 1 read-only mini (~10-15min) — feedback_fase1_readonly_obrigatoria
catalogado. Não tocar código antes de OK Luciano explícito.

CONSTRAINTS FUNDAMENTAIS APLICÁVEIS:
- Decisão 23: Fase 1 read-only OBRIGATÓRIA antes de tocar código.
- Padrão fix IDOR (novo padrão de referência): posse via findFirst +
  SUPER_ADMIN bypass; aplicar em qualquer endpoint novo de mutação.
- Padrão UX Dual 17/05: novas telas/CRUD seguem Tipo B (página própria).
- D-novo-AS complemento (lição BN): build web → pm2 restart frontend.
- Multi-tenant: TODA query Prisma filtra por cooperativaId.
- isAmbienteReal() em endpoints dev (NUNCA NODE_ENV).
- Regra contatos teste: 27981341348 + lucbragatto@gmail.com.
- Decisão 24: frase de retomada local único (este arquivo + doc-sessão).
- Regra Code não-paralelo: claude.ai aguarda Code reportar.

PRE-REQUISITOS LEITURA (ordem fixa):
1. docs/CONTROLE-EXECUCAO.md (este arquivo, seção ## ONDE PARAMOS topo)
2. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md
3. docs/sessoes/2026-05-30-sprint-seguranca-idor-completo.md
4. docs/debitos-tecnicos.md (D-novo-BQ BQ.1-BQ.4 ✅; BQ.5 aberto)
5. docs/relatorios/2026-05-30-auditoria-idor-workflow.md (se BQ.5)
6. docs/MAPA-INTEGRIDADE-SISTEMA.md
7. CLAUDE.md + .claude/CLAUDE.md
8. git log --oneline -15

CARRY-OVERS (nao-bloqueantes, mantidos):
- usinas.controller.spec.ts falha pré-existente (TestingModule deps,
  não relacionada ao IDOR — confirmada via git stash antes do BQ.1)
- 6 erros TS pré-existentes em scripts/ (excluídos do build)
- D-novo-BM (P0 BLOQUEADOR REMOÇÃO PRÉ-PROD — reparo AN.3.1 não altera)
- D-novo-BP (P3 convergência portal — sprint refator UX futuro)
- D-novo-BJ (P2 LGPD URL assinada comprovantes)
- D-novo-BK (P3 storage S3/Supabase)
- D-novo-BG (P3 anomalia GD Linhares)
- D-novo-BC (P2 paridade campos edição usina)
- D-novo-BA/AZ classe GD restantes
- D-novo-AS.2 (P2 hook PostToolUse build → pm2 restart)
- 30+ scripts utilitários untracked em backend/scripts/

FRENTES OPERACIONAIS LUCIANO (acumulado, inalterado):
⏳ PRIORITARIO: Preencher cooperebr1 (gatilho F.4 smoke produção)
⏳ Cadastrar Usuario E-Solares real
⏳ Revisar relatório auditoria classe GD + decidir corrigir DIVERGÊNCIAS
⏳ Definir matriz responsabilidadeDespesas
⏳ Definir valorKwhPadrao OU TarifaConcessionaria EDP_ES
⏳ Obter credenciais Sungrow/iSolar Cloud com E-Solares
⏳ Obter script.sql do hb06a (libera Sub-Sprint B ETL)
⏳ Obter .pfx sandbox Banestes
⏳ Decisões regulatórias Sub-Sprint A (advogado)

DOC-SESSAO SPRINT IDOR COMPLETO: docs/sessoes/2026-05-30-sprint-seguranca-idor-completo.md
```

---

### Frase Sprint AN (anterior, arquivada)

```
[FRASE DO SPRINT D-novo-AN — substituída acima pelo Sprint Segurança IDOR 30/05]

Sprint D-novo-AN (RepasseProprietario) entregue 100% em 1 sessão Code
dia inteiro (30/05), 5 commits 37f7af0..2f6fb29, 5 fatias canônicas +
1 bug bônus reparado:

AN.1 (37f7af0) — schema delta aditivo (model RepasseProprietario +
2 enums StatusRepasseProprietario/MetodoPagamentoRepasse + @@unique
([usinaId, periodoInicio, periodoFim]) idempotência forte + back-ref
ContaAPagar.repasseAbatido) + service workflow PENDENTE→PAGO/CANCELADO
(transação atômica marcarPago vincula despesas DESCONTO_NO_REPASSE
pendentes do período via repasseAbatidoId) + 4 DTOs class-validator +
19 specs Jest. Migration aplicada via ritual PM2 CLAUDE.md.

AN.2 (2f36470) — Controller REST 6 endpoints (GET /repasses, GET
/repasses/proprietario, GET /repasses/:id, PUT /:id/marcar-pago, PUT
/:id/cancelar, POST /upload-comprovante) + integração nativa cron BH.5
em $transaction([createRepasse PENDENTE, createArrendamento]) com
resolução Caminho A/B do proprietarioUsuarioId + refator endpoint
/proprietario/repasses lendo tabela com fallback PREVISTO_FALLBACK +
13 specs + smoke E2E HTTP 12/12 ✅.

AN.3 (a3b351a) — 2 telas admin (/dashboard/usinas/[id]/repasses Tipo B
por usina + /dashboard/repasses Tipo B global cross-usinas) +
componentes compartilhados web/components/repasses/{types,
DialogMarcarPago, DialogCancelar} (Tipo C) + refator portal
/proprietario/repasses (3 KPIs novos previsto YTD/recebido YTD/
pendentes + tipo REAL/FALLBACK + colunas Valor pago/Data pgto/Status
real + link comprovante) + sidebar item "Repasses" Operacional
(ícone Wallet) + card cruzado verde em /dashboard/usinas/[id] +
UploadComprovante parametrizado (prop opcional endpoint).

AN.3.1 (3a8a90e) — FIX D-novo-BM painel credenciais voltava pro /login
em uso real (causa: token impersonate TTL 1h expirado → useContexto
GET /auth/me → interceptor global lib/api.ts redirect). Fix duplo
(A) backend TTL impersonate 1h→8h (dev-only, mantém gating
isAmbienteReal+SA+AuditLog+TTL) + (B) frontend interceptor allowlist
self-recovery (/dashboard/dev/credenciais-teste, /selecionar-contexto)
com UI inline sessaoExpirada + botões "Ir pra /login"/"Tentar de novo".
Trigger manual cron criou 1 RepasseProprietario PENDENTE 04/2026
R$1k (cmprfu9z90001vajcefj2xaiz) pro Luciano testar marcar-pago via UI.
Investigação read-only /parceiro vs /dashboard: 30 páginas vivas em
/parceiro, sidebar parceiro já encaminha Membros pra /dashboard/cooperados,
recomendação opção b (convergir Usinas) — acatada em AN.4.

AN.4 (2f6fb29) — FIX cards parceiro (sidebar /parceiro/layout.tsx:54
href /parceiro/usinas → /dashboard/usinas; /parceiro/usinas/page.tsx
vira redirect protegendo bookmarks) + backfill histórico idempotente
(scripts/backfill-repasses-proprietario.ts dry-run default + --apply,
executado: 3 criados PENDENTE 02/03/05 2026, 04/2026 SKIP preservado,
2ª execução 0 criados 4 SKIP) + notificarRepassePago em
NotificacoesProativasService (email + WA whitelist LGPD com fallback
Caminho A/B + proteção status PAGO + warn sem destinatário) + wireup
fire-and-forget no marcarPago + PDF mensal seção "Status do Repasse"
3 estados (PAGO verde / CANCELADO cinza / PENDENTE amarelo / sem
registro neutro) removendo heurística fake "mês passado = PAGO".

VALIDAÇÃO SPRINT COMPLETO:
- 36/36 specs Jest verdes (21 service + 10 controller + 5 notificação).
- 3 smokes programáticos: 8/8 service AN.1 + 12/12 endpoints AN.2 +
  script backfill 3 criados + 2ª execução 0 idempotência ✅.
- Smoke HTTP AN.3: 4/4 rotas → 307 (auth-gate normal).
- Build web Turbopack clean em 4 ciclos.
- PM2 backend + frontend online estáveis.

ESTADO BANCO PÓS-SPRINT:
- 4 RepasseProprietario PENDENTE (02/03/04/05 2026) — todos R$1k
  exceto 05 com R$0 (despesas DESCONTO_NO_REPASSE acumuladas).
- ContaAPagar.repasseAbatidoId populado em prod quando admin marca PAGO.

DÉBITOS NOVOS CATALOGADOS:
- D-novo-AN ✅ IMPLEMENTADO 100% (5 commits).
- D-novo-BP P3 (NOVO) — Convergência portal /parceiro vs /dashboard
  (30 páginas vivas em /parceiro, sidebar já encaminhando entidades
  complexas pra /dashboard/*; sprint refator UX futuro, não-bloqueador).

PRÓXIMO BLOCO — LUCIANO ESCOLHE (6 opções):

(A) F.4 smoke produção (~1-2h) — BLOQUEADO Luciano operacional
   (preencher cooperebr1 real + cadastrar Usuario E-Solares).

(B) Sprint Contabilidade Tributária (#8 roadmap, ~40-60h) — lê
   despesas BH + repasses AN como base contábil segregada (Lei
   5.764/71 Art. 79 + STF Tema 536). Pode ser kickoff longo.

(C) Sub-Sprint B ETL legado→novo — BLOQUEADO script.sql hb06a.

(D) Sungrow integração real (~2-3h) — BLOQUEADO credenciais
   E-Solares.

(E) Convergência /parceiro→/dashboard (D-novo-BP, sprint refator
   UX futuro 20-30h se opção 1 total ou 2 seletiva).

(F) Remoção D-novo-BM painel credenciais (quando for produção
   real — checklist 9 passos catalogado em docs/debitos-tecnicos.md
   item D-novo-BM).

REGRA INEGOCIÁVEL: antes de propor qualquer bloco aprovado, aplicar
Fase 1 read-only mini (~10-15min) — feedback_fase1_readonly_obrigatoria
catalogado. Não tocar código antes de OK Luciano explícito.

CONSTRAINTS FUNDAMENTAIS APLICÁVEIS:
- Decisão 23: Fase 1 read-only OBRIGATÓRIA antes de tocar código.
- Padrão UX Dual 17/05: novas telas/CRUD seguem Tipo B (página
  própria) ou Tipo A (inline). Nunca Dialog pra criar/editar entidade
  inteira.
- D-novo-AS complemento (lição BN): npm run build web → pm2 restart
  frontend IMEDIATO. Sem exceção (aplicado 8× neste sprint).
- Multi-tenant: TODA query Prisma filtra por cooperativaId.
- isAmbienteReal() em endpoints dev (NUNCA NODE_ENV).
- Regra contatos teste: 27981341348 + lucbragatto@gmail.com se houver
  disparo real.
- Decisão 24: frase de retomada local único (este arquivo + doc-sessão).
- Regra Code não-paralelo: claude.ai aguarda Code reportar.

PRE-REQUISITOS LEITURA (ordem fixa):
1. docs/CONTROLE-EXECUCAO.md (este arquivo, seção ## ONDE PARAMOS topo)
2. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md
3. docs/sessoes/2026-05-30-sub-sprint-an-repasse-proprietario-completo.md
4. docs/debitos-tecnicos.md (D-novo-AN IMPLEMENTADO + D-novo-BP novo)
5. docs/MAPA-INTEGRIDADE-SISTEMA.md
6. docs/PLANO-ATE-PRODUCAO.md
7. CLAUDE.md + .claude/CLAUDE.md
8. git log --oneline -15 (último: 2f6fb29 AN.4 + commit fechamento)

CARRY-OVERS (nao-bloqueantes, mantidos):
- D-novo-BM (P0 BLOQUEADOR REMOÇÃO PRÉ-PROD — reparo funcional AN.3.1
  não altera status; checklist 9 passos pra remover catalogado)
- D-novo-BP (P3 NOVO convergência portal — sprint refator UX futuro)
- D-novo-BJ (P2 LGPD URL assinada comprovantes — agora vale pra repasses)
- D-novo-BK (P3 storage S3/Supabase)
- D-novo-BG (P3 anomalia GD Linhares)
- D-novo-BC (P2 paridade campos edição usina)
- D-novo-BA/AZ classe GD restantes
- D-novo-AS.2 (P2 melhoria hook PostToolUse build → pm2 restart)
- 30+ scripts utilitários untracked em backend/scripts/
- .agent/memory/.dreams/ + shared markdowns

FRENTES OPERACIONAIS LUCIANO (acumulado, inalterado):
⏳ PRIORITARIO: Preencher cooperebr1 (gatilho F.4 smoke produção)
⏳ Cadastrar Usuario E-Solares real
⏳ Revisar relatório auditoria classe GD + decidir corrigir DIVERGÊNCIAS
⏳ Definir matriz responsabilidadeDespesas
⏳ Definir valorKwhPadrao OU TarifaConcessionaria EDP_ES
⏳ Obter credenciais Sungrow/iSolar Cloud com E-Solares
⏳ Obter script.sql do hb06a (libera Sub-Sprint B ETL)
⏳ Obter .pfx sandbox Banestes
⏳ Decisões regulatórias Sub-Sprint A (advogado)

DOC-SESSAO SPRINT AN COMPLETO: docs/sessoes/2026-05-30-sub-sprint-an-
repasse-proprietario-completo.md
```

---

---

---

---

---

## ARCHIVE — frase Sprint BH COMPLETO (deprecada — substituída pelo Sprint AN de 30/05 noite)

```
[Frase do Sprint BH preservada apenas pra rastreabilidade. Sprint
COMPLETO AN consolidado em 30/05 noite — ver frase ativa acima.]

PASSO 0 (idêntico).

PASSO 1 — Onde paramos + Próximo bloco:

Sprint D-novo-BH (Despesas Operacionais Camada 2) entregue 100% em 2
sessões Code (28-29/05 + 29-30/05), 10 commits bb838ec..77eeb24, 7 fatias
canônicas + 3 bugs/débitos bônus resolvidos:

BH.1 (bb838ec) — workflow PROPOSTA/APROVADA/REJEITADA + tratamento
(REEMBOLSO/DESCONTO_NO_REPASSE/ASSUMIDO) + responsavelPagamento.

BH.2 (62eddde) — endpoints REST /contas-pagar/{operacionais,proprietario,
propor,upload-comprovante,:id/{aprovar,rejeitar,resolver}} + notificação
proativa (email+WA whitelist LGPD).

BH.3 (8d045af) — tela admin /dashboard/usinas/[id]/despesas (4 KPIs +
3 TabsCustom).

BH.3.1 (44f5e53) — refator UX página própria /nova corrigindo violação
Padrão UX Dual Tipo B detectada em BH.3 + DespesaForm + UploadComprovante.

BH.3.2 (543a835) — workflow double-check UNIVERSAL (TODOS perfis criam
PROPOSTA) + self-approval guard backend.

BH.4 (9858c45) — Portal Proprietário + flag Cooperativa.proprietarioVeDespesas
+ GET /proprietario/meu-parceiro + PUT /cooperativas/:id/proprietario-ve-
despesas + tela admin /dashboard/configuracoes/portal-proprietario +
Super Admin bypass tenant (D-novo-BL RESOLVIDO inline) + IDOR guard
PROPRIETARIO em proporDespesa.

D-novo-BN P0 (03f49fc) — ChunkLoadError Turbopack stale resolvido em
15min. Lição catalogada (D-novo-AS complemento): npm run build web
SEMPRE seguido de pm2 restart frontend IMEDIATO.

D-novo-BM (1cdb9cb) — Painel Credenciais Teste Opção B implementado +
elevado P0 BLOQUEADOR REMOÇÃO PRÉ-PROD com checklist 9 passos.

BH.5 (77eeb24) — helper calcularRepasseLiquido (envelope sobre
calcularRepasse puro, intacto) + 7 consumidores migrados + cron mensal
@Cron('0 3 1 * *', tz São Paulo) cria ARRENDAMENTO_USINA APROVADA+
RESOLVIDA+ASSUMIDO+PARCEIRO idempotente + endpoint manual trigger
DEV-only.

VALIDAÇÃO SPRINT COMPLETO:
- 55 specs Jest verdes (30 contas-pagar + 11 cooperativas + 7 auth-dev
  + 13 BH.5 + 1 IDOR PROPRIETARIO).
- 3 smokes programáticos: 8/8 BH.4 + 8/8 BM + 8/8 BH.5 = 24/24 ✅.
- Build web Turbopack clean em 4 ciclos sem regressão.
- PM2 backend + frontend online estáveis.

PRÓXIMO BLOCO APROVADO — D-novo-AN (RepasseProprietario tabela):

Aprovado por Luciano durante esta sessão. Sprint próprio backend.
BH.5 deixou terreno pronto: campo ContaAPagar.repasseAbatidoId nullable
ja existe, esperando popular quando AN entregar. Estimativa preliminar
2-3h backend (schema + model + endpoints CRUD + cron geração mensal
vinculando despesas DESCONTO_NO_REPASSE como abatidas).

REGRA INEGOCIÁVEL — começar com Fase 1 read-only MINI do AN (~10-15min)
ANTES de propor escopo. Não tocar código antes de OK Luciano:

1. Confirmar schema atual: ContaAPagar.repasseAbatidoId está null em
   todas as despesas? Quais models existem ligando proprietario→repasse?
2. Confirmar consumidores de calcularRepasseLiquido: como devem persistir
   o RepasseProprietario quando AN entregar? Cron mensal cria repasse +
   abate despesas em transação atômica?
3. Confirmar UX: precisa tela admin pra ver repasses históricos? Portal
   proprietário ja mostra repasses (via /proprietario/repasses) — vira
   read direto da tabela ou continua calculado on-the-fly?
4. Identificar dependências: cron BH.5 vai criar despesa ARRENDAMENTO
   ANTES ou DEPOIS do RepasseProprietario? Ordem importa pra idempotência.

Reportar Fase 1 + propor escopo + aguardar OK Luciano antes de Fase 2.

CONSTRAINTS FUNDAMENTAIS APLICÁVEIS:
- Decisão 23: Fase 1 read-only OBRIGATÓRIA antes de qualquer escrita.
- D-novo-AS complemento (lição BN): npm run build web → pm2 restart
  frontend IMEDIATO. Sem exceção.
- Padrão UX Dual 17/05: novas telas/CRUD seguem Tipo B (página própria)
  ou Tipo A (inline). Nunca Dialog pra criar/editar entidade inteira.
- Multi-tenant: TODA query Prisma filtra por cooperativaId.
- isAmbienteReal() em endpoints dev (NUNCA NODE_ENV).
- Regra contatos teste: 27981341348 + lucbragatto@gmail.com se houver
  disparo real.
- Decisão 24: frase de retomada local único (este arquivo + doc-sessão).
- Regra Code não-paralelo: claude.ai aguarda Code reportar.

PRE-REQUISITOS LEITURA (ordem fixa):
1. docs/CONTROLE-EXECUCAO.md (este arquivo, seção ## ONDE PARAMOS topo)
2. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md
3. docs/sessoes/2026-05-30-sub-sprint-bh-despesas-camada-2-completo.md
4. docs/debitos-tecnicos.md (D-novo-BH IMPLEMENTADO + AN catalogado)
5. backend/src/usinas/helpers/calcular-repasse-liquido.ts (entender
   integração BH.5)
6. backend/src/contas-pagar/repasse-mensal.cron.ts (entender geração
   automática ARRENDAMENTO_USINA)
7. backend/prisma/schema.prisma seção ContaAPagar (campo
   repasseAbatidoId nullable pronto)
8. docs/MAPA-INTEGRIDADE-SISTEMA.md
9. CLAUDE.md + .claude/CLAUDE.md
10. git log --oneline -15 (último: 77eeb24 BH.5 + commit fechamento)

CARRY-OVERS (nao-bloqueantes, mantidos):
- D-novo-BM (P0 BLOQUEADOR REMOÇÃO PRÉ-PROD — implementado, checklist 9
  passos pra remover quando primeiro parceiro real entrar)
- D-novo-BG (P3) anomalia GD Linhares
- D-novo-BJ (P2 LGPD) URL assinada comprovantes
- D-novo-BK (P3) storage S3/Supabase
- D-novo-BC (P2) paridade campos edição usina
- D-novo-BA/AZ classe GD restantes
- D-novo-AS.2 (P2 melhoria) hook PostToolUse build → pm2 restart frontend
- 30+ scripts utilitários untracked em backend/scripts/
- .agent/memory/.dreams/ + shared markdowns

FRENTES OPERACIONAIS LUCIANO (acumulado, inalterado):
⏳ PRIORITARIO: Preencher cooperebr1 (gatilho F.4 smoke produção)
⏳ Cadastrar Usuario E-Solares real
⏳ Revisar relatório auditoria classe GD + decidir corrigir DIVERGÊNCIAS
⏳ Definir matriz responsabilidadeDespesas
⏳ Definir valorKwhPadrao OU TarifaConcessionaria EDP_ES
⏳ Obter credenciais Sungrow/iSolar Cloud com E-Solares
⏳ Obter script.sql do hb06a (libera Sub-Sprint B ETL)
⏳ Obter .pfx sandbox Banestes
⏳ Decisões regulatórias Sub-Sprint A (advogado)

DOC-SESSAO SPRINT BH COMPLETO: docs/sessoes/2026-05-30-sub-sprint-bh-
despesas-camada-2-completo.md
```

---

---

---

---

---

## ARCHIVE — frase Sprint BH M37-M40 parcial (deprecada — substituída pelo fechamento COMPLETO de 30/05)

```
[Frase parcial preservada apenas pra rastreabilidade do incidente BN.
Sprint COMPLETO consolidado em 30/05 — ver frase ativa acima.]

PASSO 0 (idêntico ao acima).

PASSO 1 — Onde paramos + Fila prioritária:

Sessao 28-29/05 entregou **Sub-Sprint BH (M37→M40) D-novo-BH Despesas
Operacionais Camada 2 — FECHAMENTO PARCIAL** (6 commits bb838ec..9858c45):

BH.1 (M37, bb838ec) — workflow PROPOSTA→APROVADA→REJEITADA + tratamento
(REEMBOLSO/DESCONTO_NO_REPASSE/ASSUMIDO) + responsavelPagamento + race
condition guard.

BH.2 (M38, 62eddde) — endpoints REST /contas-pagar/{operacionais,
proprietario,propor,upload-comprovante,:id/{aprovar,rejeitar,resolver}}
+ notificação proativa (email + WhatsApp via whitelist LGPD).

BH.3 (M39, 8d045af) — tela admin /dashboard/usinas/[id]/despesas
(4 KPIs + 3 TabsCustom + 7 colunas + dialog lançar).

BH.3.1 (M39, 44f5e53) — refator UX página própria /nova corrigindo
violação Padrão UX Dual Tipo B (17/05) detectada em BH.3 + componente
reusável DespesaForm + UploadComprovante drag-drop 5MB.

BH.3.2 (M39, 543a835) — workflow double-check UNIVERSAL: TODOS perfis
criam PROPOSTA (zero auto-aprovação) + self-approval guard backend.

BH.4 (M40, 9858c45) — Portal Proprietário com /proprietario/despesas
refatorado consumindo /contas-pagar/proprietario + nova rota
/proprietario/despesas/nova (seletor usina + DespesaForm modo
proprietario-propor) + flag Cooperativa.proprietarioVeDespesas (default
false) + GET /proprietario/meu-parceiro + PUT /cooperativas/:id/
proprietario-ve-despesas + tela admin /dashboard/configuracoes/
portal-proprietario com toggle Switch. BÔNUS: D-novo-BL RESOLVIDO inline
(Super Admin bypass tenant em listarDespesasOperacionais/aprovar/
rejeitar/resolver) + IDOR guard PROPRIETARIO em proporDespesa
(PROPRIETARIO precisa estar vinculado à usina via Caminho A ou B).

VALIDACAO BH.1→BH.4:
- 42/42 specs verdes (30 contas-pagar + 11 cooperativas + 1 IDOR
  PROPRIETARIO novo)
- Smoke programatico BH.4: 11/11 ✅
  (backend/scripts/smoke-bh4-portal-proprietario.ts)
- Build web Turbopack: clean (D-novo-AS aplicada)
- PM2 backend + frontend online

🔴 BUG BLOQUEADOR DETECTADO POS-BH.4 (12:54:04):
GET /dashboard/usinas/[id]/despesas → 500. ChunkLoadError frontend
`cooperebr_web_d9a3a872._.js` (chunk inexistente no disco) originado
em _global-error/page.js. Backend OK sem 500 correlato. Frontend rodou
~47min OK após pm2 restart antes de falhar. Hipótese: cache Turbopack
.next/ corrupto, NÃO regressão BH.4. Repro Chrome anônimo + Edge.
Triagem aplicada read-only, ZERO fix. Catalogado D-novo-BN P0
BLOQUEADOR.

FILA PRIORITARIA — NÃO MUDAR ORDEM SEM Luciano:

1. URGENTE — D-novo-BN fix bug 500 /dashboard/usinas/[id]/despesas.
   Ler triagem completa em docs/sessoes/2026-05-29-m37-m40-sub-sprint-
   bh-despesas-camada-2.md seção "Triagem D-novo-BN" + débito em
   docs/debitos-tecnicos.md. Aplicar Fase 1 read-only obrigatória ANTES
   de tocar código. Fix sugerido (cache Turbopack): pm2 stop frontend +
   rm -rf web/.next + cd web && npm run build + pm2 start frontend.
   Se fix custar >1h, considerar rollback 9858c45 (BH.4) — preservar
   D-novo-BL inline.

2. D-novo-BM Painel Credenciais Teste Opção B (~2-3h) — homepage/login
   dev-only com botões "Login rápido" agrupados por perfil/parceiro.
   .env.development.local (gitignored). Banner amarelo modo DEV.

3. BH.5 — integração cálculo repasse considerando despesas APROVADAS
   + cron aluguel automático (~1.5-2h backend). Último fatia do
   Sub-Sprint BH.

4. Fechamento canônico COMPLETO Sprint D-novo-BH consolidado — substitui
   este fechamento parcial. Apresenta frase no terminal (diretriz 18/05).

CONSTRAINTS FUNDAMENTAIS APLICÁVEIS:
- Decisão 23: Fase 1 read-only OBRIGATÓRIA antes de fix BN.
- Padrão UX Dual 17/05: BH.5 manter Tipo B (página própria, não Dialog).
- D-novo-AS: cd web && npm run build Turbopack antes de commit web.
- Multi-tenant + regra contatos teste: substituir contatos cooperado por
  27981341348 + lucbragatto@gmail.com antes de qualquer disparo real.
- Decisão 24: frase de retomada local único (este arquivo + doc-sessao).
- Regra Code não-paralelo: claude.ai aguarda Code reportar.

PRE-REQUISITOS LEITURA (ordem fixa):
1. docs/CONTROLE-EXECUCAO.md (este arquivo, seção ## ONDE PARAMOS topo)
2. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md
3. docs/sessoes/2026-05-29-m37-m40-sub-sprint-bh-despesas-camada-2.md
4. docs/debitos-tecnicos.md (D-novo-BN, D-novo-BM, D-novo-BH BH.5)
5. docs/MAPA-INTEGRIDADE-SISTEMA.md
6. CLAUDE.md + .claude/CLAUDE.md
7. git log --oneline -10 (último: 9858c45 BH.4 + commit fechamento)

CARRY-OVERS (nao-bloqueantes):
- D-novo-BG (P3) anomalia GD Linhares
- D-novo-BJ (P2 LGPD) URL assinada comprovantes
- D-novo-BK (P3) storage S3/Supabase
- D-novo-BC (P2) paridade campos edição usina
- D-novo-BA/AZ classe GD restantes
- 30+ scripts utilitários untracked em backend/scripts/
- .agent/memory/.dreams/ + shared markdowns

FRENTES OPERACIONAIS LUCIANO (acumulado, inalterado):
⏳ PRIORITARIO: Preencher cooperebr1 (gatilho F.4 smoke produção)
⏳ Cadastrar Usuario E-Solares real
⏳ Revisar relatório auditoria classe GD + decidir corrigir DIVERGÊNCIAS
⏳ Definir matriz responsabilidadeDespesas
⏳ Definir valorKwhPadrao OU TarifaConcessionaria EDP_ES
⏳ Obter credenciais Sungrow/iSolar Cloud com E-Solares
⏳ Obter script.sql do hb06a (libera Sub-Sprint B ETL)
⏳ Obter .pfx sandbox Banestes
⏳ Decisões regulatórias Sub-Sprint A (advogado)

DOC-SESSAO SPRINT BH: docs/sessoes/2026-05-29-m37-m40-sub-sprint-bh-
despesas-camada-2.md
```

---

---

---

---

---

## ARCHIVE — frase M35+M36 isolada (deprecada — Sprint BH consolidado em 29/05)

```
PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior).
   Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents.

2. Rodar `git status --short`. Esperado: working tree limpo (untracked
   carry-overs catalogados). Último commit eh fechamento M35+M36 Sub-Sprint
   Refinamento Telas Usinas (F.7a + F.7b).

3. Rodar `pm2 list`. Esperado: cooperebr-backend + cooperebr-frontend online.

PASSO 1 — Onde paramos:

Sessao 27-28/05 entregou **M33+M34 Sub-Sprint F.5+F.6 + M35+M36 Sub-Sprint
Refinamento Telas Usinas** (12 commits c21fc1c..este):

M33 (27/05 noite) — F.5 Dashboard Hierárquico Super Admin: grid+tabela+
impersonate (depois revisado em M34).

M34 (28/05) — F.6 Reformulação Hierárquica Cards: refactor agregação por
chave dedupe + N3 cards usinas + remoção COMPLETA impersonate + Tabs custom
+ cleanup. Fix D-novo-BF (Next.js 16 useParams RAW encoded).

M35 (28/05 noite) — F.7a Cadastro Classe GD: @IsIn no CreateUsinaDto
(classeGdAnotada + statusHomologacao) + 2 selects nativos com help inline
azul didatico em /dashboard/usinas/nova + script auditoria READ-ONLY
(10 usinas, 7 PENDENTE + 3 DIVERGÊNCIA) + D-novo-BG/BH catalogados.

M36 (28/05 noite) — F.7b Refator Tela Edição:
- Componente compartilhado web/components/usinas/UsinaForm.tsx (~600 linhas,
  28 campos em 6 seções + helper montarPayloadUsina)
- /dashboard/usinas/nova refatorado pra consumir UsinaForm (reduzido 440→78
  linhas)
- NOVA rota /dashboard/usinas/[id]/editar/page.tsx (Padrão UX Dual 17/05
  Tipo B) — useParams RAW (lição D-novo-BF) + GET /usinas/:id popula form
  + PUT /usinas/:id submit
- REMOVIDO Sheet de [id]/page.tsx: imports Sheet/useForm/zodResolver/z +
  schema usinaSchema + state sheetAberto/salvando + funções abrirSheet+
  onSubmit + bloco <Sheet> 90 linhas. Botão "Editar" agora navega pra
  /editar. Dialogs Tipo C (Migrar/Ajustar kWh) PRESERVADOS.
- UpdateUsinaDto: @IsIn tightened classeGdAnotada+statusHomologacao +
  NOVO @IsEnum politicaBandeira (faltava paridade).
- UsinasService.update(): tipo + cópia pro updateData de distribuidora +
  politicaBandeira (faltavam silenciosamente).
- 5 specs novos update() verde: classeGdAnotada/distribuidora/
  politicaBandeira/endereço Bloco H/valorKwhPadrao.
- Smoke 10/10 com JWT real: PUT 14 campos → 200, banco confirma todos,
  validação rejeita classeGdAnotada=GD_XYZ → 400.

VALIDACAO:
- 9/9 specs verdes (usinas.service.spec.ts: 3 base + 3 F.7a + 5 F.7b)
- nest build + npm run build web OK (140 paginas, 6.7s — D-novo-AS aplicada
  4x na sessão entre M35+M36)
- PM2 backend + frontend online
- /dashboard/usinas/[id]/editar aparece no build como ƒ (dynamic)

CONSTRAINT FUNDAMENTAL (Luciano verbatim 28/05): Fio B NÃO tratado agora.
Classe GD = SÓ REGISTRO (cadastro + edição). Quando módulo Fio B futuro
entrar, ELE consome classeGdAnotada pra aplicar regras. Sistema neutro
hoje (litígio CoopereBR×EDP). Zero código de cálculo nestas fatias.

PROXIMO PASSO — 3 OPCOES (Luciano decide):

(A) **F.4 SMOKE PRODUCAO** (~1-2h, BLOQUEADO LUCIANO OPERACIONAL):
preencher cooperebr1 real (proprietarioEmail + formaPagamentoDono +
valorAluguelFixo + matriz responsabilidadeDespesas + valorKwhPadrao OU
TarifaConcessionaria EDP_ES) + cadastrar Usuario E-Solares real.

(B) **D-novo-BA CORREÇÃO PLANILHA CLASSE GD** (~30min-1h Code, depende
Luciano fornecer planilha definitiva). Cria script corrigir-classe-gd.ts
aplicando UPDATEs com dry-run primeiro.

(C) **D-novo-BH MÓDULO DESPESAS OPERACIONAIS CAMADA 2** (~10-15h sprint
próprio). Nova tabela DespesaOperacionalUsina + tela lançamento +
integração cálculo repasse + integração Contabilidade Tributária futura.

FRENTES PARALELAS DISPONIVEIS:
- Sub-Sprint B (ETL legado→novo) aguarda script.sql do hb06a
- Sungrow integração real (cron pronto, falta credenciais E-Solares)
- D-novo-AK instalar gerenciador senhas (Luciano)
- Decisoes regulatorias Sub-Sprint A (advogado)

CARRY-OVERS (nao-bloqueantes):
- D-novo-BA correção planilha (depois Luciano fornecer)
- D-novo-BG decisão Fio B (futuro)
- D-novo-BH módulo Despesas Camada 2 (sprint próprio futuro)
- D-novo-AL/AM/AN/AO: iSolar E2E, Empresa separada, RepasseProprietario,
  cron PDF email
- D-novo-AS.1/.2: hook PostToolUse npm run build automatico
- D-novo-BE: nome divergente mesmo email
- D-novo-J + K: 11 falhas pré-existentes Jest cooperados/usinas controllers

FRENTES OPERACIONAIS LUCIANO (acumulado):
⏳ PRIORITARIO: Preencher cooperebr1 (gatilho F.4 smoke produção)
⏳ Cadastrar Usuario E-Solares real
⏳ Revisar relatório auditoria classe GD + decidir corrigir DIVERGÊNCIAS
⏳ Definir matriz responsabilidadeDespesas
⏳ Definir valorKwhPadrao OU TarifaConcessionaria EDP_ES
⏳ Decidir politica anti-spam cron PDF (D-novo-AO)
⏳ Obter credenciais Sungrow/iSolar Cloud com E-Solares
⏳ Avisar time legado: 5 .pfx vazados + senha Azure SQL + webhook sem validação
⏳ Obter script.sql do hb06a (libera Sub-Sprint B ETL)
⏳ Obter .pfx sandbox Banestes (libera Carolina pagar PIX real)
⏳ Decisões regulatórias Sub-Sprint A (advogado)
⏳ Instalar Bitwarden/KeePassXC (D-novo-AK, 1-2 sem)
✅ GATEWAY_ENCRYPT_KEY + ASAAS_ENCRYPT_KEY (M28/M29)

DOC-SESSAO M35+M36: docs/sessoes/2026-05-28-m35-m36-sub-sprint-refinamento-
telas-usinas.md
RELATORIO AUDITORIA: docs/relatorios/2026-05-27-auditoria-classe-gd.md
```

---

---

---

---

---

## ARCHIVE — frase M35 F.7a isolada (deprecada — sub-sprint completo M35+M36)

```
PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior).
   Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents.

2. Rodar `git status --short`. Esperado: working tree limpo (untracked
   carry-overs catalogados). Último commit eh F.7a Classe GD cadastro.

3. Rodar `pm2 list`. Esperado: cooperebr-backend + cooperebr-frontend online.

PASSO 1 — Onde paramos:

Sessao 27-28/05 entregou **M33+M34 Sub-Sprint F.5+F.6 + M35 F.7a** (10
commits c21fc1c..este):

M33 (27/05 noite) — F.5 Dashboard Hierárquico Super Admin: F.5a backend +
F.5b frontend grid+tabela+impersonate + reversão decisão #4 Admin Parceiro.

M34 (28/05) — F.6 Reformulação Hierárquica Cards: F.6a refactor agregação
por chave dedupe + N3 cards usinas + remove impersonate completo + F.6b
Tabs custom + cards proprietários + fix D-novo-BF Next.js 16 useParams
RAW encoded.

M35 (28/05 noite) — F.7a Cadastro Classe GD:
- CreateUsinaDto: @IsIn(['GD_I', 'GD_II', 'GD_III']) classeGdAnotada
  + @IsIn(5 valores) statusHomologacao
- UsinasService.create(): tipo declara classeGdAnotada (persistência via
  spread ja cobria)
- /dashboard/usinas/nova: 2 selects nativos novos com help inline didatico
- Script auditoria backend/scripts/auditoria-classe-gd.ts READ-ONLY puro
  + grava relatorio docs/relatorios/<data>-auditoria-classe-gd.md
- 4 specs verdes usinas.service.spec.ts
- 2 débitos catalogados:
  • D-novo-BG (P3): Linhares cooperebr1 GD_I com 1.250 kWp (intencional
    Luciano, decidir antes do Fio B)
  • D-novo-BH (P1): Modulo Despesas Operacionais Camada 2 (~10-15h sprint
    próprio futuro)

Smoke 3/3 verde com JWT real: POST cadastra GD_II + EM_PRODUCAO,
validação rejeita GD_XYZ (400), banco confirma persistencia.
Auditoria 10 usinas: 7 PENDENTE, 3 DIVERGÊNCIA (cooperebr1/2 + Solar Norte).

CONSTRAINT FUNDAMENTAL (Luciano verbatim 28/05):
"nao iremos tratar o fio b agora, quero apenas que coloquemos essa
informacao nos cadastros porque assim, quando tratarmos o modulo do fio b,
vamos mandar aplicar na usinas que marcarmos como gd ii e iii"
→ Classe GD em F.7a = SO REGISTRO, ZERO logica Fio B. Vale tambem pra F.7b.

PROXIMO PASSO — F.7b REFATOR TELA EDICAO (~3-4.5h):

- D-novo-BB (P1): Sheet em web/app/dashboard/usinas/[id]/page.tsx:1122-1211
  (15 campos) → pagina dedicada /dashboard/usinas/[id]/editar/page.tsx
  (Padrao UX Dual 17/05 Tipo B). Extrair componente compartilhado
  `UsinaForm` reusavel entre /nova e /editar.
- D-novo-BC (P2): paridade completa campos edicao vs cadastro novo. Adicionar
  no edit: apelidoInterno, endereco Bloco H' (4), cnpjUsina, formaAquisicao,
  formaPagamentoDono+valorAluguelFixo+percentualGeracaoDono, numeroContratoEdp,
  dataContratoEdp, classeGdAnotada (de F.7a), statusHomologacao (de F.7a),
  + so-edicao: dataHomologacao, dataInicioProducao, observacoes,
  statusOperacional, modeloCobrancaOverride, politicaBandeira, valorKwhPadrao.
  responsabilidadeDespesas FICA em /proprietario (M30, nao duplicar).

ALTERNATIVA — F.4 SMOKE PRODUCAO (~1-2h, BLOQUEADO LUCIANO):
preencher cooperebr1 real (proprietarioEmail + formaPagamentoDono +
valorAluguelFixo + matriz responsabilidadeDespesas + valorKwhPadrao OU
TarifaConcessionaria EDP_ES) + cadastrar Usuario E-Solares real.

FRENTES PARALELAS DISPONIVEIS:
- Sub-Sprint B (ETL legado→novo) aguarda script.sql do hb06a
- Sungrow integração real (cron pronto, falta credenciais E-Solares)
- D-novo-AK instalar gerenciador senhas (Luciano)
- Decisoes regulatorias Sub-Sprint A (advogado)

CARRY-OVERS (nao-bloqueantes):
- D-novo-BA correção planilha definitiva (depois Luciano fornecer)
- D-novo-BG decisão Fio B (futuro)
- D-novo-BH módulo Despesas Camada 2 (sprint próprio futuro)
- D-novo-AL/AM/AN/AO: iSolar E2E, Empresa separada, RepasseProprietario,
  cron PDF email
- D-novo-AS.1/.2: hook PostToolUse npm run build automatico
- D-novo-BE: nome divergente mesmo email
- D-novo-J + K: 11 falhas pré-existentes Jest cooperados/usinas controllers

FRENTES OPERACIONAIS LUCIANO (acumulado):
⏳ PRIORITARIO: Preencher cooperebr1 (gatilho F.4 smoke produção)
⏳ Cadastrar Usuario E-Solares real
⏳ Revisar relatorio auditoria classe GD + decidir corrigir DIVERGÊNCIAS
⏳ Definir matriz responsabilidadeDespesas
⏳ Definir valorKwhPadrao OU TarifaConcessionaria EDP_ES
⏳ Decidir politica anti-spam cron PDF (D-novo-AO)
⏳ Obter credenciais Sungrow/iSolar Cloud com E-Solares
⏳ Avisar time legado: 5 .pfx vazados + senha Azure SQL + webhook sem validação
⏳ Obter script.sql do hb06a (libera Sub-Sprint B ETL)
⏳ Obter .pfx sandbox Banestes (libera Carolina pagar PIX real)
⏳ Decisões regulatórias Sub-Sprint A (advogado)
⏳ Instalar Bitwarden/KeePassXC (D-novo-AK, 1-2 sem)
✅ GATEWAY_ENCRYPT_KEY + ASAAS_ENCRYPT_KEY (M28/M29)

DOC-SESSAO M35: docs/sessoes/2026-05-28-m35-f7a-classe-gd-cadastro.md
RELATORIO AUDITORIA: docs/relatorios/2026-05-27-auditoria-classe-gd.md
```

---

---

---

---

---

## ARCHIVE — frase M33+M34 (deprecada)

```
PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior).
   Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents.

2. Rodar `git status --short`. Esperado: working tree limpo (untracked
   carry-overs catalogados). Último commit eh fechamento M33+M34 Sub-Sprint
   F.5+F.6 Dashboard Hierárquico Cards.

3. Rodar `pm2 list`. Esperado: cooperebr-backend + cooperebr-frontend online.

PASSO 1 — Onde paramos:

Sessao 27-28/05 entregou **M33 + M34 Sub-Sprint F.5+F.6 COMPLETO** (8
commits c21fc1c..e316a5b):

M33 (27/05 noite — F.5 Dashboard Hierárquico Super Admin):
- F.5a backend (c21fc1c): module admin/proprietarios + grid cooperativas
  + tabela usinas + bypass impersonate + 19 specs
- F.5b frontend (bc62ccd): grid responsivo + tabela 7 colunas + banner
  azul Shield
- D-novo-BD fix overflow + reversão decisão #4 ADMIN Parceiro (b25c945)
- Catálogo D-novo-AZ+BA+BB+BC (c76542e)

M34 (28/05 — F.6 Reformulação Hierárquica Cards):
Luciano testou M33 e levantou 5 críticas → reformulação total:
- F.6a backend (d1b8228): refactor N2 endpoint pra agregação por chave de
  dedupe (c-cooperadoId | e-email.toLowerCase() | SEM_PROPRIETARIO), novo
  endpoint N3 /proprietarios/:propId/usinas, remoção COMPLETA impersonate
  backend (3 arquivos + 4 specs deletados), 14 specs novos
- F.6b frontend (6610da4): Tabs custom (sem Shadcn — decisão pós-M32 conflito
  Base UI/Radix), refactor N2 cards proprietários com SEM_PROPRIETARIO
  destacado laranja, nova rota N3 cards usinas + tabs Usinas/Carregadores
  Em breve, cleanup impersonate frontend (zero código vivo, único hit é
  comentário documental)
- D-novo-BF fix (e316a5b): bug duplo encode propId — Next.js 16 useParams
  retorna RAW encoded (não decoda automaticamente). Fix 1 linha removendo
  encodeURIComponent redundante. Lição arquitetural valiosa.

HIERARQUIA FINAL FUNCIONAL:
- N1 /dashboard/proprietario (SA): grid cards COOPERATIVAS
- N2 /[cooperativaId]: grid cards PROPRIETÁRIOS + SEM_PROPRIETARIO laranja
- N3 /[cooperativaId]/[proprietarioId]: tabs Usinas + Carregadores (em breve)
- N4 /dashboard/usinas/[id]: admin existente M30/M31

5 CRÍTICAS LUCIANO RESPONDIDAS:
1. Tabela ruim → cards por proprietário ✅
2. "NAO CONVIDADO" pra órfã confuso → SEM_PROPRIETARIO destacado ✅
3. Impersonate não gostei → removido completamente ✅
4. Admin Parceiro também precisa → cards + redirect direto pra sua coop ✅
5. BUG admin parceiro click → resolvido naturalmente (sem impersonate) ✅

VALIDAÇÃO LUCIANO SMOKE 10/10 OK:
- SA percorreu N1→N2→N3→N4 completo
- ADMIN CoopereBR entra direto em N2 (pula N1)
- SEM_PROPRIETARIO botão "Cadastrar proprietário" funciona
- Tabs Carregadores disabled com badge "Em breve"
- N3 mostra nome/email mascarado/usinas corretos (pós-fix D-novo-BF)

PROXIMO PASSO — SUB-SPRINT REFINAMENTO TELAS USINAS (~4-7h, 4 débitos
catalogados em c76542e):

- D-novo-AZ (P1): campo Classe GD (GD_I/GD_II/GD_III) na
  /dashboard/usinas/nova + tela edição. **SÓ REGISTRO, ZERO logica Fio B**
  (essa vem no Sub-Sprint Fio B futuro — sistema neutro enquanto litígio
  CoopereBR×EDP corre)
- D-novo-BA (P2): script auditar usinas existentes pra preencher
  classeGdAnotada (depende AZ + planilha Luciano)
- D-novo-BB (P1): tela edição usina como drawer/Sheet → página própria
  /dashboard/usinas/[id]/editar (viola Padrão UX Dual 17/05)
- D-novo-BC (P2): paridade campos edição vs cadastro novo (Contrato
  distribuidora, Forma aquisição/pagamento dono, Proprietário completo,
  endereço Bloco H', apelidoInterno, etc — depende BB)

Possível fatiar em 2 sessões: F.7a (AZ + BA cadastro Classe GD + auditoria)
+ F.7b (BB + BC refator tela edição).

ALTERNATIVA — F.4 SMOKE PRODUCAO (~1-2h, BLOQUEADO LUCIANO OPERACIONAL):
Preencher cooperebr1 real (proprietarioEmail + formaPagamentoDono +
valorAluguelFixo + matriz responsabilidadeDespesas + valorKwhPadrao OU
TarifaConcessionaria EDP_ES) + cadastrar Usuario E-Solares real (manual
OU magic link). Quando OK Luciano: Code arranca smoke (~1-2h navegar
portal real + baixar PDF + validar consistência).

FRENTES PARALELAS DISPONIVEIS:
- Sub-Sprint B (ETL legado→novo) aguarda script.sql do hb06a
- Sungrow integração real (cron pronto, falta credenciais E-Solares)
- D-novo-AK instalar gerenciador senhas (Luciano)
- Decisoes regulatorias Sub-Sprint A (advogado)
- Cenario Completo Banestes (~6-8h) depois canario PIX real

CARRY-OVERS (nao-bloqueantes):
- D-novo-AL: integração iSolar Cloud E2E real
- D-novo-AM: Empresa entidade separada (YAGNI até 2ª usina)
- D-novo-AN: RepasseProprietario tabela pra pagamento REAL
- D-novo-AO: cron PDF conectar EmailService
- D-novo-AS.1/.2: hook PostToolUse npm run build automatico
- D-novo-BE: nome divergente mesmo email (workaround updatedAt desc
  aplicado, solução ideal entidade Empresa futura)
- D-novo-J + K: 11 falhas pré-existentes Jest cooperados/usinas controllers

FRENTES OPERACIONAIS LUCIANO (acumulado):
⏳ PRIORITÁRIO: Preencher cooperebr1 (gatilho F.4 smoke produção)
⏳ Cadastrar Usuario E-Solares real (manual OU magic link)
⏳ Auditar classeGdAnotada por usina (D-novo-BA, depende AZ)
⏳ Decidir politica anti-spam cron PDF (D-novo-AO)
⏳ Obter credenciais Sungrow/iSolar Cloud com E-Solares
⏳ Avisar time legado: 5 .pfx vazados + senha Azure SQL + webhook sem validação
⏳ Obter script.sql do hb06a (libera Sub-Sprint B ETL)
⏳ Obter .pfx sandbox Banestes (libera Carolina pagar PIX real)
⏳ Decisões regulatórias Sub-Sprint A (advogado)
⏳ Instalar Bitwarden/KeePassXC (D-novo-AK, 1-2 sem)
✅ GATEWAY_ENCRYPT_KEY + ASAAS_ENCRYPT_KEY (M28/M29)

DOC-SESSAO M33+M34: docs/sessoes/2026-05-28-m33-m34-sub-sprint-f5-f6-
dashboard-hierarquico-cards.md
```

---

---

---

---

---

## ARCHIVE — frase anterior (M33) — não usar

```
PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior).
   Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents.

2. Rodar `git status --short`. Esperado: working tree limpo (untracked
   carry-overs catalogados). Último commit eh fechamento M33 Sub-Sprint F.5.

3. Rodar `pm2 list`. Esperado: cooperebr-backend + cooperebr-frontend online.

PASSO 1 — Onde paramos:

Sessao 27/05 entregou **M32 fixes pós-demo + M33 Sub-Sprint F.5 COMPLETO**:

M32 (D-novo-AQ + AR + AS, 27/05 tarde):
- Demo Portal Proprietario exposed 2 bugs visuais
- D-novo-AQ (P2): sidebar "Proprietario de Usina" hardcoded → usuario.nome
- D-novo-AR (P1): KPIs zerados — causa raiz REAL = build estatico stale
  (frontend roda `next start` em prod, build era antes do M30)
  Rebuild bloqueado por 3 erros TS pre-existentes que tsc --noEmit deixou
  passar mas next build (Turbopack) pegou. Fix: 2× DialogTrigger asChild→
  render Base UI, 1× Tooltip Recharts formatter. Rebuild 140 paginas, PM2
  restart, KPIs corretos.
- D-novo-AS (P2): catalogada diretiva "rodar `cd web && npm run build`
  antes de fechar marco que toca web/" — tsc --noEmit eh insuficiente.

M33 Sub-Sprint F.5 (27/05 noite, 5 commits c21fc1c..este):
- F.5a Backend (c21fc1c): module novo backend/src/admin/proprietarios/
  com 2 endpoints novos
  • GET /admin/proprietarios/cooperativas (@Roles SUPER_ADMIN) — grid 7
    campos novos: usinasComProprietario/proprietariosUnicos/totalYtd/
    capacidadeKwp/statusOK-atencao-critico/convitesPendentes/
    contratosVencendo30d
  • GET /admin/proprietarios/cooperativas/:id/usinas (@Roles SA+ADMIN,
    ADMIN só sua propria via multi-tenant guard)
  Bypass impersonate em /proprietario/usinas/:id?impersonate=true
  (SUPER_ADMIN apenas, audit log estruturado). 19 specs novos.
- F.5b Frontend (bc62ccd): refactor /dashboard/proprietario em grid
  responsivo de cards + nova rota /dashboard/proprietario/[cooperativaId]
  com tabela 7 colunas + banner azul Shield no /proprietario/usinas/[id]
  quando ?impersonate=true. Sidebar conditional. Help inline azul. Loading
  Skeleton + empty + error.
- D-novo-BD (P2): tabela estourando horizontal — fix overflow-x-auto +
  min-w-[900px].
- M33 Etapa B: REVERSAO decisao #4 F.5. ADMIN PARCEIRO tambem tem Portal
  Proprietario (versao adaptada — pula grid, vai direto pra tabela da
  sua cooperativa, breadcrumb hierarquico oculto). Multi-tenant guard
  backend ForbiddenException + frontend redirect.

VALIDACAO:
- Suite completa: 935 passing / 11 falhas pre-existentes (D-novo-J + K)
- nest build + npm run build web OK (140 paginas, 22.8s Turbopack)
- Smoke 8/8: F.5a 5/5 (SA grid + tabela + impersonate; ADMIN 403 nos
  grid endpoints) + M33 Etapa B 3/3 (ADMIN sua coop=200, alheia=403,
  grid=403).

PROXIMO PASSO — 2 OPCOES:

(A) **F.4 SMOKE PRODUCAO** (~1-2h) — BLOQUEADO LUCIANO OPERACIONAL:
    Preencher cooperebr1 real (proprietarioEmail+formaPagamentoDono+
    valorAluguelFixo+responsabilidadeDespesas+valorKwhPadrao) + cadastrar
    Usuario E-Solares real (manual OU magic link) + simular drill-down +
    decidir politica anti-spam cron PDF (D-novo-AO).

(B) **SUB-SPRINT REFINAMENTO TELAS USINAS** (~4-7h) — 4 debitos catalogados
    27/05 noite:
    - D-novo-AZ (P1): campo Classe GD na tela /dashboard/usinas/nova
      (input + persistencia APENAS — ZERO logica Fio B; ela vira no
      Sub-Sprint Fio B futuro)
    - D-novo-BA (P2): script auditar usinas existentes pra preencher
      classeGdAnotada (depende AZ)
    - D-novo-BB (P1): tela edicao usina como drawer → pagina propria
      /dashboard/usinas/[id]/editar (viola Padrao UX Dual 17/05)
    - D-novo-BC (P2): paridade campos edicao vs cadastro (depende BB)

FRENTES PARALELAS DISPONIVEIS:
- Sub-Sprint B (ETL legado→novo) aguarda script.sql do hb06a
- Sungrow integracao real (cron pronto, falta credenciais E-Solares)
- D-novo-AK instalar gerenciador senhas (Luciano)
- Decisoes regulatorias Sub-Sprint A (advogado)
- Cenario Completo Banestes (~6-8h) depois canario PIX real

CARRY-OVERS (nao-bloqueantes):
- D-novo-AL: integracao iSolar Cloud E2E real
- D-novo-AM: Empresa entidade separada (YAGNI ate 2a usina)
- D-novo-AN: RepasseProprietario tabela pra pagamento REAL
- D-novo-AO: cron PDF conectar EmailService
- D-novo-AS.1/.2: hook PostToolUse npm run build automatico

FRENTES OPERACIONAIS LUCIANO (acumulado):
⏳ PRIORITARIO: Preencher cooperebr1 (proprietarioEmail GATILHO pra F.4)
⏳ Cadastrar Usuario E-Solares (manual OU magic link)
⏳ Definir matriz responsabilidadeDespesas
⏳ Definir valorKwhPadrao OU TarifaConcessionaria EDP_ES
⏳ Auditar classeGdAnotada por usina (D-novo-BA, depende AZ)
⏳ Decidir politica anti-spam cron PDF (D-novo-AO)
⏳ Obter credenciais Sungrow/iSolar Cloud com E-Solares
✅ GATEWAY_ENCRYPT_KEY + ASAAS_ENCRYPT_KEY (M28/M29)
⏳ Instalar gerenciador de senhas (D-novo-AK)
⏳ Avisar time legado / script.sql / .pfx sandbox Banestes / Sub-Sprint A

DOC-SESSAO M33: docs/sessoes/2026-05-27-m33-sub-sprint-f5-dashboard-
hierarquico-superadmin.md
```

---

---

---

---

---

## ARCHIVE — frase anterior (M30+M31) — não usar

```
PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior).
   Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents.

2. Rodar `git status --short`. Esperado: working tree limpo (untracked
   carry-overs catalogados). Último commit eh fechamento M31 Sub-Sprint F
   Sessao 2.

3. Rodar `pm2 list`. Esperado: cooperebr-backend online.

PASSO 1 — Onde paramos:

Sessoes 26/05 entregaram **Sub-Sprint F MVP+ Caminho B COMPLETO** em 2
marcos (M30 + M31):

M30 (Sessao 1, 9 commits fc2f048..084db48):
- Schema migration: PROPRIETARIO enum + ConviteProprietario + StatusOperacional
  + ResponsavelPagamento + CategoriaContaAPagar 4->16 + Usina (+3 colunas)
  + ContaAPagar (+1 coluna)
- Helper calcularRepasse FIXO/PERCENTUAL/HIBRIDO substituindo R$ 0,50/kWh
- ProprietarioModule + 5 endpoints + 11 specs
- Sungrow cron reativado + encryption sungrowSenha via CredentialsEncryptor
- RelatorioMensalService cron mensal + endpoint PDF sob demanda
- Frontend portal 6 paginas (Dashboard 5 KPIs + Lista + Drill-down Recharts
  + Repasses + Despesas + Contratos)
- Frontend UI admin tela /dashboard/usinas/[id]/proprietario
- Fix classeGdAnotada cooperebr1 GD_II->GD_I

M31 (Sessao 2, 5 commits 34719bd..3ba6655):
- ConviteProprietarioService completo (7 metodos) + 31 specs
- 5 endpoints admin (+1 cadastro-manual): POST /convite, GET /convites/:usinaId,
  POST /convite/:id/reenviar, DELETE /convite/:id, POST /cadastro-manual
- 2 endpoints publicos: GET + POST /aceitar-convite/:token
- ConviteEmailService template HTML inline amber theme reusa EmailService
- Frontend admin: Card "Acesso do Proprietario" com 2 dialogs Shadcn
  (CadastroManualDialog senha auto-gerada + ConvidarEmailDialog magic link)
- Frontend publico /proprietario/aceitar-convite/[token] com 4 estados
  (loading / token invalido / form senha + indicador forca / sucesso)

ENTREGA FINAL SUB-SPRINT F MVP+:
- Suite completa: 917/928 (mesmos 11 pre-existentes; +57 specs novos vs M29)
- nest build + tsc limpos
- Multi-tenant em 100% queries
- LGPD Opcao A: cooperados anonimizados #001/#002 + token nunca retornado integral
- Encryption sungrowSenha sem nova chave master (reusa GATEWAY_ENCRYPT_KEY)
- Politica regra-secrets-nao-memorizar.md respeitada (senhaTemp UMA VEZ na UI)

PROXIMO PASSO — F.4 SMOKE PRODUCAO (~1-2h):

BLOQUEADO POR LUCIANO OPERACIONAL — pre-requisitos:

1. Preencher cooperebr1 via UI admin (gatilho proprietarioEmail e o
   ANCHOR pro magic link funcionar):
   - /dashboard/usinas/usina-linhares (form principal):
     * proprietarioEmail (E-Solares — OBRIGATORIO)
     * formaPagamentoDono (FIXO / PERCENTUAL / HIBRIDO)
     * valorAluguelFixo E/OU percentualGeracaoDono
     * dataInicioProducao, capacidadeKwh, cnpjUsina
   - /dashboard/usinas/usina-linhares/proprietario (tela nova M30):
     * statusOperacional (default OPERANDO ja)
     * valorKwhPadrao OU cadastrar TarifaConcessionaria EDP_ES
     * matriz responsabilidadeDespesas (15 categorias × 4 opcoes)

2. Cadastrar Usuario E-Solares — DUAS OPCOES:
   - (a) Cadastro manual via UI admin → bloco "Acesso do Proprietario"
         → Dialog CadastroManual → admin define senhaTemp e copia
         credenciais pra mandar pra E-Solares por chat
   - (b) Magic link via UI admin → bloco "Acesso do Proprietario"
         → Dialog ConvidarEmail → sistema envia link, E-Solares clica
         e define propria senha

3. Logar como E-Solares (sessao Code roda simulacao):
   - Navegar /proprietario (Dashboard 5 KPIs)
   - Drill-down /proprietario/usinas/[id] (Recharts + repasses + despesas)
   - Baixar relatorio PDF mes anterior
   - Validar dados consistentes (proprietarioEmail filtrado, cooperados
     anonimizados, calculo repasse respeitando formaPagamentoDono)

4. Conectar cron PDF a EmailService (D-novo-AO pendente):
   - Luciano confirmar politica anti-spam (envia automatico todo dia 5
     OU apenas sob demanda OU ambos)
   - Code conecta RelatorioMensalService.cron com EmailService.enviarEmail

FRENTES PARALELAS DISPONIVEIS enquanto F.4 bloqueado:
- Sub-Sprint B (ETL legado→novo) aguarda script.sql do hb06a
- Sungrow integracao real (cron ja reativado, falta credenciais Sungrow
  reais da E-Solares)
- D-novo-AK instalar gerenciador senhas (Luciano)
- Decisoes regulatorias Sub-Sprint A (advogado)
- Cenario Completo Banestes (~6-8h Code) depois canario PIX real

CARRY-OVERS (nao-bloqueantes):
- D-novo-AL: integracao iSolar Cloud E2E real
- D-novo-AM: Empresa entidade separada (YAGNI ate 2a usina E-Solares)
- D-novo-AN: RepasseProprietario tabela pra pagamento REAL (vs previsto)
- D-novo-AO: cron PDF conectar EmailService

FRENTES OPERACIONAIS LUCIANO (acumulado):
⏳ PRIORITARIO: Preencher cooperebr1 (proprietarioEmail GATILHO pra F.4)
⏳ Cadastrar Usuario E-Solares (manual OU magic link)
⏳ Definir matriz responsabilidadeDespesas
⏳ Definir valorKwhPadrao OU TarifaConcessionaria EDP_ES
⏳ Decidir politica anti-spam cron PDF (D-novo-AO)
⏳ Obter credenciais Sungrow/iSolar Cloud com E-Solares
✅ GATEWAY_ENCRYPT_KEY + ASAAS_ENCRYPT_KEY (M28/M29)
⏳ Instalar gerenciador de senhas (D-novo-AK)
⏳ Avisar time legado / script.sql / .pfx sandbox Banestes / Sub-Sprint A

CONTEXTO HISTORICO IMEDIATO ANTERIOR (M30, 26/05) — Sub-Sprint F MVP+
Sessao 1: backend + frontend portal + frontend UI admin completos.
Helper calcularRepasse substituiu R$ 0,50/kWh hardcoded. Multi-tenant +
LGPD anonimizacao. 886/897 specs. Detalhe: docs/sessoes/2026-05-26-m30-
sub-sprint-f-portal-proprietario-mvp-plus.md.

CONTEXTO HISTORICO ANTERIOR (M29, 26/05) — Sub-Sprint Gateways de Pagamento
F2 EXPANDIDA: schema migration aditiva + dual-write Asaas + rotacao
ASAAS_ENCRYPT_KEY (D-novo-AJ.1 RESOLVIDO).
```

---

---

---

---

---

---

## ESTADO ATUAL

### Doc-0 (documentação base)

| Fatia | Status | Commit | Conteúdo |
|---|---|---|---|
| 1/5 — Limpeza estrutural | ✅ CONCLUÍDA | `3a193de` (28/04) | 4 docs movidos pra `historico/`, 7 prompts antigos, `memory/` raiz renomeada, stubs PRODUTO/SISTEMA |
| 2/5 — PRODUTO + REGULATORIO | ✅ **CONCLUÍDA** | (commits desta sessão) | PRODUTO.md, REGULATORIO-ANEEL.md, CONTROLE-EXECUCAO.md, sessão decisões, +12 débitos, plano atualizado |
| 3/5 — SISTEMA.md | 🔴 pendente | — | Mapa técnico (44 módulos, 152 telas, 80 models, schema completo) |
| 4/5 — CLAUDE.md refator | 🔴 pendente | — | Reformatação operacional do CLAUDE.md raiz |
| 5/5 — Movimentação final | 🟡 parcial | (03/05) | ✅ SISGD-VISAO movido pra `docs/historico/SISGD-VISAO-COMPLETA-2026-04-26.md`. Pendente: MAPA-INTEGRIDADE → histórico, README docs |

### Sprints pré-produção (10 totais — pilha reorganizada 30/04)

| Sprint | Tema | Status | Severidade | Estimativa |
|---|---|---|---|---|
| 0 | Auditoria Regulatória Emergencial | 🔴 não iniciado | P0 urgente | 1 semana |
| 1 | FaturaSaas Completo | 🔴 não iniciado | P1 | 1-2 semanas |
| 2 | OCR-Integração + Engine DINAMICO | 🔴 não iniciado | P1 | 2-3 semanas |
| 3 | Banco de Documentos (Assinafy) | 🔴 não iniciado | P1 | 1-2 semanas |
| 4 | Portal Proprietário | 🔴 não iniciado | P1 | 1-2 semanas |
| 5 | Módulo Regulatório ANEEL | 🔴 não iniciado | P0 estruturante | 3-4 semanas |
| 6 | Auditoria IDOR Geral | 🔴 não iniciado | P2 | 1 semana |
| 7 | DRE + Conciliação + Fechamento | 🔴 não iniciado | P2 | 2-3 semanas |
| 8 | Política + Engine de Otimização | 🔴 não iniciado | P1 | 2-3 semanas |
| 9 | Motor de Diagnóstico Pré-Venda | 🔴 não iniciado | P1 estratégico | 3-4 semanas |
| CT | CooperToken Consolidado | 🔴 não iniciado, **catalogado 04/05 noite** | P1 | 14-18h Code (Etapa 1 specs ~6-8h, Etapa 2 refator ~8-10h) |

**Total estimado**: 17-23 semanas de Code dedicado.

---

## SESSÃO 2026-04-30 NOITE — Investigações realizadas (sem aplicar correções)

**3 investigações concluídas, todas commitadas localmente:**

### 1. Validação de specs históricos (commit `2617d08`)
- Lidos 7 specs em `docs/specs/` que ficaram fora do mapeamento anterior
- Relatório: `docs/sessoes/2026-04-30-validacao-specs-historicos.md` (711 linhas)
- **6 descobertas estruturantes identificadas** (decisões pendentes)
- **7 ajustes factuais confirmados** (correções pendentes)

### 2. Regra de validação prévia obrigatória (commit `e0d4daa`)
- Salva em `~/.claude/.../memory/regra_validacao_previa_e_retomada.md`
- Atualizada em `CLAUDE.md` (raiz)
- Decisão 14 registrada
- **Aplicada em todas as sessões Code futuras automaticamente**

### 3. Estado real de cobrança E2E (commit `f3a0434`)
- Mapeamento de 16 etapas do pipeline de cobrança
- Relatório: `docs/sessoes/2026-04-30-estado-cobranca-e2e.md` (282 linhas)
- **Achado central:** Caminho A (OCR→Cobrança automática) NUNCA rodou em produção
- **Achado central:** Caminho B (cobrança manual UI + Asaas) maduro, pode ir pra produção em 1-2 semanas
- **4 achados novos identificados** (catalogação pendente)

---

## PENDÊNCIAS PARA PRÓXIMA SESSÃO

> **Reorganizado 03/05 fechamento** após 4 fases concluídas (A + B + B.5 + C.1).
> Agente apresenta P0 → P1 → P2 → P3 em toda abertura de sessão (Decisão 19).
> Pendências marcadas com 🔍 foram **revisadas com leitura de código**.

### P0 — Crítico

- [x] ✅ **Validação manual da Fase C.1 + C.1.1 por Luciano** — VALIDADA em 04/05 tarde (sessão claude.ai). 4 bugs UX corrigidos pelo Code de manhã passaram. Falso bug 0.87960 diagnosticado como premissa errada do operador (plano com descontoBase=18, não 15).
- [x] ✅ **5 decisões D-J-1 a D-J-5 RESOLVIDAS** (sessão claude.ai 11/05/2026):
  - **D-J-1 ✅:** (a) Fazer agora. UI etapa 11 entra nesta sessão Code (~1-2h).
  - **D-J-2 ✅:** Intencional **com revisão temporária**. Catalogado D-30W (P2 processual). Admin revisa cada aceite na fase de testes; automatizar quando Sprint 5 (flags ANEEL) + Sprint 8 (Engine Otimização) fecharem. **Decisão 22 catalogada.**
  - **D-J-3 ✅:** (b) Fica fora. Item "CooperToken expandido" NÃO entra na C.2 reduzida. Sugestão pendente #4 catalogada na memória persistente (polir UX pós Sprint CT Consolidado).
  - **D-J-4 ✅:** (a) C.2 + C.3 juntos com urgência. Meta da sessão Code: finalizar o quanto antes.
  - **D-J-5 ✅:** (a) Playbook escrito em sessão claude.ai 11/05 — `docs/playbooks/playbook-fase-c3.md` (6 decisões D-P-1..D-P-6 + sequência de implementação).
- [ ] **Fase C.2 reduzida** (5 itens, D-J-3=fora): promo defaults + validação visual, simulação 2 fases, vigência + validação Campanha, lista enriquecida (escopo + indicadores), confirmação antes de salvar mudanças críticas. **~3-4h Code — em execução nesta sessão.**
- [ ] **Fase C.3** (3 telas com 4 valores de economia projetada). Backend já preenche; é só frontend + 1 endpoint backend ampliado. **~1.5-2h Code — em execução nesta sessão (seguir playbook D-P-1..D-P-6).**
- [ ] **UI etapa 11 (aprovação concessionária)** — D-J-1=a, fechando UI admin de transição AGUARDANDO_CONCESSIONARIA → APROVADO. Cooperado real travado: MARCIO MACIEL (CoopereBR). **~1-2h Code — em execução nesta sessão.**
- [x] ✅ **Gap jornada — etapa 5 (aprovação admin do plano)** — D-J-2 respondida: intencional com revisão temporária. Catalogado como D-30W pra revisitar pós Sprint 5+8.
- [ ] **Gap jornada — etapa 12-A (Caminho A OCR→cobrança)** — nunca rodou em produção. Pré-requisito Sprint 2 OCR-Integração.
- [ ] **Gap jornada — etapa 9 (lista de espera sem rota dedicada)** — funciona via Step7+cooperados, mas sem tela própria. P3.
- [x] ✅ **D-30R RESOLVIDO em 03/05 (Fase B)** — commits `eb7f0ce`, `070c1ab`, `f5453b7`, `4c8e946`.
- [ ] 🔍 **`BLOQUEIO_MODELOS_NAO_FIXO=true`** ainda ativo nos 7 enforcement points. **Validação E2E sintética 48/48 ✓ na Fase B.5.** Pré-requisitos pra desativar: Fase C.2 + C.3 + canário em 1 cooperado real (Opção A do playbook `docs/sessoes/2026-05-03-fase-b5-validacao-e2e.md`).

### P1 — Decisões esperadas Luciano (status atualizado pós sessão 03/05)

- **Decisões resolvidas durante a sessão 03/05** (4 novas):
  - ~~B33 Semântica `tarifaContratual`~~ ✅ **RESOLVIDA** — pós-desconto, helper canônico aplicado em 5 caminhos
  - ~~B33.5 Reset 72 contratos legados~~ ✅ **RESOLVIDA** — não resetar (forward-only)
  - ~~B34 FIXO lê fatura no aceite~~ ✅ **RESOLVIDA** — `valorCheioKwhAceite` no Contrato
  - ~~B35 Economia uniforme nos 3 modelos~~ ✅ **RESOLVIDA** — 4 valores em toda Cobrança

- **Decisões já resolvidas em fases anteriores:**
  - ~~B1 D-30R timing~~ ✅ **RESOLVIDA via Fase B**
  - ~~B2 DINAMICO sprint dedicado~~ ✅ **RESOLVIDA via Fase B** (implementado dentro do mesmo escopo)
  - ~~B13 Seed `CREDITOS_COMPENSADOS`~~ ✅ **RESOLVIDA via Fase A** (seed muda pra `FIXO_MENSAL`)

- **6 decisões Fase 2.5 ainda pendentes:**
  - B3 CooperToken desvalorização configurável vs hard-coded 29 dias
  - B4 Modo Observador consolidar admin-spy + cooperado-leitura, ou separar
  - B5 Convênios link-específico now or later
  - B6 Planos modulares `@RequireModulo` retroativo (~50 endpoints) ou só novos

- **6 decisões estratégicas originais** (Doc-0):
  - B7 Hardcode 0.20 CooperToken
  - B8 Modo Observador no PRODUTO.md (Camada 12)
  - B9 3 specs CooperToken contraditórios na expiração
  - B10 Convênios subdocumentado (Camada 8 expansão)
  - B11 600.000 kWh represados (marcar como ciente)
  - B12 FCFS + VPP no roadmap?

- **4 lacunas Área 1** (revisão 02/05 tarde):
  - ~~B13 Seed `onModuleInit` cria Plano `CREDITOS_COMPENSADOS`~~ ✅ **RESOLVIDA via Fase A** (commit `69e2d6c`)
  - B14 UI override Usina/Contrato inexistente (só via API) — **parcialmente endereçada via UI escopo Fase A**
  - B15 `FORMULAS-COBRANCA.md` órfão em historico/ vs CLAUDE.md ainda referencia — **parcialmente endereçada via aviso obsolescência em RETOMADA-SESSAO.md (Fase B)**
  - B16 `RegrasFioB` model + `Usina.classeGd` enum documentados mas não codificados — pendente, depende Sprint 5 regulatório

- **16 decisões curadoria sprints** (`docs/sessoes/2026-05-01-curadoria-sprints-decisoes.md` commit `6c8cb7d`):
  - B17-B32 (16 itens — material já consolidado, aguardando passada de batch)

### P1 — Sprints potenciais a catalogar (status pós sessão 03/05)

- ~~C1 COMPENSADOS~~ ✅ **EXECUTADO via Fase B** (D-30R + duplo desconto + helper canônico)
- ~~C2 DINAMICO~~ ✅ **EXECUTADO via Fase B** (NotImplementedException → implementação real)
- ~~C7 D-30R sub-sprint~~ ✅ **ABSORVIDO em Fase B**
- ~~C3 CooperToken Configurável~~ → **PROMOVIDO a Sprint CooperToken Consolidado em 04/05 noite** — escopo expandido (consolidação arquitetural completa, não só campos extras). Ver `docs/sessoes/2026-05-04-noite-investigacao-coopertoken.md`.
- C4 Convênios link-específico + landing personalizada — **pendente**
- C5 Relatório Mensal Membro/Usuário (consumo modular) — **pendente**
- C6 Planos SaaS Modulares — ativação `@RequireModulo` retroativa — **pendente**
- C8 Funções Venda Fio B (contexto a recuperar — pendente desde 02/05) — **pendente**

### P2 — Validação E2E pendente

- [ ] **Canário 1 cooperado real** — depende Fase C.2 + Fase C.3 + (se necessário) backfill 72 contratos legados. Pré-requisito pra desativar `BLOQUEIO_MODELOS_NAO_FIXO` em produção.
- [ ] 🔍 **D-30M** — Bônus MLM cascata: pipeline OK, validar quando primeiro indicado pagar via Caminho B Asaas.

### P2 — Bugs/lacunas confirmadas

- [ ] 🔍 **D-30N** — AuditLog interceptor **não existe**. Absorvido por Sprint 5/6.
- [x] 🔍 **D-30O** — ✅ **RESOLVIDO em 02/05** (commit `7ea6943`)
- [x] 🔍 **D-30R** — ✅ **RESOLVIDO em 03/05** (Fase B, commits `eb7f0ce`, `070c1ab`, `f5453b7`, `4c8e946`)
- [ ] **Backfill 72 contratos legados** (only-if-needed) — `tarifaContratual=null` em todos. Necessário SE Luciano quiser ativar COMPENSADOS num cooperado existente sem recriar contrato. Forward-only mantido em Fase B; backfill é decisão futura.

### P3 — Débitos catalogados durante sessão 03/05

- [x] ✅ **D-30Y — Validação E2E manual /aprovar-proposta (4 valores Fase C.3)** — RESOLVIDO em 11/05 (esta sessão). 2 propostas teste geradas via `backend/scripts/criar-proposta-teste-c3.ts` (CoopereBR Teste), 2 screenshots confirmados por Luciano em janela anônima mostrando `<EconomiaProjetada>` renderizando R$ 76,50 / 918 / 4.590 / 13.770. Cleanup feito (cooperados teste deletados). Detalhe completo em `docs/debitos-tecnicos.md` (D-30Y).
- [ ] **3 specs DI pré-existentes falhando** — `cooperados.controller.spec.ts`, `cooperados.service.spec.ts`, `usinas.controller.spec.ts`. Erro DI (UsinasService não resolvido em RootTestModule). Confirmado pré-existente via `git stash`. Não impacta runtime.
- [ ] **Snapshots na atribuição tardia de plano** (caso `usinas.service.ts:306`) — promoção da lista de espera cria contrato sem plano. Função `atribuirPlanoAoContrato()` deve popular snapshot via helper canônico. Catalogado como exceção #5.
- [ ] **Whitelist `/cadastro` no interceptor `web/lib/api.ts`** — observação latente da Fase A. Se algum dia alguém chamar `api.get('/planos')` em rota pública (não via `fetch`), visitante anônimo seria redirecionado pra `/login`. Hoje `/cadastro` usa `fetch` direto, então não acontece.

### P3 — Documentação pendente

- [ ] **Doc-0 Fatia 3** — SISTEMA.md (mapa técnico completo)
- [ ] **Doc-0 Fatia 4** — CLAUDE.md refator operacional
- [ ] **Doc-0 Fatia 5** — Movimentação final. Parcialmente executado em 03/05 (SISGD-VISAO movido).
- [ ] **D-30S** — Extrair "Jornadas Usuário" do SISGD-VISAO histórico (1-1.5h)
- [ ] **D-30T** — Extrair "Painéis por Papel" do SISGD-VISAO histórico (1-2h)

### P3 — Ajustes factuais Doc-0 (Grupo B)

- [x] ✅ **TODOS RESOLVIDOS em 02/05** (commit `7ea6943`):
  - juiz TJES removido, Sinergia/CoopereBR aguardando migração, sem cliente em produção
  - Assis → OpenClaw (7 ocorrências)
  - Limite 25% por classe GD (não aplica GD I, direitos adquiridos 2045)
  - Caso A reescrito (sistema legado, GD I direitos adquiridos)
  - Express→Cooperado marcado como hipótese

### Estratégica

- [ ] **Caminho B** (cobrança manual UI + Asaas produção real) — primeira receita real em 1-2 semanas
- [ ] Quando atacar Sprint 0 (Auditoria Regulatória)
- [ ] Conta Asaas produção (criar/migrar)

### Sugestões pendentes (sem prazo)

- #1 Diagramas C4 + ER (reavaliar quando CoopereBR migrar)
- #2 Token dedicado convênio + landing personalizada (depende Sprint 1 trazer comunicação)
- #3 Cron Análise Diária Sessões (escopo a definir — hipóteses A/B/C/D/E)

### Processual

- [ ] **Aplicar Decisão 20 retroativamente** — revisar sprints catalogados (5a, 3a) pra checar se passariam pelo gate "verificação de conflito"

---

## ESTADO REAL DO PRODUTO (descoberto 30/04 noite)

| Componente | Estado |
|---|---|
| Caminho A — OCR automático | 🔴 nunca rodou em produção |
| Caminho B — Cobrança manual + Asaas | 🟢 31 cobranças sandbox PAGAS, pronto pra produção |
| FaturaSaas | 🟡 cron cria, mas sem Asaas/comunicação/pagamento |
| MLM cascata | 🔴 quebrado (D-30M) |
| AuditLog | 🔴 inativo (D-30N) |
| Doc-0 Fatia 2 | 🟡 escrito mas com pendências A + B + C acima |

---

## DECISÕES CONSOLIDADAS (cronológicas)

### Sessão claude.ai 2026-04-30 (Doc-0 Fatia 2 — 13 decisões estruturantes)

> Captura completa em `docs/sessoes/2026-04-30-decisoes-doc-0-fatia2.md`.

1. **3 entidades fundamentais** (SISGD, Parceiro, Membro). Tudo demais é atributo sobreposto.
2. **Sprint OCR-Integração + Sprint 14 atômico** (opção C mista). Pipeline OCR×Motor + DINAMICO + COMPENSADOS validado juntos.
3. **ContratoUso 3 modalidades** (fixa mensal + valor por kWh + percentual sobre tarifa SCEE sem tributos). NÃO é "% lucro líquido".
4. **Assinafy + 5 documentos do sistema** (Proposta, Adesão, Responsabilidade, Procuração, Contrato). Templates SISGD; parceiro customiza.
5. **Caso Exfishes (anonimizado)** — concentração 39,55% violando limite ANEEL não detectada; realocação cega causou salto de R$ 6.600 → R$ 32.486/mês (R$ 310k/ano).
6. **Classe GD vem da usina, não da UC.** UC herda da usina vinculada.
7. **5 flags regulatórias** configuráveis por parceiro: `multipleUsinasPerUc`, `multipleClassesGdPerUc`, `concentracaoMaxPorCooperadoUsina` (default 25%), `misturaClassesMesmaUsina`, `transferenciaSaldoEntreUcs` (saldo intransferível).
8. **Política de Alocação por Faixas** com simulação prévia, padrão SISGD vs custom.
9. **Engine de Otimização com Split** — modo Sugestão default, Automático com guard-rails (estabilidade mínima, anti-rebalanceamento).
10. **Motor de Diagnóstico Pré-Venda** — funil público, Express grátis + Completo R$ 199-499 (sugestão), anti-abuso.
11. **REGULATORIO-ANEEL.md como 4º documento do Doc-0** (CLAUDE / PRODUTO / SISTEMA / REGULATORIO-ANEEL).
12. **CONTROLE-EXECUCAO.md como arquivo vivo** atualizado em toda sessão.
13. **Sprint 0 Auditoria Regulatória Emergencial** — P0 urgente, pode rodar antes de Doc-0 fechar.

### Decisão 14 — Regra permanente: validação prévia obrigatória (sessão 30/04 noite)

Todo trabalho novo (claude.ai ou Code) deve começar verificando o que já existe.
Salva em memória persistente (`regra_validacao_previa_e_retomada.md`) + `CLAUDE.md`.

Aplica retroativamente a sessões futuras independente de o prompt mencionar.

Origem: Luciano observou em 30/04 que sessões anteriores propunham trabalho sem
verificação prévia, gerando retrabalho e perda de coerência. Sprint 13 funcionou
exatamente porque seguiu essa disciplina.

### Decisão 15 — Regra de validação prévia generalizada + preventiva (sessão 01/05 manhã)

Estende Decisão 14:
- Vale pra **TODAS as ferramentas** (Code, claude.ai, futuras)
- Vale pra **TODA retomada** (não só "trabalho novo")
- Cruza **3 fontes** (doc + código + git) antes de prosseguir

Origem: claude.ai mesmo violou Decisão 14 em 30/04 noite ao propor nova numeração
de sprints sem cruzar com a antiga. Detectado em 01/05 manhã quando Luciano disse
"estávamos no 13" — Code descobriu 5 colisões + 6 órfãos (commit `1be9b34`,
`docs/sessoes/2026-05-01-mapeamento-numeracao-sprints.md`).

Memória renomeada: `regra_validacao_previa_obrigatoria.md` →
`regra_validacao_previa_e_retomada.md`.

### Decisão 16 — Diagramas C4 + ER salvos como sugestão futura (sessão 01/05 manhã)

Parceiro externo sugeriu gerar diagramas C4 Model + ER Diagram. Análise de
prioridades concluiu: **não é urgente agora** (priorizar Caminho B, reconciliação
sprints, pendências), mas é boa ideia pra futuro próximo.

Salvo em memória persistente: `~/.claude/.../memory/sugestoes_pendentes.md`
(novo arquivo de "sugestões úteis ainda não viradas em sprint").

Reavaliar quando:
- CoopereBR migrar pro SISGD em produção real (1-2 meses)
- Houver decisão de procurar investidor / sócio externo
- Entrar 3º parceiro além CoopereBR + Sinergia

### Decisão 17 — Sprint 15 + 21 descartados (sessão 01/05 manhã)

Investigação (commits `8151381` + `5ee9351`) confirmou:

**Sprint 15 (Cadastro Condomínio atomizado):** descartado.
- Definição original era 1 linha solta em `MAPA-INTEGRIDADE-SISTEMA.md:822`.
- 3 caminhos de Condomínio já cobertos:
  - **Parceiro** (Solar das Palmeiras): SUPER_ADMIN cadastra como qualquer parceiro.
  - **Membro PJ** (Churchill, Costa Atlantico, Isla Bonita, Juan Les Pins): cooperado PJ normal.
  - **Convênio** (Moradas da Enseada): mecânica de Convênio existente.
- Não há demanda concreta pra fluxo dedicado.

**Sprint 21 (Painel Síndico):** descartado.
- Helena (síndica do Moradas) é cooperada normal + conveniada do CV-MORADAS.
- Página de cooperado + tela `/dashboard/convenios/[id]/membros` (admin) atendem.
- Quando D-30P + D-30Q resolvidos (01/05, commit `fa9dc72`), conveniada gera link e vê quem entrou imediatamente (faixa recalculada na hora).

Não viram `sugestoes_pendentes.md` — função operacional já distribuída em
telas existentes.

### Decisão 18 — Compromisso processual: definição mínima de sprint (sessão 01/05 manhã)

Sprint precisa, antes de entrar na pilha:
- **Tema** (1 linha)
- **Persona/caso de uso real** (quem vai usar)
- **Critério de pronto** (o que prova que terminou)
- **Estimativa de tempo** (dias Code)
- **Dependências** (quais sprints precisam estar prontos)

Sprints com 1 linha solta **não viram sprint** — viram entrada em
`~/.claude/.../memory/sugestoes_pendentes.md` pra reavaliar quando demanda
aparecer.

**Origem:** Sprint 15 + 21 tinham 1 linha cada em `MAPA-INTEGRIDADE-SISTEMA.md`.
Causou investigação cara pra descobrir que não eram sprints viáveis (commits
`8151381` + `5ee9351`).

**Aplica retroativamente:** revisão futura de `PLANO-ATE-PRODUCAO.md` precisa
checar que cada sprint tem os 5 itens acima.

### Decisão 19 — Ritual de abertura/fechamento de sessão (sessão 02/05 manhã)

Toda sessão Code (Claude Code CLI) **abre** apresentando "Onde paramos +
Pendências priorizadas P1/P2/P3" antes de iniciar trabalho e **fecha**
atualizando o mesmo registro.

Mesmo se sessão for "continuação" no mesmo dia. Mesmo se Luciano disser
"vamos continuar de onde paramos".

**Onde fica salvo:**
- Ritual: `~/.claude/.../memory/ritual_abertura_fechamento.md` (formato fixo)
- Estado vivo: seção **"ONDE PARAMOS"** no topo deste arquivo

**Aplica-se a:**
- Code (automático, via memória persistente)
- claude.ai web (Luciano cola `CONTROLE-EXECUCAO.md` ao abrir)

**Regra inegociável dentro do ritual:** agente NÃO escolhe próxima pendência
sozinho. Apresenta P1 → P2 → P3 e espera escolha. Exceção única: quando
Luciano disser literal "tu decide" ou "ataca o que for mais urgente".

**Origem específica:** em 01/05 tarde (commit `029bb7aa`-area), Code começou
a operar autonomamente após "voltei" e escolheu pendência **P2** (hardcode
0.20 sem origem) ignorando **P1** (D-30M MLM cascata quebrado). Roteiro
existe pra evitar essa armadilha.

**Complementa:** Decisão 14 (validação prévia) + Decisão 15 (regra estendida).

### Decisão 20 — Validação prévia em CADA resposta + verificação de conflito antes de propor sprint (sessão 02/05 + 03/05 fechamento)

Estende Decisões 14 e 15 com granularidade fina:

**Em cada pergunta:** Code/claude.ai verifica documentação + funções + sessões anteriores sobre o tema **antes de responder**. Não responde "de cabeça".

**Antes de propor sprint:** verifica conflito com pilha existente, sub-sprints (Decisão 18), débitos, sugestões pendentes. Se conflito detectado: **reporta + pergunta** antes de propor.

**Origem:** sessão 02/05 violou múltiplas vezes a regra dentro da mesma sessão:
- Investigação 6 áreas omitiu specs Jest no CooperToken (Luciano cobrou)
- Investigação Área 1 omitiu documentação dedicada + funcionalidade Planos completa (Luciano cobrou)
- Code respondia "de cabeça" sem verificar docs/sessões antes de cada resposta individual

**Memória persistente atualizada:** `regra_validacao_previa_e_retomada.md` ganhou seção "EXTENSÃO 02/05/2026 — VALIDAÇÃO PRÉVIA EM CADA RESPOSTA".

**CLAUDE.md raiz atualizado:** seção "Disciplina de validação prévia (Decisões 14, 15, 20)" consolidada.

**Aplica retroativamente:** sprints catalogados em sessões anteriores precisam revisão pra checar se passariam pelo gate de conflito.

### Decisão 21 — Investigação de schema/código deve cobrir 3 frentes (sessão 05/05 tarde)

Antes de afirmar "X não existe no código":
- (a) Buscar campo/identificador literal
- (b) Verificar enum / state machine alternativo (sistema pode usar status em vez de campo dedicado)
- (c) Inspecionar comentários e docs adjacentes

Output sem `head -N` truncando — se passar de 100 linhas, refinar busca, não truncar.

**Origem:** sessão 05/05 manhã marcou etapa 11 (aprovação concessionária) como `🔴 inexistente` baseado em busca incompleta — `head -20` truncou matches do schema (linhas 125 e 232 ficaram fora do output) + busca por campo literal `aprovadoConcessionaria` ignorou enum `StatusCooperado.AGUARDANDO_CONCESSIONARIA` que é o mecanismo real. Investigação corrigida em 05/05 tarde revelou implementação 80% pronta.

**Complementa:** Decisão 14 (validação prévia em geral), Decisão 15 (regra estendida), Decisão 20 (validação em cada resposta).

**Aplica retroativamente:** revisar afirmações "X não existe" feitas em sessões anteriores quando houver dúvida.

### Decisão 22 — Aprovação admin do plano permanece manual até Sprint 5+8 (sessão claude.ai 2026-05-11)

D-J-2 da sessão 05/05 manhã perguntou: etapa 5 (aprovação admin do plano antes de virar contrato) é intencional ou gap?

**Resposta de Luciano (11/05/2026):** Intencional **com revisão temporária**. Na fase de testes/amadurecimento, admin revisa cada aceite de proposta manualmente antes de virar contrato. Não é gap.

**Quando automatizar:** transição admin → automática só faz sentido quando:
- **Sprint 5** (5 flags ANEEL — limite 25%, mix de classes, concentração por cooperado, transferência saldo, mistura classes mesma usina) estiver pronto;
- **Sprint 8** (Engine de Otimização com Split + Sugestão default + guard-rails) estiver pronto.

Aí a transição vira automática com validação por flags + sugestão da engine.

**Catalogado como débito processual:** `D-30W` (P2) em `docs/debitos-tecnicos.md` — pra revisitar quando os 2 sprints fecharem.

**Origem:** Luciano em sessão claude.ai 11/05/2026 respondendo D-J-2.

**Complementa:** decisão 30/04 sobre 5 flags regulatórias por parceiro (REGULATORIO-ANEEL.md).

### Decisão 23 — Memória de catálogo pode inflar números — validar via SQL antes de planejar (catalogada 12/05, formalizada 13/05)

**Regra inegociável:** memória de catálogo (incluindo a do Luciano e a de catálogo histórico do projeto) pode inflar números — **sempre validar via SQL antes de transformar afirmação em premissa de planejamento.**

**Origem:** "31 cobranças PAGAS via Asaas sandbox" era **ficção da memória**. Sprint 12 validou apenas payload sintético (webhook conferido com fixture). `AsaasCobranca` tabela = **0 registros**. 31 PAGAS = **100% baixa manual**, zero Asaas real. Investigação Code 12/05 desfez a hipótese.

**Aplica retroativamente a:**
- **Memória do Luciano** — esqueceu config Asaas sandbox criada Sprint 7/8 (achado-chave 1 do dia 13/05: `AsaasConfig` CoopereBR existe desde 23/03).
- **Memória de sessões anteriores** — catálogo desatualizado (ex.: dual-path Asaas só virou explícito em 13/05).
- **Análises externas de outras IAs** — quando outra IA afirmar estado do sistema, exigir validação SQL antes de assumir.

**Operacionalização:** qualquer afirmação categórica ("zero", "nunca", "não existe", "X cobranças PAGAS") merece validação SQL antes de virar premissa. Code respeitou Decisão 23 em **12/05 tarde** (desfez 31 PAGAS via SQL) e **13/05 manhã** (validou os 5 achados-chave via `SELECT` direto antes de propor decomposição D-29F).

**Complementa:** Decisão 14 (validação prévia em geral), Decisão 15 (regra estendida), Decisão 20 (validação em cada resposta), Decisão 21 (3 frentes na investigação schema/código).

**Origem:** Luciano em sessão Code 12/05 noite revelou que dados que tinham sido tratados como reais nas sessões anteriores (61 contratos zerados em D-31, 31 PAGAS Asaas sandbox) eram fictícios/baixa-manual. Decisão formalizada em sessão Fase B de 13/05.

### Sessão claude.ai 2026-04-29 (Validação INVs 4-8)
- 20 de 23 afirmações claude.ai confirmadas (3 divergências corrigidas).
- 5 mecanismos de fidelidade são paralelos puros (sem regras de exclusão).
- DRE/conciliação/fechamento não existem.
- ContratoUso só implementa aluguel fixo.
- Captura em `docs/sessoes/2026-04-29-validacao-invs-4-8.md`.

### Sessão claude.ai 2026-04-28 (Leitura Total)
- 152 telas em 5 super-rotas (87 dashboard, 28 parceiro, 16 portal, 5 proprietario, 2 agregador, 14 públicas).
- 49 telas (33%) invisíveis nos docs principais.
- 5 itens 🔴 do SISGD-VISAO (hoje em `docs/historico/`) já estavam ✅.
- Listas EDP existem (drift do doc).
- Captura em `docs/sessoes/2026-04-28-leitura-total-parte1.md` + `parte2.md`.

---

## DECISÕES PENDENTES (aguardando Luciano)

- **Quando começar Sprint CooperToken Consolidado** — pode rodar em paralelo com canário (independente do subsistema FIXO/COMPENSADOS/DINAMICO).
- Quando começar **Sprint 0** (Auditoria Regulatória Emergencial) — pode rodar antes de Doc-0 fechar (paralelo).
- Quando começar **Sprint 1** (FaturaSaas Completo) — pode rodar em paralelo.
- **Modo Sugestão sempre vs Modo Automático com guard-rails** (Engine de Otimização) — decisão de produto.
- **Cobrança do diagnóstico pré-venda**: Express grátis + Completo R$ 199-499 (sugestão claude.ai 30/04 — validar no mercado).
- **Consultoria regulatória** — advogado especializado em ANEEL pra validar premissas regulatórias críticas (limite 25%, mix de classes, transferência de saldo, etc.).
- **Hierarquia entre os 4 docs do Doc-0** — confirmar: CLAUDE.md operacional + PRODUTO.md visão humana + SISTEMA.md técnico + REGULATORIO-ANEEL.md regulatório.

---

## ARQUIVOS-CHAVE (estado)

| Arquivo | Estado |
|---|---|
| `CLAUDE.md` (raiz) | Estado atual — não atualizado nesta sessão. Será refatorado na Fatia 4. |
| `docs/CONTROLE-EXECUCAO.md` | ✅ **criado nesta sessão** (este arquivo) |
| `docs/PRODUTO.md` | ✅ **escrito nesta sessão** |
| `docs/REGULATORIO-ANEEL.md` | ✅ **escrito nesta sessão** |
| `docs/SISTEMA.md` | Stub — Fatia 3 |
| `docs/debitos-tecnicos.md` | ✅ atualizado nesta sessão (+12 débitos D-30A a D-30L) |
| `docs/PLANO-ATE-PRODUCAO.md` | ✅ atualizado nesta sessão (Sprint 0 + 9 sprints reorganizados) |
| `docs/sessoes/2026-04-30-decisoes-doc-0-fatia2.md` | ✅ criado nesta sessão |
| `docs/sessoes/2026-04-30-mapeamento-regulatorio-existente.md` | ✅ criado nesta sessão (commit `71dce8b`) |
| `docs/sessoes/2026-04-30-diagnostico-fatura-real.md` | ✅ criado nesta sessão (commit `5ae9dfd`) |
| `docs/historico/SISGD-VISAO-COMPLETA-2026-04-26.md` | ✅ **movido em 03/05** — substituído por PRODUTO.md. 2 seções únicas catalogadas como D-30S + D-30T |
| `docs/MAPA-INTEGRIDADE-SISTEMA.md` | Intacto — atualizar a cada sprint |

---

## DESCOBERTAS DE PRODUTO (estruturantes — sessão 30/04)

- **Caso Exfishes** — concentração 39,55% violando limite ANEEL não detectada pelo sistema.
- **Realocação cega** causando salto de R$ 6.600 → R$ 32.486/mês (R$ 310k/ano de prejuízo).
- **5 mecanismos de fidelidade são paralelos puros** (sem regras de exclusão entre eles).
- **CoopereAI funcional** via Anthropic SDK direto (não é apenas conceito).
- **Pipeline OCR rico** (50+ campos extraídos) mas nunca exercitado em produção: 0 cobranças com `modeloCobrancaUsado` preenchido, 0 cobranças com `faturaProcessadaId`.
- **Spec Fio B do Assis** (26/03/2026, 188 linhas) existia mas nunca implementada — schema/fórmulas/tabela 2022-2029 prontos.
- **Termo de adesão e bot citam RN 482/2012** (defasada desde Lei 14.300/2022) — risco regulatório ativo.
- **Concentrações suspeitas reais hoje** — FIGATTA 35% Usina GD II, CRIAR 16% mesma usina, agregado 51% em 2 cooperados.

---

## PRÓXIMOS PASSOS IMEDIATOS

**Fase B ✅ CONCLUÍDA em 13/05** — B.0 INDEX+SISTEMA esqueleto + B.1+B.2 débitos + B.3 Sprint Consolidado catalogado (11 fatias). 4 commits: `94bf9dc` + `049db42` + `cbce0aa` + (B.4-B.6 fechamento).

**Sequência Plano Mestre Opção 4 (decidida 12/05 noite, confirmada 13/05):**

1. **ETAPA 1 — H.2 SISTEMA.md base** (2-3d Code) — 45 módulos + 80 models + 152 telas. **Marco M1.**
2. ~~**Sub-fatia D-33 dual-path Asaas** (1-2d Code) — pré-req Fatia A.~~ **REFRAMED Caminho B 13/05 noite — D-33 P2 latente, não bloqueia mais.**
3. **Fatia A canário Caminho A real** (2-4d Code) — 1 cooperado real fim a fim. **Marco M2.**
4. **Fatia H.3 + D3** em paralelo (2d + 5-8d) — **Marco M3.**
5. **Fatia H.4 + B** em paralelo (1-2d + 3-5d) — **Marco M4.**
6. **Fatia C** (6-8h autônomo em janela disponível) — **Marco M6.**
7. **Médio prazo (45-90d):** D1 + D2 + G.
8. **Longo prazo (90+d):** E + F + L.

**Referências detalhadas:** `docs/PLANO-ATE-PRODUCAO.md` Seção 3c (11 fatias com tema/persona/critério/estimativa/dependências por fatia, cumprindo Decisão 18).

---

## COMO RETOMAR

### Frase única canônica

Frase de retomada vive em **um só lugar** — seção [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) acima.

Aplica-se a Code e claude.ai. **Decisão 24** (13/05 noite): grep amplo (`voltei|frase de retomada|como retomar`) antes de atualizar — frase única no `CONTROLE-EXECUCAO` evita versões divergentes que confundem retomada.

### Comandos pra subir ambiente local

```bash
# Backend (PM2)
pm2 list                                 # ver estado
pm2 start ecosystem.config.cjs --only cooperebr-backend
pm2 logs cooperebr-backend --lines 30

# Frontend Next.js (terminal interativo)
cd web ; npm run dev                     # porta 3001

# WhatsApp Service (PM2)
pm2 start ecosystem.config.cjs --only cooperebr-whatsapp
```

**Atenção:** o frontend NÃO é gerenciado por PM2 (terminal vivo). Backend SIM (gerenciado por PM2). Antes de `prisma generate` ou `db push`, sempre `pm2 stop cooperebr-backend` (engine Prisma fica lockado se backend rodando).

---

*Arquivo vivo. Atualizar em TODA sessão (claude.ai ou Code).*
