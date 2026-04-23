# Cadeia Hangar — Distribuição (24/04/2026)

## Seção 1 — Estrutura geral

| Convênio | Membros | DESCONTO | CLUBE |
|---|---|---|---|
| Hangar (EMPRESA) | 165 | 82 | 83 |
| Moradas (CONDOMINIO) | 50 | 50 | 0 |
| **Total** | **215** | **132** | **83** |

Breakdown por nível MLM (Hangar):
- Conveniado (Hangar LTDA): 1 (DESCONTO)
- Nível 1 (Professores): 15 (7 DESCONTO + 8 CLUBE)
- Nível 2 (Alunos): 150 (75 DESCONTO + 75 CLUBE)

## Seção 2 — Cadeia MLM do Hangar (árvore)

```
ACADEMIA DE GINASTICA HANGAR LTDA (conveniado, DESCONTO)
├── Prof. 01 — Carol Silva (DESCONTO)
│   └── Alunos 001-010: 10× DESCONTO
├── Prof. 02 — Marcos Oliveira (DESCONTO)
│   └── Alunos 011-020: 10× DESCONTO
├── Prof. 03 — Patricia Santos (DESCONTO)
│   └── Alunos 021-030: 10× DESCONTO
├── Prof. 04 — Roberto Lima (DESCONTO)
│   └── Alunos 031-040: 10× DESCONTO
├── Prof. 05 — Fernanda Costa (DESCONTO)
│   └── Alunos 041-050: 10× DESCONTO
├── Prof. 06 — Guilherme Souza (DESCONTO)
│   └── Alunos 051-060: 10× DESCONTO
├── Prof. 07 — Juliana Ferreira (DESCONTO)
│   └── Alunos 061-070: 10× DESCONTO
├── Prof. 08 — Anderson Pereira (CLUBE)
│   └── Alunos 071-080: 5× DESCONTO + 5× CLUBE
├── Prof. 09 — Luciana Martins (CLUBE)
│   └── Alunos 081-090: 10× CLUBE
├── Prof. 10 — Felipe Rodrigues (CLUBE)
│   └── Alunos 091-100: 10× CLUBE
├── Prof. 11 — Camila Almeida (CLUBE)
│   └── Alunos 101-110: 10× CLUBE
├── Prof. 12 — Thiago Barbosa (CLUBE)
│   └── Alunos 111-120: 10× CLUBE
├── Prof. 13 — Vanessa Ribeiro (CLUBE)
│   └── Alunos 121-130: 10× CLUBE
├── Prof. 14 — Diego Nascimento (CLUBE)
│   └── Alunos 131-140: 10× CLUBE
└── Prof. 15 — Renata Cardoso (CLUBE)
    └── Alunos 141-150: 10× CLUBE
```

## Seção 3 — Tabela de tokens por professor

| Professor | Modo | Alunos | Alunos CLUBE | Tokens pendentes |
|---|---|---|---|---|
| Prof. Carol Silva | DESCONTO | 10 | 0 | 0 |
| Prof. Marcos Oliveira | DESCONTO | 10 | 0 | 0 |
| Prof. Patricia Santos | DESCONTO | 10 | 0 | 0 |
| Prof. Roberto Lima | DESCONTO | 10 | 0 | 0 |
| Prof. Fernanda Costa | DESCONTO | 10 | 0 | 0 |
| Prof. Guilherme Souza | DESCONTO | 10 | 0 | 0 |
| Prof. Juliana Ferreira | DESCONTO | 10 | 0 | 0 |
| Prof. Anderson Pereira | CLUBE | 10 | 5 | 0 |
| Prof. Luciana Martins | CLUBE | 10 | 10 | 0 |
| Prof. Felipe Rodrigues | CLUBE | 10 | 10 | 0 |
| Prof. Camila Almeida | CLUBE | 10 | 10 | 0 |
| Prof. Thiago Barbosa | CLUBE | 10 | 10 | 0 |
| Prof. Vanessa Ribeiro | CLUBE | 10 | 10 | 0 |
| Prof. Diego Nascimento | CLUBE | 10 | 10 | 0 |
| Prof. Renata Cardoso | CLUBE | 10 | 10 | 0 |

**Tokens pendentes = 0** porque:
- Seed criou membros no convênio mas NÃO criou Indicações
- Indicações são criadas pelo `convenios-membros.service.ts:adicionarMembro()` quando `registrarComoIndicacao=true`
- No seed manual usamos `p.convenioCooperado.create()` direto
- Tokens BONUS_INDICACAO só seriam emitidos quando cooperado paga primeira fatura (via `cobranca.primeira.paga`)

## Seção 4 — Totais de tokens pendentes

| Entidade | Tokens pendentes | Tokens disponíveis |
|---|---|---|
| Hangar (conveniado) | 0 | 0 |
| 15 Professores | 0 | 0 |
| 150 Alunos | 0 | 0 |
| **Total** | **0** | **0** |

**Por que zero:** Nenhuma fatura foi gerada ou paga. Tokens só entram no sistema quando:
1. Admin gera cobrança mensal
2. Cooperado paga (webhook Asaas ou darBaixa manual)
3. Se CLUBE: tokens emitidos (saldoPendente até ativar)
4. Se indicação: BONUS_INDICACAO emitido ao indicador

## Seção 5 — Simulação de liberação

Se TODOS os 215 membros pagassem a primeira fatura em 30 dias:

**Premissas:**
- bonusIndicacao = 50 tokens por indicação (constante)
- valorTokenReais = R$ 0,20 (fallback)
- Hangar tem registrarComoIndicacao=true → cada membro gera indicação

**Projeção:**
- 165 membros Hangar × 50 tokens BONUS_INDICACAO = 8.250 tokens pendentes pro indicador de cada
- Professores (15): cada um receberia 50 tokens × 10 alunos = 500 tokens
- Hangar (conveniado): não recebe indicação direta (conveniado ≠ indicador)
- Alunos CLUBE (75): receberiam tokens via fatura cheia (desconto convertido)

**Total estimado após primeira fatura de todos:**
- ~7.500 tokens via BONUS_INDICACAO (150 alunos → 15 professores)
- ~variável tokens via FATURA_CHEIA (75 alunos CLUBE × desconto médio)
- Valor em R$: ~R$ 1.500 (BONUS) + ~R$ 2.250 (FATURA_CHEIA estimado)

## Seção 6 — Moradas da Enseada

50 condôminos, todos DESCONTO:

| Andar | Aptos | modoRemuneracao |
|---|---|---|
| 1 | 101-105 | DESCONTO |
| 2 | 201-205 | DESCONTO |
| 3 | 301-305 | DESCONTO |
| 4 | 401-405 | DESCONTO |
| 5 | 501-505 | DESCONTO |
| 6 | 601-605 | DESCONTO |
| 7 | 701-705 | DESCONTO |
| 8 | 801-805 | DESCONTO |
| 9 | 901-905 | DESCONTO |
| 10 | 1001-1005 | DESCONTO |

**Desconto projetado áreas comuns:**
- 50 membros → faixa 41+ → 12% desconto membros, 5% desconto conveniado
- UC áreas comuns: ~1131 kWh/mês (fixture real)
- Desconto conveniado: 5% × valor da fatura áreas comuns
- Desconto condôminos: 12% × valor da fatura individual de cada um

**Sem indicação:** registrarComoIndicacao=false. Condôminos não geram BONUS_INDICACAO entre si.
