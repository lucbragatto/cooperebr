# CONTEXTO-CLAUDEAI.md — CoopereBR
> Arquivo de contexto para o projeto CoopereBR no Claude.ai. Atualizado em 15/04/2026.

---

## O QUE É O COOPEREBR

Plataforma SaaS para gestão de **cooperativas de energia solar** no modelo de Geração Distribuída (GD) regulamentado pela ANEEL. Gerencia o ciclo completo: cadastro de cooperados, contratos, faturas via OCR, cobranças e créditos de energia.

---

## STACK

| Camada | Tecnologia |
|---|---|
| Backend | NestJS + Prisma ORM + PostgreSQL (Supabase) |
| Frontend | Next.js 16 + Shadcn/UI + Tailwind CSS |
| WhatsApp Bot | Baileys (whatsapp-service porta 3002) |
| OCR | Claude AI (Anthropic) via API |
| Auth | JWT — roles: SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO |
| Pagamentos | Asaas (PIX + boleto) |
| Email | Google Workspace IMAP (contato@cooperebr.com.br) |

**Serviços em dev:**
- Backend: `localhost:3000`
- Frontend: `localhost:3001`
- WhatsApp: `localhost:3002`

**Estrutura:**
```
cooperebr/
├── backend/          # NestJS API
│   ├── prisma/       # Schema + migrations
│   └── src/          # Módulos por domínio
├── web/              # Next.js frontend (App Router)
└── whatsapp-service/ # Bot WA (Baileys)
```

---

## REGRAS DE NEGÓCIO CRÍTICAS — NUNCA VIOLAR

### 1. Modelo de energia (FUNDAMENTAL)
- O **cooperado NÃO gera energia**. Apenas as usinas arrendadas pela cooperativa geram.
- A cooperativa distribui **créditos de kWh** proporcionalmente entre cooperados (conforme % de cada contrato).
- O cooperado recebe X kWh de crédito/mês. Se consumir menos → saldo acumula. Se consumir mais → usa saldo ou paga diferença à distribuidora.
- **NÃO existe "excedente gerado pelo cooperado"**.

### 2. CooperToken
- Acumulado por: indicação, bônus, plano FATURA_CHEIA_TOKEN.
- Uso: **SEMPRE MANUAL** — cooperado escolhe quando e como usar (abater fatura ou usar com parceiro).
- **Sistema NUNCA aplica desconto automático sem ação do cooperado.**

### 3. Multi-tenant (OBRIGATÓRIO)
- **TODO query Prisma deve filtrar por `cooperativaId`**.
- Nunca expor dados cross-tenant. ForbiddenException se IDs não baterem.
- Padrão: `where: { id, cooperado: { cooperativaId } }` para entidades aninhadas.

### 4. Cascata de desconto
```
Contrato.descontoOverride → ConfigCobranca(cooperativaId, usinaId) → ConfigCobranca(cooperativaId, null) → ERRO
```

### 5. Percentual de usina
```
percentualUsina = (kwhContratoAnual / (usina.capacidadeKwhMensal × 12)) × 100
Soma de todos percentuais ATIVO + PENDENTE_ATIVACAO ≤ 100%
Sempre validar com prisma.$transaction + SELECT FOR UPDATE
```

### 6. Regra geográfica ANEEL
- UC só pode ser vinculada a usina da **mesma distribuidora**.
- Ao criar contrato/proposta: filtrar usinas por distribuidora da UC.

### 7. Fio B (regulatório)
- GD2 e GD1 >75kW: Fio B cobrado progressivamente.
- 2026: 60% | 2027: 75% | 2028: 90% | 2029+: 100%
- Impacto: reduz ~21% a economia do cooperado em 2026.

---

## CICLOS DE VIDA

### Cooperado
```
CADASTRADO → EM_ANALISE → APROVADO → ATIVO → SUSPENSO → ENCERRADO
```
- `PENDENTE` é status legado — tratar como `CADASTRADO`
- Cobranças só para cooperados `ATIVO`
- Tokens do CooperToken só para cooperados `ATIVO`

### Contrato
```
PENDENTE_ATIVACAO → ATIVO → SUSPENSO → ENCERRADO
LISTA_ESPERA (sem usina disponível)
```
- Quando admin ativa cooperado → todos contratos `PENDENTE_ATIVACAO` → `ATIVO` em cascata
- **Cobrança só é gerada para contratos ATIVO**

