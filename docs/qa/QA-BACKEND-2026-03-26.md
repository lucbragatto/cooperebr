# QA-BACKEND — CoopereBR
**Data:** 2026-03-26  
**Revisor:** Agente QA Automatizado  
**Escopo:** Backend NestJS (`C:\Users\Luciano\cooperebr\backend\src`)  
**Módulos revisados:** clube-vantagens, condominios, cooperados, whatsapp, cobrancas, indicacoes, auth

---

## 📊 RESUMO EXECUTIVO

| Módulo | Crítico | Alto | Médio | Baixo | Score |
|--------|---------|------|-------|-------|-------|
| clube-vantagens | 0 | 2 | 4 | 1 | 5.5/10 |
| condominios | 2 | 1 | 3 | 1 | 3.5/10 |
| cooperados | 2 | 4 | 4 | 0 | 4.0/10 |
| whatsapp | 1 | 2 | 2 | 1 | 5.0/10 |
| cobrancas | 1 | 2 | 3 | 0 | 5.0/10 |
| indicacoes | 0 | 2 | 3 | 1 | 6.0/10 |
| auth/geral | 0 | 1 | 1 | 0 | 7.0/10 |

**TOTAL: 6 CRÍTICOS · 14 ALTOS · 20 MÉDIOS · 4 BAIXOS**

**Score geral do backend: 4.8/10 — NÃO PRONTO PARA PRODUÇÃO**

> Existem problemas de isolamento de dados multi-tenant (CRÍTICOS) que permitem que um ADMIN de uma cooperativa acesse/modifique dados de outra. Há também cálculo monetário incompleto no motor de cobrança (valorBruto = kWh, não R$) que geraria cobranças com valores errados.

---

## 1. MÓDULO: clube-vantagens

### BUG-CV-001 · ALTO
**Ausência de validação no `upsertConfig`**
- **Arquivo:** `clube-vantagens.controller.ts:19`
- **Descrição:** O endpoint `PUT /clube-vantagens/config` recebe `@Body() body: any` sem DTO nem class-validator. Aceita `niveisConfig` com `kwhMinimo` negativo, `beneficioPercentual > 100`, níveis duplicados, ou array vazio sem rejeição.
- **Impacto:** Configuração corrompida causa comportamento imprevisível na progressão de nível (todos ficam DIAMANTE ou nenhum progride).
- **Correção:** Criar `UpsertConfigClubeDto` com `@IsArray()`, `@ValidateNested({ each: true })`, `@Min(0)` em `kwhMinimo`, `@Min(0) @Max(100)` em `beneficioPercentual`.

### BUG-CV-002 · ALTO
**Race condition em `atualizarMetricas`**
- **Arquivo:** `clube-vantagens.service.ts:112`
- **Descrição:** `criarOuObterProgressao` + `progressaoClube.update({ increment })` executados sem transação. Se dois pagamentos chegarem simultaneamente para o mesmo `cooperadoId`, ambos passam pelo `findUnique`, um cria o registro, o outro falha silenciosamente ou sobrescreve.
- **Impacto:** kWh acumulado e receita de indicação podem ficar abaixo do real, prejudicando progressão de nível.
- **Correção:** Usar `prisma.$transaction()` englobando o create/update, ou usar `upsert` atômico com increment.

### BUG-CV-003 · MÉDIO
**Ranking por período (mes/ano) retorna kWh total, não do período**
- **Arquivo:** `clube-vantagens.service.ts:215`
- **Descrição:** `getRankingPorPeriodo` filtra por `dataUltimaAvaliacao >= dataInicio` mas ordena por `kwhIndicadoAcumulado` — o acumulado total de todos os tempos. Um cooperado avaliado no mês atual com 10.000 kWh históricos aparece acima de um que gerou 500 kWh só neste mês.
- **Impacto:** Ranking por mês/ano é funcionalmente idêntico ao ranking total — enganoso para o usuário.
- **Correção:** Usar `HistoricoProgressao.kwhAcumulado` comparando snapshots de início e fim do período, ou adicionar campo `kwhAcumuladoPeriodo` atualizado mensalmente.

### BUG-CV-004 · MÉDIO
**Funil: etapa "Cadastro concluído" sempre igual a "Indicações enviadas"**
- **Arquivo:** `clube-vantagens.service.ts:283`
- **Descrição:** `indicacoesCadastradas` e `totalIndicacoes` usam exatamente o mesmo `where: { ...whereIndicado }` — nenhum filtro adicional. Resultado: etapa 2 sempre mostra 100% de conversão.
- **Impacto:** Funil de conversão apresenta dados incorretos, tornando a métrica inútil para decisões.
- **Correção:** Para "cadastro concluído", filtrar indicações onde `cooperadoIndicado.status != 'PENDENTE'` ou onde o indicado completou docs/proposta.

