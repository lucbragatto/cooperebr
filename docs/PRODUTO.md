# PRODUTO — SISGD

> **Visão humana e funcional do SISGD.**
> Para visão técnica (schema, endpoints, módulos), ver [SISTEMA.md](./SISTEMA.md) (Fatia 3 do Doc-0, ainda stub).
> Para detalhamento regulatório ANEEL e funcionalidades regulatórias, ver [REGULATORIO-ANEEL.md](./REGULATORIO-ANEEL.md).
> Para instruções operacionais Claude Code, ver [CLAUDE.md](../CLAUDE.md).
> Para estado atual de execução, ver [CONTROLE-EXECUCAO.md](./CONTROLE-EXECUCAO.md).

**Última atualização:** 30/04/2026 — Doc-0 Fatia 2

---

## Sumário Executivo

O **SISGD** é uma plataforma SaaS multi-tenant para gestão de **Geração Distribuída** (GD) de energia solar no Brasil. Atende cooperativas, consórcios, associações e condomínios que organizam a relação entre **proprietários de usinas geradoras** e **consumidores finais** (membros) sob o regime SCEE (Sistema de Compensação de Energia Elétrica) regulado pela ANEEL.

**Posicionamento.** SISGD não é "ERP de cooperativa de energia" nem "gateway de pagamento". É **plataforma regulatória + operacional**: traduz Lei 14.300/2022 e regras locais de cada distribuidora em fluxos automatizados, validações regulatórias, motor de cobrança multi-modelo e governança financeira pro dono da plataforma (Luciano) e pros admins de cada parceiro.

**Modelo de negócio.**
- **Luciano** (dono SISGD, juiz TJES, não programador) cobra cada **Parceiro** mensalmente via FaturaSaas.
- **Parceiros** (CoopereBR, Sinergia, etc.) cobram seus **Membros** (cooperados, consorciados, associados, condôminos) via Cobrança mensal — esses NÃO pagam Luciano.
- **CoopereBR** é o primeiro parceiro real (não é o dono do sistema).

**Estado atual** (30/04/2026).
- 2 parceiros no banco (CoopereBR OURO produção + CoopereBR Teste TRIAL PRATA).
- ~303 membros ativos da CoopereBR (era 125 em mar/2026 — cresceu 2,4× em 5 semanas).
- Sprint 13a 3/3 concluído (Painel SISGD operacional, lista parceiros enriquecida, cards saúde, IDOR fix).
- 10 sprints pré-produção identificados (17-23 semanas de Code dedicado). Ver [PLANO-ATE-PRODUCAO.md](./PLANO-ATE-PRODUCAO.md).

**Roadmap (resumo).**
- Sprint 0 — **Auditoria Regulatória Emergencial** (P0 urgente — caso Exfishes provou risco regulatório ativo).
- Sprints 1-4 — destravar o que já existe (FaturaSaas + OCR-DINAMICO + Assinafy + Portal Proprietário).
- Sprint 5 — **Módulo Regulatório ANEEL completo** (5 flags + classes GD + Fio B + concentração).
- Sprint 6 — Auditoria IDOR geral (segurança multi-tenant antes de Sinergia migrar).
- Sprints 7-9 — DRE + conciliação + Política/Engine de Otimização + Motor de Diagnóstico Pré-Venda.

---

## Camada 1 — Atores Fundamentais

### 3 entidades de identidade

O SISGD opera com **3 entidades fundamentais**:

1. **SISGD** — a plataforma (entidade conceitual; dono Luciano).
2. **Parceiro** — assina contrato com SISGD; tabela legada `Cooperativa`; 4 tipos ANEEL: COOPERATIVA, CONSORCIO, ASSOCIACAO, CONDOMINIO.
3. **Membro** — assina contrato com Parceiro; tabela legada `Cooperado`; nomenclatura por tipo: cooperado/consorciado/associado/condômino.

**Tudo demais é atributo sobreposto, não categoria nova.** Proprietário de usina, conveniado, agregador, indicador MLM — todos são **atributos** sobre `Cooperado`. O sistema **não cria novas tabelas** pra cada papel.

### 12 papéis humanos (personas operacionais)

Apesar das 3 entidades, o SISGD descreve **12 papéis humanos** (personas) pra ajudar Luciano e equipes a raciocinar sobre quem usa o quê.

#### 1. Luciano — Dono da Plataforma (SUPER_ADMIN)

Você. Dono do SISGD. Vende plataforma pros parceiros. Cobra cada parceiro pelo uso. **Vê tudo de todos os parceiros.** Cuida da saúde do sistema (servidor, integrações, pagamentos do gateway). Hoje precisa abrir várias telas pra fazer governança.

#### 2. Marcos — Admin do parceiro (ADMIN)

Administrador da CoopereBR. Cadastra cooperados, gera cobranças, aprova faturas que chegam por email da EDP, cobra inadimplentes. **Não enxerga nenhum outro parceiro** (multi-tenant: cada admin vê só seu parceiro).

#### 3. Pedro — Operador (OPERADOR)

Funcionário operacional do parceiro. Faz tarefas do dia a dia: aprova fatura, registra pagamento, atende cooperado. Mesmo escopo do Marcos mas com algumas restrições.

#### 4. Ana — Cooperada solta (COOPERADO)

Pessoa física que descobriu CoopereBR pelo Instagram, se cadastrou pelo site (`/cadastro`), conta de luz própria (CPF), 1 UC residencial. Hoje paga 18-20% menos na conta. Acessa portal do cooperado (`/portal`) pra ver suas faturas, pagamentos, indicar amigos.

#### 5. Júlia — Cooperada via indicação (COOPERADO com indicador)

Mesma natureza da Ana, mas chegou pelo link de indicação dela (`/cadastro?ref=ANA`). Sistema registra `Indicacao`. Quando Júlia paga primeira fatura, Ana recebe bônus.

#### 6. Carlos — Agregador / dono de rede (AGREGADOR)

Empresário, dono da Hangar Academia. Hangar tem 2 unidades (2 UCs grandes B3 comercial). Cadastra Hangar como cooperado AGREGADOR, recebe link de convite, distribui pros 15 professores. Cada professor pode trazer alunos. Ganha bônus em cascata pelas indicações da rede dele.

