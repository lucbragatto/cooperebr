# RELATÓRIO DE AUDITORIA & PROPOSTA: CLUBE DE VANTAGENS
**CoopereBR — Plataforma de Gestão para Cooperativas de Energia Solar (GD)**
**Data:** 2026-03-26 | **Autor:** Arquiteto de Sistemas

---

## SUMÁRIO EXECUTIVO

O CoopereBR é um sistema multi-tenant para cooperativas de energia solar em Geração Distribuída, com backend NestJS (50 modelos Prisma, 30 módulos), frontend Next.js (88 páginas), e integração WhatsApp via Baileys. O sistema já possui um fluxo MLM funcional com 2 níveis, porém sem gamificação, sem tiers de progressão e sem visibilidade de benefícios na listagem de membros. Este relatório mapeia o estado atual e propõe a implementação completa do Clube de Vantagens.

---

# PARTE 1 — AUDITORIA DO SISTEMA ATUAL

## 1.1 Fluxo Completo do Ciclo de Vida do Membro

### Mapa de Etapas (Status: Implementado / Parcial / Ausente)

| # | Etapa | Status | Onde está | Observações |
|---|-------|--------|-----------|-------------|
| 1 | **Convite (link/QR/WhatsApp)** | ✅ Implementado | `WhatsappMlmService`, `/portal/indicacoes` | Link `/entrar?ref=CODIGO`, QR Code, compartilhamento WhatsApp |
| 2 | **Lead capturado** | ✅ Implementado | `WhatsappBotService` | Bot conversacional recebe lead, salva `ConversaWhatsapp` com estado INICIAL |
| 3 | **Cadastro wizard (admin)** | ✅ Implementado | `/dashboard/cooperados/novo` (7 steps) | Fatura→Dados→Simulação→Proposta→Documentos→Contrato→Alocação |
| 4 | **Cadastro via WhatsApp (self-service)** | ✅ Implementado | `WhatsappBotService` | 4 estados: INICIAL→AGUARDANDO_CONFIRMACAO_DADOS→PROPOSTA→CADASTRO→CONCLUIDO |
| 5 | **Proposta/Simulação** | ✅ Implementado | `MotorPropostaService`, Step3/Step4 wizard | Calcula economia com base em fatura OCR, envia link de aprovação |
| 6 | **Upload de documentos** | ✅ Implementado | `/portal/documentos`, Step5 wizard | RG, CNH, Contrato Social; status PENDENTE→APROVADO/REPROVADO |
| 7 | **Contrato gerado** | ✅ Implementado | `ContratosService`, Step6 wizard | Assinatura presencial ou digital, protocolo da concessionária |
| 8 | **Envio à concessionária** | ⚠️ Parcial | Campo `protocoloConcessionaria` no Contrato | Preenchimento manual, sem integração direta com concessionária |
| 9 | **Aprovação concessionária** | ⚠️ Parcial | Status AGUARDANDO_CONCESSIONARIA→APROVADO | Transição manual pelo admin |
| 10 | **Usina alocada** | ✅ Implementado | Step7 wizard, `CooperadosService.alocarUsina()` | Vincula UC→Usina via Contrato com kWh alocado |
| 11 | **Créditos injetados** | ⚠️ Parcial | `GeracaoMensal` model | Registro manual de geração; sem integração automática com inversores |
| 12 | **Fatura processada (OCR)** | ✅ Implementado | `FaturasService` com Claude Sonnet 4 | Extrai componentes, histórico 12 meses, detecta atípicos |
| 13 | **Cobrança gerada** | ✅ Implementado | `CobrancasService` + `CobrancasJob` (cron) | Calcula desconto, multa, juros; vincula a benefícios MLM |
| 14 | **Pagamento** | ✅ Implementado | `AsaasService` (PIX, boleto, cartão) | Webhook Asaas para status; PIX copiar/colar via WhatsApp |
| 15 | **Baixa** | ✅ Implementado | `CobrancasService.darBaixa()` | Gera lançamento no Livro Caixa automaticamente |

### Diagrama do Fluxo
```
CONVITE (link/QR/WhatsApp)
    ↓
LEAD (WhatsApp Bot ou Admin)
    ↓
CADASTRO (Wizard 7 steps ou Bot conversacional)
    ├── OCR Fatura → Simulação → Proposta
    ├── Documentos → Aprovação
    └── Contrato → Protocolo Concessionária
    ↓
APROVADO → Alocação Usina → UC vinculada
    ↓
ATIVO → Créditos mensais → Fatura processada
    ↓
COBRANÇA → Asaas (PIX/Boleto) → WhatsApp lembrete
    ↓
PAGAMENTO → Baixa → Lançamento Caixa
    ↓
(Se indicou) → Benefício MLM processado → Desconto aplicado
```

---

## 1.2 Fluxo MLM/Indicações Atual

### Arquitetura Implementada

**Modelos Prisma:**
- `ConfigIndicacao` — configuração por cooperativa (ativo, maxNiveis, modalidade, niveisConfig JSON)
- `Indicacao` — registro de indicação (indicadorId, indicadoId, nivel, status)
- `BeneficioIndicacao` — benefício gerado (tipo, valorCalculado, valorAplicado, saldoRestante, status)

**Serviço:** `IndicacoesService` (15.6 KB)

### O que acontece em cada etapa:

| Evento | Ação no MLM | Notificação |
|--------|-------------|-------------|
| Novo membro usa código de indicação | Cria `Indicacao` nível 1 + upline (até maxNiveis) | ❌ Nenhuma |
| Indicado finaliza cadastro | Status permanece PENDENTE | ❌ Nenhuma |
| Indicado paga 1ª fatura | `processarPrimeiraFaturaPaga()`: cria `BeneficioIndicacao` para cada nível | ❌ Nenhuma automática |
| Fechamento mensal | `aplicarBeneficiosNoFechamento()`: aplica saldo como desconto na cobrança | ❌ Nenhuma |

### Modalidades de Benefício:
1. **PERCENTUAL_PRIMEIRA_FATURA** — % da 1ª fatura do indicado, pago uma vez
2. **REAIS_KWH_RECORRENTE** — R$/kWh por mês (recorrente)
3. **AMBOS** — combina as duas modalidades

### Proteções implementadas:
- Detecção de referência circular (Set tracking)
- Transações atômicas no processamento de benefícios
- Limite de níveis configurável (maxNiveis, default 2)

### Notificações WhatsApp no MLM:
- **Cron mensal (dia 1, 10h):** Envia convite de indicação para membros ativos com contrato
- **Disparo manual:** Admin pode enviar para lista de telefones com limite configurável
- **Delay entre envios:** 3-8 segundos aleatório (anti-bloqueio)

### O que NÃO existe:
- ❌ Nenhum sistema de níveis/tiers (Bronze, Prata, Ouro, Diamante)
- ❌ Nenhuma gamificação (pontos, conquistas, ranking)
- ❌ Nenhuma notificação ao indicador quando indicado avança no funil
- ❌ Nenhum dashboard visual de progressão
- ❌ Nenhum badge de nível na listagem de membros
- ❌ Nenhum histórico de progressão

---

## 1.3 Lacunas Críticas

### Fluxo quebrado ou desconectado

| Lacuna | Impacto | Severidade |
|--------|---------|------------|
| **Concessionária é manual** | Admin precisa atualizar status manualmente após aprovação da concessionária | Médio |
| **Geração mensal é manual** | Sem integração com inversores; admin registra kWh gerado manualmente | Médio |
| **Webhook Asaas incompleto** | Endpoint existe mas processamento de status não está totalmente documentado | Alto |
| **Motor dinâmico WhatsApp desabilitado** | `FluxoEtapa` existe no schema mas flag `usarMotorDinamico` está false | Baixo |
| **Notificações são só DB** | `Notificacao` model salva no banco; sem email, SMS ou push real | Alto |
| **Sem notificação ao indicador** | Quando indicado avança no funil (cadastro, documento, contrato, pagamento), indicador não sabe | Alto |
| **Benefícios recorrentes (REAIS_KWH)** | Implementado no service mas sem evidência de processamento automático mensal | Médio |
| **Portal Financeiro** | Mostra cobranças mas "Cartão de crédito — Em breve" é placeholder | Baixo |

### Eventos sem notificação

| Evento do Ciclo de Vida | WhatsApp | Email | Push/In-app |
|--------------------------|----------|-------|-------------|
| Membro criado | ❌ | ❌ | ❌ |
| Documento aprovado | ❌ | ❌ | ✅ (Notificacao DB) |
| Documento reprovado | ❌ | ❌ | ✅ (Notificacao DB) |
| Contrato gerado | ❌ | ❌ | ❌ |
| Contrato aprovado pela concessionária | ❌ | ❌ | ❌ |
| Créditos começaram | ❌ | ❌ | ❌ |
| Cobrança gerada | ✅ (cron dia 5) | ❌ | ❌ |
| Pagamento confirmado | ❌ | ❌ | ❌ |
| Cobrança vencida | ❌ | ❌ | ❌ |
| Indicado cadastrou | ❌ | ❌ | ❌ |
| Indicado pagou 1ª fatura | ❌ | ❌ | ❌ |
| Benefício aplicado | ❌ | ❌ | ❌ |
| Nível promovido | N/A (não existe) | N/A | N/A |

### Modelos no Prisma sem uso completo no código

| Modelo | Situação |
|--------|----------|
| `FluxoEtapa` | Schema existe, CRUD existe, mas motor dinâmico desabilitado no bot |
| `ListaEspera` | Model existe, endpoint de contagem existe, mas fluxo de ativação da fila não implementado |
| `ListaContatos` | Model existe para listas WhatsApp, usado parcialmente |
| `ConfiguracaoMotor` | Motor de proposta configurável mas sem evidência de uso ativo |
| `UsinaMonitoramentoConfig` / `UsinaLeitura` / `UsinaAlerta` | Models existem, endpoints existem, mas sem integração com inversores reais |

---

# PARTE 2 — PROPOSTA: CLUBE DE VANTAGENS

## 2.1 Modelo de Níveis (Tiers)

### Schema Prisma Proposto

