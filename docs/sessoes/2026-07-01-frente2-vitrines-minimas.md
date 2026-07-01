# Sessão 2026-07-01 — Frente 2: Vitrines Mínimas do Funil (FIX A + FIX B)

> Sessão Code dedicada — Frente 2 fechou em 2 commits limpos (FIX A backend + FIX B frontend)
> mais o fechamento retroativo do dia 28/06 (fix OCR modelo Anthropic) feito no início da
> sessão durante o ritual de retomada.

## TL;DR (pra leigo)
Depois do ritual de retomada canônica, você escolheu a Frente 2 (vitrines mínimas do funil).
Consertei o elo OCR→captação que estava quebrado (**FIX A**): a tela especial "Sua conta já
tem energia solar!" agora coleta "quem fornece sua energia hoje?" e o admin recebe aviso no
WhatsApp toda vez que o motor detecta lead de captação ou cadastro ambíguo (antes o motor
gravava a decisão mas ninguém era avisado). Depois coloquei a decisão do motor na frente do
admin (**FIX B**): badges visuais na lista e no detalhe do cooperado marcando 🎯 "Lead de
captação", ↪️ "Outro parceiro SISGD" ou ❓ "Revisar" (com tooltip explicando a razão), mais
um filtro por status na lista pra encontrar rapidamente pendências. Também fechei
retroativamente o commit órfão do dia 28/06 (fix OCR modelo Anthropic aposentado).

## Entregas + SHAs

### Retroativo 28/06 (feito na abertura da sessão)
- `b9ddd99` docs(sessao): fechamento retroativo 28/06 — fix OCR modelo Anthropic aposentado
  - Doc-sessão `docs/sessoes/2026-06-28-fix-ocr-modelo-anthropic.md`
  - CONTROLE-EXECUCAO: seção "ONDE PARAMOS — 2026-06-28" acima do M52b

### FIX A — backend + campo /cadastro
- `d343666` feat(funil): FIX A — captação créditos injetados + notificarAdmin V2
  - **web/app/cadastro/page.tsx**: tela especial "Sua conta já tem energia solar!" ganha
    input opcional "Quem fornece sua energia hoje?"; payload de `handleConfirmarContatoCreditos`
    passa a incluir `jaRecebeCreditosGd=true` (intrínseco dessa tela) + `fornecedorGdAtual`
    (opcional). Motor M48 agora classifica A_MIGRACAO/AMBIGUO_ADMIN corretamente.
  - **backend/src/publico/publico.controller.ts**: handler `cadastroWeb` V2 captura retorno
    de `cadastroWebV2` e dispara `notificarAdminRoteamentoCaptacao` fire-and-forget quando
    `roteamento.caminho === 'A_MIGRACAO' || 'AMBIGUO_ADMIN'`. Nova função com mensagens
    contextuais: cabeçalho "lead de CAPTAÇÃO" pra A_MIGRACAO, "cadastro AMBÍGUO — revisar"
    pra AMBIGUO_ADMIN. Função legada `notificarAdminCreditosInjetados` mantida intacta.
  - **Specs Jest** (6/6 verde) — `publico.controller.roteamento-captacao.spec.ts`:
    A_MIGRACAO dispara / AMBIGUO_ADMIN dispara / C_NOVO não / B_REDIRECT não / safeguard
    nula / body.jaRecebeCreditosGd chega no motor.
  - **Caronas** — 3 regressões PRÉ-EXISTENTES do Sprint M48 (22/06) sem cobertura,
    consertadas: mock stub `roteamentoCadastroService` nos 2 specs pré-existentes +
    4 assertions atualizadas pro 3º arg `roteamento` da assinatura mudada.
  - **Suite `src/publico/`** 67/67 verde (era 4 falhas latentes). Zero regressão real.

