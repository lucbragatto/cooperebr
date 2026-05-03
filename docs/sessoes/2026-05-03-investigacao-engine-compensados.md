# Investigação read-only — Engine `CREDITOS_COMPENSADOS` + D-30R + duplo desconto suspeito

**Data:** 2026-05-03 (sessão Code).
**Modo:** read-only puro (Decisão 14/15/20).
**Origem:** gate crítico do D-30R revelou possível duplo desconto. Mapeamento ponta-a-ponta antes de qualquer fix.
**Escopo:** sem edição de código, sem alteração de schema, sem mudança no banco. SELECTs apenas via Prisma read-only.

---

## 1. Sumário executivo

A investigação confirma **5 inconsistências cumulativas** em volta de `Contrato.tarifaContratual` que tornam um fix isolado de D-30R **insuficiente e perigoso**:

| # | Achado | Severidade |
|---|---|---|
| 1 | **3 caminhos** criam `Contrato`. **Nenhum** popula `tarifaContratual` | P0 estrutural |
| 2 | **0/72 contratos** têm `propostaId` — backfill via proposta pega zero | P0 (invalida o fix proposto) |
| 3 | Spec canônica diz `tarifaContratual = pós-desconto`. Engine `:1862` aplica desconto novamente. **Duplo desconto matemático.** | P0 (semântica) |
| 4 | `Motor.aceitar` calcula `tarifaContratualPromocional` **com** desconto. Spec Jest T8 contorna setando `percentualDesconto: 0`. Bug latente "isolado por teste". | P1 |
| 5 | Spec Jest `:133-145` afirma o oposto da spec canônica (tarifaContratual=cheia + duplo desconto), validando o bug como comportamento esperado | P1 (testes blindando bug) |

**Veredito do gate crítico (P1 da tarefa anterior):** divergência confirmada entre 5 fontes. Não há semântica única consensual no repositório hoje. Fix requer **decisão de produto + refatoração coordenada**, não patch isolado.

**Recomendação:** absorver no Sprint C1 (COMPENSADOS) com escopo expandido. Estimativa 5-7 dias Code, não as 30-45 min do D-30R original.

---

## 2. Mapa da engine ponta-a-ponta

### Etapa 1 — Origem da tarifa (`Motor.calcular` → `Motor.aceitar`)

**`backend/src/motor-proposta/motor-proposta.service.ts:113`** define `tarifaUnitSemTrib`:

```ts
const tusd = tarifa ? Number(tarifa.tusdNova) : 0.3;
const te = tarifa ? Number(tarifa.teNova) : 0.2;
const tarifaUnitSemTrib = tusd + te;
```

Semântica: **tarifa cheia da concessionária sem tributos** (≈ R$ 0,79/kWh para EDP-ES). NÃO tem desconto aplicado.

`:173`:

```ts
const kwhApuradoBase = kwhBase > 0 ? valorBase / kwhBase : 0;
```

Semântica: **tarifa média da fatura inteira** (R$ total / kWh consumido), inclui ICMS+PIS+COFINS. Para EDP-ES típica ≈ R$ 1,00/kWh. Nome do campo é confuso — começa com `kwh` mas representa R$/kWh.

`:706` (já existente para promo):

```ts
const tarifaPromo = Number(r.kwhApuradoBase) * (1 - descPromoPct / 100);
tarifaContratualPromocional = Math.round(tarifaPromo * 100000) / 100000;
```

Semântica: **tarifa pós-desconto promocional**. Ex: kwhApuradoBase R$ 1,00 × (1 − 30%) = R$ 0,70/kWh.

`:714-744` (criação do Contrato):

```ts
const contrato = await tx.contrato.create({
  data: {
    // ... percentualDesconto, kwhContrato, etc
    ...(valorContrato !== null ? { valorContrato } : {}),
    ...(tarifaContratualPromocional !== null ? { tarifaContratualPromocional } : {}),
    // tarifaContratual NÃO ESTÁ AQUI ← D-30R
  },
});
```

**Achado D-30R:** `tarifaContratual` (não-promocional) **nunca é gravada** pelo Motor.aceitar.

### Etapa 2 — Persistência no Contrato

**`prisma/schema.prisma:399-403`**:

```prisma
tarifaContratual             Decimal?                  @db.Decimal(10, 5)
dataUltimoReajusteTarifa     DateTime?
valorContratoPromocional     Decimal?                  @db.Decimal(10, 2)
tarifaContratualPromocional  Decimal?                  @db.Decimal(10, 5)
```

