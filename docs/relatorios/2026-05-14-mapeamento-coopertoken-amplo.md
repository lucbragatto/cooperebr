# Mapeamento amplo CooperToken — leitura noturna 13-14/05/2026

> **Autor:** claude.ai (Opus 4.7)
> **Sessão:** noturna pós-fechamento Code 13/05
> **Origem:** Luciano pediu cruzamento das specs `docs/specs/*` + arquivos-chave atualizados antes de decidir Fatia C (Sprint CooperToken Etapa 1)
> **Sem código tocado.** Read-only puro.

---

## Sumário

- **Parte 1** — Inventário das 13 fontes lidas
- **Parte 2** — Síntese curta por fonte
- **Parte 3** — 5 visões divergentes do CooperToken (matriz)
- **Parte 4** — 10 conflitos diretos catalogados
- **Parte 5** — Conexões cross-domain (Luciano apontou)
- **Parte 6** — Estado real implementado vs spec
- **Parte 7** — Recomendação refinada de escopo Fatia C
- **Parte 8** — 8 débitos novos a catalogar (D-35 a D-42)
- **Parte 9** — Próximos passos sugeridos

---

## Parte 1 — Inventário das 13 fontes lidas

### Specs canônicas em `docs/` (5 arquivos)

| Arquivo | Linhas | Data | Status |
|---|---|---|---|
| `especificacao-clube-cooper-token.md` | 364 | original ~mar/abr/2026 + **adendo §11 04/05/2026** | ✅ Canônica com correção retroativa |
| `especificacao-contabilidade-clube.md` | 129 | ~abr/2026 | ✅ Estável |
| `especificacao-modelos-cobranca.md` | 130 | ~abr/2026 | ✅ Estável |
| `investigacao-sprint8-cooper-token-clube.md` | 530 | 20/04/2026 | ✅ Mapeamento técnico do estado real |
| `sessoes/2026-05-04-noite-investigacao-coopertoken.md` | 105 | 04/05/2026 | ✅ Decisão estruturante Sprint Consolidado |

### Specs históricas em `docs/specs/` (8 arquivos)

| Arquivo | Linhas | Data | Status |
|---|---|---|---|
| `COOPERTOKEN-FUNDAMENTOS.md` | 441 | 02/04/2026 | 🟡 Detalhada mas concorrente com canônica |
| `ESTRATEGIA-COOPERTOKEN-COMPLETA.md` | 213 | 31/03/2026 | 🟡 Visão Plano Token + eletroposto |
| `SPEC-COOPERTOKEN-v1.md` | 735 | 31/03/2026 | 🟡 Spec técnica detalhada (excedente individual) |
| `ESTRATEGIA-INOVACAO-2026.md` | 227 | 31/03/2026 | 🟡 VPP + 600k kWh + EV |
| `MODELO-COBRANCA-GD-2026-04-01.md` | 116 | 01/04/2026 | 🟡 Modelos A/B baseados em fatura real |
| `PLANO-CONVENIOS-2026-04-01.md` | 1457 | 01/04/2026 | ⚠️ NÃO menciona token (gap apontado por Luciano) |
| `PROPOSTA-GD1-GD2-FIOB-2026-03-26.md` | 188 | 26/03/2026 | 🟡 Fio B detalhado (D-30L catalogado) |
| `PROPOSTA-MODO-OBSERVADOR-2026-03-26.md` | 184 | 26/03/2026 | 🟢 Independente do token (sem conexão) |

**Total: 4.819 linhas de spec mapeadas.**

### Schema + banco (Decisão 23 — referência)

- 80 models Prisma (categorias 6 Fidelidade/CooperToken + 7 Indicações/Convênios + 4 Gateway)
- 9 entries CooperTokenLedger
- 5 CooperTokenSaldo
- 1 ConfigCooperToken (CoopereBR)
- 0 OfertaClube
- 0 ResgateClubeVantagens
- 215 ConvenioCooperado
- 10 Indicacao
- 0 BeneficioIndicacao
- 2 ProgressaoClube
- 317 Cooperados em `opcaoToken='A'` (legado deprecated)
- 232 Cooperados em `modoRemuneracao='DESCONTO'` (D-30Z gap 85)

---

## Parte 2 — Síntese curta por fonte

### 2.1 `especificacao-clube-cooper-token.md` (CANÔNICA — com adendo §11)

- **Conceito:** Cooperado escolhe DESCONTO ou CLUBE no cadastro.
- **CLUBE:** paga fatura cheia + recebe tokens equivalentes ao desconto.
- **Uso:** abate fatura futura (teto 40% configurável) + Clube de Vantagens.
- **Decay/expiração:** configurável por parceiro (ferramenta com period de graça + taxa + piso).
- **Adendo §11 corrige:** SISGD é o produto (não CoopereBR), "Sprint CooperToken Consolidado" 14-18h substitui numeração antiga.
- **Estimativa:** 60-70% do MVP §8 já existe no código.

### 2.2 `especificacao-contabilidade-clube.md`

- **4 eventos contábeis:** Emissão / Uso na fatura / Expiração (breakage) / Parceiro usa.
- **Estado atual:** 3 dos 4 eventos no CooperTokenLedger, **ponte LancamentoCaixa NÃO EXISTE**.
- **3 categorias novas a criar:** `PROVISAO_TOKEN_CLUBE`, `AMORTIZACAO_TOKEN_CLUBE`, `RECEITA_BREAKAGE_TOKEN`.
- **Quando implementar:** Sprint 11 (não 9 nem 10).
- **Pré-requisito:** Luciano conversa com contador antes de codificar.

### 2.3 `especificacao-modelos-cobranca.md`

