# Sessão 2026-05-05 manhã — Investigação jornada ponta-a-ponta + escopo real C.2

## 1. Sumário executivo

Sessão sem código. **3 investigações read-only** que reformularam o plano de execução:

1. Validação da análise claude.ai sobre próximo passo (C.2/C.3/CT/decisões batch).
2. Mapeamento literal do escopo da Fase C.2 (texto exato + sub-itens).
3. **Mapeamento da jornada ponta-a-ponta do cooperado em 14 etapas** (frontend × backend × E2E).

**Achado central:** jornada NÃO está fechada. 4 gaps detectados — 2 deles podem ser bloqueadores reais antes de C.2/C.3.

## 2. Achados de produto

### Caveat sobre Fase C.2 — item 4 condenado

`/dashboard/planos/[id]/page.tsx` (linhas 124-173) **já tem os 6 campos CooperToken** no state, load e payload. O item "CooperToken expandido (6 campos)" da C.2 não é "criar do zero" — é polir UX do que existe.

Mas o **Sprint CooperToken Consolidado** (catalogado em 04/05 noite) vai **remover 10 desses campos do `Plano`** e mover pra `ConfigCooperToken`. Logo, qualquer polimento de UI feito no item 4 da C.2 vira código pra deletar.

**Recomendação:** C.2 reduzida (5 itens, **sem item 4**) — tira o trabalho condenado e foca em entregas que ficam (promo, vigência, lista enriquecida, confirmação, simulação 2 fases).

### Validação que 4 valores de economia NÃO aparecem hoje

Grep confirmou: `valorEconomiaMes`, `valorEconomiaAno`, `valorEconomia5anos`, `valorEconomia15anos` aparecem **só em 4 arquivos de simulação interna** (`simular-plano.ts`, spec, `CombinacaoAtual.tsx`, `PlanoSimulacao.tsx`).

Zero referência em `web/app/dashboard/contratos/`, `cobrancas/`, ou portal cooperado. **Cooperado realmente não vê os 4 valores.**

C.3 entrega esse display em 3 telas (proposta + contrato + cobrança) — backend já preenche tudo, é só frontend. ~1.5-2h.

## 3. Mapeamento da jornada ponta-a-ponta — 14 etapas

| # | Etapa | Frontend | Backend | E2E |
|---|-------|----------|---------|-----|
| 1 | Cadastro público | ✅ /cadastro | ✅ /publico | 🟡 |
| 2 | Upload fatura no cadastro | ✅ | ✅ /faturas+OCR | 🟡 |
| 3 | Geração de proposta (auto pós-cadastro) | ✅ | ✅ motor-proposta | 🟡 |
| 4 | Aceite proposta — Caminho A público | ✅ /portal/assinar/[token] | ✅ aceitar() | 🟡 |
| 4 | Aceite proposta — Caminho B admin | ✅ Step4Proposta | ✅ aceitar() | ✅ |
| 5 | **Aprovação admin do plano** | 🔴 não existe | 🔴 vai direto p/ contrato | 🔴 |
| 6 | Upload docs pessoais | ✅ Step5Doc + /portal/documentos | ✅ /documentos | 🟡 |
| 7 | Geração de contrato (pós-aceite) | ✅ Step6Contrato | ✅ aceitar()→Contrato | ✅ |
| 8 | Validação admin (status APROVADO) | ✅ /dashboard/cooperados/[id] | ✅ /cooperados | ✅ |
| 9 | **Lista de espera (sem rota dedicada)** | 🟡 mistura Step7+cooperados | ✅ usinas.service | 🟡 |
| 10 | Alocação em usina | ✅ Step7Alocacao | ✅ usinas.service | ✅ |
| 11 | **Aprovação concessionária** | 🔴 não há tela | 🔴 sem campo no schema | 🔴 |
| 12 | Confirmação créditos compensados — Caminho A OCR | ✅ /dashboard/faturas | ✅ faturas+OCR | 🔴 nunca rodou em prod |
| 12 | Confirmação créditos compensados — Caminho B manual | ✅ /dashboard/cobrancas | ✅ cobrancas | ✅ 31 cobr. PAGAS sandbox |
| 13 | Geração de cobrança (cron) | ✅ /dashboard/cobrancas | ✅ cobrancas.job (4 crons) | ✅ |
| 14 | Envio fatura/cobrança (Asaas+email+WA) | ✅ | ✅ asaas+email+whatsapp | ✅ Caminho B sandbox |

**Notas factuais:**
- Schema linhas 836-844 (`aprovadoEm`/`aprovadoPor`/`modoAprovacao`) são da PROPOSTA (aprovação remota WA/email/presencial), NÃO da concessionária.
- Schema linhas 752-753 são de `TarifaConcessionaria` (aprovação de tarifa pelo admin), NÃO do cooperado.
- Etapa 11 conforme jornada listada por Luciano **está mapeada parcialmente** — ver correção 2026-05-05 tarde abaixo.

> **CORREÇÃO 2026-05-05 tarde:** O parágrafo acima e a tabela da etapa 11 originalmente diziam "🔴 inexistente no schema atual". Investigação posterior revelou erro factual: schema TEM `Cooperado.protocoloConcessionaria` (linha 125) + `StatusCooperado.AGUARDANDO_CONCESSIONARIA` (linha 232), backend TEM 9 callers em 5 services + `email.service.ts:116 enviarCadastroAprovado()`. Falta APENAS UI admin de transição manual. Reframe: etapa 11 é 🟡 (parcial), não 🔴 (inexistente). Causa do erro original: `head -20` truncou matches do schema. Detalhe completo em `docs/sessoes/2026-05-05-tarde-investigacao-c3-etapa11.md`.

