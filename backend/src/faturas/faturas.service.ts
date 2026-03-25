import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TipoDocumento, ModeloCobranca } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { ConfigTenantService } from '../config-tenant/config-tenant.service';
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
    private configTenant: ConfigTenantService,
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

  async extrairOcr(arquivoBase64: string, tipoArquivo: 'pdf' | 'imagem'): Promise<DadosExtraidos> {
    return this.extrairDadosFatura(arquivoBase64, tipoArquivo);
  }

  async findByCooperado(cooperadoId: string) {
    return this.prisma.faturaProcessada.findMany({
      where: { cooperadoId },
      orderBy: { createdAt: 'desc' },
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

    await this.prisma.faturaProcessada.update({
      where: { id },
      data: { status: 'APROVADA' },
    });

    // Auto-gerar cobranças para contratos ativos do cooperado
    const avisos: string[] = [];
    let cobrancasCriadas = 0;

    const contratos = await this.prisma.contrato.findMany({
      where: { cooperadoId: fatura.cooperadoId, status: 'ATIVO' },
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
      where: { cooperadoId: fatura.cooperadoId, status: 'ACEITA' },
      orderBy: { createdAt: 'desc' },
    });

    // Buscar tarifa vigente (usada no fallback e no CREDITOS_DINAMICO)
    const tarifaVigente = await this.prisma.tarifaConcessionaria.findFirst({
      orderBy: { dataVigencia: 'desc' },
    });
    const tusdVigente = tarifaVigente ? Number(tarifaVigente.tusdNova) : 0.3;
    const teVigente = tarifaVigente ? Number(tarifaVigente.teNova) : 0.2;
    const tarifaUnitVigente = tusdVigente + teVigente;

    if (!propostaAceita) {
      avisos.push('Sem proposta aceita encontrada. Cálculo usando tarifa vigente (TUSD+TE) como fallback.');
    }

    // Buscar dias de vencimento configurado
    const diasVencimentoStr = await this.configTenant.get('dias_vencimento_cobranca');
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
      const modeloCobranca = await this.resolverModeloCobranca(contrato, contrato.usina);

      // tarifaKwh = preço do kWh da concessionária (da proposta aceita ou fallback)
      let tarifaKwh: number;
      if (propostaAceita) {
        tarifaKwh = Number(propostaAceita.kwhApuradoBase);
      } else {
        // Fallback: calcula a partir da fatura ou usa tarifa vigente
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

      await this.prisma.cobranca.create({
        data: {
          contratoId: contrato.id,
          mesReferencia,
          anoReferencia,
          valorBruto,
          percentualDesconto,
          valorDesconto,
          valorLiquido,
          dataVencimento: vencimento,
          status: 'PENDENTE',
        },
      });

      cobrancasCriadas++;
      avisos.push(`Contrato ${contrato.numero}: modelo ${modeloUsado}`);

      const economia = valorDesconto.toFixed(2);
      await this.notificacoes.criar({
        tipo: 'COBRANCA_GERADA',
        titulo: 'Nova cobrança gerada',
        mensagem: `Cobrança de R$ ${valorLiquido.toFixed(2)} gerada para contrato ${contrato.numero} ref. ${mesRef}. Você economizou R$ ${economia} este mês.`,
        cooperadoId: fatura.cooperadoId,
        link: `/dashboard/cobrancas`,
      });
    }

    if (cobrancasCriadas > 0) {
      avisos.push(`${cobrancasCriadas} cobrança(s) gerada(s) com sucesso.`);
    }

    return { sucesso: true, cobrancasCriadas, avisos };
  }

  async deletarFatura(id: string): Promise<{ sucesso: boolean }> {
    await this.prisma.faturaProcessada.delete({ where: { id } });
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
  "historicoConsumo": [
    {"mesAno": "MM/AAAA", "consumoKwh": 0, "valorRS": 0.00}
  ]
}

IMPORTANTE:
- historicoConsumo deve conter APENAS os meses anteriores ao mês de referência desta fatura (não inclua o mês atual).
- Para cada mês do histórico, extraia o valor total da conta em reais (campo valorRS). Este histórico normalmente aparece como gráfico ou tabela no verso ou rodapé da fatura. O valorRS deve ser o valor total da fatura daquele mês (não apenas energia, mas o total pago incluindo todos os encargos e impostos). Se não disponível na fatura, usar 0.
- valorBandeira: adicional R$/kWh da bandeira tarifária (se verde, 0).
- contribIluminacaoPublica: valor fixo mensal em R$ da CIP/COSIP.
- icmsPercentual: alíquota do ICMS em % (ex: 25 para 25%). Procure na seção TRIBUTOS da fatura. No ES é tipicamente 25%, no RJ 18%, em SP 12%. Se não encontrar o percentual explícito mas encontrar o valor R$ do ICMS e a base de cálculo, calcule: (valorICMS / baseCalculo) * 100. NÃO retorne 0 se houver valor de ICMS na fatura. icmsValor: valor R$ do ICMS.
- pisCofinsPercentual: some os percentuais de PIS e COFINS. PIS varia de 0,65% a 1,26% e COFINS de 3% a 5,81%. Na EDP-ES tipicamente PIS=1,26% e COFINS=5,81% totalizando 7,07%. Procure na tabela de tributos os valores de PIS e COFINS separados e some. Se encontrar apenas o valor em R$ (ex: PIS R$0,78 e COFINS R$3,19), calcule o percentual: ((PIS_RS + COFINS_RS) / baseCalculo) * 100. pisCofinsValor: valor R$ do PIS/COFINS.
- multaJuros: valor R$ de multa/juros por atraso (0 se não houver).
- descontos: valor R$ de descontos da concessionária (devolução, crédito, etc). Sempre positivo.
- outrosEncargos: valor R$ de demais encargos não classificados acima.
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

  private async resolverModeloCobranca(
    contrato: { modeloCobrancaOverride?: ModeloCobranca | null; plano?: { modeloCobranca: ModeloCobranca } | null },
    usina: { modeloCobrancaOverride?: ModeloCobranca | null } | null,
  ): Promise<ModeloCobranca> {
    // 1. Override do contrato (maior prioridade)
    if (contrato.modeloCobrancaOverride) return contrato.modeloCobrancaOverride;

    // 2. Override da usina
    if (usina?.modeloCobrancaOverride) return usina.modeloCobrancaOverride;

    // 3. ConfigTenant global
    const configPadrao = await this.configTenant.get('modelo_cobranca_padrao');
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
}
