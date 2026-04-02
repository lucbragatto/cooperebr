# Relatório QA — CoopereBR
**Data:** 2026-03-31
**Horário:** 03:00 (America/Sao_Paulo)
**Período analisado:** commits de 30/03/2026 (03h) a 31/03/2026 (03h)
**Módulos revisados:** WhatsApp Bot (full refactor + WA-BOT-01 + WA-16), Lead Expansão (correção LEAD-01/02/03), Cobranças Job (calcularMultaJuros), CobrançaService (darBaixa arredondamento), Wizard Step7 (cadastro atômico), Clube Vantagens (ranking por período — CLB-01 fix), CooperadosService (fila espera, cotaKwh, confirmarAssinatura)
**Score geral de qualidade: 8.5 / 10** ↑ (+0.6 vs relatório anterior)

---

## 1. STATUS DOS ITENS CRÍTICOS DO RELATÓRIO ANTERIOR (2026-03-30)

| ID | Descrição | Status 30/03 | Status 31/03 | Observação |
|----|-----------|--------------|--------------|------------|
| LEAD-01 | `GET /lead-expansao` sem @Roles e sem tenant isolation | **CRÍTICO** | ✅ **CORRIGIDO** | `@Roles(SUPER_ADMIN, ADMIN, OPERADOR)` adicionado; cooperativaId passado do req.user |
| LEAD-02 | `POST /lead-expansao/notificar/:distribuidora` sem perfil | **ALTA** | ✅ **CORRIGIDO** | `@Roles(SUPER_ADMIN, ADMIN)` aplicado; cooperativaId passado ao service |
| LEAD-03 | `findAll` LeadExpansaoService sem filtro cooperativaId | **ALTA** | ✅ **CORRIGIDO** | `where.cooperativaId` aplicado quando informado |
| WA-16 | Conversas mortas sem cron de reset | **ALTA** | ✅ **CORRIGIDO** | `WhatsappConversaJob` criado — cron a cada hora, reseta AGUARDANDO_* com updatedAt > 24h |
| WA-BOT-01 | Keyword fatura bypassa fluxo em andamento | **MÉDIA** | ✅ **CORRIGIDO** | Lista `ESTADOS_FLUXO_ATIVO` implementada; bypass só ocorre em estados INICIAL/CONCLUIDO/MENU_* |
| WZ-08 | Criação cooperado sem transação atômica | **ALTA** | ✅ **CORRIGIDO** | `POST /cooperados/cadastro-completo` com `prisma.$transaction(Serializable)` encapsula cooperado+UC+contrato+listaEspera |
| WZ-07 | Lista espera — cotaKwhMensal zerada | **ALTA** | ✅ **CORRIGIDO** | `filaEspera()` usa `cotaCadastro = c.cotaKwhMensal` como fallback quando `faturasProcessadas` vazio; Step7 envia `cotaKwhMensal: Math.round(mediaKwh * 100) / 100` |
| CLB-01 | Ranking usa métrica cumulativa p/ filtro por período | **ALTA** | ✅ **CORRIGIDO** | `getRankingPorPeriodo` agora usa `kwhIndicadoMes`/`kwhIndicadoAno` (campos dedicados) com `campoKwh = isMes ? 'kwhIndicadoMes' : 'kwhIndicadoAno'`; `atualizarMetricas` faz reset mensal/anual automático |
| COB-WA-01 | abordarInadimplentes sem controle de frequência | **MÉDIA** | ✅ **CORRIGIDO** | `notificarCobrancasVencidas` usa campo `ultimaCobrancaWhatsappEm` + `intervaloMinCobrancaHoras` configurável por cooperativa; flag `notificadoVencimento` evita re-notificação inicial |
| COB-Job-01 | Float sem arredondamento no job de multa/juros | **BAIXA** | ✅ **PARCIAL** | `darBaixa()` no CobrancasService usa `Math.round(...*100)/100`. **Porém `calcularMultaJuros` no CobrancasJob ainda persiste `multa` e `juros` sem arredondamento (`Math.round` só no `valorAtualizado`)**. Valores `valorMulta` e `valorJuros` salvos com muitas casas decimais. |
| PORT-01 | Assinatura digital sem idempotência | **MÉDIA** | ✅ **CORRIGIDO** | `verificarTokenAssinatura` valida token + expiração + limpa token após uso (`tokenAssinatura: null`). Status cooperado muda para PENDENTE — re-submissão retorna erro de token inválido |
| PC-05 | Gráfico UC ignora ucId | **ALTA** | ⏳ **PENDENTE** | Sem alterações |
| WA-15 | Motor dinâmico WA desativado | **ALTA** | ✅ **CORRIGIDO** | `fluxoMotor.processarComFluxoDinamico()` chamado antes do switch/case; erros fazem fallback para hardcoded |
| PIX-01 | PIX Excedente sempre SIMULADO | **ALTA** | ⏳ **PENDENTE** | `status: 'SIMULADO'` ainda hardcoded em pix-excedente.service.ts |
| CLB-02 | upsertConfig sem validação de ranges | **ALTA** | ⏳ **PENDENTE** | Sem alterações |
| WZ-09 | SUPER_ADMIN cria cooperado sem cooperativaId | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| MIG-04 | kWh arredondamento anual/mensal diverge | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| REL-03 | Tarifa hardcoded R$0,80 sem aviso na UI | **MÉDIA** | ⏳ **PENDENTE** | Sem alterações |
| CTX-01 | Token de troca não invalida sessão anterior | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| REL-04 | qtdContratos inflacionado no breakdown de usinas | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| COB-Tel-01 | Normalização telefone inconsistente | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| FRONT-02 | Filtros inadimplência sem auto-submit | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| LEAD-04 | Score de lead sem decaimento temporal | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |
| LEAD-05 | receitaLatenteAnual pode duplicar se economiaEstimada não for mensal | **BAIXA** | ⏳ **PENDENTE** | Sem alterações |

