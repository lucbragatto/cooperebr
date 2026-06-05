# Hardening Golden Path /cadastro?conv= e ?ref= — 05/06/2026

## TL;DR

Sessão dedicada a destravar o golden path de onboarding via convite após smoke manual do Luciano expor 4 bugs P1 encadeados. **Resiliência do OCR** (retry exponencial + timeout + `max_tokens` 8192 + classificação categorizada em 7 motivos + UI com banner amber "tentar de novo" pros recuperáveis). **`/cadastro-web` resolve `cooperativaId` server-side via `body.token`** (espelha padrão anti-spoof de `/auto-inscrever:568`). **Membro do convênio criado dentro do mesmo `$transaction Serializable`** que cria Cooperado+UC, com consume-once race-safe + magic link da empresa + cross-ref convite→membro (porta o padrão de `/auto-inscrever:710-792` pro `cadastroWebV2`, fechando bug arquitetural exposto pelo smoke). **44 specs verdes** (30 OCR + 14 cadastro-web). **Smoke E2E programático** dos 2 caminhos `?conv=` e `?ref=` = 0 falhas (12 passos). Convite WhatsApp do Luciano destravado via script efêmero de reset OTP. Lição operacional: `Promise<void>` silencioso em integrações externas é anti-pattern — sempre `Result` explícito categorizado.

## Marco entregue

**M23 — Hardening Golden Path `?conv=` / `?ref=`**

## Commits do dia (5 trabalho + 1 fechamento)

| Hash | Mensagem |
|---|---|
| `9291d32` | fix(whatsapp+convite): whitelist +27999479097 + status honesto do envio (D-novo-WA-DEV-FALSE-OK) |
| `8ab10c8` | docs(sessao): fechamento M22 — Fatia F-G1 Circuito CooperToken + Opção A + WA honesto |
| `4c05aea` | fix(ocr): resiliência OCR Anthropic (D-novo-OCR-RESILIENCIA P1) |
| `004372c` | fix(cadastro-web): resolve cooperativaId via convite quando vem ?conv= (D-novo-CADWEB-CONV-TENANT P1) |
| `beef066` | fix(cadastro-web): porta criação de Membro+consume-once pro mesmo tx (D-novo-CADWEB-CONV-MEMBRO P1) |
| _(este)_ | docs(sessao): fechamento M23 |

## Entregas técnicas

### Backend — OCR resiliência (`4c05aea`)

**`backend/src/faturas/faturas.service.ts`** (+ ~200 linhas):
- `OcrFalhaMotivo` type union com 7 categorias: `anthropic-overload` (HTTP 529) · `anthropic-rate-limit` (429) · `anthropic-server` (500/503) · `response-truncated` (stop_reason=max_tokens) · `response-invalid-json` · `timeout` (AbortController 30s) · `unknown`.
- Classe `OcrFalhaError extends Error` com `motivo` + `requestId` + `status` + `tamanhoBase64`.
- Helper privado `chamarAnthropicComRetry(body, tamanhoBase64)` — retry exponencial em 429/500/503/529 com delays 2s/4s/8s (3 retries, 4 tentativas total). Demais status (4xx exceto 429) = terminais sem retry.
- `AbortController` com `OCR_TIMEOUT_MS = 30_000` — fail-fast em latência alta.
- `OCR_MAX_TOKENS = 8192` (antes 2048 — apertado pra fatura com `historicoConsumo` 12-13 meses + 30+ campos).
- Detecção de `stop_reason === 'max_tokens'` ANTES do `JSON.parse` → motivo correto (`response-truncated`).
- Extração de `request_id` do header `request-id`/`x-request-id` ou do body JSON.
- Helpers `classificarStatusAnthropic` + `extrairRequestIdDoBody` + `sleep`.
- Telemetria estruturada: cada log warn/log inclui `status` + `request_id` + `tamanhoBase64` + `tentativa`.

**`backend/src/publico/publico.controller.ts`** — handler `processar-fatura-ocr`:
- Import `OcrFalhaError` + `OcrFalhaMotivo`.
- Novo helper privado `respostaOcrFalha(err)` + `mensagemPorMotivo(motivo)` — payload categorizado:
  - Recuperáveis (overload/rate-limit/server/timeout): "Serviço ocupado, tente de novo em ~30s" (variante por motivo).
  - Terminais (truncated/invalid-json/unknown): "Preenche manualmente."
- Payload retorna `{ sucesso, mensagem, motivo, dados }`.

