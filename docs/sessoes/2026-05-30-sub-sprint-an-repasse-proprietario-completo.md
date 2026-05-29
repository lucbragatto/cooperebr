# Sub-Sprint D-novo-AN — RepasseProprietario — COMPLETO

> Sessão: **30/05/2026** (consolidada — sessão única Code dia inteiro).
> Marco: **D-novo-AN 100% implementado** — workflow PENDENTE→PAGO/CANCELADO com transação atômica vinculando despesas DESCONTO_NO_REPASSE, integração nativa ao cron BH.5 (par Repasse+ARRENDAMENTO_USINA), telas admin + portal proprietário refatorado, backfill histórico idempotente, notificação proativa "Repasse pago", PDF mensal com status real.
> Continuidade do Sprint D-novo-BH fechado em 29-30/05.

## TL;DR

Sub-Sprint D-novo-AN (RepasseProprietario) entregue 100% em **5 fatias canônicas** numa única sessão Code do dia 30/05 (5 commits `37f7af0..2f6fb29`). Implementa o registro real de pagamento do parceiro pro proprietário da usina — complementando o BH.5 que só registrava a obrigação (ARRENDAMENTO_USINA) sem trackear pagamento real. **AN.1**: schema delta aditivo (model `RepasseProprietario` + 2 enums + `@@unique([usinaId, periodoInicio, periodoFim])` idempotência forte + back-ref `ContaAPagar.repasseAbatido`) + service workflow com transação atômica `marcarPago` que vincula despesas DESCONTO_NO_REPASSE pendentes do período + 19 specs verdes. **AN.2**: controller REST 6 endpoints (`GET /repasses`, `GET /repasses/proprietario`, `GET /repasses/:id`, `PUT marcar-pago`, `PUT cancelar`, `POST upload-comprovante`) + integração nativa cron BH.5 (`prisma.$transaction([createRepasse PENDENTE, createArrendamento APROVADA+RESOLVIDA])`) + resolução Caminho A/B do `proprietarioUsuarioId` + refator endpoint `/proprietario/repasses` consumindo tabela com fallback `PREVISTO_FALLBACK`. **AN.3**: 2 telas admin novas (por usina + global cross-usinas), refator portal proprietário (3 KPIs novos: previsto YTD vs recebido YTD vs pendentes), sidebar Operacional + card cruzado em `/dashboard/usinas/[id]`, dialogs Tipo C (marcar-pago + cancelar) reusando `UploadComprovante` parametrizado. **AN.3.1**: fix painel credenciais (`D-novo-BM`) que voltava pro login em uso real (causa: token impersonate 1h expirado → interceptor global redirect via `useContexto.GET /auth/me`) — fix duplo: TTL 1h→8h + interceptor allowlist self-recovery; trigger manual do cron criando 1 RepasseProprietario PENDENTE pro Luciano testar via UI; investigação read-only `/parceiro` vs `/dashboard` (achado: `/parceiro` é ativo 30 páginas + sidebar já encaminha entidades complexas pra `/dashboard`; recomendação opção b acatada). **AN.4**: backfill idempotente 3 históricos PENDENTE preservando 04/2026 do trigger AN.3.1 + `notificarRepassePago` wireup fire-and-forget em `marcarPago` (email + WA whitelist LGPD com fallback Caminho A/B) + PDF relatório mensal com status real substituindo heurística fake "mês passado = PAGO automático". **36/36 specs Jest verdes** (21 service + 10 controller + 5 notificação). **3 smokes E2E**: 8/8 service AN.1 + 12/12 endpoints AN.2 + smoke HTTP 4 rotas AN.3 + script backfill apply+2ª-execução. **Bug bônus resolvido inline:** `D-novo-BM` painel credenciais funcionalmente quebrado em uso real (AN.3.1). **Padrão UX Dual 17/05** mantido rigorosamente: telas = Tipo B, ações marcar-pago/cancelar = Tipo C, sem violações.

## Marcos entregues

