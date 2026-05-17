# Sessão 17/05/2026 — Maratona Bloco D + Mini-Sprint Bugs Usinas + Sub-Fase 1 Listas Concessionária

**Tipo:** Code (~10-12h efetivas, 15+ commits)
**Marcos:** M7 (Bloco D) + Mini-Bloco H'.9 + M9 (Mini-Sprint Bugs Usinas+Listas) + M10 **parcial** (Sub-Fase 1 Fases 1-3)

---

## TL;DR (3-5 linhas)

Três marcos consolidados em um dia: (1) Bloco D entregou 3 crons proativos do quadro 3 do txt Luciano (lembrete docs cooperado, alerta admin docs parados, lembrete email EDP) com fix de bug crítico de whitelist guard durante smoke; (2) Mini-Sprint Bugs Usinas+Listas saneou Cooperebr2 duplicada, aplicou `apelidoInterno @unique`, resolveu 4 bugs visuais + 3 anomalias de cálculo (`percentualUsina` ratio→percent + refresh dinâmico do header) e catalogou D-novo-H como decisão produto pré-aprovada da convenção MENSAL; (3) Sub-Fase 1 do Sprint Usinas+Listas Concessionária implementou esqueleto operacional do fluxo de 9 etapas — schema (2 models + 2 enums + classeGdAnotada), backend (11 endpoints multi-tenant, snapshot imutável), frontend (2 abas + página própria de criação + tela detalhe + 4 dialogs). Fase 4 da Sub-Fase 1 (trigger ativação automática + WA/email cooperado homologado) pendente pra próxima sessão.

---

## Entregas + SHAs

### Marco M7 — Bloco D (3 crons proativos)
| Commit | Escopo |
|---|---|
| `fd902af` | feat(notificacoes-proativas): módulo + service + job + 3 templates email |
| `064fdff` | fix(notificacoes-proativas): whitelist guard pre-check antes de gravar marker |
| `3234261` | docs(sessao): fechamento Bloco D + sugestão #7 observabilidade total |

### Mini-Bloco H'.9 — HIBRIDO
| Commit | Escopo |
|---|---|
| (anteriores no dia) | enum FormaPagamentoDono ganha HIBRIDO + DTO @ValidateIf cruzado |

### Marco M9 — Mini-Sprint Bugs Usinas+Listas
| Commit | Escopo |
|---|---|
| `085ae53` | fix(usinas): saneia Cooperebr2 duplicada + apelidoInterno @unique |
| `4876829` | fix(usinas): listagem mostra id curto + createdAt |
| `a31cbe7` | fix(migracoes-usina): UX dual %/kWh + guards + ratio→percent + refresh header |
| `54f336c` | docs(debitos+controle): D-novo-H convenção MENSAL + fechamento mini-sprint |
| `ef318be` | docs(sessao): fechamento canônico mini-sprint Bugs Usinas+Listas |

### Marco M10 (parcial) — Sub-Fase 1 Sprint Usinas+Listas Concessionária
| Commit | Escopo |
|---|---|
| `56b8fee` | feat(envio-lista): Sub-Fase 1 Fases 1+2 — schema delta + module backend (11 endpoints + 5 DTOs + 11 métodos) |
| `12faf3f` | feat(envio-lista): Sub-Fase 1 Fase 3 — frontend abas + telas + dialogs (10 arquivos) |
| `ad0022e` | fix(contratos): tabela responsiva — overflow-x-auto + larguras + truncate |

---

## Bugs resolvidos hoje

### Bloco D
- **Whitelist guard false-positive (P1):** primeiro smoke gravou 72 markers `lembrete_edp:1` em dev sem enviar emails. Fix: pre-check `podeEnviarEmDev(email, 'EMAIL') && podeEnviarEmDev(telefone, 'WA')` antes de gravar marker. Script `reverter-marker-edp-smoke-d.ts` limpou os 72 false-positives. Segundo smoke 9/9 PASS.

### Mini-Sprint Bugs Usinas+Listas
| # | Bug | Sev | Fix |
|---|---|---|---|
| 1 | Confusão visual Cooperebr2 duplicada | P1 | DELETE da duplicada + `@unique` em `apelidoInterno` + UI mostra `id.slice(0,8)+createdAt` |
| 2 | 500 em `POST /migracoes-usina/ajustar-kwh` | P1 | Guard `if (!dto.cooperadoId) throw BadRequest` antes de findUnique |
| 3 | Input ambíguo %/kWh inline | P2 UX | 2 inputs separados mutuamente exclusivos com labels claras |
| 3.regr | OK não disparava após Fase 7 | P1 | `usinas.service.ts:518` expõe `cooperadoId+contratoId+ucId` no shape |
| 4 | React keys duplicadas (cooperado multi-UCs) | P2 | `key=${cooperadoId}_${ucNumero}` composta |
| Anom.1 | `percentualUsina=0.22` em vez de 22 | P2 cálc | `Math.round(x*10000)/100` (em vez de `/10000`) em `ajustarKwh:362` E `migrarCooperado:160` |
| Anom.3 | Header não recalculava sem F5 | P2 UX | Helper `recarregarCooperadosAlocados()` substituído nos 4 callsites |

### Sub-Fase 1 (Fase 3)
- **Dialog "Novo envio" apertado:** inviável pra usinas com 50-100 cooperados. **Fix UX:** convertido em página própria `/dashboard/listas-concessionaria/novo?usinaId=X` (padrão UX Tipo B), DialogNovoEnvio.tsx deletado.
- **Tabela `/dashboard/contratos` estourando:** "EIRO SPE LTDA" cortado. Fix: `overflow-x-auto` + `min-w-[1200px]` + larguras por coluna + `truncate` com tooltip.

