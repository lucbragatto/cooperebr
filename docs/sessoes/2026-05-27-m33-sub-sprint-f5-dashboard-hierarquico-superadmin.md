# M33 — Sub-Sprint F.5 Dashboard Hierárquico Super Admin + Admin Parceiro

> Sessão: 27/05/2026 (extensão M32 — mesma janela Code).
> Marco: **M33 — F.5a backend + F.5b frontend + fix D-novo-BD + Admin Parceiro adicionado**.

## TL;DR

M33 entregou **Sub-Sprint F.5 completo (backend + frontend)** transformando `/dashboard/proprietario` (antes mostrava só "Nenhuma usina vinculada" pra Super Admin) num dashboard hierárquico de 2 níveis: grid de cards-resumo por cooperativa → tabela de usinas+proprietários → drill-down impersonate. Pós-smoke do Luciano, fix de regressão de overflow horizontal (D-novo-BD) + **reversão da decisão #4 do F.5**: Admin Parceiro também ganhou acesso, com versão adaptada (vai direto pra tabela da sua cooperativa, pula grid). 4 débitos novos catalogados (D-novo-AZ/BA/BB/BC) pra Sub-Sprint Refinamento Telas Usinas futuro.

## Commits do dia (5)

| Hash | Mensagem |
|---|---|
| `c21fc1c` | feat(admin-proprietarios): F.5a backend dashboard hierárquico Super Admin |
| `bc62ccd` | feat(admin-proprietarios): F.5b frontend — grid cards + tabela + banner impersonate |
| (este) | feat(admin-proprietarios): D-novo-BD fix tabela overflow + Portal Proprietário Admin Parceiro |
| (este) | docs(debitos): catalogar AZ + BA + BB + BC pendentes pra Sub-Sprint Refinamento Telas Usinas |
| (este) | docs(sessao): fechamento M33 |

## Entregas por sub-fatia

### F.5a — Backend (commit `c21fc1c`)

3 endpoints novos em módulo dedicado `backend/src/admin/proprietarios/`:

- `GET /admin/proprietarios/cooperativas` (@Roles SUPER_ADMIN) — grid 1 entry por cooperativa ativa. 7 campos novos agregados: usinasComProprietario / proprietariosUnicos / totalYtdAgregado / capacidadeTotalKwp / status OK-atenção-crítico / convitesPendentes / contratosVencendo30d. Reusa helper `calcularRepasse` (não recria lógica).
- `GET /admin/proprietarios/cooperativas/:id/usinas` (@Roles SUPER_ADMIN+ADMIN, ADMIN só sua propria) — tabela detalhada com mascaramento LGPD do email (`jo***@example.com`), conviteStatus derivado em runtime, contratoArrendamento formatado conforme `formaPagamentoDono`.
- `GET /proprietario/usinas/:id?impersonate=true` — bypass guard SUPER_ADMIN. Audit log estruturado `console.log [IMPERSONATE_PROPRIETARIO]` (D-30N AuditLog ainda inativo).

**Specs:** 19 novos (15 AdminProprietariosService + 4 bypass impersonate). Suite total 935 passing.

**Smoke real (5/5 verde):** CoopereBR retornou 3 proprietários únicos, R$ 4.000 YTD, 5.750 kWp, 7 OPERANDO. usina-linhares com FIXO R$ 1.000, email mascarado, conviteStatus NAO_CONVIDADO.

### F.5b — Frontend (commit `bc62ccd`)

3 telas novas + 1 patch:

- **`/dashboard/proprietario`** — refactor completo. Grid responsivo de cards (1/2/3 cols). Cada card: header 3 badges (tipoParceiro/planoSaas/statusSaas), 4 KPIs (usinas, proprietários, capacidade kWp, YTD R$), semáforo OK/atenção/crítico, badges contextuais condicionais (convites pendentes + contratos vencendo 30d). Card inteiro clicável. Skeleton + empty + error states. Help inline azul.
- **`/dashboard/proprietario/[cooperativaId]`** (NOVA rota) — breadcrumb + 3 cards resumo + tabela 7 colunas (Usina / Status / Proprietário / Contrato Arrendamento / YTD / Convite / Ação). Linha clicável → drill-down. Badges visuais. LGPD: email mascarado do backend.
- **`/proprietario/usinas/[id]` patch** — detecta `?impersonate=true&cooperativaId=X` via `useSearchParams`. Banner azul `Shield` icon no topo + botão "Voltar pra tabela". Passa query param pro backend (bypass guard ativa).
- **Sidebar** — item "Portal Proprietário" condicional só `SUPER_ADMIN` (depois revertido em M33 Etapa B).

**Build:** `npm run build` ✓ 140 páginas em 22.4s (Turbopack — D-novo-AS aplicada).

### M33 Etapa A — Fix D-novo-BD (este commit)

`web/app/dashboard/proprietario/[cooperativaId]/page.tsx` — envolveu `<Table>` com `<div className="overflow-x-auto">` + `<Table className="min-w-[900px]">`. Scroll horizontal fica isolado ao container da tabela, não afeta layout da página.

### M33 Etapa B — Admin Parceiro adicionado (reversão decisão #4 F.5)

**Backend:**
- `admin-proprietarios.controller.ts`: removido `@Roles(SUPER_ADMIN)` do nível Controller, aplicado por handler. Grid `/cooperativas` permanece `@Roles(SUPER_ADMIN)`. Detalhe `/cooperativas/:id/usinas` virou `@Roles(SUPER_ADMIN, ADMIN)`.
- `admin-proprietarios.service.ts`: método `listarUsinasPorCooperativa` agora aceita `user` como 2º arg. Multi-tenant guard: `if user.perfil !== 'SUPER_ADMIN' && user.cooperativaId !== cooperativaId` → `ForbiddenException`.
- **3 specs novos:** SUPER_ADMIN qualquer coop / ADMIN sua propria / ADMIN alheia=403.

**Frontend:**
- `web/app/dashboard/layout.tsx:152`: item sidebar condicional `['SUPER_ADMIN', 'ADMIN'].includes(perfil)`.
- `web/app/dashboard/proprietario/page.tsx`: useEffect detecta ADMIN → `router.replace('/dashboard/proprietario/${user.cooperativaId}')` (pula grid). SUPER_ADMIN continua vendo grid.
- `web/app/dashboard/proprietario/[cooperativaId]/page.tsx`: detecta ADMIN tentando ver coop alheia → redirect pra sua. Breadcrumb "Voltar pra Visão Hierárquica" oculto pra ADMIN (não tem pra onde voltar). Título adaptado "Portal Proprietário — [Nome Cooperativa]".

**Smoke 3/3 com JWT real:**
1. ADMIN → `/cooperativas` → 403 (SA-only ✅)
2. ADMIN → `/cooperativas/PROPRIA/usinas` → 200 ✅
3. ADMIN → `/cooperativas/ALHEIA/usinas` → 403 ✅

## Bugs resolvidos / catalogados na sessão

| # | Severidade | Resolução |
|---|---|---|
| D-novo-AQ (sidebar genérico) | P2 | ✅ resolvido em M32 (`89636be`) |
| D-novo-AR (KPIs zerados) | P1 | ✅ resolvido em M32 (`79ba324`) — causa raiz build stale |
| D-novo-BD (tabela overflow) | P2 | ✅ resolvido em M33 |
| D-novo-AS (gap tsc vs next build) | P2 | 📋 catalogado em M32 — diretriz aplicada em M33 |
| D-novo-AZ (Classe GD cadastro) | P1 | 📋 Sub-Sprint Refinamento Telas Usinas (próximo) |
| D-novo-BA (auditar classeGdAnotada existente) | P2 | 📋 depende AZ |
| D-novo-BB (editar usina como drawer) | P1 | 📋 viola Padrão UX Dual 17/05 |
| D-novo-BC (paridade campos edição vs cadastro) | P2 | 📋 depende BB |

