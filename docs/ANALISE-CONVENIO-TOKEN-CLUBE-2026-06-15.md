# Análise Convênio × CooperToken × Clube de Vantagens — Visão × Realidade

> **Data:** 2026-06-15 · **Tipo:** diagnóstico read-only (nenhum código alterado)
> **Método:** 3 leitores profundos paralelos (1 por módulo) + síntese do orquestrador cruzando com o estado real da sessão 15/06. Toda afirmação tem evidência `arquivo:linha`.
> **Correção de origem:** o leitor de CooperToken afirmou que as telas de F2/F3/F6 "não existem" — **ERRADO**. Elas existem (verificado nesta sessão; ver §2 e §4). Onde a doc/agente divergiu do código, está marcado.

---

## 1. Sumário executivo

1. **O caminho do TOKEN está ~85% pronto, ponta a ponta.** Empresa firma convênio (vira Cooperado PJ pagador) → traz colaboradores (ConvenioCooperado) → **compra tokens** (F2) → **distribui em lote** (F3) → colaborador **usa na fatura** (F4 `usarNaFatura`) ou **gasta em parceiro** (Clube `resgatarOferta` / QR). Tudo com service+controller+**tela**.
2. **O caminho do "CRÉDITO DE ENERGIA" que a visão descreve NÃO existe como "comprar e distribuir kWh".** O kWh vem da **geração das usinas, alocado por % de contrato** — não é um saldo que a empresa compra e distribui. O que existe é **custeio consolidado** (Caso 1 / D-FISCAL-2.4.1): a empresa paga a conta dos membros (`kwhAlocadoMensal` ou consumo real). Isso é uma **decisão de produto em aberto** (ver §7 Q1).
3. **3 furos de validade/regra:** (a) a **validade do token** diverge em 3 fontes — `modeloVida=EXPIRACAO_29D` nunca é lido, `tokenExpiracaoMeses` da doc **nem existe no schema**, só a **oxidação/decay** está implementada (desligada, opt-in); (b) o **nível do Clube nunca cai** e não há cron de reavaliação; (c) o **`tierMinimo` das ofertas do Clube é campo morto** (um BRONZE resgata oferta "exclusiva DIAMANTE").
4. **Riscos multi-tenant reais:** `meusConvenios`/`dashboardConveniado` filtram pelo campo legado `conveniadoId` (sem `cooperativaId`) — **já enfileirado como Track B.2 nesta sessão**; e 3 queries de cron/funil no Clube sem `cooperativaId`.
5. **2 dívidas estruturais que afetam o circuito:** os **2 motores contábeis** (`token-contabil` preparatório × `contabilidade-tributaria` segregado) seguem **desconectados**; e o evento de token da **progressão de faixa do convênio não tem listener** (tokens podem estar sendo "emitidos" sem creditar).

---

## 2. Mapa função-por-função (schema → service → controller → tela)

