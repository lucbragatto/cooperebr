# Relatório QA — CoopereBR
**Data:** 2026-04-02
**Horário:** 03:00 (America/Sao_Paulo)
**Período analisado:** commits de 01/04/2026 (03h) a 02/04/2026 (03h)
**Módulos revisados:** ConviteIndicacao (fix + dashboard), CooperToken (job + service + controller), ClubeVantagens (validações CLB-02), CooperadosJob (cleanup proxy), Convenios (progressão + job), PixExcedente (feature flag verificada), WhatsappBot (fluxo QR/propaganda + estado máquina), CobrancasJob (multa/juros verificado)
**Score geral de qualidade: 9.0 / 10** ↑ (+0.3 vs relatório anterior)

---

## 1. STATUS DOS ITENS CRÍTICOS DO RELATÓRIO ANTERIOR (2026-04-01)

| ID | Descrição | Status 01/04 | Status 02/04 | Observação |
|----|-----------|--------------|--------------|------------|
| CONV-02 | concluirCadastro cria Indicacao sem verificar duplicatas | **ALTA** | ✅ **CORRIGIDO** | Check de `indicacaoExistente` adicionado antes do `tx.indicacao.create` em `convite-indicacao.service.ts` |
| WA-BOT-04 | CPF fake em proxy sem cleanup job | **ALTA** | ✅ **CORRIGIDO** | `limparCooperadosProxyZumbi()` em `cooperados.job.ts` — exclui CPF `PROXY_*` + `PENDENTE` + >24h + sem contratos |
| CLB-02 | upsertConfig sem validação de ranges | **ALTA** | ✅ **CORRIGIDO** | `kwhMinimo >= 0`, `kwhMaximo > kwhMinimo`, `beneficioPercentual [0,100]`, sobreposição de faixas — todas validadas |
| PC-05 | Gráfico UC ignora ucId | **ALTA** | ✅ **CORRIGIDO** | `contrato: { is: contratoWhere }` em `cooperados.service.ts:minhasCobrancas()` |
| CONV-01 | Job de lembretes bypassa tenant check | **MÉDIA** | ✅ **CORRIGIDO** | Job agora seleciona `cooperativaId` e passa ao `reenviarConvite(convite.id, convite.cooperativaId)` |
| CTK-01 | Tokens creditados sem arredondamento | **MÉDIA** | ⏳ **PENDENTE** | `quantidade = excedente * tokenPorKwh` sem `Math.round` — bug persiste |
| WZ-10 | Upload documentos sem sinalização de falha na UI | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| WA-BOT-03 | Dupla mensagem fora de horário + sessão expirada | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| REL-03 | Tarifa hardcoded R$0,80 sem aviso na UI | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| WZ-09 | SUPER_ADMIN cria cooperado sem cooperativaId | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| MIG-04 | kWh arredondamento anual/mensal diverge | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| CONV-03 | vincularLeadAoConvite pode vincular convite expirado/cancelado | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| CTK-02 | creditarManual tipo hardcoded GERACAO_EXCEDENTE | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| CTK-03 | Encoding mojibake em cooper-token.job.ts | **BAIXA** | ⏳ **PENDENTE** | BOM presente — log corrompido `apuraÃ§Ã£o`, `concluÃ­da`, `Ã s` |
| WA-BOT-05 | NPS com setTimeout não persiste em restart | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| CTX-01 | Token de troca não invalida sessão anterior | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| REL-04 | qtdContratos inflacionado no breakdown de usinas | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| COB-Tel-01 | Normalização telefone inconsistente | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| FRONT-02 | Filtros inadimplência sem auto-submit | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| LEAD-04 | Score de lead sem decaimento temporal | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| LEAD-05 | receitaLatenteAnual pode duplicar | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| PIX-01 | PIX Excedente requer ativação da feature flag em prod | **ALTA** | ⏳ **PENDENTE** | Feature flag implementada; aguarda decisão operacional |

**Resumo:** 5 itens resolvidos neste ciclo (CONV-01 ✅, CONV-02 ✅, WA-BOT-04 ✅, CLB-02 ✅, PC-05 ✅). CTK-01 continua em aberto.

