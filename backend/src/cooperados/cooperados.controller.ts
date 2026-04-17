/// <reference types="multer" />
import { Controller, Get, Post, Put, Delete, Param, Body, Req, Query, UploadedFile, UseInterceptors, ForbiddenException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CooperadosService } from './cooperados.service';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { PerfilUsuario } from '../auth/perfil.enum';
import { CreateCooperadoDto } from './dto/create-cooperado.dto';
import { UpdateCooperadoDto } from './dto/update-cooperado.dto';
import { FaturaMensalDto } from './dto/fatura-mensal.dto';
import { CadastroCompletoDto } from './dto/cadastro-completo.dto';
import { PrismaService } from '../prisma.service';
import { FaturasService } from '../faturas/faturas.service';
import { UcsService } from '../ucs/ucs.service';
import { MotorPropostaService } from '../motor-proposta/motor-proposta.service';

const { SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO, AGREGADOR } = PerfilUsuario;

@Controller('cooperados')
export class CooperadosController {
  private readonly logger = new Logger(CooperadosController.name);

  constructor(
    private readonly cooperadosService: CooperadosService,
    private readonly prisma: PrismaService,
    private readonly faturasService: FaturasService,
    private readonly ucsService: UcsService,
    private readonly motorProposta: MotorPropostaService,
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

  // ─── Cadastro por Proxy (rotas públicas) ────────────────────────────────────

  @Public()
  @Post('pre-cadastro-proxy')
  preCadastroProxy(@Body() body: {
    nomeCompleto: string;
    telefone: string;
    numeroUC?: string;
    distribuidora?: string;
    cidade?: string;
    estado?: string;
    economiaEstimada?: number;
    indicadorId: string;
    cooperativaId: string;
  }) {
    return this.cooperadosService.preCadastroProxy(body);
  }

  @Public()
  @Get('verificar-token/:token')
  verificarToken(@Param('token') token: string) {
    return this.cooperadosService.verificarTokenAssinatura(token);
  }

  @Public()
  @Post('confirmar-assinatura/:token')
  confirmarAssinatura(@Param('token') token: string) {
    return this.cooperadosService.confirmarAssinatura(token);
  }

  // ─── Rotas autenticadas ────────────────────────────────────────────────────

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, AGREGADOR)
  @Get()
  findAll(@Req() req: any, @Query('limit') limit?: number, @Query('offset') offset?: number, @Query('search') search?: string, @Query('administradoraId') administradoraId?: string) {
    const admId = req.user?.perfil === AGREGADOR ? req.user.administradoraId : administradoraId;
    return this.cooperadosService.findAll(req.user?.cooperativaId, limit, offset, search, admId);
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

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Get(':id/historico-status')
  getHistoricoStatus(@Param('id') id: string, @Req() req: any) {
    return this.cooperadosService.getHistoricoStatus(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, COOPERADO)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: any) {
    await this.assertCooperadoOwnership(req.user, id);
    return this.cooperadosService.findOne(id, req.user?.cooperativaId);
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR, AGREGADOR)
  @Post()
  create(@Body() body: CreateCooperadoDto, @Req() req: any) {
    const { termoAdesaoAceitoEm, cooperativaId, ...rest } = body;
    return this.cooperadosService.create({
      ...rest,
      cooperativaId: cooperativaId || req.user?.cooperativaId || undefined,
      termoAdesaoAceitoEm: termoAdesaoAceitoEm ? new Date(termoAdesaoAceitoEm) : undefined,
      ...(req.user?.perfil === AGREGADOR && req.user.administradoraId
        ? { administradoraId: req.user.administradoraId }
        : {}),
    });
  }

  @Roles(SUPER_ADMIN, ADMIN, OPERADOR)
  @Post('cadastro-completo')
  cadastroCompleto(@Body() body: CadastroCompletoDto, @Req() req: any) {
    return this.cooperadosService.cadastroCompleto(body, req.user?.cooperativaId);
  }

  @Roles(COOPERADO)
  @Get('meu-perfil/ucs')
  minhasUcs(@Req() req: any) {
    return this.cooperadosService.minhasUcs(req.user);
  }

  @Roles(COOPERADO)
  @Get('meu-perfil/cobrancas')
  minhasCobrancas(@Req() req: any, @Query('ucId') ucId?: string) {
    return this.cooperadosService.minhasCobrancas(req.user, ucId);
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

  // ── Portal: Nova UC com fatura (OCR + UC + simulação) ────────────────────

  @Roles(COOPERADO)
  @Post('meu-perfil/nova-uc-com-fatura')
  @UseInterceptors(FileInterceptor('fatura'))
  async novaUcComFatura(
    @Req() req: any,
    @UploadedFile() arquivo: Express.Multer.File,
    @Body('numeroUC') numeroUC: string,
    @Body('planoId') planoId?: string,
  ) {
    if (!arquivo) throw new BadRequestException('Arquivo da fatura é obrigatório');
    if (!numeroUC?.trim()) throw new BadRequestException('Número da UC é obrigatório');

    const cooperado = await this.cooperadosService.findCooperadoByUsuarioPublic(req.user);
    const cooperativaId = cooperado.cooperativaId;
    if (!cooperativaId) throw new BadRequestException('Cooperado sem cooperativa vinculada');

    // 1. Verificar UC duplicada
    const ucExistente = await this.prisma.uc.findFirst({
      where: { cooperadoId: cooperado.id, numero: numeroUC.trim() },
    });
    if (ucExistente) throw new ConflictException('UC já cadastrada para este cooperado');

    // 2. OCR da fatura
    const isPdf = arquivo.mimetype === 'application/pdf';
    const isImage = arquivo.mimetype.startsWith('image/');
    if (!isPdf && !isImage) throw new BadRequestException('Formato não suportado. Envie PDF ou imagem.');
    if (arquivo.size > 10 * 1024 * 1024) throw new BadRequestException('Arquivo excede 10MB');

    const base64 = arquivo.buffer.toString('base64');
    const tipoArquivo = isPdf ? 'pdf' as const : 'imagem' as const;
    const dadosOcr: Record<string, any> = await this.faturasService.extrairOcr(base64, tipoArquivo);

    // 3. Criar UC
    const uc = await this.ucsService.create({
      numero: numeroUC.trim(),
      endereco: dadosOcr.enderecoInstalacao || '',
      cidade: dadosOcr.cidade || '',
      estado: dadosOcr.estado || '',
      cooperadoId: cooperado.id,
      cep: dadosOcr.cep || undefined,
      bairro: dadosOcr.bairro || undefined,
      distribuidora: dadosOcr.distribuidora || undefined,
    });

    // 4. Simulação via motor (não persiste proposta ainda)
    const historico = dadosOcr.historicoConsumo ?? [];
    const ultimo = historico.length > 0 ? historico[historico.length - 1] : null;
    const consumo = dadosOcr.consumoAtualKwh ?? ultimo?.consumoKwh ?? 0;
    const valor = dadosOcr.totalAPagar ?? ultimo?.valorRS ?? 0;

    let simulacao: Record<string, unknown> | null = null;
    let outlierDetectado = false;
    try {
      const primPlano = await this.prisma.plano.findFirst({ where: { ativo: true } });
      const planoId = primPlano?.id ?? '';

      const resultado = await this.motorProposta.calcular({
        cooperadoId: cooperado.id,
        planoId,
        historico: historico.length > 0
          ? historico.map((h: { mesAno?: string; consumoKwh: number; valorRS?: number }) => ({
              mesAno: h.mesAno ?? new Date().toISOString().slice(0, 7),
              consumoKwh: h.consumoKwh,
              valorRS: h.valorRS ?? 0,
            }))
          : [{ mesAno: new Date().toISOString().slice(0, 7), consumoKwh: consumo, valorRS: valor }],
        kwhMesRecente: consumo,
        valorMesRecente: valor,
        mesReferencia: ultimo?.mesAno ?? new Date().toISOString().slice(0, 7),
      });

      outlierDetectado = resultado.outlierDetectado && !!resultado.aguardandoEscolha;
      if (resultado.resultado) {
        simulacao = {
          base: resultado.resultado.base,
          kwhContrato: resultado.resultado.kwhContrato,
          descontoPercentual: resultado.resultado.descontoPercentual,
          economiaMensal: resultado.resultado.economiaMensal,
          economiaAnual: resultado.resultado.economiaAnual,
          valorCooperado: resultado.resultado.valorCooperado,
          tarifaUnitSemTrib: resultado.resultado.tarifaUnitSemTrib,
          mesReferencia: resultado.resultado.mesReferencia,
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      this.logger.warn(`[nova-uc] Motor falhou para cooperado ${cooperado.id}: ${msg}`);
    }

    return {
      ok: true,
      ucId: uc.id,
      outlierDetectado,
      simulacao,
      dadosOcr: {
        consumoMedioKwh: consumo,
        totalAPagar: valor,
        distribuidora: dadosOcr.distribuidora || null,
        historicoConsumo: historico,
      },
    };
  }

  // ── Portal: Confirmar nova UC (aceitar proposta + contrato) ─────────────

  @Roles(COOPERADO)
  @Post('meu-perfil/confirmar-nova-uc')
  async confirmarNovaUc(
    @Req() req: any,
    @Body() body: { ucId: string; planoId?: string },
  ) {
    if (!body.ucId) throw new BadRequestException('ucId é obrigatório');

    const cooperado = await this.cooperadosService.findCooperadoByUsuarioPublic(req.user);
    const cooperativaId = cooperado.cooperativaId;

    // Validar que a UC pertence ao cooperado
    const uc = await this.prisma.uc.findFirst({
      where: { id: body.ucId, cooperadoId: cooperado.id },
    });
    if (!uc) throw new BadRequestException('UC não encontrada ou não pertence ao cooperado');

    // Recalcular para obter resultado fresco
    const historico = await this.prisma.faturaProcessada.findMany({
      where: { cooperadoId: cooperado.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { mesReferencia: true, dadosExtraidos: true },
    });

    // Buscar última fatura da UC ou usar dados mínimos
    const lastFatura = historico[0];
    const dados = (lastFatura?.dadosExtraidos as Record<string, unknown>) ?? {};
    const consumo = Number(dados.consumoAtualKwh ?? 0) || 300;
    const valor = Number(dados.totalAPagar ?? 0) || 250;
    const mesRef = lastFatura?.mesReferencia ?? new Date().toISOString().slice(0, 7);

    const primPlano = await this.prisma.plano.findFirst({ where: { ativo: true } });
    const planoId = body.planoId || primPlano?.id || '';

    const resultado = await this.motorProposta.calcular({
      cooperadoId: cooperado.id,
      planoId,
      historico: [{ mesAno: mesRef, consumoKwh: consumo, valorRS: valor }],
      kwhMesRecente: consumo,
      valorMesRecente: valor,
      mesReferencia: mesRef,
    });

    if (!resultado.resultado) {
      throw new BadRequestException('Não foi possível calcular a proposta. Verifique se a tarifa da distribuidora está cadastrada.');
    }

    const aceite = await this.motorProposta.aceitar({
      cooperadoId: cooperado.id,
      resultado: resultado.resultado,
      mesReferencia: resultado.resultado.mesReferencia,
      planoId: body.planoId || undefined,
    }, cooperativaId ?? undefined);

    this.logger.log(`[confirmar-uc] Cooperado ${cooperado.id} — proposta ${aceite.proposta?.id}, espera=${aceite.emListaEspera}`);

    return {
      ok: true,
      propostaId: aceite.proposta?.id ?? null,
      contratoNumero: aceite.contrato?.numero ?? null,
      emListaEspera: aceite.emListaEspera ?? false,
    };
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
    return this.cooperadosService.alterarStatusLote(body, req.user?.cooperativaId, req.user?.id);
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
