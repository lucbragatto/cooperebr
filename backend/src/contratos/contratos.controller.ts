import { Controller, Get, Post, Put, Delete, Param, Body, Req } from '@nestjs/common';
import { ContratosService } from './contratos.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { UpdateContratoDto } from './dto/update-contrato.dto';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('contratos')
export class ContratosController {
  constructor(private readonly contratosService: ContratosService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll(@Req() req: any) {
    return this.contratosService.findAll(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.contratosService.findOne(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get('cooperado/:cooperadoId')
  findByCooperado(@Param('cooperadoId') cooperadoId: string) {
    return this.contratosService.findByCooperado(cooperadoId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post(':id/ativar')
  ativar(@Param('id') id: string, @Body() body: { protocoloConcessionaria: string; dataInicioCreditos: string; observacoes?: string }) {
    return this.contratosService.ativar(id, body);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post()
  create(@Body() body: CreateContratoDto, @Req() req: any) {
    // D-48.6: injeta cooperativaId do JWT — usina será filtrada por tenant.
    return this.contratosService.create(body, req.user?.cooperativaId ?? null);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContratoDto, @Req() req: any) {
    // D-48.6: idem create.
    return this.contratosService.update(id, dto as any, req.user?.cooperativaId ?? null);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contratosService.remove(id);
  }
}
