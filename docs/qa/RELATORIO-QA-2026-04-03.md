# Relatório QA — CoopereBR
**Data:** 2026-04-03
**Horário:** 03:00 (America/Sao_Paulo)
**Período analisado:** commits de 02/04/2026 (03h) a 03/04/2026 (03h)
**Módulos revisados:** Central de Faturas (OCR + análise + cobrança automática), Módulo Financeiro (contas/despesas/fluxo), SaaS Multi-tenant (planos + feature flags), Convênios Global/Standalone + Conversão Créditos SEM_UC, Agregadores (painel + admin), fixes de UX (sidebar, notificações, cooperado branco)
**Score geral de qualidade: 8.5 / 10** ↓ (-0.5 vs relatório anterior)

> **Nota:** O score recuou levemente porque este ciclo trouxe dois módulos inteiros novos de alta complexidade (Central de Faturas e Gestão Financeira) em um único dia, introduzindo bugs de segurança (IDOR em upload de fatura e ConfigTenant sem tenant isolation) que precisam de atenção antes de ir para produção.

---

## 1. STATUS DOS ITENS CRÍTICOS DO RELATÓRIO ANTERIOR (2026-04-02)

| ID | Descrição | Status 02/04 | Status 03/04 | Observação |
|----|-----------|--------------|--------------|------------|
| PIX-01 | PIX Excedente aguarda ativação da feature flag | **ALTA** | ⏳ **PENDENTE** | Sem alterações |
| CTK-01 | Tokens creditados sem arredondamento | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| WA-BOT-06 | Dupla mensagem em estados de menu fora de horário | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| WA-BOT-03 | Dupla mensagem em sessão expirada fora de horário | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| WZ-10 | Upload documentos sem sinalização de falha na UI | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| REL-03 | Tarifa hardcoded R$0,80 / `PERCENTUAL_DESCONTO = 0.15` sem aviso | **MÉDIA** | ⏳ **PENDENTE** | Confirmado em `FaturaUploadOCR.tsx` linha 93 |
| WZ-09 | SUPER_ADMIN cria cooperado sem cooperativaId | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| MIG-04 | kWh arredondamento anual/mensal diverge | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| JOB-01 | Dois crons às 3h com critérios sobrepostos | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| CONV-04 | `salvarConfigLembretes` sem transação | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| CONV-05 | Config lembretes: tipos não validados (NaN possível) | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| CONV-03 | vincularLeadAoConvite pode vincular convite expirado | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| CTK-02 | creditarManual tipo hardcoded | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| CTK-03 | Encoding mojibake em cooper-token.job.ts | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| CTK-04 | Contrato errado em `apurarExcedentes` com múltiplos contratos | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| CTK-05 | `debitar()` usa tipo hardcoded no ledger | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| WA-BOT-05 | NPS com setTimeout não persiste em restart | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| CTX-01 | Token de troca não invalida sessão anterior | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| REL-04 | qtdContratos inflacionado no breakdown de usinas | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| COB-Tel-01 | Normalização telefone inconsistente | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| FRONT-02 | Filtros inadimplência sem auto-submit | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| LEAD-04 | Score de lead sem decaimento temporal | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| LEAD-05 | receitaLatenteAnual pode duplicar | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| UX-01 | Cards de convites não refletem filtros ativos | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |

**Resumo:** 0 itens resolvidos neste ciclo. O sprint foi inteiramente dedicado a novas features. O acúmulo de bugs médios/baixos está crescendo — recomenda-se dedicar o próximo sprint a resolução de débitos técnicos.

---

## 2. NOVOS BUGS ENCONTRADOS — CICLO 02/04 → 03/04

### 2.1 FATURA-01 — IDOR: `uploadConcessionaria` não valida cooperadoId do usuário autenticado

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| FATURA-01 | **ALTA** | `POST /faturas/upload-concessionaria` herda `@Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)` da classe mas não valida que `dto.cooperadoId === req.user.cooperadoId` para cooperados. Um cooperado autenticado pode enviar qualquer `cooperadoId` no body e processar/fazer upload de fatura em nome de outro cooperado. A cobrança seria gerada vinculada ao cooperado vítima. | `faturas.controller.ts:uploadConcessionaria`, `faturas.service.ts:uploadConcessionaria` |

**Correção:**
```typescript
@Post('upload-concessionaria')
uploadConcessionaria(@Body() dto: UploadConcessionariaDto, @Req() req: any): Promise<unknown> {
  // Cooperados só podem enviar para si mesmos
  if (req.user.perfil === PerfilUsuario.COOPERADO) {
    const cooperadoId = req.user.cooperadoId;
    if (!cooperadoId || cooperadoId !== dto.cooperadoId) {
      throw new ForbiddenException('Você só pode enviar faturas para sua própria conta');
    }
  }
  return this.faturasService.uploadConcessionaria(dto);
}
```

