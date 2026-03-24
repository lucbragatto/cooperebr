import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { FluxoEtapasService } from './fluxo-etapas.service';

@Controller('fluxo-etapas')
export class FluxoEtapasController {
  constructor(private readonly service: FluxoEtapasService) {}

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Post()
  create(@Body() body: {
    cooperativaId?: string;
    nome: string;
    ordem: number;
    estado: string;
    modeloMensagemId?: string;
    gatilhos: any;
    timeoutHoras?: number;
    modeloFollowupId?: string;
    acaoAutomatica?: string;
    ativo?: boolean;
  }) {
    return this.service.create(body);
  }

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: {
    nome?: string;
    ordem?: number;
    estado?: string;
    modeloMensagemId?: string;
    gatilhos?: any;
    timeoutHoras?: number;
    modeloFollowupId?: string;
    acaoAutomatica?: string;
    ativo?: boolean;
  }) {
    return this.service.update(id, body);
  }

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Get('preview')
  preview() {
    return this.service.preview();
  }
}
