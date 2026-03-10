import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CooperadosService } from './cooperados.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('cooperados')
export class CooperadosController {
  constructor(private readonly cooperadosService: CooperadosService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll() {
    return this.cooperadosService.findAll();
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cooperadosService.findOne(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post()
  create(
    @Body()
    body: {
      nomeCompleto: string;
      cpf: string;
      email: string;
      telefone?: string;
    },
  ) {
    return this.cooperadosService.create(body);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.cooperadosService.update(id, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cooperadosService.remove(id);
  }
}
