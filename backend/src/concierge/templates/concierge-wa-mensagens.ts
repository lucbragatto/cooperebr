/**
 * Templates de mensagem do Concierge WhatsApp (Sprint C8 - 12/06/2026).
 *
 * Conteudo inspirado no organograma da Tela 8 do mockup
 * `docs/concierge/mockups/2026-06-11-mockup-telas-concierge.html` (linhas ~830-940).
 *
 * Variaveis sao substituidas via `renderizarTemplate(template, vars)`.
 * Se uma variavel nao for fornecida, o placeholder `{{chave}}` permanece literal
 * (evita erro em tempo de execucao).
 *
 * Variaveis canonicas:
 *   {{nome}}              - nome (ou primeiro nome) do lead
 *   {{valor_pago}}        - "R$ 487,32" - valor cobrado na fatura
 *   {{valor_correto}}     - "R$ 312,15" - valor correto sem indebito
 *   {{sobrepreco}}        - "R$ 175,17" - diferenca mensal
 *   {{percentual}}        - "56,1" (sem o %) - sobrepreco / valor_correto
 *   {{cenario_60m}}       - "R$ 12.450,32" - projecao 5 anos
 *   {{cenario_120m}}      - "R$ 26.890,12" - projecao 10 anos
 *   {{cenario_dobro}}     - "R$ 53.780,24" - dobro CDC
 *   {{mes}}               - "abril/2026"
 *   {{distribuidora}}     - "EDP-ES" | "ELFSM" | etc
 *   {{taxa_adesao}}       - "R$ 50,00/mes"
 *   {{custas}}            - "R$ 800,00" - custas processuais
 *   {{dado}}              - placeholder generico (campo individual em coleta de dados)
 */

export const MSG_BOAS_VINDAS =
  'Ola {{nome}}! Sou o Coop, da CoopereBR. Vou te ajudar a descobrir quanto a sua conta de luz esta cobrando a mais. Pode me enviar uma foto ou PDF da sua fatura mais recente?';

export const MSG_AGUARDANDO_FATURA =
  'Estou aguardando voce me enviar a foto ou PDF da sua fatura, {{nome}}. Pode anexar aqui no chat quando puder.';

export const MSG_OCR_PROCESSANDO =
  'Recebi! Estou analisando agora, leva ~30 segundos...';

export const MSG_DIAGNOSTICO_ENTREGUE = [
  'Pronto, {{nome}}!',
  '',
  'Sua fatura de {{mes}} ({{distribuidora}}):',
  '- Valor pago: {{valor_pago}}',
  '- Valor correto: {{valor_correto}}',
  '- Voce paga {{sobrepreco}}/mes a mais ({{percentual}}%)',
  '',
  'Quanto voce pode recuperar:',
  '- Em 5 anos (Justica Federal): {{cenario_60m}}',
  '- Em 10 anos (decisao STF 2024): {{cenario_120m}}',
  '- Com dobro CDC: {{cenario_dobro}}',
  '',
  'Quer entender como a gente faz isso virar dinheiro no seu bolso?',
  '1. Sim, me explica',
  '2. Quero pensar primeiro',
  '3. Tenho duvidas tecnicas',
].join('\n');

export const MSG_PEDIR_NOME =
  'Otimo! Para preparar o cadastro, preciso de alguns dados. Qual o seu nome completo?';

export const MSG_PEDIR_CPF =
  'Obrigado, {{nome}}. Agora me passa seu CPF (somente numeros).';

export const MSG_PEDIR_EMAIL =
  'Quase la! Qual o melhor email para receber a procuracao e o contrato?';

export const MSG_PEDIR_RG_CNH =
  'Agora preciso de uma foto do seu RG (frente e verso) OU da sua CNH para preparar a procuracao. Pode enviar uma foto bem nitida?';

export const MSG_ENVIAR_PROCURACAO =
  'Estou enviando 2 documentos para voce revisar:\n- PROCURACAO.pdf\n- CONTRATO.pdf\n\nApos ler, responda CONFIRMO PROCURACAO + CONTRATO. Vou enviar um codigo de 6 digitos para confirmar a assinatura digital.';

export const MSG_PEDIR_PAGAMENTO = [
  'Para finalizar, pague:',
  '1. Adesao CoopereBR: {{taxa_adesao}}',
  '2. Custas iniciais: {{custas}}',
  '',
  'Honorarios do advogado so apos voce receber o valor.',
].join('\n');

export const MSG_PROCESSO_INICIADO =
  'Pagamento confirmado, {{nome}}! Seu caso ja foi encaminhado para o advogado parceiro. Voce vai receber atualizacoes por aqui a cada etapa do processo.';

export const MSG_FALLBACK_HUMANO =
  'Vou transferir voce para um atendente humano, {{nome}}. Em breve alguem do nosso time entra em contato. Obrigado pela paciencia!';

export const MSG_INELEGIVEL =
  'Analisei sua fatura, {{nome}}, mas no momento nao identifiquei indebito relevante. Pode ser que sua concessionaria ainda nao esteja no nosso MVP ou que o valor a recuperar seja pequeno demais para compensar a acao judicial. Vamos te avisar quando isso mudar!';

/**
 * Substitui placeholders `{{chave}}` em um template pelas chaves correspondentes
 * em `vars`. Se uma chave nao existir em `vars`, o placeholder permanece literal.
 *
 * @param template texto com placeholders no formato `{{chave}}`
 * @param vars     mapa chave -> valor (string ou number)
 * @returns        template com placeholders substituidos
 *
 * @example
 * renderizarTemplate('Ola {{nome}}!', { nome: 'Luciano' })
 * // 'Ola Luciano!'
 *
 * renderizarTemplate('Ola {{nome}}, faltam {{x}}', { nome: 'Luciano' })
 * // 'Ola Luciano, faltam {{x}}'
 */
export function renderizarTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, chave: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, chave)) {
      return String(vars[chave]);
    }
    return match;
  });
}
