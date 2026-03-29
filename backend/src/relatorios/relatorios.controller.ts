import { Controller, Get, Query, Req } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('inadimplencia')
  inadimplencia(
    @Req() req: any,
    @Query('usinaId') usinaId?: string,
    @Query('cooperativaId') cooperativaId?: string,
    @Query('tipoCooperado') tipoCooperado?: string,
  ) {
    const effectiveCoopId =
      req.user.perfil === SUPER_ADMIN ? cooperativaId : req.user.cooperativaId;
    return this.relatoriosService.inadimplencia({ usinaId, cooperativaId: effectiveCoopId, tipoCooperado });
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('projecao-receita')
  projecaoReceita(@Req() req: any, @Query('meses') meses?: string) {
    const cooperativaId =
      req.user.perfil === SUPER_ADMIN ? undefined : req.user.cooperativaId;
    return this.relatoriosService.projecaoReceita(meses ? parseInt(meses, 10) : 6, cooperativaId);
  }
}
