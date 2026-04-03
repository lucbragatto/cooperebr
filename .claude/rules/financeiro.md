# Regra: Cálculos Financeiros

## Arredondamento obrigatório

**Sempre usar `Math.round()` em valores monetários antes de persistir.**

```typescript
// ✅ Correto
const valorCobranca = Math.round(kwhConsumido * tarifaKwh * 100) / 100;

// ❌ Errado — floating point acumula erro
const valorCobranca = kwhConsumido * tarifaKwh;
```

## Fio B — Regra ANEEL

Cobrado progressivamente desde 2023 para:
- GD2 (usinas > 75kW) — desde 2023
- GD1 > 75kW — desde 2023

**Percentual por ano:**
- 2023: 15%
- 2024: 30%
- 2025: 45%
- 2026: **60%** ← atual
- 2027: 75%
- 2028: 100%

```typescript
// Cálculo do Fio B em 2026
const percentualFioB = 0.60;
const economiaBruta = kwhGerado * (tarifaTotal - tarifaCooperativa);
const descontoFioB = kwhGerado * tarifaFioB * percentualFioB;
const economiaLiquida = economiaBruta - descontoFioB;
```

## Tarifa EDP-ES (Fev/2026, B1 residencial)

- TUSD líquida: R$ 0,46863/kWh
- TE líquida: R$ 0,32068/kWh
- Total sem tributos: R$ 0,78931/kWh
- Fio B: ~30-35% da TUSD (consultar resolução homologatória para valor exato)

## PIX Excedente

- Controlado pela flag `ASAAS_PIX_EXCEDENTE_ATIVO` no `.env`
- **Não ativar em prod sem instrução explícita de Luciano**
- Quando ativo: transferência automática do excedente gerado acima da cota do cooperado