**Frontend** (`web/app/cadastro/page.tsx`):
- State `ocrMotivoRecuperavel`.
- Inspeciona `data.motivo`: recuperáveis NÃO caem em modo manual — mostra banner amber + "Tentar enviar de novo".
- Terminais → modo manual como antes.

### Backend — `cadastro-web` resolve tenant via token (`004372c`)

**`backend/src/publico/publico.controller.ts`** (linhas 215-247):
- Antes do gate `if (!cooperativaId)`, deriva via `prisma.conviteConvenioMembro.findUnique({where:{token}})` quando `body.token` presente.
- Token resolve → `cooperativaId = convite.cooperativaId` (sobrepõe `body.cooperativaId` por anti-spoof).
- Token presente mas não resolve → `BadRequestException('Convite inválido ou expirado.')` — mensagem específica em vez do genérico.
- Espelha o padrão consolidado de `/auto-inscrever:568` ("Resolve convenio + cooperativa DO CONVITE — NÃO do body").

### Backend — `cadastroWebV2` cria Membro dentro do mesmo tx (`beef066`)

**`backend/src/publico/publico.controller.ts`** — `$transaction Serializable` ampliada:
- **(0)** Resolve + consume-once do convite ANTES de criar Cooperado quando `body.token + body.origem='CONVITE_PUBLICO'`:
  - `tx.conviteConvenioMembro.findUnique({where:{token}, select:{id, convenioId, usedAt, expiresAt}})`
  - Validação `usedAt` / `expiresAt`.
  - `tx.update({where:{id, usedAt:null}, data:{usedAt:now()}})` — race-safe (P2025 → `ConflictException('Convite já utilizado.')`).
- **(10-11)** Cria Cooperado + UC (já existia).
- **(12)** `conveniosMembros.adicionarMembro(convenioId, cooperadoId, _, tx, 'CONVITE_PUBLICO')` → `ConvenioCooperado` com `status='PENDENTE_APROVACAO_EMPRESA'` + `ativo=false` + `AprovacaoConvenioMembro` (magic link da empresa) no MESMO tx. Pula MLM e recálculo de faixa.
- **(13)** Cross-ref `convite.membroId = membro.id`.
- Isolation: `Prisma.TransactionIsolationLevel.Serializable` — 2 POSTs concorrentes serializam ou um aborta 40001.
- Atomicidade total: zero Cooperado órfão · zero convite consumido sem membro · zero magic link sem cooperado.

### Backend — WhatsApp whitelist + status honesto (`9291d32`)

**`backend/src/whatsapp/whatsapp-sender.service.ts`** (sessão M22, dia anterior):
- `WhatsappEnvioResult` type + `WhatsappEnvioMotivo` (`whitelist-dev` | `numero-protegido` | `erro-runtime`).
- `enviarMensagem` retorna `Promise<WhatsappEnvioResult>` em vez de `Promise<void>` — elimina falso positivo silencioso.
- Whitelist permanente `+5527999479097` (5 variantes E.164/sem DDI/máscara).
- `convite-indicacao.service.ts` + `convite-indicacao.controller.ts` propagam `motivo` no payload pra UI dev.

### Testes

**`backend/src/faturas/faturas.service.ocr-resiliencia.spec.ts`** (NOVO, 30 specs verdes):
- Retorna OK + requestId quando 1ª tentativa OK (header `request-id` + fallback `x-request-id`).
- Retry em 429/500/503/529 (it.each).
- 4 tentativas total + lança final em 529 persistente com motivo `anthropic-overload`.
- Classifica cada status corretamente.
- NÃO faz retry em 400/401/403/404/413/422 (terminais).
- AbortError → retry; persistente → motivo `timeout`.
- Erro de rede → retry; persistente → motivo `unknown`.
- Extrai `request_id` do body JSON quando header ausente.
- `requestId=null` quando body não-JSON.
- `OcrFalhaError` carrega todos os metadados.

**`backend/src/publico/publico.controller.cadastro-web-conv.spec.ts`** (NOVO, 14 specs verdes):
- **6 cenários do fix de tenant** (CADWEB-CONV-TENANT): token válido sem cooperativaId → resolve · token + cooperativaId diferente → anti-spoof · token inválido sem fallback → 400 específico · token inválido + cooperativaId → 400 (não mascara) · sem token e sem cooperativaId/tenant → 400 genérico · sem token com tenant → caminho legado OK.
- **8 cenários do membro+consume-once** (CADWEB-CONV-MEMBRO): sem token → não chama adicionarMembro · convite válido → consume-once + adicionarMembro + cross-ref · convite inexistente → throw antes de criar Cooperado · convite usado → 409 · convite expirado → throw · race P2025 → 409 · adicionarMembro falha → propaga (rollback nativo) · cross-ref usa membroId correto.

