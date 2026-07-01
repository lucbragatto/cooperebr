# Controle de Execução — SISGD

> Arquivo vivo. Atualizar em **toda sessão** (claude.ai e Code).
> Última atualização: **2026-06-22 (Code) — M48 Sprint Funil Camada 1 MOTOR FECHADO — Roteador A/B/C advisory + AliasParceiroSisgd + LeadExpansao.converter**. Camada 1 do Funil de Aquisição (motor backend). **PASSIVO/ADVISORY only**: decide caminho + grava metadata em 4 campos do Cooperado. NÃO bloqueia, NÃO redireciona, NÃO dispara migração. Enforcement vem nas Camadas 2/3 (vitrines parceiro + SISGD marketplace). Schema delta aditivo: `AliasParceiroSisgd` (tenant-aware, 6 seeds CoopereBR) + `Cooperado.roteamento*` 4 campos + `FaturaProcessada.classificacaoScee` (hook deferido). Matcher: CNPJ direto com validação DV oficial Receita Federal (H2 — evita telefone como CNPJ) + alias ILIKE substring nos 2 sentidos. Cross-tenant lookup intencional documentado — retorno opaco (só tenantAlvo+razao). `LeadExpansao.converter()` fecha gap M47 com typed errors. 23 specs Jest + smoke E2E REAL 3/3 PASS (motor silencioso — D-novo-WA-DEV-FALSE-OK não se aplica). Reviewers multitenant + code-reviewer + re-review orquestrador APROVADOS COM RESSALVAS (2 HIGH + 3 P2 + 2 M + 2 L fixes pré-merge). Commits: `26201d8` (feat) + `e9db14b` (merge --no-ff). Feature branch `feature/funil-roteador-engine` PRESERVADA. **CONVÊNIO COOPERATIVIZADO COMPLETO** (M44 + M46 + M47 + M48). Próximo: **Sprint FAMÍLIA (Fase 2 G1+G4) com conversibilidade de token CONFIGURÁVEL** (abate-fatura não-conversível default + saque gated reusa D2/M41). DEPENDE spec orquestrador. **Camadas 2/3 do Funil (vitrines) BLOQUEADAS pelo Hardening Lateral** (4 P1 M45 + 2 P2 M46 + 2 P2 M47 + 1 P1 M48 LEAD-EXPANSAO-PUBLIC-TENANT-SPOOF — 3ª ocorrência mesmo spoof M45 — pré-requisito obrigatório de exposição pública). Detalhe: `docs/sessoes/2026-06-22-m48-sprint-funil-camada-1-motor.md`.

> Histórico: **2026-06-21 (Code) — M47 Sprint Convênio MIGRAÇÃO FECHADO — G2 estados + G5 doc + ciclo admin-manual + smoke real**. Sprint Fase 3 do design 19/06 que FINALIZA o **convênio cooperativizado COMPLETO** (M44 + M46 + M47). Mecânica admin-manual de migração de cooperado de distribuidora/cooperativa CONCORRENTE → SISGD. **Sem roteador A/B/C** (deferido como Sprint Roteador+Funil — aguarda spec do orquestrador + decisão de produto Luciano). Schema delta aditivo (StatusCooperado += PENDENTE_MIGRACAO + DESLIGADO; MigracaoUsina += 5 campos opcionais + 2 indexes), 3 endpoints admin sob `/cooperados/:id/migrar*` com `cooperativaId` SEMPRE do JWT (lição M45), 2 guards billing MUST-FIX (cobrancas + convenios-custeio), cron timeout 30d + AuditLog + WA admin, seed ModeloDocumento DESLIGAMENTO_CONCORRENTE tenant-agnóstico (`{{provedora.*}}` em branco — princípio multi-tenant 17/05). E3 confirmado: cooperado em PENDENTE_MIGRACAO tem saldo CONGELADO via STATUS_PERMITIDOS_CREDITO (7 pontos do circuito). 30 specs Jest + smoke E2E REAL (2 WAs reais ENVIADA pro whitelist 27981341348). Reviewers multitenant + financeiro-token + code-reviewer + re-review orquestrador APROVADOS COM RESSALVAS (fixes pré-merge aplicados). Commits: `5ee0aff` (feat) + `f36782b` (merge --no-ff). Feature branch `feature/convenio-migracao` PRESERVADA. **Convênio cooperativizado COMPLETO. Família (Fase 2 G1) DEFERIDA até parecer trabalhista.** Próximo: **Sprint ROTEADOR + FUNIL** (depende formalização da spec + decisão produto Luciano sobre vitrine SISGD marketplace). **2 débitos DESTACADOS pra fechar antes de escalar pra 2º parceiro real**: D-novo-M47-DESLIGADO-SALDO-RESIDUAL P2 (inconsistência E1 — tokens travados no DESLIGADO) + D-novo-M47-MSG-MULTI-TENANT-PARCEIRO P2 (mensagens WA hardcodam "CoopereBR" — bloqueia onboarding Consórcio/Associação/Condomínio). Detalhe: `docs/sessoes/2026-06-21-m47-sprint-convenio-migracao.md`.

> Histórico: **2026-06-21 (Code) — M46 Sprint Convênio FUNDAÇÃO FECHADO — E1 tokens ficam + E8 notificações wiradas + smoke E2E real**. Sprint pequena (~3h) que finaliza a fundação do ciclo de vida + notificações do convênio cooperativizado (design 19/06). E1 (decisão Luciano: tokens FICAM com funcionário no desligamento) validado na Fase 1 read-only — `removerMembro` já não tocava saldo — + ampliado com notificação WA inline ("seus N tokens continuam seus, R$ Y" calculado via `ConfigCooperToken` do tenant). E8 (`TokenNotificacaoService` órfão desde Sprint Token-WA Fase 2) wirado via novo `CooperTokenNotificacaoListener` único consumindo `RESGATADO` (fatura abatida — usarNaFatura-only) + `DISTRIBUIDO_CONVENIO` (novo, empresa-PJ → funcionário). 22 specs Jest verde + **smoke E2E REAL passou** (cooperado-teste whitelist 27981341348 → MensagemWhatsapp.status='ENVIADA' real; D-novo-WA-DEV-FALSE-OK descartado). Reviewers multitenant + code-reviewer + re-review orquestrador APROVADOS COM RESSALVAS (3 fixes pré-merge: hardcode 0.45 → ConfigCooperToken; idempotência cooperativaId defense-in-depth; spec assertion). Commits: `79e5f1f` (feat) + `950d2c1` (merge --no-ff). Feature branch `feature/convenio-fundacao-lifecycle` PRESERVADA. Próximo: **#3 Sprint Convênio MIGRAÇÃO (Fase 3 — G2 estados + G5 doc desligamento + rollback) — legalmente SEGURA**. FAMÍLIA (Fase 2 G1) aguarda parecer trabalhista. **Observação:** IDOR sistêmico ACUMULANDO (M45 lateral + 3 D-novo-CONVENIO-*-SEM-COOPID novos + inventário SISGD) — candidato a Sprint Hardening Lateral próximo. Detalhe: `docs/sessoes/2026-06-21-m46-sprint-convenio-fundacao.md`.

> Histórico: **2026-06-21 (Code) — M45 Sprint Hardening Tenant-Spoof FECHADO — bloqueia exposição ANÔNIMA do /cadastro**. Fecha 2 débitos descobertos na investigação M44: `D-novo-COOPERADOS-CONTROLLER-TENANT-SPOOF` P0 + `D-novo-CADASTRO-PUBLICO-TENANT-SPOOF` P1 + bônus `convenios-pagador-empresa` validação anti-enumeração. POST `/cooperados` descarta `body.cooperativaId` (destructure-discard); tenant vem SÓ do JWT; SUPER_ADMIN escala via `cooperativaIdAlvo` validado (DTO `@Matches` CUID + `Cooperativa.findUnique` ativo). Cadastros públicos exigem `?tenant=<id>` validado → 404 se inexistente/inativa. Path convite (`?conv=<token>`) preservado intacto. Frontend: 4 fetches + 3 links com `encodeURIComponent`. **HONESTO:** sprint NÃO fecha spoofs AUTENTICADOS (cadastroCompleto, motor-proposta, 3 controllers laterais asaas/condominios/convite-indicacao) — catalogados como 4 débitos P1 da próxima Sprint Hardening Lateral. NÃO bloqueia piloto Santi. Reviewers multitenant + security APROVARAM com ressalvas (P0+P1+P2+P3 fixes aplicados pré-merge). 32 specs Jest + smoke E2E real 5/5 PASS. Commits: `9403095` (feat) + `5cd46ba` (merge --no-ff). Feature branch `feature/hardening-tenant-spoof` PRESERVADA. Próximo: decisão Luciano #2 Convênio Fase 2 (escopo piloto) OU default fast-follow Sprint Hardening Lateral. Detalhe: `docs/sessoes/2026-06-21-m45-sprint-hardening-tenant-spoof.md`.

> Histórico: **2026-06-20 (Code) — M44 Slice Convênio Origem-Dado FECHADO**. Cadastro V2 (4 telas: público com/sem UC + wizard admin com/sem UC) agora **registra como DADO** se cooperado já recebe créditos GD de outro fornecedor + `CooperTokenCompra.convenioId` opcional com guard multi-tenant obrigatório. Schema delta aditivo (2 campos GD em `Cooperado` + `convenioId` em `CooperTokenCompra` + FK `onDelete:SetNull` + 3 índices + back-relation `ContratoConvenio.cooperTokenCompras`). 6 specs Jest verde + smoke E2E 5 casos. Reviewers multitenant + financeiro-token + re-review orquestrador APROVADOS. FUNDACAO §4#1 preservada. Commits: `2af634a` (feat) + `6847e5a` (merge --no-ff). Feature branch `feature/convenio-origem-dado` PRESERVADA. 4 débitos pré-existentes descobertos na investigação (D-novo-COOPERADOS-CONTROLLER-TENANT-SPOOF P0 + D-novo-CADASTRO-PUBLICO-TENANT-SPOOF P1 + 2 polimento) + `D-novo-CONVENIO-ORIGEM-LEDGER` rebaixado P1→P2. Próximo: **Sprint Hardening Tenant-Spoof** como BLOQUEADOR de exposição antes de tunelar `/cadastro` público. Detalhe: `docs/sessoes/2026-06-20-m44-convenio-origem-dado.md`.

> Histórico: **2026-06-18 noite (Cowork) — M39 Concierge: Refutação Relatório Externo + Parecer V2 + Sumário Executivo V2**. Sessão de análise crítica disparada por relatório externo "SISGD-Concierge v1.1" que propunha recalibração radical do parecer 15/06. Análise ponto a ponto identificou **6 contribuições válidas INCORPORADAS** (ADI 7.195/DF rebaixando Teses 2 e 6 pra Médio-Alto; ADIs FCP 7.077/7.634/7.716 como reforço sistêmico não fundamento direto; segregação Tese 6 por perfil geradoras×consumidores; Tema 986/STJ como "distinguishing consolidado" não "ressalva expressa"; alerta Lucro Real reforçado; checklist procedimental) e **6 proposições excessivas REFUTADAS** (extinção das Teses 9/10 confunde planos da incidência — CTN art. 97 IV; substituição das teses tributárias por duplo custeio regulatório ignora planos distintos cumulativos; expurgo de CDE e Gross-Up renuncia pedidos subsidiários; afastamento da Tese 6 das piloto perde R$ 525k do [Cliente E]; cálculo "-3,99% prejuízo líquido cash" matematicamente incorreto — cliente LR credita 9,25% sobre VALOR PAGO não sobre o que EDP recolheu; auto-titulação como v1.1 factualmente incorreta — oficial é v1.0). Portfólio MANTIDO em 10 teses tributárias + **Tese 11 (Duplo Custeio Regulatório TUSD-G + Fio B) ACRESCIDA** em PARALELO via consulta ANEEL. Magnitude econômica preservada: R$ 1.344.522 em 60m+SELIC. Recuperação realista recalibrada: **R$ 350.000–R$ 460.320** (de R$ 460.320 original). 3 NOVOS documentos emitidos preservando antigos: `docs/concierge/pareceres/2026-06-18-refutacao-relatorio-sisgd-v1-1.md` + `docs/concierge/pareceres/2026-06-18-parecer-v2-patches-incorporacao.md` + `docs/concierge/pareceres/2026-06-18-sumario-executivo-v2.md`. 5 decisões D18/06-4..8 catalogadas (rejeição substituição radical; incorporação 6 patches; refutação matemática "-3,99%"; catalogação Tese 11 regulatória; preservação obrigatória versões antigas). Detalhe: `docs/sessoes/2026-06-18-noite-refutacao-relatorio-externo-parecer-v2.md`.

> Histórico: **2026-06-16 — M39 Emissão Admin em Lote + Estorno COMPLETO** (Sprint Clube Unificado P1). **12 commits trabalho + 1 merge --no-ff** no main (`db3c545..d1f6a6d`). Substitui caminho admin single-target de `enviarTokensAdmin` (@deprecated, mantido por COMPAT do ramo cooperado→cooperado) por novo endpoint `POST /cooper-token/admin/emitir-lote` em lote via helper `executarMassWrite`. Schema delta aditivo: 2 enums novos (`BONIFICACAO_ADMIN` + `ESTORNO_BONIFICACAO_ADMIN`) + conta contábil `5.1.03 "Despesa de Bonificação CooperToken"`. 2 templates contábeis novos com **bypass intencional do `COOPER_TOKEN_EVENTS.EMITIDO`** pra não disparar o template errado da F1 lancarEmissaoFaturaCheia. Frontend `/dashboard/cooper-token/enviar` REDESENHADO em 2 etapas (seleção + confirmação) com filtro opcional por convênio + tabela editável + prévia COMPLETA antes do OTP. Tela nova `/dashboard/cooper-token/lotes-emitidos` com modal de estorno (confirmação dupla + motivo ≥10 chars + reversão atômica saldo+contábil+ledger ESTORNO). **2 rodadas de reviewers pesados** (financeiro-token bloqueou com 3 P1 + multitenant aprovou com 1 P2 → todos fixados pré-smoke). **Re-review do orquestrador pegou 2 P1 RESIDUAIS** (helper `:256` chumbado escapou do replace_all + guard de integridade ausente no estorno) → fixados antes de push. Smoke E2E real **PASS 6/6** com gate inegociável respeitado (1 token + estorno imediato, NUNCA emissão real Santi). Suite **311/311 verde** (cooper-token 286 + mass-write 25). **D-novo-EMISSAO-ADMIN-CONTABIL P2** catalogado pra sprint contábil dedicada futura (4 problemas pré-existentes no token-contábil: tipo conta `5.1.02` DESPESA→PASSIVO + template F2 errado + F3/F6/clube sem `LancamentoCaixa`, depende de D3 Modelo C preço custo×venda). Detalhe: `docs/sessoes/2026-06-16-m39-emissao-admin-em-lote.md`.

> Histórico: **2026-06-15 — M38 Fatia A v2 (CTK→CooperTokens + Voltar ao Clube) + Fix Santi 403 (Track B) + Portal Conveniada (Track B.2)**. **11 commits trabalho + 3 merges --no-ff no main** (`821a9dd..87ae6f7`). Fatia A v2 fechou nomenclatura em 12 spots + botão "Voltar ao Clube" em 11 telas do hub (Fatia A v1 stale descartada). Track B corrigiu bug crítico empresa_conveniada distribuir tokens (guard usava `conveniadoId` legado em vez de `pagadorCooperadoId`) — desbloqueio Santi em produção. Track B.2 corrigiu portal `meusConvenios + dashboardConveniado` (OR cobre legado+novo + `cooperativaId` explícito anti-IDOR). 2 rodadas do `multitenant-reviewer` no Track B + 2 no Track B.2 (1 bloqueio P1 fechado pré-merge). Smoke E2E real Santi 2/2 (distribuir) + 3/3 (portal) PASS. 3 débitos novos catalogados (D-novo-CONVENIO-CONVENIADO-LEGADO P3 expandido com audit dos 5 spots + D-novo-CONVENIO-ADMIN-IDOR-UPDATE-REMOVE P2 + D-novo-CONVENIOS-PORTAL-SPECS P3). Sessão Cowork paralela: 3 relatórios novos (`ANALISE-CONVENIO-TOKEN-CLUBE`, `GAP-MAP-CONVENIO-MODELO-C`, `FLUXO-EMISSAO-TOKEN-CONVENIO`) — pré-requisito leitura próxima sessão. Detalhe: `docs/sessoes/2026-06-15-m38-fatia-a-v2-fix-santi-403-e-portal.md`.

> Histórico: **2026-06-14 noite — M37 Sprint Higiene de Rotas COMPLETO (D-1171 fechado) + carona M36 mergeada**. Sessão Code maratona fechou Blocos A+B+C+D+E ponta-a-ponta em 4 commits trabalho + 1 commit débito + 1 merge `--no-ff` (`f85483f` no main): convergência `/parceiro/*` → `/dashboard/*` finalizada (19 telas-fantasma deletadas + 33 redirects 301 `permanent:true`), área nova `/estabelecimento/*` com guard `ehEstabelecimento` (3 telas movidas + layout próprio laranja + card de entrada em `/portal`), op admin "Enviar Tokens" reposicionada em `/dashboard/cooper-token/enviar` (card no hub `/dashboard/clube`), header renomeado pra distinguir `"Painel do Tenant — {nome}"` (super-admin) de `"Painel Administrativo — {nome}"` (admin do parceiro). P1 anti-IDOR aplicado em `cooperados.service.ts:46` (`meuPerfil` agora filtra `cooperativaId` no `OR email/CPF` — campo `ehEstabelecimento` lido desse perfil arma guard de `/estabelecimento`, não pode resolver tenant errado). `cooperebr-multitenant-reviewer` rodou em 2 rodadas (Bloco A + Bloco B+C+D); smoke validou os 7 redirects relevantes (308 = permanent equivalent) e a permissão de admin_parceiro (sidebar sem "Gestão Global", header correto). **D-1171 FECHADO.** Sessão paralela Cowork/M36 (pipeline IMAP→OCR destravado + caso Luciano Concierge EDP_ES + modelo CEMIG/MG) mergeada junto como carona — ressalva **D-novo-EMAIL-IMAP-SSL-VERIFY P2** catalogada antes do merge (`tls.rejectUnauthorized:false` incondicional em `email-monitor.service.ts` precisa ser gated por env OU substituído por cert próprio ANTES de qualquer deploy de produção, risco MITM no IMAP). Detalhe: `docs/sessoes/2026-06-14-higiene-rotas-blocos-B-E.md` + carona Cowork em `docs/sessoes/2026-06-14-pipeline-ocr-destravado-e-caso-luciano.md`.

> Histórico: **2026-06-14 tarde — M36 Pipeline IMAP→OCR DESTRAVADO + Caso Luciano Concierge EDP_ES + Modelo CEMIG/MG**. **5h sessão Cowork.** Pipeline IMAP→OCR estava parado há 6 meses (SSL Kaspersky); patch `tls.rejectUnauthorized:false` em `email-monitor.service.ts` + script V2 `processar-faturas-por-cooperado.ts` (NestJS standalone, busca por UC, 1 fatura/pessoa, checkpoint resumível, 90s timeout) elevou universo Concierge de 9 → 48 FaturaProcessada (+37 novas em 31.6 min, custo OCR ~R$ 9). Script Fase 1 `comparar-cadastro-com-fatura.ts` gera XLSX 5 abas (Vazios/Divergentes/Qualidade/kWh por cooperado/Resumo agregado) salvo no workspace OneDrive (PII fora do repo). Diagnóstico revelou **97% das UCs com distribuidora=OUTRAS** (291 de 300 cooperados ATIVOS — gargalo da busca IMAP). UPDATE em massa ADIADO por decisão Luciano: cooperados ATIVOS são placeholders do sistema antigo, vão ser substituídos via cadastro novo sob a fatura; OCR detecta distribuidora e preenche corretamente desde o início. **Caso Luciano (cooperado real EDP_ES, Vila Velha/Vitória, UC 0.001.421.380.054-70):** fatura 02/2026 R$ 194,25, créditos SCEE 1.883 kWh, saldo 4.597 kWh, participação 15%. **Indébito Concierge estimado: ~R$ 154/mês ou R$ 11.340 em 60m+SELIC** (Tema 69 ~R$43 + Tese 3 ~R$41 + Tese 6 ~R$70). Estimativa caminho B ±30% — pra valor exato falta re-OCR detalhado. **Modelo CEMIG/MG (caso Marco Aurelio Almeida, Aimorés/MG, UC 1.364.690.018-71):** auditoria revelou **CEMIG conformidade tributária** nas 3 teses majoritárias (Tema 69 exclui ICMS da base PIS/COFINS ✓ + Tese 3 não cobra federal sobre SCEE ✓ + Tese 6 não cobra ICMS sobre TUSD/TE SCEE ✓) → **CEMIG/MG tem potencial Concierge BAIXO**, precisa outras angulações (saldo SCEE expirando + CIP municipal + gross-up). Documentos: `docs/concierge/casos/luciano-bragatto-EDP_ES.md` + `docs/concierge/modelos/cemig-MG-modelo.md`. **5 débitos técnicos novos catalogados** (P1: Uc.distribuidora não preenchido cross-cutting + OCR não extrai rubricas detalhadas / P2: 20 cooperados com fatura mock 481kWh idêntica + mês ref vazio em 11/48 / P3: Cooperado.cpf duplicado com documento). 5 decisões D14/06-1..5 travadas. Detalhe: `docs/sessoes/2026-06-14-pipeline-ocr-destravado-e-caso-luciano.md`.

> Histórico: **2026-06-13/14 — M35 Sprint Clube P1 F6 Resgate em R$ via PIX COMPLETO (Bloco C + C.4 + C.5)**. **8 commits trabalho** (`27b5e24` C.0 + `eb94494` C.1 + `a23cb2f` C.2 + `335e7ff` C.3 + `b397b35` C.4 P0-A IDOR chave PIX [push isolado cirúrgico via hotfix branch] + `03c66ba` C.4 P0-B webhook TRANSFER_* + `5ab05fc` C.4 P1+P2 + `9372c89` C.4 pós-re-review + `2459245` C.5 GAP-1 tx Serializable única no FAILED). F6 fechado ponta-a-ponta: backend B+C.4 + frontend portal estabelecimento + frontend admin + sidebar + 2 rodadas reviewers pesados (`cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer`) acharam 2 P0 (IDOR chave PIX + webhook TRANSFER_* órfão) + 4 P1 (F6-2 status/F6-3 limite/F6-5 throttle/MT) + 4 P2 (mascarar/CAS tenant/tx Serializable PAGO/fuso SP) — TODOS RESOLVIDOS. Re-review independente do orquestrador pegou GAP-1 P1 (tx Serializable não-atômica no caminho FAILED — invisível ao smoke porque não simula crash) → C.5 fechou unindo CAS+estorno+eventId numa única tx (espelha F6-7 sucesso) + GAP-2 P3 saldoApos total. **Smoke E2E F6 C.4 com 5 cenários PASS 29/29** (Golden TRANSFER_DONE + Falha TRANSFER_FAILED + Idempotência webhook + Webhook forjado 401 + Limite diário F6-3 burlável fix). **Suite total 349/349 verdes** (24 suites cooper-token + meu-perfil + asaas + asaas-pix-out). **REFORÇO ANTI-FRAUDE Luciano materializado em duas camadas**: PIN obrigatório pra trocar chave PIX + banner amber se chave alterada <24h ANTES do recibo no Dialog admin de aprovação. **2 débitos catalogados**: D-novo-F6-RECONCILIACAO-CRON P2 + D-novo-MT-F2-F3-F4-LEGADO-UPDATE-COOPERADO P2. **4ª violação documentada de disciplina de push em sessões paralelas** — Cowork pushou meus commits C.1-C.4 segurados sem aprovação explícita Luciano, embarcados no commit dela `98dde72 inventario ANEEL`. **Decisão Luciano consequente: a partir da Fatia A (próxima sprint), segurar em `feature/<fatia>` desde o 1º commit** — fim do gate furado. Detalhe: `docs/sessoes/2026-06-13-f6-resgate-pix-completo.md`.

> Histórico: **2026-06-12 — M34 Sprint Clube P1 F6 Estabelecimento resgata tokens em R$ via PIX (Blocos A+B)**. **2 commits trabalho** (`c5eee91` + `b3251f5`) + 1 commit fechamento — **push segurado** até Bloco C + reviewers pesados + smoke E2E (instrução explícita Luciano: "Push segurado"). Bloco A: schema delta aditivo voucher (`Cooperado.ehEstabelecimento` + `CooperTokenSaldo.saldoBloqueadoResgate` + enum `CooperTokenTipo += RESGATE_PIX, ESTORNO_RESGATE_PIX` + 2 models novos `ResgateRecibo` + `ResgateReciboCounter` com 3 unique constraints) + helper `AsaasPixOutService` extraído de `pix-excedente.service.ts:132-157` (PIX-out tenant-aware via `getApiClient(cooperativaId)` + `isAmbienteReal()` retorna SIMULATED sem chamar Asaas + 18 specs). Bloco B: service `solicitarResgate`+`aprovarResgate`+`recusarResgate`+`cancelarResgate`+`processarWebhookResgate`+`estornarResgateInterno`(privado, NUNCA apaga)+`listarResgatesPendentes`+`gerarNumeroRecibo` (counter sequencial humano POR COOPERATIVA `RES-YYYY-NNNNN`) + 5 endpoints REST (`POST /empresa/resgatar`, `POST /empresa/resgates/:id/cancelar`, `GET /admin/resgates-pendentes`, `POST /admin/resgates/:id/aprovar`, `POST /admin/resgates/:id/recusar`) + DTOs `SolicitarResgateDto`+`RecusarResgateDto` + 34 specs verdes. **3 REFORÇOS Luciano materializados como centro do bloco**: (1) compare-and-swap em TODAS transições (5 pontos: aprovar/recusar/cancelar/webhook PAGO/webhook FAILED) via `updateMany({where:{id, cooperativaId, status:'esperado'}}) → count===1`; (2) estorno SEMPRE via nova entry ledger CREDITO `ESTORNO_RESGATE_PIX` (trilha auditável NUNCA apaga); (3) webhook idempotente via `ultimoWebhookEventId` checado antes do swap (duplicado retorna `{skipped:'webhook-duplicado'}`). Ordem do fluxo: PIN FORA da tx (`PinCooperadoService.validarPinComLockout` F2.3) + tier ALTO `valor>R$50` exige OTP (`OtpDesafioService.validarOuLancar` motivo `TOKEN_TRANSACAO_STEP_UP`) + `assertLimite` sobre TOTAL F2.5 + bloqueio do saldo DENTRO da tx Serializable (re-snapshot + conservação invariante `disp+bloq` constante) + `numeroRecibo` gerado na mesma tx via counter sequencial. Vocabulário inegociável "resgate"/"liquidação"/"recibo" em todas as strings (NUNCA "recompra"/"venda" — decisão circuito 04/06). **296/296 specs verdes** (18 suites cooper-token + mass-write + asaas-pix-out). Detalhe: `docs/sessoes/2026-06-12-m34-f6-blocos-ab.md`.

> Histórico: **2026-06-12 — M33 Sprint Clube P1 F3 Empresa distribui tokens em LOTE/INDIVIDUAL (Blocos A+B+C+C.1)**. **4 commits trabalho** (`4bb36aa..8425169`): Bloco A schema delta (`CooperTokenTipo += DISTRIBUICAO_CONVENIO` + 2 cols TokenTransacao `naturezaDistribuicao` + `empresaDeclaraTetoClt`) + helper `executarMassWrite` reusável (cap + PREVIEW/CONFIRM + idempotência por callback + AuditLog) com 20 specs verdes · Bloco B service `distribuirTokens` (6 guards: naturezas semânticas + empresa-PJ + convênio ownership conveniadoId + PIN fora tx + `assertLimite` sobre TOTAL ajuste Luciano + destinatários MEMBRO_ATIVO; loop linha-a-linha dentro tx Serializable; tipo DISTRIBUICAO_CONVENIO no ledger NÃO DOACAO; 1ª linha grava referência idempotência) + DTO class-validator + endpoint `POST /cooper-token/empresa/distribuir` (perfil COOPERADO + JWT sourcing) com 28 specs · Bloco C UI completa `/conveniada/convenio/[id]/distribuir-tokens` (2 etapas selecao+confirmacao + Iguais a X/Selecionar todos + card preview 4 stats + modal radio 3 naturezas + condicionais CLT checkbox/PREMIACAO textarea + PinInput F4 Bloco D reusado + tratamento humano dos 7 erros + clientRequestId useRef padrão C.2 + contador pendentes + help inline) + endpoint helper `GET /cooper-token/empresa/convenio/:id/membros-disponiveis` (agrega saldo+ativos+pendentes breakdown) + card de entrada na página do convênio · Bloco C.1 pós-reviewers 2 P1 (GAP-F3-2/5 round IEEE somaQuantidade + GAP-F3-3 valorTokenEsperado preview===cobrança) + 4 P2 (GAP-F3-4 guard taxa>0 até gate D-novo-TAXA-TRANSFER-DESTINO + MT-A cooperado.is.cooperativaId + MT-B remover PII cpf/telefone + GAP-F3-8 spec membros inválidos ZERO writes) + 3 caronas P3 (GAP-F3-6 N updates do saldo → 1 update final + pagadorCooperativaId no updateMany + GAP-F3-7 spec conservação linear) com 12 specs novos. **244/244 specs cooper-token + mass-write verdes** (60 novos no F3). **2 rodadas reviewers pesados** (`cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer`): 1ª achou 2 P1+4 P2+3 caronas+1 débito → C.1 fechou; 2ª aprovou pro smoke/push + 3 observações não-bloqueantes. **Pergunta da corrida CONFIRMs concorrentes VALIDADA** — Serializable (40001) + retry idempotência; D-novo-LEDGER-UNIQUE-CONSTRAINT fica P3 separado. **Smoke E2E 14/14 PASS real** (HTTP backend :3000 + AMAGES `ambienteTeste=true` + JWT manual + convênio SMOKE-F3-AMAGES criado idempotente + João/Ana como MEMBRO_ATIVO): listar membros + MT-B sem PII + PREVIEW + CONFIRM + saldo debitado 1× + créditos individuais + ledger DISTRIBUICAO_CONVENIO 2N entries + 1ª linha com referência idempotência + TokenTransacao naturezaDistribuicao='ORIGEM_REGULAMENTO' + retry idempotente sem dupla distribuição + VOLUNTARIA s/ CLT 400 + extrato funcionário DISTRIBUICAO_CONVENIO (segregação Art. 87 validada). **3 débitos novos** catalogados (D-novo-F3-RACE-CONFIRMS-CONCORRENTES P3 validado raciocínio + D-novo-F3-INCONSISTENCIA-BANCO P3 + D-novo-TAXA-TRANSFER-DESTINO P2 ganhou gate explícito no service). Detalhe: `docs/sessoes/2026-06-12-f3-empresa-distribui-lote.md`.

> Histórico: **2026-06-12 — M32 Sprint Clube P1 F4 cooperado-only completo (Blocos A→D + C.1 + C.2)**. **8 commits trabalho** (`e73b64a..4a0ee87`): Bloco A `usarNaFatura` PIN + Serializable + status-guard idempotente · Bloco B schema `qrExpiresAt` nullable + helper `criarTokenTransacao` centralizado (jti + tier + motivoStepUp + guards multi-tenant em 3 camadas) · Bloco C helper consumido nos 3 endpoints + step-up admin OTP + endpoint stub `/otp-step-up` · carona auth cookie Secure por protocolo real · Bloco C.1 (3 P1 FIN-1/FIN-2/MT-1 + 4 P2 FIN-4/MT-2 + 4 caronas FIN-7/MT-3/MT-4/MT-5) · C.2 `clientRequestId` estável por sessão de confirmação no frontend admin · Bloco D `<PinInput>` wrapper de OtpInput + modal PIN 2 etapas em `/portal/tokens` + tratamento humano dos 4 erros + help inline · D carona helper `formatarTelefone` único + fix strip 55 prefix. **184/184 specs cooper-token verdes** (78 novos no F4). **2 rodadas reviewers pesados** (`financeiro-token` + `multitenant`): 1ª achou 3 P1+4 P2+caronas → Bloco C.1 fechou; 2ª aprovou tudo + flagou 1 P1 novo (breaking caller) → C.2 fechou. **Smoke E2E 8/8 PASS** real (HTTP backend :3000 + AMAGES `ambienteTeste=true` + JWT manual): golden path R$ 4,50 desconto + TokenTransacao USO_FATURA tier=BAIXO motivo=PRIMEIRO_USO + PIN incorreto 403 + EXCEDE_LIMITE 400 + duplo-clique exatamente 1 sucesso + 1 falha (Serializable abortou 2ª) + ledger 1 entry só + idempotência admin app-level. **5 débitos novos** P2/P3 catalogados (UI cooperado→cooperado parcial decidido como (a) — superfícies WA-first Fase 3 reabrirá). Detalhe: `docs/sessoes/2026-06-12-f4-cooperado-only-completo.md`.

> Histórico: **2026-06-11 — M31 Sprint Clube P1 Fase 2: Empresa-PJ-cooperada compra tokens via Asaas SANDBOX + idempotência race-free + gancho contábil rio-token + UI portal dedicada + smoke E2E real**. **6 commits trabalho** (`826d4f1..d69ebf3`): Bloco 1 schema delta CooperTokenCompra (3 cols aditivas + COMPRA_PJ_COOPERADA + @@unique[asaasId]) · Bloco 2 service comprarTokensCooperado + DTO + endpoint /cooper-token/cooperado/comprar + Asaas SANDBOX + 10 specs · Bloco 3 webhook extension + EventEmitter (evita ciclo Asaas↔CooperToken) + listener + processarPagamentoCompraPj + idempotência 2 camadas + 8 specs · 5º commit fixes P1 pós-review (GAP 1 compare-and-swap atômico + GAP 2 status PAGO_CREDITO_PENDENTE + alerta loud + cross-tenant guard novo em creditar) + 4 specs · Bloco 4 UI /portal/comprar-tokens dedicada (padrão Tipo B com guard PJ + form + preview + Asaas link/QR/boleto) + link condicional /portal/tokens. 9 suites / 106 tests cooper-token verde. TSC web exit 0. **Reviewers cooperebr-financeiro-token-reviewer + cooperebr-multitenant-reviewer aprovaram zero P0/P1 em 2 rodadas**. **Smoke E2E real** com Santi PJ no Asaas SANDBOX: compra 100 PIX → cobrança real (pay_wrh5zqdifbcx33vb, QR 1144 chars base64) → dual-webhook CONFIRMED+RECEIVED → 5/5 asserts PASS (status PAGO + saldo +98 tokens + ledger 1 entry só compare-and-swap + tipo COMPRA_PJ_COOPERADA). **Gancho contábil rio-token automático** (2 LancamentoCaixa R$ 44,10 D Custo + C Passivo via FinanceiroTokenListener.handleEmitido). 4 débitos novos: D-novo-ASAAS-WEBHOOK-AUTH P2 + D-novo-LEDGER-UNIQUE-CONSTRAINT P3 + D-novo-CREDITO-PENDENTE-REPROCESSAMENTO P2. Detalhe: `docs/sessoes/2026-06-11-f2-compra-pj-cooperada.md`.

> Histórico: **2026-06-10 — M30 Sprint Clube Unificado P1: Fase 1 HUB + Fase 1.5 ECONOMIA (4 blocos) + 5º commit fixes pós-review + Fase 1.1 POLIMENTO MLM**. **8 commits trabalho** (`e4d0976..ed33ffb`): Hub `/dashboard/clube` aglutina 6 itens espalhados em grid de cards + menu único + "Planos (Comercial)" desambiguado; F1.5 entrega 11 colunas aditivas em ConfigCooperToken (8 taxas per-operação + 3 oxidação + marco `oxidacaoAtivadaEm`), helper puro `calcularTaxa` substituindo constantes chumbadas (preserva 2%/1% via fallback), `aplicarOxidacao` prospectivo com 3 invariantes (marco + graça + piso) + cron mensal + gate técnico `OXIDACAO_PRODUCAO_LIBERADA`, UI dedicada `/dashboard/cooper-token/config` (banner âmbar gate jurídico + guard de UX) + link único em `/parceiro/configuracoes`; 5º commit fixes pós-review (G2 strings hardcoded + G3 gate duplicado + MT P2 cooperativaId obrigatório) aprovados pelos reviewers `cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer` (zero P0/P1); Fase 1.1 polimento (3 cards MLM no hub + botão "Voltar ao Clube" consistente em cooper-token/parceiro/financeiro). 85/85 specs Jest verde (7 suites cooper-token: taxa-helper + qr-conformidade + oxidacao + f15-fixes + idor-bq2 + limite-token + token-notificacao). TSC web exit 0. 3 débitos novos: D-novo-OXIDACAO-LEDGER-TIPO P2 (pre-requisito ligar oxidação em prod), D-novo-OXIDACAO-PRESERVADOS-DUPLA-CONTAGEM P3 (conservador), D-novo-OXIDACAO-SPECS P3. Detalhe: `docs/sessoes/2026-06-10-clube-hub-f15-fase11.md`.

> Histórico: **2026-06-10 — M29 Fase 2 Opção B Santi (3 bugs onboarding) + ajustes P3 reviewers + smoke E2E + 2 sprints enfileirados + Regra de Coerência Sistêmica inegociável**. **8 commits trabalho** (`ae982e3` carry-over wa-bot + `56b7666` Bug A propaga FALHOU+motivo no helper + `747cfbe` Bug B refreshKey externo + `2b0e9a0` Bug C expõe ucs+cotaKwhMensal + `78b7a82` C-1 where cooperativaId explícito + `3789bed` B-1 carregar async admin + `bdbdeba` débitos P3 A-1/C-2 + `2d62b09` smoke E2E reproduzível). 56/56 specs Jest verde + TSC web exit 0. Smoke E2E HTTP real validou Bug A end-to-end (login Santi → POST lote → 1 ENVIADO whitelist + 1 FALHOU `whitelist-dev`). Reviewers `cooperebr-multitenant-reviewer` + `cooperebr-financeiro-token-reviewer` aprovaram zero P0/P1/P2. **2 sprints enfileirados em memória sem código:** Sprint Clube Unificado + CooperToken **P1** (próxima sessão — prompt empacotado em `docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md`) e Sprint Hardening Mass-Write SUPER_ADMIN **P2** (rebaixado). Regra de Coerência Sistêmica catalogada inegociável global (MAPA DE IMPACTO em 5 dimensões em CADA Fase 1). Detalhe: `docs/sessoes/2026-06-10-bugs-onboarding-santi-fase-2-opcao-b.md`.

> Histórico: **2026-06-08 — M26 Sprint Token-WA Fase 1+2 completa + hardening F2.9 + F2.10 + "Qual cadastro?" multi-cadastro + reconhecimento automático na entrada**. **22 commits trabalho** em sessão Code maratona: `ccf0074` Fase 1 read-only (saldo + extrato bot) · `481cebc..9ca604c` Fase 2 completa F2.1→F2.8 (schema aditivo PIN + AparelhoVinculado + OtpDesafio + TokenTransacao rica; otp-helper; PinCooperadoService lockout 30min; LimiteTokenService; TokenNotificacaoService; smoke E2E 22/22; "Alterar limite" no WA) · `8e867a5` adendo TokenTransacao rica + diag bot · `f4d20c7` **F2.9 hardening P0** (JWT sem fallback, updateMany anti-IDOR, validarPin private, timezone São Paulo, OtpDesafio.cooperativaId) + **destrava bot WA** (webhook ?secret= + telefone Luciano E.164) · `f8b629b` **F2.10 implementa VERIFICAR_COOPERADO** (estava faltando) + opção 8 hardcoded + setup SISGD teste (490 tokens) · `de4e725` fix render `**` patológico defensivo · `dcce884` persona "P"→"Coop" · `29dd88e` acentos visitante (6 strings + 4 modelos) · `0e8c084` tenant default por env (DEFAULT_TENANT_ID) · `97b61f3` Sprint "Qual cadastro?" Fix 1 — helper compartilhado matcher · `09d5531` Fix 2 WA — escolha com anti-IDOR + TROCAR CADASTRO · `a04fd54` Fix 3+4 portal — obterContextos findMany + trocar anti-IDOR · `7d3a9ec` Fix 3 web — ContextoSwitcher chama backend · `83ef5bf` adendo reconhecimento automático na ENTRADA · `8f51f58` INICIAL global aponta pra menu_principal + gatilhos. **310+ specs Jest verde** (89 unit Fase 2 + 14 matcher + 11 WA multi + 16 portal multi + 5 tenant + 266 motor + smoke E2E 22/22). Bot WA destravado e funcional. Detalhe: `docs/sessoes/2026-06-08-token-wa-fase-1-2-qual-cadastro.md`.

> Histórico: **2026-06-07 — M25 Bloco 2 Sprint Onboarding (Empresa vê kWh dos funcionários) + Correção modelo kWh + Sprint Convite-Lote completo**. **11 commits trabalho** em 1 sessão Code maratona: `6664aed` Fatia 2.1 (helper previewKwhConsolidado fonte única) · `70bf820` Fatia 2.2 (helper rateio puro com INVARIANTE centavo) · `4a8dec3` Fatia 2.3 (endpoint kwh-consumo + LGPD mascarada + anti-IDOR 404) · `f74c3d6` Fatia 2.4 (tela consumo funcionários — Bloco 2 COMPLETO) · `5f66ab3` **FIX kWh** modelo correto (total = soma dinâmica das cotas; kwhAlocadoMensal = REFERÊNCIA da assinatura, não valor cobrado) · `0756dcb` LOTE.1 (preview CSV + 5 estados + dedup) · `8de49e0` LOTE.2+3 (envio em fila throttle 2s + schema delta loteId + status) · `e427230` **FIX kWh complemento** valorAPagar exposto no preview + tela 3 colunas corretas (Disponível × Total atual × Valor a pagar) · `635143e` LOTE.4 (tela Convidar em lote portal + admin) · `dac1907` **FIX UI crítico** tabela SEMPRE renderiza quando há membros + seed demo Clínica Teste 300/400/500 (Total 1.200 kWh / R$ 1.200,00) · `8a957bd` LOTE.5 (modo B Abrir no WhatsApp + helper wa.me reusável MLM + schema cooperadoIndicadorId). **310/310 specs convenios verdes** + smoke prova-real 14/14 (preview.valorAPagar === cobranca.valorLiquido — FONTE ÚNICA do dinheiro confirmada). ⚠️ Bug arquitetural P0 RESOLVIDO: ALOCACAO_FIXA cobrava 200k SEMPRE; agora soma cotas. ⚠️ Bug UX cega P0 RESOLVIDO: tela escondia funcionários quando total=0; agora tabela sempre presente. Sprint Convite-Lote completo 5/5 fatias com 2 modos (automático em fila + manual wa.me) + atribuição MLM preparada. Detalhe: `docs/sessoes/2026-06-07-bloco-2-kwh-convite-lote.md`.

> Histórico: **2026-06-06 — M24 Sprint Onboarding Completo do Membro — Bloco 0 (Plano de Clube) + Bloco 1 (Aprovação CONSTRÓI o membro)**. **8 commits trabalho** em 1 sessão Code maratona: `a9794a8` Fatia 0.1 (PlanoClube model + CRUD + tela admin) · `6584aec` Fatia 0.2 (planoClubeId no ContratoConvenio) · `29999c6` Fatia 0.3 (adesão opt-in `Cooperado.planoClubeId` + INVARIANTE anti-cobrança-dupla) · `34a66c8` Fatia 0.4 (componente CLUBE escalar discriminado nas 2 cobranças — Bloco 0 COMPLETO) · `d18e7f6` Fatia 1.1 (validarToken propaga `convenioId` + `permiteSemUc` com anti-spoof) · `cfc6421` Fatia 1.2 (cadastroWebV2 persiste `cotaKwhMensal` + `pendenciaMotorMsg` best-effort + `consumoStashOcr` snapshot — bug arquitetural dados perdidos fechado) · `412b2da` Fatia 1.3 (`MembroBuilderService.construirMembroCompleto` único ponto de entrada idempotente — flip status ANTES do motor + `planoId` direto + degradação graciosa) · `8e47737` Fatia 1.4 (matrícula clube config-dependente via ConfigClubeVantagens.ativo + DRY-RUN reconciliação script + fix inline `D-novo-LISTA-ESPERA-TENANT` P1 + smoke integração cobrança — Bloco 1 COMPLETO). **234/234 specs convenios verdes** + 25/25 smoke E2E Fatia 1.3 + 8/8 smoke integração 1.4 (guard `custeadoPorConvenio` bloqueia double-bill; consolidada ALOCACAO_FIXA `valorBruto=R$200000`). ⚠️ ACHADO operacional: 218 membros parciais detectados no tenant CoopereBR pelo DRY-RUN — exige SEGMENTAÇÃO (oco × SEM_UC legítimo × lista de espera × teste sintético) antes de `--apply` em massa, catalogado como tarefa P2. **LEONARDO PIZZOL VIGNA reconciliado nesta sessão** (script `--membro <id>`): status PENDENTE→ATIVO + ProgressaoClube BRONZE + pendenciaMotor "cota não capturada"; sem contrato forçado (cota perdida pré-Fatia 1.2). **4 RESOLVIDOS:** `D-novo-LISTA-ESPERA-TENANT` P1 + bug arquitetural aprovação-só-flipa + bug dados perdidos cadastro + bug contexto convite. **3 ABERTOS novos P3:** `D-novo-FATURA-SEGREGADA-ITENS` · `D-novo-CLUBE-LANCAMENTO-FISCAL` · `D-novo-CADWEB-FATURA-PROCESSADA`. Detalhe: `docs/sessoes/2026-06-06-bloco-0-1-onboarding-membro.md`.

> Histórico: **2026-06-05 tarde-noite — M23 Hardening Golden Path /cadastro?conv= e ?ref=**. **5 commits trabalho + 1 fechamento** em 1 sessão Code maratona: `9291d32` whitelist WA `+27999479097` + status honesto do envio (`WhatsappEnvioResult` com motivo propagado até UI dev, D-novo-WA-DEV-FALSE-OK RESOLVIDO) · `8ab10c8` docs fechamento M22 · `4c05aea` **D-novo-OCR-RESILIENCIA P1 RESOLVIDO** (Anthropic retornou HTTP 529 overloaded_error req `req_011Cbkg4RZ9ghXJSoLjtdD1V` 16:36 BRT; fix: retry exponencial 2s/4s/8s em 429/500/503/529 + AbortController timeout 30s + `max_tokens` 2048→8192 + classe `OcrFalhaError` com 7 motivos categorizados + UI mostra banner amber "Tentar de novo" pros recuperáveis em vez de cair em modo manual; 30 specs verdes) · `004372c` **D-novo-CADWEB-CONV-TENANT P1 RESOLVIDO** (`/cadastro-web` 400 quando vem via `?conv=` sem `?tenant=`; fix: resolve `cooperativaId` server-side via `body.token` espelhando padrão anti-spoof de `/auto-inscrever:568`; 6 specs + script `reset-otp-convite-emergencial.ts` + token correto do convite Luciano destravado: `e1bb49fea48d8cd27a4a646e236c6b1cf1c8d097a1c4eb883a88b6ef281b007b`) · `beef066` **D-novo-CADWEB-CONV-MEMBRO P1 RESOLVIDO** (smoke E2E expôs bug arquitetural: `cadastroWebV2` criava Cooperado+UC mas NÃO criava `ConvenioCooperado` nem marcava `usedAt`, convite ficava órfão reusável; fix: portado padrão de atomicidade de `/auto-inscrever:710-792` pro `cadastroWebV2` — consume-once + `adicionarMembro(CONVITE_PUBLICO)` + cross-ref `convite.membroId` dentro do mesmo `$transaction Serializable` que cria Cooperado+UC; 8 specs novos + smoke E2E programático 0 falhas em 12 passos). **44 specs verdes totais** (30 OCR + 14 cadastro-web). **4 RESOLVIDOS:** OCR-RESILIENCIA, CADWEB-CONV-TENANT, CADWEB-CONV-MEMBRO, WA-DEV-FALSE-OK. **6 ABERTOS catalogados:** D-novo-OTP-429-UX P3 (mensagem genérica no UI quando OTP estoura limite) · D-novo-OTP-DEV-RELAX P3 (rate-limit engessa smoke manual) · D-novo-AUTO-INSCREVER-DEPRECATION P3 (housekeeping pós-fix CONV-MEMBRO) · D-novo-CAD-CONSUMO-MENSAL P2 · D-novo-CONVITE-MENUS-UX P3 · D-novo-TESTS-MOCK-PRISMA P2. Detalhe: `docs/sessoes/2026-06-05-hardening-golden-path-conv-ref.md`.

> Histórico: **2026-06-05 — M22 Fatia F-G1 Circuito CooperToken + Opção A + WA honesto**. **4 commits trabalho** em 1 sessão Code: `a99a7f2` Fatia F-G1 (convite indicação web por admin com cooperado institucional fantasma `institucional+<cooperativaId>@sisgd.invalid` + skip BeneficioIndicacao/tokens via `ehInstitucional` + Opção A perfil COOPERADO único + Crédito de Energia movido pro Financeiro com gate SEM_UC CTA "Solicitar conversão → PIX") · `4690a5d` pós-F-G1 ajustes (SUPER_ADMIN seletor coop no Dialog + nome dinâmico no template WA — zero hardcode "CoopereBR", SISGD é multi-tenant + login bootstrap 2 contas) · `fc4cc24` box dev login 4 cards (SUPER_ADMIN + ADMIN — CoopereBR + COOPERADO + Empresa cooperada PJ) · `9291d32` whitelist permanente `+5527999479097` (5 variantes) + D-novo-WA-DEV-FALSE-OK RESOLVIDO (`WhatsappEnvioResult` com motivo `whitelist-dev`/`numero-protegido`/`erro-runtime` propagado até UI dev). **WA chega via convite admin web — golden path Fatia F-G1 destravado.** Opção A consolidou COOPERADO-ONLY: empresa cooperada PJ tem perfil COOPERADO; `EMPRESA_CONVENIADA` `@deprecated` (compat só pra tokens em circulação). 3 débitos novos catalogados (D-novo-CAD-CONSUMO-MENSAL P2 + D-novo-CONVITE-MENUS-UX P3 + D-novo-TESTS-MOCK-PRISMA P2) + 1 RESOLVIDO mesmo dia (D-novo-WA-DEV-FALSE-OK). Sugestões #10 (práticas Anthropic) + #11 (banco de modelos de mensagens) catalogadas em memória. Detalhe: `docs/sessoes/2026-06-05-fatia-fg1-cooper-token-ajustes.md`.

> Histórico: **2026-06-04 — M21 Sprint Multi-Frente: Portal Empresa Conveniada 9.0+9.1 + Sprint Financeiro F1 + Convergência Convite-Custeio (Fatias 1+2) + Circuito CooperToken Fatia A+B**. **11 commits trabalho** em 1 sessão Code maratona: `0d698d4` Sprint Financeiro F1 (statusEmissao separado + cron retry 30min cap 5 + endpoint reemitir + UI badges + 13 specs) · `695e574` Portal Empresa 9.0 (perfil EMPRESA_CONVENIADA + guard @PagadorCooperadoOnly anti-enumeração + 9 endpoints + seed dev + box credenciais login) · `6eaa7a6` Portal Empresa 9.1 (dashboard /conveniada/convenio/[id] reusando GestaoConvitesSection+MembrosPendentesSection source='empresa' + decidir in-portal + HelpBox em cada bloco) · `bfad278` HOTFIX BUG1 CORS+API_URL LAN (acesso por IP do celular) · `4fb9a0c` HOTFIX BUG2 decidir in-portal sem magic link (decidirAprovacaoEmpresaLogada opera direto no membroId + 9 specs) · `baf7fc1` HOTFIX diag erro detalhado em DEV no /auto-inscrever · `9f18e13` docs 7 débitos auditoria /cadastro · `badeb5f` Convergência Fatia 1 backend (DTO strict + REMOÇÃO UC-fake + helper validarENormalizarCadastro + POST cadastro/upload-doc + schema delta TipoUc/SELFIE/permiteSemUc/consentimentoDocs + 35 specs) · `0559660` Convergência Fatia 2 wizard (/cadastro?conv= + OTP gate + uploads opcionais + LGPD + doc-move backend + redirect slim 553→38 linhas + smoke E2E 9/9) · `feda124` Circuito CooperToken Fatia A+B (portal nomenclatura/help/menu + bonusIndicacao configurável + spec catalogada). **Suite total impactada 374/374 verdes** (23 suites src/publico + src/convenios + src/auth + src/common/safety). 4 débitos resolvidos estruturalmente: D-novo-CAD-UC-FALSA P1, D-novo-CAD-CONSUMO-ZERO P2, D-novo-CAD-MODO-MANUAL-NAV P3, D-novo-CONVITE-ROTA-CONSOLIDAR P3. 2 débitos novos catalogados: D-novo-PORTAL-EMPRESA-SEED-TESTE P3 + D-novo-DEV-LAN-ACCESS P3. **DESCOBERTA OPERACIONAL CRÍTICA:** frontend é `next start` sob PM2 (NÃO `next dev`) — toda mudança de frontend exige `cd web ; npm run build ; pm2 restart cooperebr-frontend`. HMR NÃO ROLA. Documentado em CLAUDE.md. Detalhe: `docs/sessoes/2026-06-04-portal-empresa-convergencia-cooper-token.md`.

> Histórico: **2026-06-03 — Sprint Convite-Convênio NÚCLEO BACKEND COMPLETO** (Fatias 1+2a+2b+2c+2c.1+3 + chore higiene build). 7 commits em 1 sessão Code maratona: **2a** (`d6a4a50`) ConviteConvenioMembro per-recipient + envio WhatsApp + feature flag CONVITE_OTP_ATIVO bloqueia caminho legado · **2b** (`29e01c0`) OTP 6 dígitos sha256+salt rotativo + crypto.timingSafeEqual + 5 tentativas (bloqueio 1h) + 3 reenvios (cooldown 60s) — WhatsApp REAL disparado pro Luciano · **2c** (`4c3ee0a`) /auto-inscrever refatorado pra exigir `token`+`otp validado` (janela 30min) + tenant resolvido DO CONVITE (anti-spoof) + consume-once via update where `usedAt:null` · **2c.1** (`e4c7348`) hardening atomicidade — Cooperado+Membro+magic link+consume-once em `$transaction Serializable` única + removido helper `rollbackConviteUsedAt` + `cooperado.delete .catch` compensatório · **chore** (`7b14287`) tsconfig.build+`.gitignore` ignoram `tmp_*.ts`+`*smoke*.ts` (anti build-poison) · **3** (`c432cb8`) aprovação 3 portas — empresa magic link (POST /publico/aprovacao-membro/:token + ip+ua audit) + admin dashboard (5 endpoints aprovar/solicitar-doc/rejeitar/reenviar/cleanup) + state machine 4 estados (PENDENTE_APROVACAO_EMPRESA → PENDENTE_APROVACAO_ADMIN → MEMBRO_ATIVO; REJEITADO_*/DESLIGADO terminais) + GUARD strict admin NÃO PULA empresa. Schema: 1 model NOVO (ConviteConvenioMembro 20 cols) + 3 colunas em ConvenioCooperado (documentacaoSolicitadaEm + aprovadoPorAdminUserId + rejeitadoPorAdminUserId rel Usuario). 215 membros + 3 convênios vivos preservados. **187/187 specs convenios verdes** (85 novos no sprint, zero regressão). 5 smokes vivos rodados (3 com WhatsApp REAL no Luciano `5527981341348`). Estado: **backend do sprint = 100% funcional**, núcleo seguro atômico fechado, frontend ZERO (Fatias 4-5 próximas), notif WA/email rich pendente (Fatia 6), portal self-service empresa = Fatia 9 futura. Detalhe: `docs/sessoes/2026-06-03-sprint-convite-convenio-nucleo-backend.md`.

> Histórico: **2026-06-02 noite tarde — Finalização Convênio Médico (Pontos 1+2a) + HOTFIX build + D-FISCAL-2 FECHADO + Sprint Convite-Convênio Fatia 1**. 7 commits trabalho em 1 sessão Code maratona pós-M20: **Ponto 1** (`cfb4208`) modo teste libera fatura no cadastro + preserva vínculo convênio sem UC · **Ponto 2a** (`3665099`) tarifa fixa R$/kWh negociada com a empresa (enum `TipoTarifaEmpresa` + `tarifaFixaKwhEmpresa`) · **HOTFIX** root-cause do 400 PATCH = `src/agents` untracked com 15 erros TS quebrava build há 3 dias → dist velho rejeitando campos novos. Fix: excluir `src/agents` do `tsconfig.build.json`. **LIÇÃO: "build passou" mentia — sempre verificar dist.** · **D-FISCAL-2.5** (`2666412`) `/dashboard/contabilidade/convenios` virou lente fiscal read-only sobre ContratoConvenio legado + aposentou CRUD CT (deprecated + WARN) + deletou Convenio CT órfão "teste" · **D-FISCAL-2.6** (`13eb1d7`) corrigiu exemplo Hangar no relatório conformidade 31/05 · **Débitos** (`37fa529`) catalogados 3 novos pós-investigação 6 sub-agentes: D-novo-SEC-AUTOINSCRICAO-CUSTEADA P1 (vetor fraude link público) + D-novo-PORTAL-CUSTEADO P2 + D-novo-CONVITE-CONVENIO P1 reframe · **Sprint Convite-Convênio Fatia 1** (`12bff1e`) schema delta aditivo: enum `StatusMembroConvenio` +4 valores (PENDENTE_APROVACAO_EMPRESA/ADMIN + REJEITADO_*) + enum `AdmissionOrigem` (ADMIN_MANUAL/CSV/CONVITE_PUBLICO) + 6 campos novos em `ConvenioCooperado` + 2 quotas em `ContratoConvenio` (`limiteMembros` + `kwhAlocadoMaxMensal`) + model novo `AprovacaoConvenioMembro` (magic link da empresa). **3 convênios + 215 membros intactos** (defaults preservam tudo). **Decisões travadas:** auth aprovação empresa = HÍBRIDO (magic link no núcleo + login portal como camada, mesmo endpoint); SEM_UC rejeitado = fica PENDENTE pro admin; invite = STATELESS `?conv=`; rate-limit 3/h CPF + 30-60/h IP. **Estado:** convênio médico USÁVEL pelo admin ponta-a-ponta (cadastro modo teste + tarifa fixa/% + consolidada + lente fiscal). Convite com aprovação dupla = sprint em andamento (Fatia 1/8 feita). Smoke E2E real Caso 1 ainda pendente Luciano. **IDEIA NOVA (Luciano):** Fatia 9 = portal self-service da empresa conveniada (gera + envia convite via WA/email + aprova pendentes na própria tela) — depende de provisionar login portal pra empresa. Detalhe: `docs/sessoes/2026-06-02-convenio-medico-finalizacao-e-convite-fase1.md`.

> Histórico: **2026-06-02 noite — M20 Sprint D-FISCAL-2.4 Caso 1 custeio 100% completa**. 8 commits trabalho (`80d3e75` 2.4.4a → `74858bb` 2.4.4a.1 → `f593917` 2.4.4a.2 → `b2e0cad` 2.4.4b → `3fa9a34` 2.4.4c → `9a201cb` 2.4.4d → `a135934` 2.4.4e → `14d0948` 2.4.4f) + 1 commit fechamento em 1 sessão Code maratona. Entregue **CASO 1 ponta-a-ponta** (empresa cooperada paga total): **2.4.4a** motor consolidado + UC sintética `CONSOLIDADOR-*` + plano técnico "Consolidador de Custeio" + helper compartilhado `tarifa-helper.ts` · **2.4.4a.1** UC própria da empresa COM_UC entra no total (dedup defensivo Map<ucId>) · **2.4.4a.2** invariante custeado⟺consolidado eliminando double-bill matematicamente (filtro `plano.custeadoPorConvenio=true`) · **2.4.4b** cron mensal `@AsPlatform()` mês fechado + endpoints REST + emissão Asaas com guard `isAmbienteReal()` · **2.4.4c** hook `darBaixa` roteia consolidada paga pro `criarLancamentoConvenioContrato` (natureza convênio AUXILIAR/PRÓPRIO configurável) · **2.4.4d** tela admin `/dashboard/convenios/[id]/cobrancas-consolidadas` + estorno gate apuração FECHADA + HelpBox · **2.4.4e** UI config no form do convênio (pagador/base/desconto/kwhAlocado) + validação service-level · **2.4.4f** ALOCACAO_FIXA gera sem membros + 3 banners feedback claro (CRIADA verde / JA_EXISTE azul / SEM_MEMBROS amber). **200/200 specs verde** convenios + cobrancas + planos + motor-proposta · `lint:tenant` zero novos · zero regressão · 2 débitos P3 catalogados (Dialog backdrop blur + tarifa-fallback). CV-2026-0001 "Clinica teste" ALOCACAO_FIXA 200000 kWh × 20% desconto **PRONTA pra Luciano fazer smoke E2E real** (R$ 126.289,60 esperado). **Próximo Code: 3 caminhos** — (1) smoke E2E real CV-2026-0001 OU (2) D-FISCAL-2.5 (aposentar `/contabilidade/convenios` + migrar CT) OU (3) D-FISCAL-2.6 (corrigir relatório 31/05 Hangar errado). Detalhe: `docs/sessoes/2026-06-02-dfiscal-244-caso1-completo.md`.

> Histórico: **2026-06-01 noite tarde — M19 D-FISCAL-2.4.2 + 2.4.3 (Caso 1 custeio: plano + guards + selector + vínculo)**. 2 commits trabalho (`e265e63` D-FISCAL-2.4.2 → `07ae417` D-FISCAL-2.4.3) + 1 commit fechamento. Entregue **estrutura completa do Caso 1** (empresa cooperada paga total): **2.4.2** plano global "Custeado por convênio" via seed idempotente em `PlanosService.onModuleInit` + 3 guards bloqueando geração de cobrança individual nos 3 caminhos (Path A `gerarCobrancaPosFatura`, Path B `aprovarFatura` for-loop, manual `cobrancas.create`) · **2.4.3** selector de empresa no cadastro **admin** (toggle Step3 + select nativo) e **público** (radio renderStep3 + select nativo) + endpoint público `/publico/convenios-pagador-empresa?tenant=` minimalista + integração no `motor-proposta.aceitar` (valida convênio ANTES da tx + override planoId + vínculo `ConvenioCooperado` na MESMA transação serializável) + ajuste `adicionarMembro` aceitando `tx` opcional (pula MLM side effects no Caso 1). **Sem schema delta** (descoberta Fase 1: público aceita no mesmo request, `convenioCusteioId` viaja em memória). Zero migração. 141/141 specs verde. Detalhe: `docs/sessoes/2026-06-01-dfiscal-242-243-custeio-convenio.md`.

> Histórico: **2026-06-01 noite — Arco Contabilidade + Convênios (CT.7→CT.9.1) + Decisões fiscais estruturais (D-FISCAL-1/2/MLM)**. 5 commits trabalho (`12ca409` CT.7 → `4cf71d2` PUX-A → `d086550` CT.8 → `61bbc7e` CT.9 → `d953381` CT.9.1) + 1 commit fechamento em 1 sessão Code. Entregue: **CT.7** PDFs autenticados via blob + apuração estado consciente · **PUX-A** Convênio página própria + `<HelpBox>` reusável · **CT.8** classificação inline Tipo A do Plano de Contas Segregado, multi-tipo (enforcement P0-1) · **CT.9** botão "Registrar movimento" no convênio → `LancamentoCaixa` Auxiliar Art. 88 síncrono · **CT.9.1** bugfix timezone competência + estorno do movimento + sweep "Walter" 8 arquivos código. 284 specs verdes mantidos · zero regressão · zero `--accept-data-loss`. **Decisão UX esclarecida 01/06** (refina 31/05): Dialog OK pra ações simples (confirmar/estornar/aprovar/remover); página própria SÓ pra cadastro/edição de entidade; HelpBox obrigatório. **3 decisões fiscais estruturais** catalogadas como débitos (D-FISCAL-1 classificação configurável do convênio CT / D-FISCAL-2 consolidação convênio único / D-FISCAL-MLM Hangar≠Art.88) + correção relatório 2026-05-31. Detalhe: `docs/sessoes/2026-06-01-contabilidade-convenios.md`.

> Histórico: **2026-05-31 noite — Sprint Contabilidade Tributária ESTRUTURA COMPLETA (CT.1-CT.6) + Sprint Polimento UX catalogado**. **7 commits** (`5ada766` CT.1 → `f95bbef` CT.2 → `b3cba3c` CT.3 → `27df9e5` CT.4 → `95eb755` CT.5 → `6a2324e` CT.6 → `93f38da` Estorno repasse) em **1 sessão Code maratona**. Estrutura técnica 100% pronta: schema multi-regime cooperativo (Arts. 79/86/88 Lei 5.764/71) + classificação determinística por fonte upstream (ALUGUEL=NAO_COOP / CESSAO/PROPRIA=PROPRIO / COBRANCA por tipoCooperado / CONVENIO=AUXILIAR) + 3 hooks fire-and-forget (Cobranca/ContaAPagar/Repasse) idempotentes via `@@unique` + motor apuração mensal com snapshot imutável `ApuracaoMensalSegregada` + gate de validação fiscal (`validadoContador=false` em todo snapshot) + `ConfiguracaoTributaria` por cooperativa (zero hardcoded — alíquotas/presunção ajustáveis sem refator) + 4 DREs (Geral/Próprio/Auxiliar/Não-Coop, terminologia NBC ITG 2004) + 3 PDFs defensáveis com watermark "PENDENTE VALIDAÇÃO" + 4 telas Next.js. **284 specs verdes** (89 novos, 195 anteriores preservados). Fatia extra `93f38da` resolveu gap real do smoke Luciano (repasse PAGO sem estorno + sem visibilidade do ciclo) — backend pronto, frontend Dialog vira refator PUX.4. **Decisão UX vigente 31/05 (revisada 01/06):** Dialog OK pra ação simples; página própria pra cadastro/edição. **Sprint Polimento UX catalogado** (PUX.1→PUX.6, ~25-37h, próximo Code). **Gate de validação fiscal (contabilidade) bloqueia produção fiscal real** — D-novo-CT-VALIDACAO-FISCAL P0. Detalhe: `docs/sessoes/2026-05-31-sprint-contabilidade-tributaria-completo.md`.

> Histórico: **2026-05-31 — Sprint Blindagem Multi-Tenant (D-novo-BR) COMPLETO** — 8 commits em 1 sessão Code maratona. **68/68 IDORs do sistema corrigidos** em 6 fatias atômicas (F0 + F1.1+F1.2+F1.3+F1.4+F1.5). **4 camadas de defesa em profundidade** ativas: fix manual + Guard sistêmico opt-in `@TenantResource` + Extension Prisma log-only `tenantLeakDetector` + Lint anti-reincidência baseline+ratchet (`npm run lint:tenant`, 256 legados allowlist). **164 specs IDOR+Guard verdes** + 6 smokes runtime cross-tenant (91 cenários validados). EmailLog ganhou coluna `cooperativaId` via ritual PM2. M8 fallback ENV removido (vazava credencial IMAP entre tenants). F2 (Prisma Extension de INJEÇÃO) fica OPCIONAL — Guard+lint+log já cobrem detecção pre-merge + runtime. Detalhe: `docs/sessoes/2026-05-31-sprint-blindagem-multi-tenant-completo.md`.

> Histórico: **2026-05-31 — Sprint Blindagem Multi-Tenant Fase 0 (D-novo-BR F0)** — 3 commits em 1 sessão Code. **26 IDORs corrigidos** em 5 sub-fatias atômicas (F0.1-F0.5) — 19 Onda A + 7 críticos Onda B usando padrão D-novo-BQ. Auditorias expandidas (Dynamic Workflow Ondas A+B = 50 IDORs adicionais) catalogadas. Decisão arquitetural híbrida em 5 fases (F0 ✅ esta / F1 AsyncLocalStorage / F2 Prisma Extension / F3 residuais / F4 testes) em `docs/arquitetura/blindagem-multi-tenant-sistemica.md`. **55 specs F0 verdes + 111 IDOR total verdes** (56 BQ + 55 BR F0). **23 cenários runtime cross-tenant** validados em smoke programático. 4 padrões consolidados (posse direta, via-relação, body→JWT, global-only-SA). Detalhe: `docs/sessoes/2026-05-31-sprint-blindagem-multi-tenant-fase0.md`.

> Histórico: **2026-05-30 — Sprint Segurança IDOR (D-novo-BQ) COMPLETO** (5 commits `3e23f81..d17ac3f` em 1 sessão Code maratona). **18 IDORs corrigidos** (7 críticos + 8 altos + 3 médios) em 4 fatias atômicas (BQ.1+BQ.2+BQ.3+BQ.4). Padrão de fix mecânico (posse `findFirst` + SUPER_ADMIN bypass). Auditoria gerada por **Audit Dynamic Workflow** — primeiro uso no projeto (28 sub-agentes paralelos Opus 4.8, 4 min, 1.437.072 tokens, relatório `docs/relatorios/2026-05-30-auditoria-idor-workflow.md`). **56 specs isolamento verdes** + **35 cenários runtime cross-tenant validados em 3 smokes programáticos**. Pré-requisito Sinergia (2º parceiro real) destravado nos módulos núcleo. Detalhe: `docs/sessoes/2026-05-30-sprint-seguranca-idor-completo.md`.

> Histórico: **2026-05-30 — Sprint D-novo-AN (RepasseProprietario) COMPLETO** (5 commits `37f7af0..2f6fb29` em 1 sessão Code dia inteiro). 5 fatias canônicas (AN.1 schema + service workflow / AN.2 endpoints REST + cron transação atômica / AN.3 telas admin + portal refator + sidebar + cards cruzados / AN.3.1 fix painel credenciais + trigger + investigação parceiro / AN.4 fix cards parceiro + backfill + notificação + PDF). **36/36 specs verdes** (21 service + 10 controller + 5 notificação) + 3 smokes programáticos. 4 RepasseProprietario PENDENTE no banco (1 trigger + 3 backfill). **D-novo-BM reparo funcional** inline AN.3.1 (TTL 1h→8h + interceptor allowlist). **D-novo-BP catalogado** (convergência `/parceiro` vs `/dashboard`, P3 sprint refator UX futuro). Sprint AN substitui+complementa BH.5 — workflow PENDENTE→PAGO/CANCELADO com transação atômica vinculando despesas DESCONTO_NO_REPASSE. Detalhe: `docs/sessoes/2026-05-30-sub-sprint-an-repasse-proprietario-completo.md`.

> Histórico: **2026-05-30 — Sprint D-novo-BH (Despesas Operacionais Camada 2) COMPLETO** (10 commits bb838ec..77eeb24 em 2 sessões 28-29/05 + 29-30/05, M37→M41 + 3 bugs/débitos bônus). 7 fatias canônicas (BH.1 workflow + BH.2 endpoints + BH.3 tela admin + BH.3.1 refator UX página própria + BH.3.2 double-check universal + BH.4 portal proprietário + flag + BH.5 cálculo líquido + cron aluguel) + **D-novo-BL ✅ RESOLVIDO inline** (Super Admin bypass) + **D-novo-BN ✅ RESOLVIDO** (ChunkLoadError Turbopack `03f49fc`) + **D-novo-BM ✅ IMPLEMENTADO P0 BLOQUEADOR REMOÇÃO PRÉ-PROD** (painel credenciais teste Opção B `1cdb9cb`). **55 specs Jest verdes** + 3 smokes programáticos **24/24 ✅** + build web Turbopack clean 4 ciclos. Substitui o fechamento parcial `c0542fc` de 29/05. Lição arquitetural catalogada (`D-novo-AS` complemento): `npm run build` web SEMPRE seguido de `pm2 restart frontend` IMEDIATO. Próximo bloco aprovado: **D-novo-AN RepasseProprietario tabela** (terreno preparado por BH.5 — campo `ContaAPagar.repasseAbatidoId` nullable pronto). Detalhe: `docs/sessoes/2026-05-30-sub-sprint-bh-despesas-camada-2-completo.md`.

> Histórico: **2026-05-29 noite — Sub-Sprint BH FECHAMENTO PARCIAL (`c0542fc`, obsoleto)** — substituído pelo fechamento completo de 30/05.

> Histórico: **2026-05-26 noite — M31 Sub-Sprint F Sessão 2 (F.3 Onboarding magic link + cadastro manual)**. 5 commits incrementais (`34719bd` Etapa A ConviteProprietarioService + 31 specs → `6a845f1` Etapas B+C+D endpoints admin + público + email template → `2eb822b` Etapa E frontend admin Card "Acesso do Proprietário" com 2 dialogs Shadcn → `3ba6655` Etapa F frontend público /proprietario/aceitar-convite/[token] com indicador força senha → commit fechamento). **Backend completo + Frontend admin + Frontend público funcionando.** 2 caminhos coexistem: cadastro manual (admin cria Usuario direto, copia senhaTemp pra clipboard) + magic link (admin envia email, proprietário define própria senha). Token crypto.randomBytes 64 hex TTL 7d single-use. Multi-tenant em 100% queries. LGPD: token nunca retornado integral em listagem (tokenSufixo). Senha forte 8+ chars + letra + número. Email template inline (sem Handlebars) reusa EmailService.enviarEmail tenant-aware + whitelist dev. **Suite completa: 917/928 passing** (+31 specs M31 vs M30). nest build + tsc limpos. **F.4 PENDE Luciano operacional**: preencher cooperebr1 (proprietarioEmail GATILHO + formaPagamentoDono + valor + matriz responsabilidade + statusOperacional + valorKwhPadrao OU TarifaConcessionaria EDP_ES) + cadastrar Usuario E-Solares via UI admin OU magic link. Quando feito, F.4 vira sessão curta ~1-2h. Detalhe: `docs/sessoes/2026-05-26-m31-sub-sprint-f-onboarding-magic-link.md`.

---

## ONDE PARAMOS — 2026-07-01 (3ª passagem — Frente Jornada do Cooperado: unificação de visibilidade, aguarda re-review)

**Frente Jornada entregue em 4 commits limpos** (2f8bfdd + 4967e8c + 153b412 + 3051e1f) push
OK — aguarda re-review do Luciano antes de considerar mergeado (regra do prompt).
- **Fase 1 read-only** confirmou que 3 das 4 peças já existiam no schema (StatusCooperado
  rico, ListaEspera, EnvioListaConcessionaria/EnvioListaCooperado); faltava (a) o campo de
  origem e (b) juntar tudo na tela do cooperado. Escopo contido: unificação, não construção.
- **Schema** (2f8bfdd): novo enum `CanalCadastro { CADASTRO_PUBLICO, CADASTRO_SEM_UC,
  ADMIN_MANUAL, INDICACAO }` + `Cooperado.canalCadastro CanalCadastro?` nullable (preserva
  100% do histórico). Aplicado via `prisma db push` com backend parado.
- **Writers** (2f8bfdd): 8 pontos gravam o canal. `publico.controller.cadastroWebV2 →
  CADASTRO_PUBLICO`; `cadastroSemUc → CADASTRO_SEM_UC`; `autoInscrever (convite) → INDICACAO`;
  `cooperados.controller POST /cooperados + cadastroCompleto → ADMIN_MANUAL`;
  `preCadastroProxy → INDICACAO`; `lead-expansao converter → ADMIN_MANUAL`; `convenios
  cooperadoSemUc → ADMIN_MANUAL`. Institucional e whatsapp mantêm null (intencional).
- **findOne** (4967e8c): amplia include com `listaEspera(AGUARDANDO)` + `enviosLista(3
  últimos, com envio-mãe)`. `findAll` ganha counts binários `temListaEspera` + `temEnvioListaAndamento`
  pros ícones da lista.
- **Specs** (4967e8c): 3 novos cobrindo findOne include + multi-tenant preservado +
  canalCadastro no create. Suite `src/cooperados/` + `src/lead-expansao/` + `src/publico/` +
  `src/convenios/` **518/518 verde** (era 501/518 com regressões pré-existentes de sprints
  M31/M45/M48 sem cobertura). **3 caronas informais** fechadas (stub RoteamentoCadastroService
  + providers acumulados no service.spec/controller.spec + findFirst delegando findUnique
  no guard-ativacao). Zero regressão real.
- **Smoke E2E** (153b412): assertion nova no `smoke-funil-frente2.mjs` valida
  `canalCadastro=CADASTRO_PUBLICO` via HTTP real. **Run 01/07 7/7 verde**.
- **Frontend** (3051e1f):
  - **Detalhe `/dashboard/cooperados/[id]`**: card "Jornada do Cooperado" novo no topo do bloco
    geral com 4 linhas condicionais: ① Origem (badge canalCadastro; null → 📜 Histórico);
    ② Timeline visual (7 marcos linear StatusCooperado; terminais caem em badge fallback);
    ③ Fila (só se listaEspera[0] existir — Posição #N + kWh + link); ④ Lista concess. (só se
    enviosLista[] existir — cada linha com número + statusIndividual + status envio-mãe + link
    pro envio).
  - **Lista `/dashboard/cooperados`**: ícones inline ⏳ (fila) + 📋 (envio andando) ao lado
    do badge de roteamento M48. Novo dropdown "Filtrar por origem" ao lado do filtro de
    status (padrão UX select nativo 19/05). filtroCanal client-side.
- **Verificação**: TSC backend limpo nos meus arquivos; TSC web exit 0; rebuild backend +
  rebuild frontend + `prisma db push` + `pm2 restart` nos dois; smoke E2E 7/7.
- **Débitos**: nenhum novo formal. 3 caronas informais fechadas.
- **Próximo passo**: **re-review Luciano** obrigatório (padrão do prompt); depois smoke visual
  manual das UIs; depois escolha entre as 3 alternativas abertas na FRASE DE RETOMADA do M52b.
- Detalhe: `docs/sessoes/2026-07-01-jornada-cooperado.md`.

---

## ONDE PARAMOS — 2026-07-01 (2ª passagem — Frente 2 EXTENSÃO: B5 consumoStashOcr + C6 fix converter multi-tenant SUPER_ADMIN + C7 botão Converter + smoke E2E funil)

**Frente 2 fechada ponta a ponta em 4 commits limpos** após o Luciano estender o escopo da mesma
sessão do dia (FIX A + FIX B pela manhã na 1ª passagem foram entregues antes; o prompt novo
adicionou B5 + C6 + C7 + smoke E2E).
- **B5** (`b80cd8f`): card "Dados extraídos da fatura no cadastro (OCR)" no detalhe do cooperado.
  Expõe `Cooperado.consumoStashOcr` que existia no banco desde 06/06 (Bloco 1 Fatia 1.2) mas
  NÃO aparecia em NENHUMA tela (confirmado por grep). Renderiza cada chave do JSON como Campo,
  com formatação leve. Zero backend (findUnique já retornava). Zero schema delta.
- **C6** (`c31d4eb`): fix backend obrigatório do converter LeadExpansao → Cooperado. Bug latente
  M48: SUPER_ADMIN normalmente não tem cooperativaId no JWT (é de plataforma), então o guard
  antigo bloqueava até o dono do SISGD. Refactor: SUPER_ADMIN exige `cooperativaIdAlvo` no body
  validado via `Cooperativa.findUnique(ativo:true)` (padrão anti-spoof M45) + passa
  `permitirAdotarLeadOrfao=true` pro service. ADMIN/OPERADOR: mantém JWT + destructure-discard
  do body. Service: `findFirst` com OR `[{cooperativaId:null},{cooperativaId:alvo}]` aceita
  órfão OU já-no-tenant; bloqueia cross-tenant ativo. Update do lead: quando adoção real
  (`lead.cooperativaId===null`), where só por id + data grava cooperativaId. **14 specs novos**
  (controller: SUPER_ADMIN happy/erro/anti-spoof + ADMIN destructure; service: adoção órfão +
  bloqueio cross-tenant + retrocompat). Suite `src/lead-expansao/` 23/23 verde (era 9/9).
- **C7** (`a6cb7ba`): botão "Converter" no `/dashboard/relatorios/expansao`. Duas colunas novas
  (Status: AGUARDANDO/NOTIFICADO/CONVERTIDO badge + Ações: botão). Dialog de conversão com form
  obrigatório (nome/CPF/email) + telefone opcional (prefill do lead) + seletor de parceiro
  condicional (só aparece pra SUPER_ADMIN; obrigatório quando lead é órfão, opcional quando já
  tem tenant). SUPER_ADMIN carrega `GET /cooperativas` no mount. Após POST OK, marca CONVERTIDO
  local.
- **Smoke E2E do funil** (`b5db215`): script `backend/scripts/smoke-funil-frente2.mjs`
  reproduzível. Executa POST HTTP real no `/publico/cadastro-web?tenant=` com payload carregado
  (temCreditosInjetados + jaRecebeCreditosGd + fornecedorGdAtual + dadosOcr) e verifica 6
  invariantes no banco. **Run 01/07 6/6 verde**: motor classificou "Cooperativa Solar Verde"
  como A_MIGRACAO com razão _"Fornecedor não bate com nenhum parceiro SISGD — concorrente fora
  da plataforma. Considerar fluxo de migração (M47)."_ Notificação admin disparou fire-and-forget
  (regra 14/05: ADMIN_WHATSAPP_NUMBER default = número do Luciano).
- **Decisões de produto travadas** pelo Luciano no prompt: A_MIGRACAO/AMBIGUO_ADMIN fica DENTRO
  do tenant capturador (NÃO alimenta LeadExpansao cross-tenant; fluxos separados propositalmente).
  Botão Converter entra na fatia (não fica pra depois).
- **Verificação**: TSC backend limpo nos meus arquivos; TSC web exit 0; rebuild backend +
  rebuild frontend + pm2 restart nos dois; smoke programático 6/6.
- **Ajustes pós-review multitenant-reviewer** (`29ce545`) — 2 achados reais fechados como
  carona do C6:
  - **P1** service.converter: findFirst + create + update movidos pra DENTRO da `$transaction`
    Serializable (padrão `SERIALIZABLE_TX` de contratos.service.ts:11). Fecha corrida "2
    SUPER_ADMINs adotam MESMO lead órfão pra tenants diferentes ao mesmo tempo". Nova classe
    `LeadAdocaoConcorrenteError` + retry 1x + reconhecedor de conflito 40001 (herdado de
    publico.controller.ts:926). Controller mapeia pra 409 com msg humana.
  - **P2** controller.converter: `@AuditLog` ganha `cooperativaIdSource: 'body:cooperativaIdAlvo'`
    (mecanismo D-novo-AUDITLOG-TENANT-ALVO-SA existe desde M51 23/06). SUPER_ADMIN
    convertendo lead antes gravava AuditLog cooperativaId=null (JWT sem tenant); agora usa o
    body validado quando JWT vazio. Defense-in-depth preservada (interceptor consulta source
    SÓ quando JWT vazio; ADMIN não pula tenant via body).
  - Suite `src/lead-expansao/` 28/28 verde (era 23/23; +5 novos: isolationLevel Serializable
    no tx opts, retry 1x sucesso, retry esgotado → LeadAdocaoConcorrenteError, erro
    não-serialization propaga sem retry, controller propagação → 409). Smoke E2E funil
    re-rodado 6/6 verde.
- **Débitos**: nenhum novo formal. Nenhum débito formal resolvido (bugs latentes sem catalogação).
- **Próximo passo**: smoke visual manual (opcional — programático já cobriu). 3 alternativas
  abertas da FRASE DE RETOMADA do M52b: 3 portas de config / vitrines COMPLETAS Camadas 2/3 /
  M52c escrituração retro.
- Detalhe: `docs/sessoes/2026-07-01-frente2-bloco-b5-c-pipeline-captacao.md`.

---

## ONDE PARAMOS — 2026-07-01 (Code — Frente 2 Vitrines Mínimas do Funil FECHADA: FIX A elo OCR→captação + FIX B badges roteamento + filtro status)

**Frente 2 entregue em 2 commits limpos** após o ritual canônico de retomada (incluindo
fechamento retroativo do commit órfão 28/06 fix OCR).
- **FIX A** (`d343666`) elo OCR→captação: web/app/cadastro tela especial "Sua conta já tem
  energia solar!" agora coleta "Quem fornece sua energia hoje?" + payload manda
  `jaRecebeCreditosGd=true` + `fornecedorGdAtual`; backend/publico.controller captura retorno
  de `cadastroWebV2` e dispara `notificarAdminRoteamentoCaptacao` fire-and-forget quando
  `roteamento.caminho === 'A_MIGRACAO' || 'AMBIGUO_ADMIN'` (antes o motor gravava metadata
  mas admin NUNCA era avisado). Nova função com mensagens contextuais (🎯 lead de captação
  / ❓ cadastro ambíguo). Função legada `notificarAdminCreditosInjetados` mantida intacta.
- **FIX A specs** (6/6 verde) — `publico.controller.roteamento-captacao.spec.ts`. Suite
  `src/publico/` 67/67 verde (carona: 4 regressões PRÉ-EXISTENTES do Sprint M48 22/06
  latentes fechadas — mock stub `roteamentoCadastroService` + 4 assertions atualizadas
  pro 3º arg `roteamento`).
- **FIX B** (`4c16ef8`) vitrines: `CooperadoLista` + `CooperadoCompleto` ganham
  `roteamentoCaminho?/roteamentoRazao?`; nova constante `ROTEAMENTO_CONFIG` (A_MIGRACAO 🎯
  verde "Lead de captação" / B_REDIRECT_PARCEIRO ↪️ azul "Outro parceiro SISGD" /
  AMBIGUO_ADMIN ❓ amarelo "Revisar"; C_NOVO SEM badge — evita ruído). Badge inline na lista
  (TableCell do nome, ao lado de SEM_UC/Cadastro incompleto) + badge no header do detalhe
  (linha 1085). Filtro por status client-side com `<select>` nativo (padrão memória
  `solucao_select_nativo_dentro_dialog_19_05`) — 12 opções cobrindo enum operacional.
- **Verificação**: TSC backend limpo nos meus arquivos; TSC web exit 0; rebuild backend +
  `pm2 start` + rebuild web + `pm2 restart cooperebr-frontend`; smoke visual pendente do
  Luciano (login + testar UI).
- **Débitos**: nenhum novo formal. Carona informal — 4 regressões M48 sem cobertura.
- **Escopo contido explícito** (marcado no prompt): NÃO fizemos dashboard agregado, coluna
  contagem docs, Camada 3 completa (marketplace/vitrine pública) nem ConviteConvenioMembro.
- **Próximo passo recomendado**: rodar o **teste integral E2E do funil pelas páginas**
  (frente #1 da FRASE DE RETOMADA do M52b), agora com as vitrines novas como observatório
  visual. Alternativas abertas: 3 portas de config / Camadas 2/3 completas / M52c retro.
- Detalhe: `docs/sessoes/2026-07-01-frente2-vitrines-minimas.md`.

---

## ONDE PARAMOS — 2026-06-28 (Code — fix OCR modelo Anthropic aposentado, bug descoberto em E2E do funil)

**Fix cirúrgico, push direto no main.** Doc-sessão retroativa criada em 2026-07-01 no ritual de retomada.
- **Bug:** `faturas.service.ts` chumbava `claude-sonnet-4-20250514` (modelo aposentado pela Anthropic) →
  API `404 not_found` → toda fatura falhava no cadastro público + pipeline IMAP → fallback manual
  silencioso (sem sinal de erro pra ninguém).
- **Descoberto pelo orquestrador** ao rodar teste E2E do funil (frente recomendada da FRASE DE
  RETOMADA do M52b — `docs/relatorios/2026-06-23-investigacao-funil-captacao-roteador-m48.md` §7).
- **Fix:** `CLAUDE_MODEL = process.env.OCR_MODEL || 'claude-sonnet-4-6'` (espelha `COOPEREAI_MODEL`,
  evita re-quebrar na próxima aposentadoria). 4 scripts concierge idem. `.env.example` documenta `OCR_MODEL`.
- **Verificado E2E** com `edp-luciano-gd.pdf` (nome/cpf/uc/distribuidora/consumo/histórico/temCreditosInjetados=true ✅).
- **Commit:** `443ea09 fix(ocr): modelo Anthropic configuravel + atual (claude-sonnet-4-6)`.
- **Débitos:** nenhum novo, nenhum resolvido formalmente (bug latente sem catalogação prévia).
- **Ritual:** violação leve da regra inegociável bilateral 13/05/2026 — commit no main sem doc-sessão
  correspondente. Fechamento retroativo aplicado em 2026-07-01. Regra reforçada: todo commit push-ado
  no main precisa de doc-sessão, mesmo em fixes pequenos.
- **Próximo passo:** ESCOLHA do Luciano entre as 4 frentes da FRASE DE RETOMADA do M52b — inalterada.
- Detalhe: `docs/sessoes/2026-06-28-fix-ocr-modelo-anthropic.md`.

---

## ONDE PARAMOS — 2026-06-24 (Orquestrador — M52b Faxina Contábil melt Bloco F + resíduo R$858 parcial — merge na main + apply verificado no banco)

**Marco M52b entregue.** Merge `0b58a74` (branch `feature/faxina-contabil-m52b-melt`, 5 commits). Padrão
maker(Code)→4 reviewers→orquestrador (re-review independente no código + queries próprias no banco fatia a fatia).
- **Melt (Bloco F):** 3 métodos `lancarMeltOxidacao/TaxaQR/SpreadResgate` (D Passivo 2.3.01 / C Receita
  1.2.10/11/12), gate dual (`MELT_PRODUCAO_LIBERADA` + `ConfigCooperToken.meltAtivado`) controlando a
  **COBRANÇA** (não só o registro). **Gate OFF = no-op + mata o leak do QR 1%.** Construído e DESLIGADO
  (Luciano liga a % quando decidir cobrar — decisão de negócio, não legal).
- **Apply VERIFICADO:** R$ 116,55 escriturado (LUCIANO R$ 22,05 + AMAGES R$ 94,50, D 5.1.03 / C 2.3.01,
  idempotente). Passivo contábil R$ 93,10 → **R$ 209,65**; resíduo R$ 858,34 → **R$ 741,79** (= baseline).
  Orquestrador conferiu no banco com query própria derivada do zero: **bate 100%**.
- **Decisão Luciano (23/06, 2ª vez): contador + advogado RESOLVIDOS e FAVORÁVEIS** → classificação DESPESA
  5.1.03 aceita, apply liberado. Registrado em `docs/conformidade/parecer-walter-passivo-pre-m50-RESOLVIDO.md`.
- **Reviewers 4/4** + 12 fixes (F1-F12). Re-review orquestrador confirmou os sensíveis: F1 (idempotencyFallback
  checa AMBAS pernas D+C, half-write THROW), F2 (cron usa `origemTipo` enum + warn `NAO_CLASSIFICADO`, sem
  silent-drop), F4 (recibo grava taxa/líquido EFETIVOS pós-gate).
- **Débitos:** `D-novo-FAXINA-CONTABIL-LEDGER-ALIGN` resolvido PARCIAL (R$ 116,55); `D-novo-FAXINA-PASSIVO-
  PRE-M50` **P2** (R$ 741,79 histórico → sprint escrituração retrospectiva M52c+, tarefa de CÓDIGO não legal);
  `D-novo-FAXINA-NATUREZA-RETROATIVA` **P3**.
- **Próximo:** Luciano escolhe a frente (ver FRASE DE RETOMADA). Detalhe:
  `docs/sessoes/2026-06-24-m52b-faxina-contabil-melt.md`.

---

## ONDE PARAMOS — 2026-06-23 (Orquestrador — M52a Faxina Contábil Fases C-G: integridade + reconciliação v2 + painel passivo — merge na main; fechamento via git por 500 do Code)

**Marco M52a entregue.** Integridade contábil do token (Fases G+D+C+E). Merge `83a507c` (feat `b57246a`).
Branch `feature/faxina-contabil-fase-c-g` preservada. **Fechamento feito pelo ORQUESTRADOR via git** (Code
teve API 500 persistente no passo de merge; a sprint inteira estava não-commitada — orquestrador landou pra
não perder). Código 100% re-revisado + 4 reviewers aprovaram antes do merge.
- **Reconciliação (saga):** o "furo de ~730" era 95% falso-positivo de bug de cálculo (comparava contra
  saldoDisponivel, ignorando pendente/bloqueado). v1 CORROMPIDA (aplicou DEBITOs errados em AGOSTINHO+LEONARDO
  que estavam CERTOS) → REVERTIDA (orquestrador verificou: 0 RECONCILIACAO no banco) → 3 bugs corrigidos
  (total-balance + switch exaustivo sem else cego + perna C Passivo vira MUTACAO_PASSIVO, fora da DRE) → v2
  CORRETA aplicada (só LUCIANO +49 + AMAGES +210; orquestrador derivou de 1os princípios e bateu 100%).
  Invariante ledger↔saldo = 0.
- **Entregas:** G atomicidade ($transaction nos pares D+C); D reconciliação + cron diário + trigger admin;
  C classificação ato-cooperativo (Próprio/Auxiliar) no contábil + SOCIAL guard; E painel Passivo & Forecast;
  fix estrutural quantidade>0.
- **Próximo = M52b** (Bloco F melt) + follow-ups (Art 79/88→Walter, soft-delete, D-novo-FAXINA-CONTABIL-LEDGER-
  ALIGN, N+1 cron). Detalhe: `docs/sessoes/2026-06-23-m52a-faxina-contabil-c-g.md`.
- **D-novo-FAXINA-CONTABIL-LEDGER-ALIGN — medição confirmada pós-merge (23/06):** invariante ledger↔saldo=0 ✅
  mas invariante CONTÁBIL↔SALDO (FUNDACAO §4#1) tem **resíduo R$ 858,34** (Passivo 2.3.01 contábil=R$ 93,10
  vs esperado 2114,32 tokens × R$ 0,45 = R$ 951,44). Causa: reconciliação foi ledger-only + emissões pré-M50
  sem espelho contábil. M52b inclui (i) cron monitorando AMBOS invariantes; (ii) espelho contábil dos +259
  da reconciliação v2; (iii) decisão Walter sobre passivo histórico não-escriturado.
- ⚠️ Code voltando da 500: M52a JÁ está mergeado (`83a507c`) — NÃO re-aplicar; só `pm2 list` + sanity.

---

## ONDE PARAMOS — 2026-06-23 (Code — M51 Sprint Hardening Lateral: anti tenant-spoof + IDOR autenticados + ATESTADO @Public 40/40 — smoke E2E real + merge na main)

**Sessão Code dedicada — M51 entregue ponta-a-ponta com smoke E2E REAL
8/8 verde + ATESTADO @Public completo (40 endpoints, 0 PRECISA-FIX).**
🟢 **TÚNEL PRONTO PRA ABRIR CADASTRO PÚBLICO** + Camada 3 + 2º parceiro real.

**RESOLVIDO** (8 débitos):
- LEAD-EXPANSAO-PUBLIC-TENANT-SPOOF P1 (3ª ocorrência M45)
- PRE-CADASTRO-PROXY-PUBLIC-TENANT-SPOOF P1 (4ª, descoberto pela varredura)
- CADASTRO-COMPLETO-TENANT-SPOOF P1 (M45 lateral)
- MOTOR-PROPOSTA-PLANO-CROSS-TENANT P1 (M45 lateral)
- AUDITLOG-TENANT-ALVO-SA P1 (M45 lateral)
- HARDENING-CONTROLLERS-LATERAIS P1 asaas (M45 lateral)
- CONVENIO-UPDATE-SEM-COOPID P2 (M46)
- CONVENIO-LISTAR-MEMBROS-SEM-COOPID P2 (M46)

**ENTREGAS (7 blocos A → G):**
- **0 Varredura @Public**: descobriu 4ª ocorrência M45 em pre-cadastro-proxy
- **A** lead-expansao + pre-cadastro-proxy: padrão M45 (?tenant= validado + body DESCARTADO + 404 anti-enumeração + Throttle 10/min)
- **B** cadastroCompleto + motor-proposta: assertSameTenantOrSuperAdmin + plano findFirst com cooperativaId
- **C** AUDITLOG: cooperativaIdSource decorator + função pura resolveCooperativaIdAlvoAudit
- **D** asaas: assertSameTenantOrSuperAdmin explícito + null guard testarConexao
- **E** convênio update + listarMembros + remove: DiD com cooperativaIdJwt
- **F** specs + smoke + reviewers
- **G** fixes pós-reviewers (10 aplicados)

**REVIEWERS (3 paralelos + re-review)**:
- multitenant-reviewer: APROVADO com 4 P2 + 1 P3
- security-reviewer: WARNING → APROVADO (6 fixes)
- code-reviewer: WARNING → APROVADO (5 fixes)
- **Re-review orquestrador**: APROVADO com 2 CONDIÇÕES extras aplicadas:
  - **C1**: F2 indicadorId service-side validation (fechou agora, não follow-up)
  - **C2**: ATESTADO @Public completo (40/40 classificados, 0 PRECISA-FIX)

**ATESTADO @PUBLIC (Condição 2):**
| Categoria | Qtde |
|---|---|
| auth-sem-write-tenant | 7 |
| read-only | 5 |
| token-based (single-use) | 14 |
| webhook-assinado | 5 |
| cadastro-fechado-M45 (anteriores) | 2 |
| **fixado-nesta-sprint** | **2** |
| safe (sem cooperativaId no schema) | 5 |
| 🔴 PRECISA-FIX | **0** |

**🔴 DÉBITOS NOVOS catalogados (5):**
- `D-novo-AUDITLOG-FAILURE-PATH` P2 (interceptor tap só dispara em sucesso)
- `D-novo-AUDIT-CooperativaIdSource-TYPE-STRENGTHENING` P3 (template literal)
- `D-novo-CUID-FORMAT-VALIDATION-PUBLIC` P3 (defense-in-depth)
- `D-novo-CONVENIO-REMOVE-TOCTOU` P3 (transaction wrap)
- `D-novo-AUDITLOG-50-ENDPOINTS-RETROATIVO` P3 (cooperativaIdSource retroativo)

**Verificação:**
- Specs novas (3 suites): 24/24 ✅
- Regressão (11 suites M50/M49/F4/D2/etc): 120/120 ✅
- Total 123/123 ✅; 0 erros TS novos
- **Smoke E2E REAL 8/8**: 4 lead-expansao + 4 pre-cadastro-proxy (inclui novo caso F2: indicadorId cross-tenant → 404). Cleanup OK.

**Commits M51:** `<feat-sha>` (feat) + `<docs-sha>` (docs) + merge `--no-ff`
(preserva `feature/hardening-lateral`). Zero regressão.

**Próximo bloco — escolha do orquestrador:**

(A) Camadas 2/3 do Funil (vitrines parceiro + SISGD marketplace) — desbloqueadas
(B) Sprint FAXINA Fases C-G (melt/painel/reconciliação — gated Walter)
(C) Onboarding 2º parceiro real (Santi etc)
(D) Sprint Pipeline OCR + Concierge (hook classificacaoScee M48 deferido)

**Frase de retomada COMANDANTE pra próximo Code:** ver `## FRASE DE
RETOMADA — próxima sessão Code` no fim deste documento.
Detalhe: `docs/sessoes/2026-06-23-m51-sprint-hardening-lateral.md`.

---

## ONDE PARAMOS — 2026-06-22 (Code — M50 Sprint Faxina Contábil do Token Fase A/B: modelo voucher + ato cooperativo — smoke E2E real + merge na main)

**Sessão Code dedicada — M50 entregue ponta-a-ponta com smoke E2E REAL
no CoopereBR Teste (cooperado FRESCO criado e deletado conforme lição
re-review M49).** Risco fiscal IMEDIATO neutralizado.

**MODELO**: token = VOUCHER de circuito fechado (CPC 47) emitido por
COOPERATIVA. Dinheiro que entra = PASSIVO DIFERIDO (ato cooperativo Lei
5.764/71 Art. 79 § único — ISENTO). Receita só no MELT (taxa+spread+
quebra), nunca na emissão. Validado pelo `cooperebr-analista-conformidade`.

**ENTREGAS Fase A/B (8 grupos):**
- **A** PlanoContas: criadas 5.1.10 Custo Desconto Token (DESPESA) +
  1.2.10/11/12 (Receitas de melt — gated); aposentada 1.2.01 Receita
  Venda Tokens (armadilha tributária); recodificada 5.1.02→2.3.01
  PASSIVO (13 lançamentos via FK preservados).
- **B** Migração de dados: 9 lançamentos `[Token]` da colisão 5.1.01-Usina
  → 5.1.10. 3 lançamentos USINA REAL preservados.
- **C** Schema deltas aditivos: `OrigemLancamento += COBRANCA_ABATE_FATURA`;
  `PlanoContas.codigo @unique` global → `@@unique([codigo, cooperativaId])`
  (fix multitenant — 0 duplicatas).
- **D** Refactor token-contabil.service: novo `lancarIngressoEmissaoPaga`
  (D Caixa / C Passivo 2.3.01); legados repointados; `lancarCompraParceiroPago`
  DELETADO; convenção D=DESPESA/C=RECEITA uniforme; idempotência via
  origemId.
- **E** Helper `classificacao-contabil.helper.ts` (NOVO) — 14 tipos em 5
  categorias canônicas (INGRESSO_PAGO/BONIFICACAO_DESCONTO/_ADMIN/
  TRANSFERENCIA_INTERNA/USO). **Validado pelo analista-conformidade.**
- **F** Eventos + listener: novo `INGRESSO_EMISSAO_PAGA`; `creditar` roteia
  por categoria; `handleEmitido` roteia por classificação; `handleResgatadoFamiliar`
  ADICIONADO (fix M49 gap — passivo agora baixa no abate familiar).
- **G** `cobrancas.service.ts:312`: chamada direta removida (double-call
  FATURA_CHEIA_TOKEN era passivo 2× inflado).

**REVIEWERS (4 paralelos + re-review):**
- analista-conformidade: APROVADO com 2 ressalvas (BENEFICIO_CONVENIO
  AUXILIAR/PROPRIO depende do pagador + SOCIAL sem validação destinatário
  → catalogados pra Fase C).
- financeiro-token: APROVADO com 9 achados (5 P1 + 4 P2; aplicados ou
  catalogados).
- multitenant: APROVADO com 4 achados (P1 garantirContas + P2 idempotência
  + P2 cooperativaId obrigatório aplicados).
- code-reviewer: APROVADO com 2 P1 + 4 P2 + 4 P3 (P1 estornos + P1
  garantirContas aplicados; demais catalogados).
- Re-review orquestrador: **APROVADO** com 3 ajustes (typo 91→13,
  elevar P3→P2 Promise.all, confirmar analista validou classificação).

**✅ DÉBITOS RESOLVIDOS nesta sprint:**
- `1.2.01 Receita Venda Tokens` armadilha tributária (APOSENTADA)
- `5.1.02 DESPESA → 2.3.01 PASSIVO` (recodificada + tipo corrigido)
- Colisão `5.1.01` Usina × Custo Desconto Token (5.1.10 nova + migração)
- `confirmarCompraParceiro` + `processarPagamentoCompraPj` half-entries
  errados (rota canônica D Caixa / C Passivo)
- `RESGATADO_FAMILIAR` sem handler contábil (M49 gap fechado)
- `garantirContas` cross-tenant + double-call FATURA_CHEIA_TOKEN +
  ESTORNOS no default errado + tipos D+C iguais nos pares
- `lancarResgateFatura` sem idempotência
- `D-novo-PLANOCONTAS-CODIGO-NAO-MULTITENANT` (fix definitivo via schema)

**🔴 DÉBITOS NOVOS catalogados (6):**
- `D-novo-FAXINA-BENEFICIO-CONVENIO-NATUREZA` P1 (fecha em Fase C)
- `D-novo-FAXINA-SOCIAL-DESTINATARIO` P2 (Fase C)
- `D-novo-FAXINA-PARTIDAS-NAO-ATOMICAS` **P2 ELEVADO** (re-review:
  half-entry contábil é P2, não P3 — fecha em Fase G)
- `D-novo-FAXINA-PROVISIONAL-VS-REALIZADO` P2 (Fase E)
- `D-novo-FAXINA-MELT-GATED` **P1 estratégico** (BLOQUEADOR PRÉ-PRODUÇÃO
  — receita de melt OFF até parecer Walter + tributarista)
- `D-novo-FAXINA-DELTA-COOPEREBR` P2 (renomeação delta −729.86; Fase D)

**Verificação:** 124/124 specs verde em 9 suites; 0 erros TS novos;
smoke E2E REAL CoopereBR Teste com cooperado FRESCO criado e deletado
(D-novo-M49-SMOKE-SEED-TESTE respeitado).

**Smoke asserts (todos verde):**
- INGRESSO_PAGO → D Caixa(null/RECEITA) + C 2.3.01(RECEITA) PROPRIO ✅
- BONIFICACAO_DESCONTO → D 5.1.10(DESPESA) + C 2.3.01(RECEITA) ✅
- BONIFICACAO_ADMIN → D 5.1.03 + C 2.3.01 ✅
- ABATE idempotência (2 chamadas mesmo origemId → 1 lançamento) ✅
- Invariante FUNDACAO §4#1: saldo=166.6 == ledger=166.6 delta=0 ✅

**Commits M50:** `<feat-sha>` (feat) + `<docs-sha>` (docs) + merge
`--no-ff` (preserva `feature/faxina-contabil-token`). Zero regressão.

**Próximo bloco** (escolha do orquestrador):

(A) **Sprint HARDENING LATERAL** (~10-14h) — pré-requisito Camada 3
funil + 2º parceiro real. Fecha 4 P1 M45 + 2 P2 M46 + 2 P2 M47 + 1 P1
M48 (lead-expansao spoof) + IDORs do inventário.

(B) **Sprint FAXINA FASES C-G** (~12-18h) — melt/painel/reconciliação.
   C: ligar `Convenio.naturezaAtoCooperativo` ao contábil
   D: investigar delta −729.86 + reconciliação
   E: painel admin Passivo/Forecast
   F: receita de melt (taxa QR + spread + quebra) — **GATED parecer Walter**
   G: `$transaction` nos pares D+C (D-novo-FAXINA-PARTIDAS-NAO-ATOMICAS)

**Frase de retomada COMANDANTE pra próximo Code:** ver `## FRASE DE
RETOMADA — próxima sessão Code` no fim deste documento (M50 atualizada,
M49 arquivada).
Detalhe: `docs/sessoes/2026-06-22-m50-sprint-faxina-contabil-token.md`.

---

## ONDE PARAMOS — 2026-06-22 (Code — M49 Sprint Convênio FAMÍLIA: vínculo + autorização bilateral + abate familiar + sizing + saque gated — smoke E2E real + merge na main)

**Sessão Code dedicada — M49 entregue ponta-a-ponta com smoke E2E REAL
5/5 + 2 WhatsApps `ENVIADA` whitelist.** Fecha o ciclo COOPERATIVIZADO
do convênio: M44 (origem) + M46 (fundação) + M47 (migração) + M48
(funil motor) + **M49 (família)**.

**MODELO DE USO:** esposa cooperada SEM UC recebe tokens do convênio
da empresa → autoriza bilateralmente o marido (cooperado COM UC) → ela
usa os tokens dela pra abater a fatura dele. Energia continua no nome
do marido; benefício (token) é dela; a casa economiza. Conversibilidade
configurável por tenant (`Cooperativa.tokenFamiliarSacavel`; default
OFF, abate-só por padrão).

**ENTREGAS (8 fatias A–I):**
- **A** Schema delta aditivo: `AutorizacaoTokenFamiliar` (cooperativaId
  + pagadorId + titularId + ativo + contadores incluindo
  `totalTokensAbatidos Decimal default 0` após fix re-review + revogacao
  tracking + @@unique[pagador,titular] v1 + 2 indexes multi-tenant);
  `Cooperativa.tokenFamiliarSacavel`; `Indicacao/Convite.familiar`.
- **B** Trava MLM família (`indicacoes.service:336` skip BeneficioIndicacao
  + tokens MLM; `convite-indicacao.service:279` propaga flag).
- **C** AutorizacaoTokenFamiliarService + 3 endpoints (criar/confirmar/
  revogar) + GET /sizing. Multi-tenant inegociável + typed errors +
  notif WA bilaterais best-effort.
- **D** `usarNaFatura` familiar — `titularCooperadoId?` no DTO; saldo/PIN/
  limite SEMPRE da PAGADORA (lição orquestrador 22/06); cobrança do
  TITULAR; pós-commit updateMany contadores + updateMany race-proof
  primeiraUtilizacaoEm + AuditLog forense + evento RESGATADO_FAMILIAR
  → handler envia 2 WAs idempotência separada por tipoDisparo.
- **E** G4 sizing kWh→token display-only — helper puro
  `estimarTokensPorConsumo` + endpoint GET via `service.sizing()`.
  Tarifa-helper retorna `isFallback` additive (não quebra outros callers).
- **F** Gate saque familiar 3ª via paralela ao D2 — `tokenFamiliarSacavel`
  + pagadora ativa + mesmo gate-produção. Mensagem genérica
  anti-enumeração; estabelecimento bypassa; D2 path legado preservado.
- **H** 3 reviewers paralelos (financeiro-token + multitenant + code)
  + 14 fixes (4 P1 + 6 P2 + 3 P3). Convergência forte em P1-A (HTTP
  gap titularCooperadoId).
- **G** Smoke E2E REAL 5/5 PASS — CoopereBR tenant + cooperados whitelist
  (carolina+amages) + 2 WAs ENVIADA + AuditLog criado + saldo PAGADORA
  debitado + cobrança TITULAR abatida + contadores autorização OK.
- **I (fechamento)** Doc-sessão + débitos + CONTROLE + merge + push.

**REVIEWERS** (3 paralelos + re-review):
- financeiro-token-reviewer: aprovado com ressalvas (invariantes
  FUNDACAO confirmados; P1-A HTTP gap + P2 race + P2 cobranca.updateMany
  aplicados).
- multitenant-reviewer: aprovado com ressalvas (4 P1 mtenant fixed; 2 P2
  deferidos justificados).
- code-reviewer: aprovado com ressalvas (P1-A + P1-B as any tipificado;
  P2-A PrismaService removido do controller; forwardRef mantido justificado).
- Re-review orquestrador: **APROVADO** com 2 ajustes (bug
  totalTokensAbatidos schema + cleanup smoke) — TODOS aplicados +
  re-smoke confirmou.

**✅ DÉBITOS RESOLVIDOS nesta sprint:**
- Spec Família (G1 + G4) implementada.
- Conversibilidade configurável por tenant pronta.
- Multi-tenant inegociável (M45) preservado em todos os pontos novos.

**🔴 DÉBITOS NOVOS catalogados:**
- `D-novo-M49-SAQUE-FAMILIAR-SEGMENTACAO-ORIGEM` P2 (antes de 2ª empresa
  real) — gate F3 saque familiar hoje só vê saldo bruto; precisa
  segmentar origem dos tokens (rio convênio ≠ rio desconto-fatura)
  no pattern D2.1 Salvaguarda 1.
- `D-novo-M49-SMOKE-SEED-TESTE` **P2 ELEVADO** (pré-requisito próximo smoke real) —
  re-review orquestrador 22/06 elevou pra P2. Seedar 2 cooperados ATIVO
  frescos + contrato + cobrança A_VENCER em **CoopereBR Teste**.
  **LIÇÃO FIRME:** NUNCA usar cooperado pré-existente (AMAGES/CAROLINA/
  qualquer) em smoke. Smoke M49 deixou 2 DEBITO órfãos no ledger da
  CAROLINA (cleanup removeu setup CREDITO mas preservou DEBITO de
  abate). Corrigido com UPDATE cirúrgico pós-verificação.
- `D-novo-FUNDACAO-DELTA-COOPEREBR` **P2 PRÉ-EXISTENTE NÃO-M49** —
  verificação pós-cleanup mediu delta -729.86 no tenant CoopereBR
  (Σ saldos 1127.46 vs Σ ledger 1857.32). Não causado pelo M49
  (isolado: M49 contribuiu temporariamente +20, corrigido). Provável
  débito histórico de sprints anteriores (seed/migração/ledger sem
  update de saldo). Bloqueia ativação saque PIX em produção.
- `D-novo-M49-CLEANUP-SMOKE-PROD` P3 — cleanup script não é idempotente
  por AuditLog acumulado em re-rodadas; mitigação manual no re-run.
- `D-novo-M49-COOPER-TOKEN-SALDO-COOPID` P3 (deferido) —
  cooperTokenSaldo.update sem `cooperativaId` no where (refactor
  cross-cutting).

**Commit M49:** `1422a9b` (feat) + merge `--no-ff` (preserva
`feature/convenio-familia`). Zero regressão (91/91 specs M49+F4+D2+
sizing+listener+autorizacao+gate; 87/87 specs convenios-custeio).

**Próximo bloco:**

- **Sprint HARDENING LATERAL** (~10-14h) — pré-requisito da Camada 3
  do funil E de escalar pro 2º parceiro real. Fecha 4 P1 M45 + 2 P2 M46
  + 2 P2 M47 + 1 P1 M48 (lead-expansao spoof anônimo 3ª ocorrência)
  + IDORs do inventário.
- **Depois disso:** Camadas 2/3 do Funil (vitrines parceiro + SISGD
  marketplace) — DESBLOQUEADAS.

**Frase de retomada COMANDANTE pra próximo Code:** ver `## FRASE DE
RETOMADA — próxima sessão Code` no fim deste documento (M49 atualizada,
M48 arquivada).
Detalhe: `docs/sessoes/2026-06-22-m49-sprint-convenio-familia.md`.

---

## ONDE PARAMOS — 2026-06-22 (Code — M48 Sprint Funil Camada 1 MOTOR: Roteador A/B/C advisory + AliasParceiroSisgd + LeadExpansao.converter + smoke E2E real + merge na main)

**Sessão Code dedicada — M48 entregue ponta-a-ponta com smoke E2E REAL 3/3.**
Camada 1 do Funil (motor backend). **PASSIVO/ADVISORY only**: decide caminho
A/B/C/AMBIGUO_ADMIN + grava metadata em 4 campos do Cooperado. NÃO bloqueia,
NÃO redireciona, NÃO dispara migração. Enforcement vem nas Camadas 2/3
(vitrines parceiro + SISGD marketplace) — sprints próprias dependentes de
spec do orquestrador + decisão produto Luciano.

**CONVÊNIO COOPERATIVIZADO COMPLETO** ✅:
- M44 (origem-dado) ✅
- M46 (fundação E1+E8) ✅
- M47 (migração G2+G5) ✅
- **M48 (funil motor)** ✅ ← esta sessão

**ENTREGAS:**
- **Fatia A** — Schema delta aditivo: model `AliasParceiroSisgd` (tenant-aware,
  cooperativaId FK + alias + tipo enum-livre + ativo + 2 indexes); Cooperado
  += 4 campos opcionais `roteamento*`; FaturaProcessada += classificacaoScee
  (hook deferido).
- **Fatia B** — RoteamentoCadastroService.decidirCaminho com 4 caminhos.
  Matcher: CNPJ direto com `validarCnpjDv` oficial Receita Federal (H2 —
  evita telefone como CNPJ) + alias ILIKE substring nos 2 sentidos.
  Cross-tenant lookup INTENCIONAL documentado (retorna SÓ
  {caminho, tenantAlvo?, razao}). Filtra Cooperativa.ativo:true. Sanitiza
  fornecedorTrim na razao (defesa XSS Camada 2/3). 17 specs Jest.
- **Fatia C** — Wiring PASSIVO em 2 pontos: cooperados.controller.ts:create
  + publico.controller.ts:cadastroWeb. cooperativaId SEMPRE do JWT (lição
  M45). cooperados.service findAll/findOne com `omit: roteamentoTenantAlvo`
  (P2 — anti-enumeração).
- **Fatia D** — Seed 6 aliases CoopereBR (importa `RoteamentoCadastroService.
  normalizarAlias` — L1, sem duplicação).
- **Fatia E** — LeadExpansao.converter() endpoint admin (fecha gap M47).
  Typed errors `LeadNaoEncontradoError` + `LeadJaConvertidoError` (H1).
  Controller `instanceof` (não substring match). 5 specs.
- **Fatia F** — Smoke E2E REAL 3/3 PASS (cenários C/A/B confirmados;
  motor silencioso — D-novo-WA-DEV-FALSE-OK não se aplica).

**REVIEWERS** (2 paralelos + re-review):
- multitenant-reviewer: APROVADO COM RESSALVAS (P2 omit tenantAlvo + filtro
  ativo:true + cooperativaId no update.where + sanitizarTexto — TODOS FIXED).
- code-reviewer: WARNING (2 HIGH) → APROVADO COM RESSALVAS (H1 typed errors +
  H2 validarCnpjDv + M2 take:500 + M3 \p{M} regex + L1 seed import + L2
  TIPOS_ALIAS_VALIDOS spec — TODOS FIXED).
- Re-review orquestrador: **APROVADO** — "Os fixes estão certos. Pode
  mergear + fechar."

**✅ DÉBITOS RESOLVIDOS nesta sprint:**
- `D-novo-ROTEADOR-CADASTRO-CENTRAL` P1 (Camada 1 motor).
- `D-novo-LEAD-EXPANSAO-CONVERTER` P1 (endpoint admin + typed errors).
- `D-novo-JA-RECEBE-CREDITOS-GD-PASSIVO` P2 (agora ATIVO).
- `D-novo-LISTA-ALIASES-PARCEIROS-SISGD` P2 (model + seed).

**🔴 BLOQUEADOR DE EXPOSIÇÃO da Camada 3 (vitrine pública):**
- `D-novo-LEAD-EXPANSAO-PUBLIC-TENANT-SPOOF` P1 — `POST /lead-expansao`
  `@Public()` aceita body.cooperativaId. **3ª ocorrência do mesmo spoof
  M45 anônimo**. Pré-existente, descoberto na review M48. Fix obrigatório
  no **Hardening Lateral pré-Camada 3**.
- 4 P1 lateral M45 (CADASTRO-COMPLETO + MOTOR-PROPOSTA-PLANO +
  AUDITLOG-TENANT-ALVO-SA + HARDENING-CONTROLLERS-LATERAIS).
- 2 P2 M46 (CONVENIO-UPDATE-SEM-COOPID + LISTAR-MEMBROS-SEM-COOPID).
- 2 P2 M47 (DESLIGADO-SALDO-RESIDUAL + MSG-MULTI-TENANT-PARCEIRO).

**Outros débitos novos M48** (catalogados, sem bloquear): HOOK-CLASSIFICACAO-
SCEE P2 (Sprint Pipeline OCR), UI-ADMIN-ALIASES P2, TIPO-ALIAS-VALIDACAO P3,
AUTO-INSCREVER-SEM-ROTEADOR P3 (decisão Camada 2), ALIAS-FTS P3.

**Commits:** `26201d8` (feat) + `e9db14b` (merge --no-ff). Feature branch
`feature/funil-roteador-engine` PRESERVADA. Zero regressão.

**Próximo bloco:**

- **Sprint Convênio FAMÍLIA (Fase 2 — G1 vínculo familiar + G4 consumo
  declarado → token)** com **conversibilidade do token CONFIGURÁVEL**
  (decisão Luciano: default abate-fatura não-conversível; opcional saque
  gated reusa infra D2 saque colaborador M41). **DEPENDE de:** orquestrador
  formalizar spec da família (G1 + G4 + flag por tenant + parecer
  trabalhista pra liberar produção).

- **Sprint Hardening Lateral** (~10-14h) — fast-follow recomendado +
  PRE-REQUISITO obrigatório da Camada 3 do Funil (vitrine pública).
  Fecha 4 P1 M45 + 4 P2 M46+M47 + 1 P1 M48 LEAD-EXPANSAO-PUBLIC-TENANT-SPOOF.

- **Camadas 2/3 do Funil** (vitrines parceiro + SISGD marketplace) —
  BLOQUEADAS até Hardening Lateral fechar.

- Outras catalogadas: OPÇÃO A D-QUALIF-DECAY (~6-10h), OPÇÃO C
  Notificações Proativas, Sprint Pipeline OCR + Concierge (hook
  classificacaoScee).

**Frase de retomada COMANDANTE pra próximo Code:** ver `## FRASE DE RETOMADA —
próxima sessão Code` no fim deste documento (M48 atualizada, M47 arquivada).
Detalhe: `docs/sessoes/2026-06-22-m48-sprint-funil-camada-1-motor.md`.

---

## ONDE PARAMOS — 2026-06-21 (Code — M47 Sprint Convênio MIGRAÇÃO: G2 estados + G5 doc + ciclo admin-manual + smoke E2E real + merge na main)

**Sessão Code dedicada — M47 entregue ponta-a-ponta com smoke E2E REAL.**
Sprint Fase 3 do design 19/06 que finaliza o **convênio cooperativizado
COMPLETO** (M44 origem-dado + M46 fundação + **M47 migração**). Mecânica
admin-manual de migração de cooperado de distribuidora/cooperativa CONCORRENTE
→ SISGD. Roteador A/B/C deferido como Sprint Roteador+Funil própria
(aguarda spec do orquestrador + decisão produto Luciano).

**ENTREGAS:**
- **Fatia A** — Schema delta aditivo: StatusCooperado += PENDENTE_MIGRACAO +
  DESLIGADO; MigracaoUsina += 5 campos opcionais (distribuidoraOrigem,
  numeroUcOrigem, dataInicioMigracao, dataDesligamentoEfetivo, statusMigracao)
  + 2 indexes compostos.
- **Fatia B** — Guards billing MUST-FIX double-charge: cobrancas.service.create
  + convenios-custeio.gerarCobrancaConsolidada filtram cooperados em
  PENDENTE_MIGRACAO/DESLIGADO.
- **Fatia C** — MigracaoExternaService + 3 endpoints admin
  (`POST /cooperados/:id/migrar` + `/migrar/concluir` + `/migrar/rejeitar`)
  com `cooperativaId` SEMPRE do JWT (lição M45). Multi-tenant
  defense-in-depth em todos os 6 UPDATEs. AuditLog forense quando DESLIGADO
  com saldo residual. Guard `alterarStatusLote` rejeita
  PENDENTE_MIGRACAO/DESLIGADO via lote.
- **Fatia D** — Cron `@Cron('0 7 * * *')` timeout 30d: emit evento + AuditLog
  forense + WA admin (orderBy createdAt asc determinístico). SEM rollback
  automático (admin decide).
- **Fatia E** — Seed ModeloDocumento `DESLIGAMENTO_CONCORRENTE`
  tenant-agnóstico (`{{provedora.*}}` em branco). Matcher bot WA inclui
  PENDENTE_MIGRACAO (DESLIGADO fica fora).
- **30 specs Jest verde** + **smoke E2E REAL passou** (cooperado-teste
  whitelist 27981341348 → /migrar → /migrar/concluir + 2 WAs reais ENVIADA;
  D-novo-WA-DEV-FALSE-OK descartado).

**REVIEWERS** (3 paralelos + re-review):
- multitenant-reviewer: APROVADO COM RESSALVAS (P1 6 UPDATEs sem cooperativaId
  FIXED + P2 cooperativaId no WA metadata FIXED + 2 P3 documentação FIXED).
- financeiro-token-reviewer: APROVADO COM RESSALVAS (FUNDACAO §4#1 preservada;
  E3 confirmado em 7 pontos do circuito; P3 orderBy determinístico FIXED;
  P2 AuditLog saldo residual FIXED).
- code-reviewer: WARNING (4 P1) → 3 FIXED (STATUS_MIGRACAO_VALIDOS comentário +
  alterarStatusLote guard + spec assert cooperativaId) + 1 catalogado (DTOs
  class-validator).
- Re-review orquestrador: **APROVADO** — "Smoke real cumpriu exigência."

**O QUE FECHOU (✅) — DÉBITOS DO DESIGN 19/06:**
- `D-novo-CONVENIO-G2-ESTADOS-MIGRACAO` P2 → ✅ RESOLVIDO.
- `D-novo-CONVENIO-G5-DOC-DESLIGAMENTO` P3 → ✅ RESOLVIDO.
- `D-novo-CONVENIO-E2-MIGRACAO-FALHA-SEM-ROLLBACK` P2 → ✅ MITIGADO (cron +
  admin manual).

**🔴 DESTAQUES — "OK pro piloto Santi, FECHAR ANTES de escalar":**
- `D-novo-M47-DESLIGADO-SALDO-RESIDUAL` P2 — DESLIGADO com tokens fica congelado
  inacessível. AuditLog mitiga, mas viola promessa E1 do M46 ("seus tokens
  continuam seus"). Precisa rota de uso/devolução antes de confiar no DESLIGADO
  com saldo > 0.
- `D-novo-M47-MSG-MULTI-TENANT-PARCEIRO` P2 — mensagens WA hardcodam
  "CoopereBR". Correto pro piloto Santi mas BLOQUEIA onboarding
  Consórcio/Associação/Condomínio.

**Outros débitos novos M47** catalogados (~11): RACE-CONSOLIDADA P2,
DTOS-INICIAR-REJEITAR P2, CRON-IDEMPOTENCIA P2, HELPER-TENANT-CTX P3,
CONCLUIDO-REJEITADO-POR-ID P3, CRON-TIMEZONE P3, STATUS-NULLABLE-CONSTRAINT P3,
TOM-MSG-DESLIGADO P3, SPECS-FRAGEIS P3, SMOKE-POLLING P3,
NOTIF-FAIL-LOG-MIGRACAO-ID P3.

**Commits:** `5ee0aff` (feat) + `f36782b` (merge --no-ff). Feature branch
`feature/convenio-migracao` PRESERVADA no origin.

**Próximo bloco** (escopo COMPLETO Luciano):
- **#1 M45 Hardening Tenant-Spoof** — ✅ FECHADO
- **#2 M46 Convênio FUNDAÇÃO** — ✅ FECHADO
- **#3 M47 Convênio MIGRAÇÃO** — ✅ FECHADO NESTA SESSÃO
- **Sprint ROTEADOR + FUNIL DE AQUISIÇÃO** — próximo na fila do convênio
  multi-parceiro. DEPENDE de: orquestrador formalizar spec completa + Luciano
  decidir critério de atribuição lead→parceiro (região / escolha usuário /
  capacidade parceiro / placement-pago). 8 débitos pré-catalogados na Fase 1
  ampliada M47.
- **Sprint Convênio FAMÍLIA (Fase 2 — G1)** — DEFERIDA até parecer trabalhista
  (token paga conta de luz = risco salário in natura agravado CLT 458 quando
  expandido pra família).
- **Sprint Hardening Lateral / IDOR sistêmico** — segue catalogado.
- **Sprint OPÇÃO A D-QUALIF-DECAY** + **OPÇÃO C Notificações Proativas** —
  seguem catalogados.

**Frase de retomada COMANDANTE pra próximo Code:** ver `## FRASE DE RETOMADA —
próxima sessão Code` no fim deste documento (M47 atualizada, M46 arquivada).
Detalhe: `docs/sessoes/2026-06-21-m47-sprint-convenio-migracao.md`.

---

## ONDE PARAMOS — 2026-06-21 (Code — M46 Sprint Convênio FUNDAÇÃO: E1 tokens ficam + E8 notificações wiradas + smoke E2E REAL passou + merge na main)

**Sessão Code dedicada — M46 entregue ponta-a-ponta + smoke E2E REAL.**
Sprint pequena (~3h) que finaliza a **fundação do ciclo de vida + notificações**
do convênio cooperativizado. E1 (decisão Luciano: tokens FICAM com funcionário
desligado) validado e wirado com notif inline. E8 (`TokenNotificacaoService`
órfão) wirado via listener único.

**ENTREGAS:**
- **Fatia A** — TokenNotificacaoService 2 métodos novos
  (`notificarDistribuicaoConvenio` + `notificarAbateFatura`); não tocar
  `notificarRecebedor` original.
- **Fatia B** — Evento `CooperTokenDistribuidoConvenioEvent` + emit em
  `distribuirTokens` APÓS commit mass-write (1 por linha, sequencial
  best-effort; guard `!resultado.idempotente`).
- **Fatia C** — `CooperTokenNotificacaoListener` único: consome RESGATADO +
  DISTRIBUIDO_CONVENIO; idempotência via `MensagemWhatsapp.findFirst(
  {tipoDisparo, disparoId, status:'ENVIADA', cooperativaId})` (defense-in-depth);
  sem telefone → skip + log warn.
- **Fatia D** — E1 inline em `removerMembro`: busca `ConfigCooperToken.valorTokenReais`
  do tenant (P1-A reviewer — NÃO hardcode 0.45) + `CooperTokenSaldo` +
  `Cooperado(telefone, nome)` filtrado por `cooperativaId`. Texto: "Você foi
  desligado... Você ainda tem N CooperTokens (R$ Y). **Eles CONTINUAM SEUS**...".
- **22 specs Jest verde** (10 listener + 12 E1).
- **Smoke E2E REAL** (exigência re-review): cooperado-teste whitelist
  27981341348 + vínculo ATIVO em Convênio "Condomínio Moradas da Enseada" →
  `removerMembro` real → `MensagemWhatsapp.status='ENVIADA'` ✅, telefone ✅,
  texto E1 com R$ 22,50 (50 tokens × 0.45 do tenant) ✅. WA REAL CONFIRMADO
  (D-novo-WA-DEV-FALSE-OK descartado).

**REVIEWERS** (2 paralelos + re-review):
- `cooperebr-multitenant-reviewer`: APROVADO COM RESSALVAS (P2-A hardcode FIX +
  P3-A cooperativaId no dedup FIX).
- `code-reviewer`: WARNING (P1-A hardcode = mesmo achado FIX + P1-B spec
  assertion FIX). 2 P2 + 3 P3.
- Re-review orquestrador: **APROVADO** com exigência smoke real (cumprida).

**O QUE FECHOU (✅):**
- `D-novo-CONVENIO-E1-FUNCIONARIO-SAI-TOKENS-ORFAOS` P1 → RESOLVIDO (E1).
- `E8` TokenNotificacaoService órfão → WIRADO via listener.

**DÉBITOS NOVOS catalogados:**
- `D-novo-NOTIF-EMAIL-FALLBACK` P3 — email fallback pra cooperado sem telefone.
- `D-novo-E1-DISPARO-READMISSAO` P3 — `disparoId` composto colidiria em 2º
  desligamento pós-readmissão; comportamento atual aceitável (waSender sem dedup).
- `D-novo-CONVENIO-UPDATE-SEM-COOPID` P2 — removerMembro/updateMembro UPDATE
  sem cooperativaId. Pré-existente IDOR sistêmico.
- `D-novo-CONVENIO-LISTAR-MEMBROS-SEM-COOPID` P2 — listarMembros sem filtro.
  Pré-existente.
- `D-novo-UPDATEMEMBRO-ANY` P3 — `updateData: any`. Pré-existente.
- `D-novo-WA-FILA-DEDICADA` P3 — sem fila WA pra burst grande. Catalogar se
  Santi mostrar problema (cuidado A orquestrador).

**Observação:** IDOR sistêmico ACUMULANDO — M45 Hardening Lateral (asaas +
condominios + convite-indicacao) + 3 D-novo-CONVENIO-*-SEM-COOPID novos +
inventário SISGD (~20 endpoints). Candidato a Sprint Hardening Lateral
próximo (re-review orquestrador 21/06).

**Commits:** `79e5f1f` (feat) + `950d2c1` (merge --no-ff). Feature branch
`feature/convenio-fundacao-lifecycle` PRESERVADA. Zero schema delta.

**Próximo bloco** (Luciano decidiu fazer TODAS as 4 sprints da fila em sequência):

- **#1 M45 Sprint Hardening Tenant-Spoof** — ✅ FECHADO
- **#2 M46 Sprint Convênio FUNDAÇÃO** — ✅ FECHADO NESTA SESSÃO
- **#3 — Sprint Convênio MIGRAÇÃO (Fase 3)** — próximo na fila: G2 estados
  PENDENTE_MIGRACAO/DESLIGADO + G5 doc desligamento + rollback. **Legalmente
  SEGURA** (não exige parecer trabalhista).
- **Sprint Convênio FAMÍLIA (Fase 2 — G1)** — DEFERIDA até parecer trabalhista
  do Luciano (token paga conta de luz = risco salário in natura agravado CLT 458).
- **Sprint Hardening Lateral / IDOR sistêmico** — segue candidato.
- **#3 OPÇÃO A D-QUALIF-DECAY** + **#4 OPÇÃO C Notificações Proativas** —
  seguem catalogados.

**Frase de retomada COMANDANTE pra próximo Code:** ver `## FRASE DE RETOMADA —
próxima sessão Code` no fim deste documento (M46 atualizada, M45 arquivada).
Detalhe: `docs/sessoes/2026-06-21-m46-sprint-convenio-fundacao.md`.

---

## ONDE PARAMOS — 2026-06-21 (Code — M45 Sprint Hardening Tenant-Spoof: bloqueia exposição ANÔNIMA do /cadastro FECHADO + merge na main)

**Sessão Code dedicada — M45 entregue ponta-a-ponta com escopo HONESTO.**
Sprint Hardening que fecha o bloqueador de exposição ANÔNIMA do `/cadastro`
descoberto na investigação read-only do M44. Tenant agora vem SÓ do JWT
(autenticado) ou `?tenant=<id>` validado contra `Cooperativa.ativo` (público).
`body.cooperativaId` é DESCARTADO server-side (compat-only). Path convite
público (`?conv=<token>`) preservado intacto — modelo canônico.

**ENTREGAS:**
- **Fatia A** — POST /cooperados (P0): `cooperados.controller.ts:132-167` async +
  destructure-discard + SA via `cooperativaIdAlvo` validado (DTO `@Matches` CUID +
  Cooperativa.findUnique ativo no controller); AGREGADOR preservado pelo JWT
  pré-populado. 9 specs Jest.
- **Fatia B** — POST /publico/cadastro-web v2 + cadastro-sem-uc (P1): `?tenant=`
  obrigatório + valida Cooperativa.findUnique{id,ativo} → 404. Frontend (4
  fetches + 3 links internos) com `encodeURIComponent`. 6 specs.
- **Fatia C** — GET /publico/convenios-pagador-empresa (bônus): validação
  anti-enumeração silenciosa + `@Throttle 30/min`. 3 specs.
- **Fatia D** — Smoke E2E real 5/5 PASS (ADMIN spoof descartado + SA cross-tenant
  via cooperativaIdAlvo + público tenant fake → 404 + convenios-pagador fake →
  404 + convenios-pagador real → 200 lista).

**REVIEWERS** (2 paralelos + re-review):
- `cooperebr-multitenant-reviewer`: APROVADO COM RESSALVAS — P0
  `cooperativaIdAlvo` sem validar existência FIX aplicado.
- `security-reviewer`: APROVADO COM RESSALVAS — P1-A formato/existência FIX +
  P2-B `encodeURIComponent` FIX + P3-A `@Throttle` FIX.
- Re-review orquestrador: **APROVADO** — "Fecha exposição ANÔNIMA do /cadastro.
  Merge honesto."

**O QUE FECHOU (✅):**
- `D-novo-COOPERADOS-CONTROLLER-TENANT-SPOOF` P0 → RESOLVIDO
- `D-novo-CADASTRO-PUBLICO-TENANT-SPOOF` P1 → RESOLVIDO
- (bônus) convenios-pagador-empresa enumeração silenciosa → RESOLVIDO

**O QUE NÃO FECHOU (⚠️ explícito):**
Spoofs AUTENTICADOS (admin A → tenant B) permanecem abertos em outras rotas:
- `D-novo-CADASTRO-COMPLETO-TENANT-SPOOF` P1 (`cooperados.service.ts:495` + 3 outros)
- `D-novo-MOTOR-PROPOSTA-PLANO-CROSS-TENANT` P1 (`motor-proposta.service.ts:584`)
- `D-novo-AUDITLOG-TENANT-ALVO-SA` P1 (interceptor não captura SA cross-tenant)
- `D-novo-HARDENING-CONTROLLERS-LATERAIS` P1 (asaas + condominios + convite-indicacao)
- 3 débitos P2 + 3 débitos P3 catalogados em `docs/debitos-tecnicos.md`.

NÃO bloqueiam piloto Santi (1 só admin confiável). **Fechar antes de escalar
pra múltiplos parceiros-admin reais.**

**Commits:** `9403095` (feat) + `5cd46ba` (merge --no-ff). Feature branch
`feature/hardening-tenant-spoof` PRESERVADA no origin (padrão M39/M41/M42/M43/M44).
Push main ✅. Rebuild backend + frontend ✅.

**Próximo bloco** (Luciano decidiu fazer TODAS as 4 sprints da fila em sequência):

- **#1 M45 Sprint Hardening Tenant-Spoof** — ✅ FECHADO nesta sessão.
- **#2 Sprint Convênio Fase 2** — depende de decisão de escopo do Luciano
  (piloto inclui família G1? migração G2? Fase 0 jurídica antes?). **Bloqueia**
  até essa resposta.
- **Decision-independent recomendado** enquanto #2 não vem: **Sprint Hardening
  Lateral** (fast-follow autenticado, ~6-8h) — fecha os 4 débitos P1
  autenticados. Mesmo padrão M45.
- **#3 Sprint OPÇÃO A D-QUALIF-DECAY** (~6-10h) — segue catalogado.
- **#4 Sprint OPÇÃO C Notificações Proativas** — segue catalogado.

**Frase de retomada COMANDANTE pra próximo Code:** ver `## FRASE DE RETOMADA —
próxima sessão Code` no fim deste documento (M45 atualizada, M44 arquivada).
Detalhe: `docs/sessoes/2026-06-21-m45-sprint-hardening-tenant-spoof.md`.

---

## ONDE PARAMOS — 2026-06-20 (Code — M44 Slice Convênio Origem-Dado: recebe-créditos-GD como DADO + convenioId no CooperTokenCompra FECHADO + merge na main)

**Sessão Code dedicada — M44 entregue ponta-a-ponta.** Slice
decision-independent do design do convênio cooperativizado (19/06):
cadastro V2 (público com/sem UC + wizard admin com/sem UC) agora
**registra como DADO** se o cooperado já recebe créditos GD de outro
fornecedor + nome do fornecedor (zero bloqueio: sinaliza, não barra).
Em paralelo, `CooperTokenCompra` ganhou FK opcional `convenioId` com
**guard multi-tenant obrigatório** (`cooperativaId` do JWT, nunca do
body) — rastreabilidade indireta da origem de convênio no ledger via
`Ledger.referenciaId → CooperTokenCompra.convenioId`.

**ENTREGAS:**
- Schema delta aditivo (`db push` aplicado dev):
  - `Cooperado.jaRecebeCreditosGd Boolean @default(false)` + `Cooperado.fornecedorGdAtual String?`
  - `CooperTokenCompra.convenioId String?` + FK `onDelete:SetNull`
  - 3 índices novos (`CooperTokenCompra[convenioId]`, `[cooperativaId,convenioId]`, `CooperTokenLedger[referenciaTabela,referenciaId]`)
  - `ContratoConvenio.cooperTokenCompras` back-relation
- Backend: `comprarTokensCooperado()` param novo + guard `findFirst{id,cooperativaId}` ANTES do create; controller propaga `body.convenioId`; DTO com `@Matches` CUID; `cooperados.service` + `create-cooperado.dto` + `publico.controller` (cadastroWebV2 + cadastroSemUc) propagam GD fields.
- Frontend (4 cadastros rebuildados + PM2 restart): `/cadastro`, `/cadastro/sem-uc`, `/dashboard/cooperados/novo` (Step2Dados), `/dashboard/cooperados/novo-sem-uc`.
- Testes: 6 specs Jest + smoke E2E 5 casos com `SMOKE_INICIO` cleanup.

**REVIEWERS:** multitenant OK + financeiro-token OK + re-review
orquestrador APROVADO (schema delta + guard linha 1550 + back-relation
linha 1678 + `onDelete:SetNull` linha 3221 verificados). FUNDACAO §4#1
preservada.

**DÉBITOS PRÉ-EXISTENTES descobertos pela investigação (NÃO bloqueiam M44):**
- `D-novo-COOPERADOS-CONTROLLER-TENANT-SPOOF` **P0** — endpoints aceitam `cooperativaId` no body em alguns paths.
- `D-novo-CADASTRO-PUBLICO-TENANT-SPOOF` **P1** — `publico.controller` aceita `cooperativaId` no body sem validação rígida.
- `D-novo-COOPERADO-UPDATE-SEM-COOPID` P2 — `update` não revalida tenant do registro alvo.
- `D-novo-UPDATE-COOPERADO-DTO-GD-FIELDS` P3 — falta DTO de update pros 2 campos GD novos.

**REESCOPO:** `D-novo-CONVENIO-ORIGEM-LEDGER` P1→P2 — rastreabilidade
indireta via FK + índice composto suficiente; ledger explícito vira polimento.

**Commits:** `2af634a` (feat) + `6847e5a` (merge --no-ff). Feature branch
`feature/convenio-origem-dado` PRESERVADA no origin (padrão M39/M41/M42/M43).
Push main ✅. Rebuild frontend ✅.

**Próximo bloco:** Sprint Hardening Tenant-Spoof
(`feature/hardening-tenant-spoof`) — resolver P0 + P1 pré-existentes
como **BLOQUEADOR DE EXPOSIÇÃO** antes de tunelar `/cadastro` público
(ngrok/Cloudflare). Fase 1 read-only OBRIGATÓRIA mapeando **todas** as
fontes de `cooperativaId` (body/query/params/headers/JWT) por endpoint,
preservando path legítimo de `SUPER_ADMIN` cross-tenant.

**Frase de retomada COMANDANTE pra próximo Code:** ver `## FRASE DE
RETOMADA — próxima sessão Code` no fim deste documento (M44 atualizada,
M43 arquivada). Detalhe completo: `docs/sessoes/2026-06-20-m44-convenio-origem-dado.md`.

---

## ONDE PARAMOS — 2026-06-20 (Code/Orquestrador — fechamento retroativo: DESIGN Convênio-Token-Cooperado 19/06)

**Sessão de DESIGN do orquestrador (zero código de feature).** A sessão de
design 19/06 (modelo de convênio cooperativizado + token isento + energia
flexível + vínculo familiar) ficou sem ritual de fechamento; persistido e
commitado em 20/06. O Code estava com erro de auth (401 `/login`), então o
orquestrador fechou direto no main (trabalho 100% documental).

**3 artefatos persistidos:**
- `docs/ESPEC-CONVENIO-TOKEN-COOPERADO-2026-06-19.md` — modelo ponta-a-ponta + gap map + edge cases + fasing + 6 decisões.
- `docs/relatorios/analise-conformidade-2026-06-19-modelo-convenio-cooperado-token.md` — parecer 4 lentes; 6 salvaguardas; 3 P0.
- `docs/sessoes/2026-06-19-design-convenio-token-cooperado-familia.md` — doc-sessão.

**Veredito de conformidade:** pode seguir, com 6 salvaguardas + validação
externa (3 frentes). 3 P0: trabalhista AGRAVADO (token paga conta de luz),
substância cooperativa real, STF Tema 536 (isenção como flag).

**Veredito de completude:** "NÃO pegamos tudo" — trilho clássico do token
~85% pronto, mas a camada nova (família/migração/ciclo-de-vida) está quase
toda por construir. 8 débitos catalogados (`D-novo-CONVENIO-*`), sendo
E1 (P1 🔴 bloqueador) + ORIGEM-LEDGER (P1) + FASE0-JURIDICO (P0).

**6 decisões de produto pendentes do Luciano** (ver doc-sessão / frase de
retomada). Próximo passo: slice decision-independent (marcar recebe-créditos
GD como DADO + origemConvenioId) via Fase 1 read-only.

---

## ONDE PARAMOS — 2026-06-17 (Code — M43 Sprint C Hardening: Throttler + Reconciliação Contábil FECHADO + merge na main)

**Sessão Code dedicada — M43 entregue ponta-a-ponta.** Sprint C
Hardening fecha 2 carry-overs catalogados: `D-novo-THROTTLER-APP-GUARD
P1` (catalogado M42 pelo security-reviewer) + `D-novo-RECONCILIACAO-
CONTABIL-CRON P2` (catalogado M41 no re-review do orquestrador).
Mergeado na main (`beb125c` merge `--no-ff`).

2 commits na feature branch `feature/hardening-throttler-reconciliacao`
(branch preservada no origin — NÃO deletada, padrão M39/M41/M42):

1. **Sprint C completo** `2b2af66` — Throttler global em APP_GUARD +
   tier `webhook` 600/min nos 4 webhooks (Asaas, BB, Sicoob, WA) +
   cron `*/15` de reconciliação contábil com backoff `[5min, 30min,
   2h, 12h, 24h]` + desistido após 5 falhas + AuditLog forense +
   evento `reconciliacao-desistido` + endpoint admin trigger manual
   SUPER_ADMIN + 3 P1 + 5 P2 + 4 P3 sensatos APLICADOS dos 3
   reviewers pesados.
2. **Merge** `beb125c` — `--no-ff` na main.

**Bloco 1 — ThrottlerGuard global** (D-novo-THROTTLER-APP-GUARD P1):
- 2 tiers em `ThrottlerModule.forRoot`: `default` 100/min + `webhook`
  600/min.
- `ThrottlerGuard` em APP_GUARD ANTES do JwtAuthGuard (anti-burst em
  rotas não-autenticadas).
- 4 webhooks com `@SkipThrottle({default:true}) +
  @Throttle({webhook:{limit:600,ttl:60000}})`: Asaas, BB, Sicoob,
  WhatsApp.
- Decisão Luciano Fase 1 Q1: teto ALTO (600/min) ao invés de
  SkipThrottle total — mantém backstop anti-runaway sem quebrar
  pagamento; 429 absorvido por retry+backoff do remetente.

**Bloco 2 — Reconciliação contábil cron** (D-novo-RECONCILIACAO-
CONTABIL-CRON P2):
- Schema delta aditivo em ResgateRecibo (4 campos retry +
  índice composto).
- Cron `@Cron('*/15')` re-tenta `lancarResgatePix` em recibos
  `PAGO_CREDITO_PENDENTE`.
- Idempotência via `@@unique([origemTipo,origemId])` do
  LancamentoCaixa (P1 fix Sprint C — substituiu `findFirst` soft
  guard, fecha race window cron×webhook replay).
- Backoff `[5min, 30min, 2h, 12h, 24h]` → desistido após 5 falhas.
- Desistido dispara AuditLog forense + evento `cooper-token-resgate.
  reconciliacao-desistido`.
- Endpoint admin trigger manual `POST /cooper-token/admin/
  reconciliacao/trigger` (SUPER_ADMIN, @AuditLog, @Throttle 3/min).
- Decisão Luciano Fase 1 Q4: SEMPRE LIGADO em prod (sem gate
  RECONCILIACAO_PRODUCAO_LIBERADO).
- Escopo Sprint C (Q2): apenas ResgateRecibo. F2 catalogado
  separado.

**3 reviewers pesados** (0 P0, 5 P1, 17 P2, 11 P3 únicos):
- `security-reviewer`: 0 P0, 2 P1, 9 P2, 5 P3.
- `cooperebr-financeiro-token-reviewer`: 0 P0, 3 P1, 5 P2, 2 P3.
- `cooperebr-multitenant-reviewer`: 0 P0, 0 P1, 3 P2, 4 P3.
- Re-review do `cooperebr-orquestrador` APROVOU (P1.2 `@@unique` +
  Throttler em APP_GUARD com webhooks tier 600 confirmados no
  código; smoke C1+C2 verde).

**3 P1 + 5 P2 + 4 P3 APLICADOS:**
- P1.1 Backoff off-by-one (`BACKOFF_MINUTOS[novaTentativa-1]`; 1ª
  falha agora 5min, era 30min — divergia da decisão Luciano).
- P1.2 Idempotência via `@@unique([origemTipo,origemId])` do banco
  (fecha race window cron×webhook replay).
- P1.3 `reconciliacaoUltimaEm` setado no webhook (trilha auditável).
- P2/P3: token webhook só por header (Asaas); `timingSafeEqual` em
  BB/Sicoob/WA; valor arredondado no AuditLog metadata;
  `asaasTransferId` truncado (LGPD); env guard prod no smoke C2;
  emojis → tags nos logs; warn em PROD se TokenContabilService
  faltar; warn em race detectada; +3 specs novos (10b, 10c, 12).

**Specs**: 365/365 PASS em 24 suites (+3 novos cobrindo defense in
depth e LGPD).

**Smoke E2E** verde:
- Smoke C1 throttler burst 5/5 PASS (default 429 no #101 + 4 webhooks
  absorvem 200 burst).
- Smoke C2 reconciliação 12/12 PASS (sucesso 1ª tentativa +
  idempotência via @@unique + proximaEm futura skip + desistido skip
  + AuditLog gravado).

**3 débitos novos catalogados em `docs/debitos-tecnicos.md`** (todos
P2, não-bloqueantes):
- `D-novo-F2-RECONCILIACAO-CRON P2` (análogo F2 compra PJ).
- `D-novo-RECONCILIACAO-DESISTIDO-LISTENER P2` (consumer do evento
  `reconciliacao-desistido` → cria NotificacaoProativa).
- `D-novo-RECONCILIACAO-RESETAR-ADMIN P2` (endpoint admin reset).

**Caminho de ativação produção do saque colaborador comum (restrito a
DESCONTO_FATURA) — AGORA COMPLETO em código:**
- ✅ parecer (M40, 16/06).
- ✅ Salvaguarda 1 (M42 — filtro origem).
- ✅ Salvaguarda 4 (M41 — `PENDENTE_APROVACAO_COOP` obrigatório).
- ✅ Salvaguarda 5 (M42 — disclaimer versionado).
- ✅ D-novo-THROTTLER-APP-GUARD P1 (M43 — Sprint C Bloco 1).
- ✅ D-novo-RECONCILIACAO-CONTABIL-CRON P2 (M43 — Sprint C Bloco 2).
- ⏳ parecer escrito do `cooperebr-analista-conformidade` confirmando.
- ⏳ flag `SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true` em `.env` prod.

S2 (ata assembleia) + S3 (parecer trabalhista) são **ações legais do
Luciano** fora do path da ativação restrita.

**Próximo passo único e claro:** Luciano decide — Sprint
D-QUALIF-DECAY (próxima por padrão da fila, ~6-10h) OU Sprint
Notificações Proativas (fecha D-novo-RECONCILIACAO-DESISTIDO-LISTENER
+ outros débitos antigos) OU Sprint Circuito de Emissão Completo
(4 fases, resolve 2 P1 + 7 P2 catalogados M40) OU **iniciar processo
de ativação produção do saque colaborador comum** (parecer escrito do
analista-conformidade + flag em .env prod — nenhum código novo
necessário).

**Frase de retomada COMANDANTE** ver `## FRASE DE RETOMADA — próxima
sessão Code` no fim deste documento.

Detalhe: `docs/sessoes/2026-06-17-m43-sprint-c-hardening.md`.

---

## ONDE PARAMOS — 2026-06-17 (Code — M42 Filtro de Origem + Disclaimer Versionado FECHADO + merge na main)

**Sessão Code dedicada — M42 entregue ponta-a-ponta.** Salvaguardas 1
(filtro de origem) + 5 (disclaimer versionado) do parecer
`docs/relatorios/analise-conformidade-2026-06-16-saque-colaborador-d2.md`
implementadas + mergeadas na main (`b65bcb3` merge `--no-ff`). A pausa
do dia 16/06 (Blocos 1-5 entregues mas sem smoke + reviewers + merge)
foi destravada hoje: rodaram 3 reviewers pesados + fixes + smoke E2E
8 passos + re-review do orquestrador + merge.

5 commits na feature branch `feature/d2-salvaguardas-origem` (branch
preservada no origin — NÃO deletada, padrão M39/M41):

1. **Schema (a)** `37069d5` — campos de aceite em `ResgateRecibo` (v1
   hardcoded).
2. **Backend (b)** `a6fb0ee` — Guards 1.5/1.6 + 14 specs v1.
3. **Refactor v2** `c3e14fb` — disclaimer virou ENTIDADE
   (`DisclaimerSaque` global default + override tenant + histórico
   imutável + FK no recibo) + 6 endpoints + Guard 1.6 FK-based +
   3 telas + 15 specs novos.
4. **Fixes reviewers** `4d39599` — aplicação de 8 P1 + 7 P2 sensatos
   dos 3 reviewers pesados (financeiro-token + multitenant + security)
   + smoke E2E `smoke-d2-1-disclaimer-versionado.ts` 23/23 PASS contra
   `localhost:3000` com 3 papéis reais (SUPER + ADMIN CoopereBR +
   COOPERADO SISGDSOLAR).
5. **Merge** `b65bcb3` — `--no-ff` na main.

**Salvaguardas 1 + 5 implementadas:**

- **Filtro de Origem (Salvaguarda 1)**: cooperado comum (não-Estab)
  só pode sacar tokens cujo `CooperTokenLedger.tipo` esteja em
  `{DESCONTO_FATURA, FATURA_CHEIA, GERACAO_EXCEDENTE}`. Outros tipos
  (BONIFICACAO_ADMIN, DISTRIBUICAO_CONVENIO, BONUS_INDICACAO, etc.)
  ficam bloqueados (CLT Art. 458 — risco trabalhista P0). Mensagem
  anti-enumeração. Estabelecimento bypassa (parecer §3#6 — risco zero).
- **Disclaimer Versionado (Salvaguarda 5)**: entidade `DisclaimerSaque`
  com global default + override por tenant + histórico imutável + FK
  no recibo (rastro jurídico recuperável mesmo após edições futuras).
  Anti-staleness reage à edição do admin entre GET e POST.

**Reviewers pesados** (0 P0, 9 P1, 14 P2, 8 P3 únicos):
- `cooperebr-financeiro-token-reviewer`: 3 P1 + 4 P2 + 2 P3.
- `cooperebr-multitenant-reviewer`: 3 P1 + 4 P2 + 3 P3.
- `security-reviewer`: 3 P1 + 6 P2 + 3 P3.
- Re-review do `cooperebr-orquestrador` APROVOU (confirmou P1.A
  `Math.abs` + asserção FUNDACAO §4#1 e P1.J `updateMany` com
  cooperativaId + count guard no código + smoke 23 PASS).

8 P1 + 7 P2 sensatos APLICADOS. P3s catalogados como sugestões.

**Specs**: 333/333 PASS em 22 suites (+6 novos cobrindo ESTORNO
negativo, perfil SUPER preservado, buscarPorId obrigatório,
HTML entity bypass, javascript:, on*= handlers).

**Smoke E2E** verde nos 8 passos: SUPER cria global v2 → cooperado
aceita FK + saque → recibo grava FK+versão+IP → ADMIN cria override
tenant-v1 → cooperado vê tenant-v1/TENANT → SUPER cria global v3 →
cooperado AINDA em tenant-v1 (override prevalece) → ADMIN desativa
override → cooperado volta a v3/GLOBAL + tenant-v1 ativo=false com
texto íntegro → FK STALE → BadRequest → recibo etapa 2 recupera
TEXTO EXATO da v2 via FK (rastro jurídico imutável).

**Carry-overs catalogados:**

- **D-novo-THROTTLER-APP-GUARD P1 NOVO** (sistêmico, fora escopo
  D2.1): `ThrottlerGuard` não em APP_GUARD do AppModule. Mitigação
  imediata no D2.1 via `@Throttle` por endpoint sensível. Fix global
  em sprint hardening. Catalogado em `docs/debitos-tecnicos.md` na
  seção P1.
- **D-novo-RECONCILIACAO-CONTABIL-CRON P2** (M41) — continua aberto
  pós-M42; cron re-tenta `PAGO_CREDITO_PENDENTE`.
- **Caminho de ativação produção do saque colaborador comum**
  (DESCONTO_FATURA apenas):
  ✅ parecer (16/06); ✅ Salvaguarda 1 (M42 — filtro origem);
  ✅ Salvaguarda 4 (M41 — `PENDENTE_APROVACAO_COOP` obrigatório);
  ✅ Salvaguarda 5 (M42 — disclaimer versionado);
  ⏳ D-novo-THROTTLER-APP-GUARD P1; ⏳ D-novo-RECONCILIACAO-
  CONTABIL-CRON P2; ⏳ parecer escrito do
  `cooperebr-analista-conformidade` confirmando +
  `SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true`.
  S2 (ata assembleia) + S3 (parecer trabalhista) são **ações
  legais do Luciano**, NÃO sprint de código — só viram código
  futuro se Luciano expandir a whitelist do filtro pra incluir
  BONIFICACAO_ADMIN (após ata) ou tokens de empresa conveniada
  (após parecer trabalhista).

**Próximo passo único e claro:** Luciano decide — D-QUALIF-DECAY
(decaimento qualificação, ~6-10h, próxima da fila padrão) OU
sprint hardening de segurança (D-novo-THROTTLER-APP-GUARD +
D-novo-RECONCILIACAO-CONTABIL-CRON) — destrava ativação produção
do saque DESCONTO_FATURA.

**Frase de retomada COMANDANTE** ver `## FRASE DE RETOMADA — próxima
sessão Code` no fim deste documento.

Detalhe: `docs/sessoes/2026-06-17-m42-d2.1-filtro-origem-disclaimer-versionado.md`.

---

## ONDE PARAMOS — 2026-06-16 (Code — D2.1 EM PROGRESSO, sessão PAUSADA — Salvaguardas 1+5 com disclaimer VERSIONADO; falta Bloco 6 + reviewers + merge M42)

**Sessão Code dedicada — D2.1 NÃO É MARCO (incompleta).** Salvaguardas 1
+ 5 do parecer `docs/relatorios/analise-conformidade-2026-06-16-saque-
colaborador-d2.md` foram CONSTRUÍDAS, com mudança de escopo importante: o
disclaimer deixou de ser constante hardcoded `DISCLAIMER_VERSAO_ATUAL` e
virou ENTIDADE EDITÁVEL E VERSIONADA (`DisclaimerSaque`) com histórico
imutável, override do tenant > global SISGD, vínculo autoritativo via FK
no recibo.

**WIP commit em branch `feature/d2-salvaguardas-origem` (`c3e14fb`)** —
pushed no origin como backup. **NÃO MERGEAR em main** até completar
Bloco (6) smoke + 3 reviewers + re-review do orquestrador.

Trabalho feito nesta sessão (em 3 commits na feature branch):

1. **Schema (a)** `37069d5` — campos de aceite em `ResgateRecibo` (v1
   hardcoded).
2. **Backend (b)** `a6fb0ee` — Guard 1.5 filtro de origem + Guard 1.6
   disclaimer v1 hardcoded + 14 specs.
3. **Refactor v2 (Blocos 1+2+3+4+5)** `c3e14fb`:
   - Schema `DisclaimerSaque` (global default + override tenant +
     histórico imutável) + FK em `ResgateRecibo` + back-relation
     `Cooperativa.disclaimersSaque`. `prisma db push` aplicado.
   - `DisclaimerSaqueService` + Module + 6 endpoints (cooperado +
     SUPER_ADMIN global + ADMIN tenant) + Guard 1.6 refactor FK-based
     com anti-staleness + seed v1 idempotente.
   - 327/327 specs pass em 22 suites (refactor D2.1 + D2 antigos +
     15 novos de `disclaimer-saque.service.spec.ts`).
   - 3 telas: `/portal/resgatar-tokens` (texto dinâmico + checkbox +
     FK no POST + retry anti-staleness), `/dashboard/super-admin/
     disclaimer-saque` (SUPER global editor + histórico), `/dashboard/
     configuracoes/disclaimer-saque` (ADMIN tenant editor + histórico +
     desativar override). Sidebar wiring 2 itens novos.

Bug operacional catalogado: **NestJS DI fallback no inline type-only
import** — `private x?: import('...').X` no construtor erasa o tipo
runtime e o NestJS recebe `Object` como token, estourando
UnknownDependenciesException. Fix: top-level import.

**FALTA pra fechar M42 — Filtro de Origem + Disclaimer Versionado:**

- **Bloco (6)** smoke E2E versionado (SUPER cria global → cooperado
  aceita FK v2 → ADMIN cria override → versão antiga rejected mas recibo
  antigo recupera texto via FK) — 8 passos roteirizados no
  `docs/sessoes/2026-06-16-d2.1-em-progresso.md`.
- **3 reviewers pesados** pré-push: `cooperebr-financeiro-token-reviewer`
  + `cooperebr-multitenant-reviewer` + `security-reviewer`.
- **Re-review** pelo `cooperebr-orquestrador` (cadeia final + autoriza
  merge).
- **Push + merge `--no-ff`** da feature branch em main + fechamento
  canônico M42.

**Frase de retomada COMANDANTE pra próximo Code:** ver `## FRASE DE
RETOMADA — próxima sessão Code` no fim deste documento (linha ~2604).
Aponta pra retomar D2.1: `git checkout feature/d2-salvaguardas-origem`,
rodar Bloco (6) smoke + 3 reviewers + re-review do orquestrador, depois
push/merge/fechamento M42. Schema WIP continua aplicado no banco dev
(NÃO rodar `db push` na retomada).

Detalhe: `docs/sessoes/2026-06-16-d2.1-em-progresso.md`.

---

## ONDE PARAMOS — 2026-06-16 (Code — M41 Saque PIX Colaborador Comum + D-RESGATE-PIX-SEM-CAIXA P1 fechado)

**Sessão Code maratona.** Sprint D2 entregue ponta-a-ponta em 7 commits + 1 merge `--no-ff` no main (`b622a87`):

1. **Schema (a)** delta aditivo `Cooperativa.saqueColaboradorAtivo Boolean @default(false)` + `saqueColaboradorAtivadoEm`.
2. **Backend (b)** gate dual em `solicitarResgate:2031` (flag tenant `Cooperativa.saqueColaboradorAtivo` + env `SAQUE_COLABORADOR_PRODUCAO_LIBERADO`, espelha gate oxidação) + endpoints SUPER_ADMIN `/saas/cooperativas/:id/saque-colaborador` (GET status + PATCH toggle idempotente com AuditLog) + 15 specs.
3. **Contábil (c) — FECHA D-novo-RESGATE-PIX-SEM-CAIXA P1** catalogado M40: novo `lancarResgatePix` em `token-contabil.service.ts` cria `LancamentoCaixa D Passivo (5.1.02) / C Caixa` pós-tx Serializable conforme FUNDACAO §2.1. Idempotente via `findFirst` guard. Falha contábil → status `PAGO_CREDITO_PENDENTE` + evento `cooper-token-resgate.credito-pendente` (espelha F2 `compra-pj.credito-pendente` — princípio "nenhuma saída de caixa silenciosa", re-review orquestrador).
4. **Frontend (d)** `/cooperados/meu-perfil` estendido + cards condicionais em `/portal/tokens` e `/portal/resgatar-tokens` (`ehEstabelecimento OR saqueColaboradorAtivo`) + UI super-admin `/dashboard/super-admin/saque-colaborador` com banner âmbar + link sidebar.
5. **Smoke (e) PASS 16/16** contra `localhost:3000` — colaborador comum solicita → admin aprova → SIMULATED PIX-out → webhook TRANSFER_DONE → ★ LancamentoCaixa D Passivo/C Caixa criado ★, cleanup idempotente.
6. **3 reviewers pesados (financeiro-token + multitenant + security)** → 0 P0/P1 abertos, **4 P1 + 5 P2 aplicados** (DTO @IsBoolean, referenciaId obrigatório, removido tx enganoso, schema doc PAGO_CREDITO_PENDENTE, assertSameTenantOrSuperAdmin, cooperativaIdEsperada obrigatório, arredondamento monetário, `.env.example` documentado).
7. **Re-review orquestrador**: 1 P1 residual fechado (alerta evento `credito-pendente` espelha F2) + **D-novo-RECONCILIACAO-CONTABIL-CRON P2 catalogado** (re-tenta resgates `PAGO_CREDITO_PENDENTE`).

**Total: 60/60 specs verde + smoke E2E 16/16 PASS + build NestJS/Next.js verde.**

**Invariante FUNDACAO §4#1** (Passivo == Σ saldos × face):
- ✅ Caminho feliz: atômico observável.
- ⚠️ Falha contábil rara: degradado e CONSULTÁVEL via `PAGO_CREDITO_PENDENTE` + evento alerta. Auto-heal pendente do cron catalogado.

**Próximo passo único e claro:** **Sprint D-QUALIF-DECAY** (Decaimento da Qualificação — espelha oxidação do token; rebaixamento por inatividade; métrica uso+indicações; admin pondera). ~6-10h. Catalogado em `debitos-tecnicos.md`.

**Carry-over crítico pra ativação produção D2:** D-novo-RECONCILIACAO-CONTABIL-CRON P2 + parecer escrito do `cooperebr-analista-conformidade` antes de setar `SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true`.

**Detalhe:** `docs/sessoes/2026-06-16-m41-saque-pix-colaborador.md`.

---

## ONDE PARAMOS — 2026-06-16 (Code — M40 Abrir Cadastros SISGD + análise circuito emissão token)

**Sessão Code de dia inteiro.** 2 eixos paralelos:

1. **Sprint "Abrir Cadastros — Teste SISGD" ENTREGUE** em 4 commits + 1 merge `--no-ff` no main (`1634c11`). Convênio `CV-SISGD-TESTE-001` pronto pra turma de teste interna validar onboarding antes da Santi/Triad. Smoke E2E 10/10 verde (convite OTP → cadastro → empresa aprova → admin aprova → MEMBRO_ATIVO). Convergiu pro convênio pré-existente (08/06) — não criou duplicata; órfãos da v1 desativados (status=ENCERRADO, NUNCA deletados). `cooperebr-multitenant-reviewer`: 0 P0/P1 + 4 P3 aplicados (defense in depth). Bloco (b)/(c) cancelados durante Fase 1: `MembrosPendentesSection` já estava plugado em ambas detail pages desde 03/06.

2. **Análise read-only circuito emissão token** (4 agentes Cowork+claude.ai 15/06, 5283L) captura no main (`0371185` — `ANALISE-/FLUXO-/GAP-MAP-`). **3 decisões de produto FECHADAS + 1 nova rotulação:** D1 arrendamento ✅ Opção A nada a construir; **D2 saque PIX colaborador → CONSTRUIR com toggle** (reusa F6 ~70% pronto); **D-QUALIF-DECAY decaimento da qualificação → CONSTRUIR** (espelha oxidação do token — rotulado D3 no fechamento M40 por engano; D3 oficial = preço custo×venda do token continua **ABERTA**, bloqueia Fase 1 contábil do Circuito de Emissão Completo); D4 oxidação ✅ JÁ EXISTENTE (`aplicarOxidacao:3006` + cron + gate). **10 débitos novos catalogados** (2 P1 + 7 P2 + 1 P3). Correções de percepção: telas de aprovação existem; tier do convênio valida; reavaliação existe (só não rebaixava — D-QUALIF-DECAY resolve). **Disciplina de análise catalogada no CLAUDE.md** + `docs/FUNDACAO-COOPERTOKEN-MODELO-CANONICO.md` vira pré-requisito de leitura pra qualquer sprint que toque token.

**Próximo passo único e claro:** **Sprint D2 — Saque PIX colaborador comum** (~6-10h, reusa F6 do M34/M35) **+ fechar de carona D-novo-RESGATE-PIX-SEM-CAIXA** (P1 catalogado M40 — implementar `D Passivo / C Caixa` conforme FUNDACAO §2.1). Em paralelo/depois **Sprint Decaimento Qualificação** (D-QUALIF-DECAY, ~6-10h). DEPOIS dos 2: **Sprint "Circuito de Emissão Completo" (4 fases — contábil → notificações → emissão unificada → compra conveniado + auto-distribuição)**.

**Detalhe:** `docs/sessoes/2026-06-16-m40-abrir-cadastros-sisgd-teste.md`.

---

## ONDE PARAMOS — 2026-06-17 (Code — Fase 1 read-only Sprint "Abrir Cadastros — Teste SISGD")

**Sessão Code curta de planejamento (sem implementação).** Entregou em paralelo:

1. **Fase 1.5 read-only — Concierge × Rotinas Decisórias Aprendidas** (relatório no chat, território Cowork não tocado). Cruzou 8 detectores + funil WA + schema Prisma + memórias 12.r19a. Achados: `ConciergeWaService` está desplugado em runtime (não está em `concierge.module.ts` providers); bot WA principal não conhece Concierge; `cooperebr-orquestrador.md` ainda não foi atualizado pra consultar rotinas; conflito C7 PlanoSaas×Concierge à la carte segue aberto. 3 rotinas-candidatas priorizadas (Tese 3 PIS/COFINS-SCEE, Conformidade Segregada, Validação Convênio Token Voucher).
2. **Fase 1 read-only — Sprint "Abrir Cadastros — Teste SISGD"**. Confirmou que onboarding está ~85% pronto (wizard `/cadastro` + convite OTP + state machine `PENDENTE_APROVACAO_EMPRESA→ADMIN→MEMBRO_ATIVO` + MembroBuilder + Santi seedada). Identificou 3 gaps reais: (i) seed `scripts/seed-sisgd-teste-interno.ts` (não existe), (ii) tela `/conveniada/convenio/[id]/membros` (não existe), (iii) tela `/dashboard/convenios/[id]/membros-pendentes` (não existe). Descoberta: `web/app/aprovacao-membro/[token]/` já existe (UI pública magic link da empresa pronta — não refazer).

**Branch `feature/abrir-cadastros-sisgd-teste`** criada vazia, aguardando OK em 4 perguntas decisórias antes da Fase 2 (~9-12h).

**Working tree:** 8 M selados do Cowork (`backend/src/concierge/*` + `package.json/lock` + `concierge.service.spec.ts`) — território Cowork, Code NÃO toca, próximo fechamento Cowork limpa.

**Próximo passo único e claro:** **Fase 2 do Sprint "Abrir Cadastros — Teste SISGD"** após Luciano responder as 4 perguntas decisórias listadas na frase de retomada (modo criação pagador SISGD, senha Supabase, rota da tela admin, UX do "solicitar documento").

**Detalhe:** `docs/sessoes/2026-06-17-fase1-abrir-cadastros-sisgd-teste.md`.

---

## ONDE PARAMOS — 2026-06-16 (Code — M39 Emissão Admin em Lote + Estorno COMPLETO)

**Sessão Code maratona.** Sprint M39 entregue ponta-a-ponta em 12 commits + 1 merge `--no-ff` no main (`d1f6a6d`):

1. **Backend (Blocos 1-3)** — schema delta aditivo (2 enums + conta `5.1.03`) + 4 métodos service (`emitirLoteAdmin`, `estornarEmissaoLote`, `listarLotesEmitidos`, `getLoteEmitido`) + 2 templates contábeis (`lancarEmissaoAdminLote` / `lancarEstornoEmissaoAdminLote`) com **bypass do evento contábil errado**. Anti-IDOR via re-validação server-side de cada `cooperadoId.cooperativaId`. Idempotência via helper `executarMassWrite` + tier ALTO sobre TOTAL com 1 OTP único. 4 endpoints REST.
2. **Specs (Bloco 4)** — 20 specs M39 + 5 specs P3 anti-regressão + 1 spec P1-B guard de integridade = **311/311 verde** (cooper-token 286 + mass-write 25, zero regressão).
3. **Frontend (Blocos 5-6)** — `/dashboard/cooper-token/enviar` redesenhado (2 etapas + filtro convênio + sem GET saldo + prévia COMPLETA antes do OTP) + tela nova `/dashboard/cooper-token/lotes-emitidos` (modal estorno + confirmação dupla + motivo ≥10 chars).
4. **Bloco 7** — `@deprecated` em `enviarTokensAdmin` (mantido por COMPAT do ramo cooperado→cooperado).
5. **Bloco 8** — D-novo-EMISSAO-ADMIN-CONTABIL P2 catalogado + MAPA-INTEGRIDADE atualizado.
6. **Bloco 9** — 2 rodadas reviewers pesados + re-review orquestrador (2 P1 residuais fechados) + smoke E2E real PASS 6/6 (1 token + estorno imediato, NUNCA emissão real Santi — saldo retornou EXATAMENTE 1.96 → 1.96).

**Próximo passo único e claro:** a definir pelo Luciano — opções consideradas:
1. **Sprint contábil dedicada** (resolve D-novo-EMISSAO-ADMIN-CONTABIL P2) — depende de D3 Modelo C.
2. **Decisões D1-D4 Modelo C** (relatórios 15/06: D1 arrendamento / D2 cash-out / D3 preço custo×venda / D4 validade token).
3. **Sprint Hardening Mass-Write SUPER_ADMIN P2** (enfileirado M35) — reusa helper executarMassWrite (M39 é precedente arquitetural).

**Detalhe:** `docs/sessoes/2026-06-16-m39-emissao-admin-em-lote.md`.

---

## ONDE PARAMOS — 2026-06-15 (Code — M38 Fatia A v2 + Fix Santi 403 + Portal Conveniada)

**Sessão Code maratona.** Marco M38 entregue em 11 commits trabalho + 3 merges `--no-ff` no main (`821a9dd..87ae6f7`):

1. **Fatia A v2** (Sprint Clube Unificado P1) — nomenclatura CTK→CooperTokens em 12 spots de 6 telas + botão "Voltar ao Clube" em 11 telas-filhas do hub. Branch `feature/fatia-a` v1 ficou STALE atravessando Sprint Higiene de Rotas (M37) → descartada.
2. **Track B — Fix Santi 403** (blocker prod) — guard de distribuição de tokens (`cooper-token.service.ts:1369/1782`) usava `conveniadoId` legado em vez de `pagadorCooperadoId` (D-FISCAL-2.4.1 Caso 1). Schema marca legado + specs F3 alinhados + smoke E2E 2/2 PASS.
3. **Track B.2 — Portal Conveniada** — `meusConvenios + dashboardConveniado` (`convenios.service.ts:511-538`) aceitam pagador OU representante via `OR` + `cooperativaId` explícito (reviewer P1 corrigido pré-merge). Smoke E2E 3/3 PASS (lista + dashboard + anti-IDOR).

**Próximo passo único e claro:** **Redesenho da tela `/dashboard/cooper-token/enviar`** (não cosmético) em `feature/admin-emitir-lote` — Fase 1 read-only iniciada, aguarda 3 decisões Luciano antes de codar. Cruzar com 3 relatórios da sessão paralela (`ANALISE-/GAP-MAP-/FLUXO-` 2026-06-15) sobre Modelo C convênio + contábil token-passivo.

**Detalhe:** `docs/sessoes/2026-06-15-m38-fatia-a-v2-fix-santi-403-e-portal.md`.

---

## ONDE PARAMOS — 2026-06-14 noite (Code — M37 Sprint Higiene de Rotas COMPLETO: Blocos A+B+C+D+E + D-1171 fechado)

**Sessão Code maratona.** Sprint Higiene de Rotas fechado ponta-a-ponta em 4 commits trabalho + 1 commit débito + 1 merge `--no-ff` (`f85483f`). Convergência `/parceiro` → `/dashboard` finalizada (19 telas-fantasma deletadas + 33 redirects 301), área `/estabelecimento` criada com guard `ehEstabelecimento`, op admin "Enviar Tokens" reposicionada no hub Clube, labels renomeados pra distinguir super-admin vs admin do parceiro. P1 anti-IDOR fixado em `meuPerfil`. Smoke 7 redirects + permissões admin_parceiro validadas. Carona M36 Cowork (pipeline IMAP/OCR + Concierge EDP_ES/CEMIG) mergeada junto, ressalva SSL catalogada. **D-1171 FECHADO.**

**Frase de retomada COMANDANTE pra próximo Code:** ver `## FRASE DE RETOMADA — próxima sessão Code` no fim deste documento (linha ~2476). Aponta pra **Fatia A v2 — CTK → CooperToken nomenclatura UI** (re-feita em branch nova `feature/fatia-a-v2`; a antiga `feature/fatia-a` ficou STALE atravessando a Sprint Higiene que moveu/deletou os arquivos, NÃO MERGEAR — ressuscita zumbis `/parceiro/*`). **12 ocorrências de `\bCTK\b` em 6 arquivos** mapeadas no main pós-Higiene: `conveniada/.../distribuir-tokens` (3), `estabelecimento/{receber,recebimentos,validar}` (5), `dashboard/cooper-token/enviar` (3), `dashboard/cooper-token-parceiro` (1). **Lição catalogada:** não deixar branch pronta parada atravessando refactor estrutural — mergear na hora OU rebasear antes que envelheça.

**Detalhe:** `docs/sessoes/2026-06-14-higiene-rotas-blocos-B-E.md`.

---

## ONDE PARAMOS — 2026-06-18 noite (Cowork — M39: Refutação Relatório Externo + Parecer V2 + Sumário V2)

**Sessão Cowork crítica de análise e contra-argumentação.** Disparada quando Luciano recebeu relatório externo "SISGD-Concierge v1.1" propondo recalibração radical do parecer 15/06 — reduzindo portfólio a 1 tese tributária (Tese 2) + 1 tese regulatória (duplo custeio) + alertas Lucro Real, com perda potencial de R$ 596k em 60m+SELIC mapeado.

**Análise sistemática em 3 blocos**:

- **Bloco A — 6 contribuições válidas INCORPORADAS via patches P-01..P-06**:
  - P-01: ADI 7.195/DF (suspensão liminar LC 87/96 art. 3º X) rebaixa Teses 2 e 6 pra **Médio-Alto** (de Sólido)
  - P-02: ADIs FCP 7.077/7.634/7.716 como **reforço sistêmico**, não fundamento direto (modulação pro-Fisco 1º.01.2027)
  - P-03: Tese 6 **segregada por perfil**: geradoras (ato cooperativo + Lei GERAR) × consumidores (distinguishing Tema 986)
  - P-04: Tema 986/STJ tratado como **distinguishing técnico-fático consolidado** (TJ-MT, TJ-RJ, TJ-SP), não "ressalva expressa do dispositivo"
  - P-05: **Tese 11 (Duplo Custeio Regulatório TUSD-G + Fio B na GD III)** ACRESCIDA em PARALELO via consulta ANEEL → ACP federal
  - P-06: **Anexo Procedimental I** (Checklist de Validação Prévia) consolidado

- **Bloco B — 6 proposições excessivas REFUTADAS**:
  - B.1: Teses 9 e 10 NÃO são "artefato aritmético do gross-up descartável" — confusão entre plano da contabilidade interna (não-cumulatividade) × plano da incidência (CTN art. 97 IV exige LEI para alíquota repassada; STJ Tema 537 inverte ônus em favor do consumidor)
  - B.2: Duplo custeio NÃO substitui Teses 2/4/6 — planos distintos CUMULATIVOS (regulatório vs tributário)
  - B.3: CDE e Gross-Up NÃO são "expurgáveis" — são pedidos subsidiários (CPC art. 326)
  - B.4: Tese 6 NÃO pode ser afastada das ações-piloto — R$ 525.646 do [Cliente E] em 60m+SELIC = 39,3% do indébito mapeado
  - B.5: Fórmula "-3,99% prejuízo líquido cash" do Lucro Real DOGMATICAMENTE INCORRETA — cliente LR credita 9,25% sobre VALOR PAGO da fatura (insumo), não sobre o que EDP recolheu (5,26% após créditos internos); são operações INDEPENDENTES em planos distintos
  - B.6: Auto-titulação "SISGD v1.1" factualmente incorreta — plataforma oficial está em v1.0

- **Bloco C — Análise das motivações implícitas**: relatório direciona produto para 1-2 teses simplificadas (favorece codificação técnica simples + foco ANEEL fora do tributário + mitigação reputacional excessiva), mas a custo de R$ 596k de magnitude econômica do produto comercial.

**3 documentos NOVOS emitidos, todos preservando arquivos antigos intactos**:
- `docs/concierge/pareceres/2026-06-18-refutacao-relatorio-sisgd-v1-1.md` (Refutação ponto a ponto)
- `docs/concierge/pareceres/2026-06-18-parecer-v2-patches-incorporacao.md` (Parecer v2 com 6 patches SUBSTITUIR/POR formais + Tese 11 completa)
- `docs/concierge/pareceres/2026-06-18-sumario-executivo-v2.md` (Sumário recalibrado)

**Documentos antigos PRESERVADOS**:
- Parecer 15/06 ✓ intacto
- Adendo Teses 9/10 + IX e X ✓ intacto
- Anexo Contábil ✓ intacto
- Sumário Executivo v1 (18/06 manhã) ✓ intacto
- Versão anonimizada LGPD ✓ intacto
- DOCX/PDF em OneDrive (88 pp + 92 pp) ✓ intactos

**Recalibração econômica final**:
- Indébito mensal: **R$ 17.923,94** (mantido + Tese 11 a apurar)
- 60m+SELIC: **R$ 1.344.522** (mantido)
- Recuperação realista: **R$ 350.000 — R$ 460.320** (recalibrada de R$ 460.320 por causa da ADI 7.195/DF)
- Portfólio: 10 teses tributárias + Tese 11 regulatória = **11 teses total**

**5 decisões D18/06-4..8 catalogadas**:
4. REJEIÇÃO substituição radical proposta pelo relatório externo
5. INCORPORAÇÃO dos 6 patches válidos
6. REFUTAÇÃO matemática da fórmula "-3,99%" do Lucro Real
7. Catalogação da Tese 11 (Duplo Custeio Regulatório) — natureza regulatória/civil, paralela às tributárias
8. PRESERVAÇÃO obrigatória das versões antigas em toda atualização incremental

**Frase de retomada COMANDANTE pra próxima Code/Cowork:**

> "Encaminhar pacote consolidado (parecer 15/06 + Refutação 18/06 noite + Parecer V2 18/06 noite + Sumário V2 18/06 noite + versão anonimizada LGPD) ao advogado tributarista parceiro com NDA assinada, solicitando manifestação técnica formal antes do ajuizamento. Em paralelo, apurar magnitude financeira efetiva da Tese 11 (Duplo Custeio Regulatório) cruzando faturas das CUSDs I+II com faturas dos cooperados associados. Em paralelo, implementar Tese 9 e Tese 10 como detectores algorítmicos: criar `backend/src/concierge/detectores/detector-tese9-anti-isonomia.ts` e `detector-tese10-variabilidade-temporal.ts`. Solicitar EFD-Contribuições de [Cliente E] EXFISHES e [Parceiro F] — pode anular Tese 3 em milhões. Multi-adapter pendente do 14/06 (17 ELFSM parse falhou)."

**Detalhe**: `docs/sessoes/2026-06-18-noite-refutacao-relatorio-externo-parecer-v2.md`

---

## ONDE PARAMOS — 2026-06-18 (Cowork — M38: Finalização Parecer Concierge + DOCX/PDF + Versão Anonimizada LGPD)

**Sessão Cowork de empacotamento e entrega final.** Entregou:

- **Sumário Executivo** (3 pp) — `docs/concierge/pareceres/2026-06-18-sumario-executivo.md`
- **Versão IDENTIFICADA** consolidada — `PARECER-CONCIERGE-COOPEREBR-FINAL.docx/.pdf` (88 pp, 50k palavras, capa + sumário + 4 partes) no OneDrive
- **Versão ANONIMIZADA LGPD** — `PARECER-CONCIERGE-ANONIMIZADO-LGPD.docx/.pdf` (92 pp com Aviso LGPD formal de 2 pp + 15 categorias de dados anonimizados) no OneDrive
- **Fonte MD anonimizada** commitada (reproduzível) — `docs/concierge/pareceres/2026-06-18-parecer-anonimizado-lgpd.md`
- Pipeline: Markdown master → Pandoc DOCX → LibreOffice PDF; anonimização via script Python com 80+ regex em 3 passes; reconciliação zero ocorrências residuais de nomes/CPFs/CNPJs/endereços/emails

**3 decisões D18/06-1..3 catalogadas:**
1. Estratégia de 2 pareceres em paralelo (identificada + anonimizada)
2. Binários DOCX/PDF ficam no OneDrive, fonte MD no Git
3. Anonimização preserva cidade/UF/concessionária (necessários à jurisdição/info pública)

**Frase de retomada COMANDANTE pra próxima Code/Cowork:**

> "Encaminhar `PARECER-CONCIERGE-COOPEREBR-FINAL.docx` (versão identificada) ao advogado tributarista parceiro com cover letter + NDA. Em paralelo, retomar a implementação dos detectores Tese 9 e Tese 10 no `DetectoresRegistry` (frase COMANDANTE original do 15/06): criar `backend/src/concierge/detectores/detector-tese9-anti-isonomia.ts` e `detector-tese10-variabilidade-temporal.ts`. Solicitar EFD-Contribuições dos clientes Lucro Real (provável [Cliente E] e [Parceiro F]) — pode anular Tese 3 em milhões. Multi-adapter pendente do 14/06 (17 ELFSM parse falhou)."

**Histórico de sessões Cowork anteriores:**

---

## ONDE PARAMOS — 2026-06-15 noite (Cowork — M37: Parecer Jurídico Tributário + Teses 9 e 10 + Detector DNU + Seções IX e X)

**Sessão Cowork maratona ~10h.** Entregou pacote técnico-jurídico massivo:

- **Detector Demanda Não Utilizada (DNU)** implementado no Concierge (8 detectores ativos)
- **Refinamento Tese 4 GERAR** (filtro `ehUsina` exigindo rubrica TUSD_G — só geradoras)
- **11 faturas validadas** (Sinergia + CUSDs CoopereBR I+II + EXFISHES + 7 outras): R$ 25.122/mês = **R$ 1.884.153 em 60m+SELIC** mapeados
- **Parecer jurídico-tributário formal** (16k palavras) em `docs/concierge/pareceres/2026-06-15-parecer-tecnico-tributario-completo.md`
- **Descoberta crítica do Luciano** via 4 faturas suas: alíquotas PIS/COFINS variando mês-a-mês (DEZ/25: 4,90% → FEV/26: 7,07% → MAR/26: 6,40% → ABR/26: 5,26%) — provoca DUAS teses novas
- **Tese 9 (anti-isonomia inter-cliente)** + **Tese 10 (variabilidade temporal)** catalogadas
- **Adendo extenso ao parecer** (~20k palavras) em `docs/concierge/pareceres/2026-06-15-adendo-tese9-aliquotas-pis-cofins.md` com:
  - Seções I-VI: Tese 9
  - Seção VII-bis: Unificação UCs Geradoras como Bloco
  - Seção VII-ter: Tese 10 (variabilidade temporal)
  - Seção IX: Cumulatividade + 3 cenários (PF / Lucro Presumido / Lucro Real)
  - Seção X: Legitimidade ativa individualizada por tese + estratégia 5 ações
- **Insight estratégico decisivo**: Cliente Lucro Real (EXFISHES, Sinergia provável) pode PERDER ganhando Tese 3 (estorno de crédito 9,25%) — análise EFD-Contribuições obrigatória antes de ajuizar
- **Configuração processual ótima** definida: 5 ações (2 estaduais ICMS + 2 federais PIS/COFINS + 1 coletiva)
- **Recuperação esperada**: R$ 297k (PF/LP — limpa) até R$ 822k (contingente LR após auditoria)

**6 decisões D15/06-1..6 catalogadas.**

**Frase de retomada COMANDANTE pra próxima Code/Cowork:**

> "Próximo passo: implementar Tese 9 e Tese 10 como detectores algorítmicos no `DetectoresRegistry`. Criar `backend/src/concierge/detectores/detector-tese9-anti-isonomia.ts` (compara alíquota da fatura vs mediana do grupo tarifário/distribuidora — gatilho desvio > 0,5%) e `detector-tese10-variabilidade-temporal.ts` (compara série histórica de alíquotas do mesmo cooperado — dispara se variação > 0,5% entre meses consecutivos sem alteração legislativa). Adicionar códigos `TESE_9_ANTI_ISONOMIA_PIS_COFINS` e `TESE_10_VARIABILIDADE_TEMPORAL` em `detectores.types.ts`. Registrar no module + registry. Em paralelo: solicitar EFD-Contribuições da EXFISHES e Sinergia pra determinar regime (LR ou LP) — pode anular Tese 3 R$ 711k da EXFISHES se confirmado creditamento integral. Multi-adapter ainda pendente do dia 14 (17 ELFSM parse falhou em `processar-pasta-pdfs-concierge.ts`). Gerar DOCX consolidado parecer+adendo via skill `docx`."

**Histórico de sessões Cowork anteriores:**

---

## ONDE PARAMOS — 2026-06-14 noite (Cowork — M36 completo: Pipeline OCR + Bug Tese 3 + 3 detectores novos + R$ 636k mapeado)

**Sessão Cowork maratona ~7h (manhã+tarde+noite).** Entregou:
- Pipeline IMAP→OCR destravado (Kaspersky/SSL workaround) — universo 9→48
- **Bug P1 detector Tese 3** descoberto via pergunta do Luciano ("e a cobrança de PIS/COFINS sobre energia compensada?") e corrigido com patch `base-declarada-fallback` em `detector-tese3-pis-sobre-scee.ts` — caso Luciano R$ 0 → **R$ 57,98/mês**
- **3 detectores novos** (Tese 4 GERAR + CDE Escassez Hídrica + ICMS Gross-Up) + refinamento Luciano filtrando Tese 4 só pra UCs geradoras (TUSD_G presente)
- **47 PDFs processados** (pasta ex_clientes + atuais): **R$ 5.959/mês = R$ 446.933 em 60m+SELIC**. Top: boa praça R$ 2.541, LOJA 09 R$ 744, LOJA 10 R$ 692. **Ex-clientes valem 4× mais que atuais.**
- 6 faturas analisadas individualmente: Consorcio Sinergia Ambiental (parceiro CoopereBR + cliente SISGD) com R$ 1.669/mês = R$ 125k em 60m
- Modelo CEMIG/MG catalogado (conformidade)
- Bug cadastro detectado: Leonardo Capucho com fatura EXFISHES (R$ 2.077/mês)

**TOTAL CATALOGADO: ~R$ 8.485/mês = R$ 636.369 em 60m+SELIC.**

**Frase de retomada COMANDANTE pra próximo Code:**

> "Próximo passo: Multi-adapter no script `processar-pasta-pdfs-concierge.ts` — substituir `EdpEsFaturaAdapter` por `FaturaAdapterRegistry.resolver(distribuidora)` pra destravar os 17 parse-falhou da pasta (principalmente ELFSM — instalações 590xxx/ESCE_BT). Pode destravar R$ 100-200k de indébito adicional. Em paralelo: implementar `detector-demanda-nao-utilizada.ts` (vista no Consorcio Sinergia: R$ 418,33 PIS/COFINS sobre Demanda Não Utilizada com base ICMS=0 — jurisprudência ANEEL/STJ favorável). Smoke E2E: rodar `processar-pasta-pdfs-concierge.ts --pasta=...` novamente, esperar todos 47 OK com indébito total > R$ 7k/mês."

**Histórico de sessões Cowork anteriores:**

---

## ONDE PARAMOS — 2026-06-14 tarde (Cowork — M36 Pipeline IMAP→OCR DESTRAVADO + Caso Luciano Concierge EDP_ES + Modelo CEMIG/MG)

**Sessão Cowork maratona ~5h tarde.** Destravou pipeline IMAP→OCR (parado 6 meses), processou 37 novas FaturaProcessada (universo 9→48), identificou Luciano como cooperado real com indébito estimado ~R$ 154/mês (~R$ 11.340 em 60m+SELIC), catalogou modelo CEMIG/MG (conformidade), revelou 5 débitos técnicos.

**Frase de retomada COMANDANTE pra próximo Code:**

> "Próximo passo: re-OCR detalhado da fatura do Luciano (cooperado `cmn0dsc4w005guols56peyc5h`, fatura `cmn80wrvf0001uo9cizpo5f9d`, arquivo Supabase storage) com prompt Anthropic Concierge-específico extraindo rubricas linha-a-linha (TUSD/TE/ICMS por linha/PIS+COFINS por linha) pra rodar `DetectoresRegistry.detectarTodos` e obter cálculo Tema 69 + Tese 3 + Tese 6 EXATO (não estimativa ±30%). Criar `backend/src/concierge/concierge-ocr.service.ts` separado do `faturas.service.ts` (decisão D14/06-2: Concierge precisa adapter próprio de OCR/parse). Validar contra `edp-es.adapter.ts` existente. Smoke E2E: input = arquivoUrl da fatura Luciano + output = `ResultadoConsolidadoDetectores` com 3 padrões detectados e valores R$ exatos."

**Histórico de sessões Cowork anteriores:**

---

## ONDE PARAMOS — 2026-06-13/14 (Code — M35 Sprint Clube P1 F6 Resgate em R$ via PIX COMPLETO: Bloco C + C.4 + C.5)

**Sessão Code maratona 13/06 noite + 14/06 manhã.** F6 fechado ponta-a-ponta: backend C.4 + frontend portal estabelecimento + frontend admin + sidebar + 2 rodadas reviewers pesados + re-review independente do orquestrador + smoke E2E real com webhook ligado.

**8 commits trabalho** (+ 1 commit fechamento):

| Hash | Tipo | Marco |
|---|---|---|
| `27b5e24` | feat | **C.0** cadastro PIX com PIN (REFORÇO ANTI-FRAUDE) + AuditLog mascarado + tela `/portal/seguranca/dados-bancarios` |
| `eb94494` | feat | **C.1** UI portal `/portal/resgatar-tokens` + `GET /cooper-token/empresa/meus-resgates` anti-IDOR |
| `a23cb2f` | feat | **C.2** card condicional "Resgatar em R$ via PIX" em `/portal/tokens` (ehEstabelecimento) |
| `335e7ff` | feat | **C.3** UI Admin `/dashboard/cooper-token/resgates-pendentes` + banner anti-fraude + sidebar |
| `b397b35` | fix | **C.4 P0-A** IDOR chave PIX — `updateMany` + `cooperativaId` (push isolado cirúrgico via branch hotfix) |
| `03c66ba` | feat | **C.4 P0-B** webhook TRANSFER_* + auth cross-tenant + listener `cooper-token-resgate.listener` |
| `5ab05fc` | fix | **C.4 P1+P2** F6-2/F6-3/F6-5/MT + mascarar/CAS tenant/tx Serializable PAGO/fuso SP |
| `9372c89` | fix | **C.4 pós-re-review** saldoApos + janela diária burlável + listener double-check tenant + 2 débitos catalogados |
| `2459245` | fix | **C.5** GAP-1 webhook FAILED em tx Serializable única (re-review orquestrador) + GAP-2 saldoApos estorno total + smoke 29/29 PASS |
| `<próximo>` | docs | fechamento M35 (esta sessão) |

**Push status:** TODOS pushed em origin/main (alguns embarcaram via push da Cowork — 4ª violação de disciplina catalogada). Janela do P1 GAP-1 em produção fechada com push do C.5 (`2459245`).

**Em curso:** —

**Próximo passo único e claro:** **Sprint Clube P1 — Fatia A (CTK → CooperToken nomenclatura)** em **branch `feature/fatia-a` desde o 1º commit** (decisão Luciano 13/06 — fim do gate furado após 4 violações documentadas de push em sessões paralelas). Escopo: refator nomenclatura `CTK` → `CooperToken` em todas as superfícies UI (cards saldo, badges, tooltips, mensagens) + dois rios kWh×token visivelmente separados na UI (energia ≠ benefício). Sem mudança de schema — puro UI/labels. Fase 1 read-only mapeia `\bCTK\b` em `web/app/**/*.tsx` antes de tocar código.

**3 REFORÇOS Luciano materializados no F6:**
1. PIN obrigatório pra trocar chave PIX (`PinCooperadoService.validarPinComLockout` fora da tx) — chave é âncora financeira do resgate
2. Banner amber no Dialog admin se `pixUltimaAlteracaoEm` < 24h ANTES do `createdAt` do recibo — fecha vetor sessão-sequestrada→redireciona-PIX
3. Compare-and-swap em TODAS transições + estorno auditável NUNCA apaga + webhook idempotente

**Suite final:** 349/349 verdes (24 suites cooper-token + meu-perfil + asaas + asaas-pix-out).

**Smoke E2E F6 C.4 (29/29 PASS):**
- Cenário 1 Golden TRANSFER_DONE → PAGO_RECIBO_EMITIDO + queima 10 tokens + ledger RESGATE_PIX + invariante conservada
- Cenário 2 Falha TRANSFER_FAILED → FALHA_PIX + estorno + ledger ESTORNO_RESGATE_PIX (NUNCA apaga) + invariante conservada
- Cenário 3 Idempotência webhook (eventId duplicado → skipped, sem duplicar)
- Cenário 4 Webhook forjado (sem/com token errado → 401 UnauthorizedException)
- Cenário 5 Limite diário (F6-3 inclui resgates no gasto — fix de burla 23h55→00h05)

**4ª violação documentada de disciplina de push em sessões paralelas:** Cowork rodou `git push` levando junto TODOS os meus commits C.1-C.4 segurados (sem checar `git log origin/main..HEAD` antes). Mesmo padrão das 3 violações anteriores. Decisão consequente: a partir da Fatia A, `feature/<fatia>` desde o 1º commit.

**Carry-overs M35 (não-bloqueantes):**
- D-novo-F6-RECONCILIACAO-CRON P2 catalogado (cron varrendo recibos parados em APROVADO_PIX_DISPARADO >30min)
- D-novo-MT-F2-F3-F4-LEGADO-UPDATE-COOPERADO P2 catalogado (12 pontos em F2/F3/F4 com update por cooperadoId sem tenant — não-IDOR ativo, mas "proteção por acidente do schema")
- D-novo-F6-ADMIN-FLAG-ESTAB P2 (sem UI pra ativar `ehEstabelecimento` — hoje via script de smoke)
- D-novo-ASAAS-WEBHOOK-AUTH ✅ RESOLVIDO de carona no C.4 P0-B
- Cowork preservada integralmente neste fechamento: 5 commits embarcados em origin/main (esqueleto WA C8 + landing 2 funis + Tese 6 orquestrador + dossiê EXFISHES + inventario ANEEL). Working tree `concierge.service.spec.ts` M é território Cowork — NÃO INCLUÍDO neste commit.

**Detalhe completo:** `docs/sessoes/2026-06-13-f6-resgate-pix-completo.md`.

---

## ONDE PARAMOS — 2026-06-12 (Code — M34 Sprint Clube P1 F6 Estabelecimento resgata tokens em R$ via PIX, Blocos A+B)

**Sessão Code maratona pós-M33 (continuação da mesma janela).**

**2 commits trabalho** (+ 1 fechamento):

| Hash | Tipo | Marco |
|---|---|---|
| `c5eee91` | feat | **F6 Bloco A** — schema delta voucher + `AsaasPixOutService` extraído + 18 specs |
| `b3251f5` | feat | **F6 Bloco B** — service resgate + 5 endpoints + DTOs + 34 specs |
| `<próximo>` | docs | fechamento M34 (esta sessão) |

**Push segurado** — `git log origin/main..HEAD` mostra 3 commits ahead até o push final pós-Bloco C + reviewers pesados + smoke E2E (instrução explícita Luciano no prompt do Bloco B: "Push segurado").

**Em curso:** —

**Próximo passo único e claro:** **F6 Bloco C (UI portal estabelecimento + UI admin de aprovação).** Endpoints prontos no backend; falta camada de interface — provavelmente `/conveniada/cooper-token/resgatar` (cooperado-estabelecimento solicita) + tela admin em `/dashboard/cooper-token/resgates-pendentes` (admin aprova/recusa). Aplicar padrão UI Tipo B do portal (página dedicada com guard + form + preview + estado). Após Bloco C: **reviewers pesados UMA vez** (`cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer` — o mais rigoroso de todos, dinheiro saindo). Depois **smoke E2E** sandbox + AMAGES com `ehEstabelecimento=true` + pixChave whitelisted. **Só então push**.

**3 REFORÇOS Luciano materializados (centro do Bloco B):**

1. **Compare-and-swap em TODAS transições** (5 pontos): `updateMany({where:{id, cooperativaId, status:'esperado'}}) → count===1`
   - aprovar: PENDENTE_APROVACAO_COOP → APROVADO_PIX_DISPARADO
   - recusar: PENDENTE → RECUSADO
   - cancelar: PENDENTE → CANCELADO
   - webhook PAGO: APROVADO → PAGO_RECIBO_EMITIDO
   - webhook FAILED: APROVADO → FALHA_PIX
   - CAS perde em qualquer um → BadRequest claro (admin/cooperado) OU skip silencioso (webhook)

2. **Estorno auditável NUNCA apaga** — `estornarResgateInterno` cria nova entry CREDITO `ESTORNO_RESGATE_PIX` no ledger preservando histórico; status pula pra RECUSADO/CANCELADO/FALHA_PIX. Tolera invariante reaplicada (log warn + skip se já estornado por outra via).

3. **Webhook idempotente** — `ultimoWebhookEventId` checado antes da transição; duplicado retorna `{skipped:'webhook-duplicado'}` sem reprocessar; primeiro eventId gravado na própria operação de swap (atomicidade).

**Ordem do fluxo respeitada:**
- PIN validado FORA da tx (`PinCooperadoService.validarPinComLockout` F2.3, lockout 30min)
- OTP cobrado só pra tier ALTO (valor>R$50, F4 — `OtpDesafioService.validarOuLancar` motivo `TOKEN_TRANSACAO_STEP_UP`)
- `assertLimite` sobre TOTAL (F2.5 ajuste 2 Luciano)
- Bloqueio do saldo DENTRO da tx Serializable (re-snapshot + conservação invariante disp+bloq constante)
- `numeroRecibo` gerado na mesma tx via counter sequencial humano POR COOPERATIVA (RES-2026-NNNNN, decisão Q3)
- Guard `ehEstabelecimento` + `pixChave` cadastrada ANTES de qualquer débito de bloqueio

**Anti-IDOR:** `cooperativaId` + `cooperadoId` SEMPRE do JWT; cross-tenant em idempotência retorna NotFound genérica; cancelar de outro cooperado retorna NotFound; PIN/OTP NUNCA logados.

**Endpoints expostos:**
- `POST /cooper-token/empresa/resgatar` @COOPERADO
- `POST /cooper-token/empresa/resgates/:id/cancelar` @COOPERADO
- `GET /cooper-token/admin/resgates-pendentes` @ADMIN+SUPER_ADMIN
- `POST /cooper-token/admin/resgates/:id/aprovar` @ADMIN+SUPER_ADMIN
- `POST /cooper-token/admin/resgates/:id/recusar` @ADMIN+SUPER_ADMIN

**Vocabulário inegociável** "resgate" / "liquidação" / "recibo" em todas as strings de log/mensagem/erro/UI (NUNCA "recompra" / "venda" — decisão circuito 04/06).

**Specs (34 cenários verdes em `cooper-token-f6-bloco-b.spec.ts`):**

- solicitarResgate guards (12)
- solicitarResgate idempotência + commit (5)
- aprovarResgate REFORÇO 3 (4)
- recusarResgate + cancelarResgate + estorno auditável (6)
- processarWebhookResgate REFORÇO 2 + REFORÇO 3 (5)
- listarResgatesPendentes (2)

**Regressão:** 296/296 verdes (18 suites cooper-token + mass-write + asaas-pix-out).

**Decisões registradas narrativamente** (sem memória persistente nova nesta sessão — as 8 Q1-Q8 + 3 REFORÇOS Luciano já estavam catalogadas no fechamento M33):
- Q1 idempotência `clientRequestId @unique` materializada em schema + guard solicitarResgate
- Q3 sequencial humano por cooperativa materializado em `ResgateReciboCounter` + `gerarNumeroRecibo` na tx
- Q6 cancelamento com compare-and-swap materializado em `cancelarResgate`
- Q8 `AsaasPixOutService` extraído de `pix-excedente.service.ts:132-157`

**Estado de fila (Decisão 24):**
1. M30 ✅ — Sprint Clube Unificado P1 (Hub + F1.5 Economia + Polimento MLM)
2. M31 ✅ — F2 Empresa-PJ compra tokens Asaas
3. M32 ✅ — F4 Cooperado-only completo (Blocos A→D + C.1 + C.2)
4. M33 ✅ — F3 Empresa distribui em LOTE/INDIVIDUAL (Blocos A+B+C+C.1)
5. **M34 ✅ — F6 Estabelecimento resgata em R$ via PIX (Blocos A+B)**
6. **PRÓXIMO: F6 Bloco C (UI portal + UI admin) → reviewers pesados → smoke E2E → push.**
7. Após F6: revisitar carry-overs P2 acumulados + sprints enfileirados.

**Carry-overs M34 (não-bloqueantes):**
- Push de 3 commits locais (`c5eee91` + `b3251f5` + commit de fechamento) segurado conforme regra
- Sessão paralela Cowork adicionou `LeadConcierge` + `DiagnosticoIndebito` ao schema sem commitar (Sprint C8/C4); Cowork commita separadamente — NÃO TOCAR
- D-novo-TAXA-RESGATE-DESTINO P2 catalogado análogo ao D-novo-TAXA-TRANSFER-DESTINO — `calcularTaxa('resgate')` default 0%; precisa decisão destino contábil antes de ligar
- Carry-overs históricos vivos (M28→M33) seguem abertos

**Detalhe completo:** `docs/sessoes/2026-06-12-m34-f6-blocos-ab.md`.

---

## ONDE PARAMOS — 2026-06-13 (Cowork — Tese 6 no orquestrador + Landing 2 funis + Esqueleto WA C8)

**Sessão Cowork seguinte, em paralelo ao Code que avançou Sprint Clube M33 (F3 Empresa distribui tokens) e M34 (F6 Estabelecimento resgata em PIX).**

**3 commits Cowork hoje (todos pushed em `origin/main`):**

| Hash | Tipo | Marco |
|---|---|---|
| `1405da5` | feat | **Esqueleto WA C8** (subagente): `LeadConcierge` model + enum `StatusLeadConcierge` (12 valores) + 8 estados WA `CONCIERGE_*` constants + `ConciergeWaService` (8 métodos esqueleto + multi-tenant guard) + templates de mensagem (13 constantes + helper) + 14 specs verdes |
| `f94a05b` | docs | Landing pública com **2 funis** (GD + não-GD) + correções pontos cegos Luciano (CooperToken só opt-in, obrigação pagar créditos, "até 25%*", honorários condicionais Funil A) + Tela 1 com Tese 6 estimada + legenda |
| `1f6fdb0` | feat | Integra Tese 6 no orquestrador `ConciergeService.previewDiagnostico` + log auditável + spec E2E (EXFISHES ABR/2026 retorna Tese 6 + Tese 3, ordenado por magnitude) |

**Ajuste técnico final (esta sessão):**
- `concierge.service.spec.ts` ganhou stub `jest.mock('@prisma/client')` expandido com `Prisma.defineExtension` — blinda contra cenário de prisma generated dessincronizado no sandbox/CI. **Suite Concierge: 96/96 verdes em 5 suites** (detectores 20 + service 13 + edp-es 32 + elfsm 17 + wa 14).

**Falso alarme tratado e catalogado em memória:**
- `Get-Content | Measure-Object -Line` (PowerShell) conta diferente de `git show` / `wc -l` por causa de CRLF/encoding. Reportei "5 arquivos truncados" no PC do Luciano — depois `git status -s` + `git diff --stat HEAD` retornaram vazio, confirmando que tudo está íntegro. Memória `feedback_diagnostico_truncamento_arquivo.md` evita repetir o erro.

**Não foi tocado pela Cowork (esclarecimento):**
- Code paralelo trabalhou intensamente M33+M34 (10 commits dele entre Cowork). Cowork mexeu APENAS em `backend/src/concierge/*` + `docs/concierge/*` + `backend/prisma/schema.prisma` (subagente, model LeadConcierge aditivo). Nenhum arquivo de `cooper-token`, `asaas`, `whatsapp` ou outros módulos do Code paralelo foi tocado.

**Estado consolidado:**
- **Backend Concierge DENTRO do SISGD**: 4 detectores (Tema 69+Tese 2+Tese 3+Tese 6) + registry + 3 adapters (EDP-ES, ELFSM, Energisa-TO esqueleto) + ConciergeService + Controller (7 endpoints REST) + ConciergeWaService esqueleto + LeadConcierge model + módulo NestJS plugado
- **Frontend Concierge DENTRO**: 2 telas (`/dashboard/concierge` Lista + `/dashboard/concierge/cooperado/[id]` Detalhe)
- **CoopereBR ativada** via script idempotente
- **Suite Concierge 96/96 verdes** + TSC zero erros

**O que está FORA do SISGD (mockup/docs, não em código):**
- 9 das 11 telas do mockup HTML (Tela 3 Sinergia, 4 EXFISHES, 5 Guilherme ELFSM, 6 Leads recebidos, 7 Upload manual, 8 Fluxo WhatsApp, 9 Super-admin, 10 Landing pública, 11 Tese 6 + Dossiê)
- Bot WA ponta-a-ponta (Spec C8 — só esqueleto service, sem integração no `whatsapp-fluxo-motor`)
- Geração PDF procuração + OTP SMS Twilio + webhook captação landing
- Modelo `DiagnosticoIndebito` persistido (preview ainda é in-memory)
- Adapters de outras concessionárias além das 3 atuais
- Cálculo SELIC real BCB (hoje usa fator linear aproximado)

**Pendência operacional pendente do Luciano:**
- Puxar MAR/2025 e MAI/2025 EXFISHES do portal EDP-ES (gap na série)
- Validar Tese 6 com advogado parceiro (bloqueia decisões de produto e captação)
- Decisão sobre baixar CSVs ANEEL (905 MB GD + SIGA) no PC e me passar via Downloads pra eu agregar usinas solar+hidráulica do ES dos últimos 5 anos

**Frase de retomada Cowork (próxima sessão):**

```
Continuar Concierge — quando Luciano enviar CSVs ANEEL (GD + SIGA), filtrar UF=ES intervalo
2021-2026, gerar XLSX consolidado por município/tipo/potência. Em paralelo: integrar
ConciergeWaService no whatsapp-fluxo-motor (mapping 8 estados CONCIERGE_* pros handlers) +
recalcular Laurentino e Christiane no mockup com Tese 6 confirmada após faturas reais.
```

---

## ONDE PARAMOS — 2026-06-12 (Cowork — Tese 6 ICMS sobre TUSD/TE em GD + Dossiê EXFISHES 14 faturas reais)

**Sessão Cowork em paralelo ao Code que rodava M32 Sprint Clube.**

**2 commits Cowork hoje:**
- `92483e1` — fechamento noite 11/06 (mockup 10 telas + Tese 5 STF + WIP parser)
- **`e85723d`** — **Tese 6 backend + dossiê EXFISHES 14 faturas + Tela 11 mockup**

Ainda pendente commit: correção Tela 4 + doc-sessão + este update CONTROLE.

**Entregas principais:**

1. **Pesquisa estratégica ICMS sobre GD** — `docs/concierge/2026-06-12-tese-6-icms-tusd-te-gd-scee.md`. Fundamento em camadas:
   - **PRIMÁRIO (cooperativa)**: Art. 79 Lei 5.764/71 — ato cooperativo, não implica operação de mercado, não há circulação jurídica de mercadoria entre cooperativa e cooperado
   - Secundários: Lei 14.300/22 (SCEE empréstimo gratuito) + Conv CONFAZ 16/2015 + Lei GERAR-ES vigente + STJ Tema 986 ressalva GD + TJ-MT abr/2026 (afastou ICMS TUSD em GD) + TJ-RJ + STF ADIs 7.077/7.634/7.716 mar/2026 (energia bem essencial) + Súmula 391/STJ
   - Lei GERAR-ES confirmada vigente por Luciano — mas independe da tese cooperativa

2. **Detector Tese 6 backend** — `backend/src/concierge/detectores/detector-tese6-icms-scee.ts` (NOVO). 4 testes novos. Suite Concierge 69/69 verde. Tese 6 é 4× maior que Tese 3 em magnitude (alíquota ICMS 17% vs PIS+COFINS ~5%).

3. **Parser EXFISHES v3 refinado** — usando `pdfplumber.extract_words(use_text_flow=True)` em vez de extract_text. 3 bugs resolvidos. Calibrado 100% contra ABR/2026.

4. **Dossiê EXFISHES 14 faturas** — `docs/concierge/2026-06-12-relatorio-exfishes-14-faturas.md` + `EXFISHES-Analise-14-Faturas-2026-06-12.xlsx` (3 abas: Série, Projeções, Ressalvas) + `docs/concierge/wip/exfishes-serie-v3.json`.

5. **Mockup HTML atualizado**:
   - **Tela 11 NOVA** — Tese 6 + Dossiê EXFISHES (organograma, tabela 14 faturas, projeções)
   - **Tela 4 CORRIGIDA** — narrativa GDIII reescrita com banner de correção

**Números EXFISHES (14 faturas reais, FEV/2025 → MAI/2026):**

| Métrica | Valor |
|---|---|
| Indébito Tese 3 médio | R$ 2.928/mês |
| Indébito Tese 6 médio | R$ 11.860/mês |
| COMBINADO médio | **R$ 14.788/mês** |
| Total documentado observado | R$ 124.076 |
| 60m + SELIC (Via Trib) | R$ 1.064.736 |
| 120m + SELIC (Via Cons Tese 5) | R$ 2.484.384 |
| **120m × dobro CDC** | **R$ 4.968.768** 🚨 |

**Achados críticos:**

- **Narrativa "transição GDIII mar/2026" estava INCORRETA** — SCEE ativo desde out/2024+. A mudança em mar→abr/2026 foi de regime de injeção (4.644 kWh → 73.400 kWh). Tela 4 corrigida.
- **R$ 2.515,24 do mockup anterior estava errado tributariamente** — era "valor pago - valor correto", não indébito Tese 3 stricto sensu. Valor real Tese 3 ABR/2026 = R$ 1.509,73. O que faltava era ICMS Tese 6 (R$ 7.008,62).
- **MAI/2026 é fatura de 6 dias** (período 25/04 → 30/04, fechamento extraordinário) + PDF contém 2 vias (pg 1 = MAI/2026 real, pg 3 = 2ª via ABR/2026).
- **Tese 6 é HÍGIDA independente da Lei GERAR** — Art. 79 Lei 5.764/71 é fundamento primário cooperativo.

**Débitos novos catalogados:**

- `D-novo-CONCIERGE-INTEGRAR-TESE6-SERVICE` **P0** — integrar Tese 6 no `concierge.service.ts` (orquestrador)
- `D-novo-CONCIERGE-MAPA-RISCO-UF-DETECTOR` **P1** — mapa de risco por UF
- `D-novo-EXFISHES-MAR-MAI-2025-FATURAS` **P1** — Luciano puxar do portal EDP-ES
- `D-novo-CONCIERGE-SELIC-MENSAL-BCB` **P3** — substituir fator linear por tabela SELIC BCB

**Débitos resolvidos:**
- `D-novo-EXFISHES-PARSER-BUGS` RESOLVIDO (parser v3 calibrado)
- `D-novo-EXFISHES-NARRATIVA-GDIII-INCORRETA` RESOLVIDO (Tela 4 corrigida)
- `D-novo-LEI-GERAR-VIGENCIA-ATUAL` CONFIRMADO vigente (mas não afeta tese cooperativa)

**Doc-sessão completo:** `docs/sessoes/2026-06-12-cowork-tese-6-dossie-exfishes.md`

**Frase de retomada Cowork (próxima sessão):**

```
Continuar Tese 6 — integrar DetectorTese6IcmsTusdTeSobreScee no orquestrador
ConciergeService.previewDiagnostico (Sprint C4 acelerado). Adicionar campo
mapaRiscoUf como input do detector. Recalcular Laurentino + Christiane +
Sinergia no mockup com Tese 6. Pedir Luciano puxar MAR/2025 + MAI/2025
do portal EDP-ES pra completar série.
```

---

## ONDE PARAMOS — 2026-06-11 NOITE (Cowork — Mockup 10 telas + Tese 5 STF + EXFISHES 14 faturas WIP)

**Sessão Cowork longa noite, em paralelo ao Code que rodava M32 Sprint Clube P1 F4.**

**Entregas principais:**

1. **Mockup standalone HTML completo** — `docs/concierge/mockups/2026-06-11-mockup-telas-concierge.html` (1342 linhas, **10 telas**): Lista, 4 casos reais (Laurentino, Sinergia ICMS+PIS/COFINS, EXFISHES, Guilherme ELFSM), Leads recebidos, Upload manual admin, Super-admin com CoopereBR ativada, Landing pública com imprensa, **Fluxo WhatsApp** (organograma 9 estados + 4 auxiliares + estimativas de funil).

2. **Tese 5 catalogada** — `docs/concierge/2026-06-11-tese-5-enriquecimento-sem-causa-decenal.md`: STF 2024 fixou **10 anos de prescrição** + **dobro CDC**. Multiplica valores recuperáveis 2-4×. Combinada com Tese 3 (PIS/COFINS sobre SCEE) e Tese 2 (ICMS sobre TUSD-G), os 4 casos do mockup chegam a R$ 1.724.927 no cenário máximo (120m + dobro CDC).

3. **Correção SELIC linear** — substituído fator fixo 1,20 por `1 + meses/12 × 0.04` em todos os cenários. Versão 22:34 do mockup é a correta. Impacto: +16,7% no teto Via 2 do EXFISHES (R$ 362.160 → R$ 422.560).

4. **Adendo cenários múltiplos** — `docs/concierge/2026-06-11-adendo-cenarios-multiplos-projecao.md`: substitui coleta de `dataInicioScee` por 5 colunas de projeção. Cancela `D-novo-LEAD-CONCIERGE-DATA-SCEE` e `D-novo-OCR-AUTO-DETECT-SCEE`.

5. **Spec C8 captação WA** + **levantamento técnico bot** — `docs/concierge/2026-06-11-spec-c8-concierge-captacao-wa.md` + `docs/arquitetura/2026-06-11-levantamento-tecnico-bot-whatsapp.md`. Diagnóstico: 51 estados WA + 14 services + 4 modelos Prisma. Spec C8 adiciona 4 estados novos.

**🚨 ACHADO CRÍTICO (EXFISHES 14 faturas reais) — narrativa do mockup INCORRETA:**

Análise da 1ª fatura da série (FEV/2025) mostra `oUC oPT 01/2025` com 53.574 kWh injetados e Créditos Recebidos 53.574,3014 kWh. **EXFISHES já estava no SCEE desde out/2024 ou antes** — NÃO virou GDIII em mar/2026 como afirma a Tela 4 do mockup. A "fatura antes de GDIII" (R$ 3.997 mar/2026 com indébito 90%) provavelmente é fatura com saldo SCEE menor naquele mês, não pré-GDIII. **Tela 4 do mockup precisa ser corrigida ANTES de qualquer envio pro advogado parceiro.**

**Inventário da série EXFISHES:**

- **14 faturas únicas** (FEV/2025 → MAI/2026, com gaps MAR/2025 e MAI/2025)
- **3 triplicatas confirmadas por MD5**: `#2 MAR2026 = #14 MAR2026 = MARÇO COOPEREBR 1`; `#15 ABR2026 = ABRIL COOPEREBR 2 = exfishes gdIII`
- **Pedir pro Luciano amanhã**: puxar MAR/2025 e MAI/2025 do portal EDP-ES

**Parser parcial (`backend/scripts/exfishes-parser-v1-WIP.py`) com 3 bugs identificados:**
1. TOTAL truncado (perde decimais)
2. TUSD/TE injetadas as vezes capturam R$ 200 (contrib ilum pública)
3. Vários indébitos vieram negativos (erro de captura de base)

JSON parcial preservado em `docs/concierge/wip/exfishes-series-v1-WIP.json`.

**Débitos novos catalogados:**

- `D-novo-EXFISHES-PARSER-BUGS` **P0** — refinar 3 regex + calibrar com ABR/2026 conhecido (R$ 2.515,24)
- `D-novo-EXFISHES-NARRATIVA-GDIII-INCORRETA` **P0** — corrigir Tela 4 do mockup
- `D-novo-EXFISHES-SERIE-INCOMPLETA` **P1** — puxar MAR/2025 e MAI/2025 do portal EDP
- `D-novo-CONCIERGE-CENARIOS-MULTIPLOS-UI` **P1** — implementar tabela 5 colunas

**Débitos resolvidos:**
- `D-novo-LEAD-CONCIERGE-DATA-SCEE` CANCELADO (cenários múltiplos)
- `D-novo-OCR-AUTO-DETECT-SCEE` CANCELADO (cenários múltiplos)
- `D-novo-CONCIERGE-JANELA-EFETIVA` REBAIXADO P0→P2
- `D-novo-SELIC-FATOR-FIXO-MOCKUP` RESOLVIDO

**Doc-sessão completo:** `docs/sessoes/2026-06-11-cowork-concierge-mockup-completo-e-exfishes-16faturas.md`

**Commit AINDA NÃO realizado** — Luciano fará via PowerShell em terminal separado do Code amanhã (instruções no doc-sessão).

**Frase de retomada Cowork (próxima sessão):**

```
Continuar análise EXFISHES — refinar parser v1 (3 bugs documentados em
backend/scripts/exfishes-parser-v1-WIP.py), calibrar com ABR/2026
(R$ 2.515,24 esperado), rodar nas 14 faturas reais, identificar marco
real do SCEE, corrigir Tela 4 do mockup, gerar dossiê EXFISHES + XLSX
pro advogado parceiro.
```

---

## ONDE PARAMOS — 2026-06-11 MANHÃ (Cowork — Concierge C3 + C2.5 + C2.6 + MVP SaaS, paralelo ao M31 Code)

**3 commits trabalho Cowork (claude.ai):**

| Hash | Tipo | Marco |
|---|---|---|
| `332ec5b` | feat | **C3** — 3 detectores tributários (Tema 69 + Tese 3 SCEE + Tese 2 TUSD-G) + 16 specs verdes |
| `d24104f` | feat | **C2.5** — Adapter ELFSM funcional (Guilherme Colatina) + correção PIS/COFINS líquido no Tese 3 + 12 specs ELFSM |
| `2440f94` | feat | **MVP SaaS** — Schema delta `moduloConciergeAtivo` + service + controller + 7 endpoints + 3 telas web + script ativar CoopereBR + estratégia jurídica Justiça Federal |

**Schema delta aplicado** (zero risco de perda, aditivo): `Cooperativa.moduloConciergeAtivo: Boolean @default(false)` + `conciergeAtivadoEm: DateTime?`. **CoopereBR ativada** via script idempotente (`ativar-concierge-cooperebr.ts`).

**77/77 specs verdes** (37 EDP + 12 ELFSM + 16 detectores + 12 ConciergeService).

**ACHADO ESTRATÉGICO CRÍTICO — ELFSM = prova cabal de descumprimento EDP**: Empresa Luz e Força Santa Maria (ES região serrana) aplica SCEE em AMBOS ICMS e PIS/COFINS — linha injeção com PIS/COFINS negativo cancelando o positivo do Consumo SCEE. EDP aplica só no ICMS. Sob mesma jurisdição ES + mesma legislação federal. **Não é mais "argumento por analogia" — é tratamento desigual sob mesma lei**. Inverte ônus argumentativo. Memória persistente `concierge_inconsistencia_icms_pis_edp_elfsm.md`.

**Indébito mensal mapeado em 10 faturas auditadas (5 antigas + 3 novas hoje + 2 ELFSM):** R$ 14.075/mês total, **R$ 1.055.616 em 60m+SELIC**. Casos demolidores: LAURENTINO B1 GD (R$ 263,84 → R$ 136,93 correto = 48% sobrepreço); CHRISTIANE B3 GD (R$ 859,61 → R$ 462,61 correto = 46%); SINERGIA A4 usina (R$ 11.184 → R$ 9.409 correto = 16%).

**Estratégia jurídica Justiça Federal entregue** (`docs/concierge/2026-06-11-estrategia-justica-federal.md`): NÃO atacar Lei GERAR-ES (favorável ao cooperado). Fundamento principal = Lei 14.300/2022 federal (SCEE textualmente = "empréstimo gratuito") + Tema 69 STF. Lei GERAR + fatura ELFSM viram precedente legislativo + prova documental de isonomia. **3 vias processuais**: (1) MS Coletivo CoopereBR contra Receita Federal, (2) Ação Ordinária Declaratória + Repetição Indébito, (3) Caminho administrativo via ANEEL/Lei 14.385/22. Réu = UNIÃO → Justiça Federal pelo Art. 109, I, CF.

**Bloqueador resolvido na sessão**: `cooper-token.service.ts:2005` truncado reparado via heredoc. Outros 4 arquivos cooper-token + asaas truncados (controller :572 + module :20 + service + asaas.service) — catalogado como `D-novo-CODE-TRUNCAMENTO-M31` P0 pra Code restaurar. **CORREÇÃO DE ATRIBUIÇÃO (11/06 — sessão Code retomada pós-Cowork):** truncamento NÃO foi do Code M31 (commit `89bc531` íntegro 2400 linhas verificado via `git show 6897c62:`). Foi introduzido pela edição da sessão paralela Concierge (`2440f94`) + reparo parcial `e7d6ca7` que deixou pedaços de código órfãos. **RESOLVIDO** na sessão Code de hoje: restauração via `git checkout 6897c62 -- backend/src/cooper-token/{service,controller,module}.ts backend/src/asaas/asaas.service.ts`. TSC zero erros nos 4 arquivos + suite cooper-token 106/106 verde.

**Frase de retomada Cowork:**

```
Continuar Concierge — Sprint C4: orquestrador + endpoint POST /concierge/diagnostico
+ persistência DiagnosticoIndebito + classificador teses por perfil. Build/PM2
depende dos 4 arquivos cooper-token serem reparados pelo Code primeiro.
```

**Carry-overs Cowork (não-bloqueantes):**
- D-novo-CONCIERGE-OCR-RUBRICAS-INDIVIDUAIS P2 (OCR atual agrega — detector precisa rubricas individuais pra rodar com dados reais)
- D-novo-CONCIERGE-PLANO-PAGTO-AUDITORIA P3 (parcelamento "Prestações Plano Pagto N/M" pode embutir indébito antigo diluído)
- D-novo-CONCIERGE-ELFSM-A4 P3 (calibrar layout comercial/industrial ELFSM quando aparecer fatura A4 deles)
- D-novo-CONCIERGE-MUC-VS-OUC P2 (Sinergia mUC cancela PIS/COFINS naturalmente; outras EDPs oUC não — diferenciação no detector pode ser útil)
- D-novo-CODE-TRUNCAMENTO-M31 ✅ **RESOLVIDO 11/06** — atribuição corrigida: truncamento NÃO foi do Code M31 (íntegro), foi da edição da sessão paralela Concierge (`2440f94` + reparo parcial `e7d6ca7`). Restauração feita via `git checkout 6897c62` dos 4 arquivos. TSC + 106 specs verde.

**Documentos vivos novos:**
- `docs/sessoes/2026-06-11-cowork-concierge-c3-c2-5.md` — fechamento sessão
- `docs/concierge/2026-06-11-estrategia-justica-federal.md` — roteiro processual com 7 fontes (STF, STJ, SEFAZ-ES, Migalhas, Canal Solar)

Detalhe: `docs/sessoes/2026-06-11-cowork-concierge-c3-c2-5.md`.

---

## ONDE PARAMOS — 2026-06-11 (Code — M31 Sprint Clube P1 Fase 2: Empresa-PJ compra tokens via Asaas SANDBOX)

**6 commits trabalho** (+ 1 fechamento):

| Hash | Tipo | Marco |
|---|---|---|
| `826d4f1` | feat | **F2 Bloco 1** — schema delta `CooperTokenCompra` + 3 colunas aditivas + enum `COMPRA_PJ_COOPERADA` |
| `e06c07d` | feat | **F2 Bloco 2** — `comprarTokensCooperado` + DTO + endpoint + Asaas SANDBOX + 10 specs |
| `89bc531` | feat | **F2 Bloco 3** — webhook Asaas extension + listener via EventEmitter + idempotência 2 camadas + 8 specs |
| `7a06595` | fix | **F2 fixes P1 pós-review** — GAP 1 compare-and-swap atômico + GAP 2 alerta loud + `@@unique([asaasId])` + cross-tenant guard novo em `creditar` + 4 specs |
| `01ff10c` | feat | **F2 Bloco 4** — UI `/portal/comprar-tokens` dedicada + link condicional em `/portal/tokens` |
| `d69ebf3` | test | smoke E2E real Santi compra 100 PIX + dual-webhook + assert ledger único + gancho contábil 2 lançamentos |
| `<próximo>` | docs | fechamento M31 (esta sessão) |

**Em curso:** —

**Próximo passo único e claro:** **Sprint Clube P1 — FASE 3 (F4 — Funcionário usa/transfere tokens)**. Escopo: `usar-na-fatura` + `transferir`/`enviar` no nível cooperado já existem (legado). F4 amarra ao fluxo **conveniado→funcionário** com **PIN/OTP + `$transaction Serializable` + idempotência via jti**. Aplicar Taxa de Operação F1.5 (`taxaTransferenciaPerc`/`taxaTransferenciaFixa` já preparados, default 0). Specs cobrindo bypass de saldo + idempotência. Fase 1 read-only + MAPA DE IMPACTO 5 dimensões → PAUSAR pro OK → implementar.

**Smoke E2E F2 ao vivo:**
```
[3] POST /cooper-token/cooperado/comprar 100 PIX → compraId=cmq9lem61... valorTotal=R$45 asaasId=pay_wrh5zqdifbcx33vb
[4] Webhook 1: PAYMENT_CONFIRMED → received:true
[5] Webhook 2: PAYMENT_RECEIVED (mesmo payment, eventId diff) → received:true
✅ status = PAGO
✅ saldo +98 tokens (taxa 2% F1.5)
✅ ledger: 1 entry SÓ (compare-and-swap fechou a corrida)
✅ ledger: tipo=COMPRA_PJ_COOPERADA operacao=CREDITO
✅ webhook 2: 200 sem erro
🟢 SMOKE PASS

Gancho contábil:
  DESPESA R$ 44,10 [Token] D: Custo Desconto Concedido — COMPRA_PJ_COOPERADA
  RECEITA R$ 44,10 [Token] C: Passivo Tokens a Resgatar — COMPRA_PJ_COOPERADA
```

**Decisões registradas narrativamente** (sem memória persistente nova):
- Compare-and-swap atômico (`updateMany {where:{status:'AGUARDANDO_PAGAMENTO'}}`) preferido sobre lock pessimista.
- Status `PAGO_CREDITO_PENDENTE` semanticamente distinto de `CANCELADO` (operacional vs falha Asaas).
- Cross-tenant guard global em `creditar()` (não só F2).
- EventEmitter inversão de dep Asaas↔CooperToken.
- UI Tipo B (página dedicada) pra consequência financeira.

**Estado de fila (Decisão 24):**
1. M31 ✅ entregue.
2. **PRÓXIMO: F4 Funcionário usa/transfere.**
3. F3 Empresa distribui em LOTE/INDIVIDUAL.
4. F6 Estabelecimento resgata (recibo, NÃO recompra).
5. Fatia A Nomenclatura.
6. Sprint Hardening Mass-Write SUPER_ADMIN P2.
7. Sprint Housekeeping.

**Carry-overs novos M31 (não-bloqueantes):**
- D-novo-ASAAS-WEBHOOK-AUTH P2 (token estático vs HMAC-SHA256).
- D-novo-LEDGER-UNIQUE-CONSTRAINT P3 (endurecer idempotência no banco do ledger).
- D-novo-CREDITO-PENDENTE-REPROCESSAMENTO P2 (listener+cron pra reprocessar PAGO_CREDITO_PENDENTE).
- 1 CooperTokenCompra smoke (`cmq9lem610000va1gxj7q1gtn`) PAGO + Santi com saldo 98 — `ambienteTeste=true`.

**Carry-overs M28/M29/M30 ainda vivos** (não-bloqueantes): D-novo-OXIDACAO-LEDGER-TIPO P2 (pre-req ligar oxidação prod); D-novo-OXIDACAO-PRESERVADOS-DUPLA-CONTAGEM P3; D-novo-OXIDACAO-SPECS P3; D-novo-WA-PHONE-NORMALIZE P2; 3 ações WA declaradas sem implementação; 17 modelos BOT órfãos; `empresa_conveniada`/`proprietario_usina` `cooperados[0]`; Fase 3 Token-WA pausa explícita; untracked acumulados; 218 membros parciais; 2 convites de smoke Santi loteId `6a84832d…`.

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 11/06 fechamento M31).

---

## ONDE PARAMOS — 2026-06-10 (Code — M30 Sprint Clube Unificado P1: Hub + F1.5 Economia + Fase 1.1 Polimento MLM)

**8 commits trabalho** (+ 1 fechamento):

| Hash | Tipo | Marco |
|---|---|---|
| `e4d0976` | feat | **Fase 1 HUB** — `/dashboard/clube` com 6 cards aglutinando CooperToken + Vantagens + Planos do Clube + Ranking + Tokens Recebidos + Financeiro Tokens; menu único; "Planos (Comercial)" desambiguado |
| `52d0d62` | feat | **F1.5 Bloco 1** — schema delta `ConfigCooperToken` + 11 campos (8 taxas + 3 oxidação + marco temporal). 0 rows pré-existentes → backfill trivial. |
| `c539036` | feat | **F1.5 Bloco 2** — helper puro `calcularTaxa(operacao, bruto, config\|null)` + substitui `TAXA_EMISSAO`/`TAXA_QR` chumbadas em `:103` (creditar) + `:988` (processarPagamentoQr). F0 preservado em `:1338`. 24 specs novos. |
| `8655d0c` | feat | **F1.5 Bloco 3** — `aplicarOxidacao` prospectivo com 3 invariantes matemáticas (marco + graça + piso) + cron `@Cron('0 3 1 * *')` + gate técnico `OXIDACAO_PRODUCAO_LIBERADA` em produção real. Enum `OXIDACAO` aditivo. 15 specs novos. |
| `b64f42b` | feat | **F1.5 Bloco 4** — DTO formal `UpsertCooperTokenConfigDto` (class-validator) + PUT/admin/config ampliado + UI dedicada `/dashboard/cooper-token/config` (banner âmbar gate jurídico + guard de UX) + card "Configuração da Economia" no hub + link único em `/parceiro/configuracoes`. |
| `951e95c` | fix | **F1.5 fixes pós-review** — G2 (valor real nas descrições do ledger) + G3 (gate duplicado em `aplicarOxidacao`) + MT P2 (`cooperativaId` obrigatório no PUT) + 11 specs. |
| `065216d` | docs | atualização do prompt Sprint Clube (orquestrador): Hub ✅ + Fase 1.1 nova + F1.5 detalhada com MAPA DE IMPACTO. |
| `ed33ffb` | feat | **Fase 1.1 POLIMENTO** — MLM entra no hub (3 cards: Indicações + Convites + Meu Convite) + remoção do menu flat ADMIN/SUPER_ADMIN + botão "← Voltar ao Clube" consistente em cooper-token/parceiro/financeiro. |
| `<próximo>` | docs | fechamento M30 (esta sessão). |

**Em curso:** —

**Próximo passo único e claro:** **Arrancar Sprint Clube P1 — FASE 2 (F2 empresa-PJ-cooperada compra)**. Prompt empacotado em `docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md` **FASE 3** (numeração do prompt; corresponde ao F2 da fila pós-Fase 1.5). Escopo: empresa cooperada PJ compra tokens creditando `cooperadoId` (CooperTokenSaldo + ledger via `creditar()`/`CooperTokenCompra`/Asaas). Hoje só existe `parceiro/comprar` que credita `saldoParceiro=tenant`. Aplicar Taxa de Operação F1.5 (já preparada em `calcularTaxa('emissao')`). Multi-tenant + idempotência (jti). Fase 1 read-only + **MAPA DE IMPACTO 5 dimensões** → PAUSAR pro OK → implementar.

**Reviewers aprovaram zero P0/P1:** `cooperebr-financeiro-token-reviewer` + `cooperebr-multitenant-reviewer` sobre Blocos 2+3+4 da lógica de dinheiro; 3 fixes P2 entraram no 5º commit + 3 débitos catalogados.

**Decisões importantes registradas narrativamente** (sem memória persistente nova):
- 8 colunas dedicadas vs 1 JSON `taxasOperacao` → escolhido **8 colunas** (defaults preservam comportamento + validação trivial + queries diretas).
- UI dedicada `/dashboard/cooper-token/config` vs estender `/parceiro/configuracoes` → escolhido **página própria** (padrão UX Tipo B + fonte única elimina duplicação).
- Gate técnico `OXIDACAO_PRODUCAO_LIBERADA` exigido em `isAmbienteReal()=true` (DEV roda livre).
- `oxidacaoAtivadaEm` carimba marco prospectivo automaticamente em `upsertConfig` (ligar carimba; desligar limpa; alterar perc preserva marco).
- MLM faz parte do Clube (Ranking já era MLM; indicação premia com tokens; convites alimentam cadeia).
- Remoção do menu lateral só em ADMIN/SUPER_ADMIN (COOPERADO/OPERADOR não têm Clube no menu → perderiam acesso).

**Estado de fila (Decisão 24):**
1. M30 ✅ entregue.
2. **PRÓXIMO: F2 Empresa-PJ-cooperada compra.**
3. F4 Funcionário usa/transfere (PIN/OTP + Serializable + jti).
4. F3 Empresa distribui em LOTE/INDIVIDUAL (mass-write reusa controles do Hardening; CLT 458).
5. F6 Estabelecimento resgata (recibo, NÃO recompra; flag `Cooperado.ehEstabelecimento`).
6. Fatia A Nomenclatura (CTK→CooperToken; dois rios kWh×token).
7. Sprint Hardening Mass-Write SUPER_ADMIN P2 (rebaixado, aguarda fim do Clube).
8. Sprint Housekeeping (cleanup smokes Santi + scripts órfãos + worktrees) — slot oportunístico.

**Carry-overs novos M30 (não-bloqueantes):**
- D-novo-OXIDACAO-LEDGER-TIPO P2 (pre-requisito de ligar oxidação em prod real — junto da política de quebra).
- D-novo-OXIDACAO-PRESERVADOS-DUPLA-CONTAGEM P3 (modelo conservador, invariante intacta).
- D-novo-OXIDACAO-SPECS P3 (cron + perc=100 + religar + filtro cooperativaId direto).

**Carry-overs M28/M29 ainda vivos** (não-bloqueantes): D-novo-WA-PHONE-NORMALIZE P2; 3 ações WA declaradas sem implementação; 17 modelos BOT órfãos; `empresa_conveniada`/`proprietario_usina` iterando só `cooperados[0]`; Fase 3 Token-WA pausa explícita; untracked acumulados pra Housekeeping; 218 membros parciais; 2 convites de smoke no convênio Santi (loteId `6a84832d13679547071f6964`).

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 10/06 fechamento M30).

---

## ONDE PARAMOS — 2026-06-10 (Code — M29 Fase 2 Opção B Santi: 3 bugs onboarding + ajustes P3 + smoke E2E + 2 sprints enfileirados)

**8 commits trabalho** (+ 1 fechamento):

| Hash | Tipo | Marco |
|---|---|---|
| `ae982e3` | docs | wa-bot-agent.md órfão M26 (carry-over inicial pré-abertura) |
| `56b7666` | fix | **Bug A** — `enviarLinkPorWhatsapp` propaga FALHOU + motivo do sender; helper compartilhado conserta individual + lote + reenvio. 5 specs novos. |
| `747cfbe` | fix | **Bug B** — `refreshKey?: number` em GestaoConvitesSection + MembrosPendentesSection; parents (conveniada + admin) bumpam em `carregarComBump`. |
| `2b0e9a0` | fix | **Bug C** — `listarPendentes` expõe `cooperado.ucs[]` + `cotaKwhMensal`; helper UI `UcResumo` trata 4 casos (0/1 NORMAL/1 SINTETICA/N>1 "+N UCs"). 3 specs novos. |
| `78b7a82` | fix | **C-1** (reviewer) — `where: { cooperativaId }` explícito no select aninhado de `ucs` (defense in depth) + spec anti-regressão. |
| `3789bed` | fix | **B-1** (reviewer) — `carregar()` async + `await` em `carregarComBump` no admin (espelha conveniada, elimina race). |
| `bdbdeba` | docs | **A-1 + C-2** catalogados como P3 em `debitos-tecnicos.md` (D-novo-LOTE-PROCESSAR-FILA-INTEGRACAO + D-novo-LABEL-DISTRIBUIDORA-UI). |
| `2d62b09` | test | smoke E2E `backend/scripts/smoke-bug-a-lote-santi.ts` (login Santi → lote 2 dest → status: 1 ENVIADO + 1 FALHOU `whitelist-dev`). |
| `<próximo>` | docs | fechamento M29 (esta sessão). |

**Em curso:** —

**Próximo passo único e claro:** **Arrancar Sprint Clube Unificado P1 — Fase 1 HUB.** Prompt empacotado pelo orquestrador em `docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md`. Sequência: F1 hub frontend → F1.5 config economia (Taxa + Oxidação) → F2 empresa-PJ-cooperada compra → F4 funcionário usa/transfere → F3 empresa distribui → F6 estabelecimento resgata (recibo, NÃO recompra) → Fatia A nomenclatura. Cada fase começa com Fase 1 read-only + MAPA DE IMPACTO 5 dimensões → PAUSAR pro OK → implementar → specs verdes.

**Smoke E2E HTTP real validou Bug A:**
```
resumo: { total: 2, pendente: 0, enviado: 1, falhou: 1 }
  • Smoke Whitelist        | ......1348 | ENVIADO  | erro=-
  • Smoke Nao Whitelist    | ......1222 | FALHOU   | erro=whitelist-dev
🟢 SMOKE PASS — Bug A end-to-end OK
```

**Decisões catalogadas (3 memórias persistentes):**
- `sprint_hardening_mass_write_super_admin_10_06.md` (P2, rebaixado)
- `sprint_clube_unificado_cooper_token_10_06.md` (P1, próxima sessão)
- `regra_coerencia_sistemica_mapa_impacto_10_06.md` (INEGOCIÁVEL global)

**Estado de fila (Decisão 24):**
1. M29 ✅ entregue.
2. **PRÓXIMO: Sprint Clube Unificado P1** (Fase 1 HUB → ... → Fatia A nomenclatura).
3. Sprint Hardening Mass-Write SUPER_ADMIN P2 (rebaixado, aguarda fim do Clube).
4. Sprint Housekeeping (cleanup smokes Santi + scripts órfãos + worktrees) — futuro.

**Carry-overs desta sessão (não-bloqueantes):** 2 convites de smoke no convênio Santi (loteId `6a84832d13679547071f6964`) — `ambienteTeste=true`, sem impacto em relatório; limpa na Housekeeping. Sprint Clube P1 enfileirado. Hardening P2 rebaixado. Regra Coerência Sistêmica aplicar em TODOS sprints.

**Carry-overs M27/M26/M28 ainda vivos** (não-bloqueantes): D-novo-WA-PHONE-NORMALIZE P2; 3 ações WA declaradas sem implementação; 17 modelos BOT órfãos; `empresa_conveniada`/`proprietario_usina` iterando só `cooperados[0]`; Fase 3 Token-WA pausa explícita; untracked acumulados pra Housekeeping; 218 membros parciais.

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 10/06 fechamento M29).

---

## ONDE PARAMOS — 2026-06-09 (Code — M28 F0 CooperToken Fase 2 + F1 Definir PIN 3 canais + Santi 1ª conveniada + 2 read-only)

**5 commits trabalho** (+ 1 fechamento):

| Hash | Tipo | Marco |
|---|---|---|
| `10a1de7` | fix | **F0 CooperToken Fase 2** — remove crédito indevido saldoParceiro em QR coop→coop + corrige dupla TAXA_QR em `processarQrParceiro` (parceiro agora recebe 99 num bruto de 100, era 98,01). 4 specs novos. |
| `20d3f91` | feat | **F1 backend `meu-perfil`** — GET pin-status + POST definir-pin com 409 anti-rewrite + throttle 10/min + helpers `isPinFraco` + `isEmpresaCooperada` + `OtpMotivo` estendido `PIN_DEFINIR`. 23 specs. |
| `7f8cd93` | feat | **F1 portal `/portal/seguranca/definir-pin`** — page client + `isPinFraco` espelhado + help inline azul. SEM OTP (JWT prova identidade). |
| `abf12e2` | feat | **F1 bot WA fluxo DEFINIR PIN** — 3 estados + 4 ações + OTP+últimos-4-CPF (decisão Luciano: anti-SIM-swap) + seed submenu opção "4 Definir PIN". 13 specs. |
| `b5609e4` | feat | **Santi Medicina Diagnóstica** cadastrada como 1ª empresa conveniada de teste da CoopereBR — Cooperado PJ + Usuario Supabase + CV-SANTI-001 (MISTO 20% pagador EMPRESA). Seed idempotente executado + validado via /auth/login + /auth/me + /portal/meus-convenios. |
| `<próximo>` | docs | fechamento M28 (esta sessão) |

**Em curso:** —

**Próximo passo (Luciano decide entre 2 opções):**

**(A) Bug exibição/cálculo conveniada VALOR_FIXO + ALOCACAO_FIXA** — front ignora `tipoTarifaEmpresa=VALOR_FIXO` (mostra "Tarifa cheia" pra Santi com tarifa fixa 1,10); backend ALOCACAO_FIXA com 0 membros faz early-out `SEM_MEMBROS` em vez de calcular `kwhAlocadoMensal × tarifa` (100000 × 1,10 = R$ 110.000). Frente Fase 1 read-only completa nesta sessão.

**(B) 3 bugs onboarding conveniada** — (Bug A) lote silenciosamente "ENVIADO" sem disparar via whitelist-dev (helper ignora retorno do sender); (Bug B) `GestaoConvitesSection` sem `onAcaoConcluida` → UI não refresh; (Bug C) listagem `/membros-pendentes` não inclui `cooperado.ucs[]` → "sem UC" no detalhe + cadastroWebV2 slim cria UC SINTÉTICA com distribuidora=OUTRAS. Frente Fase 1 read-only completa nesta sessão.

Validações operacionais paralelas:
- Bot WA: rodar `cd backend ; npx ts-node scripts/seed-definir-pin-wa.ts` + testar "MENU → 8 CooperTokens → 4 Definir PIN" com telefone Luciano.
- Portal: testar `/portal/seguranca/definir-pin` logado como cooperado teste.
- Santi: logar `lucbragatto+santi@gmail.com` / `Santi@2026` ou impersonate em `/dashboard/dev/credenciais-teste`.

**Carry-overs novos desta sessão (não-bloqueantes):**
- Frente (A) bug VALOR_FIXO/ALOCACAO_FIXA — Fase 1 mapeada, aguarda OK pra implementar.
- Frente (B) 3 bugs onboarding — Fase 1 mapeada, 3 perguntas decisórias pendentes (Q1/Q2/Q3).
- IDs Santi: Cooperado `cmq6qo4hi0002va2wti5k1sqw` + Usuario `cmq6qo5c40005va2w8gyyzzj7` + Convenio `cmq6qo5ly0007va2w6hilvs2a`.

**Carry-overs M27/M26 ainda vivos** (não-bloqueantes):
- D-novo-WA-PHONE-NORMALIZE P2 (matcher telefone amplo).
- 3 ações WA declaradas sem implementação (`PROCESSAR_OCR`, `MOSTRAR_MENU_PRINCIPAL`).
- 17 modelos BOT órfãos.
- `empresa_conveniada` / `proprietario_usina` iterando só `cooperados[0]`.
- Fase 3 Token-WA (TokenTransacao + QR pagamento real) — pausa explícita; F0 fechou conformidade do circuito existente.
- `.claude/agents/wa-bot-agent.md` modificado órfão M26.
- `cooperebr-edge-agent` stopped (projeto vizinho, fora do escopo).

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 09/06 fechamento M28).

---

## ONDE PARAMOS — 2026-06-08 (Code — M27 Revisão multi-tenant "qual cadastro?" + skills Coop + F0 Fase 1 read-only CooperToken)

**5 commits trabalho** (+ 1 fechamento):

| Hash | Tipo | Marco |
|---|---|---|
| `6f48da7` | fix | filtra cooperado inativo em `obterContextos` + `acharCooperadosPorUsuario` + `assinarTokenImpersonate` (3 pontos + 3 specs) |
| `9dce791` | feat | skills cooper-token + wa-bot pro agente Coop (`.agent/memory/` + `.agent/AGENTS.md`) |
| `e1e8c45` | fix | persiste `contexto_ativo_id` + chaves React por id + cookie `secure` em prod |
| `b0e7cd6` | fix | bloqueia TROCAR CADASTRO em estado sensível (Fase 3 token) + zera `dadosTemp` em SAIR/INÍCIO (higiene PII) |
| `f980a69` | chore | throttle 10/min em `POST /auth/trocar-contexto` (anti-enumeração) |
| `<próximo>` | docs | fechamento M27 (esta sessão) |

**Em curso:** —

**Próximo passo único e claro:** **F0 Fase 2 CooperToken** — implementar as 2 correções P0 já confirmadas em Fase 1 read-only desta sessão.

1. `backend/src/cooper-token/cooper-token.service.ts:1062-1065` — remover bloco `if (recebedorCooperativaId) { await this.creditarSaldoParceiroTx(...) }` dentro de `processarPagamentoQr` (QR cooperado→cooperado não emite saldo novo pra cooperativa; tokens só circulam).
2. `backend/src/cooper-token/cooper-token.service.ts:1335-1336` — corrigir dupla TAXA_QR em `processarQrParceiro`: substituir cálculo por `liquidoParceiro = resultado.quantidadeLiquida; taxa1Pct = resultado.taxa` (reusar o que já saiu de `processarPagamentoQr`).
3. Specs Jest novos: (a) QR cooperado→cooperado NÃO altera `CooperTokenSaldoParceiro`; (b) taxa QR aplicada exatamente 1×; (c) arredondamento `Math.round(x*100)/100`.
4. Rebuild PM2 backend (stop → build → restart).
5. Commit PT: `fix(cooper-token): F0 remove duplo credito saldoParceiro + dupla taxa QR`.

**Pendência paralela P2 (não-bloqueante, carry-overs vivos do M26):**
- D-novo-WA-PHONE-NORMALIZE — migração ampla da base com auditoria prévia.
- 3 ações WA declaradas em gatilhos sem implementação (`PROCESSAR_OCR`, `MOSTRAR_MENU_PRINCIPAL`).
- 17 modelos BOT órfãos sem etapa.
- `empresa_conveniada` / `proprietario_usina` iterando só `cooperados[0]`.
- Fase 3 Token-WA (TokenTransacao + QR + pagamento) — pausa explícita Luciano; F0 corrige conformidade do circuito existente ANTES de avançar.

**Carry-overs novos desta sessão (não-bloqueantes):**
- `.claude/agents/wa-bot-agent.md` modificado não-commitado (carry-over órfão do M26 — adição da seção "Integração com Stack de Agentes OpenClaw/Hermes + ECC + Obsidian").
- `cooperebr-edge-agent` stopped + `pm2 save` (projeto vizinho `cooperebr-monitoramento`; crash loop não investigado, fora do escopo).
- Untracked acumulados em `backend/scripts/`, `.claude/agents/`, `backend/src/agents/`, `docs/RECOMENDACAO-ARQUITETURA-FINAL.md`, `docs/arquitetura-agentes-pkm-cooperebr.md`, `tmp_smoke_check.mjs` — Sprint Housekeeping futuro.

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 09/06 fechamento desta sessão QA).

---

## ONDE PARAMOS — 2026-06-09 (QA Funcional — Aprofundamento dossiê modelos de usuário + análise proposta proxy via convênio)

**Trabalho principal:** Aprofundamento das seções 3.5 (PROPRIETARIO_USINA — com detalhes reais do Sprint AN repasse-proprietário completo, código, regras, achados, gaps, dúvidas, melhorias) e 3.6 (ADMIN_AGREGADOR — contexto histórico de Carlos/Hangar MLM capta clientes, estado atual skeleton, sugestões de evolução como ferramenta de captação). Análise completa da proposta do usuário de usar o convênio (empresa_conveniada) como proxy temporário para agregador e condomínio, suprimindo as telas dedicadas e melhorando a tela do convênio. Leitura de sessões adicionais (leitura-total, cadeia-hangar, AN sprint, etc.), código (proprietario, repasses-proprietario, administradoras, conveniada pages), multi-perspectiva (arquiteto, dev, design, usuário). Sugestões de melhorias concretas na tela do convênio (nomenclatura flexível, seção "Minha Rede de Captação", KPIs de captação, suporte a condomínio, flags técnicas, testes QA). Usuário vai passar para o Code analisar tudo antes de retomar aqui.

**Entregas:**
- Dossiê principal atualizado com seções 3.5/3.6 aprofundadas + análise completa da proposta de proxy (prós, contras, melhorias priorizadas, testes recomendados).
- Sessão doc ritual: docs/sessoes/2026-06-09-dossie-modelos-usuario-proposta-proxy-convenio.md
- Resumo curto preparado para envio via WhatsApp do projeto (número +5527981341348) e arquivos em docs/relatorios/ + docs/sessoes/ para Claude Code desktop carregar direto.

**Débitos novos:**
- D-novo-PROXY-CONVENIO-CONFUSAO-PAPEIS (P2): Risco de confusão entre papéis ao usar convênio como proxy (empresa vs agregador vs condomínio); mitigar com nomenclatura flexível e HelpBoxes.
- D-novo-PROXY-MIGRACAO (P3): Dívida de migração futura quando evoluirmos portais dedicados.
- Reforço de bugs conhecidos que impactam o proxy (convite lote, UI refresh, dados cadastro).

**Próximo passo único e claro:** Usuário vai passar o dossiê atualizado para o Code analisar a proposta de proxy via convênio e as sugestões de melhorias na tela do convênio. Ao retomar amanhã: validar feedback do Code, decidir se aprova o proxy + quais melhorias priorizar, então continuar testes funcionais (Cenários 1/2/3 com o proxy se aprovado), e/ou ler mais sessões/fluxos conforme orientação. Manter dossiê vivo.

**Frase de retomada (copie e cole direto pro Code):**

PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior). Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents disponíveis. Se não aparecer, parar e avisar (sessão não indexou subagent project-specific).

2. Rodar `git status --short` (diretriz inegociável catalogada 18/05). Se houver arquivos modificados que NÃO sou eu desta sessão, PAUSAR + Decisão 23. Esperado pós-fechamento: working tree limpo, último commit é o de fechamento.

PASSO 1 — Frase de retomada principal:

Sessão 09/06 (QA Funcional) aprofundou o dossiê de modelos de usuário (especialmente 3.5 PROPRIETARIO_USINA com detalhes do Sprint AN repasse-proprietário completo, código, regras, achados, gaps, dúvidas, melhorias; 3.6 ADMIN_AGREGADOR com contexto histórico de Carlos/Hangar MLM capta clientes, estado atual skeleton, sugestões de evolução como ferramenta de captação). Análise completa da proposta do usuário de usar o convênio (empresa_conveniada) como proxy temporário para agregador e condomínio, suprimindo as telas dedicadas e melhorando a tela do convênio. Leitura de sessões adicionais (leitura-total, cadeia-hangar, AN sprint, etc.), código (proprietario, repasses-proprietario, administradoras, conveniada pages), multi-perspectiva (arquiteto, dev, design, usuário). Sugestões de melhorias concretas na tela do convênio (nomenclatura flexível, seção "Minha Rede de Captação", KPIs de captação, suporte a condomínio, flags técnicas, testes QA). Usuário vai passar para o Code analisar tudo antes de retomar aqui. Entregas: dossiê atualizado com seções aprofundadas + análise da proposta de proxy (prós, contras, melhorias priorizadas, testes recomendados); sessão doc ritual criada; resumo curto preparado para envio via WhatsApp do projeto (número +5527981341348) e arquivos em docs/relatorios/ + docs/sessoes/ para Claude Code desktop. Débitos novos: D-novo-PROXY-CONVENIO-CONFUSAO-PAPEIS (P2), D-novo-PROXY-MIGRACAO (P3), reforço de bugs conhecidos que impactam o proxy. Próximo quando retomar amanhã: validar feedback do Code sobre o dossiê e a proposta, decidir se aprova o proxy + quais melhorias priorizar na tela do convênio, então continuar testes funcionais (Cenários 1/2/3 com o proxy se aprovado), e/ou ler mais sessões/fluxos conforme orientação. Manter dossiê vivo. Pré-requisitos leitura: esta sessão doc, dossiê principal atualizado, CONTROLE-EXECUCAO (seção "Onde paramos" e frase de hoje), sessões relevantes (leitura-total, cadeia-hangar, AN sprint), código do convênio. Carry-overs: proxy risks (confusão de papéis, dívida de migração), bugs conhecidos (convite lote, UI refresh, dados cadastro) que vão impactar o proxy. Diretrizes: Foco em análise e sugestões como QA (só reportar); usar o convênio como proxy é pragmático no curto prazo (aproveita Hangar real), mas exige melhorias na tela (prioridade nomenclatura + seção de rede + KPIs); documentar como temporário. 

---

## ONDE PARAMOS — 2026-06-08 (Code — M26 Token-WA Fase 1+2 completa + hardening + "Qual cadastro?" multi-cadastro)

**22 commits trabalho** em sessão Code maratona (+ 1 fechamento):

| Hash | Tipo | Marco |
|---|---|---|
| `ccf0074` | feat | Token-WA Fase 1 — consultas read-only (saldo + extrato) pelo bot |
| `481cebc` | feat | F2.1 schema aditivo: PIN + limites + 3 tabelas (AparelhoVinculado, OtpDesafio, TokenTransacao rica) |
| `124f3d5` | refactor | F2.2 otp-helper.ts genérico |
| `7c3b824` | feat | F2.3 PinCooperadoService (hash + rate-limit + lockout) |
| `be82b0c` | feat | F2.4 AparelhoVinculadoService + OtpDesafioService |
| `83953f6` | feat | F2.5 LimiteTokenService (cooperativa × cooperado) |
| `0ba29ae` | feat | F2.6 TokenNotificacaoService (WA 2 lados + email alto valor) |
| `5204f91` | test | F2.7 smoke E2E 22/22 verde |
| `9ca604c` | feat | F2.8 "Alterar meu limite" no submenu CooperTokens (WA) |
| `8e867a5` | feat | Adendo Fase 2/3 — TokenTransacao rica + diag bot WA |
| `f4d20c7` | **feat** | **F2.9 hardening P0** + **destrava bot WA** + cataloga D-novo-WA-PHONE-NORMALIZE |
| `f8b629b` | **feat** | **F2.10 implementa VERIFICAR_COOPERADO** + opção 8 hardcoded + setup SISGD teste |
| `de4e725` | **fix** | **Elimina render `**` patológico** quando variável vazia |
| `dcce884` | fix | Persona "P" → "Coop" |
| `29dd88e` | fix | Acentos no funil visitante (6 strings + 4 modelos) |
| `0e8c084` | fix | Tenant default por env (DEFAULT_TENANT_ID) — opção B |
| `97b61f3` | feat | "Qual cadastro?" Fix 1 — helper compartilhado matcher |
| `09d5531` | feat | "Qual cadastro?" Fix 2 WA — escolha com anti-IDOR + TROCAR CADASTRO |
| `a04fd54` | feat | "Qual cadastro?" Fix 3+4 portal — obterContextos listMany + trocar anti-IDOR |
| `7d3a9ec` | feat | "Qual cadastro?" Fix 3 web — ContextoSwitcher chama backend |
| `83ef5bf` | **feat** | **Reconhecer cooperado na ENTRADA** (INICIO/MENU/saudação) |
| `8f51f58` | fix | INICIAL global aponta pra menu_principal + gatilhos 1/2/3/4 |
| `<próximo>` | docs | fechamento M26 (esta sessão) |

**Em curso:** —

**Próximo passo (Luciano decide):**
1. **Fase 3 Token-WA** — TokenTransacao + QR + pagamento real (move dinheiro; PIN/limite já implementados na Fase 2).
2. **Outro bloco do roadmap A→H** — Bloco 3 Sprint Onboarding (cadastro sem UC), Módulo Pagar Concessionária (Mandato), etc.

Validar primeiro fluxo "qual cadastro?" pelo WA com Luciano (mandar "INÍCIO" → deve aparecer "Qual cadastro? 1 LUCIANO (PF) 2 SISGDSOLAR (PJ)" sem precisar passar pelo menu visitante).

**Pendência paralela P2 (não-bloqueante):**
- D-novo-WA-PHONE-NORMALIZE: migração ampla da base com auditoria prévia obrigatória.
- 218 membros parciais (segmentação pendente — carry-over M24/M25).
- 3 ações declaradas em gatilhos sem implementação (`PROCESSAR_OCR`, `MOSTRAR_MENU_PRINCIPAL`, etc).
- 17 modelos BOT órfãos sem etapa associada.
- Empresa_conveniada / proprietario_usina iteram só `cooperados[0]` (refator quando 2º cooperado virar pagador/proprietário).

**Carry-overs novos (não-bloqueantes):**
- Tenant CoopereBR INICIAL override sem `acao=VERIFICAR_COOPERADO` no gatilho "1" (global já tem — drift válido enquanto reconhecimento automático cobre).
- Modificação alheia em `.claude/agents/wa-bot-agent.md` (não desta sessão; investigar origem).

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 08/06 fechamento M26).

---

## ONDE PARAMOS — 2026-06-07 (Code — M25 Bloco 2 Empresa vê kWh + Correção modelo kWh + Sprint Convite-Lote)

**11 commits trabalho** em 1 sessão Code maratona (+ 1 fechamento):

| Hash | Tipo | Marco |
|---|---|---|
| `6664aed` | feat | Fatia 2.1 — helper read-only `previewKwhConsolidado` (fonte única) |
| `70bf820` | feat | Fatia 2.2 — helper puro `ratearProporcionalCusteio` (INVARIANTE centavo) |
| `4a8dec3` | feat | Fatia 2.3 — endpoint `GET /portal/meus-convenios/:id/kwh-consumo` (UC mascarada + anti-IDOR) |
| `f74c3d6` | feat | Fatia 2.4 — tela consumo dos funcionários (Bloco 2 COMPLETO) |
| `5f66ab3` | **fix** | **kWh: total = soma das cotas (modelo correto, kwhAlocadoMensal vira referência)** |
| `0756dcb` | feat | LOTE.1 — backend preview CSV + 5 estados + dedup |
| `8de49e0` | feat | LOTE.2+3 — envio em fila throttle 2s + schema `loteId` + status |
| `e427230` | **fix** | **kWh complemento: valorAPagar no preview + tela 3 colunas correta** |
| `635143e` | feat | LOTE.4 — tela Convidar em lote (portal + admin) |
| `dac1907` | **fix** | **UI tela kWh — tabela SEMPRE renderiza quando há membros + seed demo Clínica Teste 300/400/500** |
| `8a957bd` | feat | LOTE.5 — modo B "Abrir no WhatsApp" + helper wa.me reusável MLM (`cooperadoIndicadorId`) |
| `<próximo>` | docs | fechamento M25 (esta sessão) |

**Em curso:** —

**Próximo passo (Luciano decide):**
1. **Bloco 3 Sprint Onboarding** — cadastro fácil sem UC (membro entra sem UC ativa; cooperativa gera UC depois).
2. **Módulo Pagar Concessionária (Mandato)** — concretiza o 3º modelo do circuito CooperToken (memória `decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md`). Cooperado dá mandato pra cooperativa pagar concessionária direto; transparência fiscal-tributária. Demanda parecer ANEEL/CC.

**Pendência paralela P2 (não-bloqueante):**
- Segmentar os 218 membros parciais detectados pelo DRY-RUN da M24 ANTES de reconciliação em massa (oco genuíno × SEM_UC legítimo × lista de espera × cooperado sintético). Estimativa: ~2-4h script de segmentação.
- Reprocessar fatura do LEONARDO PIZZOL VIGNA (cota 500 demo aplicada na M25; fatura real ainda pendente).
- Aplicar mensagem de convite nova no Code (sugerida pelo Luciano).

**Carry-overs novos (não-bloqueantes):**
- Helper `ratearProporcionalCusteio` (Fatia 2.2) órfão funcional pós-fix kWh — housekeeping futuro P3 (mantido com 15/15 specs vigentes).
- `.claude/agents/wa-bot-agent.md` modificado (não-meu — vem de outro tooling/IDE com adições Stack OpenClaw+ECC+Obsidian). Luciano avalia commit/descarte.

**Carry-overs anteriores preservados:** 6 débitos M23 P3 + 3 débitos M24 P3 + `D-novo-CT-VALIDACAO-FISCAL` P0 + `D-novo-CT-MULTI-REGIME-CLASSIFICACAO` P1 + `D-novo-BM` P0 BLOQUEADOR PRÉ-PROD + 256 legados allowlist `lint:tenant`.

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 07/06 fechamento M25).
> Detalhe: `docs/sessoes/2026-06-07-bloco-2-kwh-convite-lote.md`.

---

## ONDE PARAMOS — 2026-06-06 (Code — M24 Sprint Onboarding Membro Bloco 0 + Bloco 1)

**8 commits trabalho** em 1 sessão Code maratona (+ 1 fechamento retroativo registrado em 07/06):

| Hash | Tipo | Marco |
|---|---|---|
| `a9794a8` | feat | Fatia 0.1 — PlanoClube model + CRUD + tela admin (Bloco 0 Sprint Onboarding) |
| `6584aec` | feat | Fatia 0.2 — `planoClubeId` no ContratoConvenio |
| `29999c6` | feat | Fatia 0.3 — adesão opt-in `Cooperado.planoClubeId` + INVARIANTE anti-cobrança-dupla |
| `34a66c8` | feat | Fatia 0.4 — componente CLUBE escalar discriminado nas 2 cobranças (Bloco 0 COMPLETO) |
| `d18e7f6` | feat | Fatia 1.1 — repasse `convenioId` + `permiteSemUc` na validação do convite |
| `cfc6421` | feat | Fatia 1.2 — persiste cota + pendência visível + stash consumo |
| `412b2da` | feat | Fatia 1.3 — helper `construirMembroCompleto` no gate MEMBRO_ATIVO |
| `8e47737` | feat | Fatia 1.4 — clube config-dependente + DRY-RUN reconciliação + fix LISTA-ESPERA tenant (Bloco 1 COMPLETO) |
| `<próximo>` | docs | fechamento M24 (esta sessão de retomada/fechamento retroativo 07/06) |

**Em curso:** —

**Próximo passo:** **Bloco 2 do Sprint Onboarding** — empresa pagadora visualiza total de kWh consumido pelos funcionários (membros custeados) no portal `/conveniada/convenio/[id]`. Fase 1 read-only obrigatória.

**Pendência paralela P2 (não-bloqueante do Bloco 2):**
- Segmentar os 218 membros parciais detectados pelo DRY-RUN (oco genuíno × SEM_UC legítimo × lista de espera × cooperado sintético de teste) ANTES de reconciliação em massa.
- Reprocessar fatura do LEONARDO PIZZOL VIGNA pra fechar o contrato dele (cota foi perdida pré-Fatia 1.2; reconciliação ativou status + clube mas pulou contrato corretamente).

**Carry-overs (não-bloqueantes):**
- 3 débitos novos catalogados P3: `D-novo-FATURA-SEGREGADA-ITENS` (discriminação visual do CLUBE na fatura PDF) · `D-novo-CLUBE-LANCAMENTO-FISCAL` (natureza fiscal própria quando CT ativar) · `D-novo-CADWEB-FATURA-PROCESSADA` (criar FaturaProcessada completa quando OCR estabilizar).
- 1 resolvido: `D-novo-LISTA-ESPERA-TENANT` P1 (sem necessidade de backfill — fila atual sintética).
- Carry-overs anteriores preservados: 6 débitos abertos da M23 + `D-novo-CT-VALIDACAO-FISCAL` P0 + `D-novo-CT-MULTI-REGIME-CLASSIFICACAO` P1 + `D-novo-BM` P0 BLOQUEADOR PRÉ-PROD + 256 legados allowlist `lint:tenant`.

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 06/06 fechamento M24).
> Detalhe: `docs/sessoes/2026-06-06-bloco-0-1-onboarding-membro.md`.

---

## ONDE PARAMOS — 2026-06-05 tarde-noite (Code — M23 Hardening Golden Path /cadastro?conv= e ?ref=)

**5 commits trabalho** em 1 sessão Code maratona (+ 1 fechamento):

| Hash | Tipo | Marco |
|---|---|---|
| `9291d32` | fix | whitelist `+27999479097` + `WhatsappEnvioResult` honesto (D-novo-WA-DEV-FALSE-OK RESOLVIDO) |
| `8ab10c8` | docs | fechamento M22 |
| `4c05aea` | fix | OCR resiliência — retry+timeout+max_tokens 8192+`OcrFalhaError` 7 motivos+UI (D-novo-OCR-RESILIENCIA RESOLVIDO, 30 specs) |
| `004372c` | fix | `cadastro-web` resolve cooperativaId via convite (anti-spoof D-novo-CADWEB-CONV-TENANT RESOLVIDO, 6 specs + script reset OTP) |
| `beef066` | fix | porta Membro+consume-once pro mesmo tx (D-novo-CADWEB-CONV-MEMBRO RESOLVIDO, 8 specs + smoke E2E 0 falhas) |
| `<próximo>` | docs | fechamento desta sessão (M23) |

**Em curso:** —

**Próximo passo:** **Fatia F-G2 do Circuito CooperToken** — super-admin provisiona novo parceiro/cooperativa + cooperados a nível SISGD. Fase 1 read-only obrigatória.

**Pendente após próximo:** Fatias C/D/E/G do Circuito CooperToken → Módulo Contabilidade Tributária Segregada.

**Carry-overs (não-bloqueantes):**
- Smoke E2E manual Luciano via celular (golden path F-G1 destravado — convite Clínica teste com token `e1bb49fe...b007b`, OTP zerado, válido até 12/06).
- 6 débitos abertos da sessão: D-novo-OTP-429-UX P3 · D-novo-OTP-DEV-RELAX P3 · D-novo-AUTO-INSCREVER-DEPRECATION P3 · D-novo-CAD-CONSUMO-MENSAL P2 · D-novo-CONVITE-MENUS-UX P3 · D-novo-TESTS-MOCK-PRISMA P2.
- Carry-overs anteriores: D-novo-PORTAL-EMPRESA-SEED-TESTE P3 · D-novo-DEV-LAN-ACCESS P3 · 7 débitos `/cadastro` sessão 04/06 · D-novo-CT-VALIDACAO-FISCAL P0 · D-novo-CT-MULTI-REGIME-CLASSIFICACAO P1 · D-novo-BM P0 BLOQUEADOR PRÉ-PROD · 256 legados allowlist `lint:tenant`.

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 05/06 tarde-noite fechamento M23).
> Detalhe: `docs/sessoes/2026-06-05-hardening-golden-path-conv-ref.md`.

---

## ONDE PARAMOS — 2026-06-05 (Code — M22 Fatia F-G1 Circuito CooperToken + Opção A + WA honesto)

**4 commits trabalho** em 1 sessão Code (+ commit fechamento):

| Hash | Tipo | Marco |
|---|---|---|
| `a99a7f2` | feat | Fatia F-G1 — convite indicação web (admin) + cooperado institucional fantasma + Opção A perfil COOPERADO + créditos no Financeiro |
| `4690a5d` | fix | pós-F-G1 — SUPER_ADMIN seletor coop + nome dinâmico no WA (zero hardcode "CoopereBR") + login bootstrap |
| `fc4cc24` | fix | login box dev — 4 cards (SUPER_ADMIN + ADMIN + COOPERADO + Empresa) |
| `9291d32` | fix | whitelist `+5527999479097` permanente + `WhatsappEnvioResult` (D-novo-WA-DEV-FALSE-OK) |
| `<próximo>` | docs | fechamento desta sessão (M22) |

**Em curso:** —

**Próximo passo:** **Fatia F-G2 do Circuito CooperToken** — super-admin convida novo parceiro/cooperativa + novos cooperados a nível SISGD (mapear criação de tenant: provisionamento `Cooperativa` + admin inicial + onboarding via convite institucional).

**Pendente após próximo:** Fatias C/D/E/G do Circuito CooperToken → Módulo Contabilidade Tributária Segregada.

**Carry-overs (não-bloqueantes):**
- Smoke E2E manual Luciano: convite admin web → WA recebido no `+27999479097` → `/cadastro?conv=` no celular → aprovar/rejeitar (golden path F-G1).
- 3 débitos novos da sessão: D-novo-CAD-CONSUMO-MENSAL P2 + D-novo-CONVITE-MENUS-UX P3 + D-novo-TESTS-MOCK-PRISMA P2.
- 7 débitos `/cadastro` da sessão 04/06 (alguns resolvidos estruturalmente).
- D-novo-PORTAL-EMPRESA-SEED-TESTE P3 + D-novo-DEV-LAN-ACCESS P3 (remover antes prod).
- Slim `/convite-convenio/[token]` deprecation 1 sprint.
- D-novo-CT-VALIDACAO-FISCAL P0 (gate fiscal) + D-novo-CT-MULTI-REGIME-CLASSIFICACAO P1 + D-novo-BM P0 BLOQUEADOR PRÉ-PROD.
- 256 legados allowlist `lint:tenant`.

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 05/06 fechamento M22).
> Detalhe: `docs/sessoes/2026-06-05-fatia-fg1-cooper-token-ajustes.md`.

---

## ONDE PARAMOS — 2026-06-04 (Code — M21 Sprint Multi-Frente: Portal Empresa + F1 + Convergência + CooperToken)

**11 commits trabalho** em 1 sessão Code maratona (10 feats/fixes + 1 commit fechamento):

| Hash | Tipo | Marco |
|---|---|---|
| `0d698d4` | feat | Sprint Financeiro F1 — emissão consolidada com retry + statusEmissao separado |
| `695e574` | feat | Portal Empresa 9.0 — perfil EMPRESA_CONVENIADA + guard + 9 endpoints + seed dev |
| `6eaa7a6` | feat | Portal Empresa 9.1 — dashboard /conveniada/convenio/[id] + decidir in-portal |
| `bfad278` | chore | HOTFIX BUG1 CORS+API_URL LAN (acesso celular via IP) |
| `4fb9a0c` | fix | HOTFIX BUG2 decidir in-portal sem magic link + 9 specs |
| `baf7fc1` | fix | HOTFIX diag erro detalhado em DEV no /auto-inscrever |
| `9f18e13` | docs | 7 débitos auditoria /cadastro |
| `badeb5f` | feat | Convergência Fatia 1 backend — DTO strict + REMOÇÃO UC-fake + upload-doc + 35 specs |
| `0559660` | feat | Convergência Fatia 2 wizard — /cadastro?conv= + OTP gate + uploads + LGPD + smoke 9/9 |
| `feda124` | feat | Circuito CooperToken Fatia A+B (portal nomenclatura + bonusIndicacao configurável) |
| `<próximo>` | docs | Fechamento desta sessão |

**Em curso:** —

**Próximo passo:** Fatia F-G1 do Circuito CooperToken (cooperativa cria/envia convite de indicação pela web — atribuição C salvo decisão contrária) + mover acesso do "Crédito de Energia" pra dentro do Financeiro → Meus Créditos + investigar erro `/portal/indicacoes` (provável perfil EMPRESA_CONVENIADA em endpoint de membro).

**Pendente após próximo:** Fatias C/D/E/F-G2/G do Circuito CooperToken → Módulo Contabilidade Tributária Segregada.

**Carry-overs (não-bloqueantes):**
- Smoke E2E real Luciano manual: portal empresa via celular, /cadastro?conv= via WA, aprovar/recusar in-portal.
- D-novo-PORTAL-EMPRESA-SEED-TESTE P3, D-novo-DEV-LAN-ACCESS P3 (remover antes prod).
- 7 débitos /cadastro (3 P3 + 3 P2 + 1 P1) — alguns resolvidos estruturalmente.
- Erro `/portal/indicacoes` (investigar na Fatia F-G1).
- Slim deprecation 1 sprint pra remover /convite-convenio/[token] redirect.
- Convênio teste tem 1 membro "Smoke Convergência" + Dr. Race 1 em PENDENTE_APROVACAO_ADMIN.

> Frase canônica única em [`## FRASE DE RETOMADA — próxima sessão Code`](#frase-de-retomada--próxima-sessão-code) abaixo (Decisão 24 — local único, atualizada 04/06 fechamento M21).
> Detalhe: `docs/sessoes/2026-06-04-portal-empresa-convergencia-cooper-token.md`.

---

## ONDE PARAMOS — 2026-06-03 (Code — Sprint Convite-Convênio NÚCLEO BACKEND COMPLETO)

**7 commits trabalho** em 1 sessão Code maratona (6 feats + 1 chore + commit fechamento):

| Hash | Tipo | Marco |
|---|---|---|
| `d6a4a50` | feat | **Fatia 2a** — `ConviteConvenioMembro` per-recipient (20 cols) + `ConvitesConvenioService` + 4 endpoints admin (POST cria + GET lista + DELETE cancela + POST reenvia) + endpoint @Public `GET /publico/convites/:token` (defesa LGPD sufixo telefone) + feature flag `CONVITE_OTP_ATIVO` bloqueia caminho legado |
| `29e01c0` | feat | **Fatia 2b** — OTP 6 dígitos via WhatsApp pro telefone DO CONVITE (nunca pra outro): helpers `gerarCodigoOtp` + `gerarSaltOtp` (rotativo) + `hashOtp` sha256 + `compararOtp` constant-time `crypto.timingSafeEqual`. Política: TTL 10min + max 5 tentativas (bloqueio 1h) + max 3 reenvios (cooldown 60s). 2 endpoints @Public: `solicitar-otp` (5/min IP) + `validar-otp` (10/min IP). Smoke vivo: WA REAL entregue pro Luciano |
| `4c3ee0a` | feat | **Fatia 2c** — `/auto-inscrever` refatorado: DTO removeu `cooperativaId`+`convenioId` (anti-spoof) + EXIGE `token`+`otp validado` (janela 30min). Tenant + convênio resolvidos DO CONVITE. Consume-once via `update where {id, usedAt:null}` (P2025 = race 409). NÃO delega mais pra `cadastroWebV2` — cria Cooperado direto (`tipoCooperado=SEM_UC`) + chama `adicionarMembro` (PENDENTE + magic link). Tudo restante (UC/Contrato) vem na aprovação |
| `e4c7348` | fix | **Fatia 2c.1 HARDENING** — `/auto-inscrever` antes criava Cooperado e Membro SEM tx → janela Membro sem AprovacaoConvenioMembro. Solução: única `$transaction(IsolationLevel.Serializable)` envolvendo consume-once + cooperado.create + adicionarMembro(tx) + cross-ref. Removidos: helper `rollbackConviteUsedAt` + `cooperado.delete .catch` compensatório. Rollback nativo do Postgres faz o trabalho. 3 specs integrados verdes |
| `7b14287` | chore | **Higiene build** — `tsconfig.build.json` exclude `tmp_*.ts`+`**/tmp_*.ts`+`**/*smoke*.ts`. `.gitignore` bloqueia commits acidentais. Causa raiz: `tmp_smoke*.ts` órfãos no root quebravam o build (Fatia 2c). 5+5+1 órfãos limpos |
| `c432cb8` | feat | **Fatia 3** — Aprovação 3 portas. Schema +3 campos audit (documentacaoSolicitadaEm + aprovadoPorAdminUserId + rejeitadoPorAdminUserId rel Usuario). `ConvenioAprovacaoService` 550+ linhas com 8 métodos. **5 endpoints admin novos** (`listar-membros-pendentes` + `aprovar-admin` + `solicitar-documentacao` + `rejeitar-admin` + `reenviar-aprovacao-empresa`) + 1 refinado (DELETE rota por status: ATIVO=soft-delete legado, PENDENTE_*/REJEITADO_*/DESLIGADO=cleanup hard delete). **2 endpoints @Public** (`GET /publico/aprovacao-membro/:token` + `POST .../:token { decisao, motivo? }` com captura IP+UA pra audit). State machine 4 estados + GUARD strict admin NÃO PULA empresa |
| _(este)_ | docs | fechamento sessão 03/06 |

**Schema delta da sessão (aditivo, 2 `db push`):**

| Mudança | Origem |
|---|---|
| model NOVO `ConviteConvenioMembro` (20 cols) | Fatia 2a |
| ContratoConvenio.convitesMembro back-rel | Fatia 2a |
| ConvenioCooperado.convite back-rel | Fatia 2a |
| ConvenioCooperado.documentacaoSolicitadaEm | Fatia 3 |
| ConvenioCooperado.aprovadoPorAdminUserId + rel Usuario | Fatia 3 |
| ConvenioCooperado.rejeitadoPorAdminUserId + rel Usuario | Fatia 3 |
| Usuario.membrosAprovadosPorAdmin + membrosRejeitadosPorAdmin back-rels | Fatia 3 |

**215 membros + 3 convênios + 0 convites pré-existentes intactos.**

**11 endpoints novos no sprint (5 admin + 6 público):**
- Admin: 4 da Fatia 2a + 5 da Fatia 3 + DELETE refinado = 10
- Público: 1 Fatia 2a + 2 Fatia 2b + 1 Fatia 2c.1 + 2 Fatia 3 = 6

**State machine ConvenioCooperado (Fatia 3 cravou):**

```
PENDENTE_APROVACAO_EMPRESA (criado via auto-inscrever 2c.1)
    ├─ empresa magic link APROVAR → PENDENTE_APROVACAO_ADMIN
    ├─ empresa magic link REJEITAR → MEMBRO_REJEITADO_EMPRESA + motivo
    ├─ admin DELETE → cleanupPendente (hard delete + magic link + clear convite cross-ref)
    └─ admin REENVIA → regen token + WA

PENDENTE_APROVACAO_ADMIN
    ├─ admin APROVA → MEMBRO_ATIVO + ativo=true ← ENTRA NA CONSOLIDADA
    ├─ admin SOLICITA DOC → mantém status + N DocumentoCooperado PENDENTE
    └─ admin REJEITA → MEMBRO_REJEITADO_ADMIN + audit userId

MEMBRO_REJEITADO_* / MEMBRO_DESLIGADO → terminais
```

GUARD strict: **admin NÃO PULA empresa** (decisão Luciano). Em PENDENTE_APROVACAO_EMPRESA admin só DELETE/REENVIAR.

**Especificações OTP travadas:**
- TTL 10min · max 5 tentativas (bloqueio 1h) · max 3 reenvios · cooldown 60s · hash sha256+salt rotativo + timingSafeEqual constant-time

**Atomicidade ($tx Serializable em todos os pontos críticos):**
- `/auto-inscrever`: consume + cooperado + adicionarMembro + cross-ref (Fatia 2c.1)
- `decidirAprovacaoEmpresa`: update aprovacao + updateMany membro guard status (Fatia 3)
- `aprovarPorAdmin`: updateMany membro guard status (Fatia 3)
- `solicitarDocumentacao`: update membro + upsert N DocumentoCooperado (Fatia 3)
- `rejeitarPorAdmin`: updateMany membro guard status (Fatia 3)
- `cleanupPendente`: deleteMany aprovacao + updateMany convite + delete membro (Fatia 3)

**5 smokes vivos rodados:**
1. Fatia 2b: WhatsApp REAL pro Luciano `5527981341348` com código OTP entregue
2. Fatia 2c E2E: auto-inscrever criou Cooperado + Membro PENDENTE + AprovacaoConvenioMembro atomicamente
3. Fatia 2c.1 atomicidade (3 specs integrados verdes — sucesso + rollback total + consume-once race)
4. Fatia 3 magic link empresa: GET + POST APROVAR + 2º POST 409 single-use + audit IP/UA capturado
5. Cleanup E2E pós-smoke (respeitando FKs)

**Specs (85 novos no sprint, suite convenios 187/187):**
- `convenios-membros-origem.spec.ts` (Fatia 1): 11/11
- `convites-convenio.service.spec.ts` (Fatia 2a): 25/25
- `convites-convenio-otp.spec.ts` (Fatia 2b): 23/23
- `publico-auto-inscrever-atomico.spec.ts` (Fatia 2c.1): 3/3
- `convenios-aprovacao.service.spec.ts` (Fatia 3): 26/26

**Estado:**
- **Backend do Sprint Convite-Convênio = 100% funcional + atômico.**
- **Convênio médico Caso 1 D-FISCAL-2.4 segue intacto.**
- **CV-2026-0001 smoke E2E real ainda pendente Luciano** (carry-over).
- **Frontend ZERO** — endpoints sem UI.
- **Notificações in-app only** — WA/email rich = Fatia 6.

**Próximo bloco — Fatia 4 frontend** (`/convite/[token]` 3 etapas + `/aprovacao-membro/[token]` página empresa decidir).

**Detalhe:** `docs/sessoes/2026-06-03-sprint-convite-convenio-nucleo-backend.md`.

**Decisões aplicadas:**
- Decisão 23 (Fase 1 read-only) — 4 vezes (Fatia 2 inicial, reframe OTP, Fatia 2c, Fatia 3)
- Decisão 24 (frase de retomada local único) — preservada
- Regra rebuild + verificar dist — aplicada em cada commit (grep no dist)
- Regra `isAmbienteReal()` em endpoints dev
- Regra contatos teste 14/05 — usado nos 5 smokes
- Regra HELP obrigatório 19/05 — textos cravados pra Fatias 4-5
- Padrão `ConviteProprietarioService` M31 (token 64 hex + TTL 7d + idempotência reuso) espelhado em 2 services
- Schema aditivo sem `--accept-data-loss`
- `$transaction Serializable` em transições críticas
- `@TenantResource + @AuditLog` em handlers admin novos
- Admin NÃO PULA empresa (decisão Luciano)
- Token single-use (`usedAt + decisao`) + magic link defesa LGPD (sufixos)

---

## ONDE PARAMOS — 2026-06-02 noite tarde (Code — Finalização Convênio Médico + HOTFIX + D-FISCAL-2 FECHADO + Sprint Convite-Convênio Fatia 1)

**7 commits trabalho** em 1 sessão Code maratona pós-M20 (continuação do dia 02/06):

| Hash | Tipo | Marco |
|---|---|---|
| `cfb4208` | feat | **Ponto 1 D-novo-CAD-CUSTEADO-FATURA** — toggle "Modo teste" no wizard libera fatura obrigatória + relaxa validators dos Steps 0/2/3 + `MotorPropostaService.aceitar:683` no early-return 0 UCs chama `adicionarMembro(tx)` ANTES (preserva vínculo do convênio sem UC). Cooperado marcado `ambienteTeste=true`. |
| `3665099` | feat | **Ponto 2a D-novo-CT-TARIFA-FIXA-EMPRESA** — schema aditivo: enum `TipoTarifaEmpresa { PERCENTUAL_DESCONTO \| VALOR_FIXO }` + 2 campos `ContratoConvenio.tipoTarifaEmpresa` + `tarifaFixaKwhEmpresa`. Default PERCENTUAL_DESCONTO preserva 3 vivos. Service 2 ramos + ConvenioCusteioBloco.tsx select tipoTarifa nativo. |
| `37fa529` | docs | **3 débitos** pós-investigação 6 sub-agentes: **D-novo-SEC-AUTOINSCRICAO-CUSTEADA P1** (vetor fraude — link `?conv=` divulgado aberto vira fraude financeira contra empresa pagadora) + **D-novo-PORTAL-CUSTEADO P2** (membro custeado vê portal vazio sem aviso "você é custeado pela empresa X") + **D-novo-CONVITE-CONVENIO P1 reframe** (sprint próprio com aprovação dupla). |
| _(implícito 12bff1e)_ | chore | **HOTFIX tsconfig.build** — adicionado `src/agents/**` no exclude. **Root cause** descoberto: pasta untracked criada 31/05 com 15 erros TS quebrava o build inteiro do backend há 3 dias, `nest build` emitia parcial com exit code != 0, `pm2 restart` nunca disparava, dist ficava velho. Fix consolidado no commit Fatia 1. |
| `2666412` | feat | **D-FISCAL-2.5 lente fiscal read-only** — `/dashboard/contabilidade/convenios` repurposado no mesmo URL (evita órfão) como lente Art. 79/86/88 sobre `ContratoConvenio` legado. Páginas `novo/` + `[id]/editar/` deletadas. ConveniosCtController `@deprecated` + WARN no boot. Convenio CT órfão "teste" deletado (0 FK). Endpoint `/convenios/:id/movimentos-contabeis` legado intacto. Sidebar label "Convênios (lente fiscal)". |
| `13eb1d7` | docs | **D-FISCAL-2.6** — linha 46 de `2026-05-31-conformidade-contabil-multi-regime.md` substitui "convenio Hangar Academia (cooperado PJ que financia custeio)" por "convênios de custeio recebido (Caso 1 D-FISCAL-2.4 — empresa terceira paga a conta de N cooperados, ex.: clínica custeando médicos cooperados)". Grep `hangar` agora zero ocorrências. |
| `12bff1e` | feat | **Sprint Convite-Convênio Fatia 1/8 — schema delta** — 100% aditivo. enum `StatusMembroConvenio` +4 valores (PENDENTE_APROVACAO_EMPRESA/ADMIN + REJEITADO_*) + enum NOVO `AdmissionOrigem` (3 valores) + ConvenioCooperado +6 campos (origem ADMIN_MANUAL + 4 timestamps + motivoRejeicao + back-rel) + ContratoConvenio +2 quotas (limiteMembros, kwhAlocadoMaxMensal) + tabela nova `AprovacaoConvenioMembro` (magic link 10 cols). Validação: 3 convênios + 215 membros 100% intactos com origem ADMIN_MANUAL automática. Build limpo zero erros tsc após exclude src/agents. |

**HOTFIX em detalhe (lição operacional):**
- **Sintoma:** PATCH `/convenios/:id` retornava `400 "property tipoTarifaEmpresa should not exist"` apesar do source ter os campos.
- **Diagnóstico:** `npm run build` retornava exit code != 0 por 15 erros TS em `src/agents/` (pasta untracked criada 31/05, fora do `AppModule`). `nest build` é tolerante (emite parcial), mas o build do Ponto 2a (19:56) saiu com erro silencioso → `pm2 restart` nunca disparou → dist ficou velho 3 dias.
- **Fix imediato:** rebuild forçado → grep confirmou campos no dist → PM2 restart → smoke OK.
- **Fix preventivo:** `tsconfig.build.json` ganhou `src/agents/**` no exclude. Build agora zero erros.
- **LIÇÃO REGISTRADA:** "build passou" mentia. Sempre validar dist (`grep` no .js) após `npm run build`, especialmente quando há erros conhecidos em outras pastas.
- **D-novo-AGENTS-ORPHAN P3** pendente catalogar formalmente: deletar OU consertar OU `.gitignore` a pasta órfã (próximo housekeeping).

**Workflow investigação convite (6 agentes paralelos):**
Antes do reframe D-novo-CONVITE-CONVENIO, lançamos 6 sub-agentes para mapear vetor de fraude + gap UX. Achados: caminho `/cadastro` JÁ aceita `convenioCusteioId` no body (wired desde D-FISCAL-2.4.3) — qualquer link `?conv=` divulgado vira fraude. Portal cooperado custeado mostra Faturas/Saldo/Cobranças vazias sem aviso. `ConviteIndicacao` é MLM-shape inadequado. Padrão `ConviteProprietarioService` (M31) ideal pra reuso (token stateless + TTL 7d + `@Public()`).

**Sprint Convite-Convênio — Fase 1 mapeada (A-J) + 12 decisões travadas:**
1. **Auth empresa = HÍBRIDO** (magic link no núcleo + login portal como camada, mesmo endpoint).
2. Lock dropdown convênio quando `?conv=` = disabled.
3. Lock tipoCobranca = fixo CUSTEADA.
4. `?conv=` inválido = erro amigável.
5. Botão tela detalhe = dialog modal (MVP).
6. TTL magic link = 7d (consistência ConviteProprietario).
7. Quota = ambos opcionais (limiteMembros + kwhAlocadoMaxMensal).
8. **SEM_UC rejeitado pela empresa = fica PENDENTE pro admin** (não cancela cadastro).
9. Reenvio magic link = sim (pattern reusado).
10. AuditLog = 5 eventos (criação, aceite, aprovação empresa, aprovação admin, rejeições).
11. **Rate-limit = 3/h por CPF + 30-60/h por IP**.
12. Contador pendentes = badge sidebar.

**Estado atual:**
- **Convênio médico USÁVEL pelo admin** ponta-a-ponta (cadastro modo teste + tarifa fixa/% + consolidada + lente fiscal Art. 79/86/88).
- **Convite com aprovação dupla = sprint em andamento** (Fatia 1/8 entregue, restam 7 fatias ~20-26h).
- **Smoke E2E real CV-2026-0001 ainda pendente Luciano** (R$ 126.289,60 PERCENTUAL ou R$ 160.000,00 VALOR_FIXO@0.80).

**IDEIA NOVA (Luciano, 02/06 noite):** **Fatia 9 = portal self-service da empresa conveniada** — empresa gera e envia convite pros seus médicos via WhatsApp/email + aprova pendentes na própria tela. Vira perna "portal login" do híbrido. Depende de provisionar login portal pra empresa. Recomendação: WA+email primeiro, Telegram (net-new) a avaliar.

**Próximo bloco — Fatia 2 do Sprint Convite-Convênio** (backend admissão pública).

**Detalhe:** `docs/sessoes/2026-06-02-convenio-medico-finalizacao-e-convite-fase1.md`.

**Decisões aplicadas:**
- Decisão 23 (Fase 1 read-only) — 4 vezes (Ponto 1, Ponto 2a, D-FISCAL-2.5, Sprint Convite Fase 1).
- Decisão 24 (frase de retomada local único — esta seção é a fonte canônica).
- Regra rebuild backend obrigatório + verificar dist (formalizada pós-hotfix).
- Regra HELP obrigatório + selects NATIVOS dentro de Dialog/wizard (19/05).
- Schema aditivo sem `--accept-data-loss`; ritual PM2 (stop → port livre → db push → start) — 2× (Ponto 2a + Fatia 1).
- `isAmbienteReal()` em endpoints dev (NUNCA `NODE_ENV`).
- Regra contatos teste: `27981341348` + `lucbragatto@gmail.com`.
- `@TenantResource @AuditLog` em handlers novos.
- Padrão ConviteProprietarioService M31 como template canônico magic link.

---

## ONDE PARAMOS — 2026-06-02 noite (Code — M20 Sprint D-FISCAL-2.4 Caso 1 custeio 100% completa)

**8 commits trabalho** `80d3e75..14d0948` + 1 commit fechamento em 1 sessão Code maratona (8 sub-fatias incrementais 2.4.4a→f).

| Sub-fatia | Commit | Marco |
|---|---|---|
| 2.4.4a | `80d3e75` | Motor consolidado (`ConveniosCusteioService.gerarCobrancaConsolidada`) + UC sintética `CONSOLIDADOR-{convenioId}` + plano técnico "Consolidador de Custeio" (FIXO_MENSAL `custeadoPorConvenio=false`) + helper compartilhado `common/tarifa-helper.ts` (extraído de faturas.service, modo `throwIfNotFound`). Ciclo de módulos resolvido chamando prisma direto (não CobrancasService). |
| 2.4.4a.1 | `74858bb` | UC própria da empresa COM_UC entra no total (busca `Uc.findMany cooperadoId=pagador NOT startsWith 'CONSOLIDADOR-'`) + dedup defensivo `Map<ucId>` evita double-count. |
| 2.4.4a.2 | `f593917` | **INVARIANTE custeado⟺consolidado**: filtro `prisma.contrato.findMany({where: {ucId in candidatas, status: ATIVO, plano: { custeadoPorConvenio: true }}})`. UC entra no consolidado ⟺ tem contrato custeado. **Garantia matemática zero double-bill.** |
| 2.4.4b | `b2e0cad` | Cron `gerarConsolidadasMensalCusteio` `@Cron('0 4 * * *') @AsPlatform()` (mês FECHADO anterior) + `GET /convenios/:id/cobrancas-consolidadas` + `POST .../gerar?mesReferencia=YYYY-MM` `@AuditLog` + `emitirNoGateway` private (3 guards: gateway nulo / `!isAmbienteReal()` PULA dev / sem formaPagamento). |
| 2.4.4c | `3fa9a34` | Hook `darBaixa` roteia: `convenioContabilCobrancaId != null` → `criarLancamentoConvenioContrato` (natureza convênio AUXILIAR/PRÓPRIO) **SUBSTITUI** CT.3 default. Best-effort não reverte pagamento. Descricao usa `cobranca.id` completo. |
| 2.4.4d | `9a201cb` | Tela admin `/dashboard/convenios/[id]/cobrancas-consolidadas/page.tsx` (tabela + Dialog Gerar + Dialog Estornar + HelpBox) + `POST .../estornar` `@AuditLog` + service `estornarCobrancaConsolidada` (gate apuração FECHADA via `prisma.apuracaoMensalSegregada.findFirst` busca direta). |
| 2.4.4e | `a135934` | DTO Create/Update aceita 5 campos custeio (`pagador, pagadorCooperadoId, baseCobrancaCusteio, kwhAlocadoMensal, descontoKwhCusteio`) + helper `validarBlocoCusteio` + `ConvenioCusteioBloco.tsx` novo componente (select pagador + revela campos quando EMPRESA + HelpBox). Reusado em /novo + /editar. |
| 2.4.4f | `14d0948` | Bug fix: ALOCACAO_FIXA gera sem membros (early-return SEM_MEMBROS movido pra branch CONSUMO_REAL) + 3 banners feedback (CRIADA verde main / JA_EXISTE azul dialog / SEM_MEMBROS amber dialog). Dialog mantém-se ABERTO em info importante. |

**Validação:** 200/200 specs verde · `lint:tenant` zero novos · zero regressão · backend rebuild + restart PM2 OK em todas as 8 sub-fatias · frontend `npm run build` + `pm2 restart cooperebr-frontend` aplicado (lição BN: HMR NÃO basta pra componente novo — reaberta uma vez na 2.4.4e e corrigida).

**Descobertas arquiteturais (Decisão 23 aplicada 8× na sessão):**
- **Ciclo de módulos NestJS** Convenios→Cobrancas→Whatsapp→MotorProposta→Convenios não resolve com forwardRef em ambos os lados — solução foi **quebrar a dep** e chamar prisma direto.
- **Invariante 2.4.4a.2 só funciona** se descrição do lançamento usar `cobranca.id` completo (não slice 8) — ajuste cirúrgico em darBaixa pro estorno achar.
- **`isAmbienteReal()` PULA emissão real em dev** — fail-safe, sem mexer em dados do Cooperado (regra contatos teste 14/05 sem invasão).
- **ALOCACAO_FIXA gera sem membros** (decisão produto 02/06): pacote fixo independe de membros.

**Smoke real pendente:** CV-2026-0001 "Clinica teste" (ALOCACAO_FIXA 200000 kWh × 20% desc) PRONTA pra Luciano testar — `/dashboard/convenios/cmpwof5h6000avaf8547cj3pb/cobrancas-consolidadas` → "Gerar agora" maio/2026 → R$ 126.289,60 esperado.

**Próximo bloco — 3 caminhos válidos (Luciano decide):**

1. **Smoke E2E real CV-2026-0001** (~10min — valida ponta-a-ponta).
2. **D-FISCAL-2.5** (aposentar `/dashboard/contabilidade/convenios` + migrar 1 Convenio CT existente → ContratoConvenio consolidado).
3. **D-FISCAL-2.6** (corrigir relatório `docs/relatorios/2026-05-31-conformidade-contabil-multi-regime.md` removendo exemplo Hangar errado).

Recomendação: começar por (1).

**Detalhe:** `docs/sessoes/2026-06-02-dfiscal-244-caso1-completo.md`.

**Decisões aplicadas:**
- Decisão 23 (Fase 1 read-only) — 8 vezes na sessão (uma por sub-fatia).
- Regra HELP obrigatório 19/05 — HelpBox + 3 banners feedback + tooltip botões.
- Regra selects NATIVOS 19/05 — todos os dropdowns (pagador / cooperados / base / mês).
- Regra rebuild backend obrigatório.
- Regra D-novo-AS/BN (HMR NÃO basta pra componente novo) — reaplicada na 2.4.4e.
- Regra `isAmbienteReal()` (NUNCA `NODE_ENV`).
- Transações Prisma Serializable em operações multi-modelo.
- `@AsPlatform()` cron + `@TenantResource @AuditLog` endpoints.
- Ciclo de módulos: quebrar dep em vez de forçar forwardRef.

---

## ONDE PARAMOS — 2026-06-01 noite tarde (Code — M19 D-FISCAL-2.4.2 + 2.4.3 Caso 1 custeio)

**2 commits trabalho** `e265e63..07ae417` + 1 commit fechamento em 1 sessão Code (continuação do arco D-FISCAL-2 iniciado na sessão da tarde com 2.4.1).

| Sub-fatia | Commit | Marco |
|---|---|---|
| D-FISCAL-2.4.2 | `e265e63` | Plano global "Custeado por convênio" via seed idempotente (`PlanosService.onModuleInit`) + 3 guards bloqueando geração individual: GUARD #1 `gerarCobrancaPosFatura` (Path A — marca fatura APROVADA + `statusRevisao=AUTO_APROVADO_CUSTEIO_CONVENIO` + return null) · GUARD Path B `aprovarFatura` for-loop (`continue` + aviso) · GUARD #2 `cobrancas.create` (`BadRequestException` com nome do plano + número do contrato). Help: HelpBox azul + badge "Custeado — sem cobrança" em `/dashboard/planos`. Spec novo: 3 casos. |
| D-FISCAL-2.4.3 | `07ae417` | `AceitarPropostaDto.convenioCusteioId?` opcional + `MotorPropostaService.aceitar`: validação ANTES da tx (NotFound/Forbidden/BadRequest pagador≠EMPRESA) → override `planoId = plano custeado global` + chama `conveniosMembros.adicionarMembro(convenioId, cooperadoId, undefined, tx)` dentro da MESMA `$transaction(Serializable)` do Contrato. `ConveniosMembrosService.adicionarMembro` aceita `tx?: Prisma.TransactionClient` (4º param) — quando presente, usa `db = tx ?? this.prisma` e pula side effects MLM. Endpoint público `GET /publico/convenios-pagador-empresa?tenant=X` minimal. UI admin Step3: toggle + HelpBox amarela + select nativo (esconde planos+simulação, sintetiza `resultadoMotor` do consumo). UI público: bloco "Tipo de cobrança" com radio nativo + select nativo + banner azul (esconde simulação + cards). `PlanosService.findAtivos` filtra `custeadoPorConvenio=false`. Spec novo: 6 casos. |

**Validação:** 141/141 specs verde em motor-proposta + convenios + publico + cobrancas + planos · backend rebuild + restart PM2 OK · endpoint público responde · idempotência confirmada após 2 restarts.

**Descoberta arquitetural (Fase 1 read-only):** Schema delta `PropostaCooperado.convenioCusteioId` proposto no escopo original foi **DESNECESSÁRIO** — público aceita no mesmo request (`cadastroWebV2` chama `motorProposta.aceitar` imediatamente), então `convenioCusteioId` viaja em memória do front → controller → service. Zero migração, zero `--accept-data-loss`. Decisão aprovada pelo Luciano antes de Fase 2 (reportado e respondido).

**Próximo bloco — D-FISCAL-2.4.4 (Motor cobrança consolidada)**

Estimativa **~6-10h Code**. Escopo:
1. Service `varrer membros custeados por convênio EMPRESA + somar kWh do mês (via FaturaProcessada)`.
2. Gerar UMA `Cobrança` por convênio EMPRESA por mês → `pagadorCooperadoId` (campo schema 2.4.1) recebe a cobrança consolidada.
3. Hook Design B: `Cobranca.convenioContabilCobrancaId` (schema 2.4.1) liga cobrança consolidada ao `ContratoConvenio` pra trilha contábil Auxiliar Art. 88.
4. Cron mensal (`@AsPlatform()` obrigatório) dispara o motor.
5. Frontend admin: tela `/dashboard/convenios/[id]/cobrancas-consolidadas` listando + estornando.

**Detalhe:** `docs/sessoes/2026-06-01-dfiscal-242-243-custeio-convenio.md`.

**Decisões aplicadas:**
- Decisão 23 (Fase 1 read-only antes de tocar código) — Fase 1 reportou 7 achados em <200 palavras, 3 perguntas decisórias, Luciano respondeu OK explícito antes de Fase 2.
- Regra HELP obrigatório (19/05) — HelpBox amarela admin + banner azul público + banner amarelo Step4.
- Regra selects NATIVOS (19/05) — `<select>` puro em admin + público.
- Regra rebuild backend após mudança — `pm2 stop` → `npm run build` → `pm2 start` nas 2 sub-fatias.
- Atomicidade via Prisma transaction Serializable — vínculo `ConvenioCooperado` no aceite dentro do `$transaction` do Contrato.
- Multi-tenant + `Math.round` monetário em todos os caminhos novos.

---

## ONDE PARAMOS — 2026-06-01 noite (Code — Arco Contabilidade + Convênios CT.7→CT.9.1 + Decisões fiscais estruturais)

**5 commits trabalho** `12ca409..d953381` + 1 commit fechamento em 1 sessão Code (arco "Contabilidade + Convênios fechados").

| Fatia | Commit | Marco |
|---|---|---|
| CT.7 | `12ca409` | PDFs autenticados via blob (404→200) + apuração estado consciente (FECHADA esconde Fechar; mostra Validar/Reabrir condicional) + 3º botão "Repasses PDF" |
| PUX-A | `4cf71d2` | Padrão UX esclarecido 01/06 (Dialog OK pra ações; página própria SÓ pra cadastro/edição); `<HelpBox>` componente reusável; Convênio criar/editar virou `/convenios/novo` + `/[id]/editar`; ConvenioForm + ConvenioHelp; lista refatorada (Pencil = navegação) |
| CT.8 | `d086550` | Classificação INLINE Tipo A do Plano de Contas Segregado (22 pendentes destravadas); multi-tipo via `useTipoParceiro` (CONSORCIO/ASSOC/CONDOMINIO bloqueiam `naturezaCooperativa` — enforcement P0-1); aviso enganoso `/configuracoes/financeiro` removido |
| CT.9 | `61bbc7e` | Movimento de convênio: `POST /convenios/:id/movimentos` síncrono → `LancamentoCaixa` Auxiliar (Art. 88) com gate FECHADA reusado; histórico GET; UI `MovimentosConvenioSection` + Dialog Tipo C + HelpBox neutro; **Tarefa 0a sweep "Walter" 11 docs**; D-FISCAL-2 antecipado (decisão B PLANO-GLOBAL-VS-TENANT) |
| CT.9.1 | `d953381` | Bugfix smoke: timezone competência (01/08 não vira mais 31/07) + estorno do movimento (DELETE endpoint + Dialog Tipo C) + sweep "Walter" 8 arquivos código + grep final ZERO |

**Validação:** 284 specs verdes ✅ · build backend+web OK · lint:tenant 45/300 com decorator (0 novos sem) · `grep -rn "Walter"` em `web/app web/components backend/src` exceto `.spec.` = **0 ocorrências**.

**Decisão UX esclarecida 01/06 (refina 31/05):**

| Cenário | Padrão CORRETO | Status |
|---|---|---|
| Cadastro/edição de entidade | **Página própria** `/dashboard/X/[id]/editar` | Mantém (Tipo B 17/05) |
| Ação contextual (validar/fechar/estornar/aprovar/marcar pago/remover) | **Dialog Tipo C** | ✅ Reabilitado |
| Visualização auxiliar | Inline expansível OU seção da página própria | Mantém |
| Edição célula relação | Inline célula | Mantém |
| Help inline em toda página/funcionalidade | **`<HelpBox>`** | ✅ Obrigatório (regra 19/05) |

Razão da revisão: "banir Dialog modal completamente" (31/05) foi exagero. Dialog **continua válido** pra ações simples — banimento permanece **apenas** pra cadastro/edição de entidade (que vão pra página própria).

**Decisões fiscais estruturais (Sessão de Validação Fiscal Interna 01/06):**

1. **D-FISCAL-1 — Classificação do convênio CT é CONFIGURÁVEL** (P1) — naturezaAto depende do **critério econômico**: "cooperativa fica com sobra/resultado (mesmo se repassada ao dono)?" SIM=Próprio, NÃO=Auxiliar. 4 travas pra Art. 88.

2. **D-FISCAL-2 — Consolidação do convênio único** (P1 SPRINT) — `ContratoConvenio` legado absorve `Convenio` CT.2 + flag fiscal `naturezaAtoCooperativo` + `geraLancamentoContabil` + reaproveita motor `criarLancamentoConvenio` + aposenta `/contabilidade/convenios` + migra 1 convênio CT existente. **Próximo Code arranca por Fase 1 read-only.**

3. **D-FISCAL-MLM — Hangar Academia ≠ Art. 88** (P2) — relatório 2026-05-31 cita Hangar como exemplo de auxiliar; ERRADO (Hangar é captação+MLM). Provavelmente Art. 86. Thread separada.

4. **Caso médico** (validado 01/06): empresa médica cooperada custeia energia dos médicos cooperados em usina cessão → estrutura **PRÓPRIO** (cooperativa retém resíduo) com fluxo via Contas a Receber + Contas a Pagar (Design B do D-novo-CT-CONVENIO-HOOK já resolvido).

**Correção operacional "Walter":** era referência de memória perdida — NÃO existe contador externo. Quem valida é **Luciano + orquestrador**. Sweep aplicado em 11 docs (CT.9) + 8 arquivos de código (CT.9.1) + 3 specs ajustados. `D-novo-CT-GATE-WALTER` renomeado `D-novo-CT-VALIDACAO-FISCAL`. Histórico (`docs/historico/`) preservado.

**Próximo bloco — Sprint D-FISCAL-2 (Consolidação do convênio único)**

Estimativa **~12-20h Code** (sprint substancial). Ordem das fatias propostas (a refinar na Fase 1):
1. **Fase 1 read-only profunda** (~1-2h) — mapear ContratoConvenio + diff com Convenio CT + plano migração
2. Schema delta aditivo: campos novos no ContratoConvenio (flags fiscal)
3. Estender service criarLancamentoConvenio pra ler flag do ContratoConvenio
4. UI: incorporar campos fiscais no formulário existente + HelpBox com critério das 4 travas
5. Hook em Cobranca/ContaAPagar com convenioId opcional (Design B)
6. Migração do 1 convênio CT existente
7. Deprecar `/dashboard/contabilidade/convenios` → redirect

**Detalhe:** `docs/sessoes/2026-06-01-contabilidade-convenios.md`.

**Decisões aplicadas (todas pré-existentes):**
- Decisão 23 (Fase 1 read-only antes de tocar código) — todas as 5 fatias
- Ritual PM2 (stop → port livre → generate → push → restart) — CT.9 schema (idempotente)
- Regra fechamento bilateral 13/05 — esta sessão fechada
- Regra não-paralelo claude.ai 17/05
- Select nativo dentro de Dialog (regra 19/05)
- Build incremental BN (`cd web && npm run build` + restart frontend)
- Lint tenant baseline+ratchet — 5 commits sem novos sem decorator

---

## ONDE PARAMOS — 2026-05-31 noite (Code — Sprint Contabilidade Tributária ESTRUTURA COMPLETA + Sprint Polimento UX catalogado)

**7 commits** `5ada766..93f38da` em **1 sessão Code maratona** entregaram:

| Fatia | Commit | Marco |
|---|---|---|
| CT.1 | `5ada766` | Schema base multi-regime + 6 enums + 2 models (Convenio + ApuracaoMensalSegregada) + migração + seed |
| CT.2 | `f95bbef` | `RegimeContabil` interface + 4 impl (1 ativa + 3 stubs P0-1) + Convenio CRUD multi-tenant |
| CT.3 | `b3cba3c` | Hooks fire-and-forget (Cobranca/ContaAPagar/Repasse) → LancamentoCaixa classificado + idempotência `@@unique` + migration SQL manual preservou 58 lançamentos |
| CT.4 | `27df9e5` | Motor `apurarMes` (preview) + `fecharApuracao` (snapshot imutável) + `validarApuracao` (Luciano + orquestrador) + `reabrirApuracao` (SA) + bloqueio retroativo CT.3 + `ConfiguracaoTributaria` (zero hardcoded) |
| CT.5 | `95eb755` | 4 DREs (Geral/Próprio/Auxiliar/Não-Coop) com terminologia NBC ITG 2004 (ingressos/dispêndios) + badge GATE VALIDAÇÃO FISCAL |
| CT.6 | `6a2324e` | 3 PDFs defensáveis (Não-Lucratividade + Memorial Fiscal + Repasses) com watermark + 4 telas Next.js + sidebar Contabilidade Tributária + banner help |
| Estorno (fora escopo CT) | `93f38da` | Backend estorno repasse + visibilidade ciclo + gate apuração FECHADA. **Frontend Dialog vira refator PUX.4** |

**Validação:**
- **284 specs verdes** (89 novos: 30 apuração + 26 DRE + 17 relatórios + 16 estorno + 10 regime + 6 convenios + 4 factory) + 195 anteriores preservados
- `smoke-ct3.ts` 10/10 OK pré-CT.4 e pós-CT.6 (zero regressão hooks)
- `npm run lint:tenant` 0 handlers novos sem decorator nos 7 commits
- 8 alterações de schema aditivas via ritual PM2, zero `--accept-data-loss` (migration SQL manual CT.3 preservou 58 lançamentos)
- Build backend + web OK + restart PM2 (backend + frontend BN)

**Integração ponta a ponta verificada:**
```
RepasseProprietario (PAGO)
  ├── hook CT.3 → LancamentoCaixa.create (origemTipo=REPASSE, naturezaAto classificada)
  └── transação marcarPago → ContaAPagar (repasseAbatidoId + statusResolucao=RESOLVIDA)

ESTORNO (93f38da):
  ├── deleteMany LancamentoCaixa (libera @@unique)
  ├── updateMany ContaAPagar (desvincula despesas)
  └── Repasse → PENDENTE (idempotente: repagar recria)
        ↓
   Gate ApuracaoMensalSegregada (mes FECHADA) → bloqueia
        ↓
   DRE/Apuração leem LancamentoCaixa agregado (snapshot ou preview)
```

**Decisão UX vigente 31/05 (nova — banimento de telinhas):**

| Cenário | Padrão CORRETO | BANIDO |
|---|---|---|
| Criar/editar entidade | **Página própria** | Dialog/Sheet/Drawer |
| Ação contextual (fechar, estornar, aprovar) | **Inline expansível** | Dialog Tipo C |
| Visualização auxiliar (ciclo, histórico) | **Inline expansível** | Dialog |
| Edição célula (Membro×Usina) | **Inline célula** | (manter) |

Razão: Luciano não programa, perde fluxo em telinhas, precisa comparar dados lado-a-lado. Doc completa em `docs/arquitetura/padrao-ux-vigente.md`.

**Próximo bloco — Sprint Polimento UX (PUX.1→PUX.6 catalogado em `docs/debitos-tecnicos.md` D-novo-PUX P1):**

1. **PUX.1** — Componentes `<HelpBox>` + `<AcaoInlineExpansivel>` (4-6h)
2. **PUX.2** — Banir telinhas: refator Convenio CT.6 (Dialog→página própria) + Apuração (Dialog→inline) + DialogEstornar/DialogCiclo (→inline)
3. **PUX.3** — Help inline em TODAS as telas (regra 19/05 violada em plano-contas + convenios + repasses)
4. **PUX.4** — Refator frontend estorno (DialogEstornar+DialogCiclo → AcaoInlineExpansivel). Backend pronto.
5. **PUX.5** — Refator telas legadas (DialogMarcarPago + DialogCancelar repasses + despesas aprovar/rejeitar/resolver)
6. **PUX.6** — Lint UX (`npm run lint:ux` análogo ao `lint:tenant` — força help + proíbe Dialog em código novo)

**Estimativa total Polimento UX:** ~25-37h Code (3-5 sessões).

**Gates externos (não-Code):**

- **D-novo-CT-VALIDACAO-FISCAL P0** — validação interna (Luciano + orquestrador) precisa validar alíquotas/presunção + classificação repasse + 10 contas seed + 10 lançamentos amostrais + flag `isencaoPisCofinsAtiva` antes de uso fiscal real (DCTF/SPED). Estimativa: sessão dedicada 2-4h dele + 1-2h Code (já após PUX).
- **Advogado** — acompanhar STF Tema 536 (mai/jun 2026) que pode reverter isenção PIS/COFINS sobre ato próprio.

**Decisões aplicadas (todas pré-existentes):**

- Decisão 23 (validação prévia + Fase 1 read-only obrigatória) — 7 fatias
- Ritual PM2 (stop → port livre → generate → push → restart) — 7 alterações de schema
- Regra fechamento bilateral 13/05 — esta sessão fechada
- Regra não-paralelo claude.ai 17/05 — Code exclusivo
- Lint tenant baseline+ratchet — 7 commits sem novos sem decorator
- Build incremental BN (`cd web && npm run build` + `pm2 restart cooperebr-frontend`) — pós-CT.6 e pós-Estorno
- Zero `--accept-data-loss` — migration SQL manual CT.3

**Detalhe:** `docs/sessoes/2026-05-31-sprint-contabilidade-tributaria-completo.md`.

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

1. Confirmar que esta é NOVA conversa Code (não continuação de janela
   anterior). Verificar que subagent `cooperebr-qa-funcional` aparece
   na lista de agents. Se não aparecer, parar e avisar.

2. Rodar `git status --short`. Esperado pós-fechamento M49 (22/06):
   working tree limpo (exceto carry-over package.json/lock stashed +
   untracked .claude/.agent não-meus) — NUNCA `git add .` / `-A`.
   Último commit em main é o fechamento M49 (`docs(sessao): fechamento
   M49 ...`). `git log origin/main..HEAD --oneline` deve estar VAZIO.
   Branches preservadas no origin (cumulativas):
   `feature/d2-salvaguardas-origem`, `feature/hardening-throttler-
   reconciliacao`, `feature/convenio-origem-dado`, `feature/hardening-
   tenant-spoof`, `feature/convenio-fundacao-lifecycle` (M46),
   `feature/convenio-migracao` (M47), `feature/funil-roteador-engine`
   (M48 merge `e9db14b`), `feature/convenio-familia` (M49).

3. Rodar `pm2 list`. Esperado: cooperebr-backend + cooperebr-frontend
   + cooperebr-whatsapp online. Schema delta M49 (model
   AutorizacaoTokenFamiliar + Cooperativa.tokenFamiliarSacavel +
   Indicacao/ConviteIndicacao.familiar + totalTokensAbatidos default 0)
   JÁ APLICADO no banco dev — NÃO RODAR `prisma db push` a menos que
   próxima sprint tenha schema delta novo.

PASSO 1 — Frase COMANDANTE:

🟢 **FRENTE 2 (Vitrines Mínimas + Pipeline de Captação) FECHADA PONTA A PONTA em 01/07** —
7 commits limpos na main JÁ PUSHED, NÃO RE-APLICAR. 1ª passagem (manhã): FIX A `d343666` +
FIX B `4c16ef8`. 2ª passagem (tarde): B5 `b80cd8f` + C6 `c31d4eb` + C7 `a6cb7ba` +
smoke E2E `b5db215`. Doc-sessão retroativa 28/06 (`b9ddd99`).
- **B5** card `consumoStashOcr` no detalhe do cooperado — snapshot OCR existia no banco desde
  06/06 mas não aparecia em nenhuma tela.
- **C6** fix backend converter multi-tenant SUPER_ADMIN — bug latente M48 que bloqueava até
  o dono do SISGD. SUPER_ADMIN passa `cooperativaIdAlvo` validado (padrão M45) + service adota
  lead órfão (findFirst com OR aceita `cooperativaId=null`). ADMIN mantém JWT + destructure-discard.
  14 specs novos, suite `src/lead-expansao/` 23/23 verde.
- **C7** botão Converter no `/dashboard/relatorios/expansao` — Dialog com form obrigatório +
  seletor de parceiro condicional (só SUPER_ADMIN + lead órfão).
- **Smoke E2E do funil 6/6 verde** — motor M48 classificou "Cooperativa Solar Verde" como
  A_MIGRACAO com razão humano-legível + notificação admin no WA disparou em tempo real
  (regra contatos teste 14/05 respeitada).
- **Decisões travadas**: A_MIGRACAO/AMBIGUO_ADMIN fica DENTRO do tenant capturador (NÃO
  alimenta LeadExpansao — fluxos separados). Botão Converter entrou nesta fatia.
- **FIX A elo OCR→captação**: `web/app/cadastro/page.tsx` tela especial "créditos injetados"
  ganha input "Quem fornece sua energia hoje?" + payload manda `jaRecebeCreditosGd=true` +
  `fornecedorGdAtual`. Backend `publico.controller.cadastroWeb` V2 captura retorno de
  `cadastroWebV2` e dispara `notificarAdminRoteamentoCaptacao` fire-and-forget quando
  `roteamento.caminho === 'A_MIGRACAO' || 'AMBIGUO_ADMIN'`. Antes o motor M48 gravava
  metadata mas admin NUNCA era avisado — bug latente descoberto pelo orquestrador em E2E.
  Specs 6/6 verde + carona 4 regressões M48 latentes fechadas. Suite `src/publico/` 67/67.
- **FIX B vitrines**: badges de roteamento (🎯 A_MIGRACAO / ↪️ B_REDIRECT_PARCEIRO /
  ❓ AMBIGUO_ADMIN; C_NOVO SEM badge — evita ruído) na lista `/dashboard/cooperados` E no
  detalhe `[id]`. Tooltip com `roteamentoRazao`. Filtro por status na lista via `<select>`
  nativo (12 opções, padrão memória 19/05). Zero schema delta. TSC web exit 0. Rebuild feito.

Convênio cooperativizado COMPLETO (M44+M46+M47+M48+M49) + Faxina A/B (M50) + Hardening
Lateral (M51) + Faxina C-G (M52a) + Melt (M52b) + Frente 2 vitrines mínimas (01/07).
✅ Contador+advogado RESOLVIDOS/FAVORÁVEIS (Luciano 23/06 — apply liberado).

⚠️ As **3 PORTAS DE CONFIG** seguem o ÚNICO bloqueador de exposição pública: (1)
`AMBIENTE_REAL=true` (desliga impersonate — verificado 23/06 NÃO setado → impersonate ATIVO);
(2) `SUPER_ADMIN_SECRET_KEY` forte; (3) senha super-admin forte. Ações de CONFIG do Luciano.

PRÓXIMO = **ESCOLHA DO LUCIANO** entre 3 frentes (Frente 2 SAIU ponta a ponta com smoke E2E
verde; sobram):
- **3 portas de config** (abrir cadastro público / onboarding Santi — ação de CONFIG do Luciano,
  não é código).
- **Vitrines COMPLETAS do funil** (Camadas 2/3 — marketplace SISGD + vitrine pública do
  parceiro — spec do orquestrador necessária; motor M48 já roteia; Frente 2 fez só o
  observatório interno).
- **M52c escrituração retrospectiva** (R$ 741 passivo pré-M50 — tarefa de CÓDIGO).

**Sub-passo opcional antes**: smoke visual manual das vitrines novas (login SUPER_ADMIN →
`/dashboard/cooperados` badges/filtro/detalhe consumoStashOcr → `/dashboard/relatorios/expansao`
botão Converter/Dialog/seletor tenant). Smoke programático já rodou 6/6 verde.

> As opções (A)/(B) e o bloco "Hardening Lateral" ABAIXO são HISTÓRICO pré-M52 — Hardening
> Lateral=M51 ✅, Faxina C-G=M52a ✅, Melt=M52b ✅ já feitos. Vale a frase acima.

PRÓXIMO = **ESCOLHA DO ORQUESTRADOR** entre:

**(A) Camadas 2/3 do Funil — vitrines parceiro + SISGD marketplace**
(BLOQUEADAS estavam pelo Hardening Lateral; agora desbloqueadas pelo M51).
Spec do orquestrador necessária. Camada 1 (motor advisory M48) já roteia.

**(B) Sprint FAXINA FASES C-G (~12-18h)** — melt/painel/reconciliação:
- C: ligar `Convenio.naturezaAtoCooperativo` ao `LancamentoCaixa.naturezaAto`
  (fecha D-novo-FAXINA-BENEFICIO-CONVENIO-NATUREZA P1 +
  D-novo-FAXINA-SOCIAL-DESTINATARIO P2)
- D: investigar delta -729.86 + cron reconciliação
- E: painel admin Passivo/Forecast (estender cooper-token-financeiro)
- F: receita de melt (taxa QR + spread + quebra) — **ATIVAÇÃO REAL gated
  parecer Walter + tributarista** (estrutura pronta, OFF até lá)
- G: `$transaction` nos pares D+C (fix D-novo-FAXINA-PARTIDAS-NAO-ATOMICAS P2)

**Bloqueador inegociável** (confirmado analista-conformidade 22/06):
ativação de receita de melt em produção exige parecer Walter +
tributarista cooperativo.

Itens **"antes de empresa-cooperada PJ real"** acumulados (NÃO bloqueiam
desenvolvimento, BLOQUEIAM onboarding 2ª empresa): M47 DESLIGADO-SALDO
+ M47 hardcode-CoopereBR + M49 SAQUE-FAMILIAR-SEGMENTACAO-ORIGEM P2.

**DEPOIS** do Hardening Lateral: **Camadas 2/3 do Funil** (vitrines
parceiro + SISGD marketplace) — DESBLOQUEADAS.

Candidatas decision-independent paralelas:

**🔴 Sprint Hardening Lateral** (~10-14h) — **PRE-REQUISITO OBRIGATÓRIO
da Camada 3 do Funil (vitrine pública)**. IDOR sistêmico acumulando:
- 4 P1 M45 (CADASTRO-COMPLETO + MOTOR-PROPOSTA-PLANO + AUDITLOG-TENANT-ALVO-SA
  + HARDENING-CONTROLLERS-LATERAIS).
- 2 P2 M46 (CONVENIO-UPDATE-SEM-COOPID + CONVENIO-LISTAR-MEMBROS-SEM-COOPID).
- 2 P2 M47 (DESLIGADO-SALDO-RESIDUAL + MSG-MULTI-TENANT-PARCEIRO).
- **1 P1 M48** `D-novo-LEAD-EXPANSAO-PUBLIC-TENANT-SPOOF` — 3ª ocorrência
  do mesmo spoof M45 (POST /lead-expansao @Public aceita body.cooperativaId).
  Mesmo padrão fix do M45 (destructure-discard + ?tenant=).

**Camadas 2/3 do Funil** (vitrines parceiro + SISGD marketplace) —
BLOQUEADAS até Hardening Lateral fechar. Camada 1 entregue (motor advisory)
já grava metadata em 4 campos do Cooperado, esperando enforcement.

**M47 DESTAQUES — fechar antes de 2º parceiro real:**
- `D-novo-M47-DESLIGADO-SALDO-RESIDUAL` P2 — DESLIGADO via /rejeitar fica
  com tokens congelados inacessíveis. AuditLog mitiga, viola promessa E1.
- `D-novo-M47-MSG-MULTI-TENANT-PARCEIRO` P2 — mensagens WA hardcodam
  "CoopereBR". Bloqueia onboarding Consórcio/Associação/Condomínio.

**OPÇÃO A D-QUALIF-DECAY** (~6-10h) + **OPÇÃO C Notificações Proativas**
+ **Sprint Pipeline OCR + Concierge Integration** (hook
classificacaoScee + D-novo-ADAPTER-EXTRAI-CNPJ-GERADOR) seguem catalogadas.

Caminho ativação produção saque colaborador DESCONTO_FATURA: ✅ parecer +
✅ Salvaguardas 1/4/5 + ✅ Throttler+Reconciliação + ⏳ parecer escrito +
⏳ flag `.env` prod.

VISÃO FUNIL DE AQUISIÇÃO (Camadas 2/3 — pós-Hardening Lateral):
- Caso C (sem GD) vira CAPTADOR DE CLIENTE nas telas de cadastro público
  + admin ao subir fatura com crédito.
- Tela dedicada técnica do roteador A/B/C (motor M48 já decide; vitrine
  consome o `Cooperado.roteamentoCaminho`).
- Publicidade em 2 VOZES no funil:
  - Nível parceiro: "Venha pra {{cooperativa.nome}} e melhore sua economia".
  - Nível plataforma: "Consulte os parceiros do SISGD e melhore sua
    economia" (marketplace multi-tenant).
- Critério de atribuição lead → parceiro: região / escolha explícita /
  capacidade / placement-pago (decisão produto Luciano pra Camada 3).
- 4 débitos do roteador ainda abertos pra Camada 2/3: ADAPTER-EXTRAI-CNPJ-
  GERADOR P2, FATURA-PROCESSADA-CLASSIFICACAO-SCEE P2 (campo M48, hook
  deferido), LEAD-WHATSAPP-VS-EXPANSAO-CONFUSAO P3, CROSS-TENANT-
  NOTIFICATION P3.

ENTREGA M48 (referência):
- Schema delta aditivo: model AliasParceiroSisgd (tenant-aware + 6 seeds
  CoopereBR) + Cooperado += 4 campos roteamento* + FaturaProcessada +=
  classificacaoScee (hook deferido).
- RoteamentoCadastroService.decidirCaminho com 4 caminhos
  (C_NOVO/A_MIGRACAO/B_REDIRECT_PARCEIRO/AMBIGUO_ADMIN). Matcher: CNPJ
  com validação DV oficial (H2 — evita telefone como CNPJ) + alias ILIKE
  substring nos 2 sentidos. Cross-tenant intencional documentado.
- Wiring PASSIVO em 2 pontos (cooperados.create + publico.cadastroWeb).
  cooperativaId SEMPRE do JWT.
- cooperados findAll/findOne com `omit: roteamentoTenantAlvo`
  (anti-enumeração de parceiros SISGD).
- LeadExpansao.converter() endpoint admin + typed errors
  (LeadNaoEncontradoError + LeadJaConvertidoError).
- 23 specs Jest + smoke E2E REAL 3/3 PASS (motor silencioso).
- Reviewers multitenant + code-reviewer + re-review orquestrador
  APROVADOS COM RESSALVAS (2 HIGH + 3 P2 + 2 M + 2 L fixes pré-merge).
- Commits: `26201d8` (feat) + `e9db14b` (merge --no-ff).

ENTREGA M47 (referência — sprint anterior):
- Schema delta aditivo: StatusCooperado += PENDENTE_MIGRACAO + DESLIGADO;
  MigracaoUsina += 5 campos opcionais + 2 indexes.
- 2 guards billing MUST-FIX (cobrancas + convenios-custeio) contra
  double-charge SCEE.
- MigracaoExternaService + 3 endpoints admin (`/cooperados/:id/migrar*`)
  com cooperativaId SEMPRE do JWT (lição M45) + multi-tenant
  defense-in-depth + AuditLog forense saldo residual.
- Cron `@Cron('0 7 * * *')` timeout 30d + WA admin determinístico.
- Seed ModeloDocumento DESLIGAMENTO_CONCORRENTE tenant-agnóstico.
- Matcher bot WA inclui PENDENTE_MIGRACAO (exclui DESLIGADO).
- E3 confirmado: STATUS_PERMITIDOS_CREDITO bloqueia em 7 pontos.
- 30 specs Jest + smoke E2E REAL passou (2 WAs reais ENVIADA pro
  whitelist).
- Reviewers multitenant + financeiro-token + code-reviewer + re-review
  orquestrador APROVADOS COM RESSALVAS (fixes pré-merge aplicados).
- Commits: `5ee0aff` (feat) + `f36782b` (merge --no-ff).

ENTREGA M46 (referência — sprint anterior):
- TokenNotificacaoService + 2 métodos (notificarDistribuicaoConvenio +
  notificarAbateFatura). CooperTokenNotificacaoListener único consumindo
  RESGATADO + DISTRIBUIDO_CONVENIO com idempotência multi-tenant.
- E1 inline em removerMembro com ConfigCooperToken.valorTokenReais por
  tenant.
- 22 specs + smoke E2E real (whitelist).
- Commits: `79e5f1f` (feat) + `950d2c1` (merge --no-ff).

═══ (BLOCO LEGADO — referência ENTREGA design 19/06) ═══

Próximo: **#3 — Sprint Convênio MIGRAÇÃO (Fase 3 — G2 + G5 + rollback)**
— legalmente SEGURA (não exige parecer trabalhista). Aborda os débitos
do design 19/06:

- `D-novo-CONVENIO-G2-ESTADOS-MIGRACAO` P2 (Fase 3) — `StatusCooperado`
  não tem `PENDENTE_MIGRACAO`/`DESLIGADO`; `MigracaoUsina` é intra-coop;
  billing roda só em ATIVO sem distinguir estado de transição.
- `D-novo-CONVENIO-E2-MIGRACAO-FALHA-SEM-ROLLBACK` P2 (Fase 3) — sem
  timeout/alerta/rollback se migração da distribuidora concorrente
  falhar. Edge case E3 (oxidação cega ao estado de transição — `creditar`
  exige ATIVO).
- `D-novo-CONVENIO-G5-DOC-DESLIGAMENTO` P3 (Fase 3) — `ModeloDocumento`
  só tem CONTRATO/PROCURACAO; falta termo de desligamento da
  distribuidora/cooperativa concorrente.

**FAMÍLIA (Fase 2 — G1)** está DEFERIDA até parecer trabalhista do
Luciano (token paga conta de luz = risco salário in natura agravado
CLT 458). Token de A abata fatura de B familiar exige confirmação
bilateral + flag "familiar" na `Indicacao` + guard multi-tenant
`A.cooperativaId == B.cooperativaId`.

1º comando: git checkout -b feature/convenio-migracao

Fase 1 read-only OBRIGATÓRIA (Decisão 23) — investigar + reportar ao
orquestrador, SEM tocar código:
 (a) Mapear `StatusCooperado` atual + onde é setado/lido. Quais
     billing/cron/qualificação dependem dele? Adicionar
     `PENDENTE_MIGRACAO`/`DESLIGADO` (ou similar) quebra algo?
 (b) `MigracaoUsina` (`backend/src/migracoes-usina/`) — modelo existente
     intra-coop; pode ser estendido pra distribuidora externa OU virar
     novo modelo `MigracaoDistribuidora`. Decidir.
 (c) Pontos de oxidação (`expirarTokens` linha 872), `creditar`
     (linha 456), `usarNaFatura` (linha 4141) — todos exigem
     `STATUS_PERMITIDOS_CREDITO` (`ATIVO` / `ATIVO_RECEBENDO_CREDITOS`).
     Edge case E3: cooperado em PENDENTE_MIGRACAO recebe tokens? Bloqueia?
     Acumula sem oxidar? Decidir.
 (d) `ModeloDocumento` — adicionar TIPO_DOCUMENTO `DESLIGAMENTO_CONCORRENTE`
     com template variável + assinatura digital (Assinafy futuro).
 (e) Estimativa real (design 19/06 estimou Fase 3 em 8-15d Code).

Reportar achados + premissa validada + opção de design + PAUSAR pro OK
do orquestrador antes da Fase 2. Reviewers pesados antes do smoke.

ALTERNATIVAS (decision-independent enquanto Luciano define escopo #3):

**Sprint Hardening Lateral** — IDOR sistêmico ACUMULANDO (M45 lateral +
3 D-novo-CONVENIO-*-SEM-COOPID novos do M46 + inventário SISGD ~20
endpoints). Re-review orquestrador 21/06 sinalizou como candidato. Mesmo
padrão M45 (destructure-discard + cooperativaIdAlvo validado). Estimativa
~6-8h. Fecha:

- `D-novo-CADASTRO-COMPLETO-TENANT-SPOOF` P1 (M45) — `cooperados.service.ts:495`.
- `D-novo-MOTOR-PROPOSTA-PLANO-CROSS-TENANT` P1 (M45) — `motor-proposta.service.ts:584`.
- `D-novo-AUDITLOG-TENANT-ALVO-SA` P1 (M45) — interceptor não captura
  `cooperativaIdAlvo` quando SA escala.
- `D-novo-HARDENING-CONTROLLERS-LATERAIS` P1 (M45) — asaas + condominios +
  convite-indicacao.
- `D-novo-CONVENIO-UPDATE-SEM-COOPID` P2 (M46) — removerMembro/updateMembro
  UPDATE sem cooperativaId.
- `D-novo-CONVENIO-LISTAR-MEMBROS-SEM-COOPID` P2 (M46) — listarMembros sem
  filtro tenant.

Catalogar débitos P2/P3 carry-over (não fechar agora):

CARRY-OVERS pós M46 (catalogados):
- M46 novos:
  - `D-novo-NOTIF-EMAIL-FALLBACK` P3 — email fallback pra cooperado sem telefone.
  - `D-novo-E1-DISPARO-READMISSAO` P3 — disparoId composto colidiria em 2º
    desligamento pós-readmissão (comportamento atual OK — waSender sem dedup).
  - `D-novo-UPDATEMEMBRO-ANY` P3 — `updateData: any` em updateMembro.
  - `D-novo-WA-FILA-DEDICADA` P3 — sem fila WA pra burst grande de distribuição.
- M45 carry:
  - `D-novo-USINA-PROPRIA-CROSS-TENANT` P2.
  - `D-novo-SERVICE-LAYER-UPDATE-DELETE-AUDIT` P2 (audit sistemático IDOR).
  - `D-novo-USINAS-CREATE-TENANT-IMPLICITO` P2.
  - `D-novo-COOPERADO-OWNERSHIP-SEM-COOPID` P3.
  - `D-novo-TERNARIO-COOPID-FALSY` P3.
  - `D-novo-PUBLICO-400-404-ORACULO` P3.
- M44 carry:
  - `D-novo-COOPERADO-UPDATE-SEM-COOPID` P2.
  - `D-novo-UPDATE-COOPERADO-DTO-GD-FIELDS` P3.
  - `D-novo-CONVENIO-ORIGEM-LEDGER` P2.
- Design 19/06:
  - `D-novo-CONVENIO-E1-FUNCIONARIO-SAI-TOKENS-ORFAOS` P1 → ✅ RESOLVIDO M46.
  - `D-novo-CONVENIO-FASE0-JURIDICO` P0 (bloqueia ativação real).
  - `D-novo-CONVENIO-G1-VINCULO-FAMILIAR` P2 (Fase 2 — DEFERIDA).
  - `D-novo-CONVENIO-G4-CONSUMO-DECLARADO-TOKEN` P2 (Fase 2).
  - `D-novo-CONVENIO-G2-ESTADOS-MIGRACAO` P2 (Fase 3 — NESTE PRÓXIMO SPRINT).
  - `D-novo-CONVENIO-E2-MIGRACAO-FALHA-SEM-ROLLBACK` P2 (Fase 3 — IDEM).
  - `D-novo-CONVENIO-G5-DOC-DESLIGAMENTO` P3 (Fase 3 — IDEM).
- **#3** OPÇÃO A Sprint D-QUALIF-DECAY (~6-10h) catalogado.
- **#4** OPÇÃO C Notificações Proativas catalogado.
- Caminho ativação produção saque colaborador DESCONTO_FATURA — todos
  hardenings de código implementados (M41/M42/M43), falta parecer escrito +
  flag `SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true` em .env prod.

ENTREGA M46:

- Fatia A — TokenNotificacaoService 2 métodos novos
  (`notificarDistribuicaoConvenio` + `notificarAbateFatura`). Não tocar
  `notificarRecebedor` original.
- Fatia B — Evento `DISTRIBUIDO_CONVENIO` + emit em `distribuirTokens`
  APÓS commit mass-write (sequencial best-effort).
- Fatia C — `CooperTokenNotificacaoListener` único: consome RESGATADO +
  DISTRIBUIDO_CONVENIO; idempotência via `MensagemWhatsapp(tipoDisparo,
  disparoId, status, cooperativaId)`; sem telefone → skip + log warn.
- Fatia D — E1 inline em `removerMembro`: busca `ConfigCooperToken.valorTokenReais`
  do tenant (P1-A reviewers — não hardcode); texto "seus N tokens
  continuam seus, R$ Y". Best-effort.
- 22 specs Jest verde + smoke E2E REAL passou (cooperado-teste whitelist
  27981341348 → MensagemWhatsapp.status='ENVIADA' real).
- Reviewers multitenant + code-reviewer + re-review orquestrador APROVADOS
  COM RESSALVAS (3 fixes pré-merge).
- Commits: `79e5f1f` (feat) + `950d2c1` (merge --no-ff).

ENTREGA M45 (referência — sprint anterior):

- Fatia A — POST /cooperados (P0 D-novo-COOPERADOS-CONTROLLER-TENANT-SPOOF):
  * Controller async + destructure-discard body.cooperativaId
  * SA escala via cooperativaIdAlvo (DTO @Matches CUID + Cooperativa.findUnique ativo)
  * ForbiddenException se tenant não resolve
  * AGREGADOR preservado pelo JWT (auth.service.ts:713)
  * 9 specs Jest

- Fatia B — POST /publico/cadastro-web v2 + cadastro-sem-uc (P1
  D-novo-CADASTRO-PUBLICO-TENANT-SPOOF):
  * ?tenant=<id> obrigatório + Cooperativa.findUnique ativo → 404
  * body.cooperativaId DESCARTADO; path convite preservado intacto
  * Frontend: 4 fetches passam ?tenant= com encodeURIComponent
  * 6 specs

- Fatia C — GET /publico/convenios-pagador-empresa (bônus):
  * Validação anti-enumeração + @Throttle 30/min
  * 3 specs

- Fatia D — Smoke E2E 5/5 PASS:
  * ADMIN spoof body descartado → cooperado no JWT
  * SA via cooperativaIdAlvo → cross-tenant em CoopereBR Teste
  * Público fake → 404; convenios-pagador fake → 404; real → 200

- Reviewers: multitenant + security APROVADOS COM RESSALVAS (3 fixes
  pré-merge: P1-A validação cooperativaIdAlvo + P2-B encodeURIComponent
  links + P3-A @Throttle convenios-pagador).
- Commits: `9403095` (feat) + `5cd46ba` (merge --no-ff).

- Schema delta aditivo (db push aplicado):
  - `Cooperado.jaRecebeCreditosGd Boolean @default(false)` +
    `Cooperado.fornecedorGdAtual String?`
  - `CooperTokenCompra.convenioId String?` + FK `onDelete:SetNull`
  - 3 índices novos
    (`CooperTokenCompra[convenioId]`,
     `[cooperativaId,convenioId]`,
     `CooperTokenLedger[referenciaTabela,referenciaId]`)
  - `ContratoConvenio.cooperTokenCompras` back-relation
- Backend: `comprarTokensCooperado()` param novo `convenioId` + guard
  multi-tenant ANTES do create
  (`findFirst { id, cooperativaId }` → `NotFoundException`); controller
  propaga `body.convenioId`; DTO com `@Matches` CUID;
  `cooperados.service` + `create-cooperado.dto` + `publico.controller`
  (cadastroWebV2 + cadastroSemUc) propagam GD fields.
- Frontend (4 cadastros): `/cadastro`, `/cadastro/sem-uc`,
  `/dashboard/cooperados/novo` (Step2Dados),
  `/dashboard/cooperados/novo-sem-uc`. Build + PM2 restart confirmado.
- Testes: 6 specs Jest + smoke E2E 5 casos com `SMOKE_INICIO` cleanup.
- REVIEWERS: multitenant OK + financeiro-token OK + re-review
  orquestrador APROVADO. FUNDACAO §4#1 preservada.
- Commits: `2af634a` (feat) + `6847e5a` (merge --no-ff).

PROTOCOLO próxima sprint (independente de qual):

- Branch dedicada como 1º comando (Decisão Luciano 13/06).
- Fase 1 read-only OBRIGATÓRIA (Decisão 23). Pausa pro OK antes de
  Fase 2.
- Reviewers pesados ANTES do smoke (padrão M39/M41/M42/M43/M44/M45).
- Re-review do orquestrador após fixes.
- Smoke E2E real com contatos whitelist
  (`27981341348` + `lucbragatto+*@gmail.com`).
- Merge --no-ff preservando feature branch no origin.

PRÉ-REQUISITOS LEITURA:
1. docs/sessoes/2026-06-22-m48-sprint-funil-camada-1-motor.md (esta sessão).
2. docs/sessoes/2026-06-21-m47-sprint-convenio-migracao.md (M47 migração).
3. docs/sessoes/2026-06-21-m46-sprint-convenio-fundacao.md (M46 E1+E8).
4. docs/sessoes/2026-06-21-m45-sprint-hardening-tenant-spoof.md (M45 — fonte
   da lição cooperativaId-do-JWT + pattern destructure-discard).
5. docs/sessoes/2026-06-19-design-convenio-token-cooperado-familia.md
   (design fonte do convênio — Família G1+G4 ainda abertas).
6. docs/ESPEC-CONVENIO-TOKEN-COOPERADO-2026-06-19.md (modelo + gap map).
7. docs/debitos-tecnicos.md — 4 débitos resolvidos M48 (ROTEADOR-CADASTRO-
   CENTRAL + LEAD-EXPANSAO-CONVERTER + JA-RECEBE-CREDITOS-GD-PASSIVO +
   LISTA-ALIASES-PARCEIROS-SISGD) + 5 novos M48 + 1 P1 bloqueador da
   Camada 3 (LEAD-EXPANSAO-PUBLIC-TENANT-SPOOF).
8. backend/src/roteamento-cadastro/ (motor advisory — pattern reusável pra
   Camadas 2/3 do Funil).
9. backend/src/migracoes-usina/ (MigracaoExternaService — caminho A do
   roteador delega aqui quando Camada 2 fizer enforcement).
10. CLAUDE.md (regras + multi-tenant + lição M45).

═══ FIM DA FRASE M48 (sessão 22/06 — Sprint Funil Camada 1 MOTOR entregue + smoke E2E real + merge na main) ═══

═══ FRASE ARQUIVADA M47 (21/06 — Sprint Convênio MIGRAÇÃO) — referência ═══

═══ FRASE ARQUIVADA M46 (21/06 — Sprint Convênio FUNDAÇÃO) — referência ═══

═══ FRASE ARQUIVADA M45 (21/06 — Sprint Hardening Tenant-Spoof) — referência ═══

═══ FRASE ARQUIVADA M44 (20/06 — Slice convênio-origem-dado) — referência ═══

═══ FRASE ARQUIVADA M43 (17/06 — Sprint C Hardening Throttler+Reconciliação) ═══

ENTREGA M43 (referência histórica — não copiar como prompt):

- Bloco 1 ThrottlerGuard:
  - 2 tiers em ThrottlerModule.forRoot ([default:100/min,
    webhook:600/min]).
  - ThrottlerGuard em APP_GUARD ANTES do JwtAuthGuard (anti-burst
    em /auth/login).
  - 4 webhooks com @SkipThrottle({default:true}) +
    @Throttle({webhook:{limit:600,ttl:60000}}): Asaas, BB, Sicoob,
    WhatsApp.
  - Decisão Luciano Fase 1 Q1: teto ALTO sem skip total — backstop
    anti-runaway.
- Bloco 2 Reconciliação:
  - Schema delta aditivo em ResgateRecibo (4 campos retry + índice
    composto) — `prisma db push` aplicado.
  - Cron @Cron('*/15') reconciliarContabilPendentes — busca,
    re-tenta lancarResgatePix, atualiza estado.
  - Backoff [5min, 30min, 2h, 12h, 24h] → desistido após 5 falhas.
  - Desistido: AuditLog forense (usuarioId='SYSTEM_CRON',
    usuarioPerfil='SYSTEM') + emit evento `cooper-token-resgate.
    reconciliacao-desistido`.
  - Endpoint admin trigger manual POST /cooper-token/admin/
    reconciliacao/trigger (SUPER_ADMIN, @AuditLog, @Throttle 3/min).
  - Decisão Luciano Q4: SEMPRE LIGADO em prod (sem gate
    RECONCILIACAO_PRODUCAO_LIBERADO).
  - Escopo Q2: apenas ResgateRecibo. F2 catalogado separado.
- Webhook PAGO_CREDITO_PENDENTE: agora seta os 4 campos retry ao
  virar PENDENTE (cooper-token.service.ts:~2945).
- Idempotência via @@unique([origemTipo,origemId]) do LancamentoCaixa
  (P1.2 fix — substituiu findFirst soft guard).

3 P1 + 5 P2 + 4 P3 sensatos aplicados (dos 5 P1, 17 P2, 11 P3
únicos consolidados dos 3 reviewers):
- P1.1 Backoff off-by-one (BACKOFF[novaTentativa-1]; 1ª falha 5min).
- P1.2 Idempotência via @@unique de banco (fecha race cron×webhook).
- P1.3 reconciliacaoUltimaEm setado no webhook (trilha auditável).
- P2: token webhook só por header (Asaas); timingSafeEqual
  (BB/Sicoob/WA); valor arredondado AuditLog; asaasTransferId
  truncado (LGPD); env guard prod no smoke C2.
- P3: emojis → [OK]/[WARN]/[ERR] (parseável); warn em PROD se
  TokenContabilService faltar; warn em race detectada; +3 specs
  novos (10b/10c/12).

CARRY-OVERS catalogados:

3 débitos novos do Sprint C (todos P2, não-bloqueantes):
- D-novo-F2-RECONCILIACAO-CRON P2 (análogo F2 compra PJ).
- D-novo-RECONCILIACAO-DESISTIDO-LISTENER P2 (consumer do evento;
  AuditLog v1 cobre alerta; listener entra sprint Notificações
  Proativas).
- D-novo-RECONCILIACAO-RESETAR-ADMIN P2 (endpoint admin pra resetar
  reconciliacaoDesistido em recibo curado; ~30min Code).

Caminho de ativação produção do saque colaborador comum (restrito a
DESCONTO_FATURA) — TODOS os hardenings de código implementados:
  ✅ parecer (16/06); ✅ Salvaguarda 1 (M42 — filtro origem);
  ✅ Salvaguarda 4 (M41 — PENDENTE_APROVACAO_COOP obrigatório);
  ✅ Salvaguarda 5 (M42 — disclaimer versionado);
  ✅ D-novo-THROTTLER-APP-GUARD P1 (M43);
  ✅ D-novo-RECONCILIACAO-CONTABIL-CRON P2 (M43);
  ⏳ parecer escrito do cooperebr-analista-conformidade confirmando;
  ⏳ SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true em .env prod.

S2 (ata assembleia) + S3 (parecer trabalhista) NÃO são sprint de
código — são ações legais do Luciano fora do path da ativação
restrita.

PROTOCOLO próxima sprint (independente de qual Luciano escolha):

- Branch dedicada como 1º comando (Decisão Luciano 13/06).
- Fase 1 read-only OBRIGATÓRIA (Decisão 23). Pausa pro OK antes de
  Fase 2.
- Reviewers pesados ANTES do smoke (padrão M39/M41/M42/M43).
- Re-review do orquestrador após fixes.
- Smoke E2E real com contatos whitelist.
- Merge --no-ff preservando feature branch no origin.

PRÉ-REQUISITOS LEITURA:
1. docs/sessoes/2026-06-17-m43-sprint-c-hardening.md (esta sessão).
2. docs/sessoes/2026-06-17-m42-d2.1-filtro-origem-disclaimer-
   versionado.md (M42).
3. docs/sessoes/2026-06-16-m41-saque-pix-colaborador.md (M41 base).
4. docs/relatorios/analise-conformidade-2026-06-16-saque-colaborador-
   d2.md (parecer fonte das 5 salvaguardas).
5. docs/debitos-tecnicos.md — 3 débitos novos do Sprint C +
   D-novo-RECONCILIACAO-CONTABIL-CRON e D-novo-THROTTLER-APP-GUARD
   marcados ✅ RESOLVIDOS Sprint C.
6. docs/FUNDACAO-COOPERTOKEN-MODELO-CANONICO.md (§4#1 invariante
   Passivo == Σ saldos × face — Sprint C aceita janela de degradação
   temporária com cura via cron).
7. CLAUDE.md (regras + disciplina de análise modelo canônico primeiro
   + disclaimer versionado).

═══ FIM DA FRASE M43 (sessão 17/06 — Sprint C Hardening entregue + merge na main) ═══

═══ FRASE ARQUIVADA M42 (17/06 dia — Sprint D2.1 v2 entregue) ═══

PASSO 1 OBSOLETO — Frase COMANDANTE M42: Luciano decide a próxima sprint

M42 (17/06) FECHADO no main (merge --no-ff b65bcb3 + push). Salvaguarda
1 (filtro de origem) + Salvaguarda 5 (disclaimer versionado) do parecer
de conformidade entregues. 5 commits na feature branch (37069d5 →
4d39599), 333/333 specs verde, smoke E2E 23/23 PASS com 3 papéis reais.
3 reviewers pesados (0 P0, 9 P1, 14 P2, 8 P3): 8 P1 + 7 P2 sensatos
aplicados. Re-review do orquestrador aprovou (P1.A Math.abs + P1.J
updateMany com cooperativaId + count guard confirmados no código).

⚠️ Próxima sprint a Luciano definir. 3 candidatos na fila:

OPÇÃO A — Sprint D-QUALIF-DECAY (próxima por padrão, ~6-10h)
  Decaimento da qualificação no Clube com inatividade prolongada
  (espelha aplicarOxidacao do token). Resolve "use ou perde" do
  lado da qualificação. Catalogado desde M40 em debitos-tecnicos.md.
  Reviewers: code-reviewer + typescript-reviewer + cooperebr-
  multitenant-reviewer (toca contabilidade de qualificação, não
  dinheiro direto).

OPÇÃO B — N/A
  Não existe sprint de código pra Salvaguardas 2/3/4. Conferência
  pós-M42 com o parecer: S2 = ATA DE ASSEMBLEIA (ação legal Luciano,
  só pra HABILITAR BONIFICACAO_ADMIN); S3 = PARECER ADVOGADO
  TRABALHISTA (ação legal Luciano, só pra HABILITAR tokens de
  empresa conveniada); S4 = PENDENTE_APROVACAO_COOP obrigatório, JÁ
  IMPLEMENTADO desde M41/F6 (cooperado comum nunca tem auto-
  aprovação). Pra ativar saque restrito a DESCONTO_FATURA em prod
  bastam OPÇÃO C + parecer escrito + flag — S2/S3 só viram código
  futuro se Luciano expandir a whitelist do filtro de origem.

OPÇÃO C — Sprint Hardening de Segurança
  Fecha 2 carry-overs cruciais pra ativação produção do D2:
    - D-novo-THROTTLER-APP-GUARD P1 NOVO (sistêmico, catalogado
      pelo security-reviewer no M42) — ThrottlerGuard não em
      APP_GUARD do AppModule.
    - D-novo-RECONCILIACAO-CONTABIL-CRON P2 (M41) — cron re-tenta
      PAGO_CREDITO_PENDENTE.

ENTREGA M42:

- Schema: model DisclaimerSaque (cooperativaId String? null=global,
  valor=override) + FK disclaimerSaqueId em ResgateRecibo +
  back-relation Cooperativa.disclaimersSaque. Histórico imutável:
  ativo=false, NUNCA delete.
- DisclaimerSaqueService: seed v1 idempotente + getAtivo (override
  > global) + getAtivoGlobal (P1 fix — sem string mágica) +
  criarGlobal/criarTenantOverride em tx Serializable +
  desativarOverrideTenant com updateMany + cooperativaId + count
  guard (P1 fix) + buscarPorId com cooperativaIdEsperado obrigatório
  (P2 fix) + validarTexto rejeita HTML/entities/javascript:/on*=
  (P2 fix) + listarHistorico paginado (P2 fix).
- 7 endpoints (5 mutações com @AuditLog + @Throttle): /portal/
  disclaimer-saque (COOPERADO+ADMIN+SUPER), /saas/disclaimer-saque/
  global/{ativo,historico,POST} (SUPER), /saas/disclaimer-saque/
  tenant/:cooperativaId/historico (SUPER NOVO P1 fix — sem
  impersonation), /cooperativa/disclaimer-saque/{ativo,historico,
  POST,DELETE} (ADMIN+SUPER, cooperativaId SEMPRE do JWT,
  criadoPorPerfil do JWT P2 fix).
- Guard 1.5 (filtro origem) em solicitarResgate: composicaoOrigem-
  Saldo com Math.abs em DEBITO (P1 fix anti-ESTORNO negativo do
  M39) + comparação estrita sem tolerância +0.0001 (P2 fix).
- Guard 1.6 (disclaimer) refactor: valida FK fora da tx (anti-
  staleness) + re-valida ativo + cooperativaId DENTRO da tx
  Serializable + throw explícito sem fallback silencioso (P2 fixes).
- Frontend: 3 telas. /portal/resgatar-tokens com texto dinâmico
  (whitespace-pre-line + sem dangerouslySetInnerHTML) + checkbox +
  FK no POST + retry anti-staleness; shape flat corrigido (P1 fix
  da Salvaguarda 5 silenciosa). /dashboard/super-admin/disclaimer-
  saque (editor global + histórico). /dashboard/configuracoes/
  disclaimer-saque (editor tenant + desativar override + histórico).
  Sidebar wiring 2 itens.
- DTO solicitar-resgate @ValidateIf coerência: disclaimerAceito=true
  exige disclaimerSaqueId (P2 fix).
- POST /cooper-token/empresa/resgatar ganhou @AuditLog (P1 fix).
- Specs 333/333 verde (22 suites). Smoke smoke-d2-1-disclaimer-
  versionado.ts 23/23 PASS com 3 papéis reais (SUPER + ADMIN
  CoopereBR + COOPERADO SISGDSOLAR) — 8 passos do roteiro.

CARRY-OVERS catalogados:

- D-novo-THROTTLER-APP-GUARD P1 NOVO (catalogado 17/06 pelo
  security-reviewer) — sistêmico, fora escopo D2.1. ThrottlerGuard
  não em APP_GUARD do AppModule. Mitigação local com @Throttle por
  endpoint. Bloqueia ativação produção do D2.
- D-novo-RECONCILIACAO-CONTABIL-CRON P2 (M41) continua aberto —
  cron re-tenta resgates PAGO_CREDITO_PENDENTE. Bloqueia ativação
  produção do D2.
- Caminho de ativação produção do saque colaborador comum
  (restrito a DESCONTO_FATURA):
  ✅ parecer (16/06); ✅ Salvaguarda 1 (M42 — filtro origem);
  ✅ Salvaguarda 4 (M41 — PENDENTE_APROVACAO_COOP obrigatório);
  ✅ Salvaguarda 5 (M42 — disclaimer versionado);
  ⏳ D-novo-THROTTLER-APP-GUARD P1; ⏳ D-novo-RECONCILIACAO-
  CONTABIL-CRON P2; ⏳ parecer escrito do
  cooperebr-analista-conformidade confirmando +
  SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true.
  S2 (ata assembleia) + S3 (parecer trabalhista) NÃO são sprint
  de código — são ações legais do Luciano que só viram código
  futuro se a whitelist do filtro expandir pra BONIFICACAO_ADMIN
  (após ata) ou tokens de empresa conveniada (após parecer
  trabalhista).

PROTOCOLO próxima sprint (independente de qual Luciano escolha):

- Branch dedicada como 1º comando (Decisão Luciano 13/06).
- Fase 1 read-only OBRIGATÓRIA (Decisão 23). Pausa pro OK antes de
  Fase 2.
- Reviewers pesados ANTES do smoke (padrão M39/M41/M42).
- Re-review do orquestrador depois das fixes.
- Smoke E2E real com contatos whitelist (27981341348 + lucbragatto+
  <suffix>@gmail.com).
- Merge --no-ff preservando feature branch no origin.

PRÉ-REQUISITOS LEITURA:
1. docs/sessoes/2026-06-17-m42-d2.1-filtro-origem-disclaimer-
   versionado.md (esta sessão — detalhamento completo + reviewers
   + fixes + smoke).
2. docs/sessoes/2026-06-16-d2.1-em-progresso.md (pausa que precedeu
   o M42 — entrega da v2 Blocos 1-5).
3. docs/sessoes/2026-06-16-m41-saque-pix-colaborador.md (M41 base —
   gate dual + lancarResgatePix).
4. docs/relatorios/analise-conformidade-2026-06-16-saque-colaborador-
   d2.md (parecer fonte das 5 salvaguardas).
5. docs/debitos-tecnicos.md — D-novo-THROTTLER-APP-GUARD P1 (NOVO),
   D-novo-RECONCILIACAO-CONTABIL-CRON P2 (M41).
6. docs/FUNDACAO-COOPERTOKEN-MODELO-CANONICO.md — §2.1 contábil,
   §4#1 invariante (Passivo == Σ saldos × face).
7. CLAUDE.md regras (rebuild PM2 + contatos teste + isAmbienteReal +
   disciplina de análise modelo canônico primeiro + disclaimer
   versionado).

═══ FIM DA FRASE M42 (sessão 17/06 — Sprint D2.1 v2 entregue + merge na main) ═══

═══ FRASE ARQUIVADA M41+pausa-D2.1 (16/06 dia+noite) ═══

═══ FRASE ARQUIVADA M41 (16/06 dia — Sprint D2 entregue) ═══

PASSO 1 OBSOLETO — Frase comandante Sprint D-QUALIF-DECAY (Decaimento Qualificação):

M41 (16/06) ENTREGOU Sprint D2 Saque PIX Colaborador Comum em 7 commits
+ 1 merge --no-ff no main (b622a87) + FECHOU D-novo-RESGATE-PIX-SEM-
CAIXA P1 catalogado em M40.

Cooperado COMUM (não-Estabelecimento) agora pode solicitar resgate de
tokens em R$ via PIX sob gate dual: flag tenant Cooperativa.
saqueColaboradorAtivo (SUPER_ADMIN liga) + env SAQUE_COLABORADOR_
PRODUCAO_LIBERADO='true' (Luciano libera após parecer escrito do
cooperebr-analista-conformidade). Espelha exatamente OXIDACAO_PRODUCAO_
LIBERADA. Toggle nasce OFF. Mensagem genérica anti-enumeração.

Contábil (D-RESGATE-PIX-SEM-CAIXA fechado): novo lancarResgatePix em
token-contabil.service cria LancamentoCaixa D Passivo (5.1.02) / C
Caixa pós-tx Serializable (FUNDACAO §2.1). Idempotente via findFirst
guard. Falha rara → status PAGO_CREDITO_PENDENTE + evento cooper-token-
resgate.credito-pendente (espelha F2, princípio "nenhuma saída de caixa
silenciosa").

UI super-admin /dashboard/super-admin/saque-colaborador com banner âmbar
quando env produção bloqueado. Portal cards condicionais agora aparecem
pra (ehEstabelecimento OR saqueColaboradorAtivo).

3 reviewers pesados (financeiro-token + multitenant + security) + re-
review orquestrador: 0 P0/P1 abertos no merge. 4 P1 + 5 P2 aplicados.

60/60 specs verde + smoke E2E PASS 16/16 + build NestJS/Next.js verde.

⚠️ INVARIANTE FUNDACAO §4#1 (Passivo == Σ saldos × face):
- Caminho feliz: ATÔMICO observável.
- Falha contábil rara: DEGRADADO + CONSULTÁVEL via PAGO_CREDITO_
  PENDENTE + evento alerta. Auto-heal pendente do D-novo-RECONCILIACAO-
  CONTABIL-CRON P2 (catalogado hoje). Princípio "observável e re-
  tentável", não "atômico no pior caso".

CARRY-OVER CRÍTICO pra ativação produção D2:
1. Implementar D-novo-RECONCILIACAO-CONTABIL-CRON P2 (cron re-tenta
   PAGO_CREDITO_PENDENTE).
2. Solicitar parecer escrito ao cooperebr-analista-conformidade.
3. Setar SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true após parecer.

Detalhes em docs/sessoes/2026-06-16-m41-saque-pix-colaborador.md.

═══ PRÓXIMO BLOCO: Sprint D-QUALIF-DECAY — Decaimento da Qualificação ═══

ESCOPO: nível da qualificação no Clube cai com inatividade prolongada
(espelha aplicarOxidacao do token). Métrica = uso + indicações; admin
pondera pesos. Resolve "use ou perde" do lado da qualificação.
Reavaliação JÁ EXISTE em backend/src/clube-vantagens/ (só PROMOVE
hoje, nunca REBAIXA).

ESTIMATIVA: 6-10h em ~4 blocos:
- (a) Schema delta aditivo em ProgressaoClube (lastAcaoEm, periodoGraca,
      mesesPraDecair, piso) + ConfigClube (pesos uso/indicações).
- (b) Service aplicarDecaimentoClube espelhando aplicarOxidacao
      (cron mensal + gate DECAIMENTO_QUALIFICACAO_LIBERADO).
- (c) UI admin pra configurar pesos + simulação preview.
- (d) Smoke: cooperado inativo N meses → nível cai do BRONZE pra (piso)
      sem ultrapassar.

PROTOCOLO:
- Branch nova feature/qualif-decay como 1º comando.
- Fase 1 read-only OBRIGATÓRIA (Decisão 23) — mapear estrutura
  ProgressaoClube atual + reavaliação existente. Pausa pro OK.
- Reviewers: code-reviewer + typescript-reviewer + cooperebr-
  multitenant-reviewer (não toca dinheiro direto, mas toca contabilidade
  de qualificação cross-cooperativa).
- Toggle nasce OFF. Espelha gate da oxidação.

═══ HISTÓRICO REMOVIDO — bloco antigo Sprint D2 (que veio a ser este M41) ═══

(O conteúdo abaixo, do antigo "ESCOPO: extensão F6..." até o
"═══ FIM DA FRASE M40", representava a frase de retomada do M40 que
projetava Sprint D2. Esse projeto agora é M41 entregue. Bloco mantido
como artefato histórico até a próxima sessão limpar — não consultar
pra orientação operacional.)

ESCOPO: extensão F6 (resgate PIX existente do M34/M35) sem o guard
ehEstabelecimento + toggle de config liga/desliga por cooperativa.
Reusa ~70% do código F6 já testado em produção. Cooperado comum
(não-estabelecimento) ganha botão "Resgatar em R$ via PIX" em
/portal/tokens quando config ativa.

CARONA OBRIGATÓRIA: como o sprint mexe no caminho do resgate
(solicitarResgate + cooper-token-resgate.listener), FECHA o
D-novo-RESGATE-PIX-SEM-CAIXA P1 (catalogado M40) implementando o
lançamento contábil canônico no processarWebhookResgate
(TRANSFER_DONE): D Passivo Tokens 5.1.02 / C Caixa, conforme
FUNDACAO-COOPERTOKEN §2.1 tabela "Resgate via PIX". Sem isso o
sprint deixa P1 aberto.

ESTIMATIVA: 8-12h em 4-5 blocos:
- (a) Schema: flag Cooperativa.saqueColaboradorAtivo (default false).
- (b) Service: remover/gate ehEstabelecimento no solicitarResgate
      condicionado à flag. Specs novas (~5-8 specs).
- (c) Contábil (D-RESGATE-PIX-SEM-CAIXA): emitir LancamentoCaixa
      D Passivo / C Caixa no listener TRANSFER_DONE. Spread (se
      pagar abaixo do face) vai pra C Receita de Resgate. Specs
      cobrindo TRANSFER_DONE + TRANSFER_FAILED (reversão).
- (d) UI: card condicional em /portal/tokens (ehEstabelecimento OR
      saqueColaboradorAtivo). UI admin em /dashboard/configuracoes
      pra ligar/desligar.
- (e) Smoke E2E: cooperado comum (não-estabelecimento) solicita +
      admin aprova + PIX-out + webhook + saldo bloqueado→liquidado
      + LancamentoCaixa criado.

PROTOCOLO:
- Branch nova feature/saque-pix-colaborador como 1º comando.
- Fase 1 read-only OBRIGATÓRIA mapeando F6 + identificando pontos
  de toggle. Pausa pro OK antes de codar.
- cooperebr-financeiro-token-reviewer + cooperebr-multitenant-
  reviewer + security-reviewer (toca dinheiro). Re-review do
  orquestrador após fixes.
- Smoke E2E real com contatos whitelist + 1 token apenas + estorno
  imediato (gate inegociável — NUNCA emissão real pra colaborador
  real). Padrão M34/M35.

PRÉ-REQUISITOS LEITURA:
1. **docs/FUNDACAO-COOPERTOKEN-MODELO-CANONICO.md (16/06)** —
   modelo canônico em 4 lentes; §2.1 tabela contábil pro resgate
   PIX (D Passivo / C Caixa + spread). LER ANTES DE TUDO.
2. docs/sessoes/2026-06-16-m40-abrir-cadastros-sisgd-teste.md (esta
   sessão).
3. docs/sessoes/2026-06-13-14-m35-sprint-clube-p1-f6-resgate-completo.md
   (F6 entregue — molde do código a reusar).
4. backend/src/cooper-token/cooper-token.service.ts:1986
   solicitarResgate (guard ehEstabelecimento ~:2031 atual) + :2226
   aprovarResgate.
5. backend/src/cooper-token/cooper-token-resgate.listener.ts
   (processarWebhookResgate TRANSFER_DONE — D-novo-RESGATE-PIX-
   SEM-CAIXA bloqueado AQUI; fecha de carona).
6. backend/src/financeiro/token-contabil.service.ts (templates
   contábeis existentes; lancarResgateFatura como referência).
7. web/app/portal/resgatar-tokens/page.tsx + /portal/tokens/page.tsx
   (cards condicionais ehEstabelecimento).
8. CLAUDE.md regras (rebuild PM2 + contatos teste + isAmbienteReal
   + Disciplina de análise modelo canônico primeiro).

CARRY-OVERS M40 (não-bloqueantes — pos D2):

PRÓXIMA SPRINT DEPOIS DE D2:
- Sprint Decaimento Qualificação (D-QUALIF-DECAY) — nível cai com
  inatividade, espelha oxidação token, métrica uso+indicações,
  admin pondera. (Rotulado D3 por engano no fechamento M40 — D3
  oficial = preço custo×venda do token continua ABERTA.)

DEPOIS DAS DUAS ACIMA:
- Sprint Circuito de Emissão Completo (4 fases): contábil →
  notificações → emissão unificada quem/custo → compra conveniado +
  auto-distribuição. Resolve 2 P1 + 7 P2 catalogados M40.

ENFILEIRADAS (sem ordem definida):
- D-novo-EMISSAO-ADMIN-CONTABIL P2 (16/06) — fecha junto com Fase 1
  contábil do Circuito Emissão Completo.
- D-novo-ADMIN-FILA-APROVACAO-GLOBAL P2 (sidebar admin "Aprovações
  pendentes" global agregada — discoverability operacional).
- Sprint Hardening Mass-Write SUPER_ADMIN P2 (enfileirada M35).
- 8 M working tree do Cowork (backend/src/concierge/* + package.json/
  lock + spec) — território Cowork, próximo fechamento Cowork limpa.

DIRETRIZES PRESERVAR:
- enviarTokensAdmin @deprecated (M39): avaliar remoção após 30
  dias de logs ENVIO_ADMIN zerados.
- Vocabulário inegociável: CooperToken / voucher / liquidação /
  recibo / sobra / bonificação admin (M39). NUNCA: CTK em UI /
  recompra / venda.
- Multi-tenant: cooperativaId do JWT (NÃO body). Servidor revalida
  cada cooperadoId.cooperativaId em ops com lista (padrão M39).

DIRETRIZES PRESERVAR:
- Branch dedicada por sprint desde 1º commit (Decisão Luciano 13/06).
- Vocabulário inegociável: CooperToken / voucher / liquidação /
  recibo / sobra / bonificação admin (NOVO M39). NUNCA: CTK em UI
  (Fatia A v2) / recompra / venda.
- Multi-tenant: cooperativaId do JWT (NÃO body). Servidor revalida
  cada cooperadoId.cooperativaId em ops com lista (padrão M39).
- Rebuild web/backend obrigatório (PM2 cycle stop → build → restart).
- Regra contatos teste: AMAGES + lucbragatto+amages@gmail.com.
- Reviewers pesados ANTES de smoke (financeiro-token + multitenant
  no caso de op com dinheiro). Re-review do orquestrador após
  fixes — padrão M39 (pegou 2 P1 residuais).
- Smoke E2E real com gate inegociável (NUNCA emissão real em
  produção pra colaboradores reais — usar 1 unidade + estorno).

CARRY-OVERS M38 (ainda vivos):
- D-novo-EMAIL-IMAP-SSL-VERIFY P2 (gate `tls.rejectUnauthorized:
  false` por env ANTES de deploy prod, Cowork).
- D-novo-CONVENIO-ADMIN-IDOR-UPDATE-REMOVE P2 (corrigir antes
  do onboarding 2ª cooperativa real — entra Sprint Hardening
  Mass-Write SUPER_ADMIN).
- D-novo-CONVENIO-CONVENIADO-LEGADO P3 (audit + renomear campo).
- D-novo-CONVENIOS-PORTAL-SPECS P3 (cobertura unitária).
- D-novo-CTK-VALOR-HARDCODE-EXTRATO P3 (hardcode *0.20 em
  estabelecimento/recebimentos:92).
- Sessão Cowork em curso: 3 M (backend/package.json + lock +
  concierge.service.spec.ts) + 8+ untracked + 3 relatórios novos
  (ANALISE-/GAP-MAP-/FLUXO-CONVENIO-TOKEN-CLUBE-2026-06-15) —
  NÃO TOCAR.

CARRY-OVERS HISTÓRICOS AINDA VIVOS (M28→M38, não-bloqueantes):
- D-novo-F6-RECONCILIACAO-CRON P2 + D-novo-MT-F2-F3-F4-LEGADO-
  UPDATE-COOPERADO P2 + D-novo-F6-ADMIN-FLAG-ESTAB P2 (Sprint
  Hardening Mass-Write SUPER_ADMIN enfileirado).
- D-novo-F4-PARCEIRO-TENANT-STEPUP P2 + D-novo-F4-OTP-CANAL-
  ENTREGA P2 + D-novo-F4-UI-COOPERADO-PEER P2 (Token-WA Fase 3
  pausada) + D-novo-F4-LIMITE-UPPERBOUND-VALORTOKEN P3 + D-novo-
  QR-PARCEIRO-PAPEL-DUAL P3.
- D-novo-OXIDACAO-* P2/P3 + D-novo-WA-PHONE-NORMALIZE P2 +
  D-novo-LEDGER-UNIQUE-CONSTRAINT P3 + D-novo-CREDITO-PENDENTE-
  REPROCESSAMENTO P2 + D-novo-F3-RACE-CONFIRMS-CONCORRENTES P3 +
  D-novo-F3-INCONSISTENCIA-BANCO P3 + D-novo-TAXA-TRANSFER-
  DESTINO P2 + D-novo-TAXA-RESGATE-DESTINO P2.
- D-novo-TOKEN-CONTA-TIPO P2 + D-novo-F3-LANCAMENTO-AUSENTE P2
  + D-novo-F6-LANCAMENTO-AUSENTE P2 + D-novo-COMPRA-LANCAMENTO-
  CAIXA-TEMPLATE P2 + D-novo-WEBHOOK-RECOVERY-CRON P2 (achados
  dos relatórios 15/06 — sprint contábil dedicada).
- Decisões D1/D2/D3/D4 Modelo C — sprints próprios.
- Untracked acumulados pra Sprint Housekeeping.

═══ FIM DA FRASE M41 (sessão 16/06 — Sprint D2 saque PIX colaborador entregue + D-RESGATE-PIX-SEM-CAIXA fechado) ═══
```

— BLOCO ARQUIVADO M34 (abaixo — atendido por M37) ——————————————————

PASSO 0 — [arquivado M34] Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior).
   Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents.
   Se não aparecer, parar e avisar (sessão não indexou subagent project-specific).

2. Rodar `git status --short` (diretriz inegociável catalogada 18/05).
   Esperado pós-fechamento M34: working tree limpo (untracked carry-overs
   catalogados + M de schema/docs concierge da sessão paralela Cowork —
   `LeadConcierge` + `DiagnosticoIndebito` Sprint C8/C4 + docs/concierge/
   mockups são deles, NÃO tocar). Último commit é o de fechamento M34.
   Rodar `git log origin/main..HEAD --oneline` — deve mostrar 3 commits
   ahead (c5eee91 Bloco A + b3251f5 Bloco B + fechamento M34); PUSH
   SEGURADO até reviewers + smoke. NÃO PUSHAR antes da hora.

3. Rodar `pm2 list`. Esperado: cooperebr-backend + cooperebr-frontend +
   cooperebr-whatsapp online (3000/3001/3002 LISTENING). Frontend é
   `next start` sob PM2 (NÃO `next dev`) — toda mudança em web/ exige
   `cd web ; npm run build ; pm2 restart cooperebr-frontend`. HMR NÃO ROLA.

PASSO 1 — Frase comandante M34 → F6 Bloco C (UI portal estabelecimento + UI admin):

Sessão 12/06 entregou M34 em 2 commits (c5eee91..b3251f5): F6 Blocos A+B
(Estabelecimento resgata tokens em R$ via PIX — schema delta voucher +
helper PIX-out + service + 5 endpoints + DTOs + 34 specs).

- c5eee91 A: schema delta aditivo (Cooperado.ehEstabelecimento +
  CooperTokenSaldo.saldoBloqueadoResgate + enum CooperTokenTipo +=
  RESGATE_PIX, ESTORNO_RESGATE_PIX + ResgateRecibo model com
  3 unique constraints + ResgateReciboCounter sequencial por
  cooperativa + ano) + AsaasPixOutService extraído de
  pix-excedente.service.ts:132-157 (tenant-aware via getApiClient,
  isAmbienteReal() retorna SIMULATED sem chamar Asaas, case-insensitive
  pixTipo). 18 specs.
- b3251f5 B: service solicitarResgate + aprovarResgate + recusarResgate
  + cancelarResgate + processarWebhookResgate + estornarResgateInterno
  (privado, NUNCA apaga) + listarResgatesPendentes + gerarNumeroRecibo
  (RES-2026-NNNNN counter atômico). 5 endpoints REST + 2 DTOs
  class-validator. 34 specs.

296/296 specs verdes (18 suites cooper-token + mass-write + asaas-pix-out).

3 REFORÇOS Luciano materializados como centro do bloco:
- REFORÇO 1: estorno auditável NUNCA apaga — nova entry CREDITO
  ESTORNO_RESGATE_PIX no ledger; status pula pra RECUSADO/CANCELADO/
  FALHA_PIX preservando trilha histórica.
- REFORÇO 2: webhook idempotente — ultimoWebhookEventId checado antes
  da transição; duplicado retorna {skipped:'webhook-duplicado'}; primeiro
  eventId gravado no swap (atomicidade).
- REFORÇO 3: compare-and-swap em TODAS transições (5 pontos: aprovar/
  recusar/cancelar/webhook PAGO/webhook FAILED) via updateMany({where:
  {id, cooperativaId, status:'esperado'}}) → count===1.

Ordem do fluxo: PIN FORA da tx (PinCooperadoService.validarPinComLockout
F2.3) + tier ALTO valor>R$50 exige OTP (OtpDesafioService motivo
TOKEN_TRANSACAO_STEP_UP) + assertLimite sobre TOTAL F2.5 + bloqueio do
saldo DENTRO da tx Serializable (re-snapshot + conservação invariante
disp+bloq constante) + numeroRecibo gerado na mesma tx.

Vocabulário inegociável aplicado em todas as strings: "resgate" /
"liquidação" / "recibo" — NUNCA "recompra" / "venda" (decisão circuito
04/06 catalogada em memória decisao_modelo_token_voucher_sobra_resgate_
2026_06_04.md).

═══ PRÓXIMO BLOCO: F6 Bloco C (UI portal estabelecimento + UI admin) ═══

Backend pronto (5 endpoints REST). Falta camada de interface:

1. UI portal estabelecimento (cooperado solicita resgate):
   - Página dedicada `/conveniada/cooper-token/resgatar` ou
     `/portal/resgatar-tokens` (padrão UI Tipo B — definir na Fase 1).
   - Guard: cooperado.ehEstabelecimento === true. Caso contrário, banner
     amber CTA "Vincular como estabelecimento" (admin liberará via UI
     futura — pra v1 basta o guard rejeitar).
   - Guard: cooperado.pixChave + cooperado.pixTipo cadastrados em
     /portal/seguranca. Caso contrário, banner CTA "Cadastrar PIX" →
     /portal/seguranca.
   - Form: quantidade tokens + PinInput (F4 Bloco D wrapper) +
     observacao opcional + (condicional tier ALTO) OTP.
   - Preview: valor bruto R$ + taxa F1.5 + líquido + chave PIX
     destino (snapshot do cadastro).
   - clientRequestId useRef padrão F4 C.2 (UUID v4 estável por sessão
     de confirmação; regenera só em sucesso/cancelar).
   - Tratamento humano dos 7 erros: PIN_NAO_DEFINIDO (CTA configurar) +
     PIN_BLOQUEADO (ISO date até) + PIN_INCORRETO (retry) +
     EXCEDE_LIMITE (detalhe) + OTP_REQUERIDO + OTP_INCORRETO +
     SALDO_INSUFICIENTE (mostra disponível + bloqueado).
   - Lista de resgates pendentes do cooperado (próprios) com botão
     "Cancelar" enquanto status === PENDENTE_APROVACAO_COOP.
   - Help inline azul ShieldCheck explicando: "tokens são vouchers de
     circuito fechado da cooperativa; resgate = liquidação em R$ via
     PIX na sua chave cadastrada; aprovação manual do admin pode levar
     até X horas".

2. UI admin (aprovar/recusar):
   - Tela `/dashboard/cooper-token/resgates-pendentes` chamando GET
     /admin/resgates-pendentes (filtros status default PENDENTE +
     valor mín/máx + datas + paginação).
   - Card por recibo: numeroRecibo, estabelecimento, valor bruto/
     líquido R$, chave PIX, observacao, idade.
   - 2 ações: "Aprovar" (POST /admin/resgates/:id/aprovar — dispara
     PIX) + "Recusar" (POST /admin/resgates/:id/recusar — Dialog com
     textarea motivoRecusa obrigatório).
   - Banner amber se Asaas SANDBOX (isAmbienteReal() === false):
     "Resgate em modo simulado — SANDBOX".
   - Help inline: "aprovação dispara PIX-out via Asaas; falha do PIX
     reverte tokens automaticamente; aprovação atômica via compare-
     and-swap".

3. Padrões a reusar (do M32/M33):
   - <PinInput> wrapper de OtpInput (F4 Bloco D)
   - clientRequestId useRef (F4 C.2)
   - HelpBox component
   - Tratamento humano dos 7 erros (mensagens mapeadas)
   - Padrão UI Tipo B (página dedicada com guard + form + preview +
     estado, sem Sheet drawer)

Fase 1 read-only OBRIGATÓRIA (Decisão 23 + Regra de Coerência Sistêmica):
- Mapear /portal/tokens atual (descobrir onde encaixar link condicional
  pro novo /portal/resgatar-tokens — só se ehEstabelecimento).
- Mapear /portal/seguranca (CTA cadastrar PIX — endpoint já existe?).
- Mapear /dashboard/cooper-token/* (descobrir padrão de menu admin).
- Mapear PinInput + HelpBox + ShieldCheck (componentes shared).
- MAPA DE IMPACTO 5 dimensões. PAUSAR pro OK Luciano antes de codar.

Após Bloco C aprovado:
- reviewers pesados UMA vez (cooperebr-financeiro-token-reviewer +
  cooperebr-multitenant-reviewer — o mais rigoroso de todos, dinheiro
  saindo)
- ajustes pós-review (Bloco C.1)
- smoke E2E sandbox + AMAGES com ehEstabelecimento=true + pixChave
  whitelisted (lucbragatto+amages@gmail.com / +5527981341348)
- PUSH (até aqui os 3 commits do M34 estavam segurados)
- fechamento M35

Pré-requisitos leitura M34:
1. docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo + esta frase).
2. docs/sessoes/2026-06-12-m34-f6-blocos-ab.md.
3. docs/especificacao-circuito-cooper-token-convenio.md (modelo voucher).
4. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_
   token_voucher_sobra_resgate_2026_06_04.md (vocabulário).
5. backend/src/cooper-token/cooper-token.service.ts métodos
   solicitarResgate/aprovarResgate/recusarResgate/cancelarResgate/
   processarWebhookResgate/listarResgatesPendentes (referência UI).
6. backend/src/cooper-token/cooper-token.controller.ts 5 endpoints
   novos (contratos REST pra UI).
7. backend/src/cooper-token/dto/solicitar-resgate.dto.ts campos do form.
8. web/app/portal/tokens (referência padrão /portal).
9. CLAUDE.md + .claude/CLAUDE.md.

DIRETRIZES PRESERVAR:
- RECIBO de resgate, NÃO recompra (Art. 79 + STF Tema 536).
- jti via criarTokenTransacao (F4 Bloco B helper).
- clientRequestId useRef padrão F4 C.2.
- Multi-tenant: cooperativaId do JWT, nunca do body.
- PIN/OTP NUNCA logados.
- Specs verdes obrigatórias antes do commit.
- Rebuild PM2 backend (stop → build → restart) em mudança backend.
- Rebuild web (npm run build → pm2 restart cooperebr-frontend) — HMR
  NÃO ROLA.
- Regra contatos de teste: AMAGES + lucbragatto+amages@gmail.com.

CARRY-OVERS M34 (não-bloqueantes):
- Push de 3 commits locais (c5eee91 + b3251f5 + fechamento) SEGURADO
  até reviewers + smoke. NÃO PUSHAR antes do Bloco C fechar.
- D-novo-TAXA-RESGATE-DESTINO P2 — calcularTaxa('resgate') default 0%;
  precisa decisão destino contábil antes de ligar.
- Sessão paralela Cowork adicionou LeadConcierge + DiagnosticoIndebito
  ao schema sem commitar; commita separadamente — NÃO TOCAR.

CARRY-OVERS HISTÓRICOS AINDA VIVOS (não-bloqueantes — ver doc-sessões
M28→M33): D-novo-F4-PARCEIRO-TENANT-STEPUP P2 (Sprint Hardening) +
D-novo-F4-OTP-CANAL-ENTREGA P2 + D-novo-F4-UI-COOPERADO-PEER P2 (Token-
WA Fase 3) + D-novo-F4-LIMITE-UPPERBOUND-VALORTOKEN P3 + D-novo-QR-
PARCEIRO-PAPEL-DUAL P3 + D-novo-OXIDACAO-* P2/P3 + D-novo-WA-PHONE-
NORMALIZE P2 + Fase 3 Token-WA pausa explícita + D-novo-ASAAS-WEBHOOK-
AUTH P2 + D-novo-LEDGER-UNIQUE-CONSTRAINT P3 + D-novo-CREDITO-PENDENTE-
REPROCESSAMENTO P2 + D-novo-F3-RACE-CONFIRMS-CONCORRENTES P3 + D-novo-
F3-INCONSISTENCIA-BANCO P3 + D-novo-TAXA-TRANSFER-DESTINO P2 + untracked
acumulados pra Sprint Housekeeping.

═══ FIM DA FRASE M34 ═══

— BLOCO ARQUIVADO M33 (abaixo — atendido por M34) ——————————————————

PASSO 0 — [arquivado M33] Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

Sessão 12/06 entregou M33 em 4 commits (4bb36aa..8425169): F3 Empresa
distribui tokens em LOTE/INDIVIDUAL end-to-end (Blocos A+B+C+C.1).

- 4bb36aa A: schema delta (enum CooperTokenTipo += DISTRIBUICAO_CONVENIO
  + 2 cols TokenTransacao naturezaDistribuicao + empresaDeclaraTetoClt)
  + helper executarMassWrite reusável (cap 200 + PREVIEW/CONFIRM +
  idempotência por callback + AuditLog auditável após commit). 20 specs.
- 3e40270 B: service distribuirTokens com 6 guards (naturezas + empresa
  PJ + convênio ownership conveniadoId + PIN fora tx + assertLimite
  sobre TOTAL ajuste Luciano + destinatários MEMBRO_ATIVO); loop linha-a-
  linha dentro tx Serializable; tipo DISTRIBUICAO_CONVENIO no ledger
  (NÃO DOACAO — segregação Art. 87); 1ª linha grava referência
  idempotência. DTO class-validator + endpoint POST /cooper-token/
  empresa/distribuir (perfil COOPERADO + JWT). 28 specs.
- bbcc9c1 C: UI /conveniada/convenio/[id]/distribuir-tokens (selecao →
  confirmação 2 etapas + Iguais a X/Selecionar todos + card preview 4
  stats + modal radio 3 naturezas + condicionais CLT checkbox/PREMIACAO
  textarea + PinInput F4 D reusado + tratamento humano dos 7 erros +
  clientRequestId useRef padrão F4 C.2 + contador pendentes + help inline)
  + endpoint helper GET membros-disponiveis + card de entrada na página
  do convênio.
- 8425169 C.1 pós-reviewers: 2 P1 (round IEEE somaQuantidade +
  valorTokenEsperado preview===cobrança) + 4 P2 (guard taxa>0 até gate
  D-novo-TAXA-TRANSFER-DESTINO + MT-A cooperado.is.cooperativaId + MT-B
  remover PII + spec membros inválidos ZERO writes) + 3 caronas P3
  (single saldo update + pagadorCooperativaId + conservação linear).
  12 specs.

244/244 specs cooper-token + mass-write verdes. 2 rodadas reviewers
pesados aprovados. Pergunta CONFIRMs concorrentes VALIDADA (SSI 40001
+ retry idempotência). Smoke E2E 14/14 PASS real (AMAGES + 2 funcionários
+ convênio criado idempotente + golden + retry + VOLUNTARIA s/ CLT 400
+ extrato DISTRIBUICAO_CONVENIO segregação Art. 87).

Decisões catalogadas:
- Tipo DISTRIBUICAO_CONVENIO próprio (NÃO DOACAO_*) — ajuste 1 Luciano
- assertLimite sobre TOTAL do lote (empresa gasta, não por linha) — ajuste 2
- Helper mass-write disponível pra Sprint Hardening Mass-Write SUPER_ADMIN
- 3 naturezas CLT (REGULAMENTO/VOLUNTARIA/PREMIACAO) com gates de DTO
- Tudo-ou-nada (saldo pré-validado DENTRO tx Serializable; parcial quebra idempotência)

═══ PRÓXIMO BLOCO: F6 — Estabelecimento resgata tokens (token → R$ via PIX) ═══

Cooperado-estabelecimento converte tokens recebidos (via QR peer F4
ou via parceiro) em R$ via PIX. MODELO: **RECIBO de resgate, NÃO recompra**
(decisão circuito 04/06 catalogada em memória `decisao_modelo_token_
voucher_sobra_resgate_2026_06_04.md`). Cooperativa tributa apenas o
spread/queima; valor cheio é trânsito (Art. 79 + STF Tema 536).

Pré-requisitos schema (Fase 1 read-only mapeará):
- Cooperado.ehEstabelecimento Boolean @default(false) aditivo +
  backfill false (todos cooperados atuais começam como NÃO
  estabelecimento; admin opt-in via UI futura).
- Decisão pendente: novo CooperTokenTipo='RESGATE_PIX' OU reusa existente?
- Decisão pendente: novo modelo ResgateRecibo OU usar TokenTransacao
  com tipoOperacao='RESGATE'?
- Decisão pendente: integração Asaas PIX-out (transferência) ou outro
  gateway? Quem fica com o débito do PIX (cooperativa intermedia, ou
  estabelecimento tem chave PIX cadastrada)?
- calcularTaxa('resgate') já existe no helper taxa-helper F1.5 (default
  0%); D-novo-TAXA-RESGATE-DESTINO análogo ao de transferência precisa
  decidir destino contábil antes de ligar.

Fase 1 read-only OBRIGATÓRIA (Decisão 23 + Regra de Coerência Sistêmica):
mapear Cooperado schema (campos similares pra flag), enum CooperTokenTipo,
calcularTaxa('resgate'), AsaasService capacidade PIX-out, ResgateRecibo
modelo (se existe), UI portal cooperado (/portal/tokens já tem secão
"Pagar em parceiro do Clube" — adicionar "Resgatar em PIX" se for
estabelecimento). MAPA DE IMPACTO 5 dimensões. PAUSAR pro OK Luciano
antes de codar.

Pré-requisitos leitura M33:
1. docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo + esta frase).
2. docs/sessoes/2026-06-12-f3-empresa-distribui-lote.md.
3. docs/especificacao-circuito-cooper-token-convenio.md (modelo voucher/
   sobra/resgate — F6 é a saída em R$).
4. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_
   token_voucher_sobra_resgate_2026_06_04.md (decisão central).
5. docs/debitos-tecnicos.md seção F3 (D-novo-F3-* P3 + D-novo-TAXA-
   TRANSFER-DESTINO P2).
6. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md.
7. CLAUDE.md + .claude/CLAUDE.md.

DIRETRIZES PRESERVAR:
- RECIBO de resgate, NÃO recompra (Art. 79 + STF Tema 536 — cooperativa
  só tributa spread/queima).
- jti gerado backend (helper criarTokenTransacao F4 B).
- clientRequestId do cliente (UI gera UUID v4 useRef padrão C.2).
- Multi-tenant: cooperativaId do JWT, nunca do body.
- Helper executarMassWrite disponível se F6 virar mass-write (resgate em
  lote? improvável v1 — cooperado-estabelecimento resgata 1 por vez).
- Cross-tenant bloqueado por default em criarTokenTransacao (permitirCrossTenant=false).
- F0 INTOCÁVEL: calcularTaxa('resgate') cobrada UMA vez sobre o bruto.
- Specs verdes obrigatórias antes do commit.
- Rebuild PM2 backend (stop → build → restart) em schema delta.
- Rebuild web (npm run build → pm2 restart cooperebr-frontend) — HMR NÃO ROLA.
- Regra contatos de teste: AMAGES + lucbragatto+amages@gmail.com pra smoke.

CARRY-OVERS M33 (não-bloqueantes):
- D-novo-F3-RACE-CONFIRMS-CONCORRENTES P3 validado raciocínio (SSI 40001
  + retry idempotência). D-novo-LEDGER-UNIQUE-CONSTRAINT P3 disponível
  se algum review futuro pedir endurecimento estrutural.
- D-novo-F3-INCONSISTENCIA-BANCO P3 — spec dedicado + UX refinement
  para janela preview→commit.
- D-novo-TAXA-TRANSFER-DESTINO P2 ganhou GATE EXPLÍCITO no service
  distribuirTokens (taxa > 0 → BadRequest); precisa decisão destino
  contábil (queima/crédito emissora/fundo reserva) antes de ligar.
- Sessão paralela Cowork adicionou model LeadConcierge ao schema sem
  commitar (Sprint C8); Cowork commita separadamente (NÃO TOCAR).
- Smoke F3 deixou rastros em AMAGES (saldo 135 + João 10 + Ana 5 +
  convênio SMOKE-F3-AMAGES-* + ledger DISTRIBUICAO_CONVENIO + TokenTransacao);
  todos ambienteTeste=true.
- Scripts exploratórios (scripts/smoke-f3-find-amages.ts + smoke-f4-find-coop.ts)
  podem ser removidos em Sprint Housekeeping.

CARRY-OVERS HISTÓRICOS AINDA VIVOS (não-bloqueantes — ver doc-sessões
M28/M29/M30/M31/M32): D-novo-F4-PARCEIRO-TENANT-STEPUP P2 (Sprint
Hardening) + D-novo-F4-OTP-CANAL-ENTREGA P2 + D-novo-F4-UI-COOPERADO-PEER
P2 (Token-WA Fase 3) + D-novo-F4-LIMITE-UPPERBOUND-VALORTOKEN P3 +
D-novo-QR-PARCEIRO-PAPEL-DUAL P3 + D-novo-OXIDACAO-* P2/P3 + D-novo-
WA-PHONE-NORMALIZE P2 + Fase 3 Token-WA pausa explícita + D-novo-ASAAS-
WEBHOOK-AUTH P2 + D-novo-LEDGER-UNIQUE-CONSTRAINT P3 + D-novo-CREDITO-
PENDENTE-REPROCESSAMENTO P2 + untracked acumulados pra Sprint Housekeeping.

═══ FIM DA FRASE M33 ═══

— BLOCO ARQUIVADO M32 (abaixo — atendido por M33) ——————————————————

PASSO 0 — [arquivado M32]:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior).
   Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents.

2. Rodar `git status --short`. Esperado pós-fechamento M32.

3. Rodar `pm2 list`. Esperado: 3000/3001/3002 LISTENING.

PASSO 1 — [arquivado M32] Frase comandante M32 → F3 (Empresa distribui tokens em LOTE/INDIVIDUAL):

Sessão 12/06 entregou M32 em 8 commits (`e73b64a..4a0ee87`):
- e73b64a F4 Bloco A: usarNaFatura PIN + Serializable + status-guard
  idempotente (mata D-novo-F4-RACE: overwrite silencioso de cobrança paga).
- ccc84e9 F4 Bloco B: schema TokenTransacao.qrExpiresAt nullable + helper
  criarTokenTransacao centralizado (jti via gerarTokenHex(16) + tier
  BAIXO/ALTO limiar R$50 + motivoStepUp PRIMEIRO_USO/DESTINATARIO_NOVO/
  VALOR_ALTO + guards multi-tenant em 3 camadas + cross-tenant bloqueado
  por default).
- 2e0f649 F4 Bloco C: helper consumido em usarNaFatura + processarPagamentoQr
  (PIN opcional pra reuso processarQrParceiro; F0 INTOCÁVEL: taxa F1.5 qr
  continua 1×) + enviarTokens cooperado→cooperado (PIN + calcularTaxa
  transferencia default 0% + jti) + enviarTokensAdmin novo método (tier
  BAIXO segue só com auth; tier ALTO exige OTP via OtpDesafioService) +
  endpoint stub POST /otp-step-up.
- b62535b carona auth: cookie Secure pelo protocolo real da janela
  (window.location.protocol === 'https:'), não NODE_ENV — fix login
  via IP da LAN.
- 2937a2a F4 Bloco C.1 pós-reviewers (3 P1 + 4 P2 + 4 caronas): FIN-1
  LimiteTokenService.verificarValor antes da tx nos 3 endpoints + FIN-2
  cooperado status dentro da tx + MT-1 cobrança via findFirst com
  contrato:{cooperadoId, cooperativaId} NotFound genérica + FIN-4
  clientRequestId obrigatório no admin + MT-2 cooperativaId guard + FIN-7
  0.20 chumbado → valorToken + MT-3 log G1 + MT-4 OtpDesafio rejeita null
  cooperativaId + MT-5 saldo QR multi-tenant.
- d61ff5d C.2 breaking caller: clientRequestId estável por sessão de
  confirmação no frontend admin (useRef + regenera só em sucesso/cancelar,
  erro transitório mantém UUID — retry idempotente protegido).
- d136cf9 F4 Bloco D: <PinInput> wrapper minimal de OtpInput (M28/F2
  convite-convênio) + modal PIN 2 etapas em /portal/tokens (form → pin)
  + tratamento humano dos 4 motivos (PIN_NAO_DEFINIDO CTA configurar +
  PIN_BLOQUEADO ISO date formatado + PIN_INCORRETO retry + EXCEDE_LIMITE
  mensagem detalhada) + help inline azul ShieldCheck.
- 4a0ee87 D carona: formatarTelefone helper único + 4 callers atualizados
  + fix strip 55 prefix (copy-paste WhatsApp +5527981341348 agora vira
  (27) 98134-1348, não (55) 27981-3413).

184/184 specs cooper-token verdes (78 novos no F4). 2 rodadas reviewers
pesados aprovados. Smoke E2E 8/8 PASS real (AMAGES ambienteTeste,
JWT manual JWT_SECRET, HTTP backend :3000).

Decisões catalogadas:
- F4 cooperado-only — endpoints tenant-level (transferirTokensParceiro,
  usarTokensEnergia, processarQrParceiro) ficam fora; Sprint Hardening
  Multi-Tenant absorve via D-novo-F4-PARCEIRO-TENANT-STEPUP P2.
- UI cooperado→cooperado decisão (a) — telas web não criadas (QR/P2P são
  superfícies WA-first); D-novo-F4-UI-COOPERADO-PEER P2 reabrir quando
  Token-WA Fase 3 voltar.
- F0 INTOCÁVEL preservado: taxa F1.5 qr 1× sobre bruto antes da tx;
  helper criarTokenTransacao NÃO recalcula taxa.
- jti gerado backend (cooperado); clientRequestId vem do cliente (admin)
  e vira referenciaId no creditar() — idempotência app-level.

═══ PRÓXIMO BLOCO: F3 — Empresa distribui tokens em LOTE/INDIVIDUAL ═══

Escopo: empresa cooperada PJ (Santi e futuras) distribui tokens já
comprados pra funcionários da empresa, em LOTE (CSV/seleção múltipla)
ou INDIVIDUAL (1-1).

OPERAÇÃO MASS-WRITE — reusa controles do Sprint Hardening Mass-Write
SUPER_ADMIN (P2 enfileirado, ativar aqui):
- Preview obrigatório antes do envio (mostra N funcionários × N tokens
  cada = total).
- Dry-run flag pra simular sem commitar.
- Cap de segurança (ex.: até X funcionários por lote — admin define).
- Log auditável em cooperTokenLedger + TokenTransacao (jti por entrega).
- Confirm explícito (Dialog de duas etapas: revisar + confirmar).
- Idempotência via referenciaId estável (clientRequestId padrão C.1
  adaptado pra lote).

SALVAGUARDA CLT ART. 458 — BENEFÍCIO NÃO-SALARIAL ATÉ 50% REMUNERAÇÃO:
- Token entregue ao funcionário pela empresa = benefício NÃO-salarial
  desde que não exceda 50% da remuneração mensal (CLT Art. 458 §2º).
- Gate de produto: empresa informa remuneração de cada funcionário OU
  declara teto máximo de token por funcionário/mês.
- UI mostra alerta amber quando entrega ultrapassa o piso configurado
  (não bloqueia — empresa pode aceitar risco com confirm explícito).
- D-novo-F3-CLT-458 catalogar caso decisão de produto definir piso
  duro vs piso configurável.

Fase 1 read-only OBRIGATÓRIA (Decisão 23 + Regra de Coerência Sistêmica):
- Mapear endpoint admin existente (/cooper-token/parceiro/enviar com
  enviarTokensAdmin do F4 Bloco C — base ideal pra estender pra LOTE).
- Mapear se há entidade Funcionário já modelada OU se reusa Cooperado
  com flag.
- Mapear UI admin que dispararia o lote (/parceiro/distribuir-tokens?
  /dashboard/clube/distribuir?).
- Mapear log/auditoria existente (CooperTokenLedger + TokenTransacao
  já criados pelo F4 — confirmar shape pra registro em massa).
- MAPA DE IMPACTO 5 dimensões (schema delta? DTOs? UI? testes? docs?).
- PAUSAR pro OK Luciano antes de codar.

Pré-requisitos leitura M32:
1. docs/CONTROLE-EXECUCAO.md (este arquivo — seção ## ONDE PARAMOS topo + esta frase).
2. docs/sessoes/2026-06-12-f4-cooperado-only-completo.md (M32 — esta sessão).
3. docs/especificacao-circuito-cooper-token-convenio.md (espinha do
   circuito CooperToken — F3 toca distribuição da empresa pros funcionários).
4. docs/debitos-tecnicos.md seção F4 (5 débitos novos M32) +
   D-novo-TAXA-TRANSFER-DESTINO P2.
5. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md.
6. CLAUDE.md + .claude/CLAUDE.md (regras + lição next start).

DIRETRIZES PRESERVAR:
- jti gerado backend (cooperado); clientRequestId vem do cliente (admin).
- F0 INTOCÁVEL: taxa F1.5 qr 1× sobre bruto.
- Cross-tenant bloqueado por default no helper criarTokenTransacao.
- Multi-tenant: cooperativaId do JWT, nunca do body.
- Mass-write em LOTE exige preview + cap + dry-run + log auditável + confirm.
- CLT Art. 458 §2º: benefício não-salarial até 50% remuneração — gate de
  produto a definir.
- Specs verdes obrigatórias antes do commit.
- Rebuild PM2 backend (stop → build → restart) em toda mudança backend.
- Rebuild web (npm run build → pm2 restart cooperebr-frontend) em toda
  mudança em web/ — NÃO há HMR.

CARRY-OVERS M32 (não-bloqueantes):
- D-novo-F4-PARCEIRO-TENANT-STEPUP P2 — Sprint Hardening Multi-Tenant.
- D-novo-F4-OTP-CANAL-ENTREGA P2 — wirar TokenNotificacaoService no
  /otp-step-up admin.
- D-novo-F4-UI-COOPERADO-PEER P2 — reabrir quando Token-WA Fase 3 voltar.
- D-novo-F4-LIMITE-UPPERBOUND-VALORTOKEN P3 — polish assertLimite usar
  valorToken do plano em vez de 0.45 chumbado.
- D-novo-TAXA-TRANSFER-DESTINO P2 — gate de destino contábil antes de
  ligar taxaTransferenciaPerc>0 em prod.
- D-novo-QR-PARCEIRO-PAPEL-DUAL P3 — JSDoc + guard explícito.
- Smoke F4 deixou rastros em AMAGES (PIN '123456', saldo 150 limpos
  ao final; cobrança R$ 979,20 voltou A_VENCER no estado original).

CARRY-OVERS HISTÓRICOS AINDA VIVOS (não-bloqueantes — ver doc-sessões
M28/M29/M30/M31): D-novo-OXIDACAO-LEDGER-TIPO P2 + D-novo-OXIDACAO-
PRESERVADOS-DUPLA-CONTAGEM P3 + D-novo-OXIDACAO-SPECS P3 + D-novo-
WA-PHONE-NORMALIZE P2 + Fase 3 Token-WA pausa explícita + D-novo-
ASAAS-WEBHOOK-AUTH P2 + D-novo-LEDGER-UNIQUE-CONSTRAINT P3 + D-novo-
CREDITO-PENDENTE-REPROCESSAMENTO P2 + untracked acumulados pra Sprint
Housekeeping.

═══ FIM DA FRASE M32 ═══

— BLOCO ARQUIVADO M28 (abaixo — atendido por M29/M30/M31/M32) ——————————

PASSO 0 — [arquivado] — pré-M32:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior).
   Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents.

2. Rodar `git status --short`.

3. Rodar `pm2 list`.

PASSO 1 — [arquivado] Frase comandante M28 (Luciano DECIDE entre 2 opções):

Sessão 09/06 entregou M28 em 5 commits (`10a1de7..b5609e4`):
- 10a1de7 F0 CooperToken Fase 2: remove crédito indevido saldoParceiro
  em QR coop→coop + corrige dupla TAXA_QR em processarQrParceiro
  (parceiro agora recebe 99 num bruto de 100, era 98,01). 4 specs.
- 20d3f91 F1 backend meu-perfil: GET pin-status + POST definir-pin com
  409 anti-rewrite + throttle 10/min + helpers isPinFraco +
  isEmpresaCooperada + OtpMotivo estendido PIN_DEFINIR. 23 specs.
- 7f8cd93 F1 portal /portal/seguranca/definir-pin: page client +
  isPinFraco espelhado + help inline azul. SEM OTP (JWT prova identidade).
- abf12e2 F1 bot WA fluxo DEFINIR PIN: 3 estados + 4 ações + OTP+
  últimos-4-CPF anti-SIM-swap (decisão Luciano) + seed do submenu
  CooperToken opção "4 Definir PIN". 13 specs.
- b5609e4 Santi Medicina Diagnóstica cadastrada como 1ª empresa
  conveniada de teste da CoopereBR (Cooperado PJ + Usuario Supabase +
  ContratoConvenio CV-SANTI-001 MISTO 20% pagador EMPRESA). Seed
  idempotente executado + validado via /auth/login + /auth/me +
  /portal/meus-convenios. IDs: Cooperado cmq6qo4hi0002va2wti5k1sqw +
  Usuario cmq6qo5c40005va2w8gyyzzj7 + Convenio cmq6qo5ly0007va2w6hilvs2a.

341/341 specs Jest verde. PM2 rebuild backend (2×) + frontend (1×),
portas 3000/3001/3002 LISTENING.

2 frentes READ-ONLY mapeadas SEM código (aguardando OK pra Fase 2):

(A) Bug exibição/cálculo conveniada VALOR_FIXO + ALOCACAO_FIXA:
- Frontend page.tsx:557-563,630-633 ignora tipoTarifaEmpresa=VALOR_FIXO
  + tarifaFixaKwhEmpresa. Lê só descontoKwhCusteio (ramo PERCENTUAL_
  DESCONTO). Pra Santi com tarifa fixa 1,10 → mostra "Tarifa cheia".
- Backend convenios-custeio.service.ts:556-578 ALOCACAO_FIXA com 0
  membros faz early-out status=SEM_MEMBROS + valorAPagar=null. Modelo
  correto: pacote fixo = kwhAlocadoMensal × tarifa, independente dos
  membros (100000 × 1,10 = R$ 110.000).
- enriquecerComValorAPagar:164 bloqueia cálculo com status !== OK.
- DashboardResponse.convenio não inclui tipoTarifaEmpresa/tarifaFixa
  no select do dashboard endpoint.
- calcularValorEnergia:696-712 já trata VALOR_FIXO — só não é chamado.

(B) 3 bugs onboarding conveniada:
- Bug A: lote silenciosamente "ENVIADO" sem disparar —
  enviarLinkPorWhatsapp:1047-1059 IGNORA retorno do sender que em
  DEV/whitelist retorna {enviado:false, motivo:'whitelist-dev'} SEM
  throw. Helper marca enviado:true sempre que não-throws.
- Bug B: UI não refresh após Aprovar/Recusar —
  page.tsx conveniada linha 675 <GestaoConvitesSection convenioId
  source="empresa" /> SEM onAcaoConcluida={carregar}. Componente
  mantém state interno (useState<ListagemConvites>); refetch do parent
  não invade.
- Bug C: UC/energia não aparece — listagem /membros-pendentes faz
  select só de cooperado.id/nomeCompleto/cpf/email/telefone, NÃO
  INCLUI cooperado.ucs[]. cadastroWebV2 CRIA UC OK (publico.controller.
  ts:1066-1082) mas path slim permiteSemUc=true cria UC SINTÉTICA com
  distribuidora='OUTRAS' que não passa filtro INVARIANTE do preview
  consolidado. Card consumo zerado também porque membro pode estar
  ativo=false (PENDENTE_APROVACAO_*).

DECIDA — duas opções pra arrancar Fase 2:

(A) Bug exibição/cálculo conveniada → branch VALOR_FIXO no front
    + ALOCACAO_FIXA calcula com kwhAlocadoMensal × tarifa mesmo sem
    membros + expor campos no dashboard endpoint + specs.
    Commit: `fix(conveniada): expoe VALOR_FIXO + calcula ALOCACAO_FIXA
    sem membros`.

(B) 3 bugs onboarding → propagar enviado:false + motivo do sender
    (Bug A) + adicionar refreshKey: number props (Bug B) + estender
    select listagem com cooperado.ucs[] + cotaKwhMensal (Bug C) +
    specs. Commits separados por bloco.

Perguntas decisórias pendentes (frente B):
- Q1: lote whitelist mostra FALHOU+motivo (verdade) ou ENVIADO
  simpático? Sugestão minha: FALHOU+motivo (visibilidade > mentira).
- Q2: refreshKey props (simples) vs forwardRef+imperativeHandle (React
  limpo)? Sugestão minha: refreshKey (explícito + testável).
- Q3: membros PENDENTE entram no preview ALOCACAO_FIXA OU só
  ativo=true? Sugestão minha: só ativo + UI mostra "X pendentes" à parte.

Validações operacionais (paralelo, fora das frentes A/B):
- Bot WA: rodar `cd backend ; npx ts-node scripts/seed-definir-pin-wa.ts`
  (idempotente) + testar fluxo "MENU → 8 CooperTokens → 4 Definir PIN"
  com telefone Luciano (whitelisted) — confirma OTP+últimos-4-CPF +
  define PIN end-to-end.
- Portal: logar cooperado teste em /portal/seguranca/definir-pin,
  definir PIN, confirmar {temPin: true} no re-load.
- Santi: logar http://localhost:3001/login com lucbragatto+santi@gmail.com
  / Santi@2026 OU impersonate em /dashboard/dev/credenciais-teste →
  contexto "Empresa — Santi Medicina Diagnostica" →
  /conveniada/convenio/cmq6qo5ly0007va2w6hilvs2a.

Fase 1 read-only obrigatória qualquer que seja a escolha (Decisão 23).
Os mapas já produzidos nesta sessão valem como ponto de partida — Code
pode confirmar via leitura curta + propor diffs.

DIRETRIZES PRESERVAR:
- F2.9 hardening do PIN: JWT_SECRET sem fallback, updateMany com
  cooperativaId, validarPin private, lockout 30min, timezone-aware.
- F0 invariante: cessão peer-to-peer entre cooperados NÃO emite saldo
  novo pra cooperativa; TAXA_QR cobrada UMA VEZ sobre o bruto.
- F1 PIN: isPinFraco sincronizado backend↔portal; mensagens neutras
  anti-enumeração no Bot WA.
- Santi: ambienteTeste=true + contatos whitelisted; CNPJ real mantido.
- Multi-tenant: cooperativaId vem do JWT, nunca do body.
- Arredondamento monetário Math.round(x*100)/100.
- Specs verdes obrigatórias antes do commit.
- Rebuild PM2 backend (stop → build → restart) em toda mudança backend.
- Rebuild web (npm run build → pm2 restart cooperebr-frontend) em
  toda mudança em web/ — NÃO há HMR.

PRÉ-REQUISITOS LEITURA M28 (mapear, NÃO codar):
1. docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo — M28).
2. docs/sessoes/2026-06-09-f0-cooper-token-f1-pin-santi-conveniada.md
   (M28 — esta sessão; seções "2 Fases 1 read-only sem código" +
   "Próximo passo").
3. Se opção (A): web/app/conveniada/convenio/[id]/page.tsx
   (linhas 57-76, 215-441, 540-700) + backend/src/convenios/
   convenios-custeio.service.ts (linhas 156-300, 540-700, 683-733).
4. Se opção (B): backend/src/convenios/convites-convenio.service.ts
   (linhas 1033-1060, 550-593) + backend/src/whatsapp/
   whatsapp-sender.service.ts (linhas 80-108) + backend/src/common/
   safety/whitelist-teste.ts + web/components/convenios/
   GestaoConvitesSection.tsx + MembrosPendentesSection.tsx +
   EnvioLoteSection.tsx + backend/src/publico/publico.controller.ts
   (linhas 1030-1110).
5. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md.
6. CLAUDE.md + .claude/CLAUDE.md (regras + lição `next start`).

CARRY-OVERS M27/M26 AINDA VIVOS (não-bloqueantes):
- D-novo-WA-PHONE-NORMALIZE P2 (matcher telefone amplo).
- 3 ações WA declaradas em gatilhos sem implementação (PROCESSAR_OCR,
  MOSTRAR_MENU_PRINCIPAL).
- 17 modelos BOT órfãos.
- empresa_conveniada / proprietario_usina iterando só cooperados[0]
  em obterContextosUsuario.
- Fase 3 Token-WA (TokenTransacao + QR pagamento real) — pausa
  explícita; F0 fechou conformidade do circuito existente.
- .claude/agents/wa-bot-agent.md modificado órfão M26 ainda vivo.
- cooperebr-edge-agent stopped (projeto vizinho, fora do escopo).
- Untracked acumulados pra Sprint Housekeeping.

CARRY-OVERS NOVOS DESTA SESSÃO M28 (não-bloqueantes):
- Frente (A) bug VALOR_FIXO/ALOCACAO_FIXA — Fase 1 read-only mapeada,
  aguarda OK pra implementar.
- Frente (B) 3 bugs onboarding — Fase 1 read-only mapeada, 3 perguntas
  decisórias pendentes (Q1/Q2/Q3).
- IDs Santi pra validação operacional:
  - Cooperado: cmq6qo4hi0002va2wti5k1sqw
  - Usuario: cmq6qo5c40005va2w8gyyzzj7
  - ContratoConvenio: cmq6qo5ly0007va2w6hilvs2a
  - email/senha: lucbragatto+santi@gmail.com / Santi@2026.

DOC-SESSÃO 09/06 M28:
docs/sessoes/2026-06-09-f0-cooper-token-f1-pin-santi-conveniada.md

FRASE COMANDANTE COMPACTA (cole DIRETO no Code se Luciano só quer
arrancar sem ler tudo):
"Arranca Fase 2 da frente (X) mapeada no doc-sessão M28 — fix(...)
com specs verdes + rebuild PM2 + commit PT."
(substituir X por A ou B conforme decisão Luciano).

═══ FIM DA FRASE M28 ═══

— BLOCO ARQUIVADO M28 (acima — atendido por M29) ——————————————————

═══ FRASE COMANDANTE M29 — ARQUIVADA (atendida por M30) ═══

PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela
   anterior). Verificar que subagent `cooperebr-qa-funcional` aparece na
   lista de agents. Se não aparecer, parar e avisar.

2. Rodar `git status --short` (diretriz inegociável 18/05). Esperado
   pós-fechamento M29: working tree limpo (untracked carry-overs
   catalogados pra Sprint Housekeeping futuro); último commit é o de
   fechamento M29.

3. Rodar `pm2 list`. Esperado: `cooperebr-backend` + `cooperebr-frontend`
   + `cooperebr-whatsapp` online (3000/3001/3002 LISTENING) —
   orquestrador deixou stack em runtime após Fase 2 Opção B + smoke.
   Toda mudança em `web/` exige rebuild (`next start` sob PM2, sem HMR).

PASSO 1 — Frase comandante (arrancar Sprint Clube Unificado P1, Fase 1 HUB):

Sessão 10/06 entregou M29 em 8 commits (`56b7666..2d62b09` + ajustes
P3 + smoke + catálogo débitos): 3 bugs onboarding conveniada Santi (Bug
A helper `enviarLinkPorWhatsapp` propaga FALHOU+motivo / Bug B
`refreshKey?: number` externo em GestaoConvitesSection+
MembrosPendentesSection / Bug C `listarPendentes` expõe
`cooperado.ucs[]`+`cotaKwhMensal` com helper `UcResumo` tratando N>1)
+ 2 ajustes P3 reviewers convergentes (C-1 `where: { cooperativaId }`
explícito no select aninhado de ucs + B-1 `carregar()` async/await
admin) + 2 débitos P3 catalogados (D-novo-LOTE-PROCESSAR-FILA-INTEGRACAO
+ D-novo-LABEL-DISTRIBUIDORA-UI) + smoke E2E HTTP real (login Santi →
POST lote → 1 ENVIADO whitelist + 1 FALHOU `whitelist-dev`). 56/56
specs verde + TSC web exit 0. Rebuild PM2 único no fim (backend +
frontend + WhatsApp). Reviewers `cooperebr-multitenant-reviewer` +
`cooperebr-financeiro-token-reviewer` aprovaram zero P0/P1/P2.
**2 sprints enfileirados em memória sem código** — **Sprint Clube
Unificado + CooperToken P1** (próxima sessão) e Sprint Hardening
Mass-Write SUPER_ADMIN P2 (rebaixado, aguarda Clube). **Regra de
Coerência Sistêmica** catalogada como inegociável global (MAPA DE
IMPACTO em 5 dimensões em CADA Fase 1).

ARRANCAR: **Sprint Clube Unificado P1 — Fase 1 HUB** conforme prompt
empacotado pelo orquestrador em
`docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md`
(pronto pra colar — contém PASSO 0 + regras inegociáveis dinheiro/token
+ regra de coerência + 7 fases + consequências conhecidas).

Sequência:
- F1  Hub frontend (baixo risco, sem backend)
- F1.5 Config economia (Taxa Operação + Oxidação — ripple alto, gate
       jurídico antes de oxidação real)
- F2  Empresa-PJ-cooperada compra (creditando cooperadoId)
- F4  Funcionário usa/transfere (PIN/OTP + Serializable + jti)
- F3  Empresa distribui (LOTE/INDIVIDUAL + salvaguarda CLT 458; mass-
      write reusa controles do Sprint Hardening)
- F6  Estabelecimento resgata (token→R$/PIX, recibo, NÃO recompra; flag
      Cooperado.ehEstabelecimento + backfill)
- Fatia A Nomenclatura (CTK→CooperToken, dois rios kWh×token, verbo
       usar/aplicar/resgatar)

Cada fase começa com Fase 1 read-only + MAPA DE IMPACTO 5 dimensões
(Consumidores / Dados Existentes / Propagação / Navegação / Re-Teste)
→ PAUSAR pro OK → implementar → specs verdes.

DIRETRIZES INEGOCIÁVEIS preservar (área dinheiro/token):
- Token = VOUCHER de circuito fechado; cooperativa = emissora única.
- Saída de valor: estabelecimento = RESGATE/liquidação (recibo, SEM
  NF) — NUNCA "recompra". Cooperado = SOBRA. PROIBIDO token→sobra.
- Multi-tenant: cooperativaId SEMPRE do JWT; toda query Prisma filtra
  cooperativaId.
- Transferência/uso de token: PIN/OTP + $transaction Serializable +
  idempotência (jti).
- Monetário: Math.round(x*100)/100.
- Disparo real (WA/email): SÓ whitelisted (5527981341348 /
  lucbragatto+sufixo@gmail.com) + ambienteTeste=true.
- Reportar ao orquestrador ao fim de CADA fase que toca dinheiro/token
  → reviewers `cooperebr-financeiro-token-reviewer` +
  `cooperebr-multitenant-reviewer` antes do push.

PRÉ-REQUISITOS LEITURA (mapear, NÃO codar):
1. docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo — M29).
2. docs/sessoes/2026-06-10-bugs-onboarding-santi-fase-2-opcao-b.md
   (M29 — esta sessão).
3. docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md
   (PROMPT EMPACOTADO — seguir as 7 fases).
4. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/regra_coerencia_sistemica_mapa_impacto_10_06.md.
5. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/sprint_clube_unificado_cooper_token_10_06.md.
6. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md.
7. web/app/dashboard/layout.tsx linhas 111-150 (6 itens espalhados do
   menu — escopo da Fase 1 HUB).
8. CLAUDE.md + .claude/CLAUDE.md.

ESTADO DE FILA (Decisão 24):
- M29 ✅ entregue.
- PRÓXIMO: Sprint Clube Unificado P1 (Fase 1 HUB → ... → Fatia A).
- Sprint Hardening Mass-Write SUPER_ADMIN P2 (rebaixado, aguarda fim
  do Clube).
- Sprint Housekeeping (cleanup smokes Santi + scripts órfãos +
  .claude/agents/ + worktrees) — slot oportunístico futuro.

CARRY-OVERS M28/M27/M26 AINDA VIVOS (não-bloqueantes):
- D-novo-WA-PHONE-NORMALIZE P2 (matcher telefone amplo).
- 3 ações WA declaradas em gatilhos sem implementação (PROCESSAR_OCR,
  MOSTRAR_MENU_PRINCIPAL).
- 17 modelos BOT órfãos.
- empresa_conveniada / proprietario_usina iterando só cooperados[0].
- Fase 3 Token-WA (TokenTransacao + QR pagamento real) — pausa
  explícita; retomada DEPOIS do Clube fechar.
- Untracked acumulados em backend/scripts/, backend/src/agents/, docs/.
- 218 membros parciais (segmentação pendente — carry-over M24/M25).
- 2 convites de smoke no convênio Santi (loteId
  6a84832d13679547071f6964) — ambienteTeste=true, mantidos.

DOC-SESSÃO 10/06 M29:
docs/sessoes/2026-06-10-bugs-onboarding-santi-fase-2-opcao-b.md

═══ FIM DA FRASE M29 ═══

— BLOCO ARQUIVADO M29 (acima — atendido por M30) ——————————————————

═══ FRASE COMANDANTE M30 — ARQUIVADA (atendida por M31) ═══

PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela
   anterior). Verificar que subagent `cooperebr-qa-funcional` aparece na
   lista de agents. Se não aparecer, parar e avisar.

2. Rodar `git status --short` (diretriz inegociável 18/05). Esperado
   pós-fechamento M30: working tree limpo (untracked carry-overs
   catalogados pra Sprint Housekeeping futuro); último commit é o de
   fechamento M30.

3. Rodar `pm2 list`. Esperado: `cooperebr-backend` + `cooperebr-frontend`
   + `cooperebr-whatsapp` online (3000/3001/3002 LISTENING) — M30 deixou
   stack em runtime após F1.5 + Fase 1.1. Toda mudança em `web/` exige
   rebuild (`next start` sob PM2, sem HMR).

PASSO 1 — Frase comandante (arrancar Sprint Clube P1, FASE 2 — F2 empresa-PJ-cooperada compra):

Sessão 10/06 entregou M30 em 8 commits (`e4d0976..ed33ffb`): Sprint Clube
Unificado P1 completou Fase 1 HUB + Fase 1.5 ECONOMIA em 4 blocos + 5o
commit fixes pos-review reviewers pesados + Fase 1.1 POLIMENTO MLM.
Estrutura nova entregue: ConfigCooperToken expandida com 11 campos
aditivos (8 taxas per-operacao + 3 oxidacao + marco temporal
oxidacaoAtivadaEm), helper puro calcularTaxa substituiu constantes
chumbadas preservando 2%/1% via fallback, oxidacao DECAY_CONTINUO
prospectiva com 3 invariantes matematicas + cron mensal + gate tecnico
OXIDACAO_PRODUCAO_LIBERADA pra producao, UI dedicada
/dashboard/cooper-token/config com banner ambar de gate juridico + guard
de UX antes de ligar, hub /dashboard/clube agora com 10 cards (6 originais
+ Configuracao + 3 MLM), botao "Voltar ao Clube" consistente nas 3 telas
que estavam sem. 85/85 specs Jest verde (7 suites). TSC web exit 0.
Reviewers cooperebr-financeiro-token-reviewer + cooperebr-multitenant-
reviewer aprovaram zero P0/P1 sobre Blocos 2+3+4 da logica de dinheiro;
3 fixes P2 catalogados (G2 + G3 + MT P2) entraram no 5o commit. 3 debitos
novos: D-novo-OXIDACAO-LEDGER-TIPO P2 (pre-requisito de ligar oxidacao em
prod), D-novo-OXIDACAO-PRESERVADOS-DUPLA-CONTAGEM P3 (conservador),
D-novo-OXIDACAO-SPECS P3.

ARRANCAR: **Sprint Clube Unificado P1 — FASE 2 (F2 empresa-PJ-cooperada
compra)** conforme prompt empacotado em
`docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md`
FASE 3 (numeracao do prompt — corresponde ao F2 da fila pos-Fase 1.5).

Escopo F2: empresa cooperada PJ compra tokens creditando `cooperadoId`
(CooperTokenSaldo + ledger via `creditar()`/`CooperTokenCompra`/Asaas).
Hoje so existe `parceiro/comprar` que credita `saldoParceiro=tenant` —
falta o caminho cooperado. Aplicar Taxa de Operacao (F1.5 ja preparada —
`taxaEmissaoPerc`/`taxaEmissaoFixa` via `calcularTaxa('emissao')` ja esta
no `creditar:103`). Multi-tenant: `cooperativaId` SEMPRE do JWT.
Idempotencia: `jti` unico pra prevenir cobranca dupla via Asaas. Specs
cobrindo: empresa-PJ valida (`isEmpresaCooperada`), valor > 0, taxa
aplicada, ledger entrada CREDITO + COMPRA_PARCEIRO ou similar, Asaas
webhook valida HMAC, dupla compra com mesmo jti retorna idempotente.

Fase 1 read-only + MAPA DE IMPACTO 5 dimensoes (Consumidores grep / Dados
Existentes SELECT / Propagacao DTO+types+queries+telas+relatorios+jobs+
extrato / Navegacao sem deep-link orfao / Re-Teste fluxos listados) →
PAUSAR pro OK → implementar → specs verdes.

DIRETRIZES INEGOCIAVEIS preservar (area dinheiro/token):
- Token = VOUCHER de circuito fechado; cooperativa = emissora unica.
- Saida de valor: estabelecimento = RESGATE/liquidacao (recibo, SEM NF);
  cooperado = SOBRA. PROIBIDO token→sobra.
- Multi-tenant: `cooperativaId` SEMPRE do JWT; toda query Prisma filtra
  `cooperativaId`.
- Transferencia/uso/compra de token: idempotencia via jti +
  `$transaction Serializable` quando aplicavel.
- Monetario: `Math.round(x*100)/100` em R$ + `Math.round(x*10000)/10000`
  em tokens.
- Disparo real (WA/email): SO whitelisted (`5527981341348` /
  `lucbragatto+sufixo@gmail.com`) + `ambienteTeste=true`.
- Reportar ao orquestrador ao fim da fase F2 → reviewers
  `cooperebr-financeiro-token-reviewer` +
  `cooperebr-multitenant-reviewer` antes do push.

PRE-REQUISITOS LEITURA (mapear, NAO codar):
1. docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo — M30).
2. docs/sessoes/2026-06-10-clube-hub-f15-fase11.md (M30 — esta sessao).
3. docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md
   (PROMPT FASE 3 = F2 na nossa fila).
4. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/
   regra_coerencia_sistemica_mapa_impacto_10_06.md.
5. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/
   decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md.
6. backend/src/cooper-token/cooper-token.service.ts:creditar (entry point
   que F2 vai usar).
7. backend/src/cooper-token/cooper-token.service.ts:upsertConfig (Taxa de
   Operacao F1.5 ja aplicada).
8. backend/src/cooper-token/cooper-token.controller.ts (entradas
   existentes parceiro/comprar — espelhar shape).
9. CLAUDE.md + .claude/CLAUDE.md.

ESTADO DE FILA (Decisao 24):
- M30 ✅ entregue.
- PROXIMO: F2 Empresa-PJ-cooperada compra.
- F4 Funcionario usa/transfere (PIN/OTP + Serializable + jti).
- F3 Empresa distribui em LOTE/INDIVIDUAL (mass-write reusa controles do
  Hardening; CLT 458).
- F6 Estabelecimento resgata (recibo, NAO recompra; flag
  Cooperado.ehEstabelecimento).
- Fatia A Nomenclatura (CTK→CooperToken, dois rios kWh×token).
- Sprint Hardening Mass-Write SUPER_ADMIN P2 (rebaixado, aguarda fim do
  Clube).
- Sprint Housekeeping (cleanup smokes Santi + scripts orfaos + worktrees)
  — slot oportunistico.

CARRY-OVERS M28/M29/M30 AINDA VIVOS (nao-bloqueantes):
- D-novo-OXIDACAO-LEDGER-TIPO P2 (pre-requisito de ligar oxidacao em
  prod).
- D-novo-OXIDACAO-PRESERVADOS-DUPLA-CONTAGEM P3.
- D-novo-OXIDACAO-SPECS P3.
- D-novo-WA-PHONE-NORMALIZE P2.
- 3 acoes WA declaradas sem implementacao (PROCESSAR_OCR,
  MOSTRAR_MENU_PRINCIPAL).
- 17 modelos BOT orfaos.
- empresa_conveniada / proprietario_usina iterando so cooperados[0].
- Fase 3 Token-WA — pausa explicita.
- Untracked acumulados em backend/scripts/, backend/src/agents/, docs/.
- 218 membros parciais.
- 2 convites de smoke no convenio Santi (loteId
  6a84832d13679547071f6964) — ambienteTeste=true, mantidos pra
  Housekeeping.

DOC-SESSAO 10/06 M30:
docs/sessoes/2026-06-10-clube-hub-f15-fase11.md

═══ FIM DA FRASE M30 ═══

— BLOCO ARQUIVADO M30 (acima — atendido por M31) ——————————————————

═══ FRASE COMANDANTE M31 — ATIVA PRÓXIMA SESSÃO ═══

PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela
   anterior). Verificar que subagent `cooperebr-qa-funcional` aparece na
   lista de agents. Se não aparecer, parar e avisar.

2. Rodar `git status --short` (diretriz inegociável 18/05). Esperado
   pós-fechamento M31: working tree limpo (untracked carry-overs
   catalogados pra Sprint Housekeeping futuro); último commit é o de
   fechamento M31.

3. Rodar `pm2 list`. Esperado: `cooperebr-backend` + `cooperebr-frontend`
   + `cooperebr-whatsapp` online (3000/3001/3002 LISTENING) — M31 deixou
   stack em runtime após F2 + smoke. Toda mudança em `web/` exige
   rebuild (`next start` sob PM2, sem HMR).

PASSO 1 — Frase comandante (arrancar Sprint Clube P1, FASE 3 — F4 funcionário usa/transfere):

Sessao 11/06 entregou M31 em 6 commits (`826d4f1..d69ebf3`): Sprint Clube
P1 FASE 2 (F2 empresa-PJ-cooperada compra tokens). Estrutura completa:
ConfigCooperToken + CooperTokenCompra ampliados com campos aditivos
(compradorCooperadoId, asaasCobrancaId, ultimoWebhookEventId,
@@unique[asaasId]) + enum COMPRA_PJ_COOPERADA + endpoint POST
/cooper-token/cooperado/comprar reusando AsaasService.emitirCobranca pra
emitir cobranca SANDBOX real (PIX/BOLETO) + webhook Asaas extension emite
evento cooper-token-compra-pj.paga via EventEmitter (evita dep circular)
→ listener processa via processarPagamentoCompraPj que faz compare-and-swap
atomico (fix GAP 1) + chama creditar() com tipo COMPRA_PJ_COOPERADA
(Taxa F1.5 sai de graca via calcularTaxa('emissao')) + status
PAGO_CREDITO_PENDENTE com alerta loud se creditar falhar (fix GAP 2) +
cross-tenant guard novo em creditar() (defesa em TODOS callers) + UI
dedicada /portal/comprar-tokens com guard PJ + link condicional em
/portal/tokens. Reviewers cooperebr-financeiro-token-reviewer +
cooperebr-multitenant-reviewer aprovaram zero P0/P1 em 2 rodadas (acharam
e fecharam 2 P1 reais no 5o commit). Smoke E2E real com Santi PJ no Asaas
SANDBOX validou ponta-a-ponta: compra 100 PIX → cobranca real
(pay_wrh5zqdifbcx33vb, QR 1144 chars) → dual-webhook CONFIRMED+RECEIVED
→ 5/5 asserts PASS (status PAGO + saldo +98 tokens taxa 2% + ledger 1
entry so compare-and-swap funcional + tipo COMPRA_PJ_COOPERADA + webhook
2 ok). Ganho contabil rio-token automatico (2 LancamentoCaixa R$ 44,10 D
Custo + C Passivo). 9 suites / 106 tests verde. 4 debitos novos
catalogados (ASAAS-WEBHOOK-AUTH P2 + LEDGER-UNIQUE-CONSTRAINT P3 +
CREDITO-PENDENTE-REPROCESSAMENTO P2).

ARRANCAR: Sprint Clube P1 — FASE 3 (F4 funcionario usa/transfere tokens)
conforme prompt empacotado em
docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md
FASE 4 (= F4 da fila).

Escopo F4: bot WA + portal cooperado ja tem usar-na-fatura e
transferir/enviar no nivel cooperado (legado). F4 amarra ao fluxo
**conveniado → funcionario** com PIN/OTP + $transaction Serializable +
idempotencia via jti. Aplicar Taxa de Operacao F1.5 (taxaTransferenciaPerc
/ taxaTransferenciaFixa ja preparados, default 0). Specs cobrindo bypass
de saldo (nao pode usar mais que saldoDisponivel) + idempotencia jti
(mesma chamada nao credita 2× o destino) + PIN lockout aproveitando
pin-cooperado.service.ts do M26 F2.3.

Fase 1 read-only + MAPA DE IMPACTO 5 dimensoes + 5 pontos extras (espelhar
usar-na-fatura/enviarTokens existentes, jti gerado vs aceito do body, PIN
guard ja existente, Taxa F1.5 transferencia via calcularTaxa
('transferencia'), fluxo conveniado→funcionario no UX) → PAUSAR pro OK →
implementar → specs verdes.

DIRETRIZES INEGOCIAVEIS preservar (area dinheiro/token):
- Token = VOUCHER de circuito fechado; cooperativa = emissora unica.
- Saida de valor: estabelecimento = RESGATE/liquidacao (recibo, SEM NF);
  cooperado = SOBRA. PROIBIDO token→sobra.
- Multi-tenant: cooperativaId SEMPRE do JWT; toda query Prisma filtra
  cooperativaId.
- Transferencia/uso de token: PIN/OTP + $transaction Serializable +
  idempotencia (jti).
- Monetario: Math.round(x*100)/100 em R$ + Math.round(x*10000)/10000 em
  tokens.
- Disparo real (WA/email): SO whitelisted (5527981341348 / lucbragatto+
  sufixo@gmail.com) + ambienteTeste=true.
- Reportar ao orquestrador ao fim de F4 → reviewers cooperebr-
  financeiro-token-reviewer + cooperebr-multitenant-reviewer antes do
  push.

PRE-REQUISITOS LEITURA (mapear, NAO codar):
1. docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo — M31).
2. docs/sessoes/2026-06-11-f2-compra-pj-cooperada.md (M31 — esta sessao).
3. docs/relatorios/2026-06-10-prompt-sprint-clube-unificado-cooper-token.md
   (FASE 4 = F4 na fila).
4. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/regra_coerencia_
   sistemica_mapa_impacto_10_06.md.
5. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo
   _token_voucher_sobra_resgate_2026_06_04.md.
6. backend/src/cooper-token/cooper-token.service.ts:usarNaFatura +
   :enviarTokens (entry points F4).
7. backend/src/cooper-token/pin-cooperado.service.ts (PIN/lockout M26 F2.3).
8. backend/src/common/security/otp-desafio.service.ts (OTP F2.4).
9. CLAUDE.md + .claude/CLAUDE.md.

ESTADO DE FILA (Decisao 24):
- M31 ✅ entregue.
- PROXIMO: F4 Funcionario usa/transfere (PIN/OTP + Serializable + jti).
- F3 Empresa distribui em LOTE/INDIVIDUAL (mass-write reusa Hardening;
  CLT 458).
- F6 Estabelecimento resgata (recibo, NAO recompra; flag Cooperado.
  ehEstabelecimento).
- Fatia A Nomenclatura (CTK→CooperToken, dois rios kWh×token).
- Sprint Hardening Mass-Write SUPER_ADMIN P2 (rebaixado, aguarda fim do
  Clube).
- Sprint Housekeeping (cleanup smokes Santi + CooperTokenCompra F2 +
  scripts orfaos + worktrees) — slot oportunistico.

CARRY-OVERS M28/M29/M30/M31 AINDA VIVOS (nao-bloqueantes):
- D-novo-ASAAS-WEBHOOK-AUTH P2 (token estatico vs HMAC-SHA256).
- D-novo-LEDGER-UNIQUE-CONSTRAINT P3 (endurecer idempotencia banco
  ledger).
- D-novo-CREDITO-PENDENTE-REPROCESSAMENTO P2 (listener+cron pra
  PAGO_CREDITO_PENDENTE).
- D-novo-OXIDACAO-LEDGER-TIPO P2 (pre-req ligar oxidacao em prod).
- D-novo-OXIDACAO-PRESERVADOS-DUPLA-CONTAGEM P3.
- D-novo-OXIDACAO-SPECS P3.
- D-novo-WA-PHONE-NORMALIZE P2.
- 3 acoes WA declaradas sem implementacao.
- 17 modelos BOT orfaos.
- empresa_conveniada / proprietario_usina iterando so cooperados[0].
- Fase 3 Token-WA — pausa explicita.
- Untracked acumulados em backend/scripts/, backend/src/agents/, docs/.
- 218 membros parciais.
- 2 convites de smoke convenio Santi (loteId 6a84832d…) + 1
  CooperTokenCompra smoke F2 (cmq9lem61…) — ambienteTeste=true.

DOC-SESSAO 11/06 M31:
docs/sessoes/2026-06-11-f2-compra-pj-cooperada.md

═══ FIM DA FRASE M31 ═══

— BLOCO ARQUIVADO M27 ABAIXO (clica pra expandir) ——————————————————

PASSO 1 ARQUIVADO — Frase M27 anterior (08/06 — arquivada):

Sessão 08/06 entregou M27 (revisão multi-tenant + segurança da feature
"qual cadastro?" do M26 + skills Coop + F0 Fase 1 read-only CooperToken).
5 commits trabalho `6f48da7..f980a69`:
- 6f48da7 filtra cooperado inativo em obterContextos + matcher + impersonate
  (3 pontos backend; cadastro DESLIGADO/REMOVIDO não vira contexto nem JWT).
- 9dce791 skills cooper-token + wa-bot pro agente Coop (`.agent/memory/`
  + `.agent/AGENTS.md` itens 7 e 8 da seção Startup).
- e1e8c45 persiste contexto_ativo_id no front + chaves React por id
  (ContextoSwitcher + selecionar-contexto) + COOKIE_OPTS.secure em prod
  (`NODE_ENV === 'production'`).
- b0e7cd6 bloqueia TROCAR CADASTRO em estado sensível
  (`ALTERAR_LIMITE_AGUARDANDO_PIN`/`VALOR` — Fase 3 token) + zera
  `dadosTemp` em SAIR e pre-update em INÍCIO (higiene PII).
- f980a69 throttle 10/min em `POST /auth/trocar-contexto`
  (anti-enumeração contra anti-IDOR existente).

297+ specs Jest verde (28 auth/matcher com 3 specs novos do filtro de
status + 269 motor WA com 4 specs novos: SAIR zera dadosTemp + 2 TROCAR
CADASTRO bloqueado + ajustes de objectContaining). PM2 backend+frontend
rebuilt e restartado.

F0 Fase 1 read-only confirmou 2 bugs P0 de conformidade no CooperToken:

(a) `backend/src/cooper-token/cooper-token.service.ts:1062-1065` — dentro
de `processarPagamentoQr`, o trecho
`if (recebedorCooperativaId) { await this.creditarSaldoParceiroTx(tx,
recebedorCooperativaId, quantidadeLiquida) }` credita o saldo da
cooperativa quando um cooperado paga outro por QR. Cessão peer-to-peer
não emite saldo novo pra cooperativa — tokens só circulam, não nascem.
Efeito colateral: `processarQrParceiro` chama `processarPagamentoQr` +
faz seu próprio crédito, então o saldo parceiro é creditado 2× pro QR
parceiro hoje.

(b) `cooper-token.service.ts:1335-1336` — em `processarQrParceiro`,
`const taxa1Pct = Math.round(resultado.quantidadeLiquida * TAXA_QR *
10000) / 10000` reaplica TAXA_QR sobre `resultado.quantidadeLiquida`
que JÁ É LÍQUIDA (saiu com 1% descontado em `processarPagamentoQr:978`).
Resultado: parceiro recebe 98,01 em vez de 99 (taxa efetiva ≈ 1,99%).

ARRANCA F0 Fase 2 — execução direta autorizada:

1. Remover bloco `creditarSaldoParceiroTx` em `processarPagamentoQr`
   linhas 1062-1065 (4 linhas + comentário).
2. Corrigir dupla taxa em `processarQrParceiro` linhas 1335-1336:
   substituir por
   `const liquidoParceiro = resultado.quantidadeLiquida;`
   `const taxa1Pct = resultado.taxa;`
   (já vêm arredondados a 4 casas pelo cálculo da linha 978-980).
3. Specs Jest novos em `cooper-token.service.spec.ts` (ou novo arquivo
   `cooper-token.qr.spec.ts`):
   (i) QR cooperado→cooperado NÃO chama
       `cooperTokenSaldoParceiro.update/create`;
   (ii) taxa QR contada exatamente 1× (`taxa = bruto * 0.01`,
        `liquidoParceiro === bruto - taxa`);
   (iii) arredondamento `Math.round(x*100)/100` no valor monetário
         derivado quando aplicável.
4. Rebuild PM2 backend ritual: `pm2 stop cooperebr-backend ;
   cd backend ; npm run build ; pm2 restart cooperebr-backend`.
5. Commit pequeno em PT:
   `fix(cooper-token): F0 remove duplo credito saldoParceiro + dupla taxa QR`.

DIRETRIZES OBRIGATÓRIAS:
- Multi-tenant: `cooperativaId` vem do JWT, nunca do body. Filtros Prisma
  preservam isolamento.
- Arredondamento monetário `Math.round(x*100)/100` em qualquer derivação
  monetária nova (regra CLAUDE.md).
- Specs verdes obrigatórias antes do commit.
- Rebuild PM2 backend (stop → build → restart) em toda mudança backend.
- Fase 1 read-only Decisão 23 já cumprida nesta sessão — Fase 2 está
  autorizada pelo Luciano no pedido original. Aplicar direto.

PRÉ-REQUISITOS LEITURA F0 Fase 2 (mapear, complementar à confirmação Fase 1):
1. docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo — M27).
2. docs/sessoes/2026-06-08-revisao-multi-tenant-qual-cadastro-skills-coop-f0-readonly.md
   (M27 — esta sessão; seções "F0 — Fase 1 read-only CooperToken" e
   "Próximo passo").
3. backend/src/cooper-token/cooper-token.service.ts:939-1090
   (`processarPagamentoQr` completo).
4. backend/src/cooper-token/cooper-token.service.ts:1320-1371
   (`processarQrParceiro` completo).
5. backend/src/cooper-token/cooper-token.service.ts:1607-1642
   (`creditarSaldoParceiro` / `creditarSaldoParceiroTx` — entender quem
   chama, garantir que `processarPagamentoCobranca` e demais paths
   legítimos continuam intactos).
6. backend/src/cooper-token/cooper-token.service.spec.ts (se existir;
   senão criar `cooper-token.qr.spec.ts` ao lado).
7. CLAUDE.md + .claude/CLAUDE.md (regras + lição `next start`).

CARRY-OVERS M26 AINDA VIVOS (não-bloqueantes):
- D-novo-WA-PHONE-NORMALIZE P2 (matcher telefone amplo).
- 3 ações WA declaradas em gatilhos sem implementação.
- 17 modelos BOT órfãos.
- `empresa_conveniada` / `proprietario_usina` iterando só `cooperados[0]`.
- Fase 3 Token-WA — pausa explícita Luciano (F0 deve fechar antes).

CARRY-OVERS NOVOS DESTA SESSÃO (não-bloqueantes):
- `.claude/agents/wa-bot-agent.md` modificado não-commitado (carry-over
  órfão M26 — Sprint Housekeeping).
- `cooperebr-edge-agent` stopped (projeto vizinho, fora do escopo).
- Untracked acumulados em `backend/scripts/`, `.claude/agents/`,
  `backend/src/agents/`, `docs/RECOMENDACAO-ARQUITETURA-FINAL.md`,
  `docs/arquitetura-agentes-pkm-cooperebr.md`, `tmp_smoke_check.mjs`.

DOC-SESSÃO 08/06 M27:
docs/sessoes/2026-06-08-revisao-multi-tenant-qual-cadastro-skills-coop-f0-readonly.md
```

---

### Frase M25 anterior (07/06 — arquivada)

(substituída pela frase M26 acima — preservada abaixo só pra histórico curto;
detalhes em `docs/sessoes/2026-06-07-bloco-2-kwh-convite-lote.md`).

<details>
<summary>Frase M25 arquivada (clicar pra expandir)</summary>

```
PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela anterior).
   Verificar que subagent `cooperebr-qa-funcional` aparece na lista de agents.
   Se não aparecer, parar e avisar.

2. Rodar `git status --short`. Esperado pós-fechamento: working tree
   limpo (untracked carry-overs catalogados + 1 modificação não-minha
   em .claude/agents/wa-bot-agent.md que Luciano avalia), último commit
   é o de fechamento M25 (Bloco 2 Empresa vê kWh + Correção modelo kWh
   + Sprint Convite-Lote completo 5/5).

3. Rodar `pm2 list`. Esperado: cooperebr-backend + cooperebr-frontend
   online. ⚠ Frontend é `next start` sob PM2 (NÃO `next dev`) — toda
   mudança de frontend exige `cd web ; npm run build ; pm2 restart
   cooperebr-frontend`. HMR NÃO ROLA.

PASSO 1 — Frase comandante (Luciano DECIDE qual das 2 opções):

Sessão 07/06 entregou M25 — Bloco 2 do Sprint Onboarding (empresa
pagadora vê total de kWh dos funcionários no portal `/conveniada/`)
+ Correção arquitetural do modelo kWh (total = SOMA DINÂMICA das
cotas dos membros, NÃO rateio do pacote; kwhAlocadoMensal vira
"crédito disponível"/referência) + Sprint Convite-Lote completo
em 5 fatias (preview CSV → envio em fila throttle 2s → tela →
modo B Abrir no WhatsApp + helper wa.me reusável MLM).

11 commits trabalho `6664aed..8a957bd` (incluindo 3 fixes críticos:
modelo kWh `5f66ab3` + complemento valorAPagar `e427230` + UI cega
`dac1907`). 310/310 specs convenios verdes. Smoke prova-real 14/14
confirmou `preview.valorAPagar === cobranca.valorLiquido` (fonte
única do dinheiro). Tela Clínica Teste agora mostra Total 1.200 kWh
/ R$ 1.200,00 com 3 membros (seed cotas 300/400/500 aplicado).

DECIDA — duas opções pra arrancar:

(A) BLOCO 3 SPRINT ONBOARDING — cadastro fácil sem UC. Continua
    roadmap A→H do Sprint Onboarding (após Blocos 0/1/2 entregues).
    Membro pode entrar mesmo sem ter UC ativa; cooperativa gera UC
    depois via fluxo separado. Spec:
    `docs/especificacao-circuito-cooper-token-convenio.md`. Estado
    atual: `/publico/cadastro-sem-uc` existe (M22 Fatia F-G1) com
    UC sintética; refinar/expandir.

(B) MÓDULO PAGAR CONCESSIONÁRIA (MANDATO) — concretiza o 3º modelo
    do circuito CooperToken (memória `decisao_modelo_token_voucher
    _sobra_resgate_2026_06_04.md`). Cooperado dá mandato pra
    cooperativa pagar concessionária direto; transparência fiscal-
    tributária total; PIS/COFINS isenção ato cooperativo preservada.
    Demanda parecer regulatório (ANEEL/CC) + spec contratual de
    mandato. Mapear: `docs/especificacao-contabilidade-cooperativa-
    segregada.md` § ato cooperativo Art. 79.

Fase 1 read-only obrigatória qualquer que seja a escolha (Decisão 23).

Pendência paralela P2 (NÃO bloqueia escolha — tarefa separada):
- Segmentar 218 membros parciais detectados pelo DRY-RUN M24 antes
  de reconciliação em massa (oco × SEM_UC legítimo × lista espera ×
  sintético teste). Estimativa ~2-4h script.
- Reprocessar fatura do LEONARDO PIZZOL VIGNA (cota 500 demo aplicada
  M25; fatura real ainda pendente OCR + recadastro UC).
- Aplicar mensagem de convite nova no Code (Luciano sugeriu em
  paralelo).

Pré-requisitos Fase 1 read-only OBRIGATÓRIOS (mapear, NÃO codar):
1. Ler docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo — M25)
2. Ler docs/sessoes/2026-06-07-bloco-2-kwh-convite-lote.md (M25 — esta)
3. Ler ~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md
4. Ler memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md
   (3 modelos token/mandato — referência crítica pra opção B)
5. Ler docs/sessoes/2026-06-06-bloco-0-1-onboarding-membro.md (M24
   anterior, Bloco 0+1 — referência pra opção A)
6. docs/especificacao-circuito-cooper-token-convenio.md (Bloco 3+)
7. Se opção A: mapear backend/src/cooperados/cooperados.service.ts
   + backend/src/ucs/ucs.service.ts + endpoint
   /publico/cadastro-sem-uc atual
8. Se opção B: docs/especificacao-contabilidade-cooperativa-
   segregada.md (PIS/COFINS isenção) + memória mandato
9. CLAUDE.md + .claude/CLAUDE.md (regras + lição `next start`)
10. git log --oneline -15

Decisão 23: SEMPRE Fase 1 read-only ANTES de codar.
LIÇÃO `next start` (04/06): frontend mudou → `cd web ; npm run build ;
pm2 restart cooperebr-frontend`. HMR NÃO ROLA neste setup.
LIÇÃO PM2 backend: schema delta → `pm2 stop ; db push ; generate ; pm2 restart`.
LIÇÃO M25 (07/06): kwhAlocadoMensal é REFERÊNCIA (crédito disponível),
NÃO valor cobrado. Total = soma dinâmica das cotas (ALOCACAO_FIXA) ou
soma das faturas (CONSUMO_REAL). FONTE ÚNICA preservada via helper
privado `calcularValorEnergia` compartilhado entre preview e cobrança.
LIÇÃO M25 UI: tabela de listagem NUNCA esconde itens — mensagens de
estado (vazio, parcial) viram BANNER, não substituem a tabela.

CONTEXTO DA SESSÃO 07/06 (11 commits 6664aed..8a957bd):

- 6664aed Fatia 2.1 — `previewKwhConsolidado` (helper read-only fonte
  única — gerarCobrancaConsolidada DELEGA). 5 estados não-throw + anti-IDOR.
- 70bf820 Fatia 2.2 — `ratearProporcionalCusteio` (helper puro com
  INVARIANTE fechamento centavo, 15/15 specs — APOSENTADO pós-fix kWh).
- 4a8dec3 Fatia 2.3 — `GET /portal/meus-convenios/:id/kwh-consumo`
  gated @PagadorCooperadoOnly + @AuditLog + UC mascarada `...054` LGPD.
- f74c3d6 Fatia 2.4 — Tela consumo dos funcionários (`ConsumoFuncionariosCard`
  inline com selector mês + tabela + HelpBox).
- 5f66ab3 **FIX modelo kWh** — total = SOMA DINÂMICA das cotas (não
  rateio do pacote). kwhAlocadoMensal vira referência. ALOCACAO_FIXA
  sem cotas → SEM_CONSUMO_CAPTURADO (skip cobrança, não cobra 200k vazios).
- 0756dcb LOTE.1 — Backend preview CSV/TXT + 5 estados (PRONTO/
  DUPLICATA_CSV/JA_MEMBRO/JA_CONVIDADO/INVALIDO) + dedup interno/externo.
- 8de49e0 LOTE.2+3 — Schema delta `loteId` + envio em fila `setImmediate`
  + throttle 2s + status agregado com sufixo telefone LGPD.
- e427230 **FIX kWh complemento** — `valorAPagar` exposto no preview
  via helper privado `calcularValorEnergia` (FONTE ÚNICA compartilhada
  com gerarCobrancaConsolidada). Tela 3 colunas: Disponível × Total
  atual × Valor a pagar.
- 635143e LOTE.4 — Tela `EnvioLoteSection` (4 steps state machine:
  upload→previa→enviando→concluido) no portal-empresa + admin.
- dac1907 **FIX UI cega kWh** — tabela SEMPRE renderiza quando há
  membros (banner azul informativo NÃO substitui lista). + seed demo
  Clínica Teste cotas 300/400/500 → Total 1.200 kWh / R$ 1.200,00.
- 8a957bd LOTE.5 — Modo B "Abrir no WhatsApp" (`wa.me/<tel>?text=msg`)
  + helper puro `buildWaMeConviteUrl` com 2 variantes (CONVENIO_EMPRESA
  + INDICACAO_COOPERADO) preparado pra MLM individual futuro. Schema
  delta `cooperadoIndicadorId String?` pra atribuição.

ACHADOS OPERACIONAIS M25:
- Bug arquitetural ALOCACAO_FIXA cobrando 200k SEMPRE (mesmo sem
  funcionários) — RESOLVIDO via modelo correto.
- Bug UX cega tela kWh escondia tabela quando total=0 — RESOLVIDO.
- FONTE ÚNICA do dinheiro: `preview.valorAPagar === cobranca.valorLiquido`
  validado em smoke prova-real 14/14.

CONTEXTO DA SESSÃO 06/06 (8 commits a9794a8..8e47737):

- a9794a8 feat(plano-clube) Fatia 0.1 — model PlanoClube + CRUD
  multi-tenant (404 cross-tenant + soft-delete) + tela admin
  /dashboard/parceiros/[id]/planos-clube + helper resolverParaCobranca
  (null quando cobra=false ou valorMensal=0). Bloco 0 arranca.
- 6584aec feat(plano-clube) Fatia 0.2 — planoClubeId nullable no
  ContratoConvenio. Vínculo do plano com convênio EMPRESA paga.
  Sem migração de perda.
- 29999c6 feat(plano-clube) Fatia 0.3 — Cooperado.planoClubeId +
  adesaoClubeEm (adesão opt-in INDIVIDUAL). INVARIANTE anti-cobrança-
  dupla: CooperadoClubeService.aderir bloqueia opt-in quando cooperado
  é membro ATIVO de convênio com planoClubeId não-nulo. Cancelar
  idempotente. Helper resolverParaCobrancaIndividual pra Fatia 0.4.
- 34a66c8 feat(plano-clube) Fatia 0.4 BLOCO 0 COMPLETO — componente
  CLUBE escalar discriminado nas 2 cobranças. Cobranca ganha
  valorMensalidadeClube + planoClubeId. CobrancasService.create
  injeta @Optional CooperadoClubeService: após energia, soma clube
  no valLiq + grava componentes. darBaixa subtrai clube de valorFinal
  ANTES do hook contábil (não infla energia SCEE). ConveniosCusteioService
  (consolidada) soma membros.length × snap.valorMensal quando cobra=true.
- d18e7f6 feat(convite-convenio) Fatia 1.1 — validarToken propaga
  convenioId + permiteSemUc + empresaNome com anti-spoof do model.
  Anti-enumeração nos tokens inválidos. LGPD telefone mascarado.
  28/28 specs + 10 checks.
- cfc6421 feat(cadastro-web) Fatia 1.2 — bug arquitetural dados perdidos
  fechado. cadastroWebV2 agora persiste cotaKwhMensal (helper exportado
  derivarCotaKwhMensal — fórmula `consumoMedioKwh ?? média(historicoConsumo)`,
  11 specs cobrindo edge cases). pendenciaMotorMsg best-effort no catch
  do motor. consumoStashOcr (Json snapshot completo) populado pós-tx
  pra reconciliação futura sem reupload de fatura. UI /dashboard/cooperados
  ganha badge amarelo "Cadastro incompleto" com tooltip.
- 412b2da feat(aprovacao-convenio) Fatia 1.3 — MembroBuilderService
  ÚNICO ponto de entrada idempotente. Princípio arquitetural: NÃO alocar
  recurso pra membro NÃO-APROVADO; membro CONSTRUÍDO no gate MEMBRO_ATIVO.
  Ordem (importa!): (1) anti-spoof tenant, (2) flip status PENDENTE→ATIVO
  ANTES do motor, (3) motor.aceitar com planoId direto do plano custeado
  global (NÃO convenioCusteioId — membro JÁ está MEMBRO_ATIVO, adicionarMembro
  estouraria), (4) persiste pendência conforme resultado, (5) matricula
  clube. Degradação graciosa: motor estoura → catch + pendência visível +
  NUNCA propaga. Wire em aprovarPorAdmin DEPOIS do tx Serializable.
  forwardRef no ciclo DI Convenios↔MotorProposta. 10 specs Jest helper +
  smoke E2E 25/25 passos em 3 cenários (caminho feliz, LEONARDO-like sem
  cota, idempotência).
- 8e47737 feat(reconciliacao) Fatia 1.4 BLOCO 1 COMPLETO — matrícula
  clube agora consulta ConfigClubeVantagens.ativo (sem config OU
  ativo=false → pula sem falha). motor-proposta.service.ts:875 fix inline
  D-novo-LISTA-ESPERA-TENANT (tx.listaEspera.create + count() filtrados
  por cooperativaId). Script scripts/reconciliar-membros-oco.ts —
  DRY-RUN/--apply idempotente PER-STEP (filtros --tenant/--membro).
  Smoke integração cobrança 8/8: (1) cadastro+aprovação+helper monta
  membro completo, (2) cobrança individual bloqueada por guard
  custeadoPorConvenio (cobrancas.service.ts:179), (3) consolidada
  ALOCACAO_FIXA × R$1/kWh × 200000 kWh = R$200000 bruto/líquido.

ACHADO OPERACIONAL CRÍTICO M24:
- 218 membros parciais detectados no tenant CoopereBR (Hangar +
  Condomínio Moradas dominam). NÃO `--apply` em massa sem segmentar
  primeiro: oco genuíno × SEM_UC legítimo × lista de espera × teste
  sintético. Promover sintético a MEMBRO_ATIVO + matriculá-lo no clube
  é bug de dados. P2 separada.

LEONARDO PIZZOL VIGNA reconciliado na sessão de retomada M24
(07/06): script `--membro <id>` aplicou helper individual; estado
final ATIVO + ProgressaoClube BRONZE + pendenciaMotor "cota não
capturada". Contrato NÃO foi forçado (cota perdida pré-Fatia 1.2 —
precisa reprocessar fatura + recadastrar UC depois).

ENTREGAS PRONTAS PRA SMOKE (carry-overs anteriores M22/M23):
- Golden path Fatia F-G1 VALIDADO via smoke E2E programático
  (backend/scripts/smoke-golden-path-conv-ref.ts) 0 falhas em 12 passos.
  Convite ativo Luciano: token e1bb49fea48d8cd27a4a646e236c6b1cf1c8d097
  a1c4eb883a88b6ef281b007b (OTP zerado, válido 12/06).
- Portal Empresa golden path E2E manual via celular (192.168.3.88:3001)
  (carry-over da sessão 04/06).
- Smoke gateway DOWN→UP F1 (precisa Asaas sandbox).

CONSTRAINTS APLICÁVEIS:
- Decisão 23: Fase 1 read-only OBRIGATÓRIA antes de tocar código.
- Decisão 24: frase de retomada local único (esta seção).
- Multi-tenant em toda query Prisma; @TenantResource + @AuditLog em
  handlers admin. 404 (não 403) em mismatch — anti-enumeração.
- isAmbienteReal() em endpoints dev (NUNCA NODE_ENV — regra 18/05).
- Regra contatos teste: 27981341348 + 27999479097 +
  lucbragatto+*@gmail.com.
- Math.round(x*100)/100 em todo valor monetário.
- Schema aditivo sem --accept-data-loss; ritual PM2 (stop → port livre
  → db push → generate → restart).
- Transações Prisma Serializable em operações multi-modelo críticas.
- ⚠️ LIÇÃO `next start`: toda mudança de frontend exige
  `cd web ; npm run build ; pm2 restart cooperebr-frontend`. HMR NÃO
  ROLA. Documentado em CLAUDE.md.
- ⚠️ LIÇÃO BUILD-POISON: tmp_*.ts/smoke*.ts excluídos do build (chore
  7b14287); src/agents excluído do tsconfig.build. Não criar no root.
- ⚠️ LIÇÃO commit SCOPED: NUNCA `git add .` ou `-A`. Lista exata de
  arquivos pra evitar carry-overs (.agent/, .claude/agents,
  backend/src/agents, tmp_*).
- ⚠️ LIÇÃO Opção A (05/06): perfil COOPERADO único; empresa cooperada
  PJ tem perfil COOPERADO; contexto derivado de match email +
  pagadorCooperadoId. EMPRESA_CONVENIADA @deprecated.
- ⚠️ LIÇÃO multi-tenant naming (05/06): NUNCA hardcodar "CoopereBR" em
  template/mensagem/UI. Carregar de coopAlvo.nome ou hook
  useTipoParceiro().
- Regra HELP 19/05: TODA tela nova exibe help inline contextual.
- Selects NATIVOS em Dialog/wizard (Shadcn select tem z-index issue).
- Regra UX 17/05 Tipo C: Dialog focado pra ação simples (convidar,
  aprovar); página própria pra cadastro/edição.

PRE-REQUISITOS LEITURA (ordem fixa):
1. docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo + ## FRASE DE RETOMADA)
2. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md
3. docs/sessoes/2026-06-06-bloco-0-1-onboarding-membro.md (M24 — esta,
   Bloco 0 Plano de Clube + Bloco 1 Aprovação CONSTRÓI o membro)
4. docs/sessoes/2026-06-05-hardening-golden-path-conv-ref.md (M23 —
   anterior, hardening golden path com smoke E2E)
5. docs/especificacao-circuito-cooper-token-convenio.md (Bloco 2 +
   Fatias C/D/E/G futuras)
6. backend/src/convenios/portal-empresa/ (portal empresa conveniada
   atual — Fatia 9.0/9.1 da Convergência 04/06; base do Bloco 2)
7. web/app/conveniada/convenio/[id]/page.tsx (dashboard empresa —
   referência de seções reusáveis)
8. backend/src/convenios/convenios-membros.service.ts (membros do
   convênio — agregação base pra Bloco 2)
9. backend/src/convenios/convenios-custeio.service.ts:200-370 (fluxo
   CONSUMO_REAL × ALOCACAO_FIXA — semântica kWh agregado existente)
10. backend/src/convenios/membro-builder.service.ts (helper Fatia 1.3 —
    campos do Cooperado disponíveis pra agregação)
11. CLAUDE.md + .claude/CLAUDE.md (regras + lição `next start`)
12. git log --oneline -15

CARRY-OVERS (não-bloqueantes):
- Smoke E2E manual Luciano: golden path F-G1 via celular (convite
  Clínica teste token e1bb49fe...b007b destravado, OTP zerado).
- 6 débitos novos da sessão M23: D-novo-OTP-429-UX P3 +
  D-novo-OTP-DEV-RELAX P3 + D-novo-AUTO-INSCREVER-DEPRECATION P3 +
  D-novo-CAD-CONSUMO-MENSAL P2 + D-novo-CONVITE-MENUS-UX P3 +
  D-novo-TESTS-MOCK-PRISMA P2.
- D-novo-PORTAL-EMPRESA-SEED-TESTE P3 (remover seed + box credenciais
  antes de prod).
- D-novo-DEV-LAN-ACCESS P3 (CORS+API_URL pra domínio público + rebuild).
- 7 débitos /cadastro (sessão 04/06).
- Slim /convite-convenio/[token] + /publico/convenios/auto-inscrever
  candidatos a deprecação (housekeeping pós-fix CONV-MEMBRO).
- D-novo-CT-VALIDACAO-FISCAL P0 (gate fiscal interno)
- D-novo-CT-MULTI-REGIME-CLASSIFICACAO P1 (bloqueia Sinergia)
- D-novo-BM P0 BLOQUEADOR REMOÇÃO PRÉ-PROD
- D-novo-AGENTS-ORPHAN P3 (pasta src/agents)
- 256 legados allowlist lint:tenant

FRENTES OPERACIONAIS LUCIANO:
⏳ PRIORITARIO: Sessão de Validação Fiscal Interna (gate produção contábil)
⏳ Smoke E2E real Fatia F-G1 via celular (golden path destravado)
⏳ Smoke E2E real Portal Empresa Conveniada via celular
⏳ Decisões regulatórias Sub-Sprint A (advogado) + STF Tema 536
⏳ Cadastrar Usuario E-Solares real

DOC-SESSAO 05/06 tarde-noite:
docs/sessoes/2026-06-05-hardening-golden-path-conv-ref.md
```

</details>

---

### Frase Fatia 4 Sprint Convite-Convênio (anterior 03/06, arquivada — substituída pela frase Fatia F-G1 CooperToken acima)

Substituída pelo M21 Sprint Multi-Frente 04/06.

```
[frase arquivada — substituída pelo M21 Sprint Multi-Frente 04/06]

PASSO 1 — Frase comandante (próximo Code arranca aqui):

RODAR FATIA 4 DO SPRINT CONVITE-CONVÊNIO — FRONTEND DAS 2 PÁGINAS PÚBLICAS.

Implementar:

A) /convite/[token] — 3 etapas (token + OTP + cadastro), single-page:
   1. Componente "ValidarToken" → GET /publico/convites/:token → mostra
      empresaNome + nomeConvidado + telefoneSufixo + status (otpJaValidado?).
      Erros amigáveis (expirado/inexistente/usado) com botão "Voltar".
   2. Componente "SolicitarOTP" → POST /publico/convites/:token/solicitar-otp
      → mostra "Código enviado pro WhatsApp ...XX99 — válido 10min".
      Botão "Reenviar" desabilitado durante cooldown 60s (contador regressivo).
   3. Componente "ValidarOTP" → POST .../validar-otp { codigo: 6 dígitos }
      → input numérico 6 boxes (auto-advance entre dígitos). Erros: tentativas
      restantes + bloqueio com countdown.
   4. Componente "PreencherCadastro" → POST /publico/convenios/auto-inscrever
      { token, cpf, nome, email, telefone?, consumoMedioKwh? } →
      Sucesso: tela "Cadastro enviado, aguarde aprovação da empresa".

B) /aprovacao-membro/[token] — página da empresa decidir:
   1. GET /publico/aprovacao-membro/:token → mostra empresaNome (sua),
      nomeConvidado, cpfSufixo, telefoneSufixo, dataAdesao.
   2. HelpBox proeminente: "Você está confirmando que [nome] é seu funcionário
      ou médico..." (texto cravado na Fatia 3 — regra 19/05).
   3. 2 botões grandes: CONFIRMAR (verde) e RECUSAR (textarea motivo obrigatório).
   4. POST .../:token { decisao, motivo? } → tela "Decisão registrada" +
      orienta cooperado.

Pré-requisitos Fase 1 read-only OBRIGATÓRIOS:
1. Mapear UI existente de cadastro público /cadastro (componentes shadcn,
   padrão wizard, validação formulário, regra HELP 19/05 com 3 banners
   feedback).
2. Identificar componentes reusáveis (HelpBox, banners, selects nativos
   em dialogs/wizards — regra 19/05).
3. Confirmar Next.js App Router pattern pra páginas dinâmicas [token].
4. Confirmar como o frontend consome erros do backend (ConflictException
   com message JSON tipo {erro:'cooldown', mensagem, liberadoEm}).
5. Listar componentes a criar vs reusar + estimativa.

Fatia 3 já entregou backend 100% pronto + textos HELP cravados:
- "Magic link empresa": Você está confirmando que [nome] é seu funcionário/
  médico. Ao CONFIRMAR, ele entra no convênio e a energia dele passa a ser
  custeada pela sua empresa. Ao RECUSAR, ele não é incluído. Ex: confirme
  só quem realmente trabalha na sua empresa.

Decisão 23: SEMPRE Fase 1 read-only ANTES de codar.
LIÇÃO D-novo-AS/BN: frontend componente NOVO exige npm run build + pm2
restart cooperebr-frontend. HMR NÃO basta.

CONTEXTO DA SESSÃO ANTERIOR (03/06 — 7 commits d6a4a50..c432cb8):

- d6a4a50 Fatia 2a: ConviteConvenioMembro per-recipient (model novo 20
  cols + 4 endpoints admin + 1 público GET valida token + envio WA +
  feature flag CONVITE_OTP_ATIVO bloqueia caminho legado).
- 29e01c0 Fatia 2b: OTP 6 dígitos sha256+salt rotativo + timingSafeEqual.
  Política: TTL 10min + max 5 tentativas (bloqueio 1h) + max 3 reenvios
  (cooldown 60s). 2 endpoints @Public solicitar-otp + validar-otp.
- 4c3ee0a Fatia 2c: /auto-inscrever refatorado pra exigir token+otp
  validado (30min). Tenant resolvido do convite (anti-spoof). Consume-once.
- e4c7348 Fatia 2c.1 HARDENING: tudo em $transaction Serializable única
  — Cooperado + Membro + magic link + consume-once atômicos. Removido
  rollbackConviteUsedAt + cooperado.delete .catch.
- 7b14287 chore higiene build: tsconfig + .gitignore ignoram tmp_/*smoke*.
- c432cb8 Fatia 3: aprovação 3 portas. Schema +3 campos audit
  (documentacaoSolicitadaEm + aprovado/rejeitadoPorAdminUserId rel
  Usuario). ConvenioAprovacaoService 550+ linhas + 7 endpoints (5 admin
  + 2 @Public). State machine 4 estados (PENDENTE_APROVACAO_EMPRESA →
  PENDENTE_APROVACAO_ADMIN → MEMBRO_ATIVO; REJEITADO_*/DESLIGADO
  terminais). GUARD strict: admin NÃO PULA empresa.

187/187 specs convenios verdes (85 novos no sprint). 5 smokes vivos
rodados (3 com WhatsApp REAL pro Luciano 5527981341348).

ENTREGAS PRONTAS PRA SMOKE COMPLETO (carry-overs Luciano):
- CV-2026-0001 Caso 1 custeio (modo PERCENTUAL R$ 126.289,60 ou
  VALOR_FIXO R$ 160.000,00).
- Fluxo convite-convênio backend ponta-a-ponta (sem UI ainda).

CONSTRAINTS APLICÁVEIS:
- Decisão 23: Fase 1 read-only OBRIGATÓRIA antes de tocar código.
- Decisão 24: frase de retomada local único (esta seção).
- Multi-tenant em toda query Prisma; @TenantResource + @AuditLog em
  handlers admin.
- isAmbienteReal() em endpoints dev (NUNCA NODE_ENV).
- Regra contatos teste: 27981341348 + lucbragatto@gmail.com.
- Math.round(x*100)/100 em todo valor monetário.
- Schema aditivo sem --accept-data-loss; ritual PM2.
- Transações Prisma Serializable em operações multi-modelo críticas.
- ⚠️ Lição D-novo-AS/BN: frontend componente NOVO = npm run build + pm2
  restart cooperebr-frontend (HMR NÃO basta).
- ⚠️ LIÇÃO BUILD-POISON: tmp_*.ts/smoke*.ts já estão excluídos (chore
  7b14287). Não criar mais no root. Use scripts/ se for smoke ad-hoc.
- ⚠️ LIÇÃO @Throttle: spec integrado HTTP bate rate-limit entre runs
  jest. Usar smoke ts-node single-run em vez disso.
- Regra HELP 19/05: TODA tela nova exibe help inline contextual.
- Selects NATIVOS em Dialog/wizard (não Shadcn select que tem z-index issue).

PRE-REQUISITOS LEITURA (ordem fixa):
1. docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo)
2. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md
3. docs/sessoes/2026-06-03-sprint-convite-convenio-nucleo-backend.md
   (contexto pleno desta sprint — 6 fatias)
4. backend/src/convenios/convites-convenio.service.ts (Fatia 2a+2b)
5. backend/src/convenios/convenios-aprovacao.service.ts (Fatia 3)
6. backend/src/publico/publico.controller.ts (6 endpoints @Public)
7. web/app/cadastro/page.tsx (padrão wizard cadastro público
   referência pra /convite/[token])
8. web/components/convenios/ConvenioCusteioBloco.tsx (padrão HelpBox +
   banner feedback)
9. web/lib/api.ts (axios instance pra chamadas backend)
10. CLAUDE.md + .claude/CLAUDE.md (regras)
11. git log --oneline -15

CARRY-OVERS (não-bloqueantes):
- Smoke E2E real CV-2026-0001 (Luciano manual)
- Fatia 5 dashboard admin (lista membros pendentes + botões)
- Fatia 6 notificações ricas (WA + email + templates)
- Fatia 7 portal UX custeado (D-novo-PORTAL-CUSTEADO P2)
- Fatia 8 specs amplos + smoke E2E final
- Fatia 9 futura: portal self-service da empresa
- D-novo-CONVITE-F3-CRON-LIMPEZA-PENDENTE P2 (cron expirar pendentes)
- D-novo-AGENTS-ORPHAN P3 (pasta src/agents)
- D-novo-UX-Dialog-Backdrop P3
- D-novo-CT-TARIFA-ALOCACAO P3
- D-novo-CT-PDF-AUXILIAR P2
- D-novo-CT-VALIDACAO-FISCAL P0 (gate fiscal interno)
- D-novo-CT-MULTI-REGIME-CLASSIFICACAO P1 (bloqueia Sinergia)
- D-novo-BM P0 BLOQUEADOR REMOÇÃO PRÉ-PROD
- D-novo-BP P3 convergência /parceiro vs /dashboard
- 256 legados allowlist lint:tenant
- Convenção MENSAL Mini-Bloco H'.9

FRENTES OPERACIONAIS LUCIANO:
⏳ PRIORITARIO: Sessão de Validação Fiscal Interna (gate produção contábil)
⏳ Smoke E2E real CV-2026-0001 Caso 1 custeio
⏳ Preencher cooperebr1 (gatilho F.4 smoke produção)
⏳ Cadastrar Usuario E-Solares real
⏳ Decisões regulatórias Sub-Sprint A (advogado) + STF Tema 536 (advogado)
⏳ Provisionamento Usuario PJ pra Fatia 9 (portal empresa)

DOC-SESSAO 03/06:
docs/sessoes/2026-06-03-sprint-convite-convenio-nucleo-backend.md
```

---

### Frase Fatia 2 Sprint Convite-Convênio (anterior, arquivada — substituída pela Fatia 4 acima)

```
[FRASE FATIA 2 — substituída pela Fatia 4 frontend. Histórica.]

RODAR FATIA 2 DO SPRINT CONVITE-CONVÊNIO — BACKEND ADMISSÃO PÚBLICA.

Implementar:
- Endpoint `POST /publico/convenios/auto-inscrever` `@Public()` que recebe
  cooperativaId + convenioId + dados cooperado (CPF/nome/email/telefone) e
  cria Cooperado + ConvenioCooperado com `origem=CONVITE_PUBLICO` +
  `status=PENDENTE_APROVACAO_EMPRESA` + `ativo=false` + cria
  AprovacaoConvenioMembro (magic link `crypto.randomBytes(32).hex` TTL 7d)
  na MESMA transação Serializable.
- Param `origem: AdmissionOrigem` em `ConveniosMembrosService.adicionarMembro`
  (default ADMIN_MANUAL preserva caminhos legados; CONVITE_PUBLICO força
  status=PENDENTE_APROVACAO_EMPRESA + ativo=false). Quando `tx` passado E
  origem=CONVITE_PUBLICO, NÃO disparar side effects MLM nem recálculo faixa.
- Dedup CPF por convênio: ANTES do create, verificar
  `convenioCooperado.findFirst({where: {convenioId, cooperado: {cpf},
  status: {in: [MEMBRO_ATIVO, PENDENTE_APROVACAO_EMPRESA,
  PENDENTE_APROVACAO_ADMIN]}}})`. Se achar, BadRequestException amigável
  ("Este CPF já está em processo de cadastro neste convênio").
- Quota check: ANTES do create, validar `count(membros ativos+pendentes) <
  limiteMembros` (se limite definido) E `soma kwhAlocado consolidadas vivas +
  alocação prevista deste novo membro <= kwhAlocadoMaxMensal` (se quota
  energética definida). Se estourar, BadRequestException com explicação.
- Rate-limit: 3 auto-inscrições/hora por CPF + 30-60 por IP (configurar via
  helper rate-limit do projeto — verificar se já existe pattern, senão usar
  `@nestjs/throttler` consistente com outros endpoints públicos).

Fase 1 + 12 decisões já travadas (ver ## ONDE PARAMOS topo + memória +
doc-sessão). Schema da Fatia 1 já aplicado (commit 12bff1e):
StatusMembroConvenio +4 + AdmissionOrigem + 6 campos ConvenioCooperado +
2 quotas ContratoConvenio + tabela AprovacaoConvenioMembro.

Decisão 23: SEMPRE Fase 1 read-only ANTES de tocar código:
1. Verificar se já existe pattern de rate-limit no projeto.
2. Verificar como dedup CPF funciona em outros pontos (cooperados.service).
3. Verificar quota de outros módulos (modelo conceitual reutilizável?).
4. Identificar todas as chamadas atuais de `adicionarMembro` pra confirmar
   que adicionar param `origem` (default ADMIN_MANUAL) NÃO quebra ninguém.
5. Reportar achados + propor escopo + AGUARDAR OK antes de codar.

ENTREGA ESPERADA FATIA 2: backend admite cadastro público em estado
PENDENTE_APROVACAO_EMPRESA + magic link gerado + zero quebra em
adicionarMembro legado. Specs Jest verdes (Fatia 8 fará o smoke E2E).

CONTEXTO DA SESSÃO ANTERIOR (02/06 noite tarde — 7 commits cfb4208..12bff1e):
- cfb4208 Ponto 1: modo teste no wizard cadastro + preserva vínculo
  convênio sem UC.
- 3665099 Ponto 2a: tarifa fixa R$/kWh empresa (enum TipoTarifaEmpresa).
- 37fa529 3 débitos novos pós-investigação 6 sub-agentes (SEC-AUTOINSCRICAO
  P1 + PORTAL-CUSTEADO P2 + CONVITE-CONVENIO P1 reframe).
- HOTFIX build (consolidado em 12bff1e): src/agents untracked com 15 erros
  TS quebrava build há 3 dias → tsconfig.build.json exclude `src/agents/**`.
  LIÇÃO: "build passou" mentia, SEMPRE verificar dist.
- 2666412 D-FISCAL-2.5: lente fiscal read-only no mesmo URL + deprecation
  ConveniosCtController + delete Convenio CT órfão.
- 13eb1d7 D-FISCAL-2.6: linha 46 relatório conformidade — Hangar removido.
- 12bff1e Fatia 1 schema delta: enum +4 valores + AdmissionOrigem + 6
  campos ConvenioCooperado + 2 quotas ContratoConvenio + tabela nova
  AprovacaoConvenioMembro. Aditivo zero perda. 3 convênios + 215 membros
  intactos. Build limpo zero erros tsc após exclude src/agents.

ENTREGA PRONTA PRA SMOKE REAL (carry-over Luciano):
CV-2026-0001 "Clinica teste" (id cmpwof5h6000avaf8547cj3pb):
- pagador=EMPRESA · pagadorCooperadoId=cmpwnuid50006vaf8th51y2s7
- baseCobrancaCusteio=ALOCACAO_FIXA · kwhAlocadoMensal=200000
- 2 modos disponíveis pós-Ponto 2a: descontoKwhCusteio=20% (PERCENTUAL,
  R$ 126.289,60) OU tarifaFixaKwhEmpresa=0.80 (VALOR_FIXO, R$ 160.000,00)
- Tela: /dashboard/convenios/cmpwof5h6000avaf8547cj3pb/cobrancas-consolidadas

IDEIA REGISTRADA (Luciano 02/06 noite — Fatia 9 futura):
Portal self-service da empresa conveniada — empresa gera+envia convite
via WA/email + aprova pendentes na própria tela. Vira perna "portal login"
do híbrido. Depende de provisionar Usuario perfil COOPERADO pra pagador
da empresa. Recomendação: WA+email primeiro, Telegram (net-new) avaliar.

CONSTRAINTS APLICÁVEIS:
- Decisão 23: Fase 1 read-only OBRIGATÓRIA antes de tocar código.
- Decisão 24: frase de retomada local único (esta seção).
- @TenantResource + @AuditLog em handlers novos de mutação.
- @AsPlatform() em cron/listener novos.
- Multi-tenant: TODA query Prisma filtra por cooperativaId (publico endpoint
  recebe cooperativaId via body/query, valida).
- isAmbienteReal() em endpoints dev (NUNCA NODE_ENV).
- Regra contatos teste: 27981341348 + lucbragatto@gmail.com.
- Math.round(x*100)/100 em todo valor monetário.
- Schema aditivo sem --accept-data-loss; ritual PM2 nas migrations
  (stop → port livre → db push → start).
- Transações Prisma Serializable em operações multi-modelo (auto-inscrever
  cria Cooperado + ConvenioCooperado + AprovacaoConvenioMembro juntos).
- ⚠️ Lição D-novo-AS/BN: frontend componente NOVO exige npm run build +
  pm2 restart cooperebr-frontend (HMR NÃO basta).
- ⚠️ LIÇÃO HOTFIX 02/06 noite tarde: "build passou" mentia — sempre
  verificar dist via grep no .js compilado após npm run build.
- Padrão ConviteProprietarioService M31 (backend/src/proprietario/
  convite-proprietario.service.ts) = template canônico magic link
  (crypto.randomBytes 64 hex + TTL 7d + idempotência reuso + endpoints
  @Public).

PRE-REQUISITOS LEITURA (ordem fixa):
1. docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo)
2. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md
3. docs/sessoes/2026-06-02-convenio-medico-finalizacao-e-convite-fase1.md
   (contexto pleno desta sessão maratona — 7 commits)
4. docs/sessoes/2026-06-02-dfiscal-244-caso1-completo.md (M20 anterior)
5. docs/debitos-tecnicos.md — header atualizado + 3 débitos novos P1/P1/P2
   + Fatia 1 schema delta
6. backend/prisma/schema.prisma:313-340 (enum + AdmissionOrigem) :1404-1411
   (quota) :1439-1510 (ConvenioCooperado + AprovacaoConvenioMembro)
7. backend/src/proprietario/convite-proprietario.service.ts — template
   padrão a reusar
8. backend/src/convenios/convenios-membros.service.ts — onde injetar param
   origem + dedup + quota
9. backend/src/publico/publico.controller.ts:457 — caminho convenioCusteioId
   no cadastroWebV2 (vai precisar do irmão /auto-inscrever)
10. backend/src/cooperados/cooperados.service.ts — método create + dedup
    CPF padrão existente
11. CLAUDE.md + .claude/CLAUDE.md (regras)
12. git log --oneline -20

CARRY-OVERS (não-bloqueantes):
- Smoke E2E real CV-2026-0001 (Luciano manual).
- D-novo-AGENTS-ORPHAN P3 (pasta src/agents agora EXCLUÍDA do build —
  decidir deletar/consertar/.gitignore em housekeeping futuro).
- D-novo-UX-Dialog-Backdrop P3.
- D-novo-CT-TARIFA-ALOCACAO P3.
- D-novo-CT-PDF-AUXILIAR P2.
- D-novo-CT-VALIDACAO-FISCAL P0 (gate fiscal interno).
- D-novo-CT-MULTI-REGIME-CLASSIFICACAO P1 (bloqueia Sinergia).
- D-novo-BM P0 BLOQUEADOR REMOÇÃO PRÉ-PROD.
- D-novo-BP P3 convergência /parceiro vs /dashboard.
- 43+ untracked scripts/relatórios — Sprint Housekeeping futuro.
- 256 legados allowlist lint:tenant — esvaziar incrementalmente.
- Convenção MENSAL (Mini-Bloco H'.9 17/05) ainda não aplicada — 2 usinas
  em ANUAL.
- IDEIA Fatia 9 (portal self-service da empresa) — registrada.

FRENTES OPERACIONAIS LUCIANO (acumulado):
⏳ PRIORITARIO: Sessão de Validação Fiscal Interna (gate produção
   contábil) — alíquotas + presunção + flag isencao PIS/COFINS + classif
   repasse + 10 contas seed + 10 lançamentos amostrais
⏳ Smoke E2E real CV-2026-0001 Caso 1 custeio
⏳ Preencher cooperebr1 (gatilho F.4 smoke produção)
⏳ Cadastrar Usuario E-Solares real
⏳ Revisar relatório auditoria classe GD
⏳ Definir matriz responsabilidadeDespesas
⏳ Definir valorKwhPadrao OU TarifaConcessionaria EDP_ES
⏳ Obter credenciais Sungrow/iSolar Cloud
⏳ Obter script.sql do hb06a (libera Sub-Sprint B ETL)
⏳ Obter .pfx sandbox Banestes
⏳ Decisões regulatórias Sub-Sprint A (advogado) + STF Tema 536 (advogado)
⏳ AVALIAR Fatia 9 portal self-service empresa (decidir provisionamento
   Usuario PJ empresa pagadora)

DOC-SESSAO 02/06 noite tarde:
docs/sessoes/2026-06-02-convenio-medico-finalizacao-e-convite-fase1.md
```

---

### Frase Sprint Caso 1 D-FISCAL-2.4 (anterior, arquivada — substituída pela Fatia 2 Convite-Convênio acima)

```
[FRASE SPRINT D-FISCAL-2.4 — substituída acima pelo arranque da Fatia 2
do Sprint Convite-Convênio. Conteúdo histórico preservado abaixo apenas
pra rastreabilidade de retomada — NÃO COLAR no Code.]

CASO 1 CUSTEIO BACKEND+UI = 100% COMPLETO. 3 CAMINHOS VÁLIDOS — Luciano
escolhe ANTES de Code arrancar:

OPÇÃO 1 — Smoke E2E real CV-2026-0001 "Clinica teste" (RECOMENDADO ~10min):
Luciano abre /dashboard/convenios/cmpwof5h6000avaf8547cj3pb/cobrancas-consolidadas
→ clica "Gerar agora" → seleciona maio/2026 → confirma:
  • Banner verde "Cobrança gerada — R$ 126.289,60 (líquido) · id=X"
  • Cobrança aparece na tabela com status A_VENCER + valor correto
  • R$ 126.289,60 = 200000 kWh × R$ 0.78931 × (1 - 0.20) [ALOCACAO_FIXA + 20% desc]
Se OK: fé total na entrega — partir pra Opção 2 ou 3. Se falhar: bug
operacional inesperado pra investigar.

OPÇÃO 2 — D-FISCAL-2.5 (aposentar /dashboard/contabilidade/convenios +
migrar 1 Convenio CT existente → ContratoConvenio consolidado).

OPÇÃO 3 — D-FISCAL-2.6 (corrigir relatório
docs/relatorios/2026-05-31-conformidade-contabil-multi-regime.md
removendo exemplo Hangar errado — relatório cita Hangar como Auxiliar
Art. 88 mas Hangar é MLM/captação, deveria ser Art. 86).

Recomendação: começar por (1) pra fechar fé na entrega, depois (2) ou (3).

CONTEXTO DA SESSÃO ANTERIOR (02/06 noite — 8 commits 80d3e75..14d0948):
- 2.4.4a (80d3e75) motor ConveniosCusteioService + UC sintética CONSOLIDADOR-*
  + plano "Consolidador de Custeio" (custeadoPorConvenio=FALSE crítico) +
  common/tarifa-helper.ts. Ciclo de módulos resolvido chamando prisma direto.
- 2.4.4a.1 (74858bb) UCs reais do pagador no total + dedup Map<ucId>.
- 2.4.4a.2 (f593917) INVARIANTE custeado⟺consolidado via filtro
  contrato.plano.custeadoPorConvenio=true. Garantia matemática ZERO double-bill.
- 2.4.4b (b2e0cad) cron @AsPlatform() mês FECHADO + GET listar + POST gerar
  manual + emissão gateway com guard isAmbienteReal() (em dev PULA total).
- 2.4.4c (3fa9a34) hook darBaixa roteia consolidada paga pra
  criarLancamentoConvenioContrato (natureza AUXILIAR/PRÓPRIO configurável)
  em vez do CT.3 default (COBRANCA→PRÓPRIO). SUBSTITUI sem duplicar.
- 2.4.4d (9a201cb) tela /dashboard/convenios/[id]/cobrancas-consolidadas
  + Dialog estornar + HelpBox + estornarCobrancaConsolidada com gate
  apuração FECHADA.
- 2.4.4e (a135934) DTO Create/Update aceita 5 campos custeio + helper
  validarBlocoCusteio + ConvenioCusteioBloco.tsx (select pagador + EMPRESA
  revela campos). Reusado em /novo + /editar.
- 2.4.4f (14d0948) ALOCACAO_FIXA gera sem membros (early-return movido
  pro branch CONSUMO_REAL) + 3 banners feedback claro (CRIADA verde / 
  JA_EXISTE azul / SEM_MEMBROS amber). Dialog mantém-se aberto em info.

200/200 specs verde · lint:tenant 0 novos · zero regressão · backend
rebuild + restart PM2 OK · frontend npm run build + pm2 restart
cooperebr-frontend (lição BN: HMR NÃO basta pra componente novo —
reaplicada na 2.4.4e e corrigida em sub-fatia separada).

DESCOBERTAS ARQUITETURAIS DA SESSÃO:
- Ciclo de módulos NestJS Convenios→Cobrancas→Whatsapp→MotorProposta→Convenios
  NÃO resolve com forwardRef em ambos os lados. Solução: quebrar a dep e
  chamar prisma direto.
- isAmbienteReal() PULA emissão real em dev — fail-safe sem mexer em dados
  do Cooperado (regra contatos teste 14/05 sem invasão).
- Invariante custeado⟺consolidado é o ÚNICO caminho que garante zero
  double-bill matematicamente.
- ALOCACAO_FIXA NÃO depende de membros (decisão produto 02/06) — pacote
  fixo é a fonte; convênio "pré-pago" funciona sem ninguém vinculado.

ENTREGA PRONTA PRA SMOKE REAL:
CV-2026-0001 "Clinica teste" (id cmpwof5h6000avaf8547cj3pb):
- status=ATIVO · pagador=EMPRESA · pagadorCooperadoId=cmpwnuid50006vaf8th51y2s7
- baseCobrancaCusteio=ALOCACAO_FIXA · kwhAlocadoMensal=200000 · descontoKwhCusteio=20%
- contratoConsolidadorId=cmpwolcbf000evaf83u6hy1b8 (CONS-547CJ3PB) ✓
- naturezaAtoCooperativo=AUXILIAR · geraLancamentoContabil=true ✓
- Plano "Consolidador de Custeio" global criado e configurado ✓
- Tarifa EDP-ES disponível ✓
- 0 membros (não precisa — ALOCACAO_FIXA gera sozinho após 2.4.4f)

CONSTRAINTS APLICÁVEIS:
- Decisão 23: Fase 1 read-only OBRIGATÓRIA antes de tocar código (foi
  aplicada 8 vezes na sessão 02/06 — manter disciplina).
- @TenantResource em todo handler novo de mutação (lint força)
- @AsPlatform() em todo cron/listener novo
- Multi-tenant: TODA query Prisma filtra por cooperativaId
- isAmbienteReal() em endpoints dev (NUNCA NODE_ENV)
- Regra contatos teste: 27981341348 + lucbragatto@gmail.com
- Decisão 24: frase de retomada local único
- Padrão UX vigente 02/06: Dialog OK pra ação simples; página própria
  SÓ pra cadastro/edição/gestão financeira; HelpBox obrigatório (19/05);
  selects NATIVOS dentro de Dialog/wizard (19/05)
- Math.round(x*100)/100 em todo valor monetário
- Schema aditivo sem --accept-data-loss; ritual PM2 nas migrations
- Transações Prisma Serializable pra operações multi-modelo críticas
- ⚠️ Lição D-novo-AS/BN: frontend componente NOVO exige npm run build
  + pm2 restart cooperebr-frontend (HMR NÃO basta — confirmado 2× na
  sessão 02/06)
- Ciclo de módulos: quebrar dep em vez de forçar forwardRef

PRE-REQUISITOS LEITURA (ordem fixa):
1. docs/CONTROLE-EXECUCAO.md (este arquivo, ## ONDE PARAMOS topo)
2. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md
3. docs/sessoes/2026-06-02-dfiscal-244-caso1-completo.md (contexto pleno
   desta sessão maratona)
4. docs/sessoes/2026-06-01-dfiscal-242-243-custeio-convenio.md (sessão
   anterior — M19 2.4.2 + 2.4.3)
5. docs/debitos-tecnicos.md — D-FISCAL-2 (Caso 1 RESOLVIDO; Caso 2 MLM
   legado ainda), D-FISCAL-1, D-FISCAL-MLM (relatório 31/05 errado —
   alvo da Opção 3), D-novo-UX-Dialog-Backdrop (P3 catalogado 02/06),
   D-novo-CT-TARIFA-ALOCACAO (P3 catalogado 02/06)
6. backend/src/convenios/convenios-custeio.service.ts (serviço completo
   da sprint — gerar, listar, cron, emitir gateway, estornar, lazy create
   contratoConsolidador)
7. backend/src/cobrancas/cobrancas.service.ts:443-606 (darBaixa com
   roteamento 2.4.4c)
8. backend/src/convenios/convenios.controller.ts:285-380 (3 endpoints
   novos: GET listar + POST gerar + POST estornar)
9. backend/src/convenios/convenios.job.ts:38-72 (cron gerarConsolidadasMensalCusteio)
10. web/app/dashboard/convenios/[id]/cobrancas-consolidadas/page.tsx (UI
    com Dialog Gerar + Estornar + HelpBox + 3 banners feedback)
11. web/components/convenios/ConvenioCusteioBloco.tsx (config no form)
12. backend/scripts/dfiscal244-diag-cv-2026-0001.ts (script de diag —
    template pra qualquer convênio EMPRESA novo)
13. CLAUDE.md + .claude/CLAUDE.md (regras)
14. git log --oneline -20

CARRY-OVERS (não-bloqueantes):
- 15 erros TS pré-existentes em backend/src/agents/* (P3 — dist/ é gerado,
  runtime OK)
- Convenção MENSAL (Mini-Bloco H'.9 17/05) ainda não aplicada — 2 usinas
  em ANUAL
- D-novo-UX-Dialog-Backdrop P3 (backdrop-blur do Dialog faz taskbar
  Windows piscar — fix trivial)
- D-novo-CT-TARIFA-ALOCACAO P3 (distribuidora null em ALOCACAO_FIXA
  sem membros cai no fallback — acerta hoje com EDP-ES único)
- D-novo-CT-PDF-AUXILIAR P2 — PDFs ignoram Auxiliar
- D-novo-CT-VALIDACAO-FISCAL P0 — pendente validação interna alíquotas
  (bloqueia produção fiscal real, NÃO bloqueia 2.5/2.6 dev)
- D-novo-CT-MULTI-REGIME-CLASSIFICACAO P1 (bloqueia Sinergia)
- D-novo-BM (P0 BLOQUEADOR REMOÇÃO PRÉ-PROD — painel credenciais teste)
- D-novo-BP (P3 convergência /parceiro vs /dashboard)
- 43+ untracked scripts/relatorios — Sprint Housekeeping futuro
- 256 legados allowlist lint:tenant — esvaziar incrementalmente

FRENTES OPERACIONAIS LUCIANO (acumulado):
⏳ PRIORITARIO: Sessão de Validação Fiscal Interna (gate produção
   contábil) — alíquotas + presunção + flag isencao PIS/COFINS + classif
   repasse + 10 contas seed + 10 lançamentos amostrais
⏳ Preencher cooperebr1 (gatilho F.4 smoke produção)
⏳ Cadastrar Usuario E-Solares real
⏳ Revisar relatório auditoria classe GD
⏳ Definir matriz responsabilidadeDespesas
⏳ Definir valorKwhPadrao OU TarifaConcessionaria EDP_ES
⏳ Obter credenciais Sungrow/iSolar Cloud
⏳ Obter script.sql do hb06a (libera Sub-Sprint B ETL)
⏳ Obter .pfx sandbox Banestes
⏳ Decisões regulatórias Sub-Sprint A (advogado) + STF Tema 536 (advogado)

DOC-SESSAO 01/06:
docs/sessoes/2026-06-01-contabilidade-convenios.md
```

---

### Frase Sprint Blindagem F0 (anterior, arquivada)

```
[FRASE SPRINT BR F0 — substituída acima pelo Sprint Blindagem COMPLETO 31/05]

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

---

## MÓDULO IAG (Agents) — Prioridade E (Cobrança)

**Status atual (01/06/2026):**

- Prioridades A (Sentinela) e B (Repasses/Despesas) concluídas.
- **Prioridade E ativa** — Auditoria de inconsistências de cobrança/faturamento.

**Ferramentas implementadas:**
- Tool L0: `cobranca.auditarInconsistenciasCobranca` (3 tipos: PAGAMENTO_PARCIAL, MODELO_DIVERGENTE, DIVERGENCIA_VALOR_FATURA)
- Tool L1: `cobranca.simularComparativoModelos` (simulação dos **3 modelos**: FIXO_MENSAL + CREDITOS_COMPENSADOS + CREDITOS_DINAMICO)

**Testes:** 7/7 verdes na CobrancaService.

**Próximos passos E:**
- Expandir cobertura L0
- Refinar lógica de simulação L1 com dados reais de FaturaProcessada
- Atualizar documentação e CONTROLE-EXECUCAO

Módulo segue padrão PolicyEngine L0-L4, ToolRegistry tipado e TDD.
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
