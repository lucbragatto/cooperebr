# Nota Técnica — Período de Aplicação da Tese e Projeção Retroativa Correta

> Documento técnico complementar às Specs C4, C7 e C8. Cowork 2026-06-11.
> Observação levantada por Luciano durante a apresentação das 3 telas:
> *"tem que ser informado desde quando a pessoa participa do modelo de
> compensação de energia na GD e o cálculo tem que levar isso em conta
> inclusive na hora de apresentar na página"*.

## Problema identificado

A função atual de projeção retroativa (`projetar60mSelic` em
`detectores.types.ts`) usa fórmula fixa:

```typescript
indebito60mSelic = indebitoMensal × 60 × 1.25
```

Isso assume que o cliente paga indevidamente **há 60 meses inteiros**.
A fórmula é correta como **teto máximo** (prazo prescricional tributário
do CTN art. 168 = 5 anos), mas **superestima** quando a entrada da UC
no SCEE foi recente.

### Magnitude do problema

Refazendo as 3 novas faturas analisadas hoje com datas hipotéticas:

| Cliente | Indébito mensal | Projeção atual (60m) | Se entrou há 24m | Se entrou há 12m |
|---|---|---|---|---|
| LAURENTINO Tese 3 | R$ 126,91 | R$ 9.518,41 | **R$ 3.807,30** | **R$ 1.903,65** |
| CHRISTIANE Tese 3 | R$ 397,00 | R$ 29.775,00 | **R$ 11.910,00** | **R$ 5.955,00** |
| SINERGIA Tese 2 | R$ 1.774,82 | R$ 133.111,50 | **R$ 53.244,60** | **R$ 26.622,30** |

Apresentar valor inflado:
1. Compromete credibilidade junto ao advogado parceiro
2. Cliente entra com expectativa errada e fica frustrado quando a
   ação real for menor
3. Vira **passivo jurídico** se chegar como prova nos autos um cálculo
   tecnicamente errado

## Regras por tese — quando começa contar

| Tese | Marco temporal | Observação |
|---|---|---|
| **Tese 3 — PIS/COFINS sobre SCEE** | Data de entrada da UC no SCEE | Crítico. Antes do SCEE não há base pra tese. |
| **Tese 2 — ICMS sobre TUSD-G / Demanda** | Data de contratação da demanda de geração | Crítico. Só usinas A4 ou clientes com contrato de demanda. |
| **Tema 69 stricto** | 15/03/2017 (modulação STF RE 574.706) **OU** data da impetração (se anterior a 15/03/2017) | Teto fixo. Indébitos antes de 03/2017 só são recuperáveis se ação foi ajuizada até essa data. Hoje (jun/2026) o limite é 03/2017 ou 60m atrás — o que for menor. |
| **Tese 4 — GERAR rubricas excluídas (Lei 11.253/2021-ES)** | 01/01/2022 (vigência) | Teto fixo legal. Indébitos antes de 2022 não aplicam. |

Pra cada tese, a janela efetiva é:

```
janela_efetiva = MIN(
  60 meses,
  meses_desde(data_inicio_evento_tese),
  meses_desde(teto_legal_tese)
)
```

E a projeção correta:

```typescript
indebitoRetroativoCorreto = indebitoMensal × janela_efetiva × fatorSelicAcumulado(janela_efetiva)
```

O fator SELIC acumulado também não é linear 1,25 — é função da janela.
Pra simplificar MVP: usar tabela média histórica SELIC anual aplicada
mês a mês. Carry-over: catalogar `D-novo-SELIC-ACUMULADA-PRECISA` P3.

## Como obter "desde quando participa do SCEE"

### Fonte 1 — Cooperado já cadastrado no SISGD

Campo `Cooperado.dataInicioCreditos: DateTime?` já existe no schema
(`prisma/schema.prisma` linha 196). Preenchido pelo cadastro normal.

**Para cooperados do CoopereBR**: usar direto.

### Fonte 2 — Fatura EDP-ES (NÃO é confiável como única fonte)