### Helpers de smoke (versionados em `backend/scripts/`)

- `smoke-golden-path-conv-ref.ts` — smoke E2E programático dos 2 cenários com cleanup automático. Telefone único por execução (seed+timestamp), CPF determinístico via sha256.
- `smoke-golden-path-discover.ts` — lista pré-requisitos (cooperativa ativa, convênio ATIVO+EMPRESA, indicador com codigoIndicacao).
- `smoke-cleanup-orfaos.ts` — limpa convites smoke (telefone `5511999988*`) e cooperados smoke (email `smoke+*`) deixados por rodadas anteriores.
- `reset-otp-convite-emergencial.ts` — zera ciclo OTP (reenvios/tentativas/validação/bloqueio/código) de um convite, preservando `usedAt` e `expiresAt`. Aceita `<token>` ou `--id <conviteId>`.
- `find-token-emergencial.ts` — diagnóstico procura token em qualquer tabela com campo `token`.

### Docs

- `docs/debitos-tecnicos.md` — header atualizado com lista consolidada do dia 05/06 (4 RESOLVIDOS + 6 ABERTOS). 5 novos débitos catalogados em detalhe.

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| 1 | P1 OCR golden path | API Anthropic retornou HTTP 529 `overloaded_error` (req `req_011Cbkg4RZ9ghXJSoLjtdD1V`); chamada one-shot virava "preencha manualmente" | Retry exponencial 2s/4s/8s em 429/500/503/529 + AbortController 30s + max_tokens 8192 + motivo categorizado | ✅ RESOLVIDO `4c05aea` |
| 2 | P1 golden path `?conv=` | `cadastro-web` só conhecia `body.cooperativaId` e `?tenant=`; ignorava `body.token` que chegava do wizard | Resolve `cooperativaId` server-side via `body.token`, anti-spoof | ✅ RESOLVIDO `004372c` |
| 3 | P1 golden path `?conv=` arquitetural | `cadastroWebV2` criava Cooperado+UC mas NÃO criava `ConvenioCooperado` nem marcava `usedAt`; convite ficava órfão reusável | Porta atomicidade de `/auto-inscrever:710-792` pro `cadastroWebV2`: consume-once + adicionarMembro + cross-ref dentro do mesmo `$transaction Serializable` | ✅ RESOLVIDO `beef066` |
| 4 | P1 dev | WhatsApp `enviarMensagem` retornava `Promise<void>` com `return` silencioso em whitelist/numero-protegido (sessão M22) | `WhatsappEnvioResult` com motivo propagado até UI dev | ✅ RESOLVIDO `9291d32` |
| 5 | P3 UX | OTP estourava limite → UI mostrava erro genérico sem orientação | Catalogado `D-novo-OTP-429-UX` (mensagens específicas por estado + countdown bloqueio + CTA novo convite) | 📋 CATALOGADO |
| 6 | P3 dev | Rate-limit OTP engessa smoke manual em DEV (`otpReenvios=3/3` no convite Luciano) | Catalogado `D-novo-OTP-DEV-RELAX` (3 opções: guard `isAmbienteReal()`, endpoint dev-reset, ou botão admin) + script efêmero de reset emergencial | 📋 CATALOGADO + workaround script |
| 7 | P3 housekeeping | `/publico/convenios/auto-inscrever` provavelmente vira código morto após fix #3 | Catalogado `D-novo-AUTO-INSCREVER-DEPRECATION` (verificar callers + deprecar + remover junto com slim `/convite-convenio`) | 📋 CATALOGADO |

## Achados operacionais

- **`Promise<void>` silencioso em integração externa = anti-pattern** — sempre `Result` explícito categorizado pra evitar falso positivo "sucesso" nos callers.
- **Padrões já estabelecidos no projeto valem reuso integral** — `/auto-inscrever:710-792` (Fatia 2c.1) tinha exatamente o padrão de atomicidade que faltava no `cadastroWebV2`. Refator portou em vez de reinventar.
- **Smoke E2E programático com cleanup automático destrava confiança** — em ~12s o script confirma que 12 invariantes do golden path estão ok, sem precisar de Playwright/browser.
- **`?conv=` link de WhatsApp NÃO carrega `?tenant=`** — qualquer endpoint dependente de tenant precisa derivar do token. Padrão anti-spoof obrigatório.
- **Smoke expôs bug que escapou de specs unitários** — D-novo-CADWEB-CONV-MEMBRO existia desde Convergência Fatia 2 (04/06) e nenhum spec/smoke pegou; só E2E end-to-end revelou que cadastro completava sem virar membro.

