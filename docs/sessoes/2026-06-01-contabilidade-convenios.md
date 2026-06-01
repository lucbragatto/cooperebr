# Sessão Contabilidade + Convênios + Polimento UX — 01/06/2026

## TL;DR

Maratona de **5 fatias de produto + 1 fatia de docs + decisões fiscais estruturais**, todas voltadas a fechar o ciclo da Contabilidade Tributária Segregada e do módulo de Convênios. Entregue: **CT.7** (PDFs autenticados via blob + apuração não oferece "Fechar" se já fechada + endpoints validar/reabrir wirados na UI) → **PUX-A** (Convênio criar/editar virou página própria + `<HelpBox>` reusável + texto validado) → **CT.8** (classificação inline Tipo A do Plano de Contas Segregado, multi-tipo de parceiro com enforcement P0-1) → **CT.9** (botão "Registrar movimento" no convênio → cria `LancamentoCaixa` Auxiliar Art. 88, síncrono, com gate apuração FECHADA reusado) → **CT.9.1** (bugfix smoke: timezone competência, estorno do movimento, sweep "Walter" do código). Em paralelo, **correção operacional "Walter"**: era referência de memória perdida — quem valida é **Luciano + orquestrador**. Sweep aplicado em 11 docs (CT.9) + 8 arquivos de código (CT.9.1) + specs ajustados. Encerramento com **3 decisões fiscais estruturais** (D-FISCAL-1 classificação configurável do convênio CT, D-FISCAL-2 consolidação do convênio único reaproveitando ContratoConvenio legado, D-FISCAL-MLM tratamento da comissão de captação Hangar) e **correção ao relatório de conformidade 2026-05-31** (Hangar citado erradamente como Art. 88). 5 commits feature/fix de código + 1 commit docs de fechamento. Zero regressão (284 specs verdes mantidos).

## Marco entregue

**CT.7 + PUX-A + CT.8 + CT.9 + CT.9.1 + decisões fiscais estruturais** (arco "Contabilidade + Convênios fechados").

## Commits do dia (5 trabalho + 1 fechamento)

| Hash | Mensagem |
|---|---|
| `12ca409` | fix(contabilidade): CT.7 — PDFs autenticados (404→blob) + apuração não oferece Fechar já fechada |
| `4cf71d2` | feat(ux): PUX-A — Convênio página própria + componente HelpBox + help |
| `d086550` | feat(CT.8): classificação inline do plano de contas (multi-tipo) + corrige link enganoso |
| `61bbc7e` | feat(CT.9): registrar movimento de convênio → lançamento Auxiliar (Art. 88) + histórico + limpeza ref. Walter |
| `d953381` | fix(CT.9.1): timezone competencia + estorno movimento convenio + limpeza Walter no codigo |
| _este_ | docs(fechamento): sessão 01/06 — CT.7..CT.9.1 + decisões fiscais (D-FISCAL-1/2) + retomada |

## Entregas técnicas

### CT.7 — PDFs autenticados + apuração estado consciente (commit `12ca409`)

**BUG-CT-1 (404 nos PDFs):** botões usavam `window.open('/api/...')` → batia no frontend Next.js (rota inexistente) → 404. Sem JWT.
- **Helper** `web/lib/pdf-download.ts` exportando `abrirPdf({endpoint, params})`: axios GET `responseType: 'blob'` → `URL.createObjectURL` → `window.open(blobUrl)`. Authorization injetado via interceptor. Revoga blob em 60s. Verifica `Content-Type=application/pdf` (evita abrir JSON-de-erro como "PDF").
- Aplicado em `dre/page.tsx` ("PDF não-lucratividade") + `apuracao/page.tsx` ("Memorial PDF")
- **3º botão "Repasses PDF"** adicionado em `apuracao/page.tsx` (existia no backend mas UI não expunha)

