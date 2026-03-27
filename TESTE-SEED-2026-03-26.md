# Relatório de Testes - CoopereBR QA
**Data:** 2026-03-26
**Executado por:** Subagente QA Assis
**Backend:** http://localhost:3000

---

## PARTE 1 — Seed de Dados

### Dados Criados

| Entidade | Detalhes | Status |
|----------|----------|--------|
| Cooperativa | CoopereBR Teste (ID: cmn7qygzg0000uoawdtfvokt5 → migrado para cmn0ho8bx0000uox8wu96u6fd) | ✅ |
| Config Clube de Vantagens | 4 níveis: Bronze/Prata/Ouro/Diamante | ✅ |
| Administradora | Gestão Predial Vitória Ltda (ID: 01f67d30-5fe3-4a6b-bd27-d1af370ba221) | ✅ |
| Condomínio | Residencial Solar das Palmeiras (ID: d3afc143-2f3c-4d2d-ad2c-06f26261f678) | ✅ |
| Condôminos | 10 unidades criadas (Blocos A e B) | ✅ |
| Progressão Clube | 4 cooperados com níveis Bronze/Prata/Ouro/Diamante | ✅ |
| Cobranças Condomínio | 3 cobranças (PAGO/PENDENTE/VENCIDO) | ✅ |
| Cobranças Maria Silva | 2 cobranças (PAGO/PENDENTE) | ✅ |

**Nota:** O seed criou a cooperativa nova, mas o usuário admin pertencia à cooperativa existente. Foi necessário executar script de migração (`fix-cooperativa.ts`) para mover todos os dados para a cooperativa do admin (`cmn0ho8bx0000uox8wu96u6fd`).

---

## PARTE 2 — Testes das Funcionalidades

### 2.1 Clube de Vantagens

#### ✅ GET /clube-vantagens/ranking?periodo=mes
**Resultado:** Pedro Costa está no topo com 55.000 kWh e nível DIAMANTE

```json
{
  "periodo": "mes",
  "dataInicio": "2026-03-01",
  "top10": [
    { "posicao": 1, "nome": "Pedro Henrique Costa", "nivelAtual": "DIAMANTE", "kwhAcumulado": 55000, "indicadosAtivos": 15, "beneficioPercentual": 10, "progressoRelativo": 100 },
    { "posicao": 2, "nome": "Ana Paula Ferreira", "nivelAtual": "OURO", "kwhAcumulado": 18000, "indicadosAtivos": 8, "beneficioPercentual": 6, "progressoRelativo": 33 },
    { "posicao": 3, "nome": "João Carlos Oliveira", "nivelAtual": "PRATA", "kwhAcumulado": 8000, "indicadosAtivos": 5, "beneficioPercentual": 4, "progressoRelativo": 15 },
    { "posicao": 4, "nome": "Maria Silva Santos", "nivelAtual": "BRONZE", "kwhAcumulado": 3500, "indicadosAtivos": 2, "beneficioPercentual": 2, "progressoRelativo": 6 }
  ]
}
```

#### ✅ GET /clube-vantagens/analytics
**Resultado:** Distribuição correta dos 4 níveis

```json
{
  "totalMembros": 4,
  "indicadosAtivosTotal": 30,
  "kwhIndicadoTotal": 84500,
  "distribuicaoPorNivel": [
    { "nivel": "DIAMANTE", "count": 1 },
    { "nivel": "OURO", "count": 1 },
    { "nivel": "PRATA", "count": 1 },
    { "nivel": "BRONZE", "count": 1 }
  ]
}
```

---

### 2.2 Condomínio

#### ✅ GET /condominios
**Resultado:** Retornou o condomínio Residencial Solar das Palmeiras com 10 unidades ativas.

#### ✅ GET /condominios/{id} (com unidades)
**Resultado:** Todas as 10 unidades listadas corretamente:

```
101-A: Maria Silva Santos
102-A: João Carlos Oliveira
201-A: Ana Paula Ferreira
202-A: Pedro Henrique Costa
301-A: Carla Regina Souza
101-B: Marcos Antonio Lima
102-B: Fernanda Cristina Rocha
201-B: Ricardo Alves Neto
202-B: Patrícia Moura Dias
301-B: Gustavo Torres Pinto
```

#### ✅ POST /condominios/{id}/rateio (energiaTotal: 1000)
**Resultado:** Cada uma das 10 unidades recebeu exatamente 100 kWh (percentual fixo 10% cada).

```
101-A: 100 kWh
102-A: 100 kWh
201-A: 100 kWh
202-A: 100 kWh
301-A: 100 kWh
101-B: 100 kWh
102-B: 100 kWh
201-B: 100 kWh
202-B: 100 kWh
301-B: 100 kWh
```

**Nota:** O campo aceito é `energiaTotal` (não `kWhGerado` como descrito no spec). O campo `kWhGerado` retorna erro.

---

