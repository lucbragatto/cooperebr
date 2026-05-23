# Sessão 2026-05-23 — Sprint Bot Autoatendimento / Bloco 6: Cadastro Proxy

## TL;DR

Bloco 6 do Sprint Bot Autoatendimento WhatsApp ENTREGUE em 4 commits +
fechamento. O fluxo "cooperado existente cadastra um amigo via WhatsApp"
saiu de hardcoded-only (4 handlers + 4 etapas órfãs no seed) pra
totalmente integrado no motor dinâmico: cooperado escolhe "cadastrar
amigo" → 3 turnos (nome → telefone → foto/PDF) → confirmação → cria
`Cooperado` PENDENTE_ASSINATURA + Indicacao formal status PENDENTE + JWT
7 dias + envia WA pro amigo com link `/portal/assinar/{token}` + notifica
indicador → transiciona pra MENU_COOPERADO. **CAVEAT arquitetural da
Fase 1 resolvido:** motor estendido pra receber mídia (foto/PDF) via 5º
parâmetro `media` em `executarAcao` + `temMidia` em `avaliarGatilhoMatch`.
Pré-paga qualquer fluxo futuro com imagem/PDF (cadastro inicial,
comprovante, documento). 30 specs novos verdes (era 168 motor → 198,
total nos meus arquivos: 224). 2 débitos novos catalogados (D-novo-Z
divergência hardcoded×motor, D-novo-AA placeholders proxy eternos). PM2
restart limpo (pid 27616). Suíte 686/697 (11 falhas pré-existentes
idênticas a M19/M20/M21 em cooperados/usinas controllers, 0 minhas).
Próximo natural: Blocos 5 e 8 — ambos com decisões produto pendentes, o
orquestrador apresenta na próxima abertura.

## Marco entregue

**M22 — Sprint Bot Autoatendimento WhatsApp: Bloco 6 (Cadastro Proxy)**

## Commits do dia (4 + fechamento)

| Hash | Mensagem |
|---|---|
| `4e91c80` | feat(wa): Bloco 6 Etapa B — motor estendido pra receber midia (CAVEAT Fase 1 resolvido) |
| `7f7d3e7` | feat(wa): Bloco 6 Etapa C — 4 acoes do fluxo Cadastro Proxy no motor |
| `278e44d` | feat(wa): Bloco 6 Etapa D — script idempotente cabea 4 etapas CADASTRO_PROXY_* no motor |
| `5093d75` | docs(debitos): Bloco 6 Etapa E — cataloga D-novo-Z + D-novo-AA (debt latente proxy) |
| (a seguir) | docs(sessao): fechamento M22 — Bloco 6 Sprint Bot Autoatendimento Cadastro Proxy |

**Etapa A (Schema) não teve commit** — `Indicacao` model + `StatusCooperado.PENDENTE_ASSINATURA` já existiam no schema. Decisão técnica do orquestrador: aceitaMidia por heurística (sem campo novo em `FluxoEtapa`). Justificado no commit da Etapa B.

## Entregas técnicas

### Etapa B — Motor estendido pra mídia (commit `4e91c80`)

**Resolve o CAVEAT arquitetural crítico identificado na Fase 1.**

**`whatsapp-fluxo-motor.service.ts`:**

- **`avaliarGatilhoMatch`** ganha 3º parâmetro opcional `temMidia?: boolean`.
  Wildcard `'*'` casa quando (corpo não-vazio) OU (temMidia=true). Sem
  `temMidia` ou false: semântica antiga (exige texto). Backward compatible
  — todos os chamadores antigos continuam funcionando.
- **`executarAcao`** ganha 5º parâmetro opcional `media?: { base64,
  mimeType, nomeArquivo? }`. Ações que NÃO usam mídia (Blocos 3/4/7)
  ignoram — parâmetro opcional, zero breakage de assinatura.