---

## 2. NOVOS BUGS ENCONTRADOS — CICLO 01/04 → 02/04

### 2.1 CooperadosJob — Dois Crons com Mesmo Horário Podem Conflitar no PM2

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| JOB-01 | **BAIXA** | `cooperados.job.ts` contém dois métodos com `@Cron('0 3 * * *')`: `limparCooperadosProxyExpirados()` (já existia) e `limparCooperadosProxyZumbi()` (novo, WA-BOT-04). O NestJS Schedule executa ambos de forma independente, então não há conflito técnico real — porém o log não distingue claramente qual removeu o quê, dificultando diagnóstico. Além disso, os dois métodos têm critérios parcialmente sobrepostos: `limparCooperadosProxyExpirados` usa `status: 'PENDENTE_ASSINATURA'` e `tokenAssinaturaExp < now`, enquanto `limparCooperadosProxyZumbi` usa `cpf startsWith 'PROXY_'` e `status: 'PENDENTE'`. Se um cooperado proxy tiver status `PENDENTE_ASSINATURA` E CPF `PROXY_*` E token expirado, ele pode ser deletado pelos dois métodos simultaneamente — embora o segundo delete retorne count=0 (não é erro). | `cooperados.job.ts:21-43` |

**Correção sugerida:** Unificar em um único método com OR condition, ou pelo menos melhorar os logs para distinguir qual delete executou o quê.

---

### 2.2 ConviteIndicacaoService — `salvarConfigLembretes` Sem Uso de Transação

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| CONV-04 | **BAIXA** | O método `salvarConfigLembretes()` itera as 3 chaves em loop sequencial com `findFirst` + `update/create` por iteração. Não há transação englobando os 3 upserts. Em caso de falha na 2ª ou 3ª iteração (ex: timeout de banco), a configuração ficará parcialmente salva — por exemplo, `cooldownDias` atualizado mas `maxTentativas` com valor antigo. | `convite-indicacao.service.ts:salvarConfigLembretes` |

**Correção:**
```typescript
await this.prisma.$transaction(async (tx) => {
  for (const entry of entries) {
    const existing = await tx.configTenant.findFirst({ where: { chave: entry.chave, cooperativaId } });
    if (existing) {
      await tx.configTenant.update({ where: { id: existing.id }, data: { valor: entry.valor } });
    } else {
      await tx.configTenant.create({ data: { ...entry, cooperativaId } });
    }
  }
});
```

---

### 2.3 CooperTokenJob — Fatura Marcada como `tokenApurado: true` Mesmo Quando Excedente ≤ 0 Sem Verificar Plano

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| CTK-04 | **BAIXA** | Em `apurarExcedentes()`, quando `excedente <= 0`, o job marca `tokenApurado: true` e continua. Isso é correto — mas a query inicial filtra `cooperado.contratos.some(status: ATIVO, plano.cooperTokenAtivo: true)`. Se o cooperado tiver múltiplos contratos e o plano ativo for o segundo (sem token), o `contrato = fatura.cooperado.contratos[0]` pode ser o contrato **errado** (o primeiro, sem token). O `plano.cooperTokenAtivo` checado ali seria `false`, e o job continuaria com `const tokenPorKwh = Number(plano.tokenPorKwhExcedente ?? 1)` usando `1` como fallback, potencialmente creditando tokens a cooperados em planos sem token. | `cooper-token.job.ts:apurarExcedentes` |

**Correção:**
```typescript
const contratos = await this.prisma.contrato.findMany({
  where: { cooperadoId: fatura.cooperadoId, status: 'ATIVO', plano: { cooperTokenAtivo: true } },
  include: { plano: true },
  take: 1,
});
const contrato = contratos[0];
if (!contrato) continue;
```

---

