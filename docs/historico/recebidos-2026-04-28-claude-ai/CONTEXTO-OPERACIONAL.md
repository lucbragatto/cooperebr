# CONTEXTO-OPERACIONAL.md — COOPERE-BR

## Referência completa para operação, auditoria e automação

Lido pelo Claude quando ativado via CLAUDE.md ou comandos /auditar-fatura, /calcular-indbito, /prospectar Não incluir no CLAUDE.md diretamente — referenciar apenas

---

## 1\. UNIDADES CONSUMIDORAS DE REFERÊNCIA

### UC COOPERE (Geradora)

Titular: CNPJ 41.604.843/0001-84

Instalação: 0.002.536.110.054-06

Classe: A4 — Comercial Trifásico 13,8 kV

Modalidade tarifária: Horossazonal Verde (GDII)

Papel no SCEE: Geradora (usinas cedidas pelos cooperados)

Competência amostral: Fev/2026

Valor fatura: R$ 16.725,10

ICMS cobrado: R$ 2.840,85 (95% sobre demanda — Tema 176 violado)

PIS/COFINS: R$ 968,87 (sobre ato cooperativo — Temas 536/323 violados)

### UC Cooperado Luciano (Consumidora)

Titular: CPF 890.893.247-04

Instalação: 0.001.421.380.054-70

Classe: B1 — Residencial Trifásico 220/127 V

Modalidade tarifária: Convencional

Participação SCEE: 0,150% do saldo

Competência amostral: Mar/2026

Valor fatura: R$ 184,46

ICMS cobrado: R$ 17,28

PIS/COFINS: R$ 58,72

---

## 2\. ESTRUTURA TARIFÁRIA EDP ES

### Componentes da tarifa

TUSD — Tarifa de Uso do Sistema de Distribuição

  → Fio A: remunera transmissão

  → Fio B: remunera distribuição (infraestrutura EDP ES)

  → Encargos: CDE, PROINFA, P\&D, etc.

TE — Tarifa de Energia

  → Remunera a energia adquirida no mercado gerador

Para Grupo A (COOPERE):

  → Demanda de Potência contratada

  → TUSD-G (Demanda de Geração — rubrica de maior peso)

  → Ultrapassagem (quando demanda \> contratada)

  → Energia Reativa Excedente (ERE)

  → Demanda Reativa Excedente (DRE)

Para Grupo B (cooperado Luciano):

  → Tarifa convencional por kWh consumido

  → Custo de Disponibilidade mínimo (100 kWh trifásico)

### Gross-up "por dentro" — fórmulas

Preço com tributos \= Tarifa sem tributos / (1 − alíquota efetiva)

Alíquotas vigentes ES:

  ICMS: 17%

  PIS:  1,26% (não-cumulativo)

  COFINS: 5,81% (não-cumulativo)

  Gross-up resultante: 28,72% a 29,66%

Assimetria identificada:

  Linhas POSITIVAS (fornecida): gross-up completo incluído

  Linhas NEGATIVAS (injetada):  gross-up reduzido ou ausente

  Diferença \= resíduo tributário indevido

### Tabela de assimetria (faturas fev-mar/2026)

| Rubrica | Gross-up+ | Gross-up- | Resíduo |
| :---- | :---- | :---- | :---- |
| UC B1 TUSD/TE | \+28,72% | \+21,88% | 6,84% indevido |
| UC A4 TUSD Energia | \+29,66% | \+7,60% | 22,06% indevido |
| UC A4 TE Energia | \+29,66% | \+29,65% | ≈ zero |

---

## 3\. SISGD — SISTEMA DE GESTÃO DE GD (ANEEL)

### O que é

Portal oficial da ANEEL para registro e acompanhamento de unidades de geração distribuída. É a **fonte probatória primária** para todas as teses do parecer.

### Dados críticos a extrair

