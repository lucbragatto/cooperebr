# Especificação — Circuito CooperToken + Convênio (plano de finalização)

> Criado 04/06/2026. Consolida o desenho do circuito completo do CooperToken
> (voucher de circuito fechado) + convênio corporativo, com base em 3 pareceres do
> agente `cooperebr-analista-conformidade` e na decisão **COOPERADO-ONLY**.
> Diagrama visual: `Downloads/circuito-cooper-token-completo.html`.
> Decisões/memória: `~/.claude/.../memory/decisao_modelo_token_voucher_sobra_resgate_2026_06_04.md`.
> Objetivo deste doc: **reaproveitar ao máximo o que já existe** e não refazer sem necessidade.

## 1. Decisões travadas (fundação)

1. **COOPERADO-ONLY** — para participar do **Clube** OU fazer **convênio** é
   obrigatório ser **cooperado (PF ou PJ)**. Já previsto no estatuto. → **todas as
   operações são ato cooperativo (Art. 79)**; não existe "não-cooperado". Mantém teto
   de 25%/usina por cooperado (REN 1.059/2023 Art. 655-P IV).
2. **Dois rios separados:** ENERGIA→SOBRA (dinheiro, proporcional à energia, isento,
   mensal) × TOKEN→BENEFÍCIO (circuito fechado; abate fatura/parceiros; sai por
   resgate). Sobra acompanha **energia**, nunca token.
3. **Token = voucher de circuito fechado**, cooperativa = **emissora única**.
4. **Saída de valor:** parceiro do Clube → **RESGATE/liquidação** (quita passivo,
   recibo, sem NF de venda); cooperado → **SOBRA**. **Nunca "recompra".**
5. **Remuneração da coop sem taxa explícita:** margem de energia + float + quebra +
   **queima** configurável (taxa em token). Modo padrão = híbrido.
6. **Convênio = duas pontas, fatura única segregada:** energia (custeio) + token
   (adiantamento). Linhas separadas obrigatórias (Art. 87).

## 2. Atores + a colisão da palavra "parceiro" (CRÍTICO p/ nomenclatura)

A palavra "parceiro" hoje é usada em 2 sentidos — **precisa desambiguar (decisão 04/06):**

| Termo | O que é | UI / código |
|---|---|---|
| **Parceiro (do SISGD) = TENANT** | quem **paga o SISGD** pra usar o sistema: cooperativa, consórcio, associação, condomínio. **CoopereBR é nossa parceira** (uma entre várias). Área `/parceiro/*` (usinas, membros, contratos, financeiro…) | manter "Parceiro" = tenant; na UI usar o nome do tipo (Cooperativa/Consórcio/Associação/Condomínio) via `useTipoParceiro()` |
| **Estabelecimento do Clube** (proposto; era "Parceiro do Clube") | o **cooperado PF/PJ** que aceita CooperTokens (restaurante/academia…) | **NÃO reusar "parceiro"** (colide com tenant). Termo sugerido: **"Estabelecimento do Clube"**. É um cooperado com flag de estabelecimento |

> ⚠️ Os endpoints `cooper-token/parceiro/*` hoje operam por **cooperativaId** (tenant) —
> ou seja, "parceiro" ali = a cooperativa. O modelo novo do Rio 2 exige o
> **Estabelecimento do Clube = cooperado (PF/PJ)**, que é coisa diferente. Renomear na UI
> pra não confundir tenant × estabelecimento. Essa é a principal mudança de modelagem (Fatia D).

Atores do circuito: Cooperativa (emissora) · Cooperado COM UC · Cooperado SEM UC ·
Parceiro do Clube (cooperado PF/PJ) · Empresa conveniada (cooperada PJ) · Funcionário
cooperado.

## 3. Mudanças transversais (valem em TODAS as telas)

- **Nomenclatura única:** "CooperToken(s)" no lugar de "CTK" pro usuário final.
  Verbo do beneficiário = **usar/aplicar/resgatar** (nunca "pagar"). Substituir
  "Pagar com Tokens" / "Usar Tokens" por rótulo único. (Hoje: 23 ocorrências de
  CTK/"Pagar/Usar Tokens" em 8 arquivos.)
- **Dois rios visíveis:** separar claramente "**Crédito de energia (kWh)**" de
  "**CooperToken**" — nunca apresentar os dois como o mesmo "saldo".
