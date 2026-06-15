# Sprint Higiene de Rotas — Blocos A→E COMPLETO + D-1171 fechado — 14/06/2026

## TL;DR

Sessão Code fechou o **Sprint Higiene de Rotas** ponta-a-ponta em 4 commits trabalho + 1 commit débito + 1 merge (6 commits total no main, `f85483f`). Convergência `/parceiro/*` → `/dashboard/*` finalizada (19 telas-fantasma deletadas + 33 redirects 301 `permanent:true` em `next.config.ts`). Área nova `/estabelecimento/*` criada (3 telas movidas com layout próprio + guard `ehEstabelecimento` no layout). Operação admin "Enviar Tokens" reposicionada em `/dashboard/cooper-token/enviar` (card no hub `/dashboard/clube`). Header de tenant renomeado pra distinguir super-admin (`Painel do Tenant — {nome}`) de admin do parceiro (`Painel Administrativo — {nome}`). P1 anti-IDOR aplicado em `meuPerfil` (filtro `cooperativaId` no `OR email/CPF` — o campo `ehEstabelecimento` lido desse perfil arma o guard da área nova, não pode resolver tenant errado). Reviewer `cooperebr-multitenant-reviewer` rodou em 2 rodadas (Bloco A + Bloco B+C+D); smoke validou os 7 redirects relevantes (308 = permanent equivalent) e a permissão de `admin_parceiro` (sidebar sem "Gestão Global", header correto). **D-1171 (decisão de convergência de portais) FECHADO.** Sessão paralela Cowork/M36 também foi mergeada no main como carona (pertencia ao main, vai junto) — ressalva D-novo-EMAIL-IMAP-SSL-VERIFY P2 catalogada antes do merge.

## Marco entregue

**M37 — Sprint Higiene de Rotas COMPLETO (D-1171 fechado)** + carona M36 (Cowork — Pipeline IMAP→OCR + Concierge EDP_ES/CEMIG-MG)

## Commits do dia (6 — sendo 4 meus + 2 carona Cowork)

| Hash | Mensagem | Autor |
|---|---|---|
| `03682ea` | refactor(web): higiene Bloco A — convergência /parceiro → /dashboard (Decisões D1+D3) | Code/Higiene |
| `be8e46e` | fix(email-monitor): SSL workaround Kaspersky destrava pipeline IMAP | Cowork/M36 (carona) |
| `75c7e9f` | docs(sessao+concierge): fechamento 14/06 + caso Luciano EDP_ES + modelo CEMIG/MG | Cowork/M36 (carona) |
| `383d511` | feat(higiene-rotas): Bloco B+C+D+E — área /estabelecimento + Enviar Tokens dashboard + labels + multi-tenant fix | Code/Higiene |
| `62775f2` | feat(higiene-rotas): adiciona /dashboard/cooper-token/enviar (faltou no commit anterior) | Code/Higiene |
| `42718a6` | docs(debitos): cataloga D-novo-EMAIL-IMAP-SSL-VERIFY P2 (orquestrador) | Code/Higiene |
| `f85483f` | merge: feature/higiene-rotas → main (Sprint Higiene Rotas D-1171 fechado + carona M36) | Code (merge) |

Range completo: `20eff4e..f85483f` (anterior `20eff4e` era o P0 Santi mergeado antes desta sessão).

## Entregas técnicas

### Bloco A — Convergência `/parceiro/*` → `/dashboard/*` (D1 + D3)

- `web/hooks/useContexto.ts`: `rotaPorContexto.admin_parceiro` agora retorna `/dashboard` (era `/parceiro`).
- `web/app/dashboard/layout.tsx`: header passa a mostrar `"Painel Administrativo"` + `cooperativaNome` quando `perfil === 'ADMIN'` (D3).
- 19 telas-fantasma em `/parceiro/*` deletadas (eram re-exports ou redirects internos que sobreviveram a refators anteriores).
- `web/next.config.ts`: 27 redirects 301 `permanent: true` inclusos no commit A cobrindo as mesma-slug + renames (`/parceiro/convites → /dashboard/convites-pessoas`, `/parceiro/agregadores → /dashboard/administradoras`, `/parceiro/configuracoes → /dashboard/configuracoes`, `/parceiro → /dashboard`, etc.).

