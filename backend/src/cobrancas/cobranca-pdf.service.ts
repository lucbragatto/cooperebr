import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PdfGeneratorService } from '../motor-proposta/pdf-generator.service';

/**
 * Sprint 8B — Gera PDF de cobrança/fatura pra cooperado.
 *
 * Template diferencia DESCONTO (mostra economia) vs CLUBE (mostra tokens).
 * Inclui: código de barras, QR PIX, linha digitável quando disponíveis.
 */
@Injectable()
export class CobrancaPdfService {
  private readonly logger = new Logger(CobrancaPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfGenerator: PdfGeneratorService,
  ) {}

  async gerarPdf(cobrancaId: string): Promise<string> {
    const cobranca = await this.prisma.cobranca.findUnique({
      where: { id: cobrancaId },
      include: {
        contrato: {
          include: {
            cooperado: true,
            cooperativa: true,
            uc: true,
            usina: true,
          },
        },
        cobrancasGateway: { take: 1, orderBy: { createdAt: 'desc' } },
        asaasCobrancas: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!cobranca) throw new NotFoundException('Cobrança não encontrada');

    const cooperado = cobranca.contrato?.cooperado;
    const cooperativa = cobranca.contrato?.cooperativa;
    const uc = cobranca.contrato?.uc;

    // Dados de pagamento (CobrancaGateway ou AsaasCobranca)
    const gw = cobranca.cobrancasGateway?.[0];
    const asaas = cobranca.asaasCobrancas?.[0];
    const linkPagamento = gw?.linkPagamento || asaas?.linkPagamento || null;
    const pixCopiaECola = gw?.pixCopiaECola || asaas?.pixCopiaECola || null;
    const pixQrCodeBase64 = gw?.pixQrCode || asaas?.pixQrCode || null;
    const linhaDigitavel = gw?.linhaDigitavel || (asaas as any)?.linhaDigitavel || null;
    const boletoUrl = gw?.boletoUrl || asaas?.boletoUrl || null;

    // Modo remuneração
    const modoClube = (cooperado as any)?.modoRemuneracao === 'CLUBE';
    const desconto = Number(cobranca.percentualDesconto);
    const valorBruto = Number(cobranca.valorBruto);
    const valorDesconto = Number(cobranca.valorDesconto);
    const valorLiquido = Number(cobranca.valorLiquido);

    // Tokens estimados (se CLUBE)
    const valorTokenReais = 0.20; // TODO: ler do plano
    const tokensEstimados = modoClube ? Math.round(valorDesconto / valorTokenReais) : 0;

    const mesRef = `${String(cobranca.mesReferencia).padStart(2, '0')}/${cobranca.anoReferencia}`;
    const vencimento = new Date(cobranca.dataVencimento).toLocaleDateString('pt-BR');
    const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #16a34a; padding-bottom: 15px; margin-bottom: 20px; }
    .header h1 { color: #16a34a; font-size: 20px; }
    .header .info { text-align: right; font-size: 11px; color: #666; }
    .section { margin-bottom: 18px; }
    .section-title { font-weight: bold; font-size: 13px; color: #16a34a; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
    .field { font-size: 11px; }
    .field .label { color: #666; }
    .field .value { font-weight: 600; }
    .valor-box { background: #f0fdf4; border: 2px solid #16a34a; border-radius: 8px; padding: 15px; text-align: center; margin: 15px 0; }
    .valor-box .total { font-size: 28px; font-weight: bold; color: #16a34a; }
    .valor-box .sub { font-size: 11px; color: #666; margin-top: 4px; }
    .clube-box { background: #faf5ff; border: 2px solid #9333ea; border-radius: 8px; padding: 12px; margin: 10px 0; }
    .clube-box .title { color: #9333ea; font-weight: bold; font-size: 13px; }
    .clube-box .desc { font-size: 11px; color: #555; margin-top: 4px; }
    .pix-box { background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 12px; margin: 10px 0; }
    .pix-box .title { color: #1d4ed8; font-weight: bold; }
    .pix-box .code { font-family: monospace; font-size: 9px; word-break: break-all; background: #fff; padding: 8px; border-radius: 4px; margin-top: 6px; }
    .boleto-box { background: #fefce8; border: 1px solid #ca8a04; border-radius: 8px; padding: 12px; margin: 10px 0; }
    .boleto-box .title { color: #854d0e; font-weight: bold; }
    .boleto-box .code { font-family: monospace; font-size: 10px; letter-spacing: 1px; margin-top: 6px; }
    .footer { border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 10px; color: #999; text-align: center; margin-top: 20px; }
    table.detalhes { width: 100%; border-collapse: collapse; margin: 8px 0; }
    table.detalhes th { text-align: left; font-size: 11px; color: #666; border-bottom: 1px solid #e5e7eb; padding: 4px 0; }
    table.detalhes td { font-size: 12px; padding: 4px 0; }
    table.detalhes td.valor { text-align: right; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${cooperativa?.nome || 'CoopereBR'}</h1>
      <div style="font-size:11px; color:#666; margin-top:4px;">
        CNPJ: ${cooperativa?.cnpj || '—'}<br>
        ${cooperativa?.endereco ? `${cooperativa.endereco}, ${cooperativa.cidade}/${cooperativa.estado}` : ''}
      </div>
    </div>
    <div class="info">
      <strong>FATURA DE ENERGIA</strong><br>
      Competência: ${mesRef}<br>
      Vencimento: ${vencimento}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados do Cooperado</div>
    <div class="grid">
      <div class="field"><span class="label">Nome:</span> <span class="value">${cooperado?.nomeCompleto || '—'}</span></div>
      <div class="field"><span class="label">CPF/CNPJ:</span> <span class="value">${cooperado?.cpf || '—'}</span></div>
      <div class="field"><span class="label">UC:</span> <span class="value">${uc?.numero || '—'}</span></div>
      <div class="field"><span class="label">Endereço:</span> <span class="value">${uc?.endereco || '—'}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detalhamento</div>
    <table class="detalhes">
      <tr><th>Descrição</th><th style="text-align:right">Valor</th></tr>
      <tr><td>Valor bruto da energia</td><td class="valor">R$ ${fmt(valorBruto)}</td></tr>
      ${!modoClube ? `
      <tr><td>Desconto cooperativa (${desconto}%)</td><td class="valor" style="color:#16a34a">- R$ ${fmt(valorDesconto)}</td></tr>
      ` : ''}
      <tr style="font-weight:bold; border-top:2px solid #333;">
        <td>Total a pagar</td>
        <td class="valor" style="font-size:14px;">R$ ${fmt(valorLiquido)}</td>
      </tr>
    </table>
  </div>

  <div class="valor-box">
    <div class="total">R$ ${fmt(valorLiquido)}</div>
    <div class="sub">Vencimento: ${vencimento}</div>
  </div>

  ${modoClube ? `
  <div class="clube-box">
    <div class="title">🪙 Clube de Vantagens</div>
    <div class="desc">
      Você optou pelo Caminho Clube. Ao pagar esta fatura, receberá
      <strong>${tokensEstimados} tokens</strong> (equivalente a R$ ${fmt(valorDesconto)}).
      Tokens serão disponibilizados após a confirmação do pagamento.
    </div>
  </div>
  ` : ''}

  ${pixCopiaECola || pixQrCodeBase64 ? `
  <div class="pix-box">
    <div class="title">💚 Pague via PIX</div>
    ${pixQrCodeBase64 ? `
    <div style="text-align:center; margin:10px 0;">
      <img src="data:image/png;base64,${pixQrCodeBase64}" alt="QR Code PIX" style="width:180px; height:180px;" />
    </div>
    ` : ''}
    ${pixCopiaECola ? `
    <div style="font-size:10px; color:#555; margin-top:6px;">Copia e cola:</div>
    <div class="code">${pixCopiaECola}</div>
    ` : ''}
  </div>
  ` : ''}

  ${linhaDigitavel ? `
  <div class="boleto-box">
    <div class="title">📄 Boleto Bancário</div>
    <div class="code">${linhaDigitavel}</div>
    ${boletoUrl ? `
    <div style="text-align:center; margin-top:8px;">
      <a href="${boletoUrl}" style="color:#854d0e; font-size:11px;">📥 Baixar boleto completo (com código de barras)</a>
    </div>
    ` : ''}
  </div>
  ` : ''}

  ${linkPagamento ? `
  <div class="section" style="text-align:center;">
    <a href="${linkPagamento}" style="color:#1d4ed8; font-size:12px;">🔗 Acesse o link de pagamento online</a>
  </div>
  ` : ''}

  <div class="footer">
    ${cooperativa?.nome || 'CoopereBR'} — Energia limpa e economia garantida<br>
    ${cooperativa?.email ? `Email: ${cooperativa.email}` : ''} ${cooperativa?.telefone ? `| Tel: ${cooperativa.telefone}` : ''}
  </div>
</body>
</html>`;

    const nomeArquivo = `fatura-${mesRef.replace('/', '-')}-${cooperado?.nomeCompleto?.replace(/\s+/g, '-').substring(0, 30) || cobrancaId}.pdf`;
    return this.pdfGenerator.gerarPdf(html, nomeArquivo);
  }
}
