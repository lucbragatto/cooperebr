import { Controller, Get, Patch, Param } from '@nestjs/common';
import { NotificacoesService } from './notificacoes.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Usuario } from '@prisma/client';

@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly notificacoesService: NotificacoesService) {}

  @Get()
  findAll(@CurrentUser() user: Usuario) {
    return this.notificacoesService.findAll(user);
  }

  @Get('nao-lidas')
  async countNaoLidas(@CurrentUser() user: Usuario) {
    try {
      return await this.notificacoesService.countNaoLidas(user);
    } catch {
      return { count: 0 };
    }
  }

  @Patch('ler-todas')
  marcarTodasComoLidas(@CurrentUser() user: Usuario) {
    return this.notificacoesService.marcarTodasComoLidas(user);
  }

  @Patch(':id/ler')
  marcarComoLida(@Param('id') id: string) {
    return this.notificacoesService.marcarComoLida(id);
  }
}
