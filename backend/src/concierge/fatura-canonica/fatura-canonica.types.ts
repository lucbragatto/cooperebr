/**
 * Tipos canonicos da FaturaCanonica - estrutura normalizada que os
 * detectores de padrao tributario consomem, independente de qual
 * concessionaria produziu a fatura original.
 *
 * Cada adapter (EdpEsFaturaAdapter, ElfsmFaturaAdapter, etc) traduz
 * o layout proprio da concessionaria pra esse formato.
 */

import type { DistribuidoraEnum } from '@prisma/client';

/**
 * Classificacao canonica de cada linha da tabela "Detalhes do faturamento".
 * Determina como o detector de padroes trata a rubrica.
 *
 * TUSD                  - Tarifa de Uso do Sistema de Distribuicao (consumo)
 * TE                    - Tarifa de Energia (consumo)
 * TUSD_G                - TUSD na geracao (Demanda Geracao) - Tema 176 STF
 * DEMANDA_CONTRATADA    - Demanda contratada normal (Tese 4 GERAR)
 * DEMANDA_NAO_UTILIZADA - Demanda contratada nao medida. Cobrada com
 *                         PIS/COFINS mas sem ICMS (a propria fatura
 *                         reconhece que nao houve fato gerador completo).
 *                         Catalogada em 15/06/2026 apos auditoria do
 *                         Consorcio Sinergia Ambiental (Tese Demanda Nao Utilizada).
 * DEMANDA_ULTRAPASSAGEM - Ultrapassagem de demanda (Tese 4 GERAR)
 * DEMANDA_REATIVA_EXC   - Demanda Reativa Excedente (DRE) - Tese 4 GERAR
 * ENERGIA_REATIVA_EXC   - Energia Reativa Excedente (ERE) - Tese 4 GERAR
 * INJECAO_SCEE          - Linha negativa de compensacao SCEE
 * ADICIONAL_BANDEIRA    - Adicional bandeira tarifaria (positivo/negativo)
 * CONTRIB_ILUM_PUBLICA  - CIP/COSIP municipal (nao tributada)
 * OUTROS                - Encargos nao classificados (catalogar caso aparecer)
 */
export type TipoRubricaCanonica =
  | 'TUSD'
  | 'TE'
  | 'TUSD_G'
  | 'DEMANDA_CONTRATADA'
  | 'DEMANDA_NAO_UTILIZADA'
  | 'DEMANDA_ULTRAPASSAGEM'
  | 'DEMANDA_REATIVA_EXC'
  | 'ENERGIA_REATIVA_EXC'
  | 'INJECAO_SCEE'
  | 'ADICIONAL_BANDEIRA'
  | 'CONTRIB_ILUM_PUBLICA'
  | 'OUTROS';

/**
 * Posto tarifario - relevante apenas para Grupo A (subgrupos A1-A4).
 * Grupo B (B1-B3) e mono-horario (sem distincao ponta/fora ponta).
 */
export type PostoTarifario = 'PONTA' | 'FORA_PONTA' | 'UNICO';

/**
 * Grupo tarifario ANEEL.
 * Grupo A = alta/media tensao (>= 2,3 kV) - subgrupos A1-A4 + AS
 * Grupo B = baixa tensao (< 2,3 kV) - subgrupos B1 (residencial), B2 (rural),
 *           B3 (demais), B4 (iluminacao publica)
 */
export type GrupoTarifario = 'A' | 'B';

/**
 * Classificacao de uso (residencial/comercial/industrial/poder publico/rural).
 */
export type ClasseUso =
  | 'RESIDENCIAL'
  | 'COMERCIAL'
  | 'INDUSTRIAL'
  | 'PODER_PUBLICO'
  | 'RURAL'
  | 'ILUMINACAO_PUBLICA'
  | 'OUTRA';

/**
 * Modalidade tarifaria.
 */
export type ModalidadeTarifaria =
  | 'CONVENCIONAL'
  | 'BRANCA'
  | 'VERDE'
  | 'AZUL';

/**
 * Classificacao SCEE - subgrupos de Geracao Distribuida pos REN 1.059/2023.
 */
export type ClassificacaoScee =
  | 'GD_I'
  | 'GD_II'
  | 'GD_III'
  | 'NAO_GD'
  | 'INDEFINIDO';

/**
 * Uma rubrica canonica e uma linha do "Detalhes do faturamento" normalizada.
 * Carrega tudo que o detector precisa pra avaliar indebito tributario.
 */
export interface RubricaCanonica {
  /** Tipo canonico definido pelo adapter ao classificar a linha original */
  tipo: TipoRubricaCanonica;

  /** Descricao original como aparece na fatura (auditabilidade) */
  descricaoOriginal: string;

  /** Posto tarifario (Grupo A) - undefined em Grupo B */
  posto?: PostoTarifario;

  /** Quantidade em unidade pertinente (kWh, kW, etc) */
  quantidade: number;

  /** Unidade da quantidade ("kWh", "kW", "kVArh", "uni") */
  unidade: string;

  /** Preco unitario aplicado (com tributos por dentro, R$/unidade) */
  precoUnitarioComTributos: number;

