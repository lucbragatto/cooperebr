# FIX texto convite + Sprint Máscara de e-mail (Blocos A-E preservado em branch) — 14/07/2026

## TL;DR

Sessão Code entregou dois blocos independentes: (1) **FIX texto do convite de convênio
empresarial** — aplicou o texto aprovado pelo Luciano em 05/07 ("quem ganha é você" +
Clube de Vantagens + 100% + fatura do último mês + expira em 7 dias) e ELIMINOU a
duplicação de string entre `convites-convenio.service.enviarLinkPorWhatsapp` e
`lib/wa-me-builder.montarMensagemConvite` (helper puro agora é fonte única — mudança
futura de texto atualiza os 2 caminhos automaticamente); (2) **Sprint Máscara de e-mail
por convênio (Blocos A-E + G piloto)** — pipeline completo pra captação de faturas de
funcionários de campanha empresarial via alias Gmail `<localMailbox>+<sufixo>@<domain>`,
pré-cadastro (não auto-cria Cooperado; humano vincula depois). Sprint entregue em 16
arquivos + 554/554 specs verdes + smoke não-rodado; por instrução expressa do Luciano
(pausa preservada), commit foi movido pra branch `feature/mascara-email-convenio` e a
`main` foi revertida ao commit imediatamente anterior. Ambos os builds (backend + web)
rebuildaram a partir da main revertida — runtime online no estado mergeado oficial.
Bug carona resolvido no spec do wa-me-builder (double-decode de `%25` que explode com
`URI malformed` quando o texto tem `100%` literal).

## Marco entregue

**M53 — FIX texto convite (main) + Sprint Máscara preservada em branch** (pausa
autorizada; Bloco F reviewers + re-review orquestrador + smoke real INBOUND aguardam
retomada futura).

## Commits do dia (2 na main + 1 preservado em branch)

### Main (`origin/main` = `71b4202`)

| Hash | Mensagem |
|---|---|
| `71b4202` | fix(convite): texto convênio empresa aprovado 05/07 + dedup wa-me-builder como fonte única |

### Branch preservada (`origin/feature/mascara-email-convenio` = `7745082`)

| Hash | Mensagem |
|---|---|
| `7745082` | feat(campanha): máscara de e-mail por convênio (Blocos A-E + G piloto Santi) |

**Movimento na main**: commit `7745082` foi push-ado durante execução e imediatamente
DESFEITO por instrução expressa do Luciano (`git reset --hard 71b4202` + push
`--force-with-lease`). Branch preservou o trabalho pra retomada futura.

## Entregas técnicas

### FIX texto convite (na `main`)

- **`backend/src/convenios/lib/wa-me-builder.ts:69-80`** — branch `CONVENIO_EMPRESA`
  atualizada com o texto aprovado 05/07. Variante `INDICACAO_COOPERADO` (linhas 59-68)
  intocada (fora de escopo).
- **`backend/src/convenios/convites-convenio.service.ts:1041-1053`** — refactor:
  `enviarLinkPorWhatsapp` importa e chama `montarMensagemConvite({..., variante: 'CONVENIO_EMPRESA'})`
  em vez de duplicar a string. Uma mudança futura de texto atualiza os 2 caminhos
  (envio automático via bot + Modo B wa.me manual).
- **`backend/src/convenios/lib/wa-me-builder.spec.ts`** — 3 mudanças:
  - Assertion do texto novo (Clube de Vantagens / CoopereBR / quem ganha é você / 100% /
    fatura último mês / expira em 7 dias).
  - Fix carona: teste `buildWaMeConviteUrl: gera wa.me com encoding correto` fazia
    double-decode (`URL.searchParams.get` + `decodeURIComponent`) e explodia com
    `URI malformed` quando o texto tem `%` literal (`100%` → `%25` no encoding;
    `URLSearchParams.get()` decoda pra `%`; segundo decode falha porque `%` isolado
    não é escape válido). Corrigido usando só `URL.searchParams.get` (que já decoda) +
    sanity nova `expect(r.urlWa).toContain('100%25')`.
- Suite `src/convenios/lib/wa-me-builder` + `src/convenios/convites-convenio` **97/97
  verde**. TSC limpo. Backend rebuild + `pm2 restart cooperebr-backend` feito.

### Sprint Máscara de e-mail por convênio (na branch `feature/mascara-email-convenio`)

**Escopo do prompt do orquestrador (Blocos A-E + G)**: captação de faturas de
funcionários de campanha empresarial (pré-cadastro) via alias Gmail
`<localMailbox>+<sufixo>@<domain>`. **Genérico multi-tenant** (Acréscimo A) — o
local-part vem da config do monitor DO TENANT (`email.monitor.user`), não hardcoda
"contato".