### 2.1 CONVÊNIOS (`backend/src/convenios/`)
| Camada | Item | Evidência | O que faz |
|---|---|---|---|
| schema | `ContratoConvenio` | `schema.prisma:1504-1649` | convênio; campos: `configBeneficio` (JSON faixas), `tipoBeneficioConveniado` (DESCONTO\|TOKENS\|MISTO), `conveniadoId` (legado), **`pagadorCooperadoId`** (novo, D-FISCAL-2.4.1), `modalidade` (STANDALONE\|GLOBAL), `taxaAprovacaoSisgd`, `tierMinimoClube`, `registrarComoIndicacao`, `pagador`, `baseCobrancaCusteio`, `kwhAlocadoMensal` |
| schema | `ConvenioCooperado` | `schema.prisma:1651-1709` | vínculo membro↔convênio; status MEMBRO_ATIVO/PENDENTE_*/etc; aprovação dupla (empresa+admin) |
| service | `ConveniosService.create/findAll/findOne` | `convenios.service.ts` | CRUD com `cooperativaId` ✅ |
| service | `meusConvenios` / `dashboardConveniado` | `convenios.service.ts:510-537` | 🔴 filtra por `conveniadoId` (legado), **sem `cooperativaId`** |
| service | `ConveniosProgressaoService.recalcularFaixa` | `convenios-progressao.service.ts:106-137` | recalcula faixa; se TOKENS/MISTO **emite evento `convenio.beneficio.tokens`** — ⚠️ **listener não encontrado** |
| service | `ConveniosMembrosService.adicionarMembro` | `convenios-membros.service.ts:288-320` | adiciona membro; cria `Indicacao(PENDENTE)` se `registrarComoIndicacao` |
| service | `ConveniosCusteioService.emitirCobrancaConsolidada` | `convenios-custeio.service.ts` | Caso 1: cobrança única no `contratoConsolidador` (CONSUMO_REAL ou ALOCACAO_FIXA) |
| service | `PortalEmpresaService.listarMeusConvenios` | `portal-empresa.service.ts:94` | ✅ filtra por **`pagadorCooperadoId`** (correto) |
| controller | `ConveniosPortalController` | `convenios-portal.controller.ts` | 🟡 usa `conveniadoId` legado |
| controller | `PortalEmpresaController` | `portal-empresa/*.controller.ts` | ✅ `@PagadorCooperadoOnly()` guard |
| tela | `/dashboard/convenios/*` | web | admin: lista/novo/editar/cobranças-consolidadas |
| tela | `/conveniada/*` | web | empresa: home, dashboard, **`distribuir-tokens`** (F3) |

### 2.2 COOPERTOKEN (`backend/src/cooper-token/` — **path real, não `cooperados-token`**)
| Camada | Item | Evidência | O que faz |
|---|---|---|---|
| schema | `CooperTokenSaldo` | `schema.prisma:2888` | saldo **por cooperado** (`saldoDisponivel` + `saldoBloqueadoResgate`) |
| schema | `CooperTokenSaldoParceiro` | `schema.prisma:3019` | saldo **por tenant** (acúmulo de resgates do Clube) — ≠ saldo da empresa |
| schema | `CooperTokenCompra` | `schema.prisma:3034` | F2: pedido de compra PJ (`asaasId` unique) |
| schema | `CooperTokenLedger` | `schema.prisma:2745` | razão append-only; `CooperTokenTipo` (13) + `CooperTokenOperacao` (11) |
| schema | `ResgateRecibo` | `schema.prisma:2798` | F6: recibo de resgate PIX (sequencial por tenant+ano) |
| schema | `ConfigCooperToken` | `schema.prisma:2975` | config por tenant: `valorTokenReais`, taxas, `modeloVida` (🟡 nunca lido), oxidação |
| service | `creditar` / `debitar` | `cooper-token.service.ts:157 / :338` | core de emissão/débito + ledger + LancamentoCaixa |
| service | `comprarTokensCooperado` (F2) | `cooper-token.service.ts:3998` | empresa PJ compra → CooperTokenCompra + cobrança Asaas |
| service | `distribuirTokens` (F3) | `cooper-token.service.ts:1291` | empresa distribui em lote pros membros (guard `pagadorCooperadoId` ✅ pós-fix 15/06) |
| service | `usarNaFatura` (F4) | `cooper-token.service.ts:3694` | abate fatura (teto ~40%, PIN) → `ABATIMENTO_ENERGIA` |
| service | `processarPagamentoQr` / `enviarTokens` (F4) | `cooper-token.service.ts:3148 / :906` | peer-to-peer via QR+PIN → DOACAO_ENVIADA/RECEBIDA |
| service | `solicitarResgate` (F6) | `cooper-token.service.ts:1954` | estabelecimento resgata em PIX (bloqueia saldo) |
| tela | `/portal/tokens`, `/portal/comprar-tokens`, `/conveniada/.../distribuir-tokens`, `/estabelecimento/receber\|recebimentos\|validar`, `/dashboard/cooper-token*` | web | **EXISTEM** (corrige o "ausente" do agente) |

