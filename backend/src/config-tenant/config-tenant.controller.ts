import { Controller, Get, Put, Delete, Param, Body } from '@nestjs/common';
import { ConfigTenantService } from './config-tenant.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

@Controller('config-tenant')
export class ConfigTenantController {
  constructor(private readonly service: ConfigTenantService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get(':chave')
  get(@Param('chave') chave: string) {
    return this.service.get(chave);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put(':chave')
  set(
    @Param('chave') chave: string,
    @Body() body: { valor: string; descricao?: string },
  ) {
    return this.service.set(chave, body.valor, body.descricao);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':chave')
  remove(@Param('chave') chave: string) {
    return this.service.remove(chave);
  }
}