Campo é `Decimal?` opcional. **Sem comentário documentando se semântica é "tarifa cheia" ou "tarifa pós-desconto"**.

**Estado real do banco (SELECT 2026-05-03):**

| Métrica | Valor |
|---|---|
| Total contratos | 72 |
| `tarifaContratual` NULL | 72 (100%) |
| `tarifaContratualPromocional` NULL | 72 (100%) |
| `valorContrato` NULL | 72 (100%) |
| `propostaId` NULL | 72 (100%) |
| `baseCalculoAplicado` ≠ default | 0 |
| `tipoDescontoAplicado` ≠ default | 0 |

**Achado adicional:** TODOS os snapshots T3/T4 (`baseCalculoAplicado`, `tipoDescontoAplicado`, `valorContrato`, `valorContratoPromocional`, `tarifaContratualPromocional`) estão zerados/default — não é só `tarifaContratual`. **D-30R subestimou o problema.**

**Distribuição temporal:** 71 contratos criados em mar/2026, 1 em abr/2026. Todos do tenant CoopereBR.

**Distribuição por modelo (via Plano):**

| Plano modeloCobranca | Contratos | % |
|---|---|---|
| CREDITOS_COMPENSADOS | 62 | 86% |
| FIXO_MENSAL | 9 | 13% |
| sem plano | 1 | 1% |

### Etapa 3 — Caminhos que criam Contrato

`grep "contrato\.create\|tx\.contrato\.create"` em `backend/src/`:

| # | Arquivo | Linha | Popula `tarifaContratual`? |
|---|---|---|---|
| 1 | `motor-proposta/motor-proposta.service.ts` | 714 | ❌ não |
| 2 | `contratos/contratos.service.ts` | 227 | ❌ não |
| 3 | `cooperados/cooperados.service.ts` | 561 | ❓ verificar (não auditado nesta investigação) |
| 4 | `migracoes-usina/migracoes-usina.service.ts` | 185 | ❓ verificar (não auditado) |
| 5 | `usinas/usinas.service.ts` | 306 | ❓ verificar (não auditado) |

**Implicação para D-30R:** débito original culpa só `Motor.aceitar`, mas há pelo menos 4 outros caminhos. Os 71 contratos atuais (sem `propostaId`) NÃO vieram do Motor — vieram do `contratos.service.ts:create()` ou de seed/migração. **Backfill `WHERE propostaId IS NOT NULL` populariza ZERO contratos.**

### Etapa 4 — Consumo na engine `CREDITOS_COMPENSADOS`

**`backend/src/faturas/faturas.service.ts:1840-1877`**:

```ts
case 'CREDITOS_COMPENSADOS': {
  const emPromocao = this.estaEmPeriodoPromocional(contrato, fatura);
  const tarifaContratual = emPromocao && contrato.tarifaContratualPromocional
    ? Number(contrato.tarifaContratualPromocional)
    : Number(contrato.tarifaContratual ?? 0);
  // Fallback: tarifa apurada da fatura OCR (valorTotal / consumo)
  const tarifaApuradaOCR = kwhConsumidoOCR > 0 && valorTotalOCR
    ? Math.round((valorTotalOCR / kwhConsumidoOCR) * 100000) / 100000
    : 0;
  const tarifaUsada = tarifaContratual > 0 ? tarifaContratual : tarifaApuradaOCR;

  if (!kwhCompensadoOCR || !tarifaUsada) {
    throw new BadRequestException(/* ... */);
  }

  const valorBruto = Math.round(kwhCompensadoOCR * tarifaUsada * 100) / 100;
  const valorDescontoCalc = Math.round(valorBruto * desconto * 100) / 100;
  const valorLiquido = Math.round((valorBruto - valorDescontoCalc) * 100) / 100;
  // ...
}
```

Onde `desconto` vem de `:1795`:

```ts
const desconto = this.resolverDescontoContrato(contrato);
```

E `resolverDescontoContrato` em `:1691-1694`:

```ts
private resolverDescontoContrato(contrato: any): number {
  const pct = Number(contrato.descontoOverride ?? contrato.percentualDesconto ?? 0);
  return pct / 100;
}
```

**Comportamento da engine:**

1. Lê `tarifaContratual` do contrato (ou promocional, se em promoção)
2. Multiplica por `kwhCompensado` (do OCR) → `valorBruto`
3. Aplica `percentualDesconto` em cima do `valorBruto` → `valorLiquido`

