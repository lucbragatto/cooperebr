import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ContratosService } from '../contratos/contratos.service';
import { UsinasService } from '../usinas/usinas.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';

const SERIALIZABLE_TX = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

export interface MigrarCooperadoDto {
  cooperadoId: string;
  usinaDestinoId: string;
  kwhNovo?: number;
  percentualNovo?: number;
  motivo?: string;
  realizadoPorId: string;
  /** null = SUPER_ADMIN (sem restrição de tenant); string = validação obrigatória */
  cooperativaId: string | null;
  /** Se informado, migra apenas este contrato específico; senão, pega o primeiro ativo */
  contratoId?: string;
}

export interface AjustarKwhDto {
  cooperadoId: string;
  kwhNovo?: number;
  percentualNovo?: number;
  motivo?: string;
  realizadoPorId: string;
  /** null = SUPER_ADMIN (sem restrição de tenant); string = validação obrigatória */
  cooperativaId: string | null;
  /** Se informado, ajusta apenas este contrato específico; senão, pega o primeiro ativo */
  contratoId?: string;
}

export interface MigrarTodosDto {
  usinaOrigemId: string;
  usinaDestinoId: string;
  motivo?: string;
  realizadoPorId: string;
  /** null = SUPER_ADMIN (sem restrição de tenant); string = validação obrigatória */
  cooperativaId: string | null;
}

@Injectable()
export class MigracoesUsinaService {
  constructor(
    private prisma: PrismaService,
    private contratosService: ContratosService,
    private usinasService: UsinasService,
    private whatsappSender: WhatsappSenderService,
  ) {}

