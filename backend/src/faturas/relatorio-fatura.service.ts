import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface RelatorioMensal {
  cooperado: {
    nome: string;
    uc: string;
    distribuidora: string;
    endereco: string;
  };
  periodo: { mes: number; ano: number; mesLabel: string };
  faturaConcessionaria: {
    totalPago: number;
    consumoKwh: number;
    kwhCompensado: number;
    kwhInjetado: number;
    saldoAnterior: number;
    saldoAtual: number;
    tarifaTUSD: number;
    tarifaTE: number;
    bandeira: string;
    impostos: { icms: number; pisCofins: number; cip: number };
  };
  faturaCoopereBR: {
    valorCobrado: number;
    kwhUtilizados: number;
    beneficiosAplicados: number;
    totalDesconto: number;
    valorLiquido: number;
  };
  economia: {
    valorSemGD: number;
    valorComGD: number;
    economiaReais: number;
    economiaPercentual: number;
    economiaAcumuladaAno: number;
  };
  historico: { mes: string; kwhCompensado: number; valorCobrado: number; economia: number }[];
  mensagem: string;
}

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

@Injectable()
export class RelatorioFaturaService {
  constructor(private prisma: PrismaService) {}

  async gerarRelatorioByFaturaId(faturaId: string): Promise<RelatorioMensal> {
    const fatura = await this.prisma.faturaProcessada.findUnique({
      where: { id: faturaId },
      include: {
        cooperado: true,
        uc: true,
      },
    });
    if (!fatura) throw new BadRequestException('Fatura não encontrada');

    const dados = fatura.dadosExtraidos as any;

    // Parse mês/ano
    let mes = 0;
    let ano = 0;
    const mesRef = fatura.mesReferencia ?? dados?.mesReferencia ?? '';
    if (mesRef.includes('-')) {
      const [a, m] = mesRef.split('-');
      ano = parseInt(a, 10);
      mes = parseInt(m, 10);
    } else if (mesRef.includes('/')) {
      const [m, a] = mesRef.split('/');
      mes = parseInt(m, 10);
      ano = parseInt(a, 10);
    }

    // Dados concessionária
    const totalPago = Number(dados?.totalAPagar ?? 0);
    const consumoKwh = Number(dados?.consumoAtualKwh ?? 0);
    const kwhCompensado = Number(dados?.creditosRecebidosKwh ?? 0);
    const saldoAtual = Number(dados?.saldoTotalKwh ?? 0);
    const tarifaTUSD = Number(dados?.tarifaTUSD ?? 0);
    const tarifaTE = Number(dados?.tarifaTE ?? 0);

    // Buscar cobrança vinculada
    let cobranca: any = null;
    if (fatura.cobrancaGeradaId) {
      cobranca = await this.prisma.cobranca.findUnique({
        where: { id: fatura.cobrancaGeradaId },
      });
    }

    const valorCobrado = cobranca ? Number(cobranca.valorLiquido) : 0;
    const valorDesconto = cobranca ? Number(cobranca.valorDesconto) : 0;

    // Economia
    const tarifaUnit = tarifaTUSD + tarifaTE;
    const valorSemGD = consumoKwh * tarifaUnit + Number(dados?.contribIluminacaoPublica ?? 0);
    const valorComGD = totalPago + valorCobrado;
    const economiaReais = Math.max(0, valorSemGD - valorComGD);
    const economiaPercentual = valorSemGD > 0 ? (economiaReais / valorSemGD) * 100 : 0;

    // Economia acumulada no ano
    const cobrancasAno = await this.prisma.cobranca.findMany({
      where: {
        contrato: { cooperadoId: fatura.cooperadoId! },
        anoReferencia: ano,
      },
      select: { valorDesconto: true },
    });
    const economiaAcumuladaAno = cobrancasAno.reduce((acc, c) => acc + Number(c.valorDesconto), 0);

    // Histórico últimos 6 meses
    const faturasAnteriores = await this.prisma.faturaProcessada.findMany({
      where: { cooperadoId: fatura.cooperadoId },
      orderBy: { createdAt: 'desc' },
      take: 7,
      select: {
        mesReferencia: true,
        dadosExtraidos: true,
        cobrancaGeradaId: true,
      },
    });

    const historico: RelatorioMensal['historico'] = [];
    for (const f of faturasAnteriores.slice(0, 6)) {
      const d = f.dadosExtraidos as any;
      let cobValor = 0;
      if (f.cobrancaGeradaId) {
        const cob = await this.prisma.cobranca.findUnique({
          where: { id: f.cobrancaGeradaId },
          select: { valorLiquido: true, valorDesconto: true },
        });
        cobValor = cob ? Number(cob.valorLiquido) : 0;
      }
      historico.push({
        mes: f.mesReferencia ?? d?.mesReferencia ?? '',
        kwhCompensado: Number(d?.creditosRecebidosKwh ?? 0),
        valorCobrado: cobValor,
        economia: Number(d?.creditosRecebidosKwh ?? 0) * tarifaUnit * 0.15,
      });
    }

    return {
      cooperado: {
        nome: fatura.cooperado?.nomeCompleto ?? 'Não identificado',
        uc: fatura.uc?.numeroUC ?? dados?.numeroUC ?? '',
        distribuidora: fatura.uc?.distribuidora ?? dados?.distribuidora ?? '',
        endereco: fatura.uc?.endereco ?? dados?.enderecoInstalacao ?? '',
      },
      periodo: {
        mes,
        ano,
        mesLabel: `${MESES[mes] ?? ''} ${ano}`,
      },
      faturaConcessionaria: {
        totalPago,
        consumoKwh,
        kwhCompensado,
        kwhInjetado: kwhCompensado,
        saldoAnterior: saldoAtual + kwhCompensado,
        saldoAtual,
        tarifaTUSD,
        tarifaTE,
        bandeira: dados?.bandeiraTarifaria ?? 'VERDE',
        impostos: {
          icms: Number(dados?.icmsValor ?? 0),
          pisCofins: Number(dados?.pisCofinsValor ?? 0),
          cip: Number(dados?.contribIluminacaoPublica ?? 0),
        },
      },
      faturaCoopereBR: {
        valorCobrado,
        kwhUtilizados: kwhCompensado,
        beneficiosAplicados: 0,
        totalDesconto: valorDesconto,
        valorLiquido: valorCobrado,
      },
      economia: {
        valorSemGD: Math.round(valorSemGD * 100) / 100,
        valorComGD: Math.round(valorComGD * 100) / 100,
        economiaReais: Math.round(economiaReais * 100) / 100,
        economiaPercentual: Math.round(economiaPercentual * 100) / 100,
        economiaAcumuladaAno: Math.round(economiaAcumuladaAno * 100) / 100,
      },
      historico,
      mensagem: '',
    };
  }

