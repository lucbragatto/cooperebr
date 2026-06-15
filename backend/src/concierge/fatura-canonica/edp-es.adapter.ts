import { Injectable } from '@nestjs/common';
import type {
  ClasseUso,
  ClassificacaoScee,
  FaturaCanonica,
  FaturaRawInput,
  GrupoTarifario,
  MetadadosRawInput,
  ModalidadeTarifaria,
  PostoTarifario,
  RubricaCanonica,
  RubricaRawInput,
  TipoRubricaCanonica,
} from './fatura-canonica.types';
import type {
  FaturaAdapter,
  MotivoFalhaAdapter,
  ResultadoAdapter,
} from './adapter.interface';

/**
 * Padrao de classificacao de rubrica EDP ES.
 * Ordem importa - o primeiro match ganha. Patterns mais especificos primeiro.
 */
interface PadraoRubrica {
  /** Regex case-insensitive */
  regex: RegExp;
  tipo: TipoRubricaCanonica;
  /** Como inferir o posto. undefined = mantem posto da rubrica raw (UNICO se ausente) */
  inferirPosto?: (descricao: string) => PostoTarifario;
}

/**
 * Inferir posto pela descricao. EDP usa "Ponta" e "FPonta".
 */
function inferirPostoEdpEs(descricao: string): PostoTarifario {
  const d = descricao.toUpperCase();
  if (/\bFPONTA\b/.test(d) || /\bFP\b/.test(d) || /FORA[\s_]?PONTA/.test(d)) {
    return 'FORA_PONTA';
  }
  if (/\bPONTA\b/.test(d) || /\bPT\b(?![A-Z])/.test(d)) {
    return 'PONTA';
  }
  return 'UNICO';
}

/**
 * Padroes ordenados - especifico antes do generico.
 * Atencao: "Demanda Geracao" precisa vir ANTES de "Demanda" (senao "Demanda" pegaria).
 * "Inj" precisa vir ANTES de "TUSD"/"TE" (senao classificariam como fornecida).
 */
const PADROES_EDP_ES: PadraoRubrica[] = [
  // ─── Injecao SCEE (qualquer linha com "Inj." vira INJECAO_SCEE) ───
  {
    regex: /\bInj\./i,
    tipo: 'INJECAO_SCEE',
    inferirPosto: inferirPostoEdpEs,
  },

  // ─── Adicional bandeira (positivo ou injetada) ───
  {
    regex: /Adicional\s+Bandeira/i,
    tipo: 'ADICIONAL_BANDEIRA',
    inferirPosto: inferirPostoEdpEs,
  },

  // ─── Demanda Geracao (TUSD-G) - antes de "Demanda" generico ───
  {
    regex: /Demanda\s+Gera[cç][aã]o/i,
    tipo: 'TUSD_G',
  },

  // ─── Demanda Reativa Excedente (DRE) ───
  {
    regex: /DRE|Demanda\s+Reativa\s+Excedente/i,
    tipo: 'DEMANDA_REATIVA_EXC',
  },

  // ─── Energia Reativa Excedente (ERE) ───
  {
    regex: /\bERE\b|Energia\s+Reativa\s+Excedente/i,
    tipo: 'ENERGIA_REATIVA_EXC',
  },

  // ─── Ultrapassagem ───
  {
    regex: /Ultrapassagem/i,
    tipo: 'DEMANDA_ULTRAPASSAGEM',
  },

  // ─── Demanda contratada ───
  {
    regex: /^Demanda\b/i,
    tipo: 'DEMANDA_CONTRATADA',
  },

  // ─── Contribuicao iluminacao publica (CIP/COSIP) ───
  {
    regex: /Contribui[cç][aã]o\s+de\s+Ilum/i,
    tipo: 'CONTRIB_ILUM_PUBLICA',
  },

  // ─── Patches 14/06/2026 noite — Fase 2 Concierge: 4 categorias de rubricas
  //     que apareceram nas faturas EDP_ES reais e nao estavam no regex original.
  //     Todas viram OUTROS (nao-energeticas, nao entram no detector Tese 3/6).

  // Multa por atraso (Multa Ref.: Mar/25, Multa 2%, etc)
  {
    regex: /^Multa\b|Multa\s+Ref\b/i,
    tipo: 'OUTROS',
  },

  // Juros de mora por atraso (Juros de Mora Ref.: Abr/25)
  {
    regex: /^Juros\b|Juros\s+de\s+Mora/i,
    tipo: 'OUTROS',
  },

  // DIC - Duracao de Interrupcao Continua (compensacao ANEEL por qualidade)
  {
    regex: /^DIC\b|Dura[cç][aã]o\s+de\s+Interrup/i,
    tipo: 'OUTROS',
  },

  // Linhas literais PIS / COFINS direto na tabela (algumas faturas)
  {
    regex: /^PIS\s*$|^COFINS\s*$|PIS\s*[\/|]\s*COFINS/i,
    tipo: 'OUTROS',
  },

  // ─── TUSD fornecida (mais generico - precisa vir depois de TUSD_G, Inj) ───
  {
    regex: /^TUSD\b/i,
    tipo: 'TUSD',
    inferirPosto: inferirPostoEdpEs,
  },

  // ─── TE fornecida ───
  {
    regex: /^TE\b/i,
    tipo: 'TE',
    inferirPosto: inferirPostoEdpEs,
  },
];