### Bloco B — Área nova `/estabelecimento/*` (D2)

- `web/app/estabelecimento/layout.tsx` (215 linhas): layout próprio com tema laranja + sidebar `<Store />` + 3 nav items (Receber pagamento, Recebimentos, Validar resgate). Guard cliente via `api.get('/cooperados/meu-perfil')` → se `!perfil?.ehEstabelecimento` mostra empty-state amber explicativo (sem 401 cego).
- `web/app/estabelecimento/page.tsx`: redirect simples pra `/estabelecimento/receber`.
- 3 páginas movidas (mesmo conteúdo, novo caminho):
  - `/parceiro/receber-tokens` → `/estabelecimento/receber`
  - `/parceiro/tokens-recebidos` → `/estabelecimento/recebimentos`
  - `/parceiro/clube/validar` → `/estabelecimento/validar`
- `web/middleware.ts`: branch `/estabelecimento/:path*` exige token (guard de papel fica no layout, não no middleware).
- `web/app/portal/page.tsx`: card novo "Entrar no Balcão do Clube" (laranja, `<Store />`) renderizado condicional `meuPerfil?.ehEstabelecimento`.
- 3 redirects 301 novos em `next.config.ts`.

### Bloco C — Operação admin "Enviar Tokens" no hub Clube

- `web/app/parceiro/enviar-tokens/page.tsx` → `web/app/dashboard/cooper-token/enviar/page.tsx` (operação admin de crédito manual de CooperTokens).
- `web/app/dashboard/clube/page.tsx`: card novo "Enviar Tokens" no hub (12º card).
- 1 redirect 301 novo em `next.config.ts`.

### Bloco D — Labels + docs (fecha D-1171)

- `web/app/dashboard/parceiros/[id]/page.tsx`: header de `"Painel do Parceiro"` → `"Painel do Tenant — {cooperativa.nome}"`. Distingue **super-admin vendo um tenant específico** (esta tela) do **admin do tenant vendo o próprio dashboard** (`/dashboard` com `"Painel Administrativo — {cooperativaNome}"`).
- `CLAUDE.md`: seção nova **"Arquitetura de rotas (Sprint Higiene 14/06/2026 — D-1171 fechado)"** com tabela completa de rotas por contexto JWT + decisões D1-D4 consolidadas + glossário travado (PARCEIRO/ADMIN DO PARCEIRO/ESTABELECIMENTO).
- `docs/PRODUTO.md`: persona Marcos atualizada pra mencionar `/dashboard` como rota de acesso (era `/parceiro`).

### Bloco E — Multi-tenant review + smoke + merge

**Reviewer `cooperebr-multitenant-reviewer` rodou em 2 rodadas:**

1. **Bloco A:** zero P0/P1, aprovado com check inline (Luciano confirmou redirects renomeados corretos + `Gestão Global` super-admin-only).
2. **Bloco B+C+D:** flagou 2 P1 — fix abaixo + análise.

**P1 #1 (FIXADO):** `backend/src/cooperados/cooperados.service.ts:46` — `meuPerfil` fazia `findFirst({ where: { OR: [{ email }, { cpf }] } })` sem `cooperativaId`. Em sistema multi-cooperativa, `OR email/CPF` poderia resolver cooperado de outro tenant se o mesmo CPF aparecer em duas cooperativas (Luciano em CoopereBR + outra coop teste, por exemplo). O campo `ehEstabelecimento` lido desse perfil é exatamente o que arma o guard do `/estabelecimento/layout.tsx` — então resolver tenant errado libera área errada.

