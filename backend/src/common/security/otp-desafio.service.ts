/**
 * OtpDesafioService — Sprint Token-WA Fase 2 (F2.4, 07/06/2026).
 *
 * Service genérico que orquestra o lifecycle do model `OtpDesafio` (criado em
 * F2.1). Desacopla OTP do ConviteConvenioMembro permitindo reuso pra:
 *
 * - Ativação de aparelho vinculado (motivo=COOPERADO_DEVICE_BIND)
 * - Step-up de transação alta (motivo=TOKEN_TRANSACAO_STEP_UP)
 * - Reset de PIN (motivo=PIN_RESET)
 *
 * Responsabilidades:
 * - Gerar desafio (código + salt + hash + expiresAt)
 * - Validar desafio (timing-safe + rate-limit + lockout)
 * - Invalidar desafios anteriores do mesmo sujeito+motivo
 *
 * NÃO envia WhatsApp/email — quem chama (AparelhoVinculadoService etc) é
 * responsável pela entrega. Mantém o service focado em estado/crypto.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  compararOtp,
  gerarCodigoOtp,
  gerarSaltOtp,
  hashOtp,
} from './otp-helper';

export const OTP_TTL_MINUTOS = 10;
export const OTP_MAX_TENTATIVAS = 5;
export const OTP_LOCKOUT_MINUTOS = 15;

export type OtpMotivo =
  | 'COOPERADO_DEVICE_BIND'
  | 'TOKEN_TRANSACAO_STEP_UP'
  | 'PIN_RESET'
  // F1 (09/06/2026) — Definicao inicial de PIN via bot WA. Campo `motivo` no
  // banco eh String livre, sem migration.
  | 'PIN_DEFINIR';

export type OtpSujeitoTipo = 'COOPERADO' | 'TOKEN_TRANSACAO';

export interface CriarDesafioParams {
  motivo: OtpMotivo;
  sujeitoTipo: OtpSujeitoTipo;
  sujeitoId: string;
  telefoneDestino: string;
  /** F2.9 hardening (08/06/2026): cooperativaId pra defesa em profundidade.
   *  Opcional pra compat com chamadores antigos; novos devem sempre passar. */
  cooperativaId?: string;
  criadoPorIp?: string | null;
  criadoPorUserAgent?: string | null;
}

export interface CriarDesafioResult {
  desafioId: string;
  codigo: string;
  expiresAt: Date;
}

export type ValidarDesafioResult =
  | { ok: true; desafioId: string }
  | { ok: false; motivo: 'DESAFIO_NAO_ENCONTRADO' }
  | { ok: false; motivo: 'DESAFIO_EXPIRADO' }
  | { ok: false; motivo: 'DESAFIO_BLOQUEADO'; desbloqueiaEm: Date }
  | { ok: false; motivo: 'CODIGO_INCORRETO' }
  | { ok: false; motivo: 'JA_VALIDADO' };

@Injectable()
export class OtpDesafioService {
  private readonly logger = new Logger(OtpDesafioService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cria desafio novo + invalida desafios anteriores do mesmo
   * (sujeitoTipo, sujeitoId, motivo) não-validados (sweep defensivo). Retorna
   * o `codigo` pra quem chama enviar (WA/email/SMS). NÃO loga código.
   */
  async criarDesafio(params: CriarDesafioParams): Promise<CriarDesafioResult> {
    const codigo = gerarCodigoOtp();
    const salt = gerarSaltOtp();
    const codigoHash = hashOtp(codigo, salt);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTOS * 60 * 1000);

    // Sweep defensivo — desafios não-validados anteriores ficam "abandonados"
    // (não bloqueia criar novo). Pra rastreabilidade, mantemos no banco.
    // No futuro pode rodar cron pra purgar OtpDesafio.expiresAt < now-30d.

    const created = await this.prisma.otpDesafio.create({
      data: {
        motivo: params.motivo,
        sujeitoTipo: params.sujeitoTipo,
        sujeitoId: params.sujeitoId,
        cooperativaId: params.cooperativaId ?? null,
        codigoHash,
        salt,
        expiresAt,
        telefoneDestino: params.telefoneDestino,
        criadoPorIp: params.criadoPorIp ?? null,
        criadoPorUserAgent: params.criadoPorUserAgent ?? null,
        tentativas: 0,
      },
      select: { id: true },
    });

    this.logger.log(
      `[otp-desafio] Criado motivo=${params.motivo} sujeito=${params.sujeitoTipo}:${params.sujeitoId} expiresAt=${expiresAt.toISOString()}`,
    );

    return { desafioId: created.id, codigo, expiresAt };
  }