Por UC/Central:

  → Data de solicitação de acesso

  → Data de homologação (define grandfathering Lei 14.300/2022)

  → Potência instalada (limite: ≤ 5 MW por central — não por titular)

  → Modalidade registrada (microgeração ≤75 kW / minigeração \>75 kW ≤5 MW)

  → Classe do consumidor (A4, B1, etc.)

  → Distribuidora responsável (EDP ES)

  → Histórico mensal de injeção (kWh) → prova do empréstimo gratuito

  → Status atual (ativa, suspensa, cancelada)

### Relevância jurídica de cada dado

Data de homologação → grandfathering pela Lei 14.300/2022

  Usinas homologadas antes da lei têm proteção específica de regime

Potência por central → limite de 5 MW é regulatório (não tributário)

  Cooperativa pode ter múltiplas centrais sem limite agregado

  Vedado apenas desmembramento ARTIFICIAL (art. 655 ss RN 1.000/2021)

Histórico de injeção → prova do empréstimo gratuito

  Sem esse dado, a tese do ato cooperativo fica sem prova documental

Modalidade registrada → define qual tarifa (GDII, convencional, etc.)

  Impacta diretamente quais rubricas aparecem na NF3e

### Automação planejada

Skill: .claude/skills/sisgd-extractor/

Scripts:

  core.py     → parser de exports do SISGD (CSV/XLS)

  mapper.py   → cruza UC do SISGD com NF3e da EDP ES

  prova.py    → gera documento probatório para a ação judicial

---

## 4\. AUDITORIA DE FATURA NF3e — PROTOCOLO

### Estrutura de uma NF3e (Nota Fiscal de Energia Eletrônica)

Linhas POSITIVAS → fornecimento integral (TUSD \+ TE) da energia consumida

Linhas NEGATIVAS → abatimento dos créditos SCEE injetados

Soma algébrica   → valor líquido do "principal"

Sobre o principal → incidem ICMS, PIS e COFINS

### Checklist de auditoria por fatura

PASSO 1 — Identificar a UC

  → Cruzar com SISGD: modalidade, potência, data de homologação

  → Confirmar classe (A/B) e subgrupo (A4, B1, etc.)

PASSO 2 — Mapear linhas positivas

  → Separar TUSD-G (demanda de geração) das demais

  → Identificar gross-up embutido em cada linha

PASSO 3 — Mapear linhas negativas

  → Verificar gross-up das linhas de compensação SCEE

  → Calcular assimetria: gross-up+ menos gross-up-

PASSO 4 — Calcular indébito do mês

  → ICMS indevido \= valor TUSD-G × alíquota 17% "por dentro"

  → PIS/COFINS indevido \= base × (1,26% \+ 5,81%)

  → Total atacável \= ICMS indevido \+ PIS/COFINS indevido

PASSO 5 — Projetar 60 meses

  → Nominal: total\_mensal × 60

  → SELIC: aplicar taxa acumulada desde cada pagamento

  → Gerar relatório por cooperado para o store de memória

### Automação planejada

Skill: .claude/skills/fatura-edp-auditor/

Scripts:

  core.py      → parser NF3e linha a linha

  gross\_up.py  → detecta e quantifica assimetria \+/-

  indbito.py   → projeta 60 meses \+ SELIC acumulada

Data:

  tarifas-edp-es.json → alíquotas e gross-up por classe/modalidade

---

## 5\. SKILLS — INVENTÁRIO E PADRÃO

### Padrão obrigatório (modelo: ui-ux-pro-max)

.claude/skills/nome-da-skill/

├── SKILL.md      → instrução principal para o Claude

├── CLAUDE.md     → contexto local da skill

├── data/         → dados de referência (JSON, CSV)

└── scripts/

    ├── core.py   → lógica principal

    └── \*.py      → módulos auxiliares

### Skills existentes

ui-ux-pro-max/    → UI/UX design (67 estilos, 96 paletas)

  scripts: core.py, design\_system.py, search.py

### Skills a criar (ordem de prioridade)