### 2.3 PIX Excedente

#### ⚠️ POST /financeiro/pix-excedente (sem alíquotas explícitas)
**Resultado:** Endpoint funciona, mas **impostos retornam zerados** mesmo com alíquotas configuradas no condomínio.

```json
{
  "valorBruto": 500,
  "impostos": { "IR": 0, "PIS": 0, "COFINS": 0, "total": 0 },
  "valorLiquido": 500,
  "status": "SIMULADO"
}
```

**Bug encontrado:** O serviço `pix-excedente.service.ts` busca alíquotas apenas em `configClubeVantagens` (que não tem esses campos), mas **não busca do model `Condominio`** onde estão os campos `aliquotaIR`, `aliquotaPIS`, `aliquotaCOFINS`. 

**Linha do bug:** `pix-excedente.service.ts` ~linha 74 — ao buscar config do condomínio para PIX, só pega `excedentePixChave` e `excedentePixTipo`, mas não as alíquotas.

#### ✅ POST /financeiro/pix-excedente (com alíquotas explícitas no body)
**Resultado:** Cálculo correto quando alíquotas passadas no body.

```json
{
  "valorBruto": 500,
  "impostos": {
    "IR": { "aliquota": 1.5, "valor": 7.50 },
    "PIS": { "aliquota": 0.65, "valor": 3.25 },
    "COFINS": { "aliquota": 3.0, "valor": 15.00 },
    "total": 25.75
  },
  "valorLiquido": 474.25,
  "status": "SIMULADO"
}
```

---

### 2.4 Cooperados

#### ✅ GET /cooperados
**Resultado:** Listou 80 cooperados (incluindo os 11 do seed). Retorna todos os dados.

#### ✅ Badge de nível nos dados dos cooperados
**Resultado:** Os cooperados com progressão no Clube de Vantagens mostram o nível:

```
Pedro Henrique Costa → DIAMANTE
Ana Paula Ferreira   → OURO
João Carlos Oliveira → PRATA
Maria Silva Santos   → BRONZE
```

**Observação:** Cooperados sem progressão cadastrada não exibem o badge (progressaoClube: null). Os 6 condôminos restantes (Carla, Marcos, Fernanda, Ricardo, Patrícia, Gustavo) não têm progressão — isso é esperado, já que o spec só pediu progressão para 4 deles.

---

## PARTE 3 — Bugs Encontrados

### 🐛 Bug #1 — PIX Excedente ignora alíquotas do Condomínio
**Severidade:** Média
**Arquivo:** `src/financeiro/pix-excedente.service.ts` (~linha 74)
**Descrição:** Ao processar PIX de excedente com `condominioId`, o serviço busca `excedentePixChave` e `excedentePixTipo` do condomínio, mas não busca os campos `aliquotaIR`, `aliquotaPIS` e `aliquotaCOFINS` do mesmo. O fallback busca em `configClubeVantagens` que não tem esses campos, resultando em alíquotas zeradas.

**Fix sugerido:**
```typescript
// Ao buscar dados do condomínio, incluir as alíquotas:
const cond = await this.prisma.condominio.findUnique({
  where: { id: dto.condominioId },
  select: { 
    excedentePixChave: true, 
    excedentePixTipo: true,
    aliquotaIR: true,      // ← ADICIONAR
    aliquotaPIS: true,     // ← ADICIONAR
    aliquotaCOFINS: true,  // ← ADICIONAR
  },
});
// E usar cond.aliquotaIR como default quando não vierem no body
```

### 🐛 Bug #2 — Campo do rateio: spec diz `kWhGerado` mas API aceita `energiaTotal`
**Severidade:** Baixa (inconsistência de nomes)
**Arquivo:** `src/condominios/condominios.controller.ts` (linha com `body.energiaTotal`)
**Descrição:** O spec e o frontend podem enviar `kWhGerado: 1000` mas o controller espera `energiaTotal`. O campo `kWhGerado` é simplesmente ignorado.

### ✅ Nenhum erro crítico no seed
O seed precisou de migração posterior (os dados foram criados em uma nova cooperativa mas o admin pertence a outra). Para uso futuro, o script deve receber `cooperativaId` como parâmetro ou buscar da variável de ambiente.

---

## Score Final

| Categoria | Testes | Passou | Falhou | Score |
|-----------|--------|--------|--------|-------|
| Seed / Dados | 8 | 8 | 0 | 100% |
| Clube de Vantagens | 2 | 2 | 0 | 100% |
| Condomínio | 3 | 3 | 0 | 100% |
| PIX Excedente | 1 | 0 | 1 | 0% (bug) |
| Cooperados | 2 | 2 | 0 | 100% |
| **TOTAL** | **16** | **15** | **1** | **93.75%** |

### 🎯 Score Final: 93.75% (15/16 testes passaram)

**2 bugs encontrados, 1 funcional com workaround (passar alíquotas no body)**