Mostra:
- *"Esta unidade consumidora participa do sistema de compensação de
  energia elétrica"*
- *"Saldo SCEE: X kWh"*
- *"Participação no Saldo: 0,11%"*

**Não traz data de entrada**. Conseguimos inferir aproximação pelo
histórico de meses com `INJECAO_SCEE` na fatura (se OCR processar
12 meses de histórico → estima entrada antes do mais antigo), mas é
**estimativa**, não data exata.

### Fonte 3 — Cliente declara (Concierge Captação WA)

Bot pergunta após receber fatura:

> "Pra calcular corretamente quanto você pode recuperar, preciso saber:
> **Desde quando sua conta de luz participa do programa de compensação
> de energia (você instalou painéis solares OU foi conectado a uma
> usina/cooperativa)?**
>
> Responda mês e ano. Exemplo: 03/2024"

Cliente declara → bot valida formato MM/YYYY → calcula janela.

### Fonte 4 — Documento oficial da concessionária

Cliente pode solicitar histórico de SCEE via canal oficial da EDP-ES /
ELFSM. Demora dias mas é prova documental robusta — usar em casos
grandes onde valor da projeção justifica.

## Estratégia recomendada (MVP)

1. **Cooperado já cadastrado**: usa `dataInicioCreditos` se preenchido,
   senão pergunta admin pra preencher.
2. **Lead novo (Concierge Captação WA)**: bot pergunta na conversa,
   guarda em `LeadConcierge.dataInicioScee: DateTime?` (novo campo
   schema delta C8).
3. **Cooperativa adminstradora pode override** via tela
   `/dashboard/concierge/cooperado/[id]/configurar` (admin entra com
   data exata se cliente não soube).
4. **Default conservador**: se nenhuma fonte traz a data, usa **12
   meses atrás** como estimativa cautelosa (sempre mostra valor menor
   que o real → cliente não fica frustrado). Aviso explícito na tela:
   *"Janela conservadora aplicada. Forneça data exata pra cálculo
   completo."*
5. **Auto-detecção opcional**: se OCR conseguir extrair histórico de
   12-13 meses com participação SCEE, estima entrada anterior ao mais
   antigo. Apenas como **piso** da janela, nunca como teto.

## Mudanças necessárias no Concierge

### Backend — `src/concierge/`

#### 1. `detectores/detectores.types.ts`

Substituir `projetar60mSelic` por função paramétrica:

```typescript
export interface ContextoProjecao {
  dataInicioTese: Date | null;   // data de inicio do fato gerador da tese
  dataAtual: Date;                // hoje
  tetoLegalMeses: number;         // 60 default; pode ser menor (Tema 69 strict)
}

export function projetarRetroativo(
  indebitoMensal: number,
  ctx: ContextoProjecao,
): { janelaEfetivaMeses: number; valorRetroativo: number } {
  if (indebitoMensal <= 0) {
    return { janelaEfetivaMeses: 0, valorRetroativo: 0 };
  }
  const mesesDesdeInicio = ctx.dataInicioTese
    ? mesesEntre(ctx.dataInicioTese, ctx.dataAtual)
    : 60; // default conservador se nao informado
  const janelaEfetiva = Math.min(60, mesesDesdeInicio, ctx.tetoLegalMeses);
  const fatorSelic = calcularFatorSelicAcumulado(janelaEfetiva);
  return {
    janelaEfetivaMeses: janelaEfetiva,
    valorRetroativo: Math.round(indebitoMensal * janelaEfetiva * fatorSelic * 100) / 100,
  };
}
```

#### 2. Cada detector retorna `janelaEfetivaMeses` no `PadraoDetectado`

```typescript
interface PadraoDetectado {
  // ... atual
  janelaEfetivaMeses: number;
  valorIndebitoRetroativo: number;  // substitui valorIndebito60mSelic
  observacaoTemporal: string;        // ex: "Cliente entrou no SCEE em 03/2024, janela efetiva: 27 meses"
}
```