### BUG-CV-005 · MÉDIO
**N+1 queries em `getEvolucaoMensalNiveis`**
- **Arquivo:** `clube-vantagens.service.ts:243`
- **Descrição:** Loop `for (let i = meses - 1; i >= 0; i--)` executa um `prisma.historicoProgressao.findMany()` por mês. Para `meses=12`, são 12 queries sequenciais.
- **Impacto:** Latência alta para admins que carregam o gráfico de evolução; piora com mais meses solicitados.
- **Correção:** Uma única query com `groupBy` por mês (`createdAt`) e `nivelNovo`, processando tudo em memória.

### BUG-CV-006 · MÉDIO
**`ClubeVantagensJob` duplica lógica do service `enviarResumosMensaisLote`**
- **Arquivo:** `clube-vantagens.job.ts:1` vs `clube-vantagens.service.ts:319`
- **Descrição:** O job implementa manualmente o mesmo loop que o service já possui como `enviarResumosMensaisLote()`. Qualquer correção em um não reflete no outro.
- **Impacto:** Risco de double-send no dia 1 do mês se ambos forem chamados; manutenção duplicada.
- **Correção:** O job deve chamar `this.clubeVantagensService.enviarResumosMensaisLote()`.

### BUG-CV-007 · BAIXO
**Nível nunca pode ser rebaixado mesmo após reconfiguração de thresholds**
- **Arquivo:** `clube-vantagens.service.ts:84`
- **Descrição:** Comentário e código explicitam "só promove, nunca rebaixa". Se admin reduzir `kwhMinimo` do OURO de 500 para 1000, cooperados já no nível OURO com 600 kWh ficam bloqueados nele para sempre.
- **Impacto:** Inconsistência entre configuração e estado real — baixo impacto financeiro imediato, mas problemático a longo prazo.
- **Correção:** Adicionar endpoint administrativo para forçar reavaliação completa de todos os cooperados.

---

## 2. MÓDULO: condominios + pix-excedente

### BUG-COND-001 · CRÍTICO
**`UPDATE /condominios/:id` e `DELETE /condominios/:id` sem isolamento de tenant**
- **Arquivo:** `condominios.controller.ts:34,40` / `condominios.service.ts:54,63`
- **Descrição:** O controller passa `id` para `update(id, body)` e `remove(id)` sem validar `cooperativaId`. O service só verifica se o registro existe, não se pertence à cooperativa do usuário autenticado.
- **Impacto:** CRÍTICO — ADMIN da Cooperativa A pode deletar ou editar condomínios da Cooperativa B enviando o UUID correto.
- **Correção:** Passar `req.user?.cooperativaId` para `update` e `remove`, verificando pertencimento no service antes de alterar.

### BUG-COND-002 · CRÍTICO
**`POST/DELETE /condominios/:id/unidades` sem isolamento de tenant**
- **Arquivo:** `condominios.controller.ts:46,52`
- **Descrição:** `adicionarUnidade(id, body)` busca o condomínio pelo id mas não verifica se pertence à cooperativa do usuário. `removerUnidade(unidadeId)` não tem nenhuma verificação de tenant.
- **Impacto:** CRÍTICO — ADMIN de cooperativa A pode adicionar/remover unidades de condomínios de outras cooperativas.
- **Correção:** Passar `req.user?.cooperativaId` para ambos os métodos e validar no service.

### BUG-COND-003 · ALTO
**`POST /condominios` permite override de `cooperativaId` pelo body**
- **Arquivo:** `condominios.controller.ts:22`
- **Descrição:** `cooperativaId: body.cooperativaId || req.user?.cooperativaId` — ADMIN pode criar condomínio em outra cooperativa enviando `cooperativaId` no body.
- **Impacto:** Condomínio criado em cooperativa errada; poluição de dados entre tenants.
- **Correção:** Ignorar `body.cooperativaId` para perfil ADMIN; usar apenas `req.user?.cooperativaId`. Manter override somente para SUPER_ADMIN.

