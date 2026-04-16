# PONTO DE RETOMADA — CoopereBR
> Salvo em 16/04/2026 — sessão 2

---

## ESTADO ATUAL

### Sprints concluídos
| Sprint | Tarefas | Commits chave |
|---|---|---|
| Sprint 1 | T1, T7, T6, T2+T8 | b296316 → f296f34 |
| Sprint 2 | T3 (4 partes) + T0 (7 steps) | bb646e9 → 3acb013 |
| Sprint 2.5 | T9, T9b, T10 | 8f1c985 → 4ff48d2 |
| Sprint 3 | T4-PRE + T4 | 1f59ae0 → 0b00d49 |
| Sprint 3.5 | Fixes wizard + portal UCs | c0153a9 → 4b271d9 |

### Último commit
`4b271d9` — fix: Step1 labels de tarifa mais claros (OCR vs motor)

### Commits desta sessão (16/04/2026)
| Commit | O que foi feito |
|---|---|
| `5e9c87e` | fix: nav bar portal (9→5 itens + links rápidos na home) |
| `90ef79c` | fix: Step2 nunca herdar dados de cooperado anterior (nullish coalescing) |
| `a1bfb49` | fix: Step2 pré-preencher com dados OCR sobrescrevendo valores anteriores |
| `c0153a9` | fix: tratar email duplicado (409) + labels dinâmicos no wizard admin |
| `a5f7a38` | feat: endpoint nova-uc-com-fatura e confirmar-nova-uc para cooperado |
| `cb100ae` | feat: portal UCs — modal 3 etapas com OCR + simulação + contrato |
| `ec3af81` | feat: motor aceitar planoId e baseDesconto no calcular() |
| `8f9c0ef` | feat: Step3 recalcular ao trocar plano com desconto real do plano |
| `4b271d9` | fix: Step1 labels de tarifa mais claros (OCR vs motor) |

### Feature toggles em produção
| Env var | Valor prod | Propósito |
|---|---|---|
| `CADASTRO_VALIDACOES_ATIVAS` | `true` | Validar CPF/email/telefone no cadastro público |
| `NOTIFICACOES_ATIVAS` | `true` | Disparar WA/email no fluxo aceite/docs/assinatura |
| `CADASTRO_V2_ATIVO` | `true` | Cadastro público cria Cooperado+UC+Proposta real (v2) |

---

## PRÓXIMO PASSO

Candidatos Sprint 4 (por prioridade):

**P1 — Testar fluxos end-to-end:**
- Testar fluxo completo wizard admin do Step1 ao Step7 com cooperado real
- Testar portal UCs com upload de fatura real (modal 3 etapas)

**P2 — Bugs e features:**
- BUG-CALCULO-001: multa/juros com 3 implementações divergentes
- Lembrete assinatura pendente (24h sem assinar → WA + email)
- Rebalanceamento de usinas (algoritmo + aprovação admin)

**Dívidas técnicas documentadas:**
1. `aceitar()` — proteção completa depende de T0 persistir PENDENTE em calcular()
2. `POST /cooperados/cadastro-completo` — não mais usado pelo wizard, deprecar
3. Rota HTTP `/proposta/:id/enviar-assinatura` — nome desatualizado vs handler
4. `enviarAprovacao()` — ainda faz console.log sem envio real
5. `tokenAssinatura` não exposto no portal — link direto depende de adicionar propostas ao GET /cooperados/meu-perfil
6. Rota `/dashboard/configuracoes/documentos` não linkada no menu lateral
7. `/planos/ativos` ainda @Public() sem ler JWT quando autenticado

---

## BRIEFING PARA NOVA SESSÃO

Ao iniciar, ler:
- `CONTEXTO-CLAUDEAI.md` — arquitetura, regras, commits recentes
- `SPRINT-BACKLOG-COMPLETO.md` — tarefas concluídas e pendentes
- Este arquivo — estado consolidado

Regras da sessão:
- ⚠️ Dados reais em banco — NÃO disparar WA, email ou notificações
- Multi-tenant obrigatório em tudo
- Commits em português
- Uma tarefa por vez — propõe → aprova → executa
