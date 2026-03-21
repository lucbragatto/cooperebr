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

  async resolverDesconto(contratoId: string): Promise<{ desconto: number; baseCalculo: string; fonte: string }> {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id: contratoId },
      include: { usina: true },
    });
    if (!contrato) throw new NotFoundException('Contrato não encontrado');

    // 1. Override no contrato
    if (contrato.descontoOverride != null) {
      return {
        desconto: Number(contrato.descontoOverride),
        baseCalculo: contrato.baseCalculoOverride ?? 'TUSD_TE',
        fonte: 'contrato',
      };
    }

    // 2. Config da usina
    if (contrato.usinaId) {
      const configUsina = await this.prisma.configuracaoCobranca.findFirst({
        where: { usinaId: contrato.usinaId },
      });
      if (configUsina) {
        return {
          desconto: Number(configUsina.descontoPadrao),
          baseCalculo: configUsina.baseCalculo,
          fonte: 'usina',
        };
      }
    }

    // 3. Config da cooperativa
    const cooperativaId = contrato.cooperativaId;
    if (cooperativaId) {
      const configCoop = await this.prisma.configuracaoCobranca.findFirst({
        where: { cooperativaId, usinaId: null },
      });
      if (configCoop) {
        return {
          desconto: Number(configCoop.descontoPadrao),
          baseCalculo: configCoop.baseCalculo,
          fonte: 'cooperativa',
        };
      }
    }

    // 4. Nenhuma configuração encontrada
    throw new BadRequestException(
      'Nenhuma configuração de desconto encontrada. Configure o desconto na cooperativa, na usina ou diretamente no contrato.',
    );
  }
}
