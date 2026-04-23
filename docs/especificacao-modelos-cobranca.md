# Modelos de Cobrança do SISGD

## Princípio fundamental

Todos os modelos dependem dos créditos compensados na fatura
da concessionária (dado vindo do OCR). A diferença entre eles
está no CÁLCULO DO VALOR UNITÁRIO DO kWh.

Ortogonal aos modelos, cooperado escolhe modoRemuneracao
(DESCONTO ou CLUBE). 6 combinações funcionais possíveis.

## FIXO_MENSAL

Valor de cobrança fixo contratual, mês após mês.

- Fonte: contrato
- Independente de consumo, créditos, fatura
- Reajuste: manual pelo admin

Exemplo: R$ 500/mês fixo.

## CREDITOS_COMPENSADOS

Valor unitário do kWh TRAVADO no contrato — já com desconto
aplicado.

- Contrato guarda o VALOR FINAL (não tarifa cheia + %desconto)
- Fonte dos kWh: créditos compensados da fatura EDP (via OCR)
- Cálculo: créditos compensados × valor travado
- Reajuste: manual pelo admin

Exemplo:
- Tarifa cheia no momento do contrato: R$ 1,00/kWh
- Desconto: 20%
- Valor travado no contrato: R$ 0,80/kWh
- Créditos compensados no mês: 10.000 kWh
- Cobrança: 10.000 × R$ 0,80 = R$ 8.000

Se tarifa da EDP subir de R$ 1,00 pra R$ 1,20 no ano seguinte,
o valor travado R$ 0,80 NÃO MUDA sozinho. Só admin reajusta.

## CREDITOS_DINAMICO

Valor unitário do kWh CALCULADO dinamicamente da fatura mensal,
mantendo o desconto contratual percentual.

- Contrato guarda o PERCENTUAL de desconto (não valor final)
- Fonte dos kWh: créditos compensados da fatura EDP (via OCR)
- Cálculo:
  1. Extrai tarifa cheia do mês (TUSD + TE) da fatura/tabela
  2. Aplica desconto contratual sobre tarifa cheia
  3. Multiplica por créditos compensados
- Reajuste: automático mês a mês (acompanha variação tarifária)

Exemplo:
- Desconto contratual: 20%
- Tarifa cheia do mês (da fatura): R$ 1,05/kWh
- Valor aplicado: R$ 0,84/kWh
- Créditos compensados: 10.000 kWh
- Cobrança: 10.000 × R$ 0,84 = R$ 8.400

Mês seguinte, tarifa cheia passa a R$ 1,10:
- Valor aplicado: R$ 0,88/kWh (desconto 20% mantido)
- Cobrança: 10.000 × R$ 0,88 = R$ 8.800

## Diferença prática entre os 3 modelos

Cenário: tarifa EDP sobe de R$ 1,00 pra R$ 1,20 ao longo do ano.

| Modelo | Valor cobrado por kWh | Comentário |
|---|---|---|
| FIXO | Valor total fixo, sem kWh | Previsibilidade máxima |
| COMPENSADOS | R$ 0,80 (travado) | Economia cresce com reajuste EDP |
| DINAMICO | R$ 0,96 (20% off R$ 1,20) | Desconto relativo constante |

Cada modelo serve perfis:
- Avesso a reajuste → FIXO
- Proteção contra alta de tarifa → COMPENSADOS
- Acompanhamento de mercado → DINAMICO

## Combinação com modoRemuneracao

| Modelo | DESCONTO | CLUBE |
|---|---|---|
| FIXO | paga valor fixo reduzido | paga valor fixo cheio + tokens |
| COMPENSADOS | paga créd × kWh travado | paga créd × kWh travado cheio + tokens |
| DINAMICO | paga créd × kWh mensal (com desconto) | paga créd × kWh mensal cheio + tokens |

Nos casos CLUBE, o cooperado paga equivalente sem desconto
(o que pagaria sem ter optado pelo Clube) e acumula tokens
equivalentes ao desconto "não aplicado".

## Tabela de tarifas (TarifaConcessionaria)

Pra DINAMICO funcionar, sistema precisa da tarifa cheia do mês.

Fluxo:
- OCR extrai tarifa da fatura do mês
- Admin valida em TarifaConcessionaria (governança)
- Sistema usa tarifa validada no cálculo

Se tarifa não validada no dia da cobrança:
- Opção A: aguarda admin validar
- Opção B: usa fallback FIXO com ajuste retroativo (Sprint 14)

## Estado atual (24/04/2026)

- FIXO_MENSAL: FUNCIONAL
- CREDITOS_COMPENSADOS: BLOQUEADO (BLOQUEIO_MODELOS_NAO_FIXO=true)
- CREDITOS_DINAMICO: BLOQUEADO (mesmo flag)

## Implementação planejada (Sprint 14)

- 1 service compartilhado que consome créditos compensados
- 2 modos de cálculo: travado (COMPENSADOS) vs dinâmico (DINAMICO)
- Integração com TarifaConcessionaria pra DINAMICO
- Fallback provisório com ajuste retroativo
- Desligar BLOQUEIO_MODELOS_NAO_FIXO após validação

Estimativa: 5-8 dias.

## Perguntas em aberto pra Sprint 14

1. Tarifa cheia pra DINAMICO: OCR extrai corretamente sempre?
2. TarifaConcessionaria precisa aprovação SUPER_ADMIN ou ADMIN
   parceiro valida?
3. Fallback provisório: limite de meses consecutivos sem dado real?
4. Cooperado pode mudar de modelo depois do contrato?
   (ex: COMPENSADOS → DINAMICO)
