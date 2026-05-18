import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { StatusEnvioConcessionaria } from '@prisma/client';
import { EnvioListaConcessionariaService } from './envio-lista-concessionaria.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { AuditLog } from '../audit/audit-log.decorator';
import { CreateRascunhoDto } from './dto/create-rascunho.dto';
import { MarcarEnviadoDto } from './dto/marcar-enviado.dto';
import { RegistrarProtocoloDto } from './dto/registrar-protocolo.dto';
import { RegistrarHomologacaoDto } from './dto/registrar-homologacao.dto';
import { CancelarEnvioDto } from './dto/cancelar.dto';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

/**
 * cooperativaId vem APENAS do JWT, nunca do body.
 * SUPER_ADMIN pode operar sem cooperativaId no token (acessa todos).
 */
function tenantId(req: any, required = true): string | null {
  const id: string | undefined = req.user?.cooperativaId;
  const perfil: string | undefined = req.user?.perfil;
  const isSuperAdmin = perfil === PerfilUsuario.SUPER_ADMIN;
  if (!id && !isSuperAdmin && required) {
    throw new ForbiddenException('Token sem cooperativaId — acesso negado.');
  }
  return id ?? null;
}

@Controller('envios-lista')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnvioListaConcessionariaController {
  constructor(private readonly service: EnvioListaConcessionariaService) {}

  // 1. Listar cooperados elegíveis (helper pra UI "Novo envio")
  @Get('cooperados-elegiveis')
  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  async cooperadosElegiveis(
    @Query('usinaId') usinaId: string,
    @Req() req: any,
  ) {
    return this.service.listarCooperadosElegiveis(usinaId, tenantId(req));
  }

  // 2. Listar envios (paginado)
  @Get()
  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  async listar(
    @Query('status') status: string | undefined,
    @Query('usinaId') usinaId: string | undefined,
    @Query('geradaDe') geradaDe: string | undefined,
    @Query('geradaAte') geradaAte: string | undefined,
    @Query('search') search: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Req() req: any,
  ) {
    const filtros: any = {};
    if (status) {
      filtros.status = status.includes(',')
        ? (status.split(',') as StatusEnvioConcessionaria[])
        : (status as StatusEnvioConcessionaria);
    }
    if (usinaId) filtros.usinaId = usinaId;
    if (geradaDe) filtros.geradaDe = new Date(geradaDe);
    if (geradaAte) filtros.geradaAte = new Date(geradaAte);
    if (search) filtros.search = search;
    return this.service.listar(tenantId(req), filtros, {
      page: page ? Number.parseInt(page, 10) : undefined,
      pageSize: pageSize ? Number.parseInt(pageSize, 10) : undefined,
    });
  }

  // 3. Detalhe
  @Get(':id')
  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  async detalhe(@Param('id') id: string, @Req() req: any) {
    return this.service.obterDetalhe(id, tenantId(req));
  }

  // 4. CSV (download usa o snapshot do envio)
  @Get(':id/csv')
  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  async csv(@Param('id') id: string, @Req() req: any) {
    return this.service.gerarCsv(id, tenantId(req));
  }

  // 5. Criar rascunho
  @AuditLog({ acao: 'envio-lista.criar', recurso: 'EnvioListaConcessionaria' })
  @Post()
  @Roles(ADMIN, SUPER_ADMIN)
  async criarRascunho(@Body() body: CreateRascunhoDto, @Req() req: any) {
    return this.service.criarRascunho({
      usinaId: body.usinaId,
      cooperadoIds: body.cooperadoIds,
      cooperativaId: tenantId(req),
    });
  }

  // 6. Validar
  @AuditLog({ acao: 'envio-lista.validar', recurso: 'EnvioListaConcessionaria', recursoIdParam: 'id' })
  @Patch(':id/validar')
  @Roles(ADMIN, SUPER_ADMIN)
  async validar(@Param('id') id: string, @Req() req: any) {
    return this.service.validar(id, req.user.id, tenantId(req));
  }

  // 7. Marcar pronto pra envio
  @AuditLog({ acao: 'envio-lista.marcar-pra-envio', recurso: 'EnvioListaConcessionaria', recursoIdParam: 'id' })
  @Patch(':id/marcar-pra-envio')
  @Roles(ADMIN, SUPER_ADMIN)
  async marcarProntoPraEnvio(@Param('id') id: string, @Req() req: any) {
    return this.service.marcarProntoPraEnvio(id, tenantId(req));
  }

  // 8. Marcar como enviado (manual)
  @AuditLog({ acao: 'envio-lista.marcar-enviado', recurso: 'EnvioListaConcessionaria', recursoIdParam: 'id' })
  @Patch(':id/marcar-enviado')
  @Roles(ADMIN, SUPER_ADMIN)
  async marcarEnviado(
    @Param('id') id: string,
    @Body() body: MarcarEnviadoDto,
    @Req() req: any,
  ) {
    return this.service.marcarEnviado(id, body, req.user.id, tenantId(req));
  }

  // 9. Registrar protocolo
  @AuditLog({ acao: 'envio-lista.registrar-protocolo', recurso: 'EnvioListaConcessionaria', recursoIdParam: 'id' })
  @Post(':id/protocolo')
  @Roles(ADMIN, SUPER_ADMIN)
  async registrarProtocolo(
    @Param('id') id: string,
    @Body() body: RegistrarProtocoloDto,
    @Req() req: any,
  ) {
    return this.service.registrarProtocolo(id, body, tenantId(req));
  }

  // 10. Registrar homologação individual de cooperado
  @AuditLog({ acao: 'envio-lista.homologar-cooperado', recurso: 'EnvioListaConcessionaria', recursoIdParam: 'id' })
  @Post(':id/homologar/:cooperadoId')
  @Roles(ADMIN, SUPER_ADMIN)
  async registrarHomologacao(
    @Param('id') id: string,
    @Param('cooperadoId') cooperadoId: string,
    @Body() body: RegistrarHomologacaoDto,
    @Req() req: any,
  ) {
    return this.service.registrarHomologacao(
      id,
      cooperadoId,
      body,
      tenantId(req),
    );
  }

  // 11. Cancelar
  @AuditLog({ acao: 'envio-lista.cancelar', recurso: 'EnvioListaConcessionaria', recursoIdParam: 'id' })
  @Patch(':id/cancelar')
  @Roles(ADMIN, SUPER_ADMIN)
  async cancelar(
    @Param('id') id: string,
    @Body() body: CancelarEnvioDto,
    @Req() req: any,
  ) {
    return this.service.cancelar(id, body.motivo, tenantId(req));
  }
}