- **Schema aditivo** (`backend/prisma/schema.prisma`):
  - `ContratoConvenio.emailAliasCampanha String? @unique` — nullable, namespace global
    intencional (uma caixa por tenant; resolução alias→convênio carrega o
    cooperativaId do convênio).
  - Novo model `FaturaCampanhaConvenio` com `cooperativaId` denormalizado (defesa em
    profundidade), campos OCR sanitizados, vinculação humana pós-cadastro
    (`vinculadoCooperadoId` + `vinculadoEm`).
  - Novo enum `StatusFaturaCampanha { RECEBIDA, OCR_OK, OCR_FALHOU, VINCULADA, DESCARTADA }`.
  - Aplicado no banco dev via `prisma db push --accept-data-loss` com backend parado
    (safe: coluna nova + nullable; Postgres admite múltiplos NULL em UNIQUE).
- **Helpers puros** (`backend/src/email-monitor/lib/campanha-alias.ts`):
  - `localPartDoMailboxTenant(emailMonitorUser)` — deriva local-part da config do tenant.
  - `matchAliasCampanha(destinatarios, localPart, alias)` — match no formato
    `<local>+<alias>@*`. Fail-closed sem local/alias. Lowercase. Tolera formato "Nome
    <email>". Domínio livre (Gmail aceita múltiplos).
  - `sanitizarTextoOcr` (Acréscimo B) — trim + strip caracteres de controle + colapsa
    whitespace + limite 120 chars com quebra de palavra.
  - `sanitizarNumeroUc` — só dígitos, 6-15 chars.
- **Service** (`faturas-campanha.service.ts`): guard 15MB (rejeita antes do OCR),
  salva PDF em `uploads/campanha/<convenioId>/<hash>.pdf` (`uploads/` já no
  `.gitignore`), dedupe semântica (findFirst por convenioId+numeroUC → update; sem UC
  = create sempre), sanitiza TODOS os campos OCR antes de gravar/logar/notificar,
  endpoints `listarPorConvenio` + `atualizarStatus` com multi-tenant M45.
- **Integração no email-monitor** (`email-monitor.service.ts`):
  - `EmailProcessado` ganha `destinatarios: string[]` (extraído de `parsed.to.value` do
    simpleParser — o `envelope` do fetch IMAP não era usado hoje).
  - Antes do `identificarCooperado` normal: cache 1×/ciclo dos convênios ativos com
    alias + verifica match. **Exclusão mútua**: bateu → ramo campanha, senão fluxo
    antigo intacto.
  - Notifica admin WA com tag `📥/⚠️ Fatura de campanha [<empresa>]: <nome> — <kWh> kWh`.
- **Controller** (`convenios.controller.ts`):
  - `UpdateConvenioDto.emailAliasCampanha` com `@Matches(/^[a-z0-9-]{2,30}$|^$/)`
    (vazio → desvincular).
  - `GET /convenios/:id/faturas-campanha` — retorna `{convenio, agregados, registros}`
    com `previewAlias` montado do `configTenant`.
  - `PATCH /convenios/:id/faturas-campanha/:fid` — status DESCARTADA (livre) |
    VINCULADA (exige cooperadoId do mesmo tenant). AuditLog.
  - `ConveniosModule` importa `EmailMonitorModule` via `forwardRef` (ciclo Emails ↔
    Convênios evitado). `WhatsappModule` também passa a forwardRef.
- **UI** (`web/components/convenios/CampanhaFaturasSection.tsx` + integração no
  `web/app/dashboard/convenios/[id]/page.tsx`): banner help inline (regra 19/05) +
  input do sufixo com preview do endereço final + 3 contadores (N · Σ kWh · Σ R$) +
  tabela com status + botões Vincular / Descartar.
- **Specs Jest** (31 novos): 23 do `campanha-alias.spec.ts` + 8 do
  `faturas-campanha.service.spec.ts`. 2 caronas pré-existentes fechadas
  (construtores desatualizados de `convenios-custeio.controller.spec` e
  `convenios-membros-origem.spec`). Suite `src/convenios/` + `src/email-monitor/` +
  `src/publico/` + `src/lead-expansao/` + `src/cooperados/` = **554/554 verdes**
  (47 suites). TSC limpo.
- **Seed piloto** (Bloco G): CV-SANTI-001 `emailAliasCampanha='santi'` gravado no
  banco dev (continua lá, sem uso pelo código da main revertida).

### Movimento da pausa (preservação)

- Branch nova `feature/mascara-email-convenio` criada no commit `7745082` + push OK.
- `main` revertida: `git reset --hard 71b4202` + `git push origin main --force-with-lease`
  (`+ 7745082...71b4202 main -> main (forced update)`).
- Prisma client regenerado a partir do schema revertido; backend + frontend
  rebuildaram e voltaram online (`backend=400` esperado em POST vazio;
  `frontend=307` esperado em redirect login).