#### 7. Pedro Prof — Cooperado dentro de rede

Professor da Hangar que se cadastrou via link do Carlos. Cooperado normal (CPF, UC residencial), mas tem indicador (Carlos) e ele mesmo pode indicar alunos.

#### 8. Helena — Síndica de condomínio

Síndica do Moradas da Enseada (50 apartamentos + áreas comuns em Guarapari/ES). Quer trazer condomínio inteiro pra economizar. **Hoje não há tela específica de "síndico"** — Helena seria criada como cooperada com vínculo a `Condominio`, mas fluxo de "convidar 50 condôminos" não está pronto. 🔴

#### 9. Roberto — Condômino (COOPERADO com unidadeCondominioId)

Morador do apartamento 502 do Moradas. Cooperado normal, mas vinculado ao condomínio via `UnidadeCondominio`. Vê economia da própria UC mais a parte rateada das áreas comuns.

#### 10. Patrícia — Administradora de condomínios (ADMIN da entidade Administradora)

Empresa que administra vários condomínios. No SISGD vira `Administradora` com vários `Condominio` vinculados. 1 administradora cadastrada hoje (esqueleto), fluxo ainda não fechado. 🟡

#### 11. Solange — Conveniado / parceiro institucional

Pessoa física ou jurídica representante de associação, sindicato, empresa. Faz convênio com CoopereBR pra trazer membros (Hangar é caso real). Recebe descontos progressivos conforme quantidade de membros ativos. Estrutura `ContratoConvenio` existe (53 KB no módulo `convenios`, 18 endpoints) mas **0 registros em produção**. 🟡

#### 12. Walter — Contador (papel ainda não tem perfil próprio)

Contador externo da CoopereBR. Vai precisar acesso a DRE, conciliação bancária, fechamento de mês, livro caixa. **Nenhum desses existe ainda como tela** — só `LancamentoCaixa` no banco com 53 registros. 🔴

### Princípio fundamental

**Tudo demais é atributo sobreposto, não categoria nova.** Marcos é Cooperado da CoopereBR (PJ — a CoopereBR como cooperativa). Carlos é Cooperado AGREGADOR. Solange é Cooperado com `ContratoConvenio` ativo. Cada um tem 1 registro em `Cooperado` + atributos.

---

## Camada 2 — Estrutura Física e Relacional

### Cooperativa (parceiro) → Usinas + UCs + Cooperados + Contratos

Cada **Cooperativa** (parceiro) é o **TENANT ROOT** do sistema. Toda query Prisma filtra por `cooperativaId`. Nenhum dado vaza entre parceiros.

```
Cooperativa (TENANT ROOT)
├── Usinas (geradoras solares)
│   ├── potenciaKwp (capacidade nominal kW)
│   ├── dataHomologacao (quando ANEEL liberou)
│   ├── distribuidora (EDP_ES, CEMIG, etc.)
│   └── proprietarioCooperadoId (vincula a cooperado-proprietário)
├── Cooperados (membros)
│   ├── tipoCooperado (COM_UC, AGREGADOR, etc.)
│   ├── cooperativaId (multi-tenant)
│   └── usinaPropriaId (se é proprietário de usina)
├── UCs (unidades consumidoras)
│   ├── numero (canônico SISGD, 10 dígitos)
│   ├── numeroUC (legado EDP, 9 dígitos)
│   ├── numeroConcessionariaOriginal (formato cru da fatura)
│   └── distribuidora (DistribuidoraEnum obrigatório)
└── Contratos (elo central)
    ├── cooperadoId, ucId, usinaId
    ├── planoId (Plano + modeloCobranca)
    ├── percentualUsina (% que ocupa da capacidade da usina)
    ├── kwhContratoAnual / Mensal
    ├── tarifaContratual (snapshot do plano no aceite)
    └── status (PENDENTE_ATIVACAO / ATIVO / LISTA_ESPERA / etc.)
```

### Validações ANEEL básicas (já implementadas)

- **Mesma distribuidora** UC × Usina (regra `validarCompatibilidadeAneel` em `usinas.service.ts:77`). 🟢 Implementado.
- **Capacidade da usina** — soma dos `kwhContrato` ativos não pode ultrapassar capacidade nominal. 🟢 Implementado.

### Validações ANEEL faltantes (Sprint 5 implementa)

- **Concentração ≤ 25% por cooperado-usina** (default — flag `concentracaoMaxPorCooperadoUsina`). 🔴 Hoje não validado — caso Exfishes provou.
- **Mesma classe GD na mesma usina** (flag `misturaClassesMesmaUsina`). 🔴 Hoje não validado.
- **UC consumindo de múltiplas usinas** (flag `multipleUsinasPerUc`). 🔴 Schema atual 1:1 não permite.
- **Saldo intransferível entre UCs** (flag `transferenciaSaldoEntreUcs`). 🟡 Hoje saldo é por par (UC, Usina) implícito, mas não formalizado.

> Detalhamento completo das 5 flags em [REGULATORIO-ANEEL.md Seção 8](./REGULATORIO-ANEEL.md).

### Capacidade da usina (snapshot real, 30/04/2026)

- 10 usinas no banco (1 ativa em produção, demais em teste/preparação).
- 7 entradas em `ListaEspera` (4 AGUARDANDO + 1 ALOCADO + 2 status legados PROMOVIDO/ATENDIDO não tratados pelo motor atual).

### ContratoUso — 3 modalidades (Sprint 4 implementa)

Quando uma usina é arrendada (proprietário ≠ parceiro), o vínculo é via `ContratoUso`. **3 modalidades combináveis livremente:**

1. **Fixa por mês** (`valorFixoMensal`) — aluguel tradicional R$ X/mês.
2. **Fixa por kWh gerado** (`valorPorUnidade`) — proporcional à geração.
3. **Percentual sobre tarifa concessionária sem tributos** (`percentualRepasse` × tarifa SCEE sem ICMS).

**Princípios:**
- Combinação livre (proprietário pode ter `valorFixoMensal=R$ 5.000` + `percentualRepasse=10%` simultaneamente).
- **NÃO é "% lucro líquido"** — proprietário não vê despesas operacionais do parceiro.
- Tarifa de referência vem de `TarifaConcessionaria`.

