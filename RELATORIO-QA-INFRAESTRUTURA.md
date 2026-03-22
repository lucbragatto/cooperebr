# Relatório QA — Módulo de Infraestrutura

**Módulos analisados:** Usinas, UCs, Planos, Distribuidoras
**Data:** 2026-03-20
**Escopo:** backend/src/usinas/, backend/src/ucs/, backend/src/planos/, backend/prisma/schema.prisma, web/app/dashboard/usinas/, web/app/dashboard/ucs/, web/app/dashboard/planos/, web/types/index.ts

---

## 1. BUGS IDENTIFICADOS

### BUG-INF-01 — UC pode ser deletada com contratos ativos (CRÍTICO)
- **Arquivo:** `backend/src/ucs/ucs.service.ts:56-58`
- **Severidade:** CRÍTICA
- **Descrição:** O método `remove()` executa `prisma.uc.delete({ where: { id } })` sem verificar se existem contratos, ocorrências ou faturas processadas vinculadas. Comparar com `usinas.service.ts:118-123` que corretamente valida contratos ativos antes de excluir. A deleção pode causar erro de constraint do banco (FK) ou, pior, cascade delete de dados financeiros.
- **Impacto:** Perda de dados de contratos/cobranças ou erro 500 não tratado.

### BUG-INF-02 — Update de UC ignora campos importantes (ALTO)
- **Arquivo:** `backend/src/ucs/ucs.service.ts:48-54`
- **Severidade:** ALTA
- **Descrição:** O método `update()` só permite alterar `endereco`, `cidade`, `estado`. Campos como `numero`, `numeroUC`, `distribuidora`, `classificacao`, `codigoMedidor`, `modalidadeTarifaria`, `tensaoNominal`, `tipoFornecimento` não podem ser editados após criação. Se um operador errar o número da UC ou a distribuidora, precisa deletar e recriar (perdendo vínculos).
- **Impacto:** Dados incorretos ficam permanentes sem workaround seguro.

### BUG-INF-03 — Controller de UC aceita `body: any` no update (MÉDIO)
- **Arquivo:** `backend/src/ucs/ucs.controller.ts:47`
- **Severidade:** MÉDIA
- **Descrição:** `@Body() body: any` — o controller aceita qualquer payload no PUT. Embora o service filtre, a falta de tipagem permite enviar dados inesperados e dificulta documentação automática (Swagger).

### BUG-INF-04 — `findByCooperado` não inclui cooperado na resposta (BAIXO)
- **Arquivo:** `backend/src/ucs/ucs.service.ts:22-27`
- **Severidade:** BAIXA
- **Descrição:** `findAll()` (linha 10) usa `include: { cooperado: true }`, mas `findByCooperado()` (linha 23) não inclui o cooperado. Inconsistência na API — mesmo endpoint retorna shapes diferentes dependendo da rota.

### BUG-INF-05 — Create de UC no controller não passa campos opcionais (ALTO)
- **Arquivo:** `backend/src/ucs/ucs.controller.ts:34-40`
- **Severidade:** ALTA
- **Descrição:** O tipo do `@Body()` no `create()` só declara `numero, endereco, cidade, estado, cooperadoId`. Campos opcionais como `distribuidora`, `classificacao`, `numeroUC`, `codigoMedidor` etc. existem no service (linhas 35-43) mas não são tipados no controller. O NestJS pode ignorar campos não declarados dependendo de pipes/decorators.

### BUG-INF-06 — Plano pode ser deletado com contratos/propostas vinculados (ALTO)
- **Arquivo:** `backend/src/planos/planos.service.ts:77-81`
- **Severidade:** ALTA
- **Descrição:** `remove()` faz `delete` sem verificar se existem contratos ou propostas usando este plano. Pode causar erro de FK ou perda de referência em contratos ativos. Mesmo padrão do BUG-INF-01.

### BUG-INF-07 — Contrato.create não valida capacidade disponível da usina (ALTO)
- **Arquivo:** `backend/src/contratos/contratos.service.ts:34-81`
- **Severidade:** ALTA
- **Descrição:** Ao criar contrato com `kwhContrato`, não há validação se a soma dos kWh contratados de todos os contratos ativos excede `capacidadeKwh` da usina. Isso permite sobre-alocação de capacidade, gerando créditos que a usina não pode produzir.

