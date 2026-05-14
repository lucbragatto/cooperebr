/**
 * Whitelist de envios em ambiente de desenvolvimento.
 *
 * Quando NODE_ENV !== 'production', qualquer envio de WA ou email
 * precisa passar pela whitelist. Registros do seed/teste caem como
 * SKIPPED sem disparar nada.
 *
 * Em produção a função retorna sempre true (sem filtro).
 */

export const WHITELIST_TELEFONES_TESTE: string[] = [
  '+5527981341348', // Luciano (admin dev)
  '5527981341348',
  '27981341348',
  '(27)98134-1348',
  '(27) 98134-1348',
];

export const WHITELIST_EMAILS_TESTE: string[] = [
  'lucbragatto@gmail.com', // Luciano (admin dev)
  // Aliases Gmail +suffix pra sub-canários (refinamento regra 14/05).
  // Gmail roteia todos pra mesma caixa do lucbragatto@gmail.com.
  // Origem: Luciano é cooperado real CoopereBR (CPF 89089324704),
  // unique constraint Prisma impede outros usarem mesmo email base.
  'lucbragatto+carolina@gmail.com',
  'lucbragatto+diego@gmail.com',
  'lucbragatto+almir@gmail.com',
  'lucbragatto+theomax@gmail.com',
  'lucbragatto+amages@gmail.com',
  'lucbragatto+marcio@gmail.com',
];

function normalizarTelefone(tel: string): string {
  return tel.replace(/\D/g, '');
}

export function podeEnviarEmDev(destino: string, tipo: 'WA' | 'EMAIL'): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  if (!destino) return false;

  if (tipo === 'WA') {
    const alvo = normalizarTelefone(destino);
    return WHITELIST_TELEFONES_TESTE.some(t => normalizarTelefone(t) === alvo);
  }

  const alvo = destino.trim().toLowerCase();
  return WHITELIST_EMAILS_TESTE.some(e => e.toLowerCase() === alvo);
}
