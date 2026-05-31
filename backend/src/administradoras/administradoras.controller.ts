import { Controller, Get, Post, Patch, Delete, Param, Body, Req, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdministradorasService } from './administradoras.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

/**
 * D-novo-BR F0.1 (31/05/2026):
 * - CA1 PATCH/CA2 DELETE: posse via cooperativaId no service.
 * - AA1 POST: cooperativaId vem do JWT; ADMIN ignora body, SUPER_ADMIN pode override.
 */
@Controller('administradoras')
export class AdministradorasController {
  constructor(private readonly service: AdministradorasService) {}

  private resolverTenant(req: any, bodyCoop?: string): string {
    const perfil = req?.user?.perfil;
    const jwtCoop = req?.user?.cooperativaId;
    if (perfil === SUPER_ADMIN) {
      const target = bodyCoop ?? jwtCoop;
      if (!target) throw new BadRequestException('SUPER_ADMIN deve informar cooperativaId');
      return target;
    }
    if (!jwtCoop) throw new ForbiddenException('Usuario sem cooperativaId no token');
    return jwtCoop;
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post()
  create(@Body() body: any, @Req() req: any) {
    // AA1: body.cooperativaId só vale para SUPER_ADMIN; ADMIN sempre JWT
    const cooperativaId = this.resolverTenant(req, body?.cooperativaId);
    return this.service.create({
      ...body,
      cooperativaId,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.service.findOne(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.update(id, body, req.user?.cooperativaId ?? null);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.service.remove(id, req.user?.cooperativaId ?? null);
  }
}
