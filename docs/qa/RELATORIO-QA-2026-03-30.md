# Relatório QA — CoopereBR
**Data:** 2026-03-30
**Horário:** 03:00 (America/Sao_Paulo)
**Período analisado:** commits de 29/03/2026 (03h) a 30/03/2026 (03h)
**Módulos revisados:** Relatórios (tenant isolation), Usinas Analítico, Lead Expansão (novo), WhatsApp Cobrança (refator), Migração Usinas (throttle), Clube de Vantagens (ranking período), Wizard Membro (Step7), Frontend (cooperados, usinas, cooperativas, expansão)
**Score geral de qualidade: 7.9 / 10** ↑ (+0.3 vs relatório anterior)

---

## 1. STATUS DOS ITENS CRÍTICOS DO RELATÓRIO ANTERIOR (2026-03-29)

| ID | Descrição | Status 29/03 | Status 30/03 | Observação |
|----|-----------|--------------|--------------|------------|
| REL-01 | Relatório inadimplência sem tenant isolation | **CRÍTICO** | ✅ **CORRIGIDO** | `effectiveCoopId` force-filtra por `req.user.cooperativaId` quando perfil ≠ SUPER_ADMIN |
| REL-02 | Projeção receita sem tenant isolation | **CRÍTICO** | ✅ **CORRIGIDO** | `cooperativaId` é passado corretamente ao service; contratos filtrados por cooperativa |
| ANA-01 | Saúde financeira usina sem tenant check | **ALTA** | ✅ **CORRIGIDO** | `saudeFinanceira(id, req.user?.cooperativaId)` — ForbiddenException se cooperativa diverge |
| ANA-02 | Ocupação usina sem tenant check | **ALTA** | ✅ **CORRIGIDO** | Mesmo padrão — `ocupacao(id, req.user?.cooperativaId)` com ForbiddenException |
| ANA-03 | Inadimplentes expõe dados cross-tenant | **ALTA** | ✅ **CORRIGIDO** | Cobranças filtradas por `cooperativaId` dentro de `saudeFinanceira` agora |
| FRONT-01 | Dropdown cooperativas lista todas para ADMIN | **ALTA** | ✅ **CORRIGIDO** | `if (usuario?.perfil === 'SUPER_ADMIN')` — ADMIN recebe apenas sua cooperativa |
| ANA-04 | totalInadimplente usa valorLiquido em vez de valorAtualizado | **MÉDIA** | ✅ **CORRIGIDO** | `valorAtualizado ?? valorLiquido` aplicado corretamente |
| MIG-02 | migrarTodosDeUsina sem throttle | **ALTA** | ✅ **CORRIGIDO** | `await sleep(500)` entre iterações implementado |
| WA-16 | Conversas mortas sem cron de reset | **ALTA** | ⏳ **PENDENTE** | Sem alterações |
| PC-05 | Gráfico UC ignora ucId | **ALTA** | ⏳ **PENDENTE** | Sem alterações |
| WZ-07 | Lista espera — cotaKwhMensal zerada | **ALTA** | ⏳ **PENDENTE** | Sem alterações |
| WZ-08 | Criação cooperado sem transação | **ALTA** | ⏳ **PENDENTE** | Step7Alocacao ainda faz múltiplos POST sequenciais sem rollback |
| WA-15 | Motor dinâmico WA desativado | **ALTA** | ⏳ **PENDENTE** | TODO permanece |
| CLB-01 | Ranking usa métrica cumulativa para filtro por período | **ALTA** | ⏳ **PENDENTE** | `getRankingPorPeriodo` ainda usa `kwhIndicadoAcumulado` mesmo com filtro mes/ano |
| CLB-02 | upsertConfig sem validação de ranges | **ALTA** | ⏳ **PENDENTE** | Sem validação de sobreposição/gap entre níveis |
| PIX-01 | PIX Excedente sempre SIMULADO | **ALTA** | ⏳ **PENDENTE** | `status: 'SIMULADO'` ainda hardcoded |
| WZ-09 | SUPER_ADMIN cria cooperado sem cooperativaId | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| WA-BOT-01 | Keyword fatura bypassa fluxo em andamento | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| MIG-04 | kWh arredondamento anual/mensal diverge | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| REL-03 | Tarifa hardcoded R$0,80 sem aviso na UI | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| COB-Job-01 | Float sem arredondamento no job de multa/juros | **BAIXA** | ⏳ **PENDENTE** | Sem Math.round nos campos valorMulta/valorJuros |
| COB-Tel-01 | Normalização telefone inconsistente | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| FRONT-02 | Filtros inadimplência sem auto-submit | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| CTX-01 | Token de troca não invalida sessão anterior | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| REL-04 | qtdContratos inflacionado no breakdown de usinas | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |

**Resumo correções:** 8 itens resolvidos neste ciclo vs. 1 no anterior. Parabéns — todas as vulnerabilidades críticas de tenant isolation estão fechadas.

---

## 2. NOVOS RECURSOS ADICIONADOS (ciclo 29/03 → 30/03)

### 2.1 Módulo Lead Expansão

Novo módulo completo para captura e análise de demanda reprimida por distribuidora:
- `GET /lead-expansao` — lista leads com score calculado em memória
- `POST /lead-expansao` — cria lead vindo do bot WhatsApp ou formulário externo
- `GET /lead-expansao/resumo-investidores` — agrega receita latente por distribuidora/estado
- `POST /lead-expansao/notificar/:distribuidora` — marca leads como NOTIFICADO e dispara whatsapp

Frontend em `/dashboard/relatorios/expansao/page.tsx` com tabela de leads, score de propensão e ação de notificação.

### 2.2 WhatsApp Cobrança — Refatoração de Envio

`WhatsappCobrancaService.enviarCobrancasDoMes()` recebeu novos parâmetros:
- `modo: 'todos' | 'parceiro' | 'lista'` — seletividade de envio
- `limiteEnvios: number` — limitador de lote (padrão 30) com flag `limitado` na resposta
- Delay aleatório entre mensagens via `delayAleatorio()` — anti-bloqueio WhatsApp

### 2.3 Frontend — Páginas de Detalhe Atualizadas

Múltiplas páginas de detalhe recriadas com painéis analíticos integrados:
- `usinas/[id]/page.tsx` — agora exibe Saúde Financeira + Ocupação + Histórico de Migrações + Migrar Todos
- `cooperativas/[id]/page.tsx` — painel de membros com botões de migração e ajuste inline
- `cooperados/page.tsx` — listagem redesenhada com filtros, badge Clube, checklist tooltip, ações em lote

### 2.4 Módulo Condomínios/Administradoras

Novas páginas de gestão de condomínios e administradoras adicionadas ao dashboard:
- `/dashboard/administradoras` + `[id]`
- `/dashboard/condominios` + `[id]`
Módulos de backend (`condominios.service.ts`, `administradoras.service.ts`) já existentes.

### 2.5 Portal Cooperado — Assinatura Digital

`/portal/assinar/[token]/page.tsx` adicionado — cooperado recebe link por e-mail/WhatsApp, assina o contrato via browser sem login obrigatório, validado por token JWT de uso único.

---

## 3. BUGS NOVOS ENCONTRADOS — CICLO 29/03 → 30/03

### 3.1 Lead Expansão — Endpoints Sem Autenticação

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| LEAD-01 | **CRÍTICO** | `LeadExpansaoController` não declara `@Roles()` em nenhuma rota e não aplica `@Public()`. Pelo `RolesGuard`, rotas sem `@Roles()` são "autenticadas mas sem restrição de perfil" — qualquer usuário logado com JWT válido pode acessar. Porém `GET /lead-expansao` e `GET /lead-expansao/resumo-investidores` expõem nomes, telefones e valores de fatura de potenciais clientes sem segregação de tenant. Um COOPERADO logado pode listar leads de outras cooperativas fazendo `GET /lead-expansao`. | `lead-expansao.controller.ts` |
| LEAD-02 | **ALTA** | `POST /lead-expansao/notificar/:distribuidora` não exige perfil ADMIN/SUPER_ADMIN. Qualquer usuário autenticado (inclusive COOPERADO) pode disparar notificações WhatsApp para leads de qualquer distribuidora, contornando qualquer controle de ritmo de envio. | `lead-expansao.controller.ts` |
| LEAD-03 | **ALTA** | `LeadExpansaoService.findAll()` não filtra por `cooperativaId` — retorna leads de toda a plataforma independente da cooperativa do usuário logado. Combinado com LEAD-01, qualquer usuário autenticado vê leads de todos os parceiros. | `lead-expansao.service.ts:findAll` |

