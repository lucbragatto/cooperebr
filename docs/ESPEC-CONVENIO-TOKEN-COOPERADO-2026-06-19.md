# Espec — Convênio: Cooperativização + Token + Energia Flexível + Família

> **Projeto consolidado (ponta a ponta).** Reúne o desenho da sessão 19/06 + parecer de conformidade
> (`docs/relatorios/analise-conformidade-2026-06-19-modelo-convenio-cooperado-token.md`) + verificação de
> completude (o que já existe × o que falta). Base das próximas sprints.
> **Anteriores relacionados:** `FUNDACAO-COOPERTOKEN-MODELO-CANONICO.md`, `GAP-MAP-CONVENIO-MODELO-C`,
> `FLUXO-EMISSAO-TOKEN-CONVENIO`. Esta espec ADICIONA a camada **família + migração + ciclo de vida**.

## 0. O eixo (não perder de vista)
**O objetivo do convênio é COOPERATIVIZAR a empresa + os funcionários para que o token circule como
benefício caracterizado como ATO COOPERATIVO (Lei 5.764/71 Art. 79) → SEM tributação.** O status de
cooperado é o veículo jurídico; a energia é uma camada flexível por cima.

## 1. O modelo em 1 parágrafo
A empresa conveniada **paga a emissão** de tokens (F2) e **distribui** aos funcionários (F3). Todos viram
**cooperados** (empresa PJ + funcionários PF) → o token é ato cooperativo isento. A **energia** é flexível:
a cooperativa **fornece se tiver capacidade** (UC + crédito), senão o funcionário é **cooperado SEM UC**
(mantém a energia atual ou declara consumo). O token vira benefício: abate fatura, paga a conta da família,
e (futuro) circula. **O convênio cria demanda de energia → fomenta a cooperativa a investir em usina.**

## 2. Os 2 rios + os 3 cenários
**Rios independentes:** ENERGIA (sobra, proporcional ao kWh) × TOKEN/CLUBE (benefício, isento). Coerente
com a fundação (04/06).

| Cenário | Energia | Token | "Já recebe créditos GD" |
|---|---|---|---|
| **① Funcionário via convênio** *(piloto)* | SEM UC, ou UC se a coop fornecer | recebe do empregador | irrelevante (não migra) — só dado |
| **② Fornecedor atual = parceiro SISGD c/ clube** | fica lá | entra no clube DAQUELE parceiro (desconto→token) | sem migração |
| **③ Cliente que migra a energia pra nós** *(futuro)* | migra (estado de transição) | opcional | funil de conversão + double-count tratado por estado |

## 3. Energia flexível (camada sobre o cooperado)
- Cooperado **obrigatório** (eixo jurídico). UC **opcional**.
- Coop **tem capacidade** → UC + crédito. Se já tinha GD → **migração** (cenário ③).
- Coop **não tem** → cooperado SEM UC (estatuto v3 Art. 6º I cobre — "usufruem do ecossistema").
- **Sinal de déficit** (Santi precisa X kWh, coop tem Y) → fomenta decisão de usina.

## 4. Vínculo familiar (funcionário SEM UC + familiar com UC)
Ex.: esposa trabalha na Santi (SEM UC), fatura é do marido (com UC).
- Ela se cadastra SEM UC + **declara consumo (kWh)** → vira token no valor da energia.
- Ela manda **convite dela pro marido** (reusa `cooperadoIndicadorId`, **marcado "familiar" → sem bônus MLM**).
- Marido se cadastra DEPOIS (via "adicionar UC" no perfil), com UC + fatura, **vinculado a ela**.
- **Tokens dela pagam a fatura dele** (`usarNaFatura` estendido pra cooperado vinculado, **confirmação
  bilateral**) → a coop recebe a fatura da concessionária, abate e **queima os tokens**.
- Regra MLM: convite familiar **nunca** dá bônus; convênio tem flag "inclui MLM ou não" (default não).

## 5. Ciclo de vida / estados
```
Convite → cadastro → MEMBRO (cooperado)
  ├─ COM UC, sem GD prévia → ATIVO → cobrança/crédito normal
  ├─ SEM UC → cooperado SEM UC (token do empregador; energia intocada)
  └─ COM UC + GD prévia + coop vai fornecer → PENDENTE_MIGRACAO → DESLIGADO(concorrente) → ATIVO
       (billing só liga em ATIVO; evita double-count + dupla alocação SCEE)
```

## 6. O que JÁ EXISTE × o que FALTA (gap map verificado)

| Peça | Estado | Evidência |
|---|---|---|
| Trilho token clássico (F2 compra · F3 distribui · F4 usa na fatura) | ✅ ~85% | `cooper-token.service.ts` |
| Cooperado SEM_UC + consumo declarado (`cotaKwhMensal`, sem fatura) | ✅ | `publico.controller.ts`, `schema:203` |
| UC SINTÉTICA (membro sem instalação) | ✅ | `schema:534/550` |
| Multi-UC / "adicionar UC no perfil" | ✅ (só a própria) | `cooperados.controller.ts:186` |
| **Vínculo familiar (token A → fatura B)** | 🔴 **NÃO EXISTE** | `usarNaFatura:4219` trava self-only; `Indicacao:2123` sem flag familiar; sem confirmação bilateral |
| **Estados de migração (PENDENTE_MIGRACAO/DESLIGADO + rastreio concorrente)** | 🔴 **NÃO EXISTEM** | `StatusCooperado:402`; `MigracaoUsina:2605` é intra-coop |
| Gate de billing na transição | 🟡 funciona "de raspão" (só roda em ATIVO) | `cobrancas.job.ts:51-56` |
| **Conversão consumo declarado → token** | 🟡 **NÃO EXISTE** (só kWh→R$) | `conversao-credito.service.ts:21` |
| **Documento "desligamento do concorrente"** | 🟡 **NÃO EXISTE** | `ModeloDocumento` só CONTRATO/PROCURACAO |
| Cash-out token→PIX colaborador comum | 🟡 gated (já catalogado) | `cooper-token.service.ts:2232` |
| Notificação de token distribuído + fatura abatida | 🟡 órfã | `TokenNotificacaoService` sem caller |

