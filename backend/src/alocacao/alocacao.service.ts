import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StatusAlocacaoOtima } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AlocacaoEngineService, AlocacaoSnapshot } from './alocacao-engine.service';

@Injectable()
export class AlocacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: AlocacaoEngineService,
  ) {}

  /**
   * Simula uma nova alocação otimizada pra cooperativa, gravando o snapshot
   * em `AlocacaoOtima` com status `SUGERIDA`.
   */
  async simular(args: { cooperativaId: string; userId?: string | null }) {
    const { cooperativaId, userId } = args;
    const snapshot = await this.engine.simular(cooperativaId);
    return this.prisma.alocacaoOtima.create({
      data: {
        cooperativaId,
        snapshot: snapshot as unknown as object,
        status: 'SUGERIDA',
        geradaPorUserId: userId ?? null,
      },
    });
  }

  /**
   * Lista alocações otimas (paginadas) com filtros opcionais.
   * `cooperativaId=null` é SUPER_ADMIN (sem filtro de tenant).
   */
  async listar(args: {
    cooperativaId: string | null;
    status?: StatusAlocacaoOtima;
    take?: number;
  }) {
    const { cooperativaId, status, take = 50 } = args;
    return this.prisma.alocacaoOtima.findMany({
      where: {
        ...(cooperativaId ? { cooperativaId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { calculadaEm: 'desc' },
      take: Math.min(100, Math.max(1, take)),
    });
  }

  async obter(id: string, cooperativaId: string | null) {
    const alocacao = await this.prisma.alocacaoOtima.findUnique({ where: { id } });
    if (!alocacao) {
      throw new NotFoundException('Alocação não encontrada.');
    }
    if (cooperativaId && alocacao.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Alocação não pertence à sua cooperativa.');
    }
    return alocacao;
  }

  /**
   * Aplica caso-a-caso: admin escolhe quais contratos da sugestão aprovar.
   * Cada realocação aprovada faz UPDATE `Contrato.usinaId` em transação.
   */
  async aplicar(args: {
    id: string;
    contratoIds: string[];
    userId: string;
    cooperativaId: string | null;
  }) {
    const { id, contratoIds, userId, cooperativaId } = args;
    if (!contratoIds || contratoIds.length === 0) {
      throw new BadRequestException('Selecione pelo menos 1 contrato pra aplicar.');
    }
    const alocacao = await this.obter(id, cooperativaId);
    if (alocacao.status === 'DESCARTADA' || alocacao.status === 'APROVADA_TOTAL') {
      throw new BadRequestException(`Alocação em estado final (${alocacao.status}) — não pode ser aplicada.`);
    }

    const snapshot = alocacao.snapshot as unknown as AlocacaoSnapshot;
    const realocacoesValidas = (snapshot.realocacoes ?? []).filter((r) =>
      contratoIds.includes(r.contratoId),
    );
    if (realocacoesValidas.length === 0) {
      throw new BadRequestException('Nenhuma realocação válida selecionada (IDs não constam no snapshot).');
    }

    const totalRealocacoesSnapshot = (snapshot.realocacoes ?? []).length;
    const totalAprovadasAcumulado = alocacao.aprovadasContratoIds.length + realocacoesValidas.length;

    const resultado = await this.prisma.$transaction(async (tx) => {
      for (const r of realocacoesValidas) {
        await tx.contrato.update({
          where: { id: r.contratoId },
          data: { usinaId: r.usinaSugeridaId },
        });
      }
      const novoStatus: StatusAlocacaoOtima =
        totalAprovadasAcumulado >= totalRealocacoesSnapshot ? 'APROVADA_TOTAL' : 'APROVADA_PARCIAL';

      return tx.alocacaoOtima.update({
        where: { id },
        data: {
          status: novoStatus,
          aprovadasContratoIds: { set: Array.from(new Set([...alocacao.aprovadasContratoIds, ...contratoIds])) },
          aprovadaPorUserId: userId,
          aplicadaEm: new Date(),
        },
      });
    });

    return resultado;
  }

  async descartar(args: { id: string; motivo?: string | null; cooperativaId: string | null }) {
    const { id, motivo, cooperativaId } = args;
    const alocacao = await this.obter(id, cooperativaId);
    if (alocacao.status === 'DESCARTADA') return alocacao;
    return this.prisma.alocacaoOtima.update({
      where: { id },
      data: {
        status: 'DESCARTADA',
        observacoes: motivo ?? alocacao.observacoes,
      },
    });
  }
}