## 4. Decisões pendentes Luciano (urgentes pra desbloquear C.2/C.3)

> **NOTA 2026-05-05 tarde:** D-J-1 reformulada após investigação que corrigiu etapa 11. D-J-5 nova catalogada.

| Decisão | Opções | Impacto |
|---|---|---|
| **D-J-1 (reformulada): Fechar UI admin pra transição AGUARDANDO_CONCESSIONARIA → APROVADO?** | (a) Fazer agora (~1-2h, absorvível em C.2/C.3 — 1 cooperado real CoopereBR já travado nesse status no banco); (b) Adiar até canário | Médio — perde caráter de bloqueador, mas tem cooperado real esperando |
| **D-J-2: Etapa 5 (aprov. admin do plano) é intencional ou gap?** | (a) Intencional (aceite direto sem revisão) → confirmar e seguir; (b) Gap → adicionar fluxo (~1-2h) | Médio |
| **D-J-3: Item 4 da C.2 (CooperToken expandido) entra ou fica fora?** | (a) Entra → 30-60 min trabalho condenado; (b) Fica fora → C.2 vira 5 itens sem desperdício | Pequeno mas evitável |
| **D-J-4: Sequência C.2 → C.3 vs C.3 primeiro?** | (a) C.2+C.3 juntos ~3-5h (com D-J-3=b); (b) Só C.3 ~1.5-2h se hoje pouco tempo | Pequeno |
| **D-J-5 (nova 05/05 tarde): Fase C.3 precisa playbook antes de virar Code?** | (a) Sim — 15-30 min de spec (quais 3 telas exatamente, em que parte, formatação dos 4 valores); (b) Não — ir direto e ajustar no caminho | Pequeno mas sub-dimensionar é risco |

## 5. Estimativas até produção real (recalculadas)

**Caminho otimista — primeira receita CoopereBR via Caminho B Asaas produção:**
- C.2 reduzida (5 itens) + C.3: **~3-5h Code**
- Resolver D-J-1, D-J-2 conforme respostas (0-4h)
- Backfill 72 contratos legados (only-if-needed): **30 min**
- Canário 1 cooperado real CoopereBR: **2-4h**
- Asaas conta produção (operacional): **1-2 dias**
- Asaas integração + desativar BLOQUEIO_MODELOS_NAO_FIXO: **2-3h Code + 15 min**

**Total otimista: ~12-20h Code + 1-2 semanas operacional.**

**Caminho realista (CoopereBR pronto + base regulatória):**
- Otimista + Sprint CooperToken Consolidado (14-18h) + Sprint 0 Regulatório (1 semana)

**Total realista: ~30-40h Code + 3-4 semanas calendário.**

**NÃO inclui** Sprints 1-9 da pilha pré-produção (17-23 semanas), que são pra "produção plena com Sinergia + 3º parceiro", não pra primeira receita.

## 6. Aprendizados meta

- **Mapear jornada ponta-a-ponta antes de propor C.X é barato e valioso.** Sem isso, claude.ai e Code escolheriam C.2 sem ver que etapa 11 pode ser bloqueador maior.
- **"Caminho B sandbox PAGO" não é o mesmo que "primeira receita real".** Falta etapa 11 + Asaas produção + canário acompanhado.
- **Trabalho condenado por sprint futuro deve ser cortado do escopo presente.** O item 4 da C.2 (CooperToken expandido) é exemplo claro: 30-60 min de retrabalho evitável porque Sprint CT Consolidado já está catalogado.

---

## 7. Frase de retomada — próxima sessão

> Voltei. Lê `docs/CONTROLE-EXECUCAO.md` + `docs/sessoes/2026-05-05-investigacao-jornada-e2e.md`.
>
> 05/05 manhã foi investigação read-only sem código. Mapeada jornada ponta-a-ponta em 14 etapas. **4 decisões pendentes** (D-J-1 a D-J-4) precisam ser respondidas antes de partir pra C.2/C.3:
> - **D-J-1 (urgente):** etapa 11 — aprovação concessionária é gap real ou processo manual fora do sistema?
> - **D-J-2:** etapa 5 — aprovação admin do plano é intencional ou gap?
> - **D-J-3:** item 4 da C.2 (CooperToken expandido) entra ou fica fora? (recomendação: ficar fora — trabalho condenado pelo Sprint CT Consolidado)
> - **D-J-4:** sequência C.2+C.3 juntos ou só C.3 primeiro?
>
> Próximo passo provável depois das 4 decisões: **C.2 reduzida (5 itens, sem CooperToken) + C.3** numa sessão Code, ~3-5h. Apresenta P0→P1→P2→P3 (Decisão 19) antes de propor.
>
> Estimativa pra primeira receita real CoopereBR: 12-20h Code + 1-2 semanas operacional (otimista). 30-40h Code + 3-4 semanas (realista, incluindo Sprint CooperToken + Sprint 0).

### Arquivos pra ler na retomada (~10 min)

1. `docs/CONTROLE-EXECUCAO.md` — estado vivo
2. `docs/sessoes/2026-05-05-investigacao-jornada-e2e.md` (este arquivo) — jornada + 4 decisões + estimativas
3. `docs/sessoes/2026-05-04-noite-investigacao-coopertoken.md` — contexto Sprint CT Consolidado
4. `docs/PLANO-ATE-PRODUCAO.md` — roadmap

Opcional (se atacar C.2 + C.3 direto após decisões):
5. `web/app/dashboard/planos/novo/page.tsx`, `[id]/page.tsx`
6. `web/components/PlanoSimulacao.tsx`, `CombinacaoAtual.tsx`
7. `web/lib/simular-plano.ts`
