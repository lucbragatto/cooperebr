export class UpdatePlanoDto {
  nome?: string;
  descricao?: string;
  modeloCobranca?: 'FIXO_MENSAL' | 'CREDITOS_COMPENSADOS' | 'CREDITOS_DINAMICO';
  descontoBase?: number;
  temPromocao?: boolean;
  descontoPromocional?: number;
  mesesPromocao?: number;
  publico?: boolean;
  ativo?: boolean;
  tipoCampanha?: 'PADRAO' | 'CAMPANHA';
  dataInicioVigencia?: string;
  dataFimVigencia?: string;

  // Base de Cálculo
  baseCalculo?: 'KWH_CHEIO' | 'SEM_TRIBUTO' | 'COM_ICMS' | 'CUSTOM';
  componentesCustom?: string[];
  referenciaValor?: 'ULTIMA_FATURA' | 'MEDIA_3M' | 'MEDIA_6M' | 'MEDIA_12M';
  fatorIncremento?: number;
  mostrarDiscriminado?: boolean;

  // CooperToken
  cooperTokenAtivo?: boolean;
  tokenOpcaoCooperado?: 'OPCAO_A' | 'OPCAO_B' | 'AMBAS';
  tokenValorTipo?: 'FIXO' | 'KWH_APURADO';
  tokenValorFixo?: number;
  tokenDescontoMaxPerc?: number;
  tokenExpiracaoMeses?: number;
}
