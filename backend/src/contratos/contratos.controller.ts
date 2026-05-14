import { Controller, Get, Post, Put, Delete, Param, Body, Req } from '@nestjs/common';
import { ContratosService } from './contratos.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CreateContratoDto } from './dto/create-contrato.dto';
import { UpdateContratoDto } from './dto/update-contrato.dto';
import { AuditLog } from '../audit/audit-log.decorator';

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
  findByCooperado(@Param('cooperadoId') cooperadoId: string, @Req() req: any) {
    // D-48-contratos IDOR fix.
    return this.contratosService.findByCooperado(cooperadoId, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({ acao: 'contrato.ativar', recurso: 'Contrato', recursoIdParam: 'id' })
  @Post(':id/ativar')
  ativar(@Param('id') id: string, @Body() body: { protocoloConcessionaria: string; dataInicioCreditos: string; observacoes?: string }, @Req() req: any) {
    // D-48-contratos IDOR fix.
    return this.contratosService.ativar(id, body, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({ acao: 'contrato.criar', recurso: 'Contrato' })
  @Post()
  create(@Body() body: CreateContratoDto, @Req() req: any) {
    // D-48.6: injeta cooperativaId do JWT — usina será filtrada por tenant.
    return this.contratosService.create(body, req.user?.cooperativaId ?? null);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({ acao: 'contrato.atualizar', recurso: 'Contrato', recursoIdParam: 'id' })
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContratoDto, @Req() req: any) {
    // D-48.6: idem create.
    return this.contratosService.update(id, dto as any, req.user?.cooperativaId ?? null);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'contrato.deletar', recurso: 'Contrato', recursoIdParam: 'id' })
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    // D-48-contratos IDOR fix.
    return this.contratosService.remove(id, req.user?.cooperativaId);
  }
}
