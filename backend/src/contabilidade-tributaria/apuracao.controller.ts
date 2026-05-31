import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApuracaoService } from './apuracao.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { TenantExempt, TenantResource } from '../auth/tenant-resource.decorator';
import { AuditLog } from '../audit/audit-log.decorator';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

/**
 * D-novo-BR-CT CT.4 (31/05/2026) — Endpoints do motor de apuração mensal segregada.
 *
 * ⚠️ GATE WALTER: snapshots nascem validadoContador=false. Walter (contador)
 * valida via PUT /:id/validar quando confere os números.
 *
 * Multi-tenant:
 *  - SUPER_ADMIN: pode operar qualquer cooperativa (cooperativaId via JWT
 *    impersonado OU via path quando aplicável).
 *  - ADMIN: tenant-scoped — cooperativaId vem do JWT, não do body.
 */
@Controller('contabilidade-tributaria/apuracao')
export class ApuracaoController {
  constructor(private readonly service: ApuracaoService) {}

  /**
   * Preview on-the-fly — calcula mas não persiste. Pode ser chamado N vezes.
   * cooperativaId vem do JWT (anti body-injection).
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantExempt()
  @Get(':ano/:mes')
  async preview(
    @Param('ano', ParseIntPipe) ano: number,
    @Param('mes', ParseIntPipe) mes: number,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new Error('cooperativaId obrigatório — SUPER_ADMIN sem tenant deve impersonate');
    }
    return this.service.apurarMes(cooperativaId, ano, mes);
  }

  /**
   * Fecha o mês — persiste snapshot imutável (validadoContador=false).
   * Race-guard via @@unique([cooperativaId, ano, mes]).
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantExempt()
  @AuditLog({
    acao: 'contabilidade.apuracao.fechar',
    recurso: 'ApuracaoMensalSegregada',
  })
  @Post(':ano/:mes/fechar')
  async fechar(
    @Param('ano', ParseIntPipe) ano: number,
    @Param('mes', ParseIntPipe) mes: number,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    const usuarioId = req.user?.userId ?? req.user?.id;
    if (!cooperativaId) {
      throw new Error('cooperativaId obrigatório — SUPER_ADMIN sem tenant deve impersonate');
    }
    return this.service.fecharApuracao(cooperativaId, ano, mes, usuarioId);
  }

  /**
   * Walter/contador valida o snapshot fechado. Gate explícito antes de virar
   * valor fiscal real (DCTF/SPED).
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'apuracaoMensalSegregada' })
  @AuditLog({
    acao: 'contabilidade.apuracao.validar',
    recurso: 'ApuracaoMensalSegregada',
    recursoIdParam: 'id',
  })
  @Put(':id/validar')
  async validar(
    @Param('id') id: string,
    @Body() body: { observacao?: string },
    @Req() req: any,
  ) {
    const usuarioId = req.user?.userId ?? req.user?.id;
    const cooperativaId =
      req.user?.perfil === SUPER_ADMIN ? null : req.user?.cooperativaId ?? null;
    return this.service.validarApuracao(id, cooperativaId, usuarioId, body?.observacao);
  }

  /**
   * SUPER_ADMIN apenas — reabre snapshot fechado (auditoria fiscal exige motivo).
   * Limpa validação (precisa Walter validar de novo após re-fechar).
   */
  @Roles(SUPER_ADMIN)
  @TenantResource({ model: 'apuracaoMensalSegregada' })
  @AuditLog({
    acao: 'contabilidade.apuracao.reabrir',
    recurso: 'ApuracaoMensalSegregada',
    recursoIdParam: 'id',
  })
  @Put(':id/reabrir')
  async reabrir(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @Req() req: any,
  ) {
    const usuarioId = req.user?.userId ?? req.user?.id;
    return this.service.reabrirApuracao(id, usuarioId, body?.motivo);
  }
}
