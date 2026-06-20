# Parecer de Conformidade — Modelo Convênio: Cooperativização + Token Isento + Energia Flexível + Vínculo Familiar

> **Data:** 2026-06-19 · **Autor:** análise de conformidade (4 lentes: contábil, financeiro, tributário, legal) orquestrada por claude.ai, com base no subagent `cooperebr-analista-conformidade`.
> **Objeto:** validar o modelo de convênio em que a empresa + seus funcionários se tornam **cooperados** para que o CooperToken circule como **ato cooperativo isento** (Lei 5.764/71 Art. 79), com energia como camada flexível e vínculo familiar (token de um cooperado abate a fatura de outro).
> **Status:** read-only — nenhum código alterado. **Validação externa OBRIGATÓRIA** antes de qualquer empresa real (advogado trabalhista + cooperativista + regulatório).
> **Spec companheira:** `docs/ESPEC-CONVENIO-TOKEN-COOPERADO-2026-06-19.md`.

## Sumário executivo

O modelo é **juridicamente defensável** e tem base real (ato cooperativo isento, Art. 79 + STF Tema 536). **Pode seguir** — mas só com **6 salvaguardas simultâneas + validação externa em 3 frentes**, e com **3 bloqueadores P0 fechados antes de qualquer empresa conveniada real**.

**Mudança material desta sessão vs. o parecer D2 (16/06):** no D2, o token do funcionário podia virar PIX (conversibilidade = risco trabalhista ALTO). Agora o token também **paga a conta de luz da família** (vínculo familiar: token da esposa SEM UC → fatura do marido com UC). Isso **AGRAVA** o risco trabalhista, porque o benefício passa a cobrir uma **necessidade básica mensurável em dinheiro** — exatamente o teste que a jurisprudência usa para caracterizar salário in natura (CLT Art. 458).

**Conclusão central:** o eixo do modelo (cooperativizar para tornar o token ato cooperativo isento) é sólido **se e somente se a cooperativização for substantivamente real** — matrícula, integralização de capital, assembleia, participação efetiva. Se for casca fiscal, a Receita reclassifica e cai toda a isenção (CTN Art. 149, VII).

## Tabela de achados

| # | Dimensão | Status | Sev | Norma | Recomendação |
|---|---|---|---|---|---|
| 1 | **Trabalhista — token empresa→funcionário pagando conta de luz** | **NÃO CONFORME** | **P0** | **CLT Art. 458 caput + 457 §1º** | **Parecer trabalhista externo ANTES de empresa real. Cláusula de natureza no convênio.** |
| 2 | **Substância cooperativa real (não casca fiscal)** | **A VERIFICAR** | **P0** | **CTN Art. 149 VII + Lei 5.764 Art. 4º** | **Matrícula + capital + assembleia + ata. Sem isso, sem isenção.** |
| 3 | **Tributário — PIS/COFINS isenção ato cooperativo** | OK condicional | P0/P1 | STF Tema 536 (em julgamento) | **Isenção como FLAG configurável, não hardcoded.** Fallback se incidir. |
| 4 | Tributário — IRPF do funcionário sobre token recebido do empregador | PARCIAL | P1 | Art. 79 + STJ Tema 986 | Documentar origem; token de empregador ≠ sobra de energia própria |
| 5 | Admissão de PJ heterogênea (empresas de ramos diversos) | PARCIAL | P1 | Lei 5.764 Art. 4º (objeto comum) | Documentar elo comum: "consumo/economia de energia" no estatuto/ata |
| 6 | Rastreio de origem no ledger (`origemConvenioId`) | NÃO CONFORME | P1 | Defesa documental Tema 536 + trabalhista | Incluir `origemConvenioId` no `CooperTokenCompra`/ledger |
| 7 | **Vínculo familiar (token A → fatura B)** | OK (baixo risco) | P3 | Art. 79 (ato cooperativo limpo) | Válido SE token não-conversível em dinheiro nessa ponta + confirmação bilateral |
| 8 | Cooperado SEM UC (consumo declarado, sem fatura própria) | OK | P3 | Estatuto v3 Art. 6º I (a verificar JUCEES) | Válido se o estatuto vigente cobrir "usufruto do ecossistema" |
| 9 | Teto de concentração de token por cooperado | A IMPLEMENTAR | P1 | Defesa anti-distribuição-disfarçada-de-salário | Teto ~25% por cooperado nos tokens emitidos via convênio |
| 10 | Estatuto v3 + AGE 17/06 registrados na JUCEES | **A VERIFICAR** | **P0 documental** | Lei 5.764 Art. 18 + registro JUCEES | Sem registro vigente, o modelo não tem base estatutária |