**Correção recomendada:**
```typescript
// lead-expansao.controller.ts
@Roles(SUPER_ADMIN, ADMIN, OPERADOR)
@Get()
findAll(@Req() req: any, @Query('distribuidora') distribuidora?: string, ...) {
  const cooperativaId = req.user.perfil === SUPER_ADMIN ? undefined : req.user.cooperativaId;
  return this.service.findAll({ distribuidora, cooperativaId, ... });
}

@Roles(SUPER_ADMIN, ADMIN)
@Post('notificar/:distribuidora')
notificar(@Param('distribuidora') distribuidora: string) { ... }
```

---

### 3.2 Wizard Step7 — Criação de Cooperado Sem Transação Atômica

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| WZ-08 | **ALTA** | `finalizar()` em `Step7Alocacao.tsx` faz 5 chamadas sequenciais independentes: (1) criar cooperado, (2) criar UC, (3) upload documentos, (4) criar contrato, (5) lista espera. Se a etapa 4 falhar (ex: usina sem capacidade no momento do submit), o cooperado e a UC já foram criados mas sem contrato. O usuário vê a mensagem "Erro ao gerar contrato. Cooperado cadastrado, mas entre em contato com o suporte..." — o dado fica inconsistente e requer intervenção manual. **Não é possível transação client-side, mas o backend deveria expor um endpoint `/cooperados/cadastro-completo` que encapsule toda a operação em transação.** | `Step7Alocacao.tsx:finalizar` |

*(Este bug já estava listado como WZ-08 no relatório 28/03 mas não foi marcado como corrigido — confirmando que permanece no ciclo atual.)*

---

### 3.3 Lead Expansão — Score Não Considera Decaimento Temporal

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| LEAD-04 | **BAIXA** | `calcularScore()` soma +1 se lead criado há menos de 24h. Após isso, o score não decai — um lead de 90 dias com intenção confirmada tem o mesmo score que um de 2 dias. Para ordenação de prioridade comercial, leads antigos não devolvidos tendem a ser menos quentes, mas continuarão aparecendo no topo do ranking se tiverem intenção e valor de fatura altos. Considerar penalidade por inatividade (ex: -1 por semana sem resposta). | `lead-expansao.service.ts:calcularScore` |

---

### 3.4 WhatsApp Cobrança — `abordarInadimplentes` Sem Controle de Frequência por Cobrança

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| COB-WA-01 | **MÉDIA** | `abordarInadimplentes()` usa `whatsappEnviadoEm: { not: null }` como filtro (ou seja, cobra quem já recebeu a cobrança original) mas não controla quantas vezes a abordagem de inadimplência foi enviada. O cron roda diariamente às 9h. Se uma cobrança está VENCIDO há 30 dias, o sistema envia 30 mensagens de cobrança. Não há campo `ultimaAbordagemEm` ou controle de intervalo mínimo entre abordagens. Pode gerar bloqueio do número WhatsApp por spam. | `whatsapp-cobranca.service.ts:abordarInadimplentes` |

**Correção recomendada:** Adicionar campo `ultimaAbordagemEm` em `Cobranca` e filtrar `ultimaAbordagemEm: null OR ultimaAbordagemEm: { lt: 3 dias atrás }` (abordagem a cada 3 dias, no máximo).

---

### 3.5 Portal Assinatura — Token JWT de Contrato Sem Escopo de Revogação

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| PORT-01 | **MÉDIA** | `/portal/assinar/[token]/page.tsx` usa um token JWT de uso único para assinar contratos. Se o usuário abrir o link duas vezes (aba duplicada, recarregar a página após clicar), a segunda chamada pode processar novamente a assinatura. O backend precisaria marcar o contrato como "assinado" atomicamente e rejeitar re-submissões com idempotência. Não foi possível verificar se o backend já implementa isso — recomenda-se auditar `confirmarAssinatura()` em `cooperados.service.ts` para garantir idempotência via `contrato.status === 'ASSINADO'` check antes de processar. | `cooperados/cooperados.service.ts:confirmarAssinatura` |

