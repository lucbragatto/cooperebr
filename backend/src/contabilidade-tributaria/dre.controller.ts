import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import { DreService } from './dre.service';
import type { VisaoDre } from './dre.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { TenantExempt } from '../auth/tenant-resource.decorator';
import { AuditLog } from '../audit/audit-log.decorator';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

/**
 * D-novo-BR-CT CT.5 (31/05/2026) — Endpoint REST das 4 DREs segregadas.
 *
 * Multi-tenant: cooperativaId vem do JWT (anti body-injection).
 * @TenantExempt declarado — não há :id de recurso, só lê apuração/preview
 * do tenant logado.
 *
 * ⚠️ GATE WALTER: DREs com validadoContador=false vêm com aviso destacado.
 * UI deve renderizar badge "⚠️ PENDENTE VALIDAÇÃO CONTADOR".
 */
@Controller('contabilidade-tributaria/dre')
export class DreController {
  constructor(private readonly service: DreService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @TenantExempt()
  @AuditLog({
    acao: 'contabilidade.dre.consultar',
    recurso: 'DRE',
  })
  @Get(':visao')
  async consultar(
    @Param('visao') visao: VisaoDre,
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new Error('cooperativaId obrigatório — SUPER_ADMIN sem tenant deve impersonate');
    }
    return this.service.montarDre(cooperativaId, ano, mes, visao);
  }
}
