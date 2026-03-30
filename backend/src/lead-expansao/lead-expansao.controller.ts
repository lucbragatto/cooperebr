import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common';
import { LeadExpansaoService } from './lead-expansao.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('lead-expansao')
export class LeadExpansaoController {
  constructor(private readonly service: LeadExpansaoService) {}

  // GET filtrado por tenant: ADMIN vê só os leads da sua cooperativa
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll(
    @Req() req: any,
    @Query('distribuidora') distribuidora?: string,
    @Query('estado') estado?: string,
    @Query('intencaoConfirmada') intencaoConfirmada?: string,
  ) {
    const cooperativaId = req.user?.perfil === PerfilUsuario.SUPER_ADMIN
      ? undefined
      : req.user?.cooperativaId;
    return this.service.findAll({
      distribuidora,
      estado,
      intencaoConfirmada: intencaoConfirmada !== undefined ? intencaoConfirmada === 'true' : undefined,
      cooperativaId,
    });
  }

  // POST público — criado pelo bot ao receber fatura fora da área (sem autenticação)
  @Public()
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

  // Resumo para investidores — apenas ADMIN/SUPER_ADMIN
  @Roles(SUPER_ADMIN, ADMIN)
  @Get('resumo-investidores')
  getResumoInvestidores(@Req() req: any) {
    const cooperativaId = req.user?.perfil === PerfilUsuario.SUPER_ADMIN
      ? undefined
      : req.user?.cooperativaId;
    return this.service.getResumoInvestidores(cooperativaId);
  }

  // Notificar leads — apenas ADMIN/SUPER_ADMIN
  @Roles(SUPER_ADMIN, ADMIN)
  @Post('notificar/:distribuidora')
  notificar(@Param('distribuidora') distribuidora: string, @Req() req: any) {
    const cooperativaId = req.user?.perfil === PerfilUsuario.SUPER_ADMIN
      ? undefined
      : req.user?.cooperativaId;
    return this.service.notificarLeadsPorDistribuidora(distribuidora, cooperativaId);
  }
}
