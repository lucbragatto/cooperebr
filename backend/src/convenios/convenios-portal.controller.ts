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
    // Bug fix 15/06/2026 (Track B.2 — reviewer P1): passar `cooperativaId`
    // explícito pro service isolar cross-tenant. SUPER_ADMIN puro tem
    // cooperativaId=null e o service retorna [] defensivamente.
    return this.conveniosService.meusConvenios(req.user.cooperadoId, req.user.cooperativaId ?? null);
  }

  @Roles(PerfilUsuario.COOPERADO, PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Get('meus/:id/dashboard')
  dashboardConveniado(@Param('id') id: string, @Req() req: any) {
    return this.conveniosService.dashboardConveniado(id, req.user.cooperadoId, req.user.cooperativaId ?? null);
  }
}
