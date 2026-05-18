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

const LINK_PORTAL = process.env.FRONTEND_URL ?? 'https://cooperebr.com.br';

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

export function templateCadastroAprovado(nome: string): string {
  return layout('Cadastro Aprovado — CoopereBR', `
    <h2 style="margin:0 0 16px;font-size:20px;">Parabéns, ${nome}!</h2>
    <p style="margin:0 0 12px;line-height:1.6;">Seu cadastro na CoopereBR foi <strong style="color:${COR_VERDE};">aprovado</strong>! Toda a documentação foi verificada com sucesso.</p>
    <p style="margin:0 0 12px;line-height:1.6;">Agora estamos alocando sua cota de energia solar. Em breve você receberá seu contrato para assinatura e começará a economizar na conta de luz!</p>
    <h3 style="margin:20px 0 8px;font-size:16px;">O que acontece agora?</h3>
    <ol style="margin:0;padding-left:20px;line-height:2;">
      <li>Alocação da sua cota em uma usina solar</li>
      <li>Geração do contrato para assinatura digital</li>
      <li>Início dos créditos de energia na sua conta</li>
    </ol>
    ${botao('Acompanhar no Portal', `${LINK_PORTAL}/portal`)}
    <p style="margin:0;color:${COR_SUBTEXTO};font-size:14px;">Qualquer dúvida, estamos à disposição!</p>
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

/**
 * Bloco D CRON A (16/05/2026) — Lembrete pra cooperado completar upload de docs.
 * Tom informal-respeitoso, lista visual 🔴 PENDENTE / ⚠️ REPROVADO + link upload.
 */
export function templateLembreteDocsPendentes(
  nome: string,
  docsPendentes: Array<{ tipo: string; status: 'PENDENTE' | 'REPROVADO'; motivo?: string | null }>,
  tentativa: number,
): string {
  const itens = docsPendentes
    .map(d => {
      const icone = d.status === 'REPROVADO' ? '⚠️' : '🔴';
      const cor = d.status === 'REPROVADO' ? '#dc2626' : '#ea580c';
      const obs = d.motivo ? `<br/><span style="font-size:12px;color:${COR_SUBTEXTO};">${d.motivo}</span>` : '';
      return `<li style="margin:6px 0;color:${cor};">${icone} <strong style="color:${COR_TEXTO};">${d.tipo}</strong> — ${d.status === 'REPROVADO' ? 'reprovado, reenviar' : 'pendente'}${obs}</li>`;
    })
    .join('');
  const sufixoTentativa = tentativa > 1 ? ` (${tentativa}ª lembrança)` : '';
  return layout(`Faltam documentos — CoopereBR${sufixoTentativa}`, `
    <h2 style="margin:0 0 16px;font-size:20px;">Oi, ${nome}! 👋</h2>
    <p style="margin:0 0 12px;line-height:1.6;">Seu cadastro na CoopereBR está quase fechando — faltam alguns documentos pra liberarmos sua alocação de créditos solares.</p>
    <h3 style="margin:20px 0 8px;font-size:15px;color:${COR_TEXTO};">Documentos faltantes:</h3>
    <ul style="margin:0;padding-left:20px;line-height:1.8;list-style:none;">
      ${itens}
    </ul>
    ${botao('Enviar documentos', `${LINK_PORTAL}/portal/documentos`)}
    <p style="margin:16px 0 0;font-size:13px;color:${COR_SUBTEXTO};">Dúvida sobre algum documento? Responde este e-mail ou chama no WhatsApp — o time te ajuda.</p>
  `);
}

/**
 * Bloco D CRON B (16/05/2026) — Alerta admin sobre cooperados com docs parados > N dias.
 * Email único agregado (não 1 por cooperado).
 */
export function templateAlertaAdminDocsParados(
  nomeCooperativa: string,
  diasLimite: number,
  cooperados: Array<{ nome: string; diasParado: number; docsPendentes: number }>,
): string {
  const rows = cooperados
    .map(c => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${c.nome}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;color:#dc2626;font-weight:600;">${c.diasParado}d</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${c.docsPendentes}</td>
      </tr>
    `)
    .join('');
  return layout(`[Admin] ${cooperados.length} cooperado(s) com docs parados > ${diasLimite}d`, `
    <h2 style="margin:0 0 16px;font-size:20px;">Alerta de cooperados parados — ${nomeCooperativa}</h2>
    <p style="margin:0 0 12px;line-height:1.6;">${cooperados.length} cooperado(s) estão com documentação pendente há <strong>mais de ${diasLimite} dias</strong>. Lembretes automáticos já foram enviados a cada um — pode ser hora de contato manual ou cancelamento.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 12px;text-align:left;border-bottom:2px solid #e2e8f0;">Cooperado</th>
          <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">Dias parado</th>
          <th style="padding:10px 12px;text-align:center;border-bottom:2px solid #e2e8f0;">Docs pendentes</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    ${botao('Abrir lista no painel', `${LINK_PORTAL}/dashboard/cooperados?status=PENDENTE_DOCUMENTOS`)}
    <p style="margin:16px 0 0;font-size:13px;color:${COR_SUBTEXTO};">Resumo gerado automaticamente. Sugestão: priorize contato manual com cooperados há mais de ${diasLimite + 7} dias parados.</p>
  `);
}

/**
 * Bloco D CRON C (16/05/2026) — Lembrete pra cooperado configurar email institucional
 * do parceiro no portal EDP, pra fatura ser entregue automaticamente no SISGD.
 */
