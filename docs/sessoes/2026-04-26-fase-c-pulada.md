# Sprint 11 Bloco 2 — Fase C PULADA (decisão arquitetural)

**Data:** 2026-04-26
**Decisão:** Plano C aprovado por Luciano

## Estado do Bloco 2

- Fase A: ✅ COMPLETA (4º campo `numeroConcessionariaOriginal` — commits `9de64ab` + `92d610e`)
- Fase B: ✅ COMPLETA (pipeline OCR + `comparaNumerosUc` — commit `9ba0e81`)
- **Fase C: PULADA**
- Fase D: próxima

## Razões para pular Fase C

1. **Pipeline da Fase B já mitiga** o problema funcional via `comparaNumerosUc` — tolera diferença de zeros à esquerda (caso real EDP: filename `0160085263` vs banco `numeroUC=160085263` → bate). A normalização batch dos 326 registros não traz ganho funcional adicional.

2. **`numeroUC` legado depende de fluxo manual** — quem cadastra (admin/cooperado) precisa preencher; depende de o cooperado ter cadastrado o email da cooperativa no portal EDP. Tema da Sprint 12/13.

3. **Decisão "manter/internalizar/remover `numero`" é arquitetural** — merece sessão dedicada com Luciano, não cabe num script de normalização batch automático.

4. **Dados são todos de teste** — normalizar agora pode virar retrabalho quando o primeiro parceiro real entrar.

5. **Fase D entrega valor real** — validar pipeline ponta-a-ponta com fatura real do Luciano (UID 2032) é o que de fato comprova o gargalo do Ciclo de Ativação resolvido.

## Diagnóstico do banco que motivou a decisão

326 UCs no banco, distribuição real do campo `numero`:

| Padrão | Qtd | % | Estava no plano original Fase C? |
|---|---|---|---|
| 16 dígitos puros | 216 | 66% | ❌ NÃO estava |
| 10 dígitos puros | 42 | 13% | ✅ parcialmente |
| `UC-{ts}` (placeholder) | 36 | 11% | ✅ |
| 9 dígitos puros | 16 | 5% | ✅ parcialmente |
| 6 dígitos (seed) | 7 | 2% | ✅ |
| 15 díg com pontuação (`0.000....`) | 5 | 2% | ✅ |
| 15 dígitos puros | 2 | <1% | ❌ |
| 8 dígitos | 1 | <1% | ❌ |
| `PENDENTE-*` | 1 | <1% | ✅ |

**Cobertura do plano original:** ~22% dos registros. 78% cairia em "não classificado", exigindo revisão manual de 250+ casos.

**Outros achados:**
- `numeroConcessionariaOriginal` está vazio em 100% (campo novo da Fase A)
- `numeroUC` preenchido em 65 de 326 (20%)
- Campo `ambienteTeste` mora em `Cooperado` (não em `Uc`) — referência do plano original era incorreta

## Verificações arquiteturais (26/04, leitura)

**`Uc.id`:** `String @id @default(cuid())` ✅

**Foreign keys que referenciam `Uc`** — todas usam `ucId` apontando pra `Uc.id` (cuid), nenhuma pra `numero`:
- `Contrato.ucId` (NOT NULL) — `schema.prisma:373-374`
- `Ocorrencia.ucId` (opcional) — `schema.prisma:579-580`
- `FaturaProcessada.ucId` (opcional) — `schema.prisma:629-630`

**Implicação importante:** alterar/remover o campo `numero` no futuro **não quebra nenhuma FK**. Os relacionamentos todos usam `id`. Isso valida tecnicamente a discussão "remover `numero`".

## EM ABERTO — sessão futura

### Refatorar campo `numero` (3 opções)

- **(a)** Manter como está (saco de gato com tolerância via `comparaNumerosUc`)
- **(b)** Virar identificador interno SISGD com formato fixo (ex: `UC-AAAA-NNNNN`)
- **(c)** **Remover** — usar combinação `id` (cuid) + `numeroUC` + `numeroConcessionariaOriginal`

**Recomendação preliminar: (c) REMOVER.** Justificativa:
- Nenhuma FK aponta pra `numero`
- `numero` hoje é confuso (mistura canônico, legado, placeholder, display)
- Identificação técnica resolve com `id` + busca textual com `numeroUC`/`numeroConcessionariaOriginal`
- `comparaNumerosUc` no pipeline cobre o uso de "match livre"

**Confirmar quando primeiro parceiro real (cooperado pagante) entrar.**

### Normalizar 326 registros existentes

Opcional. Depende da decisão acima:
- Se Plano (c) for aprovado → normalização perde sentido (DROP COLUMN `numero`)
- Se Plano (a) ou (b) for aprovado → aí sim faz sentido normalizar com regras concretas

## Próximo passo

**Fase D:** validação E2E + hook `numeroUC` obrigatório na ativação.
- Hook em `cooperados.service.ts` no fluxo que muda status → `ATIVO_RECEBENDO_CREDITOS`
- Script `backend/scripts/teste-pipeline-uid2032.ts` (E2E com fatura real Luciano)
- Estimativa: 30-45 min, ~$5-8