- **`processarComFluxoDinamico`** detecta `msg.tipo in [imagem, documento]`
  + `mediaBase64` + `mimeType`, monta objeto `media`, propaga via
  `avaliarGatilhoMatch(temMidia)` + `executarAcao(media)`. Log inclui
  mimeType quando mídia presente.
- **`executarComandoUniversalReal`**: passa `undefined` como 5º param
  (comando universal não trafega mídia).
- **Ações via `acaoAutomatica`** recebem `media` também (caso fluxo
  tenha `acaoAutomatica` na etapa-destino após transição com mídia).

**Decisão técnica orquestrador:** aceitaMidia por **heurística** (corpo
do wildcard + ação específica) — SEM campo novo no schema `FluxoEtapa`.
Menos invasivo, melhor reuso. Etapa que precisa de mídia tem gatilho
wildcard + ação `PROCESSAR_OCR_*` que valida mimeType internamente.

**11 specs novos:**
- 5 em `avaliarGatilhoMatch`: wildcard+temMidia true/false/default, match
  exato com midia (gatilho exato vence), corpo não-vazio sem mídia
- 4 em `processarComFluxoDinamico`: imagem propaga media, PDF propaga,
  texto sem mídia (5º param undefined), mídia em etapa sem wildcard
  (motor retorna false — fallback)
- 2 em `executarAcao`: 5º param + chamada compatível sem 5º param
- 2 specs legados Bloco 4 Etapa A ajustados (toHaveBeenCalledWith ganha
  `undefined` no 5º slot)

### Etapa C — 4 ações novas (commit `7f7d3e7`)

**`whatsapp-fluxo-motor.service.ts`:** ganha 4 cases novos em `executarAcao`
+ 4 métodos privados (padrão Bloco 4/7).

`FaturasService` injetado no construtor (DI resolvida via `FaturasModule`
já importado em `WhatsappModule`). `jsonwebtoken` importado pra gerar
token de assinatura.

**`executarSalvarProxyNome`** (CADASTRO_PROXY_NOME):
- Trim + valida `length >= 3`
- Persiste `dadosTemp.proxyNome` + transiciona pra
  CADASTRO_PROXY_TELEFONE
- Envia pergunta do telefone
- Retry inline se inválido

**`executarSalvarProxyTelefone`** (CADASTRO_PROXY_TELEFONE):
- `replace(/\D/g, '')` + valida `10 <= length <= 13`
- Prefixa "55" se não começar com 55 (E.164 BR)
- Persiste `dadosTemp.proxyTelefone` + transiciona pra
  AGUARDANDO_FATURA_PROXY
- Envia pergunta da fatura
- Retry inline

**`executarProcessarOcrProxy`** (AGUARDANDO_FATURA_PROXY):
- Recebe 5º param `media` da Etapa B
- Valida `mimeType in [pdf, jpeg, png, jpg]`
- UX: envia "📄 Recebi! Analisando os dados... ⏳" antes do OCR
  (cobertura UX pros 5-30s do Claude AI)
- Chama `faturasService.extrairOcr(base64, tipoArquivo)` síncrono
- Valida `consumoAtualKwh > 0` (rejeita se não é fatura)
- Persiste dados extraídos em `dadosTemp`
- Renderiza modelo `proxy_confirmar` do banco com vars
  `{{titular}}` ← proxyNome, `{{telefone}}` ← proxyTelefone (decisão #3
  do prompt — mapear na ação, não renomear modelo)
- Transiciona pra CONFIRMAR_PROXY
- Erros isolados: OCR throw / consumo 0 / mimetype inválido / sem mídia
  → retry inline com mensagem clara

**`executarCriarCooperadoProxy`** (CONFIRMAR_PROXY gatilho '1'):
- Valida `dadosTemp` completo (indicadorId, proxyNome, proxyTelefone,
  cooperativaId)
