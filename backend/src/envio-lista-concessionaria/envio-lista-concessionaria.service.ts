import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StatusEnvioConcessionaria, StatusEnvioCooperado } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CanalEnvio, MarcarEnviadoDto } from './dto/marcar-enviado.dto';
import { RegistrarProtocoloDto } from './dto/registrar-protocolo.dto';
import { RegistrarHomologacaoDto, StatusHomologacaoInput } from './dto/registrar-homologacao.dto';

const SERIALIZABLE_TX = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

export interface ListarFiltros {
  status?: StatusEnvioConcessionaria | StatusEnvioConcessionaria[];
  usinaId?: string;
  geradaDe?: Date;
  geradaAte?: Date;
  search?: string;
}

export interface PaginacaoDto {
  page?: number;
  pageSize?: number;
}

@Injectable()
export class EnvioListaConcessionariaService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers internos
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Carrega envio garantindo isolamento multi-tenant.
   * cooperativaId=null → SUPER_ADMIN (sem restrição).
   */
  private async carregarEnvio(envioId: string, cooperativaId: string | null) {
    const envio = await this.prisma.envioListaConcessionaria.findUnique({
      where: { id: envioId },
      include: { usina: true, cooperados: true },
    });
    if (!envio) {
      throw new NotFoundException('Envio de lista não encontrado.');
    }
    if (cooperativaId && envio.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Envio não pertence à sua cooperativa.');
    }
    return envio;
  }

  /**
   * Gera numeroInterno sequencial pra usina no mês corrente.
   * Formato: LIST-{apelidoInterno || id.slice(0,6)}-YYYYMM-NNN
   */
  private async gerarNumeroInterno(
    tx: Prisma.TransactionClient,
    usinaId: string,
    apelidoInterno: string | null,
    usinaIdFull: string,
  ): Promise<string> {
    const apelido = (apelidoInterno && apelidoInterno.trim().length > 0)
      ? apelidoInterno.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      : usinaIdFull.slice(0, 6);
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefixo = `LIST-${apelido}-${yyyymm}-`;

    const ultimo = await tx.envioListaConcessionaria.findFirst({
      where: {
        usinaId,
        numeroInterno: { startsWith: prefixo },
      },
      orderBy: { numeroInterno: 'desc' },
      select: { numeroInterno: true },
    });

    let seq = 1;
    if (ultimo) {
      const m = ultimo.numeroInterno.match(/-(\d+)$/);
      if (m) seq = Number.parseInt(m[1], 10) + 1;
    }
    return `${prefixo}${String(seq).padStart(3, '0')}`;
  }

  /**
   * Valida transição de status — lança BadRequestException se inválida.
   */
  private validarTransicao(
    atual: StatusEnvioConcessionaria,
    proxima: StatusEnvioConcessionaria,
  ): void {
    const transicoesPermitidas: Record<StatusEnvioConcessionaria, StatusEnvioConcessionaria[]> = {
      RASCUNHO: ['VALIDADA', 'CANCELADA'],
      VALIDADA: ['PRONTA_PARA_ENVIO', 'CANCELADA'],
      PRONTA_PARA_ENVIO: ['ENVIADA', 'CANCELADA'],
      ENVIADA: ['PROTOCOLADA', 'REJEITADA'],
      PROTOCOLADA: ['HOMOLOGADO_PARCIAL', 'HOMOLOGADO_TOTAL', 'REJEITADA'],
      HOMOLOGADO_PARCIAL: ['HOMOLOGADO_TOTAL', 'REJEITADA'],
      HOMOLOGADO_TOTAL: [],
      REJEITADA: [],
      CANCELADA: [],
    };
    const validas = transicoesPermitidas[atual] ?? [];
    if (!validas.includes(proxima)) {
      throw new BadRequestException(
        `Transição inválida: ${atual} → ${proxima}. Permitidas: ${validas.join(', ') || '(nenhuma — estado final)'}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1. criarRascunho
  // ─────────────────────────────────────────────────────────────────────────

  async criarRascunho(args: {
    usinaId: string;
    cooperativaId: string | null;
    cooperadoIds: string[];
  }) {
    const { usinaId, cooperativaId, cooperadoIds } = args;

    if (!usinaId) throw new BadRequestException('usinaId é obrigatório.');
    if (!cooperadoIds || cooperadoIds.length === 0) {
      throw new BadRequestException('Selecione pelo menos 1 cooperado.');
    }

    // Buscar usina + validar multi-tenant
    const usina = await this.prisma.usina.findUnique({
      where: { id: usinaId },
      select: {
        id: true,
        nome: true,
        apelidoInterno: true,
        cooperativaId: true,
        capacidadeKwh: true,
      },
    });
    if (!usina) throw new NotFoundException('Usina não encontrada.');
    if (cooperativaId && usina.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Usina não pertence à sua cooperativa.');
    }

    const tenantEfetivo = cooperativaId ?? usina.cooperativaId;
    if (!tenantEfetivo) {
      throw new BadRequestException(
        'Usina sem cooperativa vinculada — vincule antes de gerar envio.',
      );
    }

    // Buscar contratos ATIVOS/PENDENTE_ATIVACAO dos cooperadoIds vinculados a esta usina
    const contratos = await this.prisma.contrato.findMany({
      where: {
        cooperadoId: { in: cooperadoIds },
        usinaId,
        status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
      },
      include: {
        cooperado: { select: { id: true, cooperativaId: true } },
        uc: { select: { numero: true } },
      },
    });

    if (contratos.length === 0) {
      throw new BadRequestException(
        'Nenhum dos cooperados informados tem contrato ATIVO/PENDENTE nesta usina.',
      );
    }

    // Validar multi-tenant de cada cooperado (defensivo)
    for (const c of contratos) {
      if (cooperativaId && c.cooperado.cooperativaId !== cooperativaId) {
        throw new ForbiddenException(
          `Cooperado ${c.cooperado.id} não pertence à sua cooperativa.`,
        );
      }
    }

    const cooperadosEncontrados = new Set(contratos.map((c) => c.cooperadoId));
    const ausentes = cooperadoIds.filter((id) => !cooperadosEncontrados.has(id));
    if (ausentes.length > 0) {
      throw new BadRequestException(
        `Cooperados sem contrato ATIVO/PENDENTE nesta usina: ${ausentes.join(', ')}`,
      );
    }

    // Transação: gerar numeroInterno + criar envio + criar EnvioListaCooperado por contrato
    const envio = await this.prisma.$transaction(async (tx) => {
      const numeroInterno = await this.gerarNumeroInterno(
        tx,
        usina.id,
        usina.apelidoInterno,
        usina.id,
      );

      const criado = await tx.envioListaConcessionaria.create({
        data: {
          numeroInterno,
          cooperativaId: tenantEfetivo,
          usinaId: usina.id,
          status: 'RASCUNHO',
          cooperados: {
            create: contratos.map((c) => ({
              contratoId: c.id,
              cooperadoId: c.cooperadoId,
              ucNumero: c.uc?.numero ?? '',
              kwhContratoSnapshot: c.kwhContrato ?? new Prisma.Decimal(0),
              percentualUsinaSnapshot: c.percentualUsina ?? new Prisma.Decimal(0),
              statusIndividual: 'PENDENTE' as StatusEnvioCooperado,
            })),
          },
        },
        include: {
          cooperados: {
            include: {
              cooperado: { select: { id: true, nomeCompleto: true, cpf: true } },
              contrato: { select: { numero: true, status: true } },
            },
          },
          usina: { select: { id: true, nome: true, apelidoInterno: true } },
        },
      });

      return criado;
    }, SERIALIZABLE_TX);

    return envio;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. listarCooperadosElegiveis
  // ─────────────────────────────────────────────────────────────────────────

  async listarCooperadosElegiveis(usinaId: string, cooperativaId: string | null) {
    const usina = await this.prisma.usina.findUnique({
      where: { id: usinaId },
      select: { id: true, cooperativaId: true, nome: true, apelidoInterno: true, capacidadeKwh: true },
    });
    if (!usina) throw new NotFoundException('Usina não encontrada.');
    if (cooperativaId && usina.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Usina não pertence à sua cooperativa.');
    }

    const contratos = await this.prisma.contrato.findMany({
      where: {
        usinaId,
        status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
      },
      include: {
        cooperado: { select: { id: true, nomeCompleto: true, cpf: true } },
        uc: { select: { numero: true } },
      },
      orderBy: { dataInicio: 'asc' },
    });

    // Para cada cooperado, descobrir histórico de envios (ignorando CANCELADA/REJEITADA do envio)
    const cooperadoIds = contratos.map((c) => c.cooperadoId);
    const enviosAnteriores = cooperadoIds.length === 0
      ? []
      : await this.prisma.envioListaCooperado.findMany({
          where: {
            cooperadoId: { in: cooperadoIds },
            envio: { status: { notIn: ['CANCELADA'] } },
          },
          orderBy: { createdAt: 'desc' },
          include: {
            envio: { select: { id: true, numeroInterno: true, status: true, geradaEm: true } },
          },
        });

    const ultimoPorCooperado = new Map<string, typeof enviosAnteriores[number]>();
    for (const e of enviosAnteriores) {
      if (!ultimoPorCooperado.has(e.cooperadoId)) {
        ultimoPorCooperado.set(e.cooperadoId, e);
      }
    }

    return {
      usina: {
        id: usina.id,
        nome: usina.nome,
        apelidoInterno: usina.apelidoInterno,
        capacidadeKwh: Number(usina.capacidadeKwh ?? 0),
      },
      cooperados: contratos.map((c) => {
        const ultimo = ultimoPorCooperado.get(c.cooperadoId);
        return {
          cooperadoId: c.cooperado.id,
          contratoId: c.id,
          nome: c.cooperado.nomeCompleto,
          cpf: c.cooperado.cpf,
          ucNumero: c.uc?.numero ?? '',
          kwhContrato: Number(c.kwhContrato ?? 0),
          percentualUsina: Number(c.percentualUsina ?? 0),
          statusContrato: c.status,
          jaEnviado: !!ultimo,
          ultimoEnvioStatus: ultimo?.statusIndividual ?? null,
          homologado: ultimo?.statusIndividual === 'HOMOLOGADO',
          ultimoEnvioId: ultimo?.envio.id ?? null,
          ultimoEnvioNumero: ultimo?.envio.numeroInterno ?? null,
        };
      }),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. validar
  // ─────────────────────────────────────────────────────────────────────────

  async validar(envioId: string, validadaPorId: string, cooperativaId: string | null) {
    const envio = await this.carregarEnvio(envioId, cooperativaId);
    this.validarTransicao(envio.status, 'VALIDADA');

    return this.prisma.envioListaConcessionaria.update({
      where: { id: envioId },
      data: {
        status: 'VALIDADA',
        validadaEm: new Date(),
        validadaPorId,
      },
      include: {
        cooperados: {
          include: { cooperado: { select: { nomeCompleto: true } } },
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. marcarProntoPraEnvio
  // ─────────────────────────────────────────────────────────────────────────

  async marcarProntoPraEnvio(envioId: string, cooperativaId: string | null) {
    const envio = await this.carregarEnvio(envioId, cooperativaId);
    this.validarTransicao(envio.status, 'PRONTA_PARA_ENVIO');

    return this.prisma.envioListaConcessionaria.update({
      where: { id: envioId },
      data: { status: 'PRONTA_PARA_ENVIO' },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. marcarEnviado
  // ─────────────────────────────────────────────────────────────────────────

  async marcarEnviado(
    envioId: string,
    dto: MarcarEnviadoDto,
    enviadaPorId: string,
    cooperativaId: string | null,
  ) {
    const envio = await this.carregarEnvio(envioId, cooperativaId);
    this.validarTransicao(envio.status, 'ENVIADA');

    const observacoesNova = dto.observacoes
      ? [envio.observacoes, `[envio] ${dto.observacoes}`].filter(Boolean).join('\n')
      : envio.observacoes;

    return this.prisma.envioListaConcessionaria.update({
      where: { id: envioId },
      data: {
        status: 'ENVIADA',
        enviadaEm: new Date(),
        enviadaPorId,
        canalEnvio: dto.canalEnvio,
        observacoes: observacoesNova,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. registrarProtocolo
  // ─────────────────────────────────────────────────────────────────────────

  async registrarProtocolo(
    envioId: string,
    dto: RegistrarProtocoloDto,
    cooperativaId: string | null,
  ) {
    const envio = await this.carregarEnvio(envioId, cooperativaId);
    this.validarTransicao(envio.status, 'PROTOCOLADA');

    return this.prisma.envioListaConcessionaria.update({
      where: { id: envioId },
      data: {
        status: 'PROTOCOLADA',
        protocoloEm: dto.dataProtocolo ? new Date(dto.dataProtocolo) : new Date(),
        numeroProtocoloConcessionaria: dto.numeroProtocoloConcessionaria,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. registrarHomologacao (por cooperado individual + agrega status do envio)
  // ─────────────────────────────────────────────────────────────────────────

  async registrarHomologacao(
    envioId: string,
    cooperadoId: string,
    dto: RegistrarHomologacaoDto,
    cooperativaId: string | null,
  ) {
    const envio = await this.carregarEnvio(envioId, cooperativaId);
    if (!['PROTOCOLADA', 'HOMOLOGADO_PARCIAL'].includes(envio.status)) {
      throw new BadRequestException(
        `Envio em status ${envio.status} não aceita registro de homologação. Estados válidos: PROTOCOLADA, HOMOLOGADO_PARCIAL.`,
      );
    }

    // Localizar EnvioListaCooperado correspondente
    const linha = envio.cooperados.find((c) => c.cooperadoId === cooperadoId);
    if (!linha) {
      throw new NotFoundException(
        `Cooperado ${cooperadoId} não está neste envio (snapshot imutável).`,
      );
    }

    const novoStatusIndividual: StatusEnvioCooperado =
      dto.statusIndividual === StatusHomologacaoInput.HOMOLOGADO ? 'HOMOLOGADO' : 'REJEITADO';

    const resultado = await this.prisma.$transaction(async (tx) => {
      // Atualizar linha individual
      await tx.envioListaCooperado.update({
        where: { id: linha.id },
        data: {
          statusIndividual: novoStatusIndividual,
          dataHomologacao: dto.dataHomologacao ? new Date(dto.dataHomologacao) : new Date(),
          observacaoIndividual: dto.observacao,
        },
      });

      // Recarregar todos pra calcular agregado
      const todos = await tx.envioListaCooperado.findMany({
        where: { envioId },
        select: { statusIndividual: true },
      });

      const total = todos.length;
      const homologados = todos.filter((c) => c.statusIndividual === 'HOMOLOGADO').length;
      const pendentes = todos.filter((c) => c.statusIndividual === 'PENDENTE').length;
      const rejeitados = todos.filter((c) => c.statusIndividual === 'REJEITADO').length;

      let novoStatusEnvio: StatusEnvioConcessionaria = envio.status;
      const dadosUpdate: Prisma.EnvioListaConcessionariaUpdateInput = {};

      if (homologados === total && total > 0) {
        novoStatusEnvio = 'HOMOLOGADO_TOTAL';
        dadosUpdate.status = novoStatusEnvio;
        dadosUpdate.liberadaEm = new Date();
      } else if (homologados > 0) {
        novoStatusEnvio = 'HOMOLOGADO_PARCIAL';
        dadosUpdate.status = novoStatusEnvio;
      } else if (rejeitados === total && pendentes === 0) {
        novoStatusEnvio = 'REJEITADA';
        dadosUpdate.status = novoStatusEnvio;
      } else {
        // Mantém PROTOCOLADA (ou HOMOLOGADO_PARCIAL já setado)
        novoStatusEnvio = envio.status;
      }

      const envioAtualizado = await tx.envioListaConcessionaria.update({
        where: { id: envioId },
        data: dadosUpdate,
        include: {
          cooperados: {
            include: { cooperado: { select: { nomeCompleto: true } } },
          },
        },
      });

      return {
        envio: envioAtualizado,
        agregado: { total, homologados, pendentes, rejeitados, status: novoStatusEnvio },
      };
    }, SERIALIZABLE_TX);

    return resultado;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. cancelar
  // ─────────────────────────────────────────────────────────────────────────

  async cancelar(envioId: string, motivo: string | undefined, cooperativaId: string | null) {
    const envio = await this.carregarEnvio(envioId, cooperativaId);
    const estadosFinais: StatusEnvioConcessionaria[] = [
      'HOMOLOGADO_TOTAL',
      'REJEITADA',
      'CANCELADA',
    ];
    if (estadosFinais.includes(envio.status)) {
      throw new BadRequestException(
        `Envio em status ${envio.status} é final e não pode ser cancelado.`,
      );
    }

    const observacoesNova = motivo
      ? [envio.observacoes, `[cancelamento] ${motivo}`].filter(Boolean).join('\n')
      : envio.observacoes;

    return this.prisma.envioListaConcessionaria.update({
      where: { id: envioId },
      data: { status: 'CANCELADA', observacoes: observacoesNova },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. gerarCsv (usa snapshot, não recalcula contrato atual)
  // ─────────────────────────────────────────────────────────────────────────

  async gerarCsv(envioId: string, cooperativaId: string | null) {
    const envio = await this.carregarEnvio(envioId, cooperativaId);
    const linhas = await this.prisma.envioListaCooperado.findMany({
      where: { envioId },
      include: {
        cooperado: { select: { nomeCompleto: true, cpf: true } },
        contrato: { select: { numero: true, dataInicio: true } },
      },
      orderBy: { cooperado: { nomeCompleto: 'asc' } },
    });

    const header = 'Nome,CPF,Numero UC,kWh Contratado,% Usina,Data Adesao,Contrato,Status';
    const rows = linhas.map((l) => {
      const dataAdesao = l.contrato.dataInicio
        ? new Date(l.contrato.dataInicio).toLocaleDateString('pt-BR')
        : '';
      return [
        `"${l.cooperado.nomeCompleto}"`,
        `"${l.cooperado.cpf ?? ''}"`,
        `"${l.ucNumero}"`,
        Number(l.kwhContratoSnapshot),
        Number(l.percentualUsinaSnapshot),
        `"${dataAdesao}"`,
        `"${l.contrato.numero}"`,
        `"${l.statusIndividual}"`,
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    const filename = `${envio.numeroInterno}-${new Date().toISOString().slice(0, 10)}.csv`;
    return { csv, filename, numeroInterno: envio.numeroInterno };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. listar (paginado, com filtros)
  // ─────────────────────────────────────────────────────────────────────────

  async listar(
    cooperativaId: string | null,
    filtros: ListarFiltros = {},
    paginacao: PaginacaoDto = {},
  ) {
    const page = Math.max(1, paginacao.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, paginacao.pageSize ?? 25));
    const skip = (page - 1) * pageSize;

    const where: Prisma.EnvioListaConcessionariaWhereInput = {};
    if (cooperativaId) where.cooperativaId = cooperativaId;
    if (filtros.status) {
      where.status = Array.isArray(filtros.status)
        ? { in: filtros.status }
        : filtros.status;
    }
    if (filtros.usinaId) where.usinaId = filtros.usinaId;
    if (filtros.geradaDe || filtros.geradaAte) {
      where.geradaEm = {};
      if (filtros.geradaDe) where.geradaEm.gte = filtros.geradaDe;
      if (filtros.geradaAte) where.geradaEm.lte = filtros.geradaAte;
    }
    if (filtros.search) {
      where.OR = [
        { numeroInterno: { contains: filtros.search, mode: 'insensitive' } },
        { numeroProtocoloConcessionaria: { contains: filtros.search, mode: 'insensitive' } },
      ];
    }

    const [total, registros] = await Promise.all([
      this.prisma.envioListaConcessionaria.count({ where }),
      this.prisma.envioListaConcessionaria.findMany({
        where,
        orderBy: { geradaEm: 'desc' },
        skip,
        take: pageSize,
        include: {
          usina: { select: { id: true, nome: true, apelidoInterno: true } },
          cooperados: { select: { statusIndividual: true } },
        },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      registros: registros.map((r) => {
        const counts = {
          pendente: r.cooperados.filter((c) => c.statusIndividual === 'PENDENTE').length,
          homologado: r.cooperados.filter((c) => c.statusIndividual === 'HOMOLOGADO').length,
          rejeitado: r.cooperados.filter((c) => c.statusIndividual === 'REJEITADO').length,
          total: r.cooperados.length,
        };
        return {
          id: r.id,
          numeroInterno: r.numeroInterno,
          status: r.status,
          usina: r.usina,
          geradaEm: r.geradaEm,
          validadaEm: r.validadaEm,
          enviadaEm: r.enviadaEm,
          canalEnvio: r.canalEnvio,
          protocoloEm: r.protocoloEm,
          numeroProtocoloConcessionaria: r.numeroProtocoloConcessionaria,
          liberadaEm: r.liberadaEm,
          counts,
        };
      }),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. obterDetalhe
  // ─────────────────────────────────────────────────────────────────────────

  async obterDetalhe(envioId: string, cooperativaId: string | null) {
    const envio = await this.prisma.envioListaConcessionaria.findUnique({
      where: { id: envioId },
      include: {
        usina: { select: { id: true, nome: true, apelidoInterno: true, capacidadeKwh: true } },
        cooperativa: { select: { id: true, nome: true } },
        validadaPor: { select: { id: true, nome: true } },
        enviadaPor: { select: { id: true, nome: true } },
        cooperados: {
          include: {
            cooperado: { select: { id: true, nomeCompleto: true, cpf: true, telefone: true } },
            contrato: { select: { id: true, numero: true, status: true } },
          },
          orderBy: { cooperado: { nomeCompleto: 'asc' } },
        },
      },
    });
    if (!envio) throw new NotFoundException('Envio de lista não encontrado.');
    if (cooperativaId && envio.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Envio não pertence à sua cooperativa.');
    }
    return envio;
  }
}