- **AN.1** — Schema + Service workflow
- **AN.2** — Endpoints REST + integração cron BH.5
- **AN.3** — Telas admin + portal refator + sidebar
- **AN.3.1** — Fix painel credenciais + trigger repasse + investigação parceiro
- **AN.4** — Fix cards parceiro + backfill + notificação + PDF

## Commits (5, ordem cronológica)

| # | Hash | Marco | Mensagem |
|---|---|---|---|
| 1 | `37f7af0` | AN.1 | feat(repasses): AN.1 schema + service workflow RepasseProprietario (D-novo-AN) |
| 2 | `2f36470` | AN.2 | feat(repasses): AN.2 endpoints REST + integração cron BH.5 (D-novo-AN) |
| 3 | `a3b351a` | AN.3 | feat(repasses): AN.3 telas admin + portal refator + sidebar (D-novo-AN) |
| 4 | `3a8a90e` | AN.3.1 | fix(dev): AN.3.1 painel credenciais não expulsa pro login + bump TTL 8h |
| 5 | `2f6fb29` | AN.4 | feat(repasses): AN.4 fix cards parceiro + backfill + notificação + PDF (D-novo-AN) |

## Cronologia (sessão única 30/05)

- **Manhã** — Fase 1 read-only mini do AN (Decisão 23): mapeou 7 consumidores `calcularRepasseLiquido`, confirmou `ContaAPagar.repasseAbatidoId` nullable já pronto, banco com 19 GeracaoMensal sem tabela `RepasseProprietario`. Reportou 8 decisões adicionais. Luciano confirmou + escolheu opção (a) cron cria PENDENTE no mesmo trigger.
- **Manhã-tarde** — **AN.1**: schema delta + ritual PM2 + service + 19 specs + smoke 8/8.
- **Tarde** — **AN.2**: controller REST + transação atômica no cron BH.5 + refator endpoint portal + 13 specs adicionais + smoke E2E 12/12. **Lição cache JwtStrategy 60s** documentada (não bug — limitação operacional pra testar guard cross-tenant via HTTP com 2 admins de coops distintas).
- **Tarde-noite** — **AN.3**: 2 telas admin + refator portal + sidebar Operacional + card cruzado usina. **Componentes compartilhados** `web/components/repasses/{types,DialogMarcarPago,DialogCancelar}` + `UploadComprovante` parametrizado (prop `endpoint`).
- **Noite** — smoke visual Luciano detectou que `/dashboard/dev/credenciais-teste` voltava pro login em uso real → **AN.3.1**: diagnóstico `useContexto.GET /auth/me` + interceptor global → fix duplo TTL 8h + allowlist self-recovery + trigger cron manual (1 RepasseProprietario PENDENTE 04/2026 R$ 1.000 pra Luciano testar) + investigação `/parceiro/usinas` (30 páginas /parceiro vivas, recomendação opção b: convergir Usinas pra `/dashboard/usinas`).
- **Noite tardia** — **AN.4**: fix cards parceiro (sidebar href + redirect página) + backfill 3 históricos PENDENTE preservando 04/2026 + notificarRepassePago wireup async + PDF status real + commit fechamento.

## Entregas técnicas

### AN.1 — Schema + Service (`37f7af0`)

**Schema delta aditivo:**
- `enum StatusRepasseProprietario` (PENDENTE/PAGO/CANCELADO)
- `enum MetodoPagamentoRepasse` (PIX/TED/MANUAL/OUTRO)
- `model RepasseProprietario` com 17 campos + 4 relations + `@@unique([usinaId, periodoInicio, periodoFim])` idempotência forte + 4 índices + `@@map("repasses_proprietario")`
- `ContaAPagar`: back-ref relation explícita `@relation("RepasseAbatido")` + índice `repasseAbatidoId`
- Back-refs em `Cooperativa`, `Usina`, `Usuario` (3 nomes explícitos: proprietario/registradoPor/canceladoPor)

**Migration via ritual PM2 (CLAUDE.md):** pm2 stop → porta 3000 livre → `prisma generate` → `prisma db push` (limpo, `Your database is now in sync`) → pm2 restart.

