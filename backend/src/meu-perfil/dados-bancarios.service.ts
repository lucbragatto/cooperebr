/**
 * Sprint Clube P1 — F6 Bloco C.0 (13/06/2026).
 *
 * Cadastro/atualização da chave PIX do Cooperado pra resgate em R$ (F6).
 *
 * ═══ REFORÇO ANTI-FRAUDE Luciano (centro do C.0) ═══
 *
 * A chave PIX é a ÂNCORA anti-fraude do F6: backend NUNCA aceita chave do
 * body do `solicitarResgate` — sempre snapshot do `Cooperado.pixChave`
 * cadastrado AQUI. Se um atacante com sessão aberta pudesse trocar a chave
 * sem fricção e depois resgatar, a âncora não vale nada.
 *
 * Solução em duas camadas:
 *  1. **PIN obrigatório** pra alterar a chave (mesma postura de dinheiro-
 *     saindo — sessão sequestrada sem PIN ≠ chave alterada).
 *  2. **pixUltimaAlteracaoEm** gravado — Dialog admin de aprovação (C.3)
 *     mostra banner amber se chave foi alterada nas últimas 24h ANTES do
 *     resgate (não bloqueia, alerta o humano).
 *
 * Multi-tenant: cooperadoId + cooperativaId SEMPRE do JWT (anti-IDOR).
 *
 * AuditLog: ação `cooperado.pix.atualizar` com `{antes, depois}` mascarados
 * — chaves PIX são PII; auditoria não pode vazá-las em claro.
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PinCooperadoService } from '../cooperados/pin-cooperado.service';
import { AuditService } from '../audit/audit.service';
import { PixTipoEnum } from './dto/update-dados-bancarios.dto';

/**
 * Janela considerada "alteração recente" — usada pelo banner amber do C.3
 * no Dialog de aprovação. 24h é a janela típica de detecção de sequestro
 * de sessão por análise comportamental.
 */
const JANELA_ALTERACAO_RECENTE_MS = 24 * 60 * 60 * 1000;

export interface DadosBancariosStatus {
  temPixCadastrado: boolean;
  pixChaveMascarada: string | null;
  pixTipo: string | null;
  pixUltimaAlteracaoEm: Date | null;
  alteradaRecentemente: boolean;
}

