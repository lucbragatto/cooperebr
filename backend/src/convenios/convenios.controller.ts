import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, Res, ForbiddenException, BadRequestException, HttpCode,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { TenantResource } from '../auth/tenant-resource.decorator';
import { AuditLog } from '../audit/audit-log.decorator';
import { ConveniosService } from './convenios.service';
import { ConveniosMembrosService } from './convenios-membros.service';
import { ConveniosProgressaoService } from './convenios-progressao.service';
import { ConveniosCusteioService } from './convenios-custeio.service';
// Sprint Convite-Convênio Fatia 2a (03/06/2026)
import { ConvitesConvenioService } from './convites-convenio.service';
import { CriarConviteMembroDto } from './dto/criar-convite-membro.dto';
// Sprint Convite-Convênio Fatia 3 (03/06/2026)
import { ConvenioAprovacaoService } from './convenios-aprovacao.service';
import { SolicitarDocumentacaoDto } from './dto/solicitar-documentacao.dto';
import { RejeitarMembroAdminDto } from './dto/rejeitar-membro-admin.dto';
import { StatusMembroConvenio } from '@prisma/client';
import { CreateConvenioDto, UpdateConvenioDto, AddMembroDto, UpdateMembroDto } from './convenios.dto';
import { RegistrarMovimentoConvenioContratoDto } from './dto/registrar-movimento-convenio-contrato.dto';
import { ConfigBeneficio } from './convenios-progressao.service';
import { ContabilidadeTributariaService } from '../contabilidade-tributaria/contabilidade-tributaria.service';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('convenios')
export class ConveniosController {
  constructor(
    private readonly conveniosService: ConveniosService,
    private readonly membrosService: ConveniosMembrosService,
    private readonly progressaoService: ConveniosProgressaoService,
    private readonly contabilidade: ContabilidadeTributariaService,
    // D-FISCAL-2.4.4b — endpoints de cobranças consolidadas custeio
    private readonly custeioService: ConveniosCusteioService,
    // Sprint Convite-Convênio Fatia 2a — endpoints admin de convite per-recipient
    private readonly convitesService: ConvitesConvenioService,
    // Sprint Convite-Convênio Fatia 3 — fluxo aprovação 3 portas
    private readonly aprovacaoService: ConvenioAprovacaoService,
  ) {}

