import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConveniosProgressaoService } from './convenios-progressao.service';

@Injectable()
export class ConveniosMembrosService {
  private readonly logger = new Logger(ConveniosMembrosService.name);

  constructor(
    private prisma: PrismaService,
    private progressaoService: ConveniosProgressaoService,
  ) {}

  async adicionarMembro(convenioId: string, cooperadoId: string, matricula?: string) {
    const convenio = await this.prisma.contratoConvenio.findUnique({ where: { id: convenioId } });
    if (!convenio) throw new NotFoundException('Convênio não encontrado');
    if (convenio.status !== 'ATIVO') throw new BadRequestException('Convênio não está ativo');

    const cooperado = await this.prisma.cooperado.findUnique({ where: { id: cooperadoId } });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');

    // Verificar que cooperado pertence à mesma cooperativa
    if (cooperado.cooperativaId !== convenio.cooperativaId) {
      throw new BadRequestException('Cooperado não pertence a esta cooperativa');
    }

    // Verificar se cooperado já é membro de outro convênio ativo
    const membroOutro = await this.prisma.convenioCooperado.findFirst({
      where: {
        cooperadoId,
        ativo: true,
        convenioId: { not: convenioId },
      },
    });
    if (membroOutro) {
      throw new BadRequestException('Cooperado já é membro de outro convênio ativo. Desvincule primeiro.');
    }

    // Verificar se já existe vínculo
    const existente = await this.prisma.convenioCooperado.findUnique({
      where: { convenioId_cooperadoId: { convenioId, cooperadoId } },
    });

    let membro;
    if (existente) {
      if (existente.ativo) throw new BadRequestException('Cooperado já vinculado a este convênio');
      // Reativar
      membro = await this.prisma.convenioCooperado.update({
        where: { id: existente.id },
        data: {
          ativo: true,
          status: 'MEMBRO_ATIVO',
          matricula: matricula ?? existente.matricula,
          dataAdesao: new Date(),
          dataDesligamento: null,
        },
      });
    } else {
      membro = await this.prisma.convenioCooperado.create({
        data: {
          convenioId,
          cooperadoId,
          matricula,
          ativo: true,
          status: 'MEMBRO_ATIVO',
          dataAdesao: new Date(),
        },
      });
    }

    // Registrar como indicação se configurado
    if (convenio.registrarComoIndicacao && convenio.conveniadoId) {
      try {
        await this.registrarIndicacaoConvenio(convenio.conveniadoId, cooperadoId, convenio.cooperativaId, membro.id);
      } catch (err) {
        this.logger.warn(`Falha ao registrar indicação do convênio: ${err.message}`);
      }
    }

    // Recalcular faixa
    await this.progressaoService.recalcularFaixa(convenioId, 'NOVO_MEMBRO');

    return membro;
  }

  async removerMembro(convenioId: string, cooperadoId: string) {
    const vinculo = await this.prisma.convenioCooperado.findUnique({
      where: { convenioId_cooperadoId: { convenioId, cooperadoId } },
    });
    if (!vinculo) throw new NotFoundException('Vínculo não encontrado');
    if (!vinculo.ativo) throw new BadRequestException('Membro já desligado');

    const updated = await this.prisma.convenioCooperado.update({
      where: { id: vinculo.id },
      data: {
        ativo: false,
        status: 'MEMBRO_DESLIGADO',
        dataDesligamento: new Date(),
      },
    });

    // Recalcular faixa
    await this.progressaoService.recalcularFaixa(convenioId, 'MEMBRO_DESLIGADO');

    return updated;
  }

  async updateMembro(convenioId: string, cooperadoId: string, data: { descontoOverride?: number | null; matricula?: string }) {
    const vinculo = await this.prisma.convenioCooperado.findUnique({
      where: { convenioId_cooperadoId: { convenioId, cooperadoId } },
    });
    if (!vinculo) throw new NotFoundException('Vínculo não encontrado');

    const updateData: any = {};
    if (data.descontoOverride !== undefined) updateData.descontoOverride = data.descontoOverride;
    if (data.matricula !== undefined) updateData.matricula = data.matricula;

    return this.prisma.convenioCooperado.update({
      where: { id: vinculo.id },
      data: updateData,
    });
  }