**Estado atual:** schema completo, service com 160 linhas (CRUD), `gerarLancamentoMensal()` lê apenas `valorFixoMensal` (linha 116-151). `percentualRepasse` está no schema mas **nunca é consumido**. **0 ContratoUso no banco.** 🔴 Sprint 4 implementa.

---

## Camada 3 — Cadastro de Membros

### 3 caminhos públicos

| Rota | Tipo | Cria Cooperado? | Endpoint backend | OCR? |
|---|---|---|---|---|
| `/cadastro` | Formulário web completo | **Sim** (V2 ativo desde Sprint 10) | `POST /publico/cadastro-web` | Sim (`POST /publico/processar-fatura-ocr`) |
| `/entrar` | Captura de lead | Não — cria `ConversaWhatsapp` | `POST /publico/iniciar-cadastro` | Não |
| `/convite/[codigo]` | Igual `/entrar`, com indicador | Não — cria `ConversaWhatsapp` | `POST /publico/iniciar-cadastro` | Não |

**Os três coexistem hoje.** `/entrar` e `/convite` formam o trio de captura de lead pelo WhatsApp (bot abre conversa). `/cadastro` é o formulário direto.

### Fluxo completo (membro novo, caso Ana — cooperada solta)

1. Ana descobre CoopereBR no Instagram.
2. Acessa `/cadastro`.
3. Sobe foto da fatura EDP-ES. **OCR Claude AI** extrai 50+ campos em ~20s. 🟢
4. Confirma dados. Escolhe plano (Plano Individual Residencial, 18% desconto).
5. Sistema gera proposta com cálculo de economia. 🟢
6. Ana assina **Termo de Adesão + Procuração** eletronicamente. 🟡 Hoje via campos no model — Sprint 3 traz Assinafy.
7. Marcos (admin) recebe notificação, aprova documentos.
8. Sistema muda status pra `APROVADO` e gera contrato vinculando a uma usina compatível (mesma distribuidora). 🟢
9. Marcos cadastra UC numa lista que vai pra EDP (compensação GD). 🟢 Lista existe em `/dashboard/usinas/listas`.
10. EDP homologa UC após ~30 dias. Marcos muda status pra `ATIVO_RECEBENDO_CREDITOS`.
11. Mês seguinte: cobrança automática FIXO_MENSAL. 🟢 Asaas em sandbox; produção pendente.

### 7 pontos de pendência identificados

| # | Pendência | Status |
|---|---|---|
| 1 | Proposta gerada aguardando assinatura | 🟢 Cron 9h envia lembrete WA + email |
| 2 | Proposta assinada aguardando documentos pessoais | 🟡 Auto-aprovação se admin lento, sem cutucada ao cooperado |
| 3 | Documentos aprovados aguardando assinatura termos finais | 🟢 Mesmo cron 9h cobre |
| 4 | Termos assinados aguardando admin enviar lista pra EDP | 🔴 Sem alerta |
| 5 | UC aguardando aprovação EDP (`AGUARDANDO_CONCESSIONARIA`) | 🔴 Sem cron |
| 6 | Cooperado APROVADO aguardando primeira fatura EDP | 🟢 Pipeline IMAP funciona |
| 7 | Fatura aprovada gerando primeira cobrança | 🟢 `gerarCobrancaPosFatura` funciona |

### 5 documentos do sistema (Sprint 3)

| Documento | Função | Provedor |
|---|---|---|
| **Proposta Comercial** | Gerada pelo Motor com cálculo de economia | Hoje PDF preview, Sprint 3 vira documento assinável |
| **Termo de Adesão** | Vínculo membro ↔ parceiro | 🟡 Hoje cita RN 482/2012 (D-30H) — Sprint 3 atualiza |
| **Termo de Responsabilidade** | Sobre uso da plataforma e dados | 🔴 Não existe — Sprint 3 cria |
| **Procuração ANEEL** | Membro autoriza parceiro perante distribuidora | 🟡 Hoje cita RN 482/2012 — Sprint 3 atualiza |
| **Contrato** | Formalização final do vínculo | 🟢 Existe |

**Princípios Sprint 3:**
- Provedor **Assinafy** (validade jurídica brasileira).
- Templates iniciais SISGD; cada parceiro customiza.
- Admin escolhe quais documentos usar e pode **agrupar pra 1 assinatura**.

> Detalhamento Sprint 3 em [PLANO-ATE-PRODUCAO.md](./PLANO-ATE-PRODUCAO.md).

---

## Camada 4 — Alocação e Lista pra Concessionária

### 5 sub-fluxos

1. **Cooperado entra na fila** — após aceitar proposta, se não há usina compatível com vaga, cria entrada em `ListaEspera` (status AGUARDANDO).
2. **Sistema busca usina compatível** — mesma distribuidora UC × Usina. Capacidade restante = capacidade − Σ kWh dos contratos ATIVOS.
3. **Geração de lista** — exporta CSV/PDF/Excel via tela `/dashboard/usinas/listas` (componente `DualListaConcessionaria.tsx`). 🟢 Implementado.
4. **Admin assina e envia** — manualmente pra EDP. 🟢 Operacional.
5. **Resposta da concessionária** — admin atualiza status UC. 🔴 Sem cron de lembrete.

### Política de Alocação por Faixas (🔴 Sprint 8)

**Padrão SISGD** (cada parceiro pode customizar):

```
Pequenos consumidores (até 500 kWh/mês)  → Usinas GD II (faixas progressivas Fio B)
Médios (500-2.000 kWh/mês)               → GD I ou GD II conforme disponibilidade
Grandes (acima de 2.000 kWh/mês)         → Usinas GD I (Fio B isento)
```

**Princípios:**
- **Padrão SISGD** publicado como ponto de partida.
- **Customização por parceiro** (cada parceiro pode definir faixas próprias).
- **Simulação prévia obrigatória** antes de alocar (sistema mostra "se alocar X em Y, concentração ficará em Z%").
- **Migração controlada** — mudança de política não migra cooperados existentes automaticamente.

> Detalhamento completo em [REGULATORIO-ANEEL.md Seção 9](./REGULATORIO-ANEEL.md).

### Engine de Otimização com Split (🔴 Sprint 8)

