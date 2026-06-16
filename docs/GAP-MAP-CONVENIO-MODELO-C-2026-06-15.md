# GAP-MAP — Modelo Convênio C (energia + token) — o que temos × o que falta

> **Data:** 2026-06-15 · **Tipo:** diagnóstico read-only (nenhum código alterado, nenhuma migration)
> **Base:** 4 leitores profundos paralelos (Plano/Matrícula · Energia/Arrendamento · Token/Cash-out · Contábil) + síntese do orquestrador cruzando com `docs/ANALISE-CONVENIO-TOKEN-CLUBE-2026-06-15.md` e o estado da sessão 15/06. Toda linha tem evidência `arquivo:linha`.
> **Correções vs entendimento anterior:** (1) a **lista pra concessionária NÃO é "CSV efêmero"** — existe módulo `EnvioListaConcessionaria` com FSM completo (§ item 5). (2) A suspeita "Q2 sem creditador" do relatório anterior está **resolvida** — o listener existe e credita (§ item 10).

---

## 1. Tabela estado-alvo × atual

| # | Item do Modelo C | Status | Evidência `arquivo:linha` | O que falta |
|---|---|---|---|---|
| **1** | Plano do convênio com desconto=0, publico=false | ✅ **EXISTE** | Plano "Custeado por convênio" no seed: `planos.service.ts:65-91`; campos `descontoBase`/`publico`/`custeadoPorConvenio` `schema.prisma:757,761,798` | DTO público exige `descontoBase>=1` (`create-plano.dto.ts:41`) → não dá pra criar OUTRO plano desconto=0 pela UI (o do seed basta) |
| **2** | Vínculo Plano ↔ Convênio | ⚠️ **PARCIAL** | `ContratoConvenio` **não tem `planoId`** (`schema.prisma:1504-1649`); vínculo via `Contrato.planoId` (`schema.prisma:689`); motor acha o plano por flag `custeadoPorConvenio` (`membro-builder.service.ts:160-173`) | Campo `ContratoConvenio.planoId` (plano escolhível por convênio) — hoje é chumbado por flag |
| **3** | Matrícula em lote dos colaboradores no plano | 🟡 **PARCIAL** | CSV import `convenios-membros.service.ts:221-243`; aprovação dispara motor→Contrato c/ plano (`convenios-aprovacao.service.ts:525` → `motor-proposta.service.ts:844`) | **Aprovação em lote** (hoje é 1-a-1); bulk-set de plano em contratos vivos |
| **4** | Empresa custeia **arrendamento** proporcional (como receita) | ❌ **FALTA o elo** | `ARRENDAMENTO_USINA` é **despesa** da coop (`repasse-mensal.cron.ts:205`); custeio consolidado é de **ENERGIA**, não arrendamento (`convenios-custeio.service.ts:1003-1014`); fórmula de rateio existe mas só pra kWh (`ratear-proporcional-custeio.ts:84-91`) | O elo "empresa paga cota proporcional do **arrendamento** como RECEITA" não existe — **decisão de produto + build** |
| **5** | Alocação de kWh + lista pra concessionária | ✅ **EXISTE (completo)** | `Contrato.percentualUsina` `schema.prisma:700`; `Usina.capacidadeKwh` `schema.prisma:556`; cálculo `migracoes-usina.service.ts:141`; **lista**: `EnvioListaConcessionaria` (FSM RASCUNHO→…→HOMOLOGADO) `schema.prisma:3358`, `envio-lista-concessionaria.service.ts:131-243` | só CSV export (talvez já no front) + ACK automático da concessionária |
| **6** | Compra de token "em razão cooperativa" (custo×venda) | ⚠️ **PARCIAL** | preço único `valorTokenReais` (`cooper-token.service.ts:4038`, `ConfigCooperToken.valorTokenReais` `schema.prisma:2992`) | **Distinção preço de custo × preço de venda** — decisão de produto |
| **7** | Distribuição de token em lote | ✅ **EXISTE** | F3 `distribuirTokens` `cooper-token.service.ts:1291`; tela `/conveniada/.../distribuir-tokens`; quantidade item-a-item (UI decide) | nada (gate `taxaTransfer>0` é decisão à parte) |
| **8** | **CASH-OUT token → PIX ao colaborador comum** | ❌ **NÃO EXISTE (mas a máquina existe)** | F6 `solicitarResgate` token→PIX **gated por `ehEstabelecimento`** (`cooper-token.service.ts:1999`); `ConversaoCreditoSemUc` é kWh→PIX p/ SEM_UC (`schema.prisma:2955`, `conversao-credito.service.ts:10-54`, tela `/portal/creditos`); cadastro PIX em `/portal/seguranca/dados-bancarios` | Abrir o resgate pro colaborador comum (extensão do F6) — **decisão de produto: qual dos 3 caminhos** (§3) |
| **9** | Elo contábil de cada perna → `LancamentoCaixa` (token=passivo) | ⚠️ **MEIO + furos** | F1 emissão ✅ `token-contabil.service.ts:64`; F2 compra ✅ (via `EMITIDO`); F4b fatura ✅ `:137`; **F3 ❌**, **F6 ❌**, **clube ⚠️** (PROVISIONAL placeholder, não passivo próprio) | **3 pernas sem lançamento** + conta "Passivo Tokens a Resgatar" tipada **DESPESA** (deveria PASSIVO) `token-contabil.service.ts:25` + PROVISIONAL nunca vira CONFIRMADO |
| **10** | Q2 — creditador da progressão de faixa | ✅ **CONFIRMADO (funciona)** | evento `convenios-progressao.service.ts:122` → listener `cooper-token.service.ts:565-592` → `creditar()` (`:578`) tipo `BENEFICIO_CONVENIO` ao `conveniadoId` | nada — funciona |

