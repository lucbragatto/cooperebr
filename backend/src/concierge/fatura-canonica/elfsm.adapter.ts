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
import type { FaturaAdapter, ResultadoAdapter } from './adapter.interface';

/**
 * Adapter para faturas da ELFSM (Empresa Luz e Forca Santa Maria, ES regiao serrana).
 * Calibrado em 2026-06-11 com fatura real do Guilherme Alves dos Santos
 * (Colatina/ES, B1 GD I, Jun/2026, total R 334,56).
 *
 * Caracteristicas do layout ELFSM (vs EDP):
 *  - Layout mais simples - apenas 4 rubricas tipicas (Consumo, Consumo SCEE,
 *    En At Inj mUC mPT, Contr Il Pub Munic).
 *  - TUSD+TE agregados em "Consumo" (nao separa rubricas como EDP).
 *  - "Consumo SCEE" e uma linha POSITIVA pra energia recebida via compensacao
 *    (tarifa diferente do Consumo direto) - mapeado como TUSD por fim de
 *    base PIS/COFINS canonica.
 *  - "En At Inj mUC mPT" e a linha NEGATIVA de injecao com sufixo "GD I/II/III"
 *    indicando classificacao SCEE.
 *  - Subgrupo "B10" e variante interna da ELFSM pra "B1" residencial - parser
 *    aceita ambos.
 *  - ELFSM aplica ISENCAO de ICMS sobre SCEE (Lei 7.000/2001-ES, Art. 5 par 6),
 *    similar a EDP.
 *  - ELFSM tambem aplica SCEE no PIS/COFINS - linha de injecao traz valor
 *    PIS/COFINS NEGATIVO que cancela o positivo do Consumo SCEE. Resultado:
 *    detector Tese 3 retorna SEM_DIVERGENCIA pra clientes ELFSM (comportamento
 *    legalmente conservador e favoravel ao cliente).
 */
interface PadraoRubricaElfsm {
  regex: RegExp;
  tipo: TipoRubricaCanonica;
}

// Padroes ordenados - especifico antes de generico.
// "En.At.Inj" precisa vir ANTES de "Consumo" generico.
// "Consumo SCEE" precisa vir ANTES de "^Consumo$".
const PADROES_ELFSM: PadraoRubricaElfsm[] = [
  { regex: /En\.At\.Inj/i, tipo: 'INJECAO_SCEE' },
  { regex: /Consumo\s+SCEE/i, tipo: 'TUSD' },
  { regex: /^Consumo\s*$/i, tipo: 'TUSD' },
  { regex: /Contr.*Il.*P[uu]b/i, tipo: 'CONTRIB_ILUM_PUBLICA' },
  { regex: /Bandeira|Adicional/i, tipo: 'ADICIONAL_BANDEIRA' },
];

@Injectable()
export class ElfsmFaturaAdapter implements FaturaAdapter {
  readonly distribuidora = 'ELFSM' as const;

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
      return 'metadados.classificacao obrigatorio (ex: B10 RESIDENCIAL)';
    }
    if (typeof meta.valorTotalFatura !== 'number') {
      return 'metadados.valorTotalFatura obrigatorio';
    }
    return null;
  }

  private classificarRubrica(raw: RubricaRawInput): RubricaCanonica | null {
    const descricao = raw.descricao.trim();
    if (!descricao) return null;

    for (const padrao of PADROES_ELFSM) {
      if (padrao.regex.test(descricao)) {
        const posto: PostoTarifario = 'UNICO';
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

  private montarFaturaCanonica(
    meta: MetadadosRawInput,
    rubricas: RubricaCanonica[],
  ): FaturaCanonica {
    const classificacaoParsed = this.parsearClassificacao(meta.classificacao ?? '');
    const classificacaoScee = this.detectarClassificacaoScee(rubricas);
    const totais = this.consolidarTotais(rubricas, meta);

    return {
      distribuidora: 'ELFSM',
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

  // Parser de "B10 RESIDENCIAL" / "B - B10 - RESIDENCIAL" etc.
  // ELFSM usa "B10" como variante interna de "B1" pra residencial - aceita ambos.
  private parsearClassificacao(classificacao: string): {
    grupo: GrupoTarifario;
    subgrupo: string;
    classe: ClasseUso;
  } {
    const upper = classificacao.toUpperCase();

    let grupo: GrupoTarifario = 'B';
    if (/\bA[1-4S]\b/.test(upper) || /^A\s*[-/]/.test(upper)) {
      grupo = 'A';
    }

    // Aceita B10 (ELFSM), B1-B4 (padrao), A1-A4, AS.
    let subgrupo = 'B1';
    const matchSubgrupo = upper.match(/\b(A[1-4S]|B1[0-9]|B[1-4])\b/);
    if (matchSubgrupo) {
      subgrupo = matchSubgrupo[1];
    }

    let classe: ClasseUso = 'OUTRA';
    if (/RESIDENCIAL/.test(upper)) classe = 'RESIDENCIAL';
    else if (/COMERCIAL/.test(upper)) classe = 'COMERCIAL';
    else if (/INDUSTRIAL/.test(upper)) classe = 'INDUSTRIAL';
    else if (/PODER\s+P[UU]BLICO/.test(upper)) classe = 'PODER_PUBLICO';
    else if (/RURAL/.test(upper)) classe = 'RURAL';
    else if (/ILUMINA[CC][AA]O/.test(upper)) classe = 'ILUMINACAO_PUBLICA';

    return { grupo, subgrupo, classe };
  }

  private parsearModalidade(modalidade?: string): ModalidadeTarifaria {
    if (!modalidade) return 'CONVENCIONAL';
    const upper = modalidade.toUpperCase();
    if (upper.includes('BRANCA')) return 'BRANCA';
    if (upper.includes('VERDE')) return 'VERDE';
    if (upper.includes('AZUL')) return 'AZUL';
    return 'CONVENCIONAL';
  }

  // Detecta GD_I / GD_II / GD_III pela descricao da injecao SCEE.
  // ELFSM usa padrao "En.At.Inj.mUC.mPT - MM/YYYY - GD I" (com espaco).
  private detectarClassificacaoScee(rubricas: RubricaCanonica[]): ClassificacaoScee {
    const injecoes = rubricas.filter((r) => r.tipo === 'INJECAO_SCEE');
    if (injecoes.length === 0) return 'NAO_GD';

    const temGdIII = injecoes.some((r) => /\bGD\s*III\b/i.test(r.descricaoOriginal));
    if (temGdIII) return 'GD_III';

    const temGdII = injecoes.some((r) => /\bGD\s*II\b/i.test(r.descricaoOriginal));
    if (temGdII) return 'GD_II';

    return 'GD_I';
  }

  private detectarTipoTitular(documento?: string): 'PF' | 'PJ' {
    if (!documento) return 'PF';
    const digitos = documento.replace(/\D/g, '');
    return digitos.length === 14 ? 'PJ' : 'PF';
  }

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