## Análise por dimensão

### 1. Trabalhista (RISCO MAIS ALTO — P0, AGRAVADO)
- O eixo do convênio é a empresa **pagar a emissão** e **distribuir** tokens aos funcionários. Mesmo cooperativizados, esses funcionários continuam empregados da empresa conveniada → existe **relação de trabalho subjacente**.
- O token agora **paga a conta de luz da casa** (vínculo familiar). Benefício habitual + mensurável + que cobre necessidade essencial é o cenário clássico de **salário in natura** (CLT Art. 458 caput; Súmula 367 TST trata da habitualidade/essencialidade).
- **Consequências para a empresa conveniada:** integração ao salário → reflexos em 13º, férias, FGTS, INSS patronal + autuação retroativa + risco de ação coletiva. A cooperativa tem risco de **solidariedade** (CLT Art. 455 / grupo econômico) e risco reputacional.
- **Distinção crítica que segura o modelo:** o cooperado PF que acumula token do **desconto da própria fatura** e usa → risco ZERO (não há empregador na origem). O funcionário que recebe token **da empresa** → risco ALTO. **A origem do token é o que define o risco** — por isso o `origemConvenioId` (achado 6) é defesa, não enfeite.
- **Mitigação:** (a) parecer trabalhista externo antes de habilitar; (b) cláusula no contrato de convênio caracterizando o token como **benefício cooperativo, não remuneração**; (c) teto de concentração (achado 9); (d) **não habilitar saque PIX** para tokens de origem convênio (mantém não-conversível = circuito fechado mais defensável).

### 2. Substância cooperativa (P0)
- A isenção do Art. 79 só vale se houver **ato cooperativo real**. Cooperativizar empresa + funcionários "no papel" só para isentar o token é o que a Receita ataca como **simulação** (CTN Art. 149 VII; abuso de forma).
- **Exigências mínimas:** matrícula formal de cada cooperado (PF e PJ), integralização de capital (ainda que simbólica), participação em assembleia, ata documentando a admissão e o elo comum. O funcionário precisa ser **cooperado de verdade** — votar, participar, usufruir — não só receber token.
- **Risco se falhar:** reclassificação de toda a operação como distribuição de benefício tributável + autuação da cooperativa + da empresa.