- **Resgate, nunca recompra:** todo texto de saída em dinheiro usa "resgate/
  liquidação".
- **Help inline obrigatório** (regra do projeto): toda página/função ganha banner/
  tooltip/empty-state explicando "pra que serve + exemplo".

## 4. Inventário por superfície — REUSE × MUDAR × NOVO

### 4.1 Login
- `web/app/login/page.tsx` · `web/app/portal/login/page.tsx`
- **Reuse:** estrutura de login.
- **Mudar:** credenciais de teste visíveis (já pedido), help "o que é cada portal".

### 4.2 Portal do cooperado (`/portal/*`) — usuário final
- **Reuse (mantém):** `tokens` (saldo, abater fatura, QR), `clube` (ofertas, resgate),
  `creditos` (kWh→PIX SEM_UC), `indicacoes`, `financeiro`, `ucs`.
- **Mudar:**
  - `portal/layout.tsx` — incluir **Tokens** e **Clube** no menu inferior (hoje só na home).
  - `portal/page.tsx` — rótulo "Pagar com Tokens" → "Meus CooperTokens".
  - `portal/tokens/page.tsx` — título único, "CTK"→"CooperTokens", texto do QR
    "processe o pagamento"→"use seus CooperTokens como desconto", help inline +
    aviso "tokens não viram dinheiro; energia/clube/parceiros".
  - `portal/clube/page.tsx` — "CTK"→"CooperTokens", help.
  - `portal/creditos/page.tsx` — deixar explícito "isto é **crédito de energia**, não
    token" (separar os rios) + **trava de saldo** (hoje aceita qualquer kWh) + help.
- **Novo:** card/seção "Sobra do mês" (Rio 1) quando a distribuição mensal existir.

### 4.3 Portal da empresa conveniada (`/portal/meus-convenios/*`)
- **Reuse:** backend `portal-empresa.controller.ts` + guard `pagador-cooperado.guard.ts`
  (login PJ, dashboard, convites, aprovar). Mockup: `Downloads/mockup-portal-empresa-conveniada.html`.
- **Mudar/Novo:** bloco **capacidade kWh** (soma dos funcionários) + bloco **tokens**
  (opcional, regra de distribuição) + **cobrança segregada** (energia + token em 2
  linhas) + help.

### 4.4 Área do tenant/cooperativa (`/parceiro/*` e `/dashboard/*`) — admin
- **Reuse (mantém):** `dashboard/cooper-token` (ledger/admin), `cooper-token-financeiro`,
  `clube-vantagens` (+config, ranking), `convenios` (+novo, [id]), `indicacoes`,
  `parceiro/*` (gestão do tenant).
- **Mudar:**
  - `dashboard/cooper-token-parceiro` + `parceiro/{receber,enviar,tokens-recebidos}` —
    hoje "parceiro" = tenant; **renomear** para deixar claro que é a **cooperativa**
    operando, e separar do novo "Parceiro do Clube" (cooperado).
  - `convenios/novo` — captar as **duas pontas** (energia + token) + flag
    `registrarComoIndicacao` + regra de distribuição + help.
  - `clube-vantagens` — vincular "Parceiro do Clube" ao **cadastro de cooperado**
    (flag estabelecimento), não a uma entidade solta.
- **Novo:**
  - **Painel de parâmetros do CooperToken** por cooperativa (% token, teto fatura,
    queima, expiração, desvalorização, modo remuneração) — `cooper-token/admin/config`
    já existe parcialmente; **estender**.
  - **Resgate ao Parceiro do Clube** (token→R$ + recibo) — tela admin + endpoint.
  - **Distribuição de token em lote** (convênio) — tela admin + endpoint.

### 4.5 Parceiro do Clube (estabelecimento = cooperado PF/PJ)
- **Reuse:** `parceiro/clube/validar` (validar código de resgate) + endpoints token do parceiro.
- **Novo (modelagem):** "Parceiro do Clube" = **cooperado** com flag estabelecimento;
  tela do parceiro: tokens recebidos, **abater energia** (se tem UC) ou **solicitar
  resgate em R$** (recibo). Reusa muito de `cooper-token-parceiro`, mas no nível
  **cooperado**, não tenant.

## 4.7 Inventário das funções existentes (reuse) + convites multi-nível (Fase 1, 04/06)

