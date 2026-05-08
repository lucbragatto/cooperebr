# Sessão claude.ai 2026-05-05 tarde — Investigação C.3 + reframe etapa 11

## 1. Sumário executivo

Sessão claude.ai tarde (~2h investigação read-only, 0 código). Investigou 2 frentes:
1. **Escopo real da Fase C.3** — confirmado como hipótese (b): título com 1 frase em 4 docs, sem decomposição em sub-tarefas.
2. **Etapa 11 (aprovação concessionária)** — corrigido erro factual da sessão da manhã. Implementação está ~80% pronta (não é gap inexistente).

Resultado: D-J-1 perde caráter de bloqueador absoluto (vira "1-2h UI admin", absorvível em C.2/C.3, mas tem 1 cooperado real travado no banco). D-J-5 nova catalogada (C.3 precisa playbook). Decisão 21 catalogada (regra de método de investigação).

Sem commits de código. 1 commit de docs no fechamento.

## 2. Achados principais

### 2.1. Fase C.3 — escopo é (b), não (a)

21 ocorrências em 7 arquivos. Apenas 4 são definição (todas com a mesma 1 frase: "Display economia em proposta + contrato + cobrança, ~1.5-2h"). Resto são referências de passagem ("C.2 → C.3 → CT").

- Sem playbook (igual Fase B.5 tinha 8 colunas ou Fase A tinha 4 commits documentados)
- Sem doc de sessão dedicado
- Sem checklist por sub-tarefa

**Implicação:** estimativa "1.5-2h" é otimista. Sem decisão de "quais 3 telas, em que posição, formatação, toggle ou sempre visível", pode virar 4h no meio do trabalho. Recomendação: 15-30 min de spec antes de virar Code (D-J-5).

### 2.2. Etapa 11 — está 80% pronta, não inexistente

| Camada | Estado real |
|---|---|
| Schema | ✅ `Cooperado.protocoloConcessionaria` (linha 125) + `StatusCooperado.AGUARDANDO_CONCESSIONARIA` (linha 232) com transições pra `APROVADO` → `ATIVO` |
| Backend | ✅ 9 callers em 5 services (cooperados, cooperativas, usinas, whatsapp-bot, whatsapp-cobranca) + `email.service.ts:116 enviarCadastroAprovado()` |
| Frontend | 🔴 Zero tela admin pra transição manual `AGUARDANDO_CONCESSIONARIA → APROVADO` |
| Docs | ⚠️ MAPA-INTEGRIDADE marca "IMPLEMENTADO MAS NÃO TESTADO" (linha 355). Auditoria Clube marca "Parcial — Transição manual pelo admin" (RELATORIO-AUDITORIA-CLUBE-VANTAGENS:29). |

**Causa do erro no relatório anterior:** `head -20` truncou matches do schema. Busca por `aprovadoConcessionaria` literal ignorou o enum de status que é o mecanismo real. Não foi falha de termo, foi falha de paginação + falha de não considerar state machine como alternativa a campo dedicado.

**Distinção regulatória descoberta:**
- `Cooperado.protocoloConcessionaria` (linha 125) = protocolo da UC do cooperado (já existe no schema)
- `Usina.dataProtocoloDistribuidora` (proposta em REGULATORIO-ANEEL.md:120) = protocolo da usina geradora (não existe — Sprint 5)

São conceitos distintos no fluxo SCEE da ANEEL. Sprint 5 ≠ resolver etapa 11.

### 2.3. Estado real no banco (cooperados em AGUARDANDO_CONCESSIONARIA)

```
Cooperados em AGUARDANDO_CONCESSIONARIA agora:
- coop=CoopereBR | total=1

Histórico transições AGUARDANDO_CONCESSIONARIA:
- Tabela historico_status_cooperado existe mas está vazia pra esse status
```

**Implicação:** etapa 11 nunca foi exercitada em produção. **1 cooperado real** travado nesse status hoje na CoopereBR — espera UI admin pra transitar pra APROVADO. Não é bug puramente teórico; é cooperado real esperando.

## 3. Decisões e correções aplicadas

### Reformulação D-J-1
- Antes: "construir aprovação concessionária 2-4h"
- Depois: "fechar UI admin de transição AGUARDANDO_CONCESSIONARIA → APROVADO, ~1-2h, absorvível em C.2/C.3 — 1 cooperado real CoopereBR já travado nesse status no banco"

### D-J-5 nova — Fase C.3 precisa playbook
Antes de virar sessão Code, decidir quais 3 telas exatas, em que parte, formatação dos 4 valores, toggle ou sempre visível. 15-30 min de spec.

### Decisão 21 — Investigação 3 frentes
Antes de afirmar "X não existe": campo literal + enum/state machine + comentários/docs. Sem truncamento de output (`head -N`).

