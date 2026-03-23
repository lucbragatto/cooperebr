import { Controller, Get, Post, Put, Delete, Param, Body, Req } from '@nestjs/common';
import { OcorrenciasService } from './ocorrencias.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('ocorrencias')
export class OcorrenciasController {
  constructor(private readonly ocorrenciasService: OcorrenciasService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll(@Req() req: any) {
    return this.ocorrenciasService.findAll(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.ocorrenciasService.findOne(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get('cooperado/:cooperadoId')
  findByCooperado(@Param('cooperadoId') cooperadoId: string) {
    return this.ocorrenciasService.findByCooperado(cooperadoId);
  }

  // COOPERADO pode abrir ocorrências
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Post()
  create(
    @Body()
    body: {
      cooperadoId: string;
      ucId?: string;
      tipo: 'FALTA_ENERGIA' | 'MEDICAO_INCORRETA' | 'PROBLEMA_FATURA' | 'SOLICITACAO' | 'OUTROS';
      descricao: string;
      prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
    },
  ) {
    return this.ocorrenciasService.create(body);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.ocorrenciasService.update(id, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ocorrenciasService.remove(id);
  }
}
