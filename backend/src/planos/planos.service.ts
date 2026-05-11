import { Injectable, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePlanoDto } from './dto/create-plano.dto';
import { UpdatePlanoDto } from './dto/update-plano.dto';
import { ModeloCobranca, TipoCampanha, Prisma } from '@prisma/client';
import { PerfilUsuario } from '../auth/perfil.enum';
import { gerarWarningsPlano } from './lib/warnings-plano';

interface ReqUserLike {
  perfil: PerfilUsuario | string;
  cooperativaId?: string | null;
}

@Injectable()
export class PlanosService implements OnModuleInit {
  private readonly logger = new Logger(PlanosService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.plano.count();
    if (count === 0) {
      // Seed: FIXO_MENSAL pois é o único modelo ativo em produção até
      // Sprint C1+C2 destravar COMPENSADOS+DINAMICO. Plano global (sem cooperativaId).
      await this.prisma.plano.create({
        data: {
          nome: 'Plano Básico',
          descricao: 'Plano padrão com 20% de desconto na conta de energia',
          modeloCobranca: ModeloCobranca.FIXO_MENSAL,
          descontoBase: 20,
          publico: true,
          ativo: true,
          tipoCampanha: TipoCampanha.PADRAO,
        },
      });
      this.logger.log('Plano padrão "Plano Básico" (FIXO_MENSAL) criado automaticamente');
    }
  }