### 3. Tributário — PIS/COFINS e o STF Tema 536 (P0/P1)
- A não incidência sobre o ato cooperativo (token isento) depende do **Art. 79 + Tema 536**, que está **em julgamento** (RE 599.362, plenário físico, com destaque). O placar pode virar.
- **Recomendação técnica:** implementar a isenção como **flag configurável por cooperativa/natureza** (não hardcoded). Se o STF concluir pela incidência sobre atos atípicos, e o circuito de token for lido como "atípico" ao objeto de energia, é preciso poder **ligar a tributação sem reescrever código**.
- Preparar **fallback**: provisão e segregação contábil (Sprint #8 Contabilidade Segregada) que permita apurar PIS/COFINS sobre a perna de token caso necessário.

### 4. Tributário — IRPF do funcionário (P1)
- Token de **desconto de fatura própria** sacado/usado: devolução diferida de valor já pago → sem acréscimo patrimonial → sem IRPF.
- Token **recebido do empregador**: há acréscimo patrimonial na ponta do funcionário. Enquadrar como sobra (Art. 79) exige proporcionalidade às operações + ata; senão a Receita pode tratar como rendimento tributável. **Documentar a origem** é o que sustenta a tese.

### 5/6. Admissão PJ heterogênea + rastreio de origem (P1)
- Cooperativa de ramos diversos precisa de **objeto comum** documentado (Art. 4º). O elo aqui é "consumo/economia de energia + ecossistema cooperativo" — registrar no estatuto/ata.
- `origemConvenioId` no ledger é **dupla defesa** (trabalhista: separa token-de-empregador de token-próprio; tributária: rastreia natureza). É a peça de plumbing mais barata e mais estratégica — additiva, sem risco.

### 7. Vínculo familiar (BAIXO risco — P3)
- Token da esposa (cooperada SEM UC) abatendo a fatura do marido (cooperado com UC) é **ato cooperativo limpo** entre dois cooperados da mesma cooperativa, **desde que**: (a) o token não seja conversível em dinheiro nessa ponta (é abate de fatura, não saque); (b) haja **confirmação bilateral** (o titular da UC autoriza receber o token na fatura dele); (c) ambos sejam cooperados da **mesma** cooperativa (guard multi-tenant `A.cooperativaId == B.cooperativaId`).
- O convite familiar (ela convida o marido) **não pode** gerar bônus de indicação (MLM) — senão vira vantagem financeira disfarçada. Marcar o vínculo como "familiar" e **travar o bônus**.

### 8. Cooperado SEM UC (P3)
- Válido se o estatuto vigente cobrir membro sem instalação ("usufrui do ecossistema"). **Depende do registro do estatuto v3 na JUCEES** (achado 10). Enquanto não confirmado, é premissa, não fato.

## As 6 salvaguardas (simultâneas)

1. **(P0) Substância cooperativa real** — matrícula + capital + assembleia + ata documentando admissão e elo comum, antes de qualquer empresa real.
2. **(P0) Parecer trabalhista externo** — antes de habilitar distribuição de token para funcionários de empresa conveniada (a pergunta P0 agravada pela conta de luz).
3. **(P0) Isenção PIS/COFINS como flag configurável** — nunca hardcoded; com fallback contábil (Sprint #8).
4. **(P1) `origemConvenioId` no ledger** — rastrear todo token de origem convênio (defesa trabalhista + tributária).
5. **(P1) Teto de concentração** — ~25% por cooperado nos tokens emitidos via convênio (anti-distribuição-disfarçada).
6. **(P1) Token de origem convênio NÃO conversível em PIX** — manter circuito fechado (abate fatura / paga conta da família / oxida), nunca saque em dinheiro, para a origem empregador.

## Validação externa recomendada (3 frentes)

1. **Advogado trabalhista** — token de empregador pagando conta de luz é salário in natura? Como blindar a empresa e a cooperativa. **(a pergunta P0)**
2. **Advogado/contador cooperativista** — substância da cooperativização de empresa + funcionários; admissão de PJ heterogênea; estatuto e atas; IRPF de token de empregador.
3. **Advogado regulatório (SPB/BCB)** — confirmar que o circuito cooperado-only + abate de fatura (sem saque livre) não configura emissor de instrumento de pagamento (Lei 12.865; Resolução BCB 150/2021).

## Próximos passos priorizados

1. **Fase 0 — Jurídico (pré-requisito, NÃO-código, paralelo):** confirmar registro do estatuto v3 na JUCEES; convocar/documentar assembleia; contratar os 3 pareceres externos; redigir cláusula de natureza do token no contrato de convênio.
2. **Plumbing decision-independent (pode construir já, não expõe nada):** `origemConvenioId` no ledger (salvaguarda 4) + marcação "recebe créditos GD" como **dado** no cadastro V2 (não bloqueia).
3. **Decisão de produto pendente (E1):** o que acontece com os tokens já distribuídos quando o funcionário sai da empresa — ficam, são recomprados, ou expiram? Sem decisão, há tokens órfãos no saldo pessoal.
4. **Sprint #8 (Segregada):** isenção PIS/COFINS configurável + segregação 2 linhas + teto 25% + campo natureza no ledger.

## Normas citadas

- Lei 5.764/71 Art. 4º (objeto comum), 18 (registro), 79 (ato cooperativo isento) · CLT Art. 457 §1º e 458 caput (salário in natura) + Súmula 367 TST + Art. 455 (solidariedade) · STF Tema 536 (RE 599.362 — PIS/COFINS sobre atos cooperativos, em julgamento) · STJ Tema 986 (IR sobre sobras) · CTN Art. 149 VII (simulação/reclassificação) · Lei 12.865/2013 + Resolução BCB 150/2021 Art. 3º (arranjo de pagamento fechado) · CPC 47 + NBC TG-07 (vouchers / cooperativas).

---
*Parecer read-only. Não substitui validação por contador e advogados habilitados. Nenhum código foi alterado. Companheiro da spec `docs/ESPEC-CONVENIO-TOKEN-COOPERADO-2026-06-19.md`.*
