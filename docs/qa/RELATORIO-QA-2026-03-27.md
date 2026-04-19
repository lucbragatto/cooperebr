# Relatório QA — CoopereBR
**Data:** 2026-03-27
**Horário:** 03:00 (America/Sao_Paulo)
**Período analisado:** commits de 26/03/2026 (17h) a 27/03/2026 (03h)
**Módulos:** Migrações de Usina (NOVO), Modo Observador (NOVO), PIX Excedente (NOVO), Clube de Vantagens (expansão), Portal Parceiro, Portal Cooperado, WhatsApp Bot, Auth/Segurança
**Score geral de qualidade: 6.8 / 10** ↑ (+0.4 vs relatório anterior)

---

## 1. STATUS DOS ITENS CRÍTICOS DO RELATÓRIO ANTERIOR (2026-03-26)

| ID | Descrição | Status Anterior | Status Hoje | Observação |
|----|-----------|-----------------|-------------|------------|
| PC-01 | Link de convite MLM quebrado (UUID como fallback) | CRÍTICO | **CORRIGIDO** | Portal indicações agora usa `/indicacoes/meu-link` corretamente |
| PC-02 | QR code em branco / hydration mismatch | CRÍTICO | **CORRIGIDO** | `linkConvite` é `''` inicial, preenchido via useEffect com API |
| PC-03 | Desligamento habilitado quando API falha | CRÍTICO | **CORRIGIDO** | catch agora seta `{ semFaturasAberto: false, semGeracaoAtiva: false }` e exibe erro |
| PP-01/PP-02 | Dashboard parceiro com KPIs hardcoded/limit:1 | CRÍTICO | **CORRIGIDO** | Endpoint `/cooperativas/meu-dashboard` implementado e chamado |
| FIN-08 | valorAtualizado não exibido ao cooperado | ALTA | **CORRIGIDO** | Portal financeiro exibe multa, juros e valor atualizado com tachado no original |
| WZ-10 | Falha silenciosa na criação de contrato | ALTA | **PARCIALMENTE CORRIGIDO** | Agora exibe mensagem de erro ao usuário; contudo o wizard não bloqueia, permite continuar |
| WZ-09 | SUPER_ADMIN criando cooperado sem cooperativaId | MÉDIA | **PENDENTE** | Step7Alocacao não envia cooperativaId no POST, backend usa fallback null |
| WA-16 | Conversas AGUARDANDO_* sem timeout/cron | ALTA | **PARCIALMENTE CORRIGIDO** | Timeout de 30min implementado no fluxo de mensagem; sem cron para sessões "mortas" sem mensagem |
| WP-01 | Step3Espera parceiro — cooperativaId undefined | CRÍTICO | **CORRIGIDO** | Commit 5b504a9 adicionou tolerância a cooperativaId undefined |
| WA-17 | formatarTelefone() sem validação de tamanho | MÉDIA | **CORRIGIDO** | Commit 24cbb91 valida 11 dígitos para telefone BR |
| SEC-03 | .env com credenciais no repositório | CRÍTICO | **RESOLVIDO** | `git ls-files backend/.env` → vazio; arquivo no .gitignore e não rastreado |
| AUTH-01 | Contexto proprietário sem cooperativaId no JWT | ALTA | **NÃO VERIFICADO** | Sem alterações no auth.service.ts neste ciclo |
| PC-05 | Gráfico UC mostra dados incorretos (ucId ignorado) | ALTA | **PENDENTE** | Sem alterações em portal/ucs |
| PC-07 | totalBeneficio subestimado (só APLICADO) | MÉDIA | **CORRIGIDO PARCIAL** | Portal indicações agora filtra por `status !== 'CANCELADO'`, inclui PENDENTE/PARCIAL |

---

## 2. BUGS NOVOS — MÓDULO MIGRAÇÕES DE USINA (NOVO)

