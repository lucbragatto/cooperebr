import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(
    @Body()
    body: {
      nome: string;
      email: string;
      cpf?: string;
      telefone?: string;
      senha: string;
    },
  ) {
    return this.authService.register(body);
  }

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

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() usuario: any) {
    return usuario;
  }
}
