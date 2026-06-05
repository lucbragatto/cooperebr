# Fatia F-G1 Circuito CooperToken + ajustes — 05/06/2026

## TL;DR

Fatia F-G1 do Circuito CooperToken entregue ponta-a-ponta: admin cria convite de indicação direto pela web (`/dashboard/indicacoes` com Dialog Tipo C), WhatsApp chega no convidado com nome dinâmico da cooperativa (zero hardcode "CoopereBR" — SISGD é multi-tenant), cooperado institucional fantasma criado on-demand quando admin não escolhe indicador (skip de bônus em `processarPrimeiraFaturaPaga`). **Opção A consolidada:** perfil `COOPERADO` único + contextos derivados (empresa cooperada PJ tem perfil COOPERADO; `EMPRESA_CONVENIADA` deprecada). Crédito de Energia movido pra dentro do `/portal/financeiro` (aba "Créditos de Energia") com gate `SEM_UC` mostrando CTA "Solicitar conversão → PIX". Login bootstrap ganhou 4 cards (SUPER_ADMIN + ADMIN + COOPERADO + Empresa) pra acelerar smoke. WhatsApp passou a retornar status honesto (`WhatsappEnvioResult`) — UI dev mostra motivo do skip (whitelist-dev / numero-protegido / erro-runtime). Whitelist permanente ganhou `+5527999479097` (segundo número Luciano pra simular convidado novo).

## Marco entregue

**M22 — Fatia F-G1 Circuito CooperToken + Opção A + WA honesto**

## Commits do dia (4)

| Hash | Mensagem |
|---|---|
| `a99a7f2` | feat(cooper-token): Fatia F-G1 — convite indicação web (admin) + Opção A perfil COOPERADO + créditos no Financeiro |
| `4690a5d` | fix(cooper-token): pós-F-G1 — SUPER_ADMIN seletor coop + nome dinâmico no WA + login bootstrap 2 contas |
| `fc4cc24` | fix(login): box dev — 4 cards (SUPER_ADMIN + ADMIN + COOPERADO + Empresa) |
| `9291d32` | fix(whatsapp+convite): whitelist +27999479097 + status honesto do envio (D-novo-WA-DEV-FALSE-OK) |

(+ commit de fechamento desta sessão)

## Entregas técnicas

### Backend

- **`convite-indicacao/cooperado-institucional.service.ts` (NOVO)** — `garantirInstitucional(cooperativaId)` idempotente cria fantasma `institucional+<cooperativaId>@sisgd.invalid` quando admin não escolhe indicador. `ehInstitucional(cooperadoId)` consultado em `processarPrimeiraFaturaPaga` pra pular `BeneficioIndicacao` + tokens (decisão Luciano 05/06).
- **`convite-indicacao/convite-indicacao.controller.ts`** — handler `POST /convite-indicacao/admin` com 2 caminhos: SUPER_ADMIN obriga `cooperativaId` no body (anti-spoof — `ADMIN` usa próprio JWT, body ignorado), indicador opcional (ausente = fantasma institucional). Payload retorna `whatsappMotivo` pra UI mostrar status honesto.
- **`convite-indicacao/convite-indicacao.service.ts`** — `enviarLinkPorWhatsappIndicacao` propaga `WhatsappEnvioResult`; `cooperativaNome` agora vem dinâmico (sem hardcode "CoopereBR").
- **`whatsapp/whatsapp-sender.service.ts`** — D-novo-WA-DEV-FALSE-OK fix. `enviarMensagem` mudou de `Promise<void>` pra `Promise<WhatsappEnvioResult>`. Retorna `{ enviado: false, motivo: 'whitelist-dev'|'numero-protegido'|'erro-runtime' }` em vez de `return` silencioso. Callers que ignoram continuam compatíveis; callers que se importam propagam motivo até UI dev.
- **`common/safety/whitelist-teste.ts`** — adicionados 5 variantes de `27999479097` (E.164/sem DDI/máscara) com comentário 05/06.
- **`auth/pagador-cooperado.guard.ts`** — Opção A: removido early-return baseado em perfil. Match por email + `pagadorCooperadoId` (consistente com COOPERADO-ONLY 04/06).
- **`auth/perfil.enum.ts`** — `EMPRESA_CONVENIADA` marcada `@deprecated` (mantida pra compat de tokens emitidos).
- **`convenios/portal-empresa/portal-empresa.controller.ts`** — `@Roles(SUPER_ADMIN, COOPERADO, EMPRESA_CONVENIADA)` (adicionou COOPERADO sem remover EMPRESA_CONVENIADA pra não quebrar `/portal/meus-convenios` em transição).
- **`indicacoes/indicacoes.service.ts`** — `processarPrimeiraFaturaPaga` consulta `ehInstitucional(indicadorId)` antes de emitir `BeneficioIndicacao` + tokens. Skip silencioso quando indicador = fantasma institucional. Spec `indicacoes-idor-bq4.spec.ts` ajustado com mock 6º arg.

