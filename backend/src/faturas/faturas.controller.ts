import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Req, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FaturasService } from './faturas.service';
import { RelatorioFaturaService } from './relatorio-fatura.service';
import { PrismaService } from '../prisma.service';
import { ProcessarFaturaDto } from './dto/processar-fatura.dto';
import { UploadDocumentoDto } from './dto/upload-documento.dto';
import { UploadConcessionariaDto } from './dto/upload-concessionaria.dto';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

@Controller('faturas')
@Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR, PerfilUsuario.COOPERADO)
export class FaturasController {
  constructor(
    private readonly faturasService: FaturasService,
    private readonly relatorioService: RelatorioFaturaService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Central de Faturas (antes das rotas com :id) ────────────────────────────

  @Get('central')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  central(
    @Req() req: any,
    @Query('cooperativaId') cooperativaId?: string,
    @Query('status') status?: string,
    @Query('mesReferencia') mesReferencia?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // FATURA-03: SUPER_ADMIN pode filtrar por qualquer cooperativaId; demais usam JWT
    const resolvedCoopId = req.user?.perfil === PerfilUsuario.SUPER_ADMIN
      ? (cooperativaId ?? req.user?.cooperativaId)
      : req.user?.cooperativaId;
    return this.faturasService.centralFaturas({
      cooperativaId: resolvedCoopId,
      status,
      mesReferencia,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('central/resumo')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  centralResumo(@Req() req: any, @Query('cooperativaId') cooperativaId?: string) {
    // FATURA-03: SUPER_ADMIN pode filtrar por qualquer cooperativaId; demais usam JWT
    const resolvedCoopId = req.user?.perfil === PerfilUsuario.SUPER_ADMIN
      ? (cooperativaId ?? req.user?.cooperativaId)
      : req.user?.cooperativaId;
    return this.faturasService.centralResumo(resolvedCoopId);
  }

  @Get('minhas-concessionaria')
  @Roles(PerfilUsuario.COOPERADO)
  minhasFaturasConcessionaria(@Req() req: any) {
    if (!req.user?.cooperadoId) throw new ForbiddenException('Cooperado não identificado');
    return this.faturasService.minhasFaturasConcessionaria(req.user.cooperadoId);
  }

  @Get('cooperado/:cooperadoId')
  findByCooperado(@Param('cooperadoId') cooperadoId: string, @Req() req: any): Promise<unknown> {
    return this.faturasService.findByCooperado(cooperadoId, req.user.cooperativaId);
  }

  @Post('extrair')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  extrair(@Body() body: { arquivoBase64: string; tipoArquivo: 'pdf' | 'imagem' }): Promise<unknown> {
    return this.faturasService.extrairOcr(body.arquivoBase64, body.tipoArquivo);
  }

  @Post('processar')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  processar(@Body() dto: ProcessarFaturaDto, @Req() req: any): Promise<unknown> {
    // D-48-faturas IDOR fix: valida que cooperado do dto pertence ao tenant.
    return this.faturasService.processarFatura(dto, req.user?.cooperativaId);
  }

  @Post('upload-concessionaria')
  uploadConcessionaria(@Body() dto: UploadConcessionariaDto, @Req() req: any): Promise<unknown> {
    // FATURA-01: COOPERADO só pode enviar fatura para si mesmo
    if (req.user?.perfil === PerfilUsuario.COOPERADO) {
      if (!req.user.cooperadoId || dto.cooperadoId !== req.user.cooperadoId) {
        throw new ForbiddenException('Cooperado só pode enviar fatura para si mesmo');
      }
    }
    return this.faturasService.uploadConcessionaria(dto);
  }

  @Post('documento')
  documento(@Body() dto: UploadDocumentoDto): Promise<unknown> {
    return this.faturasService.uploadDocumento(dto);
  }

  @Patch(':id/vincular')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  vincularManual(
    @Param('id') id: string,
    @Body() body: { cooperadoId: string },
    @Req() req: any,
  ) {
    if (!body.cooperadoId) throw new BadRequestException('cooperadoId é obrigatório');
    const cooperativaId = req.user?.perfil === PerfilUsuario.SUPER_ADMIN
      ? req.user?.cooperativaId
      : req.user?.cooperativaId;
    return this.faturasService.vincularFaturaManual(id, body.cooperadoId, cooperativaId);
  }

  @Patch(':id/aprovar')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  aprovar(@Param('id') id: string, @Req() req: any): Promise<unknown> {
    // D-48-faturas IDOR fix.
    return this.faturasService.aprovarFatura(id, req.user?.cooperativaId);
  }

  @Patch(':id/rejeitar')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  rejeitar(@Param('id') id: string, @Body() body: { motivo?: string } = {}, @Req() req: any): Promise<unknown> {
    return this.faturasService.rejeitarFatura(id, body?.motivo, req.user?.cooperativaId);
  }

  @Get(':id/relatorio')
  relatorio(@Param('id') id: string, @Req() req: any) {
    return this.relatorioService.gerarRelatorioByFaturaId(id, req.user?.cooperativaId);
  }

  @Get(':id/relatorio/html')
  async relatorioHtml(@Param('id') id: string, @Req() req: any) {
    const dados = await this.relatorioService.gerarRelatorioByFaturaId(id, req.user?.cooperativaId);
    const html = this.relatorioService.renderHtml(dados);
    return { html };
  }

  @Delete(':id')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  deletar(@Param('id') id: string, @Req() req: any): Promise<unknown> {
    return this.faturasService.deletarFatura(id, req.user?.cooperativaId);
  }

  @Get('diagnostico')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN)
  diagnostico(@Req() req: any): Promise<unknown> {
    return this.faturasService.diagnostico(req.user.cooperativaId);
  }

  @Patch('documentos/:id/status')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  async atualizarStatusDocumento(
    @Param('id') id: string,
    @Body() body: { status: 'APROVADO' | 'REPROVADO'; motivoRejeicao?: string },
    @Req() req: any,
  ) {
    if (!['APROVADO', 'REPROVADO'].includes(body.status)) {
      throw new BadRequestException('Status deve ser APROVADO ou REPROVADO');
    }
    if (body.status === 'REPROVADO' && !body.motivoRejeicao?.trim()) {
      throw new BadRequestException('Motivo de rejeição é obrigatório para reprovação');
    }
    // D-48-faturas IDOR fix: documento pertence a cooperado que pertence a tenant.
    const doc = await this.prisma.documentoCooperado.findFirst({
      where: {
        id,
        ...(req.user?.cooperativaId ? { cooperado: { cooperativaId: req.user.cooperativaId } } : {}),
      },
    });
    if (!doc) throw new NotFoundException('Documento não encontrado');

    return this.prisma.documentoCooperado.update({
      where: { id },
      data: {
        status: body.status,
        motivoRejeicao: body.status === 'REPROVADO' ? body.motivoRejeicao!.trim() : null,
      },
    });
  }
}
