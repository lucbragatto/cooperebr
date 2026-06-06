/**
 * Sprint Onboarding Bloco 0 Fatia 0.1 (06/06/2026).
 *
 * Controller PlanoClube. CRUD multi-tenant + AuditLog em mutações.
 *
 * Resolução de tenant (espelha padrão asaas.controller.ts e
 * convite-indicacao.controller.ts:13):
 *  - ADMIN: cooperativaId do JWT. body.cooperativaId IGNORADO (anti-spoof).
 *  - SUPER_ADMIN: aceita body.cooperativaId ou ?cooperativaId= (cross-tenant).
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { AuditLog } from '../audit/audit-log.decorator';
import { PlanoClubeService } from './plano-clube.service';
import { CreatePlanoClubeDto } from './dto/create-plano-clube.dto';
import { UpdatePlanoClubeDto } from './dto/update-plano-clube.dto';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

function resolverCoopId(req: any, override?: string): string {
  const perfil = req.user?.perfil;
  if (perfil === 'SUPER_ADMIN') {
    if (!override) {
      throw new BadRequestException(
        'SUPER_ADMIN deve informar `cooperativaId` (body ou ?cooperativaId=).',
      );
    }
    return override;
  }
  // ADMIN/etc: usa a própria do JWT. Body é IGNORADO por defesa anti-spoof.
  const id = req.user?.cooperativaId;
  if (!id) throw new UnauthorizedException('Usuário sem cooperativaId no contexto.');
  return id;
}

@Controller('plano-clube')
export class PlanoClubeController {
  constructor(private readonly service: PlanoClubeService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  listar(
    @Req() req: any,
    @Query('cooperativaId') queryCoopId?: string,
    @Query('incluirInativos') incluirInativos?: string,
  ) {
    const cooperativaId = resolverCoopId(req, queryCoopId);
    return this.service.listar(cooperativaId, {
      incluirInativos: incluirInativos === 'true',
    });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get(':id')
  obter(@Param('id') id: string, @Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = resolverCoopId(req, queryCoopId);
    return this.service.obter(id, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'plano-clube.criar', recurso: 'PlanoClube' })
  @HttpCode(201)
  @Post()
  criar(@Body() dto: CreatePlanoClubeDto, @Req() req: any) {
    const cooperativaId = resolverCoopId(req, dto.cooperativaId);
    return this.service.criar(dto, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'plano-clube.atualizar', recurso: 'PlanoClube', recursoIdParam: 'id' })
  @Patch(':id')
  atualizar(
    @Param('id') id: string,
    @Body() dto: UpdatePlanoClubeDto,
    @Req() req: any,
    @Query('cooperativaId') queryCoopId?: string,
  ) {
    const cooperativaId = resolverCoopId(req, queryCoopId);
    return this.service.atualizar(id, dto, cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'plano-clube.desativar', recurso: 'PlanoClube', recursoIdParam: 'id' })
  @Delete(':id')
  desativar(@Param('id') id: string, @Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = resolverCoopId(req, queryCoopId);
    return this.service.desativar(id, cooperativaId);
  }
}
