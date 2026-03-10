import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { ContratosService } from './contratos.service';

@Controller('contratos')
export class ContratosController {
  constructor(private readonly contratosService: ContratosService) {}

  @Get()
  findAll() {
    return this.contratosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contratosService.findOne(id);
  }

  @Get('cooperado/:cooperadoId')
  findByCooperado(@Param('cooperadoId') cooperadoId: string) {
    return this.contratosService.findByCooperado(cooperadoId);
  }

  @Post()
  create(@Body() body: {
    numero: string;
    cooperadoId: string;
    ucId: string;
    usinaId: string;
    dataInicio: Date;
    dataFim?: Date;
    percentualDesconto: number;
  }) {
    return this.contratosService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.contratosService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contratosService.remove(id);
  }
}
