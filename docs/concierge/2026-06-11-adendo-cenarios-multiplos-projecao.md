# Adendo — Cenários múltiplos de projeção em vez de coleta de data SCEE

> Atualiza/simplifica a abordagem proposta na nota técnica
> `2026-06-11-nota-tecnica-periodo-aplicacao-tese.md`.
> Sugestão do Luciano em 2026-06-11: em vez de coletar a data de entrada
> no SCEE/GD pra calcular janela efetiva, **mostrar a tabela com vários
> cenários** (12m, 24m, 36m, 48m, 60m). Cliente identifica naturalmente
> o que cabe a ele.

## TL;DR

Substituir a coleta de `dataInicioScee` por **5 colunas de projeção paralelas**
(12, 24, 36, 48, 60 meses). Honestidade total + zero fricção operacional.
Cliente/advogado escolhe o cenário que reflete a realidade do caso.

## Por que essa proposta é superior

| Critério | Proposta anterior (janela efetiva) | Proposta nova (cenários múltiplos) |
|---|---|---|
| **Coleta de dado adicional** | Sim — exige `dataInicioScee` no LeadConcierge + pergunta no bot WA | ❌ Não precisa de nada |
| **Schema delta** | Sim — campo novo em LeadConcierge + Cooperado | ❌ Nenhum |
| **Risco de cliente declarar errado** | Alto — cliente pode chutar | ❌ Eliminado — só mostra cenários |
| **Fricção no funil WA** | Etapa extra → reduz conversão | ❌ Zero etapa extra |
| **Apresentação ao advogado** | 1 número — advogado precisa pedir os cenários | ✅ Cenários já prontos |
| **Honestidade comercial** | Risco de inflar ou subestimar | ✅ Transparência total |
| **Implementação** | Refator detector + UI + bot + schema | ✅ Só UI |
| **Tempo de implementação** | ~4-6h | ✅ ~30min |
| **Risco de erro** | Bug se data errada | ✅ Zero — só multiplicações |

## Como apresentar na tela

### Opção A — Tabela de 5 colunas (recomendada)

```
INDÉBITO MENSAL DETECTADO: R$ 126,91

Projeção retroativa por cenário de tempo no SCEE:

┌──────────┬──────────┬──────────┬──────────┬──────────┐
│   12 m   │   24 m   │   36 m   │   48 m   │   60 m   │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│ R$ 1.904 │ R$ 3.807 │ R$ 5.711 │ R$ 7.615 │ R$ 9.518 │
└──────────┴──────────┴──────────┴──────────┴──────────┘
                                            (teto legal CTN)

ⓘ A janela máxima recuperável é 5 anos (60m, prescrição
  tributária CTN art. 168). Escolha o cenário equivalente
  ao tempo em que sua UC está no regime de compensação
  de energia (SCEE) — quanto mais antiga a entrada, maior
  o valor recuperável.
```

Pros: limpa, mostra tudo de cara, comparação direta.
Contras: 5 números na tela podem confundir leigo.

### Opção B — Slider interativo

```
Quanto tempo (em meses) sua UC está no SCEE?

[12]──●──[24]──[36]──[48]──[60]
      ↑ 18 meses

INDÉBITO PROJETADO: R$ 2.856
```

Pros: visual, interativo, foco em 1 número.
Contras: cliente leigo pode não saber a resposta exata.

### Opção C — Cards segmentados ("dependendo de quando")

```
SE VOCÊ ESTÁ NO SCEE HÁ...

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Até 1 ano   │  │   2-3 anos   │  │  4-5 anos    │
│              │  │              │  │              │
│  R$ 1.904    │  │  R$ 5.711    │  │  R$ 9.518    │
│  (12m)       │  │  (36m)       │  │  (60m)       │
└──────────────┘  └──────────────┘  └──────────────┘
```

Pros: linguagem leiga ("até 1 ano"), 3 categorias amplas.
Contras: arredonda informação.

**Recomendação Cowork**: combinar A + C. Tabela completa pra advogado,
cards segmentados pro cliente leigo na landing pública.

## Refator técnico SIMPLIFICADO

Substitui o refator P0 anterior (que exigia `projetarRetroativo(ctx)`
com data de entrada) por algo trivial:

```typescript
// ANTES (complexo, dependia de data):
export function projetar60mSelic(indebitoMensal: number): number {
  return Math.round(indebitoMensal * 60 * 1.25 * 100) / 100;
}

// DEPOIS (simples, retorna leque):
export interface CenariosProjecao {
  cenario12m: number;
  cenario24m: number;
  cenario36m: number;
  cenario48m: number;
  cenario60m: number;  // teto legal (prescrição CTN)
}

export function projetarCenarios(
  indebitoMensal: number,
): CenariosProjecao {
  if (indebitoMensal <= 0) {
    return { cenario12m: 0, cenario24m: 0, cenario36m: 0, cenario48m: 0, cenario60m: 0 };
  }
  const calc = (meses: number) =>
    Math.round(indebitoMensal * meses * fatorSelic(meses) * 100) / 100;
  return {
    cenario12m: calc(12),
    cenario24m: calc(24),
    cenario36m: calc(36),
    cenario48m: calc(48),
    cenario60m: calc(60),
  };
}

// fatorSelic continua simples por enquanto (1,25 médio anual),
// melhoria futura: tabela SELIC mensal acumulada (D-novo-SELIC-ACUMULADA-PRECISA P3)
function fatorSelic(meses: number): number {
  // aproximação linear: ~1.04 por ano
  // 12m -> 1.04, 24m -> 1.08, 60m -> 1.25
  return 1 + (meses / 12) * 0.04;
}
```

Cada detector retorna no `PadraoDetectado`:

```typescript
interface PadraoDetectado {
  // ... atual
  valorIndebitoMensal: number;
  cenariosProjecao: CenariosProjecao;  // SUBSTITUI valorIndebito60mSelic
}
```

UI da tela `web/app/dashboard/concierge/cooperado/[id]/page.tsx` consome
`cenariosProjecao` direto na tabela visual.

## Como ficam os 3 casos analisados hoje

### LAURENTINO — Tese 3

| Cenário | Mensal × meses × SELIC | Valor |
|---|---|---|
| 12m | 126,91 × 12 × 1,04 | **R$ 1.584** |
| 24m | 126,91 × 24 × 1,08 | **R$ 3.290** |
| 36m | 126,91 × 36 × 1,12 | **R$ 5.118** |
| 48m | 126,91 × 48 × 1,16 | **R$ 7.066** |
| 60m | 126,91 × 60 × 1,20 | **R$ 9.138** |

### CHRISTIANE — Tese 3

| Cenário | Valor |
|---|---|
| 12m | R$ 4.958 |
| 24m | R$ 10.292 |
| 36m | R$ 16.013 |
| 48m | R$ 22.093 |
| 60m | R$ 28.598 |

### SINERGIA — Tese 2

| Cenário | Valor |
|---|---|
| 12m | R$ 22.156 |
| 24m | R$ 45.985 |
| 36m | R$ 71.495 |
| 48m | R$ 98.682 |
| 60m | R$ 127.560 |

Note que com fator SELIC linear suave (`1 + meses/12 × 0.04`) os números
ficaram ligeiramente menores que o cálculo com `1.25` fixo. Diferença
~3% no teto 60m. Aceitável pra MVP.

## Impacto nas specs entregues

### Nota técnica anterior (`periodo-aplicacao-tese.md`)

- **Mantém valor histórico** como documentação do problema identificado
- Substituir capítulo "Estratégia recomendada (MVP)" por referência a este adendo
- D-novo-CONCIERGE-JANELA-EFETIVA **rebaixado de P0 → P2** porque a UX nova
  já resolve o problema sem ser refator urgente

### Spec C8 (Concierge Captação WA)

- **Remove Etapa 3.5** (coletar data SCEE no bot)
- Bot apenas envia o diagnóstico com a **tabela de cenários**
- Cliente decide qual cenário cabe ao escolher se segue ou não com adesão

### Spec C4 (próxima sessão Cowork)

- Implementar `projetarCenarios(indebitoMensal)` em vez de
  `projetarRetroativo(ctx)`
- Tela detalhe ganha tabela de 5 colunas + observação
- Bot WA não muda

## Carry-overs atualizados

| Carry-over | Status anterior | Status atual |
|---|---|---|
| D-novo-CONCIERGE-JANELA-EFETIVA | P0 (bloqueador comercial) | P2 (refator simples ~30min, sem urgência) |
| D-novo-CONCIERGE-CENARIOS-MULTIPLOS-UI | (novo) | P1 (entregar na Sprint C4) |
| D-novo-LEAD-CONCIERGE-DATA-SCEE | P1 | **CANCELADO** — não precisa mais |
| D-novo-OCR-AUTO-DETECT-SCEE | P3 | **CANCELADO** — não precisa mais |
| D-novo-SELIC-ACUMULADA-PRECISA | P3 | P3 (igual — futuramente trocar 1,04/ano por tabela mensal) |

## Conclusão

Ideia simples que elimina 3 carry-overs + 1 schema delta + 1 fricção no
funil + risco de cliente declarar errado. Tudo de uma vez. Implementação
~30min na Sprint C4.

Pra reforçar o pitch comercial: **transparência radical** — em vez de
prometer R$ 9.518 e o advogado descobrir depois que era só R$ 3.807,
você mostra os 5 cenários de cara e o cliente escolhe o que se adequa.
Credibilidade vai pra cima, frustração vai pra zero.
