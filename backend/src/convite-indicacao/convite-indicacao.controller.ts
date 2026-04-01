import { Controller, Get, Post, Patch, Param, Query, Req } from '@nestjs/common';
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
    return this.service.listarConvitesPendentes(req.user?.cooperativaId, {
      status,
      diasSemAcao: diasSemAcao ? Number(diasSemAcao) : undefined,
      indicadorId,
      page: page ? Number(page) : 1,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('estatisticas')
  estatisticas(@Req() req: any) {
    return this.service.getEstatisticas(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post(':id/reenviar')
  reenviar(@Param('id') id: string) {
    return this.service.reenviarConvite(id);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch(':id/cancelar')
  cancelar(@Param('id') id: string) {
    return this.service.cancelarConvite(id);
  }
}