**BUG-CT-2 (Fechar oferecido em mês fechado):** tela mostrava "Fechar Apuração" sem checar `ApuracaoMensalSegregada` existente.
- **Backend:** `apurarMes` retorna campo extra `snapshot: SnapshotInfo | null` (id, status, validadoContador, validadoEm, fechadoEm, observacaoContador) — UI decide tudo sem endpoint extra
- **Frontend:** 3 estados visuais na badge superior + botões condicionais:
  - ABERTA/sem snapshot → amarelo "PENDENTE VALIDAÇÃO" + botão Fechar
  - FECHADA + não validado → cyan "FECHADA, aguarda validação" + botão Validar + Reabrir (SA)
  - FECHADA + validado → verde "VALIDADA INTERNAMENTE" + datas + observação + Reabrir (SA)
- 2 Dialogs novos: Validar (motivo opcional) + Reabrir (motivo ≥10 chars, SA only)
- 409 race condition → toast claro "Apuração já foi fechada por outro usuário — recarregue"

### PUX-A — Convênio página própria + HelpBox (commit `4cf71d2`)

Padrão UX **esclarecido 01/06** (refina "banir telinhas" de 31/05 que foi exagero):
- **Cadastro/edição** de entidade → **página própria** (Tipo B, 17/05 original)
- **Confirmação/ação simples** (fechar, estornar, remover, marcar pago) → **Dialog OK**
- **Help inline** em todas as telas → **obrigatório** (regra 19/05)

**`<HelpBox>`** (`web/components/ui/help-box.tsx`):
- Banner dispensável (botão ×; lembra fechado via `localStorage[helpbox:<id>]`)
- Variantes: `info` (azul) | `aviso` (amber)
- Sem Shadcn/Radix pesado — estilo leve igual `tabs-custom.tsx`
- Spec unit pulado (web sem framework de testes — só `dev/build/start/lint`; validação via build + smoke)

**Convênio página própria:**
- `/dashboard/contabilidade/convenios/novo` (criar) — substitui Dialog
- `/dashboard/contabilidade/convenios/[id]/editar` (editar) — useParams RAW (lição BF — antes não havia edição na UI!)
- `ConvenioForm` reusável (`web/components/convenios/ConvenioForm.tsx`) — `<select>` nativo (regra 19/05) + validação client

**Lista refator + HelpBox:**
- Botão "Novo convênio" → `<Link>` (não Dialog)
- Editar = ícone Pencil → navega `/[id]/editar`
- Deletar mantido em Dialog confirmação (regra esclarecida)
- `ConvenioHelp` (`web/components/convenios/ConvenioHelp.tsx`) com texto validado

### CT.8 — Classificação inline do Plano de Contas Segregado, multi-tipo (commit `d086550`)

**Fase 1 read-only:** 32 contas totais (28 globais seed CT.1 + 4 tenant-scoped). 10 já classificadas, 22 pendentes (prompt mencionou "3" — reportado).

**Backend:**
- `ClassificarContaDto` (3 campos opcionais class-validator)
- `PATCH /financeiro/plano-contas/:id/classificacao` — `@Roles(SA, ADMIN)` + `@TenantResource({ model: 'planoContas', globalOnlySuperAdmin: true })` + `@AuditLog`
- Service: guard IDOR + **enforcement P0-1 multi-regime** — parceiro `tipoParceiro !== 'COOPERATIVA'` que tente atribuir `naturezaCooperativa` → `BadRequest` com mensagem citando D-novo-CT-MULTI-REGIME-CLASSIFICACAO
- `lint:tenant` ✅ OK (43/299 com decorator)

**Frontend (multi-tipo via `useTipoParceiro`):**
- Aviso enganoso "editar em /configuracoes/financeiro" **REMOVIDO** → aviso adaptado ao tipo de parceiro
- COOPERATIVA: 3 colunas editáveis (Contábil + Cooperativa + Fundamento)
- NÃO-COOP (CONSORCIO/ASSOC/CONDOMINIO): coluna "Natureza Cooperativa" some + aviso amber explicando regime próprio
- Edição inline Tipo A: select nativo (regra 19/05) — onChange/onBlur/Enter
- Otimista: UI atualiza imediato → erro reverte + ⊘ vermelho com tooltip
- Cards Total/Segregadas/Pendentes recalculam via useMemo
- Gating: SUPER_ADMIN → tudo; ADMIN → só própria coop (globais read-only); OPERADOR → read-only