---

### 2.2 FATURA-02 — Multi-tenancy: ConfigTenant buscado sem `cooperativaId`

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| FATURA-02 | **ALTA** | Dois pontos em `faturas.service.ts` buscam `ConfigTenant` com `findUnique({ where: { chave: 'threshold_meses_atipicos' } })` sem especificar `cooperativaId`. O `ConfigTenant` é uma tabela multi-tenant com índice `(chave, cooperativaId)`. A query `findUnique` com apenas `chave` vai usar o campo único de chave se existir um índice único só por `chave`, ou pode retornar qualquer registro. Em produção com múltiplos parceiros, o threshold de um parceiro pode ser aplicado ao cálculo de média de outro parceiro. O mesmo problema existe para `'dias_vencimento_cobranca'` e `'modelo_cobranca_padrao'`. | `faturas.service.ts:processarFatura`, `faturas.service.ts:uploadConcessionaria` |

**Impacto:** Se PARCEIRO_A tem threshold=30% e PARCEIRO_B não configurou (default=50%), ao processar fatura do B, a query pode retornar a config do A, descartando meses corretos. A média de kWh calculada fica incorreta → contrato e cobrança baseados em dados errados.

**Correção:**
```typescript
// Passar cooperativaId do cooperado ao buscar config
const cooperado = await this.prisma.cooperado.findUnique({
  where: { id: dto.cooperadoId },
  select: { cooperativaId: true },
});
const configThreshold = await this.prisma.configTenant.findFirst({
  where: { chave: 'threshold_meses_atipicos', cooperativaId: cooperado?.cooperativaId },
});
```

---

### 2.3 FATURA-03 — Central de Faturas: falta isolamento de tenant no endpoint `/central`

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| FATURA-03 | **ALTA** | `GET /faturas/central` aceita `cooperativaId` como query param mas não valida que o usuário autenticado tem acesso a essa cooperativa. Um usuário `ADMIN` com `cooperativaId=parceiro-A` pode passar `cooperativaId=parceiro-B` na query e ver as faturas de outro parceiro. O serviço aplica `where.cooperativaId = query.cooperativaId` sem verificação de ownership. | `faturas.controller.ts:central`, `faturas.service.ts:centralFaturas` |

**Correção:**
```typescript
@Get('central')
@Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
central(@Query(...) ..., @Req() req: any) {
  // ADMIN/OPERADOR só veem a própria cooperativa
  let cooperativaId = cooperativaIdParam;
  if (req.user.perfil !== PerfilUsuario.SUPER_ADMIN) {
    cooperativaId = req.user.cooperativaId;
  }
  return this.faturasService.centralFaturas({ cooperativaId, ... });
}
```

---

### 2.4 CONV-SEM-UC-01 — `ConversaoCreditoService`: tarifa usa `descontoPadrao` (percentual) em vez de tarifa R$/kWh

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| CONV-SEM-UC-01 | **ALTA** | `conversao-credito.service.ts:solicitar()` usa `config.descontoPadrao` como tarifa para calcular `valorReais = kwhDesejado * tarifa`. `descontoPadrao` é o **percentual de desconto** do cooperado (ex: 20 = 20%), não o preço do kWh em R$. Se `descontoPadrao = 20` (%), um cooperado que solicita 100 kWh receberia `R$ 2.000` (100 × 20), o que é absurdo. Ou pior: se for tratado como decimal `0.20`, receberia `R$ 20` por 100 kWh quando a tarifa real é `R$ 0,80/kWh` = `R$ 80`. O campo correto a usar seria a tarifa vigente da concessionária ou um campo específico de conversão. | `conversao-credito.service.ts:solicitar` |

**Impacto financeiro direto.** O `valorReais` gerado estará incorreto para qualquer cooperado conveniado SEM_UC.

**Correção sugerida:** Usar `tarifaConcessionaria.findFirst()` para pegar `tusdNova + teNova` como tarifa base, ou criar campo `tarifaConversaoKwh` em `ConfiguracaoCobranca`.

---

### 2.5 SAAS-01 — SaaS: `gerarFaturasMensal` pode crashar com `diaVencimentoSaas = null`

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| SAAS-01 | **MÉDIA** | `saas.service.ts:gerarFaturasMensal()`: `const diaVenc = coop.diaVencimentoSaas;` seguido de `new Date(hoje.getFullYear(), hoje.getMonth(), diaVenc)`. Se `diaVencimentoSaas` for `null` (campo não obrigatório no schema?), `new Date(ano, mes, null)` produz `null` interpretado como `0`, gerando `new Date(ano, mes, 0)` que é o último dia do mês anterior. Fatura SaaS seria gerada com data de vencimento errada (mês anterior). Sem verificação de `if (!diaVenc)` antes do `create`. | `saas.service.ts:gerarFaturasMensal` |

