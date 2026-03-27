import { Controller, Get, Post, Patch, Delete, Param, Body, Req } from '@nestjs/common';
import { AdministradorasService } from './administradoras.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

@Controller('administradoras')
export class AdministradorasController {
  constructor(private readonly service: AdministradorasService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.service.create({
      ...body,
      cooperativaId: body.cooperativaId || req.user?.cooperativaId,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