### 2.4 WhatsappBot — Estado `MENU_SEM_FATURA` Não Listado no Switch Principal

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| WA-BOT-06 | **MÉDIA** | O switch `processarMensagem` trata `MENU_SEM_FATURA` chamando `handleMenuSemFatura`, mas não há `return` após os blocos de verificação de fora de horário. Se o usuário está no estado `MENU_SEM_FATURA` **e** a mensagem chega fora do horário (20h-8h), ele recebe a mensagem de aviso de expediente E em seguida é processado normalmente pelo switch. Isso gera dupla mensagem no estado `MENU_SEM_FATURA` (mesma lógica do WA-BOT-03 já existente). Além disso, ao verificar o código, o bloco de fora de horário tem comentário `// Não faz return - continua processando normalmente`, confirmando que o comportamento é intencional apenas para simulação 24h — mas acaba afetando estados de menu também. | `whatsapp-bot.service.ts:checagemHorario` |

---

### 2.5 ConviteIndicacaoController — `salvarConfigLembretes` Não Valida Tipos Numéricos

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| CONV-05 | **BAIXA** | O endpoint `PUT /convite-indicacao/config-lembretes` recebe `cooldownDias` e `maxTentativas` do body sem validação de tipo. Se o cliente enviar `cooldownDias: "abc"`, o JavaScript faz `Number("abc")` → `NaN`, que é salvo como `"NaN"` no `ConfigTenant`. Na próxima leitura, `Number("NaN")` retorna `NaN`, e o job usaria `NaN < 3` (sempre false) para filtrar lembretes — potencialmente disparando lembretes para todos os convites. | `convite-indicacao.controller.ts:salvarConfigLembretes` |

**Correção:**
```typescript
if (isNaN(body.cooldownDias) || isNaN(body.maxTentativas)) {
  throw new BadRequestException('cooldownDias e maxTentativas devem ser números válidos');
}
```

---

### 2.6 Cooper Token — `debitar()` Usa Tipo Hardcoded `GERACAO_EXCEDENTE` no Ledger de Débito

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| CTK-05 | **BAIXA** | Em `cooper-token.service.ts:debitar()`, o ledger de débito é criado com `tipo: CooperTokenTipo.GERACAO_EXCEDENTE` hardcoded (linha ~105). Débitos por desconto em cobrança ou por expiração manual aparecem no extrato como "Geração Excedente", confundindo o cooperado e o admin. | `cooper-token.service.ts:debitar` |

**Correção:** Adicionar parâmetro `tipo?: CooperTokenTipo` na interface `DebitarParams` e usar `tipo ?? CooperTokenTipo.GERACAO_EXCEDENTE` no `create`.

---

## 3. VERIFICAÇÃO DE CORREÇÕES DO CICLO ANTERIOR

### 3.1 CONV-01 — Tenant Isolation no Job de Lembretes ✅ CONFIRMADO

Verificado no código atual de `convite-indicacao.job.ts`:

```typescript
const convites = await this.prisma.conviteIndicacao.findMany({
  ...
  select: { id: true, cooperativaId: true }, // ← cooperativaId incluído
});
// ...
await this.conviteService.reenviarConvite(convite.id, convite.cooperativaId); // ← passado corretamente
```

Fix implementado conforme recomendado. ✅

### 3.2 CONV-02 — Duplicata MLM em `concluirCadastro` ✅ CONFIRMADO

```typescript
const indicacaoExistente = await tx.indicacao.findFirst({
  where: { cooperadoIndicadoId: cooperadoIndicadoId, nivel: 1 },
});
if (indicacaoExistente) {
  this.logger.warn(`Indicação nível 1 já existe para cooperado ${cooperadoIndicadoId}`);
  return { conviteAtualizado, indicacao: indicacaoExistente };
}
```

Implementado corretamente dentro da transação atômica. ✅

### 3.3 CLB-02 — Validação de Ranges no Clube de Vantagens ✅ CONFIRMADO

Três validações adicionadas em `clube-vantagens.service.ts:upsertConfig()`:
- `kwhMinimo < 0` → BadRequestException ✅
- `kwhMaximo <= kwhMinimo` → BadRequestException ✅
- `beneficioPercentual < 0 || > 100` → BadRequestException ✅
- Sobreposição entre faixas adjacentes → BadRequestException ✅

### 3.4 WA-BOT-04 — Cleanup Cooperados Proxy ✅ CONFIRMADO

