import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ConfigTenantService } from '../config-tenant/config-tenant.service';

@Injectable()
export class PropostaPdfService {
  constructor(
    private prisma: PrismaService,
    private configTenant: ConfigTenantService,
  ) {}

  async gerarHtml(propostaId: string): Promise<string> {
    const proposta = await this.prisma.propostaCooperado.findUnique({
      where: { id: propostaId },
      include: {
        cooperado: {
          include: {
            ucs: { take: 1 },
          },
        },
        plano: true,
      },
    });
    if (!proposta) throw new NotFoundException('Proposta não encontrada');
    if (!proposta.cooperado.cooperativaId) throw new NotFoundException('Cooperado sem cooperativa vinculada');

    // Buscar histórico de faturas do cooperado
    const faturas = await this.prisma.faturaProcessada.findMany({
      where: { cooperadoId: proposta.cooperadoId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    const historico: Array<{ mesAno: string; consumoKwh: number; valorRS: number }> =
      faturas[0]?.historicoConsumo
        ? (faturas[0].historicoConsumo as any[])
        : [];

    // Config tenant (FATURA-02: filtrar por cooperativaId)
    const coopId = proposta.cooperado.cooperativaId;
    const [nomeEmpresa, enderecoEmpresa, emailEmpresa, whatsappEmpresa, sloganEmpresa] =
      await Promise.all([
        this.configTenant.get('nome_empresa', coopId),
        this.configTenant.get('endereco_empresa', coopId),
        this.configTenant.get('email_empresa', coopId),
        this.configTenant.get('whatsapp_empresa', coopId),
        this.configTenant.get('slogan_empresa', coopId),
      ]);

    const empresa = {
      nome: nomeEmpresa || 'COOPERE-BR',
      endereco: enderecoEmpresa || '',
      email: emailEmpresa || '',
      whatsapp: whatsappEmpresa || '',
      slogan: sloganEmpresa || 'Energia limpa, economia real.',
    };

    const coop = proposta.cooperado;
    const uc = coop.ucs[0];
    const dataFormatada = new Date().toLocaleDateString('pt-BR');

    const descontoPerc = Number(proposta.descontoPercentual);
    const economiaMensal = Number(proposta.economiaMensal);
    const economiaAnual = Number(proposta.economiaAnual);
    const economia5anos = economiaAnual * 5;
    const kwhApuradoBase = Number(proposta.kwhApuradoBase);
    const valorCooperado = Number(proposta.valorCooperado);
    const kwhContrato = Number(proposta.kwhContrato);
    const valorMedio12m = Number(proposta.valorMedio12m);
    const kwhMedio12m = Number(proposta.kwhMedio12m);

    const fmt = (v: number, decimals = 2) =>
      v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const fmtBRL = (v: number) => `R$ ${fmt(v)}`;

    // Tabela histórico 12 meses
    const tabelaHistorico = historico.map(h => {
      const consumo = Number(h.consumoKwh);
      const valorOriginal = Number(h.valorRS);
      const valorComDesconto = valorOriginal > 0
        ? valorOriginal * (1 - descontoPerc / 100)
        : consumo * valorCooperado;
      const descontoRS = valorOriginal - valorComDesconto;
      const descontoPct = valorOriginal > 0 ? (descontoRS / valorOriginal) * 100 : descontoPerc;

      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${h.mesAno}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmt(consumo, 0)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmtBRL(valorOriginal)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${fmtBRL(valorComDesconto)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#16a34a;">${fmtBRL(descontoRS)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#16a34a;">${fmt(descontoPct, 1)}%</td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proposta Comercial - ${empresa.nome}</title>
  <style>
    @media print { body { margin: 0; } .no-print { display: none !important; } }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; margin: 0; padding: 0; background: #f9fafb; }
    .container { max-width: 800px; margin: 0 auto; background: #fff; }
    .header { background: linear-gradient(135deg, #166534, #22c55e); color: #fff; padding: 40px; }
    .header h1 { margin: 0 0 4px; font-size: 28px; }
    .header p { margin: 0; opacity: 0.9; font-size: 14px; }
    .section { padding: 24px 40px; }
    .section-title { font-size: 16px; font-weight: 700; color: #166534; margin: 0 0 16px; padding-bottom: 8px; border-bottom: 2px solid #dcfce7; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .info-item label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px; }
    .info-item span { font-size: 14px; font-weight: 600; }
    .highlight-box { background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 12px; padding: 24px; margin: 16px 0; }
    .highlight-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; text-align: center; }
    .highlight-value { font-size: 28px; font-weight: 800; color: #166534; }
    .highlight-label { font-size: 12px; color: #4b5563; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; }
    .economy-cards { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .economy-card { background: #166534; color: #fff; border-radius: 12px; padding: 20px; text-align: center; }
    .economy-card .value { font-size: 24px; font-weight: 800; }
    .economy-card .label { font-size: 12px; opacity: 0.85; margin-top: 4px; }
    .footer { background: #f3f4f6; padding: 24px 40px; text-align: center; font-size: 12px; color: #6b7280; }
    .footer .empresa { font-weight: 700; color: #166534; font-size: 14px; }
    .print-btn { position: fixed; bottom: 24px; right: 24px; background: #166534; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .print-btn:hover { background: #15803d; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${empresa.nome}</h1>
      <p>${empresa.slogan}</p>
    </div>

    <div class="section">
      <h2 class="section-title">Proposta Comercial</h2>
      <div class="info-grid">
        <div class="info-item"><label>Cliente</label><span>${coop.nomeCompleto}</span></div>
        <div class="info-item"><label>Data</label><span>${dataFormatada}</span></div>
        <div class="info-item"><label>UC</label><span>${uc?.numero ?? '—'}</span></div>
        <div class="info-item"><label>Plano</label><span>${proposta.plano?.nome ?? 'Padrão'}</span></div>
      </div>
    </div>

    <div class="section" style="padding-top:0;">
      <h2 class="section-title">Dados da Análise</h2>
      <div class="info-grid">
        <div class="info-item"><label>Total médio fatura (12 meses)</label><span>${fmtBRL(valorMedio12m)}</span></div>
        <div class="info-item"><label>Consumo médio</label><span>${fmt(kwhMedio12m, 0)} kWh</span></div>
        <div class="info-item"><label>Valor kWh concessionária</label><span>R$ ${fmt(kwhApuradoBase, 5)}/kWh</span></div>
        <div class="info-item"><label>Valor kWh cooperativa</label><span style="color:#16a34a;">R$ ${fmt(valorCooperado, 5)}/kWh</span></div>
        <div class="info-item"><label>Percentual de desconto</label><span style="color:#16a34a;">${fmt(descontoPerc, 1)}%</span></div>
        <div class="info-item"><label>Estimativa com desconto</label><span style="color:#16a34a;">${fmtBRL(valorMedio12m * (1 - descontoPerc / 100))}/mês</span></div>
      </div>
    </div>

    ${historico.length > 0 ? `
    <div class="section" style="padding-top:0;">
      <h2 class="section-title">Histórico de Consumo (12 meses)</h2>
      <table>
        <thead>
          <tr>
            <th>Mês</th>
            <th style="text-align:right;">Consumo (kWh)</th>
            <th style="text-align:right;">Valor Original</th>
            <th style="text-align:right;">Com Desconto</th>
            <th style="text-align:right;">Economia R$</th>
            <th style="text-align:right;">Desconto %</th>
          </tr>
        </thead>
        <tbody>${tabelaHistorico}</tbody>
      </table>
    </div>` : ''}

    <div class="section" style="padding-top:0;">
      <div class="highlight-box">
        <h2 class="section-title" style="border:none;padding:0;margin-bottom:16px;text-align:center;">Sua Economia Projetada</h2>
        <div class="economy-cards">
          <div class="economy-card">
            <div class="value">${fmtBRL(economiaMensal)}</div>
            <div class="label">Economia Mensal</div>
          </div>
          <div class="economy-card">
            <div class="value">${fmtBRL(economiaAnual)}</div>
            <div class="label">Economia Anual</div>
          </div>
          <div class="economy-card" style="background:#0f4c25;">
            <div class="value">${fmtBRL(economia5anos)}</div>
            <div class="label">Economia em 5 anos</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p class="empresa">${empresa.nome}</p>
      ${empresa.endereco ? `<p>${empresa.endereco}</p>` : ''}
      <p>
        ${empresa.email ? `${empresa.email}` : ''}
        ${empresa.email && empresa.whatsapp ? ' | ' : ''}
        ${empresa.whatsapp ? `WhatsApp: ${empresa.whatsapp}` : ''}
      </p>
      <p style="margin-top:12px;font-size:11px;color:#9ca3af;">
        Proposta válida até ${new Date(proposta.validaAte).toLocaleDateString('pt-BR')}.
        Valores sujeitos a reajuste tarifário da concessionária.
      </p>
    </div>
  </div>

  <button class="print-btn no-print" onclick="window.print()">Imprimir / Salvar PDF</button>
</body>
</html>`;
  }
}
