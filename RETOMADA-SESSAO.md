# PONTO DE RETOMADA — CoopereBR
> Salvo em 16/04/2026 — para retomar na próxima sessão

---

## ESTADO ATUAL

### Sprints concluídos
| Sprint | Tarefas | Commits chave |
|---|---|---|
| Sprint 1 | T1, T7, T6, T2+T8 | b296316 → f296f34 |
| Sprint 2 | T3 (4 partes) + T0 (7 steps) | bb646e9 → 3acb013 |
| Sprint 2.5 | T9, T9b, T10 | 8f1c985 → 4ff48d2 |
| Sprint 3 | T4-PRE + T4 | 1f59ae0 → 0b00d49 |

### Último commit
`0b00d49` — docs: marcar Sprint 3 (T4-PRE + T4) como concluídos

### Feature toggles em produção
| Env var | Valor prod | Propósito |
|---|---|---|
| `CADASTRO_VALIDACOES_ATIVAS` | `true` | Validar CPF/email/telefone no cadastro público |
| `NOTIFICACOES_ATIVAS` | `true` | Disparar WA/email no fluxo aceite/docs/assinatura |
| `CADASTRO_V2_ATIVO` | `true` | Cadastro público cria Cooperado+UC+Proposta real (v2) |

---

## PRÓXIMO PASSO

Não há Sprint 4 definido no backlog atual.
Candidatos para próxima sessão (por prioridade):

**P2 — Importantes (backlog original):**
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
