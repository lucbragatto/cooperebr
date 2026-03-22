import { Controller, Post, Body } from '@nestjs/common';
import { WhatsappFaturaService } from './whatsapp-fatura.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';

const { ADMIN, OPERADOR } = PerfilUsuario;

@Controller('whatsapp')
@Roles(ADMIN, OPERADOR)
export class WhatsappFaturaController {
  constructor(private readonly service: WhatsappFaturaService) {}

  @Post('processar-fatura')
  processarFatura(
    @Body() body: { arquivoBase64: string; tipoArquivo: 'pdf' | 'imagem'; telefone: string },
  ) {
    return this.service.processarFatura(body);
  }
}
