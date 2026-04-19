import { Injectable, BadRequestException, InternalServerErrorException, ForbiddenException, Logger, Optional, Inject } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TipoDocumento, ModeloCobranca, CooperTokenTipo } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { ConfigTenantService } from '../config-tenant/config-tenant.service';
import { EmailService } from '../email/email.service';
import { ProcessarFaturaDto } from './dto/processar-fatura.dto';
import { UploadDocumentoDto } from './dto/upload-documento.dto';
import { UploadConcessionariaDto } from './dto/upload-concessionaria.dto';
import { RelatorioFaturaService } from './relatorio-fatura.service';
import { CooperTokenService } from '../cooper-token/cooper-token.service';

const BUCKET = 'documentos-cooperados';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

interface HistoricoItem {
  mesAno: string;
  consumoKwh: number;
  valorRS: number;
}

interface DadosExtraidos {
  titular: string;
  documento: string;
  tipoDocumento: 'CPF' | 'CNPJ';
  enderecoInstalacao: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  numeroUC: string;
  codigoMedidor: string;
  distribuidora: string;
  classificacao: string;
  modalidadeTarifaria: string;
  tensaoNominal: string;
  tipoFornecimento: string;
  mesReferencia: string;
  vencimento: string;
  totalAPagar: number;
  consumoAtualKwh: number;
  leituraAnterior: number;
  leituraAtual: number;
  tarifaTUSD: number;
  tarifaTE: number;
  tarifaTUSDSemICMS?: number;
  tarifaTESemICMS?: number;
  bandeiraTarifaria: 'VERDE' | 'AMARELA' | 'VERMELHA_1' | 'VERMELHA_2';
  valorBandeira: number;
  contribIluminacaoPublica: number;
  icmsPercentual: number;
  icmsValor: number;
  pisCofinsPercentual: number;
  pisCofinsValor: number;
  multaJuros: number;
  descontos: number;
  outrosEncargos: number;
  possuiCompensacao: boolean;
  creditosRecebidosKwh: number;
  saldoTotalKwh: number;
  participacaoSaldo: number;
  energiaInjetadaKwh: number;
  energiaFornecidaKwh: number;
  valorCompensadoReais: number;
  temCreditosInjetados: boolean;
  saldoKwhAnterior: number;
  saldoKwhAtual: number;
  validadeCreditos: string;
  valorSemDesconto: number;
  historicoConsumo: HistoricoItem[];
}

interface AnthropicContent {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content: AnthropicContent[];
}

const tipoDocumentoLabel: Record<string, string> = {
  RG_FRENTE: 'RG (Frente)',
  RG_VERSO: 'RG (Verso)',
  CNH_FRENTE: 'CNH (Frente)',
  CNH_VERSO: 'CNH (Verso)',
  CONTRATO_SOCIAL: 'Contrato Social',
};

@Injectable()
export class FaturasService {
  private readonly logger = new Logger(FaturasService.name);
  private supabase: SupabaseClient;

