/// <reference types="multer" />
import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { MotorPropostaService } from './motor-proposta.service';
import { PropostaPdfService } from './proposta-pdf.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CalcularPropostaDto } from './dto/calcular-proposta.dto';
import { AceitarPropostaDto } from './dto/aceitar-proposta.dto';
import { ConfiguracaoMotorDto } from './dto/configuracao-motor.dto';
import { TarifaConcessionariaDto } from './dto/tarifa-concessionaria.dto';
import { SimularReajusteDto } from './dto/simular-reajuste.dto';

const { SUPER_ADMIN, ADMIN, OPERADOR } = PerfilUsuario;

@Controller('motor-proposta')
@Roles(SUPER_ADMIN, ADMIN, OPERADOR)
export class MotorPropostaController {
  constructor(
    private readonly service: MotorPropostaService,
    private readonly propostaPdf: PropostaPdfService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly whatsappSender: WhatsappSenderService,
  ) {}

  @Get()
  dashboard(@Req() req: any) {
    return this.service.dashboardStats(req.user?.cooperativaId);
  }

  @Post('calcular')
  calcular(@Body() dto: CalcularPropostaDto) {
    return this.service.calcular(dto);
  }

  @Post('confirmar-opcao')
  confirmarOpcao(@Body() dto: CalcularPropostaDto) {
    return this.service.confirmarOpcao(dto);
  }

  @Post('calcular-com-plano')
  calcularComPlano(@Body() body: any) {
    return this.service.calcularComPlano(body);
  }

  // T3 PARTE 4: restringido a ADMIN/SUPER_ADMIN (OPERADOR removido para reduzir superfície).
  // Ver comentário de dívida técnica no topo de MotorPropostaService.aceitar().
  // D-45 fix sub-fix 3: body tipado com class-validator (AceitarPropostaDto).
  @Roles(SUPER_ADMIN, ADMIN)
  @Post('aceitar')
  aceitar(@Body() body: AceitarPropostaDto, @Req() req: any) {
    return this.service.aceitar(body as any, req.user?.cooperativaId, req.user?.id);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('configuracao')
  getConfiguracao() {
    return this.service.getConfiguracao();
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Put('configuracao')
  updateConfiguracao(@Body() dto: ConfiguracaoMotorDto) {
    return this.service.updateConfiguracao(dto);
  }

  @Delete('proposta/:id')
  excluirProposta(@Param('id') id: string, @Req() req: any) {
    return this.service.excluirProposta(id, req.user?.cooperativaId);
  }

  @Put('proposta/:id')
  editarProposta(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.service.editarProposta(id, body, req.user?.cooperativaId);
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

    // Buscar telefone do cooperado se não fornecido
    let telefone = body.telefoneDestino;
    if (!telefone) {
      const proposta = await this.service.buscarProposta(id);
      telefone = proposta?.cooperado?.telefone ?? undefined;
    }

    if (!telefone) {
      return {
        sucesso: true,
        pdfPath,
        telefone: null,
        enviadoWhatsApp: false,
        mensagem: 'PDF gerado, mas telefone não informado. Envio WhatsApp não realizado.',
      };
    }

    try {
      await this.whatsappSender.enviarPdfWhatsApp(
        telefone,
        pdfPath,
        'proposta-cooperebr.pdf',
        'Segue sua proposta CoopereBR',
      );
      return {
        sucesso: true,
        pdfPath,
        telefone,
        enviadoWhatsApp: true,
        mensagem: 'PDF gerado e enviado via WhatsApp com sucesso.',
      };
    } catch (err) {
      return {
        sucesso: true,
        pdfPath,
        telefone,
        enviadoWhatsApp: false,
        mensagem: `PDF gerado, mas falha no envio WhatsApp: ${err.message}`,
      };
    }
  }

  @Get('historico/:cooperadoId')
  historico(@Param('cooperadoId') cooperadoId: string) {
    return this.service.historico(cooperadoId);
  }

  @Post('tarifa-concessionaria')
  criarTarifa(@Body() dto: TarifaConcessionariaDto) {
    return this.service.criarTarifa(dto);
  }

  @Public()
  @Get('tarifa-concessionaria/atual')
  tarifaAtual(@Query('concessionaria') concessionaria?: string) {
    return this.service.tarifaAtual(concessionaria);
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

  @Roles(SUPER_ADMIN, ADMIN)
  @Get('lista-espera')
  getListaEspera(@Req() req: any) {
    return this.service.getListaEspera(req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('lista-espera/:id/alocar')
  alocarListaEspera(@Param('id') id: string, @Body('usinaId') usinaId: string) {
    return this.service.alocarListaEspera(id, usinaId);
  }

  // ── Aprovação remota ──────────────────────────────────────────

  @Post('proposta/:id/enviar-aprovacao')
  enviarAprovacao(
    @Param('id') id: string,
    @Body() body: { canal: 'whatsapp' | 'email'; destino: string },
  ) {
    return this.service.enviarAprovacao(id, body.canal, body.destino);
  }

  @Public()
  @Get('proposta-por-token/:token')
  buscarPropostaPorToken(@Param('token') token: string) {
    return this.service.buscarPropostaPorToken(token);
  }

  @Public()
  @Post('aprovar')
  aprovarRemoto(@Body() body: { token: string; nome: string; aceite: boolean }) {
    return this.service.aprovarRemoto(body.token, body.nome, body.aceite);
  }

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('proposta/:id/aprovar-presencial')
  aprovarPresencial(@Param('id') id: string) {
    return this.service.aprovarPresencial(id);
  }

  // ── Análise de documentos (T3 PARTE 2) ───────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('proposta/:propostaId/documentos/status')
  analisarDocumentos(
    @Param('propostaId') propostaId: string,
    @Body() body: { resultado: 'APROVADO' | 'PENDENTE' | 'REPROVADO'; motivo?: string },
    @Req() req: any,
  ) {
    return this.service.analisarDocumentos(
      propostaId,
      body.resultado,
      body.motivo,
      req.user?.cooperativaId,
    );
  }

  // ── Assinatura digital ──────────────────────────────────────────

  @Post('proposta/:id/enviar-assinatura')
  enviarLinkAssinaturaDocs(@Param('id') id: string, @Req() req: any) {
    return this.service.enviarLinkAssinaturaDocs(id, req.user?.cooperativaId);
  }

  @Public()
  @Get('documento-por-token/:token')
  buscarDocumentoPorToken(@Param('token') token: string) {
    return this.service.buscarDocumentoPorToken(token);
  }

  @Public()
  @Post('assinar')
  assinarDocumento(
    @Body() body: { token: string; tipoDocumento: 'TERMO' | 'PROCURACAO'; nomeAssinante: string; aceite: boolean },
  ) {
    if (!body.aceite) return { sucesso: false, mensagem: 'Aceite é obrigatório' };
    return this.service.assinarDocumento(body.token, body.tipoDocumento, body.nomeAssinante);
  }

  // ── Modelos de documento ──────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN)
  @Post('upload-modelo')
  @UseInterceptors(FileInterceptor('arquivo'))
  uploadModelo(
    @UploadedFile() arquivo: Express.Multer.File,
    @Body('tipo') tipo: string,
    @Body('nome') nome: string,
    @Body('cooperativaId') cooperativaId?: string,
  ) {
    return this.service.uploadModelo(arquivo, tipo, nome, cooperativaId);
  }

  @Roles(ADMIN, OPERADOR)
  @Get('modelos-padrao')
  modelosPadrao() {
    return this.service.getModelosPadrao();
  }
}
