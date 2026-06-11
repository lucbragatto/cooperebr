# Sessão Cowork — 2026-06-11 — Concierge C3 + C2.5

> Sessão Cowork (claude.ai) paralela à sessão Code (M31 Sprint Clube P1 Fase 2).
> Frente de trabalho independente: auditor tributário SISGD/Concierge.

## TL;DR (3 linhas)

Concluí Sprint Concierge C3 (3 detectores tributários deterministicos —
Tema 69 stricto, Tese 3 PIS/COFINS sobre SCEE, Tese 2 ICMS TUSD-G) +
C2.5 (adapter ELFSM calibrado com fatura real do Guilherme Colatina,
correção crítica no detector Tese 3 pra somar PIS/COFINS líquido).
Achado estratégico: EDP aplica SCEE no ICMS mas **NÃO** no PIS/COFINS;
ELFSM aplica em ambos — inconsistência legal exploravel via Tema 69
STF por analogia. **8 faturas auditadas, indébito mapeado R$ 5.6k+/mês
só na CoopereBR (R$ 400k-500k em 60m+SELIC).**

## Commits da sessão

| Hash | Tipo | Marco |
|---|---|---|
| `332ec5b` | feat | **C3** — 3 detectores tributários deterministicos + 16 specs verdes |
| `d24104f` | feat | **C2.5** — Adapter ELFSM funcional + correção soma PIS/COFINS no Tese 3 + 12 specs ELFSM |

**Total:** 2 commits, +1.485/-28 linhas, push limpo em `4687f42..d24104f`.

## Arquivos novos/modificados

### Sprint C3 (commit `332ec5b`, +915/-3)

| Arquivo | Função |
|---|---|
| `backend/src/concierge/detectores/detectores.types.ts` (NEW, 96l) | Tipos canônicos `PadraoDetectado` + helper `projetar60mSelic` |
| `backend/src/concierge/detectores/detector-tema69-stricto.ts` (NEW, 103l) | Tema 69 STF (RE 574.706) verifica base PIS/COFINS = baseICMS positiva − ICMS |
| `backend/src/concierge/detectores/detector-tese3-pis-sobre-scee.ts` (NEW, 128l) | PIS/COFINS sobre SCEE compensada (analogia Tema 69 + Tema 986 STJ) |
| `backend/src/concierge/detectores/detector-tese2-icms-tusd-g.ts` (NEW, 95l) | ICMS sobre TUSD-G/demanda (Tema 176 + Súmula 391 + Tese 4 GERAR) |
| `backend/src/concierge/detectores/detectores.registry.ts` (NEW, 83l) | `DetectoresRegistry` consolida 3 detectores + ordena por valor desc |
| `backend/src/concierge/detectores/detectores.spec.ts` (NEW, 395l) | 16/16 specs com valores reais das 7 faturas EDP |
| `backend/src/concierge/concierge.module.ts` (M, +15/-3) | DI dos 3 detectores + registry |

### Sprint C2.5 (commit `d24104f`, +570/-25)

| Arquivo | Função |
|---|---|
| `backend/src/concierge/fatura-canonica/elfsm.adapter.ts` (M, +272/-15) | Esqueleto `NAO_IMPLEMENTADO` substituído por adapter funcional (5 patterns, parser B10, classificação GD I/II/III) |
| `backend/src/concierge/fatura-canonica/elfsm.adapter.spec.ts` (NEW, 271l) | 12 specs com valores reais Guilherme Colatina Jun/2026 |
| `backend/src/concierge/detectores/detector-tese3-pis-sobre-scee.ts` (M, +43/-9) | JSDoc inconsistência EDP×ELFSM + soma líquida PIS/COFINS + ementa enriquecida + OBS auditor |
| `backend/src/concierge/fatura-canonica/edp-es.adapter.spec.ts` (M, +5/-3) | Spec antigo "esqueleto ELFSM" → smoke negativo `INPUT_INSUFICIENTE` |

## Achado estratégico — inconsistência ICMS×PIS/COFINS

Confronto entre 7 faturas EDP-ES + 1 fatura ELFSM (Guilherme Colatina)
revelou:

- **EDP-ES**: aplica Lei GERAR (11.253/2021-ES) no **ICMS** → ICMS efetivo
  só sobre energia consumida da rede. **CORRETO.** No PIS/COFINS calcula
  base como se SCEE não existisse → indébito Tese 3.
- **ELFSM** (Empresa Luz e Força Santa Maria, ES serrana): aplica SCEE em
  **AMBOS** os tributos. Linha de injeção traz PIS/COFINS NEGATIVO que
  cancela o positivo do "Consumo SCEE". Comportamento conservador.

**Justificativa jurídica EDP:** ICMS é estadual (Lei GERAR obriga),
PIS/COFINS são federais (não há lei federal explícita — só analogia
Tema 69 STF, ainda sem decisão específica pra SCEE).

**Argumento embutido na ementa do detector Tese 3** (pro advogado parceiro):

> A própria EDP reconhece a SCEE no ICMS (Lei GERAR) mas se recusa a
> fazer o mesmo no PIS/COFINS. Concessionárias menores (ELFSM) já
> aplicam a SCEE em ambos os tributos — prova de que tecnicamente é
> viável.

Memória persistente claude.ai salva em
`concierge_inconsistencia_icms_pis_edp_elfsm.md`.

## Achados nas 8 faturas auditadas

