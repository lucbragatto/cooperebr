import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { PerfilUsuario } from './perfil.enum';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private whatsappSender: WhatsappSenderService,
  ) {}

  async register(data: {
    nome: string;
    email: string;
    cpf?: string;
    telefone?: string;
    senha: string;
    perfil?: PerfilUsuario;
  }) {
    const orConditions: any[] = [{ email: data.email }];
    if (data.cpf) orConditions.push({ cpf: data.cpf });
    if (data.telefone) orConditions.push({ telefone: data.telefone });

    const existente = await this.prisma.usuario.findFirst({
      where: { OR: orConditions },
    });

    if (existente) {
      throw new ConflictException(
        'Já existe um usuário com esse email, CPF ou telefone',
      );
    }

    const { data: supabaseData, error } = await this.supabase.auth.signUp({
      email: data.email,
      password: data.senha,
    });

    if (error || !supabaseData.user) {
      throw new ConflictException(
        error?.message ?? 'Erro ao criar usuário no Supabase',
      );
    }

    const usuario = await (this.prisma.usuario.create as any)({
      data: {
        nome: data.nome,
        email: data.email,
        cpf: data.cpf,
        telefone: data.telefone,
        supabaseId: supabaseData.user.id,
        perfil: data.perfil ?? PerfilUsuario.COOPERADO,
      },
    });

    const token = this.assinarToken(usuario.id, usuario.email, usuario.perfil);
    return { token, usuario: this.formatarUsuario(usuario) };
  }

  async login(identificador: string, senha: string) {
    if (!identificador || !senha) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    let email = identificador;

    if (!identificador.includes('@')) {
      const usuario = await this.prisma.usuario.findFirst({
        where: {
          OR: [{ cpf: identificador }, { telefone: identificador }],
        },
      });

      if (!usuario) {
        throw new UnauthorizedException('Credenciais inválidas');
      }

      email = usuario.email;
    }

    const { data: supabaseData, error } =
      await this.supabase.auth.signInWithPassword({ email, password: senha });

    if (error || !supabaseData.user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const usuario: any = await this.prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      throw new InternalServerErrorException(
        'Usuário não encontrado na base local',
      );
    }

    const token = this.assinarToken(usuario.id, usuario.email, usuario.perfil);
    return { token, usuario: this.formatarUsuario(usuario) };
  }

  async esqueciSenha(emailOuIdentificador: string) {
    let email = emailOuIdentificador;

    // Se não for email, buscar o email do usuário
    if (!emailOuIdentificador.includes('@')) {
      const usuario = await this.buscarPorIdentificador(emailOuIdentificador);
      if (!usuario) {
        return { ok: true, mensagem: 'Se o email existir, você receberá um link de redefinição.' };
      }
      email = usuario.email;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${frontendUrl}/redefinir-senha`,
    });
    return { ok: true, mensagem: 'Se o email existir, você receberá um link de redefinição.' };
  }

  async redefinirSenha(accessToken: string, novaSenha: string, resetToken?: string) {
    // Fluxo via token WhatsApp (resetToken próprio)
    if (resetToken) {
      const usuario: any = await this.prisma.usuario.findFirst({
        where: { resetToken },
      });
      if (!usuario || !usuario.resetTokenExpiry || new Date() > usuario.resetTokenExpiry) {
        throw new UnauthorizedException('Token inválido ou expirado');
      }
      if (!usuario.supabaseId) {
        throw new BadRequestException('Usuário sem vinculação Supabase');
      }
      const { error } = await this.supabase.auth.admin.updateUserById(usuario.supabaseId, {
        password: novaSenha,
      });
      if (error) {
        throw new BadRequestException(error.message);
      }
      await (this.prisma.usuario.update as any)({
        where: { id: usuario.id },
        data: { resetToken: null, resetTokenExpiry: null },
      });
      return { ok: true };
    }

    // Fluxo via Supabase access_token (email)
    const { data: { user }, error: sessionError } = await this.supabase.auth.getUser(accessToken);
    if (sessionError || !user) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
    const { error } = await this.supabase.auth.admin.updateUserById(user.id, {
      password: novaSenha,
    });
    if (error) {
      throw new BadRequestException(error.message);
    }
    return { ok: true };
  }

  async alterarSenha(usuarioId: string, senhaAtual: string, novaSenha: string) {
    const usuario: any = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const { error: loginError } = await this.supabase.auth.signInWithPassword({
      email: usuario.email,
      password: senhaAtual,
    });
    if (loginError) {
      throw new UnauthorizedException('Senha atual incorreta');
    }

    const { error } = await this.supabase.auth.admin.updateUserById(usuario.supabaseId, {
      password: novaSenha,
    });
    if (error) {
      throw new BadRequestException(error.message);
    }
    return { ok: true };
  }

  async criarUsuario(
    data: { email: string; senha: string; perfil: string; nome: string; cooperativaId?: string },
    adminUser: any,
  ) {
    if (adminUser.perfil === PerfilUsuario.ADMIN) {
      if (!adminUser.cooperativaId) {
        throw new ForbiddenException('Admin sem cooperativa associada');
      }
      if (data.cooperativaId && data.cooperativaId !== adminUser.cooperativaId) {
        throw new ForbiddenException('Você só pode criar usuários na sua cooperativa');
      }
      data.cooperativaId = adminUser.cooperativaId;
    }

    const existente = await this.prisma.usuario.findFirst({
      where: { email: data.email },
    });
    if (existente) {
      throw new ConflictException('Já existe um usuário com esse email');
    }

    const { data: supabaseData, error } = await this.supabase.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
    });
    if (error || !supabaseData.user) {
      throw new ConflictException(error?.message ?? 'Erro ao criar usuário no Supabase');
    }

    const usuario = await (this.prisma.usuario.create as any)({
      data: {
        nome: data.nome,
        email: data.email,
        supabaseId: supabaseData.user.id,
        perfil: data.perfil,
        cooperativaId: data.cooperativaId || null,
      },
      select: {
        id: true, nome: true, email: true, perfil: true,
        cooperativaId: true, ativo: true, createdAt: true,
      },
    });
    return usuario;
  }

  async atualizarUsuario(
    id: string,
    data: { email?: string; nome?: string; perfil?: string; ativo?: boolean },
    adminUser: any,
  ) {
    const usuario: any = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    if (adminUser.perfil === PerfilUsuario.ADMIN && usuario.cooperativaId !== adminUser.cooperativaId) {
      throw new ForbiddenException('Sem permissão para editar este usuário');
    }

    if (data.email && data.email !== usuario.email && usuario.supabaseId) {
      const { error } = await this.supabase.auth.admin.updateUserById(usuario.supabaseId, {
        email: data.email,
      });
      if (error) throw new BadRequestException(error.message);
    }

    const atualizado = await (this.prisma.usuario.update as any)({
      where: { id },
      data: {
        ...(data.email !== undefined && { email: data.email }),
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.perfil !== undefined && { perfil: data.perfil }),
        ...(data.ativo !== undefined && { ativo: data.ativo }),
      },
      select: {
        id: true, nome: true, email: true, perfil: true,
        cooperativaId: true, ativo: true, createdAt: true,
      },
    });
    return atualizado;
  }

  async listarUsuarios(adminUser: any) {
    const where: any = {};
    if (adminUser.perfil === PerfilUsuario.ADMIN) {
      where.cooperativaId = adminUser.cooperativaId;
    }

    return this.prisma.usuario.findMany({
      where,
      select: {
        id: true, email: true, perfil: true, nome: true,
        cooperativaId: true, ativo: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deletarUsuario(id: string) {
    const usuario: any = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    if (usuario.supabaseId) {
      await this.supabase.auth.admin.deleteUser(usuario.supabaseId);
    }
    await this.prisma.usuario.delete({ where: { id } });
    return { ok: true };
  }

  async enviarResetSenhaPorAdmin(id: string) {
    const usuario: any = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuário não encontrado');

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    await this.supabase.auth.resetPasswordForEmail(usuario.email, {
      redirectTo: `${frontendUrl}/redefinir-senha`,
    });
    return { ok: true };
  }

  async verificarCanal(identificador: string) {
    const usuario = await this.buscarPorIdentificador(identificador);
    if (!usuario) {
      return { temWhatsapp: false, temEmail: false };
    }
    return {
      temWhatsapp: !!usuario.telefone,
      temEmail: !!usuario.email,
      telefone: usuario.telefone ? this.mascararTelefone(usuario.telefone) : undefined,
      email: usuario.email ? this.mascararEmail(usuario.email) : undefined,
    };
  }

  async esqueciSenhaWhatsapp(identificador: string) {
    const usuario: any = await this.buscarPorIdentificador(identificador);
    if (!usuario) {
      return { ok: true, mensagem: 'Se o usuário existir, receberá um link.' };
    }

    if (!usuario.telefone) {
      throw new BadRequestException('Usuário não possui telefone cadastrado');
    }

    const token = randomUUID();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await (this.prisma.usuario.update as any)({
      where: { id: usuario.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const link = `${frontendUrl}/redefinir-senha?token=${token}`;

    const texto = `Olá, ${usuario.nome}! 👋\n\nVocê solicitou redefinição de senha no CoopereBR.\n\nClique no link abaixo para criar uma nova senha (válido por 1 hora):\n\n${link}\n\nSe não foi você, ignore esta mensagem.`;

    await this.whatsappSender.enviarMensagem(usuario.telefone, texto, {
      tipoDisparo: 'RESET_SENHA',
      cooperadoId: usuario.id,
      cooperativaId: usuario.cooperativaId ?? undefined,
    });

    return {
      canal: 'whatsapp',
      telefone: this.mascararTelefone(usuario.telefone),
    };
  }

  private async buscarPorIdentificador(identificador: string) {
    const trimmed = identificador.trim();
    return this.prisma.usuario.findFirst({
      where: {
        OR: [
          { email: trimmed },
          { cpf: trimmed },
          { telefone: trimmed },
        ],
      },
    });
  }

  private mascararTelefone(telefone: string): string {
    const digits = telefone.replace(/\D/g, '');
    if (digits.length >= 8) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)}****-${digits.slice(-4)}`;
    }
    return '****' + telefone.slice(-4);
  }

  private mascararEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const masked = local.slice(0, 1) + '***';
    return `${masked}@${domain}`;
  }

  private assinarToken(sub: string, email: string, perfil: PerfilUsuario) {
    return this.jwtService.sign({ sub, email, perfil });
  }

  private formatarUsuario(usuario: {
    id: string;
    nome: string;
    email: string;
    cpf: string | null;
    telefone: string | null;
    perfil: PerfilUsuario;
  }) {
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      cpf: usuario.cpf,
      telefone: usuario.telefone,
      perfil: usuario.perfil,
    };
  }
}
