import { Controller, Get, Param, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { ConveniosService } from './convenios.service';

@Controller('convenios')
export class ConveniosPortalController {
  constructor(private readonly conveniosService: ConveniosService) {}

  @Roles(PerfilUsuario.COOPERADO, PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Get('meus')
  meusConvenios(@Req() req: any) {
    return this.conveniosService.meusConvenios(req.user.cooperadoId);
  }

  @Roles(PerfilUsuario.COOPERADO, PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Get('meus/:id/dashboard')
  dashboardConveniado(@Param('id') id: string, @Req() req: any) {
    return this.conveniosService.dashboardConveniado(id, req.user.cooperadoId);
  }
}
