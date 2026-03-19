import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class UsinasService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.usina.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.usina.findUnique({
      where: { id },
    });
  }

  async create(data: {
    nome: string;
    potenciaKwp: number;
    capacidadeKwh?: number;
    cidade: string;
    estado: string;
  }) {
    return this.prisma.usina.create({ data });
  }

  async update(id: string, data: Partial<{
    nome: string;
    potenciaKwp: number;
    capacidadeKwh: number;
    cidade: string;
    estado: string;
  }>) {
    return this.prisma.usina.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.usina.delete({ where: { id } });
  }

  async gerarListaConcessionaria(usinaId: string) {
    const usina = await this.prisma.usina.findUnique({ where: { id: usinaId } });
    if (!usina) throw new Error('Usina não encontrada');

    const contratos = await this.prisma.contrato.findMany({
      where: { usinaId, status: 'ATIVO' },
      include: {
        cooperado: true,
        uc: true,
      },
    });

    const capacidade = Number(usina.capacidadeKwh ?? 0);

    return {
      usina: {
        id: usina.id,
        nome: usina.nome,
        potenciaKwp: Number(usina.potenciaKwp),
        capacidadeKwh: capacidade,
        cidade: usina.cidade,
        estado: usina.estado,
      },
      cooperados: contratos.map((c) => {
        const kwh = Number(c.kwhContrato ?? 0);
        return {
          nomeCompleto: c.cooperado.nomeCompleto,
          cpf: c.cooperado.cpf,
          numeroUC: c.uc?.numero ?? '',
          kwhContratado: kwh,
          percentualUsina: capacidade > 0 ? Math.round((kwh / capacidade) * 10000) / 100 : 0,
          dataAdesao: c.dataInicio,
          distribuidora: (c.uc as any)?.distribuidora ?? '',
          contrato: c.numero,
        };
      }),
    };
  }
}