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

## Estado atual (atualizado 2026-05-14 pós-Fase B)

- **FIXO_MENSAL: FUNCIONAL E ATIVO EM PRODUÇÃO**
  - Engine: `faturas.service.ts:1862-1902` (Fase B.5)
  - Snapshot Contrato: `valorContrato`, `valorCheioKwhAceite`
- **CREDITOS_COMPENSADOS: IMPLEMENTADO + VALIDADO E2E SINTÉTICO 6/6 ✓ (runtime bloqueado)**
  - Engine: `faturas.service.ts:1904-1952` (Fase B — Decisão B33, sem duplo desconto)
  - Snapshots Contrato: `tarifaContratual`, `valorCheioKwhAceite`, `baseCalculoAplicado`, `tipoDescontoAplicado`
  - Runtime ainda bloqueado por `BLOQUEIO_MODELOS_NAO_FIXO` (default `true`)
  - Validação humana E2E + canário 1 cooperado real pendentes
- **CREDITOS_DINAMICO: IMPLEMENTADO + VALIDADO E2E SINTÉTICO 6/6 ✓ (runtime bloqueado)**
  - Engine: `faturas.service.ts:1954-2003` via helper canônico `lib/calcular-tarifa-contratual.ts`
  - Snapshots FaturaProcessada: `valorCheioKwh`, `tarifaSemImpostos`
  - Runtime ainda bloqueado pelo mesmo flag

### Frontend (Fase C.1, commit `cb1ec43`)

- **SUPER_ADMIN:** vê os 3 modelos habilitados no dropdown `/dashboard/planos/novo` com aviso laranja sobre bloqueio runtime
- **ADMIN parceiro:** vê COMPENSADOS/DINAMICO com `disabled`
- `PlanosService.create()` **não** tem guard — permite criar planos COMPENSADOS/DINAMICO no banco (foram criados 6 planos `B5-*` na cooperativa de teste `TESTE-FASE-B5` pelo seed `seed-fase-b5.ts`)

### 7 enforcement points runtime ainda ATIVOS

1. `motor-proposta.service.ts:551-558` — `aceitar()` proposta
2. `faturas.service.ts:595-602` — `gerarCobrancaPosFatura` (Caminho A OCR)
3. `faturas.service.ts:1013-1021` — `aprovarFatura` loop por contratos
4. `contratos.service.ts:125-127` — helper `isBloqueioAtivo()`
5. `contratos.service.ts:129-150, 335-338` — `validarModeloNaoBloqueado()` + bloqueio em `update()`
6. `contratos/dto/{create,update}-contrato.dto.ts` — decorator `@IsModeloNaoBloqueado`
7. `planos.service.ts:91-96` — esconde planos não-FIXO da vitrine pública

## Pré-condições pra desligar BLOQUEIO_MODELOS_NAO_FIXO

1. Validação humana E2E com cooperados teste novos (Fase B.5 — playbook em `docs/sessoes/2026-05-03-fase-b5-validacao-e2e.md`)
2. Canário 1 cooperado CoopereBR migrando FIXO→COMPENSADOS em produção
3. Fase C.2 (UI plano avançada) + Fase C.3 (display economia)
4. Após canário ok: setar env `BLOQUEIO_MODELOS_NAO_FIXO=false` no `.env` de prod + restart PM2

## Perguntas em aberto pra Sprint 14

1. Tarifa cheia pra DINAMICO: OCR extrai corretamente sempre?
2. TarifaConcessionaria precisa aprovação SUPER_ADMIN ou ADMIN
   parceiro valida?
3. Fallback provisório: limite de meses consecutivos sem dado real?
4. Cooperado pode mudar de modelo depois do contrato?
   (ex: COMPENSADOS → DINAMICO)
