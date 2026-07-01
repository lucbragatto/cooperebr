# Sessão 2026-07-01 (2ª passagem) — Frente 2 Bloco B5 + Bloco C: pipeline completo de captação

> Segunda passagem do dia depois do Luciano estender o escopo da Frente 2. O
> reconhecimento inicial detectou que o prompt original já tinha sido entregue
> mais cedo (commits `d343666` FIX A + `4c16ef8` FIX B). Sobrou o escopo NOVO:
> B5 (card `consumoStashOcr` no detalhe) + C6 (fix backend `converter`
> multi-tenant SUPER_ADMIN) + C7 (botão Converter no `/relatorios/expansao`).
> Fechado em 4 commits limpos + smoke E2E do funil.

## TL;DR (pra leigo)
Terminei de fechar a Frente 2 ponta a ponta. Adicionei um card no detalhe do
cooperado que mostra os **dados brutos que o OCR extraiu no momento do cadastro**
— esse snapshot existia no banco desde junho mas não aparecia em nenhuma tela.
No lado do funil externo (leads que o bot capturou de outras cooperativas), fiz
2 coisas: (1) consertei um bug pré-existente do sistema — o botão de converter
lead em cooperado exigia `cooperativaId` do JWT, o que travava até o
super-admin (que naturalmente não tem tenant), então nem você conseguia
converter esses leads; e (2) coloquei o botão "Converter" na tela de leads
com formulário e seletor de parceiro (aparece só pra super-admin quando o
lead é órfão, ou seja, veio do bot sem tenant). Testei ponta a ponta com um
smoke real que dispara o WA no seu número: o motor classificou a declaração
"Cooperativa Solar Verde" como **lead de captação** (A_MIGRACAO) e você
recebeu a notificação no WA em tempo real. Decisões de produto travadas
(A_MIGRACAO/AMBIGUO_ADMIN fica no tenant que capturou; NÃO alimenta o
LeadExpansao) respeitadas.

## Entregas + SHAs (4 commits nesta 2ª passagem)

### Bloco B5 — card `consumoStashOcr` no detalhe do cooperado
- `b80cd8f` feat(funil): B5 — card 'Dados extraídos da fatura' no detalhe do cooperado
  - **`web/app/dashboard/cooperados/[id]/page.tsx`**:
    - `CooperadoCompleto` ganha `consumoStashOcr?: Record<string, unknown> | null`.
    - Novo card âmbar (destaca origem OCR do dado) entre "Dados Pessoais/Técnicos"
      e "Contratos Vinculados". Renderiza cada chave do JSON como `<Campo>`,
      com formatação leve (number/object/string). Ignora null/vazio.
  - Zero backend (findUnique do cooperado já retorna o campo; `schema.prisma:340`
    tem `consumoStashOcr Json?`).

### Bloco C6 — fix backend `converter` multi-tenant SUPER_ADMIN
- `c31d4eb` feat(funil): C6 — fix converter multi-tenant SUPER_ADMIN + adoção de lead órfão
  - **`backend/src/lead-expansao/lead-expansao.controller.ts`**:
    - Refactor da resolução de tenant por perfil.
    - **SUPER_ADMIN**: exige `cooperativaIdAlvo` no body, valida contra
      `Cooperativa.findUnique({ativo:true})` (padrão anti-spoof M45).
      NotFound se inexistente/inativa. Passa `permitirAdotarLeadOrfao=true`.
    - **ADMIN/OPERADOR**: mantém `cooperativaId` do JWT.
      `cooperativaIdAlvo` é IGNORADO via destructure-discard (defense-in-depth).
    - Validações de payload movidas pra antes da resolução (falha rápida).
  - **`backend/src/lead-expansao/lead-expansao.service.ts`**:
    - Nova opção `opts.permitirAdotarLeadOrfao?: boolean` (default false —
      retrocompat total).
    - `findFirst` com `OR [{cooperativaId: null}, {cooperativaId: alvo}]` quando
      é adoção — aceita órfão OU já-no-tenant. Bloqueia cross-tenant ativo.
    - `update` do lead: quando é adoção real (`lead.cooperativaId===null`),
      `where` só por id + `data` grava `cooperativaId` pra encerrar estado órfão.
      Se lead já pertencia ao tenant, mantém `where` estrito (M48 defense-in-depth).
  - **Novo spec** `lead-expansao-converter-super-admin.spec.ts` (14 testes):
    - controller: ADMIN sem cooperativaId → 403; OPERADOR idem; SUPER_ADMIN sem
      cooperativaIdAlvo → 400; alvo inexistente → 404; alvo inativo → 404; alvo
      válido → `permitirAdotarLeadOrfao=true` no service; ADMIN com body
      cooperativaIdAlvo forjado → ignorado; validações de payload; propagação
      de erros tipados.
    - service: adoção órfão (grava cooperativaId lead+cooperado); bloqueia
      cross-tenant ativo (findFirst OR retorna null); retrocompat (opts vazio);
      lead já no tenant alvo → where estrito.
  - **Suite `src/lead-expansao/`** 23/23 verde (era 9/9; zero regressão real).

