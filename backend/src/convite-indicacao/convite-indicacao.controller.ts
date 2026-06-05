import { Controller, Get, Put, Post, Patch, Body, Param, Query, Req, UnauthorizedException, BadRequestException, HttpCode } from '@nestjs/common';
import { ConviteIndicacaoService } from './convite-indicacao.service';
import { CooperadoInstitucionalService } from './cooperado-institucional.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { StatusConvite } from '@prisma/client';
import { AuditLog } from '../audit/audit-log.decorator';

const { SUPER_ADMIN, ADMIN } = PerfilUsuario;

// Sprint 8A: SUPER_ADMIN não tem cooperativaId no JWT — aceita via query.
// Mesmo padrão aplicado em asaas.controller.ts (Sprint 7).
function resolverCooperativaId(req: any, queryCoopId?: string): string | undefined {
  const id = req.user?.cooperativaId || queryCoopId;
  if (!id && req.user?.perfil !== 'SUPER_ADMIN') throw new UnauthorizedException();
  return id || undefined;
}

@Controller('convite-indicacao')
export class ConviteIndicacaoController {
  constructor(
    private readonly service: ConviteIndicacaoService,
    // Fatia F-G1 (05/06/2026) — cooperado institucional pra G1
    private readonly institucional: CooperadoInstitucionalService,
  ) {}