export interface AtualizarDadosBancariosParams {
  cooperadoId: string;
  cooperativaId: string;
  pin: string;
  pixTipo: PixTipoEnum;
  pixChave: string;
  usuarioId: string;
  usuarioPerfil: string;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class DadosBancariosService {
  private readonly logger = new Logger(DadosBancariosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pinCooperadoService: PinCooperadoService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Mascara chave PIX pra logs/auditoria/UI sem vazar a chave em claro.
   * Mantém os 3 primeiros e 2 últimos caracteres; meio vira `***`.
   * Curtas (<=5 chars) viram `***` puro pra não revelar quase tudo.
   */
  static mascarar(chave: string | null | undefined): string | null {
    if (!chave) return null;
    const limpa = chave.trim();
    if (limpa.length === 0) return null;
    if (limpa.length <= 5) return '***';
    return `${limpa.slice(0, 3)}***${limpa.slice(-2)}`;
  }

  /**
   * Lê estado atual do cadastro PIX do cooperado autenticado.
   * Multi-tenant via findFirst {id, cooperativaId} — cross-tenant retorna
   * NotFound (anti-IDOR padrão F4/F6).
   */
  async getStatus(params: {
    cooperadoId: string;
    cooperativaId: string;
  }): Promise<DadosBancariosStatus> {
    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: params.cooperadoId, cooperativaId: params.cooperativaId },
      select: { pixChave: true, pixTipo: true, pixUltimaAlteracaoEm: true },
    });
    if (!cooperado) {
      throw new NotFoundException('Cooperado não encontrado no seu tenant.');
    }
    const temPix = !!cooperado.pixChave && cooperado.pixChave.trim().length > 0;
    const alteradaRecentemente =
      !!cooperado.pixUltimaAlteracaoEm &&
      Date.now() - cooperado.pixUltimaAlteracaoEm.getTime() <
        JANELA_ALTERACAO_RECENTE_MS;
    return {
      temPixCadastrado: temPix,
      pixChaveMascarada: temPix
        ? DadosBancariosService.mascarar(cooperado.pixChave)
        : null,
      pixTipo: temPix ? cooperado.pixTipo : null,
      pixUltimaAlteracaoEm: cooperado.pixUltimaAlteracaoEm,
      alteradaRecentemente,
    };
  }

  /**
   * Atualiza chave PIX. PIN obrigatório (REFORÇO ANTI-FRAUDE).
   *
   * Ordem do fluxo (paralelo F6 solicitarResgate):
   *  1. Cooperado existe + tenant match (anti-IDOR).
   *  2. Valida formato da chave por tipo (regex específico).
   *  3. Valida PIN FORA da tx via PinCooperadoService (lockout 30min).
   *  4. Tx update: pixChave + pixTipo + pixUltimaAlteracaoEm=now.
   *  5. AuditLog `cooperado.pix.atualizar` com antes/depois mascarados.
   */
  async atualizar(params: AtualizarDadosBancariosParams): Promise<{
    sucesso: true;
    pixUltimaAlteracaoEm: Date;
  }> {
    const {
      cooperadoId,
      cooperativaId,
      pin,
      pixTipo,
      pixChave,
      usuarioId,
      usuarioPerfil,
      ip,
      userAgent,
    } = params;

    // ── Guard 1: cooperado existe + tenant match ──
    const atual = await this.prisma.cooperado.findFirst({
      where: { id: cooperadoId, cooperativaId },
      select: { id: true, pixChave: true, pixTipo: true },
    });
    if (!atual) {
      throw new NotFoundException('Cooperado não encontrado no seu tenant.');
    }

    // ── Guard 2: valida formato por tipo (defesa contra chave mal-formada
    //     bater no Asaas depois e retornar erro genérico no resgate). ──
    const chaveLimpa = pixChave.trim();
    this.validarFormatoChave(pixTipo, chaveLimpa);

    // ── Guard 3: PIN obrigatório (REFORÇO ANTI-FRAUDE). Mesmo fluxo do
    //     F6 solicitarResgate — fora da tx, com lockout 30min. ──
    const pinResult = await this.pinCooperadoService.validarPinComLockout({
      cooperadoId,
      cooperativaId,
      pin,
    });
    if (!pinResult.ok) {
      if (pinResult.motivo === 'PIN_NAO_DEFINIDO') {
        throw new BadRequestException(
          'PIN não foi definido. Configure em /portal/seguranca/definir-pin antes de cadastrar chave PIX (REFORÇO ANTI-FRAUDE — chave de resgate exige PIN).',
        );
      }
      if (pinResult.motivo === 'PIN_BLOQUEADO') {
        throw new ForbiddenException(
          `PIN bloqueado por excesso de tentativas. Tente após ${pinResult.desbloqueiaEm.toISOString()}.`,
        );
      }
      throw new ForbiddenException('PIN incorreto.');
    }

    // ── Update + timestamp da alteração ──
    const agora = new Date();
    await this.prisma.cooperado.update({
      where: { id: cooperadoId },
      data: {
        pixChave: chaveLimpa,
        pixTipo,
        pixUltimaAlteracaoEm: agora,
      },
    });

    // ── AuditLog com antes/depois mascarados (PII) ──
    await this.auditService.log({
      usuarioId,
      usuarioPerfil,
      acao: 'cooperado.pix.atualizar',
      recurso: 'Cooperado',
      recursoId: cooperadoId,
      cooperativaId,
      metadata: {
        antes: {
          pixChave: DadosBancariosService.mascarar(atual.pixChave),
          pixTipo: atual.pixTipo,
        },
        depois: {
          pixChave: DadosBancariosService.mascarar(chaveLimpa),
          pixTipo,
        },
        cadastroInicial: !atual.pixChave,
      },
      ip,
      userAgent,
    });

    this.logger.log(
      `[F6 C.0] PIX atualizado cooperado=${cooperadoId} tipo=${pixTipo} chave=${DadosBancariosService.mascarar(chaveLimpa)} (${atual.pixChave ? 'alteração' : 'cadastro inicial'})`,
    );

    return { sucesso: true, pixUltimaAlteracaoEm: agora };
  }

  /**
   * Valida o formato da chave por tipo. Joga BadRequest com mensagem
   * específica pra UI traduzir em mensagem humana.
   *
   * Regex deliberadamente conservadores — Asaas valida mais a fundo, mas
   * a gente NÃO quer perder uma chamada de API só pra descobrir que a
   * chave tem letras num CPF.
   */
  private validarFormatoChave(tipo: PixTipoEnum, chave: string): void {
    switch (tipo) {
      case PixTipoEnum.CPF: {
        if (!/^\d{11}$/.test(chave)) {
          throw new BadRequestException(
            'CPF inválido. Use apenas 11 dígitos numéricos (sem pontos ou traços).',
          );
        }
        return;
      }
      case PixTipoEnum.CNPJ: {
        if (!/^\d{14}$/.test(chave)) {
          throw new BadRequestException(
            'CNPJ inválido. Use apenas 14 dígitos numéricos (sem pontos, barras ou traços).',
          );
        }
        return;
      }
      case PixTipoEnum.EMAIL: {
        // Regex deliberadamente simples — Asaas/email-validators completos
        // rejeitam casos válidos por TLDs novos. Defesa contra typo grosseiro.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(chave)) {
          throw new BadRequestException(
            'Email inválido. Use o formato usuario@dominio.com.',
          );
        }
        return;
      }
      case PixTipoEnum.TELEFONE: {
        // E.164: + DDI 1-3 dígitos + número (8-14 dígitos totais após +).
        // Brasil: +55 + 11 dígitos (DDD+9+8). Aceita outros DDIs por
        // robustez (cooperados podem ter PIX internacional).
        if (!/^\+\d{10,15}$/.test(chave)) {
          throw new BadRequestException(
            'Telefone inválido. Use formato E.164: + DDI + número, ex: +5527981341348.',
          );
        }
        return;
      }
      case PixTipoEnum.ALEATORIA: {
        // UUID v4 (formato EVP do Asaas). Tolerante a UPPER/lowercase.
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            chave,
          )
        ) {
          throw new BadRequestException(
            'Chave aleatória (EVP) deve ser um UUID v4. Gere uma no app do seu banco.',
          );
        }
        return;
      }
      default: {
        // Compile-time: enum exhaustivo. Runtime: defesa.
        const _exhaustive: never = tipo;
        throw new BadRequestException(`pixTipo desconhecido: ${_exhaustive}`);
      }
    }
  }
}
