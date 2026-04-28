# TAREFA: Implementar Clube de Vantagens no CoopereBR

Você é um engenheiro sênior. Execute as 3 fases abaixo em sequência. Backend NestJS em backend/src, frontend Next.js em web/app.

Leia antes de começar: C:\Users\Luciano\cooperebr\RELATORIO-AUDITORIA-CLUBE-VANTAGENS.md

---

# FASE 1 — Tiers + Badge

## 1.1 Schema Prisma
Adicione ao backend/prisma/schema.prisma os seguintes modelos (leia o arquivo primeiro para não duplicar):

```prisma
enum NivelClube {
  BRONZE
  PRATA
  OURO
  DIAMANTE
}

enum CriterioProgressao {
  KWH_INDICADO_ACUMULADO
  NUMERO_INDICADOS_ATIVOS
  RECEITA_INDICADOS
}

model ConfigClubeVantagens {
  id              String             @id @default(uuid())
  cooperativaId   String             @unique
  cooperativa     Cooperativa        @relation(fields: [cooperativaId], references: [id])
  ativo           Boolean            @default(false)
  criterio        CriterioProgressao @default(KWH_INDICADO_ACUMULADO)
  niveisConfig    Json               @default("[]")
  bonusAniversario Float?            @default(0)
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
}

model ProgressaoClube {
  id                       String      @id @default(uuid())
  cooperadoId              String      @unique
  cooperado                Cooperado   @relation(fields: [cooperadoId], references: [id])
  nivelAtual               NivelClube  @default(BRONZE)
  kwhIndicadoAcumulado     Float       @default(0)
  indicadosAtivos          Int         @default(0)
  receitaIndicados         Float       @default(0)
  beneficioPercentualAtual Float       @default(0)
  beneficioReaisKwhAtual   Float       @default(0)
  dataUltimaPromocao       DateTime?
  dataUltimaAvaliacao      DateTime?
  createdAt                DateTime    @default(now())
  updatedAt                DateTime    @updatedAt
  historico                HistoricoProgressao[]
}

model HistoricoProgressao {
  id               String          @id @default(uuid())
  progressaoId     String
  progressao       ProgressaoClube @relation(fields: [progressaoId], references: [id])
  nivelAnterior    NivelClube
  nivelNovo        NivelClube
  kwhAcumulado     Float
  indicadosAtivos  Int
  receitaAcumulada Float
  motivo           String
  createdAt        DateTime        @default(now())
}
```

Adicione na model Cooperado: `progressaoClube  ProgressaoClube?`
Adicione na model Cooperativa: `configClubeVantagens ConfigClubeVantagens?`

## 1.2 db push
```
cd backend
npx prisma db push --skip-generate
```

## 1.3 Módulo clube-vantagens NestJS
Crie backend/src/clube-vantagens/ com module, service e controller.

**clube-vantagens.service.ts** — métodos:
- `criarOuObterProgressao(cooperadoId)` — cria ProgressaoClube BRONZE se não existir
- `avaliarProgressao(cooperadoId)` — verifica promoção de nível. Lê ConfigClubeVantagens da cooperativa do cooperado. Compara kwhIndicadoAcumulado com niveisConfig. Só promove, nunca rebaixa. Se promoveu: cria HistoricoProgressao, atualiza beneficioPercentualAtual. Retorna { promovido, nivelAnterior, nivelNovo }
- `atualizarMetricas(cooperadoId, deltaKwh, deltaReceita)` — incrementa métricas, chama avaliarProgressao
- `getProgressao(cooperadoId)` — retorna ProgressaoClube com historico
- `recalcularIndicadosAtivos(cooperadoId)` — conta indicacoes ativas e atualiza
- `upsertConfig(cooperativaId, dto)` — cria ou atualiza ConfigClubeVantagens

**clube-vantagens.controller.ts** — endpoints:
- GET /clube-vantagens/config — config da cooperativa do usuário logado (ADMIN)
- PUT /clube-vantagens/config — atualizar config (ADMIN)
- GET /clube-vantagens/minha-progressao — progressao do cooperado logado (COOPERADO)
- GET /clube-vantagens/cooperado/:id — progressao de cooperado (ADMIN)

## 1.4 Hook em CobrancasService
Em backend/src/cobrancas/cobrancas.service.ts:
- No método que processa pagamento confirmado (darBaixa ou similar)
- Após confirmar baixa, busque a indicação do cooperado pagante
- Para cada indicador: chame `clubeVantagensService.atualizarMetricas(indicadorId, kwhEntregue, valorPago)`
- Injete ClubeVantagensService via construtor