**Service** (`backend/src/repasses-proprietario/`):
- `criarPendente`: idempotente via try/catch P2002 → ConflictException
- `marcarPago`: **transação atômica `$transaction`** = repasseUpdate + contaAPagar.updateMany para vincular despesas + race guard + multi-tenant + cross-field OUTRO + data não-futura
- `cancelar`: race guard (só PENDENTE) + motivo obrigatório
- `listarGlobal` (SA cross-tenant) + `listarPorUsina` + `listarPorProprietario` (Caminho A/B) + `findOne`
- Helper `derivarAtrasado` (runtime, não persiste)

### AN.2 — Endpoints REST + Cron (`2f36470`)

**Controller (6 endpoints):**
- `GET /repasses` (admin/SA global + filtros)
- `GET /repasses/proprietario` (portal — Caminho A/B)
- `GET /repasses/:id` (admin detalhe + tenant guard)
- `PUT /repasses/:id/marcar-pago` (admin transação atômica + @AuditLog)
- `PUT /repasses/:id/cancelar` (admin race guard + @AuditLog)
- `POST /repasses/upload-comprovante` (Multer JPG/PNG/PDF 5MB)

**Integração cron BH.5:**
- Idempotência via `repasseProprietario.findUnique` (unique constraint) + catch P2002 (2 camadas)
- Resolução `proprietarioUsuarioId` Caminho A (Cooperado→Usuario) + fallback Caminho B (Usina.proprietarioEmail)
- `$transaction([createRepasse PENDENTE, createArrendamento APROVADA+RESOLVIDA+ASSUMIDO+PARCEIRO])`
- Logger: "1 par Repasse+Arrendamento criados"

**Refator `/proprietario/repasses`:**
- Lê `RepasseProprietario` real quando existe
- Fallback `'PREVISTO_FALLBACK'` on-the-fly pra meses sem registro
- Tipo `'REAL' | 'PREVISTO_FALLBACK'` no retorno
- 2º loop captura repasses REAIS sem `GeracaoMensal` correspondente

### AN.3 — Telas (`a3b351a`)

**Componentes compartilhados** (`web/components/repasses/`):
- `types.ts` — `Repasse`, enums, STATUS_BADGE, METODOS, helpers `fmt*`
- `DialogMarcarPago.tsx` (Tipo C) — método select nativo + data max=hoje + comprovante upload + observação cross-field
- `DialogCancelar.tsx` (Tipo C) — motivo textarea required

**Telas novas:**
- `/dashboard/usinas/[id]/repasses/page.tsx` (Tipo B) — header + banner help + 3 KPIs (Pendentes/Pagos no mês/Cancelados 30d) + filtros + tabela 9 colunas + ações inline + badge ATRASADO
- `/dashboard/repasses/page.tsx` (Tipo B global) — análogo cross-usinas com coluna Usina + filtros usina+status + 3 KPIs cross (Pendentes/Pagos mês/Atrasados)

**Refatorações:**
- `/proprietario/repasses/page.tsx` — consome tipo REAL/FALLBACK + 3 KPIs novos + colunas Valor pago/Data pgto/Status real + link comprovante
- `dashboard/layout.tsx` — item "Repasses" sidebar Operacional (ícone Wallet)
- `/dashboard/usinas/[id]/page.tsx` — card verde cruzado "Repasses ao proprietário"
- `UploadComprovante.tsx` — prop opcional `endpoint` (default mantém `/contas-pagar/upload-comprovante` BH.3.1)

### AN.3.1 — Fix painel + Trigger + Investigação (`3a8a90e`)

