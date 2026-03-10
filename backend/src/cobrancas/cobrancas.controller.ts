import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CobrancasService } from './cobrancas.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('cobrancas')
export class CobrancasController {
  constructor(private readonly cobrancasService: CobrancasService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll() {
    return this.cobrancasService.findAll();
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cobrancasService.findOne(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get('contrato/:contratoId')
  findByContrato(@Param('contratoId') contratoId: string) {
    return this.cobrancasService.findByContrato(contratoId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post()
  create(
    @Body()
    body: {
      contratoId: string;
      mesReferencia: number;
      anoReferencia: number;
      valorBruto: number;
      percentualDesconto: number;
      valorDesconto: number;
      valorLiquido: number;
      dataVencimento: Date;
      dataPagamento?: Date;
    },
  ) {
    return this.cobrancasService.create(body);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.cobrancasService.update(id, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cobrancasService.remove(id);
  }
}
