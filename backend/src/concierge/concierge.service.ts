import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FaturaAdapterRegistry } from './fatura-canonica/registry';
import { DetectoresRegistry } from './detectores/detectores.registry';
import type {
  FaturaRawInput,
  FaturaCanonica,
} from './fatura-canonica/fatura-canonica.types';
import type { ResultadoConsolidadoDetectores } from './detectores/detectores.registry';

/**
 * Service do modulo Concierge - auditor tributario.
 *
 * Sprint MVP (11/06/2026): 3 metodos publicos:
 *  - verificarModuloAtivo: gate boolean por cooperativa.
 *  - listarAuditaveis: cooperados com fatura processada elegiveis pra auditoria.
 *  - previewDiagnostico: roda adapter + detectores in-memory (nao persiste).
 *
 * Persistencia em DiagnosticoIndebito vira Sprint C4 (orquestrador).
 */
@Injectable()
export class ConciergeService {
  private readonly logger = new Logger(ConciergeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapterRegistry: FaturaAdapterRegistry,
    private readonly detectoresRegistry: DetectoresRegistry,
  ) {}

  /**
   * Verifica se a cooperativa tem o modulo Concierge ativo.
   * SUPER_ADMIN bypassa - sempre retorna true pra inspecao.
   */
  async verificarModuloAtivo(
    cooperativaId: string,
    isSuperAdmin = false,
  ): Promise<boolean> {
    if (isSuperAdmin) return true;
    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { moduloConciergeAtivo: true },
    });
    return coop?.moduloConciergeAtivo ?? false;
  }

  /**
   * Lista cooperados com pelo menos 1 fatura processada elegivel pra auditoria.
   * Multi-tenant: SEMPRE filtra por cooperativaId.
   */
  async listarAuditaveis(cooperativaId: string): Promise<
    Array<{
      cooperadoId: string;
      nome: string;
      email: string | null;
      qtdFaturasProcessadas: number;
      ultimaFaturaMes: string | null;
    }>
  > {
    const cooperados = await this.prisma.cooperado.findMany({
      where: {
        cooperativaId,
        ucs: {
          some: {
            faturasProcessadas: { some: {} },
          },
        },
      },
      select: {
        id: true,
        nome: true,
        email: true,
        ucs: {
          select: {
            faturasProcessadas: {
              select: { mesReferencia: true },
              orderBy: { mesReferencia: 'desc' },
              take: 1,
            },
            _count: { select: { faturasProcessadas: true } },
          },
        },
      },
      orderBy: { nome: 'asc' },
    });

    return cooperados.map((c) => {
      const totalFaturas = c.ucs.reduce(
        (acc, uc) => acc + uc._count.faturasProcessadas,
        0,
      );
      const ultimoMes = c.ucs
        .flatMap((uc) => uc.faturasProcessadas)
        .sort((a, b) => b.mesReferencia.localeCompare(a.mesReferencia))[0]
        ?.mesReferencia ?? null;
      return {
        cooperadoId: c.id,
        nome: c.nome,
        email: c.email,
        qtdFaturasProcessadas: totalFaturas,
        ultimaFaturaMes: ultimoMes,
      };
    });
  }

  /**
   * Preview do diagnostico de indebito (in-memory, nao persiste).
   * Aceita rubricas + metadados manuais OU rubricas extraidas de FaturaProcessada.
   */
  previewDiagnostico(
    input: FaturaRawInput,
    distribuidora: 'EDP_ES' | 'ELFSM' | 'ENERGISA_TO' | string,
  ): {
    fatura: FaturaCanonica | null;
    resultado: ResultadoConsolidadoDetectores | null;
    erro?: string;
  } {
    const adapter = this.adapterRegistry.obterAdapter(distribuidora as any);
    if (!adapter) {
      return {
        fatura: null,
        resultado: null,
        erro: `Adapter nao encontrado para distribuidora ${distribuidora}`,
      };
    }

    const resultadoAdapter = adapter.parsear(input);
    if (!resultadoAdapter.sucesso) {
      return {
        fatura: null,
        resultado: null,
        erro: `${resultadoAdapter.motivo}: ${resultadoAdapter.detalhe}`,
      };
    }

    const resultado = this.detectoresRegistry.detectarTodos(resultadoAdapter.fatura);
    return { fatura: resultadoAdapter.fatura, resultado };
  }

  /**
   * Habilita ou desabilita o modulo Concierge pra uma cooperativa.
   * Apenas SUPER_ADMIN deve poder chamar (guard no controller).
   */
  async alterarStatusModulo(
    cooperativaId: string,
    ativar: boolean,
  ): Promise<{ id: string; moduloConciergeAtivo: boolean; conciergeAtivadoEm: Date | null }> {
    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { id: true, moduloConciergeAtivo: true, conciergeAtivadoEm: true },
    });
    if (!coop) {
      throw new NotFoundException('Cooperativa nao encontrada');
    }
    if (coop.moduloConciergeAtivo === ativar) {
      return {
        id: coop.id,
        moduloConciergeAtivo: coop.moduloConciergeAtivo,
        conciergeAtivadoEm: coop.conciergeAtivadoEm,
      };
    }

    const updated = await this.prisma.cooperativa.update({
      where: { id: cooperativaId },
      data: {
        moduloConciergeAtivo: ativar,
        conciergeAtivadoEm: ativar ? new Date() : null,
      },
      select: {
        id: true,
        moduloConciergeAtivo: true,
        conciergeAtivadoEm: true,
      },
    });

    this.logger.log(
      `[concierge] modulo ${ativar ? 'ATIVADO' : 'DESATIVADO'} pra cooperativa ${cooperativaId}`,
    );
    return updated;
  }

  /**
   * Lista cooperativas com modulo Concierge ativo (uso SUPER_ADMIN).
   */
  async listarCooperativasComConcierge(): Promise<
    Array<{ id: string; nome: string; ativadoEm: Date | null }>
  > {
    const lista = await this.prisma.cooperativa.findMany({
      where: { moduloConciergeAtivo: true },
      select: { id: true, nome: true, conciergeAtivadoEm: true },
      orderBy: { nome: 'asc' },
    });
    return lista.map((c) => ({
      id: c.id,
      nome: c.nome,
      ativadoEm: c.conciergeAtivadoEm,
    }));
  }

  /**
   * Helper - bota guard de modulo ativo no inicio de handlers.
   */
  async assertModuloAtivoOrThrow(
    cooperativaId: string,
    isSuperAdmin = false,
  ): Promise<void> {
    const ativo = await this.verificarModuloAtivo(cooperativaId, isSuperAdmin);
    if (!ativo) {
      throw new ForbiddenException(
        'Modulo Concierge nao esta ativo pra esta cooperativa. Solicite ativacao ao administrador SISGD.',
      );
    }
  }
}
