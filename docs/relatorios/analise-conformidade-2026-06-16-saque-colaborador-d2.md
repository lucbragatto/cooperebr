# Parecer de Conformidade — Saque do Colaborador Comum em CooperToken (Sprint D2, M41)

> **Data:** 2026-06-16 · **Autor:** subagent `cooperebr-analista-conformidade` (orquestrado por claude.ai)
> **Objeto:** autorização para ativar `SAQUE_COLABORADOR_PRODUCAO_LIBERADO=true` em produção real.
> **Status:** read-only — nenhum código alterado. Validação externa recomendada (advogado trabalhista + contador + advogado regulatório).

## Sumário executivo

Funcionalidade M41 (Sprint D2): habilita o cooperado comum (PF, não-estabelecimento) a sacar CooperTokens em R$ via PIX, nascida desligada por gate duplo (`Cooperativa.saqueColaboradorAtivo` + `SAQUE_COLABORADOR_PRODUCAO_LIBERADO`).

**Conclusão central:** o risco mais elevado está na frente **TRABALHISTA (ALTO/P0)** — tokens distribuídos por empresa conveniada a funcionários e depois sacados em PIX podem ser lidos como **salário in natura diferido** (CLT Art. 458), porque a **conversibilidade em dinheiro** é o teste mais relevante. Tributário é MÉDIO-ALTO (STF Tema 536 em julgamento incerto; IRPF do membro depende da origem). Regulatório (Lei 12.865) é MÉDIO, gerenciável pelo circuito cooperado-only. Lançamento contábil correto, com ressalvas já catalogadas.

**Recomendação:** o gate pode ser liberado, **mas só com 5 salvaguardas simultâneas e segmentando por ORIGEM do token.** Validação externa recomendada antes de ativar para qualquer empresa conveniada.

## Tabela de achados