- **3 modelos:** FIXO_MENSAL (funcional) / CREDITOS_COMPENSADOS (bloqueado por flag) / CREDITOS_DINAMICO (bloqueado).
- **Combinação com `modoRemuneracao`:** 6 combinações funcionais (3 × DESCONTO/CLUBE).
- **CLUBE em todos os 3:** cooperado paga equivalente sem desconto + acumula tokens.

### 2.4 `investigacao-sprint8-cooper-token-clube.md` (20/04, técnico)

- **Mapeamento técnico exaustivo** de schema + services + crons + frontend + fluxos.
- **DUALIDADE CRÍTICA**: ConfigCooperToken (por cooperativa, 0 reg) vs Plano (por plano, dominante hoje).
- **30 endpoints REST cooper-token + 14 clube-vantagens** mapeados.
- **2 crons ativos**: `apurarExcedentes` (cron 6h) + `expirarTokensVencidos` (cron mensal dia 1).
- **9 telas frontend** funcionais (dashboard + portal + financeiro + clube + ranking).
- **14 decisões pendentes (Seção 7)** catalogadas com hash arquivo:linha.
- **Zero specs Jest.**
- **Decay HARDCODED** em `cooper-token.service.ts:216`: 10/20/26/29 dias → 100%/90%/75%/50%/0%.
- **Fallback 0.45 hardcoded** em 26+ locais.

### 2.5 `sessoes/2026-05-04-noite-investigacao-coopertoken.md`

- **Decisão estruturante (04/05 noite):** Sprint CooperToken Consolidado 14-18h em 2 etapas.
- **Etapa 1 (6-8h):** specs Jest pro módulo cooper-token.
- **Etapa 2 (8-10h):** schema delta + refator + UI nova.
- **Sequência:** Fase C.2 → C.3 → Sprint CooperToken Consolidado.
- **Pré-requisito P0:** specs antes do refator (gap conhecido desde 02/05).

### 2.6 `COOPERTOKEN-FUNDAMENTOS.md` (02/04, Assis+Luciano — APROVADO)

- **Natureza jurídica:** ATO COOPERATIVO Lei 5.764/71 — não incide ICMS/ISS/PIS/COFINS.
- **Condição:** parceiro precisa ser cooperado (sem isso, ato vira mercantil).
- **Origem dos tokens (DUAS FONTES):**
  1. Conversão da mensalidade (Opção B)
  2. **Saldo escritural CoopereBR (600.000 kWh represados)**
- **Split de captura R$ 200:** 50% dono usina + 30% coop + 20% SISGD+Clube.
- **Ciclo 29 dias** com decay progressivo.
- **FCFS — Fundo Cooperativo de Fomento Solar:** conceito ESTRUTURANTE.
- **Plano de Contas** com 10 contas novas detalhadas.
- **4 modalidades de cobrança:** Opção A / B / B+FCFS / Abate de tokens.

### 2.7 `ESTRATEGIA-COOPERTOKEN-COMPLETA.md` (31/03)

- **Plano Token coexiste com Plano Desconto** (binário).
- **Taxa de repasse ao parceiro CONFIGURÁVEL** (80%/70%/90%).
- **2 modalidades de conversão:** 1 CT = R$ 1 fixo OU fator variável (parceiro define).
- **Eletroposto CoopereBR (10 anos):** drena 600k kWh em ~5-18 meses, 12 postos.
- **Funil de aquisição:** motorista EV → cooperado.
- **Ciclo 29-90 dias com decay:** parceiros aceitam até dia 29, decay 30-89 só na mensalidade CoopereBR, dia 90 expira.

### 2.8 `SPEC-COOPERTOKEN-v1.md` (31/03, 735 linhas — Fase 1 implementada)

- **Origem do token:** kWh EXCEDENTE (geração > contrato).
- **1 CT = 1 kWh excedente, R$ 0,45/CT padrão.**
- **Expira em 12 meses (config por Plano).**
- **3 tipos:** GERACAO_EXCEDENTE / FLEX (Fase 2 demand response) / SOCIAL (Fase 3 doação).
- **Roadmap em 3 Fases:** Fase 1 ✅ implementada (24/03 indica), Fase 2 (Tarifa Branca), Fase 3 (Pool Social).
- **Auditoria append-only:** ledger nunca deleta.

### 2.9 `ESTRATEGIA-INOVACAO-2026.md` (31/03, 227 linhas)

- **Tese:** CoopereBR vira **VPP — Virtual Power Plant**.
- **Token como espinha dorsal da VPP** (3 camadas: Geração + Flex + Social).
- **Problema dos 600.000 kWh represados:** lote mais antigo expira em maio/2028 (~R$ 473k).
- **3 caminhos:** Tokenização imediata + Contestação ANEEL + Reestruturação EDP.
- **Mobilidade Elétrica:** 20 carregadores até dez/2026 (drena 120k kWh/ano).
- **Demand response via WhatsApp Bot** (Fase 2 após Tarifa Branca).

### 2.10 `MODELO-COBRANCA-GD-2026-04-01.md`

- **5 faturas EDP analisadas** (Cláudio, Balthazar, Patricia, Rodrigo, RCA).
- **Padrões confirmados:** tarifa compensação ~R$ 0,57 TUSD + R$ 0,39 TE, ICMS NÃO devolvido, CIP fixa, FIFO.
- **2 modelos NOVOS propostos** baseados em fatura real:
  - Modelo A — Tarifa unitária da fatura (creditosRecebidosKwh × tarifaTUSDComp+TEComp)
  - Modelo B — Valor cheio reconstruído (inclui ICMS/CIP/PIS proporcionais)
- **Comparativo Cláudio 628.7 kWh 15% desc:** FIXO R$ 335 / DINAMICO R$ 422 / Modelo A R$ 514 / Modelo B R$ 467.