## 7. Edge cases ESQUECIDOS (o que a verificação pegou)

| # | Edge case | Severidade |
|---|---|---|
| **E1** | **Funcionário SAI da empresa → destino dos tokens já distribuídos** (`removerMembro` não toca tokens — ficam no saldo pessoal pra sempre, sem decisão) | 🔴 decisão de produto faltando |
| **E2** | **Migração do concorrente FALHA / não completa** → membro em limbo, sem timeout, sem alerta, sem rollback | 🔴 |
| E3 | Token oxida/expira **durante a transição** (oxidação cega ao estado de migração; "recebe e segura" não tem suporte — `creditar` exige ATIVO) | 🟡 conflito latente |
| E4 | SEM UC + sem familiar vinculado recebe token → **não tem saída útil** (sem fatura própria, sem família, sem cash-out) | 🟡 |
| E5/E6 | Múltiplos familiares/UCs; familiar em 2 convênios (tokens misturados — `CooperTokenCompra` sem `convenioId`) | 🟢 depois |
| E7 | Multi-tenant do cross-cooperado (família) — guard `A.cooperativaId == B.cooperativaId` ao construir G1 | 🟡 (ao construir) |

## 8. Conformidade — veredito (parecer 19/06)
**Pode seguir, com 6 salvaguardas + validação externa em 3 pontos.** Riscos:
- 🔴 **P0 Trabalhista** (CLT 458 — token = salário in natura, **agravado** porque paga a conta de luz =
  necessidade básica mensurável). **Parecer de advogado trabalhista OBRIGATÓRIO antes de empresa real.**
- 🔴 **P0 Substância cooperativa** — a cooperativização precisa ser REAL (matrícula + capital + assembleia),
  não casca fiscal (CTN Art. 149 VII).
- 🔴 **P0 STF Tema 536** (isenção PIS/COFINS em julgamento) — implementar isenção como **flag configurável**,
  não hardcoded.
- 🟡 P1 Admissão PJ heterogênea (documentar elo comum "consumo de energia"); P1 rastreio `origemConvenioId`
  no ledger; P1 teto 25% por cooperado nos tokens; P1 cláusula trabalhista no contrato de convênio.
- ✅ Vínculo familiar (token A→fatura B) = **BAIXO** (ato cooperativo limpo, se token não-conversível).
- ✅ Cooperado SEM UC = válido (estatuto v3 Art. 6º I).
- ⚠️ **Estatuto v3 + AGE 17/06** devem estar **registrados na JUCEES** — sem isso, o modelo não tem base
  estatutária vigente.

## 9. Fasing (sprints) — derivado dos blockers
**O blocker-set depende do escopo do piloto:**

- **Fase 0 — Jurídico (pré-requisito, paralelo, NÃO-código):** parecer trabalhista + estatuto v3 registrado
  + política de admissão PJ. **Sem isso, nenhuma empresa real entra.**
- **Fase 1 — Piloto mínimo (1 empresa, funcionários COM UC própria OU SEM_UC-só-dado, SEM família, SEM
  migração):** só **E1** (destino dos tokens no desligamento — decisão + build) e **E8** (notificações) são
  urgentes. + religar a detecção GD no V2 (só dado, não bloqueia) + `origemConvenioId` no ledger.
- **Fase 2 — Família:** G1 (vínculo familiar + token cross-cooperado + confirmação bilateral) + G4 (consumo
  declarado → token) + E4/E5/E6/E7.
- **Fase 3 — Migração de concorrente:** G2 (estados PENDENTE_MIGRACAO/DESLIGADO) + G5 (doc desligamento) +
  E2 (rollback/timeout) + E3 (oxidação na transição) + o gate de billing explícito.
- **Transversal (Sprint #8 Contábil):** isenção PIS/COFINS configurável + segregação 2 linhas + teto 25%.

## 10. Decisões pendentes (Luciano)
1. **Escopo do piloto** — define o blocker-set: inclui família? inclui migração-de-concorrente? *(Se NÃO a
   ambos → Fase 1 mínima, rápida.)*
2. **E1 — funcionário sai:** os tokens já distribuídos ficam com ele, são recomprados, ou expiram?
3. **No cadastro do convênio:** funcionário entra SEM UC, ou o sistema avalia capacidade e aloca energia na
   hora?
4. **Distribuição de token:** proporcional ao consumo declarado, ou a empresa define livre?
5. **Validação externa:** autoriza contratar advogado trabalhista + cooperativista antes do piloto real?
6. **Estatuto v3 / AGE 17/06:** está registrado na JUCEES?

---
*Espec read-only. O parecer de conformidade detalhado vive em
`docs/relatorios/analise-conformidade-2026-06-19-modelo-convenio-cooperado-token.md`. Nenhum código alterado.*
