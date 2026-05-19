import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import { FluxoEtapasService } from './fluxo-etapas.service';
import type { EscopoTenant } from '../modelos-mensagem/modelos-mensagem.service';

interface UsuarioAutenticado {
  id: string;
  perfil: string;
  cooperativaId?: string | null;
}

interface Gatilho {
  resposta: string;
  proximoEstado: string;
}

function escopoDoUsuario(user: UsuarioAutenticado): EscopoTenant {
  if (user.perfil === PerfilUsuario.SUPER_ADMIN) return undefined;
  return user.cooperativaId ?? null;
}

@Controller('fluxo-etapas')
export class FluxoEtapasController {
  constructor(private readonly service: FluxoEtapasService) {}

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Get()
  findAll(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.findAll(escopoDoUsuario(user));
  }

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Post()
  create(
    @Body() body: {
      cooperativaId?: string;
      nome: string;
      ordem: number;
      estado: string;
      modeloMensagemId?: string;
      gatilhos: Gatilho[];
      timeoutHoras?: number;
      modeloFollowupId?: string;
      acaoAutomatica?: string;
      ativo?: boolean;
    },
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.create(body, escopoDoUsuario(user));
  }

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: {
      nome?: string;
      ordem?: number;
      estado?: string;
      modeloMensagemId?: string;
      gatilhos?: Gatilho[];
      timeoutHoras?: number;
      modeloFollowupId?: string;
      acaoAutomatica?: string;
      ativo?: boolean;
    },
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.update(id, body, escopoDoUsuario(user));
  }

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() user: UsuarioAutenticado) {
    return this.service.delete(id, escopoDoUsuario(user));
  }

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Get('preview')
  preview(@CurrentUser() user: UsuarioAutenticado) {
    return this.service.preview(escopoDoUsuario(user));
  }
}
