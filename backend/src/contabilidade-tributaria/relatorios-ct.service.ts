import {
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma, StatusApuracao, TipoRegimeContabil } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PdfGeneratorService } from '../motor-proposta/pdf-generator.service';
import { ApuracaoService } from './apuracao.service';

/**
 * D-novo-BR-CT CT.6 (31/05/2026) — Relatórios PDF defensáveis pra fisco.
 *
 * 3 relatórios:
 *  - DEMONSTRATIVO_NAO_LUCRATIVIDADE: prova ato próprio isento (Art. 79
 *    + STF Tema 536). Mostra que sobras NÃO são lucro.
 *  - MEMORIAL_CALCULO_FISCAL: passo-a-passo dos tributos (base, alíquota
 *    config, fundamento legal por linha).
 *  - DEMONSTRATIVO_REPASSES: aos proprietários por formaAquisicao
 *    (ALUGUEL=NAO_COOP × CESSAO/PROPRIA=PROPRIO).
 *
 * ⚠️ GATE WALTER: Watermark + cabeçalho destacado se validadoContador=false.
 * Lê SNAPSHOT se FECHADA; preview on-the-fly via ApuracaoService caso contrário.
 */
@Injectable()
export class RelatoriosCtService {
  private readonly logger = new Logger(RelatoriosCtService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfGeneratorService,
    private readonly apuracaoService: ApuracaoService,
  ) {}

  async gerar(
    cooperativaId: string,
    ano: number,
    mes: number,
    tipo: TipoRelatorioCt,
  ): Promise<{ pdfPath: string; nomeArquivo: string }> {
    if (!TIPOS_VALIDOS.includes(tipo)) {
      throw new NotFoundException(`Relatório desconhecido: ${tipo}`);
    }

    const coop = await this.prisma.cooperativa.findUnique({
      where: { id: cooperativaId },
      select: { id: true, nome: true, cnpj: true, regimeContabil: true },
    });
    if (!coop) throw new NotFoundException('Cooperativa não encontrada');
    if (coop.regimeContabil !== TipoRegimeContabil.COOPERATIVO) {
      throw new NotImplementedException(
        `Relatórios CT para regime ${coop.regimeContabil} ainda não implementados (P0-1).`,
      );
    }

    const { dados, validadoContador, validadoEm, fonte } = await this.carregarFonte(
      cooperativaId,
      ano,
      mes,
    );

    let html: string;
    switch (tipo) {
      case 'demonstrativo-nao-lucratividade':
        html = this.htmlDemonstrativoNaoLucratividade(coop, ano, mes, dados, {
          validadoContador,
          validadoEm,
          fonte,
        });
        break;
      case 'memorial-calculo-fiscal':
        html = this.htmlMemorialCalculoFiscal(coop, ano, mes, dados, {
          validadoContador,
          validadoEm,
          fonte,
        });
        break;
      case 'demonstrativo-repasses':
        html = await this.htmlDemonstrativoRepasses(coop, ano, mes, {
          validadoContador,
          validadoEm,
          fonte,
        });
        break;
    }

    const nomeArquivo = `ct-${tipo}-${cooperativaId.slice(0, 8)}-${ano}-${String(mes).padStart(2, '0')}.pdf`;
    const pdfPath = await this.pdf.gerarPdf(html, nomeArquivo);
    this.logger.log(
      `[CT.6] PDF ${tipo} gerado: ${nomeArquivo} (validadoContador=${validadoContador} fonte=${fonte})`,
    );
    return { pdfPath, nomeArquivo };
  }

  // ============================================================
  // Fonte de dados
  // ============================================================

