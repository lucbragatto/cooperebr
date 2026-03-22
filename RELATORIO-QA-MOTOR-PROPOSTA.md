# Relatório QA — Módulo Motor de Propostas

**Projeto:** CoopereBR — Plataforma de Gestão de Cooperativas de Energia Solar
**Escopo:** backend/src/motor-proposta/, backend/src/planos/, frontend motor-proposta, schema Prisma
**Data:** 2026-03-20
**Autor:** Agente QA automatizado

---

## 1. BUGS IDENTIFICADOS

### BUG-01 — `aceitar()` não usa transação Prisma (CRÍTICO)
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:198-356`
**Severidade:** CRÍTICA
**Descrição:** O método `aceitar()` executa 7 operações sequenciais no banco (cancelar propostas anteriores, criar proposta, buscar UC, buscar usina, criar contrato, criar ListaEspera, criar notificação) sem `prisma.$transaction()`. Se qualquer etapa intermediária falhar, o banco fica em estado inconsistente — ex: proposta criada sem contrato, ou contrato criado sem ListaEspera.
**Impacto:** Propostas órfãs, contratos sem usina, dados financeiros incorretos.

### BUG-02 — `excluirProposta()` usa janela temporal de 60s para localizar contrato (ALTO)
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:365-370`
**Severidade:** ALTA
```typescript
createdAt: { gte: new Date(proposta.createdAt.getTime() - 60000) }
```
**Descrição:** Ao excluir proposta ACEITA, busca contratos criados "até 60 segundos antes da proposta". Essa heurística é frágil: (a) pode capturar contratos não relacionados do mesmo cooperado, (b) pode não encontrar o contrato correto se houve delay > 60s. O correto seria uma FK direta `proposta.contratoId` ou gravar o `propostaId` no contrato.
**Impacto:** Ao excluir proposta, pode encerrar contrato errado ou não encerrar nenhum.

### BUG-03 — `alocarListaEspera()` não valida capacidade da usina destino (ALTO)
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:516-550`
**Severidade:** ALTA
**Descrição:** O endpoint `POST /lista-espera/:id/alocar` recebe `usinaId` e aloca diretamente, sem verificar se a usina tem kWh disponível suficiente para o `kwhNecessario` da entrada. A verificação de capacidade existe apenas em `aceitar()` (linhas 280-298), mas não é replicada na alocação manual.
**Impacto:** Usina pode ser sobrecarregada além de sua capacidadeKwh.

### BUG-04 — `editarProposta()` aceita qualquer valor sem validação (ALTO)
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:385-397`
**Severidade:** ALTA
```typescript
return this.prisma.propostaCooperado.update({
  where: { id: propostaId },
  data: data as any,  // ← cast perigoso
});
```
**Descrição:** Permite alterar `descontoPercentual`, `kwhContrato`, `status` sem nenhuma validação. O `as any` bypassa totalmente a tipagem. Possível definir desconto > 100%, kWh negativo, ou status inválido.
**Impacto:** Dados financeiros incorretos, quebra de regras de negócio.

### BUG-05 — Race condition na posição da ListaEspera (MÉDIO)
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:327`
**Severidade:** MÉDIA
```typescript
const posicao = await this.prisma.listaEspera.count({ where: { status: 'AGUARDANDO' } });
// posicao + 1 atribuído ao novo
```
**Descrição:** Se duas propostas forem aceitas simultaneamente e ambas caírem em lista de espera, o `count()` pode retornar o mesmo valor para ambas, resultando em duas entradas com mesma posição.
**Impacto:** Ordem da fila inconsistente, possível injustiça na alocação.

### BUG-06 — Exclusão de proposta ACEITA não reposiciona fila (MÉDIO)
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:377`
**Severidade:** MÉDIA
**Descrição:** `excluirProposta()` executa `deleteMany` na ListaEspera do contrato encerrado, mas não recalcula a `posicao` das entradas remanescentes. Resultado: gaps na fila (posição 1, 3, 5...).
**Impacto:** UX confusa na tela de lista de espera; posições não refletem ordem real.