**Placar:** ✅ pronto: itens 1, 5, 7, 10. ⚠️ parcial: 2, 3, 6, 9. ❌ falta de fato: **item 4 (arrendamento proporcional)** e **item 8 (cash-out colaborador)** — os dois são **decisão de produto antes de build**.

---

## 2. Workflow do Modelo C — desenhado (passo a passo)

### Trilho ENERGIA
| Passo | Ação | Módulo / tabela | Existe? |
|---|---|---|---|
| E1 | Empresa firma convênio → vira Cooperado PJ pagador | `ContratoConvenio` (`pagadorCooperadoId`) | ✅ |
| E2 | Empresa traz colaboradores → cooperados (convite/CSV/aprovação dupla) | `ConvenioCooperado` + `convenios-membros` | ✅ |
| E3 | Colaboradores entram no **plano sem desconto** | Plano "Custeado por convênio" + motor (`membro-builder`) | ✅ (auto na aprovação; 1-a-1) |
| E4 | **Empresa custeia o arrendamento proporcional** | — | ❌ **FALTA** (existe custeio de energia, não de arrendamento) |
| E5 | Coop aloca kWh aos colaboradores (% por contrato) | `Contrato.percentualUsina` / `Usina.capacidadeKwh` | ✅ |
| E6 | Coop manda lista pra concessionária (validar→enviar→protocolo→homologar) | `EnvioListaConcessionaria` (FSM) | ✅ |
| E7 | Cada perna gera `LancamentoCaixa` com natureza | `LancamentoCaixa` + `contabilidade-tributaria` | ⚠️ energia consolidada sim; arrendamento-receita não existe |

