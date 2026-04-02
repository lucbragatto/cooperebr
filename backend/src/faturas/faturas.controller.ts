import { Controller, Post, Get, Patch, Delete, Body, Param, Query, Req, BadRequestException, NotFoundException } from '@nestjs/common';
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
    @Query('cooperativaId') cooperativaId?: string,
    @Query('status') status?: string,
    @Query('mesReferencia') mesReferencia?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.faturasService.centralFaturas({
      cooperativaId,
      status,
      mesReferencia,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('central/resumo')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  centralResumo(@Query('cooperativaId') cooperativaId?: string) {
    return this.faturasService.centralResumo(cooperativaId);
  }

  @Get('cooperado/:cooperadoId')
  findByCooperado(@Param('cooperadoId') cooperadoId: string): Promise<unknown> {
    return this.faturasService.findByCooperado(cooperadoId);
  }

  @Post('extrair')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  extrair(@Body() body: { arquivoBase64: string; tipoArquivo: 'pdf' | 'imagem' }): Promise<unknown> {
    return this.faturasService.extrairOcr(body.arquivoBase64, body.tipoArquivo);
  }

  @Post('processar')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  processar(@Body() dto: ProcessarFaturaDto): Promise<unknown> {
    return this.faturasService.processarFatura(dto);
  }

  @Post('upload-concessionaria')
  uploadConcessionaria(@Body() dto: UploadConcessionariaDto): Promise<unknown> {
    return this.faturasService.uploadConcessionaria(dto);
  }

  @Post('documento')
  documento(@Body() dto: UploadDocumentoDto): Promise<unknown> {
    return this.faturasService.uploadDocumento(dto);
  }

  @Patch(':id/aprovar')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  aprovar(@Param('id') id: string): Promise<unknown> {
    return this.faturasService.aprovarFatura(id);
  }

  @Patch(':id/rejeitar')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  rejeitar(@Param('id') id: string, @Body() body?: { motivo?: string }): Promise<unknown> {
    return this.faturasService.rejeitarFatura(id, body?.motivo);
  }

  @Get(':id/relatorio')
  relatorio(@Param('id') id: string) {
    return this.relatorioService.gerarRelatorioByFaturaId(id);
  }

  @Get(':id/relatorio/html')
  async relatorioHtml(@Param('id') id: string) {
    const dados = await this.relatorioService.gerarRelatorioByFaturaId(id);
    const html = this.relatorioService.renderHtml(dados);
    return { html };
  }

  @Delete(':id')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  deletar(@Param('id') id: string): Promise<unknown> {
    return this.faturasService.deletarFatura(id);
  }

  @Get('diagnostico')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN)
  diagnostico(): Promise<unknown> {
    return this.faturasService.diagnostico();
  }

  @Patch('documentos/:id/status')
  @Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
  async atualizarStatusDocumento(
    @Param('id') id: string,
    @Body() body: { status: 'APROVADO' | 'REPROVADO'; motivoRejeicao?: string },
  ) {
    if (!['APROVADO', 'REPROVADO'].includes(body.status)) {
      throw new BadRequestException('Status deve ser APROVADO ou REPROVADO');
    }
    if (body.status === 'REPROVADO' && !body.motivoRejeicao?.trim()) {
      throw new BadRequestException('Motivo de rejeição é obrigatório para reprovação');
    }
    const doc = await this.prisma.documentoCooperado.findUnique({ where: { id } });
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