**Bug `D-novo-BM` funcionalmente quebrado em uso real:**
- **Causa raiz:** `useContexto` em `dashboard/layout.tsx` dispara `GET /auth/me` no mount; 401 do token impersonate expirado (1h) atinge interceptor global de `lib/api.ts` ANTES do `.catch()` da página → redirect pra `/login`
- **Fix (A) Backend:** TTL impersonate 1h → 8h (`auth.service.ts` + `auth-dev.controller.ts` + spec atualizada). Mantém gating `isAmbienteReal()=false` + `@Roles(SA)` + `@AuditLog`. Dev-only — TTL irrelevante em PROD.
- **Fix (B) Frontend:** `lib/api.ts` interceptor allowlist — 401 NÃO redireciona em rotas de self-recovery (`/dashboard/dev/credenciais-teste`, `/selecionar-contexto`). Página `credenciais-teste` ganha estado `sessaoExpirada` + UI inline com botões "Ir pra /login" / "Tentar de novo".

**Trigger cron manual:**
- POST `/contas-pagar/cron/repasse-mensal/executar` (SA) → 201 + `criadas=1`
- Repasse `cmprfu9z90001vajcefj2xaiz` PENDENTE — Linhares — período 04/2026 — bruto/líquido R$ 1.000 + ARRENDAMENTO_USINA vinculada
- **Deixado PENDENTE** pro Luciano testar marcar-pago via UI

**Investigação `/parceiro` vs `/dashboard` (read-only):**
- `/parceiro` é **ATIVO** com layout próprio 234 linhas + **30 páginas** funcionais
- Admin parceiro acessa `/parceiro` (confirmado `useContexto:87`)
- `/parceiro/usinas` é **cards display-only** sem detalhe; toda evolução funcional foi pra `/dashboard/usinas/*` (F.5/F.6/F.7/BH/AN)
- Sidebar parceiro JÁ tem inconsistência similar: item "Membros" → `/dashboard/cooperados` (linha 53)
- **Recomendação opção (b)** — trocar href Usinas pra `/dashboard/usinas`. Acatado em AN.4.

### AN.4 — Fix Cards + Backfill + Notificação + PDF (`2f6fb29`)

**Parte 0 — Cards parceiro:**
- `web/app/parceiro/layout.tsx:54` href → `/dashboard/usinas`
- `web/app/parceiro/usinas/page.tsx` vira redirect protegendo bookmarks

**Parte 1 — Backfill (`scripts/backfill-repasses-proprietario.ts`):**
- Dry-run default; `--apply` cria
- Resolve `proprietarioUsuarioId` Caminho A/B (igual cron AN.2)
- Idempotência: `findUnique` preventivo + catch P2002
- **Resultado da execução:** 3 candidatos (02/03/05 2026), 1 SKIP (04/2026 trigger AN.3.1 preservado), apply criou 3, 2ª execução 0 criados/4 SKIP ✅

**Parte 2 — Notificação:**
- `NotificacoesProativasService.notificarRepassePago(repasseId)`
- Resolve destinatário Caminho A (proprietarioUsuario.email) → fallback B (Usina.proprietarioEmail)
- Email "Repasse pago — {usina} ({mm/yyyy})" + WhatsApp curto com link comprovante
- Whitelist LGPD automática em DEV (regra D-novo-N 18/05)
- Wireup fire-and-forget em `RepassesProprietarioService.marcarPago` (.catch loga, não bloqueia HTTP)

**Parte 3 — PDF status real:**
- `relatorio-mensal.service.ts` busca `RepasseProprietario` real do período
- Nova seção "Status do Repasse" 3 estados (PAGO verde / CANCELADO cinza / PENDENTE amarelo / sem registro neutro)
- Footer fake "Valores previstos…" substituído por "Status do repasse reflete o que o admin registrou no SISGD"

## Decisões estratégicas catalogadas

