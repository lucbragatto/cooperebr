import { Controller, Get, Post, Patch, Delete, Param, Body, Req } from '@nestjs/common';
import { PrestadoresService } from './prestadores.service';
import { CreatePrestadorDto } from './dto/create-prestador.dto';
import { UpdatePrestadorDto } from './dto/update-prestador.dto';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('prestadores')
export class PrestadoresController {
  constructor(private readonly prestadoresService: PrestadoresService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post()
  create(@Body() dto: CreatePrestadorDto, @Req() req: any) {
    return this.prestadoresService.create(dto, req.user?.cooperativaId ?? null);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll(@Req() req: any) {
    return this.prestadoresService.findAll(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.prestadoresService.findOne(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePrestadorDto, @Req() req: any) {
    return this.prestadoresService.update(id, dto, req.user?.cooperativaId ?? null);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.prestadoresService.remove(id, req.user?.cooperativaId ?? null);
  }
}