## 1.5 Hook em IndicacoesService
Em backend/src/indicacoes/indicacoes.service.ts:
- No método registrarIndicacao ou processarPrimeiraFaturaPaga
- Chame `clubeVantagensService.criarOuObterProgressao(indicadorId)`
- Após criar indicação, chame `clubeVantagensService.recalcularIndicadosAtivos(indicadorId)`

## 1.6 Frontend — BadgeNivelClube
Crie web/components/BadgeNivelClube.tsx:
- Props: nivel (NivelClube), beneficioAtivo (boolean), indicados (number)
- Configuração: BRONZE=🥉 bg-amber-700, PRATA=🥈 bg-gray-400, OURO=🥇 bg-yellow-500, DIAMANTE=💎 bg-blue-500
- Exibe badge com ícone+label, ponto verde se benefício ativo, contagem de indicados

## 1.7 Frontend — Badge na listagem de membros
Em web/app/dashboard/cooperados/page.tsx (ou arquivo correto):
- Adicione coluna "Clube" na tabela
- Inclua progressaoClube no include do fetch
- Exiba BadgeNivelClube

## 1.8 Frontend — Card no portal do cooperado
Em web/app/portal/indicacoes/page.tsx:
- Adicione card: nível atual (badge), kWh acumulado, indicados ativos, benefício %
- Barra de progresso para o próximo nível

## 1.9 Frontend — Config do clube na cooperativa
Em alguma tela de configurações do dashboard (ou crie web/app/dashboard/clube-vantagens/config/page.tsx):
- Toggle ativar/desativar clube
- Tabela editável com os 4 níveis (kwhMinimo, kwhMaximo, beneficioPercentual)

Após concluir Fase 1: `openclaw system event --text "Fase 1 concluida: Clube de Vantagens com tiers Bronze-Diamante implementado" --mode now`

---

# FASE 2 — Notificações WhatsApp + Ações em Lote

## 2.1 WhatsappCicloVidaService
Crie backend/src/whatsapp/whatsapp-ciclo-vida.service.ts

Métodos (use o serviço WhatsApp já existente para envio):
- `notificarMembroCriado(cooperado)` — boas-vindas com link do portal
- `notificarDocumentoAprovado(cooperado)` — "✅ Documentos aprovados!"
- `notificarDocumentoReprovado(cooperado, motivo)` — "❌ Documento reprovado: {motivo}"
- `notificarContratoGerado(cooperado, linkContrato)` — "📋 Contrato disponível para assinatura"
- `notificarConcessionariaAprovada(cooperado)` — "⚡ Cadastro aprovado pela concessionária!"
- `notificarCreditosIniciados(cooperado)` — "🌞 Seus créditos solares começaram!"
- `notificarPagamentoConfirmado(cooperado, valor, mesRef)` — "✅ Pagamento de R$ {valor} confirmado"
- `notificarCobrancaVencida(cooperado, valor, diasAtraso)` — "⚠️ Cobrança vencida há {n} dias"
- `notificarIndicadoCadastrou(indicador, nomeIndicado)` — "🎉 {nome} se cadastrou pelo seu convite!"
- `notificarIndicadoPagou(indicador, nomeIndicado, beneficio)` — "💰 {nome} pagou! Benefício gerado."
- `notificarNivelPromovido(cooperado, nivelAnterior, nivelNovo, beneficioPercentual)` — "🏆 Você subiu para {nivel}!"
- `notificarResumoMensal(cooperado, dados)` — resumo do mês com KPIs do clube

## 2.2 Integrar notificações no ciclo de vida
- CooperadosService.create() → notificarMembroCriado
- Onde documentos são aprovados/reprovados → notificações correspondentes
- ContratosService → notificarContratoGerado após gerar
- CobrancasService.darBaixa() → notificarPagamentoConfirmado + notificarIndicadoPagou + notificarNivelPromovido (se promoveu)
- IndicacoesService → notificarIndicadoCadastrou quando indicação é registrada

