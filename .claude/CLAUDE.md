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

## Pendências críticas (NÃO subir para prod)

- **FATURA-01:** IDOR — cooperado pode enviar fatura em nome de outro
- **FATURA-02:** ConfigTenant sem isolamento por cooperativa
- **FATURA-03:** Admin pode ver faturas de outra cooperativa via parâmetro externo
- **CONV-SEM-UC-01:** Conversão de créditos usa % como R$/kWh → valores absurdos
- Tokens sem arredondamento (5° sprint sem corrigir)