Sistema sugere realocações automáticas respeitando:
- Concentração ≤ flag `concentracaoMaxPorCooperadoUsina` (default 25%).
- Política de Alocação por Faixas.
- Capacidade da usina.
- Compatibilidade ANEEL.
- **Estabilidade mínima** — cooperado alocado < 3 meses não migra (anti-rebalanceamento agressivo).

**Modos:**
- **Sugestão (default)** — engine sugere, admin aprova caso a caso.
- **Automático com guard-rails** — engine executa pequenas, grandes precisam aprovação.

**Split** — uma UC pode ser dividida entre múltiplas usinas (controlado por flag `multipleUsinasPerUc`).

> Detalhamento completo em [REGULATORIO-ANEEL.md Seção 10](./REGULATORIO-ANEEL.md).

---

## Camada 5 — Cobrança do Membro

### 3 modelos

| Modelo | Como calcula | Estado |
|---|---|---|
| **FIXO_MENSAL** | `kwhContratoMensal × tarifaContratual` (preço travado) | 🟢 Implementado e único ativo em produção |
| **CREDITOS_COMPENSADOS** | `kwhCompensado da fatura × tarifaContratual × (1 − desconto%)` | 🟡 Implementado, **bloqueado por env `BLOQUEIO_MODELOS_NAO_FIXO`** |
| **CREDITOS_DINAMICO** | `kwhCompensado × tarifaCheia EDP × (1 − desconto%)` (revisão pendente) | 🔴 `NotImplementedException` em `faturas.service.ts:1882` |

**Princípio dos modelos** (`docs/especificacao-modelos-cobranca.md`):
- COMPENSADOS = **tarifa travada**, economia cresce conforme EDP reajusta. Proteção contra alta de tarifa.
- DINAMICO = desconto **relativo constante**, valor flutua com tarifa EDP.

### Pipeline completo

```
GeracaoMensal (kWh gerado pela usina)
       │
       ▼
Fatura EDP do membro (chega via IMAP em contato@<parceiro>)
       │
       ▼
email-monitor (cron 6h) → faturas.service.extrairOcr (Claude AI)
       │
       ▼
FaturaProcessada (50+ campos em dadosExtraidos)
       │
       ▼
Admin aprova na Central de Faturas
       │
       ▼
gerarCobrancaPosFatura (lê modeloCobranca do plano)
       │
       ▼
Cobranca (com modeloCobrancaUsado, valorBruto, valorDesconto, valorLiquido)
       │
       ▼
Asaas (PIX/boleto/QR Code)  →  Webhook  →  PAGA + LancamentoCaixa
       │
       ▼
Notificação cooperado (email + WhatsApp lembretes D-3, D-1, vencimento)
```

### Insumo de validação real (commit `5ae9dfd`)

Diagnóstico de fatura real do Luciano (UC `000142138005470`, EDP-ES, mês 2026-03):

- **Pipeline OCR está produzindo OCR rico** — 50+ campos extraídos: `creditosRecebidosKwh`, `tarifaTUSD`, `tarifaTE`, `valorTotal`, `saldoTotalKwh`, `participacaoSaldo`, históricos consumo.
- **0 cobranças no banco têm `modeloCobrancaUsado` preenchido.** Confirma que `gerarCobrancaPosFatura` **nunca foi exercitada em produção**. As 34 cobranças existentes são manuais/seed.
- **Contrato CTR-324704 (Luciano, plano OURO COMPENSADOS) com `tarifaContratual` vazia** — bug do snapshot do Motor.aceitar quando aceitou. Backend cai em fallback `tarifaApurada = totalAPagar / consumo` que é conceitualmente errado (totalAPagar já tem compensação aplicada).
- **DINAMICO bruto cobraria R$ 1.489** (mais que o dobro do valor sem desconto da EDP de R$ 781). Fórmula precisa normalização por consumo ou pela participação no saldo.

**Conclusão pra produto:** Sprint 2 (OCR-Integração + DINAMICO) é **obrigatório antes de qualquer parceiro usar COMPENSADOS ou DINAMICO em produção**.

### Lacunas (resolvem nos Sprints 2 + 5)

- 🔴 **Saldo agregado por cooperado/UC não é persistido** — só dá pra reconstruir somando snapshots `Cobranca.kwhCompensado`. Portal cooperado precisa de campo dedicado.
- 🔴 **Lacuna OCR×Motor de Proposta** — aprovar `FaturaProcessada` na Central nunca toca em proposta. Decisão Sprint 2: pipeline OCR alimenta apenas `Cobranca`, não Motor (Motor é só pro cadastro inicial).
- 🟡 **Snapshot de tarifa promocional** existe (`tarifaContratualPromocional` + `mesesPromocaoAplicados`) mas precisa validação E2E com plano promocional real.

---

## Camada 5b — Regulação ANEEL (referência curta)

> **Esta camada é mapeada e detalhada em [REGULATORIO-ANEEL.md](./REGULATORIO-ANEEL.md).**
> Aqui apenas o resumo executivo.

### Princípios fundamentais

1. **Lei 14.300/2022** marca o regime regulatório atual. Marco temporal: 07/01/2023.
2. **Classes GD vêm da DATA DE HOMOLOGAÇÃO da usina geradora**, não da UC consumidora:
   - **GD I** — usinas homologadas **antes** de 07/01/2023.
   - **GD II** — usinas homologadas **entre** 07/01/2023 e 06/01/2024 (regras transitórias).
   - **GD III** — usinas homologadas **a partir de** 07/01/2024 (regime pleno Lei 14.300).
3. **UC herda a classe GD da usina** à qual está vinculada.
4. **5 flags configuráveis** por parceiro (com audit trail obrigatório):
   - `multipleUsinasPerUc`, `multipleClassesGdPerUc`, `concentracaoMaxPorCooperadoUsina` (default 25%), `misturaClassesMesmaUsina`, `transferenciaSaldoEntreUcs` (saldo intransferível).
5. **Saldo é por par (UC, Usina, mês)**, não por cooperado.

### Estado: 🔴 mapeado, Sprint 5 implementa

