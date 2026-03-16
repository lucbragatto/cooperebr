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
}