  /** Tarifa unitaria base ANEEL (sem tributos, R$/unidade) */
  tarifaUnitariaBase: number;

  /** Valor total da linha (R$) - assinalado: positivo fornecida, negativo injetada */
  valorTotalReais: number;

  /** Base de calculo do ICMS sobre esta linha (R$) */
  baseCalculoIcms: number;

  /** Aliquota ICMS aplicada (decimal: 0.17 = 17%) */
  aliquotaIcms: number;

  /** Valor do ICMS sobre esta linha (R$) - assinalado */
  valorIcms: number;

  /** Valor agregado PIS+COFINS sobre esta linha (R$) - assinalado */
  valorPisCofins: number;
}

/**
 * Subconjunto da Cooperativa exposto a contextualizacao do diagnostico.
 * Usado para identificar perfil "cooperado de cooperativa GD" vs "PF cativo".
 */
export interface ContextoTitular {
  /** Tipo de cliente identificado pelo adapter */
  tipo: 'PF' | 'PJ';

  /** Nome ou razao social como aparece na fatura */
  nome: string;

  /** CPF (11 digitos) ou CNPJ (14 digitos) - apenas numeros */
  documento?: string;
}

/**
 * FaturaCanonica - estrutura normalizada que os detectores consomem.
 */
export interface FaturaCanonica {
  /** Concessionaria (DistribuidoraEnum) */
  distribuidora: DistribuidoraEnum;

  /** UF (2 letras) */
  uf: string;

  /** Mes de referencia "YYYY-MM" */
  mesReferencia: string;

  /** Data de vencimento ISO (YYYY-MM-DD) - opcional */
  dataVencimento?: string;

  /** Titular */
  titular: ContextoTitular;

  /** Numero da UC como aparece na fatura (preserva pontuacao) */
  numeroUC: string;

  /** Grupo tarifario A ou B */
  grupoTarifario: GrupoTarifario;

  /** Subgrupo tarifario (B1, B3, A4, etc) */
  subgrupo: string;

  /** Classe de uso */
  classeUso: ClasseUso;

  /** Modalidade tarifaria */
  modalidadeTarifaria: ModalidadeTarifaria;

  /** Classificacao SCEE - relevante pra GD */
  classificacaoScee: ClassificacaoScee;

  /** Lista de rubricas canonicas detalhadas */
  rubricas: RubricaCanonica[];

  /** Total da fatura em R$ */
  valorTotalFatura: number;

  /**
   * Snapshot dos totais consolidados de tributos.
   * Util pro detector validar consistencia (soma de rubricas == declarado).
   */
  totaisTributarios: {
    /** Soma dos valores positivos de PIS+COFINS na fatura */
    pisCofinsCobrado: number;

    /** Base PIS/COFINS declarada na fatura (lateral "Tributos") */
    basePisCofinsDeclarada: number;

    /** Aliquota PIS efetiva (decimal) */
    aliquotaPis: number;

    /** Aliquota COFINS efetiva (decimal) */
    aliquotaCofins: number;

    /** Soma do ICMS positivo (fornecida) na fatura */
    icmsCobrado: number;

    /** Soma do ICMS sobre injecoes (negativo) */
    icmsSobreInjecao: number;

    /** ICMS liquido = icmsCobrado + icmsSobreInjecao */
    icmsLiquido: number;

    /** Base ICMS total (positiva + negativa) */
    baseIcmsTotal: number;

    /** Aliquota ICMS efetiva nominal (decimal, 0.17 = 17%) */
    aliquotaIcms: number;
  };
}

/**
 * Input bruto pro adapter parsear.
 * Pode vir do OCR Claude ou de extracao manual.
 */
export interface FaturaRawInput {
  /** Texto completo da fatura ou JSON estruturado */
  conteudoBruto?: string;

  /** Rubricas ja extraidas (preferido - alta precisao) */
  rubricas?: RubricaRawInput[];

  /** Metadados gerais (titular, UC, etc) */
  metadados?: MetadadosRawInput;
}

/**
 * Rubrica raw - cada linha da tabela detalhe do faturamento.
 * Adapter classifica para um TipoRubricaCanonica.
 */
export interface RubricaRawInput {
  descricao: string;
  unidade?: string;
  quantidade?: number;
  precoUnitarioComTributos?: number;
  tarifaUnitariaBase?: number;
  valorTotalReais?: number;
  baseCalculoIcms?: number;
  aliquotaIcms?: number;
  valorIcms?: number;
  valorPisCofins?: number;
}

/**
 * Metadados raw - dados do cabecalho da fatura.
 */
export interface MetadadosRawInput {
  distribuidora?: DistribuidoraEnum | string;
  uf?: string;
  mesReferencia?: string;
  dataVencimento?: string;
  titularNome?: string;
  titularDocumento?: string;
  numeroUC?: string;
  classificacao?: string; // ex: "B - B1-RESIDENCIAL"
  modalidadeTarifaria?: string;
  valorTotalFatura?: number;
  basePisCofinsDeclarada?: number;
  aliquotaPisDeclarada?: number;
  aliquotaCofinsDeclarada?: number;
}
