/// <reference types="multer" />
import { Controller, Get, Post, Put, Delete, Param, Body, Req, Query, UploadedFile, UseInterceptors, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CooperadosService } from './cooperados.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CreateCooperadoDto } from './dto/create-cooperado.dto';
import { UpdateCooperadoDto } from './dto/update-cooperado.dto';
import { FaturaMensalDto } from './dto/fatura-mensal.dto';
import { PrismaService } from '../prisma.service';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO } = PerfilUsuario;

@Controller('cooperados')
export class CooperadosController {
  constructor(
    private readonly cooperadosService: CooperadosService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Verifica se um usuário com perfil COOPERADO tem permissão para acessar o cooperado :id.
   * Admins/operadores passam direto; cooperados só podem acessar seus próprios dados.
   */
  private async assertCooperadoOwnership(user: any, cooperadoId: string): Promise<void> {
    if (!user || user.perfil !== COOPERADO) return;
    const cooperado = await this.prisma.cooperado.findFirst({
      where: {
        id: cooperadoId,
        OR: [
          ...(user.email ? [{ email: user.email }] : []),
          ...(user.cpf ? [{ cpf: user.cpf }] : []),
        ],
      },
      select: { id: true },
    });
    if (!cooperado) {
      throw new ForbiddenException('Você não tem permissão para acessar dados de outro cooperado');
    }
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get()
  findAll(@Req() req: any, @Query('limit') limit?: number, @Query('offset') offset?: number, @Query('search') search?: string) {
    return this.cooperadosService.findAll(req.user?.cooperativaId, limit, offset, search);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('fila-espera')
  filaEspera(@Req() req: any) {
    return this.cooperadosService.filaEspera(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get('fila-espera/count')
  async filaEsperaCount(@Req() req: any) {
    const lista = await this.cooperadosService.filaEspera(req.user?.cooperativaId);
    return { count: lista.length };
  }

  @Roles(COOPERADO)
  @Get('meu-perfil')
  meuPerfil(@Req() req: any) {
    return this.cooperadosService.meuPerfil(req.user);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id/checklist')
  async getChecklist(@Param('id') id: string, @Req() req: any) {
    await this.assertCooperadoOwnership(req.user, id);
    return this.cooperadosService.getChecklist(id);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    await this.assertCooperadoOwnership(req.user, id);
    return this.cooperadosService.findOne(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post()
  create(@Body() body: CreateCooperadoDto, @Req() req: any) {
    const { termoAdesaoAceitoEm, cooperativaId, ...rest } = body;
    return this.cooperadosService.create({
      ...rest,
      cooperativaId: cooperativaId || req.user?.cooperativaId || undefined,
      termoAdesaoAceitoEm: termoAdesaoAceitoEm ? new Date(termoAdesaoAceitoEm) : undefined,
    });
  }

  @Roles(COOPERADO)
  @Get('meu-perfil/ucs')
  minhasUcs(@Req() req: any) {
    return this.cooperadosService.minhasUcs(req.user);
  }

  @Roles(COOPERADO)
  @Get('meu-perfil/cobrancas')
  minhasCobrancas(@Req() req: any) {
    return this.cooperadosService.minhasCobrancas(req.user);
  }

  @Roles(COOPERADO)
  @Get('meu-perfil/documentos')
  meusDocumentos(@Req() req: any) {
    return this.cooperadosService.meusDocumentos(req.user);
  }

  @Roles(COOPERADO)
  @Post('meu-perfil/documentos')
  @UseInterceptors(FileInterceptor('file'))
  uploadMeuDocumento(
    @Req() req: any,
    @Body('tipo') tipo: string,
    @UploadedFile() arquivo: Express.Multer.File,
  ) {
    return this.cooperadosService.uploadMeuDocumento(req.user, tipo, arquivo);
  }

  @Roles(COOPERADO)
  @Get('meu-perfil/contratos')
  meusContratos(@Req() req: any) {
    return this.cooperadosService.meusContratos(req.user);
  }

  @Roles(COOPERADO)
  @Post('meu-perfil/solicitar-desligamento')
  solicitarDesligamento(@Req() req: any, @Body() body: { motivo: string; observacao?: string }) {
    return this.cooperadosService.solicitarDesligamento(req.user, body);
  }

  @Roles(COOPERADO)
  @Put('meu-perfil')
  atualizarMeuPerfil(@Req() req: any, @Body() dto: UpdateCooperadoDto) {
    return this.cooperadosService.atualizarMeuPerfil(req.user, dto);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCooperadoDto) {
    const { termoAdesaoAceitoEm, dataInicioCreditos, ...rest } = dto;
    return this.cooperadosService.update(id, {
      ...rest,
      ...(termoAdesaoAceitoEm && { termoAdesaoAceitoEm: new Date(termoAdesaoAceitoEm) }),
      ...(dataInicioCreditos && { dataInicioCreditos: new Date(dataInicioCreditos) }),
    } as any);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post(':id/fatura-mensal')
  registrarFaturaMensal(@Param('id') id: string, @Body() dto: FaturaMensalDto) {
    return this.cooperadosService.registrarFaturaMensal(id, dto);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post(':id/alocar-usina')
  alocarUsina(@Param('id') id: string, @Body() body: { usinaId: string }) {
    return this.cooperadosService.alocarUsina(id, body.usinaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cooperadosService.remove(id);
  }

  // ─── Ações em Lote ──────────────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('batch/whatsapp')
  enviarWhatsappLote(@Body() body: { cooperadoIds: string[]; mensagem: string }, @Req() req: any) {
    return this.cooperadosService.enviarWhatsappLote(body.cooperadoIds, body.mensagem, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('batch/reajuste')
  aplicarReajusteLote(@Body() body: { cooperadoIds: string[]; percentual: number; motivo: string }, @Req() req: any) {
    return this.cooperadosService.aplicarReajusteLote(body.cooperadoIds, body.percentual, body.motivo, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('batch/beneficio')
  aplicarBeneficioManualLote(@Body() body: { cooperadoIds: string[]; valor: number; tipo: string; mesReferencia: string }, @Req() req: any) {
    return this.cooperadosService.aplicarBeneficioManualLote(body, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('batch/status')
  alterarStatusLote(@Body() body: { cooperadoIds: string[]; status: string }, @Req() req: any) {
    return this.cooperadosService.alterarStatusLote(body, req.user?.cooperativaId);
  }

  // ─── Aliases /lote/* (compatibilidade com spec Fase 2) ───────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('lote/whatsapp')
  enviarWhatsappLoteAlias(@Body() body: { cooperadoIds: string[]; mensagem: string }, @Req() req: any) {
    return this.cooperadosService.enviarWhatsappLote(body.cooperadoIds, body.mensagem, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('lote/reajuste')
  aplicarReajusteLoteAlias(@Body() body: { cooperadoIds: string[]; percentual: number; motivo: string }, @Req() req: any) {
    return this.cooperadosService.aplicarReajusteLote(body.cooperadoIds, body.percentual, body.motivo, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('lote/beneficio')
  aplicarBeneficioLoteAlias(@Body() body: { cooperadoIds: string[]; valor: number; tipo: string; mesReferencia: string }, @Req() req: any) {
    return this.cooperadosService.aplicarBeneficioManualLote(body, req.user?.cooperativaId);
  }
}
