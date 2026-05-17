# Sessão 17/05/2026 noite — Mini-Sprint Bugs Usinas+Listas

**Tipo:** Code (10 fases sequenciais + 4 commits + push + fechamento canônico)
**Duração:** ~3-4h efetivas
**Marco:** **M9 — Mini-Sprint Bugs Usinas+Listas FECHADO**

---

## TL;DR (3-5 linhas)

Quatro bugs visíveis em `/dashboard/usinas` foram resolvidos: (1) duplicação `apelidoInterno='cooperebr2'` saneada via DELETE da usina de teste + schema `@unique` impede recorrência; (2) erro 500 no `ajustar-kwh` causado por `cooperadoId` undefined sem guard no service; (3) UX inline ambígua substituída por 2 inputs separados (% Usina / kWh/mês); (4) React keys duplicadas com cooperado em múltiplas UCs corrigidas com chave composta. Investigação pós-fix revelou 3 anomalias adicionais — `percentualUsina` gravado como ratio (0.22) em vez de percent (22), header "Capacidade utilizada" não recalculava após PATCH, e convenção polissêmica `capacidadeKwh` MENSAL vs ANUAL no sistema. Decisão Luciano: oficializar **convenção MENSAL** como universal, mas refator dedicado (D-novo-H, ~6-8h) fica em sprint próprio.

---

## Entregas + SHAs

| Commit | Escopo |
|---|---|
| `085ae53` | Saneamento Cooperebr2 duplicada + `apelidoInterno @unique` |
| `4876829` | UI distinguir entidades — listagem com id curto + createdAt |
| `a31cbe7` | Bugs 2/3/4 + 3 anomalias pós-fix (UX dual + guards + ratio→percent + refresh header) |
| `54f336c` | Docs: D-novo-H catalogado + CONTROLE-EXECUCAO fechamento mini-sprint |

Push em `origin/main` 17/05/2026 noite.

---

## Bugs resolvidos

| # | Bug | Severidade | Root cause | Fix |
|---|---|---|---|---|
| **1** | Confusão visual entre 2 usinas mesmo nome (Cooperebr2) | P1 | Schema sem `@unique` em `apelidoInterno` + UI sem id/timestamps | DELETE duplicada (zero deps confirmadas) + `@unique` + UI exibe `id.slice(0,8)` + `createdAt` na listagem + 3 badges no header detalhe |
| **2** | 500 em `POST /migracoes-usina/ajustar-kwh` | P1 | Controller `@Body() body: any` sem DTO + frontend dispara com `cooperadoId=undefined` em alguns cenários | Guard `if (!dto.cooperadoId) throw BadRequestException` antes do `findUnique` em `ajustarKwh` E `migrarCooperado` |
| **3** | Input numérico inline ambíguo (% ou kWh?) | P2 UX | UI tinha 1 input só pra % | 2 inputs com labels explícitas (% Usina / kWh/mês), mutuamente exclusivos |
| **3.regressão** | OK não dispara request pós-Fase 7 | P1 | Shape de `/usinas/:id/lista-concessionaria` não expunha `cooperadoId` | `usinas.service.ts:518` adicionou `cooperadoId`, `contratoId`, `ucId` no map do shape |
| **4** | React keys duplicadas em selects | P2 | `key={c.cooperadoId}` em arrays onde cooperado tem múltiplas UCs/contratos | `key={`${cooperadoId}_${ucNumero}`}` composta em 2 selects |
| **Anomalia 1** | `percentualUsina=0.22` em vez de 22 após ajuste | P2 cálculo | `Math.round(x * 10000) / 10000` gravava ratio em vez de percent | `Math.round(x * 10000) / 100` em `ajustarKwh:362` E `migrarCooperado:160` |
| **Anomalia 3** | Header "Capacidade utilizada" não atualiza pós-PATCH | P2 UX | `setCapacidadeInfo` só era chamado no useEffect inicial | Helper `recarregarCooperadosAlocados()` recarrega lista + recalcula `capacidadeInfo`. Substituído nos 4 callsites |

---

## Débitos novos catalogados

### D-novo-H — Refator técnico convenção `capacidadeKwh` MENSAL (P1 estratégico, ~6-8h)

**Decisão produto Luciano:** convenção MENSAL é universal no SISGD (memória `decisao_convencao_mensal_oficial_17_05.md`).

**Diagnosticado pela auditoria Fase 4.5 read-only ampliada:**
- `usinas.service.ts:418-451` + 4 usinas reais (Linhares 1/2, Solar Norte/Sul) seguem MENSAL ✅
- `contratos.service.ts:60-63` (comentário "anual" literal) + `migracoes-usina.service.ts` (ajustarKwh + migrarCooperado) + 2 usinas legado (Solar Guarapari 600k, Solar Serra 480k) tratavam como ANUAL ❌
- `motor-proposta` + `cobrancas` neutros (não usam `capacidadeKwh`)

**Sprint dedicado:** 6 passos (auditoria SQL + migração dados + refator backend 3-4h + UI labels + smoke E2E + docs). Não bloqueia operação atual — workaround mental do admin (sistema entrega 1/12 do esperado em `kwhContrato`). Catalogado em `docs/debitos-tecnicos.md`.

---

## Débitos resolvidos nesta sessão