- `prisma.cooperado.create` PENDENTE_ASSINATURA com `cooperadoIndicadorId`
  + `cooperativaId` herdada + placeholders únicos
  `cpf: PROXY_${ts}` / `email: proxy_${ts}@pendente.cooperebr`
- `prisma.indicacao.create` formal status `PENDENTE` (decisão #2 do
  prompt — defense in depth: cooperadoIndicadorId no Cooperado +
  Indicacao formal pra MLM)
- Gera JWT 7 dias via `jwt.sign({cooperadoId, tipo: 'assinatura'},
  JWT_SECRET, {expiresIn: '7d'})` + persiste em `tokenAssinatura`
- Envia WA pro AMIGO no `proxyTelefone` com link
  `${FRONTEND_URL}/portal/assinar/${token}`
- Notifica cooperado-indicador
- Transiciona pra MENU_COOPERADO

**Erros isolados:**
- `cooperado.create` falha → abort + mensagem genérica
- `indicacao.create` falha → log + segue (cooperadoIndicadorId ainda
  registra vínculo — defense in depth)
- Envio WA pro amigo falha → log warn + notifica indicador mesmo assim
  + transiciona

**19 specs novos:**
- 4 SALVAR_PROXY_NOME (válido, trim, < 3 retry, dadosTemp ausente)
- 5 SALVAR_PROXY_TELEFONE (11 dígitos prefixa 55, 13 com 55, símbolos,
  < 10 retry, > 13 retry)
- 5 PROCESSAR_OCR_PROXY (sem mídia, sucesso renderiza modelo, consumo
  0, OCR throw, mimetype inválido)
- 5 CRIAR_COOPERADO_PROXY (feliz com 4 verificações, sem indicadorId,
  sem proxyNome/Telefone, erro Prisma, WA pro amigo falha mas continua)

### Etapa D — Script idempotente (commit `278e44d`)

**`backend/scripts/fix-bloco-6-cadastro-proxy-no-fluxo.ts`** (padrão
Blocos 4/7):

1. **Read-only check** — confirma 4 modelos `proxy_pedindo_nome`,
   `proxy_pedindo_telefone`, `proxy_pedindo_fatura`, `proxy_confirmar`
   no banco (Bloco 2 commit `1097f72`).
