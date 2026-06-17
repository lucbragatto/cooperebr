import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import type { DisclaimerSaque } from '@prisma/client';
import { PrismaService } from '../prisma.service';

/**
 * Sprint D2.1 v2 (16/06/2026) — Disclaimer versionado e editável de
 * saque PIX do colaborador comum (Salvaguarda 5 do parecer de
 * conformidade analise-conformidade-2026-06-16-saque-colaborador-d2).
 *
 * Resolução: override do tenant > default global SISGD. Cooperado
 * sempre lê o disclaimer do SEU tenant via JWT.
 *
 * Edições:
 *  - SUPER_ADMIN edita o global (cooperativaId=null).
 *  - ADMIN edita só o override do PRÓPRIO tenant (cooperativaId do JWT
 *    forçado pelo controller — service NÃO aceita cooperativaId do body).
 *
 * Histórico inviolável: mutação NUNCA deleta linha. Cria nova ativa +
 * zera ativa anterior em tx Serializable atômica. Versão auto-gerada
 * server-side (v{seq}-{YYYY-MM-DD}) — cliente não escolhe.
 *
 * Rastro jurídico: cada ResgateRecibo aceito grava FK pro DisclaimerSaque
 * que estava ativo no momento. Mesmo após edições futuras, a versão
 * aceita continua recuperável (entry permanece ativo=false no banco).
 */
@Injectable()
export class DisclaimerSaqueService implements OnModuleInit {
  private readonly logger = new Logger(DisclaimerSaqueService.name);

  // Texto inicial aprovado pelo Luciano (16/06/2026).
  // SUPER_ADMIN edita depois via /saas/disclaimer-saque/global.
  private static readonly TEXTO_SEED_V1 = `Atenção — antes de continuar:

Este saque é a liquidação de um voucher CooperToken emitido pela cooperativa. Não é remuneração, salário, prêmio nem operação financeira.

O valor recebido pode precisar ser declarado no seu Imposto de Renda. A cooperativa não retém imposto neste fluxo — consulte um contador antes de declarar.

Ao continuar, você confirma que entende a natureza desta operação e que a responsabilidade pela declaração fiscal é sua.`;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seed idempotente — garante 1 entry global ativo no banco. Roda no
   * boot do módulo. Sem isso, getAtivo() pra qualquer tenant sem override
   * estoura (NotFound) e o saque do colaborador comum vira impossível.
   */
  async onModuleInit(): Promise<void> {
    const globalAtivo = await this.prisma.disclaimerSaque.findFirst({
      where: { cooperativaId: null, ativo: true },
    });
    if (globalAtivo) {
      this.logger.log(
        `[seed] global ativo já existe: id=${globalAtivo.id} versao=${globalAtivo.versao}`,
      );
      return;
    }
    // Busca usuário SUPER_ADMIN qualquer pra autoria do seed (fallback
    // 'SEED' literal se não houver — só primeira inicialização).
    const superAdmin = await this.prisma.usuario.findFirst({
      where: { perfil: 'SUPER_ADMIN' as any, ativo: true },
      select: { id: true },
    });
    const seed = await this.prisma.disclaimerSaque.create({
      data: {
        cooperativaId: null,
        versao: this.gerarVersao(null, 1),
        texto: DisclaimerSaqueService.TEXTO_SEED_V1,
        ativo: true,
        criadoPorUsuarioId: superAdmin?.id ?? 'SEED',
        criadoPorPerfil: 'SUPER_ADMIN',
      },
    });
    this.logger.log(
      `[seed] global criado: id=${seed.id} versao=${seed.versao} autor=${seed.criadoPorUsuarioId}`,
    );
  }

