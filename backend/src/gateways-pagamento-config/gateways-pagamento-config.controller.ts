import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { GatewaysPagamentoConfigService } from './gateways-pagamento-config.service';
import { CriarGatewayDto } from './dto/criar-gateway.dto';
import { AtualizarGatewayDto } from './dto/atualizar-gateway.dto';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { AuditLog } from '../audit/audit-log.decorator';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

/**
 * Endpoints administrativos do modulo gateways-pagamento-config.
 *
 * Sub-Sprint Gateways de Pagamento — Fatia F1 Etapa F (M27, 2026-05-26).
 *
 * 8 endpoints:
 *   GET    /gateways-pagamento/suportados         — registry publico
 *   GET    /gateways-pagamento                    — lista do tenant (mascarado)
 *   GET    /gateways-pagamento/me/ativo?tipo=X    — ativo do tipo (uso interno F3)
 *   GET    /gateways-pagamento/:id                — detalhe (mascarado)
 *   POST   /gateways-pagamento                    — criar
 *   PATCH  /gateways-pagamento/:id                — atualizar
 *   DELETE /gateways-pagamento/:id                — remover
 *   POST   /gateways-pagamento/:id/testar         — smoke conexao
 *
 * Auth: JWT global (APP_GUARD AppModule). @Roles(SUPER_ADMIN, ADMIN).
 * @AuditLog em mutations.
 *
 * NOTA: /me/ativo precisa vir ANTES de /:id no codigo do Nest pra nao
 * ser interpretado como id='me'.
 */
@Controller('gateways-pagamento')
export class GatewaysPagamentoConfigController {
  private readonly logger = new Logger(GatewaysPagamentoConfigController.name);

  constructor(private readonly service: GatewaysPagamentoConfigService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('suportados')
  listarSuportados() {
    return this.service.listarTiposSuportados();
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('me/ativo')
  async buscarAtivoPorTipo(
    @Req() req: any,
    @Query('tipo') tipo: string,
    @Query('cooperativaId') queryCoopId?: string,
  ) {
    if (!tipo) {
      throw new BadRequestException('query param "tipo" obrigatorio (ex: tipo=ASAAS).');
    }
    const cooperativaId = this.resolverTenantQuery(req, queryCoopId);
    return this.service.buscarAtivoPorTipo(cooperativaId, tipo);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  async listar(@Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = this.resolverTenantQuery(req, queryCoopId);
    return this.service.listar(cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get(':id')
  async buscar(
    @Param('id') id: string,
    @Req() req: any,
    @Query('cooperativaId') queryCoopId?: string,
  ) {
    const cooperativaId = this.resolverTenantQuery(req, queryCoopId);
    return this.service.buscarPorId(id, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'gateway.config.criar', recurso: 'ConfigGateway' })
  @Post()
  async criar(@Body() dto: CriarGatewayDto, @Req() req: any) {
    const ehSuperAdmin = req.user?.perfil === SUPER_ADMIN;
    return this.service.criar(dto, req.user?.cooperativaId, ehSuperAdmin);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'gateway.config.atualizar', recurso: 'ConfigGateway', recursoIdParam: 'id' })
  @Patch(':id')
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarGatewayDto,
    @Req() req: any,
    @Query('cooperativaId') queryCoopId?: string,
  ) {
    const cooperativaId = this.resolverTenantQuery(req, queryCoopId);
    return this.service.atualizar(id, dto, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'gateway.config.remover', recurso: 'ConfigGateway', recursoIdParam: 'id' })
  @Delete(':id')
  async remover(
    @Param('id') id: string,
    @Req() req: any,
    @Query('cooperativaId') queryCoopId?: string,
  ) {
    const cooperativaId = this.resolverTenantQuery(req, queryCoopId);
    return this.service.remover(id, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'gateway.config.testar', recurso: 'ConfigGateway', recursoIdParam: 'id' })
  @Post(':id/testar')
  async testar(
    @Param('id') id: string,
    @Req() req: any,
    @Query('cooperativaId') queryCoopId?: string,
  ) {
    const cooperativaId = this.resolverTenantQuery(req, queryCoopId);
    return this.service.testarConexao(id, cooperativaId);
  }

  /**
   * Resolve cooperativaId pra endpoints GET/PATCH/DELETE: SUPER_ADMIN pode
   * passar via query (sem cooperativaId no JWT); ADMIN sempre usa o JWT.
   */
  private resolverTenantQuery(req: any, queryCoopId: string | undefined): string {
    const ehSuperAdmin = req.user?.perfil === SUPER_ADMIN;
    if (ehSuperAdmin) {
      const escolhido = queryCoopId ?? req.user?.cooperativaId;
      if (!escolhido) {
        throw new BadRequestException(
          'SUPER_ADMIN deve informar cooperativaId via query param.',
        );
      }
      return escolhido;
    }
    const jwt = req.user?.cooperativaId;
    if (!jwt) {
      throw new BadRequestException('cooperativaId nao identificado no JWT.');
    }
    if (queryCoopId && queryCoopId !== jwt) {
      throw new BadRequestException(
        'ADMIN nao pode operar gateway de outra cooperativa.',
      );
    }
    return jwt;
  }
}
