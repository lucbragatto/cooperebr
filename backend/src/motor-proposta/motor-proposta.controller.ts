import { Controller, Get, Post, Put, Delete, Body, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MotorPropostaService } from './motor-proposta.service';
import { PropostaPdfService } from './proposta-pdf.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { Roles } from '../auth/roles.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CalcularPropostaDto } from './dto/calcular-proposta.dto';
import { ConfiguracaoMotorDto } from './dto/configuracao-motor.dto';
import { TarifaConcessionariaDto } from './dto/tarifa-concessionaria.dto';
import { SimularReajusteDto } from './dto/simular-reajuste.dto';

const { ADMIN, OPERADOR } = PerfilUsuario;

@Controller('motor-proposta')
@Roles(ADMIN, OPERADOR)
export class MotorPropostaController {
  constructor(
    private readonly service: MotorPropostaService,
    private readonly propostaPdf: PropostaPdfService,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {}

  @Get()
  dashboard() {
    return this.service.dashboardStats();
  }

  @Post('calcular')
  calcular(@Body() dto: CalcularPropostaDto) {
    return this.service.calcular(dto);
  }

  @Post('confirmar-opcao')
  confirmarOpcao(@Body() dto: CalcularPropostaDto) {
    return this.service.confirmarOpcao(dto);
  }

  @Post('aceitar')
  aceitar(@Body() body: any) {
    return this.service.aceitar(body);
  }

  @Roles(ADMIN)
  @Get('configuracao')
  getConfiguracao() {
    return this.service.getConfiguracao();
  }

  @Roles(ADMIN)
  @Put('configuracao')
  updateConfiguracao(@Body() dto: ConfiguracaoMotorDto) {
    return this.service.updateConfiguracao(dto);
  }

  @Delete('proposta/:id')
  excluirProposta(@Param('id') id: string) {
    return this.service.excluirProposta(id);
  }

  @Put('proposta/:id')
  editarProposta(@Param('id') id: string, @Body() body: any) {
    return this.service.editarProposta(id, body);
  }

  @Get('proposta/:id/html')
  async propostaHtml(@Param('id') id: string, @Res() res: Response) {
    const html = await this.propostaPdf.gerarHtml(id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Post('proposta/:id/enviar-pdf')
  async enviarPdf(
    @Param('id') id: string,
    @Body() body: { telefoneDestino?: string },
  ) {
    const html = await this.propostaPdf.gerarHtml(id);
    const pdfPath = await this.pdfGenerator.gerarPdf(html, `proposta-${id}.pdf`);
    const telefone = body.telefoneDestino || 'não informado';
    console.log(`PDF gerado: ${pdfPath} | Enviar para WhatsApp: ${telefone}`);
    return {
      sucesso: true,
      pdfPath,
      telefone,
      mensagem: 'PDF gerado com sucesso. Pronto para envio.',
    };
  }

  @Get('historico/:cooperadoId')
  historico(@Param('cooperadoId') cooperadoId: string) {
    return this.service.historico(cooperadoId);
  }

  @Post('tarifa-concessionaria')
  criarTarifa(@Body() dto: TarifaConcessionariaDto) {
    return this.service.criarTarifa(dto);
  }

  @Get('tarifa-concessionaria/atual')
  tarifaAtual() {
    return this.service.tarifaAtual();
  }

  @Get('tarifa-concessionaria')
  listarTarifas() {
    return this.service.listarTarifas();
  }

  @Put('tarifa-concessionaria/:id')
  atualizarTarifa(@Param('id') id: string, @Body() dto: TarifaConcessionariaDto) {
    return this.service.atualizarTarifa(id, dto);
  }

  @Delete('tarifa-concessionaria/:id')
  excluirTarifa(@Param('id') id: string) {
    return this.service.excluirTarifa(id);
  }

  @Get('historico-reajustes')
  historicoReajustes() {
    return this.service.historicoReajustes();
  }

  @Post('simular-reajuste')
  simularReajuste(@Body() dto: SimularReajusteDto) {
    return this.service.simularReajuste(dto);
  }

  @Post('aplicar-reajuste')
  aplicarReajuste(@Body() dto: SimularReajusteDto) {
    return this.service.aplicarReajuste(dto);
  }

  @Roles(ADMIN)
  @Get('lista-espera')
  getListaEspera() {
    return this.service.getListaEspera();
  }

  @Roles(ADMIN)
  @Post('lista-espera/:id/alocar')
  alocarListaEspera(@Param('id') id: string, @Body('usinaId') usinaId: string) {
    return this.service.alocarListaEspera(id, usinaId);
  }
}