## Validação final

- `nest build` ✓ + artifacts em `dist/src/admin/proprietarios/`
- `npm run build` web ✓ 140 páginas (D-novo-AS aplicada 2x na sessão)
- PM2 backend + frontend online
- 17/17 specs AdminProprietariosService verdes (incluindo 3 novos guards ADMIN)
- 4/4 specs bypass impersonate verdes
- Smoke F.5a: 5/5 verde (com JWT real SA + ADMIN)
- Smoke M33 Etapa B: 3/3 verde (ADMIN guards)

## Constraints respeitadas

- ✅ TDD: specs primeiro (19 + 3 novos)
- ✅ Multi-tenant: ADMIN só sua coop (backend ForbiddenException + frontend redirect)
- ✅ LGPD: email mascarado vem do backend, frontend NÃO desmascara
- ✅ Help inline em CADA tela (banner azul Info — regra 19/05)
- ✅ Loading + empty + error states em todas as 3 telas novas
- ✅ npm run build OBRIGATÓRIO (D-novo-AS — diretriz nova M32)
- ✅ Audit log estruturado `[IMPERSONATE_PROPRIETARIO]` (D-30N inativo, é wireup quando reativar)
- ✅ Sem force push, commits incrementais em português

## Próximo passo — Sub-Sprint Refinamento Telas Usinas (~4-7h)

Empacotará 4 débitos AZ + BA + BB + BC. Orquestrador define ordem após OK Luciano:

1. **D-novo-AZ** — Campo Classe GD na tela `/dashboard/usinas/nova` (~30-45min)
   - Input + persistência apenas. ZERO lógica Fio B.
2. **D-novo-BA** — Script auditar usinas existentes pra preencher `classeGdAnotada` (~30min Code + ~1h Luciano)
3. **D-novo-BB** — Refator tela edição: Sheet/drawer → página própria `/dashboard/usinas/[id]/editar` (~1.5-2h)
4. **D-novo-BC** — Paridade de campos edição vs cadastro (~1.5-2h, após BB)

## Frentes operacionais Luciano (acumulado)

- ⏳ Preencher cooperebr1 real (proprietarioEmail real, formaPagamentoDono, etc — F.4 smoke produção)
- ⏳ Cadastrar Usuario E-Solares real (manual OU magic link)
- ⏳ Definir matriz responsabilidadeDespesas
- ⏳ Definir valorKwhPadrao OU TarifaConcessionaria EDP_ES
- ⏳ Auditar classeGdAnotada por usina existente (D-novo-BA, depende D-novo-AZ)
- ⏳ Decidir política anti-spam pro cron PDF (D-novo-AO)
- ⏳ D-novo-AK gerenciador de senhas
- ⏳ Avisar time legado / script.sql / .pfx sandbox Banestes

## Carry-overs (não-bloqueantes)

- F.4 smoke produção (~1-2h) — bloqueado pelo Luciano operacional
- Sub-Sprint B (ETL legado→novo) — bloqueado pelo script.sql da hb06a
- Sub-Sprint Refinamento Telas Usinas (4-7h) — AZ + BA + BB + BC
- D-novo-AL/AM/AN/AO: integração iSolar E2E, Empresa entidade separada, RepasseProprietario tabela, cron PDF email
- D-novo-AJ.1: rotação ASAAS_ENCRYPT_KEY anual (próxima 2027-05-26)

## Frase comandante

Próxima sessão Code abre verificando se Luciano (a) preencheu cooperebr1 pra F.4 smoke produção real, OU (b) autorizou Sub-Sprint Refinamento Telas Usinas (D-novo-AZ+BA+BB+BC). Se nenhum estiver pronto, oferecer frentes paralelas (Sungrow E2E real depende credenciais, D-novo-AK gerenciador senhas operacional).
