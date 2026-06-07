/**
 * Sprint Convite-Lote LOTE.5 (07/06/2026) — helper puro de construção de URLs
 * `wa.me` pra abrir o WhatsApp pessoal do remetente com mensagem pré-preenchida.
 *
 * Modo B "manual" do convite: em vez de o backend enviar o WA via API Meta
 * (modo automático), o usuário clica num botão que abre o app WhatsApp dele
 * com a mensagem já pronta. Útil quando:
 *  - Empresa quer toque pessoal (assinar com nome do RH, adaptar tom).
 *  - Membro convida outro membro (MLM futuro — botão no portal/app do membro).
 *  - WA Business API indisponível ou em desenvolvimento.
 *
 * O telefone é normalizado pra E.164 sem `+` (formato wa.me) e a mensagem é
 * URL-encoded. Reusável pelos 2 caminhos de convite:
 *  - ConviteConvenioMembro (lote do admin/empresa)
 *  - ConviteIndicacao (futuro convite individual MLM do cooperado)
 *
 * Função pura — sem I/O, testável standalone.
 */

export interface WaMeConviteParams {
  /** Telefone do destinatário em E.164 ('55DDXXXXXXXXX') ou similar. */
  telefoneDestinatario: string;
  /** Nome do destinatário pra personalizar a saudação. */
  nomeDestinatario: string;
  /** Nome da empresa/cooperativa convidando (ex: "Clínica X"). */
  empresaNome: string;
  /** Link do convite (ex: 'https://sisgd.app/cadastro?conv=...'). */
  linkConvite: string;
  /**
   * Variante da mensagem por caminho — afeta a redação.
   *  - 'CONVENIO_EMPRESA': "A empresa X convidou você para o programa de custeio".
   *  - 'INDICACAO_COOPERADO': "{indicador} convidou você pra economizar na conta de luz" (MLM).
   */
  variante?: 'CONVENIO_EMPRESA' | 'INDICACAO_COOPERADO';
  /** Para 'INDICACAO_COOPERADO': nome de quem indica (ex: "Dra. Ana"). */
  nomeIndicador?: string;
}

export interface WaMeConviteResult {
  /** URL completa wa.me pronta pra `window.open` ou `<a href>`. */
  urlWa: string;
  /** Mensagem decodificada (sem encode) — pra preview UI/log. */
  mensagem: string;
  /** Telefone normalizado sem `+` no formato wa.me. */
  telefoneNormalizado: string;
}

/** Remove tudo que não for dígito (`+`, espaços, parênteses, hifens). */
function apenasDigitos(t: string): string {
  return (t ?? '').replace(/\D/g, '');
}

/**
 * Constrói a mensagem por variante. Texto simples (wa.me não aceita
 * markdown/HTML; quebras de linha como `\n` viram parágrafos no app).
 */
export function montarMensagemConvite(p: WaMeConviteParams): string {
  const nome = p.nomeDestinatario?.trim() || 'tudo bem';
  if (p.variante === 'INDICACAO_COOPERADO') {
    const indicador = p.nomeIndicador?.trim() || 'um colega';
    return (
      `Olá, ${nome}!\n\n` +
      `${indicador} convidou você para economizar na conta de luz com a CoopereBR ` +
      `(energia mais barata, sem obra na sua casa).\n\n` +
      `Acesse este link pra fazer seu cadastro:\n${p.linkConvite}\n\n` +
      `Validade: 7 dias.`
    );
  }
  // Default = CONVENIO_EMPRESA
  return (
    `Olá, ${nome}!\n\n` +
    `A empresa *${p.empresaNome}* convidou você para fazer parte do programa de ` +
    `custeio de energia (CoopereBR).\n\n` +
    `Acesse este link para concluir seu cadastro:\n${p.linkConvite}\n\n` +
    `Validade: 7 dias.`
  );
}

/**
 * Constrói o URL `wa.me/<telefone>?text=<msg-encoded>` pronto pra abrir o
 * app WhatsApp do remetente com a mensagem pré-preenchida.
 */
export function buildWaMeConviteUrl(p: WaMeConviteParams): WaMeConviteResult {
  const telefoneNormalizado = apenasDigitos(p.telefoneDestinatario);
  if (telefoneNormalizado.length < 10) {
    throw new Error(
      `Telefone inválido pra wa.me: "${p.telefoneDestinatario}" (esperado E.164 BR).`,
    );
  }
  const mensagem = montarMensagemConvite(p);
  // encodeURIComponent cuida das quebras de linha, caracteres acentuados etc.
  const urlWa = `https://wa.me/${telefoneNormalizado}?text=${encodeURIComponent(mensagem)}`;
  return { urlWa, mensagem, telefoneNormalizado };
}
