# CLAUDE.md — COOPERE-BR v3.0

## Projeto

Cooperativa de energia solar fotovoltaica (GD compartilhada) no ES. CNPJ 41.604.843/0001-84. Responsável: Luciano Costa Bragatto.

## Stack

NestJS \+ TypeScript \+ Prisma \+ Supabase \+ Next.js Backend: porta 3000 | Frontend: porta 3001 Repo: github.com/lucbragatto/cooperebr

## Comandos

- Dev backend:  npm run start:dev (porta 3000\)  
- Dev frontend: npm run dev (porta 3001\)  
- Build: npm run build  
- Test: npm test \-- \[path\]  
- Lint: npm run lint:fix  
- Type check: npx tsc \--noEmit  
- DB push: npx prisma db push (usar sem pgbouncer)  
- DB studio: npx prisma studio

## Arquitetura

- backend/src/           → API NestJS, módulos por domínio  
- backend/src/billing/   → Motor de cobrança — CONGELADO (ver Regras)  
- web/src/               → Next.js frontend  
- .claude/skills/        → skills com SKILL.md \+ scripts/ \+ data/  
- .claude/agents/        → pix-agent, wa-bot-agent, juridico-agent  
- .claude/rules/         → financeiro.md, tributario.md, codigo.md  
- docs/referencia/       → contextos completos (ler antes de agir)  
- memory/                → memória persistente local do agente

## Regras

- IMPORTANT: ler docs/referencia/CONTEXTO-JURIDICO.md antes de qualquer análise tributária  
- IMPORTANT: ler docs/referencia/CONTEXTO-OPERACIONAL.md antes de auditar faturas ou SISGD  
- IMPORTANT: rodar type check após toda alteração de código  
- NEVER modificar backend/src/billing/ sem autorização explícita — commit congelado 9174461  
- NEVER commitar .env ou expor chaves de API  
- Toda lógica de negócio em src/lib/services/ — nunca em rotas ou componentes  
- Decimal do Prisma: sempre converter para string antes de retornar na API  
- Usar pgbouncer=false nas migrations do Prisma (Supabase bloqueia)  
- Skills seguem padrão obrigatório: SKILL.md \+ CLAUDE.md \+ scripts/ \+ data/  
- Erros de porta ocupada: matar processo antes de reiniciar (EADDRINUSE)

## Workflow

- Perguntar antes de iniciar tarefas complexas ou com impacto em billing  
- Mudanças mínimas — não refatorar código não relacionado à tarefa  
- Commit separado por mudança lógica — nunca commit gigante  
- Rodar /ultrareview antes de merge em qualquer módulo de billing  
- Quando houver duas abordagens, apresentar ambas e deixar Luciano escolher  
- Testar após cada mudança — corrigir falhas antes de continuar

## Fora de escopo

- Não modificar .openclaw/cron/jobs.json sem revisar impacto nos agentes  
- Não alterar Estatuto Social ou minutas jurídicas — apenas sugerir  
- Não protocolar peças processuais — requer advogado habilitado (OAB)