```prisma
// ============================================
// CLUBE DE VANTAGENS — Novos modelos
// ============================================

enum NivelClube {
  BRONZE
  PRATA
  OURO
  DIAMANTE
}

model ConfigClubeVantagens {
  id              String      @id @default(uuid())
  cooperativaId   String
  cooperativa     Cooperativa @relation(fields: [cooperativaId], references: [id])

  ativo           Boolean     @default(false)

  // Critério de progressão
  criterio        CriterioProgressao @default(KWH_INDICADO_ACUMULADO)

  // Configuração por nível (JSON array)
  // [{nivel: "BRONZE", kwhMinimo: 0, kwhMaximo: 500, beneficioPercentual: 2, beneficioReaisKwh: 0.02, badge: "🥉"},
  //  {nivel: "PRATA", kwhMinimo: 501, kwhMaximo: 2000, beneficioPercentual: 4, beneficioReaisKwh: 0.04, badge: "🥈"},
  //  {nivel: "OURO", kwhMinimo: 2001, kwhMaximo: 5000, beneficioPercentual: 6, beneficioReaisKwh: 0.06, badge: "🥇"},
  //  {nivel: "DIAMANTE", kwhMinimo: 5001, kwhMaximo: null, beneficioPercentual: 10, beneficioReaisKwh: 0.10, badge: "💎"}]
  niveisConfig    Json        @default("[]")

  // Benefício extra: mês de aniversário do membro
  bonusAniversario  Float?    @default(0) // % extra no mês do aniversário

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@unique([cooperativaId])
}

enum CriterioProgressao {
  KWH_INDICADO_ACUMULADO     // Total de kWh dos indicados ativos
  NUMERO_INDICADOS_ATIVOS    // Quantidade de indicados pagantes
  RECEITA_INDICADOS          // Valor total pago pelos indicados
}

model ProgressaoClube {
  id              String      @id @default(uuid())
  cooperadoId     String
  cooperado       Cooperado   @relation(fields: [cooperadoId], references: [id])

  nivelAtual      NivelClube  @default(BRONZE)

  // Métricas acumuladas
  kwhIndicadoAcumulado    Float   @default(0)  // Total kWh dos indicados
  indicadosAtivos         Int     @default(0)  // Qtd indicados pagantes
  receitaIndicados        Float   @default(0)  // Receita total gerada

  // Benefício atual
  beneficioPercentualAtual  Float @default(0)  // % de desconto vigente
  beneficioReaisKwhAtual    Float @default(0)  // R$/kWh vigente

  // Datas
  dataUltimaPromocao     DateTime?
  dataUltimaAvaliacao    DateTime?

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  historico       HistoricoProgressao[]

  @@unique([cooperadoId])
}

model HistoricoProgressao {
  id              String      @id @default(uuid())
  progressaoId    String
  progressao      ProgressaoClube @relation(fields: [progressaoId], references: [id])

  nivelAnterior   NivelClube
  nivelNovo       NivelClube

  // Snapshot das métricas no momento da promoção
  kwhAcumulado    Float
  indicadosAtivos Int
  receitaAcumulada Float

  motivo          String      // "Atingiu 501 kWh indicado acumulado"

  createdAt       DateTime    @default(now())
}

// Extensão do Cooperado existente (adicionar campos)
// model Cooperado {
//   ...campos existentes...
//   progressaoClube   ProgressaoClube?
// }
```

### Lógica de Progressão

```typescript
// backend/src/clube-vantagens/clube-vantagens.service.ts

async avaliarProgressao(cooperadoId: string): Promise<{promovido: boolean, nivelAnterior: NivelClube, nivelNovo: NivelClube}> {
  const progressao = await this.prisma.progressaoClube.findUnique({
    where: { cooperadoId },
    include: { cooperado: { include: { cooperativa: true } } }
  });

  const config = await this.prisma.configClubeVantagens.findUnique({
    where: { cooperativaId: progressao.cooperado.cooperativaId }
  });

  if (!config?.ativo) return { promovido: false, nivelAnterior: progressao.nivelAtual, nivelNovo: progressao.nivelAtual };

  const niveis = config.niveisConfig as NivelConfig[];
  const metrica = this.obterMetrica(progressao, config.criterio);

  // Encontrar nível correspondente à métrica atual
  const nivelAlvo = niveis
    .filter(n => metrica >= n.kwhMinimo && (n.kwhMaximo === null || metrica <= n.kwhMaximo))
    .pop();

  if (!nivelAlvo || nivelAlvo.nivel === progressao.nivelAtual) {
    return { promovido: false, nivelAnterior: progressao.nivelAtual, nivelNovo: progressao.nivelAtual };
  }

  // Só promove, nunca rebaixa
  const ordemNiveis = ['BRONZE', 'PRATA', 'OURO', 'DIAMANTE'];
  if (ordemNiveis.indexOf(nivelAlvo.nivel) <= ordemNiveis.indexOf(progressao.nivelAtual)) {
    return { promovido: false, nivelAnterior: progressao.nivelAtual, nivelNovo: progressao.nivelAtual };
  }

  // Promover
  await this.prisma.$transaction([
    this.prisma.progressaoClube.update({
      where: { cooperadoId },
      data: {
        nivelAtual: nivelAlvo.nivel,
        beneficioPercentualAtual: nivelAlvo.beneficioPercentual,
        beneficioReaisKwhAtual: nivelAlvo.beneficioReaisKwh,
        dataUltimaPromocao: new Date(),
        dataUltimaAvaliacao: new Date(),
      }
    }),
    this.prisma.historicoProgressao.create({
      data: {
        progressaoId: progressao.id,
        nivelAnterior: progressao.nivelAtual,
        nivelNovo: nivelAlvo.nivel,
        kwhAcumulado: progressao.kwhIndicadoAcumulado,
        indicadosAtivos: progressao.indicadosAtivos,
        receitaAcumulada: progressao.receitaIndicados,
        motivo: `Atingiu ${metrica} ${config.criterio === 'KWH_INDICADO_ACUMULADO' ? 'kWh' : 'indicados'}`,
      }
    })
  ]);

  return { promovido: true, nivelAnterior: progressao.nivelAtual, nivelNovo: nivelAlvo.nivel };
}
```

