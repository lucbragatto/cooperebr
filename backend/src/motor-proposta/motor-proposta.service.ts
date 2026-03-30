import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CooperadosService } from '../cooperados/cooperados.service';
import { ContratosService } from '../contratos/contratos.service';
import { UsinasService } from '../usinas/usinas.service';
import { ConfigTenantService } from '../config-tenant/config-tenant.service';
import { CalcularPropostaDto } from './dto/calcular-proposta.dto';
import { ConfiguracaoMotorDto } from './dto/configuracao-motor.dto';
import { TarifaConcessionariaDto } from './dto/tarifa-concessionaria.dto';
import { SimularReajusteDto } from './dto/simular-reajuste.dto';

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
    consumoConsiderado?: number;
    minimoFaturavelDescontado?: number;
    tipoFornecimento?: string;
  };
}

@Injectable()
export class MotorPropostaService {
  constructor(
    private prisma: PrismaService,
    private notificacoes: NotificacoesService,
    private cooperadosService: CooperadosService,
    private contratosService: ContratosService,
    private usinasService: UsinasService,
    private configTenant: ConfigTenantService,
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

    // Mínimo faturável ANEEL
    const minimoAtivo = (await this.configTenant.get('minimo_faturavel_ativo')) === 'true';
    const tipoFornecimento = dto.tipoFornecimento ?? null;
    let minimoFaturavel = 0;
    if (minimoAtivo && tipoFornecimento) {
      const chaveMinimo: Record<string, string> = {
        MONOFASICO: 'minimo_monofasico',
        BIFASICO: 'minimo_bifasico',
        TRIFASICO: 'minimo_trifasico',
      };
      const chave = chaveMinimo[tipoFornecimento];
      if (chave) {
        const val = await this.configTenant.get(chave);
        minimoFaturavel = val ? Number(val) : 0;
      }
    }

    const threshold = Number(config.thresholdOutlier);
    const outlierDetectado = kwhMesRecente > kwhMedio12m * threshold;

    // Função de cálculo de uma opção
    const calcularOpcao = (base: 'MES_RECENTE' | 'MEDIA_12M'): OpcaoCalculo => {
      const kwhBase = base === 'MES_RECENTE' ? kwhMesRecente : kwhMedio12m;
      const valorBase = base === 'MES_RECENTE' ? valorMesRecente : valorMedio12m;
      // Aplicar mínimo faturável: consumoConsiderado = MAX(0, consumo - minimo)
      const consumoConsiderado = Math.max(0, kwhBase - minimoFaturavel);
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

      const kwhContrato = consumoConsiderado; // quantidade de kWh (após descontar mínimo faturável)
      const economiaAbsoluta = descontoAbsoluto;
      const economiaPercentual = kwhApuradoBase > 0 ? (descontoAbsoluto / kwhApuradoBase) * 100 : 0;
      // economiaMensal = valor da fatura × desconto%
      // Fallback: se tarifaUnitSemTrib=0 (sem tarifa cadastrada), usar valorBase diretamente
      const economiaMensal = tarifaUnitSemTrib > 0
        ? descontoAbsoluto * kwhContrato
        : valorBase * (descontoPercentual / 100);
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
        consumoConsiderado: round5(Math.max(0, (opcao.base === 'MES_RECENTE' ? kwhMesRecente : kwhMedio12m) - minimoFaturavel)),
        minimoFaturavelDescontado: minimoFaturavel,
        tipoFornecimento: tipoFornecimento ?? undefined,
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

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Cancelar propostas anteriores aceitas para mesmo cooperado/mês
      const propostasAnteriores = await tx.propostaCooperado.findMany({
        where: {
          cooperadoId: dto.cooperadoId,
          mesReferencia: dto.mesReferencia,
          status: 'ACEITA',
        },
      });
      for (const pa of propostasAnteriores) {
        await tx.propostaCooperado.update({
          where: { id: pa.id },
          data: { status: 'CANCELADA' },
        });
      }

      // 2. Gravar proposta
      const validaAte = new Date();
      validaAte.setDate(validaAte.getDate() + 30);

      const proposta = await tx.propostaCooperado.create({
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

      // 3. Resolver planoId
      let planoId: string | null = dto.planoId ?? null;
      if (!planoId) {
        const primeiroPlano = await tx.plano.findFirst({ where: { ativo: true } });
        planoId = primeiroPlano?.id ?? null;
      }

      // 4. Buscar UC do cooperado que NÃO tenha contrato vigente
      const ucsDoCooperado = await tx.uc.findMany({
        where: { cooperadoId: dto.cooperadoId },
        include: {
          contratos: {
            where: { status: { in: ['PENDENTE_ATIVACAO', 'ATIVO', 'LISTA_ESPERA'] } },
            select: { id: true },
          },
        },
      });
      const ucDisponivel = ucsDoCooperado.find(uc => uc.contratos.length === 0);
      if (ucsDoCooperado.length === 0) {
        return { proposta, contrato: null, emListaEspera: false, aviso: 'Sem UC vinculada — contrato não criado automaticamente.', nomeCooperado, numero: null };
      }
      if (!ucDisponivel) {
        return { proposta, contrato: null, emListaEspera: false, aviso: 'Todas as UCs deste cooperado já possuem contrato ativo. Cadastre uma nova UC para criar outro contrato.', nomeCooperado, numero: null };
      }

      // 5. Buscar usina com capacidade disponível (filtrando por distribuidora da UC — regra ANEEL)
      const whereUsina: any = { capacidadeKwh: { not: null } };
      if (ucDisponivel.distribuidora) {
        whereUsina.distribuidora = ucDisponivel.distribuidora;
      }
      const usinas = await tx.usina.findMany({
        where: whereUsina,
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

      // 7. Gerar número do contrato (centralizado, dentro da tx)
      const numero = await this.contratosService.gerarNumeroContrato(tx);

      // 8. Calcular percentualUsina
      let percentualUsina: number | null = null;
      if (usinaComVaga) {
        const capacidade = Number(
          (usinas.find(u => u.id === usinaComVaga!.id) as any)?.capacidadeKwh ?? 0,
        );
        if (capacidade > 0) {
          percentualUsina = Math.round((r.kwhContrato / capacidade) * 100 * 10000) / 10000;
        }
      }

      // 9. Criar contrato
      const statusContrato = usinaComVaga ? 'PENDENTE_ATIVACAO' : 'LISTA_ESPERA';
      const contrato = await tx.contrato.create({
        data: {
          numero,
          cooperadoId: dto.cooperadoId,
          planoId,
          ucId: ucDisponivel.id,
          usinaId: usinaComVaga?.id ?? null,
          propostaId: proposta.id,
          dataInicio: new Date(),
          percentualDesconto: r.descontoPercentual,
          kwhContrato: r.kwhContrato,
          percentualUsina,
          status: statusContrato as any,
        },
      });

      // 10. Se lista de espera, criar entrada
      if (statusContrato === 'LISTA_ESPERA') {
        const posicao = await tx.listaEspera.count({ where: { status: 'AGUARDANDO' } });
        await tx.listaEspera.create({
          data: {
            cooperadoId: dto.cooperadoId,
            contratoId: contrato.id,
            kwhNecessario: r.kwhContrato,
            posicao: posicao + 1,
            status: 'AGUARDANDO',
          },
        });
      }

      return { proposta, contrato, emListaEspera: statusContrato === 'LISTA_ESPERA', nomeCooperado, numero };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Notificações fora da transação (side effects não-críticos)
    if (result.contrato) {
      if (result.emListaEspera) {
        await this.notificacoes.criar({
          tipo: 'LISTA_ESPERA',
          titulo: 'Cooperado em lista de espera',
          mensagem: `${result.nomeCooperado} aguarda vaga em usina. kWh necessário: ${r.kwhContrato}`,
          cooperadoId: dto.cooperadoId,
          link: `/dashboard/motor-proposta/lista-espera`,
        });
      } else {
        await this.notificacoes.criar({
          tipo: 'CONTRATO_CRIADO',
          titulo: 'Contrato criado — pendente ativação',
          mensagem: `Contrato ${result.numero} criado para ${result.nomeCooperado}. Aguardando ativação do cooperado.`,
          cooperadoId: dto.cooperadoId,
          link: `/dashboard/cooperados/${dto.cooperadoId}`,
        });
      }
    }

    await this.cooperadosService.checkProntoParaAtivar(dto.cooperadoId);

    return {
      proposta: result.proposta,
      contrato: result.contrato,
      emListaEspera: result.emListaEspera,
      ...(result.contrato ? {} : { aviso: (result as any).aviso }),
    };
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

  async buscarProposta(id: string) {
    return this.prisma.propostaCooperado.findUnique({
      where: { id },
      include: { cooperado: true },
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

    // Buscar contratos ativos com kWhContratoMensal (fonte confiável de kWh)
    const contratos = await this.prisma.contrato.findMany({
      where: { status: 'ATIVO' },
      select: {
        id: true,
        cooperadoId: true,
        kwhContratoMensal: true,
        kwhContrato: true,
        cooperado: { select: { id: true, nomeCompleto: true, cotaKwhMensal: true } },
      },
    });

    const tarifaAntiga = Number(tarifa.tusdAnterior) + Number(tarifa.teAnterior);
    const tarifaNova = Number(tarifa.tusdNova) + Number(tarifa.teNova);
    const fatorReajuste = tarifaNova / (tarifaAntiga || 1);

    // kWh vem do contrato (kwhContratoMensal ou kwhContrato) ou do cooperado (cotaKwhMensal)
    const afetados = contratos
      .map(c => {
        const kwh = Number(c.kwhContratoMensal ?? 0) || Number(c.kwhContrato ?? 0) || Number(c.cooperado.cotaKwhMensal ?? 0);
        return { ...c, kwh };
      })
      .filter(c => c.kwh > 0);

    const impactoMensalTotal = afetados.reduce((acc, c) => acc + c.kwh * (tarifaNova - tarifaAntiga), 0);

    return {
      cooperadosAfetados: afetados.length,
      valorMedioAnterior: round5(tarifaAntiga),
      valorMedioNovo: round5(tarifaNova),
      fatorReajuste: round5(fatorReajuste),
      impactoMensalTotal: round5(impactoMensalTotal),
      percentualAplicado: Number(tarifa.percentualAplicado),
      contratos: afetados.map(c => ({
        cooperadoId: c.cooperado.id,
        nome: c.cooperado.nomeCompleto,
        kwhContrato: c.kwh,
        valorAnterior: round5(c.kwh * tarifaAntiga),
        valorNovo: round5(c.kwh * tarifaNova),
        impacto: round5(c.kwh * (tarifaNova - tarifaAntiga)),
      })),
    };
  }

  async aplicarReajuste(dto: SimularReajusteDto) {
    const simulacao = await this.simularReajuste(dto);
    const tarifa = await this.prisma.tarifaConcessionaria.findUnique({ where: { id: dto.tarifaId } });
    if (!tarifa) throw new Error('Tarifa não encontrada');

    // Marcar contratos dos cooperados afetados com data e índice do reajuste
    const indiceLabel = `${dto.indiceUtilizado} ${dto.percentualIndice}%`;
    const cooperadoIds = simulacao.contratos.map((c: any) => c.cooperadoId);
    if (cooperadoIds.length > 0) {
      await this.prisma.contrato.updateMany({
        where: {
          cooperadoId: { in: cooperadoIds },
          status: 'ATIVO',
        },
        data: {
          ultimoReajusteEm: new Date(),
          ultimoReajusteIndice: indiceLabel,
        },
      });
    }

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

  async getListaEspera(cooperativaId?: string) {
    return this.prisma.listaEspera.findMany({
      where: {
        status: 'AGUARDANDO',
        ...(cooperativaId ? { cooperativaId } : {}),
      },
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

    // Verificar se cooperado já está ATIVO para definir status do contrato
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: entrada.cooperadoId },
      select: { status: true },
    });
    const novoStatus = cooperado?.status === 'ATIVO' ? 'ATIVO' : 'PENDENTE_ATIVACAO';

    // Validar regra ANEEL: mesma distribuidora UC x Usina
    const contratoCompleto = await this.prisma.contrato.findUnique({ where: { id: entrada.contratoId } });
    if (contratoCompleto?.ucId) {
      await this.usinasService.validarCompatibilidadeAneel(contratoCompleto.ucId, usinaId);
    }

    const contratoId = entrada.contratoId!;

    // Transação SERIALIZABLE para evitar race condition no percentualUsina
    await this.prisma.$transaction(async (tx) => {
      const usina = await tx.usina.findUnique({ where: { id: usinaId } });
      let percentualUsina: number | null = null;
      if (contratoCompleto && usina && usina.capacidadeKwh && Number(usina.capacidadeKwh) > 0) {
        const kwhAnual = Number(contratoCompleto.kwhContrato ?? 0) * 12;
        const capacidadeAnual = Number(usina.capacidadeKwh);

        // Validar que a usina tem espaço
        const contratosAtivos = await tx.contrato.findMany({
          where: {
            usinaId,
            status: { in: ['ATIVO', 'PENDENTE_ATIVACAO'] },
            id: { not: contratoId },
          },
          select: { percentualUsina: true, kwhContratoAnual: true, kwhContrato: true },
        });
        const somaPercentual = contratosAtivos.reduce((acc: number, c: any) => {
          if (c.percentualUsina) return acc + Number(c.percentualUsina);
          const anual = c.kwhContratoAnual ? Number(c.kwhContratoAnual) : Number(c.kwhContrato ?? 0) * 12;
          return acc + (anual / capacidadeAnual) * 100;
        }, 0);

        percentualUsina = Math.round((kwhAnual / capacidadeAnual) * 100 * 10000) / 10000;
        if (somaPercentual + percentualUsina > 100.0001) {
          throw new Error(`Capacidade da usina insuficiente. Disponível: ${Math.round((100 - somaPercentual) * 10000) / 10000}%`);
        }
      }

      await tx.contrato.update({
        where: { id: contratoId },
        data: { usinaId, status: novoStatus as any, percentualUsina },
      });
      await tx.listaEspera.update({
        where: { id: listaEsperaId },
        data: { status: 'ALOCADO' },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await this.notificacoes.criar({
      tipo: 'CONTRATO_ATIVADO',
      titulo: 'Cooperado alocado em usina',
      mensagem: `Contrato ${entrada.contrato?.numero} alocado para ${entrada.cooperado.nomeCompleto}. Status: ${novoStatus === 'ATIVO' ? 'Ativo' : 'Pendente ativação'}.`,
      cooperadoId: entrada.cooperadoId,
      link: `/dashboard/cooperados/${entrada.cooperadoId}`,
    });
    return { sucesso: true };
  }

  // ── Aprovação remota ──────────────────────────────────────────────

  async enviarAprovacao(propostaId: string, canal: 'whatsapp' | 'email', destino: string) {
    const proposta = await this.prisma.propostaCooperado.findUnique({
      where: { id: propostaId },
      include: { cooperado: { select: { nomeCompleto: true } } },
    });
    if (!proposta) throw new NotFoundException('Proposta não encontrada');

    const token = randomUUID();
    await this.prisma.propostaCooperado.update({
      where: { id: propostaId },
      data: { tokenAprovacao: token },
    });

    const link = `http://localhost:3001/aprovar-proposta?token=${token}`;
    const modoAprovacao = canal === 'whatsapp' ? 'REMOTO_WHATSAPP' : 'REMOTO_EMAIL';

    console.log(`[APROVAÇÃO] Link para ${destino} (${canal}): ${link}`);

    return { sucesso: true, link, token, canal, destino, modoAprovacao };
  }

  async buscarPropostaPorToken(token: string) {
    const proposta = await this.prisma.propostaCooperado.findUnique({
      where: { tokenAprovacao: token },
      include: { cooperado: { select: { nomeCompleto: true, cpf: true, email: true, telefone: true } } },
    });
    if (!proposta) throw new NotFoundException('Proposta não encontrada ou token inválido');
    return proposta;
  }

  async aprovarRemoto(token: string, nome: string, aceite: boolean) {
    const proposta = await this.prisma.propostaCooperado.findUnique({
      where: { tokenAprovacao: token },
    });
    if (!proposta) throw new NotFoundException('Proposta não encontrada ou token inválido');
    if (proposta.status !== 'PENDENTE' && proposta.status !== 'ACEITA') {
      throw new BadRequestException(`Proposta já está com status: ${proposta.status}`);
    }

    const novoStatus = aceite ? 'ACEITA' : 'RECUSADA';
    await this.prisma.propostaCooperado.update({
      where: { id: proposta.id },
      data: {
        status: novoStatus,
        aprovadoEm: new Date(),
        aprovadoPor: nome,
        modoAprovacao: 'REMOTO_WHATSAPP',
        tokenAprovacao: null, // invalidar token após uso
      },
    });

    return { sucesso: true, propostaId: proposta.id, cooperadoId: proposta.cooperadoId, status: novoStatus };
  }

  async aprovarPresencial(propostaId: string) {
    const proposta = await this.prisma.propostaCooperado.findUnique({ where: { id: propostaId } });
    if (!proposta) throw new NotFoundException('Proposta não encontrada');

    await this.prisma.propostaCooperado.update({
      where: { id: propostaId },
      data: {
        status: 'ACEITA',
        aprovadoEm: new Date(),
        aprovadoPor: 'ADMIN',
        modoAprovacao: 'PRESENCIAL_ADMIN',
      },
    });

    return { sucesso: true, propostaId, status: 'ACEITA' };
  }

  // ── Assinatura digital ──────────────────────────────────────────

  async enviarAssinatura(propostaId: string) {
    const proposta = await this.prisma.propostaCooperado.findUnique({ where: { id: propostaId } });
    if (!proposta) throw new NotFoundException('Proposta não encontrada');

    const token = randomUUID();
    await this.prisma.propostaCooperado.update({
      where: { id: propostaId },
      data: { tokenAssinatura: token },
    });

    const link = `http://localhost:3001/assinar?token=${token}`;
    console.log(`[ASSINATURA] Link: ${link}`);

    return { sucesso: true, link, token };
  }

  async buscarDocumentoPorToken(token: string) {
    const proposta = await this.prisma.propostaCooperado.findUnique({
      where: { tokenAssinatura: token },
      include: { cooperado: { select: { nomeCompleto: true, cpf: true, email: true, telefone: true } } },
    });
    if (!proposta) throw new NotFoundException('Proposta não encontrada ou token inválido');
    return proposta;
  }

  async assinarDocumento(token: string, tipoDocumento: 'TERMO' | 'PROCURACAO', nomeAssinante: string) {
    const proposta = await this.prisma.propostaCooperado.findUnique({
      where: { tokenAssinatura: token },
    });
    if (!proposta) throw new NotFoundException('Proposta não encontrada ou token inválido');

    const data: any = {};
    if (tipoDocumento === 'TERMO') {
      data.termoAdesaoAssinadoEm = new Date();
      data.termoAdesaoAssinadoPor = nomeAssinante;
    } else {
      data.procuracaoAssinadaEm = new Date();
      data.procuracaoAssinadaPor = nomeAssinante;
    }

    await this.prisma.propostaCooperado.update({
      where: { id: proposta.id },
      data,
    });

    // Verificar se ambos foram assinados
    const updated = await this.prisma.propostaCooperado.findUnique({ where: { id: proposta.id } });
    const ambosAssinados = updated?.termoAdesaoAssinadoEm && updated?.procuracaoAssinadaEm;

    if (ambosAssinados) {
      // Invalidar token após ambas assinaturas
      await this.prisma.propostaCooperado.update({
        where: { id: proposta.id },
        data: { tokenAssinatura: null },
      });
    }

    return {
      sucesso: true,
      propostaId: proposta.id,
      cooperadoId: proposta.cooperadoId,
      tipoDocumento,
      ambosAssinados,
    };
  }

  // ── Modelos de documento ──────────────────────────────────

  async uploadModelo(
    arquivo: Express.Multer.File,
    tipo: string,
    nome: string,
    cooperativaId?: string,
  ) {
    if (!arquivo) throw new BadRequestException('Arquivo é obrigatório');
    if (!['CONTRATO', 'PROCURACAO'].includes(tipo)) {
      throw new BadRequestException('Tipo deve ser CONTRATO ou PROCURACAO');
    }

    // Extrair texto do arquivo
    const conteudo = arquivo.buffer.toString('utf-8');

    // Identificar variáveis no padrão {{VARIAVEL}}
    const matches = conteudo.match(/\{\{([A-Z_]+)\}\}/g) || [];
    const variaveis = [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))];

    const modelo = await this.prisma.modeloDocumento.create({
      data: {
        tipo,
        nome,
        conteudo,
        variaveis,
        cooperativaId: cooperativaId || null,
        isPadrao: false,
        ativo: true,
      },
    });

    return {
      id: modelo.id,
      variaveis,
      preview: conteudo.substring(0, 500),
    };
  }

  async getModelosPadrao() {
    const modelos = await this.prisma.modeloDocumento.findMany({
      where: { isPadrao: true, ativo: true },
      orderBy: { tipo: 'asc' },
    });

    if (modelos.length === 0) {
      // Retornar templates hardcoded se não existirem no banco
      return [
        {
          id: 'modelo-contrato-padrao',
          tipo: 'CONTRATO',
          nome: 'Contrato Padrão CoopereBR',
          variaveis: ['TIPO_PARCEIRO', 'NOME_COOPERADO', 'CPF_CNPJ', 'UC', 'DISTRIBUIDORA', 'NOME_PARCEIRO', 'CNPJ_PARCEIRO', 'NOME_USINA', 'POTENCIA_USINA', 'DESCONTO', 'COTA_KWH', 'DATA_INICIO', 'DIA_VENCIMENTO', 'DATA'],
          isPadrao: true,
          preview: 'Contrato de adesão padrão para cooperativas de energia solar com cláusulas de desconto, cota de energia e vigência.',
        },
        {
          id: 'modelo-procuracao-padrao',
          tipo: 'PROCURACAO',
          nome: 'Procuração Padrão CoopereBR',
          variaveis: ['NOME_COOPERADO', 'CPF_CNPJ', 'UC', 'DISTRIBUIDORA', 'NOME_PARCEIRO', 'CNPJ_PARCEIRO', 'NOME_USINA', 'POTENCIA_USINA', 'REPRESENTANTE_LEGAL', 'DATA'],
          isPadrao: true,
          preview: 'Procuração para representação junto à concessionária para adesão ao sistema de compensação de energia elétrica.',
        },
      ];
    }

    return modelos.map((m) => ({
      ...m,
      preview: m.conteudo.substring(0, 500),
    }));
  }

  async dashboardStats(cooperativaId?: string) {
    const coopFilter = cooperativaId ? { cooperado: { cooperativaId } } : {};
    const tarifa = await this.tarifaAtual();
    const propostas = await this.prisma.propostaCooperado.findMany({
      where: coopFilter,
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { cooperado: { select: { nomeCompleto: true } }, plano: { select: { nome: true } } },
    });
    const pendentes = await this.prisma.propostaCooperado.count({ where: { status: 'PENDENTE', ...coopFilter } });
    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
    const aceitasNoMes = await this.prisma.propostaCooperado.count({
      where: { status: 'ACEITA', createdAt: { gte: inicioMes }, ...coopFilter },
    });
    const cooperadosAtivos = await this.prisma.cooperado.findMany({
      where: { status: 'ATIVO', ...(cooperativaId ? { cooperativaId } : {}) },
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
