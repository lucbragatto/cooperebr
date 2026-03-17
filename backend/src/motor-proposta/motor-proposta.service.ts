import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import type { CalcularPropostaDto } from './dto/calcular-proposta.dto';
import type { ConfiguracaoMotorDto } from './dto/configuracao-motor.dto';
import type { TarifaConcessionariaDto } from './dto/tarifa-concessionaria.dto';
import type { SimularReajusteDto } from './dto/simular-reajuste.dto';

export interface OpcaoCalculo {
  base: 'MES_RECENTE' | 'MEDIA_12M';
  label: string;
  kwhApuradoBase: number;
  descontoPercentual: number;
  descontoAbsoluto: number;
  kwhContrato: number;
  valorCooperado: number;
  economiaAbsoluta: number;
  economiaPercentual: number;
  economiaMensal: number;
  economiaAnual: number;
  mesesEquivalentes: number;
}

export interface ResultadoCalculo {
  opcoes?: OpcaoCalculo[];
  outlierDetectado: boolean;
  aguardandoEscolha?: boolean;
  resultado?: OpcaoCalculo & {
    tarifaUnitSemTrib: number;
    tusdUtilizada: number;
    teUtilizada: number;
    kwhMesRecente: number;
    valorMesRecente: number;
    kwhMedio12m: number;
    valorMedio12m: number;
    mediaCooperativaKwh: number;
    resultadoVsMedia: number;
    mesReferencia: string;
  };
}

@Injectable()
export class MotorPropostaService {
  constructor(private prisma: PrismaService) {}

  async getConfiguracao() {
    let config = await this.prisma.configuracaoMotor.findFirst();
    if (!config) {
      config = await this.prisma.configuracaoMotor.create({ data: {} });
    }
    return config;
  }

  async updateConfiguracao(dto: ConfiguracaoMotorDto) {
    let config = await this.prisma.configuracaoMotor.findFirst();
    if (!config) {
      return this.prisma.configuracaoMotor.create({ data: dto as any });
    }
    return this.prisma.configuracaoMotor.update({ where: { id: config.id }, data: dto as any });
  }