| # | Decisão | Origem | Onde |
|---|---|---|---|
| Cron cria par Repasse+Arrendamento em transação atômica | AN.2 — Decisão Luciano Fase 1 opção (a) | `repasse-mensal.cron.ts` linha 92+ |
| Status 3 valores + `atrasado` derivado runtime | AN.1 — Decisão Luciano Fase 1 | `derivarAtrasado` helper service |
| `@@unique` no banco (não só checagem app) | AN.1 — Decisão Luciano Fase 1 | schema.prisma |
| Notificação async fire-and-forget | AN.4 — alinhado padrão BH.2 | `marcarPago` `.catch` |
| Fix painel TTL 8h + allowlist self-recovery | AN.3.1 — bug usabilidade Luciano | `auth.service.ts` + `lib/api.ts` |
| Cards parceiro Usinas redirect /dashboard | AN.3.1+AN.4 — investigação Luciano | `parceiro/layout.tsx:54` + `page.tsx` |
| Backfill todos PENDENTE (zero PAGO) | AN.4 — anti-escopo prompt | `backfill-repasses-proprietario.ts` |
| PDF status real (remove heurística fake) | AN.4 — alinhamento com `proprietario/repasses` page | `relatorio-mensal.service.ts` |

## Bugs / Débitos resolvidos

- **D-novo-BM** ✅ funcionalmente reparado em AN.3.1 — painel credenciais voltava pro `/login` em uso real após token impersonate expirado. Mantém status P0 BLOQUEADOR REMOÇÃO PRÉ-PROD (a remoção continua pendente quando primeiro parceiro real entrar).
- **Cards parceiro display-only** ✅ resolvido em AN.4 — Usinas agora redirecionam pra `/dashboard/usinas` (versão funcional completa).

## Débitos novos catalogados

- **D-novo-AN** ✅ IMPLEMENTADO 100% (5 commits — esta sessão).
- **D-novo-BP** P3 (NOVO) — **Convergência portal `/parceiro` vs `/dashboard`**. Investigação AN.3.1 mostrou que `/parceiro` é ativo (30 páginas) mas sidebar já está encaminhando entidades complexas (Membros, agora Usinas) pra `/dashboard/*`. Avaliar convergir as 30 páginas `/parceiro` no Sprint Refator UX futuro (não-bloqueador).

## Estatísticas finais

| Métrica | Valor |
|---|---|
| Commits do sprint | 5 |
| Sessões Code | 1 (dia inteiro 30/05) |
| Arquivos backend tocados | ~20 |
| Arquivos frontend tocados | ~10 |
| Specs Jest novos | 36 (21 service + 10 controller + 5 notificação) |
| Smokes programáticos | 3 (8/8 service AN.1 + 12/12 endpoints AN.2 + script backfill apply+idem) |
| Build web Turbopack | Clean em 4 ciclos (AN.1, AN.3, AN.3.1, AN.4) |
| RepasseProprietario no banco | 4 PENDENTE (1 trigger AN.3.1 + 3 backfill AN.4) |
| Bugs P0/P1 resolvidos inline | 1 (D-novo-BM reparo funcional) |
| Decisões arquiteturais catalogadas | 8 |
| Investigações ad-hoc reportadas | 1 (/parceiro vs /dashboard → D-novo-BP) |

## Lições / observações

1. **Fase 1 read-only mini funciona como cobrança de qualidade.** AN abriu com Fase 1 estruturada que mapeou 7 consumidores + 8 perguntas decisórias antes de Luciano autorizar AN.1. Resultado: zero retrabalho em decisões (`@@unique`, opção a cron, sem pagamento parcial, etc).
2. **Investigação read-only não é "perda de tempo" — é direcionamento de roadmap.** AN.3.1 fez investigação ad-hoc `/parceiro` que virou D-novo-BP catalogado + decisão arquitetural acatada em AN.4 (cards redirect). Sem investigação, AN.4 teria duplicado a tela.
3. **Cache JwtStrategy 60s é uma feature pra performance, mas afeta como smokes testam guards.** Documentado no AN.2 — não é bug, é limitação operacional pra testar cross-tenant via HTTP com mesmo `sub`.
4. **Interceptor global de redirect 401 precisa de allowlist.** AN.3.1 catalogou a regra: rotas de "self-recovery" (painel dev, selecionar-contexto) NÃO devem expulsar pro login — devem mostrar erro inline com botões de ação. Princípio aplicável a futuros endpoints semelhantes.
5. **D-novo-AS complemento (lição BN) aplicado 8× sem regressão.** Sprint AN bateu 8 ciclos de `npm run build` web sempre seguidos de `pm2 restart cooperebr-frontend` imediato. Padrão sedimentado.

