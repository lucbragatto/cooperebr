import { Controller, Get, Put, Param, Body, Req, Query, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ClubeVantagensService } from './clube-vantagens.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, COOPERADO } = PerfilUsuario;

@Controller('clube-vantagens')
export class ClubeVantagensController {
  constructor(private readonly service: ClubeVantagensService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('config')
  getConfig(@Req() req: any, @Query('cooperativaId') qCoopId?: string) {
    const cooperativaId = req.user?.cooperativaId || qCoopId;
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId é obrigatório. Selecione uma cooperativa.');
    }
    return this.service.getConfig(cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put('config')
  upsertConfig(@Req() req: any, @Body() body: any) {
    const cooperativaId = req.user?.cooperativaId || body.cooperativaId;
    if (!cooperativaId) {
      throw new BadRequestException('cooperativaId é obrigatório. Selecione uma cooperativa antes de salvar.');
    }
    return this.service.upsertConfig(cooperativaId, body);
  }

  @Roles(COOPERADO, ADMIN, SUPER_ADMIN)
  @Get('minha-progressao')
  getMinhaProgressao(@Req() req: any) {
    const cooperadoId = req.user?.cooperadoId;
    if (!cooperadoId) throw new ForbiddenException('Cooperado não identificado');
    return this.service.getProgressao(cooperadoId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('cooperado/:id')
  getProgressaoCooperado(@Param('id') id: string) {
    return this.service.getProgressao(id);
  }

  /**
   * GET /clube-vantagens/ranking?periodo=mes|ano|total
   * Top 10 indicadores por kWh indicado acumulado.
   * - periodo=mes   → apenas histórico deste mês
   * - periodo=ano   → apenas histórico deste ano
   * - periodo=total → acumulado geral (padrão)
   */
  @Roles(COOPERADO, ADMIN, SUPER_ADMIN)
  @Get('ranking')
  getRanking(
    @Req() req: any,
    @Query('periodo') periodo?: 'mes' | 'ano' | 'total',
  ) {
    return this.service.getRankingPorPeriodo(
      req.user?.cooperativaId,
      req.user?.cooperadoId,
      periodo ?? 'total',
    );
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('analytics')
  getAnalytics(@Req() req: any) {
    return this.service.getAnalytics(req.user?.cooperativaId);
  }

  /**
   * GET /clube-vantagens/analytics/mensal?meses=6
   * Evolução mensal de novos membros por nível (para gráfico de barras)
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @Get('analytics/mensal')
  getAnalyticsMensal(@Req() req: any, @Query('meses') meses?: string) {
    return this.service.getEvolucaoMensalNiveis(req.user?.cooperativaId, meses ? parseInt(meses) : 6);
  }

  /**
   * GET /clube-vantagens/analytics/funil
   * Mapa de calor: conversão por etapa do funil de indicação
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @Get('analytics/funil')
  getAnalyticsFunil(@Req() req: any) {
    return this.service.getFunilConversao(req.user?.cooperativaId);
  }
}
