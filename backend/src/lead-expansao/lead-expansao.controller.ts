import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { LeadExpansaoService } from './lead-expansao.service';

@Controller('lead-expansao')
export class LeadExpansaoController {
  constructor(private readonly service: LeadExpansaoService) {}

  @Get()
  findAll(
    @Query('distribuidora') distribuidora?: string,
    @Query('estado') estado?: string,
    @Query('intencaoConfirmada') intencaoConfirmada?: string,
  ) {
    return this.service.findAll({
      distribuidora,
      estado,
      intencaoConfirmada: intencaoConfirmada !== undefined ? intencaoConfirmada === 'true' : undefined,
    });
  }

  @Post()
  create(@Body() body: {
    telefone: string;
    nomeCompleto?: string;
    distribuidora: string;
    cidade?: string;
    estado?: string;
    numeroUC?: string;
    valorFatura?: number;
    economiaEstimada?: number;
    intencaoConfirmada?: boolean;
    cooperativaId?: string;
  }) {
    return this.service.create(body);
  }

  @Get('resumo-investidores')
  getResumoInvestidores() {
    return this.service.getResumoInvestidores();
  }

  @Post('notificar/:distribuidora')
  notificar(@Param('distribuidora') distribuidora: string) {
    return this.service.notificarLeadsPorDistribuidora(distribuidora);
  }
}