Fix aplicado:
```ts
const filtroTenant = usuario.cooperativaId
  ? { AND: [{ cooperativaId: usuario.cooperativaId }, { OR: where }] }
  : { OR: where };
const cooperado = await this.prisma.cooperado.findFirst({ where: filtroTenant, include: { /* ... */ } });
```
Comportamento preservado em fluxos públicos legados (sem JWT) por compatibilidade. JWT autenticado sempre tem `cooperativaId` → sempre filtra por tenant.

**P1 #2 (ANÁLISE, não-bloqueante):** os 3 endpoints das sub-páginas de `/estabelecimento`:
- `/cooper-token/processar-pagamento-qr` — intencionalmente aberto a `COOPERADO, ADMIN, SUPER_ADMIN, OPERADOR` porque é P2P legítimo (cooperado→cooperado), não estabelecimento-exclusivo. Adicionar guard `ehEstabelecimento` quebraria o caso de uso.
- `/clube-vantagens/validar-resgate` — já restrito `SUPER_ADMIN, ADMIN`. (Observação: estabelecimento cooperado regular não consegue acessar via API — só vê a tela. Pode virar débito futuro pra ampliar.)
- `/cooper-token/admin/historico-parceiro` — endpoint **inexistente** (404 pré-existente, catch silencia, mostra empty-state). Sprint não introduziu, mas catalogar como débito faz sentido pra próxima sessão Cowork ou sprint dedicada.

Conclusão: o sprint só moveu páginas frontend, **nenhum endpoint backend foi introduzido**. Guards pré-existentes permanecem apropriados pra cada endpoint.

**Smoke validations rodadas:**

1. **4 redirects de rename (HTTP 308 = permanent equivalent):**
   ```
   /parceiro/convites      → /dashboard/convites-pessoas   ✅
   /parceiro/configuracoes → /dashboard/configuracoes      ✅
   /parceiro/agregadores   → /dashboard/administradoras    ✅
   /parceiro               → /dashboard                    ✅
   ```
2. **3 redirects extras testados:**
   ```
   /parceiro/enviar-tokens  → /dashboard/cooper-token/enviar  ✅
   /parceiro/receber-tokens → /estabelecimento/receber        ✅
   /parceiro/cobrancas      → /dashboard/cobrancas            ✅
   ```
3. **Permissões admin_parceiro:**
   - `getNavSections('ADMIN')` não retorna a seção "Gestão Global" (line 200-201 de `web/app/dashboard/layout.tsx` gate explícito por `perfil === 'SUPER_ADMIN'`).
   - Header mostra `"Painel Administrativo"` + cooperativaNome (line 352-361).
4. **Backend rebuild OK** após fix P1 (nest build clean).
5. **Frontend rebuild OK** (`✓ Compiled successfully in 15.4s`, 139 páginas geradas), restart PM2 `cooperebr-frontend` OK (HTTP 200 em `/login`).

### Carona Cowork/M36 (mergeada junto, ressalva catalogada)

Branch `feature/higiene-rotas` foi criada a partir do `20eff4e` (P0 Santi) ANTES da sessão Cowork. Quando Cowork pushou seus commits (`be8e46e` + `75c7e9f`), a feature branch já tinha ancestralidade compartilhada — o merge `--no-ff` levou os 2 commits Cowork pro main junto com os 4 da Higiene. Isso é correto: os commits pertencem ao main, só pegaram carona.

