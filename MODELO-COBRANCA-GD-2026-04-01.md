# Modelo de Cobrança GD — CoopereBR
## Status: Em discussão | Data: 2026-04-01

---

## Contexto

5 faturas EDP-ES de cooperados com GD foram analisadas para entender como a compensação funciona e como a CoopereBR deve cobrar. O OCR já extrai todos os dados necessários.

---

## Padrões confirmados nas faturas

- **Tarifa de compensação TUSD:** ~0,5711/kWh (congelada no mês de geração do crédito)
- **Tarifa de compensação TE:** ~0,3908/kWh
- **ICMS:** NÃO é devolvido na compensação (fica com a distribuidora)
- **CIP:** NÃO é compensada — cobrança fixa
- **FIFO:** EDP consome saldo do mais antigo para o mais recente
- **Base de cobrança justa:** `creditosRecebidosKwh` do mês (o que a usina entregou agora, não o saldo acumulado)

---

## Os 3 modelos existentes no código hoje

### FIXO_MENSAL
```
kwhCobranca = kwhContrato (fixo no contrato, independente da geração)
tarifaKwh   = TUSD + TE cadastrada no sistema (não lê fatura)
valorBruto  = kwhCobranca × tarifaKwh
valorFinal  = valorBruto × (1 - desconto)
```
- Cooperado paga o mesmo todo mês
- Risco: cobra mais do que entregou se geração cair

### CREDITOS_COMPENSADOS (atual — comportamento igual ao DINAMICO, precisa corrigir)
```
kwhCobranca = min(kwhEntregue, kwhContrato)  ← usa geração da usina, NÃO a fatura
tarifaKwh   = TUSD + TE cadastrada no sistema
valorBruto  = kwhCobranca × tarifaKwh
valorFinal  = valorBruto × (1 - desconto)
```

### CREDITOS_DINAMICO (atual)
```
kwhCobranca = min(kwhEntregue, kwhContrato)
tarifaKwh   = TUSD + TE vigente no sistema (atualizável pelo admin)
valorBruto  = kwhCobranca × tarifaKwh
valorFinal  = valorBruto × (1 - desconto)
```

---

## Dois modelos propostos (a partir da fatura real)

O OCR já extrai os campos necessários: `creditosRecebidosKwh`, `tarifaTUSD`, `tarifaTE`, `totalAPagar`, `consumoAtualKwh`, `icmsValor`, `pisCofinsValor`.

### Modelo A — "Tarifa unitária da fatura" (CREDITOS_COMPENSADOS correto)
```
base       = creditosRecebidosKwh (da fatura EDP, via OCR)
tarifa     = tarifaTUSDComp + tarifaTEComp (das linhas de compensação da fatura)
economiaBruta = base × tarifa
valorFinal = economiaBruta × (1 - desconto)
```
- Mais preciso: usa a tarifa real que a EDP aplicou
- Requer fatura do cooperado todo mês
- Exemplo Cláudio (15% desc): 628,7 × 0,9619 × 0,85 = **R$ 514,08**

### Modelo B — "Valor cheio reconstruído"
```
economiaBruta = creditosRecebidosKwh × (tarifaTUSD + tarifaTE)
valorSemGD    = totalAPagar + economiaBruta
kWhMedioReal  = valorSemGD / consumoAtualKwh   ← inclui CIP, ICMS, PIS/COFINS proporcionais
valorFinal    = creditosRecebidosKwh × kWhMedioReal × (1 - desconto)
```
- Captura todos os encargos proporcionalmente (incluindo ICMS, CIP, tributos)
- Cobra um pouco mais pois o kWh médio inclui encargos fixos
- Exemplo Cláudio (sem GD seria ~R$778): kWhMédio = 778/890 = R$0,874/kWh → 628,7 × 0,874 × 0,85 = **R$ 467,02**

---

## Comparativo numérico (Cláudio, 628,7 kWh, 15% desconto)

| Modelo | kWh base | Tarifa | Valor CoopereBR |
|--------|----------|--------|-----------------|
| FIXO_MENSAL | 500 (contrato) | R$ 0,79 | R$ 335,75 |
| CREDITOS_DINAMICO (atual) | 628,7 (geração) | R$ 0,79 | R$ 422,16 |
| Modelo A (tarifa fatura) | 628,7 (OCR) | R$ 0,9619 | **R$ 514,08** |
| Modelo B (valor cheio) | 628,7 (OCR) | R$ 0,874 | R$ 467,02 |

---

## Decisões pendentes (aguardando Luciano)

1. **Qual modelo usar para CREDITOS_COMPENSADOS?**
   - Modelo A (tarifa unitária da fatura) — mais preciso tecnicamente
   - Modelo B (valor cheio reconstruído) — captura todos os encargos
   - Outra abordagem?

2. **Fallback quando o cooperado não manda a fatura no mês?**
   - Estimativa pela participação no saldo (%) × geração da usina?
   - Cobra pelo mês anterior? Cobra pelo kwhContrato?

3. **Fio B (2026):** a tarifa de compensação vai cair progressivamente — incorporar no cálculo agora ou deixar para depois?

4. **Cooperado com saldo acumulado muito alto (ex: Patricia):** sinalizar superdimensionamento de cota no dashboard?

---

## Arquivos de análise

- `memory/analise-fatura-gd-01.md` — Cláudio (B1 Resid, 890 kWh, saldo positivo)
- `memory/analise-fatura-gd-02.md` — Balthazar (B3 Com, 13.217 kWh, saldo zero)
- `memory/analise-fatura-gd-03.md` — Patricia (B1 Resid, 272 kWh, saldo acumulando)
- `memory/analise-fatura-gd-04.md` — Rodrigo (B1 Resid, 829 kWh, múltiplos saldos FIFO)
- `memory/analise-fatura-gd-05.md` — RCA (B3 Com, 14.845 kWh, saldo zero)