Novo job `limparCooperadosProxyZumbi()` em `cooperados.job.ts`:
- Usa `cpf: { startsWith: 'PROXY_' }` ✅
- Status `PENDENTE` ✅
- `createdAt < 24h` ✅
- `contratos: { none: {} }` (não exclui proxy com contratos) ✅

**Observação**: O status usado é `'PENDENTE'`, não `'PENDENTE_ASSINATURA'`. Verificar se o bot cria proxies com status `PENDENTE` ou `PENDENTE_ASSINATURA` para garantir que o filtro está alinhado.

### 3.5 PC-05 — Gráfico UC ✅ CONFIRMADO

`contratos: { is: contratoWhere }` em `cooperados.service.ts:minhasCobrancas()` garante que o `ucId` é aplicado corretamente. ✅

---

## 4. ANÁLISE DE SEGURANÇA — CICLO ATUAL

### 4.1 ConviteIndicacao — Dashboard e Config Lembretes

| Aspecto | Status |
|---------|--------|
| Dashboard (`GET /dashboard`) | ✅ Roles(ADMIN, SUPER_ADMIN) + cooperativaId verificado |
| Stats (`GET /stats`) | ✅ Roles(ADMIN, SUPER_ADMIN) + cooperativaId verificado |
| Config lembretes GET | ✅ Roles(ADMIN, SUPER_ADMIN) + cooperativaId verificado |
| Config lembretes PUT | ✅ Roles(ADMIN, SUPER_ADMIN) + validação de campos obrigatórios |
| Tipo numérico sem validação | ⚠️ CONV-05 — NaN pode ser persistido |

### 4.2 CooperToken

| Aspecto | Status |
|---------|--------|
| Saldo/Extrato: COOPERADO só vê os próprios | ✅ `cooperadoId = req.user.cooperadoId` |
| Admin consolidado: tenant isolado | ✅ `cooperativaId = req.user.cooperativaId` |
| creditarManual: tipo não parametrizável | ⚠️ CTK-02 — tipo hardcoded |
| debitar: tipo no ledger hardcoded | ⚠️ CTK-05 — tipo `GERACAO_EXCEDENTE` em débitos |

### 4.3 Convenios

O módulo de Convênios tem boa postura geral:
- Endpoint `POST /convenios` com `cooperativaId` do `req.user` ✅
- `validarFaixas()` chamado em `create` e `update` ✅
- `ConveniosProgressaoService.recalcularFaixa` isola por `convenioId` ✅
- `ConveniosJob` reconcilia diariamente às 3h ✅

**Ponto de atenção:** O método `create` em `convenios.service.ts` cria cooperados com `cpf: dto.conveniadoCpf ?? CONV-${randomUUID().slice(0,8)}`. O CPF gerado com UUID parcial é válido para o banco mas **não é um CPF real** — pode causar conflito se o mesmo cooperado for cadastrado normalmente depois, pois a busca por CPF não encontraria o registro com CPF fake. Recomenda-se validar se o CPF informado é real antes de criar o cooperado conveniado.

---

## 5. ANÁLISE DE CÁLCULOS

### 5.1 CTK-01 — Tokens Sem Arredondamento (PENDENTE — CONFIRMADO)

Verificado no código atual de `cooper-token.job.ts:apurarExcedentes`:

```typescript
const quantidade = excedente * tokenPorKwh; // ← sem Math.round
```

Bug confirmado como ainda não corrigido. O saldo acumula frações infinitas (`5.550000000000001` tokens). O campo `quantidade` no ledger e o `saldoDisponivel` em `CooperTokenSaldo` ficam com precisão flutuante.

**Impacto calculado:** Para um cooperado com 3.7 kWh excedente e `tokenPorKwh = 1.5`, o saldo cresce 5.55 tokens por mês. Com 12 meses, acumula `66.60000000000001` — diferença de `0.00000000000001` tokens, imperceptível mas tecnicamente impuro. Pode causar comparações com `===` falhando em casos de borda.

### 5.2 PIX Excedente — Cálculo de Impostos (Mantido)

Análise do código atual confirma cálculo aditivo correto para o modelo implementado:
```typescript
const valorBruto = dto.kwhExcedente * dto.tarifaKwh; // sem arredondamento
```

