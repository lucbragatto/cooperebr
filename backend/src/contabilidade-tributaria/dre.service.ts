import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma, StatusApuracao, TipoRegimeContabil } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ApuracaoService, PreviewApuracao } from './apuracao.service';

/**
 * D-novo-BR-CT CT.5 (31/05/2026) — DREs segregadas (4 visões).
 *
 * APRESENTAÇÃO pura — NÃO introduz lógica fiscal nova. Lê snapshot fechado
 * (ApuracaoMensalSegregada) OU faz preview on-the-fly via ApuracaoService.
 *
 * Terminologia cooperativa correta (NBC ITG 2004):
 *  - Ato PRÓPRIO usa "ingressos / dispêndios" (NÃO "receitas / despesas")
 *  - Ato AUXILIAR usa "ingressos / repasses"
 *  - Ato NÃO-COOP usa "receitas / despesas" (comercial puro)
 *
 * Regime: COOPERATIVO; demais → NotImplementedException (P0-1 — risco
 * aproveitamento indevido por extensão silenciosa).
 *
 * GATE WALTER: enquanto validadoContador=false, toda DRE retorna
 * `avisoValidacao` preenchido. UI deve mostrar badge "⚠️ PENDENTE
 * VALIDAÇÃO CONTADOR" em destaque.
 */
@Injectable()
export class DreService {
  private readonly logger = new Logger(DreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apuracaoService: ApuracaoService,
  ) {}