### Proposta
```
PENDENTE → PENDENTE_ASSINATURA → ASSINADA → ACEITA → CANCELADA
```
- `aceitar()` deve ser transação atômica: calcula %, verifica capacidade, cria Contrato.
- Após gerar proposta: enviar link de assinatura por WA + email automaticamente.
- Se não assinar em X horas: lembrete automático por WA + email.
- Após assinar: copia para cooperado por WA + email, passa para fila de alocação em usina.

---

## MODELOS DE COBRANÇA

| Modelo | Como funciona |
|---|---|
| `FIXO_MENSAL` | Valor fixo por mês independente de geração |
| `CREDITOS_COMPENSADOS` | Baseado no kWh compensado real da fatura da concessionária |
| `CREDITOS_DINAMICO` | Baseado no kWh gerado proporcional ao % do contrato |

---

## MÓDULOS PRINCIPAIS

### Backend (`backend/src/`)
| Módulo | Descrição |
|---|---|
| `cooperados/` | CRUD cooperados, cadastro-completo, ciclo de vida |
| `contratos/` | Criação, ativação, ciclo de vida |
| `usinas/` | Gestão de usinas, GeracaoMensal |
| `faturas/` | OCR, FaturaProcessada, Central de Faturas, pipeline email |
| `cobrancas/` | Geração, cálculo, multa/juros, Asaas |
| `motor-proposta/` | Cálculo de propostas, PDF, aprovação remota, assinatura digital |
| `cooperados-token/` | CooperToken: ledger, saldo, uso, compra |
| `clube-vantagens/` | Tiers BRONZE→DIAMANTE, ofertas, resgates |
| `indicacoes/` | MLM: indicações, benefícios, idempotência |
| `whatsapp/` | Bot WA, CoopereAI, handlers por tipo de mensagem |
| `config-tenant/` | Configurações por cooperativa (@@unique [chave, cooperativaId]) |
| `contas-a-pagar/` | CRUD contas a pagar (arrendamentos, manutenção) — NOVO abr/14 |
| `motor-proposta/` | Cálculo, PDF, aprovação, assinatura digital |

### Frontend (`web/app/`)
| Rota | Descrição |
|---|---|
| `/dashboard/` | Painel admin |
| `/dashboard/cooperados/` | Lista + detalhes cooperados |
| `/dashboard/cooperados/novo/` | Wizard admin (7 steps) |
| `/dashboard/faturas/central/` | Central de faturas (fila de revisão) |
| `/dashboard/motor-proposta/` | Motor de propostas |
| `/dashboard/contas-a-pagar/` | Contas a pagar |
| `/portal/` | Portal do cooperado |
| `/cadastro/` | Auto-cadastro público (wizard 4 steps) |
| `/parceiro/` | Portal do parceiro |

---

## FLUXO DE FATURAS (EMAIL → OCR → COBRANÇA)

```
contato@cooperebr.com.br (IMAP)
  → email-monitor detecta PDF da EDP
  → Claude OCR extrai: titular, UC, consumo, histórico 12m, créditos injetados/compensados
  → Cria FaturaProcessada (status PENDENTE)
  → Notifica admin via WhatsApp
  → Admin revisa na Central de Faturas
  → Admin aprova → gera Cobrança baseada nos dados reais
```

---

## BACKLOG PRIORIZADO (15/04/2026)

### P1 — Urgentes
| # | Item | Descrição |
|---|---|---|
| 1 | Fix recalculo plano (admin) | `Step3Simulacao.tsx`: ao trocar plano, adicionar `useEffect` que chama `gerarSimulacao()` automaticamente |
| 2 | Cadastro público buscar planos | `/cadastro` deve buscar planos com `publico=true` do admin (hoje usa 20% hardcoded) |
| 3 | Fluxo assinatura — envio automático | Após gerar proposta, enviar link `/assinar?token=xxx` por WA + email automaticamente |
| 4 | Status `PENDENTE_ASSINATURA` | Motor de proposta: adicionar status no ciclo de vida da proposta |