### Trilho TOKEN (reserva)
| Passo | Ação | Módulo / tabela | Existe? |
|---|---|---|---|
| T1 | Empresa compra token (preço de custo cooperativo) | F2 `comprarTokensCooperado` + `CooperTokenCompra` + Asaas | ✅ (preço único; sem custo×venda) |
| T2 | Empresa distribui token aos colaboradores em lote | F3 `distribuirTokens` + tela | ✅ |
| T3 | Faltou kWh no mês → colaborador pede **cash-out** | — (só F6 p/ estabelecimento) | ❌ **FALTA** (extensão do F6) |
| T4 | Coop deposita R$ via PIX na conta do colaborador | `AsaasPixOutService` (já usado no F6) | ✅ a máquina; ❌ a ponta colaborador |
| T5 | Colaborador paga a própria conta com o R$ | (fora do sistema) | n/a |
| T6 | Cada perna gera `LancamentoCaixa` (token=passivo; redenção=baixa) | `token-contabil` | ❌ F3/F6/clube sem lançamento |

---

## 3. Plano de construção ordenado por dependência

> Legenda: 🔌 **ligar o que já existe** · 🏗️ **construir do zero** · ⛔ **decisão de produto (bloqueia)**

### Fase 0 — Decisões de produto (bloqueiam tudo)
- ⛔ **D1 (item 4):** "empresa custeia arrendamento proporcional" — a empresa paga (A) só a **energia** dos seus colaboradores (já existe), ou (B) também uma **cota proporcional do arrendamento da usina** (não existe)? Se (B), definir a base da proporção (nº colaboradores ÷ capacidade? kWh dos colaboradores ÷ total?).
- ⛔ **D2 (item 8):** cash-out do colaborador comum — qual dos 3 caminhos: **(i) abrir o F6** removendo o guard `ehEstabelecimento` (mais barato, reusa tudo); (ii) novo modelo `ResgateColaborador`; (iii) unificar num fluxo genérico "tem chave PIX → pode resgatar".
- ⛔ **D3 (item 6):** token tem **preço de custo × preço de venda** ou segue preço único?
- ⛔ **D4:** **validade do token** (ainda não decidida) — expiração por prazo, oxidação/decay, ou nenhuma (hoje as 3 fontes divergem).

### Fase 1 — Schema (pequeno, aditivo)
- 🏗️ `ContratoConvenio.planoId` (item 2) — torna o plano escolhível por convênio (em vez de chumbado por flag).
- 🔌 Corrigir tipo da conta `5.1.02 "Passivo Tokens a Resgatar"`: DESPESA → **PASSIVO** (`token-contabil.service.ts:25`).
- 🏗️ (se D1=B) modelo/elo de **receita de cota de arrendamento** por convênio.

### Fase 2 — Backend "ligar o que já existe"
- 🔌 **Cash-out colaborador (D2):** se (i), abrir o F6 (`solicitarResgate`) pra qualquer cooperado com `pixChave` cadastrada — reusa `AsaasPixOutService`, `ResgateRecibo`, o cadastro de PIX. **~70% já construído.**
- 🔌 **Contábil das 3 pernas faltantes:** F3 (distribuição), F6 (resgate PIX), resgate-clube → emitir lançamento reusando o padrão de `lancarResgateFatura`/`lancarEmissaoFaturaCheia` (`token-contabil.service.ts`). Token entra/baixa do **passivo** corretamente.
- 🔌 **Aprovação em lote** de membros do convênio (hoje 1-a-1).

### Fase 3 — Backend "construir do zero"
- 🏗️ (se D1=B) **elo arrendamento proporcional:** aplicar a fórmula de rateio (que já existe pra kWh) ao `ARRENDAMENTO_USINA`, gerando a RECEITA da empresa proporcional. Conecta `convenios-custeio` ↔ `contas-pagar`.

### Fase 4 — Frontend
- 🏗️ Tela de **cash-out do colaborador** (`/portal/resgatar-tokens` hoje só abre pra estabelecimento → abrir/condicionar).
- 🔌 (plano, lista concessionária, distribuição já têm telas).

