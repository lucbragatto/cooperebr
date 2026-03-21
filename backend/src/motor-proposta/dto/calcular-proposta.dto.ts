import { IsString, IsNumber, IsArray, IsOptional, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class HistoricoItemDto {
  @IsString()
  mesAno!: string;

  @IsNumber()
  consumoKwh!: number;

  @IsNumber()
  valorRS!: number;
}

export class CalcularPropostaDto {
  @IsString()
  cooperadoId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoricoItemDto)
  historico!: HistoricoItemDto[];

  @IsNumber()
  kwhMesRecente!: number;

  @IsNumber()
  valorMesRecente!: number;

  @IsString()
  mesReferencia!: string;

  @IsOptional()
  @IsIn(['MES_RECENTE', 'MEDIA_12M'])
  opcaoEscolhida?: 'MES_RECENTE' | 'MEDIA_12M';
}
