import { Controller, Post, Get, Patch, Delete, Body, Param } from '@nestjs/common';
import { FaturasService } from './faturas.service';
import { ProcessarFaturaDto } from './dto/processar-fatura.dto';
import { UploadDocumentoDto } from './dto/upload-documento.dto';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

@Controller('faturas')
@Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
export class FaturasController {
  constructor(private readonly faturasService: FaturasService) {}

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
}