### BUG-COND-004 · MÉDIO
**`processarExcedente` sem endpoint no controller**
- **Arquivo:** `condominios.service.ts:112`
- **Descrição:** O service implementa `processarExcedente(condominioId, valorExcedente)` com suporte a PIX_MENSAL, mas não há nenhuma rota no controller para chamá-lo. A funcionalidade de PIX excedente está implementada mas inacessível via API.
- **Impacto:** Feature de excedente (Fase 3) não funciona — nenhum cliente consegue usar.
- **Correção:** Adicionar `POST /condominios/:id/excedente` com body `{ valorExcedente: number }`.

### BUG-COND-005 · MÉDIO
**`calcularRateio` aceita `energiaTotal` negativa ou zero sem validação**
- **Arquivo:** `condominios.controller.ts:58` / `condominios.service.ts:73`
- **Descrição:** Não há validação de `energiaTotal > 0`. Com `energiaTotal = 0`, modelo IGUALITARIO retorna 0 kWh por unidade (sem erro); com valor negativo, retorna alocações negativas.
- **Impacto:** Cálculo de rateio silenciosamente errado com dados inválidos.
- **Correção:** Adicionar `@IsNumber() @Min(0.01)` no DTO ou validação no service.

### BUG-COND-006 · MÉDIO
**Rateio com arredondamento perde/ganha energia**
- **Arquivo:** `condominios.service.ts:83,95,107,120`
- **Descrição:** Todos os modelos usam `Math.round(valor * 100) / 100` independentemente por unidade. Para 3 unidades com 100 kWh cada uma recebendo 33.33..., o total alocado seria 99.99, não 100.
- **Impacto:** Pequena perda/ganho acumulada de energia por período; relevante em auditoria regulatória ANEEL.
- **Correção:** Alocar o residual na última unidade ou usar algoritmo de arredondamento bancário (round-half-even).

### BUG-COND-007 · BAIXO
**`findOne` retorna dados de cooperado (email, telefone) dentro da unidade sem filtragem**
- **Arquivo:** `condominios.service.ts:28`
- **Descrição:** Inclui `cooperado: { select: { id, nomeCompleto, email, telefone } }`. Qualquer ADMIN pode ver email e telefone de cooperados de outras cooperativas se souber o ID do condomínio.
- **Impacto:** Exposição de dados pessoais (LGPD).
- **Correção:** Verificar tenant isolation (já corrigido pelo BUG-COND-001) e avaliar se telefone/email são necessários no endpoint.

---

## 3. MÓDULO: cooperados

### BUG-COOP-001 · CRÍTICO
**`GET /cooperados/:id` expõe dados completos para role COOPERADO sem verificar pertencimento**
- **Arquivo:** `cooperados.controller.ts:49` / `cooperados.service.ts:370`
- **Descrição:** A rota aceita role COOPERADO e `findOne(id, cooperativaId)` valida apenas que o cooperado pertence à mesma cooperativa — não verifica se o `:id` corresponde ao próprio usuário logado. Um cooperado pode acessar contratos, cobranças e documentos de qualquer outro cooperado da mesma cooperativa.
- **Impacto:** CRÍTICO — Violação de privacidade, exposição de dados financeiros entre cooperados.
- **Correção:** Para role COOPERADO, verificar se `req.user?.cooperadoId === id`; caso contrário, retornar 403.

### BUG-COOP-002 · CRÍTICO
**`GET /cooperados/:id/checklist` expõe checklist de qualquer cooperado para role COOPERADO**
- **Arquivo:** `cooperados.controller.ts:44`
- **Descrição:** Mesmo problema — aceita COOPERADO sem verificar ownership do `:id`.
- **Impacto:** Cooperado vê status de documentos e contratos de outros membros.
- **Correção:** Mesmo fix do BUG-COOP-001.

### BUG-COOP-003 · ALTO
**`alterarStatusLote` não valida o campo `status`**
- **Arquivo:** `cooperados.controller.ts:113` / `cooperados.service.ts:855`
- **Descrição:** Body inline `{ cooperadoIds: string[]; status: string }` não usa DTO com class-validator. O service faz `data: { status: dto.status as any }` — qualquer string é aceita. Pode-se enviar `status: "HACKED"` e corromper dados.
- **Impacto:** Status inválido no banco; pode quebrar filtros e lógica de negócio downstream.
- **Correção:** Criar DTO com `@IsEnum(StatusCooperado)` para o campo `status`.