- Schema atual **não tem** campos `classeGd`, `Fio B`, `dataProtocoloDistribuidora`, `RegrasFioB`.
- Única validação ANEEL real hoje: **mesma distribuidora UC × Usina** (`validarCompatibilidadeAneel`).
- Spec do Assis (`docs/specs/PROPOSTA-GD1-GD2-FIOB-2026-03-26.md`) tem schema/fórmulas/tabela 2022-2029 prontos — **insumo histórico**, taxonomia diferente da decisão claude.ai 30/04.
- Termo de adesão e bot CoopereAI ainda citam **RN 482/2012 (defasada)** — D-30H, D-30I.

> Para detalhamento completo, ver [REGULATORIO-ANEEL.md](./REGULATORIO-ANEEL.md).

---

## Camada 6 — FaturaSaas

> Como Luciano cobra parceiros mensalmente.

### 2 componentes implementados (não 6 prometidos pelos docs antigos)

Investigação 29/04 (`docs/sessoes/2026-04-29-validacao-invs-4-8.md`) confirmou: cálculo lê **apenas 2 componentes** do `PlanoSaas`:

```ts
const valorBase = Number(coop.planoSaas.mensalidadeBase);
// Só executa se percentualReceita > 0:
const valorReceita = Math.round(receitaTotal * (percentualReceita / 100) * 100) / 100;
const valorTotal = Math.round((valorBase + valorReceita) * 100) / 100;
```

Os outros 8 campos do `PlanoSaas` (`taxaSetup`, `limiteMembros`, `taxaTokenPerc`, `limiteTokenMensal`, `cooperTokenHabilitado`, `modulosHabilitados`, `modalidadesModulos`, `ativo`) **existem como configuração/governança** mas não viram linha na FaturaSaas.

### Estado atual

- 🟢 Cron mensal `0 6 1 * *` em `saas.service.ts:130` cria `FaturaSaas` no banco.
- 🟢 Painel SISGD `/dashboard/super-admin` mostra (Sprint 13a Dia 1).
- 🟢 1 fatura PENDENTE de teste no banco (CoopereBR Teste R$ 5.900 vencida 10/04 — registro de teste pra exercitar painel).
- 🔴 **Sem integração Asaas** (nenhum boleto/PIX emitido automaticamente).
- 🔴 **Sem comunicação parceiro** (parceiro só descobre que tem fatura quando entra no painel).
- 🔴 **Sem endpoint `PATCH /saas/faturas/:id/pagar`** — marcar PAGA exige UPDATE manual no banco.

### Gap crítico (Sprint 1)

Bloqueia entrada do primeiro parceiro real que pague Luciano. **Sprint 1 resolve:**
- Webhook Asaas dedicado pra FaturaSaas.
- Cron de comunicação D-7, D-3, D-1 + vencimento (email + WA).
- Endpoint `PATCH /saas/faturas/:id/pagar`.
- Decisão de produto: outros componentes do PlanoSaas viram itens da fatura?

> Detalhamento Sprint 1 em [PLANO-ATE-PRODUCAO.md](./PLANO-ATE-PRODUCAO.md).

---

## Camada 7 — Financeiro & Contábil

### Implementado

- 🟢 **`LancamentoCaixa`** (53 registros) — toda movimentação de caixa do parceiro registrada.
- 🟢 **`PlanoContas`** (24 registros) — plano de contas customizável por parceiro.
- 🟢 **`ContaAPagar`** — modelo CRUD pronto, **0 registros** (ainda não usado em produção).
- 🟢 **Pagamento de cobrança vira LancamentoCaixa** — `cobrancas.service.ts:345-370` (PREVISTO) + `:449-493` (REALIZADO ao receber webhook Asaas).
- 🟢 **Cancelamento de cobrança gera estorno** — `cobrancas.service.ts:646-661`.

### Lacunas (Sprint 7)

- 🔴 **DRE não existe** — `grep "DRE|demonstracaoResultado"` retorna 0 matches no backend.
- 🔴 **Conciliação bancária não existe** — BB e Sicoob são integrações de **geração de boleto**, não de conciliação de extrato.
- 🔴 **Fechamento mensal não existe** — nenhum mecanismo trava lançamentos retroativos.

### ContratoUso 3 modalidades (Sprint 4)

Detalhado em Camada 2. Bloqueado por:
- Schema OK (`valorFixoMensal`, `valorPorUnidade`, `percentualRepasse`).
- 🔴 `gerarLancamentoMensal` só roda no `create()` do contrato (sem cron mensal).
- 🔴 `percentualRepasse` no schema mas nunca é consumido.
- 🔴 Hardcode `R$ 0,50/kWh` em `usinas.service.ts:503,525` (Portal Proprietário mockado).

---

## Camada 8 — Mecanismos de Fidelidade (5 paralelos puros)

> **Princípio fundamental:** os 5 mecanismos operam de forma **independente**. Nenhuma regra de exclusão entre eles. Confirmado em sessão 29/04 (`grep "convenio.*indicacao|hasConvenio|conveniadoAtivo"` → 0 matches).

| # | Mecanismo | Como funciona | Estado |
|---|---|---|---|
| 1 | **CooperToken** | Tokens emitidos a cada cobrança; cooperado escolhe DESCONTO (imediato) ou CLUBE (acumular). 1 token = R$ 0,45 (fallback). | 🟡 Emissão funciona (9 ledger entries, 5 saldos), painel completo+ofertas resgatáveis = esqueleto |
| 2 | **CooperToken Parceiro** | Schema separado (`CooperTokenSaldoParceiro`, `CooperTokenCompra`, `OfertaClube`, `ResgateClubeVantagens`). Parceiro distribui tokens. | 🟡 Modelo dedicado pronto, fluxo operacional pendente |
| 3 | **Clube de Vantagens** | Tiers BRONZE→PRATA→OURO→DIAMANTE. Cron mensal dia 1 às 9h recalcula faixas. | 🟡 Cron OK (`clube-vantagens.job.ts:15`), 1 ProgressaoClube no banco, **0 ofertas, 0 resgates** |
| 4 | **Convênios** | Acordos institucionais com PF ou PJ no mesmo registro. Faixas progressivas. | 🟡 53 KB código, 18 endpoints, 3 tabelas, **0 registros em produção** |
| 5 | **PIX Excedente** | Quando cobrança paga > cota do cooperado, transfere excedente via PIX. Controlado por `ASAAS_PIX_EXCEDENTE_ATIVO`. | 🟡 Código pronto (294 linhas em `pix-excedente.service.ts`), **flag desligada em produção** |