**Correção:**
```typescript
const diaVenc = coop.diaVencimentoSaas ?? 10; // Fallback para dia 10
const dataVencimento = new Date(hoje.getFullYear(), hoje.getMonth(), diaVenc);
```

---

### 2.6 NOTIF-01 — Notificações: `marcarComoLida` sem verificação de ownership

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| NOTIF-01 | **MÉDIA** | `PATCH /notificacoes/:id/ler` chama `notificacoes.marcarComoLida(id)` sem verificar que a notificação pertence ao usuário autenticado. Qualquer usuário autenticado (incluindo COOPERADO) que adivinhar um UUID de notificação pode marcá-la como lida. Embora o impacto seja baixo (notificações não são dados sensíveis), isso viola o princípio de menor privilégio e pode ser usada para interferir na UX de outros usuários (apagar alertas de inadimplência de terceiros). | `notificacoes.controller.ts:marcarComoLida`, `notificacoes.service.ts:marcarComoLida` |

---

### 2.7 FATURA-04 — Auto-aprovação: threshold 5% hardcoded sem ConfigTenant

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| FATURA-04 | **MÉDIA** | `uploadConcessionaria()` usa threshold de divergência hardcoded de 5%: `const statusRevisao = divergenciaPerc < 5 ? 'AUTO_APROVADO' : 'PENDENTE_REVISAO'`. Cada parceiro pode ter tolerância diferente (parceiros com usinas mais antigas têm maior variação natural de geração). Não há `ConfigTenant` para controlar esse threshold. Uma fatura com 4.9% de divergência é auto-aprovada para TODOS os parceiros independente de contexto. | `faturas.service.ts:uploadConcessionaria` |

---

### 2.8 FATURA-05 — `aprovarFatura`: parse de mesReferencia inconsistente entre dois fluxos

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| FATURA-05 | **MÉDIA** | `aprovarFatura()` tem dois caminhos divergentes para parsing de `mesReferencia`: **Fluxo novo** (`fatura.mesReferencia && !fatura.cobrancaGeradaId`): chama `gerarCobrancaPosFatura` que lida com `AAAA-MM` e `MM/AAAA`. **Fluxo legado** (else): usa `const [mesStr, anoStr] = mesRef.split('/')` esperando formato `MM/AAAA`. Se `dadosExtraidos.mesReferencia` tiver sido salvo pelo Claude no formato `MM/AAAA` mas `fatura.mesReferencia` (campo direto) estiver em `AAAA-MM` (enviado pelo frontend no `upload-concessionaria`), o fluxo legado falha com `mesReferencia = NaN`. O `create` de cobrança com `mesReferencia: NaN` pode ser aceito pelo Prisma como `null` ou quebrar silenciosamente. | `faturas.service.ts:aprovarFatura` |

---

### 2.9 CENTRAL-01 — Central de Faturas: cooperados SEM_UC contados em "semFatura"

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| CENTRAL-01 | **BAIXA** | `centralFaturas` calcula `semFatura = totalCooperados - comFatura`. O `totalCooperados` inclui cooperados com `tipoCooperado = 'SEM_UC'` (esses não têm UC e portanto nunca enviam fatura da concessionária). O card "X cooperados sem fatura" na Central mostrará sempre um número inflado pela quantidade de cooperados conveniados SEM_UC. | `faturas.service.ts:centralFaturas` |

**Correção:**
```typescript
const totalCooperados = await this.prisma.cooperado.count({
  where: cooperativaId
    ? { cooperativaId, status: { in: ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'] }, tipoCooperado: { not: 'SEM_UC' } }
    : { status: { in: ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'] }, tipoCooperado: { not: 'SEM_UC' } },
});
```

---

### 2.10 SAAS-02 — ModuloGuard requer decorator manual em cada endpoint (falha de design)

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| SAAS-02 | **BAIXA** | `ModuloGuard` só é ativado quando o endpoint tem `@RequireModulo('nomeModulo')`. Não há mecanismo para garantir que todos os endpoints de um módulo premium tenham o decorator. Se um developer criar um endpoint em um módulo premium e esquecer o decorator, o endpoint fica acessível a qualquer parceiro independente do plano SaaS. Não há teste automatizado para verificar cobertura. | `modulo.guard.ts`, `require-modulo.decorator.ts` |

**Recomendação:** Criar um teste de integração que mapeia todos os controllers de módulos premium e verifica a presença de `@RequireModulo`. Ou aplicar o guard no nível de módulo via `APP_GUARD` com lista de prefixos protegidos.

---