export function templateLembreteEmailEdp(
  nome: string,
  emailInstitucionalParceiro: string,
  reforco: boolean,
): string {
  const prefixo = reforco ? '🔔 [Reforço] ' : '';
  const titulo = `${prefixo}Salve nosso email no portal da EDP — CoopereBR`;
  return layout(titulo, `
    <h2 style="margin:0 0 16px;font-size:20px;">${prefixo}Falta um passo, ${nome}! ⚡</h2>
    <p style="margin:0 0 12px;line-height:1.6;">Pra você economizar de verdade na conta de luz, precisamos receber sua fatura EDP todo mês. Isso é feito em <strong>2 minutos</strong> no portal da EDP-ES.</p>
    <h3 style="margin:20px 0 8px;font-size:15px;color:${COR_TEXTO};">Passo a passo:</h3>
    <ol style="margin:0;padding-left:20px;line-height:1.9;">
      <li>Acesse <a href="https://www.edponline.com.br" style="color:${COR_VERDE};">edponline.com.br</a> e entre com seu CPF/CNPJ</li>
      <li>Vá no menu <strong>"Minha conta"</strong> → <strong>"Email para envio de fatura"</strong> (ou similar)</li>
      <li>Digite (ou cole): <code style="background:#f0fdf4;padding:4px 8px;border-radius:4px;color:${COR_VERDE};font-weight:600;">${emailInstitucionalParceiro}</code></li>
      <li>Salve. Pronto! 🎉</li>
    </ol>
    <div style="background:#fef9c3;border-left:4px solid #ca8a04;padding:12px 16px;border-radius:4px;margin:16px 0;">
      <strong style="color:#92400e;">⚠️ Importante:</strong> sem esse passo, sua fatura não chega no nosso sistema e o desconto pode atrasar.
    </div>
    ${botao('Acessar EDP Online', 'https://www.edponline.com.br')}
    <p style="margin:16px 0 0;font-size:13px;color:${COR_SUBTEXTO};">${reforco ? 'Já mandamos essa instrução antes — chega de spam, esse é o último lembrete automático. ' : ''}Travou em algum passo? Responde este e-mail que o time te orienta.</p>
  `);
}

export function templateRelatorioConvenio(
  convenioNome: string,
  competencia: string,
  totalMembros: number,
  faixaAtual: number,
  descontoMembros: number,
  descontoConveniado: number,
): string {
  return layout(`Relatório Mensal — ${convenioNome}`, `
    <h2 style="margin:0 0 16px;font-size:20px;">Relatório Mensal do Convênio</h2>
    <p style="margin:0 0 12px;line-height:1.6;">Convênio: <strong>${convenioNome}</strong></p>
    <p style="margin:0 0 12px;line-height:1.6;">Competência: <strong>${competencia}</strong></p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px;border-bottom:1px solid #eee;">Membros Ativos</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${totalMembros}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;">Faixa Atual</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">Faixa ${faixaAtual + 1}</td></tr>
      <tr><td style="padding:8px;border-bottom:1px solid #eee;">Desconto Membros</td><td style="padding:8px;border-bottom:1px solid #eee;font-weight:bold;">${descontoMembros.toFixed(1)}%</td></tr>
      <tr><td style="padding:8px;">Desconto Conveniado</td><td style="padding:8px;font-weight:bold;">${descontoConveniado.toFixed(1)}%</td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:${COR_SUBTEXTO};">Acesse o portal para mais detalhes.</p>
  `);
}

// Sub-Fase 1 Fase 4 (M12, 18/05/2026) — Listas Concessionária
export function templateCooperadoHomologado(
  nomeCooperado: string,
  nomeCooperativa: string,
  nomeUsina: string,
  dataHomologacao: Date,
  numeroProtocolo: string | null,
): string {
  const dataFmt = dataHomologacao.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return layout(`Adesão homologada — bem-vindo ao SCEE`, `
    <h2 style="margin:0 0 16px;color:${COR_TEXTO};font-size:20px;">Sua adesão foi homologada, ${nomeCooperado}! 🎉</h2>
    <p style="margin:0 0 12px;line-height:1.6;">
      A concessionária <strong>confirmou seu cadastro</strong> no Sistema de Compensação
      de Energia Elétrica (SCEE) em <strong>${dataFmt}</strong>.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px;overflow:hidden;">
      <tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:${COR_SUBTEXTO};">Cooperativa</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;">${nomeCooperativa}</td></tr>
      <tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:${COR_SUBTEXTO};">Usina geradora</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;">${nomeUsina}</td></tr>
      <tr><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:${COR_SUBTEXTO};">Data homologação</td><td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;">${dataFmt}</td></tr>
      ${numeroProtocolo ? `<tr><td style="padding:10px 14px;color:${COR_SUBTEXTO};">Protocolo concessionária</td><td style="padding:10px 14px;font-weight:600;">${numeroProtocolo}</td></tr>` : ''}
    </table>
    <h3 style="margin:20px 0 8px;font-size:16px;">O que acontece agora?</h3>
    <ul style="margin:0;padding-left:20px;line-height:1.8;">
      <li>Sua próxima fatura virá com os <strong>créditos aplicados</strong></li>
      <li>Os créditos têm validade de <strong>60 meses</strong> conforme regra ANEEL</li>
      <li>Você pode acompanhar tudo pelo portal da ${nomeCooperativa}</li>
    </ul>
    ${botao('Acessar Portal', `${LINK_PORTAL}/portal`)}
    <p style="margin:16px 0 0;font-size:14px;color:${COR_SUBTEXTO};">
      Dúvidas? Responda este e-mail ou fale pelo WhatsApp. Bem-vindo à energia limpa! ☀️
    </p>
  `);
}
