const COR_VERDE = '#22c55e';
const COR_FUNDO = '#f8fafc';
const COR_TEXTO = '#1e293b';
const COR_SUBTEXTO = '#64748b';

function layout(titulo: string, conteudo: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titulo}</title>
</head>
<body style="margin:0;padding:0;background:${COR_FUNDO};font-family:'Segoe UI',Roboto,Arial,sans-serif;color:${COR_TEXTO};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${COR_FUNDO};padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
  <tr>
    <td style="background:${COR_VERDE};padding:24px 32px;text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">☀️ CoopereBR</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.9);font-size:13px;">Cooperativa de Energia Solar</p>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      ${conteudo}
    </td>
  </tr>
  <tr>
    <td style="padding:16px 32px 24px;border-top:1px solid #e2e8f0;text-align:center;">
      <p style="margin:0;font-size:12px;color:${COR_SUBTEXTO};">
        CoopereBR — Energia solar acessível para todos<br/>
        Este é um e-mail automático. Em caso de dúvidas, responda este e-mail ou entre em contato pelo WhatsApp.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function botao(texto: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
<tr><td style="background:${COR_VERDE};border-radius:8px;padding:12px 28px;">
  <a href="${url}" style="color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">${texto}</a>
</td></tr>
</table>`;
}

const LINK_PORTAL = process.env.FRONTEND_URL ?? 'http://localhost:3001';

export function templateBoasVindas(nome: string): string {
  return layout('Bem-vindo à CoopereBR!', `
    <h2 style="margin:0 0 16px;color:${COR_TEXTO};font-size:20px;">Bem-vindo(a), ${nome}!</h2>
    <p style="margin:0 0 12px;line-height:1.6;">É uma alegria ter você conosco! Você agora faz parte de uma cooperativa de energia solar que gera economia real para todos os membros.</p>
    <h3 style="margin:20px 0 8px;font-size:16px;">Próximos passos:</h3>
    <ol style="margin:0;padding-left:20px;line-height:2;">
      <li>Envie seus documentos pelo portal</li>
      <li>Aguarde a análise da sua proposta</li>
      <li>Em breve você começa a economizar!</li>
    </ol>
    ${botao('Acessar Portal', `${LINK_PORTAL}/portal`)}
    <p style="margin:0;color:${COR_SUBTEXTO};font-size:14px;">Qualquer dúvida, estamos aqui!</p>
  `);
}

export function templateFatura(
  nome: string,
  mesRef: string,
  valor: number,
  vencimento: string,
  pixCopiaECola?: string | null,
  boletoUrl?: string | null,
  linhaDigitavel?: string | null,
): string {
  const secoesPagamento: string[] = [];
  if (pixCopiaECola) {
    secoesPagamento.push(`
      <tr><td style="padding:12px 16px;background:#f0fdf4;border-radius:8px;margin-bottom:8px;">
        <strong style="color:${COR_VERDE};">PIX Copia e Cola:</strong><br/>
        <code style="font-size:12px;word-break:break-all;color:${COR_TEXTO};">${pixCopiaECola}</code>
      </td></tr>
    `);
  }
  if (boletoUrl) {
    secoesPagamento.push(`
      <tr><td style="padding:8px 0;">
        ${botao('Abrir Boleto', boletoUrl)}
      </td></tr>
    `);
  }
  if (linhaDigitavel) {
    secoesPagamento.push(`
      <tr><td style="padding:12px 16px;background:#eff6ff;border-radius:8px;">
        <strong>Linha digitável:</strong><br/>
        <code style="font-size:12px;word-break:break-all;">${linhaDigitavel}</code>
      </td></tr>
    `);
  }

  return layout(`Fatura ${mesRef} — CoopereBR`, `
    <h2 style="margin:0 0 16px;font-size:20px;">Olá, ${nome}!</h2>
    <p style="margin:0 0 16px;line-height:1.6;">Sua fatura da CoopereBR chegou. Confira os detalhes abaixo:</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;padding:16px;margin-bottom:16px;">
      <tr><td style="padding:8px 16px;"><strong>Referência:</strong></td><td style="padding:8px 16px;text-align:right;">${mesRef}</td></tr>
      <tr><td style="padding:8px 16px;"><strong>Valor:</strong></td><td style="padding:8px 16px;text-align:right;font-size:20px;font-weight:700;color:${COR_VERDE};">R$ ${valor.toFixed(2)}</td></tr>
      <tr><td style="padding:8px 16px;"><strong>Vencimento:</strong></td><td style="padding:8px 16px;text-align:right;">${vencimento}</td></tr>
    </table>
    ${secoesPagamento.length ? `<table width="100%" cellpadding="0" cellspacing="8">${secoesPagamento.join('')}</table>` : ''}
    ${botao('Ver no Portal', `${LINK_PORTAL}/portal/financeiro`)}
    <p style="margin:0;font-size:13px;color:${COR_SUBTEXTO};">Lembre-se: o valor da sua fatura CoopereBR é bem menor do que você pagaria sem a cooperativa!</p>
  `);
}

export function templateConfirmacaoPagamento(nome: string, valor: number, mesRef: string, dataHora: string): string {
  return layout('Pagamento Confirmado — CoopereBR', `
    <h2 style="margin:0 0 16px;font-size:20px;">Pagamento confirmado!</h2>
    <p style="margin:0 0 16px;line-height:1.6;">Obrigado, ${nome}! Recebemos seu pagamento.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:8px;padding:16px;margin-bottom:16px;">
      <tr><td style="padding:8px 16px;"><strong>Referência:</strong></td><td style="padding:8px 16px;text-align:right;">${mesRef}</td></tr>
      <tr><td style="padding:8px 16px;"><strong>Valor pago:</strong></td><td style="padding:8px 16px;text-align:right;font-size:20px;font-weight:700;color:${COR_VERDE};">R$ ${valor.toFixed(2)}</td></tr>
      <tr><td style="padding:8px 16px;"><strong>Confirmado em:</strong></td><td style="padding:8px 16px;text-align:right;">${dataHora}</td></tr>
    </table>
    ${botao('Ver Histórico', `${LINK_PORTAL}/portal/financeiro`)}
    <p style="margin:0;font-size:13px;color:${COR_SUBTEXTO};">Até o próximo mês! ☀️</p>
  `);
}

export function templateDocumentoAprovado(nome: string): string {
  return layout('Documentos Aprovados — CoopereBR', `
    <h2 style="margin:0 0 16px;font-size:20px;">Boa notícia, ${nome}!</h2>
    <p style="margin:0 0 12px;line-height:1.6;">Seus documentos foram aprovados! Estamos preparando seu contrato e em breve você receberá o link para assinar.</p>
    <p style="margin:0 0 16px;line-height:1.6;"><strong>Prazo estimado:</strong> 1-2 dias úteis</p>
    ${botao('Acompanhar no Portal', `${LINK_PORTAL}/portal`)}
  `);
}

export function templateDocumentoReprovado(nome: string, motivo: string): string {
  return layout('Documentos — Correção Necessária', `
    <h2 style="margin:0 0 16px;font-size:20px;">${nome}, precisamos da sua ajuda!</h2>
    <p style="margin:0 0 12px;line-height:1.6;">Um ou mais documentos precisam ser corrigidos:</p>
    <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:4px;margin-bottom:16px;">
      <strong>Motivo:</strong> ${motivo}
    </div>
    <p style="margin:0 0 16px;line-height:1.6;">Por favor, acesse o portal e reenvie os documentos corrigidos.</p>
    ${botao('Reenviar Documentos', `${LINK_PORTAL}/portal/documentos`)}
  `);
}

export function templateContratoGerado(nome: string, linkContrato?: string): string {
  const link = linkContrato ?? `${LINK_PORTAL}/portal/documentos`;
  return layout('Seu Contrato está Pronto — CoopereBR', `
    <h2 style="margin:0 0 16px;font-size:20px;">Seu contrato está pronto, ${nome}!</h2>
    <p style="margin:0 0 16px;line-height:1.6;">Acesse o link abaixo para revisar e assinar digitalmente. É rápido e seguro!</p>
    ${botao('Assinar Contrato', link)}
    <p style="margin:0;font-size:13px;color:${COR_SUBTEXTO};">Após a assinatura, iniciaremos a alocação dos seus créditos de energia. ⚡</p>
  `);
}

export function templateTeste(): string {
  return layout('E-mail de Teste — CoopereBR', `
    <h2 style="margin:0 0 16px;font-size:20px;">E-mail de teste</h2>
    <p style="margin:0 0 12px;line-height:1.6;">Se você está lendo isto, o sistema de e-mail da CoopereBR está funcionando corretamente!</p>
    <p style="margin:0;font-size:13px;color:${COR_SUBTEXTO};">Enviado em: ${new Date().toLocaleString('pt-BR')}</p>
  `);
}
