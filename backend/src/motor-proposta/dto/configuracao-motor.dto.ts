import { IsString, IsNumber, IsBoolean, IsArray, IsOptional } from 'class-validator';

export class ConfiguracaoMotorDto {
  @IsOptional() @IsString()
  fonteKwh?: string;

  @IsOptional() @IsNumber()
  thresholdOutlier?: number;

  @IsOptional() @IsString()
  acaoOutlier?: string;

  @IsOptional() @IsString()
  acaoResultadoAcima?: string;

  @IsOptional() @IsString()
  acaoResultadoAbaixo?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  indicesCorrecao?: string[];

  @IsOptional() @IsString()
  combinacaoIndices?: string;

  @IsOptional() @IsBoolean()
  limiteReajusteConces?: boolean;

  @IsOptional() @IsNumber()
  diaAplicacaoAnual?: number;

  @IsOptional() @IsNumber()
  mesAplicacaoAnual?: number;

  @IsOptional() @IsString()
  aplicacaoCorrecao?: string;

  @IsOptional() @IsBoolean()
  aprovarManualmente?: boolean;

  @IsOptional() @IsBoolean()
  consumoMinimoFaturavelAtivo?: boolean;

  @IsOptional() @IsNumber()
  consumoMinimoMonofasicoKwh?: number;

  @IsOptional() @IsNumber()
  consumoMinimoBifasicoKwh?: number;

  @IsOptional() @IsNumber()
  consumoMinimoTrifasicoKwh?: number;
}