  /**
   * Lista planos respeitando multi-tenant (Fase A — 03/05/2026).
   *
   * - SUPER_ADMIN: vê todos os planos (cross-tenant intencional)
   * - ADMIN/OPERADOR: vê próprios + globais (cooperativaId=null)
   * - Sem reqUser: vitrine pública — apenas globais ativos e públicos
   */
  findAll(reqUser?: ReqUserLike) {
    // Fase C.2 — Item 4: contagem de contratos vivos por plano pra lista enriquecida.
    // ADMIN/OPERADOR vê só contratos do próprio tenant (não vaza cross-tenant).
    // SUPER_ADMIN vê total agregado entre tenants.
    const incluirContagem: Prisma.PlanoInclude = {
      _count: {
        select: {
          contratos: {
            where: {
              status: { in: ['ATIVO' as const, 'PENDENTE_ATIVACAO' as const] as any },
              ...(reqUser?.perfil !== PerfilUsuario.SUPER_ADMIN && reqUser?.cooperativaId
                ? { cooperativaId: reqUser.cooperativaId }
                : {}),
            },
          },
        },
      },
    };

    if (reqUser?.perfil === PerfilUsuario.SUPER_ADMIN) {
      return this.prisma.plano.findMany({
        include: incluirContagem,
        orderBy: { createdAt: 'desc' },
      });
    }
    if (reqUser?.cooperativaId) {
      return this.prisma.plano.findMany({
        where: {
          OR: [
            { cooperativaId: reqUser.cooperativaId },
            { cooperativaId: null },
          ],
        },
        include: incluirContagem,
        orderBy: { createdAt: 'desc' },
      });
    }
    // Sem reqUser ou ADMIN sem cooperativaId vinculada: vitrine pública (sem contagem).
    return this.prisma.plano.findMany({
      where: { cooperativaId: null, publico: true, ativo: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findAtivos(cooperativaId?: string, publico?: boolean) {
    const hoje = new Date();
    const andFilters: Prisma.PlanoWhereInput[] = [
      {
        OR: [
          { dataFimVigencia: null },
          { dataFimVigencia: { gte: hoje } },
        ],
      },
    ];
    // Multi-tenant: tenant próprio + planos globais (cooperativaId=null). Nunca cross-tenant.
    if (cooperativaId) {
      andFilters.push({
        OR: [
          { cooperativaId },
          { cooperativaId: null },
        ],
      });
    }
    // Sprint 5: esconder planos COMPENSADOS/DINAMICO da listagem pública enquanto bloqueio ativo.
    // Controlado por env var BLOQUEIO_MODELOS_NAO_FIXO (default: true). Remover ao concluir Sprint 5.
    if (publico && process.env.BLOQUEIO_MODELOS_NAO_FIXO !== 'false') {
      andFilters.push({
        modeloCobranca: { notIn: [ModeloCobranca.CREDITOS_COMPENSADOS, ModeloCobranca.CREDITOS_DINAMICO] },
      });
    }
    return this.prisma.plano.findMany({
      where: {
        ativo: true,
        ...(publico === true && { publico: true }),
        AND: andFilters,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Busca plano por ID com cross-tenant guard.
   * - SUPER_ADMIN: sempre permitido
   * - ADMIN/OPERADOR: permitido se plano é do próprio tenant ou global
   * - Sem reqUser: permitido apenas se plano é global, ativo e público
   */
  async findOne(id: string, reqUser?: ReqUserLike) {
    // Fase C.2 — Item 5: inclui _count.contratos pra UI mostrar confirmação
    // antes de salvar mudança crítica em plano JÁ em uso.
    const incluirContagem: Prisma.PlanoInclude | undefined = reqUser
      ? {
          _count: {
            select: {
              contratos: {
                where: {
                  status: { in: ['ATIVO' as const, 'PENDENTE_ATIVACAO' as const] as any },
                  ...(reqUser.perfil !== PerfilUsuario.SUPER_ADMIN && reqUser.cooperativaId
                    ? { cooperativaId: reqUser.cooperativaId }
                    : {}),
                },
              },
            },
          },
        }
      : undefined;

    const plano = await this.prisma.plano.findUnique({
      where: { id },
      ...(incluirContagem ? { include: incluirContagem } : {}),
    });
    if (!plano) throw new NotFoundException(`Plano ${id} não encontrado`);

    if (reqUser?.perfil === PerfilUsuario.SUPER_ADMIN) {
      return plano;
    }
    if (reqUser?.cooperativaId) {
      // Permite próprio tenant ou plano global
      if (plano.cooperativaId !== null && plano.cooperativaId !== reqUser.cooperativaId) {
        throw new ForbiddenException('Plano não pertence a esta cooperativa');
      }
      return plano;
    }
    // Sem reqUser (vitrine pública): só plano global ativo e público
    if (plano.cooperativaId !== null || !plano.ativo || !plano.publico) {
      throw new ForbiddenException('Plano não disponível publicamente');
    }
    return plano;
  }

  /**
   * Cria plano respeitando multi-tenant.
   * - SUPER_ADMIN: pode criar global (dto.cooperativaId=null) ou pra qualquer tenant
   * - ADMIN: cooperativaId é forçado pra própria cooperativa, ignorando dto
   */
  async create(dto: CreatePlanoDto, reqUser: ReqUserLike) {
    // V4: warnings não-bloqueantes pra combinações estranhas (Decisão B33).
    const warnings = gerarWarningsPlano({
      modeloCobranca: dto.modeloCobranca,
      baseCalculo: dto.baseCalculo,
      tipoDesconto: dto.tipoDesconto,
      referenciaValor: dto.referenciaValor,
      temPromocao: dto.temPromocao,
      descontoBase: dto.descontoBase,
      descontoPromocional: dto.descontoPromocional,
    });
    warnings.forEach((w) => this.logger.warn(`[create plano "${dto.nome}"] ${w}`));

    let cooperativaId: string | null;
    if (reqUser.perfil === PerfilUsuario.SUPER_ADMIN) {
      // SUPER_ADMIN escolhe escopo livremente. cooperativaId vazio/null = global.
      cooperativaId = dto.cooperativaId ?? null;
    } else {
      // ADMIN: força próprio tenant. Ignora qualquer cooperativaId enviado no body.
      if (!reqUser.cooperativaId) {
        throw new ForbiddenException('Usuário ADMIN sem cooperativa vinculada');
      }
      cooperativaId = reqUser.cooperativaId;
    }
    return this.prisma.plano.create({
      data: {
        nome: dto.nome,
        descricao: dto.descricao,
        modeloCobranca: dto.modeloCobranca as ModeloCobranca,
        descontoBase: dto.descontoBase,
        temPromocao: dto.temPromocao ?? false,
        descontoPromocional: dto.descontoPromocional ?? null,
        mesesPromocao: dto.mesesPromocao ?? null,
        tipoDesconto: dto.tipoDesconto ?? 'APLICAR_SOBRE_BASE',
        publico: dto.publico ?? true,
        ativo: dto.ativo ?? true,
        tipoCampanha: (dto.tipoCampanha as TipoCampanha) ?? TipoCampanha.PADRAO,
        dataInicioVigencia: dto.dataInicioVigencia ? new Date(dto.dataInicioVigencia) : null,
        dataFimVigencia: dto.dataFimVigencia ? new Date(dto.dataFimVigencia) : null,
        baseCalculo: dto.baseCalculo ?? 'KWH_CHEIO',
        componentesCustom: dto.componentesCustom ?? [],
        referenciaValor: dto.referenciaValor ?? 'MEDIA_3M',
        fatorIncremento: dto.fatorIncremento ?? null,
        mostrarDiscriminado: dto.mostrarDiscriminado ?? true,
        cooperativaId,
        // CooperToken
        cooperTokenAtivo: dto.cooperTokenAtivo ?? false,
        tokenOpcaoCooperado: dto.tokenOpcaoCooperado ?? 'AMBAS',
        tokenValorTipo: dto.tokenValorTipo ?? 'KWH_APURADO',
        tokenValorFixo: dto.tokenValorFixo ?? null,
        tokenDescontoMaxPerc: dto.tokenDescontoMaxPerc ?? null,
        tokenExpiracaoMeses: dto.tokenExpiracaoMeses ?? null,
      },
    });
  }

  /**
   * Atualiza plano respeitando multi-tenant.
   * - SUPER_ADMIN: pode tudo, inclusive mudar cooperativaId
   * - ADMIN: bloqueado de mexer em plano de outro tenant ou de mudar cooperativaId
   */
  async update(id: string, dto: UpdatePlanoDto, reqUser: ReqUserLike) {
    const plano = await this.findOne(id, reqUser); // valida cross-tenant

    // ADMIN não pode alterar cooperativaId — apenas SUPER_ADMIN.
    if (reqUser.perfil !== PerfilUsuario.SUPER_ADMIN && dto.cooperativaId !== undefined) {
      const ehMudanca = dto.cooperativaId !== plano.cooperativaId;
      if (ehMudanca) {
        throw new ForbiddenException('Apenas SUPER_ADMIN pode alterar o escopo (cooperativaId) de um plano');
      }
    }

    return this.prisma.plano.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined && { nome: dto.nome }),
        ...(dto.descricao !== undefined && { descricao: dto.descricao }),
        ...(dto.modeloCobranca !== undefined && { modeloCobranca: dto.modeloCobranca as ModeloCobranca }),
        ...(dto.descontoBase !== undefined && { descontoBase: dto.descontoBase }),
        ...(dto.temPromocao !== undefined && { temPromocao: dto.temPromocao }),
        ...(dto.descontoPromocional !== undefined && { descontoPromocional: dto.descontoPromocional }),
        ...(dto.mesesPromocao !== undefined && { mesesPromocao: dto.mesesPromocao }),
        ...(dto.tipoDesconto !== undefined && { tipoDesconto: dto.tipoDesconto }),
        ...(dto.publico !== undefined && { publico: dto.publico }),
        ...(dto.ativo !== undefined && { ativo: dto.ativo }),
        ...(dto.tipoCampanha !== undefined && { tipoCampanha: dto.tipoCampanha as TipoCampanha }),
        ...(dto.dataInicioVigencia !== undefined && { dataInicioVigencia: dto.dataInicioVigencia ? new Date(dto.dataInicioVigencia) : null }),
        ...(dto.dataFimVigencia !== undefined && { dataFimVigencia: dto.dataFimVigencia ? new Date(dto.dataFimVigencia) : null }),
        ...(dto.baseCalculo !== undefined && { baseCalculo: dto.baseCalculo }),
        ...(dto.componentesCustom !== undefined && { componentesCustom: dto.componentesCustom }),
        ...(dto.referenciaValor !== undefined && { referenciaValor: dto.referenciaValor }),
        ...(dto.fatorIncremento !== undefined && { fatorIncremento: dto.fatorIncremento }),
        ...(dto.mostrarDiscriminado !== undefined && { mostrarDiscriminado: dto.mostrarDiscriminado }),
        ...(reqUser.perfil === PerfilUsuario.SUPER_ADMIN && dto.cooperativaId !== undefined && { cooperativaId: dto.cooperativaId }),
        // CooperToken
        ...(dto.cooperTokenAtivo !== undefined && { cooperTokenAtivo: dto.cooperTokenAtivo }),
        ...(dto.tokenOpcaoCooperado !== undefined && { tokenOpcaoCooperado: dto.tokenOpcaoCooperado }),
        ...(dto.tokenValorTipo !== undefined && { tokenValorTipo: dto.tokenValorTipo }),
        ...(dto.tokenValorFixo !== undefined && { tokenValorFixo: dto.tokenValorFixo }),
        ...(dto.tokenDescontoMaxPerc !== undefined && { tokenDescontoMaxPerc: dto.tokenDescontoMaxPerc }),
        ...(dto.tokenExpiracaoMeses !== undefined && { tokenExpiracaoMeses: dto.tokenExpiracaoMeses }),
      },
    });
  }

  async remove(id: string, reqUser: ReqUserLike) {
    await this.findOne(id, reqUser); // valida cross-tenant

    // Count contratos vinculados — filtra por tenant em ADMIN pra evitar falso positivo cross-tenant
    const whereCount: Prisma.ContratoWhereInput = {
      planoId: id,
      status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
    };
    if (reqUser.perfil !== PerfilUsuario.SUPER_ADMIN && reqUser.cooperativaId) {
      whereCount.cooperativaId = reqUser.cooperativaId;
    }
    const contratos = await this.prisma.contrato.count({ where: whereCount });
    if (contratos > 0) {
      throw new BadRequestException(
        'Não é possível excluir plano com contratos vinculados. Desvincule os contratos antes de remover.',
      );
    }
    await this.prisma.plano.delete({ where: { id } });
    return { sucesso: true };
  }
}
