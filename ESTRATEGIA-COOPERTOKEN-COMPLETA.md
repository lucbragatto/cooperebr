# Estratégia CooperToken — Modelo Completo
**Versão:** 1.0 | **Data:** 2026-03-31 | **Autor:** Assis 🤝

---

## 1. O Plano Token — Como Funciona

### Dois planos disponíveis para o cooperado

| | Plano Desconto (padrão) | Plano Token |
|--|------------------------|-------------|
| Paga CoopereBR | R$800 (ex: 20% off de R$1.000) | R$1.000 (cheio) |
| Desconto energia | R$200 no bolso | — |
| CooperTokens recebidos | — | 200 CT |
| Saldo líquido | R$200 economizados | R$200 em CT para usar com parceiros |
| **Para quem faz sentido** | Quem quer dinheiro | Quem quer experiências/benefícios |

> Nota: R$150 de encargos fixos (ilum. pública + assinatura trifásico) sempre pagos direto à EDP, independente do plano.

### Por que a conta fecha para a CoopereBR
No plano token, o cooperado paga R$1.000 ao invés de R$800.
CoopereBR recebe R$200 extras → usa para remunerar parceiros → token tem lastro real.

---

## 2. Taxa de Repasse ao Parceiro

**Configurável por parceiro e por negociação — sem valor fixo.**

Exemplos de configuração:

| Parceiro | Taxa repasse | CoopereBR fica | Parceiro recebe |
|----------|-------------|----------------|-----------------|
| Uaine (vinho) | 80% | R$40 | R$160 por R$200 de CT usados |
| Restaurante A | 70% | R$60 | R$140 |
| Eletroposto | 90% | R$20 | R$180 (energia do próprio estoque) |

**Configuração no admin:** cada parceiro tem seu próprio percentual de repasse + modelo de conversão.

---

## 3. Conversão do Token no Parceiro

**Duas modalidades coexistem — configurável por parceiro:**

### Modalidade A — 1 CT = R$1,00 fixo
- Simples, fácil de comunicar
- Ex: 200 CT = R$200,00 de desconto no parceiro

### Modalidade B — Fator de conversão variável
- Parceiro define taxa de câmbio própria
- Ex: 100 CT = R$120 no parceiro (fator 1.2x — parceiro valoriza mais o token para atrair cooperados)
- Ou: 100 CT = R$80 (fator 0.8x — parceiro com margem menor)
- Ambos configuráveis no admin por parceiro

---

## 4. Eletroposto CoopereBR — Modelo de Assinatura 10 Anos

### O modelo
```
Investidor assina plano 10 anos → paga mensalidade fixa
CoopereBR instala/opera o eletroposto no local do investidor
Energia fornecida: 600k kWh represados (até 2028) + usinas novas
Motorista EV carrega → paga em dinheiro ou CooperTokens
```

### Por que 10 anos
- Drena os 600k kWh antes de maio/2028
- Receita recorrente previsível para o investidor
- Cria demanda permanente para novas usinas após 2028
- Fidelidade garantida por contrato

### Mix de postos para drenar 600k kWh em ~24 meses

| Potência | kWh/mês (8h/dia) | Qtd sugerida | kWh/mês total |
|----------|-----------------|--------------|---------------|
| 80 kW | ~19.200 kWh | 2 | 38.400 |
| 60 kW | ~14.400 kWh | 2 | 28.800 |
| 40 kW | ~9.600 kWh | 3 | 28.800 |
| 22 kW | ~5.280 kWh | 3 | 15.840 |
| 11 kW | ~2.640 kWh | 2 | 5.280 |
| **Total** | | **~12 postos** | **~117.000 kWh/mês** |

Com 12 postos: 600.000 kWh / 117.000 kWh/mês = **~5 meses para drenar** (conservador: 12-18 meses)

### Uso de CooperTokens no eletroposto
```
Motorista chega ao eletroposto
Carrega 80 kWh (valor: 80 × R$2,50 = R$200)
Tem 200 CT → deduz R$200 → paga R$0
CoopereBR: usou kWh do estoque represado + recebeu CT que foram trocados por R$200 do plano token
```

### Funil de aquisição de novos cooperados
```
Motorista EV usa eletroposto
  → Descobre desconto para cooperados
  → Traz UC residencial/comercial
  → Vira cooperado + recebe tokens
  → Indica outros motoristas
  → MLM CoopereBR rodando
```

---

## 5. O Ecossistema Completo

```
USINAS (3 arrendadas + novas)
    ↓ energia
COOPEREBR (gestão + plataforma + bot WA)
    ↓ distribui em dois planos
COOPERADOS
  ├── Plano Desconto: economiza R$200/mês na fatura
  └── Plano Token: recebe 200 CT/mês
              ↓ usa tokens em
PARCEIROS
  ├── Uaine (distribuidora de vinhos)
  ├── Restaurantes parceiros
  └── Eletropostos CoopereBR (assinatura 10 anos)
              ↓ eletroposto atrai
MOTORISTAS EV
    → novos cooperados em potencial
    → indicam outros → MLM
              ↓ demanda crescente
NOVAS USINAS
    ↓ alimentam o ecossistema
```

---

## 6. Pendências para Implementação

### Imediato (sistema)
- [ ] Módulo PlanoToken: cooperado escolhe plano desconto ou token
- [ ] Módulo Parceiros: cadastro + taxa de repasse configurável + modalidade de conversão
- [ ] Eletroposto: UC parceira, consumo registrado, dedução em CT
- [ ] Frontend portal cooperado: saldo CT + onde gastar + mapa de parceiros

### Médio prazo (jurídico/comercial)
- [ ] Verificar regulação ANEEL para operação de eletroposto por cooperativa GD
- [ ] Precificar plano de assinatura 10 anos para investidor
- [ ] Definir parceiro de hardware (marca de carregador EV)
- [ ] Negociar com Uaine e restaurantes taxa de repasse

### Estratégico
- [ ] C2: Contestação ANEEL sobre os 600k kWh (Lei 14.300/2022 exceção cooperativista)
- [ ] C3: Reestruturação cadastro usinas na EDP

---

## 7. Próximos Passos Imediatos

1. **Architect** → desenhar módulo PlanoToken + Parceiros + Eletroposto
2. **Claude Code** → implementar (após blueprint)
3. **Luciano** → verificar regulação ANEEL para eletroposto
4. **Luciano** → contato com Uaine/restaurantes para proposta formal

---

*Documento gerado por Assis 🤝 — CoopereBR*
*Baseado em sessão estratégica com Luciano — 2026-03-31*