### 2.11 `PLANO-CONVENIOS-2026-04-01.md` (1.457 linhas — extenso)

- **Decisão crucial:** desconto convênio é INDEPENDENTE (coexiste/soma) com usina/cooperativa.
- **Faixas progressivas configuráveis** por número de membros (configBeneficio JSON).
- **Conveniado:** representante do convênio (cooperado ou SEM_UC criado automaticamente).
- **10 fases de implementação** mapeadas (30-40h total).
- **D-30P/D-30Q resolvidos em 01/05:** 215 ConvenioCooperado funcionando.
- **⚠️ Spec NÃO menciona token** (gap apontado por Luciano em 13/05).

### 2.12 `PROPOSTA-GD1-GD2-FIOB-2026-03-26.md`

- **Tabela Fio B 2022-2029** por classe GD (D-30L catalogado).
- **2026:** GD1 ≤75kW isento / GD1 >75kW + GD2 → 60% Fio B.
- **Schema delta proposto:** `TarifaConcessionaria.tusdFioA + tusdFioB`, `ModalidadeGD` enum.
- **Motor de cobrança refatorado** com tarifa efetiva por ano + modalidade.
- **3 dias estimados.**

### 2.13 `PROPOSTA-MODO-OBSERVADOR-2026-03-26.md`

- **Modo Observador (shadow mode)** pra monitorar conversas/ações em tempo real.
- **NÃO conecta com Token.** Independente.
- **Conceito B4** mencionado em outros docs ("admin-spy + cooperado-leitura coexistem").

---

## Parte 3 — 5 visões divergentes do CooperToken (matriz)

Cada spec aborda CooperToken com lente diferente. Matriz:

| Aspecto | Spec canônica (clube-cooper-token + adendo §11) | COOPERTOKEN-FUNDAMENTOS (02/04) | ESTRATEGIA-COOPERTOKEN (31/03) | SPEC-COOPERTOKEN-v1 (31/03) | Implementado (banco/código hoje) |
|---|---|---|---|---|---|
| **Origem token** | Opção B (Caminho CLUBE) | Opção B + Saldo escritural (600k kWh) | Plano Token (paga cheio) | kWh EXCEDENTE individual | AMBOS (cron excedente + cobrança CLUBE) |
| **Equivalência** | Valor desconto não aplicado | R$/token configurável | 1 CT = R$ 1 OU fator variável | 1 CT = 1 kWh excedente, R$ 0,45 | Hardcoded R$ 0,45 fallback + Plano valorTokenReais |
| **Decay/Expiração** | Configurável por parceiro (graça + taxa + piso) | 29 dias com decay 10/20/26/29 | 29 dias + decay 30-89 + expira 90 | 12 meses configurável | HARDCODED 10/20/26/29 + cron mensal expiração |
| **Rede parceiros** | MVP: 1-2 showcase. Rede aberta Sprint 10+ com advogado | Parceiros DEVEM ser cooperados (ato cooperativo) | Configurável por parceiro (Uaine, restaurantes, eletroposto) | Via Clube de Vantagens | OfertaClube + ResgateClubeVantagens VAZIOS |
| **Split receita** | Não menciona | 50% dono usina + 30% coop + 20% SISGD/Clube | Taxa por parceiro | taxaTokenPerc no PlanoSaas | 2% hardcoded em `creditar` |
| **FCFS** | Não menciona | DETALHADO (conta segregada, contribuição voluntária, financia usinas/EV) | Não menciona | Não menciona | NÃO EXISTE |
| **Saldo escritural 600k kWh** | Não menciona | Fonte de emissão primária | Diagnóstico no problema (drenar via EV) | Não menciona | NÃO TOKENIZADO |
| **Mobilidade elétrica/EV** | Não menciona | Não menciona | Eletroposto 10 anos (drena 600k) | Não menciona | NÃO EXISTE |
| **VPP** | Não menciona | Não menciona | Não menciona | Não menciona | NÃO EXISTE |
| **Demand response (Flex)** | Não menciona | Não menciona | Não menciona | Fase 2 após Tarifa Branca | NÃO EXISTE |
| **Pool Social** | Não menciona | Não menciona | Não menciona | Fase 3 | NÃO EXISTE |
| **Contabilidade** | Não menciona | Plano de Contas + 10 contas novas + 4 eventos | Não detalha | Não detalha | 4 eventos no Ledger, SEM ponte LancamentoCaixa |
| **Natureza jurídica** | Programa de fidelidade (não regulamenta como moeda) | ATO COOPERATIVO Lei 5.764/71 | Não detalha | "Benefício de fidelidade" | — |
| **Vocabulário** | "Caminho DESCONTO / CLUBE" | "Opção A / B" | "Plano Desconto / Plano Token" | "modoRemuneracao DESCONTO/CLUBE" | `modoToken` no Plano (DESCONTO_DIRETO / FATURA_CHEIA_TOKEN) + `modoRemuneracao` no Cooperado |

---

## Parte 4 — 10 conflitos diretos catalogados

### Conflito 1 — Origem do token (estrutural)

- 4 visões divergentes: excedente vs Opção B vs Plano Token vs saldo escritural
- Código tem **AMBOS** caminhos rodando paralelamente sem documentação consolidada
- **Decisão produto necessária:** qual o caminho canônico em 2026? Pode coexistir?

### Conflito 2 — Decay/Expiração (estrutural)

- 4 visões: configurável vs 29 dias vs 90 dias vs 12 meses
- Código tem **HARDCODED 10/20/26/29 + expira por mês**
- Hardcode hoje NÃO BATE com nenhuma spec corretamente
- **Decisão produto necessária:** período e fórmula final

