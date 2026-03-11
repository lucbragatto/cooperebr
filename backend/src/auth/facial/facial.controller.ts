import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { FacialService } from './facial.service';
import { CadastrarFacialDto } from './dto/cadastrar-facial.dto';
import { VerificarFacialDto } from './dto/verificar-facial.dto';
import { JwtAuthGuard } from '../jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('auth/facial')
export class FacialController {
  constructor(private readonly facialService: FacialService) {}

  @Post('cadastrar')
  cadastrar(@Body() body: CadastrarFacialDto): Promise<{ sucesso: boolean; url: string }> {
    return this.facialService.cadastrar(body);
  }

  @Post('verificar')
  verificar(@Body() body: VerificarFacialDto): Promise<{ autorizado: boolean; similaridade: number }> {
    return this.facialService.verificar(body);
  }
}
