import { Controller, Get, Put, Post, Param, Body, Req } from '@nestjs/common';
import { ModelosCobrancaService } from './modelos-cobranca.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

@Controller('modelos-cobranca')
export class ModelosCobrancaController {
  constructor(private readonly service: ModelosCobrancaService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>, @Req() req: any) {
    const isSA = req.user?.perfil === SUPER_ADMIN;
    return this.service.update(id, body, req.user?.cooperativaId ?? null, isSA);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post(':id/ativar')
  ativar(@Param('id') id: string, @Req() req: any) {
    const isSA = req.user?.perfil === SUPER_ADMIN;
    return this.service.ativar(id, req.user?.cooperativaId ?? null, isSA);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post(':id/desativar')
  desativar(@Param('id') id: string, @Req() req: any) {
    const isSA = req.user?.perfil === SUPER_ADMIN;
    return this.service.desativar(id, req.user?.cooperativaId ?? null, isSA);
  }
}