| # | Severidade | Bug | Arquivo | Detalhe |
|---|-----------|-----|---------|---------|
| MIG-01 | **CRÍTICA** | `gerarListaConcessionaria(usinaId)` sem validação de tenant — qualquer ADMIN pode passar UUID de usina de outra cooperativa e receber lista completa com nome, CPF e número UC de cooperados alheios (IDOR) | migracoes-usina.service.ts:~410 | Endpoint `GET /migracoes-usina/lista-concessionaria/:usinaId` permite leitura cross-tenant |
| MIG-02 | **ALTA** | `migrarTodosDeUsina` itera sobre todos os contratos com `await migrarCooperado()` em loop sequencial com delay de apenas 100ms entre mensagens WhatsApp — para usinas com >100 cooperados, risco de timeout de request HTTP (sem timeout definido), bloqueio de número WA e esgotamento de conexões Prisma | migracoes-usina.service.ts:~285 | Sem limite de batch, sem timeout global na operação |
| MIG-03 | **MÉDIA** | `migrarCooperado` e `ajustarKwh`: bloco WhatsApp em try/catch vazio — falhas de envio nunca são logadas; sem retry | migracoes-usina.service.ts:204,~265 | Mensagem de confirmação ao cooperado pode ser perdida silenciosamente |
| MIG-04 | **MÉDIA** | `ajustarKwh` via percentual: `kwhNovo = round(kwhContratoAnual/12 * 100)/100` e `kwhContratoAnual` são calculados independentemente — arredondamentos diferentes podem gerar `kwhNovo * 12 ≠ kwhContratoAnual` (ex: 83.33 * 12 = 999.96 ≠ 1000) — inconsistência em contratos | migracoes-usina.service.ts:246-250 | Campos `kwhContrato` e `kwhContratoAnual` podem divergir por centavos |
| MIG-05 | **BAIXA** | `historicoCooperado` e `historicoUsina` não paginam — para cooperados com muitas migrações, retorna array inteiro sem limite | migracoes-usina.service.ts:435-448 | Sem `take`/`skip` |

---

## 3. BUGS NOVOS — CLUBE DE VANTAGENS (EXPANSÃO)

| # | Severidade | Bug | Arquivo | Detalhe |
|---|-----------|-----|---------|---------|
| CLB-01 | **ALTA** | `getRankingPorPeriodo(mes/ano)` filtra por `dataUltimaAvaliacao >= início do período` mas ordena por `kwhIndicadoAcumulado` (cumulativo histórico) — o "ranking mensal" na prática mostra quem foi avaliado este mês ordenado pelo total de todos os tempos, não pelo kWh indicado no período | clube-vantagens.service.ts:320-340 | Ranking de período é estatisticamente enganoso |
| CLB-02 | **ALTA** | `upsertConfig` não valida sobreposição de ranges em `niveisConfig` — se admin configura BRONZE 0-500 e PRATA 400-2000, `avaliarProgressao` pode promover incorretamente pois encontra o "melhor nível" sem checar que 450 kWh satisfaz tanto BRONZE quanto PRATA | clube-vantagens.service.ts:60-80 | Promoção inconsistente com configuração inválida |
| CLB-03 | **MÉDIA** | `getRankingPorPeriodo(mes)` retorna lista vazia quando nenhum cooperado teve `dataUltimaAvaliacao` no mês atual (início de mês) — frontend exibe ranking em branco sem distinção de "sem dados" vs "ranking vazio" | clube-vantagens.service.ts:335-345 | Regressão UX ao início de cada mês |
| CLB-04 | **MÉDIA** | `enviarResumosMensaisLote`: delay anti-bloqueio de 3-5s entre cada envio — para 1000 cooperados com indicados ativos, execução total ~1h. CronExpression não especificado no job (dia 1 do mês às 00h?), poderia colidir com outros jobs noturnos | clube-vantagens.job.ts | Sem timeout global; sem controle de janela de execução |

---

## 4. BUGS NOVOS — PIX EXCEDENTE (NOVO)

| # | Severidade | Bug | Arquivo | Detalhe |
|---|-----------|-----|---------|---------|
| PIX-01 | **ALTA** | `processarPixExcedente` sempre cria `TransferenciaPix` com `status: 'SIMULADO'` — nunca executa transferência real. A UI em `/dashboard/financeiro/pix-excedente` pode apresentar o resultado como se o pagamento tivesse sido processado, gerando expectativa falsa | pix-excedente.service.ts:96 | Comentário no código diz "SIMULADO por enquanto" sem issue/TODO rastreável |
| PIX-02 | **MÉDIA** | Sem validação de teto nas alíquotas: `aliquotaIR + aliquotaPIS + aliquotaCOFINS` pode ultrapassar 100% se alguém chamar o endpoint com valores absurdos → `valorLiquido = Math.max(0, ...)` evita negativo mas resultado seria sempre 0 sem erro claro | pix-excedente.service.ts:78-86 | Alíquota total deve ser validada ≤ 100% com erro explícito |
| PIX-03 | **BAIXA** | `listarTransferencias` não aplica isolamento de tenant quando `cooperativaId` não é passado — endpoint acessível por ADMIN sem cooperativaId retornaria todas as transferências de todas as cooperativas | pix-excedente.service.ts:107-125 | Filtro é opcional; deveria ser obrigatório para ADMIN (não SUPER_ADMIN) |