### CT.9 — Movimento de convênio → LancamentoCaixa Auxiliar (commit `61bbc7e`)

**Decisão Luciano 01/06 — Design A:** admin lança movimento manualmente via Dialog "Registrar movimento". Backend cria `LancamentoCaixa` classificado AUXILIAR (Art. 88 — soma zero, não tributado). **SÍNCRONO** (await + throw propaga UI, **não** fire-and-forget).

**Tarefa 0a — Purga "Walter" dos docs (correção 01/06):** Walter era referência de memória perdida — NÃO existe contador externo. Validação = Luciano + orquestrador. 11 docs limpos, ~88 ocorrências contextuais substituídas:
- "gate Walter" → "gate de validação fiscal"
- "validação Walter" → "validação fiscal interna (Luciano + orquestrador)"
- "Sessão Walter" → "Sessão de Validação Fiscal Interna"
- `D-novo-CT-GATE-WALTER` → `D-novo-CT-VALIDACAO-FISCAL`
- Histórico (`docs/historico/`) preservado como fotografia (não alterado)

**Tarefa 0b:** `D-novo-CT-PLANO-GLOBAL-VS-TENANT` P3→P2 + decisão tomada = **Opção B (CLONE POR PARCEIRO)** + amarrado com `D-novo-CT-MULTI-REGIME-CLASSIFICACAO` sob "Sessão de Validação Fiscal Interna".

**Schema (aditivo, db push idempotente):**
- `enum OrigemLancamento += CONVENIO`
- `LancamentoCaixa.convenioContabilId String?` + relation `convenioContabil Convenio? @relation("LancamentoConvenioContabil")` — distinta do legado `convenioId → ContratoConvenio` MLM
- `Convenio.lancamentos LancamentoCaixa[]` back-relation

**Backend:** `criarLancamentoConvenio` síncrono com enforcement P0-1 + sentido derivado do `fluxoFinanceiro` (INGRESSO→RECEITA / REPASSE/CUSTO→DESPESA) + gate apuração FECHADA reusado.

**Endpoints:** `POST /contabilidade-tributaria/convenios/:id/movimentos` (HTTP 201 + AuditLog) + `GET .../movimentos` (histórico).

**Frontend:** `<MovimentosConvenioSection>` em `/convenios/[id]/editar` com HelpBox texto neutro + Dialog Tipo C (ação OK regra 01/06) + tabela histórico + **SEM otimista** (dinheiro).

### CT.9.1 — Bugfix smoke + sweep Walter do código (commit `d953381`)

**BUG 1 (P0) Timezone:** `new Date('YYYY-MM-DD')` parseia UTC midnight → em GMT-3 vira dia anterior. `getMonth()` em Date UTC desloca competência.
- **Fix backend:** parse LOCAL no controller (`new Date(a, m-1, d)`); competência derivada da string original (`substring(0,7)`).
- **Fix service:** aceita `competencia?` opcional, prioriza ela.
- **Fix frontend:** `hoje` em LOCAL (sem `toISOString`); display via `formatarDataIso(iso)` extrai YYYY-MM-DD da string.
- Limpeza: deletado 1 movimento teste `2026-07 "teste convenio"` com data real `2026-08-01` via `scripts/ct91-deletar-teste.ts`.

**BUG 2 (P1) Estorno do movimento:** "contábil não se edita, se estorna" (Luciano).
- Backend: `estornarMovimentoConvenio` + `DELETE /contabilidade-tributaria/convenios/:id/movimentos/:lancamentoId` (@TenantResource + @AuditLog). Gate apuração FECHADA bloqueia → ConflictException.
- Frontend: coluna Ações + botão `RotateCcw` amber por linha → Dialog Tipo C confirmação + motivo opcional + erro inline.
- `lint:tenant` ✅ 45/300 com decorator.