🔴 fatura-edp-auditor/   → core do negócio tributário

🔴 sisgd-extractor/      → fonte probatória primária

🟡 aneel-ren-analyzer/   → monitoramento regulatório automático

🟡 convenio-writer/      → minutas institucionais (ALES, etc.)

🟢 coopere-tone-profile/ → padronização de voz por público

---

## 6\. COMMANDS — COMANDOS SLASH

### Existentes

/apurar-excedente → cálculo financeiro de excedente

/fix-bug          → correção de bugs

/qa-run           → execução de QA

/review           → revisão de código

### A criar

/auditar-fatura \[arquivo NF3e\]

  → sisgd-extractor: dados UC (homologação, potência, modalidade)

  → fatura-edp-auditor/core.py: parser linha a linha

  → gross\_up.py: detecta assimetria

  → indbito.py: projeta 60 meses \+ SELIC

  → output: relatório para cooperado (Perfil A)

/calcular-indbito \[valor\_mensal\] \[meses\]

  → projeta nominal \+ SELIC acumulada

  → output: tabela mês a mês \+ total atualizado

/gerar-conteudo \[tema\] \[público: A|B|C\]

  → hook-generator: 5 aberturas testadas

  → structured-copywriting: post completo

  → coopere-tone-profile: alinha ao perfil

  → repurposing: versões carrossel/FAQ/roteiro

/briefing-advogado

  → summary-compressor: parecer 26p → 2p executivo

  → source-validation: confirma precedentes vigentes

  → flowchart: MS vs. Ação Ordinária

  → structured-copywriting/Perfil C: carta 1p ao patrono

/checar-tese \[descrição da operação\]

  → lê CONTEXTO-JURIDICO.md

  → verifica enquadramento nas 4 teses

  → retorna: tese aplicável \+ risco \+ fundamento

---

## 7\. AGENTS — AGENTES ESPECIALIZADOS

### Existentes

pix-agent.md    → pagamentos PIX

wa-bot-agent.md → WhatsApp bot (sessionKey: agent:main:whatsapp:direct:+5527981341348)

### A criar: agents/juridico-agent.md

Especialidade: tributário-regulatório energia elétrica cooperativa

Memory Stores: cooperebr-org (read) \+ cooperebr-cooperados (read/write)

Skills: fatura-edp-auditor \+ aneel-ren-analyzer \+ sisgd-extractor

Rules: tributario.md \+ financeiro.md

Responsabilidades:

  → Auditar NF3e → salvar resultado no store do cooperado

  → Monitorar novas RENs ANEEL → atualizar store org-wide

  → Alertar sobre prescrição quinquenal (60 meses)

  → Gerar relatórios para o advogado patrono

  → Verificar enquadramento de ato cooperativo em novas operações

---

## 8\. ARQUITETURA DE MEMÓRIA — MANAGED AGENTS (abr/2026)

### Novo sistema (lançado 23/04/2026 — public beta)

Memory on Managed Agents monta em filesystem containerizado. Substitui Memory MCP open source. Header: `managed-agents-2026-04-01`

### Estrutura de Memory Stores para a COOPERE-BR

STORE 1 — cooperebr-org (org-wide, read-only para agentes)

  /juridico/teses.md         → as 4 teses em cascata

  /juridico/jurisprudencia.md → temas STF \+ súmulas STJ completos

  /juridico/minutas/         → MS Preventivo \+ Ação Ordinária

  /regulatorio/aneel/        → RNs relevantes sumarizadas

  /tarifario/gross-up.md     → tabela de assimetria por classe

STORE 2 — cooperebr-cooperados (per-cooperado, read/write)

  /{CPF-CNPJ}/perfil/        → UC, instalação, modalidade, classe

  /{CPF-CNPJ}/faturas/       → histórico mensal NF3e

  /{CPF-CNPJ}/indbito/       → cálculo acumulado \+ projeção SELIC

  /{CPF-CNPJ}/status/        → andamento processual, diligências

