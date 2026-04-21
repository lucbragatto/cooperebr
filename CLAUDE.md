# CLAUDE.md — CoopereBR

Plataforma SaaS multi-tenant para gestão de **cooperativas, consórcios e associações de energia solar** no modelo de Geração Distribuída (GD) regulamentado pela ANEEL. Gerencia o ciclo completo: cadastro de cooperados, contratos, faturas via OCR, cobranças e créditos de energia.

> Última atualização: 2026-04-21

---

## Instruções padrão — Claude trabalhando no CoopereBR

Dono do projeto: Luciano (não-desenvolvedor). Coordena entre:
- Claude no chat (claude.ai) — arquitetura, revisão, decisões
- Claude Code (terminal local) — execução, commits, testes

### Ao iniciar qualquer sessão, LER PRIMEIRO

Em ordem:

1. `docs/MAPA-SISTEMA.md` se existir — snapshot completo do sistema
2. `docs/sessoes/` últimos 3 arquivos — contexto recente
3. `git log -20 --oneline` — o que aconteceu recentemente
4. `CONTEXTO-CLAUDEAI.md` e `ARQUITETURA-RESUMO.md` se ainda
   relevantes (podem ter sido superados pelo MAPA-SISTEMA)

Não começar a trabalhar sem esse contexto.

### Ao responder pedidos do Claude.ai (chat)

**REGRA CRÍTICA:** quando o Claude.ai pedir pra você colar conteúdo
de arquivo, SEMPRE cole o output LITERAL do comando, nunca resuma.

Fluxo correto:
1. Execute o comando (ex: `Get-Content backend/src/x.ts`)
2. Cole o output completo na sua resposta
3. Se o arquivo tiver mais de 500 linhas, AVISE antes de colar e
   pergunte se prefere anexar como arquivo ou ler em partes

Fluxo incorreto:
- Resumir o conteúdo ("48 campos extraídos", "arquivo tem 310 linhas")
- Interpretar em vez de mostrar
- Assumir que o Claude.ai já viu o arquivo porque você viu

Motivo: Claude.ai não tem acesso ao filesystem local. Resumo faz ele
perder informação crítica pra revisar.

### Comunicação com o Luciano

Luciano não programa. Explicar decisões em linguagem humana:
- "O número antigo da EDP" não "legacy UC identifier"
- "Fatura do cooperado" não "FaturaProcessada entity"
- Evitar jargão de programação. Se usar termo técnico, explicar na
  primeira menção.

### Quando trava ou diverge

- Se é decisão DE ENGENHARIA (qual estrutura de código, qual lib,
  como organizar pasta): decida você mesmo, avise o Luciano por
  qual motivo você escolheu.
- Se é decisão DE PRODUTO (qual fluxo de usuário, qual regra de
  negócio): pergunte ao Luciano antes de executar.
- Se não tiver certeza: pergunte ao Luciano.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | NestJS + Prisma ORM + PostgreSQL (Supabase) |
| Frontend | Next.js 16 + Shadcn/UI + Tailwind CSS |
| WhatsApp | whatsapp-service (bot conversacional + CoopereAI) |
| OCR | Claude AI (Anthropic) |
| Email | Pipeline IMAP → OCR automático |
| Auth | JWT — roles: SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO, AGREGADOR |
| Pagamentos | Asaas (PIX + boleto) com webhook HMAC-SHA256 |

**Serviços em dev:**
- Backend: `localhost:3000`
- Frontend: `localhost:3001`
- WhatsApp: `localhost:3002`

---

## Estrutura do Monorepo

```
cooperebr/
├── backend/          # NestJS API (44 módulos, 70+ models Prisma)
│   ├── prisma/       # Schema + migrations
│   └── src/
│       ├── modules/  # Módulos por domínio
│       └── common/   # Guards, interceptors, utils
├── web/              # Next.js frontend (20+ pages)
│   └── app/          # App Router (Next.js 16)
├── whatsapp-service/ # Bot WA + CoopereAI
└── .claude/          # Contexto do Claude Code
    ├── rules/        # Regras de negócio e código
    ├── commands/     # Comandos disponíveis
    └── agents/       # Agentes especializados
```

---

## Entidades Centrais e Relacionamentos

Ver `.claude/rules/arquitetura.md` para detalhes completos. Resumo:

### Núcleo (elo central = Contrato)
```
Cooperativa (tenant root, 1:N tudo)
  └→ Cooperado (membro, 8 status)
       └→ UC (unidade consumidora, regra geográfica ANEEL)
  └→ Usina (geradora, soma % ≤ 100%)
  └→ Contrato (liga Cooperado ↔ UC ↔ Usina, define cota kWh)
       └→ Cobrança (mensal, vincula geração + fatura + Asaas)
```

### Entidades de suporte
- **PropostaCooperado** — saída do Motor de Proposta, ao aceitar cria Contrato
- **FaturaProcessada** — fatura OCR (Claude AI), base para kwhContratoAnual
- **GeracaoMensal** — kWh gerado por usina/mês, usado para rateio
- **ConfiguracaoCobranca** — regras de desconto (cascata: Contrato → Usina → Cooperativa)
- **TarifaConcessionaria** — tarifas dinâmicas por distribuidora
- **ListaEspera** — contratos em fila quando usina lotada