  async montarDre(
    cooperativaId: string,
    ano: number,
    mes: number,
    visao: VisaoDre,
  ): Promise<DreResultado> {
    if (!VISOES_VALIDAS.includes(visao)) {
      throw new ConflictException(`Visão inválida: ${visao}. Use: ${VISOES_VALIDAS.join('/')}`);
    }

    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { id: true, nome: true, regimeContabil: true },
    });
    if (!coop) throw new NotFoundException('Cooperativa não encontrada');
    if (coop.regimeContabil !== TipoRegimeContabil.COOPERATIVO) {
      throw new NotImplementedException(
        `DRE para regime ${coop.regimeContabil} ainda não implementada — ` +
          `risco P0-1. Vide docs/relatorios/2026-05-31-conformidade-contabil-multi-regime.md`,
      );
    }

    const fonte = await this.carregarFonte(cooperativaId, ano, mes);
    const dados = fonte.dados;
    const meta = fonte.meta;

    const linhas = this.montarLinhas(visao, dados);
    const totalRotulo = ROTULO_TOTAL[visao];

    return {
      cooperativaId,
      cooperativaNome: coop.nome,
      ano,
      mes,
      competencia: `${ano}-${String(mes).padStart(2, '0')}`,
      visao,
      titulo: TITULOS[visao],
      fundamentoLegal: FUNDAMENTOS[visao],
      linhas,
      totalRotulo,
      total: linhas.reduce(
        (acc, l) => (l.somaTotal ? acc.plus(l.valor) : acc),
        new Prisma.Decimal(0),
      ),
      fonte: meta.fonte,
      snapshotId: meta.snapshotId,
      validadoContador: meta.validadoContador,
      validadoEm: meta.validadoEm,
      avisoValidacao: meta.validadoContador
        ? null
        : '⚠️ PENDENTE VALIDAÇÃO CONTADOR — números calculados pelo motor, mas ainda não conferidos por Walter. NÃO usar pra DCTF/SPED/declaração fiscal real até validar.',
      fundamentoIsencao: dados.fundamentoIsencao,
    };
  }

  // ============================================================
  // Carregamento da fonte (snapshot ou preview)
  // ============================================================

  private async carregarFonte(
    cooperativaId: string,
    ano: number,
    mes: number,
  ): Promise<{
    dados: DadosApuracao;
    meta: {
      fonte: 'SNAPSHOT' | 'PREVIEW';
      snapshotId: string | null;
      validadoContador: boolean;
      validadoEm: Date | null;
    };
  }> {
    const snap = await this.prisma.apuracaoMensalSegregada.findUnique({
      where: { cooperativaId_ano_mes: { cooperativaId, ano, mes } },
    });

    if (snap && snap.status === StatusApuracao.FECHADA) {
      return {
        dados: {
          receitaPropria: snap.receitaPropria,
          receitaAuxiliar: snap.receitaAuxiliar,
          receitaNaoCoop: snap.receitaNaoCoop,
          despesaPropria: snap.despesaPropria,
          despesaAuxiliar: snap.despesaAuxiliar,
          despesaNaoCoop: snap.despesaNaoCoop,
          pisDevido: snap.pisDevido,
          cofinsDevido: snap.cofinsDevido,
          irpjDevido: snap.irpjDevido,
          csllDevido: snap.csllDevido,
          fundoReserva: snap.fundoReserva,
          fates: snap.fates,
          sobrasDistribuiveis: snap.sobrasDistribuiveis,
          fundamentoIsencao: snap.fundamentoIsencao,
        },
        meta: {
          fonte: 'SNAPSHOT',
          snapshotId: snap.id,
          validadoContador: snap.validadoContador,
          validadoEm: snap.validadoEm,
        },
      };
    }

    // Preview on-the-fly — apuração ainda não fechada
    const preview = await this.apuracaoService.apurarMes(cooperativaId, ano, mes);
    return {
      dados: this.previewToDados(preview),
      meta: {
        fonte: 'PREVIEW',
        snapshotId: null,
        validadoContador: false, // preview NUNCA é validado
        validadoEm: null,
      },
    };
  }

  private previewToDados(p: PreviewApuracao): DadosApuracao {
    return {
      receitaPropria: p.receitaPropria,
      receitaAuxiliar: p.receitaAuxiliar,
      receitaNaoCoop: p.receitaNaoCoop,
      despesaPropria: p.despesaPropria,
      despesaAuxiliar: p.despesaAuxiliar,
      despesaNaoCoop: p.despesaNaoCoop,
      pisDevido: p.pisDevido,
      cofinsDevido: p.cofinsDevido,
      irpjDevido: p.irpjDevido,
      csllDevido: p.csllDevido,
      fundoReserva: p.fundoReserva,
      fates: p.fates,
      sobrasDistribuiveis: p.sobrasDistribuiveis,
      fundamentoIsencao: p.fundamentoIsencao,
    };
  }

  // ============================================================
  // Composição das linhas por visão
  // ============================================================

  private montarLinhas(visao: VisaoDre, d: DadosApuracao): LinhaDre[] {
    switch (visao) {
      case 'geral':
        return this.linhasGeral(d);
      case 'proprio':
        return this.linhasProprio(d);
      case 'auxiliar':
        return this.linhasAuxiliar(d);
      case 'nao-coop':
        return this.linhasNaoCoop(d);
    }
  }

  private linhasGeral(d: DadosApuracao): LinhaDre[] {
    const sobrasBrutas = d.receitaPropria.minus(d.despesaPropria);
    const resNaoCoop = d.receitaNaoCoop.minus(d.despesaNaoCoop);
    const tributos = d.pisDevido.plus(d.cofinsDevido).plus(d.irpjDevido).plus(d.csllDevido);

    return [
      linha('header', '═══ ATO COOPERATIVO PRÓPRIO ═══'),
      linha('ingresso', '(+) Ingressos de ato próprio', d.receitaPropria),
      linha('dispendio', '(−) Dispêndios de ato próprio', d.despesaPropria.neg()),
      linha('subtotal', 'Sobras brutas (Art. 79 Lei 5.764/71)', sobrasBrutas),

      linha('header', '═══ ATO COOPERATIVO AUXILIAR ═══'),
      linha('ingresso', '(+) Ingressos de convênio (custeio)', d.receitaAuxiliar),
      linha('dispendio', '(−) Repasses de convênio', d.despesaAuxiliar.neg()),
      linha('subtotal', 'Resultado auxiliar (Art. 88 — trânsito esperado = 0)', d.receitaAuxiliar.minus(d.despesaAuxiliar)),

      linha('header', '═══ ATO NÃO-COOPERATIVO ═══'),
      linha('receita', '(+) Receitas não-cooperativas', d.receitaNaoCoop),
      linha('despesa', '(−) Despesas não-cooperativas', d.despesaNaoCoop.neg()),
      linha('subtotal', 'Resultado não-cooperativo (bruto)', resNaoCoop),
      linha('tributo', '(−) PIS', d.pisDevido.neg()),
      linha('tributo', '(−) COFINS', d.cofinsDevido.neg()),
      linha('tributo', '(−) IRPJ', d.irpjDevido.neg()),
      linha('tributo', '(−) CSLL', d.csllDevido.neg()),
      linha('subtotal', 'Resultado não-coop após tributos (→ FATES Art. 87)', resNaoCoop.minus(tributos)),

      linha('header', '═══ FUNDOS OBRIGATÓRIOS (Art. 28 Lei 5.764/71) ═══'),
      linha('fundo', 'Fundo de Reserva (FR)', d.fundoReserva),
      linha('fundo', 'FATES (sobras + resultado não-coop pós-tributos)', d.fates),

      linha('header', '═══ DESTINAÇÃO ═══'),
      linha('sobra', 'Sobras a distribuir (após FR + FATES)', d.sobrasDistribuiveis, true),
    ];
  }

  private linhasProprio(d: DadosApuracao): LinhaDre[] {
    const sobrasBrutas = d.receitaPropria.minus(d.despesaPropria);
    const fr = d.fundoReserva;
    const fatesDeSobras = sobrasBrutas.isPositive()
      ? round2(sobrasBrutas.mul('0.05')) // visão informativa — 5% das sobras
      : new Prisma.Decimal(0);

    return [
      linha('ingresso', '(+) Ingressos de ato próprio (Art. 79)', d.receitaPropria),
      linha('dispendio', '(−) Dispêndios de ato próprio', d.despesaPropria.neg()),
      linha('subtotal', 'Sobras brutas', sobrasBrutas),
      linha('header', '— Isenções fiscais aplicáveis —'),
      linha(
        'info',
        d.fundamentoIsencao
          ? `IRPJ/CSLL: isento (RIR/2018 Art. 182) · PIS/COFINS: ${d.fundamentoIsencao}`
          : 'IRPJ/CSLL: isento (RIR/2018 Art. 182) · PIS/COFINS: incide (flag isencao=false)',
      ),
      linha('header', '— Destinação obrigatória —'),
      linha('fundo', '(−) Fundo de Reserva 10%', fr.neg()),
      linha('fundo', '(−) FATES 5% (parcela de sobras)', fatesDeSobras.neg()),
      linha('sobra', 'Sobras a distribuir aos cooperados', d.sobrasDistribuiveis, true),
    ];
  }

  private linhasAuxiliar(d: DadosApuracao): LinhaDre[] {
    const transito = d.receitaAuxiliar.minus(d.despesaAuxiliar);
    return [
      linha('header', '═══ ATO AUXILIAR (Art. 88 Lei 5.764/71) ═══'),
      linha('info', 'Convênios pra consecução do objeto social — fluxo entrada=saída esperado'),
      linha('ingresso', '(+) Ingressos de convênio (custeio)', d.receitaAuxiliar),
      linha('dispendio', '(−) Repasses a provedores externos', d.despesaAuxiliar.neg()),
      linha('subtotal', 'Trânsito (esperado ≈ 0 — sem retenção configura ato auxiliar)', transito, true),
      linha(
        'info',
        transito.isZero()
          ? '✅ Trânsito zero — classificação ato auxiliar preservada (sem tributação)'
          : '⚠️ Trânsito ≠ 0 — risco de reclassificação como ato não-cooperativo (Walter revisa)',
      ),
    ];
  }

  private linhasNaoCoop(d: DadosApuracao): LinhaDre[] {
    const resBruto = d.receitaNaoCoop.minus(d.despesaNaoCoop);
    const tributos = d.pisDevido.plus(d.cofinsDevido).plus(d.irpjDevido).plus(d.csllDevido);
    const liquido = resBruto.minus(tributos);

    return [
      linha('header', '═══ ATO NÃO-COOPERATIVO (Art. 86 Lei 5.764/71) ═══'),
      linha('receita', '(+) Receitas de terceiros (não-cooperados)', d.receitaNaoCoop),
      linha('despesa', '(−) Despesas atreladas', d.despesaNaoCoop.neg()),
      linha('subtotal', 'Resultado bruto não-cooperativo', resBruto),

      linha('header', '— Tributos devidos (Lucro Presumido) —'),
      linha('tributo', '(−) PIS (0,65% sobre receita)', d.pisDevido.neg()),
      linha('tributo', '(−) COFINS (3% sobre receita)', d.cofinsDevido.neg()),
      linha('tributo', '(−) IRPJ (15% × base presumida + adicional)', d.irpjDevido.neg()),
      linha('tributo', '(−) CSLL (9% × base presumida)', d.csllDevido.neg()),
      linha('subtotal', 'Total tributos', tributos.neg()),

      linha('subtotal', 'Resultado líquido', liquido),
      linha('header', '— Destinação Art. 87 —'),
      linha('fundo', 'Resultado líquido positivo → integra FATES', liquido.isPositive() ? liquido : new Prisma.Decimal(0), true),
    ];
  }
}

