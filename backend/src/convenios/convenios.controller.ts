import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, Req, Res,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { ConveniosService } from './convenios.service';
import { ConveniosMembrosService } from './convenios-membros.service';
import { ConveniosProgressaoService } from './convenios-progressao.service';
import { CreateConvenioDto, UpdateConvenioDto, AddMembroDto, UpdateMembroDto } from './convenios.dto';
import { ConfigBeneficio } from './convenios-progressao.service';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('convenios')
export class ConveniosController {
  constructor(
    private readonly conveniosService: ConveniosService,
    private readonly membrosService: ConveniosMembrosService,
    private readonly progressaoService: ConveniosProgressaoService,
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
    @Query('busca') busca?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.conveniosService.findAll(req.user.cooperativaId, {
      tipo,
      status,
      busca,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.conveniosService.findOne(id, req.user.cooperativaId);
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
}