### Conflito 3 — Rede de parceiros (estrutural)

- Spec canônica é CONSERVADORA (showcase MVP, advogado Sprint 10+)
- COOPERTOKEN-FUNDAMENTOS é JURÍDICA (parceiro DEVE ser cooperado)
- ESTRATEGIA é AMBICIOSA (configurável por parceiro com taxa de repasse)
- Código tem ESTRUTURA mas VAZIA (0 ofertas)
- **Decisão produto + jurídica necessária**

### Conflito 4 — Split de receita (operacional)

- Apenas COOPERTOKEN-FUNDAMENTOS detalha (50/30/20)
- Código hardcoded 2% em creditar
- **Decisão produto necessária:** split configurável ou fixo?

### Conflito 5 — FCFS (estrutural — gap maior)

- Conceito ESTRUTURANTE em 1 spec (COOPERTOKEN-FUNDAMENTOS)
- AUSENTE em 3 outras specs + código
- **Pergunta:** FCFS é decisão de produto futura ou conceito a abandonar?

### Conflito 6 — Modelos de cobrança × Token (vocabulário)

- 4 vocabulários diferentes: Caminho A/B vs Opção A/B vs DESCONTO/CLUBE vs Plano Desconto/Plano Token
- Schema mistura `modoToken` (Plano) + `modoRemuneracao` (Cooperado)
- **Decisão produto necessária:** consolidar vocabulário antes do refator

### Conflito 7 — Token × Convênio (GAP MAIOR — Luciano apontou)

- **NENHUMA spec aborda essa conexão**
- Convênios têm faixas progressivas (% desconto)
- **Pergunta de Luciano:** "convênios podem abordar token e usar como pagamento de indicação, convites etc"
- Conexões possíveis:
  - Benefício do convênio em tokens (alternativa ao % desconto)
  - Indicação automática via convênio paga bônus em tokens
  - Conveniado (representante) recebe tokens proporcional ao tamanho do convênio
- **Decisão produto necessária:** desenhar spec dedicada Token × Convênio

### Conflito 8 — Token × Indicação/Convite (parcial)

- BONUS_INDICACAO existe no enum + emissão em `indicacoes.service:352`
- ProgressaoClube tem níveis (BRONZE→DIAMANTE) por kwh indicado
- D-30M (MLM cascata) catalogado mas não validado E2E
- Conexão com Convênio (ConvenioCooperado.registrarComoIndicacao=true) existe
- **Decisão produto:** progressão usa tokens? Convite gera tokens pro indicador?

### Conflito 9 — Mobilidade Elétrica × Token (estrutural — gap maior)

- ESTRUTURANTE em 2 specs (ESTRATEGIA-COOPERTOKEN + ESTRATEGIA-INOVACAO)
- AUSENTE em código
- 12-20 carregadores até dez/2026 mencionados como prazo agressivo
- **Decisão produto necessária:** quando entra? Sprint dedicado?

### Conflito 10 — Fio B × Token (técnico)

- PROPOSTA-GD1-GD2-FIOB detalha cálculo do Fio B (60% em 2026)
- Outras specs IGNORAM Fio B
- Cobrança hoje sem Fio B implementado
- Valor do token CLUBE = valor cheio - valor com desconto
- **Sem Fio B implementado, valor cheio está errado, então valor do token também**
- D-30L catalogado (Sprint 5a)

---

## Parte 5 — Conexões cross-domain (Luciano apontou em 13/05)

Luciano pediu cruzamento com: **Tokens × Clube × Inovações × Modelos cobrança × Planos × Convênios × Indicação/Convites**.

### 5.1 Token × Cobrança × Planos

**Estado atual:**
- Modelo de cobrança define quanto cooperado paga (FIXO/COMPENSADOS/DINAMICO)
- `modoToken` no Plano define DESCONTO_DIRETO ou FATURA_CHEIA_TOKEN
- `modoRemuneracao` no Cooperado define DESCONTO ou CLUBE
- Dualidade Plano (11 campos token) vs ConfigCooperToken (escopo cooperativa, vazio)

**Gap:**
- Vocabulário inconsistente (3 sinônimos)
- Sprint CooperToken Consolidado (04/05) prevê centralizar em ConfigCooperToken — **Etapa 2 do sprint, não Etapa 1**

### 5.2 Token × Convênio (LUCIANO APONTOU — GAP MAIOR)

**Estado atual:** desconectados completamente.

**Conexões propostas (rascunho):**

#### Proposta A — Benefício do convênio em tokens (alternativa ao % desconto)
- Faixas configuráveis: ao invés de só % desconto, faixa pode ser quantidade de tokens emitidos por mês
- Conveniado escolhe modalidade (% desconto OU tokens)
- Útil pra convênios que querem fidelizar membros via Clube de Vantagens

#### Proposta B — Indicação via convênio paga bônus em tokens
- ConvenioCooperado.registrarComoIndicacao=true já gera Indicacao
- Indicacao já emite BONUS_INDICACAO via cooper-token
- **Trabalho:** garantir que indicação via convênio dispara BONUS_INDICACAO igual indicação direta

#### Proposta C — Conveniado recebe tokens proporcional ao tamanho do convênio
- ContratoConvenio.descontoConveniadoAtual hoje é % desconto na fatura própria
- Alternativa: emitir tokens proporcional ao número de membros ativos
- Cria mais um "uso" do token (alinhamento com circulação)

**Recomendação:** spec dedicada `especificacao-token-convenio.md` antes do Sprint CT Etapa 2.

### 5.3 Token × Indicação/Convite (parcial)

**Estado atual:**
- BONUS_INDICACAO emitido em `indicacoes.service:352`
- Hardcoded `(configToken as any)?.bonusIndicacao` que NÃO existe no schema → fallback 50 tokens
- D-30M (MLM cascata) aberto

