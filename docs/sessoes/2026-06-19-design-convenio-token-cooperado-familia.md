# Sessão 2026-06-19 — Design: Convênio Cooperativizado + Token Isento + Energia Flexível + Vínculo Familiar

> **Tipo:** sessão de DESIGN (orquestrador/claude.ai) — zero código de feature, zero migration.
> **Fechamento:** retroativo em 20/06 (a sessão de design 19/06 ficou sem ritual; persistido + commitado em 20/06).

## TL;DR (pra leigo)

A gente desenhou, do começo ao fim, como vai funcionar o **convênio** em que uma empresa (ex.: Santi) e seus funcionários viram **cooperados** pra que o **CooperToken** circule como benefício **sem imposto** (ato cooperativo). A energia é uma camada flexível por cima: a cooperativa fornece se tiver capacidade, senão o funcionário entra como cooperado **sem UC**, só declarando quanto consome. Também resolvemos o caso da **família**: a esposa trabalha na empresa mas a conta de luz é do marido — ela recebe os tokens e eles abatem a fatura dele. Rodamos um **parecer de conformidade** (pode seguir, com travas jurídicas) e uma **verificação de completude** que respondeu honestamente "**não pegamos tudo**" — o trilho clássico do token está ~85% pronto, mas a camada nova (família, migração de concorrente, ciclo de vida do funcionário) está quase toda por construir, com edge cases esquecidos.

## Entregas (artefatos persistidos)

| Artefato | Caminho | Natureza |
|---|---|---|
| **Spec mestra** | `docs/ESPEC-CONVENIO-TOKEN-COOPERADO-2026-06-19.md` | Modelo ponta-a-ponta + gap map + edge cases + fasing + 6 decisões |
| **Parecer de conformidade** | `docs/relatorios/analise-conformidade-2026-06-19-modelo-convenio-cooperado-token.md` | 4 lentes; 6 salvaguardas; 3 P0; validação externa |
| **Diagrama** | render `show_widget` (efêmero — não-arquivo) | Fluxo 5 estágios com cores de status |

**SHA do commit de fechamento:** ver `git log` (commit `docs(sessao): fechamento design convênio-token-cooperado 19/06`).

## Decisões catalogadas (modelo travado)

1. **O eixo:** cooperativizar empresa + funcionários → token = ato cooperativo isento (Lei 5.764/71 Art. 79). Status de cooperado é o veículo jurídico; energia é camada flexível.
2. **Cooperado obrigatório, UC opcional.** Coop fornece energia se tiver capacidade; senão cooperado SEM UC (declara consumo).
3. **Vínculo familiar:** cooperada SEM UC manda convite pro familiar com UC (reusa `cooperadoIndicadorId` marcado "familiar" → **sem bônus MLM**); tokens dela abatem a fatura dele com **confirmação bilateral**.
4. **MLM no convênio:** default NÃO inclui bônus de indicação; quando incluir, trava a indicação familiar (não pode ter vantagem).
5. **Convênio cria demanda de energia** → sinal de déficit fomenta a cooperativa a investir em usina.

## Débitos novos catalogados (8)

- **D-novo-CONVENIO-E1-FUNCIONARIO-SAI-TOKENS-ORFAOS (P1 🔴 BLOQUEADOR)** — funcionário sai → tokens distribuídos ficam órfãos no saldo; decisão de produto faltando.
- **D-novo-CONVENIO-ORIGEM-LEDGER (P1)** — falta `origemConvenioId` no ledger (defesa trabalhista+tributária; salvaguarda 4 do parecer).
- **D-novo-CONVENIO-FASE0-JURIDICO (P0 ativação real)** — parecer trabalhista + substância cooperativa + estatuto JUCEES + isenção PIS/COFINS como flag, antes de empresa real.
- **D-novo-CONVENIO-G1-VINCULO-FAMILIAR (P2, Fase 2)** — token A→fatura B não existe (`usarNaFatura` self-only).
- **D-novo-CONVENIO-G2-ESTADOS-MIGRACAO (P2, Fase 3)** — `PENDENTE_MIGRACAO`/`DESLIGADO` + rastreio concorrente não existem.
- **D-novo-CONVENIO-G4-CONSUMO-DECLARADO-TOKEN (P2, Fase 2)** — conversão consumo→token não existe (só kWh→R$).
- **D-novo-CONVENIO-G5-DOC-DESLIGAMENTO (P3, Fase 3)** — modelo de documento "desligamento do concorrente" não existe.
- **D-novo-CONVENIO-E2-MIGRACAO-FALHA-SEM-ROLLBACK (P2, Fase 3)** — migração falha → limbo, sem timeout/alerta/rollback.

## Débitos resolvidos

Nenhum (sessão de design).

## Bugs descobertos

Nenhum (sessão de design). A verificação de completude apontou **gaps de funcionalidade não-construída**, não bugs em código existente.

## Conformidade — veredito (parecer 19/06)

**Pode seguir, com 6 salvaguardas + validação externa em 3 frentes.** 3 P0: (1) trabalhista AGRAVADO — token paga conta de luz = necessidade básica → mais perto de salário in natura (CLT 458); (2) substância cooperativa real (não casca fiscal); (3) STF Tema 536 → isenção PIS/COFINS como flag configurável. Vínculo familiar = BAIXO risco. Cooperado SEM UC = válido (estatuto v3 Art. 6º I, **a confirmar registro JUCEES**).

## Pendências abertas (próxima sessão)

**6 decisões de produto (Luciano):**
1. **Escopo do piloto** — inclui família? inclui migração-de-concorrente? (define o blocker-set).
2. E1 — funcionário sai: tokens ficam / recompra / expiram?
3. No cadastro: SEM UC, ou avalia capacidade e aloca energia na hora?
4. Distribuição de token: proporcional ao consumo, ou empresa define livre?
5. Validação externa: autoriza advogado trabalhista + cooperativista antes do piloto?
6. Estatuto v3 / AGE 17/06: registrado na JUCEES?

**Fase 0 jurídico** (NÃO-código, pré-requisito de qualquer empresa real) roda em paralelo.

## Próximo passo único e claro

**Slice decision-independent que o Luciano já definiu em palavras** ("por agora, vamos colocar apenas a necessidade dele marcar que recebe créditos"): **Fase 1 read-only** de (a) marcar "recebe créditos GD" como **DADO** no cadastro V2 (não bloqueia) + (b) `origemConvenioId` no ledger. Branch dedicada, investigar estado atual, reportar, pausar pro OK do orquestrador (Decisão 23). NÃO iniciar família/migração — são Fase 2/3 e dependem da decisão de escopo + Fase 0 jurídico.