- `be8e46e` fix(email-monitor): patch SSL workaround Kaspersky (`tls.rejectUnauthorized: false`) que destravou pipeline IMAP→OCR depois de 6 meses parado. **Ressalva D-novo-EMAIL-IMAP-SSL-VERIFY P2 catalogada** antes do merge (commit `42718a6`) — flag é **incondicional**, precisa ser gated por env ou substituída por cert próprio ANTES de qualquer deploy de produção (risco MITM no IMAP).
- `75c7e9f` docs: fechamento M36 + caso Luciano Concierge EDP_ES (UC 0.001.421.380.054-70, indébito estimado ~R$ 154/mês ou ~R$ 11.340 em 60m+SELIC) + modelo CEMIG/MG (caso Marco Aurelio, Aimorés/MG, conformidade nas 3 teses majoritárias — potencial Concierge BAIXO). Detalhe Cowork: `docs/sessoes/2026-06-14-pipeline-ocr-destravado-e-caso-luciano.md`.

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| P1 #1 | P1 | `meuPerfil` `findFirst` sem `cooperativaId` no OR email/CPF | `AND cooperativaId + OR email/CPF` | RESOLVIDO `383d511` |
| P1 #2 | P1 | Análise reviewer sobre guards backend dos 3 endpoints `/estabelecimento` | Documentado no commit — guards pré-existentes apropriados, sprint não introduziu endpoint | CATALOGADO (não-bloqueante) |
| D-novo-EMAIL-IMAP-SSL-VERIFY | P2 | `tls.rejectUnauthorized: false` incondicional no IMAP (commit Cowork `be8e46e`) | Ressalva catalogada em `docs/debitos-tecnicos.md` — gate por env OU cert próprio ANTES de prod | CATALOGADO `42718a6` |

## Decisões estratégicas catalogadas

Nenhuma decisão nova catalogada nesta sessão — D1+D2+D3+D4 já estavam consolidadas em sessões anteriores. A sessão executou. Carry-over do Bloco D fixou as decisões no CLAUDE.md (seção "Arquitetura de rotas") como fonte de verdade visível pra próximas sessões.

## Próximo passo

**Fatia A v2 — CTK → CooperToken nomenclatura UI** em branch NOVA `feature/fatia-a-v2`.

**Correção pós-fechamento (orquestrador):** existe `feature/fatia-a` antiga (commits `52d9b38` nomenclatura + `84021b7` botões Voltar ao Clube em 10 telas) feita ANTES desta sessão de Higiene. Como a Higiene moveu/deletou os arquivos que ela editou, a branch ficou **STALE — não mergeável**:
- `git diff main..feature/fatia-a --stat` mostra 76 arquivos em modify/delete; mergear ressuscitaria `web/app/parceiro/layout.tsx` + `parceiro/page.tsx` + 20 sub-rotas como **zumbis**.
- Os 12 `\bCTK\b` que ela tinha eliminado **voltaram pro main** em 6 arquivos: `web/app/conveniada/convenio/[id]/distribuir-tokens/page.tsx` (3) + `estabelecimento/receber/page.tsx` (3) + `estabelecimento/recebimentos/page.tsx` (1) + `estabelecimento/validar/page.tsx` (1) + `dashboard/cooper-token/enviar/page.tsx` (3) + `dashboard/cooper-token-parceiro/page.tsx` (1) — confirmado via grep no fechamento.

**Plano Fatia A v2:**
1. Branch nova `feature/fatia-a-v2` como 1º comando.
2. Usar `git show feature/fatia-a -- '*.tsx'` como **referência exata das substituições** — mesmas strings, arquivos novos.
3. Aplicar nos 6 arquivos atuais (12 ocorrências mapeadas).
4. Refazer botões "Voltar ao Clube" SÓ nas telas que sobreviveram à Higiene (conferir cada uma das 10 de `84021b7` — algumas mudaram de caminho ou foram deletadas).
5. Re-catalogar **D-novo-CTK-VALOR-HARDCODE-EXTRATO P3** em `docs/debitos-tecnicos.md` (existe no commit stale `52d9b38`, não está no main).
6. TS check + lint + build limpos.
7. Smoke Luciano.
8. **Mergear LOGO após OK** — não repetir o erro de deixar parado.
9. `git branch -D feature/fatia-a` (descarta a stale).

