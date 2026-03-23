import { Controller, Post, Get, Patch, Delete, Body, Param, Req, BadRequestException, NotFoundException } from '@nestjs/common';
import { FaturasService } from './faturas.service';
import { PrismaService } from '../prisma.service';
import { ProcessarFaturaDto } from './dto/processar-fatura.dto';
import { UploadDocumentoDto } from './dto/upload-documento.dto';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

@Controller('faturas')
@Roles(PerfilUsuario.SUPER_ADMIN, PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
export class FaturasController {
  constructor(
    private readonly faturasService: FaturasService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('cooperado/:cooperadoId')
  findByCooperado(@Param('cooperadoId') cooperadoId: string): Promise<unknown> {
    return this.faturasService.findByCooperado(cooperadoId);
  }

  @Post('extrair')
  extrair(@Body() body: { arquivoBase64: string; tipoArquivo: 'pdf' | 'imagem' }): Promise<unknown> {
    return this.faturasService.extrairOcr(body.arquivoBase64, body.tipoArquivo);
  }

  @Post('processar')
  processar(@Body() dto: ProcessarFaturaDto): Promise<unknown> {
    return this.faturasService.processarFatura(dto);
  }

  @Post('documento')
  documento(@Body() dto: UploadDocumentoDto): Promise<unknown> {
    return this.faturasService.uploadDocumento(dto);
  }

  @Patch(':id/aprovar')
  aprovar(@Param('id') id: string): Promise<unknown> {
    return this.faturasService.aprovarFatura(id);
  }

  @Delete(':id')
  deletar(@Param('id') id: string): Promise<unknown> {
    return this.faturasService.deletarFatura(id);
  }

  @Get('diagnostico')
  diagnostico(): Promise<unknown> {
    return this.faturasService.diagnostico();
  }

  @Patch('documentos/:id/status')
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