### 2.11 FINANCEIRO-01 — Módulo Financeiro sem backend: páginas fazem requisições a endpoints inexistentes

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| FINANCEIRO-01 | **MÉDIA** | As novas páginas de gestão financeira (`/dashboard/financeiro/contas-receber`, `/contas-pagar`, `/despesas`, `/fluxo-caixa`) fazem chamadas a endpoints como `GET /financeiro/contas-receber`, `POST /financeiro/contas-pagar`, `GET /financeiro/livro-caixa` etc. Verificando o backend, o módulo `financeiro` existente (`backend/src/financeiro/`) contém apenas `convenios.service.ts` relacionado ao modelo financeiro de convênios — **não há controller de contas a pagar/receber**. As páginas falharão silenciosamente (as chamadas usam `.catch(() => {})` ou `.catch(() => setDados(null))`), exibindo tabelas vazias sem aviso ao usuário. | `web/app/dashboard/financeiro/contas-receber/page.tsx`, etc. |

**Impacto:** Módulo Financeiro está no menu mas completamente não-funcional. O usuário verá telas vazias sem indicação de erro. Precisa de backend correspondente.

---

## 3. ANÁLISE DE SEGURANÇA — CICLO ATUAL

### 3.1 Central de Faturas — Novos riscos

| Aspecto | Status |
|---------|--------|
| `upload-concessionaria`: IDOR por cooperadoId | ⛔ **FATURA-01** — Crítico |
| `central`: sem tenant isolation no param cooperativaId | ⛔ **FATURA-03** — Crítico |
| ConfigTenant sem cooperativaId na busca | ⛔ **FATURA-02** — Crítico |
| Auto-aprovação: cobrança gerada sem revisão humana | ⚠️ Por design, mas threshold hardcoded — FATURA-04 |
| `rejeitar/aprovar`: roles corretas (SUPER_ADMIN, ADMIN, OPERADOR) | ✅ |
| `cooperado/:cooperadoId`: sem verificação owner | ⚠️ Verificar se cooperadoId não é exposto a outros cooperados |

### 3.2 SaaS Multi-tenant

| Aspecto | Status |
|---------|--------|
| `vincularPlano`: apenas SUPER_ADMIN | ✅ |
| `createPlano/updatePlano/deletePlano`: apenas SUPER_ADMIN | ✅ |
| `propagarModulosDoPlano`: não executa cross-tenant | ✅ (apenas cooperativas vinculadas ao plano) |
| `ModuloGuard`: sem cobertura automática de endpoints | ⚠️ SAAS-02 |

### 3.3 Conversão de Créditos SEM_UC

| Aspecto | Status |
|---------|--------|
| `solicitar`: verifica tipoCooperado === SEM_UC | ✅ |
| `aprovar`: verifica cooperativaId da solicitação | ✅ |
| Cálculo de valor: usa campo errado (descontoPadrao) | ⛔ **CONV-SEM-UC-01** |

### 3.4 Agregadores

| Aspecto | Status |
|---------|--------|
| `criarUsuarioAgregador`: verifica que administradoraId pertence à cooperativa do admin | ✅ |
| `PerfilUsuario.AGREGADOR` isolado por `administradoraId` no JWT | ✅ |
| Painel do agregador (`/agregador`): filtra por `administradoraId` | Verificar |

---

## 4. ANÁLISE DE CÁLCULOS

### 4.1 Geração de Cobrança via Fatura da Concessionária

O fluxo `gerarCobrancaPosFatura` e o fluxo legado em `aprovarFatura` calculam cobrança usando:

```
valorBruto = Math.round(kwhCobranca × tarifaKwh × 100) / 100  ✅
valorDesconto = Math.round(kwhCobranca × tarifaKwh × descontoDecimal × 100) / 100  ✅
valorLiquido = Math.round(kwhCobranca × tarifaKwh × (1 - descontoDecimal) × 100) / 100  ✅
```

Cálculo matematicamente correto com arredondamento. **Ponto de atenção:** `valorBruto - valorDesconto` pode diferir de `valorLiquido` por 1 centavo em casos de borda (ex: kWh=100.5, tarifa=0.8024, desconto=0.15). Isso ocorre quando cada multiplicação separada gera arredondamentos diferentes. Para operações financeiras, recomenda-se calcular `valorLiquido = valorBruto - valorDesconto` em vez de recalcular.

### 4.2 Conversão SEM_UC — Cálculo Incorreto (CONV-SEM-UC-01 confirmado)

```typescript
const tarifa = config ? Number(config.descontoPadrao) : 0;
// Se descontoPadrao = 20 (20%), tarifa = 20
const valorReais = new Decimal(dto.kwhDesejado).mul(tarifa).toDecimalPlaces(2);
// 100 kWh × 20 = R$ 2.000 ???
```

Exemplo concreto: Cooperado solicita 50 kWh. `descontoPadrao = 20` → `valorReais = 50 × 20 = R$ 1.000`. Se o campo é o percentual decimal (`0.20`), então `50 × 0.20 = R$ 10`. Em ambos os casos, está errado. A tarifa deveria ser o preço de venda do kWh ao cooperado.

### 4.3 SaaS — Cálculo de `valorReceita` 

