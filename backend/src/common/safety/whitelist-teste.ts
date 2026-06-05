/**
 * Whitelist + detecção defensiva de contatos fake.
 *
 * **Camadas de proteção (defense in depth — Sub-Fase 1 Fase 4, 18/05/2026):**
 *
 * 1. Em DEV (AMBIENTE_REAL ≠ 'true'): só envia pra contatos na whitelist explícita.
 * 2. Em PROD (AMBIENTE_REAL === 'true'): bloqueia contatos com padrão fake
 *    como salvaguarda última, mesmo que tenha vazado dado teste pra produção.
 *
 * Discriminador é `isAmbienteReal()` — NÃO usar `NODE_ENV` direto (ver
 * `ambiente.ts` pra contexto da falha sistêmica descoberta 18/05).
 */
import { isAmbienteReal } from './ambiente';

export const WHITELIST_TELEFONES_TESTE: string[] = [
  // Ambos = números de teste do Luciano (regra 14/05 + 05/06).
  '+5527981341348', // Luciano (admin dev) — regra 14/05
  '5527981341348',
  '27981341348',
  '(27)98134-1348',
  '(27) 98134-1348',
  // Adicional 05/06 (Fatia F-G1 smoke G1 institucional): segundo número
  // de teste do Luciano usado pra simular "novo convidado" no fluxo de
  // convite institucional via /dashboard/indicacoes.
  '+5527999479097',
  '5527999479097',
  '27999479097',
  '(27)99947-9097',
  '(27) 99947-9097',
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
  // Sub-Fase 1 Fase 4 (M12, 18/05/2026) — Listas Concessionária
  'lucbragatto+fase4envio@gmail.com',
  'lucbragatto+homologado@gmail.com',
];

function normalizarTelefone(tel: string): string {
  return tel.replace(/\D/g, '');
}

/**
 * Detecta padrões clássicos de emails fake/sintéticos do projeto.
 * Usado como salvaguarda última mesmo em produção real.
 *
 * Origem: descoberta 18/05 — alguns cooperados têm emails padrão
 * `*-removido@removido.invalid`, `@test`, etc, que NUNCA devem
 * receber comunicação mesmo se config de ambiente estiver errada.
 */
export function ehEmailFake(email: string | null | undefined): boolean {
  if (!email) return true; // sem email = trata como fake (fail-safe)
  const e = email.trim().toLowerCase();
  return (
    /\.invalid$/.test(e) ||
    /@removido\./.test(e) ||
    /-removido@/.test(e) ||
    /@test\b/.test(e) ||
    /@example\./.test(e) ||
    /^test@/.test(e) ||
    /^fake@/.test(e) ||
    /^noreply@/.test(e) ||
    /^no-reply@/.test(e)
  );
}

/**
 * Detecta padrões clássicos de telefones fake/placeholder do projeto.
 * Usado como salvaguarda última mesmo em produção real.
 *
 * Origem: descoberta 18/05 — cooperado real DERLI tem telefone
 * `+5511000000000`, cooperado teste fase4 tem `+5511999990000`, etc.
 * Nunca devem receber WhatsApp mesmo se config errada.
 */
export function ehTelefoneFake(telefone: string | null | undefined): boolean {
  if (!telefone) return true; // sem telefone = fail-safe
  // Bot/anonimizados internos do projeto
  if (telefone.startsWith('INATIVO-')) return true;
  const limpo = telefone.replace(/\D/g, '');
  // Muito curto pra ser real (BR celular sem DDI: 11 díg; fixo antigo: 10)
  if (limpo.length < 10) return true;
  // Padrões zerados / 9-repetidos clássicos
  if (/0{6,}/.test(limpo)) return true; // 6+ zeros consecutivos
  if (/9{6,}/.test(limpo)) return true; // 6+ noves consecutivos
  // Padrão clássico fake "999X 0000" (4+ noves seguido por 4+ zeros até o fim)
  if (/9{4,}\d{0,4}0{4,}$/.test(limpo)) return true;
  // Prefixos fake conhecidos (BLOQUEADOS no WhatsappSenderService:65)
  const PREFIXOS_FAKE = ['551199988', '551199900', '551172620', '551175410', '551178110'];
  if (PREFIXOS_FAKE.some((p) => limpo.startsWith(p))) return true;
  return false;
}

/**
 * Decide se pode disparar comunicação real pra um destino.
 *
 * - Em DEV (AMBIENTE_REAL ≠ 'true'): só permite contatos na whitelist explícita.
 * - Em PROD (AMBIENTE_REAL === 'true'): permite tudo EXCETO contatos com
 *   padrão fake detectado (salvaguarda última).
 */
export function podeEnviarEmDev(destino: string, tipo: 'WA' | 'EMAIL'): boolean {
  if (!destino) return false;

  if (isAmbienteReal()) {
    // Produção real — salvaguarda final: bloqueia padrões fake
    if (tipo === 'WA' && ehTelefoneFake(destino)) return false;
    if (tipo === 'EMAIL' && ehEmailFake(destino)) return false;
    return true;
  }

  // Dev — whitelist explícita
  if (tipo === 'WA') {
    const alvo = normalizarTelefone(destino);
    return WHITELIST_TELEFONES_TESTE.some((t) => normalizarTelefone(t) === alvo);
  }

  const alvo = destino.trim().toLowerCase();
  return WHITELIST_EMAILS_TESTE.some((e) => e.toLowerCase() === alvo);
}