  /**
   * Migra um cooperado de uma usina para outra.
   * Encerra contrato antigo, cria novo contrato, registra histórico.
   */
  async migrarCooperado(dto: MigrarCooperadoDto) {
    if (!dto.kwhNovo && !dto.percentualNovo) {
      throw new BadRequestException(
        'Informe kwhNovo ou percentualNovo para a migração.',
      );
    }

    // SEC-07: validar que o cooperado pertence à cooperativa do admin logado
    // cooperativaId null = SUPER_ADMIN (acesso total); string = validação obrigatória
    if (dto.cooperativaId !== null) {
      const cooperado = await this.prisma.cooperado.findUnique({
        where: { id: dto.cooperadoId },
        select: { cooperativaId: true },
      });
      if (!cooperado) {
        throw new NotFoundException('Cooperado não encontrado.');
      }
      if (cooperado.cooperativaId !== dto.cooperativaId) {
        throw new ForbiddenException('Cooperado não pertence à sua cooperativa.');
      }
    }

    // 1. Buscar contrato ativo do cooperado (específico ou primeiro encontrado)
    const contratoAtivo = dto.contratoId
      ? await this.prisma.contrato.findFirst({
          where: {
            id: dto.contratoId,
            cooperadoId: dto.cooperadoId,
            status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
          },
          include: { cooperado: true, uc: true, usina: true },
        })
      : await this.prisma.contrato.findFirst({
          where: {
            cooperadoId: dto.cooperadoId,
            status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
          },
          include: { cooperado: true, uc: true, usina: true },
        });
    if (!contratoAtivo) {
      throw new NotFoundException(
        'Cooperado não possui contrato ativo para migração.',
      );
    }

    const usinaOrigem = contratoAtivo.usina;
    // D-48.5: isolamento multi-tenant — usina destino deve ser do mesmo tenant
    // (SUPER_ADMIN bypass quando dto.cooperativaId === null — SEC-07 já valida cooperado).
    const usinaDestino = await this.prisma.usina.findUnique({
      where: {
        id: dto.usinaDestinoId,
        ...(dto.cooperativaId !== null ? { cooperativaId: dto.cooperativaId } : {}),
      },
    });
    if (!usinaDestino) {
      throw new NotFoundException('Usina destino não encontrada.');
    }

    // Calcular kWh novo
    let kwhContratoAnual: number;
    if (dto.kwhNovo) {
      kwhContratoAnual = dto.kwhNovo * 12;
    } else if (dto.percentualNovo) {
      const capDest = Number(usinaDestino.capacidadeKwh ?? 0);
      if (capDest <= 0) {
        throw new BadRequestException(
          'Usina destino não possui capacidade definida para cálculo por percentual.',
        );
      }
      kwhContratoAnual = (dto.percentualNovo / 100) * capDest;
    } else {
      kwhContratoAnual = Number(contratoAtivo.kwhContratoAnual ?? Number(contratoAtivo.kwhContrato ?? 0) * 12);
    }

    const kwhAnterior = Number(contratoAtivo.kwhContrato ?? 0);
    const percentualAnterior = Number(contratoAtivo.percentualUsina ?? 0);
    const kwhNovo = Math.round((kwhContratoAnual / 12) * 100) / 100;

    // 2. Transação: encerrar antigo + criar novo
    const resultado = await this.prisma.$transaction(async (tx) => {
      // Encerrar contrato antigo
      const contratoAntigo = await tx.contrato.update({
        where: { id: contratoAtivo.id },
        data: {
          status: 'ENCERRADO',
          dataFim: new Date(),
        },
      });

      // Gerar número do novo contrato
      const numero = await this.contratosService.gerarNumeroContrato(tx);

      // Calcular percentual na usina destino
      const capDestino = Number(usinaDestino.capacidadeKwh ?? 0);
      const percentualNovo =
        capDestino > 0
          ? Math.round((kwhContratoAnual / capDestino) * 10000) / 10000
          : 0;

      // Validar capacidade da usina destino
      const contratosDestinoAtivos = await tx.contrato.findMany({
        where: {
          usinaId: dto.usinaDestinoId,
          status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
        },
        select: { percentualUsina: true, kwhContratoAnual: true, kwhContrato: true },
      });
      const somaPercentual = contratosDestinoAtivos.reduce((acc: number, c: any) => {
        if (c.percentualUsina) return acc + Number(c.percentualUsina);
        const anual = c.kwhContratoAnual
          ? Number(c.kwhContratoAnual)
          : Number(c.kwhContrato ?? 0) * 12;
        return acc + (capDestino > 0 ? (anual / capDestino) * 100 : 0);
      }, 0);

      if (capDestino > 0 && somaPercentual + percentualNovo > 100.0001) {
        throw new BadRequestException(
          `Capacidade da usina destino insuficiente. Disponível: ${(100 - somaPercentual).toFixed(2)}%, Solicitado: ${percentualNovo.toFixed(2)}%`,
        );
      }

      // Criar novo contrato
      const dataInicio = new Date();
      const dataFim = new Date();
      dataFim.setMonth(dataFim.getMonth() + 12);

      // Fase B (Decisão B33): migração herda snapshots do contrato antigo.
      // Mesma tarifa, mesmo plano, mesmo desconto — só muda usina e kWh contratado.
      // valorContrato é recalculado se contrato antigo era FIXO (sinalizado por valorContrato != null).
      let valorContratoMigrado: number | null = null;
      if (contratoAtivo.tarifaContratual && contratoAtivo.valorContrato !== null) {
        valorContratoMigrado = Math.round(Number(contratoAtivo.tarifaContratual) * kwhNovo * 100) / 100;
      }

      const contratoNovo = await tx.contrato.create({
        data: {
          numero,
          cooperadoId: dto.cooperadoId,
          ucId: contratoAtivo.ucId,
          usinaId: dto.usinaDestinoId,
          planoId: contratoAtivo.planoId,
          dataInicio,
          dataFim,
          percentualDesconto: contratoAtivo.percentualDesconto,
          kwhContrato: kwhNovo,
          kwhContratoAnual,
          kwhContratoMensal: kwhNovo,
          percentualUsina: percentualNovo,
          status: 'ATIVO',
          cooperativaId: contratoAtivo.cooperativaId,
          modeloCobrancaOverride: contratoAtivo.modeloCobrancaOverride,
          // Herda snapshots do contrato antigo (Fase B)
          ...(contratoAtivo.tarifaContratual !== null ? { tarifaContratual: contratoAtivo.tarifaContratual } : {}),
          ...(valorContratoMigrado !== null ? { valorContrato: valorContratoMigrado } : {}),
          ...(contratoAtivo.baseCalculoAplicado ? { baseCalculoAplicado: contratoAtivo.baseCalculoAplicado } : {}),
          ...(contratoAtivo.tipoDescontoAplicado ? { tipoDescontoAplicado: contratoAtivo.tipoDescontoAplicado } : {}),
          ...(contratoAtivo.tarifaContratualPromocional !== null ? { tarifaContratualPromocional: contratoAtivo.tarifaContratualPromocional } : {}),
          ...(contratoAtivo.descontoPromocionalAplicado !== null ? { descontoPromocionalAplicado: contratoAtivo.descontoPromocionalAplicado } : {}),
          ...(contratoAtivo.mesesPromocaoAplicados !== null ? { mesesPromocaoAplicados: contratoAtivo.mesesPromocaoAplicados } : {}),
          // Fase B.5: herda snapshot do valor cheio do aceite
          ...((contratoAtivo as any).valorCheioKwhAceite != null
            ? { valorCheioKwhAceite: (contratoAtivo as any).valorCheioKwhAceite } : {}),
        } as any,
        include: { uc: true, usina: true },
      });

      // Registrar migração
      await tx.migracaoUsina.create({
        data: {
          cooperadoId: dto.cooperadoId,
          usinaOrigemId: usinaOrigem?.id ?? null,
          usinaDestinoId: dto.usinaDestinoId,
          contratoAntigoId: contratoAntigo.id,
          contratoNovoId: contratoNovo.id,
          kwhAnterior: kwhAnterior,
          percentualAnterior: percentualAnterior,
          kwhNovo: kwhNovo,
          percentualNovo: percentualNovo,
          motivo: dto.motivo,
          tipo: 'MUDANCA_USINA',
          realizadoPorId: dto.realizadoPorId,
          // SUPER_ADMIN pode não ter cooperativaId; cast necessário pois o campo é required no schema
          ...(dto.cooperativaId ? { cooperativaId: dto.cooperativaId } : {}),
        } as any,
      });

      return { contratoAntigo, contratoNovo };
    }, SERIALIZABLE_TX);

    // 3. Gerar listas atualizadas das 2 usinas
    const [listaOrigem, listaDestino] = await Promise.all([
      usinaOrigem ? this.usinasService.gerarListaConcessionaria(usinaOrigem.id) : null,
      this.usinasService.gerarListaConcessionaria(dto.usinaDestinoId),
    ]);

    // 4. WhatsApp
    try {
      const cooperado = await this.prisma.cooperado.findUnique({
        where: { id: dto.cooperadoId },
        select: { telefone: true, nomeCompleto: true },
      });
      if (cooperado?.telefone) {
        const nomeOrigem = usinaOrigem?.nome ?? 'anterior';
        const nomeDest = usinaDestino.nome;
        await this.whatsappSender.enviarMensagem(
          cooperado.telefone,
          `Olá ${cooperado.nomeCompleto}! Sua usina foi atualizada! De *${nomeOrigem}* para *${nomeDest}*. Seus créditos seguem normalmente. 🌞`,
        );
      }
    } catch {}

    return {
      contratoAntigo: resultado.contratoAntigo,
      contratoNovo: resultado.contratoNovo,
      listaOrigem,
      listaDestino,
    };
  }