### BUG-INF-08 — `as any` no create da usina ignora tipagem Prisma (BAIXO)
- **Arquivo:** `backend/src/usinas/usinas.service.ts:31`
- **Severidade:** BAIXA
- **Descrição:** `data: data as any` — cast para `any` silencia erros de tipo. Se um campo inválido for enviado, o erro só aparece em runtime.

### BUG-INF-09 — DTO do Plano sem decorators de validação (MÉDIO)
- **Arquivo:** `backend/src/planos/dto/create-plano.dto.ts:1-14`
- **Severidade:** MÉDIA
- **Descrição:** O DTO não usa `class-validator` decorators (`@IsString()`, `@IsNumber()`, `@Min()`, etc.). Qualquer valor pode ser enviado para `descontoBase` (negativo, > 100, string). A validação depende inteiramente do banco de dados.

---

## 2. DADOS AUSENTES

### DA-INF-01 — Capacidade utilizada vs total da usina
- **Modelo:** `Usina` (`schema.prisma:127-145`)
- **Descrição:** Existe `capacidadeKwh` (total) mas não há campo calculado ou armazenado para "capacidade já alocada" (soma de `kwhContrato` dos contratos ativos). O `percentualUsina` é calculado on-the-fly apenas na lista de concessionária (`usinas.service.ts:158`), mas não está disponível na listagem/detalhe da usina.
- **Impacto:** Operador não sabe se a usina está lotada antes de criar um novo contrato.

### DA-INF-02 — Tipo UC (interface frontend) falta campos do Prisma
- **Arquivo:** `web/types/index.ts:43-53`
- **Descrição:** A interface `UC` no frontend define apenas `id, numero, endereco, cidade, estado, cooperadoId, cooperado`. Campos do banco como `numeroUC`, `distribuidora`, `classificacao`, `codigoMedidor`, `modalidadeTarifaria`, `tensaoNominal`, `tipoFornecimento`, `cep`, `bairro` não existem no tipo TypeScript. O frontend não consegue exibir/editar esses dados mesmo que a API os retorne.

### DA-INF-03 — Tipo Usina (interface frontend) falta `modeloCobrancaOverride`
- **Arquivo:** `web/types/index.ts:57-71`
- **Descrição:** O campo `modeloCobrancaOverride` existe no Prisma schema (`schema.prisma:139`) e no backend service, mas não está na interface TypeScript do frontend. O frontend não pode exibir nem editar o modelo de cobrança da usina.

### DA-INF-04 — Distribuidora como string livre (sem normalização)
- **Modelo:** `Uc` (`schema.prisma:111`)
- **Descrição:** `distribuidora` é `String?` — texto livre. Não existe tabela `Distribuidora` nem enum. Cada UC pode ter grafias diferentes ("CEMIG", "Cemig", "cemig s.a."). Isso compromete relatórios e filtros. A entidade `TarifaConcessionaria` (schema) sugere que distribuidoras deveriam ser entidades com tarifas associadas.

### DA-INF-05 — Usina sem campos de localização geográfica
- **Modelo:** `Usina` (`schema.prisma:127-145`)
- **Descrição:** Faltam latitude/longitude, endereço, CNPJ da usina, número do registro ANEEL, tipo de geração (fotovoltaica, eólica), e área em m². Esses dados são exigidos pela ANEEL para homologação.

### DA-INF-06 — Plano sem limites de contratação
- **Modelo:** `Plano` (`schema.prisma:180-200`)
- **Descrição:** Não há campos como `maxCooperados`, `maxKwhPorCooperado`, `minKwhPorCooperado`. Um plano pode ser aplicado indefinidamente sem restrição de escala.

---

## 3. REGRAS DE NEGÓCIO AUSENTES

### RN-INF-01 — Validação de capacidade da usina ao criar contrato
- **Arquivos:** `contratos.service.ts:34-81`, `usinas.service.ts`
- **Descrição:** Não há verificação se `sum(kwhContrato)` dos contratos ativos + novo contrato > `capacidadeKwh` da usina. A sobre-alocação é silenciosamente permitida.
- **Regra esperada:** Antes de criar contrato, calcular capacidade disponível: `capacidadeKwh - sum(kwhContrato WHERE status IN (ATIVO, PENDENTE_ATIVACAO))`. Rejeitar se insuficiente.

