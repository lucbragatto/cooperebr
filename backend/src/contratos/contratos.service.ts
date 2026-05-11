import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service';
import { CooperadosService } from '../cooperados/cooperados.service';
import { UsinasService } from '../usinas/usinas.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { WhatsappCicloVidaService } from '../whatsapp/whatsapp-ciclo-vida.service';
import { calcularTarifaContratual, BaseCalculo } from '../motor-proposta/lib/calcular-tarifa-contratual';

const SERIALIZABLE_TX = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

@Injectable()
export class ContratosService {
  private readonly logger = new Logger(ContratosService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private cooperadosService: CooperadosService,
    private usinasService: UsinasService,
    private notificacoes: NotificacoesService,
    private whatsappCicloVida: WhatsappCicloVidaService,
  ) {}

  async findAll(cooperativaId?: string) {
    return this.prisma.contrato.findMany({
      where: cooperativaId ? { cooperativaId } : undefined,
      include: { cooperado: true, uc: true, usina: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, cooperativaId?: string) {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id },
      // Fase C.3: incluir plano pra UI calcular economia projetada via simular-plano.
      include: { cooperado: true, uc: true, usina: true, plano: true },
    });
    if (!contrato) throw new NotFoundException(`Contrato com id ${id} não encontrado`);
    if (cooperativaId && contrato.cooperativaId !== cooperativaId) {
      throw new NotFoundException(`Contrato com id ${id} não encontrado`);
    }
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

  /**
   * Sprint 5: bloqueia CREDITOS_COMPENSADOS e CREDITOS_DINAMICO.
   * Controlado por env var BLOQUEIO_MODELOS_NAO_FIXO (default: true).
   * Remover ao concluir Sprint 5.
   */
  private readonly MODELOS_BLOQUEADOS_SPRINT5 = ['CREDITOS_COMPENSADOS', 'CREDITOS_DINAMICO'];

  private isBloqueioAtivo(): boolean {
    return process.env.BLOQUEIO_MODELOS_NAO_FIXO !== 'false';
  }

  private async validarModeloNaoBloqueado(modeloOverride?: string | null, planoId?: string) {
    if (!this.isBloqueioAtivo()) return;

    // 1. Override explícito no contrato
    if (modeloOverride && this.MODELOS_BLOQUEADOS_SPRINT5.includes(modeloOverride)) {
      throw new BadRequestException(
        'Modelo em refatoração (Sprint 5). Disponível em breve. Use FIXO_MENSAL por enquanto.',
      );
    }
    // 2. Modelo herdado do plano
    if (planoId) {
      const plano = await this.prisma.plano.findUnique({
        where: { id: planoId },
        select: { modeloCobranca: true, nome: true },
      });
      if (plano && this.MODELOS_BLOQUEADOS_SPRINT5.includes(plano.modeloCobranca)) {
        throw new BadRequestException(
          `Plano "${plano.nome}" usa modelo "${plano.modeloCobranca}" — em refatoração (Sprint 5). Disponível em breve. Use um plano FIXO_MENSAL por enquanto.`,
        );
      }
    }
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
    // Sprint 5: bloquear criação em modelos COMPENSADOS/DINAMICO
    await this.validarModeloNaoBloqueado(data.modeloCobrancaOverride, data.planoId);

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

      // 1b. Validar regra ANEEL: mesma distribuidora UC x Usina
      if (data.usinaId) {
        await this.usinasService.validarCompatibilidadeAneel(data.ucId, data.usinaId);
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

      // BUG-CARRY-002: kwhContrato deve ser > 0
      if (!kwhContrato || kwhContrato <= 0) {
        throw new BadRequestException('kwhContrato deve ser maior que zero.');
      }

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

      // 6. Snapshots de tarifa (Fase B, Decisão B33). Best-effort: tenta usar
      // fatura processada mais recente do cooperado pra calcular. Se ausente
      // (cooperado novo sem OCR), deixa snapshot null e logga — engine de
      // cobrança detectará null na primeira cobrança e popula on-demand.
      let tarifaContratualSnap: number | null = null;
      let valorContratoSnap: number | null = null;
      let baseCalculoSnap: string | undefined;
      let tipoDescontoSnap: any | undefined;
      let valorCheioKwhAceiteSnap: number | null = null; // Fase B.5
      if (data.planoId) {
        const plano = await tx.plano.findUnique({
          where: { id: data.planoId },
          select: { modeloCobranca: true, baseCalculo: true, tipoDesconto: true },
        });
        const fatura = await tx.faturaProcessada.findFirst({
          where: {
            cooperadoId: data.cooperadoId,
            valorCheioKwh: { not: null },
            tarifaSemImpostos: { not: null },
          },
          orderBy: { createdAt: 'desc' },
          select: { valorCheioKwh: true, tarifaSemImpostos: true },
        });
        if (plano && fatura) {
          baseCalculoSnap = plano.baseCalculo;
          tipoDescontoSnap = plano.tipoDesconto;
          valorCheioKwhAceiteSnap = Number(fatura.valorCheioKwh); // Fase B.5
          try {
            tarifaContratualSnap = calcularTarifaContratual({
              valorCheioKwh: Number(fatura.valorCheioKwh),
              tarifaSemImpostos: Number(fatura.tarifaSemImpostos),
              baseCalculo: plano.baseCalculo as BaseCalculo,
              descontoPercentual: data.percentualDesconto,
            });
            if (plano.modeloCobranca === 'FIXO_MENSAL' && kwhContratoMensal) {
              valorContratoSnap = Math.round(tarifaContratualSnap * kwhContratoMensal * 100) / 100;
            }
          } catch (err) {
            this.logger.warn(
              `Snapshot tarifa não calculado em criação manual: ${(err as Error).message}`,
            );
          }
        } else {
          this.logger.log(
            `Contrato manual sem snapshot de tarifa — plano=${!!plano}, fatura=${!!fatura}. ` +
            `Será populado on-demand na primeira cobrança/fatura aprovada.`,
          );
        }
      }

      // 7. Criar contrato
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
          ...(tarifaContratualSnap !== null ? { tarifaContratual: tarifaContratualSnap } : {}),
          ...(valorContratoSnap !== null ? { valorContrato: valorContratoSnap } : {}),
          ...(baseCalculoSnap ? { baseCalculoAplicado: baseCalculoSnap } : {}),
          ...(tipoDescontoSnap ? { tipoDescontoAplicado: tipoDescontoSnap } : {}),
          ...(valorCheioKwhAceiteSnap !== null ? { valorCheioKwhAceite: valorCheioKwhAceiteSnap } : {}),
        } as any,
        include: { uc: true, usina: true, plano: true, cobrancas: true },
      });
    }, SERIALIZABLE_TX);

    // Side effect fora da transação
    await this.cooperadosService.checkProntoParaAtivar(data.cooperadoId);

    // Notificar cooperado que contrato foi gerado
    try {
      const cooperado = await this.prisma.cooperado.findUnique({
        where: { id: data.cooperadoId },
        select: { id: true, telefone: true, nomeCompleto: true, cooperativaId: true },
      });
      if (cooperado) {
        this.whatsappCicloVida.notificarContratoGerado(cooperado).catch(() => {});
      }
    } catch {}

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
    status: string;
    modeloCobrancaOverride: string | null;
  }>) {
    if (data.modeloCobrancaOverride !== undefined) {
      const modelos = ['FIXO_MENSAL', 'CREDITOS_COMPENSADOS', 'CREDITOS_DINAMICO'];
      if (data.modeloCobrancaOverride !== null && !modelos.includes(data.modeloCobrancaOverride)) {
        throw new BadRequestException(`Modelo de cobrança inválido. Valores aceitos: ${modelos.join(', ')} ou null`);
      }
      // Sprint 5: bloquear update para modelos COMPENSADOS/DINAMICO
      if (this.isBloqueioAtivo() && data.modeloCobrancaOverride && this.MODELOS_BLOQUEADOS_SPRINT5.includes(data.modeloCobrancaOverride)) {
        throw new BadRequestException(
          'Modelo em refatoração (Sprint 5). Disponível em breve. Use FIXO_MENSAL por enquanto.',
        );
      }
    }

    // Se recebeu kwhContratoAnual, calcular mensal automaticamente
    if (data.kwhContratoAnual !== undefined) {
      const mensal = Math.round((data.kwhContratoAnual / 12) * 100) / 100;
      (data as any).kwhContratoMensal = mensal;
      (data as any).kwhContrato = mensal;
    }

    // BUG-CARRY-002: kwhContrato deve ser > 0
    if (data.kwhContrato !== undefined && data.kwhContrato <= 0) {
      throw new BadRequestException('kwhContrato deve ser maior que zero.');
    }
    if (data.kwhContratoAnual !== undefined && data.kwhContratoAnual <= 0) {
      throw new BadRequestException('kwhContratoAnual deve ser maior que zero.');
    }

    // Validar regra ANEEL se mudou usinaId
    if (data.usinaId !== undefined) {
      const contratoAtualAneel = await this.prisma.contrato.findUnique({ where: { id }, select: { ucId: true } });
      const ucId = data.ucId ?? contratoAtualAneel?.ucId;
      if (ucId) {
        await this.usinasService.validarCompatibilidadeAneel(ucId, data.usinaId);
      }
    }

    // Se mudou capacidade ou usina, usar transação SERIALIZABLE para evitar race condition
    const alteraCapacidade = data.kwhContratoAnual !== undefined || data.kwhContrato !== undefined || data.usinaId !== undefined;
    if (alteraCapacidade) {
      return this.prisma.$transaction(async (tx) => {
        const contratoAtual = await tx.contrato.findUnique({ where: { id } });
        if (!contratoAtual) throw new NotFoundException(`Contrato com id ${id} não encontrado`);
        const usinaId = data.usinaId ?? contratoAtual.usinaId;
        const kwhContratoAnual = data.kwhContratoAnual
          ?? (data.kwhContrato ? data.kwhContrato * 12 : null)
          ?? (contratoAtual.kwhContratoAnual ? Number(contratoAtual.kwhContratoAnual) : Number(contratoAtual.kwhContrato ?? 0) * 12);

        if (usinaId && kwhContratoAnual > 0) {
          const percentualUsina = await this.validarCapacidadeUsina(usinaId, kwhContratoAnual, id, tx);
          (data as any).percentualUsina = percentualUsina;
        }

        return tx.contrato.update({ where: { id }, data: data as any });
      }, SERIALIZABLE_TX);
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

  async ativar(id: string, data: {
    protocoloConcessionaria: string;
    dataInicioCreditos: string;
    observacoes?: string;
  }) {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id },
      include: { cooperado: true },
    });
    if (!contrato) throw new NotFoundException(`Contrato com id ${id} não encontrado`);
    if (contrato.status !== 'PENDENTE_ATIVACAO') {
      throw new BadRequestException(`Contrato ${contrato.numero} não está com status PENDENTE_ATIVACAO (atual: ${contrato.status})`);
    }

    // Transação para garantir consistência entre contrato, cooperado e notificação
    const contratoAtualizado = await this.prisma.$transaction(async (tx) => {
      // 1. Atualizar contrato → ATIVO
      const updated = await tx.contrato.update({
        where: { id },
        data: { status: 'ATIVO' },
        include: { cooperado: true, uc: true, usina: true },
      });

      // 2. Atualizar cooperado → ATIVO_RECEBENDO_CREDITOS + dados da concessionária
      await tx.cooperado.update({
        where: { id: contrato.cooperadoId },
        data: {
          status: 'ATIVO_RECEBENDO_CREDITOS',
          protocoloConcessionaria: data.protocoloConcessionaria,
          dataInicioCreditos: new Date(data.dataInicioCreditos + 'T00:00:00.000Z'),
        },
      });

      // 2b. Sprint 8A: emitir evento pra liberar tokens pendentes
      this.eventEmitter.emit('cooperado.creditos.liberados', {
        cooperadoId: contrato.cooperadoId,
      });

      // 3. Notificar cooperado (dentro da tx para rollback se falhar)
      await tx.notificacao.create({
        data: {
          tipo: 'COOPERADO_ATIVADO',
          titulo: 'Créditos de energia ativos!',
          mensagem: 'Seus créditos de energia estão ativos! Você já está recebendo créditos da usina.',
          cooperadoId: contrato.cooperadoId,
          link: `/dashboard/cooperados/${contrato.cooperadoId}`,
        },
      });

      return updated;
    });

    // Notificar cooperado via WhatsApp que créditos iniciaram
    try {
      const cooperado = await this.prisma.cooperado.findUnique({
        where: { id: contrato.cooperadoId },
        select: { id: true, telefone: true, nomeCompleto: true, cooperativaId: true },
      });
      if (cooperado) {
        this.whatsappCicloVida.notificarCreditosIniciados(cooperado).catch(() => {});
      }
    } catch {}

    return contratoAtualizado;
  }
}
