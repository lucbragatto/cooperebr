import { Controller, Get, Post, Body, Param, Query, Req, ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  LeadExpansaoService,
  LeadNaoEncontradoError,
  LeadJaConvertidoError,
} from './lead-expansao.service';
import { PrismaService } from '../prisma.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { AuditLog } from '../audit/audit-log.decorator';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('lead-expansao')
export class LeadExpansaoController {
  constructor(
    private readonly service: LeadExpansaoService,
    private readonly prisma: PrismaService,
  ) {}

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

  // POST público — criado pelo bot ao receber fatura fora da área (sem autenticação).
  //
  // Sprint Hardening Lateral (23/06/2026) — fix
  // D-novo-LEAD-EXPANSAO-PUBLIC-TENANT-SPOOF P1 (3ª ocorrência do padrão M45):
  //
  //  - `cooperativaId` NUNCA vem do body (descartado via destructure).
  //  - `?tenant=<id>` é OPCIONAL: se vier, valida `findUnique({id, ativo:true})`;
  //    se NÃO vier, lead fica como ÓRFÃO (cooperativaId=null) e o funil/admin
  //    roteia depois. Preserva o fluxo do bot WA que captura sem saber o tenant.
  //  - 404 em `?tenant=` inexistente/inativo (anti-enumeração).
  //
  // Fix P2 security 23/06: @Throttle explícito 10/min — antes só herdava global
  // 100/min (apropriado pra auth API, não pra POST público anônimo).
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post()
  async create(
    @Body() body: {
      telefone: string;
      nomeCompleto?: string;
      distribuidora: string;
      cidade?: string;
      estado?: string;
      numeroUC?: string;
      valorFatura?: number;
      economiaEstimada?: number;
      intencaoConfirmada?: boolean;
      // Aceito no shape pra compat com clientes antigos, mas SEMPRE descartado
      // (não propaga pro service). Hardening Lateral 23/06/2026.
      cooperativaId?: string;
    },
    @Query('tenant') tenantParam?: string,
  ) {
    // Sprint Hardening Lateral 23/06/2026 — descarta cooperativaId do body
    // explicitamente (destructure-discard pattern M45).
    const {
      cooperativaId: _ignored,
      ...safeBody
    } = body;

    let cooperativaId: string | null = null;
    if (tenantParam) {
      const coop = await this.prisma.cooperativa.findUnique({
        where: { id: tenantParam },
        select: { id: true, ativo: true },
      });
      if (!coop || !coop.ativo) {
        throw new NotFoundException('Cooperativa não encontrada ou inativa.');
      }
      cooperativaId = coop.id;
    }
    // Sem ?tenant= → cooperativaId=null (lead órfão; admin/funil roteia depois).
    return this.service.create({ ...safeBody, cooperativaId: cooperativaId ?? undefined });
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
