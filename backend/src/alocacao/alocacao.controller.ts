import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { StatusAlocacaoOtima } from '@prisma/client';
import { AuditLog } from '../audit/audit-log.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PerfilUsuario } from '../auth/perfil.enum';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AlocacaoService } from './alocacao.service';
import { PoliticaAlocacaoService } from './politica-alocacao.service';
import { AplicarAlocacaoDto } from './dto/aplicar-alocacao.dto';
import { DescartarAlocacaoDto } from './dto/descartar-alocacao.dto';
import { CreatePoliticaAlocacaoDto } from './dto/create-politica-alocacao.dto';
import { UpdatePoliticaAlocacaoDto } from './dto/update-politica-alocacao.dto';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

/**
 * Multi-tenant: cooperativaId vem APENAS do JWT, nunca do body.
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

@Controller('alocacao')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlocacaoController {
  constructor(private readonly alocacao: AlocacaoService) {}

  @Post('simular')
  @Roles(ADMIN, SUPER_ADMIN)
  @AuditLog({ acao: 'alocacao.simular', recurso: 'AlocacaoOtima' })
  async simular(@Req() req: any) {
    const cooperativaId = tenantId(req, false);
    const efetivo = cooperativaId ?? req.body?.cooperativaId;
    if (!efetivo) {
      throw new BadRequestException('cooperativaId requerido (SUPER_ADMIN deve passar via body).');
    }
    return this.alocacao.simular({ cooperativaId: efetivo, userId: req.user?.id });
  }

  @Get()
  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  async listar(@Query('status') status: string | undefined, @Req() req: any) {
    return this.alocacao.listar({
      cooperativaId: tenantId(req, false),
      status: status as StatusAlocacaoOtima | undefined,
    });
  }

  @Get(':id')
  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  async obter(@Param('id') id: string, @Req() req: any) {
    return this.alocacao.obter(id, tenantId(req, false));
  }

  @Post(':id/aplicar')
  @Roles(ADMIN, SUPER_ADMIN)
  @AuditLog({ acao: 'alocacao.aplicar', recurso: 'AlocacaoOtima', recursoIdParam: 'id' })
  async aplicar(@Param('id') id: string, @Body() dto: AplicarAlocacaoDto, @Req() req: any) {
    return this.alocacao.aplicar({
      id,
      contratoIds: dto.contratoIds,
      userId: req.user.id,
      cooperativaId: tenantId(req, false),
    });
  }

  @Post(':id/descartar')
  @Roles(ADMIN, SUPER_ADMIN)
  @AuditLog({ acao: 'alocacao.descartar', recurso: 'AlocacaoOtima', recursoIdParam: 'id' })
  async descartar(@Param('id') id: string, @Body() dto: DescartarAlocacaoDto, @Req() req: any) {
    return this.alocacao.descartar({
      id,
      motivo: dto.motivo,
      cooperativaId: tenantId(req, false),
    });
  }
}

@Controller('politicas-alocacao')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PoliticaAlocacaoController {
  constructor(private readonly politicas: PoliticaAlocacaoService) {}

  @Get()
  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  async listar(@Req() req: any) {
    return this.politicas.listar(tenantId(req, false));
  }

  @Get(':id')
  @Roles(ADMIN, SUPER_ADMIN, OPERADOR)
  async obter(@Param('id') id: string, @Req() req: any) {
    return this.politicas.obter(id, tenantId(req, false));
  }

  @Post()
  @Roles(ADMIN, SUPER_ADMIN)
  @AuditLog({ acao: 'politica-alocacao.criar', recurso: 'PoliticaAlocacao' })
  async criar(@Body() dto: CreatePoliticaAlocacaoDto, @Req() req: any) {
    const cooperativaId = tenantId(req, false);
    if (!cooperativaId) {
      throw new BadRequestException('SUPER_ADMIN deve passar cooperativaId no body (não suportado nesta rota).');
    }
    return this.politicas.criar({ dto, cooperativaId });
  }

  @Patch(':id')
  @Roles(ADMIN, SUPER_ADMIN)
  @AuditLog({ acao: 'politica-alocacao.atualizar', recurso: 'PoliticaAlocacao', recursoIdParam: 'id' })
  async atualizar(@Param('id') id: string, @Body() dto: UpdatePoliticaAlocacaoDto, @Req() req: any) {
    return this.politicas.atualizar({ id, dto, cooperativaId: tenantId(req, false) });
  }

  @Delete(':id')
  @Roles(ADMIN, SUPER_ADMIN)
  @AuditLog({ acao: 'politica-alocacao.remover', recurso: 'PoliticaAlocacao', recursoIdParam: 'id' })
  async remover(@Param('id') id: string, @Req() req: any) {
    return this.politicas.remover(id, tenantId(req, false));
  }
}
