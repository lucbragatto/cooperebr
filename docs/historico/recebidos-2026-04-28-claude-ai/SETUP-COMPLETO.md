# SETUP-COMPLETO.md — COOPERE-BR

## Guia de Instalação Completo para Claude Code

### Tudo que foi criado e como instalar

---

## VISÃO GERAL DO SISTEMA

O que você tem hoje (antes deste guia):

├── Claude Code instalado no VS Code

├── Projeto cooperebr com estrutura existente

├── OpenClaw configurado com WhatsApp

└── Skills genéricas (ui-ux-pro-max)

O que você terá depois deste guia:

├── Sistema completo de contexto (3 arquivos mestres)

├── 10 modos de engenharia via /arquiteto

├── Memória estruturada por tipo de informação

├── Skills customizadas para energia solar \+ tributário

├── Commands slash para todas as tarefas recorrentes

└── Managed Agents Memory configurado (quando beta liberar)

---

## PASSO 1 — ATUALIZAR O CLAUDE CODE

Abra o terminal no VS Code e execute:

claude update

Isso instala:

- `/ultrareview` — revisão multi-agente antes de merge  
- Últimas melhorias do Claude Code  
- Suporte ao header `managed-agents-2026-04-01`

---

## PASSO 2 — ESTRUTURA DE PASTAS A CRIAR

Execute no terminal dentro de `C:\Users\Luciano\cooperebr`:

\# Criar pastas que ainda não existem

mkdir \-p .claude\\commands

mkdir \-p .claude\\rules

mkdir \-p .claude\\agents

mkdir \-p .claude\\skills\\fatura-edp-auditor\\scripts

mkdir \-p .claude\\skills\\fatura-edp-auditor\\data

mkdir \-p .claude\\skills\\sisgd-extractor\\scripts

mkdir \-p .claude\\skills\\sisgd-extractor\\data

mkdir \-p .claude\\skills\\aneel-ren-analyzer\\scripts

mkdir \-p docs\\referencia\\faturas-60-meses

mkdir \-p docs\\backup-memory

mkdir \-p memory\\decisoes-arquitetura

mkdir \-p memory\\bugs-resolvidos

mkdir \-p memory\\padroes-aprendidos

mkdir \-p memory\\proximos-passos

---

## PASSO 3 — ARQUIVOS A INSTALAR

### Estrutura final após instalação:

C:\\Users\\Luciano\\cooperebr\\

│

├── CLAUDE.md                              ← Arquivo 1 (raiz)

│

├── .claude\\

│   ├── commands\\

│   │   ├── arquiteto.md                   ← Arquivo 2 (10 modos)

│   │   ├── apurar-excedente.md            (já existe)

│   │   ├── fix-bug.md                     (já existe)

│   │   ├── qa-run.md                      (já existe)

│   │   └── review.md                      (já existe)

│   │

│   ├── rules\\

│   │   ├── codigo.md                      (já existe)

│   │   ├── financeiro.md                  (já existe — complementar)

│   │   ├── multi-tenant.md                (já existe)

│   │   └── tributario.md                  ← Arquivo 5 (CRIAR)

│   │

│   ├── agents\\

│   │   ├── pix-agent.md                   (já existe)

│   │   ├── wa-bot-agent.md                (já existe)

│   │   └── juridico-agent.md              ← Arquivo 6 (CRIAR)

│   │

│   └── skills\\

│       ├── ui-ux-pro-max\\                 (já existe)

│       ├── fatura-edp-auditor\\            ← Skill 1 (CRIAR)

│       │   ├── SKILL.md

│       │   ├── CLAUDE.md

│       │   ├── data\\tarifas-edp-es.json

│       │   └── scripts\\

│       │       ├── core.py

│       │       ├── gross\_up.py

│       │       └── indbito.py

│       ├── sisgd-extractor\\               ← Skill 2 (CRIAR)

│       │   ├── SKILL.md

│       │   ├── CLAUDE.md

│       │   ├── data\\

│       │   └── scripts\\core.py