---

## 2.2 Eventos que Devem Atualizar o Clube

### Tabela de Eventos → Ações

| Evento | Atualiza kWh | Avalia Nível | Aplica Benefício | Notifica WhatsApp |
|--------|:---:|:---:|:---:|:---:|
| **Indicado criado** (cadastro completo) | ❌ | ❌ | ❌ | ✅ "Seu indicado {nome} se cadastrou!" |
| **Indicado ativo** (contrato aprovado) | ❌ | ❌ | ❌ | ✅ "Seu indicado {nome} teve o contrato aprovado!" |
| **Indicado recebendo créditos** (1ª injeção) | ✅ +kWh alocado | ✅ Avaliar | ❌ | ✅ "Seu indicado {nome} já está recebendo créditos!" |
| **Cobrança do indicado PAGA** (mensal) | ✅ +kWh do mês | ✅ Avaliar | ✅ Calcular benefício | ✅ (se promovido) "Parabéns! Você subiu para {nivel}!" |
| **Indicado desligado** | ✅ -kWh (recalcular) | ✅ (sem rebaixar) | ❌ | ✅ "Seu indicado {nome} foi desligado" |
| **Fechamento mensal** (batch) | ✅ Recalcular totais | ✅ Batch | ✅ Aplicar na cobrança | ✅ Resumo mensal |
| **Admin aplica benefício manual** | ❌ | ❌ | ✅ | ✅ "Você recebeu um benefício de R$ {valor}!" |

### Implementação dos Event Handlers

```typescript
// backend/src/clube-vantagens/clube-vantagens.events.ts

// Chamar após CobrancasService.darBaixa()
async onCobrancaPaga(cobrancaId: string) {
  const cobranca = await this.prisma.cobranca.findUnique({
    where: { id: cobrancaId },
    include: { contrato: { include: { cooperado: true } } }
  });

  const cooperadoPagante = cobranca.contrato.cooperado;

  // Encontrar todos os indicadores deste cooperado (em todos os níveis)
  const indicacoes = await this.prisma.indicacao.findMany({
    where: { indicadoId: cooperadoPagante.id, status: 'PRIMEIRA_FATURA_PAGA' }
  });

  for (const indicacao of indicacoes) {
    // Atualizar kWh acumulado do indicador
    await this.prisma.progressaoClube.update({
      where: { cooperadoId: indicacao.indicadorId },
      data: {
        kwhIndicadoAcumulado: { increment: cobranca.kwhEntregue || 0 },
        receitaIndicados: { increment: Number(cobranca.valorPago) || 0 },
      }
    });

    // Avaliar progressão
    const resultado = await this.avaliarProgressao(indicacao.indicadorId);

    if (resultado.promovido) {
      // Notificar via WhatsApp
      await this.whatsappSender.enviarMensagem(
        indicacao.indicador.telefone,
        `🎉 Parabéns! Você subiu para o nível ${resultado.nivelNovo} no Clube de Vantagens!\n\n` +
        `Seu novo benefício: ${resultado.beneficioPercentual}% de desconto por indicação.`
      );
    }
  }
}
```

---

## 2.3 Ações em Lote na Tela de Membros

### Frontend — Componente de Seleção em Massa

```tsx
// web/app/dashboard/cooperados/components/AcoesLote.tsx

interface AcoesLoteProps {
  selecionados: string[]; // IDs dos cooperados selecionados
  onLimpar: () => void;
}

export function AcoesLote({ selecionados, onLimpar }: AcoesLoteProps) {
  const [acao, setAcao] = useState<string>('');

  return (
    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
      <span className="text-sm font-medium">
        {selecionados.length} selecionado(s)
      </span>

      <Select value={acao} onValueChange={setAcao}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Selecionar ação..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="whatsapp">📱 Enviar WhatsApp</SelectItem>
          <SelectItem value="email">📧 Enviar Email</SelectItem>
          <SelectItem value="reajuste">📊 Aplicar Reajuste</SelectItem>
          <SelectItem value="beneficio">🎁 Aplicar Benefício Manual</SelectItem>
          <SelectItem value="status">🔄 Alterar Status</SelectItem>
          <SelectItem value="exportar">📥 Exportar Selecionados</SelectItem>
        </SelectContent>
      </Select>

      <Button onClick={() => executarAcao(acao, selecionados)}>
        Executar
      </Button>
      <Button variant="ghost" onClick={onLimpar}>Limpar</Button>
    </div>
  );
}
```

### Backend — Endpoints Batch