### RN-INF-02 — Usina precisa estar EM_PRODUCAO para receber contratos
- **Arquivo:** `contratos.service.ts:34-81`
- **Descrição:** Não há validação do `statusHomologacao` da usina ao vincular contrato. Um contrato pode ser criado para uma usina `CADASTRADA` ou `SUSPENSA`, que não está gerando energia.
- **Regra esperada:** Só permitir contratos para usinas com status `EM_PRODUCAO` (ou `HOMOLOGADA` para pré-alocação com flag explícita).

### RN-INF-03 — Transição de status da usina sem máquina de estados
- **Arquivo:** `usinas.service.ts:81-95`
- **Descrição:** Qualquer status pode transicionar para qualquer outro. Exemplo: uma usina `SUSPENSA` pode voltar direto para `CADASTRADA`, pulando todo o fluxo de homologação. Não há validação de transições válidas.
- **Regra esperada:** Transições permitidas: CADASTRADA → AGUARDANDO_HOMOLOGACAO → HOMOLOGADA → EM_PRODUCAO; qualquer → SUSPENSA; SUSPENSA → EM_PRODUCAO (reativação).

### RN-INF-04 — UC sem validação de duplicidade por cooperado
- **Arquivo:** `ucs.service.ts:29-46`
- **Descrição:** O campo `numero` é `@unique` no banco, mas não há validação semântica: o mesmo endereço pode ser cadastrado duas vezes com números diferentes, e não há verificação se a UC pertence à mesma distribuidora da usina contratada.

### RN-INF-05 — Plano sem validação de consistência promocional
- **Arquivo:** `planos.service.ts:37-54`
- **Descrição:** Se `temPromocao = true`, `descontoPromocional` e `mesesPromocao` podem ser null/undefined. Nenhuma regra impede promoção sem desconto definido. Inversamente, se `temPromocao = false`, pode ter `descontoPromocional` preenchido (orphan data).
- **Regra esperada:** Se `temPromocao = true`, exigir `descontoPromocional > 0` e `mesesPromocao >= 1`. Se `false`, forçar ambos como null.

### RN-INF-06 — Vigência do plano sem validação de datas
- **Arquivo:** `planos.service.ts:50-51`
- **Descrição:** `dataInicioVigencia` pode ser posterior a `dataFimVigencia`. Plano tipo `CAMPANHA` pode não ter datas definidas. Não há validação cruzada.

### RN-INF-07 — UC pode ser de distribuidora diferente da usina
- **Arquivos:** `contratos.service.ts`, `schema.prisma`
- **Descrição:** Não há validação de compatibilidade geográfica/distribuidora entre UC e usina no momento de criar contrato. Em geração distribuída, UC e usina devem pertencer à mesma concessionária (regra ANEEL REN 482/687).

### RN-INF-08 — Sem validação de `descontoBase` no range 0-100
- **Arquivo:** `planos.service.ts:43`, `create-plano.dto.ts:5`
- **Descrição:** `descontoBase` aceita qualquer número (negativo, > 100). O banco aceita até 999.99 por ser `Decimal(5,2)`. Um desconto de 150% seria persistido sem erro.

---

## 4. REGRAS DE NEGÓCIO DEFEITUOSAS

### RD-INF-01 — Auto-preenchimento de datas sobrescrito por input manual
- **Arquivo:** `usinas.service.ts:88-102`
- **Descrição:** As linhas 89-94 auto-preenchem `dataHomologacao` e `dataInicioProducao` quando status muda. Porém, as linhas 97-102 permitem sobrescrever essas datas manualmente no mesmo request. Se o usuário muda status para `HOMOLOGADA` e envia `dataHomologacao` no body, o auto-preenchimento define `new Date()` (linha 90) e logo é sobrescrito pela data do body (linha 98). A lógica funciona por acaso (ordem de execução), mas a intenção é ambígua e frágil.

### RD-INF-02 — `findAtivos` de planos ignora `dataInicioVigencia`
- **Arquivo:** `planos.service.ts:17-29`
- **Descrição:** A query filtra `ativo: true` e `dataFimVigencia >= hoje OR null`, mas não verifica `dataInicioVigencia <= hoje`. Um plano com `dataInicioVigencia` no futuro aparece como "ativo" e pode ser contratado antes do período de vigência.