**CooperTokens** ✅ maduro — saldo/extrato, gerar/processar QR, usar-na-fatura, cobranças-pendentes; admin config/ledger/financeiro; "parceiro" (=tenant) saldo/comprar/usar-energia/transferir/enviar.
**Clube de Vantagens** ✅ maduro — ofertas, resgatar (gera código), meus-resgates, ranking, config.
**Indicações (MLM)** ✅ maduro — membro: `meu-codigo`/`meu-link`/`minhas`/`beneficios`/`registrar`; admin: `listar`/`arvore`/`relatorio`/`config`/`processar-pagamento`. Recompensa: `BeneficioIndicacao` (R$, abate fatura) + 50 tokens (hardcoded).
**Ranking de indicadores** ✅ — `clube-vantagens.getRankingPorPeriodo` (mes/ano/total); páginas `portal/ranking` + `dashboard/clube-vantagens/ranking`.

**Convites — 4 mecanismos distintos:**

| Mecanismo | Model | Quem cria HOJE | Gap |
|---|---|---|---|
| Indicação MLM | `ConviteIndicacao` | **só o bot WhatsApp** (`whatsapp-bot:2196`); admin só lista/reenvia/cancela | **G1: admin da cooperativa NÃO cria/envia convite pela web** |
| Convênio | `ConviteConvenioMembro` | admin + empresa (portal), com OTP | ok |
| Proprietário (usina) | `ConviteProprietario` | admin (usina→dono) | ok |
| Link de indicação | `Indicacao` via `?ref=` | membro (`meu-link`) | ok |

**Níveis de convite (decisão/ponto Luciano 04/06):**
- **Super-admin (SISGD):** gerencia convites cross-tenant (via `cooperativaId`). Onboarding de **novo parceiro** (cooperativa) hoje = criação manual em `/dashboard/cooperativas/nova` — **G2: não há "convite de parceiro" como tal** (confirmar se quer).
- **Admin do parceiro (cooperativa):** gerencia indicação + cria convênio/proprietário; **mas não cria convite de indicação proativo pela web (G1)**. Como tenant que administra usinas e usuários, **pode e deve** poder gerar e enviar os próprios convites.
- **Membro:** `meu-link` + bot WhatsApp ("meus convites/indicações").

**Gaps consolidados:** G1 (admin cria/envia convite de indicação pela web), G2 (super-admin convida novo parceiro), + indicador real no convênio, 50 hardcoded, colisão "parceiro".

## 5. O que falta construir (com cooperado-only, quase tudo destrava)

### Trilha A — sem dependência jurídica (construir já)
1. Nomenclatura única + Tokens/Clube no menu + help inline (todas as telas §3/§4).
2. Separar os dois rios na UI (`creditos` vs `tokens`).
3. Corrigir indicação: creditar **indicador real** (não dono do convênio) + tirar
   **50 tokens hardcoded** → parâmetro.
4. ~~Trava de saldo na conversão~~ **CANCELADO (decisão 04/06: sem trava).** Em vez disso: garantir
   que o **teto de abatimento por token** (`descontoMaxPerc`) **reserve o arrendamento do dono da usina**
   — o desconto-token sai da margem da coop, nunca da parte do arrendamento. Teto já existe/aplicado
   (`usarNaFatura`→`calcularDesconto`); ⚠️ é % da fatura — atrelar à margem real = débito do Módulo Contabilidade.
5. Infra do **painel de parâmetros** (estende `cooper-token/admin/config`) — inclui `bonusIndicacao` (campo novo).
6. **Convênio viral:** flag na assinatura (empresa habilita token por indicação de funcionário). Token de
   indicação **gera cobrança à empresa** → vantagem IR (despesa de benefício dedutível). **Timing:**
   default = cobrança+token só **após** cadastro confirmado pelo admin + enviado à concessionária + indicado
   **recebendo créditos** (≈ ATIVO_RECEBENDO_CREDITOS); opcional = emissão **imediata** (cobrança na hora →
   token após pagamento) se a empresa autorizar.
7. **G1 — Cooperativa cria/envia convite de indicação pela web** (hoje só via bot; reusa
   `convite-indicacao.criarConvite` que já existe no service → expor endpoint + UI admin). Segue a regra de timing.
8. **G2 — Super-admin convida novo PARCEIRO (tenant) E novos COOPERADOS** (convite a nível SISGD). Segue a regra de timing.