**Gaps:**
- Campo `bonusIndicacao` não está no ConfigCooperToken (Decisão pendente 7.4 do invest. 20/04)
- Progressão (ProgressaoClube) usa kWh indicado, não tokens
- Convite com `?ref=CODIGO` cria Indicacao, mas não tem cron de "primeira fatura paga → emite token"

**Recomendação:** dentro do Sprint CT Etapa 2 + resolver D-30M.

### 5.4 Token × Inovações (FCFS + EV + VPP)

**Estado atual:** 3 conceitos estruturantes em specs antigas, **NÃO implementados**.

**Pergunta produto:** entra agora ou sprint dedicado futuro?

- FCFS — viável após contabilidade do clube (Sprint 11 catalogado)
- EV — viável após decisão produto sobre 600k kWh (3 caminhos catalogados)
- VPP — viável após Tarifa Branca homologada + smart meters (longo prazo)

**Recomendação:** **NÃO inflar Sprint CT Etapa 1.** Catalogar como sprints separados futuros.

### 5.4.1 VPP — Virtual Power Plant (TESE ESTRATÉGICA QUE AMARRA TUDO)

⚠️ **Adendo 14/05 madrugada (Luciano apontou omissão):** VPP merece destaque próprio porque NÃO é "mais uma feature" — é a **tese estratégica de longo prazo** que conecta todas as peças do CooperToken.

#### Conceito (ESTRATEGIA-INOVACAO-2026.md)

CoopereBR está em transição de **cooperativa de GD** para **Virtual Power Plant (VPP)** — usina virtual que agrega recursos energéticos distribuídos e os opera de forma coordenada.

#### Matriz componentes VPP vs CoopereBR hoje

| Componente VPP | CoopereBR | Estado |
|---|---|---|
| Geração distribuída | 3 usinas arrendadas | ✅ Existe |
| Agregação de consumidores | N cooperados com UCs | ✅ Existe |
| Plataforma de gestão | Sistema CoopereBR (backend + bot WA) | ✅ Existe |
| **Mecanismo de incentivo** | **CooperToken** | ✅ Implementado parcial |
| **Demand response** | Token Flex (Fase 2) | 🔴 A implementar |
| **Mobilidade elétrica** | Eletroposto + tokens EV | 🔴 Planejado |
| **Mercado de ancilagem** | Vender flexibilidade pra distribuidora | 🔴 Futuro longo prazo |

"O que faltava: a camada de inteligência e incentivo para coordenar o comportamento dos cooperados como ativo gerenciável. **O CooperToken é essa camada.**"

#### Como VPP amarra as outras peças

VPP é a **TESE QUE CONECTA** as 5 visões divergentes do CooperToken e os outros conceitos:

| Peça | Função na VPP |
|---|---|
| Token (Geração) | Camada de incentivo individual ao cooperado |
| Token (Flex) | Mecanismo de demand response coletivo |
| Token (Social) | Resiliência intracooperativa (Pool Social) |
| **600k kWh saldo escritural** | **Estoque inicial pra VPP** (não só lixo regulatório) |
| **FCFS** | **Mecanismo de capitalização** (financia novas usinas + EV) |
| **Eletroposto/EV** | **Componente físico da VPP** (drena estoque + gera demanda nova) |
| **Convênios + indicação** | **Mecanismo de crescimento da base VPP** (mais cooperados = mais ativos gerenciáveis) |
| **Demand response WA** | **Monetização VPP** (vender flexibilidade pra distribuidora) |

#### Fluxo VPP textbook (demand response via WhatsApp)

```
17:00 → Sistema detecta pico previsto na rede ES
  ↓
WhatsApp Bot notifica 200 cooperados:
  "⚡ Pico em 30 min. Desloque consumo pesado por 1h → ganhe 10 CT"
  ↓
Cooperados respondem SIM → desligam ar-condicionado, máquina de lavar
  ↓
Redução coletiva de ~500-800 kW na rede ES
  ↓
CoopereBR entrega demand response para a distribuidora
  ↓
Potencial futuro: vender flexibilidade no mercado de ancilagem
```

#### Janela competitiva

ESTRATEGIA-INOVACAO destaca: **"Nenhuma distribuidora nem concessionária oferece isso pro cliente residencial no ES. A CoopereBR chegaria primeiro."**

- Depende Tarifa Branca homologada (ANEEL CP 46/2025)
- Smart meters disponíveis pros cooperados
- Estimativa janela: **2026-2028** (próximos 2-3 anos)

Se outras cooperativas detectarem essa tese antes, vantagem some.

#### Implicação técnica IMEDIATA (mesmo sendo longo prazo)

Decisões de **ARQUITETURA** tomadas AGORA afetam viabilidade futura da VPP:

- **Schema do token** (campos pra Flex + Social) — afeta esquema da VPP
- **4 eventos contábeis** catalogados — afeta capacidade de monetizar ancilagem
- **Multi-tenant** (isolamento por cooperativa) — afeta se VPP é por parceiro ou consolidada
- **Integração WhatsApp** (notificação massiva) — afeta capacidade de demand response

**Recomendação:** refator do Sprint CT Etapa 2 deve **considerar a tese VPP** como filtro arquitetural, mesmo sem implementar Flex/Social agora. Schema decisions hoje impactam capability futura.

#### Posicionamento competitivo (tabela ESTRATEGIA-INOVACAO)

