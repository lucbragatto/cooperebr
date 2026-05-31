import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { MonitoramentoUsinasService } from './monitoramento-usinas.service';
import { Roles } from '../auth/roles.decorator';
import { TenantResource } from '../auth/tenant-resource.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

/**
 * D-novo-BR F1.2 A6+A7+M3+M4+M5+M6 (31/05/2026) — TenantOwnershipGuard valida
 * que a Usina com `:usinaId` pertence ao tenant antes de ler/escrever monitoring.
 *
 * Endpoint `GET /` (list global, A16) NÃO recebe @TenantResource — categoria 3,
 * fix manual via service na Fase 1.5.
 */
@Controller('monitoramento-usinas')
export class MonitoramentoUsinasController {
  constructor(private readonly service: MonitoramentoUsinasService) {}

  // A16 cat-3 (defer F1.5): listagem global sem id — fix manual no service.
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  getStatusAtual() {
    return this.service.getStatusAtual();
  }

  // F1.2 M4 — Guard valida posse da Usina antes de retornar histórico
  @TenantResource({ model: 'usina', idParam: 'usinaId' })
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':usinaId/historico')
  getHistorico(
    @Param('usinaId') usinaId: string,
    @Query('horas') horas: string,
  ) {
    return this.service.getHistorico(usinaId, parseInt(horas) || 24);
  }

  // F1.2 M5 — Guard valida posse
  @TenantResource({ model: 'usina', idParam: 'usinaId' })
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':usinaId/alertas')
  getAlertas(@Param('usinaId') usinaId: string) {
    return this.service.getAlertas(usinaId);
  }

  // F1.2 A6 — Guard valida posse antes de createConfig (escrita credenciais Sungrow)
  @TenantResource({ model: 'usina', idParam: 'usinaId' })
  @Roles(SUPER_ADMIN, ADMIN)
  @Post(':usinaId/config')
  createConfig(@Param('usinaId') usinaId: string, @Body() body: any) {
    return this.service.createConfig(usinaId, body);
  }

  // F1.2 M6 — Guard valida posse antes de retornar config (sungrowUsuario/key)
  @TenantResource({ model: 'usina', idParam: 'usinaId' })
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':usinaId/config')
  getConfig(@Param('usinaId') usinaId: string) {
    return this.service.getConfig(usinaId);
  }

  // F1.2 A7 — Guard valida posse antes de updateConfig
  @TenantResource({ model: 'usina', idParam: 'usinaId' })
  @Roles(SUPER_ADMIN, ADMIN)
  @Patch(':usinaId/config')
  updateConfig(@Param('usinaId') usinaId: string, @Body() body: any) {
    return this.service.updateConfig(usinaId, body);
  }

  // F1.2 M3 — Guard valida posse antes de disparar verificação
  @TenantResource({ model: 'usina', idParam: 'usinaId' })
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post(':usinaId/verificar-agora')
  verificarAgora(@Param('usinaId') usinaId: string) {
    return this.service.verificarAgora(usinaId);
  }
}