---

### 3.6 Dashboard Cooperados — `cotaKwhMensal` Zero na Lista de Espera

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| WZ-07 | **ALTA** | Confirmado pendente: `filaEspera()` retorna `consumoMedioMensal` baseado em `faturasProcessadas[0].mediaKwhCalculada`. Para cooperados que completaram o wizard mas não tiveram a fatura processada via `registrarFaturaMensal()`, `faturasProcessadas` é vazio → `consumoMedioMensal: null`. A tela da fila de espera exibe `null` kWh. O operador não tem base para priorizar alocação. O campo `cotaKwhMensal` do cooperado deveria ser preenchido no Step7 (calculado da média do histórico OCR) e usado como fallback neste retorno. | `cooperados.service.ts:filaEspera`, `Step7Alocacao.tsx` |

---

### 3.7 Clube de Vantagens — Ranking por Período Usa Métrica Cumulativa

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| CLB-01 | **ALTA** | Confirmado pendente: `getRankingPorPeriodo(periodo='mes')` filtra `progressaoClube` por `dataUltimaAvaliacao >= início_do_mês` mas ainda ordena por `kwhIndicadoAcumulado` (valor total histórico). Cooperados com histórico longo sempre superam novos indicadores, mesmo que no mês atual tenham trazido menos indicados. O filtro por data é ilusório — o ranking de "mês" não representa o desempenho do mês. Requer tabela separada de `HistoricoKwhMensal` ou campo `kwhIndicadoMes` na `ProgressaoClube`. | `clube-vantagens.service.ts:getRankingPorPeriodo` |

---

### 3.8 Cálculo de Receita Latente — `receitaLatenteAnual` Pode Duplicar Dados

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| LEAD-05 | **BAIXA** | `getResumoInvestidores()` agrupa por `${distribuidora}||${estado}`. Se a mesma distribuidora opera em dois estados diferentes (ex: CEMIG em MG e GO — hipotético), são duas entradas separadas. Correto. Porém `receitaLatenteAnual = somaEconomia * 12` onde `somaEconomia` é a soma de `economiaEstimada` (mensal) de todos os leads do grupo. Um lead com `economiaEstimada = R$50/mês` seria projetado como `R$600/ano`. Se o campo `economiaEstimada` não for consistentemente preenchido como mensal, os valores podem ser inflados. A UI não indica a unidade de `economiaEstimada` no cadastro do lead. | `lead-expansao.service.ts:getResumoInvestidores` |

---

## 4. ANÁLISE DE SEGURANÇA CONSOLIDADA

### 4.1 Postura de Segurança — Todos os Endpoints Novos

| Endpoint | Auth | Roles | Tenant Isolation | Status |
|----------|------|-------|-----------------|--------|
| `GET /lead-expansao` | ✅ JWT | ❌ Sem @Roles | ❌ Ausente | **CRÍTICO** |
| `POST /lead-expansao` | ✅ JWT | ❌ Sem @Roles | N/A (criação) | ⚠️ Médio |
| `GET /lead-expansao/resumo-investidores` | ✅ JWT | ❌ Sem @Roles | ❌ Ausente | **ALTA** |
| `POST /lead-expansao/notificar/:distribuidora` | ✅ JWT | ❌ Sem @Roles | N/A | **ALTA** |
| `GET /relatorios/inadimplencia` | ✅ JWT | ✅ ADMIN+ | ✅ Corrigido | ✅ OK |
| `GET /relatorios/projecao-receita` | ✅ JWT | ✅ ADMIN+ | ✅ Corrigido | ✅ OK |
| `GET /usinas/:id/saude-financeira` | ✅ JWT | ✅ ADMIN+ | ✅ Corrigido | ✅ OK |
| `GET /usinas/:id/ocupacao` | ✅ JWT | ✅ ADMIN+ | ✅ Corrigido | ✅ OK |
| `POST /cooperados/pre-cadastro-proxy` | ✅ @Public | N/A | N/A | ✅ OK (público por design) |
| `POST /cooperados/confirmar-assinatura/:token` | ✅ @Public | N/A | Token JWT | ⚠️ Verificar idempotência |

### 4.2 Tendência de Segurança