### BUG-07 — Dashboard usa métrica diferente da proposta para "média cooperativa" (MÉDIO)
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:565-570` vs `79-86`
**Severidade:** MÉDIA
**Descrição:** O cálculo da proposta (linha 79-86) calcula média cooperativa como `média(valorLiquido / kwhContrato)` das cobranças ativas. O dashboard (linha 565-570) calcula como `média(cotaKwhMensal)` dos cooperados ativos. São métricas fundamentalmente diferentes (R$/kWh vs kWh). O KPI exibido no dashboard não corresponde ao valor usado nos cálculos.
**Impacto:** Operador vê um número no dashboard que não representa o que é usado no motor.

### BUG-08 — DTOs sem decorators de validação (MÉDIO)
**Arquivo:** `backend/src/motor-proposta/dto/calcular-proposta.dto.ts:1-15`
**Arquivo:** `backend/src/motor-proposta/dto/configuracao-motor.dto.ts`
**Arquivo:** `backend/src/motor-proposta/dto/tarifa-concessionaria.dto.ts`
**Arquivo:** `backend/src/planos/dto/create-plano.dto.ts`
**Severidade:** MÉDIA
**Descrição:** Nenhum DTO usa decorators do `class-validator` (`@IsNumber`, `@IsString`, `@Min`, `@Max`, `@IsNotEmpty`). Mesmo com `ValidationPipe` global, os DTOs passam qualquer payload sem validação. Valores negativos, strings onde deveria haver números, arrays vazios — tudo é aceito.
**Impacto:** Erros silenciosos, cálculos com NaN, possível crash do servidor.

### BUG-09 — `criarTarifa()` e `atualizarTarifa()` usam `as any` (BAIXO)
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:411-413, 429-432`
**Severidade:** BAIXA
**Descrição:** Spread do DTO com `as any` bypassa verificação de tipos. Campos extras no payload seriam silenciosamente aceitos pelo Prisma.
**Impacto:** Possível injeção de campos não previstos no banco.

### BUG-10 — Frontend silencia erros ao carregar histórico de propostas (BAIXO)
**Arquivo:** `web/app/dashboard/cooperados/[id]/page.tsx:623-630`
**Severidade:** BAIXA
```typescript
} catch {
  // silently ignore
}
```
**Descrição:** Se a API de histórico falhar, o usuário não recebe nenhum feedback. A aba de propostas fica vazia sem explicação.
**Impacto:** UX degradada; operador pode pensar que não há histórico quando na verdade houve erro de rede.

---

## 2. DADOS AUSENTES

### DA-01 — Proposta sem vínculo direto com Contrato
**Arquivo:** `backend/prisma/schema.prisma` (modelo PropostaCooperado, linhas 401-435)
**Descrição:** O modelo `PropostaCooperado` não tem FK para `Contrato`. O único vínculo é indireto (mesmo cooperadoId + janela temporal de 60s). Impossível rastrear qual proposta gerou qual contrato.
**Recomendação:** Adicionar campo `contratoId` (opcional) em PropostaCooperado.

### DA-02 — Proposta não registra dados de tarifa vigente na época
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:218-249`
**Descrição:** A proposta grava `tusdUtilizada` e `teUtilizada`, mas não grava o `tarifaConcessionariaId`. Se a tarifa for alterada/excluída, perde-se a rastreabilidade de qual tarifa foi usada no cálculo.
**Recomendação:** Adicionar `tarifaId` no modelo PropostaCooperado.

### DA-03 — Campo `validaAte` nunca é verificado
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:214-215`
**Descrição:** A proposta recebe `validaAte = now + 30 dias`, mas nenhum endpoint verifica se a proposta expirou. Propostas vencidas podem ser editadas, aceitas novamente, ou aparecem como "ACEITA" indefinidamente.
**Recomendação:** Adicionar verificação de expiração em `aceitar()`, `editarProposta()`, e no dashboard.