```typescript
valorReceita = receitaTotal * (Number(coop.planoSaas.percentualReceita) / 100)
```

Correto. `percentualReceita = 5` → `5/100 = 0.05`. Mas `valorTotal = valorBase + valorReceita` não tem arredondamento. Pode resultar em fatura SaaS com `R$ 1.523.457890123`. Recomenda-se `Math.round(valorTotal * 100) / 100`.

### 4.4 CTK-01 — Tokens Sem Arredondamento (PENDENTE — 5º ciclo consecutivo)

```typescript
const quantidade = excedente * tokenPorKwh; // ainda sem Math.round
```

Confirmado como ainda não corrigido. **5 relatórios consecutivos** desde 30/03 apontando este bug.

---

## 5. ANÁLISE DE FLUXOS

### 5.1 Fluxo Central de Faturas

**Fluxo happy path:**
1. Admin faz upload de fatura da concessionária via `FaturaUploadOCR` ✅
2. Claude API extrai dados (OCR) ✅
3. Sistema calcula divergência entre kWh contratado e kWh compensado ✅
4. Se divergência < 5%: AUTO_APROVADO + gera cobrança automaticamente ✅
5. Email + WhatsApp enviados ao cooperado ✅

**Problemas identificados no fluxo:**
- **Upload pela URL errada:** O componente `FaturaUploadOCR` chama `POST /faturas/processar` no fluxo original (wizard), mas a nova feature de concessionária usa `POST /faturas/upload-concessionaria`. O componente foi atualizado para chamar a rota correta — verificado no commit `fix: upload concessionaria correto`. ✅ corrigido.
- **Falta de feedback pós-upload no wizard:** WZ-10 continua pendente. O upload de documentos de identificação ainda não mostra status inline no wizard.

### 5.2 WhatsApp Bot — Sem mudanças no ciclo

Bot não foi modificado neste ciclo. Bugs WA-BOT-03 e WA-BOT-06 (dupla mensagem) permanecem abertos.

### 5.3 Convênios — Expansão Global/Standalone

**Novos fluxos adicionados:**
- `modalidade: GLOBAL` — convênio criado pelo SISGD, disponível para todos os parceiros ✅
- `modalidade: STANDALONE` — convênio de parceiro individual ✅
- `tierMinimoClube` por convênio — valida que membro tem faixa mínima no Clube de Vantagens antes de entrar no convênio ✅

**Ponto de atenção:** O endpoint `POST /convenios/:id/membros` verifica `tierMinimoClube` mas usa `clubeVantagensService.getConfigByCooperativa`. Se o convênio for GLOBAL (SISGD), o `cooperativaId` do convênio pode ser diferente do cooperativaId do membro sendo adicionado. A lógica de tier mínimo pode checar o nível do membro na cooperativa do convênio (SISGD) em vez da cooperativa do membro. Verificar.

### 5.4 Portal Cooperado — Nova Aba Financeiro

A aba `financeiro` no `/portal/financeiro` foi expandida com 4 sub-abas: Cobranças, Créditos, Faturas, Benefícios. Funcionalmente correto. 

**Bug de usabilidade identificado:** O upload self-service de fatura pela aba `Faturas Concessionária` usa `POST /faturas/upload-concessionaria` passando `cooperadoId` do estado local. Se o cooperado fechar a aba e reabrir antes da resposta, o `cooperadoId` no estado pode estar vazio (state reset), causando erro `422` ao enviar. Adicionar validação antes de `enviarFatura()`:
```typescript
if (!cooperadoId) { setUploadMsg('Aguarde, carregando perfil...'); return; }
```

---

## 6. ANÁLISE DE USABILIDADE

### 6.1 Módulo Financeiro — Telas Sem Dados (FINANCEIRO-01)

As 4 novas telas do módulo financeiro (`contas-receber`, `contas-pagar`, `despesas`, `fluxo-caixa`) ficam completamente vazias porque o backend ainda não tem os endpoints correspondentes. Não há indicativo visual de que os dados ainda não estão disponíveis — a tela apenas exibe tabelas/cards vazios. Usuários podem achar que a cooperativa não tem dados financeiros.

**Recomendação de UX:** Adicionar banner `"Módulo em construção — disponível em breve"` enquanto os endpoints não existirem. Ou remover essas páginas do menu até o backend estar pronto.

### 6.2 Central de Faturas — Ordenação por Status Alfabética (não semântica)

`orderBy: [{ statusRevisao: 'asc' }]` ordena alfabeticamente: `AUTO_APROVADO` → `APROVADO` → `PENDENTE_REVISAO` → `REJEITADO`. Semanticamente, a ordem ideal seria mostrar `PENDENTE_REVISAO` primeiro (mais urgente). A ordenação atual coloca os itens que precisam de ação humana no final da lista.