  async calcular(dto: CalcularPropostaDto): Promise<ResultadoCalculo> {
    const config = await this.getConfiguracao();

    // Tarifa mais recente
    const tarifa = await this.prisma.tarifaConcessionaria.findFirst({
      orderBy: { dataVigencia: 'desc' },
    });
    const tusd = tarifa ? Number(tarifa.tusdNova) : 0.3;
    const te = tarifa ? Number(tarifa.teNova) : 0.2;
    const tarifaUnitSemTrib = tusd + te;

    // Média cooperativa: média dos cotaKwhMensal dos cooperados ativos
    const cooperadosAtivos = await this.prisma.cooperado.findMany({
      where: { status: 'ATIVO' },
      select: { cotaKwhMensal: true },
    });
    const cotas = cooperadosAtivos.map(c => Number(c.cotaKwhMensal ?? 0)).filter(v => v > 0);
    const mediaCooperativaKwh = cotas.length > 0 ? cotas.reduce((a, b) => a + b, 0) / cotas.length : 0;

    // Dados do histórico
    const historico = dto.historico ?? [];
    const kwhMesRecente = Number(dto.kwhMesRecente);
    const valorMesRecente = Number(dto.valorMesRecente);

    const kwhs = historico.map(h => Number(h.consumoKwh)).filter(v => v > 0);
    const valores = historico.map(h => Number(h.valorRS)).filter(v => v > 0);
    const kwhMedio12m = kwhs.length > 0 ? kwhs.reduce((a, b) => a + b, 0) / kwhs.length : kwhMesRecente;
    const valorMedio12m = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : valorMesRecente;

    const threshold = Number(config.thresholdOutlier);
    const outlierDetectado = kwhMesRecente > kwhMedio12m * threshold;

    // Função de cálculo de uma opção
    const calcularOpcao = (base: 'MES_RECENTE' | 'MEDIA_12M'): OpcaoCalculo => {
      const kwhApuradoBase = base === 'MES_RECENTE' ? kwhMesRecente : kwhMedio12m;
      let descontoPercentual = Number(config.descontoPadrao);
      const descontoMax = Number(config.descontoMaximo);

      let descontoAbsoluto = tarifaUnitSemTrib * (descontoPercentual / 100);
      let valorCooperado = tarifaUnitSemTrib - descontoAbsoluto;

      // Ajustar desconto se resultado acima da média cooperativa
      if (config.acaoResultadoAcima === 'AUMENTAR_DESCONTO' && valorCooperado > mediaCooperativaKwh && mediaCooperativaKwh > 0) {
        const descontoNecessario = ((tarifaUnitSemTrib - mediaCooperativaKwh) / tarifaUnitSemTrib) * 100;
        descontoPercentual = Math.min(descontoNecessario, descontoMax);
        descontoAbsoluto = tarifaUnitSemTrib * (descontoPercentual / 100);
        valorCooperado = tarifaUnitSemTrib - descontoAbsoluto;
      }

      const kwhContrato = kwhApuradoBase;
      const economiaAbsoluta = descontoAbsoluto;
      const economiaPercentual = descontoPercentual;
      const economiaMensal = descontoAbsoluto * kwhContrato;
      const economiaAnual = economiaMensal * 12;
      const mesesEquivalentes = tarifaUnitSemTrib > 0 ? economiaAnual / (tarifaUnitSemTrib * kwhContrato) : 0;

      return {
        base,
        label: base === 'MES_RECENTE' ? 'Baseado no mês atual' : 'Baseado na média histórica (12 meses)',
        kwhApuradoBase: round5(kwhApuradoBase),
        descontoPercentual: round5(descontoPercentual),
        descontoAbsoluto: round5(descontoAbsoluto),
        kwhContrato: round5(kwhContrato),
        valorCooperado: round5(valorCooperado),
        economiaAbsoluta: round5(economiaAbsoluta),
        economiaPercentual: round5(economiaPercentual),
        economiaMensal: round5(economiaMensal),
        economiaAnual: round5(economiaAnual),
        mesesEquivalentes: round5(mesesEquivalentes),
      };
    };

    // Se outlier e configurado para oferecer opção e ainda não escolheu
    if (outlierDetectado && config.acaoOutlier === 'OFERECER_OPCAO' && !dto.opcaoEscolhida) {
      return {
        outlierDetectado: true,
        aguardandoEscolha: true,
        opcoes: [calcularOpcao('MES_RECENTE'), calcularOpcao('MEDIA_12M')],
      };
    }

    // Definir base
    let base: 'MES_RECENTE' | 'MEDIA_12M';
    if (dto.opcaoEscolhida) {
      base = dto.opcaoEscolhida;
    } else if (outlierDetectado && config.acaoOutlier === 'MAIOR_RETORNO') {
      const opcaoRecente = calcularOpcao('MES_RECENTE');
      const opcaoMedia = calcularOpcao('MEDIA_12M');
      base = opcaoRecente.economiaMensal >= opcaoMedia.economiaMensal ? 'MES_RECENTE' : 'MEDIA_12M';
    } else {
      base = config.fonteKwh === 'MEDIA_12M' ? 'MEDIA_12M' : 'MES_RECENTE';
    }

    const opcao = calcularOpcao(base);
    const resultadoVsMedia = mediaCooperativaKwh > 0 ? ((opcao.valorCooperado - mediaCooperativaKwh) / mediaCooperativaKwh) * 100 : 0;

    return {
      outlierDetectado,
      resultado: {
        ...opcao,
        tarifaUnitSemTrib: round5(tarifaUnitSemTrib),
        tusdUtilizada: round5(tusd),
        teUtilizada: round5(te),
        kwhMesRecente: round5(kwhMesRecente),
        valorMesRecente: round5(valorMesRecente),
        kwhMedio12m: round5(kwhMedio12m),
        valorMedio12m: round5(valorMedio12m),
        mediaCooperativaKwh: round5(mediaCooperativaKwh),
        resultadoVsMedia: round5(resultadoVsMedia),
        mesReferencia: dto.mesReferencia,
      },
    };
  }

