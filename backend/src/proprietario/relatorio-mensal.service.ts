import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { PdfGeneratorService } from '../motor-proposta/pdf-generator.service';
import { ProprietarioService } from './proprietario.service';
import {
  calcularRepasse,
  UsinaParaCalculo,
  TarifaResolver,
} from '../usinas/helpers/calcular-repasse';
import { calcularRepasseLiquido } from '../usinas/helpers/calcular-repasse-liquido';
import { AsPlatform } from '../common/tenant-context';

/**
 * Sub-Sprint F Etapa F (M30, 2026-05-26).
 *
 * Geracao de relatorio mensal PDF pro proprietario:
 *   - Sob demanda: POST /proprietario/relatorios/:usinaId/:mesAno
 *   - Automatico: @Cron('0 7 5 * *') dia 5 as 7am, mes anterior, envia
 *     por email pro Usina.proprietarioEmail
 *
 * Template HTML inline (template literal) — sem Handlebars pra manter
 * dependencias enxutas. Substitui dados via interpolation simples.
 *
 * PDF via PdfGeneratorService (Puppeteer) reusado de motor-proposta.
 */
@Injectable()
export class RelatorioMensalService {
  private readonly logger = new Logger(RelatorioMensalService.name);

  constructor(
    private prisma: PrismaService,
    private pdfGenerator: PdfGeneratorService,
    private proprietarioService: ProprietarioService,
  ) {}

  // ─── Endpoint sob demanda ────────────────────────────────────────

  async gerarSobDemanda(user: any, usinaId: string, mesAno: string): Promise<string> {
    // mesAno formato YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(mesAno)) {
      throw new BadRequestException('mesAno deve ser formato YYYY-MM (ex: 2026-04).');
    }

    // Multi-tenant guard via ProprietarioService.detalheUsina
    // (lanca NotFoundException se usina nao pertence ao portfolio).
    const detalhe = await this.proprietarioService.detalheUsina(user, usinaId);