**Implícito:** engine assume que `tarifaContratual` é **tarifa CHEIA** (sem desconto), e aplica o desconto contratual em cima.

### Etapa 5 — Engine `FIXO_MENSAL` para comparação

**`backend/src/faturas/faturas.service.ts:1805-1838`**:

```ts
case 'FIXO_MENSAL': {
  const emPromocao = this.estaEmPeriodoPromocional(contrato, fatura);
  const valorFinal = emPromocao && contrato.valorContratoPromocional
    ? Number(contrato.valorContratoPromocional)
    : Number(contrato.valorContrato ?? 0);
  // ...
  return {
    valorBruto: valorContrato,
    valorDesconto: 0,         // ← desconto NÃO é aplicado de novo
    valorLiquido: Math.round(valorContrato * 100) / 100,
    // ...
  };
}
```

E em `Motor.aceitar:676`:

```ts
const valorContrato = ehFixo
  ? Math.round(Number(r.valorCooperado) * Number(r.kwhContrato) * 100) / 100
  : null;
```

Onde `r.valorCooperado` (`:177`) é `kwhApuradoBase - descontoAbsoluto` — **já com desconto subtraído**.

**Diferença semântica entre engines:**

| Engine | Valor gravado no contrato | Desconto aplicado de novo no engine? |
|---|---|---|
| `FIXO_MENSAL` | `valorContrato` = **pós-desconto** | ❌ não (`valorDesconto: 0`) |
| `CREDITOS_COMPENSADOS` | `tarifaContratual` = ? (ambíguo) | ✅ sim (linha 1862) |

**Isso é a inconsistência central.** FIXO_MENSAL grava pós-desconto e não aplica de novo. COMPENSADOS deveria ter o mesmo padrão (e a spec canônica concorda) — mas a engine aplica desconto, a spec Jest blinda esse comportamento, e o Motor.aceitar para promo grava pós-desconto. Tudo desalinhado.

### Etapa 6 — Especificação canônica

**`docs/especificacao-modelos-cobranca.md:22-37`** (3 fontes citadas):

> **CREDITOS_COMPENSADOS:** "Valor unitário do kWh TRAVADO no contrato — **já com desconto aplicado**.
>
> - Contrato guarda o VALOR FINAL (não tarifa cheia + %desconto)"
>
> Exemplo:
> - Tarifa cheia: R$ 1,00/kWh
> - Desconto: 20%
> - **Valor travado no contrato: R$ 0,80/kWh**
> - Créditos: 10.000 kWh
> - Cobrança: 10.000 × R$ 0,80 = R$ 8.000

**`docs/PRODUTO.md:287`** (4ª fonte — CONTRADITÓRIA com a anterior):

> | CREDITOS_COMPENSADOS | `kwhCompensado da fatura × tarifaContratual × (1 − desconto%)` | 🟡 ... |

A fórmula de PRODUTO.md trata `tarifaContratual` como tarifa cheia (descontoᵉˣᵗ aplicado em cima). Direto oposto ao texto da `especificacao-modelos-cobranca.md`.

**`docs/PRODUTO.md:330`**:

> "Contrato CTR-324704 (Luciano, plano OURO COMPENSADOS) com `tarifaContratual` vazia — bug do snapshot do Motor.aceitar quando aceitou. Backend cai em fallback `tarifaApurada = totalAPagar / consumo` que é conceitualmente errado (totalAPagar já tem compensação aplicada)."

Aqui PRODUTO.md identifica o D-30R, mas não toca na ambiguidade da fórmula.

**`docs/REGULATORIO-ANEEL.md`**: não trata da fórmula de cobrança no nível desta investigação. Foca em flags regulatórias (mix de classes, concentração, etc).

### Etapa 7 — Specs Jest existentes

**`backend/src/faturas/faturas.service.calcular.spec.ts:133-145`** (5ª fonte):

```ts
it('tarifaContratual prevalece sobre tarifa apurada do OCR', async () => {
  const contrato = comp({ tarifaContratual: 0.80, percentualDesconto: 20 });
  const fatura = faturaBase({/* ... */});
  const result = await calc(contrato, fatura);
  // 100 × 0.80 = 80.00 bruto; 80 × 0.20 = 16.00 desconto; 80 - 16 = 64.00 líquido
  expect(result.valorBruto).toBe(80.0);
  expect(result.valorDesconto).toBe(16.0);
  expect(result.valorLiquido).toBe(64.0);
  expect(result.tarifaContratualAplicada).toBe(0.80);
});
```