### BUG-COOP-004 · ALTO
**Operações em lote (`batch/*` e `lote/*`) sem validação de DTO — nenhum campo validado**
- **Arquivo:** `cooperados.controller.ts:92-135`
- **Descrição:** Todos os 6 endpoints de lote usam `@Body() body: { ... }` inline sem decorators de validação. `mensagem` pode ser vazia, `percentual` pode ser 99999, `cooperadoIds` pode ter milhares de IDs, `mesReferencia` pode ter formato inválido.
- **Impacto:** Possibilidade de spam em branco para 50 cooperados, reajuste de +99999% em contratos, loops infinitos no processamento.
- **Correção:** Criar DTOs dedicados com `@IsArray() @ArrayMaxSize(100)`, `@IsNumber() @Min(-50) @Max(50)` no percentual, `@IsNotEmpty()` na mensagem.

### BUG-COOP-005 · ALTO
**`atualizarMeuPerfil` permite trocar e-mail sem verificação de unicidade**
- **Arquivo:** `cooperados.service.ts:196`
- **Descrição:** O cooperado pode mudar seu email para o email de outro cooperado. O Prisma vai lançar um `P2002 unique constraint error` não tratado, retornando 500 ao invés de 409/400.
- **Impacto:** Erro 500 inesperado; em bancos sem constraint única no email, dois cooperados podem ter o mesmo email.
- **Correção:** Verificar `prisma.cooperado.findFirst({ where: { email: dto.email, NOT: { id: cooperado.id } } })` antes de atualizar; tratar `P2002`.

### BUG-COOP-006 · ALTO
**`remove` deleta cooperado permanentemente — sem soft delete**
- **Arquivo:** `cooperados.service.ts:435`
- **Descrição:** `prisma.cooperado.delete({ where: { id } })` é uma deleção física. Embora haja checks de contratos/cobranças pendentes, não garante integridade de histórico (indicações, benefícios, ocorrências, etc.).
- **Impacto:** Dados históricos orfinados; indicações de MLM ficam sem indicador; registros de auditoria perdidos.
- **Correção:** Usar soft delete (`ativo: false` ou `deletedAt: Date`) em vez de delete físico.

### BUG-COOP-007 · MÉDIO
**`checkProntoParaAtivar` inconsistência: `pronto` não inclui o 5º item do checklist**
- **Arquivo:** `cooperados.service.ts:612`
- **Descrição:** `findAll` calcula `checklistTotal = 5` incluindo `ativoRecebendo`, mas `getChecklist` retorna `pronto: faturaProcessada > 0 && docAprovado > 0 && contrato > 0 && proposta > 0` (apenas 4 itens). Um cooperado no estado `ATIVO` mas não `ATIVO_RECEBENDO_CREDITOS` aparece como "pronto" no checklist mas não no listing.
- **Impacto:** Frontend pode mostrar informações conflitantes sobre o status de onboarding.

### BUG-COOP-008 · MÉDIO
**Fila de espera retorna cooperados sem UC associada**
- **Arquivo:** `cooperados.service.ts:647`
- **Descrição:** `filaEspera` filtra por `status: 'APROVADO'` sem `contratos: { none: { status: 'ATIVO' } }` para verificar UC. Se `c.ucs[0]` for null, `uc` e `distribuidora` retornam null — o cooperado aparece na fila mas não pode ser alocado.
- **Impacto:** Confusão operacional; admins tentam alocar cooperados sem UC cadastrada.

### BUG-COOP-009 · MÉDIO
**`uploadMeuDocumento` sem validação de tipo de arquivo**
- **Arquivo:** `cooperados.service.ts:213`
- **Descrição:** O upload para Supabase aceita qualquer `mimeType` sem verificação. Um cooperado pode enviar `.exe`, `.js` ou qualquer arquivo malicioso como "documento".
- **Impacto:** Armazenamento de arquivos maliciosos no bucket; risco de segurança se URLs públicas forem abertas por admins.
- **Correção:** Validar `arquivo.mimetype` contra lista branca (`['image/jpeg','image/png','application/pdf']`).

### BUG-COOP-010 · MÉDIO
**`meuPerfil` inclui dados sensíveis sem filtragem — `indicacoesFeitas` expõe status de outros cooperados**
- **Arquivo:** `cooperados.service.ts:56`
- **Descrição:** `indicacoesFeitas` inclui `cooperadoIndicado: { select: { nomeCompleto, status, createdAt } }`. O cooperado logado pode ver o status de cadastro/aprovação dos cooperados que indicou — dados que podem não dever ser visíveis.
- **Impacto:** Exposição de status interno de outros cooperados (menor, mas relevante para LGPD).

---

## 4. MÓDULO: whatsapp

