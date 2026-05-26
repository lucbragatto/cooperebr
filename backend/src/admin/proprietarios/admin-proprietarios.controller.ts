import { Controller, Get, Param } from '@nestjs/common';
import { AdminProprietariosService } from './admin-proprietarios.service';
import { Roles } from '../../auth/roles.decorator';
import { PerfilUsuario } from '../../auth/perfil.enum';

const { SUPER_ADMIN } = PerfilUsuario;

/**
 * Sub-Sprint F.5a (M33, 2026-05-27 noite).
 *
 * Dashboard Hierárquico do Super Admin pro Portal Proprietário.
 *
 * Rotas:
 *   GET /admin/proprietarios/cooperativas
 *     → Grid de cards-resumo: 1 entry por cooperativa com indicadores agregados
 *       (usinas com proprietário, proprietários únicos, YTD, capacidade kWp,
 *       status OK/atenção/crítico, convites pendentes, contratos vencendo 30d).
 *
 *   GET /admin/proprietarios/cooperativas/:cooperativaId/usinas
 *     → Tabela detalhada das usinas+proprietários da cooperativa selecionada.
 *
 * Acesso: SUPER_ADMIN apenas (RolesGuard global aplica 403 pra demais perfis).
 * Multi-tenant: Super Admin tem acesso global por design.
 */
@Roles(SUPER_ADMIN)
@Controller('admin/proprietarios')
export class AdminProprietariosController {
  constructor(private readonly service: AdminProprietariosService) {}

  @Get('cooperativas')
  listarCooperativasComProprietarios() {
    return this.service.listarCooperativasComProprietarios();
  }

  @Get('cooperativas/:cooperativaId/usinas')
  listarUsinasPorCooperativa(@Param('cooperativaId') cooperativaId: string) {
    return this.service.listarUsinasPorCooperativa(cooperativaId);
  }
}
