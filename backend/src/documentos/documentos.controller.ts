import { Body, Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { DocumentosService } from './documentos.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

@Controller('documentos')
@Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Get('cooperado/:cooperadoId')
  findByCooperado(@Param('cooperadoId') cooperadoId: string) {
    return this.documentosService.findByCooperado(cooperadoId);
  }

  @Patch(':id/aprovar')
  aprovar(@Param('id') id: string) {
    return this.documentosService.aprovar(id);
  }

  @Patch(':id/reprovar')
  reprovar(
    @Param('id') id: string,
    @Body('motivoRejeicao') motivoRejeicao: string,
  ) {
    return this.documentosService.reprovar(id, motivoRejeicao);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentosService.remove(id);
  }
}
