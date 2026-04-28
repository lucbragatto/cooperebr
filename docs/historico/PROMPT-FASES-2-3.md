# TAREFA: Implementar Fases 2 e 3 do Clube de Vantagens — CoopereBR

Você é um engenheiro sênior. A Fase 1 já foi implementada (tiers, badge, schema, módulo clube-vantagens). Execute as Fases 2 e 3 abaixo em sequência.

Backend NestJS em backend/src, frontend Next.js em web/app.

---

# FASE 2 — Notificações WhatsApp + Ações em Lote

## 2.1 WhatsappCicloVidaService
Crie backend/src/whatsapp/whatsapp-ciclo-vida.service.ts

Primeiro leia os serviços WhatsApp existentes (whatsapp-bot.service.ts, whatsapp-cobranca.service.ts, etc.) para entender como o envio de mensagens funciona e usar o mesmo padrão.

Métodos:
- `notificarMembroCriado(cooperado)` — "👋 Bem-vindo à cooperativa! Acesse seu portal: {link}"
- `notificarDocumentoAprovado(cooperado)` — "✅ Seus documentos foram aprovados! Estamos preparando seu contrato."
- `notificarDocumentoReprovado(cooperado, motivo)` — "❌ Documento reprovado: {motivo}. Por favor, envie novamente."
- `notificarContratoGerado(cooperado, linkContrato)` — "📋 Seu contrato está pronto para assinatura: {link}"
- `notificarConcessionariaAprovada(cooperado)` — "⚡ Cadastro aprovado pela concessionária! Em breve você receberá créditos de energia solar."
- `notificarCreditosIniciados(cooperado)` — "🌞 Seus créditos solares começaram! Acesse: {linkPortal}"
- `notificarPagamentoConfirmado(cooperado, valor, mesRef)` — "✅ Pagamento de R$ {valor} referente a {mesRef} confirmado. Obrigado!"
- `notificarCobrancaVencida(cooperado, valor, diasAtraso)` — "⚠️ Você tem uma cobrança vencida há {n} dias no valor de R$ {valor}. Regularize para evitar multa."
- `notificarIndicadoCadastrou(indicador, nomeIndicado)` — "🎉 {nomeIndicado} se cadastrou pelo seu convite! Quando pagar a primeira fatura, você receberá seu benefício."
- `notificarIndicadoPagou(indicador, nomeIndicado, beneficio)` — "💰 {nomeIndicado} pagou a fatura! Seu benefício de {beneficio} foi gerado."
- `notificarNivelPromovido(cooperado, nivelAnterior, nivelNovo, beneficioPercentual)` — "🏆 Parabéns! Você subiu para o nível {nivelNovo} no Clube de Vantagens! Novo benefício: {beneficioPercentual}% por indicação."
- `notificarResumoMensal(cooperado, dados: { nivelAtual, indicadosAtivos, beneficioMes, beneficioTotal, kwhAcumulado, linkIndicacao })` — resumo mensal formatado

Injete no construtor o serviço de envio WhatsApp já existente.

## 2.2 Integrar notificações no ciclo de vida
Leia cada arquivo antes de editar. Adicione as chamadas:
- `backend/src/cooperados/cooperados.service.ts` → após criar cooperado: `whatsappCicloVida.notificarMembroCriado(cooperado)`
- Onde documentos são aprovados/reprovados (verifique DocumentosService ou similar): adicionar notificações
- `backend/src/contratos/contratos.service.ts` → após gerar contrato: `notificarContratoGerado`
- `backend/src/cobrancas/cobrancas.service.ts` → após darBaixa: `notificarPagamentoConfirmado` + verificar se há indicadores e chamar `notificarIndicadoPagou` + se houve promoção de nível chamar `notificarNivelPromovido`
- `backend/src/indicacoes/indicacoes.service.ts` → após registrar indicação: `notificarIndicadoCadastrou` para o indicador

## 2.3 Endpoints batch no backend
Em `backend/src/cooperados/cooperados.controller.ts` e `cooperados.service.ts`, adicione:

**Controller:**
```
POST /cooperados/batch/whatsapp   @Roles(ADMIN, SUPER_ADMIN)
POST /cooperados/batch/reajuste   @Roles(ADMIN, SUPER_ADMIN)
POST /cooperados/batch/beneficio  @Roles(ADMIN, SUPER_ADMIN)
POST /cooperados/batch/status     @Roles(ADMIN, SUPER_ADMIN)
```

**Service (cooperados.service.ts):**
- `enviarWhatsappLote(cooperadoIds, mensagem, cooperativaId)` — envia WhatsApp com delay de 3-5s entre envios, máx 50 por chamada
- `aplicarReajusteLote(cooperadoIds, percentual, motivo, cooperativaId)` — aplica reajuste em contratos ativos
- `aplicarBeneficioManualLote(dto, cooperativaId)` — cria BeneficioIndicacao manual para cada cooperado
- `alterarStatusLote(dto, cooperativaId)` — altera status em massa

