import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Res, Req,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { PlanoContasService } from './plano-contas.service';
import { LancamentosService } from './lancamentos.service';
import { ContratosUsoService } from './contratos-uso.service';
import { ConveniosService } from './convenios.service';
import { FormaPagamentoService } from './forma-pagamento.service';
import { PixExcedenteService } from './pix-excedente.service';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('financeiro')
export class FinanceiroController {
  constructor(
    private readonly planoContasService: PlanoContasService,
    private readonly lancamentosService: LancamentosService,
    private readonly contratosUsoService: ContratosUsoService,
    private readonly conveniosService: ConveniosService,
    private readonly formaPagamentoService: FormaPagamentoService,
    private readonly pixExcedenteService: PixExcedenteService,
  ) {}

  // ─── Plano de Contas ───────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('plano-contas')
  findAllPlanoContas(@Req() req: any) {
    return this.planoContasService.findAll(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('plano-contas')
  createPlanoContas(@Body() body: any) {
    return this.planoContasService.create(body);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('plano-contas/:id')
  findOnePlanoContas(@Param('id') id: string, @Req() req: any) {
    // D-48-financeiro IDOR fix.
    return this.planoContasService.findOne(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch('plano-contas/:id')
  updatePlanoContas(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.planoContasService.update(id, body, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete('plano-contas/:id')
  removePlanoContas(@Param('id') id: string, @Req() req: any) {
    return this.planoContasService.remove(id, req.user?.cooperativaId);
  }

  // ─── Lançamentos ───────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('lancamentos')
  findAllLancamentos(
    @Req() req: any,
    @Query('competencia') competencia?: string,
    @Query('cooperadoId') cooperadoId?: string,
    @Query('tipo') tipo?: string,
    @Query('status') status?: string,
  ) {
    return this.lancamentosService.findAll({ competencia, cooperadoId, tipo, status, cooperativaId: req.user?.cooperativaId });
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post('lancamentos')
  createLancamento(@Body() body: any, @Req() req: any) {
    // D-48-financeiro IDOR fix.
    return this.lancamentosService.create(body, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('livro-caixa')
  livroCaixa(@Req() req: any, @Query('competencia') competencia: string) {
    return this.lancamentosService.livroCaixa(competencia, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('lancamentos/resumo')
  resumoLancamentos(@Req() req: any, @Query('competencia') competencia: string) {
    return this.lancamentosService.resumo(competencia, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('lancamentos/dre')
  dreLancamentos(@Req() req: any, @Query('competencia') competencia: string) {
    return this.lancamentosService.dre(competencia, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Patch('lancamentos/:id/realizar')
  realizarLancamento(@Param('id') id: string, @Body() body: { dataPagamento?: string } | undefined, @Req() req: any) {
    return this.lancamentosService.realizar(id, body?.dataPagamento, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Patch('lancamentos/:id/cancelar')
  cancelarLancamento(@Param('id') id: string, @Req() req: any) {
    return this.lancamentosService.cancelar(id, req.user?.cooperativaId);
  }

  // ─── Contratos de Uso ──────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('contratos-uso')
  findAllContratosUso(@Req() req: any) {
    return this.contratosUsoService.findAll(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post('contratos-uso')
  createContratoUso(@Body() body: any, @Req() req: any) {
    // D-48-financeiro IDOR fix: força tenant do caller.
    return this.contratosUsoService.create({ ...body, cooperativaId: req.user?.cooperativaId ?? body.cooperativaId });
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('contratos-uso/:id')
  findOneContratoUso(@Param('id') id: string, @Req() req: any) {
    return this.contratosUsoService.findOne(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Patch('contratos-uso/:id')
  updateContratoUso(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.contratosUsoService.update(id, body, req.user?.cooperativaId);
  }

  // ─── Convênios ─────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('convenios')
  findAllConvenios(@Req() req: any) {
    return this.conveniosService.findAll(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('convenios')
  createConvenio(@Body() body: any, @Req() req: any) {
    return this.conveniosService.create(body, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('convenios/:id')
  findOneConvenio(@Param('id') id: string, @Req() req: any) {
    return this.conveniosService.findOne(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Patch('convenios/:id')
  updateConvenio(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.conveniosService.update(id, body, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post('convenios/:id/cooperados')
  vincularCooperado(@Param('id') id: string, @Body() body: { cooperadoId: string; matricula?: string }, @Req() req: any) {
    return this.conveniosService.vincularCooperado(id, body, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Delete('convenios/:id/cooperados/:cooperadoId')
  desvincularCooperado(@Param('id') id: string, @Param('cooperadoId') cooperadoId: string, @Req() req: any) {
    return this.conveniosService.desvincularCooperado(id, cooperadoId, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('convenios/:id/relatorio')
  async relatorioConvenio(
    @Param('id') id: string,
    @Query('competencia') competencia: string,
    @Req() req: any,
    @Query('format') format?: string,
    @Res({ passthrough: true }) res?: any,
  ) {
    const relatorio = await this.conveniosService.relatorio(id, competencia, req.user?.cooperativaId);

    if (format === 'csv' && res) {
      const csv = this.conveniosService.relatorioCsv(relatorio);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=relatorio-${competencia}.csv`);
      return csv;
    }

    return relatorio;
  }

  // ─── Forma de Pagamento ────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get('forma-pagamento/:cooperadoId')
  findFormaPagamento(@Param('cooperadoId') cooperadoId: string, @Req() req: any) {
    // D-48-financeiro IDOR fix.
    return this.formaPagamentoService.findByCooperado(cooperadoId, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post('forma-pagamento/:cooperadoId')
  createFormaPagamento(@Param('cooperadoId') cooperadoId: string, @Body() body: any, @Req() req: any) {
    return this.formaPagamentoService.createOrUpdate(cooperadoId, body, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Patch('forma-pagamento/:cooperadoId')
  updateFormaPagamento(@Param('cooperadoId') cooperadoId: string, @Body() body: any, @Req() req: any) {
    return this.formaPagamentoService.createOrUpdate(cooperadoId, body, req.user?.cooperativaId);
  }

  // ─── PIX Excedente ─────────────────────────────────────────

  /**
   * POST /financeiro/pix-excedente
   * Calcula o excedente de geração solar, deduz impostos configuráveis e registra
   * a transferência PIX (simulada). Estrutura preparada para integração bancária real.
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post('pix-excedente')
  processarPixExcedente(@Body() body: any, @Req() req: any) {
    return this.pixExcedenteService.processarPixExcedente({
      ...body,
      cooperativaId: body.cooperativaId ?? req.user?.cooperativaId,
    });
  }

  /**
   * GET /financeiro/pix-excedente
   * Lista histórico de transferências PIX de excedente
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('pix-excedente')
  listarPixExcedente(
    @Req() req: any,
    @Query('cooperadoId') cooperadoId?: string,
    @Query('condominioId') condominioId?: string,
    @Query('mesReferencia') mesReferencia?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pixExcedenteService.listarTransferencias({
      cooperativaId: req.user?.cooperativaId,
      cooperadoId,
      condominioId,
      mesReferencia,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  /**
   * GET /financeiro/pix-excedente/resumo
   * Resumo agregado de excedentes por status
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('pix-excedente/resumo')
  resumoPixExcedente(@Req() req: any) {
    return this.pixExcedenteService.resumoExcedentes(req.user?.cooperativaId);
  }

  /**
   * GET /financeiro/pix-excedente/:id
   * Detalhes de uma transferência
   */
  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('pix-excedente/:id')
  getPixExcedente(@Param('id') id: string, @Req() req: any) {
    return this.pixExcedenteService.getTransferencia(id, req.user?.cooperativaId);
  }
}
