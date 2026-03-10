import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { UsinasService } from './usinas.service';

@Controller('usinas')
export class UsinasController {
  constructor(private readonly usinasService: UsinasService) {}

  @Get()
  findAll() {
    return this.usinasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usinasService.findOne(id);
  }

  @Post()
  create(@Body() body: {
    nome: string;
    potenciaKwp: number;
    cidade: string;
    estado: string;
  }) {
    return this.usinasService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.usinasService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usinasService.remove(id);
  }
}