### 2.3 CLUBE DE VANTAGENS (`backend/src/clube-vantagens/`)
| Camada | Item | Evidência | O que faz |
|---|---|---|---|
| schema | `ConfigClubeVantagens.niveisConfig` (JSON) | `schema.prisma:2408-2414` | níveis BRONZE→DIAMANTE configuráveis |
| schema | `ProgressaoClube` | `schema.prisma:2420` | nível atual + métricas (kwhIndicado, indicadosAtivos) |
| schema | `OfertaClube` | `schema.prisma:3075` | oferta em parceiro; **SEM `tierMinimo`** |
| schema | `ResgateClubeVantagens` | `schema.prisma:3100` | resgate (código UUID, validado por admin) |
| service | `avaliarProgressao` | `service.ts:48-143` | sobe nível; **"só promove, nunca rebaixa"** (`:94`) |
| service | `resgatarOferta` | `service.ts:755-827` | **debita token do cooperado → credita saldo parceiro** (tx atômica); ⚠️ **não valida tier** |
| service | `enviarResumosMensaisLote` (cron) | `service.ts:581-582` | 🔴 `findMany` sem `cooperativaId` |
| controller | 15 endpoints | `controller.ts:1-168` | config/ranking/ofertas/resgatar/validar-resgate |
| tela | `/dashboard/clube-vantagens` (+`/config`,`/ranking`), `/portal/clube` | web | admin config níveis + portal resgata ofertas |

---

## 3. Tabela VISÃO × REALIDADE (os 5 passos)

| # | Passo da visão | Realidade no código | Status | Evidência |
|---|---|---|---|---|
| 1 | Empresa firma convênio + vira cooperada | ✅ `ContratoConvenio` + empresa = Cooperado PJ (`pagadorCooperadoId`) | ✅ **EXISTE** | `schema.prisma:1504,1590` |
| 2 | Empresa traz colaboradores → cooperados | ✅ `ConvenioCooperado` + convite + aprovação dupla + import CSV | ✅ **EXISTE** | `schema.prisma:1651`, `convenios-membros.service.ts` |
| 3 | Empresa compra **tokens** e/ou **créditos de energia** | Tokens: ✅ F2 `comprarTokensCooperado`. Créditos de energia: ❌ **não existe como "compra de kWh"** — existe **custeio consolidado** (paga a conta dos membros) | 🟡 **MEIO** (token sim, "crédito de energia" não) | `cooper-token.service.ts:3998` (token) · `convenios-custeio.service.ts` (custeio) |
| 4 | Empresa distribui tokens/créditos | Tokens: ✅ F3 `distribuirTokens` (lote, PIN, preview). Créditos kWh: ❌ kWh vem da **geração de usina por % de contrato**, não há "distribuição de crédito" pela empresa | 🟡 **MEIO** | `cooper-token.service.ts:1291` |
| 5 | Colaborador usa: token abate fatura **e/ou** gasta em parceiro | ✅ `usarNaFatura` (abate) + `resgatarOferta`/QR (parceiro) | ✅ **EXISTE** | `cooper-token.service.ts:3694` · `clube-vantagens/service.ts:755` |

**Leitura:** a visão está **construída para o token**. O conceito "comprar/distribuir crédito de energia" **não casa com o modelo atual** (energia = geração de usina alocada por contrato). Decisão de produto necessária (§7 Q1).

---

## 4. Hipóteses — confirmadas / refutadas (com evidência)