  /**
   * Ajusta kWh/percentual do cooperado na mesma usina.
   */
  async ajustarKwh(dto: AjustarKwhDto) {
    if (!dto.kwhNovo && !dto.percentualNovo) {
      throw new BadRequestException(
        'Informe kwhNovo ou percentualNovo para o ajuste.',
      );
    }

    // SEC-07: validar que o cooperado pertence à cooperativa do admin logado
    // cooperativaId null = SUPER_ADMIN (acesso total); string = validação obrigatória
    if (dto.cooperativaId !== null) {
      const cooperado = await this.prisma.cooperado.findUnique({
        where: { id: dto.cooperadoId },
        select: { cooperativaId: true },
      });
      if (!cooperado) {
        throw new NotFoundException('Cooperado não encontrado.');
      }
      if (cooperado.cooperativaId !== dto.cooperativaId) {
        throw new ForbiddenException('Cooperado não pertence à sua cooperativa.');
      }
    }

    const contratoAtivo = dto.contratoId
      ? await this.prisma.contrato.findFirst({
          where: {
            id: dto.contratoId,
            cooperadoId: dto.cooperadoId,
            status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
          },
          include: { usina: true, cooperado: true },
        })
      : await this.prisma.contrato.findFirst({
          where: {
            cooperadoId: dto.cooperadoId,
            status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
          },
          include: { usina: true, cooperado: true },
        });
    if (!contratoAtivo) {
      throw new NotFoundException(
        'Cooperado não possui contrato ativo para ajuste.',
      );
    }

    const kwhAnterior = Number(contratoAtivo.kwhContrato ?? 0);
    const percentualAnterior = Number(contratoAtivo.percentualUsina ?? 0);

    let kwhContratoAnual: number;
    if (dto.kwhNovo) {
      kwhContratoAnual = dto.kwhNovo * 12;
    } else if (dto.percentualNovo && contratoAtivo.usina) {
      const cap = Number(contratoAtivo.usina.capacidadeKwh ?? 0);
      kwhContratoAnual = (dto.percentualNovo / 100) * cap;
    } else {
      throw new BadRequestException('Não é possível calcular kWh.');
    }

    const kwhNovo = Math.round((kwhContratoAnual / 12) * 100) / 100;
    const capUsina = Number(contratoAtivo.usina?.capacidadeKwh ?? 0);
    const percentualNovo =
      capUsina > 0
        ? Math.round((kwhContratoAnual / capUsina) * 10000) / 10000
        : 0;

    // Atualizar contrato em transação serializable
    const contratoAtualizado = await this.prisma.$transaction(async (tx) => {
      // Validar capacidade
      if (capUsina > 0 && contratoAtivo.usinaId) {
        const outrosContratos = await tx.contrato.findMany({
          where: {
            usinaId: contratoAtivo.usinaId,
            status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
            id: { not: contratoAtivo.id },
          },
          select: { percentualUsina: true, kwhContratoAnual: true, kwhContrato: true },
        });
        const somaPercentual = outrosContratos.reduce((acc: number, c: any) => {
          if (c.percentualUsina) return acc + Number(c.percentualUsina);
          const anual = c.kwhContratoAnual
            ? Number(c.kwhContratoAnual)
            : Number(c.kwhContrato ?? 0) * 12;
          return acc + (anual / capUsina) * 100;
        }, 0);

        if (somaPercentual + percentualNovo > 100.0001) {
          throw new BadRequestException(
            `Capacidade insuficiente. Disponível: ${(100 - somaPercentual).toFixed(2)}%, Solicitado: ${percentualNovo.toFixed(2)}%`,
          );
        }
      }

      const updated = await tx.contrato.update({
        where: { id: contratoAtivo.id },
        data: {
          kwhContrato: kwhNovo,
          kwhContratoAnual,
          kwhContratoMensal: kwhNovo,
          percentualUsina: percentualNovo,
        } as any,
        include: { usina: true },
      });

      // Registrar migração
      await tx.migracaoUsina.create({
        data: {
          cooperadoId: dto.cooperadoId,
          usinaOrigemId: contratoAtivo.usinaId,
          usinaDestinoId: contratoAtivo.usinaId,
          contratoAntigoId: contratoAtivo.id,
          contratoNovoId: contratoAtivo.id,
          kwhAnterior,
          percentualAnterior,
          kwhNovo,
          percentualNovo,
          motivo: dto.motivo,
          tipo: 'AJUSTE_KWH',
          realizadoPorId: dto.realizadoPorId,
          // SUPER_ADMIN pode não ter cooperativaId; cast necessário pois o campo é required no schema
          ...(dto.cooperativaId ? { cooperativaId: dto.cooperativaId } : {}),
        } as any,
      });

      return updated;
    }, SERIALIZABLE_TX);

    // Gerar lista atualizada
    let listaUsina = null;
    if (contratoAtivo.usinaId) {
      listaUsina = await this.usinasService.gerarListaConcessionaria(
        contratoAtivo.usinaId,
      );
    }

    // WhatsApp
    try {
      const cooperado = contratoAtivo.cooperado;
      if (cooperado?.telefone) {
        await this.whatsappSender.enviarMensagem(
          cooperado.telefone,
          `Olá ${cooperado.nomeCompleto}! Seu plano foi atualizado! Novo volume: *${kwhNovo} kWh/mês*. 🌞`,
        );
      }
    } catch {}

    return {
      contrato: contratoAtualizado,
      listaUsina,
    };
  }

