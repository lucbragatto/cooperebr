import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FaturasService } from '../faturas/faturas.service';
import { MotorPropostaService } from '../motor-proposta/motor-proposta.service';
import { ConfigTenantService } from '../config-tenant/config-tenant.service';

interface ProcessarFaturaWhatsAppDto {
  arquivoBase64: string;
  tipoArquivo: 'pdf' | 'imagem';
  telefone: string;
  cooperativaId: string;
}

export interface ResultadoWhatsApp {
  sucesso: boolean;
  mensagemWhatsApp: string;
  propostaId?: string;
  dadosExtraidos?: Record<string, unknown>;
}

@Injectable()
export class WhatsappFaturaService {
  constructor(
    private prisma: PrismaService,
    private faturasService: FaturasService,
    private motorPropostaService: MotorPropostaService,
    private configTenant: ConfigTenantService,
  ) {}

  async processarFatura(dto: ProcessarFaturaWhatsAppDto): Promise<ResultadoWhatsApp> {
    // 1. Extrair dados via OCR
    let dadosExtraidos: Record<string, unknown>;
    try {
      dadosExtraidos = await this.faturasService.extrairOcr(dto.arquivoBase64, dto.tipoArquivo) as unknown as Record<string, unknown>;
    } catch {
      return {
        sucesso: false,
        mensagemWhatsApp: 'Não consegui identificar os dados da sua fatura. Por favor, envie uma foto mais nítida ou o PDF da fatura de energia.',
      };
    }

    // 2. Validar dados mínimos
    const titular = String(dadosExtraidos.titular ?? '');
    const consumoAtualKwh = Number(dadosExtraidos.consumoAtualKwh ?? 0);
    const distribuidora = String(dadosExtraidos.distribuidora ?? '');
    const historicoConsumo = (dadosExtraidos.historicoConsumo as Array<{ mesAno: string; consumoKwh: number; valorRS: number }>) ?? [];

    if (!titular && consumoAtualKwh <= 0 && !distribuidora) {
      return {
        sucesso: false,
        mensagemWhatsApp: 'O arquivo enviado não parece ser uma fatura de energia. Por favor, envie a fatura da concessionária (PDF ou foto legível).',
      };
    }

    // 3. Calcular consumo médio
    const kwhs = historicoConsumo.map(h => h.consumoKwh).filter(v => v > 0);
    const kwhMedio = kwhs.length > 0 ? kwhs.reduce((a, b) => a + b, 0) / kwhs.length : consumoAtualKwh;
    const valores = historicoConsumo.map(h => h.valorRS).filter(v => v > 0);
    const valorMedio = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : Number(dadosExtraidos.totalAPagar ?? 0);

    // 4. Determinar tipo de fornecimento e mínimo faturável
    const tipoFornecimento = String(dadosExtraidos.tipoFornecimento ?? 'TRIFASICO');
    const minimoAtivo = (await this.configTenant.get('minimo_faturavel_ativo', dto.cooperativaId)) === 'true';
    let minimoFaturavel = 0;
    if (minimoAtivo) {
      const chaveMinimo: Record<string, string> = {
        MONOFASICO: 'minimo_monofasico',
        BIFASICO: 'minimo_bifasico',
        TRIFASICO: 'minimo_trifasico',
      };
      const chave = chaveMinimo[tipoFornecimento];
      if (chave) {
        const val = await this.configTenant.get(chave, dto.cooperativaId);
        minimoFaturavel = val ? Number(val) : 0;
      }
    }

    // 5. Buscar plano padrão (configurável via ConfigTenant ou menor desconto)
    const planoPadraoId = await this.configTenant.get('plano_padrao_whatsapp', dto.cooperativaId);
    let plano = planoPadraoId
      ? await this.prisma.plano.findFirst({ where: { id: planoPadraoId, ativo: true } })
      : null;
    if (!plano) {
      plano = await this.prisma.plano.findFirst({ where: { ativo: true }, orderBy: { descontoBase: 'asc' } });
    }

    // 6. Buscar ou criar lead por telefone
    const telefoneNormalizado = dto.telefone.replace(/\D/g, '');
    let cooperado = await this.prisma.cooperado.findFirst({
      where: { telefone: { contains: telefoneNormalizado.slice(-8) } },
    });
    if (!cooperado) {
      cooperado = await this.prisma.cooperado.create({
        data: {
          nomeCompleto: titular || `Lead WhatsApp ${telefoneNormalizado}`,
          cpf: '',
          email: '',
          telefone: telefoneNormalizado,
          status: 'PENDENTE' as any,
          tipoCooperado: 'COM_UC' as any,
        },
      });
    }

    // 7. Calcular proposta
    let resultado;
    try {
      const calcResult = await this.motorPropostaService.calcular({
        cooperadoId: cooperado.id,
        historico: historicoConsumo.map(h => ({ mesAno: h.mesAno, consumoKwh: h.consumoKwh, valorRS: h.valorRS })),
        kwhMesRecente: consumoAtualKwh || kwhMedio,
        valorMesRecente: Number(dadosExtraidos.totalAPagar ?? valorMedio),
        mesReferencia: String(dadosExtraidos.mesReferencia ?? ''),
        tipoFornecimento: tipoFornecimento as 'MONOFASICO' | 'BIFASICO' | 'TRIFASICO',
      });
      resultado = calcResult.resultado;
    } catch {
      return {
        sucesso: false,
        mensagemWhatsApp: 'Houve um erro ao calcular sua proposta. Por favor, tente novamente ou entre em contato conosco.',
        dadosExtraidos,
      };
    }

    if (!resultado) {
      return {
        sucesso: false,
        mensagemWhatsApp: 'Não foi possível gerar uma proposta com os dados extraídos. Por favor, envie outra fatura ou entre em contato.',
        dadosExtraidos,
      };
    }

    // 8. Formatar valores
    const numeroUC = String(dadosExtraidos.numeroUC ?? '—');
    const descontoPercentual = resultado.descontoPercentual;
    const valorFaturaMedia = valorMedio;
    const valorComDesconto = valorFaturaMedia * (1 - descontoPercentual / 100);
    const economiaMensal = resultado.economiaMensal;
    const economia5anos = economiaMensal * 60;
    const consumoConsiderado = resultado.consumoConsiderado ?? Math.max(0, kwhMedio - minimoFaturavel);

    const tipoLabel: Record<string, string> = { MONOFASICO: 'Monofásico', BIFASICO: 'Bifásico', TRIFASICO: 'Trifásico' };

    // 9. Calcular meses de economia
    const mesesEconomia = valorFaturaMedia > 0
      ? Math.round(economia5anos / valorFaturaMedia * 10) / 10
      : 0;

    // 10. Montar mensagem WhatsApp
    const linhas: string[] = [
      '*Analisei sua fatura* ✅',
      '',
      `*Distribuidora:* ${distribuidora}`,
      `*UC:* ${numeroUC}`,
      `*Consumo médio real:* ${Math.round(kwhMedio).toLocaleString('pt-BR')} kWh/mês`,
    ];

    if (minimoAtivo && minimoFaturavel > 0) {
      linhas.push(`*Consumo considerado (desc. mínimo ${(tipoLabel[tipoFornecimento] ?? tipoFornecimento).toLowerCase()}):* ${Math.round(consumoConsiderado).toLocaleString('pt-BR')} kWh/mês`);
    }

    linhas.push(
      `*Tipo:* ${tipoLabel[tipoFornecimento] ?? tipoFornecimento}`,
      '',
      `*Sua fatura média atual:* R$ ${valorFaturaMedia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês`,
      `*Com CoopereBR (${descontoPercentual.toFixed(0)}% desc.):* R$ ${valorComDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês`,
      '',
      `💰 *Economia mensal:* R$ ${economiaMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `💰 *Economia em 5 anos:* R$ ${economia5anos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    );

    if (mesesEconomia > 0) {
      linhas.push(`📅 *Equivale a:* ${mesesEconomia.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} meses de energia grátis em 5 anos`);
    }

    linhas.push(
      '',
      'Para receber a proposta completa e iniciar seu cadastro, responda *SIM*.',
    );

    return {
      sucesso: true,
      mensagemWhatsApp: linhas.join('\n'),
      dadosExtraidos,
    };
  }
}
