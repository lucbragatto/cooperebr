import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, Res, ForbiddenException, HttpCode,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { TenantResource } from '../auth/tenant-resource.decorator';
import { AuditLog } from '../audit/audit-log.decorator';
import { ConveniosService } from './convenios.service';
import { ConveniosMembrosService } from './convenios-membros.service';
import { ConveniosProgressaoService } from './convenios-progressao.service';
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
    return this.conveniosService.update(id, dto);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.conveniosService.findOne(id, req.user.cooperativaId);
    return this.conveniosService.remove(id);
  }

  // ─── Membros ────────────────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id/membros')
  async listarMembros(@Param('id') id: string, @Req() req: any) {
    await this.conveniosService.findOne(id, req.user.cooperativaId);
    return this.membrosService.listarMembros(id);
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

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Delete(':id/membros/:cooperadoId')
  async removerMembro(@Param('id') id: string, @Param('cooperadoId') cooperadoId: string, @Req() req: any) {
    await this.conveniosService.findOne(id, req.user.cooperativaId);
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

}
