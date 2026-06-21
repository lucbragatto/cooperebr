/**
 * Helpers compartilhados pra localizar TODOS os cooperados de um mesmo dono.
 *
 * Sprint "Qual cadastro?" (08/06/2026) — substitui o uso de findFirst/[0]
 * em pontos onde um Usuario/telefone pode bater em múltiplos cadastros
 * (Luciano PF + SISGD PJ usando mesmo email/cpf/telefone).
 *
 * Multi-tenant: filtros NÃO aplicam cooperativaId aqui porque visitante WA
 * não tem tenant e Usuario portal pode ter cadastros em múltiplos tenants
 * (raríssimo mas valido). Quem consome valida cooperativaId do JWT por cima.
 *
 * Anti-IDOR: helpers retornam SÓ os cadastros que pertencem ao identificador
 * passado (telefone/email/cpf). A lista resultante representa "candidatos
 * legítimos do dono" — front faz o usuário escolher um.
 */

import type { PrismaClient } from '@prisma/client';

/** Status que contam como "cooperado utilizável" no bot WA + portal cooperado.
 *
 * Sprint M47 (21/06/2026) — PENDENTE_MIGRACAO incluído: cooperado em migração
 * externa ainda recebe mensagens informativas do bot (saldo congelado, status
 * da migração). DESLIGADO NÃO entra — terminal definitivo.
 */
export const STATUS_COOPERADO_ATIVOS = [
  'ATIVO',
  'AGUARDANDO_CONCESSIONARIA',
  'PENDENTE_DOCUMENTOS',
  'ATIVO_RECEBENDO_CREDITOS',
  'PENDENTE_MIGRACAO',
] as const;

export interface CandidatoCooperado {
  id: string;
  nomeCompleto: string;
  cooperativaId: string | null;
  tipoPessoa: string | null;
  razaoSocial: string | null;
}

/**
 * Gera variantes E.164 BR + sem-país do telefone (tolera dado humano).
 * Ex: "5527981341348" → ["5527981341348", "27981341348"]
 * Ex: "(27)98134-1348" → ["27981341348", "5527981341348"]
 */
export function variantesTelefone(telefone: string): string[] {
  const norm = String(telefone ?? '').replace(/\D/g, '');
  if (!norm) return [];
  const semPais = norm.replace(/^55/, '');
  return Array.from(new Set([norm, semPais, `55${semPais}`]));
}

/**
 * Localiza TODOS os cooperados com status ativo bate algum match de telefone.
 * Ordem: createdAt asc (PF antigo primeiro, PJ mais novo depois — estável).
 */
export async function acharCooperadosPorTelefone(
  prisma: PrismaClient | { cooperado: PrismaClient['cooperado'] },
  telefone: string,
): Promise<CandidatoCooperado[]> {
  const variantes = variantesTelefone(telefone);
  if (variantes.length === 0) return [];

  const rows = await prisma.cooperado.findMany({
    where: {
      telefone: { in: variantes },
      status: { in: STATUS_COOPERADO_ATIVOS as unknown as any[] },
    },
    select: {
      id: true,
      nomeCompleto: true,
      cooperativaId: true,
      tipoPessoa: true,
      razaoSocial: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return rows;
}

/**
 * Localiza TODOS os cooperados que batem com email OU cpf do Usuario.
 * Anti-IDOR: chamador valida que o Usuario.id solicitante é o dono dos cadastros.
 */
export async function acharCooperadosPorUsuario(
  prisma: PrismaClient | { cooperado: PrismaClient['cooperado'] },
  usuario: { email?: string | null; cpf?: string | null },
): Promise<CandidatoCooperado[]> {
  const ors: any[] = [];
  if (usuario.email) ors.push({ email: usuario.email });
  if (usuario.cpf) ors.push({ cpf: usuario.cpf });
  if (ors.length === 0) return [];

  const rows = await prisma.cooperado.findMany({
    where: {
      OR: ors,
      status: { in: STATUS_COOPERADO_ATIVOS as unknown as any[] },
    },
    select: {
      id: true,
      nomeCompleto: true,
      cooperativaId: true,
      tipoPessoa: true,
      razaoSocial: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return rows;
}

/**
 * Label legível pra menu/dropdown — distingue PF/PJ + nome.
 * Ex: PF "Luciano (PF)" / PJ "SISGDSOLAR (PJ)"
 */
export function formatarLabelCadastro(c: CandidatoCooperado): string {
  const tipo = (c.tipoPessoa ?? 'PF').toUpperCase();
  const nome = tipo === 'PJ' && c.razaoSocial ? c.razaoSocial : c.nomeCompleto;
  return `${nome} (${tipo})`;
}
