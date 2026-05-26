import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma.service';
import { PerfilUsuario } from '@prisma/client';

/**
 * Sub-Sprint F Sessao 2 F.3 Etapa A (M31, 2026-05-26).
 *
 * Service de gestao de ConviteProprietario (magic link onboarding).
 *
 * Token: crypto.randomBytes(32).toString('hex') (64 chars hex).
 * TTL: 7 dias.
 * Idempotencia: se ja existe convite pendente (nao-usado, nao-expirado) pra
 * mesma usina+email, REUSA (atualiza expiresAt + retorna mesmo token).
 *
 * Status derivado em runtime (sem migration adicional):
 *   - PENDENTE: usedAt null e expiresAt > now
 *   - USADO:    usedAt != null
 *   - EXPIRADO: usedAt null e expiresAt <= now
 *
 * Cancelar = DELETE real (sai da lista). Sem soft delete pra evitar
 * complexidade adicional.
 */
@Injectable()
export class ConviteProprietarioService {
  private readonly logger = new Logger(ConviteProprietarioService.name);
  private static readonly TTL_DIAS = 7;
  private supabase: SupabaseClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  constructor(private prisma: PrismaService) {}

  // ─── Criacao ───────────────────────────────────────────────────────

  /**
   * Cria convite (ou reusa pendente). Multi-tenant: usina deve pertencer
   * a cooperativaId do admin.
   */
  async criarConvite(input: {
    usinaId: string;
    email: string;
    criadoPorUserId: string;
    cooperativaId: string;
  }): Promise<{
    id: string;
    token: string;
    link: string;
    email: string;
    usinaId: string;
    expiresAt: Date;
    reused: boolean;
  }> {
    const { usinaId, email, criadoPorUserId, cooperativaId } = input;

    if (!email || !email.includes('@')) {
      throw new BadRequestException('Email invalido.');
    }
    if (!usinaId) throw new BadRequestException('usinaId obrigatorio.');
    if (!cooperativaId) throw new BadRequestException('cooperativaId obrigatorio.');

    // Multi-tenant guard: usina pertence ao tenant
    const usina = await this.prisma.usina.findFirst({
      where: { id: usinaId, cooperativaId },
      select: { id: true, nome: true },
    });
    if (!usina) {
      throw new NotFoundException(
        `Usina ${usinaId} nao encontrada no tenant ${cooperativaId}.`,
      );
    }

    // Idempotencia: reusa convite pendente existente
    const existente = await this.prisma.conviteProprietario.findFirst({
      where: {
        usinaId,
        email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existente) {
      this.logger.log(
        `Convite ja existente (id=${existente.id}) reusado: usinaId=${usinaId} email=${email}`,
      );
      return {
        id: existente.id,
        token: existente.token,
        link: this.montarLink(existente.token),
        email: existente.email,
        usinaId: existente.usinaId,
        expiresAt: existente.expiresAt,
        reused: true,
      };
    }

    const token = this.gerarToken();
    const expiresAt = new Date(
      Date.now() + ConviteProprietarioService.TTL_DIAS * 24 * 60 * 60 * 1000,
    );

    const convite = await this.prisma.conviteProprietario.create({
      data: {
        usinaId,
        email,
        token,
        expiresAt,
        createdBy: criadoPorUserId,
      },
    });

    this.logger.log(
      `Convite criado: id=${convite.id} usinaId=${usinaId} email=${email} expira=${expiresAt.toISOString()}`,
    );

    return {
      id: convite.id,
      token: convite.token,
      link: this.montarLink(convite.token),
      email: convite.email,
      usinaId: convite.usinaId,
      expiresAt: convite.expiresAt,
      reused: false,
    };
  }

  // ─── Validacao ─────────────────────────────────────────────────────

  /**
   * Valida token publicamente (sem JWT). Retorna { valido, motivo?, dados? }.
   * Pra uso na pagina /proprietario/aceitar-convite/[token] (GET pre-populate).
   */
  async validarToken(token: string): Promise<{
    valido: boolean;
    motivo?: string;
    dados?: {
      usinaId: string;
      usinaNome: string;
      email: string;
      expiresAt: Date;
    };
  }> {
    if (!token) return { valido: false, motivo: 'Token ausente.' };

    const convite = await this.prisma.conviteProprietario.findUnique({
      where: { token },
      include: { usina: { select: { nome: true } } },
    });

    if (!convite) return { valido: false, motivo: 'Token nao encontrado.' };
    if (convite.usedAt) return { valido: false, motivo: 'Convite ja utilizado.' };
    if (convite.expiresAt <= new Date()) {
      return { valido: false, motivo: 'Convite expirado.' };
    }

    return {
      valido: true,
      dados: {
        usinaId: convite.usinaId,
        usinaNome: convite.usina.nome,
        email: convite.email,
        expiresAt: convite.expiresAt,
      },
    };
  }

  // ─── Aceitacao (publico) ───────────────────────────────────────────

  /**
   * Aceita convite criando Usuario com perfil PROPRIETARIO + marca
   * convite.usedAt. Senha validada (>= 8 chars).
   *
   * NAO usa Supabase (proprietario nao-cooperado nao tem fluxo Supabase
   * existente). Cria Usuario direto com supabaseId=null e senhaHash.
   */
  async aceitarConvite(token: string, senhaNova: string): Promise<{
    usuarioId: string;
    email: string;
    usinaNome: string;
  }> {
    if (!senhaNova || senhaNova.length < 8) {
      throw new BadRequestException('Senha deve ter no minimo 8 caracteres.');
    }
    // Regra adicional: pelo menos 1 letra + 1 numero
    if (!/[a-zA-Z]/.test(senhaNova) || !/\d/.test(senhaNova)) {
      throw new BadRequestException('Senha deve conter ao menos 1 letra e 1 numero.');
    }

    const validacao = await this.validarToken(token);
    if (!validacao.valido) {
      throw new UnauthorizedException(validacao.motivo ?? 'Token invalido.');
    }
    const dados = validacao.dados!;

    // Verifica se ja existe Usuario com esse email
    const existente = await this.prisma.usuario.findUnique({
      where: { email: dados.email },
    });
    if (existente) {
      // Marca convite como usado mesmo assim (idempotencia — link expira)
      const convite = await this.prisma.conviteProprietario.findUnique({
        where: { token },
      });
      if (convite) {
        await this.prisma.conviteProprietario.update({
          where: { id: convite.id },
          data: { usedAt: new Date() },
        });
      }
      throw new BadRequestException(
        `Ja existe um usuario com o email ${dados.email}. Use 'Esqueci a senha' pra recuperar acesso.`,
      );
    }

    // Pega cooperativaId da usina (proprietario fica vinculado a cooperativa
    // que administra a usina dele).
    const usina = await this.prisma.usina.findUnique({
      where: { id: dados.usinaId },
      select: { cooperativaId: true },
    });

    // Cria usuario no Supabase (mesmo padrao do auth.service.register).
    const { data: supabaseData, error } = await this.supabase.auth.admin.createUser({
      email: dados.email,
      password: senhaNova,
      email_confirm: true, // ja confirma — convite ja autentica o owner
    });
    if (error || !supabaseData.user) {
      throw new ConflictException(
        `Falha ao criar usuario no Supabase: ${error?.message ?? 'erro desconhecido'}`,
      );
    }

    const usuario = await (this.prisma.usuario.create as any)({
      data: {
        nome: dados.email.split('@')[0], // Placeholder — proprietario edita depois
        email: dados.email,
        supabaseId: supabaseData.user.id,
        perfil: PerfilUsuario.PROPRIETARIO,
        cooperativaId: usina?.cooperativaId ?? null,
        ativo: true,
      },
    });

    // Marca convite como usado
    const conviteRow = await this.prisma.conviteProprietario.findUnique({
      where: { token },
    });
    if (conviteRow) {
      await this.prisma.conviteProprietario.update({
        where: { id: conviteRow.id },
        data: { usedAt: new Date() },
      });
    }

    this.logger.log(
      `Convite aceito: token=${token.slice(0, 8)}... usuario=${usuario.id} email=${usuario.email}`,
    );

    return {
      usuarioId: usuario.id,
      email: usuario.email,
      usinaNome: dados.usinaNome,
    };
  }

  // ─── Listar pendentes (admin) ──────────────────────────────────────

  async listarPorUsina(usinaId: string, cooperativaId: string) {
    if (!cooperativaId) throw new BadRequestException('cooperativaId obrigatorio.');

    const usina = await this.prisma.usina.findFirst({
      where: { id: usinaId, cooperativaId },
      select: { id: true },
    });
    if (!usina) {
      throw new NotFoundException('Usina nao encontrada no tenant.');
    }

    const convites = await this.prisma.conviteProprietario.findMany({
      where: { usinaId },
      orderBy: { createdAt: 'desc' },
    });

    const agora = new Date();
    return convites.map((c) => ({
      id: c.id,
      email: c.email,
      // Token NAO retornado na listagem — defesa em profundidade
      tokenSufixo: '...' + c.token.slice(-6),
      expiresAt: c.expiresAt,
      usedAt: c.usedAt,
      createdAt: c.createdAt,
      createdBy: c.createdBy,
      status: c.usedAt
        ? 'USADO'
        : c.expiresAt <= agora
          ? 'EXPIRADO'
          : 'PENDENTE',
    }));
  }

  // ─── Reenviar (regen token + atualiza expiresAt) ───────────────────

  async reenviar(conviteId: string, cooperativaId: string): Promise<{
    id: string;
    token: string;
    link: string;
    expiresAt: Date;
  }> {
    if (!cooperativaId) throw new BadRequestException('cooperativaId obrigatorio.');

    const convite = await this.prisma.conviteProprietario.findUnique({
      where: { id: conviteId },
      include: { usina: { select: { cooperativaId: true } } },
    });
    if (!convite) {
      throw new NotFoundException('Convite nao encontrado.');
    }
    if (convite.usina.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Convite nao pertence ao seu tenant.');
    }
    if (convite.usedAt) {
      throw new BadRequestException(
        'Convite ja utilizado — nao pode ser reenviado. Crie um novo convite.',
      );
    }

    const novoToken = this.gerarToken();
    const novoExpiresAt = new Date(
      Date.now() + ConviteProprietarioService.TTL_DIAS * 24 * 60 * 60 * 1000,
    );

    const atualizado = await this.prisma.conviteProprietario.update({
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

  // ─── Cancelar (DELETE real) ────────────────────────────────────────

  async cancelar(conviteId: string, cooperativaId: string): Promise<{ cancelado: boolean }> {
    if (!cooperativaId) throw new BadRequestException('cooperativaId obrigatorio.');

    const convite = await this.prisma.conviteProprietario.findUnique({
      where: { id: conviteId },
      include: { usina: { select: { cooperativaId: true } } },
    });
    if (!convite) {
      throw new NotFoundException('Convite nao encontrado.');
    }
    if (convite.usina.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Convite nao pertence ao seu tenant.');
    }
    if (convite.usedAt) {
      throw new BadRequestException(
        'Convite ja utilizado — nao pode ser cancelado. O usuario criado ja existe.',
      );
    }

    await this.prisma.conviteProprietario.delete({ where: { id: conviteId } });
    return { cancelado: true };
  }

  // ─── Cadastro manual (sem convite) ─────────────────────────────────

  /**
   * Cria Usuario PROPRIETARIO direto, sem fluxo de convite. Admin copia
   * credenciais e envia por chat/WhatsApp. Usado AGORA pra cooperebr1.
   */
  async cadastroManual(input: {
    nome: string;
    email: string;
    senhaTemp: string;
    usinaId: string;
    criadoPorUserId: string;
    cooperativaId: string;
  }): Promise<{
    usuarioId: string;
    email: string;
    senhaTemp: string;
    usinaNome: string;
  }> {
    const { nome, email, senhaTemp, usinaId, cooperativaId } = input;

    if (!nome || nome.trim().length < 2) {
      throw new BadRequestException('Nome obrigatorio (min 2 chars).');
    }
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Email invalido.');
    }
    if (!senhaTemp || senhaTemp.length < 8) {
      throw new BadRequestException('Senha temporaria deve ter no minimo 8 caracteres.');
    }

    const usina = await this.prisma.usina.findFirst({
      where: { id: usinaId, cooperativaId },
      select: { id: true, nome: true },
    });
    if (!usina) {
      throw new NotFoundException('Usina nao encontrada no tenant.');
    }

    const existente = await this.prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      throw new BadRequestException(
        `Ja existe usuario com email ${email}.`,
      );
    }

    // Cria usuario no Supabase (segue padrao auth.service.register).
    const { data: supabaseData, error } = await this.supabase.auth.admin.createUser({
      email,
      password: senhaTemp,
      email_confirm: true,
    });
    if (error || !supabaseData.user) {
      throw new ConflictException(
        `Falha ao criar usuario no Supabase: ${error?.message ?? 'erro desconhecido'}`,
      );
    }

    const usuario = await (this.prisma.usuario.create as any)({
      data: {
        nome,
        email,
        supabaseId: supabaseData.user.id,
        perfil: PerfilUsuario.PROPRIETARIO,
        cooperativaId,
        ativo: true,
      },
    });

    this.logger.log(
      `Cadastro manual proprietario: usuario=${usuario.id} email=${email} usinaId=${usinaId}`,
    );

    return {
      usuarioId: usuario.id,
      email: usuario.email,
      // Senha temp retornada UMA VEZ pra admin copiar (politica
      // regra-secrets-nao-memorizar.md excecao controlada: owner anota
      // e nunca persiste; agente nunca commita)
      senhaTemp,
      usinaNome: usina.nome,
    };
  }

  // ─── Helpers privados ──────────────────────────────────────────────

  private gerarToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private montarLink(token: string): string {
    const baseUrl =
      process.env.FRONTEND_URL ??
      process.env.NEXTAUTH_URL ??
      'http://localhost:3001';
    return `${baseUrl}/proprietario/aceitar-convite/${token}`;
  }
}
