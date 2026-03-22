import { Controller, Post, Get, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import { Roles } from './roles.decorator';
import { PerfilUsuario } from './perfil.enum';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
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
