import { Controller, Get, Query, Req } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import { RelatoriosQueryService } from './relatorios-query.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('relatorios')
export class RelatoriosController {
  constructor(
    private readonly relatoriosService: RelatoriosService,
    private readonly queryService: RelatoriosQueryService,
  ) {}

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
    // Delega ao query service quando temos cooperativaId (tenant isolation)
    if (effectiveCoopId) {
      return this.queryService.inadimplencia({ cooperativaId: effectiveCoopId, usinaId, tipoCooperado });
    }
    // Fallback para SUPER_ADMIN sem cooperativaId
    return this.relatoriosService.inadimplencia({ usinaId, cooperativaId: effectiveCoopId, tipoCooperado });
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('projecao-receita')
  projecaoReceita(@Req() req: any, @Query('meses') meses?: string) {
    const cooperativaId =
      req.user.perfil === SUPER_ADMIN ? undefined : req.user.cooperativaId;
    return this.relatoriosService.projecaoReceita(meses ? parseInt(meses, 10) : 6, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('producao-vs-cobranca')
  producaoVsCobranca(
    @Req() req: any,
    @Query('cooperativaId') cooperativaId?: string,
    @Query('competencia') competencia?: string,
  ) {
    const effectiveCoopId =
      req.user.perfil === SUPER_ADMIN ? cooperativaId : req.user.cooperativaId;
    if (!effectiveCoopId) {
      return { error: 'cooperativaId é obrigatório' };
    }
    const comp = competencia ?? new Date().toISOString().slice(0, 7);
    return this.queryService.producaoVsCobranca(effectiveCoopId, comp);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('conferencia-kwh')
  conferenciaKwh(
    @Req() req: any,
    @Query('competencia') competencia?: string,
    @Query('cooperativaId') cooperativaId?: string,
  ) {
    const effectiveCoopId =
      req.user.perfil === SUPER_ADMIN ? cooperativaId : req.user.cooperativaId;
    if (!effectiveCoopId) {
      return { error: 'cooperativaId é obrigatório' };
    }
    const comp = competencia ?? new Date().toISOString().slice(0, 7);
    return this.queryService.conferenciaKwh(effectiveCoopId, comp);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('geracao-por-usina')
  geracaoPorUsina(
    @Req() req: any,
    @Query('usinaId') usinaId: string,
    @Query('ano') ano?: string,
    @Query('cooperativaId') cooperativaId?: string,
  ) {
    const effectiveCoopId =
      req.user.perfil === SUPER_ADMIN ? cooperativaId : req.user.cooperativaId;
    if (!effectiveCoopId) {
      return { error: 'cooperativaId é obrigatório' };
    }
    const anoNum = ano ? parseInt(ano, 10) : new Date().getFullYear();
    return this.queryService.geracaoPorUsina(usinaId, anoNum, effectiveCoopId);
  }
}
