/**
 * Sprint Funil M48 (22/06/2026) — Camada 1: Motor backend do roteador A/B/C.
 *
 * RoteamentoCadastroService decide o caminho do cadastro novo com base em 3
 * sinais (em ordem de confiança):
 *
 *   1. `jaRecebeCreditosGd` (autodeclaração M44 — passivo até agora).
 *   2. `fornecedorGdAtual` (texto livre M44) cruzado com lista de aliases
 *      `AliasParceiroSisgd` + `Cooperativa.cnpj` direto.
 *   3. `classificacaoScee` (FaturaProcessada — DEFERIDO até hook OCR+
 *      Concierge integrar; service aceita o param opcional).
 *
 * RESULTADO (4 caminhos):
 *   - **C_NOVO**: sem GD ou GD não bate com SISGD → segue cadastro normal.
 *   - **A_MIGRACAO**: recebe GD mas fornecedor NÃO bate com nenhum parceiro
 *     SISGD → migração admin-manual (M47 já implementou a mecânica).
 *   - **B_REDIRECT_PARCEIRO**: fornecedor BATE com alias/cnpj de outro
 *     parceiro SISGD → anti-canibalização (não criar Cooperado no tenant
 *     errado; Camada 2/3 vai redirecionar UI).
 *   - **AMBIGUO_ADMIN**: sinais incompletos/conflitantes → flag pra admin
 *     revisar (cadastro segue normal por design).
 *
 * ⚠️ ADVISORY only (decisão Q1 orquestrador 22/06):
 *   - O service DECIDE e o caller (controller) GRAVA o resultado em
 *     `Cooperado.roteamentoCaminho` + `roteamentoTenantAlvo` + `roteamentoRazao`
 *     + `roteamentoDecididoEm` (4 campos aditivos).
 *   - NÃO BLOQUEIA o cadastro nem dispara migração automática nesta Camada 1.
 *   - ENFORCEMENT (bloquear B, redirecionar, auto-migrar A) vem nas Camadas
 *     2/3 (vitrines parceiro + SISGD marketplace). Sprints próprias.
 *
 * MULTI-TENANT (nota de design):
 *   - Matcher de aliases faz `findFirst` CROSS-TENANT sem `cooperativaId`
 *     (intencional — o motor precisa achar QUAL parceiro tem o alias).
 *   - Retorna SÓ `tenantAlvo` (id) + `razao` (texto humano-legível). NUNCA
 *     vaza dados do tenant alheio (Cooperativa.nome, cnpj, etc são opacos
 *     pro caller — só Camada 2/3 com permissão lê o tenant).
 *   - Multitenant-reviewer 22/06 confirmou que esse cross-tenant intencional
 *     NÃO é violação.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export const CAMINHOS_ROTEAMENTO = [
  'C_NOVO',
  'A_MIGRACAO',
  'B_REDIRECT_PARCEIRO',
  'AMBIGUO_ADMIN',
] as const;
export type CaminhoRoteamento = (typeof CAMINHOS_ROTEAMENTO)[number];

export const TIPOS_ALIAS_VALIDOS = [
  'NOME_CURTO',
  'MARCA_COMERCIAL',
  'SLUG_HISTORICO',
  'CNPJ_SECUNDARIO',
] as const;
export type TipoAlias = (typeof TIPOS_ALIAS_VALIDOS)[number];

export interface DecidirCaminhoInput {
  /** Autodeclaração do cooperado no cadastro V2 (M44). */
  jaRecebeCreditosGd?: boolean | null;
  /** Texto livre do fornecedor GD anterior, se houver (M44). */
  fornecedorGdAtual?: string | null;
  /** Classificação SCEE extraída da fatura (DEFERIDO — hook futuro). */
  classificacaoScee?: 'NAO_GD' | 'GD_I' | 'GD_II' | 'GD_III' | 'INDEFINIDO' | null;
  /** Tenant resolvido pelo controller ANTES da chamada (do JWT ou ?tenant=). */
  cooperativaIdSugerida: string;
}

export interface DecidirCaminhoResultado {
  caminho: CaminhoRoteamento;
  /** Preenchido APENAS em B_REDIRECT_PARCEIRO. */
  tenantAlvo?: string;
  /** Texto humano-legível do motivo da decisão (auditoria + dashboard). */
  razao: string;
}

