# Relatório QA — Módulo de Cooperados

**Data:** 2026-03-20
**Escopo:** backend/src/cooperados/, backend/src/motor-proposta/, backend/src/contratos/, backend/prisma/schema.prisma, web/app/dashboard/cooperados/

---

## 1. BUGS

### BUG-01: percentualUsina sobrescrito — apenas último contrato é considerado
**Arquivo:** `backend/src/cooperados/cooperados.service.ts:79-85`
Ao ativar cooperado com múltiplos contratos, o loop `for (const c of contratos)` calcula o `percentualUsina` para cada contrato e sobrescreve o valor anterior. O resultado final será apenas o percentual do **último** contrato iterado, não a soma de todos.
```ts
for (const c of contratos) {
  // cada iteração sobrescreve o valor anterior no cooperado
  await this.prisma.cooperado.update({
    where: { id },
    data: { percentualUsina: Math.round(percentual * 10000) / 10000 },
  });
}
```
**Correção sugerida:** Somar os percentuais de todos os contratos e gravar uma única vez, ou armazenar `percentualUsina` por contrato.

### BUG-02: outlierDetectado hardcoded como false na proposta aceita
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:226`
Ao gravar a proposta aceita, `outlierDetectado` é sempre `false`, mesmo que o cálculo tenha detectado outlier. O valor correto deveria vir do resultado do cálculo.
```ts
outlierDetectado: false, // deveria ser: resultado do cálculo real
```

### BUG-03: excluirProposta busca contratos por janela de tempo frágil
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:365-370`
Ao excluir proposta aceita, os contratos associados são buscados por `cooperadoId` + `createdAt >= proposta.createdAt - 60s`. Isso é frágil: se dois contratos foram criados próximos no tempo (batch), pode cancelar contratos indevidos. Deveria haver uma FK direta `propostaId` no contrato.

### BUG-04: delete de cooperado sem cascata causa erro de FK
**Arquivo:** `backend/src/cooperados/cooperados.service.ts:110-113`
`remove()` faz `prisma.cooperado.delete()` direto, mas o schema tem múltiplas FKs (contratos, UCs, documentos, propostas, cobranças, lista espera) sem `onDelete: Cascade`. Isso causará erro de constraint violation no banco.

### BUG-05: delete de contrato sem cascata causa erro de FK
**Arquivo:** `backend/src/contratos/contratos.service.ts:103-105`
`remove()` faz `prisma.contrato.delete()` direto, mas contratos têm cobranças e lista de espera associados. Causará erro de FK.

### BUG-06: Race condition na geração de número de contrato
**Arquivo:** `backend/src/contratos/contratos.service.ts:58-64` e `backend/src/motor-proposta/motor-proposta.service.ts:301-307`
A geração do número sequencial (`CTR-YYYY-XXXX`) busca o último número e incrementa sem lock/transação. Duas requisições concorrentes podem gerar o mesmo número, violando o `@unique` e causando erro 500. Esse código é **duplicado** nos dois arquivos.

### BUG-07: Ordenação de número de contrato por string
**Arquivo:** `backend/src/contratos/contratos.service.ts:61` e `motor-proposta.service.ts:304`
`orderBy: { numero: 'desc' }` ordena como string: `CTR-2026-9` vem **depois** de `CTR-2026-10000`. Embora o padStart(4, '0') mitigue para < 10000 contratos, a partir de 10000 a ordem quebra.

### BUG-08: Cobrança sempre associada ao primeiro contrato
**Arquivo:** `web/app/dashboard/cooperados/[id]/page.tsx:338`
```ts
const contratoId = cooperado?.contratos?.[0]?.id;
```
A nova cobrança é sempre criada no primeiro contrato da lista, ignorando a possibilidade do cooperado ter múltiplos contratos. O usuário deveria poder escolher em qual contrato criar a cobrança.

### BUG-09: Cobranças exibidas apenas do primeiro contrato
**Arquivo:** `web/app/dashboard/cooperados/[id]/page.tsx:606-607`
```ts
const contrato = cooperado?.contratos?.[0] ?? null;
const cobrancas = contrato?.cobrancas ?? [];
```
A aba "Cobranças" mostra apenas as cobranças do primeiro contrato. Cooperados com múltiplos contratos terão cobranças invisíveis.

### BUG-10: Validação de contrato existente ignora status PENDENTE_ATIVACAO na mensagem
**Arquivo:** `backend/src/contratos/contratos.service.ts:53-55`
A mensagem de erro diz "ativo" ou "em lista de espera", mas PENDENTE_ATIVACAO é tratado como "ativo" no display, o que pode confundir.

---

## 2. DADOS AUSENTES