### FIX B — vitrines mínimas frontend
- `4c16ef8` feat(funil): FIX B — vitrine roteamento + filtro status cooperados
  - **web/app/dashboard/cooperados/page.tsx** (lista):
    - `CooperadoLista` ganha `roteamentoCaminho?` + `roteamentoRazao?` (opcionais).
    - Nova constante `ROTEAMENTO_CONFIG` com 3 caminhos: A_MIGRACAO (🎯 verde "Lead de
      captação"), B_REDIRECT_PARCEIRO (↪️ azul "Outro parceiro SISGD"), AMBIGUO_ADMIN
      (❓ amarelo "Revisar"). C_NOVO NÃO renderiza (evita ruído).
    - Badge inline no TableCell do nome, ao lado de SEM_UC/Cadastro incompleto. Tooltip
      `title={roteamentoRazao}`.
    - Novo state `filtroStatus` (client-side, mesmo padrão de `filtroParceiro`).
    - Dropdown `<select>` nativo ao lado da busca no CardHeader (padrão memória
      `solucao_select_nativo_dentro_dialog_19_05` — evita conflito z-index). 12 opções
      cobrindo enum StatusCooperado operacional (schema.prisma:490-512).
  - **web/app/dashboard/cooperados/[id]/page.tsx** (detalhe):
    - `CooperadoCompleto` ganha mesmos campos.
    - Badge no header (linha 1085), ao lado do status/tipoCooperado. `ROTEAMENTO_CONFIG`
      duplicado intencionalmente (escopo contido, sem componente shared).
  - Zero schema delta. Zero backend. TSC web exit 0. Rebuild + `pm2 restart cooperebr-frontend`.

## Verificação
- **Backend**: `pm2 stop cooperebr-backend → npm run build → pm2 start` — porta 3000 online,
  smoke `POST /publico/cadastro-web` retorna 400 esperado (validação).
- **Frontend**: `npm run build → pm2 restart cooperebr-frontend` — porta 3001 online,
  smoke `GET /dashboard/cooperados` retorna 307 esperado (redirect login sem sessão).
- **Specs Jest**: `src/publico/` 67/67 verde (era 63/67 pré-sessão — as 4 falhas eram
  latentes do M48).
- **TSC**: backend zero erro nos meus arquivos (erros restantes são de specs alheias
  pré-existentes); web exit 0.
- **Smoke E2E visual**: pendente do Luciano. Testar UI logando como admin e (i) validando
  badges na lista/detalhe se houver cooperado com `roteamentoCaminho` gravado; (ii) usando
  filtro de status; (iii) rodando o teste E2E do funil pra ver o motor decidindo em tempo real.

## Débitos
- **Nenhum novo criado.** Fixes cirúrgicos, aditivos.
- **Nenhum débito formal resolvido** — o elo OCR→captação quebrado era um bug latente sem
  catalogação prévia (equivalente ao commit 443ea09 de 28/06). Vale registrar tacitamente:
  "toda mudança de fluxo público de cadastro exige teste E2E do disparo admin".
- **Carona informal**: 4 regressões latentes do Sprint M48 (22/06) fechadas — não estavam
  no `debitos-tecnicos.md` porque ninguém rodou a suite `src/publico/` após o M48.

## Decisões
- **Padrão UX Luciano 17/05 (padrao_ux_edicao_inline_vs_pagina_propria)**: badges de sinal
  informativo (não editáveis) ficam INLINE junto ao nome. Filtros usam `<select>` nativo
  (memória `solucao_select_nativo_dentro_dialog_19_05`) evitando conflito z-index.
- **Escopo contido explícito** (marcado no prompt Luciano): NÃO fizemos dashboard agregado,
  NÃO adicionamos coluna de contagem de docs, NÃO tocamos Camada 3 (marketplace), NÃO mexemos
  em ConviteConvenioMembro. Só o mínimo que destrava a Frente 2.
- **Duplicação intencional** de `ROTEAMENTO_CONFIG` entre lista e detalhe — escopo contido
  não justifica criar componente shared agora. Se aparecer 3º callsite, refatora.

## Pendências / próximo passo
- **Próximo passo recomendado**: rodar o **teste integral E2E do funil pelas páginas**
  (frente #1 da FRASE DE RETOMADA do M52b), agora usando as vitrines novas como
  observatório visual do que o motor está decidindo. Referência:
  `docs/relatorios/2026-06-23-investigacao-funil-captacao-roteador-m48.md` §7. Agent
  `e2e-runner` disponível pra automatizar upload de fatura + assert no banco.
- **Alternativas** ainda abertas da FRASE DE RETOMADA do M52b:
  - 3 portas de config (`AMBIENTE_REAL=true` + `SUPER_ADMIN_SECRET_KEY` + senha SA) —
    ações de CONFIG do Luciano.
  - Camadas 2/3 do Funil (vitrines completas parceiro + SISGD marketplace) — spec do
    orquestrador necessária.
  - M52c escrituração retrospectiva (R$ 741 passivo pré-M50) — tarefa de código.
- **Regra Luciano 14/05 (contatos teste)**: quando for testar disparo WA/email real da
  notificação admin, o número já é `27981341348` (default do
  `ADMIN_WHATSAPP_NUMBER ?? '5527981341348'` no `notificarAdminRoteamentoCaptacao`).

## Próximo passo único e claro
Luciano decide entre: **(recomendada)** rodar teste E2E integral do funil usando as vitrines
novas como observatório visual, ou uma das 3 alternativas listadas acima da FRASE DE RETOMADA
do M52b.