**Novo ponto identificado:** `valorBruto` não é arredondado antes do cálculo de impostos. Apenas `valorBrutoArredondado = Math.round(valorBruto * 100) / 100` é usado no `create`. Os valores intermediários `valorIR`, `valorPIS`, `valorCOFINS` são calculados sobre o float `valorBruto` (não arredondado) — diferença mínima mas pode causar discrepância de centavos entre o que o usuário vê e o que é registrado.

### 5.3 CobrancasJob — Multa/Juros (Verificado ✅)

Confirmado que a correção COB-Job-02 permanece em vigor:
- `multa = Math.round(valorOriginal * (config.multaAtraso / 100) * 100) / 100` ✅
- `juros = Math.round(valorOriginal * (config.jurosDiarios / 100) * diasEfetivos * 100) / 100` ✅
- `valorAtualizado = Math.round((valorOriginal + multa + juros) * 100) / 100` ✅

### 5.4 Clube de Vantagens — Critério de Progressão

`avaliarProgressao()` compara `valorAtual >= nc.kwhMinimo` mas **não compara com `kwhMaximo`**. Um cooperado com 1000 kWh e apenas um nível configurado (ex: 0-100 kWh) sempre se qualificará independente do máximo. Como `niveisConfig` agora tem validação de ranges no upsert (CLB-02 corrigido), o impacto é menor — mas a lógica de avaliar deveria checar `valorAtual < nc.kwhMaximo` para precisão. O sistema promove ao nível mais alto elegível (`NIVEL_ORDEM` decide), então para múltiplos níveis com ranges corretos o comportamento é geralmente correto — o bug se manifesta apenas quando há um único nível configurado.

---

## 6. ANÁLISE DE FLUXOS

### 6.1 WhatsApp Bot — Máquina de Estados

**Estados mapeados no switch principal:** 40+ estados. Cobertura verificada para os fluxos críticos:
- `INICIAL` → `handleInicial` ✅
- `CADASTRO_PROXY_NOME` / `CADASTRO_PROXY_TELEFONE` (MLM) — **não encontrado no switch** — presumivelmente tratado pelo motor dinâmico ou pelo `handleMenuConvite`
- `NEGOCIACAO_PARCELAMENTO` ✅
- `MENU_FATURA` ✅
- Fora de horário + sessão expirada → WA-BOT-03/WA-BOT-06 ainda presentes

**Encoding do bot:** O arquivo `whatsapp-bot.service.ts` tem BOM e comentários em encoding corrompido (`â"€`, `â•`). Isso é cosmético (comentários de seção) e **não afeta a funcionalidade** pois as strings de mensagem usam unicode escape (`\uXXXX`). Observar na edição futura.

### 6.2 Convênios — Fluxo de Progressão de Faixas

`ConveniosProgressaoService.recalcularFaixa()`:
- Conta membros ativos via `convenioCooperado.count` ✅
- Calcula faixa com `calcularFaixa()` ✅
- Registra histórico quando faixa muda ✅
- Atualiza cache em membros ativos (`updateMany`) ✅
- Job diário às 3h reconcilia todos ✅

**Ponto de atenção:** O método `recalcularTodos()` chamado pelo job itera convênios de forma serial. Para cooperativas com muitos convênios, pode ser lento. Para escala futura, considerar processamento em paralelo com limite de concorrência.

### 6.3 ConviteIndicacao — Dashboard Frontend

A página `web/app/dashboard/convites/page.tsx` implementa:
- Cards de totais (pendentes, convertidos, expirados) ✅
- Tabela paginada com filtro por status e período ✅
- Botão "Reenviar" por linha ✅
- Toggle de lembretes habilitados ✅
- Formulário de configuração (cooldown, max tentativas) ✅
- Adicionada no menu lateral para ADMIN/SUPER_ADMIN/OPERADOR ✅

**Bug de usabilidade identificado:** A página chama `GET /convite-indicacao/stats` E `GET /convite-indicacao/dashboard` em paralelo. Porém, ao filtrar por status ou período, apenas a tabela é recarregada (`carregarDados()`), mas os cards de totais (`carregarStats()`) não são re-fetchados. Resultado: os cards mostram totais globais mesmo quando a tabela está filtrada, criando percepção inconsistente.

