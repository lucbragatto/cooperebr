import { Controller, Get, Post, Patch, Param, Body, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { ConversaoCreditoService } from './conversao-credito.service';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('conversao-credito')
export class ConversaoCreditoController {
  constructor(private readonly service: ConversaoCreditoService) {}

  @Roles(COOPERADO, ADMIN, SUPER_ADMIN)
  @Post('solicitar')
  solicitar(@Req() req: any, @Body() body: { kwhDesejado: number; pixChave?: string; pixNome?: string }) {
    return this.service.solicitar(req.user.cooperadoId, body);
  }

  @Roles(COOPERADO, ADMIN, SUPER_ADMIN)
  @Get('minhas')
  minhas(@Req() req: any) {
    return this.service.minhas(req.user.cooperadoId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  listarPendentes(@Req() req: any) {
    return this.service.listarPendentes(req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch(':id/aprovar')
  aprovar(@Param('id') id: string, @Req() req: any) {
    return this.service.aprovar(id, req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, COOPERADO)
  @Patch(':id/cancelar')
  cancelar(@Param('id') id: string, @Req() req: any) {
    return this.service.cancelar(id, req.user.cooperativaId);
  }
}
