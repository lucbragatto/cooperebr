import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { OcorrenciasService } from './ocorrencias.service';

@Controller('ocorrencias')
export class OcorrenciasController {
  constructor(private readonly ocorrenciasService: OcorrenciasService) {}

  @Get()
  findAll() {
    return this.ocorrenciasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ocorrenciasService.findOne(id);
  }

  @Get('cooperado/:cooperadoId')
  findByCooperado(@Param('cooperadoId') cooperadoId: string) {
    return this.ocorrenciasService.findByCooperado(cooperadoId);
  }

  @Post()
  create(@Body() body: {
    cooperadoId: string;
    ucId?: string;
    tipo: 'FALTA_ENERGIA' | 'MEDICAO_INCORRETA' | 'PROBLEMA_FATURA' | 'SOLICITACAO' | 'OUTROS';
    descricao: string;
    prioridade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  }) {
    return this.ocorrenciasService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.ocorrenciasService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ocorrenciasService.remove(id);
  }
}
