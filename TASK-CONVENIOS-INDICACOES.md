# Tarefa: Convênios + Indicações + Bugs

## BUG 1 — 404 em /cooperados/{id}/documentos

O frontend está chamando GET /cooperados/{id}/documentos mas a rota correta no backend é GET /documentos/cooperado/{cooperadoId}.

### Fix
Buscar todos os arquivos do frontend que chamam `/cooperados/${id}/documentos` ou `/cooperados/${cooperadoId}/documentos` e corrigir para `/documentos/cooperado/${id}`.

Fazer busca em web/app e web/components por esse padrão e corrigir todas as ocorrências.

## BUG 2 — CONV-02: MLM duplicado

Arquivo: backend/src/indicacoes/indicacoes.service.ts

O bug de 3 linhas duplicadas no MLM: ao registrar indicação, pode estar criando registros duplicados porque a verificação de existência não usa transação atômica.

Antes do `indicacoes.push(nivel 1)`, adicionar verificação:
```typescript
const jaExisteNivel1 = await this.prisma.indicacao.findFirst({
  where: { cooperadoIndicadorId: indicador.id, cooperadoIndicadoId, nivel: 1 }
});
if (jaExisteNivel1) {
  this.logger.warn(`Indicação nível 1 já existe para ${cooperadoIndicadoId} → ${indicador.id}`);
  return [jaExisteNivel1];
}
```

Mesma lógica no while (níveis 2+): antes de criar cada nível, verificar se já existe:
```typescript
const jaExiste = await this.prisma.indicacao.findFirst({
  where: { cooperadoIndicadorId: ancestral.id, cooperadoIndicadoId, nivel }
});
if (!jaExiste) {
  indicacoes.push(await this.prisma.indicacao.create({ ... }));
} else {
  indicacoes.push(jaExiste);
}
```

## BUG 3 — Convênios: rotas duplicadas + validação DTOs

Verificar e corrigir:
1. Os controllers convenios.controller.ts e convenios-portal.controller.ts ambos usam @Controller('convenios') — verificar se há conflito de rotas (GET /convenios/meus pode conflitar com GET /convenios/:id)
   - Fix: mover rota 'meus' ANTES de ':id' no controller ou garantir ordem correta
   - Verificar se o módulo registra os dois controllers e se há duplicação

2. Validação DTOs: verificar se o convenios.dto.ts tem DTOs com class-validator decorators. Se não tiver, adicionar validações básicas (IsString, IsOptional, IsNumber etc.) para os campos principais do ContratoConvenio.

## FEATURE 1 — Indicações ↔ Convênios: tierMinimo por convênio

### Schema
Arquivo: backend/prisma/schema.prisma, modelo ContratoConvenio

Adicionar campo:
```prisma
tierMinimoClube String? // null = sem requisito; 'BRONZE' | 'PRATA' | 'OURO' | 'DIAMANTE'
```

Aplicar com: cd backend && npx prisma db push

### Backend
Arquivo: backend/src/convenios/convenios.service.ts

No método de listagem de convênios disponíveis para o cooperado (se existir) ou ao retornar convênios:
- Incluir tierMinimoClube na resposta
- Se o cooperado tentar aderir a um convênio com tierMinimoClube, verificar o tier atual do cooperado em progressaoClube.nivelAtual
- Se tier insuficiente: retornar 403 com mensagem "Você precisa ser nível X para acessar este convênio"

Novo método checkTierRequisito(cooperadoId, convenioId):
```typescript
async checkTierRequisito(cooperadoId: string, convenioId: string) {
  const convenio = await prisma.contratoConvenio.findUnique({ where: { id: convenioId } });
  if (!convenio?.tierMinimoClube) return true; // sem requisito
  const progressao = await prisma.progressaoClube.findUnique({ where: { cooperadoId } });
  const ORDEM = { BRONZE: 0, PRATA: 1, OURO: 2, DIAMANTE: 3 };
  const tierAtual = progressao?.nivelAtual ?? 'BRONZE';
  return (ORDEM[tierAtual] ?? 0) >= (ORDEM[convenio.tierMinimoClube] ?? 0);
}
```

Chamar esse check no método de adesão ao convênio (POST /:id/membros).

### Frontend
Arquivo: web/app/dashboard/convenios/page.tsx e [id]/page.tsx (e equivalente em /parceiro/convenios)

No formulário de criação/edição de convênio, adicionar campo:
- Label: "Tier mínimo do Clube de Vantagens"
- Select: Sem requisito / Bronze / Prata / Ouro / Diamante
- Enviar como `tierMinimoClube`

Na listagem de convênios do portal do cooperado (web/app/portal/convenio/page.tsx), mostrar badge do tier mínimo se existir.

## FEATURE 2 — Convênios: modalidade GLOBAL vs STANDALONE + governança SISGD

### Conceito
- STANDALONE: convênio pertence ao parceiro, apenas seus membros acessam
- GLOBAL: convênio entra na rede SISGD, todos os parceiros com módulo global acessam
- SISGD pode cobrar taxa para aprovação de convênio global (valorTaxaAprovacao)
- SISGD aprova/rejeita convênios globais via painel super_admin