    const competencia = new Date(mesAno + '-01');
    return this.gerarPdfPath(detalhe.usina, competencia);
  }

  // ─── Cron mensal dia 5 7h ─────────────────────────────────────────

  /**
   * Cron mensal: dia 5 do mes corrente as 7am.
   * Pra cada Usina com proprietarioEmail definido, gera PDF do mes anterior
   * e (futuramente) anexa em email pro proprietario.
   *
   * Por enquanto, GERA o PDF mas NAO ENVIA email — proximo passo
   * Sessao 2 / F.4 conecta ao EmailService quando Luciano confirmar
   * politica anti-spam.
   */
  @Cron('0 7 5 * *')
  @AsPlatform()
  async cronGerarRelatoriosMensais() {
    const usinas = await this.prisma.usina.findMany({
      where: { proprietarioEmail: { not: null } },
      select: { id: true, nome: true, proprietarioEmail: true },
    });

    if (usinas.length === 0) {
      this.logger.log('Cron relatorio mensal: 0 usinas com proprietarioEmail — nada a fazer');
      return;
    }

    const now = new Date();
    const competenciaMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    this.logger.log(
      `Cron relatorio mensal: ${usinas.length} usina(s) com email, competencia=${competenciaMesAnterior.toISOString().slice(0, 7)}`,
    );

    for (const u of usinas) {
      try {
        const usinaCompleta = await this.prisma.usina.findUnique({ where: { id: u.id } });
        if (!usinaCompleta) continue;
        const pdfPath = await this.gerarPdfPath(this.usinaToTemplateData(usinaCompleta), competenciaMesAnterior);
        this.logger.log(`Relatorio gerado: ${u.nome} -> ${pdfPath} (email envio pendente F.4)`);
      } catch (err) {
        this.logger.error(`Falha gerar relatorio ${u.nome}: ${(err as Error).message}`);
      }
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private usinaToTemplateData(u: any) {
    return {
      id: u.id,
      nome: u.nome,
      apelidoInterno: u.apelidoInterno,
      cidade: u.cidade,
      estado: u.estado,
      distribuidora: u.distribuidora,
      capacidadeKwh: Number(u.capacidadeKwh ?? 0),
      potenciaKwp: Number(u.potenciaKwp ?? 0),
      statusHomologacao: u.statusHomologacao,
      statusOperacional: u.statusOperacional,
      classeGdAnotada: u.classeGdAnotada,
      formaAquisicao: u.formaAquisicao,
      formaPagamentoDono: u.formaPagamentoDono,
      valorAluguelFixo: u.valorAluguelFixo !== null ? Number(u.valorAluguelFixo) : null,
      percentualGeracaoDono: u.percentualGeracaoDono !== null ? Number(u.percentualGeracaoDono) : null,
      valorKwhPadrao: u.valorKwhPadrao !== null ? Number(u.valorKwhPadrao) : null,
    };
  }

  private criarTarifaResolver(): TarifaResolver {
    return async (distribuidora: string | null, _competencia: Date) => {
      if (!distribuidora) return null;
      const tarifas = await this.prisma.tarifaConcessionaria.findMany({
        orderBy: { dataVigencia: 'desc' },
        take: 10,
      });
      const normD = distribuidora.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      const match = tarifas.find((t) => {
        const normC = t.concessionaria.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
        return normC.includes(normD) || normD.includes(normC);
      });
      if (!match) return null;
      return Number(match.tusdNova) + Number(match.teNova);
    };
  }

  async gerarPdfPath(usina: any, competencia: Date): Promise<string> {
    // Geracao da usina no mes
    const geracao = await this.prisma.geracaoMensal.findFirst({
      where: {
        usinaId: usina.id,
        competencia: {
          gte: new Date(competencia.getFullYear(), competencia.getMonth(), 1),
          lt: new Date(competencia.getFullYear(), competencia.getMonth() + 1, 1),
        },
      },
    });

    const kwhGerado = geracao ? Number(geracao.kwhGerado) : 0;

    // Calculo do repasse
    const tarifaResolver = this.criarTarifaResolver();
    const usinaCalc: UsinaParaCalculo = {
      formaPagamentoDono: usina.formaPagamentoDono,
      valorAluguelFixo: usina.valorAluguelFixo,
      percentualGeracaoDono: usina.percentualGeracaoDono,
      valorKwhPadrao: usina.valorKwhPadrao,
      distribuidora: usina.distribuidora,
    };
    // BH.5: relatório PDF mostra bruto + abatido + líquido
    const repasse = await calcularRepasseLiquido({
      usina: usinaCalc,
      usinaId: usina.id,
      cooperativaId: usina.cooperativaId!,
      geracaoMes: geracao ? { kwhGerado, competencia: geracao.competencia } : null,
      tarifaResolver,
      prisma: this.prisma,
    });

    // Despesas do mes (responsabilidade PROPRIETARIO ou COMPARTILHADO)
    const despesas = await this.prisma.contaAPagar.findMany({
      where: {
        usinaId: usina.id,
        responsavelPagamento: { in: ['PROPRIETARIO', 'COMPARTILHADO'] },
        OR: [
          { dataVencimento: { gte: new Date(competencia.getFullYear(), competencia.getMonth(), 1), lt: new Date(competencia.getFullYear(), competencia.getMonth() + 1, 1) } },
          { dataPagamento: { gte: new Date(competencia.getFullYear(), competencia.getMonth(), 1), lt: new Date(competencia.getFullYear(), competencia.getMonth() + 1, 1) } },
        ],
      },
    });

    // AN.4 (M42, 30/05/2026): busca RepasseProprietario real do período.
    // Fallback: período sem registro mostra "Sem registro de repasse".
    const periodoInicio = new Date(competencia.getFullYear(), competencia.getMonth(), 1);
    const periodoFim = new Date(competencia.getFullYear(), competencia.getMonth() + 1, 1);
    const repasseReal = await this.prisma.repasseProprietario.findUnique({
      where: {
        usinaId_periodoInicio_periodoFim: {
          usinaId: usina.id,
          periodoInicio,
          periodoFim,
        },
      },
      select: {
        id: true,
        status: true,
        valorBruto: true,
        totalDespesasAbatidas: true,
        valorLiquido: true,
        metodoPagamento: true,
        dataPagamento: true,
        comprovante: true,
        observacao: true,
        motivoCancelamento: true,
      },
    });

    const html = this.montarHtml({
      usina,
      competencia,
      kwhGerado,
      repasse,
      repasseReal,
      despesas: despesas.map((d) => ({
        descricao: d.descricao,
        categoria: d.categoria,
        valor: Number(d.valor),
        status: d.status,
        responsavelPagamento: d.responsavelPagamento,
      })),
    });

    const competenciaStr = `${competencia.getFullYear()}-${String(competencia.getMonth() + 1).padStart(2, '0')}`;
    const nomeArquivo = `relatorio-proprietario-${usina.apelidoInterno ?? usina.id}-${competenciaStr}.pdf`;
    return this.pdfGenerator.gerarPdf(html, nomeArquivo);
  }

  private montarHtml(dados: {
    usina: any;
    competencia: Date;
    kwhGerado: number;
    repasse: any;
    repasseReal: {
      id: string;
      status: string;
      valorBruto: any;
      totalDespesasAbatidas: any;
      valorLiquido: any;
      metodoPagamento: string | null;
      dataPagamento: Date | null;
      comprovante: string | null;
      observacao: string | null;
      motivoCancelamento: string | null;
    } | null;
    despesas: Array<{
      descricao: string;
      categoria: string;
      valor: number;
      status: string;
      responsavelPagamento: string | null;
    }>;
  }): string {
    const { usina, competencia, kwhGerado, repasse, repasseReal, despesas } = dados;
    const mesAno = `${String(competencia.getMonth() + 1).padStart(2, '0')}/${competencia.getFullYear()}`;
    const fmtMoney = (v: number | null) =>
      v === null ? '—' : `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtKwh = (v: number) =>
      `${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kWh`;

    const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0);
    const liquidoEstimado = (repasse.valor ?? 0) - totalDespesas;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório Mensal — ${usina.nome} — ${mesAno}</title>
<style>
  body { font-family: -apple-system, sans-serif; color: #333; padding: 20px; max-width: 800px; margin: auto; font-size: 12px; }
  h1 { color: #d97706; border-bottom: 2px solid #d97706; padding-bottom: 8px; }
  h2 { color: #555; margin-top: 24px; border-left: 4px solid #d97706; padding-left: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #fef3c7; color: #92400e; font-weight: 600; }
  .kpi { display: inline-block; margin: 4px 12px 4px 0; padding: 10px 14px; background: #fffbeb; border-radius: 6px; border: 1px solid #fde68a; }
  .kpi-label { font-size: 10px; color: #92400e; text-transform: uppercase; }
  .kpi-value { font-size: 18px; font-weight: 700; color: #b45309; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #999; }
  .alert { background: #fef2f2; border-left: 4px solid #dc2626; padding: 8px; margin: 8px 0; color: #991b1b; }
  .info { background: #eff6ff; border-left: 4px solid #2563eb; padding: 8px; margin: 8px 0; color: #1e40af; }
</style>
</head>
<body>

<h1>Relatório Mensal — ${escapeHtml(usina.nome)}</h1>
<p><strong>Competência:</strong> ${mesAno} &nbsp;|&nbsp; <strong>Localização:</strong> ${escapeHtml(usina.cidade ?? '—')}/${escapeHtml(usina.estado ?? '—')}</p>

<div>
  <div class="kpi"><div class="kpi-label">Geração no mês</div><div class="kpi-value">${fmtKwh(kwhGerado)}</div></div>
  <div class="kpi"><div class="kpi-label">Repasse previsto</div><div class="kpi-value">${fmtMoney(repasse.valor)}</div></div>
  <div class="kpi"><div class="kpi-label">Despesas (você)</div><div class="kpi-value">${fmtMoney(totalDespesas)}</div></div>
  <div class="kpi"><div class="kpi-label">Líquido estimado</div><div class="kpi-value">${fmtMoney(liquidoEstimado)}</div></div>
</div>

<h2>Dados da Usina</h2>
<table>
  <tr><th>Capacidade mensal</th><td>${fmtKwh(usina.capacidadeKwh ?? 0)}</td></tr>
  <tr><th>Potência</th><td>${usina.potenciaKwp ?? 0} kWp</td></tr>
  <tr><th>Status homologação</th><td>${escapeHtml(usina.statusHomologacao ?? '—')}</td></tr>
  <tr><th>Status operacional</th><td>${escapeHtml(usina.statusOperacional ?? 'OPERANDO')}</td></tr>
  <tr><th>Distribuidora</th><td>${escapeHtml(usina.distribuidora ?? '—')}</td></tr>
  <tr><th>Classe GD</th><td>${escapeHtml(usina.classeGdAnotada ?? '—')}</td></tr>
  <tr><th>Forma aquisição</th><td>${escapeHtml(usina.formaAquisicao ?? '—')}</td></tr>
  <tr><th>Forma pagamento dono</th><td>${escapeHtml(usina.formaPagamentoDono ?? '—')}</td></tr>
</table>

<h2>Cálculo do Repasse</h2>
${repasse.valor === null
    ? `<div class="alert"><strong>Cálculo pendente:</strong> ${escapeHtml(repasse.motivo ?? 'dados incompletos.')}</div>`
    : `<div class="info"><strong>Fórmula aplicada:</strong> ${escapeHtml(repasse.formula)} &nbsp;|&nbsp; <strong>Fonte tarifa:</strong> ${escapeHtml(repasse.fonteTarifa ?? '—')}</div>`}

<h2>Status do Repasse</h2>
${repasseReal
    ? (repasseReal.status === 'PAGO'
        ? `<div class="info" style="background:#dcfce7;border-left-color:#16a34a;color:#166534">
            <strong>✅ Pago</strong>
            &nbsp;|&nbsp; <strong>Data:</strong> ${repasseReal.dataPagamento ? new Date(repasseReal.dataPagamento).toLocaleDateString('pt-BR') : '—'}
            &nbsp;|&nbsp; <strong>Método:</strong> ${escapeHtml(repasseReal.metodoPagamento ?? '—')}
            &nbsp;|&nbsp; <strong>Valor líquido:</strong> ${fmtMoney(Number(repasseReal.valorLiquido))}
            ${repasseReal.comprovante ? `<br/><strong>Comprovante:</strong> <a href="${escapeHtml(repasseReal.comprovante)}">visualizar</a>` : ''}
            ${repasseReal.observacao ? `<br/><strong>Observação:</strong> ${escapeHtml(repasseReal.observacao)}` : ''}
          </div>`
        : repasseReal.status === 'CANCELADO'
          ? `<div class="alert" style="background:#f3f4f6;border-left-color:#6b7280;color:#374151">
              <strong>⊘ Cancelado</strong>
              ${repasseReal.motivoCancelamento ? `<br/><strong>Motivo:</strong> ${escapeHtml(repasseReal.motivoCancelamento)}` : ''}
            </div>`
          : `<div class="info" style="background:#fef9c3;border-left-color:#ca8a04;color:#854d0e">
              <strong>⏳ Aguardando pagamento</strong>
              &nbsp;|&nbsp; <strong>Valor líquido a pagar:</strong> ${fmtMoney(Number(repasseReal.valorLiquido))}
              ${Number(repasseReal.totalDespesasAbatidas) > 0 ? `&nbsp;|&nbsp; <em>Já abatido despesas: ${fmtMoney(Number(repasseReal.totalDespesasAbatidas))}</em>` : ''}
            </div>`)
    : `<div class="info" style="background:#f3f4f6;border-left-color:#6b7280;color:#374151"><em>Sem registro de repasse pra este período (cron mensal ainda não executou ou usina não elegível).</em></div>`
}

${repasse.detalhes ? `<table>
  ${repasse.detalhes.kwhGerado !== undefined ? `<tr><th>kWh gerado</th><td>${fmtKwh(repasse.detalhes.kwhGerado)}</td></tr>` : ''}
  ${repasse.detalhes.tarifaKwh !== undefined ? `<tr><th>Tarifa R$/kWh aplicada</th><td>${fmtMoney(repasse.detalhes.tarifaKwh)}</td></tr>` : ''}
  ${repasse.detalhes.percentual !== undefined ? `<tr><th>Percentual do dono</th><td>${repasse.detalhes.percentual}%</td></tr>` : ''}
  ${repasse.detalhes.valorFixo !== undefined ? `<tr><th>Valor fixo</th><td>${fmtMoney(repasse.detalhes.valorFixo)}</td></tr>` : ''}
</table>` : ''}

<h2>Despesas do Mês (sua responsabilidade)</h2>
${despesas.length === 0
    ? '<p style="color:#666">Nenhuma despesa registrada com responsabilidade do proprietário neste mês.</p>'
    : `<table>
        <thead><tr><th>Descrição</th><th>Categoria</th><th>Status</th><th>Responsável</th><th style="text-align:right">Valor</th></tr></thead>
        <tbody>
          ${despesas.map((d) => `
            <tr>
              <td>${escapeHtml(d.descricao)}</td>
              <td>${escapeHtml(d.categoria)}</td>
              <td>${escapeHtml(d.status)}</td>
              <td>${escapeHtml(d.responsavelPagamento ?? '—')}</td>
              <td style="text-align:right">${fmtMoney(d.valor)}</td>
            </tr>
          `).join('')}
          <tr><td colspan="4" style="text-align:right"><strong>Total</strong></td><td style="text-align:right"><strong>${fmtMoney(totalDespesas)}</strong></td></tr>
        </tbody>
      </table>`}

<div class="footer">
  <p>Status do repasse reflete o que o admin do parceiro registrou no SISGD.</p>
  <p>Gerado automaticamente por SISGD em ${new Date().toLocaleString('pt-BR')}.</p>
</div>

</body>
</html>`;
  }
}

function escapeHtml(s: string | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
