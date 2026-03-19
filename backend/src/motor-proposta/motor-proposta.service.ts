import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CooperadosService } from '../cooperados/cooperados.service';
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
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
    private cooperadosService: CooperadosService,
  ) {}

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

    // Média cooperativa: média do (valorLiquido / kwhContrato) das cobranças de contratos ativos
    const cobrancasAtivas = await this.prisma.cobranca.findMany({
      where: { contrato: { status: 'ATIVO' }, status: { not: 'CANCELADO' } },
      select: { valorLiquido: true, contrato: { select: { kwhContrato: true } } },
    });
    const taxas = cobrancasAtivas
      .filter(c => Number(c.contrato.kwhContrato ?? 0) > 0)
      .map(c => Number(c.valorLiquido) / Number(c.contrato.kwhContrato));
    const mediaCooperativaKwh = taxas.length > 0 ? taxas.reduce((a, b) => a + b, 0) / taxas.length : 0;

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
      const kwhBase = base === 'MES_RECENTE' ? kwhMesRecente : kwhMedio12m;
      const valorBase = base === 'MES_RECENTE' ? valorMesRecente : valorMedio12m;
      // kwhApuradoBase = preço por kWh (R$/kWh) = valorFatura / consumoKwh
      const kwhApuradoBase = kwhBase > 0 ? valorBase / kwhBase : 0;
      let descontoPercentual = Number(config.descontoPadrao);
      const descontoMax = Number(config.descontoMaximo);

      let descontoAbsoluto = tarifaUnitSemTrib * (descontoPercentual / 100);
      let valorCooperado = kwhApuradoBase - descontoAbsoluto;

      // Ajustar desconto se resultado acima da média cooperativa
      if (config.acaoResultadoAcima === 'AUMENTAR_DESCONTO' && mediaCooperativaKwh > 0 && valorCooperado > mediaCooperativaKwh) {
        const descontoNecessario = ((kwhApuradoBase - mediaCooperativaKwh) / tarifaUnitSemTrib) * 100;
        descontoPercentual = Math.min(descontoNecessario, descontoMax);
        descontoAbsoluto = tarifaUnitSemTrib * (descontoPercentual / 100);
        valorCooperado = kwhApuradoBase - descontoAbsoluto;
      }

      const kwhContrato = kwhBase; // quantidade de kWh
      const economiaAbsoluta = descontoAbsoluto;
      const economiaPercentual = kwhApuradoBase > 0 ? (descontoAbsoluto / kwhApuradoBase) * 100 : 0;
      const economiaMensal = descontoAbsoluto * kwhContrato;
      const economiaAnual = economiaMensal * 12;
      const mesesEquivalentes = valorBase > 0 ? economiaAnual / valorBase : 0;

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

    // Se já existe proposta aceita para mesmo cooperado/mês, cancela a anterior
    const propostasAnteriores = await this.prisma.propostaCooperado.findMany({
      where: {
        cooperadoId: dto.cooperadoId,
        mesReferencia: dto.mesReferencia,
        status: 'ACEITA',
      },
    });
    for (const pa of propostasAnteriores) {
      await this.prisma.propostaCooperado.update({
        where: { id: pa.id },
        data: { status: 'CANCELADA' },
      });
    }

    const r = dto.resultado;
    const validaAte = new Date();
    validaAte.setDate(validaAte.getDate() + 30);

    // 1. Gravar proposta
    const proposta = await this.prisma.propostaCooperado.create({
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
      include: { cooperado: { select: { nomeCompleto: true } } },
    });

    const nomeCooperado = (proposta as any).cooperado?.nomeCompleto ?? dto.cooperadoId;

    // 2. Resolver planoId
    let planoId: string | null = dto.planoId ?? null;
    if (!planoId) {
      const primeiroPlano = await this.prisma.plano.findFirst({ where: { ativo: true } });
      planoId = primeiroPlano?.id ?? null;
    }

    // 3. Buscar primeira UC do cooperado
    const primeiraUC = await this.prisma.uc.findFirst({ where: { cooperadoId: dto.cooperadoId } });
    if (!primeiraUC) {
      return { proposta, contrato: null, emListaEspera: false, aviso: 'Sem UC vinculada — contrato não criado automaticamente.' };
    }

    // 4. Buscar usina com capacidade disponível
    const usinas = await this.prisma.usina.findMany({
      where: { capacidadeKwh: { not: null } },
      include: {
        contratos: {
          where: { status: 'ATIVO' },
          select: { kwhContrato: true },
        },
      },
    });

    let usinaComVaga: { id: string } | null = null;
    for (const usina of usinas) {
      const kwhUsado = usina.contratos.reduce((acc, c) => acc + Number(c.kwhContrato ?? 0), 0);
      const kwhDisponivel = Number(usina.capacidadeKwh) - kwhUsado;
      if (kwhDisponivel >= r.kwhContrato) {
        usinaComVaga = usina;
        break;
      }
    }

    // 5. Gerar número do contrato
    const ano = new Date().getFullYear();
    const lastContrato = await this.prisma.contrato.findFirst({
      where: { numero: { startsWith: `CTR-${ano}-` } },
      orderBy: { numero: 'desc' },
    });
    const seq = lastContrato ? parseInt(lastContrato.numero.split('-')[2] ?? '0', 10) + 1 : 1;
    const numero = `CTR-${ano}-${String(seq).padStart(4, '0')}`;

    // 6. Criar contrato
    const statusContrato = usinaComVaga ? 'ATIVO' : 'LISTA_ESPERA';
    const contrato = await this.prisma.contrato.create({
      data: {
        numero,
        cooperadoId: dto.cooperadoId,
        planoId,
        ucId: primeiraUC.id,
        usinaId: usinaComVaga?.id ?? null,
        dataInicio: new Date(),
        percentualDesconto: r.descontoPercentual,
        kwhContrato: r.kwhContrato,
        status: statusContrato as any,
      },
    });

    // 7. Se lista de espera, criar entrada + notificação
    if (statusContrato === 'LISTA_ESPERA') {
      const posicao = await this.prisma.listaEspera.count({ where: { status: 'AGUARDANDO' } });
      await this.prisma.listaEspera.create({
        data: {
          cooperadoId: dto.cooperadoId,
          contratoId: contrato.id,
          kwhNecessario: r.kwhContrato,
          posicao: posicao + 1,
          status: 'AGUARDANDO',
        },
      });
      await this.notificacoes.criar({
        tipo: 'LISTA_ESPERA',
        titulo: 'Cooperado em lista de espera',
        mensagem: `${nomeCooperado} aguarda vaga em usina. kWh necessário: ${r.kwhContrato}`,
        cooperadoId: dto.cooperadoId,
        link: `/dashboard/motor-proposta/lista-espera`,
      });
    } else {
      await this.notificacoes.criar({
        tipo: 'CONTRATO_CRIADO',
        titulo: 'Novo contrato criado',
        mensagem: `Contrato ${numero} criado para ${nomeCooperado}`,
        cooperadoId: dto.cooperadoId,
        link: `/dashboard/cooperados/${dto.cooperadoId}`,
      });
    }

    await this.cooperadosService.checkProntoParaAtivar(dto.cooperadoId);

    return { proposta, contrato, emListaEspera: statusContrato === 'LISTA_ESPERA' };
  }

  async excluirProposta(propostaId: string) {
    const proposta = await this.prisma.propostaCooperado.findUnique({ where: { id: propostaId } });
    if (!proposta) throw new Error('Proposta não encontrada');

    // Se a proposta estava ACEITA, cancelar contrato associado (mesmo cooperado/mês)
    if (proposta.status === 'ACEITA') {
      const contratos = await this.prisma.contrato.findMany({
        where: {
          cooperadoId: proposta.cooperadoId,
          createdAt: { gte: new Date(proposta.createdAt.getTime() - 60000) },
        },
      });
      for (const c of contratos) {
        await this.prisma.contrato.update({
          where: { id: c.id },
          data: { status: 'ENCERRADO' },
        });
        // Remover da lista de espera se houver
        await this.prisma.listaEspera.deleteMany({ where: { contratoId: c.id } });
      }
    }

    await this.prisma.propostaCooperado.delete({ where: { id: propostaId } });
    return { sucesso: true };
  }

  async editarProposta(propostaId: string, data: Partial<{
    status: string;
    descontoPercentual: number;
    kwhContrato: number;
    planoId: string;
  }>) {
    const proposta = await this.prisma.propostaCooperado.findUnique({ where: { id: propostaId } });
    if (!proposta) throw new Error('Proposta não encontrada');
    return this.prisma.propostaCooperado.update({
      where: { id: propostaId },
      data: data as any,
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

  async getListaEspera() {
    return this.prisma.listaEspera.findMany({
      where: { status: 'AGUARDANDO' },
      orderBy: { posicao: 'asc' },
      include: {
        cooperado: { select: { id: true, nomeCompleto: true, email: true } },
        contrato: { select: { numero: true, status: true } },
      },
    });
  }

  async alocarListaEspera(listaEsperaId: string, usinaId: string) {
    const entrada = await this.prisma.listaEspera.findUnique({
      where: { id: listaEsperaId },
      include: {
        contrato: { select: { numero: true } },
        cooperado: { select: { nomeCompleto: true } },
      },
    });
    if (!entrada) throw new Error('Entrada não encontrada na lista de espera.');
    if (!entrada.contratoId) throw new Error('Entrada sem contrato associado.');

    await this.prisma.contrato.update({
      where: { id: entrada.contratoId },
      data: { usinaId, status: 'ATIVO' },
    });
    await this.prisma.listaEspera.update({
      where: { id: listaEsperaId },
      data: { status: 'ALOCADO' },
    });
    await this.notificacoes.criar({
      tipo: 'CONTRATO_ATIVADO',
      titulo: 'Cooperado alocado em usina',
      mensagem: `Contrato ${entrada.contrato?.numero} ativado para ${entrada.cooperado.nomeCompleto}`,
      cooperadoId: entrada.cooperadoId,
      link: `/dashboard/cooperados/${entrada.cooperadoId}`,
    });
    return { sucesso: true };
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