### Schema
Arquivo: backend/prisma/schema.prisma, modelo ContratoConvenio

Adicionar campos:
```prisma
modalidade       String  @default("STANDALONE") // STANDALONE | GLOBAL
statusAprovacao  String  @default("APROVADO")   // APROVADO | PENDENTE | REJEITADO (só GLOBAL usa)
motivoRejeicao   String?
taxaAprovacaoSisgd Decimal? @db.Decimal(10,2)   // valor que o parceiro paga ao SISGD para entrar na rede global
taxaAprovacaoPaga  Boolean @default(false)
```

Aplicar com: cd backend && npx prisma db push

### Backend
Arquivo: backend/src/convenios/convenios.service.ts

1. Ao criar convênio com modalidade GLOBAL: statusAprovacao = 'PENDENTE' automaticamente
2. Novo endpoint PATCH /convenios/:id/aprovar (somente SUPER_ADMIN): muda statusAprovacao para APROVADO
3. Novo endpoint PATCH /convenios/:id/rejeitar (somente SUPER_ADMIN): muda para REJEITADO com motivoRejeicao
4. Ao listar convênios disponíveis para cooperado: incluir convênios GLOBAL + APROVADO de qualquer parceiro (se o módulo convênios do parceiro estiver em modalidade GLOBAL)
5. Ao listar convênios do admin parceiro: filtrar por cooperativaId normalmente (vê os próprios + globais aprovados)

### Frontend

Arquivo: web/app/dashboard/convenios/novo/page.tsx e [id]/page.tsx

No formulário, adicionar:
- Campo "Modalidade": radio STANDALONE (só meus membros) / GLOBAL (rede SISGD)
- Se GLOBAL: mostrar aviso "Será enviado para aprovação do SISGD"
- Campo "Taxa de aprovação SISGD" (R$): mostrar se GLOBAL e informar que é o custo de entrada na rede

Arquivo: web/app/dashboard/saas/ — nova página ou aba para Super Admin aprovar convênios globais pendentes
- Lista de convênios com statusAprovacao = PENDENTE
- Botões Aprovar / Rejeitar com campo de motivo

## FEATURE 3 — Fluxo conversão créditos SEM_UC → dinheiro

### Contexto
Cooperados do tipo SEM_UC têm créditos de energia mas não têm UC para abater. O crédito deve poder ser convertido em dinheiro (PIX/depósito) ou repassado para outro cooperado.

### Schema
Verificar se existe modelo SaldoCredito ou similar. Buscar no schema por 'SEM_UC' e 'credito'.
Se não existir fluxo de conversão, criar:

```prisma
model ConversaoCreditoSemUc {
  id            String   @id @default(cuid())
  cooperadoId   String
  cooperado     Cooperado @relation(fields: [cooperadoId], references: [id])
  cooperativaId String
  valorKwh      Decimal  @db.Decimal(10,2)
  valorReais    Decimal  @db.Decimal(10,2)
  tarifaUsada   Decimal  @db.Decimal(10,4)
  status        String   @default("PENDENTE") // PENDENTE | APROVADO | PAGO | CANCELADO
  pixChave      String?
  pixNome       String?
  observacao    String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@map("conversoes_credito_sem_uc")
}
```

### Backend
Criar: backend/src/conversao-credito/ com controller, service, module

Endpoints:
- POST /conversao-credito/solicitar — cooperado solicita conversão (body: kwhDesejado, pixChave, pixNome)
- GET /conversao-credito/minhas — cooperado lista suas solicitações
- GET /conversao-credito (ADMIN) — admin lista todas pendentes da cooperativa
- PATCH /conversao-credito/:id/aprovar (ADMIN) — aprova e registra pagamento
- PATCH /conversao-credito/:id/cancelar — cancela

Lógica de cálculo: valorReais = kwhDesejado * tarifaVigente (buscar de ConfiguracaoCobranca ou campo da cooperativa)

Registrar no módulo AppModule.

### Frontend
Criar: web/app/portal/creditos/ — página do cooperado SEM_UC
- Mostrar saldo de kWh disponível
- Formulário de solicitação: quantos kWh converter, chave PIX
- Histórico de conversões

Criar: web/app/parceiro/conversoes/ ou web/app/dashboard/conversoes/ — para o admin aprovar
- Lista de solicitações pendentes com nome do cooperado, kWh, valor calculado
- Botões Aprovar (com confirmação de pagamento) / Cancelar

Adicionar item de menu no portal do cooperado (tipo SEM_UC): "Converter Créditos"

## ORDEM DE EXECUÇÃO
1. Bug 1 (404 documentos) — simples, só frontend
2. Bug 2 (MLM duplicado) — simples, só backend
3. Bug 3 (convênios rotas/DTOs)
4. Feature 1 (tierMinimo)
5. Feature 2 (GLOBAL/STANDALONE + governança SISGD)
6. Feature 3 (SEM_UC → dinheiro)

## APÓS CONCLUIR
Commit: 'feat: convenios global/standalone + tier minimo + sem_uc creditos + fixes'
Execute: openclaw system event --text "Done: convenios global/standalone, tier minimo clube, sem_uc creditos, bugs corrigidos" --mode now
