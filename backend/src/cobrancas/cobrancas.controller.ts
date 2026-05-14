import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Req, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CobrancasService } from './cobrancas.service';
import { CobrancaPdfService } from './cobranca-pdf.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import * as fs from 'fs';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('cobrancas')
export class CobrancasController {
  constructor(
    private readonly cobrancasService: CobrancasService,
    private readonly cobrancaPdf: CobrancaPdfService,
  ) {}

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
  findByContrato(@Param('contratoId') contratoId: string, @Req() req: any) {
    // D-48-cobrancas IDOR fix: filtro tenant via contrato.cooperativaId.
    return this.cobrancasService.findByContrato(contratoId, req.user?.cooperativaId);
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
      percentualDesconto?: number;
      valorDesconto?: number;
      valorLiquido?: number;
      dataVencimento: Date;
      dataPagamento?: Date;
    },
  ) {
    return this.cobrancasService.create(body, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    // D-48-cobrancas IDOR fix.
    return this.cobrancasService.update(id, body, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Patch(':id/dar-baixa')
  darBaixa(
    @Param('id') id: string,
    @Body() body: { dataPagamento: string; valorPago: number; metodoPagamento?: 'PIX' | 'BOLETO' | 'TRANSFERENCIA' | 'DINHEIRO' },
    @Req() req: any,
  ) {
    // D-48-cobrancas IDOR fix.
    return this.cobrancasService.darBaixa(id, body.dataPagamento, body.valorPago, body.metodoPagamento, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Patch(':id/cancelar')
  cancelar(
    @Param('id') id: string,
    @Body() body: { motivo: string },
    @Req() req: any,
  ) {
    // D-48-cobrancas IDOR fix.
    return this.cobrancasService.cancelar(id, body.motivo, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id/pdf')
  async gerarPdf(@Param('id') id: string, @Res() res: Response, @Req() req: any) {
    // D-48-cobrancas IDOR fix: valida tenant via findOne antes de gerar PDF.
    await this.cobrancasService.findOne(id, req.user?.cooperativaId);
    const pdfPath = await this.cobrancaPdf.gerarPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="fatura-${id}.pdf"`);
    const stream = fs.createReadStream(pdfPath);
    stream.pipe(res);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post(':id/reenviar-notificacao')
  reenviarNotificacao(@Param('id') id: string, @Req() req: any) {
    return this.cobrancasService.reenviarNotificacao(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    // D-48-cobrancas IDOR fix.
    return this.cobrancasService.remove(id, req.user?.cooperativaId);
  }
}