### DA-04 — Plano não é vinculado na proposta ao calcular
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:244-245`
**Descrição:** O `planoId` na proposta é gravado como `dto.planoId ?? null`. O frontend nunca envia `planoId` no payload de `aceitar()` (ver `web/app/dashboard/cooperados/[id]/page.tsx:597-601`). Resultado: todas as propostas têm `planoId = null`.
**Impacto:** O plano é resolvido apenas no contrato (linha 254-258) pegando o primeiro ativo, mas a proposta nunca registra qual plano foi considerado.

### DA-05 — ListaEspera sem `dataAlocacao`
**Arquivo:** `backend/prisma/schema.prisma:437-450`
**Descrição:** Quando uma entrada é alocada (`status: 'ALOCADO'`), o timestamp da alocação não é registrado. Só existe `updatedAt` genérico.
**Recomendação:** Adicionar campo `dataAlocacao DateTime?`.

### DA-06 — Contrato criado pelo motor não registra `dataFim`
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:311-323`
**Descrição:** O contrato é criado com `dataInicio: new Date()` mas sem `dataFim`. O campo existe no schema mas nunca é preenchido pelo motor-proposta.
**Impacto:** Impossível saber vigência do contrato; sem base para renovação automática.

### DA-07 — `cotaKwhMensal` nunca é calculada pelo motor
**Arquivo:** `backend/prisma/schema.prisma` (modelo Cooperado) e `motor-proposta.service.ts`
**Descrição:** O campo `cotaKwhMensal` do cooperado é usado no dashboard (linha 567-569) mas nunca é atualizado pelo motor-proposta ao criar contrato. Apenas `cooperados.service.ts` calcula `percentualUsina` ao ativar, mas `cotaKwhMensal` depende de outro fluxo não implementado.

---

## 3. REGRAS DE NEGÓCIO AUSENTES

### RN-01 — Sem controle de vigência de propostas
**Descrição:** Propostas têm `validaAte` mas nenhum mecanismo (cron, middleware, ou query filter) para expirar propostas automaticamente. O status nunca muda de 'PENDENTE' para 'EXPIRADA'.
**Impacto:** Propostas com tarifas desatualizadas ficam válidas indefinidamente.
**Recomendação:** Implementar job periódico ou verificação on-read que atualize status para 'EXPIRADA' quando `validaAte < now()`.

### RN-02 — Sem limite de propostas por cooperado/período
**Descrição:** Um cooperado pode gerar infinitas propostas sem aceitar nenhuma. O endpoint `calcular` não limita frequência.
**Impacto:** Possível abuso de recursos; histórico poluído com propostas de teste.
**Recomendação:** Limitar a N propostas pendentes por cooperado ou por período.

### RN-03 — Sem recusa explícita de proposta
**Descrição:** O frontend mostra status "RECUSADA" com cor vermelha (cooperados/[id]/page.tsx), mas o backend não tem endpoint para recusar proposta. Só existe aceitar, editar, e excluir.
**Impacto:** Status "RECUSADA" é exibido mas nunca atribuído; lógica inconsistente.
**Recomendação:** Adicionar endpoint `PUT /motor-proposta/proposta/:id/recusar`.

### RN-04 — Sem regra de reajuste automático/periódico
**Descrição:** O módulo de reajustes permite simular e aplicar manualmente, mas não há mecanismo de agendamento. A configuração tem `diaAplicacaoAnual` e `mesAplicacaoAnual` (configuracao-motor.dto.ts), mas nenhum scheduler os usa.
**Impacto:** Campos de configuração de data existem no frontend mas são decorativos; reajuste sempre manual.

### RN-05 — Sem notificação ao cooperado sobre proposta calculada
**Descrição:** Notificações são enviadas para ListaEspera e contrato criado, mas não quando a proposta é calculada. O cooperado (se tiver acesso ao portal) não sabe que há uma proposta pendente.

### RN-06 — Sem auditoria de quem calculou/aceitou/editou a proposta
**Descrição:** Nenhum campo registra o `usuarioId` que executou a ação. Impossível rastrear qual operador calculou, aceitou ou editou uma proposta.
**Recomendação:** Adicionar `criadoPor`/`aceitoPor` na PropostaCooperado.

