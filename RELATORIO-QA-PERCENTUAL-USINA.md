# Relatório QA — percentualUsina no modelo Contrato

**Data:** 2026-03-20
**Escopo:** Migração do campo `percentualUsina` de Cooperado para Contrato
**Método:** Análise estática de código — nenhuma alteração realizada

---

## 1. O CAMPO ESTÁ CORRETAMENTE NO MODELO CONTRATO?

**Status: SIM, com ressalva**

- `Contrato.percentualUsina` existe em `schema.prisma:172` como `Decimal? @db.Decimal(8, 4)` — correto.
- `Cooperado.percentualUsina` **ainda existe** em `schema.prisma:41` — campo legado não foi removido.

**Ressalva:** O campo antigo `Cooperado.percentualUsina` permanece no schema. Isso cria ambiguidade: qual é a fonte de verdade? O frontend em `cooperados/[id]/page.tsx:685,758` ainda lê `cooperado.percentualUsina` para exibir "% da usina" no detalhe do cooperado. Esse valor legado pode estar desatualizado ou nunca ser preenchido para cooperados novos.

**Recomendação:** Após confirmar que nenhum código depende exclusivamente de `Cooperado.percentualUsina`, remover o campo do schema e do frontend. Enquanto isso, documentar que a fonte de verdade é `Contrato.percentualUsina`.

---

## 2. O CÁLCULO ESTÁ CORRETO?

**Status: SIM, fórmula correta — arredondamento consistente**

A fórmula aplicada em todos os caminhos é:

```
percentualUsina = (kwhContrato / usina.capacidadeKwh) * 100
```

Arredondamento: `Math.round(valor * 10000) / 10000` (4 casas decimais) — compatível com `Decimal(8,4)`.

### Locais onde o cálculo é feito:

| Local | Arquivo:Linha | Fórmula | Arredondamento |
|-------|---------------|---------|----------------|
| Criação manual | `contratos.service.ts:63` | `(kwhContrato / capacidade) * 100` | `Math.round(x * 10000) / 10000` |
| Update manual | `contratos.service.ts:156` | via `validarCapacidadeUsina()` | idem |
| Motor-proposta aceitar | `motor-proposta.service.ts:316` | `(r.kwhContrato / capacidade) * 100` | `Math.round(x * 100 * 10000) / 10000` |
| Alocar lista espera | `motor-proposta.service.ts:552` | `(kwhContrato / capacidadeKwh) * 100` | `Math.round(x * 100 * 10000) / 10000` |
| Ativação cooperado | `cooperados.service.ts:144` | `(kwhContrato / capacidadeKwh) * 100` | `Math.round(x * 10000) / 10000` |

### BUG ENCONTRADO: Inconsistência de arredondamento

- **`contratos.service.ts:63,73`** e **`cooperados.service.ts:147`**: `Math.round((kwhContrato / capacidade) * 100 * 10000) / 10000`
  - Na verdade em `contratos.service.ts:63` a fórmula é `(kwhContrato / capacidade) * 100`, e o arredondamento em `:73` é `Math.round(novoPercentual * 10000) / 10000`. Resultado: 4 casas decimais do percentual. **CORRETO.**
- **`motor-proposta.service.ts:316`**: `Math.round((r.kwhContrato / capacidade) * 100 * 10000) / 10000`
  - Aqui `* 100 * 10000` = `* 1000000`. Se kwhContrato=500, capacidade=10000, resultado = `Math.round(500/10000 * 100 * 10000) / 10000` = `Math.round(500000) / 10000` = `50.0000`. **OK, mesmo resultado — apenas agrupamento diferente.**

Conclusão: Apesar da escrita diferente, ambas as formas produzem o mesmo resultado numérico. Sem bug real.

---

## 3. VALIDAÇÃO DE 100% — ESTÁ IMPLEMENTADA?

**Status: PARCIALMENTE — cobre criação e update manuais, NÃO cobre motor-proposta**

### Onde está implementada:

| Caminho | Valida 100%? | Detalhes |
|---------|-------------|----------|
| `ContratosService.create()` | **SIM** | Via `validarCapacidadeUsina()` (linha 103) — lança `BadRequestException` se soma > 100.0001% |
| `ContratosService.update()` | **SIM** | Via `validarCapacidadeUsina()` com `excludeContratoId` (linha 156) |
| `MotorPropostaService.aceitar()` | **NÃO** | Busca usina com kWh disponível (linhas 291-298), mas a validação usa kWh absoluto, não percentual. Calcula percentual (linhas 310-317) mas **não valida se soma > 100%** |
| `MotorPropostaService.alocarListaEspera()` | **NÃO** | Calcula percentualUsina (linhas 550-553) mas **não valida capacidade** antes de alocar |
| `CooperadosService.update()` (ativação) | **NÃO** | Apenas grava percentual para contratos que ainda não têm (linha 143). Não valida soma. |