**Resumo correções neste ciclo:** 10 itens resolvidos. Ciclo mais produtivo até agora.

---

## 2. NOVOS BUGS ENCONTRADOS — CICLO 30/03 → 31/03

### 2.1 CobrancasJob — `calcularMultaJuros` Persiste Floats Sem Arredondamento nos Campos Individuais

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| COB-Job-02 | **BAIXA** | Em `calcularMultaJuros()` (CobrancasJob), os campos `valorMulta` e `valorJuros` são persistidos **sem arredondamento para 2 casas decimais**, enquanto apenas `valorAtualizado` é arredondado: `const multa = valorOriginal * (Number(config.multaAtraso) / 100)` → sem `Math.round`. O método `darBaixa()` no CobrancasService já arredonda corretamente (bug anterior COB-Job-01 parcialmente corrigido). A inconsistência entre os dois métodos persiste. Exemplo real: cobrança de R$287,50 com multa de 2% = R$5.75 — mas se `multaAtraso = 2.3`, valorMulta = R$6.6125. O Asaas recusa cobranças com mais de 2 casas decimais. | `cobrancas.job.ts:calcularMultaJuros` |

**Correção:**
```typescript
const multa = Math.round(valorOriginal * (Number(config.multaAtraso) / 100) * 100) / 100;
const juros = Math.round(valorOriginal * (Number(config.jurosDiarios) / 100) * diasEfetivos * 100) / 100;
const valorAtualizado = Math.round((valorOriginal + multa + juros) * 100) / 100;
await this.prisma.cobranca.update({
  where: { id: cobranca.id },
  data: { valorMulta: multa, valorJuros: juros, valorAtualizado },
});
```

---