### Frontend

- **`web/app/dashboard/indicacoes/page.tsx`** — Dialog Tipo C "Convidar conhecido" (decisão UX 17/05) com seletor de cooperativa só pra SUPER_ADMIN, indicador opcional (autocomplete cooperados ativos), feedback 3-estados honesto (verde enviado / amber whitelist-dev / amber numero-protegido / vermelho erro-runtime).
- **`web/app/login/page.tsx`** — box credenciais dev com 4 cards: SUPER_ADMIN (luciano@sisgd) + ADMIN — CoopereBR + COOPERADO + Empresa cooperada PJ. Todas as senhas resetadas pra `Teste@123` via scripts efêmeros já descartados.
- **`web/app/portal/page.tsx`** — removido card "Crédito de Energia (R$)" duplicado do home portal. Adicionado card "Financeiro 💼" como entrada única.
- **`web/app/portal/financeiro/page.tsx`** — aba "Meus Créditos" renomeada pra "Créditos de Energia"; HelpBox 19/05 explica diferença entre Rio 1 (financeiro/desconto) vs Rio 2 (token); gate `tipoCooperado === 'SEM_UC'` mostra banner amber com CTA "Solicitar conversão → PIX" (placeholder pra Fatia C futura).

### Docs

- **`CLAUDE.md`** — seção "Cooperados institucionais — SALVAGUARDA" + lição operacional `next start` (frontend sob PM2 NÃO tem HMR — toda mudança exige `cd web && npm run build && pm2 restart cooperebr-frontend`).
- **`docs/especificacao-circuito-cooper-token-convenio.md`** — modificado pelo orquestrador claude.ai (Fatias C/D refinadas) — incluído no commit de fechamento.

## Bugs descobertos e resolvidos na sessão

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| 1 | P0 dev | WhatsApp não chegava no número novo (`+27999479097`) | Faltava na whitelist `whitelist-teste.ts` | RESOLVIDO commit `9291d32` |
| 2 | P0 dev | `enviarMensagem` retornava `Promise<void>` com `return` silencioso → callers viam `await sem throw = enviado` (falso positivo) | `WhatsappEnvioResult` explícito + UI propaga motivo | RESOLVIDO commit `9291d32` (D-novo-WA-DEV-FALSE-OK) |
| 3 | P1 dev | Após remover gate de perfil em `PagadorCooperadoOnly`, `/portal/meus-convenios` quebrou (RolesGuard rejeitava COOPERADO) | Audit prévio via grep + adicionou COOPERADO em `@Roles` do `portal-empresa.controller.ts` | RESOLVIDO commit `a99a7f2` |
| 4 | P2 cosmético | Hardcode "CoopereBR" no template WA (SISGD é multi-tenant) | `cooperativaNome` vem dinâmico de `coopAlvo.nome` carregada do banco | RESOLVIDO commit `4690a5d` |
| 5 | P2 UX | Login dev tinha só 2 contas (SUPER_ADMIN + Empresa) — não cobria ADMIN/COOPERADO/teste cruzado | 4 cards no box dev | RESOLVIDO commit `fc4cc24` |

## Débitos novos catalogados (3 P2/P3 + 1 RESOLVIDO)

| ID | Prioridade | Resumo | Status |
|---|---|---|---|
| `D-novo-CAD-CONSUMO-MENSAL` | P2 | Consumo mês-a-mês no cadastro + projeção créditos + visibilidade empresa/cooperativa (spec §9 — OCR pré-preenche + editável) | 📋 Catalogado |
| `D-novo-CONVITE-MENUS-UX` | P3 | Consolidar/renomear 3 menus (Meu Convite / Indicações / Convites) + pointer pro admin em "Meu Convite" | 📋 Catalogado |
| `D-novo-TESTS-MOCK-PRISMA` | P2 | Testes pré-existentes quebrados (proprietario/cooperados/usinas, mock Prisma incompleto: `Cannot read properties of undefined (reading 'findMany')`) | 📋 Catalogado |
| `D-novo-WA-DEV-FALSE-OK` | — | Status honesto do envio WA em DEV (motivo do skip propagado até UI) | ✅ RESOLVIDO commit `9291d32` |