  async confirmarOpcao(dto: CalcularPropostaDto) {
    return this.calcular(dto);
  }

  async aceitar(dto: {
    cooperadoId: string;
    resultado: ResultadoCalculo['resultado'];
    mesReferencia: string;
    planoId?: string;
  }) {
    if (!dto.resultado) throw new Error('Resultado inválido');
    const r = dto.resultado;
    const validaAte = new Date();
    validaAte.setDate(validaAte.getDate() + 30);

    return this.prisma.propostaCooperado.create({
      data: {
        cooperadoId: dto.cooperadoId,
        mesReferencia: dto.mesReferencia ?? r.mesReferencia,
        kwhMesRecente: r.kwhMesRecente,
        valorMesRecente: r.valorMesRecente,
        kwhMedio12m: r.kwhMedio12m,
        valorMedio12m: r.valorMedio12m,
        outlierDetectado: false,
        tusdUtilizada: r.tusdUtilizada,
        teUtilizada: r.teUtilizada,
        tarifaUnitSemTrib: r.tarifaUnitSemTrib,
        kwhApuradoBase: r.kwhApuradoBase,
        baseUtilizada: r.base,
        descontoPercentual: r.descontoPercentual,
        descontoAbsoluto: r.descontoAbsoluto,
        kwhContrato: r.kwhContrato,
        valorCooperado: r.valorCooperado,
        economiaAbsoluta: r.economiaAbsoluta,
        economiaPercentual: r.economiaPercentual,
        economiaMensal: r.economiaMensal,
        economiaAnual: r.economiaAnual,
        mesesEquivalentes: r.mesesEquivalentes,
        mediaCooperativaKwh: r.mediaCooperativaKwh,
        resultadoVsMedia: r.resultadoVsMedia,
        opcaoEscolhida: r.base,
        status: 'ACEITA',
        planoId: dto.planoId ?? null,
        validaAte,
      },
    });
  }

  async historico(cooperadoId: string) {
    return this.prisma.propostaCooperado.findMany({
      where: { cooperadoId },
      orderBy: { createdAt: 'desc' },
      include: { plano: true },
    });
  }

  async criarTarifa(dto: TarifaConcessionariaDto) {
    return this.prisma.tarifaConcessionaria.create({
      data: {
        ...dto,
        dataVigencia: new Date(dto.dataVigencia),
      } as any,
    });
  }

  async tarifaAtual() {
    return this.prisma.tarifaConcessionaria.findFirst({
      orderBy: { dataVigencia: 'desc' },
    });
  }

  async listarTarifas() {
    return this.prisma.tarifaConcessionaria.findMany({
      orderBy: { dataVigencia: 'desc' },
    });
  }

  async atualizarTarifa(id: string, dto: TarifaConcessionariaDto) {
    return this.prisma.tarifaConcessionaria.update({
      where: { id },
      data: { ...dto, dataVigencia: new Date(dto.dataVigencia) } as any,
    });
  }

  async excluirTarifa(id: string) {
    return this.prisma.tarifaConcessionaria.delete({ where: { id } });
  }

  async historicoReajustes() {
    return this.prisma.historicoReajuste.findMany({
      orderBy: { createdAt: 'desc' },
      include: { tarifa: true },
    });
  }