  /**
   * Migra todos os cooperados de uma usina para outra.
   */
  async migrarTodosDeUsina(dto: MigrarTodosDto) {
    // D-48.5: isolamento multi-tenant em ambas as usinas
    // (SUPER_ADMIN bypass quando dto.cooperativaId === null).
    const tenantFilter = dto.cooperativaId !== null
      ? { cooperativaId: dto.cooperativaId }
      : {};

    const usinaOrigem = await this.prisma.usina.findUnique({
      where: { id: dto.usinaOrigemId, ...tenantFilter },
    });
    if (!usinaOrigem) {
      throw new NotFoundException('Usina origem não encontrada.');
    }

    const usinaDestino = await this.prisma.usina.findUnique({
      where: { id: dto.usinaDestinoId, ...tenantFilter },
    });
    if (!usinaDestino) {
      throw new NotFoundException('Usina destino não encontrada.');
    }

    // Buscar todos os contratos ativos da usina origem
    const contratosAtivos = await this.prisma.contrato.findMany({
      where: {
        usinaId: dto.usinaOrigemId,
        status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
      },
      include: { cooperado: true },
    });

    if (contratosAtivos.length === 0) {
      throw new BadRequestException(
        'Nenhum contrato ativo na usina origem para migrar.',
      );
    }

    const resultados: { cooperadoId: string; nome: string; sucesso: boolean; erro?: string }[] = [];

    for (const contrato of contratosAtivos) {
      try {
        const kwhMensal = Number(contrato.kwhContrato ?? 0);
        await this.migrarCooperado({
          cooperadoId: contrato.cooperadoId,
          usinaDestinoId: dto.usinaDestinoId,
          kwhNovo: kwhMensal > 0 ? kwhMensal : undefined,
          percentualNovo: kwhMensal <= 0 ? Number(contrato.percentualUsina ?? 0) : undefined,
          motivo: dto.motivo ?? `Migração total da usina ${usinaOrigem.nome}`,
          realizadoPorId: dto.realizadoPorId,
          cooperativaId: dto.cooperativaId,
        });

        resultados.push({
          cooperadoId: contrato.cooperadoId,
          nome: contrato.cooperado.nomeCompleto,
          sucesso: true,
        });

        // MIG-02: throttle de 500ms entre iterações para evitar sobrecarga no DB/WA
        await new Promise((r) => setTimeout(r, 500));
      } catch (e: any) {
        resultados.push({
          cooperadoId: contrato.cooperadoId,
          nome: contrato.cooperado.nomeCompleto,
          sucesso: false,
          erro: e?.message ?? 'Erro desconhecido',
        });
      }
    }

    // Gerar listas finais
    const [listaOrigem, listaDestino] = await Promise.all([
      this.usinasService.gerarListaConcessionaria(dto.usinaOrigemId),
      this.usinasService.gerarListaConcessionaria(dto.usinaDestinoId),
    ]);

    return {
      total: contratosAtivos.length,
      sucesso: resultados.filter((r) => r.sucesso).length,
      falhas: resultados.filter((r) => !r.sucesso),
      detalhes: resultados,
      listaOrigem,
      listaDestino,
    };
  }