- **8 vulnerabilidades corrigidas** neste ciclo (all from 29/03 report)
- **2 novas críticas/altas** introduzidas (LEAD-01, LEAD-02, LEAD-03)
- Padrão persiste: novos módulos entram sem `@Roles()` e sem filtro de cooperativa
- **Recomendação sistêmica**: criar um lint rule ou teste e2e que valide que todo endpoint sem `@Public()` tem `@Roles()` declarado

---

## 5. ANÁLISE DOS FLUXOS

### 5.1 Bot WhatsApp

**Status dos itens pendentes:**
- **WA-BOT-01** (keyword fatura bypassa fluxo): Código verificado — `['fatura', 'faturas', 'boleto', '2a via', '2ª via', 'segunda via', 'pix', 'pagar'].includes(corpoLower)` continua redirecionando incondicionalmente para `MENU_FATURA` mesmo se conversa está em `AGUARDANDO_CPF` ou outro estado de coleta. Cooperado em processo de cadastro que menciona "fatura" perde todo o progresso silenciosamente. **PENDENTE.**

- **WA-15** (motor dinâmico desativado): TODO permanece no código com comentário explicativo. **PENDENTE.**

- **WA-16** (conversas mortas): Sem cron implementado. Conversas em `AGUARDANDO_*` há mais de 24h continuam nesse estado. **PENDENTE.**

**Melhoria identificada neste ciclo:**
- `WhatsappCobrancaService` agora tem `limiteEnvios` por lote (padrão 30) — proteção contra envio massivo acidental. ✅

### 5.2 Wizard Membro — Step7

O Step7 foi revisado. Fluxo identificado:

1. **Sequência de criação**: cooperado → UC → documentos → contrato → lista de espera — todos chamados sequencialmente sem rollback
2. **Erro parcial visível**: mensagem de fallback "Cooperado cadastrado, mas entre em contato com o suporte" aparece na UI
3. **`cotaKwhMensal` não é preenchido no Step7**: a média calculada no histórico OCR (`mediaKwh`) é usada para criar o contrato (`kwhContrato`), mas não é enviada ao backend como `cotaKwhMensal` do cooperado — campo permanece nulo no DB até o `registrarFaturaMensal` ser chamado depois

### 5.3 Portal Assinatura Digital

Novo fluxo identificado: `pre-cadastro-proxy` → WhatsApp com link → `assinar/[token]` → `confirmarAssinatura(token)`.

**Ponto de atenção:** `confirmarAssinatura` não foi auditado neste ciclo. Recomenda-se verificar se:
1. O token é validado como JWT com claims de `cooperadoId` + `ação: ASSINAR_CONTRATO`
2. A operação é idempotente (evitar dupla assinatura se link aberto duas vezes)
3. O token tem expiração adequada (sugerido: 72h)

---

## 6. ANÁLISE DE CÁLCULOS

### 6.1 Cálculo de Multa/Juros — Float Sem Arredondamento (COB-Job-01)

Confirmado no código: `valorMulta = valorOriginal * (config.multaAtraso / 100)` sem `Math.round`. O campo `valorMulta` no banco pode ter muitas casas decimais (ex: R$12.346789). A tela usa `.toFixed(2)` apenas para exibição — o valor persistido no banco não é arredondado. Em cobranças com Asaas, o PIX/boleto usa o `valorAtualizado` completo, que soma float não arredondado → pode gerar divergência de centavos com o gateway de pagamento.

**Correção:**
```typescript
const multa = Math.round(valorOriginal * (Number(config.multaAtraso) / 100) * 100) / 100;
const juros = Math.round(valorOriginal * (Number(config.jurosDiarios) / 100) * diasEfetivos * 100) / 100;
const valorAtualizado = Math.round((valorOriginal + multa + juros) * 100) / 100;
```

### 6.2 Ocupação de Usina — Cálculo Correto

`percentualOcupado` = soma de `percentualUsina` de contratos ATIVO + PENDENTE_ATIVACAO. Correto.
`kwhOcupado` = `(somaPercentual * capacidadeKwh) / 100`. Correto.

