# Relatório QA — Módulo de Contratos

**Data:** 2026-03-20
**Escopo:** Backend (`backend/src/contratos/`), Frontend (`web/app/dashboard/contratos/`), Prisma schema, serviços relacionados (cooperados, faturas, motor-proposta)
**Método:** Análise estática de código — sem alterações realizadas

---

## 1. BUGS IDENTIFICADOS

### BUG-01 — Status badge incompleto na página de detalhe do contrato
**Arquivo:** `web/app/dashboard/contratos/[id]/page.tsx:12-22`
**Severidade:** MÉDIA
**Descrição:** Os dicionários `statusClasses` e `statusLabel` na página de detalhe definem apenas 3 status (ATIVO, SUSPENSO, ENCERRADO), enquanto o enum `StatusContrato` possui 5 valores. Os status `PENDENTE_ATIVACAO` e `LISTA_ESPERA` renderizam badge sem estilo e label `undefined`.
**Comparação:** A página de lista (`web/app/dashboard/contratos/page.tsx:20-34`) mapeia corretamente todos os 5 status.
**Impacto:** Contratos recém-criados (via motor-proposta) nascem como `PENDENTE_ATIVACAO` ou `LISTA_ESPERA` — exatamente os dois status ausentes. O detalhe exibe badge em branco.

### BUG-02 — Frontend permite status PENDENTE_ATIVACAO no update, backend rejeita silenciosamente
**Arquivo:** `web/app/dashboard/contratos/[id]/page.tsx:186` / `backend/src/contratos/contratos.service.ts:91`
**Severidade:** MÉDIA
**Descrição:** O dropdown de edição oferece 5 opções de status incluindo `PENDENTE_ATIVACAO`. Porém o type hint do backend no `update()` (linha 91) aceita apenas `'ATIVO' | 'SUSPENSO' | 'ENCERRADO' | 'LISTA_ESPERA'`. Como o cast `as any` (linha 100) remove a verificação em runtime, o Prisma aceita o valor — mas a intenção era excluí-lo.
**Impacto:** Operador pode manualmente colocar contrato em PENDENTE_ATIVACAO, quebrando o fluxo de ativação automática via cooperado.

### BUG-03 — Erro genérico ao criar contrato oculta mensagem real do backend
**Arquivo:** `web/app/dashboard/contratos/novo/page.tsx:86-87`
**Severidade:** MÉDIA
**Descrição:** O catch block ignora `err.response?.data?.message`. Quando o backend retorna `BadRequestException` ("Já existe contrato ativo para esta UC"), o usuário vê apenas "Erro ao cadastrar contrato."
**Impacto:** Operador não sabe o motivo da falha e pode tentar repetidamente.

### BUG-04 — Erro genérico ao salvar edição do contrato
**Arquivo:** `web/app/dashboard/contratos/[id]/page.tsx:95-96`
**Severidade:** BAIXA
**Descrição:** Mesmo problema do BUG-03, na edição. A mensagem "Erro ao salvar" não traz detalhes do backend.

### BUG-05 — `findOne()` retorna null sem lançar exceção
**Arquivo:** `backend/src/contratos/contratos.service.ts:19-24`
**Severidade:** MÉDIA
**Descrição:** `findOne()` usa `findUnique` que retorna `null` se o contrato não existir. O controller (linha 20-22) repassa o `null` ao cliente com HTTP 200. Deveria ser 404 `NotFoundException`.
**Impacto:** Frontend recebe `null` e exibe "Contrato não encontrado" via catch genérico — funciona por acidente, mas a API está semanticamente errada.

### BUG-06 — `remove()` não verifica dependências — pode deixar cobranças órfãs
**Arquivo:** `backend/src/contratos/contratos.service.ts:103-105`
**Severidade:** ALTA
**Descrição:** Hard delete via `prisma.contrato.delete()`. Se o contrato possui `cobrancas` associadas, o Prisma lançará erro de foreign key (crash não tratado). Se o schema usar `onDelete: Cascade` (não configurado), deletaria cobranças silenciosamente.
**Impacto:** ADMIN pode tentar deletar contrato com cobranças e receber erro 500 não tratado. Também não limpa `listaEspera` vinculada.

