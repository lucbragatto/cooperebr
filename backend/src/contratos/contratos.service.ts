import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CooperadosService } from '../cooperados/cooperados.service';

@Injectable()
export class ContratosService {
  constructor(
    private prisma: PrismaService,
    private cooperadosService: CooperadosService,
  ) {}

  async findAll() {
    return this.prisma.contrato.findMany({
      include: { cooperado: true, uc: true, usina: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id },
      include: { cooperado: true, uc: true, usina: true },
    });
    if (!contrato) throw new NotFoundException(`Contrato com id ${id} não encontrado`);
    return contrato;
  }

  async findByCooperado(cooperadoId: string) {
    return this.prisma.contrato.findMany({
      where: { cooperadoId },
      include: { uc: true, usina: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Valida se a usina tem capacidade suficiente e retorna o percentual calculado.
   * kwhContratoAnual = total anual do contrato.
   * capacidadeKwh da usina = capacidade anual.
   * percentualUsina = kwhContratoAnual / capacidadeKwh × 100
   */
  private async validarCapacidadeUsina(
    usinaId: string,
    kwhContratoAnual: number,
    excludeContratoId?: string,
    tx?: any,
  ): Promise<number> {
    const db = tx ?? this.prisma;
    const usina = await db.usina.findUnique({ where: { id: usinaId } });
    if (!usina || !usina.capacidadeKwh || Number(usina.capacidadeKwh) <= 0) {
      return 0; // sem capacidade definida — não bloqueia
    }

    const capacidadeAnual = Number(usina.capacidadeKwh);
    const contratosAtivos = await db.contrato.findMany({
      where: {
        usinaId,
        status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
        ...(excludeContratoId ? { id: { not: excludeContratoId } } : {}),
      },
      select: { percentualUsina: true, kwhContratoAnual: true, kwhContrato: true },
    });

    const somaPercentual = contratosAtivos.reduce(
      (acc: number, c: any) => {
        if (c.percentualUsina) return acc + Number(c.percentualUsina);
        // Fallback: usa kwhContratoAnual ou kwhContrato×12
        const anual = c.kwhContratoAnual ? Number(c.kwhContratoAnual) : Number(c.kwhContrato ?? 0) * 12;
        return acc + (anual / capacidadeAnual) * 100;
      },
      0,
    );

    const novoPercentual = (kwhContratoAnual / capacidadeAnual) * 100;
    const disponivel = Math.round((100 - somaPercentual) * 10000) / 10000;
    const solicitado = Math.round(novoPercentual * 10000) / 10000;

    if (somaPercentual + novoPercentual > 100.0001) {
      throw new BadRequestException(
        `Capacidade da usina insuficiente. Disponível: ${disponivel}%, Solicitado: ${solicitado}%`,
      );
    }

    return Math.round(novoPercentual * 10000) / 10000;
  }

  async gerarNumeroContrato(tx?: any): Promise<string> {
    const db = tx ?? this.prisma;
    const ano = new Date().getFullYear();
    const ultimo = await db.contrato.findFirst({
      where: { numero: { startsWith: `CTR-${ano}-` } },
      orderBy: { createdAt: 'desc' },
    });
    const seq = ultimo
      ? parseInt(ultimo.numero.split('-')[2] ?? '0', 10) + 1
      : 1;
    return `CTR-${ano}-${String(seq).padStart(4, '0')}`;
  }

  async create(data: {
    cooperadoId: string;
    ucId: string;
    usinaId?: string;
    planoId?: string;
    dataInicio: Date | string;
    dataFim?: Date | string;
    percentualDesconto: number;
    kwhContratoAnual?: number;
    kwhContrato?: number;
    modeloCobrancaOverride?: string | null;
  }) {
    const contrato = await this.prisma.$transaction(async (tx) => {
      // 1. Validar: não permitir contrato ativo/lista_espera para mesma UC
      const contratoExistente = await tx.contrato.findFirst({
        where: {
          ucId: data.ucId,
          status: { in: ['PENDENTE_ATIVACAO', 'ATIVO', 'LISTA_ESPERA'] },
        },
      });
      if (contratoExistente) {
        throw new BadRequestException(
          `Já existe contrato ${contratoExistente.status === 'ATIVO' ? 'ativo' : 'em lista de espera'} (${contratoExistente.numero}) para esta unidade consumidora.`,
        );
      }

      // 2. Calcular kWh mensal a partir do anual (ou vice-versa para compatibilidade)
      let kwhContratoAnual = data.kwhContratoAnual;
      let kwhContratoMensal: number | undefined;

      if (kwhContratoAnual) {
        kwhContratoMensal = Math.round((kwhContratoAnual / 12) * 100) / 100;
      } else if (data.kwhContrato) {
        // Compatibilidade: se recebeu kwhContrato (mensal), calcula o anual
        kwhContratoMensal = data.kwhContrato;
        kwhContratoAnual = data.kwhContrato * 12;
      }

      // kwhContrato = mensal (usado nas cobranças)
      const kwhContrato = kwhContratoMensal ?? data.kwhContrato;

      // 3. Validar capacidade da usina e calcular percentualUsina com base no ANUAL
      let percentualUsina: number | undefined;
      if (data.usinaId && kwhContratoAnual) {
        percentualUsina = await this.validarCapacidadeUsina(data.usinaId, kwhContratoAnual, undefined, tx);
      }

      // 4. Gerar número do contrato (dentro da tx para evitar duplicação)
      const numero = await this.gerarNumeroContrato(tx);

      // 5. Preparar datas — dataFim = dataInicio + 12 meses (auto-calculado se não informado)
      const dataInicio = typeof data.dataInicio === 'string'
        ? new Date(data.dataInicio + 'T00:00:00.000Z')
        : data.dataInicio;
      let dataFim: Date | undefined;
      if (data.dataFim) {
        dataFim = typeof data.dataFim === 'string' ? new Date(data.dataFim + 'T00:00:00.000Z') : data.dataFim;
      } else {
        // Auto-calcular: dataInicio + 12 meses
        dataFim = new Date(dataInicio);
        dataFim.setMonth(dataFim.getMonth() + 12);
      }

      // 6. Criar contrato
      const { kwhContratoAnual: _a, kwhContrato: _b, ...rest } = data;
      return tx.contrato.create({
        data: {
          ...rest,
          numero,
          dataInicio,
          dataFim,
          kwhContrato,
          kwhContratoAnual,
          kwhContratoMensal,
          percentualUsina,
        } as any,
        include: { uc: true, usina: true, plano: true, cobrancas: true },
      });
    });

    // Side effect fora da transação
    await this.cooperadosService.checkProntoParaAtivar(data.cooperadoId);

    return contrato;
  }

  async update(id: string, data: Partial<{
    ucId: string;
    usinaId: string;
    planoId: string;
    dataInicio: Date;
    dataFim: Date;
    percentualDesconto: number;
    kwhContratoAnual: number;
    kwhContrato: number;
    status: 'ATIVO' | 'SUSPENSO' | 'ENCERRADO' | 'LISTA_ESPERA';
    modeloCobrancaOverride: string | null;
  }>) {
    if (data.modeloCobrancaOverride !== undefined) {
      const modelos = ['FIXO_MENSAL', 'CREDITOS_COMPENSADOS', 'CREDITOS_DINAMICO'];
      if (data.modeloCobrancaOverride !== null && !modelos.includes(data.modeloCobrancaOverride)) {
        throw new BadRequestException(`Modelo de cobrança inválido. Valores aceitos: ${modelos.join(', ')} ou null`);
      }
    }

    // Se recebeu kwhContratoAnual, calcular mensal automaticamente
    if (data.kwhContratoAnual !== undefined) {
      const mensal = Math.round((data.kwhContratoAnual / 12) * 100) / 100;
      (data as any).kwhContratoMensal = mensal;
      (data as any).kwhContrato = mensal;
    }

    // Se mudou kwhContratoAnual ou usinaId, recalcular percentualUsina
    if (data.kwhContratoAnual !== undefined || data.kwhContrato !== undefined || data.usinaId !== undefined) {
      const contratoAtual = await this.prisma.contrato.findUnique({ where: { id } });
      const usinaId = data.usinaId ?? contratoAtual?.usinaId;
      const kwhContratoAnual = data.kwhContratoAnual
        ?? (data.kwhContrato ? data.kwhContrato * 12 : null)
        ?? (contratoAtual?.kwhContratoAnual ? Number(contratoAtual.kwhContratoAnual) : Number(contratoAtual?.kwhContrato ?? 0) * 12);

      if (usinaId && kwhContratoAnual > 0) {
        const percentualUsina = await this.validarCapacidadeUsina(usinaId, kwhContratoAnual, id);
        (data as any).percentualUsina = percentualUsina;
      }
    }

    return this.prisma.contrato.update({ where: { id }, data: data as any });
  }

  async remove(id: string) {
    const cobrancas = await this.prisma.cobranca.count({ where: { contratoId: id } });
    if (cobrancas > 0) {
      throw new BadRequestException(
        `Não é possível excluir este contrato: existem ${cobrancas} cobrança(s) vinculada(s). Encerre o contrato ou exclua as cobranças primeiro.`,
      );
    }
    return this.prisma.contrato.delete({ where: { id } });
  }
}
