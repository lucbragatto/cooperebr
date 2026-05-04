# Sessão claude.ai 2026-05-04 noite — Investigação CooperToken + decisão Sprint Consolidado

## 1. Sumário executivo

Sessão claude.ai noite (após fechamento da sessão tarde — Sprint 5 ponto 3 + housekeeping git). Luciano levantou questionamento estruturante sobre arquitetura CooperToken: configuração hoje espalhada em 11 campos do `Plano` deveria estar centralizada em `ConfigCooperToken` (escopo cooperativa). 2 investigações read-only mapearam estado real → decisão: **promover a sprint próprio "CooperToken Consolidado", 14-18h, executar após Fase C.3.**

## 2. Linha do tempo

```
~22h00  Luciano: "configuração de token na página do plano pode trazer dificuldade — talvez deva
        ficar dentro do CooperToken. Token é moeda da cooperativa, não do plano."

        Investigação read-only #1 (mapeamento amplo) — Code
        Achados: ConfigCooperToken já existe (escopo coop, 1:1 unique), 11 campos duplicados
        em Plano. Spec canônica docs/especificacao-clube-cooper-token.md confirma "configuração
        por parceiro". Recomendação inicial: 6-10h. Mas claude.ai apontou 5 lacunas não cobertas.

        Investigação read-only #2 (5 lacunas) — Code
        Achados que reformularam a estimativa:
        - Plano DOMINA o cálculo hoje (cooper-token.service, motor, faturas, cobrancas, PDF)
        - ConfigCooperToken só é usada em compra parceiro + QR pagamento
        - 2 hardcodes 0.20 com TODO pendente
        - /cadastro lê SÓ Plano.cooperTokenAtivo (binária) — 10 outros campos zumbis no público
        - Banco: 1 plano com flag ativa (todos campos null), ConfigCooperToken vazia, 5 saldos,
          9 ledger entries, 0 ofertas, 0 resgates, 317 cooperados em opcaoToken='A' (default)
        - 0 specs Jest no módulo cooper-token/ (gap conhecido desde 02/05 commit 8cb83285)

~23h30  Decisão Luciano: aprovar sprint próprio CooperToken Consolidado.
        Estimativa recalculada: 14-18h (não 6-10h).
        Sequência: Fase C.2 → Fase C.3 → Sprint CooperToken Consolidado.

        Sem commits de código nesta sessão noite — só investigação + decisão + atualização memória.
```

## 3. Decisão estruturante registrada

**Sprint CooperToken Consolidado (catalogado 04/05 noite, executar TBD).**

**Escopo definitivo:**
- Schema delta: remover 10 campos de `Plano` (`tokenOpcaoCooperado`, `tokenValorTipo`, `tokenValorFixo`, `tokenPorKwhExcedente`, `valorTokenReais`, `tokenExpiracaoMeses`, `tokenDescontoMaxPerc`, `tokenSocialAtivo`, `tokenFlexAtivo`, `modoToken`); manter `cooperTokenAtivo` (boolean, opt-in usado pelo `/cadastro`).
- Estender `ConfigCooperToken` com os campos que faltam pra suportar todos os casos de uso de governança (mapear na Etapa 2).
- Refator de 4 services + cobranca-pdf + 2 hardcodes 0.20 → ler de `ConfigCooperToken`.
- UI nova: seção editável "Configurações do Clube" em `/dashboard/cooper-token` (tela já existe, falta seção editável).
- Remover campos governança da UI atual de Plano (`/novo` e `/[id]`).
- **Pré-requisito P0:** escrever specs Jest pro módulo `cooper-token/` antes do refator. Hoje: 0 specs. Refator sem rede em código financeiro = receita pra bug silencioso.

**Etapas:**
1. **Etapa 1 — specs (~6-8h, independente):** cobrir núcleo financeiro (`calcularValorAtual`, emissão, débito, expiração) com Jest. Pode rodar em paralelo com qualquer outra coisa.
2. **Etapa 2 — refator (~8-10h, depende da Etapa 1):** schema + migration + UI nova + refator backend.

**Total realista:** 14-18h Code.

**Razões pra ser sprint próprio (não absorver em C.2):**
- Trabalho 4-6× maior que C.2 (~3-4h)
- Toca subsistema financeiro independente (não interfere FIXO/COMPENSADOS/DINAMICO já validados)
- Pré-requisito específico (specs) que C.2 não tem
- Decisão arquitetural merece registro próprio

## 4. Decisões de produto colaterais