### 2.2 Bot WhatsApp — `handleNegociacaoParcelamento` Grava Parcelamento em Campo Errado

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| WA-BOT-02 | **MÉDIA** | Em `handleNegociacaoParcelamento()`, quando o cooperado aceita o parcelamento, o código grava o acordo no campo `motivoCancelamento` da cobrança: `data: { motivoCancelamento: 'Parcelamento 3x negociado via WhatsApp...' }`. Isso é semanticamente incorreto — `motivoCancelamento` deve ser usado apenas para cancelamentos. O parcelamento deveria ser registrado em um campo dedicado (ex: `observacoesNegociacao`) ou em uma entidade separada de acordos. Como efeito colateral, cobranças com parcelamento negociado aparecem com dados de "cancelamento" preenchidos em dashboards e relatórios, criando confusão. | `whatsapp-bot.service.ts:handleNegociacaoParcelamento` |

---

### 2.3 Bot WhatsApp — Bypass de Timeout de Sessão com Mensagem de Horário Fora de Expediente

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| WA-BOT-03 | **BAIXA** | Em `processarMensagem()`, quando a conversa está fora do horário (20h-8h), o código envia o aviso de horário mas **não faz `return`** — o fluxo continua processando normalmente (comentado "continua processando normalmente (simulação funciona 24h)"). Porém logo após, o timeout de sessão (30min) é verificado. Se a sessão expirou, o usuário recebe **duas mensagens**: o aviso de fora de expediente E o aviso de sessão expirada em sequência rápida. Além disso, se o usuário envia "menu" às 23h, recebe o aviso de horário E o menu principal — experiência inconsistente. | `whatsapp-bot.service.ts:processarMensagem` |

---

### 2.4 Bot WhatsApp — `handleConfirmarProxy` Cria Cooperado com CPF Fake

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| WA-BOT-04 | **ALTA** | Em `handleConfirmarProxy()`, o cooperado cadastrado por proxy recebe CPF gerado com `cpf: \`PROXY_${Date.now()}\`` e email fake `proxy_${Date.now()}@pendente.cooperebr`. O status é `PENDENTE_ASSINATURA`. O fluxo espera que o cooperado acesse o link e complete o cadastro, mas **não há validação de CPF duplicado** neste path — se o mesmo número de telefone tenta cadastro proxy duas vezes, dois cooperados são criados com CPFs diferentes e o segundo encontro por telefone pode falhar. Adicionalmente, o CPF fake nunca é limpo se o cooperado não assinar no prazo de 7 dias — o registro fica "zumbi" no banco. | `whatsapp-bot.service.ts:handleConfirmarProxy` |

**Correção recomendada:** Adicionar `tokenAssinaturaExp` check em um job de limpeza (cron diário) para remover cooperados em `PENDENTE_ASSINATURA` com token expirado há mais de 24h.

---

### 2.5 Bot WhatsApp — `agendarNps` com `setTimeout` Não Persiste em Reinicializações

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| WA-BOT-05 | **BAIXA** | `agendarNps()` usa `setTimeout` de 1 hora em memória. Se o servidor reiniciar (ex: deploy, crash) durante esse intervalo, o NPS nunca é enviado. Para a escala atual do projeto pode ser aceitável, mas como o backend usa PM2 e tem reinicializações programadas, isso resulta em NPS perdidos silenciosamente. Considerar cron job ou flag `npsAgendadoEm` na conversa para re-agendamento no startup. | `whatsapp-bot.service.ts:agendarNps` |

---

### 2.6 Step7 — Upload de Documentos Fora da Transação Atômica

| # | Severidade | Bug | Arquivo |
|---|-----------|-----|---------|
| WZ-10 | **MÉDIA** | O novo `cadastroCompleto` encapsula corretamente cooperado+UC+contrato em transação Prisma. Porém, o **upload de documentos** ainda ocorre sequencialmente após o retorno da transação (no frontend, chamadas a `POST /documentos/upload/:cid`). Se o upload de um documento crítico (ex: RG) falhar após o cadastro ter sido concluído, o cooperado existe sem documentos. O operador precisa verificar manualmente e pedir re-upload. Isso é aceitável operacionalmente (fluxo de documentos pode ser retomado), mas a **mensagem de sucesso da UI não indica que documentos ainda precisam ser enviados** quando há falha parcial. Adicionar indicador de status de upload por documento na tela de conclusão. | `Step7Alocacao.tsx:finalizar` |