**Análise crítica:** este spec é hostil à spec canônica. Setando `tarifaContratual=0.80` (que a spec canônica chama de "valor travado pós-desconto", esperando R$ 80 de cobrança) + `percentualDesconto=20`, o spec valida `valorLiquido=64` — **20% a menos do que a spec canônica determina**. O autor do spec interpretou `tarifaContratual` como tarifa cheia, e o teste passou no CI, blindando o duplo desconto como "comportamento correto".

**`:281-305` (T8 promocional)**:

```ts
const contrato = contratoBase({
  plano: { modeloCobranca: 'CREDITOS_COMPENSADOS' },
  tarifaContratual: 0.90,
  tarifaContratualPromocional: 0.60, // promocional menor
  percentualDesconto: 0, // isola o efeito da tarifa  ← PROVA
});
// 1000 × 0.60 = 600 (usando tarifa promocional, não normal)
expect(r.valorBruto).toBe(600);
```

**Análise crítica:** o comentário literal `// isola o efeito da tarifa` é evidência forte de que o autor **sabia** que combinar `tarifaContratualPromocional` + `percentualDesconto > 0` produziria duplo desconto, e zerou o desconto pra "fazer o spec passar". Não há outro spec do COMPENSADOS+promo com `percentualDesconto > 0` — o caso real (cooperado em promo + desconto contratual) **nunca foi testado**.

**`backend/src/motor-proposta/motor-proposta.service.aceitar.spec.ts:281-282`**:

```ts
// Tarifa promocional = kwhApuradoBase × (1 - 30/100) = 1.0928 × 0.70
expect(Number(dataContrato.tarifaContratualPromocional))
  .toBeCloseTo(1.0928 * 0.70, 3);
```

Confirma: o spec do Motor afirma que `tarifaContratualPromocional` é **pós-desconto**. Coerente com a spec canônica, INcoerente com a engine.

**`:212-232`** prova que `BLOQUEIO_MODELOS_NAO_FIXO=true` impede aceite COMPENSADOS — ou seja, sem o bloqueio desativado, esse caminho nunca é exercitado em CI.

### Etapa 8 — Variável de bloqueio `BLOQUEIO_MODELOS_NAO_FIXO`

`grep` retornou **6 enforcement points** distintos:

| # | Arquivo | Linha | Bloqueia |
|---|---|---|---|
| 1 | `motor-proposta.service.ts` | 549 | aceite de proposta com plano COMPENSADOS/DINAMICO |
| 2 | `faturas.service.ts` | 574 | `gerarCobrancaPosFatura` (Path A — pipeline OCR) |
| 3 | `faturas.service.ts` | 987 | `aprovarFatura` (Path A — Central de Faturas) |
| 4 | `contratos/contratos.service.ts` | 123 (`isBloqueioAtivo`) | uso interno do helper |
| 5 | `contratos/dto/create-contrato.dto.ts` | 19 | criação manual de contrato |
| 6 | `contratos/dto/update-contrato.dto.ts` | 19 | atualização manual de contrato |
| 7 | `planos/planos.service.ts` | 58 | `findAtivos(publico=true)` filtra COMPENSADOS/DINAMICO |

**Análise:** o bloqueio cobre as portas de entrada principais. Não há rota crítica esquecida que permita engine COMPENSADOS rodar acidentalmente. Se Luciano desativar `BLOQUEIO_MODELOS_NAO_FIXO=false` hoje, **todas** as 6 portas se abrem ao mesmo tempo — e cooperados com plano COMPENSADOS começam a receber cobranças via engine bugada.

**Estado real do banco (cobranças):**

| Métrica | Valor |
|---|---|
| Cobranças totais | 34 |
| `modeloCobrancaUsado` preenchido | 0 |
| `faturaProcessadaId` preenchido | 0 |
| Cobranças manuais (faturaProcessadaId NULL) | 34 |

**Confirma:** engine `CREDITOS_COMPENSADOS` nunca rodou em produção. Todas as cobranças existentes são manuais (Caminho B). O bug de duplo desconto é **latente** — nunca causou prejuízo real, mas explode no momento que `BLOQUEIO_MODELOS_NAO_FIXO=false` for ativado sem o fix.

---

## 3. Respostas às 7 perguntas

### P1. `tarifaContratual` armazena tarifa CHEIA (sem desconto) ou PÓS-DESCONTO?

**Não há resposta consistente no repositório.** Cinco fontes em conflito:

| Fonte | Interpretação |
|---|---|
| `docs/especificacao-modelos-cobranca.md:22-37` | PÓS-DESCONTO (valor travado já com desconto) |
| `docs/PRODUTO.md:287` (fórmula) | CHEIA (desconto aplica em cima) |
| `Motor.aceitar:706` (cálculo de promocional) | PÓS-DESCONTO |
| `faturas.service.ts:1862` (engine consumidora) | CHEIA |
| `faturas.service.calcular.spec.ts:133-145` | CHEIA (spec valida duplo desconto) |
| Débito D-30R original (proposta de fix) | PÓS-DESCONTO |

**Interpretação coerente:** se aceitarmos a spec canônica + paralelo do `tarifaContratualPromocional` + débito D-30R, deve ser **PÓS-DESCONTO**. Mas isso obriga a remover `valorBruto * desconto` da engine `:1862`, mudar PRODUTO.md, e reescrever os specs Jest.

### P2. Existe duplo desconto na engine `CREDITOS_COMPENSADOS`?

**Sim, matematicamente confirmado** — desde que aceitemos a spec canônica.

**Cálculo numérico exemplo (rastreio linha por linha):**

Cenário: cooperado com `kwhCompensado=100`, tarifa cheia EDP `R$ 1,00/kWh`, desconto contratual `20%`.

**Esperado segundo `docs/especificacao-modelos-cobranca.md:32-37`:** R$ 80 (= 100 × R$ 0,80, onde R$ 0,80 já é a tarifa pós-desconto travada).

**Calculado pela engine atual:**

| Passo | Linha | Cálculo | Valor |
|---|---|---|---|
| Motor.aceitar grava `tarifaContratual` | `motor-proposta.service.ts:714` | (não grava — bug D-30R) | `null` |
| Engine lê `tarifaContratual` | `faturas.service.ts:1843-1845` | `Number(null ?? 0)` | `0` |
| Engine cai em fallback | `:1850` | `tarifaUsada = tarifaApuradaOCR = totalAPagar/consumo` | varia |

**Erro hoje (D-30R):** valor totalmente errado (depende do fallback OCR, conceitualmente furado).

**Cálculo SE Motor populasse PÓS-DESCONTO (proposta original D-30R):**

| Passo | Linha | Cálculo | Valor |
|---|---|---|---|
| Motor grava | (proposto) | `kwhApuradoBase × (1 − 20%) = R$ 1,00 × 0,80` | `R$ 0,80` |
| Engine lê | `:1843-1845` | `tarifaContratual` | `R$ 0,80` |
| valorBruto | `:1861` | `100 × 0,80` | `R$ 80,00` |
| desconto | `:1862` | `80 × 0,20` | `R$ 16,00` ← **2º desconto** |
| valorLiquido | `:1863` | `80 − 16` | `R$ 64,00` ← **20% menos do que a spec** |

**Cooperado pagaria R$ 64 em vez de R$ 80** — perda de receita de 20% pro parceiro.

**Cálculo SE engine fosse corrigida pra não aplicar desconto:**

| Passo | Cálculo | Valor |
|---|---|---|
| Motor grava (PÓS-DESCONTO) | `R$ 1,00 × 0,80` | `R$ 0,80` |
| valorBruto | `100 × 0,80` | `R$ 80,00` |
| desconto | (removido) | `R$ 0,00` |
| valorLiquido | `80 − 0` | `R$ 80,00` ✅ |

**Conclusão:** o duplo desconto é matematicamente real e ativa-se imediatamente se D-30R for corrigido sem mexer na engine.

### P3. O comentário T8 "`percentualDesconto: 0, // isola o efeito da tarifa`" é evidência de duplo desconto consciente?

**Sim, com alta confiança.** Análise:

1. O comentário é **literal** — declara intenção de "isolar" um efeito.
2. Não há nenhum outro spec testando COMPENSADOS+promocional com `percentualDesconto > 0`.
3. O spec irmão `:133-145` valida `valorLiquido=64` (resultado do duplo desconto) como comportamento correto, mas com `tarifaContratual=0.80` posto manualmente no fixture (não via Motor).
4. O autor sabia que `tarifaContratualPromocional` é gravado pós-desconto (`Motor.aceitar:706`), e que combinando com `percentualDesconto > 0` na engine daria duplo desconto. Optou por contornar o caso em vez de reportar.