  async simularReajuste(dto: SimularReajusteDto) {
    const tarifa = await this.prisma.tarifaConcessionaria.findUnique({ where: { id: dto.tarifaId } });
    if (!tarifa) throw new Error('Tarifa não encontrada');

    const cooperados = await this.prisma.cooperado.findMany({
      where: { status: 'ATIVO' },
      select: { id: true, nomeCompleto: true, cotaKwhMensal: true },
    });

    const tarifaAntiga = Number(tarifa.tusdAnterior) + Number(tarifa.teAnterior);
    const tarifaNova = Number(tarifa.tusdNova) + Number(tarifa.teNova);
    const fatorReajuste = tarifaNova / (tarifaAntiga || 1);

    const afetados = cooperados.filter(c => Number(c.cotaKwhMensal ?? 0) > 0);
    const valorMedioAnterior = tarifaAntiga;
    const valorMedioNovo = tarifaNova;
    const impactoMensalTotal = afetados.reduce((acc, c) => acc + Number(c.cotaKwhMensal ?? 0) * (tarifaNova - tarifaAntiga), 0);

    return {
      cooperadosAfetados: afetados.length,
      valorMedioAnterior: round5(valorMedioAnterior),
      valorMedioNovo: round5(valorMedioNovo),
      fatorReajuste: round5(fatorReajuste),
      impactoMensalTotal: round5(impactoMensalTotal),
      percentualAplicado: Number(tarifa.percentualAplicado),
      contratos: afetados.map(c => ({
        cooperadoId: c.id,
        nome: c.nomeCompleto,
        kwhContrato: Number(c.cotaKwhMensal ?? 0),
        valorAnterior: round5(Number(c.cotaKwhMensal ?? 0) * tarifaAntiga),
        valorNovo: round5(Number(c.cotaKwhMensal ?? 0) * tarifaNova),
        impacto: round5(Number(c.cotaKwhMensal ?? 0) * (tarifaNova - tarifaAntiga)),
      })),
    };
  }

  async aplicarReajuste(dto: SimularReajusteDto) {
    const simulacao = await this.simularReajuste(dto);
    const tarifa = await this.prisma.tarifaConcessionaria.findUnique({ where: { id: dto.tarifaId } });
    if (!tarifa) throw new Error('Tarifa não encontrada');

    return this.prisma.historicoReajuste.create({
      data: {
        tarifaId: dto.tarifaId,
        dataAplicacao: new Date(),
        indiceUtilizado: dto.indiceUtilizado,
        percentualIndice: dto.percentualIndice,
        percentualAnunciado: tarifa.percentualAnunciado,
        percentualApurado: tarifa.percentualApurado,
        percentualAplicado: tarifa.percentualAplicado,
        diferencaConc: Number(tarifa.percentualApurado) - Number(tarifa.percentualAnunciado),
        cooperadosAfetados: simulacao.cooperadosAfetados,
        valorMedioAnterior: simulacao.valorMedioAnterior,
        valorMedioNovo: simulacao.valorMedioNovo,
        impactoMensalTotal: simulacao.impactoMensalTotal,
      },
    });
  }

  async dashboardStats() {
    const tarifa = await this.tarifaAtual();
    const propostas = await this.prisma.propostaCooperado.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { cooperado: { select: { nomeCompleto: true } }, plano: { select: { nome: true } } },
    });
    const pendentes = await this.prisma.propostaCooperado.count({ where: { status: 'PENDENTE' } });
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const aceitasNoMes = await this.prisma.propostaCooperado.count({
      where: { status: 'ACEITA', createdAt: { gte: inicioMes } },
    });
    const cooperadosAtivos = await this.prisma.cooperado.findMany({
      where: { status: 'ATIVO' },
      select: { cotaKwhMensal: true },
    });
    const cotas = cooperadosAtivos.map(c => Number(c.cotaKwhMensal ?? 0)).filter(v => v > 0);
    const mediaCooperativa = cotas.length > 0 ? cotas.reduce((a, b) => a + b, 0) / cotas.length : 0;

    return {
      mediaCooperativaKwh: round5(mediaCooperativa),
      propostasPendentes: pendentes,
      propostasAceitasNoMes: aceitasNoMes,
      tarifaVigente: tarifa ? round5(Number(tarifa.tusdNova) + Number(tarifa.teNova)) : null,
      ultimasPropostas: propostas,
    };
  }
}

function round5(v: number): number {
  return Math.round(v * 100000) / 100000;
}
