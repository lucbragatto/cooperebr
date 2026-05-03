import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { PlanosService } from './planos.service';
import { CreatePlanoDto } from './dto/create-plano.dto';
import { UpdatePlanoDto } from './dto/update-plano.dto';
import { Public } from '../auth/public.decorator';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('planos')
export class PlanosController {
  constructor(private readonly planosService: PlanosService) {}

  // GET /planos — autenticado. SUPER_ADMIN vê todos; ADMIN/OPERADOR vê próprios + globais.
  @Get()
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  findAll(@Req() req: any) {
    return this.planosService.findAll(req.user);
  }

  // GET /planos/ativos — público (vitrine /cadastro). Aceita ?cooperativaId=X opcional pra
  // mostrar planos do parceiro X + globais.
  @Get('ativos')
  @Public()
  findAtivos(
    @Query('cooperativaId') cooperativaId?: string,
    @Query('publico') publico?: string,
  ) {
    return this.planosService.findAtivos(cooperativaId, publico === 'true');
  }

  // GET /planos/:id — autenticado, com cross-tenant guard.
  @Get(':id')
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.planosService.findOne(id, req.user);
  }

  @Post()
  @Roles(ADMIN)
  create(@Body() dto: CreatePlanoDto, @Req() req: any) {
    return this.planosService.create(dto, req.user);
  }

  @Put(':id')
  @Roles(ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdatePlanoDto, @Req() req: any) {
    return this.planosService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles(ADMIN)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.planosService.remove(id, req.user);
  }
}
