import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { SolicitacoesConfirmacaoPagamentoService } from './solicitacoes-confirmacao-pagamento.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { AuditLog } from '../audit/audit-log.decorator';
import { RecusarConfirmacaoDto } from './dto/recusar-confirmacao.dto';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('solicitacoes-confirmacao-pagamento')
export class SolicitacoesConfirmacaoPagamentoController {
  constructor(private readonly service: SolicitacoesConfirmacaoPagamentoService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  listar(
    @Req() req: any,
    @Query('status') status?: 'PENDENTE' | 'CONFIRMADA' | 'RECUSADA',
  ) {
    return this.service.listar(req.user?.cooperativaId ?? null, status);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({
    acao: 'solicitacao_confirmacao_pagamento.confirmar',
    recurso: 'SolicitacaoConfirmacaoPagamento',
    recursoIdParam: 'id',
  })
  @Post(':id/confirmar')
  confirmar(
    @Param('id') id: string,
    @Body() body: { marcarPago?: boolean } = {},
    @Req() req: any,
  ) {
    return this.service.confirmar(
      id,
      req.user?.cooperativaId ?? null,
      req.user?.userId ?? req.user?.id ?? null,
      Boolean(body?.marcarPago),
    );
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({
    acao: 'solicitacao_confirmacao_pagamento.recusar',
    recurso: 'SolicitacaoConfirmacaoPagamento',
    recursoIdParam: 'id',
  })
  @Post(':id/recusar')
  recusar(
    @Param('id') id: string,
    @Body() dto: RecusarConfirmacaoDto,
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