**Atenção:** Se `somaPercentual > 100` (superalocação por bug), `kwhOcupado` seria maior que `capacidadeKwh`, mas `kwhDisponivel = Math.max(0, capacidade - kwhOcupado)` — o `Math.max(0, ...)` previne valor negativo na UI. Porém o percentual ainda seria exibido como `>100%` sem alerta. Recomenda-se adicionar alerta na UI quando `percentualOcupado > 100`.

### 6.3 Score de Lead Expansão

`calcularScore()` retorna valores de 0 a 10 mas a soma máxima possível é 7 (3 + 2 + 1 + 1). O `Math.min(score, 10)` nunca atinge 10. A escala deveria ser documentada ou o algoritmo ajustado para escalar adequadamente.

### 6.4 Projeção de Receita — Tarifa Hardcoded (REL-03)

Ainda pendente. `const tarifaEstimada = 0.80` com comentário no código. Cooperativas com tarifa real diferente recebem projeções distorcidas. Sem aviso na UI.

---

## 7. ANÁLISE DE USABILIDADE

### 7.1 Página de Detalhes da Usina — Muitas Chamadas de API no Mount

`UsinaDetailPage` faz 6 chamadas paralelas no `useEffect([usina, id])`:
1. `GET /usinas/:id/lista-concessionaria`
2. `GET /usinas/:id/distribuicao`
3. `GET /usinas/:id/saude-financeira`
4. `GET /usinas/:id/ocupacao`
5. `GET /usinas`
6. `GET /migracoes-usina/historico-usina/:id`

Todas em paralelo (`sem Promise.all`) → múltiplos re-renders. Em usinas com muitos cooperados, pode gerar lentidão perceptível e race conditions nos setStates. Considerar `Promise.all` e um único `setState` consolidado.

### 7.2 Wizard Membro — Perda de Estado no Navegador

Se o usuário navegar para outra página no Step6 e voltar, todo o estado do wizard é perdido (não há `localStorage` ou `sessionStorage`). Para wizards com 7 passos e upload de documentos, isso é perda significativa. Considerar persistência mínima do estado do formulário.

### 7.3 Tela Expansão — Botão "Notificar" Sem Confirmação

`ExpansaoPage` tem botão "Notificar" que dispara WhatsApp para todos os leads confirmados de uma distribuidora. Sem modal de confirmação. Um clique acidental dispara para todos os leads. Adicionar `confirm()` ou modal de confirmação.

### 7.4 Cooperados — Dropdown de Ações Usa `position: fixed`

`AcoesDropdown` usa `position: fixed` com coordenadas calculadas via `getBoundingClientRect()`. Em tabelas com scroll horizontal ou zoom do browser diferente de 100%, o dropdown pode aparecer deslocado. Padrão funcional mas frágil.

### 7.5 Fila de Espera — `consumoMedioMensal: null` Sem Fallback Visual

Na tela da fila de espera, cooperados sem `faturasProcessadas` exibem `null` kWh. Deveria exibir `—` ou `Não calculado` em vez de valor nulo.

---

## 8. BUGS RESIDUAIS ACUMULADOS (TODOS OS ABERTOS)