### Snapshot promocional no Contrato

Mecanismo importante que se aplica a múltiplos modelos: quando proposta é aceita, snapshot do plano é **congelado no Contrato**. Campos: `descontoPromocionalAplicado`, `mesesPromocaoAplicados`, `valorContratoPromocional`, `tarifaContratualPromocional`. Reajuste do plano não retroage.

### Implicações pra produto

- Quando admin Marcos cadastra cooperado, pode ativar qualquer combinação dos 5 mecanismos.
- Cooperado pode ser **conveniado E indicador E tokenizado** simultaneamente — sem conflito.
- **Campo `valorTokenReais`** tem hardcode `0.20` em `cooper-token.service.ts:258` (D-29A) e fallback `0.45` em outros pontos do mesmo service. Inconsistência pequena (P3).

---

## Camada 9 — Pipeline OCR

### 4 pontos ativos + 1 por design

| # | Local | OCR? | Endpoint | Status |
|---|---|---|---|---|
| 1 | **Wizard admin** (`/dashboard/cooperados/novo`) | ✅ | `POST /faturas/extrair` (autenticado, ROLE: ADMIN) | 🟢 Funcional |
| 2 | **/cadastro público** | ✅ | `POST /publico/processar-fatura-ocr` (Public + Throttle 30/min) | 🟢 Funcional |
| 3 | **/entrar e /convite/[codigo]** | ❌ Por design | — (só captura nome+telefone) | 🟡 OCR rola dentro do WhatsApp depois |
| 4 | **/portal/ucs** modal "Nova UC" | ✅ | `POST /cooperados/meu-perfil/nova-uc-com-fatura` | 🟢 **Único ponto que orquestra OCR + Motor + criação UC + simulação** |
| 5 | **WhatsApp Bot** | ✅ | Chama `faturasService.extrairOcr` direto em 2 estados | 🟢 Funcional |

### Pipeline OCR rico (50+ campos)

Insumo: diagnóstico fatura real (commit `5ae9dfd`). Cada chamada Claude AI extrai:
- Identificação: titular, CPF/CNPJ, endereço completo, classificação (B1, B3, etc.).
- Consumo: `consumoAtualKwh`, `creditosRecebidosKwh`, `saldoTotalKwh`, `participacaoSaldo`.
- Tarifas: `tarifaTUSD` (com tributos), `tarifaTE` (com tributos), `tarifaTUSDSemICMS`, `tarifaTESemICMS`.
- Valores: `totalAPagar`, `valorSemDesconto`, `valorCompensadoReais`, `cipValor`.
- Tributos: `icmsPercentual/Valor`, `pisCofinsPercentual/Valor`.
- Bandeira tarifária + valor.
- **Histórico de consumo 12 meses**.

### CoopereAI (funcional)

- Chatbot WhatsApp com **Anthropic SDK direto** (não é mock conceitual).
- `coopere-ai.service.ts:127` log "CoopereAI inicializado com Claude API direta".
- Detecta intenções: arrendamento, placa solar, tarifa, simulação, atendimento.
- Sem cobertura Jest.

### Lacuna OCR × Motor de Proposta — RESOLVIDA NA SESSÃO 30/04

**Decisão:** pipeline OCR alimenta apenas `Cobranca` (via `gerarCobrancaPosFatura`), **não** o Motor de Proposta. Motor é só pro cadastro inicial.

**Implicação:** quando admin aprova `FaturaProcessada` na Central de Faturas, `gerarCobrancaPosFatura` é chamado e cria `Cobranca` com `modeloCobrancaUsado` resolvido (FIXO/COMPENSADOS/DINAMICO). **Não** atualiza nem cria proposta.

**Sprint 2 implementa o que falta:**
- DINAMICO (NotImplementedException atual).
- Auditoria de `tarifaContratual` vazia em contratos COMPENSADOS (bug do Motor.aceitar).
- Validação E2E com fatura real.

---

## Camada 10 — WhatsApp Bot

### Estatísticas

- **10 services** em `backend/src/whatsapp/`: `coopere-ai`, `modelo-mensagem`, `whatsapp-bot`, `whatsapp-ciclo-vida`, `whatsapp-cobranca`, `whatsapp-fatura`, `whatsapp-fluxo-motor`, `whatsapp-mlm`, `whatsapp-notificacoes`, `whatsapp-sender`.
- **27 endpoints** HTTP.
- **5 crons** (cobrança mensal dia 5 8h, fluxo inadimplência diário 9h, tarefas-pós 9:30, status conversas hourly, MLM mensal dia 1 10h).
- **38+ estados conversacionais** em `whatsapp-bot.service.ts:372-385`.
- **4051 linhas** em `whatsapp-bot.service.ts`.
- 43 conversas no banco hoje.

### CoopereAI Anthropic SDK direto

`coopere-ai.service.ts:25` (system prompt): "regulamentado pela ANEEL (Resolução Normativa nº 482/2012)" — **defasada** (D-30I, Sprint 3 atualiza).

### Gap crítico

- 🔴 **Sem testes Jest** — `find backend/src/whatsapp -name "*.spec.ts"` retorna **0 arquivos**. 4051 linhas + 38+ estados sem rede de proteção. Débito P3 alto (D-29E).

---

## Camada 11 — Motor de Diagnóstico Pré-Venda (🔴 Sprint 9)

> **Esta camada é mapeada e detalhada em [REGULATORIO-ANEEL.md Seção 11](./REGULATORIO-ANEEL.md).**
> Aqui apenas o resumo executivo.

### Funil

1. Lead acessa `/diagnostico` (rota nova).
2. Faz upload de fatura PDF/imagem ou cola dados manualmente.
3. Pipeline ingestão (reutiliza `faturas.service.ts:extrairOcr`).
4. Motor de análise (regras + LLM híbrido) gera relatório.

### Versões