STORE 3 — cooperebr-dev (projeto, read/write)

  /sprint/                   → decisões de sprint, pendências

  /formulas/                 → FORMULAS-COBRANCA.md sincronizado

  /bugs/                     → histórico de bugs críticos

  /arquitetura/              → decisões de schema, modelos de cobrança

### Limite técnico

Máx 100KB (\~25K tokens) por arquivo de memória

Padrão: muitos arquivos pequenos e focados

### Passos para configurar

1\. Verificar acesso: platform.claude.com → beta managed-agents-2026-04-01

2\. Criar os 3 stores via Claude Console ou API

3\. Seed: carregar teses e jurisprudência no store org-wide

4\. Migrar pasta memory/ local para os stores

5\. Configurar juridico-agent com acesso aos stores corretos

---

## 9\. OPENCLAW — CRON JOBS

Path: .openclaw/cron/jobs.json

Existente:

  CoopereBR QA Noturno — cron "0 3 \* \* \*" — desativado 20/04/2026

Criar:

  Monitoramento ANEEL    (0 18 \* \* 5\)  → sextas 18h

    Firecrawl MCP → verifica novas RENs → atualiza store org-wide

  Backup Memory Stores   (0 2 \* \* \*)   → todo dia 2h

    Export dos stores → salvar em docs/backup-memory/

  Relatório Indébito     (0 8 1 \* \*)   → dia 1 de cada mês

    Agrega indébito por cooperado → envia via wa-bot-agent

---

## 10\. VOZ E TOM — PERFIS DE COMUNICAÇÃO

### Perfil A — Cooperados e prospects

Tom: acessível, propositivo, sem juridiquês

Foco: benefício financeiro \+ acesso à energia renovável

Dados: "R$ 228 mil" — nunca "indébito nominal quinquenal"

Evitar: siglas soltas, alarmismo, promessas de resultado judicial

Canal: WhatsApp, Instagram, LinkedIn pessoal

### Perfil B — Parceiros institucionais (ALES, prefeituras, OCB/ES)

Tom: técnico-institucional, colaborativo

Foco: impacto social, custo zero ao poder público, pioneirismo no ES

Dados: comparativos ("custo zero vs. R$ X de investimento direto")

Evitar: confronto, linguagem de lobby, pressão política

Canal: ofício, apresentação, reunião formal

### Perfil C — Advogados e tributaristas

Tom: jurídico preciso, referências completas

Foco: solidez das teses, precedentes vinculantes, janela processual

Formato: sempre citar tema STF \+ relator \+ data \+ turma

Evitar: simplificações que enfraqueçam a argumentação técnica

Canal: e-mail formal, carta de apresentação, reunião técnica

---

## 11\. WORKFLOWS DETALHADOS

### W1 — Auditoria de Fatura (comando: /auditar-fatura)

INPUT: arquivo NF3e (PDF ou dados estruturados)

  ↓

sisgd-extractor

  → homologação, potência, modalidade da UC

  ↓

fatura-edp-auditor/core.py

  → parse linha a linha: positivas e negativas

  ↓

gross\_up.py

  → calcula assimetria por rubrica

  → identifica quais rubricas têm indébito

  ↓

indbito.py

  → projeta 60 meses nominal

  → aplica SELIC acumulada desde cada pagamento

  ↓

OUTPUT (Perfil A): relatório simplificado para o cooperado

OUTPUT (Perfil C): laudo técnico para o advogado

  ↓

SAVE: store cooperebr-cooperados/{CPF-CNPJ}/indbito/

### W2 — Conteúdo Semanal (comando: /gerar-conteudo)

INPUT: tema \+ público (A/B/C)

  ↓

Summary Compressor

  → extrai pontos-chave de: parecer / nova REN / acórdão

  ↓

Hook Generator

  → 10 aberturas testadas para o público escolhido

  ↓

Structured Copywriting

  → post completo com hook escolhido

  ↓