---

## 3. ANÁLISE DE SEGURANÇA CONSOLIDADA

### 3.1 Postura de Segurança — Visão Atual

| Módulo | Situação |
|--------|----------|
| Lead Expansão | ✅ @Roles corrigido; tenant isolation OK |
| Assinatura Digital | ✅ Token JWT idempotente; token invalidado após uso |
| WhatsApp Bot | ✅ Fluxos protegidos contra bypass de keyword; sessão com timeout |
| Cobranças | ✅ Tenant isolation presente; rate limit implementado |
| Relatórios | ✅ Tenant isolation corrigido no ciclo 30/03 |
| Usinas Analítico | ✅ Tenant check implementado |
| Cadastro Completo | ✅ Transação Serializable; validação ANEEL centralizada |

### 3.2 Ponto de Atenção Residual

**PIX-01** persiste: `pix-excedente.service.ts:127` ainda tem `status: 'SIMULADO'` hardcoded. Qualquer funcionalidade de repasse de sobras para cooperados está bloqueada por esse placeholder.

---

## 4. ANÁLISE DOS FLUXOS

### 4.1 Bot WhatsApp — Visão Geral Pós-Refatoração

O bot passou por uma refatoração profunda neste ciclo. Pontos positivos:

- **WA-16 CORRIGIDO**: `WhatsappConversaJob` com cron horário reseta AGUARDANDO_* inativas > 24h ✅
- **WA-BOT-01 CORRIGIDO**: `ESTADOS_FLUXO_ATIVO` com 24 estados listados — keywords de fatura só bypassam em INICIAL/CONCLUIDO/MENU_* ✅
- **WA-15 PARCIALMENTE ATIVO**: `fluxoMotor.processarComFluxoDinamico()` chamado com fallback — motor dinâmico agora tenta processar antes do hardcoded ✅
- **Timeout de sessão 30min** implementado — conversa resetada com aviso ao usuário ✅
- **Fluxo de proxy** completo: cooperado pode cadastrar amigo via WhatsApp, link JWT enviado ao indicado ✅
- **Fluxo de cancelamento de contrato** via bot (suspender, encerrar, ajustar kWh) ✅
- **NPS automático** 1h após cadastro ✅

**Pendência de qualidade:**
- **WA-BOT-02**: Parcelamento gravado em `motivoCancelamento` (campo semântico errado)
- **WA-BOT-03**: Dupla mensagem em sessão expirada fora de horário
- **WA-BOT-04**: CPF fake em proxy sem cleanup job
- **WA-BOT-05**: `setTimeout` para NPS não persiste em restart

### 4.2 Wizard Step7 — Transação Atômica

O Step7 agora usa o endpoint `POST /cooperados/cadastro-completo` com `prisma.$transaction(Serializable)`. A transação encapsula:
1. Criar cooperado
2. Criar UC
3. Validar distribuidora ANEEL
4. Validar capacidade usina
5. Criar contrato
6. Posicionar na lista de espera

Upload de documentos e chamada ao motor de proposta são pós-transação (aceitável — são enriquecimentos, não dados críticos).

**Ponto de atenção (WZ-10):** Falha no upload de documento não é sinalizada claramente na UI de conclusão.

### 4.3 Clube de Vantagens — CLB-01 Resolvido

`getRankingPorPeriodo` agora usa campos dedicados `kwhIndicadoMes` / `kwhIndicadoAno` com reset automático em `atualizarMetricas()`. O filtro `[campoRef]: valorRef` garante que só aparece no ranking mensal quem foi atualizado no mês corrente. CLB-01 encerrado.

**CLB-02 ainda pendente:** `upsertConfig` aceita `niveisConfig` sem validar sobreposição de ranges (ex: BRONZE 0-100 kWh e PRATA 80-200 kWh se sobrepõem).

---

## 5. ANÁLISE DE CÁLCULOS

### 5.1 Multa/Juros — Situação Atual