## 2.4 Frontend — Checkbox + AcoesLote
Em `web/app/dashboard/cooperados/page.tsx`:
- Adicione estado `selecionados: string[]`
- Checkbox na primeira coluna (e select-all no header)
- Componente inline ou separado `AcoesLote` que aparece quando `selecionados.length > 0`
- Dropdown com opções: "📱 Enviar WhatsApp", "📊 Aplicar Reajuste", "🎁 Benefício Manual", "🔄 Alterar Status"
- Modal/form contextual por ação
- Após executar: limpar seleção e exibir toast de resultado

## 2.5 Cron resumo mensal do clube
Crie `backend/src/clube-vantagens/clube-vantagens.job.ts`:
```typescript
@Cron('0 9 1 * *') // Dia 1 de cada mês às 9h
async enviarResumosMensais() {
  // Buscar cooperados com indicadosAtivos > 0
  // Para cada um, montar dados e chamar notificarResumoMensal
}
```

## 2.6 Cron cobrança vencida
Em `backend/src/cobrancas/cobrancas.job.ts` (já existe), adicione um método:
```typescript
@Cron('0 6 * * *') // Diário às 6h
async notificarCobrancasVencidas() {
  // Buscar cobranças com vencimento === ontem e status PENDENTE/ATRASADA
  // Para cada uma, enviar notificarCobrancaVencida se ainda não notificou
  // Adicionar campo notificadoVencimento: Boolean ao modelo Cobranca (via prisma db push)
}
```

Após concluir Fase 2: `openclaw system event --text "Fase 2 concluida: Notificacoes WhatsApp e acoes em lote implementados" --mode now`

---

# FASE 3 — Condomínios + Avançado

## 3.1 Schema Prisma — Condomínios
Adicione ao `backend/prisma/schema.prisma` (leia o arquivo primeiro para não duplicar):

```prisma
enum ModeloRateioCondominio {
  PROPORCIONAL_CONSUMO
  IGUALITARIO
  FRACAO_IDEAL
  PERSONALIZADO
}

enum ExcedentePolitica {
  CREDITO_PROXIMO_MES
  PIX_MENSAL
  ABATER_TAXA_CONDOMINIO
}

enum TipoChavePix {
  CPF
  CNPJ
  EMAIL
  TELEFONE
  ALEATORIA
}

model Administradora {
  id                  String      @id @default(uuid())
  cooperativaId       String
  cooperativa         Cooperativa @relation(fields: [cooperativaId], references: [id])
  razaoSocial         String
  nomeFantasia        String?
  cnpj                String
  email               String
  telefone            String
  responsavelNome     String
  responsavelCpf      String?
  responsavelEmail    String?
  responsavelTelefone String?
  usuarioId           String?
  condominios         Condominio[]
  ativo               Boolean     @default(true)
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
  @@unique([cnpj, cooperativaId])
}

model Condominio {
  id                  String                 @id @default(uuid())
  cooperativaId       String
  cooperativa         Cooperativa            @relation(fields: [cooperativaId], references: [id])
  nome                String
  cnpj                String?
  endereco            String
  cidade              String
  estado              String
  cep                 String?
  administradoraId    String?
  administradora      Administradora?        @relation(fields: [administradoraId], references: [id])
  sindicoNome         String?
  sindicoCpf          String?
  sindicoEmail        String?
  sindicoTelefone     String?
  modeloRateio        ModeloRateioCondominio @default(PROPORCIONAL_CONSUMO)
  excedentePolitica   ExcedentePolitica      @default(CREDITO_PROXIMO_MES)
  excedentePixChave   String?
  excedentePixTipo    TipoChavePix?
  aliquotaIR          Float?                 @default(0)
  aliquotaPIS         Float?                 @default(0)
  aliquotaCOFINS      Float?                 @default(0)
  taxaAdministrativa  Float?                 @default(0)
  ativo               Boolean                @default(true)
  unidades            UnidadeCondominio[]
  createdAt           DateTime               @default(now())
  updatedAt           DateTime               @updatedAt
}

model UnidadeCondominio {
  id             String      @id @default(uuid())
  condominioId   String
  condominio     Condominio  @relation(fields: [condominioId], references: [id])
  numero         String
  cooperadoId    String?
  cooperado      Cooperado?  @relation(fields: [cooperadoId], references: [id])
  fracaoIdeal    Float?
  percentualFixo Float?
  ativo          Boolean     @default(true)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
}
```

Rode: `cd backend && npx prisma db push --skip-generate`

## 3.2 Módulo condominios NestJS
Crie `backend/src/condominios/` com module, service e controller:

