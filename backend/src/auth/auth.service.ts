import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
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
