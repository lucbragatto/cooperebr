import { Controller, Post, Get, Body } from '@nestjs/common';
import { FaturasService } from './faturas.service';
import { ProcessarFaturaDto } from './dto/processar-fatura.dto';
import { UploadDocumentoDto } from './dto/upload-documento.dto';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

@Controller('faturas')
@Roles(PerfilUsuario.ADMIN, PerfilUsuario.OPERADOR)
export class FaturasController {
  constructor(private readonly faturasService: FaturasService) {}

  @Post('processar')
  processar(@Body() dto: ProcessarFaturaDto): Promise<unknown> {
    return this.faturasService.processarFatura(dto);
  }

  @Post('documento')
  documento(@Body() dto: UploadDocumentoDto): Promise<unknown> {
    return this.faturasService.uploadDocumento(dto);
  }

  @Get('diagnostico')
  diagnostico(): Promise<unknown> {
    return this.faturasService.diagnostico();
  }
}
