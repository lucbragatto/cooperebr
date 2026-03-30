import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { MigracoesUsinaService } from './migracoes-usina.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

/**
 * Retorna cooperativaId APENAS do token JWT, nunca do body.
 * ADMIN/OPERADOR devem sempre ter cooperativaId no token; SUPER_ADMIN pode não ter.
 * Lança ForbiddenException se um ADMIN/OPERADOR tentar operar sem cooperativaId no token.
 */
function tenantId(req: any, required = true): string | null {
  const id: string | undefined = req.user?.cooperativaId;
  const perfil: string | undefined = req.user?.perfil;
  const isSuperAdmin = perfil === PerfilUsuario.SUPER_ADMIN;
  if (!id && !isSuperAdmin && required) {
    throw new ForbiddenException('Token sem cooperativaId — acesso negado.');
  }
  return id ?? null;
}

@Controller('migracoes-usina')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MigracoesUsinaController {
  constructor(private readonly service: MigracoesUsinaService) {}

  @Post('cooperado')
  @Roles(ADMIN, SUPER_ADMIN)
  async migrarCooperado(@Body() body: any, @Req() req: any) {
    return this.service.migrarCooperado({
      cooperadoId: body.cooperadoId,
      usinaDestinoId: body.usinaDestinoId,
      kwhNovo: body.kwhNovo ? Number(body.kwhNovo) : undefined,
      percentualNovo: body.percentualNovo ? Number(body.percentualNovo) : undefined,
      motivo: body.motivo,
      realizadoPorId: req.user.id,
      // SEC-07: cooperativaId sempre do token, nunca do body
      cooperativaId: tenantId(req),
      contratoId: body.contratoId || undefined,
    });
  }

  @Post('ajustar-kwh')
  @Roles(ADMIN, SUPER_ADMIN)
  async ajustarKwh(@Body() body: any, @Req() req: any) {
    return this.service.ajustarKwh({
      cooperadoId: body.cooperadoId,
      kwhNovo: body.kwhNovo ? Number(body.kwhNovo) : undefined,
      percentualNovo: body.percentualNovo ? Number(body.percentualNovo) : undefined,
      motivo: body.motivo,
      realizadoPorId: req.user.id,
      // SEC-07: cooperativaId sempre do token, nunca do body
      cooperativaId: tenantId(req),
      contratoId: body.contratoId || undefined,
    });
  }

  @Post('usina-total')
  @Roles(SUPER_ADMIN)
  async migrarTodosDeUsina(@Body() body: any, @Req() req: any) {
    return this.service.migrarTodosDeUsina({
      usinaOrigemId: body.usinaOrigemId,
      usinaDestinoId: body.usinaDestinoId,
      motivo: body.motivo,
      realizadoPorId: req.user.id,
      cooperativaId: tenantId(req, false),
    });
  }

  @Get('lista-concessionaria/:usinaId')
  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  async gerarListaConcessionaria(@Param('usinaId') usinaId: string, @Req() req: any) {
    // SEC-05: cooperativaId sempre do token; SUPER_ADMIN recebe null e acessa tudo
    return this.service.gerarListaConcessionaria(usinaId, tenantId(req));
  }

  @Get('dual-lista')
  @Roles(ADMIN, SUPER_ADMIN)
  async gerarRelatorioDualLista(
    @Query('usinaOrigemId') usinaOrigemId: string,
    @Query('usinaDestinoId') usinaDestinoId: string,
    @Req() req: any,
  ) {
    return this.service.gerarRelatorioDualLista(usinaOrigemId, usinaDestinoId, tenantId(req));
  }

  @Get('historico/:cooperadoId')
  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  async historicoCooperado(@Param('cooperadoId') cooperadoId: string, @Req() req: any) {
    // SEC-05: histórico filtrado por tenant
    return this.service.historicoCooperado(cooperadoId, tenantId(req));
  }

  @Get('historico-usina/:usinaId')
  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  async historicoUsina(@Param('usinaId') usinaId: string, @Req() req: any) {
    // SEC-05: histórico filtrado por tenant
    return this.service.historicoUsina(usinaId, tenantId(req));
  }
}