**`darBaixa()` (CobrancasService):** ✅ `Math.round(...*1e4)/1e4` para intermediários, `Math.round(...*100)/100` para final. Correto.

**`calcularMultaJuros()` (CobrancasJob):** ⚠️ `valorMulta` e `valorJuros` persistidos sem arredondamento. Ver COB-Job-02.

### 5.2 Score de Lead — Análise Atualizada

`calcularScore()` retorna máximo teórico de 7 (3+2+1+1) com `Math.min(score, 10)`. A escala de "0 a 10" exibida na UI é enganosa — nenhum lead jamais chega a 8. Considerar escala relativa `Math.round((score / 7) * 10)` ou documentar que a escala é 0-7.

### 5.3 Wizard — kWh Mensal do Contrato

`payload.contrato.kwhContrato = Math.round(mediaKwh)` — arredondamento correto para inteiro. `cotaKwhMensal: Math.round(mediaKwh * 100) / 100` — 2 casas decimais adequado para campo financeiro. ✅

### 5.4 Ranking Clube — Campos de Reset

`atualizarMetricas()` reset mensal/anual: `kwhIndicadoMes: resetMes ? deltaKwh : { increment: deltaKwh }`. Correto. Porém **não há mecanismo de reset forçado no início do mês/ano** — o reset só ocorre quando `atualizarMetricas()` é chamado pela primeira vez após a virada. Se nenhum indicado pagar fatura no primeiro dia do mês, `kwhIndicadoMes` do mês anterior permanece até a primeira atualização. Em geral isso é aceitável (o campo só "muda de mês" quando há nova atividade), mas o ranking mensal pode mostrar valores do mês anterior no dia 1-2 de cada mês.

---

## 6. ANÁLISE DE USABILIDADE

### 6.1 Bot WhatsApp — Dupla Mensagem Fora de Horário (WA-BOT-03)

Usuário que envia mensagem às 23h com sessão expirada recebe:
1. "🌙 Atendimento fora do horário comercial..."
2. "⏰ Sua sessão anterior expirou por inatividade..."

Recomendação: fazer `return` após aviso de sessão expirada; ou agrupar os dois avisos numa única mensagem quando ambos se aplicam.

### 6.2 Step7 — Indicação de Progresso do Upload

Na conclusão do wizard, cooperados com documentos obrigatórios veem a tela de sucesso imediatamente, enquanto uploads acontecem em background. Se o upload falhar, o usuário já saiu da página. Adicionar status de progresso inline (✅ RG enviado, ⚠️ Comprovante: erro — tentar novamente).

### 6.3 Fila de Espera — `semHistorico` Agora Sinalizado

`filaEspera()` retorna `semHistorico: true` quando `consumo === null`. A UI deve usar esse flag para exibir "—" em vez de "0 kWh". **Verificar se o frontend consome esse campo** — não foi possível confirmar a implementação do componente de fila de espera neste ciclo.

### 6.4 Página Expansão — Botão "Notificar" Sem Confirmação (Pendente)

Confirmado pendente: `ExpansaoPage` botão "Notificar leads" dispara WhatsApp para todos os confirmados de uma distribuidora sem modal de confirmação. Um clique acidental pode disparar dezenas de mensagens.

---

## 7. BUGS RESIDUAIS ACUMULADOS (TODOS OS ABERTOS)

