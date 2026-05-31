import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ContabilidadeTributariaService } from '../contabilidade-tributaria/contabilidade-tributaria.service';
import {
  Prisma,
  StatusRepasseProprietario,
  MetodoPagamentoRepasse,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacoesProativasService } from '../notificacoes-proativas/notificacoes-proativas.service';
import { MarcarRepassePagoDto } from './dto/marcar-repasse-pago.dto';
import { CancelarRepasseDto } from './dto/cancelar-repasse.dto';
import { ListarRepassesQueryDto } from './dto/listar-repasses-query.dto';
import { RepasseProprietarioDto } from './dto/repasse-proprietario.dto';

/**
 * D-novo-AN AN.1 (M42, 2026-05-30) — Service do módulo RepasseProprietario.
 *
 * Workflow:
 *   PENDENTE  ← criado pelo cron BH.5 (AN.2 vai integrar) ou criação manual SA
 *   PAGO      ← admin registra pagamento real (data + método + comprovante)
 *               TRANSAÇÃO ATÔMICA: também vincula despesas DESCONTO_NO_REPASSE
 *               do período via ContaAPagar.repasseAbatidoId + statusResolucao=RESOLVIDA.
 *   CANCELADO ← contestação, contrato encerrado, acerto fora do sistema.
 *
 * Race condition: status final só transiciona se atual === PENDENTE
 * (rejeita 409 ConflictException).
 *
 * Multi-tenant: SUPER_ADMIN cross-tenant; outros perfis precisam de
 * `cooperativaId` no JWT que bata com o repasse.
 */
@Injectable()
export class RepassesProprietarioService {
  private readonly logger = new Logger(RepassesProprietarioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacoes?: NotificacoesProativasService,
    @Optional() private readonly contabilidadeTributaria?: ContabilidadeTributariaService,
  ) {}

  // ─── Helper multi-tenant ───────────────────────────────────────────

  private assertSameTenantOrSuperAdmin(
    repasseCoopId: string,
    userCoopId: string | null | undefined,
    perfil: string | null | undefined,
  ): void {
    if ((perfil ?? '').toUpperCase() === 'SUPER_ADMIN') return;
    if (!userCoopId) {
      throw new BadRequestException('cooperativaId obrigatório no contexto do usuário.');
    }
    if (repasseCoopId !== userCoopId) {
      throw new ForbiddenException('Repasse de outra cooperativa.');
    }
  }

  private derivarAtrasado(
    status: StatusRepasseProprietario,
    periodoFim: Date,
  ): boolean {
    if (status !== StatusRepasseProprietario.PENDENTE) return false;
    const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return periodoFim < trintaDiasAtras;
  }

  private toDto(r: any): RepasseProprietarioDto {
    return {
      id: r.id,
      cooperativaId: r.cooperativaId,
      usinaId: r.usinaId,
      usinaNome: r.usina?.nome ?? undefined,
      proprietarioUsuarioId: r.proprietarioUsuarioId,
      proprietarioNome: r.proprietarioUsuario?.nome ?? null,
      periodoInicio: r.periodoInicio,
      periodoFim: r.periodoFim,
      valorBruto: Number(r.valorBruto),
      totalDespesasAbatidas: Number(r.totalDespesasAbatidas),
      valorLiquido: Number(r.valorLiquido),
      status: r.status,
      metodoPagamento: r.metodoPagamento,
      dataPagamento: r.dataPagamento,
      comprovante: r.comprovante,
      observacao: r.observacao,
      registradoPorUsuarioId: r.registradoPorUsuarioId,
      registradoPorNome: r.registradoPor?.nome ?? null,
      canceladoPorUsuarioId: r.canceladoPorUsuarioId,
      canceladoEm: r.canceladoEm,
      motivoCancelamento: r.motivoCancelamento,
      estornadoEm: r.estornadoEm ?? null,
      estornadoPorUsuarioId: r.estornadoPorUsuarioId ?? null,
      motivoEstorno: r.motivoEstorno ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      atrasado: this.derivarAtrasado(r.status, r.periodoFim),
    };
  }