| H | Veredito | Evidência |
|---|---|---|
| **H1** benefício é só desconto % por faixa | ❌ **REFUTADO (parcial)** — 3 modos: DESCONTO, **TOKENS**, MISTO (`tipoBeneficioConveniado`); faixa pode emitir token ao conveniado; + F3 distribui token a membros | `convenios-progressao.service.ts:106-137`; `cooper-token.service.ts:1291` |
| **H2** sem vínculo convenioId↔token | ❌ **REFUTADO** — vínculo **indireto**: saldo é por-cooperado; empresa distribui (F3) aos membros (`ConvenioCooperado.convenioId`); ledger `DISTRIBUICAO_CONVENIO` | `schema.prisma:2888`; `cooper-token.service.ts:1291` |
| **H3** Compra/SaldoParceiro são por tenant, não empresa | ✅ **CONFIRMADO** — ambos têm `cooperativaId`. **Nuance:** a compra (F2) credita o `CooperTokenSaldo` do **cooperado PJ** (não o SaldoParceiro) | `schema.prisma:3034,3019,2888` |
| **H4** usos do token têm fluxo completo | ✅ **CONFIRMADO** — ABATIMENTO_ENERGIA, PAGAMENTO_QR, COMPRA(F2), DISTRIBUICAO(F3), RESGATE_CLUBE, RESGATE_PIX(F6) têm service+controller+**tela** (corrige "tela ausente") | telas verificadas na sessão |
| **H5** opção A/B | 🟡 **MORTA** — `opcaoToken` deprecado, substituído por `modoRemuneracao` (DESCONTO\|CLUBE); nunca lido; ~317 legados | `schema.prisma:277-279` |
| **H6** conflito validade 29d × meses | ❌ **CONFLITO REAL** — `modeloVida` nunca lido; `tokenExpiracaoMeses` **não existe no schema**; só **oxidação/decay** implementada (opt-in, gate `OXIDACAO_PRODUCAO_LIBERADA`); "29 dias" não está no código | `schema.prisma:2978,3006`; doc divergente |
| **H7** GERACAO_EXCEDENTE | 🟡 **NOME ENGANOSO** — usado pra liberar `saldoPendente`, **não gera token novo**; emissão real = `FATURA_CHEIA` (desconto não-aplicado) | `cooper-token.service.ts:499`; `schema.prisma:2693` |
| **H8** fonte de verdade da config | ✅ **SEM conflito atual** — config de token de `ConfigCooperToken`; limites de `Cooperativa`; cada um consistente. Ressalva: limites fora do ConfigCooperToken (design) | `schema.prisma:2975,107-108` |
| **H9** tiers de niveisConfig JSON | ✅ **CONFIRMADO** — JSON editável em `/dashboard/clube-vantagens/config`. **Nível NÃO cai** ("só promove"); **sem cron de reavaliação** (só cron de resumo) | `service.ts:63,94`; `job.ts:16` |
| **H10** registrarComoIndicacao credita token? | ❌ **NENHUM imediato** — cria `Indicacao(PENDENTE)` + `BeneficioIndicacao` (desconto R$); tokens `BONUS_INDICACAO` só **após 1ª fatura paga** | `convenios-membros.service.ts:303`; `indicacoes.service.ts:403-419` |
| **H11** tierMinimo exigido | ⚠️ **DEPENDE do campo** — `tierMinimoClube` **no CONVÊNIO** É exigido na admissão (`checkTierRequisito`); `tierMinimo` **nas OFERTAS** do clube **NÃO existe/não valida** (furo) | convênio: `convenios.service.ts:582` · oferta: `schema.prisma:3075` (sem campo) |
| **H12** STANDALONE/GLOBAL + taxa | 🟡 **PARCIAL** — aprovação GLOBAL funciona (super-admin); **`taxaAprovacaoSisgd` é registrada mas NÃO cobrada** (sem lógica) | `convenios.service.ts:129`; `schema.prisma:1571` |
| **H13** ordem kWh→token | ✅ **NÃO existe** — token é abatimento de fatura, separado do kWh (que vem do OCR da concessionária) | `cooper-token.service.ts:3694` |

---

## 5. Gaps e o que construir

### 5.1 Caminho do TOKEN (quase pronto)
- **Já existe:** compra (F2) + distribuição (F3) + uso (F4) + parceiro (Clube) + resgate PIX (F6).
- **Falta/polir:** (a) confirmar o **listener do evento `convenio.beneficio.tokens`** (progressão de faixa TOKENS/MISTO pode estar emitindo sem creditar); (b) **"saldo de token por convênio"** é hoje implícito (saldo per-cooperado) — se quiser visão consolidada por convênio, é uma agregação nova, não um saldo novo; (c) regras de **validade** unificadas (§6).

