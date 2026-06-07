/**
 * Sprint Portal Empresa 9.0 + 9.1 (04/06/2026) — Controller do portal da
 * empresa conveniada. Todos os endpoints exigem perfil EMPRESA_CONVENIADA +
 * são gated pelo @PagadorCooperadoOnly() — que valida posse `usuario.cooperadoId
 * === convenio.pagadorCooperadoId` e injeta `req.empresa` pra uso downstream.
 *
 * Reusa serviços existentes (ConvitesConvenioService, ConvenioAprovacaoService,
 * ConveniosMembrosService) — discriminação de admin vs empresa fica no
 * controller, services confiam no guard.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { PerfilUsuario } from '../../auth/perfil.enum';
import { PagadorCooperadoOnly } from '../../auth/pagador-cooperado.guard';
import { AuditLog } from '../../audit/audit-log.decorator';
import { PortalEmpresaService } from './portal-empresa.service';
import { ConvitesConvenioService } from '../convites-convenio.service';
import { ConvenioAprovacaoService } from '../convenios-aprovacao.service';

const { SUPER_ADMIN, COOPERADO, EMPRESA_CONVENIADA } = PerfilUsuario;

@UseGuards(JwtAuthGuard, RolesGuard)
// Opção A (Fatia F-G1 — 05/06/2026): empresa cooperada PJ tem perfil
// COOPERADO (decisão COOPERADO-ONLY 04/06). RolesGuard libera; o gate de
// posse real é o @PagadorCooperadoOnly em cada handler (validação por
// email match + pagadorCooperadoId). EMPRESA_CONVENIADA mantido por
// compat — qualquer Usuario legado com esse perfil continua entrando.
@Roles(SUPER_ADMIN, COOPERADO, EMPRESA_CONVENIADA)
@Controller('portal/meus-convenios')
export class PortalEmpresaController {
  constructor(
    private portalService: PortalEmpresaService,
    private convitesService: ConvitesConvenioService,
    private aprovacaoService: ConvenioAprovacaoService,
  ) {}

  /**
   * Lista convênios ATIVOS onde o cooperado autenticado é o pagador.
   * NÃO usa @PagadorCooperadoOnly (não tem :id; filtro feito pelo email).
   */
  @Get()
  async listarMeusConvenios(@Req() req: any) {
    const email = req.user?.email;
    if (!email) {
      throw new ForbiddenException('email obrigatório no token.');
    }
    // Resolve cooperadoId direto via prisma (SUPER_ADMIN pode ver os seus
    // próprios convênios se também for cooperado).
    const cooperado = await this.portalService['prisma'].cooperado.findFirst({
      where: { email },
      select: { id: true },
    });
    if (!cooperado) {
      return { data: [], total: 0 };
    }
    return this.portalService.listarMeusConvenios(cooperado.id);
  }

  /**
   * Dashboard completo de um convênio: header + contadores membros +
   * cobranças filtradas (empresa só vê PENDENTE/A_VENCER/PAGO + emitidas).
   */
  @PagadorCooperadoOnly()
  @Get(':id/dashboard')
  async dashboard(@Param('id') id: string) {
    return this.portalService.dashboardConvenio(id);
  }

  /**
   * Sprint Onboarding Bloco 2 Fatia 2.3 (07/06/2026) — kWh consolidado por mês.
   *
   * Empresa pagadora visualiza total de kWh consumido pelos funcionários (membros
   * custeados) + breakdown por funcionário. FONTE ÚNICA com a cobrança real —
   * o que a empresa vê aqui = o que ela paga na consolidada.
   *
   * Multi-tenant: guard `@PagadorCooperadoOnly()` JÁ validou que o cooperado
   * autenticado é o pagador do convênio e injetou `req.empresa.cooperativaId`.
   * Service usa esse `cooperativaId` no filtro do preview (defesa em profundidade).
   * Cross-convênio (não é pagador) → guard retorna 404 (anti-enumeração).
   *
   * AuditLog: visão financeira sensível — empresa vê o consumo dos funcionários.
   *
   * Query param `mes`: formato YYYY-MM. Default: mês ANTERIOR ao corrente (o cron
   * de cobrança consolidada opera em mês fechado; preview alinha). Validação
   * `mes <= corrente` — sem futuro.
   */
  @PagadorCooperadoOnly()
  @AuditLog({
    acao: 'portal-empresa.kwh-consumo.visualizar',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @Get(':id/kwh-consumo')
  async kwhConsumo(
    @Param('id') id: string,
    @Query('mes') mes: string | undefined,
    @Req() req: any,
  ) {
    const cooperativaId = req.empresa?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException('Contexto sem cooperativaId.');
    }

    // Resolve mês alvo (default: mês anterior).
    const hoje = new Date();
    const mesAtual = hoje.getMonth() + 1;
    const anoAtual = hoje.getFullYear();
    const mesAnteriorMes = mesAtual === 1 ? 12 : mesAtual - 1;
    const mesAnteriorAno = mesAtual === 1 ? anoAtual - 1 : anoAtual;

    let mesAlvo = mesAnteriorMes;
    let anoAlvo = mesAnteriorAno;

    if (mes) {
      if (!/^\d{4}-\d{2}$/.test(mes)) {
        throw new BadRequestException(
          `Query param mes inválido: "${mes}". Use YYYY-MM (ex: 2026-05).`,
        );
      }
      const [anoStr, mesStr] = mes.split('-');
      anoAlvo = Number(anoStr);
      mesAlvo = Number(mesStr);
      if (mesAlvo < 1 || mesAlvo > 12) {
        throw new BadRequestException(`Mês inválido: ${mesAlvo}. Use 1-12.`);
      }
      // mes <= corrente (não permite futuro)
      const corrente = anoAtual * 100 + mesAtual;
      const alvo = anoAlvo * 100 + mesAlvo;
      if (alvo > corrente) {
        throw new BadRequestException(
          `mes ${mes} é futuro. Use o mês corrente ou anterior.`,
        );
      }
    }

    return this.portalService.kwhConsumoConvenio({
      convenioId: id,
      mesReferencia: mesAlvo,
      anoReferencia: anoAlvo,
      cooperativaId,
    });
  }

  // ─── Convites — reusa ConvitesConvenioService ────────────────────────

  /**
   * Lista convites do convênio (mesma resposta da rota admin — frontend
   * componente <GestaoConvitesSection source='empresa'> espera o shape igual).
   */
  @PagadorCooperadoOnly()
  @Get(':id/convites')
  async listarConvites(@Param('id') convenioId: string, @Req() req: any) {
    const cooperativaId = req.empresa?.cooperativaId;
    if (!cooperativaId) throw new ForbiddenException('Contexto sem cooperativaId.');
    return this.convitesService.listarPorConvenio(convenioId, cooperativaId);
  }

  /**
   * Cria convite (empresa convida funcionário). Envia link por WhatsApp.
   * Best-effort: falha no WA não reverte criação.
   */
  @PagadorCooperadoOnly()
  @AuditLog({
    acao: 'portal-empresa.convite.criar',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @HttpCode(201)
  @Post(':id/convites')
  async criarConvite(
    @Param('id') convenioId: string,
    @Body() dto: { nomeConvidado: string; telefone: string },
    @Req() req: any,
  ) {
    const cooperativaId = req.empresa?.cooperativaId;
    const userId = req.user?.id ?? req.user?.userId;
    if (!cooperativaId) throw new ForbiddenException('Contexto sem cooperativaId.');
    if (!userId) throw new ForbiddenException('userId obrigatório no contexto.');

    const convite = await this.convitesService.criarConvite({
      convenioId,
      nomeConvidado: dto.nomeConvidado,
      telefone: dto.telefone,
      criadoPorUserId: userId,
      cooperativaId,
    });

    const envio = await this.convitesService.enviarLinkPorWhatsapp({
      telefone: convite.telefone,
      link: convite.link,
      nomeConvidado: convite.nomeConvidado,
      empresaNome: convite.empresaNome,
      cooperativaId,
    });

    return {
      id: convite.id,
      tokenSufixo: '...' + convite.token.slice(-6),
      nomeConvidado: convite.nomeConvidado,
      telefone: convite.telefone,
      expiresAt: convite.expiresAt,
      reused: convite.reused,
      whatsappEnviado: envio.enviado,
      whatsappErro: envio.erro,
    };
  }

  /**
   * Sprint Convite-Lote LOTE.2 (07/06/2026) — envio em lote async (portal-empresa).
   */
  @PagadorCooperadoOnly()
  @AuditLog({
    acao: 'portal-empresa.convite.lote.enviar',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @HttpCode(202)
  @Post(':id/convites/lote/enviar')
  async enviarConviteLote(
    @Param('id') convenioId: string,
    @Body() body: { destinatarios: Array<{ nome: string; telefone: string }> },
    @Req() req: any,
  ) {
    const cooperativaId = req.empresa?.cooperativaId;
    const userId = req.user?.id ?? req.user?.userId;
    if (!cooperativaId) throw new ForbiddenException('Contexto sem cooperativaId.');
    if (!userId) throw new ForbiddenException('userId obrigatório no contexto.');
    return this.convitesService.enviarLote({
      convenioId,
      cooperativaId,
      criadoPorUserId: userId,
      destinatarios: body?.destinatarios ?? [],
    });
  }

  /**
   * Sprint Convite-Lote LOTE.3 (07/06/2026) — status do lote (portal-empresa).
   */
  @PagadorCooperadoOnly()
  @Get(':id/convites/lote/:loteId/status')
  async statusConviteLote(
    @Param('id') convenioId: string,
    @Param('loteId') loteId: string,
    @Req() req: any,
  ) {
    const cooperativaId = req.empresa?.cooperativaId;
    if (!cooperativaId) throw new ForbiddenException('Contexto sem cooperativaId.');
    return this.convitesService.statusLote({
      loteId,
      convenioId,
      cooperativaId,
    });
  }

  /**
   * Sprint Convite-Lote LOTE.1 (07/06/2026) — preview do lote no portal-empresa.
   * Anti-IDOR via @PagadorCooperadoOnly (já valida posse e injeta cooperativaId
   * em req.empresa). Service revalida tenant — defesa em profundidade.
   */
  @PagadorCooperadoOnly()
  @AuditLog({
    acao: 'portal-empresa.convite.lote.preview',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @HttpCode(200)
  @Post(':id/convites/lote/preview')
  async previewConviteLote(
    @Param('id') convenioId: string,
    @Body() body: { csv: string },
    @Req() req: any,
  ) {
    const cooperativaId = req.empresa?.cooperativaId;
    if (!cooperativaId) throw new ForbiddenException('Contexto sem cooperativaId.');
    return this.convitesService.previewLote({
      convenioId,
      cooperativaId,
      csv: body?.csv ?? '',
    });
  }

  /**
   * Reenvia link do convite (regenera token + TTL + WA).
   */
  @PagadorCooperadoOnly()
  @AuditLog({
    acao: 'portal-empresa.convite.reenviar',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @HttpCode(200)
  @Post(':id/convites/:conviteId/reenviar')
  async reenviarConvite(
    @Param('id') _convenioId: string,
    @Param('conviteId') conviteId: string,
    @Req() req: any,
  ) {
    const cooperativaId = req.empresa?.cooperativaId;
    if (!cooperativaId) throw new ForbiddenException('Contexto sem cooperativaId.');
    const atualizado = await this.convitesService.reenviarConvite(
      conviteId,
      cooperativaId,
    );
    const convite = await this.convitesService['prisma'].conviteConvenioMembro.findUnique({
      where: { id: atualizado.id },
      include: { convenio: { select: { empresaNome: true } } },
    });
    if (convite) {
      await this.convitesService.enviarLinkPorWhatsapp({
        telefone: convite.telefone,
        link: atualizado.link,
        nomeConvidado: convite.nomeConvidado,
        empresaNome: convite.convenio.empresaNome,
        cooperativaId,
      });
    }
    return {
      id: atualizado.id,
      tokenSufixo: '...' + atualizado.token.slice(-6),
      expiresAt: atualizado.expiresAt,
    };
  }

  /**
   * Cancela convite (DELETE real). Só permite se ainda não usado.
   */
  @PagadorCooperadoOnly()
  @AuditLog({
    acao: 'portal-empresa.convite.cancelar',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @Delete(':id/convites/:conviteId')
  async cancelarConvite(
    @Param('id') _convenioId: string,
    @Param('conviteId') conviteId: string,
    @Req() req: any,
  ) {
    const cooperativaId = req.empresa?.cooperativaId;
    if (!cooperativaId) throw new ForbiddenException('Contexto sem cooperativaId.');
    return this.convitesService.cancelar(conviteId, cooperativaId);
  }

  // ─── Membros pendentes — reusa ConvenioAprovacaoService ──────────────

  /**
   * Lista membros pendentes (mesma shape da rota admin — frontend componente
   * <MembrosPendentesSection source='empresa'> espera idêntico).
   *
   * Empresa só age em PENDENTE_APROVACAO_EMPRESA — mas exibimos ambos pra
   * dar visibilidade do funil (PENDENTE_APROVACAO_ADMIN = "aguardando
   * CoopereBR" no mockup).
   */
  @PagadorCooperadoOnly()
  @Get(':id/membros-pendentes')
  async listarPendentes(@Param('id') convenioId: string, @Req() req: any) {
    const cooperativaId = req.empresa?.cooperativaId;
    if (!cooperativaId) throw new ForbiddenException('Contexto sem cooperativaId.');
    return this.aprovacaoService.listarPendentes(convenioId, cooperativaId);
  }

  /**
   * Sprint Portal Empresa 9.1 + HOTFIX (04/06/2026) — Empresa decide in-portal
   * (JWT, sem magic link). Chama decidirAprovacaoEmpresaLogada que opera
   * direto no membroId — NÃO depende de AprovacaoConvenioMembro existente
   * (magic link só é criado quando admin clica "Reenviar aprovação empresa").
   *
   * Body: { decisao: 'APROVAR' | 'REJEITAR', motivo?: string }
   *
   * Multi-tenant: cooperativaId vem do PagadorCooperadoGuard (req.empresa).
   * Audit + state machine + notificações intactos (mesma cadeia da Porta 1).
   */
  @PagadorCooperadoOnly()
  @AuditLog({
    acao: 'portal-empresa.membro.decidir',
    recurso: 'ConvenioCooperado',
    recursoIdParam: 'membroId',
  })
  @HttpCode(200)
  @Post(':id/membros/:membroId/decidir')
  async decidirAprovacao(
    @Param('id') _convenioId: string,
    @Param('membroId') membroId: string,
    @Body() body: { decisao: 'APROVAR' | 'REJEITAR'; motivo?: string },
    @Req() req: any,
  ) {
    const cooperativaId = req.empresa?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException('Contexto sem cooperativaId.');
    }
    return this.aprovacaoService.decidirAprovacaoEmpresaLogada({
      membroId,
      cooperativaId,
      decisao: body.decisao,
      motivo: body.motivo,
      ip: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
  }
}