  private async carregarFonte(
    cooperativaId: string,
    ano: number,
    mes: number,
  ): Promise<{
    dados: DadosRelatorio;
    validadoContador: boolean;
    validadoEm: Date | null;
    fonte: 'SNAPSHOT' | 'PREVIEW';
  }> {
    const snap = await this.prisma.apuracaoMensalSegregada.findUnique({
      where: { cooperativaId_ano_mes: { cooperativaId, ano, mes } },
    });
    if (snap && snap.status === StatusApuracao.FECHADA) {
      return {
        dados: snapToDados(snap),
        validadoContador: snap.validadoContador,
        validadoEm: snap.validadoEm,
        fonte: 'SNAPSHOT',
      };
    }
    const preview = await this.apuracaoService.apurarMes(cooperativaId, ano, mes);
    return {
      dados: previewToDados(preview),
      validadoContador: false,
      validadoEm: null,
      fonte: 'PREVIEW',
    };
  }

  // ============================================================
  // Templates HTML (estilo igual ao relatorio-mensal.service)
  // ============================================================

  private htmlDemonstrativoNaoLucratividade(
    coop: { nome: string; cnpj: string },
    ano: number,
    mes: number,
    d: DadosRelatorio,
    meta: MetaRel,
  ): string {
    const sobrasBrutas = d.receitaPropria.minus(d.despesaPropria);
    return baseHtml(
      `Demonstrativo de Não-Lucratividade — ${coop.nome} — ${ano}-${pad(mes)}`,
      meta,
      `
      <h1>Demonstrativo de Não-Lucratividade</h1>
      ${cabecalhoEntidade(coop, ano, mes, meta)}

      <div class="info">
        <strong>Objetivo:</strong> Comprovar, para fins de defesa em procedimento
        fiscalizatório, que as sobras apuradas neste mês NÃO constituem lucro,
        e sim resultado de ato cooperativo próprio (Art. 79 Lei 5.764/71) —
        portanto isento de IRPJ/CSLL (RIR/2018 Art. 182) e de PIS/COFINS
        (STF Tema 536, sob a redação atual da jurisprudência).
      </div>

      <h2>Apuração do ato cooperativo próprio</h2>
      <table>
        <tr><th>Ingressos de ato próprio (Art. 79)</th><td class="num">${fmtR(d.receitaPropria)}</td></tr>
        <tr><th>(−) Dispêndios de ato próprio</th><td class="num">${fmtR(d.despesaPropria.neg())}</td></tr>
        <tr class="total"><th>Sobras brutas</th><td class="num">${fmtR(sobrasBrutas)}</td></tr>
      </table>

      <h2>Por que não é lucro</h2>
      <ol>
        <li><strong>Origem:</strong> sobras decorrem da relação cooperativa-cooperado pra consecução do objeto social (Art. 79 Lei 5.764/71). Não há contraprestação comercial nem intermediação com terceiros.</li>
        <li><strong>Destinação obrigatória:</strong> dos R$ ${fmtR(sobrasBrutas)} apurados, R$ ${fmtR(d.fundoReserva)} vão pro Fundo de Reserva (Art. 28 I) e parcela ao FATES (Art. 28 II). Somente R$ ${fmtR(d.sobrasDistribuiveis)} podem ser distribuídos aos cooperados — proporcionalmente às operações (não ao capital).</li>
        <li><strong>Jurisprudência aplicável:</strong> STF Tema 536 reconhece isenção PIS/COFINS sobre ato cooperativo próprio. STJ Tema 986 reforça segregação SCEE. RIR/2018 Art. 182 expressamente isenta IRPJ sobre sobras de ato próprio.</li>
      </ol>

      <h2>Tributos sobre o ato próprio</h2>
      <table>
        <tr><th>IRPJ</th><td class="num">R$ 0,00</td><td>${d.fundamentoIsencao ? 'RIR/2018 Art. 182' : 'verificar'}</td></tr>
        <tr><th>CSLL</th><td class="num">R$ 0,00</td><td>${d.fundamentoIsencao ? 'RIR/2018 Art. 182' : 'verificar'}</td></tr>
        <tr><th>PIS</th><td class="num">R$ 0,00</td><td>${d.fundamentoIsencao ?? 'flag isencao=false → calculado'}</td></tr>
        <tr><th>COFINS</th><td class="num">R$ 0,00</td><td>${d.fundamentoIsencao ?? 'flag isencao=false → calculado'}</td></tr>
      </table>

      ${rodapeDefensabilidade(meta)}
      `,
    );
  }

