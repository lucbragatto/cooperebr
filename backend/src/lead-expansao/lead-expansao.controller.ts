import { Controller, Get, Post, Body, Param, Query, Req, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  LeadExpansaoService,
  LeadNaoEncontradoError,
  LeadJaConvertidoError,
} from './lead-expansao.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { AuditLog } from '../audit/audit-log.decorator';

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

  // Sprint Funil M48 (22/06/2026) — Camada 1 Fatia E.
  // Converte LeadExpansao em Cooperado. cooperativaId SEMPRE do JWT (lição M45);
  // service rejeita se lead.cooperativaId != JWT.
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({ acao: 'lead.converter', recurso: 'LeadExpansao', recursoIdParam: 'id' })
  @Post(':id/converter')
  async converter(
    @Param('id') id: string,
    @Body() body: {
      nomeCompleto: string;
      cpf: string;
      email: string;
      telefone?: string;
      status?: string;
    },
    @Req() req: any,
  ) {
    const cooperativaId: string | undefined = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException(
        'cooperativaId obrigatório no JWT pra converter lead.',
      );
    }
    if (!body.nomeCompleto?.trim() || !body.cpf?.trim() || !body.email?.trim()) {
      throw new BadRequestException(
        'nomeCompleto + cpf + email obrigatórios pra criar Cooperado.',
      );
    }
    try {
      return await this.service.converter(id, cooperativaId, body);
    } catch (err) {
      // H1 code-reviewer 22/06: mapeamento por instanceof (não substring).
      if (err instanceof LeadNaoEncontradoError) {
        throw new NotFoundException('Lead não encontrado neste tenant.');
      }
      if (err instanceof LeadJaConvertidoError) {
        throw new BadRequestException('Lead já foi convertido.');
      }
      throw err;
    }
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
