import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { MonitoramentoUsinasService } from './monitoramento-usinas.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('monitoramento-usinas')
export class MonitoramentoUsinasController {
  constructor(private readonly service: MonitoramentoUsinasService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  getStatusAtual() {
    return this.service.getStatusAtual();
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':usinaId/historico')
  getHistorico(
    @Param('usinaId') usinaId: string,
    @Query('horas') horas: string,
  ) {
    return this.service.getHistorico(usinaId, parseInt(horas) || 24);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':usinaId/alertas')
  getAlertas(@Param('usinaId') usinaId: string) {
    return this.service.getAlertas(usinaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post(':usinaId/config')
  createConfig(@Param('usinaId') usinaId: string, @Body() body: any) {
    return this.service.createConfig(usinaId, body);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':usinaId/config')
  getConfig(@Param('usinaId') usinaId: string) {
    return this.service.getConfig(usinaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch(':usinaId/config')
  updateConfig(@Param('usinaId') usinaId: string, @Body() body: any) {
    return this.service.updateConfig(usinaId, body);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post(':usinaId/verificar-agora')
  verificarAgora(@Param('usinaId') usinaId: string) {
    return this.service.verificarAgora(usinaId);
  }
}