### BUG-WA-001 · CRÍTICO
**`POST /whatsapp/webhook-incoming` público sem autenticação nem validação de origem**
- **Arquivo:** `whatsapp-fatura.controller.ts:36`
- **Descrição:** O webhook tem `@Public()` e aceita qualquer body `{ telefone, tipo, corpo, ... }`. Não há verificação de secret key, HMAC, ou IP whitelist. Qualquer pessoa na internet pode enviar mensagens simulando qualquer número de telefone, manipulando o estado da conversa de qualquer cooperado.
- **Impacto:** CRÍTICO — Atacante pode criar cadastros falsos, acessar menus de cooperados existentes, disparar notificações, poluir banco de mensagens.
- **Correção:** Adicionar verificação de token secreto no header (`X-Webhook-Secret`) ou verificação HMAC similar ao WhatsApp Cloud API.

### BUG-WA-002 · ALTO
**Status `'VENCIDA'` vs `'VENCIDO'` — typo que quebra exibição de fatura no bot**
- **Arquivo:** `whatsapp-bot.service.ts:284`
- **Descrição:** Query filtra `status: { in: ['PENDENTE', 'VENCIDA'] }` mas o enum/valor real no banco é `'VENCIDO'` (conforme `cobrancas.job.ts:26`). Cobranças vencidas nunca são encontradas no menu do cooperado.
- **Impacto:** ALTO — Cooperado que deve faturas vencidas recebe "Você não tem faturas pendentes" — falsa informação que prejudica cobrança.
- **Correção:** Corrigir para `'VENCIDO'`.

### BUG-WA-003 · ALTO
**Número de telefone hardcoded em mensagem enviada a clientes**
- **Arquivo:** `whatsapp-bot.service.ts:352`
- **Descrição:** Mensagem enviada ao usuário contém `"ligue: (27) 9XXXX-XXXX"` — placeholder de desenvolvimento exposto em produção.
- **Impacto:** ALTO — Clientes recebem número fictício; falha de suporte em momento crítico.
- **Correção:** Usar `process.env.TELEFONE_SUPORTE` ou buscar do `ConfigTenantService`.

### BUG-WA-004 · MÉDIO
**`GET /whatsapp/conversas` sem filtro de tenant**
- **Arquivo:** `whatsapp-fatura.controller.ts:67`
- **Descrição:** Retorna as últimas 50 conversas globais sem filtrar por `cooperativaId`. ADMIN da Cooperativa A vê conversas de leads da Cooperativa B.
- **Impacto:** Vazamento de dados de leads entre cooperativas (LGPD).
- **Correção:** Adicionar `where: { cooperativaId: req.user?.cooperativaId }` — requer que a `conversaWhatsapp` armazene `cooperativaId`.

### BUG-WA-005 · MÉDIO
**Motor dinâmico `WhatsappFluxoMotorService` comentado e inutilizado**
- **Arquivo:** `whatsapp-bot.service.ts:95`
- **Descrição:** Bloco `// TODO: reativar quando motor dinâmico for corrigido` — serviço injetado mas completamente desabilitado. Toda a configuração dinâmica de fluxos no banco não tem efeito.
- **Impacto:** Feature implementada e não funciona; injeção de dependência desnecessária; confusão para novos desenvolvedores.
- **Correção:** Ou corrigir e reativar, ou remover o serviço do módulo.

### BUG-WA-006 · BAIXO
**`notificarResumoMensal` em `WhatsappNotificacoesService` e `ClubeVantagensService` chamam o mesmo método mas com tipo ligeiramente diferente**
- **Arquivo:** `whatsapp-notificacoes.service.ts:72` vs `clube-vantagens.service.ts:345`
- **Descrição:** Ambos chamam `cicloVida.notificarResumoMensal` mas `WhatsappNotificacoesService` é um façade que nunca é usado diretamente — apenas `WhatsappCicloVidaService` é injetado diretamente nos serviços. Fachada subutilizada.
- **Impacto:** Baixo — código morto, mas não causa bugs diretos.

---

## 5. MÓDULO: cobrancas