  private htmlMemorialCalculoFiscal(
    coop: { nome: string; cnpj: string },
    ano: number,
    mes: number,
    d: DadosRelatorio,
    meta: MetaRel,
  ): string {
    const resNaoCoop = d.receitaNaoCoop.minus(d.despesaNaoCoop);
    const totalTributos = d.pisDevido.plus(d.cofinsDevido).plus(d.irpjDevido).plus(d.csllDevido);
    return baseHtml(
      `Memorial de Cálculo Fiscal — ${coop.nome} — ${ano}-${pad(mes)}`,
      meta,
      `
      <h1>Memorial de Cálculo Fiscal</h1>
      ${cabecalhoEntidade(coop, ano, mes, meta)}

      <div class="info">
        <strong>Objetivo:</strong> Demonstrar passo-a-passo como cada tributo
        foi calculado, citando alíquota aplicada, base de cálculo e fundamento
        legal — defensabilidade total perante a Receita Federal.
      </div>

      <h2>Bases segregadas (Art. 86 vs Art. 79)</h2>
      <table>
        <tr><th>Receita não-cooperativa (Art. 86)</th><td class="num">${fmtR(d.receitaNaoCoop)}</td></tr>
        <tr><th>(−) Despesa não-cooperativa atrelada</th><td class="num">${fmtR(d.despesaNaoCoop.neg())}</td></tr>
        <tr class="total"><th>Resultado bruto não-cooperativo</th><td class="num">${fmtR(resNaoCoop)}</td></tr>
      </table>

      <h2>PIS — Lei 9.718/98 (Lucro Presumido cumulativo)</h2>
      <p>Alíquota aplicada: <strong>0,65%</strong> sobre receita NÃO-COOP.</p>
      <p>Cálculo: ${fmtR(d.receitaNaoCoop)} × 0,65% = <strong>${fmtR(d.pisDevido)}</strong></p>
      <p><em>Observação:</em> PIS sobre receita PRÓPRIA = R$ 0,00 ${d.fundamentoIsencao ? `(${d.fundamentoIsencao})` : '— flag isencao=false → recalcular'}.</p>

      <h2>COFINS — Lei 9.718/98 (Lucro Presumido cumulativo)</h2>
      <p>Alíquota aplicada: <strong>3,00%</strong> sobre receita NÃO-COOP.</p>
      <p>Cálculo: ${fmtR(d.receitaNaoCoop)} × 3,00% = <strong>${fmtR(d.cofinsDevido)}</strong></p>

      <h2>IRPJ — Lei 9.249/95 Art. 15 + Lei 9.430/96 Art. 2</h2>
      <p>Base presumida: 32% (default — VALIDAR COM WALTER conforme atividade real).</p>
      <p>Cálculo: ${fmtR(resNaoCoop)} (resultado não-coop) × 32% × 15% = <strong>${fmtR(d.irpjDevido)}</strong></p>
      <p><em>Adicional 10%:</em> aplicado sobre parcela da base presumida que ultrapassa R$ 20.000,00/mês (Lei 9.249/95 Art. 3 §1).</p>

      <h2>CSLL — Lei 7.689/88 + Lei 9.249/95</h2>
      <p>Base presumida: 32% × resultado não-coop. Alíquota 9%.</p>
      <p>Cálculo: ${fmtR(resNaoCoop)} × 32% × 9% = <strong>${fmtR(d.csllDevido)}</strong></p>

      <h2>Total de tributos devidos</h2>
      <table>
        <tr><th>PIS</th><td class="num">${fmtR(d.pisDevido)}</td></tr>
        <tr><th>COFINS</th><td class="num">${fmtR(d.cofinsDevido)}</td></tr>
        <tr><th>IRPJ</th><td class="num">${fmtR(d.irpjDevido)}</td></tr>
        <tr><th>CSLL</th><td class="num">${fmtR(d.csllDevido)}</td></tr>
        <tr class="total"><th>Total</th><td class="num">${fmtR(totalTributos)}</td></tr>
      </table>

      <h2>Destinação Lei 5.764/71 Art. 28 + Art. 87</h2>
      <ul>
        <li>Fundo de Reserva (10% sobras): <strong>${fmtR(d.fundoReserva)}</strong></li>
        <li>FATES (5% sobras + resultado não-coop pós-tributos): <strong>${fmtR(d.fates)}</strong></li>
        <li>Sobras distribuíveis (proporcionalidade às operações): <strong>${fmtR(d.sobrasDistribuiveis)}</strong></li>
      </ul>

      ${rodapeDefensabilidade(meta)}
      `,
    );
  }

