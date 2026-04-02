import { Controller, Get, Put, Post, Patch, Body, Param, Query, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConviteIndicacaoService } from './convite-indicacao.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { StatusConvite } from '@prisma/client';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

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
  ) {
    if (!req.user?.cooperativaId) throw new UnauthorizedException();
    return this.service.listarConvitesPendentes(req.user.cooperativaId, {
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
  ) {
    if (!req.user?.cooperativaId) throw new UnauthorizedException();
    return this.service.getDashboard(req.user.cooperativaId, {
      status,
      periodo: periodo ? Number(periodo) : undefined,
      page: page ? Number(page) : 1,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('stats')
  stats(@Req() req: any) {
    if (!req.user?.cooperativaId) throw new UnauthorizedException();
    return this.service.getStats(req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('estatisticas')
  estatisticas(@Req() req: any) {
    if (!req.user?.cooperativaId) throw new UnauthorizedException();
    return this.service.getEstatisticas(req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('config-lembretes')
  getConfigLembretes(@Req() req: any) {
    if (!req.user?.cooperativaId) throw new UnauthorizedException();
    return this.service.getConfigLembretes(req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put('config-lembretes')
  salvarConfigLembretes(
    @Req() req: any,
    @Body() body: { cooldownDias: number; maxTentativas: number; habilitado: boolean },
  ) {
    if (!req.user?.cooperativaId) throw new UnauthorizedException();
    if (body.cooldownDias == null || body.maxTentativas == null || body.habilitado == null) {
      throw new BadRequestException('cooldownDias, maxTentativas e habilitado são obrigatórios');
    }
    if (body.cooldownDias < 1) throw new BadRequestException('cooldownDias deve ser >= 1');
    if (body.maxTentativas < 1) throw new BadRequestException('maxTentativas deve ser >= 1');
    return this.service.salvarConfigLembretes(req.user.cooperativaId, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post(':id/reenviar')
  reenviar(@Param('id') id: string, @Req() req: any) {
    if (!req.user?.cooperativaId) throw new UnauthorizedException();
    return this.service.reenviarConvite(id, req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch(':id/cancelar')
  cancelar(@Param('id') id: string, @Req() req: any) {
    if (!req.user?.cooperativaId) throw new UnauthorizedException();
    return this.service.cancelarConvite(id, req.user.cooperativaId);
  }
}