### RN-07 — Sem validação de status do cooperado ao calcular proposta
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:67`
**Descrição:** O método `calcular()` aceita qualquer `cooperadoId` sem verificar se o cooperado está ATIVO, SUSPENSO, etc. Possível calcular proposta para cooperado ENCERRADO.

### RN-08 — Planos não integrados ao cálculo do motor
**Descrição:** O módulo `planos/` tem campos como `descontoBase`, `descontoPromocional`, `mesesPromocao`, mas o motor-proposta ignora completamente esses valores. O desconto vem exclusivamente da `ConfiguracaoMotor.descontoPadrao`. A existência do Plano é apenas para vinculação nominal.
**Impacto:** Criar diferentes planos com diferentes descontos não afeta o cálculo — contradiz a expectativa do CRUD de planos.

---

## 4. REGRAS DE NEGÓCIO DEFEITUOSAS

### RD-01 — Desconto ajustado pode resultar em valor cooperado negativo
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:114-118`
```typescript
const descontoNecessario = ((kwhApuradoBase - mediaCooperativaKwh) / tarifaUnitSemTrib) * 100;
descontoPercentual = Math.min(descontoNecessario, descontoMax);
descontoAbsoluto = tarifaUnitSemTrib * (descontoPercentual / 100);
valorCooperado = kwhApuradoBase - descontoAbsoluto;
```
**Descrição:** Se `kwhApuradoBase` (preço/kWh da fatura) for significativamente maior que `mediaCooperativaKwh` E `descontoMax` for alto (ex: 50%), o `descontoNecessario` pode exceder 100%, mas é cappado no `descontoMax`. Porém, se a diferença `kwhApuradoBase - mediaCooperativaKwh` for menor que o desconto aplicado com `descontoMax`, pode haver cenários onde o ajuste é insuficiente. Mais grave: se `descontoMax` permitir, `valorCooperado` poderia ficar negativo quando `descontoAbsoluto > kwhApuradoBase`.
**Recomendação:** Adicionar `valorCooperado = Math.max(valorCooperado, 0)` e validar `descontoPercentual <= 100`.

### RD-02 — Outlier detectado apenas para cima, nunca para baixo
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:99`
```typescript
const outlierDetectado = kwhMesRecente > kwhMedio12m * threshold;
```
**Descrição:** Outlier é detectado apenas quando consumo recente é MUITO MAIOR que a média. Consumo atipicamente BAIXO (ex: cooperado viajou, residência vazia) não é detectado. Isso pode gerar propostas com kWh de contrato muito baixo, prejudicando o cooperado em meses normais.
**Recomendação:** Considerar detecção bidirecional: `kwhMesRecente < kwhMedio12m / threshold`.

### RD-03 — Alocação de usina pega a primeira com vaga, sem critério
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:280-298`
**Descrição:** A busca por usina usa `findMany` sem ordenação, e o `for...break` pega a primeira com capacidade suficiente. Não considera: proximidade geográfica, % de ocupação, status de homologação, ou preferência do cooperado. A usina pode estar CADASTRADA (não homologada) e mesmo assim ser alocada.
**Recomendação:** Filtrar por `statusHomologacao: 'EM_PRODUCAO'` no mínimo; idealmente ordenar por ocupação ou proximidade.

