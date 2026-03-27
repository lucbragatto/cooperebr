import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface CalcularPixExcedenteDto {
  cooperadoId?: string;
  condominioId?: string;
  kwhExcedente: number;
  tarifaKwh: number;          // R$/kWh da distribuidora
  mesReferencia: string;       // YYYY-MM
  aliquotaIR?: number;        // % (ex: 7.5)
  aliquotaPIS?: number;
  aliquotaCOFINS?: number;
  pixChave?: string;
  pixTipo?: string;
  cooperativaId?: string;
}

export interface ConfigImpostosDto {
  aliquotaIR: number;
  aliquotaPIS: number;
  aliquotaCOFINS: number;
}

@Injectable()
export class PixExcedenteService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calcula o valor liquido do excedente após impostos e registra a transferência
   */
  async processarPixExcedente(dto: CalcularPixExcedenteDto) {
    if (!dto.cooperadoId && !dto.condominioId) {
      throw new BadRequestException('É necessário informar cooperadoId ou condominioId');
    }
    if (dto.kwhExcedente <= 0) {
      throw new BadRequestException('kwhExcedente deve ser maior que zero');
    }
    if (dto.tarifaKwh <= 0) {
      throw new BadRequestException('tarifaKwh deve ser maior que zero');
    }

    // Buscar dados do destinatário
    let pixChave = dto.pixChave;
    let pixTipo = dto.pixTipo;

    if (dto.cooperadoId && !pixChave) {
      const cooperado = await this.prisma.cooperado.findUnique({
        where: { id: dto.cooperadoId },
        select: { id: true, nomeCompleto: true, pixChave: true, pixTipo: true },
      });
      if (!cooperado) throw new NotFoundException('Cooperado não encontrado');
      pixChave = cooperado.pixChave ?? undefined;
      pixTipo = cooperado.pixTipo ?? undefined;
    }

    if (dto.condominioId && !pixChave) {
      const cond = await this.prisma.condominio.findUnique({
        where: { id: dto.condominioId },
        select: { excedentePixChave: true, excedentePixTipo: true },
      });
      if (!cond) throw new NotFoundException('Condomínio não encontrado');
      pixChave = cond.excedentePixChave ?? undefined;
      pixTipo = cond.excedentePixTipo ?? undefined;
    }

    if (!pixChave) {
      throw new BadRequestException('Chave PIX não cadastrada. Cadastre a chave PIX no perfil.');
    }

    // Buscar alíquotas: prioridade body > condomínio > cooperado (via unidade)
    let aliquotaIR = dto.aliquotaIR ?? 0;
    let aliquotaPIS = dto.aliquotaPIS ?? 0;
    let aliquotaCOFINS = dto.aliquotaCOFINS ?? 0;

    const aliquotasNaoInformadas = dto.aliquotaIR === undefined && dto.aliquotaPIS === undefined && dto.aliquotaCOFINS === undefined;

    if (aliquotasNaoInformadas && dto.condominioId) {
      const condAliq = await this.prisma.condominio.findUnique({
        where: { id: dto.condominioId },
        select: { aliquotaIR: true, aliquotaPIS: true, aliquotaCOFINS: true },
      });
      if (condAliq) {
        aliquotaIR = condAliq.aliquotaIR ?? 0;
        aliquotaPIS = condAliq.aliquotaPIS ?? 0;
        aliquotaCOFINS = condAliq.aliquotaCOFINS ?? 0;
      }
    }

    if (aliquotasNaoInformadas && dto.cooperadoId && aliquotaIR === 0 && aliquotaPIS === 0 && aliquotaCOFINS === 0) {
      // Buscar condomínio vinculado ao cooperado via unidade
      const unidade = await this.prisma.unidadeCondominio.findFirst({
        where: { cooperadoId: dto.cooperadoId, ativo: true },
        include: { condominio: { select: { aliquotaIR: true, aliquotaPIS: true, aliquotaCOFINS: true } } },
      });
      if (unidade?.condominio) {
        aliquotaIR = unidade.condominio.aliquotaIR ?? 0;
        aliquotaPIS = unidade.condominio.aliquotaPIS ?? 0;
        aliquotaCOFINS = unidade.condominio.aliquotaCOFINS ?? 0;
      }
    }

    // Calcular valores
    const valorBruto = dto.kwhExcedente * dto.tarifaKwh;
    const valorIR = valorBruto * (aliquotaIR / 100);
    const valorPIS = valorBruto * (aliquotaPIS / 100);
    const valorCOFINS = valorBruto * (aliquotaCOFINS / 100);
    const valorImpostos = valorIR + valorPIS + valorCOFINS;
    const valorLiquido = Math.max(0, valorBruto - valorImpostos);

    // Registrar transferência (SIMULADO por enquanto)
    const transferencia = await this.prisma.transferenciaPix.create({
      data: {
        cooperativaId: dto.cooperativaId ?? null,
        cooperadoId: dto.cooperadoId ?? null,
        condominioId: dto.condominioId ?? null,
        valorBruto: Math.round(valorBruto * 100) / 100,
        aliquotaIR,
        aliquotaPIS,
        aliquotaCOFINS,
        valorImpostos: Math.round(valorImpostos * 100) / 100,
        valorLiquido: Math.round(valorLiquido * 100) / 100,
        pixChave: pixChave!,
        pixTipo: pixTipo ?? 'ALEATORIA',
        mesReferencia: dto.mesReferencia,
        kwhExcedente: dto.kwhExcedente,
        tarifaKwh: dto.tarifaKwh,
        status: 'SIMULADO',
        observacao: `Excedente de ${dto.kwhExcedente.toFixed(2)} kWh à R$ ${dto.tarifaKwh}/kWh. Impostos: IR ${aliquotaIR}%, PIS ${aliquotaPIS}%, COFINS ${aliquotaCOFINS}%`,
      },
    });

    return {
      transferenciaId: transferencia.id,
      mesReferencia: dto.mesReferencia,
      kwhExcedente: dto.kwhExcedente,
      tarifaKwh: dto.tarifaKwh,
      valorBruto: transferencia.valorBruto,
      impostos: {
        IR: { aliquota: aliquotaIR, valor: Math.round(valorIR * 100) / 100 },
        PIS: { aliquota: aliquotaPIS, valor: Math.round(valorPIS * 100) / 100 },
        COFINS: { aliquota: aliquotaCOFINS, valor: Math.round(valorCOFINS * 100) / 100 },
        total: transferencia.valorImpostos,
      },
      valorLiquido: transferencia.valorLiquido,
      pix: { chave: pixChave, tipo: pixTipo },
      status: transferencia.status,
      observacao: transferencia.observacao,
    };
  }

  async listarTransferencias(filtros: {
    cooperativaId?: string;
    cooperadoId?: string;
    condominioId?: string;
    mesReferencia?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { page = 1, limit = 20, ...where } = filtros;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.transferenciaPix.findMany({
        where: {
          ...(where.cooperativaId ? { cooperativaId: where.cooperativaId } : {}),
          ...(where.cooperadoId ? { cooperadoId: where.cooperadoId } : {}),
          ...(where.condominioId ? { condominioId: where.condominioId } : {}),
          ...(where.mesReferencia ? { mesReferencia: where.mesReferencia } : {}),
          ...(where.status ? { status: where.status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transferenciaPix.count({
        where: {
          ...(where.cooperativaId ? { cooperativaId: where.cooperativaId } : {}),
          ...(where.cooperadoId ? { cooperadoId: where.cooperadoId } : {}),
          ...(where.condominioId ? { condominioId: where.condominioId } : {}),
          ...(where.mesReferencia ? { mesReferencia: where.mesReferencia } : {}),
          ...(where.status ? { status: where.status } : {}),
        },
      }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getTransferencia(id: string) {
    const t = await this.prisma.transferenciaPix.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Transferência não encontrada');
    return t;
  }

  async resumoExcedentes(cooperativaId: string) {
    const [total, porStatus] = await Promise.all([
      this.prisma.transferenciaPix.aggregate({
        where: { cooperativaId },
        _sum: { valorBruto: true, valorLiquido: true, valorImpostos: true, kwhExcedente: true },
        _count: true,
      }),
      this.prisma.transferenciaPix.groupBy({
        by: ['status'],
        where: { cooperativaId },
        _count: true,
        _sum: { valorLiquido: true },
      }),
    ]);

    return {
      totalTransferencias: total._count,
      valorBrutoTotal: total._sum.valorBruto ?? 0,
      valorLiquidoTotal: total._sum.valorLiquido ?? 0,
      impostosRetidosTotal: total._sum.valorImpostos ?? 0,
      kwhExcedenteTotal: total._sum.kwhExcedente ?? 0,
      porStatus: porStatus.map(s => ({
        status: s.status,
        quantidade: s._count,
        valorLiquido: s._sum.valorLiquido ?? 0,
      })),
    };
  }
}
