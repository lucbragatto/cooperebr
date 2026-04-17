# PONTO DE RETOMADA — CoopereBR
> Salvo em 16/04/2026 — fim da sessão

## ESTADO ATUAL

### Sprints concluídos
| Sprint | Tarefas | Commits chave |
|---|---|---|
| Sprint 1 | T1, T7, T6, T2+T8 | b296316 → f296f34 |
| Sprint 2 | T3 (4 partes) + T0 (7 steps) | bb646e9 → 3acb013 |
| Sprint 2.5 | T9, T9b, T10 | 8f1c985 → 4ff48d2 |
| Sprint 3 | T4-PRE + T4 | 1f59ae0 → 0b00d49 |
| Sprint 3.5 | Fixes wizard + portal UCs + motor | 5e9c87e → último commit de hoje |

### Último commit
Verificar com: git log --oneline -1

---

## PRÓXIMO PASSO — Sprint 4

### Contexto das decisões de hoje

**Motor de Proposta — refatoração de arquitetura:**
- Desconto sai do motor → vai para os Planos
- Motor passa a usar plano.descontoBase obrigatoriamente
- Sem plano selecionado → erro explícito (não usar fallback silencioso)
- Motor mantém: threshold outlier, fonte kWh, ações acima/abaixo da média

**Consumo Mínimo Faturável (já existe na tela, não impacta cálculo ainda):**
- Se ativado: deduzir o mínimo faturável (30/50/100 kWh por tipo de
  fornecimento) do consumo considerado na proposta e na cobrança
- Tipo de fornecimento vem do OCR (monofásico/bifásico/trifásico)
- Aparece discriminado na cobrança: "Mínimo faturável deduzido: 100 kWh"

**Bandeira Tarifária (a implementar na cobrança mensal):**
- NÃO impacta proposta (média histórica já inclui períodos com bandeira)
- Impacta COBRANÇA MENSAL quando contrato já está ativo
- Cálculo ANEEL: valorBandeira = (kwhConsumido / 100) × tarifaBandeira
- Valores vigentes 2026:
  - Verde: R$ 0,00
  - Amarela: R$ 1,885 / 100 kWh
  - Vermelha P1: R$ 4,463 / 100 kWh
  - Vermelha P2: R$ 7,877 / 100 kWh
- Admin configura: tipo + valor + período (data início/fim)
- Se mês pegar período parcial: pro-rata por dias
- Aparece discriminado na fatura do cooperado
- Histórico completo para relatórios e auditorias
- Schema necessário: model BandeiraTarifaria {
    tipo: String (VERDE|AMARELA|VERMELHA_P1|VERMELHA_P2)
    valorPor100Kwh: Decimal
    dataInicio: DateTime
    dataFim: DateTime
    cooperativaId: String
  }

### Tarefas Sprint 4 (em ordem)
1. Schema: adicionar BandeiraTarifaria + consumoMinimoKwh em ConfiguracaoMotor
2. Motor: remover campos de desconto, usar plano.descontoBase obrigatório
3. Tela config motor: remover campos desconto, adicionar consumoMinimoKwh
4. Cobrança mensal: aplicar consumo mínimo faturável + bandeira tarifária
5. Fatura cooperado: exibir bandeira discriminada
6. Planos: garantir que descontoBase é obrigatório e usado pelo motor

---

## DÍVIDAS TÉCNICAS DOCUMENTADAS

1. `aceitar()` — proteção completa depende de T0 persistir PENDENTE
2. `POST /cooperados/cadastro-completo` — deprecar
3. Rota `/proposta/:id/enviar-assinatura` — nome desatualizado
4. `enviarAprovacao()` — ainda faz console.log sem envio real
5. `tokenAssinatura` não exposto no portal
6. Rota `/dashboard/configuracoes/documentos` não linkada no menu
7. `/planos/ativos` ainda @Public() sem ler JWT quando autenticado
8. BUG-CALCULO-001: multa/juros 3 implementações divergentes

---

## ENV VARS OBRIGATÓRIAS

DATABASE_URL, DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY,
WHATSAPP_WEBHOOK_SECRET, ASAAS_API_KEY, ANTHROPIC_API_KEY,
NEXT_PUBLIC_MODO_TESTE, NOTIFICACOES_ATIVAS=true,
CADASTRO_VALIDACOES_ATIVAS=true, NEXT_PUBLIC_CADASTRO_V2=true,
CADASTRO_V2_ATIVO=true

---

## BRIEFING PARA NOVA SESSÃO

Você é um engenheiro sênior trabalhando no CoopereBR.
Leia CONTEXTO-CLAUDEAI.md e SPRINT-BACKLOG-COMPLETO.md antes
de qualquer ação.

Contexto:
- Sprints 1, 2, 2.5, 3 e 3.5 concluídos
- Próximo: Sprint 4 — refatoração motor + bandeira tarifária
- Ver seção "PRÓXIMO PASSO" acima para decisões de arquitetura já tomadas

Regras:
- Dados reais em banco — NÃO disparar WA/email
- Multi-tenant obrigatório
- Commits em português
- Uma tarefa por vez
