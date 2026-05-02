# Fase 1 — Trabalho técnico consolidado — 02/05/2026

**Modo:** execução autônoma autorizada (Luciano em Fase 2 paralela com claude.ai).
**Aplica regra de validação prévia + retomada + ritual.**
**Sem decisões de produto.** Apenas execução técnica + reclassificações documentais.

---

## Bloco 1 — Git inicial

- Último commit: `509002d`
- Working tree limpo (mudanças pré-existentes ignoradas)
- Branch `main`

OK pra prosseguir.

---

## Bloco 2 — D-30O fix aplicado ✅

**Arquivo:** `backend/src/faturas/faturas.service.ts:302+`

**Mudança:**
```diff
const fatura = await this.criarFaturaProcessada({
  ...
  status: 'PENDENTE',
+ // D-30O fix (02/05/2026): caminho 'extrair' não populava mesReferencia
+ // top-level — só ficava aninhado em dadosExtraidos. Agora copia do OCR.
+ mesReferencia: dadosExtraidos.mesReferencia || null,
  saldoKwhAnterior: dadosExtraidos.saldoKwhAnterior || null,
  ...
});
```

**Spec criada:** `backend/src/faturas/faturas.service.d30o.spec.ts` (4 cenários)
- OCR extrai mesReferencia → args inclui mesReferencia top-level ✓
- OCR retorna mesReferencia vazio → args inclui null ✓
- OCR retorna mesReferencia string vazia → args inclui null (falsy → null) ✓
- Forma "YYYY-MM" preservada ✓

**Resultado:** 4/4 verde. Typecheck `tsconfig.build.json` limpo.

---

## Bloco 3 — 7 ajustes factuais Doc-0 aplicados ✅

| # | Ajuste | Arquivo(s) |
|---|---|---|
| B.1 | Remover "juiz TJES" | `docs/PRODUTO.md:20` |
| B.2 | Sinergia + CoopereBR como "aguardando migração" | `docs/PRODUTO.md:21` |
| B.3 | "SISGD ainda sem cliente em produção real" | `docs/PRODUTO.md:24` |
| B.4 | "Assis" → "OpenClaw (assistente IA)" — 7 ocorrências corrigidas | `PRODUTO.md`, `REGULATORIO-ANEEL.md` |
| B.5 | Limite 25% **NÃO** se aplica a GD I (direitos adquiridos até 2045) | `REGULATORIO-ANEEL.md:192-200` |
| B.6 | Caso A (Exfishes) reescrito (sistema legado, GD I sem limite, realocação consciente sem simulação prévia) | `REGULATORIO-ANEEL.md:811+` |
| B.7 | "Conversão Express→Cooperado" marcada como **hipótese a validar** | `REGULATORIO-ANEEL.md:647` |

**Validação:** `grep -nE "Assis" docs/PRODUTO.md docs/REGULATORIO-ANEEL.md` → 0 ocorrências.

---

## Bloco 4 — Sprint 5a (Fio B) catalogado ✅

**Localização:** nova seção `## Seção 3b — Sub-sprints especializados` em `docs/PLANO-ATE-PRODUCAO.md`.

**Sprint pai:** Sprint 5 (Módulo Regulatório ANEEL completo).

**Decisão 18 (5 itens):**
- Tema: implementar cobrança progressiva Fio B Lei 14.300/2022 por classe GD
- Persona: cooperado GD II/III. Em 2026, 60% Fio B. Sem fix, ~21% pago a mais.
- Critério de pronto: Cobranca.fioB populado + fórmula correta + UI separada + spec OpenClaw 188 linhas portada + Jest 2026/2027/2028/2029 + E2E.
- Estimativa: 3-5 dias Code.
- Dependências: Sprint 0 (Auditoria) + schema Sprint 5 + advogado regulatório.

**Origem:** spec `PROPOSTA-GD1-GD2-FIOB-2026-03-26.md` (188 linhas, autor OpenClaw — assistente IA usado em iteração anterior).