Nenhum débito **já catalogado** foi resolvido — esta sessão foi reativa a bugs visuais descobertos hoje 17/05.

---

## Bugs descobertos durante validação

Capturados durante auditoria Fase 4.5 — todos catalogados como D-novo-H acima:
- Solar Guarapari (600.000 kWh) + Solar Serra (480.000 kWh) têm `capacidadeKwh` cadastrado em formato **ANUAL** (12× da `producaoMensalKwh`). 2 usinas de seed/teste.
- `contratos.service.ts:60-63` tem **comentário literal contradizendo a convenção real** ("capacidadeKwh da usina = capacidade anual").
- 5 contratos com `percentualUsina < 1%` na auditoria — todos LEGÍTIMOS (não corrompidos), só percentuais reais baixos (THEOMAX 0.762%, ALMIR 0.7073%, CAROLINA 0.0973%, LUCIANA 0.6667%, DIEGO 0.3267%).

---

## Pendências abertas próxima sessão

1. **Sprint Usinas+Listas Concessionária Sub-Fase 1** (18-26h Code, próximo) — aguardando OK Luciano com respostas das **10 perguntas decisórias** da Fase 1 read-only ampla (granularidade envio lote/individual, status por cooperado vs por usina, trigger automático contrato pós-homologação, polling EDP escopo, classGd opcional, módulo novo vs reusar migracoes-usina, periodicidade EDP-ES, formato CSV EDP, dependência Sprint 5 regulatório, conflito Bloco E)
2. **Bloco B Etapa 1 Fase 2** (escrita 13 specs Jest cooper-token, 6-8h) PAUSADO desde 17/05 — retomar após Sprint Usinas+Listas
3. **D-novo-H — refator convenção MENSAL** (~6-8h, P1 estratégico)
4. **Saneamento Exfishes definitivo** — Luciano ajustou pra 21.02% durante smoke; valor final correto via UI pós-D-novo-H

---

## Decisões catalogadas

| # | Decisão | Origem | Memória |
|---|---|---|---|
| 1 | Convenção MENSAL é universal no SISGD | 17/05 noite | `decisao_convencao_mensal_oficial_17_05.md` |
| 2 | Mini-sprint NÃO toca semântica mensal/anual — fica pra D-novo-H dedicado | 17/05 noite | (esta doc + D-novo-H em debitos-tecnicos.md) |
| 3 | Padrão UX dual edição (inline célula × página própria × dialog focado) — aplicar futuro Sprint Refator UX | 17/05 noite anterior | `padrao_ux_edicao_inline_vs_pagina_propria_17_05.md` |
| 4 | Saneamento Cooperebr2 mantém antiga `cmp8fkxvt0001valkj8utb8vr` (HOMOLOGADA, Exfishes alocada), deleta nova `cmp9pncx30000vaiwh5eyps2g` (teste) | 17/05 noite | `pausa_bloco_b_sprint_usinas_listas_17_05.md` |

---

## Bilateral (claude.ai ↔ Code)

Sessão claude.ai entregou (paralelamente):
- Agente `cooperebr-qa-funcional.md` criado em `~/.claude/agents/` (validado via `ls`)

Code aplicou:
- Backend 2 linhas fix + 2 guards adicionais
- Frontend helper `recarregarCooperadosAlocados()` + 4 callsites refatorados
- Schema `@unique`
- 3 scripts read-only de auditoria (Cooperebr2, percentual corrompido, mensal/anual)
- 1 script de saneamento (delete Cooperebr2 nova)
- D-novo-H catalogado
- CONTROLE-EXECUCAO atualizado
- 4 commits + push

---

## Próximo passo único e claro

**Sprint Usinas+Listas Concessionária Sub-Fase 1** (18-26h Code, 5 fases). Code aguarda Luciano responder as **10 perguntas decisórias** da Fase 1 read-only ampla (relatório acima na conversa Code) antes de prosseguir.

---

## Frase comandante (atualizar CONTROLE-EXECUCAO)

> Mini-Sprint Bugs Usinas+Listas FECHADO 17/05 noite (Marco M9, 4 commits `085ae53`+`4876829`+`a31cbe7`+`54f336c` pushed). 4 bugs visuais + 3 anomalias pós-fix + saneamento Cooperebr2 + schema @unique entregues. **Próximo:** Sprint Usinas+Listas Concessionária **Sub-Fase 1** (esqueleto operacional 18-26h: schema `EnvioListaConcessionaria` + `EnvioListaCooperado` + status individual + backend service multi-tenant + frontend 2 abas + trigger pós-homologação + tests). Ler primeiro `~/.claude/projects/C--Users-Luciano-cooperebr/memory/pausa_bloco_b_sprint_usinas_listas_17_05.md` + `decisao_convencao_mensal_oficial_17_05.md`. **AGUARDA OK Luciano** com respostas das 10 perguntas decisórias da Fase 1 read-only ampla (granularidade envio, status por cooperado, trigger ativação, polling EDP escopo, classGd opcional, módulo novo vs reusar, periodicidade, CSV formato, dep Sprint 5, conflito Bloco E). NÃO INICIAR Fase 2 implementação sem OK explícito. D-novo-H (refator MENSAL ~6-8h) catalogado — não bloqueia Sub-Fase 1.
