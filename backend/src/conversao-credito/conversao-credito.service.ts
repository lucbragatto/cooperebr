import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ConversaoCreditoService {
  private readonly logger = new Logger(ConversaoCreditoService.name);

  constructor(private prisma: PrismaService) {}

  async solicitar(cooperadoId: string, dto: { kwhDesejado: number; pixChave?: string; pixNome?: string }) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { id: true, tipoCooperado: true, cooperativaId: true },
    });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');
    if (cooperado.tipoCooperado !== 'SEM_UC') {
      throw new BadRequestException('Conversão de créditos disponível apenas para cooperados SEM_UC');
    }
    if (!cooperado.cooperativaId) throw new BadRequestException('Cooperativa não encontrada');

    // Buscar tarifa vigente da cooperativa
    const config = await this.prisma.configuracaoCobranca.findFirst({
      where: { cooperativaId: cooperado.cooperativaId },
    });
    const tarifa = config ? Number(config.descontoPadrao) : 0;
    if (tarifa <= 0) throw new BadRequestException('Tarifa não configurada para esta cooperativa');

    const valorReais = new Decimal(dto.kwhDesejado).mul(tarifa).toDecimalPlaces(2);

    return this.prisma.conversaoCreditoSemUc.create({
      data: {
        cooperadoId,
        cooperativaId: cooperado.cooperativaId,
        valorKwh: dto.kwhDesejado,
        valorReais,
        tarifaUsada: tarifa,
        pixChave: dto.pixChave,
        pixNome: dto.pixNome,
        status: 'PENDENTE',
      },
    });
  }

  async minhas(cooperadoId: string) {
    return this.prisma.conversaoCreditoSemUc.findMany({
      where: { cooperadoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listarPendentes(cooperativaId: string) {
    return this.prisma.conversaoCreditoSemUc.findMany({
      where: { cooperativaId, status: { in: ['PENDENTE', 'APROVADO'] } },
      include: {
        cooperado: { select: { id: true, nomeCompleto: true, cpf: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async aprovar(id: string, cooperativaId: string) {
    const conversao = await this.prisma.conversaoCreditoSemUc.findFirst({
      where: { id, cooperativaId },
    });
    if (!conversao) throw new NotFoundException('Solicitação não encontrada');
    if (conversao.status !== 'PENDENTE') throw new BadRequestException('Solicitação não está pendente');

    return this.prisma.conversaoCreditoSemUc.update({
      where: { id },
      data: { status: 'PAGO' },
    });
  }

  async cancelar(id: string, cooperativaId?: string) {
    const where: any = { id };
    if (cooperativaId) where.cooperativaId = cooperativaId;

    const conversao = await this.prisma.conversaoCreditoSemUc.findFirst({ where });
    if (!conversao) throw new NotFoundException('Solicitação não encontrada');
    if (conversao.status === 'PAGO') throw new BadRequestException('Solicitação já foi paga');

    return this.prisma.conversaoCreditoSemUc.update({
      where: { id },
      data: { status: 'CANCELADO' },
    });
  }
}
