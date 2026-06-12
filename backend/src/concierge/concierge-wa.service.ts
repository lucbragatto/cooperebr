import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConciergeService } from './concierge.service';
import {
  MSG_DIAGNOSTICO_ENTREGUE,
  renderizarTemplate,
} from './templates/concierge-wa-mensagens';

/**
 * Valores canonicos do enum `StatusLeadConcierge` (espelha schema.prisma).
 * Duplicado aqui porque o esqueleto C8 nao pode rodar `prisma generate` ainda.
 * Quando o cliente Prisma for regerado, podemos substituir por
 * `import { StatusLeadConcierge } from '@prisma/client'`.
 */
export const StatusLeadConcierge = {
  RECEBIDO: 'RECEBIDO',
  OCR_PROCESSANDO: 'OCR_PROCESSANDO',
  DIAGNOSTICO_PRONTO: 'DIAGNOSTICO_PRONTO',
  INTERESSE_CONFIRMADO: 'INTERESSE_CONFIRMADO',
  DADOS_COLETADOS: 'DADOS_COLETADOS',
  DOCUMENTOS_COLETADOS: 'DOCUMENTOS_COLETADOS',
  PROCURACAO_ASSINADA: 'PROCURACAO_ASSINADA',
  PAGAMENTO_CONFIRMADO: 'PAGAMENTO_CONFIRMADO',
  CONVERTIDO: 'CONVERTIDO',
  ABANDONADO: 'ABANDONADO',
  INELEGIVEL: 'INELEGIVEL',
  FALLBACK_HUMANO: 'FALLBACK_HUMANO',
} as const;

export type StatusLeadConciergeValue =
  (typeof StatusLeadConcierge)[keyof typeof StatusLeadConcierge];

/**
 * Forma minima do registro LeadConcierge usado pelo service.
 * Quando `prisma generate` rodar, podemos substituir por
 * `import type { LeadConcierge } from '@prisma/client'`.
 */
export interface LeadConcierge {
  id: string;
  cooperativaId: string;
  telefone: string;
  nome: string | null;
  email: string | null;
  cpfCnpj: string | null;
  cidade: string | null;
  uf: string | null;
  concessionaria: string | null;
  faturaPdfPath: string | null;
  statusLead: StatusLeadConciergeValue;
  diagnosticoIndebitoId: string | null;
  cooperadoId: string | null;
  motivoAbandono: string | null;
  procuracaoAssinadaEm: Date | null;
  pagamentoConfirmadoEm: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Delegate Prisma do model LeadConcierge. Espelho fino do shape gerado pelo
 * `prisma generate` (que ainda nao foi rodado pra evitar reset de DB no
 * esqueleto C8). Argumentos sao `unknown` proposital: o callsite construi
 * sempre objetos bem-tipados via `where: { id, cooperativaId }` etc., e o
 * cliente Prisma valida estrutura em runtime.
 */
export interface LeadConciergeDelegate {
  create(args: {
    data: {
      cooperativaId: string;
      telefone: string;
      statusLead: StatusLeadConciergeValue;
    };
  }): Promise<LeadConcierge>;
  findFirst(args: {
    where: { id: string; cooperativaId: string };
  }): Promise<LeadConcierge | null>;
  update(args: {
    where: { id: string };
    data: Partial<Omit<LeadConcierge, 'id' | 'createdAt' | 'updatedAt'>>;
  }): Promise<LeadConcierge>;
}

/**
 * View tipada do PrismaService com o delegate LeadConcierge anexado.
 * Necessario porque schema.prisma ja tem o model, mas `prisma generate`
 * nao rodou neste esqueleto.
 */
type PrismaServiceComLead = PrismaService & {
  leadConcierge: LeadConciergeDelegate;
};

/**
 * Constantes de estados do funil Concierge na conversa WhatsApp.
 *
 * `ConversaWhatsapp.estado` em Prisma e `String` (nao enum), entao os estados
 * novos do funil sao representados aqui como constantes typed. Use sempre
 * essas constantes em vez de string literals para evitar typos.
 */
export const CONCIERGE_WA_ESTADOS = {
  INICIAL: 'CONCIERGE_INICIAL',
  AGUARDANDO_FATURA: 'CONCIERGE_AGUARDANDO_FATURA',
  PROCESSANDO_OCR: 'CONCIERGE_PROCESSANDO_OCR',
  DIAGNOSTICO_ENTREGUE: 'CONCIERGE_DIAGNOSTICO_ENTREGUE',
  AGUARDANDO_RG_CNH: 'CONCIERGE_AGUARDANDO_RG_CNH',
  AGUARDANDO_ASSINATURA: 'CONCIERGE_AGUARDANDO_ASSINATURA',
  AGUARDANDO_PAGAMENTO: 'CONCIERGE_AGUARDANDO_PAGAMENTO',
  FALLBACK_HUMANO: 'CONCIERGE_FALLBACK_HUMANO',
} as const;

export type ConciergeWaEstado =
  (typeof CONCIERGE_WA_ESTADOS)[keyof typeof CONCIERGE_WA_ESTADOS];

interface DadosBasicosLead {
  nome: string;
  cpfCnpj: string;
  email: string;
}

/**
 * Service esqueleto do funil Concierge via WhatsApp (Sprint C8 - 12/06/2026).
 *
 * Orquestra o funil de 9 etapas:
 *   RECEBIDO -> OCR_PROCESSANDO -> DIAGNOSTICO_PRONTO
 *   -> INTERESSE_CONFIRMADO -> DADOS_COLETADOS -> DOCUMENTOS_COLETADOS
 *   -> PROCURACAO_ASSINADA -> PAGAMENTO_CONFIRMADO -> CONVERTIDO.
 *
 * Multi-tenant: TODA query Prisma filtra por `cooperativaId`. Cross-tenant
 * dispara NotFoundException.
 *
 * Esqueleto: corpos com `TODO: implementar` + transicoes de estado/persistencia
 * basicas. Integracoes reais (OCR Claude, geracao PDF, Asaas, OTP) ficam
 * para sprints subsequentes.
 */
@Injectable()
export class ConciergeWaService {
  private readonly logger = new Logger(ConciergeWaService.name);
  private readonly prisma: PrismaServiceComLead;

