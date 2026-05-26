import { Controller, Get, Param, Req } from '@nestjs/common';
import { AdminProprietariosService } from './admin-proprietarios.service';
import { Roles } from '../../auth/roles.decorator';
import { PerfilUsuario } from '../../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

/**
 * Sub-Sprint F.5a (M33, 2026-05-27 noite).
 *
 * Dashboard Hierárquico Super Admin + Admin Parceiro pro Portal Proprietário.
 *
 * Rotas:
 *   GET /admin/proprietarios/cooperativas
 *     → SUPER_ADMIN apenas. Grid de cards-resumo com indicadores agregados
 *       de TODAS cooperativas ativas.
 *
 *   GET /admin/proprietarios/cooperativas/:cooperativaId/usinas
 *     → SUPER_ADMIN: qualquer cooperativaId.
 *       ADMIN: somente cooperativaId === req.user.cooperativaId (multi-tenant
 *       enforcement no service via assertion). ADMIN tentando ver outra → 403.
 *
 * Reversão decisão #4 F.5 (M33, Etapa B): ADMIN também tem acesso ao Portal
 * Proprietário, indo direto pra tabela da sua cooperativa (pula grid).
 */
@Controller('admin/proprietarios')
export class AdminProprietariosController {
  constructor(private readonly service: AdminProprietariosService) {}

  @Roles(SUPER_ADMIN)
  @Get('cooperativas')
  listarCooperativasComProprietarios() {
    return this.service.listarCooperativasComProprietarios();
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('cooperativas/:cooperativaId/usinas')
  listarUsinasPorCooperativa(
    @Param('cooperativaId') cooperativaId: string,
    @Req() req: any,
  ) {
    return this.service.listarUsinasPorCooperativa(cooperativaId, req.user);
  }
}