  async listarMembros(convenioId: string) {
    return this.prisma.convenioCooperado.findMany({
      where: { convenioId },
      include: {
        cooperado: {
          select: { id: true, nomeCompleto: true, cpf: true, email: true, telefone: true, tipoCooperado: true },
        },
        indicacao: { select: { id: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async importarMembros(convenioId: string, membros: { cooperadoId: string; matricula?: string }[]) {
    const convenio = await this.prisma.contratoConvenio.findUnique({ where: { id: convenioId } });
    if (!convenio) throw new NotFoundException('Convênio não encontrado');
    if (convenio.status !== 'ATIVO') throw new BadRequestException('Convênio não está ativo');

    const resultados = { sucesso: 0, erros: [] as string[], parcial: false };

    for (const m of membros) {
      try {
        await this.adicionarMembroSemRecalculo(convenioId, convenio, m.cooperadoId, m.matricula);
        resultados.sucesso++;
      } catch (err: any) {
        resultados.erros.push(`${m.cooperadoId}: ${err.message}`);
      }
    }

    resultados.parcial = resultados.erros.length > 0;

    // Recálculo final único
    await this.progressaoService.recalcularFaixa(convenioId, 'IMPORTACAO_MASSA');

    return resultados;
  }

  private async adicionarMembroSemRecalculo(convenioId: string, convenio: any, cooperadoId: string, matricula?: string) {
    const cooperado = await this.prisma.cooperado.findUnique({ where: { id: cooperadoId } });
    if (!cooperado) throw new NotFoundException('Cooperado não encontrado');
    if (cooperado.cooperativaId !== convenio.cooperativaId) {
      throw new BadRequestException('Cooperado não pertence a esta cooperativa');
    }

    const membroOutro = await this.prisma.convenioCooperado.findFirst({
      where: { cooperadoId, ativo: true, convenioId: { not: convenioId } },
    });
    if (membroOutro) throw new BadRequestException('Cooperado já é membro de outro convênio ativo');

    const existente = await this.prisma.convenioCooperado.findUnique({
      where: { convenioId_cooperadoId: { convenioId, cooperadoId } },
    });

    let membro;
    if (existente) {
      if (existente.ativo) return existente;
      membro = await this.prisma.convenioCooperado.update({
        where: { id: existente.id },
        data: { ativo: true, status: 'MEMBRO_ATIVO', matricula: matricula ?? existente.matricula, dataAdesao: new Date(), dataDesligamento: null },
      });
    } else {
      membro = await this.prisma.convenioCooperado.create({
        data: { convenioId, cooperadoId, matricula, ativo: true, status: 'MEMBRO_ATIVO', dataAdesao: new Date() },
      });
    }

    // Indicação sem recálculo
    if (convenio.registrarComoIndicacao && convenio.conveniadoId) {
      try {
        await this.registrarIndicacaoConvenio(convenio.conveniadoId, cooperadoId, convenio.cooperativaId, membro.id);
      } catch (err) {
        this.logger.warn(`Falha indicação import: ${err.message}`);
      }
    }

    return membro;
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async registrarIndicacaoConvenio(
    indicadorId: string,
    indicadoId: string,
    cooperativaId: string | null,
    membroId: string,
  ) {
    if (!cooperativaId) return;
    if (indicadorId === indicadoId) return;

    // Verificar se já existe indicação para este indicado
    const existente = await this.prisma.indicacao.findFirst({
      where: { cooperadoIndicadoId: indicadoId, nivel: 1 },
    });
    if (existente) return; // Já tem indicação, não duplicar

    const indicacao = await this.prisma.indicacao.create({
      data: {
        cooperativaId,
        cooperadoIndicadorId: indicadorId,
        cooperadoIndicadoId: indicadoId,
        nivel: 1,
        status: 'PENDENTE',
      },
    });

    // Vincular indicação ao membro
    await this.prisma.convenioCooperado.update({
      where: { id: membroId },
      data: { indicacaoId: indicacao.id },
    });

    this.logger.log(`Indicação registrada: ${indicadorId} → ${indicadoId} (convênio)`);
  }
}