### Módulos complementares
- **Convênios** — acordos institucionais (condôminos, empresas, associações)
- **CooperToken** — sistema de fidelidade (opção A desconto / opção B acúmulo)
- **Indicações (MLM)** — referral com cascata de comissões
- **Clube de Vantagens** — tiers BRONZE → PRATA → OURO → DIAMANTE
- **Contas a Pagar** — gestão de AP (arrendamento usinas, manutenção)
- **Pipeline Email IMAP** — monitor de email → OCR automático
- **CoopereAI** — bot educativo pré-menu WA para novos contatos
- **Monitoramento Usinas** — integração Sungrow

---

## Domínio de Negócio

### Ciclo de vida do Cooperado
```
PENDENTE → PENDENTE_VALIDACAO → PENDENTE_DOCUMENTOS → AGUARDANDO_CONCESSIONARIA → APROVADO → ATIVO → ATIVO_RECEBENDO_CREDITOS → SUSPENSO → ENCERRADO
```
- **APROVADO** = checklist completo, aguarda ativação manual do admin
- **ATIVO** = pode receber cobranças e créditos
- `PENDENTE` é status legado — tratar como `CADASTRADO`
- Mudanças de status registradas em `HistoricoStatusCooperado` (audit trail)

### Ciclo de vida do Contrato
```
PENDENTE_ATIVACAO → ATIVO → SUSPENSO → ENCERRADO
LISTA_ESPERA (sem usina disponível)
```
- Contrato nasce como `PENDENTE_ATIVACAO`
- Quando admin ativa cooperado → todos contratos `PENDENTE_ATIVACAO` → `ATIVO` em cascata (transação atômica)
- **Cobrança só é gerada para contratos ATIVO**

### Regra de percentual de usina
- `Contrato.percentualUsina` = `kwhContratoAnual / (usina.capacidadeKwhMensal × 12) × 100`
- Soma dos % de todos os contratos ATIVO + PENDENTE_ATIVACAO de uma usina ≤ 100%
- Validar **sempre com transação Prisma** (corrigido em 19b28b6)
- `Cooperado.percentualUsina` é campo **legado** — não usar

### Cascata de desconto
```
1. Contrato.descontoOverride (se definido) → usa
2. ConfiguracaoCobranca(cooperativaId, usinaId) → usa (por usina)
3. ConfiguracaoCobranca(cooperativaId, null) → usa (geral)
4. ERRO: sem regra configurada
```

### Regra geográfica ANEEL
- UC só pode ser vinculada a usina da **mesma distribuidora**
- Ao criar contrato/proposta: filtrar usinas por distribuidora da UC

### Fluxo de cobrança (pipeline)
```
GeracaoMensal → Busca contratos ATIVO → Rateio por % → Resolve desconto (cascata)
→ Calcula valor (Math.round!) → Persiste Cobrança → Cria no Asaas → Notifica WA
→ Cooperado paga → Webhook Asaas → status PAGO
```

### Terminologia correta
| Evitar | Usar |
|---|---|
| "Fatura" (sozinho) | "Fatura Concessionária" |
| FaturaProcessada APROVADA | "Dados Conferidos" |
| "Cobranças" (sozinho) | "Cobranças Cooperativa" |

---

## Regras Críticas

Ver `.claude/rules/` para regras detalhadas por tema:
- `rules/multi-tenant.md` — isolamento por cooperativaId
- `rules/financeiro.md` — Math.round, Fio B, tarifas, PIX Excedente
- `rules/codigo.md` — TypeScript strict, NestJS patterns, Shadcn/UI
- `rules/arquitetura.md` — entidades, relacionamentos, fluxos de negócio
- `rules/status-bugs.md` — estado atualizado de bugs e pendências

---

## Bugs — Status atualizado (2026-04-14)

Ver `.claude/rules/status-bugs.md` para detalhes completos.

### Resumo rápido
- **P1 Críticos:** 3/3 resolvidos (transação aceitar, secret WA, webhook HMAC)
- **P2 Security:** 10/10 resolvidos (IDORs, tenant isolation, tarifa dinâmica)
- **P2 Bugs em aberto:** 5 pendentes (BONUS_INDICACAO, multa/juros, CORS, validações, crons)
- **Lacuna arquitetural:** Wizard + Cadastro público desconectados do Motor de Proposta

### 🟡 Aguardando ação manual
- **PIX-01:** Código pronto (b735dbe) — aguarda `ASAAS_PIX_EXCEDENTE_ATIVO=true` em prod

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

## Contexto da Cooperativa (cliente principal)

- **3 usinas arrendadas** em operação
- Distribuidora: EDP-ES (Espírito Santo)
- Tarifa EDP-ES (Fev/2026, B1 residencial) — agora dinâmica via TarifaConcessionaria:
  - TUSD líquida: R$ 0,46863/kWh
  - TE líquida: R$ 0,32068/kWh
  - Total sem tributos: R$ 0,78931/kWh