- **Schema DEV continua com a delta aplicada** — código da main revertida NÃO
  seleciona os novos campos (`emailAliasCampanha`, `FaturaCampanhaConvenio`,
  `StatusFaturaCampanha`) e roda normalmente. Zero rollback de banco necessário.

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| 1 | Baixa (UX) | Texto do convite empresarial genérico ("programa de custeio") não vendia benefício | Texto aprovado 05/07 aplicado no helper puro + reuso no path automático | **RESOLVIDO** (`71b4202`) |
| 2 | Média (drift) | String do convite duplicada entre `enviarLinkPorWhatsapp` e `montarMensagemConvite` — helper puro era pra ser fonte única mas caminho automático não usava | Refactor `enviarLinkPorWhatsapp` → chama `montarMensagemConvite` | **RESOLVIDO** (`71b4202`) |
| 3 | Baixa (test hygiene) | Spec `buildWaMeConviteUrl` fazia double-decode (`URLSearchParams.get` já decoda + `decodeURIComponent` extra) → explodia com `URI malformed` quando o texto tem `%` literal | Usar só `URL.searchParams.get`; sanity nova `%25` no URL bruto | **RESOLVIDO** (`71b4202`, carona) |
| 4 | — (ausência de peça) | Sem campo pra captação de faturas pré-cadastro em campanhas empresariais (funcionários mandavam email pra `contato@` e caía no limbo) | Sprint Máscara Blocos A-E + G — pipeline completo | **PRESERVADO EM BRANCH** (`7745082`, aguarda Bloco F + re-review + merge) |

Nenhum débito novo catalogado nesta sessão. Débitos anteriores (M52b `D-novo-FAXINA-PASSIVO-PRE-M50` P2 R$ 741) permanecem no `debitos-tecnicos.md` sem alteração.

## Decisões estratégicas catalogadas

Nenhuma memória nova criada nesta sessão em
`~/.claude/projects/C--Users-Luciano-cooperebr/memory/`. Decisões operacionais foram
aplicadas mas seguem regras já catalogadas:

- Aplicou padrão de **fonte única em helper puro** (padrão de dedup já usado em outros
  módulos — `tarifa-helper`, `otp-helper`, etc).
- Aplicou **Acréscimos A + B do orquestrador** (multi-tenant genérico via local-part +
  sanitização OCR) já documentados no chat de aprovação da Fase 1.
- Aplicou **regra da pausa** — trabalho não-mergeado vai pra branch dedicada
  (`feature/<sprint>`) + `main` volta ao estado oficial; preservação real é regra M52a
  já catalogada.

## Próximo passo

Luciano decide quando retomar o Sprint Máscara: `git checkout feature/mascara-email-convenio`
→ Bloco F (`cooperebr-multitenant-reviewer` + `code-reviewer`) → re-review orquestrador
→ merge → smoke real INBOUND com `contato+santi@cooperebr.com.br` (com acompanhamento
do Luciano). Alternativas ainda abertas da FRASE DE RETOMADA anterior (M52b) seguem
válidas: 3 portas de config (`AMBIENTE_REAL=true` + `SUPER_ADMIN_SECRET_KEY` forte +
senha SA forte) / Camadas 2/3 completas do funil / M52c escrituração retrospectiva
(R$ 741).

## Pré-requisitos leitura próxima sessão

- Ao retomar Sprint Máscara: `git log feature/mascara-email-convenio --oneline -3`
  + ler doc-sessão desta sessão (esta) + o commit `7745082` inteiro.
- Se for qualquer outra frente: FRASE DE RETOMADA abaixo + `docs/CONTROLE-EXECUCAO.md`
  seção `ONDE PARAMOS` mais recente.

## Carry-overs (não-bloqueantes)

- **Branch `feature/mascara-email-convenio`** vive no origin, sem PR aberto. Link
  sugerido pra abertura futura de PR:
  `https://github.com/lucbragatto/cooperebr/pull/new/feature/mascara-email-convenio`.
- **Schema DEV com delta aplicada mas código na main não usa** — só relevante quando
  a branch voltar (Prisma generate vai casar).
- **CV-SANTI-001 com `emailAliasCampanha='santi'`** gravado no banco dev, sem uso
  hoje (código da main não conhece o campo). Fica lá pronto pra o smoke inbound
  quando a branch voltar.
- **Prisma engine legacy `.dll.node.old`** deixado como sobra do troubleshooting do
  EPERM (arquivo grande, mas irrelevante — Prisma v6 usa `.wasm`). Se quiser limpar:
  `rm backend/node_modules/.prisma/client/query_engine-windows.dll.node.old`.

## Regras aplicadas na sessão

- **Decisão 23** (Fase 1 read-only obrigatória) — aplicada tanto no FIX convite (grep
  pra confirmar zero spec assertando texto literal antigo) quanto na Sprint Máscara
  (Fase 1 completa reportada antes do OK do orquestrador).
- **`feedback_fase1_readonly_obrigatoria`** — Fase 1 antes de qualquer escrita.
- **Acréscimos A + B do orquestrador** — genérico multi-tenant + sanitização OCR
  como input não-confiável.
- **Regra da pausa (M52a)** — trabalho não-mergeado vai pra branch dedicada; main
  volta ao estado oficial.
- **Regra contatos teste (14/05)** — NÃO se aplicou (nenhum disparo real de teste;
  smoke real INBOUND foi cancelado junto com Bloco F).
- **Padrão de commits sequenciais** — commit único e limpo por sprint, mensagem
  descritiva com bullets do escopo entregue.
- **`--force-with-lease`** usado em vez de `--force` bruto no revert (seguro contra
  sobrescrever trabalho alheio que possa ter entrado no remote entre o read e o push).