### Bloco C7 — botão Converter no `/relatorios/expansao`
- `a6cb7ba` feat(funil): C7 — botão Converter no /relatorios/expansao (fecha ponta a ponta)
  - **`web/app/dashboard/relatorios/expansao/page.tsx`**:
    - `LeadItem` ganha `status?` + `cooperativaId?: string | null`.
    - Novo `STATUS_LEAD_CONFIG` (badge colorido: AGUARDANDO cinza / NOTIFICADO
      azul / CONVERTIDO verde).
    - Duas colunas novas na tabela: Status + Ações. Linhas CONVERTIDO ficam
      opacas + botão desabilitado.
    - SUPER_ADMIN carrega `GET /cooperativas` no mount (mesmo padrão de
      `/relatorios/inadimplencia`). Cache local durante a sessão.
    - Novo Dialog de conversão:
      - Form obrigatório (nome/CPF/email) + telefone opcional (prefill do lead).
      - Seletor de parceiro condicional: só aparece pra SUPER_ADMIN, com UX
        diferente quando lead é órfão (obrigatório + "— selecione —") vs
        quando já tem tenant (opcional + "manter tenant atual").
      - Tratamento humano de erros do backend (400/403/404) via `response.data.message`.
    - Após POST OK: marca lead como CONVERTIDO local (sem refetch inteiro).
  - Regra M45: SUPER_ADMIN sempre passa `cooperativaIdAlvo` no body; ADMIN nunca.

### Smoke E2E do funil — reproduzível
- `b5db215` test(funil): smoke E2E Frente 2 — motor reage à declaração de fornecedor
  - `backend/scripts/smoke-funil-frente2.mjs`: POST HTTP real no
    `/publico/cadastro-web?tenant=` com payload carregado + query direta no
    banco pra assert 6 invariantes:
    1. `jaRecebeCreditosGd=true` persistido
    2. `fornecedorGdAtual` persistido
    3. `roteamentoCaminho` gravado
    4. `roteamentoCaminho` ∈ {A_MIGRACAO, AMBIGUO_ADMIN}
    5. `roteamentoRazao` populado
    6. `consumoStashOcr` populado
  - **Run 01/07 — 6/6 verde.** Motor classificou "Cooperativa Solar Verde"
    como A_MIGRACAO com razão humano-legível: _"Fornecedor não bate com
    nenhum parceiro SISGD — concorrente fora da plataforma. Considerar
    fluxo de migração (M47)."_
  - Notificação admin disparou fire-and-forget (regra contatos teste 14/05
    respeitada: `ADMIN_WHATSAPP_NUMBER` default = `5527981341348` do Luciano).
  - Cleanup atômico (UCs + Cooperado).

## Verificação
- **Backend**: `pm2 stop → npm run build → pm2 start` — porta 3000 online.
  Suite `src/lead-expansao/` 23/23 verde. TSC limpo nos meus arquivos.
- **Frontend**: `npm run build → pm2 restart cooperebr-frontend` — porta
  3001 online. TSC web exit 0.
- **Smoke real**: `node backend/scripts/smoke-funil-frente2.mjs` 6/6 verde
  ponta a ponta.

## Débitos
- **Nenhum novo criado.**
- **Nenhum débito formal resolvido** — o bug do converter travado por JWT
  era latente sem catalogação (equivalente aos bugs FIX A/OCR-modelo desta
  mesma sessão de manhã).

## Decisões
- **Decisões de produto travadas pelo Luciano no prompt (não re-discutidas)**:
  - Caminho A_MIGRACAO/AMBIGUO_ADMIN fica DENTRO do tenant que capturou o
    cadastro. NÃO alimenta o LeadExpansao cross-tenant. São fluxos
    propositalmente SEPARADOS (respeitado nesta fatia — zero cross-pollination).
  - O botão Converter do LeadExpansao entra nesta fatia (não fica pra depois).
- **Padrão M45 respeitado**: SUPER_ADMIN sempre passa `cooperativaIdAlvo` no
  body validado; ADMIN nunca (destructure-discard). Nenhum spoof novo.
- **Regra contatos teste (14/05)** respeitada: `ADMIN_WHATSAPP_NUMBER` default
  é o número do Luciano — o smoke E2E disparou pra ele em tempo real como
  validação humana adicional.

