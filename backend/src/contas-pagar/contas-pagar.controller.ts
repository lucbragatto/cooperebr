import { Controller, Get, Post, Patch, Delete, Param, Body, Req, Query } from '@nestjs/common';
import { ContasPagarService } from './contas-pagar.service';
import { CreateContaAPagarDto } from './dto/create-conta-a-pagar.dto';
import { UpdateContaAPagarDto } from './dto/update-conta-a-pagar.dto';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('contas-pagar')
export class ContasPagarController {
  constructor(private readonly contasPagarService: ContasPagarService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll(@Req() req: any, @Query('status') status?: string, @Query('categoria') categoria?: string) {
    return this.contasPagarService.findAll(req.user.cooperativaId, { status, categoria });
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.contasPagarService.findOne(id, req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post()
  create(@Req() req: any, @Body() dto: CreateContaAPagarDto) {
    return this.contasPagarService.create(req.user.cooperativaId, dto);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Req() req: any, @Body() dto: UpdateContaAPagarDto) {
    return this.contasPagarService.update(id, req.user.cooperativaId, dto);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.contasPagarService.remove(id, req.user.cooperativaId);
  }
}