## Próximo passo

**Próximo bloco — Luciano escolhe (6 opções):**

- **(A) F.4 smoke produção** (~1-2h) — BLOQUEADO Luciano operacional (preencher cooperebr1 + cadastrar E-Solares).
- **(B) Sprint Contabilidade Tributária** (#8 roadmap, ~40-60h) — lê despesas BH + repasses AN como base contábil.
- **(C) Sub-Sprint B ETL legado→novo** — BLOQUEADO `script.sql` hb06a.
- **(D) Sungrow integração real** (~2-3h) — BLOQUEADO credenciais E-Solares.
- **(E) Convergência `/parceiro`→`/dashboard`** (D-novo-BP, Sprint Refator UX futuro).
- **(F) Remoção D-novo-BM** painel credenciais (quando entrar produção real — checklist 9 passos catalogado).

## Pré-requisitos leitura próxima sessão

- Este doc-sessão (cronologia 5 fatias + decisões + lições)
- `docs/debitos-tecnicos.md` D-novo-AN IMPLEMENTADO + D-novo-BP catalogado + D-novo-BM mantém status P0 BLOQUEADOR REMOÇÃO PRÉ-PROD
- `docs/MAPA-INTEGRIDADE-SISTEMA.md` (linha RepasseProprietario 100%)
- `docs/PLANO-ATE-PRODUCAO.md` (Sprint AN ✅)
- Memória `padrao_ux_edicao_inline_vs_pagina_propria_17_05.md`
- Memória `feedback_fase1_readonly_obrigatoria.md`
- Memória `regra_validacao_previa_e_retomada.md`

## Carry-overs (não-bloqueantes)

- **D-novo-BM** — mantém P0 BLOQUEADOR REMOÇÃO PRÉ-PROD (checklist 9 passos catalogado em `docs/debitos-tecnicos.md`). Reparo funcional AN.3.1 NÃO altera o status — fica até primeiro parceiro real entrar em prod.
- **D-novo-BP** (P3) — convergência `/parceiro` → `/dashboard` (Sprint Refator UX futuro).
- **D-novo-BJ** (P2 LGPD) — URL assinada comprovantes (agora vale também pra repasses, não só despesas).
- **D-novo-BK** (P3) — storage S3/Supabase.
- **D-novo-BG** (P3) anomalia GD Linhares.
- **D-novo-BC** (P2) paridade campos edição usina.
- 30+ scripts utilitários untracked em `backend/scripts/` (Sprint Housekeeping carry-over).

## Regras aplicadas

- **Decisão 23** — Fase 1 read-only mini OBRIGATÓRIA em AN.1 (aplicada com sucesso → zero retrabalho).
- **Padrão UX Dual 17/05** — Tipo B (telas) + Tipo C (Dialogs). ZERO violações no sprint inteiro (BH.3.1 ensinou a lição).
- **D-novo-AS complemento (lição BN)** — `npm run build` web SEMPRE seguido de `pm2 restart frontend`. Aplicado 8× sem regressão.
- **Multi-tenant universal** — `assertSameTenantOrSuperAdmin` + bypass perfil-baseado em todos os endpoints novos.
- **`isAmbienteReal()` inegociável (18/05)** — usado no trigger manual cron + endpoint dev. NUNCA NODE_ENV.
- **Regra contatos teste (14/05)** — whitelist LGPD ativa em DEV pra notificações `notificarRepassePago`.
- **Decisão 24** — frase de retomada local único (`CONTROLE-EXECUCAO.md` + este doc-sessão).
- **Regra não-paralelo (17/05)** — sessão sequencial pura, claude.ai aguardou cada reporte.
- **Regra fechamento bilateral (13/05)** — este fechamento satisfaz a regra.

## Frase comandante

Idêntica ao bloco "Próximo passo" + `CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA`.