**BUG 3 (P1) Walter no código:** sweep CT.9 pegou só `docs/`. Agora 8 arquivos web/app + backend/src limpos:
- 14 padrões de substituição contextual neutra
- 3 specs ajustados (asserts pros novos textos)
- Typo `validamr` → `validar` corrigido
- **Grep final:** `grep -rn "Walter" web/app web/components backend/src` exceto `.spec.` = **0 ocorrências**

**GAP 4 (CATALOGADO, não implementado):** `D-novo-CT-PDF-AUXILIAR P2` — 3 PDFs ignoram `receitaAuxiliar/despesaAuxiliar`. Convênio aparece na DRE em tela mas some nos PDFs de defesa. 4 decisões fiscais pendentes pra Sessão de Validação Fiscal Interna.

### Decisões fiscais estruturais (catalogadas hoje, **a executar em fatia futura**)

#### D-FISCAL-1 — Classificação do convênio CT é CONFIGURÁVEL (P1)

Hoje o `criarLancamentoConvenio` (CT.9) hardcoda AUXILIAR via regime cooperativo (`FonteConvenio → AUXILIAR`). **A decisão fiscal mudou:** classificação deve ser configurável **no convênio** (campo `naturezaAtoCooperativo`) — PRÓPRIO ou AUXILIAR — porque depende do **critério econômico**:

> **"A cooperativa fica com sobra/resultado (mesmo se repassada ao dono da estrutura)?"**
> - **SIM** = ato cooperativo **PRÓPRIO** (Art. 79). Caso médico abaixo é exemplo.
> - **NÃO** = ato cooperativo **AUXILIAR** (Art. 88) — custeio trânsito puro, soma zero.

**4 travas pra qualificar como AUXILIAR (Art. 88):**
1. Todos os participantes são cooperados (ou a cooperativa é a única operadora financeira do convênio)
2. Fluxo entra = sai (soma zero — sem retenção/margem)
3. Convênio documentado formalmente (objeto, prazo, valores, partes)
4. Escrituração contábil segregada (lançamentos visíveis na DRE Auxiliar)

#### Caso médico (validado 01/06)

Empresa de medicina cooperada da CoopereBR contrata serviço da cooperativa: a CoopereBR gera energia (usina em **cessão** = ato PRÓPRIO da cooperativa), a empresa médica paga a energia consumida pelos médicos cooperados (também cooperados), e o **resíduo financeiro** (a sobra da margem cooperativa) é repassado ao dono da usina cedente (também cooperado).

**Estrutura contábil correta:**
- **Cobrança da empresa médica** → Contas a Receber + LancamentoCaixa(PROPRIO, receita)
- **Repasse aos donos da estrutura** → Contas a Pagar + LancamentoCaixa(PROPRIO, despesa)
- **Despesas atreladas** → Contas a Pagar + LancamentoCaixa(PROPRIO, despesa)

Esse é **Design B** mencionado no D-novo-CT-CONVENIO-HOOK (P2 catalogado em CT.9): hook em Cobranca/ContaAPagar com `convenioId` opcional dispara o lançamento certo. Caso médico é o primeiro caso real que justifica B.

#### Hangar ≠ AUXILIAR (correção do relatório 2026-05-31)

O **Hangar Academia** é cooperado PJ da CoopereBR e tem programa de **captação+MLM** (indicações em cascata) usando `ContratoConvenio` legado — **não é Art. 88**. Relatório de conformidade `docs/relatorios/2026-05-31-conformidade-contabil-multi-regime.md` cita Hangar como exemplo de Art. 88 → **errado**. Correção catalogada como débito (`D-FISCAL-MLM`).

#### D-FISCAL-2 — Consolidação do convênio único (P1, próxima sessão = fatia substancial)

Hoje há **dois modelos de convênio**:
1. **`ContratoConvenio` (legado MLM)** — usado em `/dashboard/convenios`. Tem faixas, membros, indicações, desconto, conveniado, cooperado. Foco em captação+MLM (Hangar, AESMP, ASSEJUFES).
2. **`Convenio` (CT.2)** — usado em `/dashboard/contabilidade/convenios`. Tem `fluxoFinanceiro` + `classificacaoFiscal` + vigência. Foco em contabilidade tributária Art. 88.