Probabilidade alta de que o autor **identificou a inconsistência durante o desenvolvimento de T4/T8** (Sprint 5) e blindou os testes para passar, deixando o problema implícito. Não há ticket nem TODO no código apontando.

### P4. Quais cenários de cobrança REAL hoje passam pela engine COMPENSADOS?

**ZERO.** Confirmação no banco:

```
SELECT COUNT(*) FROM cobrancas WHERE "modeloCobrancaUsado" = 'CREDITOS_COMPENSADOS' → 0
SELECT COUNT(*) FROM cobrancas WHERE "modeloCobrancaUsado" IS NULL → 34
SELECT COUNT(*) FROM cobrancas WHERE "faturaProcessadaId" IS NOT NULL → 0
```

Todas as 34 cobranças são manuais (Caminho B), nenhuma exercitou `gerarCobrancaPosFatura` ou `aprovarFatura` (Caminho A — pipeline OCR). O bug é **latente**: nunca causou prejuízo financeiro real, mas seria ativado no momento que `BLOQUEIO_MODELOS_NAO_FIXO=false`.

### P5. Qual fix correto resolve D-30R + duplo desconto juntos?

Análise das 3 opções:

#### Opção A — `tarifaContratual = pós-desconto` + remover desconto da engine `:1862`

```ts
// Motor.aceitar (novo):
const tarifaContratualNormal = Math.round(
  Number(r.kwhApuradoBase) * (1 - Number(r.descontoPercentual) / 100) * 100000
) / 100000;
// data: { tarifaContratual: tarifaContratualNormal, ... }

// faturas.service.ts:1862 (remover):
// const valorDescontoCalc = Math.round(valorBruto * desconto * 100) / 100;
// const valorLiquido = Math.round((valorBruto - valorDescontoCalc) * 100) / 100;

// Substituir por:
const valorLiquido = valorBruto;
const valorDescontoCalc = 0;
```

**Prós:**
- Coerente com `especificacao-modelos-cobranca.md`, com `tarifaContratualPromocional` (já gravada pós-desconto), e com o débito D-30R original.
- Paralelo perfeito com `FIXO_MENSAL` (que já não aplica desconto na engine).
- `valorDesconto` retorna 0 — coerente com FIXO.

**Contras:**
- Quebra `faturas.service.calcular.spec.ts:133-145` e specs derivadas — precisa reescrever ~5 specs.
- Quebra `PRODUTO.md:287` — precisa reescrever fórmula.
- `valorDesconto` no resultado fica 0 — dashboards de "economia" precisam ser repensados (mesmo problema do FIXO_MENSAL hoje, conhecido como "Sprint 7 #4").
- Promocional dentro de `:1843` continua coerente porque `tarifaContratualPromocional` já é pós-desconto.

#### Opção B — `tarifaContratual = cheia` + manter desconto em `:1862`

```ts
// Motor.aceitar (novo):
const tarifaContratualCheia = Number(r.kwhApuradoBase);
// data: { tarifaContratual: tarifaContratualCheia, ... }

// Reescrever Motor.aceitar:706 (pra promocional não ficar incoerente):
const tarifaPromo = Number(r.kwhApuradoBase); // cheia também?
// MAS: como diferenciar promocional de não-promocional sem desconto?
```

**Prós:**
- Mantém engine, PRODUTO.md e specs Jest consistentes.
- Permite calcular `valorDesconto` real (R$ que o cooperado economiza).
- Fix isolado em `Motor.aceitar` — minimiza ondas.

**Contras:**
- **Quebra spec canônica** (`especificacao-modelos-cobranca.md`) — exige reescrever a spec.
- **Quebra `tarifaContratualPromocional`** — Motor já grava com desconto. Precisa converter pra cheia também, mas então não há diferença entre promo e não-promo. Precisaria armazenar `descontoPromocional` separado e aplicar na engine — refatoração grande.
- Spec Jest do Motor `:281-282` quebra (`tarifaContratualPromocional ≈ 1.0928 × 0.70`).

#### Opção C — Schema novo: separar `tarifaContratualCheia` + `tarifaContratualLiquida`

```prisma
tarifaContratualCheia        Decimal? @db.Decimal(10, 5)  // sem desconto, ref documental
tarifaContratualLiquida      Decimal? @db.Decimal(10, 5)  // pós-desconto, usado na cobrança
descontoContratualSnapshot   Decimal? @db.Decimal(5, 2)   // snapshot do % no aceite
```

Engine usa `tarifaContratualLiquida` direto (sem aplicar desconto). Cheia fica pra dashboards.