| Capacidade | CoopereBR | Distribuidora | Outras cooperativas |
|---|---|---|---|
| Geração própria | ✅ 3 usinas | ❌ | Alguns |
| **Tokenização de excedente** | ✅ Implementado | ❌ | ❌ |
| **Demand response coordenado** | 🔄 Fase 2 | ❌ (residencial) | ❌ |
| **Mobilidade elétrica integrada** | 🔄 Planejado | ❌ | ❌ |
| Pool social entre cooperados | 🔄 Fase 3 | ❌ | ❌ |

### 5.5 Token × Fio B

**Estado atual:**
- Fio B não implementado (D-30L)
- Sprint 5a catalogado (3-5 dias Code)
- Valor do token CLUBE depende de valor da cobrança correta

**Implicação:**
- Sem Fio B, cobrança CLUBE pode estar errada em 10-30% (dependendo da classe GD da usina)
- Refator do Sprint CT Etapa 2 deve esperar Sprint 5a OU aceitar valor aproximado

---

## Parte 6 — Estado real implementado vs spec

Matriz consolidada do que existe hoje (validado em 20/04 + atualizações posteriores):

| Item | Existe em código | Implementado? | Status real |
|---|---|---|---|
| Schema CooperTokenLedger | ✅ | ✅ | 9 reg banco |
| Schema CooperTokenSaldo | ✅ | ✅ | 5 reg banco |
| Schema ConfigCooperToken | ✅ | 🟡 | 1 reg (CoopereBR), 0 outras coops |
| Schema CooperTokenSaldoParceiro | ✅ | 🟡 | 1 reg |
| Schema CooperTokenCompra | ✅ | 🟡 | 0 reg |
| Schema OfertaClube | ✅ | 🔴 | 0 reg em produção |
| Schema ResgateClubeVantagens | ✅ | 🔴 | 0 reg em produção |
| Schema ProgressaoClube | ✅ | 🟡 | 2 reg |
| Schema Plano (campos token) | ✅ | ✅ | 11 campos, 1 plano com flag ativa |
| Cron apurarExcedentes (6h) | ✅ | ✅ | Roda diariamente |
| Cron expirarTokensVencidos (mensal) | ✅ | ✅ | Roda dia 1 mensal |
| Service creditar/debitar | ✅ | ✅ | Funcional, idempotente |
| Service calcularValorAtual (decay) | ✅ | 🟡 | HARDCODED 10/20/26/29 |
| Service getSaldo/getExtrato | ✅ | ✅ | Funcional |
| Service usarNaFatura (cooperado) | ✅ | ✅ | Funcional |
| Service QR pagamento | ✅ | 🟡 | Funcional mas requer COOPERTOKEN_QR_SECRET |
| Service transferirTokensParceiro | ✅ | ✅ | Funcional |
| Service usarTokensEnergia (parceiro) | ✅ | ✅ | Funcional |
| Service comprarTokensParceiro | ✅ | 🟡 | Funcional, 0 compras |
| Endpoints REST cooper-token (30) | ✅ | ✅ | Documentados em 20/04 |
| Endpoints REST clube-vantagens (14) | ✅ | ✅ | Idem |
| Frontend `/dashboard/cooper-token` | ✅ | ✅ | Funcional |
| Frontend `/portal/tokens` | ✅ | ✅ | Funcional (QR + abater fatura) |
| Frontend `/portal/clube` | ✅ | 🟡 | Funcional mas 0 ofertas |
| Frontend `/portal/ranking` | ✅ | ✅ | Funcional |
| Especificação contabilidade | 📄 spec | 🔴 | 4 eventos sem ponte LancamentoCaixa |
| FCFS | 📄 spec parcial | 🔴 | Não existe |
| Eletroposto/EV | 📄 spec parcial | 🔴 | Não existe |
| Token Flex (demand response) | 📄 enum + spec | 🔴 | Fase 2 prevista |
| Token Social (pool) | 📄 enum + spec | 🔴 | Fase 3 prevista |
| Token via Convênio | 📄 não documentado | 🔴 | Gap apontado por Luciano |
| Splits de receita configuráveis | 📄 spec parcial | 🔴 | Hardcoded 2% |
| 600k kWh saldo escritural tokenizado | 📄 spec | 🔴 | Não implementado |
| Specs Jest cooper-token | 📄 catalogado P0 | 🔴 | 0 arquivos .spec.ts |

**Resumo:** ~60-70% do MVP §8 da spec canônica existe em código. O que falta é:
- (i) Conceitos estruturantes não implementados (FCFS, EV, demand response)
- (ii) Conexões cross-domain (Token×Convênio, Token×Indicação)
- (iii) Refator de dualidade (Plano vs ConfigCooperToken)
- (iv) Specs Jest (pré-requisito P0)

---

## Parte 7 — Recomendação refinada de escopo Fatia C (Sprint CooperToken Etapa 1 — specs Jest)

### Princípio

**Etapa 1 (specs Jest) deve cobrir o COMPORTAMENTO ATUAL implementado**, não as 4-5 visões divergentes das specs históricas. Razão: spec Jest valida código existente, não conceito futuro.

### Escopo refinado Etapa 1 (specs Jest)