**condominios.service.ts:**
- CRUD completo (create, findAll, findOne, update, remove)
- `adicionarUnidade(condominioId, dto)` / `removerUnidade(unidadeId)`
- `calcularRateio(condominioId, energiaTotal)` — implementar os 4 modelos:
  - PROPORCIONAL_CONSUMO: distribui kWh proporcional ao consumo médio de cada UC
  - IGUALITARIO: divide igualmente entre unidades ativas
  - FRACAO_IDEAL: usa fracaoIdeal de cada unidade
  - PERSONALIZADO: usa percentualFixo de cada unidade
- `processarExcedente(condominioId, valorExcedente)` — conforme excedentePolitica

**condominios.controller.ts:**
- GET /condominios — listar (ADMIN)
- POST /condominios — criar (ADMIN)
- GET /condominios/:id — detalhe com unidades
- PATCH /condominios/:id — atualizar
- DELETE /condominios/:id — desativar (soft delete)
- POST /condominios/:id/unidades — adicionar unidade
- DELETE /condominios/:id/unidades/:unidadeId — remover unidade

## 3.3 Módulo administradoras NestJS
Crie `backend/src/administradoras/` com CRUD completo (module, service, controller).
Endpoints: GET/POST /administradoras, GET/PATCH/DELETE /administradoras/:id

## 3.4 Frontend — Tela Condomínios
Crie `web/app/dashboard/condominios/`:
- `page.tsx` — listagem com busca, coluna de status, modelo de rateio, qtd unidades
- `novo/page.tsx` — formulário: dados básicos + unidades (lista com add/remove) + configuração rateio + configuração excedente
- `[id]/page.tsx` — detalhe: header com KPIs, lista de unidades com cooperados vinculados, aba config

## 3.5 Frontend — Tela Administradoras
Crie `web/app/dashboard/administradoras/`:
- `page.tsx` — listagem com busca
- `novo/page.tsx` — formulário de cadastro

## 3.6 Frontend — Ranking no portal
Crie `web/app/portal/ranking/page.tsx`:
- Busca do backend: GET /clube-vantagens/ranking (crie também esse endpoint no controller)
- Top 10 indicadores da cooperativa ordenados por kwhIndicadoAcumulado
- Posição atual do cooperado logado destacada
- BadgeNivelClube em cada linha
- Barra de progresso relativa ao 1º lugar

## 3.7 Frontend — Dashboard analytics do Clube
Crie `web/app/dashboard/clube-vantagens/page.tsx`:
- Cards: total membros no clube, indicados ativos total, receita gerada pelo clube, kWh indicado total
- Gráfico pizza (recharts): distribuição por nível (Bronze/Prata/Ouro/Diamante)
- Lista top 10 indicadores com badge
- Crie endpoint backend GET /clube-vantagens/analytics (ADMIN) que retorne esses dados agregados

## 3.8 Menu conversacional WhatsApp aprimorado
Em `backend/src/whatsapp/whatsapp-bot.service.ts`:

Adicione novos estados ao fluxo de conversa:
- `MENU_CONVITE` — lead recebeu convite, aguardando resposta
- `AGUARDANDO_FOTO_FATURA` — aguardando envio da foto da conta de luz
- `AGUARDANDO_CONFIRMACAO_PROPOSTA` — proposta exibida, aguardando sim/não
- `AGUARDANDO_NOME` — coletando nome
- `AGUARDANDO_CPF` — coletando CPF
- `AGUARDANDO_EMAIL` — coletando email
- `AGUARDANDO_CONFIRMACAO_DADOS` — confirmação final dos dados

Fluxo quando lead com referência de indicação responde:
1. Envia menu: "Olá! 👋 Você foi indicado por {indicador}. Quer economizar na conta de luz? 1️⃣ Sim, quero saber mais  2️⃣ Não tenho interesse"
2. Se "1": "Ótimo! Envie uma foto da sua conta de luz (frente completa) 📸"
3. Ao receber imagem: processa OCR (use serviço existente), exibe proposta com economia estimada, pergunta "Quer continuar? 1️⃣ Sim  2️⃣ Não"
4. Se "1": coleta nome → CPF → email → confirmação → cria cooperado + indicação
5. Notifica indicador a cada avanço

Preserve os estados existentes (INICIAL, AGUARDANDO_CONFIRMACAO_DADOS, etc.) e só adicione os novos.

Após concluir Fase 3: `openclaw system event --text "Fase 3 concluida: Condominios, administradoras, ranking, analytics e WhatsApp conversacional implementados. Clube de Vantagens completo!" --mode now`

---

# REGRAS
- Leia os arquivos antes de editar. Nunca sobrescreva lógica existente.
- Use padrões do projeto: @ContextoAtivo(), @Roles(), DTOs, guards existentes.
- Se módulo já existir parcialmente, complete em vez de recriar.
- Frontend: shadcn/ui e Tailwind já configurados. Use recharts (já instalado).
- Execute Fase 2 completa → depois Fase 3 completa. Não pule etapas.
- Não aguarde confirmação entre fases.