│       └── aneel-ren-analyzer\\            ← Skill 3 (CRIAR)

│           ├── SKILL.md

│           ├── CLAUDE.md

│           └── scripts\\core.py

│

├── docs\\

│   └── referencia\\

│       ├── CONTEXTO-JURIDICO.md           ← Arquivo 3 (baixar)

│       ├── CONTEXTO-OPERACIONAL.md        ← Arquivo 4 (baixar)

│       ├── parecer-coopere-icms-piscofins.pdf (já existe)

│       └── faturas-60-meses\\              (popular com as 60 faturas)

│

└── memory\\

    ├── prompts-engenharia.md              ← Arquivo 7 (baixar)

    ├── decisoes-arquitetura\\

    ├── bugs-resolvidos\\

    ├── padroes-aprendidos\\

    └── proximos-passos\\

---

## PASSO 4 — INSTALAR OS ARQUIVOS DESTA SESSÃO

### 4.1 Arquivo 1 — CLAUDE.md (raiz do projeto)

**Destino:** `C:\Users\Luciano\cooperebr\CLAUDE.md`

Conteúdo:

\# CLAUDE.md — COOPERE-BR v3.0

\#\# Projeto

Cooperativa de energia solar fotovoltaica (GD compartilhada) no ES.

CNPJ 41.604.843/0001-84. Responsável: Luciano Costa Bragatto.

\#\# Stack

NestJS \+ TypeScript \+ Prisma \+ Supabase \+ Next.js

Backend: porta 3000 | Frontend: porta 3001

Repo: github.com/lucbragatto/cooperebr

\#\# Comandos