### DA-01: Cooperado sem campos de endereço
**Arquivo:** `backend/prisma/schema.prisma:33-60`
O modelo `Cooperado` não tem endereço (rua, cidade, estado, CEP). Dados essenciais para correspondência e conformidade fiscal.

### DA-02: Cooperado sem data de nascimento
**Arquivo:** `backend/prisma/schema.prisma:33-60`
Não há campo `dataNascimento`. Necessário para validação de maioridade e conformidade regulatória.

### DA-03: Cooperado sem campo CNPJ / razão social
**Arquivo:** `backend/prisma/schema.prisma:33-60`
O campo `cpf` é obrigatório, mas o sistema aceita pessoa jurídica (tipo CONTRATO_SOCIAL nos documentos). Falta distinção entre CPF/CNPJ e campos como `razaoSocial`, `nomeFantasia`, `inscricaoEstadual`.

### DA-04: Interface frontend Cooperado incompleta
**Arquivo:** `web/types/index.ts:32-41`
A interface `Cooperado` no frontend não inclui `tipoCooperado`, `preferenciaCobranca`, `termoAdesaoAceito`, `termoAdesaoAceitoEm`, `cotaKwhMensal`, `percentualUsina`, `documento`, `tipoDocumento` — campos que existem no schema Prisma e são usados na página de detalhe.

### DA-05: Contrato sem campo kwhContrato na interface frontend
**Arquivo:** `web/types/index.ts:73-88`
A interface `Contrato` no frontend não inclui `kwhContrato`, `planoId`, `modeloCobrancaOverride` — campos existentes no schema.

### DA-06: Sem histórico de alterações / audit trail
**Arquivo:** Todos os módulos
Nenhuma entidade do sistema possui registro de quem fez cada alteração (userId, motivo). Alterações de status de cooperado, contrato, cobrança e documentos não são rastreáveis.

### DA-07: Cooperado sem campo de observações/notas
**Arquivo:** `backend/prisma/schema.prisma:33-60`
Não há campo para anotações internas do admin sobre o cooperado.

### DA-08: Cobrança sem campo de observação
**Arquivo:** `backend/prisma/schema.prisma:221-238`
Não há campo `observacao` na model Cobranca para anotar motivos de cancelamento, parciais, etc.

---

## 3. REGRAS DE NEGÓCIO AUSENTES

### RN-01: Sem validação de CPF/CNPJ
**Arquivo:** `backend/src/cooperados/cooperados.service.ts:38-49`
O método `create()` não valida se o CPF é válido (dígitos verificadores) nem se é um CNPJ válido para PJ.

### RN-02: Sem validação de email
**Arquivo:** `backend/src/cooperados/cooperados.service.ts:38-49`
Não há validação de formato de email. Não há envio de email de confirmação.

### RN-03: Sem verificação de duplicidade de CPF/email no create
**Arquivo:** `backend/src/cooperados/cooperados.service.ts:48`
Embora o schema tenha `@unique` em `cpf` e `email`, o service não trata o erro de duplicidade antes de enviar ao banco, resultando em um erro 500 genérico ao invés de uma mensagem amigável.

### RN-04: Sem controle de transição de status do cooperado
**Arquivo:** `backend/src/cooperados/cooperados.service.ts:51-108`
Qualquer transição de status é permitida (ex: ENCERRADO → PENDENTE, SUSPENSO → ENCERRADO). Deveria haver uma máquina de estados validada.

### RN-05: Sem controle de transição de status do contrato
**Arquivo:** `backend/src/contratos/contratos.service.ts:83-101`
O `update()` aceita qualquer status sem validar transições válidas.

### RN-06: Sem reativação em cascata do cooperado
**Arquivo:** `backend/src/cooperados/cooperados.service.ts:99-105`
Ao suspender, contratos ATIVO → SUSPENSO. Mas ao mudar de SUSPENSO de volta para ATIVO, os contratos SUSPENSO não voltam para ATIVO. A cascata é unidirecional.

### RN-07: Sem bloqueio de exclusão de cooperado com contratos ativos
**Arquivo:** `backend/src/cooperados/cooperados.service.ts:110-113`
Permitir deletar cooperado com contratos ativos, cobranças pendentes ou propostas aceitas causaria problemas graves de integridade.

### RN-08: Sem bloqueio de exclusão de contrato com cobranças pendentes
**Arquivo:** `backend/src/contratos/contratos.service.ts:103-105`
Deveria impedir excluir contrato que tenha cobranças PENDENTE ou VENCIDO.