**Decisão:** **consolidar num modelo único** (mantém o nome `ContratoConvenio` por compatibilidade) + adicionar:
- Flag `naturezaAtoCooperativo: 'PROPRIO' | 'AUXILIAR' | 'NAO_COOPERATIVO' | null` (D-FISCAL-1)
- Flag `geraLancamentoContabil: Boolean` (todo convênio que tem essa flag gera contábil universal)
- Aposentar a área CT separada (`/dashboard/contabilidade/convenios` vira redirect ou some)
- Reaproveitar motor `criarLancamentoConvenio` do CT.9 (passa a olhar `naturezaAtoCooperativo` do convênio em vez de hardcodar AUXILIAR)
- Migração do 1 convênio CT existente → ContratoConvenio com flags

**Plano alto nível (a refinar em Fase 1 read-only da próxima sessão):**
- Mapear ContratoConvenio completo (todos os campos + relações)
- Diff com Convenio CT.2/CT.9 (o que falta no legado)
- Schema delta aditivo: campos novos no ContratoConvenio (flags fiscal) + dados-ponte
- Estender service que cria LancamentoCaixa pra olhar a flag
- UI: incorporar campos fiscais ao formulário de ContratoConvenio
- Deprecar `/dashboard/contabilidade/convenios` → redirect ou remoção
- Backfill: migrar 1 convênio CT existente
- Catalogar como **D-FISCAL-2** P1

#### D-FISCAL-MLM — Classificação fiscal da comissão MLM Hangar (P2, thread à parte)

Hangar gera **comissão de captação** (indicações em cascata) — não é ato cooperativo Art. 79 (não cumpre objeto social cooperativo), não é Art. 88 (não é convênio de custeio com soma zero), provavelmente é Art. 86 (não-cooperativo, tributado). Mas isso precisa de **validação fiscal interna** — alguém pode argumentar que captação de cooperados é "objeto social". Thread separada do convênio-único.

## Bugs resolvidos / catalogados

| # | Sev | Origem | Causa raiz | Fix | Status |
|---|---|---|---|---|---|
| CT.7 BUG-1 PDFs 404 | P0 | Smoke pós-CT.6 | `window.open('/api/...')` → frontend → 404, sem JWT | Helper blob + axios auth | RESOLVIDO (12ca409) |
| CT.7 BUG-2 Fechar em mês fechado | P1 | Smoke | Tela não checava `ApuracaoMensalSegregada.status` | Snapshot info embedded no preview + 3 estados visuais | RESOLVIDO (12ca409) |
| PUX-A Convênio Dialog | P1 (UX) | Padrão UX 01/06 esclarecido | Criar/editar não pode ser Dialog | Página própria `/novo` + `/[id]/editar` | RESOLVIDO (4cf71d2) |
| CT.8 Aviso enganoso `/configuracoes/financeiro` | P1 | Read-only Fase 1 | Tela mandava editar em rota errada (Régua de Cobrança) | Aviso adaptado tipo parceiro + edição inline | RESOLVIDO (d086550) |
| CT.8 Plano de contas sem UI de classificação | P1 | Read-only | 22 pendentes impossíveis de classificar | Edição inline Tipo A + enforcement P0-1 multi-regime | RESOLVIDO (d086550) |
| CT.9 Convênio só cadastrava | P2 (era P3) | PUX-A diagnóstico | Não gerava `LancamentoCaixa` em movimento real | Design A — botão Registrar movimento síncrono | RESOLVIDO (61bbc7e) — D-novo-CT-CONVENIO-HOOK ✅ |
| CT.9 "Walter" nos docs | Operacional | Memória perdida — não existe contador externo | Quem valida = Luciano + orquestrador | Sweep contextual 11 docs + rename débito | RESOLVIDO (61bbc7e) |
| CT.9.1 BUG 1 Timezone | P0 | Smoke | `new Date('YYYY-MM-DD')` UTC → GMT-3 vira dia anterior | Parse LOCAL + competência da string original | RESOLVIDO (d953381) |
| CT.9.1 BUG 2 Estorno do movimento | P1 | Smoke | "não tem como desfazer" | DELETE endpoint + Dialog Tipo C + gate FECHADA | RESOLVIDO (d953381) |
| CT.9.1 BUG 3 "Walter" no código | P1 | Sweep CT.9 pegou só `docs/` | 14 padrões em 8 arquivos | Sweep contextual + specs ajustados + grep final ZERO | RESOLVIDO (d953381) |
| **D-FISCAL-1** Classificação convênio configurável | P1 | Decisão fiscal 01/06 | Hoje hardcoda AUXILIAR; deve ser PRÓPRIO/AUXILIAR conforme critério econômico | (futuro) campo `naturezaAtoCooperativo` no Convenio + UI | CATALOGADO |
| **D-FISCAL-2** Consolidação convênio único | P1 (sprint) | Decisão fiscal 01/06 | 2 modelos paralelos (ContratoConvenio MLM + Convenio CT) | (próximo Code) Fase 1 read-only + plano de migração | CATALOGADO |
| **D-FISCAL-MLM** Hangar não é Art. 88 | P2 | Decisão fiscal 01/06 | Relatório 2026-05-31 cita Hangar como exemplo Art. 88 — errado | (futuro) corrigir relatório + decidir Art. 86 vs cooperativo | CATALOGADO |
| **D-novo-CT-PDF-AUXILIAR** PDFs ignoram Auxiliar | P2 | CT.9.1 GAP 4 | 3 PDFs não usam `receitaAuxiliar/despesaAuxiliar` | (futuro) seção Art. 88 + decisão FR/FATES | CATALOGADO |