## Decisões estratégicas catalogadas

Nenhuma memória persistente nova nesta sessão (todas as decisões já estão em débitos + commit messages + doc-sessão).

## Próximo passo

**Fatia F-G2 do Circuito CooperToken** — super-admin provisiona novo parceiro/cooperativa + cooperados a nível SISGD. Fase 1 read-only obrigatória (mapear `backend/src/cooperativas/`, `auth/perfil.enum.ts`, `web/app/dashboard/super-admin/`, padrão fantasma institucional reusável).

## Pré-requisitos leitura próxima sessão (ordem fixa)

1. `docs/CONTROLE-EXECUCAO.md` (## ONDE PARAMOS topo + ## FRASE DE RETOMADA)
2. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md`
3. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md`
4. `docs/sessoes/2026-06-05-hardening-golden-path-conv-ref.md` (esta)
5. `docs/sessoes/2026-06-05-fatia-fg1-cooper-token-ajustes.md` (sessão anterior)
6. `docs/especificacao-circuito-cooper-token-convenio.md` (spec circuito — Fatias F-G2/C/D/E/G)
7. `backend/src/cooperativas/` (provisionamento tenant atual — Fase 1 F-G2)
8. `backend/src/auth/perfil.enum.ts` + `roles.decorator.ts` (SUPER_ADMIN)
9. `backend/src/convite-indicacao/cooperado-institucional.service.ts` (padrão fantasma — reuso F-G2)
10. `CLAUDE.md` + `.claude/CLAUDE.md`
11. `git log --oneline -25`

## Carry-overs (não-bloqueantes)

- Smoke E2E manual Luciano via celular (golden path F-G1 destravado — convite Clínica teste com token `e1bb49fe...b007b`, OTP zerado, válido até 12/06).
- **6 débitos abertos**: `D-novo-OTP-429-UX` P3 · `D-novo-OTP-DEV-RELAX` P3 · `D-novo-AUTO-INSCREVER-DEPRECATION` P3 · `D-novo-CAD-CONSUMO-MENSAL` P2 · `D-novo-CONVITE-MENUS-UX` P3 · `D-novo-TESTS-MOCK-PRISMA` P2.
- Carry-overs anteriores: `D-novo-PORTAL-EMPRESA-SEED-TESTE` P3 · `D-novo-DEV-LAN-ACCESS` P3 · 7 débitos `/cadastro` sessão 04/06 · `D-novo-CT-VALIDACAO-FISCAL` P0 (gate fiscal) · `D-novo-CT-MULTI-REGIME-CLASSIFICACAO` P1 · `D-novo-BM` P0 BLOQUEADOR REMOÇÃO PRÉ-PROD · 256 legados allowlist `lint:tenant`.
- Slim `/convite-convenio/[token]` + `/publico/convenios/auto-inscrever` candidatos a deprecação (housekeeping futuro).

## Regras aplicadas na sessão

- **Decisão 23** — Fase 1 read-only obrigatória aplicada 3× (diagnóstico OCR, gate `cadastro-web`, bug arquitetural membro). Fix só após mapear estado real.
- **Padrão anti-spoof multi-tenant** — resolver tenant DO CONVITE, não do body (espelha `/auto-inscrever:568`).
- **Atomicidade total via `$transaction Serializable`** — espelha `/auto-inscrever:710-792` (Fatia 2c.1). Zero estado órfão.
- **Regra commit SCOPED** — nenhum `git add .` ou `-A`; arquivos listados explicitamente. 3 commits SCOPED no dia.
- **Regra 18/05 `isAmbienteReal()`** — nenhum uso de `NODE_ENV` direto.
- **Regra 14/05 contatos teste** — telefone `27981341348` whitelisted + `5511999988*` (numero-protegido) no smoke.
- **TDD aplicado** — specs antes de commit (44 specs verdes em 2 suites).
- **Smoke E2E programático versionado** — confiança via reprodução automática, não validação manual.
- **Lição `next start`** — frontend rebuildado + restart obrigatório após mudança em `/cadastro`.
- **Catalogação preventiva** — bugs descobertos sem fix imediato viram débitos (OTP-429-UX, OTP-DEV-RELAX, AUTO-INSCREVER-DEPRECATION) com escopo + estimativa + status.

## Frase comandante

Ver `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único).