### RN-09: Sem validação de proposta expirada
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:190-357`
A proposta tem campo `validaAte` (30 dias), mas `aceitar()` não verifica se a proposta anterior já expirou antes de criar o contrato. É possível aceitar uma proposta com dados de tarifa desatualizados.

### RN-10: Sem recálculo automático de cotaKwhMensal
**Arquivo:** `backend/src/cooperados/cooperados.service.ts`
O campo `cotaKwhMensal` nunca é preenchido automaticamente quando um contrato é ativado. O `kwhContrato` do contrato deveria alimentar esse campo.

### RN-11: Sem verificação de capacidade da usina ao criar contrato manualmente
**Arquivo:** `backend/src/contratos/contratos.service.ts:34-81`
O `create()` do ContratosService não valida se a usina tem capacidade disponível para o kWh do contrato. Apenas o motor de proposta faz essa verificação.

### RN-12: Sem geração automática de cobranças recorrentes
**Arquivo:** Nenhum arquivo implementa geração automática de cobranças mensais para contratos ativos.

### RN-13: Sem detecção automática de cobranças vencidas
**Arquivo:** Não há job/cron para marcar cobranças PENDENTE como VENCIDO quando `dataVencimento < now()`.

### RN-14: Sem notificação ao cooperado sobre cobrança próxima do vencimento
**Arquivo:** Não há mecanismo de alerta/notificação para cobranças prestes a vencer.

---

## 4. REGRAS DEFEITUOSAS

### RD-01: Desconto aplicado sobre TUSD+TE, não sobre valor total da fatura
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:110`
```ts
let descontoAbsoluto = tarifaUnitSemTrib * (descontoPercentual / 100);
```
O desconto é calculado sobre `tarifaUnitSemTrib` (TUSD+TE), não sobre o valor total da fatura do cooperado. Isso é **intencional** (protege margem da cooperativa), mas pode gerar confusão quando o frontend apresenta "20% de desconto" — o cooperado pode interpretar como 20% da conta total.
**Nota:** Confirmar que a comunicação ao cooperado é clara sobre a base do desconto.

### RD-02: Média cooperativa calculada de forma inconsistente
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:79-86` (calcular) vs `552-570` (dashboardStats)
No `calcular()`, a média é baseada em `valorLiquido / kwhContrato` das cobranças ativas.
No `dashboardStats()`, a média é baseada em `cotaKwhMensal` dos cooperados ativos.
São métricas completamente diferentes com o mesmo nome `mediaCooperativaKwh`.

### RD-03: Ajuste de desconto pode ultrapassar o desconto máximo indiretamente
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:114-119`
A lógica `AUMENTAR_DESCONTO` tenta igualar o `valorCooperado` à `mediaCooperativaKwh`, mas o `Math.min(descontoNecessario, descontoMax)` pode não ser suficiente se a media cooperativa for muito baixa — o cooperado fica com valor acima da média mesmo após o ajuste máximo, sem feedback ao operador.

### RD-04: Encerramento de contrato não reverte percentualUsina
**Arquivo:** `backend/src/cooperados/cooperados.service.ts` e `backend/src/contratos/contratos.service.ts:100`
Ao encerrar um contrato, o `percentualUsina` do cooperado não é recalculado. O cooperado ficará com um percentual incorreto.

### RD-05: Suspensão em cascata não trata contratos PENDENTE_ATIVACAO
**Arquivo:** `backend/src/cooperados/cooperados.service.ts:100-104`
Ao suspender cooperado, apenas contratos `ATIVO` são suspensos. Contratos `PENDENTE_ATIVACAO` permanecem nesse status, potencialmente sendo ativados indevidamente.

### RD-06: Controller aceita `body: any` sem DTO validation
**Arquivo:** `backend/src/cooperados/cooperados.controller.ts:46` e `backend/src/contratos/contratos.controller.ts:50`
```ts
@Put(':id')
update(@Param('id') id: string, @Body() body: any) {
```
Sem DTO com validação (class-validator), qualquer campo pode ser enviado, incluindo campos internos como `id`, `createdAt`, `updatedAt`. Isso permite manipulação indevida de dados.

### RD-07: Edição de proposta permite alterar status sem validação
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:385-397`
`editarProposta()` aceita `status: string` — qualquer valor é aceito, incluindo valores inválidos que não correspondem a nenhum status real.

### RD-08: Tarifa sem filtro por concessionária
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:71-73`
A busca da tarifa para cálculo pega a tarifa mais recente **independente da concessionária**. Se a cooperativa opera com múltiplas concessionárias, cooperados de uma podem receber cálculos com tarifa de outra.

---

## 5. MELHORIAS

### ML-01: Usar DTOs com class-validator em todos os endpoints
**Arquivos:** `cooperados.controller.ts:33-39,46`, `contratos.controller.ts:32-46,50`
Trocar `body: any` e tipos inline por DTOs com decorators de validação (`@IsString()`, `@IsEmail()`, `@IsOptional()`, etc).