  private readonly waBaseUrl: string;

  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
    private configTenant: ConfigTenantService,
    private emailService: EmailService,
    private relatorioService: RelatorioFaturaService,
    private cooperTokenService: CooperTokenService,
  ) {
    this.waBaseUrl = process.env.WHATSAPP_SERVICE_URL ?? 'http://localhost:3002';
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
    );
  }

  async processarFatura(dto: ProcessarFaturaDto): Promise<{
    faturaId: string;
    dadosExtraidos: DadosExtraidos;
    mediaKwhCalculada: number;
    mesesUtilizados: number;
    mesesDescartados: number;
    thresholdUtilizado: number;
    arquivoUrl: string;
    plano?: { id: string; nome: string; descontoBase: number; modeloCobranca: string } | null;
  }> {
    // 1. Chamar Claude API
    try { await this.prisma.$queryRaw`SELECT 1`; } catch (e) { throw new InternalServerErrorException(`DB: ${(e as Error).message}`); }

    // 1a. Buscar plano se fornecido
    let planoInfo: { id: string; nome: string; descontoBase: number; modeloCobranca: string } | null = null;
    if (dto.planoId) {
      const plano = await this.prisma.plano.findUnique({ where: { id: dto.planoId } });
      if (plano) {
        planoInfo = {
          id: plano.id,
          nome: plano.nome,
          descontoBase: Number(plano.descontoBase),
          modeloCobranca: plano.modeloCobranca,
        };
      }
    }

    const dadosExtraidos = await this.extrairDadosFatura(
      dto.arquivoBase64,
      dto.tipoArquivo,
    );

    // 2. Buscar threshold (FATURA-02: filtrar por cooperativaId do cooperado)
    const cooperadoForConfig = await this.prisma.cooperado.findUnique({
      where: { id: dto.cooperadoId },
      select: { cooperativaId: true },
    });
    const configThreshold = await this.prisma.configTenant.findFirst({
      where: { chave: 'threshold_meses_atipicos', cooperativaId: cooperadoForConfig?.cooperativaId ?? undefined },
    });
    const threshold = configThreshold ? parseFloat(configThreshold.valor) : 50;

    // 3. Calcular média com descarte de meses atípicos
    const historico = dadosExtraidos.historicoConsumo;
    const { media, mesesUtilizados, mesesDescartados } =
      this.calcularMedia(historico, threshold, dadosExtraidos.consumoAtualKwh);

    // 4. Upload do arquivo
    const ext = dto.tipoArquivo === 'pdf' ? 'pdf' : 'jpg';
    const filePath = `${dto.cooperadoId}/fatura-${Date.now()}.${ext}`;
    const buffer = Buffer.from(dto.arquivoBase64, 'base64');

    const { data: uploadData, error: uploadError } = await this.supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: dto.tipoArquivo === 'pdf' ? 'application/pdf' : 'image/jpeg',
        upsert: false,
      });

    if (uploadError || !uploadData) {
      throw new BadRequestException(
        `Erro ao fazer upload: ${uploadError?.message ?? 'desconhecido'}`,
      );
    }

    const { data: urlData } = this.supabase.storage
      .from(BUCKET)
      .getPublicUrl(uploadData.path);
    const arquivoUrl = urlData.publicUrl;

    // 5. Salvar em faturas_processadas
    let faturaId: string;
    try {
      const economiaGerada = dadosExtraidos.valorSemDesconto > 0
        ? Math.round((dadosExtraidos.valorSemDesconto - dadosExtraidos.totalAPagar) * 100) / 100
        : null;

      const fatura = await this.prisma.faturaProcessada.create({
        data: {
          cooperadoId: dto.cooperadoId,
          ucId: dto.ucId ?? null,
          arquivoUrl,
          dadosExtraidos: dadosExtraidos as object,
          historicoConsumo: historico as object,
          mesesUtilizados,
          mesesDescartados,
          mediaKwhCalculada: media,
          thresholdUtilizado: threshold,
          status: 'PENDENTE',
          saldoKwhAnterior: dadosExtraidos.saldoKwhAnterior || null,
          saldoKwhAtual: dadosExtraidos.saldoKwhAtual || null,
          validadeCreditos: dadosExtraidos.validadeCreditos
            ? (() => { const [m, a] = dadosExtraidos.validadeCreditos.split('/'); return m && a ? new Date(Number(a), Number(m) - 1) : null; })()
            : null,
          valorSemDesconto: dadosExtraidos.valorSemDesconto || null,
          economiaGerada,
        },
        select: { id: true },
      });
      faturaId = fatura.id;
    } catch (e) { throw new InternalServerErrorException(`Salvar fatura: ${(e as Error).message}`); }

    // 6. Atualizar cooperado
    await this.prisma.cooperado.update({
      where: { id: dto.cooperadoId },
      data: {
        cotaKwhMensal: media,
        documento: dadosExtraidos.documento || undefined,
        tipoDocumento: dadosExtraidos.tipoDocumento || undefined,
      },
    });

    // 7. Atualizar UC se fornecida
    if (dto.ucId) {
      await this.prisma.uc.update({
        where: { id: dto.ucId },
        data: {
          numeroUC: dadosExtraidos.numeroUC || undefined,
          codigoMedidor: dadosExtraidos.codigoMedidor || undefined,
          cep: dadosExtraidos.cep || undefined,
          bairro: dadosExtraidos.bairro || undefined,
          distribuidora: dadosExtraidos.distribuidora || undefined,
          classificacao: dadosExtraidos.classificacao || undefined,
          modalidadeTarifaria: dadosExtraidos.modalidadeTarifaria || undefined,
          tensaoNominal: dadosExtraidos.tensaoNominal || undefined,
          tipoFornecimento: dadosExtraidos.tipoFornecimento || undefined,
          endereco: dadosExtraidos.enderecoInstalacao || undefined,
          cidade: dadosExtraidos.cidade || undefined,
          estado: dadosExtraidos.estado || undefined,
        },
      });
    }

    return {
      faturaId,
      dadosExtraidos,
      mediaKwhCalculada: media,
      mesesUtilizados,
      mesesDescartados,
      thresholdUtilizado: threshold,
      arquivoUrl,
      plano: planoInfo,
    };
  }

  async extrairOcr(arquivoBase64: string, tipoArquivo: 'pdf' | 'imagem'): Promise<DadosExtraidos> {
    return this.extrairDadosFatura(arquivoBase64, tipoArquivo);
  }

  async findByCooperado(cooperadoId: string, cooperativaId: string) {
    return this.prisma.faturaProcessada.findMany({
      where: { cooperadoId, cooperado: { cooperativaId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Upload Concessionária com análise automática ──────────────────────────

  async uploadConcessionaria(dto: UploadConcessionariaDto) {
    // 0. Buscar cooperativaId do cooperado (FATURA-02: multi-tenant isolation)
    const cooperadoUpload = await this.prisma.cooperado.findUnique({
      where: { id: dto.cooperadoId },
      select: { cooperativaId: true },
    });
    if (!cooperadoUpload?.cooperativaId) throw new BadRequestException('Cooperado ou cooperativa não encontrado');
    const cooperativaIdUpload = cooperadoUpload.cooperativaId;

    // 1. OCR
    const dadosExtraidos = await this.extrairDadosFatura(dto.arquivoBase64, dto.tipoArquivo);

    // 2. Match UC pelo número extraído
    let ucId = dto.ucId ?? null;
    if (!ucId && dadosExtraidos.numeroUC) {
      const uc = await this.prisma.uc.findFirst({
        where: { numeroUC: dadosExtraidos.numeroUC },
      });
      if (uc) ucId = uc.id;
    }

    // 3. Upload arquivo ao Supabase
    const ext = dto.tipoArquivo === 'pdf' ? 'pdf' : 'jpg';
    const filePath = `${dto.cooperadoId}/fatura-conc-${Date.now()}.${ext}`;
    const buffer = Buffer.from(dto.arquivoBase64, 'base64');
    const { data: uploadData, error: uploadError } = await this.supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: dto.tipoArquivo === 'pdf' ? 'application/pdf' : 'image/jpeg',
        upsert: false,
      });
    if (uploadError || !uploadData) {
      throw new BadRequestException(`Erro ao fazer upload: ${uploadError?.message ?? 'desconhecido'}`);
    }
    const { data: urlData } = this.supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);
    const arquivoUrl = urlData.publicUrl;

    // 4. Buscar contrato ativo para comparação
    const contrato = await this.prisma.contrato.findFirst({
      where: { cooperadoId: dto.cooperadoId, status: 'ATIVO' },
      include: { plano: true },
    });

    const kwhContrato = contrato ? Number(contrato.kwhContrato ?? 0) : 0;
    const kwhCompensado = Number(dadosExtraidos.creditosRecebidosKwh ?? 0);
    const kwhInjetado = kwhCompensado; // simplificação
    const saldoAtual = Number(dadosExtraidos.saldoTotalKwh ?? 0);

    // 5. Calcular análise: divergência entre kWh esperado (contrato) e compensado
    const kwhEsperado = kwhContrato;
    const divergencia = kwhEsperado > 0 ? kwhCompensado - kwhEsperado : 0;
    const divergenciaPerc = kwhEsperado > 0
      ? Math.abs(divergencia / kwhEsperado) * 100
      : 0;

    const statusAnalise = divergenciaPerc < 5 ? 'BAIXA' : divergenciaPerc < 15 ? 'MEDIA' : 'ALTA';
    const analise = {
      kwhEsperado,
      kwhCompensado,
      kwhInjetado,
      saldoAtual,
      divergencia: Math.round(divergencia * 100) / 100,
      divergenciaPerc: Math.round(divergenciaPerc * 100) / 100,
      statusAnalise,
    };

    // 6. Calcular media e threshold (FATURA-02: filtrar por cooperativaId)
    const configThreshold = await this.prisma.configTenant.findFirst({
      where: { chave: 'threshold_meses_atipicos', cooperativaId: cooperativaIdUpload },
    });
    const threshold = configThreshold ? parseFloat(configThreshold.valor) : 50;
    const historico = dadosExtraidos.historicoConsumo ?? [];
    const { media, mesesUtilizados, mesesDescartados } = this.calcularMedia(
      historico, threshold, dadosExtraidos.consumoAtualKwh,
    );

    // 7. Determinar status de revisão
    const statusRevisao = divergenciaPerc < 5 ? 'AUTO_APROVADO' : 'PENDENTE_REVISAO';

    // 8. Salvar FaturaProcessada
    const economiaGeradaConc = dadosExtraidos.valorSemDesconto > 0
      ? Math.round((dadosExtraidos.valorSemDesconto - dadosExtraidos.totalAPagar) * 100) / 100
      : null;

    const fatura = await this.prisma.faturaProcessada.create({
      data: {
        cooperadoId: dto.cooperadoId,
        ucId,
        arquivoUrl,
        dadosExtraidos: { ...dadosExtraidos as object, analise },
        historicoConsumo: historico as object,
        mesesUtilizados,
        mesesDescartados,
        mediaKwhCalculada: media,
        thresholdUtilizado: threshold,
        status: 'PENDENTE',
        analise: analise as object,
        mesReferencia: dto.mesReferencia,
        statusRevisao,
        saldoKwhAnterior: dadosExtraidos.saldoKwhAnterior || null,
        saldoKwhAtual: dadosExtraidos.saldoKwhAtual || null,
        validadeCreditos: dadosExtraidos.validadeCreditos
          ? (() => { const [m, a] = dadosExtraidos.validadeCreditos.split('/'); return m && a ? new Date(Number(a), Number(m) - 1) : null; })()
          : null,
        valorSemDesconto: dadosExtraidos.valorSemDesconto || null,
        economiaGerada: economiaGeradaConc,
      },
    });

    // 9. Se auto-aprovado, gerar cobrança automaticamente
    let cobranca = null;
    if (statusRevisao === 'AUTO_APROVADO') {
      cobranca = await this.gerarCobrancaPosFatura(fatura.id);
    }

    return {
      fatura,
      analise,
      statusRevisao,
      cobranca,
    };
  }

  // ── Gerar cobrança após aprovação de fatura ─────────────────────────────────

  async gerarCobrancaPosFatura(faturaId: string) {
    const fatura = await this.prisma.faturaProcessada.findUnique({
      where: { id: faturaId },
      include: { cooperado: true, uc: true },
    });
    if (!fatura) throw new BadRequestException('Fatura não encontrada');
    if (!fatura.cooperado || !fatura.cooperado.cooperativaId) throw new BadRequestException('Cooperado sem cooperativa vinculada');
    if (!fatura.cooperadoId) throw new BadRequestException('Fatura sem cooperado vinculado');
    const cooperativaIdFatura = fatura.cooperado.cooperativaId;

    const dados = fatura.dadosExtraidos as any;
    const analise = (fatura as any).analise as any;

    // Buscar contrato ativo
    const contrato = await this.prisma.contrato.findFirst({
      where: { cooperadoId: fatura.cooperadoId!, status: 'ATIVO' },
      include: { plano: true, usina: true },
    });
    if (!contrato) {
      this.logger.warn(`Sem contrato ativo para cooperado ${fatura.cooperadoId}`);
      return null;
    }

    // Resolver modelo de cobrança
    const modeloCobranca = await this.resolverModeloCobranca(contrato, contrato.usina, cooperativaIdFatura);

    // Sprint 5: a engine de cobrança não foi refatorada pra modelos não-FIXO.
    // Reusa o mesmo flag que congela criação de contratos em COMPENSADOS/DINAMICO.
    if (process.env.BLOQUEIO_MODELOS_NAO_FIXO !== 'false' && modeloCobranca !== 'FIXO_MENSAL') {
      throw new BadRequestException(
        `Geração de cobrança bloqueada: contrato ${contrato.numero} ` +
        `usa modelo ${modeloCobranca}. ` +
        `A engine de cobrança só suporta FIXO_MENSAL durante o Sprint 5. ` +
        `Para liberar, definir BLOQUEIO_MODELOS_NAO_FIXO=false (não recomendado).`,
      );
    }

    // Determinar mês/ano referência
    const mesRef = fatura.mesReferencia ?? dados?.mesReferencia ?? '';
    let mesNum: number;
    let anoNum: number;
    if (mesRef.includes('-')) {
      // formato AAAA-MM
      const [a, m] = mesRef.split('-');
      anoNum = parseInt(a, 10);
      mesNum = parseInt(m, 10);
    } else if (mesRef.includes('/')) {
      // formato MM/AAAA
      const [m, a] = mesRef.split('/');
      mesNum = parseInt(m, 10);
      anoNum = parseInt(a, 10);
    } else {
      const agora = new Date();
      mesNum = agora.getMonth() + 1;
      anoNum = agora.getFullYear();
    }

    // Verificar duplicata
    const existe = await this.prisma.cobranca.findFirst({
      where: { contratoId: contrato.id, mesReferencia: mesNum, anoReferencia: anoNum },
    });
    if (existe) {
      await this.prisma.faturaProcessada.update({
        where: { id: faturaId },
        data: { cobrancaGeradaId: existe.id },
      });
      return existe;
    }

    // Buscar tarifa por distribuidora da UC (BUG-11-002)
    const propostaAceita = await this.prisma.propostaCooperado.findFirst({
      where: { cooperadoId: fatura.cooperadoId!, status: 'ACEITA' },
      orderBy: { createdAt: 'desc' },
    });
    const distribuidoraUc = fatura.uc?.distribuidora || contrato.usina?.distribuidora;
    const tarifaDistrib = await this.buscarTarifaPorDistribuidora(distribuidoraUc);
    const tarifaUnitVigente = tarifaDistrib.tarifaKwh;

    let tarifaKwh: number;
    if (propostaAceita) {
      tarifaKwh = Number(propostaAceita.kwhApuradoBase);
    } else {
      const consumoKwh = dados?.consumoAtualKwh ?? Number(contrato.kwhContrato ?? 0);
      const valorFatura = dados?.totalAPagar ?? 0;
      tarifaKwh = consumoKwh > 0 ? valorFatura / consumoKwh : tarifaUnitVigente;
    }

    const kwhContrato = Number(contrato.kwhContrato ?? 0);
    const percentualDesconto = Number(contrato.percentualDesconto);
    const descontoDecimal = percentualDesconto / 100;
    const creditosRecebidosKwh = Number(dados?.creditosRecebidosKwh ?? 0);

    // kWh para cobrança conforme modelo
    let kwhCobranca: number;
    if (modeloCobranca === 'CREDITOS_COMPENSADOS' || modeloCobranca === 'CREDITOS_DINAMICO') {
      if (modeloCobranca === 'CREDITOS_DINAMICO') tarifaKwh = tarifaUnitVigente;
      kwhCobranca = creditosRecebidosKwh > 0 ? Math.min(creditosRecebidosKwh, kwhContrato) : kwhContrato;
    } else {
      kwhCobranca = kwhContrato;
    }

    const valorBruto = Math.round(kwhCobranca * tarifaKwh * 100) / 100;
    const valorDesconto = Math.round(kwhCobranca * tarifaKwh * descontoDecimal * 100) / 100;
    const valorLiquido = Math.round(kwhCobranca * tarifaKwh * (1 - descontoDecimal) * 100) / 100;

    // Vencimento
    const diasVencimentoStr = await this.configTenant.get('dias_vencimento_cobranca', cooperativaIdFatura);
    const diasVencimento = diasVencimentoStr ? parseInt(diasVencimentoStr, 10) : 30;
    const vencimento = this.calcularVencimento(
      fatura.cooperado?.preferenciaCobranca ?? null,
      diasVencimento,
      dados?.vencimento,
    );

    // Determinar fonte dos dados
    const fonteDados = creditosRecebidosKwh > 0 ? 'FATURA_OCR' : 'ESTIMADO';

    const cobranca = await this.prisma.cobranca.create({
      data: {
        contratoId: contrato.id,
        mesReferencia: mesNum,
        anoReferencia: anoNum,
        valorBruto,
        percentualDesconto,
        valorDesconto,
        valorLiquido,
        dataVencimento: vencimento,
        status: 'A_VENCER',
        kwhCompensado: creditosRecebidosKwh,
        kwhConsumido: Number(dados?.consumoAtualKwh ?? 0),
        fonteDados,
        faturaProcessadaId: faturaId,
      },
    });

    // Vincular cobrança à fatura
    await this.prisma.faturaProcessada.update({
      where: { id: faturaId },
      data: {
        cobrancaGeradaId: cobranca.id,
        status: 'APROVADA',
        statusRevisao: fatura.statusRevisao === 'AUTO_APROVADO' ? 'AUTO_APROVADO' : 'APROVADO',
      },
    });

    // Notificação
    await this.notificacoes.criar({
      tipo: 'COBRANCA_GERADA',
      titulo: 'Nova cobrança gerada',
      mensagem: `Cobrança de R$ ${valorLiquido.toFixed(2)} ref. ${String(mesNum).padStart(2, '0')}/${anoNum}.`,
      cooperadoId: fatura.cooperadoId ?? undefined,
      link: '/dashboard/cobrancas',
    });

    // Enviar relatório por email + WA (async, não bloqueia)
    this.enviarRelatorioAposAprovacao(faturaId).catch(() => {});

    return cobranca;
  }

  // ── Central de Faturas: listagem com filtros ────────────────────────────────

  async centralFaturas(query: {
    cooperativaId?: string;
    status?: string;
    mesReferencia?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.cooperativaId) where.cooperativaId = query.cooperativaId;
    if (query.status) where.statusRevisao = query.status;
    if (query.mesReferencia) where.mesReferencia = query.mesReferencia;

    const [faturas, total] = await Promise.all([
      this.prisma.faturaProcessada.findMany({
        where,
        include: {
          cooperado: { select: { id: true, nomeCompleto: true, email: true, telefone: true } },
          uc: { select: { id: true, numeroUC: true, distribuidora: true } },
        },
        orderBy: [
          { statusRevisao: 'asc' }, // PENDENTE_REVISAO first alphabetically
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      this.prisma.faturaProcessada.count({ where }),
    ]);

    // Métricas
    const baseWhere: any = {};
    if (query.cooperativaId) baseWhere.cooperativaId = query.cooperativaId;
    if (query.mesReferencia) baseWhere.mesReferencia = query.mesReferencia;

    const [pendentes, autoAprovados, aprovados] = await Promise.all([
      this.prisma.faturaProcessada.count({ where: { ...baseWhere, statusRevisao: 'PENDENTE_REVISAO' } }),
      this.prisma.faturaProcessada.count({ where: { ...baseWhere, statusRevisao: 'AUTO_APROVADO' } }),
      this.prisma.faturaProcessada.count({ where: { ...baseWhere, statusRevisao: 'APROVADO' } }),
    ]);

    // Cooperados sem fatura no mês
    let semFatura = 0;
    if (query.mesReferencia) {
      const totalCooperados = await this.prisma.cooperado.count({
        where: query.cooperativaId ? { cooperativaId: query.cooperativaId, status: { in: ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'] } } : { status: { in: ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'] } },
      });
      const comFatura = await this.prisma.faturaProcessada.count({
        where: { ...baseWhere, mesReferencia: query.mesReferencia },
      });
      semFatura = Math.max(0, totalCooperados - comFatura);
    }

    return {
      faturas,
      total,
      page,
      limit,
      metricas: {
        pendentes,
        autoAprovados,
        aprovados,
        semFatura,
        total,
      },
    };
  }

  // ── Resumo por mês ─────────────────────────────────────────────────────────

  async centralResumo(cooperativaId?: string) {
    const where: any = cooperativaId ? { cooperativaId } : {};

    const faturas = await this.prisma.faturaProcessada.findMany({
      where,
      select: { mesReferencia: true, statusRevisao: true, cobrancaGeradaId: true },
    });

    // Total de cooperados ativos
    const totalCooperados = await this.prisma.cooperado.count({
      where: cooperativaId
        ? { cooperativaId, status: { in: ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'] } }
        : { status: { in: ['ATIVO', 'ATIVO_RECEBENDO_CREDITOS'] } },
    });

    // Agrupar por mês
    const meses = new Map<string, {
      mesReferencia: string;
      totalCooperados: number;
      comFatura: number;
      semFatura: number;
      pendentes: number;
      aprovados: number;
      totalCobrancas: number;
    }>();

    for (const f of faturas) {
      const mes = f.mesReferencia ?? 'sem-mes';
      if (!meses.has(mes)) {
        meses.set(mes, {
          mesReferencia: mes,
          totalCooperados,
          comFatura: 0,
          semFatura: 0,
          pendentes: 0,
          aprovados: 0,
          totalCobrancas: 0,
        });
      }
      const entry = meses.get(mes)!;
      entry.comFatura++;
      if (f.statusRevisao === 'PENDENTE_REVISAO') entry.pendentes++;
      if (['APROVADO', 'AUTO_APROVADO'].includes(f.statusRevisao)) entry.aprovados++;
      if (f.cobrancaGeradaId) entry.totalCobrancas++;
    }

    // Calcular semFatura
    for (const entry of meses.values()) {
      entry.semFatura = Math.max(0, totalCooperados - entry.comFatura);
    }

    return Array.from(meses.values()).sort((a, b) => b.mesReferencia.localeCompare(a.mesReferencia));
  }

  // ── Enviar relatório após aprovação (email + WA) ─────────────────────────

  async enviarRelatorioAposAprovacao(faturaId: string): Promise<void> {
    try {
      const fatura = await this.prisma.faturaProcessada.findUnique({
        where: { id: faturaId },
        include: { cooperado: true },
      });
      if (!fatura || !fatura.cooperado) return;

      const cooperado = fatura.cooperado;
      const relatorio = await this.relatorioService.gerarRelatorioByFaturaId(faturaId);
      const html = this.relatorioService.renderHtml(relatorio);

      // Email
      if (cooperado.email) {
        await this.emailService.enviarEmail(
          cooperado.email,
          `Relatório Mensal — ${relatorio.periodo.mesLabel}`,
          html,
        );
        this.logger.log(`Email relatório enviado para ${cooperado.email}`);
      }

      // WhatsApp
      if (cooperado.telefone) {
        const economia = relatorio.economia.economiaReais.toFixed(2);
        const economiaPerc = relatorio.economia.economiaPercentual.toFixed(0);
        const nome = cooperado.nomeCompleto.split(' ')[0];
        const mesLabel = relatorio.periodo.mesLabel;
        const portalUrl = process.env.PORTAL_URL ?? 'https://app.cooperebr.com.br/portal/financeiro';

        const mensagem = `Olá ${nome}! Sua fatura de ${mesLabel} está disponível. Você economizou R$${economia} (${economiaPerc}%) este mês! Ver relatório completo: ${portalUrl}`;

        try {
          await fetch(`${this.waBaseUrl}/api/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone: cooperado.telefone.replace(/\D/g, ''),
              message: mensagem,
            }),
          });
          this.logger.log(`WA relatório enviado para ${cooperado.telefone}`);
        } catch (err) {
          this.logger.warn(`Falha ao enviar WA para ${cooperado.telefone}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.error(`Erro ao enviar relatório pós-aprovação: ${(err as Error).message}`);
    }
  }

  // ── Rejeitar fatura ────────────────────────────────────────────────────────

  async rejeitarFatura(id: string, motivo?: string, cooperativaId?: string) {
    // BUG-2: verificar cooperativaId para evitar IDOR
    if (cooperativaId) {
      const fatura = await this.prisma.faturaProcessada.findFirst({
        where: { id, cooperado: { cooperativaId } },
      });
      if (!fatura) throw new ForbiddenException('Fatura não pertence à sua cooperativa');
    }
    return this.prisma.faturaProcessada.update({
      where: { id },
      data: {
        status: 'REJEITADA',
        statusRevisao: 'REJEITADO',
      },
    });
  }

  async aprovarFatura(id: string): Promise<{
    sucesso: boolean;
    cobrancasCriadas: number;
    avisos: string[];
  }> {
    const fatura = await this.prisma.faturaProcessada.findUnique({
      where: { id },
      include: { cooperado: true, uc: true },
    });
    if (!fatura) throw new BadRequestException('Fatura não encontrada');
    if (!fatura.cooperado || !fatura.cooperado.cooperativaId) throw new BadRequestException('Cooperado sem cooperativa vinculada');
    const cooperativaIdFatura = fatura.cooperado.cooperativaId;

    await this.prisma.faturaProcessada.update({
      where: { id },
      data: { status: 'APROVADA', statusRevisao: 'APROVADO' },
    });

    // Se a fatura tem mesReferencia (veio do fluxo upload-concessionaria), usar gerarCobrancaPosFatura
    if (fatura.mesReferencia && !fatura.cobrancaGeradaId) {
      const cobranca = await this.gerarCobrancaPosFatura(id);
      return {
        sucesso: true,
        cobrancasCriadas: cobranca ? 1 : 0,
        avisos: cobranca ? [`Cobrança R$ ${Number(cobranca.valorLiquido).toFixed(2)} gerada.`] : ['Sem contrato ativo.'],
      };
    }

    // Auto-gerar cobranças para contratos ativos do cooperado
    const avisos: string[] = [];
    let cobrancasCriadas = 0;

    const contratos = await this.prisma.contrato.findMany({
      where: { cooperadoId: fatura.cooperadoId!, status: 'ATIVO' },
      include: { plano: true, usina: true },
    });

    if (contratos.length === 0) {
      avisos.push('Cooperado não possui contratos ativos. Nenhuma cobrança gerada.');
    }

    const dados = fatura.dadosExtraidos as any;
    const mesRef = dados?.mesReferencia ?? '';
    const [mesStr, anoStr] = mesRef.split('/');
    const mesReferencia = parseInt(mesStr, 10);
    const anoReferencia = parseInt(anoStr, 10);

    if (!mesReferencia || !anoReferencia) {
      avisos.push('Mês de referência não identificado na fatura. Cobranças não geradas automaticamente.');
      return { sucesso: true, cobrancasCriadas: 0, avisos };
    }

    // Buscar proposta aceita mais recente do cooperado
    const propostaAceita = await this.prisma.propostaCooperado.findFirst({
      where: { cooperadoId: fatura.cooperadoId!, status: 'ACEITA' },
      orderBy: { createdAt: 'desc' },
    });

    // Buscar tarifa vigente por distribuidora da UC (BUG-11-002)
    const distribuidoraFatura = fatura.uc?.distribuidora;
    const tarifaFallback = await this.buscarTarifaPorDistribuidora(distribuidoraFatura);
    let tarifaUnitVigente = tarifaFallback.tarifaKwh;

    if (!propostaAceita) {
      avisos.push('Sem proposta aceita encontrada. Cálculo usando tarifa vigente (TUSD+TE) como fallback.');
    }

    // Buscar dias de vencimento configurado
    const diasVencimentoStr = await this.configTenant.get('dias_vencimento_cobranca', cooperativaIdFatura);
    const diasVencimento = diasVencimentoStr ? parseInt(diasVencimentoStr, 10) : 30;

    // Dados extraídos da fatura para CREDITOS_COMPENSADOS/DINAMICO
    const creditosRecebidosKwh = Number(dados.creditosRecebidosKwh ?? 0);

    for (const contrato of contratos) {
      // Verificar se já existe cobrança para este mês/ano/contrato
      const existe = await this.prisma.cobranca.findFirst({
        where: { contratoId: contrato.id, mesReferencia, anoReferencia },
      });
      if (existe) {
        avisos.push(`Cobrança já existe para contrato ${contrato.numero} ref. ${mesRef}.`);
        continue;
      }

      const kwhContrato = Number(contrato.kwhContrato ?? 0);
      const percentualDesconto = Number(contrato.percentualDesconto);
      const descontoDecimal = percentualDesconto / 100;

      // Determinar modelo de cobrança (hierarquia: contrato → usina → config → plano → FIXO_MENSAL)
      const modeloCobranca = await this.resolverModeloCobranca(contrato, contrato.usina, cooperativaIdFatura);

      // Sprint 5: bloquear modelos não-FIXO enquanto engine não refatorada
      if (process.env.BLOQUEIO_MODELOS_NAO_FIXO !== 'false' && modeloCobranca !== 'FIXO_MENSAL') {
        this.logger.warn(
          `Cobrança pulada em aprovação de fatura: contrato ${contrato.numero} ` +
          `usa modelo ${modeloCobranca}, bloqueado por BLOQUEIO_MODELOS_NAO_FIXO. ` +
          `Fatura: ${fatura.id}`,
        );
        avisos.push(`Contrato ${contrato.numero}: modelo ${modeloCobranca} bloqueado (Sprint 5). Cobrança não gerada.`);
        continue;
      }

      // BUG-11-002: buscar tarifa pela distribuidora do contrato (usina) se disponível
      const distribContrato = contrato.usina?.distribuidora;
      if (distribContrato && distribContrato !== distribuidoraFatura) {
        const tarifaContrato = await this.buscarTarifaPorDistribuidora(distribContrato);
        tarifaUnitVigente = tarifaContrato.tarifaKwh;
      }

      // tarifaKwh = preço do kWh da concessionária (da proposta aceita ou fallback)
      let tarifaKwh: number;
      if (propostaAceita) {
        tarifaKwh = Number(propostaAceita.kwhApuradoBase);
      } else {
        // Fallback: calcula a partir da fatura ou usa tarifa vigente da distribuidora
        const consumoKwh = dados.consumoAtualKwh ?? kwhContrato;
        const valorFatura = dados.totalAPagar ?? 0;
        tarifaKwh = consumoKwh > 0 ? valorFatura / consumoKwh : tarifaUnitVigente;
      }

      // Determinar kwhCobranca conforme modelo
      let kwhCobranca: number;
      let modeloUsado: string;

      if (modeloCobranca === 'CREDITOS_COMPENSADOS') {
        if (creditosRecebidosKwh > 0) {
          kwhCobranca = Math.min(creditosRecebidosKwh, kwhContrato);
          modeloUsado = `CREDITOS_COMPENSADOS (${kwhCobranca.toFixed(2)} kWh recebidos)`;
        } else {
          kwhCobranca = kwhContrato;
          modeloUsado = 'FIXO_MENSAL (fallback — creditosRecebidosKwh não disponível na fatura)';
        }

      } else if (modeloCobranca === 'CREDITOS_DINAMICO') {
        // No dinâmico, usa tarifa vigente atual em vez da proposta
        tarifaKwh = tarifaUnitVigente;
        if (creditosRecebidosKwh > 0) {
          kwhCobranca = Math.min(creditosRecebidosKwh, kwhContrato);
          modeloUsado = `CREDITOS_DINAMICO (${kwhCobranca.toFixed(2)} kWh, tarifa TUSD+TE=${tarifaUnitVigente.toFixed(5)})`;
        } else {
          kwhCobranca = kwhContrato;
          modeloUsado = `CREDITOS_DINAMICO fixo (fallback — sem créditos, tarifa TUSD+TE=${tarifaUnitVigente.toFixed(5)})`;
        }

      } else {
        // FIXO_MENSAL (padrão)
        kwhCobranca = kwhContrato;
        modeloUsado = 'FIXO_MENSAL';
      }

      // Cálculo unificado: valorLiquido = kwhCobranca × tarifaKwh × (1 - descontoDecimal)
      const valorBruto = Math.round(kwhCobranca * tarifaKwh * 100) / 100;
      const valorDesconto = Math.round(kwhCobranca * tarifaKwh * descontoDecimal * 100) / 100;
      const valorLiquido = Math.round(kwhCobranca * tarifaKwh * (1 - descontoDecimal) * 100) / 100;

      // Data de vencimento conforme preferência do cooperado ou configuração global
      const vencimento = this.calcularVencimento(
        fatura.cooperado.preferenciaCobranca,
        diasVencimento,
        dados?.vencimento,
      );

      // Determinar fonte dos dados
      const fonteDados = (modeloCobranca === 'CREDITOS_COMPENSADOS' || modeloCobranca === 'CREDITOS_DINAMICO')
        && creditosRecebidosKwh > 0 ? 'FATURA_OCR' : 'ESTIMADO';

      const cobrancaCriada = await this.prisma.cobranca.create({
        data: {
          contratoId: contrato.id,
          mesReferencia,
          anoReferencia,
          valorBruto,
          percentualDesconto,
          valorDesconto,
          valorLiquido,
          dataVencimento: vencimento,
          status: 'A_VENCER',
          kwhCompensado: creditosRecebidosKwh > 0 ? creditosRecebidosKwh : null,
          kwhConsumido: dados.consumoAtualKwh != null ? Number(dados.consumoAtualKwh) : null,
          fonteDados,
          faturaProcessadaId: fatura.id,
        },
      });

      // Vincular cobrança à fatura (última criada ganha o link)
      await this.prisma.faturaProcessada.update({
        where: { id: fatura.id },
        data: { cobrancaGeradaId: cobrancaCriada.id },
      });

      cobrancasCriadas++;
      avisos.push(`Contrato ${contrato.numero}: modelo ${modeloUsado}`);

      const economia = valorDesconto.toFixed(2);
      await this.notificacoes.criar({
        tipo: 'COBRANCA_GERADA',
        titulo: 'Nova cobrança gerada',
        mensagem: `Cobrança de R$ ${valorLiquido.toFixed(2)} gerada para contrato ${contrato.numero} ref. ${mesRef}. Você economizou R$ ${economia} este mês.`,
        cooperadoId: fatura.cooperadoId ?? undefined,
        link: `/dashboard/cobrancas`,
      });

      // Auto-emissão de CooperToken para cooperados Opção B
      if (
        fatura.cooperado?.opcaoToken === 'B' &&
        contrato.plano?.cooperTokenAtivo === true
      ) {
        try {
          const kwhCompensado = Number(dados?.creditosRecebidosKwh ?? 0);
          if (kwhCompensado > 0) {
            const plano = contrato.plano;
            const valorEmissao =
              plano.tokenValorTipo === 'FIXO'
                ? Number(plano.tokenValorFixo)
                : Math.round(
                    (valorBruto / kwhCompensado) *
                      (1 - Number(plano.descontoBase) / 100) *
                      10000,
                  ) / 10000;

            await this.cooperTokenService.creditar({
              cooperadoId: fatura.cooperadoId!,
              cooperativaId: cooperativaIdFatura,
              tipo: CooperTokenTipo.GERACAO_EXCEDENTE,
              quantidade: kwhCompensado,
              valorEmissao,
              referenciaId: fatura.id,
              referenciaTabela: 'FaturaProcessada',
              expiracaoMeses: plano.tokenExpiracaoMeses ?? 12,
            });

            avisos.push(
              `CooperToken: ${kwhCompensado} tokens emitidos (Opção B, contrato ${contrato.numero}).`,
            );
          }
        } catch (err) {
          this.logger.warn(
            `Falha ao emitir CooperToken para fatura ${fatura.id}, contrato ${contrato.numero}: ${(err as Error).message}`,
          );
        }
      }

      // Crédito automático de CooperToken por kWh excedente (gerou mais que a cota)
      if (
        contrato.plano?.cooperTokenAtivo === true &&
        Number(contrato.plano?.tokenPorKwhExcedente ?? 0) > 0
      ) {
        try {
          const kwhExcedente = creditosRecebidosKwh - kwhContrato;
          if (kwhExcedente > 0) {
            const plano = contrato.plano;
            const quantidadeTokens = Math.round(kwhExcedente * Number(plano.tokenPorKwhExcedente) * 10000) / 10000;

            await this.cooperTokenService.creditar({
              cooperadoId: fatura.cooperadoId!,
              cooperativaId: cooperativaIdFatura,
              tipo: CooperTokenTipo.GERACAO_EXCEDENTE,
              quantidade: quantidadeTokens,
              valorEmissao: Number(plano.valorTokenReais ?? 0.45),
              referenciaId: fatura.id,
              referenciaTabela: 'FaturaProcessada',
              expiracaoMeses: plano.tokenExpiracaoMeses ?? 12,
            });

            avisos.push(
              `CooperToken excedente: ${quantidadeTokens.toFixed(4)} tokens creditados (${kwhExcedente.toFixed(2)} kWh excedente, contrato ${contrato.numero}).`,
            );
          }
        } catch (err) {
          this.logger.warn(
            `Falha ao creditar CooperToken excedente para fatura ${fatura.id}, contrato ${contrato.numero}: ${(err as Error).message}`,
          );
        }
      }
    }

    if (cobrancasCriadas > 0) {
      avisos.push(`${cobrancasCriadas} cobrança(s) gerada(s) com sucesso.`);
    }

    return { sucesso: true, cobrancasCriadas, avisos };
  }

  async deletarFatura(id: string, cooperativaId?: string): Promise<{ sucesso: boolean }> {
    // BUG-2: verificar cooperativaId para evitar IDOR
    if (cooperativaId) {
      const fatura = await this.prisma.faturaProcessada.findFirst({
        where: { id, cooperado: { cooperativaId } },
      });
      if (!fatura) throw new ForbiddenException('Fatura não pertence à sua cooperativa');
    }
    await this.prisma.faturaProcessada.delete({ where: { id } });
    return { sucesso: true };
  }

  // Diagnóstico: verifica tabelas e bucket (FATURA-02: filtrar por cooperativaId)
  async diagnostico(cooperativaId: string): Promise<Record<string, unknown>> {
    const resultado: Record<string, unknown> = {};

    try {
      await this.prisma.configTenant.findFirst({ where: { cooperativaId } });
      resultado['config_tenant'] = 'OK';
    } catch (e) {
      resultado['config_tenant'] = `ERRO: ${(e as Error).message}`;
    }

    try {
      await this.prisma.faturaProcessada.findFirst({ where: { cooperado: { cooperativaId } } });
      resultado['faturas_processadas'] = 'OK';
    } catch (e) {
      resultado['faturas_processadas'] = `ERRO: ${(e as Error).message}`;
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(BUCKET)
        .list('', { limit: 1 });
      resultado['bucket_documentos'] = error ? `ERRO: ${error.message}` : `OK (${data?.length ?? 0} itens)`;
    } catch (e) {
      resultado['bucket_documentos'] = `ERRO: ${(e as Error).message}`;
    }

    try {
      const cooperado = await this.prisma.cooperado.findFirst({
        where: { cooperativaId },
        select: { id: true, cotaKwhMensal: true, documento: true },
      });
      resultado['cooperado_campos_novos'] = cooperado
        ? `OK (cotaKwhMensal: ${cooperado.cotaKwhMensal}, documento: ${cooperado.documento})`
        : 'sem registros';
    } catch (e) {
      resultado['cooperado_campos_novos'] = `ERRO: ${(e as Error).message}`;
    }

    return resultado;
  }

  async uploadDocumento(dto: UploadDocumentoDto): Promise<{
    sucesso: boolean;
    url: string;
    tipoDocumento: string;
    documentoId: string;
  }> {
    const ext = dto.tipoArquivo === 'pdf' ? 'pdf' : 'jpg';
    const filePath = `${dto.cooperadoId}/${dto.tipoDocumento}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(dto.arquivoBase64, 'base64');

    const { data: uploadData, error: uploadError } = await this.supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        contentType: dto.tipoArquivo === 'pdf' ? 'application/pdf' : 'image/jpeg',
        upsert: false,
      });

    if (uploadError || !uploadData) {
      throw new BadRequestException(
        `Erro ao fazer upload do documento: ${uploadError?.message ?? 'desconhecido'}`,
      );
    }

    const { data: urlData } = this.supabase.storage
      .from(BUCKET)
      .getPublicUrl(uploadData.path);

    const nomeArquivo = `${dto.tipoDocumento}.${ext}`;

    const doc = await this.prisma.documentoCooperado.upsert({
      where: {
        cooperadoId_tipo: {
          cooperadoId: dto.cooperadoId,
          tipo: dto.tipoDocumento as TipoDocumento,
        },
      },
      update: {
        url: urlData.publicUrl,
        nomeArquivo,
        tamanhoBytes: buffer.length,
        status: 'PENDENTE',
        motivoRejeicao: null,
      },
      create: {
        cooperadoId: dto.cooperadoId,
        tipo: dto.tipoDocumento as TipoDocumento,
        url: urlData.publicUrl,
        nomeArquivo,
        tamanhoBytes: buffer.length,
      },
      select: { id: true },
    });

    await this.notificacoes.criar({
      tipo: 'DOCUMENTO_ENVIADO',
      titulo: 'Novo documento enviado',
      mensagem: `Cooperado enviou documento ${tipoDocumentoLabel[dto.tipoDocumento] ?? dto.tipoDocumento} aguardando aprovação.`,
      cooperadoId: dto.cooperadoId,
      link: `/dashboard/cooperados/${dto.cooperadoId}`,
    });

    return {
      sucesso: true,
      url: urlData.publicUrl,
      tipoDocumento: dto.tipoDocumento,
      documentoId: doc.id,
    };
  }

  private async extrairDadosFatura(
    arquivoBase64: string,
    tipoArquivo: 'pdf' | 'imagem',
  ): Promise<DadosExtraidos> {
    const mediaType =
      tipoArquivo === 'pdf' ? 'application/pdf' : 'image/jpeg';

    const source =
      tipoArquivo === 'pdf'
        ? { type: 'base64' as const, media_type: mediaType, data: arquivoBase64 }
        : { type: 'base64' as const, media_type: mediaType, data: arquivoBase64 };

    const documentType =
      tipoArquivo === 'pdf' ? 'document' : 'image';

    const prompt = `Analise esta fatura de energia elétrica e extraia os dados em JSON puro (sem markdown, sem blocos de código, apenas o objeto JSON).

Retorne exatamente este formato:
{
  "titular": "nome completo do titular",
  "documento": "CPF ou CNPJ do titular (apenas números, 11 dígitos para CPF ou 14 para CNPJ)",
  "tipoDocumento": "CPF ou CNPJ",
  "enderecoInstalacao": "endereço completo da instalação",
  "bairro": "bairro",
  "cidade": "cidade",
  "estado": "UF com 2 letras",
  "cep": "CEP apenas números",
  "numeroUC": "número da unidade consumidora",
  "codigoMedidor": "código do medidor",
  "distribuidora": "nome da distribuidora",
  "classificacao": "classificação tarifária ex: B1-RESIDENCIAL",
  "modalidadeTarifaria": "modalidade tarifária",
  "tensaoNominal": "tensão nominal ex: 127/220V",
  "tipoFornecimento": "MONOFASICO ou BIFASICO ou TRIFASICO",
  "mesReferencia": "MM/AAAA",
  "vencimento": "DD/MM/AAAA",
  "totalAPagar": 0.00,
  "consumoAtualKwh": 0,
  "leituraAnterior": 0,
  "leituraAtual": 0,
  "tarifaTUSD": 0.00000,
  "tarifaTE": 0.00000,
  "tarifaTUSDSemICMS": 0.00000,
  "tarifaTESemICMS": 0.00000,
  "bandeiraTarifaria": "VERDE ou AMARELA ou VERMELHA_1 ou VERMELHA_2",
  "valorBandeira": 0.00000,
  "contribIluminacaoPublica": 0.00,
  "icmsPercentual": 0.00,
  "icmsValor": 0.00,
  "pisCofinsPercentual": 0.00,
  "pisCofinsValor": 0.00,
  "multaJuros": 0.00,
  "descontos": 0.00,
  "outrosEncargos": 0.00,
  "possuiCompensacao": false,
  "creditosRecebidosKwh": 0,
  "saldoTotalKwh": 0,
  "participacaoSaldo": 0,
  "energiaInjetadaKwh": 0,
  "energiaFornecidaKwh": 0,
  "valorCompensadoReais": 0.00,
  "temCreditosInjetados": false,
  "saldoKwhAnterior": 0,
  "saldoKwhAtual": 0,
  "validadeCreditos": "MM/AAAA",
  "valorSemDesconto": 0.00,
  "historicoConsumo": [
    {"mesAno": "MM/AAAA", "consumoKwh": 0, "valorRS": 0.00}
  ]
}

IMPORTANTE:
- DOCUMENTO (CPF/CNPJ): Procure ESPECIFICAMENTE pelo label 'CPF:' ou 'CPF/CNPJ:' ou 'CNPJ:' na fatura. O CPF tem exatamente 11 dígitos numéricos (formato XXX.XXX.XXX-XX). NÃO confunda com o número da UC (unidade consumidora), que tem formato diferente (ex: 0.000.XXX.XXX.XXX-XX com mais dígitos). Extraia APENAS os dígitos do CPF/CNPJ encontrado no label correto.
- historicoConsumo: Procure na fatura a tabela ou gráfico chamado 'HIST. CONSUMO', 'HISTÓRICO DE CONSUMO', 'Histórico de Consumo kWh' ou similar. Extraia TODOS os meses listados (geralmente 10-13 meses), EXCETO o mês de referência desta fatura. Para cada mês, extraia mesAno (MM/AAAA) e consumoKwh. O campo valorRS deve ser o valor total da fatura daquele mês se disponível, senão 0. NÃO retorne historicoConsumo vazio se houver dados de consumo anteriores na fatura — eles geralmente aparecem como gráfico de barras ou tabela no verso/rodapé.
- Para cada mês do histórico, extraia o valor total da conta em reais (campo valorRS). Este histórico normalmente aparece como gráfico ou tabela no verso ou rodapé da fatura. O valorRS deve ser o valor total da fatura daquele mês (não apenas energia, mas o total pago incluindo todos os encargos e impostos). Se não disponível na fatura, usar 0.
- valorBandeira: adicional R$/kWh da bandeira tarifária (se verde, 0).
- contribIluminacaoPublica: valor fixo mensal em R$ da CIP/COSIP.
- icmsPercentual: alíquota do ICMS em % (ex: 25 para 25%). Procure na seção TRIBUTOS da fatura. No ES é tipicamente 25%, no RJ 18%, em SP 12%. Se não encontrar o percentual explícito mas encontrar o valor R$ do ICMS e a base de cálculo, calcule: (valorICMS / baseCalculo) * 100. NÃO retorne 0 se houver valor de ICMS na fatura. icmsValor: valor R$ do ICMS.
- pisCofinsPercentual: some os percentuais de PIS e COFINS. PIS varia de 0,65% a 1,26% e COFINS de 3% a 5,81%. Na EDP-ES tipicamente PIS=1,26% e COFINS=5,81% totalizando 7,07%. Procure na tabela de tributos os valores de PIS e COFINS separados e some. Se encontrar apenas o valor em R$ (ex: PIS R$0,78 e COFINS R$3,19), calcule o percentual: ((PIS_RS + COFINS_RS) / baseCalculo) * 100. pisCofinsValor: valor R$ do PIS/COFINS.
- multaJuros: valor R$ de multa/juros por atraso (0 se não houver).
- descontos: valor R$ de descontos da concessionária (devolução, crédito, etc). Sempre positivo.
- outrosEncargos: valor R$ de demais encargos não classificados acima.
- energiaInjetadaKwh: Procure linhas como 'En. At. Inj. oUC pT', 'Energia Ativa Injetada', 'En Injetada', 'Energia injetada' ou similar. Extraia o valor em kWh. Se houver múltiplas linhas (ponta, fora ponta), some todas. Se não encontrar, retorne 0.
- energiaFornecidaKwh: Procure linhas como 'En. At. Forn. pT', 'Energia Ativa Fornecida', 'En Fornecida' ou similar. Extraia o valor em kWh. Se houver múltiplas linhas, some todas. Se não encontrar, use consumoAtualKwh.
- valorCompensadoReais: Procure linhas como 'Energia compensada', 'Crédito de energia', 'Desconto GD' com valor em R$. É o valor monetário descontado pela compensação de créditos. Se não encontrar, retorne 0.
- temCreditosInjetados: Retorne true se a fatura contém QUALQUER indicação de energia injetada (linhas 'En. At. Inj.', 'Energia Injetada', 'Geração Distribuída', créditos de compensação, saldo de créditos > 0, ou possuiCompensacao = true). Isso indica que a UC já participa de geração distribuída.
- saldoKwhAnterior: Saldo de créditos acumulados ANTES da compensação desta fatura (kWh). Procure 'Saldo anterior', 'Saldo mês anterior', 'Créditos acumulados' na fatura. Se não encontrar, retorne 0.
- saldoKwhAtual: Saldo de créditos APÓS a compensação desta fatura (kWh). Procure 'Saldo atual', 'Saldo a expirar', 'Créditos remanescentes'. Se não encontrar, retorne 0.
- validadeCreditos: Data de validade dos créditos mais antigos (MM/AAAA). Créditos de GD vencem em 60 meses. Procure 'Validade', 'Expiração'. Se não encontrar, use string vazia.
- valorSemDesconto: Valor que seria cobrado se a UC NÃO participasse de GD (sem compensação de créditos). Some consumoAtualKwh * (tarifaTUSD + tarifaTE) + contribIluminacaoPublica + impostos. Se não conseguir calcular, retorne 0.
- tarifaTUSD/tarifaTE: valores da coluna "Preço Unit. c/ Tributos" ou "Preço Unit. COM ICMS" da fatura (R$/kWh). Se a fatura tiver apenas uma coluna de tarifa (sem diferenciar com/sem tributos), use essa coluna.
- tarifaTUSDSemICMS/tarifaTESemICMS: valores da coluna "Tarifa Unit.(R$)" ou "Tarifa Aplicada s/ Tributos" ou "Tarifa s/ ICMS" (R$/kWh). São as tarifas homologadas pela ANEEL antes da incidência de ICMS. Se a fatura não separar as colunas, calcule: tarifaTUSDSemICMS = tarifaTUSD / (1 + icmsPercentual/100). Idem para TE.
- Se algum campo não estiver disponível, use string vazia ou zero.`;

    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: documentType,
              source,
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    };

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new BadRequestException(`Erro na API Claude: ${err}`);
    }

    const result = (await response.json()) as AnthropicResponse;
    const text = result.content.find((c) => c.type === 'text')?.text ?? '';

    try {
      return JSON.parse(text) as DadosExtraidos;
    } catch {
      throw new BadRequestException(
        `Resposta da Claude não é JSON válido: ${text.slice(0, 200)}`,
      );
    }
  }

  private calcularMedia(
    historico: HistoricoItem[],
    threshold: number,
    consumoAtualKwh: number,
  ): { media: number; mesesUtilizados: number; mesesDescartados: number } {
    if (historico.length === 0) {
      return { media: consumoAtualKwh, mesesUtilizados: 0, mesesDescartados: 0 };
    }

    const mediaGeral =
      historico.reduce((acc, m) => acc + m.consumoKwh, 0) / historico.length;
    const limiteMinimo = mediaGeral * (threshold / 100);

    const mesesFiltrados = historico.filter(
      (m) => m.consumoKwh >= limiteMinimo,
    );
    const mesesDescartados = historico.length - mesesFiltrados.length;

    if (mesesFiltrados.length === 0) {
      return {
        media: consumoAtualKwh,
        mesesUtilizados: 0,
        mesesDescartados: historico.length,
      };
    }

    const media =
      mesesFiltrados.reduce((acc, m) => acc + m.consumoKwh, 0) /
      mesesFiltrados.length;

    return {
      media: Math.round(media * 100) / 100,
      mesesUtilizados: mesesFiltrados.length,
      mesesDescartados,
    };
  }

  /**
   * Busca tarifa vigente por distribuidora (TUSD + TE).
   * Mesmo padrão usado em cobrancas.service.ts — normaliza nomes para match fuzzy.
   */
  private async buscarTarifaPorDistribuidora(distribuidora: string | null | undefined): Promise<{ tusd: number; te: number; tarifaKwh: number }> {
    const fallback = { tusd: 0.3, te: 0.2, tarifaKwh: 0.5 };

    if (distribuidora) {
      const normDistrib = distribuidora.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const todasTarifas = await this.prisma.tarifaConcessionaria.findMany({
        orderBy: { dataVigencia: 'desc' },
      });
      const tarifa = todasTarifas.find(t => {
        const normConc = t.concessionaria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        return normConc.includes(normDistrib) || normDistrib.includes(normConc);
      });
      if (tarifa) {
        const tusd = Number(tarifa.tusdNova);
        const te = Number(tarifa.teNova);
        return { tusd, te, tarifaKwh: tusd + te };
      }
    }

    // Fallback: tarifa mais recente independente de distribuidora
    const tarifa = await this.prisma.tarifaConcessionaria.findFirst({
      orderBy: { dataVigencia: 'desc' },
    });
    if (tarifa) {
      const tusd = Number(tarifa.tusdNova);
      const te = Number(tarifa.teNova);
      return { tusd, te, tarifaKwh: tusd + te };
    }

    return fallback;
  }

  private async resolverModeloCobranca(
    contrato: { modeloCobrancaOverride?: ModeloCobranca | null; plano?: { modeloCobranca: ModeloCobranca } | null },
    usina: { modeloCobrancaOverride?: ModeloCobranca | null } | null,
    cooperativaId?: string,
  ): Promise<ModeloCobranca> {
    // 1. Override do contrato (maior prioridade)
    if (contrato.modeloCobrancaOverride) return contrato.modeloCobrancaOverride;

    // 2. Override da usina
    if (usina?.modeloCobrancaOverride) return usina.modeloCobrancaOverride;

    // 3. ConfigTenant por cooperativa
    const configPadrao = cooperativaId
      ? await this.configTenant.get('modelo_cobranca_padrao', cooperativaId)
      : null;
    if (configPadrao && ['FIXO_MENSAL', 'CREDITOS_COMPENSADOS', 'CREDITOS_DINAMICO'].includes(configPadrao)) {
      return configPadrao as ModeloCobranca;
    }

    // 4. Modelo do plano vinculado ao contrato
    if (contrato.plano?.modeloCobranca) return contrato.plano.modeloCobranca;

    // 5. Padrão
    return 'FIXO_MENSAL';
  }

  /**
   * Calcula a data de vencimento com base na preferência do cooperado.
   * Fallback: hoje + diasVencimentoPadrao (ConfigTenant).
   */
  private calcularVencimento(
    preferencia: string | null | undefined,
    diasVencimentoPadrao: number,
    vencimentoFaturaConcessionaria?: string,
  ): Date {
    const hoje = new Date();

    if (!preferencia) {
      const v = new Date();
      v.setDate(v.getDate() + diasVencimentoPadrao);
      return v;
    }

    // VENCIMENTO_CONCESSIONARIA — usar dia do vencimento da fatura da concessionária
    if (preferencia === 'VENCIMENTO_CONCESSIONARIA') {
      if (vencimentoFaturaConcessionaria) {
        // Formato DD/MM/AAAA
        const partes = vencimentoFaturaConcessionaria.split('/');
        if (partes.length === 3) {
          const dia = parseInt(partes[0], 10);
          if (dia >= 1 && dia <= 31) {
            const v = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
            // Se o dia já passou neste mês, usar próximo mês
            if (v <= hoje) v.setMonth(v.getMonth() + 1);
            return v;
          }
        }
      }
      // Fallback se não encontrar vencimento na fatura
      const v = new Date();
      v.setDate(v.getDate() + diasVencimentoPadrao);
      return v;
    }

    // DIA_FIXO_XX — dia fixo do mês (ex: DIA_FIXO_05, DIA_FIXO_10)
    const matchDiaFixo = preferencia.match(/^DIA_FIXO_(\d{1,2})$/);
    if (matchDiaFixo) {
      const dia = parseInt(matchDiaFixo[1], 10);
      if (dia < 1 || dia > 31) {
        // Dia inválido — fallback para padrão
        const v = new Date();
        v.setDate(v.getDate() + diasVencimentoPadrao);
        return v;
      }
      const v = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
      if (v <= hoje) v.setMonth(v.getMonth() + 1);
      return v;
    }

    // APOS_FATURA_XD — X dias após geração da cobrança (ex: APOS_FATURA_3D, APOS_FATURA_10D)
    const matchApos = preferencia.match(/^APOS_FATURA_(\d+)D$/);
    if (matchApos) {
      const dias = parseInt(matchApos[1], 10);
      const v = new Date();
      v.setDate(v.getDate() + dias);
      return v;
    }

    // Preferência não reconhecida — fallback
    const v = new Date();
    v.setDate(v.getDate() + diasVencimentoPadrao);
    return v;
  }

  // ── Faturas do cooperado (portal) ─────────────────────────────────────────

  async minhasFaturasConcessionaria(cooperadoId: string) {
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { emailFaturasAtivo: true, emailFaturasAtivoEm: true },
    });

    const faturas = await this.prisma.faturaProcessada.findMany({
      where: { cooperadoId },
      select: {
        id: true,
        mesReferencia: true,
        dadosExtraidos: true,
        status: true,
        statusRevisao: true,
        createdAt: true,
        uc: { select: { id: true, numeroUC: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });

    return {
      emailFaturasAtivo: cooperado?.emailFaturasAtivo ?? false,
      emailFaturasAtivoEm: cooperado?.emailFaturasAtivoEm ?? null,
      faturas,
    };
  }

  // ── Vincular manualmente fatura a cooperado (admin) ───────────────────────

  async vincularFaturaManual(faturaId: string, cooperadoId: string, cooperativaId: string) {
    const fatura = await this.prisma.faturaProcessada.findUnique({
      where: { id: faturaId },
    });
    if (!fatura) throw new BadRequestException('Fatura não encontrada');

    const cooperado = await this.prisma.cooperado.findFirst({
      where: { id: cooperadoId, cooperativaId },
      select: { id: true, nomeCompleto: true },
    });
    if (!cooperado) throw new BadRequestException('Cooperado não encontrado nesta cooperativa');

    // Buscar UC pelo número extraído via OCR
    const dadosExtraidos = fatura.dadosExtraidos as Record<string, unknown>;
    const numeroUC = dadosExtraidos?.numeroUC as string | undefined;
    let ucId: string | null = null;
    if (numeroUC) {
      const uc = await this.prisma.uc.findFirst({
        where: { numeroUC, cooperadoId },
      });
      if (uc) ucId = uc.id;
    }

    const faturaAtualizada = await this.prisma.faturaProcessada.update({
      where: { id: faturaId },
      data: {
        cooperadoId,
        ucId,
        statusRevisao: 'PENDENTE_REVISAO',
      },
    });

    // Ativar emailFaturasAtivo
    await this.prisma.cooperado.update({
      where: { id: cooperadoId },
      data: {
        emailFaturasAtivo: true,
        emailFaturasAtivoEm: new Date(),
      },
    });

    return faturaAtualizada;
  }
}