### BUG-COB-001 · CRÍTICO
**`calcularCobrancaMensal` retorna kWh como valor monetário (R$) — cálculo incompleto**
- **Arquivo:** `cobrancas.service.ts:243`
- **Descrição:** Comentário explícito: `"const valorBruto = kwhEntregue; // placeholder: kWh entregue (será multiplicado por tarifa no item 6)"`. O "item 6" nunca foi implementado. `valorBruto`, `valorDesconto` e `valorLiquido` são numericamente iguais aos kWh, não a valores em R$.
- **Impacto:** CRÍTICO — Cobranças geradas via motor de cálculo têm valores em R$ iguais ao kWh (ex: 350 kWh → R$350, em vez de ~R$175 com tarifa de R$0,50/kWh). Faturamento completamente incorreto.
- **Correção:** Implementar multiplicação por tarifa (`kwhEntregue * tarifaKwh`) usando `ConfiguracaoCobrancaService` ou campo `tarifaKwh` da usina/cooperativa.

### BUG-COB-002 · ALTO
**`darBaixa` sem transação — risco de inconsistência financeira**
- **Arquivo:** `cobrancas.service.ts:150`
- **Descrição:** Três operações críticas executadas sequencialmente sem `prisma.$transaction()`:
  1. `cobranca.update({ status: 'PAGO' })`
  2. `lancamentoCaixa.create()`
  3. Atualização Clube de Vantagens
  Se a criação do `LancamentoCaixa` falhar após o status já ter sido marcado como PAGO, a cobrança aparece paga mas sem registro financeiro. O catch atual apenas loga um warning.
- **Impacto:** ALTO — Inconsistência financeira entre cobranças pagas e caixa; auditoria contábil falha.
- **Correção:** Envolver operações 1 e 2 em `prisma.$transaction()`. Clube de Vantagens pode ficar fora da transação (é eventual).

### BUG-COB-003 · ALTO
**`DELETE /cobrancas/:id` deleta registro financeiro sem checks de estado**
- **Arquivo:** `cobrancas.controller.ts:65` / `cobrancas.service.ts:276`
- **Descrição:** `remove(id)` faz `prisma.cobranca.delete()` sem verificar se a cobrança está PAGA ou tem `LancamentoCaixa` associado. Contratos e históricos ficam orfinados.
- **Impacto:** ALTO — Destruição de registros financeiros históricos; violação de auditoria.
- **Correção:** Não permitir deleção de cobranças PAGAS. Para PENDENTE/CANCELADO, usar soft delete ou manter o registro.

### BUG-COB-004 · MÉDIO
**`GET /cobrancas/contrato/:contratoId` — COOPERADO pode ver cobranças de qualquer contrato**
- **Arquivo:** `cobrancas.controller.ts:27`
- **Descrição:** `findByContrato(contratoId)` não verifica se o contrato pertence ao cooperado autenticado. Qualquer cooperado com um `contratoId` válido (adivinhado ou obtido por BUG-COOP-001) acessa cobranças de outros.
- **Impacto:** Exposição de dados financeiros de outros cooperados.
- **Correção:** Para role COOPERADO, verificar que o contrato pertence ao `cooperadoId` do token JWT.

### BUG-COB-005 · MÉDIO
**`PUT /cobrancas/:id` sem isolamento de tenant**
- **Arquivo:** `cobrancas.controller.ts:52` / `cobrancas.service.ts:131`
- **Descrição:** `update(id, body)` não verifica `cooperativaId`. ADMIN de cooperativa A pode alterar valores de cobranças da cooperativa B.
- **Impacto:** Manipulação de dados financeiros entre tenants.
- **Correção:** Verificar `cobranca.cooperativaId === req.user?.cooperativaId` antes de atualizar.

### BUG-COB-006 · MÉDIO
**`calcularMultaJuros` job — multa recalculada todos os dias desnecessariamente**
- **Arquivo:** `cobrancas.job.ts:71`
- **Descrição:** O job de multa/juros roda diariamente e recalcula `valorMulta` toda vez para cobranças já vencidas. A multa (percentual fixo) não muda após o primeiro vencimento — recalcular é desperdício e pode causar inconsistências se a config da cooperativa mudar.
- **Impacto:** Médio — Performance degradada com muitas cobranças vencidas; risco de multa retroativamente diferente se config mudar.
- **Correção:** Adicionar flag `multaCalculada: boolean` ou só calcular se `valorMulta IS NULL`.

---

## 6. MÓDULO: indicacoes (MLM)

### BUG-IND-001 · ALTO
**Race condition em `registrarIndicacao` — sem transação na criação da cadeia MLM**
- **Arquivo:** `indicacoes.service.ts:128`
- **Descrição:** A verificação `existente = findFirst({ where: { cooperadoIndicadoId, nivel: 1 } })` e a criação da indicação são operações separadas. Duas chamadas simultâneas (ex: webhook de convite disparando duas vezes) podem passar pela verificação e criar indicações duplicadas de nível 1 para o mesmo indicado.
- **Impacto:** ALTO — Indicado com dois indicadores de nível 1; benefícios duplicados; inconsistência no MLM.
- **Correção:** Usar `prisma.$transaction()` com nível de isolamento `Serializable`, ou constraint `UNIQUE(cooperadoIndicadoId, nivel)` no banco.