## Decisões estratégicas catalogadas

**Decisões 01/06 (catalogadas em docs/debitos-tecnicos.md + relatório de conformidade):**

1. **Padrão UX esclarecido 01/06** — Dialog modal NÃO está banido pra ações simples (validar/fechar/estornar/aprovar/remover). Decisão 31/05 "banir telinhas" foi exagero — Dialog continua válido pra confirmação/ação. **Banimento permanece apenas pra cadastro/edição de entidade** (que vai pra página própria).
2. **D-novo-CT-PLANO-GLOBAL-VS-TENANT P3→P2 + Opção B aprovada** — cada parceiro tem clone próprio do plano de contas; globais ficam como template imutável.
3. **D-FISCAL-1 Classificação configurável do convênio CT** — naturezaAto depende do critério econômico ("cooperativa fica com sobra?"). 4 travas pra qualificar Art. 88.
4. **D-FISCAL-2 Consolidação do convênio único** — `ContratoConvenio` legado absorve `Convenio` CT.2. Próximo Code arranca por Fase 1 read-only.
5. **Hangar ≠ Art. 88** — relatório 2026-05-31 errou ao citar Hangar. Captação+MLM é provavelmente Art. 86 (D-FISCAL-MLM).
6. **"Walter" = referência de memória perdida** — quem valida é Luciano + orquestrador. Sweep aplicado (docs + código).

Nenhuma decisão nova catalogada como memória persistente em `~/.claude/projects/.../memory/` (todas viraram débitos em `docs/debitos-tecnicos.md` por serem técnicas/operacionais; memórias seguem cobrindo as regras inegociáveis pré-existentes).

## Próximo passo

**Sessão de CONSOLIDAÇÃO do convênio único (D-FISCAL-2).** Arrancar pela **Fase 1 read-only profunda** mapeando `ContratoConvenio` legado completo + diff com `Convenio` CT.2/CT.9 + plano de migração + onde encaixar a flag `naturezaAtoCooperativo` + geração contábil universal + como aposentar `/dashboard/contabilidade/convenios` reaproveitando o motor `criarLancamentoConvenio`. **NÃO TOCAR CÓDIGO antes do reporte + OK Luciano.**

## Pré-requisitos leitura próxima sessão

