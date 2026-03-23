import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePrestadorDto } from './dto/create-prestador.dto';
import { UpdatePrestadorDto } from './dto/update-prestador.dto';

@Injectable()
export class PrestadoresService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.prestador.findMany({
      include: { cooperado: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const prestador = await this.prisma.prestador.findUnique({
      where: { id },
      include: { cooperado: true },
    });
    if (!prestador) throw new NotFoundException(`Prestador com id ${id} não encontrado`);
    return prestador;
  }

  async create(data: CreatePrestadorDto) {
    return this.prisma.prestador.create({ data });
  }

  async update(id: string, data: UpdatePrestadorDto) {
    return this.prisma.prestador.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.prestador.delete({ where: { id } });
  }
}