### Trilha B — antes dependia de carimbo; com cooperado-only fica viável (faltam só os formais)
6. **Parceiro do Clube = cooperado PF/PJ** (modelagem) — base do Rio 2.
7. **Resgate token→R$ ao parceiro** (recibo, sem NF de venda).
8. **Convênio 2 pontas + cobrança segregada** (energia + token).
9. **Distribuição de token em lote** pela empresa.
10. **Sobra mensal** ligada à energia (Rio 1).
11. **Queima** configurável por transação.

## 6. Sequência de implementação sugerida + teste

1. **Fatia A** (UX/nomenclatura/help/menu + separar rios) — entrega usabilidade.
2. **Fatia B** (bugs: indicador real, 50 hardcoded, trava de saldo).
3. **Fatia C** (parâmetros configuráveis do token).
4. **Fatia D** (Parceiro do Clube = cooperado + resgate ao parceiro).
5. **Fatia E** (convênio 2 pontas + cobrança segregada + distribuição em lote).
6. **Fatia F** (sobra mensal + queima).
7. **Teste E2E** de ponta a ponta (com contatos de teste — regra 14/05; `isAmbienteReal()`).
   Build + `pm2 restart` obrigatórios (regra de infra).

## 7. Próximo módulo (após build + teste OK)

**Contabilidade Tributária Segregada** (já no roadmap — `docs/especificacao-contabilidade-cooperativa-segregada.md`),
agora **atualizado com as novidades:**
- Segregação **energia (auxiliar/próprio) × token (adiantamento) × resultado de
  quebra/queima** por natureza.
- Cobrança do convênio **segregada** (Art. 87) como pré-requisito contábil.
- Política contábil escrita de **quebra de token** (prazo de reconhecimento).
- Sobra mensal proporcional à energia (não ao token).
- Tudo como **ato cooperativo** (cooperado-only) — base da isenção.

## 8. Portões jurídicos restantes (poucos, pós cooperado-only)

- **Política de quebra** escrita/aprovada antes de emitir token a empresa.
- **Caracterização federal da quebra/queima** (ato cooperativo vs outras receitas) — contador.
- **ISS** sobre eventual taxa/queima no município sede — contador.
- **Teto de 25%** por cooperado (inclusive empresa PJ) — controle no sistema.
- **⚠️ STF Tema 536** em julgamento (plenário físico) — monitorar; cenário fallback se tributar.
- **CLT 458** no convênio — risco da empresa; cláusula no contrato de convênio.
- **Lei 12.865** — só relevante se abrir rede a não-cooperados (não é o caso: cooperado-only).

## 9. Débito de cadastro/onboarding — D-novo-CAD-CONSUMO-MENSAL (capturado 05/06 na validação)

**Origem:** Luciano, percorrendo o `/cadastro?conv=` (step Instalação), notou que o consumo é **1 campo só** ("consumo médio mensal"). Quer **mês-a-mês + projeção + visibilidade**.

**Feature desejada:**
1. Step Instalação: capturar consumo **mês a mês (12 meses)** em vez de 1 média. **Recomendação: o OCR da fatura PRÉ-PREENCHE** os 12 meses (a conta de luz já traz o histórico) + a pessoa **confere/edita** (menos fricção). Manual como fallback.
2. Calcular **total + média** automaticamente.
3. **Projeção de créditos:** mostrar à pessoa "você vai receber ~X kWh de crédito/mês" / economia estimada — **reusa o motor-proposta**.
4. **Salvar** histórico mensal + média + projeção, vinculado ao cadastro/UC/contrato.
5. **Visibilidade:** a **empresa conveniada** (ex.: Clinica) vê os dados dos seus funcionários (portal empresa) **e** a **cooperativa** (admin) vê na **lista de espera** / cadastro do membro.
6. Contexto: a pessoa entra na **lista de espera** → admin aprova **vendo consumo + projeção**.

**Reusa:** motor-proposta (cálculo), faturas/OCR (histórico mensal), lista-espera, portal-empresa (visibilidade).
**Fase 1 necessária:** mapear estruturas de consumo (FaturaProcessada / histórico / campos da UC), o que o OCR já extrai, o cálculo do motor, onde o cadastro salva hoje, como lista-espera + portal-empresa exibem dados do membro.
**Custo:** médio (~8-15h). Fatia própria. NÃO bloqueia F-G2.
