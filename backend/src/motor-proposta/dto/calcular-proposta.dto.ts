export class HistoricoItemDto {
  mesAno!: string;
  consumoKwh!: number;
  valorRS!: number;
}

export class CalcularPropostaDto {
  cooperadoId!: string;
  historico!: HistoricoItemDto[];
  kwhMesRecente!: number;
  valorMesRecente!: number;
  mesReferencia!: string;
  opcaoEscolhida?: 'MES_RECENTE' | 'MEDIA_12M';
}