// ============================================================
// Tipos públicos
// ============================================================

export type VisaoDre = 'geral' | 'proprio' | 'auxiliar' | 'nao-coop';
const VISOES_VALIDAS: VisaoDre[] = ['geral', 'proprio', 'auxiliar', 'nao-coop'];

const TITULOS: Record<VisaoDre, string> = {
  geral: 'DRE Consolidada — Visão Geral',
  proprio: 'DRE Ato Cooperativo Próprio (Art. 79 Lei 5.764/71)',
  auxiliar: 'DRE Ato Cooperativo Auxiliar (Art. 88)',
  'nao-coop': 'DRE Ato Não-Cooperativo (Art. 86)',
};

const FUNDAMENTOS: Record<VisaoDre, string> = {
  geral: 'Lei 5.764/71 + RIR/2018 + STF Tema 536 + STJ Tema 986 + NBC ITG 2004',
  proprio: 'Lei 5.764/71 Arts. 28+79 + RIR/2018 Art. 182 + STF Tema 536',
  auxiliar: 'Lei 5.764/71 Art. 88 + NBC ITG 2004',
  'nao-coop': 'Lei 5.764/71 Arts. 86+87 + Lei 9.249/95 + Lei 9.718/98',
};

const ROTULO_TOTAL: Record<VisaoDre, string> = {
  geral: 'Sobras a distribuir',
  proprio: 'Sobras a distribuir aos cooperados',
  auxiliar: 'Trânsito de convênio',
  'nao-coop': 'Resultado líquido → FATES',
};