## 4. Correções de doc aplicadas
- `docs/sessoes/2026-05-05-investigacao-jornada-e2e.md` seção 4 — etapa 11 reframada de 🔴 pra 🟡 + D-J-1 reformulada + D-J-5 adicionada na tabela
- `docs/CONTROLE-EXECUCAO.md` — D-J-1 reformulada + D-J-5 catalogada + Decisão 21 catalogada na seção "Decisões registradas" + bloco "Última sessão" atualizado pra 05/05 tarde + cadeia de sessões anteriores reorganizada

## 5. Status das D-J pendentes (atualizado)

| # | Tema (1 frase) | Status |
|---|---|---|
| D-J-1 (reformulada) | Fechar UI admin pra transição AGUARDANDO_CONCESSIONARIA → APROVADO (~1-2h, absorvível em C.2/C.3) — 1 cooperado real CoopereBR travado no banco | **Aberta — perde urgência absoluta mas tem cooperado real esperando** |
| D-J-2 | Etapa 5 (aprovação admin do plano) é intencional ou gap? | **Aberta** |
| D-J-3 | Item 4 da C.2 (CooperToken expandido) entra ou fica fora? | **Aberta — recomendação: ficar fora (trabalho condenado pelo Sprint CT)** |
| D-J-4 | Sequência C.2+C.3 juntos ou só C.3 primeiro? | **Aberta** |
| D-J-5 (nova) | Fase C.3 precisa playbook antes de virar Code (15-30 min de spec)? | **Aberta — recomendação: sim, sem spec "1.5h vira 4h"** |

5 D-J abertas. Nenhuma fechada por achados de hoje (a etapa 11 só **reformulou** D-J-1, não respondeu).

## 6. Aprendizados meta

- **Decisão 19 funcionou em parte.** Apresentação P0/P1/P2/P3 estava operacionalmente correta, mas continha erro factual herdado da sessão da manhã. Validação prévia (Decisão 14/20) pegou tarde demais — só pegou quando Luciano cobrou ("isso já está mapeado").
- **Pergunta cobrada do usuário é o melhor gate.** "O que C.3 é pra você?" e "Onde etapa 11 está mapeada?" foram as 2 perguntas que destravaram. Sem elas, claude.ai teria executado Fase C.2 reduzida + C.3 com premissas erradas.
- **`head -N` em investigação de schema é antipattern.** Schema tem 1000+ linhas; truncar pelos primeiros 20 matches descarta os mais importantes (que costumam estar em modelos centrais como Cooperado/Usina, não nos auxiliares listados primeiro).

---

## 7. Frase de retomada — próxima sessão

> Voltei. Lê `docs/CONTROLE-EXECUCAO.md` + `docs/sessoes/2026-05-05-tarde-investigacao-c3-etapa11.md`.
>
> 05/05 fechou: investigação read-only que reformulou D-J-1 (etapa 11 está 80% pronta, falta só UI admin) + catalogou D-J-5 (C.3 precisa playbook) + Decisão 21 (investigação 3 frentes).
>
> 5 D-J pendentes ainda aguardam decisão Luciano (D-J-1 a D-J-5 — ver seção 5 deste doc + CONTROLE-EXECUCAO.md).
>
> **Pergunta em aberto:** 1 cooperado real CoopereBR está em AGUARDANDO_CONCESSIONARIA hoje, sem UI admin pra destravar. Resposta de D-J-1 define se a UI entra junto da próxima sessão Code (recomendado) ou fica pra sprint isolado.
>
> Próximo passo provável: responder D-J pendentes (15-30 min cada) → C.2 reduzida + C.3 (com playbook escrito antes) + UI etapa 11 numa única sessão Code (~5-7h juntos). Ou rodar Sprint CooperToken Etapa 1 (specs, ~6-8h) em paralelo. Apresenta P0→P3 (Decisão 19) antes de propor.

### Arquivos pra ler na retomada (~15 min)

1. `docs/CONTROLE-EXECUCAO.md` — estado vivo
2. `docs/sessoes/2026-05-05-tarde-investigacao-c3-etapa11.md` (este arquivo) — fechamento de hoje + reframe etapa 11 + D-J-5
3. `docs/sessoes/2026-05-05-investigacao-jornada-e2e.md` — sessão da manhã (com correção da etapa 11 já aplicada na seção 4)
4. `docs/sessoes/2026-05-04-noite-investigacao-coopertoken.md` — Sprint CooperToken Consolidado catalogado
5. `docs/PLANO-ATE-PRODUCAO.md` — roadmap

Opcional (se for atacar Code direto):
6. `web/app/dashboard/cooperados/[id]/page.tsx` — onde adicionar UI transição AGUARDANDO_CONCESSIONARIA → APROVADO
7. `backend/src/cooperados/cooperados.service.ts` — métodos de transição já existem (linhas 765, 773, 1125)
