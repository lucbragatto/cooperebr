# Contabilidade do Clube + CooperToken

## Princípio fundamental

Token tem valor em reais, então toda movimentação de token tem
impacto contábil — mesmo sem movimentar dinheiro físico. O SISGD
mantém DOIS livros paralelos que precisam conversar:

1. LancamentoCaixa — livro caixa de R$ real
2. CooperTokenLedger — livro de tokens

Todo token em circulação representa passivo do parceiro com o
cooperado. É o mesmo conceito de vale-presente, milhagem aérea,
saldo Starbucks.

## 4 eventos contábeis

### Evento A — Emissão de token (cooperado paga fatura cheia no CLUBE)

Cooperado paga R$ 500 cheios em vez dos R$ 400 que pagaria no
Desconto. Sistema emite 500 tokens valendo R$ 100.

Lançamento contábil correto:
```
D: Caixa                 R$ 500
C: Receita de Energia    R$ 500
D: Despesa de Tokens     R$ 100
C: Passivo - Tokens      R$ 100
```

Traduzindo pro SISGD:
- LancamentoCaixa ENTRADA R$ 500 — já existe
- CooperTokenLedger CREDITO 500 tokens — já existe
- **FALTA:** LancamentoCaixa de provisão do passivo R$ 100.
  Categoria sugerida: `PROVISAO_TOKEN_CLUBE`

### Evento B — Cooperado usa token pra abater fatura

Fatura R$ 500, usa 500 tokens (R$ 100), paga R$ 400.

Lançamento:
```
D: Passivo - Tokens      R$ 100
C: Receita de Energia    R$ 100
D: Caixa                 R$ 400
C: Receita de Energia    R$ 400
```

Traduzindo:
- CooperTokenLedger DEBITO (ABATIMENTO_ENERGIA) — já existe
- LancamentoCaixa ENTRADA R$ 400 — já existe (parte em dinheiro)
- **FALTA:** reduzir o passivo de R$ 100 com lançamento espelho
  (o token saiu do ledger mas o livro caixa ainda vê "passivo aberto").
  Categoria sugerida: `AMORTIZACAO_TOKEN_CLUBE`

### Evento C — Token expira (breakage)

500 tokens param 12 meses, expiram, parceiro não deve mais R$ 100.

Lançamento:
```
D: Passivo - Tokens       R$ 100
C: Receita Não Operacional R$ 100 (breakage)
```

Traduzindo:
- Cron de expiração já previsto Sprint 10
- CooperTokenLedger EXPIRACAO (enum já existe)
- **FALTA:** LancamentoCaixa ENTRADA não operacional.
  Categoria sugerida: `RECEITA_BREAKAGE_TOKEN`

### Evento D — Parceiro-cooperado usa tokens recebidos na própria fatura

Parceiro (restaurante) recebeu 500 tokens de 10 cooperados
(rodadas de chopp). Parceiro também é cooperado da CoopereBR.
Usa os 500 tokens pra abater R$ 100 da fatura de energia dele.

Na contabilidade da CoopereBR:
```
D: Passivo - Tokens      R$ 100
C: Receita de Energia    R$ 100
```

O token percorreu: cooperado emissor → parceiro → cooperativa.
Dívida cancelada contra serviço prestado. Loop fechado.

## Estado atual (23/04/2026)

- Os 4 eventos estão implementados no CooperTokenLedger ✓
- LancamentoCaixa de eventos com dinheiro real ✓
- **Ponte automática entre os dois livros NÃO EXISTE** ❌

Hoje, contabilmente, o parceiro:
- Vê caixa real no LancamentoCaixa (R$ entrando)
- Vê tokens no CooperTokenLedger (CTK movendo)
- NÃO vê passivo de tokens em relatório algum
- NÃO vê breakage como receita

## Quando implementar

### Não implementar em Sprint 9 ou 10
- Sprint 9: fluxo QR + ofertas showcase (ledger só)
- Sprint 10: expiração + desvalorização + cron

### Sprint 11 — Contabilidade do Clube ⭐
- Categorias novas no LancamentoCaixa:
  - `PROVISAO_TOKEN_CLUBE` (passivo)
  - `AMORTIZACAO_TOKEN_CLUBE` (redução passivo)
  - `RECEITA_BREAKAGE_TOKEN` (expiração)
- Hooks automáticos em cada operação do ledger
- Relatórios:
  - Passivo de tokens em circulação (instantâneo)
  - Breakage mensal/anual
  - DRE com linha "Clube"
- **Antes de codificar:** Luciano conversa com contador de parceiro

## Referência

Modelo análogo: programas de fidelidade formais (Méliuz, Livelo,
Dotz, Smiles). Todos tratam saldo não usado como passivo circulante
e expiração como receita não operacional (breakage).

## Perguntas em aberto pro Sprint 11

1. Provisão é instantânea (ao emitir) ou diferida (amortizada)?
2. Breakage: reconhece dia a dia ou no vencimento do token?
3. Desvalorização progressiva: como registra no livro mês a mês?
4. Token que vira PIX (resgate): emite nota fiscal? IR retido?