1. `docs/CONTROLE-EXECUCAO.md` (estado atual + frase comandante)
2. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md` (índice)
3. **Este doc** — contexto das 5 fatias + decisões fiscais
4. `docs/debitos-tecnicos.md` — seções D-FISCAL-1, D-FISCAL-2, D-FISCAL-MLM, D-novo-CT-CONVENIO-HOOK (resolvido), D-novo-CT-PDF-AUXILIAR
5. `docs/relatorios/2026-05-31-conformidade-contabil-multi-regime.md` (atenção: exemplo Hangar errado, corrigir)
6. **Schema atual** `backend/prisma/schema.prisma` — modelos `Convenio` (CT.2) + `ContratoConvenio` (legado MLM) + relations
7. `backend/src/contabilidade-tributaria/contabilidade-tributaria.service.ts` — `criarLancamentoConvenio` (CT.9)
8. `backend/src/contabilidade-tributaria/convenios-ct.service.ts` + controller — CRUD CT
9. `/dashboard/contabilidade/convenios/*` (front CT) + `/dashboard/convenios/*` (front MLM legado)
10. `CLAUDE.md` + `.claude/CLAUDE.md` (regras)
11. `git log --oneline -20`

## Carry-overs (não-bloqueantes)

- **15 erros TS pré-existentes** em `backend/src/agents/sentinela/*` + `backend/src/agents/repasses-despesas/*` (untracked work-in-progress)
- **43+ untracked scripts/relatórios** acumulados — Sprint Housekeeping futuro
- **256 legados allowlist lint:tenant** — esvaziar incrementalmente
- **Sprint Polimento UX (PUX.1→PUX.6)** parcialmente coberto (HelpBox + Convênio página própria em PUX-A) — restante: AcaoInlineExpansivel, telas legadas que usam Dialog inapropriadamente (revisar critério novo 01/06), lint:ux
- **D-novo-CT-PDF-AUXILIAR P2** — PDFs ignoram Auxiliar; resolver na Sessão de Validação Fiscal Interna
- **D-novo-CT-VALIDACAO-FISCAL P0** (ex-Walter) — alíquotas/presunção + classificação repasse + flag isencao PIS/COFINS pendentes de validação interna antes de DCTF/SPED real
- **D-novo-CT-MULTI-REGIME-CLASSIFICACAO P1** — falta classificação positiva pra CONSORCIO/ASSOC/CONDOMINIO (Sinergia)
- **D-novo-BR-CT-ESTORNO P2** — estorno Cobrança/ContaAPagar (mesmo padrão de RepasseProprietario)
- **D-novo-BM** (P0 BLOQUEADOR REMOÇÃO PRÉ-PROD — painel credenciais teste)
- **D-novo-BP** (P3 convergência /parceiro vs /dashboard)

## Regras aplicadas na sessão

- Decisão 23 (Fase 1 read-only antes de tocar código) — aplicada em CT.7, CT.8, CT.9, CT.9.1
- Ritual PM2 (stop → port livre → generate → push → restart) — schema delta CT.9 aplicado (idempotente: db push retornou "already in sync")
- Regra fechamento bilateral 13/05 — esta doc-sessão + CONTROLE + frase comandante + push
- Regra não-paralelo claude.ai 17/05 — Code exclusivo nas 5 fatias
- Padrão UX **esclarecido 01/06** (substituiu 31/05): Dialog OK pra ação, página própria pra entidade, HelpBox obrigatório
- Select nativo dentro Dialog (regra 19/05) — aplicado em ConvenioForm + MovimentosConvenioSection + plano-contas selects
- Lint tenant baseline+ratchet — 5 commits sem novos handlers sem decorator
- TenantContext F1.3 + runAsPlatform — hook CT.9 sem TENANT-LEAK
- Build incremental BN (`cd web && npm run build` + `pm2 restart cooperebr-frontend`) — pós cada fatia frontend
- Zero `--accept-data-loss` — CT.9 schema delta aditivo, db push idempotente
- `useParams RAW` (lição BF) — aplicado em `/convenios/[id]/editar`
- **Regra contatos teste** — não houve disparo real nesta sessão (só read-only + UI smoke)
- **Math.round(x*100)/100** em valores monetários — aplicado em `criarLancamentoConvenio`
- **Decisão 24 (frase comandante local único)** — esta sessão atualiza CONTROLE-EXECUCAO sem duplicar

## Frase comandante

Ver `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único).