### BUG-PU-01: Motor-proposta não usa `validarCapacidadeUsina()`

**Severidade: ALTA**

O motor-proposta em `aceitar()` verifica capacidade em kWh absoluto (linha 293: `kwhDisponivel >= r.kwhContrato`) mas:
1. Só considera contratos com `status: 'ATIVO'` (linha 284) — ignora `PENDENTE_ATIVACAO`
2. Não valida o percentual final — dois contratos aceitos rapidamente podem passar de 100%

O método `validarCapacidadeUsina()` do `ContratosService` é mais robusto (inclui `ATIVO` e `PENDENTE_ATIVACAO`), mas **não é chamado pelo motor-proposta**.

### BUG-PU-02: `alocarListaEspera()` não valida capacidade

**Severidade: ALTA**

Ao alocar cooperado da lista de espera em uma usina (`motor-proposta.service.ts:529-571`), o método calcula o percentual mas **não verifica se a usina tem capacidade suficiente**. Um operador pode alocar mais kWh do que a usina suporta.

---

## 4. EXISTE CAMINHO SEM CALCULAR percentualUsina?

**Status: SIM — existem 3 caminhos problemáticos**

### CAMINHO-01: Criação manual sem `kwhContrato` ou sem `usinaId`

**Arquivo:** `contratos.service.ts:101-104`

```typescript
if (data.usinaId && data.kwhContrato) {
  percentualUsina = await this.validarCapacidadeUsina(data.usinaId, data.kwhContrato);
}
```

Se o operador criar contrato manual **sem informar kwhContrato** (campo não está no formulário frontend — ver DAT-01 do relatório de contratos), o percentualUsina será `undefined` → salvo como `null` no banco.

**Impacto:** Contrato ativo sem percentualUsina. O relatório de concessionária usará fallback de cálculo, mas outros locais podem falhar.

### CAMINHO-02: Ativação de cooperado — condição `!c.percentualUsina`

**Arquivo:** `cooperados.service.ts:143`

```typescript
if (c.usina && Number(c.usina.capacidadeKwh ?? 0) > 0 && !c.percentualUsina) {
```

A condição `!c.percentualUsina` significa: só calcula se ainda não tem valor. Isso é intencional (evita sobrescrever), mas se o contrato foi criado com `kwhContrato` diferente do atual (ex: editado posteriormente), o percentual antigo permanece — potencialmente incorreto.

### CAMINHO-03: Motor-proposta com usina sem `capacidadeKwh`

**Arquivo:** `motor-proposta.service.ts:315`

```typescript
if (capacidade > 0) {
  percentualUsina = ...
}
```

Se a usina alocada tem `capacidadeKwh = null` ou `0`, o percentual será `null`. O contrato fica sem percentual.

---

## 5. RELATÓRIO PARA CONCESSIONÁRIA USA `Contrato.percentualUsina`?

**Status: SIM, com fallback**

**Arquivo:** `usinas.service.ts:153-156`

```typescript
const percentual = c.percentualUsina
  ? Number(c.percentualUsina)
  : (capacidade > 0 ? Math.round((kwh / capacidade) * 10000) / 100 : 0);
```

O relatório usa `Contrato.percentualUsina` como fonte primária, com fallback para cálculo on-the-fly se o campo for `null`.

### BUG-PU-03: Arredondamento diferente no fallback

**Severidade: BAIXA**

O fallback no relatório usa `Math.round(x * 10000) / 100` (2 casas decimais do percentual), enquanto todos os outros cálculos usam `Math.round(x * 10000) / 10000` (4 casas decimais). Isso gera discrepância entre contratos com e sem `percentualUsina` gravado.

Exemplo: kwhContrato=333, capacidade=10000
- Com campo gravado: `3.3300`
- Fallback: `3.33`

Diferença desprezível neste caso, mas pode causar inconsistência visual.

### Frontend da usina

**Arquivo:** `web/app/dashboard/usinas/[id]/page.tsx:275`

Exibe `c.percentualUsina` direto do retorno da API (que já inclui o fallback). Funciona corretamente.

---

## 6. RISCO DE RACE CONDITION?

**Status: SIM — risco real em 2 cenários**

### RACE-01: Dois contratos criados simultaneamente na mesma usina via `ContratosService.create()`

**Severidade: MÉDIA**

O método `validarCapacidadeUsina()` (linha 38-74) faz:
1. `findMany` dos contratos ativos da usina
2. Soma os percentuais
3. Verifica se cabe
4. Retorna

**Nenhuma dessas operações está em transação.** Entre o passo 1 e o `create` final (linha 121), outro processo pode ter criado outro contrato. Ambos passam na validação mas juntos excedem 100%.