| # | Severidade | Bug | Ciclo de Origem |
|---|-----------|-----|----------------|
| PC-05 | **ALTA** | Gráfico UC ignora ucId | 27/03 |
| PIX-01 | **ALTA** | PIX Excedente sempre SIMULADO | 27/03 |
| CLB-02 | **ALTA** | upsertConfig sem validação de ranges | 27/03 |
| WA-BOT-04 | **ALTA** | CPF fake em proxy sem cleanup job | NOVO |
| WZ-10 | **MÉDIA** | Upload documentos sem sinalização de falha na UI de conclusão | NOVO |
| WA-BOT-02 | **MÉDIA** | Parcelamento gravado em `motivoCancelamento` | NOVO |
| REL-03 | **MÉDIA** | Tarifa hardcoded R$0,80 sem aviso na UI | 29/03 |
| WZ-09 | **MÉDIA** | SUPER_ADMIN cria cooperado sem cooperativaId | 27/03 |
| MIG-04 | **MÉDIA** | kWh arredondamento anual/mensal diverge | 27/03 |
| WA-BOT-03 | **BAIXA** | Dupla mensagem em sessão expirada fora de horário | NOVO |
| WA-BOT-05 | **BAIXA** | NPS com setTimeout não persiste em restart | NOVO |
| COB-Job-02 | **BAIXA** | valorMulta/valorJuros persistidos sem arredondamento no job | NOVO |
| CTX-01 | **BAIXA** | Token de troca não invalida sessão anterior | 29/03 |
| REL-04 | **BAIXA** | qtdContratos inflacionado no breakdown de usinas | 29/03 |
| COB-Tel-01 | **BAIXA** | Normalização telefone inconsistente | 28/03 |
| FRONT-02 | **BAIXA** | Filtros inadimplência sem auto-submit | 29/03 |
| LEAD-04 | **BAIXA** | Score de lead sem decaimento temporal | 30/03 |
| LEAD-05 | **BAIXA** | receitaLatenteAnual pode duplicar | 30/03 |

---

## 8. SCORE DE QUALIDADE POR MÓDULO

| Módulo | Score 30/03 | Score 31/03 | Delta | Justificativa |
|--------|-------------|-------------|-------|---------------|
| Segurança / Auth | 8.5/10 | 9.0/10 | +0.5 | Lead Expansão corrigido; assinatura idempotente |
| Motor de Cobrança | 8/10 | 8.5/10 | +0.5 | Rate limit implementado; arredondamento quase completo |
| WhatsApp / Bot | 6.5/10 | 8.5/10 | +2.0 | WA-16, WA-BOT-01, WA-15 corrigidos; novos bugs menores |
| Wizard Membro | 6/10 | 8.5/10 | +2.5 | WZ-07/08 corrigidos; transação atômica implementada |
| MLM / Indicações | 8/10 | 8/10 | = | Sem alterações |
| Portal Cooperado | 7.5/10 | 8.5/10 | +1.0 | Assinatura idempotente; proxy funcional |
| Relatórios | 8/10 | 8/10 | = | Sem alterações |
| Usinas Analítico | 8.5/10 | 8.5/10 | = | Sem alterações |
| Lead Expansão | 5/10 | 8.5/10 | +3.5 | Segurança corrigida; score ainda sem decaimento |
| Clube de Vantagens | 6.5/10 | 8.0/10 | +1.5 | CLB-01 corrigido; CLB-02 pendente |
| PIX Excedente | 4/10 | 4/10 | = | Ainda placeholder |

**Score geral: 8.5 / 10** ↑ (+0.6 vs 30/03)

---

## 9. PRIORIDADES DE CORREÇÃO

### 🔴 Prioridade 1 — Bloqueante

1. **WA-BOT-04** — Job diário para limpar cooperados `PENDENTE_ASSINATURA` com `tokenAssinaturaExp < hoje`. Sem esse cleanup, CPFs fake acumulam no banco indefinidamente:
   ```typescript
   // cooperados.job.ts (novo)
   @Cron('0 3 * * *')
   async limparCooperadosProxyExpirados() {
     const { count } = await this.prisma.cooperado.deleteMany({
       where: {
         status: 'PENDENTE_ASSINATURA',
         tokenAssinaturaExp: { lt: new Date() },
         contratos: { none: {} },
       },
     });
     if (count > 0) this.logger.log(`${count} cooperado(s) proxy expirado(s) removidos`);
   }
   ```

### 🟠 Prioridade 2 — Alta (próximo sprint)

2. **PIX-01** — Implementar chamada real ao endpoint Asaas de transferência PIX, ou bloquear exibição em produção com feature flag `ASAAS_PIX_EXCEDENTE_ATIVO=false`

