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

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class PortalEmpresaService {
  constructor(private prisma: PrismaService) {}

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
}
