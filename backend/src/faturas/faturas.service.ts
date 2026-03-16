import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TipoDocumento } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { ProcessarFaturaDto } from './dto/processar-fatura.dto';
import { UploadDocumentoDto } from './dto/upload-documento.dto';

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
  bandeiraTarifaria: 'VERDE' | 'AMARELA' | 'VERMELHA_1' | 'VERMELHA_2';
  possuiCompensacao: boolean;
  creditosRecebidosKwh: number;
  saldoTotalKwh: number;
  participacaoSaldo: number;
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
  private supabase: SupabaseClient;

  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
  ) {
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

    // 2. Buscar threshold
    const configThreshold = await this.prisma.configTenant.findUnique({
      where: { chave: 'threshold_meses_atipicos' },
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

  async findByCooperado(cooperadoId: string) {
    return this.prisma.faturaProcessada.findMany({
      where: { cooperadoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async aprovarFatura(id: string): Promise<{ sucesso: boolean }> {
    await this.prisma.faturaProcessada.update({
      where: { id },
      data: { status: 'APROVADA' },
    });
    return { sucesso: true };
  }

  // Diagnóstico: verifica tabelas e bucket
  async diagnostico(): Promise<Record<string, unknown>> {
    const resultado: Record<string, unknown> = {};

    try {
      await this.prisma.configTenant.findFirst();
      resultado['config_tenant'] = 'OK';
    } catch (e) {
      resultado['config_tenant'] = `ERRO: ${(e as Error).message}`;
    }

    try {
      await this.prisma.faturaProcessada.findFirst();
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
  "documento": "CPF ou CNPJ do titular (apenas números)",
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
  "bandeiraTarifaria": "VERDE ou AMARELA ou VERMELHA_1 ou VERMELHA_2",
  "possuiCompensacao": false,
  "creditosRecebidosKwh": 0,
  "saldoTotalKwh": 0,
  "participacaoSaldo": 0,
  "historicoConsumo": [
    {"mesAno": "MM/AAAA", "consumoKwh": 0, "valorRS": 0.00}
  ]
}

IMPORTANTE: historicoConsumo deve conter APENAS os meses anteriores ao mês de referência desta fatura (não inclua o mês atual). Se algum campo não estiver disponível, use string vazia ou zero.`;

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
}