**Mitigação existente:** A tolerância `> 100.0001` ajuda com erros de arredondamento mas não protege contra concorrência real.

### RACE-02: `aceitar()` do motor-proposta — mesma usina

**Severidade: ALTA**

O motor-proposta em `aceitar()` busca usinas com capacidade (linhas 280-298), mas:
1. Não usa transação
2. A verificação de capacidade usa kWh absoluto
3. Dois operadores podem aceitar propostas para a mesma usina simultaneamente
4. Ambos encontram a usina "com vaga" e criam contratos — ultrapassando a capacidade

**Agravante:** Diferente do `create()`, o motor-proposta nem lança exceção — simplesmente cria o contrato. A sobre-alocação passa silenciosamente.

### Recomendação para ambos:

Envolver a verificação de capacidade + criação do contrato em `prisma.$transaction()` com `isolationLevel: 'Serializable'`, ou usar `SELECT ... FOR UPDATE` na usina.

---

## 7. RESUMO

### O que está CORRETO

1. Campo `Contrato.percentualUsina` existe no schema com tipo adequado (`Decimal(8,4)`)
2. Fórmula de cálculo `(kwhContrato / capacidadeKwh) * 100` é consistente em todos os locais
3. Arredondamento para 4 casas decimais é consistente entre os caminhos principais
4. Relatório de concessionária usa o campo com fallback inteligente
5. `ContratosService.create()` e `update()` validam capacidade via `validarCapacidadeUsina()`
6. `validarCapacidadeUsina()` considera contratos `ATIVO` e `PENDENTE_ATIVACAO`
7. `validarCapacidadeUsina()` aceita `excludeContratoId` para evitar conflito consigo mesmo no update
8. Ativação em cascata (`cooperados.service.ts:142-149`) agora grava percentualUsina **por contrato** — corrigindo o bug antigo (BUG-08/INC-02) que sobrescrevia no cooperado

### Bugs encontrados

| # | Bug | Severidade | Arquivo | Descrição |
|---|-----|-----------|---------|-----------|
| PU-01 | Motor-proposta não valida 100% | ALTA | `motor-proposta.service.ts:280-298` | Usa kWh absoluto e só filtra `status: 'ATIVO'` (ignora `PENDENTE_ATIVACAO`). Não chama `validarCapacidadeUsina()`. |
| PU-02 | `alocarListaEspera()` não valida capacidade | ALTA | `motor-proposta.service.ts:547-557` | Calcula percentual mas não verifica se soma > 100%. |
| PU-03 | Fallback no relatório com arredondamento diferente | BAIXA | `usinas.service.ts:156` | `* 10000 / 100` vs `* 10000 / 10000` — 2 vs 4 casas decimais. |

### Riscos

| # | Risco | Severidade | Descrição |
|---|-------|-----------|-----------|
| PU-R1 | Race condition na criação | MÉDIA | `validarCapacidadeUsina()` sem transação. Dois creates simultâneos podem ultrapassar 100%. |
| PU-R2 | Race condition no motor-proposta | ALTA | `aceitar()` sem transação nem validação de percentual. Sobre-alocação silenciosa. |
| PU-R3 | Campo legado `Cooperado.percentualUsina` | MÉDIA | Ambiguidade de fonte de verdade. Frontend cooperados ainda lê do cooperado, não do contrato. |
| PU-R4 | Contrato manual sem kwhContrato | MÉDIA | Formulário frontend não tem campo kwhContrato → percentualUsina salvo como null. |

### O que ainda falta

| # | Item | Prioridade | Descrição |
|---|------|-----------|-----------|
| 1 | Centralizar validação de capacidade | ALTA | Motor-proposta (`aceitar()` e `alocarListaEspera()`) deveria chamar `ContratosService.validarCapacidadeUsina()` em vez de lógica própria. |
| 2 | Envolver em transação | ALTA | `validarCapacidadeUsina()` + `contrato.create()` devem estar em `prisma.$transaction()` para evitar race condition. |
| 3 | Remover `Cooperado.percentualUsina` | MÉDIA | Campo legado. Remover do schema e atualizar frontend para ler de `Contrato.percentualUsina`. |
| 4 | Recalcular percentual ao encerrar contrato | MÉDIA | Quando contrato é encerrado, o percentual fica "ocupando espaço" na soma da usina. Deveria zerar ou o filtro de soma deveria excluir encerrados (já exclui — mas o campo permanece). |
| 5 | Corrigir arredondamento no fallback do relatório | BAIXA | Unificar para 4 casas decimais (`/ 10000`). |
| 6 | Adicionar kwhContrato ao formulário frontend | MÉDIA | Sem este campo, contratos manuais nunca terão percentualUsina calculado. |

---

*Relatório gerado em 2026-03-20. Análise estática — nenhuma alteração realizada.*