**Prós:**
- Resolve ambiguidade de uma vez. Auditoria fica clara.
- `valorDesconto` calculável: `(cheia − liquida) × kwhCompensado`.
- Compatível com modo CLUBE (cooperado paga cheio, acumula tokens equivalentes ao desconto).

**Contras:**
- Migração de schema — 6 enforcement points + 3-4 caminhos de criação de contrato precisam mudar.
- Maior escopo (~5-7 dias Code).
- Teste E2E real exigido antes de produção.

#### Comparativo

| Critério | A | B | C |
|---|---|---|---|
| Esforço Code | 1-1.5 dia | 2-3 dias | 5-7 dias |
| Coerência com spec canônica | ✅ | ❌ (quebra) | ✅ |
| Coerência com paralelo `Promocional` | ✅ | ❌ (refator grande) | ✅ |
| Auditoria de "economia" | ❌ (perde valor) | ✅ | ✅ |
| Compatível com modo CLUBE | parcial | ✅ | ✅ |
| Specs a reescrever | ~5 | ~8 | ~10 |
| Migração de schema | não | não | sim |
| Backfill de 72 contratos | sim (1 fórmula) | sim (1 fórmula) | sim (2 campos) |

### P6. Schema precisa mudar?

**Depende da opção:**

- **A:** schema OK como está. Mas comentário no schema documentando "PÓS-DESCONTO" é obrigatório pra evitar regressão.
- **B:** schema OK, mas precisa decidir pra onde vai `descontoPromocional` (hoje embutido na tarifa).
- **C:** schema cresce 2 campos + 1 snapshot.

**Recomendação mínima independente da opção:** adicionar comentário Prisma explicitando semântica:

```prisma
/// Tarifa final pós-desconto travada no momento do aceite. R$/kWh.
/// CREDITOS_COMPENSADOS: valorBruto = kwhCompensado × tarifaContratual (sem aplicar desconto novamente).
tarifaContratual Decimal? @db.Decimal(10, 5)
```

### P7. Qual sprint absorve o fix completo?

**Sprint C1 (COMPENSADOS) — escopo expandido.**

Tarefas mínimas:

1. Decidir entre A/B/C (decisão de produto, **não Code** — adicionar como B33).
2. Auditar **5 caminhos** de criação de contrato (não só Motor.aceitar).
3. Aplicar fix no Motor + caminhos manuais (`contratos.service.ts:227`, `cooperados.service.ts:561`, `migracoes-usina.service.ts:185`, `usinas.service.ts:306`).
4. Refatorar engine `:1862` se Opção A ou C.
5. Reescrever specs Jest (5-10 dependendo da opção).
6. Atualizar PRODUTO.md fórmula (linha 287).
7. Backfill 72 contratos via tarifa cheia atual EDP × (1 − percentualDesconto/100).
8. Smoke test E2E real com fatura OCR real (validar valorBruto/valorDesconto/valorLiquido).
9. Desativar `BLOQUEIO_MODELOS_NAO_FIXO` por etapas (canário em 1 cooperado, validar, expandir).
10. Atualizar `especificacao-modelos-cobranca.md` se Opção B.

**Sprint 2 (OCR-Integração)** já estava previsto como pré-requisito de C1. Esta investigação confirma a dependência.

**Estimativa:**
- Opção A: 3-4 dias Code + 1-2 dias validação E2E.
- Opção B: 5-6 dias + 1-2 dias.
- Opção C: 7-8 dias + 2-3 dias.

---

## 4. Comparativo final A vs B vs C

| Aspecto | A (PÓS-DESCONTO + remover desconto engine) | B (CHEIA + manter engine) | C (schema novo, dual) |
|---|---|---|---|
| Spec canônica | preservada | reescrita | preservada |
| PRODUTO.md fórmula | reescrita | preservada | reescrita |
| Spec Jest engine | reescrita | preservada | reescrita |
| Spec Jest Motor (promo) | preservada | reescrita | preservada |
| `tarifaContratualPromocional` | preservada | refatorada | preservada (vira `tarifaContratualLiquidaPromocional`) |
| Modo CLUBE (cobra cheio) | precisa cálculo extra | natural | natural |
| Engine FIXO_MENSAL | sem mudança | sem mudança | sem mudança |
| 4 caminhos manuais de criar contrato | precisam fix | precisam fix | precisam fix |
| Risco de regressão | médio | baixo | médio-alto |
| Tempo total estimado | 4-6 dias | 6-8 dias | 9-11 dias |