- **`Plano.cooperTokenAtivo` fica como flag opt-in.** Tem função real no `/cadastro` (linha 465 + 586): determina se payload vai como `'FATURA_CHEIA_TOKEN'` ou `'DESCONTO_DIRETO'`. Removê-la quebraria fluxo público.
- **Token é fungível por cooperativa.** Se Plano OURO desse token de R$ 0,50 e Plano PRATA de R$ 0,20, parceiro receberia valores diferentes pelo mesmo token — quebra modelo mental do cooperado e da rede de parceiros. Decisão: 1 valor por cooperativa.
- **Migração de dados é trivial** (banco vazio nos campos relevantes). Sem estratégia de conflito necessária.

## 5. Lacunas e dívidas relacionadas (não atacar agora)

- **2 hardcodes 0.20** (cooper-token.service.ts:258, cobranca-pdf.service.ts:60) com TODO "ler do plano" — vão sair junto no refator da Etapa 2.
- **Comentário em indicacoes.service.ts:347-348:** "Quando ConfigCooperToken for implementado de verdade (Sprint 8B+)..." — confirma que a centralização já estava prevista no roadmap original.
- **Decisão B3 da pendência P1** (CooperToken desvalorização configurável vs hard-coded 29 dias) — vira sub-decisão a tomar dentro do Sprint CooperToken Consolidado.

## 6. Aprendizados meta

- **Investigação iterativa salvou de erro de escopo.** Code 1 estimou 6-10h sem ler código; Code 2 (5 lacunas) reformulou pra 14-18h após mapeamento real. Diferença de 8-10h vira diferença entre "embute em C.2" vs "sprint próprio".
- **Hipótese binária explícita ajuda.** A pergunta "lê de Plano ou ConfigCooperToken?" foi formulada como hipótese a/b/c antes da investigação. Resposta foi (c) com domínio do Plano — sem isso, ficaria especulação.
- **Pré-requisito de specs antes de refator.** Sessão 02/05 já tinha alertado (commit 8cb83285). Hoje confirmou. Vira parte formal do escopo do sprint, não apêndice opcional.

---

## 7. Frase de retomada — próxima sessão

> Voltei. Lê `docs/CONTROLE-EXECUCAO.md` + `docs/sessoes/2026-05-04-noite-investigacao-coopertoken.md`.
>
> 04/05 fechou: housekeeping git (3 commits), Sprint 5 ponto 3 atualizado (2 commits), Fase C.1.1 validada manualmente, Sprint CooperToken Consolidado catalogado (14-18h, executar depois de C.2 + C.3).
>
> Próximo passo provável (Code, sessão fresca): Fase C.2 (UI plano avançada — promo defaults, vigência, CooperToken expandido na UI atual *temporariamente até refator*, lista enriquecida, confirmação) + Fase C.3 (display economia em proposta+contrato+cobrança). ~5-6h Code juntos. Mas apresenta P0→P1→P2→P3 (Decisão 19) antes de propor.

### Arquivos pra ler na retomada (ordem, ~12 min)

1. `docs/CONTROLE-EXECUCAO.md` — estado vivo (seção "ONDE PARAMOS")
2. `docs/sessoes/2026-05-04-noite-investigacao-coopertoken.md` (este arquivo) — decisão CooperToken + Sprint catalogado
3. `docs/sessoes/2026-05-04-resumo-sessao-claude-ai.md` — fechamento da sessão tarde de hoje
4. `docs/sessoes/2026-05-03-resumo-sessao-completa.md` — contexto Fase A+B+B.5+C.1 (substrato técnico)
5. `docs/PLANO-ATE-PRODUCAO.md` — onde estamos no roadmap (Sprint CooperToken adicionado)

Opcional (só se for atacar Fase C.2 + C.3 direto):
6. `web/app/dashboard/planos/novo/page.tsx` — tela atual a estender
7. `web/components/PlanoSimulacao.tsx` + `web/components/CombinacaoAtual.tsx`

Opcional (só se for atacar Sprint CooperToken Consolidado direto):
8. `backend/src/cooper-token/cooper-token.service.ts` — service principal (4 métodos a refatorar)
9. `backend/prisma/schema.prisma` — modelos `Plano` (campos token a remover) + `ConfigCooperToken` (a estender)
10. `web/app/dashboard/cooper-token/page.tsx` — tela existente (esqueleto pronto, falta seção editável)
11. `docs/especificacao-clube-cooper-token.md` — spec canônica (seções 3.5, 3.6, 3.7)