**Correção simples:**
```typescript
// Adicionar campo de prioridade virtual ou usar CASE-WHEN via raw query
// Ou: buscar PENDENTE_REVISAO primeiro separadamente
orderBy: [
  // Workaround: orderBy campo boolean de isPendente desc + createdAt desc
]
```

### 6.3 FaturaUploadOCR — Percentual de Desconto Hardcoded na Preview (REL-03)

Confirmado: `const PERCENTUAL_DESCONTO = 0.15` em `FaturaUploadOCR.tsx`. Este valor é mostrado na tela de preview da fatura ao usuário como estimativa de desconto. Continua incorreto para cooperados com percentuais diferentes.

### 6.4 Agregador — Painel Mínimo

O painel do agregador (`/agregador`) exibe apenas dashboard básico e lista de membros. Sem funcionalidades de gestão. É um MVP adequado para início, mas falta:
- Filtro de membros por status
- Exportação de dados
- Histórico de cobranças dos membros

### 6.5 Seleção de Contexto — Experiência Melhorada

O novo `ContextoSwitcher` e a página `/selecionar-contexto` melhoram significativamente a experiência para usuários multi-papel (cooperado + admin_parceiro + proprietário_usina). A lógica de `useContexto` com localStorage e auto-seleção quando há 1 contexto está bem implementada. ✅

---

## 7. BUGS RESIDUAIS ACUMULADOS (TODOS OS ABERTOS)

| # | Severidade | Bug | Ciclo de Origem |
|---|-----------|-----|----------------|
| FATURA-01 | **ALTA** | IDOR: uploadConcessionaria sem validação de owner | NOVO |
| FATURA-02 | **ALTA** | ConfigTenant sem cooperativaId na busca (multi-tenancy) | NOVO |
| FATURA-03 | **ALTA** | Central de Faturas sem tenant isolation no param | NOVO |
| CONV-SEM-UC-01 | **ALTA** | Conversão SEM_UC usa descontoPadrao% como preço/kWh | NOVO |
| PIX-01 | **ALTA** | PIX Excedente requer ativação `ASAAS_PIX_EXCEDENTE_ATIVO=true` | 27/03 |
| CTK-01 | **MÉDIA** | Tokens creditados sem arredondamento (5º ciclo!) | 01/04 |
| FINANCEIRO-01 | **MÉDIA** | Módulo Financeiro com telas sem backend | NOVO |
| FATURA-04 | **MÉDIA** | Auto-aprovação com threshold 5% hardcoded | NOVO |
| FATURA-05 | **MÉDIA** | Parse de mesReferencia inconsistente entre fluxos | NOVO |
| NOTIF-01 | **MÉDIA** | marcarComoLida sem verificação de ownership | NOVO |
| SAAS-01 | **MÉDIA** | gerarFaturasMensal: diaVencimentoSaas null causa data errada | NOVO |
| WA-BOT-06 | **MÉDIA** | Dupla mensagem estados menu fora de horário | 02/04 |
| WA-BOT-03 | **MÉDIA** | Dupla mensagem sessão expirada fora de horário | 31/03 |
| WZ-10 | **MÉDIA** | Upload documentos sem sinalização de falha na UI | 31/03 |
| REL-03 | **MÉDIA** | PERCENTUAL_DESCONTO = 0.15 hardcoded no FaturaUploadOCR | 29/03 |
| WZ-09 | **MÉDIA** | SUPER_ADMIN cria cooperado sem cooperativaId | 27/03 |
| MIG-04 | **MÉDIA** | kWh arredondamento anual/mensal diverge | 27/03 |
| CENTRAL-01 | **BAIXA** | Cooperados SEM_UC contados em "semFatura" | NOVO |
| SAAS-02 | **BAIXA** | ModuloGuard sem cobertura automática | NOVO |
| CONV-04 | **BAIXA** | `salvarConfigLembretes` sem transação | 02/04 |
| CONV-05 | **BAIXA** | Config lembretes: tipos não validados (NaN possível) | 02/04 |
| JOB-01 | **BAIXA** | Dois crons às 3h com critérios sobrepostos | 02/04 |
| CTK-04 | **BAIXA** | Contrato errado em `apurarExcedentes` com múltiplos contratos | 02/04 |
| CTK-05 | **BAIXA** | `debitar()` usa tipo hardcoded no ledger | 02/04 |
| CONV-03 | **BAIXA** | vincularLeadAoConvite pode vincular convite expirado | 01/04 |
| CTK-02 | **BAIXA** | creditarManual tipo hardcoded como GERACAO_EXCEDENTE | 01/04 |
| CTK-03 | **BAIXA** | Encoding mojibake em cooper-token.job.ts | 01/04 |
| WA-BOT-05 | **BAIXA** | NPS com setTimeout não persiste em restart | 31/03 |
| CTX-01 | **BAIXA** | Token de troca não invalida sessão anterior | 29/03 |
| REL-04 | **BAIXA** | qtdContratos inflacionado no breakdown de usinas | 29/03 |
| COB-Tel-01 | **BAIXA** | Normalização telefone inconsistente | 28/03 |
| FRONT-02 | **BAIXA** | Filtros inadimplência sem auto-submit | 29/03 |
| LEAD-04 | **BAIXA** | Score de lead sem decaimento temporal | 30/03 |
| LEAD-05 | **BAIXA** | receitaLatenteAnual pode duplicar | 30/03 |
| UX-01 | **BAIXA** | Cards de convites não refletem filtros ativos | 02/04 |