---

## Bloco 5 — Sprint 3a (RN 482 → Lei 14.300) catalogado ✅

**Localização:** mesma seção `## Seção 3b`.

**Sprint pai:** Sprint 3 (Banco de Documentos / Assinafy).

**Decisão 18 (5 itens):**
- Tema: substituir RN 482/2012 (revogada) por Lei 14.300/2022 em termo + bot.
- Persona: qualquer parceiro SISGD. Risco jurídico ativo (cooperado pode contestar).
- Critério: termo revisado por advogado + bot atualizado + docs atualizados + Jest verifica ausência + revisão visual.
- Estimativa: 1-2 dias Code + 1 semana revisão jurídica.
- Dependências: advogado regulatório (pendência aberta) + Sprint 0.

**Origem:** descoberta sessão 30/04 (D-30H + D-30I).

---

## Bloco 6 — D-30R investigado e catalogado ✅

**Causa raiz precisa identificada via leitura de `motor-proposta.service.ts:467-744`:**

`Motor.aceitar()` calcula:
- `valorContrato` (linha 733) — só pra FIXO_MENSAL
- `tarifaContratualPromocional` (linha 707) — só se há promoção
- `valorContratoPromocional` (linha 709) — só se há promoção + FIXO

**NÃO calcula `Contrato.tarifaContratual` "normal"** (não-promocional) — campo crítico
pra COMPENSADOS funcionar corretamente.

**Confirmação no banco:** **72 contratos com `tarifaContratual=null` (100%)**, **0 com preenchida**. Maioria CREDITOS_COMPENSADOS.

**Impacto quando engine COMPENSADOS for ativada:** cobrança cai em fallback errado
`tarifaApurada = totalAPagar / consumoAtual` — totalAPagar já tem compensação aplicada.
Cooperado pagaria valor incorreto.

**Fix proposto** (~5-10 linhas em `motor-proposta.service.ts:680+`):
```ts
const tarifaContratualNormal = Math.round(
  Number(r.kwhApuradoBase) * (1 - Number(r.descontoPercentual) / 100) * 100000
) / 100000;

// E no tx.contrato.create:
tarifaContratual: tarifaContratualNormal,
```

**Backfill necessário:** 72 contratos existentes precisam popular retroativamente.

**Estimativa:** 30 min Code (fix + spec) + 15 min script backfill.

**Catalogado como:** D-30R em `debitos-tecnicos.md` (P2). **Fix não aplicado nesta fase** — aguarda decisão Luciano (Bloco 8 do prompt).

---

## Bloco 7 — CONTROLE-EXECUCAO atualizado ✅

- Seção "ONDE PARAMOS" reflete fechamento Fase 1
- Pendências reorganizadas:
  - **D-30O ✅ resolvido** (commit fase 1)
  - **7 ajustes Grupo B ✅ todos resolvidos** (commit fase 1)
  - **D-30R catalogado** (P2, fix proposto, aguarda decisão)
  - **Sprints 5a + 3a catalogados** com Decisão 18

---

## Resumo executivo Fase 1

| Categoria | Resolvido | Catalogado | Investigado |
|---|---|---|---|
| Fixes em código | 1 (D-30O) | — | — |
| Ajustes factuais Doc-0 | 7 (Grupo B completo) | — | — |
| Sprints novos | — | 2 (5a Fio B, 3a RN 482) | — |
| Débitos novos | — | 1 (D-30R) | 1 (D-30R causa raiz precisa) |

**Pendências antes Fase 1:** ~17 itens
**Pendências depois Fase 1:** ~10 itens (7 P3 + D-30O resolvidos; D-30R adicionado; 2 sprints catalogados)

**Tempo estimado:** ~2h Code (~$15-20).

---

*Fase 1 conduzida por Claude Code (Sonnet) em 02/05/2026 manhã. Aplica regra de
validação prévia + retomada + ritual. Nenhum fix aplicado fora do escopo do prompt.*