| # | Cenário | Arquivo coberto | Tempo estimado |
|---|---|---|---|
| 1 | `creditar` idempotente + taxa 2% + multi-tenant | cooper-token.service.ts:60 | 1h |
| 2 | `debitar` valida saldo + cria ledger | cooper-token.service.ts:170 | 1h |
| 3 | `calcularValorAtual` decay hardcoded (5 cenários) | cooper-token.service.ts:216 | 30 min |
| 4 | `getSaldo` retorna saldo + valor estimado | cooper-token.service.ts:222 | 30 min |
| 5 | `calcularDesconto` tokens necessários + desconto max | cooper-token.service.ts:268 | 1h |
| 6 | `expirarVencidos` cria EXPIRACAO + atualiza saldo | cooper-token.service.ts:290 | 1h |
| 7 | `usarNaFatura` debita + atualiza cobranca | cooper-token.service.ts:1177 | 1h |
| 8 | `gerarQrPagamento` + `processarPagamentoQr` (debito+credito) | cooper-token.service.ts:716,751 | 1.5h |
| 9 | `transferirTokensParceiro` + `usarTokensEnergia` | cooper-token.service.ts:998,935 | 1h |
| 10 | Cron `apurarExcedentes` (3 cenários) | cooper-token.job.ts:20 | 1h |
| 11 | Cron `expirarTokensVencidos` | cooper-token.job.ts:120 | 30 min |
| 12 | Multi-tenant guard em endpoints | cooper-token.controller.ts | 1h |
| 13 | Fallback 0.45 (validar comportamento ANTES de remover) | múltiplos | 30 min |

**Total estimado:** 11-12h Code (refina 6-8h original — mais realista dado a complexidade).

### O que NÃO entra na Etapa 1

- **NÃO** mudar comportamento — só TESTAR comportamento atual
- **NÃO** remover hardcodes 0.20 ou 0.45 (Etapa 2)
- **NÃO** refatorar Plano → ConfigCooperToken (Etapa 2)
- **NÃO** implementar FCFS / EV / demand response
- **NÃO** documentar conexão Token × Convênio (spec separada)

### Critério de pronto Etapa 1

- 13 cenários cobertos com specs Jest verde
- Coverage ≥ 80% no módulo cooper-token
- Zero regressões em outros módulos
- Documentado em `docs/SISTEMA.md` §11 (decisões arquiteturais) ou seção dedicada

---

## Parte 8 — 8 débitos novos a catalogar (D-35 a D-42)

Sugiro catalogar em `docs/debitos-tecnicos.md`:

### D-35 (P3 documental) — Vocabulário CooperToken não consolidado entre specs

**Tema:** 4 vocabulários paralelos pra mesmo conceito (Caminho A/B, Opção A/B, DESCONTO/CLUBE, Plano Desconto/Plano Token). Schema mistura `modoToken` (Plano) e `modoRemuneracao` (Cooperado).

**A fazer:** consolidar vocabulário antes do refator do Sprint CT Etapa 2.

**Severidade:** P3 documental.

### D-36 (P2 produto) — FCFS detalhado em 1 spec, ausente em outras

**Tema:** Fundo Cooperativo de Fomento Solar é conceito ESTRUTURANTE em `COOPERTOKEN-FUNDAMENTOS.md` (10 contas, contribuição voluntária, financia usinas/EV). Ausente em outras 4 specs e código.

**Decisão produto necessária:** entra ou abandonar?

**Severidade:** P2 (decisão estratégica adiada).

### D-37 (P2 produto) — Eletroposto/EV catalogado mas não implementado

**Tema:** Mobilidade Elétrica detalhada em 2 specs (ESTRATEGIA-COOPERTOKEN + ESTRATEGIA-INOVACAO) como caminho de drenagem dos 600k kWh + funil aquisição. Não existe em código.

**A fazer:** decidir se entra como Sprint dedicado.

**Severidade:** P2 (oportunidade estratégica não acionada).

### D-38 (P1 estrutural) — Conexão Token × Convênio não documentada

**Tema:** Luciano apontou em 13/05 que convênios podem usar token como pagamento de benefício/indicação/convites. NENHUMA spec aborda essa conexão.

**A fazer:** spec dedicada `especificacao-token-convenio.md` antes do Sprint CT Etapa 2.

**Severidade:** P1 estrutural (afeta dimensionamento do Sprint CT Etapa 2).

### D-39 (P2 código) — Splits de receita hardcoded 2%

**Tema:** `cooper-token.service.ts:60` aplica taxa 2% hardcoded. COOPERTOKEN-FUNDAMENTOS propõe split configurável (50/30/20 por evento).

**A fazer:** dentro do Sprint CT Etapa 2.

**Severidade:** P2.

### D-40 (P3 código) — Decay hardcoded vs configurável

**Tema:** `cooper-token.service.ts:216 calcularValorAtual` tem thresholds hardcoded (10/20/26/29 dias) que não batem com nenhuma spec direito.

**A fazer:** dentro do Sprint CT Etapa 2, decidir período e fórmula final + tornar configurável.

**Severidade:** P3 (operacional não bloqueante).

### D-41 (P2 produto) — 600k kWh saldo escritural não tokenizado

**Tema:** ESTRATEGIA-INOVACAO descreve 3 caminhos pra 600.000 kWh represados (~R$ 473k). Lote mais antigo expira maio/2028.

**A fazer:** decidir caminho (tokenização imediata / contestação ANEEL / reestruturação EDP).

**Severidade:** P2 (oportunidade estratégica com prazo).

### D-42 (P3 código + produto) — Contabilidade do clube (4 eventos sem ponte LancamentoCaixa)

**Tema:** 4 eventos contábeis (Emissão / Uso / Expiração / Parceiro usa) documentados em `especificacao-contabilidade-clube.md`. Ledger funciona, ponte LancamentoCaixa não existe.

**A fazer:** Sprint 11 catalogado. Antes: Luciano conversa com contador.

**Severidade:** P3.

### D-43 (P2 estratégica) — VPP como tese guia NÃO catalogada formalmente

**Tema:** VPP (Virtual Power Plant) é tese estratégica de longo prazo detalhada em `ESTRATEGIA-INOVACAO-2026.md` que conecta TODAS as peças do CooperToken (Token Geração + Flex + Social + 600k kWh + FCFS + EV + Demand Response + Mercado Ancilagem). NÃO catalogada formalmente em `PLANO-ATE-PRODUCAO.md` nem em débitos.