```typescript
// backend/src/cooperados/cooperados.controller.ts — novos endpoints

@Post('batch/whatsapp')
@Roles(PerfilUsuario.ADMIN)
async enviarWhatsappLote(
  @Body() dto: { cooperadoIds: string[]; mensagem: string; templateId?: string },
  @ContextoAtivo() cooperativaId: string,
) {
  return this.cooperadosService.enviarWhatsappLote(dto.cooperadoIds, dto.mensagem, cooperativaId);
}

@Post('batch/reajuste')
@Roles(PerfilUsuario.ADMIN)
async aplicarReajusteLote(
  @Body() dto: { cooperadoIds: string[]; percentual: number; motivo: string },
  @ContextoAtivo() cooperativaId: string,
) {
  return this.cooperadosService.aplicarReajusteLote(dto.cooperadoIds, dto.percentual, dto.motivo, cooperativaId);
}

@Post('batch/beneficio')
@Roles(PerfilUsuario.ADMIN)
async aplicarBeneficioManualLote(
  @Body() dto: { cooperadoIds: string[]; tipo: 'PERCENTUAL' | 'VALOR_FIXO'; valor: number; motivo: string },
  @ContextoAtivo() cooperativaId: string,
) {
  return this.cooperadosService.aplicarBeneficioManualLote(dto, cooperativaId);
}

@Post('batch/status')
@Roles(PerfilUsuario.ADMIN)
async alterarStatusLote(
  @Body() dto: { cooperadoIds: string[]; novoStatus: StatusCooperado; motivo: string },
  @ContextoAtivo() cooperativaId: string,
) {
  return this.cooperadosService.alterarStatusLote(dto, cooperativaId);
}

@Post('batch/exportar')
@Roles(PerfilUsuario.ADMIN)
async exportarSelecionados(
  @Body() dto: { cooperadoIds: string[]; formato: 'csv' | 'xlsx' },
  @ContextoAtivo() cooperativaId: string,
) {
  return this.cooperadosService.exportarSelecionados(dto, cooperativaId);
}
```

---

## 2.4 Visibilidade de Benefícios na Listagem

### Badge de Nível no Card/Tabela de Membros

```tsx
// web/components/BadgeNivelClube.tsx

const NIVEL_CONFIG = {
  BRONZE:   { label: 'Bronze',   cor: 'bg-amber-700 text-white',  icone: '🥉' },
  PRATA:    { label: 'Prata',    cor: 'bg-gray-400 text-white',   icone: '🥈' },
  OURO:     { label: 'Ouro',     cor: 'bg-yellow-500 text-white', icone: '🥇' },
  DIAMANTE: { label: 'Diamante', cor: 'bg-blue-500 text-white',   icone: '💎' },
};

export function BadgeNivelClube({ nivel, beneficioAtivo, indicados }: {
  nivel: NivelClube;
  beneficioAtivo: boolean;
  indicados: number;
}) {
  const config = NIVEL_CONFIG[nivel];
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.cor}`}>
        {config.icone} {config.label}
      </span>
      {beneficioAtivo && (
        <span className="w-2 h-2 rounded-full bg-green-500" title="Benefício ativo" />
      )}
      {indicados > 0 && (
        <span className="text-xs text-muted-foreground" title="Indicações ativas">
          ({indicados})
        </span>
      )}
    </div>
  );
}
```

### Modificação na Listagem de Membros

```tsx
// Na tabela de cooperados, adicionar coluna:
<TableHead>Clube</TableHead>
// ...
<TableCell>
  {cooperado.progressaoClube ? (
    <BadgeNivelClube
      nivel={cooperado.progressaoClube.nivelAtual}
      beneficioAtivo={cooperado.progressaoClube.beneficioPercentualAtual > 0}
      indicados={cooperado.progressaoClube.indicadosAtivos}
    />
  ) : (
    <span className="text-xs text-muted-foreground">—</span>
  )}
</TableCell>
```

### Endpoint Backend para Listagem com Clube

```typescript
// Modificar CooperadosService.findAll() para incluir:
include: {
  // ...includes existentes...
  progressaoClube: {
    select: {
      nivelAtual: true,
      beneficioPercentualAtual: true,
      indicadosAtivos: true,
      kwhIndicadoAcumulado: true,
    }
  }
}
```

---

## 2.5 Fluxo Conversacional WhatsApp

### Menu Interativo para Novos Leads

```
📱 FLUXO: Lead recebe convite e responde
═══════════════════════════════════════

[Lead recebe mensagem com link de indicação]
↓
Lead responde qualquer coisa no WhatsApp
↓
🤖 Bot: "Olá! 👋 Bem-vindo à {cooperativa}!
Você foi indicado por {nomeIndicador}.

Quer economizar até {desconto}% na sua conta de energia?

1️⃣ Quero saber mais
2️⃣ Já tenho minha conta de luz em mãos
3️⃣ Não tenho interesse"
↓
[Opção 1] → Explicação + CTA para enviar conta
↓
[Opção 2] → "Ótimo! Envie uma foto da sua conta de luz (frente completa)"
↓
🤖 [OCR processa fatura via Claude]
↓
🤖 Bot: "Encontrei seus dados:
📍 {endereco}
⚡ Consumo médio: {mediaKwh} kWh/mês
💰 Gasto médio: R$ {mediaValor}/mês

Com nosso plano, você economizaria:
💚 R$ {economia}/mês ({desconto}% de desconto)
💚 R$ {economiaAnual}/ano

Quer continuar?
1️⃣ Sim, quero aderir!
2️⃣ Tenho dúvidas
3️⃣ Preciso pensar"
↓
[Opção 1] → Coleta dados pessoais
↓
🤖 Bot: "Para finalizar, preciso de alguns dados:
Qual seu nome completo?"
↓ [Coleta: nome → CPF → email]
↓
🤖 Bot: "Seus dados:
👤 {nome}
📄 {cpf}
📧 {email}
📍 {endereco}

Está tudo certo?
1️⃣ Sim, confirmar
2️⃣ Corrigir algum dado"
↓
[Confirma] → Cria Cooperado + Indicação + Proposta
↓
🤖 Bot: "🎉 Cadastro realizado!
Sua proposta de adesão foi gerada.

📋 Próximos passos:
1. Enviaremos o contrato para assinatura
2. Protocolaremos na concessionária
3. Em ~30 dias você começará a receber créditos!