  // ─── CRUD Convênio ──────────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Post()
  create(@Req() req: any, @Body() dto: CreateConvenioDto) {
    return this.conveniosService.create(req.user.cooperativaId, dto);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll(
    @Req() req: any,
    @Query('tipo') tipo?: string,
    @Query('status') status?: string,
    @Query('pagador') pagador?: string,
    @Query('busca') busca?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conveniosService.findAll(req.user.cooperativaId, {
      tipo,
      status,
      pagador,
      busca,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  // ─── Governança GLOBAL (SUPER_ADMIN) ─────────────────────────────────

  @Roles(SUPER_ADMIN)
  @Get('global/pendentes')
  listarPendentesGlobal() {
    return this.conveniosService.listarPendentesGlobal();
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.conveniosService.findOne(id, req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN)
  @Patch(':id/aprovar')
  aprovarGlobal(@Param('id') id: string) {
    return this.conveniosService.aprovarGlobal(id);
  }

  @Roles(SUPER_ADMIN)
  @Patch(':id/rejeitar')
  rejeitarGlobal(@Param('id') id: string, @Body() body: { motivoRejeicao: string }) {
    return this.conveniosService.rejeitarGlobal(id, body.motivoRejeicao);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateConvenioDto, @Req() req: any) {
    await this.conveniosService.findOne(id, req.user.cooperativaId);
    // Hardening Lateral 23/06 — defense-in-depth: passa cooperativaIdJwt
    // pro service revalidar internamente (findOne com filtro).
    return this.conveniosService.update(id, dto, req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.conveniosService.findOne(id, req.user.cooperativaId);
    // Hardening Lateral 23/06 — passa cooperativaId pro service DiD.
    return this.conveniosService.remove(id, req.user.cooperativaId);
  }

  // ─── Membros ────────────────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id/membros')
  async listarMembros(@Param('id') id: string, @Req() req: any) {
    await this.conveniosService.findOne(id, req.user.cooperativaId);
    // Hardening Lateral 23/06 — DiD: passa cooperativaIdJwt pro service.
    return this.membrosService.listarMembros(id, req.user.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post(':id/membros')
  async adicionarMembro(@Param('id') id: string, @Body() dto: AddMembroDto, @Req() req: any) {
    await this.conveniosService.findOne(id, req.user.cooperativaId);
    const tierOk = await this.conveniosService.checkTierRequisito(dto.cooperadoId, id);
    if (!tierOk) {
      const convenio = await this.conveniosService.findOne(id);
      throw new ForbiddenException(`Você precisa ser nível ${convenio.tierMinimoClube} para acessar este convênio`);
    }
    return this.membrosService.adicionarMembro(id, dto.cooperadoId, dto.matricula);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Patch(':id/membros/:cooperadoId')
  async updateMembro(
    @Param('id') id: string,
    @Param('cooperadoId') cooperadoId: string,
    @Body() dto: UpdateMembroDto,
    @Req() req: any,
  ) {
    await this.conveniosService.findOne(id, req.user.cooperativaId);
    return this.membrosService.updateMembro(id, cooperadoId, dto);
  }

  /**
   * DELETE membro do convênio. Comportamento dual (Fatia 3 B.1):
   *  - MEMBRO_ATIVO → soft-delete legado (status=MEMBRO_DESLIGADO, ativo=false)
   *  - PENDENTE_APROVACAO_* / MEMBRO_REJEITADO_* / MEMBRO_DESLIGADO →
   *    hard delete via cleanupPendente (remove ConvenioCooperado +
   *    AprovacaoConvenioMembro + limpa cross-ref ConviteConvenioMembro)
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @AuditLog({
    acao: 'convenio.membro.remover',
    recurso: 'ConvenioCooperado',
    recursoIdParam: 'cooperadoId',
  })
  @Delete(':id/membros/:cooperadoId')
  async removerMembro(
    @Param('id') id: string,
    @Param('cooperadoId') cooperadoId: string,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) throw new ForbiddenException('cooperativaId obrigatório.');
    await this.conveniosService.findOne(id, cooperativaId);

    // Carrega o vínculo pra decidir o caminho
    const membro = await this.conveniosService['prisma'].convenioCooperado.findUnique({
      where: { convenioId_cooperadoId: { convenioId: id, cooperadoId } },
      select: { id: true, status: true },
    });
    if (!membro) {
      throw new BadRequestException('Vínculo não encontrado.');
    }
    const isPendenteOuTerminal =
      membro.status === 'PENDENTE_APROVACAO_EMPRESA' ||
      membro.status === 'PENDENTE_APROVACAO_ADMIN' ||
      membro.status === 'MEMBRO_REJEITADO_EMPRESA' ||
      membro.status === 'MEMBRO_REJEITADO_ADMIN' ||
      membro.status === 'MEMBRO_DESLIGADO';
    if (isPendenteOuTerminal) {
      const adminUserId = req.user?.id ?? req.user?.userId;
      if (!adminUserId) throw new ForbiddenException('userId obrigatório.');
      return this.aprovacaoService.cleanupPendente({
        membroId: membro.id,
        cooperativaId,
        adminUserId,
      });
    }
    // MEMBRO_ATIVO → soft-delete legado (MEMBRO_DESLIGADO + recalcularFaixa)
    return this.membrosService.removerMembro(id, cooperadoId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post(':id/importar')
  async importarMembros(@Param('id') id: string, @Body() body: { membros: { cooperadoId: string; matricula?: string }[] }, @Req() req: any) {
    await this.conveniosService.findOne(id, req.user.cooperativaId);
    return this.membrosService.importarMembros(id, body.membros);
  }

  // ─── Progressão ─────────────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id/progressao')
  async progressao(@Param('id') id: string, @Req() req: any) {
    const convenio = await this.conveniosService.findOne(id, req.user.cooperativaId);
    const config = convenio.configBeneficio as ConfigBeneficio;
    const faixas = config?.faixas ?? [];

    return {
      faixaAtualIndex: convenio.faixaAtualIndex,
      membrosAtivos: convenio.membrosAtivosCache,
      descontoMembrosAtual: Number(convenio.descontoMembrosAtual),
      descontoConveniadoAtual: Number(convenio.descontoConveniadoAtual),
      faixas,
      historico: convenio.historicoFaixas,
    };
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post(':id/recalcular')
  async recalcular(@Param('id') id: string, @Req() req: any) {
    await this.conveniosService.findOne(id, req.user.cooperativaId);
    return this.progressaoService.recalcularFaixa(id, 'RECALCULO_ADMIN');
  }

  // ─── Relatório ──────────────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id/relatorio')
  async relatorio(
    @Param('id') id: string,
    @Query('competencia') competencia: string,
    @Query('format') format?: string,
    @Req() req?: any,
    @Res({ passthrough: true }) res?: any,
  ) {
    await this.conveniosService.findOne(id, req.user.cooperativaId);
    const relatorio = await this.conveniosService.relatorio(id, competencia);

    if (format === 'csv' && res) {
      const csv = this.conveniosService.relatorioCsv(relatorio);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio-convenio-${competencia}.csv`);
      return csv;
    }

    return relatorio;
  }

  // ─── D-FISCAL-2.2 — Movimentos contábeis do convênio consolidado ─────
  // Endpoints novos pra ContratoConvenio + flags fiscais (2.1).
  // Coexistem com /contabilidade-tributaria/convenios/:id/movimentos (CT.9)
  // até D-FISCAL-2.5 aposentar o caminho CT antigo.

  /**
   * D-FISCAL-2.2 — Registra movimento contábil do convênio consolidado.
   * Síncrono: cria LancamentoCaixa na hora; erros sobem pra UI (4 enforcements:
   * flag off / natureza null / fluxo null / P0-1 não-coop).
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.movimento.contabil',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @HttpCode(201)
  @Post(':id/movimentos-contabeis')
  async registrarMovimentoContabil(
    @Param('id') id: string,
    @Body() dto: RegistrarMovimentoConvenioContratoDto,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException('cooperativaId obrigatório no contexto do usuário');
    }
    // CT.9.1 fix TZ: parse LOCAL + competência da STRING
    const [ano, mes, dia] = dto.dataMovimento.split('-').map(Number);
    const dataMovimento = new Date(ano, mes - 1, dia);
    const competencia = dto.dataMovimento.substring(0, 7); // YYYY-MM
    return this.contabilidade.criarLancamentoConvenioContrato({
      contratoConvenioId: id,
      valor: dto.valor,
      dataMovimento,
      competencia,
      descricao: dto.descricao,
      cooperativaId,
    });
  }

  /**
   * D-FISCAL-2.2 — Histórico de movimentos contábeis do convênio consolidado.
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @TenantResource({ model: 'contratoConvenio' })
  @Get(':id/movimentos-contabeis')
  async listarMovimentosContabeis(@Param('id') id: string, @Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException('cooperativaId obrigatório no contexto do usuário');
    }
    return this.contabilidade.listarMovimentosContrato(id, cooperativaId);
  }

  /**
   * D-FISCAL-2.2 — Estorna movimento contábil do convênio consolidado.
   * Mesmo padrão CT.9.1 (gate apuração FECHADA + delete atômico + AuditLog).
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.movimento.contabil.estornar',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @Delete(':id/movimentos-contabeis/:lancamentoId')
  async estornarMovimentoContabil(
    @Param('id') id: string,
    @Param('lancamentoId') lancamentoId: string,
    @Body() body: { motivo?: string } | undefined,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException('cooperativaId obrigatório no contexto do usuário');
    }
    return this.contabilidade.estornarMovimentoConvenioContrato({
      contratoConvenioId: id,
      lancamentoId,
      cooperativaId,
      motivo: body?.motivo,
      usuarioId: req.user?.id ?? req.user?.userId,
    });
  }

  // ─── D-FISCAL-2.4.4b — Cobranças consolidadas custeio (Caso 1) ────────

  /**
   * Lista cobranças consolidadas de um convênio (alimenta a tela 2.4.4d).
   * Filtra Cobranca por `convenioContabilCobrancaId`. Multi-tenant via
   * @TenantResource + filtro explícito no service.
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @TenantResource({ model: 'contratoConvenio' })
  @Get(':id/cobrancas-consolidadas')
  async listarCobrancasConsolidadas(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException('cooperativaId obrigatório no contexto do usuário');
    }
    return this.custeioService.listarConsolidadasDoConvenio(id, cooperativaId);
  }

  /**
   * Gera consolidada manual sob demanda (botão "Gerar agora" na UI 2.4.4d).
   * Query `?mesReferencia=YYYY-MM`. Valida mes <= corrente. Idempotente —
   * se já existir, retorna {status: 'JA_EXISTE', cobrancaId}.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.consolidada.gerar_manual',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @HttpCode(201)
  @Post(':id/cobrancas-consolidadas/gerar')
  async gerarCobrancaConsolidadaManual(
    @Param('id') id: string,
    @Query('mesReferencia') mesReferencia: string,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException('cooperativaId obrigatório no contexto do usuário');
    }
    if (!mesReferencia || !/^\d{4}-\d{2}$/.test(mesReferencia)) {
      throw new BadRequestException(
        `Query param mesReferencia obrigatório no formato YYYY-MM (ex: 2026-05). Recebido: "${mesReferencia}".`,
      );
    }
    const [anoStr, mesStr] = mesReferencia.split('-');
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    if (mes < 1 || mes > 12) {
      throw new BadRequestException(`Mês inválido: ${mes}. Use 1-12.`);
    }
    // Valida mes <= corrente (não permite gerar pra mês futuro/em curso)
    const hoje = new Date();
    const corrente = hoje.getFullYear() * 100 + (hoje.getMonth() + 1);
    const alvo = ano * 100 + mes;
    if (alvo > corrente) {
      throw new BadRequestException(
        `mesReferencia ${mesReferencia} é futuro. Use o mês corrente ou anterior.`,
      );
    }
    return this.custeioService.gerarCobrancaConsolidada({
      convenioId: id,
      mesReferencia: mes,
      anoReferencia: ano,
      cooperativaId,
    });
  }

  /**
   * D-FISCAL-2.4.4d — Estorna cobrança consolidada (gate apuração FECHADA).
   * PAGA → reverte status pra A_VENCER + deleta LancamentoCaixa operacional+fiscal.
   * A_VENCER/PENDENTE → CANCELADO + cancela PREVISTO operacional.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.consolidada.estornar',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @Post(':id/cobrancas-consolidadas/:cobrancaId/estornar')
  async estornarCobrancaConsolidada(
    @Param('id') id: string,
    @Param('cobrancaId') cobrancaId: string,
    @Body() body: { motivo?: string } | undefined,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException('cooperativaId obrigatório no contexto do usuário');
    }
    return this.custeioService.estornarCobrancaConsolidada({
      convenioId: id,
      cobrancaId,
      cooperativaId,
      motivo: body?.motivo,
      usuarioId: req.user?.id ?? req.user?.userId,
    });
  }

  /**
   * Sprint Financeiro F1 (04/06/2026) — Reemite cobrança consolidada após
   * FALHA_EMISSAO (ou enquanto AGUARDANDO_EMISSAO travada). Reseta tentativas
   * → AGUARDANDO_EMISSAO → tenta no gateway imediatamente.
   *
   * UI: botão "Tentar de novo" nos badges AGUARDANDO_EMISSAO/FALHA_EMISSAO.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.consolidada.reemitir',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @HttpCode(200)
  @Post(':id/cobrancas-consolidadas/:cobrancaId/reemitir')
  async reemitirCobrancaConsolidada(
    @Param('id') id: string,
    @Param('cobrancaId') cobrancaId: string,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException('cooperativaId obrigatório no contexto do usuário');
    }
    return this.custeioService.reemitirCobrancaConsolidada({
      convenioId: id,
      cobrancaId,
      cooperativaId,
    });
  }

  // ─── Sprint Convite-Convênio Fatia 3 (03/06/2026) — Aprovação 3 portas ──

  /**
   * Lista membros PENDENTE_* do convênio (admin pode revisar quem aguarda).
   * Filtros: ?status=PENDENTE_APROVACAO_EMPRESA|PENDENTE_APROVACAO_ADMIN.
   * Sem filter → lista AMBOS.
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @TenantResource({ model: 'contratoConvenio' })
  @Get(':id/membros-pendentes')
  listarMembrosPendentes(
    @Param('id') convenioId: string,
    @Req() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) throw new ForbiddenException('cooperativaId obrigatório.');
    const statusFiltrado =
      status === 'PENDENTE_APROVACAO_EMPRESA' || status === 'PENDENTE_APROVACAO_ADMIN'
        ? (status as StatusMembroConvenio)
        : undefined;
    return this.aprovacaoService.listarPendentes(convenioId, cooperativaId, {
      status: statusFiltrado,
      page: page ? Math.max(1, parseInt(page, 10)) : 1,
      limit: limit ? Math.min(100, Math.max(1, parseInt(limit, 10))) : 50,
    });
  }

  /**
   * Admin aprova membro PENDENTE_APROVACAO_ADMIN → MEMBRO_ATIVO. Entra na
   * consolidada na próxima geração. GUARD: rejeita outros status.
   *
   * UI HELP (Fatia 4/5): "Ativa o membro custeado — a partir daqui ele entra
   * na cobrança consolidada da empresa."
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.membro.aprovar_admin',
    recurso: 'ConvenioCooperado',
    recursoIdParam: 'membroId',
  })
  @HttpCode(200)
  @Post(':id/membros/:membroId/aprovar-admin')
  aprovarMembroAdmin(
    @Param('id') _convenioId: string,
    @Param('membroId') membroId: string,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    const adminUserId = req.user?.id ?? req.user?.userId;
    if (!cooperativaId || !adminUserId) {
      throw new ForbiddenException('Contexto de usuário incompleto.');
    }
    return this.aprovacaoService.aprovarPorAdmin({
      membroId,
      cooperativaId,
      adminUserId,
    });
  }

  /**
   * Admin solicita documentação ao cooperado. Cria N DocumentoCooperado
   * (PENDENTE). Status do membro mantém PENDENTE_APROVACAO_ADMIN.
   *
   * UI HELP: "Pede documentos ao cooperado antes de aprovar (ex: RG +
   * contrato social)."
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.membro.solicitar_documentacao',
    recurso: 'ConvenioCooperado',
    recursoIdParam: 'membroId',
  })
  @HttpCode(200)
  @Post(':id/membros/:membroId/solicitar-documentacao')
  solicitarDocumentacaoMembro(
    @Param('id') _convenioId: string,
    @Param('membroId') membroId: string,
    @Body() dto: SolicitarDocumentacaoDto,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    const adminUserId = req.user?.id ?? req.user?.userId;
    if (!cooperativaId || !adminUserId) {
      throw new ForbiddenException('Contexto de usuário incompleto.');
    }
    return this.aprovacaoService.solicitarDocumentacao({
      membroId,
      cooperativaId,
      adminUserId,
      tipos: dto.tipos,
    });
  }

  /**
   * Admin rejeita membro PENDENTE_APROVACAO_ADMIN. Motivo obrigatório.
   *
   * UI HELP: "Recusa o cadastro (ex: dados não conferem). O cooperado é
   * avisado com o motivo."
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.membro.rejeitar_admin',
    recurso: 'ConvenioCooperado',
    recursoIdParam: 'membroId',
  })
  @HttpCode(200)
  @Post(':id/membros/:membroId/rejeitar-admin')
  rejeitarMembroAdmin(
    @Param('id') _convenioId: string,
    @Param('membroId') membroId: string,
    @Body() dto: RejeitarMembroAdminDto,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    const adminUserId = req.user?.id ?? req.user?.userId;
    if (!cooperativaId || !adminUserId) {
      throw new ForbiddenException('Contexto de usuário incompleto.');
    }
    return this.aprovacaoService.rejeitarPorAdmin({
      membroId,
      cooperativaId,
      adminUserId,
      motivo: dto.motivo,
    });
  }

  /**
   * Reenvia magic link da empresa (regenera token + estende TTL + WA).
   * Útil quando WA não chegou ou link expirou. GUARD:
   * PENDENTE_APROVACAO_EMPRESA only.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.membro.reenviar_aprovacao_empresa',
    recurso: 'ConvenioCooperado',
    recursoIdParam: 'membroId',
  })
  @HttpCode(200)
  @Post(':id/membros/:membroId/reenviar-aprovacao-empresa')
  reenviarAprovacaoEmpresa(
    @Param('id') _convenioId: string,
    @Param('membroId') membroId: string,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) throw new ForbiddenException('cooperativaId obrigatório.');
    return this.aprovacaoService.reenviarAprovacaoEmpresa({
      membroId,
      cooperativaId,
    });
  }

  // ─── Sprint Convite-Convênio Fatia 2a (03/06/2026) — Convites per-recipient ─

  /**
   * Cria convite per-recipient (token + WhatsApp). Empresa/admin informa
   * { nomeConvidado, telefone } e o sistema:
   *  1. Normaliza telefone pra E.164 BR (55DDXXXXXXXXX).
   *  2. Reuse-if-alive: se já existe convite vivo pra (convenioId, telefone),
   *     reusa em vez de criar duplicado.
   *  3. Gera token crypto.randomBytes(32).hex + TTL 7d.
   *  4. Envia WhatsApp pro telefone DO CONVITE com link `/convite/{token}`.
   *
   * Multi-tenant + @TenantResource. Audit via @AuditLog.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.convite.criar',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @HttpCode(201)
  @Post(':id/convites')
  async criarConviteMembro(
    @Param('id') convenioId: string,
    @Body() dto: CriarConviteMembroDto,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    const userId = req.user?.id ?? req.user?.userId;
    if (!cooperativaId) {
      throw new ForbiddenException('cooperativaId obrigatório no contexto do usuário.');
    }
    if (!userId) {
      throw new ForbiddenException('userId obrigatório no contexto do usuário.');
    }

    const convite = await this.convitesService.criarConvite({
      convenioId,
      nomeConvidado: dto.nomeConvidado,
      telefone: dto.telefone,
      criadoPorUserId: userId,
      cooperativaId,
    });

    // Best-effort: envia o link por WA. Falha NÃO reverte a criação do convite
    // (admin pode reenviar manualmente via POST :id/convites/:conviteId/reenviar).
    const envio = await this.convitesService.enviarLinkPorWhatsapp({
      telefone: convite.telefone,
      link: convite.link,
      nomeConvidado: convite.nomeConvidado,
      empresaNome: convite.empresaNome,
      cooperativaId,
    });

    // Sufixos pra UX admin (defesa LGPD — não expor token integral)
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
   * Sprint Convite-Lote LOTE.5 (07/06/2026) — convite individual com URL wa.me.
   *
   * Cria 1 convite + devolve URL `wa.me/<tel>?text=...` pra o admin abrir o
   * WhatsApp pessoal. NÃO dispara envio automático via API Meta.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.convite.modo-b.criar',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @HttpCode(201)
  @Post(':id/convites/modo-b')
  async criarConviteModoB(
    @Param('id') convenioId: string,
    @Body() dto: { nomeConvidado: string; telefone: string },
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    const userId = req.user?.id ?? req.user?.userId;
    if (!cooperativaId)
      throw new ForbiddenException('cooperativaId obrigatório no contexto.');
    if (!userId) throw new ForbiddenException('userId obrigatório no contexto.');
    return this.convitesService.criarConviteComUrlWa({
      convenioId,
      nomeConvidado: dto.nomeConvidado,
      telefone: dto.telefone,
      criadoPorUserId: userId,
      cooperativaId,
    });
  }

  /**
   * Sprint Convite-Lote LOTE.2 (07/06/2026) — envio em lote async.
   *
   * Cria N convites síncronos no DB (com loteId + statusEnvio=PENDENTE) e
   * dispara fila de envio WA assíncrona em background (throttle 2s entre cada
   * — anti-spam). Caller recebe { loteId, total } imediato. UI polla status.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.convite.lote.enviar',
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
    const cooperativaId = req.user?.cooperativaId;
    const userId = req.user?.id ?? req.user?.userId;
    if (!cooperativaId)
      throw new ForbiddenException('cooperativaId obrigatório no contexto.');
    if (!userId) throw new ForbiddenException('userId obrigatório no contexto.');
    return this.convitesService.enviarLote({
      convenioId,
      cooperativaId,
      criadoPorUserId: userId,
      destinatarios: body?.destinatarios ?? [],
    });
  }

  /**
   * Sprint Convite-Lote LOTE.3 (07/06/2026) — status agregado do lote.
   * Anti-IDOR via filtro cooperativaId + convenioId no service.
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @TenantResource({ model: 'contratoConvenio' })
  @Get(':id/convites/lote/:loteId/status')
  async statusConviteLote(
    @Param('id') convenioId: string,
    @Param('loteId') loteId: string,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId)
      throw new ForbiddenException('cooperativaId obrigatório no contexto.');
    return this.convitesService.statusLote({
      loteId,
      convenioId,
      cooperativaId,
    });
  }

  /**
   * Sprint Convite-Lote LOTE.1 (07/06/2026) — preview de convites em lote.
   *
   * Recebe CSV/TXT colado e classifica cada linha pra mostrar prévia antes
   * do envio em lote (que vem na LOTE.2). NÃO cria convite, NÃO envia WA.
   * Multi-tenant via @TenantResource — convenioId pertence ao tenant.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.convite.lote.preview',
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
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException(
        'cooperativaId obrigatório no contexto do usuário.',
      );
    }
    return this.convitesService.previewLote({
      convenioId,
      cooperativaId,
      csv: body?.csv ?? '',
    });
  }

  /**
   * Lista convites do convênio (admin). Tokens são retornados apenas como
   * sufixo (defesa LGPD — token integral só vai no WA do destinatário).
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @TenantResource({ model: 'contratoConvenio' })
  @Get(':id/convites')
  async listarConvitesMembro(@Param('id') convenioId: string, @Req() req: any) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException('cooperativaId obrigatório no contexto do usuário.');
    }
    return this.convitesService.listarPorConvenio(convenioId, cooperativaId);
  }

  /**
   * Cancela convite (DELETE real). Só permitido se ainda não usado.
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.convite.cancelar',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @Delete(':id/convites/:conviteId')
  async cancelarConviteMembro(
    @Param('id') _convenioId: string,
    @Param('conviteId') conviteId: string,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException('cooperativaId obrigatório no contexto do usuário.');
    }
    return this.convitesService.cancelar(conviteId, cooperativaId);
  }

  /**
   * Reenvia convite (regenera token + estende TTL + envia novo link por WA).
   * NÃO mexe no OTP (responsabilidade da Fatia 2b /solicitar-otp).
   */
  @Roles(SUPER_ADMIN, ADMIN)
  @TenantResource({ model: 'contratoConvenio' })
  @AuditLog({
    acao: 'convenio.convite.reenviar',
    recurso: 'ContratoConvenio',
    recursoIdParam: 'id',
  })
  @HttpCode(200)
  @Post(':id/convites/:conviteId/reenviar')
  async reenviarConviteMembro(
    @Param('id') _convenioId: string,
    @Param('conviteId') conviteId: string,
    @Req() req: any,
  ) {
    const cooperativaId = req.user?.cooperativaId;
    if (!cooperativaId) {
      throw new ForbiddenException('cooperativaId obrigatório no contexto do usuário.');
    }
    const atualizado = await this.convitesService.reenviarConvite(conviteId, cooperativaId);
    // Carrega nome convidado + empresa pra reusar template WA
    const convite = await this.convitesService['prisma'].conviteConvenioMembro.findUnique({
      where: { id: atualizado.id },
      include: { convenio: { select: { empresaNome: true } } },
    });
    // Bug A (10/06/2026) — captura retorno do helper pra propagar FALHOU + motivo
    // na UI (antes ignorava silenciosamente em DEV/whitelist).
    let whatsappEnviado: boolean | undefined;
    let whatsappErro: string | undefined;
    if (convite) {
      const envio = await this.convitesService.enviarLinkPorWhatsapp({
        telefone: convite.telefone,
        link: atualizado.link,
        nomeConvidado: convite.nomeConvidado,
        empresaNome: convite.convenio.empresaNome,
        cooperativaId,
      });
      whatsappEnviado = envio.enviado;
      whatsappErro = envio.erro;
    }
    return {
      id: atualizado.id,
      tokenSufixo: '...' + atualizado.token.slice(-6),
      expiresAt: atualizado.expiresAt,
      whatsappEnviado,
      whatsappErro,
    };
  }

}