- **Express grátis** — análise resumida em <30s, captcha + rate limit.
- **Completo pago** — sugestão R$ 199-499 (validar com mercado), relatório aprofundado: comparativo FIXO/COMPENSADOS/DINAMICO, breakdown de Fio B por classe GD, projeção 2026-2029.

### Anti-abuso

Captcha + rate limit por IP/dia + cookie de sessão.

### Vira gancho de vendas concreto

Lead recebe **valor antes de virar cooperado** — diferencial vs concorrência.

### Conflito de namespace

Endpoint atual `GET /faturas/diagnostico` é healthcheck técnico. Sprint 9 renomeia para `/faturas/healthcheck` (D-30K).

---

## Apêndice A — Semáforo Executivo

### Funcionalidades por estado

| Funcionalidade | Estado | Notas |
|---|---|---|
| Cadastro público V2 | 🟢 | 3 caminhos ativos |
| OCR Claude AI | 🟢 | 50+ campos extraídos |
| Wizard admin 7 passos | 🟢 | Funcional |
| Aprovação documentos KYC | 🟢 | Cron horário auto-aprova com gate |
| Cobrança FIXO_MENSAL | 🟢 | Único modelo ativo em produção |
| Cobrança COMPENSADOS | 🟡 | Implementada mas bloqueada por env var |
| Cobrança DINAMICO | 🔴 | NotImplementedException |
| Webhook Asaas | 🟡 | Sandbox validado, produção nunca rodou |
| WhatsApp bot | 🟡 | Funcional, sem testes |
| CoopereAI | 🟢 | Anthropic SDK direto |
| Pipeline IMAP→OCR | 🟢 | Cron 6h, 13/13 sucesso na última rodada |
| Validação ANEEL (mesma distribuidora) | 🟢 | `validarCompatibilidadeAneel` ativo |
| Validação concentração 25% | 🔴 | **Sprint 5** — caso Exfishes provou |
| Classes GD I/II/III | 🔴 | **Sprint 5** |
| Tabela Fio B 2022-2029 | 🔴 | **Sprint 5** — spec Assis nunca implementada |
| 5 flags regulatórias | 🔴 | **Sprint 5** |
| Política de Alocação | 🔴 | **Sprint 8** |
| Engine de Otimização com Split | 🔴 | **Sprint 8** |
| Motor de Diagnóstico Pré-Venda | 🔴 | **Sprint 9** |
| Lista compensação EDP | 🟢 | `/dashboard/usinas/listas` + `DualListaConcessionaria.tsx` |
| Lista homologação EDP | 🟢 | Idem |
| FaturaSaas (cron) | 🟢 | Cria fatura no banco |
| FaturaSaas → Asaas | 🔴 | **Sprint 1** |
| FaturaSaas → comunicação parceiro | 🔴 | **Sprint 1** |
| Painel SISGD `/dashboard/super-admin` | 🟢 | Sprint 13a Dia 1 entregou |
| Lista parceiros enriquecida | 🟢 | Sprint 13a Dia 2 |
| Cards saúde por parceiro | 🟢 | Sprint 13a Dia 3 |
| AuditLog ativo | 🔴 | Schema criado, **Sprint 5/6** |
| Impersonate SUPER_ADMIN | 🔴 | Sprint futuro |
| ContratoUso 3 modalidades | 🔴 | **Sprint 4** |
| Portal Proprietário real | 🔴 | **Sprint 4** — hoje hardcode R$ 0,50/kWh |
| DRE consolidado | 🔴 | **Sprint 7** |
| Conciliação bancária | 🔴 | **Sprint 7** |
| Fechamento mensal | 🔴 | **Sprint 7** |
| Auditoria IDOR geral | 🟡 | 6 endpoints fixos (Sprint 13a), **Sprint 6** replica em todos |
| 5 mecanismos fidelidade | 🟡 | Paralelos puros, esqueleto pronto |
| CooperToken emissão | 🟢 | 9 ledger entries |
| CooperToken painel + ofertas | 🟡 | Esqueleto |
| Clube de Vantagens (tiers) | 🟡 | Cron OK, 0 ofertas, 0 resgates |
| Convênios PF+PJ | 🟡 | 53 KB código, 0 registros em produção |
| PIX Excedente | 🟡 | Código pronto, flag desligada |
| Indicações MLM cascata | 🟡 | 10 indicações no banco, nunca rodou ponta a ponta |

---

## Apêndice B — Pilha de Sprints

> Detalhamento completo em [PLANO-ATE-PRODUCAO.md](./PLANO-ATE-PRODUCAO.md).

### 10 sprints pré-produção plena (17-23 semanas)

1. **Sprint 0** (P0 urgente, 1 sem) — Auditoria Regulatória Emergencial.
2. **Sprint 1** (P1, 1-2 sem) — FaturaSaas Completo (Asaas + comunicação + reconciliação).
3. **Sprint 2** (P1, 2-3 sem) — OCR-Integração + Engine COMPENSADOS/DINAMICO atômico.
4. **Sprint 3** (P1, 1-2 sem) — Banco de Documentos (Assinafy) + termo Lei 14.300.
5. **Sprint 4** (P1, 1-2 sem) — Portal Proprietário com ContratoUso 3 modalidades.
6. **Sprint 5** (P0 estruturante, 3-4 sem) — Módulo Regulatório ANEEL completo.
7. **Sprint 6** (P2, 1 sem) — Auditoria IDOR Geral.
8. **Sprint 7** (P2, 2-3 sem) — DRE + Conciliação + Fechamento Mensal.
9. **Sprint 8** (P1, 2-3 sem) — Política de Alocação + Engine de Otimização com Split.
10. **Sprint 9** (P1 estratégico, 3-4 sem) — Motor de Diagnóstico Pré-Venda.

---

## Apêndice C — Casos Reais Documentados

> Anonimização parcial: nomes de cooperados ofuscados como "Caso A/B/C". Números reais (UC, kWh, R$) preservados pra valor instrutivo.

### Caso A — Cooperado de Grande Porte (Exfishes anonimizada)

**Linha do tempo:**

