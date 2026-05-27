# M33 + M34 — Sub-Sprint F.5 + F.6 Dashboard Hierárquico Cards Proprietário

> Sessão: 27-28/05/2026 (extensão M32 → M33 → M34 mesma janela Code).
> Marco consolidado: **Portal Proprietário admin hierárquico FUNCIONAL** com N1 (cooperativas) → N2 (cards proprietários) → N3 (cards usinas com tabs) → N4 (admin existente). Impersonate completamente removido. 5 críticas Luciano respondidas. Bug duplo-encode Next.js 16 resolvido (lição arquitetural).

## TL;DR

Demo do Sub-Sprint F MVP+ (M30+M31) expôs Portal Proprietário do owner real funcional, MAS o lado admin/super-admin do `/dashboard/proprietario` mostrava apenas "Nenhuma usina vinculada". M33 entregou primeira iteração hierárquica (grid cooperativas → tabela usinas + impersonate). Luciano testou e levantou 5 críticas estruturais — M34 reformulou completamente: tabela vira **cards por proprietário**, impersonate removido inteiro, admin parceiro pula grid e vai direto pra sua tabela, card SEM_PROPRIETARIO destacado pra órfãs, tabs Usinas/Carregadores prepara expansão futura. 8 commits em 2 dias entre M33 e M34. Bug pós-deploy D-novo-BF revelou comportamento Next.js 16 `useParams` (RAW encoded — não decoda) — fix 1 linha após Fase 1 read-only de 15min.

## Marco entregue

- **M33** — Sub-Sprint F.5 Dashboard Hierárquico Super Admin (grid + tabela + impersonate, depois revisado)
- **M34** — Sub-Sprint F.6 Reformulação Hierárquica Cards (cards proprietário + cards usina + tabs + impersonate removido) + fix D-novo-BF

## Commits do dia (8)