export type TipoLinha =
  | 'header'
  | 'ingresso'
  | 'dispendio'
  | 'receita'
  | 'despesa'
  | 'subtotal'
  | 'tributo'
  | 'fundo'
  | 'sobra'
  | 'info';

export interface LinhaDre {
  tipo: TipoLinha;
  rotulo: string;
  valor: Prisma.Decimal;
  /** Se true, esta linha entra no total final da visão. */
  somaTotal: boolean;
}

export interface DreResultado {
  cooperativaId: string;
  cooperativaNome: string;
  ano: number;
  mes: number;
  competencia: string;
  visao: VisaoDre;
  titulo: string;
  fundamentoLegal: string;
  linhas: LinhaDre[];
  totalRotulo: string;
  total: Prisma.Decimal;
  fonte: 'SNAPSHOT' | 'PREVIEW';
  snapshotId: string | null;
  validadoContador: boolean;
  validadoEm: Date | null;
  avisoValidacao: string | null;
  fundamentoIsencao: string | null;
}

interface DadosApuracao {
  receitaPropria: Prisma.Decimal;
  receitaAuxiliar: Prisma.Decimal;
  receitaNaoCoop: Prisma.Decimal;
  despesaPropria: Prisma.Decimal;
  despesaAuxiliar: Prisma.Decimal;
  despesaNaoCoop: Prisma.Decimal;
  pisDevido: Prisma.Decimal;
  cofinsDevido: Prisma.Decimal;
  irpjDevido: Prisma.Decimal;
  csllDevido: Prisma.Decimal;
  fundoReserva: Prisma.Decimal;
  fates: Prisma.Decimal;
  sobrasDistribuiveis: Prisma.Decimal;
  fundamentoIsencao: string | null;
}

function linha(
  tipo: TipoLinha,
  rotulo: string,
  valor: Prisma.Decimal | string | number = new Prisma.Decimal(0),
  somaTotal = false,
): LinhaDre {
  const v = valor instanceof Prisma.Decimal ? valor : new Prisma.Decimal(valor);
  return { tipo, rotulo, valor: v, somaTotal };
}

function round2(d: Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toString());
}