## Decisões estratégicas catalogadas (memória persistente)

- **Sugestão #10** — Práticas Anthropic aplicáveis ao SISGD (extensão da skill `retomada-sessao`).
- **Sugestão #11** — Banco de modelos de mensagens (futuro Sprint Comunicação Centralizada).
- **Cooperado institucional fantasma** — padrão `institucional+<cooperativaId>@sisgd.invalid` (NÃO `cooperebr.invalid` — multi-tenant).
- **Opção A consolidada** — perfil COOPERADO único + contextos derivados; `EMPRESA_CONVENIADA` deprecada (compat só pra tokens em circulação).
- **`next start` sob PM2** — frontend NUNCA tem HMR; rebuild + restart obrigatório (documentado em CLAUDE.md).

## Próximo passo

**Fatia F-G2 do Circuito CooperToken** — super-admin convida novo parceiro/cooperativa + novos cooperados a nível SISGD. Mapear criação de tenant (provisionamento Cooperativa + admin inicial + onboarding via convite institucional).

## Pré-requisitos leitura próxima sessão (ordem fixa)

1. `docs/CONTROLE-EXECUCAO.md` (## ONDE PARAMOS topo + ## FRASE DE RETOMADA)
2. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/MEMORY.md`
3. `~/.claude/projects/C--Users-Luciano-cooperebr/memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md`
4. `docs/sessoes/2026-06-05-fatia-fg1-cooper-token-ajustes.md` (esta doc)
5. `docs/especificacao-circuito-cooper-token-convenio.md` (Fatias C/D/E/F-G2/G)
6. `backend/src/convite-indicacao/cooperado-institucional.service.ts` (padrão fantasma — reuso no F-G2)
7. `backend/src/cooperativas/` (provisionamento tenant — entender estado atual)
8. `backend/src/auth/perfil.enum.ts` + `auth/roles.decorator.ts` (SUPER_ADMIN vs ADMIN)
9. `CLAUDE.md` + `.claude/CLAUDE.md` (regras + lição `next start`)
10. `git log --oneline -15`

## Carry-overs (não-bloqueantes)

- Smoke E2E manual Luciano: convite admin web → WA recebido no `+27999479097` → `/cadastro?conv=` no celular → aprovar/rejeitar via portal (golden path Fatia F-G1).
- `D-novo-PORTAL-EMPRESA-SEED-TESTE` P3 (remover seed + box credenciais antes prod).
- `D-novo-DEV-LAN-ACCESS` P3 (CORS+API_URL pra domínio público + rebuild).
- 7 débitos `/cadastro` catalogados sessão 04/06.
- Slim `/convite-convenio/[token]` deprecation 1 sprint pra remover redirect.
- `D-novo-CT-VALIDACAO-FISCAL` P0 (gate fiscal — Sessão Validação Fiscal Interna).
- `D-novo-CT-MULTI-REGIME-CLASSIFICACAO` P1 (bloqueia Sinergia).
- `D-novo-BM` P0 BLOQUEADOR REMOÇÃO PRÉ-PROD.

## Regras aplicadas na sessão

- **Decisão 23** — Fase 1 read-only obrigatória antes de cada Fase 2 (aplicada 3× no dia: mapear endpoints `/indicacoes`, mapear `pagador-cooperado.guard.ts` antes de Opção A, audit `@Roles` antes de remover gate).
- **Decisão 14** — validação prévia antes de propor (grep + ler antes de mudar `PagadorCooperadoOnly`).
- **Regra 17/05 não-paralelo** — claude.ai aguarda Code reportar antes de próxima fatia.
- **Regra 14/05 contatos teste** — whitelist `+5527999479097` adicionada (impreterível em DEV).
- **Regra 18/05 `isAmbienteReal()`** — nenhum uso de `NODE_ENV` direto.
- **Regra 19/05 HELP inline** — HelpBox em `/portal/financeiro` (Rio 1 vs Rio 2).
- **Regra commit SCOPED** — nenhum `git add .` ou `-A`; arquivos listados explicitamente.
- **Decisão UX 17/05** — Dialog Tipo C pra ação "Convidar conhecido" (não cria página própria; ação simples).
- **Lição `next start`** — todo commit frontend acompanhado de `cd web && npm run build && pm2 restart cooperebr-frontend`.

## Frase comandante

Ver `docs/CONTROLE-EXECUCAO.md` seção `## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único).