  constructor(
    prisma: PrismaService,
    private readonly conciergeService: ConciergeService,
  ) {
    // Cast estreito: schema.prisma ja inclui LeadConcierge mas o cliente
    // ainda nao foi regerado neste esqueleto. Quando rodarmos `prisma
    // generate`, o cast vira no-op e pode ser removido.
    this.prisma = prisma as unknown as PrismaServiceComLead;
  }

  /**
   * ETAPA 1 - Cria um novo LeadConcierge a partir do primeiro contato no WA.
   * Status inicial: RECEBIDO.
   *
   * @throws NotFoundException se a cooperativa nao existir.
   */
  async iniciarFluxoLead(
    telefone: string,
    cooperativaId: string,
  ): Promise<LeadConcierge> {
    this.logger.log(
      `iniciarFluxoLead telefone=${telefone} cooperativaId=${cooperativaId}`,
    );

    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { id: true },
    });
    if (!coop) {
      throw new NotFoundException('Cooperativa nao encontrada');
    }

    // TODO: implementar - hoje cria registro minimo; futuro pode buscar
    // lead existente pelo telefone+cooperativa para idempotencia.
    return this.prisma.leadConcierge.create({
      data: {
        cooperativaId,
        telefone,
        statusLead: StatusLeadConcierge.RECEBIDO,
      },
    });
  }

  /**
   * ETAPA 2 - Marca lead como OCR_PROCESSANDO e armazena path do PDF.
   * Service real dispara OCR Claude assincrono fora desse metodo.
   */
  async processarFaturaRecebida(
    leadId: string,
    cooperativaId: string,
    pdfPath: string,
  ): Promise<void> {
    this.logger.log(
      `processarFaturaRecebida leadId=${leadId} cooperativaId=${cooperativaId}`,
    );

    const lead = await this.assertLeadExiste(leadId, cooperativaId);

    // TODO: implementar - hoje so atualiza status + salva path.
    // Proximo passo: enfileirar job OCR -> ConciergeService.previewDiagnostico
    // -> persistir DiagnosticoIndebito -> setar diagnosticoIndebitoId.
    await this.prisma.leadConcierge.update({
      where: { id: lead.id },
      data: {
        faturaPdfPath: pdfPath,
        statusLead: StatusLeadConcierge.OCR_PROCESSANDO,
      },
    });
  }

  /**
   * ETAPA 3 - Renderiza a mensagem de diagnostico pro WA usando os valores
   * canonicos do DiagnosticoIndebito.
   *
   * Retorna a string ja renderizada (caller envia via whatsapp-sender).
   */
  async entregarDiagnostico(
    leadId: string,
    cooperativaId: string,
  ): Promise<string> {
    this.logger.log(
      `entregarDiagnostico leadId=${leadId} cooperativaId=${cooperativaId}`,
    );

    const lead = await this.assertLeadExiste(leadId, cooperativaId);

    // TODO: implementar - hoje retorna template com placeholders nao
    // preenchidos (com excecao do nome quando disponivel). Proximo passo:
    // carregar DiagnosticoIndebito pelo lead.diagnosticoIndebitoId e
    // mapear indebitoMensal + cenarios pros placeholders abaixo.
    const mensagem = renderizarTemplate(MSG_DIAGNOSTICO_ENTREGUE, {
      nome: lead.nome ?? '',
    });

    await this.prisma.leadConcierge.update({
      where: { id: lead.id },
      data: { statusLead: StatusLeadConcierge.DIAGNOSTICO_PRONTO },
    });

    return mensagem;
  }

  /**
   * ETAPA 4 - Coleta dados basicos (nome, CPF/CNPJ, email).
   * Service real chega aqui apos confirmacao "Sim, me explica" do lead.
   */
  async coletarDadosBasicos(
    leadId: string,
    cooperativaId: string,
    dados: DadosBasicosLead,
  ): Promise<void> {
    this.logger.log(
      `coletarDadosBasicos leadId=${leadId} cooperativaId=${cooperativaId}`,
    );

    const lead = await this.assertLeadExiste(leadId, cooperativaId);

    // TODO: implementar - validar formato CPF/CNPJ + email aqui.
    await this.prisma.leadConcierge.update({
      where: { id: lead.id },
      data: {
        nome: dados.nome,
        cpfCnpj: dados.cpfCnpj,
        email: dados.email,
        statusLead: StatusLeadConcierge.DADOS_COLETADOS,
      },
    });
  }

  /**
   * ETAPA 5 - Coleta RG/CNH (somente path; OCR de documento de identidade
   * fica em service separado - D-novo-OCR-DOCUMENTO-IDENTIDADE P1).
   */
  async coletarDocumentos(
    leadId: string,
    cooperativaId: string,
    rgCnhPath: string,
  ): Promise<void> {
    this.logger.log(
      `coletarDocumentos leadId=${leadId} cooperativaId=${cooperativaId} path=${rgCnhPath}`,
    );

    const lead = await this.assertLeadExiste(leadId, cooperativaId);

    // TODO: implementar - persistir path do documento em DocumentoCooperado
    // futuro + agendar OCR; por ora apenas avanca o estado.
    await this.prisma.leadConcierge.update({
      where: { id: lead.id },
      data: { statusLead: StatusLeadConcierge.DOCUMENTOS_COLETADOS },
    });
  }

  /**
   * ETAPA 7 - Registra assinatura da procuracao via OTP enviado por SMS/WA.
   * Retorna `true` se OTP confere, `false` caso contrario.
   * Esqueleto: nao valida OTP de verdade ainda - retorna true se otpCode
   * tem 6 digitos numericos (placeholder).
   */
  async registrarAssinatura(
    leadId: string,
    cooperativaId: string,
    otpCode: string,
  ): Promise<boolean> {
    this.logger.log(
      `registrarAssinatura leadId=${leadId} cooperativaId=${cooperativaId}`,
    );

    const lead = await this.assertLeadExiste(leadId, cooperativaId);

    // TODO: implementar - validar OTP contra registro emitido (tabela nova
    // CodigoOtpAssinatura ou Redis). Por enquanto: aceita qualquer string
    // com 6 digitos numericos (esqueleto).
    const otpValido = /^\d{6}$/.test(otpCode);
    if (!otpValido) {
      return false;
    }

    await this.prisma.leadConcierge.update({
      where: { id: lead.id },
      data: {
        statusLead: StatusLeadConcierge.PROCURACAO_ASSINADA,
        procuracaoAssinadaEm: new Date(),
      },
    });
    return true;
  }

  /**
   * ETAPA 8 - Confirma pagamento da adesao + custas via webhook Asaas.
   * Service real recebe asaasPagamentoId e confirma com o gateway.
   */
  async confirmarPagamento(
    leadId: string,
    cooperativaId: string,
    asaasPagamentoId: string,
  ): Promise<void> {
    this.logger.log(
      `confirmarPagamento leadId=${leadId} cooperativaId=${cooperativaId} asaasPagamentoId=${asaasPagamentoId}`,
    );

    const lead = await this.assertLeadExiste(leadId, cooperativaId);

    // TODO: implementar - cruzar com Cobranca/Asaas + criar Cooperado real
    // + setar cooperadoId no lead (transicao para CONVERTIDO fica em outro
    // metodo que conhece o ciclo completo).
    await this.prisma.leadConcierge.update({
      where: { id: lead.id },
      data: {
        statusLead: StatusLeadConcierge.PAGAMENTO_CONFIRMADO,
        pagamentoConfirmadoEm: new Date(),
      },
    });
  }

  /**
   * Marca lead como FALLBACK_HUMANO quando bot nao consegue prosseguir
   * (erro OCR persistente, lead pedindo atendente, regra de negocio nao
   * coberta etc).
   */
  async marcarFallbackHumano(
    leadId: string,
    cooperativaId: string,
    motivo: string,
  ): Promise<void> {
    this.logger.log(
      `marcarFallbackHumano leadId=${leadId} cooperativaId=${cooperativaId} motivo="${motivo}"`,
    );

    const lead = await this.assertLeadExiste(leadId, cooperativaId);

    // TODO: implementar - notificar admin via WA/email; abrir ticket interno.
    await this.prisma.leadConcierge.update({
      where: { id: lead.id },
      data: {
        statusLead: StatusLeadConcierge.FALLBACK_HUMANO,
        motivoAbandono: motivo,
      },
    });
  }

  /**
   * Helper interno - busca lead garantindo isolamento multi-tenant.
   * Lanca NotFoundException se lead nao existir OU pertencer a outra
   * cooperativa (cross-tenant access).
   */
  private async assertLeadExiste(
    leadId: string,
    cooperativaId: string,
  ): Promise<LeadConcierge> {
    const lead = await this.prisma.leadConcierge.findFirst({
      where: { id: leadId, cooperativaId },
    });
    if (!lead) {
      throw new NotFoundException(
        `LeadConcierge ${leadId} nao encontrado para cooperativa ${cooperativaId}`,
      );
    }
    return lead;
  }
}