---

## 5. BUGS NOVOS — SEGURANÇA / CROSS-TENANT

| # | Severidade | Bug | Arquivo | Detalhe |
|---|-----------|-----|---------|---------|
| SEC-05 | **CRÍTICA** | `GET /migracoes-usina/lista-concessionaria/:usinaId`: ADMIN e OPERADOR podem passar qualquer `usinaId` — expõe nome completo, CPF, número UC e percentual de participação de cooperados de qualquer cooperativa | migracoes-usina.controller.ts:56-60 | Adicionar `WHERE usina.cooperativaId = req.user.cooperativaId` na query |
| SEC-06 | **ALTA** | `GET /migracoes-usina/dual-lista?usinaOrigemId=X&usinaDestinoId=Y`: mesmo problema — dois usinaIds sem validação de tenant. SUPER_ADMIN pode fazer cross-tenant (intencional), ADMIN não deveria | migracoes-usina.controller.ts:62-68 | Mesma correção: validar ownership das usinas |
| SEC-07 | **ALTA** | `POST /migracoes-usina/cooperado` e `ajustar-kwh`: o ADMIN pode migrar cooperados de outras cooperativas se souber o `cooperadoId` — o service valida capacidade da usina destino mas não verifica se `cooperadoId` pertence à `cooperativaId` do usuário logado | migracoes-usina.service.ts:56-80 | Adicionar check: `cooperado.cooperativaId === dto.cooperativaId` |

---

## 6. BUGS RESIDUAIS (DAS SESSÕES ANTERIORES — AINDA ABERTOS)

| # | Severidade | Bug | Status |
|---|-----------|-----|--------|
| WZ-09 | MÉDIA | SUPER_ADMIN cria cooperado sem cooperativaId | Pendente |
| WA-16 | ALTA | Conversas mortas sem cron de limpeza (timeout só funciona se nova msg chega) | Parcial |
| AUTH-01 | ALTA | JWT do proprietário pode não ter cooperativaId | Não verificado |
| PC-05 | ALTA | Gráfico UC usa cobrancas do cooperado todo, ignora ucId | Pendente |
| WZ-07 | ALTA | Lista espera sem simulação — cotaKwhMensal zerada | Pendente |
| WZ-08 | ALTA | Criação de cooperado sem transação — parcial success possível | Pendente |
| WA-15 | ALTA | Motor dinâmico WhatsApp desativado com TODO | Pendente |
| CLB-02 | ALTA | upsertConfig sem validação de ranges sobrepostos | NOVO |
| CLB-01 | ALTA | Ranking por período usa métrica cumulativa | NOVO |

---

## 7. INCONSISTÊNCIAS DE CÁLCULO

### 7.1 Migração de Usina — kWh vs Percentual
Quando `ajustarKwh` é chamado com `percentualNovo`, o serviço calcula:
```
kwhContratoAnual = (percentualNovo / 100) * capUsina
kwhNovo = round((kwhContratoAnual / 12) * 100) / 100
```
O campo `kwhContratoAnual` é `percentualNovo * cap`, mas `kwhNovo * 12` pode diferir por centavos de arredondamento. Em contratos longos, essa divergência acumula.

**Exemplo:** capacidade=3000kWh, percentual=3.333%  
→ `kwhContratoAnual = 100.0`, `kwhNovo = 8.33`, `8.33 * 12 = 99.96 ≠ 100.0`

### 7.2 Clube de Vantagens — Ranking Período ≠ Métricas do Período
`getRankingPorPeriodo(mes)` ordena por `kwhIndicadoAcumulado` (soma desde sempre), não por kWh adicionado no mês. Dois cooperados com 5000 kWh acumulado histórico aparecem empatados no ranking mensal mesmo que um não tenha indicado ninguém este mês.

### 7.3 Multa/Juros — valorMulta arredondamento
`cobrancas.job.ts`: `multa = valorOriginal * (multaAtraso / 100)` e `juros = valorOriginal * (jurosDiarios / 100) * diasEfetivos` são calculados com precisão float. `valorAtualizado = valorOriginal + multa + juros` pode ter erro de ponto flutuante. O portal agora exibe esses valores formatados em R$, então clientes verão R$ 0,01 de diferença em casos extremos.

---

## 8. ANÁLISE DOS NOVOS MÓDULOS

