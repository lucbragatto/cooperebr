import { Body, Controller, Delete, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'node:fs';
import { ProprietarioService } from './proprietario.service';
import { RelatorioMensalService } from './relatorio-mensal.service';
import { ConviteProprietarioService } from './convite-proprietario.service';
import { ConviteEmailService } from './convite-email.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { SUPER_ADMIN, ADMIN, COOPERADO, PROPRIETARIO } = PerfilUsuario;

/**
 * Sub-Sprint F Sessao 1 MVP+ Etapa D (M30, 2026-05-26).
 *
 * Endpoints REST do Portal Proprietario. Todos com guard multi-tenant
 * baseado em proprietarioCooperadoId OU proprietarioEmail no JWT do
 * usuario autenticado.
 *
 * Roles aceitas:
 *   - PROPRIETARIO: papel novo (M30) — usuario nao-cooperado dono de usina
 *   - COOPERADO: caminho A (cooperado que tambem e proprietario, ex: Luciano)
 *   - ADMIN/SUPER_ADMIN: impersonate via troca de contexto (auth.service.trocarContexto)
 */
@Controller('proprietario')
export class ProprietarioController {
  constructor(
    private readonly service: ProprietarioService,
    private readonly relatorioService: RelatorioMensalService,
    private readonly conviteService: ConviteProprietarioService,
    private readonly conviteEmailService: ConviteEmailService,
  ) {}

  @Roles(SUPER_ADMIN, ADMIN, COOPERADO, PROPRIETARIO)
  @Get('dashboard')
  dashboard(@Req() req: any) {
    return this.service.dashboard(req.user);
  }

  @Roles(SUPER_ADMIN, ADMIN, COOPERADO, PROPRIETARIO)
  @Get('usinas/:id')
  detalheUsina(@Param('id') id: string, @Req() req: any) {
    return this.service.detalheUsina(req.user, id);
  }

  @Roles(SUPER_ADMIN, ADMIN, COOPERADO, PROPRIETARIO)
  @Get('repasses')
  listarRepasses(
    @Req() req: any,
    @Query('usinaId') usinaId?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.service.listarRepasses(req.user, {
      usinaId,
      dataInicio: dataInicio ? new Date(dataInicio) : undefined,
      dataFim: dataFim ? new Date(dataFim) : undefined,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN, COOPERADO, PROPRIETARIO)
  @Get('contratos')
  listarContratos(@Req() req: any, @Query('usinaId') usinaId?: string) {
    return this.service.listarContratos(req.user, { usinaId });
  }

  @Roles(SUPER_ADMIN, ADMIN, COOPERADO, PROPRIETARIO)
  @Get('despesas')
  listarDespesas(@Req() req: any, @Query('usinaId') usinaId?: string) {
    return this.service.listarDespesas(req.user, { usinaId });
  }

  /**
   * Sub-Sprint F Etapa F (M30): gera relatorio PDF sob demanda.
   * Retorna o PDF inline (stream) — frontend pode oferecer download.
   * Multi-tenant guard delegado pro RelatorioMensalService (que usa o
   * ProprietarioService.detalheUsina internamente).
   */
  @Roles(SUPER_ADMIN, ADMIN, COOPERADO, PROPRIETARIO)
  @Get('relatorios/:usinaId/:mesAno')
  async baixarRelatorio(
    @Param('usinaId') usinaId: string,
    @Param('mesAno') mesAno: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const pdfPath = await this.relatorioService.gerarSobDemanda(req.user, usinaId, mesAno);
    const filename = `relatorio-proprietario-${usinaId}-${mesAno}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    const stream = fs.createReadStream(pdfPath);
    stream.pipe(res);
  }

  // ─── Convite Proprietario (F.3 Etapa B Admin) ────────────────────────

  /**
   * POST /proprietario/convite — admin envia magic link por email.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @Post('convite')
  async criarConvite(@Body() body: { usinaId: string; email: string }, @Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new (await import('@nestjs/common')).BadRequestException(
        'cooperativaId nao identificado no JWT.',
      );
    }
    const convite = await this.conviteService.criarConvite({
      usinaId: body.usinaId,
      email: body.email,
      criadoPorUserId: req.user?.userId ?? req.user?.id ?? 'admin',
      cooperativaId,
    });
    // Dispara email (best-effort — falha de email nao quebra o fluxo)
    try {
      await this.conviteEmailService.enviarConvite({
        email: convite.email,
        link: convite.link,
        usinaId: convite.usinaId,
        cooperativaId,
        criadoPor: req.user?.nome ?? 'admin',
      });
    } catch (err) {
      // Logado pelo service, prossegue
    }
    return convite;
  }

  /**
   * GET /proprietario/convites/:usinaId — admin lista convites da usina.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @Get('convites/:usinaId')
  async listarConvites(@Param('usinaId') usinaId: string, @Req() req: any) {
    return this.conviteService.listarPorUsina(usinaId, req.user?.cooperativaId);
  }

  /**
   * POST /proprietario/convite/:id/reenviar — admin reenvia magic link.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @Post('convite/:id/reenviar')
  async reenviarConvite(@Param('id') id: string, @Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    const r = await this.conviteService.reenviar(id, cooperativaId);
    // Busca dados pra email
    try {
      const convites = await this.conviteService.listarPorUsina(
        // hack: precisamos do usinaId — busca por convite id via prisma direto
        await this.getUsinaIdFromConvite(id),
        cooperativaId,
      );
      const c = convites.find((x) => x.id === id);
      if (c) {
        await this.conviteEmailService.enviarConvite({
          email: c.email,
          link: r.link,
          usinaId: await this.getUsinaIdFromConvite(id),
          cooperativaId,
          criadoPor: req.user?.nome ?? 'admin',
          reenvio: true,
        });
      }
    } catch (err) {
      // Logado, prossegue
    }
    return r;
  }

  /**
   * DELETE /proprietario/convite/:id — admin cancela (DELETE real).
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @Delete('convite/:id')
  async cancelarConvite(@Param('id') id: string, @Req() req: any) {
    return this.conviteService.cancelar(id, req.user?.cooperativaId);
  }

  /**
   * POST /proprietario/cadastro-manual — admin cria Usuario direto sem
   * convite. Retorna senha temp UMA VEZ pra admin copiar.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @Post('cadastro-manual')
  async cadastroManual(
    @Body() body: { usinaId: string; nome: string; email: string; senhaTemp: string },
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    return this.conviteService.cadastroManual({
      nome: body.nome,
      email: body.email,
      senhaTemp: body.senhaTemp,
      usinaId: body.usinaId,
      criadoPorUserId: req.user?.userId ?? req.user?.id ?? 'admin',
      cooperativaId,
    });
  }

  // ─── Endpoints PUBLICOS aceitar-convite (F.3 Etapa C) ────────────────

  /**
   * GET /proprietario/aceitar-convite/:token — publico, valida token e
   * retorna dados pra tela frontend pre-popular.
   */
  @Public()
  @Get('aceitar-convite/:token')
  async validarConvite(@Param('token') token: string) {
    return this.conviteService.validarToken(token);
  }

  /**
   * POST /proprietario/aceitar-convite/:token — publico, define senha
   * e cria Usuario PROPRIETARIO.
   */
  @Public()
  @Post('aceitar-convite/:token')
  async aceitarConvite(
    @Param('token') token: string,
    @Body() body: { senhaNova: string },
  ) {
    return this.conviteService.aceitarConvite(token, body.senhaNova);
  }

  // ─── Helper privado ──────────────────────────────────────────────

  private async getUsinaIdFromConvite(conviteId: string): Promise<string> {
    // Acesso direto via service (que ja tem prisma).
    const prisma = (this.conviteService as any).prisma;
    const c = await prisma.conviteProprietario.findUnique({
      where: { id: conviteId },
      select: { usinaId: true },
    });
    return c?.usinaId ?? '';
  }
}
