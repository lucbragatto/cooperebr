import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClasseGdAplicada } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreatePoliticaAlocacaoDto } from './dto/create-politica-alocacao.dto';
import { UpdatePoliticaAlocacaoDto } from './dto/update-politica-alocacao.dto';

@Injectable()
export class PoliticaAlocacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(cooperativaId: string | null) {
    return this.prisma.politicaAlocacao.findMany({
      where: cooperativaId ? { cooperativaId } : {},
      orderBy: [{ prioridade: 'desc' }, { faixaMin: 'asc' }],
    });
  }

  async obter(id: string, cooperativaId: string | null) {
    const politica = await this.prisma.politicaAlocacao.findUnique({ where: { id } });
    if (!politica) throw new NotFoundException('Política não encontrada.');
    if (cooperativaId && politica.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Política não pertence à sua cooperativa.');
    }
    return politica;
  }

  async criar(args: { dto: CreatePoliticaAlocacaoDto; cooperativaId: string }) {
    const { dto, cooperativaId } = args;
    this.validarFaixa(dto.faixaMin, dto.faixaMax);
    return this.prisma.politicaAlocacao.create({
      data: {
        cooperativaId,
        nome: dto.nome,
        faixaMin: dto.faixaMin,
        faixaMax: dto.faixaMax ?? null,
        classeGdPreferida: dto.classeGdPreferida ?? null,
        usinasElegiveis: dto.usinasElegiveis ?? [],
        prioridade: dto.prioridade ?? 0,
        ativa: dto.ativa ?? true,
      },
    });
  }

  async atualizar(args: { id: string; dto: UpdatePoliticaAlocacaoDto; cooperativaId: string | null }) {
    const { id, dto, cooperativaId } = args;
    await this.obter(id, cooperativaId); // valida tenant
    if (dto.faixaMin !== undefined || dto.faixaMax !== undefined) {
      const atual = await this.prisma.politicaAlocacao.findUnique({ where: { id } });
      const novoMin = dto.faixaMin ?? Number(atual!.faixaMin);
      const novoMax = dto.faixaMax !== undefined ? dto.faixaMax : atual!.faixaMax ? Number(atual!.faixaMax) : null;
      this.validarFaixa(novoMin, novoMax);
    }
    return this.prisma.politicaAlocacao.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome } : {}),
        ...(dto.faixaMin !== undefined ? { faixaMin: dto.faixaMin } : {}),
        ...(dto.faixaMax !== undefined ? { faixaMax: dto.faixaMax } : {}),
        ...(dto.classeGdPreferida !== undefined
          ? { classeGdPreferida: dto.classeGdPreferida as ClasseGdAplicada | null }
          : {}),
        ...(dto.usinasElegiveis !== undefined ? { usinasElegiveis: dto.usinasElegiveis } : {}),
        ...(dto.prioridade !== undefined ? { prioridade: dto.prioridade } : {}),
        ...(dto.ativa !== undefined ? { ativa: dto.ativa } : {}),
      },
    });
  }

  async remover(id: string, cooperativaId: string | null) {
    await this.obter(id, cooperativaId);
    return this.prisma.politicaAlocacao.delete({ where: { id } });
  }

  private validarFaixa(faixaMin: number, faixaMax: number | null | undefined): void {
    if (faixaMin < 0) {
      throw new BadRequestException('faixaMin deve ser >= 0');
    }
    if (faixaMax !== null && faixaMax !== undefined && faixaMax <= faixaMin) {
      throw new BadRequestException('faixaMax deve ser > faixaMin (ou null pra sem teto)');
    }
  }
}