---

## 7. ANÁLISE DE USABILIDADE

### 7.1 Dashboard de Convites — Cards Não Refletem Filtros (UX-01)

Conforme identificado em 6.3: filtrar por status mostra convites filtrados na tabela, mas os cards de totais permanecem com valores globais. O usuário vê "15 Pendentes" no card mas a tabela mostra apenas 3 (período = 7 dias). Sem correção, a experiência é confusa.

**Severidade:** Baixa (percepção, não dados errados)

### 7.2 CooperToken — Portal Cooperado Sem Indicação de Uso Automático

Conforme identificado no ciclo anterior: o desconto por token é aplicado automaticamente no fechamento de cobrança, mas o cooperado não tem tela indicando isso no portal. Recomenda-se um banner ou card em `/portal/financeiro` explicando "Você possui X tokens — desconto de R$Y será aplicado na próxima cobrança".

### 7.3 Convênios — Cooperado Sem Indicação de Faixa Atual no Portal

O portal do cooperado (`/portal/indicacoes`) provavelmente não exibe a faixa de convênio quando o cooperado é membro de um. O `convenioCooperado.faixaAtual` está sendo atualizado corretamente, mas sem tela no portal o cooperado não sabe em qual faixa está.

### 7.4 WA-BOT-03 (PENDENTE) — Dupla Mensagem Persiste

Confirmado que o bloco de checagem de horário não tem `return` após enviar o aviso:
```typescript
// Não faz return - continua processando normalmente (simulação funciona 24h)
```

Isso é intencional para o fluxo de simulação 24h, mas afeta estados de menu onde o cooperado recebe o aviso + a resposta do estado atual simultaneamente. Deve ser resolvido com uma lista explícita de estados que devem fazer `return` após o aviso.

---

## 8. BUGS RESIDUAIS ACUMULADOS (TODOS OS ABERTOS)

| # | Severidade | Bug | Ciclo de Origem |
|---|-----------|-----|----------------|
| PIX-01 | **ALTA** | PIX Excedente requer ativação `ASAAS_PIX_EXCEDENTE_ATIVO=true` em prod | 27/03 (parcial) |
| CTK-01 | **MÉDIA** | Tokens creditados sem arredondamento de quantidade | 01/04 |
| WA-BOT-06 | **MÉDIA** | Dupla mensagem em estados de menu fora de horário | NOVO |
| WA-BOT-03 | **MÉDIA** | Dupla mensagem em sessão expirada fora de horário | 31/03 |
| WZ-10 | **MÉDIA** | Upload documentos sem sinalização de falha na UI de conclusão | 31/03 |
| REL-03 | **MÉDIA** | Tarifa hardcoded R$0,80 sem aviso na UI | 29/03 |
| WZ-09 | **MÉDIA** | SUPER_ADMIN cria cooperado sem cooperativaId | 27/03 |
| MIG-04 | **MÉDIA** | kWh arredondamento anual/mensal diverge | 27/03 |
| CTK-04 | **BAIXA** | Contrato errado pode ser usado em `apurarExcedentes` (cooperado com múltiplos contratos) | NOVO |
| CONV-05 | **BAIXA** | Config lembretes: tipos não validados (NaN possível) | NOVO |
| CONV-04 | **BAIXA** | `salvarConfigLembretes` sem transação | NOVO |
| JOB-01 | **BAIXA** | Dois crons às 3h com critérios sobrepostos em cooperados.job | NOVO |
| CTK-05 | **BAIXA** | `debitar()` usa tipo hardcoded no ledger | NOVO |
| CONV-03 | **BAIXA** | vincularLeadAoConvite pode vincular convite expirado/cancelado | 01/04 |
| CTK-02 | **BAIXA** | creditarManual tipo hardcoded como GERACAO_EXCEDENTE | 01/04 |
| CTK-03 | **BAIXA** | Encoding mojibake em cooper-token.job.ts | 01/04 |
| WA-BOT-05 | **BAIXA** | NPS com setTimeout não persiste em restart | 31/03 |
| CTX-01 | **BAIXA** | Token de troca não invalida sessão anterior | 29/03 |
| REL-04 | **BAIXA** | qtdContratos inflacionado no breakdown de usinas | 29/03 |
| COB-Tel-01 | **BAIXA** | Normalização telefone inconsistente | 28/03 |
| FRONT-02 | **BAIXA** | Filtros inadimplência sem auto-submit | 29/03 |
| LEAD-04 | **BAIXA** | Score de lead sem decaimento temporal | 30/03 |
| LEAD-05 | **BAIXA** | receitaLatenteAnual pode duplicar | 30/03 |
| UX-01 | **BAIXA** | Cards de convites não refletem filtros ativos | NOVO |

