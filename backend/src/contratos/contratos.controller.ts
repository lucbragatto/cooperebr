import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { ContratosService } from './contratos.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('contratos')
export class ContratosController {
  constructor(private readonly contratosService: ContratosService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll() {
    return this.contratosService.findAll();
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contratosService.findOne(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get('cooperado/:cooperadoId')
  findByCooperado(@Param('cooperadoId') cooperadoId: string) {
    return this.contratosService.findByCooperado(cooperadoId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post()
  create(
    @Body()
    body: {
      numero: string;
      cooperadoId: string;
      ucId: string;
      usinaId: string;
      dataInicio: Date;
      dataFim?: Date;
      percentualDesconto: number;
    },
  ) {
    return this.contratosService.create(body);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.contratosService.update(id, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contratosService.remove(id);
  }
}
