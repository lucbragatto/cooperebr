import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
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

  // Fatia 2b (03/06/2026) — Política OTP
  static readonly OTP_TTL_MIN = 10;             // 10 minutos
  static readonly OTP_MAX_TENTATIVAS = 5;       // 5 erros → bloqueio
  static readonly OTP_MAX_REENVIOS = 3;         // 3 reenvios por convite
  static readonly OTP_COOLDOWN_SEG = 60;        // 60s entre reenvios
  static readonly OTP_BLOQUEIO_HORAS = 1;       // bloqueio 1h após exaustão

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

  // ─── Sprint Convite-Convênio Fatia 2b (03/06/2026) — OTP ────────────

  /**
   * Gera código OTP de 6 dígitos (000000 a 999999) usando crypto.randomInt
   * (CSPRNG). Zero-padded à esquerda pra sempre 6 chars.
   */
  static gerarCodigoOtp(): string {
    const num = crypto.randomInt(0, 1_000_000);
    return num.toString().padStart(6, '0');
  }

  /**
   * Gera salt rotativo (16 bytes hex = 32 chars) novo a cada solicitar-otp.
   * Garante que mesmo se o atacante conseguir o hash de um OTP antigo, não
   * pode reusar entre reenvios.
   */
  static gerarSaltOtp(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Hash sha256(codigo + salt). Sufiente pra 6 dígitos × TTL 10min (não
   * justifica work factor bcrypt). Output 64 chars hex.
   */
  static hashOtp(codigo: string, salt: string): string {
    return crypto.createHash('sha256').update(codigo + salt).digest('hex');
  }

  /**
   * Comparação constant-time via crypto.timingSafeEqual. Evita timing attack
   * que vazaria info por diferença de tempo de resposta entre código próximo
   * vs distante.
   */
  static compararOtp(codigo: string, salt: string, hashEsperado: string): boolean {
    const calculado = ConvitesConvenioService.hashOtp(codigo, salt);
    // Mesmo comprimento garantido pelos hashes sha256 (64 hex) — defensivo:
    if (calculado.length !== hashEsperado.length) return false;
    const bufA = Buffer.from(calculado, 'hex');
    const bufB = Buffer.from(hashEsperado, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }

  /**
   * Gera código OTP novo + envia por WhatsApp pro `convite.telefone` (NUNCA
   * pra outro número). Atualiza otpCodigoHash/Salt/ExpiresAt + carimbo
   * envio + incremento reenvios + reset tentativas (novo código = nova chance).
   *
   * Guards (ordem):
   *  1. Convite vivo (existe + não usado + não expirado).
   *  2. otpBloqueadoAte > now → HTTP 429 'bloqueado' (5 erros consumiram cota).
   *  3. otpReenvios >= 3 → HTTP 429 'reenvios_esgotados'.
   *  4. otpUltimoEnvioEm + 60s > now → HTTP 429 'cooldown' (informa segundos restantes).
   *
   * Best-effort no envio WA: se WA falhar, NÃO reverte a gravação do hash
   * (admin pode re-emitir via reenvio); retorna { whatsappEnviado: false, erro }.
   */
  async solicitarOtp(token: string): Promise<{
    ok: boolean;
    expiraEmSegundos: number;
    reenviosRestantes: number;
    whatsappEnviado: boolean;
    whatsappErro?: string;
  }> {
    const convite = await this.prisma.conviteConvenioMembro.findUnique({
      where: { token },
      include: { convenio: { select: { empresaNome: true } } },
    });
    if (!convite) {
      throw new NotFoundException('Convite indisponível.');
    }
    if (convite.usedAt) {
      throw new BadRequestException('Convite já utilizado.');
    }
    if (convite.expiresAt <= new Date()) {
      throw new BadRequestException('Convite expirado.');
    }

    const now = new Date();

    // Guard 1: bloqueio temporário por exaustão de tentativas
    if (convite.otpBloqueadoAte && convite.otpBloqueadoAte > now) {
      const segundos = Math.ceil((convite.otpBloqueadoAte.getTime() - now.getTime()) / 1000);
      throw new HttpException(
        {
          erro: 'bloqueado',
          mensagem: `Muitas tentativas erradas. Tente novamente em ${segundos} segundos.`,
          desbloqueadoEm: convite.otpBloqueadoAte,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Guard 2: reenvios esgotados
    if (convite.otpReenvios >= ConvitesConvenioService.OTP_MAX_REENVIOS) {
      throw new HttpException(
        {
          erro: 'reenvios_esgotados',
          mensagem:
            `Limite de ${ConvitesConvenioService.OTP_MAX_REENVIOS} reenvios atingido. ` +
            `Solicite um novo convite à empresa.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Guard 3: cooldown entre reenvios
    if (convite.otpUltimoEnvioEm) {
      const proximoLiberadoEm = new Date(
        convite.otpUltimoEnvioEm.getTime() + ConvitesConvenioService.OTP_COOLDOWN_SEG * 1000,
      );
      if (proximoLiberadoEm > now) {
        const aguarde = Math.ceil((proximoLiberadoEm.getTime() - now.getTime()) / 1000);
        throw new HttpException(
          {
            erro: 'cooldown',
            mensagem: `Aguarde ${aguarde} segundos para solicitar um novo código.`,
            liberadoEm: proximoLiberadoEm,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // Gera código + salt + hash; expira em 10min; zera tentativas (novo código,
    // nova chance — caso atacante esteja brute-forçando o anterior, ele não
    // pode somar tentativas no novo).
    const codigo = ConvitesConvenioService.gerarCodigoOtp();
    const salt = ConvitesConvenioService.gerarSaltOtp();
    const hash = ConvitesConvenioService.hashOtp(codigo, salt);
    const expiresAt = new Date(now.getTime() + ConvitesConvenioService.OTP_TTL_MIN * 60 * 1000);

    const atualizado = await this.prisma.conviteConvenioMembro.update({
      where: { id: convite.id },
      data: {
        otpCodigoHash: hash,
        otpSalt: salt,
        otpExpiresAt: expiresAt,
        otpUltimoEnvioEm: now,
        otpReenvios: { increment: 1 },
        otpTentativas: 0,
      },
      select: { otpReenvios: true },
    });

    // Envia WA pro telefone DO CONVITE (NUNCA pra outro número)
    const texto =
      `Olá, ${convite.nomeConvidado}!\n\n` +
      `Seu código de confirmação CoopereBR (convênio *${convite.convenio.empresaNome}*):\n\n` +
      `*${codigo}*\n\n` +
      `Válido por ${ConvitesConvenioService.OTP_TTL_MIN} minutos.\n\n` +
      `Se você não solicitou, ignore esta mensagem.`;

    let whatsappEnviado = true;
    let whatsappErro: string | undefined;
    try {
      await this.waSender.enviarMensagem(convite.telefone, texto, {
        tipoDisparo: 'convite_convenio_otp',
        cooperativaId: convite.cooperativaId,
      });
    } catch (err) {
      whatsappEnviado = false;
      whatsappErro = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.warn(
        `[convite-otp] Falha WA telefone=${convite.telefone.slice(0, 4)}***${convite.telefone.slice(-4)}: ${whatsappErro}`,
      );
    }

    this.logger.log(
      `[convite-otp] Código emitido: conviteId=${convite.id} ` +
        `telefone=${convite.telefone.slice(0, 4)}***${convite.telefone.slice(-4)} ` +
        `reenvio=${atualizado.otpReenvios}/${ConvitesConvenioService.OTP_MAX_REENVIOS} ` +
        `expira=${expiresAt.toISOString()} wa=${whatsappEnviado}`,
    );

    return {
      ok: true,
      expiraEmSegundos: ConvitesConvenioService.OTP_TTL_MIN * 60,
      reenviosRestantes: ConvitesConvenioService.OTP_MAX_REENVIOS - atualizado.otpReenvios,
      whatsappEnviado,
      whatsappErro,
    };
  }

  /**
   * Valida código OTP digitado pelo destinatário. Mantém comparação
   * constant-time (timingSafeEqual). Em erro, incrementa tentativas; ao
   * atingir limite, marca otpBloqueadoAte=+1h.
   *
   * Casos de retorno:
   *  - OK: { ok: true } + marca otpValidadoEm=now (consumível 1× pela Fatia 2c)
   *  - código vazio/curto: 400 erro 'codigo_invalido' (sem contar como tentativa)
   *  - sem OTP solicitado ainda: 400 erro 'sem_codigo_pendente'
   *  - expirado: 400 erro 'expirado' + podeReenviar:true
   *  - bloqueado: 429 erro 'bloqueado' + desbloqueadoEm
   *  - errado: 400 erro 'codigo_invalido' + tentativasRestantes (após increment)
   *  - errado E atingiu limite: 429 erro 'bloqueado' + desbloqueadoEm
   */
  async validarOtp(token: string, codigo: string): Promise<{ ok: true }> {
    if (!codigo || typeof codigo !== 'string' || !/^\d{6}$/.test(codigo)) {
      throw new BadRequestException({
        erro: 'codigo_invalido',
        mensagem: 'Código deve conter 6 dígitos.',
      });
    }

    const convite = await this.prisma.conviteConvenioMembro.findUnique({
      where: { token },
    });
    if (!convite) throw new NotFoundException('Convite indisponível.');
    if (convite.usedAt) throw new BadRequestException('Convite já utilizado.');
    if (convite.expiresAt <= new Date()) {
      throw new BadRequestException('Convite expirado.');
    }

    const now = new Date();

    // Bloqueio temporário ativo
    if (convite.otpBloqueadoAte && convite.otpBloqueadoAte > now) {
      const segundos = Math.ceil((convite.otpBloqueadoAte.getTime() - now.getTime()) / 1000);
      throw new HttpException(
        {
          erro: 'bloqueado',
          mensagem: `Muitas tentativas erradas. Tente novamente em ${segundos} segundos.`,
          desbloqueadoEm: convite.otpBloqueadoAte,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Não há código pendente (nunca solicitado)
    if (!convite.otpCodigoHash || !convite.otpSalt || !convite.otpExpiresAt) {
      throw new BadRequestException({
        erro: 'sem_codigo_pendente',
        mensagem: 'Solicite o código primeiro.',
      });
    }

    // Código expirou (TTL 10min)
    if (convite.otpExpiresAt <= now) {
      throw new BadRequestException({
        erro: 'expirado',
        mensagem: 'Código expirado. Solicite um novo.',
        podeReenviar:
          convite.otpReenvios < ConvitesConvenioService.OTP_MAX_REENVIOS,
      });
    }

    // Comparação constant-time
    const ok = ConvitesConvenioService.compararOtp(
      codigo,
      convite.otpSalt,
      convite.otpCodigoHash,
    );

    if (ok) {
      // Valida — marca otpValidadoEm (Fatia 2c consome em /auto-inscrever)
      await this.prisma.conviteConvenioMembro.update({
        where: { id: convite.id },
        data: { otpValidadoEm: now },
      });
      this.logger.log(
        `[convite-otp] Código VALIDADO: conviteId=${convite.id} ` +
          `tentativas=${convite.otpTentativas}/${ConvitesConvenioService.OTP_MAX_TENTATIVAS}`,
      );
      return { ok: true };
    }

    // Errado — incrementa tentativas; se atingir limite, bloqueia
    const novasTentativas = convite.otpTentativas + 1;
    const atingiuLimite = novasTentativas >= ConvitesConvenioService.OTP_MAX_TENTATIVAS;
    const otpBloqueadoAte = atingiuLimite
      ? new Date(now.getTime() + ConvitesConvenioService.OTP_BLOQUEIO_HORAS * 60 * 60 * 1000)
      : convite.otpBloqueadoAte;

    await this.prisma.conviteConvenioMembro.update({
      where: { id: convite.id },
      data: {
        otpTentativas: novasTentativas,
        otpBloqueadoAte,
      },
    });

    this.logger.warn(
      `[convite-otp] Código ERRADO: conviteId=${convite.id} ` +
        `tentativas=${novasTentativas}/${ConvitesConvenioService.OTP_MAX_TENTATIVAS}` +
        (atingiuLimite ? ' → BLOQUEADO por 1h' : ''),
    );

    if (atingiuLimite) {
      throw new HttpException(
        {
          erro: 'bloqueado',
          mensagem: 'Muitas tentativas erradas. Tente novamente em 1 hora.',
          desbloqueadoEm: otpBloqueadoAte,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    throw new BadRequestException({
      erro: 'codigo_invalido',
      mensagem: 'Código incorreto.',
      tentativasRestantes:
        ConvitesConvenioService.OTP_MAX_TENTATIVAS - novasTentativas,
    });
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
