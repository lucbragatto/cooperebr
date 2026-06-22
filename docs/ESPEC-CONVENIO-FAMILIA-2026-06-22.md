# Espec — Convênio FAMÍLIA (Fase 2: G1 vínculo familiar + G4 consumo→token + conversibilidade configurável)

> Detalha a camada FAMÍLIA do convênio cooperativizado. Complementa
> `ESPEC-CONVENIO-TOKEN-COOPERADO-2026-06-19.md` §4 (vínculo familiar) + §10 decisões.
> Trabalhista: Luciano confirmou (22/06) que a definição jurídica que preocupava está
> resolvida → família DESTRAVADA pra construir. Substância cooperativa + STF536 seguem
> como pré-req de ATIVAÇÃO real (não de build).

## 0. O modelo em 1 parágrafo
Uma pessoa trabalha na empresa conveniada (ex.: esposa) mas a conta de luz está no nome
de um familiar (ex.: marido). Ela se cadastra como **cooperada SEM UC** + declara o
consumo dela. A **empresa do convênio emite/distribui tokens pra ela** (existente, F3).
Com **autorização bilateral** (ela cede, ele aceita), esses tokens **abatem a fatura do
marido e queimam**. A energia continua no nome dele; o benefício (token) é dela; a casa
economiza. A conversibilidade do token (abate-só ↔ saque) é **configurável por
cooperativa**.

> **Nota — a empresa é cooperada PJ (22/06):** a empresa do convênio NÃO é só
> "parceira" — ela é um **`Cooperado` PJ** (`tipoPessoa='PJ'`), ligada ao convênio via
> `ContratoConvenio.pagadorCooperadoId` (relation `ConvenioPagador`). É isso que torna a
> emissão/distribuição de token **ato cooperativo isento**. O DB já modela (verificado:
> `pagadorCooperado` usado em custeio/portal-empresa/job). A cooperativização **REAL**
> (matrícula + capital + assembleia) é o passo de onboarding/jurídico de cada empresa,
> não um campo de banco. Empresa-cooperada PJ + funcionários-cooperados PF + família
> (PF SEM UC) = todos `Cooperado` no mesmo tenant, ligados pelo convênio.

## 1. Decisões travadas (Luciano 22/06)
1. **Confirmação bilateral:** cada um confirma no portal/app + aviso no WhatsApp.
   Rastreável (2 timestamps).
2. **Cardinalidade v1:** **1 paga 1** (uma pagadora → uma fatura titular). Múltiplos
   familiares numa conta = débito futuro (E5/E6).
3. **Conversibilidade:** flag por cooperativa, **abate-só LIGADO / saque DESLIGADO** por
   default. As 2 possibilidades convivem; o saque reusa a infra do D2/M41.

## 2. Peças a construir

| Peça | Estado base | O que falta |
|---|---|---|
| Vínculo familiar (convite "familiar", sem bônus MLM) | ✅ convite/indicação existe | marcar "familiar" + travar bônus |
| **AutorizacaoTokenFamiliar** (consentimento bilateral) | 🔴 não existe | model novo + 2 confirmações |
| **usarNaFatura estendido** (aceitar token de familiar autorizado) | 🟡 hoje self-only | guard "self OU pagador autorizado" |
| **G4 consumo declarado → token** | 🟡 só kWh→R$ | conversão kWh→token (sizing/display) |
| **Flag conversibilidade** por cooperativa | 🔴 não existe | campo + gate no saque (reusa D2) |
| Multi-tenant (esposa.coop == marido.coop) | — | guard em todos os pontos |