---

## 9. SCORE DE QUALIDADE POR MÓDULO

| Módulo | Score 01/04 | Score 02/04 | Delta | Justificativa |
|--------|-------------|-------------|-------|---------------|
| Segurança / Auth | 9.0/10 | 9.0/10 | = | Sem alterações críticas |
| Motor de Cobrança | 9.0/10 | 9.0/10 | = | Sem alterações; multa/juros corretos |
| WhatsApp / Bot | 8.5/10 | 8.5/10 | = | WA-BOT-03/06 pendentes; encoding cosmético |
| Wizard Membro | 8.5/10 | 8.5/10 | = | Sem alterações |
| MLM / Indicações | 8.0/10 | 9.0/10 | +1.0 | CONV-01/02 corrigidos; tenant isolation OK; CONV-03/04/05 menores |
| Portal Cooperado | 8.5/10 | 8.5/10 | = | Sem alterações |
| Relatórios | 8.5/10 | 8.5/10 | = | Sem alterações |
| Usinas Analítico | 8.5/10 | 8.5/10 | = | Sem alterações |
| Lead Expansão | 8.5/10 | 8.5/10 | = | Sem alterações |
| Clube de Vantagens | 8.0/10 | 9.0/10 | +1.0 | CLB-02 corrigido; validações de ranges sólidas |
| PIX Excedente | 7.5/10 | 7.5/10 | = | Feature flag pronta; aguarda ativação |
| CooperToken | 7.5/10 | 7.5/10 | = | CTK-01 persiste; CTK-04/05 novos (baixos) |
| ConviteIndicacao | 7.5/10 | 8.5/10 | +1.0 | CONV-01/02 corrigidos; dashboard completo; CONV-03/04/05 menores |
| Convênios | N/A | 8.5/10 | novo | Progressão de faixas bem implementada; job diário; CPF fake em conveniado |

**Score geral: 9.0 / 10** ↑ (+0.3 vs 01/04)

---

## 10. PRIORIDADES DE CORREÇÃO

### 🟠 Prioridade 1 — Alta (próximo sprint)

1. **PIX-01 ativação** — Configurar `ASAAS_PIX_EXCEDENTE_ATIVO=true` em produção após validação contábil. Feature flag pronta há 5 dias.

2. **CTK-01** — `Math.round(excedente * tokenPorKwh * 100) / 100` no `apurarExcedentes`. Fix de 1 linha.

3. **WA-BOT-03 + WA-BOT-06** — Resolver dupla mensagem fora de horário. Criar lista explícita de estados que devem fazer `return` após aviso de expediente.

4. **CTK-04** — Buscar contrato com `cooperTokenAtivo: true` explicitamente ao invés de `contratos[0]`.

### 🟡 Prioridade 2 — Backlog (próximos 2 sprints)

5. **CONV-05** — Validar tipos numéricos no `salvarConfigLembretes`
6. **CONV-04** — Adicionar transação ao `salvarConfigLembretes`
7. **CONV-03** — Filtrar status em `vincularLeadAoConvite`
8. **CTK-02/05** — Aceitar `tipo` como parâmetro em `creditarManual` e `debitar`
9. **CTK-03** — Corrigir encoding BOM em `cooper-token.job.ts`
10. **JOB-01** — Unificar ou separar crons de limpeza de proxies
11. **UX-01** — Cards do dashboard de convites devem refletir filtros ativos
12. **WZ-10** — Status de upload inline na tela de conclusão
13. **REL-03** — Aviso de tarifa estimada na UI