### ML-02: Extrair geração de número de contrato para helper shared
**Arquivos:** `contratos.service.ts:58-64`, `motor-proposta.service.ts:301-307`
Código duplicado em dois arquivos. Extrair para um método compartilhado em ContratosService e reutilizá-lo no MotorPropostaService.

### ML-03: Usar transações Prisma em operações compostas
**Arquivos:** `cooperados.service.ts:61-96`, `motor-proposta.service.ts:190-357`
Operações como ativar cooperado + ativar contratos + calcular percentual + criar notificação deveriam usar `prisma.$transaction()` para garantir atomicidade.

### ML-04: Paginação no findAll
**Arquivos:** `cooperados.service.ts:13-16`, `contratos.service.ts:12-17`
`findAll()` retorna todos os registros sem paginação. Com o crescimento da base, isso causará problemas de performance.

### ML-05: Busca e filtros na listagem de cooperados
**Arquivo:** `web/app/dashboard/cooperados/page.tsx`
A página lista cooperados sem campo de busca, filtro por status ou paginação. Para > 50 cooperados ficará inutilizável.

### ML-06: Testes unitários insuficientes
**Arquivos:** `cooperados.service.spec.ts`, `cooperados.controller.spec.ts`
Ambos os spec files contém apenas o teste `should be defined`. Nenhuma lógica de negócio (cascata de ativação/suspensão, checklist, percentual) está coberta por testes.

### ML-07: Tratamento de erro genérico no frontend
**Arquivo:** `web/app/dashboard/cooperados/[id]/page.tsx` (múltiplas linhas)
Todos os catch blocks são `catch { showToast('erro', '...') }` — sem log do erro, sem mensagem contextual do backend. Dificulta debug em produção.

### ML-08: Campo `tipoCooperado` deveria ser enum no schema
**Arquivo:** `backend/prisma/schema.prisma:45`
`tipoCooperado String @default("COM_UC")` — deveria ser um `enum TipoCooperado { COM_UC, SEM_UC }` para garantir integridade.

### ML-09: Campo `status` da PropostaCooperado deveria ser enum
**Arquivo:** `backend/prisma/schema.prisma:428`
`status String @default("PENDENTE")` — deveria ser enum para evitar valores inválidos.

### ML-10: Sem soft delete
**Arquivos:** `cooperados.service.ts:110-113`, `contratos.service.ts:103-105`
Exclusões são hard delete. Dados de cooperados e contratos são irrecuperáveis. Considerar soft delete com campo `deletedAt`.

### ML-11: Botão "Editar" cooperado não aparece na interface
**Arquivo:** `web/app/dashboard/cooperados/[id]/page.tsx:661-665`
O header do cooperado tem botão "Processar Fatura" mas não tem botão "Editar". A função `abrirEditarCooperado()` existe (linha 285) mas não há botão visível que a chame.

### ML-12: Checklist endpoint não é consumido pelo frontend
**Arquivo:** `backend/src/cooperados/cooperados.controller.ts:19-22`
O endpoint `GET :id/checklist` existe no backend mas não é utilizado na interface. O checklist de ativação deveria ser exibido na aba "Visão Geral" para cooperados PENDENTE.

### ML-13: Sem loading/feedback ao excluir proposta ou editar proposta
**Arquivo:** `web/app/dashboard/cooperados/[id]/page.tsx`
As actions de editar/excluir proposta (endpoints `PUT/DELETE /motor-proposta/proposta/:id`) não são acessíveis no frontend cooperado detail. O histórico de propostas mostra dados mas não tem ações.

### ML-14: Aba de cobranças deveria iterar sobre todos os contratos
**Arquivo:** `web/app/dashboard/cooperados/[id]/page.tsx:878-931`
A aba "Cobranças" deveria listar cobranças agrupadas por contrato quando o cooperado tem múltiplos contratos.

---

## Resumo

| Categoria | Qtd |
|-----------|-----|
| Bugs | 10 |
| Dados Ausentes | 8 |
| Regras de Negócio Ausentes | 14 |
| Regras Defeituosas | 8 |
| Melhorias | 14 |
| **Total** | **54** |

### Prioridade Crítica (resolver antes de produção)
- BUG-01: percentualUsina sobrescrito
- BUG-04/05: delete sem cascata
- BUG-06: race condition no número de contrato
- RN-01: sem validação de CPF
- RN-03: sem tratamento de duplicidade
- RN-04/05: sem máquina de estados
- RD-06: body: any nos controllers
- ML-03: sem transações

### Prioridade Alta (resolver em breve)
- BUG-08/09: cobranças só do primeiro contrato
- RD-02: média cooperativa inconsistente
- RD-05: suspensão não trata PENDENTE_ATIVACAO
- RN-07: delete sem bloqueio
- ML-01: DTOs com validação
- ML-06: testes unitários
- ML-11: botão editar cooperado ausente
