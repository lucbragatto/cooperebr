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

    // CONV-SEM-UC-01: Buscar tarifa real (TUSD+TE) da concessionária, não descontoPadrao
    const tarifaVigente = await this.prisma.tarifaConcessionaria.findFirst({
      where: { cooperativaId: cooperado.cooperativaId },
      orderBy: { dataVigencia: 'desc' },
    });
    if (!tarifaVigente) throw new BadRequestException('Tarifa da concessionária não cadastrada para esta cooperativa');
    const tarifaKwh = Number(tarifaVigente.tusdNova) + Number(tarifaVigente.teNova);
    if (tarifaKwh <= 0) throw new BadRequestException('Tarifa da concessionária inválida (TUSD+TE = 0)');

    // Aplicar descontoPadrao como percentual de desconto sobre a tarifa
    const config = await this.prisma.configuracaoCobranca.findFirst({
      where: { cooperativaId: cooperado.cooperativaId },
    });
    const descontoPercentual = config ? Number(config.descontoPadrao) : 0;
    const tarifaComDesconto = tarifaKwh * (1 - descontoPercentual / 100);

    const valorReais = new Decimal(dto.kwhDesejado).mul(tarifaComDesconto).toDecimalPlaces(2);

    return this.prisma.conversaoCreditoSemUc.create({
      data: {
        cooperadoId,
        cooperativaId: cooperado.cooperativaId,
        valorKwh: dto.kwhDesejado,
        valorReais,
        tarifaUsada: tarifaComDesconto,
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
