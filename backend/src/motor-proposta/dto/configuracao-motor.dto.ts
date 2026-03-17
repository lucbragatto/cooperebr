export class ConfiguracaoMotorDto {
  fonteKwh?: string;
  thresholdOutlier?: number;
  acaoOutlier?: string;
  baseDesconto?: string;
  descontoPadrao?: number;
  descontoMinimo?: number;
  descontoMaximo?: number;
  acaoResultadoAcima?: string;
  acaoResultadoAbaixo?: string;
  indicesCorrecao?: string[];
  combinacaoIndices?: string;
  limiteReajusteConces?: boolean;
  diaAplicacaoAnual?: number;
  mesAplicacaoAnual?: number;
  aplicacaoCorrecao?: string;
  aprovarManualmente?: boolean;
}