  renderHtml(relatorio: RelatorioMensal): string {
    const r = relatorio;
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Mensal - ${r.cooperado.nome}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
    .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 24px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { margin: 0 0 4px; font-size: 18px; }
    .header p { margin: 0; opacity: 0.9; font-size: 13px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-top: 8px; }
    .card { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    .card h2 { margin: 0 0 12px; font-size: 15px; color: #374151; }
    .economia-destaque { background: #f0fdf4; border: 2px solid #16a34a; text-align: center; padding: 24px; }
    .economia-destaque .valor { font-size: 32px; font-weight: bold; color: #16a34a; }
    .economia-destaque .perc { font-size: 18px; color: #15803d; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .stat { background: #f9fafb; padding: 12px; border-radius: 8px; }
    .stat .label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
    .stat .value { font-size: 16px; font-weight: 600; color: #111827; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px; background: #f9fafb; color: #6b7280; font-size: 11px; text-transform: uppercase; }
    td { padding: 8px; border-top: 1px solid #f3f4f6; }
    .footer { text-align: center; padding: 20px; color: #9ca3af; font-size: 12px; }
    .footer a { color: #16a34a; text-decoration: none; }
  </style>
</head>
<body>
  <div class="header">
    <h1>SISGD</h1>
    <p>${r.cooperado.nome} | UC: ${r.cooperado.uc}</p>
    <p>${r.periodo.mesLabel}</p>
    <span class="badge">Energia Solar Compartilhada</span>
  </div>

  <div class="card economia-destaque">
    <h2>Sua economia este mes</h2>
    <div class="valor">R$ ${r.economia.economiaReais.toFixed(2)}</div>
    <div class="perc">${r.economia.economiaPercentual.toFixed(0)}% de economia</div>
    <p style="font-size:13px;color:#6b7280;margin-top:8px;">Economia acumulada no ano: R$ ${r.economia.economiaAcumuladaAno.toFixed(2)}</p>
  </div>

  <div class="card">
    <h2>Seus creditos</h2>
    <div class="grid">
      <div class="stat"><div class="label">kWh Compensados</div><div class="value">${r.faturaConcessionaria.kwhCompensado}</div></div>
      <div class="stat"><div class="label">kWh Injetados</div><div class="value">${r.faturaConcessionaria.kwhInjetado}</div></div>
      <div class="stat"><div class="label">Saldo Atual</div><div class="value">${r.faturaConcessionaria.saldoAtual} kWh</div></div>
      <div class="stat"><div class="label">Consumo</div><div class="value">${r.faturaConcessionaria.consumoKwh} kWh</div></div>
    </div>
  </div>

  <div class="card">
    <h2>Fatura Concessionaria</h2>
    <table>
      <tr><td>Consumo</td><td style="text-align:right">${r.faturaConcessionaria.consumoKwh} kWh</td></tr>
      <tr><td>TUSD</td><td style="text-align:right">R$ ${(r.faturaConcessionaria.tarifaTUSD * r.faturaConcessionaria.consumoKwh).toFixed(2)}</td></tr>
      <tr><td>TE</td><td style="text-align:right">R$ ${(r.faturaConcessionaria.tarifaTE * r.faturaConcessionaria.consumoKwh).toFixed(2)}</td></tr>
      <tr><td>Bandeira: ${r.faturaConcessionaria.bandeira}</td><td style="text-align:right">—</td></tr>
      <tr><td>ICMS</td><td style="text-align:right">R$ ${r.faturaConcessionaria.impostos.icms.toFixed(2)}</td></tr>
      <tr><td>PIS/COFINS</td><td style="text-align:right">R$ ${r.faturaConcessionaria.impostos.pisCofins.toFixed(2)}</td></tr>
      <tr><td>CIP</td><td style="text-align:right">R$ ${r.faturaConcessionaria.impostos.cip.toFixed(2)}</td></tr>
      <tr style="font-weight:bold"><td>Total pago</td><td style="text-align:right">R$ ${r.faturaConcessionaria.totalPago.toFixed(2)}</td></tr>
    </table>
  </div>

  <div class="card">
    <h2>Fatura CoopereBR</h2>
    <table>
      <tr><td>Valor base</td><td style="text-align:right">R$ ${(r.faturaCoopereBR.valorCobrado + r.faturaCoopereBR.totalDesconto).toFixed(2)}</td></tr>
      ${r.faturaCoopereBR.beneficiosAplicados > 0 ? `<tr><td>Beneficios de indicacao</td><td style="text-align:right;color:#16a34a">- R$ ${r.faturaCoopereBR.beneficiosAplicados.toFixed(2)}</td></tr>` : ''}
      <tr style="font-weight:bold"><td>Total a pagar</td><td style="text-align:right">R$ ${r.faturaCoopereBR.valorLiquido.toFixed(2)}</td></tr>
    </table>
  </div>

  <div class="footer">
    <p>Duvidas? Fale conosco via WhatsApp</p>
    <p><a href="#">Acesse seu portal do cooperado</a></p>
  </div>
</body>
</html>`;
  }
}