Seu indicador {nomeIndicador} será beneficiado pela sua adesão! 🤝"
↓
[Notifica indicador]
🤖 → Indicador: "🎉 Boa notícia! {nomeIndicado} se cadastrou através do seu convite!
Quando ele começar a pagar, você receberá {beneficio}% de benefício."
```

### Notificações Automáticas por Etapa

```typescript
// backend/src/whatsapp/whatsapp-ciclo-vida.service.ts

const MENSAGENS_CICLO = {
  // Para o MEMBRO
  DOCUMENTO_APROVADO:
    '✅ Seus documentos foram aprovados! Estamos preparando seu contrato.',

  CONTRATO_GERADO:
    '📋 Seu contrato está pronto! Acesse: {linkContrato}\nAssine digitalmente para avançar.',

  CONCESSIONARIA_APROVADA:
    '⚡ Ótima notícia! A concessionária aprovou seu cadastro. Em breve você receberá créditos de energia solar!',

  CREDITOS_INICIADOS:
    '🌞 Seus créditos de energia solar começaram! Acesse seu portal: {linkPortal}',

  COBRANCA_GERADA:
    '📄 Sua cobrança de {mesRef} está disponível:\n💰 Valor: R$ {valor}\n📅 Vencimento: {vencimento}\n\n{linkPagamento}',

  PAGAMENTO_CONFIRMADO:
    '✅ Pagamento confirmado! R$ {valor} referente a {mesRef}.\nObrigado! 💚',

  // Para o INDICADOR
  INDICADO_CADASTROU:
    '🎉 {nomeIndicado} se cadastrou através do seu convite! Acompanhe pelo portal.',

  INDICADO_ATIVO:
    '⚡ {nomeIndicado} já está recebendo créditos! Quando pagar a primeira fatura, seu benefício será ativado.',

  INDICADO_PAGOU:
    '💰 {nomeIndicado} pagou a fatura! Seu benefício de {beneficio} foi gerado.\nNível atual: {nivel} {badge}',

  NIVEL_PROMOVIDO:
    '🏆 Parabéns! Você subiu para o nível {nivelNovo}!\n\n' +
    'Novo benefício: {beneficioPercentual}% por indicação\n' +
    'Indicados ativos: {indicadosAtivos}\n' +
    'kWh acumulado: {kwhAcumulado}\n\n' +
    'Continue indicando e suba para {proximoNivel}! 🚀',

  RESUMO_MENSAL:
    '📊 Resumo do mês - Clube de Vantagens\n\n' +
    '🏅 Nível: {nivel}\n' +
    '👥 Indicados ativos: {indicadosAtivos}\n' +
    '💰 Benefício este mês: R$ {beneficioMes}\n' +
    '💰 Benefício acumulado: R$ {beneficioTotal}\n\n' +
    'Indique mais amigos: {linkIndicacao}',
};
```

---

## 2.6 Condomínios e Administradoras

### Schema Prisma Proposto

```prisma
// ============================================
// CONDOMÍNIOS & ADMINISTRADORAS
// ============================================

model Condominio {
  id              String      @id @default(uuid())
  cooperativaId   String
  cooperativa     Cooperativa @relation(fields: [cooperativaId], references: [id])

  nome            String      // "Condomínio Solar Residence"
  cnpj            String?
  endereco        String
  cidade          String
  estado          String
  cep             String?

  // Gestor (síndico ou administradora)
  administradoraId  String?
  administradora    Administradora? @relation(fields: [administradoraId], references: [id])

  sindicoNome       String?
  sindicoCpf        String?
  sindicoEmail      String?
  sindicoTelefone   String?
  sindicoCooperadoId String?   // Se o síndico também é cooperado

  // Configuração de rateio
  modeloRateio      ModeloRateioCondominio @default(PROPORCIONAL_CONSUMO)

  // Excedente
  excedentePolitica   ExcedentePolitica @default(CREDITO_PROXIMO_MES)
  excedentePixChave   String?
  excedentePixTipo    TipoChavePix?

  // Impostos sobre excedente
  aliquotaIR          Float?    @default(0)    // % IR sobre excedente
  aliquotaPIS         Float?    @default(0)
  aliquotaCOFINS      Float?    @default(0)
  taxaAdministrativa  Float?    @default(0)    // % taxa administrativa

  ativo             Boolean     @default(true)

  unidades          UnidadeCondominio[]
  contratos         Contrato[]

  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
}

enum ModeloRateioCondominio {
  PROPORCIONAL_CONSUMO     // Rateio proporcional ao consumo de cada UC
  IGUALITARIO              // Divisão igual entre todas as UCs
  FRAÇÃO_IDEAL             // Pela fração ideal de cada unidade
  PERSONALIZADO            // Percentual fixo por unidade
}

enum ExcedentePolitica {
  CREDITO_PROXIMO_MES      // Acumula crédito para próximo mês
  PIX_MENSAL               // Transfere excedente via PIX
  ABATER_TAXA_CONDOMINIO   // Abate na taxa condominial
}

enum TipoChavePix {
  CPF
  CNPJ
  EMAIL
  TELEFONE
  ALEATORIA
}

