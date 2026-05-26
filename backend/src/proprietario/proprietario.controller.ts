import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ProprietarioService } from './proprietario.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, COOPERADO, PROPRIETARIO } = PerfilUsuario;

/**
 * Sub-Sprint F Sessao 1 MVP+ Etapa D (M30, 2026-05-26).
 *
 * Endpoints REST do Portal Proprietario. Todos com guard multi-tenant
 * baseado em proprietarioCooperadoId OU proprietarioEmail no JWT do
 * usuario autenticado.
 *
 * Roles aceitas:
 *   - PROPRIETARIO: papel novo (M30) — usuario nao-cooperado dono de usina
 *   - COOPERADO: caminho A (cooperado que tambem e proprietario, ex: Luciano)
 *   - ADMIN/SUPER_ADMIN: impersonate via troca de contexto (auth.service.trocarContexto)
 */
@Controller('proprietario')
export class ProprietarioController {
  constructor(private readonly service: ProprietarioService) {}

  @Roles(SUPER_ADMIN, ADMIN, COOPERADO, PROPRIETARIO)
  @Get('dashboard')
  dashboard(@Req() req: any) {
    return this.service.dashboard(req.user);
  }

  @Roles(SUPER_ADMIN, ADMIN, COOPERADO, PROPRIETARIO)
  @Get('usinas/:id')
  detalheUsina(@Param('id') id: string, @Req() req: any) {
    return this.service.detalheUsina(req.user, id);
  }

  @Roles(SUPER_ADMIN, ADMIN, COOPERADO, PROPRIETARIO)
  @Get('repasses')
  listarRepasses(
    @Req() req: any,
    @Query('usinaId') usinaId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.listarRepasses(req.user, {
      usinaId,
      dataInicio: dataInicio ? new Date(dataInicio) : undefined,
      dataFim: dataFim ? new Date(dataFim) : undefined,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN, COOPERADO, PROPRIETARIO)
  @Get('contratos')
  listarContratos(@Req() req: any, @Query('usinaId') usinaId?: string) {
    return this.service.listarContratos(req.user, { usinaId });
  }

  @Roles(SUPER_ADMIN, ADMIN, COOPERADO, PROPRIETARIO)
  @Get('despesas')
  listarDespesas(@Req() req: any, @Query('usinaId') usinaId?: string) {
    return this.service.listarDespesas(req.user, { usinaId });
  }
}