**Implicação imediata:** decisões arquiteturais do Sprint CT Etapa 2 (refator) devem considerar VPP como filtro arquitetural, mesmo sem implementar Flex/Social agora. Schema decisions hoje impactam capability futura.

**Janela competitiva:** 2026-2028 (depende Tarifa Branca homologada + smart meters). "CoopereBR chegaria primeiro no ES residencial" — vantagem some se outras cooperativas detectarem tese antes.

**A fazer:**
1. Catalogar VPP formalmente em `PLANO-ATE-PRODUCAO.md` como horizonte estratégico (não sprint imediato)
2. Adicionar checkpoint arquitetural na Etapa 2 do Sprint CT: "decisões compatíveis com tese VPP?"
3. Reavaliar quando Tarifa Branca homologar (ANEEL CP 46/2025)

**Severidade:** P2 estratégica — não bloqueia operação hoje, mas decisões de hoje afetam horizonte 2-3 anos.

---

## Parte 9 — Próximos passos sugeridos

### Sequência recomendada

1. **Sessão claude.ai dedicada (~3-4h)** — decisões produto pendentes
   - 10 conflitos catalogados (Parte 4)
   - 8 débitos D-35 a D-42
   - Vocabulário consolidado
   - Spec Token × Convênio rascunho
2. **Sprint CT Etapa 1 (11-12h Code)** — specs Jest cobrindo comportamento atual
3. **Sprint CT Etapa 2 (10-14h Code)** — refator dualidade + UI nova + remover hardcodes
4. **Sprint contabilidade clube (Sprint 11)** — ponte LancamentoCaixa após conversa com contador
5. **Sprints dedicados** futuros conforme decisão produto:
   - Token × Convênio (D-38)
   - FCFS (D-36)
   - EV/Eletroposto (D-37)
   - 600k kWh tokenização (D-41)
   - Sprint 5a Fio B (já catalogado, agora prioridade pra valor correto do token)

### Estimativa total Sprint CT Consolidado revisada

- **Etapa 1 (specs):** 11-12h (era 6-8h)
- **Etapa 2 (refator):** 10-14h (era 8-10h, sobe se incluir spec Token×Convênio antes)
- **Total:** 21-26h (era 14-18h)

Aumento de 7-8h por:
- Specs Jest mais cobertura (13 cenários vs estimativa original)
- Spec Token × Convênio dentro de Etapa 2

### Decisão Luciano

**Caminho A — Etapa 1 direto (sem sessão claude.ai antes):**
- Specs Jest cobrem comportamento atual. Decisões produto ficam pra depois.
- Risco: Etapa 2 trava em decisões pendentes.

**Caminho B — Sessão claude.ai primeiro (recomendado):**
- 3-4h dedicada a 10 decisões + spec Token × Convênio
- Depois Etapa 1 + Etapa 2 com escopo claro
- Total: ~28-32h trabalho (4h claude.ai + 24-28h Code)

**Caminho C — Reordenar pilha do Plano Mestre:**
- Fatia A canário Caminho A real primeiro (não bloqueado por D-33 pós-reframe)
- Sprint CT Consolidado em sessão dedicada futura
- Total: depende da janela

---

## Apêndice — Outras observações

### Achado meta — D-30Z gap 85 cooperados

Já catalogado. Investigação confirmou 317 cooperados em `opcaoToken='A'` vs 232 em `modoRemuneracao='DESCONTO'`. Diferença de 85 cooperados em estado intermediário.

**Implicação pra Sprint CT:** Etapa 2 (refator) precisa migrar esses 85 antes de remover `opcaoToken` deprecated.

### Achado meta — 14 decisões pendentes em invest. 20/04 (Seção 7)

Muitas continuam abertas:
- 7.1 Dualidade ConfigCooperToken vs Plano (sprint catalogado)
- 7.2 superadmin/config-defaults 501 NOT_IMPLEMENTED
- 7.3 bonusAniversario sem código
- 7.4 bonusIndicacao não está no schema
- 7.5 tokenSocialAtivo + tokenFlexAtivo sem uso
- 7.6 modoGeracao + modeloVida sem uso
- 7.7 Fallback 0.45 hardcoded (D-39)
- 7.8 Zero testes (Sprint CT Etapa 1)
- 7.9 COOPERTOKEN_QR_SECRET não validado no startup
- 7.10 CLUBE_RESUMO_MENSAL_HABILITADO bloqueado
- 7.11 RESGATE_CLUBE enum não usado
- 7.12 limiteTokenMensal + tetoCoop sem uso
- 7.13 saldoPendente sempre zero
- 7.14 Ofertas sem nivelMinimo (desconexão Clube vs Ofertas)

Muitos casos de "schema/enum existe mas código não usa" — sugere implementação parcial em momentos diferentes sem consolidação.

### Achado meta — Histórico do projeto

Specs `docs/specs/*` são de mar/abr/2026. Spec canônica `docs/especificacao-clube-cooper-token.md` é mais recente + adendo §11 de 04/05. Investigação invest. 20/04 é o melhor mapa técnico.

Evidência de que ConcepçãoToken evoluiu rapidamente nos últimos 60 dias:
- 02-31/03: 4 specs concorrentes
- 01/04: 1 spec consolidada (CooperToken-Fundamentos aprovada)
- 20/04: investigação técnica reconciliou conceitos
- 04/05: decisão Sprint CT Consolidado
- 13/05: pergunta de Luciano abre nova conexão (Token × Convênio)

---

*Documento gerado em 13/05/2026 noite — 14/05/2026 madrugada por claude.ai (Opus 4.7) durante leitura noturna de 13 fontes (4.819 linhas de spec).*
