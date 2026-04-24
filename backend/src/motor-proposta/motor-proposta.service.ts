import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { CooperadosService } from '../cooperados/cooperados.service';
import { ContratosService } from '../contratos/contratos.service';
import { UsinasService } from '../usinas/usinas.service';
import { ConfigTenantService } from '../config-tenant/config-tenant.service';
import { EmailService } from '../email/email.service';
import { WhatsappSenderService } from '../whatsapp/whatsapp-sender.service';
import { PropostaPdfService } from './proposta-pdf.service';
import { PdfGeneratorService } from './pdf-generator.service';
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
    private email: EmailService,
    private whatsappSender: WhatsappSenderService,
    private propostaPdf: PropostaPdfService,
    private pdfGenerator: PdfGeneratorService,
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

    // Tarifa mais recente — filtrar por distribuidora do cooperado
    const ucCooperado = await this.prisma.uc.findFirst({
      where: { cooperadoId: dto.cooperadoId },
      select: { distribuidora: true, cooperado: { select: { cooperativaId: true } } },
    });
    const cooperativaId = ucCooperado?.cooperado?.cooperativaId ?? '';
    let tarifa: any = null;
    if (ucCooperado?.distribuidora) {
      const normDistrib = ucCooperado.distribuidora.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const todasTarifas = await this.prisma.tarifaConcessionaria.findMany({
        orderBy: { dataVigencia: 'desc' },
      });
      tarifa = todasTarifas.find(t => {
        const normConc = t.concessionaria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        return normConc.includes(normDistrib) || normDistrib.includes(normConc);
      }) || null;
    }
    if (!tarifa) {
      tarifa = await this.prisma.tarifaConcessionaria.findFirst({
        orderBy: { dataVigencia: 'desc' },
      });
    }
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
    const minimoAtivo = (await this.configTenant.get('minimo_faturavel_ativo', cooperativaId)) === 'true';
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
        const val = await this.configTenant.get(chave, cooperativaId);
        minimoFaturavel = val ? Number(val) : 0;
      }
    }

    const threshold = Number(config.thresholdOutlier);
    const outlierDetectado = kwhMesRecente > kwhMedio12m * threshold;

    // Buscar plano (obrigatório — desconto vem exclusivamente do plano)
    const plano = await this.prisma.plano.findFirst({
      where: { id: dto.planoId, ativo: true },
      select: { descontoBase: true },
    });
    if (!plano) {
      throw new BadRequestException(`Plano ${dto.planoId} não encontrado ou inativo`);
    }
    const descontoDoPlano = Number(plano.descontoBase);

    // Base de desconto: KWH_CHEIO (tarifa × kWh) ou VALOR_FATURA (valor da fatura inteira)
    const usarValorFatura = dto.baseDesconto === 'VALOR_FATURA';

    // Função de cálculo de uma opção
    const calcularOpcao = (base: 'MES_RECENTE' | 'MEDIA_12M'): OpcaoCalculo => {
      const kwhBase = base === 'MES_RECENTE' ? kwhMesRecente : kwhMedio12m;
      const valorBase = base === 'MES_RECENTE' ? valorMesRecente : valorMedio12m;
      const consumoConsiderado = Math.max(0, kwhBase - minimoFaturavel);
      const kwhApuradoBase = kwhBase > 0 ? valorBase / kwhBase : 0;
      const descontoPercentual = descontoDoPlano;

      let descontoAbsoluto = tarifaUnitSemTrib * (descontoPercentual / 100);
      let valorCooperado = kwhApuradoBase - descontoAbsoluto;

      // Ajustar se resultado acima da média cooperativa (usa descontoBase do plano como teto)
      if (config.acaoResultadoAcima === 'AUMENTAR_DESCONTO' && mediaCooperativaKwh > 0 && valorCooperado > mediaCooperativaKwh) {
        const descontoNecessario = ((kwhApuradoBase - mediaCooperativaKwh) / tarifaUnitSemTrib) * 100;
        descontoAbsoluto = tarifaUnitSemTrib * (Math.min(descontoNecessario, descontoDoPlano) / 100);
        valorCooperado = kwhApuradoBase - descontoAbsoluto;
      }

      const kwhContrato = consumoConsiderado;
      const economiaAbsoluta = descontoAbsoluto;
      const economiaPercentual = kwhApuradoBase > 0 ? (descontoAbsoluto / kwhApuradoBase) * 100 : 0;
      // economiaMensal: VALOR_FATURA → desconto% direto sobre o valor da fatura
      //                 KWH_CHEIO   → descontoAbsoluto × kWhContrato (padrão)
      let economiaMensal: number;
      if (usarValorFatura) {
        economiaMensal = Math.round(valorBase * (descontoPercentual / 100) * 100) / 100;
      } else if (tarifaUnitSemTrib > 0) {
        economiaMensal = descontoAbsoluto * kwhContrato;
      } else {
        economiaMensal = valorBase * (descontoPercentual / 100);
      }
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

  /**
   * Calcula proposta usando a configuração de base de cálculo do Plano.
   * Usado quando há dados OCR de fatura (upload) com componentes discriminados.
   */
  async calcularComPlano(dados: {
    planoId: string;
    consumoKwh: number;
    totalSemGD: number;
    tusd: number;
    te: number;
    pisCofins: number;
    cip: number;
    icms?: number;
    historico: Array<{ mes: string; kwh: number; valor: number }>;
  }) {
    const plano = await this.prisma.plano.findUnique({
      where: { id: dados.planoId },
      select: {
        descontoBase: true,
        baseCalculo: true,
        componentesCustom: true,
        referenciaValor: true,
        fatorIncremento: true,
        mostrarDiscriminado: true,
        tipoDesconto: true,
      },
    });
    if (!plano) throw new NotFoundException(`Plano ${dados.planoId} não encontrado`);

    const baseCalculo = (plano.baseCalculo ?? 'KWH_CHEIO') as string;
    const componentesCustom = (plano.componentesCustom ?? []) as string[];
    const referenciaValor = (plano.referenciaValor ?? 'MEDIA_3M') as string;
    const fatorIncremento = plano.fatorIncremento ? Number(plano.fatorIncremento) : null;
    const mostrarDiscriminado = plano.mostrarDiscriminado ?? true;
    const descontoBase = Number(plano.descontoBase);
    // T2 Sprint 5: fallback defensivo para contratos pré-Sprint 5 (Seção 4.8).
    // T1 já pôs default APLICAR_SOBRE_BASE no schema; este ?? protege o caso
    // em que o select venha a omitir o campo por acidente no futuro.
    const tipoDesconto: 'APLICAR_SOBRE_BASE' | 'ABATER_DA_CHEIA' =
      (plano.tipoDesconto as any) ?? 'APLICAR_SOBRE_BASE';

    // 1. Calcular valor base por kWh conforme baseCalculo
    let totalBase: number;
    switch (baseCalculo) {
      case 'SEM_TRIBUTO':
        totalBase = dados.tusd + dados.te;
        break;
      case 'COM_ICMS':
        totalBase = dados.tusd + dados.te + (dados.icms ?? 0);
        break;
      case 'CUSTOM': {
        let soma = 0;
        if (componentesCustom.includes('TUSD')) soma += dados.tusd;
        if (componentesCustom.includes('TE')) soma += dados.te;
        if (componentesCustom.includes('ICMS')) soma += (dados.icms ?? 0);
        if (componentesCustom.includes('PIS_COFINS')) soma += dados.pisCofins;
        if (componentesCustom.includes('CIP')) soma += dados.cip;
        totalBase = soma;
        break;
      }
      case 'KWH_CHEIO':
      default:
        totalBase = dados.totalSemGD;
        break;
    }

    // tarifaBase: R$/kWh da base escolhida pelo admin (antes: "kwhBaseCalculo" — nome enganoso).
    const tarifaBase = dados.consumoKwh > 0
      ? Math.round((totalBase / dados.consumoKwh) * 100000) / 100000
      : 0;

    // kwhCheio: sempre calculado, independente de baseCalculo. Necessário
    // pro Tipo II quando baseCalculo ≠ KWH_CHEIO (Seção 4.3). T3 vai
    // reusar pra congelar snapshots no aceitar().
    const kwhCheio = dados.consumoKwh > 0
      ? Math.round((dados.totalSemGD / dados.consumoKwh) * 100000) / 100000
      : 0;

    // Ramificação Tipo I / Tipo II — Seções 4.2 e 4.3.
    // Tipo I : tarifaContratada = tarifaBase × (1 − desc/100)
    // Tipo II: tarifaContratada = kwhCheio − (tarifaBase × desc/100)
    let tarifaContratada: number;
    let abatimentoPorKwh: number | null;
    if (tipoDesconto === 'ABATER_DA_CHEIA') {
      abatimentoPorKwh = Math.round(tarifaBase * (descontoBase / 100) * 100000) / 100000;
      tarifaContratada = Math.round((kwhCheio - abatimentoPorKwh) * 100000) / 100000;
    } else {
      // APLICAR_SOBRE_BASE (default de migração Seção 4.8).
      abatimentoPorKwh = null;
      tarifaContratada = Math.round(tarifaBase * (1 - descontoBase / 100) * 100000) / 100000;
    }

    // 2. Determinar kWh de referência conforme referenciaValor
    const historico = dados.historico ?? [];
    let kwhMedio: number;
    switch (referenciaValor) {
      case 'ULTIMA_FATURA':
        kwhMedio = dados.consumoKwh;
        break;
      case 'MEDIA_6M': {
        const ultimos6 = historico.slice(-6);
        kwhMedio = ultimos6.length > 0
          ? ultimos6.reduce((a, h) => a + h.kwh, 0) / ultimos6.length
          : dados.consumoKwh;
        break;
      }
      case 'MEDIA_12M': {
        const ultimos12 = historico.slice(-12);
        kwhMedio = ultimos12.length > 0
          ? ultimos12.reduce((a, h) => a + h.kwh, 0) / ultimos12.length
          : dados.consumoKwh;
        break;
      }
      case 'MEDIA_3M':
      default: {
        const ultimos3 = historico.slice(-3);
        kwhMedio = ultimos3.length > 0
          ? ultimos3.reduce((a, h) => a + h.kwh, 0) / ultimos3.length
          : dados.consumoKwh;
        break;
      }
    }
    kwhMedio = Math.round(kwhMedio * 100) / 100;

    // 3. Aplicar fator de incremento
    let kwhContrato = kwhMedio;
    if (fatorIncremento !== null) {
      kwhContrato = Math.round(kwhMedio * (1 + fatorIncremento / 100) * 100) / 100;
    }

    // BUG-NEW-002: Validar que kwhContrato > 0 antes de prosseguir
    if (kwhContrato <= 0) {
      throw new BadRequestException('kwhContrato calculado é zero ou negativo. Verifique o consumo informado e o fator de incremento.');
    }

    // 4. Calcular valores financeiros
    const valorMensalCooperebr = Math.round(kwhContrato * tarifaContratada * 100) / 100;
    const comparativoSemGD = Math.round(kwhContrato * (dados.totalSemGD / (dados.consumoKwh || 1)) * 100) / 100;
    const valorMensalEdp = Math.round((comparativoSemGD - valorMensalCooperebr) * 0.1 * 100) / 100; // custo mínimo EDP estimado
    const valorTotalMensal = Math.round((valorMensalCooperebr + valorMensalEdp) * 100) / 100;
    const economiaReais = Math.round((comparativoSemGD - valorTotalMensal) * 100) / 100;
    const economiaPercent = comparativoSemGD > 0
      ? Math.round((economiaReais / comparativoSemGD) * 100 * 100) / 100
      : 0;

    // 5. Discriminado (componentes) — só se mostrarDiscriminado
    const discriminado = mostrarDiscriminado ? {
      tusd: Math.round(dados.tusd * 100) / 100,
      te: Math.round(dados.te * 100) / 100,
      pisCofins: Math.round(dados.pisCofins * 100) / 100,
      cip: Math.round(dados.cip * 100) / 100,
      totalBase: Math.round(totalBase * 100) / 100,
    } : null;

    const baseCalculoLabels: Record<string, string> = {
      KWH_CHEIO: 'kWh Cheio (todos componentes)',
      SEM_TRIBUTO: 'Sem Tributos (TUSD + TE)',
      COM_ICMS: 'Com ICMS (TUSD + TE + ICMS)',
      CUSTOM: `Personalizado (${componentesCustom.join(', ')})`,
    };

    return {
      kwhMedio,
      kwhContrato,
      // Alias de compat — frontend (Step3Simulacao) ainda consome kwhBaseCalculo.
      // Manter até T7 refatorar a UI do plano.
      kwhBaseCalculo: tarifaBase,
      tarifaBase,
      kwhCheio,
      tarifaContratada,
      abatimentoPorKwh,
      tipoDescontoUsado: tipoDesconto,
      baseCalculoUsada: baseCalculoLabels[baseCalculo] ?? baseCalculo,
      referenciaUsada: referenciaValor,
      fatorIncrementoAplicado: fatorIncremento,
      discriminado,
      valorMensalCooperebr,
      valorMensalEdp,
      valorTotalMensal,
      economiaReais,
      economiaPercent,
      comparativoSemGD,
    };
  }

  /**
   * ⚠️ DÍVIDA TÉCNICA (T3 PARTE 4):
   * Esta rota hoje aceita um `resultado` inteiro no body e cria diretamente
   * uma PropostaCooperado com status ACEITA, sem que exista uma proposta
   * PENDENTE prévia no banco. Isso permite que um admin autenticado envie
   * valores arbitrários no resultado (injeção insider-threat).
   *
   * A proteção completa exige T0 (refactor do Wizard Admin): persistir uma
   * proposta PENDENTE dentro de calcular() e exigir transição PENDENTE →
   * ACEITA aqui, validando contra o que já está no banco. Enquanto T0 não
   * é feito, esta função aplica 3 camadas de defesa cumulativas:
   *   1. @Roles(SUPER_ADMIN, ADMIN) no controller (sem OPERADOR)
   *   2. Validação de ranges no resultado (descontoPercentual, valores)
   *   3. Audit trail com usuarioId em HistoricoStatusCooperado
   */
  async aceitar(dto: {
    cooperadoId: string;
    resultado: ResultadoCalculo['resultado'];
    mesReferencia: string;
    planoId?: string;
  }, cooperativaId?: string, usuarioId?: string) {
    if (!dto.resultado) throw new Error('Resultado inválido');
    const r = dto.resultado;

    // Carregar cooperado — precisamos de cooperativaId pro contrato
    const dono = await this.prisma.cooperado.findUnique({
      where: { id: dto.cooperadoId },
      select: { cooperativaId: true },
    });
    if (!dono) throw new NotFoundException('Cooperado não encontrado');
    if (!dono.cooperativaId) {
      throw new BadRequestException(
        `Cooperado ${dto.cooperadoId} sem cooperativaId — dados corrompidos.`,
      );
    }

    // Multi-tenant: cross-check quando caller informou tenant
    if (cooperativaId && dono.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Cooperado não pertence à sua cooperativa');
    }

    // T3 PARTE 4 camada 2: validação de ranges no resultado.
    // Bloqueia injeção descuidada e erros óbvios. Não impede insider-threat
    // sofisticado (ex: descontoPct=49.99) — isso só fecha com T0.
    const descontoPct = Number(r.descontoPercentual);
    if (!Number.isFinite(descontoPct) || descontoPct < 0 || descontoPct > 50) {
      throw new BadRequestException(
        `descontoPercentual fora do range permitido: ${descontoPct}. Valor deve estar entre 0 e 50.`,
      );
    }
    if (Number(r.valorCooperado) < 0) {
      throw new BadRequestException('valorCooperado não pode ser negativo.');
    }
    if (Number(r.economiaMensal) < 0) {
      throw new BadRequestException('economiaMensal não pode ser negativa.');
    }

    // BUG-CARRY-002: kwhContrato deve ser > 0 para gerar contrato
    if (!r.kwhContrato || r.kwhContrato <= 0) {
      throw new BadRequestException('kwhContrato deve ser maior que zero para aceitar a proposta.');
    }

    // T3 Sprint 5: carregar plano pra gravar snapshots no Contrato.
    // Se dto.planoId veio, usa direto. Se não veio (caller legado
    // /dashboard/cooperados/[id]/page.tsx), fallback pro primeiro plano ativo
    // do tenant. Isso é comportamento preexistente — a T3 só preserva.
    // Caso fallback: registrar flag para notificação pós-transação.
    let planoIdResolvido: string | null = dto.planoId ?? null;
    let usouFallbackPlano = false;
    if (!planoIdResolvido) {
      const primeiroPlano = await this.prisma.plano.findFirst({
        where: { ativo: true, cooperativaId: dono.cooperativaId },
        select: { id: true },
      });
      planoIdResolvido = primeiroPlano?.id ?? null;
      usouFallbackPlano = !!planoIdResolvido;
    }

    // Plano pode ser null (seed sem plano ativo) — nesse caso snapshots ficam com default do schema.
    const planoSnapshot = planoIdResolvido
      ? await this.prisma.plano.findUnique({
          where: { id: planoIdResolvido },
          select: {
            modeloCobranca: true,
            nome: true,
            baseCalculo: true,
            tipoDesconto: true,
            temPromocao: true,
            descontoPromocional: true,
            mesesPromocao: true,
            descontoBase: true,
          },
        })
      : null;

    // Sprint 5: bloquear aceite se plano usa modelo COMPENSADOS/DINAMICO.
    // Controlado por env var BLOQUEIO_MODELOS_NAO_FIXO (default: true). Remover na T9.
    if (process.env.BLOQUEIO_MODELOS_NAO_FIXO !== 'false' && planoSnapshot) {
      const bloqueados = ['CREDITOS_COMPENSADOS', 'CREDITOS_DINAMICO'];
      if (bloqueados.includes(planoSnapshot.modeloCobranca)) {
        throw new BadRequestException(
          `Plano "${planoSnapshot.nome}" usa modelo "${planoSnapshot.modeloCobranca}" — em refatoração (Sprint 5). Disponível em breve. Use um plano FIXO_MENSAL por enquanto.`,
        );
      }
    }

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

      // 9. Criar contrato — com snapshots T3 (Seção 2.3 do doc canônico)
      const statusContrato = usinaComVaga ? 'PENDENTE_ATIVACAO' : 'LISTA_ESPERA';

      // valorContrato: só para FIXO_MENSAL. R$/kWh × kWh = R$ mensal.
      // Para COMPENSADOS/DINAMICO fica null (serão preenchidos na T3b via T7/T9).
      const ehFixo = planoSnapshot?.modeloCobranca === 'FIXO_MENSAL';
      const valorContrato = ehFixo
        ? Math.round(Number(r.valorCooperado) * Number(r.kwhContrato) * 100) / 100
        : null;

      // T4 Sprint 5: snapshots promocionais (Seção 2.3).
      // Só gravam se plano tem promoção configurada e válida. Plano mudando
      // depois NÃO retroage — snapshot congela o valor do momento do aceite.
      // Fórmula promocional: mesma do dimensionamento T2, trocando descontoBase
      // por descontoPromocional. Pra FIXO calcula valorContratoPromocional;
      // pra COMPENSADOS calcula tarifaContratualPromocional (inerte até T9).
      let valorContratoPromocional: number | null = null;
      let tarifaContratualPromocional: number | null = null;
      let descontoPromocionalAplicado: number | null = null;
      let mesesPromocaoAplicados: number | null = null;

      const temPromocaoValida =
        planoSnapshot?.temPromocao === true &&
        planoSnapshot.descontoPromocional != null &&
        planoSnapshot.mesesPromocao != null &&
        Number(planoSnapshot.mesesPromocao) > 0;

      if (temPromocaoValida && planoSnapshot) {
        const descPromoPct = Number(planoSnapshot.descontoPromocional);
        descontoPromocionalAplicado = descPromoPct;
        mesesPromocaoAplicados = Number(planoSnapshot.mesesPromocao);

        // Tarifa promocional: substitui descontoBase do r.valorCooperado pelo
        // descPromoPct. r.valorCooperado foi calculado com descontoBase%;
        // ajuste: tarifaPromo = r.kwhApuradoBase × (1 - descPromoPct/100)
        // (assume Tipo I no legado — consistente com resultado atual do calcular()).
        const tarifaPromo = Number(r.kwhApuradoBase) * (1 - descPromoPct / 100);
        tarifaContratualPromocional = Math.round(tarifaPromo * 100000) / 100000;
        if (ehFixo) {
          valorContratoPromocional =
            Math.round(tarifaPromo * Number(r.kwhContrato) * 100) / 100;
        }
      }

      const contrato = await tx.contrato.create({
        data: {
          numero,
          cooperadoId: dto.cooperadoId,
          cooperativaId: dono.cooperativaId,
          planoId: planoIdResolvido,
          ucId: ucDisponivel.id,
          usinaId: usinaComVaga?.id ?? null,
          propostaId: proposta.id,
          dataInicio: new Date(),
          percentualDesconto: r.descontoPercentual,
          kwhContrato: r.kwhContrato,
          kwhContratoMensal: r.kwhContrato,
          percentualUsina,
          status: statusContrato as any,
          // Snapshots T3 — Seção 2.3 do REGRAS-PLANOS-E-COBRANCA.md.
          // baseCalculoAplicado/tipoDescontoAplicado vêm do plano no momento
          // do aceite, não do cálculo. Se planoSnapshot for null (sem plano
          // ativo no tenant), os defaults do schema entram em vigor.
          ...(valorContrato !== null ? { valorContrato } : {}),
          ...(planoSnapshot ? {
            baseCalculoAplicado: planoSnapshot.baseCalculo,
            tipoDescontoAplicado: planoSnapshot.tipoDesconto,
          } : {}),
          ...(descontoPromocionalAplicado !== null ? {
            descontoPromocionalAplicado,
            mesesPromocaoAplicados,
            ...(valorContratoPromocional !== null ? { valorContratoPromocional } : {}),
            ...(tarifaContratualPromocional !== null ? { tarifaContratualPromocional } : {}),
          } : {}),
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

    // T3: se admin aceitou proposta sem escolher plano explicitamente
    // (tela legada /dashboard/cooperados/[id] não envia planoId), registrar
    // notificação visível pro admin revisar. Não bloqueia o fluxo — só
    // sinaliza. Ticket Sprint 7 vai decidir o futuro dessa tela.
    if (usouFallbackPlano && result.contrato) {
      await this.notificacoes.criar({
        tipo: 'PLANO_FALLBACK_APLICADO',
        titulo: 'Contrato criado com plano padrão — revisar',
        mensagem:
          `Contrato ${result.numero} de ${result.nomeCooperado} foi criado usando o primeiro plano ativo da cooperativa porque nenhum plano foi escolhido explicitamente na aceitação. Revise se o plano selecionado está correto.`,
        cooperadoId: dto.cooperadoId,
        link: `/dashboard/cooperados/${dto.cooperadoId}`,
      });
    }

    // T3 PARTE 4 camada 3: audit trail — registrar quem acionou aceitar()
    // antes da transição de status. Usa HistoricoStatusCooperado (campo
    // usuarioId já existe no schema) para trilha forense persistente.
    const cooperadoAntes = await this.prisma.cooperado.findUnique({
      where: { id: dto.cooperadoId },
      select: { status: true, cooperativaId: true },
    });
    if (cooperadoAntes) {
      await this.prisma.historicoStatusCooperado.create({
        data: {
          cooperadoId: dto.cooperadoId,
          cooperativaId: cooperadoAntes.cooperativaId ?? undefined,
          statusAnterior: cooperadoAntes.status,
          statusNovo: cooperadoAntes.status,
          motivo: `Proposta aceita via /motor-proposta/aceitar — desconto=${descontoPct}%, kwh=${r.kwhContrato}, propostaId=${result.proposta.id}`,
          usuarioId: usuarioId ?? undefined,
        },
      });
    }

    // T3 PARTE 1: após aceite, marcar cooperado como PENDENTE_DOCUMENTOS (se aplicável)
    // e notificar para envio de documentos.
    await this.cooperadosService.marcarPendenteDocumentos(dto.cooperadoId, cooperativaId);
    await this.notificarCooperadoEnvioDocumentos(dto.cooperadoId);

    await this.cooperadosService.checkProntoParaAtivar(dto.cooperadoId);

    return {
      proposta: result.proposta,
      contrato: result.contrato,
      emListaEspera: result.emListaEspera,
      ...(result.contrato ? {} : { aviso: (result as any).aviso }),
    };
  }

  /**
   * Notifica cooperado (WA + email) para enviar documentos após aceite.
   * Guardado por NOTIFICACOES_ATIVAS: em dev fica off; em prod precisa
   * `NOTIFICACOES_ATIVAS=true` para disparar envios reais.
   * Falhas de envio são logadas mas não abortam o fluxo (best-effort).
   */
  private async notificarCooperadoEnvioDocumentos(cooperadoId: string): Promise<void> {
    if (process.env.NOTIFICACOES_ATIVAS !== 'true') return;
    const cooperado = await this.prisma.cooperado.findUnique({
      where: { id: cooperadoId },
      select: { nomeCompleto: true, email: true, telefone: true },
    });
    if (!cooperado) return;
    const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
    const linkDocs = `${baseUrl}/portal/documentos`;
    const mensagem =
      `Olá, ${cooperado.nomeCompleto}! Sua proposta CoopereBR foi aceita. ` +
      `Para finalizar sua adesão, envie seus documentos aqui: ${linkDocs}`;
    if (cooperado.telefone) {
      try {
        await this.whatsappSender.enviarMensagem(cooperado.telefone, mensagem);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        console.error(`[T3] Falha ao enviar WA para cooperado ${cooperadoId}: ${msg}`);
      }
    }
    if (cooperado.email) {
      try {
        const html =
          `<p>Olá, <strong>${cooperado.nomeCompleto}</strong>!</p>` +
          `<p>Sua proposta CoopereBR foi aceita. Para finalizar sua adesão, ` +
          `envie seus documentos acessando o link abaixo:</p>` +
          `<p><a href="${linkDocs}">${linkDocs}</a></p>`;
        await this.email.enviarEmail(cooperado.email, 'Proposta aceita — envie seus documentos', html, mensagem);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        console.error(`[T3] Falha ao enviar email para cooperado ${cooperadoId}: ${msg}`);
      }
    }
  }

  async excluirProposta(propostaId: string, cooperativaId?: string) {
    const proposta = await this.prisma.propostaCooperado.findUnique({
      where: { id: propostaId },
      include: { cooperado: { select: { cooperativaId: true } } },
    });
    if (!proposta) throw new NotFoundException('Proposta não encontrada');

    // BUG-4: verificar cooperativaId para evitar IDOR
    if (cooperativaId && proposta.cooperado?.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Proposta não pertence à sua cooperativa');
    }

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
  }>, cooperativaId?: string) {
    const proposta = await this.prisma.propostaCooperado.findUnique({
      where: { id: propostaId },
      include: { cooperado: { select: { cooperativaId: true } } },
    });
    if (!proposta) throw new NotFoundException('Proposta não encontrada');

    // BUG-4: verificar cooperativaId para evitar IDOR
    if (cooperativaId && proposta.cooperado?.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Proposta não pertence à sua cooperativa');
    }
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

  async tarifaAtual(concessionaria?: string) {
    if (concessionaria) {
      const normDistrib = concessionaria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const todasTarifas = await this.prisma.tarifaConcessionaria.findMany({
        orderBy: { dataVigencia: 'desc' },
      });
      const tarifa = todasTarifas.find(t => {
        const normConc = t.concessionaria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        return normConc.includes(normDistrib) || normDistrib.includes(normConc);
      });
      if (tarifa) return tarifa;
    }
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

    const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
    const link = `${baseUrl}/aprovar-proposta?token=${token}`;
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

  // ── Análise de documentos (T3 PARTE 2) ───────────────────────────

  /**
   * Endpoint de análise de documentos do cooperado (ADMIN).
   * - APROVADO → delega para enviarLinkAssinaturaDocs() (muda cooperado para
   *   APROVADO, gera PDFs e envia link de assinatura).
   * - REPROVADO → registra motivo em HistoricoStatusCooperado, notifica cooperado.
   * - PENDENTE → registra motivo (pedido de mais info), notifica cooperado.
   *
   * Multi-tenant: valida que a proposta pertence à cooperativa do admin.
   * WA/email guardados por NOTIFICACOES_ATIVAS.
   */
  async analisarDocumentos(
    propostaId: string,
    resultado: 'APROVADO' | 'PENDENTE' | 'REPROVADO',
    motivo: string | undefined,
    cooperativaId: string | undefined,
  ) {
    const validos: Array<'APROVADO' | 'PENDENTE' | 'REPROVADO'> = ['APROVADO', 'PENDENTE', 'REPROVADO'];
    if (!validos.includes(resultado)) {
      throw new BadRequestException(`Resultado inválido: ${resultado}. Use APROVADO | PENDENTE | REPROVADO.`);
    }
    if (resultado === 'REPROVADO' && (!motivo || motivo.trim().length === 0)) {
      throw new BadRequestException('Motivo é obrigatório quando resultado = REPROVADO.');
    }

    const proposta = await this.prisma.propostaCooperado.findUnique({
      where: { id: propostaId },
      include: {
        cooperado: {
          select: {
            id: true,
            cooperativaId: true,
            nomeCompleto: true,
            email: true,
            telefone: true,
            status: true,
          },
        },
      },
    });
    if (!proposta) throw new NotFoundException('Proposta não encontrada');

    // Multi-tenant: proposta precisa pertencer à cooperativa do admin
    if (cooperativaId && proposta.cooperado.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Proposta não pertence à sua cooperativa');
    }

    // APROVADO → delega para enviarLinkAssinaturaDocs (muda status + gera PDFs + envia link)
    if (resultado === 'APROVADO') {
      return this.enviarLinkAssinaturaDocs(propostaId, cooperativaId);
    }

    // REPROVADO / PENDENTE: registrar motivo em histórico (transição no-op com motivo)
    await this.prisma.historicoStatusCooperado.create({
      data: {
        cooperadoId: proposta.cooperado.id,
        cooperativaId: proposta.cooperado.cooperativaId ?? undefined,
        statusAnterior: proposta.cooperado.status,
        statusNovo: proposta.cooperado.status,
        motivo: `Análise de documentos: ${resultado}${motivo ? ` — ${motivo}` : ''}`,
      },
    });

    // Notificação in-app (sempre ligada — é interno, não é WA/email real)
    await this.notificacoes.criar({
      tipo: resultado === 'REPROVADO' ? 'DOCUMENTOS_REPROVADOS' : 'DOCUMENTOS_PENDENTES',
      titulo: resultado === 'REPROVADO' ? 'Documentos reprovados' : 'Documentos requerem ajuste',
      mensagem: `${proposta.cooperado.nomeCompleto}: ${resultado}${motivo ? ` — ${motivo}` : ''}`,
      cooperadoId: proposta.cooperado.id,
      link: `/dashboard/cooperados/${proposta.cooperado.id}`,
    });

    // WA + email → behind NOTIFICACOES_ATIVAS
    await this.notificarAnaliseDocumentos(proposta.cooperado, resultado, motivo);

    return { sucesso: true, propostaId, resultado, motivo: motivo ?? null };
  }

  /**
   * Envia WA + email ao cooperado informando resultado da análise.
   * Guardado por NOTIFICACOES_ATIVAS. Falhas são logadas mas não abortam.
   */
  private async notificarAnaliseDocumentos(
    cooperado: { nomeCompleto: string; email: string | null; telefone: string | null },
    resultado: 'REPROVADO' | 'PENDENTE',
    motivo?: string,
  ): Promise<void> {
    if (process.env.NOTIFICACOES_ATIVAS !== 'true') return;
    const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
    const linkDocs = `${baseUrl}/portal/documentos`;
    const titulo = resultado === 'REPROVADO'
      ? 'Documentos reprovados — envie novamente'
      : 'Seus documentos precisam de ajustes';
    const mensagemBase = resultado === 'REPROVADO'
      ? `Olá, ${cooperado.nomeCompleto}. Seus documentos foram reprovados`
      : `Olá, ${cooperado.nomeCompleto}. Precisamos de mais informações sobre seus documentos`;
    const sufixo = motivo ? `: ${motivo}` : '.';
    const mensagem = `${mensagemBase}${sufixo} Reenvie aqui: ${linkDocs}`;

    if (cooperado.telefone) {
      try {
        await this.whatsappSender.enviarMensagem(cooperado.telefone, mensagem);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        console.error(`[T3] Falha ao enviar WA de análise: ${msg}`);
      }
    }
    if (cooperado.email) {
      try {
        const html =
          `<p>Olá, <strong>${cooperado.nomeCompleto}</strong>.</p>` +
          `<p>${mensagemBase}${motivo ? `: <em>${motivo}</em>` : '.'}</p>` +
          `<p>Para reenviar, acesse: <a href="${linkDocs}">${linkDocs}</a></p>`;
        await this.email.enviarEmail(cooperado.email, titulo, html, mensagem);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        console.error(`[T3] Falha ao enviar email de análise: ${msg}`);
      }
    }
  }

  // ── Assinatura digital ──────────────────────────────────────────

  /**
   * Gera token de assinatura, marca cooperado como APROVADO, gera PDFs de
   * termo/procuração e envia link para o cooperado via WA + email.
   *
   * Link novo: ${FRONTEND_URL}/portal/assinar/${token} (path param).
   * Envio real é guardado por NOTIFICACOES_ATIVAS; geração de PDF é best-effort
   * (falha no pdf não aborta o envio do link).
   *
   * (Antigo nome: enviarAssinatura — renomeado em T3 PARTE 3.)
   */
  async enviarLinkAssinaturaDocs(propostaId: string, cooperativaId?: string) {
    const proposta = await this.prisma.propostaCooperado.findUnique({
      where: { id: propostaId },
      include: {
        cooperado: {
          select: {
            id: true,
            cooperativaId: true,
            nomeCompleto: true,
            email: true,
            telefone: true,
          },
        },
      },
    });
    if (!proposta) throw new NotFoundException('Proposta não encontrada');

    // Multi-tenant
    if (cooperativaId && proposta.cooperado.cooperativaId !== cooperativaId) {
      throw new ForbiddenException('Proposta não pertence à sua cooperativa');
    }

    // 1. Gerar token único e persistir
    const token = randomUUID();
    await this.prisma.propostaCooperado.update({
      where: { id: propostaId },
      data: { tokenAssinatura: token },
    });

    // 2. Marcar cooperado como APROVADO (audit trail em HistoricoStatusCooperado)
    await this.cooperadosService.marcarAprovado(proposta.cooperado.id, cooperativaId);

    // 3. Gerar PDFs (best-effort — não aborta o fluxo se falhar)
    let pdfPath: string | null = null;
    try {
      const html = await this.propostaPdf.gerarHtml(propostaId);
      pdfPath = await this.pdfGenerator.gerarPdf(html, `proposta-${propostaId}.pdf`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      console.error(`[T3] Falha ao gerar PDF da proposta ${propostaId}: ${msg}`);
    }

    // 4. Link no novo formato (path param — compatível com /portal/assinar/[token])
    const baseUrl = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';
    const link = `${baseUrl}/portal/assinar/${token}`;

    // 5. Envio WA + email (behind NOTIFICACOES_ATIVAS)
    await this.notificarLinkAssinatura(proposta.cooperado, link, pdfPath);

    return { sucesso: true, link, token, pdfPath };
  }

  /**
   * Envia link de assinatura via WA + email ao cooperado.
   * Guardado por NOTIFICACOES_ATIVAS. Se houver PDF gerado e telefone,
   * envia o PDF como anexo via WA também.
   */
  private async notificarLinkAssinatura(
    cooperado: { nomeCompleto: string; email: string | null; telefone: string | null },
    link: string,
    pdfPath: string | null,
  ): Promise<void> {
    if (process.env.NOTIFICACOES_ATIVAS !== 'true') return;
    const mensagem =
      `Olá, ${cooperado.nomeCompleto}! Seus documentos foram aprovados pela CoopereBR. ` +
      `Para finalizar sua adesão, assine o contrato e a procuração no link: ${link}`;

    if (cooperado.telefone) {
      try {
        await this.whatsappSender.enviarMensagem(cooperado.telefone, mensagem);
        if (pdfPath) {
          await this.whatsappSender.enviarPdfWhatsApp(
            cooperado.telefone,
            pdfPath,
            `proposta-cooperebr.pdf`,
            'Segue sua proposta CoopereBR para assinatura',
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        console.error(`[T3] Falha ao enviar WA do link de assinatura: ${msg}`);
      }
    }
    if (cooperado.email) {
      try {
        const html =
          `<p>Olá, <strong>${cooperado.nomeCompleto}</strong>!</p>` +
          `<p>Seus documentos foram aprovados pela CoopereBR.</p>` +
          `<p>Para finalizar sua adesão, assine o contrato e a procuração acessando o link abaixo:</p>` +
          `<p><a href="${link}">${link}</a></p>`;
        await this.email.enviarEmail(
          cooperado.email,
          'Documentos aprovados — assine seu contrato CoopereBR',
          html,
          mensagem,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro desconhecido';
        console.error(`[T3] Falha ao enviar email do link de assinatura: ${msg}`);
      }
    }
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

      // Sprint 10: enviar cópia assinada por email
      if (!updated?.copiaAssinadaEnviadaEm) {
        await this.enviarCopiaAssinada(proposta.id);
      }
    }

    return {
      sucesso: true,
      propostaId: proposta.id,
      cooperadoId: proposta.cooperadoId,
      tipoDocumento,
      ambosAssinados,
    };
  }

  /**
   * Sprint 10: gera PDF da proposta assinada e envia ao cooperado por email.
   * Best-effort — não aborta o fluxo se falhar.
   */
  private async enviarCopiaAssinada(propostaId: string): Promise<void> {
    if (process.env.NOTIFICACOES_ATIVAS !== 'true') return;

    const proposta = await this.prisma.propostaCooperado.findUnique({
      where: { id: propostaId },
      include: {
        cooperado: {
          select: { nomeCompleto: true, email: true },
        },
      },
    });
    if (!proposta || !proposta.cooperado.email) return;

    try {
      const html = await this.propostaPdf.gerarHtml(propostaId);
      const pdfPath = await this.pdfGenerator.gerarPdf(html, `proposta-assinada-${propostaId}.pdf`);

      const htmlEmail =
        `<p>Olá, <strong>${proposta.cooperado.nomeCompleto}</strong>!</p>` +
        `<p>Obrigado por assinar sua proposta CoopereBR.</p>` +
        `<p>Segue em anexo a cópia do termo de adesão e procuração assinados.</p>` +
        `<p>Caminho do PDF: ${pdfPath}</p>`;
      const texto =
        `Olá, ${proposta.cooperado.nomeCompleto}! Segue a cópia assinada da sua proposta CoopereBR.`;

      await this.email.enviarEmail(
        proposta.cooperado.email,
        'Sua proposta CoopereBR assinada — cópia',
        htmlEmail,
        texto,
      );

      await this.prisma.propostaCooperado.update({
        where: { id: propostaId },
        data: { copiaAssinadaEnviadaEm: new Date() },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      console.error(`[Sprint10] Falha ao enviar cópia assinada ${propostaId}: ${msg}`);
    }
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