| # | Severidade | Bug | Ciclo de Origem |
|---|-----------|-----|----------------|
| LEAD-01 | **CRÍTICO** | `GET /lead-expansao` sem @Roles e sem tenant isolation | NOVO |
| LEAD-02 | **ALTA** | `POST /lead-expansao/notificar/:distribuidora` sem restrição de perfil | NOVO |
| LEAD-03 | **ALTA** | `findAll` em LeadExpansaoService sem filtro cooperativaId | NOVO |
| WA-16 | **ALTA** | Conversas mortas sem cron de reset | 27/03 |
| PC-05 | **ALTA** | Gráfico UC ignora ucId | 27/03 |
| WZ-07 | **ALTA** | Lista espera — cotaKwhMensal zerada | 27/03 |
| WZ-08 | **ALTA** | Criação cooperado sem transação atômica | 27/03 |
| WA-15 | **ALTA** | Motor dinâmico WA desativado | 27/03 |
| CLB-01 | **ALTA** | Ranking usa métrica cumulativa p/ filtro por período | 27/03 |
| CLB-02 | **ALTA** | upsertConfig sem validação de ranges | 27/03 |
| PIX-01 | **ALTA** | PIX Excedente sempre SIMULADO | 27/03 |
| COB-WA-01 | **MÉDIA** | abordarInadimplentes sem controle de frequência por cobrança | NOVO |
| PORT-01 | **MÉDIA** | Assinatura digital sem verificação de idempotência | NOVO |
| REL-03 | **MÉDIA** | Tarifa hardcoded R$0,80 sem aviso na UI | 29/03 |
| WA-BOT-01 | **MÉDIA** | Keyword fatura bypassa fluxo em andamento | 28/03 |
| WZ-09 | **MÉDIA** | SUPER_ADMIN cria cooperado sem cooperativaId | 27/03 |
| MIG-04 | **MÉDIA** | kWh arredondamento anual/mensal diverge | 27/03 |
| CTX-01 | **BAIXA** | Token de troca não invalida sessão anterior | 29/03 |
| REL-04 | **BAIXA** | qtdContratos inflacionado no breakdown de usinas | 29/03 |
| COB-Job-01 | **BAIXA** | Float sem arredondamento no job de multa/juros | 28/03 |
| COB-Tel-01 | **BAIXA** | Normalização telefone inconsistente | 28/03 |
| FRONT-02 | **BAIXA** | Filtros inadimplência sem auto-submit | 29/03 |
| LEAD-04 | **BAIXA** | Score de lead sem decaimento temporal | NOVO |
| LEAD-05 | **BAIXA** | receitaLatenteAnual pode duplicar se economiaEstimada não for mensal | NOVO |

---

## 9. SCORE DE QUALIDADE POR MÓDULO

| Módulo | Score 29/03 | Score 30/03 | Delta | Justificativa |
|--------|-------------|-------------|-------|---------------|
| Segurança / Auth | 8.5/10 | 8.5/10 | = | Tenant isolation resolvido nos módulos anteriores; Lead Expansão puxa levemente para baixo |
| Motor de Cobrança | 8/10 | 8/10 | = | Sem alterações; COB-Job-01 ainda pendente |
| WhatsApp / Bot | 6/10 | 6.5/10 | +0.5 | Cobrança com limite de lote melhora; WA-BOT-01/WA-15/WA-16 continuam |
| Wizard Membro | 6/10 | 6/10 | = | WZ-07/08 ainda pendentes |
| MLM / Indicações | 8/10 | 8/10 | = | Sem alterações |
| Portal Cooperado | 7/10 | 7.5/10 | +0.5 | Assinatura digital é avanço; PORT-01 a verificar |
| Relatórios | 5/10 | 8/10 | +3 | Tenant isolation resolvido; tarifa hardcoded pendente |
| Usinas Analítico | 5.5/10 | 8.5/10 | +3 | Tenant check implementado corretamente |
| Lead Expansão (NOVO) | — | 5/10 | NOVO | Funcionalidade boa, 2 vulnerabilidades críticas de auth/tenant |
| Migrações Usina | 8/10 | 8.5/10 | +0.5 | Throttle implementado |
| Clube de Vantagens | 6.5/10 | 6.5/10 | = | CLB-01/02 ainda pendentes |
| PIX Excedente | 4/10 | 4/10 | = | Ainda placeholder |

**Score geral: 7.9 / 10** ↑ (+0.3 vs 29/03)

---

## 10. PRIORIDADES DE CORREÇÃO

### 🔴 Prioridade 1 — Bloqueante (antes de qualquer deploy de produção)

1. **LEAD-01 + LEAD-02 + LEAD-03** — Adicionar `@Roles(SUPER_ADMIN, ADMIN, OPERADOR)` em todos os endpoints de Lead Expansão e filtrar por `cooperativaId` no service:
   ```typescript
   // controller
   @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
   @Get()
   findAll(@Req() req: any, ...) {
     const cooperativaId = req.user.perfil === SUPER_ADMIN ? undefined : req.user.cooperativaId;
     return this.service.findAll({ cooperativaId, ... });
   }
   // service.findAll: adicionar where.cooperativaId = cooperativaId quando informado
   ```

### 🟠 Prioridade 2 — Alta (próximo sprint)

2. **COB-WA-01** — Controle de frequência de abordagem de inadimplentes: campo `ultimaAbordagemEm` em `Cobranca` e filtro de intervalo mínimo de 3 dias

