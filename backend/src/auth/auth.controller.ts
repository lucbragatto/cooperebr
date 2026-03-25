import { Controller, Post, Get, Put, Delete, Body, Param, UnauthorizedException, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import { Roles } from './roles.decorator';
import { PerfilUsuario } from './perfil.enum';
import { RegisterDto } from './dto/register.dto';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto';
import { IdentificadorDto } from './dto/identificador.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import { AlterarSenhaDto } from './dto/alterar-senha.dto';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register({
      ...dto,
      perfil: PerfilUsuario.COOPERADO,
    });
  }

  @Roles(PerfilUsuario.SUPER_ADMIN)
  @Post('register-admin')
  registerAdmin(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  @HttpCode(200)
  @Post('login')
  login(
    @Body()
    body: {
      identificador: string;
      senha: string;
    },
  ) {
    return this.authService.login(body.identificador, body.senha);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Post('criar-super-admin')
  criarSuperAdmin(
    @Body() body: { nome: string; email: string; senha: string; secretKey: string },
  ) {
    const envSecret = process.env.SUPER_ADMIN_SECRET_KEY;
    if (!envSecret) {
      throw new UnauthorizedException('Endpoint desabilitado');
    }
    const expected = Buffer.from(envSecret);
    const received = Buffer.from(body.secretKey || '');
    if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
      throw new UnauthorizedException('Secret key inválida');
    }
    return this.authService.register({
      nome: body.nome,
      email: body.email,
      senha: body.senha,
      perfil: PerfilUsuario.SUPER_ADMIN,
    });
  }

  @Get('me')
  me(@CurrentUser() usuario: any) {
    return usuario;
  }

  // --- Esqueci / Redefinir Senha ---

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(200)
  @Post('esqueci-senha')
  esqueciSenha(@Body() dto: EsqueciSenhaDto) {
    const valor = dto.email || dto.identificador || '';
    return this.authService.esqueciSenha(valor);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(200)
  @Post('verificar-canal')
  verificarCanal(@Body() dto: IdentificadorDto) {
    return this.authService.verificarCanal(dto.identificador);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(200)
  @Post('esqueci-senha-whatsapp')
  esqueciSenhaWhatsapp(@Body() dto: IdentificadorDto) {
    return this.authService.esqueciSenhaWhatsapp(dto.identificador);
  }

  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(200)
  @Post('redefinir-senha')
  redefinirSenha(@Body() dto: RedefinirSenhaDto) {
    return this.authService.redefinirSenha(dto.access_token ?? '', dto.novaSenha, dto.token);
  }

  // --- Alterar Senha (autenticado) ---

  @HttpCode(200)
  @Post('alterar-senha')
  alterarSenha(@CurrentUser() usuario: any, @Body() dto: AlterarSenhaDto) {
    return this.authService.alterarSenha(usuario.id, dto.senhaAtual, dto.novaSenha);
  }

  // --- CRUD Usuários (ADMIN / SUPER_ADMIN) ---

  @Roles(PerfilUsuario.ADMIN)
  @Post('criar-usuario')
  criarUsuario(@CurrentUser() admin: any, @Body() dto: CriarUsuarioDto) {
    return this.authService.criarUsuario(dto, admin);
  }

  @Roles(PerfilUsuario.ADMIN)
  @Get('usuarios')
  listarUsuarios(@CurrentUser() admin: any) {
    return this.authService.listarUsuarios(admin);
  }

  @Roles(PerfilUsuario.ADMIN)
  @Put('usuarios/:id')
  atualizarUsuario(
    @Param('id') id: string,
    @CurrentUser() admin: any,
    @Body() dto: AtualizarUsuarioDto,
  ) {
    return this.authService.atualizarUsuario(id, dto, admin);
  }

  @Roles(PerfilUsuario.ADMIN)
  @HttpCode(200)
  @Post('usuarios/:id/reset-senha')
  resetSenhaAdmin(@Param('id') id: string) {
    return this.authService.enviarResetSenhaPorAdmin(id);
  }

  @Roles(PerfilUsuario.SUPER_ADMIN)
  @Delete('usuarios/:id')
  deletarUsuario(@Param('id') id: string) {
    return this.authService.deletarUsuario(id);
  }
}
