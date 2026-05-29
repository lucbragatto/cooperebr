import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CategoriaContaAPagar,
  QuemPagouTipo,
  StatusContaAPagar,
  TratamentoDespesa,
} from '@prisma/client';
import { ProporDespesaDto } from './dto/propor-despesa.dto';
import { RejeitarDespesaDto } from './dto/rejeitar-despesa.dto';
import { ResolverDespesaDto } from './dto/resolver-despesa.dto';
import { NotificacoesProativasService } from '../notificacoes-proativas/notificacoes-proativas.service';

interface CreateContaAPagarDto {
  descricao: string;
  categoria: CategoriaContaAPagar;
  valor: number;
  dataVencimento: string;
  usinaId?: string;
  comprovante?: string;
}

interface UpdateContaAPagarDto {
  descricao?: string;
  categoria?: CategoriaContaAPagar;
  valor?: number;
  dataVencimento?: string;
  dataPagamento?: string;
  status?: StatusContaAPagar;
  usinaId?: string;
  comprovante?: string;
}

@Injectable()
export class ContasPagarService {
  private readonly logger = new Logger(ContasPagarService.name);

  constructor(
    private prisma: PrismaService,
    // Opcional pra preservar specs unitários sem mock — fire-and-forget guard com ?
    private readonly notificacoes?: NotificacoesProativasService,
  ) {}

  async findAll(cooperativaId: string, filtros?: { status?: string; categoria?: string }) {
    if (!cooperativaId) throw new BadRequestException('cooperativaId é obrigatório');
    return this.prisma.contaAPagar.findMany({
      where: {
        cooperativaId,
        ...(filtros?.status ? { status: filtros.status as StatusContaAPagar } : {}),
        ...(filtros?.categoria ? { categoria: filtros.categoria as CategoriaContaAPagar } : {}),
      },
      include: { usina: { select: { id: true, nome: true } } },
      orderBy: { dataVencimento: 'asc' },
    });
  }

  async findOne(id: string, cooperativaId: string) {
    if (!cooperativaId) throw new BadRequestException('cooperativaId é obrigatório');
    const conta = await this.prisma.contaAPagar.findFirst({
      where: { id, cooperativaId },
      include: { usina: { select: { id: true, nome: true } } },
    });
    if (!conta) throw new NotFoundException('Conta a pagar não encontrada');
    return conta;
  }

  async create(cooperativaId: string, dto: CreateContaAPagarDto) {
    if (!cooperativaId) throw new BadRequestException('cooperativaId é obrigatório');
    return this.prisma.contaAPagar.create({
      data: {
        cooperativaId,
        descricao: dto.descricao,
        categoria: dto.categoria,
        valor: dto.valor,
        dataVencimento: new Date(dto.dataVencimento),
        usinaId: dto.usinaId ?? null,
        comprovante: dto.comprovante ?? null,
      },
    });
  }

  async update(id: string, cooperativaId: string, dto: UpdateContaAPagarDto) {
    await this.findOne(id, cooperativaId);

    const data: Record<string, unknown> = {};
    if (dto.descricao !== undefined) data.descricao = dto.descricao;
    if (dto.categoria !== undefined) data.categoria = dto.categoria;
    if (dto.valor !== undefined) data.valor = dto.valor;
    if (dto.dataVencimento !== undefined) data.dataVencimento = new Date(dto.dataVencimento);
    if (dto.dataPagamento !== undefined) data.dataPagamento = new Date(dto.dataPagamento);
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.usinaId !== undefined) data.usinaId = dto.usinaId;
    if (dto.comprovante !== undefined) data.comprovante = dto.comprovante;

