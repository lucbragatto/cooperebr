# CoopereBR — Contexto do Projeto

> Última atualização: 2026-04-14

Plataforma SaaS multi-tenant para gestão de cooperativas, consórcios e associações de energia solar em **Geração Distribuída (GD)**.
O campo `Cooperativa.tipoParceiro` define o tipo: COOPERATIVA | CONSORCIO | ASSOCIACAO | CONDOMINIO.
Cliente principal: 3 usinas arrendadas em operação no Espírito Santo (EDP-ES).

## Arquitetura

- **Backend:** NestJS → `localhost:3000` | pasta `backend/` (44 módulos)
- **Frontend:** Next.js 16 (App Router) → `localhost:3001` | pasta `web/` (20+ pages)
- **WhatsApp Service:** pasta `whatsapp-service/` (bot + CoopereAI)
- **Banco:** PostgreSQL via Prisma ORM (70+ models)
- **OCR:** Claude AI (Anthropic) — extrai dados de faturas da concessionária
- **Email:** Pipeline IMAP → detecção automática de faturas → OCR
- **Pagamentos:** Asaas (PIX + boleto) com webhook HMAC-SHA256
- **Shell:** PowerShell — encadear com `;` (não `&&`)

## Entidade Central: Contrato

O **Contrato** é o elo que conecta tudo:
```
Cooperado ←→ Contrato ←→ UC (unidade consumidora)
                ↕
              Usina (geradora)
                ↕
            Cobrança (mensal)
```
Cada contrato define: kwhContratoAnual, percentualUsina, desconto. Ver `rules/arquitetura.md`.

## Regras críticas (detalhes em `.claude/rules/`)

- **Multi-tenant:** `cooperativaId` obrigatório em toda query Prisma → ver `rules/multi-tenant.md`
- **Financeiro:** arredondamento obrigatório, cálculo Fio B 2026=60%, tarifas dinâmicas → ver `rules/financeiro.md`
- **Código:** TypeScript strict, NestJS patterns, Shadcn/UI → ver `rules/codigo.md`
- **Arquitetura:** entidades, relacionamentos, fluxos de negócio → ver `rules/arquitetura.md`
- **Bugs:** estado atualizado de bugs e pendências → ver `rules/status-bugs.md`

## Variáveis de ambiente sensíveis

- `ASAAS_PIX_EXCEDENTE_ATIVO` — **não ativar em prod sem instrução explícita de Luciano**
- Nunca hardcodar credenciais

## Módulos do backend (por domínio)

### Núcleo
- `cooperados` — cadastro, KYC, documentos, status (52KB service)
- `contratos` — ciclo de vida, capacidade usina, alocação % (14KB)
- `usinas` — usinas, monitoramento, analítico (19KB)
- `cobrancas` — geração de cobranças, tracking, WA (34KB)
- `faturas` — OCR Claude, ingestão, histórico consumo (60KB)
- `motor-proposta` — cálculo economia, alocação, PDF proposta (45KB)
- `ucs` — unidades consumidoras

### Financeiro
- `financeiro` — contabilidade, caixa, PIX Excedente
- `configuracao-cobranca` — regras desconto por usina/cooperativa
- `geracao-mensal` — kWh gerado por usina/mês
- `contas-pagar` — módulo AP (arrendamento, manutenção) **NOVO abr/14**
- `asaas` — gateway pagamento (PIX, boleto)
- `integracao-bancaria` — BB, Sicoob

### Comunicação
- `whatsapp` — bot conversacional + CoopereAI **NOVO abr/09**
- `notificacoes` — multi-canal (WebSocket, WA, email)
- `email-monitor` — pipeline IMAP → OCR **NOVO abr/12**

### Comercial
- `convenios` — acordos institucionais, progressão faixas
- `cooper-token` — fidelidade/tokens (53KB)
- `indicacoes` — MLM/referral com cascata
- `clube-vantagens` — tiers BRONZE→DIAMANTE
- `lead-expansao` — leads de vendas

### Outros
- `cooperativas` — gestão de tenants, SaaS billing
- `auth` — JWT, roles, facial recognition
- `relatorios` — analytics, conferência kWh **NOVO abr/12**
- `observador` — modo leitura para cooperados
- `migracoes-usina` — migração entre plantas
- `saas` — billing multi-tenant
- `publico` — endpoints públicos (cadastro, verificação email)

## Comandos disponíveis (`.claude/commands/`)

- `/apurar-excedente` — apuração mensal de créditos excedentes
- `/fix-bug` — fluxo padrão de correção de bug
- `/qa-run` — executar suite de QA
- `/review` — revisão de código antes de merge

## Agentes disponíveis (`.claude/agents/`)

- `pix-agent` — lógica de PIX excedente
- `wa-bot-agent` — WhatsApp bot

## Estado atual — 2026-04-14

### Progresso
- **P1 Críticos:** ✅ 3/3 resolvidos
- **P2 Security:** ✅ 10/10 resolvidos
- **P2 Bugs:** 🔴 5 pendentes → ver `rules/status-bugs.md`
- **Lacuna arquitetural:** Wizard + Cadastro público desconectados do Motor de Proposta

### Próximos passos
1. Corrigir 5 bugs P2 abertos
2. Conectar Wizard/Cadastro ao Motor de Proposta
3. Vincular GeracaoMensal ↔ Cobrança e FaturaProcessada ↔ Cobrança
4. DTOs + paginação + testes