### BUG-07 — `excluirProposta()` associa contratos por timestamp frágil
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:365-369`
**Severidade:** ALTA
**Descrição:** Ao excluir proposta aceita, busca contratos do cooperado criados até 60 segundos antes da proposta. Se o sistema sofrer delay ou se dois contratos forem criados no intervalo, pode encerrar contrato errado — ou não encerrar nenhum.
**Impacto:** Exclusão de proposta pode não encerrar o contrato correspondente, ou encerrar contrato de outra proposta.

### BUG-08 — Cálculo de `percentualUsina` sobrescreve a cada iteração
**Arquivo:** `backend/src/cooperados/cooperados.service.ts:142-149`
**Severidade:** ALTA
**Descrição:** O loop em `update()` calcula `percentualUsina` para cada contrato ativado mas faz `update` individual no cooperado, sobrescrevendo o valor anterior. Se cooperado tem 2 contratos em usinas diferentes, o último contrato do loop define o percentual — não a soma.
**Impacto:** Cooperado com múltiplos contratos terá `percentualUsina` incorreto.

### BUG-09 — Race condition na geração do número do contrato
**Arquivo:** `backend/src/contratos/contratos.service.ts:58-64` e `backend/src/motor-proposta/motor-proposta.service.ts:300-307`
**Severidade:** MÉDIA
**Descrição:** Dois locais geram número `CTR-YYYY-NNNN` com a mesma lógica (findFirst + increment). Em chamadas concorrentes, dois contratos podem receber o mesmo número. O `@unique` do schema causará crash 500.
**Impacto:** Erro intermitente em cenários de concorrência (ex: dois operadores aceitando propostas simultaneamente).

---

## 2. DADOS AUSENTES

### DAT-01 — Campo `kwhContrato` ausente no formulário de criação manual
**Arquivo:** `web/app/dashboard/contratos/novo/page.tsx`
**Descrição:** O formulário não inclui input para `kwhContrato`, campo crucial para cálculo de cobranças. Apenas contratos criados via motor-proposta terão este valor preenchido. Contratos manuais terão `kwhContrato = null`, causando cobranças de valor zero.

### DAT-02 — Campo `modeloCobrancaOverride` ausente no formulário de criação e edição
**Arquivo:** `web/app/dashboard/contratos/novo/page.tsx` e `[id]/page.tsx`
**Descrição:** Não há como definir ou alterar o modelo de cobrança override via interface. Somente via API direta.

### DAT-03 — Campo `planoId` ausente no formulário de criação manual
**Arquivo:** `web/app/dashboard/contratos/novo/page.tsx`
**Descrição:** O formulário não permite selecionar plano. Contratos manuais terão `planoId = null`. O motor-proposta preenche automaticamente, mas a criação manual não.

### DAT-04 — Interface TypeScript `Contrato` incompleta
**Arquivo:** `web/types/index.ts`
**Descrição:** O tipo `Contrato` no frontend provavelmente não inclui campos como `kwhContrato`, `modeloCobrancaOverride`, `planoId`, `cobrancas`, `listaEspera`. Verificar se todos os campos do schema Prisma estão representados.

### DAT-05 — Contrato não exibe cobranças associadas na página de detalhe
**Arquivo:** `web/app/dashboard/contratos/[id]/page.tsx`
**Descrição:** O detalhe do contrato não mostra a lista de cobranças (`cobrancas[]`) nem a entrada de lista de espera (`listaEspera`). Operador precisa navegar para outra tela para ver cobranças do contrato.

### DAT-06 — `findOne()` não inclui relação `cobrancas` nem `plano`
**Arquivo:** `backend/src/contratos/contratos.service.ts:22`
**Descrição:** O include traz apenas `cooperado`, `uc`, `usina`. Faltam `cobrancas`, `plano`, `listaEspera`. Mesmo que o frontend quisesse exibi-los, a API não os retorna.

---

## 3. REGRAS DE NEGÓCIO AUSENTES

### RN-01 — Sem validação de máquina de estados no `update()`
**Arquivo:** `backend/src/contratos/contratos.service.ts:83-101`
**Descrição:** Qualquer transição de status é aceita. Não existe guard para impedir transições inválidas como:
- `ENCERRADO` → `ATIVO` (reativação de contrato encerrado)
- `LISTA_ESPERA` → `ATIVO` sem verificar capacidade da usina
- `ATIVO` → `PENDENTE_ATIVACAO` (regressão)

**Transições válidas esperadas:**
```
PENDENTE_ATIVACAO → ATIVO (via ativação do cooperado)
PENDENTE_ATIVACAO → ENCERRADO (cancelamento)
ATIVO → SUSPENSO (via suspensão do cooperado)
ATIVO → ENCERRADO (encerramento)
SUSPENSO → ATIVO (reativação)
LISTA_ESPERA → PENDENTE_ATIVACAO (alocação de usina)
LISTA_ESPERA → ENCERRADO (cancelamento)
```

### RN-02 — Sem validação de propriedade da UC ao criar contrato
**Arquivo:** `backend/src/contratos/contratos.service.ts:34-81`
**Descrição:** O `create()` aceita qualquer combinação `cooperadoId + ucId`. Não valida que a UC pertence ao cooperado informado. Operador pode vincular UC de outro cooperado.

### RN-03 — Sem validação de capacidade da usina na criação manual
**Arquivo:** `backend/src/contratos/contratos.service.ts:34-81`
**Descrição:** Ao criar contrato manualmente (via controller), não há verificação se a usina tem capacidade disponível. Apenas o motor-proposta (linha 279-298) faz essa verificação. Contrato manual pode exceder `capacidadeKwh` da usina.

### RN-04 — Sem reativação automática ao reativar cooperado suspenso
**Arquivo:** `backend/src/cooperados/cooperados.service.ts:130-160`
**Descrição:** Quando cooperado é suspenso, contratos ATIVO → SUSPENSO (linhas 163-167). Porém quando o cooperado volta a ATIVO (linhas 130-134), apenas contratos `PENDENTE_ATIVACAO` viram ATIVO. Contratos `SUSPENSO` permanecem suspensos — não são reativados automaticamente.

### RN-05 — Sem validação de datas (`dataFim >= dataInicio`)
**Arquivo:** `backend/src/contratos/contratos.service.ts:83-101`
**Descrição:** Nem criação nem edição validam que `dataFim` seja posterior a `dataInicio`. Backend aceita contrato com período invertido.

### RN-06 — Sem verificação de contrato encerrado/expirado antes de gerar cobrança
**Arquivo:** `backend/src/faturas/faturas.service.ts:245-246`
**Descrição:** A query filtra `status: 'ATIVO'` mas não verifica se `dataFim < hoje`. Um contrato ATIVO com `dataFim` no passado continuará gerando cobranças.

### RN-07 — Sem expiração automática de contrato
**Descrição:** Não existe job/cron que mude status de contratos cuja `dataFim` já passou para `ENCERRADO`. Contratos expirados permanecem ATIVO indefinidamente.

### RN-08 — Sem soft-delete de contrato
**Arquivo:** `backend/src/contratos/contratos.service.ts:103-105`
**Descrição:** Contrato é deletado fisicamente. Para auditoria de cooperativa de energia, deveria usar soft-delete ou ao menos transicionar para ENCERRADO.

### RN-09 — Sem controle de acesso por ownership (COOPERADO vê qualquer contrato)
**Arquivo:** `backend/src/contratos/contratos.controller.ts:18-28`
**Descrição:** Endpoints `findOne` e `findByCooperado` permitem role COOPERADO mas não verificam se o cooperado autenticado é o dono do contrato/cooperadoId.

---

## 4. REGRAS DE NEGÓCIO DEFEITUOSAS

### RD-01 — Status default do contrato é ATIVO (deveria ser PENDENTE_ATIVACAO)
**Arquivo:** `backend/prisma/schema.prisma:170`
**Descrição:** O schema define `@default(ATIVO)`. Na criação via motor-proposta, o status é explicitamente `PENDENTE_ATIVACAO` ou `LISTA_ESPERA` (motor-proposta.service.ts:310-321). Porém na criação manual via `ContratosService.create()`, nenhum status é passado no body — o default do Prisma (`ATIVO`) é usado. Isso significa que contratos criados manualmente nascem ATIVO mesmo se o cooperado não está ativado.
**Impacto:** Contrato ativo para cooperado pendente — inconsistência que pode gerar cobranças indevidas.

### RD-02 — Suspensão de cooperado não gera notificação
**Arquivo:** `backend/src/cooperados/cooperados.service.ts:162-168`
**Descrição:** A ativação de cooperado gera notificação (linhas 152-158). A suspensão atualiza contratos mas não notifica ninguém. Contratos silenciosamente mudam para SUSPENSO.

### RD-03 — Lógica duplicada de geração de número de contrato
**Arquivo:** `backend/src/contratos/contratos.service.ts:58-64` e `backend/src/motor-proposta/motor-proposta.service.ts:300-307`
**Descrição:** Código idêntico em dois locais. Além de violação DRY, cria risco de divergência e race condition (ver BUG-09).

### RD-04 — Criação manual via controller não cria entrada em lista de espera
**Arquivo:** `backend/src/contratos/contratos.service.ts:34-81`
**Descrição:** Se um operador criar contrato manualmente sem `usinaId`, o contrato fica sem usina mas não entra na lista de espera. No motor-proposta, a criação de `ListaEspera` é automática (linhas 326-336).

### RD-05 — `update()` não recalcula `percentualUsina` ao alterar `kwhContrato` ou `usinaId`
**Arquivo:** `backend/src/contratos/contratos.service.ts:100`
**Descrição:** O `update()` faz apenas `prisma.contrato.update()` sem efeitos colaterais. Se `kwhContrato` ou `usinaId` mudar, o campo `cooperado.percentualUsina` fica desatualizado.

### RD-06 — `as any` cast remove segurança de tipos em criação e update
**Arquivo:** `backend/src/contratos/contratos.service.ts:74,100` e `backend/src/motor-proposta/motor-proposta.service.ts:321`
**Descrição:** Três usos de `as any` para contornar tipagem do Prisma. Permite dados malformados passarem sem erro de compilação.

---

## 5. MELHORIAS

### MEL-01 — Criar DTOs com class-validator para contratos
**Prioridade:** ALTA
**Descrição:** O controller aceita `body: any` no PUT (linha 50). Criar `CreateContratoDto` e `UpdateContratoDto` com decorators `@IsString()`, `@IsNumber()`, `@IsOptional()`, `@IsEnum(StatusContrato)`, etc.

### MEL-02 — Centralizar geração de número de contrato
**Prioridade:** ALTA
**Descrição:** Extrair lógica de `CTR-YYYY-NNNN` para método estático ou utilitário em `ContratosService`, chamado tanto pelo `create()` quanto pelo `motor-proposta`. Usar transação Prisma para evitar race condition.

### MEL-03 — Adicionar paginação no `findAll()`
**Prioridade:** MÉDIA
**Descrição:** `findAll()` retorna todos os contratos sem limite. Adicionar parâmetros `page` e `limit` para escalar com crescimento da cooperativa.

### MEL-04 — Exibir cobranças e lista de espera no detalhe do contrato
**Prioridade:** MÉDIA
**Descrição:** Incluir `cobrancas` e `listaEspera` no `include` do `findOne()` e renderizar na página de detalhe.

### MEL-05 — Adicionar filtros e busca na listagem de contratos
**Prioridade:** MÉDIA
**Descrição:** Permitir filtrar por status, cooperado, usina, período. Atualmente a lista não tem filtro algum.

### MEL-06 — Criar job de expiração automática de contratos
**Prioridade:** MÉDIA
**Descrição:** Cron job que encerra contratos com `dataFim < hoje` e `status = ATIVO`.

### MEL-07 — Adicionar campo `motivoEncerramento` ao encerrar contrato
**Prioridade:** BAIXA
**Descrição:** Registrar motivo ao transicionar para ENCERRADO (manual, expiração, exclusão de proposta, etc.).

### MEL-08 — Vincular contrato diretamente à proposta
**Prioridade:** MÉDIA
**Descrição:** Adicionar `propostaId` no model Contrato para rastrear origem. Hoje a associação é feita por timestamp (ver BUG-07), o que é frágil.

### MEL-09 — Implementar soft-delete ou status CANCELADO
**Prioridade:** BAIXA
**Descrição:** Substituir hard delete por transição para status terminal, mantendo histórico.

### MEL-10 — Adicionar testes unitários e de integração
**Prioridade:** ALTA
**Descrição:** O módulo de contratos não possui testes. Cobrir: criação com validação de UC duplicada, transições de status, cascata de ativação/suspensão, geração de número único.

---

## 6. RESUMO EXECUTIVO — TOP 5 PRIORIDADES

| # | Item | Tipo | Severidade | Descrição |
|---|------|------|------------|-----------|
| 1 | **RD-01 + RN-01** | Regra defeituosa | CRÍTICA | Contrato manual nasce ATIVO (default do schema) sem validar status do cooperado. Combinado com ausência de máquina de estados no `update()`, permite transições inválidas. **Ação:** Mudar default para `PENDENTE_ATIVACAO` e implementar guard de transição de estados. |
| 2 | **BUG-08** | Bug | ALTA | `percentualUsina` sobrescrito em loop — cooperado com múltiplos contratos terá valor incorreto. **Ação:** Somar percentuais de todos os contratos ativos. |
| 3 | **BUG-07 + MEL-08** | Bug + Melhoria | ALTA | Associação contrato↔proposta por timestamp é frágil e pode encerrar contrato errado. **Ação:** Adicionar `propostaId` FK no modelo Contrato. |
| 4 | **RN-04** | Regra ausente | ALTA | Cooperado reativado não reativa contratos SUSPENSO automaticamente. Requer intervenção manual que operador pode esquecer. **Ação:** Na ativação do cooperado, também transicionar SUSPENSO → ATIVO. |
| 5 | **MEL-01 + BUG-06** | Melhoria + Bug | ALTA | Ausência de DTOs + delete sem verificar dependências = API frágil. **Ação:** Criar DTOs com validação; no `remove()`, verificar cobranças e listaEspera antes de deletar (ou substituir por soft-delete). |

---

**Arquivos analisados:**
- `backend/src/contratos/contratos.service.ts` (106 linhas)
- `backend/src/contratos/contratos.controller.ts` (59 linhas)
- `backend/src/contratos/contratos.module.ts`
- `backend/src/cooperados/cooperados.service.ts` (linhas 120-170)
- `backend/src/faturas/faturas.service.ts` (linhas 240-290)
- `backend/src/motor-proposta/motor-proposta.service.ts` (linhas 255-383)
- `backend/prisma/schema.prisma` (modelo Contrato linhas 155-178, enum linhas 213-219)
- `web/app/dashboard/contratos/page.tsx` (125 linhas)
- `web/app/dashboard/contratos/[id]/page.tsx` (206 linhas)
- `web/app/dashboard/contratos/novo/page.tsx` (227 linhas)
- `web/types/index.ts`
