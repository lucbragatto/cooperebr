import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Req, Query } from '@nestjs/common';
import { CobrancasService } from './cobrancas.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('cobrancas')
export class CobrancasController {
  constructor(private readonly cobrancasService: CobrancasService) {}

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll(@Req() req: any, @Query('status') status?: string | string[]) {
    const statusArray = status
      ? Array.isArray(status) ? status : status.split(',')
      : undefined;
    return this.cobrancasService.findAll(req.user?.cooperativaId, statusArray);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.cobrancasService.findOne(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get('contrato/:contratoId')
  findByContrato(@Param('contratoId') contratoId: string) {
    return this.cobrancasService.findByContrato(contratoId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post()
  create(
    @Req() req: any,
    @Body()
    body: {
      contratoId: string;
      mesReferencia: number;
      anoReferencia: number;
      valorBruto: number;
      percentualDesconto: number;
      valorDesconto: number;
      valorLiquido: number;
      dataVencimento: Date;
      dataPagamento?: Date;
    },
  ) {
    return this.cobrancasService.create(body, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.cobrancasService.update(id, body);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Patch(':id/dar-baixa')
  darBaixa(
    @Param('id') id: string,
    @Body() body: { dataPagamento: string; valorPago: number; metodoPagamento?: 'PIX' | 'BOLETO' | 'TRANSFERENCIA' | 'DINHEIRO' },
  ) {
    return this.cobrancasService.darBaixa(id, body.dataPagamento, body.valorPago, body.metodoPagamento);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Patch(':id/cancelar')
  cancelar(
    @Param('id') id: string,
    @Body() body: { motivo: string },
  ) {
    return this.cobrancasService.cancelar(id, body.motivo);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post(':id/reenviar-notificacao')
  reenviarNotificacao(@Param('id') id: string, @Req() req: any) {
    return this.cobrancasService.reenviarNotificacao(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cobrancasService.remove(id);
  }
}