  private async htmlDemonstrativoRepasses(
    coop: { id: string; nome: string; cnpj: string },
    ano: number,
    mes: number,
    meta: MetaRel,
  ): Promise<string> {
    const competencia = `${ano}-${pad(mes)}`;
    // RepasseProprietario filtra por periodoInicio/periodoFim (não competencia String).
    // Recorta o mês: [primeiro dia, último dia].
    const periodoInicio = new Date(ano, mes - 1, 1);
    const periodoFim = new Date(ano, mes, 0, 23, 59, 59);

    const repassesRaw = await this.prisma.repasseProprietario.findMany({
      where: {
        cooperativaId: coop.id,
        status: 'PAGO',
        dataPagamento: { gte: periodoInicio, lte: periodoFim },
      },
      include: {
        usina: { select: { nome: true, formaAquisicao: true, apelidoInterno: true } },
      },
      orderBy: [{ dataPagamento: 'asc' }],
    });

    type RepasseItem = {
      id: string;
      valorLiquido: Prisma.Decimal;
      dataPagamento: Date | null;
      usina: { nome: string; formaAquisicao: string | null; apelidoInterno: string | null } | null;
    };
    const repasses: RepasseItem[] = repassesRaw.map((r) => ({
      id: r.id,
      valorLiquido: r.valorLiquido,
      dataPagamento: r.dataPagamento,
      usina: r.usina,
    }));

    const grupos: Record<string, RepasseItem[]> = {
      ALUGUEL: [],
      CESSAO: [],
      PROPRIA: [],
      SEM_FORMA: [],
    };
    for (const r of repasses) {
      const f = r.usina?.formaAquisicao ?? 'SEM_FORMA';
      (grupos[f] ?? grupos.SEM_FORMA).push(r);
    }

    const somar = (lista: typeof repasses) =>
      lista.reduce((acc, r) => acc.plus(r.valorLiquido), new Prisma.Decimal(0));

    return baseHtml(
      `Demonstrativo de Repasses — ${coop.nome} — ${competencia}`,
      meta,
      `
      <h1>Demonstrativo de Repasses aos Proprietários</h1>
      ${cabecalhoEntidade(coop, ano, mes, meta)}

      <div class="info">
        <strong>Classificação cooperativa (Art. 79/86 Lei 5.764/71):</strong>
        ALUGUEL = ato NÃO-cooperativo (proprietário sem vínculo) · CESSÃO/PRÓPRIA = ato cooperativo próprio (cooperado-proprietário).
        Esta segregação espelha a auditoria que o fisco realiza.
      </div>

      <h2>ALUGUEL — ato NÃO-cooperativo (Art. 86)</h2>
      ${tabelaRepasses(grupos.ALUGUEL, somar(grupos.ALUGUEL))}

      <h2>CESSÃO — ato cooperativo próprio (Art. 79)</h2>
      ${tabelaRepasses(grupos.CESSAO, somar(grupos.CESSAO))}

      <h2>PRÓPRIA — usinas da cooperativa</h2>
      ${tabelaRepasses(grupos.PROPRIA, somar(grupos.PROPRIA))}

      ${
        grupos.SEM_FORMA.length > 0
          ? `<h2>SEM CLASSIFICAÇÃO</h2>
             <div class="alert">⚠️ ${grupos.SEM_FORMA.length} repasse(s) sem <code>formaAquisicao</code> — auditoria de cadastro de usina pendente.</div>
             ${tabelaRepasses(grupos.SEM_FORMA, somar(grupos.SEM_FORMA))}`
          : ''
      }

      ${rodapeDefensabilidade(meta)}
      `,
    );
  }
}