/**
 * Adapter para faturas da EDP Espirito Santo (EDP_ES).
 *
 * Cobre 3 formatos identificados nas faturas reais:
 *  - Grupo B residencial (B1) cativo ou com GD remoto
 *  - Grupo B comercial (B3) cooperada de cooperativa GD (com GDIII)
 *  - Grupo A industrial/comercial (A4) - CUSD de usina geradora
 *
 * Por design, NAO interpreta semantica tributaria (Tema 69, Tese 3, etc).
 * Apenas normaliza a fatura. Detectors agem em cima.
 */
@Injectable()
export class EdpEsFaturaAdapter implements FaturaAdapter {
  readonly distribuidora = 'EDP_ES' as const;

  parsear(input: FaturaRawInput): ResultadoAdapter {
    const meta = input.metadados ?? {};

    const erroValidacao = this.validarInput(input, meta);
    if (erroValidacao) {
      return {
        sucesso: false,
        motivo: 'INPUT_INSUFICIENTE',
        detalhe: erroValidacao,
      };
    }

    const rubricasRaw = input.rubricas ?? [];
    const rubricasClassificadas: RubricaCanonica[] = [];
    const rubricasNaoClassificadas: string[] = [];

    for (const raw of rubricasRaw) {
      const classificada = this.classificarRubrica(raw);
      if (classificada === null) {
        rubricasNaoClassificadas.push(raw.descricao);
        continue;
      }
      rubricasClassificadas.push(classificada);
    }

    if (rubricasNaoClassificadas.length > 0) {
      return {
        sucesso: false,
        motivo: 'RUBRICA_DESCONHECIDA',
        detalhe: `Rubricas nao classificadas: ${rubricasNaoClassificadas.join(' | ')}`,
      };
    }

    const fatura = this.montarFaturaCanonica(meta, rubricasClassificadas);
    return { sucesso: true, fatura };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────

  /**
   * Valida input minimo. Retorna mensagem de erro ou null se ok.
   */
  private validarInput(
    input: FaturaRawInput,
    meta: MetadadosRawInput,
  ): string | null {
    if (!input.rubricas || input.rubricas.length === 0) {
      return 'rubricas[] obrigatorio (nao vazio)';
    }
    if (!meta.mesReferencia) {
      return 'metadados.mesReferencia obrigatorio (YYYY-MM)';
    }
    if (!meta.classificacao) {
      return 'metadados.classificacao obrigatorio (ex: "B - B1-RESIDENCIAL")';
    }
    if (typeof meta.valorTotalFatura !== 'number') {
      return 'metadados.valorTotalFatura obrigatorio';
    }
    return null;
  }

  /**
   * Classifica uma rubrica raw em RubricaCanonica.
   * Retorna null se nenhum padrao bate.
   */
  private classificarRubrica(raw: RubricaRawInput): RubricaCanonica | null {
    const descricao = raw.descricao.trim();
    if (!descricao) return null;

    for (const padrao of PADROES_EDP_ES) {
      if (padrao.regex.test(descricao)) {
        const posto = padrao.inferirPosto?.(descricao);
        return {
          tipo: padrao.tipo,
          descricaoOriginal: descricao,
          posto,
          quantidade: raw.quantidade ?? 0,
          unidade: raw.unidade ?? '',
          precoUnitarioComTributos: raw.precoUnitarioComTributos ?? 0,
          tarifaUnitariaBase: raw.tarifaUnitariaBase ?? 0,
          valorTotalReais: raw.valorTotalReais ?? 0,
          baseCalculoIcms: raw.baseCalculoIcms ?? 0,
          aliquotaIcms: raw.aliquotaIcms ?? 0,
          valorIcms: raw.valorIcms ?? 0,
          valorPisCofins: raw.valorPisCofins ?? 0,
        };
      }
    }

    return null;
  }

  /**
   * Monta FaturaCanonica a partir dos metadados + rubricas classificadas.
   */
  private montarFaturaCanonica(
    meta: MetadadosRawInput,
    rubricas: RubricaCanonica[],
  ): FaturaCanonica {
    const classificacaoParsed = this.parsearClassificacao(meta.classificacao ?? '');
    const classificacaoScee = this.detectarClassificacaoScee(rubricas);
    const totais = this.consolidarTotais(rubricas, meta);

    return {
      distribuidora: 'EDP_ES',
      uf: 'ES',
      mesReferencia: meta.mesReferencia ?? '',
      dataVencimento: meta.dataVencimento,
      titular: {
        tipo: this.detectarTipoTitular(meta.titularDocumento),
        nome: meta.titularNome ?? '',
        documento: meta.titularDocumento,
      },
      numeroUC: meta.numeroUC ?? '',
      grupoTarifario: classificacaoParsed.grupo,
      subgrupo: classificacaoParsed.subgrupo,
      classeUso: classificacaoParsed.classe,
      modalidadeTarifaria: this.parsearModalidade(meta.modalidadeTarifaria),
      classificacaoScee,
      rubricas,
      valorTotalFatura: meta.valorTotalFatura ?? 0,
      totaisTributarios: totais,
    };
  }

  /**
   * Parser de "B - B1-RESIDENCIAL" / "A - A4 - INDUSTRIAL" / etc.
   */
  private parsearClassificacao(classificacao: string): {
    grupo: GrupoTarifario;
    subgrupo: string;
    classe: ClasseUso;
  } {
    const upper = classificacao.toUpperCase();

    let grupo: GrupoTarifario = 'B';
    if (/^A\s*[-—]/.test(upper) || /\bA[1-4]\b/.test(upper) || /\bAS\b/.test(upper)) {
      grupo = 'A';
    }

    let subgrupo = 'B1';
    const matchSubgrupo = upper.match(/\b(A[1-4S]|B[1-4])\b/);
    if (matchSubgrupo) {
      subgrupo = matchSubgrupo[1];
    }

    let classe: ClasseUso = 'OUTRA';
    if (/RESIDENCIAL/.test(upper)) classe = 'RESIDENCIAL';
    else if (/COMERCIAL/.test(upper)) classe = 'COMERCIAL';
    else if (/INDUSTRIAL/.test(upper)) classe = 'INDUSTRIAL';
    else if (/PODER\s+P[UÚ]BLICO/.test(upper)) classe = 'PODER_PUBLICO';
    else if (/RURAL/.test(upper)) classe = 'RURAL';
    else if (/ILUMINA[CÇ][AÃ]O/.test(upper)) classe = 'ILUMINACAO_PUBLICA';

    return { grupo, subgrupo, classe };
  }

  /**
   * Modalidade tarifaria. Default CONVENCIONAL.
   */
  private parsearModalidade(modalidade?: string): ModalidadeTarifaria {
    if (!modalidade) return 'CONVENCIONAL';
    const upper = modalidade.toUpperCase();
    if (upper.includes('BRANCA')) return 'BRANCA';
    if (upper.includes('VERDE')) return 'VERDE';
    if (upper.includes('AZUL')) return 'AZUL';
    return 'CONVENCIONAL';
  }

  /**
   * Detecta GD_I / GD_II / GD_III / NAO_GD / INDEFINIDO baseado nas rubricas.
   *
   * Heuristica:
   *  - Se ha rubrica com "GDIII" na descricao → GD_III
   *  - Se ha rubrica com "GDII" → GD_II
   *  - Se ha INJECAO_SCEE sem marcacao explicita → GD_I (legado pre-GD II/III)
   *  - Se nao ha INJECAO_SCEE → NAO_GD
   */
  private detectarClassificacaoScee(rubricas: RubricaCanonica[]): ClassificacaoScee {
    const injecoes = rubricas.filter((r) => r.tipo === 'INJECAO_SCEE');
    if (injecoes.length === 0) return 'NAO_GD';

    const temGdIII = injecoes.some((r) => /GDIII/i.test(r.descricaoOriginal));
    if (temGdIII) return 'GD_III';

    const temGdII = injecoes.some((r) => /GDII\b/i.test(r.descricaoOriginal));
    if (temGdII) return 'GD_II';

    return 'GD_I';
  }

  /**
   * PF se 11 digitos, PJ se 14. Default PF.
   */
  private detectarTipoTitular(documento?: string): 'PF' | 'PJ' {
    if (!documento) return 'PF';
    const digitos = documento.replace(/\D/g, '');
    return digitos.length === 14 ? 'PJ' : 'PF';
  }

  /**
   * Consolida totais tributarios somando rubricas + complementando com metadados.
   */
  private consolidarTotais(
    rubricas: RubricaCanonica[],
    meta: MetadadosRawInput,
  ): FaturaCanonica['totaisTributarios'] {
    let icmsCobrado = 0;
    let icmsSobreInjecao = 0;
    let baseIcmsPositiva = 0;
    let baseIcmsNegativa = 0;
    let pisCofinsCobrado = 0;
    let aliquotaIcmsMax = 0;

    for (const r of rubricas) {
      if (r.aliquotaIcms > aliquotaIcmsMax) aliquotaIcmsMax = r.aliquotaIcms;

      if (r.tipo === 'INJECAO_SCEE') {
        icmsSobreInjecao += r.valorIcms;
        baseIcmsNegativa += r.baseCalculoIcms;
      } else {
        icmsCobrado += r.valorIcms;
        baseIcmsPositiva += r.baseCalculoIcms;
      }

      if (r.valorPisCofins > 0) {
        pisCofinsCobrado += r.valorPisCofins;
      }
    }

    return {
      pisCofinsCobrado,
      basePisCofinsDeclarada: meta.basePisCofinsDeclarada ?? 0,
      aliquotaPis: meta.aliquotaPisDeclarada ?? 0,
      aliquotaCofins: meta.aliquotaCofinsDeclarada ?? 0,
      icmsCobrado,
      icmsSobreInjecao,
      icmsLiquido: icmsCobrado + icmsSobreInjecao,
      baseIcmsTotal: baseIcmsPositiva + baseIcmsNegativa,
      aliquotaIcms: aliquotaIcmsMax,
    };
  }
}

// ─── Tipo auxiliar pra evitar warning de unused MotivoFalhaAdapter ────
type _UsadoNoTipo = MotivoFalhaAdapter;
