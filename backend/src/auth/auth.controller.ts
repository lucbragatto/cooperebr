import { Controller, Post, Get, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import { PerfilUsuario } from './perfil.enum';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(
    @Body()
    body: {
      nome: string;
      email: string;
      cpf?: string;
      telefone?: string;
      senha: string;
      perfil?: PerfilUsuario;
    },
  ) {
    return this.authService.register(body);
  }

  @Public()
  @Post('login')
  login(
    @Body()
    body: {
      identificador: string; // email, CPF ou telefone
      senha: string;
    },
  ) {
    return this.authService.login(body.identificador, body.senha);
  }

  @Get('me')
  me(@CurrentUser() usuario: any) {
    return usuario;
  }
}