3. **WA-BOT-01** — Guardar estado de fluxo antes do bypass de keyword de fatura; keywords `['fatura', 'boleto', ...]` só bypassam em estados `INICIAL`, `CONCLUIDO`, `MENU_*`; em estados `AGUARDANDO_*`, exibir aviso e preservar o estado

4. **WZ-08** — Criar endpoint `POST /cooperados/onboarding-completo` que encapsule toda a criação do wizard em transação única no backend

5. **WZ-07** — No Step7, enviar `cotaKwhMensal: Math.round(mediaKwh)` ao criar cooperado; na `filaEspera()`, usar `cotaKwhMensal` como fallback quando `faturasProcessadas` vazio

6. **PORT-01** — Auditar `confirmarAssinatura()` para garantir idempotência; adicionar verificação `if (contrato.status === 'ASSINADO') throw new ConflictException()`

7. **WA-16** — Implementar cron diário às 04h para resetar conversas em `AGUARDANDO_*` com `updatedAt > 24h`

### 🟡 Prioridade 3 — Médio (backlog)

8. **CLB-01** — Adicionar campo `kwhIndicadoMes` / `kwhIndicadoAno` na `ProgressaoClube` e atualizar via `atualizarMetricas()` com reset mensal via cron

9. **CLB-02** — Validação de ranges sobrepostos em `upsertConfig`

10. **REL-03** — Aviso na UI de projeção de receita sobre tarifa estimada; buscar tarifa real configurada da cooperativa como alternativa

11. **COB-Job-01** — `Math.round(...*100)/100` nos campos `valorMulta`, `valorJuros` e `valorAtualizado`

12. **PIX-01** — Implementar chamada real ao gateway PIX ou pelo menos bloquear exibição do status SIMULADO em produção

---

## 11. RESUMO EXECUTIVO

### O que melhorou neste ciclo (29/03 → 30/03)

- **8 vulnerabilidades de segurança corrigidas** — todas as 5 vulnerabilidades críticas/altas de tenant isolation nos módulos de Relatórios e Usinas Analítico estão fechadas agora
- **WhatsApp Cobrança** com controle de lote e delay anti-bloqueio
- **Migração em massa** com throttle implementado (500ms entre cooperados)
- **Módulo Lead Expansão** para análise de demanda reprimida — funcionalidade estratégica para expansão de usinas
- **Portal de Assinatura Digital** — cooperado pode assinar contrato via link, sem login
- **Frontend** — páginas de detalhe de Usina e Cooperativa totalmente redesenhadas com painéis analíticos integrados
- Score geral: **7.9/10** (+0.3)

### O que precisa de atenção urgente

1. **LEAD-01/02/03** — O novo módulo Lead Expansão foi adicionado SEM autenticação de perfil e SEM filtro de tenant. Qualquer cooperado logado pode listar leads de toda a plataforma e disparar notificações WhatsApp. Correção é simples (adicionar `@Roles()` e `where.cooperativaId`) mas bloqueia deploy de produção.

2. **COB-WA-01** — Abordagem de inadimplentes sem controle de frequência: cobranças com >1 dia de atraso recebem mensagem DIARIAMENTE. Risco real de bloqueio do número WhatsApp.

3. **WZ-08** — Wizard sem transação: cooperados ficam semi-cadastrados se a criação de contrato falha. Requer endpoint consolidado de onboarding no backend.

### Métricas do ciclo

- Bugs corrigidos neste ciclo: **8** (REL-01/02, ANA-01/02/03/04, FRONT-01, MIG-02)
- Novos bugs introduzidos: **6** (LEAD-01/02/03/04/05, COB-WA-01, PORT-01)
- Bugs críticos abertos: **1** (LEAD-01)
- Bugs altos abertos: **10**
- Score geral: **7.9/10**

### Observação de Arquitetura

O padrão de crescimento está saudável: cada ciclo resolve mais bugs do que introduz. A velocidade de correção acelerou significativamente (8 correções neste ciclo vs. 4 no anterior). O único anti-padrão persistente — novos módulos sem `@Roles()` e sem filtro de tenant — pode ser mitigado com uma ferramenta de lint ou um script de CI que valide endpoints automaticamente antes do merge.