  /**
   * Resolução do disclaimer ativo pra um tenant.
   * Tenant override > global default. Se nenhum existir → throw.
   */
  async getAtivo(cooperativaId: string): Promise<DisclaimerSaque> {
    const override = await this.prisma.disclaimerSaque.findFirst({
      where: { cooperativaId, ativo: true },
    });
    if (override) return override;
    const global = await this.prisma.disclaimerSaque.findFirst({
      where: { cooperativaId: null, ativo: true },
    });
    if (!global) {
      throw new NotFoundException(
        'Nenhum disclaimer ativo configurado — bug operacional (seed não rodou?).',
      );
    }
    return global;
  }

  /**
   * Resolução com origem (pra UI distinguir tenant override × global default).
   */
  async getAtivoComOrigem(cooperativaId: string): Promise<{
    disclaimer: DisclaimerSaque;
    origem: 'TENANT' | 'GLOBAL';
  }> {
    const override = await this.prisma.disclaimerSaque.findFirst({
      where: { cooperativaId, ativo: true },
    });
    if (override) return { disclaimer: override, origem: 'TENANT' };
    const global = await this.prisma.disclaimerSaque.findFirst({
      where: { cooperativaId: null, ativo: true },
    });
    if (!global) {
      throw new NotFoundException(
        'Nenhum disclaimer ativo configurado — bug operacional.',
      );
    }
    return { disclaimer: global, origem: 'GLOBAL' };
  }

