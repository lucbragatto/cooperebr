/**
 * Sprint Onboarding Bloco 0 Fatia 0.3 (06/06/2026).
 *
 * Service da adesão opt-in do Cooperado ao Clube. EXCLUSIVO do caminho
 * INDIVIDUAL — funcionário de conveniado NUNCA usa este campo (clube
 * dele é pago pela empresa via `ContratoConvenio.planoClubeId`, Fatia 0.2).
 *
 * REGRA INVARIANTE PRA EVITAR COBRANÇA DUPLA (Fatia 0.4):
 *  - aderir() BLOQUEIA quando o cooperado é membro ATIVO de algum
 *    `ContratoConvenio` que tenha `planoClubeId != null`. Funcionário
 *    custeado por convênio com clube → empresa já paga; setar o opt-in
 *    individual geraria 2x mensalidade.
 *
 * NÃO auto-inscreve ninguém. Regra "quem entra automático conforme config
 * da cooperativa" é Bloco 1 (matrícula via aprovação do convite).
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class CooperadoClubeService {
  private readonly logger = new Logger(CooperadoClubeService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Marca adesão do cooperado a um PlanoClube. Idempotente em re-vinculação:
   * passar o mesmo planoClubeId apenas atualiza `adesaoClubeEm`.
   *
   * Validações (em ordem):
   *  1. Cooperado existe + pertence ao tenant do admin.
   *  2. PlanoClube existe + ativo + mesmo tenant.
   *  3. Cooperado NÃO é membro ativo de convênio com clube (anti-duplo).
   */
  async aderir(input: {
    cooperadoId: string;
    planoClubeId: string;
    adminCooperativaId: string;
  }) {
    const { cooperadoId, planoClubeId, adminCooperativaId } = input;

    // 1. Multi-tenant: cooperado existe + mesmo tenant. 404 anti-enumeração.
    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: cooperadoId, cooperativaId: adminCooperativaId },
      select: {
        id: true,
        cooperativaId: true,
        nomeCompleto: true,
        planoClubeId: true,
        adesaoClubeEm: true,
      },
    });
    if (!cooperado) {
      throw new NotFoundException('Cooperado não encontrado.');
    }

    // 2. Plano ativo do mesmo tenant.
    const plano = await this.prisma.planoClube.findFirst({
      where: {
        id: planoClubeId,
        cooperativaId: adminCooperativaId,
      },
      select: { id: true, nome: true, ativo: true },
    });
    if (!plano) {
      throw new BadRequestException(
        'planoClubeId inválido ou pertence a outra cooperativa.',
      );
    }
    if (!plano.ativo) {
      throw new BadRequestException(
        'planoClubeId aponta pra um PlanoClube inativo. Reative o plano ou escolha outro.',
      );
    }

    // 3. INVARIANTE anti-cobrança-dupla: cooperado NÃO pode ser membro ATIVO
    //    de algum ContratoConvenio com planoClubeId setado (Fatia 0.2: empresa
    //    já paga). A regra "exclusiva" mora aqui — não em filtro frágil na
    //    Fatia 0.4 que poderia ser contornado por bug. Aqui bloqueia na fonte.
    const conflito = await this.prisma.convenioCooperado.findFirst({
      where: {
        cooperadoId,
        ativo: true,
        convenio: { planoClubeId: { not: null } },
      },
      select: {
        id: true,
        convenio: { select: { id: true, empresaNome: true, planoClubeId: true } },
      },
    });
    if (conflito) {
      throw new BadRequestException(
        `Cooperado é membro ativo do convênio "${conflito.convenio.empresaNome}" ` +
          `que já contrata o clube (a empresa paga). Adesão individual proibida ` +
          `pra evitar cobrança dupla. Pra trocar o canal, desligue o membro do ` +
          `convênio antes.`,
      );
    }

    // 4. Update — adesaoClubeEm sempre atualiza (re-vinculação refaz a data).
    const agora = new Date();
    const atualizado = await this.prisma.cooperado.update({
      where: { id: cooperadoId },
      data: {
        planoClubeId,
        adesaoClubeEm: agora,
      },
      select: {
        id: true,
        nomeCompleto: true,
        planoClubeId: true,
        adesaoClubeEm: true,
      },
    });

    this.logger.log(
      `[cooperado-clube] Adesão registrada: cooperadoId=${cooperadoId} ` +
        `planoClubeId=${planoClubeId} adminCoop=${adminCooperativaId}`,
    );
    return atualizado;
  }

  /**
   * Cancela adesão: zera planoClubeId + adesaoClubeEm.
   * Idempotente — chamar várias vezes não erra.
   */
  async cancelar(input: { cooperadoId: string; adminCooperativaId: string }) {
    const { cooperadoId, adminCooperativaId } = input;

    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: cooperadoId, cooperativaId: adminCooperativaId },
      select: { id: true, planoClubeId: true, adesaoClubeEm: true },
    });
    if (!cooperado) {
      throw new NotFoundException('Cooperado não encontrado.');
    }

    const atualizado = await this.prisma.cooperado.update({
      where: { id: cooperadoId },
      data: {
        planoClubeId: null,
        adesaoClubeEm: null,
      },
      select: {
        id: true,
        nomeCompleto: true,
        planoClubeId: true,
        adesaoClubeEm: true,
      },
    });

    this.logger.log(
      `[cooperado-clube] Adesão cancelada: cooperadoId=${cooperadoId} ` +
        `adminCoop=${adminCooperativaId}`,
    );
    return atualizado;
  }

  /**
   * Helper compartilhado pra Fatia 0.4 — devolve snapshot da adesão pra
   * decidir se cobrança individual leva linha de mensalidade.
   *
   * Retorna `null` quando cooperado não tem adesão OU quando adesão aponta
   * pra plano inativo OU cross-tenant. Multi-tenant filtra defensivamente.
   *
   * NÃO retorna nada quando `planoClube.cobra=false` — clube grátis não gera
   * linha (regra produto), mas chamamos isso "snapshot inativo de cobrança".
   * Caller (cobrancas.service.ts:212) trata null como "não somar".
   */
  async resolverParaCobrancaIndividual(
    cooperadoId: string,
    cooperativaId: string,
  ): Promise<{ planoClubeId: string; valorMensal: number; nome: string } | null> {
    const r = await this.prisma.cooperado.findFirst({
      where: { id: cooperadoId, cooperativaId },
      select: {
        planoClubeAdesao: {
          select: { id: true, valorMensal: true, cobra: true, ativo: true, nome: true },
        },
      },
    });
    const p = r?.planoClubeAdesao;
    if (!p || !p.ativo || !p.cobra) return null;
    return {
      planoClubeId: p.id,
      valorMensal: Number(p.valorMensal),
      nome: p.nome,
    };
  }
}
