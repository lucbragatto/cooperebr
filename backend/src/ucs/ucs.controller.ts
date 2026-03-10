import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { UcsService } from './ucs.service';

@Controller('ucs')
export class UcsController {
  constructor(private readonly ucsService: UcsService) {}

  @Get()
  findAll() {
    return this.ucsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ucsService.findOne(id);
  }

  @Get('cooperado/:cooperadoId')
  findByCooperado(@Param('cooperadoId') cooperadoId: string) {
    return this.ucsService.findByCooperado(cooperadoId);
  }

  @Post()
  create(@Body() body: {
    numero: string;
    endereco: string;
    cidade: string;
    estado: string;
    cooperadoId: string;
  }) {
    return this.ucsService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.ucsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ucsService.remove(id);
  }
}