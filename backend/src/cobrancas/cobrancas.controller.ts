import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CobrancasService } from './cobrancas.service';

@Controller('cobrancas')
export class CobrancasController {
  constructor(private readonly cobrancasService: CobrancasService) {}

  @Get()
  findAll() {
    return this.cobrancasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cobrancasService.findOne(id);
  }

  @Get('contrato/:contratoId')
  findByContrato(@Param('contratoId') contratoId: string) {
    return this.cobrancasService.findByContrato(contratoId);
  }

  @Post()
  create(@Body() body: {
    contratoId: string;
    mesReferencia: number;
    anoReferencia: number;
    valorBruto: number;
    percentualDesconto: number;
    valorDesconto: number;
    valorLiquido: number;
    dataVencimento: Date;
    dataPagamento?: Date;
  }) {
    return this.cobrancasService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.cobrancasService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cobrancasService.remove(id);
  }
}
