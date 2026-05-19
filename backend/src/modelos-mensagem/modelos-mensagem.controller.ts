import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import { ModelosMensagemService, EscopoTenant } from './modelos-mensagem.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';

interface UsuarioAutenticado {
  id: string;
  perfil: string;
  cooperativaId?: string | null;
}

/**
 * Extrai o escopo multi-tenant do usuário autenticado.
 *
 * - SUPER_ADMIN → undefined (sem filtro; vê tudo de todas as cooperativas).
 * - Demais perfis → cooperativaId do JWT (vê próprios + globais).
 */
function escopoDoUsuario(user: UsuarioAutenticado): EscopoTenant {
  if (user.perfil === PerfilUsuario.SUPER_ADMIN) return undefined;
  return user.cooperativaId ?? null;
}

@Controller('modelos-mensagem')
export class ModelosMensagemController {
  constructor(
    private readonly service: ModelosMensagemService,
    private readonly sender: WhatsappSenderService,
  ) {}

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Get()
  findAll(
    @Query('categoria') categoria: string | undefined,
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.findAll(categoria, escopoDoUsuario(user));
  }

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Post()
  create(
    @Body() body: { cooperativaId?: string; nome: string; categoria: string; conteudo: string; ativo?: boolean },
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    return this.service.create(body, escopoDoUsuario(user));
  }

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: { nome?: string; categoria?: string; conteudo?: string; ativo?: boolean },
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
  @Post(':id/testar')
  async testar(
    @Param('id') id: string,
    @Body() body: { telefone: string },
    @CurrentUser() user: UsuarioAutenticado,
  ) {
    const modelo = await this.service.findOne(id, escopoDoUsuario(user));
    const textoPreview = this.service.substituirVariaveis(modelo.conteudo);
    await this.sender.enviarMensagem(body.telefone, textoPreview, { tipoDisparo: 'MANUAL' });
    await this.service.incrementarUsos(id);
    return { ok: true, preview: textoPreview };
  }
}