## Pendências / próximo passo
- **Smoke visual manual** (opcional — smoke programático já cobriu ponta a
  ponta): login como SUPER_ADMIN → `/dashboard/cooperados` (validar badges +
  filtro status + detalhe de qualquer cooperado com `consumoStashOcr`) →
  `/dashboard/relatorios/expansao` (validar botão Converter + Dialog +
  seletor de parceiro pra lead órfão).
- **Alternativas** ainda abertas da FRASE DE RETOMADA do M52b:
  - 3 portas de config (`AMBIENTE_REAL=true` + `SUPER_ADMIN_SECRET_KEY` +
    senha SA) — ações de CONFIG do Luciano.
  - Vitrines COMPLETAS do funil (Camadas 2/3 — marketplace público — spec
    do orquestrador necessária).
  - M52c escrituração retrospectiva (R$ 741 passivo pré-M50).

## Próximo passo único e claro
Luciano decide entre as 3 alternativas acima (Frente 2 fechada em 2 passagens
neste dia: FIX A + FIX B pela manhã, B5 + C6 + C7 + smoke E2E à tarde,
ajustes P1+P2 do multitenant-reviewer no fim da tarde).

---

## Adendo — ajustes pós-review multitenant-reviewer (fim de tarde 01/07)

Após C6 pushado, o `multitenant-reviewer` levantou 2 achados reais (não é o padrão
tenant-spoof clássico — esse já estava fechado):

### P1 — serialization da corrida de adoção de lead órfão

- **Sintoma latente**: `findFirst` rodava FORA da `$transaction` sem
  `isolationLevel`. 2 SUPER_ADMINs adotando o MESMO lead órfão pra tenants
  diferentes ao mesmo tempo podiam ambos commitar → Cooperado duplicado +
  last-write-wins no lead.
- **Fix** (`lead-expansao.service.ts`):
  - `findFirst` + `create` + `update` DENTRO de `$transaction(..., { isolationLevel: 'Serializable' })`.
    Padrão `SERIALIZABLE_TX` herdado de `contratos.service.ts:11`.
  - Nova classe `LeadAdocaoConcorrenteError` (mesmo padrão dos erros tipados
    LeadNaoEncontrado/JaConvertido).
  - **Retry 1x automático** pra tolerar janelas curtas naturais. Após esgotado,
    controller mapeia pra `ConflictException(409)` com mensagem clara pro admin
    ("Este lead foi adotado por outra ação simultânea. Recarregue a lista.").
  - Erros de negócio (LeadNaoEncontrado/JaConvertido) saem direto do loop (não
    faz sentido retry). Erros DB não-serialização propagam sem retry.
  - Reconhecedor de conflito (`ehSerializationConflict`): code `'40001'` |
    `PrismaClientUnknownRequestError` | regex message — herdado de
    `publico.controller.ts:926` (auto-inscrever atômico).

### P2 — rastreabilidade multi-tenant no AuditLog

- **Sintoma latente**: `@AuditLog` do converter não usava `cooperativaIdSource`.
  SUPER_ADMIN convertendo lead → AuditLog gravava `cooperativaId=null` (JWT sem
  tenant), perdendo rastro do parceiro afetado.
- **Fix** (`lead-expansao.controller.ts`):
  - `@AuditLog({ ..., cooperativaIdSource: 'body:cooperativaIdAlvo' })`. Mecanismo
    existe desde `D-novo-AUDITLOG-TENANT-ALVO-SA` (Sprint M51, 23/06/2026).
  - Interceptor usa `body.cooperativaIdAlvo` SÓ quando JWT vazio (defense-in-depth:
    ADMIN/OPERADOR seguem auditando pelo JWT — SA malicioso não pula tenants por
    spoof de body porque o próprio findUnique anti-spoof já validou o alvo antes
    do dispatch).

### Verificação P1+P2

- **Suite `src/lead-expansao/`** 28/28 verde (era 23/23; +5 specs novos):
  - controller: `LeadAdocaoConcorrenteError` → 409 ConflictException.
  - service: `tx` recebe `{ isolationLevel: 'Serializable' }` no 2º arg.
  - service: serialization conflict 1x → retry sucesso.
  - service: serialization conflict 2x → `LeadAdocaoConcorrenteError` (retry esgotado).
  - service: erro NÃO-serialização (P2002 etc) → não faz retry, propaga original.
- **2 specs pré-existentes ajustadas** (findFirst agora dentro da tx exige mock de
  `tx.leadExpansao.findFirst`; assertion de `transaction.not.toHaveBeenCalled()`
  virou `cooperadoCreate.not.toHaveBeenCalled()` porque a tx é iniciada mas o check
  interno lança).
- **Smoke E2E do funil re-rodado 6/6 verde** — motor + notificação admin OK.
- **TSC limpo** nos meus arquivos. Zero schema delta.

### Commit
- `29ce545` fix(funil): P1+P2 multitenant-reviewer no converter (Serializable + auditLog tenant)
