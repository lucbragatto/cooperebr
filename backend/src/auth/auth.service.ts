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
import { PerfilUsuario } from './perfil.enum';

@Injectable()
export class AuthService {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
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

  async esqueciSenha(email: string) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${frontendUrl}/redefinir-senha`,
    });
    return { ok: true, mensagem: 'Se o email existir, você receberá um link de redefinição.' };
  }

  async redefinirSenha(accessToken: string, novaSenha: string) {
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
