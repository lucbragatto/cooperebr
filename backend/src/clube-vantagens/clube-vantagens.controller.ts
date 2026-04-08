import { Controller, Get, Put, Post, Param, Body, Req, Query, ForbiddenException, BadRequestException } from '@nestjs/common';
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
    if (!cooperadoId) {
      const perfil = req.user?.perfil;
      if (perfil === 'ADMIN' || perfil === 'SUPER_ADMIN') {
        return { nivel: null, pontos: 0, semCooperado: true };
      }
      throw new ForbiddenException('Cooperado não identificado');
    }
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

  // ─── Ofertas ──────────────────────────────

  /** Lista ofertas ativas (cooperado) */
  @Roles(COOPERADO, ADMIN, SUPER_ADMIN)
  @Get('ofertas')
  listarOfertas(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) throw new BadRequestException('cooperativaId obrigatorio');
    return this.service.listarOfertas(cooperativaId);
  }

  /** Lista todas as ofertas (admin) */
  @Roles(SUPER_ADMIN, ADMIN)
  @Get('ofertas/admin')
  listarOfertasAdmin(@Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) throw new BadRequestException('cooperativaId obrigatorio');
    return this.service.listarOfertasAdmin(cooperativaId);
  }

  /** Criar oferta (admin) */
  @Roles(SUPER_ADMIN, ADMIN)
  @Post('ofertas')
  criarOferta(@Req() req: any, @Body() body: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) throw new BadRequestException('cooperativaId obrigatorio');
    return this.service.criarOferta(cooperativaId, body);
  }

  /** Atualizar oferta (admin) */
  @Roles(SUPER_ADMIN, ADMIN)
  @Put('ofertas/:id')
  atualizarOferta(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) throw new BadRequestException('cooperativaId obrigatorio');
    return this.service.atualizarOferta(cooperativaId, id, body);
  }

  // ─── Resgate ──────────────────────────────

  /** Resgatar oferta (cooperado) */
  @Roles(COOPERADO)
  @Post('resgatar')
  resgatar(@Req() req: any, @Body() body: { ofertaId: string }) {
    const cooperadoId = req.user?.cooperadoId;
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperadoId) throw new ForbiddenException('Cooperado nao identificado');
    if (!cooperativaId) throw new BadRequestException('cooperativaId obrigatorio');
    if (!body.ofertaId) throw new BadRequestException('ofertaId obrigatorio');
    return this.service.resgatarOferta(cooperadoId, cooperativaId, body.ofertaId);
  }

  /** Meus resgates (cooperado) */
  @Roles(COOPERADO, ADMIN, SUPER_ADMIN)
  @Get('meus-resgates')
  meusResgates(@Req() req: any) {
    const cooperadoId = req.user?.cooperadoId;
    if (!cooperadoId) return [];
    return this.service.meusResgates(cooperadoId);
  }

  /** Validar código de resgate (admin/parceiro) */
  @Roles(SUPER_ADMIN, ADMIN)
  @Post('validar-resgate')
  validarResgate(@Req() req: any, @Body() body: { codigoResgate: string }) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) throw new BadRequestException('cooperativaId obrigatorio');
    if (!body.codigoResgate) throw new BadRequestException('codigoResgate obrigatorio');
    return this.service.validarResgate(cooperativaId, body.codigoResgate);
  }
}