### BUG-IND-002 · ALTO
**`POST /indicacoes/processar-pagamento` sem validação de `valorFatura`**
- **Arquivo:** `indicacoes.controller.ts:75`
- **Descrição:** `{ cooperadoId: string; valorFatura: number }` sem DTO. `valorFatura` pode ser 0, negativo, ou extremamente alto. Com `valorFatura = 0`, benefícios de 10% = R$0 são criados sem erro. Com valor astronômico, benefícios inflados são gerados.
- **Impacto:** ALTO — Manipulação de benefícios MLM via endpoint admin.
- **Correção:** Criar DTO com `@IsNumber() @Min(0.01) @Max(50000)` e verificar que existe cobrança paga para o cooperado.

### BUG-IND-003 · MÉDIO
**`aplicarBeneficiosNoFechamento` não tem endpoint exposto — método inacessível**
- **Arquivo:** `indicacoes.service.ts:246`
- **Descrição:** O método com transação correta para aplicar benefícios no fechamento mensal existe no service mas não há rota no controller e não é chamado por nenhum job agendado.
- **Impacto:** Benefícios MLM nunca são aplicados automaticamente; feature completa mas sem trigger.
- **Correção:** Adicionar job mensal ou chamar no `darBaixa` de cobrancas (verificar se cooperado tem benefícios pendentes).

### BUG-IND-004 · MÉDIO
**`gerarCodigo()` usa `Math.random()` — não criptograficamente seguro**
- **Arquivo:** `indicacoes.service.ts:118`
- **Descrição:** Códigos de 8 caracteres alfanuméricos gerados com `Math.random()`. Em alguns ambientes Node.js, a seed pode ser previsível. Sem verificação de colisão no banco antes de salvar.
- **Impacto:** Risco de colisão de código (dois cooperados com mesmo código) e previsibilidade em ambientes de alta carga.
- **Correção:** Usar `crypto.randomBytes(6).toString('base64url').slice(0,8).toUpperCase()` e verificar unicidade no banco com retry.

### BUG-IND-005 · MÉDIO
**`getArvore` retorna dados de indicados de TODAS as cooperativas para SUPER_ADMIN sem req de filtro explícito**
- **Arquivo:** `indicacoes.controller.ts:33`
- **Descrição:** `getArvore(req.user?.cooperativaId)` — para SUPER_ADMIN, `cooperativaId` pode ser undefined, retornando TODA a árvore MLM de todas as cooperativas em uma query. Performance crítica em produção com muitos cooperados.
- **Impacto:** Query potencialmente enorme; timeout possível; dados misturados de múltiplas cooperativas.
- **Correção:** Adicionar paginação e exigir `cooperativaId` explícito como query param.

### BUG-IND-006 · BAIXO
**Benefício `REAIS_KWH_RECORRENTE` criado com `valorCalculado = reaisKwh` independente do kWh real**
- **Arquivo:** `indicacoes.service.ts:215`
- **Descrição:** Na modalidade `REAIS_KWH_RECORRENTE`, o benefício é calculado como `valorKwh = reaisKwh` (o valor por kWh da config), sem multiplicar pelo kWh efetivamente entregue. O nome sugere "R$ por kWh × kWh gerado" mas o cálculo ignora o volume.
- **Impacto:** Benefício fixo independente de quanto o indicado consumiu — semanticamente errado para a modalidade "por kWh".
- **Correção:** Multiplicar `reaisKwh × kwhEntregue` (necessário buscar do contrato/cobrança).

---

## 7. AUTH / SEGURANÇA GERAL

### BUG-AUTH-001 · ALTO
**`RolesGuard` permite acesso irrestrito a rotas sem `@Roles()` para qualquer usuário autenticado**
- **Arquivo:** `auth/roles.guard.ts:24`
- **Descrição:** Comentário no código: `"Sem @Roles(): rota autenticada mas sem restrição de perfil"`. Se um developer esquecer de adicionar `@Roles()` a um endpoint, qualquer usuário autenticado (inclusive COOPERADO) tem acesso.
- **Impacto:** ALTO — Risco latente: novos endpoints adicionados sem `@Roles()` ficam abertos. Requer inspeção de todos os controllers para garantir cobertura.
- **Correção:** Inverter o padrão: rotas sem `@Roles()` devem exigir pelo menos ADMIN. Ou ativar `@UseGuards(RolesGuard)` globalmente com perfil mínimo padrão.