\- Dev backend:  \`npm run start:dev\` (porta 3000\)

\- Dev frontend: \`npm run dev\` (porta 3001\)

\- Build: \`npm run build\`

\- Test: \`npm test \-- \[path\]\`

\- Lint: \`npm run lint:fix\`

\- Type check: \`npx tsc \--noEmit\`

\- DB push: \`npx prisma db push\` (usar sem pgbouncer)

\- DB studio: \`npx prisma studio\`

\#\# Arquitetura

\- backend/src/           → API NestJS, módulos por domínio

\- backend/src/billing/   → Motor de cobrança — CONGELADO (ver Regras)

\- web/src/               → Next.js frontend

\- .claude/skills/        → skills com SKILL.md \+ scripts/ \+ data/

\- .claude/agents/        → pix-agent, wa-bot-agent, juridico-agent

\- .claude/rules/         → financeiro.md, tributario.md, codigo.md

\- docs/referencia/       → contextos completos (ler antes de agir)

\- memory/                → memória persistente local do agente

\#\# Regras

\- IMPORTANT: ler docs/referencia/CONTEXTO-JURIDICO.md antes de análise tributária

\- IMPORTANT: ler docs/referencia/CONTEXTO-OPERACIONAL.md antes de auditar faturas

\- IMPORTANT: usar /arquiteto para qualquer tarefa de desenvolvimento

\- IMPORTANT: ler memory/prompts-engenharia.md para selecionar o modo correto

\- IMPORTANT: rodar type check após toda alteração de código

\- NEVER modificar backend/src/billing/ sem autorização — commit congelado 9174461

\- NEVER commitar .env ou expor chaves de API

\- Toda lógica de negócio em src/lib/services/ — nunca em rotas ou componentes

\- Decimal do Prisma: sempre converter para string antes de retornar na API

\- Usar pgbouncer=false nas migrations do Prisma (Supabase bloqueia)

\- Skills seguem padrão: SKILL.md \+ CLAUDE.md \+ scripts/ \+ data/

\- Erros de porta: matar processo antes de reiniciar (EADDRINUSE)

\#\# Workflow

\- Perguntar antes de iniciar tarefas complexas ou com impacto em billing

\- Mudanças mínimas — não refatorar código não relacionado

\- Commit separado por mudança lógica — nunca commit gigante

\- Rodar /ultrareview antes de merge em qualquer módulo de billing

\- Quando houver duas abordagens, apresentar ambas e deixar Luciano escolher

\- Salvar decisões em memory/ ao final de cada sessão

\#\# Fora de escopo

\- Não modificar .openclaw/cron/jobs.json sem revisar impacto nos agentes

\- Não alterar Estatuto Social ou minutas jurídicas — apenas sugerir

\- Não protocolar peças processuais — requer advogado habilitado (OAB)

---

### 4.2 Arquivo 2 — arquiteto.md (comando slash)

**Destino:** `C:\Users\Luciano\cooperebr\.claude\commands\arquiteto.md`

→ Baixar o arquivo `arquiteto.md` gerado nesta sessão

**Como usar:**

No Claude Code, digitar: /arquiteto

Claude pergunta: qual é a tarefa?

Claude seleciona e anuncia o modo automaticamente (1 a 10\)

---

### 4.3 Arquivo 3 — CONTEXTO-JURIDICO.md

**Destino:** `C:\Users\Luciano\cooperebr\docs\referencia\CONTEXTO-JURIDICO.md`

→ Baixar o arquivo `CONTEXTO-JURIDICO.md` gerado nesta sessão

**Contém:**

- Parecer técnico-jurídico completo  
- 4 teses em cascata (ato cooperativo → demanda → PIS/COFINS → GERAR)  
- Toda a jurisprudência (Temas 69, 176, 323, 536, 986 \+ Súmulas STJ)  
- Estratégia processual MS vs. Ação Ordinária  
- Quantificação do indébito (R$ 228 mil em 60 meses)

---

### 4.4 Arquivo 4 — CONTEXTO-OPERACIONAL.md

**Destino:** `C:\Users\Luciano\cooperebr\docs\referencia\CONTEXTO-OPERACIONAL.md`

→ Baixar o arquivo `CONTEXTO-OPERACIONAL.md` gerado nesta sessão

**Contém:**

- Dados das UCs (COOPERE geradora \+ cooperado Luciano)  
- Estrutura tarifária EDP ES completa  
- Protocolo de auditoria de NF3e passo a passo  
- Todos os workflows (W1 a W5)  
- Arquitetura de Memory Stores  
- Inventário de skills e commands

---

### 4.5 Arquivo 7 — PROMPTS-ENGENHARIA.md (memória)

**Destino:** `C:\Users\Luciano\cooperebr\memory\prompts-engenharia.md`

→ Baixar o arquivo `PROMPTS-ENGENHARIA.md` gerado nesta sessão

**Para que serve:** O Claude busca este arquivo automaticamente para identificar qual dos 10 modos de engenharia usar em cada situação.

---

## PASSO 5 — CRIAR RULES/TRIBUTARIO.MD

**Destino:** `C:\Users\Luciano\cooperebr\.claude\rules\tributario.md`

Criar com este conteúdo:

\# Rules — Tributário COOPERE-BR

\#\# Fato gerador ICMS

Exige cumulativamente:

\- Transferência jurídica de propriedade (não mero deslocamento físico)

\- Habitualidade ou intuito comercial

\- Bem móvel destinado ao comércio (mercadoria)

\#\# Empréstimo gratuito ≠ fato gerador

Art. 655 RN ANEEL 1.000/2021: energia injetada via SCEE é

empréstimo gratuito — não venda, não permuta, não comercialização.

Consequência: sem ICMS sobre energia compensada.

\#\# Ato cooperativo ≠ operação de mercado

Art. 79 Lei 5.764/1971: ato cooperativo não implica operação de

mercado nem contrato de compra e venda.

Consequência: afasta ICMS e PIS/COFINS sobre rateio entre cooperados.

\#\# Demanda ≠ consumo

Súmula 391/STJ \+ Tema 176/STF: ICMS só incide sobre demanda de

potência EFETIVAMENTE UTILIZADA.

Consequência: TUSD-G, disponibilidade e encargos sem ICMS.

\#\# Tema 986/STJ — NÃO se aplica ao SCEE

A ressalva expressa do Ministro Relator Herman Benjamin afasta

o Tema 986 para operações de geração distribuída.

Usar: TJ-SE RI 202200939554 como precedente de afastamento.

\#\# Limite de 5 MW

Lei 14.300/2022: limite por CENTRAL GERADORA — não por titular.

Cooperativa pode ter múltiplas centrais sem limite agregado.

Vedado apenas desmembramento artificial (art. 655 RN 1.000/2021).

\#\# Prescrição

Art. 168 CTN: 60 meses retroativos a partir do ajuizamento.

Cada mês sem protocolo \= um mês a menos de recuperação.

Correção: SELIC desde cada pagamento (Tema 145 STJ).

\#\# Lei GERAR — insuficiente

Lei 11.253/2021-ES: isenção parcial.

§3º art. 5-D EXCLUI: demanda, disponibilidade, encargos.

\= Justamente onde está o maior valor do indébito.

A tese constitucional opera ACIMA da isenção estadual.

---

## PASSO 6 — COMPLEMENTAR RULES/FINANCEIRO.MD

Abrir `C:\Users\Luciano\cooperebr\.claude\rules\financeiro.md` e adicionar:

\#\# Dados de Indébito Tributário (adicionar ao arquivo existente)

Indébito mensal identificado (faturas amostrais fev-mar/2026):

\- COOPERE (CNPJ): R$ 3.809,72/mês atacável

  → ICMS sobre TUSD-G: R$ 2.795,57 (95% do total)

  → PIS/COFINS: R$ 968,87

\- Cooperado Luciano (CPF): R$ 76,00/mês atacável

Projeção 60 meses:

\- COOPERE: R$ 228.583,20 nominal → até R$ 340.000 com SELIC

\- Cooperado: R$ 4.560,00 nominal → até R$ 6.800 com SELIC

Alíquotas ES vigentes:

\- ICMS: 17% "por dentro" (art. 13 §1º I LC 87/96)

\- PIS: 1,26% (não-cumulativo)

\- COFINS: 5,81% (não-cumulativo)

\- Gross-up resultante: 28,72% a 29,66%

Correção monetária: SELIC desde cada pagamento

Base legal: REsp 1.112.524/DF — Tema 145 STJ

---

## PASSO 7 — INSTALAR MCP SERVERS

### 7.1 Sequential Thinking MCP (instalar agora — gratuito)

\# No terminal do VS Code

claude mcp add sequential-thinking

Ou manualmente em `settings.local.json`:

{

  "mcpServers": {

    "sequential-thinking": {

      "command": "npx",

      "args": \["-y", "@modelcontextprotocol/server-sequential-thinking"\]

    }

  }

}

### 7.2 Gmail MCP (instalar semana 1\)

claude mcp add gmail

### 7.3 Supabase MCP (projeto já usa — verificar se está configurado)

claude mcp add supabase

Verificar em `settings.local.json` se já existe entrada para Supabase.

### 7.4 Firecrawl MCP (instalar quando conteúdo estiver rodando)

claude mcp add firecrawl

---

## PASSO 8 — CONFIGURAR MANAGED AGENTS MEMORY

### 8.1 Verificar acesso ao beta

\# Testar se sua conta tem acesso

curl \-X GET https://platform.claude.com/api/v1/memory-stores \\

  \-H "anthropic-beta: managed-agents-2026-04-01" \\

  \-H "x-api-key: SUA\_API\_KEY"

Se retornar dados (não erro 403): você tem acesso. Prosseguir. Se retornar erro 403: aguardar liberação do beta para sua conta.

### 8.2 Criar os 3 Memory Stores (quando tiver acesso)

\# criar-stores.py — rodar uma vez para configurar

import anthropic

client \= anthropic.Anthropic()

\# Store 1 — org-wide (read-only para agentes)

store\_org \= client.beta.memory\_stores.create(

    name="cooperebr-org",

    description="Contexto jurídico, regulatório e tarifário da COOPERE-BR. Read-only para agentes."

)

\# Store 2 — por cooperado

store\_cooperados \= client.beta.memory\_stores.create(

    name="cooperebr-cooperados",

    description="Histórico de faturas, indébito e status processual por cooperado."

)

\# Store 3 — projeto dev

store\_dev \= client.beta.memory\_stores.create(

    name="cooperebr-dev",

    description="Decisões de sprint, fórmulas de cobrança e arquitetura do sistema."

)

print(f"org: {store\_org.id}")

print(f"cooperados: {store\_cooperados.id}")

print(f"dev: {store\_dev.id}")

\# Salvar os IDs — serão usados na configuração dos agentes

### 8.3 Seed inicial do store org-wide

\# seed-org-store.py — popular com contexto jurídico

import anthropic

client \= anthropic.Anthropic()

STORE\_ID \= "ID\_DO\_STORE\_ORG"  \# substituir pelo ID gerado acima

\# Carregar teses jurídicas

with open("docs/referencia/CONTEXTO-JURIDICO.md", "r", encoding="utf-8") as f:

    conteudo \= f.read()

\# Dividir em seções menores (máx 100KB por arquivo de memória)

secoes \= {

    "/juridico/teses.md": extrair\_secao(conteudo, "TESES JURÍDICAS"),

    "/juridico/jurisprudencia.md": extrair\_secao(conteudo, "JURISPRUDÊNCIA"),

    "/juridico/estrategia.md": extrair\_secao(conteudo, "ESTRATÉGIA PROCESSUAL"),

    "/tarifario/gross-up.md": extrair\_secao(conteudo, "ANÁLISE CONTÁBIL"),

}

for path, conteudo\_secao in secoes.items():

    client.beta.memory\_stores.memories.create(

        store\_id=STORE\_ID,

        path=path,

        content=conteudo\_secao

    )

    print(f"✅ {path} carregado")

### 8.4 Enquanto o beta não estiver disponível

Usar a pasta `memory/` local como fallback. O CLAUDE.md já referencia `memory/` como fonte de contexto persistente.

---

## PASSO 9 — CRIAR OPENCLAW CRON JOBS

Editar `.openclaw/cron/jobs.json` e adicionar:

{

  "jobs": \[

    {

      "name": "Monitoramento ANEEL",

      "agentId": "main",

      "sessionKey": "agent:main:whatsapp:direct:+5527981341348",

      "enabled": true,

      "schedule": {

        "cron": "0 18 \* \* 5"

      },

      "task": "Verificar novas Resoluções Normativas da ANEEL publicadas esta semana que impactem cooperativas de GD, geração compartilhada ou SCEE no ES. Resumir impactos e salvar em memory/padroes-aprendidos/."

    },

    {

      "name": "Backup Memory Stores",

      "agentId": "main",

      "sessionKey": "agent:main:whatsapp:direct:+5527981341348",

      "enabled": true,

      "schedule": {

        "cron": "0 2 \* \* \*"

      },

      "task": "Exportar conteúdo da pasta memory/ para docs/backup-memory/ com timestamp do dia."

    },

    {

      "name": "Relatório Indébito Mensal",

      "agentId": "main",

      "sessionKey": "agent:main:whatsapp:direct:+5527981341348",

      "enabled": true,

      "schedule": {

        "cron": "0 8 1 \* \*"

      },

      "task": "Compilar indébito acumulado por cooperado desde o início do monitoramento. Calcular projeção SELIC. Enviar resumo via WhatsApp para Luciano."

    }

  \]

}

---

## PASSO 10 — VERIFICAR INSTALAÇÃO

Após instalar todos os arquivos, abrir Claude Code e executar:

/arquiteto

O Claude deve responder com:

✅ Modo Arquiteto ativo

📋 Lendo memory/prompts-engenharia.md...

📋 10 modos disponíveis

❓ Qual é a tarefa?

Se responder assim: instalação concluída com sucesso.

---

## CHECKLIST DE INSTALAÇÃO

FASE 1 — Arquivos mestres (fazer agora)

\[ \] claude update (terminal)

\[ \] Criar estrutura de pastas (mkdir \-p do Passo 2\)

\[ \] CLAUDE.md na raiz (Passo 4.1)

\[ \] .claude/commands/arquiteto.md (Passo 4.2)

\[ \] docs/referencia/CONTEXTO-JURIDICO.md (Passo 4.3)

\[ \] docs/referencia/CONTEXTO-OPERACIONAL.md (Passo 4.4)

\[ \] memory/prompts-engenharia.md (Passo 4.5)

\[ \] .claude/rules/tributario.md (Passo 5\)

\[ \] Complementar .claude/rules/financeiro.md (Passo 6\)

FASE 2 — MCP Servers (semana 1\)

\[ \] Sequential Thinking MCP (instalar agora)

\[ \] Gmail MCP

\[ \] Verificar Supabase MCP

FASE 3 — Memory Stores (quando beta liberar)

\[ \] Verificar acesso em platform.claude.com

\[ \] Criar 3 stores (criar-stores.py)

\[ \] Seed do store org-wide (seed-org-store.py)

\[ \] Migrar memory/ local para stores

FASE 4 — Cron Jobs (após Fase 1\)

\[ \] Monitoramento ANEEL (sextas 18h)

\[ \] Backup memory (todo dia 2h)

\[ \] Relatório mensal (dia 1 às 8h)

FASE 5 — Skills customizadas (próximos sprints)

\[ \] .claude/skills/fatura-edp-auditor/ (prioridade máxima)

\[ \] .claude/skills/sisgd-extractor/

\[ \] .claude/skills/aneel-ren-analyzer/

\[ \] .claude/agents/juridico-agent.md

FASE 6 — Billing (só após /ultrareview)

\[ \] Rodar /ultrareview no backend

\[ \] Verificar calcularCobrancaMensal (função órfã?)

\[ \] Verificar BLOQUEIO\_MODELOS\_NAO\_FIXO

\[ \] Decisão sobre descongelar Sprint 5

---

## TUDO QUE FOI CRIADO NESTA SESSÃO

| \# | Arquivo | Destino | Status |
| :---- | :---- | :---- | :---- |
| 1 | CLAUDE.md v3.0 | raiz do projeto | ✅ pronto para instalar |
| 2 | arquiteto.md | .claude/commands/ | ✅ pronto para instalar |
| 3 | CONTEXTO-JURIDICO.md | docs/referencia/ | ✅ pronto para instalar |
| 4 | CONTEXTO-OPERACIONAL.md | docs/referencia/ | ✅ pronto para instalar |
| 5 | tributario.md | .claude/rules/ | ✅ conteúdo neste guia |
| 6 | financeiro.md (complemento) | .claude/rules/ | ✅ conteúdo neste guia |
| 7 | PROMPTS-ENGENHARIA.md | memory/ | ✅ pronto para instalar |
| 8 | criar-stores.py | scripts/ | ✅ conteúdo neste guia |
| 9 | seed-org-store.py | scripts/ | ✅ conteúdo neste guia |
| 10 | cron jobs (3 novos) | .openclaw/cron/ | ✅ conteúdo neste guia |

---

## O QUE ESSE SISTEMA FAZ PELO SEU TRABALHO DIÁRIO

ANTES:

→ Repetir contexto da COOPERE a cada sessão

→ Claude não sabe qual abordagem usar

→ Risco de mexer no billing sem querer

→ Decisões de sprint perdidas entre sessões

→ Análise tributária sem jurisprudência completa

DEPOIS:

→ Claude lê CLAUDE.md → já sabe tudo do projeto

→ /arquiteto → seleciona modo certo automaticamente

→ Billing bloqueado por regra explícita no CLAUDE.md

→ Decisões salvas em memory/ e Memory Stores

→ CONTEXTO-JURIDICO.md com todas as teses e precedentes

→ 10 modos cobrindo 100% das situações de desenvolvimento

---

*Criado em: Abril/2026* *Sessão: Skills \+ MCPs \+ Managed Memory \+ 10 Modos de Engenharia* *Projeto: COOPERE-BR — NestJS \+ TypeScript \+ Prisma \+ Supabase \+ Next.js*  