## 2.3 Endpoints batch
Em backend/src/cooperados/cooperados.controller.ts e cooperados.service.ts:
- POST /cooperados/batch/whatsapp — { cooperadoIds: string[], mensagem: string } — delay 3-5s entre envios, máx 50 por vez, role ADMIN
- POST /cooperados/batch/reajuste — { cooperadoIds: string[], percentual: number, motivo: string } — role ADMIN
- POST /cooperados/batch/beneficio — { cooperadoIds: string[], tipo: 'PERCENTUAL'|'VALOR_FIXO', valor: number, motivo: string } — role ADMIN
- POST /cooperados/batch/status — { cooperadoIds: string[], novoStatus: string, motivo: string } — role ADMIN

## 2.4 Frontend — Checkbox + AcoesLote
Em web/app/dashboard/cooperados/page.tsx:
- Checkbox em cada linha (e select-all no header da tabela)
- Componente AcoesLote que aparece quando selecionados.length > 0
- Dropdown com ações: WhatsApp, Reajuste, Benefício Manual, Alterar Status
- Formulário contextual por ação (ex: campo de mensagem para WhatsApp, % para reajuste)

## 2.5 Cron resumo mensal do clube
Em backend/src/clube-vantagens/ crie clube-vantagens.job.ts:
- Cron dia 1 às 9h: para cooperados com indicadosAtivos > 0, enviar resumo via notificarResumoMensal

## 2.6 Cron cobrança vencida
Em cobrancas.job.ts (já existe — adicione verificação):
- Cron diário 6h: cobranças vencidas há 1 dia sem notificação → notificarCobrancaVencida

Após concluir Fase 2: `openclaw system event --text "Fase 2 concluida: Notificacoes WhatsApp e acoes em lote implementados" --mode now`

---

# FASE 3 — Condomínios + Avançado

## 3.1 Schema Prisma — Condomínios
Adicione ao schema.prisma:

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
Crie backend/src/condominios/ com CRUD + service de rateio:
- `calcularRateio(condominioId, energiaTotal, mesRef, anoRef)` — 4 modelos de rateio
- `processarExcedente(condominioId, valorExcedente)` — conforme política configurada

## 3.3 Módulo administradoras NestJS
Crie backend/src/administradoras/ com CRUD completo.

## 3.4 Frontend — Tela Condomínios
Crie web/app/dashboard/condominios/:
- page.tsx — listagem com busca e status
- novo/page.tsx — cadastro (dados + unidades + rateio + excedente)
- [id]/page.tsx — detalhe com unidades, KPIs, edição

## 3.5 Frontend — Tela Administradoras
Crie web/app/dashboard/administradoras/:
- page.tsx — listagem
- novo/page.tsx — cadastro

## 3.6 Frontend — Ranking no portal
Crie web/app/portal/ranking/page.tsx:
- Top 10 indicadores da cooperativa (por kWh acumulado)
- Posição atual do cooperado logado em destaque
- Badge de nível de cada um

## 3.7 Frontend — Dashboard analytics do Clube
Crie web/app/dashboard/clube-vantagens/page.tsx:
- Gráfico pizza: distribuição de membros por nível
- Gráfico linha: evolução de indicações por mês (use recharts, já está no projeto)
- Lista top 10 indicadores
- Cards: total de membros no clube, receita gerada, kWh indicado total

## 3.8 Menu conversacional WhatsApp aprimorado
Em backend/src/whatsapp/whatsapp-bot.service.ts:
- Quando lead com código de indicação responde pela primeira vez: menu de boas-vindas numerado
- Guiar passo a passo: 1) enviar foto da conta → 2) OCR+proposta → 3) dados pessoais → 4) confirmação
- Mostrar progresso: "Passo 2 de 4"
- Salvar estado no ConversaWhatsapp existente (novos estados: AGUARDANDO_FOTO_FATURA, AGUARDANDO_DADOS_PESSOAIS, etc.)
- Notificar indicador em cada avanço

Após concluir Fase 3: `openclaw system event --text "Fase 3 concluida: Condominios, administradoras, ranking e WhatsApp conversacional implementados. Clube de Vantagens completo!" --mode now`

---

# REGRAS
- Leia os arquivos antes de editar. Nunca sobrescreva lógica existente sem entender.
- Use padrões existentes no projeto: DTOs, @ContextoAtivo(), @Roles(), guards, etc.
- Se módulo já existir parcialmente, complete em vez de recriar.
- Frontend: use shadcn/ui e Tailwind já configurados.
- Execute as fases em ordem: 1 → 2 → 3.
- Não aguarde confirmação entre fases — avance automaticamente.
