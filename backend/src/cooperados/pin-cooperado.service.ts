/**
 * PinCooperadoService — Sprint Token-WA Fase 2 (F2.3, 07/06/2026).
 *
 * Gerencia o PIN de 6 dígitos do cooperado pra autorização de transações
 * CooperToken via WhatsApp. Camada de segurança espelhando o que existe pra
 * convite-convênio (OTP), mas persistente no Cooperado (não efêmero).
 *
 * Regras:
 * - PIN exatos 6 dígitos numéricos (validação no DTO + defensiva aqui).
 * - Hash sha256(pin + salt) com salt único por cooperado (não rotativo —
 *   roda só na definição; rotação requer alterarPin).
 * - Rate-limit: 5 tentativas falhas → lockout 15min (mesma janela ConviteConvenio).
 * - Multi-tenant: TODA query filtra por `cooperativaId` (anti-IDOR).
 * - Cooperado tenta validar PIN bloqueado → erro PIN_BLOQUEADO (não revela
 *   quantas tentativas restantes pra evitar enumeração).
 *
 * Não move dinheiro nem QR — só PIN. Camada acima (TokenTransacaoService,
 * Fase 3 fora deste sprint) consome este service.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { hashOtp } from '../common/security/otp-helper';

const MAX_TENTATIVAS = 5;
// F2.9 hardening (08/06/2026): lockout aumentado de 15 -> 30min.
const LOCKOUT_MINUTOS = 30;
const PIN_REGEX = /^\d{6}$/;

export type ValidarPinResult =
  | { ok: true }
  | { ok: false; motivo: 'PIN_NAO_DEFINIDO' }
  | { ok: false; motivo: 'PIN_BLOQUEADO'; desbloqueiaEm: Date }
  | { ok: false; motivo: 'PIN_INCORRETO' };

@Injectable()
export class PinCooperadoService {
  private readonly logger = new Logger(PinCooperadoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Define o PIN do cooperado pela primeira vez OU sobrescreve via fluxo de
   * reset autorizado. NÃO valida PIN anterior (use `alterarPin` pra isso).
   *
   * Anti-IDOR: filtra por cooperativaId (cooperado tenta definir PIN de outro
   * cooperado → 404, sem revelar existência).
   */
  async definirPin(params: {
    cooperadoId: string;
    pin: string;
    cooperativaId: string;
  }): Promise<void> {
    const { cooperadoId, pin, cooperativaId } = params;

    if (!PIN_REGEX.test(pin)) {
      throw new BadRequestException('PIN deve ter exatamente 6 dígitos numéricos.');
    }

    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: cooperadoId, cooperativaId },
      select: { id: true },
    });

    if (!cooperado) {
      throw new NotFoundException('Cooperado não encontrado.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const pinHash = hashOtp(pin, salt);

    // F2.9 hardening (08/06/2026): updateMany com cooperativaId no where
    // (defesa em profundidade contra IDOR; findFirst guard acima ja barra
    // 404 cross-tenant, mas updateMany impede mesmo se houvesse race).
    await this.prisma.cooperado.updateMany({
      where: { id: cooperadoId, cooperativaId },
      data: {
        pinHash,
        pinSalt: salt,
        pinTentativas: 0,
        pinBloqueadoAte: null,
        pinDefinidoEm: new Date(),
      },
    });

    this.logger.log(`[pin] PIN definido cooperadoId=${cooperadoId}`);
  }

  /**
   * Valida PIN sem efeitos colaterais (não incrementa tentativas — só lê).
   * F2.9 hardening (08/06/2026): PRIVATE — qualquer consumo de fora deve
   * passar por `validarPinComLockout` (rate-limit + lockout). Antes era
   * public e poderia ser usado pra brute-force sem incrementar tentativas.
   * Specs acessam via `(sut as any).validarPin` (pragmatic).
   */
  private async validarPin(params: {
    cooperadoId: string;
    pin: string;
    cooperativaId: string;
  }): Promise<ValidarPinResult> {
    const { cooperadoId, pin, cooperativaId } = params;

    if (!PIN_REGEX.test(pin)) {
      return { ok: false, motivo: 'PIN_INCORRETO' };
    }

    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: cooperadoId, cooperativaId },
      select: {
        pinHash: true,
        pinSalt: true,
        pinBloqueadoAte: true,
      },
    });

    if (!cooperado) {
      throw new NotFoundException('Cooperado não encontrado.');
    }

    if (!cooperado.pinHash || !cooperado.pinSalt) {
      return { ok: false, motivo: 'PIN_NAO_DEFINIDO' };
    }

    const now = new Date();
    if (cooperado.pinBloqueadoAte && cooperado.pinBloqueadoAte > now) {
      return { ok: false, motivo: 'PIN_BLOQUEADO', desbloqueiaEm: cooperado.pinBloqueadoAte };
    }

    const calculado = hashOtp(pin, cooperado.pinSalt);
    const bufA = Buffer.from(calculado, 'hex');
    const bufB = Buffer.from(cooperado.pinHash, 'hex');
    if (bufA.length !== bufB.length) {
      return { ok: false, motivo: 'PIN_INCORRETO' };
    }
    const bate = crypto.timingSafeEqual(bufA, bufB);

    return bate ? { ok: true } : { ok: false, motivo: 'PIN_INCORRETO' };
  }

  /**
   * Valida PIN COM efeitos colaterais (rate-limit). Use este em fluxos reais
   * de autorização. Em sucesso: zera tentativas + libera lockout. Em falha:
   * incrementa tentativas; se atingir MAX_TENTATIVAS, aplica lockout 15min.
   *
   * Idempotência: 2 validações simultâneas do mesmo PIN podem incrementar
   * tentativas em paralelo (race tolerada — pior caso libera lockout 1
   * tentativa antes; aceitável pro escopo).
   */
  async validarPinComLockout(params: {
    cooperadoId: string;
    pin: string;
    cooperativaId: string;
  }): Promise<ValidarPinResult> {
    const resultado = await this.validarPin(params);

    if (resultado.ok) {
      // F2.9 hardening: updateMany com cooperativaId no where (defesa em
      // profundidade — findFirst dentro de validarPin ja barrou cross-tenant).
      await this.prisma.cooperado.updateMany({
        where: { id: params.cooperadoId, cooperativaId: params.cooperativaId },
        data: {
          pinTentativas: 0,
          pinBloqueadoAte: null,
        },
      });
      return resultado;
    }

    // Bloqueado ou não-definido → não incrementa.
    if (resultado.motivo === 'PIN_BLOQUEADO' || resultado.motivo === 'PIN_NAO_DEFINIDO') {
      return resultado;
    }

    // PIN_INCORRETO → incrementa tentativas + aplica lockout se excedeu.
    // F2.9: updateMany (anti-IDOR) + leitura via findFirst tenant-safe.
    await this.prisma.cooperado.updateMany({
      where: { id: params.cooperadoId, cooperativaId: params.cooperativaId },
      data: { pinTentativas: { increment: 1 } },
    });
    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: params.cooperadoId, cooperativaId: params.cooperativaId },
      select: { pinTentativas: true },
    });

    if (cooperado && cooperado.pinTentativas >= MAX_TENTATIVAS) {
      const desbloqueiaEm = new Date(Date.now() + LOCKOUT_MINUTOS * 60 * 1000);
      await this.prisma.cooperado.updateMany({
        where: { id: params.cooperadoId, cooperativaId: params.cooperativaId },
        data: {
          pinBloqueadoAte: desbloqueiaEm,
          pinTentativas: 0, // reset pra próxima janela
        },
      });
      this.logger.warn(
        `[pin] Lockout aplicado cooperadoId=${params.cooperadoId} desbloqueiaEm=${desbloqueiaEm.toISOString()}`,
      );
      return { ok: false, motivo: 'PIN_BLOQUEADO', desbloqueiaEm };
    }

    return resultado;
  }

  /**
   * Altera PIN exigindo PIN atual válido. Aplica rate-limit no PIN atual.
   */
  async alterarPin(params: {
    cooperadoId: string;
    pinAtual: string;
    novoPin: string;
    cooperativaId: string;
  }): Promise<void> {
    if (!PIN_REGEX.test(params.novoPin)) {
      throw new BadRequestException('Novo PIN deve ter exatamente 6 dígitos numéricos.');
    }
    if (params.pinAtual === params.novoPin) {
      throw new BadRequestException('Novo PIN deve ser diferente do atual.');
    }

    const validacao = await this.validarPinComLockout({
      cooperadoId: params.cooperadoId,
      pin: params.pinAtual,
      cooperativaId: params.cooperativaId,
    });

    if (!validacao.ok) {
      if (validacao.motivo === 'PIN_BLOQUEADO') {
        throw new ForbiddenException(
          `PIN bloqueado até ${validacao.desbloqueiaEm.toISOString()}.`,
        );
      }
      if (validacao.motivo === 'PIN_NAO_DEFINIDO') {
        throw new BadRequestException('PIN ainda não foi definido. Use definirPin.');
      }
      throw new ForbiddenException('PIN atual incorreto.');
    }

    await this.definirPin({
      cooperadoId: params.cooperadoId,
      pin: params.novoPin,
      cooperativaId: params.cooperativaId,
    });
  }

  /**
   * Reset administrativo do PIN. Limpa hash/salt/lockout. Cooperado precisará
   * definir novo PIN antes de transacionar. Pra uso em fluxos admin (suporte)
   * ou recovery via OTP/email (F2.6).
   */
  async resetarPin(params: {
    cooperadoId: string;
    cooperativaId: string;
  }): Promise<void> {
    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: params.cooperadoId, cooperativaId: params.cooperativaId },
      select: { id: true },
    });

    if (!cooperado) {
      throw new NotFoundException('Cooperado não encontrado.');
    }

    // F2.9 hardening: updateMany com cooperativaId (anti-IDOR defesa em prof).
    await this.prisma.cooperado.updateMany({
      where: { id: params.cooperadoId, cooperativaId: params.cooperativaId },
      data: {
        pinHash: null,
        pinSalt: null,
        pinTentativas: 0,
        pinBloqueadoAte: null,
        pinDefinidoEm: null,
      },
    });

    this.logger.log(`[pin] PIN resetado cooperadoId=${params.cooperadoId}`);
  }

  /**
   * Indica se cooperado já definiu PIN. Útil pra UI decidir tela
   * "Definir PIN" vs "Validar PIN".
   */
  async temPin(params: {
    cooperadoId: string;
    cooperativaId: string;
  }): Promise<boolean> {
    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: params.cooperadoId, cooperativaId: params.cooperativaId },
      select: { pinHash: true },
    });

    if (!cooperado) {
      throw new NotFoundException('Cooperado não encontrado.');
    }

    return !!cooperado.pinHash;
  }
}