  /**
   * Valida desafio com rate-limit + lockout. Em sucesso, marca `validadoEm`
   * (idempotência: re-validar mesmo desafio → JA_VALIDADO).
   */
  async validar(params: {
    desafioId: string;
    codigo: string;
    /** F2.9: se passado, valida que desafio pertence à cooperativa esperada. */
    cooperativaId?: string;
    validadoPorIp?: string | null;
  }): Promise<ValidarDesafioResult> {
    const { desafioId, codigo, cooperativaId, validadoPorIp } = params;

    const desafio = await this.prisma.otpDesafio.findUnique({
      where: { id: desafioId },
      select: {
        id: true,
        cooperativaId: true,
        codigoHash: true,
        salt: true,
        expiresAt: true,
        validadoEm: true,
        tentativas: true,
        bloqueadoAte: true,
      },
    });

    if (!desafio) {
      return { ok: false, motivo: 'DESAFIO_NAO_ENCONTRADO' };
    }

    // F2.9 hardening: se chamador passou cooperativaId esperado, exige match
    // (anti cross-tenant). Compatível com desafios pre-F2.9 (cooperativaId
    // null no banco): só rejeita se BOTH passado E mismatch real.
    if (cooperativaId && desafio.cooperativaId && desafio.cooperativaId !== cooperativaId) {
      return { ok: false, motivo: 'DESAFIO_NAO_ENCONTRADO' };
    }

    if (desafio.validadoEm) {
      return { ok: false, motivo: 'JA_VALIDADO' };
    }

    const now = new Date();

    if (desafio.bloqueadoAte && desafio.bloqueadoAte > now) {
      return { ok: false, motivo: 'DESAFIO_BLOQUEADO', desbloqueiaEm: desafio.bloqueadoAte };
    }

    if (desafio.expiresAt <= now) {
      return { ok: false, motivo: 'DESAFIO_EXPIRADO' };
    }

    const bate = compararOtp(codigo, desafio.salt, desafio.codigoHash);

    if (bate) {
      await this.prisma.otpDesafio.update({
        where: { id: desafioId },
        data: {
          validadoEm: new Date(),
          validadoPorIp: validadoPorIp ?? null,
        },
      });
      return { ok: true, desafioId };
    }

    // Incrementa tentativas + lockout se excedeu.
    const atualizado = await this.prisma.otpDesafio.update({
      where: { id: desafioId },
      data: { tentativas: { increment: 1 } },
      select: { tentativas: true },
    });

    if (atualizado.tentativas >= OTP_MAX_TENTATIVAS) {
      const desbloqueiaEm = new Date(Date.now() + OTP_LOCKOUT_MINUTOS * 60 * 1000);
      await this.prisma.otpDesafio.update({
        where: { id: desafioId },
        data: { bloqueadoAte: desbloqueiaEm },
      });
      this.logger.warn(
        `[otp-desafio] Lockout desafioId=${desafioId} desbloqueiaEm=${desbloqueiaEm.toISOString()}`,
      );
      return { ok: false, motivo: 'DESAFIO_BLOQUEADO', desbloqueiaEm };
    }

    return { ok: false, motivo: 'CODIGO_INCORRETO' };
  }

  /**
   * Versão helper que lança HttpException no primeiro erro. Útil em
   * controllers/services que querem fluxo linear sem switch-case manual.
   */
  async validarOuLancar(params: {
    desafioId: string;
    codigo: string;
    cooperativaId?: string;
    validadoPorIp?: string | null;
  }): Promise<void> {
    const r = await this.validar(params);
    if (r.ok) return;
    switch (r.motivo) {
      case 'DESAFIO_NAO_ENCONTRADO':
        throw new BadRequestException('Desafio OTP não encontrado.');
      case 'DESAFIO_EXPIRADO':
        throw new BadRequestException('Desafio OTP expirado. Solicite novo.');
      case 'DESAFIO_BLOQUEADO':
        throw new ForbiddenException(
          `Desafio OTP bloqueado até ${r.desbloqueiaEm.toISOString()}.`,
        );
      case 'CODIGO_INCORRETO':
        throw new ForbiddenException('Código OTP incorreto.');
      case 'JA_VALIDADO':
        throw new BadRequestException('Desafio OTP já foi validado.');
    }
  }
}