| # | Dimensão | Status | Sev | Norma | Recomendação |
|---|---|---|---|---|---|
| 1 | Tributário — IRPF (token desconto fatura) | PARCIAL | P2 | Lei 5.764 Art. 79 + STJ | Documentar origem do token |
| 2 | Tributário — IRPF (token bonificação admin) | NÃO CONFORME | P1 | Art. 4º VII + Art. 79 | Exigir ata de assembleia antes de habilitar |
| 3 | Tributário — PIS/COFINS (taxa zero) | OK condicional | P1 | STF Tema 536 (em julgamento) | Monitorar Tema 536; fallback se incidência |
| 4 | Regulatório — Lei 12.865 arranjo pagamento | PARCIAL | P1 | Resolução BCB 150/2021 Art. 3º | Manter `PENDENTE_APROVACAO_COOP` obrigatório |
| 5 | **Trabalhista — token empresa→funcionário + saque PIX** | **NÃO CONFORME** | **P0** | **CLT Art. 458 caput** | **Bloquear até parecer trabalhista externo** |
| 6 | Trabalhista — token desconto fatura sacado pelo próprio PF | OK | P3 | CLT 458 (sem relação de trabalho) | Nenhuma ação |
| 7 | Contábil — lançamento D Passivo / C Caixa | PARCIAL | P2 | CPC 47 + NBC TG-07 + FUNDACAO §2.1 | Corrigir tipagem 5.1.02 (Sprint #8) |
| 8 | Contábil — falta campo naturezaCooperativa | NÃO CONFORME | P2 | NBC TG-07 + defesa Tema 536 | Incluir no Sprint #8 Segregada |

## Análise por dimensão (resumo)

### 1. Tributário
- **Token de desconto de fatura própria:** devolução diferida de valor que o cooperado já pagou → sem acréscimo patrimonial → **sem IRPF**. Análogo a resgatar vale-compras de desconto da própria compra.
- **Token de bonificação admin (emissão gratuita):** ao sacar, recebe R$ que nunca pagou → enquadrar como **SOBRA** (Art. 79), isento de IRPF SE: (i) proporcional às operações de energia (Art. 4º VII), (ii) aprovado em assembleia, (iii) documentado como sobra (não "prêmio"). Sem o rito → Receita pode enquadrar como prêmio (IRRF 20%) ou rendimento tributável.
- **PIS/COFINS no saque:** a cooperativa quita passivo (não recebe nada); com taxa zero, valor bruto é trânsito → sem receita → sem PIS/COFINS. Correto (CPC 47 + decisão 04/06).
- ⚠️ **STF Tema 536 em julgamento** (plenário físico, placar zerado por destaque Gilmar Mendes). Se concluir pela incidência sobre atos atípicos, e o saque PIX for lido como "serviço financeiro" fora do objeto social de energia → risco de autuação retroativa. Monitorar.

### 2. Regulatório (Lei 12.865)
- Defesa sólida: **circuito cooperado-only** (não há "público" nem "múltiplos recebedores externos") + **volume << R$ 20 bi/ano** (limiar BCB 150/2021 Art. 3º para arranjo fechado isento de supervisão).
- **Diferença material estabelecimento × membro comum:** o estabelecimento (PJ comercial) resgata voucher recebido em troca de venda — liquidação comercial clássica. O membro PF saca sem venda antecedente — mais parecido com resgate de fidelidade. Risco: o BCB pode enxergar token-com-saque-PIX-livre como **conta de pagamento pré-paga**.
- **Defesa decisiva:** manter o gate `PENDENTE_APROVACAO_COOP` (aprovação manual de cada resgate do colaborador — já implementado) + limite por transação/diário (já implementado) + narrativa estatutária ("saque cooperativo", não "conta de pagamento").

### 3. Trabalhista (RISCO MAIS ALTO — P0)
- **A mudança material do D2:** antes, o token do funcionário só abatia fatura / pagava em estabelecimento / oxidava — **não-conversível em dinheiro** = benefício de circuito fechado confortável. **Depois do D2, o mesmo token vira R$ via PIX** → a **conversibilidade em dinheiro** é o fator que mais pesa pra caracterizar **salário in natura** (CLT Art. 458 caput).
- Precedente: vales que permitiam saque em dinheiro foram reiteradamente enquadrados como salário pelo TST (até Lei 14.442/2022, pontual para alimentação). Para tokens, não há lei de exclusão.
- **Consequências pra empresa conveniada:** integração no salário → reflexos em 13º, férias, FGTS, INSS patronal + multas retroativas + ação coletiva.
- **Distinção crítica:** cooperado PF que acumulou token do **desconto da própria fatura de energia** e saca → **risco ZERO** (não há empregador). Funcionário que recebeu token **da empresa conveniada** e saca → **risco ALTO**.
- A cláusula de convênio protege a cooperativa como parte, mas há risco reputacional + solidariedade (CLT Art. 455, grupo econômico).

### 4. Contábil
- `lancarResgatePix`: `D Passivo Tokens (5.1.02) / C Caixa` pelo valor líquido — **economicamente correto** (CPC 47 + NBC TG-07 + FUNDACAO §2.1).
- Ressalvas já catalogadas: (a) conta 5.1.02 tipada DESPESA (deveria PASSIVO) — distorce DRE, efeito líquido correto; (b) falta campo `naturezaCooperativa='PROPRIO'` (defesa documental do Tema 536). Ambos no Sprint #8 Segregada.

## Recomendação acionável — segmentar por ORIGEM do token

| Origem do token | Saque PIX habilitável agora? | Condição |
|---|---|---|
| Desconto de fatura própria (`FATURA_CHEIA_TOKEN`) | **SIM** — após Salvaguardas 4+5 | BAIXO risco |
| Bonificação admin (`BONIFICACAO_ADMIN`) | **Não** — pendente Salvaguarda 2 (ata assembleia) | MÉDIO risco |
| Tokens de empresa conveniada | **Não** — pendente Salvaguarda 3 (parecer trabalhista) | ALTO risco |

### As 5 salvaguardas (simultâneas)
1. **(P0) Segmentar por origem** — primeira ativação restrita a tokens de desconto de fatura própria. Usar o campo `natureza` do ledger como filtro no `solicitarResgate`. Bloquear bonificação admin + empresa conveniada.
2. **(P0, bonificação admin) Ata de assembleia** aprovando distribuição de sobras em token + conversão PIX + proporcionalidade às operações de energia (Art. 4º VII).
3. **(P0, empresa conveniada) Parecer de advogado trabalhista** antes de habilitar saque de tokens com `distribuicaoConvenioId != null`.
4. **(P1) Manter `PENDENTE_APROVACAO_COOP` obrigatório** para colaborador comum — nunca auto-aprovar (defesa BCB + origem trabalhista duvidosa).
5. **(P1) Disclaimer na UI** antes do saque: "Este saque é liquidação de um voucher CooperToken emitido pela cooperativa. Não é remuneração, salário ou operação financeira. O valor pode precisar ser declarado no IR conforme a origem — consulte um contador." Registrar aceite com timestamp.

## Validação externa recomendada
1. **Advogado trabalhista** — antes de habilitar saque para funcionários de empresas conveniadas (a pergunta P0).
2. **Contador de cooperativismo** — IRPF de token de bonificação admin sacado; necessidade de ata; fallback PIS/COFINS se Tema 536 incidir.
3. **Advogado regulatório (SPB/BCB)** — confirmar que o modelo cooperado-only + aprovação manual não enquadra como emissor de instrumento de pagamento pré-pago.

## Próximos passos priorizados
1. Implementar filtro por `natureza` do ledger no `solicitarResgate` (Salvaguarda 1) — Code.
2. Disclaimer de Salvaguarda 5 na UI + aceite com timestamp — Code.
3. Convocar assembleia (se quiser habilitar saque de bonificação admin).
4. Contratar parecer trabalhista externo (empresa conveniada).
5. Monitorar STF Tema 536; preparar fallback PIS/COFINS.
6. Priorizar Sprint #8 (Segregada): tipagem 5.1.02 + campo naturezaCooperativa.

## Normas citadas
- Lei 5.764/71 Art. 4º VII, 79 (ato cooperativo; sobra proporcional) · Lei 12.865/2013 Art. 6º (arranjo de pagamento) · Resolução BCB 150/2021 Art. 3º (circuito fechado < R$ 20 bi isento) · CLT Art. 458 caput (salário in natura) · TST Súmula 342 · STF Tema 536 (RE 599.362 — em julgamento) · STJ Tema 986 / REsp 1.111.513 (IR sobre sobras) · CPC 47 (vouchers) · NBC TG-07 (cooperativas).

---
*Parecer read-only. Não substitui validação por contador e advogado habilitados. Nenhum código foi alterado.*
