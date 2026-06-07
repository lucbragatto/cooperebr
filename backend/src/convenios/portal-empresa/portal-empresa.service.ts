/**
 * Sprint Portal Empresa 9.0 + 9.1 (04/06/2026) — Service do portal da empresa
 * conveniada (responsável da empresa pagadora vê dashboard, convites,
 * pendentes e cobranças do seu convênio).
 *
 * Multi-tenant: TODA query é gated pelo PagadorCooperadoGuard (handler-level
 * via @PagadorCooperadoOnly). O service nunca filtra por cooperativaId do
 * usuário — confia no guard pra validar `cooperadoId === pagadorCooperadoId`.
 *
 * Decisões Luciano (Fase 1):
 *  - Empresa só vê PENDENTE/A_VENCER/PAGO (esconde AGUARDANDO_EMISSAO/FALHA
 *    — estados técnicos transitórios não interessam à empresa).
 *  - Status derivado de membros calculado no backend (mesma lógica da Fatia 5).
 */

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  ConveniosCusteioService,
  PreviewKwhConsolidadoResult,
  PreviewKwhMembroDetalhe,
} from '../convenios-custeio.service';

/**
 * Sprint Onboarding Bloco 2 Fatia 2.3 (07/06/2026) — shape público da resposta
 * de `/portal/meus-convenios/:id/kwh-consumo`. UC mascarada (últimos 3 dígitos
 * + distribuidora completa) — LGPD: empresa paga, mas não tem direito ao número
 * cheio da UC do funcionário.
 */
export interface KwhConsumoEntradaPublica {
  cooperadoId: string;
  nome: string;
  ucs: Array<{ numeroMascarado: string; distribuidora: string }>;
  kwh: number;
  fonte: 'fatura' | 'cota' | 'rateio' | 'sem-dado';
  percentual: number;
  semFaturaNoMes?: boolean;
  isPagador?: boolean;
}

export interface KwhConsumoResponse {
  convenioId: string;
  convenioNome: string;
  base: 'CONSUMO_REAL' | 'ALOCACAO_FIXA';
  mesReferencia: number;
  anoReferencia: number;
  mesRefStr: string;
  status: PreviewKwhConsolidadoResult['status'];
  /** Soma DINÂMICA do consumo dos membros (cotas em ALOCACAO_FIXA, faturas em CONSUMO_REAL). */
  kwhTotal: number;
  /** Crédito de energia INICIALMENTE disponível na assinatura (referência). */
  disponivelAssinatura: number | null;
  /** kwhTotal > disponivelAssinatura → UI sinaliza (sem bloquear). */
  excedente?: boolean;
  membros: KwhConsumoEntradaPublica[];
}

/**
 * Mascara o número da UC mantendo só os 3 últimos dígitos.
 * Ex: '0001421380054' → '...054'. Strings curtas (<=3) ficam intactas.
 */
export function mascararNumeroUc(numero: string): string {
  if (!numero) return numero;
  if (numero.length <= 3) return numero;
  return '...' + numero.slice(-3);
}

@Injectable()
export class PortalEmpresaService {
  constructor(
    private prisma: PrismaService,
    // Fatia 2.3 — fonte única do kWh consolidado (preview read-only).
    @Inject(forwardRef(() => ConveniosCusteioService))
    private custeioService: ConveniosCusteioService,
  ) {}

  /**
   * Lista todos os convênios ATIVOS onde o cooperadoId é o pagador.
   * Usado no /conveniada (home) quando empresa pertence a múltiplos
   * convênios (raro, mas suportado pelo schema).
   */
  async listarMeusConvenios(cooperadoId: string) {
    const convenios = await this.prisma.contratoConvenio.findMany({
      where: {
        pagadorCooperadoId: cooperadoId,
        status: 'ATIVO',
      },
      select: {
        id: true,
        numero: true,
        empresaNome: true,
        empresaCnpj: true,
        naturezaAtoCooperativo: true,
        baseCobrancaCusteio: true,
        kwhAlocadoMensal: true,
        descontoKwhCusteio: true,
        diaEnvioRelatorio: true,
        status: true,
        createdAt: true,
      },
      orderBy: { empresaNome: 'asc' },
    });
    return { data: convenios, total: convenios.length };
  }

