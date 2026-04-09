# CoopereBR — Contexto do Projeto

Cooperativa de energia elétrica atuando exclusivamente em **Geração Distribuída (GD)**.
Possui **3 usinas arrendadas** em operação no Espírito Santo.

## Arquitetura

- **Backend:** NestJS → `localhost:3000` | pasta `backend/`
- **Frontend:** Next.js (App Router) → `localhost:3001` | pasta `web/`
- **WhatsApp Service:** pasta `whatsapp-service/`
- **Banco:** PostgreSQL via Prisma ORM
- **Shell:** PowerShell — encadear com `;` (não `&&`)

## Regras críticas (detalhes em `.claude/rules/`)

- **Multi-tenant:** `cooperativaId` obrigatório em toda query Prisma → ver `rules/multi-tenant.md`
- **Financeiro:** arredondamento obrigatório, cálculo Fio B, tarifas EDP-ES → ver `rules/financeiro.md`
- **Código:** TypeScript strict, NestJS patterns, Shadcn/UI → ver `rules/codigo.md`

## Variáveis de ambiente sensíveis

- `ASAAS_PIX_EXCEDENTE_ATIVO` — **não ativar em prod sem instrução explícita de Luciano**
- Nunca hardcodar credenciais

## Comandos disponíveis (`.claude/commands/`)

- `/apurar-excedente` — apuração mensal de créditos excedentes
- `/fix-bug` — fluxo padrão de correção de bug
- `/review` — revisão de código antes de merge

## Agentes disponíveis (`.claude/agents/`)

- `pix-agent` — lógica de PIX excedente
- `wa-bot-agent` — WhatsApp bot

## Pendências críticas — Status atualizado (2026-04-08)

### ✅ Resolvidos
- **FATURA-01:** IDOR corrigido — validação owner em uploadConcessionaria (7c8ed1d)
- **FATURA-02:** ConfigTenant isolado por cooperativaId (850dfbd)
- **FATURA-03:** cooperativaId sempre do JWT nos endpoints de fatura (b3cf4b6)
- **CONV-SEM-UC-01:** Conversão usa tarifa real TUSD+TE com Math.round (621abd3)
- **CTK-01:** Math.round em apurarExcedentes (0f78382)

### 🟡 Aguardando ação manual
- **PIX-01:** Código pronto (b735dbe) — aguarda `ASAAS_PIX_EXCEDENTE_ATIVO=true` em prod

### 🟠 Em aberto
- **CTK-04:** Loop de apuração pode pegar contrato errado
- **WA-BOT-03/06:** Investigar no relatório QA
