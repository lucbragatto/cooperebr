import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { PlanosService } from './planos.service';
import { CreatePlanoDto } from './dto/create-plano.dto';
import { UpdatePlanoDto } from './dto/update-plano.dto';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

@Controller('planos')
export class PlanosController {
  constructor(private readonly planosService: PlanosService) {}

  @Get()
  @Public()
  findAll() {
    return this.planosService.findAll();
  }

  @Get('ativos')
  @Public()
  findAtivos(
    @Query('cooperativaId') cooperativaId?: string,
    @Query('publico') publico?: string,
  ) {
    return this.planosService.findAtivos(cooperativaId, publico === 'true');
  }

  @Get(':id')
  @Public()
  findOne(@Param('id') id: string) {
    return this.planosService.findOne(id);
  }

  @Post()
  @Roles(PerfilUsuario.ADMIN)
  create(@Body() dto: CreatePlanoDto) {
    return this.planosService.create(dto);
  }

  @Put(':id')
  @Roles(PerfilUsuario.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdatePlanoDto) {
    return this.planosService.update(id, dto);
  }

  @Delete(':id')
  @Roles(PerfilUsuario.ADMIN)
  remove(@Param('id') id: string) {
    return this.planosService.remove(id);
  }
}