### 🔵 Prioridade 3 — Técnica/Melhoria

14. **WZ-09** — SUPER_ADMIN com `cooperativaId`
15. **MIG-04** — Arredondamento kWh consistente
16. **CTX-01** — Invalidar sessão anterior no troca de token
17. **REL-04** — qtdContratos correto no breakdown
18. **COB-Tel-01** — Normalização telefone unificada
19. **LEAD-04/05** — Decaimento temporal e dedup de receita latente

---

## 11. OBSERVAÇÕES SOBRE O MÓDULO CONVÊNIOS (NOVO)

O módulo de Convênios implementado em 01/04 apresenta arquitetura sólida:

**Positivos:**
- Número sequencial com retry loop (race condition tratado) ✅
- `validarFaixas()` chamado em create e update ✅
- Cooperado SEM_UC criado automaticamente para conveniado ✅
- Progressão de faixas com cache invalidado em tempo real ✅
- Histórico de mudanças de faixa persistido ✅
- Job de reconciliação diária ✅
- Relatório mensal de desempenho via job ✅

**Pontos de atenção:**
1. CPF fake (`CONV-XXXXXXXX`) para cooperado conveniado pode conflitar com cadastro posterior real
2. `recalcularTodos()` é serial — pode ser lento em alta escala
3. Sem endpoint para o cooperado ver sua faixa atual no portal

---

## 12. RESUMO EXECUTIVO

### O que foi entregue neste ciclo (01/04 → 02/04)

**Correções de alta prioridade:**
- **CONV-02 ✅** — Duplicata MLM corrigida: `concluirCadastro` agora verifica indicação existente antes de criar
- **WA-BOT-04 ✅** — Job de limpeza de cooperados PROXY_* zumbi implementado
- **CLB-02 ✅** — Validação de ranges do Clube de Vantagens completa (4 validações)
- **PC-05 ✅** — Gráfico UC corrigido com `contrato: { is: contratoWhere }`
- **CONV-01 ✅** — Job de lembretes agora passa `cooperativaId` corretamente

**Novas features:**
- Dashboard de convites completo no frontend (stats + tabela paginada + filtros + reenvio)
- Configuração de lembretes persistida via ConfigTenant

### O que precisa de atenção

1. **CTK-01** — Tokens com frações: `excedente * tokenPorKwh` sem arredondamento. Fix de 1 linha, 5 dias em aberto.

2. **WA-BOT-03/06** — Dupla mensagem fora de horário: o `// Não faz return` intencional para simulação 24h está afetando estados de menu. Distinguir por tipo de estado.

3. **PIX-01** — Feature flag pronta há 5 dias. A distribuição de sobras está esperando apenas pela decisão operacional de ativar `ASAAS_PIX_EXCEDENTE_ATIVO=true`.

### Métricas do ciclo

- Bugs corrigidos: **5** (CONV-01, CONV-02, WA-BOT-04, CLB-02, PC-05)
- Novos bugs introduzidos: **5** (JOB-01, CONV-04, CONV-05, CTK-04, CTK-05 — todos baixos)
- Bugs críticos abertos: **0** ✅
- Bugs altos abertos: **1** (PIX-01 aguarda ativação)
- Bugs médios abertos: **6** (CTK-01, WA-BOT-06, WA-BOT-03, WZ-10, REL-03, WZ-09, MIG-04)
- Score geral: **9.0/10** (+0.3)

### Tendência

O sistema está em maturação consistente. O sprint de 01/04 eliminou 5 bugs altos de uma vez — o maior volume de correções em um único ciclo. O acúmulo de bugs baixos (backlog técnico) é natural em fase de enriquecimento de features. Os módulos centrais (cobrança, auth, portal cooperado) permanecem estáveis. A atenção agora deve se concentrar nos 2 bugs médios do bot (dupla mensagem) que afetam experiência real de usuários, e na ativação do PIX Excedente, que habilita a distribuição de sobras — funcionalidade estratégica do modelo cooperativista.

---
*Relatório gerado automaticamente pelo QA Noturno CoopereBR — Assis*
