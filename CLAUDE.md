# CLAUDE.md — CoopereBR

Plataforma SaaS para gestão de **cooperativas de energia solar** no modelo de Geração Distribuída (GD) regulamentado pela ANEEL. Gerencia o ciclo completo: cadastro de cooperados, contratos, faturas via OCR, cobranças e créditos de energia.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | NestJS + Prisma ORM + PostgreSQL (Supabase) |
| Frontend | Next.js 16 + Shadcn/UI + Tailwind CSS |
| WhatsApp | whatsapp-service (bot conversacional) |
| OCR | Claude AI (Anthropic) |
| Auth | JWT — roles: SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO |
| Pagamentos | Asaas (PIX + boleto) |

**Serviços em dev:**
- Backend: `localhost:3000`
- Frontend: `localhost:3001`
- WhatsApp: `localhost:3002` (porta padrão do serviço)

---

## Estrutura do Monorepo

```
cooperebr/
├── backend/          # NestJS API
│   ├── prisma/       # Schema + migrations
│   └── src/
│       ├── modules/  # Módulos por domínio
│       └── common/   # Guards, interceptors, utils
├── web/              # Next.js frontend
│   └── app/          # App Router (Next.js 16)
├── whatsapp-service/ # Bot WA
└── .claude/          # Esta pasta — contexto do Claude Code
```

---

## Domínio de Negócio

### Ciclo de vida do Cooperado
```
CADASTRADO → EM_ANALISE → APROVADO → ATIVO → SUSPENSO → ENCERRADO
```
- **APROVADO** = checklist completo, aguarda ativação manual do admin
- **ATIVO** = pode receber cobranças e créditos
- `PENDENTE` é status legado — tratar como `CADASTRADO`

### Ciclo de vida do Contrato
```
PENDENTE_ATIVACAO → ATIVO → SUSPENSO → ENCERRADO
LISTA_ESPERA (sem usina disponível)
```
- Contrato nasce como `PENDENTE_ATIVACAO`
- Quando admin ativa cooperado → todos contratos `PENDENTE_ATIVACAO` → `ATIVO` em cascata
- **Cobrança só é gerada para contratos ATIVO**

### Regra de percentual de usina
- `Contrato.percentualUsina` = `kwhContratoAnual / (usina.capacidadeKwhMensal × 12) × 100`
- Soma dos % de todos os contratos ATIVO + PENDENTE_ATIVACAO de uma usina ≤ 100%
- Validar **sempre com transação Prisma** (evitar race condition)
- `Cooperado.percentualUsina` é campo **legado** — não usar

### Regra geográfica ANEEL
- UC só pode ser vinculada a usina da **mesma distribuidora**
- Ao criar contrato/proposta: filtrar usinas por `distribuidora.id` da UC

### Terminologia correta
| ❌ Evitar | ✅ Usar |
|---|---|
| "Fatura" (sozinho) | "Fatura Concessionária" |
| FaturaProcessada APROVADA | "Dados Conferidos" |
| "Cobranças" (sozinho) | "Cobranças Cooperativa" |

---

## Regras Críticas

Ver `.claude/rules/` para regras detalhadas por tema. Resumo:

1. **Multi-tenant obrigatório** — todo query Prisma deve filtrar por `cooperativaId` (nunca expor dados cross-tenant)
2. **Nunca modificar prod diretamente** — usar migrations Prisma, nunca SQL manual em prod
3. **PIX Excedente** — controlado pela flag `ASAAS_PIX_EXCEDENTE_ATIVO` no `.env`; não ativar sem instrução explícita
4. **Math.round em cálculos financeiros** — sempre arredondar valores monetários antes de persistir
5. **Fio B** — cobrado progressivamente desde 2023 para GD2 e GD1 >75kW; em 2026 = 60% do valor total

---

## Comandos úteis

```bash
# Backend
cd backend && npm run start:dev

# Frontend
cd web && npm run dev

# Prisma
npx prisma studio
npx prisma migrate dev --name <nome>
npx prisma db push   # apenas dev, nunca prod

# Testes
cd backend && npm run test
cd backend && npm run test:e2e
```

---

## Contexto da Cooperativa

- **3 usinas arrendadas** em operação
- Distribuidora: EDP-ES (Espírito Santo)
- Tarifa EDP-ES (Fev/2026, B1 residencial):
  - TUSD líquida: R$ 0,46863/kWh
  - TE líquida: R$ 0,32068/kWh
  - Total sem tributos: R$ 0,78931/kWh

---

## Bugs críticos em aberto (atualizar ao resolver)

> Última atualização: QA 2026-04-03 · Score 8.5/10 · 35 bugs acumulados

### 🔴 Críticos — NÃO subir em produção sem resolver

| ID | Descrição | Módulo |
|---|---|---|
| FATURA-01 | IDOR: cooperado pode enviar fatura em nome de outro (sem validação owner em `uploadConcessionaria`) | faturas |
| FATURA-02 | `ConfigTenant` buscado sem `cooperativaId` → threshold de um parceiro aplicado a outro | multi-tenant |
| FATURA-03 | Admin de parceiro consegue ver faturas de outros passando `cooperativaId` externo em `GET /faturas/central` | multi-tenant |
| CONV-SEM-UC-01 | Conversão SEM_UC usa `descontoPadrao` (%) como preço R$/kWh → valores absurdos (100 kWh = R$2.000) | conversão |
| PIX-01 | PIX Excedente aguarda `ASAAS_PIX_EXCEDENTE_ATIVO=true` em prod (6 dias parado) | PIX |

### 🟠 Alta prioridade

| ID | Descrição | Observação |
|---|---|---|
| CTK-01 | Sem Math.round em `apurarExcedentes` | **5º sprint sem correção** — fix de 1 linha |
| CTK-04 | Loop de apuração pode pegar contrato errado | aberto |
| WA-BOT-06 | Dupla mensagem em menu fora de horário | aberto |
| WA-BOT-03 | (ver relatório QA) | aberto |
| FINANCEIRO-01 | Módulo Financeiro exibe telas vazias (sem backend) | frontend sem dados |