### 8.1 Migrações de Usina — Avaliação Geral: 6/10
**Positivos:**
- Transação SERIALIZABLE em `migrarCooperado` e `ajustarKwh` — excelente para evitar race conditions de alocação
- Validação de capacidade antes de migrar (soma de percentuais ≤ 100.0001)
- Geração automática de lista para concessionária em CSV + JSON
- Histórico de migrações rastreado em `MigracaoUsina`

**Negativos:**
- IDOR crítico em `lista-concessionaria` (SEC-05)
- Sem validação de ownership de cooperado (SEC-07)
- `migrarTodosDeUsina` sem controle de throughput

### 8.2 Modo Observador — Avaliação Geral: 7.5/10
**Positivos:**
- Isolamento por `cooperativaId` no controller e service
- Limite de 10 observações simultâneas por ADMIN
- Expiração padrão 4h com opção de customizar
- Log de ativação/encerramento em `LogObservacao`
- Cron de expiração automática implementado

**Pontos de atenção:**
- Sem proteção contra ADMIN observar o próprio número (loop de observação)
- Escopo `TUDO` pode ser muito permissivo para auditoria futura

### 8.3 PIX Excedente — Avaliação Geral: 4/10
- Funcionalidade ainda é placeholder (`status: 'SIMULADO'`)
- Cálculo de impostos parece correto (IR + PIS + COFINS sobre bruto)
- Falta integração real com gateway de pagamento
- IDOR potencial em `listarTransferencias` sem cooperativaId obrigatório

### 8.4 Clube de Vantagens Expandido — Avaliação Geral: 6.5/10
**Positivos:**
- Funil de conversão completo implementado
- Evolução mensal por nível funcionando
- Resumo mensal via WhatsApp para cooperados
- Analytics de distribuição por nível

**Negativos:**
- Ranking por período com métrica errada (CLB-01)
- Sem validação de ranges em `niveisConfig` (CLB-02)

---

## 9. ANÁLISE DE FLUXO — PORTAL COOPERADO (REVISÃO)

### 9.1 Indicações — MELHORADO
- Link de convite agora usa `/indicacoes/meu-link` (PC-01 CORRIGIDO)
- QR Code só renderiza após linkConvite ser carregado do backend (PC-02 CORRIGIDO)
- Benefícios incluem PENDENTE e PARCIAL (não mais só APLICADO)
- Progresso do Clube de Vantagens visível com barra e badge de nível

### 9.2 Financeiro — MELHORADO
- `valorAtualizado` exibido com destaque (vermelho)
- Valor original tachado
- Multa e juros detalhados por cobrança
- Bug FIN-08 100% resolvido

### 9.3 Desligamento — CORRIGIDO
- Erro de API agora bloqueia o checklist (conservador, como recomendado no QA anterior)

---

## 10. ANÁLISE DE FLUXO — WIZARD PARCEIRO

### WP-01: Step3Espera — CORRIGIDO
Commit 5b504a9 adicionou `if (!cooperativaId) return` antes de chamar a API. Sem travamento com cooperativaId undefined.

---

## 11. SCORE DE QUALIDADE POR MÓDULO

| Módulo | Score Anterior | Score Hoje | Delta | Justificativa |
|--------|--------------|------------|-------|---------------|
| Segurança / Auth | 7/10 | 6/10 | -1 | IDOR crítico em migracoes-usina (novos módulos) |
| Motor de Cobrança | 7/10 | 7/10 | = | Sem alterações. Multa/juros OK |
| WhatsApp / CRM | 4/10 | 4.5/10 | +0.5 | Timeout por msg implementado. Motor dinâmico ainda desativado |
| Wizard Membro | 6/10 | 6/10 | = | Sem alterações |
| Wizard Parceiro | 4/10 | 7/10 | +3 | WP-01 corrigido |
| MLM / Indicações | 7/10 | 8/10 | +1 | Link convite e QR code corrigidos. totalBeneficio melhorado |
| Portal Cooperado | 5/10 | 7/10 | +2 | Financeiro melhorado, desligamento seguro, indicações corretas |
| Portal Parceiro | 3/10 | 7/10 | +4 | Dashboard com dados reais via endpoint |
| Migrações Usina | N/A | 6/10 | NOVO | Transações OK, IDOR crítico, sem batch control |
| Modo Observador | N/A | 7.5/10 | NOVO | Bem implementado, poucos pontos de atenção |
| PIX Excedente | N/A | 4/10 | NOVO | Placeholder, cálculo OK, sem integração real |
| Clube de Vantagens | N/A | 6.5/10 | NOVO | Ranking com bug de métricas, resto bem feito |

