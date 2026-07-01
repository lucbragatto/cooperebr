# Sessão 2026-07-01 (3ª passagem) — Jornada do Cooperado (unificação de visibilidade)

> Terceira passagem da sessão 01/07 depois do Luciano abrir uma frente nova
> (não continuação da Frente 2). Fase 1 read-only confirmou que 3 das 4 peças
> pedidas já existiam no schema (StatusCooperado rico, ListaEspera,
> EnvioListaConcessionaria/EnvioListaCooperado); faltava (a) o campo de origem
> do cadastro e (b) juntar tudo na tela do cooperado.
>
> **Aguarda re-review do Luciano antes de considerar mergeado** (regra do prompt).

## TL;DR (pra leigo)
Fiz aparecer numa tela só o que já estava espalhado. Cada cooperado agora tem
um card no topo do detalhe mostrando: (1) de onde veio (cadastro público /
sem UC / admin / indicação — ou "histórico" pros antigos que não sabemos),
(2) o status como um caminho visual em etapas (assinatura → pendente →
documentos → validação → concessionária → aprovado → ativo), (3) se está na
fila de espera com posição e kWh que falta pra sair, (4) se está numa lista
enviada pra concessionária EDP e em que ponto está. Na listagem geral,
ícones pequenos (⏳ na fila / 📋 lista concessionária andando) e um filtro
por origem. Zero mudança de comportamento, só visibilidade.

## Entregas + SHAs (4 commits)

### Bloco 1 — Schema + writers
- `2f8bfdd` feat(jornada): schema CanalCadastro + gravação nos 8 pontos de criação de Cooperado
  - **Schema delta aditivo (100% preserva histórico)**:
    - Novo enum `CanalCadastro { CADASTRO_PUBLICO, CADASTRO_SEM_UC, ADMIN_MANUAL, INDICACAO }`.
    - `Cooperado.canalCadastro CanalCadastro?` nullable.
    - Aplicado via `prisma db push` com backend parado (PM2 stop) — sem
      lock de query engine + zero risco de migração de dados (default null).
  - **8 pontos de gravação** (Fase 1 read-only catalogou):
    - `publico.controller.cadastroWebV2` → **CADASTRO_PUBLICO**
    - `publico.controller.cadastroSemUc` → **CADASTRO_SEM_UC**
    - `publico.controller.autoInscrever` (convite público) → **INDICACAO**
    - `cooperados.controller.create` (POST /cooperados admin) → **ADMIN_MANUAL**
    - `cooperados.service.cadastroCompleto` (wizard admin) → **ADMIN_MANUAL**
    - `cooperados.service.preCadastroProxy` (MLM indicador) → **INDICACAO**
    - `lead-expansao.service.converter` (admin converte lead) → **ADMIN_MANUAL**
    - `convenios.service` cooperadoSemUc conveniado → **ADMIN_MANUAL**
  - **Intencionalmente mantém null** (fora do prompt): cooperado-institucional
    (registro fantasma de sistema — salvaguarda 5/06) + whatsapp-bot/fluxo-motor/
    fatura (fluxos secundários).

### Bloco 2 — findOne com Jornada + specs + caronas
- `4967e8c` test(jornada): findOne com include Jornada + specs canalCadastro + caronas latentes
  - **`cooperados.service.findOne`** ganha:
    - `listaEspera` (only AGUARDANDO, ordenado por posição).
    - `enviosLista` (últimos 3, com `envio` incluído: id/numeroInterno/
      status/geradaEm/enviadaEm/liberadaEm — o suficiente pro link + badges).
  - **`cooperados.service.findAll`** ganha counts:
    - `_count.listaEspera { where: { status: 'AGUARDANDO' } }` → flag booleana.
    - `_count.enviosLista { where: { envio: { status: { in: [em andamento] } } } }` → flag booleana.
    - Retorno amplia com `canalCadastro`, `temListaEspera`, `temEnvioListaAndamento`.
  - **Spec novo `cooperados-jornada.spec.ts`** (3 testes): findOne monta
    include correto + roteamentoTenantAlvo permanece omitido + guard
    multi-tenant preservado.
  - **Spec ampliado `cooperados-controller-tenant-spoof.spec.ts`**:
    assertion nova de `canalCadastro=ADMIN_MANUAL` no `create` do controller.
  - **Caronas — 3 regressões PRÉ-EXISTENTES fechadas**:
    - `cooperados-controller-tenant-spoof.spec.ts`: stub `RoteamentoCadastroService`
      no construtor (M48 22/06 introduziu dep sem atualizar).
    - `cooperados.service.spec.ts` + `cooperados.controller.spec.ts`: providers
      `UsinasService/Whatsapp*/EmailService/FaturasService/UcsService/
      MotorPropostaService/MigracaoExternaService/RoteamentoCadastroService`
      adicionados (sprints M31+ acumularam deps).
    - `cooperados.service.guard-ativacao.spec.ts`: `findFirst` delega no
      `findUnique` mockado (sprint trocou padrão multi-tenant M45+).
  - **Suite** `src/cooperados/` + `src/lead-expansao/` + `src/publico/` +
    `src/convenios/` = **518/518 verdes** (43 suites). Zero regressão real.

