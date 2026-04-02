import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ConfiguracaoCobrancaService {
  constructor(private prisma: PrismaService) {}

  async findByCooperativa(cooperativaId: string) {
    const config = await this.prisma.configuracaoCobranca.findFirst({
      where: { cooperativaId, usinaId: null },
    });
    if (!config) throw new NotFoundException('Configuração da cooperativa não encontrada');
    return config;
  }

  async upsertCooperativa(cooperativaId: string, data: { descontoPadrao: number; descontoMin: number; descontoMax: number; baseCalculo?: string }) {
    const existing = await this.prisma.configuracaoCobranca.findFirst({
      where: { cooperativaId, usinaId: null },
    });
    const payload = {
      descontoPadrao: data.descontoPadrao,
      descontoMin: data.descontoMin,
      descontoMax: data.descontoMax,
      ...(data.baseCalculo && { baseCalculo: data.baseCalculo as any }),
    };
    if (existing) {
      return this.prisma.configuracaoCobranca.update({ where: { id: existing.id }, data: payload });
    }
    return this.prisma.configuracaoCobranca.create({
      data: { ...payload, cooperativaId, baseCalculo: (data.baseCalculo as any) ?? 'TUSD_TE' },
    });
  }

  async findByUsina(usinaId: string) {
    const config = await this.prisma.configuracaoCobranca.findFirst({
      where: { usinaId },
    });
    if (!config) throw new NotFoundException('Configuração da usina não encontrada');
    return config;
  }

  async upsertUsina(usinaId: string, cooperativaId: string, data: { descontoPadrao: number; descontoMin: number; descontoMax: number; baseCalculo?: string }) {
    const existing = await this.prisma.configuracaoCobranca.findFirst({
      where: { cooperativaId, usinaId },
    });
    const payload = {
      descontoPadrao: data.descontoPadrao,
      descontoMin: data.descontoMin,
      descontoMax: data.descontoMax,
      ...(data.baseCalculo && { baseCalculo: data.baseCalculo as any }),
    };
    if (existing) {
      return this.prisma.configuracaoCobranca.update({ where: { id: existing.id }, data: payload });
    }
    return this.prisma.configuracaoCobranca.create({
      data: { ...payload, cooperativaId, usinaId, baseCalculo: (data.baseCalculo as any) ?? 'TUSD_TE' },
    });
  }

  async resolverDesconto(contratoId: string): Promise<{ desconto: number; baseCalculo: string; fonte: string; descontoConvenio?: number }> {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id: contratoId },
      include: { usina: true },
    });
    if (!contrato) throw new NotFoundException('Contrato não encontrado');

    let descontoBase: { desconto: number; baseCalculo: string; fonte: string } | null = null;

    // 1. Override no contrato
    if (contrato.descontoOverride != null) {
      descontoBase = {
        desconto: Number(contrato.descontoOverride),
        baseCalculo: contrato.baseCalculoOverride ?? 'TUSD_TE',
        fonte: 'contrato',
      };
    }

    // 2. Config da usina
    if (!descontoBase && contrato.usinaId) {
      const configUsina = await this.prisma.configuracaoCobranca.findFirst({
        where: { usinaId: contrato.usinaId },
      });
      if (configUsina) {
        descontoBase = {
          desconto: Number(configUsina.descontoPadrao),
          baseCalculo: configUsina.baseCalculo,
          fonte: 'usina',
        };
      }
    }

    // 3. Config da cooperativa
    if (!descontoBase) {
      const cooperativaId = contrato.cooperativaId;
      if (cooperativaId) {
        const configCoop = await this.prisma.configuracaoCobranca.findFirst({
          where: { cooperativaId, usinaId: null },
        });
        if (configCoop) {
          descontoBase = {
            desconto: Number(configCoop.descontoPadrao),
            baseCalculo: configCoop.baseCalculo,
            fonte: 'cooperativa',
          };
        }
      }
    }

    if (!descontoBase) {
      throw new BadRequestException(
        'Nenhuma configuração de desconto encontrada. Configure o desconto na cooperativa, na usina ou diretamente no contrato.',
      );
    }

    // 4. Desconto ADITIVO do convênio (soma com desconto base)
    const descontoConvenio = await this.resolverDescontoConvenio(contrato.cooperadoId);
    if (descontoConvenio > 0) {
      const total = Math.min(descontoBase.desconto + descontoConvenio, 100);
      return {
        desconto: total,
        baseCalculo: descontoBase.baseCalculo,
        fonte: `${descontoBase.fonte}+convenio`,
        descontoConvenio,
      };
    }

    return descontoBase;
  }

  private async resolverDescontoConvenio(cooperadoId: string): Promise<number> {
    // Desconto como membro de convênio
    const membro = await this.prisma.convenioCooperado.findFirst({
      where: { cooperadoId, ativo: true },
      include: { convenio: true },
    });

    let descontoMembro = 0;
    if (membro) {
      descontoMembro = membro.descontoOverride != null
        ? Number(membro.descontoOverride)
        : Number(membro.convenio.descontoMembrosAtual);
    }

    // Desconto como conveniado (representante) — acumula de todos os convênios
    const conveniosRepresentados = await this.prisma.contratoConvenio.findMany({
      where: { conveniadoId: cooperadoId, status: 'ATIVO' },
      select: { descontoConveniadoAtual: true, configBeneficio: true },
    });

    let descontoConveniado = 0;
    for (const conv of conveniosRepresentados) {
      const config = conv.configBeneficio as any;
      const cap = config?.maxAcumuloConveniado ?? 100;
      descontoConveniado += Math.min(Number(conv.descontoConveniadoAtual), cap);
    }

    return Math.min(descontoMembro + descontoConveniado, 100);
  }
}
