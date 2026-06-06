/**
 * Sprint Onboarding Bloco 0 Fatia 0.3 (06/06/2026).
 *
 * Endpoints REST de adesão opt-in do Cooperado ao Clube. Admin only —
 * sem auto-inscrição pelo portal (Fatia 0.3 é só campo + endpoint; matrícula
 * automática é Bloco 1).
 *
 * Resolução de tenant espelha padrão consolidado:
 *  - ADMIN: usa cooperativaId do JWT. body/query ignorados (anti-spoof).
 *  - SUPER_ADMIN: aceita ?cooperativaId= explícito (cross-tenant).
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { AuditLog } from '../audit/audit-log.decorator';
import { CooperadoClubeService } from './cooperado-clube.service';
import { AderirClubeDto } from './dto/aderir-clube.dto';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

function resolverCoopId(req: any, override?: string): string {
  const perfil = req.user?.perfil;
  if (perfil === 'SUPER_ADMIN') {
    if (!override) {
      throw new BadRequestException(
        'SUPER_ADMIN deve informar `cooperativaId` (?cooperativaId=).',
      );
    }
    return override;
  }
  const id = req.user?.cooperativaId;
  if (!id) throw new UnauthorizedException('Usuário sem cooperativaId no contexto.');
  return id;
}

@Controller('cooperados/:id/clube')
export class CooperadoClubeController {
  constructor(private readonly service: CooperadoClubeService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'cooperado.clube.aderir', recurso: 'Cooperado', recursoIdParam: 'id' })
  @HttpCode(200)
  @Post('aderir')
  aderir(
    @Param('id') cooperadoId: string,
    @Body() dto: AderirClubeDto,
    @Req() req: any,
    @Query('cooperativaId') queryCoopId?: string,
  ) {
    const adminCooperativaId = resolverCoopId(req, queryCoopId);
    return this.service.aderir({
      cooperadoId,
      planoClubeId: dto.planoClubeId,
      adminCooperativaId,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({ acao: 'cooperado.clube.cancelar', recurso: 'Cooperado', recursoIdParam: 'id' })
  @Delete()
  cancelar(
    @Param('id') cooperadoId: string,
    @Req() req: any,
    @Query('cooperativaId') queryCoopId?: string,
  ) {
    const adminCooperativaId = resolverCoopId(req, queryCoopId);
    return this.service.cancelar({ cooperadoId, adminCooperativaId });
  }
}