**Score geral: 6.8 / 10** — Melhora incremental. Portais cooperado e parceiro bem evoluídos. Novos módulos introduzem vulnerabilidades de segurança que precisam atenção imediata.

---

## 12. PRIORIDADES DE CORREÇÃO

### 🔴 Prioridade 1 — Bloqueante (corrigir antes de qualquer release)

1. **SEC-05/MIG-01 — IDOR lista-concessionaria**: Adicionar validação de tenant em `gerarListaConcessionaria`.
   ```typescript
   // migracoes-usina.service.ts
   const usina = await this.prisma.usina.findFirst({
     where: { id: usinaId, cooperativaId: cooperativaId } // cooperativaId como parâmetro
   });
   if (!usina) throw new NotFoundException('Usina não encontrada ou sem acesso');
   ```
   Alterar controller para passar `req.user.cooperativaId` (ADMIN) ou null (SUPER_ADMIN).

2. **SEC-07/MIG-03 — Migração cross-tenant**: Verificar `cooperado.cooperativaId === dto.cooperativaId` no início de `migrarCooperado` e `ajustarKwh`.

### 🟠 Prioridade 2 — Alta (resolver neste sprint)

3. **MIG-02 — migrarTodosDeUsina sem throttle**: Implementar processamento em batches de 10 com await entre batches ou usar queue (Bull).

4. **CLB-01 — Ranking por período com métrica errada**: Para ranking mensal/anual real, usar `HistoricoProgressao` para calcular delta de kWh no período, não `kwhIndicadoAcumulado` total.

5. **PIX-01 — Status SIMULADO**: Clarificar na UI que é simulação. Criar issue para integração real. Evitar que admin confunda com transferência real.

6. **WZ-09 — SUPER_ADMIN sem cooperativaId**: Adicionar seletor de cooperativa no Step2Dados ou Step7Alocacao quando `req.user.perfil === SUPER_ADMIN`.

7. **WA-16 — Conversas mortas**: Criar `@Cron('0 4 * * *')` em `whatsapp-bot.service.ts` para resetar conversas `updatedAt > 24h` e estado `AGUARDANDO_*`.

### 🟡 Prioridade 3 — Média (backlog próximo sprint)

8. **CLB-02**: Validar ranges sobrepostos em `upsertConfig` (ordenar por `kwhMinimo` e verificar que `niveisConfig[i].kwhMaximo <= niveisConfig[i+1].kwhMinimo`).
9. **WZ-08**: Envolver os 4 passos do `finalizar()` em workflow transacional ou implementar rollback manual em caso de falha.
10. **PC-05**: Criar endpoint `/cooperados/meu-perfil/ucs/:id/historico` ou filtrar cobrancas por ucId no cliente.
11. **AUTH-01**: Verificar se JWT do proprietário inclui `cooperativaId` da usina principal.

---

## 13. RESUMO EXECUTIVO

### O que melhorou neste ciclo (26-27/03)

- **4 bugs críticos** do relatório anterior corrigidos (PC-01 link convite, PC-02 QR code, PC-03 desligamento, PP-01/PP-02 dashboard parceiro)
- **Portal Parceiro** passou de 3/10 para 7/10: dashboard com dados reais
- **Portal Cooperado** passou de 5/10 para 7/10: financeiro com multa/juros, indicações corretas
- **3 novos módulos** entregues: Migrações de Usina, Modo Observador, PIX Excedente

### O que precisa de atenção urgente

1. **IDOR crítico** em `/migracoes-usina/lista-concessionaria` — expõe CPF e dados de cooperados de outras cooperativas
2. **Migração cross-tenant** sem verificação de ownership do cooperado
3. **PIX Excedente** é placeholder mas pode ser confundido com funcionalidade real

### Métricas do ciclo

- Bugs críticos abertos: **2** (SEC-05, SEC-07 — novos IDOR)
- Bugs altos abertos: **7** (MIG-02, CLB-01, CLB-02, WZ-07, WZ-08, WA-15, WA-16)
- Bugs médios abertos: **5** (WZ-09, CLB-03, PIX-02, MIG-04, AUTH-01)
- Bugs corrigidos neste ciclo: **7**
- Novos bugs introduzidos: **11**

**Recomendação**: Sistema pode operar em beta controlado para portais cooperado/parceiro. Bloquear release público dos endpoints de migrações-usina até resolver SEC-05/SEC-07. PIX Excedente deve ter aviso de "em desenvolvimento" na UI.
