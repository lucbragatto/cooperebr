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

## DIAGNÓSTICO ARQUITETURAL — OS 3 MUNDOS DESCONECTADOS (15/04/2026)

O sistema tem três camadas que deveriam se conectar em sequência mas estão isoladas:

```
[Módulo Planos] → define regras comerciais
      ↓ (deveria alimentar)
[Motor de Proposta] → calcula, grava e gerencia propostas
      ↓ (deveria ser chamado por)
[Wizard Admin / Cadastro Público] → interface de cadastro
```

### Wizard Admin (`/dashboard/cooperados/novo`) — 7 steps
- Step 1: OCR fatura ✅
- Step 2: Dados pessoais ✅
- Step 3: Simulação + escolha plano — chama calcular() mas só exibe, não grava ⚠️
- Step 4: Envia proposta via wa.me ou mailto — **NÃO chama aceitar(), nada é salvo no banco** ❌
- Step 5: Upload docs ✅
- Step 6: Contrato — `enviarParaAssinatura()` só muda estado React local, **não chama backend** ❌
- Step 7: Alocação — chama motor tarde demais ❌

**Resultado:** wizard admin não persiste nada. PropostaCooperado e Contrato nunca são criados pelo wizard.

### Cadastro Público (`/cadastro`) — 4 steps
- `DESCONTO_PERCENTUAL_FALLBACK = 0.20` **hardcoded** ❌
- Campo `plano.publico` existe no banco mas é **ignorado** ❌
- `GET /planos/ativos` existe mas **sem filtro de tenant nem de publico** ❌
- Finaliza com `POST /publico/cadastro-web` → cria `LeadWhatsapp` (não Cooperado, não Proposta) ❌
- Motor de Proposta **nunca é chamado** no fluxo público ❌
- Tenant não é identificado na página — **usar `?tenant=COOPERATIVA_ID`** como query param

### Como o link de indicação se conecta ao MLM e Clube
```
Cooperado compartilha: /cadastro?ref=CODIGO
  → frontend exibe banner com nome do indicador
  → ao finalizar cadastro: salva codigoRef no LeadWhatsapp.dados{}
  → notifica indicador via WA (já implementado)
  → PROBLEMA: codigoRef fica perdido no JSON do lead — não chama registrarIndicacao()
  → registrarIndicacao() exige cooperadoId — lead não é cooperado ainda
  → resultado: cadeia MLM NUNCA se forma pelo cadastro web

O correto (após refatoração):
  → cadastro-web cria Cooperado (PENDENTE) — não Lead
  → chama registrarIndicacao(cooperadoId, codigoRef) imediatamente
  → tokens BONUS_INDICACAO só na primeira fatura paga (já correto)
```

Links internos do backend geram `/entrar?ref=CODIGO` mas cadastro usa `/cadastro?ref=CODIGO` — **duas entradas diferentes**, precisa unificar.

---

## PERGUNTAS EM ABERTO — RESPOSTAS CONFIRMADAS (15/04/2026)

| # | Pergunta | Resposta |
|---|---|---|
| P1 | Como `/cadastro` identifica o tenant hoje? | **Não identifica.** Não há cooperativaId, subdomínio nem query param. Decisão: usar `?tenant=COOPERATIVA_ID` como query param agora. Subdomínio é evolução futura. |
| P2 | `GET /planos/ativos` já existe? | **Existe (`@Public()`), mas filtra errado.** Retorna todos os planos do sistema sem filtrar por `cooperativaId` nem `publico: true`. Precisa adicionar ambos os filtros + aceitar query params. |
| P3 | `enviarAssinatura()` já envia WA + email? | **Não. Só gera token e faz `console.log` do link.** Nenhum WA, nenhum email é disparado. Precisa implementar envio real do zero dentro dessa função. |
| P4 | Há chamadas diretas a `aceitar()` que podem quebrar? | **Sim — 1 rota no controller** (`motor-proposta.controller.ts:50`). Na T3, essa rota deve ser protegida ou removida. O fluxo correto é: `assinarDocumento()` → chama `aceitar()` internamente. |

### Detalhe crítico — `confirmarOpcao()` atual
Hoje `confirmarOpcao()` **apenas chama `calcular()`** — não muda status, não dispara nada. O fluxo `PENDENTE → PENDENTE_ASSINATURA` ainda não existe no código. A T3 cria isso do zero.

---

## BACKLOG PRIORIZADO — COMPLETO (15/04/2026)

### Sprint 1 — Baixo risco, sem dependências pesadas
| # | Tarefa | Arquivos | Detalhes |
|---|---|---|---|
| T1 | Fix recalculo plano (admin) | `web/app/dashboard/cooperados/novo/steps/Step3Simulacao.tsx` | Adicionar `useEffect` que observa `planoSelecionadoId` e chama `gerarSimulacao()` quando há dados |
| T2 | Cadastro público buscar planos reais | `backend/src/planos/planos.service.ts`, `planos.controller.ts`, `web/app/cadastro/page.tsx` | `findAtivos()` aceitar `cooperativaId` + `publico`, frontend buscar `?publico=true&cooperativaId=X`, remover 20% hardcoded |
| T8 | Tenant isolation em Planos | `backend/src/planos/planos.service.ts` | Todos os métodos exigir cooperativaId |
| T6 | Unificar link de indicação | `backend/src/indicacoes/indicacoes.service.ts` | Mudar `gerarLink()` para usar `/cadastro?ref=` em vez de `/entrar?ref=` |
| T7 | Reativar validações cadastro público | `backend/src/publico/publico.controller.ts` | Descomentar validações de CPF/email/telefone |

### Sprint 2 — Médio risco (motor ANTES do wizard — nessa ordem)
| # | Tarefa | Arquivos | Detalhes |
|---|---|---|---|
| T3 | PENDENTE_ASSINATURA + envio real | `backend/src/motor-proposta/motor-proposta.service.ts` | **Só backend.** `confirmarOpcao()` mudar status, `enviarAssinatura()` enviar WA+email (hoje só console.log), proteger rota direta `aceitar()`. **Fazer antes de T0.** |
| T0 | Wizard Admin conectar ao Motor | `web/app/dashboard/cooperados/novo/steps/Step*.tsx` + `page.tsx` | **Depende de T3 pronto.** Step3 chamar `calcular()` real, Step4/6 chamar `aceitar()` + `enviarAssinatura()` — hoje NADA é salvo no banco pelo wizard |

### Sprint 3 — Alto risco (feature toggle obrigatório)
| # | Tarefa | Arquivos | Detalhes |
|---|---|---|---|
| T4 | Cadastro público criar Cooperado + Proposta | `backend/src/publico/publico.controller.ts` | Em vez de LeadWhatsapp, criar Cooperado (PENDENTE) + Motor + `enviarAssinatura()`. **Usar feature toggle `NEXT_PUBLIC_CADASTRO_V2=true`** — quebra de fluxo significativa, admin pode ter processos dependentes do lead manual |
| T5 | Vincular indicação no cadastro público | `backend/src/publico/publico.controller.ts` + `indicacoes.service.ts` | Chamar `registrarIndicacao(cooperadoId, codigoRef)` após criar Cooperado. Depende de T4. |

### P2 — Backlog anterior (manter)
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