---

## 8. SCORE DE QUALIDADE POR MÓDULO

| Módulo | Score 02/04 | Score 03/04 | Delta | Justificativa |
|--------|-------------|-------------|-------|---------------|
| Segurança / Auth | 9.0/10 | 8.5/10 | -0.5 | FATURA-01/02/03 (novos bugs IDOR e multi-tenant) |
| Motor de Cobrança | 9.0/10 | 9.0/10 | = | Cálculo via fatura correto; herda rigor anterior |
| WhatsApp / Bot | 8.5/10 | 8.5/10 | = | Sem alterações |
| Wizard Membro | 8.5/10 | 8.5/10 | = | WZ-10 pendente |
| MLM / Indicações | 9.0/10 | 9.0/10 = | = | Sem alterações |
| Portal Cooperado | 8.5/10 | 8.5/10 | = | Novo financeiro: bom UX, mas upload IDOR |
| Relatórios | 8.5/10 | 8.5/10 | = | Sem alterações |
| Usinas Analítico | 8.5/10 | 8.5/10 | = | Sem alterações |
| Lead Expansão | 8.5/10 | 8.5/10 | = | Sem alterações |
| Clube de Vantagens | 9.0/10 | 9.0/10 | = | Sem alterações |
| PIX Excedente | 7.5/10 | 7.5/10 | = | Aguarda ativação |
| CooperToken | 7.5/10 | 7.5/10 | = | CTK-01 sem resolução |
| ConviteIndicacao | 8.5/10 | 8.5/10 | = | Sem alterações |
| Convênios | 8.5/10 | 8.5/10 | = | Global/Standalone bem implementado; tier mínimo OK |
| Central de Faturas | N/A | 7.5/10 | novo | OCR bem feito; 3 bugs de segurança (IDOR, tenant, threshold) |
| Conversão SEM_UC | N/A | 5.0/10 | novo | Cálculo financeiro incorreto (CONV-SEM-UC-01) — não usar em produção |
| Módulo Financeiro | N/A | 5.0/10 | novo | Frontend sem backend — telas completamente vazias |
| SaaS Multi-tenant | N/A | 8.0/10 | novo | Lógica correta; diaVencimentoSaas null e cobertura de guard |
| Agregadores | N/A | 8.0/10 | novo | MVP funcional; falta mais UX |

**Score geral: 8.5 / 10** ↓ (-0.5 vs 02/04)

---

## 9. PRIORIDADES DE CORREÇÃO

### 🔴 Prioridade 0 — Crítico (antes de ir para produção com novos módulos)

1. **FATURA-01** — Validar `cooperadoId === req.user.cooperadoId` em `uploadConcessionaria`. Fix de 5 linhas.

2. **FATURA-02** — Passar `cooperativaId` nas buscas de `ConfigTenant` em `faturas.service.ts`. Fix de 3 pontos.

3. **FATURA-03** — Enforçar `cooperativaId = req.user.cooperativaId` para ADMIN/OPERADOR em `GET /faturas/central`.

4. **CONV-SEM-UC-01** — Corrigir cálculo de `valorReais` usando tarifa real (TUSD+TE ou campo dedicado) em vez de `descontoPadrao`. **Não ativar em produção até corrigir.**

### 🟠 Prioridade 1 — Alta (próximo sprint)

5. **FINANCEIRO-01** — Implementar backend do Módulo Financeiro ou remover do menu até estar pronto.

6. **PIX-01** — Ativar `ASAAS_PIX_EXCEDENTE_ATIVO=true` após validação contábil.

7. **CTK-01** — `Math.round(excedente * tokenPorKwh * 100) / 100`. Fix de 1 linha. **6º sprint em aberto.**

8. **SAAS-01** — Fallback para `diaVencimentoSaas ?? 10`.

9. **NOTIF-01** — Adicionar verificação de owner em `marcarComoLida`.

10. **FATURA-04** — Criar `ConfigTenant` para threshold de auto-aprovação.

### 🟡 Prioridade 2 — Backlog (próximos 2 sprints)

