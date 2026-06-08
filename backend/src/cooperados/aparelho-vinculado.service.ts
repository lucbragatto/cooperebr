/**
 * AparelhoVinculadoService — Sprint Token-WA Fase 2 (F2.4, 07/06/2026).
 *
 * Gerencia o vínculo persistente entre Cooperado e número de WhatsApp pra
 * autorizar transações CooperToken. Defesa contra SIM-swap, troca de
 * aparelho, sequestro de número.
 *
 * Fluxo de ativação (2 passos):
 *   1. iniciarAtivacao: cria OtpDesafio motivo=COOPERADO_DEVICE_BIND,
 *      envia código via WhatsApp pro número do cooperado (lado WA).
 *   2. confirmarAtivacao: cooperado confirma código no portal web; backend
 *      valida OTP + revoga aparelho anterior (mesma cooperado, telefone) +
 *      cria registro AparelhoVinculado novo ATIVO.
 *
 * Outros métodos:
 * - buscarAtivo: retorna aparelho ATIVO pra (cooperado, telefone) ou null
 * - revogar: revoga manual (admin ou usuário)
 * - registrarUso: heartbeat informal (usadoEm = now)
 *
 * Multi-tenant: TODA query filtra cooperativaId (anti-IDOR).
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { OtpDesafioService } from '../common/security/otp-desafio.service';

const E164_BR_REGEX = /^55\d{10,11}$/;

export type MotivoRevogacao =
  | 'SIM_SWAP_DETECTED'
  | 'TROCA_APARELHO'
  | 'USUARIO_REVOGOU'
  | 'ADMIN_REVOGOU';

export interface IniciarAtivacaoParams {
  cooperadoId: string;
  cooperativaId: string;
  numeroTelefone: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface IniciarAtivacaoResult {
  desafioId: string;
  codigo: string;
  expiresAt: Date;
  telefoneDestino: string;
}

export interface ConfirmarAtivacaoParams {
  desafioId: string;
  codigo: string;
  cooperadoId: string;
  cooperativaId: string;
  numeroTelefone: string;
  pushName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export interface ConfirmarAtivacaoResult {
  aparelhoId: string;
  ativadoEm: Date;
  aparelhoAnteriorRevogadoId: string | null;
}

@Injectable()
export class AparelhoVinculadoService {
  private readonly logger = new Logger(AparelhoVinculadoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otpDesafios: OtpDesafioService,
  ) {}

  /**
   * Passo 1 — gera OTP pra ativação de aparelho. Retorna `codigo` plain pra
   * quem chama enviar via WhatsApp (NÃO loga código). `numeroTelefone` E.164
   * BR deve bater com `Cooperado.telefone` (assertion no service).
   */
  async iniciarAtivacao(params: IniciarAtivacaoParams): Promise<IniciarAtivacaoResult> {
    const { cooperadoId, cooperativaId, numeroTelefone } = params;

    if (!E164_BR_REGEX.test(numeroTelefone)) {
      throw new BadRequestException(
        'numeroTelefone deve estar em formato E.164 BR (ex: 5527981341348).',
      );
    }

    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: cooperadoId, cooperativaId },
      select: { id: true, telefone: true },
    });

    if (!cooperado) {
      throw new NotFoundException('Cooperado não encontrado.');
    }

    if (cooperado.telefone !== numeroTelefone) {
      throw new ForbiddenException(
        'numeroTelefone não bate com o telefone cadastrado do cooperado.',
      );
    }

    const desafio = await this.otpDesafios.criarDesafio({
      motivo: 'COOPERADO_DEVICE_BIND',
      sujeitoTipo: 'COOPERADO',
      sujeitoId: cooperadoId,
      cooperativaId, // F2.9 hardening
      telefoneDestino: numeroTelefone,
      criadoPorIp: params.ip ?? null,
      criadoPorUserAgent: params.userAgent ?? null,
    });

    return {
      desafioId: desafio.desafioId,
      codigo: desafio.codigo,
      expiresAt: desafio.expiresAt,
      telefoneDestino: numeroTelefone,
    };
  }

  /**
   * Passo 2 — confirma OTP + revoga aparelho anterior + cria novo. Atômico
   * via $transaction. Idempotência: se o desafio já foi validado, lança
   * BadRequest (não cria 2 vínculos).
   */
  async confirmarAtivacao(params: ConfirmarAtivacaoParams): Promise<ConfirmarAtivacaoResult> {
    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: params.cooperadoId, cooperativaId: params.cooperativaId },
      select: { id: true, telefone: true },
    });
    if (!cooperado) {
      throw new NotFoundException('Cooperado não encontrado.');
    }
    if (cooperado.telefone !== params.numeroTelefone) {
      throw new ForbiddenException(
        'numeroTelefone não bate com o telefone cadastrado do cooperado.',
      );
    }

    await this.otpDesafios.validarOuLancar({
      desafioId: params.desafioId,
      codigo: params.codigo,
      cooperativaId: params.cooperativaId, // F2.9 hardening
      validadoPorIp: params.ip ?? null,
    });

    const resultado = await this.prisma.$transaction(async (tx) => {
      const ativoAnterior = await tx.aparelhoVinculado.findFirst({
        where: {
          cooperadoId: params.cooperadoId,
          numeroTelefone: params.numeroTelefone,
          revogadoEm: null,
        },
        select: { id: true },
      });

      if (ativoAnterior) {
        await tx.aparelhoVinculado.update({
          where: { id: ativoAnterior.id },
          data: {
            revogadoEm: new Date(),
            motivoRevogacao: 'TROCA_APARELHO',
          },
        });
      }

      const novo = await tx.aparelhoVinculado.create({
        data: {
          cooperadoId: params.cooperadoId,
          cooperativaId: params.cooperativaId,
          numeroTelefone: params.numeroTelefone,
          pushName: params.pushName ?? null,
          ipAtivacao: params.ip ?? null,
          userAgentAtivacao: params.userAgent ?? null,
        },
        select: { id: true, ativadoEm: true },
      });

      return {
        aparelhoId: novo.id,
        ativadoEm: novo.ativadoEm,
        aparelhoAnteriorRevogadoId: ativoAnterior?.id ?? null,
      };
    });

    this.logger.log(
      `[aparelho] Ativado aparelhoId=${resultado.aparelhoId} cooperadoId=${params.cooperadoId} anteriorRevogado=${resultado.aparelhoAnteriorRevogadoId ?? 'none'}`,
    );

    return resultado;
  }

  /**
   * Retorna aparelho ATIVO (revogadoEm=null) pra (cooperado, telefone) ou null.
   * Usado por TokenTransacaoService (Fase 3) pra exigir vínculo antes de QR.
   */
  async buscarAtivo(params: {
    cooperadoId: string;
    numeroTelefone: string;
    cooperativaId: string;
  }) {
    return this.prisma.aparelhoVinculado.findFirst({
      where: {
        cooperadoId: params.cooperadoId,
        cooperativaId: params.cooperativaId,
        numeroTelefone: params.numeroTelefone,
        revogadoEm: null,
      },
    });
  }

  /**
   * Revoga aparelho (admin ou usuário). Retorna aparelho revogado ou null
   * se já estava revogado / não encontrado.
   */
  async revogar(params: {
    aparelhoId: string;
    cooperativaId: string;
    motivo: MotivoRevogacao;
  }) {
    const aparelho = await this.prisma.aparelhoVinculado.findFirst({
      where: { id: params.aparelhoId, cooperativaId: params.cooperativaId },
      select: { id: true, revogadoEm: true },
    });

    if (!aparelho) {
      throw new NotFoundException('Aparelho não encontrado.');
    }

    if (aparelho.revogadoEm) {
      return null;
    }

    // F2.9 hardening: updateMany com cooperativaId (anti-IDOR defesa em prof).
    await this.prisma.aparelhoVinculado.updateMany({
      where: { id: aparelho.id, cooperativaId: params.cooperativaId },
      data: {
        revogadoEm: new Date(),
        motivoRevogacao: params.motivo,
      },
    });
    return this.prisma.aparelhoVinculado.findUnique({ where: { id: aparelho.id } });
  }

  /**
   * Heartbeat informal — registra última operação feita pelo aparelho.
   * F2.9 hardening (08/06/2026): cooperativaId vira OBRIGATÓRIO (era só
   * aparelhoId). Path "alta frequência" não justifica IDOR.
   */
  async registrarUso(aparelhoId: string, cooperativaId: string): Promise<void> {
    await this.prisma.aparelhoVinculado.updateMany({
      where: { id: aparelhoId, cooperativaId },
      data: { usadoEm: new Date() },
    });
  }

  /**
   * Lista aparelhos do cooperado (ativos + revogados pra histórico).
   */
  async listarDoCooperado(params: {
    cooperadoId: string;
    cooperativaId: string;
    incluirRevogados?: boolean;
  }) {
    return this.prisma.aparelhoVinculado.findMany({
      where: {
        cooperadoId: params.cooperadoId,
        cooperativaId: params.cooperativaId,
        ...(params.incluirRevogados ? {} : { revogadoEm: null }),
      },
      orderBy: { ativadoEm: 'desc' },
    });
  }
}
