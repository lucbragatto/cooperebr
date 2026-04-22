import { Controller, Get, Put, Post, Patch, Body, Param, Query, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConviteIndicacaoService } from './convite-indicacao.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { StatusConvite } from '@prisma/client';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

// Sprint 8A: SUPER_ADMIN não tem cooperativaId no JWT — aceita via query.
// Mesmo padrão aplicado em asaas.controller.ts (Sprint 7).
function resolverCooperativaId(req: any, queryCoopId?: string): string | undefined {
  const id = req.user?.cooperativaId || queryCoopId;
  if (!id && req.user?.perfil !== 'SUPER_ADMIN') throw new UnauthorizedException();
  return id || undefined;
}

@Controller('convite-indicacao')
export class ConviteIndicacaoController {
  constructor(private readonly service: ConviteIndicacaoService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  listar(
    @Req() req: any,
    @Query('status') status?: StatusConvite,
    @Query('diasSemAcao') diasSemAcao?: string,
    @Query('indicadorId') indicadorId?: string,
    @Query('page') page?: string,
    @Query('cooperativaId') queryCoopId?: string,
  ) {
    const cooperativaId = resolverCooperativaId(req, queryCoopId);
    return this.service.listarConvitesPendentes(cooperativaId as string, {
      status,
      diasSemAcao: diasSemAcao ? Number(diasSemAcao) : undefined,
      indicadorId,
      page: page ? Number(page) : 1,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('dashboard')
  dashboard(
    @Req() req: any,
    @Query('status') status?: StatusConvite,
    @Query('periodo') periodo?: string,
    @Query('page') page?: string,
    @Query('cooperativaId') queryCoopId?: string,
  ) {
    const cooperativaId = resolverCooperativaId(req, queryCoopId);
    return this.service.getDashboard(cooperativaId as string, {
      status,
      periodo: periodo ? Number(periodo) : undefined,
      page: page ? Number(page) : 1,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('stats')
  stats(@Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = resolverCooperativaId(req, queryCoopId);
    return this.service.getStats(cooperativaId as string);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('estatisticas')
  estatisticas(@Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = resolverCooperativaId(req, queryCoopId);
    return this.service.getEstatisticas(cooperativaId as string);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('config-lembretes')
  getConfigLembretes(@Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = resolverCooperativaId(req, queryCoopId);
    return this.service.getConfigLembretes(cooperativaId as string);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put('config-lembretes')
  salvarConfigLembretes(
    @Req() req: any,
    @Body() body: { cooldownDias: number; maxTentativas: number; habilitado: boolean; cooperativaId?: string },
  ) {
    const cooperativaId = resolverCooperativaId(req, body.cooperativaId);
    if (body.cooldownDias == null || body.maxTentativas == null || body.habilitado == null) {
      throw new BadRequestException('cooldownDias, maxTentativas e habilitado são obrigatórios');
    }
    if (body.cooldownDias < 1) throw new BadRequestException('cooldownDias deve ser >= 1');
    if (body.maxTentativas < 1) throw new BadRequestException('maxTentativas deve ser >= 1');
    return this.service.salvarConfigLembretes(cooperativaId as string, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post(':id/reenviar')
  reenviar(@Param('id') id: string, @Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = resolverCooperativaId(req, queryCoopId);
    return this.service.reenviarConvite(id, cooperativaId as string);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch(':id/cancelar')
  cancelar(@Param('id') id: string, @Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = resolverCooperativaId(req, queryCoopId);
    return this.service.cancelarConvite(id, cooperativaId as string);
  }
}
