# Tickets abertos em 21/04/2026 — pra Sprint 7

## Ticket 1 — Auditar tela /dashboard/cooperados/[id]

**Origem:** descobertas da sondagem T3 (Sprint 5).

**Contexto:** A tela `/dashboard/cooperados/[id]/page.tsx` tem função de 
"aceitar proposta" (linha 983) mas não exige que admin escolha plano — 
cai em fallback silencioso pro "primeiro plano ativo da cooperativa". 
11+ telas do admin linkam pra ela; é a ficha central do cooperado, não 
pode ser removida diretamente.

T3 refinou o comportamento: quando fallback é usado, sistema cria 
notificação visível pro admin ("Contrato criado com plano padrão — 
revise"). Isso torna o problema visível em vez de silencioso.

**Escopo do ticket:**
- Medir por 4-6 semanas após produção real: quantas notificações 
  `PLANO_FALLBACK_APLICADO` são geradas
- Se volume alto: redesenhar a tela pra obrigar escolha de plano antes 
  do aceite
- Se volume baixo: manter como está, fallback vira comportamento 
  aceitável documentado
- Se volume zero: considerar remover o botão "aceitar proposta" da tela 
  e forçar uso do Wizard

**Métrica de decisão:** número de registros em `notificacoes` com 
`tipo = 'PLANO_FALLBACK_APLICADO'` criados nos primeiros 30 dias de 
produção.

---

## Ticket 2 — Bug em valorMensalEdp × 0.1 no motor

**Origem:** descobertas da sondagem T2 (Sprint 5).

**Localização:** `backend/src/motor-proposta/motor-proposta.service.ts`, 
função `calcularComPlano`, linha ~358 (após patch T3, pode ter deslocado 
algumas linhas).

**Problema:** 
```typescript
const valorMensalEdp = Math.round(
  (comparativoSemGD - valorMensalCooperebr) * 0.1 * 100
) / 100;
```

Calcula "10% da economia" como custo mínimo estimado da distribuidora. 
Isso é nonsense matemático — distribuidora cobra mínimo faturável ANEEL 
(taxa fixa por tipo de fornecimento), não 10% da economia. O `calcular()` 
legado (função irmã) já implementa o cálculo correto via 
`ConfigTenant.minimo_monofasico/bifasico/trifasico`.

**Escopo do ticket:**
- Portar a lógica de mínimo faturável do `calcular()` legado pra 
  `calcularComPlano()`
- Adicionar teste que valide o valor do mínimo faturável é lido da 
  configuração e não hardcoded
- Considerar extrair pra helper compartilhado

**Risco se não corrigido:** quando T7 migrar o Wizard pra usar 
`calcularComPlano()`, propostas passarão a mostrar economia 
ligeiramente errada pra cooperados.

---

## Ticket 3 — Refactor / remoção do calcular() legado

**Origem:** sondagens T2 e T3 (Sprint 5).

**Contexto:** Hoje coexistem duas funções no motor:
- `calcular()` (legado) — usado por todos os 4 callers ativos de aceitar()
- `calcularComPlano()` — implementação canônica com Tipo I/II (T2), não 
  usada em produção hoje

A T7 vai migrar o Wizard pra `calcularComPlano()`. Quando isso acontecer, 
`calcular()` fica sem callers e pode ser removido — mas tem 3 complicações:

1. Função tem comportamento próprio (implementa Tipo II + SEM_TRIBUTO 
   implicitamente). Contratos criados por ela antes da T7 têm snapshots 
   que podem divergir do método real usado.
2. Tem 16 testes no spec existente que precisam ser migrados ou removidos.
3. `cooperados.controller.ts` e `publico.controller.ts` chamam diretamente 
   o service — precisam ser atualizados junto.

**Escopo do ticket:**
- Após T7 e T9 estarem em produção por 30 dias sem regressão
- Marcar `calcular()` como `@deprecated` primeiro, com alerta de console 
  em dev
- Passados 60 dias sem uso, remover função + testes + endpoints
- Atualizar documentação interna

**Decisão pendente:** o ticket pode se transformar em "nunca remover" se 
algum caller externo (integração futura, cliente API) depender da rota 
`/motor-proposta/calcular`. Avaliar na hora.

---

## Ticket 4 — Bug pré-existente: FIXO_MENSAL reporta economia zero

**Origem:** descoberto durante sondagem T4 (Sprint 5), marcado com TODO
no código (commit 67eae97).

**Localização:** `backend/src/faturas/faturas.service.ts`, função
`calcularValorCobrancaPorModelo`, case `FIXO_MENSAL`.

**Problema:** Pra contratos FIXO_MENSAL, o cálculo retorna:

```typescript
valorBruto: valorContrato,   // valor final ao cooperado
valorDesconto: 0,            // zero sempre
valorLiquido: valorContrato, // igual ao bruto
```

Tecnicamente coerente pro cálculo do valor a cobrar (FIXO não tem
desconto incremental, o valor já embute tudo). Mas semanticamente
errado pra fins de relatório:

- `valorBruto` deveria representar "quanto o cooperado pagaria sem
  cooperativa" (estimável via `valorTotalOCR` da fatura).
- `valorDesconto` deveria representar "quanto a cooperativa economizou
  para o cooperado" (diferença entre os dois).

**Impacto:** Qualquer relatório ou dashboard que agregue `valorDesconto`
por cooperativa vai reportar economia = R$ 0 pra contratos FIXO.
Afeta dashboard comercial, relatórios de impacto pra stakeholders, e
eventualmente materiais de marketing baseados em dados reais.

**Não foi corrigido na T4** porque:
- Expandiria escopo da tarefa (2 arquivos, cobertura de edge cases)
- FIXO é o único modelo ativo hoje (BLOQUEIO_MODELOS_NAO_FIXO=true)
  mas o sistema ainda não está em produção real, então não há
  relatórios saindo errados pra ninguém hoje

**Escopo do ticket:**

1. Trocar a lógica do case FIXO_MENSAL em `calcularValorCobrancaPorModelo`:
   - `valorBruto` = `valorTotalOCR` (se fatura existe) ou fallback
     documentado (ex: `kwhConsumido × tarifaApurada`)
   - `valorDesconto` = `valorBruto - valorLiquido`
   - `valorLiquido` mantém comportamento atual (= `valorContrato`)

2. Adicionar teste em `faturas.service.calcular.spec.ts` dentro do
   describe FIXO_MENSAL:
   - Fatura com `totalAPagar = 1235.93`, `valorContrato = 988.77`
   - Esperado: `valorBruto = 1235.93`, `valorDesconto = 247.16`,
     `valorLiquido = 988.77`

3. Considerar edge cases:
   - Fatura sem `totalAPagar` (OCR falhou) → usar fallback
   - `valorBruto < valorLiquido` (admin configurou valorContrato
     maior que a conta cheia) → lançar erro ou logar warning?

**Dependências:** Nenhuma. Pode ser corrigido isoladamente.

**Prioridade sugerida:** MÉDIA. Antes de entrar em produção com
dashboard comercial funcionando.

**Estimativa:** S (~30min código + 15min teste).

---

## Ticket 5 — Infra de testes E2E de usuário final (front+back integrados)

**Origem:** decisão 21/04/2026 durante planejamento da T8 do Sprint 5.

**Contexto:** T8 adotou abordagem B2 (testes com mocks Prisma, focados
em fluxo através de services). Foi escolha pragmática — usa infra de
teste que já funciona, fecha o Sprint 5 no prazo. Mas cobre só backend
isolado com mocks, não o sistema integrado.

**Falta cobrir:** testes que simulem admin real usando a aplicação:
- Admin abre /dashboard/planos/novo, preenche campos, clica Salvar,
  verifica que plano aparece na lista
- Admin gera proposta no Wizard, envia link de assinatura, cooperado
  assina em outra aba, sistema cria contrato
- Fatura PDF chega por email → OCR → cobrança é gerada → admin aprova
  → notificação WhatsApp dispara

**Escopo do ticket:**

Escolher e instalar uma das alternativas:

- **Playwright** (recomendado) — E2E via browser real, testa frontend +
  backend + banco juntos. Gravação de interações, screenshots em
  caso de falha. Stack coerente com Next.js.
- **Cypress** — similar ao Playwright, ecossistema maduro, mais
  opinativo.
- **Supertest + Prisma SQLite in-memory** — só backend HTTP, não
  testa UI. Mais leve mas cobre menos.

Primeira bateria de testes:
1. Fluxo completo Wizard Admin — criar cooperado → aceitar proposta
   → documentos → assinatura → contrato criado
2. Fluxo público /cadastro — upload fatura → OCR → proposta → aceite
3. Pipeline email→OCR→cobrança com fatura PDF real (fixture)
4. Admin edita plano e vê mudança refletida na tela

**Dependências:**

- Sprint 6 precisa concluir primeiro (CooperToken + UI refactor),
  senão fluxos mudam durante desenvolvimento dos testes
- Definir estratégia de dados de teste: fixture shared ou seed por
  teste?
- CI/CD: pipeline precisa rodar Playwright em container

**Estimativa:** L (1-2 semanas). Setup inicial + 4-6 cenários base.

**Prioridade sugerida:** ALTA antes de primeiro cliente real em
produção. Hoje a gente tem 78 testes unitários e zero E2E. É
sustentável em dev, insustentável em produção.

**Quando fazer:** Sprint 7 ou 8 — depende de quando Sprint 6 fechar.

---

## Ticket 6 — OCR: tarifas trocadas em faturas B3 comercial simples

**Origem:** revisão de baseline 21/04/2026 durante T8 Parte B Sprint 5.

**Reproduzível:** `backend/test/fixtures/faturas/edp-moradas-enseada.pdf`

**Bug:** `extrairDadosFatura()` está confundindo colunas em faturas
B3-COMERCIAL sem compensação. Campos extraídos errados:

```json
"tarifaTUSD": 0.682         // CORRETO: 0.60322723
"tarifaTE": 0.46685         // CORRETO: 0.41277630
"tarifaTUSDSemICMS": 0.60322723  // CORRETO: 0.46863
"tarifaTESemICMS": 0.4127763     // CORRETO: 0.32068
```

Padrão do erro: `0.682 = 682.25 / 1000` — OCR pegou "Valor Total R$"
e dividiu. Nas faturas Carol (B1 sem GD) e Luciano (B1 com GD) as
tarifas saíram corretas. Só Moradas diverge.

**Causa provável:** formato visual da fatura Moradas tem colunas
"Preço Unit (R$) com tributos" separadas em 2 colunas. OCR confundiu.

**Impacto hoje:** baixo — cálculo de cobrança usa `totalAPagar /
consumoAtualKwh` (apuração), não `tarifaTUSD`. Mas relatórios futuros
que dependam de tarifa discriminada vão ficar errados.

**Ação:** ajustar prompt do Anthropic em `faturas.service.ts:1186`
(função `extrairDadosFatura`). Adicionar ao prompt instrução
explícita: "para extrair tarifaTUSD e tarifaTE, buscar a coluna
'Tarifa Unit. (R$)' quando presente. Não confundir com 'Preço Unit.
(R$) com tributos' nem derivar de valor total."

**Validação:** rodar `npx ts-node backend/scripts/smoke-pipeline-fatura.ts --update`
após fix e comparar expected.json antes/depois. Campos afetados
devem bater com o PDF.

**Estimativa:** S (2-3h)

---

## Ticket 7 — OCR: campos inventados ou zerados em faturas com GD

**Origem:** revisão de baseline 21/04/2026 durante T8 Parte B Sprint 5.

**Reproduzível:** `backend/test/fixtures/faturas/edp-luciano-gd.pdf`

**Três sub-bugs:**

### 7.1 — Campo inventado: `saldoKwhAnterior`

```json
"saldoKwhAnterior": 4597.7249
```

O PDF do Luciano **não mostra saldo anterior**. Mostra apenas:
- "Saldo Total 5442,4690kWh"
- "Saldo Atualizado no mês 5442,4690kWh"

OCR parece ter calculado: `5442.469 - (1832.7441 - 988) = 4597.7249`.
Pode estar matematicamente correto, mas **inventou número que não
está no PDF**. É alucinação. No próximo PDF pode inventar diferente.

**Ação:** ajustar prompt pra retornar `null` quando campo não
aparece explicitamente no PDF.

### 7.2 — `valorSemDesconto: 0`

Em faturas com GD, esse campo deveria ter o valor **bruto** (antes
da compensação). Na fatura do Luciano, a soma das linhas
"TUSD/TE - Energia Ativa Fornecida" = R$ 656,30 + R$ 449,11 + iluminação
= ~R$ 1.135 (valor se não houvesse compensação).

OCR está zerando esse campo. Prompt deve extrair valor bruto das
linhas de "Fornecida" somando.

### 7.3 — `valorCompensadoReais: 0`

Soma dos 4 lançamentos "En. At. Inj." em R$ deveria popular esse
campo. Hoje zerado.

**Impacto hoje:** médio. Cálculo de cobrança COMPENSADOS não usa
esses campos (usa `totalAPagar` + `consumoAtualKwh`). Mas relatório
de economia gerada pra cooperado vai ficar errado — sistema não
saberá calcular "cooperado teria pago R$ X sem a cooperativa".

**Estimativa:** M (4-6h — requer testar prompt em várias faturas)

---

## Ticket 8 — OCR: normalização de numeroUC e mesReferencia

**Origem:** revisão de baseline 21/04/2026 durante T8 Parte B Sprint 5.

**Reproduzível:** todas as 3 fixtures de smoke test apresentam o bug.

**Bug 8.1 — numeroUC com formatação:**

Todas as 3 faturas retornam `numeroUC` no formato EDP com pontos e hífen:

```
edp-carol.pdf:            "0.001.516.624.054-75"
edp-moradas-enseada.pdf:  "0.000.944.225.054-57"
edp-luciano-gd.pdf:       "0.001.421.380.054-70"
```

Matching de cooperado em `email-monitor.service.ts:266/470` (após
hotfix T5) usa `numero` do campo UC na tabela Prisma. Se banco
armazena como "001516624054" (dígitos) e OCR retorna com pontos,
matching falha silenciosamente. Fatura entra no sistema sem vincular
a cooperado.

**Bug 8.2 — mesReferencia MM/YYYY:**

Todas retornam `mesReferencia` como `"03/2026"`. Mas testes T4
(promoção temporal) usam formato `"2026-03"` (YYYY-MM):

```typescript
// em calcular.spec.ts
dadosExtraidos: { mesReferencia: '2026-04', consumoAtualKwh: 500 }
```

Se o código não normaliza, **promoção temporal T4 nunca dispara em
produção com fatura real**.

**Ação:** adicionar pós-processamento na saída de
`extrairDadosFatura()` em `faturas.service.ts`:

```typescript
// Normalizar numeroUC (dígitos puros)
if (result.numeroUC) {
  result.numeroUC = String(result.numeroUC).replace(/[^0-9]/g, '');
}

// Normalizar mesReferencia (YYYY-MM)
if (result.mesReferencia && /^\d{2}\/\d{4}$/.test(result.mesReferencia)) {
  const [mes, ano] = result.mesReferencia.split('/');
  result.mesReferencia = `${ano}-${mes}`;
}
```

**Validação:** sonda em `backend/src` pra verificar se já existe
normalização em algum ponto do pipeline antes de commitar fix. Se
existir em camada posterior (ex: `email-monitor` antes de comparar),
documentar onde e não duplicar.

**Estimativa:** S (2h — 1 função + 2 testes unitários)

**Nota:** esse ticket precisa ser feito **antes** de T9 escalar
COMPENSADOS pra múltiplas faturas/cooperados, ou matching vai
falhar em produção.