  /**
   * Histórico completo de um escopo (global OU tenant específico).
   * NUNCA vaza entre tenants. NUNCA lista entries de OUTRO tenant.
   */
  async listarHistorico(
    cooperativaId: string | null,
  ): Promise<DisclaimerSaque[]> {
    return this.prisma.disclaimerSaque.findMany({
      where: { cooperativaId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Cria nova versão GLOBAL (SUPER_ADMIN only). Tx Serializable:
   *   1. Zera ativa anterior (ativo=true → ativo=false).
   *   2. Cria nova ativa.
   * Histórico preservado (anterior ativa=false fica no banco).
   *
   * @throws BadRequest se texto vazio ou só whitespace.
   */
  async criarGlobal(input: {
    texto: string;
    criadoPorUsuarioId: string;
  }): Promise<DisclaimerSaque> {
    this.validarTexto(input.texto);
    return this.prisma.$transaction(async (tx) => {
      // Conta quantas versões já existiram (pra gerar seq).
      const totalExistentes = await tx.disclaimerSaque.count({
        where: { cooperativaId: null },
      });
      const versao = this.gerarVersao(null, totalExistentes + 1);

      // Zera ativa anterior (se houver).
      await tx.disclaimerSaque.updateMany({
        where: { cooperativaId: null, ativo: true },
        data: { ativo: false },
      });

      const nova = await tx.disclaimerSaque.create({
        data: {
          cooperativaId: null,
          versao,
          texto: input.texto.trim(),
          ativo: true,
          criadoPorUsuarioId: input.criadoPorUsuarioId,
          criadoPorPerfil: 'SUPER_ADMIN',
        },
      });
      this.logger.log(
        `[criar-global] versao=${nova.versao} autor=${nova.criadoPorUsuarioId}`,
      );
      return nova;
    });
  }

  /**
   * Cria override do TENANT (ADMIN do próprio tenant only). cooperativaId
   * SEMPRE vem do JWT do controller — service não aceita do body.
   */
  async criarTenantOverride(input: {
    cooperativaId: string;
    texto: string;
    criadoPorUsuarioId: string;
  }): Promise<DisclaimerSaque> {
    this.validarTexto(input.texto);
    if (!input.cooperativaId) {
      throw new BadRequestException(
        'cooperativaId obrigatório (vem do JWT do ADMIN — bug de wiring).',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const totalExistentes = await tx.disclaimerSaque.count({
        where: { cooperativaId: input.cooperativaId },
      });
      const versao = this.gerarVersao(input.cooperativaId, totalExistentes + 1);

      await tx.disclaimerSaque.updateMany({
        where: { cooperativaId: input.cooperativaId, ativo: true },
        data: { ativo: false },
      });

      const nova = await tx.disclaimerSaque.create({
        data: {
          cooperativaId: input.cooperativaId,
          versao,
          texto: input.texto.trim(),
          ativo: true,
          criadoPorUsuarioId: input.criadoPorUsuarioId,
          criadoPorPerfil: 'ADMIN',
        },
      });
      this.logger.log(
        `[criar-tenant] cooperativaId=${input.cooperativaId.slice(0, 8)}… versao=${nova.versao}`,
      );
      return nova;
    });
  }

  /**
   * Desativa o override ativo do tenant (volta a usar global default).
   * Marca ativo=false — NUNCA deleta. Histórico preservado pra recuperar
   * texto de recibos antigos via FK.
   *
   * @throws NotFound se não houver override ativo.
   */
  async desativarOverrideTenant(input: {
    cooperativaId: string;
    desativadoPorUsuarioId: string;
  }): Promise<{ desativado: boolean }> {
    const override = await this.prisma.disclaimerSaque.findFirst({
      where: { cooperativaId: input.cooperativaId, ativo: true },
    });
    if (!override) {
      throw new NotFoundException(
        'Tenant não tem override ativo — já está usando o global SISGD.',
      );
    }
    await this.prisma.disclaimerSaque.update({
      where: { id: override.id },
      data: { ativo: false },
    });
    this.logger.log(
      `[desativar-tenant] cooperativaId=${input.cooperativaId.slice(0, 8)}… ` +
        `versao=${override.versao} desativadoPor=${input.desativadoPorUsuarioId}`,
    );
    return { desativado: true };
  }

  /**
   * Recupera entry por id (pra recibo antigo conseguir mostrar texto
   * exato aceito — mesmo se ativo=false). Multi-tenant: filtra por
   * cooperativaId esperado (do escopo do consumidor).
   */
  async buscarPorId(input: {
    id: string;
    cooperativaIdEsperado?: string | null;
  }): Promise<DisclaimerSaque | null> {
    const found = await this.prisma.disclaimerSaque.findUnique({
      where: { id: input.id },
    });
    if (!found) return null;
    // Defesa multi-tenant: se cooperativaIdEsperado foi passado, valida.
    // null === null (global) e tenantId === tenantId. Cooperado lendo
    // recibo do seu tenant → cooperativaIdEsperado = JWT.cooperativaId,
    // entry pode ser desse tenant OU global (ambos válidos pra cooperado).
    if (
      input.cooperativaIdEsperado !== undefined &&
      found.cooperativaId !== null &&
      found.cooperativaId !== input.cooperativaIdEsperado
    ) {
      // Entry de OUTRO tenant — não vaza.
      return null;
    }
    return found;
  }

  // ── Helpers privados ──────────────────────────────────────────

  private validarTexto(texto: string): void {
    const trimmed = (texto ?? '').trim();
    if (trimmed.length < 50) {
      throw new BadRequestException(
        'Texto do disclaimer deve ter no mínimo 50 caracteres.',
      );
    }
    if (trimmed.length > 5000) {
      throw new BadRequestException(
        'Texto do disclaimer não pode passar de 5000 caracteres.',
      );
    }
    // Anti-XSS no v1: rejeita HTML tags (plain text + quebras de linha).
    // UI renderiza com whitespace-pre-line (não dangerouslySetInnerHTML).
    if (/<[^>]+>/.test(trimmed)) {
      throw new BadRequestException(
        'Texto plain text apenas — HTML tags não são permitidas (anti-XSS).',
      );
    }
  }

  /** Gera versão server-side: 'v{seq}-{YYYY-MM-DD}' global ou
   *  'tenant-v{seq}-{YYYY-MM-DD}' override. seq = nº de entries no escopo
   *  + 1. Garantia de unicidade pela auto-geração + tx atômica. */
  private gerarVersao(
    cooperativaId: string | null,
    seq: number,
  ): string {
    const data = new Date().toISOString().slice(0, 10);
    return cooperativaId === null
      ? `v${seq}-${data}`
      : `tenant-v${seq}-${data}`;
  }
}
