import { Controller, Get, Post, Put, Delete, Param, Body, Query, Req } from '@nestjs/common';
import { BandeiraTarifariaService } from './bandeira-tarifaria.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CreateBandeiraDto } from './dto/create-bandeira.dto';
import { UpdateBandeiraDto } from './dto/update-bandeira.dto';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('bandeiras-tarifarias')
export class BandeiraTarifariaController {
  constructor(private readonly service: BandeiraTarifariaService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll(@Req() req: any, @Query('tipo') tipo?: string) {
    const cooperativaId = req.user.cooperativaId;
    return this.service.findAll(cooperativaId, tipo ? { tipo } : undefined);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    const cooperativaId = req.user.cooperativaId;
    return this.service.findOne(id, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post()
  create(@Req() req: any, @Body() dto: CreateBandeiraDto) {
    const cooperativaId = req.user.cooperativaId;
    return this.service.create(cooperativaId, dto);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateBandeiraDto) {
    const cooperativaId = req.user.cooperativaId;
    return this.service.update(id, cooperativaId, dto);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    const cooperativaId = req.user.cooperativaId;
    return this.service.remove(id, cooperativaId);
  }
}