**Lição (catalogada como diretriz da Fatia A v2):** não deixar branch pronta parada atravessando refactor estrutural. Mergear na hora OU rebasear antes que envelheça. Fatia A v1 parou 14h e ficou inutilizável.

## Pré-requisitos leitura próxima sessão

1. `docs/CONTROLE-EXECUCAO.md` (seção `## ONDE PARAMOS` topo + frase de retomada).
2. `docs/sessoes/2026-06-14-higiene-rotas-blocos-B-E.md` (este arquivo).
3. `docs/sessoes/2026-06-14-pipeline-ocr-destravado-e-caso-luciano.md` (Cowork M36 — context só, não bloqueia).
4. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/sprint_clube_unificado_cooper_token_10_06.md` (Fatia A escopo + 7 fases).
5. `~/.claude/projects/.../memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md` (vocabulário inegociável: voucher / liquidação / recibo — NUNCA recompra/venda).
6. `CLAUDE.md` (especialmente seção nova "Arquitetura de rotas Sprint Higiene 14/06/2026").
7. `.claude/CLAUDE.md`.

## Carry-overs (não-bloqueantes)

- **D-novo-EMAIL-IMAP-SSL-VERIFY P2** (novo nesta sessão) — gate `tls.rejectUnauthorized` por env ANTES de deploy prod (responsabilidade Cowork).
- **D-1171 FECHADO** — não há mais convergência pendente entre `/parceiro` e `/dashboard`.
- **Cowork acumulou** working tree M de `backend/package.json` + `package-lock.json` + `concierge.service.spec.ts` (sessão dela em curso, NÃO TOCAR).
- **Carry-overs históricos M35** (ainda vivos): D-novo-F6-RECONCILIACAO-CRON P2, D-novo-MT-F2-F3-F4-LEGADO-UPDATE-COOPERADO P2, D-novo-F6-ADMIN-FLAG-ESTAB P2, D-novo-F4-PARCEIRO-TENANT-STEPUP P2, D-novo-F4-OTP-CANAL-ENTREGA P2, D-novo-F4-UI-COOPERADO-PEER P2 (Token-WA Fase 3 pausada), D-novo-OXIDACAO-* P2/P3, D-novo-WA-PHONE-NORMALIZE P2, D-novo-LEDGER-UNIQUE-CONSTRAINT P3, D-novo-CREDITO-PENDENTE-REPROCESSAMENTO P2, D-novo-F3-RACE-CONFIRMS-CONCORRENTES P3, D-novo-F3-INCONSISTENCIA-BANCO P3, D-novo-TAXA-TRANSFER-DESTINO P2, D-novo-TAXA-RESGATE-DESTINO P2.
- **Sprint Housekeeping** acumulado (untracked: `.agent/memory/`, `.claude/agents/`, `backend/scripts/audit-*` e similares, `docs/historico/dossie-edp-coop-2026-05-23/`, etc.) — não-bloqueante.

## Regras aplicadas na sessão

- **Boundary respeitada** — `backend/package.json`, `package-lock.json`, `concierge.service.spec.ts` (alheios Cowork) ficaram de fora dos commits Higiene.
- **Branch `feature/higiene-rotas` desde 1º commit** (Decisão Luciano 13/06 — fim do gate furado de push em sessões paralelas).
- **Merge `--no-ff`** preserva narrativa do sprint no `git log` (commit de merge `f85483f`).
- **Reviewer multitenant rodou ANTES do merge**, P1 corrigido ANTES do merge — não depois.
- **Smoke validations** (4 redirects de rename + 3 extras + permissões admin_parceiro) rodadas e documentadas neste relato.
- **Débito catalogado** (D-novo-EMAIL-IMAP-SSL-VERIFY P2) antes do merge — ressalva técnica da carona Cowork registrada em `docs/debitos-tecnicos.md`.
- **Fonte única** — frase de retomada atualizada SÓ em `docs/CONTROLE-EXECUCAO.md` (Decisão 24).

## Frase comandante

Apresentada no terminal no fim desta sessão. Persistida em:
- `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code`
- Este arquivo (próxima seção)

```
PASSO 0 — Verificações operacionais OBRIGATÓRIAS antes de qualquer leitura:

1. Confirmar que esta é NOVA conversa Code (não continuação de janela
   anterior). Verificar que subagent `cooperebr-qa-funcional` aparece
   na lista de agents. Se não aparecer, parar e avisar (sessão não
   indexou subagent project-specific).

2. Rodar `git status --short`. Esperado pós-fechamento M37: working
   tree limpo (untracked carry-overs catalogados + M de
   `backend/package.json` + `package-lock.json` + `concierge.service.
   spec.ts` — território Cowork, NÃO tocar). Último commit é o de
   fechamento M37. Rodar `git log origin/main..HEAD --oneline` —
   deve mostrar VAZIO (M37 foi pushed; Fatia A começa em branch nova
   `feature/fatia-a`, nada novo direto em main).

3. Rodar `pm2 list`. Esperado: cooperebr-backend + cooperebr-frontend
   + cooperebr-whatsapp online (3000/3001/3002 LISTENING). Frontend
   é `next start` sob PM2 (NÃO `next dev`) — toda mudança em web/
   exige `cd web ; npm run build ; pm2 restart cooperebr-frontend`.
   HMR NÃO ROLA.

4. ⚠️ CRIAR BRANCH FEATURE COMO 1º COMANDO DA SESSÃO (decisão Luciano
   13/06):
     git checkout -b feature/fatia-a
   Todos os commits da Fatia A ficam nessa branch. Merge→main só
   após review OK + smoke + autorização explícita Luciano.

PASSO 1 — Frase comandante M37 → Fatia A (CTK → CooperToken nomenclatura UI):