### 5.2 Caminho do "CRÉDITO DE ENERGIA" (não existe como na visão)
O modelo atual: **kWh = geração de usina alocada por % de contrato** (`Contrato.percentualUsina`). A empresa, no Caso 1, **custeia** o consumo dos membros (cobrança consolidada). Não há "comprar crédito de kWh e distribuir".
**Para a visão funcionar, decisão de produto (Q1) define um de dois caminhos:**
- **(A) Custeio de cotas de usina** (mais perto do que existe): a empresa custeia uma cota de geração que abate a conta dos membros — estender o Caso 1 com "cota por membro". Models novos: `CotaEnergiaConvenio` (kWh alocado por membro), endpoint de alocação. Reusa a alocação por contrato.
- **(B) "Crédito de energia" como saldo distribuível** (novo conceito, paralelo ao token): a empresa compra um saldo de kWh e distribui — exige novo model `CreditoEnergiaSaldo` + ledger + regras de validade/uso na fatura. **Mais caro e cria um 3º "rio"** além de energia (geração) e token. ⚠️ Conflita com o princípio "dois rios" (energia × token).

---

## 6. Riscos (multi-tenant, inconsistências, furos)

### Multi-tenant
| # | Onde | Evidência | Severidade |
|---|---|---|---|
| MT-1 | `meusConvenios`/`dashboardConveniado` filtram `conveniadoId` sem `cooperativaId` | `convenios.service.ts:510-537` | 🟡 (mitigado por id global; **já = Track B.2 desta sessão**) |
| MT-2 | `convenios.remove(id)` sem `cooperativaId` (a confirmar) | `convenios.service.ts` | 🔴 (destrutivo — verificar) |
| MT-3 | Clube: `enviarResumosMensaisLote`, `getFunilConversao`, `recalcularIndicadosAtivos` sem `cooperativaId` | `clube-vantagens/service.ts:190,476,582` | 🔴 (cron/funil cross-tenant) |

### Inconsistências
- **Validade do token:** doc (`tokenExpiracaoMeses`) × schema (`modeloVida` nunca lido) × código (só oxidação) — **3 fontes divergentes**.
- **`opcaoToken` morto** (~317 legados; ~85 órfãos sem `modoRemuneracao`).
- **2 motores contábeis desconectados** (`token-contabil` × `contabilidade-tributaria`).
- **Limites em `Cooperativa`** vs config em `ConfigCooperToken` (design split).
- **`taxaAprovacaoSisgd`** registrada mas **nunca cobrada**.

### Furos de regra
- **`tierMinimo` das ofertas do Clube não validado** → BRONZE resgata oferta "DIAMANTE" (`resgatarOferta` não checa nível).
- **Nível do Clube nunca cai** + **sem cron de reavaliação**.
- **Sem cron de expiração** de token (campo existe, job não).
- **Evento de token da progressão de faixa sem listener** (tokens "emitidos" sem creditar?).
- **Contabilidade PROVISIONAL** nunca transita para CONFIRMADO.

---

## 7. Perguntas abertas pro Luciano

1. **"Comprar créditos de energia" — o que é, exatamente?** (a) a empresa **custeia cotas de usina** que abatem a conta dos membros (≈ Caso 1 estendido), ou (b) um **saldo de kWh distribuível** novo (3º rio)? Isso define um sprint inteiro. *(Recomendo (a) — respeita "dois rios" e reusa a alocação por contrato.)*
2. **Progressão de faixa TOKENS/MISTO:** confirmar se o evento `convenio.beneficio.tokens` tem listener creditando — se não, é furo (tokens prometidos não entregues).
3. **`tierMinimo` nas ofertas do Clube:** quer travar (BRONZE não resgata oferta DIAMANTE)? Hoje não trava.
4. **Validade do token:** qual modelo vale — expiração por prazo, oxidação/decay, ou nenhum? Unificar as 3 fontes em UMA.
5. **`taxaAprovacaoSisgd` (GLOBAL):** como/quando o SISGD cobra essa taxa? Hoje só registra.
6. **Nível do Clube pode regredir?** Hoje só sobe. Se sim, precisa de cron de reavaliação.
7. **Legado `opcaoToken`:** migrar os ~85 órfãos para `modoRemuneracao` num housekeeping?

---

*Relatório gerado por análise read-only. Nenhum arquivo de código foi alterado. Débitos já catalogados relacionados: D-novo-CONVENIO-CONVENIADO-LEGADO, D-novo-TAXA-TRANSFER-DESTINO, D-novo-EMAIL-IMAP-SSL-VERIFY, e o Track B.2 (queries legado `conveniadoId`).*