  /**
   * Dashboard de um convênio específico (já validado pelo guard).
   * Retorna header completo + contadores de membros + cobranças
   * filtradas (só PENDENTE/A_VENCER/PAGO — esconde estados técnicos).
   */
  async dashboardConvenio(convenioId: string) {
    const convenio = await this.prisma.contratoConvenio.findUnique({
      where: { id: convenioId },
      select: {
        id: true,
        numero: true,
        empresaNome: true,
        empresaCnpj: true,
        empresaEmail: true,
        empresaTelefone: true,
        conveniadoNome: true,
        conveniadoEmail: true,
        conveniadoTelefone: true,
        naturezaAtoCooperativo: true,
        baseCobrancaCusteio: true,
        kwhAlocadoMensal: true,
        descontoKwhCusteio: true,
        diaEnvioRelatorio: true,
        status: true,
        createdAt: true,
        cooperativaId: true,
      },
    });
    if (!convenio) {
      throw new NotFoundException('Convênio não encontrado.');
    }

    // ContratoConvenio.cooperativaId não tem relação direta no Prisma; busca à parte
    const cooperativa = convenio.cooperativaId
      ? await this.prisma.cooperativa.findUnique({
          where: { id: convenio.cooperativaId },
          select: { id: true, nome: true },
        })
      : null;

    // Contadores de membros (visão sintética pra header)
    const membrosPorStatus = await this.prisma.convenioCooperado.groupBy({
      by: ['status'],
      where: { convenioId },
      _count: true,
    });
    const contadoresMembros = membrosPorStatus.reduce(
      (acc, g) => {
        acc[g.status] = g._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Sprint Financeiro F1 + Sprint Portal Empresa 9.1 (04/06/2026):
    // Empresa NÃO vê AGUARDANDO_EMISSAO / FALHA_EMISSAO (estados técnicos).
    // Só vê PENDENTE / A_VENCER / PAGO / VENCIDO da cobrança em si.
    // Para que o documento de pagamento esteja disponível, filtramos por
    // statusEmissao=EMITIDO OR status=PAGO (PAGO pode ser baixa manual sem gateway).
    const cobrancas = await this.prisma.cobranca.findMany({
      where: {
        convenioContabilCobrancaId: convenioId,
        status: { in: ['PENDENTE', 'A_VENCER', 'PAGO', 'VENCIDO'] },
        OR: [
          { statusEmissao: 'EMITIDO' },
          { status: 'PAGO' },
        ],
      },
      select: {
        id: true,
        mesReferencia: true,
        anoReferencia: true,
        valorLiquido: true,
        valorPago: true,
        status: true,
        dataVencimento: true,
        dataPagamento: true,
        // Link de pagamento (boleto/PIX) vem do AsaasCobranca/CobrancaGateway
        asaasCobrancas: {
          select: {
            linkPagamento: true,
            boletoUrl: true,
            pixCopiaECola: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ anoReferencia: 'desc' }, { mesReferencia: 'desc' }],
      take: 24, // últimos 24 meses
    });

    return {
      convenio: { ...convenio, cooperativa },
      contadoresMembros,
      cobrancas,
    };
  }

  /**
   * Sprint Onboarding Bloco 2 Fatia 2.3 (07/06/2026) — kWh consolidado por mês.
   *
   * FONTE ÚNICA: delega pro `ConveniosCusteioService.previewKwhConsolidado` (mesma
   * fonte que `gerarCobrancaConsolidada` usa pra cobrar). Preview e cobrança real
   * NUNCA divergem por construção.
   *
   * Segurança em profundidade:
   *  - Caller passa `cooperativaId` derivado de `req.empresa.cooperativaId` (guard
   *    `@PagadorCooperadoOnly` já validou posse). Service não confia no `:id` da URL.
   *  - Cross-convênio (cooperativaId não bate) → preview retorna NotFoundException
   *    (anti-enumeração, alinhado com o guard).
   *
   * Default `mes`: mês anterior (cron de cobrança opera em mês fechado — preview
   * idem). Validação `mes <= corrente` é responsabilidade do controller.
   *
   * Mascaramento LGPD: UC retorna só os 3 últimos dígitos (`...054`) + distribuidora
   * completa. Empresa paga, mas dado da UC é pessoal do funcionário.
   */
  async kwhConsumoConvenio(opts: {
    convenioId: string;
    mesReferencia: number;
    anoReferencia: number;
    cooperativaId: string;
  }): Promise<KwhConsumoResponse> {
    const preview = await this.custeioService.previewKwhConsolidado({
      convenioId: opts.convenioId,
      mesReferencia: opts.mesReferencia,
      anoReferencia: opts.anoReferencia,
      cooperativaId: opts.cooperativaId,
    });

    const membros: KwhConsumoEntradaPublica[] = preview.membros.map(
      (m: PreviewKwhMembroDetalhe) => ({
        cooperadoId: m.cooperadoId,
        nome: m.nome,
        ucs: m.ucs.map((u) => ({
          numeroMascarado: mascararNumeroUc(u.numero),
          distribuidora: u.distribuidora,
        })),
        kwh: m.kwh,
        fonte: m.fonte,
        percentual: m.percentual,
        ...(m.semFaturaNoMes ? { semFaturaNoMes: true } : {}),
        ...(m.isPagador ? { isPagador: true } : {}),
      }),
    );

    return {
      convenioId: preview.convenioId,
      convenioNome: preview.convenioNome,
      base: preview.base,
      mesReferencia: preview.mesReferencia,
      anoReferencia: preview.anoReferencia,
      mesRefStr: preview.mesRefStr,
      status: preview.status,
      kwhTotal: preview.kwhTotal,
      disponivelAssinatura: preview.disponivelAssinatura,
      ...(preview.excedente ? { excedente: true } : {}),
      membros,
    };
  }
}
