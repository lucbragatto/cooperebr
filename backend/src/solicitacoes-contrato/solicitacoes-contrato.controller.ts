import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { SolicitacoesContratoService } from './solicitacoes-contrato.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { AuditLog } from '../audit/audit-log.decorator';
import { RecusarSolicitacaoDto } from './dto/recusar-solicitacao.dto';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('solicitacoes-contrato')
export class SolicitacoesContratoController {
  constructor(private readonly service: SolicitacoesContratoService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  listar(
    @Req() req: any,
    @Query('status') status?: 'PENDENTE' | 'APLICADA' | 'RECUSADA' | 'CANCELADA' | 'APROVADA',
  ) {
    return this.service.listar(req.user?.cooperativaId ?? null, status);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({
    acao: 'solicitacao_contrato.aprovar',
    recurso: 'SolicitacaoAlteracaoContrato',
    recursoIdParam: 'id',
  })
  @Post(':id/aprovar')
  aprovar(@Param('id') id: string, @Req() req: any) {
    return this.service.aprovar(
      id,
      req.user?.cooperativaId ?? null,
      req.user?.userId ?? req.user?.id ?? null,
    );
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({
    acao: 'solicitacao_contrato.recusar',
    recurso: 'SolicitacaoAlteracaoContrato',
    recursoIdParam: 'id',
  })
  @Post(':id/recusar')
  recusar(
    @Param('id') id: string,
    @Body() dto: RecusarSolicitacaoDto,
    @Req() req: any,
  ) {
    return this.service.recusar(
      id,
      dto.observacoesEquipe,
      req.user?.cooperativaId ?? null,
      req.user?.userId ?? req.user?.id ?? null,
    );
  }
}