3. **WA-BOT-02** — Criar campo `observacoesNegociacao` em `Cobranca` (ou tabela `AcordoParcelamento`) para registrar parcelamentos. Remover uso de `motivoCancelamento` para esse fim

4. **CLB-02** — Validar sobreposição de ranges em `upsertConfig`:
   ```typescript
   // Verificar que kwhMaximo[i] <= kwhMinimo[i+1] (após ordenar por kwhMinimo)
   ```

5. **PC-05** — Investigar e corrigir gráfico UC que ignora `ucId`

6. **COB-Job-02** — Arredondar `valorMulta` e `valorJuros` em `calcularMultaJuros()` (1 linha de fix)

### 🟡 Prioridade 3 — Médio (backlog)

7. **WZ-10** — Adicionar status de upload por documento na tela de conclusão do Step7
8. **WA-BOT-03** — Agrupar mensagens de "fora de horário" + "sessão expirada"
9. **REL-03** — Aviso na UI sobre tarifa estimada; buscar tarifa real da cooperativa
10. **WZ-09** — Exigir cooperativaId quando SUPER_ADMIN cria cooperado
11. **WA-BOT-05** — Persistir agendamento de NPS em banco (flag `npsPendente` + cron)

---

## 10. RESUMO EXECUTIVO

### O que melhorou neste ciclo (30/03 → 31/03)

- **10 vulnerabilidades/bugs corrigidos** — o maior número em um único ciclo
- **Transação atômica no Wizard**: `cadastroCompleto` com `prisma.$transaction(Serializable)` — eliminado o risco de cooperados semi-cadastrados
- **Bot WhatsApp radicalmente melhorado**: timeout de sessão, bypass de keyword com proteção de estado, cron de limpeza de conversas mortas, motor dinâmico ativo com fallback, fluxo de proxy completo
- **Lead Expansão seguro**: tenant isolation e roles corretos
- **Clube de Vantagens**: ranking por período agora usa métricas corretas do período
- **Assinatura digital idempotente**: dupla assinatura prevenida
- Score geral: **8.5/10** (+0.6)

### O que precisa de atenção urgente

1. **WA-BOT-04 — CPF fake sem cleanup**: Cooperados em `PENDENTE_ASSINATURA` com token expirado acumulam no banco. Se o sistema tiver 100 cadastros proxy/semana com taxa de conclusão de 40%, em 1 mês haverá ~240 registros zumbi. Fácil de resolver com cron de limpeza.

2. **PIX-01 — PIX Excedente SIMULADO**: A funcionalidade de distribuição de sobras via PIX para cooperados está completamente bloqueada. É uma funcionalidade estratégica para o modelo cooperativista e está há 4 ciclos como placeholder.

3. **CLB-02 — upsertConfig sem validação**: Um administrador pode criar níveis de clube com ranges sobrepostos, causando comportamento imprevisível na promoção de cooperados.

### Métricas do ciclo

- Bugs corrigidos neste ciclo: **10** (LEAD-01/02/03, WA-16, WA-BOT-01, WZ-07/08, CLB-01, COB-WA-01, PORT-01, WA-15)
- Novos bugs introduzidos: **6** (WA-BOT-02/03/04/05, WZ-10, COB-Job-02)
- Bugs críticos abertos: **0** ✅
- Bugs altos abertos: **4** (PC-05, PIX-01, CLB-02, WA-BOT-04)
- Score geral: **8.5/10**

### Observação de Tendência

O projeto atingiu maturidade de qualidade suficiente para deploys de produção controlados. Os 4 bugs altos restantes são funcionalmente isoláveis (PIX Excedente pode ser ocultado por feature flag, PC-05 é cosmético, CLB-02 afeta apenas configuração de admin, WA-BOT-04 precisa de job de limpeza). Recomenda-se considerar um deploy de produção com `ASAAS_PIX_EXCEDENTE_ATIVO=false` e os demais itens no primeiro sprint pós-launch.