### BUG-AUTH-002 · MÉDIO
**`findCooperadoByUsuario` usa `findFirst({ OR: [email, cpf] })` — sem verificação de cooperativa**
- **Arquivo:** `cooperados.service.ts:188`
- **Descrição:** Um usuário com email `a@a.com` na Cooperativa X encontra o cooperado `a@a.com` da Cooperativa Y (multi-tenant) se emails não forem únicos globalmente. O `meuPerfil`, `minhasUcs`, etc. podem retornar dados do cooperado errado.
- **Impacto:** MÉDIO — Depende da unicidade global de emails no banco. Se houver constraint unique global no email, não há problema prático.
- **Verificação necessária:** Revisar schema Prisma para confirmar `email @unique` no modelo `Cooperado`.

---

## 🔧 RECOMENDAÇÕES PRIORITÁRIAS

### Prioridade 1 — IMEDIATO (bloquear deploy)

1. **[BUG-COB-001]** Implementar cálculo monetário real no motor de cobrança — `valorBruto = kwhEntregue × tarifaKwh`. Toda cobrança gerada pelo motor está com valor errado.

2. **[BUG-COND-001/002]** Adicionar verificação de tenant em `update`, `remove`, `adicionarUnidade`, `removerUnidade` nos condomínios.

3. **[BUG-COOP-001/002]** Restringir acesso de COOPERADO a `GET /cooperados/:id` e `/:id/checklist` ao próprio registro.

4. **[BUG-WA-001]** Adicionar autenticação no webhook do WhatsApp — token secreto validado no header.

5. **[BUG-WA-002]** Corrigir typo `'VENCIDA'` → `'VENCIDO'` na query do bot.

### Prioridade 2 — SPRINT ATUAL

6. **[BUG-COOP-003/004]** Criar DTOs com validação para todos os endpoints de lote (`batch/*`, `lote/*`).

7. **[BUG-COB-002]** Envolver `darBaixa` em transação para garantir consistência entre cobrança e caixa.

8. **[BUG-IND-001]** Usar transação ou constraint unique no banco para evitar duplicação de indicações MLM.

9. **[BUG-WA-003]** Substituir número hardcoded por variável de ambiente `TELEFONE_SUPORTE`.

10. **[BUG-COND-003]** Ignorar `cooperativaId` do body para perfil ADMIN na criação de condomínios.

### Prioridade 3 — BACKLOG TÉCNICO

11. **[BUG-IND-003]** Criar job ou trigger para `aplicarBeneficiosNoFechamento` — sem isso, benefícios MLM nunca são aplicados automaticamente.

12. **[BUG-COND-004]** Expor endpoint `POST /condominios/:id/excedente` para a feature de PIX excedente funcionar.

13. **[BUG-CV-004]** Corrigir funil de conversão — etapa "cadastro concluído" precisa de filtro real.

14. **[BUG-IND-004]** Substituir `Math.random()` por `crypto.randomBytes` na geração de código de indicação.

15. **[BUG-COB-003]** Proteger `DELETE /cobrancas/:id` contra deleção de cobranças pagas.

---

## 📋 NOTAS DE TESTE MANUAL RECOMENDADAS

Além dos bugs identificados por análise estática, recomendo os seguintes testes manuais antes do deploy:

1. **Multi-tenant leak test:** Login como ADMIN da Cooperativa A → tentar `PATCH /condominios/<id-de-B>` com body válido. Deve retornar 403, não 200.

2. **COOPERADO isolation test:** Login como cooperado → `GET /cooperados/<id-de-outro-cooperado>`. Deve retornar 403.

3. **Webhook spoofing test:** `POST /whatsapp/webhook-incoming` com `telefone` de um cooperado ativo e `corpo: "1"`. Deve requerer autenticação.

4. **Cobrança motor test:** Criar contrato com usina e geração mensal → chamar cálculo → verificar se `valorLiquido` faz sentido em R$ (não igual ao kWh entregue).

5. **Benefício MLM test:** Criar indicação → simular primeira fatura paga → verificar se `aplicarBeneficiosNoFechamento` é chamado em algum momento.

---

*Gerado automaticamente em 2026-03-26 por Agente QA CoopereBR*
