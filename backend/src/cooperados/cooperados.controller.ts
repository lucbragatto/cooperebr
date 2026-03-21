import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CooperadosService } from './cooperados.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CreateCooperadoDto } from './dto/create-cooperado.dto';
import { UpdateCooperadoDto } from './dto/update-cooperado.dto';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('cooperados')
export class CooperadosController {
  constructor(private readonly cooperadosService: CooperadosService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll() {
    return this.cooperadosService.findAll();
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('fila-espera')
  filaEspera() {
    return this.cooperadosService.filaEspera();
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id/checklist')
  getChecklist(@Param('id') id: string) {
    return this.cooperadosService.getChecklist(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cooperadosService.findOne(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post()
  create(@Body() body: CreateCooperadoDto) {
    return this.cooperadosService.create(body);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCooperadoDto) {
    return this.cooperadosService.update(id, dto as any);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post(':id/alocar-usina')
  alocarUsina(@Param('id') id: string, @Body() body: { usinaId: string }) {
    return this.cooperadosService.alocarUsina(id, body.usinaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cooperadosService.remove(id);
  }
}
