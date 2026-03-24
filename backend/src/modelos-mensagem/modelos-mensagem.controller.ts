import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { ModelosMensagemService } from './modelos-mensagem.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';

@Controller('modelos-mensagem')
export class ModelosMensagemController {
  constructor(
    private readonly service: ModelosMensagemService,
    private readonly sender: WhatsappSenderService,
  ) {}

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Get()
  findAll(@Query('categoria') categoria?: string) {
    return this.service.findAll(categoria);
  }

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Post()
  create(@Body() body: { cooperativaId?: string; nome: string; categoria: string; conteudo: string; ativo?: boolean }) {
    return this.service.create(body);
  }

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: { nome?: string; categoria?: string; conteudo?: string; ativo?: boolean }) {
    return this.service.update(id, body);
  }

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Roles(PerfilUsuario.ADMIN, PerfilUsuario.SUPER_ADMIN)
  @Post(':id/testar')
  async testar(@Param('id') id: string, @Body() body: { telefone: string }) {
    const modelo = await this.service.findOne(id);
    const textoPreview = this.service.substituirVariaveis(modelo.conteudo);
    await this.sender.enviarMensagem(body.telefone, textoPreview, { tipoDisparo: 'MANUAL' });
    await this.service.incrementarUsos(id);
    return { ok: true, preview: textoPreview };
  }
}