  // ─── Mutations ─────────────────────────────────────────────────────

  /**
   * Cria RepasseProprietario PENDENTE. Idempotente: relança
   * ConflictException quando `(usinaId, periodoInicio, periodoFim)` já existe
   * (unique constraint do banco). Usado pelo cron BH.5 (AN.2 fará wireup).
   */
  async criarPendente(input: {
    cooperativaId: string;
    usinaId: string;
    proprietarioUsuarioId?: string | null;
    periodoInicio: Date;
    periodoFim: Date;
    valorBruto: number;
    valorLiquido: number;
    totalDespesasAbatidas: number;
  }): Promise<RepasseProprietarioDto> {
    try {
      const created = await this.prisma.repasseProprietario.create({
        data: {
          cooperativaId: input.cooperativaId,
          usinaId: input.usinaId,
          proprietarioUsuarioId: input.proprietarioUsuarioId ?? null,
          periodoInicio: input.periodoInicio,
          periodoFim: input.periodoFim,
          valorBruto: input.valorBruto,
          valorLiquido: input.valorLiquido,
          totalDespesasAbatidas: input.totalDespesasAbatidas,
          status: StatusRepasseProprietario.PENDENTE,
        },
        include: {
          usina: { select: { nome: true } },
          proprietarioUsuario: { select: { nome: true } },
        },
      });
      return this.toDto(created);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException(
          `Repasse já existe pra usina ${input.usinaId} no período ${input.periodoInicio.toISOString().slice(0, 10)} → ${input.periodoFim.toISOString().slice(0, 10)}.`,
        );
      }
      throw err;
    }
  }

  /**
   * Marca repasse PENDENTE como PAGO. Transação atômica:
   *   1. UPDATE repasse: status=PAGO + metodoPagamento + dataPagamento + comprovante + observacao + registradoPorUsuarioId
   *   2. UPDATE despesas DESCONTO_NO_REPASSE APROVADA + PENDENTE no período:
   *      statusResolucao=RESOLVIDA + resolvidoEm + repasseAbatidoId
   * Race guard: rejeita 409 se status atual !== PENDENTE.
   */
  async marcarPago(
    repasseId: string,
    dto: MarcarRepassePagoDto,
    usuarioId: string,
    userCoopId: string | null | undefined,
    perfil: string | null | undefined,
  ): Promise<RepasseProprietarioDto> {
    const atual = await this.prisma.repasseProprietario.findUnique({
      where: { id: repasseId },
      select: {
        id: true,
        cooperativaId: true,
        usinaId: true,
        periodoInicio: true,
        periodoFim: true,
        status: true,
      },
    });
    if (!atual) throw new NotFoundException('Repasse não encontrado.');
    this.assertSameTenantOrSuperAdmin(atual.cooperativaId, userCoopId, perfil);

    if (atual.status !== StatusRepasseProprietario.PENDENTE) {
      throw new ConflictException(
        `Repasse não está em PENDENTE (atual: ${atual.status}). Pode ter sido marcado por outro admin.`,
      );
    }

    // Validação cross-field: OUTRO exige observação.
    if (dto.metodoPagamento === MetodoPagamentoRepasse.OUTRO) {
      if (!dto.observacao || !dto.observacao.trim()) {
        throw new BadRequestException(
          'observacao é obrigatória quando metodoPagamento=OUTRO.',
        );
      }
    }

    const dataPagamento = new Date(dto.dataPagamento);
    if (dataPagamento > new Date()) {
      throw new BadRequestException('dataPagamento não pode ser no futuro.');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.repasseProprietario.update({
        where: { id: repasseId },
        data: {
          status: StatusRepasseProprietario.PAGO,
          metodoPagamento: dto.metodoPagamento,
          dataPagamento,
          comprovante: dto.comprovante ?? null,
          observacao: dto.observacao ?? null,
          registradoPorUsuarioId: usuarioId,
        },
        include: {
          usina: { select: { nome: true } },
          proprietarioUsuario: { select: { nome: true } },
          registradoPor: { select: { nome: true } },
        },
      }),
      this.prisma.contaAPagar.updateMany({
        where: {
          cooperativaId: atual.cooperativaId,
          usinaId: atual.usinaId,
          tratamento: 'DESCONTO_NO_REPASSE',
          statusAprovacao: 'APROVADA',
          statusResolucao: 'PENDENTE',
          dataOcorrencia: {
            gte: atual.periodoInicio,
            lte: atual.periodoFim,
          },
        },
        data: {
          statusResolucao: 'RESOLVIDA',
          resolvidoEm: new Date(),
          repasseAbatidoId: repasseId,
        },
      }),
    ]);

    // AN.4 (M42): notificação proativa fire-and-forget. Falha não bloqueia
    // o HTTP response — só loga. Whitelist LGPD ativa em DEV (regra 18/05).
    this.notificacoes
      ?.notificarRepassePago(repasseId)
      .catch((err) =>
        this.logger.error(`Notificacao repasse-pago falhou id=${repasseId}: ${err.message}`),
      );

    // CT.3 — Hook contábil classificado: ALUGUEL→NAO_COOPERATIVO, CESSAO/PROPRIA→PROPRIO.
    // Fire-and-forget, NUNCA reverte pagamento.
    if (this.contabilidadeTributaria) {
      this.contabilidadeTributaria
        .criarLancamentoRepasse(updated.id, atual.cooperativaId, atual.usinaId, updated.valorLiquido, dataPagamento)
        .catch((err) =>
          this.logger.error(`[CT.3 hook] repasse ${repasseId} classificação falhou: ${err.message}`),
        );
    }

    return this.toDto(updated);
  }

  /**
   * Cancela repasse PENDENTE. Race guard: só cancela PENDENTE; PAGO ou
   * CANCELADO rejeita 409. Não desvincula despesas (estavam PENDENTE — não
   * houve abatimento).
   */
  async cancelar(
    repasseId: string,
    dto: CancelarRepasseDto,
    usuarioId: string,
    userCoopId: string | null | undefined,
    perfil: string | null | undefined,
  ): Promise<RepasseProprietarioDto> {
    const atual = await this.prisma.repasseProprietario.findUnique({
      where: { id: repasseId },
      select: { id: true, cooperativaId: true, status: true },
    });
    if (!atual) throw new NotFoundException('Repasse não encontrado.');
    this.assertSameTenantOrSuperAdmin(atual.cooperativaId, userCoopId, perfil);

    if (atual.status !== StatusRepasseProprietario.PENDENTE) {
      throw new ConflictException(
        `Repasse não está em PENDENTE (atual: ${atual.status}). Cancelamento só permitido em PENDENTE.`,
      );
    }

    const updated = await this.prisma.repasseProprietario.update({
      where: { id: repasseId },
      data: {
        status: StatusRepasseProprietario.CANCELADO,
        canceladoEm: new Date(),
        canceladoPorUsuarioId: usuarioId,
        motivoCancelamento: dto.motivo,
      },
      include: {
        usina: { select: { nome: true } },
        proprietarioUsuario: { select: { nome: true } },
        registradoPor: { select: { nome: true } },
      },
    });
    return this.toDto(updated);
  }

  /**
   * D-novo-BR-CT estorno (31/05/2026 noite) — reverte repasse PAGO pra PENDENTE.
   *
   * Transação atômica:
   *  1. Repasse status → PENDENTE + limpa dataPagamento/metodoPagamento/comprovante
   *     + grava estornadoEm/Por/motivoEstorno
   *  2. Deleta LancamentoCaixa origemTipo=REPASSE origemId=repasseId
   *     (idempotência libera origemId; repagar recria lançamento)
   *  3. Desvincula despesas: repasseAbatidoId → null + statusResolucao → PENDENTE
   *     + resolvidoEm → null
   *
   * Bloqueio: se apuração do período (mês de dataPagamento) está FECHADA,
   * lança ConflictException — snapshot imutável. SA reabre via endpoint
   * /contabilidade-tributaria/apuracao/:id/reabrir antes.
   */
  async estornarRepasse(
    repasseId: string,
    motivo: string,
    usuarioId: string,
    userCoopId: string | null | undefined,
    perfil: string | null | undefined,
  ): Promise<RepasseProprietarioDto> {
    if (!motivo || motivo.trim().length < 10) {
      throw new BadRequestException(
        'Motivo obrigatório (mínimo 10 caracteres) — auditoria contábil exige rastreabilidade.',
      );
    }

    const atual = await this.prisma.repasseProprietario.findUnique({
      where: { id: repasseId },
      select: {
        id: true,
        cooperativaId: true,
        usinaId: true,
        status: true,
        dataPagamento: true,
      },
    });
    if (!atual) throw new NotFoundException('Repasse não encontrado.');
    this.assertSameTenantOrSuperAdmin(atual.cooperativaId, userCoopId, perfil);

    if (atual.status !== StatusRepasseProprietario.PAGO) {
      throw new ConflictException(
        `Estorno só permitido em status PAGO (atual: ${atual.status}).`,
      );
    }
    if (!atual.dataPagamento) {
      // Defesa em profundidade — status=PAGO sem dataPagamento é estado inválido.
      throw new ConflictException('Repasse PAGO sem dataPagamento — estado inconsistente.');
    }

    // Gate contábil: apuração do mês de dataPagamento não pode estar FECHADA.
    const ano = atual.dataPagamento.getFullYear();
    const mes = atual.dataPagamento.getMonth() + 1;
    const apur = await this.prisma.apuracaoMensalSegregada.findUnique({
      where: { cooperativaId_ano_mes: { cooperativaId: atual.cooperativaId, ano, mes } },
      select: { id: true, status: true },
    });
    if (apur && apur.status === 'FECHADA') {
      throw new ConflictException(
        `Apuração de ${String(mes).padStart(2, '0')}/${ano} fechada (id=${apur.id}). ` +
          `Reabra primeiro (Super Admin via /contabilidade-tributaria/apuracao/:id/reabrir) para estornar.`,
      );
    }

    const [updated] = await this.prisma.$transaction([
      // 1. Reverte repasse
      this.prisma.repasseProprietario.update({
        where: { id: repasseId },
        data: {
          status: StatusRepasseProprietario.PENDENTE,
          dataPagamento: null,
          metodoPagamento: null,
          comprovante: null,
          observacao: null,
          estornadoEm: new Date(),
          estornadoPorUsuarioId: usuarioId,
          motivoEstorno: motivo,
        },
        include: {
          usina: { select: { nome: true } },
          proprietarioUsuario: { select: { nome: true } },
          registradoPor: { select: { nome: true } },
        },
      }),
      // 2. Deleta lançamento contábil (libera origemId pra recriar se repagar)
      this.prisma.lancamentoCaixa.deleteMany({
        where: { origemTipo: 'REPASSE', origemId: repasseId },
      }),
      // 3. Desvincula despesas — voltam pra PENDENTE
      this.prisma.contaAPagar.updateMany({
        where: { repasseAbatidoId: repasseId },
        data: {
          repasseAbatidoId: null,
          statusResolucao: 'PENDENTE',
          resolvidoEm: null,
        },
      }),
    ]);

    this.logger.log(
      `[estorno] repasse ${repasseId} revertido por usuario=${usuarioId}. Motivo: ${motivo}`,
    );
    return this.toDto(updated);
  }

  /**
   * D-novo-BR-CT estorno (31/05/2026 noite) — visibilidade contábil do ciclo
   * do repasse: lançamento gerado + despesas abatidas.
   */
  async obterCicloRepasse(
    repasseId: string,
    userCoopId: string | null | undefined,
    perfil: string | null | undefined,
  ): Promise<{
    repasse: RepasseProprietarioDto;
    lancamentoGerado: {
      id: string;
      tipo: string;
      descricao: string;
      valor: number;
      naturezaAto: string;
      status: string;
      competencia: string;
      dataPagamento: Date | null;
    } | null;
    despesasAbatidas: Array<{
      id: string;
      descricao: string;
      categoria: string | null;
      valor: number;
      dataOcorrencia: Date | null;
    }>;
  }> {
    const r = await this.prisma.repasseProprietario.findUnique({
      where: { id: repasseId },
      include: {
        usina: { select: { nome: true } },
        proprietarioUsuario: { select: { nome: true } },
        registradoPor: { select: { nome: true } },
      },
    });
    if (!r) throw new NotFoundException('Repasse não encontrado.');
    this.assertSameTenantOrSuperAdmin(r.cooperativaId, userCoopId, perfil);

    const lanc = await this.prisma.lancamentoCaixa.findFirst({
      where: { origemTipo: 'REPASSE', origemId: repasseId },
      select: {
        id: true,
        tipo: true,
        descricao: true,
        valor: true,
        naturezaAto: true,
        status: true,
        competencia: true,
        dataPagamento: true,
      },
    });

    const despesasRaw = await this.prisma.contaAPagar.findMany({
      where: { repasseAbatidoId: repasseId },
      select: {
        id: true,
        descricao: true,
        categoria: true,
        valor: true,
        dataOcorrencia: true,
      },
      orderBy: { dataOcorrencia: 'asc' },
    });

    return {
      repasse: this.toDto(r),
      lancamentoGerado: lanc
        ? {
            id: lanc.id,
            tipo: lanc.tipo,
            descricao: lanc.descricao,
            valor: Number(lanc.valor),
            naturezaAto: lanc.naturezaAto,
            status: lanc.status,
            competencia: lanc.competencia,
            dataPagamento: lanc.dataPagamento,
          }
        : null,
      despesasAbatidas: despesasRaw.map((d) => ({
        id: d.id,
        descricao: d.descricao,
        categoria: d.categoria ? String(d.categoria) : null,
        valor: Number(d.valor),
        dataOcorrencia: d.dataOcorrencia,
      })),
    };
  }

  // ─── Queries ───────────────────────────────────────────────────────

  private parseOrdenacao(q: string | undefined): {
    field: 'periodoFim' | 'createdAt';
    dir: 'asc' | 'desc';
  } {
    if (!q) return { field: 'periodoFim', dir: 'desc' };
    const [field, dir] = q.split(':') as ['periodoFim' | 'createdAt', 'asc' | 'desc'];
    return { field, dir };
  }

  private filtroBase(
    filtros: ListarRepassesQueryDto,
  ): Prisma.RepasseProprietarioWhereInput {
    const w: Prisma.RepasseProprietarioWhereInput = {};
    if (filtros.status) w.status = filtros.status;
    if (filtros.usinaId) w.usinaId = filtros.usinaId;
    if (filtros.periodoInicio || filtros.periodoFim) {
      w.periodoFim = {};
      if (filtros.periodoInicio) (w.periodoFim as any).gte = new Date(filtros.periodoInicio);
      if (filtros.periodoFim) (w.periodoFim as any).lte = new Date(filtros.periodoFim);
    }
    return w;
  }

  /** Lista todos os repasses da cooperativa (admin parceiro: própria; SA: cross-tenant). */
  async listarGlobal(
    userCoopId: string | null | undefined,
    perfil: string | null | undefined,
    filtros: ListarRepassesQueryDto,
  ): Promise<RepasseProprietarioDto[]> {
    const isSA = (perfil ?? '').toUpperCase() === 'SUPER_ADMIN';
    const where: Prisma.RepasseProprietarioWhereInput = {
      ...this.filtroBase(filtros),
      ...(isSA ? {} : { cooperativaId: userCoopId ?? '__UNSET__' }),
    };
    const { field, dir } = this.parseOrdenacao(filtros.ordenacao);
    const rows = await this.prisma.repasseProprietario.findMany({
      where,
      include: {
        usina: { select: { nome: true } },
        proprietarioUsuario: { select: { nome: true } },
        registradoPor: { select: { nome: true } },
      },
      orderBy: { [field]: dir },
    });
    return rows.map((r) => this.toDto(r));
  }

  /** Lista repasses de uma usina específica. */
  async listarPorUsina(
    usinaId: string,
    userCoopId: string | null | undefined,
    perfil: string | null | undefined,
    filtros: ListarRepassesQueryDto,
  ): Promise<RepasseProprietarioDto[]> {
    return this.listarGlobal(userCoopId, perfil, { ...filtros, usinaId });
  }

  /**
   * Lista repasses visíveis pro proprietário logado (portal).
   * Resolve via Caminho A (proprietarioUsuarioId direto) OU Caminho B
   * (via Usina.proprietarioEmail/proprietarioCooperadoId — alinhado com
   * ProprietarioService.resolverUsinasDoProprietario).
   */
  async listarPorProprietario(
    user: { id?: string; userId?: string; email?: string | null; cooperadoId?: string | null },
    filtros: ListarRepassesQueryDto,
  ): Promise<RepasseProprietarioDto[]> {
    if (!user) throw new ForbiddenException('Usuário não autenticado.');

    const usuarioId = user.id ?? user.userId ?? null;

    // Resolve usinas via Caminho A/B (espelha proprietario.service)
    const orUsinas: any[] = [];
    if (user.cooperadoId) orUsinas.push({ proprietarioCooperadoId: user.cooperadoId });
    if (user.email) orUsinas.push({ proprietarioEmail: user.email });

    let usinasIds: string[] = [];
    if (orUsinas.length > 0) {
      const usinas = await this.prisma.usina.findMany({
        where: { OR: orUsinas },
        select: { id: true },
      });
      usinasIds = usinas.map((u) => u.id);
    }

    const where: Prisma.RepasseProprietarioWhereInput = {
      ...this.filtroBase(filtros),
      OR: [
        ...(usuarioId ? [{ proprietarioUsuarioId: usuarioId }] : []),
        ...(usinasIds.length > 0 ? [{ usinaId: { in: usinasIds } }] : []),
      ],
    };

    if (!where.OR || (where.OR as any[]).length === 0) {
      return [];
    }

    const { field, dir } = this.parseOrdenacao(filtros.ordenacao);
    const rows = await this.prisma.repasseProprietario.findMany({
      where,
      include: {
        usina: { select: { nome: true } },
        proprietarioUsuario: { select: { nome: true } },
        registradoPor: { select: { nome: true } },
      },
      orderBy: { [field]: dir },
    });
    return rows.map((r) => this.toDto(r));
  }

  /** Busca pontual (admin) com guard multi-tenant. */
  async findOne(
    repasseId: string,
    userCoopId: string | null | undefined,
    perfil: string | null | undefined,
  ): Promise<RepasseProprietarioDto> {
    const r = await this.prisma.repasseProprietario.findUnique({
      where: { id: repasseId },
      include: {
        usina: { select: { nome: true } },
        proprietarioUsuario: { select: { nome: true } },
        registradoPor: { select: { nome: true } },
      },
    });
    if (!r) throw new NotFoundException('Repasse não encontrado.');
    this.assertSameTenantOrSuperAdmin(r.cooperativaId, userCoopId, perfil);
    return this.toDto(r);
  }
}