    return this.prisma.contaAPagar.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, cooperativaId: string) {
    await this.findOne(id, cooperativaId);
    return this.prisma.contaAPagar.delete({ where: { id } });
  }

  // ─── D-novo-BH (M37, 29/05/2026) — Workflow Despesas Operacionais Camada 2 ──
  //
  // PROPRIETARIO propõe (PROPOSTA) → ADMIN aprova/rejeita.
  // ADMIN pode lançar direto (APROVADA + aprovadoPor=self).
  // Resolução marca tratamento contratual concluído (REEMBOLSO pago, etc).
  // Multi-tenant em todas as queries.

  /**
   * Propõe ou lança despesa. Detecta role:
   *   PROPRIETARIO → cria PROPOSTA (admin precisa aprovar depois)
   *   ADMIN/SUPER_ADMIN/OPERADOR → cria APROVADA direto + aprovadoPor=self
   *
   * Pré-preenche responsavelPagamento a partir de Usina.responsabilidadeDespesas
   * (Camada 1 M30) usando o tipo do quemPagouTipo como hint quando categoria
   * já tem mapeamento definido. Caso a Camada 1 esteja vazia ou diferente,
   * cai pra null (admin pode override depois).
   */
  async proporDespesa(
    dto: ProporDespesaDto,
    usuarioId: string,
    usuarioPerfil: string,
    cooperativaId: string | null,
  ) {
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatório no contexto do usuário.');
    }

    // Multi-tenant + IDOR defense: usina precisa pertencer à cooperativa do usuário.
    const usina = await this.prisma.usina.findUnique({
      where: { id: dto.usinaId },
      select: {
        id: true,
        cooperativaId: true,
        responsabilidadeDespesas: true,
      },
    });
    if (!usina) throw new NotFoundException('Usina não encontrada.');
    if (usina.cooperativaId !== cooperativaId) {
      throw new ForbiddenException(
        'Usina pertence a outra cooperativa — você não tem permissão pra lançar despesa nela.',
      );
    }

    // Pré-preenche responsavelPagamento via Camada 1 (M30 matriz). Se a categoria
    // estiver mapeada (ex: { CUSD: 'PARCEIRO' }), respeita. Senão null.
    const matriz = (usina.responsabilidadeDespesas as Record<string, string>) ?? {};
    const responsavelMatriz = matriz[dto.categoria];
    const responsavelPagamento =
      responsavelMatriz === 'PARCEIRO' ||
      responsavelMatriz === 'PROPRIETARIO' ||
      responsavelMatriz === 'COMPARTILHADO'
        ? (responsavelMatriz as 'PARCEIRO' | 'PROPRIETARIO' | 'COMPARTILHADO')
        : null;

    const isAdmin =
      usuarioPerfil === 'ADMIN' ||
      usuarioPerfil === 'SUPER_ADMIN' ||
      usuarioPerfil === 'OPERADOR';

    const now = new Date();
    const data: any = {
      cooperativaId,
      usinaId: usina.id,
      descricao: dto.descricao,
      categoria: dto.categoria,
      valor: dto.valor,
      dataVencimento: new Date(dto.dataOcorrencia), // legacy field — usar mesma data
      dataOcorrencia: new Date(dto.dataOcorrencia),
      quemPagouTipo: dto.quemPagouTipo as QuemPagouTipo,
      quemPagouNome: dto.quemPagouNome ?? null,
      tratamento: dto.tratamento as TratamentoDespesa,
      comprovante: dto.comprovante ?? null,
      responsavelPagamento,
      statusAprovacao: isAdmin ? 'APROVADA' : 'PROPOSTA',
      statusResolucao: 'PENDENTE',
      propostoPorUsuarioId: usuarioId,
    };
    if (isAdmin) {
      data.aprovadoPorUsuarioId = usuarioId;
      data.aprovadoEm = now;
    }

    const criada = await this.prisma.contaAPagar.create({
      data,
      include: {
        usina: { select: { id: true, nome: true, apelidoInterno: true } },
        propostoPor: { select: { id: true, nome: true, perfil: true } },
        aprovadoPor: { select: { id: true, nome: true, perfil: true } },
      },
    });

    // D-novo-BH: dispara notificação async se foi PROPOSTA (admin precisa aprovar)
    if (criada.statusAprovacao === 'PROPOSTA') {
      this.notificacoes
        ?.notificarDespesaProposta(criada.id)
        .catch((err) =>
          this.logger.error(`Notificacao despesa-proposta falhou id=${criada.id}: ${err.message}`),
        );
    }

    return criada;
  }

  /**
   * Aprova despesa PROPOSTA. Race condition guard: checa statusAprovacao
   * atual === PROPOSTA antes de atualizar (2 admins clicando simultâneo
   * → 2º recebe ConflictException).
   */
  async aprovarDespesa(despesaId: string, usuarioId: string, cooperativaId: string | null) {
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatório.');
    }
    const despesa = await this.prisma.contaAPagar.findUnique({
      where: { id: despesaId },
      select: { id: true, cooperativaId: true, statusAprovacao: true },
    });
    if (!despesa) throw new NotFoundException('Despesa não encontrada.');
    if (despesa.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Despesa de outra cooperativa.');
    }
    if (despesa.statusAprovacao !== 'PROPOSTA') {
      throw new ConflictException(
        `Despesa não está em PROPOSTA (atual: ${despesa.statusAprovacao}). Pode ter sido aprovada/rejeitada por outro admin.`,
      );
    }

    const aprovada = await this.prisma.contaAPagar.update({
      where: { id: despesaId },
      data: {
        statusAprovacao: 'APROVADA',
        aprovadoPorUsuarioId: usuarioId,
        aprovadoEm: new Date(),
      },
      include: {
        usina: { select: { id: true, nome: true, apelidoInterno: true } },
        propostoPor: { select: { id: true, nome: true, perfil: true } },
        aprovadoPor: { select: { id: true, nome: true, perfil: true } },
      },
    });

    // D-novo-BH: notifica proprietário que propôs (se houver propostoPor)
    this.notificacoes
      ?.notificarDespesaAprovada(aprovada.id)
      .catch((err) =>
        this.logger.error(`Notificacao despesa-aprovada falhou id=${aprovada.id}: ${err.message}`),
      );

    return aprovada;
  }

  /**
   * Rejeita despesa PROPOSTA com motivo obrigatório.
   */
  async rejeitarDespesa(
    despesaId: string,
    dto: RejeitarDespesaDto,
    usuarioId: string,
    cooperativaId: string | null,
  ) {
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatório.');
    }
    const despesa = await this.prisma.contaAPagar.findUnique({
      where: { id: despesaId },
      select: { id: true, cooperativaId: true, statusAprovacao: true },
    });
    if (!despesa) throw new NotFoundException('Despesa não encontrada.');
    if (despesa.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Despesa de outra cooperativa.');
    }
    if (despesa.statusAprovacao !== 'PROPOSTA') {
      throw new ConflictException(
        `Despesa não está em PROPOSTA (atual: ${despesa.statusAprovacao}).`,
      );
    }

    const rejeitada = await this.prisma.contaAPagar.update({
      where: { id: despesaId },
      data: {
        statusAprovacao: 'REJEITADA',
        aprovadoPorUsuarioId: usuarioId,
        aprovadoEm: new Date(),
        rejeitadoMotivo: dto.motivo,
      },
    });

    // D-novo-BH: notifica proprietário que propôs (se houver)
    this.notificacoes
      ?.notificarDespesaRejeitada(rejeitada.id)
      .catch((err) =>
        this.logger.error(`Notificacao despesa-rejeitada falhou id=${rejeitada.id}: ${err.message}`),
      );

    return rejeitada;
  }

  /**
   * Marca tratamento contratual como concluído (REEMBOLSO pago,
   * DESCONTO_NO_REPASSE aplicado, ou ASSUMIDO confirmado).
   * Só faz sentido pra despesa APROVADA + PENDENTE de resolução.
   */
  async resolverDespesa(
    despesaId: string,
    dto: ResolverDespesaDto,
    cooperativaId: string | null,
  ) {
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatório.');
    }
    const despesa = await this.prisma.contaAPagar.findUnique({
      where: { id: despesaId },
      select: {
        id: true,
        cooperativaId: true,
        statusAprovacao: true,
        statusResolucao: true,
      },
    });
    if (!despesa) throw new NotFoundException('Despesa não encontrada.');
    if (despesa.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Despesa de outra cooperativa.');
    }
    if (despesa.statusAprovacao !== 'APROVADA') {
      throw new BadRequestException(
        `Só despesas APROVADAS podem ser resolvidas (atual: ${despesa.statusAprovacao}).`,
      );
    }
    if (despesa.statusResolucao === 'RESOLVIDA') {
      throw new ConflictException('Despesa já está RESOLVIDA.');
    }

    return this.prisma.contaAPagar.update({
      where: { id: despesaId },
      data: {
        statusResolucao: 'RESOLVIDA',
        resolvidoEm: new Date(),
        ...(dto.observacao ? { rejeitadoMotivo: undefined } : {}), // não usa rejeitadoMotivo aqui
      },
    });
  }

  /**
   * Lista despesas operacionais filtradas pra admin/super_admin.
   * Multi-tenant obrigatório.
   */
  async listarDespesasOperacionais(
    cooperativaId: string | null,
    filtros?: {
      usinaId?: string;
      statusAprovacao?: 'PROPOSTA' | 'APROVADA' | 'REJEITADA';
      statusResolucao?: 'PENDENTE' | 'RESOLVIDA';
      tratamento?: 'REEMBOLSO' | 'DESCONTO_NO_REPASSE' | 'ASSUMIDO';
      categoria?: string;
      dataOcorrenciaInicio?: Date;
      dataOcorrenciaFim?: Date;
    },
  ) {
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId obrigatório.');
    }
    const where: any = { cooperativaId };
    if (filtros?.usinaId) where.usinaId = filtros.usinaId;
    if (filtros?.statusAprovacao) where.statusAprovacao = filtros.statusAprovacao;
    if (filtros?.statusResolucao) where.statusResolucao = filtros.statusResolucao;
    if (filtros?.tratamento) where.tratamento = filtros.tratamento;
    if (filtros?.categoria) where.categoria = filtros.categoria;
    if (filtros?.dataOcorrenciaInicio || filtros?.dataOcorrenciaFim) {
      where.dataOcorrencia = {};
      if (filtros.dataOcorrenciaInicio) where.dataOcorrencia.gte = filtros.dataOcorrenciaInicio;
      if (filtros.dataOcorrenciaFim) where.dataOcorrencia.lte = filtros.dataOcorrenciaFim;
    }

    return this.prisma.contaAPagar.findMany({
      where,
      include: {
        usina: { select: { id: true, nome: true, apelidoInterno: true } },
        propostoPor: { select: { id: true, nome: true, perfil: true } },
        aprovadoPor: { select: { id: true, nome: true, perfil: true } },
      },
      orderBy: [{ dataOcorrencia: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Lista despesas visíveis pra proprietário logado.
   *
   * Resolve usinas via Usina.proprietarioEmail = usuario.email (Caminho B)
   * ou via proprietarioCooperadoId (Caminho A). Filtra despesas:
   *   - APROVADAS (admin pode lançar direto ou ter aprovado proposta)
   *   - PROPOSTAS próprias (transparência do que ele mesmo propôs)
   * REJEITADAS de terceiros ficam ocultas. REJEITADAS próprias aparecem
   * pra ele entender o feedback do admin.
   */
  async listarDespesasProprietario(
    usuarioId: string,
    usuarioEmail: string | null,
    cooperadoId: string | null,
    cooperativaId?: string | null,
  ) {
    // D-novo-BH: respeita flag Cooperativa.proprietarioVeDespesas.
    // Quando false, módulo restrito ao admin — retornar [] (UX limpa).
    if (cooperativaId) {
      const coop = await this.prisma.cooperativa.findUnique({
        where: { id: cooperativaId },
        select: { proprietarioVeDespesas: true },
      });
      if (coop && coop.proprietarioVeDespesas === false) return [];
    }

    const orWhere: any[] = [];
    if (cooperadoId) orWhere.push({ proprietarioCooperadoId: cooperadoId });
    if (usuarioEmail) orWhere.push({ proprietarioEmail: usuarioEmail });
    if (orWhere.length === 0) return [];

    const usinas = await this.prisma.usina.findMany({
      where: { OR: orWhere },
      select: { id: true },
    });
    if (usinas.length === 0) return [];
    const usinaIds = usinas.map((u) => u.id);

    return this.prisma.contaAPagar.findMany({
      where: {
        usinaId: { in: usinaIds },
        OR: [
          { statusAprovacao: 'APROVADA' },
          { propostoPorUsuarioId: usuarioId }, // suas próprias propostas + rejeições
        ],
      },
      include: {
        usina: { select: { id: true, nome: true, apelidoInterno: true } },
        propostoPor: { select: { id: true, nome: true } },
        aprovadoPor: { select: { id: true, nome: true } },
      },
      orderBy: [{ dataOcorrencia: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