- **Abril/2026** — cooperado ocupava **39,55% da Usina A (GD I)**. Limite ANEEL/distribuidoras como referência: **25%**. Sistema não bloqueou nem alertou.
- **Maio/2026** — alguém realizou **realocação cega** de Usina A (GD I) para Usina B (GD III). Sistema processou normalmente.
- **Resultado:** fatura saltou de **~R$ 6.600/mês** (média histórica) para **R$ 32.486/mês** (mês imediato pós-realocação).
- **Causa raiz:** mudança implícita de **classe GD I → GD III** = mudança de % Fio B (isento → 60% em 2026) = explosão da tarifa efetiva.
- **Prejuízo:** R$ 310.000/ano se a realocação não fosse revertida.

**Status atual** (informado por Luciano em sessão 30/04): cooperado está com 0,05% na Usina B "queimando saldo". Plano: passar 100% pra Usina A (GD I) novamente assim que saldo atual for consumido. Saldo intransferível entre UCs (default da flag `transferenciaSaldoEntreUcs=false`).

**Lições aprendidas:**

1. Concentração não validada permite > 25% — **Sprint 0** lista, **Sprint 5** valida automaticamente.
2. Mudança de classe GD na realocação não detectada — **Sprint 5** + **Sprint 8** previnem.
3. Saldo grande parado é **sinal de alerta operacional** — **Sprint 5** monitora.
4. Sistema deveria ter **simulação prévia obrigatória** ("ao mover este cooperado, fatura projetada vai de R$ X para R$ Y"). **Sprint 8** Engine de Otimização entrega.

### Caso B — Concentrações Suspeitas Atuais

**Investigação em sessão 30/04:**

- **FIGATTA** (anonimizado): 35% na Usina GD II (55.000 kWh / 157.000 kWh). Acima do limite 25%.
- **CRIAR Centro de Saúde** (anonimizado): 16% na mesma Usina GD II (25.000 kWh).
- **Agregado FIGATTA + CRIAR**: 51% em apenas 2 cooperados na mesma usina.

**Implicação:** outras concentrações suspeitas existem hoje. **Sprint 0** identifica todos os casos.

### Caso C — Spec Fio B do Assis (insumo histórico)

**Origem:** `docs/specs/PROPOSTA-GD1-GD2-FIOB-2026-03-26.md` (188 linhas, 26/03/2026).

**Conteúdo:** schema `tusdFioA`/`tusdFioB`/enum `ModalidadeGD` (`GD1_ATE_75KW`/`GD1_ACIMA_75KW`/`GD2_COMPARTILHADO`), tabela progressiva 2022-2029, refactor do motor de cobrança.

**Decisão sessão 30/04:** marcar como **insumo histórico** (D-30L). Arquitetura nova (Sprint 5) usa taxonomia diferente:
- Spec Assis: 3 modalidades por potência+contexto.
- Decisão 30/04: 3 classes GD por **data de homologação** (cutoffs 07/01/2023 e 07/01/2024).

**Aproveitar:** tabela de % Fio B 2022-2029 e fórmula `tarifaEfetiva = tusdFioA + (tusdFioB × pct) + TE` podem ser portadas se compatíveis com a nova taxonomia.

---

## Apêndice D — Glossário

### Termos regulatórios

- **ANEEL** — Agência Nacional de Energia Elétrica. Reguladora.
- **SCEE** — Sistema de Compensação de Energia Elétrica. Mecanismo regulado pela ANEEL pelo qual energia injetada por GD vira crédito em kWh na fatura.
- **GD** — Geração Distribuída.
- **Lei 14.300/2022** — marco legal da GD. Vigência: 07/01/2023.
- **RN 1.000/2021** — consolidação das resoluções normativas anteriores (RN 482/2012 + RN 687/2015). Vigente.
- **RN 482/2012** — defasada desde Lei 14.300. Termo de adesão e bot CoopereAI ainda citam (D-30H, D-30I).
- **TUSD** — Tarifa de Uso do Sistema de Distribuição.
- **Fio A** — parcela da TUSD relativa a transmissão e geração.
- **Fio B** — parcela da TUSD relativa ao uso da rede de distribuição. Crítico em GD: progressivo 2023-2029.
- **TE** — Tarifa de Energia.
- **kWh compensado** — energia injetada pela usina geradora que abate consumo da UC consumidora no SCEE.
- **kWh injetado** — energia que a usina coloca na rede.
- **Saldo SCEE** — créditos kWh acumulados (validade 60 meses por ANEEL). Por par (UC, Usina, mês).

### Termos SISGD

- **SISGD** — a plataforma. Dono Luciano. Não confundir com CoopereBR (parceiro).
- **Parceiro** — entidade que assina contrato com SISGD (`Cooperativa` no schema).
- **Membro** — entidade que assina contrato com Parceiro (`Cooperado` no schema). Nomenclatura por tipo: cooperado/consorciado/associado/condômino.
- **TENANT ROOT** — `Cooperativa` é o tenant. Toda query Prisma filtra por `cooperativaId`.
- **Modelo de cobrança** — FIXO_MENSAL / CREDITOS_COMPENSADOS / CREDITOS_DINAMICO.
- **Fatura EDP / fatura concessionária** — fatura mensal emitida pela distribuidora.
- **FaturaSaas** — fatura mensal emitida pelo SISGD pra cada parceiro.
- **Cobrança** — cobrança mensal emitida pelo parceiro pra cada membro.
- **ListaEspera** — fila de cooperados aguardando vaga em usina.
- **UC** — Unidade Consumidora. Identificada por `numero` (canônico SISGD), `numeroUC` (legado EDP) e `numeroConcessionariaOriginal` (formato cru da fatura).
- **Distribuidora** — concessionária local de energia (EDP, CEMIG, Enel, Light, Celesc).
- **5 mecanismos de fidelidade** — CooperToken / CooperToken Parceiro / Clube de Vantagens / Convênios / PIX Excedente. Paralelos puros, sem regras de exclusão.
- **Motor de Proposta** — engine de cálculo no cadastro inicial. Não é o mesmo que **Motor de Diagnóstico Pré-Venda** (Sprint 9).
- **Snapshot promocional** — campos `descontoPromocionalAplicado`, `mesesPromocaoAplicados`, etc. no Contrato. Congelam plano no aceite.

---

*Documento vivo. Atualizar conforme evolução do produto. Para detalhamento regulatório, ver [REGULATORIO-ANEEL.md](./REGULATORIO-ANEEL.md).*