### RD-04 — Re-aceitar proposta cancela anterior mas não encerra contrato anterior
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:198-211`
**Descrição:** Ao aceitar nova proposta para mesmo cooperado/mês, as propostas anteriores são marcadas como CANCELADA, mas os contratos associados às propostas anteriores NÃO são encerrados. Resultado: cooperado pode ter múltiplos contratos PENDENTE_ATIVACAO ou LISTA_ESPERA para o mesmo mês.
**Impacto:** Contratos duplicados, possível alocação dupla de capacidade na usina.

### RD-05 — `confirmarOpcao()` é apenas alias de `calcular()`
**Arquivo:** `backend/src/motor-proposta/motor-proposta.service.ts:186-188`
```typescript
async confirmarOpcao(dto: CalcularPropostaDto) {
  return this.calcular(dto);
}
```
**Descrição:** O endpoint de confirmação da opção de outlier simplesmente recalcula tudo do zero. Se a tarifa ou média cooperativa mudou entre o cálculo original e a confirmação, os valores serão diferentes do que foi apresentado ao operador. A escolha "MES_RECENTE" ou "MEDIA_12M" poderia resultar em números diferentes dos mostrados na tela.
**Recomendação:** Armazenar o cálculo original e retornar a opção selecionada, ou no mínimo avisar se houve alteração.

---

## 5. MELHORIAS

### UX

| # | Melhoria | Arquivo | Impacto |
|---|----------|---------|---------|
| M-01 | Exibir validade da proposta (`validaAte`) no card de resultado e no histórico | `web/app/dashboard/cooperados/[id]/page.tsx` | Operador sabe prazo para aceitar |
| M-02 | Permitir seleção de plano na tela de proposta antes de aceitar | `web/app/dashboard/cooperados/[id]/page.tsx:595-601` | Plano correto vinculado desde o início |
| M-03 | Mostrar capacidade restante da usina alocada na confirmação | `web/app/dashboard/cooperados/[id]/page.tsx` | Operador valida a alocação |
| M-04 | Na lista de espera, mostrar tempo de espera (dias desde criação) | `web/app/dashboard/motor-proposta/lista-espera/page.tsx` | Visibilidade de SLA |
| M-05 | Dashboard de propostas deveria mostrar taxa de conversão (calculadas vs aceitas) | `web/app/dashboard/motor-proposta/page.tsx` | KPI operacional relevante |
| M-06 | Status "EXPIRADA" no frontend sem endpoint correspondente gera confusão | `web/app/dashboard/cooperados/[id]/page.tsx` (mapeamento de cores) | Alinhar status frontend/backend |

### Arquitetura

| # | Melhoria | Descrição |
|---|----------|-----------|
| M-07 | Extrair lógica de cálculo puro em módulo separado (sem I/O) | O `calcular()` mistura busca de dados e cálculo. A função pura facilitaria testes e reutilização |
| M-08 | Usar `prisma.$transaction` em `aceitar()` | Garantir atomicidade das 7 operações |
| M-09 | Criar enum Prisma para `PropostaCooperado.status` | Atualmente é `String` livre; deveria ser enum como `StatusContrato` |
| M-10 | Adicionar FK `PropostaCooperado.contratoId` | Elimina heurística temporal de 60s |
| M-11 | Implementar soft-delete em propostas | `excluirProposta()` faz DELETE físico; perde histórico de auditoria |
| M-12 | Separar controller de tarifas e reajustes em controllers próprios | Controller com 115 linhas e ~15 endpoints mistura domínios diferentes |

### Performance

| # | Melhoria | Arquivo | Descrição |
|---|----------|---------|-----------|
| M-13 | Média cooperativa recalculada a cada `calcular()` | `service.ts:79-86` | Query pesada em cobranças; cachear com TTL de 5-15 min |
| M-14 | Busca de todas as usinas com contratos a cada proposta | `service.ts:280-288` | Adicionar índice em `contratos.usinaId + status` e filtrar por `statusHomologacao` |
| M-15 | Dashboard faz 5 queries independentes sem paralelismo | `service.ts:552-579` | Usar `Promise.all` ou query composta |

---

## 6. RESUMO EXECUTIVO — TOP 5 PRIORIDADES

| Prioridade | ID | Título | Tipo | Justificativa |
|:---:|:---:|--------|------|---------------|
| **1** | BUG-01 | `aceitar()` sem transação Prisma | Bug Crítico | Qualquer falha parcial corrompe dados financeiros. Contratos órfãos, propostas sem contrato, lista de espera inconsistente. **Correção imediata.** |
| **2** | RD-04 + BUG-02 | Re-aceitar não encerra contrato anterior + heurística 60s | Bug + Regra Defeituosa | Combinação gera contratos duplicados e a exclusão pode afetar contratos errados. Resolver ambos com FK `PropostaCooperado.contratoId`. |
| **3** | BUG-03 + RD-03 | Alocação sem validação de capacidade e sem filtro de status usina | Bug Alto | Usinas podem ser sobrecarregadas e usinas não homologadas podem receber contratos. Risco operacional e regulatório. |
| **4** | BUG-08 | DTOs sem validação | Bug Médio | Todos os endpoints aceitam payloads malformados. Barreira de segurança básica ausente. Adicionar `class-validator` em todos os DTOs. |
| **5** | RN-08 + DA-04 | Planos desintegrados do motor | Regra Ausente | CRUD de planos existe mas é ignorado pelo cálculo. Operador configura planos pensando que afetam a proposta — mas não afetam. Alinhar expectativa ou remover funcionalidade enganosa. |

---

*Relatório gerado automaticamente. Nenhuma alteração foi realizada no código.*
