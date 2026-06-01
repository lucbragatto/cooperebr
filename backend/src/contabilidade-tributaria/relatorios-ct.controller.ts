import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { RelatoriosCtService } from './relatorios-ct.service';
import type { TipoRelatorioCt } from './relatorios-ct.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { TenantExempt } from '../auth/tenant-resource.decorator';
import { AuditLog } from '../audit/audit-log.decorator';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

/**
 * D-novo-BR-CT CT.6 (31/05/2026) — Endpoint REST dos relatórios PDF.
 *
 * cooperativaId vem do JWT (anti body-injection). @TenantExempt declarado
 * (sem :id de recurso — opera sobre apuração/usinas do tenant logado).
 *
 * ⚠️ GATE VALIDAÇÃO FISCAL: PDF traz watermark + cabeçalho destacado quando
 * validadoContador=false.
 */
@Controller('contabilidade-tributaria/relatorios')
export class RelatoriosCtController {
  constructor(private readonly service: RelatoriosCtService) {}

  @Roles(SUPER_ADMIN, ADMIN)
  @TenantExempt()
  @AuditLog({
    acao: 'contabilidade.relatorio.gerar',
    recurso: 'RelatorioCt',
  })
  @Get(':tipo')
  async gerar(
    @Param('tipo') tipo: string,
    @Query('ano', ParseIntPipe) ano: number,
    @Query('mes', ParseIntPipe) mes: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new Error('cooperativaId obrigatório — SUPER_ADMIN sem tenant deve impersonate');
    }
    const { pdfPath, nomeArquivo } = await this.service.gerar(
      cooperativaId,
      ano,
      mes,
      tipo as TipoRelatorioCt,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nomeArquivo}"`);
    const stream = createReadStream(pdfPath);
    stream.pipe(res);
  }
}