### Bloco 3 — Smoke E2E ampliado
- `153b412` test(jornada): smoke E2E cobre canalCadastro=CADASTRO_PUBLICO no cadastroWebV2
  - Assertion nova no `smoke-funil-frente2.mjs`: verifica que o Cooperado
    criado por HTTP real tem `canalCadastro='CADASTRO_PUBLICO'`.
  - **Run 01/07 pós-schema-delta: 7/7 verde** (jaRecebeCreditosGd +
    fornecedorGdAtual + roteamentoCaminho + roteamentoRazao + consumoStashOcr
    + canalCadastro + roteamento ∈ {A_MIGRACAO, AMBIGUO_ADMIN}).

### Bloco 4 — Frontend
- `3051e1f` feat(jornada): card 'Jornada do Cooperado' no detalhe + ícones e filtro na lista
  - **`/dashboard/cooperados/[id]/page.tsx`**: card novo no TOPO do bloco
    `aba === 'geral'`, antes do checklist de ativação:
    - ① **Origem**: badge com `CANAL_CADASTRO_CONFIG` (🌐/💤/🧑‍💼/🤝);
      null → 📜 "Histórico" com tooltip explicando.
    - ② **Timeline visual do StatusCooperado**: 7 marcos em sequência
      linear (Assinatura → Pendente → Documentos → Validação →
      Concessionária → Aprovado → Ativo). Etapa atual em verde forte,
      alcançadas com ✓ em verde claro, futuras em cinza. Estados
      terminais (SUSPENSO/ENCERRADO/DESLIGADO/PENDENTE_MIGRACAO)
      caem no fallback de badge simples — quebrar a linha só confunde.
    - ③ **Fila**: linha aparece só se `cooperado.listaEspera[0]` existir.
      Mostra Posição #N + kWh necessário + link "Ver fila completa" →
      `/dashboard/motor-proposta/lista-espera`.
    - ④ **Lista concess.**: linha aparece só se `cooperado.enviosLista[]`
      tiver itens. Cada linha = número interno como link (→
      `/dashboard/listas-concessionaria/[envioId]`) + badge
      statusIndividual (PENDENTE/HOMOLOGADO/REJEITADO) + status do envio-mãe.
    - Tipos aditivos: `CooperadoCompleto` ganha `canalCadastro?` +
      `listaEspera?` + `enviosLista?`.
  - **`/dashboard/cooperados/page.tsx`** (lista):
    - Ícones inline ⏳ (fila) + 📋 (envio concess. andando) ao lado do
      badge de roteamento M48, no TableCell do nome. Só aparecem quando
      `temListaEspera` / `temEnvioListaAndamento` são true.
    - Novo dropdown "Filtrar por origem" ao lado do filtro de status
      (mesmo padrão UX select nativo 19/05).
    - `filtroCanal` client-side (mesmo padrão de `filtroStatus`/
      `filtroParceiro`).
    - `CooperadoLista` ganha `canalCadastro?` + `temListaEspera?` +
      `temEnvioListaAndamento?`.

## Verificação
- **Backend**: `pm2 stop → prisma db push → prisma generate → npm run build →
  pm2 start` — porta 3000 online. Suite `src/cooperados/` + lead-expansao/
  publico/convenios 518/518 verde. TSC limpo nos meus arquivos.
- **Frontend**: `npm run build → pm2 restart cooperebr-frontend` — porta 3001
  online. TSC web exit 0.
- **Smoke E2E do funil**: 7/7 verde (canalCadastro validado no fluxo público).
- **Smoke visual manual**: pendente do Luciano (login SUPER_ADMIN →
  `/dashboard/cooperados` (badges/ícones/filtro) → detalhe de cooperado
  específico com fila ou envio ativo → validar card Jornada).

## Débitos
- **Nenhum novo formal.**
- **3 caronas informais fechadas**: regressões pré-existentes das suites de
  cooperados (M48/M45/M31 sprints acumularam deps sem atualizar mocks). Não
  entram em `debitos-tecnicos.md` porque foram consertadas na mesma sprint.

## Decisões (respeitadas do prompt)
- **Escopo contido**: "unificação de visibilidade, não construção nova".
  Zero novo modelo, zero endpoint novo. Só (a) enum + campo + gravação nos
  5 canais listados; (b) findOne estendido; (c) UI de agregação.
- **StatusCooperado terminal fica fora da timeline linear**: 4 estados
  (SUSPENSO/ENCERRADO/DESLIGADO/PENDENTE_MIGRACAO) caem em badge de
  fallback — quebrar a linha com esses estados só confunde.
- **whatsapp-bot writers e cooperado-institucional mantêm canalCadastro=null**
  (intencional; fora do prompt).

## Pendências / próximo passo
- **Aguarda re-review do Luciano** antes de considerar mergeado (regra do
  prompt). Não abrir PR — commits já estão no main (padrão trunk-based
  desta sessão), mas o re-review é sobre a decisão de padrão do card e da
  ordem da timeline.
- Após re-review, se OK: smoke visual manual + eventualmente escrever
  canalCadastro nos writers WhatsApp bot como polimento futuro (não
  bloqueante).

## Próximo passo único e claro
Re-review Luciano das 4 mudanças (schema/writers + findOne+specs + smoke +
frontend). Se aprovado, escolha entre as 3 alternativas ainda abertas na
FRASE DE RETOMADA do M52b (3 portas de config / vitrines completas
Camadas 2/3 / M52c retro), ou uma nova frente.