2. **UPDATE 4 etapas FluxoEtapa globais:**
   - CADASTRO_PROXY_NOME → modeloMensagemId + gatilho wildcard +
     `SALVAR_PROXY_NOME`
   - CADASTRO_PROXY_TELEFONE → idem + `SALVAR_PROXY_TELEFONE`
   - AGUARDANDO_FATURA_PROXY → idem + `PROCESSAR_OCR_PROXY` (aceita mídia
     via Etapa B). `acaoAutomatica` movida de etapa pra gatilho (motor
     só passa `media` via gatilho match, não via acaoAutomatica).
   - CONFIRMAR_PROXY → 2 gatilhos: '1' MENU_COOPERADO + `CRIAR_COOPERADO_PROXY`,
     '2' MENU_COOPERADO (cancela)
   - **Mudança importante:** CONFIRMAR_PROXY antes apontava `proximoEstado:
     'CONCLUIDO'` (seed antigo); agora `'MENU_COOPERADO'` (consistente
     Blocos 4/1.b/7 — decisão Luciano #4 do Bloco 7 estendida pro Bloco 6).

**Aplicado no banco DEV:**
- 1ª execução: 4 etapas ATUALIZADAS (todas tinham `gatilhos: []` ou
  configuração deslocada).
- 2ª execução: SKIP total (idempotência confirmada).

**Seed `seed-fluxos-bot.mjs`** atualizado pra novos parceiros nascerem
com Cadastro Proxy já cabeado no motor.

**Ritual PM2 aplicado** (CLAUDE.md): pm2 stop → ts-node script → pm2
restart (online pid 27616, 0 restarts).

### Etapa E — Débitos catalogados (commit `5093d75`)

**`docs/debitos-tecnicos.md`** ganha 2 entradas P3:

- **D-novo-Z** — Divergência funcional Cadastro Proxy:
  - Hardcoded `handleConfirmarProxy` chama `resetarConversa` (provavelmente
    estado INICIAL); motor `executarCriarCooperadoProxy` transiciona pra
    MENU_COOPERADO (consistente).
  - Hardcoded `handleAguardandoFaturaProxy` calcula proposta com
    `motorProposta.calcular` e mostra "economiaMensal" na confirmação;
    motor `executarProcessarOcrProxy` NÃO calcula (simplificação —
    modelo `proxy_confirmar` do banco não tem variável).
  - Fix: 3 opções (alinhar hardcoded / adicionar proposta no motor /
    remover hardcoded).
- **D-novo-AA** — Cooperado proxy com placeholders eternos
  `cpf=PROXY_${ts}` + `email=proxy_${ts}@pendente.cooperebr`. Se amigo
  nunca confirma assinatura, registros lixo acumulam.
  - Fix: cron de cleanup + filtro UI, OU refator pra tabela
    `CadastroProxyPendente`.

Decisão 14 aplicada: grep confirmou letras Z e AA livres.

## Bugs resolvidos / catalogados

| # | Severidade | Causa raiz | Fix | Status |
|---|---|---|---|---|
| Motor era text-only — não conseguia receber foto/PDF do cooperado | CAVEAT arquitetural (Fase 1) | `executarAcao(acao, conversa, dados, corpo)` sem media; `avaliarGatilhos` só casava texto | Extensão da Etapa B: 5º param `media` + 3º param `temMidia` em `avaliarGatilhoMatch` + propagação em `processarComFluxoDinamico` | ✅ RESOLVIDO (`4e91c80`) |
| Etapas `CADASTRO_PROXY_*` órfãs (`gatilhos: []`) — NPS proxy infraestrutura dormente | UX produto (latente) | Seed listava etapas mas nunca cabeou gatilhos no banco; só hardcoded atendia | Script idempotente liga 4 etapas com wildcard + ação + seed alinhado | ✅ RESOLVIDO (`278e44d` + `7f7d3e7`) |
| `Indicacao` formal não era criada no momento do cadastro proxy | rastreabilidade MLM | Hardcoded só populava `Cooperado.cooperadoIndicadorId`; Indicacao ficava pra listener futuro | Ação `CRIAR_COOPERADO_PROXY` cria Indicacao formal status PENDENTE + mantém `cooperadoIndicadorId` (defense in depth) | ✅ RESOLVIDO (`7f7d3e7`) |
| Estado pós-confirmação ia pra CONCLUIDO (hardcoded) — inconsistente | UX | Hardcoded chamava `resetarConversa`; padrão sprint era MENU_COOPERADO | Motor transiciona pra MENU_COOPERADO (alinhado Blocos 4/1.b/7) — débito do hardcoded permanece como D-novo-Z | ✅ RESOLVIDO no motor (`7f7d3e7`); 📋 D-novo-Z catalogado pro hardcoded |
| Divergência hardcoded × motor: hardcoded calcula proposta com economiaMensal; motor não | P3 polimento | Modelo `proxy_confirmar` no banco não tem `{{economiaMensal}}` — orquestrador simplificou no motor | 3 opções de fix em D-novo-Z | 📋 CATALOGADO D-novo-Z |
| Cooperado proxy fica com placeholders eternos se amigo nunca assina | P3 limpeza | Placeholder `cpf=PROXY_${ts}` + `email=proxy_${ts}@pendente.cooperebr` por design (contorna @unique); atualização real é no `/portal/assinar/{token}` | Cron cleanup + filtro UI em Sprint Housekeeping | 📋 CATALOGADO D-novo-AA |

## Decisões estratégicas catalogadas

Nenhuma memória persistente nova criada nesta sessão. Decisões de
produto/técnicas aplicadas vieram do prompt do Luciano (Fase 2 Bloco 6) +
1 decisão técnica do orquestrador:

- **(1A) Estender motor pra receber mídia** — escolha A vs B (deixar OCR
  no hardcoded). Pré-paga fluxos futuros com imagem/PDF.
- **(2b) Criar Indicacao formal status PENDENTE** — não só listener
  futuro. Defense in depth: Cooperado.cooperadoIndicadorId + Indicacao
  registrada.
- **(3i) Mapear vars na ação** — `{{titular}}` ← proxyNome, `{{telefone}}`
  ← proxyTelefone. Modelo no banco intacto, ação faz o mapeamento.
- **Decisão técnica orquestrador (Etapa A):** aceitaMidia por **heurística**
  (sem campo novo em `FluxoEtapa`) — etapa que aceita mídia simplesmente
  tem gatilho wildcard + ação `PROCESSAR_OCR_*`.

## Próximo passo

**Sprint Bot Autoatendimento — Blocos 5 e 8 (decisões produto pendentes).**

Após o Bloco 6, restam apenas 2 blocos do sprint:

- **Bloco 5 — Atualizar Contrato** (~4-6h): cooperado pede alteração no
  contrato via WhatsApp. **Decisão produto pendente:** ação automática
  (motor altera contrato direto) vs solicitação humana (motor cria
  ticket, equipe valida e aplica).
- **Bloco 8 — Menu Fatura / Menu Inadimplente** (~4-6h): sub-menu pra
  cooperado ver/pagar fatura ou negociar. **Decisão produto pendente:**
  dinâmico no motor vs manter hardcoded.

**Orquestrador apresenta as 2 decisões na próxima abertura** com
recomendações + prós/contras pra Luciano bater martelo.

Sprint Bot Autoatendimento fica COMPLETO após Blocos 5 e 8 — ~10-12h
restantes do sprint.

## Pré-requisitos leitura próxima sessão

- `docs/CONTROLE-EXECUCAO.md` (estado atualizado + FRASE DE RETOMADA)
- `docs/sessoes/2026-05-23-bloco6-cadastro-proxy.md` (esta sessão)
- `docs/sessoes/2026-05-23-bloco7-nps-no-fluxo.md` (M21 — padrão ação
  com persistência)
- `docs/sessoes/2026-05-22-bloco4-atualizar-cadastro.md` (M19 — padrão
  ação multi-turno consolidado)
- Memória `sprint_bot_autoatendimento_20_05.md` (escopo Blocos 5 e 8)
- **Próxima abertura precisa investigar Blocos 5 e 8 em paralelo** —
  Fase 1 read-only ampla pra apresentar 2 decisões produto + recomendações:
  - Bloco 5: handler hardcoded `handleAtualizacaoContrato`/
    `handleAguardandoNovoKwh` (whatsapp-bot.service.ts:3576+ a verificar)
    — quais sub-opções faz hoje? Persiste algo? Notifica admin?
  - Bloco 8: handler hardcoded `handleMenuFatura`/`handleMenuInadimplente`
    (verificar onde está) — qual fluxo cobre? Reusa cobrancas/asaas?

## Carry-overs (não-bloqueantes)

**Decisões produto pendentes pro Luciano (M17/M18/M19/M20/M21/M22):**
- **Bloco 5** (Atualizar Contrato): ação automática vs solicitação humana
- **Bloco 8** (Menu Fatura/Inadimplente): dinâmico vs hardcoded
- Disparo automático NPS (Sprint futuro): (b) reativar agendarNps /
  (c) listener event / (d) cron trimestral
- Desativar 1 das 2 etapas globais ATIVAS duplicadas no INICIAL
- `{{distribuidora}}` vazia em `AGUARDANDO_DISPOSITIVO_EMAIL`
- Horário hardcoded em `aguardando_atendente`
- Variáveis-fantasma na UI ModalMensagem
- 4 falhas pré-existentes na suíte Jest (cooperados/usinas controllers)

**Fila operacional pós-Sprint Bot Autoatendimento (após Blocos 5+8):**
- M15 Sprint 5a Neutro Fio B (3-5 dias)
- Cadastrar usina cooperebr2 (depende M15)
- Onboarding Sinergia (depende M15 + Sprint 6 IDOR + D-novo-Q)

**Débitos catalogados (com 2 novos do Bloco 6):**
- D-novo-Q Contatos Teste persistentes (6-8h)
- D-novo-U fix handler hardcoded ver fatura (1-2h, Sprint Housekeeping)
- D-novo-V engine de template `{{#if}}/{{#unless}}` (~8-12h)
- D-novo-W divergência NPS CONCLUIDO×MENU_COOPERADO (5 min)
- D-novo-X agendarNps dead code (5 min)
- D-novo-Y modelo nps_trimestral órfão (5 min OU reuso)
- **D-novo-Z divergência Cadastro Proxy hardcoded×motor (15min-1.5h)**
- **D-novo-AA placeholders proxy eternos cpf/email (2-3h cron+UI)**
- Sprint Housekeeping geral (~3-5h)
- HTML jornada Sugestão #6
- D-novo-H refator técnico (~6-8h)
- Iniciativa Fluxos Customizáveis D-novo-T (~100-200h+)
- Sugestão #9 Monitoramento de Proteção (Relé) Opção A — feature futura

## Regras aplicadas na sessão

- ✅ **TDD em cada etapa** — Etapas B (11 specs) e C (19 specs) com
  specs primeiro (red), implementação depois (green), commit. Etapa D só
  dado (sem specs dedicados — comportamento de gatilho já testado
  genericamente).
- ✅ **Decisão 23** — Fase 1 read-only fechada (M21.1 / relatório
  `docs/relatorios/2026-05-23-fase1-bloco6-cadastro-proxy.md`); 3
  decisões produto travadas no prompt da Fase 2 + 1 decisão técnica
  orquestrador (aceitaMidia heurística).
- ✅ **Decisão 14** — grep amplo confirmou D-novo-Z e D-novo-AA livres
  antes de catalogar.
- ✅ **Multi-tenant** — `cooperativaId` herdada do indicador
  (`dadosTemp.cooperativaId`) propaga pra Cooperado novo E Indicacao
  formal. `filtroTenantSomenteLeitura(cooperativaId)` na busca do modelo
  `proxy_confirmar`.
- ✅ **Reuse** — desenho aproveitou model existente (sem delta schema),
  modelos de mensagem do banco, padrão Bloco 4/7 (ação privada + guard
  + validação + persistência multi-tenant + retry inline + mensagens
  hardcoded curtas), hardcoded preservado como fallback.
- ✅ **Padrão Bloco 4/7** — `executar*Proxy*` espelha estrutura
  existente. Adição do 5º param `media` é compatível com ações antigas.
- ✅ **Ritual PM2** (CLAUDE.md) — aplicado em Etapa D. Backend voltou
  limpo (0 restarts).
- ✅ **Commits pequenos e em português** — 4 commits de trabalho + 1
  fechamento. Mensagens com escopo claro.
- ✅ **NUNCA force push, sem --no-verify** — push normal.
- ✅ **Contatos teste** — não houve disparo real (specs com mocks +
  banco DEV). Regra preservada.
- ✅ **NÃO trabalhar paralelo com claude.ai** — Code 100% direto.
- ✅ **`git status --short` ANTES de cada commit** — confirmado.
- ✅ **Decisão 24** — frase de retomada em local único no
  `CONTROLE-EXECUCAO.md`.

## Frase comandante

Frase canônica única em `docs/CONTROLE-EXECUCAO.md` seção
`## FRASE DE RETOMADA — próxima sessão Code` (Decisão 24 — local único,
atualizada 23/05 no fechamento M22 Bloco 6).