### Fase 5 — Contábil (obrigatório do Modelo C)
- 🔌 Garantir que **TODA** perna gera `LancamentoCaixa` com `naturezaAto` correto (depende da Fase 2 contábil).
- 🏗️ Transição `PROVISIONAL` → `CONFIRMADO` (hoje fica órfão) + reconciliação.
- 🏗️ Conectar os **2 motores contábeis** (`token-contabil` preparatório ↔ `contabilidade-tributaria` segregado) — hoje desconectados.

---

## 4. Riscos

| Risco | Severidade | Evidência | Nota |
|---|---|---|---|
| **Token-passivo não escriturado** | 🔴 ALTA | F3/F6/clube sem `LancamentoCaixa`; conta tipo DESPESA (`token-contabil.service.ts:25`) | o passivo do token só existe no ledger de token, **não no balanço** — fura o item 7 (contábil obrigatório) |
| **`PROVISIONAL` órfão** | 🟡 MÉDIA | nunca vira CONFIRMADO | lançamentos preparatórios acumulam sem confirmação |
| **Cash-out = fato gerador fiscal** | 🟡 MÉDIA | (a definir) | token→R$ via PIX ao colaborador pode ter implicação tributária/trabalhista diferente de "abater fatura" — validar com contador/advogado (ver skill `coopere-especialista`: mandato × benefício) |
| **Multi-tenant (herdado)** | 🟡 MÉDIA | `meusConvenios`/admin `remove` (já catalogados: D-novo-CONVENIO-ADMIN-IDOR + Track B.2 resolvido) | corrigir antes da 2ª cooperativa |
| **Inconsistências de config** | 🟡 MÉDIA | validade do token (3 fontes), preço único sem custo×venda, plano por flag vs campo | decisões D3/D4 resolvem |
| **Plano só nasce no seed** | 🟢 BAIXA | DTO exige `descontoBase>=1` (`create-plano.dto.ts:41`) | UI não cria outro plano desconto=0 (o do seed basta hoje) |

---

## 5. Perguntas abertas pro Luciano

1. **(D1 — item 4) "Comprar crédito de energia" = custear arrendamento proporcional?** A empresa paga (A) só a energia dos colaboradores [já existe], ou (B) uma **cota proporcional do arrendamento da usina** [falta construir]? E qual a base da proporção?
2. **(D2 — item 8) Cash-out do colaborador comum:** quer? E qual caminho — **abrir o F6** (mais barato), novo modelo, ou unificar genérico? *(Recomendo abrir o F6 — a máquina token→PIX já está pronta e validada; é só tirar o cadeado `ehEstabelecimento`.)*
3. **(D3 — item 6) Preço de custo × venda do token** ou preço único? Isso muda a margem da cooperativa e a proposta de valor pra empresa.
4. **(D4) Validade do token** — qual modelo vale (prazo, oxidação, ou nenhum)? Hoje doc/schema/código divergem. **Bloqueia o contábil** (saber se há "quebra/breakage").
5. **Contábil:** confirma que quer **TODA** perna escriturada (incl. distribuição e cash-out) já agora, ou só as de saída de caixa? Isso dimensiona a Fase 5.
6. **Plano por convênio:** vale adicionar `ContratoConvenio.planoId` (escolher o plano na tela do convênio) ou manter o atual (todos herdam o "Custeado por convênio" por flag)?

---

*Relatório gerado por análise read-only. Nenhum arquivo de código alterado. Débitos novos catalogados pelos leitores: D-novo-CASH-OUT-COLABORADOR-COMUM, D-novo-TOKEN-CONTA-TIPO, D-novo-F3-LANCAMENTO-AUSENTE, D-novo-F6-LANCAMENTO-AUSENTE, D-novo-F4A-LANCAMENTO-AUSENTE (⚠️ verificar PROVISIONAL do `debitar`), D-novo-PROVISIONAL-SEM-TRANSICAO. Relacionados: o módulo `EnvioListaConcessionaria` atende o backlog #8 (lista concessionária) melhor do que a doc indicava.*