| Cliente | Tema 69 | Tese 3 PIS/COFINS SCEE | Tese 2 ICMS TUSD-G |
|---|---|---|---|
| Leonardo EDP B1 cativo | OK | — (sem GD) | — |
| Luciano EDP B1 GD residencial | OK | **R$ 49,91/mês** (R$ 3.743 em 60m+SELIC) | — |
| EXFISHES EDP MAR/26 (antes GDIII) | OK | **R$ 3.611/mês** (R$ 270k em 60m+SELIC) | — |
| EXFISHES EDP ABR/26 (GDIII) | OK | **R$ 2.515/mês** (R$ 188k em 60m+SELIC) | — |
| CUSD CoopereBR I (EDP usina) | OK | ~0 (TUSD/TE cancelam) | **R$ 2.732,24/mês** (R$ 205k em 60m+SELIC) |
| CUSD CoopereBR II (EDP usina+UC) | FAVORÁVEL R$ 248 | ~0 | **R$ 2.868,00/mês** (R$ 215k em 60m+SELIC) |
| Guilherme ELFSM B1 GD I residencial | OK | **0 (ELFSM aplica corretamente)** | — |

**Indébito CoopereBR estimado em 60m+SELIC: ~R$ 420k** (Tese 2 CUSD I+II).

## Decisões catalogadas

1. **Codigo TS deterministico, não agente LLM** pros detectores:
   - Auditabilidade judicial: spec mostra cálculo passo a passo
   - Determinismo: R$ 2.661,31 sempre dá R$ 2.661,31
   - Custo zero por execução, latência < 10ms
   - Agente Claude (skill/memoria) vira camada de orquestração no Sprint C7

2. **Detector Tese 3 corrigido**: soma PIS/COFINS líquido (com sinal)
   sobre TUSD+TE+INJECAO_SCEE. Pra EDP nada muda (injeção tem
   PIS/COFINS == 0). Pra ELFSM elimina falso positivo.

3. **Adapter ELFSM mapeia "Consumo SCEE" como TUSD** (não cria tipo novo).
   Mantém compatibilidade com detectores existentes.

## Débitos novos

- **D-novo-CONCIERGE-OCR-RUBRICAS-INDIVIDUAIS** P2 — OCR atual entrega
  campos agregados (`tarifaTUSD` soma). Pra alimentar auditor precisa
  estender OCR pra retornar rubricas individuais. Sprint C5 (smoke real)
  precisa disso antes de rodar fim-a-fim com PDFs em produção.
- **D-novo-CONCIERGE-ELFSM-A4** P3 — Adapter ELFSM calibrado só pra B10
  residencial. Fatura comercial/industrial (A4) tem layout potencialmente
  diferente — calibrar quando aparecer.
- **D-novo-CONCIERGE-EDP-MULTI-PIS** P3 — Alíquotas PIS/COFINS variam
  por UC EDP (Leonardo 6,40%, Luciano 6,40%, CUSD I 5,26%, CUSD II 3,52%,
  EXFISHES 3,52%). Verificar se é por classe/tipo ou aleatório.

## Débitos resolvidos

- **D-novo-CONCIERGE-TESE3-FALSO-POSITIVO-ELFSM** P0 → fechado mesmo
  sprint (correção da soma PIS/COFINS líquido).

## Bloqueadores pré-existentes (não-meus)

1. **`backend/src/cooper-token/cooper-token.service.ts:2005`** truncado
   pelo Code paralelo (Sprint CooperToken F2 commit `89bc531`). Bloqueia
   `npm run build`.
2. **`backend/node_modules/.prisma/client/index.d.ts:251214`** truncado
   (likely `prisma db push` C1). Bloqueia `tsc` global.

Specs C3 + C2.5 isolam via ts-jest sem precisar build global — passam.
Mas endpoint REST (C4) só vai funcionar depois desses 2 fixes.

## Pendências abertas pra próxima sessão

- **B (recomendado primeiro)**: investigar `cooper-token.service.ts:2005`
  + `.d.ts:251214` pra destravar `npm run build`. ~10-30min.
- **A**: Sprint C4 — orquestrador + classificador teses por perfil +
  endpoint `POST /concierge/diagnostico` + persistência
  `DiagnosticoIndebito` (model C1).
- **C5**: smoke real fim-a-fim com 3 faturas CoopereBR + 3 Sinergia +
  fatura Guilherme ELFSM. Depende de D-novo-CONCIERGE-OCR-RUBRICAS.
- **C6**: gerador de briefing pro advogado parceiro.
- **C7**: agente Claude com skill `auditar-fatura` + memória de casos.

## Próximo passo único e claro

**Investigar e corrigir `cooper-token.service.ts:2005` truncado** (Code
paralelo M31 deixou).

## Smoke E2E desta sessão

```
$ cd backend && npx jest --testPathPatterns="concierge/(detectores|fatura-canonica)"
PASS src/concierge/fatura-canonica/elfsm.adapter.spec.ts (12 testes)
PASS src/concierge/detectores/detectores.spec.ts (16 testes)
PASS src/concierge/fatura-canonica/edp-es.adapter.spec.ts (37 testes)

Test Suites: 3 passed, 3 total
Tests:       65 passed, 65 total
Time:        3.485 s
```

TSC limpo nos arquivos C3+C2.5 (`npx tsc --noEmit | grep concierge` = empty).