11. **FATURA-05** — Normalizar parse de `mesReferencia` em um único formato.
12. **WA-BOT-03 + WA-BOT-06** — Resolver dupla mensagem fora de horário.
13. **CENTRAL-01** — Excluir SEM_UC do contador de "sem fatura".
14. **SAAS-02** — Teste de cobertura de `ModuloGuard`.
15. **CONV-04/05** — Transação e validação em `salvarConfigLembretes`.
16. **CTK-04** — Buscar contrato correto em `apurarExcedentes`.
17. **REL-03** — `PERCENTUAL_DESCONTO` dinâmico no OCR.

---

## 10. OBSERVAÇÕES SOBRE O CICLO (19 commits em 1 dia — sprint intensivo)

### Positivos:

**Central de Faturas** é a feature mais impressionante do sprint:
- OCR com Claude API bem estruturado, prompt detalhado com instruções específicas para ICMS, PIS/COFINS, histórico ✅
- Análise automática de divergência (kWh esperado vs compensado) ✅
- Auto-aprovação com geração automática de cobrança ✅
- Envio de relatório HTML por email + mensagem WA após aprovação ✅
- `RelatorioFaturaCooperado.tsx` com visualização de economia, créditos e histórico ✅

**SaaS Multi-tenant:**
- `ModuloGuard` com `@RequireModulo` é uma abordagem elegante ✅
- Propagação de módulos do plano para cooperativas vinculadas ✅
- Proteção de `vincularPlano` apenas para SUPER_ADMIN ✅

**Agregadores:**
- Isolamento correto por `administradoraId` no JWT ✅
- Verificação de propriedade ao criar usuário de agregador ✅

### Pontos de atenção estruturais:

O sprint trouxe **19 commits em ~11 horas** (08h → 19h do dia 02/04), com 4 grandes features novas. A velocidade é impressionante mas introduziu 4 bugs de alta prioridade, principalmente de segurança/integridade de dados. Recomenda-se um sprint de "hardening" nos próximos dias antes de liberar os novos módulos para parceiros.

**Dívida técnica crescente:** O backlog técnico (bugs médios/baixos) está em 17 itens abertos, dos quais CTK-01 está no 5º ciclo consecutivo sem resolução. Uma sessão dedicada a "zero backlog" seria valiosa.

---

## 11. RESUMO EXECUTIVO

### O que foi entregue neste ciclo (02/04 — sprint intensivo)

**Novas features:**
- **Central de Faturas** — upload da fatura da concessionária, OCR por Claude, análise de divergência, auto-aprovação, geração automática de cobrança, relatório mensal por email e WhatsApp
- **Módulo Financeiro** (frontend) — contas a pagar/receber, despesas, fluxo de caixa, dashboard consolidado
- **SaaS Multi-tenant** — planos SaaS, feature flags por módulo, `ModuloGuard`
- **Convênios Global/Standalone** — governança SISGD, tier mínimo Clube, conversão créditos SEM_UC
- **Agregadores** — painel do agregador, admin do agregador com isolamento por tenant
- **Seleção de Contexto** — switcher multi-papel melhorado

**Fixes:**
- `useTipoParceiro`: fallback correto para SUPER_ADMIN
- Sidebar: nome da cooperativa agora exibido corretamente
- Notificações 500: tratado com try/catch no controller
- Cooperado branco: AbortController nos useEffects

### O que precisa de atenção urgente

1. **FATURA-01/02/03** — Central de Faturas tem 3 bugs de segurança (IDOR, multi-tenancy): não deve ser liberada para parceiros sem estas correções.

2. **CONV-SEM-UC-01** — A conversão de créditos SEM_UC calcula valores errados. Qualquer solicitação aprovada em produção gerará valores incorretos de PIX.

3. **FINANCEIRO-01** — Módulo Financeiro está no menu mas completamente sem backend. Usuários verão telas vazias.

4. **CTK-01** — 5 sprints em aberto. Fix de 1 linha: `Math.round(excedente * tokenPorKwh * 100) / 100`.

### Métricas do ciclo

- Features entregues: **6** (Central Faturas, Financeiro, SaaS, Convênios Global, Agregadores, Contexto)
- Bugs corrigidos: **0** (sprint de features puras)
- Novos bugs introduzidos: **9** (4 altos, 5 médios/baixos)
- Bugs críticos abertos: **4** (FATURA-01/02/03, CONV-SEM-UC-01)
- Bugs altos totais: **5** (+ PIX-01)
- Bugs médios abertos: **10**
- Score geral: **8.5/10** (-0.5)

### Tendência

Sprint altamente produtivo em features, mas com regressão na qualidade de segurança. O padrão de entregas está acelerando enquanto o backlog de bugs cresce. Recomendação: próximo sprint com foco em **(1) corrigir FATURA-01/02/03 + CONV-SEM-UC-01 antes de ativar em produção** e **(2) resolver pelo menos CTK-01, WA-BOT-03/06, e FINANCEIRO-01**.

---
*Relatório gerado automaticamente pelo QA Noturno CoopereBR — Assis*