  // ─── Fatia F-G1: Admin cria convite de indicação pela web ────────────
  //
  // Substitui o caminho "apenas via bot WhatsApp" (whatsapp-bot.service:2196).
  // Admin chama POST com { nomeConvidado, telefone, indicadorId? }.
  //
  // - indicadorId presente → cooperado real é o indicador (caminho legado MLM).
  //   Quando 1ª fatura é paga, processarPrimeiraFaturaPaga dá bônus normal.
  // - indicadorId AUSENTE → indicador = cooperado institucional fantasma da
  //   cooperativa (criado on-demand via garantirInstitucional). Decisão
  //   Luciano 05/06: nesse caso NÃO emite BeneficioIndicacao nem tokens
  //   (skip via `ehInstitucional` em processarPrimeiraFaturaPaga).
  //
  // Best-effort: envio WhatsApp não bloqueia criação (admin pode reenviar).
  @Roles(SUPER_ADMIN, ADMIN)
  @AuditLog({
    acao: 'convite_indicacao.admin.criar',
    recurso: 'ConviteIndicacao',
  })
  @HttpCode(201)
  @Post('admin')
  async criarPeloAdmin(
    @Req() req: any,
    @Body() body: { nomeConvidado: string; telefone: string; indicadorId?: string; cooperativaId?: string },
  ) {
    // Fatia F-G1 ajuste pós-merge: SUPER_ADMIN obrigatoriamente envia
    // cooperativaId no body (selecionada na UI). ADMIN usa a própria do JWT
    // (body.cooperativaId ignorado por segurança — não permite cross-tenant).
    const perfil = req.user?.perfil;
    let cooperativaId: string | undefined;
    if (perfil === 'SUPER_ADMIN') {
      if (!body.cooperativaId) {
        throw new BadRequestException(
          'SUPER_ADMIN deve informar `cooperativaId` no body (seletor de cooperativa).',
        );
      }
      cooperativaId = body.cooperativaId;
    } else {
      // ADMIN/etc: usa a própria coop do JWT (body.cooperativaId IGNORADO —
      // anti-spoof cross-tenant).
      cooperativaId = resolverCooperativaId(req);
      if (!cooperativaId) {
        throw new BadRequestException('cooperativaId obrigatório no contexto do admin.');
      }
    }
    if (!body.nomeConvidado || body.nomeConvidado.trim().length < 2) {
      throw new BadRequestException('nomeConvidado é obrigatório (mínimo 2 caracteres).');
    }
    const telLimpo = (body.telefone || '').replace(/\D/g, '');
    if (telLimpo.length < 10) {
      throw new BadRequestException('telefone obrigatório (10-11 dígitos com DDD).');
    }

    // Carrega cooperativa selecionada (nome dinâmico no template WA — sem
    // hardcode "CoopereBR"; SISGD é multi-tenant).
    const coopAlvo = await this.institucional['prisma'].cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { id: true, nome: true, ativo: true },
    });
    if (!coopAlvo || !coopAlvo.ativo) {
      throw new BadRequestException('Cooperativa inválida ou inativa.');
    }

    // Decisão Luciano #1: indicador opcional. Se ausente → fantasma institucional.
    let indicadorId = body.indicadorId;
    let isInstitucional = false;
    let nomeIndicador = '';
    if (!indicadorId) {
      const inst = await this.institucional.garantirInstitucional(cooperativaId);
      indicadorId = inst.id;
      isInstitucional = true;
      nomeIndicador = inst.nomeCompleto;
    } else {
      // Carrega nome real do indicador pra mensagem WA
      const ind = await this.institucional['prisma'].cooperado.findFirst({
        where: { id: indicadorId, cooperativaId },
        select: { nomeCompleto: true },
      });
      if (!ind) throw new BadRequestException('Indicador não encontrado neste tenant.');
      nomeIndicador = ind.nomeCompleto;
    }

    // Cria/upsert o convite (reusa caminho existente do bot)
    const r = await this.service.criarConvite(
      indicadorId,
      body.nomeConvidado.trim(),
      telLimpo,
      cooperativaId,
    );
    if (r.jaCooperado) {
      // Telefone já é cooperado ativo. Não é erro de aplicação — retornamos
      // status semântico pro frontend mostrar mensagem amigável.
      return { ok: false, jaCooperado: true, cooperado: r.cooperado };
    }

    // Best-effort: envia WhatsApp
    const envio = await this.service.enviarLinkPorWhatsappIndicacao({
      telefone: telLimpo,
      nomeConvidado: body.nomeConvidado.trim(),
      nomeIndicador,
      cooperativaNome: coopAlvo.nome,
      cooperativaId,
      institucional: isInstitucional,
    });

    return {
      ok: true,
      convite: {
        id: r.convite!.id,
        nomeConvidado: r.convite!.nomeConvidado,
        telefoneConvidado: r.convite!.telefoneConvidado,
        status: r.convite!.status,
      },
      institucional: isInstitucional,
      cooperativaNome: coopAlvo.nome,
      whatsappEnviado: envio.enviado,
      // D-novo-WA-DEV-FALSE-OK (05/06): propaga motivo do skip pra UI mostrar
      // status honesto (ex: "whitelist-dev" → "bloqueio de teste/whitelist").
      whatsappMotivo: envio.motivo,
      whatsappErro: envio.erro,
    };
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get()
  listar(
    @Req() req: any,
    @Query('status') status?: StatusConvite,
    @Query('diasSemAcao') diasSemAcao?: string,
    @Query('indicadorId') indicadorId?: string,
    @Query('page') page?: string,
    @Query('cooperativaId') queryCoopId?: string,
  ) {
    const cooperativaId = resolverCooperativaId(req, queryCoopId);
    return this.service.listarConvitesPendentes(cooperativaId as string, {
      status,
      diasSemAcao: diasSemAcao ? Number(diasSemAcao) : undefined,
      indicadorId,
      page: page ? Number(page) : 1,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('dashboard')
  dashboard(
    @Req() req: any,
    @Query('status') status?: StatusConvite,
    @Query('periodo') periodo?: string,
    @Query('page') page?: string,
    @Query('cooperativaId') queryCoopId?: string,
  ) {
    const cooperativaId = resolverCooperativaId(req, queryCoopId);
    return this.service.getDashboard(cooperativaId as string, {
      status,
      periodo: periodo ? Number(periodo) : undefined,
      page: page ? Number(page) : 1,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('stats')
  stats(@Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = resolverCooperativaId(req, queryCoopId);
    return this.service.getStats(cooperativaId as string);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('estatisticas')
  estatisticas(@Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = resolverCooperativaId(req, queryCoopId);
    return this.service.getEstatisticas(cooperativaId as string);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('config-lembretes')
  getConfigLembretes(@Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = resolverCooperativaId(req, queryCoopId);
    return this.service.getConfigLembretes(cooperativaId as string);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put('config-lembretes')
  salvarConfigLembretes(
    @Req() req: any,
    @Body() body: { cooldownDias: number; maxTentativas: number; habilitado: boolean; cooperativaId?: string },
  ) {
    const cooperativaId = resolverCooperativaId(req, body.cooperativaId);
    if (body.cooldownDias == null || body.maxTentativas == null || body.habilitado == null) {
      throw new BadRequestException('cooldownDias, maxTentativas e habilitado são obrigatórios');
    }
    if (body.cooldownDias < 1) throw new BadRequestException('cooldownDias deve ser >= 1');
    if (body.maxTentativas < 1) throw new BadRequestException('maxTentativas deve ser >= 1');
    return this.service.salvarConfigLembretes(cooperativaId as string, body);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post(':id/reenviar')
  reenviar(@Param('id') id: string, @Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = resolverCooperativaId(req, queryCoopId);
    return this.service.reenviarConvite(id, cooperativaId as string);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch(':id/cancelar')
  cancelar(@Param('id') id: string, @Req() req: any, @Query('cooperativaId') queryCoopId?: string) {
    const cooperativaId = resolverCooperativaId(req, queryCoopId);
    return this.service.cancelarConvite(id, cooperativaId as string);
  }
}