---

## Débitos novos catalogados hoje

| ID | Severidade | Resumo |
|---|---|---|
| **D-novo-H** | P1 estratégico | Refator técnico convenção `capacidadeKwh` MENSAL — decisão produto pré-aprovada (memória `decisao_convencao_mensal_oficial_17_05.md`), ~6-8h Code |
| **D-novo-I** | P3 UX | Timezone bug em datas — "Protocolada em 16/05 com hora 21:00" exibe 1 dia atrás em alguns timezones. Investigar render `toLocaleDateString` vs UTC |

---

## Débitos resolvidos hoje

Nenhum débito **já catalogado** foi resolvido. Sessão foi reativa a bugs e implementação nova.

---

## Decisões catalogadas (9 memórias novas)

1. **`principio_multi_tenant_templates_17_05.md`** — templates documentos com CNPJ em branco pra preenchimento contextual por parceiro
2. **`decisao_modulo_contabilidade_tributaria_17_05.md`** — Sprint Contabilidade Tributária Segregada aprovado (61h, posição #8 roadmap)
3. **`mini_bloco_h_linha_9_hibrido_17_05.md`** — HIBRIDO no enum FormaPagamentoDono (FIXO + PERCENTUAL juntos)
4. **`regra_nao_trabalhar_paralelo_com_code_17_05.md`** — claude.ai NÃO trabalha em paralelo com Code; aguarda reporte antes de próximo prompt
5. **`spec_modulo_listas_concessionaria_17_05.md`** — spec funcional fluxo 9 etapas concessionária
6. **`pausa_bloco_b_sprint_usinas_listas_17_05.md`** — save state Bloco B + escopo Sprint Usinas+Listas
7. **`padrao_ux_edicao_inline_vs_pagina_propria_17_05.md`** — padrão UX dual Tipo A/B/C (inline célula × página própria × dialog focado)
8. **`decisao_convencao_mensal_oficial_17_05.md`** — convenção MENSAL é oficial do SISGD (capacidadeKwh + producaoMensalKwh + kwhContrato)
9. **`spec_subagent_qa_funcional_17_05.md`** — spec do subagent project-specific cooperebr-qa-funcional

---

## Subagent criado

`~/.claude/agents/cooperebr-qa-funcional.md` — project-specific QA funcional. Disponível pra **primeira ronda QA na próxima sessão** validando todo o trabalho de 17/05 (Bloco D + Mini-Sprint Bugs + Sub-Fase 1 Fases 1-3).

---

## Pendências abertas próxima sessão

**Ordem prioritária:**

1. **PRIMEIRA RONDA QA via subagent** `cooperebr-qa-funcional` — validar tudo de 17/05 (Bloco D crons + Mini-Sprint Bugs Usinas+Listas + Sub-Fase 1 Listas Concessionária Fases 1-3). Reportar bugs/regressões antes de prosseguir.
2. **Sub-Fase 1 Fase 4** — trigger ativação automática `Contrato.status PENDENTE_ATIVACAO → ATIVO` quando `EnvioListaCooperado.statusIndividual = HOMOLOGADO` + EventEmitter `cooperado-homologado` + listener WA + email cooperado (2-3h Code). Aplicar `regra_contato_teste_impreterivel` no smoke.
3. **Sub-Fase 1 Fase 5** — tests Jest cooper-token-equivalente do envio-lista + docs + commits + push (3-5h)
4. **Bloco B Etapa 1 Fase 2** — escrita 13 specs Jest cooper-token PAUSADO (6-8h)
5. **Sprint D-novo-H** — refator convenção MENSAL (6-8h, decisão produto pré-aprovada)
6. **Bloco E** — Realocação Multi-Usina N↔M inteligente (16-24h)
7. **D-novo-I** — timezone bug datas (P3)
8. **Bloco F** — Automação Concessionária (24-32h, complementa Sub-Fase 1)
9. **Bloco G** — Sprint Assinafy (12-16h)
10. **Sprint Módulo Documentos** (46h)
11. **Sprint Contabilidade Tributária Segregada** (61h)
12. **Sprint Módulo Compliance** (108h, post-AGE 17/06/2026)

---

## Próximo passo único e claro

**Invocar subagent `cooperebr-qa-funcional` no início da próxima sessão Code** pra primeira ronda QA validando o trabalho de 17/05. Após relatório + decisão Luciano sobre fixes, retomar **Sub-Fase 1 Fase 4** (trigger ativação automática + WA/email cooperado homologado, 2-3h Code).

---

## Frase comandante (atualizada em CONTROLE-EXECUCAO via Decisão 24)

> Sessão maratona 17/05/2026 fechada com 3 marcos (M7 Bloco D, M9 Mini-Sprint Bugs Usinas+Listas, M10 parcial Sub-Fase 1 Listas Concessionária Fases 1-3). **Próxima sessão Code arranca invocando subagent `cooperebr-qa-funcional` pra primeira ronda QA** — validar Bloco D crons + Mini-Sprint Bugs Usinas+Listas + Sub-Fase 1 Listas Concessionária Fases 1-3. Após relatório QA + decisão Luciano sobre fixes, retomar **Sub-Fase 1 Fase 4** (trigger ativação automática + WA/email cooperado homologado, 2-3h Code, aplicar `regra_contato_teste_impreterivel`). Memórias novas catalogadas em `~/.claude/projects/.../memory/` (9 arquivos do dia 17/05). Subagent `~/.claude/agents/cooperebr-qa-funcional.md` disponível.