Sessão 14/06 noite entregou M37 em 6 commits no main
(20eff4e..f85483f, sendo 4 meus + 2 carona Cowork): Sprint Higiene
de Rotas COMPLETO (Blocos A+B+C+D+E), D-1171 fechado. /parceiro/*
convergido em /dashboard/* (19 telas-fantasma deletadas + 33
redirects 301), /estabelecimento/* nova área com guard
ehEstabelecimento, Enviar Tokens no /dashboard/clube hub, header
renomeado pra distinguir super-admin de admin do parceiro, P1 anti-
IDOR em `meuPerfil` (filtro cooperativaId no OR email/CPF). Carona
M36 do Cowork (pipeline IMAP→OCR destravado + caso Luciano Concierge
EDP_ES + modelo CEMIG/MG) entrou junto — ressalva D-novo-EMAIL-IMAP-
SSL-VERIFY P2 catalogada.

Detalhes em docs/sessoes/2026-06-14-higiene-rotas-blocos-B-E.md
(Higiene) + docs/sessoes/2026-06-14-pipeline-ocr-destravado-e-caso-
luciano.md (Cowork M36).

═══ PRÓXIMO BLOCO: Fatia A — CTK → CooperToken nomenclatura UI ═══

Escopo Fatia A (sprint_clube_unificado_cooper_token_10_06.md):
- Refator nomenclatura `CTK` → `CooperToken` em TODAS as superfícies
  UI (cards saldo, badges, tooltips, mensagens de erro, abreviações
  em tabelas, breadcrumbs).
- Dois rios kWh × token visivelmente separados na UI (energia ≠
  benefício — decisão circuito 04/06 ainda vigente).
- Sem mudança de schema — puro UI/labels. Tipos TS continuam usando
  `CooperToken` (já é o nome canônico no backend; problema é só
  nas STRINGS de display da UI que ainda têm "CTK").

Fase 1 read-only OBRIGATÓRIA (Decisão 23 + Regra de Coerência
Sistêmica):
- Branch criada: `feature/fatia-a` (1º comando da sessão).
- Grep amplo `\bCTK\b` em `web/app/**/*.tsx` + `web/components/**
  /*.tsx` pra mapear superfícies (esperado: dezenas de ocorrências
  em cards saldo + headers + tooltips).
- Grep amplo `CTK\b` em mensagens de erro do backend que aparecem
  na UI (`throw new BadRequestException` com "CTK" no texto).
- Mapear o card de saldo principal — provavelmente em
  `/portal/tokens/page.tsx` + `/dashboard/clube/page.tsx` +
  `/conveniada/convenio/[id]/distribuir-tokens/page.tsx`.
- Identificar onde está a separação atual kWh × token.
- MAPA DE IMPACTO 5 dimensões + perguntas decisórias (se houver):
  * Tooltip explicativo sobre "o que é CooperToken" — manter ou
    remover?
  * Termo "saldo" — usar "saldo CooperToken" ou só "saldo" com
    contexto?
  * Plural — "1 CooperToken" / "2 CooperTokens"?
- PAUSAR pro OK Luciano antes de codar.

Após Fase 1 OK:
- Implementação Fatia A em branch (commits incrementais por
  tela/superfície).
- TS check + lint web limpos.
- Frontend build limpo.
- Reviewer cosmético (`code-reviewer` genérico) + revisão visual
  Luciano.
- Smoke manual (Luciano abre 3-4 telas chave + valida nomenclatura).
- Merge `feature/fatia-a` → `main` com autorização explícita.
- Fechamento M38.

Pré-requisitos leitura M37:
1. docs/CONTROLE-EXECUCAO.md (## ONDE PARAMOS topo + esta frase).
2. docs/sessoes/2026-06-14-higiene-rotas-blocos-B-E.md.
3. CLAUDE.md (especialmente seção nova "Arquitetura de rotas
   Sprint Higiene 14/06/2026").
4. ~/.claude/projects/C--Users-Luciano-cooperebr/memory/sprint_
   clube_unificado_cooper_token_10_06.md (Fatia A escopo + 7
   fases).
5. ~/.claude/projects/.../memory/decisao_modelo_token_voucher_
   sobra_resgate_2026_06_04.md (vocabulário inegociável: voucher
   / liquidação / recibo — NUNCA recompra/venda).
6. .claude/CLAUDE.md.

DIRETRIZES PRESERVAR:
- Branch `feature/fatia-a` desde 1º commit.
- Vocabulário inegociável: CooperToken / voucher / liquidação /
  recibo / sobra. NUNCA: CTK (em UI) / recompra / venda.
- Dois rios kWh × token visivelmente separados.
- Multi-tenant: NÃO há mudança de backend nesta Fatia, mas se
  aparecer cooperativaId em frontend, vem do JWT.
- Rebuild web obrigatório: `cd web ; npm run build ; pm2 restart
  cooperebr-frontend` — HMR NÃO ROLA.
- Regra contatos de teste: AMAGES + lucbragatto+amages@gmail.com
  pra smoke (se aplicável — Fatia A é cosmético, smoke é visual).

CARRY-OVERS M37 (não-bloqueantes):
- D-novo-EMAIL-IMAP-SSL-VERIFY P2 (novo — gate `tls.
  rejectUnauthorized:false` por env ANTES de deploy prod; commit
  Cowork `be8e46e` carona no merge).
- Sessão Cowork em curso pode ter `backend/package.json` +
  `package-lock.json` + `concierge.service.spec.ts` M — NÃO TOCAR.
- Histórico M35: D-novo-F6-RECONCILIACAO-CRON P2 + D-novo-MT-F2-
  F3-F4-LEGADO-UPDATE-COOPERADO P2 + D-novo-F6-ADMIN-FLAG-ESTAB
  P2 + restante (ver lista em docs/sessoes/2026-06-14-higiene-
  rotas-blocos-B-E.md seção Carry-overs históricos).

═══ FIM DA FRASE M37 ═══
```