@Injectable()
export class RoteamentoCadastroService {
  private readonly logger = new Logger(RoteamentoCadastroService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sanitiza texto do usuário antes de echoar em `razao` (auditoria/dashboard).
   * P3 multitenant 22/06: defesa contra XSS stored quando Camada 2/3 expor
   * dashboard admin. Trunca + remove caracteres HTML potencialmente perigosos.
   */
  static sanitizarTexto(s: string, maxLen = 100): string {
    return s
      .replace(/[<>"'`]/g, '') // remove caracteres HTML/JS perigosos
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLen);
  }

  /**
   * Normaliza string pra matching: lowercase + remove pontuação + trim +
   * colapsa espaços. Idempotente.
   */
  static normalizarAlias(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '') // M3 code-reviewer 22/06: \p{M} robusto p/ qualquer combining mark
      .replace(/[^\w\s]/g, ' ') // pontuação vira espaço
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Valida CNPJ via dígitos verificadores (algoritmo oficial Receita
   * Federal). Pega 14 dígitos + checa DV1 e DV2. Telefones aleatórios
   * praticamente nunca passam.
   */
  static validarCnpjDv(cnpj14: string): boolean {
    if (!/^\d{14}$/.test(cnpj14)) return false;
    if (/^(\d)\1{13}$/.test(cnpj14)) return false; // todos iguais
    const calcDv = (base: string, pesos: number[]) => {
      let soma = 0;
      for (let i = 0; i < pesos.length; i++) {
        soma += parseInt(base[i]!, 10) * pesos[i]!;
      }
      const resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    };
    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const dv1 = calcDv(cnpj14.slice(0, 12), pesos1);
    if (dv1 !== parseInt(cnpj14[12]!, 10)) return false;
    const dv2 = calcDv(cnpj14.slice(0, 13), pesos2);
    return dv2 === parseInt(cnpj14[13]!, 10);
  }

  /**
   * Extrai CNPJ de string SÓ se DV válido (H2 code-reviewer 22/06).
   * Rejeita 14 dígitos puros que não passam no DV (ex: telefone
   * "55279813413480"). Aceita formato `XX.XXX.XXX/XXXX-XX` E dígitos
   * justapostos quando DV bate.
   */
  static extrairCnpj(s: string): string | null {
    const match = s.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
    if (match) {
      const limpo = match[0].replace(/\D/g, '');
      if (limpo.length === 14 && RoteamentoCadastroService.validarCnpjDv(limpo)) {
        return limpo;
      }
    }
    return null;
  }

  /**
   * Decide o caminho do cadastro com base nos 3 sinais.
   *
   * Ordem de avaliação (cascata):
   *   1. SE jaRecebeCreditosGd === false E classificacaoScee !== GD_*
   *      → C_NOVO (lead novo sem GD).
   *   2. SE jaRecebeCreditosGd === true OU classificacaoScee é GD_*
   *      2a. Sem fornecedorGdAtual → AMBIGUO_ADMIN (recebe mas não declarou
   *          quem; admin investiga).
   *      2b. fornecedorGdAtual tem CNPJ válido → match direto contra
   *          Cooperativa.cnpj. Hit no MESMO tenant → C_NOVO (declarou
   *          ele mesmo, sem migrar); Hit em outro tenant → B_REDIRECT_PARCEIRO;
   *          Miss → match alias.
   *      2c. fornecedorGdAtual texto → match AliasParceiroSisgd (cross-tenant).
   *          Hit no MESMO tenant → C_NOVO; Hit em outro tenant →
   *          B_REDIRECT_PARCEIRO; Miss → A_MIGRACAO.
   *   3. Default (jaRecebeCreditosGd null + classificacaoScee null) → C_NOVO
   *      (sem sinal = trata como novo; admin revisa via dashboard).
   */
  async decidirCaminho(input: DecidirCaminhoInput): Promise<DecidirCaminhoResultado> {
    const { jaRecebeCreditosGd, fornecedorGdAtual, classificacaoScee, cooperativaIdSugerida } = input;

    const recebeGd =
      jaRecebeCreditosGd === true ||
      (classificacaoScee != null && classificacaoScee !== 'NAO_GD' && classificacaoScee !== 'INDEFINIDO');

    if (!recebeGd) {
      return {
        caminho: 'C_NOVO',
        razao:
          jaRecebeCreditosGd === false
            ? 'Cooperado declarou que NÃO recebe créditos GD — lead novo.'
            : 'Sem sinal de GD (autodeclaração e classificacaoScee ambos vazios) — trata como lead novo.',
      };
    }

    const fornecedorTrim = fornecedorGdAtual?.trim() ?? '';
    if (fornecedorTrim.length === 0) {
      return {
        caminho: 'AMBIGUO_ADMIN',
        razao: 'Recebe créditos GD mas NÃO declarou fornecedor — admin deve investigar antes de classificar A/B.',
      };
    }

    // 2b. Match CNPJ direto.
    // P2 multitenant 22/06: filtra `ativo:true` pra não rotear pra tenant
    // suspenso/inativo (camadas 2/3 não devem redirecionar pra parceiro fora
    // da plataforma). Cooperativa inativa = sem match.
    const cnpj = RoteamentoCadastroService.extrairCnpj(fornecedorTrim);
    if (cnpj) {
      const coop = await this.prisma.cooperativa.findUnique({
        where: { cnpj },
        select: { id: true, ativo: true },
      });
      if (coop && coop.ativo) {
        if (coop.id === cooperativaIdSugerida) {
          return {
            caminho: 'C_NOVO',
            razao: `Declarou fornecedor GD com CNPJ ${cnpj} = MESMO tenant do cadastro — trata como novo (já é cliente).`,
          };
        }
        return {
          caminho: 'B_REDIRECT_PARCEIRO',
          tenantAlvo: coop.id,
          razao: `CNPJ ${cnpj} bate com outro parceiro SISGD ativo — anti-canibalização (Camada 2/3 redireciona).`,
        };
      }
    }

    // 2c. Match alias texto (cross-tenant intencional).
    const aliasNormalizado = RoteamentoCadastroService.normalizarAlias(fornecedorTrim);
    if (aliasNormalizado.length >= 3) {
      // Busca substring ILIKE — pega "CoopereBR" em "Sou da CoopereBR Energia".
      const matchAlias = await this.prisma.aliasParceiroSisgd.findFirst({
        where: {
          ativo: true,
          alias: { contains: aliasNormalizado, mode: 'insensitive' },
        },
        select: { cooperativaId: true, alias: true },
      });
      // Alternativa: a alias do banco pode ser substring do texto declarado
      // ("CoopereBR" no banco vs "Sou cliente da CoopereBR Energia" no input).
      // Fazer segunda query mais ampla.
      const matchInverso = matchAlias
        ? null
        : await this.findAliasContidoEm(aliasNormalizado);
      const match = matchAlias ?? matchInverso;

      if (match) {
        if (match.cooperativaId === cooperativaIdSugerida) {
          return {
            caminho: 'C_NOVO',
            razao: `Alias "${match.alias}" bate com MESMO tenant do cadastro — trata como novo (já é cliente).`,
          };
        }
        return {
          caminho: 'B_REDIRECT_PARCEIRO',
          tenantAlvo: match.cooperativaId,
          razao: `Alias "${match.alias}" bate com outro parceiro SISGD — anti-canibalização.`,
        };
      }
    }

    // 3. Nenhum match → caminho A (concorrente fora-SISGD).
    // P3 multitenant: sanitiza echo do input do usuário pra evitar XSS stored
    // quando a `razao` for renderizada em dashboard admin (Camada 2/3).
    return {
      caminho: 'A_MIGRACAO',
      razao: `Fornecedor "${RoteamentoCadastroService.sanitizarTexto(fornecedorTrim)}" não bate com nenhum parceiro SISGD — concorrente fora da plataforma. Considerar fluxo de migração (M47).`,
    };
  }

  /**
   * Para o caso "alias do banco é substring do texto declarado": busca todos
   * os aliases ativos e itera no Node (limite ~poucas centenas no MVP; se
   * crescer, virar full-text search). Custo aceitável dado que aliases por
   * parceiro são poucos (~5-10).
   */
  private async findAliasContidoEm(
    textoNormalizado: string,
  ): Promise<{ cooperativaId: string; alias: string } | null> {
    // M2 code-reviewer 22/06: take 500 evita pull-all em crescimento futuro
    // da tabela. Warn se atingir o limite — sinal de que precisa virar
    // full-text search OU índice trigram.
    const TAKE = 500;
    const aliases = await this.prisma.aliasParceiroSisgd.findMany({
      where: { ativo: true },
      select: { cooperativaId: true, alias: true },
      take: TAKE,
    });
    if (aliases.length === TAKE) {
      this.logger.warn(
        `[roteador] findAliasContidoEm atingiu limite ${TAKE} — considerar full-text search (D-novo-M48-ALIAS-FTS)`,
      );
    }
    for (const a of aliases) {
      const aliasNorm = RoteamentoCadastroService.normalizarAlias(a.alias);
      if (aliasNorm.length >= 3 && textoNormalizado.includes(aliasNorm)) {
        return a;
      }
    }
    return null;
  }
}
