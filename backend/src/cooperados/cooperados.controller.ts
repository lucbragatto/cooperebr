import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CooperadosService } from './cooperados.service';

@Controller('cooperados')
export class CooperadosController {
  constructor(private readonly cooperadosService: CooperadosService) {}

  @Get()
  findAll() {
    return this.cooperadosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cooperadosService.findOne(id);
  }

  @Post()
  create(@Body() body: {
    nomeCompleto: string;
    cpf: string;
    email: string;
    telefone?: string;
  }) {
    return this.cooperadosService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.cooperadosService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cooperadosService.remove(id);
  }
}