## 3. Modelo de dados (proposto — confirmar na Fase 1)
```
model AutorizacaoTokenFamiliar {
  id                    String   @id @default(cuid())
  cooperativaId         String                       // multi-tenant
  cooperadoPagadorId    String                       // esposa (cede tokens)
  cooperadoTitularId    String                       // marido (titular da UC/fatura)
  confirmadoPagadorEm   DateTime?                    // ela autorizou
  confirmadoTitularEm   DateTime?                    // ele aceitou
  ativo                 Boolean  @default(false)     // ativo só com os 2 confirmados
  createdAt             DateTime @default(now())
  @@unique([cooperadoPagadorId, cooperadoTitularId]) // 1:1 v1
  @@index([cooperativaId, ativo])
}
// Cooperativa += tokenFamiliarSacavel Boolean @default(false)   // 2ª possibilidade
```
O vínculo de **família** (parentesco) vem do convite/indicação reusado (marcado
familiar). A **autorização de pagamento** é este model dedicado (separar consentimento
financeiro do convite é mais auditável + revogável).

## 4. Fluxo ponta a ponta
1. Esposa cadastra **SEM UC** + declara consumo (`cotaKwhMensal`, já existe — M44).
2. Empresa do convênio **distribui tokens** pra ela (F3, existente).
3. Esposa **convida** o marido (convite familiar, **sem bônus MLM**) → marido cadastra
   **COM UC** + fatura, vinculado a ela.
4. **Autorização bilateral:** ela cria a AutorizacaoTokenFamiliar (confirmadoPagadorEm);
   ele aceita no portal/WA (confirmadoTitularEm) → `ativo=true`.
5. Na **fatura do marido**, `usarNaFatura` (estendido) usa os **tokens dela** → abate →
   queima (debita saldo dela, baixa passivo).
6. **2ª possibilidade (se `tokenFamiliarSacavel=true`):** em vez de abater, ela pode
   **sacar em PIX** (gated pela infra D2/M41 — `saqueColaboradorAtivo` + segmentação por
   origem + aprovação coop).

## 5. Multi-tenant (inegociável)
- AutorizacaoTokenFamiliar só liga se `pagador.cooperativaId == titular.cooperativaId`.
- `usarNaFatura` com token de familiar: valida a autorização ativa + mesmo tenant antes
  de debitar o saldo da pagadora.
- Toda query nova filtra `cooperativaId` do JWT (lição M45).

## 6. Edge cases
- **E4 (SEM UC sem saída):** resolvido — ela tem a fatura do marido OU o saque.
- **E5/E6 (múltiplos):** v1 trava em 1:1 (`@@unique`); multi = débito futuro.
- **Revogação:** `ativo=false` para abates futuros; tokens já usados não voltam (queimaram).
- **E7 (cross-tenant):** guard de tenant em todos os pontos.
- **Marido desliga / esposa sai da empresa:** autorização fica inativa; tokens dela
  continuam dela (regra E1 do M46).

## 7. Scope / fasing (estimativa Fase 1 vai refinar)
- **A** schema delta aditivo (AutorizacaoTokenFamiliar + flag) — ~0.5h.
- **B** convite familiar (flag + trava MLM) — ~1h.
- **C** endpoints de autorização (criar/confirmar/revogar) bilateral — ~2h.
- **D** `usarNaFatura` estendido (guard self-OU-pagador-autorizado) — ~2-3h (núcleo).
- **E** G4 conversão consumo→token (sizing/display) — ~1h.
- **F** flag conversibilidade + gate no saque (reusa D2) — ~1h.
- **G** specs + smoke real (autorização → abate na fatura, contatos whitelist) — ~2h.
- **H** reviewers (financeiro-token + multitenant) + re-review + merge — ~1.5h.

## 8. Conformidade
Token familiar = ato cooperativo limpo entre 2 cooperados da mesma cooperativa, **se
não-conversível nessa ponta** (parecer 19/06). A ponta do **saque** carrega o peso maior
→ herda as salvaguardas do D2 + fica OFF por default. Trabalhista resolvido (Luciano
22/06). Substância cooperativa + STF536 = pré-req de ativação real.

---
*Spec de design. Base da Sprint Família. Multi-tenant + reviewers pesados + smoke real
obrigatórios (padrão M44-M48).*