### P2 — Importantes
| # | Item | Descrição |
|---|---|---|
| 5 | Cópia pós-assinatura | Enviar PDF assinado por WA + email após confirmação |
| 6 | Lembrete assinatura pendente | Se não assinar em 24h: lembrete automático por WA + email com link |
| 7 | Rebalanceamento de usinas | Algoritmo que combina sobras de 2-3 usinas para encaixar cooperado; proposta de rebalanceamento exibida ao admin para aprovar |
| 8 | Lista por usina para concessionária | Gerar lista atualizada por usina sempre que houver alocação/rebalanceamento aprovado |
| 9 | Desconto maior por indicação | Quando cadastro vem com `?ref=CODIGO`, vincular desconto maior para o indicador (CooperToken) |
| 10 | `BONUS_INDICACAO` | Idempotência sem `cooperativaId` — pode creditar token cross-tenant |
| 11 | `BUG-CALCULO-001` | Multa/juros: 3 implementações divergentes |

### P3 — Futuros
| # | Item | Descrição |
|---|---|---|
| 12 | Assinatura digital legal | Integrar D4Sign ou ClickSign (hoje é apenas timestamp+nome) |
| 13 | CORS whatsapp-service | Porta 3002 sem autenticação no `/reconnect` |

## BUGS P2 ABERTOS LEGADOS (em 14/04/2026)

| Bug | Descrição |
|---|---|
| Validações comentadas | CPF/nome no `cadastroWeb` comentados (leads inválidos possíveis) |
| 3 crons às 6h | `apurarExcedentes` + `verificarEmails` + `notificarCobrancas` concorrentes |

---

## COMMITS RECENTES (14/04/2026)

| Commit | O que foi feito |
|---|---|
| `b98727a` | Módulo Contas a Pagar (CRUD + frontend) |
| `313fbf4` | Campos saldo/economia em FaturaProcessada + migration |
| `ee06ca1` | indicadosAtivos no churn + histórico de status cooperado |
| `1a6d930` | Áudio/vídeo/sticker no bot WA corrigido |
| `980414e` | Fator 0.15 hardcoded removido → usa desconto real |
| `5904c0d` | modoTeste → env var |
| `20c337c` | Webhook Asaas com HMAC timing-safe |
| `3b50a45` | Secret WA → env var `WHATSAPP_WEBHOOK_SECRET` |
| `879e3f8` | 5 bugs P2: IDOR faturas/proposta, kwhInjetado, saldoAnterior |

---

## CONVENÇÕES DE CÓDIGO

```typescript
// Multi-tenant: SEMPRE
const fatura = await prisma.faturaProcessada.findFirst({
  where: { id, cooperado: { cooperativaId } }
});
if (!fatura) throw new ForbiddenException('Não encontrado nesta cooperativa');

// Cálculos financeiros: SEMPRE Math.round
const valorLiquido = Math.round((valorBruto - desconto) * 100) / 100;

// Commits: português, descritivo
// fix: corrigir IDOR em deletarFatura
// feat: módulo contas a pagar com CRUD
// refactor: extrair cálculo desconto para service
```

**Env vars obrigatórias:** `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_WEBHOOK_SECRET`, `ASAAS_API_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_MODO_TESTE`

---

## DECISÕES DE PRODUTO DEFINIDAS (15/04/2026)

| Decisão | Detalhe |
|---|---|
| Assinatura | Preparar infra para assinatura digital real (D4Sign/ClickSign) |
| Planos públicos | Admin pode marcar **mais de um** plano como público — todos aparecem na página `/cadastro` |
| Plano FATURA_CHEIA_TOKEN | Cooperado paga valor cheio e recebe CooperTokens equivalentes ao desconto para usar no Clube |
| Rebalanceamento de usinas | Somente com aprovação explicitado do admin — nunca automático |
| Lista concessionária | Toda alocação ou rebalanceamento aprovado gera nova lista por usina afetada |
| Indicação no cadastro | `/cadastro?ref=CODIGO` vincula indicação e aplica desconto maior para o indicador |
| Fluxo proposta | Proposta gerada → link assinatura enviado → lembrete se pendente → assinada → alocação em usina |

---

## COMO TRABALHAR NESTE PROJETO

1. Sempre verificar tenant isolation antes de qualquer operação
2. Nunca hardcodar secrets — usar env vars
3. Commits pequenos e descritivos em português
4. Ao criar endpoint novo: adicionar `req.user?.cooperativaId` nos guards
5. Ao modificar schema Prisma: rodar `npx prisma db push` (não `migrate` em dev)
6. Testar localmente antes de commitar: `pm2 restart cooperebr-backend`
7. **Regra de execução:** uma tarefa por vez. Propõe → aprova → executa → testa → aprova resultado → próxima.
8. **Shell PowerShell:** usar `;` em vez de `&&` para encadear comandos