model UnidadeCondominio {
  id              String      @id @default(uuid())
  condominioId    String
  condominio      Condominio  @relation(fields: [condominioId], references: [id])

  numero          String      // "Apt 301", "Bloco A - 101"
  ucId            String?     // Vincula à UC existente
  uc              Uc?         @relation(fields: [ucId], references: [id])
  cooperadoId     String?     // Morador responsável
  cooperado       Cooperado?  @relation(fields: [cooperadoId], references: [id])

  fracaoIdeal     Float?      // 0.0 a 1.0 (para rateio por fração)
  percentualFixo  Float?      // Para rateio personalizado

  ativo           Boolean     @default(true)

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

model Administradora {
  id              String      @id @default(uuid())
  cooperativaId   String
  cooperativa     Cooperativa @relation(fields: [cooperativaId], references: [id])

  razaoSocial     String
  nomeFantasia    String?
  cnpj            String
  email           String
  telefone        String

  responsavelNome String
  responsavelCpf  String?
  responsavelEmail String?
  responsavelTelefone String?

  // Acesso ao sistema
  usuarioId       String?     // Usuário com perfil de admin limitado

  condominios     Condominio[]

  ativo           Boolean     @default(true)

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@unique([cnpj, cooperativaId])
}
```

### Fluxo de Cobrança do Condomínio

```typescript
// backend/src/condominios/condominios-cobranca.service.ts

async gerarCobrancaCondominio(condominioId: string, mesRef: number, anoRef: number) {
  const condominio = await this.prisma.condominio.findUnique({
    where: { id: condominioId },
    include: {
      unidades: { include: { uc: true, cooperado: true } },
    }
  });

  // 1. Calcular energia total gerada para o condomínio
  const energiaTotal = await this.calcularEnergiaGerada(condominio, mesRef, anoRef);

  // 2. Ratear entre unidades conforme modelo
  const rateio = this.calcularRateio(condominio, energiaTotal);

  // 3. Gerar cobrança individual por unidade
  for (const unidade of rateio) {
    await this.cobrancasService.create({
      contratoId: unidade.contratoId,
      mesReferencia: mesRef,
      anoReferencia: anoRef,
      kwhEntregue: unidade.kwhRateado,
      valorBruto: unidade.valorBruto,
      percentualDesconto: unidade.desconto,
      valorDesconto: unidade.valorDesconto,
      valorLiquido: unidade.valorLiquido,
    });
  }

  // 4. Processar excedente (se houver)
  const excedente = energiaTotal.gerado - energiaTotal.consumido;
  if (excedente > 0 && condominio.excedentePolitica === 'PIX_MENSAL') {
    const valorExcedente = excedente * tarifaMedia;
    const impostos = this.calcularImpostos(valorExcedente, condominio);
    const valorLiquido = valorExcedente - impostos.total;

    await this.transferirExcedente(condominio, valorLiquido, impostos);
  }
}

calcularRateio(condominio: Condominio, energia: EnergiaTotal): RateioUnidade[] {
  switch (condominio.modeloRateio) {
    case 'PROPORCIONAL_CONSUMO':
      return this.rateioProporcional(condominio.unidades, energia);
    case 'IGUALITARIO':
      return this.rateioIgualitario(condominio.unidades, energia);
    case 'FRAÇÃO_IDEAL':
      return this.rateioFracaoIdeal(condominio.unidades, energia);
    case 'PERSONALIZADO':
      return this.rateioPersonalizado(condominio.unidades, energia);
  }
}
```

---

## 2.7 Plano de Implementação

### Fase 1 — Fundação (1-2 dias) ⚡ VALOR IMEDIATO

**Objetivo:** Clube de Vantagens funcional com tiers visíveis.

| # | Tarefa | Esforço | Arquivo(s) |
|---|--------|---------|------------|
| 1.1 | Adicionar modelos Prisma (ConfigClubeVantagens, ProgressaoClube, HistoricoProgressao) | 2h | `schema.prisma` |
| 1.2 | Criar migration e seed com configuração padrão | 30min | `prisma/migrations/` |
| 1.3 | Criar módulo `clube-vantagens` NestJS (CRUD + avaliação de progressão) | 4h | `backend/src/clube-vantagens/` |
| 1.4 | Hook em `CobrancasService.darBaixa()` para chamar `avaliarProgressao()` | 1h | `cobrancas.service.ts` |
| 1.5 | Hook em `IndicacoesService.registrarIndicacao()` para criar ProgressaoClube | 30min | `indicacoes.service.ts` |
| 1.6 | Badge de nível na listagem de cooperados (frontend) | 2h | `cooperados/page.tsx` |
| 1.7 | Aba "Clube de Vantagens" na config da cooperativa (frontend) | 2h | `dashboard/indicacoes/` |
| 1.8 | Card de nível no portal do cooperado | 1h | `portal/indicacoes/page.tsx` |

**Entrega:** Membros são classificados automaticamente em Bronze→Prata→Ouro→Diamante com base em kWh indicado. Badge visível em toda a plataforma.

---

### Fase 2 — Notificações & Batch (3-5 dias) 📱

**Objetivo:** Comunicação automatizada + ações em massa.

| # | Tarefa | Esforço | Arquivo(s) |
|---|--------|---------|------------|
| 2.1 | `WhatsappCicloVidaService` — notificações automáticas em cada etapa | 4h | `whatsapp/whatsapp-ciclo-vida.service.ts` |
| 2.2 | Integrar notificações no `CooperadosService` (status change → WhatsApp) | 2h | `cooperados.service.ts` |
| 2.3 | Notificar indicador quando indicado avança (cadastro, ativo, pagou) | 2h | `indicacoes.service.ts` |
| 2.4 | Endpoint batch WhatsApp (seleção múltipla na listagem) | 3h | `cooperados.controller.ts` |
| 2.5 | Endpoint batch reajuste + benefício manual | 3h | `cooperados.controller.ts` |
| 2.6 | Componente AcoesLote no frontend com checkbox na tabela | 4h | `cooperados/page.tsx` |
| 2.7 | Cron: resumo mensal do Clube para cada membro com indicações | 2h | `clube-vantagens.job.ts` |
| 2.8 | Cron: notificação de cobrança vencida (dia seguinte ao vencimento) | 2h | `whatsapp-cobranca.service.ts` |
| 2.9 | Notificação de pagamento confirmado via WhatsApp | 1h | `cobrancas.service.ts` |

**Entrega:** Indicador recebe notificações em tempo real. Admin pode enviar WhatsApp em massa e aplicar reajustes/benefícios para múltiplos membros.

---

### Fase 3 — Condomínios & Avançado (1-2 semanas) 🏢

**Objetivo:** Suporte a condomínios, administradoras e fluxo conversacional completo.

| # | Tarefa | Esforço | Arquivo(s) |
|---|--------|---------|------------|
| 3.1 | Modelos Prisma (Condominio, UnidadeCondominio, Administradora) | 3h | `schema.prisma` |
| 3.2 | Módulo `condominios` NestJS (CRUD + rateio + excedente) | 8h | `backend/src/condominios/` |
| 3.3 | Módulo `administradoras` NestJS (CRUD + multi-condomínio) | 4h | `backend/src/administradoras/` |
| 3.4 | Tela de gestão de condomínios no dashboard | 8h | `dashboard/condominios/` |
| 3.5 | Cobrança com rateio automático (4 modelos) | 6h | `condominios-cobranca.service.ts` |
| 3.6 | Excedente via PIX com cálculo de impostos | 4h | `condominios-excedente.service.ts` |
| 3.7 | Portal da administradora (multi-condomínio) | 6h | `web/app/administradora/` |
| 3.8 | Menu conversacional WhatsApp aprimorado (dúvidas, 2ª via, status) | 6h | `whatsapp-bot.service.ts` |
| 3.9 | Ranking/Leaderboard de indicadores no portal | 4h | `portal/ranking/page.tsx` |
| 3.10 | Dashboard analytics do Clube (admin) — gráficos de progressão, receita por nível | 6h | `dashboard/clube-vantagens/` |
| 3.11 | Export de relatórios do Clube (CSV/PDF) | 3h | `clube-vantagens.service.ts` |

**Entrega:** Sistema completo com condomínios, administradoras, rateio automático, e analytics avançados.

---

## RESUMO DE PRIORIDADES

```
IMPACTO
  ▲
  │  ⭐ Fase 1: Tiers + Badge     ⭐ Fase 2: Notificações WhatsApp
  │       (1-2 dias)                    (3-5 dias)
  │
  │  ✅ Fase 2: Batch Actions     ⭐ Fase 3: Condomínios
  │       (3-5 dias)                    (1-2 semanas)
  │
  │  ✅ Fase 3: Ranking           ✅ Fase 3: Administradoras
  │       (1-2 semanas)                (1-2 semanas)
  ├──────────────────────────────────────────► ESFORÇO
```

### Dependências Técnicas

```
ConfigClubeVantagens ──► ProgressaoClube ──► HistoricoProgressao
                                │
                         ┌──────┴──────┐
                         ▼              ▼
                   avaliarProgressao   BadgeNivelClube (UI)
                         │
                         ▼
              WhatsappCicloVidaService
                         │
                    ┌────┴────┐
                    ▼         ▼
              Notif. Indicador  Resumo Mensal
```

---

## MÉTRICAS DE SUCESSO

| Métrica | Baseline (atual) | Meta Fase 1 | Meta Fase 3 |
|---------|-------------------|-------------|-------------|
| Taxa de indicação (indicados/membro/mês) | Não medido | 0.3 | 0.8 |
| Conversão de indicados (cadastro→pagante) | Não medido | 30% | 50% |
| Membros com nível > Bronze | N/A | 15% | 40% |
| Notificações WhatsApp automatizadas | 2 (cron cobrança + convite) | 8 | 15+ |
| Tempo médio de onboarding (lead→ativo) | Não medido | < 45 dias | < 30 dias |
| Condomínios gerenciados | 0 | N/A | 10+ |

---

## CONSIDERAÇÕES TÉCNICAS

### Performance
- `ProgressaoClube` é 1:1 com Cooperado — índice único garante busca O(1)
- Avaliação de progressão é O(n) onde n = número de níveis (máximo 4) — negligível
- Batch actions devem usar `Promise.allSettled()` com limite de concorrência (p-limit, 5 paralelos)
- WhatsApp batch mantém delay de 3-8s entre envios (anti-bloqueio existente)

### Segurança
- Endpoints batch requerem ADMIN role (já implementado via guards)
- Ações em massa devem gerar log de auditoria (quem, quando, quantos, ação)
- Excedente PIX deve validar chave PIX e registrar comprovante
- Cálculo de impostos sobre excedente deve ser auditável

### Backward Compatibility
- Cooperados existentes recebem `ProgressaoClube` com nível BRONZE no seed/migration
- `ConfigClubeVantagens.ativo = false` por padrão — cooperativa ativa quando quiser
- Fluxo MLM existente continua funcionando; clube é camada adicional

---

*Relatório gerado em 2026-03-26. Baseado em auditoria completa de 50 modelos Prisma, 30 módulos NestJS e 88 páginas Next.js.*