  /**
   * Gera lista para concessionária de uma usina (CSV + JSON).
   */
  async gerarListaConcessionaria(usinaId: string, cooperativaId?: string | null) {
    const usina = await this.prisma.usina.findUnique({
      where: { id: usinaId },
    });
    if (!usina) throw new NotFoundException('Usina não encontrada.');

    // SEC-05: validar que a usina pertence à cooperativa do usuário logado
    if (cooperativaId && usina.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Sem acesso a esta usina.');
    }

    const contratos = await this.prisma.contrato.findMany({
      where: { usinaId, status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] } },
      include: { cooperado: true, uc: true },
    });

    const capacidade = Number(usina.capacidadeKwh ?? 0);

    const json = contratos.map((c) => {
      const kwh = Number(c.kwhContrato ?? 0);
      const percentual = c.percentualUsina
        ? Number(c.percentualUsina)
        : capacidade > 0
          ? Math.round((kwh / capacidade) * 10000) / 100
          : 0;
      return {
        nomeCompleto: c.cooperado.nomeCompleto,
        cpf: c.cooperado.cpf,
        numeroUC: (c.uc as any)?.numero ?? '',
        kwhContratado: kwh,
        percentualUsina: percentual,
        dataInicio: c.dataInicio,
        contrato: c.numero,
      };
    });

    // CSV
    const header =
      'Nome,CPF,Numero UC,kWh Contratado,% Participacao,Data Inicio,Contrato';
    const rows = json.map(
      (c) =>
        `"${c.nomeCompleto}","${c.cpf}","${c.numeroUC}",${c.kwhContratado},${c.percentualUsina},"${c.dataInicio ? new Date(c.dataInicio).toLocaleDateString('pt-BR') : ''}","${c.contrato}"`,
    );
    const csv = [header, ...rows].join('\n');

    const totalKwh = json.reduce((acc, c) => acc + c.kwhContratado, 0);

    return {
      csv,
      json,
      totalCooperados: json.length,
      totalKwh,
      usina: {
        id: usina.id,
        nome: usina.nome,
        capacidadeKwh: capacidade,
      },
    };
  }

  /**
   * Gera relatório dual para concessionária (2 usinas).
   */
  async gerarRelatorioDualLista(usinaOrigemId: string, usinaDestinoId: string, cooperativaId?: string | null) {
    const [listaOrigem, listaDestino] = await Promise.all([
      this.gerarListaConcessionaria(usinaOrigemId, cooperativaId),
      this.gerarListaConcessionaria(usinaDestinoId, cooperativaId),
    ]);
    return { listaOrigem, listaDestino };
  }

  /**
   * Histórico de migrações de um cooperado.
   * SEC-05: filtrado por cooperativaId quando presente (ADMIN/OPERADOR).
   */
  async historicoCooperado(cooperadoId: string, cooperativaId?: string | null) {
    return this.prisma.migracaoUsina.findMany({
      where: {
        cooperadoId,
        ...(cooperativaId ? { cooperativaId } : {}),
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  /**
   * Histórico de migrações envolvendo uma usina.
   * SEC-05: filtrado por cooperativaId quando presente (ADMIN/OPERADOR).
   */
  async historicoUsina(usinaId: string, cooperativaId?: string | null) {
    return this.prisma.migracaoUsina.findMany({
      where: {
        OR: [{ usinaOrigemId: usinaId }, { usinaDestinoId: usinaId }],
        ...(cooperativaId ? { cooperativaId } : {}),
      },
      orderBy: { criadoEm: 'desc' },
    });
  }
}
