import { Controller, Get, Put, Delete, Param, Body, Req } from '@nestjs/common';
import { ConfigTenantService } from './config-tenant.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

@Controller('config-tenant')
export class ConfigTenantController {
  constructor(private readonly service: ConfigTenantService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get(':chave')
  get(@Param('chave') chave: string, @Req() req: any) {
    return this.service.get(chave, req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put(':chave')
  set(
    @Param('chave') chave: string,
    @Body() body: { valor: string; descricao?: string },
    @Req() req: any,
  ) {
    return this.service.set(chave, body.valor, req.user.cooperativaId, body.descricao);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':chave')
  remove(@Param('chave') chave: string, @Req() req: any) {
    return this.service.remove(chave, req.user.cooperativaId);
  }
}