#### 3. `concierge.service.previewDiagnostico(input, distribuidora, contexto)`

Aceita `contexto.dataInicioScee: Date | null` e passa pros detectores.

### Frontend — tela `/dashboard/concierge/cooperado/[id]`

Adicionar acima do botão "Rodar auditoria":

```
┌──────────────────────────────────────────────────────────┐
│ DATA DE ENTRADA NO SCEE                                  │
│ ─────────────────────                                     │
│ Cooperado entrou no programa de compensação em:          │
│ [MM/AAAA ▼]  ← editavel                                  │
│                                                           │
│ Fonte: ⓘ Cadastro CoopereBR | Cliente declarou |         │
│         Inferido | Não informado (60m conservador)       │
└──────────────────────────────────────────────────────────┘
```

E no card de resultado, mostrar:

```
┌──────────────────────────────────────────────────────────┐
│ INDÉBITO MENSAL DETECTADO:  R$ 126,91                    │
│ JANELA EFETIVA: 27 meses (entrada em 03/2024)            │
│ PROJEÇÃO RETROATIVA + SELIC: R$ 4.282,46                 │
│                                                           │
│ ℹ️ Para janela maior (60m), seria R$ 9.518,41 — mas      │
│   só recupera o que efetivamente foi cobrado a mais       │
│   desde sua entrada no SCEE.                              │
└──────────────────────────────────────────────────────────┘
```

Transparência total. Cliente entende.

### Bot WA — Concierge Captação (Spec C8)

Nova etapa entre "diagnóstico comunicado" e "decisão adesão":

```
ETAPA 3.5 — Coleta data de entrada no SCEE

Bot: "Antes de calcular o valor exato que você pode recuperar,
preciso saber:

Desde quando sua conta participa do programa de compensação
de energia? (você instalou painéis solares ou foi conectado
a alguma usina/cooperativa de energia?)

Responda mês e ano. Exemplo: 03/2024"

Cliente: "03/2024"

Bot: "Perfeito. Então sua janela de recuperação é de 27 meses.
Recalculando... ✅

Indébito mensal: R$ 126,91
Total recuperavel (27 meses + SELIC): R$ 4.282,46

Quer prosseguir com a adesão? [SIM] [PENSAR]"
```

## Carry-overs catalogados

- `D-novo-CONCIERGE-JANELA-EFETIVA` **P0** — refator `projetar60mSelic` →
  `projetarRetroativo(ctx)` em todos os 3 detectores. Sem isso, todos os
  valores apresentados são potencialmente inflados.
- `D-novo-SELIC-ACUMULADA-PRECISA` P3 — substituir fator 1,25 por tabela
  SELIC mensal histórica acumulada.
- `D-novo-LEAD-CONCIERGE-DATA-SCEE` P1 (Spec C8) — campo
  `LeadConcierge.dataInicioScee: DateTime?` + perguntar no bot.
- `D-novo-OCR-AUTO-DETECT-SCEE` P3 — tentativa de inferir entrada SCEE
  pelo histórico de 12 meses na fatura (piso apenas).

## Impacto nas specs já entregues

- **Spec C4** (orquestrador endpoint) — incluir `dataInicioScee` no
  input do `POST /concierge/diagnostico` e no fluxo de preview.
- **Spec C7** (integração PlanoSaas) — nenhum impacto direto.
- **Spec C8** (Concierge Captação WA) — adicionar Etapa 3.5 entre 3
  e 4 do fluxo de 9 etapas. Campo `dataInicioScee` no
  `LeadConcierge`.

## Prioridade

**P0** — esse refator precisa entrar antes de qualquer apresentação
pra advogado, cliente real ou material de marketing. **Hoje o sistema
mostra números potencialmente errados**. Mesmo o mock atual da
tela detalhe (que usa a fatura modelo Laurentino) deve mostrar a
janela efetiva — pelo menos como **placeholder** com data de exemplo.

Recomendo fazer junto da Sprint C4 (próxima sessão Cowork), antes de
qualquer roadshow comercial.
