import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';

/**
 * Sprint Convite-Convênio Fatia 2a (03/06/2026).
 *
 * Service de gestão de ConviteConvenioMembro (link per-recipient phone-bound).
 * Espelho conceitual do ConviteProprietarioService (M31, 2026-05-26).
 *
 * Convite TTL: 7 dias (alinhado ConviteProprietario).
 * Token: crypto.randomBytes(32).toString('hex') (64 chars hex).
 * Reuse-if-alive: se já existe convite (não-usado, não-expirado) pra mesma
 * (convenioId, telefone), REUSA — atualiza createdBy + retorna mesmo token.
 *
 * OTP (campos otpCodigoHash/otpSalt/otpExpiresAt/otpTentativas/...) fica
 * dormente no MVP da 2a — preenchido na Fatia 2b.
 *
 * NÃO valida pagador=EMPRESA aqui (controller faz via @TenantResource e o
 * caller admin verifica). Foco do service: ciclo de vida do convite.
 */
@Injectable()
export class ConvitesConvenioService {
  private readonly logger = new Logger(ConvitesConvenioService.name);
  private static readonly CONVITE_TTL_DIAS = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly waSender: WhatsappSenderService,
  ) {}

  /**
   * Normaliza telefone pro formato E.164 BR usado pelo whatsapp-service:
   * `55DDXXXXXXXXX` (13 dígitos, sem `+`/máscara, com dígito 9 da operadora).
   * Padrão derivado de `publico.controller.ts:78-86` (iniciarCadastro).
   *
   * Aceita entradas comuns: "(27) 99876-5432" / "27998765432" / "5527998765432"
   * Rejeita: vazio, < 10 dígitos (sem DDD), > 13 dígitos.
   */
  static normalizarTelefoneBR(input: string): string {
    if (!input) {
      throw new BadRequestException('Telefone obrigatório.');
    }
    let t = input.replace(/\D/g, '');
    if (!t.startsWith('55')) {
      t = '55' + t;
    }
    const semPais = t.slice(2);
    if (semPais.length === 10) {
      // 10 dígitos pós-país (DDD + 8 dígitos) → adiciona dígito 9 da operadora
      t = '55' + semPais.slice(0, 2) + '9' + semPais.slice(2);
    }
    // Após normalização, esperamos 55 + DDD(2) + 9 + numero(8) = 13
    if (t.length !== 13) {
      throw new BadRequestException(
        `Telefone inválido (${input}). Use DDD + número com dígito 9 da operadora.`,
      );
    }
    return t;
  }

  /**
   * Cria convite (ou reusa se já existe vivo pra mesmo convenioId+telefone).
   * Multi-tenant: convênio deve pertencer ao cooperativaId do admin.
   */
  async criarConvite(input: {
    convenioId: string;
    nomeConvidado: string;
    telefone: string;
    criadoPorUserId: string;
    cooperativaId: string;
  }): Promise<{
    id: string;
    token: string;
    link: string;
    nomeConvidado: string;
    telefone: string;
    expiresAt: Date;
    reused: boolean;
    empresaNome: string;
  }> {
    const { convenioId, criadoPorUserId, cooperativaId } = input;
    const nomeConvidado = input.nomeConvidado?.trim();
    if (!nomeConvidado || nomeConvidado.length < 2) {
      throw new BadRequestException('nomeConvidado obrigatório (min 2 chars).');
    }
    if (!convenioId) throw new BadRequestException('convenioId obrigatório.');
    if (!cooperativaId) throw new BadRequestException('cooperativaId obrigatório.');

    const telefone = ConvitesConvenioService.normalizarTelefoneBR(input.telefone);

    // Multi-tenant: convênio pertence ao tenant + pagador=EMPRESA + status ATIVO
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: { id: true, status: true, pagador: true, empresaNome: true },
    });
    if (!convenio) {
      throw new NotFoundException('Convênio não encontrado neste tenant.');
    }
    if (convenio.status !== 'ATIVO') {
      throw new BadRequestException(`Convênio "${convenio.empresaNome}" não está ATIVO.`);
    }
    if (convenio.pagador !== 'EMPRESA') {
      throw new BadRequestException(
        `Convênio "${convenio.empresaNome}" tem pagador=${convenio.pagador}; ` +
          `convites de custeio exigem pagador=EMPRESA (Caso 1).`,
      );
    }

    // Reuse-if-alive: convite existente pra (convenioId, telefone) que ainda
    // está vivo (não usado, não expirado) é REUSADO. Decisão Luciano Fase 1.
    const existente = await this.prisma.conviteConvenioMembro.findUnique({
      where: { convenioId_telefone: { convenioId, telefone } },
    });
    if (existente && !existente.usedAt && existente.expiresAt > new Date()) {
      this.logger.log(
        `[convite-convenio] Convite reusado (já existia vivo): convenioId=${convenioId} ` +
          `telefone=${telefone.slice(0, 4)}***${telefone.slice(-4)} tokenSufixo=...${existente.token.slice(-6)}`,
      );
      return {
        id: existente.id,
        token: existente.token,
        link: this.montarLink(existente.token),
        nomeConvidado: existente.nomeConvidado,
        telefone: existente.telefone,
        expiresAt: existente.expiresAt,
        reused: true,
        empresaNome: convenio.empresaNome,
      };
    }

    const token = this.gerarToken();
    const expiresAt = new Date(
      Date.now() + ConvitesConvenioService.CONVITE_TTL_DIAS * 24 * 60 * 60 * 1000,
    );

    // Se existia mas estava usado/expirado → recriar (delete + create, ou upsert).
    // Decisão: deletar o antigo (audit já cobre histórico) e criar novo limpo.
    let convite;
    if (existente) {
      await this.prisma.conviteConvenioMembro.delete({ where: { id: existente.id } });
    }
    convite = await this.prisma.conviteConvenioMembro.create({
      data: {
        convenioId,
        cooperativaId,
        nomeConvidado,
        telefone,
        token,
        expiresAt,
        createdBy: criadoPorUserId,
      },
    });

    this.logger.log(
      `[convite-convenio] Convite criado: id=${convite.id} convenioId=${convenioId} ` +
        `telefone=${telefone.slice(0, 4)}***${telefone.slice(-4)} tokenSufixo=...${token.slice(-6)} ` +
        `expira=${expiresAt.toISOString()}`,
    );

    return {
      id: convite.id,
      token: convite.token,
      link: this.montarLink(convite.token),
      nomeConvidado: convite.nomeConvidado,
      telefone: convite.telefone,
      expiresAt: convite.expiresAt,
      reused: false,
      empresaNome: convenio.empresaNome,
    };
  }

  /**
   * Valida token PUBLICAMENTE (sem JWT). Retorna `{ valido, motivo?, dados? }`.
   * Pra uso na página /convite/[token] (GET pre-populate).
   * NÃO retorna o telefone completo — defesa LGPD/anti-enumeration. Só sufixo
   * pra UX ("código vai pra ...XX99").
   */
  async validarToken(token: string): Promise<{
    valido: boolean;
    motivo?: string;
    dados?: {
      empresaNome: string;
      nomeConvidado: string;
      telefoneSufixo: string;
      expiresAt: Date;
      otpJaValidado: boolean;
    };
  }> {
    if (!token) return { valido: false, motivo: 'Token ausente.' };

    const convite = await this.prisma.conviteConvenioMembro.findUnique({
      where: { token },
      include: { convenio: { select: { empresaNome: true } } },
    });

    if (!convite) return { valido: false, motivo: 'Convite não encontrado.' };
    if (convite.usedAt) return { valido: false, motivo: 'Convite já utilizado.' };
    if (convite.expiresAt <= new Date()) {
      return { valido: false, motivo: 'Convite expirado.' };
    }

    return {
      valido: true,
      dados: {
        empresaNome: convite.convenio.empresaNome,
        nomeConvidado: convite.nomeConvidado,
        telefoneSufixo: '...' + convite.telefone.slice(-4),
        expiresAt: convite.expiresAt,
        otpJaValidado: !!convite.otpValidadoEm,
      },
    };
  }

  /**
   * Marca convite como usado + vincula ao membro recém-criado.
   * Chamado pela Fatia 2c (/auto-inscrever após criar Cooperado+Membro).
   * Multi-tenant: caller passa cooperativaId pra defesa em profundidade.
   */
  async marcarUsado(input: {
    conviteId: string;
    membroId: string;
    cooperativaId: string;
  }) {
    const { conviteId, membroId, cooperativaId } = input;
    const convite = await this.prisma.conviteConvenioMembro.findUnique({
      where: { id: conviteId },
    });
    if (!convite) throw new NotFoundException('Convite não encontrado.');
    if (convite.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Convite não pertence ao tenant.');
    }
    if (convite.usedAt) {
      throw new BadRequestException('Convite já utilizado.');
    }
    return this.prisma.conviteConvenioMembro.update({
      where: { id: conviteId },
      data: { usedAt: new Date(), membroId },
    });
  }

  /**
   * Lista convites do convênio (admin). Tenant-scoped via convênio.
   * NÃO retorna o token integral (apenas sufixo) — defesa LGPD.
   */
  async listarPorConvenio(convenioId: string, cooperativaId: string) {
    const convenio = await this.prisma.contratoConvenio.findFirst({
      where: { id: convenioId, cooperativaId },
      select: { id: true },
    });
    if (!convenio) throw new NotFoundException('Convênio não encontrado neste tenant.');

    const convites = await this.prisma.conviteConvenioMembro.findMany({
      where: { convenioId },
      orderBy: { createdAt: 'desc' },
    });

    const agora = new Date();
    return convites.map((c) => ({
      id: c.id,
      nomeConvidado: c.nomeConvidado,
      telefone: c.telefone,
      tokenSufixo: '...' + c.token.slice(-6),
      expiresAt: c.expiresAt,
      usedAt: c.usedAt,
      createdAt: c.createdAt,
      createdBy: c.createdBy,
      otpValidadoEm: c.otpValidadoEm,
      membroId: c.membroId,
      status: c.usedAt
        ? 'USADO'
        : c.expiresAt <= agora
          ? 'EXPIRADO'
          : c.otpValidadoEm
            ? 'OTP_VALIDADO'
            : 'PENDENTE',
    }));
  }

  /**
   * Cancela convite (DELETE real). Só se ainda não foi usado.
   * Multi-tenant: caller passa cooperativaId.
   */
  async cancelar(conviteId: string, cooperativaId: string): Promise<{ cancelado: boolean }> {
    const convite = await this.prisma.conviteConvenioMembro.findUnique({
      where: { id: conviteId },
    });
    if (!convite) throw new NotFoundException('Convite não encontrado.');
    if (convite.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Convite não pertence ao tenant.');
    }
    if (convite.usedAt) {
      throw new BadRequestException(
        'Convite já utilizado — não pode ser cancelado. O cooperado criado já existe.',
      );
    }
    await this.prisma.conviteConvenioMembro.delete({ where: { id: conviteId } });
    return { cancelado: true };
  }

  /**
   * Reenvia convite (regenera token + estende expiresAt). NÃO reseta OTP
   * (isso é responsabilidade da Fatia 2b via solicitar-otp).
   */
  async reenviarConvite(
    conviteId: string,
    cooperativaId: string,
  ): Promise<{ id: string; token: string; link: string; expiresAt: Date }> {
    const convite = await this.prisma.conviteConvenioMembro.findUnique({
      where: { id: conviteId },
    });
    if (!convite) throw new NotFoundException('Convite não encontrado.');
    if (convite.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Convite não pertence ao tenant.');
    }
    if (convite.usedAt) {
      throw new BadRequestException(
        'Convite já utilizado — não pode ser reenviado. Crie um novo.',
      );
    }

    const novoToken = this.gerarToken();
    const novoExpiresAt = new Date(
      Date.now() + ConvitesConvenioService.CONVITE_TTL_DIAS * 24 * 60 * 60 * 1000,
    );

    const atualizado = await this.prisma.conviteConvenioMembro.update({
      where: { id: conviteId },
      data: { token: novoToken, expiresAt: novoExpiresAt },
    });

    return {
      id: atualizado.id,
      token: atualizado.token,
      link: this.montarLink(atualizado.token),
      expiresAt: atualizado.expiresAt,
    };
  }

  /**
   * Envia o link do convite por WhatsApp pro telefone DO CONVITE.
   * Best-effort: erro de envio é registrado no log do WA-sender (FALHOU) mas
   * NÃO reverte a criação do convite (admin pode reenviar manualmente).
   */
  async enviarLinkPorWhatsapp(input: {
    telefone: string;
    link: string;
    nomeConvidado: string;
    empresaNome: string;
    cooperativaId: string;
  }): Promise<{ enviado: boolean; erro?: string }> {
    const { telefone, link, nomeConvidado, empresaNome, cooperativaId } = input;
    const texto =
      `Olá, ${nomeConvidado}!\n\n` +
      `A empresa *${empresaNome}* convidou você para fazer parte do programa de custeio de energia ` +
      `(CoopereBR).\n\n` +
      `Acesse este link para concluir seu cadastro:\n${link}\n\n` +
      `Validade: 7 dias.`;
    try {
      await this.waSender.enviarMensagem(telefone, texto, {
        tipoDisparo: 'convite_convenio',
        cooperativaId,
      });
      return { enviado: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.warn(
        `[convite-convenio] Falha enviar WA pra ${telefone.slice(0, 4)}***${telefone.slice(-4)}: ${msg}`,
      );
      return { enviado: false, erro: msg };
    }
  }

  // ─── Helpers privados ────────────────────────────────────────────────

  private gerarToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private montarLink(token: string): string {
    const baseUrl =
      process.env.FRONTEND_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3001';
    return `${baseUrl}/convite/${token}`;
  }
}