// ============================================================
// Tipos públicos
// ============================================================

export type TipoRelatorioCt =
  | 'demonstrativo-nao-lucratividade'
  | 'memorial-calculo-fiscal'
  | 'demonstrativo-repasses';

const TIPOS_VALIDOS: TipoRelatorioCt[] = [
  'demonstrativo-nao-lucratividade',
  'memorial-calculo-fiscal',
  'demonstrativo-repasses',
];

interface DadosRelatorio {
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

interface MetaRel {
  validadoContador: boolean;
  validadoEm: Date | null;
  fonte: 'SNAPSHOT' | 'PREVIEW';
}

function snapToDados(s: any): DadosRelatorio {
  return {
    receitaPropria: s.receitaPropria,
    receitaAuxiliar: s.receitaAuxiliar,
    receitaNaoCoop: s.receitaNaoCoop,
    despesaPropria: s.despesaPropria,
    despesaAuxiliar: s.despesaAuxiliar,
    despesaNaoCoop: s.despesaNaoCoop,
    pisDevido: s.pisDevido,
    cofinsDevido: s.cofinsDevido,
    irpjDevido: s.irpjDevido,
    csllDevido: s.csllDevido,
    fundoReserva: s.fundoReserva,
    fates: s.fates,
    sobrasDistribuiveis: s.sobrasDistribuiveis,
    fundamentoIsencao: s.fundamentoIsencao,
  };
}

function previewToDados(p: any): DadosRelatorio {
  return snapToDados(p);
}

// ============================================================
// Helpers HTML
// ============================================================

function baseHtml(title: string, meta: MetaRel, body: string): string {
  const watermark = meta.validadoContador
    ? ''
    : `<div class="watermark">PENDENTE VALIDAÇÃO CONTADOR</div>`;
  const headerBanner = meta.validadoContador
    ? `<div class="validated">✅ VALIDADO PELO CONTADOR ${meta.validadoEm ? `em ${meta.validadoEm.toLocaleString('pt-BR')}` : ''}</div>`
    : `<div class="pending">⚠️ DOCUMENTO NÃO-VALIDADO PELO CONTADOR — não usar pra DCTF/SPED/declaração fiscal real até validação por profissional habilitado.</div>`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: -apple-system, sans-serif; color: #333; padding: 20px; max-width: 900px; margin: auto; font-size: 12px; position: relative; }
  h1 { color: #0e7490; border-bottom: 2px solid #0e7490; padding-bottom: 8px; }
  h2 { color: #555; margin-top: 24px; border-left: 4px solid #0e7490; padding-left: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #eee; vertical-align: top; }
  th { background: #ecfeff; color: #155e75; font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .total th, .total td { background: #cffafe; font-weight: 700; }
  .info { background: #eff6ff; border-left: 4px solid #2563eb; padding: 10px; margin: 12px 0; color: #1e40af; }
  .alert { background: #fef2f2; border-left: 4px solid #dc2626; padding: 10px; margin: 8px 0; color: #991b1b; }
  .pending { background: #fef3c7; border: 2px solid #d97706; padding: 12px; margin: 0 0 16px; color: #92400e; font-weight: 700; text-align: center; font-size: 13px; }
  .validated { background: #dcfce7; border: 2px solid #16a34a; padding: 10px; margin: 0 0 16px; color: #166534; font-weight: 600; text-align: center; }
  .watermark { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 72px; color: rgba(217, 119, 6, 0.12); transform: rotate(-25deg); pointer-events: none; font-weight: 900; letter-spacing: 4px; z-index: -1; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #999; }
  ol, ul { line-height: 1.7; }
  code { background: #f3f4f6; padding: 1px 4px; border-radius: 3px; }
</style>
</head>
<body>
${watermark}
${headerBanner}
${body}
</body>
</html>`;
}

function cabecalhoEntidade(
  coop: { nome: string; cnpj: string },
  ano: number,
  mes: number,
  meta: MetaRel,
): string {
  return `<p>
    <strong>Cooperativa:</strong> ${escapeHtml(coop.nome)} (CNPJ ${escapeHtml(coop.cnpj ?? '—')})<br/>
    <strong>Competência:</strong> ${ano}-${pad(mes)} &nbsp;|&nbsp;
    <strong>Fonte:</strong> ${meta.fonte === 'SNAPSHOT' ? 'apuração fechada (snapshot imutável)' : 'preview on-the-fly (apuração ainda aberta)'}<br/>
    <strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}
  </p>`;
}

function rodapeDefensabilidade(meta: MetaRel): string {
  return `<div class="footer">
    <p><strong>Fundamento legal:</strong> Lei 5.764/71 (Política Nacional do Cooperativismo) · RIR/2018 Decreto 9.580 · STF Tema 536 (PIS/COFINS) · STJ Tema 986 (SCEE) · Lei 9.249/95 (IRPJ presumido) · Lei 9.718/98 (PIS/COFINS) · NBC ITG 2004 (cooperativas).</p>
    <p><strong>Status:</strong> ${meta.validadoContador ? 'Documento validado pelo contador responsável.' : '⚠️ Documento PRÉ-VALIDAÇÃO — números calculados pelo motor SISGD/CoopereBR mas não conferidos por profissional habilitado. Use estritamente como insumo de revisão.'}</p>
    <p>SISGD/CoopereBR — Contabilidade Tributária Segregada — CT.6 Sprint Contabilidade Tributária.</p>
  </div>`;
}

function tabelaRepasses(
  lista: Array<{
    id: string;
    valorLiquido: Prisma.Decimal;
    dataPagamento: Date | null;
    usina: { nome: string; formaAquisicao: string | null; apelidoInterno: string | null } | null;
  }>,
  total: Prisma.Decimal,
): string {
  if (lista.length === 0) {
    return '<p style="color:#666">Nenhum repasse PAGO nesta forma de aquisição no período.</p>';
  }
  return `<table>
    <thead><tr><th>Usina</th><th>Apelido</th><th>Data pagamento</th><th class="num">Valor líquido</th></tr></thead>
    <tbody>
      ${lista
        .map(
          (r) => `
        <tr>
          <td>${escapeHtml(r.usina?.nome ?? '—')}</td>
          <td>${escapeHtml(r.usina?.apelidoInterno ?? '—')}</td>
          <td>${r.dataPagamento ? r.dataPagamento.toLocaleDateString('pt-BR') : '—'}</td>
          <td class="num">${fmtR(r.valorLiquido)}</td>
        </tr>`,
        )
        .join('')}
      <tr class="total"><td colspan="3"><strong>Total</strong></td><td class="num">${fmtR(total)}</td></tr>
    </tbody>
  </table>`;
}

function fmtR(v: Prisma.Decimal | number | null | undefined): string {
  if (v === null || v === undefined) return 'R$ 0,00';
  const n = typeof v === 'number' ? v : Number(v.toString());
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