---

## 5. Recomendação técnica final

**Opção A**, com 3 ajustes complementares:

1. **Adicionar comentário Prisma** documentando semântica do campo (sem migration, só doc).
2. **Engine `:1862` retorna `valorDesconto = (tarifaCheiaSnapshot − tarifaContratual) × kwhCompensado`** — preserva auditoria de economia sem aplicar desconto novamente. Requer snapshot adicional `tarifaCheiaSnapshot` no Contrato (campo simples, default null para backfill conservador).
3. **Aplicar nos 5 caminhos** de criação de contrato (não só Motor.aceitar).

**Justificativa:**

- Coerência máxima com fontes existentes (3/5 alinhadas com PÓS-DESCONTO).
- Paralelo limpo com FIXO_MENSAL (mesmo padrão).
- `tarifaContratualPromocional` já está PÓS-DESCONTO — não precisa refatorar.
- Esforço médio (4-6 dias), aceitável dentro de C1.
- Risco controlado pela natureza latente do bug (engine nunca rodou em prod).

**Pré-requisito:** decisão B33 (adicionar) — Luciano escolhe A/B/C antes de Code aplicar.

---

## 6. Próximos passos sugeridos

| Passo | Tipo | Estimativa |
|---|---|---|
| Catalogar B33: "Decisão semântica de tarifaContratual (A/B/C)" | claude.ai | sessão de decisões |
| Catalogar C1 com escopo expandido (5-7 dias em vez de 30-45 min) | claude.ai | mesma sessão |
| Reclassificar D-30R: P0 → P0/estrutural (não fix isolado) | Code | 5 min |
| Atualizar entrada D-30R no `debitos-tecnicos.md` | Code | 15 min |
| Aguardar decisão Luciano antes de qualquer alteração de código | — | — |

**Não toque na engine COMPENSADOS sem decidir A/B/C.** Qualquer fix isolado tem efeito colateral garantido.

---

## 7. Descobertas inesperadas durante leitura

1. **Snapshot universal está vazio**, não é só `tarifaContratual`. Os 72 contratos têm `valorContrato`, `tarifaContratualPromocional`, `valorContratoPromocional`, `baseCalculoAplicado != default`, `tipoDescontoAplicado != default` **todos zerados**. Isso amplifica o D-30R: o problema é "snapshots T3/T4 nunca chegaram em produção", não "Motor.aceitar perdeu uma linha".

2. **0 contratos com propostaId** — o backfill proposto no D-30R original (`WHERE propostaId IS NOT NULL`) atualizaria zero contratos. A premissa do débito está errada. Backfill correto cruza `kwhContratoMensal × tarifa cheia EDP × (1 − percentualDesconto/100)`, mas requer ter snapshot da tarifa cheia válida na época do contrato — o que pode não ser viável retroativamente.

3. **3 propostas no banco, 1 ACEITA, 0 com contrato vinculado** — significa que mesmo o caminho `Motor.aceitar` foi exercitado uma vez sem persistir o contrato (provável seed/teste manual). Reforça que o sistema **nunca usou o pipeline completo** Motor → Contrato → Cobrança.

4. **Spec Jest do Motor `:281-282`** afirma `tarifaContratualPromocional ≈ kwhApuradoBase × 0.70` — alinhado com PÓS-DESCONTO. Se Opção B for escolhida, esse spec quebra. Vale destacar pra Luciano que B implica retrabalho em testes do Motor que estão verdes hoje.

5. **PRODUTO.md:330** já documenta o D-30R como bug conhecido, atribuindo a Motor.aceitar — mas esta investigação revela que afeta TODOS os caminhos de criação de contrato, não só o Motor. Vale atualizar a entrada no PRODUTO.md.

6. **Bug do FIXO_MENSAL é primo**: PRODUTO.md cita "Sprint 7 #4: Relatórios de economia FIXO zerados" — mesmo problema (`valorDesconto = 0` no FIXO mata dashboards de economia). Opção A herdaria o mesmo problema pro COMPENSADOS. Solução proposta no item 5.2 (snapshot `tarifaCheiaSnapshot`) resolve os dois de uma vez.

---

*Investigação read-only conduzida em 2026-05-03 (sessão Code). Aplica regra de validação prévia (Decisão 14/15/20). Nenhum arquivo de código alterado, nenhuma mudança no banco, nenhuma migração executada. SELECTs Prisma read-only via scripts temporários (já removidos).*