### RD-INF-03 — Lista de concessionária usa `capacidadeKwh` que pode ser null
- **Arquivo:** `usinas.service.ts:138,158`
- **Descrição:** `const capacidade = Number(usina.capacidadeKwh ?? 0)`. Se `capacidadeKwh` é null, `capacidade = 0`, e o `percentualUsina` é calculado como `0` para todos os cooperados (divisão `kwh / 0` resulta em Infinity/NaN, mas o ternário evita com `capacidade > 0`). Resultado: relatório com todos os percentuais zerados, sem aviso ao operador de que a capacidade não está preenchida.

### RD-INF-04 — Contrato permite `usinaId` null
- **Arquivo:** `schema.prisma:162-163`
- **Descrição:** `usinaId String?` — contrato pode existir sem usina vinculada. Isso permite contratos "órfãos" que não geram créditos nem cobranças. Deveria ser obrigatório ou ter status `LISTA_ESPERA` explicitamente quando sem usina.

---

## 5. MELHORIAS

### ML-INF-01 — Criar entidade Distribuidora normalizada
- Substituir `distribuidora String?` na UC por `distribuidoraId` FK para tabela `Distribuidora` com nome, código ANEEL, UF. Já existe `TarifaConcessionaria` no schema que referencia concessionárias — unificar.

### ML-INF-02 — Dashboard de capacidade da usina
- Endpoint que retorne `capacidadeTotal`, `capacidadeAlocada`, `capacidadeDisponivel`, `percentualOcupacao` por usina. Exibir como barra de progresso na listagem e detalhe de usinas.

### ML-INF-03 — Endpoint de UCs com filtros
- `findAll()` retorna todas as UCs sem paginação nem filtro. Adicionar query params: `?cooperadoId=`, `?distribuidora=`, `?cidade=`, `?page=`, `?limit=`.

### ML-INF-04 — Soft delete para UC e Plano
- Em vez de `DELETE` físico, usar campo `deletedAt` (soft delete). Preserva histórico para auditoria e evita problemas de FK.

### ML-INF-05 — Validação frontend espelhar validação backend
- O frontend de criação de usina (`web/app/dashboard/usinas/nova/page.tsx`) valida `potenciaKwp > 0` e `capacidadeKwh > 0`, mas o backend aceita `>= 0`. Alinhar as regras.

### ML-INF-06 — Adicionar campos ANEEL à usina
- `cnpj`, `registroAneel`, `latitude`, `longitude`, `tipoGeracao`, `areaM2` — necessários para compliance regulatório e relatórios à ANEEL.

### ML-INF-07 — Usar class-validator nos DTOs de Plano
- Adicionar `@IsString()`, `@IsNumber()`, `@Min(0)`, `@Max(100)` em `create-plano.dto.ts`. O NestJS já suporta via `ValidationPipe`.

### ML-INF-08 — Auditoria de mudança de status da usina
- Criar tabela `UsinaStatusLog` com `usinaId`, `statusAnterior`, `statusNovo`, `usuarioId`, `data`, `motivo`. Essencial para compliance e rastreabilidade.

---

## 6. RESUMO EXECUTIVO — TOP 5 PRIORIDADES

| # | Item | Tipo | Severidade | Impacto |
|---|------|------|------------|---------|
| 1 | **Validação de capacidade da usina ao criar contrato** (RN-INF-01, DA-INF-01) | Regra ausente | CRÍTICA | Sobre-alocação gera créditos inexistentes, prejuízo financeiro direto para a cooperativa |
| 2 | **UC pode ser deletada com contratos ativos** (BUG-INF-01) | Bug | CRÍTICA | Perda de dados financeiros ou erro 500 em produção |
| 3 | **Plano deletável com contratos vinculados** (BUG-INF-06) + **Update de UC limitado** (BUG-INF-02) | Bug | ALTA | Integridade referencial comprometida; dados incorretos sem correção |
| 4 | **Usina sem máquina de estados** (RN-INF-03) + **sem validação de status para contratos** (RN-INF-02) | Regra ausente | ALTA | Contratos criados para usinas que não produzem energia; status inconsistentes |
| 5 | **Distribuidora como texto livre** (DA-INF-04) + **sem validação UC-Usina mesma concessionária** (RN-INF-07) | Dado ausente + Regra ausente | ALTA | Descumprimento regulatório ANEEL; relatórios não confiáveis |

---

*Relatório gerado por análise estática de código. Nenhuma alteração foi feita no projeto.*