| Hash | Marco | Mensagem |
|---|---|---|
| `c21fc1c` | M33 F.5a | backend dashboard hierárquico Super Admin (2 endpoints + bypass impersonate + 19 specs) |
| `bc62ccd` | M33 F.5b | frontend grid cards + tabela usinas + banner impersonate |
| `b25c945` | M33 Etapas A+B | fix D-novo-BD overflow tabela + Admin Parceiro acessa (reversão decisão #4) |
| `c76542e` | M33 catálogo | catalogar D-novo-AZ + BA + BB + BC pendentes pra Sub-Sprint Refinamento Telas Usinas |
| `485a986` | M33 fechamento | docs sessão M33 + frase retomada |
| `d1b8228` | M34 F.6a | backend refactor N2 cards proprietário + N3 cards usinas + remover impersonate |
| `6610da4` | M34 F.6b | frontend Tabs custom + N2 cards proprietários + N3 cards usinas + cleanup impersonate |
| `e316a5b` | M34 fix BF | fix D-novo-BF duplo encode propId (Next.js 16 useParams RAW encoded) |

## Cronologia (27-28/05)

**27/05 manhã (M32, fechado pré-M33):** demo Portal Proprietário expôs 3 bugs visuais — D-novo-AQ sidebar genérica (P2), D-novo-AR KPIs zerados (P1, causa raiz build estático stale + 3 erros TS pré-existentes que tsc deixou passar), D-novo-AS gap pipeline (diretriz nova: `cd web && npm run build` antes de fechar marco que toca web/).

**27/05 noite (M33):** Luciano pediu reformular `/dashboard/proprietario` em visão hierárquica. F.5a backend criou módulo `admin/proprietarios/` com 2 endpoints (grid cooperativas + tabela usinas) + bypass impersonate via `?impersonate=true` + 19 specs. F.5b frontend entregou grid responsivo + nova rota tabela + banner azul Shield impersonate + sidebar conditional. Fix D-novo-BD overflow tabela + reversão decisão #4 (Admin Parceiro também acessa).

**28/05 manhã (M34 F.6):** Luciano testou M33 e levantou 5 críticas estruturais:
1. Tabela ficou ruim de ler com 7 colunas
2. "NAO CONVIDADO" pra órfã é confuso (na verdade são usinas sem proprietário, não convidados pendentes)
3. Impersonate não gostou — não quer essa abstração no sistema
4. Admin Parceiro também precisa da visão (mas só sua cooperativa)
5. BUG: Admin Parceiro click no botão "Impersonar" dava erro

Fase 1 read-only mini (~30min) propôs reformulação total. F.6a backend refatorou `listarUsinasPorCooperativa` virando `listarProprietariosPorCooperativa` agregado por chave de dedupe (`c-cooperadoId` | `e-email.toLowerCase()` | `SEM_PROPRIETARIO`) + criou endpoint N3 dedicado `/proprietarios/:propId/usinas` + removeu impersonate inteiro do backend (3 arquivos + 4 specs).

F.6b frontend implementou Tabs custom (sem Shadcn pra evitar conflito Base UI/Radix do M32) + refatorou N2 page.tsx em grid de cards proprietários (com SEM_PROPRIETARIO destacado border-dashed laranja) + nova rota N3 `[proprietarioId]/page.tsx` com tabs Usinas/Carregadores (Em breve) + cleanup impersonate frontend (banner Shield, useSearchParams, botões).

**28/05 noite (M34 fix BF):** Smoke visual revelou N3 mostrando vazio mesmo com backend retornando dados via curl. Fase 1 mini com diag de 3 cenários confirmou: Next.js 16 `useParams` retorna params **RAW encoded** (mantém `%40`), não decoda automaticamente. Frontend re-encodava → duplo encode → backend recebia `%2540` → `parsePropId` retornava email com `%40` literal → match falhava. Fix: 1 linha removendo `encodeURIComponent` redundante.

## Entregas por sub-fatia

### M33 F.5a Backend (`c21fc1c`)

- Módulo novo `backend/src/admin/proprietarios/` (controller + service + module + spec)
- `GET /admin/proprietarios/cooperativas` (@Roles SUPER_ADMIN) — grid com 7 campos novos por cooperativa
- `GET /admin/proprietarios/cooperativas/:id/usinas` (SA + ADMIN sua coop) — tabela detalhada
- Bypass impersonate em `/proprietario/usinas/:id?impersonate=true` (SA only, audit log estruturado)
- 19 specs novos (15 service + 4 bypass)

### M33 F.5b Frontend (`bc62ccd`)

- Refactor `/dashboard/proprietario/page.tsx` em grid responsivo de cards cooperativa
- Nova rota `/dashboard/proprietario/[cooperativaId]/page.tsx` com tabela 7 colunas
- Banner azul Shield em `/proprietario/usinas/[id]?impersonate=true`
- Sidebar conditional SUPER_ADMIN
- Loading Skeleton + empty + error states

### M33 Etapas A+B (`b25c945`)

- Fix D-novo-BD: wrapper `<div overflow-x-auto>` + `<Table min-w-[900px]>`
- Reversão decisão #4: Admin Parceiro acessa Portal Proprietário (versão adaptada — pula grid, vai direto pra tabela da sua cooperativa)
- Multi-tenant guard backend (`ForbiddenException` ADMIN coop alheia)
- Frontend redirect ADMIN → sua coop; breadcrumb hierárquico oculto pra ADMIN

### M34 F.6a Backend (`d1b8228`)

- Refactor `listarUsinasPorCooperativa` → `listarProprietariosPorCooperativa` (shape `{cooperativa, proprietarios[]}` agregado por chave dedupe)
- Helpers compartilhados: `chaveProprietario` / `parsePropId` / `buscarUsinasComGeracoesAno` / `calcularYtdUsina` / `formatarContratoArrendamento` / `classificarStatus` / `assertAcessoCooperativa`
- Novo endpoint N3 `GET /cooperativas/:coopId/proprietarios/:propId/usinas`
- Bypass impersonate REMOVIDO (3 arquivos + 4 specs deletados)
- Campo `proprietarioEmailRaw` REMOVIDO (era pra impersonate, sem consumidores)
- 14 specs novos (agregação + N3 + multi-tenant)

### M34 F.6b Frontend (`6610da4`)

- Componente custom `web/components/ui/tabs-custom.tsx` (~80 linhas, sem Shadcn/Radix)
- Refactor N2 `[cooperativaId]/page.tsx` em grid de cards proprietários com SEM_PROPRIETARIO destacado (border-dashed laranja)
- Nova rota N3 `[cooperativaId]/[proprietarioId]/page.tsx` com header adaptativo + TabsCustom Usinas/Carregadores + cards usina + botão "Cadastrar proprietário" pra órfãs
- Cleanup impersonate em `/proprietario/usinas/[id]/page.tsx` (banner Shield, useSearchParams, botões)
- Grep `impersonate` em `web/`: zero código vivo, único hit é comentário documental

### M34 fix D-novo-BF (`e316a5b`)

- Causa raiz: Next.js 16 `useParams` retorna params RAW encoded (mantém `%40`) — comportamento documentado errado no código original
- Fix 1 linha em `web/app/dashboard/proprietario/[cooperativaId]/[proprietarioId]/page.tsx:141` — removido `encodeURIComponent` redundante
- Comentários :107 e :137 atualizados pra refletir comportamento real Next.js 16

## 5 críticas Luciano respondidas

| # | Crítica | Resposta |
|---|---|---|
| 1 | Tabela 7 colunas ficou ruim | M34: cards 1/2/3 por proprietário (mais agrupado, scan rápido) |
| 2 | "NAO CONVIDADO" pra órfã confuso | M34: card SEM_PROPRIETARIO destacado border-dashed laranja, separado dos com convite |
| 3 | Impersonate não gostei | M34: removido completamente (backend + frontend + specs + URLs) |
| 4 | Admin Parceiro tabela quebrava | M33 Etapa B + M34: cards + redirect ADMIN→sua coop (pula grid) |
| 5 | BUG admin parceiro click → erro | Resolvido naturalmente sem impersonate (não há mais URL passando `?impersonate=true&cooperativaId=`) |

## Hierarquia final entregue

```
N1: /dashboard/proprietario                                    SA only
    └─→ grid cards COOPERATIVAS (M33, intacto)
N2: /dashboard/proprietario/[cooperativaId]                    SA + ADMIN (sua)
    └─→ grid cards PROPRIETÁRIOS agregados por chave dedupe
        + card SEM_PROPRIETARIO destacado laranja
N3: /dashboard/proprietario/[cooperativaId]/[proprietarioId]   SA + ADMIN
    ├─→ Tab Usinas (ativa): grid cards USINAS desse proprietário
    │   • Caminho B/A: link → N4
    │   • SEM_PROPRIETARIO: + botão "Cadastrar proprietário"
    └─→ Tab Carregadores (disabled "Em breve"): placeholder didático
N4: /dashboard/usinas/[id]                                     existente M30/M31
    └─→ admin de usina (sem mudanças)

Acesso proprietário REAL logado:
/proprietario (M30) → /proprietario/usinas/[id] → independente da hierarquia admin
```

## Bugs resolvidos / catalogados

| # | Severidade | Causa | Status |
|---|---|---|---|
| D-novo-AQ | P2 | sidebar hardcoded | ✅ resolvido M32 (`89636be`) |
| D-novo-AR | P1 | build estático stale + 3 erros TS pré-existentes | ✅ resolvido M32 (`79ba324`) |
| D-novo-AS | P2 | gap tsc vs Turbopack | 📋 catalogado, diretriz aplicada M33+M34 |
| D-novo-BD | P2 | tabela overflow horizontal | ✅ resolvido M33 (`b25c945`) |
| D-novo-AZ | P1 | campo Classe GD ausente cadastro | 📋 Sub-Sprint Refinamento Telas Usinas |
| D-novo-BA | P2 | auditar classeGdAnotada existente | 📋 depende AZ |
| D-novo-BB | P1 | tela edição como drawer (viola Padrão UX Dual) | 📋 Sub-Sprint Refinamento Telas Usinas |
| D-novo-BC | P2 | paridade campos edição vs cadastro | 📋 depende BB |
| D-novo-BE | P3 | nome divergente mesmo email | 📋 workaround `updatedAt desc` aplicado, solução ideal entidade Empresa |
| D-novo-BF | P1 | duplo encode propId (Next.js 16 useParams RAW) | ✅ resolvido M34 (`e316a5b`) |

## Validação smoke (Luciano OK 10/10)

1. ✅ SA logado → N1 grid 3 cooperativas
2. ✅ Click CoopereBR → N2 4 cards (3 proprietários alfabético + SEM_PROPRIETARIO último destacado)
3. ✅ Click ESOLARES → N3 header "ESOLARES PF + de***@example.com" + tab Usinas
4. ✅ Tab Usinas: card "COOPERE BR - Usina Linhares" FIXO R$ 1.000 OPERANDO YTD R$ 4.000
5. ✅ Click no card usina → N4 admin existente
6. ✅ Click Energia Verde Ltda → N3 mostra dados dela
7. ✅ Click SEM_PROPRIETARIO → N3 header laranja + 4 cards de usinas órfãs com botão "Cadastrar proprietário"
8. ✅ Tab Carregadores → disabled + badge "Em breve"
9. ✅ ADMIN CoopereBR → entra direto em N2 (pula N1)
10. ✅ ADMIN tentando outra cooperativa → redirect pra sua

## Lição arquitetural — Next.js 16 useParams

`useParams()` retorna params **RAW encoded** (mantém `%40`, `%2F` etc) — **NÃO decoda automaticamente** como em algumas versões anteriores. Comportamento documentado errado no código F.6b original ("Next.js já decoda params automaticamente"). Fix em D-novo-BF tirou o encode redundante.

**Padrão pra rotas dinâmicas com chars especiais no Next.js 16:**
- Ao navegar: `encodeURIComponent(valor)` no `router.push` (browser usa URL bem formada)
- Ao consumir no client: passar `params.x` direto pro axios (já vem encoded)
- Backend: Express decoda 1x automaticamente

## Decisões estratégicas catalogadas

- **Tabs custom (não Shadcn)** — evita conflito Base UI vs Radix descoberto no M32. Componente leve `web/components/ui/tabs-custom.tsx` 80 linhas.
- **Chave de dedupe proprietário** — 3 caminhos cobertos: cooperadoId / email.toLowerCase() / SEM_PROPRIETARIO. Email case-insensitive resolve cadastro inconsistente CSV/manual.
- **Nome divergente em mesmo email** — workaround `updatedAt desc`, D-novo-BE catalogado pra solução ideal futura (entidade Empresa).
- **Impersonate vs hierarquia de cards** — Luciano prefere navegação por contexto explícito (cards) em vez de "modo super admin" com bypass. Decisão arquitetural: zero bypass de guards.
- **propId URL-encoded no path** — formato `e-<email URL-encoded>` funciona end-to-end (browser → Next.js → axios → Express → backend). Documentado.

## Próximo passo

**Sub-Sprint Refinamento Telas Usinas** — 4 débitos catalogados em `c76542e`:
- **D-novo-AZ** (P1): campo Classe GD (GD_I/GD_II/GD_III) na `/dashboard/usinas/nova` + edição. **SÓ REGISTRO, ZERO lógica Fio B** (essa vem no Sub-Sprint Fio B futuro)
- **D-novo-BA** (P2): script auditar usinas existentes pra preencher `classeGdAnotada` (depende AZ + planilha Luciano)
- **D-novo-BB** (P1): tela edição usina como drawer → página própria `/dashboard/usinas/[id]/editar` (viola Padrão UX Dual 17/05)
- **D-novo-BC** (P2): paridade campos edição vs cadastro novo (depende BB)

**Estimativa:** ~4-7h Code, possivelmente 2 sessões. Orquestrador empacota Fase 1 read-only mini quando Luciano der OK.

## Pré-requisitos leitura próxima sessão

- `docs/debitos-tecnicos.md` entries D-novo-AZ a BC + BE + BF (todas catalogadas)
- `backend/prisma/schema.prisma:337-389` (Usina model com `classeGdAnotada` já existente)
- Memória `padrao_ux_edicao_inline_vs_pagina_propria_17_05.md` (Padrão Dual)
- `web/app/dashboard/usinas/nova/page.tsx` (referência cadastro)
- Tela edição atual de usina (verificar se ainda é drawer/Sheet)

## Carry-overs humanos Luciano (preservar)

- ⏳ **PRIORITÁRIO:** Preencher cooperebr1 real (proprietarioEmail + formaPagamentoDono + valorAluguelFixo + matriz responsabilidadeDespesas + valorKwhPadrao OU TarifaConcessionaria EDP_ES) — libera F.4 smoke produção
- ⏳ Cadastrar Usuario E-Solares real (manual OU magic link)
- ⏳ Auditar `classeGdAnotada` por usina (D-novo-BA, depende AZ)
- ⏳ Decidir política anti-spam cron PDF (D-novo-AO)
- ⏳ Obter credenciais Sungrow/iSolar Cloud com E-Solares
- ⏳ Avisar time legado: 5 .pfx vazados + senha Azure SQL + webhook sem validação
- ⏳ Obter `script.sql` do hb06a (libera Sub-Sprint B ETL)
- ⏳ Obter `.pfx` sandbox Banestes (libera Carolina pagar PIX real)
- ⏳ Decisões regulatórias Sub-Sprint A (advogado)
- ⏳ Instalar Bitwarden/KeePassXC (D-novo-AK, 1-2 sem)

## Carry-overs técnicos (não-bloqueantes)

- D-novo-AL: integração iSolar Cloud E2E real
- D-novo-AM: Empresa entidade separada (YAGNI até 2ª usina E-Solares)
- D-novo-AN: RepasseProprietario tabela pra pagamento REAL
- D-novo-AO: cron PDF conectar EmailService
- D-novo-AS.1/.2: hook PostToolUse `npm run build` automático
- D-novo-BE: nome divergente mesmo email (workaround aplicado, solução ideal entidade Empresa)
- D-novo-J + K: 11 falhas pré-existentes Jest cooperados/usinas controllers (fora do escopo)
- D-novo-AJ.1: rotação ASAAS_ENCRYPT_KEY anual (próxima 2027-05-26)

## Regras aplicadas na sessão

- ✅ Decisão 23: Fase 1 read-only mini em 2 momentos (F.6 inicial + investigação D-novo-BF)
- ✅ Decisão 24: frase de retomada em local único (`CONTROLE-EXECUCAO.md`)
- ✅ D-novo-AS: `cd web && npm run build` antes de fechar marco que toca `web/` (aplicada 4x: M32 + M33 F.5b + M34 F.6b + M34 fix BF)
- ✅ TDD: 14 specs novos AdminProprietariosService + 4 specs impersonate REMOVIDOS pelo F.6a
- ✅ Multi-tenant: SA global, ADMIN sua coop, alheia 403 (backend + frontend)
- ✅ LGPD: email mascarado vem do backend, frontend NÃO desmascara
- ✅ Padrão UX 19/05: help inline em cada tela
- ✅ regra 13/05: fechamento canônico bilateral inegociável

## Frase comandante

Próxima sessão Code abre verificando se Luciano (a) preencheu cooperebr1 pra F.4 smoke produção real, OU (b) autorizou Sub-Sprint Refinamento Telas Usinas (D-novo-AZ+BA+BB+BC). Se nenhum estiver pronto, oferecer frentes paralelas (Sungrow E2E real depende credenciais, D-novo-AK gerenciador senhas operacional, decisões regulatórias Sub-Sprint A).
