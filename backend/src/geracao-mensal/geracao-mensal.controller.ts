import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { GeracaoMensalService } from './geracao-mensal.service';
import { CreateGeracaoMensalDto } from './dto/create-geracao-mensal.dto';
import { UpdateGeracaoMensalDto } from './dto/update-geracao-mensal.dto';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('geracao-mensal')
export class GeracaoMensalController {
  constructor(private readonly service: GeracaoMensalService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post()
  create(@Body() dto: CreateGeracaoMensalDto) {
    return this.service.create(dto);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll(@Query('usinaId') usinaId?: string, @Query('ano') ano?: string) {
    return this.service.findAll(usinaId, ano ? parseInt(ano, 10) : undefined);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGeracaoMensalDto) {
    return this.service.update(id, dto);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
