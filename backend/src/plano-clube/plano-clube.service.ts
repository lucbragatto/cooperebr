/**
 * Sprint Onboarding Bloco 0 Fatia 0.1 (06/06/2026).
 *
 * Service do PlanoClube. CRUD multi-tenant — TODAS as queries filtram por
 * cooperativaId. SUPER_ADMIN passa override; ADMIN usa o próprio.
 *
 * Regra semântica (espelha Plano Clube do produto, memória
 * decisao_plano_clube_mensalidade_06_06):
 *  - `cobra=true` exige `valorMensal > 0` (proteção produto: cobrar zero é
 *    inconsistente — admin esquecimento provável).
 *  - `cobra=false` aceita qualquer valor (clube grátis; valor é informativo).
 *
 * Soft-delete: `ativo=false`. Sem hard-delete via API (preserva auditoria;
 * vínculos em ContratoConvenio.planoClubeId e Cooperado.planoClubeId).
 */
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { CreatePlanoClubeDto } from './dto/create-plano-clube.dto';
import type { UpdatePlanoClubeDto } from './dto/update-plano-clube.dto';

@Injectable()
export class PlanoClubeService {
  private readonly logger = new Logger(PlanoClubeService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Lista PlanosClube da cooperativa. Por padrão retorna só ATIVOS; admin
   * passa `incluirInativos=true` se quer ver tudo (UI tela admin pode usar).
   */
  async listar(cooperativaId: string, opts: { incluirInativos?: boolean } = {}) {
    return this.prisma.planoClube.findMany({
      where: {
        cooperativaId,
        ...(opts.incluirInativos ? {} : { ativo: true }),
      },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
    });
  }

  async obter(id: string, cooperativaId: string) {
    const plano = await this.prisma.planoClube.findFirst({
      where: { id, cooperativaId },
    });
    if (!plano) {
      // 404 (não 403) — anti-enumeração cross-tenant.
      throw new NotFoundException('PlanoClube não encontrado.');
    }
    return plano;
  }

  async criar(dto: CreatePlanoClubeDto, cooperativaId: string) {
    this.validarSemantica({
      cobra: dto.cobra ?? true,
      valorMensal: dto.valorMensal,
    });

    const criado = await this.prisma.planoClube.create({
      data: {
        cooperativaId,
        nome: dto.nome.trim(),
        descricao: dto.descricao?.trim() || null,
        valorMensal: dto.valorMensal,
        cobra: dto.cobra ?? true,
        ativo: dto.ativo ?? true,
        tierMinimo: dto.tierMinimo || null,
      },
    });
    this.logger.log(
      `[plano-clube] Criado id=${criado.id} cooperativaId=${cooperativaId} nome="${criado.nome}" valorMensal=${criado.valorMensal.toString()} cobra=${criado.cobra}`,
    );
    return criado;
  }

  async atualizar(id: string, dto: UpdatePlanoClubeDto, cooperativaId: string) {
    // Pré-load multi-tenant — 404 se não pertencer ao tenant.
    const atual = await this.obter(id, cooperativaId);

    // Validação semântica usa o estado COMBINADO (atual + delta).
    const cobraFinal = dto.cobra ?? atual.cobra;
    const valorFinal = dto.valorMensal ?? Number(atual.valorMensal);
    this.validarSemantica({ cobra: cobraFinal, valorMensal: valorFinal });

    const atualizado = await this.prisma.planoClube.update({
      where: { id },
      data: {
        ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
        ...(dto.descricao !== undefined ? { descricao: dto.descricao?.trim() || null } : {}),
        ...(dto.valorMensal !== undefined ? { valorMensal: dto.valorMensal } : {}),
        ...(dto.cobra !== undefined ? { cobra: dto.cobra } : {}),
        ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
        ...(dto.tierMinimo !== undefined ? { tierMinimo: dto.tierMinimo || null } : {}),
      },
    });
    this.logger.log(
      `[plano-clube] Atualizado id=${id} cooperativaId=${cooperativaId} delta=${JSON.stringify(dto)}`,
    );
    return atualizado;
  }

  /**
   * Soft-delete: marca ativo=false. Preserva vínculos em ContratoConvenio
   * e Cooperado pra integridade histórica (cobranças passadas continuam
   * referenciando o plano).
   */
  async desativar(id: string, cooperativaId: string) {
    await this.obter(id, cooperativaId);
    return this.prisma.planoClube.update({
      where: { id },
      data: { ativo: false },
    });
  }

  /**
   * Validação semântica `cobra ⇒ valorMensal > 0`.
   * Lança BadRequestException com mensagem clara.
   */
  private validarSemantica(input: { cobra: boolean; valorMensal: number }) {
    if (input.cobra && input.valorMensal <= 0) {
      throw new BadRequestException(
        'Quando cobra=true, valorMensal deve ser > 0. Pra clube grátis, marque cobra=false.',
      );
    }
  }

  /**
   * Helper compartilhado pra outros services (Fatia 0.4 — cobranças
   * individual + consolidada). Resolve o PlanoClube e devolve só o que a
   * cobrança precisa: `valorMensal` numérico + `cobra` + nome (audit log).
   * Retorna null se id vazio/inexistente — caller decide se isso é erro.
   *
   * Multi-tenant: filtra por cooperativaId pra defesa em profundidade.
   */
  async resolverParaCobranca(
    planoClubeId: string | null | undefined,
    cooperativaId: string,
  ): Promise<{ id: string; valorMensal: number; cobra: boolean; nome: string } | null> {
    if (!planoClubeId) return null;
    const p = await this.prisma.planoClube.findFirst({
      where: { id: planoClubeId, cooperativaId, ativo: true },
      select: { id: true, valorMensal: true, cobra: true, nome: true },
    });
    if (!p) return null;
    return {
      id: p.id,
      valorMensal: Number(p.valorMensal),
      cobra: p.cobra,
      nome: p.nome,
    };
  }
}