Coopere-Tone-Profile

  → alinha ao perfil A/B/C

  ↓

Repurposing Engine

  → versões: carrossel LinkedIn / FAQ WhatsApp / roteiro vídeo

### W3 — Briefing Advogado (comando: /briefing-advogado)

Summary Compressor   → parecer 26p → resumo 2p executivo

Source Validation    → confirma precedentes vigentes em 2026

Ato-Cooperativo-Checker → valida enquadramento atual das operações

Flowchart Decision   → MS vs. Ação Ordinária vs. Ambos

Competitive Intel    → compara vias processuais com custos reais

Structured Copy/C    → carta de apresentação 1p ao patrono

### W4 — Apresentação ALES (Carregador Verde ES)

Summary Compressor   → convênio → 5 pontos essenciais

SISGD Extractor      → capacidade de geração disponível

Competitive Intel    → convênio vs. compra direta vs. concessão

Infographic Builder  → fluxo visual custo zero \+ energia renovável

Structured Copy/B    → executivo 1p ao Presidente da ALES

### W5 — Captação de Cooperado (comando: /prospectar)

Fatura-EDP-Auditor   → identifica indébito potencial do prospect

Competitive Intel    → cooperativa vs. GD individual vs. consórcio

Hook Generator/A     → 5 abordagens para contato frio

Structured Copy/A    → 3 variações DM LinkedIn / e-mail / WhatsApp

Flowchart Decision   → "você se enquadra na COOPERE-BR?"

---

## 12\. DILIGÊNCIAS PENDENTES

### Jurídico-processual

\[ \] Levantar TODAS as faturas dos últimos 60 meses (ambos titulares)

    → Salvar em: docs/referencia/faturas-60-meses/

\[ \] Revisar Estatuto Social — incluir explicitamente:

    \- Objeto: geração/operação de usinas cedidas pelos cooperados

    \- Rateio sem fins lucrativos

    \- Vedação a operações com não-associados

    \- Destinação de sobras (art. 87 Lei 5.764/71)

\[ \] Parecer favorável da OCB/ES corroborando ato cooperativo típico

\[ \] Perícia contábil extrajudicial para quantificação precisa mês a mês

\[ \] Verificar pareceres normativos SEFAZ-ES em casos análogos

\[ \] Constituir advogado tributarista (cooperativo \+ energia \+ ICMS/PIS)

### Técnico-desenvolvimento

\[ \] Criar .claude/skills/fatura-edp-auditor/ (padrão ui-ux-pro-max)

\[ \] Criar .claude/skills/sisgd-extractor/

\[ \] Criar .claude/skills/aneel-ren-analyzer/

\[ \] Criar .claude/rules/tributario.md

\[ \] Criar .claude/agents/juridico-agent.md

\[ \] Rodar /ultrareview no backend antes de descongelar Sprint 5

    (verificar: calcularCobrancaMensal órfã \+ BLOQUEIO\_MODELOS\_NAO\_FIXO)

\[ \] Complementar .claude/rules/financeiro.md com dados de indébito

### Infraestrutura de memória

\[ \] Verificar acesso ao beta Managed Agents (platform.claude.com)

    Header: managed-agents-2026-04-01

\[ \] Criar store cooperebr-org (seed: teses \+ jurisprudência \+ RENs)

\[ \] Criar store cooperebr-cooperados (seed: perfis ativos)

\[ \] Criar store cooperebr-dev (seed: FORMULAS-COBRANCA.md \+ sprint)

\[ \] Migrar pasta memory/ local para os stores

\[ \] Configurar juridico-agent com acesso correto aos stores

\[ \] Instalar Sequential Thinking MCP

\[ \] Configurar Supabase MCP (projeto já usa Supabase)

\[ \] Criar cron jobs: ANEEL \+ backup stores \+ relatório mensal

---

*Atualizado: Abril/2026* *Base: Parecer Técnico-Jurídico \+ estrutura real do projeto \+ Managed Agents Memory*  
