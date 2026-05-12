# Índice da Documentação — SISGD / CoopereBR

> Ponto de entrada canônico. Toda nova sessão (Code ou claude.ai)
> abre por aqui se não souber por onde começar.
>
> Última atualização: 2026-05-13 (Fatia H.1 — esqueleto INDEX + SISTEMA).

---

## Doc-0 — quatro documentos canônicos do projeto

| Doc | Propósito | Audiência | Status |
|---|---|---|---|
| **[CLAUDE.md](../CLAUDE.md)** (raiz) | Instruções operacionais permanentes pro Claude Code | Agente | ✅ Vivo |
| **[PRODUTO.md](PRODUTO.md)** | Visão humana do produto (o que faz, pra quem, por quê) | Luciano + parceiros + Claude | ✅ Escrito 30/04 |
| **[SISTEMA.md](SISTEMA.md)** | Mapa técnico (stack, módulos, schema, fluxos) | Code + dev novo | 🟡 Esqueleto 13/05 — preencher em ETAPA 1 (H.2) |
| **[REGULATORIO-ANEEL.md](REGULATORIO-ANEEL.md)** | Regulatório ANEEL/MME (Lei 14.300, flags, casos) | Luciano + Claude | ✅ Escrito 30/04 |

**Princípio:** se a informação cabe em 1 desses 4, vai pra lá. Não cria
documento novo na raiz `docs/` sem justificativa.

---

## Arquivos vivos (atualizam em toda sessão)

| Arquivo | Função |
|---|---|
| **[CONTROLE-EXECUCAO.md](CONTROLE-EXECUCAO.md)** | Onde paramos + Pendências (ritual abertura/fechamento) |
| **[debitos-tecnicos.md](debitos-tecnicos.md)** | Débitos D-30A..D-31 (P0/P1/P2/P3) |
| **[PLANO-ATE-PRODUCAO.md](PLANO-ATE-PRODUCAO.md)** | Roteiro de sprints até produção |
| **[MAPA-INTEGRIDADE-SISTEMA.md](MAPA-INTEGRIDADE-SISTEMA.md)** | Diagnóstico ponta a ponta dos 10 fluxos (atualizar a cada sprint) |

---

## Especificações canônicas (estáveis, raramente alteradas)

| Spec | Tema |
|---|---|
| [especificacao-clube-cooper-token.md](especificacao-clube-cooper-token.md) | CooperToken (token = desconto diferido) — §1-§10 + adendo §11 (11/05) |
| [especificacao-contabilidade-clube.md](especificacao-contabilidade-clube.md) | Contabilidade do clube/token |
| [especificacao-modelos-cobranca.md](especificacao-modelos-cobranca.md) | 3 modelos: FIXO_MENSAL / CREDITOS_COMPENSADOS / CREDITOS_DINAMICO |
| [arquitetura/gateways.md](arquitetura/gateways.md) | Adapter pattern de gateways de pagamento |
| [specs/](specs/) | Specs históricas (incluindo Fio B 26/03/2026) |

---

## Material de sessões / playbooks / relatórios

| Pasta | Conteúdo |
|---|---|
| **[sessoes/](sessoes/)** | Resumos de sessões Code e claude.ai (cronológico) |
| **[playbooks/](playbooks/)** | Playbooks executáveis (Fase C.3, etc.) |
| **[relatorios/](relatorios/)** | Investigações pontuais (auditoria 11/05, mapeamento 12/05) |
| **[historico/](historico/)** | Docs movidos pra histórico (SISGD-VISAO 26/04, etc.) |

---

## Ordem recomendada de leitura ao abrir nova sessão

1. **`CONTROLE-EXECUCAO.md`** — onde paramos + pendências P0→P3 + estado vivo
2. **Última sessão de `sessoes/`** — contexto imediato
3. **`PLANO-ATE-PRODUCAO.md`** — onde estamos no roadmap
4. **CLAUDE.md (raiz)** — regras operacionais (validação prévia, ritual abertura/fechamento)

Quando precisar de detalhe específico:
- **O que o produto faz** → `PRODUTO.md`
- **Como o sistema está construído** → `SISTEMA.md`
- **Regulatório ANEEL/MME** → `REGULATORIO-ANEEL.md`
- **Bug específico ou débito** → `debitos-tecnicos.md` (D-30A..D-31)

---

## Princípios de manutenção

1. **`INDEX.md` é índice, não conteúdo.** Aponta. Não duplica.
2. **Não criar arquivo novo na raiz `docs/` sem justificativa.** Encaixa em CLAUDE/PRODUTO/SISTEMA/REGULATORIO.
3. **Renomeações vão pra `historico/` com data.** Nada é deletado silenciosamente.
4. **Atualização do INDEX.md** sempre que um novo doc canônico aparecer.

---

*Este índice substitui `README.md` defasado (referenciava estrutura antiga `referencia/` + `changelog/`). Manter sincronizado com `CLAUDE.md` raiz quando estrutura mudar.*
