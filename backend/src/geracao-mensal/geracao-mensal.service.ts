import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateGeracaoMensalDto } from './dto/create-geracao-mensal.dto';
import { UpdateGeracaoMensalDto } from './dto/update-geracao-mensal.dto';

@Injectable()
export class GeracaoMensalService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateGeracaoMensalDto) {
    return this.prisma.geracaoMensal.create({
      data: {
        usinaId: dto.usinaId,
        competencia: new Date(dto.competencia),
        kwhGerado: dto.kwhGerado,
        fonte: dto.fonte,
        observacao: dto.observacao,
      },
    });
  }

  async findAll(usinaId?: string, ano?: number) {
    const where: any = {};
    if (usinaId) where.usinaId = usinaId;
    if (ano) {
      where.competencia = {
        gte: new Date(`${ano}-01-01T00:00:00.000Z`),
        lt: new Date(`${ano + 1}-01-01T00:00:00.000Z`),
      };
    }
    return this.prisma.geracaoMensal.findMany({
      where,
      orderBy: { competencia: 'desc' },
      include: { usina: { select: { id: true, nome: true } } },
    });
  }

  async findOne(id: string) {
    const registro = await this.prisma.geracaoMensal.findUnique({
      where: { id },
      include: { usina: { select: { id: true, nome: true } } },
    });
    if (!registro) throw new NotFoundException('Registro de geração não encontrado');
    return registro;
  }

  async update(id: string, dto: UpdateGeracaoMensalDto) {
    await this.findOne(id);
    const data: any = {};
    if (dto.competencia !== undefined) data.competencia = new Date(dto.competencia);
    if (dto.kwhGerado !== undefined) data.kwhGerado = dto.kwhGerado;
    if (dto.fonte !== undefined) data.fonte = dto.fonte;
    if (dto.observacao !== undefined) data.observacao = dto.observacao;
    return this.prisma.geracaoMensal.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.geracaoMensal.delete({ where: { id } });
  }

  async getGeracaoMes(usinaId: string, competencia: Date): Promise<number | null> {
    const registro = await this.prisma.geracaoMensal.findUnique({
      where: { usinaId_competencia: { usinaId, competencia } },
    });
    return registro ? registro.kwhGerado : null;
  }
}
